import * as _ from 'lodash'

import Basic from './basic'
import EnumMarkov from './enum-Markov'
import redisClient from '../modules/redis-client'
import { PwdCount, UserInfo, RangeResult } from './interface'
import { parserZrevrange as zrevrange } from '../utils'
import { keys } from './default'

export default class Markov extends Basic {
  // 阶数
  private readonly _level: number
  // 用于临时存储替换后的密码串
  private _temReplacePwdList: string[]
  // 用于临时存储起始密码的Set
  private _temBeginWordSet: {}
  // 是否启用 end-symbol 标准化算法
  private readonly _isEndSymbol: boolean
  // 是否启用 enum 算法来生成口令
  private readonly _isEnum: boolean
  // 累加该变量用来限制生成的半成熟口令的个数
  private _numOfRowPwds: number
  // enum算法的向量
  private _enumVector: number[][]
  // 将模型全部载入内存
  private _model: any

  constructor(
    pwds: PwdCount[],
    isEnum: boolean = true,
    isEndSymbol: boolean = false,
    level: number = 3,
    isIncludeUserInfo: boolean = true,
    userInfoUnusefulFeature?: string[],
    basicType?: Object
  ) {
    super('Markov', isIncludeUserInfo, pwds, userInfoUnusefulFeature, basicType)
    this._level = level
    this._isEnum = false
    // if (this._isEnum) {
    //   this._isEndSymbol = false
    // } else {
    //   this._isEndSymbol = isEndSymbol      
    // }
    this._isEndSymbol = isEndSymbol
  }

  get level(): number {
    return this._level
  }

  /**
   * pwd片段是否于userInfo匹配
   * @param pwd
   * @param index
   * @param userInfo
   */
  private _isMatchUserInfo(
    pwd: string,
    index: number,
    userInfo: string
  ) {
    const userInfoLength = userInfo.length
    if (index + userInfoLength > pwd.length) {
      return false
    }
    const pwdFragmet = pwd.slice(index, index + userInfoLength)
    return pwdFragmet === userInfo
  }

  /**
   * 对整个密码进行搜索
   * @param index         搜索下标
   * @param pwd           密码
   * @param thisUnit      这一个单元（用来处理BeginUnit）
   * @param num           搜索的字符个数
   * @param count         密码出现次数
   */
  private _search(
    index: number,
    pwd: string,
    thisUnit: string,
    num: number,
    count: number
  ) {
    if (index >= pwd.length) {
      if (num < this._level) {
        redisClient.zincrby(
          keys.REDIS_MARKOV_FRAGMENT_KEY(this._isIncludeUserInfo),
          count,
          thisUnit.replace(/，¥/g, '')
        )
      }
      return
    }
    let char = pwd[index]
    let nextIndex = index + 1
    if (char === '「') {
      while (pwd[nextIndex] !== '」') {
        char += pwd[nextIndex]
        nextIndex += 1
      }
      char += '」'
      nextIndex += 1
    }
    if (num + 1 >= this._level) {
      const newThisUnit = 
        num + 1 === this._level
          ? `${thisUnit}，${char}`      
          : `${thisUnit.split('，').slice(1).join('，')}，${char}`
      if (num + 1 === this._level) {
        // 对碎片进行记录
        redisClient.zincrby(
          keys.REDIS_MARKOV_FRAGMENT_KEY(this._isIncludeUserInfo),
          count,
          newThisUnit.replace(/，¥/g, '')
        )
      }
      if (num + 1 > this._level) {
        // 对转移进行记录
        redisClient.zincrby(
          keys.REDIS_MARKOV_TRANSFER_KEY(this._isIncludeUserInfo).replace(/{{word}}/, thisUnit),
          count,
          char
        )
      }
      this._search(nextIndex, pwd, newThisUnit, num + 1, count)
    } else {
      const newThisUnit = thisUnit !== '' ? `${thisUnit}，${char}` : char      
      this._search(nextIndex, pwd, newThisUnit, num + 1, count)
    }
  }

  /**
   * 将密码中的个人信息替换成合法的元素
   * @param index
   * @param pwd
   * @param userInfo
   * @param replacedPwd
   */
  private _replacePasswordCode(
    index: number,
    pwd: string,
    userInfo: UserInfo,
    replacedPwd: string
  ) {
    if (this._temReplacePwdList.length > 100) {
      return
    }
    if (index >= pwd.length) {
      this._temReplacePwdList.push(replacedPwd)
      return
    }
    for (const userInfoKey of _.keys(userInfo)) {
      const userInfoValue = userInfo[userInfoKey]
      switch (typeof userInfoValue) {
        case 'string':
          if (this._isMatchUserInfo(pwd, index, userInfoValue)) {
            this._replacePasswordCode(
              index + userInfoValue.length,
              pwd,
              userInfo,
              replacedPwd + this._userInfoType[userInfoKey]
            )
          }
          break
        case 'object':
          for (const userInfoUnit of userInfoValue) {
            if (this._isMatchUserInfo(pwd, index, userInfoUnit)) {
              this._replacePasswordCode(
                index + userInfoUnit.length,
                pwd,
                userInfo,
                replacedPwd + this._userInfoType[userInfoKey]
              )
            }
          }
          break
        default:
      }
    }
    this._replacePasswordCode(index + 1, pwd, userInfo, replacedPwd + pwd[index])
  }

  /**
   * 深度优先遍历生成密码
   * @param beforeUnit     上一个单元
   * @param pwd            现构成的密码
   * @param probability    现构成密码的可能性
   */
  private async _passwordGenerate(
    beforeUnit: string,
    pwd: string,
    probability: number,
    num: number
  ) {
    // 限制生成的半成熟口令的数量
    if (this._numOfRowPwds > parseInt(process.env.LIMIT!)) {
      return
    }
    if (Math.log(probability) < (this._isIncludeUserInfo ? -14 : -16)) {
      return
    }
    if (num > 10) {
      return
    }
    const alternative = beforeUnit === ''
      ? await zrevrange(keys.REDIS_MARKOV_FRAGMENT_KEY(this._isIncludeUserInfo), 0, -1, 'WITHSCORES')
      : await zrevrange(keys.REDIS_MARKOV_TRANSFER_KEY(this._isIncludeUserInfo).replace(/{{word}}/, beforeUnit), 0, -1, 'WITHSCORES')
    const total = _.reduce(
      _.map(alternative, a => a.value),
      function (sum, n) {
        return sum + n
      },
      0
    )
    for (const unit of alternative) {
      // 限制生成的半成熟口令的数量
      if (this._numOfRowPwds > parseInt(process.env.LIMIT!)) {
        break
      }
      const newPwd = pwd + unit.key
      const newProbability = probability * (unit.value / total)
      // 带有用户信息的半成熟口令可以不限制字符长度
      if (_.last(newPwd) === '¥' && newPwd.replace(/，/g, '').length > 5 || newPwd.includes('「')) {
        this._numOfRowPwds += 1
        redisClient.zadd(
          keys.REDIS_MARKOV_PWD_PROBABILITY_KEY(this._isIncludeUserInfo),
          newProbability.toString(),
          newPwd.replace(/，/g, '')
        )
      } else {
        await this._passwordGenerate(
          beforeUnit === ''
            ? unit.key
            : beforeUnit.split('，').slice(1).join('，')
            + (beforeUnit.split('，').length > 1 ? `，${unit.key}` : unit.key),
          newPwd,
          newProbability,
          num + 1
        )
      }
    }
  }

  /**
   * 训练转移矩阵和起始词概率
   * @param isEndSymbol           是否启用 end-symbol 标准化算法
   */
  public train() {
    for (const pwd of this._pwds) {
      if (this._isEndSymbol) {
        pwd.code += '¥'
      }
      this._temReplacePwdList = []
      this._temBeginWordSet = {}
      if (this._isIncludeUserInfo) {
        this._replacePasswordCode(0, pwd.code, _.omit(pwd.userInfo!, ...this._userInfoUnusefulFeature), '')
      } else {
        this._temReplacePwdList = [pwd.code]
      }
      for (const code of this._temReplacePwdList) {
        this._search(0, code, '', 0, pwd.count)
      }
    }
  }

  /**
   * 密码生成
   */
  public async passwordGenerate() {
    if (this._isEnum) {
      const enumMarkov = new EnumMarkov(this._level, this._isIncludeUserInfo)
      await enumMarkov.loadMemory()
      enumMarkov.generatePassword()
    } else {
      this._numOfRowPwds = 0
      await this._passwordGenerate('', '', 1, 0)
    }
  }
}
