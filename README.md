<div align="center">

# smart-naive-table

**写好 `columns`，一个完整的后台列表页就出来了；宽屏是表格，手机上自动变卡片。**<br>
搜索、过滤、排序、分页、字典标签、列设置、可编辑，全部从列配置里长出来。

[![npm](https://img.shields.io/npm/v/smart-naive-table?color=18a058)](https://www.npmjs.com/package/smart-naive-table)
[![license](https://img.shields.io/github/license/SmartCode-X/smart-naive-table?color=18a058)](./LICENSE)
![Vue 3](https://img.shields.io/badge/Vue-3.3%2B-42b883)
![Naive UI](https://img.shields.io/badge/Naive%20UI-2.44%2B-18a058)
![TypeScript](https://img.shields.io/badge/TypeScript-ready-3178c6)

简体中文 | [English](./README.en.md)

</div>

<table>
  <tr>
    <td>
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset="./assets/preview-wide-dark.png">
        <img alt="宽档：条件搜索 + 业务按钮 + 工具栏 + 状态标签 + 分页的物料单据表（组件预览模块 2「条件搜索」）" src="./assets/preview-wide-light.png" width="720">
      </picture>
    </td>
    <td>
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset="./assets/preview-narrow-dark.png">
        <img alt="窄档：同一份配置在 390 宽下自动变成卡片列表（组件预览模块 2「条件搜索」）" src="./assets/preview-narrow-light.png" width="240">
      </picture>
    </td>
  </tr>
  <tr>
    <td align="center">宽档：表格</td>
    <td align="center">窄档（390 宽）：同一份配置，自动变卡片</td>
  </tr>
</table>

<p align="center">
  <a href="#亮点">亮点</a> ·
  <a href="#功能清单">功能清单</a> ·
  <a href="#截图">截图</a> ·
  <a href="#移动端自适应">移动端</a> ·
  <a href="#快速开始">快速开始</a> ·
  <a href="#常用写法">常用写法</a> ·
  <a href="#api-速查">API</a> ·
  <a href="#里程碑">里程碑</a> ·
  <a href="#文档索引">文档</a>
</p>

> **版本状态**：当前是 `3.0.0`（npm `latest`）。3.0 是 major 升级，不改任何代码也会有行为变化，升级步骤见 [MIGRATION.md](./MIGRATION.md)；本页描述的是 3.0 的当前实现，进度与未完成项见[里程碑](#里程碑)。
>
> **从 2.x 升级？** 3.0.0 相对 2.x 有破坏性变更（涉及默认值与外观，如默认每页条数、分页形态），请先看 [升级指南 MIGRATION.md](./MIGRATION.md)。

## 亮点

- **列驱动，一份配置长出整页**：搜索表单、条件构造器、表头过滤、字典标签、格式化、列设置、可编辑控件，全部从 `columns` 派生，不用再写一套并行配置。
- **移动端自适应**：开 `card-on-narrow`，容器宽度 < 600 时表格自动换成卡片列表，业务按钮折叠成「操作 ▾」，搜索收成「输入框 + 筛选」底部抽屉，排序走底部抽屉，控件放大到触控尺寸（40px）；可编辑表格在窄档点卡片开底部抽屉表单。**同一份 `columns`，不写第二套移动端代码**。分档按**容器**宽度而不是视口宽度，嵌在侧栏 / 弹窗里也对。
- **条件搜索 + 表头过滤**：一行式「字段 + 比较符 + 值」条件构造器，列头漏斗面板支持勾选或多条件（≤ 5 条、且 / 或），15 个操作符，已生效条件 chips；远程模式产出统一的 `filters` 参数，静态数据模式前端直接求值。
- **官方优先，不另起炉灶**：它是 Naive UI 的上层封装，`n-data-table` 的属性原样透传；明暗主题和语言跟随 `<n-config-provider>`；运行时依赖只有 `sortablejs`（开启行拖拽才加载）。
- **大数据与嵌入**：`fill-height` 铺满定高父容器、虚拟滚动、分页条贴底；每页条数可到 10000；页面内放大、批量栏、「更多」菜单。
- **Excel 式可编辑表格**：按数据类型推断控件，批量保存 + 脏标记 + 放弃，Excel 粘贴、撤销、行级只读、异步校验；外部 / 主数据用 `select-table` 下拉表格。
- **下拉表格选择 `SmartSelectTable`**：触发器像下拉框，点开是「搜索框 + 带分页的表格」，单选 / 多选、本地或远程。
- **开箱即用的工程细节**：完整 TypeScript 类型、中文文案包 `zhCNLabels`、`labels` 渲染期求值（切语言即时生效）、全局默认值、`storage-key` 持久化列设置。

| | 自己用 `n-data-table` 拼 | 用 smart-naive-table |
|---|---|---|
| 搜索表单 | 手写表单、绑定、重置、查询 | 列上写 `search: true` |
| 状态翻译 / 彩色标签 | 每列写一个 `render` | 列上写 `options` + `tag` |
| 对接后端 | 自己管 loading、分页、竞态、空参数 | 一个 `fetcher` 函数 |
| 列显隐 / 排序 / 固定 / 记忆 | 自己做抽屉 + 存本地 | 内置，加一个 `storage-key` |
| 表头过滤、多条件、且 / 或 | 自己写 Popover 和求值 | 列上写 `filter: true` |
| 手机适配 | 另写一套移动端列表 | 加 `card-on-narrow`，同一份 `columns` |
| 明暗主题 / 中英文 | 逐处适配 | 跟随 `<n-config-provider>` |

## 功能清单

下表按「组件预览」的 14 个模块组织（侧栏 查询 / 列 / 行 / 数据 / 布局 五组）。**预览**列写的是模块号：`npm run dev` 后打开 `http://localhost:5173/prototype.html?m=<模块号>`（`&theme=dark` 切暗色），就能看到对应功能的真实表现；窄档在浏览器里把窗口缩到 400 宽左右即可。预览列写「—」的是预览没有单独模块、但库里有实现的能力。带 ★ 的是最值得一试的几项。

| 分组 | 功能 | 怎么开 | 预览 |
|---|---|---|---|
| **表格基础** | 远程 `fetcher` / 静态 `data` 两种数据源：请求防竞态、空参数剔除、失败时页码还原、`@error`、空状态、`immediate: false` 首屏不请求 | `fetcher` / `data` | m8 |
| | 分页：官方 `simple` 分页，默认每页 100，可选项随 `fill-height` 区分；不开 `fill-height` 时翻页自动回卡片顶部 | 默认 | m2–m14（翻页回顶看 m12） |
| | 勾选、展开行、序号列、合计行（`summary`）、多级表头、固定列 | `type: 'selection' / 'expand' / 'index'`、`children`、`fixed` | m5 |
| **查询与过滤** | 搜索表单：列上 `search`，自动选控件（输入 / 数字 / 下拉 / 日期 / 日期范围 / 开关 / 自定义），可折叠 / 单行 | `search: true` | m1 |
| | ★ 条件搜索：「字段 + 比较符 + 值」条件构造器，并入表格卡片，点「更多条件」展开多条件面板 | `:search="{ container: 'table' }"` | m2 |
| | ★ 表头过滤：漏斗面板，勾选式 / 多条件式（≤ 5 条，且 / 或），15 个操作符，已生效条件 chips | `filter: true`、`filter-chips` | m3 |
| | 多列排序：本地 / 服务端，默认排序，`sort()` / `clearSorter()` | `sorter: { multiple: n }` | m4 |
| **列** | ★ 字典、标签与格式化：状态翻译成彩色标签，日期 / 金额格式化，异步字典自动去重，空值占位 | `options` + `tag` / `format` | m6 |
| | ★ 列设置：显隐、拖拽排序、左右固定、记住用户设置、恢复默认；列宽拖拽 | `storage-key`、`resizable` | m7、m6 |
| **窄档（移动端）** | 窄档卡片列表、「操作 ▾」折叠、触控尺寸、筛选抽屉、排序抽屉、合计卡、卡片内勾选 / 展开 / 拖拽手柄；详见[移动端自适应](#移动端自适应) | `card-on-narrow` | m2–m14（390 宽） |
| **行** | 行拖拽排序：整行或手柄拖，松手发 `@row-drag-sort`，窄档卡片保留拖拽 | `row-draggable`、`drag-handle` | m10、m14 |
| | 主从联动：外部条件联动（`params`）、当前行高亮、点击行联动详情 | `params`、`active-row-key`、`@row-click` | m11 |
| **数据与编辑** | 增删改弹窗：`useTableCrud` 管理打开 / 提交 / 删除状态，弹窗和表单用你自己的 `n-modal` + `n-form`（预览里窄档改用底部抽屉） | `useTableCrud()` | m9 |
| | ★ 可编辑表格：Excel 式单元格编辑，按数据类型推断控件，Excel 粘贴、撤销、行级只读、异步校验、批量保存 + 脏标记 + 放弃，可选即时保存；窄档点卡片开底部抽屉 | `editable` + `@save` | m14 |
| | 下拉表格选择：独立组件 `SmartSelectTable`，也是可编辑表格 `select-table` 编辑器的内核（选一行同时填其它列） | `SmartSelectTable` / `editorProps` | m14（编辑器）；独立用法见 `/playground.html` |
| **布局与大数据** | 铺满父容器 + 虚拟滚动、页面内放大、批量栏、「更多」菜单、工具栏图标 | `fill-height`、`toolbar.maximize`、`#batch`、`toolbar.more` | m2–m9 |
| | 嵌入式表格：精简子表（无搜索 / 工具栏 / 分页、`striped`、合计行）、弹窗里的选择表、主表翻页回顶 | `search: false`、`toolbar: false`、`pagination: false` | m12 |
| **主题与 i18n** | 明暗主题、`labels` 渲染期求值、`zhCNLabels`、函数式列标题 / 选项、密度（紧凑 / 舒适）、页面底色 | `<n-config-provider>`、`labels`、`default-density` | m13 |

另外：完整 TypeScript 类型；`useSmartTable`（脱离 UI 的数据核心）、过滤内核函数等工具可单独使用（见 [其它导出](#其它导出)）。

## 截图

下面所有截图都是从「组件预览」（`/prototype.html`，真实 `SmartTable` 渲染）实际截取的，不是设计稿截图。拍摄脚本是 [`tools/parity/readme-shots.mjs`](./tools/parity/readme-shots.mjs)。

**同一份配置，宽档 / 窄档，明 / 暗**（预览模块 2「条件搜索」）：

<table>
  <tr>
    <td align="center"><img alt="宽档亮色：条件搜索 + 业务按钮 + 工具栏 + 分页" src="./assets/preview-wide-light.png" width="520"></td>
    <td align="center"><img alt="窄档亮色：卡片列表，操作 ▾ + 输入框 + 筛选 + 简洁分页" src="./assets/preview-narrow-light.png" width="170"></td>
  </tr>
  <tr>
    <td align="center"><img alt="宽档暗色" src="./assets/preview-wide-dark.png" width="520"></td>
    <td align="center"><img alt="窄档暗色" src="./assets/preview-narrow-dark.png" width="170"></td>
  </tr>
</table>

**窄档的底部抽屉**：左 = 点「排序」（预览模块 4，暗色）；右 = 可编辑表格里点卡片，整行表单（预览模块 14，亮色）。

<table>
  <tr>
    <td align="center"><img alt="窄档排序抽屉：每列「无 / 升序 / 降序」" src="./assets/preview-narrow-sort-sheet.png" width="240"></td>
    <td align="center"><img alt="窄档可编辑表格：点卡片弹出底部抽屉表单" src="./assets/preview-narrow-edit-sheet.png" width="240"></td>
  </tr>
</table>

**表头过滤**（预览模块 3）：点列头漏斗，勾选式面板 + 「高级条件」，已生效条件在表格下方以 chips 显示。

![表头过滤：单据状态列的漏斗面板，勾选 + 高级条件，下方是已生效条件 chip](./assets/preview-header-filter.png)

**列设置**（预览模块 7）：显隐、拖拽排序、固定到左 / 右、恢复默认。

![列设置面板：每列的显隐勾选、拖拽把手、固定到左右的按钮、恢复默认](./assets/preview-column-settings.png)

**可编辑表格**（预览模块 14）：改过的格左上角有小三角，工具栏出现「放弃修改」和「保存修改(N)」，合计行实时更新。

![可编辑表格：工艺路线示例，两个改过的格带脏标记，保存修改(2)](./assets/preview-editable-grid.png)

**下拉表格 select-table**（预览模块 14，暗色）：点开「工序名称」，浮层里是「搜索框 + 带分页的表」，选一行自动带出其它列。

![select-table：点开工序名称，浮层里是搜索框和带分页的工序库表格，当前值高亮](./assets/preview-select-table.png)

## 移动端自适应

开 `card-on-narrow`，同一份 `columns` 就同时适配宽屏和手机，不需要第二套移动端代码：

```vue
<SmartTable :columns="columns" :fetcher="fetcher" card-on-narrow />
```

- **分档按容器宽度**（不是视口宽度）：库根节点宽度 < 600 为窄档，< 1280 为中档，其余为宽档；用 `ResizeObserver` 量根节点，嵌在侧栏 / 弹窗 / 放大层里也按它自己的宽度判定。中档与宽档主要影响工具栏的排布（单行阈值约 1280）。
- **默认关闭**：不开 `card-on-narrow` 时，窄容器与宽容器是同一套表格与工具栏（窄容器下分页仍不画每页条数选择器）。
- **卡片列表**：第一个数据列作卡片标题，其余列是两列「标签：值」，操作列（`card: 'action'`，缺省取最后一个 `fixed: 'right'` 的列）放在卡片底部；列上写 `card: 'title' | 'meta' | 'action' | 'handle' | false` 可覆盖；列设置里隐藏的列卡片里同样隐藏。点卡片 = `@row-click`，勾选框在卡片右上角，宿主绑的 `checked-row-keys` / `expanded-row-keys` 照常生效。
- **触控尺寸**：工具栏按钮、输入框、分页项统一放大到 40px（官方 `large`）；窄档不画每页条数选择器，分页用官方 `simple`。
- **工具栏折叠**：业务按钮（`#toolbar-right` + 「更多」）收成「操作 ▾」，点开在原位多出一行。
- **搜索收成「输入框 + 筛选」**：用条件构造器（`search: { container: 'table' }`）时，窄档只留一个输入框和「筛选」按钮，点「筛选」从底部抽屉展开同一份多条件面板。
- **排序抽屉**：有可排序列时，工具栏最下面多一行「排序」按钮，点开底部抽屉，每列「无 / 升序 / 降序」（只能启停，不改优先级）。
- **底部面板**：可编辑表格（`editable`）在窄档点卡片 = 底部抽屉表单（整行即时保存，其中的 `select-table` 字段点开贴底选择面板）；`SmartSelectTable` 在视口 < 600 或放不下浮层时也改用底部面板。
- **行拖拽**：卡片保留拖拽，手柄列写 `card: 'handle'`，放在标题行最左；开了 `row-draggable` 的卡片在标题行末尾显示行号。
- **合计卡**：宿主给了 naive 的 `summary`（合计行）时，窄档卡片列表末尾多一张「合计」卡。
- **chips 与分页**：已生效条件 chips 在窄档单独占一行、放在分页上方。
- **没做的**：列头漏斗的窄档抽屉（卡片模式没有表头，漏斗没有入口；需要筛选请用条件构造器）；卡片列表不做虚拟滚动（窄档不能改每页条数，默认每页 100）。列设置在窄档仍是气泡，不是抽屉。

> 预览里 14 个模块的主表都带 `card-on-narrow`（窗口缩到 400 宽左右，或用浏览器的设备模拟 390 × 844）：模块 2 / 3 / 4 看条件搜索、筛选抽屉与排序抽屉，模块 10 看卡片里的拖拽手柄，模块 14 看卡片点开的底部抽屉表单。

## 安装

```bash
npm i smart-naive-table   # 3.0.0；仍要用 2.x 时装 smart-naive-table@2
```

项目中需已安装 `vue >= 3.3` 和 `naive-ui >= 2.44`（`peerDependencies` 是 `vue ^3.3.0`、`naive-ui ^2.44.0`；验证过的版本是 naive-ui 2.45.3）。ESM 输出，自带 TypeScript 类型。

## 快速开始

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
- **工具栏**：刷新（仅远程模式）、列设置

点击「查询」时，`fetcher` 收到的参数（空值已自动剔除）：

```js
{ page: 1, pageSize: 100, account: 'user01', status: 1 }
```

> **提示**：把 SmartTable 放在 `<n-config-provider>` 内，主题和语言都跟随它。组件自带文案默认是英文，中文项目请看 [全局配置与中文文案](#全局配置与中文文案)。更完整的演示见 [playground/DemoBasic.vue](./playground/DemoBasic.vue)；上面「截图」里各个表格的源码在 [playground/prototype/](./playground/prototype/)。

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
<SmartTable :search="{ container: 'table' }" />                  <!-- 模式 2：条件构造器（字段 + 比较符 + 值），并入表格卡片，产出走 filters -->
<SmartTable :search="false" />                                   <!-- 不显示搜索区 -->
```

模式 2「条件构造器」（`search: { container: 'table' }`）：搜索区并入表格卡片的一行「字段 + 比较符 + 值」，点「更多条件」（`»`）展开多条件面板；字段候选 = 声明了 `search` 的列（带 `search.render`、`type: 'switch'` 的列放不进一行，不进构造器），比较符取 `search.actions`，缺省取 `filter.actions`，再缺省取按类型的推荐集合（导出常量 `RECOMMENDED_ACTIONS`）。条件和列头漏斗共用同一份过滤态，请求里带的是 `filters`（经 `filterSerializer`），而不是扁平的搜索参数；默认开 `filter-chips`（可显式关掉）；容器宽 < 600 时收成「输入框 + 筛选」，点「筛选」从底部抽屉展开同一份条件面板。

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

点击工具栏最右侧的图标打开（效果见上面的[截图](#截图)），可以勾选显隐、拖拽排序、固定到左 / 右侧。

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

想让用户一眼看到当前生效的条件，加 `filter-chips`：表格下方、与分页同一行（左 chips、右分页；没有分页时在表格下方自成一行）多出已生效条件 chips，点 chip 重开该列面板、× 删掉这一条，放不下时折成「+N」；有列声明了 `defaultValue` 时，偏离默认才出现「恢复默认」，否则 ≥ 2 个 chip 时出现「清除全部」：

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
- **表格始终填满容器**:列宽之和小于容器时,富余宽度由**最后一个可见、非固定、可拖的列(吸收列)**吸收(表头里没有占位列),其余列仍是拖出来的精确宽度;加宽到超过容器则照常横向滚动。**吸收列没有拖拽把手(即使还没拖过列宽也没有)**:要调它的宽度,拖它左邻列的把手;给某列写 `resizable: false` 可让它不参与吸收(吸收列顺延到前一列)。想回到按容器自适应,点列设置里的「恢复默认」
- 拖不到 0 宽:可拖拽列自动补 `minWidth`:默认 60,带排序 / 过滤图标的列取 `max(60, 图标下限)`(仅排序 93、仅过滤 102、两者 123);列上写了 `minWidth` 以列上的为准
- 列设置里的「恢复默认」会把宽度一起还原

### 分页

默认是官方 `simple` 分页（页码输入框 / 总页数），每页 100 条；可选项没显式给 `pageSizes` 时按 `fill-height` 区分：不开是 `[100, 500, 1000]`，开了是 `[100, 1000, 10000]`（一页上万行只有虚拟滚动扛得住），显式给了就照你的、不分 `fill-height`：

- 每页条数选择器是嵌在分页 `suffix` 里的官方 `NPagination`，文案跟随 `<n-config-provider>` 的语言（「100 / 页」），不需要额外配置文案；`pageSizes` 里写 `{ label, value }` 对象会原样显示，当前每页条数不在选项里时自动并入
- 窄档（表格根节点宽度 < 600px）不画每页条数选择器，免得分页条折行
- 默认每页条数的解析优先级：实例 `default-page-size` > 实例 `pagination.pageSize` / `pagination.defaultPageSize` > 全局 `defaultPageSize` > 宿主（实例或全局）显式给的 `pageSizes` 的第一项 > 100
- 想回到页码序列：`:pagination="{ simple: false }"`（此时走官方 `showSizePicker` / `pageSizes`）；`simple` 下官方不渲染 `showQuickJumper` / `pageSlot`
- ⚠ 远程模式请求里的 `pageSize` 默认是 100：后端若限制了 `pageSize` 上限，请用 `default-page-size` 或 `pageSizes` 调回来
- 改每页条数后回到第 1 页（远程、静态数据模式都一样）
- 远程请求失败（翻页 / 改每页条数 / 搜索）时，页码和每页条数还原到表里实际展示的那一页，分页条不会停在没拿到数据的页上；`error` 事件照常触发
- 不开 `fill-height` 时，翻页 / 改每页条数后若卡片顶部已滚出视口，页面会自动滚回卡片顶部；开了 `fill-height` 则表体在卡片内滚动、翻页后表体回顶

### 更多场景

| 场景 | 写法 |
|---|---|
| 服务端排序 | 列上写 `sorter: true`，`fetcher` 会收到 `sortField` 和 `sortOrder`（`'asc'` / `'desc'`）；多列用官方 `sorter: { multiple: n }`（数值大者优先），`fetcher` 另收到 `sorts: [{ field, order }]`；列上的 `defaultSortOrder` 生效（带进首次请求） |
| 编程式排序 | `tableRef.sort(key, order)` / `tableRef.clearSorter()`（与官方 `DataTableInst` 同签名，远程模式回第 1 页重查） |
| 铺满父容器 | `fill-height`，父容器须定高（表体在卡片内滚动、分页条贴底、虚拟滚动）；不开时翻页自动回卡片顶部 |
| 外部条件联动 | `:params="{ deptId }"`，值变化后自动回到第 1 页重新查询（如左侧部门树） |
| 静态数据 | 传 `:data="list"`、不传 `fetcher`，前端分页；监听 `@search` 自行过滤 |
| 展开行 | 特殊列 `{ type: 'expand', renderExpand: (row) => ... }` |
| 窄档卡片（移动端） | `card-on-narrow`，见[移动端自适应](#移动端自适应) |
| 多选 | 特殊列 `{ type: 'selection' }` + `v-model:checked-row-keys` |
| 主从表高亮 | `:active-row-key="currentId"` + `@row-click` |
| 行拖拽排序 | `row-draggable` + `@row-drag-sort`，组件只调整顺序，保存由你调用接口 |
| 列宽拖拽 | 表格上写 `resizable`，或列上写 `resizable: true` |
| 表头过滤 | 列上写 `filter: true`；远程模式收到 `filters` 参数 |
| 已生效条件 chips | `filter-chips`（表格下方、与分页同一行，点击重开面板、× 删一条） |
| 批量栏 | 有 `{ type: 'selection' }` 列、绑了 `v-model:checked-row-keys`、写了 `#batch="{ checkedRowKeys, clear }"` 插槽，勾选后工具栏换成「本页全选 + 已选 N 项 + 你的按钮 + 取消选择」 |
| 放大 | `:toolbar="{ maximize: true }"`：表格在页面内铺满视口（不调用浏览器全屏 API，默认层级 1999，宿主顶栏更高时 `maximize: { zIndex }`；Esc 先收浮层、再还原；挂载后不要运行时切换这个开关） |
| 可编辑表格 | `editable` + `@save="({ changes, done, fail }) => ..."`。**一个布尔值就够用**：选中格再点 / Enter / F2 / 直接打字进入编辑，Enter / Tab / Shift+Enter 移动，Esc 放弃；改动留在草稿里（改过的格左上角小三角），工具栏出现「放弃修改」和「保存修改(N)」；新增行、删除所选（可恢复）也是待保存。控件按「列上写的 `editor` → `editorProps` 里有 `columns` + `data` / `fetcher`（外部 / 主数据）→ 下拉表格 → `options` / `format` → 数据值 → 输入框」自动推断（含数组值 + `options` → 多选；选项 > 8 个自动可搜索）；写了 `render` / `#cell-*` 的列不可编辑；`rules.required` 的列表头自动带红 `*`。Excel 粘贴 / 复制（Ctrl+V 多格块、Ctrl+C）、Ctrl+Z 撤销最近一次提交。保存前统一校验（含异步 `rules.validator`），第一个不合法的格被选中并滚进视口。行级只读：`editable: { rowReadonly: (row) => boolean }` 或列的 `readonly: (row, index) => boolean`。拖拽重排：序号列 `{ type: 'index' }` 自己跟着位置变、不产生脏标记（`@row-drag-sort` 里即时保存顺序，草稿按行主键跟着行走）；真要把排序号写进数据字段，用实例的 `setCell(rowKey, field, value)` 逐行改（走草稿，有脏标记、进 `@save`）。`editable: { save: 'cell' }` = 每提交一个格就立刻 `@save`（失败回滚该格）。翻页 / 搜索 / 排序不拦截，草稿跨页保留；有未保存修改时离开页面有浏览器提示，宿主路由守卫用实例的 `isDirty`。窄档（`card-on-narrow`）点卡片开底部抽屉表单、整行即时保存。**默认关，不开时行为完全不变**；必须监听 `@save`（宿主提交后调 `done()`，失败 `fail()` 保留草稿） |
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

### 可编辑表格

```vue
<SmartTable
  ref="tableRef"
  :columns="columns"
  :fetcher="fetcher"
  row-key="id"
  :editable="{ rowReadonly: (r: Row) => r.status === '停用', newRow: () => ({ status: '启用' }) }"
  @save="onSave"
/>
```

```ts
import type { EditSavePayload, SmartTableColumn } from 'smart-naive-table'

// Row = 表格行类型；Op = 工序库（主数据）的行类型
const columns: SmartTableColumn<Row>[] = [
  { type: 'selection', width: 40 },
  { key: 'rd', title: '', width: 48, card: 'handle', render: handleCell },   // 拖拽手柄(row-draggable + drag-handle)
  { type: 'index', title: '工序号', width: 80 },                           // 序号列:位置,不是数据、不可编辑、拖动后自己跟着变;声明在手柄后就排在手柄后
  { key: 'name', title: '工序名称', rules: { required: true },             // 表头自动带红 *
    // 外部 / 主数据 → select-table:点开是「搜索框 + 带分页的表」;fill 把选中行的其它字段一并填进本行(普通草稿编辑:各自脏标记、一步撤销)
    editorProps: { columns: opCols, data: opLibrary, valueKey: 'code', labelKey: 'name',
      fill: (op: Op) => ({ center: op.center, setup: op.setup }) } },
  { key: 'center', title: '工作中心', options: centers },                 // 下拉(> 8 项自动可搜索)
  { key: 'setup', title: '准备工时(分)', rules: { int: true, min: 0,
      // 跨行校验:第三个参数是表里当前所有行(含草稿)。validator 也可以返回 Promise(异步查重)
      validator: (v, row, rows) => true } },                               // 数据值 number → 数字框
  { key: 'report', title: '报工' },                                        // 数据值 boolean → 复选框
  { key: 'status', title: '状态', options: statuses, readonly: false },   // readonly: false = 不受 rowReadonly 影响(停用的行仍能改状态)
]

async function onSave({ changes, done, fail }: EditSavePayload<Row>) {
  try {
    // changes.rows:每项 { type: 'created' | 'updated' | 'deleted', row, changes? },updated 只含改过的字段
    await api.save(changes.rows)
    done() // 清草稿,远程模式自动刷新当前页;本地数据请先自己更新 data 再 done()
  } catch (e) {
    fail(e) // 保留草稿,不丢数据(同时触发 @error)
  }
}
```

- **推断**：`editor`（显式）→ `readonly` / `editor: false` → 有 `render` / `#cell-*` → 不可编辑 → `editorProps` 里有 `columns` 且有 `data` 或 `fetcher` → **`select-table`**（外部 / 主数据：下拉里是一张带搜索 + 分页的表，见下面的 `SmartSelectTable`）→ `options`（下拉；值是数组 = 多选）→ `format: 'date' | 'datetime' | 'money'` → 数据值（前 20 行第一个非空值：boolean / number / 日期串 / 含换行或超过 30 字 → 多行 / 其余 → 输入框）→ 输入框。`inferEditor(column, rows)` 是公开的纯函数。
- **键盘与剪贴板**：↑ ↓ ← → / Tab / Shift+Tab 移动（只读列跳过；锁定的格可选中、可复制，只是不能编辑）；Enter / F2 进入编辑；直接打字替换原值；Space 切复选框；Delete 清空（必填列拒绝）；编辑中 Enter 提交下移、Shift+Enter 提交上移、Esc 放弃；Ctrl+C 复制选中格；Ctrl+V 粘贴 Excel 的单格或多格块（制表符分列、换行分行），从选中格起向右向下依次填充，按各列类型转换（数字去千分位、布尔认 TRUE / 是、选项按标签或值、日期补零）并校验，**任何一格不合法则整块不应用**；只读 / 锁定 / 待删的格跳过，超出当前列表的行忽略（不自动追加新行）；Ctrl+Z 撤销最近一次提交（栈 50，一次粘贴 = 一步，保存 / 放弃后清空，`save: 'cell'` 下不可用）。
- **保存**：保存前统一校验（草稿格的同步规则 + 新增行全部格 + 异步校验的结果），不通过就不发 `@save`、选中第一个不合法的格并发 `@invalid`。异步 `rules.validator`：提交后单元格显示加载态、结果落定为不通过则标红（悬停看原因）、过期结果丢弃，「保存」会等它。
- **翻页 / 搜索 / 排序**：不拦截；草稿叠在数据上，翻页 / 重新请求都保留（被筛选条件挡住的已改行看不见，但仍计入 N、仍会被保存）。**离开页面**：有未保存修改时注册 `beforeunload` 提示（`editable: { beforeunload: false }` 可关）；宿主的路由守卫用实例的 `isDirty` / `dirtyCount`，再配合 `save()` / `discard()`。
- **fillHeight / 虚拟滚动**：可用。草稿在仓库里不在 DOM 里，编辑中的格滚出窗口再滚回来内容还在；方向键 / Tab 走到还没渲染的行会自动滚进视口。
- **下拉表格（`select-table`）**：外部 / 主数据（几十行以上、或来自接口）用它，小的静态枚举仍用 `options`（> 8 项自动可搜索）。`editorProps: { columns, data | fetcher, valueKey?, labelKey?, searchKeys?, fill? }`，单元格的值 = 选中行的 `labelKey` 字段（缺省 = 本列 key）；`fill(picked, row)` 返回 `{ 其它列 key: 值 }`，随选中一并写入（普通草稿编辑：各自脏标记、一次 Ctrl+Z 全部撤销、同样校验，任何一格不合法则整次不应用并标红）。粘贴的文本在有本地 `data` 时必须是已有的名称或 `valueKey` 编码（命中同样 `fill`），只给 `fetcher` 时照收文本。单元格内只支持单选（小枚举的多选用 `multiselect`）；窄档抽屉里它是一个触发框，点开贴底选择面板。
- **新增行**：默认放第 1 行；`editable: { add: { position: 'bottom' } }` 追加到列表末尾（有顺序的数据，如工艺路线）。新增后自动进入编辑的是第一个「必填且为空」的格。`add: false` 隐藏工具栏按钮。
- **行级只读**：`rowReadonly` 锁住的行里，列上写 `readonly: false` 的格不受影响（如「状态」，否则停用的行没法再启用）；窄档抽屉里被锁的字段置灰，标签列宽用 `editable: { labelWidth }`（缺省 72px）调。
- **序号列与拖拽**：`{ type: 'index' }` 声明在某个数据列（如拖拽手柄列）之后时，就排在那一列后面；窄档 + `row-draggable` 的卡片会在标题行末尾显示行号（同「行拖拽排序」示例）。窄档卡片列表末尾，宿主给了 naive 的 `summary`（合计行）时多一张「合计」卡。
- **不做**：填充柄、区域选择、合并单元格 / 公式、查找替换、右键菜单、跨结构变更的撤销、粘贴追加新行、复制行。

### 下拉表格选择 SmartSelectTable

独立组件（不依赖可编辑表格），用法像 `NSelect`：触发器点开是浮层（窄屏 = 底部抽屉），里面一个搜索框 + 嵌套的 `SmartTable`（分页、虚拟滚动、表头吸顶）。选物料、选工序、选客户这类「列表很长、要看多列才认得出」的场景都用它；可编辑表格的 `select-table` 编辑器就是它的一层薄封装。

```vue
<SmartSelectTable
  v-model:value="materialId"
  :columns="[{ key: 'code', title: '物料编号' }, { key: 'name', title: '物料名称' }, { key: 'spec', title: '规格' }]"
  :data="materials"
  label-key="name"
  clearable
/>
<!-- 远程 + 多选:fetcher({ page, pageSize, keyword }) → { items, total };v-model 是 valueKey 的数组 -->
<SmartSelectTable v-model:value="ids" multiple :columns="cols" :fetcher="fetchMaterials" @pick="(rows) => ..." />
```

- **属性**：`columns`（SmartTable 的列）· `data`（本地）/ `fetcher`（远程，同 `SmartTableFetcher`，多一个原样的 `keyword`）· `valueKey`（默认 `'id'`，`v-model:value` 的值）· `labelKey`（触发器显示，默认第一列）· `renderLabel(row)` · `multiple`（值是数组；面板带勾选列与「已选 N 项 / 清空 / 确定」，跨页跨搜索保留）· `maxTagCount`（默认 2，其余 +N）· `placeholder` / `clearable` / `disabled` / `size` / `title`（窄屏面板标题）· `panelWidth`（默认 640，受视口限制）· `pageSize`（默认 100）/ `pageSizes`（不传 = 库内置 `[100, 1000, 10000]`）· `searchKeys` / `searchPlaceholder` · `label`（远程且有初始值时触发器显示的文字）· `labels`。事件：`update:value`、`pick`（单选 = 行，多选 = 点「确定」时的行数组）、`close`（面板关闭）。实例：`open()` / `close()` / `focus()`。
- **搜索**：面板顶部只有一个搜索框（自动聚焦、带放大镜与清除 ×），占位符由搜索列的标题自动拼（如「物料编号/物料名称/规格」）。本地 `data` 实时模糊过滤（大于 2000 行防抖 120ms）：忽略大小写与全半角，空白切词、所有词都要命中，每个词可命中任一搜索字段（默认 = 有 key、不是序号 / 勾选、没有自定义 `render` 的列，`searchKeys` 可限定），不做拼音；远程 `fetcher` 回车或停手 300ms 后请求。改搜索词回第 1 页、表体回顶部。
- **键盘**：Esc 先清空搜索再关闭；↓ ↑ 在行间移动高亮（滚进视口，虚拟列表里没渲染的行也行）；Enter 选中高亮行（搜索框里只剩一行时直接选它；多选 = 确定）；多选下 Space 勾选高亮行。再次打开时已选行高亮并滚进视口（本地数据会翻到它所在的页）。
- **已知限制**：可编辑表格的单元格里只支持单选；还没接进 `SearchForm`（搜索表单里的下拉表格字段另行规划）。

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
    pageSizes: [50, 100, 500], // 显式给了就不再按 fill-height 区分
  }),
)

app.mount('#app')
```

也可以只给某张表：`<SmartTable :labels="zhCNLabels" />`。labels 里的键全部可选，缺的键取英文默认。

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

## API 速查

### 列配置

数据列支持 Naive UI 列的全部属性（`width`、`minWidth`、`fixed`、`align`、`ellipsis`、`sorter`、`resizable` 等），另外增加：

> `filter` 由本包接管（比 Naive 原生列过滤多了条件面板与远程联动），因此不透传 Naive 的 `filter` / `filterOptions` 等原生过滤属性。

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
| `card` | `'title' \| 'meta' \| 'action' \| 'handle' \| false` | 窄档卡片（`card-on-narrow`）里这一列放哪：`title` 标题（缺省 = 第一个数据列）、`meta`「标签：值」两列（缺省）、`action` 底部操作行（缺省 = 最后一个 `fixed: 'right'` 的列）、`handle` 拖拽手柄（`row-draggable` 时在标题行最左）、`false` 不出现。列设置里隐藏的列卡片里同样隐藏 |
| `hideInSetting` | `boolean` | 显示在表格中，但不出现在列设置里（常用于操作列） |
| `editor` | `'input' \| 'textarea' \| 'number' \| 'select' \| 'multiselect' \| 'select-table' \| 'date' \| 'datetime' \| 'checkbox' \| false` | 可编辑表格（`editable`）里这一列的编辑控件，优先级最高；`false` = 不可编辑。缺省按 `options` / `format` / 数据值推断（见 `inferEditor`）；写了 `render` 或 `#cell-*` 的列没有显式 `editor` 时不可编辑 |
| `readonly` | `boolean \| (row, index) => boolean` | 可编辑表格里只读（纯展示、次要文字色）；函数形式按行锁定（如已审核的行）：锁定的格可选中 / 复制、不能编辑，粘贴跳过；写 `false` = 不受 `editable.rowReadonly` 影响（如「状态」列） |
| `rules` | `{ required?, min?, max?, int?, minLength?, maxLength?, pattern?, validator?(value, row, rows) }` | 可编辑表格的校验规则，不合法红框 + 提示、不允许提交；文案走 `labels`；`validator` 同步返回 `true` / 提示串，或返回 Promise（异步）；第三个参数是表里当前所有行（含草稿），可做跨行 / 跨字段校验；`required` 的列表头自动带红 `*` |
| `editorProps` | `Record<string, unknown>` | 透传给编辑控件（`NInput` / `NInputNumber` / `NSelect` / `NDatePicker`）的官方属性；`select-table`（显式或有 `columns` + `data` / `fetcher` 时自动推断）时是 `{ columns, data \| fetcher, valueKey?, labelKey?, searchKeys?, searchPlaceholder?, panelWidth?, pageSize?, pageSizes?, title?, fill? }` |
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

- **FilterAction**（15 个）：`'equal'`（等于）、`'notEqual'`、`'contains'`（包含）、`'notContains'`、`'gt'`（大于）、`'gte'`、`'lt'`（小于）、`'lte'`，以及 `'isNull'` / `'isNotNull'`（为空 / 不为空，不需要值）、`'like'`（SQL `LIKE`：`%` 任意长度、`_` 单个字符，整串匹配、忽略大小写）、`'startsWith'` / `'endsWith'`（忽略大小写）、`'in'` / `'notIn'`（值是数组）。**列头面板的默认可选操作符仍是前 8 个，其余需在列上 `filter.actions` 显式开启**；未知操作符一律按不匹配处理
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
| `filter-chips` | `boolean` | `false` | 在表格下方、与分页同一行显示已生效条件 chips（没有分页时自成一行；窄档单独一行放在分页上方） |
| `toolbar` | `false \| { refresh, density, columnSettings, more, maximize }` | 刷新（仅远程）、列设置；`density` / `maximize` 默认 `false` | 工具栏按钮开关；`more` 是「更多」菜单的选项（官方 `NDropdown` 的 `options`），选中发 `more-select`；`maximize: true` 或 `{ zIndex }` 打开「放大」（页面内铺满视口，层级默认 1999） |
| `title` | `string` | — | 表格标题，也可用 `#title` 插槽 |
| `card-props` | `Partial<CardProps>` | — | 库渲染的卡片（表格卡片、搜索卡片）的官方 `NCard` 属性，合并在默认 `size="small"` + 四边 16px 内边距之后；想用 Naive 默认的卡片内边距可传 `{ size: 'medium' }` |
| `card-on-narrow` | `boolean` | `false` | 窄档卡片模式：容器宽 < 600 时表格换成卡片列表（列映射见列的 `card`；点卡片 = `@row-click`，勾选框在右上角，宿主绑的 `checked-row-keys` / `expanded-row-keys` 照常生效）、业务按钮折叠成「操作 ▾」（点开原位展开一行）、工具栏控件放大到触控尺寸；分页仍是官方 `simple` 分页（项 40px，不画每页条数）。有可排序列时工具栏最下面多一行「排序」按钮（点开底部抽屉，每列「无 / 升序 / 降序」，只能启停、不改优先级）；窄档下列头**筛选**暂无入口，请用 `search: { container: 'table' }`。不开则窄容器与宽容器是同一套表格与工具栏。卡片列表不做虚拟滚动（窄档不能改每页条数，默认每页 100） |
| `editable` | `boolean \| { rowReadonly?, newRow?, add?, remove?, save?, beforeunload?, labelWidth? }` | `false` | 可编辑表格，见「更多场景」与下面的「可编辑表格」小节。`rowReadonly(row)`：整行锁定；`newRow()`：新增行的初值；`add`：`false` 关掉工具栏「新增行」、`{ position: 'bottom' }` 追加到末尾；`remove`：关掉批量栏「删除所选」；`labelWidth`：窄档抽屉的标签列宽（缺省 72）；`save`：`'batch'`（默认）/ `'cell'`（即时保存）；`beforeunload: false`：不要离开页面提示 |
| `fill-height` | `boolean` | `false` | 铺满父容器：表体在卡片内滚动（官方 `flex-height` + 虚拟滚动）、分页条贴底；**父容器须定高**；开启时忽略 `max-height` |
| `storage-key` | `string` | — | 设置后,列设置(显隐 / 顺序 / 固定 / 列宽)保存到 localStorage;**密度只在开了 `toolbar: { density: true }`(密度按钮)时才读写存储**,否则以 `default-density` 为准 |
| `default-density` | `'comfortable' \| 'compact'` | `'compact'` | 默认密度（响应式：宿主改了它，已挂载的表格跟着变） |
| `labels` | `Partial<SmartTableLabels>` | 英文 | 覆盖组件文案，传 `computed` 可随语言切换 |
| `active-row-key` | `string \| number \| null` | — | 高亮对应的行（默认当前主题主色 9%，全局 `activeRowBg` 可改） |
| `row-draggable` | `boolean` | `false` | 开启行拖拽排序 |
| `resizable` | `boolean` | `false` | 所有数据列可拖拽调整列宽；列上的 `resizable` 优先 |
| `filter-serializer` | `(state) => object` | 见「表头过滤」 | 过滤态 → 请求参数的序列化 |
| `drag-handle` | `string` | — | 拖拽手柄的 CSS 选择器，不传则整行可拖 |

其它未列出的属性（如 `striped`、`max-height`、`checked-row-keys`、`virtual-scroll`）会原样传给 `n-data-table`。

**SearchFormConfig**（`search` 属性的对象形式）：

| 字段 | 默认值 | 说明 |
|---|---|---|
| `container` | `'card'` | `'card'` 独立搜索卡片（模式 1）；`'table'` 条件构造器并入表格卡片（模式 2，产出走 `filters`，默认开 chips，窄档收成「输入框 + 筛选」抽屉）；`'none'` = `layout: 'inline'`。优先于 `layout` |
| `layout` | `'grid'` | `'grid'` 卡片网格；`'inline'` 无卡片单行排列（等价于 `container: 'none'`，见 `container`） |
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
| `row-click` | `row, index` | 点击行；点到行内的按钮 / 勾选框 / 单选框 / 开关 / 链接 / 输入框 / 下拉等交互控件不触发（`row-props` 里自己的 `onClick` 不受影响） |
| `row-drag-sort` | `{ from, to, reordered }` | 行拖拽结束 |
| `cell-change` | `{ row, key, value, oldValue }` | 可编辑表格：草稿变化（改了一个格），`row` 已带上这次改动 |
| `save` | `{ changes: { updated, added, removed, rows }, done, fail }` | 可编辑表格：点「保存修改」（或 `save()`）。`changes.rows` 把三类拍平成每项带 `type`（`created` / `updated` / `deleted`）；宿主提交后调 `done()` 清草稿（远程自动刷新）/ `fail(e?)` 保留草稿（`save: 'cell'` 下失败回滚该格）；窄档抽屉的整行保存同样走它 |
| `discard` | — | 可编辑表格：点「放弃修改」 |
| `invalid` | `{ row, key, message }` | 可编辑表格：保存时发现某格不合法（已选中并标红），可据此弹提示 |
| `filter-change` | `key, value, state` | 表头过滤变化（`clearFilters`、模式 2 的批量提交时 `key` 为空串，且一次批量只触发一次） |
| `column-resize` | `key, width` | 拖拽列宽（拖动过程中持续触发） |
| `more-select` | `key, option` | 工具栏「更多」菜单（`toolbar.more`）选中某项 |

### 插槽

| 插槽 | 参数 | 说明 |
|---|---|---|
| `title` | — | 表格标题 |
| `toolbar` | — | 工具栏左侧，适合放新增、批量操作按钮 |
| `toolbar-right` | — | 工具栏右侧，位于内置按钮之前 |
| `batch` | `{ checkedRowKeys, clear }` | 批量栏：有勾选列且勾选了行时替换工具栏（本页全选复选框 + 「已选 N 项」+ 本插槽内容 + 取消选择） |
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
| `dirtyCount` / `isDirty` | 可编辑表格：未保存的改动数（改过的格 + 新增行 + 待删行）/ 有没有未保存的改动 |
| `revealRow(index)` / `goPage(page)` | `fillHeight` 虚拟滚动下把当前页第 `index` 行（0 起）滚进视口 / 跳到第 `page` 页 |
| `setCell(rowKey, field, value)` | 可编辑表格：程序化改一格（如把排序号写进数据字段）：走草稿，有脏标记、进 `@save`，不做校验（保存时统一校验） |
| `getChanges()` | 可编辑表格：当前全部改动（与 `@save` 载荷里的 `changes` 同形） |
| `save()` / `discard()` | 可编辑表格：校验并触发 `@save` / 放弃全部改动 |

### 全局默认字段

通过 `createSmartTableDefaults({...})` 设置，均为可选：

| 字段 | 内置默认 | 说明 |
|---|---|---|
| `labels` | 英文 | 组件文案，可传 `ref` / `computed` |
| `align` / `titleAlign` | `'center'` | 单元格 / 表头对齐方式 |
| `emptyText` | `'—'` | 空值占位符 |
| `defaultPageSize` | — | 默认每页条数；不给时取显式给的 `pageSizes` 的第一项，再缺省 100 |
| `pageSizes` | 不开 `fill-height` `[100, 500, 1000]`；开了 `[100, 1000, 10000]` | 每页条数选项；显式给了就照这里的，不分 `fill-height`（实例 `pagination.pageSizes` 优先） |
| `showSizePicker` | `true` | 是否显示每页条数选择器 |
| `density` | `'compact'` | 默认密度 |
| `dateValueFormat` | `'yyyy-MM-dd'` | 日期搜索项的值格式 |
| `searchCols` | `'1 s:2 m:3 l:4'` | 搜索区网格列数 |
| `fixedFallbackWidth` | `120` | 固定列未写宽度时的兜底宽度 |
| `indexWidth` | `64` | 序号列宽度 |
| `tag` | `{ size: 'small', bordered: false }` | `tag: true` 列的标签样式 |
| `activeRowBg` | 当前主题主色 9%（明 / 暗跟随主题） | 高亮行的背景色 |
| `resizable` | `false` | 所有表格默认开启列宽拖拽 |
| `filterable` | `true` | 是否允许列声明表头过滤；`false` 全局关掉 |
| `resizeMinWidth` | `60` | 可拖拽列的最小宽度（带排序 / 过滤图标的列取它与图标下限的较大者） |
| `filterSerializer` | 见「表头过滤」 | 过滤态 → 请求参数 |

### 其它导出

`src/index.ts` 的全部导出：

- **组件**：`SmartTable`、`SmartSelectTable`
- **组合式**：`useSmartTable(fetcher, options)`（组件内部使用的数据核心：加载、分页、搜索、防竞态，不依赖 UI，可自己搭界面）、`useTableCrud`、`useOptions`（以及 `findOption`、`optionLabel`）、`useFilters`、`useSmartTableDefaults`
- **全局配置**：`SMART_TABLE_DEFAULTS`、`createSmartTableDefaults`
- **文案与格式化**：`defaultLabels`、`zhCNLabels`、`mergeLabels`、`formatDate`、`formatDatetime`、`formatMoney`、`applyFormat`
- **过滤内核**（与 UI 无关，后端 mock 或自建界面可直接复用）：`matchCondition`、`matchFilterValue`、`applyFilters`、`isFilterActive`、`activeConditions`、`defaultFilterSerializer`、`optionsToFilterValue`、`filterValueToOptions`、`isOptionsRepresentable`、`NO_VALUE_ACTIONS`、`isValuelessAction`、`actionValueKind`、`RECOMMENDED_ACTIONS`、`deriveFilterDefs`、`deriveInitFilters`、`filterOptionsKey`
- **可编辑表格内核**：`inferEditor`、`inferEditorInfo`、`validateEdit`、`validateEditAsync`、`createEditStore`
- **其它工具**：`cleanParams`、`matchKeyword`（`SmartSelectTable` 的本地搜索匹配）、`loadState` / `saveState` / `clearState` / `mergeCols`（列设置的 localStorage 读写）
- **类型**：`SmartTableColumn`、`SmartTableDataColumn`、`SmartTableFetcher`、`SmartTableInst`、`SmartTableProps`、`SmartTableOption`、`SmartTableLabels`、`SearchConfig`、`FilterConfig`、`FilterValue`、`EditableConfig`、`SmartSelectTableProps` 等

### labels 文案键

`labels` 的键全部可选，缺的键取英文默认（`defaultLabels`），中文用 `zhCNLabels`。按用途分组：

| 用途 | 键 |
|---|---|
| 搜索 / 工具栏 | `search`、`reset`、`refresh`、`density`、`densityComfortable`、`densityCompact`、`columnSettings`、`columnSettingsReset`、`fixedLeft`、`fixedRight`、`fixedNone`、`expand`、`collapse`、`more`、`maximize`、`restore` |
| 表头过滤 | `filter`、`filterConfirm`、`filterReset`、`filterSelectAll`、各操作符文案（`filterEqual`、`filterContains`、`filterGt`、`filterLike`、`filterIn` 等）、`filterNoValue`、`filterAddCondition`、`filterRemoveCondition`、`filterLogicAnd`、`filterLogicOr`、`filterAdvanced`、`filterSimple`、`filterClearAll`、`filterRestoreDefault`、`filterActiveCount` |
| 条件构造器 | `searchBy`、`searchMoreConditions`、`searchConditionN` |
| 批量栏 | `selectedCount`（含 `{n}`）、`clearSelection` |
| 窄档 | `operations`、`sort`、`sortNone`、`sortAscend`、`sortDescend` |
| 可编辑表格 | `editSave`（含 `{n}`）、`editDiscard`、`editAddRow`、`editDeleteSelected`、`editNewTitle`、`editEditTitle` 等（完整列表见 `SmartTableLabels`） |
| 下拉表格选择 | `pickTotal`、`pickSelected`、`pickClearSel`、`pickOk` |

## 行为说明

- 请求前自动清洗搜索参数：字符串去掉首尾空格；空串、`null`、`undefined`、空数组不传；`0` 和 `false` 保留
- 快速翻页时，先发出、后返回的旧响应会被丢弃，不会覆盖新数据
- 重置时搜索项恢复为 `defaultValue`，没有则为 `null`
- 固定列未写 `width` 时自动补上宽度（`minWidth` 或 120），避免 Naive 固定列错位
- `scroll-x` 默认等于可见列的宽度之和（含拖拽后的宽度），手动传入则以你的为准
- 过滤条件变化后回到第 1 页：远程模式重新请求，静态模式在前端过滤
- 过滤值为空（`null` / `''` / `[]`）的条件会被忽略，不会传给后端（`isNull` / `isNotNull` 不需要值，照常传）；`0` 和 `false` 保留
- 过滤值是纯日期串（`YYYY-MM-DD`）时按「整天」比较，`等于 2024-03-05` 能命中当天任意时刻
- 列宽写入 localStorage 做了防抖;存储结构版本为 `v2`;存储里的密度**只在开了密度按钮(`toolbar: { density: true }`)时生效**,否则以 `default-density` 为准
- 列设置至少保留一列：只剩一列可见时，它的勾选框禁用
## 浏览器与版本支持

| 项 | 说明 |
|---|---|
| Vue | `>= 3.3`（`peerDependencies: ^3.3.0`；本仓库开发环境 3.5） |
| Naive UI | `>= 2.44`（`peerDependencies: ^2.44.0`）。**单测与浏览器验证在 2.45.3 上做**，2.44.0 ~ 2.45.2 之间的版本没有单独测，建议锁定验证过的版本 |
| 模块格式 | 仅 ESM（`exports` 只有 `import`），自带类型声明 |
| 浏览器 | **只在 Chromium 内核（Chrome / Edge）上验证过**，包括 390 × 844 的窄档（触屏用 CDP 设备模拟）。Firefox / Safari、真实手指触屏、屏幕阅读器**没有测过** |
| Node（开发 / CI） | 24 |

## 里程碑

这一节是**版本路线图与当前进度**，不是变更日志；逐项变更见 [CHANGELOG.md](./CHANGELOG.md)，升级步骤见 [MIGRATION.md](./MIGRATION.md)。

**当前阶段：`3.0.0`（npm `latest`）。** 3.0 是 major 升级，升级步骤见 [MIGRATION.md](./MIGRATION.md)。下面「已知未完成 / 限制」是 3.0.0 里仍没做的部分，之后的版本再补。

**3.0 已具备的能力范围**（对应 [规格](./docs/smart-naive-table-spec.md) 的 P0 / P1 / P2）：

- **P0 基础**：默认值与外观调整（默认每页 100、默认紧凑密度、官方 `simple` 分页等）、多列排序与 `sort()` / `clearSorter()`、15 个过滤操作符、已生效条件 chips、`toolbar.more`、`fill-height`、`zhCNLabels`、`cardProps`、全局 `defaultPageSize`。
- **P1**：条件构造器（`search.container: 'table'`）、批量栏 `#batch`、页面内放大 `toolbar.maximize`。
- **P2**：窄档卡片列表 `card-on-narrow` 与排序抽屉。
- **在 P0–P2 之外**：可编辑表格 `editable`、`select-table` 编辑器与 `SmartSelectTable`。这一块的设计状态在设计稿里仍标「提议」（待拍板的问题见设计稿「可编辑表格」一节），库里已有实现。
- **组件预览**：14 个模块（`/prototype.html`）用真实库复刻设计稿，与设计稿用 `tools/parity` 逐项读数对照。

**已知未完成 / 限制**（均可在仓库里核实）：

| 项 | 现状 | 出处 |
|---|---|---|
| 窄档列头筛选抽屉 | 未做：卡片模式下列头漏斗没有入口，窄档筛选请用条件构造器（`search: { container: 'table' }`） | 规格 §5.8、CHANGELOG `3.0.0` |
| 可编辑表格里的 `select-table` | 单元格内只支持单选（多选小枚举用 `multiselect`） | `src/types.ts` 的 `SelectTableProps` |
| `SmartSelectTable` 远程数据 | 再次打开时不会翻到已选行所在的页（本地 `data` 会） | `src/SmartSelectTable.vue` 的 `activeIndex` 只在本地数据时计算 |
| `SmartSelectTable` 进搜索表单 | 还没接进 `SearchForm`，搜索表单里的下拉表格字段另行规划 | 本文「下拉表格选择」一节 |
| 可编辑表格保存校验 | 定位并选中第一个不合法的格，但只在当前页内定位；不合法的格在别的页时只发 `@invalid`，不会自动翻页 | `src/useEditable.ts` 的 `firstInvalid` / `save` |
| 行拖拽 | 组件自带的拖拽没有键盘操作；远程分页下拖拽排序不跨页 | 设计稿 §12.6（预览模块 10 的 ↑ ↓ 是宿主自己写的） |
| 浏览器验证范围 | 只测了 Chromium；Firefox / Safari、真实触屏、屏幕阅读器未测 | 规格 §9、设计稿 §9.5 |
| 宿主后端 | 默认 `pageSize` 是 100，后端是否接受只能由各宿主自己确认 | 规格 §9 |

## 文档索引

| 文档 | 内容 |
|---|---|
| [docs/smart-naive-table-design.html](./docs/smart-naive-table-design.html) | 设计原型：离线单文件，14 个模块、明暗两套、宽 / 中 / 窄三档，是「看」的依据 |
| [docs/smart-naive-table-design.md](./docs/smart-naive-table-design.md) | 设计方案：每条决定的结论、理由、代价，以及 2.1.1 → 3.0.0 的变更总览 |
| [docs/smart-naive-table-spec.md](./docs/smart-naive-table-spec.md) | 3.0.0 现状规格：API、默认值、落地要求、验证状态与未验证清单 |
| [CHANGELOG.md](./CHANGELOG.md) | 按版本的逐项变更 |
| [MIGRATION.md](./MIGRATION.md) | 2.x → 3.0.0 升级指南（破坏性变更、回退方式、升级前检查清单） |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | 分支规则与提交 PR 前的检查 |
| [docs/baseline/](./docs/baseline/README.md) | 设计原型的截图基线：14 个模块 × 明 / 暗 × 1440 / 390 两种视口，共 56 张（不随包发布） |
| [tools/parity](./tools/parity/README.md) | 原型与组件预览的并排读数对照脚本；README 配图的拍摄脚本 `readme-shots.mjs` 也在这里 |
| [docs/spike](./docs/spike/README.md) | 真实 naive-ui 上的验证代码（一次性，不随包发布） |
| `playground/` | 组件预览（`/prototype.html`，源码 `playground/prototype/`）与功能演示（`/playground.html`） |

## 本地开发

```bash
npm install
npm run dev        # 启动开发服务器：/prototype.html 是与设计方案对齐的组件预览（本页截图来自它），/playground.html 是功能演示
npm test           # 单元测试
npm run typecheck  # 类型检查
npm run build      # 构建到 dist/
```

**分支与发布**：日常开发在 `dev` 分支，通过 PR 合并到 `main`。发布新版本时，先在 `dev` 上执行 `npm version patch --no-git-tag-version`（或 `minor` / `major`）并更新 [CHANGELOG](./CHANGELOG.md)，合并到 `main` 后会自动发布到 npm 并创建 GitHub Release。

## License

[Apache-2.0](./LICENSE)
