# 从 2.x 升级到 3.0.0

3.0.0 是一次 **major** 升级。下面列出的变更，**不改任何代码、升级后也会生效**。大多数都能用一行属性回到旧行为。

- 每条变更的细节：[`CHANGELOG.md`](./CHANGELOG.md)
- 设计侧的变更总表：[`docs/smart-naive-table-design.md`](./docs/smart-naive-table-design.md)「2.1.1 → 3.0.0 变更总览」，两处冲突时以它为准

## 1. 升级前先查这几件事

1. **后端是否支持 `pageSize = 100`（以及 500、1000、10000）**：默认每页条数从 10 变成 100。用户还能在下拉里选更大的值：没开 `fillHeight` 的表格是 500 / 1000，开了的是 1000 / 10000。远程模式下，请求里的 `pageSize` 就是这些值；后端如果限制了上限（比如 ≤ 50），会直接拒绝请求。不支持的话，先按第 2 节把默认值改回去。
   - 10000 这一档只给开了 `fillHeight`（虚拟滚动）的表格，因为不开时实测：一页 10000 行要卡 9 秒以上、内存 1.3GB。
   - 如果你用全局 `pageSizes` 自己加了大档位，请给对应的表格开 `fillHeight`。
2. **代码里有没有写 `defaultSortOrder`**：这个属性在 2.x 里其实从未生效（缺陷 C2）。3.0 修好之后，首次请求会带上排序参数，箭头也会回显。请确认这是你想要的。
3. **TypeScript**：如果你对 `FilterAction` 做了穷尽处理（`Record<FilterAction, …>`，或带 `never` 兜底的 `switch`），`vue-tsc` 会报错——它从 8 个成员扩到了 15 个，补上新成员即可。如果你手写了 `SmartTableInst` 的实现或 mock，需要补上 `sort` / `clearSorter`。
4. **直接调用 `loadState(storageKey)` 的**：存储里缺 `density` 字段时，返回值从 `'comfortable'` 变成了 `'compact'`。要保持旧值，请传第二个参数：`loadState(key, 'comfortable')`。
5. **自定义 CSS**：如果覆盖过表头、漏斗按钮、列宽拖拽把手（`.n-data-table-resize-button`）或卡片内边距，请逐项重新核对，这几处的 DOM 和样式都变了。
6. **naive-ui 版本**：验证环境是 naive-ui 2.45.3。`peerDependencies` 提到 `^2.44.0`（低于 2.44 的版本不再支持），2.44.0 ~ 2.45.2 之间的版本没有单独测过，建议锁定到验证过的版本。

## 2. 尽量保持 2.1.1 的样子

**全局**：在入口文件里写一次，所有表格都生效。

```ts
// main.ts
import { SMART_TABLE_DEFAULTS, createSmartTableDefaults } from 'smart-naive-table'

app.provide(
  SMART_TABLE_DEFAULTS,
  createSmartTableDefaults({
    defaultPageSize: 10,     // B1:每页 10 条
    pageSizes: [10, 20, 50], // B1:可选项
    density: 'comfortable',  // B2:舒适密度
  }),
)
```

**单个表格**：`toolbar`、`pagination`、`cardProps` 没有全局配置，需要逐个表格写。

```vue
<!-- B3 找回密度按钮;B4 页码序列分页;B11 卡片内边距回到 20 / 24 / 20 -->
<SmartTable
  :toolbar="{ density: true }"
  :pagination="{ simple: false }"
  :card-props="{ size: 'medium' }"
/>
```

下表里「回退方式」写「无」的，没有开关可以回到旧行为。

## 3. 破坏性变更（不改代码升级后也会变）

| # | 变更 | 2.1.1 → 3.0.0 | 影响谁 | 回退方式 |
|---|---|---|---|---|
| B1 | 默认每页条数 | 10 → **100**；可选项 `[10,20,50]` → 没开 `fillHeight` 的表格 `[100,500,1000]`，开了的 `[100,1000,10000]`（后者正式版才有，见第 5 节 D4）。不开 `fillHeight` 时，翻页后如果卡片顶部已滚出视口，会自动滚回卡片顶部 | 所有表格；**后端限制了 `pageSize` 上限的会被拒绝** | 全局 `defaultPageSize` / `pageSizes`；滚回顶部无开关 |
| B2 | 默认密度 | `comfortable` → **`compact`**；`storageKey` 里存过的旧密度不再覆盖宿主值 | 所有表格 | 全局 `density: 'comfortable'` 或单表 `default-density="comfortable"` |
| B3 | 工具栏「密度」按钮 | 默认显示 → **不显示** | 所有表格 | `:toolbar="{ density: true }"` |
| B4 | 分页外观 | 页码序列 → **官方 `simple`**（输入框 / 总页数）；`showQuickJumper` / `pageSlot` 不再生效；窄屏（表格宽 < 600px）不显示每页条数；静态数据改每页条数后回第 1 页 | 所有表格 | `:pagination="{ simple: false }"` |
| B5 | 刷新按钮 | 静态数据模式下 显示（点了无效）→ **隐藏**；`refresh()` 方法保留 | 用 `data` 而不是 `fetcher` 的表格 | 无（本来就无效） |
| B6 | 表头排序箭头 / 漏斗 | 常驻 → **鼠标悬停该列才显示**（正在排序 / 已筛选的列、触屏设备仍常驻）；漏斗可以 Tab 聚焦；点漏斗的事件会冒泡到你挂在表头上的 click 监听 | 有排序或过滤列 | 无 |
| B7 | 列头过滤面板 | 单条件 / 勾选 → **多条件编辑**（≤ 5 条，且 / 或）；默认可选操作符仍是 2.1.1 的 8 个；自定义面板 `filter.render` 打开时按 Esc 会关闭 | 有 `filter` 的列 | 无 |
| B8 | 拖过列宽后的空白 | 补一列占位列 → **最后一个可拖的数据列吸收空白**，表头不再有占位列；**这一列没有拖拽把手**（要调它，拖它左边那列） | 开了 `resizable` | 给那一列写 `resizable: false`，吸收顺延到前一列 |
| B11 | 卡片内边距 | 20 / 24 / 20 → **四边 16px** | 所有表格（含搜索卡片） | `:card-props="{ size: 'medium' }"` |
| B12 | 列宽拖拽下限 | 固定 60px → 带图标的列 93 / 102 / 123px（仅排序 / 仅过滤 / 两者都有） | 开了 `resizable` | 列上写 `minWidth` |
| V1 | 卡片标题 | 字重 600 → **500**，颜色改为官方卡片标题色 | 所有表格 | `#title` 插槽里自己写字重 |
| V2 | 工具栏按钮间距 | 全部 4px → **你的按钮之间 8px、内置图标之间 4px、两组之间 12px** | 有工具栏按钮 | 你的按钮外自己包 `<n-space :size="4">` |
| V3 | 内置图标按钮 | 图标 18px → **16px** | 所有表格 | CSS `.smart-table-toolbar-icons .n-button { --n-icon-size: 18px !important }` |
| V4 | 表头漏斗 | 深色 `NButton` → **22 × 22 小按钮，平时灰色、已筛选时主色** | 有 `filter` 的列 | 无 |
| V5 | 过滤列标题 | 列被拖窄时折成两行 → **单行、放不下省略**；DOM 多了一层 `span.smart-table-th-text` | 有 `filter` 的列 | CSS `.smart-table .smart-table-th-text { white-space: normal !important; overflow: visible !important }` |
| V6 | 单选过滤 `filter.multiple: false` | 复选框模拟单选 → **官方单选框 `NRadio`** | 用了单选过滤 | 无 |
| V7 | 列设置 | 可以把列全部取消 → **只剩一列时那一列不能再取消** | 所有表格 | 无 |
| V8 | 列设置 / 密度菜单 | 按 Esc 没反应 → **按 Esc 关闭** | 所有表格 | 无 |
| V9 | 列宽拖拽把手 | 列界左侧半格高的细线 → **骑在列界上、整行高、悬停才显示**；松手不再误触排序；触屏可以单指拖 | 开了 `resizable`；自己覆盖过把手样式的 | 无 |
| T1 | 类型 `FilterAction` | 8 个成员 → **15 个** | 穷尽处理它的 TS 代码 | 补上新成员 |
| T2 | 类型 `SmartTableInst` | 新增 `sort` / `clearSorter` | 手写实现 / mock 的 | 补上两个方法 |

## 4. 行为会变的缺陷修复

旧行为本来就是错的，但升级后你能看到变化：

| # | 修复 | 你会看到 |
|---|---|---|
| C1 | 多列排序 `sorter: { multiple }` 不再被截成单列 | 箭头和远程参数都变正确 |
| **C2** | **`defaultSortOrder` 现在生效** | **首次请求带排序参数、静态数据按它排序、箭头回显**（列是异步加载进来的话不生效，请在列到位后调 `sort()`） |
| C3 | options 列的过滤值里有 `notEqual` / `isNull` / 多条 `equal` 且时，打开勾选面板不再丢条件 | 自动展开「高级条件」 |
| C5 | 开了 `search.collapsible` 时，窄屏折叠态至少露出第一个搜索字段 | 此前一个都不显示 |
| C6 | `@update:sorter` 每次点表头只调一次 | 此前调两次，在里面累加或发请求的会重复 |
| C7 | 纯日期串（`'2026-09-21'`）按本地零点解析 | UTC 以西的时区不再显示成前一天；UTC+8 的 `datetime` 不再显示 `08:00:00` |
| C8 | `labels` 里显式写 `undefined` 的键不再覆盖默认文案 | 不再渲染出字面的 "undefined" |

## 5. 同样会变的 4 条行为变更（D1–D4）

这 4 条同样不传任何属性、升级后也会生效：

| # | 变更 | 此前 → 3.0.0 | 影响谁 | 回退方式 |
|---|---|---|---|---|
| D1 | 当前行高亮色（`activeRowKey`） | 靛蓝 8%、暗色没有单独的颜色 → **跟随主题主色**，明暗各一 | 用了 `activeRowKey` | 全局 `activeRowBg` |
| D2 | `@row-click` 的触发范围 | 行内任何点击都触发 → **点行内的按钮 / 勾选框 / 链接 / 输入框不再触发** | 用了 `@row-click` 且行内有按钮的（已经在按钮上写了 `.stop` 的不受影响） | 需要旧行为时用 `row-props` 的 `onClick` |
| D3 | 请求失败后的页码 | 停在没拿到数据的那一页、表里却是旧数据 → **回到请求前的页码和每页条数** | 远程模式翻页时请求失败 | 无（缺陷修复） |
| D4 | 每页条数可选项 | 此前内置可选项固定为 `[100,500,1000]` → **开了 `fillHeight` 的表格改为 `[100,1000,10000]`**，没开的不变；默认都是 100 | 开了 `fillHeight` 的表格；选 10000 时请求的 `pageSize` 是 10000 | 全局或单表 `pageSizes` |

## 6. 纯新增（不用就和 2.1.1 一样）

条件构造器 `search: { container: 'table' }`、批量栏 `#batch`、放大 `toolbar.maximize`、已生效条件 chips `filterChips`、「更多」菜单 `toolbar.more`、铺满父容器 + 虚拟滚动 `fillHeight`、多列排序与实例方法 `sort()` / `clearSorter()`、15 个过滤操作符（新增的 7 个需要在列上用 `filter.actions` 显式开启）、`cardProps`、中文文案包 `zhCNLabels`、全局 `defaultPageSize`。用法见 [`README.md`](./README.md) 和 [`CHANGELOG.md`](./CHANGELOG.md)。
