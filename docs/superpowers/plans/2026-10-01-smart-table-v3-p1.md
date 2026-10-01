# SmartTable 3.0.0 · P1 实现计划(→ `3.0.0-beta.2`)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 P0(`3.0.0-beta.1`,含「对齐设计原型」Task 13b–13g)之上落地规格里 **P1** 的四块:① **模式 2 条件构造器** `search: { container: 'table' }`(推荐比较符集合 §5.9、与列头面板同一套编辑内核的多条件面板、窄档「输入框 + 筛选」抽屉、模式 2 默认开 chips = B10),并**定稿 R-9 的三个数据通路未决点**;② **批量栏** `#batch`;③ **放大** `toolbar.maximize`(z-index 入口、Esc 分层、只有键盘操作才还焦点、Teleport 落点、设计 7.2「落地风险」4–6);④ **列宽拖拽把手视觉**(设计 3.11 + B12 后半,在带 `fixed` 列的表上逐列核对)。目标是 `docs/smart-naive-table-design.html`(原型)与真实库预览**行为一致**:外观以原型为准、功能取两边并集、原型与 naive-ui 官方冲突时以官方为准。发布前最后一个提交是 `3.0.0-beta.2` 的版本号与 CHANGELOG。

**Architecture:** 沿用 P0 的分层:纯 TS 内核(`maximize.ts`、`conditionBuilder.ts`、`useFilters.setMany`)可在 node / jsdom 单测,SFC 只做接线。**新能力全部是可选属性、默认关闭,P0 的默认行为、DOM 结构、布局数值一律不变**(Task 3 的 DOM 用例 + Task 9 的浏览器 DOM / 布局逐节点对比守住)。模式 2 不新造一套过滤:构造器字段 = 声明了 `search` 的列,条件存进与列头漏斗**同一份** `FilterState`,走现成的 `filterSerializer`、本地 `applyFilters`、chips;所以「搜索区」和「列头漏斗」天然互相同步;多条件面板的每一行**直接复用**列头面板的 `ConditionRow`(引导列「条件 / 且或」、比较符、值控件、删除),只经 `#field` 插槽多放一个字段下拉。放大层是一个只在开了 `toolbar.maximize` 时才多出来的 `div.smart-table-layer`,放大时整层 Teleport 到 `body`(根元素原位留同高占位)。

**Tech Stack:** Vue 3.5、naive-ui 2.45.3(以本地 `node_modules/naive-ui` 为准,**不查 naiveui.com**)、TypeScript、vitest 3(jsdom 用文件头 `// @vitest-environment jsdom`)、`@vue/test-utils`、vue-tsc。**不新增任何依赖。**

**Spec:** `docs/smart-naive-table-spec.md`(§3 末三行 P1、§5.1 / §5.2 / §5.6 / §5.9、§6.1 / §6.5、§10 的 R-9);决策过程见 `docs/smart-naive-table-design.md`(2.5a / 2.6a / 2.11 / 2.12、3.11、7.2、9.2 / 9.7、10.5、10.7–10.8)与 `docs/superpowers/review-decisions.md` §5 G0–G6、`docs/superpowers/parity-gaps.md` L1-1…L1-4。**规格与本计划应一致,执行中发现冲突,停下来报告,不要自行取舍**;本计划与规格的差异见下表,需要回写规格的条目集中在文末「规格回写清单」(本计划不改规格)。

**范围**:只做 P1(上面四块)。**不做**:`cardOnNarrow` 与窄档卡片(P2,含「操作 ▾」折叠、窄档 40px 工具栏按钮、列头面板窄档底部 `NDrawer`、「更多」菜单窄档 44px、L0-8 窄档分页项 40px)、窄档卡片第 2 行含不含「排序」(R-9 第三点,P2 计划前统一)、模式 2 之外的任何移动端布局。

> **状态**:Task 1–9 的**全部代码都在沙盒里从 P0 终态起、按本计划的顺序整条重放过**(每个 Task 先红后绿 + `vue-tsc`,最后 `npm run build` 含 d.ts),下面每个 Task 的红 / 绿数字都是实测(见各 Task 的 Expected)。**浏览器验证用 Edge 无头 + CDP**(脚本在沙盒的 `_kit/tools/`)跑过,结果见各 Task 的「浏览器验证」。原型对照(`parity-m2.mjs`)在 Task 8。**还没验证的**见下一节。

## 前置状态(执行前必读)

- **基线 = P0 终态**:`feat/v3-p0` 上 P0 的 Task 1–13g 都已落地(含「对齐原型」13b–13g:工具栏业务组 / 图标组、漏斗 22px、列头面板 4 列网格与「条件」引导列、chips 外观、`prototype.html` 对照页)。**`npm test` = `Test Files  24 passed (24)`、`Tests  404 passed (404)`**,`npm run typecheck` 无输出。Task 0 要实测并记录这个基线;**如果不是这个数,停下来先查原因**(P0 计划还在改的话,以你实测的基线为准:各 Task 的 Δ 与基线无关,Expected 写「基线 + Δ」,括号里是沙盒基线 404 上的实测累计数)。
- 本计划的每个 diff 都是对这份 P0 终态写的(沙盒冻结副本 `.sandbox/p1-base/`),`@@` 行号只是参考,**按上下文定位,不要依赖行号**。P0 的 Task 14(版本号 `3.0.0-beta.1`、CHANGELOG、README 的 P0 部分)若还没做,不影响本计划:Task 9 的 README 改动按「行首标记」整行替换,不依赖 P0 的 README 改动;CHANGELOG 的 `3.0.0-beta.2` 节写在 `3.0.0-beta.1` 节**之前**,要求 beta.1 节已存在(没有就先做 P0 Task 14)。
- **P1 复用了 P0 对齐阶段的产物**(它们必须在):`ConditionRow.vue`(`index` / `logic` / `update:logic`、4 列网格、`filterConditionLead` 引导标签)、`icons.ts` 的小号图标(`ChevronDownIcon` / `CloseIcon` / `PlusIcon`,16 视口)、右侧工具栏的 `div.smart-table-toolbar-right > .smart-table-toolbar-actions + .smart-table-toolbar-icons`、`ColumnFilter.vue` 的面板、`playground/prototype/*`(对照页)。

### 沙盒里已经实际跑过的(真实结果,执行时应复现)

- 全量重放(Task 1→9,每个 Task 先红后绿 + `vue-tsc`):累计测试 **422 / 445 / 464 / 474 / 499 / 516 / 544 / 547 / 547**(基线 404),`vue-tsc --noEmit` 退出码 0,`npm run build`(含 d.ts)成功(`built in …s`、`build exit=0`)。
- **默认(不开任何 P1 能力)的零影响**:`dom-dump`(标签 + class 树,三个场景 2020 / 391 / 2745 行)与 `layout-dump`(基础 @1440、基础 @700、过滤 / 列宽 @1440、铺满 @1440、宽表 @1440 五个场景的几何)与 P0 终态**逐项一致**(`dom` IDENTICAL、`layout` IDENTICAL)。
- 浏览器脚本(Edge 无头 + CDP,**没用 Playwright MCP**)全部 PASS / 读数符合期望:`batch1`(15 项)、`m2flow`(29 项)、`m2narrow`(12 项)、`m2max`(5 项)、`max2` / `max3`(Esc 分层、焦点、滚动锁定、`fillHeight` 下 `scrollTop` 保留、祖先 `transform`、宿主顶栏 z-index、双表、Tab 循环、暗色)、`handle1`–`handle3` / `touch1`(把手几何、引导线、150ms 吞 click、触屏 24px 与单指拖动、固定列命中)。
- 原型对照(`parity-m2.mjs`,同视口并排读数):宽 / 中档工具栏与条件行、多条件气泡、放大、批量栏(宽档)几何**逐项一致**;残差(官方优先)见 Task 8「已知残差」。

- **整条重放脚本**(P0 之后再有改动时,用它复核本计划的 diff 还能不能套上):`bash .sandbox/p1/_kit/replay/run-plan.sh`(从冻结的 P0 终态 `.sandbox/p1-base/` 起,Task 1→9 每步「先只加测试(红)→ 再加实现(绿 + typecheck)」,最后 `npm run build`,结果写 `_kit/replay/results/`);单步调试 `bash _kit/replay/step.sh N`、`bash _kit/replay/upto.sh N`。P0 的终态变了就把新的终态拷成 `.sandbox/p1-base/` 再跑;`plan/tN_impl.py` 里 `sub(文件, 旧片段, 新片段)` 找不到旧片段会立刻报哪个文件的哪段对不上——就是需要手工合并的地方。

### 仍然没有验证的(诚实清单)

**Firefox / Safari**(`color-mix()`、`@media (hover: none)`、Teleport 后滚动恢复)、**真实手指触屏**(触屏用 Chromium 的触摸模拟 + 合成 `TouchEvent` 验证)、屏幕阅读器、宿主真实顶栏的 z-index(只用了 playground 里的假顶栏)、放大态下 `fillHeight` 之外的虚拟滚动变体、`NConfigProvider` 的 `locale` 切换后构造器里的日期选择器文案、窄档抽屉里长列表(> 85vh)的滚动手感、naive-ui 2.45.3 以外的版本。

## 与规格 / 设计的差异(P1-R)

规格 / 设计已是 P0 之后的目标状态,下面是 P1 的取舍与定稿;**需回写规格的条目**在文末「规格回写清单」逐条列出。

| # | 条目 | 规格 / 设计原写法 | 本计划 | 原因 |
|---|---|---|---|---|
| 1 | `toolbar.maximize` 的形态(R-9 放大 · z-index 入口) | `boolean`(规格 §3),又要求层级可配置(§5.2) | **`boolean \| { zIndex?: number }`**:`true` = 1999,`{ zIndex }` 覆盖;≥ 2000 开发期警告一次 | 不新增独立 prop;API 只多一种形态,`true` 的行为与规格一致 |
| 2 | 档位(窄 < 600 / 中 < 1280 / 宽 ≥ 1280)的判定 | 规格 §4:`@container` | **JS 量根节点(放大态量放大层)宽度**,`tier` 作为 prop 传给 `Toolbar` / `ConditionBar` | 原型自己也是 JS(`T_NARROW = 600`、`T_WIDE = 1280`);构造器的气泡 / 抽屉本来就要在 JS 里知道档位;**不给根元素加 `container-type`**(Teleport 的对象是放大层而不是根,`container-type` 得在被搬走的元素上才生效,设计 7.2 风险 5);放大后按放大层宽重新判档(`m2max` 实测:容器 1000 = 中档 → 放大 1440 = 宽档) |
| 3 | 放大层的 Teleport 对象(设计 7.2 风险 4) | 未定 | **整个「放大层」`div.smart-table-layer`**(`MaximizeLayer` 函数组件):未开放大时只渲染插槽(DOM 与 P0 完全一致);开了但没放大时是 `display: contents` 的一层;放大时 Teleport 到 `body`、`position: fixed; inset: 0`,**根元素原位留同高占位** | 根元素必须留在原位给宿主占位(放大前后文档高度不变);Teleport 只搬 DOM 不重挂,输入框内容 / 勾选 / 过滤态保留。**scoped 样式**:`MaximizeLayer` 渲染的 `div` 拿不到本组件的 `__scopeId`,不手动带上的话放大后所有 scoped 规则(悬停图标、把手、表头内边距)失效(Task 3 有专门测试) |
| 4 | 放大层背景(设计 7.2 风险 6) | 未定 | **官方 `NLayout` embedded 的底色**:亮 `actionColor`、暗 `bodyColor`(`layout/styles/light.mjs:22` / `dark.mjs:25`),文字 `textColor2`;`baseColor` 判明暗 | 与宿主常见的灰底页面一致,卡片在上面分得出层次;**需用户确认**(备选:卡片白底铺满) |
| 5 | Esc 分层(规格 §10、设计 7.2) | 先收气泡 / 抽屉再还原 | **捕获阶段**读「此刻有没有打开的浮层」(`hasOpenFloat`),冒泡阶段再决定还原;库自己的 `NPopover` / `NDropdown`(更多 / 密度 / 列设置 / chips「+N」)用 `useEscClose` 补上 Esc 关闭 | 冒泡阶段 NSelect / NDatePicker 已先把自己关掉,读到的就是「没有浮层」会整张表一起还原;`NPopover` 不管键盘、`NDropdown` 只有焦点在菜单里才响应 Esc(spike 实测)。**副作用(默认行为)**:这几个气泡现在不开放大也能 Esc 关(P0 不能),CHANGELOG 记一笔 |
| 6 | 「只有键盘操作才还焦点」(规格 §6.1 / §10) | 未定 | **按最近一次输入是 `keydown` 还是 `pointerdown` 判断**(`trackInputModality`,捕获阶段、引用计数、开了 `toolbar.maximize` 就追踪) | 鼠标点按后再 `focus()` 会画出黑色焦点环(用户已反馈) |
| 7 | 滚动锁定 | `html { overflow: hidden }` | **引用计数**(多张表 / 重复调用只在 0→1 记原值、1→0 还原原值);放大中卸载 / 宿主关掉开关都解锁 | 否则路由切换后整页永远不能滚 |
| 8 | 模式 2 数据通路 ①:只写 `search` 的列如何派生 `FilterDef`(R-9) | 未决 | `deriveBuilderDefs`:**字段候选 = 声明了 `search` 且放得进一行的列**;同时写了 `filter` 的列**复用列头 `FilterDef`(同一个过滤键)**、只把比较符换成推荐集合;只写 `search` 的列新派生一个(类型取 `search.type` / 推断,`daterange` 按 `date`,标题取 `search.label ?? 列标题`);**带 `search.render` 的列、`switch` 类型的列不进构造器**;`search.key` **忽略**(模式 2 的出口是 `filters[].field`,不是扁平键);比较符优先级:`search.actions` > `filter.actions` > 推荐集合 | 过滤键 = `filter.key ?? 列 key`,保证与列头漏斗同一份状态;自定义控件放不进一行(设计 2.6) |
| 9 | 模式 2 数据通路 ②:请求形状 vs `@search` 扁平 params(R-9) | 未决 | **请求形状 = `filterSerializer` 的 `filters`(默认 `{ filters: [{ field, logic, conditions }] }`),没有扁平搜索键**;`@search` 的载荷 = `{ ...清洗后的 params, ...filterToParams() }`(与随后的请求一致);点「搜索」/ 回车才提交(敲字不提交),**没有变化也重查**(与模式 1 一致);「重置」恢复各字段的 `defaultValue`(`search.defaultValue` 的扁平标量 → 一条初始条件:input 用 `contains`、其余 `equal`),不碰列头漏斗单独管的列;一次提交多字段只触发**一次** `filter-change`(`key` 为空串,与 `clearFilters` 同口径)、远程只重查一次;**静态 `data` 模式:只写 `search` 的列也能本地过滤** | 复用 `FilterState` → `useFilters.setMany`(新增);`@search` 与请求一致,宿主两种方式拿到的是同一份数据 |
| 10 | 模式 2 数据通路 ③:`container` × `layout`(R-9) | 未决 | `container` 缺省 `'card'`;**`container` 优先于 `layout`**;没写 `container` 时 `layout: 'inline'` = `'none'`(2.1.1 行为不变);`'none'` = 不带卡片的内联搜索表单;`search: false` 什么都没有(含模式 2) | `resolveSearchContainer` 一个纯函数,`SearchForm` 只认 `layout`,`SmartTable` 把 `container` 折算成 `layout` 再传 |
| 11 | 构造器行数上限 | 列头面板 5 条(B7) | **构造器 10 条**(`MAX_BUILDER_ROWS`),之后「添加条件」禁用 | 构造器管多个字段,每字段约 5 条;**需用户确认** |
| 12 | B10:模式 2 默认开 chips | 模式 2 默认多一行 chips | `chipsEnabled = filterChips ?? isMode2`(宿主显式写了就听宿主的);**宽 / 中档下只有 1 条、且正是主行里那条构造器条件时不画**(主行已显示,原型如此),窄档(主行只有输入框)≥ 1 条都画;点构造器字段的 chip 开多条件面板,点只有列头漏斗管的列的 chip 开对应漏斗 | 设计 2.11 / 原型 |
| 13 | 批量栏 | 规格 §5.2 | 替换范围 = 「标题 + 业务按钮 + 更多」,**内置图标组(放大 / 刷新 / 列设置)留在右侧**;「**本页全选复选框** + 已选 N 项」+ 宿主 `#batch` + 「取消选择」;复选框(原型 `.bt-info`):本页可勾行全勾上 = 选中,其余 = 半选,点它并入 / 去掉本页的键(别页的保留,`selection` 列 `disabled` 的行不算),载荷同官方表头全选;「取消选择」/ `clear()` 向宿主绑的 `onUpdate:checkedRowKeys` / `onUpdateCheckedRowKeys` 报 `([], [], { row: undefined, action: 'uncheckAll' })`(官方已弃用的 `onCheckedRowKeysChange` 不管),宿主只绑了 `checked-row-keys`(只读)时是空操作;与工具栏**同一 `min-height`**(记住非批量态的实测高度,勾选不让表格跳动),内容贴第 1 行顶部;窄档(< 600)排成「已选 N 项 \| 取消选择」一行 + 宿主按钮整行 | 库不持有勾选态(`checked-row-keys` 在 `attrs`,不是响应式的,靠宿主重渲染);**复选框是原型当前版本有的**(功能取并集),规格 §5.2 没写,回写 |
| 14 | 把手竖条高度 | 规格 §5.6 / 设计 3.11 文字:高度 70% | **整个表头行高**(`top: 0; bottom: -1px`) | 原型当前 CSS 就是整行(`.th-resize::after { top: -1px; bottom: -1px }`,注释「用户标注『与行高一致』」),与文字里的「70%」自相矛盾;**以原型 CSS 为准**,规格 / 设计文字回写 |
| 15 | 触屏拖把手 | 规格 §5.6:24px 热区 | 24px 热区 + **把单指 `touchstart` / `touchmove` / `touchend` 转成合成鼠标事件**(≈ 40 行,`touchstart` 里 `preventDefault` 防止浏览器随后补发兼容鼠标事件) | 官方 `ResizeButton` **只监听鼠标事件**(把手的 `onMousedown` + `window` 上的 `mousemove` / `mouseup`),不桥接时 24px 热区在触屏上拖不动;**需用户确认**(备选:不桥接,把「触屏拖列宽」列入已知限制) |
| 16 | 固定列上的把手层叠(B12 后半) | 「`th` 改 `overflow: visible` + 递减 `z-index`」 | **非固定 `th` 不用递减**(官方 `th` 是 `position: relative` 且没有 `overflow` 规则,不构成层叠上下文,把手 `z-index: 1` 低于 fixed-left 的 2 / fixed-right 的 1 且 DOM 更靠后 / selection 的 3);**相邻的固定列**靠前者依次更高(fixed-left 的前 6 列 8…3) | 真实浏览器逐列命中测试(`handle3`):相邻两个 sticky `th` 的 `z-index` 相同、后者在 DOM 里更靠后,会盖住前者伸进来的半个把手 |
| 17 | 窄档构造器 | 设计 2.6a:输入框 + 筛选抽屉 | 窄档主行只画**第 1 行的值控件**(没有字段 / 比较符下拉),占位 = `labels.searchBy`(「搜索 {字段名}」),控件 `size="large"`(40px)、右侧放大镜、回车 = 搜索;枚举(select)字段的**标量**比较符选完即生效;「筛选」按钮带角标;抽屉 = 官方 `NDrawer`(`placement="bottom"`,高度随内容、最高 85vh)里同一份多条件面板的堆叠排布(每条一块:头「条件 N」+ 同字段的且 / 或 + 删除,`[字段 \| 比较符]` 两列,值整行),页脚「添加条件」靠左、「重置」「确认」靠右(`size="large"`);窄档 chips ≥ 1 条就画 | 原型 `.sheet` / `.sb`;**N7(窄档的其余触屏尺寸:40px 工具栏按钮、「操作 ▾」折叠)仍归 P2**;抽屉头用官方 `NDrawerContent` 的标题 + 关闭图标(51px 高,原型是 40px 的大关闭按钮、73px 高:官方优先,残差 22px) |
| 18 | 构造器 / 抽屉里 Esc 与点空白的处理 | 未提 | 面板 / 抽屉里 Esc = 收起**并保留草稿**(不提交),焦点回「更多条件」按钮;点空白收起同样保留草稿;面板里下拉展开时 Esc 只收下拉 | 构造器草稿与工具栏主行是**同一份**,丢弃会让主行已敲的字消失;**与列头面板(Esc 丢弃草稿)不同,需用户确认** |
| 19 | 版本号 | — | `3.0.0-beta.2`(与 beta.1 同分支 `feat/v3-p0` 继续) | 同一条预发布线 |
| 20 | 新 labels | — | `selectedCount`、`clearSelection`、`searchBy`、`searchMoreConditions`、`searchConditionN`(抽屉块头「条件 {n}」):**全部可选**,`defaultLabels` 英文、`zhCNLabels` 中文;`maximize`、`restore` 同;面板第 1 行的引导文字**复用 P0 的 `filterConditionLead`**,「添加条件」复用 `filterAddCondition`,复选框 `aria-label` 复用 `filterSelectAll` | D9 |
| 21 | 对照页(`prototype.html`)模块 2 | P0:「库做不到的(条件构造器、放大、批量栏…)一律留空」 | 模块 2 改用真实的条件构造器(`search: { container: 'table' }`、`search.actions` 取原型 `OPS_BY_TYPE`)、批量栏(批量审核 + 批量删除 `NPopconfirm`)与放大(四个模块的工具栏都有) | 原型有、库现在有了,按 G0 补进对照页,之后逐项并排读数 |

## 需用户确认(附推荐)

按「未决点优先按设计文档已有结论;文档没定的,选最简方案」。下面是文档没有明确定、我按推荐实现了的点,**你可以推翻,推翻后的改动量都标在后面**:

| # | 问题 | 推荐(已按此实现) | 备选与代价 |
|---|---|---|---|
| Q1 | 放大层背景 | **NLayout embedded 色**(亮 `actionColor` / 暗 `bodyColor`) | 卡片白底铺满:删 `layerStyle` 里的 `background`,留 `zIndex` |
| Q2 | `toolbar.maximize` 的形态 | **`boolean \| { zIndex }`** | 独立 prop `maximizeZIndex`:多一个 prop,`resolveMaximize` 多一个参数 |
| Q3 | 档位判定用 JS 而不是 `@container` | **JS**(规格 §4 要回写;原型也是 JS) | `@container`:要给 Teleport 的放大层本身加 `container-type`,且气泡 / 抽屉仍需 JS 档位,两套并存 |
| Q4 | 多条件面板 / 抽屉里 Esc、点空白 | **收起并保留草稿** | 丢弃草稿(与列头面板一致):主行已敲的字会消失,要多一个「草稿快照」 |
| Q5 | 构造器行数上限 | **10 条** | 5 条(与列头面板一致):改 `MAX_BUILDER_ROWS` 一个常量 |
| Q6 | 窄档构造器控件尺寸 / 抽屉头 | **`size="large"`(40px)**,抽屉头用官方 `NDrawerContent`(不复刻原型 40px 的大关闭按钮),N7 其余仍归 P2 | `medium`:改 `ConditionBar` 的几个字面量;或把 N7 整块提前(超出 P1) |
| Q7 | 触屏拖把手是否桥接 | **桥接**(≈ 40 行 + 3 条测试) | 不桥接:删 `onLayerTouchstart` 一段与相应测试,CHANGELOG 把「触屏不能拖列宽」列入已知限制(官方 `ResizeButton` 本来就只认鼠标) |
| Q8 | 放大层多一层 DOM、且不支持运行时切换开关 | **仅开了 `toolbar.maximize` 的用户多一层** `div.smart-table-layer`;宿主挂载后切换 `toolbar.maximize` 会让表格重建(CHANGELOG 写明) | 用 `Teleport` 直接包根元素:根元素没法在原位留占位,放大前后文档高度会变 |
| Q9 | 库自己的气泡(更多 / 密度 / 列设置 / chips「+N」)现在能 Esc 关(不开放大也一样) | **默认就开**(放大的 Esc 分层要靠它,拆开只会多一个开关) | 只在放大态才给 Esc:`useEscClose` 加一个 `enabled` 参数 |
| Q10 | `search.actions`(模式 2 里单个字段的比较符覆盖) | **保留**(只写 `search` 的列没有 `filter`,没有别处可写比较符) | 删:少一个公开字段,只写 `search` 的列只能用推荐集合 |
| Q11 | 模式 2 的字段范围:`switch` / `render` 列不进;`daterange` 按 `date`;`search.key` 忽略 | **按此** | 放开 `switch`:新增一种值控件与「布尔」比较符集合,超出规格 §5.9 的四类 |
| Q12 | R-9 第三点(窄档卡片第 2 行含不含「排序」)与 N7 | **留 P2** | — |
| Q13 | 官方优先的残差(搜索 / 确认按钮宽 56 vs 原型 58、`重置` quiet 按钮 56 vs 原型 46、抽屉头 51 vs 73 等,见 Task 8「已知残差」) | **保留官方尺寸**(G3:原型与官方冲突改原型) | 在库里用 `theme-overrides` 压成原型的数:每处一行,但偏离官方 |
| Q14 | 分支 | **在 `feat/v3-p0` 上继续**(`3.0.0-beta.2`) | 新开 `feat/v3-p1`:合并回 `feat/v3-p0` 多一步 |

## Global Constraints

- 库已发布到 npm(当前 `2.1.1`),消费方是别人的后台系统。本计划只产出 `3.0.0-beta.2` 的代码与版本号,**不执行 `npm publish`**(用户在 `feat/v3-p0` 分支上手动 `npm publish --tag beta`)。**⚠ beta 不要合入 `main`**:push 到 `main` 会触发 `.github/workflows/publish.yml`(不带 `--tag` 的 `npm publish`),该 workflow 不在本计划范围,**不要改它**。
- **以 naive-ui 官方为准**:任何组件用法、属性名、主题变量,**只核对本地 `node_modules/naive-ui/es/**`**(`.d.ts` 与 `.mjs`),不凭记忆写,**不查 naiveui.com**。本计划里用到的官方事实都写在对应 Task 里:`th` 是 `position: relative` 且无 `overflow` 规则、fixed-left `th` z-index 2 / fixed-right 1 / selection 3、表头容器 z-index 3;`data-data-table-resizable` 只在点击落在把手内时跳过排序;`ResizeButton` 只监听鼠标事件;卡片内容区类名是 `n-card-content`;`NPopover` / `NDropdown` 在焦点不在浮层内时不处理 Esc;vueuc follower 外壳在关闭后仍留在 DOM(子元素 `display: none`);tooltip 的类名是 `.n-popover.n-tooltip`;`NPopover` `trigger="manual"` + `@clickoutside`;`NDrawer` `placement="bottom"` + `height` + 透传 `style`、`NDrawerContent` 的 `body-content-style` / `#footer`;`.n-drawer-body` 是 `flex: 1 0 0` + `overflow: hidden`。
- **不新增依赖**(vite / vue / naive-ui / vitest / @vue/test-utils / vue-tsc 已有)。
- **新能力全部是可选属性、默认关闭**:不传任何 P1 属性时,默认行为、DOM 结构、布局数值与 P0 终态一致(Task 9 的 DOM / 布局对比守住);本计划**没有「有意翻转」的特征测试**——任何既有测试变红都是回归,**停下来查原因,不要改断言**。
- **labels 在渲染期求值**;新增文案走 `src/labels.ts` 英文默认 + `SmartTableLabels` 类型;**新 label 键一律可选(`?:`)**,库内部用 `Required<SmartTableLabels>`;每个加键的 Task 同步补 `defaultLabels` 与 `zhCNLabels`,`tests/config.test.ts` 的完整性用例会守住。
- **列驱动**:构造器字段来自列声明,不另设字段配置;**向后兼容**:旧的 `search.layout: 'inline'` 行为不变。
- **明暗两套主题都要成立**(用 `useThemeVars()` / `--n-*` 变量,不写死色值);**动效克制**(把手竖条 `background-color` / `box-shadow` 150ms,不加别的)。
- **测试纪律(用户的 CLAUDE.md)**:测试失败时**不要**改断言、加 `skip` 或放宽阈值来让它变绿,先定位原因。
- **报告完成时给出实际跑过的命令和真实输出**,不要只说「通过」。
- 回复与提交说明用**中文**;代码、命令、路径、报错原文保持原样。提交说明末尾加一行(与 P0 一致):`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。
- 分支:`feat/v3-p0`(继续用,**不要在 `main` 上直接提交**)。
- **浏览器验证步骤要真的做**:用 Edge 无头 + CDP(沙盒里的脚本在 `.sandbox/p1/_kit/tools/`,`bash .sandbox/p1/_kit/vite-up.sh` 起 5193、`node .sandbox/p1/_kit/tools/xxx.mjs`、**用完 `bash .sandbox/p1/_kit/vite-down.sh` 停掉 dev server**);**不用 Playwright MCP**。仓库里没有 `.sandbox/` 时,按各 Task「浏览器验证」里写的读数手动做(前置条件、URL、读哪个 DOM 值、期望数字都写了),playground 的场景页 `DemoMax.vue` / `DemoMode2.vue` 与对照页 `prototype.html?m=2` 是本计划的正式改动。
- 只读参考:`docs/spike/`(一次性验证代码,**不要改它们来「配合」实现**)、`docs/smart-naive-table-design.html`(原型)。

## Review Focus

规格隐含、但没有任何任务的常规测试会覆盖、最容易咬到真实使用者的输入或状况(按可能性排序)。**每一条都在所属任务里有一个专门的测试步骤**:

1. **放大中 Esc 的三种情况**:下拉 / 筛选面板 / 日期面板展开时按 Esc 只能收浮层,**不能把整张表一起还原**(尤其浮层在冒泡阶段先把自己关掉的 NSelect);鼠标还停在放大按钮上时(tooltip 一直开着)Esc 必须能还原;没放大时库不得监听 document 的 Esc(不误触别人的 Esc)。(Task 2、Task 3)
2. **放大状态下被卸载 / 宿主把 `toolbar.maximize` 关掉**:必须解除 `html` 的滚动锁定并摘掉 document 监听,否则路由切换后整页永远不能滚;多张表同时放大 / 重复调用不能提前解锁。(Task 2、Task 3)
3. **批量栏的边界**:宿主只绑了 `checked-row-keys`、没绑更新回调(只读)时「取消选择」不能抛错;勾选键为空 / 没有 selection 列 / 没传 `#batch` 都不出现;宿主在批量栏出现前后改勾选键,工具栏高度不能跳(表头 y 不变);**「本页全选」只动本页的键**(别页已选的不能被清掉)、`selection` 列 `disabled` 的行不能被全选勾上。(Task 1)
4. **模式 2 与列头漏斗共用一份过滤态时的串扰**:别的列的漏斗改了过滤态,**主行里还没提交的输入不能被冲掉**;一次提交多个字段只触发一次 `filter-change`;chips 指向构造器管的字段时点它要开多条件面板、指向只有漏斗管的列时开漏斗;列头只写 `filter` 的键不会被构造器的「重置」清掉。(Task 7、Task 5)
5. **把手手势**:拖完松手落在表头上**不能误触发排序**(150ms 内吞 click,之后正常点击不受影响);拖动开始时已打开的过滤气泡要收起(锚点会错位);紧挨着固定列的列、相邻两个固定列、横向滚动后的 selection 列右缘,把手命中不能被邻居盖住;拖动中卸载要摘掉 `body` 上的光标类与 `window` 上的监听。(Task 4;固定列上的命中测试 jsdom 做不了,只能在 Task 4 Step 5 的真实浏览器里验证)
6. **默认不开时的零影响**:不传 `toolbar.maximize` / `#batch` / `container: 'table'` 时,根元素的直接子节点、DOM 树、布局数值与 P0 终态一致;`layout: 'inline'` 的旧写法不变。(Task 3 的 DOM 用例 + Task 9 的浏览器对比)

---

## File Structure

新建(均在 `src/`,除非注明):

| 文件 | 职责 | 由谁消费 |
|---|---|---|
| `maximize.ts` | 放大的无 UI 辅助:`DEFAULT_MAXIMIZE_Z`、`resolveMaximize`、`lockScroll` / `unlockScroll`(引用计数)、`trackInputModality` / `isKeyboardModality`、`FLOAT_SELECTOR` / `hasOpenFloat`、`FOCUSABLE` / `loopTab` | `SmartTable.vue` |
| `useEscClose.ts` | `useEscClose(show)`:弹层打开期间 document 冒泡阶段 Esc 关闭(`NPopover` / `NDropdown` 自己不管) | `Toolbar.vue`、`ColumnSettings.vue`、`FilterChips.vue` |
| `MaximizeLayer.ts` | 函数式「放大层」:`enabled` 为假只渲染插槽;为真包一层 `div`,`active` 时 `Teleport` 到 `body` | `SmartTable.vue` |
| `conditionBuilder.ts` | 模式 2 的纯逻辑:`SearchContainer`、`resolveSearchContainer`、`RECOMMENDED_ACTIONS`、`MAX_BUILDER_ROWS`、`deriveBuilderDefs`、草稿 ↔ 过滤态(`draftFromState` / `patchFromDraft` / `draftMatchesState` / `resetPatch`)、行编辑(`setRowField` / `setRowAction` / `setRowValue` / `addRow` / `removeRow` / `setFieldLogic` / `rowLead`) | `SmartTable.vue`、`ConditionPanel.vue`、`ConditionBar.vue` |
| `ConditionPanel.vue` | 多条件面板内容(气泡 / 抽屉里共用):每行 = `ConditionRow`(经 `#field` 插槽放字段下拉);`stack` = 抽屉堆叠排布;气泡页脚「添加条件」「重置」「确认」 | `ConditionBar.vue` |
| `ConditionBar.vue` | 工具栏里的构造器:宽 / 中档主行(字段 + 比较符 + 值 + `»` + 搜索 + 重置),窄档「输入框 + 筛选」;气泡 / 抽屉承载 `ConditionPanel` | `SmartTable.vue`(经 `Toolbar` 的 `#cond` 插槽) |
| `playground/DemoMax.vue`、`playground/DemoMode2.vue` | 浏览器验证的前置条件(批量栏 / 放大 / 宿主假顶栏 / 双表 / 祖先 `transform`;模式 2 的 `container` × 宿主宽度 × 远程开关) | `playground/App.vue` 加两个页签 |

修改:`types.ts`(`ToolbarConfig.maximize`、`SearchFormConfig.container`、`SearchConfig.actions`、7 个新 label 键)、`labels.ts`、`icons.ts`(`MaximizeIcon` / `RestoreIcon` / `MoreConditionsIcon` / `SearchIcon`)、`index.ts`(导出 `RECOMMENDED_ACTIONS` / `SearchContainer`)、`useColumns.ts`(抽出 `inferFilterType`)、`useFilters.ts`(`setMany`)、`Toolbar.vue`、`ColumnSettings.vue` / `FilterChips.vue`(各加一行 `useEscClose`)、`ColumnFilter.vue`(`closeRequest`)、`ConditionRow.vue`(`size` / `valueOnly` / `placeholder` / `lead` / `searchIcon` + `#field` 插槽)、`SmartTable.vue`、`playground/prototype/ProtoModule.vue`;文档:`CHANGELOG.md`、`README.md`、`README.en.md`、`package.json`。

测试(均在 `tests/`):新增 `SmartTable.batch.test.ts`、`maximize.test.ts`、`useEscClose.test.ts`、`SmartTable.maximize.test.ts`、`SmartTable.handle.test.ts`、`conditionBuilder.test.ts`、`ConditionBar.test.ts`、`SmartTable.mode2.test.ts`;追加 `Toolbar.test.ts`、`ColumnFilter.test.ts`、`useFilters.test.ts`、`prototype.test.ts`。

**全程用同一组命令验证**(每个 Task 结尾都要跑):

```bash
npm test
npm run typecheck
```

基线:**P0 终态**(Task 0 里实测并记录;沙盒的 P0 终态是 `Test Files  24 passed (24)`、`Tests  404 passed (404)`,typecheck 无输出 = 通过)。**每个 Task 的 Expected 写「基线 + Δ」,括号里是沙盒基线上的实测累计数**;累计一览(沙盒基线 404):T1 422、T2 445、T3 464、T4 474、T5 499、T6 516、T7 544、T8 547(Task 9 不加测试,仍是 547)。

---


### Task 0: 前置核对与基线

**Files:** 无(只做 git 与验证)。

**Interfaces:**
- Consumes: P0 终态(`feat/v3-p0`,含 Task 13b–13g)。
- Produces: 确认分支与工作区干净;**基线数字**(`Test Files` / `Tests` 数、typecheck、build),后续每个 Task 的 Expected 都是「基线 + Δ」;确认 P1 要复用的 P0 产物都在。

- [ ] **Step 1: 确认分支与工作区**

Run:
```bash
git branch --show-current
git status --short src tests package.json playground
```
Expected: 第一条输出 `feat/v3-p0`;第二条无输出(`src/`、`tests/`、`package.json`、`playground/` 没有未提交改动;仓库里其它未跟踪文件如 `docs/`、`*.png` 与本计划无关,**不要**提交它们)。不在 `feat/v3-p0` 就 `git switch feat/v3-p0`(切不过去停下来问用户,**不要**在 `main` 上提交)。

- [ ] **Step 2: 记录基线**

Run:
```bash
npm test
npm run typecheck
npm run build
```
Expected(沙盒实测):`Test Files  24 passed (24)`、`Tests  404 passed (404)`;typecheck 无报错输出;build 以 `built in …s` 结束(d.ts 生成无类型错误)。**把你实测的两个数记下来**:下面每个 Task 的 Expected 都按「基线 + Δ」算,括号里的绝对数字是沙盒基线 404 上的实测。**不是这个数字,停下来先查原因,不要继续。**

- [ ] **Step 3: 确认 P1 要复用的 P0 产物都在**

Run:
```bash
grep -n "filterConditionLead" src/labels.ts src/ConditionRow.vue
grep -n "smart-table-toolbar-actions\|smart-table-toolbar-icons\|smart-table-toolbar-right" src/Toolbar.vue
grep -n "export const PlusIcon\|export const CloseIcon\|export const ChevronDownIcon" src/icons.ts
ls prototype.html playground/prototype/ProtoModule.vue src/viewportClamp.ts
```
Expected: 四条命令都有输出,没有 `No such file`。缺任何一个 = P0 的「对齐原型」Task 13b–13g 没落完,**先回去做完 P0,不要在这个基线上硬套本计划的 diff**。

- [ ] **Step 4: 不提交**(本 Task 没有代码改动)。

---


### Task 1: 批量栏 `#batch`(规格 §3 / §5.2 / §6 第 5 条;设计 2.5a / 2.12)

> 规格:**四个条件全满足才出现**:有 `selection` 列、传了 `#batch` 插槽、宿主绑了 `checked-row-keys`(库不持有勾选态,没绑就没有批量栏)、至少勾了一行;不暴露 `checkedRows`。原地替换工具栏左半段(标题 + 业务按钮 + 「更多」),与工具栏行**共用同一 `min-height`**(勾选不让表格跳动),内置图标组留在右侧。原型当前版本(`.tb-batch`)还有两点规格没写:**「已选 N 项」前有一个「本页全选」复选框**(本页可勾行全勾上 = 选中,其余 = 半选),内容**贴第 1 行顶部**(两行高的中档工具栏勾选后内容不往中间飘)。**放大按钮在 Task 2 才有**,批量栏里它「仍在」的断言放在 Task 2。

**Files:**
- Create: `tests/SmartTable.batch.test.ts`、`playground/DemoMax.vue`(批量栏场景页;Task 3 把它扩成「批量 / 放大」)
- Modify: `src/types.ts`、`src/labels.ts`、`src/Toolbar.vue`、`src/SmartTable.vue`、`playground/App.vue`

**Interfaces:**
- Consumes: P0 的 `Toolbar.vue`(`.smart-table-toolbar-right` 业务组 / 图标组)、`SmartTable.vue` 的 `attrs` / `callAll` / `rowKeyFn` / `tableData` / `localPage` / `localPageSize`、`labels.filterSelectAll`(复选框的 `aria-label`)。
- Produces:
  - `SmartTableLabels.selectedCount?` / `clearSelection?`(**可选**;英文 `{n} selected` / `Clear selection`,`zhCNLabels` `已选 {n} 项` / `取消选择`)。
  - `Toolbar` props:`batch: { count: number; checked: boolean; indeterminate: boolean } | null`(默认 `null`);emits:`clearSelection()`、`toggleAll(checked: boolean)`;插槽 `#batch`。
  - `SmartTable` 插槽 `batch?: (props: { checkedRowKeys: Array<string | number>; clear: () => void }) => any`。
  - `SmartTable` 内部:`pageRows` / `checkablePageRows`(本页的行、去掉 `selection` 列 `disabled` 的行)、`batchState()`、`hostCheckedKeys()`、`clearChecked()`、`toggleAllPage(checked)`。
  - CSS 类:`.smart-table-toolbar--batch`、`.smart-table-batch`、`.smart-table-batch-info`、`.smart-table-batch-acts`(后面的 Task 与浏览器脚本用)。

- [ ] **Step 1: 写失败的测试**

Create `tests/SmartTable.batch.test.ts`:
```ts
// @vitest-environment jsdom
// 批量栏 #batch(规格 §3 / §5.2 / §6 第 5 条):出现条件、「已选 N 项 / 取消选择」、clear()、两种写法、与工具栏同一 min-height
import { afterEach, describe, expect, it, vi } from 'vitest'
import { h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import SmartTable from '../src/SmartTable.vue'
import Toolbar from '../src/Toolbar.vue'
import { defaultLabels, zhCNLabels } from '../src/labels'
import type { SmartTableColumn } from '../src/types'

interface Row {
  id: number
  name: string
}
const rows: Row[] = [
  { id: 1, name: 'alice' },
  { id: 2, name: 'bob' },
  { id: 3, name: 'carol' },
]
// 泛型传 unknown(与 tests/SmartTable.test.ts 一致),否则 mount 会把 T 推成 unknown 报 TS2322
const withSel: SmartTableColumn<unknown>[] = [{ type: 'selection' }, { key: 'name', title: 'Name' }]
const noSel: SmartTableColumn<unknown>[] = [{ key: 'name', title: 'Name' }]

const batchSlot = (p: { checkedRowKeys: Array<string | number>; clear: () => void }) =>
  h('button', { class: 'host-batch-btn', onClick: p.clear }, `批量处理 ${p.checkedRowKeys.length}`)

function mountTable(attrs: Record<string, unknown>, columns = withSel, slots: Record<string, unknown> | null = { batch: batchSlot }) {
  return mount(SmartTable, {
    props: { columns, data: rows, rowKey: 'id', pagination: false },
    attrs,
    ...(slots ? { slots: slots as never } : {}),
  })
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('批量栏出现条件(四个条件全满足)', () => {
  it('全满足:有 selection 列 + 传了 #batch + 绑了 checked-row-keys + 有勾选 → 出现,「已选 N 项」取 labels.selectedCount', () => {
    const w = mountTable({ checkedRowKeys: [1, 2] })
    expect(w.find('.smart-table-batch').exists()).toBe(true)
    expect(w.find('.smart-table-batch-info').text()).toBe('2 selected') // 英文默认
    expect(w.find('.host-batch-btn').text()).toBe('批量处理 2') // #batch 插槽拿到 checkedRowKeys
  })

  it('kebab-case 写法(checked-row-keys)同样认', () => {
    const w = mountTable({ 'checked-row-keys': [3] })
    expect(w.find('.smart-table-batch').exists()).toBe(true)
  })

  it('文案跟 labels:中文包 → 「已选 2 项」「取消选择」', () => {
    const w = mount(SmartTable, {
      props: { columns: withSel, data: rows, rowKey: 'id', pagination: false, labels: zhCNLabels },
      attrs: { checkedRowKeys: [1, 2] },
      slots: { batch: batchSlot as never },
    })
    expect(w.find('.smart-table-batch-info').text()).toBe('已选 2 项')
    expect(w.text()).toContain('取消选择')
  })

  it.each([
    ['没有 selection 列', { columns: noSel, attrs: { checkedRowKeys: [1] }, slots: { batch: batchSlot } }],
    ['没传 #batch 插槽', { columns: withSel, attrs: { checkedRowKeys: [1] }, slots: null }],
    ['宿主没绑 checked-row-keys(库不持有勾选态,没绑就没有批量栏)', { columns: withSel, attrs: {}, slots: { batch: batchSlot } }],
    ['绑了但没有勾选(空数组)', { columns: withSel, attrs: { checkedRowKeys: [] }, slots: { batch: batchSlot } }],
  ])('缺一个条件 → 没有批量栏,工具栏原样:%s', (_name, c) => {
    const w = mountTable(c.attrs, c.columns as SmartTableColumn<unknown>[], c.slots as Record<string, unknown> | null)
    expect(w.find('.smart-table-batch').exists()).toBe(false)
    expect(w.find('.smart-table-toolbar').exists()).toBe(true)
  })

  it('宿主改了 checked-row-keys → 批量栏随之出现 / 更新 / 消失(attrs 非响应式,靠宿主重渲染)', async () => {
    const keys = ref<number[]>([])
    const w = mount({
      render: () =>
        h(SmartTable as never, { columns: withSel, data: rows, rowKey: 'id', pagination: false, checkedRowKeys: keys.value }, { batch: batchSlot }),
    })
    expect(w.find('.smart-table-batch').exists()).toBe(false)
    keys.value = [1]
    await nextTick()
    expect(w.find('.smart-table-batch-info').text()).toBe('1 selected')
    keys.value = [1, 2, 3]
    await nextTick()
    expect(w.find('.smart-table-batch-info').text()).toBe('3 selected')
    keys.value = []
    await nextTick()
    expect(w.find('.smart-table-batch').exists()).toBe(false)
  })
})

describe('批量栏的替换范围与 clear()', () => {
  it('替换「标题 + 业务按钮 + 更多」,内置图标(列设置)留在右侧;「更多」随之不显示', () => {
    const w = mount(SmartTable, {
      props: { columns: withSel, data: rows, rowKey: 'id', pagination: false, title: '人员', toolbar: { more: [{ label: '导出', key: 'x' }] } },
      attrs: { checkedRowKeys: [1] },
      slots: { batch: batchSlot as never, 'toolbar-right': '<i class="host-add">新增</i>' },
    })
    expect(w.find('.smart-table-title').exists()).toBe(false)
    expect(w.find('.host-add').exists()).toBe(false)
    expect(w.html()).not.toContain('aria-label="More"')
    expect(w.html()).toContain('aria-label="Columns"') // 列设置图标仍在
  })

  it('「取消选择」→ 宿主的 onUpdate:checkedRowKeys 收到 ([], [], { action: "uncheckAll" })(载荷同官方)', async () => {
    const spy = vi.fn()
    const w = mountTable({ checkedRowKeys: [1, 2], 'onUpdate:checkedRowKeys': spy })
    const clearBtn = w.findAll('.smart-table-batch button').find((b) => b.text() === 'Clear selection')!
    await clearBtn.trigger('click')
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith([], [], { row: undefined, action: 'uncheckAll' })
  })

  it('插槽的 clear() 与「取消选择」同一个出口;两个官方写法宿主绑了哪个就调哪个(各 1 次)', async () => {
    const a = vi.fn()
    const b = vi.fn()
    const w = mountTable({ checkedRowKeys: [1], 'onUpdate:checkedRowKeys': a, onUpdateCheckedRowKeys: b })
    await w.find('.host-batch-btn').trigger('click')
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
  })

  it('宿主只绑了 checked-row-keys、没绑更新回调(只读)→ clear() 是空操作,不抛错', async () => {
    const w = mountTable({ checkedRowKeys: [1] })
    await expect(w.find('.host-batch-btn').trigger('click')).resolves.toBeUndefined()
    expect(w.find('.smart-table-batch').exists()).toBe(true)
  })
})

describe('批量栏的「本页全选」复选框(原型 .bt-info:本页可勾行全勾上 = 选中,其余 = 半选)', () => {
  // NCheckbox 的真实 DOM:选中 / 半选态是根上的 class
  const box = (w: ReturnType<typeof mountTable>) => w.find('.smart-table-batch-info .n-checkbox')

  it('本页行全勾上 → 选中;只勾了一部分 → 半选;本页一行没勾、只勾着别页的 → 也是半选(已选数是跨页总数)', () => {
    expect(box(mountTable({ checkedRowKeys: [1, 2, 3] })).classes()).toContain('n-checkbox--checked')
    const part = box(mountTable({ checkedRowKeys: [1] }))
    expect(part.classes()).toContain('n-checkbox--indeterminate')
    expect(part.classes()).not.toContain('n-checkbox--checked')
    const other = box(mountTable({ checkedRowKeys: [99] })) // 99 不在当前数据里(别页)
    expect(other.classes()).toContain('n-checkbox--indeterminate')
  })

  it('点半选的复选框 → 并入本页所有可勾行(已选的保留),载荷同官方表头全选:([...], rows, { row: undefined, action: "checkAll" })', async () => {
    const spy = vi.fn()
    const w = mountTable({ checkedRowKeys: [99, 1], 'onUpdate:checkedRowKeys': spy })
    await box(w).trigger('click')
    expect(spy).toHaveBeenCalledTimes(1)
    const [keys, rowsArg, meta] = spy.mock.calls[0]
    expect(keys).toEqual([99, 1, 2, 3])
    expect((rowsArg as Row[]).map((r) => r.id)).toEqual([1, 2, 3]) // 官方只给得出本页已知的行
    expect(meta).toEqual({ row: undefined, action: 'checkAll' })
  })

  it('点选中的复选框 → 去掉本页的键、别页的已选保留:action = uncheckAll', async () => {
    const spy = vi.fn()
    const w = mountTable({ checkedRowKeys: [99, 1, 2, 3], 'onUpdate:checkedRowKeys': spy })
    await box(w).trigger('click')
    expect(spy).toHaveBeenCalledWith([99], [], { row: undefined, action: 'uncheckAll' })
  })

  it('selection 列的 disabled 行不参与:本页可勾行 = 1、3,全选后是 [1, 3];只勾了这两行也算「全勾上」', async () => {
    const cols: SmartTableColumn<unknown>[] = [{ type: 'selection', disabled: (r: Row) => r.id === 2 }, { key: 'name', title: 'Name' }]
    const spy = vi.fn()
    const w = mountTable({ checkedRowKeys: [1], 'onUpdate:checkedRowKeys': spy }, cols)
    await box(w).trigger('click')
    expect(spy.mock.calls[0][0]).toEqual([1, 3])
    expect(box(mountTable({ checkedRowKeys: [1, 3] }, cols)).classes()).toContain('n-checkbox--checked')
  })

  it('本地分页:「本页」= 当前页的行(每页 2 行,第 1 页 = 行 1、2);勾上 1、2 → 选中,第 3 行(第 2 页)不影响', async () => {
    const w = mount(SmartTable, {
      props: { columns: withSel, data: rows, rowKey: 'id', pagination: { pageSize: 2 } },
      attrs: { checkedRowKeys: [1, 2] },
      slots: { batch: batchSlot as never },
    })
    expect(box(w as never).classes()).toContain('n-checkbox--checked')
  })
})

describe('Toolbar 批量栏与工具栏同一 min-height(勾选不让表格跳动)', () => {
  class RO {
    static all: RO[] = []
    constructor(private cb: () => void) {
      RO.all.push(this)
    }
    observe() {}
    unobserve() {}
    disconnect() {}
    fire() {
      this.cb()
    }
  }

  it('非批量态记录工具栏行的实测高度;切到批量态后根元素 min-height = 该高度,切回后去掉', async () => {
    vi.stubGlobal('ResizeObserver', RO)
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ height: 34 } as DOMRect)
    const w = mount(Toolbar, { props: { labels: defaultLabels, config: {}, density: 'compact' as const } })
    expect(w.attributes('style') ?? '').not.toContain('min-height')

    await w.setProps({ batch: { count: 2, checked: false, indeterminate: true } })
    expect(w.attributes('style')).toContain('min-height: 34px')

    // 批量态下 ResizeObserver 触发不会把批量栏自己的高度当成「工具栏高度」
    rect.mockReturnValue({ height: 80 } as DOMRect)
    RO.all.forEach((r) => r.fire())
    await nextTick()
    expect(w.attributes('style')).toContain('min-height: 34px')

    await w.setProps({ batch: null })
    expect(w.attributes('style') ?? '').not.toContain('min-height')
    rect.mockRestore()
    vi.unstubAllGlobals()
  })
})
```

- [ ] **Step 2: 跑,确认失败**

Run: `npx vitest run tests/SmartTable.batch.test.ts`
Expected: FAIL —— `Test Files  1 failed (1)`、`Tests  14 failed | 4 passed (18)`(批量栏还不存在,只有 4 条「缺一个条件 → 没有批量栏」的用例碰巧通过)。

- [ ] **Step 3: 实现**

**3a. `src/types.ts`:`SmartTableLabels` 末尾加两个可选键**
```diff
--- a/src/types.ts
+++ b/src/types.ts
@@ -461,6 +461,11 @@
   filterCannotCollapse?: string
   filterClearAll?: string
   filterRestoreDefault?: string
+  /* ---- 3.0 P1:批量栏 ---- */
+  /** 批量栏「已选 N 项」,含 {n} 占位(已选键数,跨页总数)。 */
+  selectedCount?: string
+  /** 批量栏「取消选择」。 */
+  clearSelection?: string
 }
 
 /* ======================== 持久化存储结构 ======================== */
```

**3b. `src/labels.ts`:英文默认与 `zhCNLabels` 各加两个键**
```diff
--- a/src/labels.ts
+++ b/src/labels.ts
@@ -51,6 +51,8 @@
   filterCannotCollapse: 'Contains conditions checkboxes cannot show',
   filterClearAll: 'Clear all',
   filterRestoreDefault: 'Restore defaults',
+  selectedCount: '{n} selected',
+  clearSelection: 'Clear selection',
 }
 
 /**
@@ -103,6 +105,8 @@
   filterCannotCollapse: '含勾选无法表达的条件',
   filterClearAll: '清除全部',
   filterRestoreDefault: '恢复默认',
+  selectedCount: '已选 {n} 项',
+  clearSelection: '取消选择',
 }
 
 /** 三层合并:内置英文 < 全局默认(global)< 实例 prop(partial)。结果是 Required 形状(缺的键已由英文默认补齐)。 */
```

**3c. `src/Toolbar.vue`:批量栏(替换左半段、复选框、取消选择、与工具栏同一 `min-height`)**

要点:① `batch` 非空时左半段换成「复选框 + 已选 N 项」「`#batch` 插槽」「取消选择」,业务组整个 `div.smart-table-toolbar-actions` 不渲染(所以「更多」也不见),**图标组留着**;② 根元素的 `min-height` = 非批量态时量到的工具栏行高(`ResizeObserver` 在批量态下不更新它,所以批量栏自己的高度不会被当成「工具栏高度」);jsdom / SSR 没有 `ResizeObserver` 时不设 `min-height`;③ 内容贴顶(`align-items: flex-start`),与原型一致。
```diff
--- a/src/Toolbar.vue
+++ b/src/Toolbar.vue
@@ -1,9 +1,12 @@
 <script setup lang="ts">
 // 表格卡片头:标题 + 左侧操作区(#left)+ 右侧:宿主按钮(#right)、「更多」菜单、内置图标(刷新/密度/列设置 #settings)。
-import { computed, type PropType } from 'vue'
-import { NButton, NConfigProvider, NDropdown, NTooltip, useThemeVars } from 'naive-ui'
+// 批量栏(P1):有勾选时原地替换「标题 + 宿主按钮 + 更多」那一段,变成「已选 N 项 + #batch 插槽 + 取消选择」;
+// 内置图标组留在右侧。批量栏的 min-height = 勾选前工具栏的实测高度(同一个根元素,勾选不让表格跳动)。
+import { computed, onBeforeUnmount, onMounted, ref, type PropType } from 'vue'
+import { NButton, NCheckbox, NConfigProvider, NDropdown, NTooltip, useThemeVars } from 'naive-ui'
 import type { DropdownOption } from 'naive-ui'
 import type { Density, SmartTableLabels, ToolbarConfig, ToolbarMoreOption } from './types'
+import { fmt } from './labels'
 import { ChevronDownIcon, DensityIcon, RefreshIcon } from './icons'
 
 const props = defineProps({
@@ -14,14 +17,40 @@
   density: { type: String as PropType<Density>, required: true },
   /** 远程模式(传了 fetcher)。静态数据模式下刷新什么都不做,所以不显示刷新按钮。 */
   remote: { type: Boolean, default: true },
+  /**
+   * 批量栏:非 null 时替换左半段。count = 已选键数(跨页总数);checked / indeterminate = 「本页全选」复选框的状态
+   * (原型 .bt-info:本页行全勾上 = 选中,否则 = 半选)。出现条件由 SmartTable 判断(有 selection 列、传了 #batch、宿主绑了 checked-row-keys、且有勾选)。
+   */
+  batch: { type: Object as PropType<{ count: number; checked: boolean; indeterminate: boolean } | null>, default: null },
 })
 
 const emit = defineEmits<{
   refresh: []
   'update:density': [d: Density]
   moreSelect: [key: string | number, option: DropdownOption]
+  clearSelection: []
+  /** 批量栏的「本页全选」复选框:true = 勾上本页所有可勾行,false = 取消本页(其它页的勾选保留)。 */
+  toggleAll: [checked: boolean]
 }>()
 
+// 批量栏的 min-height:只在「不是批量态」时记录工具栏行的实测高度;批量态沿用最近一次的值。
+// jsdom / SSR 没有 ResizeObserver 时不设 min-height(退化成内容自然高度)。
+const rootRef = ref<HTMLElement | null>(null)
+const normalHeight = ref(0)
+let resizeObserver: ResizeObserver | null = null
+function measureNormal() {
+  if (props.batch || !rootRef.value) return
+  normalHeight.value = Math.round(rootRef.value.getBoundingClientRect().height)
+}
+onMounted(() => {
+  measureNormal()
+  if (typeof ResizeObserver === 'undefined' || !rootRef.value) return
+  resizeObserver = new ResizeObserver(measureNormal)
+  resizeObserver.observe(rootRef.value)
+})
+onBeforeUnmount(() => resizeObserver?.disconnect())
+const rootStyle = computed(() => (props.batch && normalHeight.value > 0 ? { minHeight: `${normalHeight.value}px` } : undefined))
+
 const themeVars = useThemeVars()
 
 const cfg = computed<ToolbarConfig>(() => (props.config === false ? { refresh: false, density: false, columnSettings: false } : props.config))
@@ -50,8 +79,22 @@
 </script>
 
 <template>
-  <div class="smart-table-toolbar">
-    <div class="smart-table-toolbar-main">
+  <div ref="rootRef" class="smart-table-toolbar" :class="{ 'smart-table-toolbar--batch': !!batch }" :style="rootStyle">
+    <!-- 批量栏:替换「标题 + 业务按钮 + 更多」;内置图标组(下面的 .smart-table-toolbar-icons)留着 -->
+    <div v-if="batch" class="smart-table-toolbar-main smart-table-batch">
+      <span class="smart-table-batch-info">
+        <n-checkbox
+          :checked="batch.checked"
+          :indeterminate="batch.indeterminate"
+          :aria-label="labels.filterSelectAll"
+          @update:checked="(v: boolean) => emit('toggleAll', v)"
+        />
+        {{ fmt(labels.selectedCount, { n: batch.count }) }}
+      </span>
+      <div class="smart-table-batch-acts"><slot name="batch" /></div>
+      <n-button quaternary @click="emit('clearSelection')">{{ labels.clearSelection }}</n-button>
+    </div>
+    <div v-else class="smart-table-toolbar-main">
       <!-- 标题取主题的 textColor1 / fontWeightStrong(与官方卡片标题一致;设计原型 .st-title:16px / 500 / textColor1)。
            走 useThemeVars,不依赖 NCard 的 --n-* 变量,换位置(如 #title 插槽放到别处)也跟着明暗主题走 -->
       <h3
@@ -65,7 +108,7 @@
     </div>
     <div class="smart-table-toolbar-right">
       <!-- 业务组:宿主按钮 + 「更多」,间距 8px(原型 .tb-actions) -->
-      <div v-if="$slots.right || moreOptions.length" class="smart-table-toolbar-actions">
+      <div v-if="!batch && ($slots.right || moreOptions.length)" class="smart-table-toolbar-actions">
         <slot name="right" />
         <n-dropdown v-if="moreOptions.length" trigger="click" placement="bottom-end" :options="moreOptions" @select="onMoreSelect">
           <!-- 默认 medium(34px),与宿主的业务按钮同高;chevron 12px、iconColor(原型 --n-text-3),右内边距 12px(chevron 自带的留白算进去) -->
@@ -159,4 +202,30 @@
 .smart-table-more-icon {
   display: inline-flex;
 }
+/* 批量栏(设计原型 .tb-batch):复选框 + 「已选 N 项」(34px 高)、宿主按钮组(间距 8)、取消选择,间距 12;内容贴第 1 行顶部(根元素 min-height 占位,
+   两行高的中档工具栏勾选后内容不往中间飘);内置图标组仍在右侧,34px 高 */
+.smart-table-toolbar--batch {
+  align-items: flex-start;
+}
+.smart-table-batch {
+  flex-wrap: wrap;
+  align-items: flex-start;
+  gap: 12px;
+}
+.smart-table-batch-info {
+  display: inline-flex;
+  align-items: center;
+  gap: 8px;
+  height: 34px;
+  font-weight: 500;
+  white-space: nowrap;
+}
+.smart-table-batch-acts {
+  display: flex;
+  align-items: center;
+  gap: 8px;
+}
+.smart-table-toolbar--batch .smart-table-toolbar-icons {
+  height: 34px;
+}
 </style>
```

**3d. `src/SmartTable.vue`:插槽类型、四个条件、`clear()`、「本页全选」**

要点:① `checked-row-keys` 在 `attrs` 里(camelCase / kebab-case 两种写法都认),`attrs` 不是响应式的,所以 `hostCheckedKeys()` 是普通函数、在模板里每次渲染调用(宿主改了勾选键 → 重渲染 → 重新读);② `clearChecked()` 向 `onUpdate:checkedRowKeys` 和 `onUpdateCheckedRowKeys` 各报一次 `([], [], { row: undefined, action: 'uncheckAll' })`(载荷同官方;官方已弃用的 `onCheckedRowKeysChange` 不管);宿主只读(没绑回调)时是空操作;③ 复选框的状态与原型一致:本页可勾行全勾上 = 选中,**其余一律半选**(「已选 N 项」是跨页总数);「本页」= 远程的当前页 / 本地过滤后按 `localPage` + 每页条数切出来的一页 / `pagination: false` 的全部行,`selection` 列写了 `disabled` 的行不算(与官方表头全选一致)。
```diff
--- a/src/SmartTable.vue
+++ b/src/SmartTable.vue
@@ -39,6 +39,7 @@
   deriveInitParams,
   deriveOptionsSources,
   deriveSearchDefs,
+  isSpecialColumn,
   useColumns,
   type FilterDef,
 } from './useColumns'
@@ -115,6 +116,11 @@
   toolbar?: () => any
   /** 工具栏右侧,内置按钮之前 */
   'toolbar-right'?: () => any
+  /**
+   * 批量栏:有勾选时原地替换工具栏左半段(标题 / 业务按钮 / 更多)。「已选 N 项」与「取消选择」由库内置。
+   * 出现条件(全部满足):有 selection 列、传了本插槽、宿主绑了 checked-row-keys、且至少勾了一行。
+   */
+  batch?: (props: { checkedRowKeys: Array<string | number>; clear: () => void }) => any
   empty?: () => any
   /** 分页栏左侧 */
   'pagination-prefix'?: (info: PaginationInfo) => any
@@ -519,6 +525,69 @@
 const showToolbar = computed(
   () => props.toolbar !== false || !!props.title || !!slots.title || !!slots.toolbar,
 )
+
+/* ---- 批量栏(#batch) ---- */
+
+const hasSelectionColumn = computed(() => props.columns.some((c) => isSpecialColumn(c) && c.type === 'selection'))
+
+/**
+ * 宿主绑的勾选键。库不持有勾选态(读 attrs);attrs 不是响应式的,所以这是个普通函数,在模板里每次渲染调用
+ * (宿主改了 checked-row-keys → 重渲染 SmartTable → 这里重新读)。camelCase / kebab-case 两种写法都认。
+ */
+function hostCheckedKeys(): Array<string | number> | null {
+  const v = attrs.checkedRowKeys ?? attrs['checked-row-keys']
+  return Array.isArray(v) ? (v as Array<string | number>) : null
+}
+
+/** 当前页的行(批量栏的「本页全选」用):远程 = 当前页;本地 = 过滤后的数据按 localPage / 每页条数切一页;pagination: false = 全部。 */
+const pageRows = computed<Record<string, any>[]>(() => {
+  const all = tableData.value
+  if (isRemote.value || props.pagination === false) return all
+  const size = (typeof props.pagination === 'object' && props.pagination.pageSize) || localPageSize.value
+  const page = Math.min(localPage.value, Math.max(1, Math.ceil(all.length / size)))
+  return all.slice((page - 1) * size, page * size)
+})
+/** 本页可勾选的行(selection 列写了 disabled 的行不算,与官方表头全选一致)。 */
+const checkablePageRows = computed(() => {
+  const sel = props.columns.find((c) => isSpecialColumn(c) && c.type === 'selection') as { disabled?: (row: any) => boolean } | undefined
+  return sel?.disabled ? pageRows.value.filter((r) => !sel.disabled!(r)) : pageRows.value
+})
+
+/**
+ * 批量栏状态:四个条件全满足才非 null。「本页全选」复选框与原型一致:本页可勾行全勾上 = 选中,其余一律半选
+ * (已选数是跨页总数,勾着别页的行而本页一行没勾时也是半选)。
+ */
+function batchState(): { count: number; checked: boolean; indeterminate: boolean } | null {
+  if (!slots.batch || !hasSelectionColumn.value) return null
+  const keys = hostCheckedKeys()
+  if (!keys || keys.length === 0) return null
+  const set = new Set(keys)
+  const page = checkablePageRows.value
+  const all = page.length > 0 && page.every((r) => set.has(rowKeyFn.value(r as T)))
+  return { count: keys.length, checked: all, indeterminate: !all }
+}
+
+/** 「本页全选」:true = 并入本页所有可勾行的键(已选的其它页保留),false = 去掉本页的键;载荷同官方表头全选 `(keys, rows, { row: undefined, action })`。 */
+function toggleAllPage(checked: boolean) {
+  const cur = hostCheckedKeys() ?? []
+  const pageKeys = checkablePageRows.value.map((r) => rowKeyFn.value(r as T))
+  const next = checked ? [...cur, ...pageKeys.filter((k) => !cur.includes(k))] : cur.filter((k) => !pageKeys.includes(k))
+  const nextRows = pageRows.value.filter((r) => next.includes(rowKeyFn.value(r as T)))
+  for (const name of ['onUpdate:checkedRowKeys', 'onUpdateCheckedRowKeys']) {
+    callAll(attrs[name], next, nextRows, { row: undefined, action: checked ? 'checkAll' : 'uncheckAll' })
+  }
+}
+
+/**
+ * 「取消选择」/ 插槽的 clear():向宿主绑的更新回调报告「全部取消」(`v-model:checked-row-keys` / `@update:checked-row-keys` 编译出的
+ * `onUpdate:checkedRowKeys`,与官方另一个未弃用的写法 `onUpdateCheckedRowKeys`;官方已弃用的 `onCheckedRowKeysChange` 不管;载荷形状同官方
+ * `(keys, rows, { row, action })`)。宿主只绑了 checked-row-keys 没绑更新回调(只读)时是空操作。
+ */
+function clearChecked() {
+  for (const name of ['onUpdate:checkedRowKeys', 'onUpdateCheckedRowKeys']) {
+    callAll(attrs[name], [], [], { row: undefined, action: 'uncheckAll' })
+  }
+}
 const settingsEnabled = computed(
   () => props.toolbar !== false && (typeof props.toolbar === 'object' ? props.toolbar.columnSettings !== false : true),
 )
@@ -775,11 +844,17 @@
         :config="props.toolbar ?? {}"
         :density="columnsApi.density.value"
         :remote="isRemote"
+        :batch="batchState()"
         @refresh="refresh"
         @more-select="(k, o) => emit('moreSelect', k, o)"
         @update:density="columnsApi.setDensity"
+        @clear-selection="clearChecked"
+        @toggle-all="toggleAllPage"
       >
         <template v-if="slots.title" #title><slot name="title" /></template>
+        <template v-if="slots.batch" #batch>
+          <slot name="batch" :checked-row-keys="hostCheckedKeys() ?? []" :clear="clearChecked" />
+        </template>
         <template v-if="slots.toolbar" #left><slot name="toolbar" /></template>
         <template v-if="slots['toolbar-right']" #right><slot name="toolbar-right" /></template>
         <template v-if="settingsEnabled" #settings>
```

**3e. playground:批量栏场景页(Task 3 再扩成「批量 / 放大」)**

Create `playground/DemoMax.vue`:
```vue
<script setup lang="ts">
// 批量栏的场景页(P1 Task 1 的浏览器验证用;Task 3 会把它扩成「批量 / 放大」):
// 勾选行 → 工具栏原位变成批量栏(#batch);取消选择 / 插槽的 clear()
import { ref } from 'vue'
import { NButton, useMessage } from 'naive-ui'
import { SmartTable, type SmartTableColumn } from '../src/index'
import { mockPage, type DemoRow } from './mock'
import { labels } from './locale'

const message = useMessage()
const checked = ref<Array<string | number>>([])

const columns: SmartTableColumn<DemoRow>[] = [
  { type: 'selection', fixed: 'left' },
  { key: 'account', title: '账号', width: 140, search: true, filter: true, sorter: true },
  { key: 'name', title: '姓名', width: 120, search: true, filter: true },
  { key: 'email', title: 'Email', minWidth: 220 },
  { key: 'salary', title: '薪资', width: 120, align: 'right', format: 'money', sorter: true },
]
</script>

<template>
  <SmartTable
    v-model:checked-row-keys="checked"
    :columns="columns"
    :fetcher="mockPage"
    title="批量栏"
    :labels="labels"
    :toolbar="{ more: [{ label: '导出', key: 'export' }, { label: '导入', key: 'import' }] }"
    :default-page-size="100"
    :pagination="{ simple: true, pageSizes: [20, 100] }"
    row-key="id"
    resizable
    @more-select="(k) => message.info(`more: ${String(k)}`)"
  >
    <template #toolbar-right><NButton size="small" type="primary">新增</NButton></template>
    <template #batch="{ checkedRowKeys, clear }">
      <NButton size="small" data-testid="batch-export" @click="message.info(`导出 ${checkedRowKeys.length} 项`)">批量导出</NButton>
      <NButton size="small" type="error" ghost data-testid="batch-del" @click="() => { message.warning(`删除 ${checkedRowKeys.length} 项`); clear() }">批量删除</NButton>
    </template>
  </SmartTable>
</template>
```

`playground/App.vue` 加页签:
```diff
--- a/playground/App.vue
+++ b/playground/App.vue
@@ -7,6 +7,7 @@
 import DemoCrud from './DemoCrud.vue'
 import DemoAbsorb from './DemoAbsorb.vue'
 import DemoFill from './DemoFill.vue'
+import DemoMax from './DemoMax.vue'
 import { locale, tt } from './locale'
 import { mockState } from './mock'
 
@@ -41,6 +42,7 @@
           <n-tab-pane name="crud" :tab="'CRUD'"><DemoCrud /></n-tab-pane>
           <n-tab-pane name="absorb" tab="列宽余量"><DemoAbsorb /></n-tab-pane>
           <n-tab-pane name="fill" tab="铺满"><DemoFill /></n-tab-pane>
+          <n-tab-pane name="max" tab="批量 / 放大"><DemoMax /></n-tab-pane>
         </n-tabs>
       </div>
     </n-message-provider>
```

- [ ] **Step 4: 跑,确认通过**

Run: `npm test && npm run typecheck`
Expected: `Test Files  25 passed (25)`、`Tests  422 passed (422)`(基线 + 18:本 Task 的 18 条);typecheck 无输出;无 `[Vue warn]`。**既有测试一条都不能变红**(本 Task 没有「有意翻转」)。

- [ ] **Step 5: 浏览器验证(批量栏本身)**

Run: `bash .sandbox/p1/_kit/vite-up.sh`,打开 `http://localhost:5193/`,切到页签「批量 / 放大」(1440 × 900,浅色),按顺序做并读数(控制台或 CDP 的 `Runtime.evaluate`):
1. 记 `before = document.querySelector('.smart-table-toolbar').getBoundingClientRect().height`(沙盒实测 **34**)、`thead th` 的 `y`(Task 3 扩完场景页后的最终态是 **315.6**,Task 1 的场景页没有后面加的宿主控件,绝对值会小一些,**以前后相等为准**)。
2. 点第 1、2 行的勾选框 → 出现 `.smart-table-batch`;`.smart-table-toolbar` 高度**仍是 34**、`thead th` 的 `y` **与第 1 步相同**(勾选不让表格跳动)。
3. `.smart-table-batch-info` 的文字是 `已选 2 项`;点它里面的复选框 → 变成 `已选 100 项`(本页 100 行)且复选框是选中态(`.n-checkbox--checked`);再点 → 本页取消、批量栏消失;重新勾两行。
4. 批量栏里**没有**标题、「新增」「更多」,**有**「批量导出」「批量删除」(宿主的 `#batch`)与「取消选择」;右侧图标组(刷新 / 列设置)仍在。
5. 点「取消选择」→ 回到普通工具栏,高度 / 表头 `y` 仍不变,行的勾选被清掉;点「批量删除」(插槽里调 `clear()`)同样清掉。
6. 视口改 390 宽,勾一行:`.smart-table-toolbar` 的 `scrollWidth ≤ clientWidth`(沙盒实测 **308 / 308**)。

上面的 1–6(外加放大相关的几项)沙盒里已写成脚本 `_kit/tools/batch1.mjs`(Task 3 之后才能整条跑,因为它里面有「批量栏下点放大」),**15 项全部 PASS**。**不通过就停下来,不要往下做。**

- [ ] **Step 6: 提交**

```bash
git add src/types.ts src/labels.ts src/Toolbar.vue src/SmartTable.vue tests/SmartTable.batch.test.ts playground/DemoMax.vue playground/App.vue
git commit -m "feat: 批量栏 #batch(本页全选 + 已选 N 项 + 取消选择,与工具栏同高)" -m "新能力、默认不出现:有 selection 列 + 传了 #batch + 宿主绑了 checked-row-keys + 有勾选才替换工具栏左半段;clear() 向宿主的 onUpdate:checkedRowKeys 报 uncheckAll(载荷同官方);本页全选复选框与原型一致(本页全勾上 = 选中,其余 = 半选)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---


### Task 2: 放大的纯逻辑与按钮(`maximize.ts`、`useEscClose.ts`、工具栏「放大」按钮)

> 规格 §5.2 / §6.1、设计 7.2:放大 = 表格在页面内最大化(`position: fixed` 铺满 + Teleport 到 `body`),**不调用浏览器全屏 API**。本 Task 只做**无 UI 的可测内核**与工具栏上的按钮(状态在 Task 3 的 `SmartTable`)。内核全部写成 jsdom 可单测的函数:配置解析(R-9 的 z-index 入口)、背景滚动锁定(引用计数)、键盘 / 鼠标输入方式追踪、「此刻有没有打开的浮层」探测(Esc 分层的前提)、Tab 循环。**官方事实(本地核对)**:`NPopover` 不处理键盘;`NDropdown` 只有焦点在菜单里才响应 Esc(点开「更多」后焦点还在按钮上,按 Esc 没有反应);vueuc 的 follower 外壳在关闭后**不卸载**(里面的菜单被 `v-show` 成 `display: none`,或壳里已没有子元素);tooltip 的类名是 `.n-popover.n-tooltip`(鼠标停在按钮上它一直开着,算进「浮层」会让 Esc 永远还原不了);naive 的动态浮层 z-index 从 2000 起(`vdirs` 的 `zindexable`),所以放大层默认 1999。

**Files:**
- Create: `src/maximize.ts`、`src/useEscClose.ts`、`tests/maximize.test.ts`、`tests/useEscClose.test.ts`
- Modify: `src/types.ts`、`src/labels.ts`、`src/icons.ts`、`src/Toolbar.vue`、`src/ColumnSettings.vue`、`src/FilterChips.vue`、`tests/Toolbar.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `Toolbar`(`batch` prop、右侧图标组)、`labels` 的 `selectedCount` 那一段。
- Produces:
  - `ToolbarConfig.maximize?: boolean | { zIndex?: number }`;`SmartTableLabels.maximize?` / `restore?`(可选;英文 `Maximize` / `Restore`,中文 `放大` / `还原`)。
  - `maximize.ts`:`DEFAULT_MAXIMIZE_Z = 1999`;`resolveMaximize(cfg): { enabled: boolean; zIndex: number }`;`lockScroll()` / `unlockScroll()`(引用计数,0→1 记 `html` 原 `overflow`,1→0 还原);`trackInputModality(): () => void`(捕获阶段挂 `keydown` / `pointerdown`,引用计数,返回释放函数)与 `isKeyboardModality(): boolean`;`FLOAT_SELECTOR`、`hasOpenFloat(doc?): boolean`;`FOCUSABLE`、`loopTab(e, layer): boolean`。
  - `useEscClose(show: Ref<boolean>): void`:弹层打开期间 `document` 冒泡阶段 Esc 关闭(跳过输入法组词、已 `preventDefault` 的 Esc)。
  - `Toolbar` props:`maximizable: boolean`、`maximized: boolean`;emit `toggleMaximize()`;`defineExpose({ focusMaximize })`;「更多」与密度下拉改成受控(`v-model:show`),好让 Esc 能关。放大按钮 = **图标组的第一个**(规格 §5.2 顺序:业务按钮 · 更多 · 放大 · 刷新 · 列设置);图标组的显示条件把 `maximizable` 算进去。
  - `icons.ts`:`MaximizeIcon`(四角括号向外)、`RestoreIcon`(向内)——与原型 `I_EXPAND` / `I_COMPRESS` 同几何。

- [ ] **Step 1: 写失败的测试**

Create `tests/maximize.test.ts`:
```ts
// @vitest-environment jsdom
// 放大(toolbar.maximize)的无 UI 辅助:配置解析、滚动锁定(引用计数、还原原值)、输入方式追踪、浮层探测(Esc 分层的依据)、Tab 循环
import { afterEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_MAXIMIZE_Z,
  hasOpenFloat,
  isKeyboardModality,
  lockScroll,
  loopTab,
  resolveMaximize,
  trackInputModality,
  unlockScroll,
} from '../src/maximize'

afterEach(() => {
  document.body.innerHTML = ''
  document.documentElement.style.overflow = ''
})

describe('resolveMaximize', () => {
  it('未传 / false → 关闭;true → 开启且层级 1999(低于 naive 浮层的 2000);{ zIndex } → 开启且用宿主给的值', () => {
    expect(resolveMaximize(undefined)).toEqual({ enabled: false, zIndex: DEFAULT_MAXIMIZE_Z })
    expect(resolveMaximize(false)).toEqual({ enabled: false, zIndex: DEFAULT_MAXIMIZE_Z })
    expect(resolveMaximize(true)).toEqual({ enabled: true, zIndex: 1999 })
    expect(resolveMaximize({ zIndex: 3000 })).toEqual({ enabled: true, zIndex: 3000 })
  })
  it('{} / zIndex 不是有限数 → 开启,层级取默认', () => {
    expect(resolveMaximize({})).toEqual({ enabled: true, zIndex: 1999 })
    expect(resolveMaximize({ zIndex: Number.NaN })).toEqual({ enabled: true, zIndex: 1999 })
    expect(resolveMaximize({ zIndex: undefined })).toEqual({ enabled: true, zIndex: 1999 })
  })
})

describe('滚动锁定:html { overflow: hidden },引用计数,退出还原原值', () => {
  it('锁定 → hidden;解锁 → 还原宿主原来的 overflow(不是简单清空)', () => {
    document.documentElement.style.overflow = 'scroll'
    lockScroll()
    expect(document.documentElement.style.overflow).toBe('hidden')
    unlockScroll()
    expect(document.documentElement.style.overflow).toBe('scroll')
  })

  it('锁两次、解一次:仍锁着;全部解开才还原(两张表 / 重复调用不会提前解锁)', () => {
    lockScroll()
    lockScroll()
    unlockScroll()
    expect(document.documentElement.style.overflow).toBe('hidden')
    unlockScroll()
    expect(document.documentElement.style.overflow).toBe('')
  })

  it('多解锁不抛错、不把计数减成负数(之后再锁一次仍然生效)', () => {
    expect(() => unlockScroll()).not.toThrow()
    lockScroll()
    expect(document.documentElement.style.overflow).toBe('hidden')
    unlockScroll()
  })
})

describe('输入方式追踪(只有键盘操作才把焦点还给按钮)', () => {
  it('keydown → 键盘;pointerdown → 鼠标;没有任何输入时是 false', () => {
    const release = trackInputModality()
    expect(isKeyboardModality()).toBe(false)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    expect(isKeyboardModality()).toBe(true)
    document.dispatchEvent(new Event('pointerdown'))
    expect(isKeyboardModality()).toBe(false)
    release()
  })

  it('引用计数:两个使用者,释放一个仍在追踪;全部释放后监听摘除、状态复位', () => {
    const a = trackInputModality()
    const b = trackInputModality()
    a()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }))
    expect(isKeyboardModality()).toBe(true) // b 还在
    b()
    expect(isKeyboardModality()).toBe(false) // 复位
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }))
    expect(isKeyboardModality()).toBe(false) // 监听已摘除
    b() // 重复释放是空操作
  })
})

describe('hasOpenFloat(Esc 分层:有浮层就让浮层自己处理 Esc,没有才还原)', () => {
  const follower = (inner: string) => {
    const el = document.createElement('div')
    el.className = 'v-binder-follower-content'
    el.innerHTML = inner
    document.body.appendChild(el)
    return el
  }

  it('没有任何浮层 → false', () => {
    expect(hasOpenFloat()).toBe(false)
  })

  it('打开的气泡 / 下拉(follower 里有可见内容)→ true', () => {
    follower('<div class="n-popover">panel</div>')
    expect(hasOpenFloat()).toBe(true)
  })

  it('关闭后留下的壳不算:空壳(无子元素),或里面的菜单被 v-show 成 display:none', () => {
    follower('')
    follower('<div class="n-dropdown-menu" style="display: none">x</div>')
    expect(hasOpenFloat()).toBe(false)
  })

  it('Tooltip 不算(鼠标停在按钮上它一直开着,算了会让 Esc 永远还原不了)', () => {
    follower('<div class="n-popover n-tooltip">提示</div>')
    expect(hasOpenFloat()).toBe(false)
  })

  it('Drawer / Modal 容器里有内容 → true(它们自己处理 Esc)', () => {
    const d = document.createElement('div')
    d.className = 'n-drawer-container'
    d.innerHTML = '<div class="n-drawer">x</div>'
    document.body.appendChild(d)
    expect(hasOpenFloat()).toBe(true)
  })
})

describe('loopTab(放大层 role=dialog aria-modal:Tab 不掉回被盖住的宿主页面)', () => {
  function layerWith(n: number) {
    const layer = document.createElement('div')
    layer.innerHTML = Array.from({ length: n }, (_, i) => `<button id="b${i}">b${i}</button>`).join('')
    document.body.appendChild(layer)
    return { layer, btn: (i: number) => layer.querySelector<HTMLElement>(`#b${i}`)! }
  }
  const tab = (shiftKey = false) => new KeyboardEvent('keydown', { key: 'Tab', shiftKey, cancelable: true })

  it('最后一个控件上 Tab → 回到第一个(preventDefault)', () => {
    const { layer, btn } = layerWith(3)
    btn(2).focus()
    const e = tab()
    expect(loopTab(e, layer)).toBe(true)
    expect(e.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(btn(0))
  })

  it('第一个控件上 Shift+Tab → 去最后一个', () => {
    const { layer, btn } = layerWith(3)
    btn(0).focus()
    const e = tab(true)
    expect(loopTab(e, layer)).toBe(true)
    expect(document.activeElement).toBe(btn(2))
  })

  it('焦点在放大层之外(Teleport 搬 DOM 后落到 body)时 Shift+Tab 也拉回最后一个', () => {
    const { layer, btn } = layerWith(2)
    ;(document.activeElement as HTMLElement | null)?.blur()
    expect(loopTab(tab(true), layer)).toBe(true)
    expect(document.activeElement).toBe(btn(1))
  })

  it('中间的控件上 Tab / 非 Tab 键 / 层里没有可聚焦元素 → 不处理', () => {
    const { layer, btn } = layerWith(3)
    btn(1).focus()
    expect(loopTab(tab(), layer)).toBe(false)
    expect(loopTab(new KeyboardEvent('keydown', { key: 'a' }), layer)).toBe(false)
    const empty = document.createElement('div')
    document.body.appendChild(empty)
    expect(loopTab(tab(), empty)).toBe(false)
  })
})
```

Create `tests/useEscClose.test.ts`:
```ts
// @vitest-environment jsdom
// useEscClose:弹层打开期间 document 上的 Esc 把它关掉(NPopover / NDropdown 本身不管键盘)
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref, type Ref } from 'vue'
import { mount } from '@vue/test-utils'
import { useEscClose } from '../src/useEscClose'

function host() {
  let show!: Ref<boolean>
  const C = defineComponent({
    setup() {
      show = ref(false)
      useEscClose(show)
      return () => h('div')
    },
  })
  const w = mount(C)
  return { w, show: () => show }
}
const press = (init: KeyboardEventInit = { key: 'Escape' }) =>
  document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }))

afterEach(() => vi.restoreAllMocks())

describe('useEscClose', () => {
  it('打开期间 Esc 关闭;没打开时不监听(不拦别人的 Esc)', async () => {
    const add = vi.spyOn(document, 'addEventListener')
    const { w, show } = host()
    expect(add.mock.calls.filter((c) => c[0] === 'keydown')).toHaveLength(0) // 没打开:没有监听
    show().value = true
    await nextTick()
    expect(add.mock.calls.filter((c) => c[0] === 'keydown')).toHaveLength(1)
    press()
    expect(show().value).toBe(false)
    w.unmount()
  })

  it('其它键、输入法组词中的 Esc、已被别人 preventDefault 的 Esc 都不关', async () => {
    const { w, show } = host()
    show().value = true
    await nextTick()
    press({ key: 'Enter' })
    press({ key: 'Escape', isComposing: true })
    document.addEventListener('keydown', (e) => e.preventDefault(), { once: true, capture: true })
    press()
    expect(show().value).toBe(true)
    w.unmount()
  })

  it('关闭后摘掉监听;卸载时摘掉监听', async () => {
    const remove = vi.spyOn(document, 'removeEventListener')
    const { w, show } = host()
    show().value = true
    await nextTick()
    show().value = false
    await nextTick()
    expect(remove.mock.calls.filter((c) => c[0] === 'keydown').length).toBeGreaterThanOrEqual(1)
    show().value = true
    await nextTick()
    const before = remove.mock.calls.filter((c) => c[0] === 'keydown').length
    w.unmount()
    expect(remove.mock.calls.filter((c) => c[0] === 'keydown').length).toBeGreaterThan(before)
  })
})
```

`tests/Toolbar.test.ts`:补 `nextTick` 的 import,末尾追加放大按钮用例:
```diff
--- a/tests/Toolbar.test.ts
+++ b/tests/Toolbar.test.ts
@@ -1,6 +1,6 @@
 // @vitest-environment jsdom
 import { describe, expect, it } from 'vitest'
-import { defineComponent, h } from 'vue'
+import { defineComponent, h, nextTick } from 'vue'
 import { mount } from '@vue/test-utils'
 import Toolbar from '../src/Toolbar.vue'
 import { defaultLabels } from '../src/labels'
@@ -146,3 +146,51 @@
     expect(mountToolbar(false).find('.smart-table-toolbar-icons').exists()).toBe(false)
   })
 })
+
+describe('Toolbar 放大按钮(toolbar.maximize,状态在 SmartTable)', () => {
+  it('默认没有;maximizable 才出现,文字 / aria 取 labels.maximize,点了发 toggleMaximize', async () => {
+    expect(mountToolbar().html()).not.toContain('Maximize')
+    const w = mountToolbar({}, { maximizable: true })
+    const btn = w.find('button[aria-label="Maximize"]')
+    expect(btn.exists()).toBe(true)
+    expect(btn.attributes('aria-pressed')).toBe('false')
+    await btn.trigger('click')
+    expect(w.emitted('toggleMaximize')).toHaveLength(1)
+  })
+
+  it('放大态:名称变「Restore」,aria-pressed = true', () => {
+    const w = mountToolbar({}, { maximizable: true, maximized: true })
+    const btn = w.find('button[aria-label="Restore"]')
+    expect(btn.exists()).toBe(true)
+    expect(btn.attributes('aria-pressed')).toBe('true')
+    expect(w.find('button[aria-label="Maximize"]').exists()).toBe(false)
+  })
+
+  it('顺序:宿主按钮 · 更多 · 放大 · 刷新(规格 §5.2);批量态下放大按钮仍在(图标区不被替换)', () => {
+    const w = mount(Toolbar, {
+      props: { labels: defaultLabels, config: { more: [{ label: '导出', key: 'x' }] } as never, density: 'compact' as const, maximizable: true },
+      slots: { right: '<i class="host-btn">新增</i>' },
+    })
+    const html = w.html()
+    const order = ['host-btn', 'aria-label="More"', 'aria-label="Maximize"', 'aria-label="Refresh"'].map((k) => html.indexOf(k))
+    expect(order.every((i) => i >= 0)).toBe(true)
+    expect([...order].sort((a, b) => a - b)).toEqual(order)
+    const batch = mountToolbar({}, { maximizable: true, batch: { count: 1, checked: false, indeterminate: true } })
+    expect(batch.find('button[aria-label="Maximize"]').exists()).toBe(true)
+  })
+
+  it('「更多」下拉受控:打开后 document 上的 Esc 能关(NDropdown 只有焦点在菜单里才响应 Esc)', async () => {
+    const w = mount(Toolbar, {
+      props: { labels: defaultLabels, config: { more: [{ label: '导出', key: 'x' }] } as never, density: 'compact' as const },
+      attachTo: document.body,
+    })
+    const dd = w.findComponent(NDropdown)
+    ;(dd.props('onUpdate:show') as (v: boolean) => void)(true)
+    await nextTick()
+    expect(dd.props('show')).toBe(true)
+    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
+    await nextTick()
+    expect(dd.props('show')).toBe(false)
+    w.unmount()
+  })
+})
```

- [ ] **Step 2: 跑,确认失败**

Run: `npx vitest run tests/maximize.test.ts tests/useEscClose.test.ts tests/Toolbar.test.ts`
Expected: FAIL —— `Test Files  3 failed (3)`、`Tests  4 failed | 16 passed (20)`(`maximize.test.ts` / `useEscClose.test.ts` 因模块不存在整个文件加载失败、没有用例被收集;`Toolbar.test.ts` 里新增的 4 条红)。

- [ ] **Step 3: 实现**

**3a. 类型与文案**
```diff
--- a/src/types.ts
+++ b/src/types.ts
@@ -253,6 +253,12 @@
   /** 是否显示「密度」按钮;默认 false(3.0 起密度交给宿主的个人设置经 defaultDensity 传入)。传 true 时存储里的密度优先。 */
   density?: boolean
   columnSettings?: boolean // 默认 true
+  /**
+   * 「放大」按钮:表格在页面内最大化(fixed 铺满视口 + Teleport 到 body,盖住宿主的侧栏 / 顶栏;不调用浏览器全屏 API)。默认关闭。
+   * `true` = 层级默认 1999(刻意低于 naive 浮层的 2000,所以放大后列头气泡 / 抽屉 / 下拉仍显示在它上面);
+   * `{ zIndex }` = 宿主顶栏层级更高时调大(≥ 2000 会盖住表格自己的气泡,开发期会警告一次)。
+   */
+  maximize?: boolean | { zIndex?: number }
 }
 
 export interface SmartTableProps<T = any> {
@@ -466,6 +472,10 @@
   selectedCount?: string
   /** 批量栏「取消选择」。 */
   clearSelection?: string
+  /* ---- 3.0 P1:放大 ---- */
+  /** 「放大」按钮的名称 / 提示;放大后变成 restore。 */
+  maximize?: string
+  restore?: string
 }
 
 /* ======================== 持久化存储结构 ======================== */
```
```diff
--- a/src/labels.ts
+++ b/src/labels.ts
@@ -53,6 +53,8 @@
   filterRestoreDefault: 'Restore defaults',
   selectedCount: '{n} selected',
   clearSelection: 'Clear selection',
+  maximize: 'Maximize',
+  restore: 'Restore',
 }
 
 /**
@@ -107,6 +109,8 @@
   filterRestoreDefault: '恢复默认',
   selectedCount: '已选 {n} 项',
   clearSelection: '取消选择',
+  maximize: '放大',
+  restore: '还原',
 }
 
 /** 三层合并:内置英文 < 全局默认(global)< 实例 prop(partial)。结果是 Required 形状(缺的键已由英文默认补齐)。 */
```

**3b. 图标**
```diff
--- a/src/icons.ts
+++ b/src/icons.ts
@@ -46,6 +46,9 @@
 export const ChevronDownIcon = smallIcon(['m4 6 4 4 4-4'], 1.8)
 export const CloseIcon = smallIcon(['M4 4l8 8M12 4l-8 8'], 1.8)
 export const PlusIcon = smallIcon(['M8 3v10M3 8h10'], 1.6)
+// 放大 = 四角括号向外展开,还原 = 向内收拢(用户选定的方案 B;只有折线、没有箭头;与「复制」图标不混)
+export const MaximizeIcon = lineIcon(['M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3'])
+export const RestoreIcon = lineIcon(['M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3'])
 // 漏斗:表头过滤触发图标(实心,过滤生效时整体变主题色)
 export const FilterIcon: FunctionalComponent = () =>
   h(
```

**3c. 内核**

Create `src/maximize.ts`:
```ts
// 「放大」(toolbar.maximize,页面内最大化)的无 UI 辅助:配置解析、背景滚动锁定、输入方式追踪、浮层探测、Tab 循环。
// 全部写成可在 jsdom 单测的函数;SmartTable 只做接线(Teleport / 状态 / 事件)。设计依据:设计文档 7.2、9.2、9.7(spike s2)。
import type { ToolbarConfig } from './types'

/**
 * 放大层默认层级。刻意低于 2000:naive 的 Popover / Drawer / Modal / Select 菜单等动态浮层从 2000 起递增
 * (vdirs 的 z-index-manager:nextZIndex = 2000),放大后表格自己弹出的筛选气泡、抽屉、下拉才会显示在它上面。
 */
export const DEFAULT_MAXIMIZE_Z = 1999

export interface MaximizeOptions {
  enabled: boolean
  zIndex: number
}

/** `toolbar.maximize`:`true` / `{ zIndex }` 开启;未传 / `false` / `{ enabled... }` 之外一律关闭。 */
export function resolveMaximize(cfg: ToolbarConfig['maximize']): MaximizeOptions {
  if (cfg === true) return { enabled: true, zIndex: DEFAULT_MAXIMIZE_Z }
  if (cfg && typeof cfg === 'object') {
    const z = cfg.zIndex
    return { enabled: true, zIndex: typeof z === 'number' && Number.isFinite(z) ? z : DEFAULT_MAXIMIZE_Z }
  }
  return { enabled: false, zIndex: DEFAULT_MAXIMIZE_Z }
}

/* ---- 背景滚动锁定:放大态下滚轮打在放大层空白处,宿主页面照样会滚(spike s2 实测 scrollY 0 → 600) ---- */

let lockCount = 0
let savedOverflow = ''

/** `html { overflow: hidden }`;计数,多张表 / 重复调用只在 0 → 1 时记下原值,1 → 0 时还原原值。 */
export function lockScroll(): void {
  if (typeof document === 'undefined') return
  if (lockCount++ === 0) {
    savedOverflow = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
  }
}

export function unlockScroll(): void {
  if (typeof document === 'undefined' || lockCount === 0) return
  if (--lockCount === 0) document.documentElement.style.overflow = savedOverflow
}

/* ---- 输入方式追踪:只有键盘操作才把焦点还给「放大 / 还原」按钮(鼠标点按后再 focus() 会画出黑色焦点环,用户已反馈过) ---- */

let modalityUsers = 0
let keyboardModality = false
const onKey = () => {
  keyboardModality = true
}
const onPointer = () => {
  keyboardModality = false
}

/** 开始追踪(捕获阶段挂在 document 上,引用计数);返回释放函数。 */
export function trackInputModality(): () => void {
  if (typeof document === 'undefined') return () => undefined
  if (modalityUsers++ === 0) {
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('pointerdown', onPointer, true)
  }
  let released = false
  return () => {
    if (released) return
    released = true
    if (--modalityUsers === 0) {
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('pointerdown', onPointer, true)
      keyboardModality = false
    }
  }
}

/** 最近一次输入是键盘吗(没有任何输入时为 false)。 */
export function isKeyboardModality(): boolean {
  return keyboardModality
}

/* ---- Esc 分层:先收气泡 / 抽屉 / 下拉(它们自己处理 Esc),没有浮层了再 Esc 才还原 ---- */

/**
 * 当前有没有打开的浮层(naive 的 Popover / Select 菜单 / Dropdown / DatePicker 面板都经 vueuc Follower teleport 到 body 的
 * `.v-binder-follower-content`;Drawer / Modal 是各自的容器)。必须在 keydown 的**捕获阶段**读:冒泡阶段 NSelect / NDatePicker
 * 已先把自己关掉,读到的就是「没有浮层」,会把整张表一起还原。
 * 两种不算打开:① 关闭后留在 DOM 里的壳(vueuc 的 follower 不会随关闭卸载,实测:里面的菜单被 `v-show` 成 `display: none`,
 * 或者壳里已经没有子元素);② Tooltip(`.n-tooltip`):鼠标停在按钮上它一直开着,算进去会让 Esc 在鼠标没挪开时永远还原不了。
 */
export const FLOAT_SELECTOR = '.v-binder-follower-content, .n-drawer-container, .n-modal-container'

export function hasOpenFloat(doc: Document = document): boolean {
  for (const el of Array.from(doc.querySelectorAll<HTMLElement>(FLOAT_SELECTOR))) {
    const child = el.firstElementChild
    if (!child || child.classList.contains('n-tooltip')) continue
    if (getComputedStyle(child).display === 'none') continue
    return true
  }
  return false
}

/* ---- Tab 循环(放大层是 role=dialog aria-modal:焦点不能走回被盖住的宿主页面) ---- */

export const FOCUSABLE =
  'input:not([disabled]), button:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'

/**
 * Tab / Shift+Tab 走到放大层的首 / 尾时绕回另一端。返回是否处理了(调用方据此 preventDefault 已在此完成)。
 * 放大层 teleport 在 body 末尾,所以 Tab 走过最后一个控件会去浏览器界面(不会进宿主页面),只有 Shift+Tab 越过第一个控件会掉回宿主页面;
 * 两个方向都绕回,行为对称。浮层(筛选面板等)是 teleport 出去的,自带焦点循环,不经过这里。
 */
export function loopTab(e: KeyboardEvent, layer: HTMLElement): boolean {
  if (e.key !== 'Tab') return false
  const items = Array.from(layer.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.tabIndex >= 0)
  if (items.length === 0) return false
  const first = items[0]
  const last = items[items.length - 1]
  const cur = document.activeElement
  if (e.shiftKey && (cur === first || cur === layer || !layer.contains(cur))) {
    e.preventDefault()
    last.focus()
    return true
  }
  if (!e.shiftKey && cur === last) {
    e.preventDefault()
    first.focus()
    return true
  }
  return false
}
```

Create `src/useEscClose.ts`:
```ts
import { onBeforeUnmount, watch, type Ref } from 'vue'

/**
 * 弹层打开期间,Esc 关闭它。官方 NPopover 不管键盘;NDropdown 只有焦点在菜单里时才响应 Esc(spike 实测:点开「更多」后焦点还在按钮上,
 * Esc 没有任何反应)。库里自己的弹层(「更多」、密度、列设置、chips 的「+N」)都用它,这样「放大」的 Esc 分层才成立:
 * 先 Esc 收弹层,没有弹层了再 Esc 才还原。监听挂在 document 冒泡阶段,只在弹层打开期间存在。
 */
export function useEscClose(show: Ref<boolean>): void {
  const onKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && !e.isComposing && !e.defaultPrevented) show.value = false
  }
  watch(
    show,
    (open) => {
      if (open) document.addEventListener('keydown', onKeydown)
      else document.removeEventListener('keydown', onKeydown)
    },
    { immediate: true },
  )
  onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
}
```

**3d. 工具栏:放大按钮、「更多」/ 密度受控**
```diff
--- a/src/Toolbar.vue
+++ b/src/Toolbar.vue
@@ -7,7 +7,8 @@
 import type { DropdownOption } from 'naive-ui'
 import type { Density, SmartTableLabels, ToolbarConfig, ToolbarMoreOption } from './types'
 import { fmt } from './labels'
-import { ChevronDownIcon, DensityIcon, RefreshIcon } from './icons'
+import { useEscClose } from './useEscClose'
+import { ChevronDownIcon, DensityIcon, MaximizeIcon, RefreshIcon, RestoreIcon } from './icons'
 
 const props = defineProps({
   title: { type: String, default: undefined },
@@ -22,6 +23,9 @@
    * (原型 .bt-info:本页行全勾上 = 选中,否则 = 半选)。出现条件由 SmartTable 判断(有 selection 列、传了 #batch、宿主绑了 checked-row-keys、且有勾选)。
    */
   batch: { type: Object as PropType<{ count: number; checked: boolean; indeterminate: boolean } | null>, default: null },
+  /** 放大按钮是否显示(toolbar.maximize 开启),以及当前是否处于放大态(状态在 SmartTable)。 */
+  maximizable: { type: Boolean, default: false },
+  maximized: { type: Boolean, default: false },
 })
 
 const emit = defineEmits<{
@@ -31,8 +35,19 @@
   clearSelection: []
   /** 批量栏的「本页全选」复选框:true = 勾上本页所有可勾行,false = 取消本页(其它页的勾选保留)。 */
   toggleAll: [checked: boolean]
+  toggleMaximize: []
 }>()
 
+// 「更多」/ 密度下拉:受控,好让 Esc 能关(NDropdown 只有焦点在菜单里才响应 Esc),「放大」的 Esc 分层依赖它
+const moreShow = ref(false)
+const densityShow = ref(false)
+useEscClose(moreShow)
+useEscClose(densityShow)
+
+// Teleport 搬 DOM 会让原来聚焦的按钮失焦;键盘操作后由 SmartTable 经它把焦点还给按钮
+const maximizeBtnRef = ref<{ $el?: HTMLElement } | null>(null)
+defineExpose({ focusMaximize: () => maximizeBtnRef.value?.$el?.focus({ preventScroll: true }) })
+
 // 批量栏的 min-height:只在「不是批量态」时记录工具栏行的实测高度;批量态沿用最近一次的值。
 // jsdom / SSR 没有 ResizeObserver 时不设 min-height(退化成内容自然高度)。
 const rootRef = ref<HTMLElement | null>(null)
@@ -110,7 +125,14 @@
       <!-- 业务组:宿主按钮 + 「更多」,间距 8px(原型 .tb-actions) -->
       <div v-if="!batch && ($slots.right || moreOptions.length)" class="smart-table-toolbar-actions">
         <slot name="right" />
-        <n-dropdown v-if="moreOptions.length" trigger="click" placement="bottom-end" :options="moreOptions" @select="onMoreSelect">
+        <n-dropdown
+          v-if="moreOptions.length"
+          v-model:show="moreShow"
+          trigger="click"
+          placement="bottom-end"
+          :options="moreOptions"
+          @select="onMoreSelect"
+        >
           <!-- 默认 medium(34px),与宿主的业务按钮同高;chevron 12px、iconColor(原型 --n-text-3),右内边距 12px(chevron 自带的留白算进去) -->
           <n-button
             icon-placement="right"
@@ -126,9 +148,26 @@
         </n-dropdown>
       </div>
       <!-- 内置图标组:刷新 / 密度 / 列设置,间距 4px(原型 .tb-icons);与业务组之间 12px(原型 .tb-right) -->
-      <div v-if="showRefresh || cfg.density === true || $slots.settings" class="smart-table-toolbar-icons">
+      <div v-if="showRefresh || cfg.density === true || maximizable || $slots.settings" class="smart-table-toolbar-icons">
         <!-- 图标按钮的图标 16px(原型;官方 small 圆形按钮默认 18px)。abstract = 不多包一层 DOM;包住 #settings 插槽,列设置按钮同样生效 -->
         <n-config-provider abstract :theme-overrides="{ Button: { iconSizeSmall: '16px' } }">
+          <n-tooltip v-if="maximizable" trigger="hover">
+            <template #trigger>
+              <n-button
+                ref="maximizeBtnRef"
+                :quaternary="!maximized"
+                :secondary="maximized"
+                circle
+                size="small"
+                :aria-label="maximized ? labels.restore : labels.maximize"
+                :aria-pressed="maximized"
+                @click="emit('toggleMaximize')"
+              >
+                <template #icon><component :is="maximized ? RestoreIcon : MaximizeIcon" /></template>
+              </n-button>
+            </template>
+            {{ maximized ? labels.restore : labels.maximize }}
+          </n-tooltip>
           <n-tooltip v-if="showRefresh" trigger="hover">
             <template #trigger>
               <n-button quaternary circle size="small" :aria-label="labels.refresh" @click="emit('refresh')">
@@ -139,6 +178,7 @@
           </n-tooltip>
           <n-dropdown
             v-if="cfg.density === true"
+            v-model:show="densityShow"
             trigger="click"
             :options="densityOptions"
             @select="(k: Density) => emit('update:density', k)"
```

**3e. 列设置、chips「+N」气泡受控,Esc 可关**(放大态下的 Esc 分层要靠它:先收气泡)
```diff
--- a/src/ColumnSettings.vue
+++ b/src/ColumnSettings.vue
@@ -6,6 +6,7 @@
 import type { SmartTableLabels } from './types'
 import { canHideColumn, type SettingItem } from './useColumns'
 import { ColumnsIcon, DragIcon } from './icons'
+import { useEscClose } from './useEscClose'
 
 const props = defineProps({
   items: { type: Array as PropType<SettingItem[]>, required: true },
@@ -20,6 +21,8 @@
 }>()
 
 const themeVars = useThemeVars()
+const show = ref(false)
+useEscClose(show) // NPopover 不管键盘;放大态下的 Esc 分层要靠它(先收气泡)
 const dragFrom = ref<number | null>(null)
 const dragOver = ref<number | null>(null)
 
@@ -47,7 +50,7 @@
 </script>
 
 <template>
-  <n-popover trigger="click" placement="bottom-end" :show-arrow="false">
+  <n-popover v-model:show="show" trigger="click" placement="bottom-end" :show-arrow="false">
     <template #trigger>
       <n-tooltip trigger="hover">
         <template #trigger>
```
```diff
--- a/src/FilterChips.vue
+++ b/src/FilterChips.vue
@@ -9,6 +9,7 @@
 import { NButton, NPopover, NTag } from 'naive-ui'
 import type { SmartTableLabels } from './types'
 import { countFitting, shrinkForMore, type ChipItem } from './filterChips'
+import { useEscClose } from './useEscClose'
 
 const props = defineProps({
   items: { type: Array as PropType<ChipItem[]>, required: true },
@@ -28,6 +29,8 @@
 }>()
 
 const listRef = ref<HTMLElement | null>(null)
+const moreShow = ref(false)
+useEscClose(moreShow)
 const visible = ref(Number.POSITIVE_INFINITY)
 const measuring = ref(true)
 const shown = computed(() => (measuring.value ? props.items : props.items.slice(0, visible.value)))
@@ -105,7 +108,7 @@
       >
         {{ c.text }}
       </n-tag>
-      <n-popover v-if="hidden.length" trigger="click" placement="bottom-start">
+      <n-popover v-if="hidden.length" v-model:show="moreShow" trigger="click" placement="bottom-start">
         <template #trigger>
           <n-tag class="smart-table-chip smart-table-chip--more" role="button" tabindex="0" round size="small">
             +{{ hidden.length }}
```

- [ ] **Step 4: 跑,确认通过**

Run: `npm test && npm run typecheck`
Expected: `Test Files  27 passed (27)`、`Tests  445 passed (445)`(基线 + 18 + 23 = 沙盒 445);typecheck 无输出;无 `[Vue warn]`。

- [ ] **Step 5: 浏览器验证**:本 Task 没有(放大按钮在 Task 3 接线后才可见);Esc 与焦点的真实浏览器验证在 Task 3 Step 5。

- [ ] **Step 6: 提交**

```bash
git add src/maximize.ts src/useEscClose.ts src/types.ts src/labels.ts src/icons.ts src/Toolbar.vue src/ColumnSettings.vue src/FilterChips.vue tests/maximize.test.ts tests/useEscClose.test.ts tests/Toolbar.test.ts
git commit -m "feat: 放大的内核与工具栏按钮(配置解析 / 滚动锁定 / 输入方式追踪 / 浮层探测 / Tab 循环);库自己的气泡可用 Esc 关" -m "toolbar.maximize 形态 boolean | { zIndex }(默认 1999,刻意低于 naive 浮层的 2000);更多 / 密度 / 列设置 / chips「+N」受控,Esc 能关(NPopover 不管键盘、NDropdown 只有焦点在菜单里才响应)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---


### Task 3: 放大 —— `MaximizeLayer`、`SmartTable` 接线、Esc 分层、焦点、Teleport 落点(设计 7.2 风险 4–6)

> **Teleport 的对象是「放大层」`div.smart-table-layer`,不是根元素**:根元素留在原位给宿主页面占一个同高的位(放大前后文档高度不变,否则还原后页面滚动位置可能被夹),放大层整个搬到 `body`、`position: fixed; inset: 0; padding: 16px`,层级默认 1999、底色取官方 `NLayout` embedded 的底色。Teleport 只搬 DOM、不重新挂载,所以输入框内容 / 勾选 / 过滤态都保留;但会把表体滚动容器的 `scrollTop` 清零(spike 实测),所以切换前读、切换后还原。**不开放大的用户 DOM 与 P0 完全一致**:`MaximizeLayer` 在 `enabled` 为假时只渲染插槽(Fragment),不多一层 `div`。
> **三个容易踩的坑,各有测试**:① `MaximizeLayer` 渲染的 `div` 拿不到 `SmartTable` 的 `__scopeId`,不手动经 `scopeAttrs` 带上,放大后所有 scoped 规则(悬停图标 / 把手 / 表头内边距)全部失效;② Esc 要在**捕获阶段**读「此刻有没有浮层」(冒泡阶段 NSelect / NDatePicker 已先把自己关掉,会把整张表一起还原),筛选面板自己在捕获阶段 `stopPropagation` 的 Esc 不会冒泡到放大层;③ 放大中卸载 / 宿主把 `toolbar.maximize` 关掉要解锁滚动、摘监听。
> 判档:放大态下根元素没有尺寸,`rootWidth` 量的是放大层的内容宽(减去两侧各 16px 内边距),`ResizeObserver` 同时观察根与放大层。`fillHeight` 的映射(官方 `flex-height` + `virtual-scroll` + `min-row-height`)在放大态下**复用**:放大层是定高的,表体在卡片内滚动;宿主的 `max-height` 在放大态静默忽略(只有 `fillHeight` 才警告)。

**Files:**
- Create: `src/MaximizeLayer.ts`、`tests/SmartTable.maximize.test.ts`
- Modify: `src/SmartTable.vue`、`playground/DemoMax.vue`

**Interfaces:**
- Consumes: Task 2 的 `resolveMaximize` / `lockScroll` / `unlockScroll` / `trackInputModality` / `isKeyboardModality` / `hasOpenFloat` / `loopTab`、`Toolbar` 的 `maximizable` / `maximized` / `toggleMaximize` / `focusMaximize`。
- Produces:
  - `MaximizeLayer`(默认导出的函数式组件,名 `SmartTableLayer`):props `enabled: boolean`、`active: boolean`、`setEl: (el: HTMLElement | null) => void`;其余 attrs(class / style / role / aria-* / 事件)原样落在那层 `div` 上。
  - `SmartTable` 内部:`maxCfg`、`maximized` / `maxActive`、`layerRef`、`scopeEl()`(有放大层就是它,没有就是根元素;所有「查 DOM」的地方都走它)、`toggleMaximize()`、`holderHeight` / `holderStyle`(根元素原位的占位)、`layerStyle`、`stateClass`。
  - CSS 类:`.smart-table-layer`、`.smart-table-layer--maximized`(放大态:`display: flex; position: fixed; inset: 0; padding: 16px`)。
  - `DemoMax.vue` 的测试钩子:`data-testid` = `fill` / `transform` / `maxz` / `second` / `max-host` / `host-topbar` / `hostbar` / `second-table` / `batch-export` / `batch-del`(浏览器脚本用)。

- [ ] **Step 1: 写失败的测试**

Create `tests/SmartTable.maximize.test.ts`:
```ts
// @vitest-environment jsdom
// 放大(toolbar.maximize)接线:Teleport 到 body、层级、滚动锁定、Esc 分层、键盘才还焦点、与 fillHeight 同一套映射
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { NDataTable } from 'naive-ui'
import SmartTable from '../src/SmartTable.vue'
import type { SmartTableColumn } from '../src/types'

interface Row {
  id: number
  name: string
}
const rows: Row[] = [
  { id: 1, name: 'alice' },
  { id: 2, name: 'bob' },
]
const columns: SmartTableColumn<unknown>[] = [{ key: 'name', title: 'Name' }]

const mounted: VueWrapper[] = []
function mountTable(toolbar: unknown = { maximize: true }, extra: Record<string, unknown> = {}) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const w = mount(SmartTable, {
    props: { columns, data: rows, rowKey: 'id', pagination: false, search: false, toolbar: toolbar as never, ...extra },
    attachTo: host,
  })
  mounted.push(w)
  return w
}
const layer = () => document.querySelector<HTMLElement>('.smart-table-layer')!
const maxBtn = () => document.querySelector<HTMLElement>('button[aria-label="Maximize"], button[aria-label="Restore"]')
const isMaximized = () => !!document.querySelector('.smart-table-layer--maximized')
const press = (key: string) => document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
const flush = async () => {
  await nextTick()
  await nextTick()
}

// 放大态映射官方 virtual-scroll:vueuc 的 VirtualList 在 setup 里读 window.matchMedia,jsdom 没有(同 fillHeight 的用例)
beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }))
})

afterEach(() => {
  while (mounted.length) mounted.pop()!.unmount()
  document.body.innerHTML = ''
  document.documentElement.style.overflow = ''
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('toolbar.maximize 默认关闭(新增能力,不改变默认:DOM 也与没有这个能力时一致)', () => {
  it('不传 / false:没有按钮;没有放大层这一层 div(根元素的直接子节点就是搜索卡片 / 表格卡片)', () => {
    for (const toolbar of [{}, { maximize: false }]) {
      const w = mountTable(toolbar)
      expect(maxBtn()).toBeNull()
      expect(document.querySelector('.smart-table-layer')).toBeNull()
      expect([...w.element.children].some((c) => c.classList.contains('smart-table-card'))).toBe(true)
      w.unmount()
      mounted.pop()
    }
  })

  it('toolbar: false 也没有按钮', () => {
    mountTable(false)
    expect(maxBtn()).toBeNull()
  })

  it('开了但没放大:放大层在根元素里(display: contents,对布局透明),没有 dialog 语义', () => {
    const w = mountTable()
    expect(layer().parentElement).toBe(w.element)
    expect(layer().getAttribute('role')).toBeNull()
    expect(layer().classList.contains('smart-table-layer--maximized')).toBe(false)
  })
})

describe('放大 / 还原', () => {
  it('放大层带着与根元素相同的 scoped 属性(data-v-*):它由 MaximizeLayer 渲染,不手动带上的话放大后所有 scoped 样式(悬停图标 / 把手 / 表头内边距)都失效', async () => {
    const w = mountTable()
    const scopeOf = (el: Element) => [...el.attributes].map((a) => a.name).find((n) => n.startsWith('data-v-'))
    const rootScope = scopeOf(w.element)
    expect(rootScope).toBeTruthy()
    expect(scopeOf(layer())).toBe(rootScope) // 未放大时
    maxBtn()!.click()
    await flush()
    expect(layer().parentElement).toBe(document.body)
    expect(scopeOf(layer())).toBe(rootScope) // 放大后(已搬到 body)
  })

  it('点按钮:放大层被搬到 body、fixed 铺满、role=dialog aria-modal、层级 1999;根元素原位留同高占位;html 滚动被锁', async () => {
    const w = mountTable()
    expect(maxBtn()!.getAttribute('aria-label')).toBe('Maximize')
    maxBtn()!.click()
    await flush()
    const l = layer()
    expect(l.parentElement).toBe(document.body)
    expect(l.classList.contains('smart-table-layer--maximized')).toBe(true)
    expect(l.getAttribute('role')).toBe('dialog')
    expect(l.getAttribute('aria-modal')).toBe('true')
    expect(l.style.zIndex).toBe('1999')
    expect(l.style.background).not.toBe('') // 底色取主题变量,不是透明
    expect(document.documentElement.style.overflow).toBe('hidden')
    expect(w.element.getAttribute('style')).toContain('min-height') // 占位,宿主页面的文档高度不变
    expect(maxBtn()!.getAttribute('aria-label')).toBe('Restore')
    expect(maxBtn()!.getAttribute('aria-pressed')).toBe('true')
  })

  it('再点一次:放大层回到根元素里,滚动锁定还原宿主原来的 overflow,占位去掉', async () => {
    document.documentElement.style.overflow = 'scroll'
    const w = mountTable()
    maxBtn()!.click()
    await flush()
    maxBtn()!.click()
    await flush()
    expect(layer().parentElement).toBe(w.element)
    expect(isMaximized()).toBe(false)
    expect(document.documentElement.style.overflow).toBe('scroll')
    expect(w.element.getAttribute('style') ?? '').not.toContain('min-height')
  })

  it('{ zIndex } 可配置(宿主顶栏层级更高时);< 2000 不警告', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    mountTable({ maximize: { zIndex: 1500 } })
    maxBtn()!.click()
    await flush()
    expect(layer().style.zIndex).toBe('1500')
    expect(warn).not.toHaveBeenCalled()
  })

  it('zIndex ≥ 2000 会盖住表格自己的气泡:开发期警告,每个实例一次(与 max-height 警告同口径)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    mountTable({ maximize: { zIndex: 3000 } })
    maxBtn()!.click()
    await flush()
    maxBtn()!.click()
    await flush()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0][0])).toContain('toolbar.maximize.zIndex')
  })

  it('放大态复用 fillHeight 的映射:表体在卡片内滚动(flex-height + virtual-scroll),还原后去掉;宿主 max-height 在放大态被忽略', async () => {
    const w = mountTable({ maximize: true }, { maxHeight: 300 })
    const flex = () => w.findComponent(NDataTable).props('flexHeight')
    expect(flex()).toBeFalsy()
    maxBtn()!.click()
    await flush()
    expect(flex()).toBe(true)
    expect(w.findComponent(NDataTable).props('virtualScroll')).toBe(true)
    expect(w.findComponent(NDataTable).props('maxHeight')).toBeUndefined()
    maxBtn()!.click()
    await flush()
    expect(flex()).toBeFalsy()
    expect(w.findComponent(NDataTable).props('maxHeight')).toBe(300) // 还原后宿主的 max-height 回来
  })

  it('宿主把 toolbar.maximize 关掉:自动还原并解锁', async () => {
    const w = mountTable()
    maxBtn()!.click()
    await flush()
    await w.setProps({ toolbar: {} })
    await flush()
    expect(isMaximized()).toBe(false)
    expect(document.documentElement.style.overflow).toBe('')
  })

  it('放大中被卸载(路由切换):解除滚动锁定,摘掉 document 上的 keydown 监听', async () => {
    const w = mountTable()
    maxBtn()!.click()
    await flush()
    const remove = vi.spyOn(document, 'removeEventListener')
    w.unmount()
    mounted.pop()
    expect(document.documentElement.style.overflow).toBe('')
    expect(remove.mock.calls.filter((c) => c[0] === 'keydown').length).toBeGreaterThanOrEqual(2) // 捕获 + 冒泡各一个(另有输入方式追踪)
    expect(document.querySelector('.smart-table-layer')).toBeNull() // body 上不留残骸
  })
})

describe('Esc 分层:先收浮层,没有浮层了再 Esc 才还原', () => {
  it('没有浮层:Esc 还原', async () => {
    mountTable()
    maxBtn()!.click()
    await flush()
    press('Escape')
    await flush()
    expect(isMaximized()).toBe(false)
  })

  it('有浮层(气泡 / 下拉 / 抽屉)时 Esc 不还原;浮层关掉后再 Esc 才还原', async () => {
    mountTable()
    maxBtn()!.click()
    await flush()
    const float = document.createElement('div')
    float.className = 'v-binder-follower-content'
    float.innerHTML = '<div class="n-popover">panel</div>'
    document.body.appendChild(float)
    press('Escape') // 浮层自己处理这一下(这里没人处理,只验证放大层不抢)
    await flush()
    expect(isMaximized()).toBe(true)
    float.remove() // 浮层被 Esc 关掉了
    press('Escape')
    await flush()
    expect(isMaximized()).toBe(false)
  })

  it('浮层在捕获阶段就读:浮层自己在冒泡阶段把自己关掉(NSelect 的做法),这一下 Esc 也不能还原', async () => {
    mountTable()
    maxBtn()!.click()
    await flush()
    const float = document.createElement('div')
    float.className = 'v-binder-follower-content'
    float.innerHTML = '<div class="n-base-select-menu">menu</div>'
    document.body.appendChild(float)
    // 模拟 NSelect:在 Esc 的冒泡阶段先把自己关掉(早于放大层的监听)
    const closeSelf = () => float.remove()
    document.addEventListener('keydown', closeSelf, { once: true })
    press('Escape')
    await flush()
    expect(isMaximized()).toBe(true) // 冒泡到放大层时浮层已不在,但捕获阶段读到过它
    press('Escape')
    await flush()
    expect(isMaximized()).toBe(false)
  })

  it('筛选面板在捕获阶段处理并 stopPropagation 的 Esc,不会冒泡到放大层(整张表不还原)', async () => {
    mountTable()
    maxBtn()!.click()
    await flush()
    const panel = document.createElement('div')
    panel.addEventListener('keydown', (e) => e.stopPropagation(), true) // 与 ColumnFilter 面板同样的做法
    const input = document.createElement('input')
    panel.appendChild(input)
    document.body.appendChild(panel)
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    await flush()
    expect(isMaximized()).toBe(true)
  })

  it('没放大时 Esc 完全不管(没有 document 监听,不会误触别的 Esc)', async () => {
    const add = vi.spyOn(document, 'addEventListener')
    mountTable()
    expect(add.mock.calls.filter((c) => c[0] === 'keydown' && c[2] === true).length).toBe(1) // 只有输入方式追踪的那一个(捕获)
    press('Escape')
    await flush()
    expect(isMaximized()).toBe(false)
  })

  it('「更多」「列设置」等库自己的弹层可以用 Esc 关(NPopover / NDropdown 本身不管键盘),放大层随后才还原', async () => {
    mountTable({ maximize: true, more: [{ label: '导出', key: 'x' }] })
    maxBtn()!.click()
    await flush()
    const colBtn = document.querySelector<HTMLElement>('button[aria-label="Columns"]')!
    colBtn.click()
    await flush()
    await new Promise((r) => setTimeout(r, 60))
    expect(document.querySelector('.smart-table-colset')).not.toBeNull()
    press('Escape')
    await flush()
    expect(isMaximized()).toBe(true) // 这一下只关气泡
  })
})

describe('焦点:只有键盘操作才还给按钮(鼠标点按后再 focus 会画出黑色焦点环)', () => {
  it('键盘(keydown)后放大:焦点在按钮上', async () => {
    mountTable()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    maxBtn()!.click()
    await flush()
    expect(document.activeElement).toBe(maxBtn())
  })

  it('鼠标(pointerdown)后放大:焦点不还给按钮', async () => {
    mountTable()
    document.dispatchEvent(new Event('pointerdown'))
    maxBtn()!.click()
    await flush()
    expect(document.activeElement).not.toBe(maxBtn())
  })
})
```

- [ ] **Step 2: 跑,确认失败**

Run: `npx vitest run tests/SmartTable.maximize.test.ts`
Expected: FAIL —— `Test Files  1 failed (1)`、`Tests  17 failed | 2 passed (19)`(「默认关闭」的 2 条碰巧通过,其余因为没有放大层 / 按钮没接线而红)。

- [ ] **Step 3: 实现**

**3a. `src/MaximizeLayer.ts`**

Create `src/MaximizeLayer.ts`:
```ts
import { defineComponent, h, Teleport, type PropType } from 'vue'

/**
 * 「放大层」(toolbar.maximize):**开了才包一层 div**。
 * - 没开(`enabled: false`):只渲染插槽内容(Fragment)—— 不传 `toolbar.maximize` 的用户,DOM 与没有这个能力时完全一致;
 * - 开了、没放大:包一层 div(样式里 `display: contents`,对布局透明),在根元素里原位;
 * - 放大中(`active`):这层 div 被 Teleport 到 body,自己 `position: fixed` 铺满视口(层级 / 底色由调用方的 style 给),盖住宿主的侧栏 / 顶栏。
 *   Teleport 只搬 DOM、不重新挂载,所以组件状态(输入框内容、勾选、过滤态)保留。
 * 这层 div 的所有属性(class / style / role / aria-* / 事件)都由调用方经 attrs 传入;`setEl` 把元素交回调用方当模板 ref 用。
 * 为什么 Teleport 的对象是这一层、而不是根元素本身:根元素要留在原位给宿主页面占位(同高,放大前后文档高度不变);
 * 也因此不能靠 `container-type` 判断档位(它得在被搬走的元素上)—— SmartTable 用 JS 量放大层的宽度判档。
 */
export default defineComponent({
  name: 'SmartTableLayer',
  inheritAttrs: false,
  props: {
    enabled: { type: Boolean, default: false },
    active: { type: Boolean, default: false },
    setEl: { type: Function as PropType<(el: HTMLElement | null) => void>, default: undefined },
  },
  setup(props, { slots, attrs }) {
    return () => {
      if (!props.enabled) return slots.default?.()
      return h(Teleport, { to: 'body', disabled: !props.active }, [
        h('div', { ...attrs, ref: (el) => props.setEl?.(el as HTMLElement | null) }, slots.default?.()),
      ])
    }
  },
})
```

**3b. `src/SmartTable.vue`:放大状态、Esc 分层、焦点、滚动恢复、占位、判档;模板整体缩进一级、包进 `<MaximizeLayer>`**

下面用 `diff -w`(忽略缩进)展示:**模板里根元素 `div.smart-table` 的全部内容原样缩进一级、放进 `<MaximizeLayer>`**,没有别的结构变化;`rootRef.value?.querySelector(...)` 一律换成 `scopeEl()?.querySelector(...)`(放大后内容在根元素之外)。
```diff
--- a/src/SmartTable.vue
+++ b/src/SmartTable.vue
@@ -3,6 +3,7 @@
 // props 用运行时声明 + PropType:泛型 + 复杂导入类型下比纯类型声明稳。
 import {
   computed,
+  getCurrentInstance,
   h,
   mergeProps,
   nextTick,
@@ -17,7 +18,7 @@
   type PropType,
   type Slots,
 } from 'vue'
-import { NCard, NDataTable, NPagination } from 'naive-ui'
+import { NCard, NDataTable, NPagination, useThemeVars } from 'naive-ui'
 import type { CardProps, DataTableInst, DropdownOption, PaginationInfo, PaginationProps } from 'naive-ui'
 import type {
   Density,
@@ -48,6 +49,7 @@
 import { mergePageSizes, resolveDefaultPageSize } from './pageSize'
 import { mergeCardProps } from './cardStyle'
 import { keepCardTopVisible } from './scrollToCard'
+import { hasOpenFloat, isKeyboardModality, lockScroll, loopTab, resolveMaximize, trackInputModality, unlockScroll } from './maximize'
 import { collectSorters, deriveInitSorts, normalizeSorterEvent, sortToParams, sortTransition } from './sorts'
 import { useFilters } from './useFilters'
 import { mergeLabels } from './labels'
@@ -57,6 +59,7 @@
 import ColumnSettings from './ColumnSettings.vue'
 import ColumnFilter from './ColumnFilter.vue'
 import FilterChips from './FilterChips.vue'
+import MaximizeLayer from './MaximizeLayer'
 import { ref } from 'vue'
 import { useRowDrag } from './useRowDrag'
 
@@ -463,8 +466,9 @@
  * 官方默认 28 会让滚到底最后一行看不全。默认主题下真实行高 small 39.4 / medium 47.4 → 40 / 48。
  * 兜底 min-height 160:父容器没给定高时表体至少能看见几行。与宿主 attrs 合并时宿主优先(见下面的 tableAttrs)。
  */
+const fillOn = computed(() => props.fillHeight || maxActive.value)
 const fillProps = computed(() =>
-  props.fillHeight
+  fillOn.value
     ? {
         flexHeight: true,
         virtualScroll: true,
@@ -483,11 +487,12 @@
 let warnedMaxHeight = false
 const tableAttrs = computed(() => {
   const host = { ...forwardedAttrs.value } as Record<string, unknown>
-  if (props.fillHeight) {
+  if (fillOn.value) {
     for (const k of ['maxHeight', 'max-height']) {
       if (!(k in host)) continue
       delete host[k]
-      if (!warnedMaxHeight) {
+      // 放大态下表体高度也由放大层决定,静默忽略;只有 fillHeight 才警告(宿主需要知道)
+      if (props.fillHeight && !warnedMaxHeight) {
         warnedMaxHeight = true
         console.warn('[smart-naive-table] fillHeight 开启时表体高度由父容器决定,已忽略 max-height;请给父容器设定高。')
       }
@@ -501,11 +506,11 @@
  * 没开 → 卡片顶部已滚出视口上沿才滚回卡片顶部(只在需要时滚)。
  */
 function onPageChanged() {
-  if (props.fillHeight) {
+  if (fillOn.value) {
     tableRef.value?.scrollTo({ top: 0 })
     return
   }
-  const card = rootRef.value?.querySelector<HTMLElement>('.smart-table-card')
+  const card = scopeEl()?.querySelector<HTMLElement>('.smart-table-card')
   if (card) keepCardTopVisible(card)
 }
 
@@ -747,6 +752,114 @@
 /* ---- 行拖拽排序(sortablejs 懒加载,仅 rowDraggable 时) ---- */
 const rootRef = ref<HTMLElement | null>(null)
 
+/* ---- 放大(toolbar.maximize) ---- */
+
+const maxCfg = computed(() => resolveMaximize(typeof props.toolbar === 'object' ? props.toolbar.maximize : undefined))
+const maximized = ref(false)
+/** 放大中。宿主把 toolbar.maximize 关掉时自动回落为「未放大」(下面的 watch 负责解锁)。 */
+const maxActive = computed(() => maxCfg.value.enabled && maximized.value)
+/** 放大层(被 Teleport 搬到 body 的元素;只在开了 toolbar.maximize 时存在)。未放大时它在根元素里、display: contents,对布局透明。 */
+const layerRef = ref<HTMLElement | null>(null)
+/** 查 DOM 的范围:有放大层就是它(放大后内容不在根元素底下了),没开放大就是根元素。 */
+const scopeEl = (): HTMLElement | null => layerRef.value ?? rootRef.value
+/**
+ * 放大层的 div 由 MaximizeLayer 渲染(Teleport 作根,拿不到本组件的 scoped 属性),而下面所有 `.smart-table :deep(...)` / `.smart-table-layer` 规则都是 scoped 的:
+ * 不把本组件的 scope id 手动带上,放大(被搬到 body)后这些规则全部失效(悬停图标、把手、表头内边距……)。 */
+const scopeId = (getCurrentInstance()?.type as { __scopeId?: string } | undefined)?.__scopeId
+const scopeAttrs: Record<string, string> = scopeId ? { [scopeId]: '' } : {}
+const toolbarRef = ref<{ focusMaximize: () => void } | null>(null)
+/** 放大前根元素的高度:Teleport 走后原位留一个同高占位,宿主页面的文档高度不变(否则还原后页面滚动位置可能被夹)。 */
+const holderHeight = ref(0)
+const themeVars = useThemeVars()
+/**
+ * 放大层的底色 = 官方 NLayout embedded 的底(layout/styles/light.mjs:22 colorEmbedded = actionColor;dark.mjs:25 = bodyColor),
+ * 与宿主常用的灰底页面一致,卡片在上面分得出层次。亮 / 暗靠 baseColor 区分(亮 #FFF、暗 #000,与角标文字色同一取法)。
+ */
+const layerStyle = computed(() => {
+  if (!maxActive.value) return undefined
+  const v = themeVars.value
+  const dark = v.baseColor.toLowerCase() === '#000'
+  return { zIndex: maxCfg.value.zIndex, background: dark ? v.bodyColor : v.actionColor, color: v.textColor2 }
+})
+const holderStyle = computed(() => (maxActive.value ? { minHeight: `${holderHeight.value}px` } : undefined))
+const stateClass = computed(() => ({ 'smart-table--pinned-cols': colsPinned.value, 'smart-table--fill': fillOn.value }))
+
+/** 表体的滚动容器:虚拟滚动(fillHeight / 放大态)下是 vueuc VirtualList 的 `.v-vl`,否则是 n-scrollbar 的容器。Teleport 搬 DOM 会把它的 scrollTop 清零(spike s2 实测),切换前读、切换后还原。 */
+function bodyScroller(): HTMLElement | null {
+  return scopeEl()?.querySelector<HTMLElement>('.n-data-table-base-table-body .v-vl, .n-data-table-base-table-body .n-scrollbar-container') ?? null
+}
+
+async function toggleMaximize() {
+  if (!maxCfg.value.enabled) return
+  const top = bodyScroller()?.scrollTop ?? 0
+  if (!maximized.value) holderHeight.value = Math.round(rootRef.value?.getBoundingClientRect().height ?? 0)
+  maximized.value = !maximized.value
+  await nextTick()
+  if (top > 0) {
+    tableRef.value?.scrollTo({ top })
+    // flex-height / 虚拟滚动切换后表体要再布局一帧才有可滚动高度,补一次
+    requestAnimationFrame(() => tableRef.value?.scrollTo({ top }))
+  }
+  // 只有键盘操作才把焦点还给按钮:Teleport 搬 DOM 后按钮失焦;鼠标点的不还,否则会冒出黑色焦点环(用户已反馈过)
+  if (isKeyboardModality()) toolbarRef.value?.focusMaximize()
+}
+
+// Esc 分层:先收气泡 / 抽屉 / 下拉(它们自己处理 Esc),没有浮层了再 Esc 才还原。
+// 捕获阶段先读「此刻有没有浮层」:冒泡阶段 NSelect / NDatePicker 已把自己关掉,读到的会是「没有」,会把整张表一起还原。
+// 筛选面板自己在捕获阶段处理 Esc 并 stopPropagation(下拉展开时放行),所以冒泡到这里的 Esc 才可能是「该还原了」。
+let escHadFloat = false
+function onDocKeydownCapture(e: KeyboardEvent) {
+  if (e.key === 'Escape') escHadFloat = hasOpenFloat()
+}
+function onDocKeydown(e: KeyboardEvent) {
+  if (e.key !== 'Escape' || e.isComposing || e.defaultPrevented || escHadFloat) return
+  void toggleMaximize()
+}
+function onLayerKeydown(e: KeyboardEvent) {
+  if (maxActive.value && layerRef.value) loopTab(e, layerRef.value) // role=dialog aria-modal:Tab 在放大层内循环,不掉回被盖住的宿主页面
+}
+function bindMaxListeners() {
+  lockScroll()
+  document.addEventListener('keydown', onDocKeydownCapture, true)
+  document.addEventListener('keydown', onDocKeydown)
+}
+function unbindMaxListeners() {
+  unlockScroll()
+  document.removeEventListener('keydown', onDocKeydownCapture, true)
+  document.removeEventListener('keydown', onDocKeydown)
+}
+watch(maxActive, (on, was) => {
+  if (on) bindMaxListeners()
+  else if (was) unbindMaxListeners()
+})
+// 输入方式追踪要在「第一次点放大」之前就开始(开了 toolbar.maximize 就追踪),否则第一次是键盘还是鼠标不得而知
+let releaseModality: (() => void) | null = null
+watch(
+  () => maxCfg.value.enabled,
+  (enabled) => {
+    releaseModality?.()
+    releaseModality = enabled ? trackInputModality() : null
+  },
+  { immediate: true },
+)
+let warnedZ = false
+watch(
+  () => maxCfg.value,
+  (c) => {
+    // naive 的动态浮层从 2000 起,放大层 ≥ 2000 会盖住表格自己的筛选气泡 / 下拉
+    if (c.enabled && c.zIndex >= 2000 && !warnedZ) {
+      warnedZ = true
+      console.warn('[smart-naive-table] toolbar.maximize.zIndex ≥ 2000 会盖住表格自己的气泡 / 下拉(naive 的浮层层级从 2000 起),请调小。')
+    }
+  },
+  { immediate: true },
+)
+onBeforeUnmount(() => {
+  releaseModality?.()
+  releaseModality = null
+  if (maxActive.value) unbindMaxListeners() // 放大中被卸载(路由切换):解除滚动锁定与监听
+})
+
 /* ---- 占位列:量出容器宽度 ---- */
 
 let resizeObserver: ResizeObserver | null = null
@@ -757,8 +870,10 @@
  * 这个元素会随 tableKey 重建,所以每次测量顺手把 ResizeObserver 挪到当前这个上。
  */
 function measureHost() {
-  rootWidth.value = rootRef.value?.clientWidth ?? 0
-  const body = rootRef.value?.querySelector<HTMLElement>('.n-data-table-base-table-body') ?? null
+  // 放大态:根元素在原位只剩一个占位,宽度取放大层的内容宽(减去两侧各 16px 内边距);否则取根元素
+  const el = maxActive.value ? layerRef.value : rootRef.value
+  rootWidth.value = el ? Math.max(0, el.clientWidth - (maxActive.value ? 32 : 0)) : 0
+  const body = scopeEl()?.querySelector<HTMLElement>('.n-data-table-base-table-body') ?? null
   if (resizeObserver && body !== observedBody) {
     if (observedBody) resizeObserver.unobserve(observedBody)
     if (body) resizeObserver.observe(body)
@@ -771,6 +886,7 @@
   // SSR / 测试环境可能没有 ResizeObserver:量一次就走,占位列退化成不补(与本次改动前一致)
   if (typeof ResizeObserver !== 'undefined') resizeObserver = new ResizeObserver(() => measureHost())
   if (resizeObserver && rootRef.value) resizeObserver.observe(rootRef.value)
+  if (resizeObserver && layerRef.value) resizeObserver.observe(layerRef.value) // 放大态下根元素没有尺寸,量的是放大层
   measureHost()
 })
 
@@ -785,7 +901,7 @@
 
 const rowDrag = useRowDrag<T>({
   enabled: () => props.rowDraggable,
-  getTbody: () => rootRef.value?.querySelector<HTMLElement>('.n-data-table-tbody'),
+  getTbody: () => scopeEl()?.querySelector<HTMLElement>('.n-data-table-tbody'),
   rows: () => (isRemote.value ? rows.value : props.data) as T[] | undefined,
   handle: () => props.dragHandle,
   onSort: (e) => emit('rowDragSort', e),
@@ -820,7 +936,20 @@
 </script>
 
 <template>
-  <div ref="rootRef" class="smart-table" :class="{ 'smart-table--pinned-cols': colsPinned, 'smart-table--fill': props.fillHeight }" :style="rootStyle">
+  <div ref="rootRef" class="smart-table" :class="stateClass" :style="[rootStyle, holderStyle]">
+    <MaximizeLayer
+      v-bind="scopeAttrs"
+      :enabled="maxCfg.enabled"
+      :active="maxActive"
+      :set-el="(el) => (layerRef = el)"
+      class="smart-table smart-table-layer"
+      :class="[stateClass, { 'smart-table-layer--maximized': maxActive }]"
+      :style="[rootStyle, layerStyle]"
+      :role="maxActive ? 'dialog' : undefined"
+      :aria-modal="maxActive ? 'true' : undefined"
+      :aria-label="maxActive ? (props.title ?? mergedLabels.maximize) : undefined"
+      @keydown="onLayerKeydown"
+    >
     <SearchForm
       v-if="props.search !== false && searchDefs.length > 0"
       :fields="searchDefs"
@@ -839,16 +968,20 @@
     <n-card :bordered="true" class="smart-table-card" v-bind="mergedCardProps">
       <Toolbar
         v-if="showToolbar"
+          ref="toolbarRef"
         :title="props.title"
         :labels="mergedLabels"
         :config="props.toolbar ?? {}"
         :density="columnsApi.density.value"
         :remote="isRemote"
         :batch="batchState()"
+          :maximizable="maxCfg.enabled"
+          :maximized="maxActive"
         @refresh="refresh"
         @more-select="(k, o) => emit('moreSelect', k, o)"
         @update:density="columnsApi.setDensity"
         @clear-selection="clearChecked"
+          @toggle-maximize="toggleMaximize"
         @toggle-all="toggleAllPage"
       >
         <template v-if="slots.title" #title><slot name="title" /></template>
@@ -903,6 +1036,7 @@
         <template v-if="slots.empty" #empty><slot name="empty" /></template>
       </n-data-table>
     </n-card>
+    </MaximizeLayer>
   </div>
 </template>
 
@@ -912,6 +1046,21 @@
   flex-direction: column;
   gap: 16px;
 }
+/* 放大层(toolbar.maximize):未放大时它就在根元素里,display: contents 让它对布局透明(根的 flex 列 / gap / fillHeight 链原样生效);
+   放大后被 Teleport 到 body,自己 fixed 铺满视口(层级与底色由内联样式给)。层上同样带 .smart-table 与状态类,
+   所以下面所有 `.smart-table :deep(...)` 规则在 body 下的放大层里一样命中。 */
+.smart-table-layer {
+  display: contents;
+}
+.smart-table-layer--maximized {
+  display: flex;
+  position: fixed;
+  inset: 0;
+  box-sizing: border-box;
+  padding: 16px;
+  height: 100%;
+  min-height: 0;
+}
 /* 列宽拖拽手柄归位。Naive 默认把它放偏了:命中区 right 是 container-size/2,
    可见竖线在命中区内又 left 了 container-size/2,两次叠加 —— 那根线落在列边界左侧
    整整一个 container-size(8px)处,且只有半格高,跟列分隔线对不上。
```

**3c. playground:把 `DemoMax.vue` 扩成「批量 / 放大」场景页**(开关:`fillHeight`、祖先 `transform`、宿主假顶栏的层级、`maximize.zIndex`、第二张表)
```diff
--- a/playground/DemoMax.vue
+++ b/playground/DemoMax.vue
@@ -1,14 +1,20 @@
 <script setup lang="ts">
-// 批量栏的场景页(P1 Task 1 的浏览器验证用;Task 3 会把它扩成「批量 / 放大」):
-// 勾选行 → 工具栏原位变成批量栏(#batch);取消选择 / 插槽的 clear()
-import { ref } from 'vue'
-import { NButton, useMessage } from 'naive-ui'
+// 批量栏 + 放大 的场景页(P1 Task 1 / 3 的浏览器验证用):
+// - 勾选行 → 工具栏原位变成批量栏(#batch);取消选择 / 插槽的 clear()
+// - toolbar.maximize:宿主顶栏层级(低于 / 高于放大层)、宿主祖先带 transform(Teleport 验证)、fillHeight、同页第二张表
+import { computed, ref } from 'vue'
+import { NButton, NRadioButton, NRadioGroup, NSpace, NSwitch, useMessage } from 'naive-ui'
 import { SmartTable, type SmartTableColumn } from '../src/index'
-import { mockPage, type DemoRow } from './mock'
+import { allRows, mockPage, type DemoRow } from './mock'
 import { labels } from './locale'
 
 const message = useMessage()
 const checked = ref<Array<string | number>>([])
+const fill = ref(false)
+const transformHost = ref(false)
+const hostBarZ = ref<0 | 100 | 2500>(100)
+const maxZ = ref<'default' | 3000>('default')
+const showSecond = ref(false)
 
 const columns: SmartTableColumn<DemoRow>[] = [
   { type: 'selection', fixed: 'left' },
@@ -17,26 +23,66 @@
   { key: 'email', title: 'Email', minWidth: 220 },
   { key: 'salary', title: '薪资', width: 120, align: 'right', format: 'money', sorter: true },
 ]
+const toolbar = computed(() => ({
+  maximize: maxZ.value === 'default' ? true : { zIndex: maxZ.value },
+  more: [
+    { label: '导出', key: 'export' },
+    { label: '导入', key: 'import' },
+  ],
+}))
 </script>
 
 <template>
-  <SmartTable
-    v-model:checked-row-keys="checked"
-    :columns="columns"
-    :fetcher="mockPage"
-    title="批量栏"
-    :labels="labels"
-    :toolbar="{ more: [{ label: '导出', key: 'export' }, { label: '导入', key: 'import' }] }"
-    :default-page-size="100"
-    :pagination="{ simple: true, pageSizes: [20, 100] }"
-    row-key="id"
-    resizable
-    @more-select="(k) => message.info(`more: ${String(k)}`)"
-  >
-    <template #toolbar-right><NButton size="small" type="primary">新增</NButton></template>
-    <template #batch="{ checkedRowKeys, clear }">
-      <NButton size="small" data-testid="batch-export" @click="message.info(`导出 ${checkedRowKeys.length} 项`)">批量导出</NButton>
-      <NButton size="small" type="error" ghost data-testid="batch-del" @click="() => { message.warning(`删除 ${checkedRowKeys.length} 项`); clear() }">批量删除</NButton>
-    </template>
-  </SmartTable>
+  <div>
+    <n-space align="center" :size="16" style="margin-bottom: 12px">
+      <label><n-switch v-model:value="fill" size="small" data-testid="fill" /> fillHeight</label>
+      <label><n-switch v-model:value="transformHost" size="small" data-testid="transform" /> 宿主祖先 transform</label>
+      <label><n-switch v-model:value="showSecond" size="small" data-testid="second" /> 同页第二张表</label>
+      <n-radio-group v-model:value="hostBarZ" size="small" data-testid="hostbar">
+        <n-radio-button :value="0">无宿主顶栏</n-radio-button>
+        <n-radio-button :value="100">顶栏 z=100</n-radio-button>
+        <n-radio-button :value="2500">顶栏 z=2500</n-radio-button>
+      </n-radio-group>
+      <n-radio-group v-model:value="maxZ" size="small" data-testid="maxz">
+        <n-radio-button value="default">maximize: true</n-radio-button>
+        <n-radio-button :value="3000">zIndex: 3000</n-radio-button>
+      </n-radio-group>
+    </n-space>
+
+    <!-- 宿主顶栏:position: fixed,模拟后台的固定顶栏;放大层(1999)应盖住 z=100 的、被 z=2500 的盖住(这时要调大 zIndex) -->
+    <div
+      v-if="hostBarZ"
+      data-testid="host-topbar"
+      :style="{ position: 'fixed', top: 0, left: 0, right: 0, height: '40px', zIndex: hostBarZ, background: '#2d8cf0', color: '#fff', lineHeight: '40px', paddingLeft: '16px' }"
+    >
+      宿主顶栏(z-index {{ hostBarZ }})
+    </div>
+
+    <div :style="{ transform: transformHost ? 'translateZ(0)' : undefined, height: fill ? 'calc(100vh - 260px)' : undefined }" data-testid="max-host">
+      <SmartTable
+        v-model:checked-row-keys="checked"
+        :columns="columns"
+        :fetcher="mockPage"
+        title="批量 / 放大"
+        :labels="labels"
+        :toolbar="toolbar"
+        :fill-height="fill"
+        :default-page-size="100"
+        :pagination="{ simple: true, pageSizes: [20, 100] }"
+        row-key="id"
+        resizable
+        @more-select="(k) => message.info(`more: ${String(k)}`)"
+      >
+        <template #toolbar-right><NButton size="small" type="primary">新增</NButton></template>
+        <template #batch="{ checkedRowKeys, clear }">
+          <NButton size="small" data-testid="batch-export" @click="message.info(`导出 ${checkedRowKeys.length} 项`)">批量导出</NButton>
+          <NButton size="small" type="error" ghost data-testid="batch-del" @click="() => { message.warning(`删除 ${checkedRowKeys.length} 项`); clear() }">批量删除</NButton>
+        </template>
+      </SmartTable>
+    </div>
+
+    <div v-if="showSecond" style="margin-top: 24px" data-testid="second-table">
+      <SmartTable :columns="columns.slice(1)" :data="allRows.slice(0, 30)" :labels="labels" title="第二张表" :toolbar="{ maximize: true }" :pagination="false" :search="false" />
+    </div>
+  </div>
 </template>
```

- [ ] **Step 4: 跑,确认通过**

Run: `npm test && npm run typecheck`
Expected: `Test Files  28 passed (28)`、`Tests  464 passed (464)`(基线 + 18 + 23 + 19);typecheck 无输出;无 `[Vue warn]`。**既有测试一条都不能变红**(尤其 `SmartTable.test.ts` 里依赖 `rootRef` 的列宽 / 吸收列用例:`scopeEl()` 在没开放大时就是根元素)。

- [ ] **Step 5: 浏览器验证(Edge 无头 + CDP)**

Run: `bash .sandbox/p1/_kit/vite-up.sh`,然后 `node .sandbox/p1/_kit/tools/<脚本>.mjs`。没有沙盒时按下面的读数手动做(页签「批量 / 放大」,1440 × 900,浅色)。沙盒实测:

`max2.mjs`(Esc 分层 / 键盘焦点 / tooltip):
1. 聚焦放大按钮、键盘放大 → `maxed = true`,`document.activeElement` = 「还原」按钮且 `:focus-visible`;**鼠标点放大后焦点不落在按钮上**(不画黑色焦点环)。
2. 鼠标悬停「还原」按钮(tooltip 开着,浮层只有 `.n-popover.n-tooltip`)→ 按 Esc → `maxed = false`(tooltip 不算浮层)。
3. 放大 → 点「更多」(下拉打开)→ Esc#1:`maxed = true`(只收下拉)→ Esc#2:`maxed = false`。
4. 放大 → 点「列设置」(气泡打开)→ Esc#1:`maxed = true`(气泡进入 leave 动画)→ Esc#2:`maxed = false`。

`max3.mjs`(其余):
- **A**:放大 → 打开一个多条件过滤面板 → 展开比较符下拉:Esc#1 → 下拉收、面板仍在、放大仍在;Esc#2 → 面板关(草稿丢弃)、放大仍在;Esc#3 → 还原。
- **B**:页面先滚到 `scrollY = 90`,放大后 `scrollY` 仍是 **90**、`document.documentElement.scrollHeight` **前后相同(4375 = 4375)**、`html.style.overflow = 'hidden'`;还原后 `html.style.overflow = ''`。
- **C**(`fillHeight` 开):表体 `.v-vl` 的 `scrollTop` 设 500,放大后 **499**(≈ 500),再设 900 还原后 **900**。
- **D**:宿主祖先有 `transform` 时放大层仍是 `0,0,1440,900`(因为 Teleport 到 `body`,不受祖先 `transform` 影响;**不要**把放大层留在原位用 `fixed`)。
- **E**:宿主假顶栏 `z-index: 100` → (300, 20) 命中放大层;`z-index: 2500` → 命中顶栏(默认 1999 盖不住,符合预期);`toolbar.maximize: { zIndex: 3000 }` → 命中放大层、`getComputedStyle(layer).zIndex = 3000`。
- **F**:同页两张表,一张放大时只有 1 个放大层、`html.overflow = hidden`,还原后 `''`(引用计数)。
- **G**:放大层内可聚焦元素 32 个;最后一个上 Tab → 焦点回第一个;第一个上 Shift+Tab → 去最后一个。
- **H**:暗色放大层背景 `rgb(16, 16, 20)`(= 官方 `bodyColor`,暗)。

`batch1.mjs`(Task 1 + 本 Task 合起来):**15 项全部 PASS**(含「批量栏下点放大:放大层里仍是批量栏、已选不变」)。

**不通过就停下来,不要往下做**;跑完 `bash .sandbox/p1/_kit/vite-down.sh`。

- [ ] **Step 6: 提交**

```bash
git add src/MaximizeLayer.ts src/SmartTable.vue tests/SmartTable.maximize.test.ts playground/DemoMax.vue
git commit -m "feat: toolbar.maximize 放大(整层 Teleport 到 body、Esc 分层、键盘才还焦点、滚动恢复 / 锁定)" -m "新能力、默认不开:不开时 DOM 与 beta.1 逐节点一致(MaximizeLayer 只渲染插槽);开了才多一层 div.smart-table-layer,放大时整层搬到 body、根元素原位留同高占位;层级默认 1999(低于 naive 浮层的 2000);Esc 在捕获阶段读浮层、先收浮层再还原" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---


### Task 4: 列宽拖拽把手视觉与手势(设计 3.11、规格 §5.6、B12 后半)

> 规格 §5.6 的把手视觉整块归 P1:官方结构(`.n-data-table-resize-button`)**静止不画线**,悬停 / 拖动才出现主色竖条;热区 11px 骑在列界线上(触屏 24px);拖动时一条贯穿整表的 1px 引导线;松手后 150ms 内吞掉 click(松手落在表头上会连带触发排序——官方只在 click 落在把手内时才跳过排序,落在 `th` 其它位置不跳过);拖动开始收起已打开的过滤气泡(气泡锚在漏斗上,列宽一变就对不上)。**竖条高度 = 整个表头行**(`top: 0; bottom: -1px` 盖住 `th` 的下边线),不是规格文字里的 70%:原型当前 CSS 就是整行(`.th-resize::after { top: -1px; bottom: -1px }`)。
> **官方事实(本地核对,`data-table/src/TableParts/Header.mjs`、`ResizeButton.mjs`、`styles/index.cssr.mjs`)**:官方 `th` 是 `position: relative`、**没有 `overflow` 规则**,所以不需要像原型那样把 `th` 改成 `overflow: visible`;`th` 不构成层叠上下文(`z-index: auto`),所以**非固定列不需要递减 `z-index`**,把手 `z-index: 1` 就高于相邻的非固定 `th`;固定列的 `th` 自带 `z-index`(fixed-left 2、fixed-right 1、selection 3)且在 DOM 里更靠后,会盖住前一个固定列伸进来的那半个把手(`handle3` 实测:allfixed 的 A 列 R+3 命中的是 B 列 `th`)——所以**只给相邻的固定列**加递减(fixed-left 的前 6 列 8…3);**官方 `ResizeButton` 只监听鼠标事件**(`onMousedown` + `window` 上的 `mousemove` / `mouseup`),手指拖不动——24px 触屏热区必须配一个触摸桥接,把单指 `touchstart` / `touchmove` / `touchend` 转成同位置的合成鼠标事件(`touchstart` 里 `preventDefault`,免得浏览器随后再补发一套兼容鼠标事件、重复开始手势)。

**Files:**
- Create: `tests/SmartTable.handle.test.ts`
- Modify: `src/ColumnFilter.vue`、`src/SmartTable.vue`、`tests/ColumnFilter.test.ts`

**Interfaces:**
- Consumes: Task 3 的 `scopeEl()`(放大后把手在放大层里);P0 的 `onUnstableColumnResize` 接线(`onColumnResize` / `endResize`)、`ColumnFilter` 的 `close(focusBack)`。
- Produces:
  - `ColumnFilter` prop `closeRequest: number`(默认 0;每次变大 = 请求收起面板、**丢弃草稿**、不 emit、**不把焦点还给漏斗**——别抢走用户刚按下的把手)。
  - `SmartTable` 内部:`SWALLOW_CLICK_MS = 150`、`closePanelsTick`(拖动开始递增)、`resizeGuide`(引导线的位置)、`startResizeUi` / `moveResizeGuide` / `stopResizeUi`、`onLayerClickCapture`(根与放大层上的捕获阶段 `click`,吞 click)、`onLayerTouchstart`(触摸桥接)。
  - `body.smart-table-resizing`(拖动中的全局光标 `col-resize` 与不选中文字,非 scoped 样式块)、`.smart-table-resize-guide`。

- [ ] **Step 1: 写失败的测试**

Create `tests/SmartTable.handle.test.ts`:
```ts
// @vitest-environment jsdom
// 列宽把手的手势 UI(规格 §5.6 / 设计 3.11):拖动开始收起过滤气泡、body 光标类、贯穿整表的引导线、松手后 150ms 内吞掉 click
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { NDataTable } from 'naive-ui'
import SmartTable from '../src/SmartTable.vue'
import ColumnFilter from '../src/ColumnFilter.vue'
import type { SmartTableColumn } from '../src/types'

interface Row {
  id: number
  name: string
  code: string
}
const rows: Row[] = [
  { id: 1, name: 'alice', code: 'a' },
  { id: 2, name: 'bob', code: 'b' },
]
const columns: SmartTableColumn<unknown>[] = [
  { key: 'name', title: 'Name', width: 160, sorter: true, filter: true },
  { key: 'code', title: 'Code', width: 120 },
]

const mounted: VueWrapper[] = []
function mountTable() {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const w = mount(SmartTable, {
    props: { columns, data: rows, rowKey: 'id', resizable: true, pagination: false, search: false, toolbar: false },
    attachTo: host,
  })
  mounted.push(w)
  return w
}
/** 模拟官方在拖动每一帧调用的 onUnstableColumnResize(用同名列;getColumnWidth 给「起始宽」)。 */
const dragFrame = (w: VueWrapper, limited: number, key = 'name') =>
  (w.findComponent(NDataTable).props('onUnstableColumnResize') as (...a: unknown[]) => void)(limited, limited, { key }, () => 160)

afterEach(() => {
  while (mounted.length) mounted.pop()!.unmount()
  document.body.innerHTML = ''
  document.body.className = ''
  vi.restoreAllMocks()
})

describe('拖动开始:收起过滤气泡', () => {
  it('第一帧起各列 ColumnFilter 收到的 closeRequest 递增(一个手势只递增一次)', async () => {
    const w = mountTable()
    const before = w.findComponent(ColumnFilter).props('closeRequest') as number
    dragFrame(w, 170)
    await nextTick()
    const after = w.findComponent(ColumnFilter).props('closeRequest') as number
    expect(after).toBe(before + 1)
    dragFrame(w, 180)
    dragFrame(w, 190)
    await nextTick()
    expect(w.findComponent(ColumnFilter).props('closeRequest')).toBe(after) // 同一手势后续帧不再递增
  })
})

describe('拖动中的 body 光标类与引导线', () => {
  it('第一帧加 body.smart-table-resizing,松手(window mouseup)去掉;拖动中途卸载也要去掉', async () => {
    const w = mountTable()
    expect(document.body.classList.contains('smart-table-resizing')).toBe(false)
    dragFrame(w, 170)
    expect(document.body.classList.contains('smart-table-resizing')).toBe(true)
    window.dispatchEvent(new MouseEvent('mouseup'))
    expect(document.body.classList.contains('smart-table-resizing')).toBe(false)

    dragFrame(w, 170)
    expect(document.body.classList.contains('smart-table-resizing')).toBe(true)
    w.unmount()
    mounted.pop()
    expect(document.body.classList.contains('smart-table-resizing')).toBe(false)
  })

  it('拖动中有贯穿整表的引导线(落在被拖列的右缘 = 左缘 + 限幅后的宽度,再左移 1px 压在边线上),松手消失', async () => {
    const w = mountTable()
    expect(document.querySelector('.smart-table-resize-guide')).toBeNull()
    dragFrame(w, 200)
    await nextTick()
    const guide = document.querySelector<HTMLElement>('.smart-table-resize-guide')!
    expect(guide).not.toBeNull()
    expect(guide.style.left).toBe('199px') // jsdom 里所有 rect 都是 0:左缘 0 + 200 − 0 − 1
    expect(guide.getAttribute('aria-hidden')).toBe('true')
    dragFrame(w, 230)
    await nextTick()
    expect(guide.style.left).toBe('229px') // 跟手
    window.dispatchEvent(new MouseEvent('mouseup'))
    await nextTick()
    expect(document.querySelector('.smart-table-resize-guide')).toBeNull()
  })
})

describe('松手后 150ms 内吞掉 click(松手落在表头上会连带触发排序)', () => {
  it('松手后 150ms 内的 click 到不了 th(捕获阶段被拦);之后的 click 正常', async () => {
    const w = mountTable()
    const th = document.querySelector<HTMLElement>('thead th[data-col-key="name"]')!
    const onClick = vi.fn()
    th.addEventListener('click', onClick)

    let now = 1000
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    dragFrame(w, 200)
    window.dispatchEvent(new MouseEvent('mouseup')) // endResize:swallowClickUntil = 1000 + 150

    now = 1100
    th.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    expect(onClick).not.toHaveBeenCalled() // 100ms:吞掉

    now = 1200
    th.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    expect(onClick).toHaveBeenCalledTimes(1) // 200ms:放行
  })

  it('没有发生过拖动的普通点击不受影响(纯点击把手、没有任何 resize 帧时不吞)', () => {
    mountTable()
    const th = document.querySelector<HTMLElement>('thead th[data-col-key="name"]')!
    const onClick = vi.fn()
    th.addEventListener('click', onClick)
    th.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})

describe('触屏拖把手:官方把手只认鼠标事件,手指拖动转成合成鼠标事件', () => {
  /** jsdom 没有 Touch 构造器:造一个带 touches 的普通事件。 */
  const touch = (type: string, x: number, y = 5, fingers = 1) => {
    const ev = new Event(type, { bubbles: true, cancelable: true }) as Event & { touches: Array<{ clientX: number; clientY: number }> }
    ev.touches = Array.from({ length: fingers }, () => ({ clientX: x, clientY: y }))
    return ev
  }
  const handle = () => document.querySelector<HTMLElement>('.n-data-table-resize-button')!

  it('touchstart 落在把手上 → 把手收到 mousedown(同坐标);touchmove → window 收到 mousemove;touchend → window 收到 mouseup;touchstart 被 preventDefault', () => {
    mountTable()
    const down = vi.fn()
    const move = vi.fn()
    const up = vi.fn()
    handle().addEventListener('mousedown', down)
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)

    const start = touch('touchstart', 100)
    handle().dispatchEvent(start)
    expect(start.defaultPrevented).toBe(true)
    expect(down).toHaveBeenCalledTimes(1)
    expect((down.mock.calls[0][0] as MouseEvent).clientX).toBe(100)

    const mv = touch('touchmove', 130)
    window.dispatchEvent(mv)
    expect(mv.defaultPrevented).toBe(true) // 阻止页面跟着滚
    expect(move).toHaveBeenCalledTimes(1)
    expect((move.mock.calls[0][0] as MouseEvent).clientX).toBe(130)

    window.dispatchEvent(touch('touchend', 130, 5, 0))
    expect(up).toHaveBeenCalledTimes(1)

    // 手势结束后 touchmove 不再转发
    window.dispatchEvent(touch('touchmove', 160))
    expect(move).toHaveBeenCalledTimes(1)
    window.removeEventListener('mousemove', move)
    window.removeEventListener('mouseup', up)
  })

  it('落在把手之外的 touchstart、多指触摸:不处理(照常滚动 / 缩放)', () => {
    mountTable()
    const down = vi.fn()
    handle().addEventListener('mousedown', down)
    const th = document.querySelector<HTMLElement>('thead th')!
    const outside = touch('touchstart', 50)
    th.dispatchEvent(outside)
    expect(outside.defaultPrevented).toBe(false)
    const twoFingers = touch('touchstart', 50, 5, 2)
    handle().dispatchEvent(twoFingers)
    expect(twoFingers.defaultPrevented).toBe(false)
    expect(down).not.toHaveBeenCalled()
  })

  it('touchcancel 也收尾(发 mouseup);拖动中卸载摘掉 window 上的 touch 监听', () => {
    const w = mountTable()
    const up = vi.fn()
    window.addEventListener('mouseup', up)
    handle().dispatchEvent(touch('touchstart', 100))
    window.dispatchEvent(touch('touchcancel', 100, 5, 0))
    expect(up).toHaveBeenCalledTimes(1)

    handle().dispatchEvent(touch('touchstart', 100))
    const remove = vi.spyOn(window, 'removeEventListener')
    w.unmount()
    mounted.pop()
    expect(remove.mock.calls.map((c) => c[0])).toEqual(expect.arrayContaining(['touchmove', 'touchend', 'touchcancel']))
    window.removeEventListener('mouseup', up)
  })
})
```

`tests/ColumnFilter.test.ts` 末尾追加 `closeRequest` 用例:
```diff
--- a/tests/ColumnFilter.test.ts
+++ b/tests/ColumnFilter.test.ts
@@ -845,3 +845,41 @@
     w.unmount()
   })
 })
+
+describe('ColumnFilter closeRequest(拖动列宽开始时收起面板:气泡锚在漏斗上,列宽一变就对不上)', () => {
+  it('面板开着时 closeRequest 变大 → 面板收起、草稿丢弃(不 emit)、焦点不还给漏斗(别抢走用户刚按下的把手)', async () => {
+    const wrapper = mount(ColumnFilter, {
+      props: {
+        def: buildOptionsDef(),
+        value: null,
+        labels,
+        getOptions: () => [{ label: 'A', value: 'a' }],
+        isLoadingOptions: () => false,
+      },
+      attachTo: document.body,
+    })
+    const btn = () => wrapper.find('.smart-table-filter-trigger button')
+    await wrapper.find('.smart-table-filter-trigger').trigger('click')
+    await nextTick()
+    expect(btn().attributes('aria-expanded')).toBe('true')
+
+    await wrapper.setProps({ closeRequest: 1 })
+    await nextTick()
+    expect(btn().attributes('aria-expanded')).toBe('false')
+    expect(wrapper.emitted('update:value')).toBeUndefined()
+    expect(document.activeElement).not.toBe(btn().element)
+
+    wrapper.unmount()
+  })
+
+  it('面板没开时 closeRequest 变大什么都不做', async () => {
+    const wrapper = mount(ColumnFilter, {
+      props: { def: buildOptionsDef(), value: null, labels, getOptions: () => [], isLoadingOptions: () => false },
+      attachTo: document.body,
+    })
+    await wrapper.setProps({ closeRequest: 1 })
+    await nextTick()
+    expect(wrapper.find('.smart-table-filter-trigger button').attributes('aria-expanded')).toBe('false')
+    wrapper.unmount()
+  })
+})
```

- [ ] **Step 2: 跑,确认失败**

Run: `npx vitest run tests/SmartTable.handle.test.ts tests/ColumnFilter.test.ts`
Expected: FAIL —— `Test Files  2 failed (2)`、`Tests  7 failed | 55 passed (62)`(手势 UI / `closeRequest` / 触摸桥接都还不存在;`ColumnFilter.test.ts` 既有用例仍通过)。

- [ ] **Step 3: 实现**

**3a. `src/ColumnFilter.vue`:`closeRequest`**
```diff
--- a/src/ColumnFilter.vue
+++ b/src/ColumnFilter.vue
@@ -42,6 +42,8 @@
   dateValueFormat: { type: String, default: 'yyyy-MM-dd' },
   /** 每次变大 = 请求打开面板(已生效条件 chips 点击时用)。 */
   openRequest: { type: Number, default: 0 },
+  /** 每次变大 = 请求收起面板、丢弃草稿、不抢焦点(拖动列宽开始时用:气泡锚在漏斗上,列宽一变就对不上)。 */
+  closeRequest: { type: Number, default: 0 },
 })
 
 const emit = defineEmits<{
@@ -169,6 +171,12 @@
     if (n > 0 && n !== o) show.value = true
   },
 )
+watch(
+  () => props.closeRequest,
+  (n, o) => {
+    if (n !== o && show.value) close(false)
+  },
+)
 
 function close(focusBack: boolean) {
   returnFocus = focusBack
```

**3b. `src/SmartTable.vue`:把手的几何(CSS)、引导线、光标类、收起气泡、吞 click、触摸桥接、固定列层叠**
```diff
--- a/src/SmartTable.vue
+++ b/src/SmartTable.vue
@@ -341,6 +341,7 @@
     isLoadingOptions: options.isLoading,
     dateValueFormat: defaults.dateValueFormat,
     openRequest: openTick[def.key] ?? 0,
+    closeRequest: closePanelsTick.value,
     'onUpdate:value': (v: FilterValue | null) => filters.setFilter(def.key, v),
   })
 }
@@ -358,6 +359,84 @@
 let resizingKey: string | null = null
 let pendingWidth = 0
 
+/* ---- 列宽把手的手势 UI(规格 §5.6 / 设计 3.11):贯穿整表的引导线、拖动中的光标、开始时收起过滤气泡、松手后吞掉 click、触屏 ---- */
+
+/** 松手后这么久内的 click 一律吞掉:松手落在表头上会连带触发排序(官方只在 click 落在把手内时才跳过排序,落在 th 其它位置不跳过)。 */
+const SWALLOW_CLICK_MS = 150
+const resizeGuide = ref<{ left: number; top: number; height: number } | null>(null)
+/** 拖动开始 → 递增:各列头的过滤面板据此收起。 */
+const closePanelsTick = ref(0)
+let guideLeft0: number | null = null
+let swallowClickUntil = 0
+
+function findTh(colKey: string): HTMLElement | null {
+  const ths = Array.from(scopeEl()?.querySelectorAll<HTMLElement>('th[data-col-key]') ?? [])
+  return ths.find((th) => th.getAttribute('data-col-key') === colKey) ?? null
+}
+function startResizeUi(colKey: string) {
+  document.body.classList.add('smart-table-resizing') // 鼠标离开把手后光标仍是 col-resize、不选中文字
+  closePanelsTick.value++
+  guideLeft0 = findTh(colKey)?.getBoundingClientRect().left ?? null // 被拖列的左缘在拖动中不动,只有右缘跟着走
+}
+/** 引导线落在被拖列的右缘(= 左缘 + 限幅后的宽度),相对卡片内容区定位,纵向盖住整张表(表头 + 表体,不含分页条)。 */
+function moveResizeGuide(limitedWidth: number) {
+  if (guideLeft0 === null) return
+  const content = scopeEl()?.querySelector<HTMLElement>('.smart-table-card .n-card-content')
+  const base = scopeEl()?.querySelector<HTMLElement>('.n-data-table-base-table')
+  if (!content || !base) return
+  const c = content.getBoundingClientRect()
+  const t = base.getBoundingClientRect()
+  // 落在被拖列右缘的那条 1px 边线上(边线占 [右缘 − 1, 右缘]),所以再左移 1px
+  resizeGuide.value = { left: guideLeft0 + limitedWidth - c.left - 1, top: t.top - c.top, height: t.height }
+}
+function stopResizeUi() {
+  document.body.classList.remove('smart-table-resizing')
+  resizeGuide.value = null
+  guideLeft0 = null
+  swallowClickUntil = performance.now() + SWALLOW_CLICK_MS
+}
+/** click / touchstart 的处理函数要同时挂在根元素(没开放大时没有放大层)和放大层(放大后内容在根元素之外)上,所以都写成幂等的。 */
+function onLayerClickCapture(e: MouseEvent) {
+  if (performance.now() < swallowClickUntil) {
+    e.stopPropagation()
+    e.preventDefault()
+  }
+}
+
+/**
+ * 触屏拖把手:官方 ResizeButton 只监听鼠标事件(把手上的 onMousedown + window 上的 mousemove / mouseup),手指拖不动(实测:触屏模拟下
+ * touchStart → touchMove → touchEnd,列宽不变)。这里把「手指落在把手上」的 touchstart / touchmove / touchend 转成同位置的合成鼠标事件,
+ * 其余(官方拖拽逻辑、限幅、onUnstableColumnResize、本库的钉住 / 落账)原样走。touchstart 里 preventDefault:免得浏览器随后再补发一套兼容鼠标事件、重复开始手势。
+ */
+let touchHandle: HTMLElement | null = null
+function mouseAt(type: string, t: Touch): MouseEvent {
+  return new MouseEvent(type, { bubbles: true, cancelable: true, clientX: t.clientX, clientY: t.clientY, button: 0 })
+}
+function onWindowTouchmove(e: TouchEvent) {
+  if (!touchHandle || !e.touches[0]) return
+  e.preventDefault()
+  window.dispatchEvent(mouseAt('mousemove', e.touches[0]))
+}
+function onWindowTouchend() {
+  if (!touchHandle) return
+  touchHandle = null
+  window.removeEventListener('touchmove', onWindowTouchmove)
+  window.removeEventListener('touchend', onWindowTouchend)
+  window.removeEventListener('touchcancel', onWindowTouchend)
+  window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
+}
+function onLayerTouchstart(e: TouchEvent) {
+  if (e.defaultPrevented || touchHandle) return // 已经被另一层(根元素 / 放大层)处理过
+  const handle = (e.target as HTMLElement | null)?.closest<HTMLElement>('.n-data-table-resize-button')
+  if (!handle || e.touches.length !== 1) return
+  e.preventDefault()
+  touchHandle = handle
+  window.addEventListener('touchmove', onWindowTouchmove, { passive: false })
+  window.addEventListener('touchend', onWindowTouchend)
+  window.addEventListener('touchcancel', onWindowTouchend)
+  handle.dispatchEvent(mouseAt('mousedown', e.touches[0]))
+}
+
 /** 松手才把宽度落进列定义(整个手势只重建一次列),并清掉临时增量。 */
 function endResize() {
   if (resizingKey !== null) {
@@ -365,6 +444,7 @@
     const width = pendingWidth
     resizingKey = null
     dragDelta.value = 0
+    stopResizeUi()
     columnsApi.setWidth(key, width)
   }
 }
@@ -378,6 +458,7 @@
       // 换了一列(或新手势):先把上一列的结果落账,再钉住当前布局
       endResize()
       resizingKey = colKey
+      startResizeUi(colKey)
       columnsApi.freezeWidths(getColumnWidth as (k: string) => number | undefined)
       window.addEventListener('mouseup', endResize, { once: true })
       // 手势中途松开鼠标发生在浏览器窗口之外(拖出视口边界再放开)时,window 收不到 mouseup ——
@@ -387,6 +468,7 @@
       window.addEventListener('blur', endResize, { once: true })
     }
     pendingWidth = limitedWidth
+    moveResizeGuide(limitedWidth)
     // 拖拽期间列宽由 Naive 内部的拖拽态渲染,我们只负责让表格总宽跟上
     dragDelta.value = limitedWidth - (columnsApi.widths.value[colKey] ?? limitedWidth)
     emit('columnResize', colKey, limitedWidth)
@@ -452,6 +534,10 @@
   window.removeEventListener('mouseup', endResize)
   window.removeEventListener('blur', endResize)
   resizingKey = null
+  document.body.classList.remove('smart-table-resizing') // 拖动中被卸载:别把光标样式留在 body 上
+  window.removeEventListener('touchmove', onWindowTouchmove)
+  window.removeEventListener('touchend', onWindowTouchend)
+  window.removeEventListener('touchcancel', onWindowTouchend)
 })
 
 const rowKeyFn = computed(() => {
@@ -936,7 +1022,14 @@
 </script>
 
 <template>
-  <div ref="rootRef" class="smart-table" :class="stateClass" :style="[rootStyle, holderStyle]">
+  <div
+    ref="rootRef"
+    class="smart-table"
+    :class="stateClass"
+    :style="[rootStyle, holderStyle]"
+    @click.capture="onLayerClickCapture"
+    @touchstart="onLayerTouchstart"
+  >
     <MaximizeLayer
       v-bind="scopeAttrs"
       :enabled="maxCfg.enabled"
@@ -949,6 +1042,8 @@
       :aria-modal="maxActive ? 'true' : undefined"
       :aria-label="maxActive ? (props.title ?? mergedLabels.maximize) : undefined"
       @keydown="onLayerKeydown"
+      @click.capture="onLayerClickCapture"
+      @touchstart="onLayerTouchstart"
     >
       <SearchForm
         v-if="props.search !== false && searchDefs.length > 0"
@@ -1035,6 +1130,18 @@
         >
           <template v-if="slots.empty" #empty><slot name="empty" /></template>
         </n-data-table>
+        <!-- 拖动列宽时贯穿整张表(表头 + 表体)的引导线,落在被拖列的右缘;松手即消失 -->
+        <div
+          v-if="resizeGuide"
+          class="smart-table-resize-guide"
+          aria-hidden="true"
+          :style="{
+            left: `${resizeGuide.left}px`,
+            top: `${resizeGuide.top}px`,
+            height: `${resizeGuide.height}px`,
+            background: `color-mix(in srgb, ${themeVars.primaryColor} 55%, transparent)`,
+          }"
+        />
       </n-card>
     </MaximizeLayer>
   </div>
@@ -1061,28 +1168,83 @@
   height: 100%;
   min-height: 0;
 }
-/* 列宽拖拽手柄归位。Naive 默认把它放偏了:命中区 right 是 container-size/2,
-   可见竖线在命中区内又 left 了 container-size/2,两次叠加 —— 那根线落在列边界左侧
-   整整一个 container-size(8px)处,且只有半格高,跟列分隔线对不上。
-   这里把命中区贴到列右边缘、竖线拉满整格,与 th 的 border-right 重合。 */
+/* 列宽拖拽把手(规格 §5.6、设计 3.11):沿用官方结构(.n-data-table-resize-button),只改位置与显隐。
+   Naive 默认把它放偏了:命中区 right 是 container-size/2,可见竖线在命中区内又 left 了 container-size/2,
+   那根线落在列界左侧 8px 处,且只有半格高;静止时还画一条表格线色的细线(暗色下每个列界都冒出一截灰条)。
+   这里:热区 11px、以 th 的 border-right 为中心骑在列界线上(两侧各出约 5px,伸进右邻列的那半边也点得到);
+   竖条 3px 居中压在线上、高度 = 表头整行(top: 0 + bottom: -1px 盖住 th 的下边线);静止不画,悬停 / 拖动才显示主色。
+   z-index: 1:高于相邻的非固定 th(官方 th 是 position: relative / z-index: auto,不构成层叠上下文,所以非固定列不用递减 z-index),
+   低于固定列的 th(fixed-left 2 / fixed-right 1 且在 DOM 里更靠后 / selection 3)——非固定列的把手滑到固定列底下时不会盖到固定列表头上;
+   紧挨着固定列的非固定列,右半边被固定列盖住点不到,左半边仍可拖。th 本身没有 overflow 规则,不需要改成 visible。 */
 .smart-table :deep(.n-data-table-resize-button) {
-  right: 0;
+  right: -6px;
+  width: 11px;
+  z-index: 1;
+  touch-action: none;
 }
 .smart-table :deep(.n-data-table-resize-button::after) {
   top: 0;
-  bottom: 0;
-  left: auto;
-  right: 0;
+  bottom: -1px;
+  left: 4px;
+  right: auto;
+  width: 3px;
   height: auto;
   transform: none;
-  /* 静止时不画:表格自己有 border-right(single-line=false)时会叠成一条粗线。
-     分隔线交给表格,手柄只在悬停/拖拽时显形 —— 与 Arco 一致。 */
+  border-radius: 0;
   background-color: transparent;
+  transition:
+    background-color 0.15s,
+    box-shadow 0.15s;
 }
 .smart-table :deep(.n-data-table-resize-button:hover::after),
 .smart-table :deep(.n-data-table-resize-button--active::after) {
   background-color: var(--n-th-icon-color-active);
 }
+/* 拖动中再加一圈柔和光晕 */
+.smart-table :deep(.n-data-table-resize-button--active::after) {
+  box-shadow: 0 0 0 3px color-mix(in srgb, var(--n-th-icon-color-active) 18%, transparent);
+}
+/* 相邻的固定列:两个 sticky th 的 z-index 相同(fixed-left 都是 2)、后者在 DOM 里更靠后,会盖住前者伸进来的那半个把手(实测:
+   allfixed 的 A 列 R+3 命中的是 B 列 th)。让靠前的固定列 th 依次更高 —— 这就是「递减 z-index」,只落在固定列上、且只处理开头 6 列
+   (更靠后的相邻固定列仍只能拖左半边);非固定 th 不是层叠上下文,不需要。数值都在表头容器(z-index: 3 的层叠上下文)里,不会漏到外面。 */
+.smart-table :deep(.n-data-table-th--fixed-left:nth-child(1)) {
+  z-index: 8;
+}
+.smart-table :deep(.n-data-table-th--fixed-left:nth-child(2)) {
+  z-index: 7;
+}
+.smart-table :deep(.n-data-table-th--fixed-left:nth-child(3)) {
+  z-index: 6;
+}
+.smart-table :deep(.n-data-table-th--fixed-left:nth-child(4)) {
+  z-index: 5;
+}
+.smart-table :deep(.n-data-table-th--fixed-left:nth-child(5)) {
+  z-index: 4;
+}
+.smart-table :deep(.n-data-table-th--fixed-left:nth-child(6)) {
+  z-index: 3;
+}
+/* 触屏(没有悬停):热区加宽到 24px,竖条仍居中压在线上。官方把手只监听鼠标事件,手指拖动由上面的 onLayerTouchstart 转成合成鼠标事件。 */
+@media (hover: none) {
+  .smart-table :deep(.n-data-table-resize-button) {
+    right: -12px;
+    width: 24px;
+  }
+  .smart-table :deep(.n-data-table-resize-button::after) {
+    left: 10px;
+  }
+}
+/* 引导线:相对卡片内容区定位(位置由 JS 按被拖列的右缘算),不拦鼠标事件 */
+.smart-table-card :deep(.n-card-content) {
+  position: relative;
+}
+.smart-table-resize-guide {
+  position: absolute;
+  width: 1px;
+  z-index: 5;
+  pointer-events: none;
+}
 /* 表头「标题 + 漏斗」容器:在 Naive 内层 th 里渲染,所以要 :deep 才打得进去。 */
 .smart-table :deep(.smart-table-th) {
   display: inline-flex;
@@ -1191,3 +1353,13 @@
   flex-direction: column;
 }
 </style>
+
+<style>
+/* 列宽拖动中(SmartTable 在拖动开始 / 结束时给 body 加 / 去 smart-table-resizing):鼠标离开把手后光标仍是 col-resize、不选中文字。
+   放在非 scoped 块里:body 不在组件内。 */
+body.smart-table-resizing,
+body.smart-table-resizing * {
+  cursor: col-resize !important;
+  user-select: none !important;
+}
+</style>
```

- [ ] **Step 4: 跑,确认通过**

Run: `npm test && npm run typecheck`
Expected: `Test Files  29 passed (29)`、`Tests  474 passed (474)`(基线 + 18 + 23 + 19 + 10);typecheck 无输出;无 `[Vue warn]`。**既有测试(尤其 `SmartTable.test.ts` 里 B8 吸收列 / B12 下限的用例)一条都不能变红。**

- [ ] **Step 5: 浏览器验证(Edge 无头 + CDP,在带 `fixed` 列的表上逐列核对)**

页签「过滤 / 列宽」(`resizable`,1440 × 900,浅色)。沙盒实测(`handle1.mjs` / `handle2.mjs` / `handle3.mjs` / `touch1.mjs`):

`handle1.mjs`:
1. 几何(「账号」列):`th` 右缘 348.17、把手热区 `342.17 → 353.17`(**宽 11**);热区中心 **347.7** = `th` 右边线中心 **347.7**;热区高 38.4 / `th` 高 39.4(多 1px:盖住下边线);`z-index: 1`、`touch-action: none`;`::after`:宽 3px、`left: 4px`、`top: 0`、`bottom: -1px`。命中测试:R+3 → 把手、R−4 → 把手、R+7 → 邻列的标题、R−8 → 本列。
2. 静止时竖条 `background-color` = `rgba(0, 0, 0, 0)`;悬停 = `rgb(24, 160, 88)`(主色)。
3. 过滤气泡先打开,按下把手拖动:**第一帧起气泡收起**;引导线 `[left, top, w, h]` 每帧随被拖列的右缘同步移动(逐帧 `left` = 357.2 → 367.2 → 377.2 → …,与被拖列 `th` 右缘 357.7 → 367.7 → 377.7 → … 恒差 0.5),`w = 1`,`h = 838.4`(= 整张 `.n-data-table-base-table`,表头 + 表体);拖动中 `body.smart-table-resizing` 在;竖条有 `box-shadow: … 0 0 0 3px`(主色 18% 光晕);**松手后引导线消失、`body` 类去掉**。
4. 「账号」列(可排序):拖完松手**立刻**落在表头上 → **没有触发排序**;300ms 之后正常点击 → **触发排序**。`handle2.mjs` 是对照(不吞 click 时松手会误排序,`sorting? true`),证明吞 click 是必要的。
5. `@media (hover: none)`(触屏模拟):热区宽 **24**、`::after` 的 `left: 10px`。

`handle3.mjs`(固定列层叠):
- A 常规宽度:`account` / `name` / `email` 三个相邻列,每列 R−3、R+3 都命中**把手**;
- B 700 宽、横向滚 120 后,`selection` 列右缘 −8 / −3 命中 `selection` 自己的 `th`(它没有把手),+0 / +3 / +8 命中右邻 `account`;
- C `allfixed`(全部列 `fixed: 'left'`):`account` / `name` 的 R−3、R+3 仍命中**把手**(递减 `z-index` 生效)。

`touch1.mjs`(触屏拖动,`Emulation.setTouchEmulationEnabled`):单指在把手上 `touchStart` → `touchMove` +60 → `touchEnd`:列宽 **218.7 → 278.7(变化 60)**。

**不通过就停下来,不要往下做**;跑完 `bash .sandbox/p1/_kit/vite-down.sh`。

- [ ] **Step 6: 提交**

```bash
git add src/ColumnFilter.vue src/SmartTable.vue tests/SmartTable.handle.test.ts tests/ColumnFilter.test.ts
git commit -m "feat: 列宽把手视觉与手势(热区 11px / 触屏 24px 骑线、竖条悬停才显示、引导线、150ms 吞 click、拖动收起气泡、触屏拖动、固定列层叠)" -m "视觉变化(只影响开了 resizable 的用户):静止不画线、悬停 / 拖动主色竖条(高度 = 表头整行,以原型 CSS 为准)、拖动时贯穿整表的 1px 引导线;官方把手只认鼠标事件,库把单指 touch 转成合成鼠标事件" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---


### Task 5: 条件构造器的纯逻辑 —— 容器解析、字段派生、草稿 ↔ 过滤态、行编辑,`useFilters.setMany`(R-9 三个数据通路点的内核)

> 这一步**没有 UI**,是模式 2 最容易写错、最该先锁住的部分,全部是 node 环境可单测的纯函数,同时定稿 R-9 的三个数据通路点(见上文「与规格 / 设计的差异」第 8–10 行):① 只写 `search` 的列怎么派生 `FilterDef`;② 请求形状 / `@search`(留到 Task 7 接线时落地,这里提供 `setMany` 与 `patchFromDraft`);③ `container` × `layout`。
> **「草稿 ↔ 过滤态」是核心**:构造器的草稿是**扁平的行**(`{ field, action, value }[]` + 每字段一个 `logic`),过滤态是**按字段分组**的 `FilterValue`(`{ logic, conditions[] }`)。`draftFromState` 把过滤态按字段候选顺序展开成行(没有任何生效条件 → 一行空白:第一个字段、它的第一个比较符);`patchFromDraft` 只留「有值的有值类条件 + 无值算子」,其余字段补 `null`(清掉),单条时 `logic` 归位 `and`;`draftMatchesState` 判断「提交这份草稿会得到的过滤态与当前相同」——相同时**不重建草稿**,免得把用户排好的行序打乱(过滤态按字段分组存,重建会把同字段的行并到一起)。换字段后不再适用的比较符自动重置为新字段的第一个,值一律清空;换比较符只在值的形状变了(标量 ↔ 数组 ↔ 无值)才清空值。

**Files:**
- Create: `src/conditionBuilder.ts`、`tests/conditionBuilder.test.ts`
- Modify: `src/types.ts`、`src/useColumns.ts`(抽出 `inferFilterType`)、`src/useFilters.ts`(`setMany`)、`src/index.ts`、`tests/useFilters.test.ts`

**Interfaces:**
- Consumes: P0 的 `filter.ts`(`actionValueKind`、`activeConditions`)、`useColumns.ts` 的 `FilterDef` / `filterOptionsKey` / `isSpecialColumn`、`types.ts` 的 `FilterAction` / `FilterValue` / `FilterState` / `SearchConfig`。
- Produces:
  - `types.ts`:`SearchFormConfig.container?: 'card' | 'table' | 'none'`、`SearchConfig.actions?: FilterAction[]`(都可选)。
  - `useColumns.ts`:`inferFilterType(col, hasOptions, explicit?): FilterFieldType`(列头漏斗与构造器共用同一套类型推断:显式 `filter.type` > 有字典 → `select` > `format` 为 `date` / `datetime` → `date`、`money` → `number` > `input`)。
  - `useFilters`:`setMany(patch: Record<string, FilterValue | null>): boolean`(一次改多列;`null` / 无生效条件的值 = 清掉该键;**只触发一次 `onChange`**,`key` 为空串、`value` 为 `null`,与 `clearFilters` 同口径;没有实际变化返回 `false` 且不触发)。
  - `conditionBuilder.ts`:`SearchContainer`;`resolveSearchContainer(cfg): SearchContainer`;`RECOMMENDED_ACTIONS: Record<FilterFieldType, readonly FilterAction[]>`;`MAX_BUILDER_ROWS = 10`;`BuilderDefs { fields, extra }` 与 `deriveBuilderDefs(columns, headerDefs): BuilderDefs`;`BuilderRow { field, action, value }`、`BuilderDraft { rows, logic }`;`blankRow(def)`、`draftFromState(state, defs)`、`patchFromDraft(draft, defs)`、`draftMatchesState(draft, state, defs)`、`resetPatch(defs)`、`setRowField(draft, i, field, defs)`、`setRowAction(draft, i, action)`、`setRowValue(draft, i, value)`、`addRow(draft, defs)`、`removeRow(draft, i, defs)`、`setFieldLogic(draft, field, logic)`、`rowLead(draft, i): 'condition' | 'logic' | 'and'`(第 0 行「条件」;同字段后续行「且 / 或」下拉;跨字段后续行固定「且」)。
  - `index.ts`:导出 `RECOMMENDED_ACTIONS`、类型 `SearchContainer`。

- [ ] **Step 1: 写失败的测试**

Create `tests/conditionBuilder.test.ts`:
```ts
// 模式 2 条件构造器的纯逻辑:容器解析、字段派生(只写 search 的列如何派生 FilterDef)、草稿 ↔ 过滤态、行编辑
import { describe, expect, it } from 'vitest'
import {
  MAX_BUILDER_ROWS,
  RECOMMENDED_ACTIONS,
  addRow,
  blankRow,
  deriveBuilderDefs,
  draftFromState,
  draftMatchesState,
  patchFromDraft,
  removeRow,
  resetPatch,
  resolveSearchContainer,
  rowLead,
  setFieldLogic,
  setRowAction,
  setRowField,
  setRowValue,
  type BuilderDraft,
} from '../src/conditionBuilder'
import { deriveFilterDefs } from '../src/useColumns'
import type { FilterState, SmartTableColumn } from '../src/types'

interface Row {
  code: string
  name: string
  amount: number
  status: string
  at: string
}

const cols: SmartTableColumn<Row>[] = [
  { key: 'code', title: '编码', search: true, filter: true }, // 两个都写:复用列头的 FilterDef
  { key: 'name', title: '名称', search: true }, // 只写 search
  { key: 'amount', title: '金额', search: { type: 'number', label: '金额(元)' } },
  { key: 'status', title: '状态', options: [{ label: '已审核', value: 'ok' }], search: true },
  { key: 'at', title: '日期', search: { type: 'daterange', actions: ['gte', 'lte'] } },
  { key: 'memo', title: '备注', hideInTable: true, search: { placeholder: '关键字', props: { maxlength: 20 } } }, // 搜索专用列
  { key: 'flag', title: '开关', search: { type: 'switch' } }, // 放不进一行
  { key: 'custom', title: '自定义', search: { render: () => null } }, // 同上
  { key: 'plain', title: '没有 search' },
  { type: 'selection' },
]

describe('resolveSearchContainer:container 优先于 layout', () => {
  it('缺省 card;layout: inline 是旧写法 = none;container 写了就赢(冲突时 layout 被忽略)', () => {
    expect(resolveSearchContainer(undefined)).toBe('card')
    expect(resolveSearchContainer(false)).toBe('card')
    expect(resolveSearchContainer({})).toBe('card')
    expect(resolveSearchContainer({ layout: 'grid' })).toBe('card')
    expect(resolveSearchContainer({ layout: 'inline' })).toBe('none')
    expect(resolveSearchContainer({ container: 'table' })).toBe('table')
    expect(resolveSearchContainer({ container: 'none' })).toBe('none')
    expect(resolveSearchContainer({ container: 'card', layout: 'inline' })).toBe('card')
    expect(resolveSearchContainer({ container: 'table', layout: 'inline' })).toBe('table')
  })
})

describe('RECOMMENDED_ACTIONS(规格 §5.9)', () => {
  it('四种类型的推荐集合', () => {
    expect(RECOMMENDED_ACTIONS.input).toEqual(['contains', 'notContains', 'equal', 'notEqual', 'startsWith', 'endsWith', 'like', 'isNull', 'isNotNull'])
    expect(RECOMMENDED_ACTIONS.number).toEqual(['equal', 'notEqual', 'gt', 'gte', 'lt', 'lte', 'isNull', 'isNotNull'])
    expect(RECOMMENDED_ACTIONS.date).toEqual(RECOMMENDED_ACTIONS.number)
    expect(RECOMMENDED_ACTIONS.select).toEqual(['equal', 'notEqual', 'in', 'notIn', 'isNull', 'isNotNull'])
  })
})

describe('deriveBuilderDefs:只写 search 的列如何派生 FilterDef', () => {
  const header = deriveFilterDefs<Row>(cols)
  const { fields, extra } = deriveBuilderDefs<Row>(cols, header)

  it('字段候选 = 声明了 search 且放得进一行的列;switch / render 不进;没有 search 的列不进;顺序按声明', () => {
    expect(fields.map((f) => f.key)).toEqual(['code', 'name', 'amount', 'status', 'at', 'memo'])
  })

  it('同时写了 filter 的列复用列头 FilterDef(同一个过滤键);比较符换成推荐集合', () => {
    const code = fields.find((f) => f.key === 'code')!
    expect(code.field).toBe('code')
    expect(code.actions).toEqual([...RECOMMENDED_ACTIONS.input])
    expect(header.find((h) => h.key === 'code')!.actions).toEqual(['contains', 'notContains', 'equal', 'notEqual']) // 列头自己的默认集合不变
    expect(extra.map((f) => f.key)).not.toContain('code') // 不是「只写 search」的字段,过滤态里本来就有它
  })

  it('只写 search 的列:extra 里,类型取自 search.type / 推断,标题取 search.label ?? 列标题', () => {
    expect(extra.map((f) => f.key)).toEqual(['name', 'amount', 'status', 'at', 'memo'])
    expect(fields.find((f) => f.key === 'name')).toMatchObject({ type: 'input', mode: 'condition', title: '名称' })
    expect(fields.find((f) => f.key === 'amount')).toMatchObject({ type: 'number', title: '金额(元)' })
    expect(fields.find((f) => f.key === 'status')).toMatchObject({ type: 'select', optionsKey: 'status' }) // 有字典 → select
    expect(fields.find((f) => f.key === 'at')).toMatchObject({ type: 'date' }) // daterange → date
  })

  it('比较符:search.actions 优先,其次 filter.actions,再次推荐集合', () => {
    expect(fields.find((f) => f.key === 'at')!.actions).toEqual(['gte', 'lte'])
    expect(fields.find((f) => f.key === 'amount')!.actions).toEqual([...RECOMMENDED_ACTIONS.number])
    const c2: SmartTableColumn<Row>[] = [{ key: 'name', title: 'n', search: true, filter: { actions: ['equal', 'isNull'] } }]
    expect(deriveBuilderDefs<Row>(c2, []).fields[0].actions).toEqual(['equal', 'isNull'])
  })

  it('过滤键 = filter.key ?? 列 key;忽略 search.key(模式 2 走 filterSerializer 的 filters[].field,不是扁平参数)', () => {
    const c: SmartTableColumn<Row>[] = [
      { key: 'name', title: 'n', search: { key: 'nameLike' } },
      { key: 'code', title: 'c', search: true, filter: { key: 'codeKey' } },
    ]
    const defs = deriveBuilderDefs<Row>(c, deriveFilterDefs<Row>(c)).fields
    expect(defs.map((d) => d.key)).toEqual(['name', 'codeKey'])
    expect(defs[0].field).toBe('name')
  })

  it('搜索专用列(hideInTable)照样是字段;placeholder / props 进值控件的 props', () => {
    expect(fields.find((f) => f.key === 'memo')!.props).toEqual({ placeholder: '关键字', maxlength: 20 })
  })

  it('search.order 排前面;search.defaultValue(模式 1 的扁平标量)→ 一条初始条件(input 用 contains,其余 equal),也是「重置」的目标', () => {
    const c: SmartTableColumn<Row>[] = [
      { key: 'name', title: 'n', search: { defaultValue: '张' } },
      { key: 'amount', title: 'a', search: { type: 'number', defaultValue: 5, order: 1 } },
      { key: 'at', title: 't', search: { type: 'daterange', defaultValue: ['2024-01-01', '2024-02-01'] } }, // 数组不生成
    ]
    const defs = deriveBuilderDefs<Row>(c, []).fields
    expect(defs.map((d) => d.key)).toEqual(['amount', 'name', 'at'])
    expect(defs[0].defaultValue).toEqual({ logic: 'and', conditions: [{ action: 'equal', value: 5 }] })
    expect(defs[1].defaultValue).toEqual({ logic: 'and', conditions: [{ action: 'contains', value: '张' }] })
    expect(defs[2].defaultValue).toBeNull()
  })

  it('没有任何 search 列 → 空', () => {
    expect(deriveBuilderDefs<Row>([{ key: 'name', title: 'n' }], [])).toEqual({ fields: [], extra: [] })
  })
})

describe('草稿 ↔ 过滤态', () => {
  const { fields } = deriveBuilderDefs<Row>(cols, deriveFilterDefs<Row>(cols))
  const state: FilterState = {
    code: { logic: 'or', conditions: [{ action: 'contains', value: 'M10' }, { action: 'contains', value: 'M20' }] },
    amount: { logic: 'and', conditions: [{ action: 'gt', value: 100 }] },
    other: { logic: 'and', conditions: [{ action: 'equal', value: 'x' }] }, // 构造器不管的键(只有列头漏斗管)
  }

  it('draftFromState:按字段候选顺序展开成行,or 的 logic 记在字段上;不属于构造器的键不进草稿', () => {
    const d = draftFromState(state, fields)
    expect(d.rows).toEqual([
      { field: 'code', action: 'contains', value: 'M10' },
      { field: 'code', action: 'contains', value: 'M20' },
      { field: 'amount', action: 'gt', value: 100 },
    ])
    expect(d.logic).toEqual({ code: 'or' })
  })

  it('没有任何生效条件 → 一行空白(第一个字段、它的第一个比较符)', () => {
    const d = draftFromState({}, fields)
    expect(d.rows).toEqual([{ field: 'code', action: 'contains', value: null }])
  })

  it('patchFromDraft:只留有值的有值类条件 + 无值算子;其余字段补 null(清掉);单条时 logic 归位 and', () => {
    const draft: BuilderDraft = {
      rows: [
        { field: 'code', action: 'contains', value: 'M10' },
        { field: 'code', action: 'contains', value: '' }, // 没填值:丢弃
        { field: 'name', action: 'isNull', value: null }, // 无值算子:放行
        { field: 'amount', action: 'gt', value: 100 },
        { field: 'amount', action: 'lt', value: 200 },
      ],
      logic: { code: 'or', amount: 'or' },
    }
    const p = patchFromDraft(draft, fields)
    expect(p.code).toEqual({ logic: 'and', conditions: [{ action: 'contains', value: 'M10' }] }) // 只剩一条 → and
    expect(p.name).toEqual({ logic: 'and', conditions: [{ action: 'isNull', value: null }] })
    expect(p.amount).toEqual({ logic: 'or', conditions: [{ action: 'gt', value: 100 }, { action: 'lt', value: 200 }] })
    expect(p.status).toBeNull()
    expect(Object.keys(p).sort()).toEqual(fields.map((f) => f.key).sort()) // 每个构造器字段一项;没有 other
  })

  it('往返:draftFromState → patchFromDraft 得到原来的 FilterValue(构造器管的那部分)', () => {
    const p = patchFromDraft(draftFromState(state, fields), fields)
    expect(p.code).toEqual(state.code)
    expect(p.amount).toEqual(state.amount)
  })

  it('draftMatchesState:提交草稿会得到的与当前过滤态一致 → true(此时不必重建草稿,免得打乱行序);不一致 → false', () => {
    const d = draftFromState(state, fields)
    expect(draftMatchesState(d, state, fields)).toBe(true)
    expect(draftMatchesState(setRowValue(d, 0, 'zzz'), state, fields)).toBe(false)
    // 草稿里还没填值的空行不影响一致性(它本来就不生效)
    expect(draftMatchesState({ ...d, rows: [...d.rows, blankRow(fields[1])] }, state, fields)).toBe(true)
  })

  it('resetPatch:各字段恢复 defaultValue(没有 / 无生效条件 → null)', () => {
    const c: SmartTableColumn<Row>[] = [
      { key: 'name', title: 'n', search: { defaultValue: '张' } },
      { key: 'code', title: 'c', search: true },
    ]
    const defs = deriveBuilderDefs<Row>(c, []).fields
    expect(resetPatch(defs)).toEqual({ name: { logic: 'and', conditions: [{ action: 'contains', value: '张' }] }, code: null })
  })
})

describe('行编辑', () => {
  const { fields } = deriveBuilderDefs<Row>(cols, deriveFilterDefs<Row>(cols))
  const base: BuilderDraft = draftFromState({}, fields)

  it('换字段:比较符不再适用 → 重置为新字段的第一个;仍适用 → 保留;值一律清空', () => {
    const d1 = setRowValue(setRowAction(base, 0, 'equal'), 0, 'abc')
    const toName = setRowField(d1, 0, 'name', fields) // name 是 input:equal 仍适用
    expect(toName.rows[0]).toEqual({ field: 'name', action: 'equal', value: null })
    const toAmount = setRowField(setRowAction(base, 0, 'contains'), 0, 'amount', fields) // contains 对 number 不适用
    expect(toAmount.rows[0]).toEqual({ field: 'amount', action: 'equal', value: null })
    expect(setRowField(base, 0, '不存在', fields)).toBe(base)
  })

  it('换比较符:值的形状变了(标量 ↔ 数组 ↔ 无值)才清空', () => {
    const d = setRowValue(base, 0, 'abc') // contains + 标量
    expect(setRowAction(d, 0, 'startsWith').rows[0].value).toBe('abc') // 都是标量:保留
    expect(setRowAction(d, 0, 'isNull').rows[0].value).toBeNull() // 标量 → 无值:清空
    const sel = setRowValue(setRowAction(setRowField(base, 0, 'status', fields), 0, 'in'), 0, ['ok'])
    expect(setRowAction(sel, 0, 'notIn').rows[0].value).toEqual(['ok']) // 数组 → 数组:保留
    expect(setRowAction(sel, 0, 'equal').rows[0].value).toBeNull() // 数组 → 标量:清空
  })

  it('加一行:与最后一行同字段 + 第一个比较符;封顶 MAX_BUILDER_ROWS', () => {
    let d = setRowField(base, 0, 'amount', fields)
    d = addRow(d, fields)
    expect(d.rows[1]).toEqual({ field: 'amount', action: 'equal', value: null })
    while (d.rows.length < MAX_BUILDER_ROWS) d = addRow(d, fields)
    expect(addRow(d, fields)).toBe(d)
  })

  it('删一行;删光回到一行空白', () => {
    const two = addRow(base, fields)
    expect(removeRow(two, 0, fields).rows).toHaveLength(1)
    expect(removeRow(base, 0, fields).rows).toEqual([blankRow(fields[0])])
  })

  it('rowLead:第 1 行「条件」;之前有同字段 → 「且 / 或」下拉;不同字段 → 固定「且」', () => {
    let d: BuilderDraft = { rows: [blankRow(fields[0])], logic: {} }
    d = addRow(d, fields) // 同字段
    d = { ...d, rows: [...d.rows, blankRow(fields[1])] } // 另一字段
    expect([0, 1, 2].map((i) => rowLead(d, i))).toEqual(['condition', 'logic', 'and'])
  })

  it('setFieldLogic:每字段一个值,联动该字段全部', () => {
    const d = setFieldLogic(base, 'code', 'or')
    expect(d.logic).toEqual({ code: 'or' })
    expect(setFieldLogic(d, 'name', 'and').logic).toEqual({ code: 'or', name: 'and' })
  })
})
```

`tests/useFilters.test.ts` 末尾追加 `setMany` 用例:
```diff
--- a/tests/useFilters.test.ts
+++ b/tests/useFilters.test.ts
@@ -1,6 +1,6 @@
 import { describe, expect, it, vi } from 'vitest'
 import { nextTick, ref } from 'vue'
-import { deriveFilterDefs, deriveInitFilters } from '../src/useColumns'
+import { deriveFilterDefs, deriveInitFilters, type FilterDef } from '../src/useColumns'
 import { useFilters } from '../src/useFilters'
 import type { FilterValue, SmartTableColumn } from '../src/types'
 
@@ -204,3 +204,39 @@
     expect(api.state.value).toEqual({})
   })
 })
+
+describe('useFilters.setMany(模式 2 的「搜索 / 重置」:一次改多列,只触发一次 onChange)', () => {
+  const defs = (): FilterDef[] => [
+    { key: 'a', field: 'a', optionsKey: 'a', mode: 'condition', multiple: false, type: 'input', actions: ['equal'] },
+    { key: 'b', field: 'b', optionsKey: 'b', mode: 'condition', multiple: false, type: 'input', actions: ['equal'] },
+  ]
+  const v = (value: string): FilterValue => ({ logic: 'and', conditions: [{ action: 'equal', value }] })
+
+  it('补丁里的键一次生效,onChange 只调一次(key 为空串、value 为 null,与 clearFilters 同口径),返回 true', () => {
+    const calls: Array<[string, unknown, unknown]> = []
+    const f = useFilters({ defs, onChange: (k, val, st) => calls.push([k, val, st]) })
+    expect(f.setMany({ a: v('1'), b: v('2') })).toBe(true)
+    expect(f.state.value).toEqual({ a: v('1'), b: v('2') })
+    expect(calls).toHaveLength(1)
+    expect(calls[0][0]).toBe('')
+    expect(calls[0][1]).toBeNull()
+  })
+
+  it('null / 无生效条件的值 = 清掉该键;补丁里没有的键不动', () => {
+    const f = useFilters({ defs })
+    f.setMany({ a: v('1'), b: v('2') })
+    f.setMany({ a: null })
+    expect(f.state.value).toEqual({ b: v('2') })
+    f.setMany({ b: { logic: 'and', conditions: [{ action: 'equal', value: '' }] } })
+    expect(f.state.value).toEqual({})
+  })
+
+  it('没有实际变化 → 不触发 onChange,返回 false(调用方要「点搜索总是重查」就自己补一次)', () => {
+    let n = 0
+    const f = useFilters({ defs, onChange: () => n++ })
+    f.setMany({ a: v('1') })
+    expect(n).toBe(1)
+    expect(f.setMany({ a: v('1'), b: null })).toBe(false)
+    expect(n).toBe(1)
+  })
+})
```

- [ ] **Step 2: 跑,确认失败**

Run: `npx vitest run tests/conditionBuilder.test.ts tests/useFilters.test.ts`
Expected: FAIL —— `Test Files  2 failed (2)`、`Tests  3 failed | 15 passed (18)`(`conditionBuilder.test.ts` 因模块不存在整个文件加载失败;`useFilters.test.ts` 里新增的 3 条 `setMany` 用例红)。

- [ ] **Step 3: 实现**

**3a. 类型**
```diff
--- a/src/types.ts
+++ b/src/types.ts
@@ -81,8 +81,10 @@
   span?: number
   /** 透传对应 Naive 控件(NInput/NInputNumber/NSelect/NDatePicker/NSwitch)。 */
   props?: Record<string, unknown>
-  /** 自定义控件,优先于 type。 */
+  /** 自定义控件,优先于 type。模式 2(条件构造器)放不下自定义控件,带 render 的列不进构造器。 */
   render?: (ctx: SearchRenderCtx) => VNodeChild
+  /** 仅模式 2(`search.container: 'table'`):该字段可选的比较符;缺省取 `filter.actions`,再缺省取按类型的推荐集合(规格 §5.9)。 */
+  actions?: FilterAction[]
 }
 
 /* ======================== 过滤 ======================== */
@@ -231,7 +233,13 @@
 }
 
 export interface SearchFormConfig {
-  /** 布局:'grid'(默认,独立卡片 + n-grid)| 'inline'(无卡片,单行自动换行,适配窄栏)。 */
+  /**
+   * 搜索区放在哪:'card'(默认)独立搜索卡片 + 网格(模式 1);'table' 并入表格卡片的一行条件构造器「字段 + 比较符 + 值」(模式 2,字段候选 = 声明了
+   * `search` 的列,产出走 `filterSerializer` 的 `filters`,默认开 chips);'none' 不带卡片的内联搜索表单(= 2.1.1 的 `layout: 'inline'`)。
+   * **`container` 优先于 `layout`**:没写 `container` 时 `layout: 'inline'` 等价 `'none'`;两者冲突时 `layout` 被忽略。
+   */
+  container?: 'card' | 'table' | 'none'
+  /** 布局:'grid'(默认,独立卡片 + n-grid)| 'inline'(无卡片,单行自动换行,适配窄栏)。旧写法,见 `container`。 */
   layout?: 'grid' | 'inline'
   /** n-grid 的 cols(responsive="screen"),默认取全局 searchCols('1 s:2 m:3 l:4');inline 模式忽略。 */
   cols?: number | string
```

**3b. `useColumns.ts`:抽出 `inferFilterType`**(列头漏斗与构造器共用同一套类型推断;抽出前后行为不变,既有 `useColumns.test.ts` 守住)
```diff
--- a/src/useColumns.ts
+++ b/src/useColumns.ts
@@ -134,6 +134,18 @@
   select: ['equal', 'notEqual'],
 }
 
+/**
+ * 过滤值控件的类型:显式 `filter.type` 优先;有字典 → select;否则按 `format` 推断(date / datetime → date,money → number),缺省 input。
+ * 列头漏斗与模式 2 条件构造器共用同一套推断。
+ */
+export function inferFilterType<T>(col: SmartTableDataColumn<T>, hasOptions: boolean, explicit?: FilterFieldType): FilterFieldType {
+  if (explicit) return explicit
+  if (hasOptions) return 'select'
+  if (col.format === 'date' || col.format === 'datetime') return 'date'
+  if (col.format === 'money') return 'number'
+  return 'input'
+}
+
 /** 一列的过滤项(表头面板渲染 + 本地过滤 + 远程序列化共用)。 */
 export interface FilterDef<T = any> {
   /** 过滤态的键 / 远程参数字段名(filter.key ?? 列 key)。 */
@@ -178,15 +190,7 @@
       const cfg: FilterConfig<T> = col.filter === true ? {} : col.filter
       const hasOptions = !!(cfg.options ?? col.options)
       const mode: FilterMode = cfg.mode ?? (hasOptions ? 'options' : 'condition')
-      const type: FilterFieldType =
-        cfg.type ??
-        (hasOptions
-          ? 'select'
-          : col.format === 'date' || col.format === 'datetime'
-            ? 'date'
-            : col.format === 'money'
-              ? 'number'
-              : 'input')
+      const type = inferFilterType(col, hasOptions, cfg.type)
       defs.push({
         key: cfg.key ?? col.key,
         field: col.key,
```

**3c. `useFilters.ts`:`setMany`**
```diff
--- a/src/useFilters.ts
+++ b/src/useFilters.ts
@@ -29,6 +29,11 @@
   getFilter: (key: string) => FilterValue | null
   /** 传 null 或无生效条件的值 → 清除该列。值没变则不触发 onChange。 */
   setFilter: (key: string, value: FilterValue | null) => void
+  /**
+   * 一次改多列(模式 2 的「搜索 / 重置」):补丁里值为 null 或无生效条件的键被清掉。只触发**一次** onChange(key 为空串,与 clearFilters 同口径),
+   * 远程模式只重查一次。返回是否真的有变化(没变化时不触发 onChange,调用方要「点搜索总是重查」就自己补一次)。
+   */
+  setMany: (patch: Record<string, FilterValue | null>) => boolean
   /** 全部恢复到各列 defaultValue(没有 defaultValue 的列即清空)。 */
   clearFilters: () => void
   activeKeys: ComputedRef<string[]>
@@ -69,6 +74,18 @@
     opts.onChange?.(key, effective, next)
   }
 
+  function setMany(patch: Record<string, FilterValue | null>): boolean {
+    const next = { ...state.value }
+    for (const [key, value] of Object.entries(patch)) {
+      if (value && isFilterActive(value)) next[key] = value
+      else delete next[key]
+    }
+    if (filterStateEqual(next, state.value)) return false
+    state.value = next
+    opts.onChange?.('', null, next)
+    return true
+  }
+
   function clearFilters() {
     const next = deriveInitFilters(opts.defs())
     if (filterStateEqual(next, state.value)) return
@@ -78,5 +95,5 @@
 
   const activeKeys = computed(() => Object.keys(state.value))
 
-  return { state, getFilter, setFilter, clearFilters, activeKeys }
+  return { state, getFilter, setFilter, setMany, clearFilters, activeKeys }
 }
```

**3d. 内核**

Create `src/conditionBuilder.ts`:
```ts
// 模式 2 条件构造器(`search: { container: 'table' }`)的纯逻辑(UI 无关、可单测):
// 字段从哪来、比较符默认集合、容器解析、草稿 ↔ 过滤态的互转、行编辑。
// 产出仍是 FilterValue,走现成的 FilterState / filterSerializer / 本地 applyFilters(设计文档 1);「搜索」按钮提交草稿,不是每敲一个字就查。
import { actionValueKind, activeConditions } from './filter'
import type {
  FilterAction,
  FilterConfig,
  FilterFieldType,
  FilterLogic,
  FilterState,
  FilterValue,
  SearchConfig,
  SearchFieldType,
  SearchFormConfig,
  SmartTableColumn,
} from './types'
import { inferFilterType, filterOptionsKey, isSpecialColumn, type FilterDef } from './useColumns'

/* ======================== 容器解析 ======================== */

export type SearchContainer = 'card' | 'table' | 'none'

/**
 * 搜索区放在哪(规格 §5.1):`container` 优先;`layout` 只是旧写法 —— 没写 `container` 时 `layout: 'inline'` 等价 `'none'`,否则 `'card'`。
 * `'none'` = 不带卡片的内联搜索表单(2.1.1 的 `layout: 'inline'`),`'card'` = 独立搜索卡片 + 网格(默认),`'table'` = 并入表格卡片的条件构造器(模式 2)。
 * 两者同时写且冲突(如 `container: 'card'` + `layout: 'inline'`)时 `container` 赢、`layout` 被忽略。
 */
export function resolveSearchContainer(cfg: SearchFormConfig | false | undefined): SearchContainer {
  if (!cfg) return 'card'
  return cfg.container ?? (cfg.layout === 'inline' ? 'none' : 'card')
}

/* ======================== 比较符默认集合 ======================== */

/** 模式 2 按字段类型的推荐比较符(规格 §5.9):列头面板默认仍是 2.1.1 的 8 个,这里默认给全。宿主用 `search.actions` / `filter.actions` 覆盖。 */
export const RECOMMENDED_ACTIONS: Record<FilterFieldType, readonly FilterAction[]> = {
  input: ['contains', 'notContains', 'equal', 'notEqual', 'startsWith', 'endsWith', 'like', 'isNull', 'isNotNull'],
  number: ['equal', 'notEqual', 'gt', 'gte', 'lt', 'lte', 'isNull', 'isNotNull'],
  date: ['equal', 'notEqual', 'gt', 'gte', 'lt', 'lte', 'isNull', 'isNotNull'],
  select: ['equal', 'notEqual', 'in', 'notIn', 'isNull', 'isNotNull'],
}

/** 条件构造器一共最多几行(自有取值;列头面板是每列 5 条)。真有需求走编程式 setFilter。 */
export const MAX_BUILDER_ROWS = 10

/* ======================== 字段派生 ======================== */

/** 搜索控件类型 → 条件行的值控件类型。daterange 当 date(用 ≥ 与 ≤ 两行表达区间);switch / 自定义 render 放不进一行,不进构造器。 */
const SEARCH_TO_FIELD: Partial<Record<SearchFieldType, FilterFieldType>> = {
  input: 'input',
  number: 'number',
  select: 'select',
  date: 'date',
  daterange: 'date',
}

export interface BuilderDefs {
  /** 构造器的字段候选(声明了 `search` 且放得进条件行的列),按 `search.order` / 声明顺序。 */
  fields: FilterDef[]
  /** 其中「只写了 search、没有列头 filter」的字段:过滤态 / 本地过滤 / chips 也要认它们,但表头不挂漏斗。 */
  extra: FilterDef[]
}

/** 只写 `search` 的列的 `search.defaultValue`(模式 1 的扁平标量)→ 一条初始条件:input 用 contains,其余用 equal;数组 / 空值不生成。 */
function defaultToFilterValue(value: unknown, type: FilterFieldType, actions: FilterAction[]): FilterValue | null {
  if (value === null || value === undefined || value === '' || Array.isArray(value)) return null
  const action: FilterAction = type === 'input' ? 'contains' : 'equal'
  return { logic: 'and', conditions: [{ action: actions.includes(action) ? action : (actions[0] ?? action), value }] }
}

/**
 * 从列声明派生构造器字段(规格 §5.1:「只写 search 的列如何派生 FilterDef」):
 * - 同时写了 `filter` 的列:直接复用列头的 FilterDef(同一个过滤键、同一份过滤态,构造器与漏斗是同一份条件的两个入口),只换比较符集合与标题;
 * - 只写 `search` 的列:新派生一个(过滤键 = `filter.key ?? 列 key`,**忽略 `search.key`**——模式 2 的请求走 filterSerializer 的 `filters[].field`,不是扁平参数),
 *   值控件类型取 `search.type`(daterange → date),比较符取 `search.actions ?? filter.actions ?? 推荐集合`;
 * - `search.render` / `type: 'switch'` 的列放不进「字段 + 比较符 + 值」一行,不进构造器。
 */
export function deriveBuilderDefs<T>(columns: SmartTableColumn<T>[], headerDefs: FilterDef<T>[]): BuilderDefs {
  const items: Array<{ def: FilterDef<T>; extra: boolean; sortKey: number }> = []
  columns.forEach((col, idx) => {
    if (isSpecialColumn(col) || !col.search) return
    const sc: SearchConfig = col.search === true ? {} : col.search
    if (sc.render || sc.type === 'switch') return
    const fc: FilterConfig<T> | undefined = col.filter ? (col.filter === true ? {} : col.filter) : undefined
    const header = headerDefs.find((d) => d.field === col.key)
    const sortKey = sc.order ?? 1_000_000 + idx

    if (header) {
      const actions = sc.actions?.length ? sc.actions : fc?.actions?.length ? fc.actions : [...RECOMMENDED_ACTIONS[header.type]]
      items.push({ def: { ...header, actions: [...actions], title: sc.label ?? header.title }, extra: false, sortKey })
      return
    }
    const hasOptions = !!(fc?.options ?? col.options)
    const type: FilterFieldType = (sc.type && SEARCH_TO_FIELD[sc.type]) || inferFilterType(col, hasOptions, fc?.type)
    const actions = [...(sc.actions?.length ? sc.actions : fc?.actions?.length ? fc.actions : RECOMMENDED_ACTIONS[type])]
    const props: Record<string, unknown> = { ...(sc.placeholder !== undefined ? { placeholder: sc.placeholder } : {}), ...sc.props, ...fc?.props }
    items.push({
      def: {
        key: fc?.key ?? col.key,
        field: col.key,
        optionsKey: fc?.options ? filterOptionsKey(col.key) : col.key,
        title: sc.label ?? col.title,
        mode: 'condition',
        multiple: true,
        type,
        actions,
        defaultValue: fc?.defaultValue ?? defaultToFilterValue(sc.defaultValue, type, actions),
        props: Object.keys(props).length ? props : undefined,
        filter: fc?.filter,
      },
      extra: true,
      sortKey,
    })
  })
  items.sort((a, b) => a.sortKey - b.sortKey)
  return { fields: items.map((i) => i.def), extra: items.filter((i) => i.extra).map((i) => i.def) }
}

/* ======================== 草稿 ======================== */

export interface BuilderRow {
  /** 字段 = FilterDef.key(过滤键)。 */
  field: string
  action: FilterAction
  value: unknown
}

export interface BuilderDraft {
  rows: BuilderRow[]
  /** 同字段多条的「且 / 或」:**每字段一个值**(与 FilterValue.logic 一致,改任一条联动该字段全部);缺省 and。跨字段固定「且」。 */
  logic: Record<string, FilterLogic>
}

export function blankRow(def: FilterDef): BuilderRow {
  return { field: def.key, action: def.actions[0] ?? 'equal', value: null }
}

/**
 * 过滤态 → 草稿:按字段候选的顺序、字段内按条件顺序展开成行;没有任何生效条件 → 一行空白(第一个字段)。
 * 过滤态里不属于构造器字段的键(只有列头漏斗管的列)不进草稿。
 */
export function draftFromState(state: FilterState, defs: FilterDef[]): BuilderDraft {
  const rows: BuilderRow[] = []
  const logic: Record<string, FilterLogic> = {}
  for (const d of defs) {
    const v = state[d.key]
    const conds = activeConditions(v)
    if (conds.length === 0) continue
    for (const c of conds) rows.push({ field: d.key, action: c.action, value: c.value })
    if (conds.length > 1 && v?.logic === 'or') logic[d.key] = 'or'
  }
  if (rows.length === 0 && defs[0]) rows.push(blankRow(defs[0]))
  return { rows, logic }
}

/**
 * 草稿 → 过滤态补丁(每个构造器字段一项:有生效条件 → FilterValue,没有 → null = 清掉)。
 * 生效 = 有值的有值类条件 + 无值算子;只剩一条时 logic 归位为 and。不属于构造器的键不在补丁里,所以列头漏斗管的条件不受影响。
 */
export function patchFromDraft(draft: BuilderDraft, defs: FilterDef[]): Record<string, FilterValue | null> {
  const patch: Record<string, FilterValue | null> = {}
  for (const d of defs) {
    const conds = activeConditions({
      logic: 'and',
      conditions: draft.rows.filter((r) => r.field === d.key).map((r) => ({ action: r.action, value: r.value })),
    })
    patch[d.key] =
      conds.length === 0 ? null : { logic: conds.length > 1 ? (draft.logic[d.key] ?? 'and') : 'and', conditions: conds.map((c) => ({ ...c })) }
  }
  return patch
}

/** 过滤态里构造器管的那部分,和草稿提交后会得到的是否一致(一致就不必用过滤态重建草稿,免得把用户排好的行序打乱)。 */
export function draftMatchesState(draft: BuilderDraft, state: FilterState, defs: FilterDef[]): boolean {
  const patch = patchFromDraft(draft, defs)
  return defs.every((d) => JSON.stringify(patch[d.key] ?? null) === JSON.stringify(state[d.key] ?? null))
}

/** 「重置」:构造器字段各自恢复 defaultValue(没有 / 无生效条件就清掉),不碰列头漏斗管的键。 */
export function resetPatch(defs: FilterDef[]): Record<string, FilterValue | null> {
  const patch: Record<string, FilterValue | null> = {}
  for (const d of defs) {
    const dv = d.defaultValue
    patch[d.key] = dv && activeConditions(dv).length > 0 ? dv : null
  }
  return patch
}

/* ---- 行编辑(都返回新草稿) ---- */

const defOf = (defs: FilterDef[], field: string) => defs.find((d) => d.key === field)

/** 换字段:比较符不再适用时重置为新字段的第一个;值一律清空(不同字段的值控件 / 字典不同,不做猜测性转换)。 */
export function setRowField(draft: BuilderDraft, index: number, field: string, defs: FilterDef[]): BuilderDraft {
  const d = defOf(defs, field)
  if (!d) return draft
  return {
    ...draft,
    rows: draft.rows.map((r, i) =>
      i !== index ? r : { field, action: d.actions.includes(r.action) ? r.action : (d.actions[0] ?? 'equal'), value: null },
    ),
  }
}

/** 换比较符:旧值的形状(无值 / 数组 / 标量)与新比较符不一致就清空。 */
export function setRowAction(draft: BuilderDraft, index: number, action: FilterAction): BuilderDraft {
  return {
    ...draft,
    rows: draft.rows.map((r, i) =>
      i !== index ? r : { ...r, action, value: actionValueKind(r.action) === actionValueKind(action) ? r.value : null },
    ),
  }
}

export function setRowValue(draft: BuilderDraft, index: number, value: unknown): BuilderDraft {
  return { ...draft, rows: draft.rows.map((r, i) => (i === index ? { ...r, value } : r)) }
}

/** 加一行:与最后一行同字段(多条件最常见的是同字段「或」),第一个比较符;封顶 MAX_BUILDER_ROWS。 */
export function addRow(draft: BuilderDraft, defs: FilterDef[]): BuilderDraft {
  if (draft.rows.length >= MAX_BUILDER_ROWS) return draft
  const last = draft.rows[draft.rows.length - 1]
  const d = (last && defOf(defs, last.field)) || defs[0]
  if (!d) return draft
  return { ...draft, rows: [...draft.rows, blankRow(d)] }
}

/** 删一行;删光了回到一行空白(至少留一行可编辑)。 */
export function removeRow(draft: BuilderDraft, index: number, defs: FilterDef[]): BuilderDraft {
  const rows = draft.rows.filter((_, i) => i !== index)
  if (rows.length === 0 && defs[0]) return { ...draft, rows: [blankRow(defs[0])] }
  return { ...draft, rows }
}

/** 改某字段的「且 / 或」(该字段所有条件联动)。 */
export function setFieldLogic(draft: BuilderDraft, field: string, logic: FilterLogic): BuilderDraft {
  return { ...draft, logic: { ...draft.logic, [field]: logic } }
}

/**
 * 每行最左一格显示什么:第 1 行 `condition`(引导文字「条件」);其后某行之前已有同字段的行 → `logic`(「且 / 或」下拉,该字段共用);
 * 否则 `and`(跨字段固定「且」,只读文字)。
 */
export type RowLead = 'condition' | 'logic' | 'and'
export function rowLead(draft: BuilderDraft, index: number): RowLead {
  if (index === 0) return 'condition'
  const field = draft.rows[index]?.field
  return draft.rows.slice(0, index).some((r) => r.field === field) ? 'logic' : 'and'
}
```

**3e. 导出**
```diff
--- a/src/index.ts
+++ b/src/index.ts
@@ -23,6 +23,8 @@
 export { useFilters } from './useFilters'
 export { deriveFilterDefs, deriveInitFilters, filterOptionsKey } from './useColumns'
 export type { FilterDef } from './useColumns'
+export { RECOMMENDED_ACTIONS } from './conditionBuilder'
+export type { SearchContainer } from './conditionBuilder'
 export { SMART_TABLE_DEFAULTS, createSmartTableDefaults, useSmartTableDefaults } from './config'
 export type { SmartTableDefaults } from './config'
 
```

- [ ] **Step 4: 跑,确认通过**

Run: `npm test && npm run typecheck`
Expected: `Test Files  30 passed (30)`、`Tests  499 passed (499)`(基线 + 18 + 23 + 19 + 10 + 25);typecheck 无输出。

- [ ] **Step 5: 浏览器验证**:本 Task 是纯逻辑,没有;浏览器验证在 Task 7(接线)。

- [ ] **Step 6: 提交**

```bash
git add src/conditionBuilder.ts src/types.ts src/useColumns.ts src/useFilters.ts src/index.ts tests/conditionBuilder.test.ts tests/useFilters.test.ts
git commit -m "feat: 条件构造器的纯逻辑(容器解析 / 字段派生 / 草稿 ↔ 过滤态 / 行编辑)与 useFilters.setMany" -m "R-9 数据通路定稿:字段候选 = 声明了 search 的列(同时写了 filter 的复用列头 FilterDef、同一份过滤态),search.render / switch 不进构造器,search.key 忽略;container 优先于 layout;setMany 一次批量提交只触发一次 onChange" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---


### Task 6: 条件构造器的两个 SFC —— `ConditionPanel`(多条件面板)与 `ConditionBar`(工具栏一行),`ConditionRow` 的扩展

> 设计 2.6a / 2.11 与原型 `.cond` / `.cond-panel` / `.sheet`。**面板的每一行直接复用列头面板的 `ConditionRow`**(P0 的 13e 之后它自带首列「条件 / 且或」与 4 列网格),只多三样:① 经 `#field` 插槽在引导列与比较符之间放一个**字段下拉**(构造器一行比列头面板多一格);② `lead` prop:`undefined` = 按行号(第 0 行「条件」、之后是且 / 或下拉,列头面板的行为)、字符串 = 固定文字(跨字段的后续行是「且」)、`null` = 不画(主行 / 抽屉);③ `size` / `valueOnly` / `placeholder` / `searchIcon`(模式 2 的工具栏行 `medium`、窄档 `large`、文本框右侧放大镜)。**列头面板的默认(small、带引导列、带比较符)不变**。
> **气泡(宽 / 中档)**:官方 `NPopover`(`trigger="manual"` + `@clickoutside`、`raw`、`show-arrow=false`),内容 = `ConditionPanel`,每行是 5 列网格 `[引导 64 | 字段 | 比较符 | 值 1.5fr | 删除 28]`(覆盖 `ConditionRow` 自己的 4 列网格),面板 `width: min(660px, …)`、内边距 14、行距 10;页脚「添加条件」「重置」是无边框次级按钮(`quaternary`)、「确认」是默认描边(主色实心留给宿主的「新增」),与原型一致。NPopover 距触发器 6px(外壳自带的 margin,我们的 `margin-top` 会与它折叠、不生效),原型是 8px,所以面板自己 `position: relative; top: 2px`。**窄档(< 600)**:主行只画第 1 行的值控件(`valueOnly`、`size="large"`、右侧放大镜、占位「搜索 {字段名}」),「筛选」按钮(带角标)开**官方 `NDrawer`**(`placement="bottom"`),里面是同一份 `ConditionPanel` 的堆叠排布:每条一块 —— 头「条件 N」+ 同字段的且 / 或 + 删除,`[字段 | 比较符]` 两列、值整行;页脚(`NDrawerContent` 的 `#footer`)「添加条件」靠左、「重置」「确认」靠右。**官方 `.n-drawer-body` 是 `flex: 1 0 0` + `overflow: hidden`,父级高度 `auto` 时塌成 0**,所以要把 `NDrawer` 本体到正文这一路改成 flex 列、正文 `flex: 1 1 auto; min-height: 0`(NDrawer 是 teleport 到 `body` 的,拿不到本组件的 scoped 属性,这几条用 `:global`),`height="auto"` + `style="max-height: 85vh"`(透传进 `.n-drawer` 本体)才能「高度随内容、最高 85vh」。
> 键盘:气泡里 Esc —— 有下拉展开就放行(下拉自己收,不然草稿跟着面板一起丢了),否则收起面板并把焦点还给「更多条件」按钮;Tab 在面板内循环;**草稿保留、不提交**(与列头面板「Esc 丢弃草稿」不同:构造器草稿与工具栏主行是同一份)。窄档:枚举(`select`)字段的**标量**比较符选完即生效(窄档没有「搜索」按钮,枚举也没有回车可按),其余靠回车。

**Files:**
- Create: `src/ConditionPanel.vue`、`src/ConditionBar.vue`、`tests/ConditionBar.test.ts`
- Modify: `src/ConditionRow.vue`、`src/icons.ts`、`src/labels.ts`、`src/types.ts`

**Interfaces:**
- Consumes: Task 5 的 `conditionBuilder.ts` 全部导出;Task 2 的 `loopTab`;P0 的 `ConditionRow`(`index` / `logic` / `update:logic`)、`filterDefTitle`、`labels.filterConditionLead` / `filterAddCondition` / `filterReset` / `filterConfirm` / `filterLogicAnd` / `filterLogicOr` / `filterRemoveCondition`、`labels.filter`(窄档「筛选」按钮与抽屉标题)、`labels.search` / `labels.reset`。
- Produces:
  - `SmartTableLabels.searchBy?` / `searchMoreConditions?` / `searchConditionN?`(可选;英文 `Search {field}` / `More conditions` / `Condition {n}`,中文 `搜索 {field}` / `更多条件` / `条件 {n}`)。
  - `icons.ts`:`MoreConditionsIcon`(`»`,与原型 `I_MORE` 同几何)、`SearchIcon`(放大镜,原型 `I_SEARCH`)。
  - `ConditionRow`:props `size: 'small' | 'medium' | 'large'`(默认 `'small'`)、`valueOnly: boolean`、`placeholder?: string`、`lead?: string | null`、`searchIcon: boolean`;插槽 `#field`;根元素多一个类 `smart-table-filter-row--value-only`(单列网格)。
  - `ConditionPanel` props:`fields: FilterDef[]`、`draft: BuilderDraft`、`labels`、`getOptions`、`isLoadingOptions`、`dateValueFormat?`、`stack?: boolean`、`size?: 'small' | 'medium' | 'large'`;emits:`update:draft(d)`、`confirm()`、`reset()`、`dropdown(open: boolean)`(面板里有下拉展开 / 全部收起;外层据此区分 Esc 是收下拉还是关面板)。
  - `ConditionBar` props:`fields`、`draft`、`labels`、`getOptions`、`isLoadingOptions`、`dateValueFormat?`、`tier: 'narrow' | 'mid' | 'wide'`(默认 `'wide'`)、`loading?`、`appliedCount?`(`»` / 「筛选」的角标)、`openRequest?`(每次变大 = 请求打开面板,chips 点击用);emits:`update:draft(d)`、`search()`、`reset()`。
  - CSS 类(测试与浏览器脚本用):`.smart-table-cond`(`--wide` / `--mid` / `--narrow`)、`.smart-table-cond__main`、`.smart-table-cond__field`、`.smart-table-cond__more`、`.smart-table-cond__badge`、`.smart-table-cond__popover`、`.smart-table-cond-panel`(`--stack`)、`.smart-table-cond-panel__row`、`.smart-table-cond-panel__footer`、`.smart-table-cond-panel__block`。

- [ ] **Step 1: 写失败的测试**

Create `tests/ConditionBar.test.ts`:
```ts
// @vitest-environment jsdom
// 条件构造器的两个 SFC:ConditionPanel(多条件面板内容,气泡 / 抽屉共用)与 ConditionBar(工具栏一行 + 面板开合 / 键盘)
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import ConditionBar from '../src/ConditionBar.vue'
import ConditionPanel from '../src/ConditionPanel.vue'
import ConditionRow from '../src/ConditionRow.vue'
import { defaultLabels } from '../src/labels'
import { MAX_BUILDER_ROWS, blankRow, type BuilderDraft } from '../src/conditionBuilder'
import type { FilterDef } from '../src/useColumns'

const defs: FilterDef[] = [
  { key: 'name', field: 'name', optionsKey: 'name', title: '名称', mode: 'condition', multiple: true, type: 'input', actions: ['contains', 'equal', 'isNull'] },
  { key: 'amount', field: 'amount', optionsKey: 'amount', title: '金额', mode: 'condition', multiple: true, type: 'number', actions: ['equal', 'gt', 'lt'] },
  { key: 'status', field: 'status', optionsKey: 'status', title: '状态', mode: 'condition', multiple: true, type: 'select', actions: ['equal', 'in'] },
]
const base = (rows: BuilderDraft['rows'] = [blankRow(defs[0])], logic: BuilderDraft['logic'] = {}): BuilderDraft => ({ rows, logic })
const common = {
  fields: defs,
  labels: defaultLabels,
  getOptions: () => [{ label: '已审核', value: 'ok' }],
  isLoadingOptions: () => false,
}

const mounted: VueWrapper[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()!.unmount()
  document.body.innerHTML = ''
})
function mountPanel(draft: BuilderDraft, extra: Record<string, unknown> = {}) {
  const w = mount(ConditionPanel, { props: { ...common, draft, ...extra }, attachTo: document.body })
  mounted.push(w)
  return w
}
const lastDraft = (w: VueWrapper) => w.emitted('update:draft')!.at(-1)![0] as BuilderDraft

describe('ConditionPanel', () => {
  it('每行最左一格:第 1 行「条件」;同字段后续行是「且 / 或」下拉;不同字段是固定「且」', () => {
    const draft = base([
      { field: 'name', action: 'contains', value: 'a' },
      { field: 'name', action: 'contains', value: 'b' },
      { field: 'amount', action: 'gt', value: 1 },
    ])
    const w = mountPanel(draft)
    const rows = w.findAllComponents(ConditionRow)
    // 引导格由 ConditionRow 画(与列头面板同一套):第 1 行「条件」文字,同字段后续行 = 且 / 或下拉,跨字段后续行 = 固定「且」
    expect(rows[0].find('.smart-table-filter-lead').text()).toBe('Where')
    expect(rows[1].find('.smart-table-filter-logic').exists()).toBe(true)
    expect(rows[1].find('.smart-table-filter-lead').exists()).toBe(false)
    expect(rows[2].find('.smart-table-filter-logic').exists()).toBe(false)
    expect(rows[2].find('.smart-table-filter-lead').text()).toBe('AND')
  })

  it('加条件:与最后一行同字段;封顶后「添加」禁用', async () => {
    const w = mountPanel(base([{ field: 'amount', action: 'gt', value: 1 }]))
    const add = w.find('.smart-table-cond-panel__footer > .n-button')
    await add.trigger('click')
    expect(lastDraft(w).rows[1]).toEqual({ field: 'amount', action: 'equal', value: null })

    const full = mountPanel(base(Array.from({ length: MAX_BUILDER_ROWS }, () => blankRow(defs[0]))))
    expect(full.find('.smart-table-cond-panel__footer > .n-button').attributes('disabled')).toBeDefined()
  })

  it('改行内比较符 / 值 → update:draft(经 ConditionRow 的事件);删除只有 ≥ 2 行时才有', async () => {
    const draft = base([blankRow(defs[0]), blankRow(defs[0])])
    const w = mountPanel(draft)
    const rows = w.findAllComponents(ConditionRow)
    rows[0].vm.$emit('update:value', 'abc')
    await nextTick()
    expect(lastDraft(w).rows[0].value).toBe('abc')
    rows[1].vm.$emit('update:action', 'equal')
    await nextTick()
    expect(lastDraft(w).rows[1].action).toBe('equal')
    rows[1].vm.$emit('remove')
    await nextTick()
    expect(lastDraft(w).rows).toHaveLength(1)
    expect(mountPanel(base()).findComponent(ConditionRow).props('removable')).toBe(false)
  })

  it('ConditionRow 的回车 → confirm;页脚「重置」→ reset,「确认」→ confirm(文案沿用 filterReset / filterConfirm)', async () => {
    const w = mountPanel(base())
    w.findComponent(ConditionRow).vm.$emit('enter')
    expect(w.emitted('confirm')).toHaveLength(1)
    const [resetBtn, okBtn] = w.findAll('.smart-table-cond-panel__actions button')
    expect(resetBtn.text()).toBe(defaultLabels.filterReset)
    expect(okBtn.text()).toBe(defaultLabels.filterConfirm)
    await resetBtn.trigger('click')
    await okBtn.trigger('click')
    expect(w.emitted('reset')).toHaveLength(1)
    expect(w.emitted('confirm')).toHaveLength(2)
  })

  it('下拉展开计数:行里任一下拉展开 → dropdown(true);全部收起 → dropdown(false)(外层据此区分 Esc 是收下拉还是关面板)', async () => {
    const w = mountPanel(base([blankRow(defs[0]), blankRow(defs[0])]))
    const rows = w.findAllComponents(ConditionRow)
    rows[0].vm.$emit('dropdown', true)
    rows[1].vm.$emit('dropdown', true)
    await nextTick()
    expect(w.emitted('dropdown')!.at(-1)).toEqual([true])
    rows[0].vm.$emit('dropdown', false)
    await nextTick()
    expect(w.emitted('dropdown')!.length).toBe(1) // 还有一行展开,没有变成 false
    rows[1].vm.$emit('dropdown', false)
    await nextTick()
    expect(w.emitted('dropdown')!.at(-1)).toEqual([false])
  })

  it('stack(抽屉)排布:带 --stack 类', () => {
    expect(mountPanel(base(), { stack: true, size: 'large' }).classes()).toContain('smart-table-cond-panel--stack')
  })
})

describe('ConditionBar', () => {
  function mountBar(extra: Record<string, unknown> = {}, draft: BuilderDraft = base()) {
    const w = mount(ConditionBar, { props: { ...common, draft, ...extra }, attachTo: document.body })
    mounted.push(w)
    return w
  }
  const moreBtn = () => document.querySelector<HTMLElement>('.smart-table-cond__more button')!
  const panel = () => document.querySelector<HTMLElement>('.smart-table-cond__popover')
  const press = (el: Element, key: string, init: KeyboardEventInit = {}) =>
    el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }))

  it('宽 / 中档主行:字段下拉 + 比较符 + 值 + » + 搜索 + 重置;点搜索 / 重置发事件', async () => {
    const w = mountBar()
    expect(w.find('.smart-table-cond__field').exists()).toBe(true)
    expect(moreBtn().getAttribute('aria-label')).toBe(defaultLabels.searchMoreConditions)
    const buttons = [...document.querySelectorAll<HTMLElement>('.smart-table-cond__main > .n-button')]
    buttons.find((b) => b.textContent!.trim() === 'Search')!.click()
    buttons.find((b) => b.textContent!.trim() === 'Reset')!.click()
    await nextTick()
    expect(w.emitted('search')).toHaveLength(1)
    expect(w.emitted('reset')).toHaveLength(1)
  })

  it('角标:宽 / 中档 ≥ 2 条才显示(1 条主行已经显示了);窄档 ≥ 1 条显示', () => {
    mountBar({ appliedCount: 1 })
    expect(document.querySelector('.smart-table-cond__badge')).toBeNull()
    mountBar({ appliedCount: 2 })
    expect(document.querySelector('.smart-table-cond__badge')!.textContent!.trim()).toBe('2')
    mountBar({ appliedCount: 1, tier: 'narrow' })
    expect([...document.querySelectorAll('.smart-table-cond__badge')].map((e) => e.textContent!.trim())).toContain('1')
  })

  it('openRequest 变大 → 面板打开,焦点进面板;Esc → 收起并把焦点还给 » 按钮;不发 search(草稿保留)', async () => {
    const w = mountBar()
    await w.setProps({ openRequest: 1 })
    await flushPromises()
    expect(moreBtn().getAttribute('aria-expanded')).toBe('true')
    expect(panel()).not.toBeNull()
    expect(panel()!.getAttribute('role')).toBe('dialog')
    press(panel()!.querySelector('input')!, 'Escape')
    await flushPromises()
    expect(moreBtn().getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(moreBtn())
    expect(w.emitted('search')).toBeUndefined()
  })

  it('面板里有下拉展开时 Esc 放行(下拉自己收,面板不关);下拉收起后再 Esc 才关面板', async () => {
    const w = mountBar()
    await w.setProps({ openRequest: 1 })
    await flushPromises()
    const panelComp = w.findComponent(ConditionPanel)
    panelComp.vm.$emit('dropdown', true)
    await nextTick()
    const input = panel()!.querySelector('input')!
    const ev = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    input.dispatchEvent(ev)
    await flushPromises()
    expect(moreBtn().getAttribute('aria-expanded')).toBe('true') // 面板还在
    panelComp.vm.$emit('dropdown', false)
    await nextTick()
    press(input, 'Escape')
    await flushPromises()
    expect(moreBtn().getAttribute('aria-expanded')).toBe('false')
  })

  it('面板里 Tab 循环:最后一个控件 Tab → 第一个', async () => {
    const w = mountBar()
    await w.setProps({ openRequest: 1 })
    await flushPromises()
    const items = [...panel()!.querySelectorAll<HTMLElement>('input, button, [tabindex]:not([tabindex="-1"])')].filter((e) => e.tabIndex >= 0)
    items[items.length - 1].focus()
    const ev = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    items[items.length - 1].dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(items[0])
  })

  it('焦点还停在主行 / » 按钮上(面板开着)时按 Esc 也能收起', async () => {
    mountBar()
    moreBtn().click()
    await flushPromises()
    expect(moreBtn().getAttribute('aria-expanded')).toBe('true')
    press(moreBtn(), 'Escape')
    await flushPromises()
    expect(moreBtn().getAttribute('aria-expanded')).toBe('false')
  })

  it('窄档:枚举(select)字段的标量比较符,选完即生效 = 发 update:draft 之后马上发 search;文本字段不会', async () => {
    const select = base([{ field: 'status', action: 'equal', value: null }])
    const w = mountBar({ tier: 'narrow' }, select)
    w.findComponent(ConditionRow).vm.$emit('update:value', 'ok')
    await nextTick()
    expect(lastDraft(w).rows[0].value).toBe('ok')
    expect(w.emitted('search')).toHaveLength(1)

    const text = mountBar({ tier: 'narrow' })
    text.findComponent(ConditionRow).vm.$emit('update:value', 'abc')
    await nextTick()
    expect(text.emitted('search')).toBeUndefined()
  })

  it('窄档主行只画值控件(没有比较符下拉),占位 = 「Search {字段名}」', () => {
    const w = mountBar({ tier: 'narrow' })
    const row = w.findComponent(ConditionRow)
    expect(row.props('valueOnly')).toBe(true)
    expect(row.props('size')).toBe('large')
    expect(row.find('.smart-table-filter-action').exists()).toBe(false)
    expect(w.find('input').attributes('placeholder')).toBe('Search 名称')
  })
})

describe('ConditionRow 新增的 size / valueOnly / placeholder(列头面板默认不变)', () => {
  const row = (extra: Record<string, unknown> = {}) =>
    mount(ConditionRow, {
      props: { def: defs[0], condition: { action: 'contains', value: '' }, labels: defaultLabels, getOptions: () => [], isLoadingOptions: () => false, ...extra },
    })
  it('默认 small、带比较符、占位取 def.props', () => {
    const w = row()
    expect(w.find('.smart-table-filter-action').exists()).toBe(true)
    expect(w.find('.n-input--small-size').exists()).toBe(true)
  })
  it('size="medium" / valueOnly / placeholder 覆盖', () => {
    const w = row({ size: 'medium', valueOnly: true, placeholder: '搜索 名称' })
    expect(w.find('.smart-table-filter-action').exists()).toBe(false)
    expect(w.find('.n-input--medium-size').exists()).toBe(true)
    expect(w.find('input').attributes('placeholder')).toBe('搜索 名称')
  })
  it('不给 placeholder 时 def.props.placeholder 仍生效(不会被 undefined 顶掉)', () => {
    const w = row({ def: { ...defs[0], props: { placeholder: '关键字' } } })
    expect(w.find('input').attributes('placeholder')).toBe('关键字')
  })
})
```

- [ ] **Step 2: 跑,确认失败**

Run: `npx vitest run tests/ConditionBar.test.ts`
Expected: FAIL —— `Test Files  1 failed (1)`、`Tests  no tests`(`Failed to resolve import "../src/ConditionBar.vue"`:文件加载失败,没有用例被收集)。

- [ ] **Step 3: 实现**

**3a. 文案、类型、图标**
```diff
--- a/src/types.ts
+++ b/src/types.ts
@@ -480,6 +480,13 @@
   selectedCount?: string
   /** 批量栏「取消选择」。 */
   clearSelection?: string
+  /* ---- 3.0 P1:模式 2 条件构造器 ---- */
+  /** 窄档输入框的占位:「搜索 {field}」(field = 当前字段的列标题)。 */
+  searchBy?: string
+  /** 「更多条件」按钮的名称 / 提示。 */
+  searchMoreConditions?: string
+  /** 窄档筛选抽屉里每条条件的块头:「条件 {n}」。 */
+  searchConditionN?: string
   /* ---- 3.0 P1:放大 ---- */
   /** 「放大」按钮的名称 / 提示;放大后变成 restore。 */
   maximize?: string
```
```diff
--- a/src/labels.ts
+++ b/src/labels.ts
@@ -51,6 +51,9 @@
   filterCannotCollapse: 'Contains conditions checkboxes cannot show',
   filterClearAll: 'Clear all',
   filterRestoreDefault: 'Restore defaults',
+  searchBy: 'Search {field}',
+  searchMoreConditions: 'More conditions',
+  searchConditionN: 'Condition {n}',
   selectedCount: '{n} selected',
   clearSelection: 'Clear selection',
   maximize: 'Maximize',
@@ -107,6 +110,9 @@
   filterCannotCollapse: '含勾选无法表达的条件',
   filterClearAll: '清除全部',
   filterRestoreDefault: '恢复默认',
+  searchBy: '搜索 {field}',
+  searchMoreConditions: '更多条件',
+  searchConditionN: '条件 {n}',
   selectedCount: '已选 {n} 项',
   clearSelection: '取消选择',
   maximize: '放大',
```
```diff
--- a/src/icons.ts
+++ b/src/icons.ts
@@ -46,6 +46,15 @@
 export const ChevronDownIcon = smallIcon(['m4 6 4 4 4-4'], 1.8)
 export const CloseIcon = smallIcon(['M4 4l8 8M12 4l-8 8'], 1.8)
 export const PlusIcon = smallIcon(['M8 3v10M3 8h10'], 1.6)
+// 「更多条件」:双尖括号 »(不用「…」:工具栏的「更多」菜单按钮已经是文字 + 下箭头,两个「更多」不能同形)
+export const MoreConditionsIcon = lineIcon(['m7 7 5 5-5 5', 'M14 7l5 5-5 5'])
+// 构造器里文本输入框右侧的放大镜(原型 I_SEARCH:16 视口、14px、笔画 1.6)
+export const SearchIcon: FunctionalComponent = () =>
+  h(
+    'svg',
+    { viewBox: '0 0 16 16', width: '14', height: '14', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.6, 'stroke-linecap': 'round', 'aria-hidden': 'true' },
+    [h('circle', { cx: 7, cy: 7, r: 4.5 }), h('path', { d: 'M10.5 10.5 14 14' })],
+  )
 // 放大 = 四角括号向外展开,还原 = 向内收拢(用户选定的方案 B;只有折线、没有箭头;与「复制」图标不混)
 export const MaximizeIcon = lineIcon(['M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3'])
 export const RestoreIcon = lineIcon(['M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3'])
```

**3b. `src/ConditionRow.vue`:`size` / `valueOnly` / `placeholder` / `lead` / `searchIcon` + `#field` 插槽**(列头面板的默认不变)
```diff
--- a/src/ConditionRow.vue
+++ b/src/ConditionRow.vue
@@ -10,7 +10,7 @@
 import { actionValueKind } from './filter'
 import { ACTION_LABEL_KEY } from './labels'
 import { optionLabel } from './useOptions'
-import { CloseIcon } from './icons'
+import { CloseIcon, SearchIcon } from './icons'
 
 /** NSelect 的选项类型:官方没有公开导出 SelectMixedOption,从公开的 SelectProps 推导。 */
 type SelectOpt = NonNullable<SelectProps['options']>[number]
@@ -28,6 +28,16 @@
   dateValueFormat: { type: String, default: 'yyyy-MM-dd' },
   /** 至少留一行:只有一行时不给删除按钮。 */
   removable: { type: Boolean, default: false },
+  /** 控件尺寸:列头面板 small(默认);模式 2 的工具栏行 medium、窄档 large。 */
+  size: { type: String as PropType<'small' | 'medium' | 'large'>, default: 'small' },
+  /** 只画值控件(不画引导列 / 比较符 / 删除):模式 2 窄档的「输入框 + 筛选」。 */
+  valueOnly: { type: Boolean, default: false },
+  /** 覆盖值控件的占位(缺省取 def.props.placeholder)。 */
+  placeholder: { type: String, default: undefined },
+  /** 引导列:undefined = 按行号(第 0 行「条件」、之后是且 / 或下拉,列头面板的行为);字符串 = 固定文字(模式 2 跨字段的后续行是「且」);null = 不画(模式 2 的主行 / 抽屉)。 */
+  lead: { type: String as PropType<string | null>, default: undefined },
+  /** 文本输入框右侧画放大镜(模式 2 的构造器)。 */
+  searchIcon: { type: Boolean, default: false },
 })
 
 const emit = defineEmits<{
@@ -42,6 +52,8 @@
 
 const themeVars = useThemeVars()
 const kind = computed(() => actionValueKind(props.condition.action))
+// 值控件的透传 props:def.props 在前;给了 placeholder 才覆盖(直接写 :placeholder 会在 undefined 时把 def.props 里的占位也顶掉)
+const controlProps = computed(() => (props.placeholder ? { ...props.def.props, placeholder: props.placeholder } : props.def.props))
 
 // 下拉展开状态:操作符下拉与值控件各记一份,任意一个展开就算「这一行有下拉展开」。
 // 面板要靠它区分 Esc 是「收起下拉」还是「关闭面板」(NSelect / NDatePicker 收起自己时不 stopPropagation)。
@@ -87,13 +99,17 @@
 </script>
 
 <template>
-  <div class="smart-table-filter-row">
-    <!-- 首列:第 1 行「条件」引导标签(12px、textColor3);第 2 行起是且 / 或下拉,选哪个都是改整组的连接方式 -->
-    <span v-if="index === 0" class="smart-table-filter-lead" :style="{ color: themeVars.textColor3 }">{{
-      labels.filterConditionLead
-    }}</span>
+  <div class="smart-table-filter-row" :class="{ 'smart-table-filter-row--value-only': valueOnly }">
+    <!-- 首列:第 1 行「条件」引导标签(12px、textColor3);第 2 行起是且 / 或下拉,选哪个都是改整组的连接方式。
+         lead 给了字符串 = 固定文字,给了 null = 不画(模式 2);valueOnly 时整个前半段都不画 -->
+    <span
+      v-if="!valueOnly && (typeof lead === 'string' || (lead === undefined && index === 0))"
+      class="smart-table-filter-lead"
+      :style="{ color: themeVars.textColor3 }"
+      >{{ lead ?? labels.filterConditionLead }}</span
+    >
     <n-select
-      v-else
+      v-else-if="!valueOnly && lead === undefined"
       class="smart-table-filter-logic"
       size="small"
       :value="logic"
@@ -101,9 +117,12 @@
       @update:value="(l: FilterLogic) => emit('update:logic', l)"
       @update:show="(v: boolean) => (open.logic = v)"
     />
+    <!-- 模式 2 的字段下拉:放在引导列与比较符之间 -->
+    <slot v-if="!valueOnly" name="field" />
     <n-select
+      v-if="!valueOnly"
       class="smart-table-filter-action"
-      size="small"
+      :size="size"
       :value="condition.action"
       :options="actionOptions"
       :consistent-menu-width="false"
@@ -113,11 +132,11 @@
     <!-- 值控件写成真实元素(不走 <component :is>):重渲染时被 patch 而不是重挂,输入过程中不会掉焦点。
          def.props 放最前面,可透传但盖不掉值绑定与回调。 -->
     <div class="smart-table-filter-value">
-      <n-input v-if="kind === 'none'" size="small" disabled :placeholder="labels.filterNoValue" />
+      <n-input v-if="kind === 'none'" :size="size" disabled :placeholder="labels.filterNoValue" />
       <n-select
         v-else-if="kind === 'array'"
-        v-bind="def.props"
-        size="small"
+        v-bind="controlProps"
+        :size="size"
         multiple
         filterable
         :tag="def.type !== 'select'"
@@ -129,8 +148,8 @@
       />
       <n-input-number
         v-else-if="def.type === 'number'"
-        v-bind="def.props"
-        size="small"
+        v-bind="controlProps"
+        :size="size"
         clearable
         style="width: 100%"
         :value="(condition.value ?? null) as number | null"
@@ -138,9 +157,9 @@
       />
       <n-date-picker
         v-else-if="def.type === 'date'"
-        v-bind="def.props"
+        v-bind="controlProps"
         type="date"
-        size="small"
+        :size="size"
         clearable
         style="width: 100%"
         :value-format="dateValueFormat"
@@ -150,8 +169,8 @@
       />
       <n-select
         v-else-if="def.type === 'select'"
-        v-bind="def.props"
-        size="small"
+        v-bind="controlProps"
+        :size="size"
         clearable
         :value="(condition.value ?? null) as string | number | null"
         :options="selectOptions"
@@ -161,16 +180,20 @@
       />
       <n-input
         v-else
-        v-bind="def.props"
-        size="small"
+        v-bind="controlProps"
+        :size="size"
         clearable
         :value="(condition.value ?? null) as string | null"
         @update:value="(v: unknown) => emit('update:value', v)"
         @keyup="onKeyup"
-      />
+      >
+        <template v-if="searchIcon" #suffix>
+          <span class="smart-table-filter-search-icon" :style="{ color: themeVars.textColor3 }"><SearchIcon /></span>
+        </template>
+      </n-input>
     </div>
     <n-button
-      v-if="removable"
+      v-if="removable && !valueOnly"
       class="smart-table-filter-remove"
       quaternary
       circle
@@ -205,4 +228,11 @@
 .smart-table-filter-value {
   min-width: 0;
 }
+/* 只画值控件(模式 2 窄档的输入框):单列,不要被 4 列网格(56 / 112 / 1fr / 28)压进第一格 */
+.smart-table-filter-row--value-only {
+  grid-template-columns: minmax(0, 1fr);
+}
+.smart-table-filter-search-icon {
+  display: inline-flex;
+}
 </style>
```

**3c. 两个新 SFC**

Create `src/ConditionPanel.vue`:
```vue
<script setup lang="ts">
// 模式 2 条件构造器的多条件面板内容:气泡(宽 / 中档)与底部抽屉(窄档)共用同一份,只换容器、换排布(stack)。
// 受控:草稿由 SmartTable 持有(与工具栏主行共用,第 1 行就是主行),这里只发事件。
// 每行直接复用列头面板的 ConditionRow(引导列「条件」/ 且或下拉 + 比较符 + 值 + 删除),字段下拉经它的 #field 插槽放进同一排:
// ConditionRow 的根节点在这里改成 5 列网格 [引导 64 | 字段 | 比较符 | 值 1.5fr | 删除 28](设计原型 .cond-panel .row),字段插槽正好是第 2 格。
// 抽屉(stack):每条一块 —— 头(「条件 N」+ 同字段的且 / 或 + 删除),下面是 [字段 | 比较符] 两列、值整行(设计原型 .sb)。
import { computed, reactive, watch, type PropType } from 'vue'
import { NButton, NSelect, useThemeVars } from 'naive-ui'
import type { FilterAction, FilterLogic, SmartTableLabels, SmartTableOption } from './types'
import { filterDefTitle, type FilterDef } from './useColumns'
import { fmt } from './labels'
import { CloseIcon, PlusIcon } from './icons'
import ConditionRow from './ConditionRow.vue'
import {
  MAX_BUILDER_ROWS,
  addRow,
  removeRow,
  rowLead,
  setFieldLogic,
  setRowAction,
  setRowField,
  setRowValue,
  type BuilderDraft,
} from './conditionBuilder'

const props = defineProps({
  fields: { type: Array as PropType<FilterDef[]>, required: true },
  draft: { type: Object as PropType<BuilderDraft>, required: true },
  labels: { type: Object as PropType<Required<SmartTableLabels>>, required: true },
  getOptions: { type: Function as PropType<(key: string) => SmartTableOption[]>, required: true },
  isLoadingOptions: { type: Function as PropType<(key: string) => boolean>, required: true },
  dateValueFormat: { type: String, default: 'yyyy-MM-dd' },
  /** 抽屉排布:每条一块纵向堆叠;页脚(添加 / 重置 / 确认)由抽屉容器自己放在 NDrawerContent 的 #footer 里。 */
  stack: { type: Boolean, default: false },
  size: { type: String as PropType<'small' | 'medium' | 'large'>, default: 'small' },
})

const emit = defineEmits<{
  'update:draft': [d: BuilderDraft]
  confirm: []
  reset: []
  /** 面板里有 NSelect / NDatePicker 的下拉展开(true)/ 全部收起(false):外层据此区分 Esc 是「收下拉」还是「关面板」。 */
  dropdown: [open: boolean]
}>()

const themeVars = useThemeVars()
const update = (d: BuilderDraft) => emit('update:draft', d)

const fieldOptions = computed(() => props.fields.map((f) => ({ label: filterDefTitle(f), value: f.key })))
const logicOptions = computed(() => [
  { label: props.labels.filterLogicAnd, value: 'and' },
  { label: props.labels.filterLogicOr, value: 'or' },
])
const defOf = (field: string) => props.fields.find((f) => f.key === field)
/** 跨字段的后续行,引导格是固定的「且」(同字段才有且 / 或下拉);其余交给 ConditionRow 按行号决定(第 0 行「条件」、之后是下拉)。 */
const fixedLead = (i: number) => (rowLead(props.draft, i) === 'and' ? props.labels.filterLogicAnd : undefined)

// 下拉展开计数(每行有字段 / 且或 / 比较符 / 值多个下拉):用 Set 记「哪一行的哪个下拉」,面板里任何一个展开就算展开
const open = reactive(new Set<string>())
const markOpen = (id: string, isOpen: boolean) => (isOpen ? open.add(id) : open.delete(id))
watch(
  () => open.size > 0,
  (v) => emit('dropdown', v),
)
// 删行 / 行序变了:旧的展开记录作废(该行上的下拉随行一起卸载)
function onRemove(i: number) {
  open.clear()
  update(removeRow(props.draft, i, props.fields))
}
</script>

<template>
  <div class="smart-table-cond-panel" :class="{ 'smart-table-cond-panel--stack': stack }">
    <div class="smart-table-cond-panel__rows">
      <template v-for="(row, i) in draft.rows" :key="i">
        <!-- 气泡 / 中宽档:一行 5 格 -->
        <ConditionRow
          v-if="!stack && defOf(row.field)"
          class="smart-table-cond-panel__row"
          search-icon
          :index="i"
          :logic="draft.logic[row.field] ?? 'and'"
          :lead="fixedLead(i)"
          :def="defOf(row.field)!"
          :condition="{ action: row.action, value: row.value }"
          :labels="labels"
          :get-options="getOptions"
          :is-loading-options="isLoadingOptions"
          :date-value-format="dateValueFormat"
          :removable="draft.rows.length > 1"
          :size="size"
          @update:action="(a: FilterAction) => update(setRowAction(draft, i, a))"
          @update:value="(v: unknown) => update(setRowValue(draft, i, v))"
          @update:logic="(l: FilterLogic) => update(setFieldLogic(draft, row.field, l))"
          @remove="onRemove(i)"
          @enter="emit('confirm')"
          @dropdown="(o: boolean) => markOpen(`r${i}`, o)"
        >
          <template #field>
            <n-select
              class="smart-table-cond-panel__field"
              :size="size"
              :value="row.field"
              :options="fieldOptions"
              :consistent-menu-width="false"
              @update:value="(f: string) => update(setRowField(draft, i, f, fields))"
              @update:show="(o: boolean) => markOpen(`f${i}`, o)"
            />
          </template>
        </ConditionRow>

        <!-- 抽屉:每条一块 -->
        <div v-else-if="stack && defOf(row.field)" class="smart-table-cond-panel__block" :style="{ borderTopColor: themeVars.dividerColor }">
          <div class="smart-table-cond-panel__block-head" :style="{ color: themeVars.textColor2 }">
            <span>{{ fmt(labels.searchConditionN, { n: i + 1 }) }}</span>
            <n-select
              v-if="rowLead(draft, i) === 'logic'"
              class="smart-table-cond-panel__logic"
              :size="size"
              :value="draft.logic[row.field] ?? 'and'"
              :options="logicOptions"
              :consistent-menu-width="false"
              @update:value="(l: FilterLogic) => update(setFieldLogic(draft, row.field, l))"
              @update:show="(o: boolean) => markOpen(`l${i}`, o)"
            />
            <n-button v-if="draft.rows.length > 1" quaternary :size="size" :aria-label="labels.filterRemoveCondition" @click="onRemove(i)">
              <template #icon><CloseIcon /></template>
            </n-button>
          </div>
          <ConditionRow
            class="smart-table-cond-panel__body"
            search-icon
            :lead="null"
            :removable="false"
            :def="defOf(row.field)!"
            :condition="{ action: row.action, value: row.value }"
            :labels="labels"
            :get-options="getOptions"
            :is-loading-options="isLoadingOptions"
            :date-value-format="dateValueFormat"
            :size="size"
            @update:action="(a: FilterAction) => update(setRowAction(draft, i, a))"
            @update:value="(v: unknown) => update(setRowValue(draft, i, v))"
            @enter="emit('confirm')"
            @dropdown="(o: boolean) => markOpen(`r${i}`, o)"
          >
            <template #field>
              <n-select
                :size="size"
                :value="row.field"
                :options="fieldOptions"
                :consistent-menu-width="false"
                @update:value="(f: string) => update(setRowField(draft, i, f, fields))"
                @update:show="(o: boolean) => markOpen(`f${i}`, o)"
              />
            </template>
          </ConditionRow>
        </div>
      </template>
    </div>
    <div v-if="!stack" class="smart-table-cond-panel__footer" :style="{ borderTop: `1px solid ${themeVars.dividerColor}` }">
      <!-- 原型 .panel-foot:「添加条件」「重置」是无边框的次级按钮(quaternary),「确认」是默认描边(主色实心留给宿主的「新增」) -->
      <n-button quaternary :size="size" :disabled="draft.rows.length >= MAX_BUILDER_ROWS" :theme-overrides="{ iconSizeSmall: '13px' }" @click="update(addRow(draft, fields))">
        <template #icon><PlusIcon /></template>
        {{ labels.filterAddCondition }}
      </n-button>
      <div class="smart-table-cond-panel__actions">
        <n-button quaternary :size="size" @click="emit('reset')">{{ labels.filterReset }}</n-button>
        <n-button :size="size" @click="emit('confirm')">{{ labels.filterConfirm }}</n-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.smart-table-cond-panel__rows {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
/* 气泡:覆盖 ConditionRow 自己的 4 列网格(56 / 112 / 1fr / 28)——字段插槽多出一格,变成 5 列 */
.smart-table-cond-panel__rows > :deep(.smart-table-cond-panel__row) {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.5fr) 28px;
  align-items: center;
  gap: 8px;
}
.smart-table-cond-panel__field {
  min-width: 0;
}
.smart-table-cond-panel__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 10px;
  padding-top: 12px;
}
.smart-table-cond-panel__actions {
  display: flex;
  gap: 8px;
}
/* 抽屉:每条一块,块之间 16px + 分隔线;块头「条件 N」靠左,同字段的且 / 或与删除靠右(设计原型 .sb / .sb-head) */
.smart-table-cond-panel--stack .smart-table-cond-panel__rows {
  gap: 0;
}
.smart-table-cond-panel__block {
  padding-top: 16px;
}
.smart-table-cond-panel__block + .smart-table-cond-panel__block {
  margin-top: 16px;
  border-top: 1px solid;
}
.smart-table-cond-panel__block-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-size: 14px;
}
.smart-table-cond-panel__block-head > span {
  flex: 1 1 auto;
}
.smart-table-cond-panel__logic {
  flex: none;
  width: 88px;
}
.smart-table-cond-panel__block > :deep(.smart-table-cond-panel__body) {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 12px 8px;
}
.smart-table-cond-panel__body :deep(.smart-table-filter-value) {
  grid-column: 1 / -1;
}
</style>
```

Create `src/ConditionBar.vue`:
```vue
<script setup lang="ts">
// 模式 2 的条件构造器(工具栏里的一行):宽 / 中档「字段 + 比较符 + 值 + » + 搜索 + 重置」,点 » 展开多条件气泡;
// 窄档(< 600)「输入框 + 筛选」,点「筛选」从底部抽屉展开同一份多条件面板(2.6a)。
// 草稿由 SmartTable 持有(主行 = 草稿第 1 行,气泡 / 抽屉里改的是同一份),点「搜索」/「确认」才提交;Esc / 点外部只收起面板,草稿保留。
import { computed, nextTick, ref, watch, type PropType } from 'vue'
import { NButton, NDrawer, NDrawerContent, NPopover, NSelect, NTooltip, useThemeVars } from 'naive-ui'
import type { FilterAction, SmartTableLabels, SmartTableOption } from './types'
import { actionValueKind } from './filter'
import { fmt } from './labels'
import { filterDefTitle, type FilterDef } from './useColumns'
import { MoreConditionsIcon, PlusIcon } from './icons'
import { loopTab } from './maximize'
import { MAX_BUILDER_ROWS, addRow, setRowAction, setRowField, setRowValue, type BuilderDraft } from './conditionBuilder'
import ConditionRow from './ConditionRow.vue'
import ConditionPanel from './ConditionPanel.vue'

const props = defineProps({
  fields: { type: Array as PropType<FilterDef[]>, required: true },
  draft: { type: Object as PropType<BuilderDraft>, required: true },
  labels: { type: Object as PropType<Required<SmartTableLabels>>, required: true },
  getOptions: { type: Function as PropType<(key: string) => SmartTableOption[]>, required: true },
  isLoadingOptions: { type: Function as PropType<(key: string) => boolean>, required: true },
  dateValueFormat: { type: String, default: 'yyyy-MM-dd' },
  /** 容器宽档位(SmartTable 按根元素宽度算):窄 < 600、中 < 1280、宽 ≥ 1280。 */
  tier: { type: String as PropType<'narrow' | 'mid' | 'wide'>, default: 'wide' },
  loading: { type: Boolean, default: false },
  /** 已生效的构造器条件数(来自过滤态):» / 「筛选」的角标。 */
  appliedCount: { type: Number, default: 0 },
  /** 每次变大 = 请求打开多条件面板(已生效条件 chips 点击时用)。 */
  openRequest: { type: Number, default: 0 },
})

const emit = defineEmits<{
  'update:draft': [d: BuilderDraft]
  search: []
  reset: []
}>()

const themeVars = useThemeVars()
const update = (d: BuilderDraft) => emit('update:draft', d)

const narrow = computed(() => props.tier === 'narrow')
const main = computed(() => props.draft.rows[0])
const mainDef = computed(() => props.fields.find((f) => f.key === main.value?.field) ?? props.fields[0])
const mainCond = computed(() => ({ action: main.value?.action ?? 'equal', value: main.value?.value ?? null }))
const fieldOptions = computed(() => props.fields.map((f) => ({ label: filterDefTitle(f), value: f.key })))
// 窄档输入框的占位:「搜索 {当前字段名}」(渲染期求值,切语言即时生效)
const narrowPlaceholder = computed(() => fmt(props.labels.searchBy, { field: mainDef.value ? filterDefTitle(mainDef.value) : '' }))

/* ---- 面板开合 / 键盘 ---- */

const panelOpen = ref(false)
const panelRef = ref<HTMLElement | null>(null)
const moreBtnRef = ref<{ $el?: HTMLElement } | null>(null)
const dropdownOpen = ref(false)

watch(
  () => props.openRequest,
  (n, o) => {
    if (n > 0 && n !== o) panelOpen.value = true
  },
)
// 弹层内容挂载(每次打开都重新挂载,且是 teleport 出去的)后再把焦点移到第一个可编辑控件
watch(panelRef, (el) => {
  if (el && panelOpen.value) void nextTick(() => el.querySelector<HTMLElement>('input, button, [tabindex]:not([tabindex="-1"])')?.focus())
})
watch(panelOpen, (o) => {
  if (!o) dropdownOpen.value = false
})

function closePanel(focusBack: boolean) {
  panelOpen.value = false
  if (focusBack) void nextTick(() => moreBtnRef.value?.$el?.focus())
}
function togglePanel() {
  if (panelOpen.value) closePanel(false)
  else panelOpen.value = true
}
/** 气泡里的键盘:Esc —— 有下拉展开就放行(下拉自己收,不然草稿跟着面板一起丢了),否则收起面板;Tab 在面板内循环。捕获阶段,理由同列头面板。 */
function onPanelKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (dropdownOpen.value) return
    e.stopPropagation()
    closePanel(true)
    return
  }
  if (panelRef.value) loopTab(e, panelRef.value)
}
/** 焦点还在主行 / » 按钮上时(面板开着)按 Esc 也要能收起。 */
function onMainKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape' || !panelOpen.value || dropdownOpen.value) return
  e.stopPropagation()
  closePanel(true)
}

function onSearch() {
  closePanel(false)
  emit('search')
}
function onReset() {
  closePanel(false)
  emit('reset')
}

/** 窄档:枚举类字段(标量)选完即生效(窄档没有「搜索」按钮,枚举也没有回车可按);其余靠回车。 */
function onNarrowValue(v: unknown) {
  update(setRowValue(props.draft, 0, v))
  if (mainDef.value?.type === 'select' && actionValueKind(mainCond.value.action) === 'scalar') emit('search')
}
</script>

<template>
  <div class="smart-table-cond" :class="`smart-table-cond--${tier}`" @keydown="onMainKeydown">
    <!-- 窄档:输入框 + 筛选 -->
    <template v-if="narrow">
      <ConditionRow
        v-if="mainDef"
        class="smart-table-cond__narrow-input"
        value-only
        search-icon
        size="large"
        :def="mainDef"
        :condition="mainCond"
        :labels="labels"
        :get-options="getOptions"
        :is-loading-options="isLoadingOptions"
        :date-value-format="dateValueFormat"
        :placeholder="narrowPlaceholder"
        @update:value="onNarrowValue"
        @enter="onSearch"
      />
      <span class="smart-table-cond__more">
        <n-button ref="moreBtnRef" size="large" aria-haspopup="dialog" :aria-expanded="panelOpen" @click="togglePanel">{{ labels.filter }}</n-button>
        <span v-if="appliedCount > 0" class="smart-table-cond__badge" :style="{ background: themeVars.primaryColor, color: themeVars.baseColor }">{{ appliedCount }}</span>
      </span>
      <!-- 高度随内容、最高 85vh(条件再多也不顶出视口,中间正文滚动):NDrawer 的 style 并进 .n-drawer 本体 -->
      <n-drawer v-model:show="panelOpen" class="smart-table-cond__drawer" placement="bottom" height="auto" style="max-height: 85vh">
        <!-- 正文内边距:每条条件块自己带 16px 的上内边距(原型 .sb),所以这里只留左右 24 与底部 8 -->
        <n-drawer-content :title="labels.filter" closable :native-scrollbar="true" body-content-style="padding: 0 24px 8px">
          <ConditionPanel
            stack
            size="large"
            :fields="fields"
            :draft="draft"
            :labels="labels"
            :get-options="getOptions"
            :is-loading-options="isLoadingOptions"
            :date-value-format="dateValueFormat"
            @update:draft="update"
            @confirm="onSearch"
            @reset="onReset"
            @dropdown="(o: boolean) => (dropdownOpen = o)"
          />
          <template #footer>
            <div class="smart-table-cond__drawer-foot">
              <n-button quaternary size="large" :disabled="draft.rows.length >= MAX_BUILDER_ROWS" @click="update(addRow(draft, fields))">
                <template #icon><PlusIcon /></template>
                {{ labels.filterAddCondition }}
              </n-button>
              <n-button size="large" @click="onReset">{{ labels.filterReset }}</n-button>
              <n-button size="large" type="primary" @click="onSearch">{{ labels.filterConfirm }}</n-button>
            </div>
          </template>
        </n-drawer-content>
      </n-drawer>
    </template>

    <!-- 宽 / 中档:字段 + 比较符 + 值 + » + 搜索 + 重置;气泡锚在整行(左对齐、在下方) -->
    <n-popover
      v-else
      :show="panelOpen"
      trigger="manual"
      placement="bottom-start"
      :show-arrow="false"
      raw
      @clickoutside="closePanel(false)"
    >
      <template #trigger>
        <div class="smart-table-cond__main">
          <ConditionRow
            v-if="mainDef"
            class="smart-table-cond__row"
            size="medium"
            search-icon
            :lead="null"
            :def="mainDef"
            :condition="mainCond"
            :labels="labels"
            :get-options="getOptions"
            :is-loading-options="isLoadingOptions"
            :date-value-format="dateValueFormat"
            @update:action="(a: FilterAction) => update(setRowAction(draft, 0, a))"
            @update:value="(v: unknown) => update(setRowValue(draft, 0, v))"
            @enter="onSearch"
          >
            <template #field>
              <n-select
                class="smart-table-cond__field"
                size="medium"
                :value="main?.field"
                :options="fieldOptions"
                :consistent-menu-width="false"
                @update:value="(f: string) => update(setRowField(draft, 0, f, fields))"
              />
            </template>
          </ConditionRow>
          <span class="smart-table-cond__more">
            <n-tooltip trigger="hover" :disabled="panelOpen">
              <template #trigger>
                <n-button
                  ref="moreBtnRef"
                  quaternary
                  circle
                  size="small"
                  :theme-overrides="{ iconSizeSmall: '16px' }"
                  :aria-label="labels.searchMoreConditions"
                  aria-haspopup="dialog"
                  :aria-expanded="panelOpen"
                  @click="togglePanel"
                >
                  <template #icon><MoreConditionsIcon /></template>
                </n-button>
              </template>
              {{ labels.searchMoreConditions }}
            </n-tooltip>
            <span v-if="appliedCount > 1" class="smart-table-cond__badge" :style="{ background: themeVars.primaryColor, color: themeVars.baseColor }">{{ appliedCount }}</span>
          </span>
          <n-button :loading="loading" @click="onSearch">{{ labels.search }}</n-button>
          <n-button quaternary @click="onReset">{{ labels.reset }}</n-button>
        </div>
      </template>

      <!-- 面板:popoverColor + boxShadow2 + 圆角(与列头面板同一套取值);role=dialog + tabindex=-1,点空白处焦点落在容器,Esc 仍生效 -->
      <div
        ref="panelRef"
        class="smart-table-cond__popover"
        role="dialog"
        tabindex="-1"
        :aria-label="labels.searchMoreConditions"
        :style="{
          background: themeVars.popoverColor,
          borderRadius: themeVars.borderRadius,
          boxShadow: themeVars.boxShadow2,
          color: themeVars.textColor2,
        }"
        @keydown.capture="onPanelKeydown"
      >
        <ConditionPanel
          size="small"
          :fields="fields"
          :draft="draft"
          :labels="labels"
          :get-options="getOptions"
          :is-loading-options="isLoadingOptions"
          :date-value-format="dateValueFormat"
          @update:draft="update"
          @confirm="onSearch"
          @reset="onReset"
          @dropdown="(o: boolean) => (dropdownOpen = o)"
        />
      </div>
    </n-popover>
  </div>
</template>

<style scoped>
.smart-table-cond {
  min-width: 0;
}
.smart-table-cond__main {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.smart-table-cond__field {
  flex: 0 0 136px;
  width: 136px;
}
/* 主行:ConditionRow 的根节点退场(display: contents),它的格子(字段插槽 / 比较符 / 值)直接是这一行 flex 的子项:
   字段 136 · 比较符 112 · 值弹性(最小 100px:宽档 1:1 的最窄点,整行 1280,左半区 609px,值框只剩约 114px)(设计原型 .cond) */
.smart-table-cond__main > .smart-table-cond__row {
  display: contents;
}
.smart-table-cond__main :deep(.smart-table-filter-action) {
  flex: 0 0 112px;
  width: 112px;
}
.smart-table-cond__main :deep(.smart-table-filter-value) {
  flex: 1 1 100px;
  min-width: 100px;
}
.smart-table-cond__main > :deep(.n-button),
.smart-table-cond__more {
  flex: none;
}
.smart-table-cond__more {
  position: relative;
  display: inline-flex;
}
.smart-table-cond__badge {
  position: absolute;
  top: -3px;
  right: -3px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  box-sizing: border-box;
  border-radius: 8px;
  font-size: 11px;
  line-height: 16px;
  text-align: center;
  pointer-events: none;
}
.smart-table-cond__popover {
  box-sizing: border-box;
  position: relative;
  top: 2px; /* NPopover 距触发器 6px(外壳自带的 margin,我们的 margin-top 会与它折叠、不生效),原型是 8px(.cond-panel top: calc(100% + 8px)) */
  width: min(660px, calc(100vw - 16px));
  padding: 14px;
  text-align: left;
  font-weight: normal;
}
.smart-table-cond__popover:focus {
  outline: none;
}
/* 抽屉高度随内容(最高 85vh):官方 .n-drawer-body 是 flex: 1 0 0 + overflow: hidden,父级高度 auto 时它塌成 0;
   把 NDrawer 本体到正文这一路都改成 flex 列、正文 flex: 1 1 auto + min-height: 0,内容少时撑开、多时在 max-height 内由正文自己滚 */
/* NDrawer 是 teleport 到 body 的,拿不到本组件的 scoped 属性,所以这几条用 :global */
:global(.smart-table-cond__drawer) {
  display: flex;
  flex-direction: column;
}
:global(.n-drawer.smart-table-cond__drawer .n-drawer-content-wrapper) {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
:global(.n-drawer.smart-table-cond__drawer .n-drawer-content) {
  min-height: 0;
}
:global(.n-drawer.smart-table-cond__drawer .n-drawer-content .n-drawer-body) {
  flex: 1 1 auto;
  min-height: 0;
}
/* 抽屉页脚:「添加条件」靠左,重置 / 确认靠右(设计原型 .sheet-foot) */
.smart-table-cond__drawer-foot {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  gap: 8px;
}
.smart-table-cond__drawer-foot > :first-child {
  margin-right: auto;
}
/* 窄档:输入框占满,「筛选」在右 */
.smart-table-cond--narrow {
  display: flex;
  align-items: center;
  gap: 8px;
}
.smart-table-cond__narrow-input {
  flex: 1 1 0;
  min-width: 0;
}
</style>
```

- [ ] **Step 4: 跑,确认通过**

Run: `npm test && npm run typecheck`
Expected: `Test Files  31 passed (31)`、`Tests  516 passed (516)`(基线 + 18 + … + 17 = 沙盒 516);typecheck 无输出;无 `[Vue warn]`。**`ColumnFilter.test.ts` 里列头面板的既有用例一条都不能变红**(`ConditionRow` 的新 props 默认值保证列头面板不变)。

- [ ] **Step 5: 浏览器验证**:本 Task 的组件还没接进 `SmartTable`,浏览器验证在 Task 7。

- [ ] **Step 6: 提交**

```bash
git add src/ConditionPanel.vue src/ConditionBar.vue src/ConditionRow.vue src/icons.ts src/labels.ts src/types.ts tests/ConditionBar.test.ts
git commit -m "feat: 条件构造器的多条件面板与工具栏行(复用列头面板的 ConditionRow;窄档输入框 + 筛选抽屉)" -m "ConditionRow 新增 size / valueOnly / placeholder / lead / searchIcon 与 #field 插槽(列头面板默认不变);气泡 5 列网格 [引导 | 字段 | 比较符 | 值 | 删除];窄档抽屉用官方 NDrawer(高度随内容、最高 85vh);Esc / 点空白只收起、保留草稿" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---


### Task 7: 模式 2 接线 —— `search: { container: 'table' }`、数据通路、chips 默认开(B10)、三档工具栏、窄档批量栏

> 把 Task 5–6 接进 `SmartTable` / `Toolbar`。**数据通路(R-9 定稿,与上文差异表第 8–10 行一致)**:`container` 解析 → 模式 2 下**扁平搜索项为空**(不渲染 `SearchForm`,请求里没有扁平搜索键);`filterDefs = 列头漏斗的 + 只写 `search` 的构造器字段(`extra`)`——过滤态 / 本地过滤 / chips / 序列化都认它们,但 `useColumns` 只认列头的(只写 `search` 的列不挂漏斗);构造器草稿 `builderDraft` 与工具栏主行是**同一份**(主行 = 第 1 行,气泡 / 抽屉里改的也是它);「搜索」/ 回车 → `filters.setMany(patchFromDraft(...))`(**一次** `onChange`、远程只重查一次;没变化也重查,与模式 1 的「点搜索总是重查」一致)并 `emit('search', { ...cleanParams(params), ...filterToParams() })`;「重置」→ `setMany(resetPatch(...))`(各字段恢复 `defaultValue`、不碰列头漏斗单独管的列)+ 草稿按过滤态重建 + `emit('reset')`;过滤态从**外面**变了(chips × / 列头漏斗 / `setFilter` / `clearFilters`)才重建草稿,且只看构造器管的那部分(`builderSlice`),**别的列的漏斗改了不会冲掉主行里还没提交的输入**。
> chips:`chipsEnabled = filterChips ?? isMode2`(B10,宿主显式写了就听宿主的);宽 / 中档下只有 1 条、且正是主行里那条时不画(`shownChips`);点构造器字段的 chip 开多条件面板(`openBuilderTick`),点只有漏斗管的列的 chip 开对应漏斗。工具栏:`tier` 由根节点宽度(放大态是放大层宽)判定(窄 < 600、中 < 1280、宽 ≥ 1280);宽档整行 1:1 分两半(左 = 标题 + 构造器、右 = 按钮 + 图标),中 / 窄档两行(`head right / cond cond`);窄档批量栏排成「已选 N 项 | 取消选择」+ 宿主按钮整行、控件 `large`(40px)、右侧图标收起。**宿主 `toolbar: false` 时模式 2 的构造器仍在**(它是搜索区,不是内置图标)。

**Files:**
- Create: `tests/SmartTable.mode2.test.ts`、`playground/DemoMode2.vue`
- Modify: `src/SmartTable.vue`、`src/Toolbar.vue`、`playground/App.vue`

**Interfaces:**
- Consumes: Task 5 的 `resolveSearchContainer` / `deriveBuilderDefs` / `draftFromState` / `draftMatchesState` / `patchFromDraft` / `resetPatch` / `BuilderDraft`、`useFilters.setMany`;Task 6 的 `ConditionBar`;Task 3 的 `scopeEl()` / `rootWidth`;P0 的 `filterToParams` / `cleanParams` / `filterChips`。
- Produces:
  - `Toolbar` prop `tier: 'narrow' | 'mid' | 'wide'`(默认 `'wide'`);插槽 `#cond`;根元素类 `smart-table-toolbar--cond` + `smart-table-toolbar--{tier}`、`smart-table-toolbar--batch-narrow`;取消选择按钮窄档 `size="large"`。
  - `SmartTable` 内部:`searchContainer` / `isMode2`、`headerFilterDefs`、`builder`(`{ fields, extra }`)、`filterDefs`(= 列头的 + `extra`)、`builderDraft` / `builderSlice` / `builderAppliedCount` / `openBuilderTick`、`onBuilderSearch` / `onBuilderReset`、`shownChips`、`tier`;`emit('search')` 的 JSDoc 写明两种载荷。
  - `DemoMode2.vue`(页签「条件构造器」)的测试钩子:`data-testid` = `container` / `hostw` / `remote` / `set-filter` / `last-params` / `m2-host`。

- [ ] **Step 1: 写失败的测试**

Create `tests/SmartTable.mode2.test.ts`:
```ts
// @vitest-environment jsdom
// 模式 2 条件构造器(search: { container: 'table' })接线:容器解析、数据通路(请求形状 / @search / @reset / 本地过滤)、chips 默认开(B10)、窄档、与列头漏斗共用过滤态
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import SmartTable from '../src/SmartTable.vue'
import FilterChips from '../src/FilterChips.vue'
import ConditionBar from '../src/ConditionBar.vue'
import type { BuilderDraft } from '../src/conditionBuilder'
import type { SmartTableColumn } from '../src/types'

interface Row {
  id: number
  name: string
  code: string
  amount: number
}
const rows: Row[] = [
  { id: 1, name: 'alice', code: 'A1', amount: 10 },
  { id: 2, name: 'bob', code: 'B2', amount: 200 },
  { id: 3, name: 'carol', code: 'A3', amount: 300 },
]
const columns: SmartTableColumn<unknown>[] = [
  { key: 'name', title: '名称', search: true }, // 只写 search:进构造器,没有漏斗
  { key: 'code', title: '编码', search: true, filter: true }, // 两个都写:构造器与漏斗共用过滤态
  { key: 'amount', title: '金额', search: { type: 'number' } },
  { key: 'plain', title: '没有 search' },
]
const T2 = { container: 'table' as const }

const mounted: VueWrapper[] = []
const fetcher = () => vi.fn(async (_p: Record<string, unknown>) => ({ items: rows, total: rows.length }))
function mountTable(props: Record<string, unknown> = {}, opts: Record<string, unknown> = {}) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const w = mount(SmartTable, {
    props: { columns, rowKey: 'id', search: T2, pagination: false, ...props },
    attachTo: host,
    ...opts,
  })
  mounted.push(w)
  return w
}
const mainInput = () => document.querySelector<HTMLInputElement>('.smart-table-cond__main input.n-input__input-el')!
const type = async (el: HTMLInputElement, value: string) => {
  el.value = value
  el.dispatchEvent(new Event('input', { bubbles: true }))
  await nextTick()
}
const btn = (text: string) => [...document.querySelectorAll<HTMLElement>('.smart-table-cond__main > .n-button')].find((b) => b.textContent!.trim() === text)!
const click = async (el: Element) => {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  await flushPromises()
}
const chipTexts = () => [...document.querySelectorAll('.smart-table-chip:not(.smart-table-chip--more)')].map((c) => c.textContent!.trim())
const lastParams = (f: ReturnType<typeof fetcher>) => f.mock.calls.at(-1)![0]

// 窄档要靠根元素宽度:jsdom 没有 ResizeObserver,换一个能手动触发的桩(同 tests/SmartTable.test.ts 的分页窄档用例)
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

beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }))
})
afterEach(() => {
  while (mounted.length) mounted.pop()!.unmount()
  document.body.innerHTML = ''
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('container × layout 的解析与渲染', () => {
  const search = (cfg: Record<string, unknown>) => mountTable({ data: rows, search: cfg })
  const has = (sel: string) => !!document.querySelector(sel)

  it("默认 / container: 'card':独立搜索卡片 + 网格,没有构造器", () => {
    search({})
    expect(has('.smart-table-search')).toBe(true)
    expect(has('.smart-table-cond')).toBe(false)
  })

  it("旧写法 layout: 'inline'(没写 container)= 'none':内联表单,没有卡片、没有构造器(2.1.1 行为不变)", () => {
    search({ layout: 'inline' })
    expect(has('.smart-table-search-inline')).toBe(true)
    expect(has('.smart-table-search')).toBe(false)
    expect(has('.smart-table-cond')).toBe(false)
  })

  it("container: 'none':内联表单", () => {
    search({ container: 'none' })
    expect(has('.smart-table-search-inline')).toBe(true)
  })

  it("container: 'table':构造器进工具栏,没有搜索卡片;container 优先于 layout(同时写 layout: 'inline' 仍是构造器)", () => {
    search({ container: 'table', layout: 'inline' })
    expect(has('.smart-table-cond__main')).toBe(true)
    expect(has('.smart-table-search')).toBe(false)
    expect(has('.smart-table-search-inline')).toBe(false)
  })

  it("container: 'card' + layout: 'inline' → container 赢:卡片 + 网格", () => {
    search({ container: 'card', layout: 'inline' })
    expect(has('.smart-table-search')).toBe(true)
    expect(has('.smart-table-search-inline')).toBe(false)
  })

  it('search: false → 什么搜索区都没有(含模式 2)', () => {
    mountTable({ data: rows, search: false })
    expect(has('.smart-table-cond')).toBe(false)
    expect(has('.smart-table-search')).toBe(false)
  })

  it('没有任何声明 search 的列 → 没有构造器,工具栏原样', () => {
    mountTable({ data: rows, columns: [{ key: 'name', title: 'n' }] as SmartTableColumn<unknown>[] })
    expect(has('.smart-table-cond')).toBe(false)
  })

  it('toolbar: false 时模式 2 的构造器仍在(它是搜索区,不是内置图标)', () => {
    mountTable({ data: rows, toolbar: false })
    expect(has('.smart-table-cond__main')).toBe(true)
  })

  it('字段候选 = 声明了 search 的列(含只写 search 的):主行字段下拉的选项', () => {
    mountTable({ data: rows })
    expect(document.querySelectorAll('.smart-table-cond__main .n-select').length).toBeGreaterThan(0)
    // 漏斗只挂在写了 filter 的列上
    expect(document.querySelector('th[data-col-key="code"] .smart-table-filter-trigger')).not.toBeNull()
    expect(document.querySelector('th[data-col-key="name"] .smart-table-filter-trigger')).toBeNull()
  })
})

describe('数据通路:搜索 / 重置 / @search / 请求形状(远程)', () => {
  it('敲字不提交;点「搜索」才请求:filters 带 field / logic / conditions,回第 1 页;没有扁平搜索键', async () => {
    const f = fetcher()
    mountTable({ fetcher: f })
    await flushPromises()
    expect(f).toHaveBeenCalledTimes(1)
    expect(lastParams(f)).not.toHaveProperty('filters')

    await type(mainInput(), 'ali')
    expect(f).toHaveBeenCalledTimes(1) // 只改草稿
    await click(btn('Search'))
    expect(f).toHaveBeenCalledTimes(2)
    expect(lastParams(f)).toMatchObject({ page: 1, filters: [{ field: 'name', logic: 'and', conditions: [{ action: 'contains', value: 'ali' }] }] })
    expect(lastParams(f)).not.toHaveProperty('name') // 模式 2 不发扁平参数
  })

  it('@search 的载荷 = 序列化后的条件(与随后的请求一致);回车(值输入框 keyup Enter)等价点「搜索」', async () => {
    const f = fetcher()
    const w = mountTable({ fetcher: f })
    await flushPromises()
    await type(mainInput(), 'bob')
    mainInput().dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }))
    await flushPromises()
    expect(f).toHaveBeenCalledTimes(2)
    expect(w.emitted('search')![0][0]).toEqual({ filters: [{ field: 'name', logic: 'and', conditions: [{ action: 'contains', value: 'bob' }] }] })
  })

  it('没有任何变化再点「搜索」:仍然重查一次(与模式 1 的「点搜索总是重查」一致),且 @search 仍发出', async () => {
    const f = fetcher()
    const w = mountTable({ fetcher: f })
    await flushPromises()
    await type(mainInput(), 'ali')
    await click(btn('Search'))
    await click(btn('Search'))
    expect(f).toHaveBeenCalledTimes(3)
    expect(w.emitted('search')).toHaveLength(2)
  })

  it('一次「搜索」提交多个字段:filterChange 只发一次(key 为空串 = 批量),远程只重查一次,filters 带两个字段', async () => {
    const f = fetcher()
    const w = mountTable({ fetcher: f })
    await flushPromises()
    // 草稿里有两个字段的条件(面板里加行再换字段的结果;这里直接让构造器发出 update:draft,免得在 jsdom 里点 NSelect)
    const draft: BuilderDraft = {
      rows: [
        { field: 'name', action: 'contains', value: 'ali' },
        { field: 'amount', action: 'gt', value: 100 },
      ],
      logic: {},
    }
    w.findComponent(ConditionBar).vm.$emit('update:draft', draft)
    await nextTick()
    await click(btn('Search'))
    expect(w.emitted('filterChange')).toHaveLength(1)
    expect(w.emitted('filterChange')![0][0]).toBe('')
    expect(f).toHaveBeenCalledTimes(2) // 首次 + 这一次,不是每个字段各查一次
    expect((lastParams(f).filters as Array<{ field: string }>).map((x) => x.field).sort()).toEqual(['amount', 'name'])
  })

  it('「重置」:清空构造器条件并重查,发 @reset;主行值回到空', async () => {
    const f = fetcher()
    const w = mountTable({ fetcher: f })
    await flushPromises()
    await type(mainInput(), 'ali')
    await click(btn('Search'))
    expect(lastParams(f)).toHaveProperty('filters')
    await click(btn('Reset'))
    expect(f).toHaveBeenCalledTimes(3)
    expect(lastParams(f)).not.toHaveProperty('filters')
    expect(w.emitted('reset')).toHaveLength(1)
    expect(mainInput().value).toBe('')
  })

  it('「重置」恢复 search.defaultValue(模式 1 的扁平标量 → 一条初始条件),它也进首次请求', async () => {
    const f = fetcher()
    const cols: SmartTableColumn<unknown>[] = [{ key: 'name', title: '名称', search: { defaultValue: 'al' } }]
    mountTable({ fetcher: f, columns: cols })
    await flushPromises()
    expect(lastParams(f)).toMatchObject({ filters: [{ field: 'name', conditions: [{ action: 'contains', value: 'al' }] }] })
    await type(mainInput(), 'zzz')
    await click(btn('Search'))
    await click(btn('Reset'))
    expect(lastParams(f)).toMatchObject({ filters: [{ field: 'name', conditions: [{ action: 'contains', value: 'al' }] }] })
  })

  it('自定义 filterSerializer 照样接管序列化(模式 2 不改请求形状的出口)', async () => {
    const f = fetcher()
    mountTable({ fetcher: f, filterSerializer: (s: Record<string, unknown>) => ({ q: Object.keys(s).join(',') }) })
    await flushPromises()
    await type(mainInput(), 'ali')
    await click(btn('Search'))
    expect(lastParams(f)).toMatchObject({ q: 'name' })
  })
})

describe('静态 data:只写 search 的列也能本地过滤', () => {
  it('搜索 → 表格只剩命中行;重置 → 恢复全部', async () => {
    const w = mountTable({ data: rows })
    const names = () => [...document.querySelectorAll('tbody td[data-col-key="name"]')].map((e) => e.textContent!.trim())
    expect(names()).toEqual(['alice', 'bob', 'carol'])
    await type(mainInput(), 'ar') // carol
    await click(btn('Search'))
    await flushPromises()
    expect(names()).toEqual(['carol'])
    await click(btn('Reset'))
    await flushPromises()
    expect(names()).toEqual(['alice', 'bob', 'carol'])
    expect(w.emitted('search')).toHaveLength(1)
  })
})

describe('已生效条件 chips:模式 2 默认开(B10)', () => {
  const setFilter = (w: VueWrapper, key: string, ...vals: string[]) =>
    (w.vm as unknown as { setFilter: (k: string, v: unknown) => void }).setFilter(key, {
      logic: 'and',
      conditions: vals.map((v) => ({ action: 'contains', value: v })),
    })

  it('模式 2 默认开;filterChips: false 关;模式 1 默认关(P0 行为不变)', async () => {
    const w = mountTable({ data: rows })
    setFilter(w, 'name', 'a', 'o') // 同字段 2 条
    await nextTick()
    expect(w.findComponent(FilterChips).exists()).toBe(true)
    w.unmount()
    mounted.pop()

    const off = mountTable({ data: rows, filterChips: false })
    setFilter(off, 'name', 'a', 'o')
    await nextTick()
    expect(off.findComponent(FilterChips).exists()).toBe(false)
    off.unmount()
    mounted.pop()

    const m1 = mountTable({ data: rows, search: {} })
    ;(m1.vm as unknown as { setFilter: (k: string, v: unknown) => void }).setFilter('code', { logic: 'and', conditions: [{ action: 'contains', value: 'A' }] })
    await nextTick()
    expect(m1.findComponent(FilterChips).exists()).toBe(false)
  })

  it('宽 / 中档:只有 1 条、且是构造器主行里的那条 → 不画(主行已显示);≥ 2 条才画', async () => {
    const w = mountTable({ data: rows })
    setFilter(w, 'name', 'a')
    await nextTick()
    expect(chipTexts()).toEqual([])
    setFilter(w, 'name', 'a', 'o')
    await nextTick()
    expect(chipTexts()).toHaveLength(2)
  })

  it('宽 / 中档:1 条且不是构造器字段(孤儿键)→ 照常画(主行里看不到它)', async () => {
    const w = mountTable({ data: rows })
    setFilter(w, 'ghost', 'x')
    await nextTick()
    expect(chipTexts()).toHaveLength(1)
  })

  it('点构造器字段的 chip → 多条件面板打开(aria-expanded);删 chip 的 × → 过滤态与主行同步', async () => {
    const w = mountTable({ data: rows })
    setFilter(w, 'name', 'a', 'o')
    await nextTick()
    const chip = document.querySelector<HTMLElement>('.smart-table-chip:not(.smart-table-chip--more)')!
    chip.click()
    await flushPromises()
    expect(document.querySelector('.smart-table-cond__more button')!.getAttribute('aria-expanded')).toBe('true')
    document.querySelector<HTMLElement>('.smart-table-chip:not(.smart-table-chip--more) .n-base-close')!.click()
    await flushPromises()
    const state = (w.vm as unknown as { filters: Record<string, { conditions: unknown[] }> }).filters
    expect(state.name.conditions).toHaveLength(1)
  })
})

describe('与列头漏斗共用同一份过滤态', () => {
  it('漏斗(setFilter)写的条件 → 构造器主行同步(字段 / 值);构造器搜索 → 漏斗变激活', async () => {
    const w = mountTable({ data: rows })
    ;(w.vm as unknown as { setFilter: (k: string, v: unknown) => void }).setFilter('code', { logic: 'and', conditions: [{ action: 'contains', value: 'A' }] })
    await flushPromises()
    expect(mainInput().value).toBe('A') // 第 1 行 = code 的条件(构造器字段顺序里 name 没有生效条件,code 排第一)
    expect(document.querySelector('th[data-col-key="code"] .smart-table-filter-trigger--active')).not.toBeNull()
  })

  it('构造器搜索 code → 漏斗激活;列头只写 filter 的键(不属于构造器)的条件不被「重置」清掉', async () => {
    const cols: SmartTableColumn<unknown>[] = [...columns, { key: 'hdr', title: '只有漏斗', filter: true }]
    const w = mountTable({ data: rows, columns: cols })
    const v = w.vm as unknown as { setFilter: (k: string, val: unknown) => void; filters: Record<string, unknown> }
    v.setFilter('hdr', { logic: 'and', conditions: [{ action: 'contains', value: 'x' }] })
    await flushPromises()
    await type(mainInput(), 'ali')
    await click(btn('Search'))
    expect(Object.keys(v.filters).sort()).toEqual(['hdr', 'name'])
    await click(btn('Reset'))
    expect(Object.keys(v.filters)).toEqual(['hdr']) // 构造器字段清了,漏斗管的 hdr 还在
  })

  it('过滤态在外面变了但构造器字段没变(别的列漏斗改了)→ 主行里还没提交的输入不被冲掉', async () => {
    const cols: SmartTableColumn<unknown>[] = [...columns, { key: 'hdr', title: '只有漏斗', filter: true }]
    const w = mountTable({ data: rows, columns: cols })
    await type(mainInput(), 'unsent')
    ;(w.vm as unknown as { setFilter: (k: string, v: unknown) => void }).setFilter('hdr', { logic: 'and', conditions: [{ action: 'contains', value: 'x' }] })
    await flushPromises()
    expect(mainInput().value).toBe('unsent')
  })
})

describe('窄档(根元素宽 < 600):输入框 + 筛选', () => {
  async function narrowTable(width: number, props: Record<string, unknown> = {}) {
    RO.instances = []
    vi.stubGlobal('ResizeObserver', RO)
    const w = mountTable({ data: rows, ...props })
    Object.defineProperty(w.element, 'clientWidth', { value: width, configurable: true })
    RO.instances.forEach((i) => i.cb())
    await nextTick()
    return w
  }

  it('宽 ≥ 1280 / 中 600–1279:字段 + 比较符 + 值;< 600:只有输入框 + 「筛选」,没有字段 / 比较符下拉和「搜索」按钮', async () => {
    const wide = await narrowTable(1400)
    expect(document.querySelector('.smart-table-cond--wide')).not.toBeNull()
    wide.unmount()
    mounted.pop()
    const mid = await narrowTable(900)
    expect(document.querySelector('.smart-table-cond--mid')).not.toBeNull()
    mid.unmount()
    mounted.pop()
    await narrowTable(500)
    expect(document.querySelector('.smart-table-cond--narrow')).not.toBeNull()
    expect(document.querySelector('.smart-table-cond__field')).toBeNull()
    expect(document.querySelector('.smart-table-cond--narrow button')!.textContent!.trim()).toBe('Filter')
    expect(document.querySelector('.smart-table-cond--narrow input')!.getAttribute('placeholder')).toBe('Search 名称') // 渲染期求值的 {field}
  })

  it('窄档回车 = 搜索;窄档 chips 有 1 条就画', async () => {
    const f = fetcher()
    const w = await narrowTable(500, { data: undefined, fetcher: f })
    await flushPromises()
    const input = document.querySelector<HTMLInputElement>('.smart-table-cond--narrow input')!
    await type(input, 'ali')
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }))
    await flushPromises()
    expect(lastParams(f)).toMatchObject({ filters: [{ field: 'name' }] })
    expect(chipTexts()).toHaveLength(1)
    expect(document.querySelector('.smart-table-cond__badge')!.textContent!.trim()).toBe('1')
    expect(w.emitted('search')).toHaveLength(1)
  })

  it('窄档批量栏:根上带 --batch-narrow(CSS 排成「已选 N 项 | 取消选择」一行 + 宿主按钮整行),取消选择按钮是 large(40px)', async () => {
    RO.instances = []
    vi.stubGlobal('ResizeObserver', RO)
    const w = mountTable(
      { columns: [{ type: 'selection' }, ...columns], data: rows },
      { attrs: { checkedRowKeys: [1] }, slots: { batch: () => 'x' } },
    )
    Object.defineProperty(w.element, 'clientWidth', { value: 500, configurable: true })
    RO.instances.forEach((i) => i.cb())
    await nextTick()
    expect(document.querySelector('.smart-table-toolbar--batch-narrow')).not.toBeNull()
    // 官方 NButton 的尺寸在内联 CSS 变量里:large = heightLarge 40px(medium 34px)
    expect(document.querySelector('.smart-table-batch > .n-button')!.getAttribute('style')).toContain('--n-height: 40px')
  })

  it('窄档点「筛选」→ 抽屉打开(aria-expanded);抽屉里是同一份多条件面板(堆叠排布)', async () => {
    await narrowTable(500)
    document.querySelector<HTMLElement>('.smart-table-cond--narrow button')!.click()
    await flushPromises()
    await new Promise((r) => setTimeout(r, 60))
    expect(document.querySelector('.smart-table-cond--narrow button')!.getAttribute('aria-expanded')).toBe('true')
    expect(document.querySelector('.smart-table-cond-panel--stack')).not.toBeNull()
  })
})
```

- [ ] **Step 2: 跑,确认失败**

Run: `npx vitest run tests/SmartTable.mode2.test.ts`
Expected: FAIL —— `Test Files  1 failed (1)`、`Tests  24 failed | 4 passed (28)`(模式 2 还没接线;只有 4 条默认行为的用例碰巧通过,如「默认 / `container: 'card'` 是独立搜索卡片」「旧 `layout: 'inline'` 行为不变」)。

- [ ] **Step 3: 实现**

**3a. `src/Toolbar.vue`:`#cond` 插槽、三档排布、窄档批量栏**
```diff
--- a/src/Toolbar.vue
+++ b/src/Toolbar.vue
@@ -23,6 +23,8 @@
    * (原型 .bt-info:本页行全勾上 = 选中,否则 = 半选)。出现条件由 SmartTable 判断(有 selection 列、传了 #batch、宿主绑了 checked-row-keys、且有勾选)。
    */
   batch: { type: Object as PropType<{ count: number; checked: boolean; indeterminate: boolean } | null>, default: null },
+  /** 容器宽档位(模式 2 的 #cond 插槽用):宽 ≥ 1280 单行三段式、中 < 1280 两行、窄 < 600 两行(第 2 行是「输入框 + 筛选」)。 */
+  tier: { type: String as PropType<'narrow' | 'mid' | 'wide'>, default: 'wide' },
   /** 放大按钮是否显示(toolbar.maximize 开启),以及当前是否处于放大态(状态在 SmartTable)。 */
   maximizable: { type: Boolean, default: false },
   maximized: { type: Boolean, default: false },
@@ -94,7 +96,15 @@
 </script>
 
 <template>
-  <div ref="rootRef" class="smart-table-toolbar" :class="{ 'smart-table-toolbar--batch': !!batch }" :style="rootStyle">
+  <div
+    ref="rootRef"
+    class="smart-table-toolbar"
+    :class="[
+      { 'smart-table-toolbar--batch': !!batch, 'smart-table-toolbar--batch-narrow': !!batch && tier === 'narrow' },
+      $slots.cond && !batch ? ['smart-table-toolbar--cond', `smart-table-toolbar--${tier}`] : '',
+    ]"
+    :style="rootStyle"
+  >
     <!-- 批量栏:替换「标题 + 业务按钮 + 更多」;内置图标组(下面的 .smart-table-toolbar-icons)留着 -->
     <div v-if="batch" class="smart-table-toolbar-main smart-table-batch">
       <span class="smart-table-batch-info">
@@ -107,7 +117,22 @@
         {{ fmt(labels.selectedCount, { n: batch.count }) }}
       </span>
       <div class="smart-table-batch-acts"><slot name="batch" /></div>
-      <n-button quaternary @click="emit('clearSelection')">{{ labels.clearSelection }}</n-button>
+      <n-button quaternary :size="tier === 'narrow' ? 'large' : 'medium'" @click="emit('clearSelection')">{{ labels.clearSelection }}</n-button>
+    </div>
+    <!-- 模式 2:标题 + 条件构造器(#cond)。宽档整行 1:1 分成两半(左 = 标题 + 构造器,右 = 按钮 + 图标);中 / 窄档 main 退场(display: contents),
+         标题 / 构造器 / 右半区落进各自的网格区域,构造器独占第 2 行 -->
+    <div v-else-if="$slots.cond" class="smart-table-toolbar-main smart-table-toolbar-main--cond">
+      <div class="smart-table-toolbar-head">
+        <h3
+          v-if="$slots.title || title"
+          class="smart-table-title"
+          :style="{ color: themeVars.textColor1, fontWeight: themeVars.fontWeightStrong }"
+        >
+          <slot name="title">{{ title }}</slot>
+        </h3>
+        <slot name="left" />
+      </div>
+      <div class="smart-table-toolbar-cond"><slot name="cond" /></div>
     </div>
     <div v-else class="smart-table-toolbar-main">
       <!-- 标题取主题的 textColor1 / fontWeightStrong(与官方卡片标题一致;设计原型 .st-title:16px / 500 / textColor1)。
@@ -242,6 +267,64 @@
 .smart-table-more-icon {
   display: inline-flex;
 }
+/* 模式 2(设计 2.11):宽档整行 1:1 —— 左半 = 标题 + 条件构造器,右半 = 按钮 + 图标(靠右);单行阈值 1280 由 SmartTable 的 tier 给 */
+.smart-table-toolbar--cond.smart-table-toolbar--wide {
+  display: grid;
+  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
+  column-gap: 12px;
+}
+.smart-table-toolbar--wide .smart-table-toolbar-right {
+  justify-self: end;
+}
+.smart-table-toolbar-main--cond {
+  display: flex;
+  align-items: center;
+  gap: 12px;
+  min-width: 0;
+}
+.smart-table-toolbar-head {
+  display: flex;
+  align-items: center;
+  gap: 12px;
+  flex: 0 1 auto;
+  min-width: 0;
+}
+/* 标题始终保留,放不下时单行省略(不作为第一个被牺牲的元素) */
+.smart-table-toolbar-head .smart-table-title {
+  overflow: hidden;
+  text-overflow: ellipsis;
+  white-space: nowrap;
+}
+.smart-table-toolbar-cond {
+  flex: 1 1 0;
+  min-width: 0;
+}
+/* 中 / 窄档:两行 —— 行 1「标题 … 按钮 + 图标」,行 2 构造器(窄档的构造器自己画成「输入框 + 筛选」) */
+.smart-table-toolbar--cond.smart-table-toolbar--mid,
+.smart-table-toolbar--cond.smart-table-toolbar--narrow {
+  display: grid;
+  grid-template-columns: minmax(0, 1fr) auto;
+  grid-template-areas:
+    'head right'
+    'cond cond';
+  gap: 10px 12px;
+}
+.smart-table-toolbar--mid .smart-table-toolbar-main--cond,
+.smart-table-toolbar--narrow .smart-table-toolbar-main--cond {
+  display: contents;
+}
+.smart-table-toolbar--mid .smart-table-toolbar-head,
+.smart-table-toolbar--narrow .smart-table-toolbar-head {
+  grid-area: head;
+}
+.smart-table-toolbar--mid .smart-table-toolbar-cond,
+.smart-table-toolbar--narrow .smart-table-toolbar-cond {
+  grid-area: cond;
+}
+.smart-table-toolbar--mid .smart-table-toolbar-right,
+.smart-table-toolbar--narrow .smart-table-toolbar-right {
+  grid-area: right;
+}
 /* 批量栏(设计原型 .tb-batch):复选框 + 「已选 N 项」(34px 高)、宿主按钮组(间距 8)、取消选择,间距 12;内容贴第 1 行顶部(根元素 min-height 占位,
    两行高的中档工具栏勾选后内容不往中间飘);内置图标组仍在右侧,34px 高 */
 .smart-table-toolbar--batch {
@@ -268,4 +351,34 @@
 .smart-table-toolbar--batch .smart-table-toolbar-icons {
   height: 34px;
 }
+/* 窄档批量栏(原型 .tb-batch @ < 600):第 1 行「已选 N 项 | 取消选择」,第 2 行宿主按钮整行等分;右侧内置图标收起。控件 40px(large) */
+.smart-table-toolbar--batch-narrow {
+  display: block;
+}
+.smart-table-toolbar--batch-narrow .smart-table-batch {
+  display: grid;
+  grid-template-columns: minmax(0, 1fr) auto;
+  grid-template-areas:
+    'info clear'
+    'acts acts';
+  gap: 10px 12px;
+}
+.smart-table-toolbar--batch-narrow .smart-table-batch-info {
+  grid-area: info;
+  min-width: 0;
+  height: 40px;
+}
+.smart-table-toolbar--batch-narrow .smart-table-batch > .n-button {
+  grid-area: clear;
+}
+.smart-table-toolbar--batch-narrow .smart-table-batch-acts {
+  grid-area: acts;
+}
+.smart-table-toolbar--batch-narrow .smart-table-batch-acts > * {
+  flex: 1 1 0;
+  justify-content: center;
+}
+.smart-table-toolbar--batch-narrow .smart-table-toolbar-right {
+  display: none;
+}
 </style>
```

**3b. `src/SmartTable.vue`:容器解析、过滤项分层、草稿、搜索 / 重置、chips、判档、`#cond` 接线**(模板里 `Toolbar` 多传 `:tier`、多一个 `#cond` 插槽;`FilterChips` 改读 `shownChips`)
```diff
--- a/src/SmartTable.vue
+++ b/src/SmartTable.vue
@@ -44,11 +44,20 @@
   useColumns,
   type FilterDef,
 } from './useColumns'
-import { applyFilters } from './filter'
+import { activeConditions, applyFilters } from './filter'
 import { buildChips, filtersAtDefaults, hasActiveDefaults, removeChipCondition } from './filterChips'
 import { mergePageSizes, resolveDefaultPageSize } from './pageSize'
 import { mergeCardProps } from './cardStyle'
 import { keepCardTopVisible } from './scrollToCard'
+import {
+  deriveBuilderDefs,
+  draftFromState,
+  draftMatchesState,
+  patchFromDraft,
+  resetPatch,
+  resolveSearchContainer,
+  type BuilderDraft,
+} from './conditionBuilder'
 import { hasOpenFloat, isKeyboardModality, lockScroll, loopTab, resolveMaximize, trackInputModality, unlockScroll } from './maximize'
 import { collectSorters, deriveInitSorts, normalizeSorterEvent, sortToParams, sortTransition } from './sorts'
 import { useFilters } from './useFilters'
@@ -59,6 +68,7 @@
 import ColumnSettings from './ColumnSettings.vue'
 import ColumnFilter from './ColumnFilter.vue'
 import FilterChips from './FilterChips.vue'
+import ConditionBar from './ConditionBar.vue'
 import MaximizeLayer from './MaximizeLayer'
 import { ref } from 'vue'
 import { useRowDrag } from './useRowDrag'
@@ -95,6 +105,7 @@
 })
 
 const emit = defineEmits<{
+  /** 点「搜索」/ 回车。模式 1:清洗后的扁平搜索参数;模式 2:`filterSerializer` 序列化后的条件(默认 `{ filters: [...] }`),与随后的请求一致。 */
   search: [params: Record<string, any>]
   reset: []
   loaded: [rows: T[], total: number]
@@ -157,7 +168,14 @@
 
 /* ---- 搜索项与数据核 ---- */
 
-const searchDefs = computed(() => deriveSearchDefs(props.columns))
+/**
+ * 搜索区放哪(规格 §5.1):'card'(默认,独立搜索卡片)/ 'table'(模式 2 条件构造器,并入表格卡片)/ 'none'(无卡片的内联表单,= 旧 layout: 'inline')。
+ * container 优先于 layout。search: false 时没有搜索区。
+ */
+const searchContainer = computed(() => resolveSearchContainer(typeof props.search === 'object' ? props.search : undefined))
+const isMode2 = computed(() => props.search !== false && searchContainer.value === 'table')
+// 模式 2 的搜索条件走过滤态(FilterValue → filterSerializer),不走扁平参数:扁平搜索项为空 → 不渲染 SearchForm,请求里也没有扁平搜索键
+const searchDefs = computed(() => (isMode2.value ? [] : deriveSearchDefs(props.columns)))
 
 // 排序状态(受控):sorter 列点表头 → 写这里 → 并进 fetcher 参数 + 回显箭头。
 // 数组,顺序 = 优先级(列声明的 sorter.multiple 从大到小);初值来自列上的 defaultSortOrder(C2,只在首次 setup 读一次)。
@@ -175,7 +193,12 @@
 // 没有漏斗、不参与本地过滤、也不进请求参数。与 :search="false" 同一套语义。
 const filterEnabled = computed(() => props.filter ?? defaults.filterable)
 
-const filterDefs = computed(() => (filterEnabled.value ? deriveFilterDefs(props.columns) : []))
+/** 列头漏斗用的过滤项:只含写了 filter 的列(挂漏斗、useColumns 只认它)。 */
+const headerFilterDefs = computed(() => (filterEnabled.value ? deriveFilterDefs(props.columns) : []))
+/** 模式 2 的构造器字段(声明了 search 且放得进一行的列);extra = 其中只写了 search、没有列头 filter 的字段。 */
+const builder = computed(() => (isMode2.value ? deriveBuilderDefs(props.columns, headerFilterDefs.value) : { fields: [], extra: [] }))
+/** 过滤态 / 本地过滤 / chips / 序列化认的全部过滤项 = 列头的 + 只写 search 的构造器字段(它们没有漏斗,但同样是 FilterValue)。 */
+const filterDefs = computed(() => [...headerFilterDefs.value, ...builder.value.extra])
 
 const filters = useFilters<T>({
   defs: () => filterDefs.value,
@@ -200,6 +223,39 @@
   return (props.filterSerializer ?? defaults.filterSerializer)(filters.state.value)
 }
 
+/* ---- 模式 2:条件构造器(search: { container: 'table' }) ---- */
+
+const builderFields = computed(() => builder.value.fields)
+const builderKeys = computed(() => new Set(builderFields.value.map((f) => f.key)))
+/** 构造器草稿(工具栏主行 = 第 1 行,气泡 / 抽屉里改的是同一份):点「搜索」/「确认」才提交成过滤态,不是每敲一个字就查。 */
+const builderDraft = ref<BuilderDraft>(draftFromState(filters.state.value, builderFields.value))
+/** 过滤态里构造器管的那部分的快照:只在它变了(chips × / 列头漏斗 / setFilter / clearFilters)时才用过滤态重建草稿,列头漏斗改了别的列不会冲掉主行里还没提交的输入。 */
+const builderSlice = computed(() => JSON.stringify(builderFields.value.map((f) => [f.key, filters.state.value[f.key] ?? null])))
+watch(builderSlice, () => {
+  // 草稿提交后恰好等于过滤态时不重建:免得把用户排好的行序打乱(过滤态按字段分组存)
+  if (!draftMatchesState(builderDraft.value, filters.state.value, builderFields.value)) {
+    builderDraft.value = draftFromState(filters.state.value, builderFields.value)
+  }
+})
+const builderAppliedCount = computed(() => builderFields.value.reduce((n, f) => n + activeConditions(filters.state.value[f.key]).length, 0))
+/** 每次变大 = 请求打开多条件面板(chips 点击)。 */
+const openBuilderTick = ref(0)
+
+/** 「搜索」/ 回车:草稿 → 过滤态(一次 onChange,远程只重查一次)。没有变化也重查(与模式 1 的「点搜索总是重查」一致)。 */
+function onBuilderSearch() {
+  const changed = filters.setMany(patchFromDraft(builderDraft.value, builderFields.value))
+  if (!changed && isRemote.value) void table.search()
+  emit('search', { ...cleanParams(params), ...filterToParams() })
+}
+
+/** 「重置」:构造器字段各自恢复 defaultValue(没有就清空),不碰列头漏斗管的条件;草稿跟着重建。 */
+function onBuilderReset() {
+  const changed = filters.setMany(resetPatch(builderFields.value))
+  builderDraft.value = draftFromState(filters.state.value, builderFields.value)
+  if (!changed && isRemote.value) void table.search()
+  emit('reset')
+}
+
 const table = useSmartTable<T>(
   // 包一层保证始终取最新的 props.fetcher(模板内联箭头每次渲染都是新引用)
   (p) => props.fetcher!(p),
@@ -258,7 +314,7 @@
   indexOffset: () => (isRemote.value ? (pagination.page - 1) * pagination.pageSize : 0),
   defaults,
   sortState: () => sortState.value,
-  filterDefs: () => filterDefs.value,
+  filterDefs: () => headerFilterDefs.value,
   renderFilter: renderColumnFilter,
   resizable: () => props.resizable ?? defaults.resizable,
   hostWidth: () => hostWidth.value,
@@ -299,8 +355,8 @@
 
 /* ---- 已生效条件 chips ---- */
 
-// P0:默认关;模式 2(条件构造器)落地后才会默认开
-const chipsEnabled = computed(() => props.filterChips === true)
+// 模式 2 默认开(B10),其余模式默认关;宿主显式写了 filterChips 就听宿主的
+const chipsEnabled = computed(() => props.filterChips ?? isMode2.value)
 
 /** 字典列的 chip 显示 label 而不是 value;孤儿键(没有列声明,def 为 undefined)没有字典,按原值显示。 */
 function optionLabelOf(def: FilterDef | undefined, value: unknown): string {
@@ -315,12 +371,23 @@
   chipsEnabled.value ? buildChips(filterDefs.value as FilterDef[], filters.state.value, mergedLabels.value, optionLabelOf) : [],
 )
 const chipsHaveDefaults = computed(() => hasActiveDefaults(filterDefs.value as FilterDef[]))
+/**
+ * 真正画出来的 chips:模式 2 宽 / 中档下,只有 1 条、且它就是工具栏主行里那条构造器条件时不画(主行已经显示了,原型如此);
+ * 窄档主行只有输入框,≥ 1 条都画。
+ */
+const shownChips = computed(() => {
+  const items = chipItems.value
+  if (isMode2.value && tier.value !== 'narrow' && items.length === 1 && builderKeys.value.has(items[0].key)) return []
+  return items
+})
 const chipsAtDefaults = computed(() => filtersAtDefaults(filterDefs.value as FilterDef[], filters.state.value))
 
 /** 点 chip = 请求重开该列面板:给对应 ColumnFilter 递增 openRequest。被隐藏的列没有漏斗,递增了也是空操作。 */
 const openTick = reactive<Record<string, number>>({})
 function onChipOpen(key: string) {
-  openTick[key] = (openTick[key] ?? 0) + 1
+  // 构造器管的字段 → 开构造器的多条件面板(它列着该字段的全部条件);只有列头漏斗管的列 → 开对应漏斗
+  if (isMode2.value && builderKeys.value.has(key)) openBuilderTick.value++
+  else openTick[key] = (openTick[key] ?? 0) + 1
 }
 function onChipRemove(key: string, index: number) {
   const v = filters.getFilter(key)
@@ -610,11 +677,12 @@
 
 const searchConfig = computed<SearchFormConfig>(() => {
   const user = typeof props.search === 'object' ? props.search : {}
-  return { cols: defaults.searchCols, ...user } // 用户 cols 覆盖全局默认
+  // SearchForm 只认 layout:container 'none' → 内联,其余 → 网格(container 优先于 layout,见 resolveSearchContainer)
+  return { cols: defaults.searchCols, ...user, layout: searchContainer.value === 'none' ? 'inline' : 'grid' } // 用户 cols 覆盖全局默认
 })
 
 const showToolbar = computed(
-  () => props.toolbar !== false || !!props.title || !!slots.title || !!slots.toolbar,
+  () => props.toolbar !== false || !!props.title || !!slots.title || !!slots.toolbar || (isMode2.value && builderFields.value.length > 0),
 )
 
 /* ---- 批量栏(#batch) ---- */
@@ -785,6 +853,8 @@
 /** 库根节点宽度(ResizeObserver 维护)。< 600 视为窄档:分页不画每页选择器(卡片内宽 ≤ 340 时它会折行)。0 = 还没量到,按非窄档处理。 */
 const rootWidth = ref(0)
 const narrowPager = computed(() => rootWidth.value > 0 && rootWidth.value < 600)
+/** 容器宽三档(设计 2.6 / 2.11;JS 判定而不是 @container:构造器的气泡 / 抽屉本来就要 JS 知道档位,且不给根元素加 container-type 的副作用):窄 < 600、中 < 1280、宽 ≥ 1280。 */
+const tier = computed<'narrow' | 'mid' | 'wide'>(() => (rootWidth.value === 0 ? 'wide' : rootWidth.value < 600 ? 'narrow' : rootWidth.value < 1280 ? 'mid' : 'wide'))
 
 /** 表格总宽下限 = 各列宽度之和(含吸收列的下限)+ 拖拽中的临时增量。scroll-x 与 CSS 变量共用。 */
 const colsWidth = computed(() => columnsApi.scrollX.value + dragDelta.value)
@@ -1070,6 +1140,7 @@
           :density="columnsApi.density.value"
           :remote="isRemote"
           :batch="batchState()"
+          :tier="tier"
           :maximizable="maxCfg.enabled"
           :maximized="maxActive"
           @refresh="refresh"
@@ -1084,6 +1155,23 @@
             <slot name="batch" :checked-row-keys="hostCheckedKeys() ?? []" :clear="clearChecked" />
           </template>
           <template v-if="slots.toolbar" #left><slot name="toolbar" /></template>
+          <template v-if="isMode2 && builderFields.length" #cond>
+            <ConditionBar
+              :fields="builderFields"
+              :draft="builderDraft"
+              :labels="mergedLabels"
+              :get-options="options.getOptions"
+              :is-loading-options="options.isLoading"
+              :date-value-format="defaults.dateValueFormat"
+              :tier="tier"
+              :loading="loading"
+              :applied-count="builderAppliedCount"
+              :open-request="openBuilderTick"
+              @update:draft="(d: BuilderDraft) => (builderDraft = d)"
+              @search="onBuilderSearch"
+              @reset="onBuilderReset"
+            />
+          </template>
           <template v-if="slots['toolbar-right']" #right><slot name="toolbar-right" /></template>
           <template v-if="settingsEnabled" #settings>
             <ColumnSettings
@@ -1098,8 +1186,8 @@
         </Toolbar>
 
         <FilterChips
-          v-if="chipItems.length"
-          :items="chipItems"
+          v-if="shownChips.length"
+          :items="shownChips"
           :labels="mergedLabels"
           :has-defaults="chipsHaveDefaults"
           :at-defaults="chipsAtDefaults"
```

**3c. playground:「条件构造器」场景页**(开关:`container` 三选一、宿主宽度 auto / 1400 / 1000 / 560 / 390、远程 / 静态、编程式 `setFilter`、最近一次请求参数)
```vue
<script setup lang="ts">
// 模式 2 条件构造器场景页(P1 Task 6 / 7 的浏览器验证用):search.container 三种取值、容器宽(三档)、远程 / 静态数据、请求形状
import { computed, ref } from 'vue'
import { NButton, NRadioButton, NRadioGroup, NSpace, NSwitch, useMessage } from 'naive-ui'
import { SmartTable, type SmartTableColumn, type SmartTableInst } from '../src/index'
import { allRows, fetchDeptOptions, mockPage, type DemoRow } from './mock'
import { labels, tt } from './locale'

const message = useMessage()
const container = ref<'card' | 'table' | 'none'>('table')
const hostWidth = ref<number | 'auto'>('auto')
const remote = ref(true)
const lastParams = ref('')
const tableRef = ref<SmartTableInst<DemoRow> | null>(null)

const statusOptions = [
  { label: tt('在职', 'Active'), value: 1, tagType: 'success' as const },
  { label: tt('休假', 'On leave'), value: 2, tagType: 'warning' as const },
  { label: tt('离职', 'Resigned'), value: 3, tagType: 'error' as const },
]

const columns: SmartTableColumn<DemoRow>[] = [
  { type: 'selection', fixed: 'left' },
  // 两个都写:构造器与列头漏斗是同一份条件的两个入口
  { key: 'account', title: tt('账号', 'Account'), width: 130, search: true, filter: true },
  // 只写 search:字段进构造器,表头没有漏斗
  { key: 'name', title: tt('姓名', 'Name'), width: 120, search: true },
  { key: 'deptId', title: tt('部门', 'Department'), width: 120, options: fetchDeptOptions, search: true },
  { key: 'status', title: tt('状态', 'Status'), width: 110, options: statusOptions, tag: true, search: true },
  { key: 'salary', title: tt('薪资', 'Salary'), width: 120, align: 'right', format: 'money', sorter: true, search: { type: 'number' } },
  { key: 'createTime', title: tt('创建时间', 'Created'), width: 190, format: 'datetime', search: { type: 'daterange', label: tt('创建日期', 'Created on') } },
  // 搜索专用列(不进表格)
  { key: 'email', title: 'Email', hideInTable: true, search: { placeholder: tt('邮箱关键字', 'Email keyword')() } },
]

const search = computed(() => ({ container: container.value }))
const style = computed(() => (hostWidth.value === 'auto' ? undefined : { width: `${hostWidth.value}px` }))
function onSearch(p: Record<string, unknown>) {
  lastParams.value = JSON.stringify(p)
  message.info(`@search ${lastParams.value.slice(0, 120)}`)
}
</script>

<template>
  <div>
    <n-space align="center" :size="16" style="margin-bottom: 12px">
      <n-radio-group v-model:value="container" size="small" data-testid="container">
        <n-radio-button value="card">card</n-radio-button>
        <n-radio-button value="table">table</n-radio-button>
        <n-radio-button value="none">none</n-radio-button>
      </n-radio-group>
      <n-radio-group v-model:value="hostWidth" size="small" data-testid="hostw">
        <n-radio-button value="auto">auto</n-radio-button>
        <n-radio-button :value="1400">1400</n-radio-button>
        <n-radio-button :value="1000">1000</n-radio-button>
        <n-radio-button :value="560">560</n-radio-button>
        <n-radio-button :value="390">390</n-radio-button>
      </n-radio-group>
      <label><n-switch v-model:value="remote" size="small" data-testid="remote" /> 远程</label>
      <n-button size="small" data-testid="set-filter" @click="tableRef?.setFilter('account', { logic: 'and', conditions: [{ action: 'startsWith', value: 'user00' }] })">
        编程式 setFilter(account)
      </n-button>
    </n-space>
    <div :style="style" data-testid="m2-host">
      <SmartTable
        :key="`${container}-${remote}`"
        ref="tableRef"
        :columns="columns"
        v-bind="remote ? { fetcher: mockPage } : { data: allRows }"
        :title="tt('人员', 'Staff')()"
        :search="search"
        :labels="labels"
        :default-page-size="100"
        :toolbar="{ more: [{ label: '导出', key: 'export' }], maximize: true }"
        resizable
        @search="onSearch"
        @reset="message.info('@reset')"
        @filter-change="(k: string, _v: unknown, s: Record<string, unknown>) => message.info(`filterChange ${k || '(batch)'} → ${Object.keys(s).length} active`)"
      >
        <template #toolbar-right><NButton size="small" type="primary">新增</NButton></template>
      </SmartTable>
    </div>
    <pre style="font-size: 12px; margin-top: 12px" data-testid="last-params">{{ lastParams }}</pre>
  </div>
</template>
```

`playground/App.vue` 加页签:
```diff
--- a/playground/App.vue
+++ b/playground/App.vue
@@ -8,6 +8,7 @@
 import DemoAbsorb from './DemoAbsorb.vue'
 import DemoFill from './DemoFill.vue'
 import DemoMax from './DemoMax.vue'
+import DemoMode2 from './DemoMode2.vue'
 import { locale, tt } from './locale'
 import { mockState } from './mock'
 
@@ -43,6 +44,7 @@
           <n-tab-pane name="absorb" tab="列宽余量"><DemoAbsorb /></n-tab-pane>
           <n-tab-pane name="fill" tab="铺满"><DemoFill /></n-tab-pane>
           <n-tab-pane name="max" tab="批量 / 放大"><DemoMax /></n-tab-pane>
+          <n-tab-pane name="mode2" tab="条件构造器"><DemoMode2 /></n-tab-pane>
         </n-tabs>
       </div>
     </n-message-provider>
```

- [ ] **Step 4: 跑,确认通过**

Run: `npm test && npm run typecheck`
Expected: `Test Files  32 passed (32)`、`Tests  544 passed (544)`(基线 + 18 + … + 28 = 沙盒 544);typecheck 无输出;无 `[Vue warn]`。**既有测试一条都不能变红**(尤其 `filterChips` / `SmartTable.test.ts` 里 chips 的用例:`filterChips` 缺省在非模式 2 下仍是关)。

- [ ] **Step 5: 浏览器验证(Edge 无头 + CDP)**

Run: `bash .sandbox/p1/_kit/vite-up.sh`,页签「条件构造器」(远程模式、`container: 'table'`)。沙盒实测(`m2flow.mjs` 29 项、`m2narrow.mjs` 12 项、`m2max.mjs` 5 项,**全部 PASS**):

`m2flow.mjs`:初始无搜索卡片、有构造器主行、无 chips,账号列有漏斗而姓名列(只写 `search`)没有;**敲字不提交**(表格仍 100 行),点「搜索」→ 只剩 `user0010`,`@search` 载荷 = `{"filters":[{"field":"account","logic":"and","conditions":[{"action":"contains","value":"user0010"}]}]}`;宽档下 1 条主行条件 → chips 不画;账号列漏斗变激活(同一份过滤态);点 `»` 开面板、加一行(同字段)→ 第 2 行最左是「且 / 或」下拉 → 选「或」、填 `user0020`、确认 → `user0010 + user0020`、请求里 `logic: "or"`、面板关;2 条 → chips 出现(`账号 包含 user0010` / `或 账号 包含 user0020`)、`»` 上角标 2;点 chip → 面板打开;Esc → 面板收起且**焦点回 `»` 按钮**;删掉第 2 条 → 只剩 `user0010`;「重置」→ 回到全部数据、主行值清空、无 chips、漏斗不激活;编程式 `setFilter(account startsWith user00)` → 主行比较符 / 值同步;`container: 'card'` 有搜索卡片、没有构造器;`'none'` 是内联表单。

`m2narrow.mjs`(宿主宽 390):没有字段 / 比较符下拉、只有输入框 + 「筛选」;输入框高 **40**(`large`)、占位 `搜索 账号`;回车 → 搜索 `user0010`;窄档 1 条就画 chips、「筛选」上角标 1;点「筛选」→ 抽屉打开,抽屉里 1 条、堆叠排布(头「条件 1」、`[字段 | 比较符]` 两列、值整行);换字段为「部门」→ 值控件换成下拉;Esc 关抽屉;主行换成部门下拉后**选完即生效**(没点任何按钮,请求里有 `deptId equal 1`)。

`m2max.mjs`:宿主宽 1000 → 中档(`smart-table-cond--mid`);放大后按放大层宽(1440 − 32)重新判档 → 宽档(`--wide`);放大态下气泡能开(层级在放大层之上);Esc#1 只收气泡仍是放大;Esc#2 还原回中档。

**不通过就停下来,不要往下做**;跑完 `bash .sandbox/p1/_kit/vite-down.sh`。

- [ ] **Step 6: 提交**

```bash
git add src/SmartTable.vue src/Toolbar.vue tests/SmartTable.mode2.test.ts playground/DemoMode2.vue playground/App.vue
git commit -m "feat: 模式 2 条件构造器(search.container: 'table')接线;模式 2 默认开 chips(B10);三档工具栏;窄档批量栏" -m "新能力、默认关闭;产出走 filters(filterSerializer),@search 载荷 = 序列化后的条件,点搜索 / 回车才提交;只写 search 的列也能本地过滤;一次提交多字段只触发一次 filter-change;container 优先于 layout" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---


### Task 8: 对照页补 P1 场景(模块 2 = 条件构造器 + 批量栏 + 放大)与原型并排读数

> P0 的对照页(`prototype.html`)注释写着「库做不到的(条件构造器、放大、批量栏…)一律留空」。P1 之后这三样库都做得到了,按 G0(原型与预览功能一模一样)补进对照页:**模块 2 用真实的条件构造器**(`search: { container: 'table' }`;每列的 `search.actions` 取原型的 `OPS_BY_TYPE`,金额的数字框 `showButton: false`;备注是只出现在构造器里的搜索专用列)、**批量栏**(`#batch`:批量审核 + 批量删除,后者是 `NPopconfirm`,与行内「删除」同款)、**放大**(四个模块的工具栏都有,原型每个模块的 `iconsHtml()` 都带放大按钮);`filter-chips` 在模式 2 缺省(= 默认开,B10)、模块 3 / 4 仍显式开。**以后每次改库,都用 `parity-m2.mjs` 在同视口下与原型并排读数**(P0 的 `measure.mjs` 只覆盖模块 1–4 的 P0 部分)。

**Files:**
- Modify: `playground/prototype/ProtoModule.vue`、`tests/prototype.test.ts`

**Interfaces:**
- Consumes: Task 1–7 的全部能力;P0 的对照页(`ProtoApp.vue` / `ProtoModule.vue` / `data.ts` / `fetcher.ts`)与它的 `provide(SMART_TABLE_DEFAULTS, …)`(`zhCNLabels` 打底 + 原型措辞)。
- Produces:对照页模块 2 的 P1 场景;`.sandbox/p1/_kit/tools/parity-m2.mjs`(原型 vs 对照页的并排读数脚本,状态 `base` / `panel` / `batch` / `max` / `sheet`,视口任意)。

- [ ] **Step 1: 写失败的测试**

`tests/prototype.test.ts` 末尾追加:
```diff
--- a/tests/prototype.test.ts
+++ b/tests/prototype.test.ts
@@ -180,3 +180,60 @@
     m2.unmount()
   })
 })
+
+describe('对照页补上的 P1 场景(模块 2 = 条件构造器 + 放大 + 批量栏;所有模块都有放大按钮)', () => {
+  const real = { matchMedia: window.matchMedia, ResizeObserver: (globalThis as any).ResizeObserver }
+  beforeEach(() => {
+    window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })) as any
+    ;(globalThis as any).ResizeObserver = class {
+      observe() {}
+      unobserve() {}
+      disconnect() {}
+    }
+  })
+  afterEach(() => {
+    window.matchMedia = real.matchMedia
+    ;(globalThis as any).ResizeObserver = real.ResizeObserver
+    document.body.innerHTML = ''
+  })
+
+  function mountApp(m: 1 | 2 | 3 | 4) {
+    history.replaceState(null, '', `/prototype.html?m=${m}&theme=light`)
+    return mount(ProtoApp, { attachTo: document.body })
+  }
+
+  it('模块 2 的搜索区是条件构造器(没有独立搜索卡片),字段候选是原型的 8 个字段(含只出现在搜索里的「备注」)', async () => {
+    const w = mountApp(2)
+    await flushPromises()
+    expect(w.find('.smart-table-cond').exists()).toBe(true)
+    expect(w.find('.smart-table-search').exists()).toBe(false)
+    expect(w.findAll('.smart-table-filter-trigger')).toHaveLength(0)
+    w.unmount()
+  })
+
+  it('其余模块没有构造器;4 个模块的工具栏都有「放大」', async () => {
+    for (const m of [1, 2, 3, 4] as const) {
+      const w = mountApp(m)
+      await flushPromises()
+      expect(w.find('button[aria-label="放大"]').exists()).toBe(true)
+      if (m !== 2) expect(w.find('.smart-table-cond').exists()).toBe(false)
+      w.unmount()
+    }
+  })
+
+  it('表头全选 → 批量栏(已选 100 项 + 批量审核 / 批量删除 + 取消选择);取消选择 → 回到工具栏', async () => {
+    const w = mountApp(2)
+    await flushPromises()
+    expect(w.find('.smart-table-batch').exists()).toBe(false)
+    await w.find('thead .n-checkbox').trigger('click') // 虚拟滚动在 jsdom 里没有行可点,用表头全选(选中的是当前页 100 行)
+    await flushPromises()
+    expect(w.find('.smart-table-batch-info').text()).toContain('已选 100 项')
+    expect(w.find('.smart-table-batch').text()).toContain('批量审核')
+    expect(w.find('.smart-table-batch').text()).toContain('批量删除')
+    const clear = w.findAll('.smart-table-batch button').find((b) => b.text() === '取消选择')!
+    await clear.trigger('click')
+    await flushPromises()
+    expect(w.find('.smart-table-batch').exists()).toBe(false)
+    w.unmount()
+  })
+})
```

- [ ] **Step 2: 跑,确认失败**

Run: `npx vitest run tests/prototype.test.ts`
Expected: FAIL —— `Test Files  1 failed (1)`、`Tests  3 failed | 15 passed (18)`(模块 2 还没有构造器 / 放大 / 批量栏;`表头全选` 在 jsdom 里是唯一可点的勾选入口——虚拟滚动在 jsdom 里没有行可点)。

- [ ] **Step 3: 实现**

**`playground/prototype/ProtoModule.vue`**
```diff
--- a/playground/prototype/ProtoModule.vue
+++ b/playground/prototype/ProtoModule.vue
@@ -1,10 +1,10 @@
 <script setup lang="ts">
 // 对照页的一个模块:用真实库(../../src)复刻原型的一张表。
 // 规则:宿主能配的都照原型配(全局默认见 ProtoApp 的 provide、props、插槽里的宿主按钮、fillHeight、collapsible 搜索……);
-// 库做不到的(条件构造器、放大、批量栏、窄档卡片 / 操作折叠 / 筛选抽屉……)一律留空,不用自定义代码假装。
+// 库做不到的(窄档卡片 / 操作折叠 / 列头面板的窄档抽屉……,P2)一律留空,不用自定义代码假装。P1 起模块 2 用真实的条件构造器、批量栏、放大。
 // 库默认就对的地方宿主**不覆盖**:空状态(官方 NEmpty「无数据」)、日期占位(官方 locale 的「选择日期」)、loading(NDataTable 官方样子)。
 import { h, ref } from 'vue'
-import { NButton, NSpace, useMessage } from 'naive-ui'
+import { NButton, NPopconfirm, NSpace, useMessage } from 'naive-ui'
 import { SmartTable, type SmartTableColumn, type SmartTableInst, type FilterAction } from '../../src/index'
 import { addRow, delRow, type Row } from './data'
 import { fetchRows } from './fetcher'
@@ -18,6 +18,8 @@
 const toast = (msg: string) => message.create(msg, { type: 'default' })
 
 const hdr = props.mod === 'filter' || props.mod === 'sort'
+/** 模块 2:搜索区是条件构造器(模式 2),字段 = 声明了 search 的列,比较符取原型的 OPS_BY_TYPE */
+const m2 = props.mod === 'toolbar'
 
 /* ---- 原型 COLS(w = 表格列宽,flex = 弹性列:不写 width、w 当最小宽度) ---- */
 const COLS = [
@@ -72,12 +74,14 @@
       base.options = statusOptions
       base.tag = true
       if (props.mod === 'search') base.search = true
+      else if (m2) base.search = { actions: ACT.select }
       // 原型模块 3:单据状态带 filter.defaultValue = 未审核 —— 初始过滤态 = 默认值,面板「重置」恢复默认,chips 行末偏离默认时出现「恢复默认」
       if (hdr) base.filter = { actions: ACT.select, ...(props.mod === 'filter' ? { defaultValue: STATUS_DEFAULT } : {}) }
       break
     case 'dept':
       base.options = deptOptions
       if (props.mod === 'search') base.search = true
+      else if (m2) base.search = { actions: ACT.select }
       // 原型模块 3:部门是单选勾选列(filter.multiple: false,官方用 NRadio)
       if (hdr) base.filter = { actions: ACT.select, ...(props.mod === 'filter' ? { multiple: false } : {}) }
       break
@@ -85,14 +89,17 @@
       base.align = 'right' // 原型:金额单元格右对齐,表头仍左对齐(titleAlign 取全局默认 left)
       base.format = (v: unknown) => Number(v).toLocaleString()
       if (props.mod === 'search') base.search = { type: 'number', placeholder: '请输入数字', props: { clearable: false, showButton: false } }
+      else if (m2) base.search = { type: 'number', placeholder: '请输入数字', actions: ACT.number, props: { showButton: false } }
       if (hdr) base.filter = { type: 'number', actions: ACT.number }
       break
     case 'bizDate':
       if (props.mod === 'search') base.search = { type: 'date' }
+      else if (m2) base.search = { type: 'date', actions: ACT.date }
       if (hdr) base.filter = { type: 'date', actions: ACT.date }
       break
     default:
       if (props.mod === 'search') base.search = { placeholder: '请输入', props: { clearable: false } }
+      else if (m2) base.search = { placeholder: '请输入', actions: ACT.text }
       if (hdr) base.filter = { type: 'input', actions: ACT.text }
   }
   return base as SmartTableColumn<Row>
@@ -101,10 +108,12 @@
 const columns: SmartTableColumn<Row>[] = [
   { type: 'selection', width: 40 },
   ...COLS.map(fieldCol),
-  // 备注:只在模块 1 的搜索表单里出现,不进表格(原型 FIELD_DEFS 有 memo、COLS 没有)
+  // 备注:只在模块 1 的搜索表单 / 模块 2 的构造器里出现,不进表格(原型 FIELD_DEFS 有 memo、COLS 没有)
   ...(props.mod === 'search'
     ? [{ key: 'memo', title: '备注', hideInTable: true, search: { placeholder: '请输入', props: { clearable: false } } } as SmartTableColumn<Row>]
-    : []),
+    : m2
+      ? [{ key: 'memo', title: '备注', hideInTable: true, search: { placeholder: '请输入', actions: ACT.text } } as SmartTableColumn<Row>]
+      : []),
   {
     key: 'actions',
     title: '操作',
@@ -132,6 +141,17 @@
   else if (key === 'tpl') toast('已下载导入模板')
 }
 
+function onBatchApprove(n: number, clear: () => void) {
+  toast(`已审核 ${n} 项`)
+  clear()
+}
+async function onBatchDelete(keys: Array<string | number>, clear: () => void) {
+  for (const k of keys) delRow(String(k))
+  clear()
+  await tableRef.value?.refresh()
+  toast(`已删除 ${keys.length} 项`)
+}
+
 async function onAdd() {
   const no = addRow()
   await tableRef.value?.refresh()
@@ -145,7 +165,7 @@
 }
 
 /* 模块 1 的搜索区:首行 + 展开 / 收起(collapsible);label 区 70px(库的 labelWidth 含 12px 右内边距 = 原型 62px 文字区 + 8px 间距) */
-const searchCfg = props.mod === 'search' ? { collapsible: true, labelWidth: 70 } : undefined
+const searchCfg = props.mod === 'search' ? { collapsible: true, labelWidth: 70 } : m2 ? { container: 'table' as const } : undefined
 </script>
 
 <template>
@@ -157,10 +177,10 @@
       row-key="no"
       title="物料单据"
       :search="searchCfg"
-      :toolbar="{ more: moreOptions }"
+      :toolbar="{ more: moreOptions, maximize: true }"
       fill-height
       resizable
-      :filter-chips="hdr"
+      :filter-chips="hdr ? true : undefined"
       v-model:checked-row-keys="checked"
       @more-select="onMore"
     >
@@ -173,6 +193,14 @@
           新增
         </n-button>
       </template>
+      <!-- 批量栏(原型 .tb-batch):批量审核 + 批量删除(NPopconfirm,与行内「删除」同款气泡) -->
+      <template #batch="{ checkedRowKeys, clear }">
+        <n-button @click="onBatchApprove(checkedRowKeys.length, clear)">批量审核</n-button>
+        <n-popconfirm @positive-click="onBatchDelete(checkedRowKeys, clear)">
+          <template #trigger><n-button type="error" ghost>批量删除</n-button></template>
+          确认删除所选 {{ checkedRowKeys.length }} 项?
+        </n-popconfirm>
+      </template>
       <template #pagination-prefix="info">共 {{ info.itemCount }} 条</template>
     </SmartTable>
   </div>
```

- [ ] **Step 4: 跑,确认通过**

Run: `npm test && npm run typecheck`
Expected: `Test Files  32 passed (32)`、`Tests  547 passed (547)`(基线 + 18 + … + 3 = 沙盒 547);typecheck 无输出。既有的 4 条对照页用例(含「模块 2 没有搜索卡片也没有漏斗」)仍通过——构造器不是 `.smart-table-search`,也不挂漏斗。

- [ ] **Step 5: 与原型并排读数(Edge 无头 + CDP)**

Run: `bash .sandbox/p1/_kit/vite-up.sh`,然后 `node .sandbox/p1/_kit/tools/parity-m2.mjs <视口宽> <状态>`。脚本在同一个视口下先开原型(`file://…/docs/smart-naive-table-design.html`,点侧栏「按钮与工具栏」)、再开对照页(`/prototype.html?m=2`),按选择器对读 `x,y,w,h`。**沙盒实测**(「相同」= 逐项一致;其余是**有意保留的差异**,原因都写了):

| 视口 / 状态 | 逐项一致 | 有差异的项:原型 → 对照页(原因) |
|---|---|---|
| 1440 · `base`(中档,两行) | 卡片、工具栏(`303,119,1066,78`)、条件行、字段下拉(136)、比较符下拉(112)、图标组(`1277,122,92,28`) | 值输入框 646 → 638、`»` x 1221 → 1213、`搜索` 58 → 56、`重置` 46 → 56、`新增` 77 → 75(**官方 `NButton` 优先**:2 个汉字的官方按钮宽 56;原型的 `quiet` 按钮 `padding: 0 8px`、官方 `quaternary` 是 `0 14px`;`新增` 的 2px 是 P0 已记的官方 / 原型差;以上合计值框少 8px)、标题盒 21 → 25.6 高(行高;垂直中心同在 136)、`th[0]` 40.4 → 39.4(原型 `th` 含表格外框的 1px,设计 10.8 第 8 点) |
| 1920 · `base`(宽档,单行) | 卡片、工具栏(`303,119,1546,34`)、条件行(`379,119,691,34`)、字段、比较符、图标组 | 同上(值框 271 → 263、`»` / `搜索` / `重置` / `新增` 同因) |
| 1440 · `panel`(`»` 面板展开) | 面板(`303,205,660,107`)、第 1 行(`317,219,632,28`)、字段(`145.1`)、比较符、值、页脚(`317,257,632,41`) | 引导标签盒 28 → 19.2 高(同一垂直中心 233)、`添加条件` 102 → 95 宽(官方 small `quaternary` + 13px 图标;原型是自画的 `quiet sm`) |
| 1440 · `batch`(勾 2 行) | 批量栏(`303,119,1066,78`)、`已选 N 项` 区(`303,119,82.5,34`,含复选框)、图标组(`1277,119,92,34`) | 宿主按钮组 180 → 176(官方 `NButton` 宽)、`取消选择` 74 → 84(`quiet` 的 8px vs 官方 14px 内边距) |
| 1440 · `max`(放大) | 放大层(`0,0,1440,900`)、工具栏(`33,33,1374,34`)、卡片(`16,16,1408,868`) | — |
| 390 · `sheet`(窄档筛选抽屉) | 正文高 150.4、页脚(`0,827,390,73`)、条件块(`342 × 142.4`) | 抽屉总高 312.4 → 274.4、头 73 → 51(**官方 `NDrawerContent` 的标题 + 关闭图标优先**;原型是 40px 的大关闭按钮——触屏尺寸,N7 归 P2) |
| 390 · `base`(窄档工具栏) | 卡片宽 366 | 工具栏高 90 → 84、第 2 行输入框 256 → 258 / `筛选` 68 → 66(官方 large 按钮宽)、图标组 120 × 40 → 92 × 28(**窄档的 40px 工具栏按钮与「操作 ▾」折叠归 P2**,本 Task 不做) |
| 390 · `batch`(窄档批量栏) | 栏宽 332、已选区高 40、宿主按钮整行宽 332 | 栏高 90 → 84、已选区 234 → 224、`取消选择` 86 → 96 / 宿主按钮行高 40 → 34(宿主按钮是对照页里默认 `medium`;窄档要不要放大成 `large` 是宿主的事) |

**读数以外的肉眼核对**:`proto-*.png` / `preview-*.png`(`_kit/out/parity/`)两两并排看一遍,重点:字段 / 比较符下拉的箭头、值框右侧放大镜、`»` 的角标、面板的阴影与圆角、明暗两套主题(脚本第 3 个参数传 `1` 出暗色)。**发现新的差异先判断归属**:官方优先(记进上表)/ 库的缺陷(修库、补测试)/ 原型自身缺陷(记给原型一侧,不改库)。

**不通过(出现上表以外的差异)就停下来,不要往下做**;跑完 `bash .sandbox/p1/_kit/vite-down.sh`。

- [ ] **Step 6: 提交**

```bash
git add playground/prototype/ProtoModule.vue tests/prototype.test.ts
git commit -m "test: 对照页补 P1 场景(模块 2 条件构造器 + 批量栏 + 放大),与原型并排读数" -m "模块 2 用真实的 search.container: 'table'(search.actions 取原型 OPS_BY_TYPE);批量栏 = 批量审核 + 批量删除(NPopconfirm);四个模块的工具栏都有放大;差异按「官方优先」记在计划 Task 8" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---


### Task 9: 收尾 —— 版本号、CHANGELOG、README、规格回写、最终验证(`3.0.0-beta.2`)

> 只做「发布前的最后一公里」。**不 `npm publish`。** 规格回写:本计划**不改规格**,把需要回写的条目集中写在文末「规格回写清单」,执行者在 Step 4 逐条回写(以实现为准;规格是实现的依据,必须与代码一致)。

**Files:**
- Modify: `package.json`(+ `package-lock.json`)、`CHANGELOG.md`、`README.md`、`README.en.md`、`docs/smart-naive-table-spec.md`(Step 4,按回写清单)

**Interfaces:**
- Consumes: Task 1–8 的全部产物;`CHANGELOG.md` 里已有 `## 3.0.0-beta.1 - 待发布` 一节(P0 Task 14)。
- Produces: 可发布的 `3.0.0-beta.2` 工作区。

- [ ] **Step 1: 版本号**

Run: `npm version 3.0.0-beta.2 --no-git-tag-version`
Expected: 输出 `v3.0.0-beta.2`;`package.json` 与 `package-lock.json` 的 `version` 都变为 `3.0.0-beta.2`(`git diff package.json package-lock.json` 只有版本号行)。沙盒里 `package.json` 的改动是:
```diff
--- a/package.json
+++ b/package.json
@@ -1,6 +1,6 @@
 {
   "name": "smart-naive-table",
-  "version": "3.0.0-beta.1",
+  "version": "3.0.0-beta.2",
   "description": "Columns-driven data table for Vue 3 + Naive UI: auto search form, remote pagination adapter, dict cell rendering, persistent column settings, density toggle, i18n via labels.",
   "type": "module",
   "license": "Apache-2.0",
```

- [ ] **Step 2: 写 CHANGELOG**

在 `CHANGELOG.md` 顶部(`# Changelog` 之后、`## 3.0.0-beta.1` 之前)加入 `## 3.0.0-beta.2 - 待发布` 一节:
```diff
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -1,5 +1,33 @@
 # Changelog
 
+## 3.0.0-beta.2 - 待发布
+
+> 在 `3.0.0-beta.1` 之上追加 P1。**新能力全部是可选属性、默认关闭,不传任何新属性时,默认行为、DOM 结构与 `3.0.0-beta.1` 一致**(唯一有视觉差异的是列宽拖拽把手,见「外观调整」,只影响开了 `resizable` 的用户;另一处默认可见的变化是库自己的几个气泡现在能用 Esc 关,见「新增」)。
+>
+> 本次变更**只在 naive-ui 2.45.3 上验证过**(`peerDependencies` 仍是 `^2.34.0`)。
+
+### 新增
+
+- **模式 2「条件构造器」**:`search: { container: 'table' }`。搜索区并入表格卡片的一行「字段 + 比较符 + 值」,字段候选 = 声明了 `search` 的列;点「更多条件」(`»`)展开多条件面板(每行与列头过滤面板同一套 `ConditionRow`:引导列「条件」/ 且或、比较符、值、删除;≤ 10 条、且 / 或逐字段、跨字段固定「且」);**产出走 `filters`(`FilterState` + `filterSerializer`),不再产出 `params`**;默认开 `filterChips`(B10,可显式 `filterChips: false` 关掉)。每种控件类型有推荐比较符集合(文本 / 数字 / 日期 / 选项,规格 §5.9,常量导出为 `RECOMMENDED_ACTIONS`),搜索项上可用 `search.actions` 覆盖。窄档(根节点宽 < 600)收成「输入框 + 筛选」,点「筛选」从底部抽屉(官方 `NDrawer`)展开同一份条件面板。**带 `search.render` 的列放不进构造器,不出现在字段候选里**;`daterange` 按 `date` 处理,`switch` 不进构造器;`search.key` 在模式 2 下被忽略。`search.container` 优先于旧的 `search.layout`(`'none'` = 旧 `layout: 'inline'`)。
+  - 模式 2 下 `search` 事件的载荷是 `{ ...params, ...filterToParams() }`(`filters` 序列化后的结果),点「搜索」/ 回车才提交(敲字不提交);`filter-change` 在一次批量提交(「搜索」「重置」)里只触发一次,`key` 为空串。
+  - 工具栏三档(JS 按根节点宽度判定,放大后按放大层宽度重新判定):宽 ≥ 1280 单行(左半 = 标题 + 构造器、右半 = 按钮 + 图标)、中 < 1280 两行(标题 · 按钮 · 图标 / 构造器)、窄 < 600 第 2 行是「输入框 + 筛选」。窄档其余的触屏尺寸(40px 的工具栏按钮、「操作 ▾」折叠)仍归 P2。
+- **`#batch` 批量栏**:有勾选列、写了 `#batch` 插槽、宿主绑了 `checked-row-keys` 且至少勾了一行时,在工具栏位置换成「**本页全选复选框** + 已选 N 项 + 你的操作按钮 + 取消选择」(内置图标组留在右侧),取消勾选后换回工具栏;与工具栏同一 `min-height`,勾选不让表格跳动。插槽参数 `{ checkedRowKeys, clear }`。复选框:本页可勾的行全勾上 = 选中,其余 = 半选(「已选 N 项」是跨页总数);点它并入 / 去掉本页的键,别页的勾选保留,载荷同官方表头全选(`checkAll` / `uncheckAll`)。窄档(< 600)排成「已选 N 项 | 取消选择」一行 + 宿主按钮整行。
+- **`toolbar.maximize`**:「放大」按钮(默认关)。表格在页面内铺满视口(`position: fixed` + Teleport 到 `body`,盖住宿主的侧栏 / 顶栏,**不调用浏览器全屏 API**)。`true` = 层级 1999(刻意低于 naive 浮层的 2000,放大后气泡 / 抽屉 / 下拉仍显示在它上面);`{ zIndex }` = 宿主顶栏层级更高时调大(≥ 2000 会盖住表格自己的气泡,开发期警告一次)。放大层底色 = 官方 `NLayout` embedded 的底色(亮 `actionColor` / 暗 `bodyColor`)。Esc 分层:有浮层打开时先关浮层,下一次 Esc 才还原;还原后只在键盘操作时把焦点放回放大按钮;放大期间锁住页面滚动(`html` 的 `overflow`,多个放大层引用计数)。**挂载后不要在运行时切换 `toolbar.maximize` 的开关**(会重建表格,列宽 / 过滤态的内部状态丢失)。
+- **库自己的气泡现在能用 Esc 关**(不开放大也一样):「更多」菜单、密度菜单、列设置、chips 的「+N」。官方 `NPopover` 不管键盘、`NDropdown` 只有焦点在菜单里才响应 Esc,2.1.1 / beta.1 里这几个按 Esc 没有反应。
+- 新 labels(**全部可选**,`zhCNLabels` 已补中文):`selectedCount`、`clearSelection`、`searchBy`、`searchMoreConditions`、`searchConditionN`、`maximize`、`restore`。
+- 新类型 / 导出:`SearchFormConfig.container`、`SearchConfig.actions`、`ToolbarConfig.maximize`、`SearchContainer`、`RECOMMENDED_ACTIONS`;`useFilters` 新增 `setMany`(一次批量提交,只触发一次 `onChange`);组件插槽新增 `batch`。
+
+### 外观调整(只影响开了 `resizable` 的用户)
+
+| 变更 | 旧(`3.0.0-beta.1` / 2.1.1)→ 新 | 回退方式 |
+|---|---|---|
+| **列宽拖拽把手**(3.11、B12 后半) | 热区落在列界左侧约 8px、只有半格高、静止时画一条细线 → **热区 11px(触屏 24px)骑在列界线上,竖条 3px 压在线上、高度 = 表头整行,静止不画、悬停 / 拖动才显示主色(拖动时再加一圈光晕)**;拖动时有贯穿整表的 1px 引导线、鼠标离开把手后光标仍是 `col-resize` 且不选中文字、开始拖动时收起过滤气泡、松手后 150ms 内吞掉 click(松手落在表头上不再连带触发排序);相邻的固定列的靠前者 `z-index` 依次更高(只处理前 6 列),非固定列把手不会盖到固定列表头上;**触屏**用单指拖动把手(官方把手只认鼠标事件,库把单指 `touch*` 转成合成鼠标事件) | 无(视觉与手势修正;宿主若用 `:deep(.n-data-table-resize-button)` 自己覆盖过样式,请重新核对) |
+
+### 内部
+
+- 新增 `MaximizeLayer`(函数组件,只在开了放大时多包一层 `div.smart-table-layer`;**不开放大时 DOM 与 beta.1 逐节点一致**)、`maximize.ts`、`useEscClose.ts`、`conditionBuilder.ts`、`ConditionPanel.vue`、`ConditionBar.vue`;`ConditionRow` 新增 `size` / `valueOnly` / `placeholder` / `lead` / `searchIcon` 与 `#field` 插槽;`ColumnFilter` 新增 `closeRequest`。
+- 对照页(`/prototype.html`)补上模块 2 的条件构造器 / 批量栏 / 放大,与设计原型逐项对照。
+
 ## 3.0.0-beta.1 - 待发布
 
 > 这是一次 **major** 升级:下面「默认行为变更」里的每一项,**不传任何属性、升级后也会变**。每项都写了回退方式,都是一行属性。
```

- [ ] **Step 3: 同步 README(中英两份)**

`README.md` 与 `README.en.md` 同步改这四处(行首标记定位,不依赖行号;`toolbar` 那一行整行替换成下面的目标文字,P0 Task 14 若已把它改成含 `more` 的版本,这里的目标文字是它的超集):① 「搜索区布局」示例里加一行模式 2 的 `container: 'table'`;② Props 表的 `toolbar` 行(`{ refresh, density, columnSettings, more, maximize }`,`density` / `maximize` 默认关);③ `SearchFormConfig` 表加 `container` 一行;④ 插槽表加 `batch`,事件表 `filter-change` 一行补「模式 2 的批量提交时 `key` 为空串、一次只触发一次」。
````diff
--- a/README.md
+++ b/README.md
@@ -122,6 +122,7 @@
 ```vue
 <SmartTable :search="{ collapsible: true, collapsedRows: 1 }" /> <!-- 超过 1 行时折叠，带展开 / 收起 -->
 <SmartTable :search="{ layout: 'inline' }" />                    <!-- 无卡片、单行排列，适合窄栏 -->
+<SmartTable :search="{ container: 'table' }" />                  <!-- 模式 2:条件构造器(字段 + 比较符 + 值),并入表格卡片,产出走 filters -->
 <SmartTable :search="false" />                                   <!-- 不显示搜索区 -->
 ```
 
@@ -463,7 +464,7 @@
 | `pagination` | `false \| PaginationProps` | — | `false` 隐藏分页；传对象与内置配置合并 |
 | `search` | `false \| SearchFormConfig` | — | 搜索区配置（见下表）；`false` 隐藏 |
 | `filter` | `boolean` | `true` | `false` 关掉全部表头过滤（即使列上写了 `filter`） |
-| `toolbar` | `false \| { refresh, density, columnSettings }` | 全部开启 | 工具栏按钮开关 |
+| `toolbar` | `false \| { refresh, density, columnSettings, more, maximize }` | 刷新(仅远程)、列设置;`density` / `maximize` 默认 `false` | 工具栏按钮开关;`maximize: true` 或 `{ zIndex }` 打开「放大」(页面内铺满视口,层级默认 1999) |
 | `title` | `string` | — | 表格标题，也可用 `#title` 插槽 |
 | `storage-key` | `string` | — | 设置后,列设置(显隐 / 顺序 / 固定 / 列宽)保存到 localStorage;**密度只在开了 `toolbar: { density: true }`(密度按钮)时才读写存储**,否则以 `default-density` 为准 |
 | `default-density` | `'comfortable' \| 'compact'` | `'comfortable'` | 默认密度 |
@@ -481,6 +482,7 @@
 | 字段 | 默认值 | 说明 |
 |---|---|---|
 | `layout` | `'grid'` | `'grid'` 卡片网格；`'inline'` 无卡片单行排列 |
+| `container` | `'card'` | `'card'` 独立搜索卡片(模式 1);`'table'` 条件构造器并入表格卡片(模式 2,产出走 `filters`,默认开 chips,窄档收成「输入框 + 筛选」抽屉);`'none'` = `layout: 'inline'`。优先于 `layout` |
 | `cols` | `'1 s:2 m:3 l:4'` | 网格列数（按屏幕宽度响应） |
 | `labelPlacement` | `'left'` | 标签位置：`'left'` / `'top'` |
 | `labelWidth` | — | 标签宽度 |
@@ -497,7 +499,7 @@
 | `error` | `err` | 请求失败（组件不弹提示，由你处理） |
 | `row-click` | `row, index` | 点击行 |
 | `row-drag-sort` | `{ from, to, reordered }` | 行拖拽结束 |
-| `filter-change` | `key, value, state` | 表头过滤变化（`clearFilters` 时 `key` 为空串） |
+| `filter-change` | `key, value, state` | 表头过滤变化(`clearFilters`、模式 2 的批量提交时 `key` 为空串,且一次批量只触发一次) |
 | `column-resize` | `key, width` | 拖拽列宽（拖动过程中持续触发） |
 
 ### 插槽
@@ -507,6 +509,7 @@
 | `title` | — | 表格标题 |
 | `toolbar` | — | 工具栏左侧，适合放新增、批量操作按钮 |
 | `toolbar-right` | — | 工具栏右侧，位于内置按钮之前 |
+| `batch` | `{ checkedRowKeys, clear }` | 批量栏:有勾选列且勾选了行时替换工具栏(本页全选复选框 + 「已选 N 项」+ 本插槽内容 + 取消选择) |
 | `cell-{key}` | `{ row, index }` | 自定义某列的单元格 |
 | `header-{key}` | `{ column }` | 自定义某列的表头 |
 | `empty` | — | 无数据时显示的内容 |
````
````diff
--- a/README.en.md
+++ b/README.en.md
@@ -122,6 +122,7 @@
 ```vue
 <SmartTable :search="{ collapsible: true, collapsedRows: 1 }" /> <!-- collapse beyond 1 row, with expand / collapse -->
 <SmartTable :search="{ layout: 'inline' }" />                    <!-- no card, single wrapping row for narrow panes -->
+<SmartTable :search="{ container: 'table' }" />                  <!-- mode 2: condition builder (field + operator + value) merged into the table card; emits filters -->
 <SmartTable :search="false" />                                   <!-- no search area -->
 ```
 
@@ -441,7 +442,7 @@
 | `pagination` | `false \| PaginationProps` | — | `false` hides pagination; an object merges over built-in settings |
 | `search` | `false \| SearchFormConfig` | — | Search area config (see below); `false` hides it |
 | `filter` | `boolean` | `true` | `false` turns off every header filter (even on columns declaring `filter`) |
-| `toolbar` | `false \| { refresh, density, columnSettings }` | all on | Toolbar button switches |
+| `toolbar` | `false \| { refresh, density, columnSettings, more, maximize }` | refresh (remote only), column settings; `density` / `maximize` default `false` | Toolbar button switches; `maximize: true` or `{ zIndex }` turns on the "maximize" button (fills the viewport inside the page, z-index 1999 by default) |
 | `title` | `string` | — | Table title, or use the `#title` slot |
 | `storage-key` | `string` | — | Persist column settings (visibility / order / pinning / widths) to localStorage; **density is only read from / written to storage when `toolbar: { density: true }` (the density button) is on** — otherwise `default-density` decides |
 | `default-density` | `'comfortable' \| 'compact'` | `'comfortable'` | Initial density |
@@ -459,6 +460,7 @@
 | Field | Default | Description |
 |---|---|---|
 | `layout` | `'grid'` | `'grid'` card with grid; `'inline'` no card, single wrapping row |
+| `container` | `'card'` | `'card'` standalone search card (mode 1); `'table'` condition builder merged into the table card (mode 2: emits `filters`, chips on by default, collapses to an "input + Filters" drawer on narrow widths); `'none'` = `layout: 'inline'`. Wins over `layout` |
 | `cols` | `'1 s:2 m:3 l:4'` | Grid columns (responsive to screen width) |
 | `labelPlacement` | `'left'` | `'left'` / `'top'` |
 | `labelWidth` | — | Label width |
@@ -475,7 +477,7 @@
 | `error` | `err` | Request failed (the table shows no message; handle it yourself) |
 | `row-click` | `row, index` | Row clicked |
 | `row-drag-sort` | `{ from, to, reordered }` | Row drag finished |
-| `filter-change` | `key, value, state` | A header filter changed (`key` is `''` for `clearFilters`) |
+| `filter-change` | `key, value, state` | A header filter changed (`key` is `''` for `clearFilters` and for a mode-2 batch commit, which fires only once) |
 | `column-resize` | `key, width` | Column resized (fires continuously while dragging) |
 
 ### Slots
@@ -485,6 +487,7 @@
 | `title` | — | Table title |
 | `toolbar` | — | Left side of the toolbar, e.g. Create / batch buttons |
 | `toolbar-right` | — | Right side of the toolbar, before the built-in buttons |
+| `batch` | `{ checkedRowKeys, clear }` | Batch bar: replaces the toolbar while rows are checked (needs a selection column): select-page checkbox + "N selected" + this slot + clear |
 | `cell-{key}` | `{ row, index }` | Custom cell for a column |
 | `header-{key}` | `{ column }` | Custom header for a column |
 | `empty` | — | Content when there is no data |
````

Run: `git diff --stat README.md README.en.md`
Expected: 两个文件都有改动,行数相近(各约 +5 / −2)。

- [ ] **Step 4: 逐条回写规格(R-4)**

按文末「规格回写清单」逐条改 `docs/smart-naive-table-spec.md`(§3 的 API 表、§4 的档位、§5.1 / §5.2 / §5.6、§6.1、§9、§10)与 `docs/smart-naive-table-design.md` 里对应的文字(3.11 的「70%」、7.2 的落地风险 4–6 标「已定」、10.5 的 R-9 三点标「已解决」);**以实现为准**,冲突时停下来报告,不要自行取舍。

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
- `npm test`:全部通过,`Test Files  N passed (N)`、`Tests  M passed (M)`(Task 9 不加测试,等于 Task 8 的累计:沙盒 `Test Files  32 passed (32)`、`Tests  547 passed (547)`;**把你实测的数字写进最终报告**)。
- `npm run typecheck`:无输出。
- `npm run build`:构建成功,d.ts 生成**没有类型错误**(`vite.config.ts` 的 `afterDiagnostic`,有错会让构建失败);沙盒实测以 `✓ built in …s` 结束。
- `git check-ignore dist`:输出 `dist`(被忽略,**不要提交构建产物**)。没有输出说明 `dist/` 被跟踪了——停下来问用户,不要自行提交。
- `git status --short`:只应看到本任务改的 `package.json`、`package-lock.json`、`CHANGELOG.md`、`README.md`、`README.en.md`、`docs/smart-naive-table-spec.md` / `design.md`(以及仓库里原本就未跟踪的文件),**没有** `src/` / `tests/` 的未提交改动。
- **默认零影响的浏览器对比**(沙盒实测 **`dom` IDENTICAL、`layout` IDENTICAL**):在 P0 终态(`git stash` 或另一个工作树)与现在各起一次 dev server(5193),跑 `node .sandbox/p1/_kit/tools/dom-dump.mjs <标签>` 与 `layout-dump.mjs <标签>`(各写 `_kit/out/{dom,layout}-<标签>.json`),两份 JSON 逐字节相同;跑完停 dev server。没有沙盒时手动核对:不传任何 P1 属性的「基础」「过滤 / 列宽」「宽表」三个页签里,第一个 `.smart-table` 的标签 + class 树与 P0 一致、五个场景的几何(工具栏 / 表头 / 行 / 分页的 `x,y,w,h`)与 P0 一致。

- [ ] **Step 6: 提交**

```bash
git add package.json package-lock.json CHANGELOG.md README.md README.en.md docs/smart-naive-table-spec.md docs/smart-naive-table-design.md
git commit -m "chore: 3.0.0-beta.2 版本号、CHANGELOG 与 README;回写规格与实现的差异" -m "规格回写项:(逐条列出 Step 4 里实际改动的地方)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: 交接(不要自己发布)**

把下面这些**真实结果**汇报给用户,然后停下,等用户决定是否发布:
1. `npm test` 的通过数、`npm run typecheck`、`npm run build` 的真实输出;
2. 各 Task 里「浏览器验证」步骤的记录(哪些成立、哪些没成立),Task 8 的并排读数表(有没有出现表以外的差异);
3. **没有验证的**:Firefox / Safari、真实手指触屏、屏幕阅读器、宿主真实顶栏的 z-index、naive-ui 2.45.3 以外的版本;
4. 「需用户确认」里用户推翻了哪几条、对应改了什么;
5. **发布(由用户手动执行)**:在 `feat/v3-p0` 分支上 `npm publish --tag beta`(`prepublishOnly` 会先 `npm run build`)。**⚠ beta 不要合入 `main`** —— push 到 `main` 会触发 `.github/workflows/publish.yml`,它执行**不带 `--tag`** 的 `npm publish`,预发布版本要么因缺 `--tag` 失败、要么被发成 `latest`。

---


## 规格回写清单(本计划不改规格;Task 9 Step 4 的执行者逐条回写,以实现为准)

**`docs/smart-naive-table-spec.md`**

1. **§3「新增 API」· 放大一行**:`toolbar.maximize?: boolean` → **`boolean | { zIndex?: number }`**(默认 `false`;`true` = 层级 1999;`{ zIndex }` 覆盖;≥ 2000 开发期警告一次)。**§5.2「放大」条**里的「API 形态见 §10 未决」改为「已定,见 §3」。
2. **§3 · 批量栏一行**:在「已选 N 项 / 取消选择库内置」处补**「本页全选」复选框**(原型 `.bt-info`:本页可勾行全勾上 = 选中,其余 = 半选;点它并入 / 去掉本页的键,别页的保留,`selection` 列 `disabled` 的行不算,载荷同官方表头全选);补「窄档(< 600)排成『已选 N 项 | 取消选择』一行 + 宿主按钮整行」「内容贴第 1 行顶部」。
3. **§3 · 新 labels 一行**:P1 新增 7 个可选键 `selectedCount` / `clearSelection` / `searchBy` / `searchMoreConditions` / `searchConditionN` / `maximize` / `restore`;注明「面板第 1 行引导文字复用 P0 的 `filterConditionLead`」。
4. **§3 · 模式 2 行**:补 `SearchFormConfig.container?: 'card' | 'table' | 'none'`(`container` 优先于 `layout`;没写 `container` 时 `layout: 'inline'` = `'none'`)、`SearchConfig.actions?: FilterAction[]`(模式 2 里该字段可选的比较符,优先于 `filter.actions`,再缺省取 §5.9 的推荐集合)、新导出 `RECOMMENDED_ACTIONS` / `SearchContainer`。
5. **§4「布局」· 三档**:「按**容器**宽,用 `@container`」→ **「按容器宽,由 JS 量根节点宽度判定(放大态量放大层宽),阈值 600 / 1280;不给根元素加 `container-type`」**(理由:Teleport 的对象是放大层而不是根;气泡 / 抽屉本来就要 JS 知道档位;原型也是 JS)。
6. **§5.1「搜索区」**:删「模式 2 的数据通路…见 §10 未决清单」,改写成定稿:① 字段候选 = 声明了 `search` 且放得进一行的列;同时写了 `filter` 的复用列头 `FilterDef`(同一个过滤键、同一份过滤态);只写 `search` 的列新派生(`daterange` 按 `date`);**带 `search.render` 的列、`type: 'switch'` 的列不进构造器**;`search.key` 在模式 2 忽略;比较符优先级 `search.actions` > `filter.actions` > 推荐集合;② 请求形状 = `filterSerializer` 的 `filters`(没有扁平搜索键),`@search` 的载荷 = `{ ...清洗后的 params, ...filterToParams() }`,点「搜索」/ 回车才提交、没有变化也重查,「重置」恢复各字段的 `defaultValue`、不碰列头漏斗单独管的列,一次提交多字段只触发一次 `filter-change`(`key` 为空串),静态 `data` 下只写 `search` 的列也能本地过滤;③ `container` × `layout` 的优先级与 `'none'` 的定义(见第 4 条);补「构造器最多 10 行」「面板 / 抽屉里 Esc 与点空白只收起、保留草稿(与列头面板不同)」「B10:宽 / 中档只有 1 条且是主行那条时不画 chips,窄档 ≥ 1 条都画」「窄档:主行只画第 1 行的值控件(占位 `Search {field}`、`size=large`、右侧放大镜),枚举字段的标量比较符选完即生效,抽屉 = 官方 `NDrawer`(底部、高度随内容、最高 85vh)」。
7. **§5.2「放大」**:补定稿的落地做法:Teleport 的对象是 `div.smart-table-layer`(不开放大时不存在,DOM 与不带该能力时一致),根元素原位留同高占位;层级默认 1999、`{ zIndex }` 可配;底色 = 官方 `NLayout` embedded(亮 `actionColor` / 暗 `bodyColor`);Esc 在捕获阶段读浮层、先收浮层再还原;滚动锁定引用计数(`html { overflow: hidden }`,放大中卸载 / 宿主关开关都解锁);只在键盘操作后把焦点还给按钮;切换前后保留表体 `scrollTop`;**不支持挂载后运行时切换 `toolbar.maximize`**;库自己的气泡(更多 / 密度 / 列设置 / chips「+N」)补上 Esc 关闭(不开放大也一样)。
8. **§5.6「把手视觉」**:「高度 70%」→ **整个表头行高**(`top: 0; bottom: -1px`,以原型当前 CSS 为准);补「**触屏**:24px 热区 + 单指 `touch*` 转合成鼠标事件(官方 `ResizeButton` 只认鼠标事件)」「固定列层叠:官方 `th` 无 `overflow` 规则、不构成层叠上下文,所以**不需要**改 `th` 的 `overflow` 也不需要给非固定列递减 `z-index`;只给**相邻的固定列**加递减(fixed-left 前 6 列)」;把「整块归 P1 视觉任务」改成「P1 已落地」。
9. **§6「落地必须满足的要求」· 第 1 条**:「(是否只在键盘操作时才还见 §10 未决)」→ 已定:**只在键盘操作后还焦点**(`keydown` / `pointerdown` 追踪)。**第 5 条**批量栏与工具栏同一 `min-height`:标「已落地」。
10. **§9「未验证」**:追加 P1 的未测项:Firefox / Safari 下的 `color-mix()`(把手光晕)、`@media (hover: none)`、Teleport 后滚动恢复;真实手指触屏拖列宽(只用触摸模拟 + 合成事件验证);宿主真实顶栏的 z-index(只用了 playground 的假顶栏);窄档抽屉里长列表(> 85vh)的滚动手感;构造器里日期选择器随 `NConfigProvider` locale 切换后的文案。
11. **§10「P1 未决清单」**:R-9 的第 1、2 点标「**已解决**(见 §3 / §5.1 / §5.2)」;第 3 点(窄档卡片第 2 行含不含「排序」)**保留**,留给 P2 计划。

**`docs/smart-naive-table-design.md`**(与规格同步,不另列新结论)

12. 3.11 文字里的「高度 70%」改为整行(与它自己的 CSS 注释一致);7.2「落地风险」4–6(Teleport 与判档的落点 / 放大层背景 / Esc 与焦点)标「已定」并指向第 3、4、7 条;10.5 的 R-9 同第 11 条;2.6a 的窄档抽屉补「官方 `NDrawer`,头 / 脚用 `NDrawerContent`」。

## 规格覆盖对照(自查)

| 规格 / 设计条目 | 落在哪个 Task |
|---|---|
| §3 模式 2 条件构造器(`search.container: 'table'`);§5.1 一行「字段 + 比较符 + 值」、多条件 + 且 / 或(每字段一个)、比较符按字段类型分发、换字段自动重置、宽档 1:1、「搜索」次级按钮 + 回车 | Task 5(内核)、Task 6(面板 / 工具栏行)、Task 7(接线) |
| §5.9 推荐比较符集合(模式 2 默认使用) | Task 5(`RECOMMENDED_ACTIONS`) |
| 设计 2.6a 窄档「输入框 + 筛选」抽屉;窄档枚举字段选完即生效、回车 = 搜索 | Task 6、Task 7 |
| B10(模式 2 默认开 chips) | Task 7(`chipsEnabled`、`shownChips`) |
| R-9 ①②③(字段派生 / 请求形状 vs `@search` / `container` × `layout`) | Task 5(`deriveBuilderDefs`、`setMany`、`resolveSearchContainer`)、Task 7(`@search` 与请求) |
| §3 批量栏;§5.2 / §6 第 5 条(四个条件、与工具栏同一 `min-height`、`#batch` 参数、`clear()`、「已选 N 项 / 取消选择」);原型 `.bt-info` 的复选框 | Task 1(窄档排布在 Task 7) |
| §3 放大(`toolbar.maximize`);§5.2 图标 / Teleport / 层级默认 1999 且可配置;§6.1 滚动恢复 / 焦点 / 滚动锁 / z-index 可配置 | Task 2(内核 + 按钮)、Task 3(接线) |
| R-9 放大:z-index 入口、Esc 分层、「只有键盘操作才还焦点」、Teleport 与判档的落点、设计 7.2 风险 4–6 | Task 2(`hasOpenFloat` / `trackInputModality`)、Task 3(`MaximizeLayer` / 捕获阶段 Esc / `scopeAttrs`) |
| §5.6 / 设计 3.11 把手视觉(热区 11px / 触屏 24px、静止不画线、悬停竖条、引导线、150ms 吞 click、拖动收起气泡);B12 后半(在带 `fixed` 列的表上逐列核对) | Task 4 |
| G0 / G3(外观以原型为准、功能取并集、与官方冲突以官方为准);对照页补 P1 场景 | Task 8(并排读数 + 已知残差) |
| P0 默认行为 / DOM / 布局不变(新能力默认关闭) | Task 3(DOM 用例)、Task 9(浏览器 DOM / 布局对比) |
| CHANGELOG / README / 版本号 | Task 9 |
| **不在 P1**:`cardOnNarrow` 与窄档卡片、窄档 40px 工具栏按钮 / 「操作 ▾」折叠、列头面板窄档底部 `NDrawer`、「更多」窄档 44px、L0-8 窄档分页项 40px、窄档卡片第 2 行含不含「排序」 | P2(另出计划) |
