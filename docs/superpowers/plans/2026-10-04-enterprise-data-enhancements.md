# 企业数据场景增强(3.1.0)Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 SmartTable 更适合 MES / MOM / ERP 的大数据量报表页:全量合计与分组汇总、导出所需的数据出口、可保存的查询方案、搜索表单里的大数据量选择器。

**Architecture:** 全部是**新增可选属性**,默认行为与 3.0.1 一致(A 级,发 `3.1.0` minor)。聚合声明挂在列上(列驱动,和 `search` / `filter` 同一思路),求值与序列化写成 UI 无关的纯函数(同 `filter.ts`),组件只接线。**每个功能先改设计文档并等用户确认,再动 `src/`**(见 `.claude/skills/smart-naive-table-dev/SKILL.md`「先设计、确认后再改代码」)。

**Tech Stack:** Vue 3.5、naive-ui(本地实装 **2.45.3**,已核 `node_modules/naive-ui/package.json`;技能文档里写的 2.44.1 已过期)、TypeScript、vitest、vue-tsc、Prettier。**零新依赖**。

**Spec:** `docs/smart-naive-table-spec.md`(现状规格,CRLF)、`docs/smart-naive-table-design.md` / `.html`(设计决定与原型,CRLF)。本计划要新增的是各自的设计小节与规格 §3「新增 API」表的行。

## 本计划的范围与形态(先读)

- 这是**总计划**:五个功能互相独立,按 writing-plans 的规则应各有一份计划。本文件给出顺序、边界、已核实的落点、接口草案、验收测试清单,以及**每个功能的设计任务**(这部分是具体可执行的)。
- **每个功能「设计确认」之后,再为它单独写一份带逐步 TDD 代码的实现计划**(`docs/superpowers/plans/…-<功能名>.md`)。现在不写,是因为接口形态取决于你在设计里的拍板;提前写满代码会变成一份要推翻的假计划。
- **进度(2026-10-04)**:**F2 设计已确认**(design §13「已定」,三项均按推荐),F2 的实现计划已写:`docs/superpowers/plans/2026-10-04-f2-summary.md`。F1 / F3 / F4 / F5 仍待设计,设计确认后再各写一份。
- 分支:`dev`(已确认当前在 `dev`,工作区干净)。`main` 只用于发布,发版、打 tag 都等你明说。格式化和功能改动分开提交。

## Global Constraints

- 新能力 = 新增可选属性,默认值保持旧行为;不改已发布属性的语义;破坏性变更必须升 major(本计划不含)。
- 零新依赖;要引入任何依赖先说明理由并等确认。
- 官方优先:naive-ui 有的用官方,以本地 `node_modules/naive-ui` 类型与源码为准,不凭记忆;官方没有的是自有扩展,在设计里交代理由。
- 列驱动:不另开与 `columns` 并行的配置。
- labels 渲染期求值;新增 label 键全部可选,`defaultLabels`(英文)与 `zhCNLabels`(中文)同时给。
- 明暗两套样式;`var(--n-*)` 只在 naive 组件子树内有效,库自己的元素用 `useThemeVars()`;CSS 类前缀 `smart-table-`;动效 0.15–0.2s,只做 opacity / 背景 / 边框。
- 类型:不用 `any`(确需时写一行原因),导出函数写返回类型,类型从 `types.ts` 出;`npm run typecheck` 零报错。
- 新增导出同步 `src/index.ts`、README、CHANGELOG。
- 测试:`npm test`;改行为先写失败测试;不用 `skip` / `only`;失败先查原因,不放宽断言和阈值。
- 文档编码:`docs/smart-naive-table-design.{md,html}`、`docs/smart-naive-table-spec.md` 是 **CRLF**,只能用 Python **字节方式**改;**严禁 `sed -i`**。`src/`、`tests/`、`playground/`、`tools/`、其它 `*.md`(含本文件)是 LF。
- 改完先 `npx prettier --write <改过的文件>`;合并前 `npm run format:check` 通过。
- 提交:目标分支 `dev`;提交信息末尾带 `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`。
- 验证:报告完成要给实际跑过的命令与真实输出。

## 与已有决定的冲突(必须你先拍板,见 Task 0)

读设计文档后发现,我上一轮的建议里有三处与**已定决定**冲突,计划不能绕过:

| # | 我的建议 | 已有决定 | 出处 | 计划里的处理 |
|---|---|---|---|---|
| C-1 | 库内置「导出」 | **库不内置导出 / 导入**,只出「更多」菜单外壳。理由:官方 `downloadCsv` 只导出当前页;远程模式下库手里只有当前页,「导出全部结果」只有宿主 / 后端能做对 | design §7.3 | **不推翻**。F3 改成只给**纯函数出口**(列 → 表头 + 行 + CSV 文本),不加导出按钮、不碰数据拉取。是否需要推翻 §7.3 由你定 |
| C-2 | 查询方案保存「筛选 + 排序」 | 「排序 / 过滤态持久化」在 YAGNI 清单里,明确不做 | spec §8 | 「自动持久化」仍不做;F4 是**用户显式命名保存**的方案,语义不同,但仍是对该条的松动,需你确认 |
| C-3 | 合计 | 合计目前是**宿主写 naive 的 `summary` 函数**,库只负责窄档卡片里显示;原型 m14 的列上已有宿主侧的 `sum` / `dec` 写法 | design 工艺路线示例、`src/SmartTable.vue` `cardSummary` | **已解决**:用户确认 F2 列声明沿用原型已有的 `sum` + `dec`,不改名 `aggregate` |

## Review Focus

计划与各功能的验收里,下面这些输入最容易出问题,每条在对应任务里都有测试:

1. **聚合遇到空值 / 非数字 / 字符串数字**(`null`、`''`、`'12.5'`、`NaN`):`sum` 要有确定的跳过规则,不能产出 `NaN` 显示给用户(F2,`summary.ts` 的 `sumValues` 已按此写测试)。
2. **远程分页下「本页合计」与「全部合计」混淆**:两行必须分开标注,后端没返回全量合计时只显示本页并明确写「本页」(F2)。
3. **分组后的行与勾选 / 行键 / 可编辑 / 拖拽的交互**:合成的分组头行不能进 `checked-row-keys`、不能被编辑、不能当拖拽目标(F1)。
4. **方案恢复时列已被宿主删除或改名**:方案里引用不存在的列 key 必须丢弃而不是报错或留下幽灵条件(F4,同 `mergeCols` 的做法)。
5. **导出时字典译文、`format`、`hide` 列、列设置顺序**:导出结果必须与用户屏幕看到的一致;含逗号、引号、换行的单元格要正确转义(F3)。

---

## Task 0: 先决事项(不写代码)

**Files:**
- Test: 现有 `tests/proto/m5-wide.test.ts`、`tests/prototype.test.ts`、`tests/SmartTable.editable3.test.ts`(只读排查)

- [ ] **Step 1: 整套测试基线不稳,先查原因**

已实测(2026-10-04,`dev` 干净工作区):`npm test` 两次整套运行分别 **4 个、7 个测试失败**,失败项不同,错误几乎都是 `Test timed out in 5000ms`;把出问题的三个文件(`m5-wide` / `prototype` / `editable3`)**单独跑 58 / 58 全过**。结论:整套并行时的超时抖动,不是功能缺陷。

Run: `npx vitest run --reporter=dot 2>&1 | grep -E "FAIL|timed out"`
Expected: 复现若干超时。**不要**调大 `testTimeout` 来让它变绿;先量一下并发下各文件耗时,定位是 jsdom 挂载整页原型(`ProtoApp`)太重,还是 worker 数相对 CPU 过多。能给出证据的修法(例如给重文件限并发、或拆分过重的用例)再提给你确认。

- [ ] **Step 2: 等你对 C-1 / C-2 拍板**(C-3 已随 F2 设计确认解决)

需要你回答:① F3 是否接受「只给纯函数出口、不内置导出按钮」(推荐);② F4 是否接受「显式命名保存的方案」松动 YAGNI 里「排序 / 过滤态持久化」(推荐,因为不是自动存)。

---

## Task 1: F2 全量合计 —— 设计已确认,实现计划已写

- **设计**:`docs/smart-naive-table-design.md` §13「已定」(2026-10-04,用户对三个待拍板项全部按推荐:沿用 `sum` + `dec`;静态数据也两行;后端没给全量合计时标签写「本页合计」)。原型:`design.html` 模块 5 已有两行 / 两张卡,Chromium 实测过宽 / 窄 / 英文 / 深色。
- **实现计划**:`docs/superpowers/plans/2026-10-04-f2-summary.md`(6 个任务的逐步 TDD:纯函数与类型 → `useSmartTable` → `SmartTable.vue` 接线 → 预览对齐 → 文档收尾)。
- **原先的「共用基座 `aggregate.ts`」取消**:设计确认首版只做求和,F1 分组汇总届时要 avg / min / max / count 再在 `src/summary.ts` 里扩(YAGNI)。
- **spec.md** 的新增 API 行随实现落地一起写(规格只记已落地的结论)。

---

## Task 2: F1 分组展示与分组汇总(风险最高,先 spike)

**要解决:** 按字段分组展示,分组头行带条数与聚合,可折叠。naive 的 `DataTable` 没有原生分组行,**怎么在官方表格里画出分组头是未验证的**。

**Files:**
- Create: `docs/spike/s9.html`、`docs/spike/s9.js`(沿用既有 `s1`–`s8` 的做法,一次性验证代码,不随包发布)
- Modify: 设计文档新增「分组」一节、spec §3

- [ ] **Step 1: Spike:验证合成分组头行的可行性**(在本地 naive-ui 2.45.3 上,Chromium 实测,记录进设计文档 §9 风格的验证记录)。要回答的问题,每个都要有实测结论,**不凭记忆**:
  1. 往 `data` 里插合成的分组头行,用列的 `colSpan(rowData, rowIndex)` 横跨整行,能不能画对;
  2. 开 `virtual-scroll`(`fillHeight` 依赖它)后 `colSpan` 是否仍生效;
  3. 合成行对 `row-key`、`checked-row-keys`(全选会不会把它选上)、`expandedRowKeys` 的影响;
  4. 备选 B:用官方树形行(`children` + `default-expand-all`)是否更合适,缩进与列对齐怎么处理。
- [ ] **Step 2: 按 spike 结论定方案,写设计文档**。必须回答的设计问题(附我的推荐):
  1. **作用域**:先做**「页内分组」**——只对当前页的行分组并汇总,要求宿主按分组键排序;**远程「按分组分页」放第二阶段**,因为它需要后端契约(请求带 `groupBy`、返回分组聚合),不由库单方面决定。
  2. 声明方式:列上 `group: true`(列驱动,与 `search` / `filter` 并列),分组汇总复用 F2 的 `src/summary.ts`(`sumValues` / `formatSum`;要 avg / min / max / count 时在那里扩);
  3. 分组头行的交互:点击折叠 / 展开;键盘可达(Enter / Space);`aria-expanded`;
  4. 与勾选 / 可编辑 / 行拖拽 / 窄档卡片的关系(Review Focus ③):**建议首版明确不支持的组合**——`editable`、`row-draggable`——开了分组就 `console.warn` 一次并忽略分组;勾选时分组头行不进 `checkedRowKeys`;窄档卡片首版分组头渲染为一张小标题卡。
- [ ] **Step 3: 同步 `spec.md`,等你确认**。**这一步之前不动 `src/`。**
- [ ] **Step 4(确认后):另写实现计划**。预计文件:`src/groupRows.ts`(纯函数:分组、汇总、折叠态,UI 无关)、`src/SmartTable.vue`(把合成行并进 `tableData`)、`src/CardList.vue`(窄档分组头)、`src/types.ts`、`src/labels.ts`、`tests/groupRows.test.ts`、`tests/SmartTable.group.test.ts`。

**验收测试清单:** 分组键相同的相邻行归一组、非相邻时不合并(并给出文档化的行为);分组头行不可被勾选、不触发 `@row-click`;折叠态下全选只选可见的数据行;分组汇总与 F2 同口径;`editable` 与分组同开时 warn 且不分组。

---

## Task 3: F3 导出数据出口(只给纯函数,遵守 design §7.3)

**要解决:** 宿主做导出时,要自己重新拼「表头、字典译文、格式化、列顺序」,而这些库里都已经有。**库不内置按钮、不拉数据**(C-1)。

**Files:**
- Create: `src/exportTable.ts`
- Modify: `src/index.ts`、`src/types.ts`(`ExportColumn`、`ExportTable` 类型)
- Test: `tests/exportTable.test.ts`
- Docs: design §7.3 末尾追加「库提供数据出口、不提供导出动作」一段;README「其它导出」;CHANGELOG

**Interfaces(草案):**
```ts
export interface ExportTable { headers: string[]; rows: string[][] }
export function buildExportTable<T>(
  columns: SmartTableColumn<T>[],
  rows: readonly T[],
  opts?: { visibleKeys?: readonly string[]; optionsOf?: (key: string) => SmartTableOption[] | undefined; emptyText?: string },
): ExportTable
export function toCsv(table: ExportTable, opts?: { bom?: boolean }): string
```
- `visibleKeys`:传列设置里实际可见、已排序的 key(`useColumns` 的结果),不传则取声明态的非 `hide` 列;
- 译文规则:有 `options` 的列用选项 `label`(函数形式在调用时求值,同 `optionLabel`),有 `format` 的列走 `applyFormat`,否则 `String(value)`;空值用 `emptyText`;
- `toCsv`:含 `,` `"` `\n` `\r` 的单元格加引号并把 `"` 转成 `""`;`bom: true` 前置 `﻿`(Excel 打开 UTF-8 CSV 不乱码)。

- [ ] **Step 1: 设计:在 design §7.3 追加一段,说明与既有「库不内置导出」决定一致**,并给出宿主用法示例(用 `useSmartTable` 的 `fetcher` 分页拉全量后喂给 `buildExportTable`)。等你确认
- [ ] **Step 2(确认后): 写失败测试**,覆盖:字典译文、`format`、`hide` 列被排除、传 `visibleKeys` 时顺序与之一致、`null` 用 `emptyText`、含逗号 / 引号 / 换行 / 回车的单元格转义(Review Focus ⑤)、`bom` 开关
- [ ] **Step 3: 运行确认失败 → 最小实现 → 运行确认通过 → `npm run typecheck`**
- [ ] **Step 4: 提交** — `feat: 导出数据出口 buildExportTable / toCsv`

---

## Task 4: F4 查询方案(显式命名保存,松动 spec §8 YAGNI 一条)

**要解决:** 计划员、质检员每天重复同一套查询,而 `storage-key` 只存列设置。

**Files:**
- Create: `src/views.ts`(纯函数:捕获 / 校验 / 恢复,UI 无关)、`src/ViewMenu.vue`(工具栏里的方案菜单,用官方 `NDropdown`)
- Modify: `src/types.ts`(`SavedView`、`ToolbarConfig.views?`)、`src/Toolbar.vue`、`src/SmartTable.vue`、`src/labels.ts`、`src/index.ts`
- Test: `tests/views.test.ts`、`tests/ViewMenu.test.ts`、`tests/SmartTable.views.test.ts`

**已核实的可捕获状态(在 `SmartTable.vue` 里的位置):** 搜索参数 `params`(`useSmartTable`)、过滤态 `filters`(`useFilters`)、排序态 `sortState`(约第 241 行,`SortItem[]`)、列设置与密度(`storage.ts` 的 `StoredTableState`)、每页条数(`pagination.pageSize`)。恢复时走现有入口:`setFilter` / `sort` / 受控 `params`,**不开第二条状态通路**。

**Interfaces(草案):**
```ts
export interface SavedView {
  id: string
  name: string
  params: Record<string, unknown>
  filters: FilterState
  sorts: SortItem[]
  pageSize?: number
  cols?: StoredTableState['cols']
}
export function captureView(input: Omit<SavedView, 'id' | 'name'>): Omit<SavedView, 'id' | 'name'>
export function restoreView(view: SavedView, declaredKeys: readonly string[]): SavedView
```
- `restoreView` 丢弃引用了已不存在的列 key 的过滤 / 排序 / 列项(Review Focus ④,与 `mergeCols` 同思路);
- 存储:库只提供**钩子**,不替宿主决定存哪:`toolbar.views: { list: () => Promise<SavedView[]>, save: (v) => Promise<SavedView>, remove: (id) => Promise<void>, defaultId?: string }`;宿主不传则不出现方案菜单。是否额外提供 `localStorage` 默认实现,设计里问你。

- [ ] **Step 1: 设计:写设计小节**,必须回答:① 钩子形态是否足够(团队共享靠宿主后端);② 「默认方案」何时应用(挂载时、先于首个请求,避免先发一次无条件请求);③ 方案菜单的位置与外观(macOS 简洁:文字按钮 + 下箭头,不抢主色按钮);④ 窄档下放在哪;⑤ **对 spec §8「排序 / 过滤态持久化」的松动要在 spec 里改写**成「不做自动持久化;显式方案除外」。等你确认
- [ ] **Step 2(确认后): 写失败测试**:`restoreView` 丢弃幽灵列(Review Focus ④)、恢复后远程只发一次请求(不是每恢复一项发一次)、默认方案在首个请求里生效
- [ ] **Step 3: 实现 → 通过 → typecheck → 提交**

---

## Task 5: F5 把 `SmartSelectTable` 接进搜索表单 / 条件构造器

**要解决:** 物料、供应商、客户这类几万条的主数据,现在的 `options` 只能一次性全量加载。README「已知未完成」已登记「`SmartSelectTable` 进搜索表单」。

**Files:**
- Modify: `src/SearchForm.vue`(新增一种搜索控件类型)、`src/types.ts`(`SearchFieldType` 加 `'select-table'`,`SearchConfig.props` 沿用 `SelectTableProps`)、`src/ConditionRow.vue` / `src/ConditionBar.vue`(条件构造器的值控件)、`src/useColumns.ts`(`deriveSearchDefs`:列有 `editorProps` 的 `select-table` 配置时可复用)
- Test: `tests/SearchForm.test.ts`、`tests/ConditionBar.test.ts`、`tests/SmartSelectTable.test.ts`
- Docs: README 的 `SearchConfig` 表、已知限制表删掉这一行、CHANGELOG

- [ ] **Step 1: 设计:写设计小节**,必须回答:① 搜索值存什么(单选存 `valueKey`;多选存数组,与现有 `in` / `notIn` 操作符的数组值对齐);② 在条件构造器里什么操作符可用(建议 `equal` / `notEqual` / `in` / `notIn`);③ 窄档抽屉里怎么放(选择面板已有「窄档贴底」的形态,设计工艺路线示例里写过);④ 与 README 已登记的「远程数据再次打开不翻到已选行所在页」限制的关系——本功能**不顺带修**,单列
- [ ] **Step 2(确认后): 写失败测试**:搜索表单里选一行后 `params[key]` 是 `valueKey`;重置回 `defaultValue`;条件构造器里 `in` 产出数组;切 `labels` 语言即时生效(labels 渲染期求值的红线)
- [ ] **Step 3: 实现 → 通过 → typecheck → 提交**

---

## Task 6: 收尾与发版准备(每个功能合入后都做一次)

- [ ] **Step 1:** `npm run typecheck`、`npm test`、`npm run build`、`npm run check:dist` 全部实际跑一遍并贴真实输出(`npm test` 受 Task 0 的抖动影响时,同时给出相关文件单独运行的结果,并明说是抖动)
- [ ] **Step 2:** `npm run format:check` 通过;格式化与功能分开提交
- [ ] **Step 3:** 更新 CHANGELOG(新增一节 `3.1.0`,每个功能一条,说明是纯新增、不传属性与 3.0.1 一致)、README 里程碑与功能清单、spec §3 表
- [ ] **Step 4:** 用 `tools/parity` 对设计原型逐项读数(有改外观的功能才需要)
- [ ] **Step 5:** **不自动发版**:升版本号、推送、合并到 `main`、打 tag 都等你明确说了才做

---

## Self-Review

- **覆盖**:五项建议分别对应 Task 1(F2,已有实现计划)/ 2(F1)/ 3(F3)/ 4(F4)/ 5(F5);基线问题 Task 0;收尾 Task 6。上一轮列的第二、三梯队项(跨页全选、条件格式、`between` / 相对日期、树形、打印、列级权限)**本计划不含**,留待你选定后另立。
- **与设计的关系**:只有 F2 的设计已确认。F1 / F3 / F4 / F5 里的接口都是**草案**,必须先写进设计文档并等你确认,才能写各自的实现计划。
- **占位符检查**:F2 已有完整实现计划;其余功能的「另写实现计划」是有意为之(设计未确认),理由见「本计划的范围与形态」。
- **类型一致**:`SavedView.filters` 用现有 `FilterState`、`sorts` 用现有 `SortItem`;F1 引用的求和函数名与 F2 计划里的 `sumValues` / `formatSum` 一致。
- **已核实**:`dev` 分支干净;本地 naive-ui 2.45.3;`SmartTable.vue` 的 `sortState`、`cardSummary`、`editor.store.isDeleted`;`index.ts` 现有导出;`npm test` 基线抖动的实测数据;F2 原型在 Chromium 的实测(见设计 §13)。
- **未核实**:合成分组头行在 `virtual-scroll` 下是否可行(Task 2 的 spike 才回答);`fetcher` 现有宿主会不会因多返回一个可选 `summary` 字段出问题(预期无影响,未在真实宿主上验证)。
