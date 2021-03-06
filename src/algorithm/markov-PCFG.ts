import * as _ from 'lodash'

import Basic from './basic'
import redisClient from '../modules/redis-client'
import { parserZrevrange as zrevrange } from '../utils'
import { PCFGUnit, RangeResult } from './interface'
import { defaultUserInfoMarkovType, defaultPCFGTypeToMarkovType, keys } from './default'

interface SeachUnit {
  index: number
  num: number
  preUnit: string
  pwd: string
  probability: number
}

interface Unit {
  pwd: string
  probability: string
}

/**
 * 仅考虑1阶段
 */
export default class MarkovPCFG extends Basic {
  // PCFG的基础类型
  private readonly _basicTypeList: string[]
  // Markov 的阶数
  private readonly _level: number
  // pcfg type 到 markov type 的映射
  private readonly _pcfgTypeToMarkovType
  // markvo type 到 pcfg type 的映射
  private readonly _markovTypeToPcfgType
  //
  private _temporaryList: Unit[]
  private _limit: number

  private _cache: {}

  constructor(
    level: number,
    userInfoType: Object = defaultUserInfoMarkovType,
    pcfgTypeToMarkovType: Object = defaultPCFGTypeToMarkovType,
    userInfoUnusefulFeature?: string[],
    basicType?: Object
  ) {
    super('Markov-PCFG', true, [], userInfoUnusefulFeature, basicType)
    this._basicTypeList = _.keys(_.invert(this._basicType))
    this._level = level
    this._pcfgTypeToMarkovType = pcfgTypeToMarkovType
    this._markovTypeToPcfgType = _.invert(pcfgTypeToMarkovType)
    this._cache = {}
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
   * 宽度优先遍历出一个 PCFG 结构的口令
   * @param probability 
   * @param units 
   */
  private async _searchWidth(probability: number, units: PCFGUnit[]) {
    const searchQueue: SeachUnit[] = []
    // 添加初始元素
    const pcfgBeginUnits = this._getUnitsByNumber(units, this._level)
    const rowMarkovBeginUnits = await zrevrange(keys.REDIS_MARKOV_FRAGMENT_KEY(true), 0, -1, 'WITHSCORES')
    // 拿出符合条件的 Markov begin units
    const beginUnits = this._filterUnitByPCFGUnit(rowMarkovBeginUnits, pcfgBeginUnits.res).slice(0, 10)
    const total = this._calculateTotalOfSortedset(beginUnits)
    for (const unit of beginUnits) {
      searchQueue.push({
        index: pcfgBeginUnits.index,
        num: pcfgBeginUnits.num,
        preUnit: unit.key,
        pwd: unit.key.replace(/，/g, ''),
        probability: probability * (unit.value / total)
      })
    }
    // 开始搜索
    let head = 0
    let foot = searchQueue.length
    while (head < foot) {
      const searchUnit = searchQueue[head]
      if (searchUnit.index >= units.length) {
        this._temporaryList.push({
          pwd: searchUnit.pwd.replace(/，/g, ''),
          probability: searchUnit.probability.toString(), 
        })
        head += 1
        continue
      }
      if (Math.log(searchUnit.probability) < -12) {
        head += 1
        continue
      }
      // 基础信息类型
      if (this._basicTypeList.includes(units[searchUnit.index].type)) {
        let chars
        // 这里对合法的元素做了缓存
        if (!this._cache[`${searchUnit.preUnit}_${units[searchUnit.index].type}`]) {
          const rowChars = await zrevrange(
            keys.REDIS_MARKOV_TRANSFER_KEY(true).replace(/{{word}}/, searchUnit.preUnit),
            0, -1, 'WITHSCORES'
          )
          chars = this._filterCharByType(rowChars, units[searchUnit.index].type).slice(0, 10)
          this._cache[`${searchUnit.preUnit}_${units[searchUnit.index].type}`] = chars
        } else {
          chars = this._cache[`${searchUnit.preUnit}_${units[searchUnit.index].type}`]
        }
        const total = this._calculateTotalOfSortedset(chars)
        const newNumber = searchUnit.num + 1 === units[searchUnit.index].num ? 0 : searchUnit.num + 1
        const newIndex = newNumber === 0 ? searchUnit.index + 1 : searchUnit.index
        for (const char of chars) {
          searchQueue.push({
            index: newIndex,
            num: newNumber,
            preUnit: searchUnit.preUnit.split('，').slice(1).join('，') + `，${char.key}`,
            pwd: searchUnit.pwd + char.key,
            probability: searchUnit.probability * (char.value / total),
          })
          foot += 1
        }
      } else {
        // 用户信息类型
        searchQueue.push({
          index: searchUnit.index + 1,
          num: 0,
          preUnit: searchUnit.preUnit.split('，').slice(1).join('，') + `，${this._pcfgTypeToMarkovType[units[searchUnit.index].type]}`,
          pwd: searchUnit.pwd + this._pcfgTypeToMarkovType[units[searchUnit.index].type],
          probability: searchUnit.probability,
        })
        foot += 1
      }
      head += 1
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
    if (this._limit > 20) {
      return
    }
    if (index >= units.length) {
      this._limit += 1
      redisClient.zadd(keys.REDIS_MARKOV_PCFG_PWD_PROBABILITY_KEY, probability.toString(), pwd.replace(/，/g, ''))
      return
    }
    // 起始
    if (index === 0 && num === 0) {
      const pcfgBeginUnits = this._getUnitsByNumber(units, this._level)
      const rowMarkovBeginUnits = await zrevrange(keys.REDIS_MARKOV_FRAGMENT_KEY(true), 0, -1, 'WITHSCORES')
      // 拿出符合条件的 Markov begin units
      const beginUnits = this._filterUnitByPCFGUnit(rowMarkovBeginUnits, pcfgBeginUnits.res).slice(0, 5)
      const total = this._calculateTotalOfSortedset(beginUnits)
      for (const unit of beginUnits) {
        await this._search(
          pcfgBeginUnits.index,
          pcfgBeginUnits.num,
          unit.key,
          unit.key.replace(/，/g, ''),
          probability * (unit.value / total),
          units
        )
      }
    // tslint:disable-next-line
    } else {
      // 基础类型
      if (this._basicTypeList.includes(units[index].type)) {
        let chars
        if (this._cache[`${preUnit}_${units[index].type}`]) {
          const rowChars = await zrevrange(
            keys.REDIS_MARKOV_TRANSFER_KEY(true).replace(/{{word}}/, preUnit),
            0, -1, 'WITHSCORES'
          )
          chars = this._filterCharByType(rowChars, units[index].type).slice(0, 5)
          this._cache[`${preUnit}_${units[index].type}`] = chars          
        } else {
          chars = this._cache[`${preUnit}_${units[index].type}`]
        }
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
  public async passwordGenerate() {
    const structures = (await zrevrange(keys.REDIS_PCFG_COUNT_KEY(true), 0, 3000, 'WITHSCORES'))
    const total = this._calculateTotalOfSortedset(structures)
    let count = 0
    for (const structure of structures) {
      this._temporaryList = []
      const units = structure.key.split(',')
      await this._searchWidth(structure.value / total, _.map(units, unit => {
        const [type, num] = unit.split('/')
        return { type, num: num ? parseInt(num) : undefined }
      }))
      count += 1
      if (count % 500 === 0) {
        console.log(count)
      }
      if (this._temporaryList.length > 0) {
        redisClient.zadd(
          keys.REDIS_MARKOV_PCFG_PWD_PROBABILITY_KEY,
          ..._.flatten(_.map(
            _.sortBy(this._temporaryList, t => parseFloat(t.probability))
              .reverse()
              .slice(0, 30),
            u => {
              return [u.probability, u.pwd]
            }))
        )
      }
    }
  }
}
