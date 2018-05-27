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
import { splitToArray, source, trainAlgorithms } from './default'

const debug = DEBUG('crackflow:train')
let tableIndex = 0
const numCPUs = Math.min(os.cpus().length, trainAlgorithms.length)

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
      const trainAlgorithm = trainAlgorithms[index]
      const count = await mongo.Unit
        .find({ source: { $in: source } })
        .count()
        .exec()
      const limit = 100000
      const trainIndexList = splitToArray(0, Math.round(count * 0.8), limit)
      debug(`${source.join('/')}-${trainAlgorithm} get ${trainIndexList.length} trainIndex.`)
      await Promise.mapSeries(trainIndexList, s => {
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
            switch (trainAlgorithm) {
              case 'PCFG':
                // 统计密码出现次数
                await passwordCount(_.map(data, info => {
                  return {
                    password: (info).password,
                    numcount: (info).numcount || 1,
                  }
                }))
                debug(`${source.join('/')}-${trainAlgorithm} finish password count.`)
                // 进行PCFG训练
                const pcfg = new PCFG(_.map(data, info => {
                  return {
                    code: (info).password,
                    count: (info).numcount || 1,
                  }
                }), false)
                pcfg.train()
                break
              case 'extra-PCFG':
                // 进行extra-PCFG训练
                const extraPCFG = new PCFG(_.map(data, info => {
                  return {
                    code: (info).password,
                    count: (info).numcount || 1,
                    userInfo: _.omit(info, 'password'),
                  }
                }), true)
                extraPCFG.train()
                break
              case 'Markov':
                // 进行Markov训练
                const markov = new Markov(_.map(data, info => {
                  return {
                    code: (info).password,
                    count: (info).numcount || 1,
                  }
                }), true, false, 3, false)
                markov.train()
                break
              case 'extra-Markov':
                // 进行extra-Markov训练
                const extraMarkov = new Markov(_.map(data, info => {
                  return {
                    code: (info).password,
                    count: (info).numcount || 1,
                    userInfo: _.omit(info, 'password'),
                  }
                }), true, true, 3, true)
                extraMarkov.train()
                break
              default:
            }
            debug(`${source.join('/')} finish ${trainAlgorithm} train.`)
          }).catch(err => {
            console.log(err)
          })
      })
    })
  }
}

train()
