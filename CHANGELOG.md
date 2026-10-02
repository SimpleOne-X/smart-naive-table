# Changelog

## 3.0.0-beta.1 - 待发布

> 这是一次 **major** 升级:下面「默认行为变更」里的每一项,**不传任何属性、升级后也会变**。每项都写了回退方式,都是一行属性。
>
> **⚠ C2(缺陷修复,但行为会突变)**:此前给列写了 `defaultSortOrder` 却因被受控 `sortOrder` 盖掉而从未生效;升级后**首次请求会带上排序参数、静态 `data` 模式下本地数据也会按它排序、箭头会回显**。如果你有这样的列,请确认这是你想要的。
>
> 本次变更**只在 naive-ui 2.45.3 上验证过**(`peerDependencies` 仍是 `^2.34.0`),其它 2.x 版本未测。

### 默认行为变更(B 级)

| 变更 | 旧 → 新 | 回退方式 |
|---|---|---|
| **每页条数**(B1) | 默认 10 → **100**;可选项 `[10,20,50]` → `[100,500,1000]`。⚠ **远程模式请求里的 `pageSize` 变成 100,后端若限制了 `pageSize` 上限(如 ≤ 50)会直接拒绝请求,升级前请确认**。解析优先级:实例 `defaultPageSize` > 实例 `pagination.pageSize` / `pagination.defaultPageSize` > 全局 `defaultPageSize`(新增)> 宿主(实例或全局)显式给了 `pageSizes` 时取它的第一项 > 100。**不开 `fillHeight` 时 100 行是整页长滚动**:要卡片内滚动请传 `fillHeight`(父容器须定高)。**另一处默认行为变化:不开 `fillHeight` 时,点翻页 / 改每页条数后,若卡片顶部已滚出视口上沿,页面会自动滚回卡片顶部**(只在卡片顶部已滚出视口时触发,卡片可见时不动;表格放在宿主自己的滚动容器里时以该容器的上沿为准,固定顶栏可给卡片写 CSS `scroll-margin-top` 留位;无开关,开 `fillHeight` 则改为表体自己回顶) | `defaultPageSize` / `pagination.pageSizes` / 全局 `defaultPageSize` / 全局 `pageSizes` |
| **默认密度**(B2) | `comfortable` → **`compact`**。**`storageKey` 里存过的旧密度不再覆盖宿主给的 `defaultDensity`**(没有密度按钮时,这些用户本来就改不回去)。另:**保存列设置 / 列宽时不再把当前密度写进存储**(存储里原有的密度原样保留,没有记录也不写该字段),所以宿主回滚到 2.1.1 时用户不会被固定在 compact。**公开导出的 `loadState(storageKey, fallbackDensity?)` 新增可选第二参数:不传时,存储里有记录但缺 `density` 字段的返回值由 `'comfortable'` 变成 `'compact'`(此前写死 `'comfortable'`);要旧行为请传 `'comfortable'`**。**开了 `toolbar.density: true` 时,存储里已有的旧值继续生效**(包括 2.1.1 默认写进去的 `comfortable`) | `defaultDensity="comfortable"`;直接调 `loadState` 的宿主传 `'comfortable'` |
| **工具栏去掉密度按钮**(B3) | 默认显示 → 不显示。`toolbar.density` 属性保留、默认改为 `false`;`defaultDensity` 现在是**响应式**的(宿主的个人设置变了,已挂载的表格跟着变) | `toolbar: { density: true }`(此时存储里的密度优先,与旧行为一致;**存储里已有的旧值会继续生效**,包括 2.1.1 默认写进去的 `comfortable`) |
| **分页外观**(B4) | 页码序列 → 官方 `simple`(输入框 / 总页数);每页条数选择器是**嵌在 `suffix` 里的官方 `NPagination`(`displayOrder: ['size-picker']`)**,选项文案自动跟 `NConfigProvider` 的 locale(中文「100 / 页」,不需要新 label);`pagination.pageSizes` 里的 `{ label, value }` 原样保留;当前每页条数不在 `pageSizes` 里时自动并入选项。**窄档(库根节点宽 < 600px)不画每页选择器**。**`simple` 下官方不渲染 `showQuickJumper` / `pageSlot`,传了也不再生效**。**另:静态数据模式改每页条数后回到第 1 页**(2.1.1 停在当前页、超出总页数才夹回最后一页;现与远程模式一致;`simple: false` 下同样如此,这一条无开关) | `pagination: { simple: false }`(回到页码序列,走官方 `showSizePicker` / `pageSizes`) |
| **静态数据模式不显示刷新**(B5) | 显示(点了无效)→ 隐藏。实例方法 `refresh()` 保留 | 无(本来就无效) |
| **表头图标悬停才显示**(B6) | 排序箭头 / 漏斗常驻 → 悬停该列表头时淡入(键盘 Tab 到漏斗时漏斗淡入);正在排序 / 已筛选 / 面板打开的列常驻;触屏(主输入设备无悬停,`@media (hover: none)`,与原型一致)淡显常驻。漏斗现在可被 Tab 聚焦。图标间距:标题 → 漏斗 8px、漏斗 → 排序箭头 6px、表头右内边距 16px;「标题 + 漏斗 + 排序箭头」紧贴成一组(2.1.1 表头居中时排序箭头被挤到格子最右)。点漏斗不再靠 `stopPropagation` 防排序(改用官方 `data-data-table-filter`),宿主挂在表头 / 祖先上的 click 监听现在能收到漏斗上的点击 | 暂无开关 |
| **列头过滤面板**(B7) | 单条件 / 勾选 → **多条件编辑**(≤ 5 条,≥ 2 条出现且 / 或);options 列底部有「高级条件」。**默认可选操作符不变**(仍是 2.1.1 的 8 个:文本 包含 / 不包含 / 等于 / 不等于;数字、日期 等于 / 不等于 / 大于 / 大于等于 / 小于 / 小于等于;字典 等于 / 不等于),新操作符需在列上 `filter.actions` 显式开启。面板支持键盘(打开时焦点进入面板、Esc 关闭并还焦点、下拉展开时 Esc 只收下拉、Tab 在面板内循环)与 ARIA(`role="dialog"`)。**自定义面板 `filter.render` 也有变化:面板打开期间按 Esc 会关闭它(不管焦点在面板里还是仍在漏斗按钮上;焦点在宿主面板里一个展开着的下拉上时也会直接关掉整个面板),且打开时不会自动聚焦、Tab 不在面板内循环**。面板排布对齐设计原型:首列第 1 行是「条件」引导标签、第 2 行起是且 / 或下拉(取代行下方的分段按钮)、4 列网格、「添加条件」是带加号的深色文字按钮、底部「重置 / 确定」居中分布;在窄容器里面板会水平夹进视口,不再被裁出屏幕 | 无 |
| **拖过列宽后的余量**(B8) | 补一列占位列 → 由**最后一个可见、非 `fixed`、`resizable !== false` 的数据列**吸收。**表头 DOM 不再有占位列**(列数恒等于声明的列数);钉住后这一列不写 `width`(弹性),下限是它声明的宽度 / `minWidth`;**⚠ 已知代价:吸收余量的那一列没有拖拽把手**(**即使还没拖过列宽、表格还没钉住时也没有**;开了 `resizable` 的表格里,最后一个可拖的非固定列在任何时候都没有把手;要调它的宽度,拖它左邻列的把手)。全部列都 `fixed` / 都不可拖时,最后一列写显式宽度 `max(下限, 容器宽 − 其余列宽 − 拖拽增量)`。拖过的列后来变成吸收列(隐藏最后一列 / 调顺序 / 设固定)时表格会重挂一次(Naive 没有清除拖拽宽度的入口),该次挂载内的横向滚动位置和本地拖拽状态会重置 | 给那一列写 `resizable: false`(让它不参与吸收,吸收列顺延到前一列;比如固定在右侧的「操作」列天然不参与) |
| **筛选后的分页**(B9) | 库远程回第 1 页(有意偏离官方默认 `'current'`,**保持不变**);现在宿主显式传官方 `paginationBehaviorOnFilter` 就照官方 | 传官方 `paginationBehaviorOnFilter` |
| **卡片内边距**(B11) | 2.1.1 内容区 **20 / 24 / 20**(上 / 左右 / 下;官方 medium,无 header 时 `padding-top` 取 `--n-padding-bottom`)→ **四边 16px**(`size="small"` + 库内卡片自己的 `paddingSmall` 覆盖,不影响宿主全局主题) | `cardProps: { size: 'medium' }`(新增,见下) |
| **可拖拽列的拖拽下限**(B12,只影响开了 `resizable` 的用户) | 固定 60px → 带图标的列取 `max(resizeMinWidth, 图标下限)`:仅排序 93、仅过滤 102、两者 123(吸收列没有把手,见 B8) | 列上显式写 `minWidth` |

### 外观调整(对齐设计原型;2.1.1 已有外观的变化)

| 变更 | 旧 → 新 | 回退方式 |
|---|---|---|
| **卡片标题** | 字重 600、颜色 `textColor2` → **字重 500(`fontWeightStrong`)、`textColor1`**(与官方卡片标题一致) | `#title` 插槽里自己写 `<span style="font-weight: 600">…</span>`(span 的内联样式盖过标题自己的) |
| **工具栏间距** | 右侧所有按钮间距 4px → **业务组(宿主 `#toolbar-right` 的按钮 + 「更多」)8px、内置图标组 4px、两组之间 12px** | 业务组内:宿主用 `<n-space :size="4">` 包住自己的按钮;两组之间的 12px 无法回退(**无**,纯排布) |
| **内置图标按钮的图标** | 刷新 / 密度 / 列设置的图标 18px → **16px** | 宿主 CSS `.smart-table-toolbar-icons .n-button { --n-icon-size: 18px !important }` |
| **表头漏斗** | `NButton` 26 × 22、颜色 `textColor1`(比排序箭头深得多),悬停 / 面板打开整个图标变深 → **原生按钮 22 × 22、闲置色 = 表头图标色(与排序箭头同灰)、悬停 / 打开只加底色、已筛选才变主色** | 无(B12 的拖拽下限按 22px 计算) |
| **过滤列标题** | 列被拖窄时标题折成两行(表头被撑高、图标被挤歪)→ **标题单行、放不下省略**(漏斗和箭头始终完整)。DOM:标题文字多包了一层 `span.smart-table-th-text`;只有排序箭头(没有过滤)的表头不变 | 宿主 CSS `.smart-table .smart-table-th-text { white-space: normal !important; overflow: visible !important }`(库自己的规则带 scoped 属性选择器,优先级更高,不加 `!important` 盖不过) |
| **单选过滤列**(`filter: { multiple: false }`) | 用复选框模拟单选 → **官方 `NRadio`**(与官方 `NDataTable` 的单选过滤一致) | 无 |
| **列设置** | 允许把列全部取消(表头只剩勾选 / 操作列)→ **只剩一列可见时那一列的勾选框禁用**;库内部的 `toggleShow` 同样兜底拒绝隐藏最后一个显示的列 | 无(没有数据列的表格没有意义) |
| **搜索区「展开 / 收起」**(缺陷修复) | 文字按钮比同排「搜索 / 重置」上移 6px、矮 20px → **同高、垂直居中** | 无(缺陷) |

### 缺陷修复(C 级)

- C1:列上写 `sorter: { multiple }` 的多列排序不再被截成单列(箭头回显与远程参数都变正确)。
- **C2:`defaultSortOrder` 现在会生效**(见顶部提示)。它**只在首次 setup 时从列声明里读一次**:列若是异步加载进来的,`defaultSortOrder` 不会生效,请在列到位后用实例方法 `sort()`。
- C3:options 列的过滤值里带 `notEqual` / `isNull` / 「多条 equal 且」时,打开勾选面板不再静默丢条件、确认不再覆盖原条件(自动展开「高级条件」)。
- C5:开启 `search.collapsible` 时,窄屏(1 列)折叠态至少露出首个搜索字段(此前 0 个)。
- **C6:宿主在 `<SmartTable>` 上写的 `@update:sorter` 每次点表头原来会被调两次(两次载荷相同,宿主若在里面累加 / 发请求会重复),现在只调一次**(库统一经 `notifyHostSorter` 转发,不再让它再从透传属性里混进去一份)。
- **C7:单元格是纯日期串(`'2026-09-21'` 这种不带时间的形状,后端 DATE 字段常见)时,现在按浏览器本地零点解析**(2.1.1 起就有的老问题)。此前它被按 UTC 零点解析:**UTC 以西的时区(如美洲)里 `format: 'date'` / `'datetime'` 显示成前一天**,本地过滤也按前一天判定(例:「大于等于 2026-09-21」选不中这一行,「等于 2026-09-20」反而选中);**UTC 以东的时区(如 UTC+8)日期显示本来就对,但 `format: 'datetime'` 显示的是 `2026-09-21 08:00:00` 这类时区偏移小时,现在是 `00:00:00`**,过滤值是 `Date` 对象或带时间的串时的比较也随之改正。带时间部分的串(裸 datetime、带 `Z` / 偏移)、`Date` 对象、时间戳的解析不变。

### 新增

- **多列排序**:列上写官方 `sorter: { multiple: n }`(**数值大者优先,与点击顺序无关**)。远程参数:单列不变;多列仍带最高优先级列的 `sortField` / `sortOrder`,**另加 `sorts: [{ field, order }…]`**(`order` 为 `'asc' | 'desc'`)。实例方法 `sort(columnKey?, order = 'ascend')`、`clearSorter()`(沿用官方 `DataTableInst` 的签名:不传 `columnKey` = `clearSorter()`;会通知宿主的 `onUpdate:sorter`,载荷形状与官方一致;编程式调用只转发给 `@update:sorter` 这种写法,`onUpdateSorter` / `onSorterChange` 拼写只在点表头时收到)。排序态不持久化。
- **`FilterAction` 由 8 个扩到 15 个**:新增 `isNull` `isNotNull` `like` `startsWith` `endsWith` `in` `notIn`。**列头面板的默认可选操作符不变**,只有宿主在列上显式写 `filter.actions` 时才会出现这些操作符,所以后端只会在宿主显式开启后才收到它们。语义:`isNull`/`isNotNull` 不需要值(空 = `null`/`undefined`/空白串/空数组,`0`/`false` 不算空;**值为空也不会被当成「没填」丢弃**);`startsWith`/`endsWith` 忽略大小写;`like` 是 SQL `LIKE`(`%` 任意长度、`_` 单字符,整串匹配、忽略大小写;不支持转义,`%` / `_` 一律按通配符);`in`/`notIn` 的值是数组;**未知操作符一律按不匹配处理(fail-closed)**。**`in` 经勾选面板回写会变成若干 `equal` 取「或」——语义相同、序列化形状不同。** 新增导出:`NO_VALUE_ACTIONS`、`isValuelessAction`、`actionValueKind`、`isOptionsRepresentable`。
- **`filterChips`**:已生效条件 chips(默认 `false`):点击重开该列面板、× 删一条、超一行折成 `+N`、行末按钮紧跟 chips:有列声明了 `defaultValue` 的表,过滤态**偏离默认**时出现「恢复默认」(语义不变);没有默认值的表,**≥ 2 个 chip** 时出现「清除全部」;过滤态里有、列声明里已没有的键也会显示(点击不开面板,× 可清)。
- **`toolbar.more`**:「更多」菜单(官方 `NDropdown` 的 `options` 原样透传),选中后发 `moreSelect(key, option)` 事件;不传 / 空数组 / 只有分隔线时不显示。库不内置导出 / 导入。
- **`fillHeight`**(默认 `false`):官方 `flex-height` + `virtual-scroll` + `min-row-height` 三件套:表体在卡片内滚动、分页条贴底、每页 100 / 1000 行时 DOM 里只有十几行。**父容器必须有确定高度**(`height: 600px` / `calc(100vh - …)` / 定高的 flex 列),否则表体塌成 0(库带了 `min-height: 160` 兜底);`min-row-height` 随密度取 40(紧凑)/ 48(舒适),宿主改了 `themeOverrides` 导致行高变化时,在 `<SmartTable>` 上写官方的 `min-row-height` 覆盖(宿主 attrs 优先)。**开启时忽略宿主传的 `max-height`(表体高度由父容器决定),并在控制台警告一次。** **不开时**:点翻页 / 改每页条数后,若卡片顶部已滚出视口上沿,自动滚回卡片顶部(只在需要时滚)。
- **全局 `defaultPageSize`**:`createSmartTableDefaults({ defaultPageSize })`(纯新增,优先级见 B1)。
- **`cardProps`**:库渲染的卡片(表格卡片、模式 1 的搜索卡片)的官方 NCard 属性,合并在库默认 `size="small"` + 16px 内边距覆盖之后;`themeOverrides` 逐键合并。
- **`zhCNLabels`**:完整的中文 labels(含 2.1.1 已有的键与 3.0 新增的键),纯数据零依赖,中文宿主直接 `:labels="zhCNLabels"`。**3.0 新增的 label 键全部可选**,2.1.1 宿主写的完整 labels 对象不会报类型错误,缺的键取英文默认。
- 新 labels:`more`、`filterActiveCount`、`filterAddCondition`、`filterRemoveCondition`、`filterLogicAnd`、`filterLogicOr`、`filterAdvanced`、`filterSimple`、`filterClearAll`、`filterRestoreDefault`、`filterIsNull`、`filterIsNotNull`、`filterLike`、`filterStartsWith`、`filterEndsWith`、`filterIn`、`filterNotIn`、`filterNoValue`、`filterConditionLead`、`filterCannotCollapse`(后两个是列头面板里的「条件」引导标签与「含勾选无法表达的条件」提示)。
- **`SmartTableProps` 补上 `rowDraggable` / `dragHandle`**(`SmartTable` 一直有这两个 prop,导出的类型里漏了,宿主按类型写 props 对象会报多余属性)。
- 新类型导出:`SortItem`、`ToolbarMoreOption`、`ActionValueKind`;`saveState` 的 `density` 形参放宽成 `Density | undefined`(`undefined` = 不写该字段,纯放宽)。

### 类型层面变更

- **`FilterAction` 联合类型由 8 个成员扩到 15 个**:宿主若有穷尽的 `Record<FilterAction, …>`,或带 `never` 兜底的 `switch (action)`,升级后 `vue-tsc` 会报错,需要补上新成员。
- `SmartTableInst` 新增 `sort` / `clearSorter`:宿主若手写了该接口的实现或 mock,需要补上。

### 内部

- 删除内部的 `withFillerColumn` / `FILLER_COLUMN_KEY`(从未从入口导出过)。
- 内部的 `useColumns().toggleShow` 改为返回 `boolean`(是否生效;`useColumns` 未从入口导出)。

## 2.1.1 - 2026-09-16

### 修复：列宽钉住后表格右侧留白

- 列宽之和小于容器时补一列占位列，把富余宽度独自吃掉：表格重新填满容器，表头与行的底色、边框铺到右缘，而每一列仍是拖出来的精确宽度（此前富余宽度就空在表格右侧）
- 占位列插在右固定列之前，操作列这类右固定列仍贴容器右缘；它不进列设置，也不参与排序、过滤与拖拽
- 列宽之和超过容器时行为不变，照旧横向滚动；没拖过列宽（未钉住）的表格仍由 Naive 自己按容器拉伸

## 2.1.0 - 2026-09-15

### 新增：表头过滤

列上加 `filter` 即可（参考 [Bootstrap Blazor Table](https://www.blazor.zone/table/filter) 的条件过滤与 [Arco Design Vue Table](https://arco.design/vue/component/table) 的勾选过滤）：

- 两种面板，按列自动选：列有 `options` 出勾选列表（`multiple: false` 变单选），否则出一行「动作 + 值」条件
- 动作集合 `equal` / `notEqual` / `contains` / `notContains` / `gt` / `gte` / `lt` / `lte`，按值类型给默认集合
- 远程模式把过滤态序列化进请求（默认 `{ filters: [{ field, logic, conditions }] }`，可用 `filter-serializer` 或全局 `filterSerializer` 换形状），静态 `data` 模式在前端过滤
- 新增 `@filter-change` 事件与 `filters` / `setFilter()` / `clearFilters()` 实例方法
- 表级开关 `:filter="false"` 一键关掉全部表头过滤（与 `:search="false"` 对称），全局默认 `filterable`
- 新增导出：`matchFilterValue`、`applyFilters`、`defaultFilterSerializer`、`isFilterActive`、`useFilters` 等，以及 `FilterConfig`、`FilterValue`、`FilterState` 等类型

### 新增：列宽拖拽

- 表格上加 `resizable` 即可整表开启（列上的 `resizable` 优先，参考 Arco 的 `column-resizable`）
- 新增 `@column-resize` 事件（`key`、`width`）与 `columnWidths` 实例属性
- 传了 `storage-key` 时列宽随列设置一起持久化；可拖拽列自动补 `minWidth`（默认 60）避免被拖成 0 宽
- 拖某一列只改这一列：首次拖动把所有列（含序号 / 勾选列）钉成实际宽度，并把表格切到 `table-layout: fixed`、宽度写死成列宽之和，左侧的列不再被牵动
- 列宽钉住后表格不再按容器拉伸（收窄留白 / 加宽滚动）；「恢复默认」可回到自适应
- 列设置里的「恢复默认」会一并还原列宽

### 全局默认值

新增 `resizable`、`filterable`、`resizeMinWidth`、`filterSerializer`；`SmartTableLabels` 新增过滤相关文案（未覆盖时取英文默认）。

### 注意

- 列上的 `filter` 现在由本包接管，不再透传 Naive 原生的 `filter` / `filterOptions` 等列过滤属性
- localStorage 存储结构升到 `v2`（新增 `widths`）。`v1` 数据自动升级，已存的列显隐、顺序、固定与密度不受影响

## 2.0.0 - 2026-09-12

**破坏性变更：导出名统一改为 `SmartTable` 前缀，行为不变。升级时按下表替换导入、类型与样式覆盖。**

| 1.x | 2.0 |
|---|---|
| `ProTable` | `SmartTable` |
| `useProTable`、`UseProTableOptions`、`UseProTableReturn` | `useSmartTable`、`UseSmartTableOptions`、`UseSmartTableReturn` |
| `PRO_TABLE_DEFAULTS`、`createProTableDefaults`、`useProTableDefaults`、`ProTableDefaults` | `SMART_TABLE_DEFAULTS`、`createSmartTableDefaults`、`useSmartTableDefaults`、`SmartTableDefaults` |
| `ProTableParams`、`ProTableFetcher`、`ProTableOption`、`ProTableDataColumn`、`ProTableSpecialColumn`、`ProTableColumn`、`ProTableProps`、`ProTableInst`、`ProTableLabels` | `SmartTable` 前缀、同后缀 |
| CSS 类 `.pro-table`、`.pro-table-*`，CSS 变量 `--pro-table-active-row-bg` | `.smart-table`、`.smart-table-*`，`--smart-table-active-row-bg` |

列设置在 localStorage 里的键前缀 `protable:` 保持不变，用户已存的列显隐、顺序、固定与密度升级后照常生效。

## 1.0.0

首次发布。功能与用法见 [README](./README.md)。
