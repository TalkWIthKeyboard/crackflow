import * as _ from 'lodash'
import * as bd from 'bluebird'

import redisClient from './modules/redis-client'

interface RangeResult {
  key: string
  value: number
}

/**
 * 将 zrevrange 的结果序列化为 [{key, value}]
 * @param key
 * @param start
 * @param stop
 * @param withScore
 */
export async function parserZrevrange(
  key: string,
  start: number,
  stop: number,
  withScore?: 'WITHSCORES'
): Promise<RangeResult[]> {
  const list = await redisClient.zrevrange(key, start, stop, withScore)
  const result: RangeResult[] = []
  for (let index = 0; index < list.length; index += 2) {
    result.push({ key: list[index], value: parseFloat(list[index + 1]) })
  }
  return result
}

/**
 * 对三阶生成所有的组合后进行补齐
 * @param charList 
 */
function _generateAllKeys(charList: string[], model) {
  const _model = _.cloneDeep(model)
  const fragmentMap = {}
  _.each(charList, i => {
    _.each(charList, j => {
      _.each(charList, k => {
        fragmentMap[`${i}，${j}，${k}`] = true
      })
    })
  })
  _.each(model, (value, key) => {
    fragmentMap[key] = false
  })
  _.each(fragmentMap, (value, key) => {
    if (value) {
      const valueList: RangeResult[] = []
      _model[key] = _.map(charList, i => ({ key: i, value: -5 }))
    }
  })
  console.log(_model)
  return _model
}

/**
 * 不存在的key用-5来补
 * @param model 
 */
function _fillAllChar(model: RangeResult[]): RangeResult[]  {
  const _model = _.cloneDeep(model)
  const charMap = {}
  _.each(charList, c => {
    charMap[c] = true
  })
  _.each(model, m => {
    charMap[m.key] = false
  })
  _.each(charMap, (value, key) => {
    if (value) {
      _model.push({ key, value: -5 })
    }
  })
  return _model
}

/**
 * 通过count计算 level (配合 enumPwds 方法使用)
 * @param model 
 */
function _calculateLevel(model: RangeResult[]): RangeResult[] {
  const _model = _.cloneDeep(model)
  const total = _.reduce(model, (sum, fragment) => {
    return sum + fragment.value
  }, 0)
  _.each(_model, m => {
    m.value = Math.round(Math.log(m.value / total))
  })
  return _model
}

const charList = [
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 
  'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
  '_', ',', '!', '.'
]

/**
 * 将redis的一些key全部存入内存，并且会将 count 转化成 level
 * [IMPORTANT] 这里仅仅对多个sortedset的情况进行处理（配合 enumPwds 方法使用）
 */
export async function loadMultSortedsetToMemory() {
  const fragmentModel = _calculateLevel(await parserZrevrange(`crackflow-${process.env.NODE_ENV}:markov:fragment`, 0, -1, 'WITHSCORES'))
  const transferKeys = await redisClient.keys(`crackflow-${process.env.NODE_ENV}:markov:probability:*`)
  const model = _.flatten(await bd.mapSeries(_.chunk(transferKeys, 100), keyList => {
    return bd.map(keyList, key => {
      return parserZrevrange(key, 0, -1, 'WITHSCORES').then(data => {
        return _fillAllChar(_calculateLevel(data))
      })
    })
  }))
  const transferModel = {}
  for (let index = 0; index < model.length; index += 1) {
    transferModel[_.last(transferKeys[index].split(':'))!] = model[index]
  }
  return {
    transferModel: _generateAllKeys(charList, transferKeys),
    fragmentModel,
  }
}

/**
 * 访问原始数据的query语句
 */
export const queryCase = {
  count: 'SELECT COUNT(*) FROM {table}',
  itrAll: 'SELECT {query_schema} FROM {table} ' +
    'WHERE id >= (SELECT id FROM {table} ORDER BY id LIMIT {start}, 1) ' +
    'ORDER BY id LIMIT 10000',
}
