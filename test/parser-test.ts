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
    t12306_mobileLastFour: '194',
    t12306_mobileLastFive: '152',
    t12306_mobileLastSix: '144',
    t12306_mobileTotle: '140',
    t12306_birthdayEight: '139',
    t12306_birthdaySix: '250',
    t12306_birthdayFour: '576',
    t12306_ctfIdLastFour: '68',
    t12306_ctfIdLastFive: '27',
    t12306_ctfIdLastSix: '26',
    t12306_usernameNumberFragmet: '1096',
    t12306_usernameStringFragmet: '2678',
    t12306_emailNumberFragmet: '2662',
    t12306_emailStringFragmet: '2194',
    t12306_namePinyin: '1373',
    t12306_namePinyinFirstLetter: '1988',
  }

  const mockRowFeatureMap = {
    password: 'password',
    email: 'email',
    name: 'name',
    CtfID: 'ctfid',
    mobile: 'mobile',
    username: 'username',
  }
  await parserWorker('t12306', mockRowFeatureMap, true, true)
  const pwdIncludeCount = await redisClient.hgetall('crackflow:statistic:pwdInclude:count')
  t.deepEqual(pwdIncludeCount, mockResult)
  await models.Unit.remove({ source: 't12306' }).exec()
})

test('Parser duduniu data', async t => {
  const mockResult = {
    duduniu_mobileLastFour: '0',
    duduniu_mobileLastFive: '0',
    duduniu_mobileLastSix: '0',
    duduniu_mobileTotle: '0',
    duduniu_birthdayEight: '0',
    duduniu_birthdaySix: '0',
    duduniu_birthdayFour: '0',
    duduniu_ctfIdLastFour: '0',
    duduniu_ctfIdLastFive: '0',
    duduniu_ctfIdLastSix: '0',
    duduniu_usernameNumberFragmet: '1359',
    duduniu_usernameStringFragmet: '1712',
    duduniu_emailNumberFragmet: '837',
    duduniu_emailStringFragmet: '779',
    duduniu_namePinyin: '0',
    duduniu_namePinyinFirstLetter: '0',
  }

  const mockRowFeatureMap = {
    password: 'password',
    username: 'username',
    email: 'email',
  }
  await parserWorker('duduniu', mockRowFeatureMap, true, true)
  const pwdIncludeCount = await redisClient.hgetall('crackflow:statistic:pwdInclude:count')
  t.deepEqual(pwdIncludeCount, mockResult)
  await models.Unit.remove({ source: 'duduniu' }).exec()
})

test('Parser 7k7k data', async t => {
  const mockResult = {
    '7k7k_mobileLastFour': '0',
    '7k7k_mobileLastFive': '0',
    '7k7k_mobileLastSix': '0',
    '7k7k_mobileTotle': '0',
    '7k7k_birthdayEight': '0',
    '7k7k_birthdaySix': '0',
    '7k7k_birthdayFour': '0',
    '7k7k_ctfIdLastFour': '0',
    '7k7k_ctfIdLastFive': '0',
    '7k7k_ctfIdLastSix': '0',
    '7k7k_usernameNumberFragmet': '822',
    '7k7k_usernameStringFragmet': '267',
    '7k7k_emailNumberFragmet': '0',
    '7k7k_emailStringFragmet': '0',
    '7k7k_namePinyin': '0',
    '7k7k_namePinyinFirstLetter': '0',
  }

  const mockRowFeatureMap = {
    password: 'password',
    username: 'username',
  }
  await parserWorker('7k7k', mockRowFeatureMap, true, true)
  const pwdIncludeCount = await redisClient.hgetall('crackflow:statistic:pwdInclude:count')
  t.deepEqual(pwdIncludeCount, mockResult)
  await models.Unit.remove({ source: '7k7k' }).exec()
})

test('Parser tianya data', async t => {
  const mockResult = {
    tianya_mobileLastFour: '0',
    tianya_mobileLastFive: '0',
    tianya_mobileLastSix: '0',
    tianya_mobileTotle: '0',
    tianya_birthdayEight: '0',
    tianya_birthdaySix: '0',
    tianya_birthdayFour: '0',
    tianya_ctfIdLastFour: '0',
    tianya_ctfIdLastFive: '0',
    tianya_ctfIdLastSix: '0',
    tianya_usernameNumberFragmet: '668',
    tianya_usernameStringFragmet: '265',
    tianya_emailNumberFragmet: '1009',
    tianya_emailStringFragmet: '329',
    tianya_namePinyin: '0',
    tianya_namePinyinFirstLetter: '0',
  }

  const mockRowFeatureMap = {
    password: 'password',
    email: 'email',
    username: 'username',
  }
  await parserWorker('tianya', mockRowFeatureMap, true, true)
  const pwdIncludeCount = await redisClient.hgetall('crackflow:statistic:pwdInclude:count')
  t.deepEqual(pwdIncludeCount, mockResult)
  await models.Unit.remove({ source: 'tianya' }).exec()
})

test.afterEach(async () => {
  const removeKeys = await redisClient.keys(REDIS_STATISTIC_KEY)
  if (removeKeys.length > 0) {
    await redisClient.del(...removeKeys)
  }
})
