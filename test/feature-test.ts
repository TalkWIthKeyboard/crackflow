import test from 'ava'
import * as _ from 'lodash'

import worker from '../src/feature/row-feature-worker'
import ParserWithUserInfo from '../src/feature/parser/parser-with-user-info'

test('Username clean test', t => {
  t.is(worker.username.clean('abcdefg'), 'abcdefg')
  t.is(worker.username.clean('????'), null)
  t.is(worker.username.clean('  abcdefg'), 'abcdefg')
  t.is(worker.username.clean('哈哈哈哈'), null)
  t.is(worker.username.clean('¡¯ŸoÙ‡©a'), null)
  t.is(worker.username.clean('.'), null)
})

test('Password clean test', t => {
  t.is(worker.password.clean('abcdefg'), 'abcdefg')
  t.is(worker.password.clean('  abcdefg'), 'abcdefg')
  t.is(worker.password.clean('哈哈哈哈'), null)
  t.is(worker.password.clean('abcdefgabcdefgabcdefgabcdefgabcdefgabcdefgabcdefg'), null)
})

test('Email clean test', t => {
  t.is(worker.email.clean('abcdefg'), null)
  t.is(worker.email.clean('610347922@qq.com'), '610347922@qq.com')
  t.is(worker.email.clean('test@163.com.cn'), 'test@163.com.cn')
  t.is(worker.email.clean('!!!!#123456@qq.com'), '123456@qq.com')
  t.is(worker.email.clean(',.,.,.,.,.,.2114@qq.com'), '2114@qq.com')
  t.is(worker.email.clean('abcdef@g@qq.com'), null)
})

test('Name clean test', t => {
  t.is(worker.name.clean('宋伟'), '宋伟')
  t.is(worker.name.clean('哈哈哈哈哈哈'), null)
  t.is(worker.name.clean('abcd小明231'), '小明')
  t.is(worker.name.clean('Wei song'), null)
  t.is(worker.name.clean(' --雷祖宝'), '雷祖宝')
})

test('Ctfid clean test', t => {
  t.is(worker.ctfid.clean('H0314867003'), null)
  t.is(worker.ctfid.clean('37032219870411671X'), '37032219870411671X')
  t.is(worker.ctfid.clean('230302198102125831'), '230302198102125831')
  t.is(worker.ctfid.clean('430304199204022'), '430304199204022')
  t.is(worker.ctfid.clean('370322198704116!1X'), null)
  t.is(worker.ctfid.clean('  !430304199204022. '), '430304199204022')
})

test('Mobile clean test', t => {
  t.is(worker.mobile.clean('09064168860'), null)
  t.is(worker.mobile.clean('17621452151'), '17621452151')
  t.is(worker.mobile.clean('1762145215!'), null)
  t.is(worker.mobile.clean('19941678167'), '19941678167')
  t.is(worker.mobile.clean('   :19941678167] '), '19941678167')
})

const mockData = {
  mobile: [{
    row: '17621452151',
    mobileLastFour: '2151',
    mobileLastFive: '52151',
    mobileLastSix: '452151',
    mobileTotle: '17621452151',
  }],
  ctfid: [{
    row: '230302198102125831',
    birthdayEight: '19810212',
    birthdaySix: '810212',
    birthdayFour: '0212',
    ctfIdLastFour: '5831',
    ctfIdLastFive: '25831',
    ctfIdLastSix: '125831',
  }, {
    row: '370322870411671',
    birthdayEight: '19870411',
    birthdaySix: '870411',
    birthdayFour: '0411',
    ctfIdLastFour: '1671',
    ctfIdLastFive: '11671',
    ctfIdLastSix: '411671',
  }],
  username: [{
    row: 'songwei7677coder3408',
    usernameNumberFragmet: ['7677', '3408'],
    usernameStringFragmet: ['songwei', 'coder'],
  }],
  email: [{
    row: 'swcoder7677huhu@163.com',
    emailNumberFragmet: ['7677'],
    emailStringFragmet: ['swcoder', 'huhu'],
  }, {
    row: '610347922@qq.com',
    emailNumberFragmet: ['610347922'],
    emailStringFragmet: [],
  }],
  name: [{
    row: '宋伟',
    namePinyin: 'songwei',
    namePinyinFirstLetter: 'sw',
  }],
}

test('All kinds of parsers test', t => {
  _.forEach(mockData, (datas, name) => {
    _.each(datas, d => {
      const result = worker[name].parser((d as any).row)
      t.deepEqual(result, _.omit(d as any, ['row']))
    })
  })
})
