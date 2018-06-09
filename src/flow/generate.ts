import * as cluster from 'cluster'
import * as os from 'os'
import * as DEBUG from 'debug'

import PCFG from '../algorithm/PCFG'
import Markov from '../algorithm/Markov'
import MarkovPCFG from '../algorithm/markov-PCFG'

const globalConfig = require('../../../crack-config.json')
// 使用哪些模型进行训练
const trainAlgorithms = globalConfig.global.algorithms
// 使用哪些数据源进行训练
const sources = globalConfig.train.sources

const debug = DEBUG('crackflow:generate')
let tableIndex = 0
const numCPUs = Math.min(os.cpus().length, trainAlgorithms.length)

/**
 * 训练模型
 */
function generate() {
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
      try {
        switch (trainAlgorithm) {
          case 'PCFG':
            const pcfg = new PCFG([], false)
            await pcfg.passwordGenerate()
            break
          case 'extra-PCFG':
            const extraPcfg = new PCFG([], true)
            await extraPcfg.passwordGenerate()
            break
          case 'Markov':
            const markov = new Markov([], true, true, 3, false)
            await markov.passwordGenerate()
            break
          case 'extra-Markov':
            const extraMarkov = new Markov([], true, true, 3, true)
            await extraMarkov.passwordGenerate()
            break
          case 'markov-PCFG':
            const markovPCFG = new MarkovPCFG(3)
            await markovPCFG.passwordGenerate()
            break
          default:
        }
        debug(`\n[${sources.join('/')}->${trainAlgorithm}]\n      Generate all passwords`)
      } catch (err) {
        debug('Error: ', err)
      }
      cluster.worker.kill()
    })
  }
}

generate()
