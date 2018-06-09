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
import { splitToArray, cover, source, trainAlgorithms } from './default'

const debug = DEBUG('crackflow:train')
let tableIndex = 0
const numCPUs = Math.min(os.cpus().length, trainAlgorithms.length)

/**
 * 破解口令
 */
function crackPassword() {
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
      const trainAlgorithm = trainAlgorithms[index]
      const count = Math.min(await mongo.Unit
        .find({ source: { $in: source } })
        .count()
        .exec(), 2000000)
      const limit = 100000
      const rightPwdsIndexList = splitToArray(Math.round(count * 0.95), count, limit)
      debug(`${source.join('/')}-${trainAlgorithm} get ${rightPwdsIndexList.length} rightPwdsIndex.`)
      const totalList = _.flatten(await Promise.mapSeries(rightPwdsIndexList, s => {
        return mongo.Unit
          .find({
            source: { $in: source },
          }, {
              __v: 0,
              _id: 0,
            })
          .skip(s.start)
          .limit(s.limit)
          .lean(true)
          .exec()
          .then(async data => {
            debug(`${source.join('/')}-${trainAlgorithm} get [${s.start} - ${s.limit + s.start}].`)
            let pwds
            // 普通的PCFG和Markov是不需要填充用户信息的
            // extra的PCFG和Markov需要填充用户信息
            // 1. 现在的规则是每个用户对应的选出前20组成破解序列
            switch (trainAlgorithm) {
              case 'PCFG':
                const pcfg = new PCFG([], false)
                pwds = await redisClient.zrevrange(`crackflow-${process.env.NODE_ENV}:pcfg:probability`, 0, 450000)
                break
              case 'Markov':
                const markov = new Markov([], true, true, 3, false)
                pwds = await redisClient.zrevrange(`crackflow-${process.env.NODE_ENV}:markov:probability`, 0, 450000)
                break
              case 'extra-PCFG':
                const extraPCFG = new PCFG([], true)
                const pcfgStructures = await redisClient.zrevrange(`crackflow-${process.env.NODE_ENV}:extra-pcfg:probability`, 0, -1)
                pwds = _.flatten(_.map(data, userInfo => {
                  return extraPCFG.fillUserInfo(userInfo, pcfgStructures, 400)
                }))
                break
              case 'extra-Markov':
                const extraMarkov = new Markov([], true, true, 3, true)
                const markovStructures = await redisClient.zrevrange(`crackflow-${process.env.NODE_ENV}:extra-markov:probability`, 0, -1)
                pwds = _.flatten(_.map(data, userInfo => {
                  return extraMarkov.fillUserInfo(userInfo, markovStructures, 400)
                }))
                break
              case 'markov-PCFG':
                const markovPCFG = new MarkovPCFG(3)
                const markovPCFGStructures = await redisClient.zrevrange(`crackflow-${process.env.NODE_ENV}:markov-pcfg:probability`, 0, -1)
                pwds = _.flatten(_.map(data, userInfo => {
                  return markovPCFG.fillUserInfo(userInfo, markovPCFGStructures, 400)
                }))
                break
              default:
            }
            debug(`${source}-${trainAlgorithm} finished cracking all pwds: generate ${_.uniq(pwds as string[]).length}`)
            return cover(
              _.uniq(_.map(pwds, p => p.replace(/¥/, ''))).sort(),
              _.map(data, d => d.password).sort(),
              trainAlgorithm
            )
          }).catch(err => {
            console.log(err)
          })
      }))
      console.log(trainAlgorithm, totalList)
    })
  }
}

crackPassword()
