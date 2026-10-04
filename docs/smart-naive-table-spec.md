# SmartTable 3.0.0 现状规格

> **这份文档只写「当前结论」**:要做什么、默认值、API、落地必须满足的要求、验证状态。§1–§5 描述的是已落地的实现(与 `src/` 对照过,冲突处以实现为准);标明 P2 的条目见各节说明。
> 决策过程、备选方案与理由见 [`smart-naive-table-design.md`](./smart-naive-table-design.md)(下称「设计文档」,括号里的 `x.y` 指它的小节)。**两份冲突时以本文为准,并回去修正设计文档。**
> 状态:当前版本见 `package.json`(`3.0.0`);P0 / P1 / P2(窄档卡片 `cardOnNarrow`)均已实现,列头筛选的窄档抽屉未做(§5.8)。基线库版本 2.1.1,目标 **3.0.0**。
> 行号约定:文中标「现状」或「2.1.1」的 `文件:行号` 指 **2.1.1 源码**里的位置(记录缺陷 / 改动点的出处),不随实现更新;naive-ui 的 `文件:行号` 取自本仓库实装的 2.45.3(行号会随 naive-ui 版本漂移,引用前重新 grep)。描述已落地实现时尽量用函数名 / 类名,不用行号。
> **外观对齐**:库的外观与设计原型 `docs/smart-naive-table-design.html` 保持一致(原则:外观以原型为准改库、功能取并集、与官方冲突改原型);逐项对比工具是 `/prototype.html`(真实库复刻原型各模块,不进发布包)与 `tools/parity`。
> 阶段标记:**P0** = 基础范围(3.0.0 的「基础部分」);**P1** = 之后追加(模式 2、批量栏、放大、把手视觉等);**P2** = 窄档卡片及相关窄档行为。
> spike S1–S4(实测与代码见设计文档 9.6 与 `docs/spike/s5`–`s8`)的结论已写进本文的机制细节;未覆盖的项见 §9。

## 0 总则

1. **官方优先**:naive-ui 有的就用官方(组件、属性名、主题变量),以本地 `node_modules/naive-ui` 的类型与源码为准(本仓库实装 2.45.3),不凭记忆。官方没有的才自有扩展,并在文档里交代理由。本库的单测与浏览器验证在 naive-ui **2.45.3** 上跑(peer 范围 `^2.44.0`),其它版本未测。
2. **macOS 简洁**:克制留白、轻分隔、次级操作降级(悬停显现)、一屏一个主色按钮、动效只用 opacity / 背景 / 边框、明暗两套(走主题变量,不硬编码颜色)。
3. **兼容规则**:新能力 = 新增可选属性;**默认行为变更必须进 CHANGELOG 并带回退方式**(B 级登记 12 条,见 §1);不改现有导出。
4. **零新依赖**;图标是库内联 SVG(`icons.ts`,零图标库依赖)。
5. **列驱动**:搜索项、过滤器、字典渲染都从 `columns` 派生,不另开并行配置。
6. **labels 渲染期求值**(不在 setup 期解成字符串,否则切语言失效)。
7. **`var(--n-*)` 主题变量只在对应 naive 组件的子树内有效**;库自己的元素(如角标)要用 `useThemeVars()` 取值再经 `:style` 绑定。

## 1 默认行为变更(B 级,升 major 的理由)

登记 12 条(B1–B12)。其中 **B9 相对 2.1.1 没有变化**(保持库现状、对官方默认的有意偏离,登记是为了写进文档与 CHANGELOG),**B10 只在模式 2 下才有**。所以相对 2.1.1 实际变化的是 B1–B8、B10(仅模式 2)、B11、B12 共 11 条。

| # | 变更 | 旧 → 新 | 回退方式 | P | 设计文档 |
|---|---|---|---|---|---|
| B1 | 默认每页条数与页大小 | 10 → **100**;`[10,20,50]` → **没开 `fillHeight` 的表格 `[100,500,1000]`,开了 `fillHeight` 的 `[100,1000,10000]`**。宿主(实例或全局)显式给了 `pageSizes` 时照宿主的、不分 `fillHeight`。依据:Edge 实测(1440×900),不开 `fillHeight` 时一页 10000 行切换 9.4s、排序 22.8s、堆 1.3GB;开了约 45ms。落点:`config.ts` 的 `BUILTIN_DEFAULTS.pageSizes`(没开 `fillHeight` 的兜底)与 `pageSize.ts` 的 `FILL_PAGE_SIZES` / `resolvePageSizes`。⚠ 远程模式请求的 `pageSize` 变 100,**后端若限制 `pageSize` 上限会拒绝**,CHANGELOG 单列;需要卡片内滚动请传 `fillHeight`(§3)。解析优先级见 §5.5 | 实例 `defaultPageSize` / `pageSizes`;**全局 `SmartTableDefaults.defaultPageSize`(新增)**;宿主只写了 `pageSizes` 时默认取它的第一项 | P0 | 2.11 |
| B2 | 默认密度 | `comfortable` → **`compact`**(`BUILTIN_DEFAULTS.density`);**没有密度按钮时,`storageKey` 里存的密度不覆盖宿主值**(`useColumns` 只在 `respectStoredDensity`,即 `toolbar.density === true` 时才读存储里的 density)。**写入端**:保存列设置 / 列宽(以及列被移除时清理陈旧宽度)写回的是**存储里原有的 density**(`peekStoredDensity` 读出,没有记录就不写该字段),绝不把当前密度 / 宿主值写进去;只有 `setDensity`(密度按钮)才写新值;「恢复默认」清空存储并忘掉这份记录。**存储回退**:`loadState` 在存储没有 density 字段时回退到可选第二参数 `fallbackDensity`(缺省 `'compact'`,§3;2.1.1 写死 `'comfortable'`) | `defaultDensity="comfortable"` | P0 | 5.1 / 5.2 |
| B3 | 工具栏去掉「密度」按钮 | 默认显示 → 不显示;`toolbar.density` **保留、默认 `false`**(传 `true` 可请回,此时存储优先,存储里已有的值生效) | `toolbar: { density: true }` | P0 | 5.2 |
| B4 | 分页外观 | 页码序列 → 官方 `simple`(输入框 / 总页数);见 §5.5。**simple 下 `showQuickJumper` / `pageSlot` 不再生效**;窄档(库根节点宽 < 600)不画每页条数选择器(`narrowPager`,P0)。**附带的行为变化**:静态数据(本地)模式改每页条数后回到第 1 页(与远程一致,`simple: false` 下同样如此,无开关;2.1.1 是停在当前页、超出总页数才夹回) | `pagination: { simple: false }`(官方 `NPagination` 的 `simple` 属性,**不是新增 API**) | P0 | 6 |
| B5 | 静态数据模式不显示刷新按钮 | 显示(无效)→ 隐藏;`refresh()` 方法保留 | 无(本来就无效) | P0 | 7.1 |
| B6 | 表头排序箭头 / 漏斗悬停才显示 | 常驻 → 悬停显现(激活态、触屏除外;§5.7)。同批变化:漏斗可 Tab 聚焦、点漏斗不排序改用官方 `data-data-table-filter` 跳过标记(去掉 `@click.stop`,宿主挂在表头 / 祖先上的 click 监听能收到漏斗点击)、图标间距 8 / 6px 与右内边距 16px、「标题 + 漏斗 + 箭头」紧贴成一组 | 暂不提供开关(YAGNI) | P0 | 3.9 |
| B7 | 列头过滤面板 | 单条件 / 勾选 → 多条件编辑;options 列「勾选 + 高级条件」;面板排布对齐原型、窄容器不出屏。**列头面板的默认操作符集合保持 2.1.1 的 8 个**;7 个新操作符只在宿主于列上显式写 `filter.actions` 时出现(§5.9)。自定义面板(`def.render`)也有变化:不自动聚焦、Tab 不循环、面板打开期间 Esc 一律关闭(§5.3) | 无(面板形态变化,不涉及数据形状) | P0 | 3.1 / 3.4 |
| B8 | 拖过列宽后的余量 | 占位列 → **吸收列吸收余量**(表头 DOM 不再有占位列;规则与机制 = §5.6 的 `dk` 方案,spike S1 实测通过全部情形)。**代价:吸收余量的那一列没有拖拽把手**(向左拖它本来没有持久效果,向右只是横向撑大;调它左侧的边界拖左邻列的把手) | 给列写 `resizable: false` 可让它不参与吸收(吸收列顺延到前一列) | P0 | 3.11 / 9.6 |
| B9 | 筛选后分页 | **保持库现状,相对 2.1.1 无变化**:库远程回第 1 页。偏离官方默认 `'current'` 只发生在 remote——官方只在**本地**模式夹页(`use-table-data.mjs:140`:`props.remote ? page : clamp(...)`),remote 下 `'current'` 可能停在不存在的页;本地模式库等同官方 | 宿主传官方 `paginationBehaviorOnFilter` | P0 | 3.8 |
| B10 | 模式 2 默认多出已生效条件 chips(位置:表格下方、与分页同一行,见 §5.3) | 无 → 有条件时多出 chips | `filterChips: false` | **P1** | 3.2 |
| B11 | 卡片内边距 | `size="medium"` 内容区 **20 / 24 / 20**(上 / 左右 / 下;无 header 的卡片内容 `padding-top` 取 `--n-padding-bottom`,`card/src/styles/index.cssr.mjs:79-80`)→ **四边 16px** | `cardProps: { size: 'medium' }`(§4) | P0 | 5.4 |
| B12 | 列宽拖拽下限(只影响开了 `resizable` 的用户) | 固定 60px → 带图标的列取 `max(resizeMinWidth, 图标下限)`(`resizeMinWidth` 缺省 60;图标下限 = `headerIconFloor` = 左内边距 12 + 标题 44 + 漏斗簇 30(可过滤)+ 箭头簇 21(可排序)+ 右内边距 16,即**仅排序 93、仅过滤 102、两者 123**;按 §5.7 的图标布局与 22px 漏斗算);列上显式写了 `minWidth` 的不覆盖;吸收列没有把手,不涉及。**下限部分 P0**;**把手骑线部分**(只给相邻固定列加递减 `z-index`,不改表头 `th` 的 `overflow`)随 P1 落地(§5.6) | 列上显式写 `minWidth` | P0 / P1 | 3.11 |

### 1.1 外观对齐(对齐设计原型;不占 B 编号,同样进 CHANGELOG「外观调整」)

库的外观对齐设计原型。下列 **8 项相对 2.1.1 有外观 / 行为变化**(每项带回退方式;chips、「更多」、角标等是新增,不算变更):

| 变更 | 旧 → 新 | 回退方式 | P | 落点 |
|---|---|---|---|---|
| 卡片标题 | 600 / `textColor2` → **500(`fontWeightStrong`)/ `textColor1`** | `#title` 插槽里自己包 `<span style="font-weight: 600">` | P0 | §5.2 |
| 工具栏间距 | 全部 4px → **业务组 8 / 图标组 4 / 组间 12** | 业务组内宿主用 `<n-space :size="4">`;组间 12 无 | P0 | §5.2 |
| 内置图标按钮的图标 | 18px → **16px** | 宿主 CSS `--n-icon-size: 18px !important` | P0 | §5.2 |
| 表头漏斗 | `NButton` 26 × 22、`textColor1`、悬停 / 打开整个图标变深 → **原生按钮 22 × 22、闲置灰(`thIconColor`)、悬停 / 打开只加底色、已筛选主色** | 无 | P0 | §5.3 |
| 过滤列标题 | 拖窄时折行撑高表头 → **单行、放不下省略** | 宿主 CSS `.smart-table .smart-table-th-text { white-space: normal !important; overflow: visible !important }`(库的规则编译成 `.smart-table[data-v-…] .smart-table-th-text`,优先级 (0,3,0),不加 `!important` 盖不过) | P0 | §5.3 / §5.7 |
| 单选过滤列(`multiple: false`) | 复选框模拟 → **官方 `NRadio`** | 无 | P0 | §5.3 |
| 列设置 | 可全部取消 → **只剩一列可见时那一列勾选框禁用**,`toggleShow` 兜底拒绝 | 无 | P0 | §5.2 |
| 搜索区「展开 / 收起」(缺陷修复) | 上移 6px、矮 20px → **同排居中同高** | 无 | P0 | §5.1 |


## 2 缺陷修复(C 级,共 5 项:C1、C2、C3、C5、C6,均已落地并有回归测试;「状态」列记录的是修复前的复现情况,缺陷位置的行号指 2.1.1 源码)

> C4(`activeConditions` 丢弃无值算子)**不在此列**:2.1.1 的 `FilterAction` 里没有 `isNull`,这个缺陷在 2.1.1 不可达,改记为 §3 的「新增」(无值算子是 15 个操作符的前置改动)。编号 C4 空缺,不复用。

| # | 缺陷 | 状态 | 修复后可见影响 |
|---|---|---|---|
| C1 | 多列排序被截成单列(`SmartTable.vue:209-211` 取 `s[0]`;`useColumns.ts:453-456` 回显错) | **真实浏览器已复现**(设计文档 9.4) | 写了 `sorter: { multiple }` 的宿主,箭头与远程参数变正确 |
| C2 | `defaultSortOrder` 被受控 `sortOrder` 盖掉(`useColumns.ts:455-456`) | **已复现** | ⚠ **宿主在 2.1.1 里写了却没生效的 `defaultSortOrder`,升级后会突然生效**,CHANGELOG 显著标注并补一句:**静态 data 模式下本地数据也会被排序**。`defaultSortOrder` **只在首次 setup 时从 `columns` 读取**——列异步加载时不生效,请用 `sort()`(规格与 CHANGELOG 都写明)。推导初始排序态(`sorts.ts` `deriveInitSorts`)时**跳过 `hideInTable` 的列**(搜索专用列);单列互斥的 sorter 若有多列写了 `defaultSortOrder`,只留最后声明的那一列,`multiple` 列可并存 |
| C3 | `filterValueToOptions` 只取 `equal`,静默丢其它条件(`filter.ts:264-268`) | 读源码确认 | options 列带非等于条件时不再丢条件 |
| C5 | `SearchForm` 视口 < 640px 且开启 `collapsible` 时折叠态 0 个字段 | 原型已验证修法 | 折叠可见字段数 `max(1, collapsedRows × cols − 1)`;只有「1 列 × 1 行」这一档变化。**取列数的方式**:渲染后读 `n-grid` 根元素 `getComputedStyle(el).gridTemplateColumns` 的轨道数(`searchCols.ts` 纯函数 `countTracks`,0 = 未知),`ResizeObserver` 跟随变化重读;`effectiveCollapsedRows(轨道数, collapsedRows)` 在 `collapsedRows × 轨道数 < 2` 时把传给 `n-grid` 的 `collapsed-rows` 抬到 2(让出 1 格给操作区后仍露出首个字段),轨道数未知时原样不改。宿主用 `NConfigProvider breakpoints` 自定义断点时同样正确。 |
| C6 | 宿主在 `<SmartTable>` 上写 `@update:sorter`,点一次表头被调用**两次**:`forwardedAttrs`(`SmartTable.vue:294-299`)没摘掉 `onUpdate:sorter`,它透传给 `NDataTable`,`onSorterChange`(`:213-214`)又手动转发一次 | 读源码确认 | 宿主的 `@update:sorter` 只被调 1 次。修法:从 `forwardedAttrs` 摘掉 `onUpdate:sorter`,只手动转发一次(点击与编程式 `sort()` / `clearSorter()` 共用同一出口);有测试(宿主 spy 恰好被调 1 次) |

## 3 新增 API(A 级,不传则与 2.1.1 一致)

| 能力 | 形态 | 优先级 | 设计文档 |
|---|---|---|---|
| 多列排序 | 宿主在列上写官方 `sorter: { multiple: n }`(**大者优先,与点击顺序无关**);库内排序态由单个升为数组;远程参数单列不变,多列**仍带**最高优先级列的 `sortField / sortOrder` 并**另加** `sorts: [{ field, order }…]` | P0 | 4.1 |
| 实例方法 | `sort(columnKey?: string \| null, order: 'ascend' \| 'descend' \| false = 'ascend')`、`clearSorter()`,与官方 `DataTableInst` 同签名(`data-table/src/use-sorter.mjs:105-118`):`!columnKey` 等价 `clearSorter()`;没有 sorter 的列是空操作(不通知);远程模式回第 1 页重查。**编程式排序 / 清除后向宿主的 `onUpdate:sorter` 转发一次**,载荷形状与官方一致(单列互斥 = 单个 `SortState`;multiple = `SortState[]`;`clearSorter()` = `null`;纯函数 `sorts.ts` `sortTransition`);与 C6 共用同一个转发出口 `notifyHostSorter`。**只认 `onUpdate:sorter`(`@update:sorter`)这一种写法**:宿主写 `onUpdateSorter` / `onSorterChange` 拼写时,点表头照常由 `NDataTable` 通知,编程式调用收不到 | P0 | 4.6 |
| 15 个操作符(纯逻辑) | `FilterAction` 8 → 15(+ `isNull` `isNotNull` `like` `startsWith` `endsWith` `in` `notIn`);类型、求值、labels、序列化、无值算子常量属 P0(B7 面板与 C3 要用),模式 2 条件构造器的 UI 属 P1。**含原 C4**:无值算子不再被 `activeConditions` 丢弃。列头面板只在宿主显式写 `filter.actions` 时出现新操作符(B7);模式 2 条件构造器默认给下表「推荐集合」(P1)。语义见 §5.9。**是对「条件模型对齐 Bootstrap Blazor」约定的有意扩展**;**类型层面变更**:`FilterAction` 联合 8 → 15,宿主穷尽的 `Record<FilterAction, …>` 会报错(CHANGELOG 单列「类型层面变更」) | P0 | 1 / 3.5 |
| 新导出(`src/index.ts`) | 值:`NO_VALUE_ACTIONS`、`isValuelessAction`、`actionValueKind`、`isOptionsRepresentable`、`zhCNLabels`;类型:`SortItem`、`ToolbarMoreOption`、`ActionValueKind`。均已在 `index.ts` 导出。**P1 追加**:值 `RECOMMENDED_ACTIONS`,类型 `SearchContainer`(`SearchFormConfig.container`、`SearchConfig.actions`、`ToolbarConfig.maximize` 是既有类型上的新字段);`useFilters` 的返回值新增 `setMany`(一次批量提交,只触发一次 `onChange`,`key` 为空串)| P0 / P1 | — |
| 已生效条件 chips | `filterChips?: boolean`(默认 `false`,显式开启才有;模式 2 默认开是 B10);`NTag`(`size="small"`、主色),超一行折成「+N」;排布与行末按钮规则见 §5.3 | P0 | 3.2 |
| 「更多」菜单 | `toolbar.more?: ToolbarMoreOption[]`(`ToolbarMoreOption = NonNullable<DropdownProps['options']>[number]`,从公开的 `DropdownProps` 推导;官方的 `DropdownMixedOption` 没有从 naive-ui 入口导出,不能用);官方 `NDropdown` options 原样透传;事件 `moreSelect(key, option)`;不传 / 空数组 / 只有分隔线(或只有 `type: 'render'` 的自定义渲染项)时不出现 | P0 | 7.3 |
| 新 labels | **新增键全部声明为可选**(`?:`),2.1.1 已有的键保持必填;`defaultLabels` 给出全部键的英文默认,库内部合并后用 `Required<SmartTableLabels>`;新增导出 **`zhCNLabels`**(完整中文,含 2.1.1 已有键与新键,零依赖),README 中文示例改用它。**P0 阶段的 20 个键**:操作符名 `filterIsNull` / `filterIsNotNull` / `filterLike` / `filterStartsWith` / `filterEndsWith` / `filterIn` / `filterNotIn`、无值占位 `filterNoValue`;「更多」`more`;漏斗角标 `filterActiveCount`(含 `{n}`);多条件面板 `filterAddCondition` / `filterRemoveCondition` / `filterLogicAnd` / `filterLogicOr` / `filterAdvanced` / `filterSimple`;chips `filterClearAll` / `filterRestoreDefault`;列头面板 `filterConditionLead`(第 1 行条件前的「条件」引导标签)/ `filterCannotCollapse`(高级条件含勾选表达不了的条件时「返回」禁用的提示)。**没有 `pageSizeSuffix`**(每页条数选择器用官方嵌套,文案自动跟 locale)。面板按钮沿用已有的 `filterConfirm` / `filterReset`,面板 `aria-label` 用列标题 + 已有的 `filter`。**P1 阶段的 7 个可选键(`defaultLabels` 英文 + `zhCNLabels` 中文都有)**:批量栏 `selectedCount`(含 `{n}`)/ `clearSelection`;模式 2 `searchBy`(含 `{field}`,窄档输入框占位)/ `searchMoreConditions` / `searchConditionN`(含 `{n}`,窄档抽屉里每条条件的块头);放大 `maximize` / `restore`。多条件面板第 1 行的引导文字复用 P0 的 `filterConditionLead` | P0 | 3.3 / 2.12 / 7.2 / 7.3 |
| 全局默认页大小 | `SmartTableDefaults.defaultPageSize?: number`(纯新增,B1 的回退入口);`SmartTable` 的 `defaultPageSize` prop 的 Vue 默认值是 `undefined`,首次 setup 时解析一次(§5.5) | P0 | — |
| 存储回退密度 | `loadState(key, fallbackDensity?)`(公开导出,签名向后兼容):存储里没有 density 字段时回退到 `fallbackDensity`(缺省 `'compact'`,即内置默认;2.1.1 写死 `'comfortable'`,直接调它的宿主看到的返回值与之不同,见 B2);`useColumns` 传宿主解析后的 `defaultDensity`。否则写死的回退值会盖过宿主值(B2) | P0 | 5.2 |
| 卡片透传 | `cardProps?: Partial<CardProps>`,合并在库默认 `size="small"` + `themeOverrides` **之后**(`cardStyle.ts` `mergeCardProps`;`themeOverrides` 逐键合并,不整个替换),作用于库渲染的所有卡片:表格卡片,以及模式 1 的搜索卡片(`SearchForm` 经自己的 `cardProps` prop 拿到同一份合并结果;`layout: 'inline'` 没有卡片,不涉及)。B11 的回退入口 | P0 | — |
| 撑满父容器高度 | `fillHeight?: boolean`,默认 false;内部映射官方 `flex-height`(`DataTable.d.ts:126`)+ `virtual-scroll` + `min-row-height`(= `ceil(真实行高)`:默认主题下紧凑 `small` 40 / 舒适 `medium` 48(实测行高 39.4 / 47.4);官方默认 28 会让滚到底最后一行看不全;宿主 attrs 的 `minRowHeight` 优先),并传官方 `min-height: 160` 兜底。根 `height: 100%; min-height: 0`,卡片、卡片内容区、`NDataTable` 逐层列布局 `flex: 1 1 auto; min-height: 0`。`flex-height` 与 `virtual-scroll` **必须同时传**(只传后者不虚拟化)。开启时宿主透传的 `max-height` / `maxHeight` 不再传给表格,并 `console.warn` 一次。**宿主须给根元素的父容器确定高度**(`height: 600px` / `calc(100vh - …)` / 自己是有定高的 flex 列),否则表体塌成 0(只有官方 `min-height` 能兜底)——文档写明 | **P0** | 2.11 / 9.6 |
| 翻页后回到卡片顶部 | **点翻页 / 改每页条数的当下**(`onUpdatePage`、内层每页选择器与 `simple: false` 原生选择器的 `onUpdatePageSize` 回调里,不等数据回来,每条路径恰好触发一次)调用 `onPageChanged`。不开 `fillHeight` 时:卡片顶部已在滚动容器上沿之上(`top < scroll-margin-top`,宿主的固定顶栏用 CSS `scroll-margin-top` 留位)才 `card.scrollIntoView({ block: 'start', behavior: 'instant' })`;卡片可见时不动。滚动容器沿祖先找出实际的 `overflow-y: auto / scroll` 且内容溢出的元素再比 `top`,找不到按视口算(`scrollToCard.ts` `scrollParentOf` / `keepCardTopVisible`;宿主 `scroll-behavior: smooth` 下 `instant` 仍立即到位)。开了 `fillHeight`:改为 `tableRef.scrollTo({ top: 0 })` 把表体滚回顶部——官方只在页码变化时复位(`use-scroll.mjs:207`),停在第 1 页改每页条数时不复位,所以库自己调 | P0 | 9.6 |
| 类型补全 | `SmartTableProps`(`types.ts`)含 `rowDraggable?: boolean` / `dragHandle?: string`(与 `SmartTable.vue` 的 prop 一致);内部的 `useColumns().toggleShow` 返回 `boolean`(是否生效,§5.2 列设置;`useColumns` 未从入口导出,不算公开 API) | P0 | — |
| 触屏兜底 | `@media (hover: none)`(与设计原型一致;**不加** `any-pointer: coarse`,带触屏的 Windows 笔记本它也为 true,会让鼠标用户的图标常显):未激活箭头 / 漏斗 `opacity .5` 常驻(**P0 只做图标淡显**)。触屏 24px 拖拽热区归 P1(§5.6) | P0 | 3.9 |
| 模式 2 条件构造器 | `search: { container: 'table' }`;窄档「输入框 + 筛选抽屉」(2.6a)。新字段:`SearchFormConfig.container?: 'card' \| 'table' \| 'none'`(**`container` 优先于 `layout`**;没写 `container` 时 `layout: 'inline'` = `'none'`)、`SearchConfig.actions?: FilterAction[]`(仅模式 2,该字段可选的比较符,优先于 `filter.actions`,再缺省取 §5.9 的推荐集合);新导出 `RECOMMENDED_ACTIONS` / `SearchContainer`。数据通路与档位见 §5.1 | P1 | 1 / 2.6a |
| 批量栏 | 插槽 `#batch="{ checkedRowKeys, clear }"`;库内置「**本页全选**复选框 + 已选 N 项 + 取消选择」(复选框与原型 `.bt-info` 一致:本页可勾的行全勾上 = 选中,其余一律半选,「已选 N 项」是跨页总数;点它并入 / 去掉本页的键、别页的勾选保留,`selection` 列 `disabled` 的行不算,载荷同官方表头全选 `checkAll` / `uncheckAll`);内容贴第 1 行顶部、内置图标组留在右侧、「更多」随工具栏被替换;窄档(根节点宽 < 600)排成「已选 N 项 \| 取消选择」一行 + 宿主按钮整行;**三个条件全满足才出现**:有 selection 列、传了插槽、宿主绑了 `checked-row-keys`(没绑就没有批量栏);不暴露 `checkedRows` | P1 | 2.5a / 2.12 |
| 放大 | `toolbar.maximize?: boolean \| { zIndex?: number }`,默认 **false**;`true` = 层级 1999,`{ zIndex }` 覆盖(≥ 2000 会盖住表格自己的气泡,开发期 `console.warn` 一次)。做法见 §5.2「放大」 | P1 | 7.2 |
| 窄档专属行为 | **P2 已落地(列头筛选抽屉除外)**。`cardOnNarrow?: boolean`,默认 false;列上 `card?: 'title' \| 'meta' \| 'action' \| 'handle' \| false`(含 `'handle'`:原型「窄档卡片保留拖拽」需要一个能放进标题行最左的手柄列,库不自动加手柄列,宿主列写 `card: 'handle'`);窄档排序抽屉(`SortDrawer.vue`)。**以下窄档专属行为一并归 P2,由 `cardOnNarrow` 门控**:业务按钮折叠成「操作 ▾」、列头面板在窄容器换底部 `NDrawer`、「更多」菜单窄档 44px 选项高。**P0 / P1 下窄容器与宽容器用同一套工具栏与 `NPopover` 面板** | **P2** | 2.7 / 2.12 / 4.5 |

## 4 布局

- **三档**(按容器宽,**由 JS 量根节点宽度判定**(放大态量放大层宽),阈值 600 / 1280;不用视口媒体查询,也**不给根元素加 `container-type`**,所以不用 `@container`。理由:Teleport 搬走的是放大层而不是根;气泡 / 抽屉本来就要 JS 知道档位;原型也是 JS):窄 < 600、中 < 1280(模式 2 工具栏单行阈值)、宽 ≥ 1280。模式 1 的搜索网格仍是官方 `n-grid responsive="screen"`(视口口径),不动。**窄档有专属行为的部分(工具栏折叠、列头面板换 `NDrawer`、卡片)均为 P2(§3 末行);P1 已做的窄档只有模式 2 的「输入框 + 筛选」抽屉与批量栏的窄档排布**;P0 里与「窄」有关的只有 B4 的窄档分页(不画每页条数选择器)——它要在 JS 里决定渲不渲染 `suffix`,所以用 `ResizeObserver` 量库根节点的 `clientWidth`(还没量到时按非窄档处理),**P0 / P1 都没有用 `@container`**。
- **卡片内边距**:表格卡片与搜索卡片**四边 16px**(B11),官方做法 `size="small"` + 卡片自己的主题覆盖。**组件级 `themeOverrides` 是扁平形状** `{ paddingSmall: '16px 16px 16px' }`(`cardStyle.ts` `CARD_THEME_OVERRIDES`;`_mixins/use-theme.d.ts:23-25`、`card/src/Card.d.ts:90`);`{ Card: { paddingSmall } }` 是全局 `NConfigProvider` 的形状,**不要用在组件级**。只影响库里两张卡片(`SmartTable.vue` 的 `.smart-table-card`、`SearchForm.vue` 的 `.smart-table-search`)。加 1px 描边,四边到内容 17px(实测;`{ size: 'medium' }` 回退后为 21 / 25 / 25 / 21)。`cardProps` 合并在这套默认之后(§3),要 naive 默认的卡片内边距就传 `cardProps: { size: 'medium' }`。
- **页面底色**是宿主的事;卡片在白底与 `NLayout embedded` 灰底上都必须成立。
- **高度**:默认行为不变;`fillHeight` 开启时根 `height: 100%; min-height: 0`、卡片与卡片内容区 `flex: 1 1 auto; min-height: 0` 的 flex 列,表格映射官方 `flex-height` + `virtual-scroll` + `min-row-height`(组合与取值见 §3),忽略并警告 `max-height`;父容器必须有确定高度。不开 `fillHeight` 时整页长滚动,翻页后见 §3「翻页后回到卡片顶部」。

## 5 各块规格

### 5.1 搜索区(模式 2 为 P1,已落地;模式 1 与 2.1.1 一致)
- 模式 1 `container: 'card'`(默认,不变):独立搜索卡片。模式 2 `'table'`:并入表格卡片的一行条件构造器「字段 + 比较符 + 值」,字段候选 = 声明了 `search` 的列;产出仍是 `FilterValue`,走现成 `filterSerializer`。只写 `layout:'inline'` 等价 `'none'`。
- 多条件:同字段多条可「且 / 或」(`FilterValue.logic`,**每字段一个值**,改任一条联动全部);**跨字段固定「且」**。
- 比较符按字段类型(text / number / date / select)分发,换字段后不再适用要自动重置;无值算子(`isNull` / `isNotNull`)集中导出常量,`activeConditions`、面板、构造器、chips 都读它。
- 模式 2 宽档严格 1:1(左半搜索、右半按钮 + 图标);值输入框最小 100px。
- 模式 2(P1):「搜索」是次级(描边)按钮,回车也触发;主色实心留给宿主的「新增」。**模式 1 不变**:搜索卡片里的「查询」仍是 2.1.1 的主色按钮(`type="primary"`),输入框回车同样触发。
- **操作区对齐**:卡片内「搜索 / 重置 / 展开 · 收起」同排垂直居中、同高(`n-space align="center"`);官方文字按钮的 `--n-height` 是 `initial`(没有固定高度和内边距,实测 28 × 14,会比同排 34px 的按钮上移 6px),所以「展开」按钮自己取主题 `heightMedium`、左右内边距 4px(实测三者 top / 高 / 中线一致:119 / 34 / 136)。
- 模式 2 窄档(P1,2.6a):无「搜索」按钮(回车,`enterkeyhint: 'search'`);枚举字段选完即生效。模式 1 窄档与宽档同一套(只有 C5 的折叠修正)。
- **模式 2 的数据通路**:
  - **字段候选** = 声明了 `search` 且放得进一行的列,按 `search.order`(缺省按列序)排。同时写了 `filter` 的列**复用列头的 `FilterDef`**(同一个过滤键、同一份过滤态,所以构造器与列头漏斗天然互相同步);只写 `search` 的列新派生(值控件类型取 `search.type`,`daterange` 按 `date` 处理,没写则按列的字典 / `format` 推断)。**带 `search.render` 的列、`type: 'switch'` 的列不进构造器**;`search.key` 在模式 2 下被忽略。比较符优先级:`search.actions` > `filter.actions` > §5.9 的推荐集合。
  - **请求形状** = `filterSerializer` 的 `filters`(没有扁平的搜索键);`@search` 的载荷 = `{ ...清洗后的 params, ...filterToParams() }`。点「搜索」/ 回车才提交(敲字不提交;没有变化也重查);「重置」恢复各构造器字段的 `defaultValue`、不碰只有列头漏斗管的列;一次提交多字段只触发一次 `filter-change`(`key` 为空串,经 `useFilters.setMany`);静态 `data` 下只写 `search` 的列也能本地过滤。
  - **`container` × `layout`**:`container` 优先;没写 `container` 时 `layout: 'inline'` = `'none'`(不带卡片的内联搜索表单,即 2.1.1 的 inline),否则 `'card'`;两者冲突时 `layout` 被忽略。
  - 构造器最多 10 行(`MAX_BUILDER_ROWS`);多条件面板 / 窄档抽屉里 Esc 与点空白处只收起、**保留草稿**(与列头面板不同);面板里有下拉展开时 Esc 只收下拉。
  - **B10 的 chips 规则**:宽 / 中档只有 1 条、且它就是工具栏主行里那条构造器条件时不画 chips(主行已经显示);窄档 ≥ 1 条都画。位置见 §5.3(表格下方、与分页同一行)。
  - **窄档**(根节点宽 < 600):主行只画第 1 行的值控件(占位「搜索 {字段名}」、`size="large"`、右侧放大镜),旁边是「筛选」按钮(文案取 `labels.filter`);枚举字段的标量比较符选完即生效;点「筛选」从底部抽屉(官方 `NDrawer`,`placement="bottom"`、高度随内容、最高 `85vh`,头 / 脚用 `NDrawerContent`)展开同一份条件面板。

### 5.2 工具栏
- 顺序:标题 · (搜索区)· **宿主业务按钮(`#toolbar-right`)· 「更多」** · 放大(P1)· 刷新 · 列设置。标题始终保留,放不下时单行省略。「更多」放在业务按钮组末尾、内置图标之前。
- **标题**:16px、`fontWeightStrong`(500)、`textColor1`(与官方卡片标题一致),走 `useThemeVars()`(库自己的元素不依赖 `NCard` 的 `--n-*` 变量)。(与 2.1.1 的差异见 §1.1)。
- **分组与间距**:右侧两组并排:**业务组**(宿主 `#toolbar-right` 的按钮 + 「更多」,间距 8)与**图标组**(刷新 / 密度 / 列设置 `#settings`,间距 4),两组之间 12(原型 `.tb-actions` / `.tb-icons` / `.tb-right`);空组不画(`v-if` + `:empty { display: none }` 兜底宿主插槽里全是假 `v-if` 的情形,否则空容器多一个 12px 间距)。图标按钮 28px 圆形、**图标 16px**(官方 small 圆形按钮默认 18px,经 `abstract` 的 `NConfigProvider` 覆盖 `iconSizeSmall`,不多包 DOM,`#settings` 里的列设置按钮同样生效)。容器宽 390 / 560 / 720 / 1024 下工具栏 `scrollWidth ≤ clientWidth` 仍成立(实测 332 / 502 / 662 / 650)。
- **刷新**:`toolbar.refresh !== false && isRemote`;静态模式不显示。
- **列设置「至少保留一列」**:只剩一个已勾选的列时,那一列的勾选框**禁用**(没有 toast / 提示文字);纯函数 `canHideColumn(items, key)`(只看设置里能管的列,`hideInSetting` 的列不算;已隐藏 / 不存在的键不受限)被 `ColumnSettings.vue`(禁用)与 `useColumns.toggleShow`(兜底拒绝,返回 `false`、状态不变;显示永远允许)共用。(与 2.1.1 的差异见 §1.1。)
- **密度按钮**:默认不显示(B3)。`defaultDensity` **响应式**;没有密度按钮时**忽略存储里的 density**(格式与 `VERSION` 不动),宿主的个人设置才生效。
- **「更多」**(P0):文字按钮 + 下箭头(默认 medium 34px,与宿主业务按钮同高;chevron 12px、`iconColor`、右内边距 12px;实测 72 × 34),默认描边、永不主色;**不用「…」图标**(模式 2 条件行已有「»」叫「更多条件」)。菜单是官方 `NDropdown`(`trigger="click"`、**`placement="bottom-start"`、最小宽 148、离按钮 8px**;最小宽走官方 `menu-props`、间距走 `peers.Popover.space` 主题覆盖,只作用于这一个下拉;默认 medium 档选项高 34px)、选中后收起、点外部收起(官方行为)、**Esc 由库接管**(官方 `NDropdown` 只有焦点在菜单里才响应 Esc,库用受控 `show` + `useEscClose`,焦点还在按钮上按 Esc 也能关);与放大(P1)/ 列设置气泡互斥靠官方的点外部收起;批量栏(P1)出现时随工具栏一起被替换。窄档 44px 选项高归 P2。**库不内置导出 / 导入**(官方 `downloadCsv` 只导当前页,`keepOriginalData` 反而忽略过滤;官方 `getFilteredAndSortedData()`(`DataTable.mjs:281`)返回已过滤已排序的**全部行**,但远程模式库手里只有当前页,同样不等于「当前查询的全部结果」),只出菜单外壳。
- **放大**(P1 已落地,`toolbar.maximize?: boolean | { zIndex?: number }`):图标「四角括号」(放大 = 括号向外,还原 = 向内);放大层 `position: fixed; inset: 0` 铺满视口,**不调用浏览器全屏 API**。**落地做法**:`Teleport` 的对象是 `div.smart-table-layer`(只在开了 `toolbar.maximize` 时才多出这一层,未放大时 `display: contents`、对布局透明;不开放大时 DOM 与不带该能力时逐节点一致),放大时整层搬到 `body`,根元素原位留一个同高占位;层级默认 **1999**(低于 naive 浮层的 2000,放大后列头气泡 / 抽屉 / 下拉仍显示在它上面),`{ zIndex }` 可配,≥ 2000 会盖住表格自己的气泡、开发期 `console.warn` 一次;底色 = 官方 `NLayout` embedded 的底色(亮 `actionColor` / 暗 `bodyColor`);放大层是 `role="dialog" aria-modal`,Tab 在层内循环。Esc 分层:在捕获阶段读浮层,有浮层打开时先收浮层,再按一次 Esc 才还原;还原后**只在键盘操作后**把焦点放回放大按钮(`keydown` / `pointerdown` 追踪,鼠标点还原不画焦点环);放大期间锁住页面滚动(`html { overflow: hidden }`,多个放大层引用计数,放大中卸载 / 宿主关开关都解锁);切换前后保留表体 `scrollTop`;工具栏三档在放大态按放大层宽度重新判定。**不支持挂载后在运行时切换 `toolbar.maximize` 的开关**(会重建表格,列宽 / 过滤态的内部状态丢失)。**库自己的气泡(更多 / 密度 / 列设置 / chips「+N」)都支持 Esc 关闭,不开放大也一样**(官方 `NPopover` 不管键盘)。
- **批量栏**(P1 已落地):原地替换工具栏那一行(标题 / 业务按钮 / 「更多」/ 构造器让位,内置图标组留在右侧),与工具栏行**共用同一 `min-height`**(勾选不让表格跳动);勾选态读宿主绑的 `checked-row-keys`(库不持有);内容 =「本页全选」复选框 + 「已选 N 项」+ `#batch` 插槽 + 「取消选择」(细节见 §3);窄档(< 600)排成「已选 N 项 | 取消选择」一行 + 宿主按钮整行。
- **对外图标**:只写文档、不加 API;宿主的自定义按钮放插槽里自己选图标。
- 窄档(P2,`cardOnNarrow` 门控):业务按钮折叠成文字按钮「操作 ▾」,点开原位展开一行(不是浮层、**不加动画**);「更多」在展开行里与「新增」等分。

### 5.3 过滤(列头漏斗)
- **漏斗仍由库放在标题内**(`useColumns` 的 `toNaive` 给过滤列的 `title` 包一层 `span.smart-table-th`,标题文字再包一层 `span.smart-table-th-text`,见下);面板用官方 `NPopover`(`trigger: 'click'`、`placement: 'bottom'`、`raw`、无箭头)。窄容器换底部 `NDrawer`(气泡与抽屉同一份内容,只换容器)**归 P2**,P0 / P1 窄容器同样用 `NPopover`。
- **点漏斗不触发排序**:官方有现成的跳过标记——`TableParts/Header.mjs:107-108` `if (happensIn(e, "dataTableFilter") || …) return`,漏斗触发器加 `data-data-table-filter` 属性即可(官方优先;spike S3 实测 sort=0,没有该属性则触发排序)。**触发器不加 `@click.stop`**:加了会吞掉宿主挂在 `th` / 祖先上的 click 监听(实测 hostClicks=0),不加则宿主的监听能收到漏斗点击(与 2.1.1 的差异见 B6)。面板容器上的 `@click.stop`(只挡面板内部 click 冒泡)可保留。
- 面板内容(条件列):每行 **4 列网格 `56px 112px 1fr 28px`(间距 8、行距 12)**:首列(**第 1 行是「条件」引导标签**,12px、`textColor3`、居中;**第 2 行起是且 / 或下拉**,选哪个都改整组的连接方式)、比较符、值、删除(删除列恒占位,所以 1 行与多行的值输入同宽);「添加条件」(**上限 5 条**;**官方 `NButton` small 档**文字按钮:高 28〔主题 `heightSmall`〕/ 字 14 / 内边距 0 10px / 图标 18,与同一面板里 small 的值控件一致〔`button/styles/_common.mjs`〕,带加号,**深色 `textColor2`,不是主色**;窄档抽屉的 large 档属 P2);面板 padding 0、正文 `12px 12px 0`、工具行上下各 8、footer `padding: 8px 12px` + 上分隔线;条件面板(condition 列、options 列展开高级条件后)宽度 `min(400px, 100vw − 16px)`(实测 1 行 400 × 123、2 行 400 × 163),options 勾选态按内容宽(最小 168,最大 `100vw − 16px`);底部 `space-evenly` 的 tiny 按钮「重置」(默认,**立即生效并关闭**,语义 = 恢复该列 `defaultValue`,无则清空,与现行 `ColumnFilter.vue` 的 `defaultValue ?? null` 一致)+「确认」(primary),文案**沿用已发布的 labels `filterReset` / `filterConfirm`,英文默认保持 `Reset` / `OK`**(官方 locale 的 `confirm` / `clear` 经公开 API 取不到:`useLocale` 只在内部 `_mixins` 导出),中文宿主用 `zhCNLabels`。面板内改的是**草稿**(`filterDraft.ts` 纯函数状态机),确认才提交,Esc / 点外部丢弃;文本值输入框回车 = 确认(数字 / 日期 / 下拉值控件没有回车提交)。**提交时丢弃「无值的有值类条件」**(只选了比较符没填值;无值算子放行);**换比较符后若值的形状不再适用(数组 / 标量 / 无值)清空值**,不做猜测性转换。
- **options 列**:默认勾选;底部「高级条件」展开同一份多条件编辑。**不丢信息**:纯函数 `isOptionsRepresentable(value)`(`filter.ts`,可单测,从 `index.ts` 导出)——所有有效条件均为 `equal` 且(`logic === 'or'` 或仅一条),或恰好一条 `in`,才可用勾选无损表达;否则打开时自动展开高级条件原样显示。勾选形态提交写 `equal` 取「或」(序列化不变)。从勾选切到高级条件时:0 个勾选 = 一行空白条件,1 个 = `equal`,≥ 2 个 = 一条 `in`;从高级条件切回勾选只在草稿能被勾选无损表达时允许。**一条 `in` 经勾选面板回写会变成若干 `equal` 取「或」**:语义相同、序列化形状变(CHANGELOG 已写明)。面板测试要含 `type: 'select'` 且值为 `isNull` 的用例。**排布**:选项间距 12(行高 22.4 → 间隔 34.4)、最高 240 滚动、面板最小宽 168;底部入口「高级条件 ▾」,展开后「返回列表 ▴」(靠右),高级条件含勾选表达不了的条件时「返回」禁用并给出原因提示(label `filterCannotCollapse`)。**单选列(`filter.multiple: false`)用官方 `NRadioGroup` / `NRadio`**(`HeaderButton/FilterMenu.mjs:118-141`),没有「全选」,已有 `equal` 条件时对应 radio 选中(编程式塞了多条 `equal` 取「或」时只显示第一个选中,不改动直接确认仍原样提交)。多选列在选项多于 1 个时才有「全选」,全选 / 全不选不动 disabled 选项。**自定义面板(`def.render`)** 只复用弹层与提交通道,沿用 2.1.1 的 8px 内边距 / 最小宽 200px,不套上面的排布。
- **键盘 / 焦点 / 可访问性**(真实 `NPopover` 不管键盘,设计文档 9.1;写法已由 spike S3 在真实浏览器实测,设计文档 9.6):
  - 打开后焦点移到**第一个可聚焦控件**(不是值输入框);**宿主自定义面板(`def.render`)跳过自动聚焦**(不抢焦点),面板打开期间 Esc 仍关闭:焦点在面板内、或还停在漏斗按钮上都生效(**漏斗触发器在面板打开期间也处理 Esc**:关闭、丢草稿、焦点留在漏斗;否则焦点留在触发器时 keydown 到不了面板上的捕获监听)。
  - 面板容器 `tabindex="-1"` 即可——鼠标点面板空白处天然聚焦容器,随后 Esc 正常(**不需要 mousedown 处理**);容器需要 `outline:none` 或自己的聚焦样式。不设 `tabindex` 时点空白后焦点落 body、Esc 无反应(实测)。
  - **面板内有展开的 `NSelect` / `NDatePicker` 下拉时,面板忽略 Esc,且 Esc 必须在 capture 阶段监听**(面板根上 `@keydown.capture`):官方这两者按 Esc 关自己的下拉时只调私有的 `markEventEffectPerformed`、不 `stopPropagation`(`select/src/Select.mjs:620-625`、`date-picker/src/DatePicker.mjs:320-331`),而冒泡阶段它们已先把自己关掉——实测「无条件 close」与「冒泡 + `@update:show` 展开标志」两种写法都会把整个面板关掉(草稿丢失),只有 capture 阶段 + 展开记录能做到「只关菜单、面板与草稿仍在」(浏览器派发可信事件时每个监听回调后都跑 microtask,冒泡阶段读到的展开记录已被清掉,用捕获 / 冒泡对照实验实测)。**展开记录按行记**:每个条件行(`ConditionRow`)对自己的且 / 或下拉、比较符下拉、值控件(`NSelect` / `NDatePicker`)各监听 `@update:show`,任一展开就向面板上报「本行有下拉展开」;面板用一个行号集合(`dropdownRows`)汇总,面板开合与删除行时清空;集合非空时放行,否则 `stopPropagation` + 关闭。teleport 出去的日历面板内部有焦点时按 Esc 什么都不发生(官方行为,不会误关面板)。自定义面板里宿主自己的下拉不在记录里:焦点在其上按 Esc 会直接关掉整个面板(自定义面板没有草稿可丢)。
  - 轻量焦点循环(只给内置面板,自定义面板里 Tab 会走出面板):Tab 离开最后一个可聚焦控件回到第一个,Shift+Tab 反之(`role="dialog"` 的常规做法;不丢草稿)。同名的原生单选组(单选过滤的 `NRadio`)在浏览器里只算一个 Tab 停靠点,所以边界控件所在单选组里的任意一个 radio 都算到了边上(`atEdge`),否则从第 2 个 radio Shift+Tab 会逃出面板。
  - 被点的控件随这次更新被卸载(删除行的 ×、「高级条件 / 返回列表」切换)或被禁用(加到上限的「添加条件」)时,焦点会落到 body、之后 Esc 关不掉面板 → `keepFocusInPanel`:只在焦点原本就在面板里时介入,更新后把焦点移到顶替它的控件(找不到则面板容器)。
  - Esc(无下拉展开时)关闭、丢草稿、焦点还给漏斗;漏斗触发器上的 Esc 同样处理(面板开着时),覆盖自定义面板焦点仍在漏斗的情形。点面板外部关闭时不抢焦点(焦点留在用户刚点的控件上)。
  - 漏斗按钮 `aria-haspopup="dialog"`、`aria-expanded`、`aria-label`(= `filter` 文案;同列生效条件 **> 1 条**时追加「已筛选 N 条」,`filterActiveCount`);面板容器 `role="dialog"` + `aria-label`(列标题 + `filter` 文案,**渲染期求值**)。均走 labels。
  - 必须有测试:「select 展开时 Esc 只关菜单、面板仍在、草稿仍在」「Tab / Shift+Tab 循环」。
- **不出屏**:`NPopover placement="bottom"` 把面板居中在漏斗上,触发器靠近视口边缘时(390 宽下 400px 的面板左缘 `x = −69`)会被裁出屏幕;公开的 `NPopover` 没有夹取开关 → 量 `NPopover` 的定位容器(vueuc `.v-binder-follower-content`:只有定位平移、**没有进场动画的缩放**,量面板自己会量错)的位置,用纯函数 `clampShift(left, width, viewport, margin = 8)`(`viewportClamp.ts`,结果取整)算水平平移加在面板自己的 `transform` 上;放不下(比视口 − 16 还宽)时贴左边距。重算时机:主要靠 `MutationObserver` 盯 follower 自己的 `style`——vueuc 滚动时在自己排的 rAF 里改写 follower 的 `transform`,只靠 `scroll` 监听会落后一拍(实测滚动停下后面板右缘停在 567 / 视口 520),观察回调是微任务,同一帧内夹回;窗口 `resize` 与 `scroll`(`capture`,任意祖先)监听作兜底。实测 390 宽 `left = 8`、520 宽滚动表头逐帧都在视口内。**已知缺口**:面板**自己的宽度**在打开期间变化(options 列切到「高级条件」从约 168 变到 400、远程字典加载撑宽)时不会重新夹取(vueuc 不因宽度变化重新定位,follower 的 `style` 也不变);按源码推断窄视口下可能出屏,**未在浏览器复现**,留作后续。**窄档改用底部抽屉仍归 P2**;未做之前窄容器至少不裁内容。
- **漏斗按钮**:原生 `<button>` **22 × 22**、图标 15px(B12 的下限 102 / 123 按它算);闲置色 = `thIconColor`(与排序箭头同灰),悬停 / 面板打开**只加** `thButtonColorHover` 底(不变色),已筛选才变 `thIconColorActive`;颜色 / 底色 / 圆角取表头子树里的 `--n-th-icon-color` / `--n-th-button-color-hover` / `--n-th-icon-color-active` / `--n-border-radius`(实测亮色闲置 `rgb(194,194,194)`、悬停底 `rgba(0,0,100,0.03)`、已筛选 `rgb(24,160,88)`;暗色闲置 `rgba(255,255,255,0.38)`);只在键盘聚焦(`:focus-visible`)时画主色 2px 细环。不用 `NButton`:它的内边距 / 文字色变量写在内联样式里,压不过库自己的 CSS。触发器外层 `span.smart-table-filter-trigger` 的 `margin-left: 8px` 给出「标题 → 漏斗」间距。**条数角标绝对定位**(`top: -3px; right: -5px; min-width: 12px; height: 12px; font: 500 10px/12px`),在按钮里面、不占宽、不撑宽 / 撑高表头,`aria-hidden`。**过滤列的标题文字**单独包一层 `span.smart-table-th-text`(`useColumns`),单行、放不下省略;列被拖到 B12 的下限时「物料编码」这类 4 字标题只剩 48px,折成两行会把表头从 39.4 撑到 61.8px、图标被挤歪——B12 的下限保证的是图标簇放得下,标题让位。
- 漏斗激活态 = 库自己的 `isFilterActive`,颜色取官方主题变量 `thIconColorActive`;同列 > 1 条加条数角标,**样式 = 纯数字**,文字色取 `useThemeVars().baseColor`(亮 `#FFF` / 暗 `#000`)经 `:style` 绑定(写死 `#fff` 暗色下叠在主色 `#63e2b7` 上约 1.4:1,不可读)。**不用**官方 `renderFilterMenu`:用 `renderFilter` 时触发器虽不带绝对定位 class(`HeaderButton/FilterButton.mjs:112-121`),但 DOM 顺序仍是「标题容器(含排序箭头)→ FilterButton」(`TableParts/Header.mjs:219-226`),做不出「标题 → 漏斗 → 箭头」(设计文档 3.10)。
- **chips**(`filterChips`,默认关;模式 2 默认开,B10):`NTag` `round` `closable` `size="small"` **`type="primary"`**(22px 高、间距 `8px 12px`、与表格 / 分页的间距由 SmartTable 给;孤儿 chip 与「+N」保持默认灰);点击重开对应列面板,× 删这一条;**行末按钮紧跟在 chips 后面**(不靠最右):表里有列声明了生效的 `defaultValue` 时,**只在过滤态偏离默认时**出现「恢复默认」(`clearFilters()`,语义不变;纯函数 `filtersAtDefaults(defs, state)` 逐列比较,只比生效的条件,孤儿键有生效条件算偏离),没有默认值时 **≥ 2 个 chip** 才出现「清除全部」(1 个 chip 自己的 × 就够了);超过一行折成「+N」,点它在气泡里展开,`+N` 让位后**重测一次**,避免 `+N` 自己折到第二行;**连「首个 chip + `+N`」都放不下时只显示 `+N`**(全部 chip 进气泡),`+N` 始终在第一行;同字段第 2 条起「或」加前缀。**位置**:chips 在**表格下方、与分页同一行**(左 chips、右分页)。原因:放在表格上方时 chips 出现 / 消失会让表格整体上下跳,放到分页行后表格位置不受影响。实现:分页由 `NDataTable` 内置渲染,chips 经官方 `pagination.prefix` 渲染进分页行(`.n-pagination-prefix` 吃掉页码左侧全部剩余宽度;宿主 `#pagination-prefix` 仍在、紧挨页码;宿主自己写了 `pagination.prefix` 时不抢,改自画一行);官方 `paginateSinglePage` 默认 `true`,默认总有分页行;`pagination: false` 或宿主显式 `paginateSinglePage: false` 且只有 1 页时,chips 在表格下方自画一行(`.smart-table-chips-foot`,与表格间距 12px)。宽 / 中档单行,放不下折「+N」;**窄档(根节点宽 < 600)chips 单独一行放在分页上方、可换行、不折「+N」**(原型 `.dt-foot` 窄档)。批量栏 / 放大层 / `fillHeight` 不受影响(chips 只在表格下方)。**孤儿键**:state 里有、列声明里已不存在的过滤键也要生成 chip(标题回退为 key,点击不开面板,× 可清;否则它仍进远程请求参数却看不见也清不掉),「清除全部」同样渲染。chips `role="button"`、`tabindex="0"`,Enter / Space 等同点击(× 上的 Enter 只删除、不开面板);「+N」同样键盘可开:它是受控 `v-model:show` 的 `NPopover`(官方 `trigger="click"` 只认真实 click),Enter / Space 打开后焦点移到气泡里第一个 chip。行末按钮是 tiny 文字按钮,与 chip 同高 22px、左右内边距 4px。
- `filterSerializer` 默认格式不变(`{ filters: [{ field, logic, conditions }] }`);新 action 取值**只在宿主显式开启(列上 `filter.actions`、模式 2 构造器)时才会出现**,老配置的后端不会收到;保留自有 `setFilter(key, FilterValue)`(官方 `filters()` 表达不了条件)。
- 筛选后分页:宿主显式传官方 `paginationBehaviorOnFilter` 就照官方;没传保持库现状(远程回第 1 页;**本地模式 / 静态数据等同官方夹页 = `'current'`**)。理由见 B9。

### 5.4 排序
- 多列见 §3。**默认排序**用官方列上 `defaultSortOrder`(多列配 `multiple`),库按列推导初始排序态并带进首次请求(修 C2);推导是**库的选择**(官方初值不做单列互斥,`use-sorter.mjs:31-37`):单列互斥的只留最后声明的一列、`multiple` 列可并存,跳过 `hideInTable` 的列,只在首次 setup 读取(异步列请用 `sort()`)。排序态是数组,顺序 = 优先级(`sorter.multiple` 大者在前;两列写了相同的 `multiple` 值时按事件里的先后,不按声明顺序)。
- **点击循环 = 官方「降序 → 升序 → 取消」**(`data-table/src/utils.mjs:74-77` `getNextOrderOf`:无排序时首次点击是**降序**)。库直接跟随官方,不自己改写。
- `sort()` / `clearSorter()` 的签名与通知见 §3「实例方法」。
- 默认**不显示优先级序号**(官方无;真觉得看不懂再用官方 `renderSorterIcon` 增强,不另造面板)。
- **排序态不持久化**(与过滤态一致,会话态)。
- 官方排序表头**本来就无键盘操作**(无 `tabindex`,Enter 不排序),库不处理。
- 窄档无表头:筛选 / 排序入口 → 底部抽屉(可排序列各一行,「无 / 升序 / 降序」分段,行序 = 声明的优先级;手机上不能改优先级,只能启停)。(P2 随卡片模式;入口位置见 §5.8)

### 5.5 分页(B4、B1)
- 所有宽度统一官方 `NPagination simple`(输入框 / 总页数)。**官方 `simple` 不带每页条数选择器和快速跳页**(`Pagination.mjs:665,682`),`pageSizes` / `showSizePicker` 要由库映射到 `suffix` 里的选择器。
- **每页条数选择器 = 官方嵌套 `NPagination`**(spike S2 实测通过,设计文档 9.6):外层 simple 分页的 `suffix` 里嵌一个非 simple 的 `NPagination`:`suffix: info => h(NPagination, { displayOrder: ['size-picker'], showSizePicker: true, pageSizes, pageSize: info.pageSize, itemCount: info.itemCount, page: info.page, onUpdatePageSize })`(`pagination/src/Pagination.mjs:68`、`:481`,2.32.2 引入,在 peer `^2.44.0` 内)。**不传 `onUpdatePage`、不传 `size`**(表格 small / medium 下分页条都是 28px,选择器与外层同一行同高);选项文案 `${size} / ${locale.selectionSuffix}`(`:166-175`)自动跟 `NConfigProvider` locale(zh「页」/ en「page」),`{label, value}` 选项原样显示。库里没有手写的 `pageSizePicker`,也没有 `pageSizeSuffix` label。三个已知点:① 受控下内层的越界夹页**永远不触发**(内层用的还是旧 pageSize),改每页条数后的页码重置必须由库做——远程模式在 `onUpdatePageSize` 里 `page = 1`(`useSmartTable` 语义已有);本地模式 Naive 外层会静默把页夹到最后一页、**但不发 `onUpdatePage`**,库的 `localPage` 会陈旧 → 改每页条数时库自己把 `localPage` 置 1 并同步表格页码;② 当前 pageSize 不在 `pageSizes` 里时官方显示裸值 → 传给内层的 `pageSizes` 并入当前值(显示「15 / 页」,并正确标记选中);③ 窄容器:卡片内宽 ≤ 340 会折成多行 → 窄档随 `narrowPager` 整个不渲染 `suffix`。另外,宿主自己传了 `pagination.suffix`、或 `showSizePicker` 为 `false` 时也不画内层选择器。内层选择器绕开了 `NDataTable` 的通知链路,库自己补齐宿主可能使用的 5 种拼写(`pagination.onPageSizeChange` / `pagination['onUpdate:pageSize']`、表格级 `onUpdate:pageSize` / `onUpdatePageSize` / `onPageSizeChange`),每种恰好通知一次;`simple: false` 走官方原生选择器时由 `NDataTable` 自己通知,库不再重复。
- **以下 6 处行为必须成立,各有测试**:
  1. 宿主单表 `pagination.showSizePicker: false` 在 simple 下也要生效 → 取 `user.showSizePicker ?? defaults.showSizePicker`;
  2. `pageSizes` 里的 `{label, value}` 对象不得被丢(不能 `.filter(s => typeof s === 'number')`);
  3. 本地模式库自画选择器改每页条数时要转发宿主的 `onUpdatePageSize`;
  4. 本地模式宿主 `pagination.defaultPageSize: 20` 不得被库的受控 `pageSize` 盖掉 → `localPageSize` 初值取下面「解析优先级」算出的初始每页条数(`pageSize.ts` `resolveDefaultPageSize`,`pagination.pageSize` / `pagination.defaultPageSize` 都在其中;实例 `default-page-size` prop 仍排在它们前面);
  5. 远程模式宿主传 `pagination.pageSize: 10` 时,分页条与首个请求要一致 → 把 `user.pageSize` 同步为 `useSmartTable` 的初始 pageSize,补远程测试;
  6. `simple: false` 回退时,若当前 pageSize 不在 `pageSizes` 里,官方选择器显示**裸值**(如「15」,没有「/ 页」后缀,展开后也不标记选中;spike S2 实测,不是空白)→ 该分支也并入当前值。
- **默认每页条数的解析优先级**(B1):实例 `defaultPageSize` prop > 实例 `pagination.pageSize` / `pagination.defaultPageSize` > 全局 `SmartTableDefaults.defaultPageSize` > **宿主(实例或全局)显式给了 `pageSizes` 时取 `pageSizes[0]`(对象取 `.value`)** > 库默认 100。`SmartTable` 的 `defaultPageSize` prop 的 Vue 默认值是 `undefined`(为了能判断「宿主没给」),由纯函数 `pageSize.ts` `resolveDefaultPageSize` 在**首次 setup 时解析一次**(不是 computed:它只是初值——远程模式是 `useSmartTable` 的初始 `pageSize`,本地模式是 `localPageSize` 的初值;之后改这些 prop 不会重设每页条数,`defaultPageSize` 是初值语义)。全局 `pageSizes` 是否「显式给了」由 `resolveDefaults` 记在 `pageSizesGiven` 上(只给了内置默认的 `[100, 500, 1000]` 不算)。
- **实现落点**:`SmartTable` 的 `defaultPageSize` prop 默认 `undefined` + `resolveDefaultPageSize`;`BUILTIN_DEFAULTS.pageSizes = [100, 500, 1000]`(没开 `fillHeight` 的兜底),开了 `fillHeight` 时由 `resolvePageSizes` 选 `pageSize.ts` 的 `FILL_PAGE_SIZES`(`[100, 1000, 10000]`);宿主(实例 `pagination.pageSizes` 或全局 `pageSizes`)显式给了就照宿主的、不分 `fillHeight`。**无 UI 的导出 hook `useSmartTable` 的默认 10 不动**(`useSmartTable.ts` 仍是 `?? 10`;它不画分页条,B1 只针对 `SmartTable` 组件)。
- 总条数在 `prefix`(宿主 `#pagination-prefix` 插槽提供,库默认没有);窄档(库根节点宽 < 600)不提供 `suffix`,保留 `prefix` 与外层 simple 分页(B4 的 `narrowPager`,P0;实测外层仍是单行 28px)。窄档分页项 40px 只在 `cardOnNarrow` 开启时生效(§5.8)。
- 代价:看不到页码序列、不能一眼点第 N 页(要页码序列用 `pagination: { simple: false }`,B4)。

### 5.6 列宽拖拽(`resizable`,库已有能力,2.1.0)
- **把手视觉(P1)**:把手用官方结构但**静止不画线**,悬停 / 拖动才出现主色竖条(高度 = 整个表头行,`top: 0; bottom: -1px`;拖动时再加一圈光晕),光标 `col-resize`;热区 11px 骑在列界线上(触屏 24px;**触屏**用单指拖动把手:官方 `ResizeButton` 只认鼠标事件,库把单指 `touch*` 转成合成鼠标事件);拖动时一条贯穿整表的 1px 引导线;松手后 150ms 内吞掉 click,不误排序;拖动开始收起过滤气泡。**固定列层叠**:官方 `th` 没有 `overflow` 规则、不是层叠上下文,所以**不需要**把 `th` 改成 `overflow: visible`、也不需要给非固定列递减 `z-index`;只给**相邻的固定列**(fixed-left 的前 6 列)加递减的 `z-index`,把手本身 `z-index: 1`,非固定列的把手滑到固定列底下时不会盖到固定列表头上。
- **吸收余量 = `dk` 方案**(spike S1 在真实 `NDataTable` 上通过全部情形,容器 1000 与 700 各一次,设计文档 9.6):
  - R1 **吸收列** = 最后一个可见、`fixed` 为空、`resizable !== false` 的叶子数据列(被列设置隐藏的不算;是否固定以列设置里的值为准——用户在列设置里取消固定的列按非固定算;`useColumns` 的 `absorber`);没有这样的列(全部 fixed 或都不可拖)→ 退路:最后一个可见叶子列(fixed 也取)。宿主给「操作」列写 `resizable: false` 即退出吸收,**不需要新 API**;`fixed:'right'` 的操作列天然不参与。
  - R2 第一次按下任一把手时 `freezeWidths`:所有可见叶子列与特殊列冻结成实测宽(四舍五入),**唯独跳过吸收列**。
  - R3 钉住后:非吸收列 `width = widths[k] ?? col.width ?? col.minWidth ?? 兜底宽`;吸收列**不写 width**(弹性),下限取 `widths[k] ?? 声明宽 ?? minWidth ?? 兜底宽`(`floorWidth`;**不冻结成实测宽**——冻结值是 Naive 未钉住时摊出来的,成了下限,拖别的列时吸收列不肯缩,实测溢出 61px。例外:一列若先作为非吸收列被冻结 / 拖过、后来才变成吸收列,那份宽度会成为它的下限——身份变化路径上的已知小代价,登记未改);**吸收列永远传 `resizable: false`**(含未钉住时)。
  - R4 退路(全部 fixed / 都不可拖):吸收列 = 最后一个叶子列,显式宽 `max(下限, 容器 − 其余列宽之和 − dragDelta)`,同样不冻结(需量滚动容器 `clientWidth`,`tableKey` 变化后重量)。
  - R5 `scroll-x`(钉住后)= Σ非吸收列宽(含特殊列)+ 吸收列下限(退路用 R4 的显式宽)+ `dragDelta`,必须始终 ≥ Σ下限(`scroll-x` 小于容器时官方会把各列按比例拉伸,钉住的宽度不被遵守,设计文档 9.3);`dragDelta = limitedWidth − widths[拖拽列]`(每帧),松手清零;拖拽期间不重建列数组,只有 `scroll-x` 随帧变。
  - R6 **重挂**:Naive 把拖过的列记进内部 `resizableWidthsRef`(`use-resizable.mjs:5-16`;`use-group-header.mjs:24`、`utils.mjs:38-43`:此后 `<col>` 的 width / min / max 全用拖拽值,不看 `column.width`,也不看 `column.resizable` 现在是什么),**且没有清除入口**(`clearResizableWidth` 不在 `exposedMethods` 里,`DataTable.mjs:269-287`),唯一办法是重挂。库维护 `draggedKeys`(本次挂载期间触发过 `onUnstableColumnResize` 的列 key,每次 `tableKey` 变化清空);吸收列身份变化时(隐藏 / 显示 / 调顺序 / 设固定 / columns 变化),若表格已钉住且新吸收列 ∈ `draggedKeys` → `tableKey++`(实测重挂后该列 `<col>` 上 Naive 残留的 `width / min-width / max-width` 被清掉)。从 storage 恢复的宽度不在 Naive 里留残留,不需要重挂。
  - R7 吸收列身份变了之后,旧吸收列(从未被冻结)退回声明宽(实测 189 → 150,无留白),可接受。
  - **代价(CHANGELOG B8 已写明)**:**吸收余量的那一列没有拖拽把手**——向左拖它本来没有持久效果、向右只是横向撑大;要调它左侧的边界就拖左邻列的把手。备选 `da`(吸收列拖拽结束即 `tableKey++`)最终结果也对,但向左拖时其余列临时被拉宽 16–43px、松手后横向 `scrollLeft` 跳回 0,所以不采用。
  - **不采用的做法及原因**(均已实测):「吸收列不写宽度 + `scroll-x` = 各列下限之和」单独用,在拖吸收列往窄、先被拖过的列变成吸收列、全 fixed 末列等情形失效(其余列被拉宽);「吸收列冻结成当前渲染宽」在最普通的拖非吸收列就溢出;「钉住态下吸收列 `resizable:false`」更糟(第一次拖的正是吸收列时首帧后把手被卸载、拖拽中断、Naive 已记下残留宽度)。
  - 已知代价:拖拽起点取**此刻实际渲染宽度**;表头 DOM 不再有占位列。
  - 与 `flex-height` + 虚拟滚动叠加时结果逐项相同;钉住后容器宽变化(1000 → 1300 → 600 → 1000)吸收列跟着填满 / 落到下限 / 复原。
- 图标不被把手挤:右内边距 16px;拖拽下限见 B12。
- 宽度随 `storageKey` 持久化(已有)。

### 5.7 密度与表头图标
- 默认 `compact`,映射官方 `size`:舒适 = `medium`、紧凑 = `small`。默认主题下实测行高舒适 47.4 / 紧凑 39.4(`single-line: false` 带单元格竖线;`fillHeight` 的 `min-row-height` 48 / 40 就是它们的 `ceil`),表头高 39.4(紧凑)。
- 图标顺序 **标题 → 漏斗 → 排序箭头**;漏斗按钮 22 × 22(§5.3)。间距 8 / 6px 与表头右内边距 16px(纯 CSS:漏斗触发器 `margin-left: 8px`、排序箭头 `margin-left: 6px`、`.n-data-table-th { padding-right: 16px }`、`.smart-table-th { gap: 0 }`;B12 的下限 93 / 102 / 123 就是按这个布局算的)。**图标簇紧跟标题**:官方 `th__title-wrapper` 改 `inline-flex`、`th__title` 改 `flex: 0 1 auto`(官方 `flex: 1` 在标题居中时把箭头挤到格子最右);列上写了 `ellipsis` 的可排序列,官方省略号盒子的 `max-width: calc(100% - 18px)` 还原成 `100%`,免得漏斗被裁。闲置 `opacity: 0`(仍占位,不回流),悬停该列表头时箭头与漏斗淡入(0.15s);`:focus-within`(键盘 Tab 到漏斗)只让漏斗淡入,排序箭头不跟(官方排序表头本来就没有键盘操作,§5.4);常驻例外:正在排序的列箭头(`n-data-table-th--sorting`)、已筛选的列漏斗(`--active`)、面板打开的那一列漏斗(`--open`)。用官方类名 `.n-data-table-th .n-data-table-sorter` 写 CSS 即可(已验证)。实测 center / left / right 三种对齐与拖到下限 123 时间距都是 8 / 6、箭头到右缘 ≥ 16,表头高恒为 39.4。
- 落地 CSS 要求:① 常驻例外的选择器优先级**不得低于**隐藏规则(例:隐藏规则 `.smart-table :deep(.n-data-table-th .smart-table-filter-trigger)` 是 (0,4,0),例外规则要写成 `.smart-table :deep(.n-data-table-th .smart-table-filter-trigger--active)` 同级或更高,否则已筛选 / 面板打开的漏斗不常驻);触屏兜底里同理;② 排序箭头的过渡写成 `transition: opacity .15s, color .3s var(--n-bezier)`(只写 `opacity` 会覆盖 Naive 自带的 `color` 过渡)。

### 5.8 窄档卡片(P2,`cardOnNarrow`)
- 列 → 卡片字段:默认零配置(第一个数据列作标题,其余「标签:值」两列,操作列放底部);列上 `card` 覆盖。**操作列 = `card: 'action'`,否则最后一个 `fixed: 'right'` 的列**。
- 卡片固定**舒适间距**(不响应密度);无描边,8px 间距 + 极淡底色 + 「操作」行上方 1px 分隔线;勾选框在右上角,热区 44×44;「编辑 / 删除」44×44;字段值单行省略(虚拟滚动需要等高)。
- 点卡片 = 现有 `rowClick`;列设置里隐藏的列卡片里同样隐藏。窄档工具栏 2 行(行 1 标题 + 操作 + 三图标,行 2 输入框 + 筛选);有可排序列时再多一行「排序」按钮,见下。
- **实现要点**:
  - **「排序」入口位置(以原型窄档实际渲染为准)**:不在行 1 的图标里、也不在行 2 的「输入框 + 筛选」里;原型只有**列头模块(m3 / m4)**在行 2 之下多一行(行 3)等分的「筛选 | 排序」两个文字按钮(角标 = 生效条数),其它模块只有 2 行。库照此:有可排序列时,工具栏最下面多一行整行宽的「排序」按钮(`smart-table-toolbar-sort`,角标 = 生效排序条数);没有可排序列就不画。→ 没有可排序列时窄档工具栏是 2 行,有排序列时是 3 行。
  - **结构**:卡片列表是 `CardList.vue`(`src/cardColumns.ts` 做列映射、`src/cardRows.ts` 做本地排序 + 分页切片);`NDataTable` **仍然挂着**,只用 CSS 藏掉表头与表体,留下官方 `simple` 分页(加载转圈也藏,卡片列表自己淡出)——分页 / chips 所在的 `pagination.prefix` / 本地页码 / 远程页码通知都不用重写。分页项放大到 40px 走 `pagination.size: 'large'` + `themeOverrides.itemSizeLarge`,输入框 / 下拉走 `NConfigProvider` 的 `componentOptions.Pagination`。卡片列表**不做虚拟滚动**(窄档不能改每页条数,默认每页 100),`fillHeight` / 放大态下撑满的是卡片列表自己的滚动。
  - **勾选 / 展开 / 拖拽**:卡片右上角勾选框读写宿主的 `checked-row-keys`(没绑则内部兜底);展开列的内容显示在卡片底部,显示哪些行读宿主的 `expanded-row-keys`(没绑就没有展开入口);拖拽:`card: 'handle'` 的列渲染在标题行最左,sortablejs 绑在卡片列表上。行号:可拖拽的卡片(`row-draggable`)在标题行末尾、勾选框之前显示行号(同原型 m10 的 `.rc-no`),序号列本身在卡片里仍不作为字段;不可拖拽的卡片不显示行号。
  - **工具栏折叠**:`Toolbar` 的 `fold`(= `cardOnNarrow` 且窄档,批量栏出现时不折叠):「操作 ▾」是官方 large 档 quaternary 按钮,展开原位多一行(不是浮层、不加动画)、等分业务按钮与「更多」;控件放大到 large 靠官方 `NConfigProvider` 的 `componentOptions.Button.size`(宿主自己写了 `size` 的按钮不受影响);图标按钮 40×40、间距 0(列设置按钮经 `ColumnSettings` 的 `size` 同步);「更多」菜单选项高 44px = Dropdown 主题变量 `optionHeightMedium`。
  - **未做**:列头**筛选**的底部抽屉(§3 末行「列头面板在窄容器换底部 `NDrawer`」):`ColumnFilter` 的面板与 `NPopover` 触发器耦合,拆成可放进抽屉的面板需要单独重构;窄档下只有模式 2 条件构造器(「输入框 + 筛选」)能筛选。

### 5.9 条件模型:15 个操作符
对「条件模型对齐 Bootstrap Blazor」约定的**有意扩展**:`FilterAction` 由 8 个扩到 15 个,`FilterLogic = 'and' | 'or'` 不变;求值与远程序列化在 `filter.ts`(UI 无关、可单测)。扩操作符要同时动:`types.ts` 枚举 → `filter.ts` 求值 → `labels.ts` 文案 → 测试。

| 操作符 | 值形状(`actionValueKind`) | 语义 |
|---|---|---|
| `equal` `notEqual` `contains` `notContains` `gt` `gte` `lt` `lte` | 标量 | 2.1.1 原样不变 |
| `isNull` / `isNotNull` | **无值**(`NO_VALUE_ACTIONS`) | 单元格为空 = `null` / `undefined` / 空白串 / 空数组;`0`、`false` 不算空;`isNotNull` 取反 |
| `startsWith` / `endsWith` | 标量 | 忽略大小写的前缀 / 后缀匹配;单元格为 `null` / `undefined` 不匹配 |
| `like` | 标量 | SQL `LIKE`:`%` 任意长度、`_` 单个字符,**整串匹配、忽略大小写**,其余字符按字面量(`a.c` 不匹配 `abc`);**不支持转义**(没有 `\%` / `ESCAPE`,`%` / `_` 一律是通配符);空单元格不匹配。实现是线性的双指针通配符匹配(`wildcardMatch`),不走正则(把 `%` 翻成 `.*` 的写法有 ReDoS,21 字符的模式实测卡 40 秒) |
| `in` / `notIn` | **数组** | 单元格与其中任一项 `equal`(沿用 `equal` 的跨类型与整天语义)即命中;`notIn` 取反;空单元格时 `notIn` 为真(与 `notEqual` 一致);值不是数组 → `in` 与 `notIn` **都为假**(fail-closed,畸形 `notIn` 不能在 `or` 下放行整列);空数组的 `in` 不生效 |

- **无值算子**(原 C4):值为空也算「写了」,`activeConditions` 不得丢弃,序列化与求值都要带上;有值类算子的空值仍被丢弃(口径不变)。`NO_VALUE_ACTIONS` 运行时 `Object.freeze`(`readonly` 只是编译期约束)。
- **数组单元格**:`contains` / `notContains` 逐元素匹配(避免 `[1,22,3]` 误中 `'1,2'`);`startsWith` / `endsWith` / `like` 按 `String(cell)`(逗号拼接)匹配,逐元素语义未定义(已登记,未改)。
- **未知 action 一律 fail-closed**(按不匹配处理,`filter.ts` `matchCondition` 的 `default` 分支):fail-open 会让 `or` 逻辑下整列过滤被一条脏条件悄悄短路成「放行全部」。
- **列头面板默认集合 = 2.1.1 原样**(`useColumns.ts` 的 `DEFAULT_ACTIONS`,与 2.1.1 相同;`deriveFilterDefs` 每列拷贝一份,调用方改了也不污染其它列):input:`contains / notContains / equal / notEqual`;number、date:`equal / notEqual / gt / gte / lt / lte`;select:`equal / notEqual`。宿主在列上显式写 `filter.actions` 才会出现新操作符。
- **推荐集合**(宿主显式写 `filter.actions` 时的参考;**模式 2 条件构造器(P1)默认使用**):input:`contains / notContains / equal / notEqual / startsWith / endsWith / like / isNull / isNotNull`;number、date:`equal / notEqual / gt / gte / lt / lte / isNull / isNotNull`;select:`equal / notEqual / in / notIn / isNull / isNotNull`。

## 6 落地必须满足的要求(来自验证,设计文档第 9 节)

1. **放大**(P1):切换前记下表格 `scrollTop`,切换后恢复(Teleport 搬 DOM 会清零);切换后把焦点还给按钮(**只在键盘操作后才还**,`keydown` / `pointerdown` 追踪;无条件还会出现黑色焦点环);放大期间锁背景滚动(`html { overflow: hidden }`,退出还原原值);`z-index` 可配置。
2. **列头面板**:自己管焦点与 Esc(见 §5.3)。
3. **分页**:`suffix` 放官方嵌套 `NPagination`(`displayOrder: ['size-picker']`),6 处回归必修,改每页条数后库自己重置页码(§5.5)。
4. **余量**:`dk` 方案(§5.6),通过 S1 全部情形;吸收列没有拖拽把手写进 CHANGELOG。
5. **批量栏**(P1,已落地)与工具栏同一 `min-height`。
6. 所有新文案走 `labels.ts`、渲染期求值;新键可选、库自带英文默认、中文走 `zhCNLabels`(§3)。
7. **CHANGELOG / README 与实现一致**:B 级变更每项带回退方式(B1 写明单列后端上限风险与 `fillHeight` 的用法,B2 写明 `loadState` 公开导出的返回值变化,B8 写明吸收列没有拖拽把手),C2 显著标注,类型层面变更(`FilterAction` 联合 8 → 15)单列;新增导出与 `index.ts` 一致;README / README.en 里涉及默认值的描述不与 CHANGELOG 矛盾。

## 7 测试要求

- **要锁住的行为**:分页默认值与 `pageSizes`、密度默认与存储回退、`activeConditions` / `filterValueToOptions`、排序回显与远程参数、`storageKey` 读写。B 级默认值变更对应的特征测试断言新值(例:`tests/config.test.ts` 锁 `pageSizes` 的内置默认 `[100, 500, 1000]`)。
- C1、C2、C3、C5 每个有复现测试;`isOptionsRepresentable` 各分支(`notEqual` / `isNull` / `and` 多 `equal` / 单 `in`);同字段「或」;无值算子;`defaultSortOrder` 进入首次请求(**含静态 data 模式**);多列远程参数;单列行为回归;`sort()` / `clearSorter()` 转发 `onUpdate:sorter` 的载荷形状(单列 / multiple);孤儿键 chip;面板 Esc / Tab 循环(§5.3)。
- C6:宿主 `@update:sorter` 的 spy 点一次表头恰好被调 1 次(点击与 `sort()` / `clearSorter()` 各一条);`loadState(key, fallbackDensity)` 的回退;
- 分页 6 处回归(§5.5)各一条;本地模式改每页条数后 `localPage` 置 1;默认页大小解析优先级各一条(含只写 `pageSizes`、全局 `defaultPageSize`)。
- 列宽(真实浏览器,**必须覆盖**):拖非吸收列、(吸收列无把手,确认不可拖)、隐藏最后一列、先拖 B 再让 B 成为吸收列(应重挂一次)、全部 fixed、含 `fixed:'right'` 操作列、未 fixed 且 `resizable:false` 的操作列;拖拽过程中其余列不动、被拖列 1:1 跟手、无溢出。
- `fillHeight`:父容器定高下填满、分页条在底部可见、DOM 行数远小于每页行数、滚到底最后一行完整可见(`min-row-height` 取 `ceil(真实行高)`);不开时翻页回卡片顶部(只在卡片顶部已滚出视口时滚)。
- 容器宽 390 / 560 / 720 / 1024 下工具栏 `scrollWidth ≤ clientWidth` 且控件 `right ≤ 内容区右边界`;分页在真实浏览器里渲染、选择器、翻页。
- **对照原型**:`/prototype.html` 与原型 `design.html` 同视口(1440 × 900,浅 / 深)同一套 DOM 读数一致:工具栏(标题 `16px | 500 | rgb(31,34,37)`、更多 72 × 34、间距 8 / 12 / 4、图标 16px)、漏斗(22 × 22 / 15 / 灰 / 角标 12 × 12 在 `dx 15 / dy −3`)、列头面板(400 × 123 / 400 × 163、网格读数)、chips(22px、`56 × 22` 的清除按钮紧跟)、搜索区「展开」与同排居中、列设置只剩一列时勾选框禁用、390 宽面板 `left = 8` 不出屏;**扣掉原型 `.n-btn` 的 1px 真实边框造成的 2px 宽度差**(官方 `NButton` 的边框不占布局,按 G3 应改原型)。
- 视觉基线:`docs/baseline/` 是**原型**的截图基线;库侧用 `/prototype.html` 对照页 + DOM 读数(`tools/parity`)代替截图基线,尚无基于真实组件的截图基线。

## 8 YAGNI —— 明确不做

`headerIcons: 'always'` 开关;`sortSerializer`;图标注入 API;只读排序态对外暴露;双击把手重置列宽;手机上调整排序优先级;卡片模式自动开启;官方 `renderFilterMenu` 承载;优先级序号(除非实测看不懂);排序 / 过滤态持久化。

## 9 未验证清单

- 只测了 Chromium(Playwright / Edge 无头 + CDP 驱动,触屏兜底用 CDP 设备模拟):**Firefox / Safari** 未测(`@media (hover: none)`、`color-mix()` 焦点环、`MutationObserver` 夹取、Teleport 后滚动恢复)。只在 naive-ui **2.45.3** 上验证过。
- 真实手指触屏、屏幕阅读器(`role="dialog"` / `aria-*` 只在 Chromium 无障碍树里核对过)。
- **宿主真实后端对 `pageSize: 100` 的接受度**(B1;只能由各宿主自己确认)。
- 已知但未修的边角:列头面板打开期间**自身宽度变化**不重新夹取(§5.3「不出屏」);英文默认 labels 下第 2 行起的且 / 或下拉(56px 宽)放不下「AND」会被截断(中文「且 / 或」放得下;原型只有中文所以没暴露);开了密度按钮(`toolbar.density: true`)且存储里有记录但缺 `density` 字段时,`defaultDensity` 在挂载后不再响应;开了密度按钮时「恢复默认」清掉了存储里的密度,但当前显示的密度要到下次加载才回到 `defaultDensity`。
- **spike(设计文档 9.6)的未测项**:S1 多级表头(`children`)下的吸收列、勾选 / 序号 / 展开等特殊列钉住态下与吸收列的联动、触屏拖拽、`minWidth` 夹紧与吸收列下限同时生效的边界、宿主传 `scroll-x` / `table-layout` 覆盖;S2 选项很多时的菜单滚动 / RTL、宿主自定义 Select `theme-overrides`;S3 多于 2 行条件下的下拉记录(2 行时第 2 行的且 / 或下拉已在 P0 实测:第一次 Esc 只收下拉)、`NInputNumber` / 多选 tag 的 Esc、屏幕阅读器朗读 `role="dialog"`、`daterange` 日历内按 Esc、窄档抽屉(P2);S4 横向滚动 + 虚拟滚动的表头联动、宿主自定义 `themeOverrides` / 多行文本 / `ellipsis` 下的行高估计、`loading` 遮罩位置(`fillHeight` 下翻页后表体复位已在 P0 浏览器验证里确认)。
- 放大:宿主真实 z-index(P1 只用了 playground 的假顶栏)、`ResizeObserver` 与 Teleport 配合、虚拟滚动下滚动恢复(Firefox / Safari 下的 Teleport 后滚动恢复未测)。
- **其它未测项**:Firefox / Safari 下的 `color-mix()`(把手光晕)与 `@media (hover: none)`;真实手指触屏拖列宽(只用触摸模拟 + 合成事件验证);窄档抽屉里长列表(> 85vh)的滚动手感;构造器里日期选择器随 `NConfigProvider` locale 切换后的文案。
- 列宽:真实触屏手指拖拽;Firefox / Safari 下的拖拽。
- 多条件面板(B7)在真实 `NPopover` 里的整体表现**已在 Chromium 实测**(焦点进入 / Tab 循环 / Esc 分层 / 点外部 / 自定义面板 / ARIA 九项与排布读数);其它浏览器未测。「更多」菜单的方向键(依赖官方 `NDropdown` 的 `keyboard`,只确认属性存在);批量栏里「更多」不显示(P1 已在对照页的真实浏览器里确认)。
- 卡片模式(P2)、批量栏(P1)在真实 `NDataTable` 上(`fillHeight` 已由 spike S4 与浏览器验证覆盖)。
