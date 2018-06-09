import * as _ from 'lodash'
import * as fs from 'fs'
import * as path from 'path'

import rowFeatureWork from '../feature/row-feature-worker'
import redisClient from '../modules/redis-client'
import PCFG from '../algorithm/PCFG'
import Markov from '../algorithm/Markov'
import MarkovPCFG from '../algorithm/markov-PCFG'

const userInfo = require('../../../user-info.json')
const globalConfig = require('../../../crack-config.json')

/**
 * 获取特征并生成口令
 */
async function getFeatureAndGeneratePwd() {
  let userFeature = {}
  for (const key in userInfo) {
    const cleanedInfo = rowFeatureWork[key].clean(userInfo[key])
    if (cleanedInfo) {
      userFeature = {
        ...userFeature,
        ...rowFeatureWork[key].parser(cleanedInfo),
      }
    }
  }
  const trainAlgorithm = process.env.ALGORITHM
  let pwds 
  switch (trainAlgorithm) {
    case 'PCFG':
      const pcfg = new PCFG([], false)
      pwds = await redisClient.zrevrange(
        `crackflow-${process.env.NODE_ENV}:pcfg:probability`,
        0,
        100,
      )
      break
    case 'Markov':
      const markov = new Markov([], true, true, 3, false)
      pwds = await redisClient.zrevrange(
        `crackflow-${process.env.NODE_ENV}:markov:probability`,
        0,
        100,
      )
      break
    case 'extra-PCFG':
      const extraPCFG = new PCFG([], true)
      const pcfgStructures = await redisClient.zrevrange(`crackflow-${process.env.NODE_ENV}:extra-pcfg:probability`, 0, -1)
      pwds = _.uniq(extraPCFG.fillUserInfo(
        userFeature,
        pcfgStructures,
        parseInt(process.env.LIMIT!)
      )).slice(0, 100)
      break
    case 'extra-Markov':
      const extraMarkov = new Markov([], true, true, 3, true)
      const markovStructures = await redisClient.zrevrange(`crackflow-${process.env.NODE_ENV}:extra-markov:probability`, 0, -1)
      pwds = _.uniq(extraMarkov.fillUserInfo(
        userFeature,
        markovStructures,
        parseInt(process.env.LIMIT!)
      )).slice(0, 100)
      break
    case 'markov-PCFG':
      const markovPCFG = new MarkovPCFG(3)
      const markovPCFGStructures = await redisClient.zrevrange(`crackflow-${process.env.NODE_ENV}:markov-pcfg:probability`, 0, -1)
      pwds = _.uniq(markovPCFG.fillUserInfo(
        userFeature,
        markovPCFGStructures,
        parseInt(process.env.LIMIT!)
      )).slice(0, 100)
      break
    default:
  }
  console.log(pwds)  
  const fd = fs.openSync(path.join(__dirname, '../../..', 'pwds.txt'), 'w+')
  fs.writeSync(fd, `[${trainAlgorithm}] \n`)
  for (const pwd of pwds) {
    fs.writeSync(fd, pwd + '\n')
  }
  fs.closeSync(fd)
}

getFeatureAndGeneratePwd().then(() => {
  process.exit(0)
}).catch(err => {
  process.exit(1)
})
