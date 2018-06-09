import * as cluster from 'cluster'
import * as os from 'os'
import * as DEBUG from 'debug'

import parserWorker from '../feature'

const debug = DEBUG('crackflow:flow')
let tableIndex = 0
const tableInfo = require('../../../crack-config.json').parser.tableInfo
const numCPUs = Math.min(os.cpus().length, tableInfo.length)

/**
 * 规则化文本，提取特征
 * @param isTest    测试参数
 */
function parser(
  isTest: boolean
) {
  if (cluster.isMaster) {
    // 繁生子进程
    for (let i = 0; i < numCPUs; i++) {
      const worker = cluster.fork()
      // 分发任务
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
      const table = tableInfo[index]
      await parserWorker(
        table.tableName,
        table.tableRowFeatureMap,
        table.withUserInfo,
        isTest
      )
      debug(`Worker: ${cluster.worker.id} finishe ${table.tableName} parser.`)
      cluster.worker.kill()
    })
  }
}

parser(false)
