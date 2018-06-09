import * as cluster from 'cluster'
import * as os from 'os'
import * as DEBUG from 'debug'
import * as Promise from 'bluebird'
import * as _ from 'lodash'

import mongo from '../models'
import PCFG from '../algorithm/PCFG'
import Markov from '../algorithm/Markov'
import MarkovPCFG from '../algorithm/markov-PCFG'
import { passwordCount } from '../statistic/major-total'
import { splitToArray } from './default'

const globalConfig = require('../../../crack-config.json')
// 使用哪些模型进行训练
const trainAlgorithms = globalConfig.global.algorithms
// 使用哪些数据源进行训练
const sources = globalConfig.train.sources
const global = globalConfig.global

const debug = DEBUG('crackflow:train')
let tableIndex = 0
const numCPUs = Math.min(os.cpus().length, trainAlgorithms.length)

/**
 * 训练模型
 */
function train() {
  if (cluster.isMaster) {
    for (let i = 0; i < numCPUs; i += 1) {
      const worker = cluster.fork()
      worker.send(tableIndex)
      tableIndex += 1
    }
    let exitProcessCounter = 0
    // 所有子进程完成任务以后主进程退出
    cluster.on('exit', () => {
      exitProcessCounter += 1
      if (exitProcessCounter === numCPUs) {
        process.exit(0)
      }
    })
  } else {
    process.on('message', async index => {
      const trainAlgorithm = trainAlgorithms[index]
      const count = Math.min(await mongo.Unit
        .find({ source: { $in: sources } })
        .count()
        .exec(), global.queryTotal)
      const limit = global.queryLimit
      const trainIndexList = splitToArray(0, Math.round(count * global.trainProportion), limit)
      debug(`\n[${sources.join('/')}->${trainAlgorithm}]\n      Will handler ${trainIndexList.length} intervals.`)
      await Promise.mapSeries(trainIndexList, s => {
        return mongo.Unit
          .find(
            { source: { $in: sources } }, 
            { __v: 0, _id: 0 }
          )
          .skip(s.start)
          .limit(s.limit)
          .lean(true)
          .exec()
          .then(async data => {
            debug(`\n[${sources.join('/')}->${trainAlgorithm}]\n      Get dataset interval in [${s.start} - ${s.limit + s.start}]`)
            switch (trainAlgorithm) {
              case 'PCFG':
                // 统计密码出现次数
                await passwordCount(_.map(data, info => ({
                  password: (info).password,
                  numcount: (info).numcount || 1,
                })))
                debug(`\n[${sources.join('/')}]\n      Finish all statistics in [${s.start} - ${s.limit + s.start}]`)
                // 进行PCFG训练
                const pcfg = new PCFG(_.map(data, info => ({
                  code: (info).password,
                  count: (info).numcount || 1,
                })), false)
                pcfg.train()
                break
              case 'extra-PCFG':
                // 进行extra-PCFG训练
                const extraPCFG = new PCFG(_.map(data, info => ({
                  code: (info).password,
                  count: (info).numcount || 1,
                  userInfo: _.omit(info, 'password'),
                })), true)
                extraPCFG.train()
                break
              case 'Markov':
                // 进行Markov训练
                const markov = new Markov(_.map(data, info => ({
                  code: (info).password,
                  count: (info).numcount || 1,
                })), false, true, 3, false)
                markov.train()
                break
              case 'extra-Markov':
                // 进行extra-Markov训练
                const extraMarkov = new Markov(_.map(data, info => ({
                  code: (info).password,
                  count: (info).numcount || 1,
                  userInfo: _.omit(info, 'password'),
                })), false, true, 3, true)
                extraMarkov.train()
                break
              default:
            }
            debug(`\n[${sources.join('/')}->${trainAlgorithm}]\n      Finish all trains in [${s.start} - ${s.limit + s.start}]`)
          }).catch(err => {
            debug('Error: ', err)
          })
      })
      cluster.worker.kill()
    })
  }
}

train()
