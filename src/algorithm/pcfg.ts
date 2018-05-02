import * as _ from 'lodash'
import * as DEBUG from 'debug'
import * as config from 'config'

import redisClient from '../modules/redis-client'

const debug = DEBUG('crackflow:algorithm:basic-pcfg')
// hm { structure: count }
const REDIS_PCFK_COUNT_KEY = `crackflow-${process.env.NODE_ENV}:basic:pcfg:count`
// hm { fragmet: count }, {{type}} -> A/B/C, {{number}} -> 碎片的长度
const REDIS_FRAGMET_COUNT_KEY = `crackflow-${process.env.NODE_ENV}:basic:pcfg:{{type}}:{{number}}`

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
export default function basicPcfgWorker(pwds: string[]) {
  _.each(pwds, pwd => {
    let structure = ''
    let pre = 0
    let fragmet = pwd[0]
    let fragmentList: string[] = []
    for (let index = 1; index <= pwd.length; index += 1) {
      // 边界+1，方便统一进行处理
      if (index === pwd.length || _typeof(pwd[index]) !== _typeof(pwd[index - 1])) {
        // 持久化碎片的统计结果
        redisClient.hincrby(
            REDIS_FRAGMET_COUNT_KEY
                .replace(/{{type}}/, _typeof(pwd[index - 1]))
                .replace(/{{number}}/, (index - pre).toString()),
            fragmet,
            1
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
    redisClient.hincrby(REDIS_PCFK_COUNT_KEY, structure, 1)
  })
}
