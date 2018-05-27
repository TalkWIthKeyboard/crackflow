import { drawLegalDataDistribute, drawFeatureInclude, drawPasswordAppearCount, drawPasswordFeatureDistrubute } from './draw-table'
import { legalDataDistribute, getIncludePasswordPercentage } from './major-total'
import { parserZrevrange } from '../utils'
import redisClient from '../modules/redis-client'
import * as _ from 'lodash'

export async function statisticAndDraw() {
  const data = await legalDataDistribute()
  drawLegalDataDistribute(data)
  const pwdInclude = await getIncludePasswordPercentage()
  drawFeatureInclude(pwdInclude.featureCountMap)
}

async function drawPwdsStatisticTable() {
  // 画口令出现次数图
  const pwdsCount = await parserZrevrange(`crackflow-${process.env.NODE_ENV}:statistic:pwd:count`, 0, 100, 'WITHSCORES')
  drawPasswordAppearCount(100, pwdsCount, '口令出现次数', 'password-appear-count')
  // 画口令长度分布图
  const pwdsLengthCount = _.sortBy(_.map(
    await redisClient.hgetall(`crackflow-${process.env.NODE_ENV}:statistic:length:count`),
    (value, key) => ({ key, value })
  ), p => parseInt(p.key))
  drawPasswordFeatureDistrubute(pwdsLengthCount, '口令长度分布', 'password-length-count')
  // 画口令字符分布图
  const pwdsCharCount = _.sortBy(_.map(
    await redisClient.hgetall(`crackflow-${process.env.NODE_ENV}:statistic:char:count`),
    (value, key) => ({ key, value })
  ), ['key'])
  drawPasswordFeatureDistrubute(pwdsCharCount, '口令字符分布', 'password-char-count')
  // 普通PCFG结构统计
  const pwdsPcfgStructureCount = _.map(
    await parserZrevrange(`crackflow-${process.env.NODE_ENV}:pcfg:count`, 0, 20, 'WITHSCORES'),
    s => ({ key: s.key.replace(/\//g, '').replace(/,/g, ''), value: s.value })
  )
  drawPasswordAppearCount(20, pwdsPcfgStructureCount, 'PCFG结构出现次数', 'pcfg-appear-count')
  // 拓展PCFG结构统计
  const extraPwdsPcfgStructureCount = _.map(
    await parserZrevrange(`crackflow-${process.env.NODE_ENV}:extra-pcfg:count`, 0, 20, 'WITHSCORES'),
    s => ({ key: s.key.replace(/\//g, '').replace(/,/g, ''), value: s.value })
  )
  drawPasswordAppearCount(20, extraPwdsPcfgStructureCount, 'PCFG结构出现次数', 'extra-pcfg-appear-count')
}

drawPwdsStatisticTable().then(() => {
  process.exit(0)
}).catch(err => {
  console.log(err)
  process.exit(1)
})
