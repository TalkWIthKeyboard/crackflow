export const defaultUnusefulFeature = [
  'mobileTotle',
  'mobileLastFive',
  'birthdaySix',
  'birthdayEight',
  'ctfIdLastFour',
  'ctfIdLastFive',
  'ctfIdLastSix',
  'mobileTotle',
]

export const defaultUserInfoMarkovType = {
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

export const defaultUserInfoPCFGType = {
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

export const defaultBasicType = {
  INIT: '',
  NUMBER_TYPE: 'A',
  LOWER_CHAR_TYPE: 'B',
  UPPER_CHAR_TYPE: 'C',
  MARK_TYPE: 'D',
}

export const defaultPCFGTypeToMarkovType = {
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

/**
 * 获取最终模型的key
 */
export function getProbabilityRedisKey(): string {
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

export const keys = {
  // sortedset { pwd: probability }
  REDIS_MARKOV_PCFG_PWD_PROBABILITY_KEY: `crackflow-${process.env.NODE_ENV}:markov-pcfg:probability`,
  // sortedset { pwd: probability }
  REDIS_MARKOV_PWD_PROBABILITY_KEY: (isExtra: boolean) => {
    return `crackflow-${process.env.NODE_ENV}:${isExtra ? 'extra-' : ''}markov:probability`
  },
  // sortedset { pwd: probability }
  REDIS_PCFG_PWD_PROBABILITY_KEY: (isExtra: boolean) => {
    return `crackflow-${process.env.NODE_ENV}:${isExtra ? 'extra-' : ''}pcfg:probability`
  },

  // sortedset { structure: count }
  REDIS_PCFG_COUNT_KEY: (isExtra: boolean) => {
    return `crackflow-${process.env.NODE_ENV}:${isExtra ? 'extra-' : ''}pcfg:count`
  },
  // sortedset { fragmet: count }, {{type}} -> A/B/C, {{number}} -> 碎片的长度
  REDIS_PCFG_FRAGMET_COUNT_KEY: (isExtra: boolean) => {
    return `crackflow-${process.env.NODE_ENV}:${isExtra ? 'extra-' : ''}pcfg:{{type}}:{{number}}`
  },
  // sortedset  记录 word -> any 的转移概率
  REDIS_MARKOV_TRANSFER_KEY: (isExtra: boolean) => {
    return `crackflow-${process.env.NODE_ENV}:${isExtra ? 'extra-' : ''}markov:probability:{{word}}`
  },
  // sortedset  记录起始词概率
  REDIS_MARKOV_BEGIN_KEY: (isExtra: boolean) => {
    return `crackflow-${process.env.NODE_ENV}:${isExtra ? 'extra-' : ''}markov:begin`
  },
}
