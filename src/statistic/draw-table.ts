import * as echarts from 'node-echarts'
import * as _ from 'lodash'
import * as path from 'path'

const imageDirPath = path.join(__dirname, '..', '..', '..', 'image')

/**
 * 画合法数据的分布图
 * @param params
 */
export function drawLegalDataDistribute(statisticMap) {
  // COUNT 只作为统计指标，不画入图中
  const drawedData = _.omit(statisticMap, 'COUNT')
  const tableTotalList = _.map(drawedData, (value, key) => {
    return { name: key, value: value.totalCount }
  })
  const allName = _.keys(drawedData)
    .concat(_.flatten(_.map(_.keys(drawedData), key => {
      return [`${key}_合法`, `${key}_重复`, `${key}_非法`]
    })))
  const allData = _.flatten(_.map(drawedData, (value, key) => {
    return [{
      name: `${key}_合法`,
      value: value.legalCount,
    }, {
      name: `${key}_重复`,
        value: value.repetitionCount | 0,
    }, {
      name: `${key}_非法`,
        value: value.totalCount - value.legalCount - value.repetitionCount | 0,
    }]
  }))
  const tableName = _.keys(drawedData)
  const legalCount = _.map(drawedData, (value, key) => {
    const percentage = (value.legalPercentage * 100).toFixed(2)
    return { name: `${key} ${value.legalCount} ${percentage}%`, value: value.legalCount }
  })

  const option = {
    tooltip: {
      trigger: 'item',
      formatter: '{a} <br/>{b}: {c} ({d}%)',
    },
    legend: {
      orient: 'vertical',
      x: 'left',
      data: allName,
    },
    series: [
      {
        name: '数据分布饼图',
        type: 'pie',
        selectedMode: 'single',
        radius: [0, '30%'],
        label: {
          normal: {
            position: 'inner',
          },
        },
        labelLine: {
          normal: {
            show: false,
          },
        },
        data: tableTotalList,
      },
      {
        name: '数据分布',
        type: 'pie',
        radius: ['40%', '55%'],
        label: {
          normal: {
            formatter: '{hr|}\n  {b|{b}：}{c}  {per|{d}%}  ',
            backgroundColor: '#eee',
            borderColor: '#aaa',
            borderWidth: 1,
            borderRadius: 4,
            rich: {
              a: {
                color: '#999',
                lineHeight: 22,
                align: 'center',
              },
              hr: {
                borderColor: '#aaa',
                width: '100%',
                borderWidth: 0.5,
                height: 0,
              },
              b: {
                fontSize: 16,
                lineHeight: 33,
              },
              per: {
                color: '#eee',
                backgroundColor: '#334455',
                padding: [2, 4],
                borderRadius: 2,
              },
            },
          },
        },
        data: allData,
      },
    ],
  }

  const legalCountOption = {
    title: {
      text: '合法数据分布饼图',
      subtext: 'From crackflow',
      x: 'center',
    },
    tooltip: {
      trigger: 'item',
      formatter: '{a} <br/>{b} : {c} ({d}%)',
    },
    legend: {
      orient: 'vertical',
      left: 'left',
      data: tableName,
    },
    series: [
      {
        name: '访问来源',
        type: 'pie',
        radius: '55%',
        center: ['50%', '60%'],
        data: legalCount,
        itemStyle: {
          emphasis: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)',
          },
        },
      },
    ],
  }

  echarts({
    path: imageDirPath + '/all_data_distribute.png',
    option,
    width: 1000,
    height: 800,
  })

  echarts({
    path: imageDirPath + '/legal_data_distribute.png',
    option: legalCountOption,
    width: 1000,
    height: 600,
  })
}

/**
 * 画特征出现频率图标
 * @param statisticMap
 */
export function drawFeatureInclude(statisticMap) {
  // 取头峰大写和第一个字母
  const featureName = _.map(_.keys(statisticMap), name => {
    let matchList = name.match(/([A-Z])/g)
    if (!matchList) {
      matchList = []
    }
    return name[0].toLocaleUpperCase() + matchList.join('')
  })
  const frequencyPercentage = _.map(statisticMap, value => {
    return (value.percentage * 100).toFixed(2)
  })

  const option = {
    title: {
      text: '特征出现频率柱状图',
      subtext: 'From crackflow',
    },
    tooltip: {
      trigger: 'axis',
    },
    legend: {
      data: ['特征出现频率（百分之）'],
    },
    calculable: true,
    xAxis: [
      {
        type: 'category',
        data: featureName,
      },
    ],
    yAxis: [
      {
        type: 'value',
      },
    ],
    series: [
      {
        name: '特征出现频率（百分之）',
        type: 'bar',
        data: frequencyPercentage,
        markPoint: {
          data: [
            { type: 'max', name: '最大值' },
            { type: 'min', name: '最小值' },
          ],
        },
        markLine: {
          data: [
            { type: 'average', name: '平均值' },
          ],
        },
      },
    ],
  }

  echarts({
    path: imageDirPath + '/feature_include.png',
    option,
    width: 1000,
    height: 600,
  })
}

/**
 * 画密码出现次数 top 50 的图
 * @param params
 */
export function drawPasswordAppearCount(top: number, statisticMap, text: string, fsName: string) {
  const pwds = _.map(statisticMap, u => u.key)
  const numcount = _.map(statisticMap, u => u.value)

  const seriesLabel = {
    normal: {
      show: true,
      textBorderColor: '#333',
      textBorderWidth: 1,
    },
  }

  const option = {
    title: {
      text: top === 100 || top === 50 ? `${text}（TOP${top}）` : text,
    },
    legend: {
      data: [text],
    },
    grid: {
      left: 100,
    },
    xAxis: {
      type: 'value',
      name: '次数百分比',
      axisLabel: {
        formatter: function(val) {
          return val + '%';
        },
      },
    },
    yAxis: {
      inverse: true,
      data: pwds,
      axisLabel: {
        margin: 20,
      },
    },
    series: [
      {
        name: text,
        type: 'bar',
        label: seriesLabel,
        data: numcount,
      },
    ],
  }

  echarts({
    path: imageDirPath + `/${fsName}.png`,
    option,
    width: 800,
    height: 1000,
  })
}

/**
 * 画口令的规律分布图（线图）
 * @param statisticMap
 * @param text
 * @param fsName
 */
export function drawPasswordFeatureDistrubute(statisticMap, text: string, fsName: string) {
  const pwds = _.map(statisticMap, u => u.key)
  const numcount = _.map(statisticMap, u => u.value)

  const option = {
    title: {
      text,
    },
    tooltip: {
      trigger: 'axis',
    },
    legend: {
      data: [text],
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      name: text.includes('长度') ? '长度' : '字符',
      data: pwds,
    },
    yAxis: {
      axisLabel: {
        formatter: function (val) {
          return val + '%';
        },
      },
    },
    series: [
      {
        name: text,
        type: 'line',
        stack: '总量',
        data: numcount,
      },
    ],
  }

  echarts({
    path: imageDirPath + `/${fsName}.png`,
    option,
    width: 800,
    height: 800,
  })
}
