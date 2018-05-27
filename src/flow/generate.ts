import * as cluster from 'cluster'
import * as os from 'os'
import * as DEBUG from 'debug'

import PCFG from '../algorithm/PCFG'
import Markov from '../algorithm/Markov'
import MarkovPCFG from '../algorithm/markov-PCFG'
import { source, trainAlgorithms } from './default'

const debug = DEBUG('crackflow:train')
let tableIndex = 0
const numCPUs = Math.min(os.cpus().length, trainAlgorithms.length)

/**
 * 训练模型
 */
function generate() {
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
            const markov = new Markov([], true, false, 3, false)
            await markov.passwordGenerate()
            break
          case 'extra-Markov':
            const extraMarkov = new Markov([], true, true, 3, true)
            await extraMarkov.passwordGenerate()
            break
          default:
        }
        debug(`${source.join('/')} finish ${trainAlgorithm} train.`)
      } catch (err) {
        console.log(err)
      }
    })
  }
}

generate()
