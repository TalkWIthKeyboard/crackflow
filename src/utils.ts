import redisClient from './modules/redis-client'

interface RangeResult {
  key: string
  value: number
}

/**
 * 将 zrevrange 的结果序列化为 [{key, value}]
 * @param key
 * @param start
 * @param stop
 * @param withScore
 */
export async function parserZrevrange(
  key: string,
  start: number,
  stop: number,
  withScore?: 'WITHSCORES'
): Promise<RangeResult[]> {
  const list = await redisClient.zrevrange(key, start, stop, withScore)
  const result: RangeResult[] = []
  for (let index = 0; index < list.length; index += 2) {
    result.push({ key: list[index], value: parseInt(list[index + 1]) })
  }
  return result
}
