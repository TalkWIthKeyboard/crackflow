export interface PwdCount {
  code: string
  count: number
  userInfo?: UserInfo
}

export interface UserInfo {
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
}

export interface AnalyzerResult {
  length: number
  type: string
}

export interface RangeResult {
  key: string
  value: number
}

export interface PCFGUnit {
  type: string,
  num?: number
}