import * as _ from 'lodash'

interface SplitIndex {
  start: number
  limit: number
}

/**
 * 分割一个整体
 * @param start     开始位置的下标
 * @param end       结束位置的下标
 * @param limit     每个单元的限制个数
 */
export function splitToArray(start: number, end: number, limit: number): SplitIndex[] {
  const splitIndexList: SplitIndex[] = []
  let index = start
  while (index < end) {
    splitIndexList.push({
      start: index,
      limit: index + limit < end ? limit : end - index,
    })
    index += limit
  }
  return splitIndexList
}

/**
 * 查看破解口令的覆盖率
 * @param generatedPwds
 * @param userPwds
 */
export function cover(generatedPwds: string[], userPwds: string[], trainAlgorithm: string) {
  let gIndex = 0
  let uIndex = 0
  let total = 0
  while (gIndex < generatedPwds.length && uIndex < userPwds.length) {
    if (_.isEqual(generatedPwds[gIndex], userPwds[uIndex])) {
      total += 1
      uIndex += 1
    }
    if (generatedPwds[gIndex] < userPwds[uIndex]) {
      gIndex += 1
    }
    if (userPwds[uIndex] < generatedPwds[gIndex]) {
      uIndex += 1
    }
  }
  console.log(`${trainAlgorithm}: ${generatedPwds.length} / ${userPwds.length}, ${total} / ${generatedPwds.length}`)  
  return total
}

export const source = ['phpbb', 'rock']
// export const trainAlgorithms = ['extra-Markov', 'markov-PCFG', 'extra-PCFG']

export const trainAlgorithms = ['PCFG']
