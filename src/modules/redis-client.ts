import * as config from 'config'
import * as Redis from 'ioredis'

const rdc = new Redis({
  port: config.get<number>('redis.port'),
  host: config.get<string>('redis.host'),
  password: config.get<string>('redis.auth'),
})

export default rdc
