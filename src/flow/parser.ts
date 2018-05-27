import * as cluster from 'cluster'
import * as os from 'os'
import * as DEBUG from 'debug'

import parserWorker from '../feature'

const debug = DEBUG('crackflow:flow')
let tableIndex = 0
// todo tableInfo 外移（框架需要）
const tableInfo = [{
  tableName: 't12306',
  tableRowFeatureMap: {
    password: 'password',
    email: 'email',
    name: 'name',
    CtfID: 'ctfid',
    mobile: 'mobile',
    username: 'username',
  },
  withUserInfo: true,
}, {
  tableName: 'duduniu',
  tableRowFeatureMap: {
    password: 'password',
    username: 'username',
    email: 'email',
  },
  withUserInfo: true,
}, {
  tableName: '7k7k',
  tableRowFeatureMap: {
    password: 'password',
    username: 'email',
  },
  withUserInfo: true,
}, {
  tableName: 'tianya',
  tableRowFeatureMap: {
    password: 'password',
    email: 'email',
    username: 'username',
  },
  withUserInfo: true,
}, {
  tableName: 'phpbb',
  tableRowFeatureMap: {
    password: 'password',
    numcount: 'numcount',
  },
  withUserInfo: false,
}, {
  tableName: 'rock',
  tableRowFeatureMap: {
    password: 'password',
    numcount: 'numcount',
  },
  withUserInfo: false,
}]
const numCPUs = Math.min(os.cpus().length, tableInfo.length)

export default function parser(
  isTest: boolean
) {
  if (cluster.isMaster) {
    debug(`Master: ${process.pid} started.`)
    // 繁生子进程
    for (let i = 0; i < numCPUs; i++) {
      const worker = cluster.fork()
      // 分发任务
      worker.send(tableIndex)
      tableIndex += 1
    }
  } else {
    debug(`Worker: ${cluster.worker.id} started.`)
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
