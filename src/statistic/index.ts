import { drawLegalDataDistribute, drawFeatureInclude } from './draw-table'
import { legalDataDistribute, getIncludePasswordPercentage } from './major-total'

export async function statisticAndDraw() {
  const data = await legalDataDistribute()
  drawLegalDataDistribute(data)
  const pwdInclude = await getIncludePasswordPercentage()
  drawFeatureInclude(pwdInclude.featureCountMap)
}
