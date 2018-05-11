import test from 'ava'
import * as _ from 'lodash'

import ExtendPCFG from '../src/algorithm/extend-PCFG'
import redisClient from '../src/modules/redis-client'
import Markov from '../src/algorithm/extend-markov'
import { parserZrevrange as zrevrange } from '../src/utils'

const REDIS_PWD_COUNT_KEY = 'crackflow-test:EXTEND:pcfg:probability'
const REDIS_PCFG_COUNT_KEY = 'crackflow-test:EXTEND:pcfg:count'
const REDIS_FRAGMET_COUNT_KEY = 'crackflow-test:EXTEND:pcfg:*'
const REDIS_TRANSFER_PROBABILITY_KEY = 'crackflow-test:markov:*'
const REDIS_BEGIN_KEY = 'crackflow-test:markov:begin'
const REDIS_PWD_PROBABILITY_KEY = 'crackflow-test:markov:probability'

const mockPwds = [{
  code: 'z6837605',
  userInfo:
    {
      usernameNumberFragmet: ['6837605'],
      usernameStringFragmet: [],
      emailNumberFragmet: ['274667266'],
      emailStringFragmet: [],
      namePinyin: 'zhengyifeng',
      namePinyinFirstLetter: 'zyf',
      birthdayEight: '19870504',
      birthdaySix: '870504',
      birthdayFour: '0504',
      ctfIdLastFour: '0011',
      ctfIdLastFive: '40011',
      ctfIdLastSix: '040011', mobileLastFour: '0664', mobileLastFive: '60664',
      mobileLastSix: '860664',
      mobileTotle: '15068860664',
    },
  count: 1,
},
{
  code: 'chitang520',
    userInfo: {
      usernameNumberFragmet: ['512'],
      usernameStringFragmet: ['tianxia'],
      emailNumberFragmet: [],
      emailStringFragmet: ['zaistar'],
      namePinyin: 'chishanqing',
      namePinyinFirstLetter: 'csq',
      birthdayEight: '19790906',
      birthdaySix: '790906',
      birthdayFour: '0906',
      ctfIdLastFour: '301X',
      ctfIdLastFive: '6301X',
      ctfIdLastSix: '06301X', mobileLastFour: '3289',
      mobileLastFive: '13289', mobileLastSix: '013289',
      mobileTotle: '18105013289',
    },
    count: 1,
  },
  {
    code: 'wzj871126',
    userInfo:
      {
        usernameNumberFragmet: ['27713'],
        usernameStringFragmet: ['wzj'],
        emailNumberFragmet: ['55'],
        emailStringFragmet: ['weizhongjie'],
        namePinyin: 'weizhongjie',
        namePinyinFirstLetter: 'wzj',
        birthdayEight: '19871126',
        birthdaySix: '871126',
        birthdayFour: '1126',
        ctfIdLastFour: '0513',
        ctfIdLastFive: '60513',
        ctfIdLastSix: '260513',
        mobileLastFour: '4000',
        mobileLastFive: '34000',
        mobileLastSix: '734000',
        mobileTotle: '18707734000',
      },
    count: 1,
  },
  {
    code: 'xujsh2012',
    userInfo:
      {
        usernameNumberFragmet: ['19830307'],
        usernameStringFragmet: [],
        emailNumberFragmet: ['2004'],
        emailStringFragmet: ['xujsh'],
        namePinyin: 'xujiasheng',
        namePinyinFirstLetter: 'xjs',
        birthdayEight: '19830307',
        birthdaySix: '830307',
        birthdayFour: '0307',
        ctfIdLastFour: '2554',
        ctfIdLastFive: '72554',
        ctfIdLastSix: '072554',
        mobileLastFour: '3108',
        mobileLastFive: '13108',
        mobileLastSix: '513108',
        mobileTotle: '18225513108',
      },
    count: 1,
  },
  {
    code: 'lijingnan741',
    userInfo:
      {
        usernameNumberFragmet: ['793925564'],
        usernameStringFragmet: [],
        emailNumberFragmet: ['793925564'],
        emailStringFragmet: [],
        namePinyin: 'lijingnan',
        namePinyinFirstLetter: 'ljn',
        birthdayEight: '19930721',
        birthdaySix: '930721',
        birthdayFour: '0721',
        ctfIdLastFour: '0015',
        ctfIdLastFive: '10015',
        ctfIdLastSix: '210015',
        mobileLastFour: '5681',
        mobileLastFive: '05681',
        mobileLastSix: '105681',
        mobileTotle: '18024105681',
      },
    count: 1,
  },
  {
    code: 'chenkan588',
    userInfo:
      {
        usernameNumberFragmet: [],
        usernameStringFragmet: ['chengkang'],
        emailNumberFragmet: ['588'],
        emailStringFragmet: ['chenkan'],
        namePinyin: 'chenkan',
        namePinyinFirstLetter: 'ck',
        birthdayEight: '19830627',
        birthdaySix: '830627',
        birthdayFour: '0627',
        ctfIdLastFour: '0039',
        ctfIdLastFive: '70039',
        ctfIdLastSix: '270039',
        mobileLastFour: '8023',
        mobileLastFive: '88023',
        mobileLastSix: '288023',
        mobileTotle: '18258288023',
      },
    count: 1,
  },
  {
    code: 'kangjie109',
    userInfo:
      {
        usernameNumberFragmet: ['159648'],
        usernameStringFragmet: ['sl'],
        emailNumberFragmet: ['109'],
        emailStringFragmet: ['kangjie'],
        namePinyin: 'kanghuanhui',
        namePinyinFirstLetter: 'khh',
        birthdayEight: '19870613',
        birthdaySix: '870613',
        birthdayFour: '0613',
        ctfIdLastFour: '0038',
        ctfIdLastFive: '30038',
        ctfIdLastSix: '130038',
        mobileLastFour: '8430',
        mobileLastFive: '08430',
        mobileLastSix: '008430',
        mobileTotle: '13716008430',
      },
    count: 1,
  },
  {
    code: 'cp165147',
    userInfo:
      {
        usernameNumberFragmet: ['2135336'],
        usernameStringFragmet: ['a'],
        emailNumberFragmet: ['2135336'],
        emailStringFragmet: ['a'],
        namePinyin: 'chipeng',
        namePinyinFirstLetter: 'cp',
        birthdayEight: '19860121',
        birthdaySix: '860121',
        birthdayFour: '0121',
        ctfIdLastFour: '0014',
        ctfIdLastFive: '10014',
        ctfIdLastSix: '210014',
        mobileLastFour: '1462',
        mobileLastFive: '31462',
        mobileLastSix: '731462',
        mobileTotle: '18888731462',
      },
    count: 1,
  },
  {
    code: 'daqi1003',
    userInfo:
      {
        usernameNumberFragmet: [],
        usernameStringFragmet: ['liudaqi'],
        emailNumberFragmet: ['1003'],
        emailStringFragmet: ['daqi'],
        namePinyin: 'liudaqi',
        namePinyinFirstLetter: 'ldq',
        birthdayEight: '19850912',
        birthdaySix: '850912',
        birthdayFour: '0912',
        ctfIdLastFour: '1352',
        ctfIdLastFive: '21352',
        ctfIdLastSix: '121352',
        mobileLastFour: '6619',
        mobileLastFive: '96619',
        mobileLastSix: '596619',
        mobileTotle: '15810596619',
      },
    count: 1,
  },
  {
    code: 'xiaoxubisheng',
    userInfo:
      {
        usernameNumberFragmet: ['26549828'],
        usernameStringFragmet: ['a'],
        emailNumberFragmet: ['779860552'],
        emailStringFragmet: [],
        namePinyin: 'xuzihao',
        namePinyinFirstLetter: 'xzh',
        birthdayEight: '19950119',
        birthdaySix: '950119',
        birthdayFour: '0119',
        ctfIdLastFour: '1514',
        ctfIdLastFive: '91514',
        ctfIdLastSix: '191514',
        mobileLastFour: '0868',
        mobileLastFive: '10868',
        mobileLastSix: '110868',
        mobileTotle: '13132110868',
      },
    count: 1,
  },
  {
    code: 'tjl122106144',
    userInfo:
      {
        usernameNumberFragmet: ['19820515'],
        usernameStringFragmet: ['tjl'],
        emailNumberFragmet: ['122106144'],
        emailStringFragmet: [],
        namePinyin: 'tangshuang',
        namePinyinFirstLetter: 'ts',
        birthdayEight: '19940816',
        birthdaySix: '940816',
        birthdayFour: '0816',
        ctfIdLastFour: '1416',
        ctfIdLastFive: '61416',
        ctfIdLastSix: '161416',
        mobileLastFour: '9524',
        mobileLastFive: '39524',
        mobileLastSix: '639524',
        mobileTotle: '15031639524',
      },
    count: 1,
  },
  {
    code: 'sn11012137',
    userInfo:
      {
        usernameNumberFragmet: ['6331907'],
        usernameStringFragmet: ['sn'],
        emailNumberFragmet: ['01'],
        emailStringFragmet: ['alyce'],
        namePinyin: 'shennan',
        namePinyinFirstLetter: 'sn',
        birthdayEight: '19810914',
        birthdaySix: '810914',
        birthdayFour: '0914',
        ctfIdLastFour: '0335',
        ctfIdLastFive: '40335',
        ctfIdLastSix: '140335',
        mobileLastFour: '3214',
        mobileLastFive: '33214',
        mobileLastSix: '233214',
        mobileTotle: '13241233214',
      },
    count: 1,
  },
  {
    code: 'chiwuchizu',
    userInfo:
      {
        usernameNumberFragmet: ['19851103'],
        usernameStringFragmet: [],
        emailNumberFragmet: [],
        emailStringFragmet: ['chiwuchizu'],
        namePinyin: 'yanghao',
        namePinyinFirstLetter: 'yh',
        birthdayEight: '19851103',
        birthdaySix: '851103',
        birthdayFour: '1103',
        ctfIdLastFour: '3430',
        ctfIdLastFive: '33430',
        ctfIdLastSix: '033430',
        mobileLastFour: '0199',
        mobileLastFive: '00199',
        mobileLastSix: '900199',
        mobileTotle: '15070900199',
      },
    count: 1,
  },
  {
    code: 'anjing_thw',
    userInfo:
      {
        usernameNumberFragmet: ['160178'],
        usernameStringFragmet: ['THW'],
        emailNumberFragmet: [],
        emailStringFragmet: ['anjing_thw'],
        namePinyin: 'tanhongwang',
        namePinyinFirstLetter: 'thw',
        birthdayEight: '19851116',
        birthdaySix: '851116',
        birthdayFour: '1116',
        ctfIdLastFour: '3376',
        ctfIdLastFive: '63376',
        ctfIdLastSix: '163376',
        mobileLastFour: '6906',
        mobileLastFive: '76906',
        mobileLastSix: '776906',
        mobileTotle: '15871776906',
      },
    count: 1,
  },
  {
    code: 'swlangg',
    userInfo:
      {
        usernameNumberFragmet: ['6', '5', '4'],
        usernameStringFragmet: ['k', 'r', 'c', 'yd'],
        emailNumberFragmet: ['441536746'],
        emailStringFragmet: [],
        namePinyin: 'wanglei',
        namePinyinFirstLetter: 'wl',
        birthdayEight: '19880808',
        birthdaySix: '880808',
        birthdayFour: '0808',
        ctfIdLastFour: '6417',
        ctfIdLastFive: '86417',
        ctfIdLastSix: '086417',
        mobileLastFour: '4783',
        mobileLastFive: '14783',
        mobileLastSix: '814783',
        mobileTotle: '13625814783',
      },
    count: 1,
  },
  {
    code: 'momozq',
    userInfo:
      {
        usernameNumberFragmet: ['65627904'],
        usernameStringFragmet: [],
        emailNumberFragmet: [],
        emailStringFragmet: ['momozq'],
        namePinyin: 'zhangqing',
        namePinyinFirstLetter: 'zq',
        birthdayEight: '19850214',
        birthdaySix: '850214',
        birthdayFour: '0214',
        ctfIdLastFour: '201X',
        ctfIdLastFive: '4201X',
        ctfIdLastSix: '14201X',
        mobileLastFour: '9567',
        mobileLastFive: '49567',
        mobileLastSix: '149567',
        mobileTotle: '13402149567',
      },
    count: 1,
  },
  {
    code: 'jdnetyf',
    userInfo:
      {
        usernameNumberFragmet: ['7187856'],
        usernameStringFragmet: [],
        emailNumberFragmet: ['444587374'],
        emailStringFragmet: [],
        namePinyin: 'yufeng',
        namePinyinFirstLetter: 'yf',
        birthdayEight: '19830224',
        birthdaySix: '830224',
        birthdayFour: '0224',
        ctfIdLastFour: '041X',
        ctfIdLastFive: '4041X',
        ctfIdLastSix: '24041X',
        mobileLastFour: '4001',
        mobileLastFive: '54001',
        mobileLastSix: '354001',
        mobileTotle: '13905354001',
      },
    count: 1,
  },
  {
    code: 'chenming911030',
    userInfo:
      {
        usernameNumberFragmet: ['123'],
        usernameStringFragmet: ['chen'],
        emailNumberFragmet: ['444719203'],
        emailStringFragmet: [],
        namePinyin: 'chenming',
        namePinyinFirstLetter: 'cm',
        birthdayEight: '19911030',
        birthdaySix: '911030',
        birthdayFour: '1030',
        ctfIdLastFour: '5030',
        ctfIdLastFive: '05030',
        ctfIdLastSix: '305030',
        mobileLastFour: '3041',
        mobileLastFive: '03041',
        mobileLastSix: '603041',
        mobileTotle: '18570603041',
      },
    count: 1,
  },
  {
    code: 'yanyc8612',
    userInfo:
      {
        usernameNumberFragmet: ['1990'],
        usernameStringFragmet: ['yyc'],
        emailNumberFragmet: ['396608503'],
        emailStringFragmet: [],
        namePinyin: 'yanyichun',
        namePinyinFirstLetter: 'yyc',
        birthdayEight: '19900116',
        birthdaySix: '900116',
        birthdayFour: '0116',
        ctfIdLastFour: '0814',
        ctfIdLastFive: '60814',
        ctfIdLastSix: '160814',
        mobileLastFour: '3960',
        mobileLastFive: '53960',
        mobileLastSix: '453960',
        mobileTotle: '13733453960',
      },
    count: 1,
  },
  {
    code: 'dragonlyzq',
    userInfo:
      {
        usernameNumberFragmet: ['31219'],
        usernameStringFragmet: ['ilove'],
        emailNumberFragmet: ['253375011'],
        emailStringFragmet: [],
        namePinyin: 'liuyang',
        namePinyinFirstLetter: 'ly',
        birthdayEight: '19821130',
        birthdaySix: '821130',
        birthdayFour: '1130',
        ctfIdLastFour: '1517',
        ctfIdLastFive: '01517',
        ctfIdLastSix: '301517',
        mobileLastFour: '0656',
        mobileLastFive: '90656',
        mobileLastSix: '490656',
        mobileTotle: '13450490656',
      },
    count: 1,
  }]

const mockExtendsResult = [
  'K,J',
  '3',
  'K',
  '3',
  'B/7,A/3',
  '3',
  'M,A/6',
  '2',
  'L,A/3',
  '2',
  'K,A/4',
  '2',
  'K,A/3',
  '2',
  'B/7,J',
  '2',
  'B/7',
  '2',
  'B/5,A/4',
  '2',
  'B/10',
  '2',
]

const mockBasicResult = [
  'B/7,A/3',
  '3',
  'B/7',
  '2',
  'B/5,A/4',
  '2',
  'B/10',
  '2',
  'B/9,A/3',
  '1',
  'B/8,A/6',
  '1',
  'B/6,D/1,B/3',
  '1',
  'B/6',
  '1',
  'B/4,A/4',
  '1',
  'B/3,A/9',
  '1',
  'B/3,A/6',
  '1',
]

const mockGenerateResult = [
  { key: 'z6837605', value: 0.05 },
  { key: 'xiaoxubisheng', value: 0.05 },
  { key: 'dragonlyzq', value: 0.05 },
  { key: 'chiwuchizu', value: 0.05 },
  { key: 'sn11012137', value: 0.025 },
  { key: 'momozq', value: 0.025 },
  { key: 'cp11012137', value: 0.025 },
  { key: 'anjing', value: 0.025 },
  { key: 'swlangg', value: 0.020000000000000004 },
  { key: 'kangjie', value: 0.020000000000000004 },
  { key: 'jdnetyf', value: 0.020000000000000004 },
  { key: 'chitang', value: 0.020000000000000004 },
  { key: 'chenkan', value: 0.020000000000000004 },
  { key: 'yanyc8612', value: 0.016666666666666666 },
  { key: 'yanyc2012', value: 0.016666666666666666 },
  { key: 'yanyc1003', value: 0.016666666666666666 },
  { key: 'xujsh8612', value: 0.016666666666666666 },
  { key: 'xujsh2012', value: 0.016666666666666666 },
  { key: 'xujsh1003', value: 0.016666666666666666 },
  { key: 'wzj122106144', value: 0.016666666666666666 },
  { key: 'tjl122106144', value: 0.016666666666666666 },
  { key: 'thw122106144', value: 0.016666666666666666 },
  { key: 'daqi8612', value: 0.016666666666666666 },
  { key: 'daqi2012', value: 0.016666666666666666 },
  { key: 'daqi1003', value: 0.016666666666666666 },
  { key: 'chenming911030', value: 0.016666666666666666 },
  { key: 'chenming871126', value: 0.016666666666666666 },
  { key: 'chenming165147', value: 0.016666666666666666 },
  { key: 'lijingnan741', value: 0.0125 },
  { key: 'lijingnan588', value: 0.0125 },
  { key: 'lijingnan520', value: 0.0125 },
  { key: 'lijingnan109', value: 0.0125 },
  { key: 'sn911030', value: 0.008333333333333333 },
  { key: 'sn871126', value: 0.008333333333333333 },
  { key: 'sn165147', value: 0.008333333333333333 },
  { key: 'momozq_wzj', value: 0.008333333333333333 },
  { key: 'momozq_tjl', value: 0.008333333333333333 },
  { key: 'momozq_thw', value: 0.008333333333333333 },
  { key: 'cp911030', value: 0.008333333333333333 },
  { key: 'cp871126', value: 0.008333333333333333 },
  { key: 'cp165147', value: 0.008333333333333333 },
  { key: 'anjing_wzj', value: 0.008333333333333333 },
  { key: 'anjing_tjl', value: 0.008333333333333333 },
  { key: 'anjing_thw', value: 0.008333333333333333 },
  { key: 'swlangg741', value: 0.0075 },
  { key: 'swlangg588', value: 0.0075 },
  { key: 'swlangg520', value: 0.0075 },
  { key: 'swlangg109', value: 0.0075 },
  { key: 'kangjie741', value: 0.0075 },
  { key: 'kangjie588', value: 0.0075 },
  { key: 'kangjie520', value: 0.0075 },
  { key: 'kangjie109', value: 0.0075 },
  { key: 'jdnetyf741', value: 0.0075 },
  { key: 'jdnetyf588', value: 0.0075 },
  { key: 'jdnetyf520', value: 0.0075 },
  { key: 'jdnetyf109', value: 0.0075 },
  { key: 'chitang741', value: 0.0075 },
  { key: 'chitang588', value: 0.0075 },
  { key: 'chitang520', value: 0.0075 },
  { key: 'chitang109', value: 0.0075 },
  { key: 'chenkan741', value: 0.0075 },
  { key: 'chenkan588', value: 0.0075 },
  { key: 'chenkan520', value: 0.0075 },
  { key: 'chenkan109', value: 0.0075 },
  { key: 'wzj911030', value: 0.005555555555555555 },
  { key: 'wzj871126', value: 0.005555555555555555 },
  { key: 'wzj165147', value: 0.005555555555555555 },
  { key: 'tjl911030', value: 0.005555555555555555 },
  { key: 'tjl871126', value: 0.005555555555555555 },
  { key: 'tjl165147', value: 0.005555555555555555 },
  { key: 'thw911030', value: 0.005555555555555555 },
  { key: 'thw871126', value: 0.005555555555555555 },
  { key: 'thw165147', value: 0.005555555555555555 },
]

const mockExtendsGenerateResult = [
  { key: 'zyf11012137', value: 0.020833333333333332 },
  { key: 'zhengyifeng274667266', value: 0.020833333333333332 },
  { key: 'z6837605', value: 0.020833333333333332 },
  { key: 'xiaoxubisheng', value: 0.020833333333333332 },
  { key: 'dragonlyzq', value: 0.020833333333333332 },
  { key: 'chiwuchizu', value: 0.020833333333333332 },
  { key: 'zyf911030', value: 0.015625 },
  { key: 'zyf871126', value: 0.015625 },
  { key: 'zhengyifeng588', value: 0.015625 },
  { key: 'zyf165147', value: 0.010416666666666666 },
  { key: 'zhengyifeng741', value: 0.010416666666666666 },
  { key: 'zhengyifeng109', value: 0.010416666666666666 },
  { key: 'sn11012137', value: 0.010416666666666666 },
  { key: 'momozq_zyf', value: 0.010416666666666666 },
  { key: 'momozq', value: 0.010416666666666666 },
  { key: 'ming274667266', value: 0.010416666666666666 },
  { key: 'daqi274667266', value: 0.010416666666666666 },
  { key: 'cp11012137', value: 0.010416666666666666 },
  { key: 'anjing_zyf', value: 0.010416666666666666 },
  { key: 'anjing', value: 0.010416666666666666 },
  { key: 'yanyc2012', value: 0.008333333333333333 },
  { key: 'yanyc1003', value: 0.008333333333333333 },
  { key: 'xujsh2012', value: 0.008333333333333333 },
  { key: 'xujsh1003', value: 0.008333333333333333 },
  { key: 'swlangg274667266', value: 0.008333333333333333 },
  { key: 'swlangg', value: 0.008333333333333333 },
  { key: 'kangjie274667266', value: 0.008333333333333333 },
  { key: 'kangjie', value: 0.008333333333333333 },
  { key: 'jdnetyf274667266', value: 0.008333333333333333 },
  { key: 'jdnetyf', value: 0.008333333333333333 },
  { key: 'chitang274667266', value: 0.008333333333333333 },
  { key: 'chitang', value: 0.008333333333333333 },
  { key: 'chenkan274667266', value: 0.008333333333333333 },
  { key: 'chenkan', value: 0.008333333333333333 },
  { key: 'zhengyifeng911030', value: 0.0078125 },
  { key: 'zhengyifeng871126', value: 0.0078125 },
  { key: 'lijingnan588', value: 0.0078125 },
  { key: 'chenming911030', value: 0.0078125 },
  { key: 'chenming871126', value: 0.0078125 },
  { key: 'wzj274667266', value: 0.006944444444444444 },
  { key: 'wzj122106144', value: 0.006944444444444444 },
  { key: 'tjl274667266', value: 0.006944444444444444 },
  { key: 'tjl122106144', value: 0.006944444444444444 },
  { key: 'thw274667266', value: 0.006944444444444444 },
  { key: 'thw122106144', value: 0.006944444444444444 },
  { key: 'zhengyifeng520', value: 0.005208333333333333 },
  { key: 'zhengyifeng165147', value: 0.005208333333333333 },
  { key: 'lijingnan741', value: 0.005208333333333333 },
  { key: 'lijingnan109', value: 0.005208333333333333 },
  { key: 'chenming165147', value: 0.005208333333333333 },
  { key: 'swlangg588', value: 0.004687500000000001 },
  { key: 'kangjie588', value: 0.004687500000000001 },
  { key: 'jdnetyf588', value: 0.004687500000000001 },
  { key: 'chitang588', value: 0.004687500000000001 },
  { key: 'chenkan588', value: 0.004687500000000001 },
  { key: 'yanyc8612', value: 0.004166666666666667 },
  { key: 'xujsh8612', value: 0.004166666666666667 },
  { key: 'ming2012', value: 0.004166666666666667 },
  { key: 'ming1003', value: 0.004166666666666667 },
  { key: 'daqi2012', value: 0.004166666666666667 },
  { key: 'daqi1003', value: 0.004166666666666667 },
  { key: 'sn911030', value: 0.00390625 },
  { key: 'sn871126', value: 0.00390625 },
  { key: 'cp911030', value: 0.00390625 },
  { key: 'cp871126', value: 0.00390625 },
  { key: 'momozq_wzj', value: 0.003472222222222222 },
  { key: 'momozq_tjl', value: 0.003472222222222222 },
  { key: 'momozq_thw', value: 0.003472222222222222 },
  { key: 'anjing_wzj', value: 0.003472222222222222 },
  { key: 'anjing_tjl', value: 0.003472222222222222 },
  { key: 'anjing_thw', value: 0.003472222222222222 },
  { key: 'swlangg741', value: 0.003125 },
  { key: 'swlangg109', value: 0.003125 },
  { key: 'kangjie741', value: 0.003125 },
  { key: 'kangjie109', value: 0.003125 },
  { key: 'jdnetyf741', value: 0.003125 },
  { key: 'jdnetyf109', value: 0.003125 },
  { key: 'chitang741', value: 0.003125 },
  { key: 'chitang109', value: 0.003125 },
  { key: 'chenkan741', value: 0.003125 },
  { key: 'chenkan109', value: 0.003125 },
  { key: 'wzj911030', value: 0.0026041666666666665 },
  { key: 'wzj871126', value: 0.0026041666666666665 },
  { key: 'tjl911030', value: 0.0026041666666666665 },
  { key: 'tjl871126', value: 0.0026041666666666665 },
  { key: 'thw911030', value: 0.0026041666666666665 },
  { key: 'thw871126', value: 0.0026041666666666665 },
  { key: 'sn165147', value: 0.0026041666666666665 },
  { key: 'lijingnan520', value: 0.0026041666666666665 },
  { key: 'cp165147', value: 0.0026041666666666665 },
  { key: 'ming8612', value: 0.0020833333333333333 },
  { key: 'daqi8612', value: 0.0020833333333333333 },
  { key: 'wzj165147', value: 0.001736111111111111 },
  { key: 'tjl165147', value: 0.001736111111111111 },
  { key: 'thw165147', value: 0.001736111111111111 },
  { key: 'swlangg520', value: 0.0015625 },
  { key: 'kangjie520', value: 0.0015625 },
  { key: 'jdnetyf520', value: 0.0015625 },
  { key: 'chitang520', value: 0.0015625 },
  { key: 'chenkan520', value: 0.0015625 },
]

const mockMarkovTwoLevelTrainTop10 = [
  'zhengyifeng274667266~',
  'zhengyifeng741~',
  'zhengyifeng588~',
  'zyf165147~',
  'z6837605~',
  'chiwuchizu~',
  'z6837~',
  'cp165144~',
  'zhengyifeng910504~',
  'zyf870504~'
]

// 清空所有的 test 缓存
test.beforeEach(async () => {
  const removeKeys = _.flatten(await Promise.all([
    redisClient.keys(REDIS_TRANSFER_PROBABILITY_KEY),
    redisClient.keys(REDIS_FRAGMET_COUNT_KEY)
  ]))
  if (removeKeys.length > 0) {
    await redisClient.del(...removeKeys)
  }
})

test('Extends pcfg statistic', async t => {
  const pcfg = new ExtendPCFG(mockPwds)
  pcfg.basicPcfgWorker(false)
  const topTen = await redisClient.zrevrange(REDIS_PCFG_COUNT_KEY, 0, 10, 'WITHSCORES')
  t.deepEqual(mockExtendsResult, topTen)
})

test('Basic pcfg statistic', async t => {
  const pcfg = new ExtendPCFG(mockPwds)
  pcfg.basicPcfgWorker(true)
  const topTen = await redisClient.zrevrange(REDIS_PCFG_COUNT_KEY, 0, 10, 'WITHSCORES')
  t.deepEqual(mockBasicResult, topTen)
})

test('Basic password generate', async t => {
  const pcfg = new ExtendPCFG(mockPwds)
  pcfg.basicPcfgWorker(true)
  await pcfg.basicPasswordGenerator()
  const top = await zrevrange(REDIS_PWD_COUNT_KEY, 0, -1, 'WITHSCORES')
  let total = 0
  _.each(top, u => {
    total += u.value
  })
  t.is(1 - total < 0.000001, true)
  t.deepEqual(mockGenerateResult, top)
})

test('Extends password generate', async t => {
  const pcfg = new ExtendPCFG(mockPwds)
  pcfg.basicPcfgWorker(false)
  await pcfg.extendPasswordGenerator(mockPwds[0].userInfo)
  const topResult = await zrevrange(REDIS_PWD_COUNT_KEY, 0, -1, 'WITHSCORES')
  // extends 求和不一定等于1
  t.deepEqual(mockExtendsGenerateResult, topResult)
})

test('Extends markov train (endSymbol & userInfo)', async t => {
  const markov = new Markov(true, mockPwds, 2)
  markov.train(true)
  await markov.passwordGenerator()
  const top = await zrevrange(REDIS_PWD_PROBABILITY_KEY, 0, -1, 'WITHSCORES')
  const total = _.reduce(
    _.map(top, t => t.value), 
    (sum, n) => {
      return sum + n
    }, 
    0
  )
  t.is(1 - total < 0.00001, true)
})

test('Extends markov generate password (endSymbol & userInfo)', async t => {
  const markov = new Markov(true, mockPwds, 2)
  markov.train(true)
  await markov.passwordGenerator()
  const pwds = await markov.fillUserInfo(mockPwds[0].userInfo, 10)
  t.deepEqual(pwds, mockMarkovTwoLevelTrainTop10)
})

// 清空所有的 test 缓存
test.afterEach(async () => {
  const removeKeys = _.flatten(await Promise.all([
    redisClient.keys(REDIS_TRANSFER_PROBABILITY_KEY),
    redisClient.keys(REDIS_FRAGMET_COUNT_KEY)
  ]))
  if (removeKeys.length > 0) {
    await redisClient.del(...removeKeys)
  }
})
