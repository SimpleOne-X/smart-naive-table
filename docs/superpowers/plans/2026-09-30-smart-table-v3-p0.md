# SmartTable 3.0.0 · P0 实现计划(→ `3.0.0-beta.1`)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把设计规格里 **P0** 的全部内容(B1–B9、B11、B12、C1–C5、多列排序 API、`filterChips`、`toolbar.more`、触屏兜底、新 labels)落到 `src/`,**并把原型对照页 `/prototype.html` 放进 playground、把「真实库外观与设计原型不一致」的 P0 项(L0-1…L0-9、N11)对齐(Task 13b–13g)**,发布前的最后一个提交是 `3.0.0-beta.1` 的版本号与 CHANGELOG。

**Architecture:** 库是「胶水层 `SmartTable.vue` + 纯 TS 内核(`filter.ts` / `useColumns.ts` / `useFilters.ts` / `useSmartTable.ts`)+ 几个小 SFC(`ColumnFilter` / `Toolbar` / `SearchForm` / `ColumnSettings`)」。本计划沿用这个分层:**新逻辑优先写成可在 node 环境单测的纯函数**(`sorts.ts` / `filterDraft.ts` / `filterChips.ts` / `searchCols.ts`),SFC 只做接线与渲染。每个默认行为变更(B 级)在**同一个提交里**翻转对应的特征测试。

**Tech Stack:** Vue 3.5、naive-ui 2.45.3(以本地 `node_modules/naive-ui` 为准)、TypeScript、vitest 3(jsdom 环境用文件头 `// @vitest-environment jsdom`)、`@vue/test-utils`、vue-tsc。**不新增任何依赖。**

**Spec:** `docs/smart-naive-table-spec.md`(P0 落地后的目标状态;**规格与本计划应一致,执行中发现冲突,停下来报告,不要自行取舍**);决策过程见 `docs/smart-naive-table-design.md`;真实组件验证见其第 9 节与 `docs/spike/`。

**范围说明(重要)**:规格里 P1(模式 2 条件构造器 + 窄档抽屉、`#batch`、放大)与 P2(`cardOnNarrow`,含窄档「操作 ▾」折叠与列头面板的底部 `NDrawer`)**不在本计划内**,将各自另出计划(`…-v3-p1.md`、`…-v3-p2.md`),理由是它们彼此独立、都是可选属性、各自能产出可测试的软件。

> **状态**:Task 7(分页)、Task 12(吸收余量)、Task 12b(`fillHeight`)已按真实浏览器 spike(`docs/spike/s5`–`s8`,结论见设计文档 9.x)定稿;每个 Task 的代码都在沙盒里从 `main` 起整条重放验证过(见各 Task 的 Expected,全是实测数)。**各 Task 的「浏览器验证」步骤本轮没有执行**(只写成可直接照做的步骤:前置条件、URL、要读的 DOM 值、期望数字),实施时必须真的做并记录。

### 与规格 / 设计的差异(R-3)

**规格已同步为本计划的目标状态,本表只记录变化的来由**(「修订前」一列是评审前的原规格 / 原计划写法)。规格与本计划应一致;**执行中发现冲突,停下来报告,不要自行取舍**;Task 14 Step 4 再逐条核对规格与实现。

| # | 条目 | 修订前(原规格 / 原计划) | 本计划 | 原因 |
|---|---|---|---|---|
| 1 | 15 个 `FilterAction` 的归属 | 归 P1(随模式 2) | **操作符的纯逻辑(类型、求值、labels、序列化、无值算子)提前到 Task 2**;模式 2 UI 仍是 P1 | B7 的列头多条件面板要用 |
| 2 | 列头面板默认可选操作符(D1) | 随 B7 扩到 15 个 | **保持 2.1.1 的 8 个**;新操作符只在列上显式写 `filter.actions` 时出现 | 否则已有过滤列升级后会多出旧后端不认识的 action |
| 3 | C4(无值算子) | 缺陷修复 | **改记为「新增」** | 2.1.1 的 `FilterAction` 没有 `isNull`,旧缺陷不可达 |
| 4 | B10(模式 2 默认多一行 chips) | P0 | **随 P1**;P0 里 `filterChips` 只是默认 `false` 的新增 | 模式 2 UI 在 P1 |
| 5 | B12 后半(`th` `overflow:visible` + 递减 `z-index`、把手骑线)与把手视觉(高度 70%、热区 11px / 触屏 24px、引导线、150ms 吞 click、拖动收起气泡) | P0 | **推到 P1 视觉任务**;P0 只做下限与 §5.7 的图标间距(8 / 6px)、右内边距 16px、触屏图标淡显 | 需要在带 `fixed` 列的表上逐列核对层叠;24px 热区与现有 `::after` 竖条错位 |
| 6 | B4 的 `simple` | 「新增开关」 | **复用官方 `pagination.simple` 属性,不是新 API** | 官方自己的属性 |
| 7 | 「更多」菜单选项类型 | `DropdownMixedOption[]` | **`ToolbarMoreOption`**(= `NonNullable<DropdownProps['options']>[number]`) | `DropdownMixedOption` 不是 naive-ui 的公开导出 |
| 8 | 面板按钮文案(D9) | 取官方 locale 的 `confirm` / `clear` | **沿用已发布的 labels `filterConfirm` / `filterReset`**(英文默认 `OK` / `Reset`);新增 `zhCNLabels` | 官方 `useLocale` 只在 `_mixins` 内部导出,公开入口取不到;新增 label 键**全部可选** |
| 9 | 卡片内边距回退(D10) | `theme-overrides: { Card: { paddingSmall } }` | **组件级是扁平 `{ paddingSmall }`**;新增 `cardProps?: Partial<CardProps>` 作回退入口;旧值更正为 **20 / 24 / 20**(不是 19 / 24 / 20),2.1.1 没有窄档 12 / 16 | `_mixins/use-theme.d.ts:23-25`、`card/src/Card.d.ts:90`;`card/src/styles/index.cssr.mjs` 内容区 `padding-top` 取 `--n-padding-bottom` |
| 10 | 窄档专属行为(D12) | 窄档折叠成「操作 ▾」、列头面板用底部 `NDrawer`、「更多」菜单窄档 44px 选项高 | **归 P2**(`cardOnNarrow` 门控);P0 / P1 下窄、宽容器用同一套工具栏与 `NPopover` 面板。**例外**:B4 的窄档分页(窄档不画每页条数选择器)仍在 P0 | 不在 B 级清单、没有回退、计划里没有对应 Task |
| 11 | `sort()` / `clearSorter()`(D7) | 只写了方法名 | **对齐官方签名**(`order` 缺省 `'ascend'`,空 `columnKey` = `clearSorter()`),并向宿主的 `onUpdate:sorter` 转发一次 | 官方 `use-sorter.mjs:105-118` |
| 12 | 面板键盘 / ARIA(D6) | Esc 关闭、焦点进出 | 另加:下拉展开时 Esc 只收下拉、点空白处焦点收回面板、Tab 循环、`role="dialog"` / `aria-haspopup` / `aria-expanded`;自定义面板 `def.render` 不自动聚焦,但面板打开时 Esc 会关(焦点在面板内、或还停在漏斗按钮上都行;2.1.1 不会) | NSelect / NDatePicker 收起自己时不 `stopPropagation` |
| 13 | 点漏斗不触发排序(Q-6) | `@click.stop` | **官方 `data-data-table-filter`**,不再 `stopPropagation` | 官方 `Header.mjs:107-108` 有现成跳过标记;`stop` 会吞掉宿主的 click 监听 |
| 14 | C5 的列数来源(Q-9) | 按视口宽度 + naive 默认断点推算 | **渲染后读 `n-grid` 根元素 `getComputedStyle(el).gridTemplateColumns` 的轨道数** | 自定义断点下推算会错;`resolveCols('s:2', 300)` 会得 `NaN` |
| 15 | B2 写入端(Q-1) | (未提) | 保存列设置 / 列宽**不写**当前密度,只有 `setDensity` 才写 | 否则宿主回滚 2.1.1 后用户被固定在 compact |
| 16 | `defaultSortOrder` 的读取时机(Q-10) | (未提) | 只在首次 setup 读一次;异步列请用 `sort()`;静态 `data` 模式同样生效 | `deriveInitSorts` 的实现范围 |
| 17 | B8 吸收余量的机制(E1) | 规格 §5.6 / §6.4:主方案「吸收列不写宽度 + `scroll-x` = 各列下限之和」,吸收列也冻结成当前渲染宽 | **`dk` 方案**:吸收列 = 最后一个可见、非 fixed、`resizable !== false` 的叶子列;钉住后不写 width、下限取声明宽 / `minWidth`(不冻结);**它永远 `resizable:false`(没有拖拽把手)**;拖过的列后来成为吸收列时 `tableKey++` 重挂;全部列 fixed / 不可拖时最后一列写显式宽度 `max(下限, 容器宽 − 其余列宽 − 拖拽增量)` | 真实 `NDataTable` 实测(spike S1):Naive 把拖过的列记进内部 `resizableWidthsRef`(无清除入口),原方案在「拖吸收列往窄」「先拖过的列后成吸收列」两种情形失效;冻结成渲染宽会让「拖普通列」溢出 61px。**代价:吸收列没有把手**(设计 3.11 预期「最后一列仍有把手」被推翻,用户可推翻,备选 `da`) |
| 18 | 每页条数选择器、`defaultPageSize` 解析(E2 / D3 / D4) | 库自画 `NSelect` + 新 label `pageSizeSuffix` | **官方嵌套 `NPagination`(`displayOrder: ['size-picker']`)放在外层 simple 分页的 `suffix`;不新增 `pageSizeSuffix`**;当前值并入 `pageSizes`;窄档(库根节点宽 < 600)不画;本地模式改每页条数时库自己回第 1 页并调官方 `page(1)`;`defaultPageSize` 解析优先级:实例 prop > `pagination.pageSize` / `defaultPageSize` > 全局 `defaultPageSize` > 宿主显式给的 `pageSizes[0]` > 100;`SmartTableDefaults` 新增 `defaultPageSize?` | spike S2:文案自动跟 locale(中文「100 / 页」)、同一行同高、明暗同主题、支持 `{ label, value }`;内层受控下不夹页,所以 `localPage` 要库自己管 |
| 19 | `fillHeight`(D5 / E4) | 规格把它放 P1 | **最小实现提到 P0(Task 12b)**:官方 `flex-height` + `virtual-scroll` + `min-row-height`(紧凑 40 / 舒适 48 = `ceil(真实行高)`),兜底 `min-height: 160`,父容器须定高;不开时翻页后若卡片顶部已滚出视口则滚回(点击当下判断) | spike S4:每页 100 / 1000 行不压缩到卡片内滚动就是整页长滚动、1000 行 DOM;`min-row-height` 取官方默认 28 时滚到底最后一行看不全 |
| 20 | `onUpdate:sorter` 双调用(C6,E5) | (未提) | **Task 4 一并修**:从 `forwardedAttrs` 摘掉 `onUpdate:sorter`,由 `onSorterChange` / `sort()` / `clearSorter()` 统一转发一次 | 2.1.1 每次点表头会把宿主的 `onUpdate:sorter` 调两次(`use-sorter.mjs:31-37`);既然 Task 4 已经改了转发,留着会让「转发一次」的测试断言不成立 |
| 21 | `loadState` 的密度回退(E6) | (未提) | `loadState(storageKey, fallbackDensity = 'compact')` 新增可选第二参数;`useColumns` 传宿主解析后的 `defaultDensity`(并在读存储前用 `peekStoredDensity` 判断) | 2.1.1 存储有记录但没有 `density` 字段时写死回退 `'comfortable'`,会盖过宿主值 |
| 22 | 过滤面板 Esc 的阶段(E3) | (未提) | 面板上 `@keydown.capture` + 下拉展开计数器;容器 `tabindex="-1"` 让点空白处焦点回面板(不用 mousedown 处理) | NSelect / NDatePicker 收起自己时只 `markEventEffectPerformed`,不 `stopPropagation`;spike S3 |
| 23 | 对齐设计原型(G0 / G3) | (未涉及:Task 1–13 只对齐规格) | **新增 Task 13b–13g**:原型对照页进仓库(13b)+ 工具栏 / 搜索区(13c)+ 漏斗 / 角标 / 过滤列标题(13d)+ 列头面板与不出屏(13e)+ chips(13f)+ 列设置至少保留一列与类型补全(13g)。原则:外观以原型为准(改库)、功能取并集、与官方冲突改原型 | 用户要求预览页与原型「一模一样」;L0-8(窄档分页项 40px)与窄档抽屉 / 卡片归 P2,不做 |
| 24 | 卡片标题 / 工具栏分组与间距 / 图标尺寸(L0-1、L0-2) | 标题 600 / `textColor2`;右侧全部间距 4;「更多」small;图标 18px | 标题 500 / `textColor1`;业务组 8 / 图标组 4 / 组间 12;「更多」medium;图标 16px | 原型 `.st-title` / `.tb-actions` / `.tb-icons` / `.tb-right`;**2.1.1 外观变化,CHANGELOG 记「外观调整」并给回退** |
| 25 | 漏斗按钮(L0-3、L0-4,G6) | `NButton tiny` 26 × 22、`textColor1`;角标行内占宽;过滤列标题折行 | **原生按钮 22 × 22**、灰(`thIconColor`)、悬停 / 打开只加底色;角标绝对定位;过滤列标题单行省略(`.smart-table-th-text`) | B12 的下限 102 / 123 按 22px 才对;**2.1.1 外观变化,CHANGELOG 记「外观调整」** |
| 26 | 列头面板排布(L0-5) | 无引导标签、且 / 或是行下分段按钮、「添加条件」主色、底部靠右、options 间距 28 / 宽 200 | 首列「条件」/ 且或下拉、4 列网格、「添加条件」深色文字按钮(带加号)、底部 `space-evenly`、options 间距 34.4 / 宽 168、「高级条件 ▾」、含勾选无法表达的条件时给提示;**新增可选 labels `filterConditionLead` / `filterCannotCollapse`** | 原型 `.hpop`;初始焦点(第一个可聚焦控件)与值输入的清除 ×(保留)都以原型第 1 批为准,库不改 |
| 27 | 面板不出屏(L0-9) | `NPopover` 居中,390 宽下左缘 `x = −69` | 量 `NPopover` 定位容器、`clampShift` 加水平平移夹进视口;窄档抽屉仍 **P2** | 公开 `NPopover` 没有夹取开关;不量面板自己(弹层有缩放进场动画) |
| 28 | 单选过滤(`filter.multiple: false`) | `NCheckbox` 模拟单选 | **官方 `NRadioGroup` / `NRadio`** | 官方 `HeaderButton/FilterMenu.mjs:118-141`;原型第 1 批已改;**2.1.1 外观变化,CHANGELOG 列入** |
| 29 | chips 外观与行末按钮规则(L0-6) | 灰 NTag、行高 30、「清除全部」靠右且 1 个 chip 也出现 | 主色可点、22px、间距 8 / 12、清除按钮紧跟;有默认值的表偏离默认才「恢复默认」,否则 ≥ 2 个才「清除全部」(`filtersAtDefaults`) | 原型 `.chips` / `hfClearShown`;chips 是 P0 新增,不进 B 级 |
| 30 | 列设置至少保留一列(N11) | `toggleShow` 允许全部取消 | 只剩一列可见时那一列的勾选框禁用(无提示),`toggleShow` 兜底拒绝并返回 `false` | 原型第 1 批:禁用而不是 toast;**2.1.1 行为变化,CHANGELOG 记「外观调整」,回退「无」** |
| 31 | `SmartTableProps` 类型 | 没有 `rowDraggable` / `dragHandle`(`SmartTable.vue:84-85` 有) | 补上两个可选属性 | 纯类型补全 |

## Global Constraints

- 库已发布到 npm(当前 `2.1.1`),消费方是别人的后台系统。本计划只产出 `3.0.0-beta.1` 的代码与版本号,**不执行 `npm publish`**(由用户在 `feat/v3-p0` 分支上手动 `npm publish --tag beta`)。**⚠ beta 不要合入 `main`**:push 到 `main` 会触发 `.github/workflows/publish.yml`,它执行不带 `--tag` 的 `npm publish`,预发布版本要么因缺 `--tag` 失败、要么被发成 `latest`;该 workflow 不在本计划范围内,**不要改它**(是否改 CI 由用户决定)。
- **以 naive-ui 官方为准**:任何组件用法、属性名、主题变量,不凭记忆写,核对本地 `node_modules/naive-ui/es/**/*.d.ts`(已在本计划中核实的事实都写在对应 Task 里)。
- **不新增依赖**(vite / vue / naive-ui / vitest / @vue/test-utils / vue-tsc 已有)。
- **labels 在渲染期求值**(不在 `setup` 期解成字符串,否则切换语言失效);所有新增文案走 `src/labels.ts` 的英文默认 + `SmartTableLabels` 类型。**新增的 label 键一律声明为可选(`?:`,D9)**,库内部一律用 `Required<SmartTableLabels>`;每个加键的 Task 要同步补 `defaultLabels`(英文)与 `zhCNLabels`(中文),`tests/config.test.ts` 的完整性用例会守住。
- **B 级默认变更**必须在 CHANGELOG 写「旧 → 新 + 回退方式」;**C2(`defaultSortOrder` 升级后突然生效)** 要显著标注。
- **测试纪律(用户的 CLAUDE.md)**:测试失败时**不要**改断言、加 `skip` 或放宽阈值来让它变绿,先定位原因。**唯一例外**是本计划明确标注「有意翻转」的特征测试——它们锁的是 2.1.1 的旧默认值,翻转必须与对应的 B 级变更在同一个提交里,并在提交说明里写明是有意的默认行为变更。
- **报告完成时给出实际跑过的命令和真实输出**,不要只说「通过」。
- 回复与提交说明用**中文**;代码、命令、路径、报错原文保持原样。
- 提交说明末尾加一行:`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。
- 分支:`feat/v3-p0`(**已经存在**:`main` + 设计文档提交,不用再切)。**不要在 `main` 上直接提交。**
- 动 `src/` 之前没有测试覆盖的部分,先补回归测试(Task 1 已统一补)。
- **浏览器验证步骤要真的做**:CSS / 弹层 / 焦点在 jsdom 里验证不了,每个带「浏览器验证」的 Task 都要在真实浏览器里按步骤做并记录;**步骤里用到的前置条件(可排序的列、编程式设过滤的按钮、「更多」菜单示例)已经写成 playground 的正式改动**,不要临时在控制台造。**Task 13b 起仓库有原型对照页 `/prototype.html`(真实库复刻设计原型模块 1–4),13c–13g 的浏览器验证都在它上面做,并与 `docs/smart-naive-table-design.html` 同视口并排读数。**
- 只读参考:`docs/spike/`(一次性验证代码,不随包发布,**不要改它们来「配合」实现**)。

## Review Focus

规格隐含、但没有任何任务的常规测试会覆盖、最容易咬到真实使用者的输入或状况(按可能性排序)。**每一条都在所属任务里有一个专门的测试步骤**:

1. **已存 `localStorage` 里密度是 `comfortable` 的老用户 + 宿主给了 `defaultDensity="compact"` + 没开密度按钮** → 必须是紧凑(否则宿主的「个人设置」对这些用户永远不生效,而他们又没有按钮可改)。(Task 5)
2. **宿主传 `pagination: { pageSize: 10 }`(或沿用旧的 `pageSizes`)时**,`simple` 分页里库自己画的「每页条数」选择器,选项里必须包含**当前值**(否则下拉显示成空白)。(Task 7)
3. **options 列的过滤值里带 `notEqual` / `isNull`(含值控件是 `select` 的列)/ 「多条 equal 且」**:打开面板不能静默丢条件,点确认不能覆盖掉原条件(旧缺陷 C3,会丢数据)。(Task 10)
4. **吸收余量的那一列的边界**:隐藏最后一列(换前一列顶上)、只有一列、全部列都 `fixed`、拖的正好是最后一列、先拖过 B 列再让 B 成为吸收列。(Task 12,E1 的 `dk` 方案;每一种在 jsdom 与真实浏览器里都要各验一遍)
5. **`toolbar.more` 传空数组 / 只有分隔线 / `toolbar: false`** 不渲染按钮;**chips 指向已被隐藏或已不存在的列**时,点击不能报错、× 仍能清掉那个条件(孤儿键也有 chip,「清除全部」照常渲染)。(Task 6、Task 11)
6. **面板里的 Esc 与焦点**:NSelect / NDatePicker 下拉展开时按 Esc 只该收起下拉,不能连面板和草稿一起关掉;点面板空白处后 Esc 仍要生效;Tab 不能走出面板。(Task 10)
7. **保存列设置 / 列宽时不能把宿主的密度写进存储**(宿主回滚到 2.1.1 会把用户固定在那个密度);存储里没有记录、用户也没选过时不写 `density` 字段。(Task 5)

---

## File Structure

新建(均在 `src/`,除非注明):

| 文件 | 职责 | 由谁消费 |
|---|---|---|
| `sorts.ts` | 排序态的纯函数:`SorterInfo`、`SorterEvent`、`collectSorters`、`orderByPriority`、`deriveInitSorts`、`normalizeSorterEvent`、`sortTransition`、`sortToParams` | `SmartTable.vue`、`useColumns.ts`(仅类型) |
| `filterDraft.ts` | 列头面板「草稿」的纯函数:`MAX_CONDITIONS`、`FilterDraft`、`blankDraft`、`draftFromValue`、`addCondition`、`removeCondition`、`setConditionAction`、`setConditionValue`、`setLogic`、`draftToValue` | `ColumnFilter.vue` |
| `ConditionRow.vue` | 面板里**一行**条件编辑器(操作符 + 值控件 + 删除;下拉展开状态向外报) | `ColumnFilter.vue` |
| `filterChips.ts` | chips 的纯函数:`ChipItem`、`buildChips`(含孤儿键)、`removeChipCondition`、`countFitting`、`shrinkForMore`、`hasActiveDefaults` | `FilterChips.vue`、`SmartTable.vue` |
| `FilterChips.vue` | 已生效条件 chips 行(`NTag`,可键盘操作,超一行折成 `+N`) | `SmartTable.vue` |
| `searchCols.ts` | `countTracks`、`effectiveCollapsedRows`(C5:按 `n-grid` 实际轨道数判断) | `SearchForm.vue` |
| `cardStyle.ts` | `CARD_THEME_OVERRIDES`、`mergeCardProps`(B11 + `cardProps`) | `SmartTable.vue`(`SearchForm.vue` 收它合并好的结果) |
| `pageSize.ts` | `PageSizeOption`、`pageSizeValue`、`mergePageSizes`(并入当前值)、`resolveDefaultPageSize`(D4 优先级) | `SmartTable.vue` |
| `scrollToCard.ts` | `scrollParentOf`、`keepCardTopVisible`(翻页后滚回卡片顶部,E4) | `SmartTable.vue` |
| `viewportClamp.ts` | `clampShift`(弹层水平夹进视口,L0-9,Task 13e) | `ColumnFilter.vue` |

修改:`types.ts`、`filter.ts`、`labels.ts`(`Required<SmartTableLabels>`、`zhCNLabels`、`ACTION_LABEL_KEY`、`fmt`)、`config.ts`、`storage.ts`、`icons.ts`、`useColumns.ts`(含 `filterDefTitle`)、`SmartTable.vue`、`ColumnFilter.vue`、`Toolbar.vue`、`SearchForm.vue`、`ColumnSettings.vue`(只改 `labels` 类型)、`index.ts`、`playground/`(`locale.ts`、`DemoBasic.vue`、`DemoFilter.vue`、`mock.ts`,为浏览器验证补前置条件;新增 `DemoAbsorb.vue`、`DemoFill.vue` 两个场景页,`App.vue` 加页签);**Task 13b–13g(对齐设计原型)另新增根目录 `prototype.html` 与 `playground/prototype/*`(原型对照页,不进发布包),并改 `Toolbar.vue`、`SearchForm.vue`、`ColumnFilter.vue`、`ConditionRow.vue`、`FilterChips.vue`、`ColumnSettings.vue`、`filterChips.ts`、`useColumns.ts`、`icons.ts`、`labels.ts`、`types.ts`**。

测试(均在 `tests/`):新增 `baseline-2.1.1.test.ts`、`sorts.test.ts`、`pageSize.test.ts`、`scrollToCard.test.ts`、`filterDraft.test.ts`、`filterChips.test.ts`、`searchCols.test.ts`、`SearchForm.test.ts`、`Toolbar.test.ts`;追加或修改 `filter.test.ts`、`useFilters.test.ts`、`useColumns.test.ts`、`SmartTable.test.ts`、`ColumnFilter.test.ts`、`config.test.ts`、`storage.test.ts`;**Task 13b–13g 另新增 `prototype.test.ts`、`viewportClamp.test.ts`、`ColumnSettings.test.ts`、`types.test.ts`,并追加 `Toolbar.test.ts`、`SearchForm.test.ts`、`filterChips.test.ts`**。

**全程用同一组命令验证**(每个 Task 结尾都要跑):

```bash
npm test
npm run typecheck
```

基线(2026-09-30 在 `feat/v3-p0` 上实测,与 `main` 的代码一致):`Test Files  11 passed (11)`、`Tests  126 passed (126)`,typecheck 无输出 = 通过。**每个 Task 的 Expected 都写累计总数**(实测值,见各 Task);累计数一览(第二轮从 `main` 整条重放的实测值):T1 134、T2 145、T3 151、T4 175、T5 194、T6 203、T7 230、T8 236、T9 244、T10 281(中途提交 257)、T11 302、T12 312、T12b 325、T13 336、T13b 351、T13c 360、T13d 363、T13e 385、T13f 393、T13g 404(Task 14 不加测试)。

---

### Task 0: 分支与基线

**Files:** 无(只做 git 与验证)。

**Interfaces:**
- Consumes: 无。
- Produces: 确认当前分支是 `feat/v3-p0`(已存在);基线数字(126 个测试通过、typecheck 干净),后续每个 Task 都要对照它。

- [ ] **Step 1: 确认分支与工作区**

分支 `feat/v3-p0` **已经存在**(就是当前分支,HEAD = `main` + 设计文档提交),所以**不要**再执行 `git checkout -b feat/v3-p0`(会报 `fatal: a branch named 'feat/v3-p0' already exists`)。

Run:
```bash
git branch --show-current
git status --short src tests package.json
```
Expected: 第一条输出 `feat/v3-p0`;第二条无输出(`src/`、`tests/`、`package.json` 没有未提交改动;仓库里其它未跟踪文件如 `docs/`、`*.png` 与本计划无关,**不要**提交它们)。若当前不在 `feat/v3-p0`,先 `git switch feat/v3-p0`(切不过去就停下来问用户,**不要**在 `main` 上提交)。

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
git commit -m "test: 锁住 2.1.1 将被有意翻转的默认行为(B1/B2/B3/B4/C1/C2 的特征测试)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: 15 个操作符 + 无值算子(C4)+ labels 类型改造与 `zhCNLabels`

> 规格 §3 / 设计文档第 1 节。操作符扩到 15 个:新增 `isNull` `isNotNull` `like` `startsWith` `endsWith` `in` `notIn`。**语义(规格没写清,本任务定死,并在 CHANGELOG 写明)**:
> - `isNull`:单元格为空(`null` / `undefined` / 空白串 / 空数组);`0`、`false` 不算空。`isNotNull` 取反。二者**不需要值**。
> - `startsWith` / `endsWith`:忽略大小写的前缀 / 后缀匹配;单元格为 `null`/`undefined` → 不匹配。
> - `like`:SQL `LIKE`——`%` 任意长度、`_` 单个字符,**整串匹配、忽略大小写**,其余字符按字面量(`a.c` 不匹配 `abc`)。
> - `in` / `notIn`:值是**数组**,单元格与其中任一项 `equal`(沿用 `equal` 的跨类型与整天语义)即命中;`notIn` 取反;空单元格时 `notIn` 为真(与 `notEqual` 一致);值不是数组 → `in` 为假。
> - **未知 action 一律 fail-closed**(`matchCondition` 的 `default` 分支返回 `false`,2.1.1 现状,本 Task 不动)。原型 `design.html` 里的 `default: return true`(fail-open)是错的:`or` 逻辑下一条脏条件会把整列过滤短路成「放行全部」,以 `filter.ts` 为准。
>
> **与原计划不同的决定(D1 / D9,本 Task 落地)**:
> 1. **D1 · B7 的默认操作符保持 8 个**:本 Task 只落地 7 个新 action 的**类型、求值、labels、序列化、无值算子常量**(纯逻辑);**`src/useColumns.ts` 的 `DEFAULT_ACTIONS` 一个字都不改**(input = contains / notContains / equal / notEqual;number、date = equal / notEqual / gt / gte / lt / lte;select = equal / notEqual)。新 action **只在宿主于列上显式写 `filter.actions` 时**才出现在列头面板 —— 否则已有过滤列升级后不改配置就会多出旧后端不认识的 action(后端忽略则返回未过滤数据、严格校验则 400)。模式 2 条件构造器(P1)按规格 §5.9 的按类型推荐集合给出(不是无条件 15 个)。附带收益:Task 2 ~ Task 10 之间的中间提交不会暴露面板画不出来的 `in` / `isNull`。
> 2. **C4 改记为「新增」而非缺陷修复**:2.1.1 的 `FilterAction` 里没有 `isNull`,「无值算子被当成没填丢掉」在 2.1.1 不可达;它是引入 `isNull` / `isNotNull` 时必须同时做的前置改动,CHANGELOG 记在「新增」。
> 3. **D9 · labels 新增键一律可选**:`SmartTableLabels` 里 2.1.1 已有的键保持必填(语义不变),**本计划新增的所有键都写成 `?:`** —— 否则写了完整 labels 对象的宿主(仓库自己的 `playground/locale.ts` 就是 `const zhLabels: SmartTableLabels = {…}`)升级后 vue-tsc 报错,与「新增 = 可选」相悖。库内部:`defaultLabels`、`mergeLabels` 的结果、各 SFC 的 `labels` prop 一律用 `Required<SmartTableLabels>`(渲染期求值的红线不变);新增导出 **`zhCNLabels`**(完整中文,纯数据零依赖,README 的中文示例改用它)。**此后每个加 label 键的 Task 要同步做三件事:`types.ts` 加可选键、`defaultLabels` 补英文默认、`zhCNLabels` 补中文**;本 Task Step 1 的完整性用例会在漏掉任何一处时变红。
> 4. 面板「确定 / 重置」按钮沿用已发布的 `filterConfirm` / `filterReset`(英文默认保持 `OK` / `Reset`,不改)。官方 `useLocale` 只在 naive-ui 内部 `_mixins` 导出,公开入口取不到官方 locale 的「确认 / 清除」,所以**不要**写「文案取官方 locale」。

**Files:**
- Modify: `src/types.ts`(`FilterAction`、`SmartTableLabels`)
- Modify: `src/filter.ts`
- Modify: `src/labels.ts`(整个文件替换:`Required<SmartTableLabels>`、`zhCNLabels`、`ACTION_LABEL_KEY`)
- Modify: `src/ColumnFilter.vue`(本地 `ACTION_LABEL_KEY` 换成从 `labels.ts` 引入;`labels` prop 类型改 `Required<SmartTableLabels>`)
- Modify: `src/Toolbar.vue`、`src/SearchForm.vue`、`src/ColumnSettings.vue`(只改 `labels` prop 类型)
- Modify: `src/index.ts`(导出 `zhCNLabels`、`NO_VALUE_ACTIONS`、`isValuelessAction`、`actionValueKind`)
- Modify: `playground/locale.ts`(中文包改用 `zhCNLabels`)
- **不改**:`src/useColumns.ts`(D1:`DEFAULT_ACTIONS` 保持 2.1.1 原样)
- Test: `tests/filter.test.ts`(追加)、`tests/useFilters.test.ts`(追加 1 条,锁默认集合)、`tests/config.test.ts`(追加)、`tests/ColumnFilter.test.ts`(`labels` 常量的类型标注)

**Interfaces:**
- Produces(后续 Task 依赖,签名固定):
  - `filter.ts`:`NO_VALUE_ACTIONS: readonly FilterAction[]`;`isValuelessAction(action: FilterAction): boolean`;`type ActionValueKind = 'none' | 'array' | 'scalar'`;`actionValueKind(action: FilterAction): ActionValueKind`
  - `labels.ts`:`ACTION_LABEL_KEY: Record<FilterAction, keyof SmartTableLabels>`;`defaultLabels: Required<SmartTableLabels>`;`zhCNLabels: Required<SmartTableLabels>`;`mergeLabels(…): Required<SmartTableLabels>`
  - `SmartTableLabels` 新增 8 个**可选**键:`filterIsNull` `filterIsNotNull` `filterLike` `filterStartsWith` `filterEndsWith` `filterIn` `filterNotIn` `filterNoValue`

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

在 `tests/config.test.ts` 顶部把原来的 `import { mergeLabels } from '../src/labels'` 替换成下面两行(补类型 import):
```ts
import { ACTION_LABEL_KEY, defaultLabels, mergeLabels, zhCNLabels } from '../src/labels'
import type { FilterAction, SmartTableLabels } from '../src/types'
```
然后在文件末尾追加:
```ts
describe('15 个操作符都有文案', () => {
  const ALL: FilterAction[] = [
    'equal', 'notEqual', 'contains', 'notContains', 'gt', 'gte', 'lt', 'lte',
    'isNull', 'isNotNull', 'like', 'startsWith', 'endsWith', 'in', 'notIn',
  ]
  it('ACTION_LABEL_KEY 覆盖全部操作符,且每个键在英文默认与中文包里都有非空值', () => {
    expect(Object.keys(ACTION_LABEL_KEY).sort()).toEqual([...ALL].sort())
    for (const a of ALL) {
      expect(defaultLabels[ACTION_LABEL_KEY[a]]).toBeTruthy()
      expect(zhCNLabels[ACTION_LABEL_KEY[a]]).toBeTruthy()
    }
  })
})

describe('labels 约定(D9):新增键可选、英文默认与中文包保持完整', () => {
  it('defaultLabels 与 zhCNLabels 的键集合完全一致且没有空值(之后每个 Task 加键时两处都要补,漏一处这里变红)', () => {
    expect(Object.keys(zhCNLabels).sort()).toEqual(Object.keys(defaultLabels).sort())
    for (const [k, v] of Object.entries(defaultLabels)) expect(v, `defaultLabels.${k}`).toBeTruthy()
    for (const [k, v] of Object.entries(zhCNLabels)) expect(v, `zhCNLabels.${k}`).toBeTruthy()
  })

  it('2.1.1 宿主写的完整 labels 对象(没有任何新键)仍能通过类型检查,缺的键取英文默认', () => {
    // 这个常量本身就是类型回归测试:只要有任何新增键被写成必填,vue-tsc 会在这里报错(不是 vitest 失败)
    const legacy: SmartTableLabels = {
      search: '查询',
      reset: '重置',
      refresh: '刷新',
      density: '密度',
      densityComfortable: '舒适',
      densityCompact: '紧凑',
      columnSettings: '列设置',
      columnSettingsReset: '恢复默认',
      fixedLeft: '固定到左侧',
      fixedRight: '固定到右侧',
      fixedNone: '取消固定',
      expand: '展开',
      collapse: '收起',
      filter: '过滤',
      filterConfirm: '确定',
      filterReset: '重置',
      filterSelectAll: '全选',
      filterEqual: '等于',
      filterNotEqual: '不等于',
      filterContains: '包含',
      filterNotContains: '不包含',
      filterGt: '大于',
      filterGte: '大于等于',
      filterLt: '小于',
      filterLte: '小于等于',
    }
    const merged = mergeLabels(legacy)
    expect(merged.search).toBe('查询')
    expect(merged.filterIsNull).toBe(defaultLabels.filterIsNull)
  })
})
```

在 `tests/useFilters.test.ts` 的 `describe('deriveFilterDefs', …)` 里、现有「默认动作按值类型给,显式 actions 优先」用例**之后**追加一条(现有用例**不改**:它已经锁着 input 的默认集合,D1 之后它仍然成立):
```ts
  it('[B7 / D1] 列头面板的默认可选操作符保持 2.1.1:新增的 7 个只在列上显式写 filter.actions 时出现', () => {
    const [text, num, date, sel, explicit] = deriveFilterDefs<Row>([
      { key: 'name', filter: true },
      { key: 'salary', format: 'money', filter: true },
      { key: 'createTime', format: 'datetime', filter: true },
      { key: 'status', options: [{ label: 'A', value: 1 }], filter: { mode: 'condition' } },
      { key: 'nick', filter: { actions: ['like', 'isNull', 'in'] } },
    ])
    expect(text.actions).toEqual(['contains', 'notContains', 'equal', 'notEqual'])
    expect(num.actions).toEqual(['equal', 'notEqual', 'gt', 'gte', 'lt', 'lte'])
    expect(date.actions).toEqual(['equal', 'notEqual', 'gt', 'gte', 'lt', 'lte'])
    expect(sel.actions).toEqual(['equal', 'notEqual'])
    expect(explicit.actions).toEqual(['like', 'isNull', 'in'])
  })
```

`src/ColumnFilter.vue` 的 `labels` prop 类型在 Step 5 改成 `Required<SmartTableLabels>`,所以 `tests/ColumnFilter.test.ts` 顶部那个测试用的 `labels` 常量的类型标注同步改(否则 typecheck 报 TS2322):把 `} as unknown as SmartTableLabels` 改成 `} as unknown as Required<SmartTableLabels>`。

- [ ] **Step 2: 跑测试,确认失败**

Run: `npx vitest run tests/filter.test.ts tests/config.test.ts tests/useFilters.test.ts`
Expected: `8 failed`(实测)—— `filter.test.ts` 6 条(新操作符走 `default` 分支返回 `false`,报 `expected false to be true`;`NO_VALUE_ACTIONS is not iterable`;`isNull` 条件被 `activeConditions` 丢掉,报 `expected [] to deeply equal [ { action: 'isNull', value: null } ]`),`config.test.ts` 2 条(`Cannot convert undefined or null to object`:`ACTION_LABEL_KEY` / `zhCNLabels` 还没导出)。`useFilters.test.ts` 新增的 D1 用例**此刻就是绿的**(它锁的是现状,不是新行为),这是有意的:它的作用是防止后面有人顺手扩默认集合。D9 的「2.1.1 完整 labels 对象」用例是**类型层面**的回归,vitest 不做类型检查,所以它在运行时永远是绿的,真正的守卫是 Step 7 的 `npm run typecheck`(试过:把任一新键的 `?` 去掉,vue-tsc 立刻报 `tests/config.test.ts(…): error TS2741: Property 'filterIsNull' is missing`)。

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
并在 `SmartTableLabels` 里 `filterLte: string` 之后追加(**可选键**;这一段注释之后的新键都接在它下面):
```ts
  /* ---- 3.0 新增的键一律可选:2.1.1 宿主写的完整 labels 对象不会因此报类型错误;
         缺省取英文默认(defaultLabels),中文宿主整包用 zhCNLabels ---- */
  filterIsNull?: string
  filterIsNotNull?: string
  filterLike?: string
  filterStartsWith?: string
  filterEndsWith?: string
  filterIn?: string
  filterNotIn?: string
  /** 无值算子的值位置占位。 */
  filterNoValue?: string
```

`src/labels.ts` **整个文件替换**为下面这份(后面的 Task 往 `defaultLabels` 与 `zhCNLabels` **各**补一行,类型键加在 `types.ts` 上):
```ts
import type { FilterAction, SmartTableLabels } from './types'

/**
 * 英文默认文案;宿主经 labels prop 部分覆盖(传 computed 即随 locale 响应)。
 * 类型是 Required<SmartTableLabels>:3.0 新增的键在 SmartTableLabels 里是可选的(不破坏 2.1.1 宿主),
 * 但默认包必须给全 —— 库内部拿到的 labels 一律是 Required 形状,渲染期直接取,不用判空。
 */
export const defaultLabels: Required<SmartTableLabels> = {
  search: 'Search',
  reset: 'Reset',
  refresh: 'Refresh',
  density: 'Density',
  densityComfortable: 'Comfortable',
  densityCompact: 'Compact',
  columnSettings: 'Columns',
  columnSettingsReset: 'Restore defaults',
  fixedLeft: 'Pin left',
  fixedRight: 'Pin right',
  fixedNone: 'Unpin',
  expand: 'Expand',
  collapse: 'Collapse',
  filter: 'Filter',
  filterConfirm: 'OK',
  filterReset: 'Reset',
  filterSelectAll: 'Select all',
  filterEqual: 'Equals',
  filterNotEqual: 'Not equals',
  filterContains: 'Contains',
  filterNotContains: 'Not contains',
  filterGt: 'Greater than',
  filterGte: 'Greater or equal',
  filterLt: 'Less than',
  filterLte: 'Less or equal',
  filterIsNull: 'Is empty',
  filterIsNotNull: 'Is not empty',
  filterLike: 'Like',
  filterStartsWith: 'Starts with',
  filterEndsWith: 'Ends with',
  filterIn: 'In',
  filterNotIn: 'Not in',
  filterNoValue: 'No value needed',
}

/**
 * 完整中文文案(含 2.1.1 已有的键与 3.0 新增的键)。纯数据、零依赖:
 * 中文宿主 `:labels="zhCNLabels"` 即可,不必自己抄一份;想改个别词就 `{ ...zhCNLabels, search: '查找' }`。
 */
export const zhCNLabels: Required<SmartTableLabels> = {
  search: '查询',
  reset: '重置',
  refresh: '刷新',
  density: '密度',
  densityComfortable: '舒适',
  densityCompact: '紧凑',
  columnSettings: '列设置',
  columnSettingsReset: '恢复默认',
  fixedLeft: '固定到左侧',
  fixedRight: '固定到右侧',
  fixedNone: '取消固定',
  expand: '展开',
  collapse: '收起',
  filter: '过滤',
  filterConfirm: '确定',
  filterReset: '重置',
  filterSelectAll: '全选',
  filterEqual: '等于',
  filterNotEqual: '不等于',
  filterContains: '包含',
  filterNotContains: '不包含',
  filterGt: '大于',
  filterGte: '大于等于',
  filterLt: '小于',
  filterLte: '小于等于',
  filterIsNull: '为空',
  filterIsNotNull: '不为空',
  filterLike: '模糊匹配',
  filterStartsWith: '开头是',
  filterEndsWith: '结尾是',
  filterIn: '属于',
  filterNotIn: '不属于',
  filterNoValue: '无需填值',
}

/** 三层合并:内置英文 < 全局默认(global)< 实例 prop(partial)。结果是 Required 形状(缺的键已由英文默认补齐)。 */
export function mergeLabels(
  partial?: Partial<SmartTableLabels>,
  global?: Partial<SmartTableLabels>,
): Required<SmartTableLabels> {
  return { ...defaultLabels, ...global, ...partial }
}

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

- [ ] **Step 5: 实现 —— 组件的 `labels` 类型、`ColumnFilter` 引用、入口导出、playground**

**`src/useColumns.ts` 的 `DEFAULT_ACTIONS` 不动(D1)。**

`src/ColumnFilter.vue`:
1. 删除文件里本地的 `const ACTION_LABEL_KEY: Record<FilterAction, keyof SmartTableLabels> = {...}` 整段(109–118 行),并在 import 区加 `import { ACTION_LABEL_KEY } from './labels'`;删除后若 `FilterAction` 在该文件里不再被用到,把它从 `import type {...} from './types'` 里去掉(`noUnusedLocals`)。
2. `labels: { type: Object as PropType<SmartTableLabels>, required: true }` 改为 `labels: { type: Object as PropType<Required<SmartTableLabels>>, required: true }`。

`src/Toolbar.vue`、`src/SearchForm.vue`、`src/ColumnSettings.vue`:同样把 `labels` prop 的 `PropType<SmartTableLabels>` 改成 `PropType<Required<SmartTableLabels>>`(`SmartTable.vue` 传下去的是 `mergedLabels`,类型已经是 `Required<SmartTableLabels>`,不用改)。

`src/index.ts`:把 `export { defaultLabels, mergeLabels } from './labels'` 改成
```ts
export { defaultLabels, mergeLabels, zhCNLabels } from './labels'
```
`filter` 那组导出里加上 `NO_VALUE_ACTIONS`、`isValuelessAction`、`actionValueKind`,类型导出加上 `ActionValueKind`:
```ts
export {
  matchCondition,
  matchFilterValue,
  applyFilters,
  isFilterActive,
  activeConditions,
  defaultFilterSerializer,
  optionsToFilterValue,
  filterValueToOptions,
  NO_VALUE_ACTIONS,
  isValuelessAction,
  actionValueKind,
} from './filter'
export type { FilterSerializer, SerializedFilter, FilterableField, ActionValueKind } from './filter'
```

`playground/locale.ts`:中文包改用库导出的 `zhCNLabels`。删掉 `import type { SmartTableLabels } from '../src/index'` 与整个 `const zhLabels: SmartTableLabels = {…}`,文件改成:
```ts
import { computed, ref } from 'vue'
import { zhCNLabels } from '../src/index'

/** playground 的极简双语开关:演示 labels prop 与函数型列标题的语言响应。 */
export const locale = ref<'zh' | 'en'>('zh')

/** 函数型文案:渲染期求值,切语言即时生效(与宿主用 vue-i18n 的 () => t() 同机制)。 */
export const tt = (zh: string, en: string) => () => (locale.value === 'zh' ? zh : en)

/** zh 传库导出的中文包;en 传 undefined 走包内英文默认。 */
export const labels = computed(() => (locale.value === 'zh' ? zhCNLabels : undefined))
```

- [ ] **Step 6: 跑测试,确认通过**

Run: `npx vitest run tests/filter.test.ts tests/config.test.ts tests/useFilters.test.ts`
Expected: PASS。

- [ ] **Step 7: 全量验证**

Run: `npm test && npm run typecheck`
Expected: `Test Files  12 passed (12)`、`Tests  145 passed (145)`(134 + 11:`filter.test.ts` +7、`config.test.ts` +3、`useFilters.test.ts` +1);typecheck 无输出。若 typecheck 报 `Record<FilterAction, …>` 缺键,说明 `ACTION_LABEL_KEY` 漏了某个操作符;若报「`string | undefined` 不能赋给 `string`」,说明某个 SFC 的 `labels` prop 漏改成 `Required<SmartTableLabels>`。

- [ ] **Step 8: 提交**

```bash
git add src/types.ts src/filter.ts src/labels.ts src/ColumnFilter.vue src/Toolbar.vue src/SearchForm.vue src/ColumnSettings.vue src/index.ts playground/locale.ts tests/filter.test.ts tests/config.test.ts tests/useFilters.test.ts tests/ColumnFilter.test.ts
git commit -m "feat: 过滤操作符由 8 个扩到 15 个(列头面板默认集合保持 8 个)、无值算子不被当成没填丢弃(C4,新增);labels 新增键全部可选,新增导出 zhCNLabels" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: options 列「勾选 ↔ 高级条件」的无损判定(C3 的内核)

> 规格 §5.3:新增纯函数 `isOptionsRepresentable(value)`——过滤值能被勾选**无损**表达,当且仅当 ① 所有有效条件均为 `equal` 且(`logic === 'or'` 或仅一条),或 ② 恰好一条 `in`(值是数组)。其余不可表达。并让 `filterValueToOptions` 认得单条 `in`。`ColumnFilter` 用它决定「打开面板时是勾选还是自动展开高级条件」(Task 10)。

**Files:**
- Modify: `src/filter.ts`、`src/index.ts`(导出 `isOptionsRepresentable`,Q-8)
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
Expected: `6 failed`(实测)—— 5 条 `(0 , isOptionsRepresentable) is not a function`,外加「`filterValueToOptions` 认得单条 in」1 条(现在单条 `in` 取不出值,断言 `expected [] to deeply equal [ 1, 2 ]`)。

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

`src/index.ts`:`filter` 那组导出里,在 `filterValueToOptions,` 之后加 `isOptionsRepresentable,`(CHANGELOG 会声明这是新增导出,所以必须真的进入口)。

- [ ] **Step 4: 跑测试,确认通过**

Run: `npx vitest run tests/filter.test.ts`
Expected: PASS。

- [ ] **Step 5: 全量验证**

Run: `npm test && npm run typecheck`
Expected: `Test Files  12 passed (12)`、`Tests  151 passed (151)`(145 + 6);typecheck 无输出。

- [ ] **Step 6: 提交**

```bash
git add src/filter.ts src/index.ts tests/filter.test.ts
git commit -m "feat: 新增 isOptionsRepresentable,filterValueToOptions 认得单条 in(C3 的判定内核,面板接线见后续任务)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: 排序 —— 多列排序态、`defaultSortOrder`(C1 / C2)、`sort()` / `clearSorter()`(对齐官方并通知宿主)

> 规格 §3、§5.4。**已在真实浏览器复现(设计文档 9.4)**:C2 = 首次请求无排序参数;C1 = 只带第一列。官方事实(`use-sorter.mjs`,已核):**优先级 = 列声明的 `sorter.multiple`,大者优先,与点击顺序无关**;只要存在受控 `sortOrder` 的列且没有一列激活,官方返回空态(这就是 C2 的根因);非 `multiple` 的 `sorter` 是「单列互斥」。
>
> 远程参数:单列保持 `{ sortField, sortOrder }`;多列**仍带**最高优先级列的 `sortField / sortOrder`,**另加** `sorts: [{ field, order }…]`(按优先级,`order` 为 `'asc' | 'desc'`)。**排序态不持久化**。
>
> **`sort()` / `clearSorter()` 对齐官方(D7)**:官方 `DataTableInst.sort(columnKey, order = 'ascend')`(`use-sorter.mjs:105-118`):`!columnKey` 时等价 `clearSorter()`;两者都经 `doUpdateSorter`,**会触发宿主的 `onUpdate:sorter`**,载荷形状:单列互斥的 sorter = 单个 `SortState`(`{ columnKey, sorter, order }`)、multiple = `SortState[]`、`clearSorter()` = `null`。库版同签名 `sort(columnKey?: string | null, order: 'ascend' | 'descend' | false = 'ascend')`,编程式排序 / 清除后向宿主的 `onUpdate:sorter` 转发**一次**,载荷形状同官方。
>
> **C6(新增的缺陷修复,E5)**:2.1.1 里宿主在 `<SmartTable>` 上写 `@update:sorter`(`onUpdate:sorter`),**点一次表头会被调用两次** —— `forwardedAttrs`(`src/SmartTable.vue`)没有摘掉 `onUpdate:sorter`,它被合并进传给 `NDataTable` 的监听器数组(Naive 自己调一次),`onSorterChange` 又手动转发一次。本 Task 从 `forwardedAttrs` 里摘掉 `onUpdate:sorter`(与 `onUnstableColumnResize` 的处理一致),**只手动转发一次**,点击与编程式 `sort()` / `clearSorter()` 共用同一个转发出口 `notifyHostSorter`;有测试锁住(宿主 spy 恰好被调 1 次)。CHANGELOG 登记 C6。
>
> **`defaultSortOrder` 的范围(Q-10)**:库给每个 sorter 列都写受控 `sortOrder`,所以必须自己接住它 —— `deriveInitSorts` 只在 `SmartTable` **首次 setup 时读一次列声明**:① 列是异步加载进来的 → `defaultSortOrder` **不生效**,请在列到位后用实例方法 `sort()`(规格与 CHANGELOG 要写明);② `hideInTable` 的列(只作搜索项)没有表头,不参与;③ **静态 `data` 模式同样生效**(本地数据会按它排序,CHANGELOG 要提);④ 单列互斥的 sorter 只留最后声明的那个,这是**库的选择**(官方的初值不做单列互斥,`use-sorter.mjs:31-37`),不要写成「与官方一致」。

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
  - `sorts.ts`:`interface SorterInfo { priority: number; multiple: boolean; sorter: unknown }`;`interface SorterEvent { columnKey: string; sorter: unknown; order: 'ascend' | 'descend' | false }`;`collectSorters<T>(columns: SmartTableColumn<T>[]): Map<string, SorterInfo>`;`orderByPriority(items: SortItem[], info: Map<string, SorterInfo>): SortItem[]`;`deriveInitSorts<T>(columns: SmartTableColumn<T>[]): SortItem[]`;`normalizeSorterEvent(s: unknown, info: Map<string, SorterInfo>): SortItem[]`;`sortTransition(current: SortItem[], info: Map<string, SorterInfo>, columnKey: string, order: 'ascend' | 'descend' | false): { items: SortItem[]; event: SorterEvent | SorterEvent[] } | null`;`sortToParams(items: SortItem[]): Record<string, any>`
  - `useColumns` 选项 `sortState?: () => SortItem[]`(原来是 `() => {field,order} | null`)
  - `SmartTableInst.sort(columnKey?: string | null, order?: 'ascend' | 'descend' | false): void`(order 缺省 `'ascend'`)、`SmartTableInst.clearSorter(): void`

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
  sortTransition,
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
    expect(info.get('g')).toMatchObject({ priority: 2, multiple: true })
    expect(info.get('n')).toMatchObject({ priority: 1, multiple: true })
    expect(info.get('s')).toMatchObject({ priority: 0, multiple: false, sorter: true })
  })

  it('hideInTable 的列(只作搜索项,没有表头)不收', () => {
    const info = collectSorters([{ key: 'q', title: 'q', sorter: true, hideInTable: true }] as SmartTableColumn<any>[])
    expect(info.size).toBe(0)
  })

  it('多级表头:递归到叶子', () => {
    const info = collectSorters([
      { key: 'grp', title: 'grp', children: [{ key: 'x', title: 'x', sorter: { compare: cmp, multiple: 3 } }] },
    ] as SmartTableColumn<any>[])
    expect(info.get('x')).toMatchObject({ priority: 3, multiple: true })
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
  it('单列互斥的 sorter:只保留最后声明的那一个(库的选择;官方初值不做单列互斥,use-sorter.mjs:31-37)', () => {
    const out = deriveInitSorts([
      { key: 'a', title: 'a', sorter: true, defaultSortOrder: 'ascend' },
      { key: 'b', title: 'b', sorter: true, defaultSortOrder: 'descend' },
    ] as SmartTableColumn<any>[])
    expect(out).toEqual([{ field: 'b', order: 'descend' }])
  })
  it('没有 sorter 的列写了 defaultSortOrder 也不生效', () => {
    expect(deriveInitSorts([{ key: 'a', title: 'a', defaultSortOrder: 'ascend' }] as SmartTableColumn<any>[])).toEqual([])
  })
  it('hideInTable 的列(只作搜索项)写了 defaultSortOrder 也不生效', () => {
    const hidden = [{ key: 'a', title: 'a', sorter: true, defaultSortOrder: 'ascend', hideInTable: true }] as SmartTableColumn<any>[]
    expect(deriveInitSorts(hidden)).toEqual([])
  })
})

describe('sortTransition(D7:编程式 sort() 的下一个排序态 + 官方 onUpdate:sorter 载荷)', () => {
  const info = collectSorters(cols)
  const gSorter = (cols[1] as { sorter: unknown }).sorter
  const nSorter = (cols[2] as { sorter: unknown }).sorter
  it('列没有 sorter / 不存在 → null(空操作,与官方 sort() 一致)', () => {
    expect(sortTransition([], info, 'id', 'ascend')).toBeNull()
    expect(sortTransition([], info, 'nope', 'ascend')).toBeNull()
  })
  it('单列互斥的 sorter:载荷是单个 SortState;其它列的排序被顶掉;order: false 时状态清空、载荷仍带 order: false', () => {
    const cur = [{ field: 'g', order: 'ascend' as const }]
    expect(sortTransition(cur, info, 's', 'descend')).toEqual({
      items: [{ field: 's', order: 'descend' }],
      event: { columnKey: 's', sorter: true, order: 'descend' },
    })
    expect(sortTransition([{ field: 's', order: 'descend' }], info, 's', false)).toEqual({
      items: [],
      event: { columnKey: 's', sorter: true, order: false },
    })
  })
  it('multiple 列:载荷是数组 = 已激活的 multiple 列(按列声明顺序)中同列替换、否则追加;单列互斥的旧排序被丢掉', () => {
    const cur = [
      { field: 'n', order: 'ascend' as const },
      { field: 's', order: 'ascend' as const }, // 单列互斥:被丢掉
    ]
    expect(sortTransition(cur, info, 'g', 'descend')).toEqual({
      items: [
        { field: 'g', order: 'descend' },
        { field: 'n', order: 'ascend' },
      ],
      event: [
        { columnKey: 'n', sorter: nSorter, order: 'ascend' },
        { columnKey: 'g', sorter: gSorter, order: 'descend' },
      ],
    })
  })
  it('multiple 列取消(order: false):状态里去掉该列,载荷里仍带 order: false 的那一项', () => {
    const cur = [
      { field: 'g', order: 'descend' as const },
      { field: 'n', order: 'ascend' as const },
    ]
    expect(sortTransition(cur, info, 'n', false)).toEqual({
      items: [{ field: 'g', order: 'descend' }],
      event: [
        { columnKey: 'g', sorter: gSorter, order: 'descend' },
        { columnKey: 'n', sorter: nSorter, order: false },
      ],
    })
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
在 `SmartTableInst` 里 `clearFilters` 之后加(签名对齐官方 `DataTableInst.sort` / `clearSorter`,`use-sorter.mjs:105-118`):
```ts
  /**
   * 设置某列排序(对齐官方 DataTableInst.sort:order 缺省 'ascend';columnKey 为空 = clearSorter();
   * 没有 sorter 的列是空操作)。远程模式回第 1 页重查,并向宿主的 onUpdate:sorter 转发一次(载荷形状与官方一致)。
   */
  sort: (columnKey?: string | null, order?: 'ascend' | 'descend' | false) => void
  /** 清空全部排序;向宿主的 onUpdate:sorter 转发 null(与官方一致)。 */
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
  /** 列上声明的 sorter 原值(编程式 sort() 构造官方 onUpdate:sorter 载荷时要带上)。 */
  sorter: unknown
}

/** 官方 onUpdate:sorter 载荷里的一项(DataTable 的 SortState)。order 为 false = 取消该列。 */
export interface SorterEvent {
  columnKey: string
  sorter: unknown
  order: 'ascend' | 'descend' | false
}

type Sorterish = { sorter?: unknown; defaultSortOrder?: unknown }

function sorterInfoOf(sorter: unknown): SorterInfo | null {
  if (sorter === undefined || sorter === null || sorter === false) return null
  if (typeof sorter === 'object' && typeof (sorter as { multiple?: unknown }).multiple === 'number') {
    return { priority: (sorter as { multiple: number }).multiple, multiple: true, sorter }
  }
  return { priority: 0, multiple: false, sorter }
}

/** 收集可排序叶子列(列 key → 优先级信息;Map 的迭代顺序 = 列声明顺序)。多级表头递归到叶子,特殊列与只作搜索项的 hideInTable 列(没有表头)跳过。 */
export function collectSorters<T>(columns: SmartTableColumn<T>[]): Map<string, SorterInfo> {
  const out = new Map<string, SorterInfo>()
  const walk = (cols: SmartTableColumn<T>[]) => {
    for (const c of cols) {
      if (isSpecialColumn(c) || c.hideInTable) continue
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
 * 编程式 sort(columnKey, order) 的结果:下一个排序态 + 向宿主转发的官方 onUpdate:sorter 载荷
 * (官方 use-sorter.mjs:75-112 的 getUpdatedSorterState / deriveNextSorter)。
 * - 列没有 sorter → null(空操作,与官方一致)。
 * - 单列互斥的 sorter:载荷是单个 SortState,其它列的排序被它顶掉;
 * - multiple 的 sorter:载荷是数组 = 当前已激活的 multiple 列(按列声明顺序)中,同列替换、否则追加这一项;
 *   单列互斥的旧排序被丢掉。order 为 false 时状态里去掉该列,但载荷里仍带那一项(官方原样)。
 */
export function sortTransition(
  current: SortItem[],
  info: Map<string, SorterInfo>,
  columnKey: string,
  order: 'ascend' | 'descend' | false,
): { items: SortItem[]; event: SorterEvent | SorterEvent[] } | null {
  const hit = info.get(columnKey)
  if (!hit) return null
  const state: SorterEvent = { columnKey, sorter: hit.sorter, order }
  if (!hit.multiple) return { items: normalizeSorterEvent(state, info), event: state }
  const active = new Map(current.map((i) => [i.field, i.order] as const))
  const event: SorterEvent[] = []
  for (const [key, inf] of info) {
    if (inf.multiple && active.has(key)) event.push({ columnKey: key, sorter: inf.sorter, order: active.get(key)! })
  }
  const at = event.findIndex((e) => e.columnKey === columnKey)
  if (at >= 0) event[at] = state
  else event.push(state)
  return { items: normalizeSorterEvent(event, info), event }
}

/**
 * 由列上的 defaultSortOrder 推导初始排序态(C2:官方在存在受控 sortOrder 的列时会忽略 defaultSortOrder,
 * 库给每个 sorter 列都写受控 sortOrder,所以必须自己接住它)。
 * 库的选择(官方初值不做单列互斥,use-sorter.mjs:31-37):单列互斥的 sorter 只留最后声明的那一个;multiple 列可并存。
 * 只在 SmartTable 首次 setup 时读一次 —— 列若是异步加载进来的,defaultSortOrder 不会生效,请用实例方法 sort()。
 */
export function deriveInitSorts<T>(columns: SmartTableColumn<T>[]): SortItem[] {
  const info = collectSorters(columns)
  let state: Array<SortItem & { multiple: boolean }> = []
  const walk = (cols: SmartTableColumn<T>[]) => {
    for (const c of cols) {
      if (isSpecialColumn(c) || c.hideInTable) continue
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

注意:`sorts.ts` 从 `useColumns` 引入 `isSpecialColumn`,而 `useColumns` 只 `import type` 自 `types.ts`,不反向 import `sorts.ts`,所以没有循环依赖。

- [ ] **Step 4: 跑,确认 `sorts.test.ts` 通过**

Run: `npx vitest run tests/sorts.test.ts`
Expected: `Tests  16 passed (16)`。

- [ ] **Step 5: 写失败测试 —— `useColumns` 的受控回显改为数组**

`tests/useColumns.test.ts`:
1. 第 24 行 `build()` 参数类型 `sortState?: () => { field: string; order: 'ascend' | 'descend' } | null` 改为 `sortState?: () => SortItem[]`,并在文件顶部的 `import type { SmartTableColumn, SmartTableOption } from '../src/types'` 里加上 `SortItem`。
2. 「sorter 列受控回显」用例(89–102 行)**有意改动**并整条替换为下面这条(提交说明里写明)。理由:`sortState` 的形态由「单个对象 / `null`」变成数组(C1),旧用例里的 `state` 对象夹具不再合法;**原来的两条断言(命中列取 `sortState` 的 order、其余 sortable 列为 `false`)原样保留**,只新增「多列同时回显」的断言,所以没有削弱原意图:
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
Expected: `1 failed`(实测)—— 只有上面这条:`expected false to be 'descend'`。此刻 `useColumns` 还按「单个排序态对象」读(`s.field === key`),拿到数组时 `s.field` 是 `undefined`,所有列都回显成 `false`。

- [ ] **Step 7: 写失败测试 —— `SmartTable` 的集成行为**

在 `tests/SmartTable.test.ts` 末尾追加(顶部 import 补 `flushPromises`:`import { flushPromises, mount } from '@vue/test-utils'`)。**泛型写 `SmartTableColumn<unknown>[]`**(与现有 `tests/SmartTable.test.ts` 里其它用例一致):`mount(SmartTable, …)` 会按传入的 `columns` 推导组件泛型 `T`,写成 `SmartTableColumn<Row>[]` 会被推成 `unknown` 与 `rows` 不兼容,vue-tsc 报 TS2322。
```ts
describe('SmartTable 排序(多列 / 默认排序 / 编程式)', () => {
  const cmp = () => 0
  const multiCols = [
    { key: 'g', title: 'G', sorter: { compare: cmp, multiple: 2 } },
    { key: 'n', title: 'N', sorter: { compare: cmp, multiple: 1 }, defaultSortOrder: 'ascend' as const },
  ]
  const mountRemote = (columns: unknown[], attrs: Record<string, unknown> = {}) => {
    const fetcher = vi.fn(async (_p: Record<string, unknown>) => ({ items: rows, total: 2 }))
    const wrapper = mount(SmartTable, { props: { columns: columns as SmartTableColumn<unknown>[], fetcher, rowKey: 'id' }, attrs })
    return { fetcher, wrapper }
  }
  const sorterHandler = (wrapper: ReturnType<typeof mount>) =>
    wrapper.findComponent(NDataTable).props('onUpdate:sorter') as (s: unknown) => void
  const lastParams = (fetcher: { mock: { calls: unknown[][] } }) => fetcher.mock.calls.at(-1)![0] as Record<string, unknown>
  type Inst = {
    sort: (k?: string | null, o?: 'ascend' | 'descend' | false) => void
    clearSorter: () => void
  }

  it('C2:列上的 defaultSortOrder 进入首次请求,箭头回显', async () => {
    const { fetcher, wrapper } = mountRemote(multiCols)
    await flushPromises()
    expect((fetcher.mock.calls[0][0] as Record<string, unknown>)).toMatchObject({ sortField: 'n', sortOrder: 'asc' })
    const cols = wrapper.findComponent(NDataTable).props('columns') as Array<{ key: string; sortOrder?: unknown }>
    expect(cols.find((c) => c.key === 'n')!.sortOrder).toBe('ascend')
    expect(cols.find((c) => c.key === 'g')!.sortOrder).toBe(false)
    wrapper.unmount()
  })

  it('C2(静态 data 模式):defaultSortOrder 同样生效 —— 本地数据按它排序,箭头回显', async () => {
    const data = [
      { id: 1, n: 3 },
      { id: 2, n: 1 },
      { id: 3, n: 2 },
    ]
    const wrapper = mount(SmartTable, {
      props: {
        columns: [
          { key: 'n', title: 'N', sorter: (a: { n: number }, b: { n: number }) => a.n - b.n, defaultSortOrder: 'descend' },
        ] as SmartTableColumn<unknown>[],
        data,
        rowKey: 'id',
      },
    })
    await nextTick()
    expect(wrapper.findAll('tbody tr').map((tr) => tr.text())).toEqual(['3', '2', '1'])
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

  it('sort() / clearSorter():编程式设置与清空,远程模式回第 1 页重查;order 缺省 ascend', async () => {
    const { fetcher, wrapper } = mountRemote(multiCols)
    await flushPromises()
    const inst = wrapper.vm as unknown as Inst
    inst.sort('g', 'descend')
    await flushPromises()
    expect(lastParams(fetcher)).toMatchObject({ page: 1, sorts: [{ field: 'g', order: 'desc' }, { field: 'n', order: 'asc' }] })

    inst.sort('n', false) // 取消 n,保留 g
    await flushPromises()
    expect(lastParams(fetcher)).toMatchObject({ sortField: 'g', sortOrder: 'desc' })
    expect(lastParams(fetcher)).not.toHaveProperty('sorts')

    inst.sort('n') // order 缺省 = 'ascend'(对齐官方)
    await flushPromises()
    expect(lastParams(fetcher)).toMatchObject({ sorts: [{ field: 'g', order: 'desc' }, { field: 'n', order: 'asc' }] })

    inst.clearSorter()
    await flushPromises()
    expect(lastParams(fetcher)).not.toHaveProperty('sortField')
    wrapper.unmount()
  })

  it('sort() 没传 columnKey(或传 null)= clearSorter()(对齐官方)', async () => {
    const { fetcher, wrapper } = mountRemote(multiCols)
    await flushPromises()
    const inst = wrapper.vm as unknown as Inst
    inst.sort()
    await flushPromises()
    expect(lastParams(fetcher)).not.toHaveProperty('sortField') // 初始的 defaultSortOrder 也被清掉
    inst.sort('g', 'descend')
    await flushPromises()
    inst.sort(null)
    await flushPromises()
    expect(lastParams(fetcher)).not.toHaveProperty('sortField')
    wrapper.unmount()
  })

  it('sort() 对没有 sorter 的列是空操作:不重查,也不通知宿主', async () => {
    const onSorter = vi.fn()
    const { fetcher, wrapper } = mountRemote([{ key: 'name', title: 'Name' }], { 'onUpdate:sorter': onSorter })
    await flushPromises()
    const before = fetcher.mock.calls.length
    ;(wrapper.vm as unknown as Inst).sort('name', 'ascend')
    await flushPromises()
    expect(fetcher.mock.calls.length).toBe(before)
    expect(onSorter).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('D7:sort() / clearSorter() 向宿主的 onUpdate:sorter 各转发一次,载荷形状与官方一致', async () => {
    const onSorter = vi.fn()
    const single = { key: 's', title: 'S', sorter: true }
    const { wrapper } = mountRemote([...multiCols, single], { 'onUpdate:sorter': onSorter })
    await flushPromises()
    const inst = wrapper.vm as unknown as Inst
    const last = () => onSorter.mock.calls.at(-1)![0]

    // multiple 列:载荷是数组 = 已激活的 multiple 列(按列声明顺序)中「同列替换、否则追加」这一项;初始 n 已由 defaultSortOrder 激活
    inst.sort('g', 'descend')
    expect(onSorter).toHaveBeenCalledTimes(1)
    expect(last()).toEqual([
      { columnKey: 'n', sorter: multiCols[1].sorter, order: 'ascend' },
      { columnKey: 'g', sorter: multiCols[0].sorter, order: 'descend' },
    ])

    // order: false:载荷里仍带这一项(order: false),与官方一致
    inst.sort('n', false)
    expect(onSorter).toHaveBeenCalledTimes(2)
    expect(last()).toEqual([
      { columnKey: 'g', sorter: multiCols[0].sorter, order: 'descend' },
      { columnKey: 'n', sorter: multiCols[1].sorter, order: false },
    ])

    // 单列互斥的 sorter:载荷是单个对象,并顶掉其它列
    inst.sort('s', 'ascend')
    expect(onSorter).toHaveBeenCalledTimes(3)
    expect(last()).toEqual({ columnKey: 's', sorter: true, order: 'ascend' })
    await flushPromises()
    const cols = wrapper.findComponent(NDataTable).props('columns') as Array<{ key: string; sortOrder?: unknown }>
    expect(cols.filter((c) => c.sortOrder === 'ascend' || c.sortOrder === 'descend').map((c) => c.key)).toEqual(['s'])

    // clearSorter():载荷是 null
    inst.clearSorter()
    expect(onSorter).toHaveBeenCalledTimes(4)
    expect(last()).toBeNull()
    wrapper.unmount()
  })

  it('[C6] 点表头排序:宿主的 onUpdate:sorter 恰好被调用 1 次(2.1.1 是 2 次)', async () => {
    const onSorter = vi.fn()
    const { wrapper } = mountRemote(multiCols, { 'onUpdate:sorter': onSorter })
    await flushPromises()
    const payload = [{ columnKey: 'g', order: 'descend', sorter: multiCols[0].sorter }]
    // 取 NDataTable 实际收到的监听器(2.1.1 里它是 [宿主, 库] 的数组)并像 Naive 那样逐个调用
    const handler = wrapper.findComponent(NDataTable).props('onUpdate:sorter') as unknown
    for (const fn of Array.isArray(handler) ? handler : [handler]) (fn as (s: unknown) => void)(payload)
    expect(onSorter).toHaveBeenCalledTimes(1)
    expect(onSorter).toHaveBeenCalledWith(payload)
    wrapper.unmount()
  })
})
```

- [ ] **Step 8: 跑,确认失败**

Run: `npx vitest run tests/SmartTable.test.ts`
Expected: `8 failed | 10 passed`(实测)—— C2 首次请求没有 `sortField`(`expected { page: 1, pageSize: 10 } to match object { sortField: 'n', sortOrder: 'asc' }`)、静态模式本地数据没排序(`expected [ '3', '1', '2' ] to deeply equal [ '3', '2', '1' ]`)、C1 缺 `sorts`、`sort()` / `clearSorter()` 相关 4 条 `inst.sort is not a function`、C6 那条读到 2 次调用(`expected "spy" to be called 1 times, but got 2 times`);已有用例不受影响(此刻还没动任何实现)。

- [ ] **Step 9: 实现 —— `useColumns.ts` 与 `SmartTable.vue`(必须一起改)**

**这两处要在同一步里改完再跑测试**:`useColumns` 一旦读数组而 `SmartTable` 还在传单个对象 / `null`,`null.find` 会抛 `TypeError`,连 Task 1 的排序特征测试也会挂。

`src/useColumns.ts`:
1. `import type { ... } from './types'` 列表里加 `SortItem`。
2. `UseColumnsOpts` 里把(连同上方那行 `/** 当前受控排序态 … */` 注释)
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

`src/SmartTable.vue`:
1. `import type {...} from './types'` 列表加 `SortItem`;在 `import { applyFilters } from './filter'` 之后加:
```ts
import { collectSorters, deriveInitSorts, normalizeSorterEvent, sortToParams, sortTransition } from './sorts'
```
2. 把「排序状态(受控)」整段(127–132 行,含那个本地的 `function sortToParams()`)替换为:
```ts
// 排序状态(受控):sorter 列点表头 → 写这里 → 并进 fetcher 参数 + 回显箭头。
// 数组,顺序 = 优先级(列声明的 sorter.multiple 从大到小);初值来自列上的 defaultSortOrder(C2,只在首次 setup 读一次)。
// 不持久化(会话态,与过滤态一致)。
const sortState = ref<SortItem[]>(deriveInitSorts(props.columns))
const sorterInfo = computed(() => collectSorters(props.columns))
function applySorts(items: SortItem[]) {
  sortState.value = items
  if (isRemote.value) void table.search()
}
```
3. `useSmartTable` 的 `extraParams` 里的 `...sortToParams()` 改成 `...sortToParams(sortState.value)`(现在 `sortToParams` 是从 `sorts.ts` 引入的、收参数的版本)。
4. `useColumns` 调用里 `sortState: () => sortState.value` 保持(现在是数组)。
5. 把 `onSorterChange`(208–215 行)整段替换为:
```ts
/** 向宿主挂的 onUpdate:sorter 转发(可能是函数也可能是数组)。 */
function notifyHostSorter(payload: unknown) {
  const hostHandler = attrs['onUpdate:sorter']
  const list = Array.isArray(hostHandler) ? hostHandler : [hostHandler]
  for (const fn of list) if (typeof fn === 'function') (fn as (v: unknown) => void)(payload)
}

// Naive @update:sorter → 更新受控排序态 + 远程重查(回第 1 页)。宿主若另挂 handler 也转发。
function onSorterChange(s: unknown) {
  applySorts(normalizeSorterEvent(s, sorterInfo.value))
  notifyHostSorter(s)
}

/**
 * 编程式排序(对齐官方 DataTableInst.sort,use-sorter.mjs:105-118):order 缺省 'ascend';
 * columnKey 为空 = clearSorter();没有 sorter 的列是空操作。单列互斥的 sorter 会顶掉其它列。
 * 与官方一样会通知宿主的 onUpdate:sorter(载荷形状见 sorts.ts 的 sortTransition)。
 */
function sort(columnKey?: string | null, order: 'ascend' | 'descend' | false = 'ascend') {
  if (!columnKey) return clearSorter()
  const next = sortTransition(sortState.value, sorterInfo.value, columnKey, order)
  if (!next) return
  applySorts(next.items)
  notifyHostSorter(next.event)
}

/** 清空全部排序;与官方一致,向宿主转发 null。 */
function clearSorter() {
  applySorts([])
  notifyHostSorter(null)
}
```
   **C6**:同一步里把 `forwardedAttrs`(`const forwardedAttrs = computed(() => {…})`)里 `delete rest['on-unstable-column-resize']` 之后再加一行,把宿主的 `onUpdate:sorter` 也摘掉 —— 否则它会连同 `@update:sorter="onSorterChange"` 一起被合并成数组交给 `NDataTable`(Naive 调一次),`onSorterChange` 里的 `notifyHostSorter` 又调一次,宿主就被调了两次:
```ts
  delete rest['onUpdate:sorter'] // 由 onSorterChange / sort() / clearSorter() 经 notifyHostSorter 统一转发,只转发一次(C6)
```
   (顺手把它上方注释里「剔除 on(-)unstable-column-resize」补成「…与 onUpdate:sorter」。)
6. `defineExpose({...})` 里,在 `clearFilters: filters.clearFilters,` 之后加:
```ts
  sort,
  clearSorter,
```

`src/index.ts`:在 `export type { ... } from './types'` 的列表里加 `SortItem,`。

- [ ] **Step 10: 翻转特征测试 [C1][C2]**

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

- [ ] **Step 11: 跑,确认全部通过**

Run: `npm test && npm run typecheck`
Expected: `Test Files  13 passed (13)`、`Tests  175 passed (175)`(151 + 24:`sorts.test.ts` 16 条、`SmartTable.test.ts` 8 条);typecheck 无输出。若 `SmartTable.test.ts` 的新用例里 `sort('n', false)` 之后 `sorts` 仍存在,检查 `sortTransition` 对 multiple 列的处理。

- [ ] **Step 12: 提交**

```bash
git add src/sorts.ts src/types.ts src/useColumns.ts src/SmartTable.vue src/index.ts tests/sorts.test.ts tests/useColumns.test.ts tests/SmartTable.test.ts tests/baseline-2.1.1.test.ts
git commit -m "fix: 多列排序不再被截成单列、defaultSortOrder 开始生效、点表头时宿主的 onUpdate:sorter 不再被调两次(C1/C2/C6);新增 sort()/clearSorter()(对齐官方签名并通知宿主)与远程参数 sorts" -m "⚠ C2:此前写了 defaultSortOrder 却没生效的列,升级后会突然生效(静态数据模式下本地数据也会被排序),CHANGELOG 要显著标注。" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: 密度 —— 默认紧凑、去掉按钮、宿主值响应式、旧存储不盖宿主值(B2 / B3)

> 规格 §1 B2/B3、§5.2:
> - 内置默认密度 `comfortable` → **`compact`**;`storage.ts` 读到旧数据但没存 density 时的回退值同步改 `'compact'`。
> - `toolbar.density` **保留、默认改 `false`**;传 `true` 才显示按钮,此时保持旧规则「存储优先」。
> - **没有密度按钮时忽略存储里的 density**(格式与 `VERSION` 不动,继续写入),宿主的值才生效。
> - `defaultDensity` 响应式:宿主 `:default-density="settings.density"` 变了,已挂载的表格跟着变。
> - **写入端不替用户做选择(Q-1)**:`useColumns` 里 `persist`(保存列设置)、`setWidth`(防抖保存列宽)、列被移除时清理 `widths` 的 watch 三处都会调 `saveState`,2.1.1 里它们顺手把「当前密度」写进存储。3.0 的当前密度可能只是宿主给的 `defaultDensity`,照写的话宿主回滚到 2.1.1 后用户会被固定在那个密度上。所以:**保存列设置 / 列宽时不写当前密度,存储里原有的 `density` 原样保留;只有 `setDensity`(用户在密度按钮上选)才写;存储里没有记录、用户也没选过时不写 `density` 字段**(`saveState` 的 `density` 形参放宽成 `Density | undefined`)。
> - 开了 `toolbar.density: true`(存储优先)时,**存储里已有的旧值会继续生效**(包括 2.1.1 默认写进去的 `comfortable`),不是 bug,CHANGELOG 要写明(Task 14)。

**Files:**
- Modify: `src/config.ts`、`src/storage.ts`、`src/types.ts`(注释)、`src/useColumns.ts`、`src/SmartTable.vue`、`src/Toolbar.vue`
- Test: `tests/baseline-2.1.1.test.ts`(翻转 3 处)、`tests/storage.test.ts`(追加;顶部 import 补 `peekStoredDensity`)、`tests/SmartTable.test.ts`(追加)、`tests/Toolbar.test.ts`(新建)、`tests/useColumns.test.ts`(`defaultDensity` 改成 getter,共 2 处,Step 3 末段)

**Interfaces:**
- Consumes: 无(本 Task 之前的产物无关)。
- Produces:
  - `useColumns` 选项:`defaultDensity: () => Density`(原为 `Density`);新增 `respectStoredDensity?: () => boolean`(缺省 `false`);返回值 `density: ComputedRef<Density>`(原 `Ref<Density>`)。
  - `Toolbar.vue`:`cfg.density === true` 才渲染密度按钮;`config` prop 的运行时类型改 `[Object, Boolean]`(测试与宿主传 `toolbar: false` 时不再有 Vue warn,Q-11)。
  - `storage.ts`:`saveState(storageKey, density: Density | undefined, cols, widths?)`(`undefined` = 不写 `density` 字段)。

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
  const base = { columns: [{ key: 'name', title: 'Name' }] as SmartTableColumn<unknown>[], data: rows, rowKey: 'id' }

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

再追加一个 describe(**Q-1:写入端**。2.1.1 里保存列设置 / 拖列宽都会把「当前密度」顺手写进存储;3.0 的当前密度可能是宿主给的 `defaultDensity`,不是用户的选择,照写的话宿主一旦回滚到 2.1.1,用户会被固定在 3.0 的默认密度上)。顶部 import 再补 `import Toolbar from '../src/Toolbar.vue'`(Task 6 也要用它):
```ts
describe('SmartTable 密度的写入端(Q-1:保存列设置 / 列宽不把宿主的密度写进存储)', () => {
  const base = { columns: [{ key: 'name', title: 'Name' }] as SmartTableColumn<unknown>[], data: rows, rowKey: 'id' }
  const raw = (key: string) => JSON.parse(localStorage.getItem('protable:' + key) ?? 'null') as { density?: string } | null

  afterEach(() => {
    vi.useRealTimers()
    localStorage.clear()
  })

  it('存储里原有的 density 原样保留:切列显隐后仍是旧值,不是宿主给的 compact', async () => {
    saveState('dens-w1', 'comfortable', [{ key: 'name', show: true }])
    const wrapper = mount(SmartTable, { props: { ...base, storageKey: 'dens-w1', defaultDensity: 'compact' } })
    wrapper.findComponent(ColumnSettings).vm.$emit('toggle', 'name', false)
    await nextTick()
    expect(raw('dens-w1')!.density).toBe('comfortable')
    wrapper.unmount()
  })

  it('拖列宽落账(防抖写入)同样不改存储里的 density', async () => {
    vi.useFakeTimers()
    saveState('dens-w2', 'comfortable', [{ key: 'name', show: true }])
    const wrapper = mount(SmartTable, {
      props: { ...base, columns: [{ key: 'name', title: 'Name', resizable: true }], storageKey: 'dens-w2', defaultDensity: 'compact' },
    })
    const resize = wrapper.findComponent(NDataTable).props('onUnstableColumnResize') as (...a: unknown[]) => void
    resize(120, 120, { key: 'name' }, () => 200)
    window.dispatchEvent(new MouseEvent('mouseup'))
    vi.advanceTimersByTime(400)
    expect(raw('dens-w2')!.density).toBe('comfortable')
    wrapper.unmount()
  })

  it('没有存储记录、用户也没选过密度:保存列设置时不写 density 字段(不替用户做选择)', async () => {
    const wrapper = mount(SmartTable, { props: { ...base, storageKey: 'dens-w3', defaultDensity: 'compact' } })
    wrapper.findComponent(ColumnSettings).vm.$emit('toggle', 'name', false)
    await nextTick()
    expect(raw('dens-w3')).not.toBeNull()
    expect(raw('dens-w3')).not.toHaveProperty('density')
    wrapper.unmount()
  })

  it('只有 setDensity 才写:开了密度按钮、用户选「紧凑」→ 存储里是 compact;之后保存列设置不会把它改回宿主值', async () => {
    const wrapper = mount(SmartTable, {
      props: { ...base, storageKey: 'dens-w4', defaultDensity: 'comfortable', toolbar: { density: true } },
    })
    wrapper.findComponent(Toolbar).vm.$emit('update:density', 'compact')
    await nextTick()
    expect(raw('dens-w4')!.density).toBe('compact')
    wrapper.findComponent(ColumnSettings).vm.$emit('toggle', 'name', false)
    await nextTick()
    expect(raw('dens-w4')!.density).toBe('compact')
    wrapper.unmount()
  })

  it('[E6] 存储里有记录但没有 density 字段:开了密度按钮时取宿主的 defaultDensity(不是写死的回退值)', () => {
    saveState('dens-w5', undefined, [{ key: 'name', show: true }])
    const wrapper = mount(SmartTable, {
      props: { ...base, storageKey: 'dens-w5', defaultDensity: 'comfortable', toolbar: { density: true } },
    })
    expect(wrapper.findComponent(NDataTable).props('size')).toBe('medium')
    wrapper.unmount()
  })

  it('[Q-1] 记录里没有 density 字段(上次没选过):这次保存列设置仍不写这个字段', async () => {
    saveState('dens-w6', undefined, [{ key: 'name', show: true }])
    const wrapper = mount(SmartTable, { props: { ...base, storageKey: 'dens-w6', defaultDensity: 'compact' } })
    wrapper.findComponent(ColumnSettings).vm.$emit('toggle', 'name', false)
    await nextTick()
    expect(raw('dens-w6')).not.toBeNull()
    expect(raw('dens-w6')).not.toHaveProperty('density')
    wrapper.unmount()
  })

  it('[F14] 「恢复默认」清掉存储后,闭包里记着的旧密度也要清:之后保存列设置不会把旧密度写回去', async () => {
    saveState('dens-w7', 'comfortable', [{ key: 'name', show: true }])
    const wrapper = mount(SmartTable, { props: { ...base, storageKey: 'dens-w7', defaultDensity: 'compact' } })
    wrapper.findComponent(ColumnSettings).vm.$emit('reset')
    await nextTick()
    expect(raw('dens-w7')).toBeNull() // 恢复默认 = 清掉整条存储
    wrapper.findComponent(ColumnSettings).vm.$emit('toggle', 'name', false)
    await nextTick()
    expect(raw('dens-w7')).not.toBeNull()
    expect(raw('dens-w7')).not.toHaveProperty('density') // 不是 'comfortable'
    wrapper.unmount()
  })
})
```


在 `tests/storage.test.ts` 末尾追加:
```ts
describe('loadState / saveState 的密度(B2 / Q-1)', () => {
  it('旧数据里没有 density 字段时回退成 compact(与内置默认一致)', () => {
    localStorage.setItem('protable:nodens', JSON.stringify({ v: 2, cols: [], widths: {} }))
    expect(loadState('nodens')?.density).toBe('compact')
  })

  it('saveState 的 density 传 undefined(用户从没选过)时不写这个字段;loadState 读回时仍回退成 compact', () => {
    saveState('nodens-w', undefined, [{ key: 'a', show: true }])
    expect(JSON.parse(localStorage.getItem('protable:nodens-w')!)).not.toHaveProperty('density')
    expect(loadState('nodens-w')?.density).toBe('compact')
  })

  it('[E6] loadState 的第二参数 fallbackDensity:记录里没有 density 字段时取它(宿主的 defaultDensity),有字段时取字段', () => {
    localStorage.setItem('protable:nodens2', JSON.stringify({ v: 2, cols: [], widths: {} }))
    expect(loadState('nodens2', 'comfortable')?.density).toBe('comfortable')
    expect(loadState('nodens2')?.density).toBe('compact') // 不传 = 内置默认,与 B2 一致
    saveState('hasdens', 'compact', [])
    expect(loadState('hasdens', 'comfortable')?.density).toBe('compact')
  })

  it('peekStoredDensity:只认存储里真的存过的值(没有记录 / 没有字段 / 非法值 → undefined)', () => {
    expect(peekStoredDensity('never')).toBeUndefined()
    saveState('p1', undefined, [])
    expect(peekStoredDensity('p1')).toBeUndefined()
    saveState('p2', 'comfortable', [])
    expect(peekStoredDensity('p2')).toBe('comfortable')
    localStorage.setItem('protable:p3', JSON.stringify({ v: 2, density: 'huge', cols: [], widths: {} }))
    expect(peekStoredDensity('p3')).toBeUndefined()
  })
})
```
(顶部 import 补 `peekStoredDensity`;若该文件没有 `loadState` 的 import 一并补上。)

- [ ] **Step 2: 跑,确认失败**

Run: `npx vitest run tests/Toolbar.test.ts tests/SmartTable.test.ts tests/storage.test.ts`
Expected: `Test Files  3 failed (3)`、`Tests  11 failed | 36 passed (47)`(实测)。11 条的构成:SmartTable 密度 3 条(默认仍是 `medium`:`expected 'medium' to be 'small'`;旧存储仍盖过宿主值;`defaultDensity` 不响应式)、工具栏 1 条(默认仍有密度按钮:`not to contain 'aria-label="Density"'`)、写入端 3 条(无记录时仍写了 `density: 'compact'`;记录里没有 density 字段时仍写了回退的 `comfortable`;[F14]「恢复默认」后保存列设置仍写回旧密度)、storage 4 条(回退值是 `comfortable`:`expected 'comfortable' to be 'compact'`,3 条;`peekStoredDensity is not a function`,1 条)。输出里还能看到 `[Vue warn]: Invalid prop: type check failed for prop "config". Expected Object, got Boolean with value false`(Q-11,Step 3 修掉)。**Q-1 的另外 4 条写入端用例此刻就是绿的**(旧实现写回的正是存储里的值)—— 它们是给 Step 3 的新实现兜底用的,防止改成「永远写宿主的密度」。

- [ ] **Step 3: 实现**

`src/config.ts`:
- `density?: Density` 的注释 `内置兜底 'comfortable'` 改为 `内置兜底 'compact'`;
- `BUILTIN_DEFAULTS` 里 `density: 'comfortable',` 改为 `density: 'compact',`。

`src/storage.ts`:
1. **`loadState` 加可选第二参数 `fallbackDensity`(E6,公开导出,签名向后兼容)**:2.1.1 里存储有记录但没有 `density` 字段时写死回退 `'comfortable'`,会盖过宿主给的 `defaultDensity`。改成
```ts
export function loadState(storageKey: string, fallbackDensity: Density = 'compact'): StoredTableState | null {
```
并把返回对象里的 `density: parsed.density ?? 'comfortable',` 改为 `density: parsed.density ?? fallbackDensity,`(缺省 `'compact'` = 内置默认,与 B2 一致);`useColumns` 调用时传宿主解析后的 `defaultDensity`(见下方 `useColumns` 的第 4 点)。再在 `loadState` 之后加一个**内部**辅助(不进 `index.ts`),写回时用它判断「存储里有没有真的存过 density」:
```ts
/** 存储里**真的存过**的 density;没有记录、或记录里没有这个字段 → undefined。写回时用它,免得把回退值当成用户的选择写进去(Q-1)。 */
export function peekStoredDensity(storageKey: string): Density | undefined {
  try {
    const raw = localStorage.getItem(PREFIX + storageKey)
    const d = raw ? (JSON.parse(raw) as { density?: unknown } | null)?.density : undefined
    return d === 'comfortable' || d === 'compact' ? d : undefined
  } catch {
    return undefined
  }
}
```
2. `saveState` 的形参 `density: Density` 改为 `density: Density | undefined`(Q-1),并把写入的对象改成「`undefined` 就不带 `density` 键」:
```ts
    const state: Omit<StoredTableState, 'density'> & { density?: Density } = {
      v: VERSION,
      ...(density ? { density } : {}),
      cols,
      widths,
    }
    localStorage.setItem(PREFIX + storageKey, JSON.stringify(state))
```
(替换原来的 `const state: StoredTableState = { v: VERSION, density, cols, widths }` 与紧随其后的 `localStorage.setItem(…)` 两行。)

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
5. 在 `const density = computed…` 之后加(Q-1):
```ts
  // 写回存储的 density:只有两个来源 —— 存储里原有的值,或用户在密度按钮上选的值(setDensity)。
  // 保存列设置 / 列宽时绝不把宿主给的 defaultDensity 当成用户的选择写进去;
  // 没有存储记录、用户也没选过 → undefined,saveState 不写这个字段。
  let storedDensity: Density | undefined = opts.storageKey ? peekStoredDensity(opts.storageKey) : undefined
```
   并把文件开头的 `const stored = opts.storageKey ? loadState(opts.storageKey) : null` 改成 `loadState(opts.storageKey, opts.defaultDensity())`(E6),`import { clearState, loadState, mergeCols, saveState, … } from './storage'` 里补 `peekStoredDensity`。
6. `setDensity` 整个替换为:
```ts
  function setDensity(next: Density) {
    userDensity.value = next
    storedDensity = next
    if (opts.storageKey) saveState(opts.storageKey, next, effectiveChecks.value, widths.value)
  }
```
(原函数参数名 `d` 与外层 `const d = opts.defaults` 重名,这里顺手改成 `next`。)
7. 其余三处 `saveState(…, density.value, …)`(`persist`、`setWidth` 防抖回调里的 `saveState(opts.storageKey!, density.value, …)`、列被移除时清理 `widths` 的 watch)里的 `density.value` 全部改成 `storedDensity`。
8. **`resetSettings`(「恢复默认」)里、`clearState` 之后加一行 `storedDensity = undefined`**(F14):它清掉了存储,闭包里记着的旧密度也要一起清,否则之后保存列设置会把旧密度写回去(`storedDensity` 是 `let`,声明在 `density` 之后、`resetSettings` 之前,无 TDZ 问题)。

`src/SmartTable.vue`:`useColumns<T>({...})` 里把 `defaultDensity: props.defaultDensity ?? defaults.density,` 替换为:
```ts
  defaultDensity: () => props.defaultDensity ?? defaults.density,
  respectStoredDensity: () => typeof props.toolbar === 'object' && props.toolbar.density === true,
```

`src/Toolbar.vue`:
- `const cfg = computed<ToolbarConfig>(...)` 保持;
- `<n-dropdown v-if="cfg.density !== false"` 改为 `v-if="cfg.density === true"`;
- `config: { type: Object as PropType<ToolbarConfig | false>, default: () => ({}) }` 改为 `config: { type: [Object, Boolean] as PropType<ToolbarConfig | false>, default: () => ({}) }`(`toolbar: false` 是合法取值,运行时类型只写 `Object` 会让传 `false` 时 Vue 报 prop 类型 warn,Q-11)。

并修改 `tests/useColumns.test.ts` 里**两处**直接构造 `useColumns` 的 `opts`:① `build()` 里的 `defaultDensity: 'comfortable' as const,`;② 「列被移除后,widths 里对应的旧宽度也跟着清掉」用例里手写的 `useColumns<Row>({ … defaultDensity: 'comfortable', … })`。两处都改成 getter:`defaultDensity: () => 'comfortable' as const,`(第二处不需要 `as const`)。**漏改第二处会在 typecheck 时报错。**

- [ ] **Step 4: 翻转特征测试 [B2][B3]**

`tests/baseline-2.1.1.test.ts`:
1. 「[B1][B2] 内置兜底」用例里 `expect(BUILTIN_DEFAULTS.density).toBe('comfortable')` 改为 `'compact'`,标题改成 `'[B1] 内置兜底:每页 [10,20,50];[B2 已翻转] 密度 compact'`。
2. 「[B2] 默认舒适…」整个 `describe('2.1.1 特征:密度')` 改为(Q-11:用例标题与函数体一致 —— 「存过旧值的用户」必须真的存一次):
```ts
describe('3.0 密度(B2 已翻转)', () => {
  it('默认紧凑(small)', () => {
    const plain = mount(SmartTable, { props: { columns: [{ key: 'name', title: 'Name' }], data: rows, rowKey: 'id' } })
    expect(plain.findComponent(NDataTable).props('size')).toBe('small')
    plain.unmount()
  })

  it('存储里存过 comfortable 的用户,没有密度按钮时存储不参与:取默认 compact(small)', () => {
    saveState('baseline-density', 'comfortable', [{ key: 'name', show: true }])
    const stored = mount(SmartTable, {
      props: { columns: [{ key: 'name', title: 'Name' }], data: rows, rowKey: 'id', storageKey: 'baseline-density' },
    })
    expect(stored.findComponent(NDataTable).props('size')).toBe('small')
    stored.unmount()
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
(`saveState` 的 import 仍然在用,保留。)

- [ ] **Step 5: 跑,确认全部通过**

Run: `npm test && npm run typecheck`
Expected: `Test Files  14 passed (14)`、`Tests  194 passed (194)`(175 + 19:`Toolbar.test.ts` 3、`SmartTable.test.ts` 11、`storage.test.ts` 4、`baseline-2.1.1.test.ts` +1);typecheck 无输出;输出里**没有** `[Vue warn]`(`toolbar: false` 用例不再触发 prop 类型 warn)。**若 `SmartTable.test.ts` 里「开了 toolbar.density:true 仍是存储优先」失败**,检查 `respectStoredDensity` 是在 `useColumns` 创建时读的(`ref` 初值只算一次)——这是有意的:该开关在挂载时决定,不做响应式。

- [ ] **Step 6: 提交**

```bash
git add src/config.ts src/storage.ts src/types.ts src/useColumns.ts src/SmartTable.vue src/Toolbar.vue tests/baseline-2.1.1.test.ts tests/storage.test.ts tests/SmartTable.test.ts tests/Toolbar.test.ts tests/useColumns.test.ts
git commit -m "feat!: 默认密度改为紧凑、工具栏默认去掉密度按钮、宿主的 defaultDensity 响应式且不再被旧存储盖过(B2/B3)" -m "有意的默认行为变更:回退 → defaultDensity=\"comfortable\";想要按钮 → toolbar: { density: true }(此时存储优先)。" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: 工具栏 —— 静态模式隐藏刷新(B5)、`toolbar.more` 菜单与 `moreSelect` 事件

> 规格 §1 B5、§3、§5.2。
> - 刷新按钮:`toolbar.refresh !== false && 远程模式`;静态数据模式(没传 `fetcher`)不显示,即使显式写了 `toolbar.refresh: true`(显示了也是摆设)。实例方法 `refresh()` 保持导出、保持现有语义。
> - `toolbar.more?: ToolbarMoreOption[]`:官方 `NDropdown` 的 `options` 原样透传(文档只保证 `label` / `key` / `disabled` 与 `{ type: 'divider' }`);**没传、空数组、或只有分隔线时不渲染按钮**;选中后库发出 `moreSelect(key, option)`,由宿主处理。**库不内置导出 / 导入**。
> - 位置:`#toolbar-right` 宿主按钮**之后**、内置图标**之前**;文字按钮 + 下箭头,默认描边样式;文案走 labels `more`。
> - **窄档(容器 < 600)**:P0 里工具栏在窄 / 宽容器下是同一套(D12:窄档把业务按钮折叠成「操作 ▾」归 P2,由 `cardOnNarrow` 门控),这里只用浏览器步骤确认现状不溢出。
> - 官方事实(已核):`DropdownMixedOption` **不是**公开导出的类型,用 `NonNullable<DropdownProps['options']>[number]` 取;`NButton` 有 `iconPlacement: 'left' | 'right'`;`NDropdown` 的 `select` 事件回传 `(key, option)`。

**Files:**
- Modify: `src/types.ts`、`src/labels.ts`、`src/icons.ts`、`src/Toolbar.vue`、`src/SmartTable.vue`、`src/index.ts`、`playground/DemoBasic.vue`(加「更多」菜单示例)
- Test: `tests/Toolbar.test.ts`(追加)、`tests/SmartTable.test.ts`(追加)

**Interfaces:**
- Consumes: Task 5 的 `Toolbar.vue`(已按 `cfg.density === true` 渲染密度按钮)。
- Produces:
  - `types.ts`:`type ToolbarMoreOption = NonNullable<DropdownProps['options']>[number]`;`ToolbarConfig.more?: ToolbarMoreOption[]`;`SmartTableLabels.more?: string`(可选,D9;`defaultLabels` 补 `'More'`、`zhCNLabels` 补 `'更多'`)
  - `Toolbar.vue`:新 prop `remote: boolean`(默认 `true`)、新事件 `moreSelect: [key: string | number, option: DropdownOption]`
  - `SmartTable.vue`:新事件 `moreSelect: [key: string | number, option: DropdownOption]`
  - `icons.ts`:`ChevronDownIcon`、`CloseIcon`(后者给 Task 10 用,这里一并加)

- [ ] **Step 1: 写失败测试**

在 `tests/Toolbar.test.ts` 顶部 import 区加一行 `import { NDropdown } from 'naive-ui'`,并在文件末尾追加:
```ts
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

在 `tests/SmartTable.test.ts` 末尾追加(`Toolbar` 已在 Task 5 import;泛型写 `SmartTableColumn<unknown>[]`,原因同 Task 4 Step 7):
```ts
describe('SmartTable 工具栏接线(B5 / more)', () => {
  const base = { columns: [{ key: 'name', title: 'Name' }] as SmartTableColumn<unknown>[], rowKey: 'id' }

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
Expected: `6 failed`(实测)—— 静态模式仍显示刷新(`not to contain 'aria-label="Refresh"'`,Toolbar 与 SmartTable 各 1 条);`aria-label="More"` 不存在(2 条)、`Cannot call props on an empty VueWrapper`(找不到 NDropdown)、SmartTable 没有 `moreSelect` 事件(`expected undefined to deeply equal`)。「没传 / 空数组 / 只有分隔线 / toolbar:false → 不渲染」此刻是绿的(本来就没有按钮)。

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
- `SmartTableLabels` 里 `filterNoValue?: string` 之后加一个**可选**键(D9):
```ts
  /** 工具栏「更多」菜单按钮文字。 */
  more?: string
```

`src/labels.ts`:`defaultLabels` 里 `filterNoValue: 'No value needed',` 之后加 `more: 'More',`;`zhCNLabels` 里 `filterNoValue: '无需填值',` 之后加 `more: '更多',`。

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
  labels: { type: Object as PropType<Required<SmartTableLabels>>, required: true }, // 保留 Task 2 改好的 Required<>(D9)
  // [Object, Boolean]:toolbar: false 是合法取值,只写 Object 时传 false 会让 Vue 报 prop 类型 warn(Q-11)
  config: { type: [Object, Boolean] as PropType<ToolbarConfig | false>, default: () => ({}) },
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
Expected: `Test Files  14 passed (14)`、`Tests  203 passed (203)`(194 + 9:`Toolbar.test.ts` +6、`SmartTable.test.ts` +3);typecheck 无输出。**若 typecheck 报 `DropdownProps` 找不到**,核对 `node_modules/naive-ui/es/dropdown/index.d.ts` 里确实导出了 `type DropdownProps`(2.45.3 已核:有)。

- [ ] **Step 7: playground 给「基础」示例加一个「更多」菜单(正式提交的示例改动,供下一步的浏览器验证用)**

`playground/DemoBasic.vue`:`<script setup>` 里、`columns` 定义之前加:
```ts
// toolbar.more:官方 NDropdown 的 options 原样透传;选中后库发 moreSelect(key, option),由宿主处理(库不内置导出 / 导入)
const moreOptions = [
  { label: tt('导出', 'Export'), key: 'export' },
  { label: tt('导入', 'Import'), key: 'import' },
  { type: 'divider' as const, key: 'd1' },
  { label: tt('下载导入模板', 'Download template'), key: 'tpl' },
]
```
模板里 `<SmartTable` 的属性里、`storage-key="demo-basic"` 之前加两行:
```vue
    :toolbar="{ more: moreOptions }"
    @more-select="(key) => message.info(`more: ${String(key)}`)"
```
Run: `npm run typecheck`
Expected: 无输出(`playground/` 在 `tsconfig.json` 的 `include` 里,示例的类型错误也会在这里暴露)。

- [ ] **Step 8: 浏览器验证(D13:工具栏会不会溢出 / 换行,只能在真实布局里看)**

Run: `node_modules/.bin/vite --port 5173`(仓库根),打开 playground「基础」示例。在浏览器控制台执行(依次把库根节点所在容器设成 390 / 560 / 720 / 1024 px 宽,量工具栏有没有横向溢出):
```js
const root = document.querySelector('.smart-table')
const host = root.parentElement
const out = {}
for (const w of [390, 560, 720, 1024]) {
  host.style.width = w + 'px'
  await new Promise((r) => setTimeout(r, 150))
  const tb = root.querySelector('.smart-table-toolbar')
  out[w] = { scrollWidth: tb.scrollWidth, clientWidth: tb.clientWidth, ok: tb.scrollWidth <= tb.clientWidth }
}
host.style.width = ''
out
```
Expected:
1. 四个宽度的 `ok` 都是 `true`(`scrollWidth ≤ clientWidth`)。**若 390 下是 `false`,记录实测宽度并停下来**:说明工具栏右侧在窄容器里放不下了 —— 窄档把业务按钮折叠成「操作 ▾」是 P2(`cardOnNarrow`)的内容,**P0 不做**,此时只在覆盖对照表里记下这个已知限制,不要顺手在本 Task 里加折叠逻辑。
2. 点「更多」:弹出「导出 / 导入 / 分隔线 / 下载导入模板」;点「导出」后页面上方出现 `more: export` 的提示。
3. 「更多」排在右侧内置图标(刷新、列设置)的**左边**,文字按钮 + 下箭头;切到暗色(右上角「暗色」开关)后按钮描边与文字仍清晰可读。
4. 切到「CRUD」页签(远程模式,`#toolbar` 有「新增」按钮):刷新按钮仍在;切到「过滤 / 列宽」页签(静态 `data`):**没有**刷新按钮(B5)。
记录没有成立的项,**不要**假装通过。结束后关掉 vite。

- [ ] **Step 9: 提交**

```bash
git add src/types.ts src/labels.ts src/icons.ts src/Toolbar.vue src/SmartTable.vue src/index.ts tests/Toolbar.test.ts tests/SmartTable.test.ts playground/DemoBasic.vue
git commit -m "feat: 静态数据模式隐藏刷新按钮(B5);新增 toolbar.more「更多」菜单与 moreSelect 事件" -m "有意的默认行为变更:静态模式下刷新本来就是空操作,现在不再显示;refresh() 方法保留。" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: 分页 —— 默认每页 100、官方嵌套每页选择器、`defaultPageSize` 解析、`paginationBehaviorOnFilter`(B1 / B4 / B9,D3 / D4 / E2)

> 规格 §1 B1/B4/B9、§5.5。**已在真实 `NPagination` 上验证(设计文档 9.1 / spike S2)**:官方 `simple` 模式**不渲染每页条数选择器**(`Pagination.mjs:665` `!simple && showSizePicker`)。
>
> **每页条数选择器用官方嵌套 `NPagination`(E2,取代原稿的手写 `NSelect`)**:官方 `NPagination` 有 `displayOrder`(`pagination/src/Pagination.mjs:68`、`:481`,2.32.2 引入,在 peer `^2.34.0` 范围内)。在外层 simple 分页的 `suffix` 里嵌一个非 simple 的 `NPagination`,传 `displayOrder: ['size-picker']`,只渲染官方选择器。spike S2 实测:与 simple 分页同一行、高度全为 28、明 / 暗同主题、选项文案自动跟 `NConfigProvider` 的 locale(zh「100 / 页」、en「100 / page」)、支持 `{ label, value }` 选项、键盘可用。**因此删掉手写 `pageSizePicker` 与 `pageSizeSuffix` label**(不新增这个 label,中文宿主也不会从 2.1.1 的「10 / 页」退化成「100 / page」)。已知的三件事(都在本 Task 处理):
> - **内层不夹页**:受控下内层 `doUpdatePage` 夹页永远不触发(内层算页数用的还是旧的受控 `pageSize`),所以「改每页条数后回第 1 页」必须由库自己做 —— 远程模式 `onPageSize` 本来就回第 1 页,**本地模式**由库置 `localPage = 1` 并调官方 `DataTableInst.page(1)`(官方外层本地分页只会静默夹页、**不发 `onUpdatePage`**,不处理的话库里记页码的 `localPage` 会陈旧)。
> - **当前 `pageSize` 不在 `pageSizes` 里**时官方选择器显示裸值(如「15」,没有「/ 页」后缀,也不标记选中,不是空白)→ 传给内层的 `pageSizes` **并入当前值**(数字项官方会补本地化后缀,对象项保持原样)。
> - **窄容器**(卡片内宽 ≤ 340)分页条会折成多行 → 窄档(库根节点宽 < 600,`narrowPager`)**整个不渲染 `suffix`**。**用 `ResizeObserver` 量库根节点宽度**(库已经在用它量表格容器)。
>
> **`simple` 默认 `true`**;宿主传 `pagination: { simple: false }` 回到页码序列(官方自己的 `simple` 属性,**没有新增 API**),此时走官方 `showSizePicker` / `pageSizes`(同样并入当前值)。**`simple` 下官方不渲染 `showQuickJumper` / `pageSlot`,传了也不再生效**(CHANGELOG 要写)。
>
> **B1 与 `defaultPageSize` 的解析(D4)**:`pageSizes` 内置默认 `[100, 500, 1000]`,每页条数默认 100。⚠ 远程模式请求的 `pageSize` 变 100,后端若限制上限会拒绝,CHANGELOG 单列。**回退要真能「一行」**:`SmartTableDefaults` 新增 `defaultPageSize?: number`(纯新增);解析优先级 = **实例 `defaultPageSize` prop > 实例 `pagination.pageSize` / `pagination.defaultPageSize` > 全局 `defaultPageSize` > 宿主(实例或全局)显式给了 `pageSizes` 时取 `pageSizes[0]`(对象取 `.value`)> 库默认 100**。为能判断「宿主没给」,`SmartTable` 的 `defaultPageSize` prop 的 Vue 默认值改成 `undefined`,在 `src/pageSize.ts` 的纯函数里解析。无 UI 的导出 hook `useSmartTable` 的默认 10 **不动**(规格要明写这一点);B1 的真实生效点是 `src/SmartTable.vue:62`(`default: 10`)、`src/useSmartTable.ts:32`(`?? 10`)、`src/config.ts:75`,`types.ts:244` 只是注释。
>
> **D3 的 6 处回归(都有专门测试)**:① 宿主单表 `pagination.showSizePicker: false` 在 simple 下曾失效(只读 `defaults.showSizePicker`)→ 用 `user.showSizePicker ?? defaults.showSizePicker`;② `pageSizes` 里的 `{ label, value }` 对象曾被 `.filter(s => typeof s === 'number')` 丢掉 → 保留;③ 本地模式库自画选择器改每页条数曾不转发宿主 `onUpdatePageSize` → 转发;④ 本地模式宿主 `pagination.defaultPageSize: 20` 曾被受控 `pageSize: localPageSize.value`(= 100)盖掉 → `localPageSize` 初值取解析结果;⑤ 远程模式宿主传 `pagination.pageSize: 10` 时曾分页条按 10 算、首个请求却是 100 → 解析结果同时给 `useSmartTable` 的初始 `pageSize`;⑥ `simple: false` 回退时当前 `pageSize` 不在 `pageSizes` 里 → 并入当前值。
>
> B9:筛选后分页——宿主显式传了官方 `paginationBehaviorOnFilter` 就照官方(`'current'` 留在当前页、`'first'` 回第 1 页);没传保持库现状(远程回第 1 页;本地不动)。**偏离只发生在 remote**:官方只在本地模式夹页(`use-table-data.mjs:140`:`props.remote ? page : clamp(...)`),remote 下官方默认 `'current'` 可能停在不存在的页;本地模式其实等同官方。
>
> **翻页后滚回卡片顶部(E4)不在本 Task,放 Task 12b**:它只在「不开 `fillHeight`」时做,与 `fillHeight` 是 D5 的两半,共用同一个 `rootRef` 与分页回调,放在同一个 Task 里一起测、一起做浏览器验证,比拆开少一次对 `onUpdatePage` 的重复改动。

**Files:**
- Create: `src/pageSize.ts`
- Modify: `src/config.ts`、`src/types.ts`(注释)、`src/SmartTable.vue`、`playground/DemoFilter.vue`(宿主自定义 `pageSizes` 示例)
- Test: `tests/pageSize.test.ts`(新建)、`tests/config.test.ts`(**有意翻转** `pageSizes` 断言,P-1)、`tests/baseline-2.1.1.test.ts`(翻转 3 处)、`tests/SmartTable.test.ts`(追加)

**Interfaces:**
- Consumes: Task 5 已把 `BUILTIN_DEFAULTS.density` 改成 compact(本 Task 只改 `pageSizes`)。
- Produces:
  - `pageSize.ts`:`type PageSizeOption = NonNullable<PaginationProps['pageSizes']>[number]`(官方 `pageSizes` 的元素类型:数字,或 `{ label?, value? }` 对象);`pageSizeValue(s: PageSizeOption): number`;`mergePageSizes(list: readonly PageSizeOption[], current: number): PageSizeOption[]`;`resolveDefaultPageSize(input: DefaultPageSizeInput, builtin?: number): number`
  - `config.ts`:`SmartTableDefaults.defaultPageSize?: number`;`ResolvedSmartTableDefaults.defaultPageSize?: number` 与 `pageSizesGiven: boolean`(宿主是否显式注入了 `pageSizes`)
  - `SmartTable.vue` 内部:`initialPageSize: number`、`localPageSize: Ref<number>`、`rootWidth: Ref<number>`、`narrowPager: ComputedRef<boolean>`

- [ ] **Step 1: 写失败测试**

Create `tests/pageSize.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { mergePageSizes, pageSizeValue, resolveDefaultPageSize } from '../src/pageSize'

describe('pageSizeValue / mergePageSizes(并入当前值)', () => {
  it('pageSizeValue:数字取自己,对象取 value', () => {
    expect(pageSizeValue(20)).toBe(20)
    expect(pageSizeValue({ label: '每页 50 条', value: 50 })).toBe(50)
  })
  it('当前值已在里面 → 原样(拷贝);不在 → 并入并按值升序,对象项保持 { label, value }', () => {
    expect(mergePageSizes([100, 500], 100)).toEqual([100, 500])
    expect(mergePageSizes([100, 500, 1000], 10)).toEqual([10, 100, 500, 1000])
    const obj = { label: '每页 50 条', value: 50 }
    expect(mergePageSizes([20, obj, 100], 30)).toEqual([20, 30, obj, 100])
    expect(mergePageSizes([20, obj], 50)).toEqual([20, obj]) // 对象项的 value 也算「已在里面」
  })
  it('不改入参', () => {
    const list = [100, 500]
    mergePageSizes(list, 10)
    expect(list).toEqual([100, 500])
  })
})

describe('resolveDefaultPageSize(D4 的解析优先级)', () => {
  it('没有任何来源 → 库默认 100', () => {
    expect(resolveDefaultPageSize({})).toBe(100)
  })
  it('实例 prop 最高', () => {
    expect(
      resolveDefaultPageSize({ prop: 20, pageSize: 30, defaultPageSize: 40, globalDefaultPageSize: 50, pageSizes: [60], globalPageSizes: [70] }),
    ).toBe(20)
  })
  it('其次实例 pagination.pageSize,再其次 pagination.defaultPageSize', () => {
    expect(resolveDefaultPageSize({ pageSize: 30, defaultPageSize: 40, globalDefaultPageSize: 50 })).toBe(30)
    expect(resolveDefaultPageSize({ defaultPageSize: 40, globalDefaultPageSize: 50, pageSizes: [60] })).toBe(40)
  })
  it('再其次全局 defaultPageSize,它高于任何 pageSizes[0]', () => {
    expect(resolveDefaultPageSize({ globalDefaultPageSize: 50, pageSizes: [60], globalPageSizes: [70] })).toBe(50)
  })
  it('宿主显式给了 pageSizes → 取 [0](实例的先于全局的;对象取 value);回退「一行」:只写 pageSizes 也能让首个请求变小', () => {
    expect(resolveDefaultPageSize({ pageSizes: [10, 20, 50] })).toBe(10)
    expect(resolveDefaultPageSize({ pageSizes: [{ label: '每页 25 条', value: 25 }, 50] })).toBe(25)
    expect(resolveDefaultPageSize({ pageSizes: [10], globalPageSizes: [70] })).toBe(10)
    expect(resolveDefaultPageSize({ globalPageSizes: [70, 80] })).toBe(70)
  })
  it('空的 pageSizes 不算「给了」', () => {
    expect(resolveDefaultPageSize({ pageSizes: [], globalPageSizes: [] })).toBe(100)
  })
})
```

`tests/config.test.ts`:
1. 「注入的字段覆盖兜底,未给的字段保持兜底」用例里的 `expect(r.pageSizes).toEqual([10, 20, 50])` **有意翻转**为 `[100, 500, 1000]`(P-1:B1 落地后这条必红,它锁的正是 2.1.1 的旧默认值;翻转必须与 B1 在同一个提交里,并写进提交说明)。
2. 文件末尾追加:
```ts
describe('defaultPageSize / pageSizesGiven(D4)', () => {
  it('不注入:pageSizesGiven 为 false,没有全局 defaultPageSize', () => {
    const r = resolveDefaults()
    expect(r.pageSizes).toEqual([100, 500, 1000])
    expect(r.pageSizesGiven).toBe(false)
    expect(r.defaultPageSize).toBeUndefined()
  })
  it('注入了 pageSizes → pageSizesGiven 为 true;注入 defaultPageSize 原样透传', () => {
    expect(resolveDefaults({ pageSizes: [10, 20] })).toMatchObject({ pageSizes: [10, 20], pageSizesGiven: true })
    expect(resolveDefaults({ defaultPageSize: 30 }).defaultPageSize).toBe(30)
    expect(resolveDefaults({ defaultPageSize: 30 }).pageSizesGiven).toBe(false)
  })
})
```

在 `tests/SmartTable.test.ts` 末尾追加(泛型写 `SmartTableColumn<unknown>[]`,原因同 Task 4 Step 7;顶部 import 改成 `import { NCard, NDataTable, NPagination } from 'naive-ui'`(Task 8 再补 `NCard`,这里先写成 `import { NDataTable, NPagination } from 'naive-ui'`),并补 `import { SMART_TABLE_DEFAULTS } from '../src/config'`):
```ts
describe('SmartTable 分页(B1 / B4 / B9 / D3 / D4)', () => {
  const base = { columns: [{ key: 'name', title: 'Name' }] as SmartTableColumn<unknown>[], rowKey: 'id' }
  const many = Array.from({ length: 50 }, (_, i) => ({ id: i + 1, name: `n${i + 1}` }))
  type PagerProps = {
    simple?: boolean
    pageSize?: number
    showSizePicker?: boolean
    pageSizes?: unknown[]
    suffix?: (info: Record<string, number>) => { type: unknown; props: Record<string, any> }
    onUpdatePage?: (p: number) => void
  }
  const pagerProps = (w: ReturnType<typeof mount>) => w.findComponent(NDataTable).props('pagination') as PagerProps
  /** 渲染 suffix,拿到内层官方 NPagination 的 vnode */
  const picker = (w: ReturnType<typeof mount>, pageSize = 100) =>
    pagerProps(w).suffix!({ page: 1, pageSize, pageCount: 1, itemCount: 2, startIndex: 0, endIndex: 1 })
  const sizeValues = (vnode: { props: Record<string, any> }) =>
    (vnode.props.pageSizes as Array<number | { value: number }>).map((s) => (typeof s === 'number' ? s : s.value))

  it('B1 / B4:静态模式默认每页 100、simple;每页选择器是官方嵌套 NPagination,只渲染 size-picker', () => {
    const wrapper = mount(SmartTable, { props: { ...base, data: rows } })
    const p = pagerProps(wrapper)
    expect(p.simple).toBe(true)
    expect(p.pageSize).toBe(100)
    expect(p.showSizePicker).toBeUndefined() // 官方 simple 不渲染选择器,所以外层不设
    const v = picker(wrapper)
    expect(v.type).toBe(NPagination)
    expect(v.props).toMatchObject({ displayOrder: ['size-picker'], showSizePicker: true, pageSize: 100, itemCount: 2, page: 1 })
    expect(v.props.pageSizes).toEqual([100, 500, 1000])
    wrapper.unmount()
  })

  it('[Review Focus 2] 当前 pageSize 不在 pageSizes 里(宿主传 pageSize: 10)→ 传给内层的 pageSizes 并入当前值', () => {
    const wrapper = mount(SmartTable, { props: { ...base, data: rows, pagination: { pageSize: 10 } } })
    expect(sizeValues(picker(wrapper, 10))).toEqual([10, 100, 500, 1000])
    wrapper.unmount()
  })

  it('[D3 #2] 宿主 pagination.pageSizes 里的 { label, value } 对象原样保留,不被当非数字项丢掉', () => {
    const obj = { label: '每页 50 条', value: 50 }
    const wrapper = mount(SmartTable, { props: { ...base, data: rows, pagination: { pageSizes: [20, obj] } } })
    expect(picker(wrapper, 20).props.pageSizes).toEqual([20, obj])
    wrapper.unmount()
  })

  it('[D3 #1] 宿主单表 pagination.showSizePicker: false → simple 下也不画每页选择器', () => {
    const wrapper = mount(SmartTable, { props: { ...base, data: rows, pagination: { showSizePicker: false } } })
    expect(pagerProps(wrapper).suffix).toBeUndefined()
    wrapper.unmount()
  })

  it('全局 showSizePicker: false → 不画每页选择器;宿主自带 suffix 时库不覆盖', () => {
    const w1 = mount(SmartTable, {
      props: { ...base, data: rows },
      global: { provide: { [SMART_TABLE_DEFAULTS as symbol]: { showSizePicker: false } } },
    })
    expect(pagerProps(w1).suffix).toBeUndefined()
    w1.unmount()
    const mine = () => 'mine'
    const w2 = mount(SmartTable, { props: { ...base, data: rows, pagination: { suffix: mine } } })
    expect(pagerProps(w2).suffix).toBe(mine)
    w2.unmount()
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

  it('[D3 #6] simple: false 回退时当前 pageSize 不在 pageSizes 里 → 官方选择器的选项也并入当前值', () => {
    const wrapper = mount(SmartTable, { props: { ...base, data: rows, pagination: { simple: false, pageSize: 15 } } })
    expect(pagerProps(wrapper).pageSizes).toEqual([15, 100, 500, 1000])
    wrapper.unmount()
  })

  it('远程模式:首次请求 pageSize = 100;内层选择器改 500 → 回第 1 页按 500 重查', async () => {
    const fetcher = vi.fn(async (_p: Record<string, unknown>) => ({ items: rows, total: 2 }))
    const wrapper = mount(SmartTable, { props: { ...base, fetcher } })
    await flushPromises()
    expect(fetcher.mock.calls[0][0]).toMatchObject({ page: 1, pageSize: 100 })
    picker(wrapper).props.onUpdatePageSize(500)
    await flushPromises()
    expect(fetcher.mock.calls.at(-1)![0]).toMatchObject({ page: 1, pageSize: 500 })
    wrapper.unmount()
  })

  it('[D3 #5] 远程模式宿主传 pagination.pageSize: 10:首个请求就是 10(分页条与请求一致)', async () => {
    const fetcher = vi.fn(async (_p: Record<string, unknown>) => ({ items: rows, total: 2 }))
    const wrapper = mount(SmartTable, { props: { ...base, fetcher, pagination: { pageSize: 10 } } })
    await flushPromises()
    expect(fetcher.mock.calls[0][0]).toMatchObject({ page: 1, pageSize: 10 })
    expect(pagerProps(wrapper).pageSize).toBe(10)
    wrapper.unmount()
  })

  it('[D3 #3] 本地模式:内层选择器改 500 → 表格 pageSize 变 500、回第 1 页,并转发宿主的 onUpdatePageSize', async () => {
    const onSize = vi.fn()
    const wrapper = mount(SmartTable, { props: { ...base, data: many, pagination: { onUpdatePageSize: onSize } } })
    picker(wrapper).props.onUpdatePageSize(500)
    await nextTick()
    expect(pagerProps(wrapper).pageSize).toBe(500)
    expect(onSize).toHaveBeenCalledWith(500)
    wrapper.unmount()
  })

  it('[D3 #4] 本地模式宿主 pagination.defaultPageSize: 20:50 行只显示 20 行(不被受控 pageSize 盖成 100)', async () => {
    const wrapper = mount(SmartTable, { props: { ...base, data: many, pagination: { defaultPageSize: 20 } } })
    await nextTick()
    expect(pagerProps(wrapper).pageSize).toBe(20)
    expect(wrapper.findAll('tbody tr')).toHaveLength(20)
    wrapper.unmount()
  })

  it('[D4] 回退「一行」:宿主只写 pagination.pageSizes [10,20,50](没写 defaultPageSize)→ 首个请求 10', async () => {
    const fetcher = vi.fn(async (_p: Record<string, unknown>) => ({ items: rows, total: 2 }))
    const wrapper = mount(SmartTable, { props: { ...base, fetcher, pagination: { pageSizes: [10, 20, 50] } } })
    await flushPromises()
    expect(fetcher.mock.calls[0][0]).toMatchObject({ pageSize: 10 })
    wrapper.unmount()
  })

  it('[D4] 全局 pageSizes [10,20,50] 同样;全局 defaultPageSize: 30 压过 pageSizes[0];实例 default-page-size 最高', async () => {
    const first = async (defaults: Record<string, unknown>, props: Record<string, unknown> = {}) => {
      const fetcher = vi.fn(async (_p: Record<string, unknown>) => ({ items: rows, total: 2 }))
      const w = mount(SmartTable, {
        props: { ...base, fetcher, ...props },
        global: { provide: { [SMART_TABLE_DEFAULTS as symbol]: defaults } },
      })
      await flushPromises()
      w.unmount()
      return (fetcher.mock.calls[0][0] as Record<string, unknown>).pageSize
    }
    expect(await first({ pageSizes: [10, 20, 50] })).toBe(10)
    expect(await first({ pageSizes: [10, 20, 50], defaultPageSize: 30 })).toBe(30)
    expect(await first({ pageSizes: [10, 20, 50], defaultPageSize: 30 }, { defaultPageSize: 20 })).toBe(20)
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
    const filterCols = [{ key: 'name', title: 'Name', filter: true }] as SmartTableColumn<unknown>[]
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

- [ ] **Step 2: 跑,确认失败**

Run: `npx vitest run tests/pageSize.test.ts tests/config.test.ts tests/SmartTable.test.ts`
Expected(实测):`Test Files  3 failed (3)`、`Tests  14 failed | 48 passed (62)`。失败的是:`pageSize.test.ts` 整个文件(`Failed to resolve import "../src/pageSize"`,文件还不存在,所以不计入用例数)、`config.test.ts` 3 条(默认值还是 `[10,20,50]` / 没有 `pageSizesGiven`)、`SmartTable.test.ts` 的新 describe 11 条(每页默认 10、没有内层选择器……)。`static 模式默认每页 100` 等断言读到的是旧值。

- [ ] **Step 3: 实现 —— 纯函数与默认值**

Create `src/pageSize.ts`:
```ts
// 每页条数相关的纯函数(UI 无关、可单测)。
import type { PaginationProps } from 'naive-ui'

/** 官方 pageSizes 的元素类型:数字,或 { label, value } 对象(从公开的 PaginationProps 推导,不自己写一份)。 */
export type PageSizeOption = NonNullable<PaginationProps['pageSizes']>[number]

export function pageSizeValue(s: PageSizeOption): number {
  return typeof s === 'number' ? s : Number(s.value)
}

/**
 * 并入当前值:官方每页选择器在当前 pageSize 不在选项里时显示裸值(如「15」,没有「/ 页」后缀、也不标记选中)。
 * 已在里面 → 原样(拷贝);不在 → 加一个数字项并按值升序。对象项保持 { label, value }。
 */
export function mergePageSizes(list: readonly PageSizeOption[], current: number): PageSizeOption[] {
  if (list.some((s) => pageSizeValue(s) === current)) return [...list]
  return [...list, current].sort((a, b) => pageSizeValue(a) - pageSizeValue(b))
}

export interface DefaultPageSizeInput {
  /** `<SmartTable default-page-size>`。 */
  prop?: number
  /** 宿主的 `pagination.pageSize` / `pagination.defaultPageSize` / `pagination.pageSizes`。 */
  pageSize?: number
  defaultPageSize?: number
  pageSizes?: readonly PageSizeOption[]
  /** 全局默认里**显式给了**的 `defaultPageSize` / `pageSizes`(没给就不要传)。 */
  globalDefaultPageSize?: number
  globalPageSizes?: readonly number[]
}

const first = (list?: readonly PageSizeOption[]) => (list && list.length ? pageSizeValue(list[0]) : undefined)

/**
 * 初始每页条数的解析优先级(D4):实例 prop > 实例 pagination.pageSize > 实例 pagination.defaultPageSize
 * > 全局 defaultPageSize > 宿主(实例、其次全局)显式给的 pageSizes[0] > 库默认 100。
 * 这样宿主只写 `pageSizes: [10, 20, 50]` 也能让首个请求的 pageSize 变成 10(B1 的回退真的是一行)。
 */
export function resolveDefaultPageSize(i: DefaultPageSizeInput, builtin = 100): number {
  return (
    i.prop ??
    i.pageSize ??
    i.defaultPageSize ??
    i.globalDefaultPageSize ??
    first(i.pageSizes) ??
    first(i.globalPageSizes) ??
    builtin
  )
}
```
`src/config.ts`:
1. `SmartTableDefaults` 里 `pageSizes?: number[]` 的注释 `内置兜底 [10,20,50]` 改成 `内置兜底 [100,500,1000]`,并在它之前加:
```ts
  /** 默认每页条数;缺省时取宿主显式给的 pageSizes[0],再缺省取 100。优先级见 pageSize.ts 的 resolveDefaultPageSize。 */
  defaultPageSize?: number
```
2. `ResolvedSmartTableDefaults` 里 `pageSizes: number[]` 之后加 `defaultPageSize?: number` 与 `/** 宿主是否显式注入了 pageSizes(决定要不要拿 pageSizes[0] 当默认每页条数)。 */ pageSizesGiven: boolean`。
3. `BUILTIN_DEFAULTS`:`pageSizes: [10, 20, 50]` 改成 `[100, 500, 1000]`,并加 `pageSizesGiven: false,`。
4. `resolveDefaults` 里 `for` 循环之后、`out.tag = …` 之前加:
```ts
  out.pageSizesGiven = injected.pageSizes !== undefined
```
`src/types.ts`:`SmartTableProps` 里 `defaultPageSize?: number // 默认 10` 改成 `defaultPageSize?: number // 默认取宿主给的 pageSizes[0],再缺省 100(解析优先级见 pageSize.ts)`(仅 `SmartTableProps` 里那一处;`UseSmartTableOptions` 里的 `// 默认 10` 不动);`pagination?: false | Partial<PaginationProps>` 上方注释补一句:`3.0 起默认官方 simple(输入框 / 总页数),每页条数选择器由库用官方嵌套 NPagination 画;传 { simple: false } 回到页码序列。`

- [ ] **Step 4: 实现 —— `SmartTable.vue`**

1. `import { NCard, NDataTable } from 'naive-ui'` 改为 `import { NCard, NDataTable, NPagination } from 'naive-ui'`;`import { applyFilters } from './filter'` 之后加 `import { mergePageSizes, resolveDefaultPageSize } from './pageSize'`。
2. props 里 `defaultPageSize: { type: Number, default: 10 }` 改为 `defaultPageSize: { type: Number, default: undefined }`(不写默认值,才能区分「宿主没给」)。
3. 在 `const isRemote = computed(…)` 之后加(**必须在 `useSmartTable(...)` 调用之前**):
```ts
// 初始每页条数(D4):首次 setup 时解析一次。远程模式它就是首个请求的 pageSize(也解决了 pagination.pageSize 与首个请求不一致);
// 本地模式它是 localPageSize 的初值(解决 pagination.defaultPageSize 被受控 pageSize 盖掉)。
const userPagination = typeof props.pagination === 'object' ? props.pagination : undefined
const initialPageSize = resolveDefaultPageSize({
  prop: props.defaultPageSize,
  pageSize: userPagination?.pageSize,
  defaultPageSize: userPagination?.defaultPageSize,
  pageSizes: userPagination?.pageSizes,
  globalDefaultPageSize: defaults.defaultPageSize,
  globalPageSizes: defaults.pageSizesGiven ? defaults.pageSizes : undefined,
})
```
   并把 `useSmartTable` 选项里的 `defaultPageSize: props.defaultPageSize,` 改成 `defaultPageSize: initialPageSize,`。
4. 在 `const localPage = ref(1)` 之后加:
```ts
// 本地模式的每页条数:官方 simple 分页自己没有选择器,库用嵌套的官方 NPagination 画的选择器要能改它,所以用受控的 pageSize
const localPageSize = ref(initialPageSize)
```
5. 在 `const hostWidth = ref(0)` 之后加:
```ts
/** 库根节点宽度(ResizeObserver 维护)。< 600 视为窄档:分页不画每页选择器(卡片内宽 ≤ 340 时它会折行)。0 = 还没量到,按非窄档处理。 */
const rootWidth = ref(0)
const narrowPager = computed(() => rootWidth.value > 0 && rootWidth.value < 600)
```
6. `measureHost()` 函数开头加一行:`rootWidth.value = rootRef.value?.clientWidth ?? 0`;`onMounted` 里 `measureHost()` 之前加:
```ts
  if (resizeObserver && rootRef.value) resizeObserver.observe(rootRef.value)
```
7. 把整个 `mergedPagination` 替换为(原 `paginationPrefix` 保留;**不再有手写的 `pageSizePicker`**):
```ts
/** 官方回调可能是函数也可能是数组(Naive 允许 MaybeArray),逐个调用。 */
function callAll(handler: unknown, ...args: unknown[]) {
  for (const fn of Array.isArray(handler) ? handler : [handler]) if (typeof fn === 'function') fn(...args)
}

const mergedPagination = computed<false | PaginationProps>(() => {
  if (props.pagination === false) return false
  const user = props.pagination ?? {}
  // 3.0 起默认官方 simple;传 { simple: false } 回到页码序列(此时走官方 showSizePicker / pageSizes)
  const simple = user.simple ?? true
  const showSizePicker = user.showSizePicker ?? defaults.showSizePicker // D3 #1:单表的 false 也要认
  const current = user.pageSize ?? (isRemote.value ? pagination.pageSize : localPageSize.value)
  // D3 #2 / #6:保留 { label, value } 对象;并入当前值(官方在当前值不在选项里时显示裸值)
  const sizes = mergePageSizes(user.pageSizes ?? defaults.pageSizes, current)

  // 改每页条数的处理函数:外层分页(非 simple 时)与内层嵌套选择器共用同一个
  const onSize = isRemote.value
    ? // 远程:与 2.1.1 一致 —— 宿主给了自己的处理函数就由宿主接管,否则走 useSmartTable(回第 1 页重查)
      (n: number) => callAll(user.onUpdatePageSize ?? table.onPageSize, n)
    : (n: number) => {
        localPageSize.value = n
        // 改每页条数回第 1 页(与远程一致)。官方外层本地分页只会静默夹页、不发 onUpdatePage,
        // 所以库里记页码的 localPage 要自己置 1,并同步表格的页码
        localPage.value = 1
        tableRef.value?.page(1)
        callAll(user.onUpdatePageSize, n) // D3 #3:转发宿主的回调
      }

  const base: Partial<PaginationProps> = { simple, prefix: paginationPrefix.value }
  // simple 下官方不渲染每页选择器(Pagination.mjs:665):在官方 suffix 里嵌一个只渲染 size-picker 的官方 NPagination(E2)。
  // 窄档(会折行)、宿主自带 suffix、关了选择器时都不画。不传 onUpdatePage:受控下内层夹页永远不会触发。
  if (simple && showSizePicker && !narrowPager.value && !user.suffix) {
    base.suffix = (info) =>
      h(NPagination, {
        displayOrder: ['size-picker'],
        showSizePicker: true,
        pageSizes: sizes,
        pageSize: info.pageSize,
        itemCount: info.itemCount,
        page: info.page,
        onUpdatePageSize: onSize,
      })
  }
  // 非 simple 回退:走官方 showSizePicker / pageSizes。pageSizes 放在 ...user 之后,免得宿主原值盖掉并入了当前值的版本(D3 #6)
  const tail: Partial<PaginationProps> = simple ? {} : { showSizePicker, pageSizes: sizes }

  if (isRemote.value) {
    return {
      ...base,
      page: pagination.page,
      pageSize: pagination.pageSize,
      itemCount: pagination.itemCount,
      onUpdatePage: table.onPage,
      onUpdatePageSize: table.onPageSize,
      ...user,
      ...tail,
    }
  }
  return {
    ...base,
    pageSize: localPageSize.value,
    defaultPage: localPage.value,
    ...user,
    ...tail,
    onUpdatePage: (p: number) => {
      localPage.value = p
      callAll(user.onUpdatePage, p)
    },
    onUpdatePageSize: onSize,
  }
})
```
8. B9:把 `useFilters` 的 `onChange` 整个替换为:
```ts
  onChange: (key, value, state) => {
    // 筛选后的分页行为:宿主显式传了官方 paginationBehaviorOnFilter 就照官方;没传保持库现状
    // (远程回第 1 页;本地不动,页码由 Naive 夹回合法范围)。这是对官方默认值 'current' 的有意偏离,只发生在 remote。
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
1. 「[B1] 内置兜底」用例里 `expect(BUILTIN_DEFAULTS.pageSizes).toEqual([10, 20, 50])` 改为 `[100, 500, 1000]`(标题同步成 `'[B1 已翻转] 内置兜底:每页 [100,500,1000];[B2 已翻转] 密度 compact'`)。
2. 整个 `describe('2.1.1 特征:分页')` 改为:
```ts
describe('3.0 分页(B1 / B4 已翻转)', () => {
  it('静态模式:默认每页 100、simple、带每页选择器(suffix)', () => {
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
Expected: `Test Files  15 passed (15)`、`Tests  230 passed (230)`(203 + 27:`pageSize.test.ts` 9、`config.test.ts` +2、`SmartTable.test.ts` +16);typecheck 无输出。**若「窄档」用例失败**:确认 `measureHost()` 里确实读了 `rootRef.value?.clientWidth`、`onMounted` 里确实 `observe(rootRef.value)`;jsdom 里 `clientWidth` 默认 0,用例靠 `Object.defineProperty` 覆盖。**若 typecheck 报 `h(NPagination, …)` 的 `displayOrder` 类型不符**:核对 `node_modules/naive-ui/es/pagination/src/Pagination.d.ts` 里 `displayOrder` 是 `Array<'pages' | 'size-picker' | 'quick-jumper'>`(2.45.3 已核)。

- [ ] **Step 7: playground 加一个宿主自定义 `pageSizes` 的示例(正式提交,供浏览器验证用)**

`playground/DemoFilter.vue`:`<SmartTable` 的属性里、`storage-key="demo-filter"` 之前加一行(静态 data 的示例改成「宿主只写 `pageSizes`」:首个 `pageSize` 取 `pageSizes[0]` = 20,并演示 `{ label, value }` 选项):
```vue
      :pagination="{ pageSizes: [20, 50, { label: '每页 100 条', value: 100 }] }"
```
Run: `npm run typecheck`
Expected: 无输出。

- [ ] **Step 8: 浏览器验证(D13:分页的真实渲染、选择器、翻页只能在浏览器里看)**

Run: `node_modules/.bin/vite --port 5173`(仓库根),打开 playground。**「基础」示例**(远程、默认 `pageSizes`)在控制台读:
```js
const r = (e) => e.getBoundingClientRect()
const root = document.querySelector('.smart-table')
const outer = root.querySelector('.n-pagination--simple')
const inner = outer.querySelector('.n-pagination')
const sel = inner.querySelector('.n-base-selection')
;({
  高度: [r(outer).height, r(inner).height, r(sel).height], // 期望全是 28
  同一行: Math.abs((r(inner).top + r(inner).height / 2) - (r(outer).top + r(outer).height / 2)) < 2, // 期望 true
  选择器文字: sel.textContent, // 中文 '100 / 页';右上角切「EN」后 '100 / page'
  行数: root.querySelectorAll('tbody tr').length, // 期望 100
})
```
逐项确认并记录:
1. 上面四个读数成立(高度 28 / 同一行 / 文字 / 100 行);暗色下选择器与外层同主题(右上角开「暗色」,截图或读背景色)。
2. 点选择器 → 选项是「100 / 页、500 / 页、1000 / 页」;选「500 / 页」:行数变 500、页码回第 1 页、选择器显示「500 / 页」。
3. 在页码输入框输入 3 回车,首行序号 = 201;再把每页改成 1000:页码夹回第 1 页(不会停在一个不存在的页)。
4. **窄档**:把浏览器窗口(或 DevTools 设备模拟)宽度设成 500:分页条里**没有**每页选择器(`root.querySelectorAll('.n-pagination--simple .n-pagination').length === 0`),只剩「共 N 条」与页码输入,**不折行**(`r(outer).height` 仍是 28)。恢复宽度后选择器回来。
5. **「过滤 / 列宽」示例**(静态 200 行,宿主 `pagination.pageSizes: [20, 50, { label: '每页 100 条', value: 100 }]`):默认每页 **20 行**(`root.querySelectorAll('tbody tr').length === 20`,D4:首个 `pageSize` 取 `pageSizes[0]`);选择器显示「20 / 页」,展开后有「每页 100 条」这一项(对象选项保留 label);选它后行数 100。
记录没有成立的项,**不要**假装通过。结束后关掉 vite。

- [ ] **Step 9: 提交**

```bash
git add src/pageSize.ts src/config.ts src/types.ts src/SmartTable.vue playground/DemoFilter.vue tests/pageSize.test.ts tests/config.test.ts tests/baseline-2.1.1.test.ts tests/SmartTable.test.ts
git commit -m "feat!: 默认每页 100 条、分页默认官方 simple 并用官方嵌套 NPagination 画每页选择器、defaultPageSize 解析、筛选后分页可由官方 paginationBehaviorOnFilter 控制(B1/B4/B9)" -m "有意的默认行为变更:回退 → defaultPageSize / pageSizes / pagination: { simple: false }。⚠ 远程模式请求的 pageSize 由 10 变 100,后端若限制 pageSize 上限会拒绝。tests/config.test.ts 里 pageSizes 的断言有意翻转为 [100, 500, 1000](P-1)。顺带修 6 处分页回归(D3)。" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: 卡片内边距 —— 四边统一 16px(B11)+ 回退入口 `cardProps`(D10)

> 规格 §1 B11、§4。官方做法(已核 `card/styles/_common.mjs`、`Card.mjs`):`size="small"` + 卡片自己的 `theme-overrides: { paddingSmall: '16px 16px 16px' }`(`getPadding` 拆成 `--n-padding-top / left / bottom`),**只作用于库里这两张卡片**(`SmartTable.vue` 的表格卡片、`SearchForm.vue` 模式 1 的搜索卡片),不动宿主的全局主题。
>
> **旧值更正(D10)**:无 header 的卡片,内容区 `padding-top` 取的是 `--n-padding-bottom`(`card/src/styles/index.cssr.mjs` 里 `.n-card > .n-card-content:first-child { padding-top: var(--n-padding-bottom) }`,本地 2.45.3 在第 79–80 行:第 79 行 `cB("card-content", [c("&:first-child", …`,第 80 行 `padding-top: var(--n-padding-bottom);`)。所以 2.1.1 表格卡片的实际内边距是 **上 20 / 左右 24 / 下 20**(`paddingMedium: '19px 24px 20px'` 里的 19 只在有 header 时才用),**不是** 19 / 24 / 20;2.1.1 的库里也**没有**窄档 12 / 16(那是原型样式)。CHANGELOG 与规格都按 20 / 24 / 20 写。
>
> **回退入口(D10)**:`SmartTable.vue` 是 `inheritAttrs: false`,所有 attrs 都转给 `n-data-table`,库渲染的 `n-card` 没有任何透传,「给卡片传官方 `size` / 主题覆盖」原本**无处可传**。所以新增 `cardProps?: Partial<CardProps>`(A 级新增):合并在库默认 `size="small"` + `themeOverrides` **之后**,作用于库渲染的**所有**卡片(表格卡片,以及模式 1 `grid` 布局的搜索卡片 —— `SearchForm.vue` 的卡片配置就来自 `SmartTable` 传下去的这个 prop;`inline` 布局本来就没有卡片)。`themeOverrides` 逐键合并(宿主只想改圆角时不会把库的 `paddingSmall` 覆盖冲掉)。**回退 2.1.1 外观:`cardProps: { size: 'medium' }`**(`size` 换成 medium 后 `paddingSmall` 覆盖不再生效,回到官方 medium 的 20 / 24 / 20)。
>
> 规格 §4 / 设计 5.4 里 `theme-overrides: { Card: { paddingSmall } }` 是**全局 provider** 的形状;**组件级**是扁平的 `{ paddingSmall }`(`_mixins/use-theme.d.ts:23-25`、`card/src/Card.d.ts:90`),本 Task 用的是组件级。

**Files:**
- Create: `src/cardStyle.ts`
- Modify: `src/SmartTable.vue`、`src/SearchForm.vue`、`src/types.ts`(`SmartTableProps.cardProps`)
- Test: `tests/SmartTable.test.ts`(追加)

**Interfaces:**
- Produces: `cardStyle.ts`:`CARD_THEME_OVERRIDES: { paddingSmall: string }`(值 `'16px 16px 16px'`);`mergeCardProps(user?: Partial<CardProps>): Partial<CardProps>`;`SmartTable` 新 prop `cardProps?: Partial<CardProps>`;`SearchForm` 新 prop `cardProps`(`SmartTable` 传下去)。

- [ ] **Step 1: 写失败测试**

在 `tests/SmartTable.test.ts` 末尾追加(顶部 import 补 `NCard`:`import { NCard, NDataTable, NPagination } from 'naive-ui'`):
```ts
describe('SmartTable 卡片内边距(B11)与 cardProps(D10)', () => {
  const cols = [{ key: 'name', title: 'Name', search: true }] as SmartTableColumn<unknown>[]
  const mountCards = (extra: Record<string, unknown> = {}) =>
    mount(SmartTable, { props: { columns: cols, data: rows, rowKey: 'id', ...extra } })
  const cards = (w: ReturnType<typeof mount>) => w.findAllComponents(NCard)

  it('表格卡片用官方 size="small" + 只作用于它自己的 paddingSmall 覆盖(四边 16px)', () => {
    const wrapper = mountCards({ search: false })
    const card = wrapper.findComponent(NCard)
    expect(card.props('size')).toBe('small')
    expect(card.props('themeOverrides')).toEqual({ paddingSmall: '16px 16px 16px' })
    wrapper.unmount()
  })

  it('模式 1 的搜索卡片同样是 small + 16px(两张卡片一致)', () => {
    const wrapper = mountCards()
    expect(cards(wrapper)).toHaveLength(2)
    for (const c of cards(wrapper)) {
      expect(c.props('size')).toBe('small')
      expect(c.props('themeOverrides')).toEqual({ paddingSmall: '16px 16px 16px' })
    }
    wrapper.unmount()
  })

  it('cardProps 回退旧外观:{ size: "medium" } 同时作用于表格卡片与搜索卡片', () => {
    const wrapper = mountCards({ cardProps: { size: 'medium' } })
    expect(cards(wrapper).map((c) => c.props('size'))).toEqual(['medium', 'medium'])
    wrapper.unmount()
  })

  it('cardProps.themeOverrides 逐键合并:宿主只改圆角,库的 paddingSmall 覆盖仍在', () => {
    const wrapper = mountCards({ cardProps: { themeOverrides: { borderRadius: '2px' } } })
    for (const c of cards(wrapper)) {
      expect(c.props('themeOverrides')).toEqual({ paddingSmall: '16px 16px 16px', borderRadius: '2px' })
    }
    wrapper.unmount()
  })

  it('cardProps 里的其它官方属性(如 bordered)也能透传', () => {
    const wrapper = mountCards({ cardProps: { bordered: false } })
    expect(cards(wrapper).map((c) => c.props('bordered'))).toEqual([false, false])
    wrapper.unmount()
  })

  it('inline 布局的搜索区没有卡片:只剩表格卡片', () => {
    const wrapper = mountCards({ search: { layout: 'inline' } })
    expect(cards(wrapper)).toHaveLength(1)
    wrapper.unmount()
  })
})
```

- [ ] **Step 2: 跑,确认失败**

Run: `npx vitest run tests/SmartTable.test.ts -t "卡片内边距"`
Expected: `5 failed | 1 passed`(实测)—— 表格卡片 / 搜索卡片的 `size` 都是 `undefined`(`expected undefined to be 'small'`),`cardProps` 的 3 条同因(卡片根本没接 `cardProps`);「inline 布局没有搜索卡片」那条本来就是绿的。

- [ ] **Step 3: 实现**

Create `src/cardStyle.ts`:
```ts
import type { CardProps } from 'naive-ui'

/**
 * 库里两张卡片(搜索卡片、表格卡片)的内边距:四边 16px(B11)。
 * 2.1.1 是官方 medium:无 header 的卡片内容区实际是 上 20 / 左右 24 / 下 20
 * (paddingMedium 的 19 只在有 header 时用;内容区 padding-top 取的是 --n-padding-bottom);small 是 12px 16px 12px。
 * 做法:size="small" + 只作用于这张卡片的 paddingSmall 覆盖(getPadding 拆成 top / left / bottom),
 * 不动宿主的全局主题。回退旧外观:SmartTable 的 cardProps={{ size: 'medium' }}。
 */
export const CARD_THEME_OVERRIDES: NonNullable<CardProps['themeOverrides']> = {
  paddingSmall: '16px 16px 16px',
}

/** 库默认(size small + 16px 覆盖)之上合并宿主的 cardProps;themeOverrides 逐键合并,不整个替换。 */
export function mergeCardProps(user?: Partial<CardProps>): Partial<CardProps> {
  return { size: 'small', ...user, themeOverrides: { ...CARD_THEME_OVERRIDES, ...user?.themeOverrides } }
}
```
`src/types.ts`:顶部 naive-ui 的 type import 里加 `CardProps`(与 `DataTableBaseColumn` 等同一行);`SmartTableProps` 里 `title?: string` 之后加:
```ts
  /** 库渲染的所有卡片(表格卡片、模式 1 的搜索卡片)的官方 NCard 属性,合并在库默认 size="small" + 16px 内边距覆盖之后。回退 2.1.1 外观:{ size: 'medium' }。 */
  cardProps?: Partial<CardProps>
```
`src/SmartTable.vue`:
1. `import` 区加 `import { mergeCardProps } from './cardStyle'`;`import type { CardProps, DataTableInst, … } from 'naive-ui'`(把 `CardProps` 并进已有的 `import type {…} from 'naive-ui'`)。
2. props 里 `title: {…}` 之后加:
```ts
  cardProps: { type: Object as PropType<Partial<CardProps>>, default: undefined },
```
3. 在 `const isRemote = computed(…)` 之后加:
```ts
const mergedCardProps = computed(() => mergeCardProps(props.cardProps))
```
4. 模板里 `<n-card :bordered="true" class="smart-table-card">` 改为(`v-bind` 放在显式属性**之后**,宿主的 `cardProps` 才能盖过库默认):
```vue
    <n-card :bordered="true" class="smart-table-card" v-bind="mergedCardProps">
```
5. `<SearchForm …>` 上加 `:card-props="mergedCardProps"`。

`src/SearchForm.vue`:`props` 里加 `cardProps: { type: Object as PropType<Partial<CardProps>>, default: () => ({}) },`(`import type { CardProps } from 'naive-ui'`);模板里 `<n-card v-else :bordered="true" class="smart-table-search">` 改为:
```vue
  <n-card v-else :bordered="true" class="smart-table-search" v-bind="cardProps">
```
(`SearchForm` 收到的已经是 `SmartTable` 合并好的完整 props,自己不再合并。)

- [ ] **Step 4: 跑,确认通过**

Run: `npm test && npm run typecheck`
Expected: `Test Files  15 passed (15)`、`Tests  236 passed (236)`(230 + 6);typecheck 无输出。**若 typecheck 报 `CardProps` 未导出**:核对 `node_modules/naive-ui/es/card/index.d.ts`(2.45.3 已核:`export { type CardProps, … }`);不要用 `any` 绕过。

- [ ] **Step 5: 浏览器里量一次(规格写了实测值,落地后必须复现)**

Run: `node_modules/.bin/vite --port 5173`(仓库根,用 `index.html` + `playground/`),打开 playground 的「基础」示例,在浏览器控制台执行:
```js
const card = document.querySelector('.smart-table-card')
const r = (e) => e.getBoundingClientRect()
const c = r(card), kids = [...card.children[0].children].filter(e => r(e).height > 0) // card.children[0] = .n-card-content(内边距就在它里面),量它的子元素才是内边距
;({ top: r(kids[0]).top - c.top, bottom: c.bottom - r(kids.at(-1)).bottom,
    left: Math.min(...kids.map(e => r(e).left)) - c.left, right: c.right - Math.max(...kids.map(e => r(e).right)) })
```
Expected: 四个值**都是 17**(16px 内边距 + 1px 描边)。若不是,记录实测值并停下来看 `n-card` 的 `--n-padding-*`。
**回退检查(临时改动,验证完 `git checkout playground`)**:给「基础」的 `<SmartTable>` 加 `:card-props="{ size: 'medium' }"`,再量一次,Expected:`top 21 / left 25 / right 25 / bottom 21`(2.1.1 的 20 / 24 / 20 + 1px 描边)。结束后关掉 vite。

- [ ] **Step 6: 提交**

```bash
git add src/cardStyle.ts src/SmartTable.vue src/SearchForm.vue src/types.ts tests/SmartTable.test.ts
git commit -m "feat!: 表格卡片与搜索卡片内边距统一为四边 16px(B11);新增 cardProps 作回退入口" -m "有意的默认外观变更:2.1.1 的 20/24/20 → 四边 16px;回退 → cardProps: { size: 'medium' }。" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: 表头图标 —— 悬停才显示、触屏兜底、漏斗可键盘聚焦、条数角标(B6 / A)

> 规格 §1 B6、§3、§5.3、§5.7。
> - 未激活的排序箭头、漏斗**平时 `opacity: 0`(仍占位,不回流)**,悬停该列表头或 `:focus-within` 时淡入(0.15s);**常驻例外**:正在排序的列箭头、已筛选的列漏斗、面板打开的那一列漏斗。
> - 触屏兜底(Q-4):`@media (hover: none)` 下未激活的图标 `opacity: .5` 常驻(仍低于激活态的主色);**写法以设计原型 `docs/smart-naive-table-design.html` 为准,只写 `(hover: none)`(F16)**:曾加过 `(any-pointer: coarse)` 给「带触屏的 Windows 笔记本」兜底,但这类机器 `any-pointer: coarse` 为 true,用鼠标时图标也常显 0.5,与原型(鼠标移上去才显示、平时看不见)不一致,用户明确要求与原型一致,所以去掉。**24px 拖拽热区不在 P0**:`width:24px; right:-12px` 与现有 `::after` 竖条错位、伸进下一列的一半会被后一个 `th` 盖住,归 P1(与把手视觉、B12 后半一起做)。
> - **现状问题(已读源码)**:`ColumnFilter.vue` 里漏斗 `NButton` 写了 `:focusable="false"`,键盘根本 Tab 不到漏斗——规格里「漏斗可 Tab 聚焦」在库里**现在并不成立**,本任务要去掉它。(官方排序表头本来就没有键盘操作,`th` 无 `tabindex`,设计文档 9.1;本期不解决。)
> - 同列有效条件 > 1 条时漏斗旁加条数角标;漏斗 `aria-label` 含「已筛选 N 条」,走 labels,渲染期求值。
> - 官方类名(已在真实 `NDataTable` 上验证,设计文档 9.1):`.n-data-table-th .n-data-table-sorter`、`.n-data-table-th--sorting`。
> - **点漏斗不触发排序(Q-6)**:官方有现成的跳过标记 —— `TableParts/Header.mjs:107-108` 的 `happensIn(e, 'dataTableFilter')`(沿 `target` 向上找带 `data-data-table-filter` 的元素),漏斗触发器加这个属性即可(官方优先)。**去掉**原来的 `@click.stop`:它会吞掉宿主挂在 `th` / 祖先上的 click 监听。
> - **图标间距(Q-5)**:标题 → 漏斗 8px、漏斗 → 排序箭头 6px、表头右内边距 16px,纯 CSS,**放进本 Task**(Task 12 的 B12 下限 93 / 102 / 123 就是按这个布局算的;2.1.1 现状是漏斗 `margin-left: 4px`、`.smart-table-th` 的 `gap: 2px`、官方排序箭头 `margin-left: 4px`)。把手高度 70%、热区 11px、拖动引导线、松手 150ms 吞 click、拖动开始收起气泡**不在本 Task**,归 P1 视觉任务(规格 §5.6 / §5.7)。
> - **角标文字色(Q-2)**:不能写死 `#fff`(暗色下叠在主色 `#63e2b7` 上对比度约 1.4:1),用 `useThemeVars().baseColor`(亮 `#FFF` / 暗 `#000`)经 `:style` 绑定。
> - **过渡写法(Q-3)**:排序箭头官方自带 `transition: color .3s var(--n-bezier)`,我们的 `transition: opacity .15s` 会整条覆盖它,所以写成 `transition: opacity .15s, color .3s var(--n-bezier)`。

**Files:**
- Modify: `src/types.ts`、`src/labels.ts`(`filterActiveCount`、`fmt`)、`src/ColumnFilter.vue`、`src/SmartTable.vue`(样式)、`playground/DemoBasic.vue` 与 `playground/mock.ts`(Q-13:给浏览器验证补前置条件)
- Test: `tests/ColumnFilter.test.ts`(追加)、`tests/SmartTable.test.ts`(追加)

**Interfaces:**
- Consumes: Task 2 的 `activeConditions`。
- Produces: `SmartTableLabels.filterActiveCount?: string`(可选,含 `{n}` 占位;`defaultLabels` 补 `'filtered by {n}'`、`zhCNLabels` 补 `'已筛选 {n} 条'`);`labels.ts` 里 `fmt(tpl: string, vars: Record<string, string | number>): string`;漏斗触发器的 CSS 类 `smart-table-filter-trigger--active` / `--open`、属性 `data-data-table-filter`、角标类 `smart-table-filter-badge`。

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
} as unknown as Required<SmartTableLabels>
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

再追加一个 describe(Q-2:角标文字色不能写死 `#fff` —— 暗色下叠在主色 `#63e2b7` 上对比度约 1.4:1;改用 `useThemeVars().baseColor`,亮色 `#FFF` / 暗色 `#000`)。顶部 import **新增一行** `import { NConfigProvider, darkTheme } from 'naive-ui'`(`ColumnFilter.test.ts` 原来没有 naive-ui 的 import,放在 `@vue/test-utils` 那行之后):
```ts
describe('ColumnFilter 条数角标的文字色(Q-2)', () => {
  function mountBadge(theme: typeof darkTheme | null) {
    const value = optionsToFilterValue([1, 2, 3])
    const Host = defineComponent({
      render: () =>
        h(NConfigProvider, { theme }, () =>
          h(ColumnFilter, { def: buildOptionsDef(), value, labels, getOptions: () => [], isLoadingOptions: () => false }),
        ),
    })
    return mount(Host, { attachTo: document.body })
  }

  it('文字色取主题的 baseColor:亮色白、暗色黑;源码里没有写死的颜色', () => {
    const light = mountBadge(null)
    expect(light.find('.smart-table-filter-badge').attributes('style')).toContain('rgb(255, 255, 255)')
    light.unmount()
    const dark = mountBadge(darkTheme)
    expect(dark.find('.smart-table-filter-badge').attributes('style')).toContain('rgb(0, 0, 0)')
    dark.unmount()
  })
})
```

在 `tests/SmartTable.test.ts` 末尾追加(Q-6:点漏斗不触发排序,靠官方 `TableParts/Header.mjs:107-108` 的 `happensIn(e, 'dataTableFilter')` 跳过标记 —— 漏斗触发器带 `data-data-table-filter` 属性;**不再用 `@click.stop`**,免得吞掉宿主挂在 `th` / 祖先上的 click 监听):
```ts
describe('SmartTable 点漏斗不触发排序(Q-6:官方 data-data-table-filter)', () => {
  async function mountSortFilter() {
    const fetcher = vi.fn(async (_p: Record<string, unknown>) => ({ items: rows, total: 2 }))
    const wrapper = mount(SmartTable, {
      props: {
        columns: [{ key: 'name', title: 'Name', sorter: true, filter: true }] as SmartTableColumn<unknown>[],
        fetcher,
        rowKey: 'id',
      },
      attachTo: document.body,
    })
    await flushPromises()
    return { fetcher, wrapper }
  }

  it('点漏斗:不排序、不重新请求;点标题:排序(对照)', async () => {
    const { fetcher, wrapper } = await mountSortFilter()
    const before = fetcher.mock.calls.length
    await wrapper.find('.smart-table-filter-trigger').trigger('click')
    await flushPromises()
    expect(fetcher.mock.calls.length).toBe(before)
    await wrapper.find('th').trigger('click')
    await flushPromises()
    expect(fetcher.mock.calls.length).toBe(before + 1)
    expect(fetcher.mock.calls.at(-1)![0]).toMatchObject({ sortField: 'name' })
    wrapper.unmount()
  })

  it('漏斗上的点击不被 stopPropagation 吞掉:宿主挂在祖先上的 click 监听仍能收到', async () => {
    const { wrapper } = await mountSortFilter()
    const spy = vi.fn()
    document.body.addEventListener('click', spy)
    await wrapper.find('.smart-table-filter-trigger').trigger('click')
    expect(spy).toHaveBeenCalled()
    document.body.removeEventListener('click', spy)
    wrapper.unmount()
  })
})
```

- [ ] **Step 2: 跑,确认失败**

Run: `npx vitest run tests/ColumnFilter.test.ts tests/SmartTable.test.ts`
Expected: `6 failed`(实测)—— `(0 , fmt) is not a function`;漏斗按钮 `tabindex` 仍是 `-1`(`expected '-1' not to be '-1'`);没有 `--active` 类;没有角标(`Cannot call text on an empty DOMWrapper`、`Cannot call attributes on an empty DOMWrapper`);漏斗上的 click 被 `@click.stop` 吞了(`expected "spy" to be called at least once`)。「点漏斗不排序」那条此刻是绿的(`@click.stop` 也能挡住排序)—— 它是给换成 `data-data-table-filter` 之后兜底的:换完若它变红,说明官方的跳过标记没接上。

- [ ] **Step 3: 实现 —— labels、`fmt`**

`src/types.ts`:`SmartTableLabels` 末尾(最后一个键之后)加一个**可选键**(D9):
```ts
  /** 漏斗 aria-label 的后缀,含 {n} 占位(有效条件数)。 */
  filterActiveCount?: string
```
`src/labels.ts`:`defaultLabels` 末尾加 `filterActiveCount: 'filtered by {n}',`;`zhCNLabels` 末尾加 `filterActiveCount: '已筛选 {n} 条',`;文件末尾加:
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
      <!-- data-data-table-filter:官方点表头时据此跳过排序(Header.mjs:107-108 的 happensIn(e, 'dataTableFilter'))。
           不用 @click.stop:它会吞掉宿主挂在 th / 祖先上的 click 监听(Q-6)。 -->
      <span
        class="smart-table-filter-trigger"
        :class="{ 'smart-table-filter-trigger--active': active, 'smart-table-filter-trigger--open': show }"
        data-data-table-filter
      >
        <n-tooltip trigger="hover" :disabled="show">
          <template #trigger>
            <n-button quaternary size="tiny" :type="active ? 'primary' : 'default'" :aria-label="ariaLabel">
              <template #icon><FilterIcon /></template>
            </n-button>
          </template>
          {{ labels.filter }}
        </n-tooltip>
        <!-- 文字色取主题的 baseColor(亮白 / 暗黑),不写死 #fff:暗色下叠在主色上对比度太低(Q-2) -->
        <span v-if="activeCount > 1" class="smart-table-filter-badge" :style="{ color: themeVars.baseColor }">{{
          activeCount
        }}</span>
      </span>
    </template>
```
(与旧版的区别:去掉了 `:focusable="false"` 与 `@click.stop`,加了 `data-data-table-filter`、两个状态类与角标。)
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
  /* 文字色在模板里经 :style 取 themeVars.baseColor(Q-2);背景取官方的激活图标色(角标在 th 的子树里,--n-* 变量可用) */
  background: var(--n-th-icon-color-active);
}
```

- [ ] **Step 5: 实现 —— 悬停显示、触屏兜底与图标间距的样式(`SmartTable.vue`)**

**先把优先级算清楚(P-4)**:`<style scoped>` 里的 `.smart-table :deep(X)` 编译后是 `.smart-table[data-v-xxx] X`,多一个属性选择器。隐藏规则 `.smart-table :deep(.n-data-table-th .smart-table-filter-trigger)` 因此是 **(0,4,0)**;「常驻例外」如果写成 `.smart-table :deep(.smart-table-filter-trigger--active)` 只有 **(0,3,0)**,**压不过**隐藏规则(Chromium 实测:已筛选 / 面板打开的漏斗仍是 `opacity: 0`)。所以例外规则一律带上 `.n-data-table-th` 前缀,与隐藏规则**同级**,并写在它们**之后**(同级按出现顺序,后者胜)。`@media` 里的规则同理:触屏淡显的 `0.5` 与它里面重申的常驻例外,也要按「同级、后写」排。

在 `<style scoped>` 里、`.smart-table :deep(.smart-table-th) {...}` 规则之后追加;并把那条规则里的 `gap: 2px` 改成 `gap: 0`(间距改由漏斗自己的 `margin-left` 给,见下):
```css
/* 表头图标「悬停才显示」(B6):未激活的排序箭头与漏斗平时透明(仍占位,不回流),悬停该列表头或
   键盘聚焦到表头内时淡入。官方类名已在真实 NDataTable 上核对(设计文档 9.1)。
   常驻例外:正在排序的列箭头、已筛选的列漏斗、面板打开的那一列漏斗。
   注意:所有例外规则都要带 .n-data-table-th 前缀,与隐藏规则同级(0,4,0)并写在其后,否则压不过(P-4)。 */
.smart-table :deep(.n-data-table-th .n-data-table-sorter) {
  opacity: 0;
  /* Q-3:官方给排序箭头写的是 transition: color .3s var(--n-bezier)(箭头变主色时用),
     这里的 transition 会整条覆盖它,所以两个都要写 */
  transition:
    opacity 0.15s,
    color 0.3s var(--n-bezier);
}
.smart-table :deep(.n-data-table-th .smart-table-filter-trigger) {
  opacity: 0;
  transition: opacity 0.15s;
}
.smart-table :deep(.n-data-table-th:hover .n-data-table-sorter),
.smart-table :deep(.n-data-table-th:hover .smart-table-filter-trigger),
.smart-table :deep(.n-data-table-th:focus-within .smart-table-filter-trigger),
.smart-table :deep(.n-data-table-th--sorting .n-data-table-sorter),
.smart-table :deep(.n-data-table-th .smart-table-filter-trigger--active),
.smart-table :deep(.n-data-table-th .smart-table-filter-trigger--open) {
  opacity: 1;
}
/* 触屏兜底(Q-4):没有悬停(主输入设备是触屏,如平板)。写法与设计原型一致,只写 `(hover: none)`(F16):
   不加 `any-pointer: coarse` —— 带触屏的 Windows 笔记本它也为 true,用鼠标时图标会常显,与原型「悬停才显示」不符。
   未激活的图标淡显常驻(仍低于激活态的主色)。
   24px 的列宽拖拽热区 P0 不做:它与现有 ::after 竖条错位、伸进下一列的一半会被后一个 th 盖住,
   连同把手的视觉整体归 P1(规格 §5.6)。 */
@media (hover: none) {
  .smart-table :deep(.n-data-table-th .n-data-table-sorter),
  .smart-table :deep(.n-data-table-th .smart-table-filter-trigger) {
    opacity: 0.5;
  }
  .smart-table :deep(.n-data-table-th .smart-table-filter-trigger--active),
  .smart-table :deep(.n-data-table-th .smart-table-filter-trigger--open),
  .smart-table :deep(.n-data-table-th--sorting .n-data-table-sorter) {
    opacity: 1;
  }
}
/* 图标间距(Q-5,设计 3.11;B12 的拖拽下限 93 / 102 / 123 就是按这个布局算的):
   标题 → 漏斗 8px(漏斗的 margin-left,在 ColumnFilter 里)、漏斗 → 排序箭头 6px(官方默认是 4px)、
   表头右内边距 16px(= 8px 把手 + 8px 缓冲)。 */
.smart-table :deep(.n-data-table-th) {
  padding-right: 16px;
}
.smart-table :deep(.n-data-table-th .n-data-table-sorter) {
  margin-left: 6px;
}
/* 图标簇紧跟标题(F2):官方 title-wrapper 是 flex、title 是 flex:1 —— 标题居中时 title 块被撑满整格,排序箭头被挤到格子最右,
   和标题 / 漏斗之间空出一大块(默认列宽下漏斗 → 箭头实测 20px 以上,而不是 6px)。改成:wrapper 按内容收缩(inline-flex,
   随 th 的 text-align 居中 / 靠左 / 靠右),title 按内容宽(flex: 0 1 auto,放不下时仍可收缩,min-width:0 是官方的),
   于是「标题 + 漏斗 + 箭头」是一组、间距固定。只改 CSS,不改官方渲染结构。vertical-align:top 避免 inline 行框把表头撑高 1px。
   优先级:官方是 (0,3,0) / (0,4,0),scoped 的 :deep 写法是 (0,4,0) / (0,5,0),刚好压过。 */
.smart-table :deep(.n-data-table-th .n-data-table-th__title-wrapper) {
  display: inline-flex;
  vertical-align: top;
}
.smart-table :deep(.n-data-table-th .n-data-table-th__title-wrapper .n-data-table-th__title) {
  flex: 0 1 auto;
}
/* 列上写了 ellipsis 且可排序时,官方给省略号盒子写了 max-width: calc(100% - 18px)(给排序箭头留位)。title 现在按内容收缩,
   再扣 18px 会把「标题 + 漏斗」裁掉 18px(实测:漏斗被切掉);排序箭头本来就是 flex 兄弟、不会压到标题,所以还原成 100%。
   优先级:官方 (0,4,0),这里 (0,5,0)。 */
.smart-table :deep(.n-data-table-th.n-data-table-th--sortable .n-data-table-th__ellipsis) {
  max-width: 100%;
}
```
`src/ColumnFilter.vue` 的 `<style scoped>` 里把 `.smart-table-filter-trigger { … margin-left: 4px; … }` 的 `margin-left` 改成 `8px`。

- [ ] **Step 6: 跑,确认通过**

Run: `npm test && npm run typecheck`
Expected: `Test Files  15 passed (15)`、`Tests  244 passed (244)`(236 + 8:`ColumnFilter.test.ts` +6、`SmartTable.test.ts` +2);typecheck 无输出。

- [ ] **Step 7: playground 准备浏览器验证的前置条件(Q-13,正式提交的示例改动)**

原来的验证步骤要「在「基础」示例点排序」,但 `playground/DemoBasic.vue` 没有任何 `sorter` 列,`mock.ts` 也不处理排序,照做会无从下手。先补上:

`playground/DemoBasic.vue`:`salary` 与 `createTime` 两列各加 `sorter: true`:
```ts
  { key: 'salary', title: tt('薪资', 'Salary'), width: 120, align: 'right', format: 'money', sorter: true, filter: true },
```
```ts
    format: 'datetime',
    sorter: true,
    search: { type: 'daterange', key: 'createRange' },
```
`playground/mock.ts`:`mockPage` 里、最后的 `return { items: … }` 之前加(远程排序,真实后端在这里翻译成 `ORDER BY`;demo 只看主排序 `sortField / sortOrder`):
```ts
  // 排序:{ sortField, sortOrder: 'asc' | 'desc' };多列时另带 sorts,demo 只取主排序
  const sortField = params.sortField as string | undefined
  if (sortField) {
    const dir = params.sortOrder === 'desc' ? -1 : 1
    const key = (r: DemoRow) => r[sortField] as string | number
    list = [...list].sort((a, b) => (key(a) > key(b) ? 1 : key(a) < key(b) ? -1 : 0) * dir)
  }
```
Run: `npm run typecheck`
Expected: 无输出。

- [ ] **Step 8: 浏览器验证(CSS 无法在 jsdom 里验证,必须看一眼)**

Run: `node_modules/.bin/vite --port 5173`,打开 playground「基础」示例(「薪资」「创建时间」可排序,多数列可过滤)。逐项确认并记录:
1. 鼠标不在表头上时,**没有**任何灰色漏斗 / 排序箭头;鼠标移到某列表头,该列的漏斗和箭头淡入;移开淡出。
2. 点「薪资」排序后,鼠标移开,**该列的箭头仍然在**(主色);给某列加筛选后,鼠标移开,**该列漏斗仍然在**(主色);**点开某列漏斗面板时,那一列的漏斗在面板打开期间常驻**(P-4 修的就是这三处:它们此前是 `opacity: 0`)。
3. 按 Tab,焦点能落到漏斗按钮上,且漏斗按钮此时可见(`:focus-within`)。
4. **点漏斗不会触发排序**:点「薪资」列的漏斗,列表不重新请求、箭头不变(Q-6:靠官方 `data-data-table-filter`);点标题文字才排序。
5. 触屏兜底:Chrome DevTools 切到设备模拟(使 `matchMedia('(hover: none)').matches === true`),未激活的图标变成半透明常驻(`opacity: .5`),已激活 / 面板打开的仍是 1。**同时在用鼠标的桌面 / 带触屏笔记本上确认 `(hover: none)` 不匹配:平时没有任何灰色漏斗 / 箭头**(F16:与原型一致,没有 `any-pointer: coarse`)。
6. 间距(Q-5)。在控制台量「薪资」列(标题→漏斗 8px、漏斗→排序箭头 6px、右内边距 ≥ 16px):
```js
const r = (e) => e.getBoundingClientRect()
const th = [...document.querySelectorAll('.smart-table thead th')].find((t) => /薪资|Salary/.test(t.textContent))
const trig = th.querySelector('.smart-table-filter-trigger'), sorter = th.querySelector('.n-data-table-sorter')
const title = th.querySelector('.smart-table-th'), textNode = [...title.childNodes].find((n) => n.nodeType === 3)
const range = document.createRange(); range.selectNode(textNode)
;({ 标题到漏斗: r(trig).left - range.getBoundingClientRect().right, 漏斗到箭头: r(sorter).left - r(trig).right, 箭头到表头右缘: r(th).right - r(sorter).right })
```
Expected: 四条成立,且 `标题到漏斗 = 8`、`漏斗到箭头 = 6`、`箭头到表头右缘 ≥ 16`(右对齐时是 17:16px 内边距 + 1px 描边)。**三种情形都要量**:① 默认 `titleAlign: center` 与默认列宽;② 把所有表头改成靠左再量一次(控制台 `document.querySelectorAll('.smart-table thead th').forEach(t => t.style.textAlign = 'left')`,等价于列上写 `titleAlign: 'left'`;右对齐同理);③ 把「薪资」列拖到下限(123)再量一次 —— 三种情形下三个数都应成立,且表头高度不变(紧凑 39.4px)。另确认**带 `ellipsis: true` 的可排序列**(临时给 `DemoBasic.vue` 的「薪资」列加 `ellipsis: true`,验证完 `git checkout playground`)上面三种情形的 8 / 6 / ≥16 同样成立、漏斗没有被裁(这正是上面 `max-width: 100%` 那条规则要防的);极长标题在 `ellipsis` 下整个「标题 + 漏斗」被裁是 2.1.1 就有的行为,本 Task 不处理。F2 只改 CSS,没有动官方渲染结构。记录没有成立的项(尤其是实测间距),**不要**假装通过。暗色下角标文字(给某列勾 2 个以上选项)清晰可读(Q-2:文字色取 `baseColor`,亮色白 / 暗色黑)。结束后关掉 vite。

- [ ] **Step 9: 提交**

```bash
git add src/types.ts src/labels.ts src/ColumnFilter.vue src/SmartTable.vue tests/ColumnFilter.test.ts tests/SmartTable.test.ts playground/DemoBasic.vue playground/mock.ts
git commit -m "feat: 表头排序箭头/漏斗悬停才显示、触屏淡显兜底、漏斗可键盘聚焦并带条数角标、图标间距 8/6px(B6)" -m "有意的默认外观变更:箭头/漏斗常驻 → 悬停显现(激活态与触屏除外);暂不提供开关。点漏斗不排序改用官方 data-data-table-filter,不再 stopPropagation。" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: 列头过滤面板升级成多条件编辑(B7)+ 键盘 / 焦点 + options 列「勾选 ↔ 高级条件」(C3 落地)

> 规格 §1 B7、§5.3。**这是本计划里改动最大的一个 Task**,所以先把状态机抽成纯函数(`filterDraft.ts`,node 环境可测),再写一行编辑器(`ConditionRow.vue`),最后重写 `ColumnFilter.vue`。
>
> 面板规则(规格已定,这里是它的落地):
> - **condition 列**:多行「操作符 + 值 + 删除」,「添加条件」**上限 5 条**(`MAX_CONDITIONS`);≥ 2 条才出现「且 / 或」,**按字段一个值**(`FilterValue.logic`),只剩一条时 `logic` 归位为 `'and'`;换操作符后若旧值的形状不再适用(无值 / 数组 / 标量)就清空值。
> - **options 列**:默认勾选;底部「高级条件」展开同一份多条件编辑。**不丢信息**:打开面板时若当前值 `!isOptionsRepresentable`,**自动展开高级条件并原样显示**;勾选 → 高级时把勾选转写成条件(0 个 = 空白行、1 个 = `equal`、≥ 2 个 = 一条 `in`);高级 → 勾选(「返回列表」)仅当草稿可表达时允许,否则按钮禁用。提交:勾选形态写 `equal` 取「或」(`optionsToFilterValue`,序列化与 2.1.1 不变),高级形态写草稿。
> - 提交模型不变:面板内改的是**草稿**,点「确定」才提交;「重置」立即生效并关闭;Esc / 点外部丢弃草稿;值输入回车 = 确定。
> - **键盘 / 焦点 / ARIA(D6;设计文档 9.1 已在真实 `NPopover` 上验证:公开的 `NPopover` 不管键盘,焦点不进面板、Esc 不关,`internalTrapFocus` 才有)**,库自己做:
>   1. 打开时焦点移到第一个可编辑控件(宿主自定义面板 `def.render` **不自动聚焦**,不抢焦点);
>   2. Esc 关闭并丢弃草稿,焦点还给漏斗 —— 但**面板内有展开的 NSelect / NDatePicker 下拉时,Esc 只该收起那个下拉**:它们收起自己时只调 `markEventEffectPerformed(e)`(私有 WeakSet,`select/src/Select.mjs:620-625`、`date-picker/src/DatePicker.mjs:320-331`),不 `stopPropagation`,原计划的 `onPanelKeydown` 无条件 `close(true)` 会把整个面板连草稿一起关掉(jsdom 已复现)。做法:`ConditionRow` 在下拉组件上监听 `@update:show` 记录展开状态,面板在**捕获阶段**据此判断(以真实浏览器为准,见 Step 13);
>   3. 面板容器 `tabindex="-1"` + `role="dialog"` + `aria-label`(列标题 + labels 文案,渲染期求值);点空白处时浏览器会自动聚焦到这个 `tabindex=-1` 的容器(焦点不落到 body,之后的 Esc / Tab 有人接),**不需要** mousedown 处理(E3,S3 实测);
>   4. 轻量焦点循环:Tab 离开最后一个可聚焦控件回到第一个,Shift+Tab 反之(Popover 被 teleport 到 body 末尾,不做的话 Tab 会走出面板、焦点丢失;草稿不丢);
>   5. 漏斗按钮 `aria-haspopup="dialog"`、`:aria-expanded`;
>   6. 通过 Esc / 确定 / 重置关闭后焦点还给漏斗按钮(**点外部关闭不抢焦点**,否则会把用户刚点的输入框的焦点抢走)。
> - 宿主自定义面板(`def.render`)只复用弹层与提交通道,但**行为有两处变化**(CHANGELOG 要写,原计划说「行为不变」不准确):现在**按 Esc 会关闭**面板(2.1.1 不会;焦点在面板内、或还停在漏斗按钮上时都生效 —— 漏斗触发器在面板打开期间也处理 Esc:关闭、丢弃草稿、焦点留在漏斗,F3),且**不会自动聚焦**;Tab 循环只用于内置面板。
> - **窄档(容器 < 600)**:列头面板在窄档仍是 `NPopover`。规格曾写「窄档用底部 `NDrawer`」,那属于 P2(D12,`cardOnNarrow` 门控),本 Task 不做。
> - 点漏斗不触发排序用的是官方 `data-data-table-filter`(Task 9),不再用 `@click.stop`;面板容器自己的 `@click.stop` 保留(2.1.1 就有,面板是 teleport 出去的,与排序无关)。
> - 保留现有 DOM 钩子:`.smart-table-filter-trigger`、`.smart-table-filter-all`、`.smart-table-filter-footer button`(顺序:重置、确定),已有测试依赖它们。

**Files:**
- Create: `src/filterDraft.ts`、`src/ConditionRow.vue`
- Modify: `src/ColumnFilter.vue`(整个文件替换)、`src/types.ts`、`src/labels.ts`、`src/useColumns.ts`(`filterDefTitle`)、`playground/DemoFilter.vue`(加一个编程式设过滤的按钮,Q-13)
- Test: `tests/filterDraft.test.ts`(新建)、`tests/ColumnFilter.test.ts`(追加)

**Interfaces:**
- Consumes: Task 2 的 `actionValueKind` / `activeConditions` / `isFilterActive`、`ACTION_LABEL_KEY`;Task 3 的 `isOptionsRepresentable` / `filterValueToOptions`;Task 6 的 `CloseIcon`;Task 9 的 `fmt` 与 `filterActiveCount`、触发器的状态类。
- Produces:
  - `filterDraft.ts`:`MAX_CONDITIONS = 5`;`interface FilterDraft { logic: FilterLogic; conditions: FilterCondition[] }`;`blankDraft(action: FilterAction): FilterDraft`;`draftFromValue(value: FilterValue | null | undefined, action: FilterAction): FilterDraft`;`addCondition(d: FilterDraft, action: FilterAction): FilterDraft`;`removeCondition(d: FilterDraft, index: number, action: FilterAction): FilterDraft`;`setConditionAction(d, index, action): FilterDraft`;`setConditionValue(d, index, value: unknown): FilterDraft`;`setLogic(d, logic: FilterLogic): FilterDraft`;`draftToValue(d: FilterDraft): FilterValue | null`
  - `ConditionRow.vue` props:`def: FilterDef`、`condition: FilterCondition`、`labels`(`Required<SmartTableLabels>`)、`getOptions`、`isLoadingOptions`、`dateValueFormat`、`removable: boolean`;事件:`update:action`(`FilterAction`)、`update:value`(`unknown`)、`remove`、`enter`、`dropdown`(`boolean`:这一行里有 NSelect / NDatePicker 的下拉展开 / 全部收起)
  - `useColumns.ts`:`filterDefTitle(def: { key: string; title?: string | (() => VNodeChild) }): string`(面板的 `aria-label` 与 Task 11 的 chips 共用)
  - `ColumnFilter.vue` 新 prop:`openRequest: number`(默认 0,每次变大 = 请求打开面板;Task 11 的 chips 用)
  - `SmartTableLabels` 新增 6 个**可选**键(D9;`defaultLabels` 补英文、`zhCNLabels` 补中文):`filterAddCondition` `filterRemoveCondition` `filterLogicAnd` `filterLogicOr` `filterAdvanced` `filterSimple`

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
Expected: `Tests  13 passed (13)`;此刻全量 `npm test` 是 `Test Files  16 passed (16)`、`Tests  257 passed (257)`(244 + 13),typecheck 无输出。

- [ ] **Step 5: 提交(纯函数先落地)**

```bash
git add src/filterDraft.ts tests/filterDraft.test.ts
git commit -m "feat: 新增列头过滤面板的草稿状态机 filterDraft(B7 内核,UI 接线见下一个提交)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 6: labels(6 个新键,全部可选)与面板标题辅助函数**

`src/types.ts`:`SmartTableLabels` 末尾(最后一个键之后)加(**可选键**,D9):
```ts
  filterAddCondition?: string
  filterRemoveCondition?: string
  /** 同一列多条件的连接方式(「且 / 或」分段按钮)。 */
  filterLogicAnd?: string
  filterLogicOr?: string
  /** options 列底部展开多条件编辑的入口 / 收起回勾选列表的入口。 */
  filterAdvanced?: string
  filterSimple?: string
```
`src/labels.ts`:`defaultLabels` 末尾加:
```ts
  filterAddCondition: 'Add condition',
  filterRemoveCondition: 'Remove condition',
  filterLogicAnd: 'AND',
  filterLogicOr: 'OR',
  filterAdvanced: 'Advanced conditions',
  filterSimple: 'Back to list',
```
`zhCNLabels` 末尾加:
```ts
  filterAddCondition: '添加条件',
  filterRemoveCondition: '删除条件',
  filterLogicAnd: '且',
  filterLogicOr: '或',
  filterAdvanced: '高级条件',
  filterSimple: '返回列表',
```
`src/useColumns.ts`:在 `FilterDef` 接口定义之后加(面板的 `aria-label` 与 Task 11 的 chips 共用):
```ts
/** 过滤项的展示标题:字符串 / 数字直接用;函数返回非字符串(VNode)或没有标题 → 回退成列 key。渲染期调用,切语言即时生效。 */
export function filterDefTitle(def: { key: string; title?: string | (() => VNodeChild) }): string {
  const t = typeof def.title === 'function' ? def.title() : def.title
  return typeof t === 'string' || typeof t === 'number' ? String(t) : def.key
}
```

- [ ] **Step 7: 写 `src/ConditionRow.vue`**

两处与原稿不同:① 下拉选项类型不再深层 import `naive-ui/es/select/src/interface`(不是公开入口),改用公开的 `SelectProps` 推导(与 Task 6 里 `ToolbarMoreOption` 的做法一致,Q-12);② 行里的 `NSelect` / `NDatePicker` 展开 / 收起时向外报 `dropdown`(D6:面板据此决定 Esc 是「只收下拉」还是「关面板」)。

Create `src/ConditionRow.vue`:
```vue
<script setup lang="ts">
// 面板里的一行条件:操作符 + 值控件 + 删除。受控(草稿由 ColumnFilter 持有),只发事件。
// 值控件按操作符的值形状分发:无值(isNull 等)→ 禁用的占位框;数组(in / notIn)→ 多选;标量 → 按列类型选控件。
import { computed, onBeforeUnmount, reactive, watch, type PropType } from 'vue'
import { NButton, NDatePicker, NInput, NInputNumber, NSelect } from 'naive-ui'
import type { SelectProps } from 'naive-ui'
import type { FilterAction, FilterCondition, SmartTableLabels, SmartTableOption } from './types'
import type { FilterDef } from './useColumns'
import { actionValueKind } from './filter'
import { ACTION_LABEL_KEY } from './labels'
import { optionLabel } from './useOptions'
import { CloseIcon } from './icons'

/** NSelect 的选项类型:官方没有公开导出 SelectMixedOption,从公开的 SelectProps 推导。 */
type SelectOpt = NonNullable<SelectProps['options']>[number]

const props = defineProps({
  def: { type: Object as PropType<FilterDef>, required: true },
  condition: { type: Object as PropType<FilterCondition>, required: true },
  labels: { type: Object as PropType<Required<SmartTableLabels>>, required: true },
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
  /** 这一行里有 NSelect / NDatePicker 的下拉浮层展开(true)/ 全部收起(false)。 */
  dropdown: [open: boolean]
}>()

const kind = computed(() => actionValueKind(props.condition.action))

// 下拉展开状态:操作符下拉与值控件各记一份,任意一个展开就算「这一行有下拉展开」。
// 面板要靠它区分 Esc 是「收起下拉」还是「关闭面板」(NSelect / NDatePicker 收起自己时不 stopPropagation)。
const open = reactive({ action: false, value: false })
watch(
  () => open.action || open.value,
  (v) => emit('dropdown', v),
)
onBeforeUnmount(() => {
  if (open.action || open.value) emit('dropdown', false)
})

// 当前操作符不在 def.actions 里时(编程式给了列声明之外的操作符),也要能在下拉里显示出来,不能变成空白
const actionOptions = computed<SelectOpt[]>(() => {
  const cur = props.condition.action
  const list = props.def.actions.includes(cur) ? props.def.actions : [cur, ...props.def.actions]
  return list.map((a) => ({ label: props.labels[ACTION_LABEL_KEY[a]], value: a }))
})

/** 过滤勾选 / 下拉按扁平处理:分组选项的父节点本身不是可选值。 */
function flatten(opts: SmartTableOption[]): SmartTableOption[] {
  return opts.flatMap((o) => (o.children?.length ? flatten(o.children) : [o]))
}
const selectOptions = computed<SelectOpt[]>(() =>
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
      @update:show="(v: boolean) => (open.action = v)"
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
        @update:show="(v: boolean) => (open.value = v)"
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
        @update:show="(v: boolean) => (open.value = v)"
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
        @update:show="(v: boolean) => (open.value = v)"
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
2. `labels` 常量(Task 9 加过 `filterActiveCount`,类型标注已是 `Required<SmartTableLabels>`)再补这些键:
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
    // 真实派生里 options 列的值控件类型是 'select'(deriveFilterDefs);夹具也按这个来 —— 否则数字值会灌进 NInput,Vue 报 prop 类型 warn。
    // 文件顶部现成的 buildOptionsDef() 是 type: 'input'(Q-12),所以这里显式改成 select;下面 isNull 那条专门覆盖 select + 无值算子。
    const optionsDef = (): FilterDef => ({ ...buildOptionsDef(), type: 'select' })

    it('[Review Focus 3] 当前值是 notEqual:打开时自动展开高级条件并原样显示,确认不覆盖', async () => {
      const value = v('and', ['notEqual', 1])
      const w = await openPanel(optionsDef(), value, () => opts as never[])
      expect(document.body.querySelector('.smart-table-filter-options')).toBeNull() // 没有勾选列表
      expect(document.body.querySelectorAll('.smart-table-filter-row')).toHaveLength(1)
      docClick(confirmBtn())
      expect(lastEmitted(w)).toEqual(value)
      w.unmount()
    })

    it('[Review Focus 3] type: "select" 的 options 列,值是 isNull:同样自动展开高级条件,确认原样提交', async () => {
      const def = optionsDef()
      expect(def.type).toBe('select')
      const value = v('and', ['isNull', null])
      const w = await openPanel(def, value, () => opts as never[])
      expect(document.body.querySelector('.smart-table-filter-options')).toBeNull()
      expect(document.body.querySelectorAll('.smart-table-filter-row')).toHaveLength(1)
      const input = document.body.querySelector('.smart-table-filter-value input') as HTMLInputElement
      expect(input.disabled).toBe(true) // isNull 无需填值
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

  describe('键盘 / 焦点 / ARIA(公开的 NPopover 不管,库自己做;D6)', () => {
    const panelEl = () => document.body.querySelector('.smart-table-filter') as HTMLElement
    const key = (k: string, shiftKey = false) =>
      panelEl().dispatchEvent(new KeyboardEvent('keydown', { key: k, shiftKey, bubbles: true, cancelable: true }))
    const FOCUSABLE =
      'input:not([disabled]), button:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

    it('打开后焦点进入面板', async () => {
      const w = await openPanel(conditionDef(), null)
      await flushPromises()
      expect(panelEl().contains(document.activeElement)).toBe(true)
      w.unmount()
    })

    it('Esc:关闭并丢弃草稿(不提交),焦点还给漏斗按钮', async () => {
      const w = await openPanel(conditionDef(), null)
      w.findComponent(ConditionRow).vm.$emit('update:value', 'draft-only')
      await nextTick()
      key('Escape')
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

    it('[D6] 下拉展开时按 Esc:只留给下拉去收,面板与草稿都还在(确认仍能提交草稿)', async () => {
      const w = await openPanel(conditionDef(), null)
      const row = w.findComponent(ConditionRow)
      row.vm.$emit('update:value', 'draft')
      row.findComponent(NSelect).vm.$emit('update:show', true) // 操作符下拉展开
      await nextTick()
      key('Escape')
      await flushPromises()
      expect(panelEl()).not.toBeNull()
      expect(w.emitted('update:value')).toBeUndefined()
      docClick(confirmBtn())
      expect(lastEmitted(w)).toEqual(v('and', ['contains', 'draft']))
      w.unmount()
    })

    it('[D6] 下拉收起之后再按 Esc:才关闭面板(丢弃草稿)', async () => {
      const w = await openPanel(conditionDef(), null)
      const row = w.findComponent(ConditionRow)
      row.vm.$emit('update:value', 'draft')
      row.findComponent(NSelect).vm.$emit('update:show', true)
      row.findComponent(NSelect).vm.$emit('update:show', false)
      await nextTick()
      key('Escape')
      await flushPromises()
      expect(w.emitted('update:value')).toBeUndefined()
      expect(document.activeElement).toBe(w.find('.smart-table-filter-trigger button').element)
      w.unmount()
    })

    it('[D6 / E3] 点空白处靠容器 tabindex=-1 自动聚焦(不写 mousedown 处理):容器可聚焦,聚焦后 Esc 仍然生效', async () => {
      const w = await openPanel(conditionDef(), null)
      expect(panelEl().getAttribute('tabindex')).toBe('-1')
      panelEl().focus() // 浏览器里点空白处的效果;jsdom 不模拟鼠标点击的默认聚焦,这里直接 focus()
      expect(document.activeElement).toBe(panelEl())
      key('Escape')
      await flushPromises()
      expect(document.activeElement).toBe(w.find('.smart-table-filter-trigger button').element)
      w.unmount()
    })

    it('[D6] Tab 在面板内循环:最后一个控件 Tab → 第一个;第一个 Shift+Tab → 最后一个', async () => {
      const w = await openPanel(conditionDef(), null)
      const items = Array.from(panelEl().querySelectorAll<HTMLElement>(FOCUSABLE))
      const first = items[0]
      const last = items[items.length - 1]
      expect(first).not.toBe(last)
      last.focus()
      key('Tab')
      expect(document.activeElement).toBe(first)
      key('Tab', true)
      expect(document.activeElement).toBe(last)
      w.unmount()
    })

    it('[D6] ARIA:漏斗按钮 aria-haspopup / aria-expanded;面板 role=dialog + aria-label(列标题 + 过滤)', async () => {
      const w = mount(ColumnFilter, {
        props: { def: conditionDef({ title: '姓名' }), value: null, labels, getOptions: () => [], isLoadingOptions: () => false },
        attachTo: document.body,
      })
      const btn = w.find('.smart-table-filter-trigger button')
      expect(btn.attributes('aria-haspopup')).toBe('dialog')
      expect(btn.attributes('aria-expanded')).toBe('false')
      await w.find('.smart-table-filter-trigger').trigger('click')
      await flushPromises()
      expect(btn.attributes('aria-expanded')).toBe('true')
      expect(panelEl().getAttribute('role')).toBe('dialog')
      expect(panelEl().getAttribute('aria-label')).toBe('姓名 过滤')
      w.unmount()
    })

    it('[D6] 自定义面板(def.render):不自动聚焦(不抢焦点);Esc 仍能关闭,焦点还给漏斗', async () => {
      const def = conditionDef({ render: () => h('button', { class: 'host-btn' }, 'x') })
      const w = await openPanel(def, null)
      await flushPromises()
      expect(panelEl().contains(document.activeElement)).toBe(false)
      key('Escape')
      await flushPromises()
      expect(document.activeElement).toBe(w.find('.smart-table-filter-trigger button').element)
      w.unmount()
    })

    it('[F3] 自定义面板不自动聚焦、焦点留在漏斗上:对漏斗按钮按 Esc 同样关闭面板,焦点留在漏斗(真实浏览器里 keydown 到不了面板容器)', async () => {
      const def = conditionDef({ render: () => h('button', { class: 'host-btn' }, 'x') })
      const w = await openPanel(def, null)
      await flushPromises()
      const btn = w.find('.smart-table-filter-trigger button')
      expect(btn.attributes('aria-expanded')).toBe('true')
      ;(btn.element as HTMLElement).focus()
      await btn.trigger('keydown', { key: 'Escape' })
      await flushPromises()
      expect(btn.attributes('aria-expanded')).toBe('false')
      expect(document.activeElement).toBe(btn.element)
      expect(w.emitted('update:value')).toBeUndefined() // 丢弃,不提交
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
Expected: `24 failed | 9 passed (33)`(实测)—— 新用例里找不到 `.smart-table-filter-add` 等节点(`element not found`)、`Cannot call vm on an empty VueWrapper`、`expected undefined to be 'dialog'` 等;已有的 9 条用例此时仍通过(原 3 条 + Task 9 加的 6 条)。

- [ ] **Step 10: 实现 —— 整个替换 `src/ColumnFilter.vue`**

把 `src/ColumnFilter.vue` 整个文件替换为(已并入 Task 9 的触发器改动:`data-data-table-filter`、角标文字色取 `baseColor`、间距 8px):
```vue
<script setup lang="ts">
// 表头过滤面板:漏斗触发 + 弹层。两种形态共用同一份过滤值模型(FilterValue):
//   options   —— Arco 风格,勾选候选项(等价于若干 equal 条件取「或」);底部「高级条件」展开同一份多条件编辑
//   condition —— Bootstrap Blazor 风格,多行 [操作符 + 值](最多 5 条,≥ 2 条出现且/或)
// 面板内改的是草稿,点「确定」才提交,避免每敲一个字就打一次远程请求;Esc / 点外部丢弃草稿。
// 键盘 / 焦点 / ARIA:公开的 NPopover 不管(焦点不进面板、Esc 不关闭,见设计文档 9.1),这里自己做(D6)。
import { computed, nextTick, reactive, ref, watch, type PropType } from 'vue'
import { NButton, NCheckbox, NPopover, NRadioButton, NRadioGroup, NSpace, NTooltip, useThemeVars } from 'naive-ui'
import type { FilterAction, FilterLogic, FilterValue, SmartTableLabels, SmartTableOption } from './types'
import { filterDefTitle, type FilterDef } from './useColumns'
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
  labels: { type: Object as PropType<Required<SmartTableLabels>>, required: true },
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
// 面板的无障碍名:「列标题 + 过滤」(渲染期求值,切语言即时生效)
const panelLabel = computed(() => `${filterDefTitle(props.def)} ${props.labels.filter}`)

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

/* ---- 键盘 / 焦点(D6) ---- */

/** 面板里可 Tab 到的控件(tabindex=-1 的面板容器自己不算)。 */
const FOCUSABLE = 'input:not([disabled]), button:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function focusFirst() {
  panelRef.value?.querySelector<HTMLElement>(FOCUSABLE)?.focus()
}

/** 有 NSelect / NDatePicker 下拉展开的条件行下标。展开期间 Esc 只该收起那个下拉,不能连面板一起关掉(草稿会丢)。 */
const dropdownRows = reactive(new Set<number>())
const dropdownOpen = computed(() => dropdownRows.size > 0)
function onDropdown(i: number, open: boolean) {
  if (open) dropdownRows.add(i)
  else dropdownRows.delete(i)
}

watch(show, (open) => {
  dropdownRows.clear()
  if (open) {
    loadDraft(props.value)
    return
  }
  if (returnFocus) {
    returnFocus = false
    triggerRef.value?.querySelector<HTMLElement>('button')?.focus()
  }
})
// 弹层内容挂载(每次打开都会重新挂载)后再聚焦第一个可编辑控件:内容是 teleport 出去的,show 变 true 时还不在 DOM 里。
// 宿主自定义面板(def.render)不自动聚焦:里面是什么控件库不知道,抢焦点可能打断宿主自己的逻辑。
watch(panelRef, (el) => {
  if (el && show.value && !props.def.render) void nextTick(focusFirst)
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

/** Tab 在面板内循环(role=dialog 的常规做法;草稿不丢):最后一个控件 Tab → 第一个,第一个 Shift+Tab → 最后一个。 */
function trapTab(e: KeyboardEvent) {
  const panel = panelRef.value
  if (!panel) return
  const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
  if (!items.length) return
  const first = items[0]
  const last = items[items.length - 1]
  const cur = document.activeElement
  if (e.shiftKey && (cur === first || cur === panel)) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && cur === last) {
    e.preventDefault()
    first.focus()
  }
}

/**
 * 面板键盘处理(捕获阶段挂在面板容器上)。
 * Esc:有下拉展开 → 放行,让 NSelect / NDatePicker 自己收起它(它们只 markEventEffectPerformed,不 stopPropagation,
 * 所以必须在捕获阶段、它们动手之前判断,不然它们收起后我们这边读到的「是否有下拉」已经变了);
 * 没有下拉 → 关闭面板、丢弃草稿、焦点还给漏斗。自定义面板(def.render)同样适用 Esc。
 */
function onPanelKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (dropdownOpen.value) return
    e.stopPropagation()
    close(true) // 丢弃草稿:不 emit
    return
  }
  if (e.key === 'Tab' && !props.def.render) trapTab(e)
}

/**
 * 漏斗触发器上的 Esc(F3):面板打开期间,焦点还停在漏斗按钮上时(自定义面板 def.render 不自动聚焦,焦点就留在这里;
 * 这时 keydown 到不了面板容器上的捕获监听)也要能关:关闭、丢弃草稿、焦点留在漏斗。面板没开时什么也不做,不拦别人的 Esc。
 */
function onTriggerKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape' || !show.value || dropdownOpen.value) return
  e.stopPropagation()
  close(true)
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
const onRemove = (i: number) => {
  dropdownRows.clear() // 行号会整体前移,旧的展开记录作废;该行上的下拉随行一起卸载
  draft.value = removeCondition(draft.value, i, firstAction())
}
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
      <!-- data-data-table-filter:官方点表头时据此跳过排序(Header.mjs:107-108 的 happensIn(e, 'dataTableFilter'))。
           不用 @click.stop:它会吞掉宿主挂在 th / 祖先上的 click 监听(Q-6)。 -->
      <span
        ref="triggerRef"
        class="smart-table-filter-trigger"
        :class="{ 'smart-table-filter-trigger--active': active, 'smart-table-filter-trigger--open': show }"
        data-data-table-filter
        @keydown="onTriggerKeydown"
      >
        <n-tooltip trigger="hover" :disabled="show">
          <template #trigger>
            <!-- aria-haspopup / aria-expanded:屏幕阅读器得知这个按钮会弹出对话框、当前是否展开(D6) -->
            <n-button
              quaternary
              size="tiny"
              :type="active ? 'primary' : 'default'"
              :aria-label="ariaLabel"
              aria-haspopup="dialog"
              :aria-expanded="show"
            >
              <template #icon><FilterIcon /></template>
            </n-button>
          </template>
          {{ labels.filter }}
        </n-tooltip>
        <!-- 文字色取主题的 baseColor(亮白 / 暗黑),不写死 #fff:暗色下叠在主色上对比度太低(Q-2) -->
        <span v-if="activeCount > 1" class="smart-table-filter-badge" :style="{ color: themeVars.baseColor }">{{
          activeCount
        }}</span>
      </span>
    </template>

    <!-- 面板容器:role=dialog + aria-label;tabindex=-1 让它能被鼠标聚焦 —— 点空白处时浏览器自动把焦点给它(不落到 body),不需要任何 mousedown 处理(E3,S3 实测) -->
    <div
      ref="panelRef"
      class="smart-table-filter"
      :class="{ 'smart-table-filter--condition': !def.render && showEditor }"
      role="dialog"
      tabindex="-1"
      :aria-label="panelLabel"
      :style="{
        background: themeVars.popoverColor,
        borderRadius: themeVars.borderRadius,
        boxShadow: themeVars.boxShadow2,
        color: themeVars.textColor2,
      }"
      @click.stop
      @keydown.capture="onPanelKeydown"
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
            @update:action="(a: FilterAction) => onAction(i, a)"
            @update:value="(v: unknown) => onValue(i, v)"
            @remove="onRemove(i)"
            @enter="confirm"
            @dropdown="(o: boolean) => onDropdown(i, o)"
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
  /* 标题 → 漏斗 8px(Q-5);漏斗 → 排序箭头 6px 由 SmartTable 的样式给 */
  margin-left: 8px;
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
  /* 文字色在模板里经 :style 取 themeVars.baseColor(Q-2);背景取官方的激活图标色(角标在 th 的子树里,--n-* 变量可用) */
  background: var(--n-th-icon-color-active);
}
.smart-table-filter {
  min-width: 200px;
  padding: 8px;
  /* 表头文字常是 center,弹层内容一律左对齐 */
  text-align: left;
  font-weight: normal;
}
/* 容器只接程序化焦点(点空白处 / Esc 的落点),不画焦点环 */
.smart-table-filter:focus {
  outline: none;
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
Expected: `Test Files  16 passed (16)`、`Tests  281 passed (281)`(257 + 24:`ColumnFilter.test.ts` 新增的 24 条,含 [F3] 那条);typecheck 无输出;输出里没有 `[Vue warn]`。排错提示:
- 若「打开后焦点进入面板」失败:确认 `watch(panelRef, …)` 里是 `nextTick(focusFirst)`;NPopover 的内容每次打开都会重新挂载,所以 `panelRef` 会从 `null` 变成元素。
- 若「下拉展开时按 Esc」那条失败、面板被关掉了:确认面板上挂的是 `@keydown.capture`(捕获阶段)。NSelect / NDatePicker 收起自己时只调 `markEventEffectPerformed(e)`(`select/src/Select.mjs:620-625`、`date-picker/src/DatePicker.mjs:320-331`),不 `stopPropagation`;若挂在冒泡阶段,它们先收起、我们再读「是否有下拉展开」就已经是 `false` 了。
- 已有的 `ColumnFilter` 测试(勾选全选 / 自定义面板不重挂 / Task 9 的触发器用例)必须仍通过;它们依赖 `.smart-table-filter-all`、`.smart-table-filter-footer button`、`.smart-table-filter-trigger`。

- [ ] **Step 12: playground 准备浏览器验证的前置条件(Q-13,正式提交的示例改动)**

原来的验证步骤要「在控制台 `setFilter(...)`」,但 `tableRef` 是 `<script setup>` 里的局部变量,控制台里根本没有它。给「过滤 / 列宽」示例加一个按钮(`tableRef` 就在这个组件里):

`playground/DemoFilter.vue`:在「编程式:只看离职」那个 `<n-button>` 之后加:
```vue
      <n-button
        size="small"
        @click="tableRef?.setFilter('status', { logic: 'and', conditions: [{ action: 'notEqual', value: 1 }] })"
      >
        {{ tt('编程式:状态 ≠ 在职', 'Set filter: status ≠ Active')() }}
      </n-button>
```
Run: `npm run typecheck`
Expected: 无输出。

- [ ] **Step 13: 浏览器验证(弹层的真实交互只能在浏览器里看)**

Run: `node_modules/.bin/vite --port 5173`,打开 playground「过滤 / 列宽」示例(`DemoFilter`)。逐项确认并记录:
1. condition 列(「账号」):点漏斗 → 面板出现,焦点在第一个控件;按 Tab 能在面板内走、**走到最后一个控件再 Tab 回到第一个**(不会走出面板);按 Esc 关闭、焦点回到漏斗、没有发请求 / 没有过滤变化。
2. 「添加条件」加到 5 条后变灰;≥ 2 条出现「且 / 或」。
3. options 列(「状态」):点上面新加的「编程式:状态 ≠ 在职」按钮,再点「状态」漏斗 → 自动展开高级条件且显示这条 `notEqual`;点「确定」后过滤值不变(页面上方「过滤态」那行 JSON 不变)。
4. **Esc 分层(D6)**:在「账号」面板里点操作符下拉(「包含」那个)展开菜单,按 Esc:**只收起菜单,面板与已输入的草稿都还在**;再按一次 Esc 才关闭面板。对「创建时间」列的日期控件做同样的检查(日期面板展开时按 Esc)。
5. 点面板**空白处**(不是控件)后按 Esc:面板关闭(焦点没有落到 body 上)。
6. 面板里点下拉菜单的选项:面板**不会**因此被当成「点击外部」而关掉。
7. 点面板**外部**的另一个输入框(如页面上方的其它控件):面板关闭,焦点留在你点的输入框上(没有被抢回漏斗)。
8. 自定义面板(「部门」列,用 `filter.render`):打开后焦点**不会**被抢进面板(仍在漏斗按钮上);**焦点还在漏斗按钮上时**按 Esc 也能关闭(不用先点面板;F3),焦点留在漏斗。
9. 读屏 / 检查器:漏斗按钮有 `aria-haspopup="dialog"`,展开时 `aria-expanded="true"`;面板根元素 `role="dialog"`、`aria-label` = 「部门 过滤」这类「列标题 + 过滤」。
Expected: 九条都成立;记录没有成立的项。**第 4、6 条依赖真实 `NSelect` / `NDatePicker` 的行为,jsdom 里只能模拟 `update:show` 事件,必须在这里确认**;若 4 不成立(例如 Esc 仍把面板关了),说明捕获阶段的判断与真实组件的事件顺序不符,先查原因再改实现,**不要改测试**。结束后关掉 vite。

- [ ] **Step 14: 提交**

```bash
git add src/ConditionRow.vue src/ColumnFilter.vue src/types.ts src/labels.ts src/useColumns.ts tests/ColumnFilter.test.ts playground/DemoFilter.vue
git commit -m "feat!: 列头过滤面板升级为多条件编辑,options 列支持「勾选 ↔ 高级条件」且不再丢条件,键盘与可访问性补齐(B7/C3)" -m "有意的默认行为变更:单条件/勾选 → 多条件编辑(≤5 条,且/或);options 列的过滤值勾选表达不了时自动展开高级条件;面板支持 Esc / Tab 循环 / role=dialog。自定义面板(def.render)也变了:现在按 Esc 会关闭,且不会自动聚焦。新增 openRequest prop 供 chips 使用。" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: 已生效条件 chips(`filterChips`)

> 规格 §3、§5.3。`filterChips?: boolean`,**P0 里默认 `false`**(模式 2 默认开随 P1 发布)。
> - chips 用官方 `NTag`(`round` / `closable` / `size="small"`);点击 chip = 重开对应列面板;× = 只删这一条;同字段第 2 条起若该列是「或」则加前缀。
> - 行末文字按钮:表里有任何列声明了有效的 `defaultValue` 时显示「恢复默认」,否则「清除全部」;都调 `clearFilters()`(**语义不变,恢复各列 `defaultValue`**)。
> - 超过一行折成「+N」:只显示第一行放得下的个数,其余收进 `+N` 标签,点它在气泡里展开完整列表。**折叠个数靠量 `offsetTop`**(jsdom 里恒为 0,所以组件测试里永远是「全放得下」;折叠算法本身用纯函数 `countFitting` 单测)。
> - chips 是工具栏**下方独立一行**;批量栏(P1)只替换工具栏那一行,所以勾选期间 chips 仍可见。
> - chips 按**列声明**派生(`filterDefs`),与该列是否在列设置里被隐藏无关:被隐藏的列,过滤条件仍然生效,chips 也仍然显示;此时点 chip 无处可开面板,是空操作(不报错)。
> - **孤儿键(Q-7)**:过滤态里有、但列声明里已经没有对应过滤项的键(列被移除 / 改了 `filter.key` / 总开关关了)—— 它**仍会进远程请求参数**,原稿却既没有 chip、连「清除全部」也不渲染,用户看不见也清不掉。所以为孤儿键也生成 chip:标题回退成键、**不开面板**(点击是空操作)、× 可清;排在列声明的 chip 之后。
> - **chips 可键盘操作(Q-7)**:`role="button"`、`tabindex="0"`,Enter / Space 等同点击(只处理 chip 自己收到的按键,× 上的按键不算)。
> - **`+N` 让位后重测(Q-7)**:`countFitting` 只是估算,`+N` 标签自己也占位,渲染出来若折到了第二行,再让出一个位置(纯函数 `shrinkForMore`),直到稳定;**连「首个 chip + `+N`」都放不下时只显示 `+N`(全部进气泡,F10)**,所以容器再窄 `+N` 也不会单独掉到第二行。

**Files:**
- Create: `src/filterChips.ts`、`src/FilterChips.vue`
- Modify: `src/types.ts`、`src/labels.ts`、`src/SmartTable.vue`(**不改 `src/index.ts`**:`ChipItem` 等是内部实现细节,不进公开入口,Q-8)
- Test: `tests/filterChips.test.ts`(新建)、`tests/SmartTable.test.ts`(追加)

**Interfaces:**
- Consumes: Task 2 的 `ACTION_LABEL_KEY` / `activeConditions` / `isValuelessAction`;Task 10 的 `ColumnFilter` 新 prop `openRequest` 与 labels `filterLogicOr`。
- Produces:
  - `filterChips.ts`:`interface ChipItem { key: string; index: number; text: string; orphan?: true }`(`key` = 过滤态的键,`index` = 该条件在 `activeConditions(value)` 里的下标,`orphan` 只在孤儿上设置);`buildChips(defs: FilterDef[], state: FilterState, labels: Required<SmartTableLabels>, optionLabelOf: (def: FilterDef | undefined, value: unknown) => string): ChipItem[]`;`removeChipCondition(value: FilterValue, index: number): FilterValue | null`;`countFitting(tops: number[]): number`;`shrinkForMore(visible: number, firstTop: number, moreTop: number): number`;`hasActiveDefaults(defs: FilterDef[]): boolean`(标题取 Task 10 的 `filterDefTitle`)
  - `FilterChips.vue` props:`items: ChipItem[]`、`labels`、`hasDefaults: boolean`;事件:`open(key: string)`、`remove(key: string, index: number)`、`clear()`
  - `SmartTableProps.filterChips?: boolean`;`SmartTableLabels.filterClearAll?` / `filterRestoreDefault?`(可选,D9;`defaultLabels` / `zhCNLabels` 同步补)

- [ ] **Step 1: 写失败测试 —— 纯函数**

Create `tests/filterChips.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { buildChips, countFitting, hasActiveDefaults, removeChipCondition, shrinkForMore } from '../src/filterChips'
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
const plain = (_d: FilterDef | undefined, value: unknown) => String(value)

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

  it('没有生效条件的列不出 chip', () => {
    expect(buildChips(defs, { name: v('and', ['contains', '']) }, defaultLabels, plain)).toEqual([])
  })

  it('[Q-7] 孤儿键(state 里有、defs 里没有)也出 chip:排在列声明的 chip 之后,标题回退成键,标 orphan', () => {
    const state: FilterState = { ghost: v('and', ['equal', 1]), name: v('and', ['contains', 'a']) }
    expect(buildChips(defs, state, defaultLabels, plain)).toEqual([
      { key: 'name', index: 0, text: '姓名 Contains a' },
      { key: 'ghost', index: 0, text: 'ghost Equals 1', orphan: true },
    ])
    // optionLabelOf 对孤儿收到的 def 是 undefined(没有字典可查)
    const seen: unknown[] = []
    buildChips(defs, { ghost: v('and', ['equal', 1]) }, defaultLabels, (d, val) => (seen.push(d), String(val)))
    expect(seen).toEqual([undefined])
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

describe('shrinkForMore(「+N」自己也占位)', () => {
  it('+N 与第一行同高 → 原样;折到了下一行 → 再让出一个位置;只剩 1 个还放不下 → 0(只显示 +N,全部进气泡,F10)', () => {
    expect(shrinkForMore(3, 0, 0)).toBe(3)
    expect(shrinkForMore(3, 0, 30)).toBe(2)
    expect(shrinkForMore(1, 0, 30)).toBe(0)
    expect(shrinkForMore(0, 0, 30)).toBe(0) // 下限 0,不会变负
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
import { filterDefTitle, type FilterDef } from './useColumns'

export interface ChipItem {
  /** 过滤态的键(FilterDef.key)。 */
  key: string
  /** 该条件在 activeConditions(value) 里的下标(删除时按它定位)。 */
  index: number
  text: string
  /**
   * 孤儿:过滤态里有、但列声明里已经没有对应的过滤项(列被移除 / 改了 filter.key / 总开关关了)。
   * 没有面板可开,但它仍会进远程请求参数 —— 所以也要让用户看得见、清得掉(Q-7)。只在孤儿上设置。
   */
  orphan?: true
}

function chipsOf(
  def: FilterDef | undefined,
  key: string,
  value: FilterValue | undefined,
  labels: Required<SmartTableLabels>,
  optionLabelOf: (def: FilterDef | undefined, value: unknown) => string,
  orphan: boolean,
): ChipItem[] {
  const title = def ? filterDefTitle(def) : key // 孤儿没有列标题,回退成键
  return activeConditions(value).map((c, index) => {
    const valueText = isValuelessAction(c.action)
      ? ''
      : Array.isArray(c.value)
        ? c.value.map((x) => optionLabelOf(def, x)).join(', ')
        : optionLabelOf(def, c.value)
    const text = [index > 0 && value?.logic === 'or' ? labels.filterLogicOr : '', title, labels[ACTION_LABEL_KEY[c.action]], valueText]
      .filter(Boolean)
      .join(' ')
    return { key, index, text, ...(orphan ? { orphan: true as const } : {}) }
  })
}

/**
 * 每个生效条件一个 chip;顺序按列声明,**之后**是孤儿键(按过滤态的键顺序)。
 * optionLabelOf 把值翻成展示文字(字典列显示 label 而不是 value;孤儿传 undefined 的 def,按原值显示)。
 */
export function buildChips(
  defs: FilterDef[],
  state: FilterState,
  labels: Required<SmartTableLabels>,
  optionLabelOf: (def: FilterDef | undefined, value: unknown) => string,
): ChipItem[] {
  const out: ChipItem[] = []
  const known = new Set<string>()
  for (const def of defs) {
    known.add(def.key)
    out.push(...chipsOf(def, def.key, state[def.key], labels, optionLabelOf, false))
  }
  for (const key of Object.keys(state)) {
    if (!known.has(key)) out.push(...chipsOf(undefined, key, state[key], labels, optionLabelOf, true))
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

/**
 * 「+N」标签本身也占位:让出一个位置只是估算,渲染出来后若 +N 仍折到了第二行(offsetTop 与第一行不同),
 * 再让出一个位置,可以让到 0(连首个 chip + +N 都放不下时只显示 +N,F10);放得下就原样返回。组件在 +N 渲染后重测,直到稳定(Q-7)。
 */
export function shrinkForMore(visible: number, firstTop: number, moreTop: number): number {
  return moreTop === firstTop ? visible : Math.max(0, visible - 1)
}

/** 表里是否有列声明了生效的 defaultValue —— 决定行末按钮叫「恢复默认」还是「清除全部」。 */
export function hasActiveDefaults(defs: FilterDef[]): boolean {
  return defs.some((d) => !!d.defaultValue && isFilterActive(d.defaultValue))
}
```

- [ ] **Step 4: 跑,确认通过**

Run: `npx vitest run tests/filterChips.test.ts`
Expected: `Tests  12 passed (12)`。

- [ ] **Step 5: labels、类型、`FilterChips.vue`**

`src/types.ts`:
- `SmartTableLabels` 末尾(最后一个键之后)加两个**可选键**(D9):`filterClearAll?: string` 与 `filterRestoreDefault?: string`。
- `SmartTableProps` 里 `filter?: boolean` 之后加:
```ts
  /** 在工具栏下方显示「已生效条件」chips(点击重开该列面板、× 删一条、行末清除 / 恢复默认);默认 false。 */
  filterChips?: boolean
```
`src/labels.ts`:`defaultLabels` 末尾加 `filterClearAll: 'Clear all',` 与 `filterRestoreDefault: 'Restore defaults',`;`zhCNLabels` 末尾加 `filterClearAll: '清除全部',` 与 `filterRestoreDefault: '恢复默认',`。

Create `src/FilterChips.vue`:
```vue
<script setup lang="ts">
// 已生效条件 chips 行:NTag,超过一行折成「+N」(点它在气泡里展开完整列表);行末「清除全部 / 恢复默认」。
// 折叠个数靠测量:先把全部 chip 渲染出来量 offsetTop(同一帧内完成,不会闪),再按 countFitting 决定显示几个;
// 「+N」渲染出来后自己也占位,若它折到了第二行就再让出一个位置(shrinkForMore),直到稳定;
// 容器宽度变了再量一次(只在宽度变化时重量,否则测量时行高变化会触发死循环)。
// 键盘:chip 是 role="button" tabindex="0",Enter / Space 等同点击;「孤儿」chip(列已不存在)没有面板可开,点击是空操作,× 照常清除。
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type PropType } from 'vue'
import { NButton, NPopover, NTag } from 'naive-ui'
import type { SmartTableLabels } from './types'
import { countFitting, shrinkForMore, type ChipItem } from './filterChips'

const props = defineProps({
  items: { type: Array as PropType<ChipItem[]>, required: true },
  labels: { type: Object as PropType<Required<SmartTableLabels>>, required: true },
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

function openChip(c: ChipItem) {
  if (!c.orphan) emit('open', c.key)
}
function onChipKeydown(e: KeyboardEvent, c: ChipItem) {
  // 只处理 chip 自己收到的按键:× 上的 Enter / Space 不能被当成「打开面板」
  if (e.target !== e.currentTarget) return
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    openChip(c)
  }
}

async function recompute() {
  measuring.value = true
  await nextTick()
  const chips = Array.from(listRef.value?.children ?? []).filter((el): el is HTMLElement =>
    el.classList.contains('smart-table-chip'),
  )
  let n = chips.length ? countFitting(chips.map((el) => el.offsetTop)) : props.items.length
  visible.value = n
  measuring.value = false
  // 「+N」自己也占位:它折到了第二行就再让出一个位置,直到放得下;让到 0 = 只显示 +N(F10)
  while (n > 0 && n < props.items.length) {
    await nextTick()
    const more = listRef.value?.querySelector<HTMLElement>('.smart-table-chip--more')
    const first = listRef.value?.querySelector<HTMLElement>('.smart-table-chip:not(.smart-table-chip--more)')
    if (!more || !first) break
    const next = shrinkForMore(n, first.offsetTop, more.offsetTop)
    if (next === n) break
    n = next
    visible.value = n
  }
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
        :class="{ 'smart-table-chip--orphan': c.orphan }"
        role="button"
        tabindex="0"
        round
        closable
        size="small"
        @click="openChip(c)"
        @keydown="(e: KeyboardEvent) => onChipKeydown(e, c)"
        @close="emit('remove', c.key, c.index)"
      >
        {{ c.text }}
      </n-tag>
      <n-popover v-if="hidden.length" trigger="click" placement="bottom-start">
        <template #trigger>
          <n-tag class="smart-table-chip smart-table-chip--more" role="button" tabindex="0" round size="small">
            +{{ hidden.length }}
          </n-tag>
        </template>
        <div class="smart-table-chips__more">
          <n-tag
            v-for="c in hidden"
            :key="c.key + ':' + c.index"
            :class="{ 'smart-table-chip--orphan': c.orphan }"
            role="button"
            tabindex="0"
            round
            closable
            size="small"
            @click="openChip(c)"
            @keydown="(e: KeyboardEvent) => onChipKeydown(e, c)"
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
/* 孤儿 chip 没有面板可开:光标不给「可点」的暗示 */
.smart-table-chip--orphan {
  cursor: default;
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
  ] as SmartTableColumn<unknown>[]
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
    const withDefault = [{ key: 'name', title: '姓名', filter: { defaultValue: value('contains', 'seed') } }] as SmartTableColumn<unknown>[]
    const wrapper = mount(SmartTable, { props: { columns: withDefault, data: rows, rowKey: 'id', filterChips: true } })
    inst(wrapper).setFilter('name', value('contains', 'changed'))
    await nextTick()
    const btn = wrapper.find('.smart-table-chips__clear')
    expect(btn.text()).toBe('Restore defaults')
    await btn.trigger('click')
    expect(inst(wrapper).filters.name).toEqual(value('contains', 'seed'))
    wrapper.unmount()
  })

  it('[Q-7] 列声明里已不存在的过滤键(孤儿):chip 仍显示,标题回退成键;点击不报错;× 能清掉', async () => {
    const wrapper = mount(SmartTable, { props: { columns: cols, data: rows, rowKey: 'id', filterChips: true } })
    inst(wrapper).setFilter('ghost', value('equal', 'x'))
    await nextTick()
    const chips = wrapper.findComponent(FilterChips)
    expect(chips.findAll('.smart-table-chip').map((c) => c.text())).toEqual(['ghost Equals x'])
    await expect(chips.find('.smart-table-chip').trigger('click')).resolves.toBeUndefined() // 没有面板可开,空操作
    chips.findAllComponents(NTag)[0].vm.$emit('close')
    await nextTick()
    expect(inst(wrapper).filters).toEqual({})
    wrapper.unmount()
  })

  it('[Q-7] 孤儿键仍会进远程请求参数 —— 所以它必须看得见,「清除全部」也要渲染并能清掉它', async () => {
    const fetcher = vi.fn(async (_p: Record<string, unknown>) => ({ items: rows, total: 2 }))
    const wrapper = mount(SmartTable, { props: { columns: cols, fetcher, rowKey: 'id', filterChips: true } })
    await flushPromises()
    inst(wrapper).setFilter('ghost', value('equal', 'x'))
    await flushPromises()
    expect(JSON.stringify(fetcher.mock.calls.at(-1)![0])).toContain('ghost')
    const btn = wrapper.find('.smart-table-chips__clear')
    expect(btn.exists()).toBe(true)
    await btn.trigger('click')
    await flushPromises()
    expect(JSON.stringify(fetcher.mock.calls.at(-1)![0])).not.toContain('ghost')
    wrapper.unmount()
  })

  it('[Q-7] chips 可键盘操作:role=button、tabindex=0;Enter 等同点击(打开对应列的面板)', async () => {
    const wrapper = mount(SmartTable, {
      props: { columns: cols, data: rows, rowKey: 'id', filterChips: true },
      attachTo: document.body,
    })
    inst(wrapper).setFilter('name', value('contains', 'a'))
    await nextTick()
    const chip = wrapper.find('.smart-table-chip')
    expect(chip.attributes('role')).toBe('button')
    expect(chip.attributes('tabindex')).toBe('0')
    await chip.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(document.body.querySelector('.smart-table-filter')).not.toBeNull()
    wrapper.unmount()
  })

  it('[Review Focus 5] 指向已隐藏的列:chip 仍显示、点击不报错、× 仍能清掉那个条件', async () => {
    const hiddenCols = [{ key: 'name', title: '姓名', filter: true, hide: true }, { key: 'dept', title: '部门' }] as SmartTableColumn<unknown>[]
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
Expected: `8 failed | 1 passed`(chips 这一组,实测)—— 都是 `Cannot call … on an empty VueWrapper / DOMWrapper`(`SmartTable` 还没接线,页面上根本没有 chips;「默认不显示」那条本来就是绿的);孤儿键那条的 `expected false to be true` 是「清除全部」按钮不存在。其余已有用例不受影响。

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

/** 字典列的 chip 显示 label 而不是 value;孤儿键(没有列声明,def 为 undefined)没有字典,按原值显示。 */
function optionLabelOf(def: FilterDef | undefined, value: unknown): string {
  if (!def) return String(value ?? '')
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
Expected: `Test Files  17 passed (17)`、`Tests  302 passed (302)`(281 + 21:`filterChips.test.ts` 12 条、`SmartTable.test.ts` 9 条);typecheck 无输出;无 `[Vue warn]`。排错:「点击 chip → openRequest」用例若失败,检查 `renderColumnFilter` 是在列标题的渲染函数里被调用的(`useColumns.toNaive` 的 `title` 闭包),所以读 `openTick[def.key]` 会被 NDataTable 的渲染收集为依赖;`openTick` 必须是 `reactive`。

- [ ] **Step 10: 浏览器验证(折叠个数只能在真实布局里看)**

Run: `node_modules/.bin/vite --port 5173`,在 playground 的「过滤」示例里给 `<SmartTable>` 加 `filter-chips`(临时改动,验证完 `git checkout playground`),给多个列加条件。确认并记录:
1. 条件少时 chips 在一行内;条件多到一行放不下时,出现 `+N`,点它气泡里列出其余 chip;
2. 缩放窗口变窄,`N` 随之变大(ResizeObserver 生效);
3. 点某个 chip,该列的过滤面板弹出;× 删一条后表格数据随之更新;
4. **`+N` 不折行(Q-7)**:窗口逐步拖窄 / 拖宽(每档停一下),`+N` 始终和第一行的 chip 在同一行,不会单独掉到第二行。**再拖到极窄(约 200px 以下,「首个 chip + `+N`」放不下)时只显示 `+N`(全部 chip 进气泡),仍是单行、`+N` 在第一行**(F10);
5. Tab 能走到每个 chip,按 Enter 打开对应列的面板(× 按钮上按 Enter 是删除,不会打开面板)。
Expected: 五条成立。结束后 `git checkout playground` 还原临时改动,关掉 vite。

- [ ] **Step 11: 提交**

```bash
git add src/filterChips.ts src/FilterChips.vue src/types.ts src/labels.ts src/SmartTable.vue tests/filterChips.test.ts tests/SmartTable.test.ts
git commit -m "feat: 新增 filterChips:已生效条件 chips(点击重开面板、× 删一条、+N 折叠、清除全部/恢复默认)" -m "纯新增,默认关闭(filterChips 缺省 false);模式 2 默认开随 P1 发布(B10)。" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: 拖过列宽后的余量 —— 吸收列(B8,E1 的 `dk` 方案),取代占位列;带图标列的拖拽下限(B12)

> 规格 §1 B8/B12、§5.6;设计文档 3.11 与 9.3 / 9.6(真实 `NDataTable` 验证,spike S1 = `docs/spike/s5`)。
>
> **为什么原稿方案(「吸收列不写宽度 + `scroll-x` = 各列下限之和」)要重写**:S1 在真实 `NDataTable` 上实测,它在「拖的正好是吸收列往窄拖」「某列先被拖过后来成为吸收列」两种情形失效。根因(`node_modules/naive-ui/es/data-table/src/**`):Naive 把拖过的列记进内部的 `resizableWidthsRef`(`use-resizable.mjs:5-16`),此后这一列的 `<col>` 的 width / min / max 三个值**全取拖拽值**,不看我们传的 `column.width`、也不看 `column.resizable` 现在是什么(`use-group-header.mjs:24`、`utils.mjs:38-43`);`clearResizableWidth` 只通过 `provide` 注入给子组件、**不在 `exposedMethods` 里**(`DataTable.mjs:269-287`)—— 宿主 / 库**没有清除入口,唯一办法是重挂**。于是所有列都有了宽度,表宽 = `max(100%, scroll-x)` 的多余部分被按比例摊给所有列 —— 正是 2.1.1 补占位列要解决的问题。规格 §5.6 的字面方案(吸收列也冻结成当前渲染宽)更糟:那个渲染宽是 Naive 未钉住时按比例摊出来的,成了下限,**最普通的「拖非吸收列」就溢出 61px**。候选 (a)(b)(c) 单独用都过不了全部情形,(c)「钉住后吸收列 `resizable:false`」还让「第一次拖的正好是吸收列」更糟(首帧后把手被卸载、拖拽中断)。
>
> **定稿方案 = S1 的 `dk`**(E1):
> - **吸收列** = 最后一个**可见、非 fixed、`resizable !== false`** 的叶子数据列;没有(全部 fixed / 全部不可拖)→ 退路:最后一个叶子列,写显式宽度 `max(下限, 容器宽 − 其余列宽 − 拖拽增量)`,**同样不冻结**。宿主给「操作」列写 `resizable: false` 即退出吸收(不需要新 API);`fixed: 'right'` 的操作列天然不参与。
> - 钉住后吸收列**不写 width**(弹性),下限取声明宽 / `minWidth`(**不冻结成实测宽**);`freezeWidths` 跳过它;`scroll-x` = Σ其余列宽 + 吸收列下限 + `dragDelta`,始终 ≥ 各列下限之和(官方在 `scroll-x` 小于容器宽且所有列都有宽度时会把各列按比例拉伸)。表头 DOM 里**不再有占位列**,列数恒等于声明的列数。
> - **吸收列永远传 `resizable: false`**(含还没钉住时)—— 所以**吸收余量的那一列没有拖拽把手**(设计 3.11 原预期「最后一列仍有把手」被推翻;要调它旁边的边界就拖它左邻列的把手;**用户可推翻**,备选 `da`:吸收列拖拽结束即重挂,最终结果也对,但向左拖时其余列临时被拉宽 16–43px、松手后横向 `scrollLeft` 跳回 0,已被否决)。
> - **选择性重挂**:`SmartTable` 记下本次挂载期间拖过的列(`draggedKeys`);「拖过的列」后来成为吸收列(隐藏最后一列 / 调顺序 / 设固定)时 `tableKey++`;`tableKey` 变化(含已有的「恢复默认」)时清空记录。从存储恢复的宽度不会在 Naive 里留残留,不需要重挂。
> - 叠加官方 `flex-height` + `virtual-scroll`(Task 12b 的 `fillHeight`)时逐项结论相同(S1 已测)。
> - CHANGELOG B8 的「已知代价」:**吸收余量的那一列没有拖拽把手**;回退 = 给列写 `resizable: false`(让它不参与吸收,吸收列顺延到前一列)。
>
> **B12**:可拖拽列的拖拽下限,对**带图标的列**取 `max(resizeMinWidth, 图标簇所需最小宽)`:仅排序 `12+44+21+16 = 93`、仅过滤 `12+44+30+16 = 102`、两者 `123`;其它列仍是 `resizeMinWidth`;列上显式写了 `minWidth` 的不覆盖。吸收列没有把手,不补这个下限。
>
> **本任务不做**(规格 B12 后半):表头 `th` 改 `overflow:visible` + 递减 `z-index`、把手骑在列界线上,以及把手高度 70%、热区 11px / 触屏 24px、拖动引导线、松手 150ms 吞 click、拖动开始收起气泡 —— 纯视觉打磨,要在带 `fixed` 列的表上逐列核对层叠,**推到 P1 的视觉任务**。现有把手样式(`right:0`、悬停才显形)保持不变。
>
> **未测项(S1)**:多级表头(`children`)下的吸收列(只按叶子列选)、勾选 / 序号 / 展开特殊列与吸收列的联动(沿用 2.1.1 对特殊列的冻结)、触屏拖拽、`minWidth` 夹紧与吸收列下限同时生效的边界、宿主传 `scroll-x` / `table-layout` 覆盖时的行为(与 2.1.1 一样让位)。

**Files:**
- Modify: `src/useColumns.ts`、`src/SmartTable.vue`
- Create: `playground/DemoAbsorb.vue`(场景页)、Modify: `playground/App.vue`(加页签)
- Test: `tests/useColumns.test.ts`(改 4 条、**有意翻转 1 条(P-2)**、**有意改 1 条的夹具(Step 1 第 7 点)**、删 1 个 describe、追加)、`tests/SmartTable.test.ts`(替换 1 个 describe)

**Interfaces:**
- Consumes: Task 4 的 `sortState` 数组形态(不影响本任务);Task 5 的 `defaultDensity` getter。
- Produces:
  - `useColumns` 选项新增 `hostWidth?: () => number`(容器可见宽,仅退路用)、`dragDelta?: () => number`(拖拽中的临时增量,仅退路用);返回值新增 `absorberKey: ComputedRef<string | null>`;
  - `useColumns.ts` 导出 `headerIconFloor(hasFilter: boolean, hasSorter: boolean): number`;
  - **删除导出** `FILLER_COLUMN_KEY`、`withFillerColumn`(只被 `SmartTable.vue` 与测试使用,`index.ts` 从未导出过它们);
  - `SmartTable.vue`:删除 `fillerWidth` / `displayColumns`,`scroll-x` = `columnsApi.scrollX + dragDelta`;新增 `draggedKeys`。

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
    dragDelta?: () => number
  },
```
并在 `opts` 里加 `hostWidth: extra?.hostWidth,` 与 `dragDelta: extra?.dragDelta,`。
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
5. 在 `describe('useColumns 列宽拖拽', …)` 内(`列被移除后…` 用例之前)追加新用例(E1 的 `dk` 规则;「吸收列」即钉住后吸收余量的那一列):
```ts
  describe('吸收余量的列(B8,E1 / S1 的 dk 方案)', () => {
    const three = (): SmartTableColumn<Row>[] => [
      { key: 'name', title: 'N', width: 200 },
      { key: 'amt', title: 'A', width: 100 },
      { key: 'op', title: 'Op', width: 80, fixed: 'right' },
    ]
    const resizable = { resizable: () => true }

    it('吸收列 = 最后一个可见、非固定的叶子列:freezeWidths 跳过它(不冻结成实测宽);钉住后它不写 width,下限(声明宽)计入 scrollX', () => {
      const api = build(three(), undefined, {}, undefined, resizable)
      api.freezeWidths((k) => ({ name: 210, amt: 150, op: 80 })[k])
      expect(api.widths.value).toEqual({ name: 210, op: 80 }) // amt 没被冻结:冻结成 Naive 摊出来的实测宽会让它成为下限,拖别的列时它不肯缩(S1 实测溢出 61px)
      expect('width' in col(api, 'amt')).toBe(false) // 声明的 width:100 也被摘掉,交给浏览器弹性分配
      expect(col(api, 'name').width).toBe(210)
      expect(col(api, 'op').width).toBe(80)
      expect(api.absorberKey.value).toBe('amt')
      expect(api.scrollX.value).toBe(210 + 100 + 80) // 吸收列下限 = 声明宽 100
    })

    it('吸收列永远传 resizable:false(含还没钉住时):它没有拖拽把手,其它列照旧', () => {
      const api = build(three(), undefined, {}, undefined, resizable)
      expect(col(api, 'amt').resizable).toBe(false)
      expect(col(api, 'name').resizable).toBe(true)
      // 没钉住:吸收列照 2.1.1 写声明宽(Naive 自己按 width:100% 摊余量)
      expect(col(api, 'amt').width).toBe(100)
    })

    it('列上写 resizable: false 的列不参与吸收:未 fixed 的操作列被跳过,吸收列顺延到前一列(回退入口,S1 ⑦)', () => {
      const api = build(
        [
          { key: 'name', title: 'N', width: 200 },
          { key: 'amt', title: 'A', width: 100 },
          { key: 'op', title: 'Op', width: 80, resizable: false },
        ],
        undefined,
        {},
        undefined,
        resizable,
      )
      expect(api.absorberKey.value).toBe('amt')
      api.freezeWidths((k) => ({ name: 210, amt: 150, op: 80 })[k])
      expect(api.widths.value).toEqual({ name: 210, op: 80 }) // op 当普通列冻结,不参与吸收
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
      expect(api.absorberKey.value).toBe('c')
      api.toggleShow('c', false)
      expect(api.absorberKey.value).toBe('b')
      api.freezeWidths(() => 100)
      expect(api.widths.value).toEqual({ a: 100 }) // b 现在是最后一个可见列 → 吸收列,不钉
      expect('width' in col(api, 'b')).toBe(false)
    })

    it('[Review Focus 4] 只有一列:它就是吸收列,freezeWidths 不钉它,表格不进入钉住态', () => {
      const api = build([{ key: 'name', title: 'N' }], undefined, {}, undefined, resizable)
      api.freezeWidths(() => 300)
      expect(api.widths.value).toEqual({})
      expect(api.pinned.value).toBe(false)
    })

    it('吸收列的陈旧宽度(上次会话存下的 / 调顺序后才成为吸收列的)只当下限:仍不写 width', () => {
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

    describe('退路:没有可拖的非固定列时,最后一个叶子列写显式宽度', () => {
      it('[Review Focus 4] 全部列都 fixed:显式宽 = max(下限, 容器宽 − 其余列宽 − 拖拽增量),且不冻结它', () => {
        const delta = ref(0) // 要是响应式的:useColumns 里的 naiveColumns 是 computed,普通变量变了它不会重算
        const api = build(
          [
            { key: 'a', title: 'A', width: 200, fixed: 'left' },
            { key: 'b', title: 'B', width: 200, fixed: 'right' },
          ],
          undefined,
          {},
          undefined,
          { ...resizable, hostWidth: () => 900, dragDelta: () => delta.value },
        )
        expect(api.absorberKey.value).toBe('b')
        api.freezeWidths((k) => ({ a: 200, b: 200 })[k])
        expect(api.widths.value).toEqual({ a: 200 }) // b 不冻结
        expect(col(api, 'b').width).toBe(700) // 900 − a(200)
        expect(api.scrollX.value).toBe(900)
        delta.value = 50 // 拖拽进行中,a 被拖宽了 50:SmartTable 会把 dragDelta 加进 scroll-x,吸收列让出这 50
        expect(col(api, 'b').width).toBe(650)
        delta.value = 0
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

      it('全部非固定列都写了 resizable: false(没有可拖的非固定列):同样走退路,取最后一个叶子列', () => {
        const api = build(
          [
            { key: 'c', title: 'C', width: 200, fixed: 'left' },
            { key: 'a', title: 'A', width: 200, resizable: false },
            { key: 'b', title: 'B', width: 200, resizable: false },
          ],
          undefined,
          {},
          undefined,
          { ...resizable, hostWidth: () => 1000 },
        )
        api.freezeWidths(() => 200)
        expect(api.absorberKey.value).toBe('b')
        expect(api.widths.value).toEqual({ c: 200, a: 200 }) // b 不冻结
        expect(col(api, 'b').width).toBe(600) // 1000 − c(200) − a(200)
      })
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

6. **有意翻转(P-2)**:`describe('useColumns 列宽拖拽')` 最后一条「列被移除后,widths 里对应的旧宽度也跟着清掉,不会被新声明的同名列悄悄继承」的**最后一行断言**会失败(`expected undefined to be 100`):`amt` 是最后一个非 fixed 可拖的列 = 吸收列,钉住后**不写 width**。这条用例的本意是锁「陈旧宽度 240 不被新同名列继承」,新机制下改成 —— 把
```ts
    expect(col(api, 'amt').width).toBe(100) // 走的是列自己声明的 width,不是残留的 240
```
   替换为:
```ts
    // 有意翻转(P-2):amt 现在是吸收列,钉住后不写 width;要锁的是它没继承陈旧的 240 —— 下限是它自己声明的 100
    expect('width' in col(api, 'amt')).toBe(false)
    expect(col(api, 'name').width).toBe(260)
    expect(api.scrollX.value).toBe(260 + 100)
```
   (提交说明里写明这是有意翻转的断言。)

7. **有意修改一条已有用例的夹具**:`describe('useColumns 列宽拖拽')` 里「表级 resizable 下放到数据列,列上显式值优先」用 `name` + `amt(resizable: false)` 两列:E1 之后 `amt` 不参与吸收,`name` 成了**唯一的可拖非固定列 = 吸收列**,按规则它没有把手(`resizable` 为 `false`),原断言 `expect(col(api, 'name').resizable).toBe(true)` 会失败。这条用例要锁的是「表级开关下放、列上显式值优先」,所以给夹具加一个中间列,原有的两条断言原样保留:
```ts
  it('表级 resizable 下放到数据列,列上显式值优先', () => {
    const api = build(
      [
        { key: 'name', title: 'N' },
        { key: 'mid', title: 'M' }, // E1:最后一个可拖的非固定列是吸收列(没有把手),夹具里补一个它,name 才仍是普通可拖列
        { key: 'amt', title: 'A', resizable: false },
      ],
      undefined,
      {},
      undefined,
      { resizable: () => true },
    )
    expect(col(api, 'name').resizable).toBe(true)
    expect(col(api, 'amt').resizable).toBe(false)
    expect(col(api, 'mid').resizable).toBe(false) // 吸收列
  })
```
   (提交说明里写明。)

- [ ] **Step 2: 改 / 写测试 —— `SmartTable`(整个 describe 替换)**

`tests/SmartTable.test.ts`:删掉顶部的 `import { FILLER_COLUMN_KEY } from '../src/useColumns'`;把整个 `describe('SmartTable 列宽钉住后填满容器', …)`(4 条用例)替换为(泛型写 `SmartTableColumn<unknown>[]`,原因同 Task 4 Step 7):
```ts
describe('SmartTable 列宽钉住后由吸收列吸收余量(B8,取代占位列;E1)', () => {
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

  type Col = { key: string; width?: number; resizable?: boolean }

  /** 走一遍真实拖拽:Naive 拖动中持续回调,松手落账,此后列宽进入钉住态。 */
  function drag(wrapper: ReturnType<typeof mount>, key: string, to: number, actual: Record<string, number>) {
    const resize = wrapper.findComponent(NDataTable).props('onUnstableColumnResize') as (...a: unknown[]) => void
    resize(to, to, { key }, (k: string) => actual[k])
  }
  function release() {
    window.dispatchEvent(new MouseEvent('mouseup'))
  }

  const three = (): SmartTableColumn<unknown>[] => [
    { key: 'a', title: 'A', width: 200, resizable: true },
    { key: 'b', title: 'B', width: 200, resizable: true },
    { key: 'op', title: 'Op', width: 200, fixed: 'right' },
  ]

  it('拖非吸收列(a)后:没有占位列;吸收列(b)不写 width 且没有把手;scroll-x = 已钉列 + 吸收列下限', async () => {
    const wrapper = mountWithHostWidth(three())
    const dataTable = wrapper.findComponent(NDataTable)
    drag(wrapper, 'a', 120, { a: 200, b: 200, op: 200 })
    release()
    emitResizeObserver()
    await nextTick()

    const columns = dataTable.props('columns') as Col[]
    expect(columns.map((c) => c.key)).toEqual(['a', 'b', 'op']) // 列数恒等于声明的列数
    expect(columns[0].width).toBe(120)
    expect(columns[1].width).toBeUndefined() // 吸收列:弹性,浏览器把剩余宽度给它
    expect(columns[1].resizable).toBe(false) // 永远没有把手(Naive 内部拖拽宽度无法清除,所以吸收列不能是拖过的列)
    expect(columns[2].width).toBe(200)
    expect(dataTable.props('scrollX')).toBe(120 + 200 + 200) // 120(拖出来)+ 吸收列下限 200(声明宽)+ op 200

    wrapper.unmount()
    vi.unstubAllGlobals()
  })

  it('已钉住的表格,拖拽进行中(松手之前)scroll-x 跟着被拖的列同步,不必每帧重建列', async () => {
    const wrapper = mountWithHostWidth(three())
    const dataTable = wrapper.findComponent(NDataTable)
    drag(wrapper, 'a', 120, { a: 200, b: 200, op: 200 })
    release()
    emitResizeObserver()
    await nextTick()

    // 再次拖拽 a,但还没有松手
    drag(wrapper, 'a', 200, { a: 120, b: 200, op: 200 })
    await nextTick()
    expect(dataTable.props('scrollX')).toBe(120 + 200 + 200 + (200 - 120)) // 已钉列 + 吸收列下限 + 拖拽增量

    wrapper.unmount()
    vi.unstubAllGlobals()
  })

  it('没拖过列宽(未钉住)时不动列:拉伸交给 Naive 自己的 width:100%(吸收列仍不可拖)', async () => {
    const wrapper = mountWithHostWidth(three())
    emitResizeObserver()
    await nextTick()

    const dataTable = wrapper.findComponent(NDataTable)
    const columns = dataTable.props('columns') as Col[]
    expect(columns.map((c) => c.key)).toEqual(['a', 'b', 'op'])
    expect(columns[0].width).toBe(200)
    expect(columns[1].width).toBe(200)
    expect(columns[1].resizable).toBe(false)
    expect(dataTable.props('scrollX')).toBe(600)

    wrapper.unmount()
    vi.unstubAllGlobals()
  })

  it('列宽之和超过容器时照旧横向滚动', async () => {
    const wrapper = mountWithHostWidth([
      { key: 'a', title: 'A', width: 800, resizable: true },
      { key: 'b', title: 'B', width: 400, resizable: true },
      { key: 'op', title: 'Op', width: 300, fixed: 'right' },
    ])
    const dataTable = wrapper.findComponent(NDataTable)
    drag(wrapper, 'a', 800, { a: 800, b: 400, op: 300 })
    release()
    emitResizeObserver()
    await nextTick()
    expect(dataTable.props('scrollX')).toBe(800 + 400 + 300)

    wrapper.unmount()
    vi.unstubAllGlobals()
  })

  it('[Review Focus 4] 全部列都 fixed:最后一列写显式宽度吃掉余量(容器宽由 ResizeObserver 量到),拖别的列时它让得出来', async () => {
    const wrapper = mountWithHostWidth([
      { key: 'a', title: 'A', width: 200, fixed: 'left', resizable: true },
      { key: 'b', title: 'B', width: 200, fixed: 'right' },
    ])
    const dataTable = wrapper.findComponent(NDataTable)
    drag(wrapper, 'a', 120, { a: 200, b: 200 })
    release()
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

  describe('拖过的列后来成为吸收列 → 重挂(tableKey++),清掉 Naive 内部的拖拽宽度', () => {
    const four = (): SmartTableColumn<unknown>[] => [
      { key: 'a', title: 'A', width: 150, resizable: true },
      { key: 'b', title: 'B', width: 150, resizable: true },
      { key: 'c', title: 'C', width: 150, resizable: true },
      { key: 'd', title: 'D', width: 150, resizable: true },
    ]
    const uid = (w: ReturnType<typeof mount>) => w.findComponent(NDataTable).vm.$.uid
    const actual = { a: 250, b: 250, c: 250, d: 250 }

    it('先拖 c(非吸收列),再隐藏 d → c 成为吸收列 → NDataTable 被重挂;c 现在不写 width', async () => {
      const wrapper = mountWithHostWidth(four())
      drag(wrapper, 'c', 290, actual)
      release()
      emitResizeObserver()
      await nextTick()
      const before = uid(wrapper)

      wrapper.findComponent(ColumnSettings).vm.$emit('toggle', 'd', false)
      await flushPromises()
      expect(uid(wrapper)).not.toBe(before) // 重挂了
      const columns = wrapper.findComponent(NDataTable).props('columns') as Col[]
      expect(columns.map((c) => c.key)).toEqual(['a', 'b', 'c'])
      expect(columns[2].width).toBeUndefined()
      expect(columns[2].resizable).toBe(false)

      wrapper.unmount()
      vi.unstubAllGlobals()
    })

    it('新吸收列在本次挂载期间没被拖过(只拖了 a,再隐藏 d → c 成吸收列)→ 不重挂', async () => {
      const wrapper = mountWithHostWidth(four())
      drag(wrapper, 'a', 210, actual)
      release()
      emitResizeObserver()
      await nextTick()
      const before = uid(wrapper)

      wrapper.findComponent(ColumnSettings).vm.$emit('toggle', 'd', false)
      await flushPromises()
      expect(uid(wrapper)).toBe(before)

      wrapper.unmount()
      vi.unstubAllGlobals()
    })

    it('重挂之后「拖过的列」记录清空:之后再换吸收列不会无谓地再重挂', async () => {
      const wrapper = mountWithHostWidth(four())
      drag(wrapper, 'c', 290, actual)
      release()
      emitResizeObserver()
      await nextTick()
      wrapper.findComponent(ColumnSettings).vm.$emit('toggle', 'd', false)
      await flushPromises()
      const afterFirst = uid(wrapper)

      wrapper.findComponent(ColumnSettings).vm.$emit('toggle', 'd', true) // d 回来,c 退出吸收 —— d 从没被拖过
      await flushPromises()
      expect(uid(wrapper)).toBe(afterFirst)
      wrapper.findComponent(ColumnSettings).vm.$emit('toggle', 'd', false) // d 再隐藏,c 再次成为吸收列:c 是重挂之前拖过的,记录已清空 → 不再重挂
      await flushPromises()
      expect(uid(wrapper)).toBe(afterFirst)

      wrapper.unmount()
      vi.unstubAllGlobals()
    })
  })
})
```

- [ ] **Step 3: 跑,确认失败**

Run: `npx vitest run tests/useColumns.test.ts tests/SmartTable.test.ts`
Expected(实测):`Test Files  2 failed (2)`、`Tests  21 failed | 84 passed (105)`。(typecheck 此时也会报 `headerIconFloor` 未导出、`absorberKey` 不存在 —— 预期内。)

- [ ] **Step 4: 实现 —— `useColumns.ts`**

1. 在文件顶部 `export function isSpecialColumn…` 之前加:
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
  /** 表格容器的可见宽度(仅「没有可拖的非固定列」的退路用来算吸收列的显式宽度)。 */
  hostWidth?: () => number
  /** 拖拽进行中的临时增量(SmartTable 维护,松手清零);退路里吸收列要让出这部分。 */
  dragDelta?: () => number
```
   `UseColumnsReturn` 里 `scrollX: ComputedRef<number>` 之后加 `/** 当前吸收余量的列的 key(没有可见列时 null);SmartTable 据此在它变成「拖过的列」时重挂。 */ absorberKey: ComputedRef<string | null>`。
3. 把 `leafWidth` 整个函数(及其上方注释)替换为下面这段(注意 `orderedVisibleData` 在函数体更靠后定义,这些 computed 只在求值时才读它,不会触发 TDZ):
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
   * 拖过列宽后吸收余量的列(B8,E1 / spike S1 的 dk 方案):最后一个**可见、非固定、`resizable !== false`** 的叶子数据列。
   * elastic = true:钉住后**不写 width**,由 table-layout:fixed 把剩余宽度自然分给它;它的「钉住宽度」只是下限。
   * 没有这样的列(全部 fixed / 全部不可拖)→ 退路:最后一个叶子列,写显式宽度(elastic = false)。
   * 宿主给「操作」列写 `resizable: false` 就退出吸收(吸收列顺延到前一列);fixed: 'right' 的操作列天然不参与。
   */
  const absorber = computed<{ key: string; elastic: boolean } | null>(() => {
    const leaves = visibleLeaves.value
    if (leaves.length === 0) return null
    for (let i = leaves.length - 1; i >= 0; i--) {
      if (!leaves[i].fixed && leaves[i].col.resizable !== false) return { key: leaves[i].col.key, elastic: true }
    }
    return { key: leaves[leaves.length - 1].col.key, elastic: false }
  })
  const absorberKey = computed(() => absorber.value?.key ?? null)

  /** 一列的宽度下限:拖出来 / 存储里的宽度 ?? 声明宽 ?? minWidth ?? 兜底宽。吸收列**不冻结成实测宽**,否则它成了下限,拖别的列时不肯缩(实测溢出 61px)。 */
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
   * 退路 → 写显式宽度 max(下限, 容器宽 − 其余列宽之和 − 拖拽增量)。
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
      return Math.max(floorWidth(col), Math.round((opts.hostWidth?.() ?? 0) - others - (opts.dragDelta?.() ?? 0)))
    }
    return rawLeafWidth(col, fixed)
  }
```
4. `freezeWidths` 里 `walk` 函数的循环体,在 `if (next[col.key] !== undefined) continue` 之前加一行(`specialCols` 那个循环不动):
```ts
        // 吸收列不钉(B8):它是弹性的;退路里的吸收列也不能冻结成实测宽,否则拖别的列时它不肯缩
        if (col.key === absorber.value?.key) continue
```
   并把 `freezeWidths` 函数上方注释里的第一句补上「吸收列(最后一个可见、非固定、可拖的列)除外」。
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
    const resizable = naiveRest.resizable ?? opts.resizable?.() ?? false
    result.resizable = resizable
```
   以及紧随其后的 `minWidth` 那段 `if (resizable && result.minWidth === undefined) result.minWidth = d.resizeMinWidth`(注释照留)整段替换为:
```ts
    const resizable = naiveRest.resizable ?? opts.resizable?.() ?? false
    // 吸收列永远没有拖拽把手(E1):Naive 把拖过的列记进内部 resizableWidthsRef,此后这一列的 <col> 宽度只认拖拽值、
    // 不看我们传的 width,也没有清除入口 —— 弹性的吸收列一旦被拖过就再也弹性不起来。所以吸收列始终 resizable:false
    // (必须始终,不能只在钉住态:第一次拖就拖吸收列时,freezeWidths 使表格进入钉住态,同一帧里把手被卸载、拖拽被中断)
    const draggable = resizable && absorber.value?.key !== key
    result.resizable = draggable
    // 没有下限时能被拖成 0 宽,列头直接消失且拖不回来
    // 带图标的列取 max(resizeMinWidth, 图标下限),免得图标被挤出格子(B12);列上显式写了 minWidth 的不覆盖
    if (draggable && result.minWidth === undefined) {
      const hasSorter = naiveRest.sorter != null && (naiveRest.sorter as unknown) !== false
      result.minWidth = Math.max(d.resizeMinWidth, headerIconFloor(!!filterDef, hasSorter))
    }
```
   (`filterDef` 在 `toNaive` 里更靠前已经声明。)
6. `scrollX` 的计算整个替换为:
```ts
  /** auto scrollX = 特殊列宽度 + Σ可见叶子列(最终宽度 ?? 下限);吸收列按它的下限(退路则按显式宽度)计入,保证 scroll-x 始终 ≥ 各列下限之和。 */
  const scrollX = computed(() => {
    let sum = 0
    for (const col of specialCols.value) sum += specialWidth(col)
    for (const { col, fixed } of visibleLeaves.value) sum += leafWidth(col, fixed) ?? floorWidth(col)
    return sum
  })
```
   并在 `return { … scrollX, }` 里加上 `absorberKey,`。
7. **删除**文件末尾的 `FILLER_COLUMN_KEY` 与 `withFillerColumn`(从 `/** 占位列的 key…` 注释到文件末尾)(`DataTableBaseColumn` 在 `toNaive` 里还有别处在用,`naive-ui` 的 import 保持原样)。

- [ ] **Step 5: 实现 —— `SmartTable.vue`**

1. 删除 `withFillerColumn,` 的 import。
2. 把 `const hostWidth = ref(0)`(连同上方注释)与 `const dragDelta = ref(0)`(连同上方那段「拖拽过程中的临时增量」注释)**移到** `const columnsApi = useColumns<T>({...})` 之前(下一条要把它们传进去),并在 `useColumns` 的选项里加:
```ts
  hostWidth: () => hostWidth.value,
  dragDelta: () => dragDelta.value,
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
6. 样式里**删除**这两段:`.smart-table--pinned-cols :deep(.n-data-table-table) { width: var(--smart-table-cols-width); }`(连同上方关于占位列的注释)与 `.smart-table :deep(.smart-table-filler-col) { pointer-events: none; }`(连同注释)。
7. 「列宽钉住」态的注释块(`const colsPinned = columnsApi.pinned` 上方那段)改写为:
```ts
/**
 * 「列宽已钉住」态:拖过一次之后,除吸收列外每一列(含序号/勾选列)都有确定宽度。
 * table-layout 切 fixed —— Naive 默认是 auto,auto 下 <col> 宽度只是建议值,浏览器每次都按内容重新求解
 * 整张表,改一列所有列都会挪。最后一个可见、非固定、可拖的列(吸收列)不写宽度,fixed 布局下它自然拿到剩余宽度,
 * 所以表格既填满容器、右侧不留白,又不牵动任何一列(见 useColumns 的 absorber)。
 */
```
8. **拖过的列后来成为吸收列要重挂(E1)**。在 `const tableKey = ref(0)` 与 `onResetSettings` 之后加:
```ts
// Naive 把拖过的列记进内部的 resizableWidthsRef,此后这些列的 <col> 宽度只认拖拽值,既不看我们传的 width 也没有清除入口
// (clearResizableWidth 不在 exposedMethods 里),唯一办法是重挂。所以:记下本次挂载期间拖过的列;
// 「拖过的列」变成吸收列(隐藏最后一列 / 调顺序 / 设固定后)时 tableKey++。tableKey 变了(含「恢复默认」)新实例里没有残留,记录清空。
// 从存储恢复的宽度不会在 Naive 里留残留,不需要重挂。
const draggedKeys = new Set<string>()
watch(tableKey, () => draggedKeys.clear())
watch(
  () => columnsApi.absorberKey.value,
  (key) => {
    if (key && colsPinned.value && draggedKeys.has(key)) tableKey.value++
  },
)
```
   并在 `onColumnResize` 里、`const colKey = String(key)` 之后加一行 `draggedKeys.add(colKey)`。

- [ ] **Step 6: 跑,确认通过**

Run: `npm test && npm run typecheck`
Expected: `Test Files  17 passed (17)`、`Tests  312 passed (312)`(302 + 10);typecheck 无输出。排错:
- 若 `SmartTable.test.ts` 的「全部列都 fixed」失败:确认 `useColumns` 收到了 `hostWidth`,且 `measureHost()` 在 `emitResizeObserver()` 后把 `hostWidth.value` 更新成 900。
- 若 `useColumns` 里 `visibleLeaves` 报「`orderedVisibleData` 在声明前使用」(TS2448):说明某处在声明前**同步**读了它;`visibleLeaves` / `absorber` 本身只定义不求值,应当无此问题。
- 删掉 `withFillerColumn` 后若还有文件引用它,`grep -rn "Filler" src tests` 应为空。

- [ ] **Step 7: playground 加「列宽余量」场景页(Q-13,正式提交的示例改动,浏览器验证的前置条件)**

布局行为只能在真实浏览器里看,而 D13 要求覆盖的七种情形(拖非吸收列、吸收列没有把手、隐藏最后一列、先拖 B 再让 B 成为吸收列、全部 fixed、含 `fixed: 'right'` 操作列、未 fixed 且 `resizable: false` 的操作列)现有示例里一个都凑不出来。加一个场景页,四种列配置 × 容器宽度 × 「隐藏 / 显示最后一列」按钮:

Create `playground/DemoAbsorb.vue`:
```vue
<script setup lang="ts">
// 「拖过列宽后的余量」场景页(B8 / Task 12 的浏览器验证用):同一份静态数据,四种列配置 × 容器宽度 × 隐藏最后一列。
import { computed, ref, watch } from 'vue'
import { NButton, NRadioButton, NRadioGroup, NSpace } from 'naive-ui'
import { SmartTable, type SmartTableColumn } from '../src/index'
import { allRows, type DemoRow } from './mock'

type Scenario = 'plain' | 'allfixed' | 'fixedright' | 'opnofix'
const scenario = ref<Scenario>('plain')
const hostWidth = ref(1000)
const hideLast = ref(false)
const rows = allRows.slice(0, 30)
watch(scenario, () => (hideLast.value = false))

const columns = computed<SmartTableColumn<DemoRow>[]>(() => {
  let cols: SmartTableColumn<DemoRow>[]
  switch (scenario.value) {
    case 'allfixed': // 全部列都 fixed:吸收列走退路(最后一列写显式宽度)
      cols = [
        { key: 'account', title: 'A', width: 150, fixed: 'left', resizable: true },
        { key: 'name', title: 'B', width: 150, fixed: 'left', resizable: true },
        { key: 'email', title: 'C', width: 150, fixed: 'right' },
      ]
      break
    case 'fixedright': // 含 fixed: 'right' 的操作列:天然不参与吸收
      cols = [
        { key: 'account', title: 'A', width: 150 },
        { key: 'name', title: 'B', width: 150 },
        { key: 'email', title: 'C', width: 150 },
        { key: 'status', title: 'Op', width: 100, fixed: 'right' },
      ]
      break
    case 'opnofix': // 未 fixed 但 resizable: false 的操作列:退出吸收(宿主的回退入口)
      cols = [
        { key: 'account', title: 'A', width: 150 },
        { key: 'name', title: 'B', width: 150 },
        { key: 'email', title: 'C', width: 150 },
        { key: 'status', title: 'Op', width: 100, resizable: false },
      ]
      break
    default:
      cols = [
        { key: 'account', title: 'A', width: 150 },
        { key: 'name', title: 'B', width: 150 },
        { key: 'email', title: 'C', width: 150 },
        { key: 'deptId', title: 'D', width: 150 },
      ]
  }
  // 「隐藏最后一列」= hideInTable:吸收列的身份随之变化(与列设置里取消勾选走同一条路)
  if (hideLast.value) cols[cols.length - 1] = { ...cols[cols.length - 1], hideInTable: true } as SmartTableColumn<DemoRow>
  return cols
})
</script>

<template>
  <div>
    <n-space align="center" :size="12" style="margin-bottom: 12px">
      <n-radio-group v-model:value="scenario" size="small" data-testid="scenario">
        <n-radio-button value="plain">plain</n-radio-button>
        <n-radio-button value="allfixed">allfixed</n-radio-button>
        <n-radio-button value="fixedright">fixedright</n-radio-button>
        <n-radio-button value="opnofix">opnofix</n-radio-button>
      </n-radio-group>
      <n-radio-group v-model:value="hostWidth" size="small" data-testid="width">
        <n-radio-button :value="700">700</n-radio-button>
        <n-radio-button :value="1000">1000</n-radio-button>
      </n-radio-group>
      <n-button size="small" data-testid="hide-last" @click="hideLast = !hideLast">隐藏 / 显示最后一列</n-button>
    </n-space>
    <div :style="{ width: hostWidth + 'px' }" data-testid="host">
      <SmartTable
        :key="scenario"
        :columns="columns"
        :data="rows"
        resizable
        :pagination="false"
        :toolbar="false"
        :search="false"
        :single-line="false"
      />
    </div>
  </div>
</template>
```
`playground/App.vue`:`import DemoCrud from './DemoCrud.vue'` 之后加 `import DemoAbsorb from './DemoAbsorb.vue'`;`<n-tab-pane name="crud" …>` 之后加:
```vue
          <n-tab-pane name="absorb" tab="列宽余量"><DemoAbsorb /></n-tab-pane>
```
Run: `npm run typecheck`
Expected: 无输出。

- [ ] **Step 8: 浏览器验证(D13:布局行为只能在真实浏览器里看;测量方法取自 `docs/spike/s5`)**

Run: `node_modules/.bin/vite --port 5173`,打开 playground 的「列宽余量」页签。下面所有读数用这两个函数(在控制台定义一次;`th[data-col-key]` 是 Naive 给表头格写的):
```js
const r = (e) => e.getBoundingClientRect()
const ths = () => [...document.querySelectorAll('[data-testid="host"] thead th[data-col-key]')]
const widths = () => Object.fromEntries(ths().map((t) => [t.dataset.colKey, Math.round(r(t).width)]))
const body = () => document.querySelector('[data-testid="host"] .n-data-table-base-table-body')
const tableW = () => Math.round(r(document.querySelector('[data-testid="host"] .n-data-table-table')).width)
const hasHandle = (key) => !!ths().find((t) => t.dataset.colKey === key)?.querySelector('.n-data-table-resize-button')
```
**怎么拖**:取目标列的把手 `ths().find(t => t.dataset.colKey === 'account').querySelector('.n-data-table-resize-button')`,读它的 `r()`,在它中心按下鼠标、水平移动 Δ(分 6 步)、松开(Playwright:`mouse.move/down/move/up`)。**容器宽度**:场景页外层 `host` 宽 1000,但库有卡片(B11 的 16px 内边距 + 1px 描边,共 34px)和表格自己的 2px 描边,所以滚动容器内宽 **`body().clientWidth` = 964**(不是 998;视口 1280 宽下实测)。下表的数字是 964 下的实测值,**允许 ±1px**;真正要成立的是每条里的**关系式**(表宽 = 容器宽、被拖列 1:1 跟手、其余列不动、吸收列落到下限等)。`plain` 场景四列声明宽都是 150,未钉住时 Naive 自己摊成约 241 / 列。逐项确认并记录(**每条先切场景、刷新态再做**):
1. **① 拖非吸收列(`plain`,1000)**:拖 A `+60` → `widths()` = `{ account:301, name:241, email:241, deptId:181 }`,`tableW() === body().clientWidth`(右侧无留白、无横向滚动条),`ths().length === 4`(没有占位列)。拖拽过程中(每步读,实测每步 +10):A 宽 = 起始 + 已移动距离(±1,1:1 跟手),B / C 纹丝不动(±1),D 实时变窄,`tableW()` 始终 ≤ `body().clientWidth + 1`。再拖 B `+40` → `{ account:301, name:281, email:241, deptId:150 }`(D 落到下限 150,Σ下限 973 > 964,溢出 9px 属正常)。接着向左拖 A `−40` → `{ account:261, name:281, email:241, deptId:181 }`:D 变宽来补,B / C 不动,`tableW() === body().clientWidth`。
2. **吸收列没有把手(E1)**:`hasHandle('account') && hasHandle('name') && hasHandle('email')` 为 true,**`hasHandle('deptId')` 为 false**(不管拖没拖过,刷新后未拖过时也是 false);鼠标移到 D 的右缘光标不是 `col-resize`。
3. **③ 隐藏最后一列**:接 ①(只拖了 A `+60`)点「隐藏 / 显示最后一列」→ `{ account:301, name:241, email:422 }`,`tableW() === body().clientWidth`,`hasHandle('email') === false`(C 成了吸收列)。再点一次显示 D:回到 `{ account:301, name:241, email:241, deptId:181 }`(D 又是吸收列)。
4. **④ 先拖 C 再让它成为吸收列 → 重挂**:刷新态的 `plain`,拖 C `+40` → `{ account:241, name:241, email:281, deptId:201 }`(C 非吸收列),再点「隐藏最后一列」→ C 成吸收列:`{ account:241, name:241, email:482 }`,`tableW() === body().clientWidth`,A / B **没有**被拉宽(这是原计划的「吸收列不写宽度」方案失效的情形;S1 实测此时不重挂会得到 A316 B316 C366),`hasHandle('email') === false`。可在控制台确认重挂发生:事先 `window.__t = document.querySelector('[data-testid="host"] .n-data-table')`,隐藏后 `document.querySelector('[data-testid="host"] .n-data-table') !== window.__t` 为 true。
5. **⑤ 全部 fixed(`allfixed`,1000)**:初始 `{ account:321, name:321, email:321 }`;拖 A `+60` → `{ account:381, name:321, email:262 }`(C 是退路吸收列,写显式宽度,让出 60),`tableW() === body().clientWidth`;再拖 A `−40` → `{ account:341, name:321, email:302 }`;**此时 C(最后一个叶子列)仍没有把手**(`handles` 只有 `account,name`)。
6. **⑥ 含 `fixed: 'right'` 操作列(`fixedright`,1000)**:拖 A `+60` → `{ account:323, name:263, email:203, status:175 }`(Op 是固定列,不参与吸收,宽度在拖拽前后**不变**,实测 175);再向左拖 B `−60` → `{ account:323, name:203, email:263, status:175 }`:C(吸收列)变宽来补,Op 仍是 175(原方案下 Op 会被拉宽);`tableW() === body().clientWidth`。
7. **⑦ 未 fixed 且 `resizable: false` 的操作列(`opnofix`,1000)**:拖 A `+60` → `{ account:323, name:263, email:203, status:175 }`(Op 被当普通列冻结为 175,**不**被当吸收列;C 才是吸收列),`handles` 只有 `account,name`(C、Op 都没有把手)。
8. **容器宽度变化(钉住后)**:`plain` 拖 A `+60` 后,把宽度切到 700:`body().clientWidth` = 664,`tableW()` = 933 > 664(表格出现横向滚动),D 落到下限 150(`{ account:301, name:241, email:241, deptId:150 }`);切回 1000:D 回到 181。
9. **「恢复默认」**(`SmartTable` 自带的列设置里需要打开工具栏,本页签关了工具栏,改在「基础」示例上验证):拖过列宽后点列设置里的「恢复默认」,所有列回到声明宽,此后再拖不会残留上一次的拖拽宽度(这条是 `tableKey++` 已有的行为,只确认没被新逻辑弄坏)。
记录没有成立的项,**不要**假装通过;数字偏差超过 ±1px 时记录实测值并先查原因(优先看吸收列的 `<col>` 是否仍带 `width` 样式:`document.querySelectorAll('[data-testid="host"] colgroup col')`)。结束后关掉 vite。

- [ ] **Step 9: 提交**

```bash
git add src/useColumns.ts src/SmartTable.vue playground/DemoAbsorb.vue playground/App.vue tests/useColumns.test.ts tests/SmartTable.test.ts
git commit -m "feat!: 拖过列宽后的余量由最后一个可见非固定可拖的列吸收,取代占位列(B8);带图标列的拖拽下限取 max(resizeMinWidth, 图标下限)(B12)" -m "有意的行为变更:表头 DOM 不再有占位列;吸收余量的那一列没有拖拽把手(要调它旁边的边界就拖它左邻列),列上写 resizable: false 可让它不参与吸收;拖过的列后来成为吸收列时库会重挂表格。tests/useColumns.test.ts 里「列被移除后…」那条用例的最后一个断言有意翻转(P-2)。把手骑在列界线上的视觉打磨推到 P1。" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12b: `fillHeight` 最小实现(A 级新增,P0),以及不开时翻页回卡片顶部(D5 / E4)

> 设计 2.11 定「每页 100」的前提是「铺满一页 + 虚拟滚动」,P0 只拿了默认值没拿前提:宿主不传属性时是整页长滚动,翻页后视口停在页底;选 1000 行是 1000 行真实 DOM。本 Task 补上这个前提的最小实现(spike S4 = `docs/spike/s8` 实测,真实 `NDataTable`、Chromium):
>
> **`fillHeight?: boolean`(默认 `false`,A 级新增)** = 官方 `flex-height` + `virtual-scroll` + `min-row-height`,根元素 → 卡片 → 卡片内容区 → `NDataTable` 逐层 `display:flex; flex-direction:column; flex:1 1 auto; min-height:0`。
> - **两个官方属性必须一起传**:只传 `virtual-scroll` 不传 `flex-height` 不会虚拟化(100 行全在 DOM,表体撑出卡片、分页条压在行上)。实测父容器 600:表体 450.6、分页条贴父容器底部、每页 100 / 1000 行 DOM 里只有 15–20 行(不开虚拟滚动是 101 / 1001 行),首屏 1000 行约 33ms(不开虚拟滚动约 307–363ms)。
> - **`min-row-height` 必须 ≥ 真实行高,取 `Math.ceil(真实行高)`**:官方默认 28 会让虚拟列表把总高度按 28 估算,**滚到底最后一行看不全**(small 超出 182px,medium 291px)。默认主题、字号 14 / 行高 1.6 下真实行高 `2×纵向内边距(8 / 12) + 22.4 + 1` = small 39.4 / medium 47.4,所以**随密度取值:紧凑(表格 size small)= 40,舒适(medium)= 48**;宿主改了 `themeOverrides`(字号 / 内边距)行高会变,此时在 `<SmartTable>` 上写官方的 `min-row-height` 覆盖(宿主 attrs 优先)。
> - **父容器必须有确定高度**(`height: 600px` / `calc(100vh - …)` / 自己又是 flex 列且有定高),否则表体塌成 0(`flex-basis:0` 与 `1 1 auto` 两种写法结果相同,因为 `flex-height` 要求祖先链有确定高度)。兜底:库再传一个较小的官方 `min-height`(160),没定高时表体至少能看见几行;父容器比 160 还矮时表体会溢出父容器。文档(README / CHANGELOG)要写明「父容器须定高」。
> - `min-height: 0` 去掉实测仍正确,但保留(防宿主全局样式)。
>
> **不开 `fillHeight` 时翻页回卡片顶部(E4)**:点翻页(页码 / 上一页 / 下一页 / 跳转输入框回车 / 改每页条数)**当下**判断,卡片顶部已滚出滚动容器上沿(`top < scroll-margin-top`)才 `scrollIntoView({ block: 'start', behavior: 'instant' })`;**只在需要时滚**,不在卡片可见时乱跳;不等数据回来(卡片顶部位置与表体高度无关,远程 / 本地一样)。实测:滚到表底点「下一页」本来视口停在第 2 页的页底(首行已在上方看不见),修复后 `scrollY → 316`、`cardTop → 0`;键盘跳转同样;宿主内层滚动容器(`overflow:auto`)只滚内层;宿主 `html{scroll-behavior:smooth}` 下 `behavior:'instant'` 仍立即到位;宿主固定顶栏用 CSS `scroll-margin-top` 给卡片留位(判据 `top < margin`)。
> - **放在本 Task(而不是 Task 7)的理由**:它只在「不开 `fillHeight`」时做,与 `fillHeight` 是 D5 的两半,共用同一个 `rootRef` 与分页回调、同一个开关;放在一起测、一起做浏览器验证,比拆开少一次对 `onUpdatePage` / `onUpdatePageSize` 的重复改动。Task 7 的分页状态逻辑因此不带滚动副作用,更好审。
> - 开了 `fillHeight` 时表体自己在卡片内滚动,翻页后把表体 `scrollTo({ top: 0 })` 复位(官方 `DataTableInst.scrollTo`;**S4 未测这一项**,浏览器步骤里确认)。
>
> **未测项(S4)**:横向滚动(`scroll-x`)+ 虚拟滚动的表头同步;`min-row-height` 在宿主自定义 `themeOverrides`、行内多行文本 / `ellipsis` 时的行高估计;Safari / Firefox;`flex-height` 下 `loading` 遮罩的位置。
>
> CHANGELOG:B1 行补「需要卡片内滚动请传 `fillHeight`(父容器须定高)」,新增一条 `fillHeight`;规格 P1 清单里的 `fillHeight` 移到 P0(A 级)。

**Files:**
- Create: `src/scrollToCard.ts`、`playground/DemoFill.vue`
- Modify: `src/SmartTable.vue`、`src/types.ts`(`SmartTableProps.fillHeight`)、`playground/App.vue`(加页签)
- Test: `tests/scrollToCard.test.ts`(新建)、`tests/SmartTable.test.ts`(追加)

**Interfaces:**
- Produces: `scrollToCard.ts`:`scrollParentOf(el: HTMLElement): HTMLElement | null`;`keepCardTopVisible(card: HTMLElement): boolean`(返回是否滚了);`SmartTable` 新 prop `fillHeight: boolean`(默认 `false`);根节点类 `smart-table--fill`。

- [ ] **Step 1: 写失败测试**

Create `tests/scrollToCard.test.ts`:
```ts
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { keepCardTopVisible, scrollParentOf } from '../src/scrollToCard'

function card(top: number, marginTop = '') {
  const el = document.createElement('div')
  document.body.appendChild(el)
  if (marginTop) el.style.scrollMarginTop = marginTop
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({ top } as DOMRect)
  Element.prototype.scrollIntoView = vi.fn()
  return el
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
  // @ts-expect-error jsdom 没有 scrollIntoView,测试里临时装了一个
  delete Element.prototype.scrollIntoView
})

describe('keepCardTopVisible(E4:翻页后只在需要时滚回卡片顶部)', () => {
  it('卡片顶部已滚出视口上沿(top < 0)→ scrollIntoView({ block: "start", behavior: "instant" }),返回 true', () => {
    const el = card(-120)
    expect(keepCardTopVisible(el)).toBe(true)
    expect(el.scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'instant' })
  })
  it('卡片顶部还在视口内(top ≥ 0)→ 不滚(不在卡片可见时乱跳)', () => {
    const el = card(0)
    expect(keepCardTopVisible(el)).toBe(false)
    expect(keepCardTopVisible(card(316))).toBe(false)
    expect(el.scrollIntoView).not.toHaveBeenCalled()
  })
  it('宿主用 CSS scroll-margin-top 给固定顶栏留位:判据是 top < margin', () => {
    expect(keepCardTopVisible(card(40, '56px'))).toBe(true) // 被 56px 顶栏盖住了
    expect(keepCardTopVisible(card(60, '56px'))).toBe(false)
  })
  it('宿主的内层滚动容器(overflow:auto 且真的有滚动条):top 是相对它的上沿算的', () => {
    const sp = document.createElement('div')
    sp.style.overflowY = 'auto'
    Object.defineProperty(sp, 'scrollHeight', { value: 2000, configurable: true })
    Object.defineProperty(sp, 'clientHeight', { value: 500, configurable: true })
    vi.spyOn(sp, 'getBoundingClientRect').mockReturnValue({ top: 100 } as DOMRect)
    document.body.appendChild(sp)
    const el = document.createElement('div')
    sp.appendChild(el)
    Element.prototype.scrollIntoView = vi.fn()
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({ top: 90 } as DOMRect) // 相对容器上沿 −10 → 要滚
    expect(scrollParentOf(el)).toBe(sp)
    expect(keepCardTopVisible(el)).toBe(true)
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({ top: 130 } as DOMRect) // 相对容器上沿 +30 → 不滚
    expect(keepCardTopVisible(el)).toBe(false)
  })
})

describe('scrollParentOf', () => {
  it('没有可滚动的祖先 → null(文档)', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    expect(scrollParentOf(el)).toBeNull()
  })
  it('overflow:auto 但内容没溢出(不会滚)的祖先不算', () => {
    const sp = document.createElement('div')
    sp.style.overflowY = 'auto' // jsdom 里 scrollHeight / clientHeight 都是 0
    const el = document.createElement('div')
    sp.appendChild(el)
    document.body.appendChild(sp)
    expect(scrollParentOf(el)).toBeNull()
  })
})
```
在 `tests/SmartTable.test.ts` 末尾追加(泛型写 `SmartTableColumn<unknown>[]`):
```ts
describe('SmartTable fillHeight(D5)', () => {
  const base = { columns: [{ key: 'name', title: 'Name' }] as SmartTableColumn<unknown>[], data: rows, rowKey: 'id' }
  const tableProps = (w: ReturnType<typeof mount>) => w.findComponent(NDataTable).props() as Record<string, any>

  // vueuc 的 VirtualList(官方 virtual-scroll)在 setup 里读 window.matchMedia,jsdom 没有 → 开了 fillHeight 的用例都会抛 TypeError
  beforeEach(() => {
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }))
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('默认关闭:表格不带 flex-height / virtual-scroll,根节点没有 smart-table--fill', () => {
    const wrapper = mount(SmartTable, { props: base })
    expect(tableProps(wrapper).flexHeight).toBe(false)
    expect(tableProps(wrapper).virtualScroll).toBe(false)
    expect(wrapper.classes()).not.toContain('smart-table--fill')
    wrapper.unmount()
  })

  it('fillHeight:官方 flex-height + virtual-scroll 一起传,min-row-height 随密度(紧凑 40 / 舒适 48),带兜底 min-height,根节点加 --fill', () => {
    const compact = mount(SmartTable, { props: { ...base, fillHeight: true } }) // 默认紧凑
    expect(tableProps(compact)).toMatchObject({ flexHeight: true, virtualScroll: true, minRowHeight: 40, minHeight: 160 })
    expect(compact.classes()).toContain('smart-table--fill')
    compact.unmount()
    const comfortable = mount(SmartTable, { props: { ...base, fillHeight: true, defaultDensity: 'comfortable' } })
    expect(tableProps(comfortable).minRowHeight).toBe(48)
    comfortable.unmount()
  })

  it('宿主 attrs 的官方 min-row-height / min-height 优先于库的取值', () => {
    const wrapper = mount(SmartTable, { props: { ...base, fillHeight: true }, attrs: { 'min-row-height': 60, minHeight: 300 } })
    expect(tableProps(wrapper)).toMatchObject({ minRowHeight: 60, minHeight: 300 })
    wrapper.unmount()
  })
})

describe('SmartTable fillHeight 与 max-height(F8)', () => {
  const base = { columns: [{ key: 'name', title: 'Name' }] as SmartTableColumn<unknown>[], data: rows, rowKey: 'id' }
  const tableProps = (w: ReturnType<typeof mount>) => w.findComponent(NDataTable).props() as Record<string, any>
  beforeEach(() => {
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }))
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('fillHeight 开启时忽略宿主的 max-height / maxHeight 并警告一次;关闭时照常透传', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const mine = () => warn.mock.calls.filter((c) => String(c[0]).includes('max-height'))
    const on = mount(SmartTable, { props: { ...base, fillHeight: true }, attrs: { maxHeight: 300 } })
    expect(tableProps(on).maxHeight).toBeUndefined()
    expect(mine()).toHaveLength(1)
    on.unmount()
    const kebab = mount(SmartTable, { props: { ...base, fillHeight: true }, attrs: { 'max-height': 300 } })
    expect(tableProps(kebab).maxHeight).toBeUndefined()
    expect(mine()).toHaveLength(2) // 每个实例警告一次(同一实例里 computed 重复求值不重复警告)
    kebab.unmount()
    const off = mount(SmartTable, { props: base, attrs: { maxHeight: 300 } })
    expect(tableProps(off).maxHeight).toBe(300)
    expect(mine()).toHaveLength(2) // 关闭 fillHeight 时照常透传,不警告
    off.unmount()
  })
})

describe('SmartTable 翻页后滚回卡片顶部(E4:只在不开 fillHeight 时)', () => {
  const base = { columns: [{ key: 'name', title: 'Name' }] as SmartTableColumn<unknown>[], data: rows, rowKey: 'id' }
  let cardTop = 0
  const pagerProps = (w: ReturnType<typeof mount>) =>
    w.findComponent(NDataTable).props('pagination') as unknown as { onUpdatePage: (p: number) => void; suffix: (i: Record<string, number>) => { props: Record<string, any> } }

  beforeEach(() => {
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })) // 同上:fillHeight 用例要挂 VirtualList
    cardTop = 0
    Element.prototype.scrollIntoView = vi.fn()
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      return { top: this.classList.contains('smart-table-card') ? cardTop : 0 } as DOMRect
    })
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    // @ts-expect-error jsdom 没有 scrollIntoView,测试里临时装了一个
    delete Element.prototype.scrollIntoView
  })

  it('翻页时卡片顶部已滚出视口上沿 → 滚回卡片顶部;还在视口内 → 不滚', () => {
    const wrapper = mount(SmartTable, { props: base, attachTo: document.body })
    cardTop = 50
    pagerProps(wrapper).onUpdatePage(2)
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled()
    cardTop = -200
    pagerProps(wrapper).onUpdatePage(3)
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'instant' })
    wrapper.unmount()
  })

  it('远程模式同样在点击当下滚(不等数据回来);改每页条数也算翻页', async () => {
    const fetcher = vi.fn(async (_p: Record<string, unknown>) => ({ items: rows, total: 500 }))
    const wrapper = mount(SmartTable, { props: { columns: base.columns, fetcher, rowKey: 'id' }, attachTo: document.body })
    await flushPromises()
    cardTop = -200
    pagerProps(wrapper).onUpdatePage(2)
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1)
    pagerProps(wrapper).suffix({ page: 1, pageSize: 100, pageCount: 5, itemCount: 500, startIndex: 0, endIndex: 99 }).props.onUpdatePageSize(500)
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })

  it('开了 fillHeight:不滚窗口,改为把表体滚回顶部(官方 scrollTo)', () => {
    const wrapper = mount(SmartTable, { props: { ...base, fillHeight: true }, attachTo: document.body })
    const scrollTo = vi.spyOn(wrapper.findComponent(NDataTable).vm as unknown as { scrollTo: (o: unknown) => void }, 'scrollTo').mockImplementation(() => {}) // 不放行到真实现:jsdom 的元素没有 scrollTo
    cardTop = -200
    pagerProps(wrapper).onUpdatePage(2)
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled()
    expect(scrollTo).toHaveBeenCalledWith({ top: 0 })
    wrapper.unmount()
  })
})
```
并把 `tests/SmartTable.test.ts` 顶部 vitest 的 import 补成 `import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'`(若已有就合并)。

- [ ] **Step 2: 跑,确认失败**

Run: `npx vitest run tests/scrollToCard.test.ts tests/SmartTable.test.ts`
Expected(实测):`Test Files  2 failed (2)`、`Tests  5 failed | 71 passed (76)`。`scrollToCard.test.ts` 整个文件报 `Failed to resolve import "../src/scrollToCard"`(不计入用例数);`SmartTable.test.ts` 失败 5 条:fillHeight 的参数用例、[F8] `max-height` 用例、翻页滚回的 3 条(都没有接线)。「默认关闭」「宿主 attrs 优先」两条在此时就是绿的(官方属性本来就能透传),它们是给后面的实现锁行为的。

- [ ] **Step 3: 实现**

Create `src/scrollToCard.ts`:
```ts
// 翻页后滚回卡片顶部(E4,不开 fillHeight 时)。每页 100 行时卡片高约 4000px:滚到表底点「下一页」,
// 视口会停在下一页的页底(首行已在上方看不见)。判据必须是「卡片顶部已滚出滚动容器上沿」才滚,否则乱跳。

/** 沿祖先找真正会滚动的容器(overflow-y 是 auto / scroll 且内容溢出);没有 → null(文档)。 */
export function scrollParentOf(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY
    if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) return p
  }
  return null
}

/**
 * 卡片顶部(相对滚动容器上沿)< scroll-margin-top 时滚回卡片顶部,返回是否滚了。
 * `behavior: 'instant'`:宿主 `html { scroll-behavior: smooth }` 下也立即到位。
 * 宿主有固定顶栏时,给卡片设 CSS `scroll-margin-top`(= 顶栏高)即可,判据与落点都尊重它。
 */
export function keepCardTopVisible(card: HTMLElement): boolean {
  const sp = scrollParentOf(card)
  const top = card.getBoundingClientRect().top - (sp ? sp.getBoundingClientRect().top : 0)
  const margin = parseFloat(getComputedStyle(card).scrollMarginTop) || 0
  if (top >= margin) return false
  card.scrollIntoView({ block: 'start', behavior: 'instant' })
  return true
}
```
`src/types.ts`:`SmartTableProps` 里 `cardProps` 之后加:
```ts
  /**
   * 铺满父容器:表体在卡片内滚动(官方 flex-height + virtual-scroll),分页条贴底;默认 false(整页长滚动)。
   * **父容器必须有确定高度**(否则表体塌成 0,库带了 min-height: 160 兜底)。不开时翻页后若卡片顶部已滚出视口,会滚回卡片顶部。
   */
  fillHeight?: boolean
```
`src/SmartTable.vue`:
1. `import` 区加 `import { keepCardTopVisible } from './scrollToCard'`;并把 `mergeProps` 加进从 `'vue'` 的具名导入(在 `h` 与 `nextTick` 之间)。
2. props 里 `cardProps: {…}` 之后加 `fillHeight: { type: Boolean, default: false },`。
3. 在 `const tableSize = computed(…)` 之后加:
```ts
/**
 * fillHeight(D5):官方 flex-height + virtual-scroll 必须一起传;min-row-height 必须 ≥ 真实行高(取 ceil),
 * 官方默认 28 会让滚到底最后一行看不全。默认主题下真实行高 small 39.4 / medium 47.4 → 40 / 48。
 * 兜底 min-height 160:父容器没给定高时表体至少能看见几行。与宿主 attrs 合并时宿主优先(见下面的 tableAttrs)。
 */
const fillProps = computed(() =>
  props.fillHeight
    ? {
        flexHeight: true,
        virtualScroll: true,
        minRowHeight: tableSize.value === 'small' ? 40 : 48,
        minHeight: 160,
        style: { flex: '1 1 auto', minHeight: 0 },
      }
    : {},
)
/**
 * 给 <n-data-table> 的合并属性:fillHeight 的默认值在前、宿主透传的 attrs 在后(宿主优先)。
 * Vue 模板里不能写两个 v-bind(`Duplicate attribute`),所以用 mergeProps 合并;它对 style / class / 事件会合并而不是覆盖。
 * forwardedAttrs 在下面才声明,这里只在 computed 里读它,渲染时才求值,不会触发「声明前使用」。
 */
// fillHeight 下表体高度由父容器决定,宿主传的 max-height / maxHeight 会和 flex-height 打架:不透传,警告一次(规格 §4)
let warnedMaxHeight = false
const tableAttrs = computed(() => {
  const host = { ...forwardedAttrs.value } as Record<string, unknown>
  if (props.fillHeight) {
    for (const k of ['maxHeight', 'max-height']) {
      if (!(k in host)) continue
      delete host[k]
      if (!warnedMaxHeight) {
        warnedMaxHeight = true
        console.warn('[smart-naive-table] fillHeight 开启时表体高度由父容器决定,已忽略 max-height;请给父容器设定高。')
      }
    }
  }
  return mergeProps(fillProps.value, host)
})

/**
 * 翻页 / 改每页条数后(点击当下,不等数据回来):开了 fillHeight → 表体自己在卡片里滚,把它滚回顶部;
 * 没开 → 卡片顶部已滚出视口上沿才滚回卡片顶部(只在需要时滚)。
 */
function onPageChanged() {
  if (props.fillHeight) {
    tableRef.value?.scrollTo({ top: 0 })
    return
  }
  const card = rootRef.value?.querySelector<HTMLElement>('.smart-table-card')
  if (card) keepCardTopVisible(card)
}
```
4. `mergedPagination` 里(Task 7 写的那段)四处加 `onPageChanged()`:
   - 远程的 `onSize`:`(n: number) => callAll(user.onUpdatePageSize ?? table.onPageSize, n)` 改成 `(n: number) => { onPageChanged(); callAll(user.onUpdatePageSize ?? table.onPageSize, n) }`;
   - 本地的 `onSize`:函数体第一行加 `onPageChanged()`;
   - 本地 `onUpdatePage` 里 `localPage.value = p` 之后加 `onPageChanged()`;
   - 远程的返回对象里,把 `onUpdatePage: table.onPage, onUpdatePageSize: table.onPageSize,`(在 `...user` 之前)删掉,改成在 `...tail,` 之后加:
```ts
      onUpdatePage: (p: number) => {
        onPageChanged()
        callAll(user.onUpdatePage ?? table.onPage, p) // 与 2.1.1 一致:宿主给了自己的处理函数就由宿主接管
      },
      onUpdatePageSize: onSize,
```
5. 根节点 `class` 加 `'smart-table--fill': props.fillHeight`(与已有的 `smart-table--pinned-cols` 并列);`<n-data-table` 上把 `v-bind="forwardedAttrs"` 改成 `v-bind="tableAttrs"`(不能并排写两个 `v-bind`,编译会报 `Duplicate attribute`)。
6. `<style scoped>` 里加(根 → 卡片 → 卡片内容区逐层铺满;`NDataTable` 自己的 `flex:1 1 auto` 由 `fillProps.style` 给):
```css
/* fillHeight:根 → 卡片 → 卡片内容区 逐层 flex 列 + flex:1 1 auto + min-height:0;表格自己的 flex 由 fillProps.style 给。
   父容器必须有确定高度(docs / CHANGELOG 写明)。 */
.smart-table--fill {
  height: 100%;
  min-height: 0;
}
.smart-table--fill > .smart-table-card {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.smart-table--fill .smart-table-card :deep(.n-card-content) {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
```

- [ ] **Step 4: 跑,确认通过**

Run: `npm test && npm run typecheck`
Expected: `Test Files  18 passed (18)`、`Tests  325 passed (325)`(312 + 13:`scrollToCard.test.ts` +6、`SmartTable.test.ts` +7);typecheck 无输出。排错:「fillHeight … min-row-height」用例若读到 `undefined`,确认模板是 `v-bind="tableAttrs"`、`mergeProps(fillProps.value, forwardedAttrs.value)` 里宿主在后,且 `minRowHeight` 是驼峰;若「翻页滚回」用例里 `scrollIntoView` 没被调用,确认 `rootRef.value.querySelector('.smart-table-card')` 命中(卡片根元素的类名)。

- [ ] **Step 5: playground 加「铺满」场景页(Q-13,正式提交的示例改动,浏览器验证的前置条件)**

Create `playground/DemoFill.vue`:
```vue
<script setup lang="ts">
// fillHeight 场景页(Task 12b 的浏览器验证用):父容器定高,表格铺满并在卡片内虚拟滚动;
// 关掉 fillHeight 可对照「翻页后滚回卡片顶部」;关掉「父容器定高」可看没定高时的兜底。
import { ref } from 'vue'
import { NSpace, NSwitch } from 'naive-ui'
import { SmartTable, type SmartTableColumn } from '../src/index'
import { allRows, type DemoRow } from './mock'

const fill = ref(true)
const dense = ref(true)
const fixedParent = ref(true)
// 页码序列(pagination.simple: false):带上一页 / 下一页按钮,浏览器验证「翻页后滚回卡片顶部」要点按钮(页码输入框在页底,键入时浏览器自己会滚)
const pager = ref(false)
const columns: SmartTableColumn<DemoRow>[] = [
  { type: 'index', width: 70 },
  { key: 'account', title: '账号', width: 140 },
  { key: 'name', title: '姓名', width: 120 },
  { key: 'email', title: 'Email', minWidth: 220 },
  { key: 'salary', title: '薪资', width: 120, align: 'right', format: 'money' },
]
</script>

<template>
  <div>
    <n-space align="center" :size="16" style="margin-bottom: 12px">
      <label><n-switch v-model:value="fill" size="small" data-testid="fill" /> fillHeight</label>
      <label><n-switch v-model:value="dense" size="small" data-testid="dense" /> 紧凑</label>
      <label><n-switch v-model:value="fixedParent" size="small" data-testid="fixed-parent" /> 父容器定高</label>
      <label><n-switch v-model:value="pager" size="small" data-testid="pager" /> 页码序列(非 simple)</label>
    </n-space>
    <div :style="fill && fixedParent ? { height: 'calc(100vh - 220px)' } : {}" data-testid="fill-host">
      <SmartTable
        :columns="columns"
        :data="allRows"
        :fill-height="fill"
        :default-page-size="100"
        :pagination="{ simple: !pager, pageSizes: [10, 100, 500, 1000] }"
        :default-density="dense ? 'compact' : 'comfortable'"
        :search="false"
        :toolbar="false"
        title="铺满演示"
      />
    </div>
  </div>
</template>
```
`playground/App.vue`:`import DemoAbsorb from './DemoAbsorb.vue'` 之后加 `import DemoFill from './DemoFill.vue'`;`<n-tab-pane name="absorb" …>` 之后加:
```vue
          <n-tab-pane name="fill" tab="铺满"><DemoFill /></n-tab-pane>
```
Run: `npm run typecheck`
Expected: 无输出。

- [ ] **Step 6: 浏览器验证(布局与滚动只能在真实浏览器里看;测量方法取自 `docs/spike/s8`)**

Run: `node_modules/.bin/vite --port 5173`,打开 playground 的「铺满」页签(视口 1280×800 左右)。读数函数:
```js
const r = (e) => e.getBoundingClientRect()
const host = document.querySelector('[data-testid="fill-host"]')
const card = host.querySelector('.smart-table-card')
const body = host.querySelector('.n-data-table-base-table-body')
const pag = host.querySelector('.n-pagination--simple')
const rowsInDom = () => host.querySelectorAll('.n-data-table-tbody tr, tbody tr').length
```
**fillHeight 开(默认)**逐项确认并记录:
1. **填满**:`r(card).height ≈ r(host).height − 2`,`body.clientHeight > 300`,**分页条在父容器底部可见**:`r(pag).bottom <= r(host).bottom + 1`。
2. **体内滚动 + 虚拟滚动**:`rowsInDom()` 在 15–30 之间(不是 100);把每页改成 1000(选择器「1000 / 页」)后仍是 15–30,页面不卡(切换瞬间 < 100ms 级)。
3. **`min-row-height`**:紧凑(默认)下滚到表体最底(`body.scrollTop = body.scrollHeight`,等一帧):最后一个 `tr` 的 `r(tr).bottom <= r(body).bottom + 1`(**完整可见**,`min-row-height: 40`);关掉「紧凑」再做一次(舒适,`min-row-height: 48`)同样完整可见。中间位置滚动无白屏(表体被行铺满)。
4. **翻页复位**:表体滚到中间,在页码输入框输入 2 回车:`body.scrollTop === 0`(`scrollTo({ top: 0 })`;**这一项 S4 未测**)。
5. **暗色**(右上角「暗色」)无异常。
6. **没定高的兜底**:关掉「父容器定高」:表体高度 ≥ 160(库给的 `min-height` 兜底),不是 0;文档要写明「父容器须定高」。
**fillHeight 关**(关掉 `fillHeight` 开关,此时没有父容器定高,整页长滚动):
7. 打开「页码序列(非 simple)」开关(分页变成带上一页 / 下一页按钮的页码序列,每页默认 100);窗口滚到页面最底(`window.scrollTo(0, document.documentElement.scrollHeight)`),此时 `r(card).top < 0`;**点「下一页」按钮**(不要用页码输入框:它在页底,键入时浏览器自己会把它滚进视口,干扰读数):**之后 `r(card).top` 在 `[0, 5)` 内**、`window.scrollY` 明显变小(回到卡片顶部,首行可见)。
8. **只在需要时滚**:「页码序列」开着,把每页选成 10(DemoFill 的 `pageSizes` 含 10,页面因此很短),`window.scrollY = 0` 时点「下一页」按钮:`window.scrollY` 仍是 0、`r(card).top` 不变(卡片顶部还在视口内,不滚)。
记录没有成立的项,**不要**假装通过。结束后关掉 vite。

- [ ] **Step 7: 提交**

```bash
git add src/scrollToCard.ts src/SmartTable.vue src/types.ts playground/DemoFill.vue playground/App.vue tests/scrollToCard.test.ts tests/SmartTable.test.ts
git commit -m "feat: 新增 fillHeight(官方 flex-height + virtual-scroll + min-row-height,铺满父容器、体内虚拟滚动);不开时翻页后滚回卡片顶部(D5)" -m "纯新增,默认 false;开 fillHeight 时父容器须有确定高度。不开 fillHeight 时翻页后若卡片顶部已滚出视口会滚回卡片顶部(行为变化,CHANGELOG 随 B1 注明)。" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: 搜索区窄屏折叠态至少露出首个字段(C5)

> 规格 §2 C5、设计文档 2.10。**现象**:开启 `search.collapsible` 且视口 < 640px(`cols='1 s:2 m:3 l:4'` 的 1 列档)时,折叠态 0 个字段(只剩「搜索 / 重置 / 展开」)。**根因(已读官方 `Grid.mjs:198`)**:折叠判定 `childSpan + spanCounter + suffixSpan > collapsedRows * responsiveCols`,1 列 × 1 行 → `1 + 0 + 1 > 1` 一上来就满,0 个字段;不能靠调 `collapsedRows` 的数值解决(库不知道当前列数)。
> **修法**:折叠可见字段数 = `max(1, collapsedRows × cols − 1)`。只有「1 列 × 1 行」这一档会变(0 → 1):此时把传给 `n-grid` 的 `collapsed-rows` 抬到 2(第 1 行字段,第 2 行操作区)。其余档位(2 / 3 / 4 列)不变,开启 `collapsible` 且列数 ≥ 2 的现有用户行为不变。
>
> **当前列数怎么得到(Q-9)**:原稿在库里写死 naive 的默认断点 + `window.innerWidth` 自己推算列数,有两个问题:① 宿主用 `NConfigProvider` 的 `breakpoints` 自定义断点时,推算出的列数与 `n-grid` 实际用的不一致,会改变 `cols ≥ 2` 现有用户的折叠字段数;② `resolveCols('s:2', 300)` 里 `Number(undefined) ?? 24` 得到 `NaN`(`??` 不拦 `NaN`)。**改成:渲染后读 `n-grid` 根元素 `getComputedStyle(el).gridTemplateColumns` 的轨道数**(浏览器算出来的就是 `n-grid` 真实用的列数,自定义断点、`cols` 写成数字 / 字符串都天然正确,也不再有 `resolveCols` 和 `NaN`)。纯函数 `countTracks` 只收这个字符串、`effectiveCollapsedRows` 只收轨道数,node 环境可单测;读不到(jsdom、SSR、`display` 不是 grid)时轨道数记 0 = 未知,**不改**配置值。
> 不能用官方 `useBreakpoints`:它不是 naive-ui 的公开导出(是传递依赖 `vooks` 的)。

**Files:**
- Create: `src/searchCols.ts`
- Modify: `src/SearchForm.vue`
- Test: `tests/searchCols.test.ts`(新建)、`tests/SearchForm.test.ts`(新建)

**Interfaces:**
- Produces: `searchCols.ts`:`countTracks(gridTemplateColumns: string): number`(`0` = 未知);`effectiveCollapsedRows(trackCount: number, collapsedRows?: number): number`(`collapsedRows` 缺省 1;`trackCount` 为 0 时原样返回配置值)。

- [ ] **Step 1: 写失败测试**

Create `tests/searchCols.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { countTracks, effectiveCollapsedRows } from '../src/searchCols'

describe('countTracks(computed grid-template-columns → 轨道数)', () => {
  it('浏览器解析后的形状是一串 px:数空白分隔的项', () => {
    expect(countTracks('300px')).toBe(1)
    expect(countTracks('100px 100px 100px')).toBe(3)
    expect(countTracks('  150.5px   150.5px ')).toBe(2)
  })
  it('未解析的 repeat(N, …)(jsdom / 个别环境):取 N', () => {
    expect(countTracks('repeat(4, minmax(0px, 1fr))')).toBe(4)
    expect(countTracks('repeat(2,1fr)')).toBe(2)
  })
  it('括号里的空格不算分隔', () => {
    expect(countTracks('minmax(0px, 1fr) 1fr')).toBe(2)
  })
  it('none / 空串 / 读不到 → 0(未知,调用方不改配置值)', () => {
    expect(countTracks('none')).toBe(0)
    expect(countTracks('')).toBe(0)
    expect(countTracks(undefined as unknown as string)).toBe(0)
  })
})

describe('effectiveCollapsedRows(C5)', () => {
  it('1 列 × 1 行(折叠态 0 个字段的那一档)→ 抬到 2 行:首个字段 + 下一行操作区', () => {
    expect(effectiveCollapsedRows(1, 1)).toBe(2)
    expect(effectiveCollapsedRows(1)).toBe(2) // collapsedRows 缺省按 1
  })
  it('其余档位不变:2 / 3 / 4 列仍是配置值;1 列但 collapsedRows ≥ 2 也不变(本来就有字段)', () => {
    expect(effectiveCollapsedRows(2, 1)).toBe(1)
    expect(effectiveCollapsedRows(3, 1)).toBe(1)
    expect(effectiveCollapsedRows(4, 1)).toBe(1)
    expect(effectiveCollapsedRows(1, 2)).toBe(2)
    expect(effectiveCollapsedRows(1, 3)).toBe(3)
  })
  it('轨道数未知(0)→ 原样返回配置值,不改现有用户的行为', () => {
    expect(effectiveCollapsedRows(0, 1)).toBe(1)
    expect(effectiveCollapsedRows(0, 2)).toBe(2)
  })
})
```

Create `tests/SearchForm.test.ts`(组件接线:`getComputedStyle` 读到几个轨道,`n-grid` 的 `collapsed-rows` 就跟着变。jsdom 不做 grid 布局,所以只对 `n-grid` 根元素桩一下 `getComputedStyle`,其它元素走原实现):
```ts
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { NGrid } from 'naive-ui'
import SearchForm from '../src/SearchForm.vue'
import { defaultLabels } from '../src/labels'
import { deriveSearchDefs } from '../src/useColumns'

const fields = deriveSearchDefs([
  { key: 'a', title: 'A', search: true },
  { key: 'b', title: 'B', search: true },
])

function mountForm(gridTemplateColumns: string, config: Record<string, unknown> = { collapsible: true }) {
  const real = window.getComputedStyle.bind(window)
  vi.spyOn(window, 'getComputedStyle').mockImplementation((el: Element, pseudo?: string | null) =>
    el.classList?.contains('n-grid') ? ({ gridTemplateColumns } as CSSStyleDeclaration) : real(el, pseudo),
  )
  return mount(SearchForm, {
    props: { fields, params: {}, config, labels: defaultLabels, getOptions: () => [], isLoadingOptions: () => false },
    attachTo: document.body,
  })
}

afterEach(() => vi.restoreAllMocks())

describe('SearchForm 折叠态的 collapsed-rows(C5,按 n-grid 实际轨道数判断)', () => {
  it('窄屏 1 个轨道 → collapsed-rows 抬到 2', async () => {
    const w = mountForm('300px')
    await nextTick() // onMounted 里读到轨道数后,collapsed-rows 在下一轮渲染才更新
    expect(w.findComponent(NGrid).props('collapsedRows')).toBe(2)
    w.unmount()
  })

  it('2 个及以上轨道(含宿主自定义断点下算出的列数)→ 保持配置值 1', async () => {
    const w = mountForm('150px 150px')
    await nextTick()
    expect(w.findComponent(NGrid).props('collapsedRows')).toBe(1)
    w.unmount()
  })

  it('读不到轨道数(none)→ 保持配置值,不改现有行为', async () => {
    const w = mountForm('none')
    await nextTick()
    expect(w.findComponent(NGrid).props('collapsedRows')).toBe(1)
    w.unmount()
  })

  it('宿主自己配了 collapsedRows: 2 时,1 个轨道也不再抬', async () => {
    const w = mountForm('300px', { collapsible: true, collapsedRows: 2 })
    await nextTick()
    expect(w.findComponent(NGrid).props('collapsedRows')).toBe(2)
    w.unmount()
  })
})
```

- [ ] **Step 2: 跑,确认失败**

Run: `npx vitest run tests/searchCols.test.ts tests/SearchForm.test.ts`
Expected: `Test Files  2 failed (2)`(实测)—— `searchCols.test.ts` 报 `Cannot find module '../src/searchCols'`(整个文件加载失败);`SearchForm.test.ts` 4 条里 1 条红:`expected 1 to be 2`(1 个轨道时 `collapsed-rows` 仍是 1),其余 3 条(2 个轨道 / none / 宿主自己配了 `collapsedRows: 2`)本来就是绿的,它们守住「其余档位不变」。

- [ ] **Step 3: 实现**

Create `src/searchCols.ts`:
```ts
// 搜索表单折叠态的列数判断(C5)。n-grid 的折叠判定(Grid.mjs:198)在「1 列 × 1 行」时一上来就满,
// 折叠态 0 个字段;库不知道当前列数。
// 不自己按视口宽度 + 默认断点推算(宿主用 NConfigProvider 的 breakpoints 自定义断点时会算错),
// 也不用 naive 的 useBreakpoints(不是公开导出):渲染后直接读 n-grid 根元素 computed 的
// grid-template-columns 有几个轨道 —— 浏览器算出来的就是 n-grid 真实用的列数。

/**
 * computed 的 grid-template-columns → 轨道数。浏览器解析后是一串 px("100px 100px");
 * 个别环境(jsdom)保留 repeat(N, …) 原样,取 N。括号里的空格不算分隔。none / 空 / 读不到 → 0(未知)。
 */
export function countTracks(gridTemplateColumns: string): number {
  const s = typeof gridTemplateColumns === 'string' ? gridTemplateColumns.trim() : ''
  if (!s || s === 'none') return 0
  const repeat = /^repeat\(\s*(\d+)\s*,/.exec(s)
  if (repeat) return Number(repeat[1])
  let depth = 0
  let count = 0
  let inToken = false
  for (const ch of s) {
    if (ch === '(') depth++
    else if (ch === ')') depth = Math.max(0, depth - 1)
    const space = depth === 0 && /\s/.test(ch)
    if (!space && !inToken) count++
    inToken = !space
  }
  return count
}

/**
 * 传给 n-grid 的 collapsed-rows:折叠可见字段数 = max(1, collapsedRows × 列数 − 1)。
 * 只有 collapsedRows × 列数 < 2(即 1 列 × 1 行)时需要修正 → 抬到 2 行;其余档位保持配置值。
 * 轨道数为 0(未知)时不改,免得误伤 cols ≥ 2 的现有用户。
 */
export function effectiveCollapsedRows(trackCount: number, collapsedRows = 1): number {
  return trackCount > 0 && collapsedRows * trackCount < 2 ? 2 : collapsedRows
}
```
`src/SearchForm.vue`:
1. `import { computed, h, ref, type PropType, type VNodeChild } from 'vue'` 改为 `import { computed, h, onBeforeUnmount, onMounted, ref, type PropType, type VNodeChild } from 'vue'`;再加 `import { countTracks, effectiveCollapsedRows } from './searchCols'`。
2. 在 `const collapsed = ref(true)` 之后加:
```ts
// C5:渲染后读 n-grid 根元素 computed 的 grid-template-columns 轨道数(0 = 未知),让窄屏 1 列的折叠态至少露出首个字段。
// 用 ResizeObserver 跟随视口 / 容器变化重读;只在轨道数变了时才改 collapsed-rows,所以它自己引起的高度变化不会循环触发。
const gridHostRef = ref<HTMLElement | null>(null)
const gridTracks = ref(0)
function measureTracks() {
  const el = gridHostRef.value?.querySelector<HTMLElement>('.n-grid')
  gridTracks.value = el ? countTracks(getComputedStyle(el).gridTemplateColumns) : 0
}
let resizeObserver: ResizeObserver | null = null
onMounted(() => {
  measureTracks()
  const el = gridHostRef.value?.querySelector<HTMLElement>('.n-grid')
  if (typeof ResizeObserver !== 'undefined' && el) {
    resizeObserver = new ResizeObserver(measureTracks)
    resizeObserver.observe(el)
  }
})
onBeforeUnmount(() => resizeObserver?.disconnect())
const gridCollapsedRows = computed(() => effectiveCollapsedRows(gridTracks.value, props.config.collapsedRows ?? 1))
```
3. 模板里把 `<n-grid …>…</n-grid>` 整个包进 `<div ref="gridHostRef">…</div>`,并把 `:collapsed-rows="config.collapsedRows ?? 1"` 改为 `:collapsed-rows="gridCollapsedRows"`。**不要直接给 `n-grid` 加 `ref`**:组件 ref 会让 vue-tsc 生成 d.ts 时报 `TS2742: The inferred type of 'default' cannot be named without a reference to …vueuc…`(实测)。

- [ ] **Step 4: 跑,确认通过**

Run: `npm test && npm run typecheck`
Expected: `Test Files  20 passed (20)`、`Tests  336 passed (336)`(325 + 11:`searchCols.test.ts` 7 条、`SearchForm.test.ts` 4 条);typecheck 无输出;无 `[Vue warn]`。

- [ ] **Step 5: 浏览器验证(`n-grid` 的折叠在 jsdom 里无法验证)**

Run: `node_modules/.bin/vite --port 5173`。临时改 `playground/DemoBasic.vue`:给 `<SmartTable>` 加 `:search="{ collapsible: true }"`(验证完 `git checkout playground`)。把浏览器窗口(或 DevTools 设备模拟)宽度设成 500,确认并记录:
1. **折叠态能看到第一个搜索字段**(修复前是 0 个,只有「搜索 / 重置 / 展开」三个按钮);
2. 点「展开」显示全部字段,点「收起」回到 1 个;
3. 窗口拉宽到 700 / 1100 / 1400,折叠态字段数分别为 1 / 2 / 3(与 2.1.1 一致);拉窄 / 拉宽过程中数量实时跟着变(ResizeObserver 重读轨道数);
4. **自定义断点(Q-9)**:用控制台确认轨道数就是 `n-grid` 实际用的列数:`getComputedStyle(document.querySelector('.smart-table-search .n-grid')).gridTemplateColumns`(500 宽应是一个值,1400 宽是四个值)。
Expected: 四条成立。结束后 `git checkout playground`,关掉 vite。

- [ ] **Step 6: 提交**

```bash
git add src/searchCols.ts src/SearchForm.vue tests/searchCols.test.ts tests/SearchForm.test.ts
git commit -m "fix: 开启 collapsible 时窄屏(1 列)折叠态至少露出首个搜索字段(C5)" -m "此前视口 < 640px 折叠态 0 个字段;按 n-grid 实际的 grid 轨道数判断,只有 1 列这一档变化,2/3/4 列与自定义断点下的行为不变。" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### 对齐设计原型(Task 13b–13g):外观与 `docs/smart-naive-table-design.html` 一模一样(G0 / G3)

> **为什么有这一组**:用户的目标是「设计原型与真实库的预览页面一模一样」。对齐原则(G3):**外观以原型为准(改库);功能取两边并集;原型与 naive-ui 官方冲突时改原型跟官方**。上面 Task 1–13 做的是规格里 P0 的行为与默认值;逐像素对比原型后,还剩下一批「P0 库实现与原型外观不一致」的项(下表 L0-1…L0-9、N11),在 Task 14 收尾之前补齐。
> **与前面 Task 的关系**:本组在 Task 1–13 的代码上改外观。**前面 Task 正文里与本组冲突的描述以本组为准**(Task 6 的「更多」`small`、Task 9 的 `NButton` 漏斗与行内角标、Task 10 的行下分段按钮与 8px 面板内边距、Task 11 的「清除全部」总显示);前面 Task 的代码与测试仍原样落地,本组再按各 Step 里的「查找 / 替换为」改过去,有意改动的既有断言都在对应 Task 里点名。
> **读数方法**:原型 `docs/smart-naive-table-design.html` 与真实库对照页(Task 13b 新增的 `/prototype.html`)在同一个浏览器、同样的视口(1440 × 900,浅 / 深各一遍)下用同一套 DOM 读数比较。**原型的行号是 `8bfe061`(HEAD)里的行号,原型仍在同步修改,以选择器为准**;读数用的是 Edge 无头 + CDP(`getBoundingClientRect` / `getComputedStyle`)。
> **一个系统性差异(不是库的问题,比较时要扣掉)**:原型的 `.n-btn` 有真实的 1px 边框(`box-sizing: border-box`),官方 `NButton` 的边框是 `::before` 画的、**不占布局**,所以原型里每个带边框 / 描边的按钮都比官方宽 2px(例:「更多」原型 74 = 库 72 + 2;「新增」77 = 75 + 2;文字按钮「展开」38 = 36 + 2;面板里 tiny 按钮 38 = 36 + 2)。按 G3「与官方冲突改原型」,这一条应由原型改成不占布局的描边,库不改。**下面各 Task 的「期望读数」都是库侧的数,括号里写原型数。**

| 缺口 | 原型(出处 + 实测) | 库(P0 前述 Task 落地后 / 2.1.1) | 落在 | 2.1.1 外观变了? |
|---|---|---|---|---|
| **L0-1** 工具栏标题 | `.st-title`(`design.html:301`):16px / **500** / `textColor1`(card `titleFontWeight` = `fontWeightStrong`);实测 `16px \| 500 \| rgb(31,34,37)`,暗 `rgba(255,255,255,0.9)` | `h3` 16px / **600** / `textColor2` | 13c | **是**(B 级) |
| **L0-2** 「更多」与工具栏间距 | `.n-btn` medium 34px(`:272-299`);`.tb-actions` gap 8(`:386`)、`.tb-icons` gap 4(`:387`)、`.tb-right` gap 12(`:383`);chevron 12px、`--n-text-3`(= `iconColor` `rgb(194,194,194)`,`:425`);图标按钮 28×28、图标 16×16(实测 `1315,128,16,16`) | 「更多」`size="small"` 28px、chevron 18px 深色;`n-space :size=4` 全部间距 4;图标按钮的图标 18px | 13c | 间距 / 图标 18→16:**是**;「更多」本身是 P0 新增 |
| **L0-3** 漏斗 | `.th-filter`(`:1015-1023`):**22×22**、图标 15px、闲置色 = `thIconColor`(与排序箭头同灰 `rgb(194,194,194)`)、悬停 / 面板打开只加 `thButtonColorHover` 底(`rgba(0,0,100,0.03)`,暗 `rgba(255,255,255,0.06)`)、已筛选才变主色 | `NButton tiny quaternary` 26×22、`textColor1`(比箭头深得多)、打开 / 悬停整个图标变深 | 13d | **是**(B 级) |
| **L0-4** 角标不撑表头 | `.hf-n`(`:1024-1028`):`position:absolute; top:-3px; right:-5px; min-width:12px; height:12px; font:10px/12px 500`,不占宽;标题不折行 | 角标行内占宽(14px + margin),列宽 137 时「物料编码」折成两行,表头 39.4 → 62 | 13d | 角标是 P0 新增(Task 9);**列拖到下限时标题折行撑高表头**是 2.1.1 就有的行为,一并修(见 13d,B 级) |
| **L0-5** 列头面板排布 | `.hpop`(`:1040-1060`)、`hpRowHtml`(`:2319`)、`hpBodyHtml`(`:2333`)、`hpopHtml`(`:2349`):padding 12;首列 56px(第 1 行「条件」12px 灰字,第 2 行起是且 / 或下拉);比较符 112、值 1fr、删除 28(恒占位);行距 12;「添加条件」文字按钮取**官方 small 档**(宽 / 中档:高 28 / 字 14 / 内边距 0 10px / 图标 18;第 4 批原型已从自定 13px / 24px 改成它)、带加号、**深色(不是主色)**;底部 `space-evenly` 的 tiny「重置 / 确认」;options 面板最小 168、选项间距 34.4、「高级条件 ▾」 | 无引导标签;且 / 或是行下方的分段按钮;「添加条件」主色小按钮;底部按钮靠右;内边距 8;options 面板 200 宽、选项间距 28、「高级条件」无箭头 | 13e | 面板本身是 B7 的 P0 新增形态,排布随 B7 |
| **L0-6** chips | `.chips` / `.chip` / `.clear`(`:441-463`)、`hdrChipsHtml`(`:2289`):`type=primary` 的可点 `NTag small round closable`(22px 高),间距 `8px 12px`,行下方 12px;「清除全部」紧跟 chips、**≥ 2 个才出现**;有默认值的表只在**偏离默认**时出现「恢复默认」 | 灰色 NTag、行高 30、「清除全部」靠最右且 1 个 chip 也出现 | 13f | chips 是 P0 新增 |
| **L0-7** 搜索区「展开」 | `.search-card .search-actions .n-btn.text.link`(`:746`):`padding: 0 4px`、与同排 34px 按钮垂直居中(`cy` 同为 136) | `n-space` 默认顶对齐 + 官方文字按钮没有固定高度(实测 28×14,比同排按钮上移 6px) | 13c | **是**(缺陷修复味道) |
| **L0-9** 窄宽度不出屏 | `placeHpop`(`:2359`):`left = max(8, min(left, innerWidth − w − 8))` | `NPopover placement="bottom"` 居中在漏斗上,390 宽下面板 `x = −69`,左侧被裁出屏幕 | 13e | — |
| **N11** 列设置至少保留一列 | 原型第 1 批改为:**只剩一列可见时那一列的勾选框禁用**(无 toast;`design.md` 10.8 N11) | `toggleShow` 允许全部取消,表头只剩勾选 / 操作列 | 13g | **是**(B 级) |
| **N10b** 单选过滤 | `filter.multiple: false` 用官方 `NRadio`(原型第 1 批已改,N10) | 库用 `NCheckbox` 模拟单选;官方 `HeaderButton/FilterMenu.mjs:118-141` 用 `NRadioGroup` / `NRadio` | 13e | **是**(2.1.1 的 `multiple: false` 外观) |
| 类型补全 | — | `SmartTable.vue:84-85` 有 `rowDraggable` / `dragHandle`,导出的 `SmartTableProps`(`types.ts`)没有 | 13g | 纯类型,无外观变化 |
| **不做** | **L0-8** 窄档分页项 40px:归 **P2 窄档尺寸**(随 `cardOnNarrow`);窄档抽屉 / 卡片 / 「操作 ▾」同属 P2;模式 2 条件构造器、批量栏、放大、把手视觉属 P1(L1) | — | — | — |

> **和原型第 1 批对齐后撤掉的两处**:① 值输入的清除 ×:原型原先没有,**决定在原型侧补上**(官方默认就是 `clearable`),库不改;② 面板打开时聚焦「值输入框」:原型第 1 批已改成「第一个可聚焦控件」(与库一致,设计文档 10.8 N8),库不改。
> **对照页宿主层跟原型第 1 批**:不覆盖空状态(官方 `NEmpty`「无数据」)与日期占位(官方 locale 默认);mock 后端 420ms 延迟(刷新 / 搜索 / 翻页 / 排序都有 loading;库的 loading 表现与原型读数一致:表体 `opacity .5` + `pointer-events: none`、正中 28×28 主色 spinner);模块 3 的「单据状态」带 `filter.defaultValue = 未审核`、「部门」是 `filter.multiple: false`。**对照页宿主层暂未复刻的原型场景**(原型第 1 批新增,属 G4 后续批次,**不在 P0 做,另写「对齐补充计划」统一处理**):序号列与固定列、语义色状态标签 / 金额千分位两位小数、搜索区的 `NDatePicker` 范围 / `NSwitch` / `search.render` 自定义控件与「默认本月」、「更多 → 导出」真下载 CSV、「我负责的」`#toolbar` 快捷过滤、负责人的 `filter.render` 自定义面板、删除的 `NPopconfirm`。

> **验证方式**:每个 Task 的「浏览器验证」给出一段可直接粘进 DevTools 控制台的读数脚本和期望数字(库侧);原型侧用同一个浏览器打开 `docs/smart-naive-table-design.html` 读同一批值(选择器见表里的出处),两边对得上才算对齐。**这些步骤要真的做并记录。**

### Task 13b: 原型对照页正式进仓库(`prototype.html`),作为之后逐项对比的工具

> 用**真实库**(`src/`)复刻原型的模块 1–4(搜索区布局 / 按钮与工具栏 / 过滤筛选 / 排序),放在仓库 playground 里,`npm run dev` 后访问 `/prototype.html`(`?m=1..4` 选模块、`?theme=light|dark` 选明暗,缺省 = 原型初始的模块 2、跟随系统主题)。**库做不到的部分一律留空,不用自定义代码假装**(模式 2 条件构造器、批量栏、放大、窄档卡片 / 抽屉 / 「操作 ▾」、列宽把手视觉——它们是 P1 / P2,对照页上看不到就对了)。
> - 外壳(侧栏、面包屑、`NLayout embedded` 灰底)是**宿主**手写的,和原型里一样不是被测对象;被测的是里面那张 `<SmartTable>`。数据是原型同一份确定性 2000 行(`playground/prototype/data.ts` 是 `design.html` 第 1165–1230 行的逐字移植),「后端」`fetcher.ts` 在内存里做搜索 / 列头过滤(用库导出的 `matchFilterValue`)/ 多列排序 / 分页,带原型一致的 420ms 延迟(单测里 `MOCK_DELAY.ms = 0`)。
> - 宿主配置(H 类,已配平):全局默认 `align: 'left'` / `titleAlign: 'left'` / `tag: { size: 'small', bordered: true }` / `labels: { ...zhCNLabels, 若干词改回原型的说法 }`;搜索区 `collapsible` + `labelWidth: 70`(库的 `labelWidth` 含 12px 右内边距 = 62 文字区 + 8);列宽 `width` / `minWidth: 176`(名称列弹性)/ 操作列 `resizable: false`;`fill-height` + 宿主 flex 链(父容器定高);`filter-chips`;`filter.actions` 按字段类型给全 15 个操作符中的推荐集合;模块 3 的「单据状态」`filter.defaultValue`、「部门」`filter.multiple: false`;**空状态、日期占位、loading 不覆盖**(库默认就是官方样子)。
> - 之后 13c–13g 的每个浏览器验证都在这个页面上做,**改库的外观前后各看一眼**。

**Files:**
- Create: `prototype.html`、`playground/prototype/main.ts`、`playground/prototype/ProtoApp.vue`、`playground/prototype/ProtoModule.vue`、`playground/prototype/data.ts`、`playground/prototype/fetcher.ts`
- Modify: `CONTRIBUTING.md`(追加一节)
- Test: `tests/prototype.test.ts`(新建)

**Interfaces:**
- Consumes: Task 1–13 的全部产物(页面只用库的公开导出:`SmartTable`、`SMART_TABLE_DEFAULTS`、`createSmartTableDefaults`、`zhCNLabels`、`matchFilterValue`)。
- Produces: `/prototype.html`(dev 页面,**不进发布包**:`package.json` 的 `files` 只有 `dist`);`playground/prototype/fetcher.ts` 的 `MOCK_DELAY`、`fetchRows`;`playground/prototype/data.ts` 的 `DATA` / `FIELD_DEFS` / `addRow` / `delRow`。

- [ ] **Step 1: 写失败测试**

**新建 `tests/prototype.test.ts`:**

```ts
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { DATA, FIELD_DEFS, addRow, delRow } from '../playground/prototype/data'
import { MOCK_DELAY, fetchRows } from '../playground/prototype/fetcher'
import ProtoApp from '../playground/prototype/ProtoApp.vue'
import type { SmartTableParams } from '../src/types'

// 原型对照页(prototype.html)的「后端」与页面:它是之后逐项对比原型与真实库的工具,
// 数据生成器与原型 docs/smart-naive-table-design.html 是同一份(2000 行、确定性伪随机),
// 这里锁住它,免得改库时顺手改坏了对照页的数据而不自知。

MOCK_DELAY.ms = 0 // 单测不等 420ms

const params = (p: Record<string, unknown> = {}) => ({ page: 1, pageSize: 100, ...p }) as SmartTableParams

describe('对照页数据(与原型同一份生成器)', () => {
  it('2000 行,前 8 行是原型的 DATA_BASE,编码不重复', () => {
    expect(DATA).toHaveLength(2000)
    expect(DATA[0]).toMatchObject({ no: 'M1000-A', name: '不锈钢法兰', status: '已审核', dept: '采购部', amount: 12800 })
    expect(DATA[7].no).toBe('M1099')
    expect(new Set(DATA.map((r) => r.no)).size).toBe(2000)
  })

  it('FIELD_DEFS 是原型的 8 个字段(含只出现在搜索里的「备注」)', () => {
    expect(FIELD_DEFS.map((f) => f.key)).toEqual(['no', 'name', 'owner', 'status', 'dept', 'amount', 'bizDate', 'memo'])
  })

  it('addRow 把「新建物料」放最前并返回编码;delRow 删掉它', () => {
    const before = DATA.length
    const no = addRow()
    expect(no).toBe('M1000-D')
    expect(DATA[0]).toMatchObject({ no, name: '新建物料', status: '未审核' })
    expect(DATA).toHaveLength(before + 1)
    expect(delRow(no)).toBe(true)
    expect(delRow(no)).toBe(false)
    expect(DATA).toHaveLength(before)
  })
})

describe('对照页的「后端」fetchRows', () => {
  it('分页:第 1 页取 100 行,total 是全部 2000', async () => {
    const r = await fetchRows(params())
    expect(r.items).toHaveLength(100)
    expect(r.total).toBe(2000)
    expect(r.items[0].no).toBe('M1000-A')
    const p2 = await fetchRows(params({ page: 2 }))
    expect(p2.items[0].no).toBe(DATA[100].no)
  })

  it('搜索:文本字段是包含(忽略大小写),下拉 / 数字 / 日期是等于', async () => {
    const byNo = await fetchRows(params({ no: 'm1000' }))
    expect(byNo.items.length).toBeGreaterThan(0)
    expect(byNo.items.every((r) => r.no.toLowerCase().includes('m1000'))).toBe(true)
    const byStatus = await fetchRows(params({ status: '已关闭' }))
    expect(byStatus.total).toBe(DATA.filter((r) => r.status === '已关闭').length)
    const byAmount = await fetchRows(params({ amount: '12800' }))
    expect(byAmount.items.every((r) => r.amount === 12800)).toBe(true)
  })

  it('列头过滤:用库导出的 matchFilterValue 求值(物料编码 包含 M10 或 包含 M20)', async () => {
    const r = await fetchRows(
      params({
        filters: [
          {
            field: 'no',
            logic: 'or',
            conditions: [
              { action: 'contains', value: 'M10' },
              { action: 'contains', value: 'M20' },
            ],
          },
        ],
        pageSize: 1000,
      }),
    )
    expect(r.total).toBe(DATA.filter((x) => x.no.includes('M10') || x.no.includes('M20')).length)
    expect(r.items.every((x) => x.no.includes('M10') || x.no.includes('M20'))).toBe(true)
  })

  it('多列排序:sorts 里靠前的优先(部门升序,同部门按金额降序)', async () => {
    const r = await fetchRows(
      params({
        pageSize: 1000,
        sortField: 'dept',
        sortOrder: 'asc',
        sorts: [
          { field: 'dept', order: 'asc' },
          { field: 'amount', order: 'desc' },
        ],
      }),
    )
    for (let i = 1; i < r.items.length; i++) {
      const a = r.items[i - 1]
      const b = r.items[i]
      const c = a.dept.localeCompare(b.dept, 'zh')
      expect(c <= 0).toBe(true)
      if (c === 0) expect(a.amount >= b.amount).toBe(true)
    }
  })

  it('单列排序:只带 sortField / sortOrder 也认', async () => {
    const r = await fetchRows(params({ sortField: 'amount', sortOrder: 'desc' }))
    expect(r.items[0].amount).toBe(Math.max(...DATA.map((x) => x.amount)))
  })
})

describe('MOCK_DELAY(模拟后端延迟)', () => {
  it('默认 420ms(与原型的 mock 后端一致);置 0 不等待', async () => {
    const delay = MOCK_DELAY.ms
    expect(delay).toBe(0) // 本文件顶部已置 0
    MOCK_DELAY.ms = 30
    const t0 = Date.now()
    await fetchRows(params())
    expect(Date.now() - t0).toBeGreaterThanOrEqual(25)
    MOCK_DELAY.ms = 0
  })
})

describe('对照页(ProtoApp:原型的外壳 + 真实库渲染的一张表)', () => {
  // jsdom 没有 matchMedia / ResizeObserver(naive-ui 与虚拟滚动要用),给个最小桩
  const real = { matchMedia: window.matchMedia, ResizeObserver: (globalThis as any).ResizeObserver }
  beforeEach(() => {
    window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })) as any
    ;(globalThis as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  })
  afterEach(() => {
    window.matchMedia = real.matchMedia
    ;(globalThis as any).ResizeObserver = real.ResizeObserver
    document.body.innerHTML = ''
  })

  function mountApp(m: 1 | 2 | 3 | 4) {
    history.replaceState(null, '', `/prototype.html?m=${m}&theme=light`)
    return mount(ProtoApp, { attachTo: document.body })
  }

  it.each([1, 2, 3, 4] as const)('模块 %i:侧栏 4 个模块、标题、工具栏、表头都渲染出来', async (m) => {
    const w = mountApp(m)
    await flushPromises()
    expect(w.findAll('#modList .mod')).toHaveLength(4)
    expect(w.find('.smart-table-title').text()).toBe('物料单据')
    const heads = w.findAll('thead th').map((th) => th.text())
    expect(heads).toEqual(expect.arrayContaining(['物料编码', '物料名称', '负责人', '单据状态', '部门', '金额', '单据日期', '操作']))
    w.unmount()
  })

  it('模块 3:单据状态有默认过滤「未审核」(出现一个 chip);模块 4 没有默认过滤', async () => {
    const m3 = mountApp(3)
    await flushPromises()
    const chips = m3.findAll('.smart-table-chip')
    expect(chips.map((c) => c.text())).toEqual(['单据状态 等于 未审核'])
    m3.unmount()
    const m4 = mountApp(4)
    await flushPromises()
    expect(m4.findAll('.smart-table-chip')).toHaveLength(0)
    m4.unmount()
  })

  it('模块 1 有搜索卡片(中文「展开」),模块 3 的表头有漏斗,模块 2 没有搜索也没有漏斗', async () => {
    const m1 = mountApp(1)
    await flushPromises()
    expect(m1.find('.smart-table-search').exists()).toBe(true)
    expect(m1.find('.smart-table-search').text()).toContain('展开')
    m1.unmount()

    const m3 = mountApp(3)
    await flushPromises()
    expect(m3.findAll('.smart-table-filter-trigger').length).toBeGreaterThan(0)
    m3.unmount()

    const m2 = mountApp(2)
    await flushPromises()
    expect(m2.find('.smart-table-search').exists()).toBe(false)
    expect(m2.findAll('.smart-table-filter-trigger')).toHaveLength(0)
    m2.unmount()
  })
})
```

- [ ] **Step 2: 跑,确认失败**

Run: `npx vitest run tests/prototype.test.ts`
Expected: `Test Files  1 failed (1)`、`Tests  no tests`(实测)—— `Failed to resolve import "../playground/prototype/data" from "tests/prototype.test.ts"`(整个文件加载失败:页面文件还不存在)。

- [ ] **Step 3: 创建页面文件**

**新建 `playground/prototype/ProtoApp.vue`:**

```vue
<script setup lang="ts">
// 对照页宿主外壳:复刻 docs/smart-naive-table-design.html 的侧栏 / 面包屑 / 标题 / NLayout embedded 灰底 / 浅深色切换。
// 外壳本身不是被测对象(原型里也是手写的),被测的是 NLayout 里那张 <SmartTable>。
// URL 参数:?m=1..4(模块)、?theme=light|dark(缺省跟随系统,与原型一致)。
import { computed, onMounted, provide, ref, watch } from 'vue'
import { darkTheme, dateZhCN, NConfigProvider, NLayout, NMessageProvider, zhCN } from 'naive-ui'
import { SMART_TABLE_DEFAULTS, createSmartTableDefaults, zhCNLabels } from '../../src/index'
import ProtoModule from './ProtoModule.vue'

type Mod = 'search' | 'toolbar' | 'filter' | 'sort'
const MODULES: Record<Mod, { no: number; name: string; status: string; statusTxt: string }> = {
  search: { no: 1, name: '搜索区布局', status: 'done', statusTxt: '已定' },
  toolbar: { no: 2, name: '按钮与工具栏', status: 'done', statusTxt: '已定' },
  filter: { no: 3, name: '过滤筛选', status: 'done', statusTxt: '已定' },
  sort: { no: 4, name: '排序', status: 'done', statusTxt: '已定' },
}
const byNo: Record<string, Mod> = { '1': 'search', '2': 'toolbar', '3': 'filter', '4': 'sort' }

const q = new URLSearchParams(location.search)
// 原型初始模块是 toolbar(模块 2)
const mod = ref<Mod>(byNo[q.get('m') ?? ''] ?? 'toolbar')
const theme = ref<'light' | 'dark'>(
  q.get('theme') === 'dark' || q.get('theme') === 'light'
    ? (q.get('theme') as 'light' | 'dark')
    : matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light',
)
watch(theme, (t) => (document.documentElement.dataset.theme = t), { immediate: true })
watch(mod, (m) => {
  const u = new URL(location.href)
  u.searchParams.set('m', String(MODULES[m].no))
  history.replaceState(null, '', u)
})
onMounted(() => {
  document.title = 'SmartTable 设计方案(真实库对照页)'
})

const naiveTheme = computed(() => (theme.value === 'dark' ? darkTheme : null))

/* ------------------------------------------------------------------
   宿主的全局默认(H 类):把库默认值对齐原型
   - align / titleAlign:库默认 center,原型左对齐(金额列在列上写 align: 'right')
   - tag:库默认 { size: small, bordered: false },原型徽标是 NTag small + 默认 bordered
   - labels:用库自带的 zhCNLabels 打底,再把与原型措辞不同的几个词改回原型的说法
   - 其余(density compact、defaultPageSize 100、pageSizes [100,500,1000]、simple 分页、16px 卡片内边距)已是库的 3.0 默认,不用配
------------------------------------------------------------------- */
provide(
  SMART_TABLE_DEFAULTS,
  createSmartTableDefaults({
    align: 'left',
    titleAlign: 'left',
    tag: { size: 'small', bordered: true },
    labels: {
      ...zhCNLabels,
      search: '搜索', // 库中文包「查询」
      filter: '筛选', // 「过滤」
      filterConfirm: '确认', // 「确定」
      filterLike: '类似于', // 「模糊匹配」
      filterStartsWith: '左包含', // 「开头是」
      filterEndsWith: '右包含', // 「结尾是」
      filterIn: 'IN', // 「属于」
      filterNotIn: 'NOT IN', // 「不属于」
      filterNoValue: '不需要填值', // 「无需填值」
    },
  }),
)
</script>

<template>
  <n-config-provider :theme="naiveTheme" :locale="zhCN" :date-locale="dateZhCN" style="display: contents">
    <n-message-provider>
      <div class="app">
        <aside class="side">
          <h1>SmartTable 设计方案</h1>
          <p class="sub">v2.1.1 → 3.0.0 · 2026-09-30</p>
          <div class="group-title">设计模块</div>
          <div id="modList">
            <button v-for="(m, k) in MODULES" :key="k" class="mod" :class="{ on: mod === k }" @click="mod = k">
              <span class="no">{{ m.no }}</span><span class="nm">{{ m.name }}</span>
              <span class="st" :class="m.status">{{ m.statusTxt }}</span>
            </button>
          </div>
          <div id="modPanel">
            <div class="group-title">主题</div>
            <div class="mini">
              <button :class="{ on: theme === 'light' }" @click="theme = 'light'">浅色</button>
              <button :class="{ on: theme === 'dark' }" @click="theme = 'dark'">深色</button>
            </div>
          </div>
        </aside>

        <main class="main">
          <div class="crumb">SmartTable 设计方案 / {{ MODULES[mod].no }}. {{ MODULES[mod].name }}</div>
          <div class="stage-head"><h2>{{ MODULES[mod].name }}</h2></div>
          <div id="stage">
            <!-- 原型 .viewport:宿主页面区域 = NLayout embedded 的灰底,圆角 10px,内边距 22px -->
            <n-layout embedded class="viewport" content-style="display:flex;flex-direction:column;height:100%;padding:22px;box-sizing:border-box;">
              <KeepAlive>
                <ProtoModule :key="mod" :mod="mod" />
              </KeepAlive>
            </n-layout>
          </div>
        </main>
      </div>
    </n-message-provider>
  </n-config-provider>
</template>

<style>
/* 外壳 token(原型 :root / html[data-theme="dark"] 中外壳用到的那部分,改前缀 --px- 避免与 naive 组件根上的 --n-* 撞名) */
:root {
  --px-primary: #18a058;
  --px-on-primary: #ffffff;
  --px-shell-bg: #ececee;
  --px-panel-bg: #ffffff;
  --px-border: rgb(239, 239, 245);
  --px-border-strong: rgb(224, 224, 230);
  --px-text: rgb(51, 54, 57);
  --px-text-2: rgb(118, 124, 130);
  --px-item-hover: rgb(243, 243, 245);
  --px-tag-plain: #eee;
  --px-warn: #d97706;
  --px-ok: #18a058;
}
html[data-theme='dark'] {
  --px-primary: #63e2b7;
  --px-on-primary: #000000;
  --px-shell-bg: #0b0b0e;
  --px-panel-bg: rgb(24, 24, 28);
  --px-border: rgba(255, 255, 255, 0.09);
  --px-border-strong: rgba(255, 255, 255, 0.24);
  --px-text: rgba(255, 255, 255, 0.82);
  --px-text-2: rgba(255, 255, 255, 0.52);
  --px-item-hover: rgba(255, 255, 255, 0.09);
  --px-tag-plain: rgb(51, 51, 51);
  --px-warn: #fbbf24;
  --px-ok: #63e2b7;
}
* { box-sizing: border-box; }
html, body { height: 100%; overflow: hidden; }
html { color-scheme: light; }
html[data-theme='dark'] { color-scheme: dark; }
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro SC', 'PingFang SC', 'Microsoft YaHei', 'Segoe UI', sans-serif;
  font-size: 14px; color: var(--px-text); background: var(--px-shell-bg);
  -webkit-font-smoothing: antialiased;
}

/* ---------- 骨架(原型 .app / .side / .main,含「页面占满视口」片段) ---------- */
.app { line-height: normal; display: grid; grid-template-columns: 232px 1fr; height: 100vh; height: 100dvh; min-height: 0; overflow: hidden; }
.side {
  background: var(--px-panel-bg); border-right: 1px solid var(--px-border);
  padding: 22px 14px 40px; position: sticky; top: 0; height: 100%; overflow-y: auto;
}
.side h1 { font-size: 15px; margin: 0 0 4px; letter-spacing: .2px; font-weight: 700; }
.side .sub { font-size: 11.5px; color: var(--px-text-2); margin: 0 0 18px; line-height: 1.6; }
.side .group-title { font-size: 11px; font-weight: 600; letter-spacing: .08em; color: var(--px-text-2); text-transform: uppercase; margin: 22px 0 8px; }
.mod {
  display: flex; align-items: center; gap: 8px; width: 100%; text-align: left; cursor: pointer;
  border: 1px solid transparent; background: transparent; color: inherit;
  border-radius: 7px; padding: 9px 10px; margin-bottom: 3px; font-family: inherit; font-size: 13px;
  transition: background-color .15s;
}
.mod:hover { background: var(--px-item-hover); }
.mod.on { background: color-mix(in srgb, var(--px-primary) 10%, transparent); border-color: color-mix(in srgb, var(--px-primary) 35%, transparent); font-weight: 600; }
.mod .no { width: 20px; height: 20px; border-radius: 5px; flex: none; font-size: 11px; display: inline-flex; align-items: center; justify-content: center; background: var(--px-tag-plain); color: var(--px-text-2); font-weight: 600; }
.mod.on .no { background: var(--px-primary); color: var(--px-on-primary); }
.mod .nm { flex: 1 1 auto; min-width: 0; }
.mod .st { font-size: 10px; padding: 1px 5px; border-radius: 3px; flex: none; font-weight: 500; }
.st.done { background: color-mix(in srgb, var(--px-ok) 16%, transparent); color: var(--px-ok); }
.mini { display: flex; gap: 6px; }
.mini button { flex: 1; cursor: pointer; font-family: inherit; font-size: 12px; border: 1px solid var(--px-border-strong); background: transparent; color: var(--px-text-2); border-radius: 5px; padding: 5px 8px; transition: background-color .15s, border-color .15s, color .15s; }
.mini button:hover { border-color: var(--px-primary); }
.mini button.on { border-color: var(--px-primary); color: var(--px-primary); background: color-mix(in srgb, var(--px-primary) 10%, transparent); }

.main { padding: 26px 32px 26px; min-width: 0; display: flex; flex-direction: column; min-height: 0; overflow-y: auto; }
.main > * { flex: none; }
.crumb { font-size: 12px; color: var(--px-text-2); margin-bottom: 6px; }
.stage-head { display: flex; align-items: baseline; gap: 12px; margin-bottom: 6px; flex-wrap: wrap; }
.stage-head h2 { margin: 0 0 0; font-size: 20px; letter-spacing: -.01em; font-weight: 700; }
#stage { flex: 1 1 0; min-height: 0; display: flex; flex-direction: column; margin-top: 18px; }
/* 原型 .stage-desc 为空时 display:none,.stage-head 下方到 .viewport 的间距只有 stage-head 的 margin-bottom 6px;这里不再额外留 18px */
#stage { margin-top: 0; }
.viewport.n-layout { flex: 1 1 0; min-height: 0; border-radius: 10px; }
.viewport > .n-layout-scroll-container { overflow: hidden; }

@media (max-width: 860px) {
  .app { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); }
  .side { position: sticky; top: 0; z-index: 20; height: auto; overflow: visible; border-right: 0; border-bottom: 1px solid var(--px-border); padding: 10px 12px; }
  .side h1, .side .sub, .side .group-title, #modPanel { display: none; }
  #modList { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; }
  #modList::-webkit-scrollbar { display: none; }
  .mod { width: auto; flex: none; margin-bottom: 0; white-space: nowrap; }
  .main { padding: 0; }
  .crumb, .stage-head { display: none; }
  .viewport.n-layout { border-radius: 0; }
  .viewport > .n-layout-scroll-container { padding: 12px !important; }
}
</style>
```

**新建 `playground/prototype/ProtoModule.vue`:**

```vue
<script setup lang="ts">
// 对照页的一个模块:用真实库(../../src)复刻原型的一张表。
// 规则:宿主能配的都照原型配(全局默认见 ProtoApp 的 provide、props、插槽里的宿主按钮、fillHeight、collapsible 搜索……);
// 库做不到的(条件构造器、放大、批量栏、窄档卡片 / 操作折叠 / 筛选抽屉……)一律留空,不用自定义代码假装。
// 库默认就对的地方宿主**不覆盖**:空状态(官方 NEmpty「无数据」)、日期占位(官方 locale 的「选择日期」)、loading(NDataTable 官方样子)。
import { h, ref } from 'vue'
import { NButton, NSpace, useMessage } from 'naive-ui'
import { SmartTable, type SmartTableColumn, type SmartTableInst, type FilterAction } from '../../src/index'
import { addRow, delRow, type Row } from './data'
import { fetchRows } from './fetcher'

type Mod = 'search' | 'toolbar' | 'filter' | 'sort'
const props = defineProps<{ mod: Mod }>()

const message = useMessage()
const tableRef = ref<SmartTableInst<Row> | null>(null)
const checked = ref<Array<string | number>>([])
const toast = (msg: string) => message.create(msg, { type: 'default' })

const hdr = props.mod === 'filter' || props.mod === 'sort'

/* ---- 原型 COLS(w = 表格列宽,flex = 弹性列:不写 width、w 当最小宽度) ---- */
const COLS = [
  { key: 'no', label: '物料编码', w: 112 },
  { key: 'name', label: '物料名称', w: 176, flex: true },
  { key: 'owner', label: '负责人', w: 88 },
  { key: 'status', label: '单据状态', w: 96 },
  { key: 'dept', label: '部门', w: 88 },
  { key: 'amount', label: '金额', w: 104 },
  { key: 'bizDate', label: '单据日期', w: 112 },
]

/* ---- 原型 H_CFG:模块 3 = sorter: true(单列互斥);模块 4 = sorter: { multiple: n } + 日期列 defaultSortOrder ---- */
const SORTERS: Record<string, Record<string, any>> = {
  filter: { no: true, amount: true, bizDate: true },
  sort: { dept: { multiple: 3 }, amount: { multiple: 2 }, bizDate: { multiple: 1 } },
}
const sorterOf = (key: string) => (hdr ? SORTERS[props.mod][key] : undefined)

/* 原型 hdrColW:模块 3 / 4 的列宽要放得下「标题 + 漏斗 + 箭头」 */
const colW = (c: (typeof COLS)[number]) =>
  hdr ? Math.max(c.w, 12 + Math.ceil(c.label.length * 14.5) + 30 + (sorterOf(c.key) ? 21 : 0) + 16) : c.w

/* ---- 原型 OPS_BY_TYPE:15 个操作符按字段类型分发;库默认只给 8 个,宿主在列上写 filter.actions 才出现新的 ---- */
const ACT: Record<'text' | 'number' | 'date' | 'select', FilterAction[]> = {
  text: ['contains', 'notContains', 'equal', 'notEqual', 'startsWith', 'endsWith', 'like', 'isNull', 'isNotNull', 'in', 'notIn'],
  number: ['equal', 'notEqual', 'gt', 'gte', 'lt', 'lte', 'isNull', 'isNotNull', 'in', 'notIn'],
  date: ['equal', 'notEqual', 'gt', 'gte', 'lt', 'lte', 'isNull', 'isNotNull'],
  select: ['equal', 'notEqual', 'in', 'notIn', 'isNull', 'isNotNull'],
}

/* 状态徽标:原型里「已审核 / 未审核」是主色 pill,「已关闭」是默认灰 pill */
const statusOptions = [
  { label: '已审核', value: '已审核', tagType: 'primary' as const },
  { label: '未审核', value: '未审核', tagType: 'primary' as const },
  { label: '已关闭', value: '已关闭', tagType: 'default' as const },
]
const deptOptions = ['采购部', '生产部', '仓储部'].map((v) => ({ label: v, value: v }))
const STATUS_DEFAULT = { logic: 'and' as const, conditions: [{ action: 'equal' as const, value: '未审核' }] }

const fieldCol = (c: (typeof COLS)[number] & { flex?: boolean }): SmartTableColumn<Row> => {
  const base: Record<string, any> = { key: c.key, title: c.label }
  if (c.flex) base.minWidth = c.w
  else base.width = colW(c)
  const s = sorterOf(c.key)
  if (s) base.sorter = s
  if (props.mod === 'sort' && c.key === 'bizDate') base.defaultSortOrder = 'descend'

  // 搜索(只模块 1):原型是 n-form-item + 普通输入框 / 下拉;金额、日期原型里是文本输入框(库是 NInputNumber / NDatePicker)
  switch (c.key) {
    case 'status':
      base.options = statusOptions
      base.tag = true
      if (props.mod === 'search') base.search = true
      // 原型模块 3:单据状态带 filter.defaultValue = 未审核 —— 初始过滤态 = 默认值,面板「重置」恢复默认,chips 行末偏离默认时出现「恢复默认」
      if (hdr) base.filter = { actions: ACT.select, ...(props.mod === 'filter' ? { defaultValue: STATUS_DEFAULT } : {}) }
      break
    case 'dept':
      base.options = deptOptions
      if (props.mod === 'search') base.search = true
      // 原型模块 3:部门是单选勾选列(filter.multiple: false,官方用 NRadio)
      if (hdr) base.filter = { actions: ACT.select, ...(props.mod === 'filter' ? { multiple: false } : {}) }
      break
    case 'amount':
      base.align = 'right' // 原型:金额单元格右对齐,表头仍左对齐(titleAlign 取全局默认 left)
      base.format = (v: unknown) => Number(v).toLocaleString()
      if (props.mod === 'search') base.search = { type: 'number', placeholder: '请输入数字', props: { clearable: false, showButton: false } }
      if (hdr) base.filter = { type: 'number', actions: ACT.number }
      break
    case 'bizDate':
      if (props.mod === 'search') base.search = { type: 'date' }
      if (hdr) base.filter = { type: 'date', actions: ACT.date }
      break
    default:
      if (props.mod === 'search') base.search = { placeholder: '请输入', props: { clearable: false } }
      if (hdr) base.filter = { type: 'input', actions: ACT.text }
  }
  return base as SmartTableColumn<Row>
}

const columns: SmartTableColumn<Row>[] = [
  { type: 'selection', width: 40 },
  ...COLS.map(fieldCol),
  // 备注:只在模块 1 的搜索表单里出现,不进表格(原型 FIELD_DEFS 有 memo、COLS 没有)
  ...(props.mod === 'search'
    ? [{ key: 'memo', title: '备注', hideInTable: true, search: { placeholder: '请输入', props: { clearable: false } } } as SmartTableColumn<Row>]
    : []),
  {
    key: 'actions',
    title: '操作',
    width: 112,
    resizable: false, // 原型:操作列没有拖拽把手、也不吸收余量
    hideInSetting: true,
    render: (row: Row) =>
      h(NSpace, { size: 12, wrapItem: false }, () => [
        h(NButton, { text: true, onClick: () => toast(`正在编辑 ${row.no}`) }, () => '编辑'),
        h(NButton, { text: true, type: 'error', onClick: () => onDel(row.no) }, () => '删除'),
      ]),
  } as SmartTableColumn<Row>,
]

/* 「更多」菜单:官方 NDropdown options 原样透传;选中后库发 moreSelect,导出 / 导入由宿主处理 */
const moreOptions = [
  { label: '导出', key: 'export' },
  { label: '导入', key: 'import' },
  { type: 'divider' as const, key: 'd1' },
  { label: '下载导入模板', key: 'tpl' },
]
function onMore(key: string | number) {
  if (key === 'export') toast(`已导出 ${tableRef.value?.pagination.itemCount ?? 0} 条`)
  else if (key === 'import') toast('请选择要导入的文件')
  else if (key === 'tpl') toast('已下载导入模板')
}

async function onAdd() {
  const no = addRow()
  await tableRef.value?.refresh()
  toast(`已新增 ${no}`)
}
async function onDel(no: string) {
  if (delRow(no)) {
    await tableRef.value?.refresh()
    toast(`已删除 ${no}`)
  }
}

/* 模块 1 的搜索区:首行 + 展开 / 收起(collapsible);label 区 70px(库的 labelWidth 含 12px 右内边距 = 原型 62px 文字区 + 8px 间距) */
const searchCfg = props.mod === 'search' ? { collapsible: true, labelWidth: 70 } : undefined
</script>

<template>
  <div class="proto-host">
    <SmartTable
      ref="tableRef"
      :columns="columns"
      :fetcher="fetchRows"
      row-key="no"
      title="物料单据"
      :search="searchCfg"
      :toolbar="{ more: moreOptions }"
      fill-height
      resizable
      :filter-chips="hdr"
      v-model:checked-row-keys="checked"
      @more-select="onMore"
    >
      <template #toolbar-right>
        <!-- 原型的「新增」图标是 13px;官方 NButton 的图标盒默认 18px(会让按钮宽 3px),所以宿主这里把 iconSizeMedium 调成 13px -->
        <n-button :type="mod === 'search' ? 'default' : 'primary'" :theme-overrides="{ iconSizeMedium: '13px' }" @click="onAdd">
          <template #icon>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M8 3v10M3 8h10" /></svg>
          </template>
          新增
        </n-button>
      </template>
      <template #pagination-prefix="info">共 {{ info.itemCount }} 条</template>
    </SmartTable>
  </div>
</template>

<style scoped>
/* 宿主给 fillHeight 的确定高度:flex 链末端(.viewport 内的剩余高度) */
.proto-host {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.proto-host > :deep(.smart-table) {
  flex: 1 1 0;
}
</style>
```

**新建 `playground/prototype/data.ts`:**

```ts
// 原型 docs/smart-naive-table-design.html 第 1165–1230 行的数据生成器,原样移植(2000 行确定性伪随机,前 8 行为 DATA_BASE)。
export interface Row {
  no: string
  name: string
  owner: string
  status: string
  dept: string
  amount: number
  bizDate: string
  memo: string
}

export const FIELD_DEFS = [
  { key: 'no', label: '物料编码', type: 'text' },
  { key: 'name', label: '物料名称', type: 'text' },
  { key: 'owner', label: '负责人', type: 'text' },
  { key: 'status', label: '单据状态', type: 'select', options: ['已审核', '未审核', '已关闭'] },
  { key: 'dept', label: '部门', type: 'select', options: ['采购部', '生产部', '仓储部'] },
  { key: 'amount', label: '金额', type: 'number' },
  { key: 'bizDate', label: '单据日期', type: 'date' },
  { key: 'memo', label: '备注', type: 'text' },
] as const

const DATA_BASE: Row[] = [
  { no: 'M1000-A', name: '不锈钢法兰',   owner: '张伟', status: '已审核', dept: '采购部', amount: 12800, bizDate: '2026-09-21', memo: '加急' },
  { no: 'M1000-B', name: '不锈钢弯头',   owner: '李娜', status: '已审核', dept: '采购部', amount: 3400,  bizDate: '2026-09-20', memo: '' },
  { no: 'M1024',   name: '碳钢管件',     owner: '王强', status: '未审核', dept: '生产部', amount: 980,   bizDate: '2026-08-18', memo: '待核价' },
  { no: 'M2011',   name: '密封垫片',     owner: '刘洋', status: '已关闭', dept: '仓储部', amount: 260,   bizDate: '2026-07-17', memo: '' },
  { no: 'M1000-C', name: '不锈钢三通',   owner: '张伟', status: '已审核', dept: '生产部', amount: 25600, bizDate: '2026-09-12', memo: '样品' },
  { no: 'M3050',   name: '高压球阀',     owner: '陈静', status: '未审核', dept: '采购部', amount: 47200, bizDate: '2026-06-30', memo: '' },
  { no: 'M2087',   name: '测试专用件',   owner: '李娜', status: '已关闭', dept: '生产部', amount: 120,   bizDate: '2026-05-11', memo: '测试' },
  { no: 'M1099',   name: '不锈钢螺栓',   owner: '赵磊', status: '已审核', dept: '仓储部', amount: 1560,  bizDate: '2026-09-02', memo: '' },
]

const DATA_TOTAL = 2000
function mulberry32(seed: number) {
  return function () {
    seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function genRows(base: Row[], total: number): Row[] {
  const rnd = mulberry32(20260929)
  const pick = <V,>(arr: V[]): V => arr[Math.floor(rnd() * arr.length)]
  const wpick = (pairs: [string, number][]) => { let x = rnd() * pairs.reduce((s, p) => s + p[1], 0); for (const [v, w] of pairs) { if ((x -= w) < 0) return v } return pairs[0][0] }
  const MATERIALS = ['不锈钢', '碳钢', '合金钢', '铸钢', '镀锌', '黄铜', '铝合金']
  const PIPE = ['法兰', '弯头', '三通', '球阀', '闸阀', '截止阀', '管件', '大小头', '接头']
  const BOLT = ['螺栓', '螺母', '垫片']
  const DN = ['DN15', 'DN20', 'DN25', 'DN32', 'DN40', 'DN50', 'DN65', 'DN80', 'DN100', 'DN125', 'DN150', 'DN200']
  const BOLT_SPEC = ['M8', 'M10', 'M12', 'M16', 'M20', 'M24']
  const OWNERS = ['张伟', '李娜', '王强', '刘洋', '陈静', '赵磊', '周敏', '吴凡', '郑浩', '孙婷', '黄磊', '何欣']
  const MEMOS = ['加急', '待核价', '样品', '测试', '补货', '返工', '质检中', '已比价', '客户指定', '缺货']
  const DAY0 = Date.UTC(2026, 0, 1), DAYS = 272   // 2026-01-01 ~ 2026-09-29 共 272 天
  const used = new Set(base.map(r => r.no))
  const rows: Row[] = []
  while (rows.length < total - base.length) {
    let no: string
    do { no = 'M' + (1001 + Math.floor(rnd() * 8999)) + (rnd() < 0.25 ? '-' + 'ABCDEF'[Math.floor(rnd() * 6)] : '') } while (used.has(no))
    used.add(no)
    const isBolt = rnd() < 0.18
    const name = isBolt ? `${pick(MATERIALS)}${pick(BOLT)} ${pick(BOLT_SPEC)}` : `${pick(MATERIALS)}${pick(PIPE)} ${pick(DN)}`
    rows.push({
      no, name, owner: pick(OWNERS),
      status: wpick([['已审核', 55], ['未审核', 32], ['已关闭', 13]]),
      dept: wpick([['采购部', 40], ['生产部', 35], ['仓储部', 25]]),
      amount: Math.round(100 + Math.pow(rnd(), 2) * 59900),
      bizDate: new Date(DAY0 + Math.floor(rnd() * DAYS) * 864e5).toISOString().slice(0, 10),
      memo: rnd() < 0.2 ? pick(MEMOS) : '',
    })
  }
  return rows.sort((a, b) => (a.bizDate < b.bizDate ? 1 : a.bizDate > b.bizDate ? -1 : (a.no < b.no ? -1 : 1)))   // 新单据在前
}
export const DATA: Row[] = [...DATA_BASE.map(r => ({ ...r })), ...genRows(DATA_BASE, DATA_TOTAL)]

/** 原型 nextNo / addRow:新增一行「新建物料」放最前(宿主业务逻辑,库不管)。 */
function nextNo() {
  const used = new Set(DATA.map(r => r.no))
  const seq = [...'DEFGHIJKLMNOPQRSTUVWXYZABC']
  for (const ch of seq) if (!used.has('M1000-' + ch)) return 'M1000-' + ch
  let n = 1
  while (used.has('M1000-' + n)) n++
  return 'M1000-' + n
}
export function addRow(): string {
  const row: Row = { no: nextNo(), name: '新建物料', owner: '张伟', status: '未审核', dept: '采购部', amount: 0, bizDate: '2026-09-29', memo: '' }
  DATA.unshift(row)
  return row.no
}
export function delRow(no: string): boolean {
  const i = DATA.findIndex(r => r.no === no)
  if (i < 0) return false
  DATA.splice(i, 1)
  return true
}
```

**新建 `playground/prototype/fetcher.ts`:**

```ts
// 宿主的「后端」:对 2000 行内存数据做 搜索 / 列头过滤 / 多列排序 / 分页。
// 库是远程模式(fetcher)——过滤与排序归后端,这里用库导出的 matchFilterValue 当「后端求值器」。
// 搜索语义照原型 sfConds():text → 包含(忽略大小写),select / number / date → 等于。
import { matchFilterValue, type PageResult, type SerializedFilter, type SmartTableParams } from '../../src/index'
import { DATA, FIELD_DEFS, type Row } from './data'

function cmp(a: unknown, b: unknown) {
  const na = Number(a), nb = Number(b)
  if (!Number.isNaN(na) && !Number.isNaN(nb) && a !== '' && b !== '') return na === nb ? 0 : na > nb ? 1 : -1
  const sa = String(a), sb = String(b)
  return sa === sb ? 0 : sa > sb ? 1 : -1
}

/** 模拟后端延迟:原型的 mock 后端是 420ms(刷新 / 搜索 / 翻页 / 排序都有 loading)。测试里置 0。 */
export const MOCK_DELAY = { ms: 420 }

export async function fetchRows(params: SmartTableParams): Promise<PageResult<Row>> {
  if (MOCK_DELAY.ms > 0) await new Promise((r) => setTimeout(r, MOCK_DELAY.ms))
  let rows: Row[] = DATA
  for (const f of FIELD_DEFS) {
    const v = params[f.key]
    if (v === undefined || v === null || String(v).trim() === '') continue
    rows = rows.filter((r) =>
      f.type === 'text'
        ? String(r[f.key]).toLowerCase().includes(String(v).trim().toLowerCase())
        : cmp(r[f.key], String(v).trim()) === 0,
    )
  }
  const filters = params.filters as SerializedFilter[] | undefined
  if (Array.isArray(filters)) {
    for (const f of filters) {
      rows = rows.filter((r) => matchFilterValue({ logic: f.logic, conditions: f.conditions }, r[f.field as keyof Row]))
    }
  }
  // 排序:多列用 params.sorts(高优先级在前),单列用 sortField / sortOrder;比较器照原型 computeRows
  const sorts: Array<{ field: string; order: 'asc' | 'desc' }> | undefined =
    params.sorts ?? (params.sortField ? [{ field: params.sortField, order: params.sortOrder }] : undefined)
  if (sorts?.length) {
    rows = rows.slice().sort((a, b) => {
      for (const s of sorts) {
        const x = a[s.field as keyof Row], y = b[s.field as keyof Row]
        const c = typeof x === 'number' ? x - (y as number) : String(x).localeCompare(String(y), 'zh')
        if (c) return s.order === 'asc' ? c : -c
      }
      return 0
    })
  }
  const { page, pageSize } = params
  return { items: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length }
}
```

**新建 `playground/prototype/main.ts`:**

```ts
import { createApp } from 'vue'
import ProtoApp from './ProtoApp.vue'

createApp(ProtoApp).mount('#app')
```

**新建 `prototype.html`:**

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>SmartTable 设计方案(真实库对照页)</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/playground/prototype/main.ts"></script>
  </body>
</html>
```

再在 `CONTRIBUTING.md` 末尾追加一节:

**`CONTRIBUTING.md` 追加到文件末尾:**

```markdown
## 对照设计原型

`npm run dev` 后访问 `/prototype.html`(`?m=1..4` 选模块,`?theme=light|dark` 选明暗):用真实库复刻 `docs/smart-naive-table-design.html` 的模块 1–4,与原型并排逐项比较外观与行为。库做不到的部分留空,不用自定义代码假装。改库的外观 / 排布前后都对着它看一眼。
```

- [ ] **Step 4: 跑,确认通过**

Run: `npm test && npm run typecheck`
Expected: `Test Files  21 passed (21)`、`Tests  351 passed (351)`(336 + 15:`prototype.test.ts` 15 条);typecheck 无输出;无 `[Vue warn]`。

- [ ] **Step 5: 浏览器验证(页面本身)**

Run: `node_modules/.bin/vite --port 5173`,打开 `http://localhost:5173/prototype.html?m=3`;另开一个标签页用 `file://` 打开 `docs/smart-naive-table-design.html`、点侧栏「3 过滤筛选」。两边同为 1440 × 900、浅色。用控制台读(库侧;原型侧把选择器换成 `tbody tr`、`.chip`):
```js
(async () => {
  await new Promise((r) => setTimeout(r, 700))
  return {
    total: document.querySelector('.n-pagination').innerText.replace(/\s+/g, ' '),
    heads: [...document.querySelectorAll('thead th')].map((t) => t.innerText.trim()).join('|'),
    firstRow: document.querySelectorAll('.n-data-table-tr')[1].innerText.replace(/\s+/g, ' ').slice(0, 60),
    chips: [...document.querySelectorAll('.smart-table-chip')].map((c) => c.innerText.trim()),
  }
})()
```
Expected(模块 3,库侧):`total` = `共 676 条 / 7 100 / 页`(单据状态默认「未审核」→ 676 / 2000 条,每页 100 → 7 页),`firstRow` = `M1024 碳钢管件 王强 未审核 生产部 980 2026-08-18 编辑 删除`,`chips` = `["单据状态 等于 未审核"]`(这个 chip 行末的按钮规则在 Task 13f 才对齐原型,此刻先不看)。**原型同一模块读数**:总条数 676、首行 M1024 碳钢管件 王强 未审核 生产部 980、同一个 chip(原型多一个序号列、金额带两位小数,属上面写明的宿主层暂未复刻项)。模块 4 首行均为 `M5141 不锈钢球阀 DN150 张伟 已审核 生产部 11,199`、共 2000 条。模块 1–4 的初始视口、卡片、工具栏、表头、两张卡片位置在 1100 宽下与原型逐像素相同(第一轮对照已核)。
再确认:点「刷新」→ 420ms 内表体半透明且点不动、正中出现 28×28 主色 spinner(读数:`.n-data-table-wrapper` 的 `opacity` = 0.5、`pointer-events` = none、`.n-data-table-loading-wrapper` = 28×28 且中心落在 `.n-data-table` 的正中,与原型 `.dt.loading` 读数相同);**空状态是官方 `NEmpty`**:给「物料编码」加条件「包含 `ZZZ`」→ 表体正中显示 40px 空盒图标 +「无数据」(`.n-data-table .n-empty` 的 `innerText` = `无数据`,有 `.n-empty__icon`),分页显示 `共 0 条`;**宿主没有覆盖空状态文案 / 图标**;模块 1 搜索区的日期框占位是官方 locale 的「选择日期」(不是 `yyyy-MM-dd`)。

- [ ] **Step 6: 提交**

```bash
git add prototype.html playground/prototype tests/prototype.test.ts CONTRIBUTING.md
git commit -m "feat(playground): 原型对照页 /prototype.html(真实库复刻设计原型模块 1–4)" -m "后续逐项对齐原型外观(L0-1…L0-9、N11)都靠它并排对比;库做不到的部分留空。不进发布包。" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 13c: 工具栏与搜索区操作区对齐原型(L0-1、L0-2、L0-7)

> - **L0-1 标题**:字重 / 颜色取主题 `fontWeightStrong`(500)/ `textColor1`(与官方卡片标题一致;`card/styles/light.mjs:36,39`),走 `useThemeVars()`(库自己的元素不依赖 `NCard` 的 `--n-*` 变量)。**2.1.1 是 600 / `textColor2`,外观变了 → CHANGELOG B 级**。
> - **L0-2 工具栏**:右侧拆成两组——**业务组**(宿主 `#toolbar-right` 的按钮 + 「更多」,间距 8)与**图标组**(刷新 / 密度 / 列设置 `#settings`,间距 4),两组之间 12(原型 `.tb-actions` / `.tb-icons` / `.tb-right`)。空组不画(否则空容器会多一个 12px 的间距)。「更多」改默认 medium(34px,与宿主业务按钮同高),chevron 12px、`iconColor`、右内边距 12(chevron 自带的 `margin-right: -2px` 折进去),文字按钮;图标按钮的图标 **16px**(官方 small 圆形按钮默认 18px;用一个 `abstract` 的 `NConfigProvider` 给整组按钮覆盖 `iconSizeSmall`,不多包 DOM,`#settings` 插槽里的列设置按钮同样生效);`ChevronDownIcon` 等小图标换成与原型 `I_CHEV` / `I_X` / `I_PLUS` 同一套几何(16 视口、笔画 1.8 / 1.6,12–13px 下不会比 24 视口 + 笔画 2 细一圈)——图标换几何放在 Task 13e(那里才用到 `CloseIcon` / `PlusIcon`),这里只改工具栏。**2.1.1 的间距(全 4)与图标尺寸(18)变了 → CHANGELOG B 级**。
> - **L0-7 搜索区「展开 / 收起」**:`n-space` 加 `align="center"`;官方文字按钮的 `--n-height` 是 `initial`(没有固定高度、没有内边距,实测 28 × 14),所以「展开」按钮自己加 `height: themeVars.heightMedium`(与同排 34px 按钮同高)和 `padding: 0 4px`。**修复 2.1.1 的错位(上移 6px),CHANGELOG 记缺陷修复**。
> - 回退方式见 Task 14 的 CHANGELOG(标题:`#title` 插槽里自己包 `<span style="font-weight:600">`;业务组间距:宿主用 `<n-space :size="4">` 包自己的按钮;图标 18px:宿主 CSS `--n-icon-size: 18px !important`)。

**Files:**
- Modify: `src/Toolbar.vue`、`src/SearchForm.vue`
- Test: `tests/Toolbar.test.ts`、`tests/SearchForm.test.ts`(追加)

**Interfaces:**
- Consumes: Task 6 的 `Toolbar.vue`(`toolbar.more`)、Task 13 的 `SearchForm.vue`。
- Produces: CSS 类 `smart-table-toolbar-right` / `smart-table-toolbar-actions` / `smart-table-toolbar-icons` / `smart-table-more-icon`、`smart-table-search-toggle`;`Toolbar.vue` 不再用 `NSpace`。

- [ ] **Step 1: 写失败测试**

**`tests/SearchForm.test.ts` 追加到文件末尾:**

```ts

describe('SearchForm 操作区对齐(L0-7)', () => {
  it('搜索 / 重置 / 展开 同排垂直居中(n-space align=center),不再默认顶对齐', () => {
    const w = mountForm('150px 150px')
    const space = w.find('.smart-table-search .n-space')
    expect(space.attributes('style')).toContain('align-items: center')
    w.unmount()
  })

  it('「展开」文字按钮与同排按钮同高(主题 heightMedium = 34px;官方文字按钮自己的高度是 initial)', () => {
    const w = mountForm('150px 150px')
    const toggle = w.find('.smart-table-search-toggle')
    expect(toggle.exists()).toBe(true)
    expect(toggle.text()).toBe('Expand')
    expect(toggle.attributes('style')).toContain('height: 34px')
    w.unmount()
  })
})
```

**`tests/Toolbar.test.ts` 查找(整段,原样):**

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Toolbar from '../src/Toolbar.vue'
import { defaultLabels } from '../src/labels'
import { NDropdown } from 'naive-ui'

const mountToolbar = (config: Record<string, unknown> | false = {}, extra: Record<string, unknown> = {}) =>
  mount(Toolbar, { props: { labels: defaultLabels, config: config as never, density: 'compact' as const, ...extra } })
```

**替换为:**

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import Toolbar from '../src/Toolbar.vue'
import { defaultLabels } from '../src/labels'
import { NConfigProvider, NDropdown, darkTheme } from 'naive-ui'

const mountToolbar = (config: Record<string, unknown> | false = {}, extra: Record<string, unknown> = {}) =>
  mount(Toolbar, { props: { labels: defaultLabels, config: config as never, density: 'compact' as const, ...extra } })
```

**`tests/Toolbar.test.ts` 追加到文件末尾:**

```ts

describe('Toolbar 外观对齐原型(L0-1 / L0-2)', () => {
  const opts = [{ label: '导出', key: 'export' }]

  it('[L0-1] 标题:字重 500(fontWeightStrong)、颜色 textColor1;不是 2.1.1 的 600 / textColor2', () => {
    const style = mountToolbar({}, { title: '物料单据' }).find('.smart-table-title').attributes('style') ?? ''
    expect(style).toContain('font-weight: 500')
    expect(style).toContain('color: rgb(31, 34, 37)') // 默认亮色主题的 textColor1
  })

  it('[L0-1] 标题颜色跟主题走:暗色是 textColor1 的暗色值', () => {
    const Host = defineComponent({
      render: () =>
        h(NConfigProvider, { theme: darkTheme }, () =>
          h(Toolbar, { labels: defaultLabels, config: {}, density: 'compact', title: '物料单据' }),
        ),
    })
    const style = mount(Host).find('.smart-table-title').attributes('style') ?? ''
    expect(style).toContain('color: rgba(255, 255, 255, 0.9)')
  })

  it('[L0-2]「更多」是 medium(34px,与宿主按钮同高),不再是 small;chevron 取 iconColor', () => {
    const wrapper = mountToolbar({ more: opts })
    const btn = wrapper.find('button[aria-label="More"]')
    expect(btn.attributes('style')).toContain('--n-height: 34px')
    expect(wrapper.find('.smart-table-more-icon').attributes('style')).toContain('color: rgb(194, 194, 194)')
  })

  it('[L0-2] 分组:宿主按钮 + 「更多」在 actions 组(间距 8),内置图标在 icons 组(间距 4),两组并排(间距 12)', () => {
    const wrapper = mount(Toolbar, {
      props: { labels: defaultLabels, config: { more: opts } as never, density: 'compact' as const },
      slots: { right: '<i class="host-btn">新增</i>', settings: '<i class="settings-btn">设置</i>' },
    })
    const right = wrapper.find('.smart-table-toolbar-right')
    expect(right.exists()).toBe(true)
    const [actions, icons] = right.element.children
    expect(actions.classList.contains('smart-table-toolbar-actions')).toBe(true)
    expect(icons.classList.contains('smart-table-toolbar-icons')).toBe(true)
    expect(actions.querySelector('.host-btn')).not.toBeNull()
    expect(actions.querySelector('button[aria-label="More"]')).not.toBeNull()
    expect(icons.querySelector('button[aria-label="Refresh"]')).not.toBeNull()
    expect(icons.querySelector('.settings-btn')).not.toBeNull()
    expect(actions.querySelector('button[aria-label="Refresh"]')).toBeNull()
  })

  it('[L0-2] 内置图标按钮(刷新 / 密度 / 列设置 #settings 里的按钮)图标 16px,不是官方 small 的 18px;「更多」不受影响', () => {
    const wrapper = mount(Toolbar, {
      props: { labels: defaultLabels, config: { more: opts, density: true } as never, density: 'compact' as const },
      slots: { settings: '<button class="settings-btn" aria-label="Columns">列</button>' },
    })
    for (const label of ['Refresh', 'Density']) {
      expect(wrapper.find(`button[aria-label="${label}"]`).attributes('style')).toContain('--n-icon-size: 16px')
    }
    expect(wrapper.find('button[aria-label="More"]').attributes('style')).toContain('--n-icon-size: 12px')
  })

  it('[L0-2] 没有宿主按钮也没有「更多」时不画 actions 组(否则空容器会多出一个 12px 的间距)', () => {
    const wrapper = mountToolbar({})
    expect(wrapper.find('.smart-table-toolbar-actions').exists()).toBe(false)
    expect(wrapper.find('.smart-table-toolbar-icons').exists()).toBe(true)
  })

  it('[L0-2] 图标全关(toolbar: false)时也不画 icons 组', () => {
    expect(mountToolbar(false).find('.smart-table-toolbar-icons').exists()).toBe(false)
  })
})
```

- [ ] **Step 2: 跑,确认失败**

Run: `npx vitest run tests/SearchForm.test.ts tests/Toolbar.test.ts`
Expected: `Test Files  2 failed (2)`、`Tests  8 failed | 14 passed (22)`(实测)—— `Toolbar.test.ts` 6 条红(标题字重 / 颜色 ×2:`expected '' to contain 'font-weight: 500'`;「更多」`--n-height` 不是 34px;图标 `--n-icon-size` 不是 16px;没有 `.smart-table-toolbar-right` 分组;空 actions 组仍会画),`SearchForm.test.ts` 2 条红(`n-space` 没有 `align-items: center`;没有 `.smart-table-search-toggle`)。「toolbar: false 时不画 icons 组」那条此刻本来就绿(类还不存在),它守住实现后的行为。

- [ ] **Step 3: 实现**

**`src/SearchForm.vue` 查找(整段,原样)(第 1 / 4 处):**

```vue
  NSelect,
  NSpace,
  NSwitch,
} from 'naive-ui'
import type { CardProps } from 'naive-ui'
import type { SelectMixedOption } from 'naive-ui/es/select/src/interface'
```

**替换为:**

```vue
  NSelect,
  NSpace,
  NSwitch,
  useThemeVars,
} from 'naive-ui'
import type { CardProps } from 'naive-ui'
import type { SelectMixedOption } from 'naive-ui/es/select/src/interface'
```

**`src/SearchForm.vue` 查找(整段,原样)(第 2 / 4 处):**

```vue
  reset: []
}>()

const isInline = computed(() => props.config.layout === 'inline')

// 折叠:仅 grid 布局;collapsed 初始跟随 config.collapsible。
```

**替换为:**

```vue
  reset: []
}>()

const themeVars = useThemeVars()
const isInline = computed(() => props.config.layout === 'inline')

// 折叠:仅 grid 布局;collapsed 初始跟随 config.collapsible。
```

**`src/SearchForm.vue` 查找(整段,原样)(第 3 / 4 处):**

```vue
            <component :is="() => renderField(f)" />
          </n-form-item-gi>
          <n-form-item-gi suffix>
            <n-space>
              <n-button type="primary" :loading="loading" @click="emit('search')">{{ labels.search }}</n-button>
              <n-button @click="emit('reset')">{{ labels.reset }}</n-button>
              <n-button v-if="collapsible" text type="primary" @click="collapsed = !collapsed">
                {{ collapsed ? labels.expand : labels.collapse }}
              </n-button>
            </n-space>
```

**替换为:**

```vue
            <component :is="() => renderField(f)" />
          </n-form-item-gi>
          <n-form-item-gi suffix>
            <n-space align="center">
              <n-button type="primary" :loading="loading" @click="emit('search')">{{ labels.search }}</n-button>
              <n-button @click="emit('reset')">{{ labels.reset }}</n-button>
              <n-button v-if="collapsible" class="smart-table-search-toggle" :style="{ height: themeVars.heightMedium }" text type="primary" @click="collapsed = !collapsed">
                {{ collapsed ? labels.expand : labels.collapse }}
              </n-button>
            </n-space>
```

**`src/SearchForm.vue` 查找(整段,原样)(第 4 / 4 处):**

```vue
</template>

<style scoped>
.smart-table-search-inline-row {
  display: flex;
  flex-wrap: wrap;
```

**替换为:**

```vue
</template>

<style scoped>
/* 「展开 / 收起」:官方文字按钮没有固定高度和内边距(--n-height 是 initial,实测 28×14,比同排 34px 的按钮矮、还窄 8px);
   与设计原型一致:高度与同排按钮同高(模板里取主题的 heightMedium)、左右内边距 4px */
.smart-table-search-toggle {
  padding: 0 4px;
}
.smart-table-search-inline-row {
  display: flex;
  flex-wrap: wrap;
```

**`src/Toolbar.vue` 查找(整段,原样)(第 1 / 5 处):**

```vue
<script setup lang="ts">
// 表格卡片头:标题 + 左侧操作区(#left)+ 右侧:宿主按钮(#right)、「更多」菜单、内置图标(刷新/密度/列设置 #settings)。
import { computed, type PropType } from 'vue'
import { NButton, NDropdown, NSpace, NTooltip } from 'naive-ui'
import type { DropdownOption } from 'naive-ui'
import type { Density, SmartTableLabels, ToolbarConfig, ToolbarMoreOption } from './types'
import { ChevronDownIcon, DensityIcon, RefreshIcon } from './icons'
```

**替换为:**

```vue
<script setup lang="ts">
// 表格卡片头:标题 + 左侧操作区(#left)+ 右侧:宿主按钮(#right)、「更多」菜单、内置图标(刷新/密度/列设置 #settings)。
import { computed, type PropType } from 'vue'
import { NButton, NConfigProvider, NDropdown, NTooltip, useThemeVars } from 'naive-ui'
import type { DropdownOption } from 'naive-ui'
import type { Density, SmartTableLabels, ToolbarConfig, ToolbarMoreOption } from './types'
import { ChevronDownIcon, DensityIcon, RefreshIcon } from './icons'
```

**`src/Toolbar.vue` 查找(整段,原样)(第 2 / 5 处):**

```vue
  moreSelect: [key: string | number, option: DropdownOption]
}>()

const cfg = computed<ToolbarConfig>(() => (props.config === false ? { refresh: false, density: false, columnSettings: false } : props.config))

const densityOptions = computed(() => [
```

**替换为:**

```vue
  moreSelect: [key: string | number, option: DropdownOption]
}>()

const themeVars = useThemeVars()

const cfg = computed<ToolbarConfig>(() => (props.config === false ? { refresh: false, density: false, columnSettings: false } : props.config))

const densityOptions = computed(() => [
```

**`src/Toolbar.vue` 查找(整段,原样)(第 3 / 5 处):**

```vue
  return selectable ? list : []
})

function onMoreSelect(key: string | number, option: DropdownOption) {
  emit('moreSelect', key, option)
}
```

**替换为:**

```vue
  return selectable ? list : []
})

// 内置图标组:刷新 / 密度 / 列设置(#settings)。一个都没有时整组不画,免得空容器多出一个组间距。
const showRefresh = computed(() => cfg.value.refresh !== false && props.remote)

function onMoreSelect(key: string | number, option: DropdownOption) {
  emit('moreSelect', key, option)
}
```

**`src/Toolbar.vue` 查找(整段,原样)(第 4 / 5 处):**

```vue
<template>
  <div class="smart-table-toolbar">
    <div class="smart-table-toolbar-main">
      <h3 v-if="$slots.title || title" class="smart-table-title">
        <slot name="title">{{ title }}</slot>
      </h3>
      <slot name="left" />
    </div>
    <n-space :size="4" align="center">
      <slot name="right" />
      <n-dropdown v-if="moreOptions.length" trigger="click" placement="bottom-end" :options="moreOptions" @select="onMoreSelect">
        <n-button size="small" icon-placement="right" :aria-label="labels.more">
          {{ labels.more }}
          <template #icon><ChevronDownIcon /></template>
        </n-button>
      </n-dropdown>
      <n-tooltip v-if="cfg.refresh !== false && remote" trigger="hover">
        <template #trigger>
          <n-button quaternary circle size="small" :aria-label="labels.refresh" @click="emit('refresh')">
            <template #icon><RefreshIcon /></template>
          </n-button>
        </template>
        {{ labels.refresh }}
      </n-tooltip>
      <n-dropdown
        v-if="cfg.density === true"
        trigger="click"
        :options="densityOptions"
        @select="(k: Density) => emit('update:density', k)"
      >
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-button quaternary circle size="small" :aria-label="labels.density">
              <template #icon><DensityIcon /></template>
            </n-button>
          </template>
          {{ labels.density }}
        </n-tooltip>
      </n-dropdown>
      <slot name="settings" />
    </n-space>
  </div>
</template>

```

**替换为:**

```vue
<template>
  <div class="smart-table-toolbar">
    <div class="smart-table-toolbar-main">
      <!-- 标题取主题的 textColor1 / fontWeightStrong(与官方卡片标题一致;设计原型 .st-title:16px / 500 / textColor1)。
           走 useThemeVars,不依赖 NCard 的 --n-* 变量,换位置(如 #title 插槽放到别处)也跟着明暗主题走 -->
      <h3
        v-if="$slots.title || title"
        class="smart-table-title"
        :style="{ color: themeVars.textColor1, fontWeight: themeVars.fontWeightStrong }"
      >
        <slot name="title">{{ title }}</slot>
      </h3>
      <slot name="left" />
    </div>
    <div class="smart-table-toolbar-right">
      <!-- 业务组:宿主按钮 + 「更多」,间距 8px(原型 .tb-actions) -->
      <div v-if="$slots.right || moreOptions.length" class="smart-table-toolbar-actions">
        <slot name="right" />
        <n-dropdown v-if="moreOptions.length" trigger="click" placement="bottom-end" :options="moreOptions" @select="onMoreSelect">
          <!-- 默认 medium(34px),与宿主的业务按钮同高;chevron 12px、iconColor(原型 --n-text-3),右内边距 12px(chevron 自带的留白算进去) -->
          <n-button
            icon-placement="right"
            :aria-label="labels.more"
            :theme-overrides="{ iconSizeMedium: '12px' }"
            style="padding-right: 12px"
          >
            {{ labels.more }}
            <template #icon>
              <span class="smart-table-more-icon" :style="{ color: themeVars.iconColor }"><ChevronDownIcon /></span>
            </template>
          </n-button>
        </n-dropdown>
      </div>
      <!-- 内置图标组:刷新 / 密度 / 列设置,间距 4px(原型 .tb-icons);与业务组之间 12px(原型 .tb-right) -->
      <div v-if="showRefresh || cfg.density === true || $slots.settings" class="smart-table-toolbar-icons">
        <!-- 图标按钮的图标 16px(原型;官方 small 圆形按钮默认 18px)。abstract = 不多包一层 DOM;包住 #settings 插槽,列设置按钮同样生效 -->
        <n-config-provider abstract :theme-overrides="{ Button: { iconSizeSmall: '16px' } }">
          <n-tooltip v-if="showRefresh" trigger="hover">
            <template #trigger>
              <n-button quaternary circle size="small" :aria-label="labels.refresh" @click="emit('refresh')">
                <template #icon><RefreshIcon /></template>
              </n-button>
            </template>
            {{ labels.refresh }}
          </n-tooltip>
          <n-dropdown
            v-if="cfg.density === true"
            trigger="click"
            :options="densityOptions"
            @select="(k: Density) => emit('update:density', k)"
          >
            <n-tooltip trigger="hover">
              <template #trigger>
                <n-button quaternary circle size="small" :aria-label="labels.density">
                  <template #icon><DensityIcon /></template>
                </n-button>
              </template>
              {{ labels.density }}
            </n-tooltip>
          </n-dropdown>
          <slot name="settings" />
        </n-config-provider>
      </div>
    </div>
  </div>
</template>

```

**`src/Toolbar.vue` 查找(整段,原样)(第 5 / 5 处):**

```vue
.smart-table-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}
</style>
```

**替换为:**

```vue
.smart-table-title {
  margin: 0;
  font-size: 16px;
}
/* 右侧两组:业务组(宿主按钮 + 更多)8px、内置图标组 4px、组间 12px —— 设计原型 .tb-actions / .tb-icons / .tb-right。
   n-dropdown / n-tooltip 的触发器不额外包一层,所以 flex 的 gap 直接落在按钮之间。 */
.smart-table-toolbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}
.smart-table-toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.smart-table-toolbar-icons {
  display: flex;
  align-items: center;
  gap: 4px;
}
/* 宿主的 #right 插槽里全是 v-if 为假的内容时,组容器是空的:不占位 */
.smart-table-toolbar-actions:empty,
.smart-table-toolbar-icons:empty {
  display: none;
}
.smart-table-more-icon {
  display: inline-flex;
}
</style>
```

- [ ] **Step 4: 跑,确认通过**

Run: `npm test && npm run typecheck`
Expected: `Test Files  21 passed (21)`、`Tests  360 passed (360)`(351 + 9:`Toolbar.test.ts` +7、`SearchForm.test.ts` +2);typecheck 无输出;无 `[Vue warn]`。

- [ ] **Step 5: 浏览器验证(对照页 vs 原型)**

Run: `node_modules/.bin/vite --port 5173`,打开 `http://localhost:5173/prototype.html?m=3`(1440 × 900,浅色),控制台粘贴:
```js
(() => {
  const R = (e) => { const b = e.getBoundingClientRect(); return [b.left, b.top, b.width, b.height].map((v) => Math.round(v * 10) / 10).join(',') }
  const tb = document.querySelector('.smart-table-toolbar')
  const ts = getComputedStyle(tb.querySelector('.smart-table-title'))
  let prev = null
  const buttons = [...tb.querySelectorAll('button')].map((b) => {
    const r = b.getBoundingClientRect()
    const o = { name: b.getAttribute('aria-label') || b.innerText.trim(), size: r.width + 'x' + r.height, gap: prev === null ? null : Math.round((r.left - prev) * 10) / 10, svg: [...b.querySelectorAll('svg')].map((s) => s.getBoundingClientRect().width + 'x' + s.getBoundingClientRect().height + ' ' + getComputedStyle(s).color).join(' ; ') }
    prev = r.right
    return o
  })
  return { title: [ts.fontSize, ts.fontWeight, ts.color].join(' | '), buttons, noOverflow: tb.scrollWidth <= tb.clientWidth }
})()
```
Expected(库侧;括号里是原型 `design.html` 同一批读数):
- `title`:`16px | 500 | rgb(31, 34, 37)`(原型相同;**暗色**切到 `?theme=dark` 重读:`rgba(255, 255, 255, 0.9)`,原型相同);
- `buttons`(按 DOM 顺序):**新增** `75x34`(原型 77,差 2px 边框),图标 `13x13`;**更多** `72x34`(原型 74)、与「新增」`gap` = **8**、chevron `12x12`(展开菜单时不旋转,`transform: none`,与原型第 4 批一致——官方 `NButton` / `NDropdown` / `NSelect` 的箭头都不旋转)、色 `rgb(194, 194, 194)`(暗 `rgba(255, 255, 255, 0.38)`,原型相同);**刷新** `28x28`、与「更多」`gap` = **12**、图标 `16x16`;**列设置** `28x28`、与「刷新」`gap` = **4**、图标 `16x16`(原型有一个「放大」按钮在「更多」与「刷新」之间,它是 P1,库没有;原型模块 3 的工具栏左侧还有宿主的「我负责的」快捷过滤按钮,对照页宿主层暂未复刻);`noOverflow` = `true`。
- 工具栏不溢出(Task 6 的要求仍成立):把窗口宽依次设成 390 / 560 / 720 / 1024,上面脚本的 `noOverflow` 都是 `true`(实测 `scrollWidth` 与 `clientWidth` 分别为 332 / 502 / 662 / 650,各自相等)。
再打开 `?m=1`,控制台粘贴:
```js
(() => {
  const btns = [...document.querySelectorAll('.smart-table-search button')].filter((b) => /搜索|重置|展开|收起/.test(b.innerText))
  return btns.map((b) => { const r = b.getBoundingClientRect(); return b.innerText.trim() + ' ' + [r.top, r.height].join(',') + ' cy=' + (r.top + r.height / 2) + ' w=' + r.width })
})()
```
Expected:三个按钮的 `top`、`height` 完全相同——`搜索 119,34 cy=136 w=56`、`重置 119,34 cy=136 w=56`、`展开 119,34 cy=136 w=36`(**修复前**「展开」是 `top ≈ 128.8、height 14`,比同排按钮上移 6px;原型 `展开` 38 宽,同样 `cy=136`)。点「展开」文字变「收起」,高度仍是 34。

- [ ] **Step 6: 提交**

```bash
git add src/Toolbar.vue src/SearchForm.vue tests/Toolbar.test.ts tests/SearchForm.test.ts
git commit -m "style: 工具栏标题 500 / textColor1、业务组 8 / 图标组 4 / 组间 12、「更多」medium、图标 16px;搜索区「展开」垂直居中(L0-1、L0-2、L0-7)" -m "对齐设计原型;2.1.1 的标题 600 / 间距 4 / 图标 18 属外观变化,CHANGELOG 记 B 级并给回退;「展开」错位记缺陷修复。" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 13d: 表头漏斗 22px / 灰色 / 绝对定位角标;过滤列标题单行省略(L0-3、L0-4)

> - **L0-3 漏斗**:触发器由 `NButton tiny quaternary`(26 × 22、颜色 `textColor1`,悬停 / 打开时整个图标变深)改成**原生 `<button>`**(原型 `.th-filter`):**22 × 22**(G6;内图标 15px,两侧各留 3.5px——这样 Task 12 的 B12 下限 102 / 123 才算得对,26px 时舒适密度会缺 4px)、闲置色 = 表头图标色 `thIconColor`(与排序箭头同灰)、悬停 / 面板打开**只加** `thButtonColorHover` 底(不变色)、已筛选才变主色 `thIconColorActive`。颜色 / 底色 / 圆角走表头子树里的 `--n-th-icon-color` / `--n-th-button-color-hover` / `--n-th-icon-color-active` / `--n-border-radius`(触发器在 `th` 里,这些变量可用;明暗自动跟随)。**为什么不继续用 `NButton`**:它的 `padding` / 文字色变量写在元素内联样式里,库自己的 CSS 压不过去,要改尺寸与颜色只能 `!important`。键盘聚焦才画焦点环(与原型 `.n-btn:focus-visible` 一致)。`aria-haspopup` / `aria-expanded` / `data-data-table-filter` 不变。**2.1.1 的 26 × 22 / `textColor1` 变了 → CHANGELOG B 级**。
> - **L0-4 角标不撑表头**:角标挪进按钮里、`position: absolute; top: -3px; right: -5px`(原型 `.hf-n`:`min-width: 12px; height: 12px; font: 500 10px/12px`),`aria-hidden`(条数已在按钮的 `aria-label` 里)。**同一原因的延伸**:列被拖到 B12 的下限时,「物料编码」这类 4 字标题只剩 48px,会**折成两行**,表头从 39.4 撑到 61.8px(实测);原型 `.th-title`(`design.html:1021`)本来就是单行省略(对齐,不是延伸)。过滤列的标题文字单独包一层 `span.smart-table-th-text`(`useColumns.ts`),`white-space: nowrap; overflow: hidden; text-overflow: ellipsis`,漏斗不会被一起裁掉。**2.1.1 里这种折行也存在,属外观变化(B 级,回退:宿主 CSS `.smart-table .smart-table-th-text { white-space: normal; overflow: visible }`)**。没有过滤漏斗的表头(只有排序箭头)保持官方的折行行为不变。
> - **有意改动的既有断言(2 处,理由同上)**:`tests/useColumns.test.ts` 里「filter 列的标题包成『原标题 + 漏斗』」「函数型标题在包装后仍是渲染期求值」原来直接读 `children[0] === '标题'`,现在标题文字多包了一层 `span.smart-table-th-text`,断言改读它的 `children`(语义不变:仍是渲染期求值、漏斗在第二个孩子)。

**Files:**
- Modify: `src/ColumnFilter.vue`(触发器模板 + 样式)、`src/useColumns.ts`(标题文字包一层)、`src/SmartTable.vue`(样式)
- Test: `tests/ColumnFilter.test.ts`(追加)、`tests/useColumns.test.ts`(**2 处有意改动**)

**Interfaces:**
- Consumes: Task 9 的触发器类 `smart-table-filter-trigger` / `--active` / `--open` / `smart-table-filter-badge`、`data-data-table-filter`;Task 12 的 `headerIconFloor`(漏斗簇 = 8 + 22 = 30,与本 Task 的 22px 一致)。
- Produces: 触发器内的原生按钮类 `smart-table-filter-btn`;标题文字类 `smart-table-th-text`。

- [ ] **Step 1: 写失败测试**

**`tests/ColumnFilter.test.ts` 追加到文件末尾:**

```ts

describe('ColumnFilter 漏斗触发器的外观(L0-3 / L0-4,对齐原型 .th-filter / .hf-n)', () => {
  function mountFilter(value: FilterValue | null) {
    return mount(ColumnFilter, {
      props: { def: buildOptionsDef(), value, labels, getOptions: () => [], isLoadingOptions: () => false },
      attachTo: document.body,
    })
  }

  it('[L0-3] 触发器是原生 <button type="button">(不是 NButton):尺寸与颜色由库自己的 CSS 定,不受 NButton 的 padding / 颜色变量牵制', () => {
    const w = mountFilter(null)
    const btn = w.find('.smart-table-filter-trigger button')
    expect(btn.classes()).toContain('smart-table-filter-btn')
    expect(btn.classes()).not.toContain('n-button')
    expect(btn.attributes('type')).toBe('button')
    expect(btn.attributes('aria-haspopup')).toBe('dialog')
    expect(btn.find('svg').exists()).toBe(true)
    w.unmount()
  })

  it('[L0-4] 条数角标在按钮「里面」(绝对定位,锚是 22px 的按钮,不占行内宽度,不撑宽 / 撑高表头),且 aria-hidden(条数已在按钮的 aria-label 里)', () => {
    const w = mountFilter(optionsToFilterValue([1, 2, 3]))
    const badge = w.find('.smart-table-filter-trigger button .smart-table-filter-badge')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toBe('3')
    expect(badge.attributes('aria-hidden')).toBe('true')
    // 按钮的无障碍名只有 aria-label,不含角标的文字
    expect(w.find('.smart-table-filter-trigger button').attributes('aria-label')).toBe('过滤(已筛选 3 条)')
    w.unmount()
  })

  it('[L0-3] 面板打开 → 触发器带 --open(只加底色,不变色);--active(主色)只属于「已筛选」', async () => {
    const w = mountFilter(null)
    expect(w.find('.smart-table-filter-trigger--open').exists()).toBe(false)
    await w.find('.smart-table-filter-trigger').trigger('click')
    await flushPromises()
    expect(w.find('.smart-table-filter-trigger--open').exists()).toBe(true)
    expect(w.find('.smart-table-filter-trigger--active').exists()).toBe(false)
    w.unmount()
  })
})
```

**`tests/useColumns.test.ts` 查找(整段,原样)(第 1 / 2 处):**

```ts
    expect(typeof title).toBe('function')
    const vnode = title(undefined)
    const children = vnode.children as VNode[]
    expect(children[0]).toBe('N')
    expect((children[1] as VNode).props?.['data-key']).toBe('name')

    expect(col(api, 'amt').title).toBe('A') // 无 filter 不包装
```

**替换为:**

```ts
    expect(typeof title).toBe('function')
    const vnode = title(undefined)
    const children = vnode.children as VNode[]
    // 有意改动(L0-4):标题文字多包了一层 span.smart-table-th-text(只让文字省略、漏斗不被裁),原断言直接读 children[0] === 'N'
    expect((children[0] as VNode).props?.class).toBe('smart-table-th-text')
    expect((children[0] as VNode).children).toEqual(['N'])
    expect((children[1] as VNode).props?.['data-key']).toBe('name')

    expect(col(api, 'amt').title).toBe('A') // 无 filter 不包装
```

**`tests/useColumns.test.ts` 查找(整段,原样)(第 2 / 2 处):**

```ts
      { renderFilter },
    )
    const title = col(api, 'name').title as (c: unknown) => VNode
    expect((title(undefined).children as VNode[])[0]).toBe('姓名')
    lang = 'en'
    expect((title(undefined).children as VNode[])[0]).toBe('Name')
  })

  it('没有 renderFilter 时不包装(useColumns 可脱离 UI 单独使用)', () => {
```

**替换为:**

```ts
      { renderFilter },
    )
    const title = col(api, 'name').title as (c: unknown) => VNode
    // 有意改动(L0-4):标题文字在 span.smart-table-th-text 里,取它的 children
    const text = () => ((title(undefined).children as VNode[])[0] as VNode).children
    expect(text()).toEqual(['姓名'])
    lang = 'en'
    expect(text()).toEqual(['Name'])
  })

  it('没有 renderFilter 时不包装(useColumns 可脱离 UI 单独使用)', () => {
```

- [ ] **Step 2: 跑,确认失败**

Run: `npx vitest run tests/ColumnFilter.test.ts tests/useColumns.test.ts`
Expected: `Test Files  2 failed (2)`、`Tests  4 failed | 68 passed (72)`(实测)—— `ColumnFilter.test.ts` 2 条(漏斗不是原生 button:`expected [ 'n-button', … ] to include 'smart-table-filter-btn'`;角标不在按钮里),`useColumns.test.ts` 2 条(有意改动的标题结构断言:`children[0]` 此刻还是字符串)。「面板打开 → `--open`」那条此刻本来就绿。

- [ ] **Step 3: 实现**

**`src/ColumnFilter.vue` 查找(整段,原样)(第 1 / 2 处):**

```vue
      >
        <n-tooltip trigger="hover" :disabled="show">
          <template #trigger>
            <!-- aria-haspopup / aria-expanded:屏幕阅读器得知这个按钮会弹出对话框、当前是否展开(D6) -->
            <n-button
              quaternary
              size="tiny"
              :type="active ? 'primary' : 'default'"
              :aria-label="ariaLabel"
              aria-haspopup="dialog"
              :aria-expanded="show"
            >
              <template #icon><FilterIcon /></template>
            </n-button>
          </template>
          {{ labels.filter }}
        </n-tooltip>
        <!-- 文字色取主题的 baseColor(亮白 / 暗黑),不写死 #fff:暗色下叠在主色上对比度太低(Q-2) -->
        <span v-if="activeCount > 1" class="smart-table-filter-badge" :style="{ color: themeVars.baseColor }">{{
          activeCount
        }}</span>
      </span>
    </template>

```

**替换为:**

```vue
      >
        <n-tooltip trigger="hover" :disabled="show">
          <template #trigger>
            <!-- 原生 button(设计原型 .th-filter):22×22、图标 15px、闲置色取表头图标色(与排序箭头同灰)、打开 / 悬停只加底色、
                 已筛选才变主色。不用 NButton:它的 padding / 文字色变量写在内联样式里,压不过库自己的 CSS。
                 aria-haspopup / aria-expanded:屏幕阅读器得知这个按钮会弹出对话框、当前是否展开(D6) -->
            <button
              type="button"
              class="smart-table-filter-btn"
              :aria-label="ariaLabel"
              aria-haspopup="dialog"
              :aria-expanded="show"
            >
              <FilterIcon />
              <!-- 条数角标:绝对定位在按钮右上角(原型 .hf-n),不占行内宽度,所以多条件时表头既不变宽也不变高(L0-4)。
                   文字色取主题的 baseColor(亮白 / 暗黑),不写死 #fff:暗色下叠在主色上对比度太低(Q-2)。
                   aria-hidden:条数已在按钮的 aria-label 里,不要读两遍 -->
              <span v-if="activeCount > 1" class="smart-table-filter-badge" aria-hidden="true" :style="{ color: themeVars.baseColor }">{{
                activeCount
              }}</span>
            </button>
          </template>
          {{ labels.filter }}
        </n-tooltip>
      </span>
    </template>

```

**`src/ColumnFilter.vue` 查找(整段,原样)(第 2 / 2 处):**

```vue
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
  /* 文字色在模板里经 :style 取 themeVars.baseColor(Q-2);背景取官方的激活图标色(角标在 th 的子树里,--n-* 变量可用) */
  background: var(--n-th-icon-color-active);
}
.smart-table-filter {
```

**替换为:**

```vue
  /* 表头默认 center 对齐时,漏斗不该把标题挤偏 */
  vertical-align: middle;
}
/* 漏斗按钮(L0-3,设计原型 .th-filter):22×22(G6,图标 15px 两侧各留 3.5px,B12 的拖拽下限 102 / 123 就是按它算的)。
   颜色走表头的主题变量(触发器在 th 的子树里,--n-th-* 可用):闲置 = thIconColor(与排序箭头同灰),
   悬停 / 面板打开只加 thButtonColorHover 底色(不变色),已筛选 = thIconColorActive(主色)。 */
.smart-table-filter-btn {
  position: relative;
  flex: none;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 0;
  border-radius: var(--n-border-radius);
  background: transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  line-height: 1;
  color: var(--n-th-icon-color);
  cursor: pointer;
  transition:
    color 0.15s,
    background-color 0.15s;
}
.smart-table-filter-btn:hover,
.smart-table-filter-trigger--open .smart-table-filter-btn {
  background: var(--n-th-button-color-hover);
}
.smart-table-filter-trigger--active .smart-table-filter-btn {
  color: var(--n-th-icon-color-active);
}
/* 只在键盘聚焦时画焦点环(与原型 .n-btn:focus-visible 一致:克制的主色细环,外扩 2px) */
.smart-table-filter-btn:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--n-th-icon-color-active) 55%, transparent);
  outline-offset: 2px;
}
/* 条数角标(L0-4,原型 .hf-n):绝对定位,不占宽、不占高。文字色在模板里经 :style 取 themeVars.baseColor(Q-2);
   背景取表头的激活图标色(= 主色) */
.smart-table-filter-badge {
  position: absolute;
  top: -3px;
  right: -5px;
  min-width: 12px;
  height: 12px;
  padding: 0 3px;
  border-radius: 6px;
  font-size: 10px;
  font-weight: 500;
  line-height: 12px;
  text-align: center;
  pointer-events: none;
  background: var(--n-th-icon-color-active);
}
.smart-table-filter {
```

**`src/SmartTable.vue` 查找(整段,原样):**

```vue
  align-items: center;
  justify-content: center;
  gap: 0;
}
/* 表头图标「悬停才显示」(B6):未激活的排序箭头与漏斗平时透明(仍占位,不回流),悬停该列表头或
   键盘聚焦到表头内时淡入。官方类名已在真实 NDataTable 上核对(设计文档 9.1)。
```

**替换为:**

```vue
  align-items: center;
  justify-content: center;
  gap: 0;
  max-width: 100%;
}
/* 过滤列的标题文字单行、放不下省略(设计原型 .th-title),漏斗不被裁(L0-4):
   列被拖到 B12 的下限时,「物料编码」这类 4 字标题只剩 48px,折成两行会把表头从 39.4 撑到 61.8px、图标也被挤歪。
   B12 的下限保证的是图标簇放得下,标题让位(省略)。标题文字单独包了一层(useColumns),省略号只作用在文字上,不会连漏斗一起裁掉。 */
.smart-table :deep(.smart-table-th-text) {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* 表头图标「悬停才显示」(B6):未激活的排序箭头与漏斗平时透明(仍占位,不回流),悬停该列表头或
   键盘聚焦到表头内时淡入。官方类名已在真实 NDataTable 上核对(设计文档 9.1)。
```

**`src/useColumns.ts` 查找(整段,原样):**

```ts
      return result as DataTableColumn<T>
    }

    // 表头过滤入口:标题后挂漏斗。包一层是为了 sorter 列点漏斗不会连带触发排序
    // (ColumnFilter 内部 stopPropagation),同时让漏斗贴着标题而不是被 th 撑开。
    const filterDef = opts.filterDefs?.().find((f) => f.field === key)
    if (filterDef && opts.renderFilter) {
      const baseTitle = result.title as string | ((c: unknown) => VNodeChild) | undefined
      result.title = (c: unknown) =>
        h('span', { class: 'smart-table-th' }, [
          typeof baseTitle === 'function' ? baseTitle(c) : baseTitle,
          opts.renderFilter!(filterDef),
        ])
    }
```

**替换为:**

```ts
      return result as DataTableColumn<T>
    }

    // 表头过滤入口:标题后挂漏斗,同时让漏斗贴着标题而不是被 th 撑开。标题文字再单独包一层 .smart-table-th-text:
    // 列被拖窄时只让文字省略(单行 + ellipsis),不折行撑高表头,也不会连漏斗一起裁掉(L0-4)。
    const filterDef = opts.filterDefs?.().find((f) => f.field === key)
    if (filterDef && opts.renderFilter) {
      const baseTitle = result.title as string | ((c: unknown) => VNodeChild) | undefined
      result.title = (c: unknown) =>
        h('span', { class: 'smart-table-th' }, [
          h('span', { class: 'smart-table-th-text' }, [typeof baseTitle === 'function' ? baseTitle(c) : baseTitle]),
          opts.renderFilter!(filterDef),
        ])
    }
```

- [ ] **Step 4: 跑,确认通过**

Run: `npm test && npm run typecheck`
Expected: `Test Files  21 passed (21)`、`Tests  363 passed (363)`(360 + 3:`ColumnFilter.test.ts` +3;`useColumns.test.ts` 的 2 条是改断言,不增);typecheck 无输出;无 `[Vue warn]`。

- [ ] **Step 5: 浏览器验证(对照页 vs 原型)**

Run: `node_modules/.bin/vite --port 5173`,打开 `/prototype.html?m=3`(1440 × 900,浅色)。**先把鼠标移到表格外**,控制台粘贴:
```js
(() => {
  const th = [...document.querySelectorAll('thead th')].find((t) => t.innerText.includes('物料编码'))
  const t = th.getBoundingClientRect()
  const f = th.querySelector('.smart-table-filter-btn')
  const fr = f.getBoundingClientRect()
  const sv = f.querySelector('svg').getBoundingClientRect()
  const sr = th.querySelector('.n-data-table-sorter').getBoundingClientRect()
  const R = (v) => Math.round(v * 10) / 10
  const opacity = (e) => { let o = 1; for (let x = e; x && x !== th.parentElement; x = x.parentElement) o *= parseFloat(getComputedStyle(x).opacity); return Math.round(o * 100) / 100 }
  const badge = th.querySelector('.smart-table-filter-badge')
  const b = badge && badge.getBoundingClientRect()
  return {
    th: t.width + 'x' + R(t.height),
    funnel: fr.width + 'x' + fr.height,
    funnelSvg: sv.width + 'x' + sv.height,
    funnelColor: getComputedStyle(f).color,
    funnelOpacity: opacity(f),
    funnelToSorter: R(sr.left - fr.right),
    sorterRightGap: R(t.right - sr.right),
    badge: b ? { size: b.width + 'x' + b.height, dx: R(b.left - fr.left), dy: R(b.top - fr.top), pos: getComputedStyle(badge).position } : null,
  }
})()
```
Expected(库侧;括号里是原型 `.th-filter` 读数):
- `funnel` = `22x22`(原型 22 × 22)、`funnelSvg` = `15x15`(原型 15 × 15)、`funnelColor` = `rgb(194, 194, 194)`(原型 `rgb(194, 194, 194)`,与排序箭头同灰;暗色 `rgba(255, 255, 255, 0.38)`,原型相同)、`funnelOpacity` = `0`(闲置不可见,原型 0;鼠标移到该列表头上变 `1`);`funnelToSorter` = `6`(漏斗 → 箭头,原型 6)、`th` = `137x39.4`(原型 `137x40.4`:原型第 1 批 X1 把行高 / 内边距改成官方 small = 39.4,`th` 另含表格外框的 1px 上边框 → 40.4,不属于本 Task);
- 鼠标移到漏斗上 / 点开面板:漏斗底色 = `rgba(0, 0, 100, 0.03)`(原型相同;暗 `rgba(255, 255, 255, 0.06)`),**颜色不变**(仍是灰,不是主色);
- 已筛选(面板里输入 `M10` 确认):漏斗颜色 = 主色 `rgb(24, 160, 88)`(暗 `rgb(99, 226, 183)`),常驻可见。
再给「物料编码」加第二个条件(点漏斗 → 「添加条件」→ 两行分别填 `M10` / `M20` → 确认),把鼠标移到表格外,再粘贴同一段脚本。Expected:`badge` = `{ size: "12x12", dx: 15, dy: -3, pos: "absolute" }`(原型:角标 `434,204,12,12`,漏斗 `419,207` → 相对 `dx 15 / dy -3`,完全相同);`th` 仍是 `137x39.4`,**没有变宽也没有变高**(修复前角标行内占 ~16px,列宽 137 时标题折成两行、表头 ≈ 62px);暗色下角标文字色 `rgb(0, 0, 0)`、底 `rgb(99, 226, 183)`。
**拖到下限**:把「物料编码」列的右边界用鼠标向左一直拖到拖不动,再粘贴脚本。Expected:`th` = `123x39.4`(下限 123 = 8 + 标题 + 8 + 22 + 6 + 15 + 16,标题让位成省略号),`sorterRightGap` ≈ `17`(≥ 16,箭头没被裁;原型 17),`funnelToSorter` = `6`;**表头高度仍是 39.4**(修复前 `61.8`,标题折成两行)。仅过滤的列(如「负责人」)拖到下限 `102`、同样单行。

- [ ] **Step 6: 提交**

```bash
git add src/ColumnFilter.vue src/useColumns.ts src/SmartTable.vue tests/ColumnFilter.test.ts tests/useColumns.test.ts
git commit -m "style: 漏斗 22px 原生按钮 + 表头图标色 + 绝对定位角标;过滤列标题单行省略(L0-3、L0-4)" -m "对齐设计原型 .th-filter / .hf-n:B12 的下限 102 / 123 按 22px 才对;角标不再撑宽 / 撑高表头;列拖到下限时标题省略而不是折行。有意改动 tests/useColumns.test.ts 里 2 条标题结构断言(标题文字多包了一层 span)。2.1.1 的漏斗 26px / 深色 / 折行属外观变化,CHANGELOG 记 B 级。" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 13e: 列头面板排布对齐原型;单选过滤用 NRadio;面板不出屏(L0-5、L0-9)

> - **L0-5 排布**(原型 `.hpop` / `hpRowHtml` / `hpBodyHtml` / `hpopHtml`):面板 padding 0;正文 `12px 12px 0`;每行 **4 列网格 `56px 112px 1fr 28px`、间距 8**(首列 / 比较符 / 值 / 删除;删除列恒占位,所以 1 行和多行的值输入同宽),行距 12;**首列:第 1 行是「条件」引导标签(12px、`textColor3`、居中),第 2 行起是且 / 或下拉**(`NSelect small`,选哪个都改整组的连接方式——`FilterValue.logic` 每字段一个值),取代原来行下方的分段按钮;「添加条件」文字按钮是**官方 `NButton` small 档**(`button/styles/_common.mjs`:`heightSmall` 28 / `paddingSmall` 0 10px / `fontSizeSmall` 14 / `iconSizeSmall` 18;与同一面板里 small 的值控件一致,原型第 4 批同款,窄档抽屉的 large 档属 P2)、**带加号图标、颜色保持官方文字按钮的 `textColor2`(不再是主色)**——官方文字按钮(`text`)把高度与内边距重置成 `initial`,所以高度取主题 `heightSmall`(`:style`)、内边距写 `paddingSmall` 的值,字号 / 图标取 `size="small"` 的官方值;「高级条件 ▾」「返回列表 ▴」同档;options 面板「高级条件 ▾」「返回列表 ▴」带箭头(符号字符,不进 label),选项间距 12(行高 22.4 → 间隔 34.4),最高 240 滚动,最小宽 168;高级条件里含勾选表达不了的条件时,「返回」禁用并给出原因提示(新 label `filterCannotCollapse`,原型同款);底部 `space-evenly` 的 tiny「重置 / 确认」,footer `padding: 8px 12px`、上边线 `dividerColor`。删除按钮 `size="small"`(28px)、图标 12px;新增 label `filterConditionLead`(en `Where` / zh `条件`)。自定义面板(`def.render`)沿用 2.1.1 的 8px 内边距与 200px 最小宽(`smart-table-filter--custom`),不套新排布。**面板排布随 B7 的多条件面板一并变,CHANGELOG 在 B7 行里补一句,不单列**。
> - **单选过滤**(`filter.multiple: false`,原型第 1 批 N10 已改、`design.md` 10.8):库此前用 `NCheckbox` 模拟单选;官方 `HeaderButton/FilterMenu.mjs:118-141` 用 `NRadioGroup` / `NRadio`(G3:与官方冲突跟官方)→ 改成 `NRadioGroup` + `NRadio`,没有「全选」,已有 `equal` 条件时对应 radio 选中。**2.1.1 的 `multiple: false` 外观变了(复选框 → 单选按钮),CHANGELOG 列入**。
> - **L0-9 不出屏**:`NPopover placement="bottom"` 把面板居中在漏斗上,触发器靠近视口边缘(窄屏尤其明显:390 宽下 400px 的面板左缘 `x = −69`,左侧被裁出屏幕)。公开的 `NPopover` 没有「夹进视口」的开关 → 量 NPopover 的定位容器(vueuc 的 `.v-binder-follower-content`:只有定位用的平移,**没有进场动画的缩放**——量面板自己会量错,弹层有淡入 + 缩放动画)的位置,用纯函数 `clampShift(left, width, viewport, margin = 8)` 算出水平平移,加在面板自己的 `transform` 上;窗口缩放 / 任意祖先滚动(`capture` 阶段)时重新夹取;放不下(比视口 − 16 还宽)时贴左边距,保证左侧的标签与比较符可见。**窄档改用底部抽屉属于 P2(`cardOnNarrow`)**,在那之前窄容器至少不能把内容裁掉。
> - **有意改动的既有断言(1 处)**:`tests/ColumnFilter.test.ts`「两行 + 『或』」原来 `w.findComponent(NRadioGroup).vm.$emit('update:value', 'or')`,且 / 或的分段按钮没有了,改成在第 2 行 `ConditionRow` 上 `$emit('update:logic', 'or')`(语义不变:连接方式变成 `or` 并随确认提交);顶部 import 里的 `NRadioGroup` 先去掉、单选用例里再加回。
> - **和原型一致、库不改的两处**:① 打开面板的初始焦点 = 第一个可聚焦控件(原型第 1 批已改成与库一致,设计文档 10.8 N8);② 值输入的清除 ×:原型原先没有、**在原型侧补上**(官方默认 `clearable`)。
> - **「全选」**(N10):库一直有(多选且选项 > 1);原型第 1 批已补。

**Files:**
- Create: `src/viewportClamp.ts`
- Modify: `src/ColumnFilter.vue`、`src/ConditionRow.vue`、`src/icons.ts`(小图标换几何 + `PlusIcon`)、`src/labels.ts`、`src/types.ts`、`playground/prototype/ProtoApp.vue`(`filterSimple` 改回原型措辞)
- Test: `tests/viewportClamp.test.ts`(新建)、`tests/ColumnFilter.test.ts`(追加 + **1 处有意改动**)

**Interfaces:**
- Consumes: Task 10 的 `ColumnFilter.vue` / `ConditionRow.vue`、Task 9 的触发器;Task 13d 的原生漏斗按钮。
- Produces: `SmartTableLabels.filterConditionLead?` / `filterCannotCollapse?`(**可选**,`defaultLabels` 英文 `Where` / `Contains conditions checkboxes cannot show`,`zhCNLabels` `条件` / `含勾选无法表达的条件`);`viewportClamp.ts` 的 `clampShift`;`ConditionRow` 新增 prop `index`、`logic` 与事件 `update:logic`;图标 `PlusIcon`,`ChevronDownIcon` / `CloseIcon` 换成 16 视口几何。

- [ ] **Step 1: 写失败测试**

**新建 `tests/viewportClamp.test.ts`:**

```ts
import { describe, expect, it } from 'vitest'
import { clampShift } from '../src/viewportClamp'

describe('clampShift(L0-9:弹层水平夹进视口)', () => {
  it('完全在视口内(两侧都留得出 8px)→ 0', () => {
    expect(clampShift(100, 400, 1440)).toBe(0)
    expect(clampShift(8, 400, 1440)).toBe(0) // 恰好贴着边距
    expect(clampShift(1440 - 8 - 400, 400, 1440)).toBe(0)
  })

  it('左侧出屏 → 右移到 left = 8', () => {
    expect(clampShift(-69, 374, 390)).toBe(77)
    expect(clampShift(0, 300, 1000)).toBe(8)
  })

  it('右侧出屏 → 左移到 right = viewport − 8', () => {
    expect(clampShift(300, 200, 390)).toBe(-118)
    expect(clampShift(1300, 400, 1440)).toBe(-268)
  })

  it('比「视口 − 两侧边距」还宽(放不下)→ 贴左边距,保证左侧的内容(标签、比较符)可见', () => {
    expect(clampShift(-20, 500, 400)).toBe(28)
    expect(clampShift(50, 500, 400)).toBe(-42)
  })

  it('边距可配', () => {
    expect(clampShift(2, 100, 400, 16)).toBe(14)
  })

  it('结果取整(亚像素 rect 不会产生 translateX(77.3333px) 这类模糊渲染)', () => {
    expect(Number.isInteger(clampShift(-69.4, 374.2, 390))).toBe(true)
  })
})
```

**`tests/ColumnFilter.test.ts` 查找(整段,原样)(第 1 / 3 处):**

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { NConfigProvider, NRadioGroup, NSelect, darkTheme } from 'naive-ui'
import { h, defineComponent, nextTick } from 'vue'
```

**替换为:**

```ts
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { NConfigProvider, NRadioGroup, NSelect, darkTheme } from 'naive-ui'
import { h, defineComponent, nextTick } from 'vue'
```

**`tests/ColumnFilter.test.ts` 查找(整段,原样)(第 2 / 3 处):**

```ts
  filterLogicOr: '或',
  filterAdvanced: '高级条件',
  filterSimple: '返回列表',
  filterNoValue: '无需填值',
  filterEqual: '等于',
  filterNotEqual: '不等于',
```

**替换为:**

```ts
  filterLogicOr: '或',
  filterAdvanced: '高级条件',
  filterSimple: '返回列表',
  filterConditionLead: '条件',
  filterCannotCollapse: '含勾选无法表达的条件',
  filterNoValue: '无需填值',
  filterEqual: '等于',
  filterNotEqual: '不等于',
```

**`tests/ColumnFilter.test.ts` 查找(整段,原样)(第 3 / 3 处):**

```ts
    const rows = w.findAllComponents(ConditionRow)
    rows[0].vm.$emit('update:value', 'a')
    rows[1].vm.$emit('update:value', 'b')
    w.findComponent(NRadioGroup).vm.$emit('update:value', 'or')
    await nextTick()
    docClick(confirmBtn())
    expect(lastEmitted(w)).toEqual(v('or', ['contains', 'a'], ['contains', 'b']))
```

**替换为:**

```ts
    const rows = w.findAllComponents(ConditionRow)
    rows[0].vm.$emit('update:value', 'a')
    rows[1].vm.$emit('update:value', 'b')
    rows[1].vm.$emit('update:logic', 'or') // 有意改动(L0-5):且 / 或 从下方的分段按钮改成第 2 行起首列的下拉,事件在条件行上
    await nextTick()
    docClick(confirmBtn())
    expect(lastEmitted(w)).toEqual(v('or', ['contains', 'a'], ['contains', 'b']))
```

**`tests/ColumnFilter.test.ts` 追加到文件末尾:**

```ts

describe('ColumnFilter 面板排布(L0-5,对齐原型 .hpop)', () => {
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
  const two: FilterValue = {
    logic: 'or',
    conditions: [
      { action: 'contains', value: 'a' },
      { action: 'equal', value: 'b' },
    ],
  }
  async function openPanel(def: FilterDef, value: FilterValue | null) {
    const w = mount(ColumnFilter, {
      props: { def, value, labels, getOptions: () => [], isLoadingOptions: () => false },
      attachTo: document.body,
    })
    await w.find('.smart-table-filter-trigger').trigger('click')
    await flushPromises()
    return w
  }
  const q = (sel: string) => document.body.querySelector(sel) as HTMLElement | null
  const qa = (sel: string) => Array.from(document.body.querySelectorAll<HTMLElement>(sel))

  it('首列:第 1 行是「条件」引导标签,第 2 行起是且 / 或下拉(显示当前连接方式)', async () => {
    const w = await openPanel(conditionDef(), two)
    const rows = qa('.smart-table-filter-row')
    expect(rows).toHaveLength(2)
    expect(rows[0].querySelector('.smart-table-filter-lead')!.textContent).toBe('条件')
    expect(rows[0].querySelector('.smart-table-filter-logic')).toBeNull()
    expect(rows[1].querySelector('.smart-table-filter-lead')).toBeNull()
    expect(rows[1].querySelector('.smart-table-filter-logic')!.textContent).toBe('或')
    w.unmount()
  })

  it('只有 1 行时没有且 / 或下拉;下方也不再有分段按钮', async () => {
    const w = await openPanel(conditionDef(), null)
    expect(qa('.smart-table-filter-logic')).toHaveLength(0)
    expect(qa('.n-radio-group')).toHaveLength(0)
    w.unmount()
  })

  it('改且 / 或:第 2 行起任意一行的下拉都改整组的连接方式,确认后提交', async () => {
    const w = await openPanel(conditionDef(), two)
    const rows = w.findAllComponents(ConditionRow)
    expect(rows[1].props('logic')).toBe('or')
    rows[1].vm.$emit('update:logic', 'and')
    await nextTick()
    expect(w.findAllComponents(ConditionRow)[1].props('logic')).toBe('and')
    click(qa('.smart-table-filter-footer button')[1])
    const e = w.emitted('update:value')!
    expect((e[e.length - 1][0] as FilterValue).logic).toBe('and')
    w.unmount()
  })

  it('「添加条件」:官方 small 档的文字按钮,带加号图标,文字不再自带「+ 」前缀,也不再是主色', async () => {
    const w = await openPanel(conditionDef(), null)
    const add = q('.smart-table-filter-add')!
    expect(add.querySelector('svg')).not.toBeNull()
    expect(add.textContent!.trim()).toBe('添加条件')
    expect(add.classList.contains('n-button--primary-type')).toBe(false)
    // 官方 small 档(第 4 批,与同一面板里 small 的值控件一致):字 14 / 图标 18 / 高取主题 heightSmall 28
    expect(add.getAttribute('style')).toContain('--n-font-size: 14px')
    expect(add.getAttribute('style')).toContain('--n-icon-size: 18px')
    expect(add.getAttribute('style')).toContain('height: 28px')
    w.unmount()
  })

  it('底部「重置 / 确认」在 footer 里,footer 在面板最底部、带分隔线', async () => {
    const w = await openPanel(conditionDef(), null)
    const footer = q('.smart-table-filter-footer')!
    expect(Array.from(footer.querySelectorAll('button')).map((b) => b.textContent!.trim())).toEqual(['重置', '确定'])
    expect(footer.parentElement!.lastElementChild).toBe(footer)
    expect(footer.getAttribute('style')).toContain('border-top')
    w.unmount()
  })

  it('自定义面板(def.render)仍是 8px 内边距的老样式,不套新的条件面板排布', async () => {
    const w = await openPanel(conditionDef({ render: () => h('div', { class: 'custom' }, 'x') }), null)
    expect(q('.smart-table-filter')!.classList.contains('smart-table-filter--custom')).toBe(true)
    expect(q('.smart-table-filter-body')).toBeNull()
    w.unmount()
  })

  describe('options 列', () => {
    const opts = [
      { label: 'A', value: 1 },
      { label: 'B', value: 2 },
    ]
    const optionsDef = (): FilterDef => ({ ...buildOptionsDef(), type: 'select' })
    async function open(value: FilterValue | null) {
      const w = mount(ColumnFilter, {
        props: { def: optionsDef(), value, labels, getOptions: () => opts as never, isLoadingOptions: () => false },
        attachTo: document.body,
      })
      await w.find('.smart-table-filter-trigger').trigger('click')
      await flushPromises()
      return w
    }

    it('底部入口带箭头:「高级条件 ▾」;展开后「返回列表 ▴」', async () => {
      const w = await open(null)
      expect(q('.smart-table-filter-advanced-open')!.textContent!.trim()).toBe('高级条件 ▾')
      click(q('.smart-table-filter-advanced-open'))
      await nextTick()
      expect(q('.smart-table-filter-advanced-close')!.textContent!.trim()).toBe('返回列表 ▴')
      w.unmount()
    })

    it('高级条件里含勾选表达不了的条件:「返回」禁用,并给出原因提示', async () => {
      const w = await open({ logic: 'and', conditions: [{ action: 'notEqual', value: 1 }] })
      expect(q('.smart-table-filter-advanced-close')!.hasAttribute('disabled')).toBe(true)
      expect(q('.smart-table-filter-hint')!.textContent).toBe('含勾选无法表达的条件')
      w.unmount()
    })

    it('能无损收起时没有提示', async () => {
      const w = await open(null)
      click(q('.smart-table-filter-advanced-open'))
      await nextTick()
      expect(q('.smart-table-filter-hint')).toBeNull()
      w.unmount()
    })

    describe('单选(filter.multiple: false)用官方 NRadio,不是复选框', () => {
      async function openSingle(value: FilterValue | null) {
        const w = mount(ColumnFilter, {
          props: {
            def: { ...optionsDef(), multiple: false },
            value,
            labels,
            getOptions: () => opts as never,
            isLoadingOptions: () => false,
          },
          attachTo: document.body,
        })
        await w.find('.smart-table-filter-trigger').trigger('click')
        await flushPromises()
        return w
      }
      const lastValue = (w: ReturnType<typeof mount>) => {
        const e = w.emitted('update:value')!
        return e[e.length - 1][0] as FilterValue | null
      }

      it('选项是 NRadio(官方 FilterMenu.mjs:118-141 同款),没有 NCheckbox、没有「全选」', async () => {
        const w = await openSingle(null)
        expect(qa('.smart-table-filter-options .n-radio')).toHaveLength(2)
        expect(qa('.smart-table-filter-options .n-checkbox')).toHaveLength(0)
        expect(q('.smart-table-filter-options')!.classList.contains('n-radio-group')).toBe(true)
        w.unmount()
      })

      it('已有 equal 条件时对应的 radio 是选中的;换选另一个 → 提交的是新的单个 equal', async () => {
        const w = await openSingle({ logic: 'and', conditions: [{ action: 'equal', value: 1 }] })
        const radios = qa('.smart-table-filter-options .n-radio')
        expect(radios.map((r) => r.classList.contains('n-radio--checked'))).toEqual([true, false])
        w.findComponent(NRadioGroup).vm.$emit('update:value', 2)
        await nextTick()
        click(qa('.smart-table-filter-footer button')[1])
        expect(lastValue(w)).toEqual({ logic: 'or', conditions: [{ action: 'equal', value: 2 }] })
        w.unmount()
      })

      it('没选就确认 → 提交 null(清除);多选列(默认)仍是复选框', async () => {
        const w = await openSingle(null)
        click(qa('.smart-table-filter-footer button')[1])
        expect(lastValue(w)).toBeNull()
        w.unmount()
        const multi = await open(null)
        expect(qa('.smart-table-filter-options .n-checkbox').length).toBeGreaterThan(0)
        expect(qa('.smart-table-filter-options .n-radio')).toHaveLength(0)
        multi.unmount()
      })
    })
  })
})

describe('ColumnFilter 面板不出屏(L0-9)', () => {
  const def: FilterDef = {
    key: 'name',
    field: 'name',
    optionsKey: 'name',
    mode: 'condition',
    multiple: true,
    type: 'input',
    actions: ['contains'],
  }
  const realInnerWidth = window.innerWidth
  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: realInnerWidth, configurable: true })
    vi.restoreAllMocks()
  })
  const frame = () => new Promise((r) => requestAnimationFrame(() => r(null)))

  async function openAt(left: number, width: number, viewport: number) {
    Object.defineProperty(window, 'innerWidth', { value: viewport, configurable: true })
    // jsdom 没有布局:给 NPopover 的定位容器(.v-binder-follower-content,真实布局位置、不含面板自己的平移)合成一个 rect
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (!this.classList.contains('v-binder-follower-content')) return new DOMRect(0, 0, 0, 0)
      return new DOMRect(left, 100, width, 200)
    })
    const w = mount(ColumnFilter, {
      props: { def, value: null, labels, getOptions: () => [], isLoadingOptions: () => false },
      attachTo: document.body,
    })
    await w.find('.smart-table-filter-trigger').trigger('click')
    await flushPromises()
    await frame()
    await nextTick()
    return w
  }
  const panel = () => document.body.querySelector('.smart-table-filter') as HTMLElement

  it('左侧被裁出屏幕(left = -69,宽 374,视口 390)→ 向右平移到距左边 8px', async () => {
    const w = await openAt(-69, 374, 390)
    expect(panel().style.transform).toBe('translateX(77px)')
    w.unmount()
  })

  it('右侧被裁(left = 300,宽 200,视口 390)→ 向左平移到距右边 8px', async () => {
    const w = await openAt(300, 200, 390)
    expect(panel().style.transform).toBe('translateX(-118px)')
    w.unmount()
  })

  it('本来就在视口内 → 不加任何平移', async () => {
    const w = await openAt(100, 400, 1440)
    expect(panel().style.transform).toBe('')
    w.unmount()
  })

  it('窗口缩放时重新夹取', async () => {
    const w = await openAt(100, 400, 1440)
    expect(panel().style.transform).toBe('')
    Object.defineProperty(window, 'innerWidth', { value: 420, configurable: true })
    window.dispatchEvent(new Event('resize'))
    await frame()
    await nextTick()
    expect(panel().style.transform).toBe('translateX(-88px)')
    w.unmount()
  })
})
```

- [ ] **Step 2: 跑,确认失败**

Run: `npx vitest run tests/ColumnFilter.test.ts tests/viewportClamp.test.ts`
Expected: `Test Files  2 failed (2)`、`Tests  14 failed | 38 passed (52)`(实测)—— `viewportClamp.test.ts` 整个文件加载失败(`Cannot find module '../src/viewportClamp'`);`ColumnFilter.test.ts` 14 条红:首列「条件」/ 且或下拉(`.smart-table-filter-lead` 为 null、分段按钮仍在、没有 `update:logic`)、「添加条件」无图标且仍是主色、自定义面板类、options 的箭头与提示、单选 NRadio、夹进视口 4 条(`expected '' to be 'translateX(77px)'`),外加有意改动的「两行 + 『或』」。

- [ ] **Step 3: 实现**

**新建 `src/viewportClamp.ts`:**

```ts
// 弹层水平夹进视口(L0-9)。NPopover 的 placement="bottom" 把弹层居中在触发器上,触发器靠近视口边缘时(窄屏尤其明显:
// 390px 宽下 400px 的列头面板左缘落在 x = -69)弹层的一侧会被裁出屏幕。公开的 NPopover 没有「夹进视口」的开关,
// 所以量出弹层当前的位置,给内容加一个水平平移把它拉回来(设计原型 placeHpop 也是这么夹的)。
// 窄档改用底部抽屉属于 P2(cardOnNarrow);在那之前,窄容器至少不能把内容裁掉。

/**
 * 弹层要水平平移多少像素才能完全落进 [margin, viewport − margin]。
 * left / width:弹层「不含这次平移」的自然位置与宽度;已经在范围内 → 0;放不下(比视口 − 两侧边距还宽)→ 贴左边距
 * (保证左侧的标签、比较符可见,右侧被裁比左侧被裁更不影响操作)。结果取整,避免 translateX(77.3333px) 的模糊渲染。
 */
export function clampShift(left: number, width: number, viewport: number, margin = 8): number {
  const max = viewport - margin - width
  let dx = 0
  if (max < margin) dx = margin - left
  else if (left < margin) dx = margin - left
  else if (left > max) dx = max - left
  return Math.round(dx)
}
```

**`playground/prototype/ProtoApp.vue` 查找(整段,原样):**

```vue
      filterIn: 'IN', // 「属于」
      filterNotIn: 'NOT IN', // 「不属于」
      filterNoValue: '不需要填值', // 「无需填值」
    },
  }),
)
```

**替换为:**

```vue
      filterIn: 'IN', // 「属于」
      filterNotIn: 'NOT IN', // 「不属于」
      filterNoValue: '不需要填值', // 「无需填值」
      filterSimple: '收起高级条件', // 「返回列表」
    },
  }),
)
```

**`src/ColumnFilter.vue` 查找(整段,原样)(第 1 / 10 处):**

```vue
//   condition —— Bootstrap Blazor 风格,多行 [操作符 + 值](最多 5 条,≥ 2 条出现且/或)
// 面板内改的是草稿,点「确定」才提交,避免每敲一个字就打一次远程请求;Esc / 点外部丢弃草稿。
// 键盘 / 焦点 / ARIA:公开的 NPopover 不管(焦点不进面板、Esc 不关闭,见设计文档 9.1),这里自己做(D6)。
import { computed, nextTick, reactive, ref, watch, type PropType } from 'vue'
import { NButton, NCheckbox, NPopover, NRadioButton, NRadioGroup, NSpace, NTooltip, useThemeVars } from 'naive-ui'
import type { FilterAction, FilterLogic, FilterValue, SmartTableLabels, SmartTableOption } from './types'
import { filterDefTitle, type FilterDef } from './useColumns'
import {
```

**替换为:**

```vue
//   condition —— Bootstrap Blazor 风格,多行 [操作符 + 值](最多 5 条,≥ 2 条出现且/或)
// 面板内改的是草稿,点「确定」才提交,避免每敲一个字就打一次远程请求;Esc / 点外部丢弃草稿。
// 键盘 / 焦点 / ARIA:公开的 NPopover 不管(焦点不进面板、Esc 不关闭,见设计文档 9.1),这里自己做(D6)。
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch, type PropType } from 'vue'
import { NButton, NCheckbox, NPopover, NRadio, NRadioGroup, NTooltip, useThemeVars } from 'naive-ui'
import type { FilterAction, FilterLogic, FilterValue, SmartTableLabels, SmartTableOption } from './types'
import { filterDefTitle, type FilterDef } from './useColumns'
import {
```

**`src/ColumnFilter.vue` 查找(整段,原样)(第 2 / 10 处):**

```vue
} from './filter'
import { fmt } from './labels'
import { optionLabel } from './useOptions'
import { FilterIcon } from './icons'
import ConditionRow from './ConditionRow.vue'
import {
  MAX_CONDITIONS,
```

**替换为:**

```vue
} from './filter'
import { fmt } from './labels'
import { optionLabel } from './useOptions'
import { FilterIcon, PlusIcon } from './icons'
import { clampShift } from './viewportClamp'
import ConditionRow from './ConditionRow.vue'
import {
  MAX_CONDITIONS,
```

**`src/ColumnFilter.vue` 查找(整段,原样)(第 3 / 10 处):**

```vue
}>()

const themeVars = useThemeVars()
const show = ref(false)
const active = computed(() => isFilterActive(props.value))
const activeCount = computed(() => activeConditions(props.value).length)
```

**替换为:**

```vue
}>()

const themeVars = useThemeVars()
// 工具行的文字按钮用官方 small 档(与同一面板里 small 的值控件一致):字 14 / 图标 18 / 内边距 0 10px / 高 heightSmall(28)。
// 官方文字按钮(text)把高度与内边距重置成 initial,所以高度取主题的 heightSmall、内边距在样式里写 paddingSmall 的值
const toolsBtnStyle = computed(() => ({ height: themeVars.value.heightSmall }))
const show = ref(false)
const active = computed(() => isFilterActive(props.value))
const activeCount = computed(() => activeConditions(props.value).length)
```

**`src/ColumnFilter.vue` 查找(整段,原样)(第 4 / 10 处):**

```vue
  panelRef.value?.querySelector<HTMLElement>(FOCUSABLE)?.focus()
}

/** 有 NSelect / NDatePicker 下拉展开的条件行下标。展开期间 Esc 只该收起那个下拉,不能连面板一起关掉(草稿会丢)。 */
const dropdownRows = reactive(new Set<number>())
const dropdownOpen = computed(() => dropdownRows.size > 0)
```

**替换为:**

```vue
  panelRef.value?.querySelector<HTMLElement>(FOCUSABLE)?.focus()
}

/* ---- 不出屏(L0-9):NPopover 把面板居中在漏斗上,触发器靠近视口边缘时会被裁出屏幕;量出位置后给面板加一个水平平移夹回来 ---- */

const shiftX = ref(0)
let clampRaf = 0
function updateShift() {
  const el = panelRef.value
  if (!el) return
  // 量 NPopover 的定位容器(vueuc 的 follower:只有定位用的平移),不量面板自己:
  // 弹层有淡入 + 缩放的进场动画,面板自己的 rect 在动画里是缩小的,会量错;容器的 rect 就是真实的布局位置,也不含我们加的平移。
  // 找不到容器(换了版本 / 不是在 NPopover 里)就退回量面板自己,并还原它身上已有的平移。
  const host = el.closest<HTMLElement>('.v-binder-follower-content')
  const r = (host ?? el).getBoundingClientRect()
  const left = host ? r.left : r.left - shiftX.value
  const next = clampShift(left, r.width, window.innerWidth)
  if (next !== shiftX.value) shiftX.value = next
}
function scheduleShift() {
  cancelAnimationFrame(clampRaf)
  clampRaf = requestAnimationFrame(updateShift)
}
function startClamp() {
  scheduleShift()
  window.addEventListener('resize', scheduleShift)
  window.addEventListener('scroll', scheduleShift, true) // 表头横向滚动 / 页面滚动时 NPopover 会跟着重新定位
}
function stopClamp() {
  cancelAnimationFrame(clampRaf)
  window.removeEventListener('resize', scheduleShift)
  window.removeEventListener('scroll', scheduleShift, true)
}
onBeforeUnmount(stopClamp)

/** 有 NSelect / NDatePicker 下拉展开的条件行下标。展开期间 Esc 只该收起那个下拉,不能连面板一起关掉(草稿会丢)。 */
const dropdownRows = reactive(new Set<number>())
const dropdownOpen = computed(() => dropdownRows.size > 0)
```

**`src/ColumnFilter.vue` 查找(整段,原样)(第 5 / 10 处):**

```vue
// 弹层内容挂载(每次打开都会重新挂载)后再聚焦第一个可编辑控件:内容是 teleport 出去的,show 变 true 时还不在 DOM 里。
// 宿主自定义面板(def.render)不自动聚焦:里面是什么控件库不知道,抢焦点可能打断宿主自己的逻辑。
watch(panelRef, (el) => {
  if (el && show.value && !props.def.render) void nextTick(focusFirst)
})
// 外部(编程式 setFilter / clearFilters)改了值,弹层开着也要跟上
watch(
```

**替换为:**

```vue
// 弹层内容挂载(每次打开都会重新挂载)后再聚焦第一个可编辑控件:内容是 teleport 出去的,show 变 true 时还不在 DOM 里。
// 宿主自定义面板(def.render)不自动聚焦:里面是什么控件库不知道,抢焦点可能打断宿主自己的逻辑。
watch(panelRef, (el) => {
  if (!el) {
    stopClamp()
    shiftX.value = 0
    return
  }
  startClamp()
  if (show.value && !props.def.render) void nextTick(focusFirst)
})
// 外部(编程式 setFilter / clearFilters)改了值,弹层开着也要跟上
watch(
```

**`src/ColumnFilter.vue` 查找(整段,原样)(第 6 / 10 处):**

```vue
    <div
      ref="panelRef"
      class="smart-table-filter"
      :class="{ 'smart-table-filter--condition': !def.render && showEditor }"
      role="dialog"
      tabindex="-1"
      :aria-label="panelLabel"
```

**替换为:**

```vue
    <div
      ref="panelRef"
      class="smart-table-filter"
      :class="{ 'smart-table-filter--condition': !def.render && showEditor, 'smart-table-filter--custom': !!def.render }"
      role="dialog"
      tabindex="-1"
      :aria-label="panelLabel"
```

**`src/ColumnFilter.vue` 查找(整段,原样)(第 7 / 10 处):**

```vue
        borderRadius: themeVars.borderRadius,
        boxShadow: themeVars.boxShadow2,
        color: themeVars.textColor2,
      }"
      @click.stop
      @keydown.capture="onPanelKeydown"
```

**替换为:**

```vue
        borderRadius: themeVars.borderRadius,
        boxShadow: themeVars.boxShadow2,
        color: themeVars.textColor2,
        transform: shiftX ? `translateX(${shiftX}px)` : undefined,
      }"
      @click.stop
      @keydown.capture="onPanelKeydown"
```

**`src/ColumnFilter.vue` 查找(整段,原样)(第 8 / 10 处):**

```vue
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
            @update:action="(a: FilterAction) => onAction(i, a)"
            @update:value="(v: unknown) => onValue(i, v)"
            @remove="onRemove(i)"
            @enter="confirm"
            @dropdown="(o: boolean) => onDropdown(i, o)"
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

```

**替换为:**

```vue
      />

      <template v-else>
        <div class="smart-table-filter-body">
          <!-- options 单选(filter.multiple: false):官方用 NRadioGroup / NRadio(data-table/src/HeaderButton/FilterMenu.mjs:118-141),
               不能用复选框模拟 -->
          <n-radio-group
            v-if="def.mode === 'options' && !advanced && !def.multiple"
            class="smart-table-filter-options"
            :name="`smart-table-filter-${def.key}`"
            :value="(checked[0] ?? null) as string | number | null"
            @update:value="(v: string | number | null) => (checked = v == null ? [] : [v])"
          >
            <n-radio v-for="opt in flatOptions" :key="String(opt.value)" :value="opt.value as string | number" :disabled="opt.disabled">
              {{ optionLabel(opt) }}
            </n-radio>
            <span v-if="!flatOptions.length" :style="{ color: themeVars.textColor3 }">
              {{ isLoadingOptions(def.optionsKey) ? '...' : '—' }}
            </span>
          </n-radio-group>

          <!-- options 多选:勾选候选项 -->
          <div v-else-if="def.mode === 'options' && !advanced" class="smart-table-filter-options">
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

          <!-- 多条件编辑(condition 列恒显示;options 列展开「高级条件」后显示):首列「条件」/ 且或下拉 + 比较符 + 值 + 删除 -->
          <div v-else class="smart-table-filter-conditions">
            <ConditionRow
              v-for="(c, i) in draft.conditions"
              :key="i"
              :def="def"
              :condition="c"
              :index="i"
              :logic="draft.logic"
              :labels="labels"
              :get-options="getOptions"
              :is-loading-options="isLoadingOptions"
              :date-value-format="dateValueFormat"
              :removable="draft.conditions.length > 1"
              @update:action="(a: FilterAction) => onAction(i, a)"
              @update:value="(v: unknown) => onValue(i, v)"
              @update:logic="onLogic"
              @remove="onRemove(i)"
              @enter="confirm"
              @dropdown="(o: boolean) => onDropdown(i, o)"
            />
          </div>

          <!-- 工具行:condition / 高级条件 = 「添加条件」(文字按钮 + 加号);options 勾选态 = 「高级条件 ▾」;
               options 的高级条件态再靠右放「返回列表 ▴」 -->
          <div class="smart-table-filter-tools">
            <n-button
              v-if="def.mode === 'options' && !advanced"
              class="smart-table-filter-advanced-open"
              text
              size="small"
              :style="toolsBtnStyle"
              @click="openAdvanced"
            >
              {{ labels.filterAdvanced }} ▾
            </n-button>
            <template v-else>
              <n-button
                class="smart-table-filter-add"
                text
                size="small"
                :style="toolsBtnStyle"
                :disabled="draft.conditions.length >= MAX_CONDITIONS"
                @click="onAdd"
              >
                <template #icon><PlusIcon /></template>
                {{ labels.filterAddCondition }}
              </n-button>
              <n-button
                v-if="def.mode === 'options'"
                class="smart-table-filter-advanced-close"
                text
                size="small"
                :style="toolsBtnStyle"
                :disabled="!canCollapse"
                @click="closeAdvanced"
              >
                {{ labels.filterSimple }} ▴
              </n-button>
            </template>
          </div>
          <div
            v-if="def.mode === 'options' && advanced && !canCollapse"
            class="smart-table-filter-hint"
            :style="{ color: themeVars.textColor3 }"
          >
            {{ labels.filterCannotCollapse }}
          </div>
        </div>
      </template>

```

**`src/ColumnFilter.vue` 查找(整段,原样)(第 9 / 10 处):**

```vue
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
```

**替换为:**

```vue
        class="smart-table-filter-footer"
        :style="{ borderTop: `1px solid ${themeVars.dividerColor}` }"
      >
        <n-button size="tiny" @click="reset">{{ labels.filterReset }}</n-button>
        <n-button size="tiny" type="primary" @click="confirm">{{ labels.filterConfirm }}</n-button>
      </div>
    </div>
  </n-popover>
```

**`src/ColumnFilter.vue` 查找(整段,原样)(第 10 / 10 处):**

```vue
  pointer-events: none;
  background: var(--n-th-icon-color-active);
}
.smart-table-filter {
  min-width: 200px;
  padding: 8px;
  /* 表头文字常是 center,弹层内容一律左对齐 */
  text-align: left;
  font-weight: normal;
}
/* 容器只接程序化焦点(点空白处 / Esc 的落点),不画焦点环 */
.smart-table-filter:focus {
  outline: none;
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

**替换为:**

```vue
  pointer-events: none;
  background: var(--n-th-icon-color-active);
}
/* 面板(设计原型 .hpop):外壳 padding 0,正文 12px 12px 0,底部 footer 自带 8px 12px 内边距与分隔线。
   options 面板宽度由内容定(最小 168),condition 面板固定 400(窄屏不越出视口)。 */
.smart-table-filter {
  min-width: 168px;
  max-width: calc(100vw - 16px);
  /* 表头文字常是 center,弹层内容一律左对齐 */
  text-align: left;
  font-weight: normal;
}
/* 自定义面板(def.render)沿用 2.1.1 的 8px 内边距 / 200px 最小宽,不套新的排布 */
.smart-table-filter--custom {
  min-width: 200px;
  padding: 8px;
}
/* 容器只接程序化焦点(点空白处 / Esc 的落点),不画焦点环 */
.smart-table-filter:focus {
  outline: none;
}
.smart-table-filter--condition {
  width: min(400px, calc(100vw - 16px));
}
.smart-table-filter-body {
  padding: 12px 12px 0;
}
/* options 勾选列表:选项间距 12px(行高 22.4 → 间隔 34.4),最高 240 滚动(原型 .hp-group / 官方勾选菜单) */
.smart-table-filter-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 240px;
  overflow-y: auto;
}
.smart-table-filter-conditions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
/* 工具行:与上方内容 8px、与下方 8px;按钮是官方 small 档(`button/styles/_common.mjs`:`heightSmall` 28 / `paddingSmall` 0 10px /
   `fontSizeSmall` 14 / `iconSizeSmall` 18),原型 `.hp-tools .n-btn.text` 同款(第 4 批已改)。官方文字按钮(text)把高度与内边距重置成 initial,
   所以高度由模板里取主题 heightSmall(`toolsBtnStyle`),内边距在这里写 paddingSmall 的值;颜色保持官方文字按钮的 textColor2 / 悬停主色 */
.smart-table-filter-tools {
  display: flex;
  align-items: center;
  margin-top: 8px;
  margin-bottom: 8px;
}
.smart-table-filter-tools .n-button {
  padding: 0 10px;
}
.smart-table-filter-advanced-close {
  margin-left: auto;
}
.smart-table-filter-hint {
  margin: -4px 0 8px;
  font-size: 12px;
}
.smart-table-filter-footer {
  display: flex;
  flex-wrap: nowrap;
  justify-content: space-evenly;
  padding: 8px 12px;
}
.smart-table-filter-footer .n-button {
  margin-right: 8px;
}
.smart-table-filter-footer .n-button:last-child {
  margin-right: 0;
}
</style>
```

**`src/ConditionRow.vue` 查找(整段,原样)(第 1 / 7 处):**

```vue
<script setup lang="ts">
// 面板里的一行条件:操作符 + 值控件 + 删除。受控(草稿由 ColumnFilter 持有),只发事件。
// 值控件按操作符的值形状分发:无值(isNull 等)→ 禁用的占位框;数组(in / notIn)→ 多选;标量 → 按列类型选控件。
import { computed, onBeforeUnmount, reactive, watch, type PropType } from 'vue'
import { NButton, NDatePicker, NInput, NInputNumber, NSelect } from 'naive-ui'
import type { SelectProps } from 'naive-ui'
import type { FilterAction, FilterCondition, SmartTableLabels, SmartTableOption } from './types'
import type { FilterDef } from './useColumns'
import { actionValueKind } from './filter'
import { ACTION_LABEL_KEY } from './labels'
```

**替换为:**

```vue
<script setup lang="ts">
// 面板里的一行条件:首列(第 1 行是「条件」引导标签,第 2 行起是且 / 或下拉)+ 操作符 + 值控件 + 删除。
// 受控(草稿由 ColumnFilter 持有),只发事件。排布是 4 列网格 56 / 112 / 1fr / 28(设计原型 .hp-row),删除列恒占位,所以 1 行与多行的值输入同宽。
// 值控件按操作符的值形状分发:无值(isNull 等)→ 禁用的占位框;数组(in / notIn)→ 多选;标量 → 按列类型选控件。
import { computed, onBeforeUnmount, reactive, watch, type PropType } from 'vue'
import { NButton, NDatePicker, NInput, NInputNumber, NSelect, useThemeVars } from 'naive-ui'
import type { SelectProps } from 'naive-ui'
import type { FilterAction, FilterCondition, FilterLogic, SmartTableLabels, SmartTableOption } from './types'
import type { FilterDef } from './useColumns'
import { actionValueKind } from './filter'
import { ACTION_LABEL_KEY } from './labels'
```

**`src/ConditionRow.vue` 查找(整段,原样)(第 2 / 7 处):**

```vue
const props = defineProps({
  def: { type: Object as PropType<FilterDef>, required: true },
  condition: { type: Object as PropType<FilterCondition>, required: true },
  labels: { type: Object as PropType<Required<SmartTableLabels>>, required: true },
  getOptions: { type: Function as PropType<(key: string) => SmartTableOption[]>, required: true },
  isLoadingOptions: { type: Function as PropType<(key: string) => boolean>, required: true },
```

**替换为:**

```vue
const props = defineProps({
  def: { type: Object as PropType<FilterDef>, required: true },
  condition: { type: Object as PropType<FilterCondition>, required: true },
  /** 这是第几行(0 起):第 0 行首列是「条件」引导标签,其余行是且 / 或下拉。 */
  index: { type: Number, default: 0 },
  /** 整组条件的连接方式(第 2 行起的首列下拉显示它;改它就是改整组)。 */
  logic: { type: String as PropType<FilterLogic>, default: 'and' },
  labels: { type: Object as PropType<Required<SmartTableLabels>>, required: true },
  getOptions: { type: Function as PropType<(key: string) => SmartTableOption[]>, required: true },
  isLoadingOptions: { type: Function as PropType<(key: string) => boolean>, required: true },
```

**`src/ConditionRow.vue` 查找(整段,原样)(第 3 / 7 处):**

```vue

const emit = defineEmits<{
  'update:action': [a: FilterAction]
  'update:value': [v: unknown]
  remove: []
  enter: []
```

**替换为:**

```vue

const emit = defineEmits<{
  'update:action': [a: FilterAction]
  'update:logic': [l: FilterLogic]
  'update:value': [v: unknown]
  remove: []
  enter: []
```

**`src/ConditionRow.vue` 查找(整段,原样)(第 4 / 7 处):**

```vue
  dropdown: [open: boolean]
}>()

const kind = computed(() => actionValueKind(props.condition.action))

// 下拉展开状态:操作符下拉与值控件各记一份,任意一个展开就算「这一行有下拉展开」。
// 面板要靠它区分 Esc 是「收起下拉」还是「关闭面板」(NSelect / NDatePicker 收起自己时不 stopPropagation)。
const open = reactive({ action: false, value: false })
watch(
  () => open.action || open.value,
  (v) => emit('dropdown', v),
)
onBeforeUnmount(() => {
  if (open.action || open.value) emit('dropdown', false)
})

// 当前操作符不在 def.actions 里时(编程式给了列声明之外的操作符),也要能在下拉里显示出来,不能变成空白
const actionOptions = computed<SelectOpt[]>(() => {
```

**替换为:**

```vue
  dropdown: [open: boolean]
}>()

const themeVars = useThemeVars()
const kind = computed(() => actionValueKind(props.condition.action))

// 下拉展开状态:操作符下拉与值控件各记一份,任意一个展开就算「这一行有下拉展开」。
// 面板要靠它区分 Esc 是「收起下拉」还是「关闭面板」(NSelect / NDatePicker 收起自己时不 stopPropagation)。
const open = reactive({ logic: false, action: false, value: false })
watch(
  () => open.logic || open.action || open.value,
  (v) => emit('dropdown', v),
)
onBeforeUnmount(() => {
  if (open.logic || open.action || open.value) emit('dropdown', false)
})

// 且 / 或:文案走 labels(渲染期求值)
const logicOptions = computed<SelectOpt[]>(() => [
  { label: props.labels.filterLogicAnd, value: 'and' },
  { label: props.labels.filterLogicOr, value: 'or' },
])

// 当前操作符不在 def.actions 里时(编程式给了列声明之外的操作符),也要能在下拉里显示出来,不能变成空白
const actionOptions = computed<SelectOpt[]>(() => {
```

**`src/ConditionRow.vue` 查找(整段,原样)(第 5 / 7 处):**

```vue

<template>
  <div class="smart-table-filter-row">
    <n-select
      class="smart-table-filter-action"
      size="small"
```

**替换为:**

```vue

<template>
  <div class="smart-table-filter-row">
    <!-- 首列:第 1 行「条件」引导标签(12px、textColor3);第 2 行起是且 / 或下拉,选哪个都是改整组的连接方式 -->
    <span v-if="index === 0" class="smart-table-filter-lead" :style="{ color: themeVars.textColor3 }">{{
      labels.filterConditionLead
    }}</span>
    <n-select
      v-else
      class="smart-table-filter-logic"
      size="small"
      :value="logic"
      :options="logicOptions"
      @update:value="(l: FilterLogic) => emit('update:logic', l)"
      @update:show="(v: boolean) => (open.logic = v)"
    />
    <n-select
      class="smart-table-filter-action"
      size="small"
```

**`src/ConditionRow.vue` 查找(整段,原样)(第 6 / 7 处):**

```vue
      class="smart-table-filter-remove"
      quaternary
      circle
      size="tiny"
      :aria-label="labels.filterRemoveCondition"
      @click="emit('remove')"
    >
```

**替换为:**

```vue
      class="smart-table-filter-remove"
      quaternary
      circle
      size="small"
      :theme-overrides="{ iconSizeSmall: '12px' }"
      :aria-label="labels.filterRemoveCondition"
      @click="emit('remove')"
    >
```

**`src/ConditionRow.vue` 查找(整段,原样)(第 7 / 7 处):**

```vue
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

**替换为:**

```vue
</template>

<style scoped>
/* 4 列网格(设计原型 .hp-row):首列 56(「条件」/ 且或)、比较符 112、值 1fr、删除 28(恒占位)、间距 8。
   NSelect / NInput 的根节点都是 width:100%,放进网格单元即可,不需要 flex-basis 的技巧。 */
.smart-table-filter-row {
  display: grid;
  grid-template-columns: 56px 112px minmax(0, 1fr) 28px;
  align-items: center;
  gap: 8px;
}
.smart-table-filter-lead {
  min-width: 0;
  font-size: 12px;
  text-align: center;
}
.smart-table-filter-logic,
.smart-table-filter-action {
  min-width: 0;
}
.smart-table-filter-value {
  min-width: 0;
}
</style>
```

**`src/icons.ts` 查找(整段,原样):**

```ts
export const RefreshIcon = lineIcon(['M23 4v6h-6', 'M20.49 15a9 9 0 1 1-2.13-9.36L23 10'])
export const DensityIcon = lineIcon(['M3 6h18', 'M3 12h18', 'M3 18h18'])
export const ColumnsIcon = lineIcon(['M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M9 3v18', 'M15 3v18'])
export const ChevronDownIcon = lineIcon(['M6 9l6 6 6-6'])
export const CloseIcon = lineIcon(['M18 6L6 18', 'M6 6l12 12'])
// 漏斗:表头过滤触发图标(实心,过滤生效时整体变主题色)
export const FilterIcon: FunctionalComponent = () =>
  h(
```

**替换为:**

```ts
export const RefreshIcon = lineIcon(['M23 4v6h-6', 'M20.49 15a9 9 0 1 1-2.13-9.36L23 10'])
export const DensityIcon = lineIcon(['M3 6h18', 'M3 12h18', 'M3 18h18'])
export const ColumnsIcon = lineIcon(['M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M9 3v18', 'M15 3v18'])
// 小号图标(chevron / 关闭 / 加号):与设计原型 I_CHEV / I_X / I_PLUS 同一套几何(16 × 16 视口、笔画 1.8 / 1.6),
// 用在 12–13px 的小尺寸上;笔画随视口缩放,换成 24 视口 + 2 的笔画会在 12px 下细一圈。
function smallIcon(paths: string[], strokeWidth: number): FunctionalComponent {
  return () =>
    h(
      'svg',
      {
        viewBox: '0 0 16 16',
        width: '1em',
        height: '1em',
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': strokeWidth,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        'aria-hidden': 'true',
      },
      paths.map((d) => h('path', { d })),
    )
}
export const ChevronDownIcon = smallIcon(['m4 6 4 4 4-4'], 1.8)
export const CloseIcon = smallIcon(['M4 4l8 8M12 4l-8 8'], 1.8)
export const PlusIcon = smallIcon(['M8 3v10M3 8h10'], 1.6)
// 漏斗:表头过滤触发图标(实心,过滤生效时整体变主题色)
export const FilterIcon: FunctionalComponent = () =>
  h(
```

**`src/labels.ts` 查找(整段,原样)(第 1 / 2 处):**

```ts
  filterLogicOr: 'OR',
  filterAdvanced: 'Advanced conditions',
  filterSimple: 'Back to list',
  filterClearAll: 'Clear all',
  filterRestoreDefault: 'Restore defaults',
}
```

**替换为:**

```ts
  filterLogicOr: 'OR',
  filterAdvanced: 'Advanced conditions',
  filterSimple: 'Back to list',
  filterConditionLead: 'Where',
  filterCannotCollapse: 'Contains conditions checkboxes cannot show',
  filterClearAll: 'Clear all',
  filterRestoreDefault: 'Restore defaults',
}
```

**`src/labels.ts` 查找(整段,原样)(第 2 / 2 处):**

```ts
  filterLogicOr: '或',
  filterAdvanced: '高级条件',
  filterSimple: '返回列表',
  filterClearAll: '清除全部',
  filterRestoreDefault: '恢复默认',
}
```

**替换为:**

```ts
  filterLogicOr: '或',
  filterAdvanced: '高级条件',
  filterSimple: '返回列表',
  filterConditionLead: '条件',
  filterCannotCollapse: '含勾选无法表达的条件',
  filterClearAll: '清除全部',
  filterRestoreDefault: '恢复默认',
}
```

**`src/types.ts` 查找(整段,原样):**

```ts
  /** options 列底部展开多条件编辑的入口 / 收起回勾选列表的入口。 */
  filterAdvanced?: string
  filterSimple?: string
  filterClearAll?: string
  filterRestoreDefault?: string
}
```

**替换为:**

```ts
  /** options 列底部展开多条件编辑的入口 / 收起回勾选列表的入口。 */
  filterAdvanced?: string
  filterSimple?: string
  /** 面板里第 1 行条件前的引导标签(第 2 行起这一列是且 / 或下拉)。 */
  filterConditionLead?: string
  /** 高级条件里含勾选表达不了的条件时,「返回」禁用的原因提示。 */
  filterCannotCollapse?: string
  filterClearAll?: string
  filterRestoreDefault?: string
}
```

- [ ] **Step 4: 跑,确认通过**

Run: `npm test && npm run typecheck`
Expected: `Test Files  22 passed (22)`、`Tests  385 passed (385)`(363 + 22:`viewportClamp.test.ts` 6、`ColumnFilter.test.ts` +16);typecheck 无输出;无 `[Vue warn]`(`config.test.ts` 的 labels 完整性用例会守住两个新键同时出现在 `defaultLabels` 与 `zhCNLabels`)。

- [ ] **Step 5: 浏览器验证(对照页 vs 原型)**

Run: `node_modules/.bin/vite --port 5173`,打开 `/prototype.html?m=3`(1440 × 900,浅色)。点「物料编码」表头的漏斗打开面板,控制台粘贴(再点「添加条件」后重读一次):
```js
(() => {
  const pop = document.querySelector('.smart-table-filter')
  const pr = pop.getBoundingClientRect()
  const rel = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return [b.left - pr.left, b.top - pr.top, b.width, b.height].map((v) => Math.round(v * 10) / 10).join(',') }
  const q = (s) => pop.querySelector(s)
  return {
    panel: pr.width + 'x' + Math.round(pr.height * 10) / 10,
    lead: rel(q('.smart-table-filter-lead')),
    op: rel(q('.smart-table-filter-action')),
    del: rel(q('.smart-table-filter-remove')),
    logic: rel(q('.smart-table-filter-logic')),
    add: rel(q('.smart-table-filter-add')),
    advanced: rel(q('.smart-table-filter-advanced-open')),
    options: [...pop.querySelectorAll('.smart-table-filter-options .n-checkbox, .smart-table-filter-options .n-radio')].map((e) => rel(e).split(',')[1]).join(' / '),
    footer: rel(q('.smart-table-filter-footer')),
    footBtns: [...pop.querySelectorAll('.smart-table-filter-footer button')].map(rel).join(' ; '),
    addColor: q('.smart-table-filter-add') && getComputedStyle(q('.smart-table-filter-add')).color,
  }
})()
```
Expected(库侧,坐标都相对面板左上角;括号里是原型 `.hpop` 同一批读数):
- 1 行(`cond1`):`panel` = `400x123`(原型 400 × 123)、`lead` = `12,16.4,56,19.2`(原型相同)、`op` = `76,12,112,28`(原型相同)、`add` = `12,48,100,28`(原型 `102,28`,差 2px 边框)、`footer` = `0,84,400,39`(原型相同)、`footBtns` = `110.7,93,36,22 ; 253.3,93,36,22`(原型 `109.3 / 252.7,38×22`,差 2px 边框导致 `space-evenly` 的位置差 ≈ 1px);`del`、`logic` 为 `null`;
- 点「添加条件」后 2 行(`cond2`):`panel` = `400x163`(原型相同)、`del` = `360,12,28,28`(原型相同)、`logic` = `12,52,56,28`(原型相同,第 2 行首列是且 / 或下拉)、`add` = `12,88,100,28`、`footer` = `0,124,400,39`;**且 / 或下拉在这一行的首列,不再有行下方的分段按钮**。
- 「添加条件」文字色 `rgb(51, 54, 57)`(深色,不是主色 `rgb(24, 160, 88)`)、字号 14px、高 28px、图标 18px(官方 small 档);暗色下 `rgba(255, 255, 255, 0.82)`,原型相同。
- 点「单据状态」的漏斗(多选 options 列):面板 `168x220.6`(带「全选」一行;原型读数相同 `168x220.6`)、选项行 y = `12 / 46.4 / 80.8 / 115.2`(**间隔 34.4**,原型相同)、「高级条件 ▾」 `12,145.6,91.8,28`(原型 `93.8`,差 2px 边框)、`footer` = `0,181.6,168,39`;点「高级条件 ▾」展开后底部是「返回列表 ▴」(靠右);往条件里加一个 `notEqual` 条件后「返回」禁用并显示「含勾选无法表达的条件」。
- 点「部门」的漏斗(`multiple: false`):选项是**单选按钮**(`.n-radio`,16px 圆),没有复选框、没有「全选」;选一个再选另一个 → 前一个取消;确认后 chips 里只有一个「部门 等于 …」。
**不出屏**:DevTools 设备模拟把宽度设成 390(或把窗口拉窄到 390),点「物料编码」的漏斗,控制台:`(() => { const r = document.querySelector('.smart-table-filter').getBoundingClientRect(); return { left: r.left, right: r.right, width: r.width, vw: innerWidth, inView: r.left >= 8 && r.right <= innerWidth - 8 } })()`。Expected:`left` = `8`、`width` = `374`、`right` = `382`、`inView` = `true`(**修复前 `left = -69`**,左侧被裁出屏幕)。再把窗口设成 520 宽、把表格横向滚到最右、点最右一列(「单据日期」)的漏斗:`right` ≤ `512`(= 520 − 8,面板带 `translateX` 向左夹回)。拖动 / 滚动表格时面板跟着漏斗走且始终在视口内。

- [ ] **Step 6: 提交**

```bash
git add src/viewportClamp.ts src/ColumnFilter.vue src/ConditionRow.vue src/icons.ts src/labels.ts src/types.ts playground/prototype/ProtoApp.vue tests/viewportClamp.test.ts tests/ColumnFilter.test.ts
git commit -m "style: 列头面板排布对齐原型(首列「条件」/ 且或下拉、4 列网格、添加条件文字按钮、底部 space-evenly);单选过滤用 NRadio;面板夹进视口(L0-5、L0-9)" -m "新增可选 labels filterConditionLead / filterCannotCollapse;有意改动 tests/ColumnFilter.test.ts 里 1 条且 / 或断言(分段按钮 → 首列下拉)。窄档抽屉仍归 P2。" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 13f: chips 外观与行末按钮规则对齐原型(L0-6)

> - **外观**(原型 `.chips` / `.chip` / `.clear`、`hdrChipsHtml`):chip 是**主色**的可点 `NTag small round closable`(22px 高;底 primary 10%、字 primary、`cursor: pointer`);孤儿 chip(列已不存在,没有面板可开)保持默认灰;间距 `8px 12px`,行下方 12px(原来 `padding-bottom: 8px`、`gap: 6px`,行高 30);「清除全部」文字按钮 22px 高、`padding: 0 4px`,**紧跟在 chips 后面**(原来靠最右)。
> - **行末按钮出现的规则(和原型第 1 批一致)**:**有默认值的表**(任一列声明了生效的 `filter.defaultValue`):只在当前过滤态**偏离默认**时出现「恢复默认」(1 个 chip 也出现;回到默认就消失);**没有默认值的表**:≥ 2 个 chip 才出现「清除全部」(1 个 chip 自己的 × 就够了)。「偏离」= 把当前过滤态与各列默认值逐列比较(只比生效的条件;没有默认值的列要求没有生效条件;孤儿键有生效条件算偏离;单条条件时 `logic` 不同算相同)——纯函数 `filtersAtDefaults(defs, state)`。chips 行本身仍只在有 chip 时出现。
> - **有意改动的既有断言(2 处)**:`tests/SmartTable.test.ts` 的「行末按钮:没有列声明 defaultValue → 『Clear all』;点击清空全部」与「[Q-7] 孤儿键仍会进远程请求参数 —— 所以它必须看得见,『清除全部』也要渲染并能清掉它」原来只设了 **1 个**条件 / 1 个孤儿键就期望「清除全部」出现;≥ 2 才出现的新规则下,把它们改成设 2 个条件(2 个孤儿键)。断言本身(按钮文案、点击后清空)不变。
> - chips 是 P0 新增(Task 11),所以这些外观 / 规则不是对 2.1.1 的变化,不进 B 级。

**Files:**
- Modify: `src/FilterChips.vue`、`src/filterChips.ts`(`filtersAtDefaults`)、`src/SmartTable.vue`(传 `at-defaults`)
- Test: `tests/filterChips.test.ts`(追加)、`tests/SmartTable.test.ts`(追加 + **2 处有意改动**)

**Interfaces:**
- Consumes: Task 11 的 `FilterChips.vue` / `filterChips.ts`(`hasActiveDefaults`)。
- Produces: `filterChips.ts` 的 `filtersAtDefaults(defs: FilterDef[], state: FilterState): boolean`;`FilterChips` 新增 prop `atDefaults`。

- [ ] **Step 1: 写失败测试**

**`tests/SmartTable.test.ts` 查找(整段,原样)(第 1 / 3 处):**

```ts
  it('行末按钮:没有列声明 defaultValue → 「Clear all」;点击清空全部', async () => {
    const wrapper = mount(SmartTable, { props: { columns: cols, data: rows, rowKey: 'id', filterChips: true } })
    inst(wrapper).setFilter('name', value('contains', 'a'))
    await nextTick()
    const btn = wrapper.find('.smart-table-chips__clear')
    expect(btn.text()).toBe('Clear all')
```

**替换为:**

```ts
  it('行末按钮:没有列声明 defaultValue → 「Clear all」;点击清空全部', async () => {
    const wrapper = mount(SmartTable, { props: { columns: cols, data: rows, rowKey: 'id', filterChips: true } })
    inst(wrapper).setFilter('name', value('contains', 'a'))
    inst(wrapper).setFilter('dept', value('equal', 'x')) // 有意改动(L0-6):「清除全部」≥ 2 个 chip 才出现,原来只设 1 个条件
    await nextTick()
    const btn = wrapper.find('.smart-table-chips__clear')
    expect(btn.text()).toBe('Clear all')
```

**`tests/SmartTable.test.ts` 查找(整段,原样)(第 2 / 3 处):**

```ts
    const wrapper = mount(SmartTable, { props: { columns: cols, fetcher, rowKey: 'id', filterChips: true } })
    await flushPromises()
    inst(wrapper).setFilter('ghost', value('equal', 'x'))
    await flushPromises()
    expect(JSON.stringify(fetcher.mock.calls.at(-1)![0])).toContain('ghost')
    const btn = wrapper.find('.smart-table-chips__clear')
```

**替换为:**

```ts
    const wrapper = mount(SmartTable, { props: { columns: cols, fetcher, rowKey: 'id', filterChips: true } })
    await flushPromises()
    inst(wrapper).setFilter('ghost', value('equal', 'x'))
    inst(wrapper).setFilter('ghost2', value('equal', 'y')) // 有意改动(L0-6):「清除全部」≥ 2 个 chip 才出现,原来只有 1 个孤儿键
    await flushPromises()
    expect(JSON.stringify(fetcher.mock.calls.at(-1)![0])).toContain('ghost')
    const btn = wrapper.find('.smart-table-chips__clear')
```

**`tests/SmartTable.test.ts` 查找(整段,原样)(第 3 / 3 处):**

```ts
    await btn.trigger('click')
    await flushPromises()
    expect(JSON.stringify(fetcher.mock.calls.at(-1)![0])).not.toContain('ghost')
    wrapper.unmount()
  })

```

**替换为:**

```ts
    await btn.trigger('click')
    await flushPromises()
    expect(JSON.stringify(fetcher.mock.calls.at(-1)![0])).not.toContain('ghost')
    wrapper.unmount()
  })

  it('[L0-6] 1 个条件时没有「清除全部」(chip 自己的 × 就够了);≥ 2 个才出现', async () => {
    const wrapper = mount(SmartTable, { props: { columns: cols, data: rows, rowKey: 'id', filterChips: true } })
    inst(wrapper).setFilter('name', value('contains', 'a'))
    await nextTick()
    expect(wrapper.find('.smart-table-chips__clear').exists()).toBe(false)
    inst(wrapper).setFilter('dept', value('equal', 'x'))
    await nextTick()
    expect(wrapper.find('.smart-table-chips__clear').exists()).toBe(true)
    wrapper.unmount()
  })

  it('[L0-6] 有默认值的表:只在偏离默认时出现「Restore defaults」(1 个 chip 也出现);回到默认就消失', async () => {
    const withDefault = [{ key: 'name', title: '姓名', filter: { defaultValue: value('contains', 'seed') } }] as SmartTableColumn<unknown>[]
    const wrapper = mount(SmartTable, { props: { columns: withDefault, data: rows, rowKey: 'id', filterChips: true } })
    await nextTick()
    expect(wrapper.findAll('.smart-table-chip')).toHaveLength(1) // 初始过滤态 = 默认值,有 1 个 chip
    expect(wrapper.find('.smart-table-chips__clear').exists()).toBe(false) // 没偏离:不出现
    inst(wrapper).setFilter('name', value('contains', 'changed'))
    await nextTick()
    expect(wrapper.findAll('.smart-table-chip')).toHaveLength(1)
    expect(wrapper.find('.smart-table-chips__clear').text()).toBe('Restore defaults') // 偏离:1 个 chip 也出现
    await wrapper.find('.smart-table-chips__clear').trigger('click')
    await nextTick()
    expect(wrapper.find('.smart-table-chips__clear').exists()).toBe(false) // 回到默认:又消失
    wrapper.unmount()
  })

  it('[L0-6] 有默认值的表上用户又加了别的列的条件:算偏离,「Restore defaults」出现(它会清掉那些、恢复默认)', async () => {
    const mixed = [
      { key: 'name', title: '姓名', filter: { defaultValue: value('contains', 'seed') } },
      { key: 'dept', title: '部门', filter: true },
    ] as SmartTableColumn<unknown>[]
    const wrapper = mount(SmartTable, { props: { columns: mixed, data: rows, rowKey: 'id', filterChips: true } })
    await nextTick()
    inst(wrapper).setFilter('dept', value('equal', 'x'))
    await nextTick()
    expect(wrapper.find('.smart-table-chips__clear').text()).toBe('Restore defaults')
    await wrapper.find('.smart-table-chips__clear').trigger('click')
    await nextTick()
    expect(Object.keys(inst(wrapper).filters)).toEqual(['name'])
    wrapper.unmount()
  })

  it('[L0-6] chip 是主色(NTag type=primary)、可点;孤儿 chip(没有面板可开)是默认灰;「清除全部」紧跟在 chips 后面', async () => {
    const wrapper = mount(SmartTable, { props: { columns: cols, data: rows, rowKey: 'id', filterChips: true } })
    inst(wrapper).setFilter('name', value('contains', 'a'))
    inst(wrapper).setFilter('ghost', value('equal', 'x'))
    await nextTick()
    const tags = wrapper.findComponent(FilterChips).findAllComponents(NTag)
    expect(tags).toHaveLength(2)
    expect(tags[0].props('type')).toBe('primary')
    expect(tags[1].props('type')).toBe('default')
    const root = wrapper.find('.smart-table-chips').element
    expect(root.children[0].classList.contains('smart-table-chips__list')).toBe(true)
    expect(root.children[1].classList.contains('smart-table-chips__clear')).toBe(true)
    wrapper.unmount()
  })

```

**`tests/filterChips.test.ts` 查找(整段,原样):**

```ts
import { describe, expect, it } from 'vitest'
import { buildChips, countFitting, hasActiveDefaults, removeChipCondition, shrinkForMore } from '../src/filterChips'
import { defaultLabels } from '../src/labels'
import type { FilterDef } from '../src/useColumns'
import type { FilterState, FilterValue } from '../src/types'
```

**替换为:**

```ts
import { describe, expect, it } from 'vitest'
import { buildChips, countFitting, filtersAtDefaults, hasActiveDefaults, removeChipCondition, shrinkForMore } from '../src/filterChips'
import { defaultLabels } from '../src/labels'
import type { FilterDef } from '../src/useColumns'
import type { FilterState, FilterValue } from '../src/types'
```

**`tests/filterChips.test.ts` 追加到文件末尾:**

```ts

describe('filtersAtDefaults(过滤态是否就是默认值)', () => {
  const withDefault = [def({ key: 'a', defaultValue: v('and', ['equal', 'x']) }), def({ key: 'b' })]

  it('没有任何默认值、也没有条件 → 是默认态', () => {
    expect(filtersAtDefaults([def({ key: 'a' })], {})).toBe(true)
  })

  it('没有默认值但有生效条件 → 偏离', () => {
    expect(filtersAtDefaults([def({ key: 'a' })], { a: v('and', ['contains', '1']) })).toBe(false)
  })

  it('有默认值:状态恰好等于默认 → 是;被清掉 / 改了值 / 多了别的列的条件 / 多了孤儿键 → 偏离', () => {
    expect(filtersAtDefaults(withDefault, { a: v('and', ['equal', 'x']) })).toBe(true)
    expect(filtersAtDefaults(withDefault, {})).toBe(false)
    expect(filtersAtDefaults(withDefault, { a: v('and', ['equal', 'y']) })).toBe(false)
    expect(filtersAtDefaults(withDefault, { a: v('and', ['equal', 'x']), b: v('and', ['contains', '1']) })).toBe(false)
    expect(filtersAtDefaults(withDefault, { a: v('and', ['equal', 'x']), ghost: v('and', ['equal', '1']) })).toBe(false)
  })

  it('空条件(无生效)不算条件;单条时 logic 不同也算相同', () => {
    expect(filtersAtDefaults(withDefault, { a: v('and', ['equal', 'x']), b: v('and', ['contains', '']) })).toBe(true)
    expect(filtersAtDefaults(withDefault, { a: { logic: 'or', conditions: [{ action: 'equal', value: 'x' }] } })).toBe(true)
  })
})
```

- [ ] **Step 2: 跑,确认失败**

Run: `npx vitest run tests/SmartTable.test.ts tests/filterChips.test.ts`
Expected: `Test Files  2 failed (2)`、`Tests  7 failed | 89 passed (96)`(实测)—— `SmartTable.test.ts` 3 条(1 个条件时仍有「清除全部」:`expected true to be false`;chip 的 `type` 是 `default` 不是 `primary`;有默认值且没偏离时仍有「恢复默认」),`filterChips.test.ts` 4 条(`filtersAtDefaults` 还不存在:`(0 , filtersAtDefaults) is not a function`)。两处有意改动的断言此刻本来就绿(多设一个条件只会让旧规则更满足)。

- [ ] **Step 3: 实现**

**`src/FilterChips.vue` 查找(整段,原样)(第 1 / 6 处):**

```vue
// 「+N」渲染出来后自己也占位,若它折到了第二行就再让出一个位置(shrinkForMore),直到稳定;
// 容器宽度变了再量一次(只在宽度变化时重量,否则测量时行高变化会触发死循环)。
// 键盘:chip 是 role="button" tabindex="0",Enter / Space 等同点击;「孤儿」chip(列已不存在)没有面板可开,点击是空操作,× 照常清除。
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type PropType } from 'vue'
import { NButton, NPopover, NTag } from 'naive-ui'
import type { SmartTableLabels } from './types'
```

**替换为:**

```vue
// 「+N」渲染出来后自己也占位,若它折到了第二行就再让出一个位置(shrinkForMore),直到稳定;
// 容器宽度变了再量一次(只在宽度变化时重量,否则测量时行高变化会触发死循环)。
// 键盘:chip 是 role="button" tabindex="0",Enter / Space 等同点击;「孤儿」chip(列已不存在)没有面板可开,点击是空操作,× 照常清除。
// 外观(设计原型 .chips / .chip):主色可点的 NTag small(22px 高)、间距 8px 12px、行下方 12px、「清除全部」紧跟在 chips 后面;孤儿 chip 与「+N」保持默认灰。
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type PropType } from 'vue'
import { NButton, NPopover, NTag } from 'naive-ui'
import type { SmartTableLabels } from './types'
```

**`src/FilterChips.vue` 查找(整段,原样)(第 2 / 6 处):**

```vue
  items: { type: Array as PropType<ChipItem[]>, required: true },
  labels: { type: Object as PropType<Required<SmartTableLabels>>, required: true },
  hasDefaults: { type: Boolean, default: false },
})

const emit = defineEmits<{
  open: [key: string]
```

**替换为:**

```vue
  items: { type: Array as PropType<ChipItem[]>, required: true },
  labels: { type: Object as PropType<Required<SmartTableLabels>>, required: true },
  hasDefaults: { type: Boolean, default: false },
  /** 当前过滤态已经等于各列声明的默认值(有默认值的表上,此时不需要「恢复默认」)。 */
  atDefaults: { type: Boolean, default: false },
})

// 行末按钮出现的规则(原型一致):有默认值的表 = 偏离默认才出现「恢复默认」(1 个 chip 也出现);没有默认值的表 = ≥ 2 个 chip 才出现「清除全部」
const showAction = computed(() => (props.hasDefaults ? !props.atDefaults : props.items.length > 1))

const emit = defineEmits<{
  open: [key: string]
```

**`src/FilterChips.vue` 查找(整段,原样)(第 3 / 6 处):**

```vue
        round
        closable
        size="small"
        @click="openChip(c)"
        @keydown="(e: KeyboardEvent) => onChipKeydown(e, c)"
        @close="emit('remove', c.key, c.index)"
```

**替换为:**

```vue
        round
        closable
        size="small"
        :type="c.orphan ? 'default' : 'primary'"
        @click="openChip(c)"
        @keydown="(e: KeyboardEvent) => onChipKeydown(e, c)"
        @close="emit('remove', c.key, c.index)"
```

**`src/FilterChips.vue` 查找(整段,原样)(第 4 / 6 处):**

```vue
            round
            closable
            size="small"
            @click="openChip(c)"
            @keydown="(e: KeyboardEvent) => onChipKeydown(e, c)"
            @close="emit('remove', c.key, c.index)"
```

**替换为:**

```vue
            round
            closable
            size="small"
            :type="c.orphan ? 'default' : 'primary'"
            @click="openChip(c)"
            @keydown="(e: KeyboardEvent) => onChipKeydown(e, c)"
            @close="emit('remove', c.key, c.index)"
```

**`src/FilterChips.vue` 查找(整段,原样)(第 5 / 6 处):**

```vue
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
```

**替换为:**

```vue
        </div>
      </n-popover>
    </div>
    <n-button v-if="showAction" class="smart-table-chips__clear" text size="tiny" @click="emit('clear')">
      {{ hasDefaults ? labels.filterRestoreDefault : labels.filterClearAll }}
    </n-button>
  </div>
</template>

<style scoped>
/* 清除按钮紧跟在 chips 后面(原型是同一个 wrap 行里的下一个元素);list 按内容收缩而不是撑满,放不下时 chips 在 list 里折行(测量用),
   最终显示的是一行 + 「+N」。行与表格之间 12px。 */
.smart-table-chips {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.smart-table-chips__list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  flex: 0 1 auto;
  min-width: 0;
}
.smart-table-chip {
```

**`src/FilterChips.vue` 查找(整段,原样)(第 6 / 6 处):**

```vue
}
.smart-table-chips__clear {
  flex: none;
  align-self: center;
}
</style>
```

**替换为:**

```vue
}
.smart-table-chips__clear {
  flex: none;
  /* 官方文字按钮没有固定高度和内边距(--n-height 是 initial):与 chip 同高 22px、左右内边距 4px(原型 .chips .clear) */
  height: 22px;
  padding: 0 4px;
}
</style>
```

**`src/SmartTable.vue` 查找(整段,原样)(第 1 / 3 处):**

```vue
  type FilterDef,
} from './useColumns'
import { applyFilters } from './filter'
import { buildChips, hasActiveDefaults, removeChipCondition } from './filterChips'
import { mergePageSizes, resolveDefaultPageSize } from './pageSize'
import { mergeCardProps } from './cardStyle'
import { keepCardTopVisible } from './scrollToCard'
```

**替换为:**

```vue
  type FilterDef,
} from './useColumns'
import { applyFilters } from './filter'
import { buildChips, filtersAtDefaults, hasActiveDefaults, removeChipCondition } from './filterChips'
import { mergePageSizes, resolveDefaultPageSize } from './pageSize'
import { mergeCardProps } from './cardStyle'
import { keepCardTopVisible } from './scrollToCard'
```

**`src/SmartTable.vue` 查找(整段,原样)(第 2 / 3 处):**

```vue
  chipsEnabled.value ? buildChips(filterDefs.value as FilterDef[], filters.state.value, mergedLabels.value, optionLabelOf) : [],
)
const chipsHaveDefaults = computed(() => hasActiveDefaults(filterDefs.value as FilterDef[]))

/** 点 chip = 请求重开该列面板:给对应 ColumnFilter 递增 openRequest。被隐藏的列没有漏斗,递增了也是空操作。 */
const openTick = reactive<Record<string, number>>({})
```

**替换为:**

```vue
  chipsEnabled.value ? buildChips(filterDefs.value as FilterDef[], filters.state.value, mergedLabels.value, optionLabelOf) : [],
)
const chipsHaveDefaults = computed(() => hasActiveDefaults(filterDefs.value as FilterDef[]))
const chipsAtDefaults = computed(() => filtersAtDefaults(filterDefs.value as FilterDef[], filters.state.value))

/** 点 chip = 请求重开该列面板:给对应 ColumnFilter 递增 openRequest。被隐藏的列没有漏斗,递增了也是空操作。 */
const openTick = reactive<Record<string, number>>({})
```

**`src/SmartTable.vue` 查找(整段,原样)(第 3 / 3 处):**

```vue
        :items="chipItems"
        :labels="mergedLabels"
        :has-defaults="chipsHaveDefaults"
        @open="onChipOpen"
        @remove="onChipRemove"
        @clear="filters.clearFilters"
```

**替换为:**

```vue
        :items="chipItems"
        :labels="mergedLabels"
        :has-defaults="chipsHaveDefaults"
        :at-defaults="chipsAtDefaults"
        @open="onChipOpen"
        @remove="onChipRemove"
        @clear="filters.clearFilters"
```

**`src/filterChips.ts` 追加到文件末尾:**

```ts

/** 一列的过滤值归一成可比较的形状:无生效条件 → null;只有 1 条时 logic 恒为 and(它在单条时没有意义)。 */
function canon(value: FilterValue | null | undefined): string {
  const conds = activeConditions(value)
  if (!conds.length) return ''
  return JSON.stringify({ logic: conds.length > 1 ? value!.logic : 'and', conditions: conds.map((c) => [c.action, c.value ?? null]) })
}

/**
 * 当前过滤态是不是就等于各列声明的默认值(只比生效的条件):没有默认值的列要求没有生效条件,孤儿键有生效条件就算偏离。
 * chips 行末按钮据此决定要不要出现(原型一致):有默认值的表,**偏离**默认才出现「恢复默认」;
 * 没有默认值的表则看 chip 个数(≥ 2 才出现「清除全部」)。
 */
export function filtersAtDefaults(defs: FilterDef[], state: FilterState): boolean {
  const keys = new Set([...Object.keys(state), ...defs.map((d) => d.key)])
  const defaultOf = new Map(defs.map((d) => [d.key, d.defaultValue]))
  for (const k of keys) {
    if (canon(state[k]) !== canon(defaultOf.get(k))) return false
  }
  return true
}
```

- [ ] **Step 4: 跑,确认通过**

Run: `npm test && npm run typecheck`
Expected: `Test Files  22 passed (22)`、`Tests  393 passed (393)`(385 + 8:`filterChips.test.ts` +4、`SmartTable.test.ts` +4);typecheck 无输出;无 `[Vue warn]`。

- [ ] **Step 5: 浏览器验证(对照页 vs 原型)**

Run: `node_modules/.bin/vite --port 5173`,打开 `/prototype.html?m=4`(模块 4 没有默认值;1440 × 900,浅色),给「物料编码」加一个条件 `M10`、再加第二个条件 `M20`(每次确认),控制台粘贴:
```js
(() => {
  const c = document.querySelector('.smart-table-chips')
  const R = (e) => { const b = e.getBoundingClientRect(); return [b.left, b.top, b.width, b.height].map((v) => Math.round(v * 10) / 10).join(',') }
  const chips = [...c.querySelectorAll('.smart-table-chip')]
  const clr = c.querySelector('.smart-table-chips__clear')
  const cs = getComputedStyle(chips[0])
  return {
    box: R(c),
    chip: [cs.color, cs.backgroundColor, cs.height, cs.fontSize].join(' | '),
    chips: chips.map((x) => x.innerText.trim() + ' ' + R(x)),
    clear: clr ? clr.innerText.trim() + ' ' + R(clr) + ' ' + getComputedStyle(clr).color + ' | ' + getComputedStyle(clr).fontSize : null,
    gap: getComputedStyle(c.querySelector('.smart-table-chips__list')).gap,
    marginBottom: getComputedStyle(c).marginBottom,
  }
})()
```
Expected(库侧;括号里是原型 `.chips` 读数):
- 只有 1 个 chip 时:`clear` = `null`(没有「清除全部」);`box` 高 `22`(原型 22);
- 2 个 chip 时:`box` = `303,165,1066,22`(原型相同)、`chip` = `rgb(24, 160, 88) | rgba(24, 160, 88, 0.1) | 22px | 12px`(原型 `rgb(24,160,88)`、底 primary 10%、22px、12px;暗色 `rgb(99, 226, 183)`、底透明,相同)、`clear` = `清除全部 620.3,165,56,22 rgb(51, 54, 57) | 12px`(原型第 4 批已把关闭钮改成官方 `n-base-close` 12px,读数与原型逐像素相同:chip 宽 `133.7`、清除按钮 `620.3,165,56,22`)、`gap` = `8px 12px`、`marginBottom` = `12px`;「清除全部」**紧跟在最后一个 chip 之后 12px**,不再靠最右。
再打开 `/prototype.html?m=3`(单据状态默认「未审核」):初始有一个 chip「单据状态 等于 未审核」且**没有**行末按钮(没偏离默认);给「物料编码」加条件 → 出现「恢复默认」(2 个 chip,有默认值的表叫「恢复默认」不叫「清除全部」);点它 → 回到只有「未审核」一个 chip、按钮消失;把「未审核」的 chip 点 × 删掉 → chips 行消失(0 个 chip)。原型模块 3 同样的行为(原型第 1 批 `hfClearShown`)。

- [ ] **Step 6: 提交**

```bash
git add src/FilterChips.vue src/filterChips.ts src/SmartTable.vue tests/filterChips.test.ts tests/SmartTable.test.ts
git commit -m "style: chips 对齐原型(主色可点、22px 行高、间距 8 / 12、清除按钮紧跟);行末按钮:有默认值偏离才「恢复默认」,否则 ≥ 2 个才「清除全部」(L0-6)" -m "新增纯函数 filtersAtDefaults;有意改动 tests/SmartTable.test.ts 里 2 条只设了 1 个条件就期望「清除全部」的用例(≥ 2 才出现)。" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 13g: 列设置「至少保留一列」(N11);`SmartTableProps` 补 `rowDraggable` / `dragHandle`

> - **N11**:原型第 1 批的做法 = **只剩一个已勾选的列时,那一列的勾选框禁用**(没有 toast、没有提示文字,禁用态本身就是说明;`design.md` 10.8 N11)。库此前 `toggleShow` 允许把列全部取消,表头只剩勾选 / 操作列。落地:纯函数 `canHideColumn(items, key)`(只看设置里能管的列;`hideInSetting` 的列用户碰不到,不算;已经隐藏的 / 不存在的键不受限)——`ColumnSettings.vue` 用它禁用唯一那一列的勾选框,`useColumns.toggleShow` 同样兜底拒绝(**返回值改为 `boolean`:是否生效**——编程式 / 绕过界面的调用也隐藏不掉;显示永远允许)。**2.1.1 允许全部取消,外观 / 行为变了 → CHANGELOG B 级,回退「无」**(取消全部列没有意义,表头只剩勾选 / 操作列)。
> - **有意改动的既有夹具(1 处)**:`tests/SmartTable.test.ts` 的「密度的写入端(Q-1)」一组用单列夹具(`columns: [{ key: 'name' }]`)并 `$emit('toggle', 'name', false)` 触发保存;N11 之后单列夹具里取消 `name` 会被拒绝、根本不写存储,其中两条「不写 density / 保留旧 density」的断言会**空转**(甚至不再失败)。夹具改成 2 列(加 `code`),取消 `name` 才是真的保存了列设置——断言本身不变。
> - **类型补全**:`SmartTable.vue:84-85` 一直有 `rowDraggable`(Boolean,默认 false)与 `dragHandle`(String)两个 prop,导出的 `SmartTableProps`(`types.ts`)里没有声明,宿主按类型写 props 对象时这两个键会被当成多余属性报错。补上两个可选属性;`tests/types.test.ts` 在**编译期**锁住(`vue-tsc` 检查本文件;运行期的断言只是占位)。

**Files:**
- Modify: `src/useColumns.ts`(`canHideColumn`、`toggleShow`)、`src/ColumnSettings.vue`、`src/types.ts`(`SmartTableProps`)
- Test: `tests/ColumnSettings.test.ts`(新建)、`tests/types.test.ts`(新建)、`tests/useColumns.test.ts`(追加)、`tests/SmartTable.test.ts`(追加 + **夹具有意改动 1 处**)

**Interfaces:**
- Consumes: Task 5 / 12 的 `useColumns`(`toggleShow`、`settingItems`)、`ColumnSettings.vue`。
- Produces: `useColumns.ts` 的 `canHideColumn(items, key): boolean`;`UseColumnsApi.toggleShow(key, show): boolean`;`SmartTableProps.rowDraggable?: boolean` / `dragHandle?: string`。**不新增 label**。

- [ ] **Step 1: 写失败测试**

**新建 `tests/ColumnSettings.test.ts`:**

```ts
// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { NCheckbox } from 'naive-ui'
import ColumnSettings from '../src/ColumnSettings.vue'
import { defaultLabels } from '../src/labels'
import type { SettingItem } from '../src/useColumns'

// N11:列设置「至少保留一列」。原型:只剩一列可见时,那一列的勾选框禁用(无提示)。

const items = (...shows: boolean[]): SettingItem[] => shows.map((show, i) => ({ key: `c${i}`, title: `列${i}`, show }))

async function openPanel(list: SettingItem[]) {
  const w = mount(ColumnSettings, { props: { items: list, labels: defaultLabels }, attachTo: document.body })
  await w.find('button[aria-label="Columns"]').trigger('click')
  await flushPromises()
  return w
}
const disabledFlags = (w: ReturnType<typeof mount>) => w.findAllComponents(NCheckbox).map((c) => c.props('disabled'))

describe('ColumnSettings 至少保留一列(N11)', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('只剩 1 个已勾选的列:那一列的勾选框禁用,其余(未勾选的)仍可勾', async () => {
    const w = await openPanel(items(true, false, false))
    expect(disabledFlags(w)).toEqual([true, false, false])
    expect(document.body.querySelectorAll('.n-checkbox--disabled')).toHaveLength(1)
    w.unmount()
  })

  it('还有 ≥ 2 个已勾选:都不禁用,取消照常发 toggle', async () => {
    const w = await openPanel(items(true, true, false))
    expect(disabledFlags(w)).toEqual([false, false, false])
    w.findAllComponents(NCheckbox)[0].vm.$emit('update:checked', false)
    await flushPromises()
    expect(w.emitted('toggle')).toEqual([['c0', false]])
    w.unmount()
  })

  it('勾回一个被隐藏的列后,原来唯一的那一列立刻解除禁用', async () => {
    const w = await openPanel(items(true, false))
    expect(disabledFlags(w)).toEqual([true, false])
    await w.setProps({ items: items(true, true) })
    expect(disabledFlags(w)).toEqual([false, false])
    w.unmount()
  })

  it('没有提示文字(原型不弹 toast,禁用态本身就是说明)', async () => {
    const w = await openPanel(items(true, false))
    expect(document.body.querySelector('[role="status"]')).toBeNull()
    w.unmount()
  })
})
```

**新建 `tests/types.test.ts`:**

```ts
import { describe, expect, expectTypeOf, it } from 'vitest'
import type { SmartTableProps } from '../src'

// SmartTable.vue 一直有 rowDraggable / dragHandle 两个 prop(README 也写了),但导出的 SmartTableProps 类型里没有声明 ——
// 宿主按类型写 props 对象时这两个键会被当成多余属性报错。这里在编译期锁住它们存在且类型正确(vue-tsc 会检查本文件)。
describe('SmartTableProps 类型补全', () => {
  it('rowDraggable / dragHandle 是可选属性', () => {
    const props: SmartTableProps = { columns: [], rowDraggable: true, dragHandle: '.my-handle' }
    expect(props.rowDraggable).toBe(true)
    expectTypeOf<SmartTableProps['rowDraggable']>().toEqualTypeOf<boolean | undefined>()
    expectTypeOf<SmartTableProps['dragHandle']>().toEqualTypeOf<string | undefined>()
  })

  it('不传也合法(向后兼容)', () => {
    const props: SmartTableProps = { columns: [] }
    expect(props.rowDraggable).toBeUndefined()
  })
})
```

**`tests/SmartTable.test.ts` 查找(整段,原样):**

```ts
})

describe('SmartTable 密度的写入端(Q-1:保存列设置 / 列宽不把宿主的密度写进存储)', () => {
  const base = { columns: [{ key: 'name', title: 'Name' }] as SmartTableColumn<unknown>[], data: rows, rowKey: 'id' }
  const raw = (key: string) => JSON.parse(localStorage.getItem('protable:' + key) ?? 'null') as { density?: string } | null

  afterEach(() => {
```

**替换为:**

```ts
})

describe('SmartTable 密度的写入端(Q-1:保存列设置 / 列宽不把宿主的密度写进存储)', () => {
  // 有意改动(N11):夹具从 1 列改成 2 列 —— 列设置「至少保留一列」后,单列夹具里取消 name 会被拒绝、根本不写存储,
  // 下面「不写 density / 保留旧 density」的断言就成了空转;留一个 code 列,取消 name 才是真的保存了列设置。
  const base = {
    columns: [
      { key: 'name', title: 'Name' },
      { key: 'code', title: 'Code' },
    ] as SmartTableColumn<unknown>[],
    data: rows,
    rowKey: 'id',
  }
  const raw = (key: string) => JSON.parse(localStorage.getItem('protable:' + key) ?? 'null') as { density?: string } | null

  afterEach(() => {
```

**`tests/SmartTable.test.ts` 追加到文件末尾:**

```ts

describe('SmartTable 列设置至少保留一列(N11)', () => {
  it('在列设置里把列一个个取消:最后一列取消不掉,表头还剩它;之后能勾回来', async () => {
    const wrapper = mount(SmartTable, {
      props: {
        columns: [
          { key: 'a', title: 'AA' },
          { key: 'b', title: 'BB' },
        ] as SmartTableColumn<unknown>[],
        data: [{ id: 1, a: 1, b: 2 }],
        rowKey: 'id',
      },
    })
    const settings = wrapper.findComponent(ColumnSettings)
    const heads = () => wrapper.findAll('thead th').map((th) => th.text())
    expect(heads()).toEqual(['AA', 'BB'])
    settings.vm.$emit('toggle', 'a', false)
    await nextTick()
    expect(heads()).toEqual(['BB'])
    settings.vm.$emit('toggle', 'b', false) // 最后一列:勾选框已禁用,编程式 / 绕过界面的调用也被 toggleShow 兜底拒绝
    await nextTick()
    expect(heads()).toEqual(['BB'])
    settings.vm.$emit('toggle', 'a', true)
    await nextTick()
    expect(heads()).toEqual(['AA', 'BB'])
    wrapper.unmount()
  })
})
```

**`tests/useColumns.test.ts` 查找(整段,原样):**

```ts
import { describe, expect, it, vi } from 'vitest'
import { h, ref, type Slots, type VNode } from 'vue'
import {
  deriveFilterDefs,
  headerIconFloor,
  useColumns,
```

**替换为:**

```ts
import { describe, expect, it, vi } from 'vitest'
import { h, ref, type Slots, type VNode } from 'vue'
import {
  canHideColumn,
  deriveFilterDefs,
  headerIconFloor,
  useColumns,
```

**`tests/useColumns.test.ts` 追加到文件末尾:**

```ts

describe('列设置至少保留一列(N11)', () => {
  const three = (): SmartTableColumn<Row>[] => [
    { key: 'a', title: 'A' },
    { key: 'b', title: 'B' },
    { key: 'c', title: 'C' },
  ]

  it('canHideColumn:除它以外还有已显示的列才允许隐藏;隐藏中的 / 不存在的键不受限', () => {
    expect(canHideColumn([{ key: 'a', show: true }, { key: 'b', show: false }], 'a')).toBe(false)
    expect(canHideColumn([{ key: 'a', show: true }, { key: 'b', show: true }], 'a')).toBe(true)
    expect(canHideColumn([{ key: 'a', show: true }, { key: 'b', show: false }], 'b')).toBe(true)
    expect(canHideColumn([{ key: 'a', show: true }], 'zzz')).toBe(true)
  })

  it('toggleShow 隐藏到只剩一列后,再隐藏最后一列被拒绝(返回 false,状态不变);其余情况返回 true', () => {
    const api = build(three())
    expect(api.toggleShow('a', false)).toBe(true)
    expect(api.toggleShow('b', false)).toBe(true)
    expect(api.toggleShow('c', false)).toBe(false)
    expect(api.settingItems.value.map((i) => [i.key, i.show])).toEqual([
      ['a', false],
      ['b', false],
      ['c', true],
    ])
    expect(api.toggleShow('c', true)).toBe(true) // 显示永远允许
  })

  it('hideInSetting 的列(设置里看不到,也不能被用户隐藏)不算「保留的那一列」', () => {
    const api = build([
      { key: 'a', title: 'A' },
      { key: 'act', title: '操作', hideInSetting: true },
    ])
    expect(api.toggleShow('a', false)).toBe(false) // 设置里只有 a 一列,操作列不算
  })

  it('已经全部隐藏的列声明(宿主 hide: true)不被拦:能勾回来', () => {
    const api = build([
      { key: 'a', title: 'A', hide: true },
      { key: 'b', title: 'B', hide: true },
    ])
    expect(api.toggleShow('a', true)).toBe(true)
    expect(api.toggleShow('a', false)).toBe(false) // 又只剩它自己了
  })
})
```

- [ ] **Step 2: 跑,确认失败**

Run: `npx vitest run tests/ColumnSettings.test.ts tests/SmartTable.test.ts tests/types.test.ts tests/useColumns.test.ts && npm run typecheck`
Expected: `Test Files  3 failed | 1 passed (4)`、`Tests  8 failed | 119 passed (127)`(实测),分布在 `ColumnSettings.test.ts` / `useColumns.test.ts`(`canHideColumn` 不是函数、`toggleShow` 返回 `undefined`)/ `SmartTable.test.ts`(最后一列没被拦住:`expected [] to deeply equal [ 'BB' ]`)三个文件;`types.test.ts` 的运行期断言此刻本来就绿——它红在下面的 `npm run typecheck`;`npm run typecheck` 报错(`tests/types.test.ts`:`'rowDraggable' does not exist in type 'SmartTableProps<any>'`;`tests/useColumns.test.ts`:`Module '"../src/useColumns"' has no exported member 'canHideColumn'`)。

- [ ] **Step 3: 实现**

**`src/ColumnSettings.vue` 查找(整段,原样)(第 1 / 3 处):**

```vue
<script setup lang="ts">
// 列设置面板:显隐勾选 + 原生 HTML5 拖拽排序 + 固定切换 + 恢复默认。零拖拽库依赖。
import { ref, type PropType, type VNodeChild } from 'vue'
import { NButton, NCheckbox, NPopover, NTooltip, useThemeVars } from 'naive-ui'
import type { SmartTableLabels } from './types'
import type { SettingItem } from './useColumns'
import { ColumnsIcon, DragIcon } from './icons'

defineProps({
  items: { type: Array as PropType<SettingItem[]>, required: true },
  labels: { type: Object as PropType<Required<SmartTableLabels>>, required: true },
})
```

**替换为:**

```vue
<script setup lang="ts">
// 列设置面板:显隐勾选 + 原生 HTML5 拖拽排序 + 固定切换 + 恢复默认。零拖拽库依赖。
// 至少保留一列(N11,原型一致):只剩一个已勾选的列时,那一列的勾选框禁用(没有提示文字,禁用态本身就是说明)。
import { ref, type PropType, type VNodeChild } from 'vue'
import { NButton, NCheckbox, NPopover, NTooltip, useThemeVars } from 'naive-ui'
import type { SmartTableLabels } from './types'
import { canHideColumn, type SettingItem } from './useColumns'
import { ColumnsIcon, DragIcon } from './icons'

const props = defineProps({
  items: { type: Array as PropType<SettingItem[]>, required: true },
  labels: { type: Object as PropType<Required<SmartTableLabels>>, required: true },
})
```

**`src/ColumnSettings.vue` 查找(整段,原样)(第 2 / 3 处):**

```vue
  dragFrom.value = null
  dragOver.value = null
}

function renderTitle(title: SettingItem['title']): VNodeChild {
  return typeof title === 'function' ? title() : title
```

**替换为:**

```vue
  dragFrom.value = null
  dragOver.value = null
}

// 只剩一个已勾选的列时,隐藏它会让表格没有数据列 → 禁用它的勾选框(useColumns.toggleShow 同样兜底拒绝,编程式调用也隐藏不掉)
const isLastShown = (item: SettingItem) => item.show && !canHideColumn(props.items, item.key)

function renderTitle(title: SettingItem['title']): VNodeChild {
  return typeof title === 'function' ? title() : title
```

**`src/ColumnSettings.vue` 查找(整段,原样)(第 3 / 3 处):**

```vue
        @dragend="((dragFrom = null), (dragOver = null))"
      >
        <span class="smart-table-colset-drag" :style="{ color: themeVars.textColor3 }"><DragIcon /></span>
        <n-checkbox :checked="item.show" @update:checked="(v: boolean) => emit('toggle', item.key, v)">
          <component :is="() => renderTitle(item.title)" />
        </n-checkbox>
        <span class="smart-table-colset-pins">
```

**替换为:**

```vue
        @dragend="((dragFrom = null), (dragOver = null))"
      >
        <span class="smart-table-colset-drag" :style="{ color: themeVars.textColor3 }"><DragIcon /></span>
        <n-checkbox :checked="item.show" :disabled="isLastShown(item)" @update:checked="(v: boolean) => emit('toggle', item.key, v)">
          <component :is="() => renderTitle(item.title)" />
        </n-checkbox>
        <span class="smart-table-colset-pins">
```

**`src/types.ts` 查找(整段,原样):**

```ts
  activeRowKey?: string | number | null
  /** 所有数据列可拖拽调整列宽;列上写 resizable 可单独覆盖。配合 storageKey 记住宽度。 */
  resizable?: boolean
  /** 过滤态 → 请求参数的序列化;缺省产出 `{ filters: [{ field, logic, conditions }] }`。 */
  filterSerializer?: (state: FilterState) => Record<string, any>
}
```

**替换为:**

```ts
  activeRowKey?: string | number | null
  /** 所有数据列可拖拽调整列宽;列上写 resizable 可单独覆盖。配合 storageKey 记住宽度。 */
  resizable?: boolean
  /** 行拖拽排序(sortablejs 懒加载,仅开启时才加载);松手后发 @row-drag-sort。默认 false。 */
  rowDraggable?: boolean
  /** 行拖拽的把手选择器(只有按住它才能拖);缺省整行可拖。 */
  dragHandle?: string
  /** 过滤态 → 请求参数的序列化;缺省产出 `{ filters: [{ field, logic, conditions }] }`。 */
  filterSerializer?: (state: FilterState) => Record<string, any>
}
```

**`src/useColumns.ts` 查找(整段,原样)(第 1 / 3 处):**

```ts
export function headerIconFloor(hasFilter: boolean, hasSorter: boolean): number {
  if (!hasFilter && !hasSorter) return 0
  return 12 + 44 + (hasFilter ? 30 : 0) + (hasSorter ? 21 : 0) + 16
}

export function isSpecialColumn<T>(c: SmartTableColumn<T>): c is SmartTableSpecialColumn<T> {
```

**替换为:**

```ts
export function headerIconFloor(hasFilter: boolean, hasSorter: boolean): number {
  if (!hasFilter && !hasSorter) return 0
  return 12 + 44 + (hasFilter ? 30 : 0) + (hasSorter ? 21 : 0) + 16
}

/**
 * 列设置「至少保留一列」(N11,原型一致):隐藏 key 这一列之后,设置里还得剩一列是显示的。
 * 只看设置里能管的列(hideInSetting 的列用户碰不到,不算);已经隐藏的 / 不存在的键不受限。
 */
export function canHideColumn(items: ReadonlyArray<{ key: string; show: boolean }>, key: string): boolean {
  const target = items.find((i) => i.key === key)
  if (!target || !target.show) return true
  return items.some((i) => i.key !== key && i.show)
}

export function isSpecialColumn<T>(c: SmartTableColumn<T>): c is SmartTableSpecialColumn<T> {
```

**`src/useColumns.ts` 查找(整段,原样)(第 2 / 3 处):**

```ts
  density: ComputedRef<Density>
  setDensity: (d: Density) => void
  settingItems: ComputedRef<SettingItem[]>
  toggleShow: (key: string, show: boolean) => void
  moveCheck: (from: number, to: number) => void
  setFixed: (key: string, fixed?: 'left' | 'right') => void
  resetSettings: () => void
```

**替换为:**

```ts
  density: ComputedRef<Density>
  setDensity: (d: Density) => void
  settingItems: ComputedRef<SettingItem[]>
  /** 返回是否生效:隐藏最后一个显示的列会被拒绝(返回 false,状态不变);显示永远允许。 */
  toggleShow: (key: string, show: boolean) => boolean
  moveCheck: (from: number, to: number) => void
  setFixed: (key: string, fixed?: 'left' | 'right') => void
  resetSettings: () => void
```

**`src/useColumns.ts` 查找(整段,原样)(第 3 / 3 处):**

```ts
    }, 300)
  }

  function toggleShow(key: string, show: boolean) {
    persist(effectiveChecks.value.map((c) => (c.key === key ? { ...c, show } : c)))
  }

  function moveCheck(from: number, to: number) {
```

**替换为:**

```ts
    }, 300)
  }

  function toggleShow(key: string, show: boolean): boolean {
    if (!show && !canHideColumn(effectiveChecks.value, key)) return false
    persist(effectiveChecks.value.map((c) => (c.key === key ? { ...c, show } : c)))
    return true
  }

  function moveCheck(from: number, to: number) {
```

- [ ] **Step 4: 跑,确认通过**

Run: `npm test && npm run typecheck`
Expected: `Test Files  24 passed (24)`、`Tests  404 passed (404)`(393 + 11:`ColumnSettings.test.ts` 4、`types.test.ts` 2、`useColumns.test.ts` +4、`SmartTable.test.ts` +1);typecheck 无输出;无 `[Vue warn]`。

- [ ] **Step 5: 浏览器验证(对照页 vs 原型)**

Run: `node_modules/.bin/vite --port 5173`,打开 `/prototype.html?m=3`(1440 × 900),点工具栏最右的「列设置」,控制台粘贴:
```js
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const boxes = () => [...document.querySelectorAll('.smart-table-colset .n-checkbox')]
  const out = { items: boxes().length }
  for (let i = 0; i < out.items; i++) {
    const on = boxes().find((b) => b.classList.contains('n-checkbox--checked') && !b.classList.contains('n-checkbox--disabled'))
    if (!on) break
    on.click()
    await sleep(150)
  }
  out.checkedLeft = boxes().filter((b) => b.classList.contains('n-checkbox--checked')).length
  out.lastDisabled = boxes().filter((b) => b.classList.contains('n-checkbox--checked'))[0].classList.contains('n-checkbox--disabled')
  out.thTexts = [...document.querySelectorAll('thead th')].map((t) => t.innerText.trim())
  out.hint = !!document.querySelector('.smart-table-colset [role="status"]')
  return out
})()
```
Expected(库侧;原型第 1 批同样操作的结果):`items` = `7`(物料编码 … 单据日期,「操作」`hideInSetting` 不在列表里);逐个取消后 `checkedLeft` = `1`、`lastDisabled` = `true`(只剩的那一列「单据日期」勾选框禁用,点它没有任何反应)、`thTexts` = `["", "单据日期", "操作"]`(勾选列 + 剩下的数据列 + 操作列;原型多一个序号列);**没有任何提示文字 / toast**(`[role="status"]` 不存在);再勾回任意一列 → 「单据日期」的勾选框立刻恢复可点。
(编程式兜底在单测里覆盖:`toggleShow('c', false)` 隐藏最后一个显示的列返回 `false`、状态不变。)

- [ ] **Step 6: 提交**

```bash
git add src/useColumns.ts src/ColumnSettings.vue src/types.ts tests/ColumnSettings.test.ts tests/types.test.ts tests/useColumns.test.ts tests/SmartTable.test.ts
git commit -m "feat: 列设置至少保留一列(只剩一列时勾选框禁用,toggleShow 兜底拒绝);SmartTableProps 补 rowDraggable / dragHandle(N11)" -m "有意改动 tests/SmartTable.test.ts「密度写入端」夹具:单列 → 2 列(单列夹具里取消 name 会被拒绝,断言会空转)。2.1.1 允许全部取消列,CHANGELOG 记 B 级。" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 14: 收尾 —— 版本号、CHANGELOG、README、规格核对、最终验证(`3.0.0-beta.1`)

> 只做「发布前的最后一公里」。**不 `npm publish`。**
> 规格 `docs/smart-naive-table-spec.md` 已在设计定稿时改成「目标状态」,本计划实施中凡与规格不一致的地方,**以实现为准回写规格**(规格是实现的依据,必须与代码一致)。
> CHANGELOG 里 B1 / B4 / B8 / B12 与 `fillHeight` 的口径已按 Task 7 / Task 12 / Task 12b 的定稿写(官方嵌套每页选择器、吸收列 `dk` 方案、`fillHeight`);改 Task 7 / 12 / 12b 时这里要同步。**Task 13b–13g(对齐设计原型)改了 2.1.1 已有的外观,CHANGELOG 里加了一节「外观调整」(旧 → 新 + 回退方式),B7 一行与「新增」一节也相应补了几句;改 Task 13c–13g 时这里要同步。**

**Files:**
- Modify: `package.json`(+ `package-lock.json`)、`CHANGELOG.md`、`README.md`、`README.en.md`、`docs/smart-naive-table-spec.md`

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
>
> **⚠ C2(缺陷修复,但行为会突变)**:此前给列写了 `defaultSortOrder` 却因被受控 `sortOrder` 盖掉而从未生效;升级后**首次请求会带上排序参数、静态 `data` 模式下本地数据也会按它排序、箭头会回显**。如果你有这样的列,请确认这是你想要的。
>
> 本次变更**只在 naive-ui 2.45.3 上验证过**(`peerDependencies` 仍是 `^2.34.0`),其它 2.x 版本未测。

### 默认行为变更(B 级)

| 变更 | 旧 → 新 | 回退方式 |
|---|---|---|
| **每页条数**(B1) | 默认 10 → **100**;可选项 `[10,20,50]` → `[100,500,1000]`。⚠ **远程模式请求里的 `pageSize` 变成 100,后端若限制了 `pageSize` 上限(如 ≤ 50)会直接拒绝请求,升级前请确认**。解析优先级:实例 `defaultPageSize` > 实例 `pagination.pageSize` / `pagination.defaultPageSize` > 全局 `defaultPageSize`(新增)> 宿主(实例或全局)显式给了 `pageSizes` 时取它的第一项 > 100。**不开 `fillHeight` 时 100 行是整页长滚动**:要卡片内滚动请传 `fillHeight`(父容器须定高)。**另一处默认行为变化:不开 `fillHeight` 时,点翻页 / 改每页条数后,若卡片顶部已滚出视口上沿,页面会自动滚回卡片顶部**(只在卡片顶部已滚出视口时触发,卡片可见时不动;无开关,开 `fillHeight` 则改为表体自己回顶) | `defaultPageSize` / `pagination.pageSizes` / 全局 `defaultPageSize` / 全局 `pageSizes` |
| **默认密度**(B2) | `comfortable` → **`compact`**。**`storageKey` 里存过的旧密度不再覆盖宿主给的 `defaultDensity`**(没有密度按钮时,这些用户本来就改不回去)。另:**保存列设置 / 列宽时不再把当前密度写进存储**(存储里原有的密度原样保留,没有记录也不写该字段),所以宿主回滚到 2.1.1 时用户不会被固定在 compact。**公开导出的 `loadState(storageKey, fallbackDensity?)` 新增可选第二参数:不传时,存储里有记录但缺 `density` 字段的返回值由 `'comfortable'` 变成 `'compact'`(此前写死 `'comfortable'`);要旧行为请传 `'comfortable'`**。**开了 `toolbar.density: true` 时,存储里已有的旧值继续生效**(包括 2.1.1 默认写进去的 `comfortable`) | `defaultDensity="comfortable"`;直接调 `loadState` 的宿主传 `'comfortable'` |
| **工具栏去掉密度按钮**(B3) | 默认显示 → 不显示。`toolbar.density` 属性保留、默认改为 `false`;`defaultDensity` 现在是**响应式**的(宿主的个人设置变了,已挂载的表格跟着变) | `toolbar: { density: true }`(此时存储里的密度优先,与旧行为一致;**存储里已有的旧值会继续生效**,包括 2.1.1 默认写进去的 `comfortable`) |
| **分页外观**(B4) | 页码序列 → 官方 `simple`(输入框 / 总页数);每页条数选择器是**嵌在 `suffix` 里的官方 `NPagination`(`displayOrder: ['size-picker']`)**,选项文案自动跟 `NConfigProvider` 的 locale(中文「100 / 页」,不需要新 label);`pagination.pageSizes` 里的 `{ label, value }` 原样保留;当前每页条数不在 `pageSizes` 里时自动并入选项。**窄档(库根节点宽 < 600px)不画每页选择器**。**`simple` 下官方不渲染 `showQuickJumper` / `pageSlot`,传了也不再生效** | `pagination: { simple: false }`(回到页码序列,走官方 `showSizePicker` / `pageSizes`) |
| **静态数据模式不显示刷新**(B5) | 显示(点了无效)→ 隐藏。实例方法 `refresh()` 保留 | 无(本来就无效) |
| **表头图标悬停才显示**(B6) | 排序箭头 / 漏斗常驻 → 悬停该列表头或键盘聚焦时淡入;正在排序 / 已筛选 / 面板打开的列常驻;触屏(主输入设备无悬停,`@media (hover: none)`,与原型一致)淡显常驻。漏斗现在可被 Tab 聚焦。图标间距:标题 → 漏斗 8px、漏斗 → 排序箭头 6px、表头右内边距 16px。点漏斗不再靠 `stopPropagation` 防排序(改用官方 `data-data-table-filter`),宿主挂在表头 / 祖先上的 click 监听现在能收到漏斗上的点击 | 暂无开关 |
| **列头过滤面板**(B7) | 单条件 / 勾选 → **多条件编辑**(≤ 5 条,≥ 2 条出现且 / 或);options 列底部有「高级条件」。**默认可选操作符不变**(仍是 2.1.1 的 8 个:文本 包含 / 不包含 / 等于 / 不等于;数字、日期 等于 / 不等于 / 大于 / 大于等于 / 小于 / 小于等于;字典 等于 / 不等于),新操作符需在列上 `filter.actions` 显式开启。面板支持键盘(打开时焦点进入面板、Esc 关闭并还焦点、下拉展开时 Esc 只收下拉、Tab 在面板内循环)与 ARIA(`role="dialog"`)。**自定义面板 `filter.render` 也有变化:面板打开期间按 Esc 会关闭它(不管焦点在面板里还是仍在漏斗按钮上),且打开时不会自动聚焦**。面板排布对齐设计原型:首列第 1 行是「条件」引导标签、第 2 行起是且 / 或下拉(取代行下方的分段按钮)、4 列网格、「添加条件」是带加号的深色文字按钮、底部「重置 / 确认」居中分布;在窄容器里面板会水平夹进视口,不再被裁出屏幕 | 无 |
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
| **过滤列标题** | 列被拖窄时标题折成两行(表头被撑高、图标被挤歪)→ **标题单行、放不下省略**(漏斗和箭头始终完整)。DOM:标题文字多包了一层 `span.smart-table-th-text`;只有排序箭头(没有过滤)的表头不变 | 宿主 CSS `.smart-table .smart-table-th-text { white-space: normal; overflow: visible }` |
| **单选过滤列**(`filter: { multiple: false }`) | 用复选框模拟单选 → **官方 `NRadio`**(与官方 `NDataTable` 的单选过滤一致) | 无 |
| **列设置** | 允许把列全部取消(表头只剩勾选 / 操作列)→ **只剩一列可见时那一列的勾选框禁用**;`useColumns().toggleShow` 同样拒绝隐藏最后一个显示的列(返回 `false`) | 无(没有数据列的表格没有意义) |
| **搜索区「展开 / 收起」**(缺陷修复) | 文字按钮比同排「搜索 / 重置」上移 6px、矮 20px → **同高、垂直居中** | 无(缺陷) |

### 缺陷修复(C 级)

- C1:列上写 `sorter: { multiple }` 的多列排序不再被截成单列(箭头回显与远程参数都变正确)。
- **C2:`defaultSortOrder` 现在会生效**(见顶部提示)。它**只在首次 setup 时从列声明里读一次**:列若是异步加载进来的,`defaultSortOrder` 不会生效,请在列到位后用实例方法 `sort()`。
- C3:options 列的过滤值里带 `notEqual` / `isNull` / 「多条 equal 且」时,打开勾选面板不再静默丢条件、确认不再覆盖原条件(自动展开「高级条件」)。
- C5:开启 `search.collapsible` 时,窄屏(1 列)折叠态至少露出首个搜索字段(此前 0 个)。
- **C6:宿主在 `<SmartTable>` 上写的 `@update:sorter` 每次点表头原来会被调两次(两次载荷相同,宿主若在里面累加 / 发请求会重复),现在只调一次**(库统一经 `notifyHostSorter` 转发,不再让它再从透传属性里混进去一份)。

### 新增

- **多列排序**:列上写官方 `sorter: { multiple: n }`(**数值大者优先,与点击顺序无关**)。远程参数:单列不变;多列仍带最高优先级列的 `sortField` / `sortOrder`,**另加 `sorts: [{ field, order }…]`**(`order` 为 `'asc' | 'desc'`)。实例方法 `sort(columnKey?, order = 'ascend')`、`clearSorter()`(沿用官方 `DataTableInst` 的签名:不传 `columnKey` = `clearSorter()`;会通知宿主的 `onUpdate:sorter`,载荷形状与官方一致)。排序态不持久化。
- **`FilterAction` 由 8 个扩到 15 个**:新增 `isNull` `isNotNull` `like` `startsWith` `endsWith` `in` `notIn`。**列头面板的默认可选操作符不变**,只有宿主在列上显式写 `filter.actions` 时才会出现这些操作符,所以后端只会在宿主显式开启后才收到它们。语义:`isNull`/`isNotNull` 不需要值(空 = `null`/`undefined`/空白串/空数组,`0`/`false` 不算空;**值为空也不会被当成「没填」丢弃**);`startsWith`/`endsWith` 忽略大小写;`like` 是 SQL `LIKE`(`%` 任意长度、`_` 单字符,整串匹配、忽略大小写);`in`/`notIn` 的值是数组;**未知操作符一律按不匹配处理(fail-closed)**。**`in` 经勾选面板回写会变成若干 `equal` 取「或」——语义相同、序列化形状不同。** 新增导出:`NO_VALUE_ACTIONS`、`isValuelessAction`、`actionValueKind`、`isOptionsRepresentable`。
- **`filterChips`**:已生效条件 chips(默认 `false`):点击重开该列面板、× 删一条、超一行折成 `+N`、行末按钮紧跟 chips:有列声明了 `defaultValue` 的表,过滤态**偏离默认**时出现「恢复默认」(语义不变);没有默认值的表,**≥ 2 个 chip** 时出现「清除全部」;过滤态里有、列声明里已没有的键也会显示(点击不开面板,× 可清)。
- **`toolbar.more`**:「更多」菜单(官方 `NDropdown` 的 `options` 原样透传),选中后发 `moreSelect(key, option)` 事件;不传 / 空数组 / 只有分隔线时不显示。库不内置导出 / 导入。
- **`fillHeight`**(默认 `false`):官方 `flex-height` + `virtual-scroll` + `min-row-height` 三件套:表体在卡片内滚动、分页条贴底、每页 100 / 1000 行时 DOM 里只有十几行。**父容器必须有确定高度**(`height: 600px` / `calc(100vh - …)` / 定高的 flex 列),否则表体塌成 0(库带了 `min-height: 160` 兜底);`min-row-height` 随密度取 40(紧凑)/ 48(舒适),宿主改了 `themeOverrides` 导致行高变化时,在 `<SmartTable>` 上写官方的 `min-row-height` 覆盖(宿主 attrs 优先)。**开启时忽略宿主传的 `max-height`(表体高度由父容器决定),并在控制台警告一次。****不开时**:点翻页 / 改每页条数后,若卡片顶部已滚出视口上沿,自动滚回卡片顶部(只在需要时滚)。
- **全局 `defaultPageSize`**:`createSmartTableDefaults({ defaultPageSize })`(纯新增,优先级见 B1)。
- **`cardProps`**:库渲染的卡片(表格卡片、模式 1 的搜索卡片)的官方 NCard 属性,合并在库默认 `size="small"` + 16px 内边距覆盖之后;`themeOverrides` 逐键合并。
- **`zhCNLabels`**:完整的中文 labels(含 2.1.1 已有的键与 3.0 新增的键),纯数据零依赖,中文宿主直接 `:labels="zhCNLabels"`。**3.0 新增的 label 键全部可选**,2.1.1 宿主写的完整 labels 对象不会报类型错误,缺的键取英文默认。
- 新 labels:`more`、`filterActiveCount`、`filterAddCondition`、`filterRemoveCondition`、`filterLogicAnd`、`filterLogicOr`、`filterAdvanced`、`filterSimple`、`filterClearAll`、`filterRestoreDefault`、`filterIsNull`、`filterIsNotNull`、`filterLike`、`filterStartsWith`、`filterEndsWith`、`filterIn`、`filterNotIn`、`filterNoValue`、`filterConditionLead`、`filterCannotCollapse`(后两个是列头面板里的「条件」引导标签与「含勾选无法表达的条件」提示)。
- **`SmartTableProps` 补上 `rowDraggable` / `dragHandle`**(`SmartTable` 一直有这两个 prop,导出的类型里漏了,宿主按类型写 props 对象会报多余属性);`useColumns().toggleShow` 现在返回 `boolean`(是否生效)。
- 新类型导出:`SortItem`、`ToolbarMoreOption`、`ActionValueKind`;`saveState` 的 `density` 形参放宽成 `Density | undefined`(`undefined` = 不写该字段,纯放宽)。

### 类型层面变更

- **`FilterAction` 联合类型由 8 个成员扩到 15 个**:宿主若有穷尽的 `Record<FilterAction, …>`,或带 `never` 兜底的 `switch (action)`,升级后 `vue-tsc` 会报错,需要补上新成员。
- `SmartTableInst` 新增 `sort` / `clearSorter`:宿主若手写了该接口的实现或 mock,需要补上。

### 内部

- 删除内部的 `withFillerColumn` / `FILLER_COLUMN_KEY`(从未从入口导出过)。
```

- [ ] **Step 3: 同步 README / README.en(Q-14)**

npm 会把 README 随 beta 展示,**不能与 CHANGELOG 矛盾**。`README.md` 与 `README.en.md` 同步改这些处(行号以 `README.md` 为准,英文版对应同名小节;默认值以上面 CHANGELOG 的表格为准):
1. **特性列表**(`开箱即用的工具栏`、`表头过滤 + 列宽拖拽` 两条)与「工具栏」一句:刷新(仅远程)、列设置、可选的「更多」菜单;密度切换默认不再显示(`toolbar.density: true` 才有)。
2. **请求参数示例**里的 `pageSize: 10` 改成 `100`(两处,2.1.1 的 `README.md` 第 99 行 `{ page: 1, pageSize: 10, account: 'user01', … }` 与第 216 行的 JSON `"pageSize": 10,`;`README.en.md` 同位置,2.1.1 已逐行核过)。
3. **「更多场景」表**里的「服务端排序」一行:补「多列用官方 `sorter: { multiple }`,`fetcher` 另收到 `sorts`;`defaultSortOrder` 生效」,并加一行「编程式排序:`tableRef.sort(key, order)` / `clearSorter()`」。
4. **「多语言」示例**(`createSmartTableDefaults({ labels: {…} })` 那段):把整块手写的中文 labels 换成 `import { zhCNLabels } from 'smart-naive-table'` + `labels: zhCNLabels`,并把 `pageSizes: [10, 20, 50, 100]` 示例改成 `[100, 500, 1000]`。
5. **`FilterAction` 一行**:列出 15 个,并写明「列头面板的默认可选操作符仍是前 8 个,其余需在列上 `filter.actions` 显式开启」。
6. **Props 表**:`default-page-size` 默认值改 `100`;`toolbar` 改成 `false \| { refresh, density, columnSettings, more }`,默认值说明「刷新(仅远程)、列设置;`density` 默认 `false`」;`default-density` 默认 `'compact'`;新增 `filter-chips`(`boolean`,`false`)、`card-props`(`Partial<CardProps>`,回退旧外观 `{ size: 'medium' }`)。
7. **Events / Methods 表**:事件新增 `more-select`;实例方法新增 `sort(columnKey?, order?)`、`clearSorter()`。
8. **全局默认字段表**:`pageSizes` 改 `[100, 500, 1000]`,`density` 改 `'compact'`。
9. **新增 / 修改的 README 内容(按 Task 7 / 12 / 12b 的定稿)**:(a) Props 表加 `fill-height`(`boolean`,`false`)并在「更多场景」表加一行「铺满父容器:`fill-height`,父容器须定高;不开时翻页自动回卡片顶部」;(b) 分页的说明里写清每页条数选择器是官方 `NPagination` 嵌套、文案跟 locale、窄档(< 600px)不画、解析优先级(`defaultPageSize` > `pagination.*` > 全局 `defaultPageSize` > 宿主 `pageSizes[0]` > 100);(c) 「拖拽列宽」一节按下面第 10 条替换旧说法;(d) **README / README.en 里不要出现 `pageSizeSuffix` 这个 label**(本计划不新增它);(e) 全局默认字段表加 `defaultPageSize`。
10. **README 里现存的旧说法,必须逐条替换成下面的目标文字(F5;行号以 2.1.1 的 README 为准,按原文定位,两个文件都要改)**。

`README.md:264` 与 `README.en.md:264`(「表格始终填满容器」,旧说法:一列占位列吃掉余量)整条替换为:
```markdown
- **表格始终填满容器**:列宽之和小于容器时,富余宽度由**最后一个可见、非固定、可拖的列(吸收列)**吸收(表头里不再有占位列),其余列仍是拖出来的精确宽度;加宽到超过容器则照常横向滚动。**吸收列没有拖拽把手(即使还没拖过列宽也没有)**:要调它的宽度,拖它左邻列的把手;给某列写 `resizable: false` 可让它不参与吸收(吸收列顺延到前一列)。想回到按容器自适应,点列设置里的「恢复默认」
```
```markdown
- **The table always fills its container**: when the columns add up to less than the container, the leftover width is absorbed by the **last visible, non-fixed, draggable column (the "absorber")**; there is no filler column in the header any more and every other column keeps the width you dragged. Widening past the container scrolls horizontally as before. **The absorber has no drag handle (even before you have dragged anything)**: drag its left neighbour's handle instead; put `resizable: false` on a column to make it opt out (the absorber moves to the previous column). "Restore defaults" in column settings brings back the auto-fit behavior
```
`README.md:265` 与 `README.en.md:265`(旧说法:`minWidth` 默认 60)整条替换为:
```markdown
- 拖不到 0 宽:可拖拽列自动补 `minWidth`:默认 60,带排序 / 过滤图标的列取 `max(60, 图标下限)`(仅排序 93、仅过滤 102、两者 123);列上写了 `minWidth` 以列上的为准
```
```markdown
- Columns can't be dragged to zero: resizable columns get a fallback `minWidth` of 60, or `max(60, icon floor)` for columns with sort / filter icons (93 sort only, 102 filter only, 123 both); an explicit `minWidth` on the column wins
```
`README.md:468` 与 `README.en.md:446`(Props 表 `storage-key` 一行,旧说法:列设置和密度保存到 localStorage)整行替换为:
```markdown
| `storage-key` | `string` | — | 设置后,列设置(显隐 / 顺序 / 固定 / 列宽)保存到 localStorage;**密度只在开了 `toolbar: { density: true }`(密度按钮)时才读写存储**,否则以 `default-density` 为准 |
```
```markdown
| `storage-key` | `string` | — | Persist column settings (visibility / order / pinning / widths) to localStorage; **density is only read from / written to storage when `toolbar: { density: true }` (the density button) is on** — otherwise `default-density` decides |
```
`README.md:571` 与 `README.en.md:549`(旧说法:已存的……密度照常生效)整条替换为:
```markdown
- 列宽写入 localStorage 做了防抖;存储结构从 `v1` 升到 `v2`,已存的列显隐 / 顺序 / 固定照常生效;存储里的旧密度**只在开了密度按钮(`toolbar: { density: true }`)时继续生效**,否则以 `default-density` 为准(B2)
```
```markdown
- Width writes to localStorage are debounced; the stored shape moved from `v1` to `v2`, and existing column visibility / order / pinning keep working; a stored density **only applies when the density button is on (`toolbar: { density: true }`)** — otherwise `default-density` decides (B2)
```
Run: `git diff --stat README.md README.en.md`
Expected: 两个文件都有改动,行数相近;`grep -nE "pageSize\"?: 10\b|\[10, 20, 50|一列占位列|single filler column|默认 60）|60 by default|列设置和密度保存|column settings and density|密度照常生效|density keep working" README.md README.en.md` 无输出(`-E` 且带可选引号,才能同时抓到 `pageSize: 10` 与 JSON 里的 `"pageSize": 10`;**必须带 `\b`**:否则改成 `pageSize: 100` 之后仍会匹配前缀 `pageSize: 10`,永远有输出)。

- [ ] **Step 4: 逐条核对规格与实现,以实现为准回写(R-4)**

规格已是目标状态,但实现过程中可能冒出细节差异。**逐条读 `docs/smart-naive-table-spec.md`(§1 变更清单、§2 缺陷、§3 新增 API、§5 各节、§6 CHANGELOG 必标项),对着代码与 CHANGELOG 核对:不一致的地方以实现为准回写规格**,并把每一处改动在提交说明里列出来。已知最容易漂移的几处(核对时优先看):
- `toolbar.more` 的类型名(`ToolbarMoreOption`,不是 `DropdownMixedOption`);`FilterAction` 15 个的**纯逻辑已在 P0 落地**,P1 只剩模式 2 UI;默认可选操作符仍是 8 个;
- B4 用官方 `simple` 属性(不是新增 API)与 `showQuickJumper` / `pageSlot` 失效;B10 在 P0 里 `filterChips` 默认 `false`;B12 前半(下限)P0、后半 P1;C5 已落地(按 `n-grid` 实际轨道数判断);
- 漏斗 Tab 可聚焦(2.1.1 里是 `:focusable="false"`)、面板键盘 / ARIA 的实际行为(下拉展开时 Esc 只收下拉、自定义面板不自动聚焦,但面板打开时 Esc 会关,焦点在漏斗上也行);
- `sort()` / `clearSorter()` 的签名与转发行为;`defaultSortOrder` 只在首次 setup 读一次;
- `useSmartTable` 这个无 UI 的导出 hook 的默认 `defaultPageSize` 仍是 10,不随 B1 改变;
- 对齐设计原型(Task 13b–13g)落地的数值:工具栏标题 500 / `textColor1`、业务组 8 / 图标组 4 / 组间 12、图标按钮 16px、漏斗 22 × 22 与灰色、角标绝对定位、列头面板的 4 列网格(56 / 112 / 1fr / 28)与「条件」/ 且或下拉首列、chips 22px 行高与行末按钮规则、`clampShift` 的 8px 边距、列设置勾选框禁用;规格 §5.2 / §5.3 / §5.7 里写的数字与实现不一致处以实现为准回写;
- 文件头部「状态」一行:设计定稿;**P0 已按本计划实现**,`3.0.0-beta.1` 待发布;P1 / P2 另出计划。

- [ ] **Step 5: 最终验证(要贴真实输出)**

Run:
```bash
npm test
npm run typecheck
npm run build
git check-ignore dist
git status --short
```
Expected:
- `npm test`:全部通过,`Test Files  N passed (N)`、`Tests  M passed (M)`(Task 14 不加测试,等于 Task 13g 的累计:`Test Files  24 passed (24)`、`Tests  404 passed (404)`;**把真实数字写进最终报告**)。
- `npm run typecheck`:无输出。
- `npm run build`:构建成功,并且 d.ts 生成**没有类型错误**(`vite.config.ts` 配置了 `afterDiagnostic`,有错会让构建失败)。
- `git check-ignore dist`:输出 `dist`(被忽略,**不要提交构建产物**)。若没有输出,说明 `dist/` 被跟踪了——停下来问用户再决定,不要自行提交。
- `git status --short`:只应看到本任务改的 `package.json`、`package-lock.json`、`CHANGELOG.md`、`README.md`、`README.en.md`、`docs/smart-naive-table-spec.md`(以及仓库里原本就未跟踪的文件),**没有** `src/` / `tests/` 的未提交改动。

- [ ] **Step 6: 提交**

```bash
git add package.json package-lock.json CHANGELOG.md README.md README.en.md docs/smart-naive-table-spec.md
git commit -m "chore: 3.0.0-beta.1 版本号、CHANGELOG 与 README;回写规格与实现的差异" -m "规格回写项:(逐条列出 Step 4 里实际改动的地方)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: 交接(不要自己发布)**

把下面这些**真实结果**汇报给用户,然后停下,等用户决定是否发布:
1. `npm test` 的通过数、`npm run typecheck`、`npm run build` 的真实输出;
2. 各 Task 里「浏览器验证」步骤的记录(哪些成立、哪些没成立);
3. **没有验证的**:Firefox / Safari、真实触屏、屏幕阅读器、宿主真实后端对 `pageSize: 100` 的接受度、naive-ui 2.45.3 以外的版本;
4. **发布(由用户手动执行)**:在 `feat/v3-p0` 分支上 `npm publish --tag beta`(`prepublishOnly` 会先 `npm run build`)。**⚠ 醒目提醒:beta 不要合入 `main`** —— push 到 `main` 会触发 `.github/workflows/publish.yml`,它执行**不带 `--tag`** 的 `npm publish`,预发布版本要么失败、要么被发成 `latest`(`latest` 会指向 beta,不带版本范围的安装者都会拿到预发布版)。正式 `3.0.0` 再按原流程(版本号改成 `3.0.0`、更新 CHANGELOG、PR 合入 `main` 由 CI 发布)。本计划**不改 `publish.yml`**,是否改 CI(例如给预发布版本加 `--tag`)请用户决定。

---

## 规格覆盖对照(自查)

| 规格条目 | 所在 Task | 备注 |
|---|---|---|
| B1 每页 100 / `[100,500,1000]` | 7 | 含 `defaultPageSize` 解析优先级(D4);远程后端上限风险写入 CHANGELOG;需要卡片内滚动请用 `fillHeight`(Task 12b) |
| B2 默认紧凑 + 旧存储不盖宿主值 + 响应式 + 写入端不写宿主密度 | 5 | Review Focus 1、7 |
| B3 去掉密度按钮、`toolbar.density` 默认 false | 5 | |
| B4 官方 simple + 官方嵌套每页选择器 | 7 | 官方 `NPagination` + `displayOrder: ['size-picker']`(E2),不新增 label;Review Focus 2;窄档(`narrowPager`)不画 |
| B5 静态模式隐藏刷新 | 6 | |
| B6 悬停显现 + 触屏兜底 + 漏斗可聚焦 + 图标间距 8 / 6px、右内边距 16px | 9 | 浏览器验证;24px 触屏热区与把手视觉 **P1** |
| B7 多条件面板 + options 高级条件 + 键盘 / ARIA | 2、3、10 | Review Focus 3、6;默认可选操作符保持 8 个(D1) |
| B8 吸收列取代占位列 | 12 | `dk` 方案(E1);Review Focus 4;代价「吸收列没有把手」写入 CHANGELOG |
| B9 `paginationBehaviorOnFilter` | 7 | 保持现状的登记项(官方只在本地模式夹页,偏离只发生在 remote) |
| B10 模式 2 默认 chips | **P1** | P0 只有 `filterChips` 显式开启(Task 11) |
| B11 卡片内边距 16px + `cardProps` 回退 | 8 | 旧值 20 / 24 / 20 |
| B12 拖拽下限 | 12 | 把手骑线视觉**推到 P1** |
| C1 / C2 多列排序 + 默认排序 | 4 | 真实浏览器已复现(设计文档 9.4);C2 静态模式同样生效 |
| C3 `filterValueToOptions` 丢条件 | 3、10 | |
| C4 无值算子 | 2 | **记为「新增」**(2.1.1 没有 `isNull`,旧缺陷不可达) |
| C5 搜索折叠 | 13 | 读 `n-grid` 实际轨道数 |
| A:多列排序 API、`sort()` / `clearSorter()` | 4 | 对齐官方并通知宿主(D7) |
| A:`filterChips` | 11 | 含孤儿键(Q-7) |
| A:`toolbar.more` + `moreSelect` | 6 | Review Focus 5 |
| A:触屏兜底(只图标淡显) | 9 | `@media (hover: none)`(与原型一致,F16) |
| A:`cardProps` | 8 | D10 |
| A:`zhCNLabels` + 新 labels(全部可选) | 2、6、7、9、10、11 | 每个 Task 各加各的 |
| A:`fillHeight` 最小实现 + 不开时翻页回卡片顶部 | **12b** | D5 / E4;规格把 `fillHeight` 放 P1,这里提到 P0 |
| A:`SmartTableDefaults.defaultPageSize` | 7 | D4 |
| C6(新增登记):宿主 `onUpdate:sorter` 只转发一次 | 4 | E5;2.1.1 会调两次 |
| 15 个 `FilterAction` | 2 | 语义见 Task 2 说明;面板默认集合不变 |
| 窄档「操作 ▾」折叠、列头面板窄档用底部 `NDrawer`、「更多」菜单窄档 44px 选项高 | **P2** | D12,`cardOnNarrow` 门控;P0 / P1 下窄、宽容器同一套 |
| 窄档搜索「输入框 + 筛选抽屉」(2.6a) | **P1** | 随模式 2 |
| P1:模式 2 UI、`#batch`、放大、把手视觉(高度 70%、热区 11px / 触屏 24px、引导线、150ms 吞 click、拖动收起气泡)、B12 后半 | **不在本计划** | 另出 `…-v3-p1.md` |
| P2:`cardOnNarrow` | **不在本计划** | 另出 `…-v3-p2.md` |
| L0-1 / L0-2 工具栏标题、分组与间距、「更多」medium、图标 16px | 13c | 原型 `.st-title` / `.tb-actions` / `.tb-icons` / `.tb-right`;2.1.1 外观变化 → CHANGELOG「外观调整」 |
| L0-7 搜索区「展开」垂直居中 | 13c | 缺陷修复味道;`n-space align="center"` + 文字按钮高度 / 内边距 |
| L0-3 / L0-4 漏斗 22px、灰、绝对定位角标;过滤列标题单行省略 | 13d | G6;B12 的 102 / 123 按 22px |
| L0-5 列头面板排布、单选过滤 NRadio | 13e | 原型 `.hpop`;官方 `FilterMenu.mjs:118-141`;新增可选 labels `filterConditionLead` / `filterCannotCollapse` |
| L0-9 面板夹进视口 | 13e | `clampShift`;窄档抽屉仍 **P2** |
| L0-6 chips 外观与行末按钮规则 | 13f | `filtersAtDefaults`;原型 `hfClearShown` |
| N11 列设置至少保留一列;`SmartTableProps` 补 `rowDraggable` / `dragHandle` | 13g | 原型第 1 批:勾选框禁用;`toggleShow` 兜底 |
| 原型对照页 `/prototype.html` | 13b | 之后逐项对比的工具;库做不到的留空 |
| L0-8 窄档分页项 40px | **P2** | 随 `cardOnNarrow` 的窄档尺寸,不在本计划 |
