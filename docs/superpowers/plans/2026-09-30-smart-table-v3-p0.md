# SmartTable 3.0.0 · P0 实现计划(→ `3.0.0-beta.1`)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把设计规格里 **P0** 的全部内容(B1–B9、B11、B12、C1–C5、多列排序 API、`filterChips`、`toolbar.more`、触屏兜底、新 labels)落到 `src/`,发布前的最后一个提交是 `3.0.0-beta.1` 的版本号与 CHANGELOG。

**Architecture:** 库是「胶水层 `SmartTable.vue` + 纯 TS 内核(`filter.ts` / `useColumns.ts` / `useFilters.ts` / `useSmartTable.ts`)+ 几个小 SFC(`ColumnFilter` / `Toolbar` / `SearchForm` / `ColumnSettings`)」。本计划沿用这个分层:**新逻辑优先写成可在 node 环境单测的纯函数**(`sorts.ts` / `filterDraft.ts` / `filterChips.ts` / `searchCols.ts`),SFC 只做接线与渲染。每个默认行为变更(B 级)在**同一个提交里**翻转对应的特征测试。

**Tech Stack:** Vue 3.5、naive-ui 2.45.3(以本地 `node_modules/naive-ui` 为准)、TypeScript、vitest 3(jsdom 环境用文件头 `// @vitest-environment jsdom`)、`@vue/test-utils`、vue-tsc。**不新增任何依赖。**

**Spec:** `docs/smart-naive-table-spec.md`(现状规格,冲突时以它为准);决策过程见 `docs/smart-naive-table-design.md`;真实组件验证见其第 9 节与 `docs/spike/`。

**范围说明(重要)**:规格里 P1(模式 2 条件构造器 + 窄档抽屉、`#batch`、`fillHeight`、放大)与 P2(`cardOnNarrow`)**不在本计划内**,将各自另出计划(`…-v3-p1.md`、`…-v3-p2.md`),理由是它们彼此独立、都是可选属性、各自能产出可测试的软件。两处与规格的差异,本计划已处理:
1. 规格把「15 个 `FilterAction`」归在 P1(随模式 2),但 **B7 的列头多条件面板要用到这些操作符**,所以**操作符本身(纯逻辑)提前到本计划 Task 2**;模式 2 的 UI 仍是 P1。
2. **B10(模式 2 默认多一行 chips)随 P1 发布**:P0 里 `filterChips` 只是「显式开启才有」的新增(默认 `false`)。

## Global Constraints

- 库已发布到 npm(当前 `2.1.1`),消费方是别人的后台系统。本计划只产出 `3.0.0-beta.1` 的代码与版本号,**不执行 `npm publish`**(由用户手动 `npm publish --tag beta`)。
- **以 naive-ui 官方为准**:任何组件用法、属性名、主题变量,不凭记忆写,核对本地 `node_modules/naive-ui/es/**/*.d.ts`(已在本计划中核实的事实都写在对应 Task 里)。
- **不新增依赖**(vite / vue / naive-ui / vitest / @vue/test-utils / vue-tsc 已有)。
- **labels 在渲染期求值**(不在 `setup` 期解成字符串,否则切换语言失效);所有新增文案走 `src/labels.ts` 的英文默认 + `SmartTableLabels` 类型。
- **B 级默认变更**必须在 CHANGELOG 写「旧 → 新 + 回退方式」;**C2(`defaultSortOrder` 升级后突然生效)** 要显著标注。
- **测试纪律(用户的 CLAUDE.md)**:测试失败时**不要**改断言、加 `skip` 或放宽阈值来让它变绿,先定位原因。**唯一例外**是本计划明确标注「有意翻转」的特征测试——它们锁的是 2.1.1 的旧默认值,翻转必须与对应的 B 级变更在同一个提交里,并在提交说明里写明是有意的默认行为变更。
- **报告完成时给出实际跑过的命令和真实输出**,不要只说「通过」。
- 回复与提交说明用**中文**;代码、命令、路径、报错原文保持原样。
- 提交说明末尾加一行:`Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`。
- 分支:`feat/v3-p0`(从 `main` 切出)。**不要在 `main` 上直接提交。**
- 动 `src/` 之前没有测试覆盖的部分,先补回归测试(Task 1 已统一补)。
- 只读参考:`docs/spike/`(一次性验证代码,不随包发布,**不要改它们来「配合」实现**)。

## Review Focus

规格隐含、但没有任何任务的常规测试会覆盖、最容易咬到真实使用者的输入或状况(按可能性排序)。**每一条都在所属任务里有一个专门的测试步骤**:

1. **已存 `localStorage` 里密度是 `comfortable` 的老用户 + 宿主给了 `defaultDensity="compact"` + 没开密度按钮** → 必须是紧凑(否则宿主的「个人设置」对这些用户永远不生效,而他们又没有按钮可改)。(Task 5)
2. **宿主传 `pagination: { pageSize: 10 }`(或沿用旧的 `pageSizes`)时**,`simple` 分页里库自己画的「每页条数」选择器,选项里必须包含**当前值**(否则下拉显示成空白)。(Task 7)
3. **options 列的过滤值里带 `notEqual` / `isNull` / 「多条 equal 且」**:打开面板不能静默丢条件,点确认不能覆盖掉原条件(旧缺陷 C3,会丢数据)。(Task 10)
4. **吸收余量的那一列的边界**:隐藏最后一列(换前一列顶上)、只有一列、全部列都 `fixed`、拖的正好是最后一列。(Task 12)
5. **`toolbar.more` 传空数组 / 只有分隔线 / `toolbar: false`** 不渲染按钮;**chips 指向已被隐藏或已不存在的列**时,点击不能报错、× 仍能清掉那个条件。(Task 6、Task 11)

---

## File Structure

新建(均在 `src/`,除非注明):

| 文件 | 职责 | 由谁消费 |
|---|---|---|
| `sorts.ts` | 排序态的纯函数:`SorterInfo`、`collectSorters`、`orderByPriority`、`deriveInitSorts`、`normalizeSorterEvent`、`sortToParams` | `SmartTable.vue`、`useColumns.ts`(仅类型) |
| `filterDraft.ts` | 列头面板「草稿」的纯函数:`MAX_CONDITIONS`、`FilterDraft`、`blankDraft`、`draftFromValue`、`addCondition`、`removeCondition`、`setConditionAction`、`setConditionValue`、`setLogic`、`draftToValue` | `ColumnFilter.vue` |
| `ConditionRow.vue` | 面板里**一行**条件编辑器(操作符 + 值控件 + 删除) | `ColumnFilter.vue` |
| `filterChips.ts` | chips 的纯函数:`ChipItem`、`buildChips`、`removeChipCondition`、`countFitting`、`hasActiveDefaults` | `FilterChips.vue`、`SmartTable.vue` |
| `FilterChips.vue` | 已生效条件 chips 行(`NTag`,超一行折成 `+N`) | `SmartTable.vue` |
| `searchCols.ts` | `resolveCols`、`effectiveCollapsedRows`(C5) | `SearchForm.vue` |
| `cardStyle.ts` | `CARD_THEME_OVERRIDES`(B11) | `SmartTable.vue`、`SearchForm.vue` |

修改:`types.ts`、`filter.ts`、`labels.ts`、`config.ts`、`storage.ts`、`icons.ts`、`useColumns.ts`、`SmartTable.vue`、`ColumnFilter.vue`、`Toolbar.vue`、`SearchForm.vue`、`index.ts`。

测试(均在 `tests/`):新增 `baseline-2.1.1.test.ts`、`sorts.test.ts`、`filterDraft.test.ts`、`filterChips.test.ts`、`searchCols.test.ts`、`Toolbar.test.ts`;追加或修改 `filter.test.ts`、`useFilters.test.ts`、`useColumns.test.ts`、`SmartTable.test.ts`、`ColumnFilter.test.ts`、`config.test.ts`、`storage.test.ts`。

**全程用同一组命令验证**(每个 Task 结尾都要跑):

```bash
npm test
npm run typecheck
```

基线(2026-09-30 在 `main` 上实测):`Tests 126 passed (126)`,typecheck 无输出 = 通过。

---

### Task 0: 分支与基线

**Files:** 无(只做 git 与验证)。

**Interfaces:**
- Consumes: 无。
- Produces: 分支 `feat/v3-p0`;基线数字(126 个测试通过、typecheck 干净),后续每个 Task 都要对照它。

- [ ] **Step 1: 确认工作区干净并切分支**

Run:
```bash
git status --short src tests package.json
git checkout -b feat/v3-p0
```
Expected: 第一条命令无输出(`src/`、`tests/`、`package.json` 没有未提交改动;仓库里其它未跟踪文件如 `docs/`、`*.png` 与本计划无关,**不要**提交它们);第二条输出 `Switched to a new branch 'feat/v3-p0'`。

- [ ] **Step 2: 记录基线**

Run:
```bash
npm test
npm run typecheck
```
Expected: `Test Files  11 passed (11)`、`Tests  126 passed (126)`;typecheck 无报错输出。**如果不是这个数字,停下来先查原因,不要继续。**

- [ ] **Step 3: 不提交**(本 Task 没有代码改动)。

---

### Task 1: 特征测试 —— 锁住 2.1.1 要被翻转的默认行为

> 你的规则:没有测试覆盖先补回归测试再动手。这些测试**现在就应该全部通过**(它们描述的是 2.1.1);后面的 Task 翻转它们时,在同一提交里改断言。

**Files:**
- Create: `tests/baseline-2.1.1.test.ts`

**Interfaces:**
- Consumes: 现有的 `SmartTable.vue`、`Toolbar.vue`、`BUILTIN_DEFAULTS`(`config.ts`)、`saveState`(`storage.ts`)、`defaultLabels`(`labels.ts`)。
- Produces: 一组有 `[Bn]` / `[Cn]` 标记的测试,标记 = 哪个 Task 会翻转它。

- [ ] **Step 1: 写测试文件**

Create `tests/baseline-2.1.1.test.ts`:

```ts
// @vitest-environment jsdom
// 2.1.1 行为的「特征测试」:锁住后面要被有意翻转的默认值。
// 每条标题里的 [Bn] / [Cn] = 由哪个任务翻转。翻转时在同一个提交里改断言,
// 并在提交说明里写明这是有意的默认行为变更(见计划 Global Constraints)。
import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { NDataTable } from 'naive-ui'
import SmartTable from '../src/SmartTable.vue'
import Toolbar from '../src/Toolbar.vue'
import { BUILTIN_DEFAULTS } from '../src/config'
import { saveState } from '../src/storage'
import { defaultLabels } from '../src/labels'

const rows = [
  { id: 1, name: 'alice' },
  { id: 2, name: 'bob' },
]

afterEach(() => localStorage.clear())

describe('2.1.1 特征:内置默认值', () => {
  it('[B1][B2] 内置兜底:每页 [10,20,50]、密度 comfortable', () => {
    expect(BUILTIN_DEFAULTS.pageSizes).toEqual([10, 20, 50])
    expect(BUILTIN_DEFAULTS.density).toBe('comfortable')
  })
})

describe('2.1.1 特征:分页', () => {
  it('[B1][B4] 静态模式:默认每页 10、可选 [10,20,50]、带官方每页选择器、非 simple', () => {
    const wrapper = mount(SmartTable, { props: { columns: [{ key: 'name', title: 'Name' }], data: rows, rowKey: 'id' } })
    const p = wrapper.findComponent(NDataTable).props('pagination') as Record<string, unknown>
    expect(p.defaultPageSize).toBe(10)
    expect(p.pageSizes).toEqual([10, 20, 50])
    expect(p.showSizePicker).toBe(true)
    expect(p.simple).toBeUndefined()
    wrapper.unmount()
  })

  it('[B1] 远程模式:首次请求 pageSize = 10', async () => {
    const fetcher = vi.fn(async () => ({ items: rows, total: 2 }))
    const wrapper = mount(SmartTable, { props: { columns: [{ key: 'name', title: 'Name' }], fetcher, rowKey: 'id' } })
    await flushPromises()
    expect(fetcher).toHaveBeenCalledWith(expect.objectContaining({ page: 1, pageSize: 10 }))
    wrapper.unmount()
  })
})

describe('2.1.1 特征:密度', () => {
  it('[B2] 默认舒适(表格 size = medium);存过 compact 的用户读到 compact(small)', () => {
    const plain = mount(SmartTable, { props: { columns: [{ key: 'name', title: 'Name' }], data: rows, rowKey: 'id' } })
    expect(plain.findComponent(NDataTable).props('size')).toBe('medium')
    plain.unmount()

    saveState('baseline-density', 'compact', [{ key: 'name', show: true }])
    const stored = mount(SmartTable, {
      props: { columns: [{ key: 'name', title: 'Name' }], data: rows, rowKey: 'id', storageKey: 'baseline-density' },
    })
    expect(stored.findComponent(NDataTable).props('size')).toBe('small')
    stored.unmount()
  })
})

describe('2.1.1 特征:工具栏', () => {
  it('[B3] 默认同时有「刷新」与「密度」两个图标按钮', () => {
    const wrapper = mount(Toolbar, { props: { labels: defaultLabels, config: {}, density: 'comfortable' } })
    const html = wrapper.html()
    expect(html).toContain('aria-label="Refresh"')
    expect(html).toContain('aria-label="Density"')
    wrapper.unmount()
  })
})

describe('2.1.1 特征:排序', () => {
  const sortCols = [
    { key: 'a', title: 'A', sorter: true },
    { key: 'b', title: 'B', sorter: true },
  ]

  it('单列点击 → 远程参数 { sortField, sortOrder: asc|desc }(本行为在 3.0 保持不变)', async () => {
    const fetcher = vi.fn(async () => ({ items: rows, total: 2 }))
    const wrapper = mount(SmartTable, { props: { columns: sortCols, fetcher, rowKey: 'id' } })
    await flushPromises()
    const onSorter = wrapper.findComponent(NDataTable).props('onUpdate:sorter') as (s: unknown) => void
    onSorter({ columnKey: 'a', order: 'ascend', sorter: true })
    await flushPromises()
    expect(fetcher).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, sortField: 'a', sortOrder: 'asc' }))
    wrapper.unmount()
  })

  it('[C2] defaultSortOrder 被受控 sortOrder 盖掉:首次请求没有任何排序参数', async () => {
    const fetcher = vi.fn(async () => ({ items: rows, total: 2 }))
    const wrapper = mount(SmartTable, {
      props: { columns: [{ key: 'a', title: 'A', sorter: true, defaultSortOrder: 'descend' }], fetcher, rowKey: 'id' },
    })
    await flushPromises()
    const first = (fetcher.mock.calls[0] as unknown[])[0] as Record<string, unknown>
    expect(first).not.toHaveProperty('sortField')
    wrapper.unmount()
  })

  it('[C1] 多列排序被截成单列:只带第一列,没有 sorts', async () => {
    const fetcher = vi.fn(async () => ({ items: rows, total: 2 }))
    const multiCols = [
      { key: 'a', title: 'A', sorter: { compare: () => 0, multiple: 2 } },
      { key: 'b', title: 'B', sorter: { compare: () => 0, multiple: 1 } },
    ]
    const wrapper = mount(SmartTable, { props: { columns: multiCols, fetcher, rowKey: 'id' } })
    await flushPromises()
    const onSorter = wrapper.findComponent(NDataTable).props('onUpdate:sorter') as (s: unknown) => void
    onSorter([
      { columnKey: 'a', order: 'ascend', sorter: multiCols[0].sorter },
      { columnKey: 'b', order: 'descend', sorter: multiCols[1].sorter },
    ])
    await flushPromises()
    const last = (fetcher.mock.calls.at(-1) as unknown[])[0] as Record<string, unknown>
    expect(last).toMatchObject({ sortField: 'a', sortOrder: 'asc' })
    expect(last).not.toHaveProperty('sorts')
    wrapper.unmount()
  })
})
```

- [ ] **Step 2: 跑,确认全部通过(这是 2.1.1 的真实行为)**

Run: `npx vitest run tests/baseline-2.1.1.test.ts`
Expected: `Tests  8 passed (8)`。**若有失败,说明我对 2.1.1 行为的假设有误:先看失败信息,修测试里的假设(不是改源码),并把差异记到提交说明里。**

- [ ] **Step 3: 全量验证**

Run: `npm test && npm run typecheck`
Expected: `Tests  134 passed (134)`(126 + 8);typecheck 无输出。

- [ ] **Step 4: 提交**

```bash
git add tests/baseline-2.1.1.test.ts
git commit -m "test: 锁住 2.1.1 将被有意翻转的默认行为(B1/B2/B3/B4/C1/C2 的特征测试)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: 15 个操作符 + 无值算子(C4)

> 规格 §3 / 设计文档第 1 节。操作符扩到 15 个:新增 `isNull` `isNotNull` `like` `startsWith` `endsWith` `in` `notIn`。**语义(规格没写清,本任务定死,并在 CHANGELOG 写明)**:
> - `isNull`:单元格为空(`null` / `undefined` / 空白串 / 空数组);`0`、`false` 不算空。`isNotNull` 取反。二者**不需要值**。
> - `startsWith` / `endsWith`:忽略大小写的前缀 / 后缀匹配;单元格为 `null`/`undefined` → 不匹配。
> - `like`:SQL `LIKE`——`%` 任意长度、`_` 单个字符,**整串匹配、忽略大小写**,其余字符按字面量(`a.c` 不匹配 `abc`)。
> - `in` / `notIn`:值是**数组**,单元格与其中任一项 `equal`(沿用 `equal` 的跨类型与整天语义)即命中;`notIn` 取反;空单元格时 `notIn` 为真(与 `notEqual` 一致);值不是数组 → `in` 为假。

**Files:**
- Modify: `src/types.ts`(`FilterAction`、`SmartTableLabels`)
- Modify: `src/filter.ts`
- Modify: `src/labels.ts`
- Modify: `src/useColumns.ts`(`DEFAULT_ACTIONS`)
- Modify: `src/ColumnFilter.vue`(只把本地 `ACTION_LABEL_KEY` 换成从 `labels.ts` 引入,让 typecheck 通过)
- Test: `tests/filter.test.ts`(追加)、`tests/useFilters.test.ts`(改一处断言)、`tests/config.test.ts`(追加)

**Interfaces:**
- Produces(后续 Task 依赖,签名固定):
  - `filter.ts`:`NO_VALUE_ACTIONS: readonly FilterAction[]`;`isValuelessAction(action: FilterAction): boolean`;`type ActionValueKind = 'none' | 'array' | 'scalar'`;`actionValueKind(action: FilterAction): ActionValueKind`
  - `labels.ts`:`ACTION_LABEL_KEY: Record<FilterAction, keyof SmartTableLabels>`
  - `SmartTableLabels` 新增 8 个键:`filterIsNull` `filterIsNotNull` `filterLike` `filterStartsWith` `filterEndsWith` `filterIn` `filterNotIn` `filterNoValue`

- [ ] **Step 1: 写失败测试 —— 新操作符的求值**

在 `tests/filter.test.ts` 末尾追加(文件顶部 import 里补上 `actionValueKind`、`isValuelessAction`、`NO_VALUE_ACTIONS`):

先把 import 改成:
```ts
import {
  actionValueKind,
  activeConditions,
  applyFilters,
  defaultFilterSerializer,
  filterValueToOptions,
  isFilterActive,
  isValuelessAction,
  matchCondition,
  matchFilterValue,
  NO_VALUE_ACTIONS,
  optionsToFilterValue,
} from '../src/filter'
```

然后在文件末尾追加:
```ts
describe('新增 7 个操作符', () => {
  it('isNull / isNotNull:空值 = null / undefined / 空白串 / 空数组;0 与 false 不算空;不需要值', () => {
    for (const empty of [null, undefined, '', '   ', []]) {
      expect(matchCondition(cond('isNull', null), empty)).toBe(true)
      expect(matchCondition(cond('isNotNull', null), empty)).toBe(false)
    }
    for (const filled of [0, false, 'x', [1]]) {
      expect(matchCondition(cond('isNull', null), filled)).toBe(false)
      expect(matchCondition(cond('isNotNull', null), filled)).toBe(true)
    }
  })

  it('startsWith / endsWith:忽略大小写;空单元格不匹配', () => {
    expect(matchCondition(cond('startsWith', 'AL'), 'alice')).toBe(true)
    expect(matchCondition(cond('startsWith', 'ce'), 'alice')).toBe(false)
    expect(matchCondition(cond('endsWith', 'CE'), 'alice')).toBe(true)
    expect(matchCondition(cond('endsWith', 'al'), 'alice')).toBe(false)
    expect(matchCondition(cond('startsWith', 'a'), null)).toBe(false)
    expect(matchCondition(cond('endsWith', 'a'), undefined)).toBe(false)
  })

  it('like:% 任意长度、_ 单个字符,整串匹配、忽略大小写;正则元字符按字面量', () => {
    expect(matchCondition(cond('like', 'ali%'), 'Alice')).toBe(true)
    expect(matchCondition(cond('like', '%ice'), 'Alice')).toBe(true)
    expect(matchCondition(cond('like', 'a_ice'), 'alice')).toBe(true)
    expect(matchCondition(cond('like', 'a_ice'), 'aice')).toBe(false)
    expect(matchCondition(cond('like', 'lic'), 'alice')).toBe(false) // 整串匹配,不是包含
    expect(matchCondition(cond('like', 'a.c'), 'abc')).toBe(false) // . 是字面量
    expect(matchCondition(cond('like', 'a.c'), 'a.c')).toBe(true)
    expect(matchCondition(cond('like', '%'), null)).toBe(false)
  })

  it('in / notIn:值是数组,命中任一项即 in;空单元格时 notIn 为真;值不是数组则 in 为假', () => {
    expect(matchCondition(cond('in', [1, 2]), 2)).toBe(true)
    expect(matchCondition(cond('in', [1, 2]), '2')).toBe(true) // 沿用 equal 的跨类型
    expect(matchCondition(cond('in', [1, 2]), 3)).toBe(false)
    expect(matchCondition(cond('notIn', [1, 2]), 3)).toBe(true)
    expect(matchCondition(cond('notIn', [1, 2]), 1)).toBe(false)
    expect(matchCondition(cond('in', [1, 2]), null)).toBe(false)
    expect(matchCondition(cond('notIn', [1, 2]), null)).toBe(true)
    expect(matchCondition(cond('in', 'x'), 'x')).toBe(false)
  })
})

describe('无值算子(C4)', () => {
  it('NO_VALUE_ACTIONS / isValuelessAction / actionValueKind', () => {
    expect([...NO_VALUE_ACTIONS]).toEqual(['isNull', 'isNotNull'])
    expect(isValuelessAction('isNull')).toBe(true)
    expect(isValuelessAction('equal')).toBe(false)
    expect(actionValueKind('isNotNull')).toBe('none')
    expect(actionValueKind('in')).toBe('array')
    expect(actionValueKind('notIn')).toBe('array')
    expect(actionValueKind('contains')).toBe('scalar')
  })

  it('值为空的无值算子仍算「生效」:不被 activeConditions 丢掉,也进序列化与求值', () => {
    const v = val('and', cond('isNull', null))
    expect(activeConditions(v)).toEqual([cond('isNull', null)])
    expect(isFilterActive(v)).toBe(true)
    expect(matchFilterValue(v, null)).toBe(true)
    expect(matchFilterValue(v, 'x')).toBe(false)
    expect(defaultFilterSerializer({ name: v })).toEqual({
      filters: [{ field: 'name', logic: 'and', conditions: [cond('isNull', null)] }],
    })
  })

  it('有值类算子的空值仍被丢弃(口径不变);空数组的 in 也不生效', () => {
    expect(activeConditions(val('and', cond('equal', ''), cond('in', [])))).toEqual([])
  })
})
```

在 `tests/config.test.ts` 末尾追加:
```ts
import { ACTION_LABEL_KEY, defaultLabels } from '../src/labels'
import type { FilterAction } from '../src/types'

describe('15 个操作符都有文案', () => {
  const ALL: FilterAction[] = [
    'equal', 'notEqual', 'contains', 'notContains', 'gt', 'gte', 'lt', 'lte',
    'isNull', 'isNotNull', 'like', 'startsWith', 'endsWith', 'in', 'notIn',
  ]
  it('ACTION_LABEL_KEY 覆盖全部操作符,且每个键在默认英文文案里都有非空值', () => {
    expect(Object.keys(ACTION_LABEL_KEY).sort()).toEqual([...ALL].sort())
    for (const a of ALL) expect(defaultLabels[ACTION_LABEL_KEY[a]]).toBeTruthy()
  })
})
```
(若 `config.test.ts` 顶部已有同名 import,合并到已有 import 里,不要重复声明。)

在 `tests/useFilters.test.ts` 把第 40 行的断言改成新的默认集合(B7 有意变更:默认可选操作符变多):
```ts
    expect(text.actions).toEqual([
      'contains', 'notContains', 'equal', 'notEqual', 'startsWith', 'endsWith', 'like', 'isNull', 'isNotNull',
    ])
```
并在同一个 `it` 里紧接着追加 number / select 的默认集合断言前,先把该用例改成同时取出三列:
```ts
  it('默认动作按值类型给,显式 actions 优先', () => {
    const [text, num, sel] = deriveFilterDefs<Row>([
      { key: 'name', filter: true },
      { key: 'salary', format: 'money', filter: { actions: ['gt'] } },
      { key: 'status', options: [{ label: 'A', value: 1 }], filter: { mode: 'condition' } },
    ])
    expect(text.actions).toEqual([
      'contains', 'notContains', 'equal', 'notEqual', 'startsWith', 'endsWith', 'like', 'isNull', 'isNotNull',
    ])
    expect(num.actions).toEqual(['gt'])
    expect(sel.actions).toEqual(['equal', 'notEqual', 'in', 'notIn', 'isNull', 'isNotNull'])
  })
```
(替换掉原来 33–42 行整个 `it`。)

- [ ] **Step 2: 跑测试,确认失败**

Run: `npx vitest run tests/filter.test.ts tests/config.test.ts tests/useFilters.test.ts`
Expected: FAIL —— `actionValueKind is not a function` / `ACTION_LABEL_KEY` 未导出 / 默认动作集合不等。

- [ ] **Step 3: 实现 —— 类型与文案**

`src/types.ts`:把 `FilterAction` 改成
```ts
/** 条件动作(对齐 Bootstrap Blazor 的 FilterAction)。isNull / isNotNull 不需要值;in / notIn 的值是数组。 */
export type FilterAction =
  | 'equal'
  | 'notEqual'
  | 'contains'
  | 'notContains'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'isNull'
  | 'isNotNull'
  | 'like'
  | 'startsWith'
  | 'endsWith'
  | 'in'
  | 'notIn'
```
并在 `SmartTableLabels` 里 `filterLte: string` 之后追加:
```ts
  filterIsNull: string
  filterIsNotNull: string
  filterLike: string
  filterStartsWith: string
  filterEndsWith: string
  filterIn: string
  filterNotIn: string
  /** 无值算子的值位置占位。 */
  filterNoValue: string
```

`src/labels.ts`:顶部 import 改为 `import type { FilterAction, SmartTableLabels } from './types'`;在 `filterLte: 'Less or equal',` 之后加:
```ts
  filterIsNull: 'Is empty',
  filterIsNotNull: 'Is not empty',
  filterLike: 'Like',
  filterStartsWith: 'Starts with',
  filterEndsWith: 'Ends with',
  filterIn: 'In',
  filterNotIn: 'Not in',
  filterNoValue: 'No value needed',
```
并在文件末尾加:
```ts
/** 操作符 → 文案键(ColumnFilter / ConditionRow / chips 共用)。 */
export const ACTION_LABEL_KEY: Record<FilterAction, keyof SmartTableLabels> = {
  equal: 'filterEqual',
  notEqual: 'filterNotEqual',
  contains: 'filterContains',
  notContains: 'filterNotContains',
  gt: 'filterGt',
  gte: 'filterGte',
  lt: 'filterLt',
  lte: 'filterLte',
  isNull: 'filterIsNull',
  isNotNull: 'filterIsNotNull',
  like: 'filterLike',
  startsWith: 'filterStartsWith',
  endsWith: 'filterEndsWith',
  in: 'filterIn',
  notIn: 'filterNotIn',
}
```

- [ ] **Step 4: 实现 —— `filter.ts`**

在 `isBlank` 函数之后插入:
```ts
/** 不需要填值的操作符:值为空也算「写了」,不能被 activeConditions 当成没填丢掉(C4)。 */
export const NO_VALUE_ACTIONS: readonly FilterAction[] = ['isNull', 'isNotNull']

export function isValuelessAction(action: FilterAction): boolean {
  return NO_VALUE_ACTIONS.includes(action)
}

/** 操作符期望的值形状:无值 / 数组(in、notIn)/ 标量。换操作符时据此判断旧值是否还适用。 */
export type ActionValueKind = 'none' | 'array' | 'scalar'

export function actionValueKind(action: FilterAction): ActionValueKind {
  if (isValuelessAction(action)) return 'none'
  return action === 'in' || action === 'notIn' ? 'array' : 'scalar'
}
```
把 `activeConditions` 改为:
```ts
/** 值非空的条件才参与求值 —— 用户只填了动作没填值时视为没写;无值算子(isNull 等)除外。 */
export function activeConditions(value: FilterValue | null | undefined): FilterCondition[] {
  if (!value || !Array.isArray(value.conditions)) return []
  return value.conditions.filter((c) => c && (isValuelessAction(c.action) || !isBlank(c.value)))
}
```
在 `matchContains` 之后插入辅助函数:
```ts
function matchStartsWith(cell: unknown, value: unknown): boolean {
  if (cell === null || cell === undefined) return false
  return String(cell).toLowerCase().startsWith(String(value).toLowerCase())
}

function matchEndsWith(cell: unknown, value: unknown): boolean {
  if (cell === null || cell === undefined) return false
  return String(cell).toLowerCase().endsWith(String(value).toLowerCase())
}

/** SQL LIKE:% 任意长度、_ 单个字符,整串匹配、忽略大小写;其余字符按字面量。 */
function matchLike(cell: unknown, value: unknown): boolean {
  if (cell === null || cell === undefined) return false
  const source = String(value)
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/%/g, '.*')
    .replace(/_/g, '.')
  return new RegExp(`^${source}$`, 'is').test(String(cell))
}

function matchIn(cell: unknown, value: unknown, dateValueFormat: string): boolean {
  return Array.isArray(value) && value.some((v) => matchEqual(cell, v, dateValueFormat))
}
```
在 `matchCondition` 的 `switch` 里,`default:` 之前插入:
```ts
    case 'isNull':
      return isBlank(cell)
    case 'isNotNull':
      return !isBlank(cell)
    case 'startsWith':
      return matchStartsWith(cell, value)
    case 'endsWith':
      return matchEndsWith(cell, value)
    case 'like':
      return matchLike(cell, value)
    case 'in':
      return matchIn(cell, value, dateValueFormat)
    case 'notIn':
      return !matchIn(cell, value, dateValueFormat)
```
并把 `matchCondition` 上方注释里「单元格为空时:notEqual/notContains 为真」改成「notEqual/notContains/notIn 为真」。

- [ ] **Step 5: 实现 —— 默认可选操作符与 ColumnFilter 引用**

`src/useColumns.ts` 把 `DEFAULT_ACTIONS` 整段替换为:
```ts
/** 各值类型的默认可选动作(对齐 Bootstrap Blazor 的过滤器分类;3.0 起带上新增的 7 个)。 */
const DEFAULT_ACTIONS: Record<FilterFieldType, FilterAction[]> = {
  input: ['contains', 'notContains', 'equal', 'notEqual', 'startsWith', 'endsWith', 'like', 'isNull', 'isNotNull'],
  number: ['equal', 'notEqual', 'gt', 'gte', 'lt', 'lte', 'isNull', 'isNotNull'],
  date: ['equal', 'notEqual', 'gt', 'gte', 'lt', 'lte', 'isNull', 'isNotNull'],
  select: ['equal', 'notEqual', 'in', 'notIn', 'isNull', 'isNotNull'],
}
```
`src/ColumnFilter.vue`:删除文件里本地的 `const ACTION_LABEL_KEY: Record<FilterAction, keyof SmartTableLabels> = {...}` 整段(109–118 行),并在 import 区加 `import { ACTION_LABEL_KEY } from './labels'`。

- [ ] **Step 6: 跑测试,确认通过**

Run: `npx vitest run tests/filter.test.ts tests/config.test.ts tests/useFilters.test.ts`
Expected: PASS。

- [ ] **Step 7: 全量验证**

Run: `npm test && npm run typecheck`
Expected: 全部通过(条数 = 134 + 新增用例数);typecheck 无输出。若 typecheck 报 `Record<FilterAction, …>` 缺键,说明 `ACTION_LABEL_KEY` 漏了某个操作符。

- [ ] **Step 8: 提交**

```bash
git add src/types.ts src/filter.ts src/labels.ts src/useColumns.ts src/ColumnFilter.vue tests/filter.test.ts tests/config.test.ts tests/useFilters.test.ts
git commit -m "feat: 过滤操作符由 8 个扩到 15 个,无值算子不再被丢弃(修 C4;B7 的默认可选操作符变多)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: options 列「勾选 ↔ 高级条件」的无损判定(C3 的内核)

> 规格 §5.3:新增纯函数 `isOptionsRepresentable(value)`——过滤值能被勾选**无损**表达,当且仅当 ① 所有有效条件均为 `equal` 且(`logic === 'or'` 或仅一条),或 ② 恰好一条 `in`(值是数组)。其余不可表达。并让 `filterValueToOptions` 认得单条 `in`。`ColumnFilter` 用它决定「打开面板时是勾选还是自动展开高级条件」(Task 10)。

**Files:**
- Modify: `src/filter.ts`
- Test: `tests/filter.test.ts`(追加)

**Interfaces:**
- Consumes: Task 2 的 `activeConditions`(已含无值算子)。
- Produces: `isOptionsRepresentable(value: FilterValue | null | undefined): boolean`;`filterValueToOptions` 语义扩展(单条 `in` → 其数组;其余沿用「只取 `equal`」)。

- [ ] **Step 1: 写失败测试**

在 `tests/filter.test.ts` 的 import 里加 `isOptionsRepresentable`,文件末尾追加:
```ts
describe('isOptionsRepresentable(C3:勾选面板能否无损表达当前过滤值)', () => {
  it('空 / 未过滤:可表达', () => {
    expect(isOptionsRepresentable(null)).toBe(true)
    expect(isOptionsRepresentable(val('and'))).toBe(true)
    expect(isOptionsRepresentable(val('and', cond('equal', '')))).toBe(true) // 无效条件等于没有
  })

  it('单条 equal、或若干 equal 取「或」:可表达', () => {
    expect(isOptionsRepresentable(val('and', cond('equal', 1)))).toBe(true)
    expect(isOptionsRepresentable(optionsToFilterValue([1, 2]))).toBe(true)
  })

  it('若干 equal 取「且」:不可表达(勾选面板会把它读成「或」,语义变了)', () => {
    expect(isOptionsRepresentable(val('and', cond('equal', 1), cond('equal', 2)))).toBe(false)
  })

  it('恰好一条 in(值是数组):可表达;in 的值不是数组、或与别的条件并存:不可表达', () => {
    expect(isOptionsRepresentable(val('and', cond('in', [1, 2])))).toBe(true)
    expect(isOptionsRepresentable(val('and', cond('in', 'x')))).toBe(false)
    expect(isOptionsRepresentable(val('or', cond('in', [1]), cond('equal', 2)))).toBe(false)
  })

  it('notEqual / notIn / isNull / gt 等一律不可表达', () => {
    expect(isOptionsRepresentable(val('and', cond('notEqual', 1)))).toBe(false)
    expect(isOptionsRepresentable(val('and', cond('notIn', [1])))).toBe(false)
    expect(isOptionsRepresentable(val('and', cond('isNull', null)))).toBe(false)
    expect(isOptionsRepresentable(val('or', cond('equal', 1), cond('gt', 5)))).toBe(false)
  })
})

describe('filterValueToOptions 认得单条 in', () => {
  it('单条 in → 其数组(拷贝);仍忽略非 equal 条件(沿用)', () => {
    const arr = [1, 2]
    const out = filterValueToOptions(val('and', cond('in', arr)))
    expect(out).toEqual([1, 2])
    expect(out).not.toBe(arr)
    expect(filterValueToOptions(val('or', cond('equal', 1), cond('gt', 5)))).toEqual([1])
  })
})
```

- [ ] **Step 2: 跑测试,确认失败**

Run: `npx vitest run tests/filter.test.ts`
Expected: FAIL —— `isOptionsRepresentable is not a function`。

- [ ] **Step 3: 实现**

在 `src/filter.ts` 把 `filterValueToOptions` 整个替换为:
```ts
/**
 * 过滤值 → 已勾选的选项值(optionsToFilterValue 的逆运算,用于回显)。
 * 认得单条 in(其数组即勾选集合);其余沿用「只取 equal 条件」——调用方应先用
 * isOptionsRepresentable 判断能否无损表达,不能时不要用它的结果覆盖原条件(C3)。
 */
export function filterValueToOptions(value: FilterValue | null | undefined): unknown[] {
  const conds = activeConditions(value)
  if (conds.length === 1 && conds[0].action === 'in' && Array.isArray(conds[0].value)) return [...conds[0].value]
  return conds.filter((c) => c.action === 'equal').map((c) => c.value)
}

/**
 * 当前过滤值能否被「勾选候选项」无损表达:
 * ① 所有有效条件均为 equal,且(logic === 'or' 或仅一条);或 ② 恰好一条 in(值是数组)。
 * 不能时,列头面板打开要自动展开「高级条件」原样显示,不能静默丢条件、也不能被确认覆盖。
 */
export function isOptionsRepresentable(value: FilterValue | null | undefined): boolean {
  const conds = activeConditions(value)
  if (conds.length === 0) return true
  if (conds.length === 1) {
    const [c] = conds
    return c.action === 'equal' || (c.action === 'in' && Array.isArray(c.value))
  }
  return value?.logic === 'or' && conds.every((c) => c.action === 'equal')
}
```

- [ ] **Step 4: 跑测试,确认通过**

Run: `npx vitest run tests/filter.test.ts`
Expected: PASS。

- [ ] **Step 5: 全量验证**

Run: `npm test && npm run typecheck`
Expected: 全部通过。

- [ ] **Step 6: 提交**

```bash
git add src/filter.ts tests/filter.test.ts
git commit -m "feat: 新增 isOptionsRepresentable,filterValueToOptions 认得单条 in(C3 的判定内核,面板接线见后续任务)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: 排序 —— 多列排序态、`defaultSortOrder`(C1 / C2)、`sort()` / `clearSorter()`

> 规格 §3、§5.4。**已在真实浏览器复现(设计文档 9.4)**:C2 = 首次请求无排序参数;C1 = 只带第一列。官方事实(`use-sorter.mjs`,已核):**优先级 = 列声明的 `sorter.multiple`,大者优先,与点击顺序无关**;只要存在受控 `sortOrder` 的列且没有一列激活,官方返回空态(这就是 C2 的根因);非 `multiple` 的 `sorter` 是「单列互斥」。
>
> 远程参数:单列保持 `{ sortField, sortOrder }`;多列**仍带**最高优先级列的 `sortField / sortOrder`,**另加** `sorts: [{ field, order }…]`(按优先级,`order` 为 `'asc' | 'desc'`)。**排序态不持久化**。

**Files:**
- Create: `src/sorts.ts`
- Modify: `src/types.ts`(`SortItem`、`SmartTableInst`)
- Modify: `src/useColumns.ts`(`sortState` 改为数组)
- Modify: `src/SmartTable.vue`
- Modify: `src/index.ts`(导出 `SortItem`)
- Test: `tests/sorts.test.ts`(新建)、`tests/useColumns.test.ts`(改 3 处)、`tests/SmartTable.test.ts`(追加)、`tests/baseline-2.1.1.test.ts`(翻转 C1 / C2 两条)

**Interfaces:**
- Produces(后续 Task 依赖,签名固定):
  - `types.ts`:`interface SortItem { field: string; order: 'ascend' | 'descend' }`
  - `sorts.ts`:`interface SorterInfo { priority: number; multiple: boolean }`;`collectSorters<T>(columns: SmartTableColumn<T>[]): Map<string, SorterInfo>`;`orderByPriority(items: SortItem[], info: Map<string, SorterInfo>): SortItem[]`;`deriveInitSorts<T>(columns: SmartTableColumn<T>[]): SortItem[]`;`normalizeSorterEvent(s: unknown, info: Map<string, SorterInfo>): SortItem[]`;`sortToParams(items: SortItem[]): Record<string, any>`
  - `useColumns` 选项 `sortState?: () => SortItem[]`(原来是 `() => {field,order} | null`)
  - `SmartTableInst.sort(columnKey: string, order: 'ascend' | 'descend' | false): void`、`SmartTableInst.clearSorter(): void`

- [ ] **Step 1: 写失败测试 —— 纯函数 `sorts.ts`**

Create `tests/sorts.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import {
  collectSorters,
  deriveInitSorts,
  normalizeSorterEvent,
  orderByPriority,
  sortToParams,
} from '../src/sorts'
import type { SmartTableColumn } from '../src/types'

const cmp = () => 0
const cols: SmartTableColumn<any>[] = [
  { key: 'id', title: 'id' },
  { key: 'g', title: 'g', sorter: { compare: cmp, multiple: 2 } },
  { key: 'n', title: 'n', sorter: { compare: cmp, multiple: 1 } },
  { key: 's', title: 's', sorter: true },
  { type: 'index' },
]

describe('collectSorters', () => {
  it('只收有 sorter 的数据叶子列:multiple 的带优先级,true / 函数是单列互斥(priority 0)', () => {
    const info = collectSorters(cols)
    expect([...info.keys()].sort()).toEqual(['g', 'n', 's'])
    expect(info.get('g')).toEqual({ priority: 2, multiple: true })
    expect(info.get('n')).toEqual({ priority: 1, multiple: true })
    expect(info.get('s')).toEqual({ priority: 0, multiple: false })
  })

  it('多级表头:递归到叶子', () => {
    const info = collectSorters([
      { key: 'grp', title: 'grp', children: [{ key: 'x', title: 'x', sorter: { compare: cmp, multiple: 3 } }] },
    ] as SmartTableColumn<any>[])
    expect(info.get('x')).toEqual({ priority: 3, multiple: true })
  })
})

describe('orderByPriority', () => {
  it('按声明的 multiple 从大到小;与传入顺序无关;未知列排最后', () => {
    const info = collectSorters(cols)
    const out = orderByPriority(
      [
        { field: 'n', order: 'ascend' },
        { field: 'zzz', order: 'ascend' },
        { field: 'g', order: 'descend' },
      ],
      info,
    )
    expect(out.map((i) => i.field)).toEqual(['g', 'n', 'zzz'])
  })
})

describe('normalizeSorterEvent(官方 onUpdate:sorter 的回传 → SortItem[])', () => {
  const info = collectSorters(cols)
  it('单个对象与数组都接受;order 为 false / null 的丢掉', () => {
    expect(normalizeSorterEvent({ columnKey: 's', order: 'ascend', sorter: true }, info)).toEqual([
      { field: 's', order: 'ascend' },
    ])
    expect(normalizeSorterEvent({ columnKey: 's', order: false, sorter: true }, info)).toEqual([])
    expect(normalizeSorterEvent(null, info)).toEqual([])
  })
  it('数组按声明优先级排序,不信任事件里的顺序', () => {
    const out = normalizeSorterEvent(
      [
        { columnKey: 'n', order: 'descend' },
        { columnKey: 'g', order: 'ascend' },
      ],
      info,
    )
    expect(out).toEqual([
      { field: 'g', order: 'ascend' },
      { field: 'n', order: 'descend' },
    ])
  })
})

describe('deriveInitSorts(C2:由列上的 defaultSortOrder 推导初始排序态)', () => {
  it('没有 defaultSortOrder → 空', () => {
    expect(deriveInitSorts(cols)).toEqual([])
  })
  it('multiple 列各自生效,按优先级排', () => {
    const out = deriveInitSorts([
      { key: 'n', title: 'n', sorter: { compare: cmp, multiple: 1 }, defaultSortOrder: 'ascend' },
      { key: 'g', title: 'g', sorter: { compare: cmp, multiple: 2 }, defaultSortOrder: 'descend' },
    ] as SmartTableColumn<any>[])
    expect(out).toEqual([
      { field: 'g', order: 'descend' },
      { field: 'n', order: 'ascend' },
    ])
  })
  it('单列互斥的 sorter:只保留最后声明的那一个(与官方 use-sorter 的初值语义一致)', () => {
    const out = deriveInitSorts([
      { key: 'a', title: 'a', sorter: true, defaultSortOrder: 'ascend' },
      { key: 'b', title: 'b', sorter: true, defaultSortOrder: 'descend' },
    ] as SmartTableColumn<any>[])
    expect(out).toEqual([{ field: 'b', order: 'descend' }])
  })
  it('没有 sorter 的列写了 defaultSortOrder 也不生效', () => {
    expect(deriveInitSorts([{ key: 'a', title: 'a', defaultSortOrder: 'ascend' }] as SmartTableColumn<any>[])).toEqual([])
  })
})

describe('sortToParams(C1:远程参数)', () => {
  it('空 → {};单列 → { sortField, sortOrder };多列 → 仍带最高优先级列,另加 sorts', () => {
    expect(sortToParams([])).toEqual({})
    expect(sortToParams([{ field: 'a', order: 'ascend' }])).toEqual({ sortField: 'a', sortOrder: 'asc' })
    expect(
      sortToParams([
        { field: 'g', order: 'descend' },
        { field: 'n', order: 'ascend' },
      ]),
    ).toEqual({
      sortField: 'g',
      sortOrder: 'desc',
      sorts: [
        { field: 'g', order: 'desc' },
        { field: 'n', order: 'asc' },
      ],
    })
  })
})
```

- [ ] **Step 2: 跑,确认失败**

Run: `npx vitest run tests/sorts.test.ts`
Expected: FAIL —— `Cannot find module '../src/sorts'`。

- [ ] **Step 3: 实现 `src/types.ts` 与 `src/sorts.ts`**

`src/types.ts`:在 `Density` 定义之后加:
```ts
/** 一列的排序态;多列时数组顺序 = 优先级(高 → 低,即列声明的 sorter.multiple 从大到小)。 */
export interface SortItem {
  field: string
  order: 'ascend' | 'descend'
}
```
在 `SmartTableInst` 里 `clearFilters` 之后加:
```ts
  /** 设置某列排序(沿用官方 DataTableInst.sort 的命名与签名);order 为 false = 取消该列。远程模式会回第 1 页重查。 */
  sort: (columnKey: string, order: 'ascend' | 'descend' | false) => void
  /** 清空全部排序。 */
  clearSorter: () => void
```

Create `src/sorts.ts`:
```ts
// 排序态的纯函数(UI 无关、可单测)。
// 官方语义(naive-ui 2.45.3 use-sorter.mjs,已核):多列优先级 = 列声明的 sorter.multiple,
// 大者优先,与点击顺序无关;非 multiple 的 sorter 是「单列互斥」。
import type { SmartTableColumn, SortItem } from './types'
import { isSpecialColumn } from './useColumns'

export interface SorterInfo {
  /** sorter.multiple 的值;单列互斥 = 0。 */
  priority: number
  multiple: boolean
}

type Sorterish = { sorter?: unknown; defaultSortOrder?: unknown }

function sorterInfoOf(sorter: unknown): SorterInfo | null {
  if (sorter === undefined || sorter === null || sorter === false) return null
  if (typeof sorter === 'object' && typeof (sorter as { multiple?: unknown }).multiple === 'number') {
    return { priority: (sorter as { multiple: number }).multiple, multiple: true }
  }
  return { priority: 0, multiple: false }
}

/** 收集可排序叶子列(列 key → 优先级信息)。多级表头递归到叶子,特殊列跳过。 */
export function collectSorters<T>(columns: SmartTableColumn<T>[]): Map<string, SorterInfo> {
  const out = new Map<string, SorterInfo>()
  const walk = (cols: SmartTableColumn<T>[]) => {
    for (const c of cols) {
      if (isSpecialColumn(c)) continue
      if (c.children?.length) {
        walk(c.children)
        continue
      }
      const info = sorterInfoOf((c as Sorterish).sorter)
      if (info) out.set(c.key, info)
    }
  }
  walk(columns)
  return out
}

/** 按声明的优先级从大到小排序(稳定;未知列按 0 算,排在有优先级的列之后)。 */
export function orderByPriority(items: SortItem[], info: Map<string, SorterInfo>): SortItem[] {
  return items
    .map((item, index) => ({ item, index, priority: info.get(item.field)?.priority ?? 0 }))
    .sort((a, b) => b.priority - a.priority || a.index - b.index)
    .map((x) => x.item)
}

/** 官方 onUpdate:sorter 的回传(单个对象 / 数组 / null)→ SortItem[](按声明优先级排序,丢掉 order 为 false 的)。 */
export function normalizeSorterEvent(s: unknown, info: Map<string, SorterInfo>): SortItem[] {
  const list = Array.isArray(s) ? s : s ? [s] : []
  const items: SortItem[] = []
  for (const x of list as Array<{ columnKey?: string | number; order?: unknown }>) {
    if (!x || (x.order !== 'ascend' && x.order !== 'descend') || x.columnKey === undefined) continue
    items.push({ field: String(x.columnKey), order: x.order })
  }
  return orderByPriority(items, info)
}

/**
 * 由列上的 defaultSortOrder 推导初始排序态(C2:官方在存在受控 sortOrder 的列时会忽略 defaultSortOrder,
 * 库给每个 sorter 列都写受控 sortOrder,所以必须自己接住它)。
 * 初值语义对齐官方 use-sorter:单列互斥的 sorter 只留最后声明的那一个;multiple 列可并存。
 */
export function deriveInitSorts<T>(columns: SmartTableColumn<T>[]): SortItem[] {
  const info = collectSorters(columns)
  let state: Array<SortItem & { multiple: boolean }> = []
  const walk = (cols: SmartTableColumn<T>[]) => {
    for (const c of cols) {
      if (isSpecialColumn(c)) continue
      if (c.children?.length) {
        walk(c.children)
        continue
      }
      const order = (c as Sorterish).defaultSortOrder
      const i = info.get(c.key)
      if (!i || (order !== 'ascend' && order !== 'descend')) continue
      if (i.multiple) state = [...state.filter((s) => s.multiple && s.field !== c.key), { field: c.key, order, multiple: true }]
      else state = [{ field: c.key, order, multiple: false }]
    }
  }
  walk(columns)
  return orderByPriority(
    state.map(({ field, order }) => ({ field, order })),
    info,
  )
}

/** 排序态 → 远程请求参数。单列保持 2.1.1 的形状;多列仍带最高优先级列(老后端至少拿到主排序),另加 sorts。 */
export function sortToParams(items: SortItem[]): Record<string, any> {
  if (items.length === 0) return {}
  const dir = (o: SortItem['order']) => (o === 'ascend' ? 'asc' : 'desc')
  const [main] = items
  const out: Record<string, any> = { sortField: main.field, sortOrder: dir(main.order) }
  if (items.length > 1) out.sorts = items.map((i) => ({ field: i.field, order: dir(i.order) }))
  return out
}
```

注意:`sorts.ts` 从 `useColumns` 引入 `isSpecialColumn`,而 Step 5 会让 `useColumns` 只 `import type` 自 `types.ts`,不反向 import `sorts.ts`,所以没有循环依赖。

- [ ] **Step 4: 跑,确认 `sorts.test.ts` 通过**

Run: `npx vitest run tests/sorts.test.ts`
Expected: PASS。

- [ ] **Step 5: 写失败测试 —— `useColumns` 的受控回显改为数组**

`tests/useColumns.test.ts`:
1. 第 24 行 `build()` 参数类型 `sortState?: () => { field: string; order: 'ascend' | 'descend' } | null` 改为 `sortState?: () => SortItem[]`,并在文件顶部的 `import type { SmartTableColumn, SmartTableOption } from '../src/types'` 里加上 `SortItem`。
2. 「sorter 列受控回显」用例(89–102 行)改为:
```ts
  it('sorter 列受控回显:命中列取 sortState 里的 order,其余 sortable 列为 false;多列同时回显', () => {
    const api = build(
      [
        { key: 'name', title: 'N', sorter: true },
        { key: 'amt', title: 'A', sorter: true },
        { key: 'st', title: 'S', sorter: true },
      ],
      undefined,
      {},
      () => [
        { field: 'amt', order: 'descend' },
        { field: 'st', order: 'ascend' },
      ],
    )
    expect(col(api, 'amt').sortOrder).toBe('descend')
    expect(col(api, 'st').sortOrder).toBe('ascend') // C1:多列都回显,不再只认第一列
    expect(col(api, 'name').sortOrder).toBe(false)
  })
```

- [ ] **Step 6: 跑,确认失败**

Run: `npx vitest run tests/useColumns.test.ts`
Expected: FAIL(类型或 `sortOrder` 回显不符,因为 `useColumns` 还按单个对象读)。

- [ ] **Step 7: 实现 —— `useColumns.ts`**

`src/useColumns.ts`:
1. `import type { ... } from './types'` 列表里加 `SortItem`。
2. `UseColumnsOpts` 里把
```ts
  sortState?: () => { field: string; order: 'ascend' | 'descend' } | null
```
改为
```ts
  /** 当前受控排序态(sorter 列箭头回显,多列同时回显);getter 保证 computed 内追踪。 */
  sortState?: () => SortItem[]
```
3. `toNaive` 里「受控排序」那段(453–457 行)改为:
```ts
    // 受控排序:sorter 列的箭头由 sortState 决定(远程模式非受控箭头会漂);多列时每列各自回显
    if (naiveRest.sorter != null && (naiveRest.sorter as unknown) !== false) {
      const hit = opts.sortState?.().find((s) => s.field === key)
      result.sortOrder = hit ? hit.order : false
    }
```

- [ ] **Step 8: 写失败测试 —— `SmartTable` 的集成行为**

在 `tests/SmartTable.test.ts` 末尾追加(顶部 import 里补 `flushPromises`:`import { flushPromises, mount } from '@vue/test-utils'`):
```ts
describe('SmartTable 排序(多列 / 默认排序 / 编程式)', () => {
  const cmp = () => 0
  const multiCols = [
    { key: 'g', title: 'G', sorter: { compare: cmp, multiple: 2 } },
    { key: 'n', title: 'N', sorter: { compare: cmp, multiple: 1 }, defaultSortOrder: 'ascend' as const },
  ]
  const mountRemote = (columns: unknown[]) => {
    const fetcher = vi.fn(async (_p: Record<string, unknown>) => ({ items: rows, total: 2 }))
    const wrapper = mount(SmartTable, { props: { columns: columns as SmartTableColumn<Row>[], fetcher, rowKey: 'id' } })
    return { fetcher, wrapper }
  }
  const sorterHandler = (wrapper: ReturnType<typeof mount>) =>
    wrapper.findComponent(NDataTable).props('onUpdate:sorter') as (s: unknown) => void
  const lastParams = (fetcher: { mock: { calls: unknown[][] } }) => fetcher.mock.calls.at(-1)![0] as Record<string, unknown>

  it('C2:列上的 defaultSortOrder 进入首次请求,箭头回显', async () => {
    const { fetcher, wrapper } = mountRemote(multiCols)
    await flushPromises()
    expect((fetcher.mock.calls[0][0] as Record<string, unknown>)).toMatchObject({ sortField: 'n', sortOrder: 'asc' })
    const cols = wrapper.findComponent(NDataTable).props('columns') as Array<{ key: string; sortOrder?: unknown }>
    expect(cols.find((c) => c.key === 'n')!.sortOrder).toBe('ascend')
    expect(cols.find((c) => c.key === 'g')!.sortOrder).toBe(false)
    wrapper.unmount()
  })

  it('C1:多列点击 → sortField 取最高优先级列,并带 sorts;两列箭头都回显', async () => {
    const { fetcher, wrapper } = mountRemote(multiCols)
    await flushPromises()
    sorterHandler(wrapper)([
      { columnKey: 'n', order: 'ascend', sorter: multiCols[1].sorter },
      { columnKey: 'g', order: 'descend', sorter: multiCols[0].sorter },
    ])
    await flushPromises()
    expect(lastParams(fetcher)).toMatchObject({
      page: 1,
      sortField: 'g',
      sortOrder: 'desc',
      sorts: [
        { field: 'g', order: 'desc' },
        { field: 'n', order: 'asc' },
      ],
    })
    const cols = wrapper.findComponent(NDataTable).props('columns') as Array<{ key: string; sortOrder?: unknown }>
    expect(cols.find((c) => c.key === 'g')!.sortOrder).toBe('descend')
    expect(cols.find((c) => c.key === 'n')!.sortOrder).toBe('ascend')
    wrapper.unmount()
  })

  it('sort() / clearSorter():编程式设置与清空,远程模式回第 1 页重查', async () => {
    const { fetcher, wrapper } = mountRemote(multiCols)
    await flushPromises()
    const inst = wrapper.vm as unknown as {
      sort: (k: string, o: 'ascend' | 'descend' | false) => void
      clearSorter: () => void
    }
    inst.sort('g', 'descend')
    await flushPromises()
    expect(lastParams(fetcher)).toMatchObject({ page: 1, sorts: [{ field: 'g', order: 'desc' }, { field: 'n', order: 'asc' }] })

    inst.sort('n', false) // 取消 n,保留 g
    await flushPromises()
    expect(lastParams(fetcher)).toMatchObject({ sortField: 'g', sortOrder: 'desc' })
    expect(lastParams(fetcher)).not.toHaveProperty('sorts')

    inst.clearSorter()
    await flushPromises()
    expect(lastParams(fetcher)).not.toHaveProperty('sortField')
    wrapper.unmount()
  })

  it('sort() 对没有 sorter 的列是空操作', async () => {
    const { fetcher, wrapper } = mountRemote([{ key: 'name', title: 'Name' }])
    await flushPromises()
    const before = fetcher.mock.calls.length
    ;(wrapper.vm as unknown as { sort: (k: string, o: 'ascend') => void }).sort('name', 'ascend')
    await flushPromises()
    expect(fetcher.mock.calls.length).toBe(before)
    wrapper.unmount()
  })
})
```

- [ ] **Step 9: 跑,确认失败**

Run: `npx vitest run tests/SmartTable.test.ts`
Expected: FAIL —— 新用例失败(`SmartTable` 还是单个排序态);已有用例不应受影响。

- [ ] **Step 10: 实现 —— `SmartTable.vue`**

`src/SmartTable.vue`:
1. `import type {...} from './types'` 列表加 `SortItem`;在 `import { applyFilters } from './filter'` 之后加:
```ts
import { collectSorters, deriveInitSorts, normalizeSorterEvent, orderByPriority, sortToParams } from './sorts'
```
2. 把「排序状态(受控)」整段(127–132 行)替换为:
```ts
// 排序状态(受控):sorter 列点表头 → 写这里 → 并进 fetcher 参数 + 回显箭头。
// 数组,顺序 = 优先级(列声明的 sorter.multiple 从大到小);初值来自列上的 defaultSortOrder(C2)。
// 不持久化(会话态,与过滤态一致)。
const sortState = ref<SortItem[]>(deriveInitSorts(props.columns))
const sorterInfo = computed(() => collectSorters(props.columns))
function applySorts(items: SortItem[]) {
  sortState.value = items
  if (isRemote.value) void table.search()
}
```
3. `useSmartTable` 的 `extraParams` 里把 `...sortToParams()` 保持不变(现在从 `sorts.ts` 引入的 `sortToParams` 收参数):改成 `...sortToParams(sortState.value)`。
4. `useColumns` 调用里 `sortState: () => sortState.value` 保持(现在是数组)。
5. 把 `onSorterChange`(208–215 行)整段替换为:
```ts
// Naive @update:sorter → 更新受控排序态 + 远程重查(回第 1 页)。宿主若另挂 handler 也转发。
function onSorterChange(s: unknown) {
  applySorts(normalizeSorterEvent(s, sorterInfo.value))
  const hostHandler = attrs['onUpdate:sorter']
  if (typeof hostHandler === 'function') (hostHandler as (v: unknown) => void)(s)
}

/** 编程式排序(沿用官方 DataTableInst.sort 的签名)。单列互斥的 sorter 会清掉其它列;没有 sorter 的列是空操作。 */
function sort(columnKey: string, order: 'ascend' | 'descend' | false) {
  const info = sorterInfo.value.get(columnKey)
  if (!info) return
  const others = info.multiple ? sortState.value.filter((i) => i.field !== columnKey) : []
  const next = order ? [...others, { field: columnKey, order }] : others
  applySorts(orderByPriority(next, sorterInfo.value))
}

function clearSorter() {
  applySorts([])
}
```
6. 删掉原来的 `function sortToParams()`(已移到 `sorts.ts`)。
7. `defineExpose({...})` 里,在 `clearFilters: filters.clearFilters,` 之后加:
```ts
  sort,
  clearSorter,
```

`src/index.ts`:在 `export type { ... } from './types'` 的列表里加 `SortItem,`。

- [ ] **Step 11: 翻转特征测试 [C1][C2]**

`tests/baseline-2.1.1.test.ts`:
- 「[C2] defaultSortOrder 被受控 sortOrder 盖掉」整个 `it` 改为(并把标题里的 `[C2]` 改成 `[C2 已修]`):
```ts
  it('[C2 已修] defaultSortOrder 进入首次请求', async () => {
    const fetcher = vi.fn(async () => ({ items: rows, total: 2 }))
    const wrapper = mount(SmartTable, {
      props: { columns: [{ key: 'a', title: 'A', sorter: true, defaultSortOrder: 'descend' }], fetcher, rowKey: 'id' },
    })
    await flushPromises()
    const first = (fetcher.mock.calls[0] as unknown[])[0] as Record<string, unknown>
    expect(first).toMatchObject({ sortField: 'a', sortOrder: 'desc' })
    wrapper.unmount()
  })
```
- 「[C1] 多列排序被截成单列」整个 `it` 改为:
```ts
  it('[C1 已修] 多列排序:带 sortField(最高优先级)与 sorts', async () => {
    const fetcher = vi.fn(async () => ({ items: rows, total: 2 }))
    const multiCols = [
      { key: 'a', title: 'A', sorter: { compare: () => 0, multiple: 2 } },
      { key: 'b', title: 'B', sorter: { compare: () => 0, multiple: 1 } },
    ]
    const wrapper = mount(SmartTable, { props: { columns: multiCols, fetcher, rowKey: 'id' } })
    await flushPromises()
    const onSorter = wrapper.findComponent(NDataTable).props('onUpdate:sorter') as (s: unknown) => void
    onSorter([
      { columnKey: 'a', order: 'ascend', sorter: multiCols[0].sorter },
      { columnKey: 'b', order: 'descend', sorter: multiCols[1].sorter },
    ])
    await flushPromises()
    const last = (fetcher.mock.calls.at(-1) as unknown[])[0] as Record<string, unknown>
    expect(last).toMatchObject({
      sortField: 'a',
      sortOrder: 'asc',
      sorts: [
        { field: 'a', order: 'asc' },
        { field: 'b', order: 'desc' },
      ],
    })
    wrapper.unmount()
  })
```

- [ ] **Step 12: 跑,确认全部通过**

Run: `npm test && npm run typecheck`
Expected: 全部通过;typecheck 无输出。若 `SmartTable.test.ts` 的新用例里 `sort('n', false)` 之后 `sorts` 仍存在,检查 `sort()` 对 multiple 列的 `others` 过滤。

- [ ] **Step 13: 提交**

```bash
git add src/sorts.ts src/types.ts src/useColumns.ts src/SmartTable.vue src/index.ts tests/sorts.test.ts tests/useColumns.test.ts tests/SmartTable.test.ts tests/baseline-2.1.1.test.ts
git commit -m "fix: 多列排序不再被截成单列、defaultSortOrder 开始生效(C1/C2);新增 sort()/clearSorter() 与远程参数 sorts" -m "⚠ C2:此前写了 defaultSortOrder 却没生效的列,升级后会突然生效,CHANGELOG 要显著标注。" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: 密度 —— 默认紧凑、去掉按钮、宿主值响应式、旧存储不盖宿主值(B2 / B3)

> 规格 §1 B2/B3、§5.2:
> - 内置默认密度 `comfortable` → **`compact`**;`storage.ts` 读到旧数据但没存 density 时的回退值同步改 `'compact'`。
> - `toolbar.density` **保留、默认改 `false`**;传 `true` 才显示按钮,此时保持旧规则「存储优先」。
> - **没有密度按钮时忽略存储里的 density**(格式与 `VERSION` 不动,继续写入),宿主的值才生效。
> - `defaultDensity` 响应式:宿主 `:default-density="settings.density"` 变了,已挂载的表格跟着变。

**Files:**
- Modify: `src/config.ts`、`src/storage.ts`、`src/types.ts`(注释)、`src/useColumns.ts`、`src/SmartTable.vue`、`src/Toolbar.vue`
- Test: `tests/baseline-2.1.1.test.ts`(翻转 3 处)、`tests/storage.test.ts`(追加)、`tests/SmartTable.test.ts`(追加)、`tests/Toolbar.test.ts`(新建)

**Interfaces:**
- Consumes: 无(本 Task 之前的产物无关)。
- Produces:
  - `useColumns` 选项:`defaultDensity: () => Density`(原为 `Density`);新增 `respectStoredDensity?: () => boolean`(缺省 `false`);返回值 `density: ComputedRef<Density>`(原 `Ref<Density>`)。
  - `Toolbar.vue`:`cfg.density === true` 才渲染密度按钮。

- [ ] **Step 1: 写失败测试 —— Review Focus #1 与按钮去留**

Create `tests/Toolbar.test.ts`:
```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Toolbar from '../src/Toolbar.vue'
import { defaultLabels } from '../src/labels'

const mountToolbar = (config: Record<string, unknown> | false = {}, extra: Record<string, unknown> = {}) =>
  mount(Toolbar, { props: { labels: defaultLabels, config: config as never, density: 'compact' as const, ...extra } })

describe('Toolbar 内置图标(B3)', () => {
  it('默认没有「密度」按钮,有「刷新」', () => {
    const html = mountToolbar().html()
    expect(html).toContain('aria-label="Refresh"')
    expect(html).not.toContain('aria-label="Density"')
  })

  it('toolbar: { density: true } 才把密度按钮请回来', () => {
    expect(mountToolbar({ density: true }).html()).toContain('aria-label="Density"')
  })

  it('toolbar: false 时两个图标都没有', () => {
    const html = mountToolbar(false).html()
    expect(html).not.toContain('aria-label="Refresh"')
    expect(html).not.toContain('aria-label="Density"')
  })
})
```

在 `tests/SmartTable.test.ts` 末尾追加:
```ts
describe('SmartTable 密度(B2:宿主的值必须能生效)', () => {
  const tableSize = (w: ReturnType<typeof mount>) => w.findComponent(NDataTable).props('size')
  const base = { columns: [{ key: 'name', title: 'Name' }] as SmartTableColumn<Row>[], data: rows, rowKey: 'id' }

  afterEach(() => localStorage.clear())

  it('[Review Focus 1] 存过 comfortable 的老用户 + 宿主给 compact + 没开密度按钮 → 取 compact', () => {
    saveState('dens-a', 'comfortable', [{ key: 'name', show: true }])
    const wrapper = mount(SmartTable, { props: { ...base, storageKey: 'dens-a', defaultDensity: 'compact' } })
    expect(tableSize(wrapper)).toBe('small')
    wrapper.unmount()
  })

  it('开了 toolbar.density:true 时仍是「存储优先」(旧规则)', () => {
    saveState('dens-b', 'comfortable', [{ key: 'name', show: true }])
    const wrapper = mount(SmartTable, {
      props: { ...base, storageKey: 'dens-b', defaultDensity: 'compact', toolbar: { density: true } },
    })
    expect(tableSize(wrapper)).toBe('medium')
    wrapper.unmount()
  })

  it('没有存储、没有宿主值 → 默认紧凑(small)', () => {
    const wrapper = mount(SmartTable, { props: base })
    expect(tableSize(wrapper)).toBe('small')
    wrapper.unmount()
  })

  it('defaultDensity 是响应式的:宿主中途改值,已挂载的表格跟着变', async () => {
    const wrapper = mount(SmartTable, { props: { ...base, defaultDensity: 'compact' } })
    expect(tableSize(wrapper)).toBe('small')
    await wrapper.setProps({ defaultDensity: 'comfortable' })
    expect(tableSize(wrapper)).toBe('medium')
    wrapper.unmount()
  })
})
```
并把该文件顶部 import 改成(补 `afterEach`、`saveState`):
```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { saveState } from '../src/storage'
```
(`flushPromises` 已在 Task 4 加过。)

在 `tests/storage.test.ts` 末尾追加:
```ts
describe('loadState 的密度回退值(B2)', () => {
  it('旧数据里没有 density 字段时回退成 compact(与内置默认一致)', () => {
    localStorage.setItem('protable:nodens', JSON.stringify({ v: 2, cols: [], widths: {} }))
    expect(loadState('nodens')?.density).toBe('compact')
  })
})
```
(若该文件没有 `loadState` 的 import,在顶部 import 里补上。)

- [ ] **Step 2: 跑,确认失败**

Run: `npx vitest run tests/Toolbar.test.ts tests/SmartTable.test.ts tests/storage.test.ts`
Expected: FAIL —— 密度按钮仍然默认显示、默认仍是 medium、旧存储仍盖过宿主值、回退值是 comfortable。

- [ ] **Step 3: 实现**

`src/config.ts`:
- `density?: Density` 的注释 `内置兜底 'comfortable'` 改为 `内置兜底 'compact'`;
- `BUILTIN_DEFAULTS` 里 `density: 'comfortable',` 改为 `density: 'compact',`。

`src/storage.ts`:`density: parsed.density ?? 'comfortable',` 改为 `density: parsed.density ?? 'compact',`。

`src/types.ts`:
- `ToolbarConfig` 里 `density?: boolean // 默认 true` 改为
```ts
  /** 是否显示「密度」按钮;默认 false(3.0 起密度交给宿主的个人设置经 defaultDensity 传入)。传 true 时存储里的密度优先。 */
  density?: boolean
```
- `SmartTableProps.defaultDensity` 的注释改为 `// 默认 'compact';响应式(没有密度按钮时它就是当前值)`。

`src/useColumns.ts`:
1. `import { computed, h, ref, watch, type ComputedRef, type Ref, type Slots, type VNodeChild } from 'vue'` 保持。
2. `UseColumnsOpts` 里把 `defaultDensity: Density` 改为:
```ts
  /** 宿主给的密度(getter:响应式;没有密度按钮时它就是当前值)。 */
  defaultDensity: () => Density
  /** 是否让存储里的 density 优先(仅 toolbar.density === true 时为 true);缺省 false = 忽略存储里的密度。 */
  respectStoredDensity?: () => boolean
```
3. `UseColumnsReturn` 里 `density: Ref<Density>` 改为 `density: ComputedRef<Density>`。
4. 把
```ts
  const density = ref<Density>(stored?.density ?? opts.defaultDensity)
```
替换为:
```ts
  // 用户在密度按钮上选的值:仅当开了密度按钮(respectStoredDensity)时才读存储;其余情况取宿主的值。
  // 存储格式里的 density 字段仍照常写入(不动 VERSION),只是读取时不采用。
  const userDensity = ref<Density | null>(opts.respectStoredDensity?.() ? (stored?.density ?? null) : null)
  const density = computed<Density>(() => userDensity.value ?? opts.defaultDensity())
```
5. `setDensity` 整个替换为:
```ts
  function setDensity(next: Density) {
    userDensity.value = next
    if (opts.storageKey) saveState(opts.storageKey, next, effectiveChecks.value, widths.value)
  }
```
(原函数参数名 `d` 与外层 `const d = opts.defaults` 重名,这里顺手改成 `next`。)

`src/SmartTable.vue`:`useColumns<T>({...})` 里把 `defaultDensity: props.defaultDensity ?? defaults.density,` 替换为:
```ts
  defaultDensity: () => props.defaultDensity ?? defaults.density,
  respectStoredDensity: () => typeof props.toolbar === 'object' && props.toolbar.density === true,
```

`src/Toolbar.vue`:
- `const cfg = computed<ToolbarConfig>(...)` 保持;
- `<n-dropdown v-if="cfg.density !== false"` 改为 `v-if="cfg.density === true"`。

并修改 `tests/useColumns.test.ts` 里**两处**直接构造 `useColumns` 的 `opts`:① `build()` 里的 `defaultDensity: 'comfortable' as const,`;② 「列被移除后,widths 里对应的旧宽度也跟着清掉」用例里手写的 `useColumns<Row>({ … defaultDensity: 'comfortable', … })`。两处都改成 getter:`defaultDensity: () => 'comfortable' as const,`(第二处不需要 `as const`)。**漏改第二处会在 typecheck 时报错。**

- [ ] **Step 4: 翻转特征测试 [B2][B3]**

`tests/baseline-2.1.1.test.ts`:
1. 「[B1][B2] 内置兜底」用例里 `expect(BUILTIN_DEFAULTS.density).toBe('comfortable')` 改为 `'compact'`,标题改成 `'[B1] 内置兜底:每页 [10,20,50];[B2 已翻转] 密度 compact'`。
2. 「[B2] 默认舒适…」整个 `describe('2.1.1 特征:密度')` 改为:
```ts
describe('3.0 密度(B2 已翻转)', () => {
  it('默认紧凑(small);存过 compact 的用户没有密度按钮时同样是 compact(宿主值生效)', () => {
    const plain = mount(SmartTable, { props: { columns: [{ key: 'name', title: 'Name' }], data: rows, rowKey: 'id' } })
    expect(plain.findComponent(NDataTable).props('size')).toBe('small')
    plain.unmount()
  })
})
```
3. 「[B3] 默认同时有刷新与密度」用例改为:
```ts
describe('3.0 工具栏(B3 已翻转)', () => {
  it('默认只有「刷新」,没有「密度」', () => {
    const wrapper = mount(Toolbar, { props: { labels: defaultLabels, config: {}, density: 'compact' } })
    const html = wrapper.html()
    expect(html).toContain('aria-label="Refresh"')
    expect(html).not.toContain('aria-label="Density"')
    wrapper.unmount()
  })
})
```
(`saveState` 的 import 在该文件里因此不再使用,一并删掉以免 `noUnusedLocals` 报错。)

- [ ] **Step 5: 跑,确认全部通过**

Run: `npm test && npm run typecheck`
Expected: 全部通过。**若 `SmartTable.test.ts` 里「开了 toolbar.density:true 仍是存储优先」失败**,检查 `respectStoredDensity` 是在 `useColumns` 创建时读的(`ref` 初值只算一次)——这是有意的:该开关在挂载时决定,不做响应式。

- [ ] **Step 6: 提交**

```bash
git add src/config.ts src/storage.ts src/types.ts src/useColumns.ts src/SmartTable.vue src/Toolbar.vue tests/baseline-2.1.1.test.ts tests/storage.test.ts tests/SmartTable.test.ts tests/Toolbar.test.ts tests/useColumns.test.ts
git commit -m "feat!: 默认密度改为紧凑、工具栏默认去掉密度按钮、宿主的 defaultDensity 响应式且不再被旧存储盖过(B2/B3)" -m "有意的默认行为变更:回退 → defaultDensity=\"comfortable\";想要按钮 → toolbar: { density: true }(此时存储优先)。" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: 工具栏 —— 静态模式隐藏刷新(B5)、`toolbar.more` 菜单与 `moreSelect` 事件

> 规格 §1 B5、§3、§5.2。
> - 刷新按钮:`toolbar.refresh !== false && 远程模式`;静态数据模式(没传 `fetcher`)不显示,即使显式写了 `toolbar.refresh: true`(显示了也是摆设)。实例方法 `refresh()` 保持导出、保持现有语义。
> - `toolbar.more?: ToolbarMoreOption[]`:官方 `NDropdown` 的 `options` 原样透传(文档只保证 `label` / `key` / `disabled` 与 `{ type: 'divider' }`);**没传、空数组、或只有分隔线时不渲染按钮**;选中后库发出 `moreSelect(key, option)`,由宿主处理。**库不内置导出 / 导入**。
> - 位置:`#toolbar-right` 宿主按钮**之后**、内置图标**之前**;文字按钮 + 下箭头,默认描边样式;文案走 labels `more`。
> - 官方事实(已核):`DropdownMixedOption` **不是**公开导出的类型,用 `NonNullable<DropdownProps['options']>[number]` 取;`NButton` 有 `iconPlacement: 'left' | 'right'`;`NDropdown` 的 `select` 事件回传 `(key, option)`。

**Files:**
- Modify: `src/types.ts`、`src/labels.ts`、`src/icons.ts`、`src/Toolbar.vue`、`src/SmartTable.vue`、`src/index.ts`
- Test: `tests/Toolbar.test.ts`(追加)、`tests/SmartTable.test.ts`(追加)

**Interfaces:**
- Consumes: Task 5 的 `Toolbar.vue`(已按 `cfg.density === true` 渲染密度按钮)。
- Produces:
  - `types.ts`:`type ToolbarMoreOption = NonNullable<DropdownProps['options']>[number]`;`ToolbarConfig.more?: ToolbarMoreOption[]`;`SmartTableLabels.more: string`
  - `Toolbar.vue`:新 prop `remote: boolean`(默认 `true`)、新事件 `moreSelect: [key: string | number, option: DropdownOption]`
  - `SmartTable.vue`:新事件 `moreSelect: [key: string | number, option: DropdownOption]`
  - `icons.ts`:`ChevronDownIcon`、`CloseIcon`(后者给 Task 10 用,这里一并加)

- [ ] **Step 1: 写失败测试**

在 `tests/Toolbar.test.ts` 末尾追加(并把顶部 import 改成 `import { NDropdown } from 'naive-ui'` 额外加一行):
```ts
import { NDropdown } from 'naive-ui'

describe('Toolbar 刷新按钮(B5)', () => {
  it('静态模式(remote=false)不显示刷新,即使显式 toolbar.refresh: true', () => {
    expect(mountToolbar({}, { remote: false }).html()).not.toContain('aria-label="Refresh"')
    expect(mountToolbar({ refresh: true }, { remote: false }).html()).not.toContain('aria-label="Refresh"')
  })
  it('远程模式(默认)显示刷新;refresh: false 关掉', () => {
    expect(mountToolbar({}).html()).toContain('aria-label="Refresh"')
    expect(mountToolbar({ refresh: false }).html()).not.toContain('aria-label="Refresh"')
  })
})

describe('Toolbar「更多」菜单(toolbar.more)', () => {
  const opts = [
    { label: '导出', key: 'export' },
    { label: '导入', key: 'import' },
    { type: 'divider' as const, key: 'd1' },
    { label: '下载导入模板', key: 'tpl' },
  ]

  it('传了可选项 → 出现「更多」按钮(文字取 labels.more)', () => {
    const html = mountToolbar({ more: opts }).html()
    expect(html).toContain('aria-label="More"')
  })

  it('[Review Focus 5] 没传 / 空数组 / 只有分隔线 / toolbar:false → 不渲染按钮', () => {
    expect(mountToolbar({}).html()).not.toContain('aria-label="More"')
    expect(mountToolbar({ more: [] }).html()).not.toContain('aria-label="More"')
    expect(mountToolbar({ more: [{ type: 'divider', key: 'd' }] }).html()).not.toContain('aria-label="More"')
    expect(mountToolbar(false).html()).not.toContain('aria-label="More"')
  })

  it('选中菜单项 → 发出 moreSelect(key, option)', () => {
    const wrapper = mountToolbar({ more: opts })
    const onSelect = wrapper.findComponent(NDropdown).props('onSelect') as (k: string, o: unknown) => void
    onSelect('export', opts[0])
    expect(wrapper.emitted('moreSelect')).toEqual([['export', opts[0]]])
  })

  it('「更多」排在宿主 #right 插槽内容之后、刷新按钮之前', () => {
    const wrapper = mount(Toolbar, {
      props: { labels: defaultLabels, config: { more: opts } as never, density: 'compact' as const },
      slots: { right: '<i class="host-btn">新增</i>' },
    })
    const html = wrapper.html()
    const host = html.indexOf('host-btn')
    const more = html.indexOf('aria-label="More"')
    const refresh = html.indexOf('aria-label="Refresh"')
    expect(host).toBeGreaterThan(-1)
    expect(host).toBeLessThan(more)
    expect(more).toBeLessThan(refresh)
  })
})
```

在 `tests/SmartTable.test.ts` 末尾追加(顶部需要 `import Toolbar from '../src/Toolbar.vue'`):
```ts
describe('SmartTable 工具栏接线(B5 / more)', () => {
  const base = { columns: [{ key: 'name', title: 'Name' }] as SmartTableColumn<Row>[], rowKey: 'id' }

  it('B5:静态数据模式不显示刷新;远程模式显示', async () => {
    const staticWrapper = mount(SmartTable, { props: { ...base, data: rows } })
    expect(staticWrapper.html()).not.toContain('aria-label="Refresh"')
    staticWrapper.unmount()

    const remoteWrapper = mount(SmartTable, { props: { ...base, fetcher: async () => ({ items: rows, total: 2 }) } })
    await flushPromises()
    expect(remoteWrapper.html()).toContain('aria-label="Refresh"')
    remoteWrapper.unmount()
  })

  it('实例方法 refresh() 在静态模式下保持空操作(不抛错)', async () => {
    const wrapper = mount(SmartTable, { props: { ...base, data: rows } })
    await expect((wrapper.vm as unknown as { refresh: () => Promise<void> }).refresh()).resolves.toBeUndefined()
    wrapper.unmount()
  })

  it('moreSelect 从 Toolbar 转发到 SmartTable 的事件', () => {
    const more = [{ label: '导出', key: 'export' }]
    const wrapper = mount(SmartTable, { props: { ...base, data: rows, toolbar: { more } } })
    wrapper.findComponent(Toolbar).vm.$emit('moreSelect', 'export', more[0])
    expect(wrapper.emitted('moreSelect')).toEqual([['export', more[0]]])
    wrapper.unmount()
  })
})
```

- [ ] **Step 2: 跑,确认失败**

Run: `npx vitest run tests/Toolbar.test.ts tests/SmartTable.test.ts`
Expected: FAIL —— 静态模式仍显示刷新;`aria-label="More"` 不存在;无 `moreSelect` 事件。

- [ ] **Step 3: 实现 —— 类型、文案、图标**

`src/types.ts`:
- 第 2 行 import 改为 `import type { DataTableBaseColumn, DataTableInst, DropdownProps, PaginationProps } from 'naive-ui'`。
- 在 `ToolbarConfig` 之前加:
```ts
/** 「更多」菜单的选项:官方 NDropdown 的 options 原样透传(文档只保证 label / key / disabled 与 { type: 'divider' })。 */
export type ToolbarMoreOption = NonNullable<DropdownProps['options']>[number]
```
- `ToolbarConfig` 里加:
```ts
  /** 「更多」菜单(导出 / 导入 / …由宿主定义);不传、空数组或只有分隔线时不显示按钮。选中后发 moreSelect。 */
  more?: ToolbarMoreOption[]
```
  并把 `refresh?: boolean // 默认 true` 的注释改成 `// 默认 true;静态数据模式(没传 fetcher)一律不显示`。
- `SmartTableLabels` 里 `refresh: string` 之后加 `more: string`。

`src/labels.ts`:`refresh: 'Refresh',` 之后加 `more: 'More',`。

`src/icons.ts`:在 `ColumnsIcon` 之后加:
```ts
export const ChevronDownIcon = lineIcon(['M6 9l6 6 6-6'])
export const CloseIcon = lineIcon(['M18 6L6 18', 'M6 6l12 12'])
```

- [ ] **Step 4: 实现 —— `Toolbar.vue`**

`<script setup>` 改为(整段替换):
```ts
// 表格卡片头:标题 + 左侧操作区(#left)+ 右侧:宿主按钮(#right)、「更多」菜单、内置图标(刷新/密度/列设置 #settings)。
import { computed, type PropType } from 'vue'
import { NButton, NDropdown, NSpace, NTooltip } from 'naive-ui'
import type { DropdownOption } from 'naive-ui'
import type { Density, SmartTableLabels, ToolbarConfig, ToolbarMoreOption } from './types'
import { ChevronDownIcon, DensityIcon, RefreshIcon } from './icons'

const props = defineProps({
  title: { type: String, default: undefined },
  labels: { type: Object as PropType<SmartTableLabels>, required: true },
  config: { type: Object as PropType<ToolbarConfig | false>, default: () => ({}) },
  density: { type: String as PropType<Density>, required: true },
  /** 远程模式(传了 fetcher)。静态数据模式下刷新什么都不做,所以不显示刷新按钮。 */
  remote: { type: Boolean, default: true },
})

const emit = defineEmits<{
  refresh: []
  'update:density': [d: Density]
  moreSelect: [key: string | number, option: DropdownOption]
}>()

const cfg = computed<ToolbarConfig>(() => (props.config === false ? { refresh: false, density: false, columnSettings: false } : props.config))

const densityOptions = computed(() => [
  { label: (props.density === 'comfortable' ? '✓ ' : '') + props.labels.densityComfortable, key: 'comfortable' },
  { label: (props.density === 'compact' ? '✓ ' : '') + props.labels.densityCompact, key: 'compact' },
])

// 只有分隔线 / 自定义渲染项时没有可选的东西,不渲染「更多」按钮
const moreOptions = computed<ToolbarMoreOption[]>(() => {
  const list = cfg.value.more ?? []
  const selectable = list.some((o) => {
    const t = (o as { type?: string }).type
    return t !== 'divider' && t !== 'render'
  })
  return selectable ? list : []
})

function onMoreSelect(key: string | number, option: DropdownOption) {
  emit('moreSelect', key, option)
}
```
模板:把刷新按钮的 `v-if` 改成 `v-if="cfg.refresh !== false && remote"`,并在 `<slot name="right" />` 之后、刷新按钮之前插入:
```vue
      <n-dropdown v-if="moreOptions.length" trigger="click" placement="bottom-end" :options="moreOptions" @select="onMoreSelect">
        <n-button size="small" icon-placement="right" :aria-label="labels.more">
          {{ labels.more }}
          <template #icon><ChevronDownIcon /></template>
        </n-button>
      </n-dropdown>
```

- [ ] **Step 5: 实现 —— `SmartTable.vue` 与 `index.ts`**

`src/SmartTable.vue`:
- `import type { DataTableInst, PaginationInfo, PaginationProps } from 'naive-ui'` 改为 `import type { DataTableInst, DropdownOption, PaginationInfo, PaginationProps } from 'naive-ui'`。
- `defineEmits` 里加一行:
```ts
  /** 「更多」菜单(toolbar.more)选中某项。 */
  moreSelect: [key: string | number, option: DropdownOption]
```
- 模板里 `<Toolbar ...>` 加 `:remote="isRemote"` 与 `@more-select="(k, o) => emit('moreSelect', k, o)"`。

`src/index.ts`:`export type {... ToolbarConfig, ...}` 的列表里加 `ToolbarMoreOption,`。

- [ ] **Step 6: 跑,确认通过**

Run: `npm test && npm run typecheck`
Expected: 全部通过。**若 typecheck 报 `DropdownProps` 找不到**,核对 `node_modules/naive-ui/es/dropdown/index.d.ts` 里确实导出了 `type DropdownProps`(2.45.3 已核:有)。

- [ ] **Step 7: 提交**

```bash
git add src/types.ts src/labels.ts src/icons.ts src/Toolbar.vue src/SmartTable.vue src/index.ts tests/Toolbar.test.ts tests/SmartTable.test.ts
git commit -m "feat: 静态数据模式隐藏刷新按钮(B5);新增 toolbar.more「更多」菜单与 moreSelect 事件" -m "有意的默认行为变更:静态模式下刷新本来就是空操作,现在不再显示;refresh() 方法保留。" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: 分页 —— 默认每页 100、官方 `simple` + 库自画每页选择器、`paginationBehaviorOnFilter`(B1 / B4 / B9)

> 规格 §1 B1/B4/B9、§5.5。**已在真实 `NPagination` 上验证(设计文档 9.1)**:官方 `simple` 模式**不渲染每页条数选择器**(`Pagination.mjs:665` `!simple && showSizePicker`),所以库自己用官方 `NSelect` 放进 `NPagination` 的官方 `suffix` 渲染函数(分页条高 28px,DOM 顺序 prefix · 上一页 · 输入框 · 下一页 · suffix)。
> - `simple` 默认 `true`;宿主传 `pagination: { simple: false }` 回到页码序列(官方自己的 `simple` 属性,**没有新增 API**),此时走官方 `showSizePicker` / `pageSizes`。
> - 容器宽 < 600px(窄档)不提供 `suffix`(只留总条数与页码输入)。**用 `ResizeObserver` 量库根节点宽度**(库已经在用它量表格容器)。
> - 每页选择器的选项 = 宿主 `pagination.pageSizes`(只取数字项)或全局 `pageSizes`,**并且并上当前值**(Review Focus #2)。
> - 文案:官方 `useLocale` 不是公开 API,没法拿到官方 locale 的「页」,所以新增 label `pageSizeSuffix`(默认 `'page'`,选项显示 `100 / page`;中文宿主设为 `'页'`)。
> - B1:`defaultPageSize` 默认 `100`、`pageSizes` 默认 `[100, 500, 1000]`。⚠ 远程模式请求的 `pageSize` 变 100,后端若限制上限会拒绝,CHANGELOG 单列。`useSmartTable` 这个**无 UI 的导出 hook** 的默认 10 **不动**(规格 B1 只说表格组件)。
> - B9:筛选后分页——宿主显式传了官方 `paginationBehaviorOnFilter` 就照官方(`'current'` 留在当前页、`'first'` 回第 1 页);没传保持库现状(远程回第 1 页;本地不动)。

**Files:**
- Modify: `src/config.ts`、`src/types.ts`(注释 + labels)、`src/labels.ts`、`src/SmartTable.vue`
- Test: `tests/baseline-2.1.1.test.ts`(翻转 3 处)、`tests/SmartTable.test.ts`(追加)

**Interfaces:**
- Consumes: Task 5 已把 `BUILTIN_DEFAULTS.density` 改成 compact(本 Task 只改 `pageSizes`)。
- Produces:
  - `SmartTableLabels.pageSizeSuffix: string`
  - `SmartTable.vue` 内部:`localPageSize: Ref<number>`、`rootWidth: Ref<number>`、`narrowPager: ComputedRef<boolean>`、`pageSizePicker(current, sizes, onChange)`

- [ ] **Step 1: 写失败测试**

在 `tests/SmartTable.test.ts` 末尾追加:
```ts
describe('SmartTable 分页(B1 / B4 / B9)', () => {
  const base = { columns: [{ key: 'name', title: 'Name' }] as SmartTableColumn<Row>[], rowKey: 'id' }
  type PagerProps = {
    simple?: boolean
    pageSize?: number
    showSizePicker?: boolean
    pageSizes?: unknown[]
    suffix?: () => { type: unknown; props: Record<string, any> }
    onUpdatePage?: (p: number) => void
  }
  const pagerProps = (w: ReturnType<typeof mount>) => w.findComponent(NDataTable).props('pagination') as PagerProps

  it('B1 / B4:静态模式默认每页 100、simple、带库自画的每页选择器(官方 showSizePicker 不设)', () => {
    const wrapper = mount(SmartTable, { props: { ...base, data: rows } })
    const p = pagerProps(wrapper)
    expect(p.simple).toBe(true)
    expect(p.pageSize).toBe(100)
    expect(p.showSizePicker).toBeUndefined()
    expect(typeof p.suffix).toBe('function')
    wrapper.unmount()
  })

  it('suffix 渲染出 NSelect:选项 = 全局 pageSizes,文案取 labels.pageSizeSuffix', () => {
    const wrapper = mount(SmartTable, { props: { ...base, data: rows, labels: { pageSizeSuffix: '页' } } })
    const vnode = pagerProps(wrapper).suffix!()
    expect(vnode.type).toBe(NSelect)
    expect(vnode.props.value).toBe(100)
    expect(vnode.props.options).toEqual([
      { label: '100 / 页', value: 100 },
      { label: '500 / 页', value: 500 },
      { label: '1000 / 页', value: 1000 },
    ])
    wrapper.unmount()
  })

  it('[Review Focus 2] 宿主传 pageSize: 10(不在 pageSizes 里)→ 选项里并上 10,当前值不会显示成空白', () => {
    const wrapper = mount(SmartTable, { props: { ...base, data: rows, pagination: { pageSize: 10 } } })
    const vnode = pagerProps(wrapper).suffix!()
    expect(vnode.props.value).toBe(10)
    expect((vnode.props.options as Array<{ value: number }>).map((o) => o.value)).toEqual([10, 100, 500, 1000])
    wrapper.unmount()
  })

  it('宿主传 pagination.pageSizes 时,选择器用宿主的(只取数字项)', () => {
    const wrapper = mount(SmartTable, { props: { ...base, data: rows, pagination: { pageSizes: [20, 50] } } })
    const vnode = pagerProps(wrapper).suffix!()
    expect((vnode.props.options as Array<{ value: number }>).map((o) => o.value)).toEqual([20, 50, 100])
    wrapper.unmount()
  })

  it('pagination: { simple: false } → 回到页码序列,走官方 showSizePicker / pageSizes,不画 suffix', () => {
    const wrapper = mount(SmartTable, { props: { ...base, data: rows, pagination: { simple: false } } })
    const p = pagerProps(wrapper)
    expect(p.simple).toBe(false)
    expect(p.showSizePicker).toBe(true)
    expect(p.pageSizes).toEqual([100, 500, 1000])
    expect(p.suffix).toBeUndefined()
    wrapper.unmount()
  })

  it('全局 showSizePicker: false → 不画每页选择器', () => {
    const wrapper = mount(SmartTable, { props: { ...base, data: rows }, global: { provide: { [SMART_TABLE_DEFAULTS as symbol]: { showSizePicker: false } } } })
    expect(pagerProps(wrapper).suffix).toBeUndefined()
    wrapper.unmount()
  })

  it('远程模式:首次请求 pageSize = 100;选择器改 500 → 回第 1 页按 500 重查', async () => {
    const fetcher = vi.fn(async (_p: Record<string, unknown>) => ({ items: rows, total: 2 }))
    const wrapper = mount(SmartTable, { props: { ...base, fetcher } })
    await flushPromises()
    expect(fetcher.mock.calls[0][0]).toMatchObject({ page: 1, pageSize: 100 })
    pagerProps(wrapper).suffix!().props['onUpdate:value'](500)
    await flushPromises()
    expect(fetcher.mock.calls.at(-1)![0]).toMatchObject({ page: 1, pageSize: 500 })
    wrapper.unmount()
  })

  it('本地模式:选择器改 500 → 表格 pageSize 变 500', async () => {
    const wrapper = mount(SmartTable, { props: { ...base, data: rows } })
    pagerProps(wrapper).suffix!().props['onUpdate:value'](500)
    await nextTick()
    expect(pagerProps(wrapper).pageSize).toBe(500)
    wrapper.unmount()
  })

  describe('窄档(库根节点宽 < 600)不画每页选择器', () => {
    class RO {
      static instances: RO[] = []
      cb: () => void
      constructor(cb: () => void) {
        this.cb = cb
        RO.instances.push(this)
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    it('量到根节点宽 500 → 没有 suffix;量到 900 → 有', async () => {
      RO.instances = []
      vi.stubGlobal('ResizeObserver', RO)
      const wrapper = mount(SmartTable, { props: { ...base, data: rows }, attachTo: document.body })
      Object.defineProperty(wrapper.element, 'clientWidth', { value: 500, configurable: true })
      RO.instances.forEach((i) => i.cb())
      await nextTick()
      expect(pagerProps(wrapper).suffix).toBeUndefined()

      Object.defineProperty(wrapper.element, 'clientWidth', { value: 900, configurable: true })
      RO.instances.forEach((i) => i.cb())
      await nextTick()
      expect(typeof pagerProps(wrapper).suffix).toBe('function')
      wrapper.unmount()
      vi.unstubAllGlobals()
    })
  })

  describe('B9 筛选后分页', () => {
    const filterCols = [{ key: 'name', title: 'Name', filter: true }] as SmartTableColumn<Row>[]
    const value = { logic: 'and' as const, conditions: [{ action: 'contains' as const, value: 'a' }] }

    it('默认(宿主没传)保持库现状:远程回第 1 页', async () => {
      const fetcher = vi.fn(async (_p: Record<string, unknown>) => ({ items: rows, total: 500 }))
      const wrapper = mount(SmartTable, { props: { columns: filterCols, fetcher, rowKey: 'id' } })
      await flushPromises()
      pagerProps(wrapper).onUpdatePage!(3)
      await flushPromises()
      ;(wrapper.vm as unknown as { setFilter: (k: string, v: unknown) => void }).setFilter('name', value)
      await flushPromises()
      expect(fetcher.mock.calls.at(-1)![0]).toMatchObject({ page: 1 })
      wrapper.unmount()
    })

    it('宿主显式传官方 paginationBehaviorOnFilter="current" → 留在当前页', async () => {
      const fetcher = vi.fn(async (_p: Record<string, unknown>) => ({ items: rows, total: 500 }))
      const wrapper = mount(SmartTable, {
        props: { columns: filterCols, fetcher, rowKey: 'id' },
        attrs: { paginationBehaviorOnFilter: 'current' },
      })
      await flushPromises()
      pagerProps(wrapper).onUpdatePage!(3)
      await flushPromises()
      ;(wrapper.vm as unknown as { setFilter: (k: string, v: unknown) => void }).setFilter('name', value)
      await flushPromises()
      expect(fetcher.mock.calls.at(-1)![0]).toMatchObject({ page: 3 })
      wrapper.unmount()
    })
  })
})
```
并把文件顶部 import 补全:
```ts
import { NDataTable, NSelect } from 'naive-ui'
import { SMART_TABLE_DEFAULTS } from '../src/config'
```
(把原来的 `import { NDataTable } from 'naive-ui'` 替换成上面的 `NSelect` 版本;`nextTick` 已在顶部 import。)

- [ ] **Step 2: 跑,确认失败**

Run: `npx vitest run tests/SmartTable.test.ts`
Expected: FAIL —— `p.simple` 为 `undefined`、`pageSize` 不是 100 等。

- [ ] **Step 3: 实现 —— 默认值、labels、类型注释**

`src/config.ts`:`pageSizes?: number[]` 的注释 `内置兜底 [10,20,50]` 改成 `内置兜底 [100,500,1000]`;`BUILTIN_DEFAULTS.pageSizes: [10, 20, 50]` 改成 `[100, 500, 1000]`。

`src/types.ts`:`defaultPageSize?: number // 默认 10` 改成 `defaultPageSize?: number // 默认 100`(仅 `SmartTableProps` 里那一处;`UseSmartTableOptions` 里的 `// 默认 10` 不动);`pagination?: false | Partial<PaginationProps>` 上方注释补一句:`3.0 起默认官方 simple(输入框 / 总页数),每页条数选择器由库自己画;传 { simple: false } 回到页码序列。`;`SmartTableLabels` 里 `more: string` 之后加 `/** 每页条数选择器的单位:选项显示「100 / page」。 */ pageSizeSuffix: string`。

`src/labels.ts`:`more: 'More',` 之后加 `pageSizeSuffix: 'page',`。

- [ ] **Step 4: 实现 —— `SmartTable.vue`**

1. `import { NCard, NDataTable } from 'naive-ui'` 改为 `import { NCard, NDataTable, NSelect } from 'naive-ui'`。
2. props 里 `defaultPageSize: { type: Number, default: 10 }` 改为 `default: 100`。
3. 在 `const localPage = ref(1)` 之后加:
```ts
// 本地模式的每页条数:官方 simple 分页没有自带选择器,库自己画的选择器要能改它,所以用受控的 pageSize
const localPageSize = ref(props.defaultPageSize)
```
4. 在 `const hostWidth = ref(0)` 之后加:
```ts
/** 库根节点宽度(ResizeObserver 维护)。< 600 视为窄档:分页不画每页选择器。0 = 还没量到,按非窄档处理。 */
const rootWidth = ref(0)
const narrowPager = computed(() => rootWidth.value > 0 && rootWidth.value < 600)
```
5. `measureHost()` 函数开头加一行:`rootWidth.value = rootRef.value?.clientWidth ?? 0`;`onMounted` 里 `measureHost()` 之前加:
```ts
  if (resizeObserver && rootRef.value) resizeObserver.observe(rootRef.value)
```
6. 在 `paginationPrefix` 之后加:
```ts
/** 每页条数选择器:官方 simple 不带(Pagination.mjs:665),用官方 NSelect 放进 NPagination 的官方 suffix。选项并上当前值,免得显示成空白。 */
function pageSizePicker(current: number, sizes: number[], onChange: (n: number) => void) {
  const unit = mergedLabels.value.pageSizeSuffix
  const all = [...new Set([...sizes, current])].sort((a, b) => a - b)
  return () =>
    h(NSelect, {
      size: 'small',
      style: 'width: 120px',
      value: current,
      options: all.map((n) => ({ label: `${n} / ${unit}`, value: n })),
      'onUpdate:value': (n: number) => onChange(n),
    })
}
```
7. 把整个 `mergedPagination` 替换为:
```ts
const mergedPagination = computed<false | PaginationProps>(() => {
  if (props.pagination === false) return false
  const user = props.pagination ?? {}
  // 3.0 起默认官方 simple;传 { simple: false } 回到页码序列(此时走官方 showSizePicker / pageSizes)
  const simple = user.simple ?? true
  const base: Partial<PaginationProps> = { simple, prefix: paginationPrefix.value }
  if (!simple) {
    base.showSizePicker = defaults.showSizePicker
    base.pageSizes = defaults.pageSizes
  }
  // simple 下官方不渲染每页选择器:库自己画;窄档、宿主自带 suffix、全局关了选择器时都不画
  const wantPicker = simple && defaults.showSizePicker && !narrowPager.value && !user.suffix
  const sizes = (user.pageSizes ?? defaults.pageSizes).filter((s): s is number => typeof s === 'number')
  if (isRemote.value) {
    if (wantPicker) base.suffix = pageSizePicker(user.pageSize ?? pagination.pageSize, sizes, (n) => void table.onPageSize(n))
    return {
      ...base,
      page: pagination.page,
      pageSize: pagination.pageSize,
      itemCount: pagination.itemCount,
      onUpdatePage: table.onPage,
      onUpdatePageSize: table.onPageSize,
      ...user,
    }
  }
  if (wantPicker) {
    base.suffix = pageSizePicker(user.pageSize ?? localPageSize.value, sizes, (n) => {
      localPageSize.value = n
      localPage.value = 1
      tableRef.value?.page(1) // 官方 DataTableInst.page:改每页条数后回第 1 页
    })
  }
  return {
    ...base,
    pageSize: localPageSize.value,
    defaultPage: localPage.value,
    ...user,
    onUpdatePage: (p: number) => {
      localPage.value = p
      // Naive 的 onUpdatePage 允许传数组(多个监听器合并),宿主理论上也可能这么传
      const hostHandler = user.onUpdatePage
      if (Array.isArray(hostHandler)) hostHandler.forEach((fn) => fn(p))
      else hostHandler?.(p)
    },
    onUpdatePageSize: (s: number) => {
      localPageSize.value = s
      const hostHandler = user.onUpdatePageSize
      if (Array.isArray(hostHandler)) hostHandler.forEach((fn) => fn(s))
      else hostHandler?.(s)
    },
  }
})
```
8. B9:把 `useFilters` 的 `onChange` 整个替换为:
```ts
  onChange: (key, value, state) => {
    // 筛选后的分页行为:宿主显式传了官方 paginationBehaviorOnFilter 就照官方;没传保持库现状
    // (远程回第 1 页;本地不动,页码由 Naive 夹回合法范围)。这是对官方默认值 'current' 的有意偏离。
    const behavior = (attrs.paginationBehaviorOnFilter ?? attrs['pagination-behavior-on-filter']) as
      | 'first'
      | 'current'
      | undefined
    if (isRemote.value) void (behavior === 'current' ? table.load() : table.search())
    else if (behavior === 'first') {
      localPage.value = 1
      tableRef.value?.page(1)
    }
    emit('filterChange', key, value, state)
  },
```
(`tableRef` / `localPage` 在文件更下方才声明为 `const`,但回调在筛选变化时才执行,已过了声明,不会触发 TDZ。)

- [ ] **Step 5: 翻转特征测试 [B1][B4]**

`tests/baseline-2.1.1.test.ts`:
1. 「[B1][B2] 内置兜底」用例里 `expect(BUILTIN_DEFAULTS.pageSizes).toEqual([10, 20, 50])` 改为 `[100, 500, 1000]`(标题同步成 `'[B1 已翻转] 内置兜底:每页 [100,500,1000];[B2 已翻转] 密度 compact'`)。
2. 整个 `describe('2.1.1 特征:分页')` 改为:
```ts
describe('3.0 分页(B1 / B4 已翻转)', () => {
  it('静态模式:默认每页 100、simple、库自画每页选择器', () => {
    const wrapper = mount(SmartTable, { props: { columns: [{ key: 'name', title: 'Name' }], data: rows, rowKey: 'id' } })
    const p = wrapper.findComponent(NDataTable).props('pagination') as Record<string, unknown>
    expect(p.pageSize).toBe(100)
    expect(p.simple).toBe(true)
    expect(typeof p.suffix).toBe('function')
    wrapper.unmount()
  })

  it('远程模式:首次请求 pageSize = 100', async () => {
    const fetcher = vi.fn(async () => ({ items: rows, total: 2 }))
    const wrapper = mount(SmartTable, { props: { columns: [{ key: 'name', title: 'Name' }], fetcher, rowKey: 'id' } })
    await flushPromises()
    expect(fetcher).toHaveBeenCalledWith(expect.objectContaining({ page: 1, pageSize: 100 }))
    wrapper.unmount()
  })
})
```

- [ ] **Step 6: 跑,确认全部通过**

Run: `npm test && npm run typecheck`
Expected: 全部通过。**若「窄档」用例失败**:确认 `measureHost()` 里确实读了 `rootRef.value?.clientWidth`、`onMounted` 里确实 `observe(rootRef.value)`;jsdom 里 `clientWidth` 默认 0,用例靠 `Object.defineProperty` 覆盖。

- [ ] **Step 7: 提交**

```bash
git add src/config.ts src/types.ts src/labels.ts src/SmartTable.vue tests/baseline-2.1.1.test.ts tests/SmartTable.test.ts
git commit -m "feat!: 默认每页 100 条、分页默认官方 simple 并由库自画每页选择器、筛选后分页可由官方 paginationBehaviorOnFilter 控制(B1/B4/B9)" -m "有意的默认行为变更:回退 → defaultPageSize / pageSizes / pagination: { simple: false }。⚠ 远程模式请求的 pageSize 由 10 变 100,后端若限制 pageSize 上限会拒绝。" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: 卡片内边距 —— 四边统一 16px(B11)

> 规格 §1 B11、§4。官方做法(已核 `card/styles/_common.mjs`、`Card.mjs:107-144`):`size="small"` + 卡片自己的 `theme-overrides: { paddingSmall: '16px 16px 16px' }`(`getPadding` 拆成 `--n-padding-top / left / bottom`),**只作用于库里这两张卡片**(`SmartTable.vue` 的表格卡片、`SearchForm.vue` 的搜索卡片),不动宿主的全局主题。官方 medium 是 `19px 24px 20px`,上下左右不等;窄档原来又是另一套。

**Files:**
- Create: `src/cardStyle.ts`
- Modify: `src/SmartTable.vue`、`src/SearchForm.vue`
- Test: `tests/SmartTable.test.ts`(追加)

**Interfaces:**
- Produces: `cardStyle.ts`:`export const CARD_THEME_OVERRIDES: { paddingSmall: string }`(值 `'16px 16px 16px'`)。

- [ ] **Step 1: 写失败测试**

在 `tests/SmartTable.test.ts` 末尾追加(顶部 import 补 `NCard`:`import { NCard, NDataTable, NSelect } from 'naive-ui'`):
```ts
describe('SmartTable 卡片内边距(B11)', () => {
  it('表格卡片用官方 size="small" + 只作用于它自己的 paddingSmall 覆盖(四边 16px)', () => {
    const wrapper = mount(SmartTable, { props: { columns: [{ key: 'name', title: 'Name' }], data: rows, rowKey: 'id' } })
    const card = wrapper.findComponent(NCard)
    expect(card.props('size')).toBe('small')
    expect(card.props('themeOverrides')).toEqual({ paddingSmall: '16px 16px 16px' })
    wrapper.unmount()
  })
})
```

- [ ] **Step 2: 跑,确认失败**

Run: `npx vitest run tests/SmartTable.test.ts -t "卡片内边距"`
Expected: FAIL —— `size` 是 `'medium'`。

- [ ] **Step 3: 实现**

Create `src/cardStyle.ts`:
```ts
import type { CardProps } from 'naive-ui'

/**
 * 库里两张卡片(搜索卡片、表格卡片)的内边距:四边 16px(B11)。
 * 官方 medium 是 19px 24px 20px(上下左右不等),small 是 12px 16px 12px(上下 12)。
 * 做法:size="small" + 只作用于这张卡片的 paddingSmall 覆盖(getPadding 拆成 top / left / bottom),
 * 不动宿主的全局主题。想改回官方 medium 的宿主,给卡片传官方 size / 自己的主题覆盖即可。
 */
export const CARD_THEME_OVERRIDES: NonNullable<CardProps['themeOverrides']> = {
  paddingSmall: '16px 16px 16px',
}
```
`src/SmartTable.vue`:`import` 区加 `import { CARD_THEME_OVERRIDES } from './cardStyle'`;模板里 `<n-card :bordered="true" class="smart-table-card">` 改为:
```vue
    <n-card :bordered="true" size="small" :theme-overrides="CARD_THEME_OVERRIDES" class="smart-table-card">
```
`src/SearchForm.vue`:`import` 区加 `import { CARD_THEME_OVERRIDES } from './cardStyle'`;模板里 `<n-card v-else :bordered="true" class="smart-table-search">` 改为:
```vue
  <n-card v-else :bordered="true" size="small" :theme-overrides="CARD_THEME_OVERRIDES" class="smart-table-search">
```

- [ ] **Step 4: 跑,确认通过**

Run: `npm test && npm run typecheck`
Expected: 全部通过。**若 typecheck 报 `CardProps` 未导出**:改为 `import type { CardProps } from 'naive-ui'` 所在的实际导出名(核对 `node_modules/naive-ui/es/card/index.d.ts`);不要用 `any` 绕过。

- [ ] **Step 5: 浏览器里量一次(规格写了实测值,落地后必须复现)**

Run: `node_modules/.bin/vite --port 5173`(仓库根,用 `index.html` + `playground/`),打开 playground 的「基础」示例,在浏览器控制台执行:
```js
const card = document.querySelector('.smart-table-card')
const r = (e) => e.getBoundingClientRect()
const c = r(card), kids = [...card.children].filter(e => r(e).height > 0)
;({ top: r(kids[0]).top - c.top, bottom: c.bottom - r(kids.at(-1)).bottom,
    left: Math.min(...kids.map(e => r(e).left)) - c.left, right: c.right - Math.max(...kids.map(e => r(e).right)) })
```
Expected: 四个值**都是 17**(16px 内边距 + 1px 描边)。若不是,记录实测值并停下来看 `n-card` 的 `--n-padding-*`。结束后关掉 vite。

- [ ] **Step 6: 提交**

```bash
git add src/cardStyle.ts src/SmartTable.vue src/SearchForm.vue tests/SmartTable.test.ts
git commit -m "feat!: 表格卡片与搜索卡片内边距统一为四边 16px(B11)" -m "有意的默认外观变更:官方 medium 19/24/20(窄档 12/16)→ 四边 16px;回退 → 给卡片传官方 size / 自己的主题覆盖。" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: 表头图标 —— 悬停才显示、触屏兜底、漏斗可键盘聚焦、条数角标(B6 / A)

> 规格 §1 B6、§3、§5.3、§5.7。
> - 未激活的排序箭头、漏斗**平时 `opacity: 0`(仍占位,不回流)**,悬停该列表头或 `:focus-within` 时淡入(0.15s);**常驻例外**:正在排序的列箭头、已筛选的列漏斗、面板打开的那一列漏斗。
> - 触屏兜底:`@media (hover: none)` 下未激活的图标 `opacity: .5` 常驻(仍低于激活态的主色);列宽拖拽热区加宽到 24px。
> - **现状问题(已读源码)**:`ColumnFilter.vue` 里漏斗 `NButton` 写了 `:focusable="false"`,键盘根本 Tab 不到漏斗——规格里「漏斗可 Tab 聚焦」在库里**现在并不成立**,本任务要去掉它。(官方排序表头本来就没有键盘操作,`th` 无 `tabindex`,设计文档 9.1;本期不解决。)
> - 同列有效条件 > 1 条时漏斗旁加条数角标;漏斗 `aria-label` 含「已筛选 N 条」,走 labels,渲染期求值。
> - 官方类名(已在真实 `NDataTable` 上验证,设计文档 9.1):`.n-data-table-th .n-data-table-sorter`、`.n-data-table-th--sorting`。

**Files:**
- Modify: `src/types.ts`、`src/labels.ts`(`filterActiveCount`)、`src/ColumnFilter.vue`、`src/SmartTable.vue`(样式)
- Test: `tests/ColumnFilter.test.ts`(追加)

**Interfaces:**
- Consumes: Task 2 的 `activeConditions`。
- Produces: `SmartTableLabels.filterActiveCount: string`(含 `{n}` 占位);`labels.ts` 里 `fmt(tpl: string, vars: Record<string, string | number>): string`;漏斗触发器的 CSS 类 `smart-table-filter-trigger--active` / `--open`、角标类 `smart-table-filter-badge`。

- [ ] **Step 1: 写失败测试**

`tests/ColumnFilter.test.ts`:把顶部 `labels` 常量扩成(并在 import 里加 `fmt`):
```ts
import { fmt } from '../src/labels'

const labels = {
  filter: '过滤',
  filterReset: '重置',
  filterConfirm: '确定',
  filterSelectAll: '全选',
  filterActiveCount: '已筛选 {n} 条',
} as unknown as SmartTableLabels
```
在文件末尾追加:
```ts
describe('fmt', () => {
  it('替换 {n} 占位,未提供的变量原样保留', () => {
    expect(fmt('已筛选 {n} 条', { n: 3 })).toBe('已筛选 3 条')
    expect(fmt('{a}-{b}', { a: 1 })).toBe('1-{b}')
  })
})

describe('ColumnFilter 漏斗触发器(B6 / 键盘可达)', () => {
  function mountFilter(value: FilterValue | null) {
    return mount(ColumnFilter, {
      props: { def: buildOptionsDef(), value, labels, getOptions: () => [], isLoadingOptions: () => false },
      attachTo: document.body,
    })
  }

  it('漏斗按钮可被键盘聚焦(不再是 tabindex=-1)', () => {
    const wrapper = mountFilter(null)
    const btn = wrapper.find('.smart-table-filter-trigger button')
    expect(btn.exists()).toBe(true)
    expect(btn.attributes('tabindex')).not.toBe('-1')
    wrapper.unmount()
  })

  it('未生效:没有 --active 类、没有角标,aria-label 就是「过滤」', () => {
    const wrapper = mountFilter(null)
    expect(wrapper.find('.smart-table-filter-trigger--active').exists()).toBe(false)
    expect(wrapper.find('.smart-table-filter-badge').exists()).toBe(false)
    expect(wrapper.find('.smart-table-filter-trigger button').attributes('aria-label')).toBe('过滤')
    wrapper.unmount()
  })

  it('生效 1 条:有 --active 类,没有角标', () => {
    const wrapper = mountFilter({ logic: 'and', conditions: [{ action: 'equal', value: 1 }] })
    expect(wrapper.find('.smart-table-filter-trigger--active').exists()).toBe(true)
    expect(wrapper.find('.smart-table-filter-badge').exists()).toBe(false)
    wrapper.unmount()
  })

  it('生效 > 1 条:出现条数角标,aria-label 带「已筛选 N 条」', () => {
    const wrapper = mountFilter(optionsToFilterValue([1, 2, 3]))
    expect(wrapper.find('.smart-table-filter-badge').text()).toBe('3')
    expect(wrapper.find('.smart-table-filter-trigger button').attributes('aria-label')).toBe('过滤(已筛选 3 条)')
    wrapper.unmount()
  })
})
```

- [ ] **Step 2: 跑,确认失败**

Run: `npx vitest run tests/ColumnFilter.test.ts`
Expected: FAIL —— `fmt` 未导出;`tabindex` 是 `-1`;没有角标与 `--active` 类。

- [ ] **Step 3: 实现 —— labels、`fmt`**

`src/types.ts`:`SmartTableLabels` 的 `filterSelectAll: string` 之后加 `/** 漏斗 aria-label 的后缀,含 {n} 占位(有效条件数)。 */ filterActiveCount: string`。
`src/labels.ts`:`filterSelectAll: 'Select all',` 之后加 `filterActiveCount: 'filtered by {n}',`;文件末尾加:
```ts
/** 极简模板:把 {name} 替换成 vars[name];没提供的变量原样保留。 */
export function fmt(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m))
}
```

- [ ] **Step 4: 实现 —— `ColumnFilter.vue` 的触发器**

`<script setup>`:
- import 区把 `import { filterValueToOptions, isFilterActive, optionsToFilterValue } from './filter'` 改为 `import { activeConditions, filterValueToOptions, isFilterActive, optionsToFilterValue } from './filter'`;再加 `import { fmt } from './labels'`(已有 `ACTION_LABEL_KEY` 的 import 行则合并成 `import { ACTION_LABEL_KEY, fmt } from './labels'`)。
- `const active = computed(...)` 之后加:
```ts
const activeCount = computed(() => activeConditions(props.value).length)
// 漏斗的无障碍名:多于 1 条时带条数(走 labels,渲染期求值)
const ariaLabel = computed(() =>
  activeCount.value > 1 ? `${props.labels.filter}(${fmt(props.labels.filterActiveCount, { n: activeCount.value })})` : props.labels.filter,
)
```
模板里触发器整段替换为:
```vue
    <template #trigger>
      <!-- stop:sorter 列的表头点击会触发排序,点漏斗不该顺带把表排一遍 -->
      <span
        class="smart-table-filter-trigger"
        :class="{ 'smart-table-filter-trigger--active': active, 'smart-table-filter-trigger--open': show }"
        @click.stop
      >
        <n-tooltip trigger="hover" :disabled="show">
          <template #trigger>
            <n-button quaternary size="tiny" :type="active ? 'primary' : 'default'" :aria-label="ariaLabel">
              <template #icon><FilterIcon /></template>
            </n-button>
          </template>
          {{ labels.filter }}
        </n-tooltip>
        <span v-if="activeCount > 1" class="smart-table-filter-badge">{{ activeCount }}</span>
      </span>
    </template>
```
(与旧版唯一的区别:去掉了 `:focusable="false"`,加了两个状态类与角标。)
`<style scoped>` 里在 `.smart-table-filter-trigger {...}` 之后加:
```css
.smart-table-filter-badge {
  margin-left: 2px;
  min-width: 14px;
  height: 14px;
  padding: 0 3px;
  border-radius: 7px;
  font-size: 10px;
  line-height: 14px;
  text-align: center;
  background: var(--n-th-icon-color-active);
  color: #fff;
}
```

- [ ] **Step 5: 实现 —— 悬停显示与触屏兜底的样式(`SmartTable.vue`)**

在 `<style scoped>` 里、`.smart-table :deep(.smart-table-th) {...}` 规则之后追加:
```css
/* 表头图标「悬停才显示」(B6):未激活的排序箭头与漏斗平时透明(仍占位,不回流),悬停该列表头或
   键盘聚焦到表头内时淡入。官方类名已在真实 NDataTable 上核对(设计文档 9.1)。
   常驻例外:正在排序的列箭头、已筛选的列漏斗、面板打开的那一列漏斗。 */
.smart-table :deep(.n-data-table-th .n-data-table-sorter),
.smart-table :deep(.n-data-table-th .smart-table-filter-trigger) {
  opacity: 0;
  transition: opacity 0.15s;
}
.smart-table :deep(.n-data-table-th:hover .n-data-table-sorter),
.smart-table :deep(.n-data-table-th:hover .smart-table-filter-trigger),
.smart-table :deep(.n-data-table-th:focus-within .smart-table-filter-trigger),
.smart-table :deep(.n-data-table-th--sorting .n-data-table-sorter),
.smart-table :deep(.smart-table-filter-trigger--active),
.smart-table :deep(.smart-table-filter-trigger--open) {
  opacity: 1;
}
/* 触屏没有悬停:未激活的图标改成淡显常驻(仍低于激活态的主色),列宽拖拽热区加宽到 24px。 */
@media (hover: none) {
  .smart-table :deep(.n-data-table-th .n-data-table-sorter),
  .smart-table :deep(.n-data-table-th .smart-table-filter-trigger) {
    opacity: 0.5;
  }
  .smart-table :deep(.smart-table-filter-trigger--active),
  .smart-table :deep(.smart-table-filter-trigger--open),
  .smart-table :deep(.n-data-table-th--sorting .n-data-table-sorter) {
    opacity: 1;
  }
  .smart-table :deep(.n-data-table-resize-button) {
    width: 24px;
    right: -12px;
  }
}
```

- [ ] **Step 6: 跑,确认通过**

Run: `npm test && npm run typecheck`
Expected: 全部通过。

- [ ] **Step 7: 浏览器验证(CSS 无法在 jsdom 里验证,必须看一眼)**

Run: `node_modules/.bin/vite --port 5173`,打开 playground「基础」示例(有可排序、可过滤的列)。逐项确认并记录:
1. 鼠标不在表头上时,**没有**任何灰色漏斗/排序箭头;鼠标移到某列表头,该列的漏斗和箭头淡入;移开淡出。
2. 点某列排序后,鼠标移开,**该列的箭头仍然在**;给某列加筛选后,鼠标移开,**该列漏斗仍然在**(主色)。
3. 按 Tab,焦点能落到漏斗按钮上,且漏斗按钮此时可见(`:focus-within`)。
4. 用 DevTools 的 Sensors 面板(或 Chrome 的「模拟触屏」)切到触屏:未激活的图标变成半透明常驻。
Expected: 四条都成立。记录没有成立的项,**不要**假装通过。结束后关掉 vite。

- [ ] **Step 8: 提交**

```bash
git add src/types.ts src/labels.ts src/ColumnFilter.vue src/SmartTable.vue tests/ColumnFilter.test.ts
git commit -m "feat: 表头排序箭头/漏斗悬停才显示、触屏淡显兜底、漏斗可键盘聚焦并带条数角标(B6)" -m "有意的默认外观变更:箭头/漏斗常驻 → 悬停显现(激活态与触屏除外);暂不提供开关。" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 10: 列头过滤面板升级成多条件编辑(B7)+ 键盘 / 焦点 + options 列「勾选 ↔ 高级条件」(C3 落地)

> 规格 §1 B7、§5.3。**这是本计划里改动最大的一个 Task**,所以先把状态机抽成纯函数(`filterDraft.ts`,node 环境可测),再写一行编辑器(`ConditionRow.vue`),最后重写 `ColumnFilter.vue`。
>
> 面板规则(规格已定,这里是它的落地):
> - **condition 列**:多行「操作符 + 值 + 删除」,「添加条件」**上限 5 条**(`MAX_CONDITIONS`);≥ 2 条才出现「且 / 或」,**按字段一个值**(`FilterValue.logic`),只剩一条时 `logic` 归位为 `'and'`;换操作符后若旧值的形状不再适用(无值 / 数组 / 标量)就清空值。
> - **options 列**:默认勾选;底部「高级条件」展开同一份多条件编辑。**不丢信息**:打开面板时若当前值 `!isOptionsRepresentable`,**自动展开高级条件并原样显示**;勾选 → 高级时把勾选转写成条件(0 个 = 空白行、1 个 = `equal`、≥ 2 个 = 一条 `in`);高级 → 勾选(「返回列表」)仅当草稿可表达时允许,否则按钮禁用。提交:勾选形态写 `equal` 取「或」(`optionsToFilterValue`,序列化与 2.1.1 不变),高级形态写草稿。
> - 提交模型不变:面板内改的是**草稿**,点「确定」才提交;「重置」立即生效并关闭;Esc / 点外部丢弃草稿;值输入回车 = 确定。
> - **键盘 / 焦点(设计文档 9.1 已在真实 `NPopover` 上验证:公开的 `NPopover` 不管键盘,焦点不进面板、Esc 不关,`internalTrapFocus` 才有)**,库自己做:打开时焦点移到第一个可编辑控件;面板上监听 Esc 关闭并丢弃草稿;通过 Esc / 确定 / 重置关闭后焦点还给漏斗按钮(**点外部关闭不抢焦点**,否则会把用户刚点的输入框的焦点抢走)。
> - 宿主自定义面板(`def.render`)只复用弹层与提交通道,行为不变。
> - 保留现有 DOM 钩子:`.smart-table-filter-trigger`、`.smart-table-filter-all`、`.smart-table-filter-footer button`(顺序:重置、确定),已有测试依赖它们。

**Files:**
- Create: `src/filterDraft.ts`、`src/ConditionRow.vue`
- Modify: `src/ColumnFilter.vue`(整个文件替换)、`src/types.ts`、`src/labels.ts`
- Test: `tests/filterDraft.test.ts`(新建)、`tests/ColumnFilter.test.ts`(追加)

**Interfaces:**
- Consumes: Task 2 的 `actionValueKind` / `activeConditions` / `isFilterActive`、`ACTION_LABEL_KEY`;Task 3 的 `isOptionsRepresentable` / `filterValueToOptions`;Task 6 的 `CloseIcon`;Task 9 的 `fmt` 与 `filterActiveCount`、触发器的状态类。
- Produces:
  - `filterDraft.ts`:`MAX_CONDITIONS = 5`;`interface FilterDraft { logic: FilterLogic; conditions: FilterCondition[] }`;`blankDraft(action: FilterAction): FilterDraft`;`draftFromValue(value: FilterValue | null | undefined, action: FilterAction): FilterDraft`;`addCondition(d: FilterDraft, action: FilterAction): FilterDraft`;`removeCondition(d: FilterDraft, index: number, action: FilterAction): FilterDraft`;`setConditionAction(d, index, action): FilterDraft`;`setConditionValue(d, index, value: unknown): FilterDraft`;`setLogic(d, logic: FilterLogic): FilterDraft`;`draftToValue(d: FilterDraft): FilterValue | null`
  - `ConditionRow.vue` props:`def: FilterDef`、`condition: FilterCondition`、`labels`、`getOptions`、`isLoadingOptions`、`dateValueFormat`、`removable: boolean`;事件:`update:action`(`FilterAction`)、`update:value`(`unknown`)、`remove`、`enter`
  - `ColumnFilter.vue` 新 prop:`openRequest: number`(默认 0,每次变大 = 请求打开面板;Task 11 的 chips 用)
  - `SmartTableLabels` 新增 6 个键:`filterAddCondition` `filterRemoveCondition` `filterLogicAnd` `filterLogicOr` `filterAdvanced` `filterSimple`

- [ ] **Step 1: 写失败测试 —— 草稿状态机(纯函数)**

Create `tests/filterDraft.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import {
  MAX_CONDITIONS,
  addCondition,
  blankDraft,
  draftFromValue,
  draftToValue,
  removeCondition,
  setConditionAction,
  setConditionValue,
  setLogic,
} from '../src/filterDraft'
import type { FilterValue } from '../src/types'

const fv = (logic: 'and' | 'or', ...c: Array<[string, unknown]>): FilterValue => ({
  logic,
  conditions: c.map(([action, value]) => ({ action: action as never, value })),
})

describe('draftFromValue / blankDraft', () => {
  it('没有值 → 一行空白条件(用给定的默认操作符)', () => {
    expect(draftFromValue(null, 'contains')).toEqual(blankDraft('contains'))
    expect(blankDraft('contains')).toEqual({ logic: 'and', conditions: [{ action: 'contains', value: null }] })
  })
  it('有值 → 拷贝全部条件(不截断,也不与输入共享引用)', () => {
    const v = fv('or', ['equal', 1], ['equal', 2])
    const d = draftFromValue(v, 'contains')
    expect(d).toEqual({ logic: 'or', conditions: [{ action: 'equal', value: 1 }, { action: 'equal', value: 2 }] })
    expect(d.conditions[0]).not.toBe(v.conditions[0])
  })
  it('超过 MAX_CONDITIONS 的编程式值不被截断(只是不能再添加)', () => {
    const v = fv('and', ...Array.from({ length: 7 }, (_, i): [string, unknown] => ['equal', i]))
    expect(draftFromValue(v, 'equal').conditions).toHaveLength(7)
  })
})

describe('addCondition / removeCondition', () => {
  it('添加:追加一行空白条件;到上限后原样返回', () => {
    let d = blankDraft('contains')
    for (let i = 1; i < MAX_CONDITIONS; i++) d = addCondition(d, 'contains')
    expect(d.conditions).toHaveLength(MAX_CONDITIONS)
    expect(addCondition(d, 'contains')).toBe(d)
  })
  it('删除:删掉指定行;删光则回到一行空白', () => {
    const d = draftFromValue(fv('and', ['contains', 'a'], ['contains', 'b']), 'contains')
    expect(removeCondition(d, 0, 'contains').conditions).toEqual([{ action: 'contains', value: 'b' }])
    const one = blankDraft('contains')
    expect(removeCondition(one, 0, 'equal')).toEqual(blankDraft('equal'))
  })
})

describe('setConditionAction(换操作符时旧值不再适用就清空)', () => {
  const d = draftFromValue(fv('and', ['contains', 'abc']), 'contains')
  it('标量 → 标量:值保留', () => {
    expect(setConditionAction(d, 0, 'equal').conditions[0]).toEqual({ action: 'equal', value: 'abc' })
  })
  it('标量 → 无值 / 数组:值清空', () => {
    expect(setConditionAction(d, 0, 'isNull').conditions[0]).toEqual({ action: 'isNull', value: null })
    expect(setConditionAction(d, 0, 'in').conditions[0]).toEqual({ action: 'in', value: null })
  })
  it('数组 → 标量:值清空;数组 → 数组(in → notIn):值保留', () => {
    const arr = draftFromValue(fv('and', ['in', [1, 2]]), 'equal')
    expect(setConditionAction(arr, 0, 'equal').conditions[0]).toEqual({ action: 'equal', value: null })
    expect(setConditionAction(arr, 0, 'notIn').conditions[0]).toEqual({ action: 'notIn', value: [1, 2] })
  })
  it('只改指定的那一行', () => {
    const two = draftFromValue(fv('and', ['contains', 'a'], ['contains', 'b']), 'contains')
    expect(setConditionAction(two, 1, 'equal').conditions.map((c) => c.action)).toEqual(['contains', 'equal'])
  })
})

describe('setConditionValue / setLogic', () => {
  it('只改指定行的值;setLogic 只改 logic', () => {
    const d = draftFromValue(fv('and', ['contains', 'a'], ['contains', 'b']), 'contains')
    expect(setConditionValue(d, 1, 'z').conditions.map((c) => c.value)).toEqual(['a', 'z'])
    expect(setLogic(d, 'or').logic).toBe('or')
  })
})

describe('draftToValue', () => {
  it('全空 → null', () => {
    expect(draftToValue(blankDraft('contains'))).toBeNull()
  })
  it('只保留生效条件;无值算子算生效', () => {
    const d = draftFromValue(fv('or', ['contains', ''], ['isNull', null], ['contains', 'x']), 'contains')
    expect(draftToValue(d)).toEqual({ logic: 'or', conditions: [{ action: 'isNull', value: null }, { action: 'contains', value: 'x' }] })
  })
  it('只剩一条生效时 logic 归位为 and(「且 / 或」只在 ≥ 2 条时有意义)', () => {
    const d = draftFromValue(fv('or', ['contains', 'x'], ['contains', '']), 'contains')
    expect(draftToValue(d)).toEqual({ logic: 'and', conditions: [{ action: 'contains', value: 'x' }] })
  })
})
```

- [ ] **Step 2: 跑,确认失败**

Run: `npx vitest run tests/filterDraft.test.ts`
Expected: FAIL —— `Cannot find module '../src/filterDraft'`。

- [ ] **Step 3: 实现 `src/filterDraft.ts`**

Create `src/filterDraft.ts`:
```ts
// 列头过滤面板的「草稿」状态机(UI 无关、可单测)。面板内改的是草稿,点「确定」才提交。
import { actionValueKind, activeConditions } from './filter'
import type { FilterAction, FilterCondition, FilterLogic, FilterValue } from './types'

/** 一列最多几条条件(自有取值:超过 5 条的面板在 400px 宽的气泡里已不可读;真有需求走编程式 setFilter)。 */
export const MAX_CONDITIONS = 5

export interface FilterDraft {
  logic: FilterLogic
  conditions: FilterCondition[]
}

export function blankDraft(action: FilterAction): FilterDraft {
  return { logic: 'and', conditions: [{ action, value: null }] }
}

/** 由已生效的过滤值回填草稿;没有值 → 一行空白。条件不截断(编程式给的超过上限的值也原样保留)。 */
export function draftFromValue(value: FilterValue | null | undefined, action: FilterAction): FilterDraft {
  const conditions = (value?.conditions ?? []).filter((c) => c).map((c) => ({ ...c }))
  if (conditions.length === 0) return blankDraft(action)
  return { logic: value?.logic === 'or' ? 'or' : 'and', conditions }
}

export function addCondition(d: FilterDraft, action: FilterAction): FilterDraft {
  if (d.conditions.length >= MAX_CONDITIONS) return d
  return { ...d, conditions: [...d.conditions, { action, value: null }] }
}

/** 删一行;删光了就回到一行空白(面板里至少留一行可编辑)。 */
export function removeCondition(d: FilterDraft, index: number, action: FilterAction): FilterDraft {
  const conditions = d.conditions.filter((_, i) => i !== index)
  return conditions.length ? { ...d, conditions } : blankDraft(action)
}

/** 换操作符:旧值的形状(无值 / 数组 / 标量)与新操作符不一致就清空,不做猜测性转换。 */
export function setConditionAction(d: FilterDraft, index: number, action: FilterAction): FilterDraft {
  return {
    ...d,
    conditions: d.conditions.map((c, i) =>
      i !== index ? c : { action, value: actionValueKind(c.action) === actionValueKind(action) ? c.value : null },
    ),
  }
}

export function setConditionValue(d: FilterDraft, index: number, value: unknown): FilterDraft {
  return { ...d, conditions: d.conditions.map((c, i) => (i === index ? { ...c, value } : c)) }
}

export function setLogic(d: FilterDraft, logic: FilterLogic): FilterDraft {
  return { ...d, logic }
}

/** 草稿 → 提交值:只留生效条件(无值算子算生效);全空 → null;只剩一条时 logic 归位为 and。 */
export function draftToValue(d: FilterDraft): FilterValue | null {
  const conditions = activeConditions({ logic: d.logic, conditions: d.conditions })
  if (conditions.length === 0) return null
  return { logic: conditions.length > 1 ? d.logic : 'and', conditions: conditions.map((c) => ({ ...c })) }
}
```

- [ ] **Step 4: 跑,确认通过**

Run: `npx vitest run tests/filterDraft.test.ts`
Expected: PASS。

- [ ] **Step 5: 提交(纯函数先落地)**

```bash
git add src/filterDraft.ts tests/filterDraft.test.ts
git commit -m "feat: 新增列头过滤面板的草稿状态机 filterDraft(B7 内核,UI 接线见下一个提交)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 6: labels(6 个新键)**

`src/types.ts`:`SmartTableLabels` 里 `filterActiveCount: string` 之后加:
```ts
  filterAddCondition: string
  filterRemoveCondition: string
  /** 同一列多条件的连接方式(「且 / 或」分段按钮)。 */
  filterLogicAnd: string
  filterLogicOr: string
  /** options 列底部展开多条件编辑的入口 / 收起回勾选列表的入口。 */
  filterAdvanced: string
  filterSimple: string
```
`src/labels.ts`:`filterActiveCount: 'filtered by {n}',` 之后加:
```ts
  filterAddCondition: 'Add condition',
  filterRemoveCondition: 'Remove condition',
  filterLogicAnd: 'AND',
  filterLogicOr: 'OR',
  filterAdvanced: 'Advanced conditions',
  filterSimple: 'Back to list',
```

- [ ] **Step 7: 写 `src/ConditionRow.vue`**

Create `src/ConditionRow.vue`:
```vue
<script setup lang="ts">
// 面板里的一行条件:操作符 + 值控件 + 删除。受控(草稿由 ColumnFilter 持有),只发事件。
// 值控件按操作符的值形状分发:无值(isNull 等)→ 禁用的占位框;数组(in / notIn)→ 多选;标量 → 按列类型选控件。
import { computed, type PropType } from 'vue'
import { NButton, NDatePicker, NInput, NInputNumber, NSelect } from 'naive-ui'
import type { SelectMixedOption } from 'naive-ui/es/select/src/interface'
import type { FilterAction, FilterCondition, SmartTableLabels, SmartTableOption } from './types'
import type { FilterDef } from './useColumns'
import { actionValueKind } from './filter'
import { ACTION_LABEL_KEY } from './labels'
import { optionLabel } from './useOptions'
import { CloseIcon } from './icons'

const props = defineProps({
  def: { type: Object as PropType<FilterDef>, required: true },
  condition: { type: Object as PropType<FilterCondition>, required: true },
  labels: { type: Object as PropType<SmartTableLabels>, required: true },
  getOptions: { type: Function as PropType<(key: string) => SmartTableOption[]>, required: true },
  isLoadingOptions: { type: Function as PropType<(key: string) => boolean>, required: true },
  dateValueFormat: { type: String, default: 'yyyy-MM-dd' },
  /** 至少留一行:只有一行时不给删除按钮。 */
  removable: { type: Boolean, default: false },
})

const emit = defineEmits<{
  'update:action': [a: FilterAction]
  'update:value': [v: unknown]
  remove: []
  enter: []
}>()

const kind = computed(() => actionValueKind(props.condition.action))

// 当前操作符不在 def.actions 里时(编程式给了列声明之外的操作符),也要能在下拉里显示出来,不能变成空白
const actionOptions = computed<SelectMixedOption[]>(() => {
  const cur = props.condition.action
  const list = props.def.actions.includes(cur) ? props.def.actions : [cur, ...props.def.actions]
  return list.map((a) => ({ label: props.labels[ACTION_LABEL_KEY[a]], value: a }))
})

/** 过滤勾选 / 下拉按扁平处理:分组选项的父节点本身不是可选值。 */
function flatten(opts: SmartTableOption[]): SmartTableOption[] {
  return opts.flatMap((o) => (o.children?.length ? flatten(o.children) : [o]))
}
const selectOptions = computed<SelectMixedOption[]>(() =>
  flatten(props.getOptions(props.def.optionsKey)).map((o) => ({
    label: optionLabel(o),
    value: o.value as string | number,
    disabled: o.disabled,
  })),
)

const arrayValue = computed(() => (Array.isArray(props.condition.value) ? (props.condition.value as Array<string | number>) : []))

function onKeyup(e: KeyboardEvent) {
  if (e.key === 'Enter') emit('enter')
}
</script>

<template>
  <div class="smart-table-filter-row">
    <n-select
      class="smart-table-filter-action"
      size="small"
      :value="condition.action"
      :options="actionOptions"
      :consistent-menu-width="false"
      @update:value="(a: FilterAction) => emit('update:action', a)"
    />
    <!-- 值控件写成真实元素(不走 <component :is>):重渲染时被 patch 而不是重挂,输入过程中不会掉焦点。
         def.props 放最前面,可透传但盖不掉值绑定与回调。 -->
    <div class="smart-table-filter-value">
      <n-input v-if="kind === 'none'" size="small" disabled :placeholder="labels.filterNoValue" />
      <n-select
        v-else-if="kind === 'array'"
        v-bind="def.props"
        size="small"
        multiple
        filterable
        :tag="def.type !== 'select'"
        :show-arrow="def.type === 'select'"
        :value="arrayValue"
        :options="def.type === 'select' ? selectOptions : []"
        @update:value="(v: unknown) => emit('update:value', v)"
      />
      <n-input-number
        v-else-if="def.type === 'number'"
        v-bind="def.props"
        size="small"
        clearable
        style="width: 100%"
        :value="(condition.value ?? null) as number | null"
        @update:value="(v: unknown) => emit('update:value', v)"
      />
      <n-date-picker
        v-else-if="def.type === 'date'"
        v-bind="def.props"
        type="date"
        size="small"
        clearable
        style="width: 100%"
        :value-format="dateValueFormat"
        :formatted-value="(condition.value ?? null) as string | null"
        @update:formatted-value="(v: unknown) => emit('update:value', v)"
      />
      <n-select
        v-else-if="def.type === 'select'"
        v-bind="def.props"
        size="small"
        clearable
        :value="(condition.value ?? null) as string | number | null"
        :options="selectOptions"
        :loading="isLoadingOptions(def.optionsKey)"
        @update:value="(v: unknown) => emit('update:value', v)"
      />
      <n-input
        v-else
        v-bind="def.props"
        size="small"
        clearable
        :value="(condition.value ?? null) as string | null"
        @update:value="(v: unknown) => emit('update:value', v)"
        @keyup="onKeyup"
      />
    </div>
    <n-button
      v-if="removable"
      class="smart-table-filter-remove"
      quaternary
      circle
      size="tiny"
      :aria-label="labels.filterRemoveCondition"
      @click="emit('remove')"
    >
      <template #icon><CloseIcon /></template>
    </n-button>
  </div>
</template>

<style scoped>
.smart-table-filter-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
/* 定宽 basis:NSelect 根节点是 width:100%,用 flex-basis:auto 会把整行吃掉,值控件被挤成 0 宽。 */
.smart-table-filter-action {
  flex: 0 0 108px;
}
.smart-table-filter-value {
  flex: 1 1 auto;
  min-width: 0;
}
</style>
```

- [ ] **Step 8: 写失败测试 —— `ColumnFilter` 的新行为**

`tests/ColumnFilter.test.ts`:
1. 顶部 import 补:
```ts
import { nextTick } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { NRadioGroup, NSelect } from 'naive-ui'
import ConditionRow from '../src/ConditionRow.vue'
```
(`h, defineComponent` 已 import;合并进已有的 import 行,不要重复声明。)
2. `labels` 常量(Task 9 加过 `filterActiveCount`)再补这些键:
```ts
  filterAddCondition: '添加条件',
  filterRemoveCondition: '删除条件',
  filterLogicAnd: '且',
  filterLogicOr: '或',
  filterAdvanced: '高级条件',
  filterSimple: '返回列表',
  filterNoValue: '无需填值',
  filterEqual: '等于',
  filterNotEqual: '不等于',
  filterContains: '包含',
  filterIsNull: '为空',
```
3. 文件末尾追加:
```ts
describe('ColumnFilter 多条件面板(B7 / C3)', () => {
  const docClick = click
  const conditionDef = (over: Partial<FilterDef> = {}): FilterDef => ({
    key: 'name',
    field: 'name',
    optionsKey: 'name',
    mode: 'condition',
    multiple: true,
    type: 'input',
    actions: ['contains', 'equal', 'isNull'],
    ...over,
  })
  const v = (logic: 'and' | 'or', ...conds: Array<[string, unknown]>): FilterValue => ({
    logic,
    conditions: conds.map(([action, value]) => ({ action: action as never, value })),
  })

  async function openPanel(def: FilterDef, value: FilterValue | null, getOptions = () => [] as never[]) {
    const wrapper = mount(ColumnFilter, {
      props: { def, value, labels, getOptions, isLoadingOptions: () => false },
      attachTo: document.body,
    })
    await wrapper.find('.smart-table-filter-trigger').trigger('click')
    await flushPromises()
    return wrapper
  }
  const footerButtons = () => document.body.querySelectorAll('.smart-table-filter-footer button')
  const confirmBtn = () => footerButtons()[1]
  const lastEmitted = (w: ReturnType<typeof mount>) => {
    const e = w.emitted('update:value')!
    return e[e.length - 1][0] as FilterValue | null
  }

  it('condition 列:面板里能看到全部已有条件(不再只取第一条)', async () => {
    const w = await openPanel(conditionDef(), v('or', ['contains', 'a'], ['equal', 'b']))
    expect(document.body.querySelectorAll('.smart-table-filter-row')).toHaveLength(2)
    w.unmount()
  })

  it('添加条件到上限 5 条后「添加」按钮禁用;≥ 2 条才出现且/或', async () => {
    const w = await openPanel(conditionDef(), null)
    expect(document.body.querySelector('.smart-table-filter-logic')).toBeNull()
    for (let i = 0; i < 4; i++) {
      docClick(document.body.querySelector('.smart-table-filter-add'))
      await nextTick()
    }
    expect(document.body.querySelectorAll('.smart-table-filter-row')).toHaveLength(5)
    expect(document.body.querySelector('.smart-table-filter-logic')).not.toBeNull()
    expect(document.body.querySelector('.smart-table-filter-add')!.hasAttribute('disabled')).toBe(true)
    w.unmount()
  })

  it('两行 + 「或」:确认后提交 { logic: or, conditions: [两条] }', async () => {
    const w = await openPanel(conditionDef(), null)
    docClick(document.body.querySelector('.smart-table-filter-add'))
    await nextTick()
    const rows = w.findAllComponents(ConditionRow)
    rows[0].vm.$emit('update:value', 'a')
    rows[1].vm.$emit('update:value', 'b')
    w.findComponent(NRadioGroup).vm.$emit('update:value', 'or')
    await nextTick()
    docClick(confirmBtn())
    expect(lastEmitted(w)).toEqual(v('or', ['contains', 'a'], ['contains', 'b']))
    w.unmount()
  })

  it('删除到只剩一行:没有「删除」按钮,且提交时 logic 归位为 and', async () => {
    const w = await openPanel(conditionDef(), v('or', ['contains', 'a'], ['contains', 'b']))
    docClick(document.body.querySelector('.smart-table-filter-remove'))
    await nextTick()
    expect(document.body.querySelectorAll('.smart-table-filter-row')).toHaveLength(1)
    expect(document.body.querySelector('.smart-table-filter-remove')).toBeNull()
    docClick(confirmBtn())
    expect(lastEmitted(w)).toEqual(v('and', ['contains', 'b']))
    w.unmount()
  })

  it('无值算子:值位置是禁用的占位框;不填值也能提交', async () => {
    const w = await openPanel(conditionDef(), v('and', ['isNull', null]))
    const input = document.body.querySelector('.smart-table-filter-value input') as HTMLInputElement
    expect(input.disabled).toBe(true)
    expect(input.placeholder).toBe('无需填值')
    docClick(confirmBtn())
    expect(lastEmitted(w)).toEqual(v('and', ['isNull', null]))
    w.unmount()
  })

  it('换操作符:旧值形状不再适用就清空(contains → isNull)', async () => {
    const w = await openPanel(conditionDef(), v('and', ['contains', 'abc']))
    w.findComponent(ConditionRow).vm.$emit('update:action', 'isNull')
    await nextTick()
    docClick(confirmBtn())
    expect(lastEmitted(w)).toEqual(v('and', ['isNull', null]))
    w.unmount()
  })

  it('列声明之外的操作符(编程式给了 notEqual)在下拉里也能显示,不是空白', async () => {
    const def = conditionDef({ actions: ['contains'] })
    const w = await openPanel(def, v('and', ['notEqual', 'x']))
    const select = w.findComponent(ConditionRow).findComponent(NSelect)
    const options = select.props('options') as Array<{ value: string }>
    expect(options.map((o) => o.value)).toEqual(['notEqual', 'contains'])
    w.unmount()
  })

  describe('options 列:勾选 ↔ 高级条件(C3:不丢信息)', () => {
    const opts = [
      { label: 'A', value: 1 },
      { label: 'B', value: 2 },
    ]
    const optionsDef = () => buildOptionsDef()

    it('[Review Focus 3] 当前值是 notEqual:打开时自动展开高级条件并原样显示,确认不覆盖', async () => {
      const value = v('and', ['notEqual', 1])
      const w = await openPanel(optionsDef(), value, () => opts as never[])
      expect(document.body.querySelector('.smart-table-filter-options')).toBeNull() // 没有勾选列表
      expect(document.body.querySelectorAll('.smart-table-filter-row')).toHaveLength(1)
      docClick(confirmBtn())
      expect(lastEmitted(w)).toEqual(value)
      w.unmount()
    })

    it('多条 equal 取「且」(勾选读成「或」会变语义):同样展开高级条件,确认原样提交', async () => {
      const value = v('and', ['equal', 1], ['equal', 2])
      const w = await openPanel(optionsDef(), value, () => opts as never[])
      expect(document.body.querySelector('.smart-table-filter-options')).toBeNull()
      docClick(confirmBtn())
      expect(lastEmitted(w)).toEqual(value)
      w.unmount()
    })

    it('可表达(equal 取「或」)→ 仍是勾选列表', async () => {
      const w = await openPanel(optionsDef(), optionsToFilterValue([1, 2]), () => opts as never[])
      expect(document.body.querySelector('.smart-table-filter-options')).not.toBeNull()
      expect(document.body.querySelector('.smart-table-filter-row')).toBeNull()
      w.unmount()
    })

    it('勾选 → 高级:把勾选转写成条件(1 个 = equal,2 个 = 一条 in),不丢选择', async () => {
      const w = await openPanel(optionsDef(), optionsToFilterValue([1, 2]), () => opts as never[])
      docClick(document.body.querySelector('.smart-table-filter-advanced-open'))
      await nextTick()
      expect(document.body.querySelectorAll('.smart-table-filter-row')).toHaveLength(1)
      docClick(confirmBtn())
      expect(lastEmitted(w)).toEqual(v('and', ['in', [1, 2]]))
      w.unmount()
    })

    it('高级 → 返回列表:草稿不可表达时按钮禁用;改成可表达后才能返回', async () => {
      const w = await openPanel(optionsDef(), v('and', ['notEqual', 1]), () => opts as never[])
      const close = () => document.body.querySelector('.smart-table-filter-advanced-close') as HTMLElement
      expect(close().hasAttribute('disabled')).toBe(true)
      w.findComponent(ConditionRow).vm.$emit('update:action', 'equal')
      await nextTick()
      expect(close().hasAttribute('disabled')).toBe(false)
      docClick(close())
      await nextTick()
      expect(document.body.querySelector('.smart-table-filter-options')).not.toBeNull()
      w.unmount()
    })
  })

  describe('键盘 / 焦点(公开的 NPopover 不管,库自己做)', () => {
    it('打开后焦点进入面板', async () => {
      const w = await openPanel(conditionDef(), null)
      await flushPromises()
      const panel = document.body.querySelector('.smart-table-filter')!
      expect(panel.contains(document.activeElement)).toBe(true)
      w.unmount()
    })

    it('Esc:关闭并丢弃草稿(不提交),焦点还给漏斗按钮', async () => {
      const w = await openPanel(conditionDef(), null)
      w.findComponent(ConditionRow).vm.$emit('update:value', 'draft-only')
      await nextTick()
      document.body.querySelector('.smart-table-filter')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await flushPromises()
      expect(w.emitted('update:value')).toBeUndefined()
      expect(document.activeElement).toBe(w.find('.smart-table-filter-trigger button').element)
      w.unmount()
    })

    it('点「确定」关闭后焦点也还给漏斗按钮', async () => {
      const w = await openPanel(conditionDef(), null)
      w.findComponent(ConditionRow).vm.$emit('update:value', 'x')
      await nextTick()
      docClick(confirmBtn())
      await flushPromises()
      expect(document.activeElement).toBe(w.find('.smart-table-filter-trigger button').element)
      w.unmount()
    })
  })

  it('openRequest 变大 = 请求打开面板(chips 点击用)', async () => {
    const w = mount(ColumnFilter, {
      props: { def: conditionDef(), value: null, labels, getOptions: () => [], isLoadingOptions: () => false, openRequest: 0 },
      attachTo: document.body,
    })
    expect(document.body.querySelector('.smart-table-filter')).toBeNull()
    await w.setProps({ openRequest: 1 })
    await flushPromises()
    expect(document.body.querySelector('.smart-table-filter')).not.toBeNull()
    w.unmount()
  })
})
```
注意:`findComponent(NSelect)` 取的是 `ConditionRow` 里的第一个 `NSelect`(操作符下拉)。

- [ ] **Step 9: 跑,确认失败**

Run: `npx vitest run tests/ColumnFilter.test.ts`
Expected: FAIL —— 新用例里找不到 `.smart-table-filter-add` 等节点、`openRequest` 无效。(已有的 5 条用例此时仍应通过。)

- [ ] **Step 10: 实现 —— 整个替换 `src/ColumnFilter.vue`**

把 `src/ColumnFilter.vue` 整个文件替换为:
```vue
<script setup lang="ts">
// 表头过滤面板:漏斗触发 + 弹层。两种形态共用同一份过滤值模型(FilterValue):
//   options   —— Arco 风格,勾选候选项(等价于若干 equal 条件取「或」);底部「高级条件」展开同一份多条件编辑
//   condition —— Bootstrap Blazor 风格,多行 [操作符 + 值](最多 5 条,≥ 2 条出现且/或)
// 面板内改的是草稿,点「确定」才提交,避免每敲一个字就打一次远程请求;Esc / 点外部丢弃草稿。
// 键盘 / 焦点:公开的 NPopover 不管(焦点不进面板、Esc 不关闭,见设计文档 9.1),这里自己做。
import { computed, nextTick, ref, watch, type PropType } from 'vue'
import { NButton, NCheckbox, NPopover, NRadioButton, NRadioGroup, NSpace, NTooltip, useThemeVars } from 'naive-ui'
import type { FilterAction, FilterLogic, FilterValue, SmartTableLabels, SmartTableOption } from './types'
import type { FilterDef } from './useColumns'
import {
  activeConditions,
  filterValueToOptions,
  isFilterActive,
  isOptionsRepresentable,
  optionsToFilterValue,
} from './filter'
import { fmt } from './labels'
import { optionLabel } from './useOptions'
import { FilterIcon } from './icons'
import ConditionRow from './ConditionRow.vue'
import {
  MAX_CONDITIONS,
  addCondition,
  blankDraft,
  draftFromValue,
  draftToValue,
  removeCondition,
  setConditionAction,
  setConditionValue,
  setLogic,
  type FilterDraft,
} from './filterDraft'

const props = defineProps({
  def: { type: Object as PropType<FilterDef>, required: true },
  value: { type: Object as PropType<FilterValue | null>, default: null },
  labels: { type: Object as PropType<SmartTableLabels>, required: true },
  getOptions: { type: Function as PropType<(key: string) => SmartTableOption[]>, required: true },
  isLoadingOptions: { type: Function as PropType<(key: string) => boolean>, required: true },
  dateValueFormat: { type: String, default: 'yyyy-MM-dd' },
  /** 每次变大 = 请求打开面板(已生效条件 chips 点击时用)。 */
  openRequest: { type: Number, default: 0 },
})

const emit = defineEmits<{
  'update:value': [v: FilterValue | null]
}>()

const themeVars = useThemeVars()
const show = ref(false)
const active = computed(() => isFilterActive(props.value))
const activeCount = computed(() => activeConditions(props.value).length)
// 漏斗的无障碍名:多于 1 条时带条数(走 labels,渲染期求值)
const ariaLabel = computed(() =>
  activeCount.value > 1 ? `${props.labels.filter}(${fmt(props.labels.filterActiveCount, { n: activeCount.value })})` : props.labels.filter,
)

const panelRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLElement | null>(null)
/** 关闭后是否把焦点还给漏斗:Esc / 确定 / 重置 → 是;点外部关闭 → 否(别抢走用户刚点的控件的焦点)。 */
let returnFocus = false

/* ---- 草稿:打开弹层时从当前生效值回填 ---- */

const firstAction = (): FilterAction => props.def.actions[0] ?? 'equal'
const draft = ref<FilterDraft>(blankDraft(firstAction()))
const checked = ref<unknown[]>([])
/** options 列:是否展开「高级条件」(多条件编辑)。 */
const advanced = ref(false)

function loadDraft(from: FilterValue | null) {
  draft.value = draftFromValue(from, firstAction())
  if (props.def.mode === 'options') {
    // 勾选表达不了当前值(notEqual / isNull / 且 的多条 equal …)→ 自动展开高级条件原样显示,不静默丢条件(C3)
    const representable = isOptionsRepresentable(from)
    advanced.value = !representable
    checked.value = representable ? filterValueToOptions(from) : []
  }
}

function focusFirst() {
  panelRef.value
    ?.querySelector<HTMLElement>('input:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])')
    ?.focus()
}

watch(show, (open) => {
  if (open) {
    loadDraft(props.value)
    return
  }
  if (returnFocus) {
    returnFocus = false
    triggerRef.value?.querySelector<HTMLElement>('button')?.focus()
  }
})
// 弹层内容挂载(每次打开都会重新挂载)后再聚焦第一个可编辑控件:内容是 teleport 出去的,show 变 true 时还不在 DOM 里
watch(panelRef, (el) => {
  if (el && show.value) void nextTick(focusFirst)
})
// 外部(编程式 setFilter / clearFilters)改了值,弹层开着也要跟上
watch(
  () => props.value,
  (v) => {
    if (show.value) loadDraft(v)
  },
)
watch(
  () => props.openRequest,
  (n, o) => {
    if (n > 0 && n !== o) show.value = true
  },
)

function close(focusBack: boolean) {
  returnFocus = focusBack
  show.value = false
}

function onPanelKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.stopPropagation()
    close(true) // 丢弃草稿:不 emit
  }
}

/* ---- 选项(options 模式) ---- */

/** 过滤勾选列表按扁平处理:分组选项的父节点本身不是可选值。 */
function flatten(opts: SmartTableOption[]): SmartTableOption[] {
  return opts.flatMap((o) => (o.children?.length ? flatten(o.children) : [o]))
}
const flatOptions = computed(() => flatten(props.getOptions(props.def.optionsKey)))
// disabled 选项的勾选框用户碰不到(界面上就是禁用的),「全选/全不选」不该替它们做主 ——
// 只对用户实际能操作的选项生效,disabled 选项当前是勾是不勾,toggleAll 前后保持不变。
const selectableOptions = computed(() => flatOptions.value.filter((o) => !o.disabled))
const allChecked = computed(
  () => selectableOptions.value.length > 0 && selectableOptions.value.every((o) => checked.value.includes(o.value)),
)
const someChecked = computed(
  () => selectableOptions.value.some((o) => checked.value.includes(o.value)) && !allChecked.value,
)

function toggleOption(value: unknown, on: boolean) {
  if (!props.def.multiple) {
    checked.value = on ? [value] : []
    return
  }
  checked.value = on ? [...checked.value, value] : checked.value.filter((v) => v !== value)
}

function toggleAll(on: boolean) {
  const disabledChecked = checked.value.filter((v) => flatOptions.value.find((o) => o.value === v)?.disabled)
  checked.value = on ? [...disabledChecked, ...selectableOptions.value.map((o) => o.value)] : disabledChecked
}

/* ---- 勾选 ↔ 高级条件 ---- */

/** 勾选 → 条件:0 个 = 空白行,1 个 = equal,≥ 2 个 = 一条 in(不丢选择)。 */
function checkedToDraft(): FilterDraft {
  const n = checked.value.length
  if (n === 0) return blankDraft(firstAction())
  if (n === 1) return { logic: 'and', conditions: [{ action: 'equal', value: checked.value[0] }] }
  return { logic: 'and', conditions: [{ action: 'in', value: [...checked.value] }] }
}
function openAdvanced() {
  draft.value = checkedToDraft()
  advanced.value = true
}
/** 高级 → 勾选:仅当草稿能被勾选无损表达时允许。 */
const canCollapse = computed(() => isOptionsRepresentable(draftToValue(draft.value)))
function closeAdvanced() {
  if (!canCollapse.value) return
  checked.value = filterValueToOptions(draftToValue(draft.value))
  advanced.value = false
}

/* ---- 条件行编辑 ---- */

const showEditor = computed(() => props.def.mode === 'condition' || advanced.value)
const onAction = (i: number, a: FilterAction) => (draft.value = setConditionAction(draft.value, i, a))
const onValue = (i: number, v: unknown) => (draft.value = setConditionValue(draft.value, i, v))
const onRemove = (i: number) => (draft.value = removeCondition(draft.value, i, firstAction()))
const onAdd = () => (draft.value = addCondition(draft.value, firstAction()))
const onLogic = (l: FilterLogic) => (draft.value = setLogic(draft.value, l))

/* ---- 提交 / 重置 ---- */

function draftValue(): FilterValue | null {
  if (props.def.mode === 'options' && !advanced.value) return optionsToFilterValue(checked.value)
  return draftToValue(draft.value)
}

function confirm() {
  const v = draftValue()
  emit('update:value', v && isFilterActive(v) ? v : null)
  close(true)
}

function reset() {
  const fallback = props.def.defaultValue ?? null
  loadDraft(fallback)
  emit('update:value', fallback && isFilterActive(fallback) ? fallback : null)
  close(true)
}
</script>

<template>
  <n-popover v-model:show="show" trigger="click" placement="bottom" :show-arrow="false" raw>
    <template #trigger>
      <!-- stop:sorter 列的表头点击会触发排序,点漏斗不该顺带把表排一遍 -->
      <span
        ref="triggerRef"
        class="smart-table-filter-trigger"
        :class="{ 'smart-table-filter-trigger--active': active, 'smart-table-filter-trigger--open': show }"
        @click.stop
      >
        <n-tooltip trigger="hover" :disabled="show">
          <template #trigger>
            <n-button quaternary size="tiny" :type="active ? 'primary' : 'default'" :aria-label="ariaLabel">
              <template #icon><FilterIcon /></template>
            </n-button>
          </template>
          {{ labels.filter }}
        </n-tooltip>
        <span v-if="activeCount > 1" class="smart-table-filter-badge">{{ activeCount }}</span>
      </span>
    </template>

    <div
      ref="panelRef"
      class="smart-table-filter"
      :class="{ 'smart-table-filter--condition': !def.render && showEditor }"
      :style="{
        background: themeVars.popoverColor,
        borderRadius: themeVars.borderRadius,
        boxShadow: themeVars.boxShadow2,
        color: themeVars.textColor2,
      }"
      @click.stop
      @keydown="onPanelKeydown"
    >
      <!-- 自定义面板:完全接管内容,只复用弹层与提交通道 -->
      <component
        v-if="def.render"
        :is="() => def.render!({ value, setValue: (v) => emit('update:value', v), close: () => close(true) })"
      />

      <template v-else>
        <!-- options:勾选候选项 -->
        <div v-if="def.mode === 'options' && !advanced" class="smart-table-filter-options">
          <n-checkbox
            v-if="def.multiple && flatOptions.length > 1"
            class="smart-table-filter-all"
            :checked="allChecked"
            :indeterminate="someChecked"
            @update:checked="toggleAll"
          >
            {{ labels.filterSelectAll }}
          </n-checkbox>
          <n-checkbox
            v-for="opt in flatOptions"
            :key="String(opt.value)"
            :checked="checked.includes(opt.value)"
            :disabled="opt.disabled"
            @update:checked="(v: boolean) => toggleOption(opt.value, v)"
          >
            {{ optionLabel(opt) }}
          </n-checkbox>
          <span v-if="!flatOptions.length" :style="{ color: themeVars.textColor3 }">
            {{ isLoadingOptions(def.optionsKey) ? '...' : '—' }}
          </span>
        </div>

        <!-- 多条件编辑(condition 列恒显示;options 列展开「高级条件」后显示) -->
        <div v-else class="smart-table-filter-conditions">
          <ConditionRow
            v-for="(c, i) in draft.conditions"
            :key="i"
            :def="def"
            :condition="c"
            :labels="labels"
            :get-options="getOptions"
            :is-loading-options="isLoadingOptions"
            :date-value-format="dateValueFormat"
            :removable="draft.conditions.length > 1"
            @update:action="(a) => onAction(i, a)"
            @update:value="(v) => onValue(i, v)"
            @remove="onRemove(i)"
            @enter="confirm"
          />
          <div v-if="draft.conditions.length > 1" class="smart-table-filter-logic">
            <n-radio-group size="small" :value="draft.logic" @update:value="onLogic">
              <n-radio-button value="and">{{ labels.filterLogicAnd }}</n-radio-button>
              <n-radio-button value="or">{{ labels.filterLogicOr }}</n-radio-button>
            </n-radio-group>
          </div>
          <n-button
            class="smart-table-filter-add"
            text
            size="tiny"
            type="primary"
            :disabled="draft.conditions.length >= MAX_CONDITIONS"
            @click="onAdd"
          >
            + {{ labels.filterAddCondition }}
          </n-button>
        </div>

        <!-- options 列:勾选 ↔ 高级条件 的切换入口 -->
        <div v-if="def.mode === 'options'" class="smart-table-filter-advanced">
          <n-button v-if="!advanced" class="smart-table-filter-advanced-open" text size="tiny" @click="openAdvanced">
            {{ labels.filterAdvanced }}
          </n-button>
          <n-button
            v-else
            class="smart-table-filter-advanced-close"
            text
            size="tiny"
            :disabled="!canCollapse"
            @click="closeAdvanced"
          >
            {{ labels.filterSimple }}
          </n-button>
        </div>
      </template>

      <div
        v-if="!def.render"
        class="smart-table-filter-footer"
        :style="{ borderTop: `1px solid ${themeVars.dividerColor}` }"
      >
        <n-space :size="8">
          <n-button size="tiny" @click="reset">{{ labels.filterReset }}</n-button>
          <n-button size="tiny" type="primary" @click="confirm">{{ labels.filterConfirm }}</n-button>
        </n-space>
      </div>
    </div>
  </n-popover>
</template>

<style scoped>
.smart-table-filter-trigger {
  display: inline-flex;
  align-items: center;
  margin-left: 4px;
  /* 表头默认 center 对齐时,漏斗不该把标题挤偏 */
  vertical-align: middle;
}
.smart-table-filter-badge {
  margin-left: 2px;
  min-width: 14px;
  height: 14px;
  padding: 0 3px;
  border-radius: 7px;
  font-size: 10px;
  line-height: 14px;
  text-align: center;
  background: var(--n-th-icon-color-active);
  color: #fff;
}
.smart-table-filter {
  min-width: 200px;
  padding: 8px;
  /* 表头文字常是 center,弹层内容一律左对齐 */
  text-align: left;
  font-weight: normal;
}
/* 条件面板:一行「操作符 | 值 | 删除」放得下;窄屏不越出视口 */
.smart-table-filter--condition {
  width: min(400px, calc(100vw - 16px));
}
.smart-table-filter-options {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 260px;
  overflow: auto;
}
.smart-table-filter-conditions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.smart-table-filter-logic {
  display: flex;
  align-items: center;
}
.smart-table-filter-add {
  align-self: flex-start;
}
.smart-table-filter-advanced {
  margin-top: 8px;
}
.smart-table-filter-footer {
  margin-top: 8px;
  padding-top: 8px;
  display: flex;
  justify-content: flex-end;
}
</style>
```

- [ ] **Step 11: 跑,确认通过**

Run: `npm test && npm run typecheck`
Expected: 全部通过。排错提示:
- 若「打开后焦点进入面板」失败:确认 `watch(panelRef, …)` 里是 `nextTick(focusFirst)`;NPopover 的内容每次打开都会重新挂载,所以 `panelRef` 会从 `null` 变成元素。
- 若 typecheck 报 `ConditionRow` 的 `@update:action="(a) => ..."` 隐式 any:给回调参数标注类型(`(a: FilterAction) => …`)。
- 已有的 `ColumnFilter` 测试(勾选全选 / 自定义面板不重挂)必须仍通过;它们依赖 `.smart-table-filter-all`、`.smart-table-filter-footer button`。

- [ ] **Step 12: 浏览器验证(弹层的真实交互只能在浏览器里看)**

Run: `node_modules/.bin/vite --port 5173`,打开 playground「过滤」示例(`DemoFilter`)。逐项确认并记录:
1. condition 列:点漏斗 → 面板出现,焦点在第一个控件;按 Tab 能在面板内走;按 Esc 关闭、焦点回到漏斗、没有发请求。
2. 「添加条件」加到 5 条后变灰;≥ 2 条出现「且 / 或」。
3. options 列:先通过控制台 `setFilter('status', { logic: 'and', conditions: [{ action: 'notEqual', value: 1 }] })`,再点漏斗 → 自动展开高级条件且显示这条 `notEqual`;点「确定」后过滤值不变。
4. 点面板**外部**的另一个输入框:面板关闭,焦点留在你点的输入框上(没有被抢回漏斗)。
Expected: 四条都成立;记录没有成立的项。结束后关掉 vite。

- [ ] **Step 13: 提交**

```bash
git add src/ConditionRow.vue src/ColumnFilter.vue src/types.ts src/labels.ts tests/ColumnFilter.test.ts
git commit -m "feat!: 列头过滤面板升级为多条件编辑,options 列支持「勾选 ↔ 高级条件」且不再丢条件,键盘可用(B7/C3)" -m "有意的默认行为变更:单条件/勾选 → 多条件编辑(≤5 条,且/或);options 列的过滤值勾选表达不了时自动展开高级条件。新增 openRequest prop 供 chips 使用。" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 11: 已生效条件 chips(`filterChips`)

> 规格 §3、§5.3。`filterChips?: boolean`,**P0 里默认 `false`**(模式 2 默认开随 P1 发布)。
> - chips 用官方 `NTag`(`round` / `closable` / `size="small"`);点击 chip = 重开对应列面板;× = 只删这一条;同字段第 2 条起若该列是「或」则加前缀。
> - 行末文字按钮:表里有任何列声明了有效的 `defaultValue` 时显示「恢复默认」,否则「清除全部」;都调 `clearFilters()`(**语义不变,恢复各列 `defaultValue`**)。
> - 超过一行折成「+N」:只显示第一行放得下的个数,其余收进 `+N` 标签,点它在气泡里展开完整列表。**折叠个数靠量 `offsetTop`**(jsdom 里恒为 0,所以组件测试里永远是「全放得下」;折叠算法本身用纯函数 `countFitting` 单测)。
> - chips 是工具栏**下方独立一行**;批量栏(P1)只替换工具栏那一行,所以勾选期间 chips 仍可见。
> - chips 按**列声明**派生(`filterDefs`),与该列是否在列设置里被隐藏无关:被隐藏的列,过滤条件仍然生效,chips 也仍然显示;此时点 chip 无处可开面板,是空操作(不报错)。

**Files:**
- Create: `src/filterChips.ts`、`src/FilterChips.vue`
- Modify: `src/types.ts`、`src/labels.ts`、`src/SmartTable.vue`、`src/index.ts`
- Test: `tests/filterChips.test.ts`(新建)、`tests/SmartTable.test.ts`(追加)

**Interfaces:**
- Consumes: Task 2 的 `ACTION_LABEL_KEY` / `activeConditions` / `isValuelessAction`;Task 10 的 `ColumnFilter` 新 prop `openRequest` 与 labels `filterLogicOr`。
- Produces:
  - `filterChips.ts`:`interface ChipItem { key: string; index: number; text: string }`(`key` = `FilterDef.key`,`index` = 该条件在 `activeConditions(value)` 里的下标);`buildChips(defs: FilterDef[], state: FilterState, labels: SmartTableLabels, optionLabelOf: (def: FilterDef, value: unknown) => string): ChipItem[]`;`removeChipCondition(value: FilterValue, index: number): FilterValue | null`;`countFitting(tops: number[]): number`;`hasActiveDefaults(defs: FilterDef[]): boolean`
  - `FilterChips.vue` props:`items: ChipItem[]`、`labels`、`hasDefaults: boolean`;事件:`open(key: string)`、`remove(key: string, index: number)`、`clear()`
  - `SmartTableProps.filterChips?: boolean`;`SmartTableLabels.filterClearAll` / `filterRestoreDefault`

- [ ] **Step 1: 写失败测试 —— 纯函数**

Create `tests/filterChips.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { buildChips, countFitting, hasActiveDefaults, removeChipCondition } from '../src/filterChips'
import { defaultLabels } from '../src/labels'
import type { FilterDef } from '../src/useColumns'
import type { FilterState, FilterValue } from '../src/types'

const def = (over: Partial<FilterDef> & { key: string }): FilterDef => ({
  field: over.key,
  optionsKey: over.key,
  mode: 'condition',
  multiple: true,
  type: 'input',
  actions: ['contains'],
  ...over,
})
const v = (logic: 'and' | 'or', ...c: Array<[string, unknown]>): FilterValue => ({
  logic,
  conditions: c.map(([action, value]) => ({ action: action as never, value })),
})
const plain = (_d: FilterDef, value: unknown) => String(value)

describe('buildChips', () => {
  const defs = [def({ key: 'name', title: '姓名' }), def({ key: 'status', title: () => '状态', type: 'select' })]

  it('每个生效条件一个 chip:「列标题 操作符 值」;按列声明顺序', () => {
    const state: FilterState = { status: v('and', ['equal', 1]), name: v('and', ['contains', 'ali']) }
    expect(buildChips(defs, state, defaultLabels, plain)).toEqual([
      { key: 'name', index: 0, text: '姓名 Contains ali' },
      { key: 'status', index: 0, text: '状态 Equals 1' },
    ])
  })

  it('同列 logic 为 or 时,第 2 条起加「OR」前缀', () => {
    const chips = buildChips(defs, { name: v('or', ['contains', 'a'], ['contains', 'b']) }, defaultLabels, plain)
    expect(chips.map((c) => c.text)).toEqual(['姓名 Contains a', 'OR 姓名 Contains b'])
  })

  it('无值算子:没有值部分;in / notIn:值用逗号连接,每项走 optionLabelOf', () => {
    const chips = buildChips(
      defs,
      { name: v('and', ['isNull', null]), status: v('and', ['in', [1, 2]]) },
      defaultLabels,
      (_d, val) => `#${val}`,
    )
    expect(chips.map((c) => c.text)).toEqual(['姓名 Is empty', '状态 In #1, #2'])
  })

  it('没有生效条件的列不出 chip;state 里有但 defs 里没有的键被忽略', () => {
    expect(buildChips(defs, { ghost: v('and', ['equal', 1]), name: v('and', ['contains', '']) }, defaultLabels, plain)).toEqual([])
  })

  it('标题是返回非字符串(VNode)的函数时回退成列 key', () => {
    const d = def({ key: 'k', title: (() => ({})) as never })
    expect(buildChips([d], { k: v('and', ['contains', 'x']) }, defaultLabels, plain)[0].text).toBe('k Contains x')
  })
})

describe('removeChipCondition', () => {
  it('删掉指定的一条;剩一条时 logic 归位 and;删光返回 null', () => {
    const value = v('or', ['contains', 'a'], ['contains', 'b'])
    expect(removeChipCondition(value, 0)).toEqual(v('and', ['contains', 'b']))
    expect(removeChipCondition(v('and', ['contains', 'a']), 0)).toBeNull()
  })
  it('下标按「生效条件」算(与 buildChips 一致):无效条件不占下标', () => {
    const value = v('and', ['contains', ''], ['contains', 'a'], ['contains', 'b'])
    expect(removeChipCondition(value, 0)).toEqual(v('and', ['contains', 'b']))
  })
})

describe('countFitting(折成 +N 的个数)', () => {
  it('全在第一行 → 全部显示', () => {
    expect(countFitting([0, 0, 0])).toBe(3)
    expect(countFitting([])).toBe(0)
  })
  it('有折到第二行的 → 第一行放得下的个数再让出一个位置给「+N」,至少保留 1 个', () => {
    expect(countFitting([0, 0, 0, 30, 30])).toBe(2)
    expect(countFitting([0, 30, 30])).toBe(1)
  })
})

describe('hasActiveDefaults', () => {
  it('任一列声明了生效的 defaultValue → true;空条件的 defaultValue 不算', () => {
    expect(hasActiveDefaults([def({ key: 'a' }), def({ key: 'b', defaultValue: v('and', ['equal', 1]) })])).toBe(true)
    expect(hasActiveDefaults([def({ key: 'a', defaultValue: v('and', ['equal', '']) })])).toBe(false)
    expect(hasActiveDefaults([])).toBe(false)
  })
})
```

- [ ] **Step 2: 跑,确认失败**

Run: `npx vitest run tests/filterChips.test.ts`
Expected: FAIL —— `Cannot find module '../src/filterChips'`。

- [ ] **Step 3: 实现 `src/filterChips.ts`**

Create `src/filterChips.ts`:
```ts
// 已生效条件 chips 的纯函数(UI 无关、可单测)。
import { activeConditions, isFilterActive, isValuelessAction } from './filter'
import { ACTION_LABEL_KEY } from './labels'
import type { FilterState, FilterValue, SmartTableLabels } from './types'
import type { FilterDef } from './useColumns'

export interface ChipItem {
  /** FilterDef.key(过滤态的键)。 */
  key: string
  /** 该条件在 activeConditions(value) 里的下标(删除时按它定位)。 */
  index: number
  text: string
}

function titleText(def: FilterDef): string {
  const t = typeof def.title === 'function' ? def.title() : def.title
  return typeof t === 'string' || typeof t === 'number' ? String(t) : def.key
}

/** 每个生效条件一个 chip;顺序按列声明。optionLabelOf 把值翻成展示文字(字典列显示 label 而不是 value)。 */
export function buildChips(
  defs: FilterDef[],
  state: FilterState,
  labels: SmartTableLabels,
  optionLabelOf: (def: FilterDef, value: unknown) => string,
): ChipItem[] {
  const out: ChipItem[] = []
  for (const def of defs) {
    const value = state[def.key]
    activeConditions(value).forEach((c, index) => {
      const valueText = isValuelessAction(c.action)
        ? ''
        : Array.isArray(c.value)
          ? c.value.map((x) => optionLabelOf(def, x)).join(', ')
          : optionLabelOf(def, c.value)
      const text = [index > 0 && value?.logic === 'or' ? labels.filterLogicOr : '', titleText(def), labels[ACTION_LABEL_KEY[c.action]], valueText]
        .filter(Boolean)
        .join(' ')
      out.push({ key: def.key, index, text })
    })
  }
  return out
}

/** 删掉一个 chip 对应的条件(下标按生效条件算);剩一条时 logic 归位 and;删光返回 null。 */
export function removeChipCondition(value: FilterValue, index: number): FilterValue | null {
  const rest = activeConditions(value).filter((_, i) => i !== index)
  if (rest.length === 0) return null
  return { logic: rest.length > 1 ? value.logic : 'and', conditions: rest }
}

/**
 * 折叠个数:给定每个 chip 的 offsetTop,第一行放得下的个数;有折到下一行的,再让出一个位置给「+N」(至少留 1 个)。
 * 组件测量时先把全部 chip 渲染出来量 offsetTop,再用这个数决定显示几个。
 */
export function countFitting(tops: number[]): number {
  if (tops.length === 0) return 0
  const fit = tops.filter((t) => t === tops[0]).length
  return fit >= tops.length ? tops.length : Math.max(1, fit - 1)
}

/** 表里是否有列声明了生效的 defaultValue —— 决定行末按钮叫「恢复默认」还是「清除全部」。 */
export function hasActiveDefaults(defs: FilterDef[]): boolean {
  return defs.some((d) => !!d.defaultValue && isFilterActive(d.defaultValue))
}
```

- [ ] **Step 4: 跑,确认通过**

Run: `npx vitest run tests/filterChips.test.ts`
Expected: PASS。

- [ ] **Step 5: labels、类型、`FilterChips.vue`**

`src/types.ts`:
- `SmartTableLabels` 里 `filterSimple: string` 之后加 `filterClearAll: string` 与 `filterRestoreDefault: string`。
- `SmartTableProps` 里 `filter?: boolean` 之后加:
```ts
  /** 在工具栏下方显示「已生效条件」chips(点击重开该列面板、× 删一条、行末清除 / 恢复默认);默认 false。 */
  filterChips?: boolean
```
`src/labels.ts`:`filterSimple: 'Back to list',` 之后加 `filterClearAll: 'Clear all',` 与 `filterRestoreDefault: 'Restore defaults',`。

Create `src/FilterChips.vue`:
```vue
<script setup lang="ts">
// 已生效条件 chips 行:NTag,超过一行折成「+N」(点它在气泡里展开完整列表);行末「清除全部 / 恢复默认」。
// 折叠个数靠测量:先把全部 chip 渲染出来量 offsetTop(同一帧内完成,不会闪),再按 countFitting 决定显示几个;
// 容器宽度变了再量一次(只在宽度变化时重量,否则测量时行高变化会触发死循环)。
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type PropType } from 'vue'
import { NButton, NPopover, NTag } from 'naive-ui'
import type { SmartTableLabels } from './types'
import { countFitting, type ChipItem } from './filterChips'

const props = defineProps({
  items: { type: Array as PropType<ChipItem[]>, required: true },
  labels: { type: Object as PropType<SmartTableLabels>, required: true },
  hasDefaults: { type: Boolean, default: false },
})

const emit = defineEmits<{
  open: [key: string]
  remove: [key: string, index: number]
  clear: []
}>()

const listRef = ref<HTMLElement | null>(null)
const visible = ref(Number.POSITIVE_INFINITY)
const measuring = ref(true)
const shown = computed(() => (measuring.value ? props.items : props.items.slice(0, visible.value)))
const hidden = computed(() => props.items.slice(shown.value.length))

async function recompute() {
  measuring.value = true
  await nextTick()
  const chips = Array.from(listRef.value?.children ?? []).filter((el): el is HTMLElement =>
    el.classList.contains('smart-table-chip'),
  )
  visible.value = chips.length ? countFitting(chips.map((el) => el.offsetTop)) : props.items.length
  measuring.value = false
}

watch(() => props.items.map((i) => `${i.key}:${i.index}:${i.text}`).join('|'), recompute, { flush: 'post' })

let observer: ResizeObserver | null = null
let lastWidth = -1
onMounted(() => {
  void recompute()
  if (typeof ResizeObserver === 'undefined' || !listRef.value) return
  observer = new ResizeObserver((entries) => {
    const w = Math.round(entries[0]?.contentRect.width ?? 0)
    if (w === lastWidth) return
    lastWidth = w
    void recompute()
  })
  observer.observe(listRef.value)
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div class="smart-table-chips">
    <div ref="listRef" class="smart-table-chips__list">
      <n-tag
        v-for="c in shown"
        :key="c.key + ':' + c.index"
        class="smart-table-chip"
        round
        closable
        size="small"
        @click="emit('open', c.key)"
        @close="emit('remove', c.key, c.index)"
      >
        {{ c.text }}
      </n-tag>
      <n-popover v-if="hidden.length" trigger="click" placement="bottom-start">
        <template #trigger>
          <n-tag class="smart-table-chip smart-table-chip--more" round size="small">+{{ hidden.length }}</n-tag>
        </template>
        <div class="smart-table-chips__more">
          <n-tag
            v-for="c in hidden"
            :key="c.key + ':' + c.index"
            round
            closable
            size="small"
            @click="emit('open', c.key)"
            @close="emit('remove', c.key, c.index)"
          >
            {{ c.text }}
          </n-tag>
        </div>
      </n-popover>
    </div>
    <n-button class="smart-table-chips__clear" text size="tiny" @click="emit('clear')">
      {{ hasDefaults ? labels.filterRestoreDefault : labels.filterClearAll }}
    </n-button>
  </div>
</template>

<style scoped>
.smart-table-chips {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 0 0 8px;
}
.smart-table-chips__list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  flex: 1 1 auto;
  min-width: 0;
}
.smart-table-chip {
  cursor: pointer;
}
.smart-table-chips__more {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  max-width: 320px;
}
.smart-table-chips__clear {
  flex: none;
  align-self: center;
}
</style>
```

- [ ] **Step 6: 写失败测试 —— `SmartTable` 接线**

在 `tests/SmartTable.test.ts` 末尾追加(顶部需要 `import FilterChips from '../src/FilterChips.vue'`、`import { NTag } from 'naive-ui'` 合并进已有的 naive-ui import):
```ts
describe('SmartTable 已生效条件 chips(filterChips)', () => {
  const cols = [
    { key: 'name', title: '姓名', filter: true },
    { key: 'dept', title: '部门', filter: true },
  ] as SmartTableColumn<Row>[]
  const value = (action: string, v: unknown) => ({ logic: 'and' as const, conditions: [{ action: action as never, value: v }] })
  const inst = (w: ReturnType<typeof mount>) =>
    w.vm as unknown as { setFilter: (k: string, v: unknown) => void; filters: Record<string, unknown> }

  it('默认不显示 chips(P0:需显式 filterChips: true)', async () => {
    const wrapper = mount(SmartTable, { props: { columns: cols, data: rows, rowKey: 'id' } })
    inst(wrapper).setFilter('name', value('contains', 'a'))
    await nextTick()
    expect(wrapper.findComponent(FilterChips).exists()).toBe(false)
    wrapper.unmount()
  })

  it('filterChips: true:有条件才出现;每个条件一个 chip;× 只删这一条', async () => {
    const wrapper = mount(SmartTable, { props: { columns: cols, data: rows, rowKey: 'id', filterChips: true } })
    expect(wrapper.findComponent(FilterChips).exists()).toBe(false) // 无条件不占位
    inst(wrapper).setFilter('name', value('contains', 'a'))
    inst(wrapper).setFilter('dept', value('equal', 'x'))
    await nextTick()
    const chips = wrapper.findComponent(FilterChips)
    expect(chips.findAll('.smart-table-chip').map((c) => c.text())).toEqual(['姓名 Contains a', '部门 Equals x'])
    chips.findAllComponents(NTag)[0].vm.$emit('close')
    await nextTick()
    expect(Object.keys(inst(wrapper).filters)).toEqual(['dept'])
    wrapper.unmount()
  })

  it('行末按钮:没有列声明 defaultValue → 「Clear all」;点击清空全部', async () => {
    const wrapper = mount(SmartTable, { props: { columns: cols, data: rows, rowKey: 'id', filterChips: true } })
    inst(wrapper).setFilter('name', value('contains', 'a'))
    await nextTick()
    const btn = wrapper.find('.smart-table-chips__clear')
    expect(btn.text()).toBe('Clear all')
    await btn.trigger('click')
    expect(inst(wrapper).filters).toEqual({})
    wrapper.unmount()
  })

  it('行末按钮:有列声明了 defaultValue → 「Restore defaults」,点击恢复默认而不是清空', async () => {
    const withDefault = [{ key: 'name', title: '姓名', filter: { defaultValue: value('contains', 'seed') } }] as SmartTableColumn<Row>[]
    const wrapper = mount(SmartTable, { props: { columns: withDefault, data: rows, rowKey: 'id', filterChips: true } })
    inst(wrapper).setFilter('name', value('contains', 'changed'))
    await nextTick()
    const btn = wrapper.find('.smart-table-chips__clear')
    expect(btn.text()).toBe('Restore defaults')
    await btn.trigger('click')
    expect(inst(wrapper).filters.name).toEqual(value('contains', 'seed'))
    wrapper.unmount()
  })

  it('[Review Focus 5] 指向已隐藏的列:chip 仍显示、点击不报错、× 仍能清掉那个条件', async () => {
    const hiddenCols = [{ key: 'name', title: '姓名', filter: true, hide: true }, { key: 'dept', title: '部门' }] as SmartTableColumn<Row>[]
    const wrapper = mount(SmartTable, { props: { columns: hiddenCols, data: rows, rowKey: 'id', filterChips: true } })
    inst(wrapper).setFilter('name', value('contains', 'a'))
    await nextTick()
    const chips = wrapper.findComponent(FilterChips)
    expect(chips.findAll('.smart-table-chip')).toHaveLength(1)
    await expect(chips.find('.smart-table-chip').trigger('click')).resolves.toBeUndefined() // 没有可开的面板,空操作
    chips.findAllComponents(NTag)[0].vm.$emit('close')
    await nextTick()
    expect(inst(wrapper).filters).toEqual({})
    wrapper.unmount()
  })

  it('点击 chip → 对应列的 ColumnFilter 收到 openRequest 递增', async () => {
    const wrapper = mount(SmartTable, { props: { columns: cols, data: rows, rowKey: 'id', filterChips: true }, attachTo: document.body })
    inst(wrapper).setFilter('name', value('contains', 'a'))
    await nextTick()
    wrapper.findComponent(FilterChips).vm.$emit('open', 'name')
    await flushPromises()
    expect(document.body.querySelector('.smart-table-filter')).not.toBeNull()
    wrapper.unmount()
  })
})
```

- [ ] **Step 7: 跑,确认失败**

Run: `npx vitest run tests/SmartTable.test.ts`
Expected: FAIL —— 找不到 `FilterChips`(`SmartTable` 还没接线)。

- [ ] **Step 8: 实现 —— `SmartTable.vue` 接线**

1. `import ColumnFilter from './ColumnFilter.vue'` 之后加 `import FilterChips from './FilterChips.vue'`;`import { applyFilters } from './filter'` 之后加 `import { buildChips, hasActiveDefaults, removeChipCondition } from './filterChips'`;`import { useOptions } from './useOptions'` 改为 `import { optionLabel, useOptions } from './useOptions'`;`import type {...} from './types'` 列表里加 `SmartTableOption`;顶部 `import { computed, h, nextTick, ... } from 'vue'` 里加 `reactive`。
2. props 里 `filter: { type: Boolean, default: undefined },` 之后加:
```ts
  filterChips: { type: Boolean, default: undefined },
```
3. 在 `renderColumnFilter` 函数之前加:
```ts
/* ---- 已生效条件 chips ---- */

// P0:默认关;模式 2(条件构造器)落地后才会默认开
const chipsEnabled = computed(() => props.filterChips === true)

/** 字典列的 chip 显示 label 而不是 value。 */
function optionLabelOf(def: FilterDef, value: unknown): string {
  const flat = (opts: SmartTableOption[]): SmartTableOption[] =>
    opts.flatMap((o) => (o.children?.length ? flat(o.children) : [o]))
  const hit = flat(options.getOptions(def.optionsKey)).find((o) => o.value === value)
  return hit ? optionLabel(hit) : String(value ?? '')
}

const chipItems = computed(() =>
  chipsEnabled.value ? buildChips(filterDefs.value as FilterDef[], filters.state.value, mergedLabels.value, optionLabelOf) : [],
)
const chipsHaveDefaults = computed(() => hasActiveDefaults(filterDefs.value as FilterDef[]))

/** 点 chip = 请求重开该列面板:给对应 ColumnFilter 递增 openRequest。被隐藏的列没有漏斗,递增了也是空操作。 */
const openTick = reactive<Record<string, number>>({})
function onChipOpen(key: string) {
  openTick[key] = (openTick[key] ?? 0) + 1
}
function onChipRemove(key: string, index: number) {
  const v = filters.getFilter(key)
  if (v) filters.setFilter(key, removeChipCondition(v, index))
}
```
注意:`options` 在文件更靠前处已声明(`const options = useOptions(...)` 在 `renderColumnFilter` 之前);若 `chipItems` 放在它之前会触发 TDZ——把这一整段放在 `const options = useOptions(...)` 之后。
4. `renderColumnFilter` 里 `h(ColumnFilter, {...})` 的 props 加一行:
```ts
    openRequest: openTick[def.key] ?? 0,
```
5. 模板里 `</Toolbar>` 之后、`<n-data-table` 之前加:
```vue
      <FilterChips
        v-if="chipItems.length"
        :items="chipItems"
        :labels="mergedLabels"
        :has-defaults="chipsHaveDefaults"
        @open="onChipOpen"
        @remove="onChipRemove"
        @clear="filters.clearFilters"
      />
```
`src/index.ts`:无需新增导出(`ChipItem` 等是内部实现细节)。

- [ ] **Step 9: 跑,确认通过**

Run: `npm test && npm run typecheck`
Expected: 全部通过。排错:「点击 chip → openRequest」用例若失败,检查 `renderColumnFilter` 是在列标题的渲染函数里被调用的(`useColumns.toNaive` 的 `title` 闭包),所以读 `openTick[def.key]` 会被 NDataTable 的渲染收集为依赖;`openTick` 必须是 `reactive`。

- [ ] **Step 10: 浏览器验证(折叠个数只能在真实布局里看)**

Run: `node_modules/.bin/vite --port 5173`,在 playground 的「过滤」示例里给 `<SmartTable>` 加 `filter-chips`(临时改动,验证完 `git checkout playground`),给多个列加条件。确认并记录:
1. 条件少时 chips 在一行内;条件多到一行放不下时,出现 `+N`,点它气泡里列出其余 chip;
2. 缩放窗口变窄,`N` 随之变大(ResizeObserver 生效);
3. 点某个 chip,该列的过滤面板弹出;× 删一条后表格数据随之更新。
Expected: 三条成立。结束后 `git checkout playground` 还原临时改动,关掉 vite。

- [ ] **Step 11: 提交**

```bash
git add src/filterChips.ts src/FilterChips.vue src/types.ts src/labels.ts src/SmartTable.vue tests/filterChips.test.ts tests/SmartTable.test.ts
git commit -m "feat: 新增 filterChips:已生效条件 chips(点击重开面板、× 删一条、+N 折叠、清除全部/恢复默认)" -m "纯新增,默认关闭(filterChips 缺省 false);模式 2 默认开随 P1 发布(B10)。" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 12: 拖过列宽后的余量 —— 最后一个数据列吸收,取代占位列(B8);带图标列的拖拽下限(B12)

> 规格 §1 B8/B12、§5.6;设计文档 3.11 与 9.3(真实 `NDataTable` 验证)。
>
> **B8(取代 2.1.1 的占位列机制 `9acc29e` / `d8dda32`)**:
> - **吸收余量的列** = 最后一个**可见、非固定**的叶子数据列。拖过一次列宽(进入「钉住态」)之后:第一次按下把手,其余可见列(含序号 / 勾选 / 展开)冻结成当前渲染宽度;**吸收列不写宽度**(弹性),它的「钉住宽度」只是**下限**(`widths[key] ?? 声明宽 ?? minWidth ?? 兜底宽`),计入 `scroll-x`。
> - 这样不需要任何每帧 JS:官方表格是 `width: 100%` + `min-width: scroll-x`(`Body.mjs:421-423` 已核),`table-layout: fixed` 下**没有写宽度的那一列自然拿到剩余宽度**——拖别的列时它实时缩放,右侧永远不留白。表头 DOM 里**不再有占位列**,列数恒等于声明的列数。
> - **全部列都 `fixed`**(没有非固定列可吸收)时:官方对「没有数字宽度的固定列」偏移按 0 算(`use-scroll.mjs:34-78`),不能让固定列弹性;所以吸收列退为**最后一个叶子列**并写**显式宽度** `max(下限, 容器宽 − 其余列宽之和)`,`scroll-x` 始终 ≥ 容器宽(设计文档 9.3 的 D 方案实测:150 / 150 / 150 / 550,填满)。这一支需要容器宽度,由 `SmartTable` 现有的 `hostWidth` 提供。
> - 已知代价(用户已接受):最后一列拖窄时,只要总宽仍不足以填满容器,它不会变窄(钉住宽度只是下限);拖宽正常。
> - **`scroll-x` 必须始终 ≥ 各列下限之和**(官方在 `scroll-x` < 容器宽且所有列都有宽度时会把各列按比例拉伸,钉住的宽度就不被遵守——设计文档 9.3 的 A / E 方案——这正是弹性吸收列要解决的)。
>
> **B12**:可拖拽列的拖拽下限,对**带图标的列**取 `max(resizeMinWidth, 图标簇所需最小宽)`:仅排序 `12+44+21+16 = 93`、仅过滤 `12+44+30+16 = 102`、两者 `123`;其它列仍是 `resizeMinWidth`;列上显式写了 `minWidth` 的不覆盖。
>
> **本任务不做**(规格 B12 里写的「表头 `th` 改 `overflow:visible` + 递减 `z-index`、把手骑在列界线上」):那是纯视觉打磨,需要在带 `fixed` 列的表上逐列核对层叠,**推到 P1 的视觉任务**,不阻塞 beta。现有把手样式(`right:0`、悬停才显形)保持不变。

**Files:**
- Modify: `src/useColumns.ts`、`src/SmartTable.vue`
- Test: `tests/useColumns.test.ts`(改 5 条、删 1 个 describe、追加)、`tests/SmartTable.test.ts`(替换 1 个 describe)

**Interfaces:**
- Consumes: Task 4 的 `sortState` 数组形态(不影响本任务);Task 5 的 `defaultDensity` getter。
- Produces:
  - `useColumns` 选项新增 `hostWidth?: () => number`(容器可见宽,仅「全部列 fixed」那一支使用);
  - `useColumns.ts` 导出 `headerIconFloor(hasFilter: boolean, hasSorter: boolean): number`;
  - **删除导出** `FILLER_COLUMN_KEY`、`withFillerColumn`(只被 `SmartTable.vue` 与测试使用,`index.ts` 从未导出过它们);
  - `SmartTable.vue`:删除 `fillerWidth` / `displayColumns`,`scroll-x` = `columnsApi.scrollX + dragDelta`。

- [ ] **Step 1: 改 / 写测试 —— `useColumns`(先让它们失败)**

`tests/useColumns.test.ts`:

1. 顶部 import 去掉 `withFillerColumn, FILLER_COLUMN_KEY,`,改为加 `headerIconFloor`:
```ts
import {
  deriveFilterDefs,
  headerIconFloor,
  useColumns,
  type FilterDef,
} from '../src/useColumns'
```
并删掉不再使用的 `import type { DataTableBaseColumn, DataTableColumn } from 'naive-ui'`(若仍有其它用例用到就保留)。
2. `build()` 的 `extra` 增加 `hostWidth`:
```ts
  extra?: {
    renderFilter?: (def: FilterDef<Row>) => unknown
    resizable?: () => boolean
    hostWidth?: () => number
  },
```
并在 `opts` 里加 `hostWidth: extra?.hostWidth,`。
3. **删除**整个 `describe('withFillerColumn:列宽钉住后用占位列填满容器', …)`(从该行到文件末尾的对应 `})`)。
4. 下面 4 条用例的**期望值有意改变**(吸收列不再被钉住),整条替换:

「freezeWidths 把没有显式宽度的可见列钉成实测宽度」(原 221–237 行):
```ts
  it('freezeWidths 把没有显式宽度的可见列钉成实测宽度(吸收列除外:它弹性,不钉)', () => {
    const api = build(
      [
        { key: 'name', title: 'N', width: 100 },
        { key: 'mid', title: 'M' },
        { key: 'amt', title: 'A' },
      ],
      undefined,
      {},
      undefined,
      { resizable: () => true },
    )
    // 实测宽 > 声明宽,正是 table-layout:fixed 摊派富余宽度的结果
    api.freezeWidths((k) => ({ name: 189.4, mid: 150.2, amt: 210.6 })[k])
    // amt 是最后一个可见非固定列 = 吸收列,不钉
    expect(api.widths.value).toEqual({ name: 189, mid: 150 })
    expect(col(api, 'amt').width).toBeUndefined()
    // scroll-x = 已钉列 + 吸收列的下限(无声明宽 / minWidth → 兜底宽 120)
    expect(api.scrollX.value).toBe(189 + 150 + 120)
  })
```
「freezeWidths 跳过隐藏列」(原 249–256 行):
```ts
  it('freezeWidths 跳过隐藏列(只钉当前可见的);可见的最后一列是吸收列', () => {
    const api = build([
      { key: 'name', title: 'N' },
      { key: 'mid', title: 'M' },
      { key: 'amt', title: 'A', hide: true },
    ])
    api.freezeWidths(() => 150)
    expect(api.widths.value).toEqual({ name: 150 }) // mid 是可见的最后一列 → 吸收列,不钉;amt 隐藏,不碰
  })
```
「freezeWidths 连特殊列一起钉…」(原 258–265 行):
```ts
  it('freezeWidths 连特殊列一起钉,否则残余富余量还会摊给所有列', () => {
    const api = build([{ type: 'index' }, { type: 'selection' }, { key: 'name', title: 'N' }])
    api.freezeWidths((k) => ({ __index: 118, __n_selection__: 74, name: 300 })[k])
    // name 是唯一的数据列 = 吸收列,不钉;特殊列照钉
    expect(api.widths.value).toEqual({ __index: 118, __n_selection__: 74 })
    expect(col(api, '__index').width).toBe(118)
    expect(api.scrollX.value).toBe(118 + 74 + 120) // + 吸收列下限(兜底宽 120)
  })
```
「钉住后每列都给得出宽度,且之和恰好等于 scrollX」(原 267–299 行):
```ts
  it('钉住后除吸收列外每列都有确定宽度;已钉列宽度之和 + 吸收列下限 = scrollX', () => {
    const api = build(
      [
        { type: 'index' },
        { key: 'name', title: 'N' },
        { key: 'amt', title: 'A', fixed: 'right' },
        { key: 'st', title: 'S', minWidth: 90 },
      ],
      undefined,
      {},
      undefined,
      { resizable: () => true },
    )
    expect(api.pinned.value).toBe(false)
    api.freezeWidths((k) => ({ __index: 70, name: 240, amt: 150, st: 140 })[k])
    expect(api.pinned.value).toBe(true)

    // st 是最后一个可见非固定列 = 吸收列:不写 width(弹性),下限 = minWidth 90
    const widths = () => api.naiveColumns.value.map((c) => (c as { width?: number }).width)
    expect(widths()).toEqual([70, 240, 150, undefined])
    expect(api.scrollX.value).toBe(70 + 240 + 150 + 90)

    // 拖宽一列:只有这一列变,其余列纹丝不动,scrollX 同步涨
    api.setWidth('name', 300)
    expect(widths()).toEqual([70, 300, 150, undefined])
    expect(api.scrollX.value).toBe(70 + 300 + 150 + 90)

    // 收窄同理 —— 富余宽度由吸收列自然吃掉,不会被摊给别的列
    api.setWidth('name', 180)
    expect(widths()).toEqual([70, 180, 150, undefined])
    expect(api.scrollX.value).toBe(70 + 180 + 150 + 90)
  })
```
5. 在 `describe('useColumns 列宽拖拽', …)` 内(`列被移除后…` 用例之前)追加新用例:
```ts
  describe('吸收余量的列(B8)', () => {
    const three = (): SmartTableColumn<Row>[] => [
      { key: 'name', title: 'N', width: 200 },
      { key: 'amt', title: 'A', width: 100 },
      { key: 'op', title: 'Op', width: 80, fixed: 'right' },
    ]
    const resizable = { resizable: () => true }

    it('吸收列 = 最后一个可见、非固定的叶子列;钉住后它不写 width,下限计入 scrollX', () => {
      const api = build(three(), undefined, {}, undefined, resizable)
      api.freezeWidths((k) => ({ name: 210, amt: 150, op: 80 })[k])
      expect(api.widths.value).toEqual({ name: 210, op: 80 })
      expect('width' in col(api, 'amt')).toBe(false) // 声明的 width:100 也被摘掉,交给浏览器弹性分配
      expect(col(api, 'name').width).toBe(210)
      expect(col(api, 'op').width).toBe(80)
      expect(api.scrollX.value).toBe(210 + 100 + 80) // 吸收列下限 = 声明宽 100
    })

    it('[Review Focus 4] 隐藏最后一列 → 前一列顶上成为吸收列', () => {
      const api = build(
        [
          { key: 'a', title: 'A', width: 100 },
          { key: 'b', title: 'B', width: 100 },
          { key: 'c', title: 'C', width: 100 },
        ],
        undefined,
        {},
        undefined,
        resizable,
      )
      api.toggleShow('c', false)
      api.freezeWidths(() => 100)
      expect(api.widths.value).toEqual({ a: 100 }) // b 现在是最后一个可见列 → 吸收列
      expect('width' in col(api, 'b')).toBe(false)
    })

    it('[Review Focus 4] 只有一列:它就是吸收列,freezeWidths 不钉它,表格不进入钉住态', () => {
      const api = build([{ key: 'name', title: 'N' }], undefined, {}, undefined, resizable)
      api.freezeWidths(() => 300)
      expect(api.widths.value).toEqual({})
      expect(api.pinned.value).toBe(false)
    })

    it('[Review Focus 4] 拖的正好是吸收列:拖出来的宽度只是它的下限,仍不写 width', () => {
      const api = build(
        [
          { key: 'a', title: 'A', width: 100 },
          { key: 'b', title: 'B', width: 100 },
        ],
        undefined,
        {},
        undefined,
        resizable,
      )
      api.freezeWidths(() => 100)
      api.setWidth('b', 260)
      expect(api.widths.value).toEqual({ a: 100, b: 260 })
      expect('width' in col(api, 'b')).toBe(false)
      expect(api.scrollX.value).toBe(100 + 260)
    })

    it('[Review Focus 4] 全部列都 fixed:吸收列退为最后一个叶子列,写显式宽度 = max(下限, 容器宽 − 其余列宽)', () => {
      const api = build(
        [
          { key: 'a', title: 'A', width: 200, fixed: 'left' },
          { key: 'b', title: 'B', width: 200, fixed: 'right' },
        ],
        undefined,
        {},
        undefined,
        { ...resizable, hostWidth: () => 900 },
      )
      api.freezeWidths((k) => ({ a: 200, b: 200 })[k])
      expect(col(api, 'b').width).toBe(700) // 900 − a(200)
      expect(api.scrollX.value).toBe(900)
      api.setWidth('a', 120)
      expect(col(api, 'b').width).toBe(780)
      expect(api.scrollX.value).toBe(900)
    })

    it('全部列都 fixed 且列宽之和已超过容器:不缩,取下限,横向滚动', () => {
      const api = build(
        [
          { key: 'a', title: 'A', width: 600, fixed: 'left' },
          { key: 'b', title: 'B', width: 600, fixed: 'right' },
        ],
        undefined,
        {},
        undefined,
        { ...resizable, hostWidth: () => 900 },
      )
      api.freezeWidths((k) => ({ a: 600, b: 600 })[k])
      expect(col(api, 'b').width).toBe(600)
      expect(api.scrollX.value).toBe(1200)
    })
  })

  describe('带图标列的拖拽下限(B12)', () => {
    it('headerIconFloor:仅排序 93、仅过滤 102、两者 123,都没有 0', () => {
      expect(headerIconFloor(false, false)).toBe(0)
      expect(headerIconFloor(false, true)).toBe(93)
      expect(headerIconFloor(true, false)).toBe(102)
      expect(headerIconFloor(true, true)).toBe(123)
    })

    it('可拖拽列的 minWidth = max(resizeMinWidth, 图标下限);列上显式 minWidth 不被覆盖', () => {
      const api = build(
        [
          { key: 'plain', title: 'P' },
          { key: 'sort', title: 'S', sorter: true },
          { key: 'filt', title: 'F', filter: true },
          { key: 'both', title: 'B', sorter: true, filter: true },
          { key: 'explicit', title: 'E', sorter: true, minWidth: 40 },
        ],
        { resizeMinWidth: 60 },
        {},
        undefined,
        { resizable: () => true },
      )
      expect(col(api, 'plain').minWidth).toBe(60)
      expect(col(api, 'sort').minWidth).toBe(93)
      expect(col(api, 'filt').minWidth).toBe(102)
      expect(col(api, 'both').minWidth).toBe(123)
      expect(col(api, 'explicit').minWidth).toBe(40)
    })

    it('不可拖拽的列不受影响(不补 minWidth)', () => {
      const api = build([{ key: 'sort', title: 'S', sorter: true }])
      expect('minWidth' in col(api, 'sort')).toBe(false)
    })
  })
```

- [ ] **Step 2: 改 / 写测试 —— `SmartTable`(整个 describe 替换)**

`tests/SmartTable.test.ts`:删掉顶部的 `import { FILLER_COLUMN_KEY } from '../src/useColumns'`;把整个 `describe('SmartTable 列宽钉住后填满容器', …)`(4 条用例)替换为:
```ts
describe('SmartTable 列宽钉住后由最后一个数据列吸收余量(B8,取代占位列)', () => {
  /** jsdom 没有 ResizeObserver,这里替一个能手动触发的桩,用来驱动组件里的容器测量。 */
  class ResizeObserverStub {
    static instances: ResizeObserverStub[] = []
    private cb: () => void
    constructor(cb: () => void) {
      this.cb = cb
      ResizeObserverStub.instances.push(this)
    }
    observe() {}
    unobserve() {}
    disconnect() {}
    emit() {
      this.cb()
    }
  }

  const HOST_WIDTH = 900

  function mountWithHostWidth(columns: SmartTableColumn<unknown>[]) {
    ResizeObserverStub.instances = []
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    const wrapper = mount(SmartTable, {
      props: { columns, data: rows, rowKey: 'id' },
      attachTo: document.body,
    })
    // 表格的包含块 = Naive 的横向滚动容器;jsdom 不排版,直接给它一个可见宽度
    const body = wrapper.element.querySelector('.n-data-table-base-table-body') as HTMLElement
    Object.defineProperty(body, 'clientWidth', { value: HOST_WIDTH, configurable: true })
    return wrapper
  }

  function emitResizeObserver() {
    ResizeObserverStub.instances.forEach((i) => i.emit())
  }

  type Col = { key: string; width?: number }

  it('拖窄后:没有占位列;吸收列(name)不写 width,其余列保持拖出来 / 冻结的宽度;scroll-x = 已钉列 + 吸收列下限', async () => {
    const wrapper = mountWithHostWidth([
      { key: 'name', title: 'Name', width: 200, resizable: true },
      { key: 'op', title: 'Op', width: 200, fixed: 'right' },
    ])
    const dataTable = wrapper.findComponent(NDataTable)

    // 走一遍真实拖拽:Naive 拖动中持续回调,松手落账,此后列宽进入钉住态
    const resize = dataTable.props('onUnstableColumnResize') as (...a: unknown[]) => void
    const actualWidths: Record<string, number> = { name: 200, op: 200 }
    resize(120, 120, { key: 'name' }, (k: string) => actualWidths[k])
    window.dispatchEvent(new MouseEvent('mouseup'))
    emitResizeObserver()
    await nextTick()

    const columns = dataTable.props('columns') as Col[]
    expect(columns.map((c) => c.key)).toEqual(['name', 'op']) // 列数恒等于声明的列数
    expect(columns[0].width).toBeUndefined() // 吸收列:弹性,浏览器把剩余宽度给它
    expect(columns[1].width).toBe(200)
    expect(dataTable.props('scrollX')).toBe(120 + 200) // 下限 120(拖出来的宽度)+ op 200

    wrapper.unmount()
    vi.unstubAllGlobals()
  })

  it('已钉住的表格,拖拽进行中(松手之前)scroll-x 跟着被拖的列同步,不必每帧重建列', async () => {
    const wrapper = mountWithHostWidth([
      { key: 'name', title: 'Name', width: 200, resizable: true },
      { key: 'op', title: 'Op', width: 200, fixed: 'right' },
    ])
    const dataTable = wrapper.findComponent(NDataTable)
    const resize = dataTable.props('onUnstableColumnResize') as (...a: unknown[]) => void
    const actualWidths: Record<string, number> = { name: 200, op: 200 }

    resize(120, 120, { key: 'name' }, (k: string) => actualWidths[k])
    window.dispatchEvent(new MouseEvent('mouseup'))
    emitResizeObserver()
    await nextTick()
    actualWidths.name = 120

    // 再次拖拽 name 列,但还没有松手
    resize(200, 200, { key: 'name' }, (k: string) => actualWidths[k])
    await nextTick()
    expect(dataTable.props('scrollX')).toBe(120 + 200 + (200 - 120)) // 下限 + op + 拖拽增量

    wrapper.unmount()
    vi.unstubAllGlobals()
  })

  it('没拖过列宽(未钉住)时不动列:拉伸交给 Naive 自己的 width:100%', async () => {
    const wrapper = mountWithHostWidth([
      { key: 'name', title: 'Name', width: 200 },
      { key: 'op', title: 'Op', width: 200, fixed: 'right' },
    ])
    emitResizeObserver()
    await nextTick()

    const dataTable = wrapper.findComponent(NDataTable)
    const columns = dataTable.props('columns') as Col[]
    expect(columns.map((c) => c.key)).toEqual(['name', 'op'])
    expect(columns[0].width).toBe(200)
    expect(dataTable.props('scrollX')).toBe(400)

    wrapper.unmount()
    vi.unstubAllGlobals()
  })

  it('列宽之和超过容器时照旧横向滚动', async () => {
    const wrapper = mountWithHostWidth([
      { key: 'name', title: 'Name', width: 800, resizable: true },
      { key: 'op', title: 'Op', width: 400, fixed: 'right' },
    ])
    const dataTable = wrapper.findComponent(NDataTable)
    const resize = dataTable.props('onUnstableColumnResize') as (...a: unknown[]) => void
    const actualWidths: Record<string, number> = { name: 800, op: 400 }
    resize(800, 800, { key: 'name' }, (k: string) => actualWidths[k])
    window.dispatchEvent(new MouseEvent('mouseup'))
    emitResizeObserver()
    await nextTick()

    const columns = dataTable.props('columns') as Col[]
    expect(columns.map((c) => c.key)).toEqual(['name', 'op'])
    expect(dataTable.props('scrollX')).toBe(1200)

    wrapper.unmount()
    vi.unstubAllGlobals()
  })

  it('[Review Focus 4] 全部列都 fixed:最后一列写显式宽度吃掉余量(容器宽由 ResizeObserver 量到)', async () => {
    const wrapper = mountWithHostWidth([
      { key: 'a', title: 'A', width: 200, fixed: 'left', resizable: true },
      { key: 'b', title: 'B', width: 200, fixed: 'right' },
    ])
    const dataTable = wrapper.findComponent(NDataTable)
    const resize = dataTable.props('onUnstableColumnResize') as (...a: unknown[]) => void
    const actualWidths: Record<string, number> = { a: 200, b: 200 }
    resize(120, 120, { key: 'a' }, (k: string) => actualWidths[k])
    window.dispatchEvent(new MouseEvent('mouseup'))
    emitResizeObserver()
    await nextTick()

    const columns = dataTable.props('columns') as Col[]
    expect(columns.map((c) => c.key)).toEqual(['a', 'b'])
    expect(columns[0].width).toBe(120)
    expect(columns[1].width).toBe(HOST_WIDTH - 120)
    expect(dataTable.props('scrollX')).toBe(HOST_WIDTH)

    wrapper.unmount()
    vi.unstubAllGlobals()
  })
})
```

- [ ] **Step 3: 跑,确认失败**

Run: `npx vitest run tests/useColumns.test.ts tests/SmartTable.test.ts`
Expected: FAIL —— `headerIconFloor` 不存在;吸收列相关断言不成立(现在列都被钉死、还有占位列)。

- [ ] **Step 4: 实现 —— `useColumns.ts`**

1. 在文件顶部 `export function isSpecialColumn…` 之前(或 `specialColumnKey` 之后)加:
```ts
/**
 * 带图标的表头的最小宽度:左内边距 12 + 标题 44 + 漏斗簇 30(可过滤)+ 箭头簇 21(可排序)+ 右内边距 16。
 * 可拖拽列的拖拽下限取它与 resizeMinWidth 的较大者,免得把图标挤出格子(B12)。
 */
export function headerIconFloor(hasFilter: boolean, hasSorter: boolean): number {
  if (!hasFilter && !hasSorter) return 0
  return 12 + 44 + (hasFilter ? 30 : 0) + (hasSorter ? 21 : 0) + 16
}
```
2. `UseColumnsOpts` 里 `resizable?: () => boolean` 之后加:
```ts
  /** 表格容器的可见宽度(仅「全部列都 fixed」时用来算吸收列的显式宽度)。 */
  hostWidth?: () => number
```
3. 把 `leafWidth` 整个函数(及其上方注释)替换为下面这段,并在它之后加 `visibleLeaves` / `absorber` / `floorWidth`(注意 `orderedVisibleData` 在函数体更靠后定义,这些 computed 只在求值时才读它,不会触发 TDZ):
```ts
  /** 可见叶子数据列(最终顺序,多级表头展开到叶子)及各自是否固定(设置里的固定优先)。 */
  const visibleLeaves = computed(() => {
    const out: Array<{ col: SmartTableDataColumn<T>; fixed?: 'left' | 'right' }> = []
    const walk = (cols: SmartTableDataColumn<T>[], inherited?: 'left' | 'right') => {
      for (const c of cols) {
        const own = c.fixed === 'left' || c.fixed === 'right' ? c.fixed : undefined
        const fixed = inherited ?? own
        if (c.children?.length) walk(c.children, fixed)
        else out.push({ col: c, fixed })
      }
    }
    for (const { col, fixed } of orderedVisibleData.value) walk([col], fixed)
    return out
  })

  /**
   * 拖过列宽后吸收余量的列(B8):最后一个可见、非固定的叶子列(elastic = true,不写 width,
   * 由 table-layout:fixed 把剩余宽度自然分给它);全部列都固定时退为最后一个叶子列,写显式宽度。
   */
  const absorber = computed<{ key: string; elastic: boolean } | null>(() => {
    const leaves = visibleLeaves.value
    if (leaves.length === 0) return null
    for (let i = leaves.length - 1; i >= 0; i--) {
      if (!leaves[i].fixed) return { key: leaves[i].col.key, elastic: true }
    }
    return { key: leaves[leaves.length - 1].col.key, elastic: false }
  })

  /** 一列的宽度下限:拖出来的宽度 ?? 声明宽 ?? minWidth ?? 兜底宽。 */
  function floorWidth(col: SmartTableDataColumn<T>): number {
    return Number(widths.value[col.key] ?? col.width ?? col.minWidth ?? d.fixedFallbackWidth)
  }

  /**
   * 叶子数据列的最终宽度(未考虑吸收列)。toNaive 与 scrollX 共用这一套口径 —— 两者一旦对不上,
   * 差额就会被表格摊回各列,拖一列左侧的列跟着动。
   */
  function rawLeafWidth(col: SmartTableDataColumn<T>, fixed?: 'left' | 'right'): number | undefined {
    const w = widths.value[col.key]
    if (w !== undefined) return w
    if (col.width !== undefined) return Number(col.width)
    // 固定列必须有具体宽度(否则 Naive 固定列错位);钉住态下所有列同理
    if (fixed || pinned.value) return Number(col.minWidth ?? d.fixedFallbackWidth)
    return undefined
  }

  /**
   * 叶子数据列的最终宽度。钉住态下的吸收列:弹性 → undefined(不写 width);
   * 全部固定的退路 → 写显式宽度 max(下限, 容器宽 − 其余列宽之和)。
   */
  function leafWidth(col: SmartTableDataColumn<T>, fixed?: 'left' | 'right'): number | undefined {
    const a = absorber.value
    if (pinned.value && a && a.key === col.key) {
      if (a.elastic) return undefined
      let others = 0
      for (const sc of specialCols.value) others += specialWidth(sc)
      for (const l of visibleLeaves.value) {
        if (l.col.key !== col.key) others += rawLeafWidth(l.col, l.fixed) ?? floorWidth(l.col)
      }
      return Math.max(floorWidth(col), Math.round((opts.hostWidth?.() ?? 0) - others))
    }
    return rawLeafWidth(col, fixed)
  }
```
4. `freezeWidths` 里 `walk` 函数的循环体,在 `if (next[col.key] !== undefined) continue` 之前加一行:
```ts
        // 吸收列保持弹性,不钉:钉住了就没有人来吸收余量了(B8)
        if (absorber.value?.elastic && col.key === absorber.value.key) continue
```
并把 `freezeWidths` 函数上方注释里的第一句补上「吸收列(最后一个可见非固定列)除外」。
5. `toNaive` 里:
   - 把
```ts
    const width = leafWidth(col, fixed)
    if (width !== undefined) result.width = width
```
   替换为:
```ts
    const width = leafWidth(col, fixed)
    if (width !== undefined) result.width = width
    // 钉住态下 leafWidth 只会对弹性吸收列返回 undefined:把透传过来的声明宽度也摘掉,交给浏览器弹性分配
    else if (pinned.value) delete result.width
```
   - 把
```ts
    if (resizable && result.minWidth === undefined) result.minWidth = d.resizeMinWidth
```
   替换为:
```ts
    // 带图标的列取 max(resizeMinWidth, 图标下限),免得图标被挤出格子(B12);列上显式写了 minWidth 的不覆盖
    if (resizable && result.minWidth === undefined) {
      const hasSorter = naiveRest.sorter != null && (naiveRest.sorter as unknown) !== false
      result.minWidth = Math.max(d.resizeMinWidth, headerIconFloor(!!filterDef, hasSorter))
    }
```
   (`filterDef` 在 `toNaive` 里更靠前已经声明。)
6. `scrollX` 的计算整个替换为:
```ts
  /** auto scrollX = 特殊列宽度 + Σ可见叶子列(最终宽度 ?? 下限);吸收列按它的下限计入,保证 scroll-x 始终 ≥ 各列下限之和。 */
  const scrollX = computed(() => {
    let sum = 0
    for (const col of specialCols.value) sum += specialWidth(col)
    for (const { col, fixed } of visibleLeaves.value) sum += leafWidth(col, fixed) ?? floorWidth(col)
    return sum
  })
```
7. **删除**文件末尾的 `FILLER_COLUMN_KEY` 与 `withFillerColumn`(从 `/** 占位列的 key…` 注释到文件末尾)。

- [ ] **Step 5: 实现 —— `SmartTable.vue`**

1. 删除 `withFillerColumn,` 的 import。
2. 把 `const hostWidth = ref(0)` 及其注释**移到** `const columnsApi = useColumns<T>({...})` 之前(因为下一条要把它传进去),并在 `useColumns` 的选项里加:
```ts
  hostWidth: () => hostWidth.value,
```
3. 删除整段 `fillerWidth`(及其注释)与 `displayColumns`;把 `colsWidth` 改为:
```ts
/** 表格总宽下限 = 各列宽度之和(含吸收列的下限)+ 拖拽中的临时增量。scroll-x 与 CSS 变量共用。 */
const colsWidth = computed(() => columnsApi.scrollX.value + dragDelta.value)
```
   (把它上面关于「富余宽度交给占位列」的注释换成这一句。)
4. `rootStyle` 整个改为:
```ts
const rootStyle = computed(() => ({
  '--smart-table-active-row-bg': defaults.activeRowBg,
}))
```
5. 模板里 `<n-data-table :columns="displayColumns"` 改成 `:columns="columnsApi.naiveColumns.value"`。
6. `watch([() => columnsApi.naiveColumns.value.length, tableKey], …)` 保持。
7. 样式里**删除**这两段:`.smart-table--pinned-cols :deep(.n-data-table-table) { width: var(--smart-table-cols-width); }`(连同上方关于占位列的注释)与 `.smart-table :deep(.smart-table-filler-col) { pointer-events: none; }`(连同注释)。
8. 「列宽钉住」态的注释块(`const colsPinned = columnsApi.pinned` 上方那段)改写为:
```ts
/**
 * 「列宽已钉住」态:拖过一次之后,除吸收列外每一列(含序号/勾选列)都有确定宽度。
 * table-layout 切 fixed —— Naive 默认是 auto,auto 下 <col> 宽度只是建议值,浏览器每次都按内容重新求解
 * 整张表,改一列所有列都会挪。最后一个可见非固定列(吸收列)不写宽度,fixed 布局下它自然拿到剩余宽度,
 * 所以表格既填满容器、右侧不留白,又不牵动任何一列(见 useColumns 的 absorber)。
 */
```

- [ ] **Step 6: 跑,确认通过**

Run: `npm test && npm run typecheck`
Expected: 全部通过。排错:
- 若 `SmartTable.test.ts` 的「全部列都 fixed」失败:确认 `useColumns` 收到了 `hostWidth`,且 `measureHost()` 在 `emitResizeObserver()` 后把 `hostWidth.value` 更新成 900。
- 若 `useColumns` 里 `visibleLeaves` 报「`orderedVisibleData` 在声明前使用」(TS2448):说明某处在声明前**同步**读了它;`visibleLeaves` / `absorber` 本身只定义不求值,应当无此问题——检查是否误把 `visibleLeaves.value` 写在了 `watch(..., { immediate: true })` 的回调里。
- 删掉 `withFillerColumn` 后若还有文件引用它,`grep -rn "Filler" src tests` 应为空。

- [ ] **Step 7: 浏览器验证(布局行为只能在真实浏览器里看)**

Run: `node_modules/.bin/vite --port 5173`,打开 playground「基础」示例(它的表格开了 `resizable`)。逐项确认并记录:
1. 拖窄「名称」这类中间列:**最后一个非固定列**实时变宽来补,表格右侧**没有空白**,DOM 里表头列数等于声明的列数(`document.querySelectorAll('thead th').length`,没有多出来的空列);
2. 拖完后在控制台执行 `[...document.querySelectorAll('thead th')].map(t => Math.round(t.getBoundingClientRect().width))`,宽度之和 ≈ 容器宽(`document.querySelector('.n-data-table-base-table-body').clientWidth`);
3. 把容器缩窄到所有列放不下:出现横向滚动条,各列宽度为拖出来的值,没有列被拉伸;
4. 拖最后一列:向右拖变宽;向左拖,在总宽仍不足以填满容器时**不变窄**(已知代价);
5. 在列设置里隐藏最后一列:原来倒数第二列成为吸收列,右侧仍无空白。
Expected: 五条成立。**若第 1 条右侧出现空白**,说明吸收列没有真的拿到剩余宽度(检查该列 `<col>` 是否仍带 `width` 样式)——先查原因,不要改断言。结束后关掉 vite。

- [ ] **Step 8: 提交**

```bash
git add src/useColumns.ts src/SmartTable.vue tests/useColumns.test.ts tests/SmartTable.test.ts
git commit -m "feat!: 拖过列宽后的余量由最后一个数据列吸收,取代占位列(B8);带图标列的拖拽下限取 max(resizeMinWidth, 图标下限)(B12)" -m "有意的行为变更:表头 DOM 不再有占位列;最后一列拖窄时若总宽仍不足以填满容器则不变窄。全部列 fixed 时最后一列写显式宽度。把手骑在列界线上的视觉打磨推到 P1。" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 13: 搜索区窄屏折叠态至少露出首个字段(C5)

> 规格 §2 C5、设计文档 2.10。**现象**:开启 `search.collapsible` 且视口 < 640px(`cols='1 s:2 m:3 l:4'` 的 1 列档)时,折叠态 0 个字段(只剩「搜索 / 重置 / 展开」)。**根因(已读官方 `Grid.mjs:198`)**:折叠判定 `childSpan + spanCounter + suffixSpan > collapsedRows * responsiveCols`,1 列 × 1 行 → `1 + 0 + 1 > 1` 一上来就满,0 个字段;不能靠调 `collapsedRows` 的数值解决(库不知道当前列数)。
> **修法**:折叠可见字段数 = `max(1, collapsedRows × cols − 1)`。只有「1 列 × 1 行」这一档会变(0 → 1):此时把传给 `n-grid` 的 `collapsed-rows` 抬到 2(第 1 行字段,第 2 行操作区)。其余档位(2 / 3 / 4 列)不变,开启 `collapsible` 且列数 ≥ 2 的现有用户行为不变。
> **不能用官方 `useBreakpoints`**(它不是 naive-ui 的公开导出,是 naive 的传递依赖 `vooks` 的);库自己用 `window.innerWidth`(与 `matchMedia('(min-width: …)')` 口径相同)+ naive 的默认断点 `xs 0 / s 640 / m 1024 / l 1280 / xl 1536 / xxl 1920`(`config-provider/src/config.mjs`,已核)。

**Files:**
- Create: `src/searchCols.ts`
- Modify: `src/SearchForm.vue`
- Test: `tests/searchCols.test.ts`(新建)

**Interfaces:**
- Produces: `searchCols.ts`:`resolveCols(cols: number | string, viewportWidth: number): number`;`effectiveCollapsedRows(cols: number | string, viewportWidth: number, collapsedRows?: number): number`(`collapsedRows` 缺省 1)。

- [ ] **Step 1: 写失败测试**

Create `tests/searchCols.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { effectiveCollapsedRows, resolveCols } from '../src/searchCols'

describe('resolveCols(与 n-grid responsive="screen" 同口径:naive 默认断点)', () => {
  const DEFAULT = '1 s:2 m:3 l:4'
  it('按视口宽度取最后一个命中的断点', () => {
    expect(resolveCols(DEFAULT, 390)).toBe(1)
    expect(resolveCols(DEFAULT, 639)).toBe(1)
    expect(resolveCols(DEFAULT, 640)).toBe(2)
    expect(resolveCols(DEFAULT, 1023)).toBe(2)
    expect(resolveCols(DEFAULT, 1024)).toBe(3)
    expect(resolveCols(DEFAULT, 1279)).toBe(3)
    expect(resolveCols(DEFAULT, 1280)).toBe(4)
    expect(resolveCols(DEFAULT, 2000)).toBe(4)
  })
  it('数字 = 固定列数;xs: 写法也认;没有裸数字也没有命中断点时按 n-grid 的默认 24', () => {
    expect(resolveCols(3, 300)).toBe(3)
    expect(resolveCols('xs:1 s:2', 300)).toBe(1)
    expect(resolveCols('s:2', 300)).toBe(24)
  })
})

describe('effectiveCollapsedRows(C5)', () => {
  const DEFAULT = '1 s:2 m:3 l:4'
  it('1 列 × 1 行(折叠态 0 个字段的那一档)→ 抬到 2 行:首个字段 + 下一行操作区', () => {
    expect(effectiveCollapsedRows(DEFAULT, 390, 1)).toBe(2)
    expect(effectiveCollapsedRows(1, 1200, 1)).toBe(2)
  })
  it('其余档位不变:2 / 3 / 4 列仍是配置值;1 列但 collapsedRows ≥ 2 也不变(本来就有字段)', () => {
    expect(effectiveCollapsedRows(DEFAULT, 800, 1)).toBe(1)
    expect(effectiveCollapsedRows(DEFAULT, 1100, 1)).toBe(1)
    expect(effectiveCollapsedRows(DEFAULT, 1400, 1)).toBe(1)
    expect(effectiveCollapsedRows(DEFAULT, 390, 2)).toBe(2)
    expect(effectiveCollapsedRows(DEFAULT, 390, 3)).toBe(3)
  })
  it('collapsedRows 缺省按 1', () => {
    expect(effectiveCollapsedRows(DEFAULT, 390)).toBe(2)
  })
})
```

- [ ] **Step 2: 跑,确认失败**

Run: `npx vitest run tests/searchCols.test.ts`
Expected: FAIL —— `Cannot find module '../src/searchCols'`。

- [ ] **Step 3: 实现**

Create `src/searchCols.ts`:
```ts
// 搜索表单折叠态的列数推导(C5)。n-grid 的折叠判定(Grid.mjs:198)在「1 列 × 1 行」时一上来就满,
// 折叠态 0 个字段;库不知道当前列数,所以自己按视口宽度与 naive 的默认断点算出来。
// 不用 naive 的 useBreakpoints:它不是公开导出(是传递依赖 vooks 的)。

/** naive 默认断点(config-provider/src/config.mjs),n-grid responsive="screen" 用的就是它。 */
const BREAKPOINTS: Array<[name: string, minWidth: number]> = [
  ['xs', 0],
  ['s', 640],
  ['m', 1024],
  ['l', 1280],
  ['xl', 1536],
  ['xxl', 1920],
]

/** n-grid 没有给出列数时的默认值。 */
const DEFAULT_COLS = 24

/** 「1 s:2 m:3 l:4」+ 视口宽度 → 当前列数。数字 = 固定列数;首个不带前缀的数字是基础值。 */
export function resolveCols(cols: number | string, viewportWidth: number): number {
  if (typeof cols === 'number') return cols
  let result = DEFAULT_COLS
  const byName = new Map<string, number>()
  for (const token of cols.trim().split(/\s+/)) {
    const m = /^([a-z]+):(\d+)$/i.exec(token)
    if (m) byName.set(m[1], Number(m[2]))
    else if (/^\d+$/.test(token) && result === DEFAULT_COLS) result = Number(token)
  }
  for (const [name, min] of BREAKPOINTS) {
    if (viewportWidth >= min && byName.has(name)) result = byName.get(name)!
  }
  return result
}

/**
 * 传给 n-grid 的 collapsed-rows:折叠可见字段数 = max(1, collapsedRows × cols − 1)。
 * 只有 collapsedRows × cols < 2(即 1 列 × 1 行)时需要修正 → 抬到 2 行;其余档位保持配置值。
 */
export function effectiveCollapsedRows(cols: number | string, viewportWidth: number, collapsedRows = 1): number {
  return collapsedRows * resolveCols(cols, viewportWidth) < 2 ? 2 : collapsedRows
}
```
`src/SearchForm.vue`:
1. `import { computed, h, ref, type PropType, type VNodeChild } from 'vue'` 改为 `import { computed, h, onBeforeUnmount, onMounted, ref, type PropType, type VNodeChild } from 'vue'`;再加 `import { effectiveCollapsedRows } from './searchCols'`。
2. 在 `const collapsed = ref(true)` 之后加:
```ts
// C5:视口宽度用来推导当前列数,让窄屏 1 列的折叠态至少露出首个字段(口径与 n-grid responsive="screen" 相同)
const viewportWidth = ref(typeof window === 'undefined' ? 1280 : window.innerWidth)
const onResize = () => {
  viewportWidth.value = window.innerWidth
}
onMounted(() => window.addEventListener('resize', onResize))
onBeforeUnmount(() => window.removeEventListener('resize', onResize))
const gridCollapsedRows = computed(() =>
  effectiveCollapsedRows(props.config.cols ?? '1 s:2 m:3 l:4', viewportWidth.value, props.config.collapsedRows ?? 1),
)
```
3. 模板里 `:collapsed-rows="config.collapsedRows ?? 1"` 改为 `:collapsed-rows="gridCollapsedRows"`。

- [ ] **Step 4: 跑,确认通过**

Run: `npm test && npm run typecheck`
Expected: 全部通过。

- [ ] **Step 5: 浏览器验证(`n-grid` 的折叠在 jsdom 里无法验证)**

Run: `node_modules/.bin/vite --port 5173`。临时改 `playground/DemoBasic.vue`:给 `<SmartTable>` 加 `:search="{ collapsible: true }"`(验证完 `git checkout playground`)。把浏览器窗口(或 DevTools 设备模拟)宽度设成 500,确认并记录:
1. **折叠态能看到第一个搜索字段**(修复前是 0 个,只有「搜索 / 重置 / 展开」三个按钮);
2. 点「展开」显示全部字段,点「收起」回到 1 个;
3. 窗口拉宽到 700 / 1100 / 1400,折叠态字段数分别为 1 / 2 / 3(与 2.1.1 一致);拉窄过程中(`resize` 事件)数量实时跟着变。
Expected: 三条成立。结束后 `git checkout playground`,关掉 vite。

- [ ] **Step 6: 提交**

```bash
git add src/searchCols.ts src/SearchForm.vue tests/searchCols.test.ts
git commit -m "fix: 开启 collapsible 时窄屏(1 列)折叠态至少露出首个搜索字段(C5)" -m "此前视口 < 640px 折叠态 0 个字段;只有 1 列这一档变化,2/3/4 列行为不变。" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 14: 收尾 —— 版本号、CHANGELOG、规格修正、最终验证(`3.0.0-beta.1`)

> 只做「发布前的最后一公里」。**不 `npm publish`。**
> 本计划实施中发现的、与规格 `docs/smart-naive-table-spec.md` 不一致的几处,在本任务里回写规格(规格是实现的依据,必须与代码一致)。

**Files:**
- Modify: `package.json`(+ `package-lock.json`)、`CHANGELOG.md`、`docs/smart-naive-table-spec.md`

**Interfaces:**
- Consumes: Task 1–13 的全部产物。
- Produces: 可发布的 `3.0.0-beta.1` 工作区。

- [ ] **Step 1: 版本号**

Run: `npm version 3.0.0-beta.1 --no-git-tag-version`
Expected: 输出 `v3.0.0-beta.1`;`package.json` 与 `package-lock.json` 的 `version` 都变为 `3.0.0-beta.1`(`git diff package.json package-lock.json` 只有版本号行)。

- [ ] **Step 2: 写 CHANGELOG**

在 `CHANGELOG.md` 顶部(`# Changelog` 之后、`## 2.1.1` 之前)加入:
```markdown
## 3.0.0-beta.1 - 待发布

> 这是一次 **major** 升级:下面「默认行为变更」里的每一项,**不传任何属性、升级后也会变**。每项都写了回退方式,都是一行属性。

### 默认行为变更(B 级)

| 变更 | 旧 → 新 | 回退方式 |
|---|---|---|
| **每页条数**(B1) | 默认 10 → **100**;可选项 `[10,20,50]` → `[100,500,1000]`。⚠ **远程模式请求里的 `pageSize` 变成 100,后端若限制了 `pageSize` 上限(如 ≤ 50)会直接拒绝请求,升级前请确认** | `defaultPageSize` / `pagination.pageSizes` / 全局 `pageSizes` |
| **默认密度**(B2) | `comfortable` → **`compact`**。**`storageKey` 里存过的旧密度不再覆盖宿主给的 `defaultDensity`**(没有密度按钮时,这些用户本来就改不回去) | `defaultDensity="comfortable"` |
| **工具栏去掉密度按钮**(B3) | 默认显示 → 不显示。`toolbar.density` 属性保留、默认改为 `false`;`defaultDensity` 现在是**响应式**的(宿主的个人设置变了,已挂载的表格跟着变) | `toolbar: { density: true }`(此时存储里的密度优先,与旧行为一致) |
| **分页外观**(B4) | 页码序列 → 官方 `simple`(输入框 / 总页数);每页条数选择器由库自己画(官方 `simple` 不带)。**新增 label `pageSizeSuffix`**(默认 `'page'`,选项显示 `100 / page`;中文宿主请设为 `'页'`) | `pagination: { simple: false }`(回到页码序列,走官方 `showSizePicker` / `pageSizes`) |
| **静态数据模式不显示刷新**(B5) | 显示(点了无效)→ 隐藏。实例方法 `refresh()` 保留 | 无(本来就无效) |
| **表头图标悬停才显示**(B6) | 排序箭头 / 漏斗常驻 → 悬停该列表头或键盘聚焦时淡入;正在排序 / 已筛选的列常驻;触屏(`hover: none`)淡显常驻。漏斗现在可被 Tab 聚焦 | 暂无开关 |
| **列头过滤面板**(B7) | 单条件 / 勾选 → **多条件编辑**(≤ 5 条,≥ 2 条出现且 / 或);options 列底部有「高级条件」;默认可选操作符变多(见「新增」);面板支持键盘(焦点进入、Esc 关闭、关闭后焦点回漏斗) | 无 |
| **拖过列宽后的余量**(B8) | 补一列占位列 → 由**最后一个可见非固定列**吸收。**表头 DOM 不再有占位列**;最后一列拖窄时若总宽仍不足以填满容器则不变窄。全部列 `fixed` 时最后一列写显式宽度 | 无 |
| **筛选后的分页**(B9) | 库远程回第 1 页(有意偏离官方默认 `'current'`,**保持不变**);现在宿主显式传官方 `paginationBehaviorOnFilter` 就照官方 | 传官方 `paginationBehaviorOnFilter` |
| **卡片内边距**(B11) | 官方 medium `19/24/20`(窄档 `12/16`)→ **四边 16px**(`size="small"` + 库内卡片自己的 `paddingSmall` 覆盖,不影响宿主全局主题) | 给卡片传官方 `size` / 自己的主题覆盖 |
| **可拖拽列的拖拽下限**(B12,只影响开了 `resizable` 的用户) | 固定 60px → 带图标的列取 `max(resizeMinWidth, 图标下限)`:仅排序 93、仅过滤 102、两者 123 | 列上显式写 `minWidth` |

### 缺陷修复(C 级)

- **⚠ C2:`defaultSortOrder` 现在会生效。** 此前给列写了 `defaultSortOrder` 却因被受控 `sortOrder` 盖掉而从未生效;升级后**首次请求会带上排序参数、箭头会回显**。如果你有这样的列,请确认这是你想要的。
- C1:列上写 `sorter: { multiple }` 的多列排序不再被截成单列(箭头回显与远程参数都变正确)。
- C3:options 列的过滤值里带 `notEqual` / `isNull` / 「多条 equal 且」时,打开勾选面板不再静默丢条件、确认不再覆盖原条件(自动展开「高级条件」)。
- C4:无值算子(`isNull` / `isNotNull`)值为空时不再被当成「没填」丢弃。
- C5:开启 `search.collapsible` 时,窄屏(视口 < 640px,1 列)折叠态至少露出首个搜索字段(此前 0 个)。

### 新增

- **多列排序**:列上写官方 `sorter: { multiple: n }`(**数值大者优先,与点击顺序无关**)。远程参数:单列不变;多列仍带最高优先级列的 `sortField` / `sortOrder`,**另加 `sorts: [{ field, order }…]`**(`order` 为 `'asc' | 'desc'`)。实例方法 `sort(columnKey, order)`、`clearSorter()`(沿用官方 `DataTableInst` 命名)。排序态不持久化。
- **`FilterAction` 由 8 个扩到 15 个**:新增 `isNull` `isNotNull` `like` `startsWith` `endsWith` `in` `notIn`。**后端同学请注意 `filters[].conditions[].action` 会多出这些取值**。语义:`isNull`/`isNotNull` 不需要值(空 = `null`/`undefined`/空白串/空数组,`0`/`false` 不算空);`startsWith`/`endsWith` 忽略大小写;`like` 是 SQL `LIKE`(`%` 任意长度、`_` 单字符,整串匹配、忽略大小写);`in`/`notIn` 的值是数组。**`in` 经勾选面板回写会变成若干 `equal` 取「或」——语义相同、序列化形状不同。** 新增导出:`NO_VALUE_ACTIONS`、`isValuelessAction`、`actionValueKind`、`isOptionsRepresentable`(均在 `filter.ts`,可单测)。
- **`filterChips`**:已生效条件 chips(默认 `false`):点击重开该列面板、× 删一条、超一行折成 `+N`、行末「清除全部 / 恢复默认」(有列声明了 `defaultValue` 时是后者,语义不变)。
- **`toolbar.more`**:「更多」菜单(官方 `NDropdown` 的 `options` 原样透传),选中后发 `moreSelect(key, option)` 事件;不传 / 空数组 / 只有分隔线时不显示。库不内置导出 / 导入。
- 新 labels:`more`、`pageSizeSuffix`、`filterActiveCount`、`filterAddCondition`、`filterRemoveCondition`、`filterLogicAnd`、`filterLogicOr`、`filterAdvanced`、`filterSimple`、`filterClearAll`、`filterRestoreDefault`、`filterIsNull`、`filterIsNotNull`、`filterLike`、`filterStartsWith`、`filterEndsWith`、`filterIn`、`filterNotIn`、`filterNoValue`(未覆盖时取英文默认)。
- 新类型导出:`SortItem`、`ToolbarMoreOption`。

### 内部

- 删除内部的 `withFillerColumn` / `FILLER_COLUMN_KEY`(从未从入口导出过)。
```

- [ ] **Step 3: 回写规格**

`docs/smart-naive-table-spec.md` 做这些修正(用编辑器逐处改,保持其它内容不变):
1. **§3 新增 API 表「更多菜单」一行**:`toolbar.more?: DropdownMixedOption[]` 改为 `toolbar.more?: ToolbarMoreOption[]`(`NonNullable<DropdownProps['options']>[number]`;`DropdownMixedOption` 不是 naive-ui 的公开导出)。
2. **§3 表里 `FilterAction` 15 个一行**(在「模式 2 条件构造器」那行里)拆开:操作符本身(纯逻辑 + 文案 + 面板默认集合)**已在 P0 随 B7 落地**,P1 只剩「模式 2 条件构造器 UI + 窄档抽屉」;并补上 7 个操作符的语义定义(见本计划 Task 2 的说明)。
3. **§1 B4 一行**:回退方式里的「`pagination.simple: false`(新增开关)」改为「官方 `pagination.simple: false`(**不是新增 API**,是官方自己的属性)」;并补 `pageSizeSuffix` label。
4. **§1 B10**:注明「P0 里 `filterChips` 默认 `false`;模式 2 默认开随 P1 发布」。
5. **§1 B12 与 §5.6**:B12 拆成两半——**拖拽下限(已在 P0 落地)**与**「`th` `overflow:visible` + 递减 `z-index`、把手骑在列界线上」(推到 P1 视觉任务)**;§5.6「余量」一段改为:**主方案是吸收列不写宽度(弹性)**,`scroll-x` 始终 ≥ 各列下限之和;**仅当全部列 `fixed` 时**退为最后一列写显式宽度 `max(下限, 容器宽 − 其余列宽之和)`。
6. **§2 C5**:状态改为「已落地(P0)」。
7. **§5.3**:「漏斗是 `<button>` 可 Tab 聚焦」改为「**(P0 Task 9 起)** 漏斗按钮可被 Tab 聚焦;2.1.1 里它是 `:focusable="false"`」。
8. **§5.5**:补一句「`useSmartTable` 这个无 UI 的导出 hook 的默认 `defaultPageSize` 仍是 10,不随 B1 改变」。
9. 文件头部「状态」一行改为:「设计定稿;**P0 已按 `docs/superpowers/plans/2026-09-30-smart-table-v3-p0.md` 实现**,`3.0.0-beta.1` 待发布;P1 / P2 另出计划」。

- [ ] **Step 4: 最终验证(要贴真实输出)**

Run:
```bash
npm test
npm run typecheck
npm run build
git check-ignore dist
git status --short
```
Expected:
- `npm test`:全部通过,`Test Files  N passed (N)`、`Tests  M passed (M)`(M 明显大于基线 126;**把真实数字写进最终报告**)。
- `npm run typecheck`:无输出。
- `npm run build`:构建成功,并且 d.ts 生成**没有类型错误**(`vite.config.ts` 配置了 `afterDiagnostic`,有错会让构建失败)。
- `git check-ignore dist`:输出 `dist`(被忽略,**不要提交构建产物**)。若没有输出,说明 `dist/` 被跟踪了——停下来问用户再决定,不要自行提交。
- `git status --short`:只应看到本任务改的 `package.json`、`package-lock.json`、`CHANGELOG.md`、`docs/smart-naive-table-spec.md`(以及仓库里原本就未跟踪的文件),**没有** `src/` / `tests/` 的未提交改动。

- [ ] **Step 5: 提交**

```bash
git add package.json package-lock.json CHANGELOG.md docs/smart-naive-table-spec.md
git commit -m "chore: 3.0.0-beta.1 版本号与 CHANGELOG;回写规格与实现的差异" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 6: 交接(不要自己发布)**

把下面这些**真实结果**汇报给用户,然后停下,等用户决定是否发布:
1. `npm test` 的通过数、`npm run typecheck`、`npm run build` 的真实输出;
2. 各 Task 里「浏览器验证」步骤的记录(哪些成立、哪些没成立);
3. **没有验证的**:Firefox / Safari、真实触屏、屏幕阅读器、宿主真实后端对 `pageSize: 100` 的接受度;
4. **`README.md` / `README.en.md` 的 API 表尚未更新**(`toolbar.more` / `moreSelect`、`filterChips`、`sort()` / `clearSorter()`、新 labels、`toolbar.density` 默认值变化)——这是文档任务,不在本计划内,**正式版前要补**;
5. 发布命令(由用户手动执行):`npm publish --tag beta`(`prepublishOnly` 会先 `npm run build`)。

---

## 规格覆盖对照(自查)

| 规格条目 | 所在 Task | 备注 |
|---|---|---|
| B1 每页 100 / `[100,500,1000]` | 7 | 远程后端上限风险写入 CHANGELOG |
| B2 默认紧凑 + 旧存储不盖宿主值 + 响应式 | 5 | Review Focus 1 |
| B3 去掉密度按钮、`toolbar.density` 默认 false | 5 | |
| B4 官方 simple + 库自画每页选择器 | 7 | Review Focus 2;窄档不画 |
| B5 静态模式隐藏刷新 | 6 | |
| B6 悬停显现 + 触屏兜底 + 漏斗可聚焦 | 9 | 浏览器验证 |
| B7 多条件面板 + options 高级条件 + 键盘 | 2、3、10 | Review Focus 3 |
| B8 吸收列取代占位列 | 12 | Review Focus 4 |
| B9 `paginationBehaviorOnFilter` | 7 | |
| B10 模式 2 默认 chips | **P1** | P0 只有 `filterChips` 显式开启(Task 11) |
| B11 卡片内边距 16px | 8 | |
| B12 拖拽下限 | 12 | 把手骑线视觉**推到 P1** |
| C1 / C2 多列排序 + 默认排序 | 4 | 真实浏览器已复现(设计文档 9.4) |
| C3 `filterValueToOptions` 丢条件 | 3、10 | |
| C4 无值算子 | 2 | |
| C5 搜索折叠 | 13 | |
| A:多列排序 API、`sort()` / `clearSorter()` | 4 | |
| A:`filterChips` | 11 | |
| A:`toolbar.more` + `moreSelect` | 6 | Review Focus 5 |
| A:触屏兜底 | 9 | |
| A:新 labels | 2、6、7、9、10、11 | 每个 Task 各加各的 |
| 15 个 `FilterAction` | 2 | 语义见 Task 2 说明 |
| P1:模式 2 UI、`#batch`、`fillHeight`、放大、把手骑线视觉 | **不在本计划** | 另出 `…-v3-p1.md` |
| P2:`cardOnNarrow` | **不在本计划** | 另出 `…-v3-p2.md` |
