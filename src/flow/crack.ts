import * as cluster from 'cluster'
import * as os from 'os'
import * as DEBUG from 'debug'
import * as Promise from 'bluebird'
import * as _ from 'lodash'

import mongo from '../models'
import redisClient from '../modules/redis-client'
import PCFG from '../algorithm/PCFG'
import Markov from '../algorithm/Markov'
import MarkovPCFG from '../algorithm/markov-PCFG'
import { splitToArray, cover } from './default'

const globalConfig = require('../../../crack-config.json')
// 使用哪些模型生成的口令进行破解
const trainAlgorithms = globalConfig.global.algorithms
// 对哪些数据集进行破解
const targets = globalConfig.crack.targets
const global = globalConfig.global

const debug = DEBUG('crackflow:train')
let tableIndex = 0
const numCPUs = Math.min(os.cpus().length, trainAlgorithms.length)

/**
 * 破解口令
 */
function crackPassword() {
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
        .find({ source: { $in: targets } })
        .count()
        .exec(), global.queryTotal)
      const limit = global.queryLimit
      const rightPwdsIndexList = splitToArray(
        Math.round(count * global.trainProportion), 
        count, 
        limit
      )
      debug(`\n[${trainAlgorithm}->${targets.join('/')}]\n      Will handler ${rightPwdsIndexList.length} intervals.`)
      const totalList = _.flatten(await Promise.mapSeries(rightPwdsIndexList, s => {
        return mongo.Unit
          .find(
            { source: { $in: targets } }, 
            { __v: 0, _id: 0 }
          )
          .skip(s.start)
          .limit(s.limit)
          .lean(true)
          .exec()
          .then(async data => {
            debug(`\n[${trainAlgorithm}->${targets.join('/')}]\n      Get dataset interval in [${s.start} - ${s.limit + s.start}]`)
            let pwds
            // 普通的PCFG和Markov是不需要填充用户信息的
            // extra的PCFG和Markov需要填充用户信息
            // 1. 现在的规则是每个用户对应的选出前20组成破解序列
            switch (trainAlgorithm) {
              case 'PCFG':
                const pcfg = new PCFG([], false)
                pwds = await redisClient.zrevrange(
                  `crackflow-${process.env.NODE_ENV}:pcfg:probability`, 
                  0, 
                  globalConfig.crack.totalOfGeneratePwds[trainAlgorithm]
                )
                break
              case 'Markov':
                const markov = new Markov([], true, true, 3, false)
                pwds = await redisClient.zrevrange(
                  `crackflow-${process.env.NODE_ENV}:markov:probability`, 
                  0, 
                  globalConfig.crack.totalOfGeneratePwds[trainAlgorithm]
                )
                break
              case 'extra-PCFG':
                const extraPCFG = new PCFG([], true)
                const pcfgStructures = await redisClient.zrevrange(`crackflow-${process.env.NODE_ENV}:extra-pcfg:probability`, 0, -1)
                pwds = _.chain(data)
                        .map(userInfo => {
                          return extraPCFG.fillUserInfo(
                            userInfo, 
                            pcfgStructures, 
                            globalConfig.crack.numberOfUser.trainAlgorithm
                          )
                        })
                        .flatten()
                        .value()
                break
              case 'extra-Markov':
                const extraMarkov = new Markov([], true, true, 3, true)
                const markovStructures = await redisClient.zrevrange(`crackflow-${process.env.NODE_ENV}:extra-markov:probability`, 0, -1)
                pwds = _.chain(data)
                        .map(userInfo => {
                          return extraMarkov.fillUserInfo(
                            userInfo,
                            markovStructures,
                            globalConfig.crack.numberOfUser.trainAlgorithm
                          )
                        })
                        .flatten()
                        .value()
                break
              case 'markov-PCFG':
                const markovPCFG = new MarkovPCFG(3)
                const markovPCFGStructures = await redisClient.zrevrange(`crackflow-${process.env.NODE_ENV}:markov-pcfg:probability`, 0, -1)
                pwds = _.chain(data)
                        .map(userInfo => {
                          return markovPCFG.fillUserInfo(
                            userInfo,
                            markovPCFGStructures,
                            globalConfig.crack.numberOfUser.trainAlgorithm
                          )
                        })
                        .flatten()
                        .value()
                break
              default:
            }
            // 在cover函数中输出破解结果
            return cover(
              _.chain(pwds).map(p => p.replace(/¥/, '')).uniq().value().sort(),
              _.map(data, d => d.password).sort(),
              trainAlgorithm
            )
          }).catch(err => {
            debug('Error: ', err)
          })
      }))
      // 退出子进程
      cluster.worker.kill()
    })
  }
}

crackPassword()
