import * as _ from 'lodash'
import * as Promise from 'bluebird'

import redisClient from '../modules/redis-client'
import { parserZrevrange as zrevrange } from '../utils'
import { PwdCount, UserInfo } from './interface'

// sortedset { structure: count }
const REDIS_PCFG_COUNT_KEY = `crackflow-${process.env.NODE_ENV}:{{name}}:pcfg:count`
// sortedset { fragmet: count }, {{type}} -> A/B/C, {{number}} -> 碎片的长度
const REDIS_FRAGMET_COUNT_KEY = `crackflow-${process.env.NODE_ENV}:{{name}}:pcfg:{{type}}:{{number}}`
// sortedset { pwd: probability }
const REDIS_PWD_PROBABILITY_KEY = `crackflow-${process.env.NODE_ENV}:{{name}}:pcfg:probability`

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
  mobileLastFour: 'E',
  mobileLastSix: 'F',
  birthdayFour: 'G',
  usernameNumberFragmet: 'H',
  usernameStringFragmet: 'I',
  emailNumberFragmet: 'J',
  emailStringFragmet: 'K',
  namePinyin: 'L',
  namePinyinFirstLetter: 'M',
}

const defaultBasicType = {
  INIT: '',
  NUMBER_TYPE: 'A',
  LOWER_CHAR_TYPE: 'B',
  UPPER_CHAR_TYPE: 'C',
  MARK_TYPE: 'D',
}

interface RangeResult {
  key: string
  value: number
}

export default class PCFG {
  // 密码
  protected _pwds: PwdCount[]
  // PCFG的拓展算法名（子类完成）
  protected _name: string
  // UserInfo里在PCFG中有无用的特征
  protected _userInfoUnusefulFeature: string[]
  // 基础的PCFG特征
  protected _basicType: Object
  // UserInfo扩展出来的PCFG特征
  protected _userInfoType: Object
  // 从type到userInfoKey的映射
  protected _typeToUserInfo: Object

  constructor(
    pwds: PwdCount[],
    userInfoUnusefulFeature: string[] = defaultUnusefulFeature,
    basicType: Object = defaultBasicType,
    userInfoType: Object = defaultUserInfoType
  ) {
    this._pwds = pwds
    this._userInfoUnusefulFeature = userInfoUnusefulFeature
    this._basicType = basicType
    this._userInfoType = userInfoType
    this._typeToUserInfo = _.invert(userInfoType)
  }

  /**
   * 对字符进行分类
   * @param char 字符
   */
  protected _charTypeof(char: string): string {
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
   * 向后嗅探（子类完成）
   * @param pwd         密码
   * @param index       现在搜索的位置下标
   * @param type        上一个字符所属类型
   * @param fragment    现在的碎片结果
   * @param result      最终PCFG结果
   * @param count       总量
   * @param userInfo    用户信息
   */
  // tslint:disable-next-line
  protected _extends(pwd: string, index: number, result: string, count: number, userInfo?: UserInfo) { }

  /**
   * 保存中间碎片结果
   * @param fragmet     碎片中间结果
   * @param type        类型
   * @param length      长度
   * @param count       总个数
   */
  protected _saveFragmet(fragmet: string, type: string, length: number, count: number) {
    redisClient.zincrby(
      REDIS_FRAGMET_COUNT_KEY
        .replace(/{{name}}/, this._name)
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
  protected _saveStructure(structure: string, count: number) {
    redisClient.zincrby(
      REDIS_PCFG_COUNT_KEY.replace(/{{name}}/, this._name),
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
    // 边界条件
    if (index >= typeNumberList.length) {
      redisClient.zadd(
        REDIS_PWD_PROBABILITY_KEY.replace(/{{name}}/, this._name),
        probability.toString(),
        pwd
      )
      return
    }
    const typeNumber = typeNumberList[index]
    // tslint:disable-next-line
    const values: string[] = _.values(this._userInfoType) as any[]
    // 用户信息特征
    if (values.includes(typeNumber.type) && userInfo) {
      const userInfoValue = userInfo[this._typeToUserInfo[typeNumber.type]]
      if (!userInfoValue || userInfoValue.length === 0) {
        return
      }
      switch (typeof userInfoValue) {
        case 'string':
          this._makeUpPassword(
            index + 1,
            basicIndex,
            probability,
            pwd + userInfoValue,
            typeNumberList,
            fragmetList,
            userInfo
          )
          break
        case 'object':
          for (const userInfoUnit of userInfoValue) {
            this._makeUpPassword(
              index + 1,
              basicIndex,
              probability * (1 / userInfoValue.length),
              pwd + userInfoUnit,
              typeNumberList,
              fragmetList,
              userInfo
            )
          }
          break
        default:
      }
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
   * @param basicGenerator     是否是基础密码生成模式
   */
  private _isBasicGeneratorIncludeUserInfoType(
    units: string[],
    basicGenerator: boolean
  ) {
    if (!basicGenerator) {
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
  private async _passwordCount(
    count: number,
    basicGenerator: boolean,
    structures: RangeResult[],
    userInfo?: UserInfo
  ) {
    for (const structure of structures) {
      const [...units] = structure.key.split(',')
      if (this._isBasicGeneratorIncludeUserInfoType(units, basicGenerator)) {
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
      // todo 优化
      const fragmetList = await Promise.map(hasFragmetType, u => {
        return zrevrange(
          REDIS_FRAGMET_COUNT_KEY
            .replace(/{{name}}/, this._name)
            .replace(/{{type}}/, u.type)
            .replace(/{{number}}/, u.num),
          0, -1, 'WITHSCORES'
        )
      })
      this._makeUpPassword(0, 0, structure.value / count, '', typeNumberList, fragmetList, userInfo)
    }
  }

  /**
   * 计算密码总数
   * @param basicGenerator
   */
  private _calculatePasswordCount(
    structures: RangeResult[],
    basicGenerator: boolean
  ): number {
    let sum = 0
    for (const structure of structures) {
      const [...units] = structure.key.split(',')
      if (this._isBasicGeneratorIncludeUserInfoType(units, basicGenerator)) {
        continue
      }
      sum += structure.value
    }
    return sum
  }

  /**
   * 普通密码生成模式
   */
  public async basicPasswordGenerator() {
    const structures = await zrevrange(
      REDIS_PCFG_COUNT_KEY.replace(/{{name}}/, this._name),
      0,
      -1,
      'WITHSCORES'
    )
    await this._passwordCount(
      this._calculatePasswordCount(structures, true),
      true,
      structures
    )
  }

  /**
   * 扩展密码生成模式
   * @param count       密码总数
   * @param userInfos   用户信息
   */
  public async extendPasswordGenerator(userInfo: UserInfo) {
    const structures = await zrevrange(
      REDIS_PCFG_COUNT_KEY.replace(/{{name}}/, this._name),
      0,
      -1,
      'WITHSCORES'
    )
    await this._passwordCount(
      this._calculatePasswordCount(structures, false),
      false,
      structures,
      userInfo
    )
  }

  /**
   * 多进程的 basic-PCFG 算法的 Worker
   * 1. 因为中间过程只是简单的累加进行统计，所以全部做异步
   * 2. 这里只进行统计，不进行排序
   * @param basicGenerator   是否是普通模式
   */
  public basicPcfgWorker(basicGenerator: boolean) {
    _.each(this._pwds, pwd => {
      this._extends(
        pwd.code,
        0,
        '',
        pwd.count,
        basicGenerator
          ? undefined
          : _.omit(pwd.userInfo, ...this._userInfoUnusefulFeature)
      )
    })
  }
}
