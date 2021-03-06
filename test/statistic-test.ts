import test from 'ava'

import redisClient from '../src/modules/redis-client'
import { passwordCount, getTopPasswordCount } from '../src/statistic/major-total'

const REDIS_STATISTIC_PWD_KEY = 'crackflow-test:statistic:pwd:*'

const mockData = [
  { password: '123456', numcount: 2650 },
  { password: 'password', numcount: 1244 },
  { password: 'phpbb', numcount: 708 },
  { password: 'qwerty', numcount: 562 },
  { password: '12345', numcount: 418 },
  { password: '12345678', numcount: 371 },
  { password: 'letmein', numcount: 343 },
  { password: '111111', numcount: 313 },
  { password: '1234', numcount: 273 },
  { password: '123456789', numcount: 253 },
  { password: 'abc123', numcount: 224 },
  { password: 'test', numcount: 223 },
  { password: '123123', numcount: 221 },
  { password: 'monkey', numcount: 190 },
  { password: 'dragon', numcount: 187 },
  { password: 'trustno1', numcount: 171 },
  { password: 'master', numcount: 166 },
  { password: 'hello', numcount: 148 },
  { password: '1234567', numcount: 136 },
  { password: 'computer', numcount: 127 },
  { password: 'killer', numcount: 124 },
  { password: '000000', numcount: 123 },
  { password: 'whatever', numcount: 108 },
  { password: 'internet', numcount: 107 },
  { password: 'aaaaaa', numcount: 106 },
  { password: 'shadow', numcount: 104 },
  { password: 'superman', numcount: 101 },
  { password: 'starwars', numcount: 97 },
  { password: '123321', numcount: 97 },
  { password: '654321', numcount: 95 },
  { password: 'qazwsx', numcount: 92 },
  { password: 'asdf', numcount: 92 },
  { password: 'cheese', numcount: 84 },
  { password: 'pokemon', numcount: 83 },
  { password: 'testing', numcount: 82 },
  { password: 'fuckyou', numcount: 82 },
  { password: 'matrix', numcount: 81 },
  { password: '666666', numcount: 78 },
  { password: 'welcome', numcount: 77 },
  { password: 'pass', numcount: 76 },
  { password: 'football', numcount: 75 },
  { password: 'blahblah', numcount: 75 },
  { password: 'asdfasdf', numcount: 75 },
  { password: 'tigger', numcount: 74 },
  { password: 'charlie', numcount: 71 },
  { password: 'nothing', numcount: 69 },
  { password: 'joshua', numcount: 69 },
  { password: 'michael', numcount: 68 },
  { password: 'hunter', numcount: 68 },
  { password: 'freedom', numcount: 68 },
  { password: 'buster', numcount: 68 },
  { password: 'thomas', numcount: 67 },
  { password: 'merlin', numcount: 66 },
  { password: 'soccer', numcount: 64 },
  { password: 'secret', numcount: 63 },
  { password: 'forum', numcount: 63 },
  { password: 'daniel', numcount: 63 },
  { password: 'admin', numcount: 62 },
  { password: 'testtest', numcount: 61 },
  { password: 'pepper', numcount: 61 },
  { password: 'iloveyou', numcount: 61 },
  { password: '123qwe', numcount: 61 },
  { password: 'silver', numcount: 60 },
  { password: 'hahaha', numcount: 60 },
  { password: 'biteme', numcount: 60 },
  { password: 'baseball', numcount: 60 },
  { password: '112233', numcount: 60 },
  { password: 'sunshine', numcount: 59 },
  { password: 'jennifer', numcount: 59 },
  { password: 'google', numcount: 59 },
  { password: 'gateway', numcount: 59 },
  { password: 'orange', numcount: 58 },
  { password: 'helpme', numcount: 58 },
  { password: 'andrew', numcount: 58 },
  { password: 'fuckoff', numcount: 57 },
  { password: 'jordan', numcount: 56 },
  { password: 'asdfgh', numcount: 56 },
  { password: 'compaq', numcount: 55 },
  { password: 'azerty', numcount: 55 },
  { password: '159753', numcount: 55 },
  { password: '1111', numcount: 55 },
  { password: 'mustang', numcount: 54 },
  { password: 'eminem', numcount: 54 },
  { password: 'chicken', numcount: 54 },
  { password: 'asdasd', numcount: 54 },
  { password: '123654', numcount: 54 },
  { password: 'online', numcount: 52 },
  { password: 'microsoft', numcount: 52 },
  { password: 'ginger', numcount: 52 },
  { password: 'purple', numcount: 51 },
  { password: 'phpbb2', numcount: 51 },
  { password: 'access', numcount: 51 },
  { password: 'passw0rd', numcount: 50 },
  { password: 'nintendo', numcount: 50 },
  { password: '11111111', numcount: 50 },
  { password: '11111', numcount: 50 },
  { password: 'digital', numcount: 49 },
  { password: 'diablo', numcount: 49 },
  { password: '1qaz2wsx', numcount: 49 },
  { password: '1234567890', numcount: 49 },
]

test.beforeEach(async () => {
  const removeKeys = await redisClient.keys(REDIS_STATISTIC_PWD_KEY)
  if (removeKeys.length > 0) {
    await redisClient.del(...removeKeys)
  }
})

test('Statistic password count test', async t => {
  const mockResult = [
    { key: '123456', value: 2650 },
    { key: 'password', value: 1244 },
    { key: 'phpbb', value: 708 },
    { key: 'qwerty', value: 562 },
    { key: '12345', value: 418 },
    { key: '12345678', value: 371 },
    { key: 'letmein', value: 343 },
    { key: '111111', value: 313 },
    { key: '1234', value: 273 },
    { key: '123456789', value: 253 },
    { key: 'abc123', value: 224 },
  ]

  await passwordCount(mockData)
  const topData = await getTopPasswordCount(10)
  t.deepEqual(mockResult, topData)
})
