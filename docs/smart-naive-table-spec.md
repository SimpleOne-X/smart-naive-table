# SmartTable 3.0.0 现状规格

> **这份文档只写「当前结论」**:要做什么、默认值、API、落地必须满足的要求、验证状态。不含推翻过程。**本文描述的是 P0 落地后的目标状态**(含 2026-09-30 第二轮评审 D1–D13 的全部决定)。
> 决策过程、备选方案与理由见 [`smart-naive-table-design.md`](./smart-naive-table-design.md)(下称「设计文档」,括号里的 `x.y` 指它的小节;第二轮评审见其第 10 节)。**两份冲突时以本文为准,并回去修正设计文档。**
> 状态:设计定稿,`src/` 尚未改动。P0 实现计划见 [`superpowers/plans/2026-09-30-smart-table-v3-p0.md`](./superpowers/plans/2026-09-30-smart-table-v3-p0.md)(按第二轮评审修订中,**与本文冲突处以本文为准**);P1 / P2 计划未出。基线库版本 2.1.1,目标 **3.0.0**(已定,设计文档 8.4)。
> 优先级:**P0** 阻塞 `3.0.0-beta.1`;**P1** beta 期间补齐、正式版前必须齐;**P2** 建议推到 3.1(设计文档 8.5)。
> spike S1–S4 已于 2026-09-30 完成(实测与代码见设计文档 9.6 与 `docs/spike/s5`–`s8`);本文里依赖它们的机制细节已按实测定稿,不再有待定占位。

## 0 总则

1. **官方优先**:naive-ui 有的就用官方(组件、属性名、主题变量),以本地 `node_modules/naive-ui` 2.45.3 的类型与源码为准,不凭记忆。官方没有的才自有扩展,并在文档里交代理由。本库只在 naive-ui **2.45.3** 上验证过(peer 范围 `^2.34.0`)。
2. **macOS 简洁**:克制留白、轻分隔、次级操作降级(悬停显现)、一屏一个主色按钮、动效只用 opacity / 背景 / 边框、明暗两套(走主题变量,不硬编码颜色)。
3. **兼容规则**:新能力 = 新增可选属性;**默认行为变更必须进 CHANGELOG 并带回退方式**(本版 B 级登记 12 条,`3.0.0-beta.1` 实际相对 2.1.1 有变化的 10 条,见 §1);不改现有导出。
4. **零新依赖**;图标是库内联 SVG(`icons.ts`,零图标库依赖)。
5. **列驱动**:搜索项、过滤器、字典渲染都从 `columns` 派生,不另开并行配置。
6. **labels 渲染期求值**(不在 setup 期解成字符串,否则切语言失效)。
7. **`var(--n-*)` 主题变量只在对应 naive 组件的子树内有效**;库自己的元素(如角标)要用 `useThemeVars()` 取值再经 `:style` 绑定。

## 1 默认行为变更(B 级,升 major 的理由)

登记 12 条(B1–B12)。其中 **B9 相对 2.1.1 没有变化**(保持库现状、对官方默认的有意偏离,登记是为了写进文档与 CHANGELOG),**B10 随 P1**(模式 2 才有)。所以 **`3.0.0-beta.1` 相对 2.1.1 实际变化的是 10 条:B1–B8、B11、B12**;正式版(P1 落地后)再加 B10,共 11 条。

| # | 变更 | 旧 → 新 | 回退方式 | P | 设计文档 |
|---|---|---|---|---|---|
| B1 | 默认每页条数与页大小 | 10 → **100**;`[10,20,50]` → `[100,500,1000]`。⚠ 远程模式请求的 `pageSize` 变 100,**后端若限制 `pageSize` 上限会拒绝**,CHANGELOG 单列;需要卡片内滚动请传 `fillHeight`(§3)。解析优先级与现状基线见 §5.5 | 实例 `defaultPageSize` / `pageSizes`;**全局 `SmartTableDefaults.defaultPageSize`(新增)**;宿主只写了 `pageSizes` 时默认取它的第一项 | P0 | 2.11 / 10 |
| B2 | 默认密度 | `comfortable` → **`compact`**;**旧 `storageKey` 里存的密度不再覆盖宿主值**(`storage.ts:27` 的回退值同步改;现状点 `config.ts:79`、`SmartTable.vue:197`)。**写入端**:保存列设置 / 列宽时**不写入**当前密度,存储里原有的 density 原样保留(现状 `useColumns.ts:297、313、405` 三处 `saveState(..., density.value, ...)` 要改),只有 `setDensity` 才写。**存储回退**:`loadState`(`storage.ts:27`)在存储没有 density 字段时写死回退 `'comfortable'`,会盖过宿主值 → `loadState` 新增可选第二参数 `fallbackDensity`(§3) | `defaultDensity="comfortable"` | P0 | 5.1 / 5.2 |
| B3 | 工具栏去掉「密度」按钮 | 默认显示 → 不显示;`toolbar.density` **保留、默认 `false`**(传 `true` 仍可请回,此时存储优先,**存储里已有的旧值继续生效**) | `toolbar: { density: true }` | P0 | 5.2 |
| B4 | 分页外观 | 页码序列 → 官方 `simple`(输入框 / 总页数);见 §5.5。**simple 下 `showQuickJumper` / `pageSlot` 不再生效**;窄档(容器 < 600)不画每页条数选择器(`narrowPager`,P0) | `pagination.simple: false`(新增开关) | P0 | 6 |
| B5 | 静态数据模式不显示刷新按钮 | 显示(无效)→ 隐藏;`refresh()` 方法保留 | 无(本来就无效) | P0 | 7.1 |
| B6 | 表头排序箭头 / 漏斗悬停才显示 | 常驻 → 悬停显现(激活态、触屏除外) | 暂不提供开关(YAGNI) | P0 | 3.9 |
| B7 | 列头过滤面板 | 单条件 / 勾选 → 多条件编辑;options 列「勾选 + 高级条件」。**列头面板的默认操作符集合保持 2.1.1 的 8 个**;7 个新操作符只在宿主于列上显式写 `filter.actions` 时出现(§5.9) | 无(面板形态变化,不涉及数据形状) | P0 | 3.1 / 3.4 / 10 |
| B8 | 拖过列宽后的余量 | 占位列 → **吸收列吸收余量**(表头 DOM 不再有占位列;规则与机制 = §5.6 的 `dk` 方案,spike S1 实测通过全部情形)。**新代价:吸收余量的那一列没有拖拽把手**(向左拖它本来没有持久效果,向右只是横向撑大;调它左侧的边界拖左邻列的把手) | 给列写 `resizable: false` 可让它不参与吸收(吸收列顺延到前一列) | P0 | 3.11 / 9.6 / 10 |
| B9 | 筛选后分页 | **保持库现状,相对 2.1.1 无变化**:库远程回第 1 页。偏离官方默认 `'current'` 只发生在 remote——官方只在**本地**模式夹页(`use-table-data.mjs:140`:`props.remote ? page : clamp(...)`),remote 下 `'current'` 可能停在不存在的页;本地模式库等同官方 | 宿主传官方 `paginationBehaviorOnFilter` | P0 | 3.8 |
| B10 | 模式 2 默认多一行 chips | 无 → 有条件时多一行 | `filterChips: false` | **P1** | 3.2 |
| B11 | 卡片内边距 | `size="medium"` 内容区 **20 / 24 / 20**(上 / 左右 / 下;无 header 的卡片内容 `padding-top` 取 `--n-padding-bottom`,`card/src/styles/index.cssr.mjs:79-80`)→ **四边 16px**。2.1.1 库里**没有**窄档 12/16(那是原型样式) | `cardProps: { size: 'medium' }`(§4) | P0 | 5.4 |
| B12 | 列宽拖拽下限(只影响开了 `resizable` 的用户) | 固定 60px → 带图标的列取 `max(60, 图标 + 标题最小宽)`(可排序列约 123、仅可过滤列约 102;按 §5.7 的图标布局算)。**前半(下限)P0**;**后半**(表头 `th` 改 `overflow:visible` + 递减 `z-index`、把手骑线,**要在带 `fixed` 列的表上再验证**)归 **P1**,随把手视觉任务(§5.6) | 无 | P0 / P1 | 3.11 |

## 2 缺陷修复(C 级,共 5 项:C1、C2、C3、C5、C6,全部 P0;每个**先写复现测试,再修**)

> C6 是 spike 之后补登记的(第二轮评审 E5)。C4(`activeConditions` 丢弃无值算子)**不在此列**:2.1.1 的 `FilterAction` 里没有 `isNull`,这个缺陷在 2.1.1 不可达,改记为 §3 的「新增」(无值算子是 15 个操作符的前置改动)。编号 C4 空缺,不复用。

| # | 缺陷 | 状态 | 修复后可见影响 |
|---|---|---|---|
| C1 | 多列排序被截成单列(`SmartTable.vue:209-211` 取 `s[0]`;`useColumns.ts:453-456` 回显错) | **真实浏览器已复现**(设计文档 9.4) | 写了 `sorter: { multiple }` 的宿主,箭头与远程参数变正确 |
| C2 | `defaultSortOrder` 被受控 `sortOrder` 盖掉(`useColumns.ts:455-456`) | **已复现** | ⚠ **此前写了却没生效的 `defaultSortOrder` 升级后会突然生效**,CHANGELOG 显著标注并补一句:**静态 data 模式下本地数据也会被排序**。`defaultSortOrder` **只在首次 setup 时从 `columns` 读取**——列异步加载时不生效,请用 `sort()`(规格与 CHANGELOG 都写明)。推导初始排序态时**跳过 `hideInTable` 的列**(搜索专用列) |
| C3 | `filterValueToOptions` 只取 `equal`,静默丢其它条件(`filter.ts:264-268`) | 读源码确认 | options 列带非等于条件时不再丢条件 |
| C5 | `SearchForm` 视口 < 640px 且开启 `collapsible` 时折叠态 0 个字段 | 原型已验证修法 | 折叠可见字段数 `max(1, collapsedRows × cols − 1)`;只有 1 列这一档变化。**取列数的方式**:首选渲染后读 grid 根元素 `getComputedStyle(el).gridTemplateColumns` 的轨道数(纯函数只收轨道数,可单测)——这样宿主用 `NConfigProvider breakpoints` 自定义断点时也对;次选是写死 naive 默认断点并在文档写明不支持自定义断点。**无论哪种,都要修掉 `resolveCols('s:2', 300)` 得 `NaN`** |
| C6 | 宿主在 `<SmartTable>` 上写 `@update:sorter`,点一次表头被调用**两次**:`forwardedAttrs`(`SmartTable.vue:294-299`)没摘掉 `onUpdate:sorter`,它透传给 `NDataTable`,`onSorterChange`(`:213-214`)又手动转发一次 | 读源码确认 | 宿主的 `@update:sorter` 只被调 1 次。修法:从 `forwardedAttrs` 摘掉 `onUpdate:sorter`,只手动转发一次(点击与编程式 `sort()` / `clearSorter()` 共用同一出口);补测试(宿主 spy 恰好被调 1 次);CHANGELOG 登记 |

## 3 新增 API(A 级,不传则与 2.1.1 一致)

| 能力 | 形态 | 优先级 | 设计文档 |
|---|---|---|---|
| 多列排序 | 宿主在列上写官方 `sorter: { multiple: n }`(**大者优先,与点击顺序无关**);库内排序态由单个升为数组;远程参数单列不变,多列**仍带**最高优先级列的 `sortField / sortOrder` 并**另加** `sorts: [{ field, order }…]` | P0 | 4.1 |
| 实例方法 | `sort(columnKey?: string \| null, order: 'ascend' \| 'descend' \| false = 'ascend')`、`clearSorter()`,与官方 `DataTableInst` 同签名(`data-table/src/use-sorter.mjs:105-118`):`!columnKey` 等价 `clearSorter()`;**编程式排序 / 清除后向宿主的 `onUpdate:sorter` 转发一次**,载荷形状与官方一致(单列互斥 = 单个 `SortState` 或 `null`;multiple = `SortState[]`);与 C6 共用同一个转发出口 | P0 | 4.6 / 10 |
| 15 个操作符(纯逻辑) | `FilterAction` 8 → 15(+ `isNull` `isNotNull` `like` `startsWith` `endsWith` `in` `notIn`);类型、求值、labels、序列化、无值算子常量**在 P0 落地**(B7 面板与 C3 要用)。**含原 C4**:无值算子不再被 `activeConditions` 丢弃。列头面板只在宿主显式写 `filter.actions` 时出现新操作符(B7);模式 2 条件构造器默认给下表「推荐集合」(P1)。语义见 §5.9。**是对「条件模型对齐 Bootstrap Blazor」约定的有意扩展**;**类型层面变更**:`FilterAction` 联合 8 → 15,宿主穷尽的 `Record<FilterAction, …>` 会报错(CHANGELOG 单列「类型层面变更」) | P0 | 1 / 3.5 / 10 |
| 新导出(`src/index.ts`) | `NO_VALUE_ACTIONS`、`isValuelessAction`、`actionValueKind`、`isOptionsRepresentable`、`zhCNLabels`;须在对应任务里**真正加进 `index.ts`**,CHANGELOG 的「新增导出」才成立 | P0 | 10 |
| 已生效条件 chips | `filterChips?: boolean`(P0 默认 `false`,显式开启才有;「模式 2 默认开」是 B10,随 P1);`NTag`,超一行折成「+N」 | P0 | 3.2 |
| 「更多」菜单 | `toolbar.more?: DropdownMixedOption[]`(官方 `NDropdown` options 透传);事件 `moreSelect(key, option)`;不传 / 空数组 / 只有分隔线不出现 | P0 | 7.3 |
| 新 labels | **新增键全部声明为可选**(`?:`),2.1.1 已有的键保持必填;`defaultLabels` 给出全部键的英文默认,库内部合并后用 `Required<SmartTableLabels>`;新增导出 **`zhCNLabels`**(完整中文,含 2.1.1 已有键与新键,零依赖),README 中文示例改用它。**P0 新增的 18 个键**(与计划各 Task 一致):操作符名 `filterIsNull` / `filterIsNotNull` / `filterLike` / `filterStartsWith` / `filterEndsWith` / `filterIn` / `filterNotIn`、无值占位 `filterNoValue`;「更多」`more`;漏斗角标 `filterActiveCount`(含 `{n}`);多条件面板 `filterAddCondition` / `filterRemoveCondition` / `filterLogicAnd` / `filterLogicOr` / `filterAdvanced` / `filterSimple`;chips `filterClearAll` / `filterRestoreDefault`。**不新增 `pageSizeSuffix`**(每页条数选择器用官方嵌套,文案自动跟 locale)。面板按钮沿用已有的 `filterConfirm` / `filterReset`,面板 `aria-label` 用列标题 + 已有的 `filter`。P1 的 labels(批量栏 `selectedCount` / `clearSelection`、放大 / 还原等)由 P1 计划补 | P0 | 3.3 / 2.12 / 7.2 / 7.3 / 10 |
| 全局默认页大小 | `SmartTableDefaults.defaultPageSize?: number`(纯新增,B1 的回退入口);`SmartTable` 的 `defaultPageSize` prop 的 Vue 默认值改为 `undefined`,在 computed 里解析(§5.5) | P0 | 10 |
| 存储回退密度 | `loadState(key, fallbackDensity?)`(公开导出,签名向后兼容):存储里没有 density 字段时回退到 `fallbackDensity`(缺省仍是内置默认);`useColumns` 传宿主解析后的 `defaultDensity`。否则写死的回退值会盖过宿主值(B2) | P0 | 5.2 / 10 |
| 卡片透传 | `cardProps?: Partial<CardProps>`,合并在库默认 `size="small"` + `themeOverrides` **之后**,作用于库渲染的所有卡片(表格卡片,以及模式 1 的搜索卡片;实现时核对 `SearchForm.vue:145` 的卡片从哪里拿配置)。B11 的回退入口 | P0 | 10 |
| 撑满父容器高度 | `fillHeight?: boolean`,默认 false;内部映射官方 `flex-height`(`DataTable.d.ts:126`)+ `virtual-scroll` + `min-row-height`(= `ceil(真实行高)`:默认主题下紧凑 `small` 40 / 舒适 `medium` 48;官方默认 28 会让滚到底最后一行看不全;宿主 attrs 的 `minRowHeight` 优先),并传较小的官方 `min-height` 兜底(如 160)。根、卡片、卡片内容区、`NDataTable` 逐层列布局 `flex: 1 1 auto; min-height: 0`。`flex-height` 与 `virtual-scroll` **必须同时传**(只传后者不虚拟化)。**宿主须给根元素的父容器确定高度**(`height: 600px` / `calc(100vh - …)` / 自己是有定高的 flex 列),否则表体塌成 0(只有官方 `min-height` 能兜底)——文档写明 | **P0**(最小实现,原在 P1) | 2.11 / 9.6 / 10 |
| 翻页后回到卡片顶部 | 不开 `fillHeight` 时:**点翻页的当下**(`onUpdatePage` / 跳转输入 / 页码点击的回调里,不等数据回来)判断——卡片顶部已在滚动容器上沿之上(`top < scroll-margin-top`,宿主的固定顶栏用 CSS `scroll-margin-top` 留位)才 `card.scrollIntoView({ block: 'start', behavior: 'instant' })`;卡片可见时不动。滚动容器要沿祖先找出实际的 `overflow: auto / scroll` 元素再比 `top`(宿主 `scroll-behavior: smooth` 下 `instant` 仍立即到位)。开了 `fillHeight` 不需要这段(表体在卡片内滚动,官方翻页回顶 `use-scroll.mjs:207`) | P0 | 9.6 / 10 |
| 触屏兜底 | `@media (hover: none)`(与设计原型一致;**不加** `any-pointer: coarse`,带触屏的 Windows 笔记本它也为 true,会让鼠标用户的图标常显):未激活箭头 / 漏斗 `opacity .5` 常驻(**P0 只做图标淡显**)。触屏 24px 拖拽热区归 P1(§5.6) | P0 | 3.9 |
| 模式 2 条件构造器 | `search: { container: 'table' }`;窄档「输入框 + 筛选抽屉」(2.6a) | P1 | 1 / 2.6a |
| 批量栏 | 插槽 `#batch="{ checkedRowKeys, clear }"`;「已选 N 项 / 取消选择」库内置;**三个条件全满足才出现**:有 selection 列、传了插槽、宿主绑了 `checked-row-keys`(没绑就没有批量栏);不暴露 `checkedRows` | P1 | 2.5a / 2.12 |
| 放大 | `toolbar.maximize?: boolean`,默认 **false** | P1 | 7.2 |
| 窄档专属行为 | `cardOnNarrow?: boolean`,默认 false;列上 `card?: 'title' \| 'meta' \| 'action' \| false`;窄档排序抽屉。**以下窄档专属行为一并归 P2,由 `cardOnNarrow` 门控**:业务按钮折叠成「操作 ▾」、列头面板在窄容器换底部 `NDrawer`、「更多」菜单窄档 44px 选项高。**P0 / P1 下窄容器与宽容器用同一套工具栏与 `NPopover` 面板** | **P2** | 2.7 / 2.12 / 4.5 / 10 |

## 4 布局

- **三档**(按**容器**宽,用 `@container`,不用视口媒体查询):窄 < 600、中 < 1280(模式 2 工具栏单行阈值)、宽 ≥ 1280。模式 1 的搜索网格仍是官方 `n-grid responsive="screen"`(视口口径),不动。**窄档有专属行为的部分(工具栏折叠、面板换 `NDrawer`、卡片)均为 P2(§3 末行)**;P0 里与「窄」有关的只有 B4 的窄档分页(不画每页条数选择器)。
- **卡片内边距**:表格卡片与搜索卡片**四边 16px**(B11),官方做法 `size="small"` + 卡片自己的主题覆盖。**组件级 `themeOverrides` 是扁平形状** `{ paddingSmall: '16px 16px 16px' }`(`_mixins/use-theme.d.ts:23-25`、`card/src/Card.d.ts:90`);`{ Card: { paddingSmall } }` 是全局 `NConfigProvider` 的形状,**不要用在组件级**。只影响库里两张卡片(`SmartTable.vue:571`、`SearchForm.vue:145`)。加 1px 描边,四边到内容 17px。`cardProps` 合并在这套默认之后(§3),回退旧外观 = `cardProps: { size: 'medium' }`。
- **页面底色**是宿主的事;卡片在白底与 `NLayout embedded` 灰底上都必须成立。
- **高度**:默认行为不变;`fillHeight` 开启时根与卡片 `height:100%; min-height:0; flex` 列,表格映射官方 `flex-height` + `virtual-scroll` + `min-row-height`(组合与取值见 §3),忽略并警告 `max-height`;父容器必须有确定高度。不开 `fillHeight` 时整页长滚动,翻页后见 §3「翻页后回到卡片顶部」。

## 5 各块规格

### 5.1 搜索区(模式 2 整体为 P1;模式 1 与 2.1.1 一致)
- 模式 1 `container: 'card'`(默认,不变):独立搜索卡片。模式 2 `'table'`:并入表格卡片的一行条件构造器「字段 + 比较符 + 值」,字段候选 = 声明了 `search` 的列;产出仍是 `FilterValue`,走现成 `filterSerializer`。旧的「只写 `layout:'inline'`」等价 `'none'`。
- 多条件:同字段多条可「且 / 或」(`FilterValue.logic`,**每字段一个值**,改任一条联动全部);**跨字段固定「且」**。
- 比较符按字段类型(text / number / date / select)分发,换字段后不再适用要自动重置;无值算子(`isNull` / `isNotNull`)集中导出常量,`activeConditions`、面板、构造器、chips 都读它。
- 模式 2 宽档严格 1:1(左半搜索、右半按钮 + 图标);值输入框最小 100px。
- 「搜索」是次级(描边)按钮,回车也触发;主色实心留给宿主的「新增」。窄档无「搜索」按钮(回车,`enterkeyhint: 'search'`);枚举字段选完即生效。
- 模式 2 的数据通路(只写 `search` 的列如何派生 `FilterDef`、请求形状、`container` × `layout` 优先级)见 §10 未决清单。

### 5.2 工具栏
- 顺序:标题 · (搜索区)· **宿主业务按钮(`#toolbar-right`)· 「更多」** · 放大(P1)· 刷新 · 列设置。标题始终保留(超宽省略)。「更多」放在业务按钮组末尾、内置图标之前(已定)。
- **刷新**:`toolbar.refresh !== false && isRemote`;静态模式不显示。
- **密度按钮**:默认不显示(B3)。`defaultDensity` **响应式**;没有密度按钮时**忽略存储里的 density**(格式与 `VERSION` 不动),宿主的个人设置才生效。
- **「更多」**(P0):文字按钮 + 下箭头,默认描边、永不主色;**不用「…」图标**(模式 2 条件行已有「»」叫「更多条件」)。菜单选项高 34px、选中后收起、Esc / 点外部收起、与放大 / 列设置气泡互斥;批量栏出现时随工具栏一起被替换。窄档 44px 选项高归 P2。**库不内置导出 / 导入**(官方 `downloadCsv` 只导当前页,`keepOriginalData` 反而忽略过滤;官方 `getFilteredAndSortedData()`(`DataTable.mjs:281`)返回已过滤已排序的**全部行**,但远程模式库手里只有当前页,同样不等于「当前查询的全部结果」),只出菜单外壳。
- **放大**(P1,`toolbar.maximize`):图标「四角括号」;`position: fixed` 铺满 + **`Teleport to="body"`**;层级 `z-index` **默认 1999**(低于 naive 浮层 2000+,所以列头气泡仍盖在它上面)且**必须可配置**(宿主顶栏可能更高;API 形态见 §10 未决)。图标:放大 = 括号向外,还原 = 向内。
- **批量栏**(P1):原地替换工具栏那一行,与工具栏行**共用同一 `min-height`**(勾选不让表格跳动);勾选态读宿主绑的 `checked-row-keys`(库不持有)。
- **对外图标**:只写文档、不加 API;宿主的自定义按钮放插槽里自己选图标。
- 窄档(P2,`cardOnNarrow` 门控):业务按钮折叠成文字按钮「操作 ▾」,点开原位展开一行(不是浮层、**不加动画**);「更多」在展开行里与「新增」等分。

### 5.3 过滤(列头漏斗)
- **漏斗仍由库放在标题内**(`useColumns.ts:464`,DOM 与 2.1.1 一致);面板用官方 `NPopover`(`trigger: 'click'`、`placement: 'bottom'`)。窄容器换底部 `NDrawer`(气泡与抽屉同一份内容,只换容器)**归 P2**,P0 / P1 窄容器同样用 `NPopover`。
- **点漏斗不触发排序**:官方有现成的跳过标记——`TableParts/Header.mjs:107-108` `if (happensIn(e, "dataTableFilter") || …) return`,漏斗触发器加 `data-data-table-filter` 属性即可(官方优先;spike S3 实测 sort=0,没有该属性则触发排序)。**去掉触发器的 `@click.stop`**:它会吞掉宿主挂在 `th` / 祖先上的 click 监听(实测 hostClicks=0),去掉后宿主的监听能收到漏斗点击——**这是行为变化,写进 CHANGELOG**。面板容器上的 `@click.stop`(只挡面板内部 click 冒泡)可保留。
- 面板内容(条件列):「比较符 + 值 + 删除」行、「添加条件」(**上限 5 条**)、≥ 2 条才出现「且 / 或」;宽度 `min(400px, 100vw − 16px)`;底部「重置」(默认,**立即生效并关闭**,语义 = 恢复该列 `defaultValue`,无则清空,与现行 `ColumnFilter.vue` 的 `defaultValue ?? null` 一致)+「确认」(primary),文案**沿用已发布的 labels `filterReset` / `filterConfirm`,英文默认保持 `Reset` / `OK`**(官方 locale 的 `confirm` / `clear` 经公开 API 取不到:`useLocale` 只在内部 `_mixins` 导出),中文宿主用 `zhCNLabels`。面板内改的是**草稿**,确认才提交,Esc / 点外部丢弃;值输入回车 = 确认。**提交时丢弃「无值的有值类条件」**(只选了比较符没填值;无值算子放行);**换比较符后若值的形状不再适用(数组 / 标量 / 无值)清空值**,不做猜测性转换。
- **options 列**:默认勾选;底部「高级条件」展开同一份多条件编辑。**不丢信息**:新增纯函数 `isOptionsRepresentable(value)`(`filter.ts`,可单测,从 `index.ts` 导出)——所有有效条件均为 `equal` 且(`logic === 'or'` 或仅一条),或恰好一条 `in`,才可用勾选无损表达;否则打开时自动展开高级条件原样显示。勾选形态提交写 `equal` 取「或」(序列化不变)。**一条 `in` 经勾选面板回写会变成若干 `equal` 取「或」**:语义相同、序列化形状变,CHANGELOG 必须写明。面板测试要含 `type: 'select'` 且值为 `isNull` 的用例。
- **键盘 / 焦点 / 可访问性**(真实 `NPopover` 不管键盘,设计文档 9.1;写法已由 spike S3 在真实浏览器实测,设计文档 9.6):
  - 打开后焦点移到第一个可编辑控件;**宿主自定义面板(`def.render`)跳过自动聚焦**(不抢焦点),面板打开期间 Esc 仍关闭:焦点在面板内、或还停在漏斗按钮上都生效(**漏斗触发器在面板打开期间也处理 Esc**:关闭、丢草稿、焦点留在漏斗;否则焦点留在触发器时 keydown 到不了面板上的捕获监听)——CHANGELOG 写明(不是「行为不变」)。
  - 面板容器 `tabindex="-1"` 即可——鼠标点面板空白处天然聚焦容器,随后 Esc 正常(**不需要 mousedown 处理**);容器需要 `outline:none` 或自己的聚焦样式。不设 `tabindex` 时点空白后焦点落 body、Esc 无反应(实测)。
  - **面板内有展开的 `NSelect` / `NDatePicker` 下拉时,面板忽略 Esc,且 Esc 必须在 capture 阶段监听**(面板根上 `@keydown.capture`):官方这两者按 Esc 关自己的下拉时只调私有的 `markEventEffectPerformed`、不 `stopPropagation`(`select/src/Select.mjs:620-625`、`date-picker/src/DatePicker.mjs:320-331`),而冒泡阶段它们已先把自己关掉——实测「无条件 close」与「冒泡 + `@update:show` 展开标志」两种写法都会把整个面板关掉(草稿丢失),只有 capture 阶段 + 展开计数能做到「只关菜单、面板与草稿仍在」。展开计数用**计数器**(面板里多行、每行有 2 个下拉控件),在每个 `NSelect` / `NDatePicker`(含比较符下拉)上监听 `@update:show`,面板开合时清零;计数 > 0 时放行,否则 `stopPropagation` + 关闭。teleport 出去的日历面板内部有焦点时按 Esc 什么都不发生(官方行为,不会误关面板)。
  - 轻量焦点循环:Tab 离开最后一个可聚焦控件回到第一个,Shift+Tab 反之(`role="dialog"` 的常规做法;不丢草稿)。
  - Esc(无下拉展开时)关闭、丢草稿、焦点还给漏斗;漏斗触发器上的 Esc 同样处理(面板开着时),覆盖自定义面板焦点仍在漏斗的情形。
  - 漏斗按钮 `aria-haspopup="dialog"`、`aria-expanded`、`aria-label`(含「已筛选 N 条」);面板容器 `role="dialog"` + `aria-label`(列标题 + labels 文案,**渲染期求值**)。均走 labels。
  - 必补测试:「select 展开时 Esc 只关菜单、面板仍在、草稿仍在」「Tab / Shift+Tab 循环」。
- 漏斗激活态 = 库自己的 `isFilterActive`,颜色取官方主题变量 `thIconColorActive`;同列 > 1 条加条数角标,**样式 = 纯数字**,文字色取 `useThemeVars().baseColor`(亮 `#FFF` / 暗 `#000`)经 `:style` 绑定(写死 `#fff` 暗色下叠在主色 `#63e2b7` 上约 1.4:1,不可读)。**不用**官方 `renderFilterMenu`:用 `renderFilter` 时触发器虽不带绝对定位 class(`HeaderButton/FilterButton.mjs:112-121`),但 DOM 顺序仍是「标题容器(含排序箭头)→ FilterButton」(`TableParts/Header.mjs:219-226`),做不出「标题 → 漏斗 → 箭头」(设计文档 3.10)。
- **chips**(`filterChips`,P0 默认关):`NTag` `round` `closable` `size="small"`;点击重开对应列面板,× 删这一条;行末按钮:表里有任何列声明 `defaultValue` 时「恢复默认」(`clearFilters()`,语义不变),否则「清除全部」;超过一行折成「+N」,点它在气泡里展开,`+N` 让位后**重测一次**,避免 `+N` 自己折到第二行;**连「首个 chip + `+N`」都放不下时只显示 `+N`**(全部 chip 进气泡),`+N` 始终在第一行;同字段第 2 条起「或」加前缀。chips 是工具栏下方独立一行,批量栏只替换工具栏那一行。**孤儿键**:state 里有、列声明里已不存在的过滤键也要生成 chip(标题回退为 key,点击不开面板,× 可清;否则它仍进远程请求参数却看不见也清不掉),「清除全部」同样渲染。chips `role="button"`、`tabindex="0"`,Enter / Space 等同点击。需补 SmartTable 层测试。
- `filterSerializer` 默认格式不变(`{ filters: [{ field, logic, conditions }] }`);新 action 取值**只在宿主显式开启(列上 `filter.actions`、模式 2 构造器)时才会出现**,老配置的后端不会收到(D1);保留自有 `setFilter(key, FilterValue)`(官方 `filters()` 表达不了条件)。
- 筛选后分页:宿主显式传官方 `paginationBehaviorOnFilter` 就照官方;没传保持库现状(远程回第 1 页;**本地模式 / 静态数据等同官方夹页 = `'current'`**)。理由见 B9。

### 5.4 排序
- 多列见 §3。**默认排序**用官方列上 `defaultSortOrder`(多列配 `multiple`),库按列推导初始排序态并带进首次请求(修 C2);推导是**库的选择**(官方初值不做单列互斥,`use-sorter.mjs:31-37`),跳过 `hideInTable` 的列,只在首次 setup 读取(异步列请用 `sort()`)。
- **点击循环 = 官方「降序 → 升序 → 取消」**(`data-table/src/utils.mjs:74-77` `getNextOrderOf`:无排序时首次点击是**降序**)。库 2.1.1 本来就跟随官方,**不改代码、不进 CHANGELOG**。(设计文档早期写的「升 → 降 → 取消」是手写原型里的假设,已更正。)
- `sort()` / `clearSorter()` 的签名与通知见 §3「实例方法」。
- 默认**不显示优先级序号**(官方无;真觉得看不懂再用官方 `renderSorterIcon` 增强,不另造面板)。
- **排序态不持久化**(与过滤态一致,会话态)。
- 官方排序表头**本来就无键盘操作**(无 `tabindex`,Enter 不排序),**本期不解决**。
- 窄档无表头:筛选 / 排序入口 → 底部抽屉(可排序列各一行,「无 / 升序 / 降序」分段,行序 = 声明的优先级;手机上不能改优先级,只能启停)。(P2 随卡片模式;入口放在工具栏行 1 还是行 2 三处文档不一致,见 §10 未决)

### 5.5 分页(B4、B1)
- 所有宽度统一官方 `NPagination simple`(输入框 / 总页数)。**官方 `simple` 不带每页条数选择器和快速跳页**(`Pagination.mjs:665,682`),`pageSizes` / `showSizePicker` 要由库映射到 `suffix` 里的选择器。
- **每页条数选择器 = 官方嵌套 `NPagination`**(spike S2 实测通过,设计文档 9.6):外层 simple 分页的 `suffix` 里嵌一个非 simple 的 `NPagination`:`suffix: info => h(NPagination, { displayOrder: ['size-picker'], showSizePicker: true, pageSizes, pageSize: info.pageSize, itemCount: info.itemCount, page: info.page, onUpdatePageSize })`(`pagination/src/Pagination.mjs:68`、`:481`,2.32.2 引入,在 peer `^2.34.0` 内)。**不传 `onUpdatePage`、不传 `size`**(表格 small / medium 下分页条都是 28px,选择器与外层同一行同高);选项文案 `${size} / ${locale.selectionSuffix}`(`:166-175`)自动跟 `NConfigProvider` locale(zh「页」/ en「page」),`{label, value}` 选项原样显示。**删掉手写 `pageSizePicker`,不新增 `pageSizeSuffix` label**。三个已知点:① 受控下内层的越界夹页**永远不触发**(内层用的还是旧 pageSize),改每页条数后的页码重置必须由库做——远程模式在 `onUpdatePageSize` 里 `page = 1`(`useSmartTable` 语义已有);本地模式 Naive 外层会静默把页夹到最后一页、**但不发 `onUpdatePage`**,库的 `localPage` 会陈旧 → 改每页条数时库自己把 `localPage` 置 1 并同步表格页码;② 当前 pageSize 不在 `pageSizes` 里时官方显示裸值 → 传给内层的 `pageSizes` 并入当前值(显示「15 / 页」,并正确标记选中);③ 窄容器:卡片内宽 ≤ 340 会折成多行 → 窄档随 `narrowPager` 整个不渲染 `suffix`。
- **无论哪种,以下 6 处回归必修,各补测试**:
  1. 宿主单表 `pagination.showSizePicker: false` 在 simple 下也要生效 → 取 `user.showSizePicker ?? defaults.showSizePicker`;
  2. `pageSizes` 里的 `{label, value}` 对象不得被丢(不能 `.filter(s => typeof s === 'number')`);
  3. 本地模式库自画选择器改每页条数时要转发宿主的 `onUpdatePageSize`;
  4. 本地模式宿主 `pagination.defaultPageSize: 20` 不得被库的受控 `pageSize` 盖掉 → `localPageSize` 初值取 `user.pageSize ?? user.defaultPageSize ?? 库解析出的默认`;
  5. 远程模式宿主传 `pagination.pageSize: 10` 时,分页条与首个请求要一致 → 把 `user.pageSize` 同步为 `useSmartTable` 的初始 pageSize,补远程测试;
  6. `simple: false` 回退时,若当前 pageSize 不在 `pageSizes` 里,官方选择器显示**裸值**(如「15」,没有「/ 页」后缀,展开后也不标记选中;spike S2 实测,不是空白)→ 该分支也并入当前值。
- **默认每页条数的解析优先级**(B1):实例 `defaultPageSize` prop > 实例 `pagination.pageSize` / `pagination.defaultPageSize` > 全局 `SmartTableDefaults.defaultPageSize` > **宿主(实例或全局)显式给了 `pageSizes` 时取 `pageSizes[0]`(对象取 `.value`)** > 库默认 100。`SmartTable` 的 `defaultPageSize` prop 的 Vue 默认值改为 `undefined`,在 computed 里解析(为了能判断「宿主没给」)。
- **现状基线(真实生效点)**:每页条数 `src/SmartTable.vue:62`(`default: 10`)、`src/useSmartTable.ts:32`(`?? 10`)、`src/config.ts:75`(`pageSizes: [10, 20, 50]`);`types.ts:244` 只是注释。**无 UI 的导出 hook `useSmartTable` 的默认 10 不动**(它不画分页条,B1 只针对 `SmartTable` 组件)。
- 总条数在 `prefix`(宿主 `#pagination-prefix` 插槽提供,库默认没有);窄档(容器 < 600)不提供 `suffix`,保留总条数,单行 40px(B4 的 `narrowPager`,P0)。
- 代价(用户已接受):看不到页码序列、不能一眼点第 N 页。

### 5.6 列宽拖拽(`resizable`,库已有能力,2.1.0)
- **把手视觉(P1)**:把手用官方结构但**静止不画线**,悬停 / 拖动才出现主色竖条(高度 70%),光标 `col-resize`;热区 11px 骑在列界线上(触屏 24px,**触屏热区 CSS 与现有 `::after` 竖条错位、伸进下一列的一半被后一个 `th` 盖住,须与 B12 后半一起做**);拖动时一条贯穿整表的 1px 引导线;松手后 150ms 内吞掉 click,不误排序;拖动开始收起过滤气泡。**整块归 P1 视觉任务**;P0 只做 §5.7 的图标间距 / 右内边距与 B12 前半的下限。
- **吸收余量 = `dk` 方案**(spike S1 在真实 `NDataTable` 上通过全部情形,容器 1000 与 700 各一次,设计文档 9.6):
  - R1 **吸收列** = 最后一个可见、`fixed` 为空、`resizable !== false` 的叶子数据列(被列设置隐藏的不算);没有这样的列(全部 fixed 或都不可拖)→ 退路:最后一个可见叶子列(fixed 也取)。宿主给「操作」列写 `resizable: false` 即退出吸收,**不需要新 API**;`fixed:'right'` 的操作列天然不参与。
  - R2 第一次按下任一把手时 `freezeWidths`:所有可见叶子列与特殊列冻结成实测宽(四舍五入),**唯独跳过吸收列**。
  - R3 钉住后:非吸收列 `width = widths[k] ?? col.width ?? col.minWidth ?? 兜底宽`;吸收列**不写 width**(弹性),下限取声明宽 / `minWidth`(**不冻结成实测宽**——冻结值是 Naive 未钉住时摊出来的,成了下限,拖别的列时吸收列不肯缩,实测溢出 61px);**吸收列永远传 `resizable: false`**(含未钉住时)。
  - R4 退路(全部 fixed / 都不可拖):吸收列 = 最后一个叶子列,显式宽 `max(下限, 容器 − 其余列宽之和 − dragDelta)`,同样不冻结(需量滚动容器 `clientWidth`,`tableKey` 变化后重量)。
  - R5 `scroll-x`(钉住后)= Σ非吸收列宽(含特殊列)+ 吸收列下限(退路用 R4 的显式宽)+ `dragDelta`,必须始终 ≥ Σ下限(`scroll-x` 小于容器时官方会把各列按比例拉伸,钉住的宽度不被遵守,设计文档 9.3);`dragDelta = limitedWidth − widths[拖拽列]`(每帧),松手清零;拖拽期间不重建列数组,只有 `scroll-x` 随帧变。
  - R6 **重挂**:Naive 把拖过的列记进内部 `resizableWidthsRef`(`use-resizable.mjs:5-16`;`use-group-header.mjs:24`、`utils.mjs:38-43`:此后 `<col>` 的 width / min / max 全用拖拽值,不看 `column.width`,也不看 `column.resizable` 现在是什么),**且没有清除入口**(`clearResizableWidth` 不在 `exposedMethods` 里,`DataTable.mjs:269-287`),唯一办法是重挂。库维护 `draggedKeys`(本次挂载期间触发过 `onUnstableColumnResize` 的列 key,每次 `tableKey` 变化清空);吸收列身份变化时(隐藏 / 显示 / 调顺序 / 设固定 / columns 变化),若新吸收列 ∈ `draggedKeys` → `tableKey++`。从 storage 恢复的宽度不在 Naive 里留残留,不需要重挂。
  - R7 吸收列身份变了之后,旧吸收列(从未被冻结)退回声明宽(实测 189 → 150,无留白),可接受。
  - **新代价(需用户确认,可推翻)**:**吸收余量的那一列没有拖拽把手**(设计文档 3.11 原预期「最后一列仍可拖」)——向左拖它本来没有持久效果、向右只是横向撑大;要调它左侧的边界就拖左邻列的把手。备选 `da`(吸收列拖拽结束即 `tableKey++`)最终结果也对,但向左拖时其余列临时被拉宽 16–43px、松手后横向 `scrollLeft` 跳回 0,被否决。
  - **被作废的做法**(已实测的反例,不要再提):「吸收列不写宽度 + `scroll-x` = 各列下限之和」单独用,在拖吸收列往窄、先被拖过的列变成吸收列、全 fixed 末列等情形失效(其余列被拉宽);规格早期的「吸收列冻结成当前渲染宽」在最普通的拖非吸收列就溢出;「钉住态下吸收列 `resizable:false`」更糟(第一次拖的正是吸收列时首帧后把手被卸载、拖拽中断、Naive 已记下残留宽度)。
  - 已知代价(沿用):拖拽起点取**此刻实际渲染宽度**;表头 DOM 不再有占位列。
  - 与 `flex-height` + 虚拟滚动叠加时结果逐项相同;钉住后容器宽变化(1000 → 1300 → 600 → 1000)吸收列跟着填满 / 落到下限 / 复原。
- 图标不被把手挤:右内边距 16px;拖拽下限见 B12。
- 宽度随 `storageKey` 持久化(已有)。

### 5.7 密度与表头图标
- 默认 `compact`,映射官方 `size`:舒适 = `medium`、紧凑 = `small`。行高舒适 45 / 紧凑 37。
- 图标顺序 **标题 → 漏斗 → 排序箭头**。**P0**:间距 8 / 6px 与表头右内边距 16px(纯 CSS;B12 的下限 93 / 102 / 123 就是按这个布局算的。现状是漏斗 `margin-left:4px`、`.smart-table-th gap:2px`);闲置 `opacity: 0`(仍占位,不回流),悬停该列表头 / `:focus-within` 淡入(0.15s);常驻例外:正在排序的列箭头、已筛选的列漏斗、面板打开的那一列漏斗。用官方类名 `.n-data-table-th .n-data-table-sorter` 写 CSS 即可(已验证)。
- 落地 CSS 要求:① 常驻例外的选择器优先级**不得低于**隐藏规则(例:隐藏规则 `.smart-table :deep(.n-data-table-th .smart-table-filter-trigger)` 是 (0,4,0),例外规则要写成 `.smart-table :deep(.n-data-table-th .smart-table-filter-trigger--active)` 同级或更高,否则已筛选 / 面板打开的漏斗不常驻);触屏兜底里同理;② 排序箭头的过渡写成 `transition: opacity .15s, color .3s var(--n-bezier)`(只写 `opacity` 会覆盖 Naive 自带的 `color` 过渡)。

### 5.8 窄档卡片(P2,`cardOnNarrow`)
- 列 → 卡片字段:默认零配置(第一个数据列作标题,其余「标签:值」两列,操作列放底部);列上 `card` 覆盖。**操作列 = `card: 'action'`,否则最后一个 `fixed: 'right'` 的列**。
- 卡片固定**舒适间距**(不响应密度);无描边,8px 间距 + 极淡底色 + 「操作」行上方 1px 分隔线;勾选框在右上角,热区 44×44;「编辑 / 删除」44×44;字段值单行省略(虚拟滚动需要等高)。
- 点卡片 = 现有 `rowClick`;列设置里隐藏的列卡片里同样隐藏。窄档总行数 2 行(行 1 标题 + 操作 + 三图标,行 2 输入框 + 筛选;「排序」入口的位置见 §10 未决)。

### 5.9 条件模型:15 个操作符
对「条件模型对齐 Bootstrap Blazor」约定的**有意扩展**:`FilterAction` 由 8 个扩到 15 个,`FilterLogic = 'and' | 'or'` 不变;求值与远程序列化在 `filter.ts`(UI 无关、可单测)。扩操作符要同时动:`types.ts` 枚举 → `filter.ts` 求值 → `labels.ts` 文案 → 测试。

| 操作符 | 值形状(`actionValueKind`) | 语义 |
|---|---|---|
| `equal` `notEqual` `contains` `notContains` `gt` `gte` `lt` `lte` | 标量 | 2.1.1 原样不变 |
| `isNull` / `isNotNull` | **无值**(`NO_VALUE_ACTIONS`) | 单元格为空 = `null` / `undefined` / 空白串 / 空数组;`0`、`false` 不算空;`isNotNull` 取反 |
| `startsWith` / `endsWith` | 标量 | 忽略大小写的前缀 / 后缀匹配;单元格为 `null` / `undefined` 不匹配 |
| `like` | 标量 | SQL `LIKE`:`%` 任意长度、`_` 单个字符,**整串匹配、忽略大小写**,其余字符按字面量(`a.c` 不匹配 `abc`);空单元格不匹配 |
| `in` / `notIn` | **数组** | 单元格与其中任一项 `equal`(沿用 `equal` 的跨类型与整天语义)即命中;`notIn` 取反;空单元格时 `notIn` 为真(与 `notEqual` 一致);值不是数组 → `in` 为假;空数组的 `in` 不生效 |

- **无值算子**(原 C4):值为空也算「写了」,`activeConditions` 不得丢弃,序列化与求值都要带上;有值类算子的空值仍被丢弃(口径不变)。
- **未知 action 一律 fail-closed**(按不匹配处理,`filter.ts:189-192`):fail-open 会让 `or` 逻辑下整列过滤被一条脏条件悄悄短路成「放行全部」。(原型 `design.html` 的求值写成 `default: return true`,与此相反,**以 fail-closed 为准**。)
- **列头面板默认集合 = 2.1.1 原样**(`useColumns.ts:110-115` `DEFAULT_ACTIONS`,**保持不变**):input:`contains / notContains / equal / notEqual`;number、date:`equal / notEqual / gt / gte / lt / lte`;select:`equal / notEqual`。宿主在列上显式写 `filter.actions` 才会出现新操作符。
- **推荐集合**(宿主显式写 `filter.actions` 时的参考;**模式 2 条件构造器(P1)默认使用**):input:`contains / notContains / equal / notEqual / startsWith / endsWith / like / isNull / isNotNull`;number、date:`equal / notEqual / gt / gte / lt / lte / isNull / isNotNull`;select:`equal / notEqual / in / notIn / isNull / isNotNull`。

## 6 落地必须满足的要求(来自验证,设计文档第 9、10 节)

1. **放大**(P1):切换前记下表格 `scrollTop`,切换后恢复(Teleport 搬 DOM 会清零);切换后把焦点还给按钮(**是否只在键盘操作时才还**见 §10 未决——无条件还会复现用户已反馈的黑色焦点环);放大期间锁背景滚动(`html { overflow: hidden }`,退出还原原值);`z-index` 可配置。
2. **列头面板**:自己管焦点与 Esc(见 §5.3)。
3. **分页**:`suffix` 放官方嵌套 `NPagination`(`displayOrder: ['size-picker']`),6 处回归必修,改每页条数后库自己重置页码(§5.5)。
4. **余量**:`dk` 方案(§5.6),通过 S1 全部情形;吸收列没有拖拽把手写进 CHANGELOG。
5. **批量栏**(P1)与工具栏同一 `min-height`。
6. 所有新文案走 `labels.ts`、渲染期求值;新键可选、库自带英文默认、中文走 `zhCNLabels`(§3)。
7. **CHANGELOG** 必须显著标注(顶部提示框含 C2):
   - B1–B12 每项带回退方式,**B1 单列后端上限风险**,并补「需要卡片内滚动请传 `fillHeight`」,以及「不开 `fillHeight` 时点翻页 / 改每页条数后,若卡片顶部已滚出视口上沿,页面会自动滚回卡片顶部」(默认开启的行为变化;只在需要时滚);
   - **C2**(`defaultSortOrder` 突然生效;静态 data 也会排序;只在首次 setup 读取,异步列请用 `sort()`);
   - **B2**:旧存储密度不再覆盖宿主值;开了 `toolbar.density: true` 时存储里已有的旧值继续生效(B2 / B3 各补一句);**`loadState` 是公开导出:不传第二参数时,缺 density 字段的返回值由 `'comfortable'` 变 `'compact'`,回退写法是传 `'comfortable'`**(写进 B2 行,不要只放「内部」);
   - **B7**:「新操作符需在列上 `filter.actions` 显式开启」(**不再写「7 个新 action 给后端注意」**);**`in` 经勾选面板回写会变成若干 `equal` 取或**(序列化形状变);自定义面板(`def.render`)不自动聚焦,面板打开期间 Esc 会关闭(焦点在面板里、或还在漏斗按钮上都行);
   - **B8**:表头 DOM 不再有占位列;**吸收余量的那一列没有拖拽把手**(新代价;**即使还没拖过列宽、表格还没钉住时也没有**);**给列写 `resizable: false` 可让它不参与吸收**(吸收列顺延到前一列);
   - **B4**:simple 下 `showQuickJumper` / `pageSlot` 不再生效;每页条数选择器是官方嵌套 `NPagination`(文案跟 `NConfigProvider` locale);
   - **C6**:宿主 `@update:sorter` 此前点一次表头被调两次,现在只调一次;
   - **漏斗点击**:去掉触发器的 `@click.stop` 后,宿主挂在表头祖先上的 click 监听现在能收到漏斗点击(行为变化);
   - `fillHeight` 文档写明「父容器必须有确定高度」,且开启时忽略并警告宿主的 `max-height`;
   - 「新增」一节含原 C4(无值算子);新增导出(`NO_VALUE_ACTIONS`、`isValuelessAction`、`actionValueKind`、`isOptionsRepresentable`、`zhCNLabels`)须与 `index.ts` 一致;新增 `SmartTableDefaults.defaultPageSize`、`cardProps`、`fillHeight`;
   - 新一节「**类型层面变更**」:`FilterAction` 联合 8 → 15,宿主穷尽的 `Record<FilterAction, …>` 会报错;
   - 注明「只在 naive-ui 2.45.3 上验证过」;
   - README / README.en 里 B 级涉及的默认值(每页 10、密度 comfortable、密度切换按钮等)与新增的 `zhCNLabels` / `cardProps` / `fillHeight` 用法同步更新(npm 会把 README 随 beta 展示,不能与 CHANGELOG 矛盾)。

## 7 测试要求(你的规则:无覆盖先补回归测试再改)

- **先锁住当前行为**:分页默认值与 `pageSizes`、密度默认与存储回退、`activeConditions` / `filterValueToOptions`、排序回显与远程参数、`storageKey` 读写、占位列(2.1.1 刚发布)。B 级翻转对应的特征测试与该 B 级变更**同一个提交**里有意翻转(例:`tests/config.test.ts:22` 锁 `pageSizes` 为 `[10,20,50]`,B1 落地后必须翻成 `[100, 500, 1000]`)。
- C1、C2、C3、C5 每个先写复现测试;`isOptionsRepresentable` 各分支(`notEqual` / `isNull` / `and` 多 `equal` / 单 `in`);同字段「或」;无值算子;`defaultSortOrder` 进入首次请求(**含静态 data 模式**);多列远程参数;单列行为回归;`sort()` / `clearSorter()` 转发 `onUpdate:sorter` 的载荷形状(单列 / multiple);孤儿键 chip;面板 Esc / Tab 循环(§5.3)。
- C6:宿主 `@update:sorter` 的 spy 点一次表头恰好被调 1 次(点击与 `sort()` / `clearSorter()` 各一条);`loadState(key, fallbackDensity)` 的回退;
- 分页 6 处回归(§5.5)各一条;本地模式改每页条数后 `localPage` 置 1;默认页大小解析优先级各一条(含只写 `pageSizes`、全局 `defaultPageSize`)。
- 列宽(真实浏览器,**必须覆盖**):拖非吸收列、(吸收列无把手,确认不可拖)、隐藏最后一列、先拖 B 再让 B 成为吸收列(应重挂一次)、全部 fixed、含 `fixed:'right'` 操作列、未 fixed 且 `resizable:false` 的操作列;拖拽过程中其余列不动、被拖列 1:1 跟手、无溢出。
- `fillHeight`:父容器定高下填满、分页条在底部可见、DOM 行数远小于每页行数、滚到底最后一行完整可见(`min-row-height` 取 `ceil(真实行高)`);不开时翻页回卡片顶部(只在卡片顶部已滚出视口时滚)。
- 容器宽 390 / 560 / 720 / 1024 下工具栏 `scrollWidth ≤ clientWidth` 且控件 `right ≤ 内容区右边界`;分页在真实浏览器里渲染、选择器、翻页。
- 落地后**另建基于真实组件的视觉基线**(`docs/baseline/` 只是原型的)。

## 8 YAGNI —— 明确不做

`headerIcons: 'always'` 开关;`sortSerializer`;图标注入 API;只读排序态对外暴露;双击把手重置列宽;手机上调整排序优先级;卡片模式自动开启;官方 `renderFilterMenu` 承载;优先级序号(除非实测看不懂);排序 / 过滤态持久化。

## 9 未验证(诚实清单,落地前后要补)

- 只测了 Chromium:**Firefox / Safari** 未测(`@container`、`@media (hover: none)`、Teleport 后滚动恢复)。只在 naive-ui **2.45.3** 上验证过。
- 真实手指触屏、屏幕阅读器。
- **第二轮 spike(设计文档 9.6)的未测项**:S1 多级表头(`children`)下的吸收列、勾选 / 序号 / 展开等特殊列钉住态下与吸收列的联动、触屏拖拽、`minWidth` 夹紧与吸收列下限同时生效的边界、宿主传 `scroll-x` / `table-layout` 覆盖;S2 选项很多时的菜单滚动 / RTL、宿主自定义 Select `theme-overrides`;S3 多行条件下的下拉计数、`NInputNumber` / 多选 tag 的 Esc、屏幕阅读器朗读 `role="dialog"`、`daterange` 日历内按 Esc、窄档抽屉(P2);S4 `fillHeight` 下翻页后 `scrollTo({ top: 0 })` 复位表体、横向滚动 + 虚拟滚动的表头联动、宿主自定义 `themeOverrides` / 多行文本 / `ellipsis` 下的行高估计、`loading` 遮罩位置。
- 放大:宿主真实 z-index、`ResizeObserver` 与 Teleport 配合、虚拟滚动下滚动恢复。
- 列宽:真实触屏手指拖拽;Firefox / Safari 下的拖拽。
- 多条件面板(B7)在真实 `NPopover` 里的整体表现;「更多」菜单的方向键(依赖官方 `NDropdown` 的 `keyboard`,只确认属性存在);批量栏里「更多」不显示(只读了代码)。
- 卡片模式(P2)、批量栏在真实 `NDataTable` 上(`fillHeight` 已由 S4 覆盖)。
- B9 保持库现状(remote 回第 1 页,本地等同官方夹页),需在文档与 CHANGELOG 里写明。

## 10 P1 未决清单(第二轮评审登记,本轮不解决,供 P1 计划用)

- **放大**:z-index 可配置的入口(规格要求可配置,但 API 只有 boolean `toolbar.maximize`);Esc 分层(先收气泡 / 抽屉再还原);**「只有键盘操作才还焦点」**(设计文档 7.2 表格「焦点环」一行的做法;§6.1 若写成无条件会复现黑色焦点环);Teleport 与 `@container` 判档的落点(Teleport 的对象须是带 `container-type` 的根本身);设计文档 7.2「落地风险」4–6。
- **模式 2 数据通路**:只写 `search` 的列如何派生 `FilterDef`;模式 2 请求形状 vs `@search` 扁平 params;`container` × `layout` 的优先级与 `'none'` 的定义。
- **窄档卡片第 2 行到底含不含「排序」**:本文 §5.4 / §5.8、设计文档 4.5(工具栏行 1 图标)与 4.8(行 2 文字按钮)三处不一致,P2 计划前要统一。
