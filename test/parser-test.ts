import test from 'ava'

import parserWorker from '../src/feature'
import redisClient from '../src/modules/redis-client'
import models from '../src/models'

const REDIS_STATISTIC_KEY = 'crackflow:statistic:*'

test.beforeEach(async () => {
  const removeKeys = await redisClient.keys(REDIS_STATISTIC_KEY)
  if (removeKeys.length > 0) {
    await redisClient.del(...removeKeys)
  }
})

test('Parser t12306 data', async t => {
  const mockResult = {
    t12306_mobileLastFour: '1671',
    t12306_mobileLastFive: '1195',
    t12306_mobileLastSix: '1125',
    t12306_mobileTotle: '1070',
    t12306_birthdayEight: '1492',
    t12306_birthdaySix: '2965',
    t12306_birthdayFour: '6920',
    t12306_ctfIdLastFour: '668',
    t12306_ctfIdLastFive: '136',
    t12306_ctfIdLastSix: '127',
    t12306_usernameNumberFragmet: '14545',
    t12306_usernameStringFragmet: '31753',
    t12306_emailNumberFragmet: '34014',
    t12306_emailStringFragmet: '33863',
    t12306_namePinyin: '18166',
    t12306_namePinyinFirstLetter: '25160',
  }

  const mockRowFeatureMap = {
    password: 'password',
    email: 'email',
    name: 'name',
    CtfID: 'ctfid',
    mobile: 'mobile',
    username: 'username',
  }
  await parserWorker('t12306', mockRowFeatureMap, true)
  const pwdIncludeCount = await redisClient.hgetall('crackflow:statistic:pwdInclude:count')
  t.deepEqual(pwdIncludeCount, mockResult)
})

test.afterEach(async () => {
  const removeKeys = await redisClient.keys(REDIS_STATISTIC_KEY)
  if (removeKeys.length > 0) {
    await redisClient.del(...removeKeys)
  }
  await models.Unit.remove({ source: 't12306' }).exec()
})
