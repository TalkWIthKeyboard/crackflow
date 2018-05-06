import test from 'ava'

import redisClient from '../src/modules/redis-client'
import { basicPcfgWorker, passwordCount } from '../src/algorithm/pcfg'

const REDIS_PWD_COUNT_KEY = 'crackflow-test:basic:pcfg:probability'
const REDIS_PCFG_COUNT_KEY = 'crackflow-test:basic:pcfg:count'
const REDIS_FRAGMET_COUNT_KEY = 'crackflow-test:basic:pcfg:*'

const mockPwds = [
 { code: '863888yf', count: 1},
 { code: 'prescott', count: 1},
 { code: '19861120', count: 1},
 { code: '336947', count: 1},
 { code: 'xiaoxiao', count: 1},
 { code: '569022', count: 1},
 { code: '7169061', count: 1},
 { code: '811091', count: 1},
 { code: '19841028', count: 1},
 { code: '811091', count: 1},
 { code: 'kid1412', count: 1},
 { code: 'mingming', count: 1},
 { code: '6062497900', count: 1},
 { code: '191230', count: 1},
 { code: 'chen1985', count: 1},
 { code: 'laiaiwoba', count: 1},
 { code: 'CPX13416303850.', count: 1},
 { code: 'DDXW1234', count: 1},
 { code: '13875678677', count: 1},
 { code: 'asdfghjkl', count: 1},
 { code: '67323370', count: 1},
 { code: 'DDXzhangshaohan5', count: 1},
 { code: 'murongg1', count: 1},
 { code: '1234567', count: 1},
 { code: 'qwerty', count: 1},
 { code: 'dkt001506xxmm', count: 1},
 { code: '123456', count: 1},
 { code: '00926481', count: 1},
 { code: '761013001', count: 1},
 { code: '19850510', count: 1},
 { code: 'yy5201314', count: 1},
 { code: 'intel@123', count: 1},
 { code: '888888', count: 1},
 { code: '821128', count: 1},
 { code: 'format', count: 1},
 { code: '870814', count: 1},
 { code: 'dear077220', count: 1},
 { code: '1314520', count: 1},
 { code: '1233212100', count: 1},
 { code: 'DTK4S9bskh', count: 1},
 { code: 'beckham', count: 1},
 { code: '6687942chenyu', count: 1},
 { code: '117913', count: 1},
 { code: 'dududongdong', count: 1},
 { code: '877828', count: 1},
 { code: '622622', count: 1},
 { code: '19840417', count: 1},
 { code: '117913', count: 1},
 { code: '999999999k', count: 1},
 { code: 'USA911007', count: 1},
 { code: 'ddxx918216', count: 1},
 { code: 'zeldaliu', count: 1},
 { code: 'ddddwawj', count: 1},
 { code: 'aifengfeng1314', count: 1},
 { code: 'ddddwawj', count: 1},
 { code: 'ddddwawj', count: 1},
 { code: 'jiangjingping', count: 1},
 { code: 'wkgMkjH623', count: 1},
 { code: '8451671234567', count: 1},
 { code: 'TGzvF54idb', count: 1},
 { code: '8682326', count: 1},
 { code: '8682326', count: 1},
 { code: '701221', count: 1},
 { code: '124578', count: 1},
 { code: '19910915', count: 1},
 { code: 'luoyun', count: 1},
 { code: 'xie123456', count: 1},
 { code: '1181314', count: 1},
 { code: 'hjjpyg520', count: 1},
 { code: '1987420', count: 1},
 { code: 'tianya', count: 1},
 { code: 'tianya', count: 1},
 { code: 'x29184', count: 1},
 { code: 'tianya', count: 1},
 { code: 'yangyang', count: 1},
 { code: '631017', count: 1},
 { code: 'tianya', count: 1},
 { code: 'tianya', count: 1},
 { code: 'tianya', count: 1},
 { code: 'yy5201314', count: 1},
 { code: 'woaini', count: 1},
 { code: 'asdfasdf', count: 1},
 { code: '63629638', count: 1},
 { code: 'asdfasdf', count: 1},
 { code: '63629638', count: 1},
 { code: '19860203', count: 1},
 { code: 'yuanchunhui', count: 1},
 { code: '20050316', count: 1},
 { code: '19860203', count: 1},
 { code: 'qian19870223', count: 1},
 { code: '5855491874', count: 1},
 { code: '0401116', count: 1},
 { code: '103103', count: 1},
 { code: '870506', count: 1},
 { code: '400050', count: 1},
 { code: '71070537', count: 1},
 { code: 'deepclear', count: 1},
 { code: '400050', count: 1},
 { code: '3guoxuan', count: 1},
 { code: '83585889', count: 1},
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
