import * as _ from 'lodash'
import * as Promise from 'bluebird'
import * as DEBUG from 'debug'

import ParserWithUserInfo from './parser/parser-with-user-info'
import ParserWithoutUserInfo from './parser/parser-without-user-info'
import { queryCase } from '../utils'
import query from '../modules/mysql'
import redisClient from '../modules/redis-client'

const debug = DEBUG('crackflow:feature:parserWorker')
// set { userInfo.join(',') }
const REDIS_USER_INFO_REPETITION = `crackflow-${process.env.NODE_ENV}:statistic:repetition:set:{{table}}`

/**
 * 解析特征的worker
 * @param table           数据源对应的表名
 * @param rowFeatureMap   原始数据的特征名与标准特征名的对应关系
 * @param withUserInfo    是否包含用户信息
 * @param testLimite      是否是测试（测试时只请求10000个数据）
 */
export default async function parserWorker(
  table: string,
  rowFeatureMap,
  withUserInfo: boolean,
  testLimite?: boolean
) {
  debug(`Start parser ${table}`)
  // 1. 获取这张表的数据量
  let count: number
  if (testLimite !== undefined && testLimite) {
    count = 10000
  } else {
    const countQuery = await query(queryCase.count.replace(/{table}/g, table))
    if (countQuery) {
      count = _.values(countQuery[0])[0]
      debug(`${table} has ${count} datas, start to query all data.`)
    } else {
      debug(`${table} has none datas, maybe we have some errors.`)
      return
    }
  }
  // 2. 生成分批请求的sql-query语句
  const sqlList: string[] = []
  for (let start = 0; start < count; start = start + 10000) {
    sqlList.push(queryCase.itrAll
      .replace(/{table}/g, table)
      .replace('{query_schema}', _.keys(rowFeatureMap).join(','))
      .replace('{start}', start.toString())
    )
  }
  // 3. 5个一组 <10000请求> 分批reduce顺序请求
  let total = 0
  await Promise.mapSeries(_.chunk(sqlList, 5), sqls => {
    return Promise.map(sqls, async sql => {
      const rowMysqlData = await query(sql) as any[]
      const parsered = withUserInfo
        ? new ParserWithUserInfo(rowFeatureMap, rowMysqlData, table)
        : new ParserWithoutUserInfo(rowFeatureMap, rowMysqlData, table)
      await parsered.cleanAndGetFeature()
      total += parsered.count
      debug(`${table} finish ${total}/${count} mongo save, repetition: ${parsered.repetitionCount}, rubbish: ${parsered.illegalCount}`)
    })
  })
  // 4. 清空判重的缓存redis
  await redisClient.del(REDIS_USER_INFO_REPETITION)
}
