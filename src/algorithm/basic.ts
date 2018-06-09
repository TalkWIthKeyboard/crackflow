import * as _ from 'lodash'

import { PwdCount, UserInfo } from './interface'
import { defaultUnusefulFeature, defaultBasicType, defaultUserInfoPCFGType, keys, defaultUserInfoMarkovType } from './default'

export default class Basic {
  // 算法名字
  private readonly _algorithmName
  // 是否启用拓展用户信息的模式
  protected _isIncludeUserInfo: boolean
  // 密码
  protected _pwds: PwdCount[]
  // UserInfo中无用的特征
  protected _userInfoUnusefulFeature: string[]
  // 基础的特征
  protected _basicType: Object
  // UserInfo扩展出来的PCFG特征
  protected _userInfoType: Object
  // 从特征到userInfoKey的映射
  protected _typeToUserInfo: Object
  // 用户临时存储填充以后的密码
  protected _temFilledPwdList: string[]
  // 从Markov标定的特征到userInfoKey的映射
  protected _markovTypeToUserInfo: Object
  // 每个用户生成的口令数量
  private _everUserGeneratePwdLimit: number

  constructor(
    algorithmName: 'PCFG' | 'Markov' | 'Markov-PCFG',
    isIncludeUserInfo: boolean,
    pwds: PwdCount[],
    userInfoUnusefulFeature: string[] = defaultUnusefulFeature,
    basicType: Object = defaultBasicType
  ) {
    this._algorithmName = algorithmName
    this._isIncludeUserInfo = isIncludeUserInfo
    this._pwds = pwds
    this._userInfoUnusefulFeature = userInfoUnusefulFeature
    this._basicType = basicType
    const userInfoType = this._algorithmName === 'PCFG'
      ? defaultUserInfoPCFGType
      : defaultUserInfoMarkovType
    this._userInfoType = userInfoType
    this._typeToUserInfo = _.invert(userInfoType)

    this._markovTypeToUserInfo = _.invert(defaultUserInfoMarkovType)
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
    userInfo: UserInfo
  ) {
    if (index >= matchList.length) {
      if (pwd.length > 5) {
        this._temFilledPwdList.push(pwd)
      }
      return
    }
    const matchString = matchList[index]
    const info = userInfo[this._markovTypeToUserInfo[matchString]]
    if (info === '' || info === []) {
      return
    }
    switch (typeof info) {
      case 'string':
        this._searchFill(
          index + 1,
          pwd.replace(new RegExp(matchString, 'g'), info),
          matchList,
          userInfo
        )
        break
      case 'object':
        for (const unit of info) {
          this._searchFill(
            index + 1,
            pwd.replace(new RegExp(matchString, 'g'), unit),
            matchList,
            userInfo
          )
        }
        break
      default:
    }
  }

  /**
   * 获取最终模型
   * @private
   * @returns
   * @memberof Basic
   */
  private _getProbabilityRedisKey(): string {
    switch (this._algorithmName) {
      case 'PCFG':
        return keys.REDIS_PCFG_PWD_PROBABILITY_KEY(this._isIncludeUserInfo)
      case 'Markov':
        return keys.REDIS_MARKOV_PWD_PROBABILITY_KEY(this._isIncludeUserInfo)
      case 'Markov-PCFG':
        return keys.REDIS_MARKOV_PCFG_PWD_PROBABILITY_KEY
      default:
        return ''
    }
  }

  /**
   * 训练模型
   */
  // tslint:disable-next-line
  public train(isEndSymbol?: boolean) { }

  /**
   * 生成密码
   */
  // tslint:disable-next-line
  public async passwordGenerate() { }

  /**
   * 填充用户信息到 Markov 生成的结构中
   */
  public fillUserInfo(
    userInfo: UserInfo,
    structures,
    top: number = 100
  ) {
    this._temFilledPwdList = []
    this._everUserGeneratePwdLimit = top
    for (const structure of structures) {
      if (this._temFilledPwdList.length > this._everUserGeneratePwdLimit) {
        break
      }
      if (structure.includes('「')) {
        const matchList = structure.match(/(「[^「」 ]*」)/g)
        this._searchFill(0, structure.replace(/¥/, ''), matchList, userInfo)
      } else {
        this._temFilledPwdList.push(structure.replace(/¥/, ''))
      }
    }
    return this._temFilledPwdList
  }
}
