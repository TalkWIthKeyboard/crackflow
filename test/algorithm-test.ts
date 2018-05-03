import test from 'ava'

import redisClient from '../src/modules/redis-client'
import { basicPcfgWorker, passwordCount } from '../src/algorithm/pcfg'

const REDIS_PWD_COUNT_KEY = 'crackflow-test:basic:pcfg:probability'
const REDIS_PCFG_COUNT_KEY = 'crackflow-test:basic:pcfg:count'
const REDIS_FRAGMET_COUNT_KEY = 'crackflow-test:basic:pcfg:*'

const mockPwds = [
  '863888yf',
  'prescott',
  '19861120',
  '336947',
  'xiaoxiao',
  '569022',
  '7169061',
  '811091',
  '19841028',
  '811091',
  'kid1412',
  'mingming',
  '6062497900',
  '191230',
  'chen1985',
  'laiaiwoba',
  'CPX13416303850.',
  'DDXW1234',
  '13875678677',
  'asdfghjkl',
  '67323370',
  'DDXzhangshaohan5',
  'murongg1',
  '1234567',
  'qwerty',
  'dkt001506xxmm',
  '123456',
  '00926481',
  '761013001',
  '19850510',
  'yy5201314',
  'intel@123',
  '888888',
  '821128',
  'format',
  '870814',
  'dear077220',
  '1314520',
  '1233212100',
  'DTK4S9bskh',
  'beckham',
  '6687942chenyu',
  '117913',
  'dududongdong',
  '877828',
  '622622',
  '19840417',
  '117913',
  '999999999k',
  'USA911007',
  'ddxx918216',
  'zeldaliu',
  'ddddwawj',
  'aifengfeng1314',
  'ddddwawj',
  'ddddwawj',
  'jiangjingping',
  'wkgMkjH623',
  '8451671234567',
  'TGzvF54idb',
  '8682326',
  '8682326',
  '701221',
  '124578',
  '19910915',
  'luoyun',
  'xie123456',
  '1181314',
  'hjjpyg520',
  '1987420',
  'tianya',
  'tianya',
  'x29184',
  'tianya',
  'yangyang',
  '631017',
  'tianya',
  'tianya',
  'tianya',
  'yy5201314',
  'woaini',
  'asdfasdf',
  '63629638',
  'asdfasdf',
  '63629638',
  '19860203',
  'yuanchunhui',
  '20050316',
  '19860203',
  'qian19870223',
  '5855491874',
  '0401116',
  '103103',
  '870506',
  '400050',
  '71070537',
  'deepclear',
  '400050',
  '3guoxuan',
  '83585889',
]

// 清空所有的 test 缓存
test.beforeEach(async () => {
  const removeKeys = await redisClient.keys(REDIS_FRAGMET_COUNT_KEY)
  if (removeKeys.length > 0) {
    await redisClient.del(...removeKeys)
  }
})

test('Basic pcfg statistic', async t => {
  basicPcfgWorker(mockPwds)
  const count = (await redisClient.zscore(REDIS_PCFG_COUNT_KEY, 'A/6,')).toString()
  t.is(count, '20')
})

test('Basic pcfg generate', async t => {
  basicPcfgWorker(mockPwds)
  await passwordCount(mockPwds.length)
  const topOne = await redisClient.zrevrange(REDIS_PWD_COUNT_KEY, 0, 1, 'WITHSCORES')
  const result = ['tianya', '0.0060000000000000001', '811091', '0.0040000000000000001']
  // tslint:disable-next-line
  for (const index in result) {
    t.is(topOne[index], result[index])
  }
})

// 清空所有的 test 缓存
test.afterEach(async () => {
  const removeKeys = await redisClient.keys(REDIS_FRAGMET_COUNT_KEY)
  await redisClient.del(...removeKeys)
})
