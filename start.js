const shelljs = require('shelljs')
const argv = require('yargs')
              .alias('t', 'task')
              .alias('d', 'dataset')
              .alias('l', 'limit')
              .alias('a', 'algorithm')
              .default({
                't': 'train',
                'd': 't12306',
                'l': '450000',
                'a': 'markov-PCFG'
              })
              .argv

const execShell = `npm run clean && npm run compile && ALGORITHM={{ALGORITHM}} NODE_ENV={{DATASET}} LIMIT={{LIMIT}} DEBUG=crackflow:* node --max-old-space-size=8192 {{FILEPATH}}`

const execScriptFileMap = {
  train: 'dist/src/flow/train.js',
  clean: 'dist/src/flow/clean.js',
  statistic: 'dist/src/statistic/index.js',
  generate: 'dist/src/flow/generate.js',
  crack: 'dist/src/flow/crack.js',
  show: 'dist/src/flow/show.js'
}

const paramsLimit = {
  task: ['train', 'clean', 'statistic', 'generate', 'crack', 'show'],
  dataset: ['t12306', 'tianya', '7k7k', 'phpbb', 'rock'],
  algorithm: ['PCFG', 'Markov', 'extra-PCFG', 'extra-Markov', 'markov-PCFG'],
}

function paramsCheckAndExec() {
  if (!paramsLimit.task.includes(argv.t)) {
    console.log('It is error with task in params.')
    return
  }
  if (!paramsLimit.dataset.includes(argv.d)) {
    console.log('It is error with dataset in params.')
    return
  }
  if (!paramsLimit.algorithm.includes(argv.a)) {
    console.log('It is error with algorithm in params.')
    return
  }
  if (!/[0-9]*/.test(argv.l)) {
    console.log('It is error with limit in params.')
    return
  }

  shelljs.exec(
    execShell
      .replace(/{{DATASET}}/, argv.d)
      .replace(/{{LIMIT}}/, argv.l)
      .replace(/{{FILEPATH}}/, execScriptFileMap[argv.t])
      .replace(/{{ALGORITHM}}/, argv.a)
  )
}

paramsCheckAndExec()
