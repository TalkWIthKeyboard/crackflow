import * as _ from 'lodash'
import * as Promise from 'bluebird'

import redisClient from '../modules/redis-client'
import { PwdCount, UserInfo } from './interface'
import { parserZrevrange as zrevrange } from '../utils'

// sortedset  记录 word -> any 的转移概率
const REDIS_TRANSFER_PROBABILITY_KEY = `crackflow-${process.env.NODE_ENV}:markov:probability:{{word}}`
// sortedset  记录起始词概率
const REDIS_BEGIN_KEY = `crackflow-${process.env.NODE_ENV}:markov:begin`
// sortedset { pwd: probability }
const REDIS_PWD_PROBABILITY_KEY = `crackflow-${process.env.NODE_ENV}:markov:probability`

const defaultUnusefulFeature = [
  'mobileTotle',
  'mobileLastFive',
  'birthdaySix',
  'birthdayEight',
  'ctfIdLastFour',
  'ctfIdLastFive',
  'ctfIdLastSix',
  'mobileTotle',
]

const defaultUserInfoType = {
  mobileLastFour: '「MLF」',
  mobileLastSix: '「MLS」',
  birthdayFour: '「BF」',
  usernameNumberFragmet: '「UNF」',
  usernameStringFragmet: '「USF」',
  emailNumberFragmet: '「ENF」',
  emailStringFragmet: '「ESF」',
  namePinyin: '「NP」',
  namePinyinFirstLetter: '「NPFL」',
}

export default class Markov {
  // 阶数
  private _level: number
  // 密码,用户信息
  private _pwds: PwdCount[]
  // 用户信息特征
  private _userInfoType: Object
  // 填充值到用户信息特征的映射
  private _typeToUserInfokey: Object
  // 没用的用户信息特征
  private _unusefulFeature: string[]
  // 用于临时存储替换后的密码串
  private _temReplacePwdList: string[]
  // 用于临时存储起始密码的Set
  private _temBeginWordSet: {}
  // 是否启用拓展用户信息的模式
  private _isIncludeUserInfo: boolean
  // 用户临时存储填充以后的密码
  private _temFilledPwdList: string[]

  constructor(
    isIncludeUserInfo: boolean,
    pwds: PwdCount[],
    level: number = 1,
    userInfoType: Object = defaultUserInfoType,
    unusefulFeature: string[] = defaultUnusefulFeature,
  ) {
    this._isIncludeUserInfo = isIncludeUserInfo
    this._level = level
    this._pwds = pwds
    this._userInfoType = userInfoType
    this._unusefulFeature = unusefulFeature
    this._typeToUserInfokey = _.invert(userInfoType)
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
   * @param beforeUnit    前一个单元
   * @param thisUnit      后一个单元
   * @param num           单元中字符个数
   * @param count         密码出现次数
   */
  private _search(
    index: number,
    pwd: string,
    beforeUnit: string,
    thisUnit: string,
    num: number,
    count: number,
  ) {
    if (index >= pwd.length) {
      return
    }
    let char = pwd[index]
    let nextIndex = index  + 1
    if (char === '「') {
      while (pwd[nextIndex] !== '」') {
        char += pwd[nextIndex]
        nextIndex += 1
      }
      char += '」'
      nextIndex += 1
    }
    const newThisUnit = thisUnit !== '' ? `${thisUnit}，${char}` : char
    if (beforeUnit === '') {
      // 进行起始词的记录
      if (num + 1 === this._level + 1) {
        // 平衡繁生多个code的pwd和1个code的pwd的权重
        if (!this._temBeginWordSet[newThisUnit]) {
          redisClient.zincrby(
            REDIS_BEGIN_KEY,
            count,
            newThisUnit,
          )
          this._temBeginWordSet[newThisUnit] = true
        }
        this._search(
          nextIndex, 
          pwd, 
          newThisUnit.split('，').slice(1).join('，'), 
          '', 
          0, 
          count
        )
        return
      }
    } else {
      // 进行转移概率的记录
      if (num + 1 === this._level || newThisUnit.includes('~')) {
        redisClient.zincrby(
          REDIS_TRANSFER_PROBABILITY_KEY.replace(/{{word}}/, beforeUnit),
          count,
          newThisUnit
        )
        this._search(nextIndex, pwd, newThisUnit, '', 0, count)
        return
      }
    }
    this._search(nextIndex, pwd, beforeUnit, newThisUnit, num + 1, count)
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
    replacedPwd: string,
  ) {
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
              replacedPwd + this._userInfoType[userInfoKey],
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
                replacedPwd + this._userInfoType[userInfoKey],
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
   * 深度优先便利生成密码
   * @param beforeUnit     上一个单元
   * @param pwd            现构成的密码
   * @param probability    现构成密码的可能性
   */
  private async _passwordGenerate(
    beforeUnit: string,
    pwd: string,
    probability: number,
  ) {
    const alternative = beforeUnit === ''
      ? await zrevrange(REDIS_BEGIN_KEY, 0, -1, 'WITHSCORES')
      : await zrevrange(REDIS_TRANSFER_PROBABILITY_KEY.replace(/{{word}}/, beforeUnit), 0, -1, 'WITHSCORES')
    const total = _.reduce(
      _.map(alternative, a => a.value), 
      function (sum, n) {
        return sum + n
      },
      0
    )
    for (const unit of alternative) {
      const newPwd = pwd + unit.key
      const newProbability = probability * (unit.value / total)
      if (_.last(newPwd) === '~') {
        redisClient.zadd(REDIS_PWD_PROBABILITY_KEY, newProbability.toString(), newPwd.replace(/，/g, ''))
      } else {
        await this._passwordGenerate(
          beforeUnit === '' 
            ? unit.key.split('，').slice(1).join('，') 
            : unit.key, 
          newPwd, 
          newProbability
        )
      }
    }
  }

  /**
   * 深度优先填充用户信息
   * @param index 
   * @param pwd 
   * @param matchList 
   * @param userInfo 
   */
  private _searchFill(
    index: number,
    pwd: string,
    matchList: string[],
    userInfo: UserInfo,
  ) {
    if (index >= matchList.length) {
      this._temFilledPwdList.push(pwd)
      return
    }
    const matchString = matchList[index]
    const info = userInfo[this._typeToUserInfokey[matchString]]
    switch (typeof info) {
      case 'string':
        this._searchFill(
          index + 1,
          pwd.replace(new RegExp(matchString, 'g'), info),
          matchList,
          userInfo,
        )
        break
      case 'object':
        for (const unit of info) {
          this._searchFill(
            index + 1,
            pwd.replace(new RegExp(matchString, 'g'), unit),
            matchList,
            userInfo,
          )
        }
      default:
    }
  }
  
  /**
   * 训练转移矩阵和起始词概率
   * @param isEndSymbol           是否启用 end-symbol 标准化算法
   */
  public train(
    isEndSymbol: boolean,
  ) {
    for (const pwd of this._pwds) {
      if (isEndSymbol) {
        pwd.code += '~'
      }
      this._temReplacePwdList = []
      this._temBeginWordSet = {}
      if (this._isIncludeUserInfo) {
        this._replacePasswordCode(0, pwd.code, _.omit(pwd.userInfo!, ...this._unusefulFeature), '')
      }
      for (const code of this._temReplacePwdList) {
        this._search(0, code, '', '', 0, pwd.count)
      }
    }
  }

  /**
   * 密码生成
   */
  public async passwordGenerator() {
    await this._passwordGenerate('', '', 1)
  }

  /**
   * 填充用户信息到 Markov 生成的结构中
   */
  public async fillUserInfo(
    userInfo: UserInfo,
    top?: number,
  ) {
    const structures = await redisClient.zrevrange(REDIS_PWD_PROBABILITY_KEY, 0, -1)
    this._temFilledPwdList = []
    _.each(structures, structure => {
      if (structure.includes('「')) {
        const matchList = structure.match(/(「[^「」 ]*」)/g)
        this._searchFill(0, structure, matchList, userInfo)
      } else {
        this._temFilledPwdList.push(structure)
      }
    })
    return top 
      ? this._temFilledPwdList.slice(0, top) 
      : this._temFilledPwdList
  }
}
