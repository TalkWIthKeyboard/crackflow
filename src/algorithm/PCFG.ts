import * as _ from 'lodash'
import * as Promise from 'bluebird'

import Basic from './basic'
import redisClient from '../modules/redis-client'
import { parserZrevrange as zrevrange } from '../utils'
import { PwdCount, UserInfo, RangeResult } from './interface'
import { defaultUserInfoMarkovType, keys } from './default'

export default class PCFG extends Basic {
  private readonly _userInfoMarkovType: Object
  // 每个口令能变换出来的口令上限是1000 这个值用来累加做限制
  private _numOfOnePwds: number
  // 这个值用来累加做限制生成的半成熟口令的个数
  private _numOfRowPwds: number

  constructor(
    pwds: PwdCount[],
    isIncludeUserInfo: boolean,
    userInfoMarkovType: Object = defaultUserInfoMarkovType,
    userInfoUnusefulFeature?: string[],
    basicType?: Object
  ) {
    super('PCFG', isIncludeUserInfo, pwds, userInfoUnusefulFeature, basicType)
    this._userInfoMarkovType = userInfoMarkovType
  }

  /**
   * 对字符进行分类
   * @param char 字符
   */
  private _charTypeof(char: string): string {
    if (_.get(char.match(/[a-z]*/), 0, '') !== '') {
      // tslint:disable-next-line
      return this._basicType['LOWER_CHAR_TYPE']
    }
    if (_.get(char.match(/[A-Z]*/), 0, '') !== '') {
      // tslint:disable-next-line
      return this._basicType['UPPER_CHAR_TYPE']
    }
    if (_.get(char.match(/[0-9]*/), 0, '') !== '') {
      // tslint:disable-next-line
      return this._basicType['NUMBER_TYPE']
    }
    // tslint:disable-next-line
    return this._basicType['MARK_TYPE']
  }

  /**
   * 向后嗅探到第一个类型不为type的位置
   * @param pwd
   * @param index
   * @param type
   */
  private _basicTypeTowardEnd(
    pwd: string,
    index: number,
    type: string
  ): number {
    for (let i = index; i < pwd.length; i += 1) {
      if (this._charTypeof(pwd[i]) !== type) {
        return i
      }
    }
    return pwd.length
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
   * 向后嗅探（子类完成）
   * @param pwd         密码
   * @param index       现在搜索的位置下标
   * @param type        上一个字符所属类型
   * @param fragment    现在的碎片结果
   * @param result      最终PCFG结果
   * @param count       总量
   * @param userInfo    用户信息
   */
  private _search(
    pwd: string,
    index: number,
    result: string,
    count: number,
    userInfo?: UserInfo
  ) {
    if (this._numOfOnePwds > 1000) {
      return
    }
    if (index >= pwd.length) {
      this._saveStructure(result, count)
      return
    }
    const charType = this._charTypeof(pwd[index])
    // 基础PCFG
    const nextIndex = this._basicTypeTowardEnd(pwd, index, charType)
    this._saveFragmet(pwd.slice(index, nextIndex), charType, nextIndex - index, count)
    this._search(
      pwd,
      nextIndex,
      index === 0 ? `${charType}/${nextIndex - index}` : `${result},${charType}/${nextIndex - index}`,
      count,
      userInfo
    )
    // 拓展PCFG
    if (userInfo) {
      _.each(_.keys(this._userInfoType), userInfoKey => {
        const userInfoValue = userInfo[userInfoKey]
        switch (typeof userInfoValue) {
          case 'string':
            if (this._isMatchUserInfo(pwd, index, userInfoValue)) {
              this._search(
                pwd,
                index + userInfoValue.length,
                index === 0 ? this._userInfoType[userInfoKey] : `${result},${this._userInfoType[userInfoKey]}`,
                count,
                userInfo
              )
            }
            break
          case 'object':
            for (const userInfoUnit of userInfoValue) {
              if (this._isMatchUserInfo(pwd, index, userInfoUnit)) {
                this._search(
                  pwd,
                  index + userInfoUnit.length,
                  index === 0 ? this._userInfoType[userInfoKey] : `${result},${this._userInfoType[userInfoKey]}`,
                  count,
                  userInfo
                )
              }
            }
            break
          default:
        }
      })
    }
  }

  /**
   * 保存中间碎片结果
   * @param fragmet     碎片中间结果
   * @param type        类型
   * @param length      长度
   * @param count       总个数
   */
  private _saveFragmet(fragmet: string, type: string, length: number, count: number) {
    redisClient.zincrby(
      keys.REDIS_PCFG_FRAGMET_COUNT_KEY(this._isIncludeUserInfo)
        .replace(/{{type}}/, type)
        .replace(/{{number}}/, length.toString()),
      count,
      fragmet
    )
  }

  /**
   * 保存最终结构
   * @param structure   最终结构
   * @param count       总个数
   */
  private _saveStructure(structure: string, count: number) {
    this._numOfOnePwds += 1
    redisClient.zincrby(
      keys.REDIS_PCFG_COUNT_KEY(this._isIncludeUserInfo),
      count,
      structure
    )
  }

  /**
   * 拼凑密码并计算出现的可能性
   * @param index           PCFG结构的遍历下标
   * @param basicIndex      fragmetList的遍历下表
   * @param probability     可能性
   * @param pwd             拼凑的密码
   * @param typeNumberList  PCFG结构数组
   * @param fragmetList     PCFG结构每个单元的候选列表
   * @param userInfo        用户信息
   */
  private _makeUpPassword(
    index: number,
    basicIndex: number,
    probability: number,
    pwd: string,
    typeNumberList,
    fragmetList,
    userInfo?: UserInfo
  ) {
    // 限制半成熟口令生成的个数
    if (this._numOfRowPwds > parseInt(process.env.LIMIT!)) {
      return
    }
    // 边界条件
    if (index >= typeNumberList.length) {
      this._numOfRowPwds += 1
      redisClient.zadd(
        keys.REDIS_PCFG_PWD_PROBABILITY_KEY(this._isIncludeUserInfo),
        probability.toString(),
        pwd
      )
      return
    }
    const typeNumber = typeNumberList[index]
    // tslint:disable-next-line
    const values: string[] = _.values(this._userInfoType) as any[]
    // 用户信息特征
    if (values.includes(typeNumber.type)) {
      const userInfoValue = this._userInfoMarkovType[this._typeToUserInfo[typeNumber.type]]
      if (!userInfoValue) {
        return
      }
      this._makeUpPassword(
        index + 1,
        basicIndex,
        probability,
        pwd + userInfoValue,
        typeNumberList,
        fragmetList,
        userInfo
      )
    // 普通特征
    } else {
      const fragmetTotal = _.reduce(
        _.map(fragmetList[basicIndex], f => f.value),
        function (sum, n) {
          return sum + n
        },
        0
      )
      for (const fragmet of fragmetList[basicIndex]) {
        this._makeUpPassword(
          index + 1,
          basicIndex + 1,
          probability * (fragmet.value / fragmetTotal),
          pwd + fragmet.key,
          typeNumberList,
          fragmetList,
          userInfo
        )
      }
    }
  }

  /**
   * 基础密码生成模式中是否包含了用户信息类型
   * @param units              PCFG各单元
   */
  private _isBasicGeneratorIncludeUserInfoType(
    units: string[]
  ) {
    if (this._isIncludeUserInfo) {
      return false
    }
    // tslint:disable-next-line
    const values: string[] = _.values(this._userInfoType) as any[]
    for (const unit of units) {
      if (values.includes(unit)) {
        return true
      }
    }
    return false
  }

  /**
   * 生成密码并进行计数
   * @param count               密码总数
   * @param basicGenerator      是否只对普通模式进行生成
   * @param userInfo            用户信息
   */
  private async _passwordGenerate(
    count: number,
    structures: RangeResult[],
    userInfo?: UserInfo
  ) {
    for (const structure of structures) {
      // 限制生成的半成熟口令的个数
      if (this._numOfRowPwds > parseInt(process.env.LIMIT!)) {
        break
      }
      const [...units] = structure.key.split(',')
      if (this._isBasicGeneratorIncludeUserInfoType(units)) {
        continue
      }
      const typeNumberList = _.map(units, u => {
        const [type, num] = u.split('/')
        return { type, num }
      })
      const hasFragmetType = _.filter(typeNumberList, typeNumber => {
        // tslint:disable-next-line
        return typeNumber.num !== undefined && typeNumber.num !== null
      })
      const fragmetList = await Promise.map(hasFragmetType, u => {
        return zrevrange(
          keys.REDIS_PCFG_FRAGMET_COUNT_KEY(this._isIncludeUserInfo)
            .replace(/{{type}}/, u.type)
            .replace(/{{number}}/, u.num),
          // todo 修改了枚举的个数
          0, 20, 'WITHSCORES'
        )
      })
      this._makeUpPassword(0, 0, structure.value / count, '', typeNumberList, fragmetList, userInfo)
    }
  }

  /**
   * 计算密码结构总数
   * @param basicGenerator
   */
  private _calculatePasswordCount(
    structures: RangeResult[]
  ): number {
    let sum = 0
    for (const structure of structures) {
      const [...units] = structure.key.split(',')
      if (this._isBasicGeneratorIncludeUserInfoType(units)) {
        continue
      }
      sum += structure.value
    }
    return sum
  }

  public async passwordGenerate() {
    const structures = await zrevrange(keys.REDIS_PCFG_COUNT_KEY(this._isIncludeUserInfo), 0, -1, 'WITHSCORES')
    this._numOfRowPwds = 0
    await this._passwordGenerate(this._calculatePasswordCount(structures), structures)
  }

  /**
   * 多进程的 PCFG 算法的 Worker
   * 1. 因为中间过程只是简单的累加进行统计，所以全部做异步
   * 2. 这里只进行统计，不进行排序
   */
  public train() {
    _.each(this._pwds, pwd => {
      this._numOfOnePwds = 0
      this._search(
        pwd.code,
        0,
        '',
        pwd.count,
        this._isIncludeUserInfo
          ? _.omit(pwd.userInfo, ...this._userInfoUnusefulFeature)
          : undefined
      )
    })
  }
}
