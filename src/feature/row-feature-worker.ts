import * as _ from 'lodash'
import * as pinyin from 'pinyin'

import { MobileParser, CtfidParser, UsernameParser, EmailParser, NameParser } from './interface'

function usernameClean(rowUsername: string): string | null {
  const noSpacecUsername = rowUsername.replace(/\s/g, '')
    // 1. 出现大于3个问号的时候大多数是出现了非法字符
  if (!/.*\?{3}.*/.test(noSpacecUsername)
    // 2. 只准出现常规字符
    && /^[!"#$%&'()*+,-./:;<=>?@[\]^_`{|}~0-9a-zA-Z]*$/.test(noSpacecUsername)
    // 3. 非空长度大于5
    && noSpacecUsername.length > 5) {
      return noSpacecUsername
    }
  return null
}

function passwordClean(rowPassword: string): string | null {
  const noSpacePassword = rowPassword.replace(/\s/g, '')
    // 1. 只允许出现常规字符
  if (/^[!"#$%&'()*+,-./:;<=>?@[\]^_`{|}~0-9a-zA-Z]*$/.test(noSpacePassword)
    // 2. 非空长度大于3
    && noSpacePassword.length > 3
    // 3. 非空长度小于30
    && noSpacePassword.length < 30) {
      return noSpacePassword
    }
  return null
}

function emailClean(rowEmail: string): string | null {
  const noSpaceEmail = rowEmail
    .replace(/\s/g, '')
    // duduniu 出现异常乱码
    .replace(/["[]]/g, '')
    // 邮箱开头出现的乱码
    .replace(/^[!"#$%&'()*+,-./:;<=>?@[\]^_`{|}~]*/, '')
  // 1. 符合常规邮箱格式
  if (/^[a-z0-9]+([._\\-]*[a-z0-9])*@([a-z0-9]+[-a-z0-9]*[a-z0-9]+.){1,63}[a-z0-9]+$/.test(noSpaceEmail)) {
    return noSpaceEmail
  }
  return null
}

function nameClean(rowName: string): string | null {
  const noSpaceName = rowName
    .replace(/\s/g, '')
    .replace(/[!"#$%&'()*+,-./:;<=>?@[\]^_`{|}~]/g, '')
  // 1. 默认是中文名字
  const chineseName = _.compact(noSpaceName.match(/([\u4e00-\u9fa5]*)/g)).join('')
  // 2. 长度不超过4
  if (chineseName.length > 0 && chineseName.length <= 4) {
    return chineseName
  }
  return null
}

function ctfidClean(rowCtfid: string): string | null {
  const noSpaceCtfid = rowCtfid
    .replace(/\s/g, '')
    .replace(/[!"#$%&'()*+,-./:;<=>?@[\]^_`{|}~]/g, '')
  // 长度为15或者18
  if (/^[0-9X]{15}$/.test(noSpaceCtfid)
  || /^[0-9X]{18}$/.test(noSpaceCtfid)) {
    return noSpaceCtfid
  }
  return null
}

function mobileClean(rowMobile: string): string | null {
  const noSpaceMobile = rowMobile
    .replace(/\s/g, '')
    .replace(/[!"#$%&'()*+,-./:;<=>?@[\]^_`{|}~]/g, '')
  // 默认为中国手机号码
  if (/^(13[0-9]|14[579]|15[0-3,5-9]|16[6]|17[0135678]|18[0-9]|19[89])\d{8}$/.test(noSpaceMobile)) {
    return noSpaceMobile
  }
  return null
}

function mobileParser(mobile: string): MobileParser {
  return {
    mobileLastFour: mobile.slice(-4),
    mobileLastFive: mobile.slice(-5),
    mobileLastSix: mobile.slice(-6),
    mobileTotle: mobile,
  }
}

function ctfidParser(ctfId: string): CtfidParser {
  const birthday = ctfId.length === 18
    ? ctfId.slice(6, 14)
    : `19${ctfId.slice(6, 12)}`
  return {
    birthdayEight: birthday,
    birthdaySix: birthday.slice(-6),
    birthdayFour: birthday.slice(-4),
    ctfIdLastFour: ctfId.slice(-4),
    ctfIdLastFive: ctfId.slice(-5),
    ctfIdLastSix: ctfId.slice(-6),
  }
}

function usernameParser(username: string): UsernameParser {
  return {
    usernameNumberFragmet: _.compact(username.match(/([0-9]*)/g)),
    usernameStringFragmet: _.compact(username.match(/([^0-9]*)/g)),
  }
}

function emailParser(email: string): EmailParser {
  return {
    emailNumberFragmet: _.compact(email.split('@')[0].match(/([0-9]*)/g)),
    emailStringFragmet: _.compact(email.split('@')[0].match(/([^0-9]*)/g)),
  }
}

function nameParser(name: string): NameParser {
  return {
    namePinyin: _.flatten(pinyin(name, { style: pinyin.STYLE_NORMAL })).join(''),
    namePinyinFirstLetter: _.flatten(pinyin(name, { style: pinyin.STYLE_FIRST_LETTER })).join(''),
  }
}

export default {
  mobile: {
    clean: mobileClean,
    parser: mobileParser,
  },
  ctfid: {
    clean: ctfidClean,
    parser: ctfidParser,
  },
  name: {
    clean: nameClean,
    parser: nameParser,
  },
  email: {
    clean: emailClean,
    parser: emailParser,
  },
  username: {
    clean: usernameClean,
    parser: usernameParser,
  },
  password: {
    clean: passwordClean,
  },
}
