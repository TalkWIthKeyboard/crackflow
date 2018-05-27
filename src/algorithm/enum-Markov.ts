import * as _ from 'lodash'

import { RangeResult } from './interface'
import { loadMultSortedsetToMemory } from '../utils'
import redisClient from '../modules/redis-client'
import { keys } from './default'


interface Enum {
  level: number
  length: number
}

interface SearchUnit {
  index: number
  pwd: string
}

export default class EnumMarkov {
  // 将模型载入内存
  private _model: any
  // enum算法的向量
  private _enumVector: number[][]
  // enum算法的枚举队列
  private _enumQueue: Enum[]
  // 总的生成的口令数组
  private _totalResultCount: number
  // markov的阶数
  private _level: number
  // 是否包含用户信息
  private _isIncludeUserInfo: boolean

  constructor(level: number, isIncludeUserInfo: boolean) {
    this._level = level
    this._enumVector = []
    this._enumQueue = []
    this._totalResultCount = 0
    this._isIncludeUserInfo = isIncludeUserInfo
  }

  public async loadMemory() {
    this._model = await loadMultSortedsetToMemory()
  }

  /**
   * 生成所有的候选向量
   * @param index     搜索下标
   * @param total     result数组相加的总和
   * @param length    搜索长度
   * @param level     搜索等级
   * @param result    装载搜索结果的容器
   */
  private _generateEnumPwdVector(
    index: number,
    total: number,
    length: number,
    level: number,
    result: number[],
  ) {
    if (index >= length) {
      if (total === level) {
        this._enumVector.push(result)
      }
      return
    }
    const start = index === 0 ? -5 : 0
    for (let num = 0; num >= Math.max(level - total, -9); num -= 1) {
      const newResult = _.cloneDeep(result)
      newResult.push(num)
      this._generateEnumPwdVector(index + 1, total + num, length, level, newResult)
    }
  }

  /**
   * 宽度优先搜索获得所有的生成口令
   * @param index 
   * @param beforeUnit 
   * @param pwd 
   * @param vector 
   */
  private _matchVector(vector: number[], level: number) {
    const searchQueue: SearchUnit[] = []
    // 装载初始片段
    for (const f of this._model.fragmentModel) {
      if (f.value < vector[0]) {
        break
      }
      if (f.value === vector[0]) {
        searchQueue.push({ index: this._level, pwd: f.key })
      }
    }
    // 开始宽度优先搜索
    let head = 0
    let foot = searchQueue.length
    while (head < foot) {
      const unit = searchQueue[head]
      if (unit.index === vector.length) {
        this._totalResultCount += 1
        redisClient.zadd(
          keys.REDIS_MARKOV_PWD_PROBABILITY_KEY(this._isIncludeUserInfo),
          level.toString(),
          unit.pwd.replace(/，/g, '')
        )
      }
      if (unit.index < vector.length) {
        const beforeUnit = unit.pwd.split('，').slice(-this._level).join('，')
        for (const t of this._model.transferModel[beforeUnit] || []) {
          // transfer里是按value大小排序的，单调的
          if (t.value < vector[unit.index + 1]) {
            break
          }
          if (t.value === vector[unit.index + 1]) {
            // console.log({ index: unit.index + 1, pwd: `${unit.pwd}，${t.key}` })
            searchQueue.push({ index: unit.index + 1, pwd: `${unit.pwd}，${t.key}` })
            foot += 1
          } 
        }
      }
      head += 1
    }
  }

  /**
   * 通过 OMEN 论文的算法来按照概率递减生成口令
   * @param length    口令长度
   * @param level     口令等级
   */
  private _enumPwd(length: number, level: number) {
    // 1. 生成所有的候选向量
    this._enumVector = []
    this._generateEnumPwdVector(0, 0, length, level, [])
    // 2. 通过候选向量来匹配生成口令
    for (const v of this._enumVector) {
      if (this._totalResultCount > parseInt(process.env.LIMIT!)) {
        break
      }
      this._matchVector(v, level)      
    }
  }

  /**
   * 生成口令
   */
  public generatePassword() {
    // 1. 进行第一次迭代
    // for (let length = 5; length < 10; length += 1) {
    //   if (this._totalResultCount > parseInt(process.env.LIMIT!)) {
    //     break
    //   }
    //   this._enumPwd(length, 0)
    //   this._enumQueue.push({ length, level: 0 })
    // }
    // let nowLevel = 0
    // // 2. 进行之后的改变level进行迭代
    // while (this._totalResultCount < parseInt(process.env.LIMIT!) && nowLevel > -20) {
    //   console.log(nowLevel, this._totalResultCount)      
    //   const unit = this._enumQueue.shift()!
    //   this._enumPwd(unit.length, unit.level - 1)
    //   nowLevel = unit.level - 1
    //   this._enumQueue.push({ length: unit.length, level: unit.level - 1})
    // }
    this._enumPwd(6, -12)
    console.log(this._totalResultCount)
  }
}