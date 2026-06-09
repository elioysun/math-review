# Vue3 极简错题复习 Web 需求文档

## 1. 项目目标

创建一个本地使用的极简错题复习 Web。

核心流程只有三步：

1. 当天记录题号。
2. 隔天自动进入复习列表。
3. 复习时只选择「做对」或「做错」。

复习频率面向 2026 年 12 月底研究生考试：用简单可解释的错题加权间隔复习，避免“做对 2 次就归档”导致的过早退出。

不要做复杂知识库、AI 总结、富文本编辑、卡片系统、考试调度、文件夹同步等功能。

目标是替代 RemNote 中过于复杂的错题提醒流程。

------

## 2. 技术栈要求

使用：

- Vue 3
- Vite
- TypeScript
- Pinia
- Vue Router
- localStorage 持久化

暂时不要接后端。

项目应能通过以下命令运行：

```bash
pnpm install
pnpm dev
```

------

## 3. 页面结构

只需要 3 个页面。

### 3.1 今日记录页 `/`

用于当天快速录入题号。

功能：

- 输入题号
- 选择科目
- 选择章节
- 可选备注
- 点击「添加」
- 添加后清空输入框
- 显示今天已经添加的题目

字段：

```ts
subject: string
chapter: string
problemId: string
note?: string
createdAt: string
dueAt: string
status: 'active' | 'archived'
wrongCount: number
rightCount: number
reviewStage: number
```

添加新题时：

```ts
createdAt = 今天
dueAt = 明天
wrongCount = 0
rightCount = 0
reviewStage = 0
status = 'active'
```

------

### 3.2 今日复习页 `/review`

显示今天及以前到期的题目。

筛选条件：

```ts
status === 'active' && dueAt <= 今天
```

每道题只显示：

- 科目
- 章节
- 题号
- 备注
- 错误次数
- 连续做对次数
- 当前复习阶段
- 下次复习日期

操作按钮只有两个：

- 做对
- 做错

规则：

#### 做对

```ts
rightCount += 1
reviewStage += 1
```

如果 `reviewStage > baseIntervals.length`，说明题目已经通过 90 天阶段复习，则归档：

```ts
status = 'archived'
```

否则按复习阶段和错误权重计算下次复习时间：

```ts
dueAt = 今天 + 加权后的阶段间隔
```

#### 做错

```ts
wrongCount += 1
rightCount = 0
reviewStage = Math.max(0, reviewStage - 1)
dueAt = 明天
```

也就是说，做错后第二天再复习，并且降低一个复习阶段。

------

### 3.3 题目列表页 `/problems`

显示所有题目。

支持：

- 按科目筛选
- 按章节筛选
- 按状态筛选：全部 / 待复习 / 已归档
- 删除题目
- 手动恢复归档题目

不要做复杂搜索，简单够用即可。

------

## 4. 复习算法

使用固定阶梯 + 错题加权算法。

设计依据：

- 数学练习应分散到多个日期，而不是同一天集中刷同类题。Rohrer & Taylor (2006) 的数学学习实验显示，同样数量的练习题分散到两次、间隔 1 周完成，比同一天集中完成更有利于 4 周后的保持。
- 数学课堂研究也支持这一点。Emeny, Hartwig & Rohrer (2021) 发现，把数学练习分成 3 次、每次间隔 1 周，比集中练习带来更高的 1 个月后测试成绩，并减少学生对掌握程度的过度自信。
- 微积分课程中的间隔检索研究显示，分散练习可能让短期练习过程更吃力，但会带来更稳固的期末保持。
- Cepeda et al. (2008) 和 Carpenter et al. (2012) 的间隔学习研究提示：目标保持时间越长，复习间隔也应越长；如果目标是数月后的考试，应至少出现 7、14、30、60 天级别的复习间隔。

参考资料：

- Rohrer & Taylor (2006): <https://digitalcommons.usf.edu/psy_facpub/1770/>
- Emeny, Hartwig & Rohrer (2021): <https://eric.ed.gov/?id=EJ1301940>
- Lyle et al. (2022): <https://link.springer.com/article/10.1007/s10648-022-09677-2>
- Cepeda et al. (2008): <https://www.evullab.org/pdf/CepedaVulRohrerWixtedPashler-PS-2008.pdf>
- Carpenter et al. (2012): <https://digitalcommons.usf.edu/psy_facpub/1756/>

### 新题

当天添加，明天复习。

```ts
dueAt = tomorrow
reviewStage = 0
```

### 做错

明天复习，并降低一个复习阶段。

```ts
dueAt = tomorrow
rightCount = 0
wrongCount += 1
reviewStage = Math.max(0, reviewStage - 1)
```

### 做对

做对后进入下一个复习阶段。

```ts
rightCount += 1
reviewStage += 1
```

基础复习间隔：

```ts
const baseIntervals = [3, 7, 14, 30, 60, 90]
```

含义：

- 第 1 次做对：约 3 天后再做。
- 第 2 次做对：约 7 天后再做。
- 第 3 次做对：约 14 天后再做。
- 第 4 次做对：约 30 天后再做。
- 第 5 次做对：约 60 天后再做。
- 第 6 次做对：约 90 天后再做。
- 通过 90 天阶段后再次做对，才自动归档。

### 错题加权

累计错得越多，后续做对后的复习间隔越短。

```ts
function getWrongWeight(problem: Problem) {
  if (problem.wrongCount === 0) return 1
  if (problem.wrongCount === 1) return 0.8
  if (problem.wrongCount <= 3) return 0.6
  return 0.5
}
```

做对后的下次复习间隔：

```ts
rightCount += 1
reviewStage += 1

if (reviewStage > baseIntervals.length) {
  status = 'archived'
  return
}

const interval = baseIntervals[reviewStage - 1]
const weight = getWrongWeight(problem)
const weightedInterval = Math.max(1, Math.round(interval * weight))
dueAt = addDays(today, weightedInterval)
```

示例：

- 从未做错的题：3、7、14、30、60、90 天。
- 累计错 1 次的题：约 2、6、11、24、48、72 天。
- 累计错 2-3 次的题：约 2、4、8、18、36、54 天。
- 累计错 4 次及以上的题：约 2、4、7、15、30、45 天。

### 归档

归档规则：

```ts
if (reviewStage > baseIntervals.length) {
  status = 'archived'
}
```

含义：

- 归档表示“考研前低优先级掌握”，不是永久删除。
- 归档题目不再出现在今日复习页。
- 如果在全部题目页手动恢复归档题，继续使用原有 `wrongCount` 和 `reviewStage`。

------

## 5. 数据模型

创建文件：

```txt
src/types/problem.ts
```

内容：

```ts
export type ProblemStatus = 'active' | 'archived'

export interface Problem {
  id: string
  subject: string
  chapter: string
  problemId: string
  note?: string
  createdAt: string
  dueAt: string
  status: ProblemStatus
  wrongCount: number
  rightCount: number
  reviewStage: number
}
```

字段含义：

- `wrongCount`：累计做错次数，用于缩短后续间隔。
- `rightCount`：连续做对次数，做错后清零。
- `reviewStage`：复习阶段，从 0 开始；做对后加 1，做错后最多降 1 级。

------

## 6. Pinia Store

创建：

```txt
src/stores/problemStore.ts
```

需要提供：

```ts
problems: Problem[]

addProblem(input)
markRight(id)
markWrong(id)
deleteProblem(id)
archiveProblem(id)
restoreProblem(id)
getTodayProblems()
getDueProblems()
getArchivedProblems()
```

Store 内部需要提供：

```ts
getWrongWeight(problem)
getNextIntervalAfterRight(problem)
```

数据存储在 localStorage：

```ts
localStorage key = "simple-review-problems"
```

每次数据变化后自动保存。

页面刷新后自动恢复数据。

旧数据迁移：

- 如果 localStorage 中已有题目没有 `reviewStage`，加载时补：

```ts
reviewStage = 0
```

- 如果已有题目没有 `wrongCount` 或 `rightCount`，加载时补 0。

------

## 7. UI 要求

风格要求：

- 极简

- 快速

- 不要花哨动画

- 移动端和桌面端都能用

  

  导航只需要：

```txt
今日记录 | 今日复习 | 全部题目
```

首页重点是快速录入。

复习页重点是快速判断对错。

------

## 8. 默认科目

内置这些科目：

```ts
['高数', '线代', '概率论','英语']
```

------

## 9. 日期处理

不要使用复杂时间库。

用原生 Date 即可。

统一日期格式：

```ts
YYYY-MM-DD
```

需要工具函数：

```ts
getToday()
addDays(date, days)
isDue(dueAt)
```

放在：

```txt
src/utils/date.ts
```

------

## 10. 验收标准

完成后需要满足：

1. 可以添加一道题。
2. 新题默认明天复习。
3. 到了复习日期后出现在 `/review`。
4. 点击「做错」后，题目明天再次出现，并且 `reviewStage` 最多降低 1 级。
5. 从未做错的题点击「做对」后，后续间隔依次为 3、7、14、30、60、90 天。
6. 累计错 1 次的题，后续做对间隔按 80% 缩短。
7. 累计错 2-3 次的题，后续做对间隔按 60% 缩短。
8. 累计错 4 次及以上的题，后续做对间隔按 50% 缩短。
9. 所有加权间隔最短不少于 1 天。
10. 题目通过 90 天阶段后再次做对，才自动归档。
11. 归档题目不再出现在复习页。
12. 刷新页面后数据不丢失。
13. 旧 localStorage 数据没有 `reviewStage` 时，加载后自动补 `reviewStage = 0`。
14. 可以在全部题目页删除或恢复题目。
15. 代码结构清晰，方便后续扩展。

------

## 11. 不要实现的功能

明确不要做：

- 登录系统
- 后端数据库
- 云同步
- 富文本编辑器
- Markdown 编辑器
- AI 总结
- PDF 上传
- 图片题库
- 完整 SM-2 / FSRS / Anki 类复杂间隔重复算法
- 考试倒计时
- 标签系统
- 文件夹系统
- 复杂统计图表
- 复杂权限系统

先完成 MVP。

------

## 12. 目录结构建议

```txt
src/
  main.ts
  App.vue
  router/
    index.ts
  stores/
    problemStore.ts
  types/
    problem.ts
  utils/
    date.ts
  views/
    HomeView.vue
    ReviewView.vue
    ProblemsView.vue
  components/
    AppNav.vue
    ProblemCard.vue
```

------

## 13. 后续可扩展但暂不实现

可以预留代码结构，但不要现在实现：

- 导入导出 JSON
- 每日完成数量统计
- 错题次数排行榜
- 科目复习热力图
- 考前冲刺阶段临时提高复习密度
- PWA 手机桌面快捷方式
- 数据备份

当前版本只追求一个目标：

> 当天记题号，隔天提醒复习，做对就逐步拉长间隔，做错就明天继续并降低阶段。
