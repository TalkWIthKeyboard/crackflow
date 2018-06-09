import * as _ from 'lodash'
import * as Promise from 'bluebird'
import * as DEBUG from 'debug'

import redisClient from '../modules/redis-client'

const debug = DEBUG('crackflow:clean')

async function removeAllRedisKey() {
  const keys = _.flatten(await Promise.all([
    redisClient.keys(`crackflow-${process.env.NODE_ENV}:statistic:pwd:count`),
    redisClient.keys(`crackflow-${process.env.NODE_ENV}:statistic:length:count`),
    redisClient.keys(`crackflow-${process.env.NODE_ENV}:statistic:char:count`),
    redisClient.keys(`crackflow-${process.env.NODE_ENV}:*pcfg:*`),
    redisClient.keys(`crackflow-${process.env.NODE_ENV}:*markov:*`),
    redisClient.keys(`crackflow-${process.env.NODE_ENV}:*pcfg:probability`),
    redisClient.keys(`crackflow-${process.env.NODE_ENV}:*markov:probability`),
    redisClient.keys(`crackflow-${process.env.NODE_ENV}:markov-pcfg:probability`)
  ]))
  let count = 0
  await Promise.mapSeries(_.chunk(keys, 1000), keyList => {
    count += keyList.length
    debug(`Remove redis keys: ${count} / ${keys.length}`)
    return redisClient.del(...keyList)
  })
  debug(`Remove all redis keys.`)
}

removeAllRedisKey().then(() => {
  process.exit(0)
}).catch(err => {
  console.log(err)
  process.exit(1)
})
