# crack-flow
> The framework of cracking password.

## Install

```
$ git clone https://github.com/TalkWIthKeyboard/crackflow
$ cd crackflow
$ npm install
```

## Usage

该项目抽象了口令猜测实验的多个步骤，主要涵盖了从原始数据到猜测口令这个过程中的各个环节。各个环节中的参数可以通过对 `crack-config.json` 的配置来进行修改，对特定用户生成口令阶段可以在 `user-info.json` 中来配置特定用户的个人信息。而各个环节之间是相互依赖的，需要注意先后顺序，并保持在同一个 `Redis` 环境下进行实验。项目中的环境参数由 `config` 进行管理，需要在根目录下新建 `config` 文件夹来统一存放配置文件。

整个项目的启动都集成在了 `start.js` 脚本当中，所以可以统一的使用 `NodeJS start.js` 来启动各个环节，其中 `-t` 参数用来区分每个环节。

### 清洗数据 & 提取特征
 + `-t`: parser
 + 清洗的数据源: `crack-config.json->train->sources`

### 训练模型
 + `-t`: train
 + 使用的数据源: `crack-config.json->train->sources`
 + 使用的模型: `crack-config.json->global->algorithms` 

### 生成半成熟口令
 + `-t`: generate 
 + `-d`: 使用某个数据源训练的模型来进行生成
 + `-l`: 限制生成半成熟口令的个数

### 命中实验
 + `-t`: crack
 + 目标数据源: `crack-config.json->crack->targets`
 + 基于用户信息的算法中每个用户生成的口令数量限制: `crack-config.json->crack->numberOfUser`
 + 非基于用户信息的算法中对生成总口令数量的限制: `crack-config.json->crack->totalOfGeneratePwds`

### 对特定用户生成口令
 + `-t`: show
 + `-d`: 使用某个数据源训练的模型来进行生成
 + `-l`: 基于用户信息的算法中每个用户生成的口令数量限制
 + 用户信息: `user-info.json`
 + 成功后会在根目录下新建 `pwds.txt` 文件对生成的口令进行展示

### 清除缓存
 + `-t`: clean
 + `-d`: 对某个数据源训练的模型进行清除

### 绘制统计图
 + `-t`: statistic
 + `-d`: 对某个数据源训练的模型进行统计绘制

## Algorithm
项目中实验了 `PCFG`、`Markov` 基础算法，重现了基于用户信息的 `extra-Markov` 算法，改进了基于用户信息的 `extra-PCFG` 算法，原创了基于用户信息的混合算法 `markov-PCFG` 算法。

并对于 `Markov` 系列的算法实现了可配置的标准化方法 `end-symbol`，以及按概率顺序生成口令的 `enumPwds` 方法。

对于算法，抽象了三个大步骤，`Basic` 基类也分别暴露了三个 `pulic` 方法来进行实现：

+ **Train：** 通过用户信息和口令对模型进行训练
+ **PasswordGenerate：** 通过模型对基础口令结构进行生成
+ **FillUserInfo：** 使用用户信息对口令结构进行填充

该项目主要实现了三个算法，与经典算法的区别是将用户信息加入了算法当中。

### PCFG
> [算法实现的具体介绍](./detail-readme/extra-PCFG-readme.md)

该项目完成了 `basic` 和 `extra` 两种模式的 `PCFG`。`basic` 与经典的 `PCFG` 算法一致，提供了 `数字 -> A`、 `小写字母 -> B`、 `大写字母 -> C`、 `特殊符号 -> D` 这样4种模式变换。训练模型的过程中，进行了口令到 `PCFG` 结构的变化和结构的计数，并且对同种模式的连续同类型片段也进行了统计。在口令生成环节，以出现概率降序的次序遍历结构，使用同种模式的连续同类型片段进行结构中模式的填充。

而特殊实现的是 `extra` 模式，在这个模式下，会在字符串中识别用户信息，分别对多处用户信息进行预先设置好的模式变换，**特别的是无论这个用户信息有多长，都会默认这个这个模式的长度为1**。在口令生成环节，以出现概率降序的次序遍历结构，使用同种模式的连续同类型片段进行结构中普通模式的填充生成半成熟口令，之后再使用用户对应的信息填充用户信息标记部分。

`PCFG` 对应了项目中的 `PCFG` 类，使用起来很简便：

```Typescript
import PCFG from '../src/algorithm/PCFG'

// 普通模式
async function basicPcfgTest(pwds) {
  const pcfg = new PCFG(pwds, false)
  pcfg.train()
  await pcfg.passwordGenerate()
}

// 基于用户信息模式
async function extraPcfgTest(userInfos) {
  const pcfg = new PCFG(userInfos, true)
  pcfg.train()
  await pcfg.passwordGenerate()
  const pwds = await pcfg.fillUserInfo(userInfos[0].userInfo, 20)
}
```

### Markov
> [算法实现的具体介绍](./detail-readme/extra-Markov-readme.md)

该项目完成了 `basic` 和 `extra` 两种模式的 `Markov-chain`。 `basic` 模式与经典的 `Markov` 相同，在 `new` 一个 `Markov` 对象的时候可以指定阶数。生成口令的时候会按照出现概率降序枚举值。并且还实现了 `end-symbol` 标准化的算法，可以在初始化对象的时候设定。

而特殊实现的是 `extra` 模式，会优先将用户信息分别转换为特殊的单元。在口令生成环节，会先通过常规的 `Markov-chain` 生成步骤，生成含有用户信息特殊标记的半成熟口令，再使用用户信息对结构中的特殊标记进行替换。和 `PCFG` 类一样， `Markov` 类的使用也很简单：

```Typescript
import Markov from '../src/algorithm/Markov'

// 普通模式
async function basicMarkovTest(pwds) {
  const markov = new Markov(pwds, true, 3, false)
  markov.train()
  await markov.passwordGenerate()
}

// 基于用户信息模式
async function extraMarkovTest(userInfo) {
  const markov = new Markov(userInfo, true, 3, true)
  markov.train()
  await markov.passwordGenerate()
  const pwds = await markov.fillUserInfo(userInfo[0].userInfo, 10)
}
```

### Markov-PCFG
> [算法实现的具体介绍](./detail-readme/markov-PCFG-readme.md)

该项目在基于用户信息的 `Markov` 和 `PCFG` 算法的基础上设计了一种新的算法 `Markov-PCFG`。需要分别训练出 `Markov` 和 `PCFG` 两种模型以后，使用这种口令生成算法。该算法会以出现概率取出 `PCFG` 结构，再利用现有的 `Markov` 模型来对 `PCFG` 模型中的普通模式进行填充，最后使用用户信息对 `extra` 部分进行填充。

```TypeScript
import Markov-PCFG from '../src/algorithm/Markov-PCFG'

async function markovPcfgTest(userInfo) {
  const markov = new Markov(userInfo, false, 2)
  markov.train()
  const pcfg = new PCFG(true, userInfo)
  pcfg.train()
  const markovPCFG = new MarkovPCFG(markov.level)
  await markovPCFG.passwordGenerate()
  const pwds = await markovPCFG.fillUserInfo(userInfo, 10)
}
```

### API

#### PCFG
+ `pwds: PwdCount[]` : 用来训练的口令和用户信息，需要遵守该接口规范

  ```Typescript
  interface PwdCount {
    code: string
    count: number
    userInfo?: UserInfo
  }
  ```
+ `isIncludeUserInfo: boolean` : 是否启用 `extra` 模式，包含用户信息
+ `userInfoMarkovType: Object` : 用户信息到 `Markov` 标记的映射 **[有默认值]**
+ `userInfoUnusefulFeature: string[]`: 用户信息中没有用到的特征 **[有默认值]**
+ `basicType: Object` : 基础类型的模式转换规则 **[有默认值]**

#### Markov
+ `pwds: PwdCount[]` : 用来训练的口令和用户信息，需要遵守该接口规范

  ```Typescript
  interface PwdCount {
    code: string
    count: number
    userInfo?: UserInfo
  }
  ```

+ `isEndSymbol: boolean` : 是否启用 `end-symbol` 算法
+ `level: number` : `Markov-chain` 的阶数
+ `isIncludeUserInfo: boolean` : 是否启用 `extra` 模式，包含用户信息
+ `userInfoUnusefulFeature: string[]`: 用户信息中没有用到的特征 **[有默认值]**
+ `basicType: Object` : 基础类型的模式转换规则 **[有默认值]**

#### Markov-PCFG

+ `level: number` : `Markov-chain` 的阶数
+ `pcfgTypeToMarkovType: Object` : `PCFG` 模式标记到 `Markov` 标记的映射 **[有默认值]**
+ `userInfoUnusefulFeature: string[]`: 用户信息中没有用到的特征 **[有默认值]**
+ `basicType: Object` : 基础类型的模式转换规则 **[有默认值]**

### Store
由于在训练中会使用多进程并且避免 `NodeJS` 对新老生代内存以及堆栈和字符串长度等多个限制，中间的多个结果会保存在 `Redis` 中。所以为了进一步对效率的考虑，多个普通的存储过程都以异步的形式来实现。

下面会列出所有的算法中会使用到的 `Redis-key`：

+ `crackflow-${process.env.NODE_ENV}:pcfg:count`
  + 用于保存 `PCFG` 模式变换结构，以及该结构的出现次数
  + `sortedset` { structure: count }

+ `crackflow-${process.env.NODE_ENV}:markov-pcfg:probability`
  + 用于保存 `Markov-PCFG` 算法生成口令结构，以及该结构的概率
  + `sortedset` { pwd: probability }

+ `crackflow-${process.env.NODE_ENV}:markov:probability`
  + 用于保存 `Markov` 算法生成口令结构，以及该结构的概率 
  + `sortedset` { pwd: probability }

+ `crackflow-${process.env.NODE_ENV}:pcfg:probability`
  + 用于保存 `PCFG` 算法生成口令结构，以及该结构的概率 
  + `sortedset` { pwd: probability }

+ `crackflow-${process.env.NODE_ENV}:markov:probability:{{word}}`
  + 用于保存 `Markov` 算法的转移概率
  + `sortedset`  记录 `word -> char` 的转移概率

+ `crackflow-${process.env.NODE_ENV}:markov:fragment`
  + 用于保存 `Markov` 算法的起始词，以及该词的出现次数
  + `sortedset`  { word: count }

+ `crackflow-${process.env.NODE_ENV}:pcfg:{{type}}:{{number}}`
  + 用于保存 `PCFG` 算法的同类型片段，以及该片段的出现次数 
  + `sortedset` { fragmet: count }
