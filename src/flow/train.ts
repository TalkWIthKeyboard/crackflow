import * as cluster from 'cluster'
import * as os from 'os'
import * as DEBUG from 'debug'
import * as Promise from 'bluebird'
import * as _ from 'lodash'

import mongo from '../models'
import PCFG from '../algorithm/PCFG'
import Markov from '../algorithm/Markov'
import redisClient from '../modules/redis-client'
import { passwordCount } from '../statistic/major-total'

const debug = DEBUG('crackflow:train')
let tableIndex = 0
const tableInfo = ['7k7k', 'duduniu', 't12306', 'tianya']
const numCPUs = Math.min(os.cpus().length, tableInfo.length)

interface SplitIndex {
  start: number
  limit: number
}

/**
 * 分割一个整体
 * @param start     开始位置的下标
 * @param end       结束位置的下标
 * @param limit     每个单元的限制个数
 */
function _splitToArray(start: number, end: number, limit: number): SplitIndex[] {
  const splitIndexList: SplitIndex[] = []
  let index = start
  while (index < end) {
    splitIndexList.push({
      start: index,
      limit: index + limit < end ? limit : end - index,
    })
    index += limit
  }
  return splitIndexList
}

/**
 * 训练模型
 */
function train() {
  if (cluster.isMaster) {
    debug(`Master: ${process.pid} started.`)
    for (let i = 0; i < numCPUs; i += 1) {
      const worker = cluster.fork()
      worker.send(tableIndex)
      tableIndex += 1
    }
  } else {
    process.on('message', async index => {
      debug(`Worker: ${cluster.worker.id} started.`)      
      const table = tableInfo[index]
      const count = await mongo.Unit
        .find({ source: table })
        .count()
        .exec()
      const limit = 10000
      const trainIndexList = _splitToArray(0, Math.round(count * 0.8), 10000)
      const testIndexList = _splitToArray(Math.round(count * 0.8), count , 10000)
      debug(`${table} get ${trainIndexList.length} trainIndex.`)
      await Promise.mapSeries(trainIndexList, s => {
        return mongo.Unit
          .find({ source: table })
          .skip(s.start)
          .limit(s.limit)
          .exec()
          .then(async data => {
            debug(`${table} get [${s.start} - ${s.limit + s.start}].`)
            // 统计密码出现次数
            await passwordCount(_.map(data, info => {
              return {
                password: (info as any).password,
                numcount: (info as any).numcount,
              }
            }))
            debug(`${table} finish password count.`)
            // 进行PCFG训练
            const pcfg = new PCFG(_.map(data, info => {
              return {
                code: (info as any).password,
                count: (info as any).numcount,
              }
            }), true)
            pcfg.train()
            debug(`${table} finish pcfg train.`)
            // 进行Markov训练
            const markov = new Markov(_.map(data, info => {
              return {
                code: (info as any).password,
                count: (info as any).numcount, 
              }
            }), true, 3, true)
            markov.train()
            debug(`${table} finish markov train.`)
          })
      })
    })
  }
}

/**
 * 生成口令
 */
function passwordGenerate() {
  if (cluster.isMaster) {
    debug(`Master: ${process.pid} started.`)
    for (let i = 0; i < numCPUs; i += 1) {
      const worker = cluster.fork()
      worker.send(tableIndex)
      tableIndex += 1
    }
  } else {
    process.on('message', async index => {
      debug(`Worker: ${cluster.worker.id} started.`)
      const table = tableInfo[index]
      const pcfg = new PCFG([], false)
      await pcfg.passwordGenerate()
      debug(`${table} finish pcfg generate.`)
      const markov = new Markov([], false)
      await markov.passwordGenerate()
      debug(`${table} finish markov generate.`)
    })
  }
}

train()

// clean()

// async function clean() {
//   const removeKeys = _.flatten(await Promise.all([
//     redisClient.keys('crackflow-test:markov:*'),
//   ]))
//   console.log(removeKeys.length)
//   if (removeKeys.length > 0) {
//     await Promise.mapSeries(_.chunk(removeKeys, 1000), keys => {
//       return redisClient.del(...keys)
//     })
//   }
// }

// clean().then(() => {
//   process.exit(0)
// }).catch(err => {
//   console.log(err)
//   process.exit(1)
// })
