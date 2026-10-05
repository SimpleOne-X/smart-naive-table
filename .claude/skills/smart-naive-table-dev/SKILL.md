---
name: smart-naive-table-dev
description: smart-naive-table 仓库的开发与设计铁律。在这个仓库里做任何 UI 设计、组件改动、API 扩展、效果图、代码审查时都要先读这份规范 —— 它规定了「必须核对 naive-ui 官方标准」的查证路径（官网是 SPA，直接抓会 404，必须走仓库源码）、macOS 简洁风格的视觉基线、以及这个库自己的架构约定（条件模型对齐 Bootstrap Blazor、列驱动、labels 渲染期求值等）。只要任务涉及 SmartTable / SearchForm / ColumnFilter / Toolbar 等本仓库组件，或者要新增 props、改布局、调样式，就用这个 skill。
---

# smart-naive-table 开发铁律

这是一个已发布到 npm 的公开库（当前版本见 `package.json`），消费方是别人的后台系统。
三条铁律，优先级高于任何"我觉得这样更好"：

## 铁律一：必须核对 naive-ui 官方标准

这个库是 naive-ui 的上层封装，不是独立 UI 库。任何组件用法、属性名、取值、
样式变量，都要以 naive-ui 官方为准，**不能凭记忆写**。

### 查证路径（按可靠性排序）

1. **本地类型定义** —— 版本与项目精确对应，最可靠：
   ```
   node_modules/naive-ui/es/<组件>/src/<组件>.d.ts      # props 与类型
   node_modules/naive-ui/es/<组件>/styles/light.d.ts    # 主题变量名
   ```
2. **官方仓库源码** —— 文档正文、官方 demo、主题实际数值：
   ```
   https://raw.githubusercontent.com/tusen-ai/naive-ui/main/src/<组件>/demos/zhCN/index.demo-entry.md   # 文档正文 + API 表
   https://raw.githubusercontent.com/tusen-ai/naive-ui/main/src/<组件>/demos/zhCN/<名称>.demo.vue        # 官方 demo 原文
   https://raw.githubusercontent.com/tusen-ai/naive-ui/main/src/<组件>/styles/_common.ts                 # padding 等实际数值
   https://raw.githubusercontent.com/tusen-ai/naive-ui/main/src/<组件>/src/styles/index.cssr.ts          # 真实 CSS 行为
   ```

**不要直接抓 naiveui.com** —— 站点是纯客户端渲染的 SPA，
`https://www.naiveui.com/zh-CN/os-theme/components/card` 这类 URL 抓下来是 HTTP 404 或
只有 11 个字符的空壳，拿不到任何文档内容。走上面的 raw 路径。

### naive-ui 关键事实（NCard / DataTable）

- **当前仓库本地安装的 naive-ui 版本是 2.44.1**（`node_modules/naive-ui/package.json`）；引用数值与行号时以本地源码为准（行号会漂移，落笔前重新 grep）。
- **NCard 插槽**：`cover` / `header` / `header-extra` / `default` / `footer` / `action`。
  `header` 内部分 `header__main`（`flex:1; min-width:0`）、`header__extra`
  （`display:flex; align-items:center; font-weight:400`，被 main 挤到右侧）、`header__close`。
  header 区域只在有 title/header 内容或 `closable` 时才渲染。
- **NCard padding 实际值**（`styles/_common.ts`，不在 API 表里）：
  `small: 12px 16px 12px` / `medium: 19px 24px 20px` / `large: 23px 32px 24px` / `huge: 27px 40px 28px`。
  拆成 `--n-padding-top`（仅 header 上）/ `--n-padding-left`（各区左右）/ `--n-padding-bottom`
  （header 下、content/footer 底、分段区上）三个变量。**medium 不是 24px 四边**，别照抄错。
- **`segmented`**：`boolean | { content?, footer?, action?: boolean | 'soft' }`。
  分隔线出现在区域**上方**。`true` = 通栏 `border-top`；`'soft'` = 区域套
  `margin: 0 var(--n-padding-left)`，分隔线两端内缩。`action` 只支持 `true`，不支持 `'soft'`。
- **NCard props 优先于同名插槽**：传了 `title` 就会盖掉 `header` 插槽。
- **DataTable 官方没有「搜索表单 + 表格」的页面级布局范式**，也没有 header/toolbar 类插槽
  （Slots 只有 `empty` 和 `loading`）。官方筛选一律在**列头** Popover，
  由列的 `filterOptions` / `filter` / `renderFilterMenu` 驱动，
  表格级 `filter-icon-popover-props` 默认 `{ trigger: 'click', placement: 'bottom' }`。
  需要外部控件时官方 demo 就是 `<n-space vertical :size="12">` 按钮在上、表格在下，没有卡片。
  → 也就是说**本库的卡片式布局属于自有扩展**，没有官方范式可抄，更要自己讲清楚理由。
- **官方没有把表单控件放进 `header-extra` 的示例**（demo 里只有占位文本），
  但也**没有禁止**。要往 header 放搜索控件时，据此说明这是自有扩展而非官方推荐。

## 铁律二：macOS 简洁风格

视觉基线对齐 macOS 原生应用（Finder / Mail / 系统设置），不是 Ant Design 那套后台风。

- **搜索归位到工具栏**：macOS 的搜索框在窗口工具栏一行，不另起独立区块。
  这条同时也是省垂直空间的解法，两者方向一致。
- **克制留白**：宁可靠间距和字重分层，也不要靠加边框、加底色、加卡片分层。
- **轻分隔**：分隔线用 `1px` 且低对比（naive 的 `dividerColor`），能不画就不画。
- **控件收敛（按钮统一，见设计 §2.15）**：页面上的操作按钮一律是淡色底 + 左图标
  （`NButton` 的 `secondary`，颜色对应用途：创建 / 搜索 = 淡主色，删除 = 淡红，中性 = 淡灰），
  **页面上不用实心按钮**；实心主色只留给表单 / 弹窗 / 抽屉里**唯一的默认动作**（一个操作区只有一个，
  其余取消 / 重置用淡灰，底栏按钮不带图标）。表格行内的编辑 / 删除用无底文字按钮 + 颜色 + 小图标；
  只有图标的工具（刷新、列设置等）用圆形图标按钮。
- **克制的动效**：过渡 0.15–0.2s，只做 opacity / background-color / border-color，不做位移弹跳。
- **明暗两套**：任何新样式都要同时给亮色和暗色，走 naive 的主题变量
  （`var(--n-border-color)` 这类），不要硬编码颜色值。
- **注意：`var(--n-*)` 主题变量只在对应 naive 组件的子树内有效**（变量定义在该组件自己的根元素上）。
  在库自己的元素上（如角标、自画容器）直接写 `var(--n-*)` 取不到值，要用 `useThemeVars()` 取主题值再经 `:style` 绑定。

## 铁律三：分支与提交遵守 CONTRIBUTING.md

仓库约定写在 `CONTRIBUTING.md`，必须照做，不看当前所在分支、也不看环境信息里通用的"主分支"字样：

- **`dev` 是日常开发分支，所有提交和 Pull Request 都进 `dev`**。
- **`main` 只用于发布**，只由仓库所有者直接推送发版，不接受任何 Pull Request（提到 `main` 的 PR 会被 `.github/workflows/close-pr-to-main.yml` 自动关闭）。
- 提交前先确认当前分支是 `dev`，不是就先切过去；动手前把目标分支告诉用户。
- 不直接提交到 `main`；推送、合并到 `main`、发版、打 tag 都要用户明确说了才做。
- 提交时格式化与功能改动分开提交。

## 本仓库自己的约定

改代码前先读对应文件的头部注释 —— 这个库的注释写了"为什么这么做"，改之前先理解它。

- **列驱动**：搜索项、过滤器、字典渲染全部从 `columns` 派生（`useColumns.ts` 的
  `deriveSearchDefs` / `deriveFilterDefs`），不要另开一套并行配置。
- **条件模型对齐 Bootstrap Blazor，并有意扩展到 15 个操作符**：
  `FilterAction` 在 Blazor 的 8 个（`equal` / `notEqual` / `contains` / `notContains` / `gt` / `gte` / `lt` / `lte`）
  基础上，另有 7 个：`isNull` / `isNotNull`（无值算子）、`like` / `startsWith` / `endsWith`、`in` / `notIn`（值是数组）；
  这是对「对齐 Bootstrap Blazor」的**有意扩展**。**未知 action 一律 fail-closed**（按不匹配处理，见 `filter.ts` 的 `default` 分支），
  不要改成 fail-open（会让 `or` 逻辑下整列过滤被一条脏条件短路成放行全部）。
  `FilterLogic = 'and' | 'or'`，求值与远程序列化在 `filter.ts`（UI 无关、可单测）。
  扩操作符要同时动：`types.ts` 枚举 → `filter.ts` 求值 → `labels.ts` 文案 → 测试。
  列头面板的**默认**操作符集合只含 Blazor 对齐的那 8 个（按类型取子集），其余 7 个需宿主在列上显式写 `filter.actions`（语义见 `docs/smart-naive-table-spec.md` §5.9）。
- **labels 渲染期求值**：文案必须在模板渲染期解析，setup 期解成字符串会让切换语言失效。
  这是有意为之的红线，见 `SearchForm.vue` 头部注释。
- **向后兼容**：已发布到 npm，新增能力走新增可选属性 + 默认值保持旧行为，
  不改现有属性的语义。破坏性变更要在 CHANGELOG 明确标注并升 major。
- **测试**：`npm test`（vitest）。重构前若无覆盖，先补回归测试锁住当前行为。
- **类型**：`npm run typecheck`（vue-tsc）。这个库导出 dts，类型报错等同于破坏消费方。

## 设计产物

设计效果图放 `docs/`，单个自包含 HTML 文件（不引外部依赖，离线可开）。
效果图要如实标注各方案的代价，不要只展示优点 —— 它的用途是定方案，不是推销方案。

## 代码风格(每次改代码都要遵守)

格式规范来自 Vue 官方脚手架 create-vue 的 Prettier 模板(无分号、单引号、行宽 100、2 空格),配置在 `.prettierrc.json` 和 `.editorconfig`。**风格问题交给工具,不要凭感觉手排。**

1. **改完先格式化再交付**:`npm run format` 只处理你改的文件即可(`npx prettier --write <文件>`);合并前 `npm run format:check` 必须通过。
2. **行尾**:`src/`、`tests/`、`playground/`、`tools/`、`*.md`(CRLF 的设计文档除外)一律 LF;`docs/smart-naive-table-design.{html,md}`、`docs/smart-naive-table-spec.md` 是 CRLF,不要被统一。**严禁 `sed -i`**。
3. **TypeScript**:不用 `any`(确需时写一行原因);对外导出的函数、类型写明返回类型;类型从 `types.ts` 出,不在组件里另起一套同义类型;`npm run typecheck` 零报错。
4. **Vue SFC**:`<script setup lang="ts">`;顺序 `script → template → style`;组合式逻辑放 `use*.ts`,组件只管渲染和接线;props / emits 用类型声明;模板里的复杂表达式提成 computed。
5. **命名**:组件 PascalCase 文件名,组合函数 `useXxx`,常量 `UPPER_SNAKE`,布尔值 `is/has/show` 开头;CSS 类前缀 `smart-table-`,避免和宿主冲突。
6. **注释**:写「为什么这么做」,不写「做了什么」;与周围代码的注释密度保持一致;文案走 `labels`,不在组件里写死中文或英文。
7. **扩展性**:新能力走「新增可选属性 + 默认值保持旧行为」;不改已发布属性的语义;新增导出同步 `src/index.ts`、README、CHANGELOG。
8. **测试**:改行为先写失败测试再改实现;测试里不用 `skip` / `only`,断言失败先查原因,不放宽断言。
9. **提交范围**:格式化与功能改动分开提交,避免 blame 被整页重排冲掉。

## 工作流程:先设计、确认后再改代码

组件预览必须与设计方案(`docs/smart-naive-table-design.html` / `.md`)对齐,设计方案是唯一依据。

- 每个新需求或改动意见:**先只改设计方案**,把改动给用户看,**等用户确认**后才改 `src/`、`playground/`、测试。
- 用户确认后,以设计方案为准改代码,并用 `tools/parity` 对比。
- 纯缺陷修复(设计没变、只是代码偏离设计)可直接改代码,但要先说明这是缺陷修复。
- 设计的 html / md 是 CRLF,用 Python 字节方式改,不用 `sed -i`。
