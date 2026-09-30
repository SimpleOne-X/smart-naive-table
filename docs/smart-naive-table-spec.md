# SmartTable 3.0.0 现状规格

> **这份文档只写「当前结论」**:要做什么、默认值、API、落地必须满足的要求、验证状态。不含推翻过程。
> 决策过程、备选方案与理由见 [`smart-naive-table-design.md`](./smart-naive-table-design.md)(下称「设计文档」,括号里的 `x.y` 指它的小节)。**两份冲突时以本文为准,并回去修正设计文档。**
> 状态:设计定稿,`src/` 尚未改动,**没有实现 plan**(等你说开始)。基线库版本 2.1.1,目标 **3.0.0**(已定,设计文档 8.4)。
> 优先级:**P0** 阻塞 `3.0.0-beta.1`;**P1** beta 期间补齐、正式版前必须齐;**P2** 建议推到 3.1(设计文档 8.5)。

## 0 总则

1. **官方优先**:naive-ui 有的就用官方(组件、属性名、主题变量),以本地 `node_modules/naive-ui` 2.45.3 的类型与源码为准,不凭记忆。官方没有的才自有扩展,并在文档里交代理由。
2. **macOS 简洁**:克制留白、轻分隔、次级操作降级(悬停显现)、一屏一个主色按钮、动效只用 opacity / 背景 / 边框、明暗两套(走主题变量,不硬编码颜色)。
3. **兼容规则**:新能力 = 新增可选属性;**默认行为变更必须进 CHANGELOG 并带回退方式**(本版 B 级,共 12 项);不改现有导出。
4. **零新依赖**;图标是库内联 SVG(`icons.ts`,零图标库依赖)。
5. **列驱动**:搜索项、过滤器、字典渲染都从 `columns` 派生,不另开并行配置。
6. **labels 渲染期求值**(不在 setup 期解成字符串,否则切语言失效)。

## 1 默认行为变更(B 级,升 major 的理由,全部 P0)

| # | 变更 | 旧 → 新 | 回退方式 | 设计文档 |
|---|---|---|---|---|
| B1 | 默认每页条数与页大小 | 10 → **100**;`[10,20,50]` → `[100,500,1000]`。⚠ 远程模式请求的 `pageSize` 变 100,**后端若限制 `pageSize` 上限会拒绝**,CHANGELOG 单列 | `defaultPageSize` / `pageSizes` | 2.11 |
| B2 | 默认密度 | `comfortable` → **`compact`**;**旧 `storageKey` 里存的密度不再覆盖宿主值**(`storage.ts` 的回退值同步改) | `defaultDensity="comfortable"` | 5.1 / 5.2 |
| B3 | 工具栏去掉「密度」按钮 | 默认显示 → 不显示;`toolbar.density` **保留、默认 `false`**(传 `true` 仍可请回,此时存储优先) | `toolbar: { density: true }` | 5.2 |
| B4 | 分页外观 | 页码序列 → 官方 `simple`(输入框 / 总页数);见 §5.5 | `pagination.simple: false`(新增开关) | 6 |
| B5 | 静态数据模式不显示刷新按钮 | 显示(无效)→ 隐藏;`refresh()` 方法保留 | 无(本来就无效) | 7.1 |
| B6 | 表头排序箭头 / 漏斗悬停才显示 | 常驻 → 悬停显现(激活态、触屏除外) | 暂不提供开关(YAGNI) | 3.9 |
| B7 | 列头过滤面板 | 单条件 / 勾选 → 多条件编辑;options 列「勾选 + 高级条件」 | 无 | 3.1 / 3.4 |
| B8 | 拖过列宽后的余量 | 占位列 → **最后一个数据列吸收**(表头 DOM 不再有占位列) | 无 | 3.11 |
| B9 | 筛选后分页 | 库远程回第 1 页(**有意偏离官方默认 `'current'`**,保持现状)| 宿主传官方 `paginationBehaviorOnFilter` | 3.8 |
| B10 | 模式 2 默认多一行 chips | 无 → 有条件时多一行 | `filterChips: false` | 3.2 |
| B11 | 卡片内边距 | 官方 medium `19/24/20`(窄档 `12/16`)→ **四边 16px** | 给卡片传官方 `size` / 主题覆盖(是否暴露入口落地时定) | 5.4 |
| B12 | 列宽拖拽下限(只影响开了 `resizable` 的用户) | 固定 60px → 带图标的列取 `max(60, 图标 + 标题最小宽)`;表头 `th` 改 `overflow:visible` + 递减 `z-index`(**要在带 `fixed` 列的表上再验证**) | 无 | 3.11 |

## 2 缺陷修复(C 级,全部 P0;每个**先写复现测试,再修**)

| # | 缺陷 | 状态 | 修复后可见影响 |
|---|---|---|---|
| C1 | 多列排序被截成单列(`SmartTable.vue:209-211` 取 `s[0]`;`useColumns.ts:453-456` 回显错) | **真实浏览器已复现**(设计文档 9.4) | 写了 `sorter: { multiple }` 的宿主,箭头与远程参数变正确 |
| C2 | `defaultSortOrder` 被受控 `sortOrder` 盖掉(`useColumns.ts:455-456`) | **已复现** | ⚠ **此前写了却没生效的 `defaultSortOrder` 升级后会突然生效**,CHANGELOG 显著标注 |
| C3 | `filterValueToOptions` 只取 `equal`,静默丢其它条件(`filter.ts:264-268`) | 读源码确认 | options 列带非等于条件时不再丢条件 |
| C4 | `activeConditions` 丢弃无值算子(`filter.ts:71-74`) | 读源码确认 | `isNull` / `isNotNull` 开始生效 |
| C5 | `SearchForm` 视口 < 640px 且开启 `collapsible` 时折叠态 0 个字段 | 原型已验证修法 | 折叠可见字段数 `max(1, collapsedRows × cols − 1)`;只有 1 列这一档变化 |

## 3 新增 API(A 级,不传则与 2.1.1 一致)

| 能力 | 形态 | 优先级 | 设计文档 |
|---|---|---|---|
| 多列排序 | 宿主在列上写官方 `sorter: { multiple: n }`(**大者优先,与点击顺序无关**);库内排序态由单个升为数组;远程参数单列不变,多列**仍带**最高优先级列的 `sortField / sortOrder` 并**另加** `sorts: [{ field, order }…]` | P0 | 4.1 |
| 实例方法 | `sort(columnKey, order)`、`clearSorter()`(沿用官方 `DataTableInst` 命名) | P0 | 4.6 |
| 已生效条件 chips | `filterChips?: boolean`(模式 2 默认开,其余默认关);`NTag`,超一行折成「+N」 | P0 | 3.2 |
| 「更多」菜单 | `toolbar.more?: DropdownMixedOption[]`(官方 `NDropdown` options 透传);事件 `moreSelect(key, option)`;不传不出现 | P0 | 7.3 |
| 新 labels | `filterClearAll` / `filterRestoreDefault` / `selectedCount`(含 `{n}`)/ `clearSelection` / `more` / 放大 / 还原(键名落地时定) | P0 | 3.3 / 2.12 / 7.2 / 7.3 |
| 触屏兜底 | `@media (hover: none)`:未激活箭头 / 漏斗 `opacity .5` 常驻,列宽拖拽热区 24px | P0 | 3.9 |
| 模式 2 条件构造器 | `search: { container: 'table' }`;`FilterAction` 8 → 15 个(+ `isNull` `isNotNull` `like` `startsWith` `endsWith` `in` `notIn`);窄档「输入框 + 筛选抽屉」 | P1 | 1 / 2.6a |
| 批量栏 | 插槽 `#batch="{ checkedRowKeys, clear }"`;「已选 N 项 / 取消选择」库内置;有 selection 列且传了插槽才出现;不暴露 `checkedRows` | P1 | 2.12 |
| 撑满父容器高度 | `fillHeight?: boolean`,默认 false,内部映射官方 `flex-height`(`DataTable.d.ts:126`) | P1 | 2.11 |
| 放大 | `toolbar.maximize?: boolean`,默认 **false** | P1 | 7.2 |
| 窄档卡片 | `cardOnNarrow?: boolean`,默认 false;列上 `card?: 'title' \| 'meta' \| 'action' \| false`;窄档排序抽屉 | **P2** | 2.7 / 2.12 / 4.5 |

## 4 布局

- **三档**(按**容器**宽,用 `@container`,不用视口媒体查询):窄 < 600、中 < 1280(模式 2 工具栏单行阈值)、宽 ≥ 1280。模式 1 的搜索网格仍是官方 `n-grid responsive="screen"`(视口口径),不动。
- **卡片内边距**:表格卡片与搜索卡片**四边 16px**(B11),官方做法 `size="small"` + 卡片自己的 `theme-overrides: { Card: { paddingSmall: '16px 16px 16px' } }`,只影响库里两张卡片(`SmartTable.vue:571`、`SearchForm.vue:145`)。加 1px 描边,四边到内容 17px。
- **页面底色**是宿主的事;卡片在白底与 `NLayout embedded` 灰底上都必须成立。
- **高度**:默认行为不变;`fillHeight` 开启时根与卡片 `height:100%; min-height:0; flex` 列,表格 `flex-height`,默认开虚拟滚动(官方要求配合 `max-height` 或 `flex-height`),`min-row-height` 取密度实际行高(舒适 45 / 紧凑 37);忽略并警告 `max-height`。

## 5 各块规格

### 5.1 搜索区
- 模式 1 `container: 'card'`(默认,不变):独立搜索卡片。模式 2 `'table'`:并入表格卡片的一行条件构造器「字段 + 比较符 + 值」,字段候选 = 声明了 `search` 的列;产出仍是 `FilterValue`,走现成 `filterSerializer`。旧的「只写 `layout:'inline'`」等价 `'none'`。
- 多条件:同字段多条可「且 / 或」(`FilterValue.logic`,**每字段一个值**,改任一条联动全部);**跨字段固定「且」**。
- 比较符按字段类型(text / number / date / select)分发,换字段后不再适用要自动重置;无值算子(`isNull` / `isNotNull`)集中导出常量,`activeConditions`、面板、构造器、chips 都读它。
- 模式 2 宽档严格 1:1(左半搜索、右半按钮 + 图标);值输入框最小 100px。
- 「搜索」是次级(描边)按钮,回车也触发;主色实心留给宿主的「新增」。窄档无「搜索」按钮(回车,`enterkeyhint: 'search'`);枚举字段选完即生效。

### 5.2 工具栏
- 顺序:标题 · (搜索区)· **宿主业务按钮(`#toolbar-right`)· 「更多」** · 放大 · 刷新 · 列设置。标题始终保留(超宽省略)。
- **刷新**:`toolbar.refresh !== false && isRemote`;静态模式不显示。
- **密度按钮**:默认不显示(B3)。`defaultDensity` **响应式**;没有密度按钮时**忽略存储里的 density**(格式与 `VERSION` 不动),宿主的个人设置才生效。
- **「更多」**:文字按钮 + 下箭头,默认描边、永不主色;**不用「…」图标**(模式 2 条件行已有「»」叫「更多条件」)。菜单选项高 34px(窄档 44px)、选中后收起、Esc / 点外部收起、与放大 / 列设置气泡互斥;批量栏出现时随工具栏一起被替换。**库不内置导出 / 导入**(官方 `downloadCsv` 只导当前页,`keepOriginalData` 反而忽略过滤),只出菜单外壳。
- **放大**(`toolbar.maximize`):图标「四角括号」;`position: fixed` 铺满 + **`Teleport to="body"`**;层级 `z-index` **默认 1999**(低于 naive 浮层 2000+,所以列头气泡仍盖在它上面)且**必须可配置**(宿主顶栏可能更高)。图标:放大 = 括号向外,还原 = 向内。
- **批量栏**:原地替换工具栏那一行,与工具栏行**共用同一 `min-height`**(勾选不让表格跳动);勾选态读宿主绑的 `checked-row-keys`(库不持有)。
- **对外图标**:只写文档、不加 API;宿主的自定义按钮放插槽里自己选图标。
- 窄档:业务按钮折叠成文字按钮「操作 ▾」,点开原位展开一行(不是浮层、**不加动画**);「更多」在展开行里与「新增」等分。

### 5.3 过滤(列头漏斗)
- **漏斗仍由库放在标题内**(`useColumns.ts:464`,DOM 与 2.1.1 一致);面板用官方 `NPopover`(`trigger: 'click'`、`placement: 'bottom'`),窄档(容器 < 600)用底部 `NDrawer`;**气泡与抽屉同一份内容,只换容器**。
- 面板内容(条件列):「比较符 + 值 + 删除」行、「添加条件」(**上限 5 条**)、≥ 2 条才出现「且 / 或」;宽度 `min(400px, 100vw − 16px)`;底部「重置」(默认,**立即生效并关闭**)+「确认」(primary),文案取官方 locale(`confirm` / `clear`);面板内改的是**草稿**,确认才提交,Esc / 点外部丢弃;值输入回车 = 确认。
- **options 列**:默认勾选;底部「高级条件」展开同一份多条件编辑。**不丢信息**:新增纯函数 `isOptionsRepresentable(value)`(`filter.ts`,可单测)——所有有效条件均为 `equal` 且(`logic === 'or'` 或仅一条),或恰好一条 `in`,才可用勾选无损表达;否则打开时自动展开高级条件原样显示。勾选形态提交写 `equal` 取「或」(序列化不变)。
- **⚠ 落地必须自己做的键盘 / 焦点(真实 `NPopover` 不管,设计文档 9.1)**:打开后把焦点移到第一个可编辑控件;在面板上监听 Esc 关闭并丢弃草稿;关闭后焦点还给漏斗按钮。窄档 `NDrawer` 自带。漏斗按钮 `aria-label`(含「已筛选 N 条」,走 labels)。
- 漏斗激活态 = 库自己的 `isFilterActive`,颜色取官方主题变量 `thIconColorActive`;同列 > 1 条加条数角标。**不用**官方 `renderFilterMenu`(设计文档 3.10 取代了 3.8 的改用官方漏斗)。
- **chips**(`filterChips`):`NTag` `round` `closable` `size="small"`;点击重开对应列面板,× 删这一条;行末按钮:表里有任何列声明 `defaultValue` 时「恢复默认」(`clearFilters()`,语义不变),否则「清除全部」;超过一行折成「+N」,点它在气泡里展开;同字段第 2 条起「或」加前缀。chips 是工具栏下方独立一行,批量栏只替换工具栏那一行。
- `filterSerializer` 默认格式不变(`{ filters: [{ field, logic, conditions }] }`),只多了 7 个 action 取值(CHANGELOG 告知后端);保留自有 `setFilter(key, FilterValue)`(官方 `filters()` 表达不了条件)。
- 筛选后分页:宿主显式传官方 `paginationBehaviorOnFilter` 就照官方;没传保持库现状(远程回第 1 页)。

### 5.4 排序
- 多列见 §3。**默认排序**用官方列上 `defaultSortOrder`(多列配 `multiple`),库按列推导初始排序态并带进首次请求(修 C2);循环沿用官方 升 → 降 → 取消。
- 默认**不显示优先级序号**(官方无;真觉得看不懂再用官方 `renderSorterIcon` 增强,不另造面板)。
- **排序态不持久化**(与过滤态一致,会话态)。
- 官方排序表头**本来就无键盘操作**(无 `tabindex`,Enter 不排序),**本期不解决**。
- 窄档无表头:第 2 行的「筛选 / 排序」文字按钮(带生效数角标)→ 底部抽屉(可排序列各一行,「无 / 升序 / 降序」分段,行序 = 声明的优先级;手机上不能改优先级,只能启停)。(P2 随卡片模式)

### 5.5 分页(B4、B1)
- 所有宽度统一官方 `NPagination simple`(输入框 / 总页数)。**官方 `simple` 不带每页条数选择器和快速跳页**(`Pagination.mjs:665,682`):**库自己用官方 `NSelect` 放进 `suffix` 插槽**(已验证可行),`pageSizes` / `showSizePicker` 映射到它。
- 总条数在 `prefix`(宿主 `#pagination-prefix` 插槽提供,库默认没有);窄档(容器 < 600)不提供 `suffix`,保留总条数,单行 40px。
- 代价(用户已接受):看不到页码序列、不能一眼点第 N 页。

### 5.6 列宽拖拽(`resizable`,库已有能力,2.1.0)
- 把手用官方结构但**静止不画线**,悬停 / 拖动才出现主色竖条(高度 70%),光标 `col-resize`;热区 11px 骑在列界线上(触屏 24px);拖动时一条贯穿整表的 1px 引导线;松手后 150ms 内吞掉 click,不误排序;拖动开始收起过滤气泡。
- **余量**:第一次按下把手,所有可见列冻结成当前渲染宽度;**最后一个数据列**写**显式数字宽度** = `max(自身, 容器宽 − 其余列宽之和)`,`scroll-x` 始终 ≥ 容器宽(`s3` 实测:`scroll-x` 小于容器时官方会把各列按比例拉伸,钉住的宽度不被遵守);全部列 `fixed` 时同样成立。拖拽起点取**此刻实际渲染宽度**。已知代价:最后一列拖窄时若总宽仍不足以填满容器则不变窄。
- 图标不被把手挤:右内边距 16px;拖拽下限见 B12。
- 宽度随 `storageKey` 持久化(已有)。

### 5.7 密度与表头图标
- 默认 `compact`,映射官方 `size`:舒适 = `medium`、紧凑 = `small`。行高舒适 45 / 紧凑 37。
- 图标顺序 **标题 → 漏斗 → 排序箭头**,间距 8 / 6px;闲置 `opacity: 0`(仍占位,不回流),悬停该列表头 / `:focus-within` 淡入(0.15s);常驻例外:正在排序的列箭头、已筛选的列漏斗、面板打开的那一列漏斗。用官方类名 `.n-data-table-th .n-data-table-sorter` 写 CSS 即可(已验证)。

### 5.8 窄档卡片(P2,`cardOnNarrow`)
- 列 → 卡片字段:默认零配置(第一个数据列作标题,其余「标签:值」两列,操作列放底部);列上 `card` 覆盖。**操作列 = `card: 'action'`,否则最后一个 `fixed: 'right'` 的列**。
- 卡片固定**舒适间距**(不响应密度);无描边,8px 间距 + 极淡底色 + 「操作」行上方 1px 分隔线;勾选框在右上角,热区 44×44;「编辑 / 删除」44×44;字段值单行省略(虚拟滚动需要等高)。
- 点卡片 = 现有 `rowClick`;列设置里隐藏的列卡片里同样隐藏。窄档总行数 2 行(行 1 标题 + 操作 + 三图标,行 2 输入框 + 筛选)。

## 6 落地必须满足的要求(来自验证,设计文档第 9 节)

1. **放大**:切换前记下表格 `scrollTop`,切换后恢复(Teleport 搬 DOM 会清零);切换后把焦点还给按钮;放大期间锁背景滚动(`html { overflow: hidden }`,退出还原原值);`z-index` 可配置。
2. **列头面板**:自己管焦点与 Esc(见 §5.3)。
3. **分页**:`suffix` 放 `NSelect`。
4. **余量**:最后一列显式宽度,`scroll-x` ≥ 容器宽。
5. **批量栏**与工具栏同一 `min-height`。
6. 所有新文案走 `labels.ts`、渲染期求值,并补英文等其它语言。
7. **CHANGELOG** 必须显著标注:B1–B12(每项带回退方式,B1 单列后端上限风险)、C2(`defaultSortOrder` 突然生效)、B2 里旧存储密度不再覆盖宿主值、新增 7 个 `action` 取值(后端同学)、B8 表头 DOM 不再有占位列。

## 7 测试要求(你的规则:无覆盖先补回归测试再改)

- **先锁住当前行为**:分页默认值与 `pageSizes`、密度默认与存储回退、`activeConditions` / `filterValueToOptions`、排序回显与远程参数、`storageKey` 读写、占位列(2.1.1 刚发布)。
- C1–C5 每个先写复现测试;`isOptionsRepresentable` 各分支(`notEqual` / `isNull` / `and` 多 `equal` / 单 `in`);同字段「或」;无值算子;`defaultSortOrder` 进入首次请求;多列远程参数;单列行为回归。
- 列宽:拖窄 / 拖宽 / 全部固定 / 隐藏最后一列(换下一个列当填充)。
- 容器宽 390 / 560 / 720 / 1024 下工具栏 `scrollWidth ≤ clientWidth` 且控件 `right ≤ 内容区右边界`。
- 落地后**另建基于真实组件的视觉基线**(`docs/baseline/` 只是原型的)。

## 8 YAGNI —— 明确不做

`headerIcons: 'always'` 开关;`sortSerializer`;图标注入 API;只读排序态对外暴露;双击把手重置列宽;手机上调整排序优先级;卡片模式自动开启;官方 `renderFilterMenu` 承载;优先级序号(除非实测看不懂);排序 / 过滤态持久化。

## 9 未验证(诚实清单,落地前后要补)

- 只测了 Chromium:**Firefox / Safari** 未测(`@container`、`@media (hover: none)`、Teleport 后滚动恢复)。
- 真实手指触屏、屏幕阅读器。
- 放大:宿主真实 z-index、`ResizeObserver` 与 Teleport 配合、虚拟滚动下滚动恢复。
- 列宽:拖拽过程中的余量重算、带右侧固定操作列。
- 多条件面板(B7)在真实 `NPopover` 里的整体表现;「更多」菜单的方向键(依赖官方 `NDropdown` 的 `keyboard`,只确认属性存在);批量栏里「更多」不显示(只读了代码)。
- 卡片模式(P2)、批量栏、`fillHeight` 在真实 `NDataTable` 上。
- B9 是对官方默认 `'current'` 的有意偏离(保持库现状,避免改变既有行为),需在文档与 CHANGELOG 里写明。
