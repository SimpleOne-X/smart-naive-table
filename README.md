<div align="center">

# smart-naive-table

基于 **Vue 3 + Naive UI** 的列驱动表格组件<br>
写好 `columns`、接上 `fetcher`，搜索表单、分页、字典翻译、列设置全部自动生成

[![npm](https://img.shields.io/npm/v/smart-naive-table?color=18a058)](https://www.npmjs.com/package/smart-naive-table)
[![license](https://img.shields.io/github/license/SmartCode-X/smart-naive-table?color=18a058)](./LICENSE)

简体中文 | [English](./README.en.md)

</div>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/SmartCode-X/smart-naive-table/main/assets/basic-dark.png">
  <img alt="smart-naive-table 效果图" src="https://raw.githubusercontent.com/SmartCode-X/smart-naive-table/main/assets/basic-light.png">
</picture>

<p align="center">
  <a href="#快速上手">快速上手</a> ·
  <a href="#常用写法">常用写法</a> ·
  <a href="#全局配置与中文文案">中文文案</a> ·
  <a href="#api">API</a>
</p>

## 特性

- **列驱动**：列上加 `search` 就是搜索项，加 `options` 就能翻译单元格、生成下拉框，一处配置多处生效
- **一个函数对接后端**：`fetcher` 入参 `{ page, pageSize, ...搜索条件 }`，返回 `{ items, total }`
- **开箱即用的工具栏**：刷新（仅远程模式）、列设置（显隐 / 拖拽排序 / 左右固定），可记住用户的设置；可选的「更多」菜单（`toolbar.more`）；密度切换默认不再显示（`toolbar: { density: true }` 才有）
- **表头过滤 + 列宽拖拽**：列上加 `filter` 就有漏斗，支持勾选式与多条件式两种面板（最多 5 条、且 / 或，可键盘操作）；列宽拖完能记住，拖一列只动一列
- **跟随 Naive 主题**：亮色 / 暗色、语言都跟随 `<n-config-provider>`
- **细节到位**：请求防竞态、空参数自动剔除、固定列宽度兜底、异步字典去重
- **轻量**：唯一运行时依赖 `sortablejs`（只在开启行拖拽时加载），ESM，自带 TypeScript 类型

## 安装

```bash
npm i smart-naive-table
```

项目中需已安装 `vue >= 3.3` 和 `naive-ui >= 2.34`。

## 快速上手

```vue
<script setup lang="ts">
import { SmartTable, type SmartTableColumn, type SmartTableFetcher } from 'smart-naive-table'

interface User {
  id: number
  account: string
  name: string
  status: number
  createTime: string
}

// ① 定义列：search 生成搜索项；options + tag 把状态值翻译成彩色标签
const columns: SmartTableColumn<User>[] = [
  { type: 'index' },
  { key: 'account', title: '账号', search: true },
  { key: 'name', title: '姓名', search: true },
  {
    key: 'status',
    title: '状态',
    search: true,
    tag: true,
    options: [
      { label: '在职', value: 1, tagType: 'success' },
      { label: '离职', value: 2, tagType: 'error' },
    ],
  },
  { key: 'createTime', title: '创建时间', format: 'datetime' },
]

// ② 对接后端：把接口返回值转换成 { items, total }
const fetcher: SmartTableFetcher<User> = async ({ page, pageSize, ...query }) => {
  const res = await getUserPage({ current: page, size: pageSize, ...query }) // 换成你的接口
  return { items: res.records, total: res.total }
}
</script>

<template>
  <!-- ③ 渲染；storage-key 用来记住用户的列设置 -->
  <SmartTable :columns="columns" :fetcher="fetcher" storage-key="user-list" />
</template>
```

这样就得到一个完整的列表页：

- **搜索区**：「账号」「姓名」输入框、「状态」下拉框（选项来自 `options`），以及查询 / 重置按钮
- **表格**：序号、状态标签、格式化后的时间，底部带分页
- **工具栏**：刷新（仅远程模式）、列设置；密度切换默认不显示（`toolbar: { density: true }` 才有）

点击「查询」时，`fetcher` 收到的参数（空值已自动剔除）：

```js
{ page: 1, pageSize: 100, account: 'user01', status: 1 }
```

> **提示**：把 SmartTable 放在 `<n-config-provider>` 内，主题和语言都跟随它。组件自带文案默认是英文，中文项目请看 [全局配置与中文文案](#全局配置与中文文案)。上图的完整代码见 [playground/DemoBasic.vue](./playground/DemoBasic.vue)。

## 常用写法

### 搜索项

```ts
{ key: 'name', title: '姓名', search: true }                           // 输入框
{ key: 'status', title: '状态', options: statusOptions, search: true } // 有 options 时自动用下拉框
{ key: 'age', title: '年龄', search: { type: 'number' } }              // 指定控件类型
{ key: 'keyword', title: '关键字', hideInTable: true, search: true }   // 只做搜索项，不显示成列

// 日期范围，并把参数名改为 createRange → fetcher 收到 createRange: ['2024-01-01', '2024-01-31']
{ key: 'createTime', title: '创建时间', search: { type: 'daterange', key: 'createRange' } }
```

控件类型：`input`（默认）、`number`、`select`、`date`、`daterange`、`switch`；需要完全自定义时用 `search.render`。全部字段见 [SearchConfig](#searchconfig)。

搜索区布局：

```vue
<SmartTable :search="{ collapsible: true, collapsedRows: 1 }" /> <!-- 超过 1 行时折叠，带展开 / 收起 -->
<SmartTable :search="{ layout: 'inline' }" />                    <!-- 无卡片、单行排列，适合窄栏 -->
<SmartTable :search="false" />                                   <!-- 不显示搜索区 -->
```

### 字典、标签与格式化

```ts
import type { SmartTableOption } from 'smart-naive-table'

const statusOptions: SmartTableOption[] = [
  { label: '在职', value: 1, tagType: 'success' },
  { label: '休假', value: 2, tagType: 'warning' },
  { label: '离职', value: 3, tagType: 'error' },
]

{ key: 'status', title: '状态', options: statusOptions, tag: true }   // 显示为彩色标签
{ key: 'deptId', title: '部门', options: () => api.getDeptOptions() } // 异步字典：自动 loading、并发去重
{ key: 'salary', title: '薪资', format: 'money' }                     // 6,000.00
{ key: 'birthday', title: '生日', format: 'date' }                    // 2024-01-01
{ key: 'score', title: '得分', format: (v) => `${v} 分` }             // 自定义格式
```

`options` 支持静态数组、`ref`、异步函数三种写法；异步字典可调用实例方法 `reloadOptions()` 重新拉取。

### 操作列与自定义单元格

```ts
import { h } from 'vue'
import { NButton } from 'naive-ui'

{
  key: 'actions',
  title: '操作',
  width: 120,
  fixed: 'right',
  hideInSetting: true, // 不出现在列设置面板里
  render: (row) => h(NButton, { text: true, type: 'primary', onClick: () => edit(row) }, () => '编辑'),
}
```

不想写 `render` 函数，也可以用插槽：

```vue
<SmartTable :columns="columns" :fetcher="fetcher">
  <template #cell-name="{ row }">
    <a @click="open(row)">{{ row.name }}</a>
  </template>
</SmartTable>
```

单元格渲染优先级：`render` → `#cell-{key}` 插槽 → `options` 翻译 → `format` → 原始值。

### 列设置

![列设置](https://raw.githubusercontent.com/SmartCode-X/smart-naive-table/main/assets/column-settings.png)

点击工具栏最右侧的图标打开，可以勾选显隐、拖拽排序、固定到左 / 右侧。

- 传了 `storage-key` 就会保存到 localStorage，刷新页面不丢失
- 列定义改动后自动合并：删掉的列被剔除，新增的列插到声明位置
- `hide: true` 初始隐藏（可在面板中勾回）；`hideInSetting: true` 不进面板

### 表头过滤

列上加 `filter` 就会在表头出现漏斗图标，面板有两种形态，按列自动选：

- **勾选式**（列上有 `options`）：直接勾选字典项，多选时内部等价于「若干 *等于* 条件取或」（`multiple: false` 用官方单选按钮）；底部「高级条件」可切到多条件编辑，勾选表达不了的条件（如 *不等于*）会自动展开在这里，不会丢
- **条件式**（列上没有 `options`）：多行「动作 + 值」（最多 5 条，≥ 2 条时可选「且 / 或」）；动作按值类型给默认集合（文本给 *包含 / 不包含 / 等于 / 不等于*，数字和日期给 *等于 / 大于 / 小于* 等）
- 面板里改的是草稿，点「确定」才生效；Esc 关闭并丢弃草稿，Tab 在面板内循环

```ts
const columns: SmartTableColumn<Row>[] = [
  // 有字典 → 勾选式；multiple: false 变单选
  { key: 'status', title: '状态', options: statusOptions, tag: true, filter: true },
  // 没字典 → 条件式，文本列默认「包含 / 不包含 / 等于 / 不等于」
  { key: 'name', title: '姓名', filter: true },
  // 数字列：给一个初始过滤值（也是面板里「重置」的恢复目标）
  {
    key: 'salary',
    title: '薪资',
    format: 'money',
    filter: { defaultValue: { logic: 'and', conditions: [{ action: 'gte', value: 10000 }] } },
  },
  // 日期列：值是纯日期串时按「整天」比较，「等于 2024-03-05」能命中当天任意时刻
  { key: 'createTime', title: '创建时间', format: 'datetime', filter: true },
]
```

**远程模式**（传了 `fetcher`）过滤在后端做：条件变化后回到第 1 页重查，参数默认长这样，后端照着翻成 SQL / ORM 条件即可：

```jsonc
{
  "page": 1,
  "pageSize": 100,
  "filters": [
    { "field": "name", "logic": "and", "conditions": [{ "action": "contains", "value": "张" }] },
    { "field": "status", "logic": "or", "conditions": [{ "action": "equal", "value": 1 }, { "action": "equal", "value": 2 }] }
  ]
}
```

后端形状不一样就传自己的序列化器（也可以用 `createSmartTableDefaults({ filterSerializer })` 全局设一次）：

```vue
<SmartTable :columns="columns" :fetcher="fetchList" :filter-serializer="toMyBackendShape" />
```

**静态模式**（传了 `data`）过滤在前端做，不用写任何适配代码。需要自定义匹配就写 `filter.filter`：

```ts
{ key: 'tags', title: '标签', filter: { filter: (value, row) => row.tags.some((t) => matchFilterValue(value, t)) } }
```

面板也可以整个自己画，`ctx` 含 `value`、`setValue`、`close`：

```ts
{ key: 'deptId', title: '部门', filter: { render: ({ value, setValue, close }) => h(MyPanel, { value, setValue, close }) } }
```

过滤态可以编程式读写：`tableRef.filters`、`tableRef.setFilter(key, value)`、`tableRef.clearFilters()`，变化时触发 `@filter-change`。

想让用户一眼看到当前生效的条件，加 `filter-chips`：工具栏下方多一行 chips，点 chip 重开该列面板、× 删掉这一条，放不下时折成「+N」；有列声明了 `defaultValue` 时，偏离默认才出现「恢复默认」，否则 ≥ 2 个 chip 时出现「清除全部」：

```vue
<SmartTable :columns="columns" :fetcher="fetchList" filter-chips />
```

整表一键关掉（和 `:search="false"` 同一套写法，列上的 `filter` 声明一并失效）：

```vue
<SmartTable :columns="columns" :fetcher="fetchList" :filter="false" />
```

也可以 `createSmartTableDefaults({ filterable: false })` 全局关，再用实例上的 `:filter="true"` 单独打开某张表。

### 列宽拖拽

表格上加 `resizable`，所有数据列的表头右边缘就能拖动改宽：

```vue
<SmartTable :columns="columns" :fetcher="fetchList" storage-key="staff" resizable @column-resize="onResize" />
```

- 单独某列不想让拖：列上写 `resizable: false`（列上的值永远优先于表格上的开关）
- 传了 `storage-key` 就会连同列设置一起存进 localStorage，刷新页面保持
- 拖动过程中持续触发 `@column-resize`（`key`、`width`），写 localStorage 内部做了防抖
- **拖某一列只改这一列**：首次拖动时会把所有列（含序号 / 勾选列）钉成当前实际宽度，同时把表格切到 `table-layout: fixed`、宽度写死成列宽之和。此后左侧的列纹丝不动，只有被拖的列跟着鼠标走
- **表格始终填满容器**:列宽之和小于容器时,富余宽度由**最后一个可见、非固定、可拖的列(吸收列)**吸收(表头里不再有占位列),其余列仍是拖出来的精确宽度;加宽到超过容器则照常横向滚动。**吸收列没有拖拽把手(即使还没拖过列宽也没有)**:要调它的宽度,拖它左邻列的把手;给某列写 `resizable: false` 可让它不参与吸收(吸收列顺延到前一列)。想回到按容器自适应,点列设置里的「恢复默认」
- 拖不到 0 宽:可拖拽列自动补 `minWidth`:默认 60,带排序 / 过滤图标的列取 `max(60, 图标下限)`(仅排序 93、仅过滤 102、两者 123);列上写了 `minWidth` 以列上的为准
- 列设置里的「恢复默认」会把宽度一起还原

### 分页

默认是官方 `simple` 分页（页码输入框 / 总页数），每页 100 条，可选 `[100, 500, 1000]`：

- 每页条数选择器是嵌在分页 `suffix` 里的官方 `NPagination`，文案跟随 `<n-config-provider>` 的语言（「100 / 页」），不需要额外配置文案；`pageSizes` 里写 `{ label, value }` 对象会原样显示，当前每页条数不在选项里时自动并入
- 窄档（表格根节点宽度 < 600px）不画每页条数选择器，免得分页条折行
- 默认每页条数的解析优先级：实例 `default-page-size` > 实例 `pagination.pageSize` / `pagination.defaultPageSize` > 全局 `defaultPageSize` > 宿主（实例或全局）显式给的 `pageSizes` 的第一项 > 100
- 想回到页码序列：`:pagination="{ simple: false }"`（此时走官方 `showSizePicker` / `pageSizes`）；`simple` 下官方不渲染 `showQuickJumper` / `pageSlot`
- ⚠ 远程模式请求里的 `pageSize` 默认是 100：后端若限制了 `pageSize` 上限，请用 `default-page-size` 或 `pageSizes` 调回来
- 改每页条数后回到第 1 页（远程、静态数据模式都一样）
- 不开 `fill-height` 时，翻页 / 改每页条数后若卡片顶部已滚出视口，页面会自动滚回卡片顶部；开了 `fill-height` 则表体在卡片内滚动、翻页后表体回顶

### 更多场景

| 场景 | 写法 |
|---|---|
| 服务端排序 | 列上写 `sorter: true`，`fetcher` 会收到 `sortField` 和 `sortOrder`（`'asc'` / `'desc'`）；多列用官方 `sorter: { multiple: n }`（数值大者优先），`fetcher` 另收到 `sorts: [{ field, order }]`；列上的 `defaultSortOrder` 生效（带进首次请求） |
| 编程式排序 | `tableRef.sort(key, order)` / `tableRef.clearSorter()`（与官方 `DataTableInst` 同签名，远程模式回第 1 页重查） |
| 铺满父容器 | `fill-height`，父容器须定高（表体在卡片内滚动、分页条贴底、虚拟滚动）；不开时翻页自动回卡片顶部 |
| 外部条件联动 | `:params="{ deptId }"`，值变化后自动回到第 1 页重新查询（如左侧部门树） |
| 静态数据 | 传 `:data="list"`、不传 `fetcher`，前端分页；监听 `@search` 自行过滤 |
| 树形表格 | 静态数据的行带 `children` 字段，并设置 `row-key` |
| 展开行 | 特殊列 `{ type: 'expand', renderExpand: (row) => ... }` |
| 多选 | 特殊列 `{ type: 'selection' }` + `v-model:checked-row-keys` |
| 主从表高亮 | `:active-row-key="currentId"` + `@row-click` |
| 行拖拽排序 | `row-draggable` + `@row-drag-sort`，组件只调整顺序，保存由你调用接口 |
| 列宽拖拽 | 表格上写 `resizable`，或列上写 `resizable: true` |
| 表头过滤 | 列上写 `filter: true`；远程模式收到 `filters` 参数 |
| 已生效条件 chips | `filter-chips`（工具栏下方一行，点击重开面板、× 删一条） |
| 工具栏「更多」菜单 | `:toolbar="{ more: [{ label: '导出', key: 'export' }] }"` + `@more-select="(key) => ..."`（选项即官方 `NDropdown` 的 `options`；库不内置导出 / 导入） |
| 单元格竖线 | 默认开启(内部 `single-line: false`);想回单线样式写 `:single-line="true"` |
| 虚拟滚动 | `virtual-scroll` + `max-height` |
| 合计行 | `:summary="(pageData) => ..."` |
| 其它表格属性 | 直接写在 SmartTable 上，原样传给 `n-data-table`（如 `striped`、`bordered`） |

### 调用表格方法

```vue
<script setup lang="ts">
import { ref } from 'vue'
import type { SmartTableInst } from 'smart-naive-table'

const tableRef = ref<SmartTableInst<User>>()

// 在需要的地方调用：
// tableRef.value?.refresh()  保持当前页刷新（如编辑之后）
// tableRef.value?.search()   回到第 1 页查询（如新增之后）
// tableRef.value?.reset()    清空搜索条件并查询
// tableRef.value?.sort('createTime', 'descend')  编程式排序；clearSorter() 清空
</script>

<template>
  <SmartTable ref="tableRef" :columns="columns" :fetcher="fetcher" />
</template>
```

### 增删改弹窗

`useTableCrud` 管理弹窗的打开、提交、删除状态，弹窗和表单用你自己的 `n-modal` + `n-form`：

```ts
import { useTableCrud } from 'smart-naive-table'

const crud = useTableCrud({
  form: () => ({ name: '', email: '' }), // 新增时的空表单
  create: (form) => api.create(form),
  update: (form, row: User) => api.update(row.id, form),
  remove: (row: User) => api.remove(row.id),
  onSuccess: () => tableRef.value?.refresh(),
})
```

```vue
<!-- 打开：crud.openCreate() 新增、crud.openEdit(row) 编辑；删除：crud.removeRow(row) -->
<n-modal v-model:show="crud.visible.value" preset="card" :title="crud.mode.value === 'create' ? '新增' : '编辑'">
  <n-form :model="crud.model.value">
    <n-form-item label="姓名"><n-input v-model:value="crud.model.value.name" /></n-form-item>
  </n-form>
  <template #footer>
    <n-button type="primary" :loading="crud.submitting.value" @click="crud.submit()">保存</n-button>
  </template>
</n-modal>
```

`crud.submit()` 成功后自动关闭弹窗并触发 `onSuccess`。完整示例见 [playground/DemoCrud.vue](./playground/DemoCrud.vue)。

## 全局配置与中文文案

组件自带的按钮文案（查询、重置、列设置、过滤面板等）默认是英文。库内置了一份完整的中文文案 `zhCNLabels`，在入口文件 `provide` 一次，所有表格都会生效：

```ts
// main.ts
import { createApp } from 'vue'
import { SMART_TABLE_DEFAULTS, createSmartTableDefaults, zhCNLabels } from 'smart-naive-table'
import App from './App.vue'

const app = createApp(App)

app.provide(
  SMART_TABLE_DEFAULTS,
  createSmartTableDefaults({
    labels: zhCNLabels, // 想改个别词：{ ...zhCNLabels, search: '查找' }
    pageSizes: [100, 500, 1000],
  }),
)

app.mount('#app')
```

也可以只给某张表：`<SmartTable :labels="zhCNLabels" />`。3.0 新增的文案键全部可选，2.1.1 时手写的完整 labels 对象照常可用，缺的键取英文默认。

输入框占位符（"请输入"）和日期面板来自 Naive UI 自己的语言包，给 `<n-config-provider>` 配上即可：

```vue
<script setup lang="ts">
import { NConfigProvider, zhCN, dateZhCN } from 'naive-ui'
</script>

<template>
  <n-config-provider :locale="zhCN" :date-locale="dateZhCN">
    <!-- 你的页面 -->
  </n-config-provider>
</template>
```

- **多语言切换**：`labels` 传 `computed`，列 `title`、选项 `label` 写成函数 `() => t('xxx')`，切换语言立即生效
- **优先级**：表格上的属性 / 列上的值 > 全局默认 > 内置默认
- 全部可配置字段见 [全局默认字段](#全局默认字段)

## API

### 列配置

数据列支持 Naive UI 列的全部属性（`width`、`minWidth`、`fixed`、`align`、`ellipsis`、`sorter`、`resizable` 等），另外增加：

> `filter` 由本包接管（比 Naive 原生列过滤多了条件面板与远程联动），因此不再透传 Naive 的 `filter` / `filterOptions` 等原生过滤属性。

| 字段 | 类型 | 说明 |
|---|---|---|
| `key` | `string` | **必填**。行数据字段名，同时是搜索参数名、插槽名 |
| `title` | `string \| () => VNodeChild` | 列标题；写成函数可随语言切换 |
| `search` | `boolean \| SearchConfig` | 生成搜索项；`true` 时有 `options` 用下拉框，否则用输入框 |
| `filter` | `boolean \| FilterConfig` | 生成表头过滤；`true` 时有 `options` 用勾选面板，否则用条件面板 |
| `options` | `Option[] \| Ref<Option[]> \| () => Promise<Option[]>` | 字典：翻译单元格，同时作为搜索下拉选项 |
| `tag` | `boolean` | 翻译结果显示为 `NTag`，颜色取选项的 `tagType` |
| `format` | `'date' \| 'datetime' \| 'money' \| (value, row) => string` | 格式化显示 |
| `render` | `(row, index) => VNodeChild` | 自定义单元格，优先级最高 |
| `hide` | `boolean` | 初始隐藏，可在列设置中勾回 |
| `hideInTable` | `boolean` | 只作为搜索项，不显示成列 |
| `hideInSetting` | `boolean` | 显示在表格中，但不出现在列设置里（常用于操作列） |
| `children` | `SmartTableDataColumn[]` | 多级表头 |

- **Option**：`{ label, value, tagType?, disabled?, children? }`，`tagType` 可选 `default` / `primary` / `info` / `success` / `warning` / `error`
- **特殊列**：`{ type: 'index' }` 序号（跨页连续）、`{ type: 'selection' }` 多选、`{ type: 'expand', renderExpand }` 展开行

### SearchConfig

| 字段 | 类型 | 说明 |
|---|---|---|
| `type` | `'input' \| 'number' \| 'select' \| 'date' \| 'daterange' \| 'switch'` | 控件类型 |
| `key` | `string` | 请求参数名，默认同列 `key` |
| `label` | `string \| () => string` | 表单标签，默认取列标题 |
| `placeholder` | `string` | 占位文字，默认用 Naive 语言包 |
| `defaultValue` | `any` | 初始值，也是重置后的值 |
| `order` | `number` | 排序，越小越靠前，默认按列顺序 |
| `span` | `number` | 占几格，默认 1 |
| `props` | `object` | 透传给对应的 Naive 控件 |
| `render` | `(ctx) => VNodeChild` | 完全自定义控件；`ctx` 含 `value`、`setValue`、`params`、`search` |

### FilterConfig

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `mode` | `'options' \| 'condition'` | 有字典则 `'options'` | 面板形态：勾选列表 / 条件行 |
| `key` | `string` | 同列 `key` | 过滤参数名（与展示字段不同时覆盖） |
| `options` | 同列 `options` | 复用列上的字典 | 只给过滤用的候选项 |
| `multiple` | `boolean` | `true` | 勾选面板是否多选 |
| `type` | `'input' \| 'number' \| 'select' \| 'date'` | 按列 `format` 推断 | 条件面板的值控件 |
| `actions` | `FilterAction[]` | 按 `type` 给 | 可选动作，见下 |
| `defaultValue` | `FilterValue \| null` | `null` | 初始过滤值，也是面板里「重置」的恢复目标 |
| `props` | `object` | — | 透传给值控件 |
| `render` | `(ctx) => VNodeChild` | — | 自定义整个面板；`ctx` 含 `value`、`setValue`、`close` |
| `filter` | `(value, row) => boolean` | 内置条件求值 | 静态 `data` 模式的自定义匹配（远程模式无效） |

- **FilterAction**（15 个）：`'equal'`（等于）、`'notEqual'`、`'contains'`（包含）、`'notContains'`、`'gt'`（大于）、`'gte'`、`'lt'`（小于）、`'lte'`，以及 3.0 新增的 `'isNull'` / `'isNotNull'`（为空 / 不为空，不需要值）、`'like'`（SQL `LIKE`：`%` 任意长度、`_` 单个字符，整串匹配、忽略大小写）、`'startsWith'` / `'endsWith'`（忽略大小写）、`'in'` / `'notIn'`（值是数组）。**列头面板的默认可选操作符仍是前 8 个，其余需在列上 `filter.actions` 显式开启**；未知操作符一律按不匹配处理
- **FilterValue**：`{ logic: 'and' | 'or', conditions: { action, value }[] }`；值为空（`null` / `''` / `[]`）的条件不参与求值（`isNull` / `isNotNull` 除外），全空即未过滤
- 各列之间恒为「与」，列内部由 `logic` 决定
- 内置面板一列最多编辑 5 条条件（≥ 2 条时可选「且 / 或」），勾选式产出若干 `equal` 取「或」；一条 `in` 经勾选面板回写会变成若干 `equal` 取「或」（语义相同、序列化形状不同）。编程式 `setFilter` / `defaultValue` 不限条数

### Props

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `columns` | `SmartTableColumn[]` | — | **必填**。列配置 |
| `fetcher` | `(params) => Promise<{ items, total }>` | — | 远程数据来源 |
| `data` | `T[]` | — | 静态数据（前端分页），与 `fetcher` 二选一 |
| `row-key` | `string \| (row) => key` | `'id'` | 行唯一标识 |
| `params` | `object` | — | 附加请求参数，变化后回到第 1 页重查 |
| `immediate` | `boolean` | `true` | 挂载后立即请求 |
| `default-page-size` | `number` | `100` | 默认每页条数；宿主给了 `pageSizes` 时缺省取它的第一项（解析优先级见「分页」） |
| `pagination` | `false \| PaginationProps` | — | `false` 隐藏分页；传对象与内置配置合并；默认官方 `simple`，`{ simple: false }` 回到页码序列 |
| `search` | `false \| SearchFormConfig` | — | 搜索区配置（见下表）；`false` 隐藏 |
| `filter` | `boolean` | `true` | `false` 关掉全部表头过滤（即使列上写了 `filter`） |
| `filter-chips` | `boolean` | `false` | 在工具栏下方显示已生效条件 chips |
| `toolbar` | `false \| { refresh, density, columnSettings, more }` | 刷新（仅远程）、列设置；`density` 默认 `false` | 工具栏按钮开关；`more` 是「更多」菜单的选项（官方 `NDropdown` 的 `options`），选中发 `more-select` |
| `title` | `string` | — | 表格标题，也可用 `#title` 插槽 |
| `card-props` | `Partial<CardProps>` | — | 库渲染的卡片（表格卡片、搜索卡片）的官方 `NCard` 属性，合并在默认 `size="small"` + 四边 16px 内边距之后；回退旧外观 `{ size: 'medium' }` |
| `fill-height` | `boolean` | `false` | 铺满父容器：表体在卡片内滚动（官方 `flex-height` + 虚拟滚动）、分页条贴底；**父容器须定高**；开启时忽略 `max-height` |
| `storage-key` | `string` | — | 设置后,列设置(显隐 / 顺序 / 固定 / 列宽)保存到 localStorage;**密度只在开了 `toolbar: { density: true }`(密度按钮)时才读写存储**,否则以 `default-density` 为准 |
| `default-density` | `'comfortable' \| 'compact'` | `'compact'` | 默认密度（响应式：宿主改了它，已挂载的表格跟着变） |
| `labels` | `Partial<SmartTableLabels>` | 英文 | 覆盖组件文案，传 `computed` 可随语言切换 |
| `active-row-key` | `string \| number \| null` | — | 高亮对应的行 |
| `row-draggable` | `boolean` | `false` | 开启行拖拽排序 |
| `resizable` | `boolean` | `false` | 所有数据列可拖拽调整列宽；列上的 `resizable` 优先 |
| `filter-serializer` | `(state) => object` | 见「表头过滤」 | 过滤态 → 请求参数的序列化 |
| `drag-handle` | `string` | — | 拖拽手柄的 CSS 选择器，不传则整行可拖 |

其它未列出的属性（如 `striped`、`max-height`、`checked-row-keys`、`virtual-scroll`）会原样传给 `n-data-table`。

**SearchFormConfig**（`search` 属性的对象形式）：

| 字段 | 默认值 | 说明 |
|---|---|---|
| `layout` | `'grid'` | `'grid'` 卡片网格；`'inline'` 无卡片单行排列 |
| `cols` | `'1 s:2 m:3 l:4'` | 网格列数（按屏幕宽度响应） |
| `labelPlacement` | `'left'` | 标签位置：`'left'` / `'top'` |
| `labelWidth` | — | 标签宽度 |
| `collapsible` | `false` | 搜索项较多时折叠（仅 grid 布局） |
| `collapsedRows` | `1` | 折叠时保留的行数 |

### 事件

| 事件 | 参数 | 触发时机 |
|---|---|---|
| `search` | `params` | 点击查询（参数已清洗） |
| `reset` | — | 点击重置 |
| `loaded` | `rows, total` | 远程数据加载成功 |
| `error` | `err` | 请求失败（组件不弹提示，由你处理） |
| `row-click` | `row, index` | 点击行 |
| `row-drag-sort` | `{ from, to, reordered }` | 行拖拽结束 |
| `filter-change` | `key, value, state` | 表头过滤变化（`clearFilters` 时 `key` 为空串） |
| `column-resize` | `key, width` | 拖拽列宽（拖动过程中持续触发） |
| `more-select` | `key, option` | 工具栏「更多」菜单（`toolbar.more`）选中某项 |

### 插槽

| 插槽 | 参数 | 说明 |
|---|---|---|
| `title` | — | 表格标题 |
| `toolbar` | — | 工具栏左侧，适合放新增、批量操作按钮 |
| `toolbar-right` | — | 工具栏右侧，位于内置按钮之前 |
| `cell-{key}` | `{ row, index }` | 自定义某列的单元格 |
| `header-{key}` | `{ column }` | 自定义某列的表头 |
| `empty` | — | 无数据时显示的内容 |
| `pagination-prefix` | Naive 分页信息 | 分页栏左侧，如"已选 3 项" |

### 实例方法

| 名称 | 说明 |
|---|---|
| `refresh()` | 保持当前页和查询条件，重新请求 |
| `search()` | 回到第 1 页查询 |
| `reset()` | 重置搜索条件并查询 |
| `reloadOptions(key?)` | 重新加载异步字典；不传 `key` 则全部重新加载 |
| `loading` / `rows` / `pagination` | 加载状态、当前行数据、分页状态 |
| `params` | 响应式搜索参数，可直接读写 |
| `filters` | 当前过滤态（只读快照） |
| `setFilter(key, value)` | 设置某列过滤；传 `null` 清除。远程模式会回第 1 页重查 |
| `clearFilters()` | 清空全部过滤（恢复各列 `defaultValue`） |
| `sort(columnKey?, order?)` | 设置某列排序（与官方 `DataTableInst.sort` 同签名：`order` 缺省 `'ascend'`，不传 `columnKey` 等同 `clearSorter()`）。远程模式回第 1 页重查，并通知 `@update:sorter` |
| `clearSorter()` | 清空全部排序，并通知 `@update:sorter`（载荷 `null`） |
| `columnWidths` | 各列被拖拽后的宽度 |
| `tableRef` | 原生 `NDataTable` 实例（可调用 `scrollTo` 等） |

### 全局默认字段

通过 `createSmartTableDefaults({...})` 设置，均为可选：

| 字段 | 内置默认 | 说明 |
|---|---|---|
| `labels` | 英文 | 组件文案，可传 `ref` / `computed` |
| `align` / `titleAlign` | `'center'` | 单元格 / 表头对齐方式 |
| `emptyText` | `'—'` | 空值占位符 |
| `defaultPageSize` | — | 默认每页条数；不给时取显式给的 `pageSizes` 的第一项，再缺省 100 |
| `pageSizes` | `[100, 500, 1000]` | 每页条数选项 |
| `showSizePicker` | `true` | 是否显示每页条数选择器 |
| `density` | `'compact'` | 默认密度 |
| `dateValueFormat` | `'yyyy-MM-dd'` | 日期搜索项的值格式 |
| `searchCols` | `'1 s:2 m:3 l:4'` | 搜索区网格列数 |
| `fixedFallbackWidth` | `120` | 固定列未写宽度时的兜底宽度 |
| `indexWidth` | `64` | 序号列宽度 |
| `tag` | `{ size: 'small', bordered: false }` | `tag: true` 列的标签样式 |
| `activeRowBg` | — | 高亮行的背景色 |
| `resizable` | `false` | 所有表格默认开启列宽拖拽 |
| `filterable` | `true` | 是否允许列声明表头过滤；`false` 全局关掉 |
| `resizeMinWidth` | `60` | 可拖拽列的最小宽度（带排序 / 过滤图标的列取它与图标下限的较大者） |
| `filterSerializer` | 见「表头过滤」 | 过滤态 → 请求参数 |

### 其它导出

- `useSmartTable(fetcher, options)`：组件内部使用的数据核心（加载、分页、搜索、防竞态），不依赖 UI，可自己搭界面
- `matchFilterValue`、`applyFilters`、`defaultFilterSerializer`、`isFilterActive`、`isOptionsRepresentable`、`NO_VALUE_ACTIONS`、`isValuelessAction`、`actionValueKind` 等过滤内核函数（与 UI 无关，后端 mock 或自建界面可直接复用）
- `cleanParams`、`formatDate`、`formatDatetime`、`formatMoney`、`defaultLabels`、`zhCNLabels` 等工具函数与文案
- 全部类型：`SmartTableColumn`、`SmartTableFetcher`、`SmartTableInst`、`SmartTableOption`、`SearchConfig` 等

## 行为说明

- 请求前自动清洗搜索参数：字符串去掉首尾空格；空串、`null`、`undefined`、空数组不传；`0` 和 `false` 保留
- 快速翻页时，先发出、后返回的旧响应会被丢弃，不会覆盖新数据
- 重置时搜索项恢复为 `defaultValue`，没有则为 `null`
- 固定列未写 `width` 时自动补上宽度（`minWidth` 或 120），避免 Naive 固定列错位
- `scroll-x` 默认等于可见列的宽度之和（含拖拽后的宽度），手动传入则以你的为准
- 过滤条件变化后回到第 1 页：远程模式重新请求，静态模式在前端过滤
- 过滤值为空（`null` / `''` / `[]`）的条件会被忽略，不会传给后端（`isNull` / `isNotNull` 不需要值，照常传）；`0` 和 `false` 保留
- 过滤值是纯日期串（`YYYY-MM-DD`）时按「整天」比较，`等于 2024-03-05` 能命中当天任意时刻
- 列宽写入 localStorage 做了防抖;存储结构从 `v1` 升到 `v2`,已存的列显隐 / 顺序 / 固定照常生效;存储里的旧密度**只在开了密度按钮(`toolbar: { density: true }`)时继续生效**,否则以 `default-density` 为准(B2)
- 列设置至少保留一列：只剩一列可见时，它的勾选框禁用

## 本地开发

```bash
npm install
npm run dev        # 启动 playground（本页截图即来自这里）
npm test           # 单元测试
npm run typecheck  # 类型检查
npm run build      # 构建到 dist/
```

**分支与发布**：日常开发在 `dev` 分支，通过 PR 合并到 `main`。发布新版本时，先在 `dev` 上执行 `npm version patch --no-git-tag-version`（或 `minor` / `major`）并更新 [CHANGELOG](./CHANGELOG.md)，合并到 `main` 后会自动发布到 npm 并创建 GitHub Release。

## License

[Apache-2.0](./LICENSE)
