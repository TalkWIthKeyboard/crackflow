import * as _ from 'lodash'
import * as Promise from 'bluebird'
import * as DEBUG from 'debug'

import { AllFeature, AllRowDataWithUserInfo } from '../interface'
import worker from '../row-feature-worker'
import redisClient from '../../modules/redis-client'
import models from '../../models'

const debug = DEBUG('crackflow:statistic:parser')
// hm { tableName_(legal/total/repetition): count }
const REDIS_STATISTIC_LEGAL_COUNT = `crackflow-${process.env.NODE_ENV}:statistic:legalCount`
// hm { tableName_rowFeature: count }
const REDIS_STATISTIC_ROW_FEATURE_LEGAL_COUNT = `crackflow-${process.env.NODE_ENV}:statistic:rowFeature:legalCount`
// hm { tableName_feature: count }
const REDIS_STATISTIC_PWD_INCLUDE_COUNT = `crackflow-${process.env.NODE_ENV}:statistic:pwdInclude:count`
// set { userInfo.join(',') }
const REDIS_USER_INFO_REPETITION = `crackflow-${process.env.NODE_ENV}:statistic:repetition:set:{{table}}`

/**
 * row-data -> cleanly-data -> feature
 */
export default class ParserWithUserInfo {
  // 数据源名称
  private readonly _tableName
  // 原始特征到标准特征的绑定 { rowFeatureName: standardFeatureName }
  private readonly _rowFeatureMap
  // 原始数据 [{ rowFeatureName: value }]
  private readonly _rowData: AllRowDataWithUserInfo[]
  // 原始数据的个数
  private readonly _count: number
  // 重复数据的个数
  private _repetitionCount: number
  // 合法数据个数( 密码是合法可用的，并且其他特征至少有一个是合法可用的 )
  private _legalCount: number
  // 合法原始特征分别的个数
  private readonly _rowFeatureLegalCount: {}
  // 提取到的特征数组
  private readonly _featureList: AllFeature[]
  // 密码当中包含特征的个数
  private readonly _pwdIncludeFeature: {}

  constructor(
    rowFeatureMap,
    rowData: any[],
    tableName: string
  ) {
    this._tableName = tableName
    this._rowFeatureMap = rowFeatureMap
    this._rowData = rowData
    this._count = rowData.length
    this._legalCount = 0
    this._repetitionCount = 0
    this._rowFeatureLegalCount = {
      username: 0,
      email: 0,
      name: 0,
      mobile: 0,
      ctfid: 0,
    }
    this._featureList = []
    this._pwdIncludeFeature = {
      mobileLastFour: 0,
      mobileLastFive: 0,
      mobileLastSix: 0,
      mobileTotle: 0,
      birthdayEight: 0,
      birthdaySix: 0,
      birthdayFour: 0,
      ctfIdLastFour: 0,
      ctfIdLastFive: 0,
      ctfIdLastSix: 0,
      usernameNumberFragmet: 0,
      usernameStringFragmet: 0,
      emailNumberFragmet: 0,
      emailStringFragmet: 0,
      namePinyin: 0,
      namePinyinFirstLetter: 0,
    }
  }

  get count(): number {
    return this._count
  }

  get illegalCount(): number {
    return this._count - this._legalCount - this._repetitionCount
  }

  get repetitionCount(): number {
    return this._repetitionCount
  }

  private _passwordIncludeStatistic(data: AllFeature) {
    _.each(_.keys(data), key => {
      if (key === 'password' || key === 'source') {
        return
      }
      const value = data[key]
      switch (typeof value) {
        case 'string':
          if (data.password.includes(value)) {
            this._pwdIncludeFeature[key] += 1
          }
          break
        // 针对数字片段和字母片段
        case 'object':
          for (const v of value) {
            if (data.password.includes(v)) {
              this._pwdIncludeFeature[key] += 1
              break
            }
          }
          break
        default:
      }
    })
  }

  public async cleanAndGetFeature() {
    try {
      for (const d of this._rowData) {
        let featureLegalCount = 0
        // 判断密码的可用性
        const cleanedPwd = worker.password.clean(d.password)
        if (!cleanedPwd) {
          continue
        }
        const flattenFeature: AllFeature = {
          source: this._tableName,
          password: cleanedPwd,
        }
        // 判断是否是重复数据
        const encodeUserInfo = _.values(d).join(',')
        const inRedis = await redisClient.sismember(
          REDIS_USER_INFO_REPETITION.replace(/{{table}}/, this._tableName),
          encodeUserInfo
        )
        if (inRedis) {
          this._repetitionCount += 1
          continue
        }
        // 判断其他特征的可用性
        _.forEach(d, (value, key) => {
          if (this._rowFeatureMap[key] === 'password') {
            return
          }
          const cleanFunc = worker[this._rowFeatureMap[key]].clean
          const parserFunc = worker[this._rowFeatureMap[key]].parser
          const cleanedResult = cleanFunc(value)
          if (cleanedResult) {
            Object.assign(flattenFeature, parserFunc(cleanedResult))
            this._rowFeatureLegalCount[this._rowFeatureMap[key]] += 1
            featureLegalCount += 1
          }
        })
        if (featureLegalCount === 0) {
          continue
        }
        // 是一个合法的数据
        await redisClient.sadd(
          REDIS_USER_INFO_REPETITION.replace(/{{table}}/, this._tableName),
          encodeUserInfo
        )
        this._legalCount += 1
        this._featureList.push(flattenFeature)
        this._passwordIncludeStatistic(flattenFeature)
      }
      // 持久化统计提取结果
      Promise.all([
        redisClient.hincrby(REDIS_STATISTIC_LEGAL_COUNT, `${this._tableName}_legal`, this._legalCount),
        redisClient.hincrby(REDIS_STATISTIC_LEGAL_COUNT, `${this._tableName}_total`, this._count),
        redisClient.hincrby(REDIS_STATISTIC_LEGAL_COUNT, `${this._tableName}_repetition`, this._repetitionCount),
      ])
      Promise.map(_.filter(_.values(this._rowFeatureMap), k => {
        return k !== 'password'
      }), key => {
        return redisClient.hincrby(
          REDIS_STATISTIC_ROW_FEATURE_LEGAL_COUNT,
          `${this._tableName}_${key}`,
          this._rowFeatureLegalCount[key]
        )
      })
      Promise.map(_.keys(this._pwdIncludeFeature), key => {
        return redisClient.hincrby(
          REDIS_STATISTIC_PWD_INCLUDE_COUNT,
          `${this._tableName}_${key}`,
          this._pwdIncludeFeature[key]
        )
      })
      // tslint:disable-next-line
      models.Unit.insertMany(this._featureList)
    } catch (err) {
      debug('ParserWithUserInfo has the error: ', err)
    }
  }
}
