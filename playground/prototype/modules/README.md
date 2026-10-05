# 对照页模块契约(给 m5–m13 的模块 agent)

对照页 = `/prototype.html`(源码 `playground/prototype/`),目标 G0:与设计原型 `docs/smart-naive-table-design.html` 一模一样。
外壳 / 注册表 / 共享件已就绪(本文件描述它们)。**一个模块 = 你自己的几个新文件,不改外壳、不改注册表、不改共享件。**

## 1. 目录与命名

```
playground/prototype/
  ProtoApp.vue            外壳(只读注册表;不要改)
  ProtoModule.vue         模块 1–4(不要改)
  shell.ts                ShellState / useShell() / createShell()
  i18n.ts  i18n-dict.ts   useT() / translate() / registerDict() / textW();英文词典(外壳 + 通用词条)
  TrayIcon.ts             空状态线性托盘(外壳已配,模块不用管)
  data.ts  fetcher.ts     模块 1–4 的 2000 行数据与后端(Row / DATA / OWNERS / TODAY / fetchRows / queryRows / MOCK_DELAY;可读,不要改名导出)
  modules/
    registry.ts           注册表(自动发现 ProtoM{N}.vue;不要改)
    ProtoPlaceholder.vue  没有 ProtoM{N}.vue 时的占位
    ProtoM5.vue … ProtoM13.vue        ← 各模块 agent 新建(文件名固定:ProtoM + 编号 + .vue)
    shared/               共享件(见 §3);CrudModal.vue 是 B 组的;btn.ts 是宿主按钮的统一写法(设计 §2.15)
  data/                   rand.ts(共享);其余 data/m{N}-<名>.ts  ← 各模块自己的数据
  backends/               memory.ts(共享);其余 backends/m{N}-<名>.ts ← 各模块自己的后端
tests/proto/
  _mount.ts               mountApp(m, opts) / useAppStubs()(共享)
  m{N}-*.test.ts 或 ProtoM{N}.test.ts   ← 各模块自己的测试(文件名带编号,互不撞)
```

**新增一个模块只需新建 `modules/ProtoM{N}.vue`**:注册表用 `import.meta.glob('./ProtoM*.vue')` 按 `ProtoM${no}.vue` 自动解析(懒加载,一个模块写坏只影响它自己那页)。
模块的元数据(名称 / 组 / ★ / natural / rowClick)在 `registry.ts` 的 `META`,逐项照原型,已填好;发现与原型不一致告诉协调者,不要自己改。

### 文件所有权(分组)

| 组 | 模块 | 你可以新建 / 改 | 不要碰 |
|---|---|---|---|
| A | m5 + m6 | `modules/ProtoM5.vue` `ProtoM6.vue`、`data/m5-*` `m6-*`、`backends/m5-*` `m6-*`、`tests/proto/*m5*` `*m6*` | 其它组的文件、`shared/*`、`registry.ts`、外壳、`src/**`、`tools/parity/**`、`docs/**` |
| B | m7 + m8 + m9 + m11 | 对应 `ProtoM*.vue`、`modules/shared/CrudModal.vue`(B 独占;m2 的内联弹窗后续换它)、`data/m7-*` `m8-*` `m9-*` `m11-*`、`backends/…`、`tests/proto/*` 同名 | 同上 |
| C | m10 + m12 + m13 | 对应 `ProtoM*.vue`、`data/m10-*` `m12-*` `m13-*`、`backends/…`、`tests/proto/*` 同名 | 同上 |

共享件(`modules/shared/*.ts`、`data/rand.ts`、`backends/memory.ts`、`i18n*.ts`、`shell.ts`)**只读**;缺能力在你自己的文件里写,并在报告里提需求。

## 2. 外壳与你的模块

外壳(`ProtoApp.vue`)提供:`NConfigProvider`(locale / dateLocale 随语言、官方 `component-options` 配了空状态托盘图标)、`NMessageProvider`、`NDialogProvider`(`useMessage()` / `useDialog()` 直接用,模块不要自己加 Provider)、`NLayout`(灰 / 白底)、`SMART_TABLE_DEFAULTS`(`align/titleAlign: left`、`tag: small bordered`、`labels` 随语言)。
**不用 KeepAlive**:切模块 = 重新挂载(勾选清空、挂载即请求、`storageKey` 重读),与原型 `enterModule` 一致。

`#stage[data-nat]`(只剩模块 10,`natural`)与 `#stage[data-rowclick]`(模块 11 行 `cursor:pointer`)的样式外壳已写。

URL:`?m=1..14 &theme=light|dark &lang=zh|en &bg=gray|white &density=compact|comfortable`(缺省 `zh / gray / compact`,`theme` 跟随系统)。

### 模块骨架

```vue
<script setup lang="ts">
// 对应原型 MC.<key>;库缺口(留空)与宿主写法写在这里
import { computed, ref } from 'vue'
import { SmartTable } from '../../../src/index'
import { materialCols } from './shared/materialCols'
import { protoToolbar, moreOptions } from './shared/toolbar'
import { useProtoTable } from './shared/useProtoTable'

const { shell, t, tableProps, toast } = useProtoTable()
// placeholder 等静态串依赖 t():列配置放 computed,切语言才会重算(标题 / label 本身是函数,不需要)
const columns = computed(() => materialCols({ t, selection: true, index: true, memo: true }))
</script>

<template>
  <!-- 根必须是 .proto-host(外壳 CSS 与 fillHeight 的确定高度依赖它) -->
  <div class="proto-host">
    <SmartTable v-bind="tableProps" :columns="columns" :fetcher="fetcher" row-key="no"
      :title="t('物料单据')" :search="{ container: 'table' }" :toolbar="protoToolbar({ more: moreOptions(t) })" fill-height />
  </div>
</template>

<style scoped>
.proto-host { flex: 1 1 0; min-height: 0; display: flex; flex-direction: column; }
.proto-host > :deep(.smart-table) { flex: 1 1 0; }
</style>
```
natural 模块(只有 10)不开 `fill-height`(整页在主区里滚动);模块 12「上下布局」不是 natural,恒为一屏(上方主表 `fill-height`,下方子表自然高度、封顶)。

### 必配项(除模块 1 外所有模块)

1. **构造器**:`:search="{ container: 'table' }"`;字段列写 `search: { actions: OPS_BY_TYPE[type], … }`(`materialCols` 已替物料七列写好)。豁免:m10 建议豁免(静态数据 + 拖拽按显示下标 splice,过滤态会改错行;待协调者确认)、m12 的子表与「选择物料」弹窗不配。
2. **`v-bind="tableProps"`**(`defaultDensity` + `resizable`):密度开关靠它,漏写 = 密度开关对该模块失效。
3. **文案走 `t()`**;列标题 / `search.label` / `options.label` 写成函数 `() => t('…')`(库的函数式标题,渲染期求值)。toast 用 `toast(msg)`(自动 `t()`)。
4. **工具栏**:`:toolbar="protoToolbar({ more? })"`(带 `maximize: true`)。
5. **chips 在表格下方与分页同行**由库负责,模块不用管。
6. 文件头注释:写清对应原型 `MC.<key>`、哪些库缺口留空、哪些是宿主写法。库做不到的**留空并报告**,不要用自定义代码假装。

## 3. 共享件签名

### `shell.ts`
```ts
type Lang = 'zh'|'en'; type PageBg = 'gray'|'white'; type Theme = 'light'|'dark'
interface ShellState { theme: Theme; lang: Lang; bg: PageBg; density: Density
  readonly tableProps: { defaultDensity: Density; resizable: boolean }; readonly isEn: boolean }
useShell(): ShellState     // reactive:shell.lang / shell.density 直接读写,模板里不用 .value;没 provide 时退回默认状态(单测单独挂模块也能跑)
createShell(search?: string): ShellState
```
`shell.tableProps` 在 setup 里取一次是**快照**(非响应式);要响应请用 `useProtoTable().tableProps`(computed)或模板里直接 `shell.tableProps`。

### `i18n.ts`
```ts
useT(): (zh: string) => string                  // 中文原文为键;在 render / computed / 函数标题里调用即随语言响应
translate(zh: string): string                   // 总是输出英文(保留首尾空白;不含汉字原样返回)
registerDict(pairs: [zh, en][], rx?: [RegExp, string | fn][]): void   // 注册你模块的英文词条(见下)
textW(s: string, weight = 500): number          // 文本宽度(canvas,14px 页面字体;jsdom 退回估值),英文表头宽度按它重算
```
**注册英文词条**:在你的 `ProtoM{N}.vue` 的 `<script setup>` 顶层(或你自己的数据文件里)调 `registerDict([['工序', 'Operations'], …], [[/拖了 (\d+) 行/g, 'Dragged $1 rows']])`。
词条取原型 `EN_PAIRS` / `EN_RX`(`docs/smart-naive-table-design.html`)里属于你模块的部分;`i18n-dict.ts` 已含 外壳 / 表格工具栏 / 物料字段与列 / 字典标签 / 弹窗提示 这些通用词条,不要重复加。
你注册的句式排在通用句式**前面**。不翻译的是业务数据(物料名称 / 人名 / 备注);字典标签(状态 / 部门)翻译。

### `modules/shared/useProtoTable.ts`
```ts
useProtoTable(): { shell, t, tableProps: ComputedRef<{ defaultDensity, resizable }>, toast(msg, type?), message }
```
需在 `NMessageProvider` 里调用。`toast('已导出 12 条')` 会走 `t()`。

### `modules/shared/materialCols.ts`
```ts
materialCols(o: { t; keys?: MaterialKey[]; selection?: boolean; index?: boolean
  actions?: (row, index) => VNodeChild; search?: boolean /*默认 true*/; memo?: boolean; patch?: Partial<Record<MaterialKey|'memo'|'actions', object>> }): SmartTableColumn<Row>[]
MATERIAL_COLS   // 原型 COLS:no 112 / name 176(弹性 minWidth)/ owner 88 / status 96 / dept 88 / amount 104 / bizDate 112
```
`selection` → 勾选(40,固定左);`index` → 序号(64,固定左);`actions` → 操作列(140,固定右、不可拖、不进列设置;原型 ACTS_W,设计 §2.15 D:放得下「编辑 / 删除」两个带图标的文字按钮);`memo` → hideInTable 的「备注」构造器专用字段(原型 FIELD_DEFS 第 8 个)。
标题 / options label 是函数;`placeholder` 是静态串 → 在 `computed` 里调用。`patch.amount = { width: 200 }` 是浅合并。

### `modules/shared/options.ts`
```ts
statusOptions(t): SmartTableOption[]   // 已审核 success / 未审核 warning / 已关闭 default(label 是函数)
deptOptions(t): SmartTableOption[]     // 采购部 / 生产部 / 仓储部
ownerOptions(): SmartTableOption[]     // OWNERS 人名,不翻译
STATUS_VALUES, DEPT_VALUES
```

### `modules/shared/ops.ts`
```ts
OPS_BY_TYPE: Record<'text'|'number'|'date'|'select', FilterAction[]>   // 11 / 10 / 8 / 6,与原型一致
opsOf(type): FilterAction[]
```

### `modules/shared/toolbar.ts`
```ts
protoToolbar(opts?: { more?: ToolbarMoreOption[] } & Partial<ToolbarConfig>): ToolbarConfig   // 一律带 maximize: true
moreOptions(t): ToolbarMoreOption[]      // 导出 / 导入 / 分隔线 / 下载导入模板(label 是函数)
downloadCsv(name: string, text: string)  // UTF-8 BOM
ProtoAddButton                            // <proto-add-button :label="t('新增')" @click="…" />,放 #toolbar-right
```
`ProtoAddButton` **没有 `type` 属性**:所有模块(含模块 1)的「新增」都是淡绿底 + 加号(官方 `secondary` + `type="primary"`,设计 §2.15),图标盒调成 13px;只有 `label` 一个 prop、一个 `click` 事件。

### `modules/shared/btn.ts`
宿主按钮的统一写法(设计 §2.15):页面上的按钮 = 淡色底 + 左图标;表格行内的「编辑 / 删除」是无底文字按钮,只加颜色和小图标;确认弹窗 / 确认气泡的按钮按 macOS 两档。
```ts
editAction(label, onClick)            // 行内「编辑」:text + primary + 铅笔图标,按钮高 ACT_BTN(22px),图标 14px
deleteTrigger(label)                  // 行内「删除」(放 NPopconfirm 的 trigger 里):text + error + 垃圾桶,不带点击回调
removeAction(label, onClick)          // 子表行内「移除」:同「删除」写法,直接带点击回调
DELETE_DIALOG_BTNS                    // NDialog 的 positiveButtonProps / negativeButtonProps:「删除」= 实心红、「取消」= 淡灰(secondary、关掉官方的 ghost、size medium),最小宽 80px
DELETE_POPCONFIRM_BTNS                // NPopconfirm 的同名两个 props:取消 = 淡灰、删除 = 实心红(官方默认 small,不设最小宽)
EditIcon  DownloadIcon  UserIcon      // 宿主图标(铅笔 / 下载 / 用户):只有宿主按钮才用,**不进库**(库零图标库依赖)
// 另外把 src/icons.ts 里的按钮图标原样再导出,方便模块里写宿主按钮:CheckIcon ClearIcon FunnelIcon MagnifierIcon PlusIcon ResetIcon SortIcon TrashIcon(库内部用,不是从包入口导出的)
```
删除确认的用法:把它们展开进 `dialog.warning({ …, ...DELETE_DIALOG_BTNS })`,或 NPopconfirm 的 props(`{ ...DELETE_POPCONFIRM_BTNS, onPositiveClick }`,见 `ProtoM12.vue`)。

### `modules/shared/useTier.ts`
```ts
T_NARROW = 600; T_WIDE = 1280; tierOf(w): 'narrow'|'mid'|'wide'
useTier(): { el: Ref<HTMLElement|null>, width: Ref<number>, tier: ComputedRef<Tier> }   // <div ref="el" class="proto-host">;ResizeObserver 量容器宽(不是视口)
```
单测里 jsdom 没有 ResizeObserver 行为(`_mount.ts` 的桩什么都不做):要测某一档直接 `width.value = 1400`,或单测 `tierOf`。

### `data/rand.ts`
`mulberry32(seed)`、`hash32(str)`、`dayTs('YYYY-MM-DD')`、`isoDay(ts)`、`DAY_MS` —— 原型同款确定性序列,不要自己另写随机数。

### `backends/memory.ts`
```ts
delay(ms = MOCK_DELAY.ms)                                  // 单测里 MOCK_DELAY.ms = 0 即全部后端不等待
pageSlice(rows, { page, pageSize }): { items, total }
applyCommon(rows, params, { fields?: { key, type: 'text'|'select'|'number'|'date' }[]; sortVal? }): rows
   // 搜索字段(文本包含 / 其它等于,数字与字符串数字互认)+ urgent + 构造器 filters(matchFilterValue)+ sorts / sortField;不改源数组
fetchPage(rows, params, spec?): Promise<PageResult>        // delay + applyCommon + pageSlice
```
构造器的「单据日期 ≥ a 且 ≤ b」是同一字段两条条件(`filters: [{ field, logic, conditions: [gte, lte] }]`),后端校验读这个形状。

## 4. 测试

- jsdom 文件头:`// @vitest-environment jsdom`;纯逻辑(数据 / 后端)用默认 node 环境。
- `tests/proto/_mount.ts`:
  ```ts
  useAppStubs()                 // describe 顶层调一次:装 matchMedia / ResizeObserver 桩、MOCK_DELAY.ms = 0,用例后清 body
  await mountApp(5, { lang: 'en', bg: 'white', density: 'comfortable', theme: 'dark', query: 'x=1' })   // 挂整个 ProtoApp 进入模块 5,已等异步组件 + 首批请求
  ```
- jsdom 里 `fillHeight` 的虚拟滚动表体高度为 0、不渲染行 → 行 / 单元格外观走真实浏览器读数;单测锁传给 `SmartTable` 的 props(`findComponent(SmartTable).props('columns')` 等)、表头、工具栏、请求结果。
- 列标题是函数:断言要先求值(`typeof c.title === 'function' ? c.title() : c.title`)。
- 比较「同一个实例没重挂」用 `wrapper.vm.$.uid`(代理对象每次不同)。
- 测试失败**不要**改断言 / skip / 放宽阈值,先定位原因。

## 5. 浏览器实测

dev server 已在 5173:`http://localhost:5173/prototype.html?m=N`。真实 Edge 用 `tools/parity/cdp.mjs`(只读使用)的 `launch(port)` / `Page`,端口用协调者分给你的那段(9410–9419 留给外壳,模块 agent 别占)。不要杀任何 node / vite / msedge 进程。

## 6. 容易踩的坑

- **不要在 bash 双引号 / heredoc 里写反斜杠、反引号**:Bash 工具会把 `\r` `\n` `\u` 展开,正则 / 字符串被悄悄写坏(例如 `/\r?\n/` 会被拆成三行导致 SFC 编译失败)。含 `\` 的代码用 Edit / Write 工具写,或 Python 里用 `chr(92)` 拼。
- 行尾:仓库是 LF;不要用 `sed -i`;改前按字节看 CRLF / LF。
- `import.meta.glob` 懒加载:你的模块文件有编译错误时,整个 vite 页面只有你这一页白,但 `npm test` 里 `mountApp(N)` 会抛错 —— 提交前跑通你自己的测试。
- 不要给模块根外再包 Provider;不要在模块里 `provide(SMART_TABLE_DEFAULTS, …)`(全局默认在外壳);密度不要放全局默认(`resolveDefaults` 把它拷成标量,不响应),一律 `v-bind="tableProps"`。
