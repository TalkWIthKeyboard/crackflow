import * as _ from 'lodash'

import PCFG from './basic-PCFG'
import { PwdCount, UserInfo } from './interface'

export default class ExtendPCFG extends PCFG {
  constructor(
    pwds: PwdCount[],
    userInfoUsefulFeature?: string[],
    basicType?: Object,
    userInfoType?: Object
  ) {
    super(pwds, userInfoUsefulFeature, userInfoType, basicType)
    this._name = 'EXTEND'
  }

  get name(): string {
    return this._name
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

  protected _extends(
    pwd: string,
    index: number,
    result: string,
    count: number,
    userInfo?: UserInfo
  ) {
    if (index >= pwd.length) {
      this._saveStructure(result, count)
      return
    }
    const charType = this._charTypeof(pwd[index])
    // 基础PCFG
    const nextIndex = this._basicTypeTowardEnd(pwd, index, charType)
    this._saveFragmet(pwd.slice(index, nextIndex), charType, nextIndex - index, count)
    this._extends(
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
              this._extends(
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
                this._extends(
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
}
