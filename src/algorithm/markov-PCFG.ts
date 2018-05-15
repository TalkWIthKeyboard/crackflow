import * as _ from 'lodash'

import redisClient from '../modules/redis-client'
import { parserZrevrange as zrevrange } from '../utils'
import { UserInfo, PCFGUnit, RangeResult } from './interface'

// sortedset { structure: count }
const REDIS_PCFG_COUNT_KEY = `crackflow-${process.env.NODE_ENV}:pcfg:count`
// sortedset { pwd: probability }
const REDIS_MARKOV_PCFG_PWD_PROBABILITY_KEY = `crackflow-${process.env.NODE_ENV}:markov-pcfg:probability`
// sortedset  记录 word -> any 的转移概率
const REDIS_TRANSFER_PROBABILITY_KEY = `crackflow-${process.env.NODE_ENV}:markov:probability:{{word}}`
// sortedset  记录起始词概率
const REDIS_BEGIN_KEY = `crackflow-${process.env.NODE_ENV}:markov:begin`

const defaultPCFGTypeToMarkovType = {
  E: '「MLF」',
  F: '「MLS」',
  G: '「BF」',
  H: '「UNF」',
  I: '「USF」',
  J: '「ENF」',
  K: '「ESF」',
  L: '「NP」',
  M: '「NPFL」',
}

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

const defaultBasicType = {
  INIT: '',
  NUMBER_TYPE: 'A',
  LOWER_CHAR_TYPE: 'B',
  UPPER_CHAR_TYPE: 'C',
  MARK_TYPE: 'D',
}

/**
 * 仅考虑1阶段
 */
export default class MarkovPCFG {
  // PCFG算法的类型
  private readonly _pcfgType: string
  // PCFG的基础类型
  private readonly _basicType: Object
  private readonly _basicTypeList: string[]
  // Markov 的阶数
  private readonly _level: number
  // pcfg type 到 markov type 的映射
  private readonly _pcfgTypeToMarkovType
  // markvo type 到 pcfg type 的映射
  private readonly _markovTypeToPcfgType
  // 用户临时存储填充以后的密码
  private _temFilledPwdList: string[]
  // 填充值到用户信息特征的映射
  private readonly _typeToUserInfokey: Object

  constructor(
    level: number,
    basicType: Object = defaultBasicType,
    userInfoType: Object = defaultUserInfoType,
    pcfgTypeToMarkovType: Object = defaultPCFGTypeToMarkovType
  ) {
    this._basicType = basicType
    this._basicTypeList = _.keys(_.invert(basicType))
    this._level = level
    this._pcfgTypeToMarkovType = pcfgTypeToMarkovType
    this._markovTypeToPcfgType = _.invert(pcfgTypeToMarkovType)
    this._typeToUserInfokey = _.invert(userInfoType)
  }

  /**
   * 单个字符的类型判断
   * @param char
   */
  private _charTypeOf(char: string): string {
    if (this._markovTypeToPcfgType[char]) {
      return this._markovTypeToPcfgType[char]
    }
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
   * Markov结构变换成PCFG结构
   * @param unit
   */
  private _unitTypeOf(unit: string): PCFGUnit[] {
    let index = 0
    let charType = ''
    let typeNumber = 0
    const pcfgStructure: PCFGUnit[] = []
    const unitList = unit.split('，')
    while (index < unitList.length) {
      const char = unitList[index]
      if (char === '¥') {
        break
      }
      // 基础类型
      if (!char.includes('「')) {
        const type = this._charTypeOf(char)
        if (type !== charType) {
          if (charType !== '') {
            pcfgStructure.push({ type: charType, num: typeNumber !== -1 ? typeNumber : undefined })
          }
          typeNumber = 1
          charType = type
        } else {
          typeNumber += 1
        }
      } else {
        // 用户信息类型
        if (charType !== '') {
          pcfgStructure.push({ type: charType, num: typeNumber !== -1 ? typeNumber : undefined })
        }
        charType = this._markovTypeToPcfgType[char]
        typeNumber = -1
      }
      index += 1
    }
    pcfgStructure.push({ type: charType, num: typeNumber !== -1 ? typeNumber : undefined })
    return pcfgStructure
  }

  /**
   * 过滤出所有符合类型的unit
   * @param units
   * @param type
   */
  private _filterUnitByPCFGUnit(units: RangeResult[], type: PCFGUnit[]): RangeResult[] {
    return _.filter(units, u => _.isEqual(this._unitTypeOf(u.key), type))
  }

  /**
   * 过滤出所有符合类型的char
   * @param chars
   * @param type
   */
  private _filterCharByType(chars: RangeResult[], type: string): RangeResult[] {
    return _.filter(chars, c => _.isEqual(this._charTypeOf(c.key), type))
  }

  /**
   * 计算一个 sortedSet 的总次数
   * @param sortedset
   */
  private _calculateTotalOfSortedset(sortedset: RangeResult[]) {
    return _.reduce(_.map(sortedset, s => s.value), (sum, n) => {
      return sum + n
    }, 0)
  }

  /**
   * 根据数量从 Units 中提取片段
   * 1. 并返回涵盖了几个片段(index)
   * 2. 以及最后一个片段的几个字符(num)
   * @param units
   * @param num
   */
  private _getUnitsByNumber(units: PCFGUnit[], num: number) {
    let total = 0
    let index = 0
    const res: PCFGUnit[] = []
    let fullNum = 0
    // units总长度比num还要小
    const totalLength = _.reduce(_.map(units, u => u.num), (sum, n) => {
      return n ? sum + n : sum + 1
    }, 0)
    if (totalLength < num) {
      return { res: units, index: units.length + 1, num: 0 }
    }
    while (total < num) {
      const unit = {
        type: units[index].type,
        num: units[index].num || 1,
        rowNum: units[index].num,
      }
      // 最后一个unit
      if (unit.num + total >= num) {
        res.push({ type: unit.type, num: unit.rowNum ? num - total : undefined })
        fullNum = num - total
        total = num
        if (fullNum === unit.num) {
          index += 1
          fullNum = 0
        }
      } else {
        total += unit.num
        res.push({ type: unit.type, num: unit.rowNum })
        index += 1
      }
    }
    return { res, index, num : fullNum }
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
   * 深度优先遍历出一个 PCFG 结构的密码
   * @param index           第几个PCFG单元
   * @param num             现PCFG单元中的第几个字符
   * @param preUnit         前一个PCFG单元
   * @param units           PCFG结构
   * @param pwd             最终的密码
   */
  private async _search(
    index: number,
    num: number,
    preUnit: string,
    pwd: string,
    probability: number,
    units: PCFGUnit[]
  ) {
    if (index >= units.length) {
      // console.log(pwd, probability)
      redisClient.zadd(REDIS_MARKOV_PCFG_PWD_PROBABILITY_KEY, probability.toString(), pwd.replace(/，/g, ''))
      return
    }
    // 起始
    if (index === 0 && num === 0) {
      const pcfgBeginUnits = this._getUnitsByNumber(units, this._level + 1)
      const rowMarkovBeginUnits = await zrevrange(REDIS_BEGIN_KEY, 0, -1, 'WITHSCORES')
      // 拿出符合条件的 Markov begin units
      const beginUnits = this._filterUnitByPCFGUnit(rowMarkovBeginUnits, pcfgBeginUnits.res)
      const total = this._calculateTotalOfSortedset(beginUnits)
      for (const unit of beginUnits) {
        await this._search(
          pcfgBeginUnits.index,
          pcfgBeginUnits.num,
          unit.key.split('，').slice(1).join('，'),
          unit.key.replace('/，/g', ''),
          probability * (unit.value / total),
          units
        )
      }
    // tslint:disable-next-line
    } else {
      // 基础类型
      if (this._basicTypeList.includes(units[index].type)) {
        const rowChars = await zrevrange(
          REDIS_TRANSFER_PROBABILITY_KEY.replace(/{{word}}/, preUnit),
          0, -1, 'WITHSCORES'
        )
        const chars = this._filterCharByType(rowChars, units[index].type)
        const total = this._calculateTotalOfSortedset(chars)
        const newNumber = num + 1 === units[index].num ? 0 : num + 1
        const newIndex = newNumber === 0 ? index + 1 : index
        for (const char of chars) {
          await this._search(
            newIndex,
            newNumber,
            preUnit.split('，').slice(1).join('，') + `，${char.key}`,
            pwd + char.key,
            probability * (char.value / total),
            units
          )
        }
      } else {
        // 用户信息类型
        await this._search(
          index + 1,
          0,
          preUnit.split('，').slice(1).join('，') + `，${this._pcfgTypeToMarkovType[units[index].type]}`,
          pwd + this._pcfgTypeToMarkovType[units[index].type],
          probability,
          units
        )
      }
    }
  }

  /**
   * 生成密码
   */
  public async generatePwd() {
    const structures = (await zrevrange(
      REDIS_PCFG_COUNT_KEY.replace(/{{name}}/, this._pcfgType),
      0, -1, 'WITHSCORES'
    ))
    const total = this._calculateTotalOfSortedset(structures)
    for (const structure of structures) {
      const units = structure.key.split(',')
      await this._search(0, 0, '', '', structure.value / total, _.map(units, unit => {
        const [type, num] = unit.split('/')
        return { type, num: num ? parseInt(num) : undefined }
      }))
    }
  }

  /**
   * 填充用户信息到 Markov 生成的结构中
   */
  public async fillUserInfo(
    userInfo: UserInfo,
    top?: number
  ) {
    const structures = await redisClient.zrevrange(REDIS_MARKOV_PCFG_PWD_PROBABILITY_KEY, 0, -1)
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
