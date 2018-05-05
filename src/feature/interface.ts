export interface RowData7k7k {
  username: string
  password: string
}

export interface RowDataDuduniu {
  username: string
  email: string
  password: string
}

export interface RowDataPhpbb {
  numcount: number
  password: string
}

export interface RowDataRock {
  numcount: number
  password: string
}

export interface RowData12306 {
  email: string
  ctfid: string
  name: string
  password: string
  mobile: string
  username: string
}

export interface RowDataTianya {
  email: string
  username: string
  password: string
}

export interface MobileParser {
  mobileLastFour: string
  mobileLastFive: string
  mobileLastSix: string
  mobileTotle: string
}

export interface CtfidParser {
  birthdayEight: string
  birthdaySix: string
  birthdayFour: string
  ctfIdLastFour: string
  ctfIdLastFive: string
  ctfIdLastSix: string
}

export interface UsernameParser {
  usernameNumberFragmet: string[]
  usernameStringFragmet: string[]
}

export interface EmailParser {
  emailNumberFragmet: string[]
  emailStringFragmet: string[]
}

export interface NameParser {
  namePinyin: string
  namePinyinFirstLetter: string
}

export interface AllFeature {
  mobileLastFour?: string
  mobileLastFive?: string
  mobileLastSix?: string
  mobileTotle?: string
  birthdayEight?: string
  birthdaySix?: string
  birthdayFour?: string
  ctfIdLastFour?: string
  ctfIdLastFive?: string
  ctfIdLastSix?: string
  usernameNumberFragmet?: string[]
  usernameStringFragmet?: string[]
  emailNumberFragmet?: string[]
  emailStringFragmet?: string[]
  namePinyin?: string
  namePinyinFirstLetter?: string
  password: string
  source: string
}

export interface AllRowDataWithUserInfo {
  password: string
  username: string
  email?: string
  ctfid?: string
  name?: string
  mobile?: string
}
