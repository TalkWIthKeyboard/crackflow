# Crackflow
> The framework of works about cracking password.

## Algorithm
对于算法，抽象了三个大步骤，`Basic` 基类也分别暴露了三个 `pulic` 方法来进行实现：

+ **Train：** 通过用户信息和密码对模型进行训练
+ **PasswordGenerate：** 通过模型对基础密码结构进行生成
+ **FillUserInfo：** 使用用户信息对密码结构进行填补

该项目主要实现了三个算法，与经典算法的区别是将用户信息加入了算法当中。

### PCFG
> [算法实现的具体介绍](./detail-readme/extra-PCFG-readme.md)

该项目完成了 `basic` 和 `extra` 两种模式的 `PCFG`。`basic` 与经典的 `PCFG` 算法一致，提供了 `数字 -> A`、 `小写字母 -> B`、 `大写字母 -> C`、 `特殊符号 -> D` 这样4种模式变换。训练模型的过程中，进行了口令到 `PCFG` 结构的变化和结构的计数，并且对同种模式的连续同类型片段也进行了统计。在口令生成环节，以出现概率降序的次序遍历结构，使用同种模式的连续同类型片段进行结构中模式的填补。

```
                 pwd:  sw1234HELLO!1234!
     PCFG Structures:  B2A4C5D1A4D1
fragmet（对同类型片段的统计）:  同类型片段所属模式 -> 同类型片段字符串, 出现次数
                            B2 -> sw, 1     
                            A4 -> 1234, 2
                            D1 -> !, 2
                            C5 -> HELLO, 1
```

而特殊实现的是 `extra` 模式，在这个模式下，会在字符串中识别用户信息，进行预先设置好的模式变换，**特别的是无论这个用户信息有多长，都会默认这个这个模式的长度为1**。在口令生成环节，以出现概率降序的次序遍历结构，使用同种模式的连续同类型片段进行结构中普通模式的填补，之后再使用用户对应的信息填补 `extra` 部分。

```
// 用户信息
userInfo: {
  mobile: 15317225541,
  namePinYin: songwei,
}

// 用户信息的转换规则
mobile -> E
namePinYin -> F



pwd:                    songweiabc153172255411234!
basic PCFG Structures:  B10A15D1
              fragmet:  B10 -> songweiabc, 1
                        A15 -> 153172255411234, 1
                        D1  -> !, 1

extra PCFG Structures:  F1B3E1A4D1
              fragmet:  B3 -> abc, 1
                        A4 -> 1234, 1
                        D1 -> 1, 1
```

`PCFG` 对应了项目中的 `PCFG` 类，使用起来很简便：

```Typescript
import PCFG from '../src/algorithm/PCFG'

async function basicPcfgTest(pwds) {
  const pcfg = new PCFG(pwds, false)
  pcfg.train()
  await pcfg.passwordGenerate()
}

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

而特殊实现的是 `extra` 模式，会优先将用户信息转换为特殊的单元，例如一个2阶的 `Markov-chain` 的转移：

```
// 用户信息
userInfo: {
  mobile: 15317225541,
  namePinYin: songwei,
}

pwd:                    songweiabc
basic Markov Transfer:  [son, on -> g, ng -> w, gw -> e, we -> i, ei -> a, ia -> b, ab -> c]

extra Markov Transfer:  [「namePinYin」ab, ab -> c]
```

在口令生成环节，会先通过常规的 `Markov-chain` 生成步骤，生成含有用户信息特殊标记的结构，再使用用户信息对结构中的特殊标记进行替换。和 `PCFG` 类一样， `Markov` 类的使用也很简单：

```Typescript
import Markov from '../src/algorithm/Markov'

async function basicMarkovTest(pwds) {
  const markov = new Markov(pwds, true, 3, false)
  markov.train()
  await markov.passwordGenerate()
}

async function extraMarkovTest(userInfo) {
  const markov = new Markov(userInfo, true, 3, true)
  markov.train()
  await markov.passwordGenerate()
  const pwds = await markov.fillUserInfo(userInfo[0].userInfo, 10)
}
```

### Markov-PCFG

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
+ `pwds: PwdCount[]` : 用来训练的密码和用户信息，需要遵守该接口规范

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
+ `pwds: PwdCount[]` : 用来训练的密码和用户信息，需要遵守该接口规范

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
由于在训练中会使用多进程并且避免 `node` 对新老生代内存以及堆栈和字符串长度等多个限制，中间的多个结果会保存在 `Redis` 中。所以为了进一步对效率的考虑，多个普通的存储过程都以异步的形式来实现。

下面会列出所有的算法中会使用到的 `Redis-key`：

+ `crackflow-${process.env.NODE_ENV}:pcfg:count`
  + 用于保存 `PCFG` 模式变幻结构，以及该结构的出现次数
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
  + `sortedset`  记录 word -> any 的转移概率

+ `crackflow-${process.env.NODE_ENV}:markov:begin`
  + 用于保存 `Markov` 算法的起始词，以及该词的出现次数
  + `sortedset`  { word: count }

+ `crackflow-${process.env.NODE_ENV}:pcfg:{{type}}:{{number}}`
  + 用户保存 `PCFG` 算法的同类型片段串，以及该串的出现次数 
  + `sortedset` { fragmet: count }
