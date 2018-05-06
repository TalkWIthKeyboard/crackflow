import * as _ from 'lodash'
import * as Promise from 'bluebird'

import { parserZrevrange } from '../utils'
import { RowPasswordCount } from './interface'
import redisClient from '../modules/redis-client'

// sortedset { pwd: count }
const REDIS_PWD_COUNT = `crackflow-${process.env.NODE_ENV}:statistic:pwd:count`
// hm { tableName_(legal/total/repetition): count }
const REDIS_STATISTIC_LEGAL_COUNT = `crackflow-${process.env.NODE_ENV}:statistic:legalCount`
// hm { tableName_rowFeature: count }
const REDIS_STATISTIC_ROW_FEATURE_LEGAL_COUNT = `crackflow-${process.env.NODE_ENV}:statistic:rowFeature:legalCount`
// hm { tableName_feature: count }
const REDIS_STATISTIC_PWD_INCLUDE_COUNT = `crackflow-${process.env.NODE_ENV}:statistic:pwdInclude:count`

/**
 * 统计密码的出现次数，并以降序排列
 * @param passwords
 */
export function passwordCount(passwords: RowPasswordCount[]) {
  return Promise.mapSeries(_.chunk(passwords, 50), pwds => {
    return Promise.map(pwds, pwd => {
      return redisClient.zincrby(REDIS_PWD_COUNT, pwd.numcount, pwd.password)
    })
  })
}

/**
 * 取出 TOP-count 的密码以及次数
 * @param top
 */
export function getTopPasswordCount(top: number) {
  return parserZrevrange(REDIS_PWD_COUNT, 0, top, 'WITHSCORES')
}

/**
 * 统计包含特征的百分比
 * @param params
 */
export async function getIncludePasswordPercentage() {
  const featureRowMap = {
    mobileLastFour: 'mobile',
    mobileLastFive: 'mobile',
    mobileLastSix: 'mobile',
    mobileTotle: 'mobile',
    birthdayEight: 'ctfid',
    birthdaySix: 'ctfid',
    birthdayFour: 'ctfid',
    ctfIdLastFour: 'ctfid',
    ctfIdLastFive: 'ctfid',
    ctfIdLastSix: 'ctfid',
    usernameNumberFragmet: 'username',
    usernameStringFragmet: 'username',
    emailNumberFragmet: 'email',
    emailStringFragmet: 'email',
    namePinyin: 'name',
    namePinyinFirstLetter: 'name',
  }

  const rowCount = await redisClient.hgetall(REDIS_STATISTIC_ROW_FEATURE_LEGAL_COUNT)
  const rowTableMap = {}
  const rowCountMap = {}
  _.each(rowCount, (value, key) => {
    const [tableName, type] = key.split('_')
    if (!rowTableMap[tableName]) {
      rowTableMap[tableName] = {}
    }
    if (!rowCountMap[type]) {
      rowCountMap[type] = 0
    }
    rowTableMap[tableName][type] = parseInt(value)
    rowCountMap[type] += parseInt(value)
  })

  const featureCount = await redisClient.hgetall(REDIS_STATISTIC_PWD_INCLUDE_COUNT)
  const featureCountMap = {}
  _.each(featureCount, (value, key) => {
    const [, type] = key.split('_')
    if (!featureCountMap[type]) {
      featureCountMap[type] = {}
    }
    if (!featureCountMap[type].include) {
      featureCountMap[type].include = 0
    }
    featureCountMap[type].include += parseInt(value)
    featureCountMap[type].total = rowCountMap[featureRowMap[type]]
    featureCountMap[type].percentage = featureCountMap[type].include / featureCountMap[type].total
  })
  // featureCountMap  { feature: { include, total, percentage } }
  // rowTableMap      { table: { rowFeature: count } }
  return { featureCountMap, rowTableMap }
}

/**
 * 统计合法数据的分布
 * @param params
 */
export async function legalDataDistribute() {
  const legalCount = await redisClient.hgetall(REDIS_STATISTIC_LEGAL_COUNT)
  let totalAll = 0
  let legalAll = 0
  let repetitionAll = 0
  const statisticMap = {}
  _.each(legalCount, (value, key) => {
    const [tableName, type] = key.split('_')
    if (!statisticMap[tableName]) {
      statisticMap[tableName] = {}
    }
    switch (type) {
      case 'legal':
        legalAll += parseInt(value)
        statisticMap[tableName].legalCount = parseInt(value)
        break
      case 'total':
        totalAll += parseInt(value)
        statisticMap[tableName].totalCount = parseInt(value)
        break
      case 'repetition':
        repetitionAll += parseInt(value)
        statisticMap[tableName].repetitionCount = parseInt(value)
        break
      default:
    }
  })
  _.each(_.keys(statisticMap), key => {
    statisticMap[key].legalPercentage = statisticMap[key].legalCount / legalAll
    statisticMap[key].totalPercentage = statisticMap[key].totalCount / totalAll
    statisticMap[key].repetitionPercentage = statisticMap[key].repetitionCount | 0 / repetitionAll
  })
  // tslint:disable-next-line
  statisticMap['COUNT'] = {}
  // tslint:disable-next-line
  statisticMap['COUNT'].legalCount = legalAll
  // tslint:disable-next-line
  statisticMap['COUNT'].totalCount = totalAll
  // tslint:disable-next-line
  statisticMap['COUNT'].repetitionCount = repetitionAll
  // { table: {legalCount:, totalCount:, repetitionCount:, legalPercentage:, totalPercentage:, repetitionPercentage:,}}
  return statisticMap
}
