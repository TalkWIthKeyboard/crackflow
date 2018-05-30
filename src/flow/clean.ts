import redisClient from '../modules/redis-client'
import * as _ from 'lodash'
import * as Promise from 'bluebird'

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
    count += 1000
    console.log(`${count} / ${keys.length}`)
    return redisClient.del(...keyList)
  })
}

// removeAllRedisKey().then(() => {
//   process.exit(0)
// }).catch(err => {
//   console.log(err)
//   process.exit(1)
// })

async function show() {
  const a = await redisClient.zcard(`crackflow-${process.env.NODE_ENV}:extra-pcfg:probability`)
  const b = await redisClient.zcard(`crackflow-${process.env.NODE_ENV}:markov-pcfg:probability`)
  const c = await redisClient.zcard(`crackflow-${process.env.NODE_ENV}:extra-pcfg:count`)
  const e = await redisClient.zcard(`crackflow-${process.env.NODE_ENV}:markov:probability`)
  const f = await redisClient.zcard(`crackflow-${process.env.NODE_ENV}:extra-markov:probability`)
  const g = await redisClient.zcard(`crackflow-${process.env.NODE_ENV}:pcfg:probability`)
  console.log(a, b, e, f, g)
  // console.log(b.slice(0, 200))
  // console.log(c.slice(0, 100))
}

show()
