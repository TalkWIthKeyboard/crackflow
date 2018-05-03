import * as _ from 'lodash'
import * as DEBUG from 'debug'
import * as config from 'config'
import * as Promise from 'bluebird'

import redisClient from '../modules/redis-client'
import { parserZrevrange as zrevrange } from '../utils'

const debug = DEBUG('crackflow:algorithm:basic-pcfg')
// sortedset { structure: count }
const REDIS_PCFG_COUNT_KEY = `crackflow-${process.env.NODE_ENV}:basic:pcfg:count`
// sortedset { fragmet: count }, {{type}} -> A/B/C, {{number}} -> 碎片的长度
const REDIS_FRAGMET_COUNT_KEY = `crackflow-${process.env.NODE_ENV}:basic:pcfg:{{type}}:{{number}}`
// sortedset { pwd: probability }
const REDIS_PWD_PROBABILITY_KEY = `crackflow-${process.env.NODE_ENV}:basic:pcfg:probability`

const NUMBER_TYPE = 'A'
const CHAR_TYPE = 'B'
const MARK_TYPE = 'C'

/**
 * 判断这个字符的类型
 * @param {string} char 
 * @returns {string} 
 */
function _typeof(char: string): string {
  if (_.get(char.match(/[a-zA-Z]*/), 0, '') !== '') {
    return CHAR_TYPE
  }
  if (_.get(char.match(/[0-9]*/), 0, '') !== '') {
    return NUMBER_TYPE
  }
  return MARK_TYPE
}

/**
 * 多进程的 basic-PCFG 算法的 Worker
 * A -> number, B -> char, C -> mark
 * 1. 因为中间过程只是简单的累加进行统计，所以全部做异步
 * 2. 这里只进行统计，不进行排序
 * @param pwds 多个密码
 */
export function basicPcfgWorker(pwds: string[]) {
  // 1. 统计密码结构
  _.each(pwds, pwd => {
    let structure = ''
    let pre = 0
    let fragmet = pwd[0]
    let fragmentList: string[] = []
    for (let index = 1; index <= pwd.length; index += 1) {
      // 边界+1，方便统一进行处理
      if (index === pwd.length || _typeof(pwd[index]) !== _typeof(pwd[index - 1])) {
        // 持久化碎片的统计结果
        redisClient.zincrby(
            REDIS_FRAGMET_COUNT_KEY
                .replace(/{{type}}/, _typeof(pwd[index - 1]))
                .replace(/{{number}}/, (index - pre).toString()),
            1,
            fragmet,            
        )
        structure += `${_typeof(pwd[index-1])}/${index - pre},`
        fragmentList.push(fragmet)
        fragmet = ''
        pre = index
      } else {
        fragmet += pwd[index]
      }
    }
    // 持久化结构结果
    redisClient.zincrby(REDIS_PCFG_COUNT_KEY, 1, structure)
  })
}

/**
 * 拼凑密码并计算出现的可能性
 * @param index         第几个元素
 * @param probability   可能性 (结构的可能性 * 每个元素的可能性)
 * @param pwd           现在拼凑出来的密码
 * @param count         密码总个数
 * @param fragmetList 
 */
function _makeUpPassword(
  index: number, 
  probability: number, 
  pwd: string,
  count: number,
  fragmetList
) {
  // 边界条件
  if (index >= fragmetList.length) {
    redisClient.zadd(REDIS_PWD_PROBABILITY_KEY, probability.toString(), pwd)
    return
  }

  let temProbability = probability
  let temPwd = pwd
  for (let i = 0; i < fragmetList[index].length; i += 1) {
    temPwd += fragmetList[index][i].key
    temProbability *= fragmetList[index][i].value / count
    _makeUpPassword(index + 1, temProbability, temPwd, count, fragmetList)
    temPwd = pwd
    temProbability = probability
  }
}

/**
 * 生成密码并进行计数
 * @param count 密码总数
 */
export async function passwordCount(count: number) {
  const structures = await zrevrange(REDIS_PCFG_COUNT_KEY, 0, -1, 'WITHSCORES')
  for (let structure of structures) {
    const [...units] = structure.key.split(',')
    const typeNumberList = _.compact(_.map(units, u => {
      if (u === '') {
        return null
      }
      const [type, number] = u.split('/')
      return { type, number }
    }))
    const fragmetList = await Promise.map(typeNumberList, u => {
      return zrevrange(
        REDIS_FRAGMET_COUNT_KEY
          .replace(/{{type}}/, u.type)
          .replace(/{{number}}/, u.number),
        0, -1, 'WITHSCORES'
      )
    })
    _makeUpPassword(0, structure.value / count, '', count, fragmetList)
  }
}
