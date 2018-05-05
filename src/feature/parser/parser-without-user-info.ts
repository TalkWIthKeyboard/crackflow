import * as Promise from 'bluebird'
import * as DEBUG from 'debug'

import { AllRowDataWithoutUserInfo, WithoutUserInfoCount } from '../interface'
import redisClient from '../../modules/redis-client'
import models from '../../models'
import worker from '../row-feature-worker'

const debug = DEBUG('crackflow:statistic:parser')
// hm { tableName_(legal/total/repetition): count }
const REDIS_STATISTIC_LEGAL_COUNT = `crackflow-${process.env.NODE_ENV}:statistic:legalCount`

/**
 * row-data -> cleanly-data
 */
export default class ParserWithoutUserInfo {
  // 数据源名称
  private readonly _tableName
  // 原始特征到标准特征的绑定 { rowFeatureName: standardFeatureName }
  // todo 完成映射逻辑（现在数据集不需要，但是框架需要）
  // tslint:disable-next-line
  private readonly _rowFeatureMap
  // 原始数据 [{ rowFeatureName: value }]
  private readonly _rowData: AllRowDataWithoutUserInfo[]
  // 原始数据的个数
  private readonly _count: number
  // 合法数据个数( 密码是合法可用的，并且其他特征至少有一个是合法可用的 )
  private _legalCount: number
  // 需要持久化到mongo中的数据
  private readonly _mongoDataList: WithoutUserInfoCount[]

  constructor(
    rowFeatureMap,
    rowData: any[],
    tableName: string
  ) {
    this._tableName = tableName
    this._rowData = rowData
    this._count = rowData.length
    this._legalCount = 0
    this._mongoDataList = []
    this._rowFeatureMap = rowFeatureMap
  }

  get count(): number {
    return this._count
  }

  get illegalCount(): number {
    return this._count - this._legalCount
  }

  get repetitionCount(): number {
    return 0
  }

  public async cleanAndGetFeature() {
    try {
      for (const d of this._rowData) {
        // 判断密码的可用性
        const cleanedPwd = worker.password.clean(d.password)
        if (!cleanedPwd) {
          continue
        }
        const flattenData: WithoutUserInfoCount = {
          source: this._tableName,
          password: d.password,
          numcount: d.numcount,
        }
        // 是一个合法的数据
        this._legalCount += 1
        this._mongoDataList.push(flattenData)
      }
      Promise.all([
        redisClient.hincrby(REDIS_STATISTIC_LEGAL_COUNT, `${this._tableName}_legal`, this._legalCount),
        redisClient.hincrby(REDIS_STATISTIC_LEGAL_COUNT, `${this._tableName}_total`, this._count),
      ])
      // tslint:disable-next-line
      models.UnitWithoutUserInfo.insertMany(this._mongoDataList)
    } catch (err) {
      debug('ParserWithoutUserInfo has the error: ', err)
    }
  }
}
