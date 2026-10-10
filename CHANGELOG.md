# Changelog

## 3.1.3 - 2026-10-10

### 修复

- **条件搜索栏(`search: { container: 'table' }`)工具栏主行里的值输入框没有宽度上限,表格越宽它越长(issue #13)**:值输入框(`.smart-table-filter-value`)只有 `flex: 1 1 100px; min-width: 100px`,吃掉所在行里的全部剩余宽度。这一行在中档是整行、在宽档是半列,所以两档都随表格变宽(默认主题、中文实测:中档约 = 表格宽 − 510,1180 时 670px;宽档约 = 表格宽 / 2 − 511,2300 时 639px),把「搜索」「重置」推得老远。现在 `.smart-table-cond__main` 里的值输入框封顶 `max-width: var(--smart-table-cond-value-max-width, 320px)`:缺省 320px,宿主想改就在表格或其祖先元素上写这个 CSS 变量(任何 CSS 长度,`none` 表示不封顶);下限仍是 100px。选择器限定在工具栏主行内:窄档的输入框(铺满整行)、「更多条件」气泡与抽屉里的值控件不受影响。宿主已经自己给 `.smart-table-cond__main .smart-table-filter-value` 写了 `max-width` 的,可以删掉。
- **条件搜索栏所在的工具栏:宽档两列等分把值输入框挤窄、中档写死两行宽度够也不并排、空的头部元素多占 12px(issue #14)**:宽档原是两列 1:1,条件栏只占半列;头部有内容(如宿主放进 `#toolbar` 的「机构」恢复按钮)时,条件栏那半列再被头部分走一块,值输入框实测在表格宽 1280 / 1400 / 1660 下只剩 100(顶到下限)/ 117 / 247px(无头部也只有 129 / 189 / 319px)。中档原是写死的两行 grid(`'head right' 'cond cond'`),不看宽度够不够:表格宽 1180 时工具栏 1146、操作区 170、条件栏要 576,并排完全放得下,仍是两行,第一行左边空着一大片。`.smart-table-toolbar-head` 在没有标题、`#toolbar` 也没渲染出东西时仍是个空 `div`,参与 `gap: 12px`,条件栏左缘比下面的表格缩进 12px。现在宽档与中档是**同一套** flex 换行布局(档位判定不变:< 600 窄、< 1280 中、其余宽):头部 · 条件栏 · 操作区排成一行,放得下就并排,条件栏吃掉头部与操作区之外的全部宽度(值输入框由上面的上限封顶,多出来的是条件栏右侧的空白);放不下就折行,后换出来的那一行放到上面(`flex-flow: row wrap-reverse`),仍是「操作区在上、条件栏在下」。条件栏的基准宽取 710px,来源是「值输入框以外的部分 + 200px」:字段 136 + 比较符 112 + `»` 28 + 搜索 / 重置按钮 + 5 处间距 8,默认主题实测中文 476、英文 501,所以并排时值输入框至少 200px(中文 ≥ 234、英文 ≥ 209)。没有内容的头部用 `:empty` 隐藏、不占位,条件栏左缘与表格左缘贴齐(此前差 12px);有内容时照常排在条件栏左边。窄档(< 600)的「输入框 + 筛选」结构、批量操作栏、窄档折叠(`cardOnNarrow`)不动(真实浏览器逐项比对前后矩形一致)。宿主已经自己覆盖过 `.smart-table-toolbar--mid` / `--wide` 的 `display` / `grid-template-*`、条件栏的 `flex`、`.smart-table-toolbar-head:empty` 的,可以删掉(保留的话以宿主的规则为准)。

### 外观变化

- **条件搜索栏所在的工具栏排布变了**:不传任何属性,升级后用了 `search: { container: 'table' }` 的表格,宽 / 中档的工具栏就按可用宽度排:
  - **宽档不再是两列等分**:条件栏占满头部与操作区之外的全部宽度,而不是只占半列;值输入框由「约半列宽 − 503」变为 ≥ 200px、≤ 320px。表格宽 1280 – 1400 附近(无头部)值输入框由 129 – 189px 变为 320px,条件栏右边与操作区之间多出一段空白(值输入框封顶后控件靠左,不再被输入框撑满)。
  - **中档放得下就并排**:中文、无头部时表格宽约 930px 起一行排完,放不下才折成两行(操作区在上、条件栏在下);常见笔记本宽度(表格宽 940 – 1279)由两行变成一行。
  - **无头部时条件栏左缘不再比表格缩进 12px**。
  - **头部有内容、且「头部 + 条件栏」一行也放不下时,头部落在最下面一行**(条件栏之下、表格之上):有两个字的标题约在表格宽 < 790px,72px 宽的宿主按钮约 < 830px;此前这一段是「标题 + 操作区」在上、条件栏在下。同一个排列次序里,`wrap-reverse` 没法让头部只跟操作区同行;窄档(< 600)走另一套结构,不受影响。
  - **新增一个可选 CSS 变量 `--smart-table-cond-value-max-width`(缺省 320px),不新增属性,没有回退开关**:宽档两列等分、中档写死两行没有合理用途,不提供改回去的开关;只想要旧的「值输入框随宽度变长」时,把变量设成 `none` 取消封顶即可。

## 3.1.2 - 2026-10-09

### 修复

- **树列(`tree: true`)配 `ellipsis` 时,列窄到放不下「缩进 + 箭头 + 文字」,「…」画出单元格右边界(issue #10)**:树单元格里省略号盒子排在 `[缩进 div × 层数][展开箭头 / 叶子占位]` 后面,它的 `max-width: 100%` 是整个内容区宽、不扣这段前缀。单元格不换行(宿主给 `td` 设了 `white-space: nowrap`)时,「…」越出右边界、盖在隔壁列上(实测第 3 层越界 63px);会换行时箭头和文字被拆成上下两行(行高 39 → 62)。官方在 data-table 样式里本来有 `calc(100% - var(--indent-offset) * 16px - 24px)` 的补偿,但它只挂在 `ellipsis: true`(布尔)的 `.n-data-table-td__ellipsis` 上,而且 naive-ui 2.45.x 里 `--indent-offset` 写不进 DOM(`Body.mjs` 的子节点惰性求值,晚于 `style` 规范化),两种写法都失效。现在库在 `.smart-table` 内按缩进 div 的个数得到层数(`:has()`,写到 10 层,更深的按 10 层扣),对对象形式(`ellipsis: { tooltip: true }`,即 `NEllipsis`)与布尔形式一并扣宽:`max-width: calc(100% - 24px - 层数 × 缩进)`。宿主给了 `indent`(数字)时,缩进取它,不再默认 16px。`:has()` 要 Chrome 105 / Safari 15.4 / Firefox 121 以上,更旧的浏览器保持原来的外观。非树单元格、不带省略号的树单元格不受影响。宿主已经自己写过同样兜底规则的(如 `.n-data-table-td:has(> .n-data-table-indent:nth-child(N)) > .n-ellipsis`),可以删掉。
- **条件构造器的展开面板(宽 / 中档点「»」弹出的气泡)里的控件比工具栏同一套控件矮一档(issue #11)**:工具栏那一行传的是 `size="medium"`,弹层里的面板却写死了 `size="small"`。气泡里的第 1 行就是工具栏主行的同一条条件,两处并排时高度对不上(宿主紧凑主题下 24 对 30px,默认主题 28 对 34px)。现在面板与主行共用同一个尺寸常量(`ConditionBar` 的 `ROW_SIZE`),字段 / 比较符 / 值控件、引导标签和底部「添加条件」「重置」「确认」都是 `medium`;第 2 行起的「且 / 或」下拉(`ConditionRow` 里写死 `small`)改为随本行 `size`。列头过滤面板(默认 `small`)、窄档抽屉(`large`)与圆形的「删除条件」图标按钮(`small`)不变。设计 §3.6、规格 §5.1。

### 外观变化

- **条件构造器的展开面板整体高一档**:不传任何属性,升级后点「»」弹出的面板里,每行控件由 `small` 变为 `medium`(默认主题 28 → 34px,宿主紧凑主题 24 → 30px),每行高 6px;条件越多气泡越高(上限仍是 10 行,10 行时比此前高约 66px:每行 +6、底部按钮 +6)。气泡只限宽、没有纵向限高,这一点和以前一样,没有改。**没有新增属性,也没有回退开关**:同一条条件在工具栏和面板里不同高没有合理用途。

## 3.1.1 - 2026-10-08

### 修复

- **条件构造器多条件面板的「条件」/「且」引导标签写死 12px,比同行控件(14px)小两号(issue #7)**:引导标签(列头过滤面板与多条件面板第 1 行的「条件」、跨字段行的固定「且」)现在与同行的字段 / 比较符 / 值控件同档——字号取主题的 `fontSizeSmall` / `fontSizeMedium` / `fontSizeLarge`(随本行 `size` 走,宿主改了主题字号也跟着变),不再在 CSS 里写死 px;字色由 `textColor3` 改为 `textColor2`,与同列的「且」下拉文字一致。窄档抽屉里每条条件的块头「条件 N」同样随 `size` 取主题字号(此前写死 14px,而块内控件是 15px)。
- **暗色主题下淡色按钮(如条件构造器折叠态「查询」)字色读不清(issue #8)**:此前淡色按钮与行内文字按钮的字色固定取 `primaryColorPressed` / `errorColorPressed`;宿主常把暗色的 pressed 定成「更深的蓝」,字色和淡底一起变暗(实测约 2.7 : 1)。现在按对比度在 `pressed` → `primary` → `hover` 里选第一个让字对「自己 α 0.16 叠在 `cardColor` 上的淡底」达到 4.5 : 1 的;都不到取最高的;颜色串不是 hex / `rgb()` 时仍取 `pressed`。**官方默认的亮 / 暗主题取值不变**(浅色 pressed 4.32 : 1 已是三个候选里最高,暗色 6.65 : 1 已达标),所以上面「对比度」一节的数字仍然成立。
- **条件面板值控件所在的容器是块级,控件高度恰好等于行高时多出 1px(issue #7 末尾)**:`.smart-table-filter-value` 里的 `.n-input` 是 `inline-flex` + `vertical-align: baseline`,块级容器按基线对齐,在某些「控件高度 / 行高」组合下(如紧凑主题的 24px 档)容器比控件高,整行被撑高、值框比同行下拉低半像素。容器改为 `display: flex`;控件宽度不变。

### 外观变化

- **条件面板引导标签变大、变深**:不传任何新属性,升级后列头过滤面板与多条件面板里的「条件」/「且」从 12px 的次要灰字(`textColor3`)变为与同行控件同大的正文色(`textColor2`,small 档 14px)。窄档抽屉的块头「条件 N」在 `size="large"` 下由 14px 变为 15px。
- 淡色按钮的字色取值规则见上「暗色主题下淡色按钮字色读不清」:仅当宿主主题的 `primaryColorPressed` / `errorColorPressed` 读不清时才会换成 `primary` / `hover`,默认主题下外观不变。

## 3.1.0 - 2026-10-06

### 修复

- **条件搜索栏「搜索」按钮的 loading 转圈会撑宽按钮,带动同排的值输入框左右晃(issue #5)**:官方 `NButton` 的 `loading` 会往按钮里塞一个 16px + 6px 间距的转圈槽(`span.n-button__icon`),表格进入加载态时按钮变宽 24px,加载结束再走官方的 `fade-in-width-expand` 过渡逐帧收回;`ConditionBar` 里 `flex: 1` 的值输入框(`.smart-table-filter-value`)被动跟着变宽 / 变窄。`SearchForm`(`grid` / `inline` 两种布局)的「搜索」按钮是同一个缺陷,同排的「重置 / 展开」会被推着动。现在「搜索」按钮带放大镜图标(见下面「外观变化」),图标槽一直在;loading 时官方 `NButton` 在**同一个图标槽里**把放大镜换成转圈,按钮宽度本来就不变,不再需要、也没有任何额外的 CSS。`loading` 的语义、点击拦截(loading 期间不触发 `search`)与 3.0.1 一致。
- **容器宽度读到 0(组件被 keep-alive 摘下)时档位掉成宽档(issue #5 附带问题)**:`ResizeObserver` 在摘下时报宽度 0,而 0 被当成「还没量到」按宽档处理;容器实际 < 1280px 时,每次切回页面都会先按宽档(单行工具栏)多渲染一帧,下一帧才回到真实档位。现在读到 0 时沿用上一次量到的宽度(档位、窄档分页、窄档卡片模式一并沿用);从没量到过宽度时仍按宽档,与 3.0.1 一致。
- **窄档卡片(`cardOnNarrow`)英文下,值是字典标签(`NTag`)的字段被长英文标签挤成半个标签**:卡片里「标签:值」每对只有约 137px,英文标签(如「Document Status」约 100px)不收缩,值只剩 29px,`overflow: hidden` 把 70px 宽的「Approved」裁成「App」。现在值里有 `NTag` 的那一对,标签文字可收缩、单行省略,值不收缩(只用 `max-width: 100%` 封顶);文字值和中文外观不变。规则用 `:has()`(Chrome 105 / Safari 15.4 / Firefox 121 以上),更旧的浏览器保持原来的外观;只对 `NTag` 生效,宿主自己画的标签不受影响。
- **窄档英文下,「操作」展开行里的按钮被挤出视口**:展开行里的按钮(「新增」等 + 「更多」,可编辑表格还有「放弃修改」「保存修改」)按等分排,英文带图标的三个按钮一行放不下,最后一个被裁出屏幕。现在按钮最小宽是内容宽,一行放不下就换到下一行;中文外观不变。

### 行为变化

- **可编辑表格(`editable`):点「放弃修改」多一步确认**。工具栏、批量栏、窄档「操作」展开里的「放弃修改」点击后先弹确认气泡(官方 `NPopconfirm`:「放弃全部 N 处未保存的修改?」,「取消」淡灰、「放弃」实心红),点「放弃」才还原草稿并触发 `@discard`;点取消、按 Esc、点外部只关气泡,草稿保留。`@discard` 的事件名与载荷不变,宿主收到时就是已确认;实例方法 `discard()` 是程序调用,仍不弹确认。**不提供关闭确认的开关**。
- **可编辑表格:搜索 / 翻页挡住已改行时,「保存修改(N)」旁显示「含 M 条当前不可见」**(M = 带草稿、但不在当前结果里的行数:改过的格 / 新增行 / 待删行,一行只算一次)。搜索 / 翻页仍不拦截,草稿保留;这条提示是为了让用户知道保存会连看不见的行一起提交。窄档在展开的「操作」里单独占一行。
- **新增三个可选 `labels` 键**:`editDiscardConfirm`(放弃全部 {n} 处未保存的修改?)、`editDiscardOk`(放弃)、`editHiddenDirty`(含 {n} 条当前不可见)。中英文默认值在 `zhCNLabels` / `enUSLabels` 里,宿主传了完整 `labels` 的不用改(全部可选)。

### 外观变化

> **不传任何新属性,升级后库自己渲染的按钮外观就会变**。统一依据设计 §2.15:页面上的操作按钮一律是「淡色底 + 左图标」(官方 `NButton` 的 `secondary`),页面上不再有实心按钮;表单 / 面板 / 抽屉 / 弹窗的操作区才用实心主色,且每个操作区只有一个。全部走官方 `NButton` 的现成属性(`secondary` / `type`),没有重画按钮,明 / 暗主题自动跟随。

- **页面上的按钮:淡色底 + 左图标**。创建 / 搜索 / 保存修改 = `secondary` + `type="primary"`(淡主色底);破坏性 = `secondary` + `type="error"`(淡红底);中性 = `secondary`(淡灰底)。库里受影响的按钮:
  - **搜索表单(`SearchForm`,`grid` / `inline` 两种布局)**:「搜索」由实心主色改为淡主色底 + 放大镜;「重置」由描边按钮改为淡灰底 + 逆时针箭头。
  - **条件构造器栏(`ConditionBar`,`search: { container: 'table' }`)**:「搜索」由描边按钮改为淡主色底 + 放大镜;「重置」由无底的文字按钮改为淡灰底 + 逆时针箭头;窄档的「筛选」由描边改为淡灰底 + 漏斗。
  - **工具栏**:「更多」由描边改为淡灰底;窄档的「操作 ▾」由无底改为淡灰底、「排序」由描边改为淡灰底 + 排序图标;批量栏的「取消选择」由无底改为淡灰底 + ✕。
  - **可编辑表格(`editable`)的工具栏按钮**:「新增一行」(此前无待保存修改时是实心主色、有修改时是描边)现在恒为淡主色底 + 加号;「保存修改(N)」由实心主色改为淡主色底 + 对勾(保存中官方在同一个图标槽里换成转圈);「放弃修改」由无底改为淡灰底 + 逆时针箭头;「删除所选」(此前是描边 + 红字)改为淡红底 + 垃圾桶;「恢复所选」改为淡灰底 + 逆时针箭头。
- **表单 / 面板 / 抽屉的操作区(macOS 做法):默认动作实心主色、其余淡灰、都不带图标**:
  - 条件构造器的多条件面板(`ConditionPanel`,点「更多条件」展开):「确认」由描边改为**实心主色**;「添加条件」「重置」由无底改为淡灰底。
  - 窄档筛选抽屉(条件构造器)、排序抽屉(`SortDrawer`):「重置」「添加条件」改为淡灰底,「确认」仍是实心主色;按钮最小宽 80px。
  - 可编辑表格窄档的底部抽屉表单(`EditableSheet`):「取消」由描边改为淡灰底,「保存」仍是实心主色;两个按钮**等宽并排**(各占一半)。
  - 下拉表格的选择面板(`SelectTablePanel`)的「清空」、列设置的「恢复默认」:由无底改为淡灰底。
  - **列头漏斗的过滤面板(`ColumnFilter`)**:底部「重置」由官方默认描边改为淡灰底、「确认」仍是实心主色(都是官方 `tiny` 小号);面板里的「添加条件」「高级条件 ▾」「收起高级条件 ▴」由无底文字按钮改为淡灰底(`secondary`、官方 `small` 档 28px,与同面板的值控件同高),「添加条件」带加号。
  - **按钮里的加号统一为 18px**:库内按钮里的加号(「新增行」「添加条件」等)改成和其它按钮图标同一套线性几何(24 视口、笔画 2),图标盒回到官方默认尺寸(medium 18px、large 20px),不再是缩小的 13px。
  - **淡色按钮与行内文字按钮的字色加深**:淡主色 / 淡红按钮(搜索、新增行、保存修改、删除所选等)和行内「编辑」「删除」「展开 / 收起」的字色,改取主题的 `primaryColorPressed` / `errorColorPressed`(浅色 `#0c7a43` / `#ab1f3f`,暗色 `#5acea7` / `#e57272`)。官方 `secondary` 的底和字取同一个颜色,所以淡色按钮的**底也随之略深**;实心主色(白字)不变。宿主**自己放进插槽的淡色按钮不受影响**;想与库内一致,可以给它们同样取 `primaryColorPressed` / `errorColorPressed`。
- **抽屉页脚不再画分隔线**:库自己的底部抽屉(窄档筛选抽屉、排序抽屉、可编辑表格的表单抽屉)的页脚传了官方 `NDrawerContent` 的 `footer-style="border-top: none"`。这只影响库自己的抽屉;宿主自己的抽屉不受影响。
- **新增的内部按钮图标**:放大镜、重置箭头、垃圾桶、对勾、清除、漏斗、排序共七枚,放在 `src/icons.ts`,**仅供库自己渲染的按钮使用,没有从包入口导出**(`src/index.ts` 里没有这些图标),宿主不能 import 它们。宿主按钮(编辑 / 下载 / 用户等)的图标请自备;库仍然零图标库依赖。
- **想保持旧外观怎么办**:**不提供「保留旧外观」的开关**,库自己渲染的上述按钮没有属性可以改回实心 / 描边 / 无底。宿主放进插槽(`#toolbar` / `#toolbar-right` / `#batch` 等)里的**自己的按钮完全不受影响**,仍然是你写的样子;建议它们也按同一套写法(新建用淡主色、删除用淡红、其余淡灰,都带图标)与库内按钮保持一致。
- **对比度**:浅色主题下实测(字对底色叠到卡片底色后的 WCAG 对比度):淡主色按钮 **4.32:1**(高于 3:1、略低于正文 4.5:1)、淡红按钮 5.33:1、淡灰 11.13:1、行内「编辑」5.41:1、行内「删除」7.00:1;实心主色的白字 3.38:1、实心红白字 4.98:1 是官方主色 / 红色配白字的固有值,库没有改。暗色主题下全部 ≥ 4.5:1,最低是淡红 4.69:1。**宿主若自定义了主题色,需要同时提供自己的 `primaryColorPressed` / `errorColorPressed`**,否则淡色按钮会取官方默认的 pressed 色(深绿 / 深红)。鼠标悬停时淡色按钮的底会再深一点(官方 `secondary` 的 hover 行为),此时淡绿「保存修改」实测 3.95:1。

## 3.0.1 - 2026-10-04

### 修复

- **纯 Node 里 `import 'smart-naive-table'` 报 `ERR_UNKNOWN_FILE_EXTENSION`(`.css`)**:`dist/index.js` 带 `import './index.css'`(样式随 JS 一起到消费方),纯 Node(消费方的 vitest、把本包外部化的服务端构建)不认识 `.css`,2.1.1 / 3.0.0 都有。`package.json` 的 `exports` 新增 `node` 条件,指向同内容、去掉 CSS 导入的 `dist/index.node.js`;浏览器 / 打包工具仍走 `dist/index.js`,行为与产物都不变。
  - 范围:只解决 `import` 报错。`SmartTable` 的**服务端渲染仍不支持**(组件渲染时会用到 `document` 等浏览器 API),`dist/index.node.js` 也不含样式。
  - 构建:`npm run build` 之后新增 `npm run check:dist`(CI 与 `prepublishOnly` 都会跑),检查 `exports` 配对、两份产物只差那一条 CSS 导入、`dist/index.node.js` 能在纯 Node 加载。

## 3.0.0 - 2026-10-04

> 3.0.0 是相对 2.1.1 的一次 **major** 升级。下面分「追加部分」(P1 / P2 与行为变化)和「基础部分」(P0)两块,合起来就是 3.0.0 相对 2.1.1 的全部变更;升级步骤见 [MIGRATION.md](./MIGRATION.md),未完成项见 [README 的里程碑](./README.md#里程碑)。

### 追加部分(P1 / P2 与行为变化)

> 在「基础部分」之上追加 P1。**新能力(条件构造器、批量栏、放大)全部是可选属性、默认关闭**;但有 **11 处行为变化是不传任何新属性也会生效的**,集中写在下面的「行为变化」一节(每项带回退方式):「更多」下拉的锚定、库自己的气泡可按 Esc 关、已生效条件 chips 的位置(只影响开了 `filterChips` 的用户)、列宽拖拽把手(只影响开了 `resizable` 的用户)、当前行高亮色(D1)、`@row-click` 的触发范围(D2)、请求失败后的页码(D3)、每页条数可选项按 `fillHeight` 区分(D4)、序号列声明在数据列之后时的位置、窄档拖拽卡片里的序号、窄档卡片末尾的合计卡(后三项只影响用了对应能力的宿主)。
>
> 验证环境:本次变更在**本地实装的 naive-ui 2.45.3** 上验证;`peerDependencies` 提到 `^2.44.0`,2.44.0 ~ 2.45.2 之间的版本未单独测。

#### 行为变化(不传任何新属性,升级后也会变)

| 变更 | 旧(基础部分)→ 新 | 回退方式 |
|---|---|---|
| **「更多」下拉的锚定**(**凡传了 `toolbar.more` 的宿主都受影响**) | 菜单在按钮下方**右对齐**(`bottom-end`),与按钮的间距是官方默认 6px → **左对齐(`bottom-start`)、菜单最小宽 148px、离按钮 8px**。原因:「更多」在业务按钮组末尾、右侧还有内置图标,不靠右贴边,左对齐才与设计原型一致。实现全走官方入口:`placement`、`NDropdown` 的 `menu-props`(最小宽)、`peers.Popover.space` 主题覆盖(只作用于这一个下拉) | 无开关(位置与最小宽) |
| **库自己的气泡不开放大也能按 Esc 关** | 「更多」菜单、密度菜单、列设置、chips 的「+N」按 Esc 没有反应(官方 `NPopover` 不管键盘,`NDropdown` 只有焦点在菜单里才响应 Esc)→ **按 Esc 关闭**(库改成受控 `show`,焦点还在触发按钮上也生效)。放大态下的 Esc 分层(先收浮层、再还原)依赖它 | 无 |
| **已生效条件 chips 的位置**(`filterChips` / 模式 2 默认开) | 工具栏下方、表格上方的独立一行 → **表格下方、与分页同一行(左 chips、右分页)**。原因:chips 放在表格上方时,出现 / 消失会让表格整体被顶下去再弹回来(页面上下跳);放到分页那一行后表格自己的位置不再受 chips 影响,分页行本身的高度(28px)也不变。实现:分页由 `NDataTable` 内置渲染,chips 经官方 **`pagination.prefix`** 渲染进分页行(宿主的 `#pagination-prefix` 仍在,紧挨页码;**宿主自己在 `pagination` 里写了 `prefix` 时库不去抢,chips 改在表格下方自画一行**)。官方 `paginateSinglePage` 默认 `true`,所以默认情况下空表 / 只有 1 页也画分页、chips 恒在分页那一行;`pagination: false`(或宿主显式 `paginateSinglePage: false` 且只有 1 页)时分页不画,chips 在表格下方自成一行(这时 chips 出现 / 消失会让**表格以下**的内容挪动一行,表格本身不动)。窄档(库根节点宽 < 600):chips 单独一行放在分页上方、可换行、**不折成「+N」**(宽 / 中档仍是单行、放不下折「+N」)。DOM 变化:`.smart-table-chips` 不再是卡片内容区里表格之前的兄弟节点,而在 `.n-data-table__pagination .n-pagination-prefix` 里(或 `.smart-table-chips-foot` 里);开了 chips 时宿主的 `#pagination-prefix` 内容外多包一层 `span.smart-table-pager-host-prefix`(没开 chips 时 DOM 与此前完全一致)。`FilterChips` 组件不再自带 `margin-bottom: 12px`。**没有属性可以把 chips 放回上方**——这是设计变更,不是可选项;不想要 chips 请用 `filterChips: false` | 无(位置);`filterChips: false`(关掉 chips) |
| **列宽拖拽把手**(只影响开了 `resizable` 的用户) | 热区落在列界左侧约 8px、只有半格高、静止时画一条细线 → **热区 11px(触屏 24px)骑在列界线上,竖条 3px 压在线上、高度 = 表头整行,静止不画、悬停 / 拖动才显示主色(拖动时再加一圈光晕)**;拖动时有贯穿整表的 1px 引导线、鼠标离开把手后光标仍是 `col-resize` 且不选中文字、开始拖动时收起过滤气泡、松手后 150ms 内吞掉 click(松手落在表头上不再连带触发排序);相邻的固定列的靠前者 `z-index` 依次更高(只处理前 6 列),非固定列把手不会盖到固定列表头上;**触屏**用单指拖动把手(官方把手只认鼠标事件,库把单指 `touch*` 转成合成鼠标事件) | 无(视觉与手势修正;宿主若用 `:deep(.n-data-table-resize-button)` 自己覆盖过样式,请重新核对) |
| **当前行高亮色**(D1;用了 `activeRowKey` 的宿主) | 写死的靛蓝 `rgba(99, 102, 241, 0.08)`,暗色没有单独值 → **当前主题主色 9%**(`color-mix(in srgb, <主色> 9%, transparent)`,主色取 `useThemeVars().primaryColor`,明 / 暗各自跟随主题)。命中行 class 仍是 `smart-table-row--active`;CSS 变量 `--smart-table-active-row-bg` 的优先级不变(全局 `activeRowBg` 或祖先元素上写它,压过自动值),新增内部变量 `--smart-table-active-row-bg-auto` 放自动值 | 全局 `createSmartTableDefaults({ activeRowBg: 'rgba(99, 102, 241, 0.08)' })` |
| **`@row-click` 的触发范围**(D2;用了 `@row-click` 且行内有操作控件的宿主) | 行内任何点击都触发(点「编辑 / 删除」按钮、勾选框也会冒成行点击,宿主得自己 `.stop`)→ **点击目标在行内的按钮 / 勾选框 / 单选框 / 开关 / 链接 / 输入框 / 下拉 / 展开箭头等交互控件上时不触发**。判定:目标或它在本行内的祖先命中 `button, input, textarea, select, a, label, [role=button / checkbox / radio / switch / combobox], .n-button, .n-checkbox, .n-radio, .n-switch, .n-input, .n-input-number, .n-base-selection, .n-date-picker, .n-base-close, .n-data-table-expand-trigger, [data-act], [data-open], [data-stop]`(选择器与设计原型一致,再补上 naive 的真实 DOM:`NCheckbox` 的根是 `div.n-checkbox` 而不是原生 input)。点普通单元格、单元格空白照旧触发;宿主 `row-props` 里自己的 `onClick` 不受影响、照旧先于 `rowClick` 调用 | 需要旧行为时,在 `row-props` 的 `onClick` 里自己处理(它不受忽略规则影响) |
| **请求失败后的页码**(D3;远程模式 / `useSmartTable`) | `search()` / `onPage(p)` / `onPageSize(s)` 先改 `pagination.page` / `pageSize` 再请求,请求失败时只调 `onError`,页码指向没拿到的页、表里却是旧页的行 → **失败时把页码和每页条数还原到「表里实际展示的那一页」**(最近一次成功请求时的值),再调 `onError`。只还原最新那次请求;被更新请求取代的旧请求失败不还原、不报错(原有 `reqSeq` 竞态处理不变);成功时行为不变;`load()` / `refresh()` / `reset()` 不还原(前两者没改页码,`reset()` 同时清了搜索参数,没有可还原的「上一页」) | 无(缺陷式修正);要旧行为可在 `onError` 里把 `pagination.page` 改回去 |
| **每页条数可选项按 `fillHeight` 区分**(D4;**没显式给 `pageSizes` 的宿主**) | 内置可选项固定 `[100, 500, 1000]` → **开了 `fillHeight` 的表格 `[100, 1000, 10000]`,没开的仍是 `[100, 500, 1000]`**(默认每页都是 100)。依据:Edge 实测(1440×900),不开 `fillHeight` 时一页 10000 行切换 9.4s、排序 22.8s、JS 堆 1.3GB;开了(官方虚拟滚动)约 45ms。宿主(实例 `pagination.pageSizes` 或全局 `createSmartTableDefaults({ pageSizes })`)显式给了就照宿主的、不分 `fillHeight`;`fillHeight` 挂载后切换时可选项跟着变,当前每页条数不在新列表里就自动并入。放大(`toolbar.maximize`)不参与判定,只看 `fillHeight` 属性 | 全局或实例显式写 `pageSizes: [100, 500, 1000]` |
| **表头「全选」复选框的位置**(用了选择列 / 展开列的宿主;缺陷修复) | 库给表头(`.n-data-table-th`)统一加的右内边距 16px 也套在了选择列表头上,全选框比行内复选框偏左 8px → 选择 / 展开列的表头保持官方的 `padding: 0` + 居中,与行内复选框同一竖线 | 无需回退(基础部分引入的偏差) |
| **`fillHeight` 下空状态的位置**(开了 `fillHeight` 且数据为空的宿主) | 「暂无数据」贴在表体顶部(库恒传 `scroll-x`,官方此时把空状态融进表格节点并贴顶) → **在表体里垂直居中**;没开 `fillHeight` 的表不受影响 | 宿主用更高优先级的 CSS 把 `.n-data-table-empty` 的 `height` 改回 `auto` |
| **行拖拽排序的手感与范围**(开了 `rowDraggable` 的宿主;缺陷修复) | 走浏览器原生 HTML5 拖放:拖影是浏览器画的位图,**指针拖到哪它跟到哪**(拖出表格、拖出页面),松手后再弹回;被拖行在表里没有任何视觉反馈 → **拖动限定在表体内**:拖影只能纵向移动(X 锁在按下处)、Y 夹在表体可视范围内(首行顶 … 末行底);指针拖到表外(左 / 右 / 上 / 下)拖影贴着最近的边,**松手 = 落在最近边的那个位置**(拖到最下面之外 = 放到最后一行,不取消);贴近表体边缘(64px 内)自动滚动(虚拟滚动 / 页面滚动都行);窄档卡片同样。手感:被拖行抬起(浮层阴影 + 主题悬停底,不透明),落点留一行主色 12% 淡底的占位,邻行 180ms 滑开(`cubic-bezier(0.2, 0, 0, 1)`),拖动中光标 `grabbing` 且不选中文字;起拖阈值 4px(点一下手柄不会误起拖)。实现:sortablejs 改走 `forceFallback`(拖影是 tbody / 卡片列表里的一份行克隆,继续继承 `--n-*` 主题变量),约束靠改写 `clientX / clientY`(见 `src/rowDragConfine.ts`);新增 DOM class:`smart-table-drag-ghost`(拖影)、`smart-table-drag-placeholder`(占位)、`smart-table-drag-chosen`,拖动期间 `body` 上有 `smart-table-row-dragging`;行内的 `sortable-ghost / sortable-chosen / sortable-fallback` 不再出现。公开 API(`rowDraggable` / `dragHandle` / `@row-drag-sort`)不变。已知限制:横向滚动的宽表里,拖影按行的自然列序渲染,固定列(`fixed`)在拖影里不吸边 | 无开关;宿主若给 `.sortable-ghost` 等 sortablejs 默认 class 写过样式,请改成上面的新 class |
| **序号列(`type: 'index'`)的位置**(声明在某个数据列**之后**的宿主;极少见) | 序号列恒在最前(排在所有数据列之前)→ **声明在某个数据列之后就排在那一列后面**(如「勾选 → 手柄 → 序号」);声明在最前或前面没有数据列时与以前完全一致 | 把序号列声明挪到所有数据列之前 |
| **窄档 + `row-draggable` 的卡片里的序号**(同时有 `type: 'index'` 列的宿主) | 卡片里没有序号(序号列一律忽略)→ **拖拽排序的卡片在标题行末尾、勾选框之前显示行号**(同设计原型模块 10 的 `.rc-no`);不可拖拽的卡片仍不显示 | 不想要就不在拖拽表里放序号列 |
| **窄档卡片列表末尾的「合计」卡**(同时传了 naive 的 `summary` 的宿主) | 卡片模式下合计行不显示 → **列表末尾多一张「合计」卡**(标题 = 卡片标题列的合计值,其余 = 有合计值的卡片字段) | 窄档不传 `summary` |

#### 新增

- **模式 2「条件构造器」**:`search: { container: 'table' }`。搜索区并入表格卡片的一行「字段 + 比较符 + 值」,字段候选 = 声明了 `search` 的列;点「更多条件」(`»`)展开多条件面板(每行与列头过滤面板同一套 `ConditionRow`:引导列「条件」/ 且或、比较符、值、删除;≤ 10 条、且 / 或逐字段、跨字段固定「且」);**产出走 `filters`(`FilterState` + `filterSerializer`),不再产出 `params`**;默认开 `filterChips`(B10,可显式 `filterChips: false` 关掉)。每种控件类型有推荐比较符集合(文本 / 数字 / 日期 / 选项,规格 §5.9,常量导出为 `RECOMMENDED_ACTIONS`),搜索项上可用 `search.actions` 覆盖。窄档(根节点宽 < 600)收成「输入框 + 筛选」,点「筛选」从底部抽屉(官方 `NDrawer`)展开同一份条件面板。**带 `search.render` 的列放不进构造器,不出现在字段候选里**;`daterange` 按 `date` 处理,`switch` 不进构造器;`search.key` 在模式 2 下被忽略。`search.container` 优先于旧的 `search.layout`(`'none'` = 旧 `layout: 'inline'`)。
  - 同时写了 `filter` 的列复用列头的过滤项(同一个过滤键、同一份过滤态),所以构造器与列头漏斗互相同步;因此**同一列在构造器里搜出的条件,会同时点亮它的列头漏斗**。
  - 模式 2 下 `search` 事件的载荷是 `{ ...params, ...filterToParams() }`(`filters` 序列化后的结果),点「搜索」/ 回车才提交(敲字不提交);`filter-change` 在一次批量提交(「搜索」「重置」)里只触发一次,`key` 为空串。
  - 工具栏三档(JS 按根节点宽度判定,放大后按放大层宽度重新判定):宽 ≥ 1280 单行(左半 = 标题 + 构造器、右半 = 按钮 + 图标)、中 < 1280 两行(标题 · 按钮 · 图标 / 构造器)、窄 < 600 第 2 行是「输入框 + 筛选」。窄档其余的触屏尺寸(40px 的工具栏按钮、「操作 ▾」折叠)仍归 P2。
- **`#batch` 批量栏**:有勾选列、写了 `#batch` 插槽、宿主绑了 `checked-row-keys` 且至少勾了一行时,在工具栏位置换成「**本页全选复选框** + 已选 N 项 + 你的操作按钮 + 取消选择」(内置图标组留在右侧,「更多」随工具栏被替换),取消勾选后换回工具栏;与工具栏同一 `min-height`,勾选不让表格跳动。插槽参数 `{ checkedRowKeys, clear }`。复选框:本页可勾的行全勾上 = 选中,其余 = 半选(「已选 N 项」是跨页总数);点它并入 / 去掉本页的键,别页的勾选保留,载荷同官方表头全选(`checkAll` / `uncheckAll`)。窄档(< 600)排成「已选 N 项 | 取消选择」一行 + 宿主按钮整行。
- **`toolbar.maximize`**:「放大」按钮(默认关)。表格在页面内铺满视口(`position: fixed` + Teleport 到 `body`,盖住宿主的侧栏 / 顶栏,**不调用浏览器全屏 API**)。`true` = 层级 1999(刻意低于 naive 浮层的 2000,放大后气泡 / 抽屉 / 下拉仍显示在它上面);`{ zIndex }` = 宿主顶栏层级更高时调大(≥ 2000 会盖住表格自己的气泡,开发期警告一次)。放大层底色 = 官方 `NLayout` embedded 的底色(亮 `actionColor` / 暗 `bodyColor`)。Esc 分层:有浮层打开时先关浮层,下一次 Esc 才还原;还原后只在键盘操作时把焦点放回放大按钮;放大期间锁住页面滚动(`html` 的 `overflow`,多个放大层引用计数)。**挂载后不要在运行时切换 `toolbar.maximize` 的开关**(会重建表格,列宽 / 过滤态的内部状态丢失)。
- **窄档卡片模式 `cardOnNarrow`**(P2,**默认 `false`,不开则行为与此前完全一致**)。开启后,库根节点宽 < 600(JS 判定,放大态按放大层宽)时:
  - **表格主体换成卡片列表**:第一个数据列是标题、其余「标签:值」两列、操作列放底部;列上新增 `card?: 'title' | 'meta' | 'action' | 'handle' | false` 覆盖(操作列 = `card: 'action'`,否则最后一个 `fixed: 'right'` 的列;`'handle'` 是 `rowDraggable` 时放在标题行最左的拖拽手柄列;`false` 不出现)。列设置里隐藏的列卡片里同样隐藏。点卡片 = `@row-click`(沿用 D2 的忽略行内控件规则,宿主 `row-props` 与 `activeRowKey` 高亮照常);勾选框在右上角(热区 44×44),读 / 写宿主的 `checked-row-keys`;展开列的内容显示在卡片底部(读宿主的 `expanded-row-keys`);卡片固定舒适间距、不响应密度、字段值单行省略。`NDataTable` 仍挂着,只留官方 `simple` 分页(项放大到 40px,不画每页条数选择器);本地模式的卡片按排序态排序、按页切片。**卡片列表不做虚拟滚动**(窄档不能改每页条数,默认每页 100)。
  - **工具栏折叠**:业务按钮(`#toolbar-right` + 「更多」)收成文字按钮「操作 ▾」,点开原位多出一行(不是浮层、不加动画),「更多」与宿主按钮等分;工具栏控件放大到触控尺寸(官方 `large`,高 40;图标按钮 40×40、间距 0;放大到 large 靠官方 `NConfigProvider` 的 `componentOptions`,宿主自己写了 `size` 的按钮不受影响),「更多」菜单选项高 44px(主题变量 `optionHeightMedium`)。批量栏出现时不折叠(它有自己的窄档排布)。
  - **窄档排序抽屉**:卡片模式没有表头,有可排序列时工具栏最下面多一行整行宽的「排序」按钮(角标 = 生效排序条数),点开从底部抽屉(官方 `NDrawer`)列出可排序列,每列一行「无 / 升序 / 降序」(官方 `NRadioGroup` + `NRadioButton`);行序 = 声明的优先级(`sorter.multiple` 大者在前),手机上不能改优先级、只能启停;改的是草稿,「确认」才生效(并按官方形状转发 `onUpdate:sorter`),「重置」恢复列声明的默认排序。窄档的模式 2「输入框 + 筛选」与卡片模式共存。
  - **未包含**:窄档下列头**筛选**的底部抽屉(列头漏斗在卡片模式里没有入口;需要筛选请用模式 2 条件构造器 `search: { container: 'table' }`),留待后续。
  - 新属性 `cardOnNarrow`、新列字段 `card`、新类型 `SmartTableCardRole`、新 labels `operations`(「操作」)/ `sort` / `sortNone` / `sortAscend` / `sortDescend`;`ColumnSettings` 新增 `size`(工具栏窄档折叠时传 `large`)。
- 新 labels(**全部可选**,`zhCNLabels` 已补中文、`defaultLabels` 有英文):`selectedCount`、`clearSelection`、`searchBy`、`searchMoreConditions`、`searchConditionN`、`maximize`、`restore`、`operations`、`sort`、`sortNone`、`sortAscend`、`sortDescend`。
- 新类型 / 导出:`SearchFormConfig.container`、`SearchConfig.actions`、`ToolbarConfig.maximize`、`SearchContainer`、`RECOMMENDED_ACTIONS`;`useFilters` 新增 `setMany`(一次批量提交,只触发一次 `onChange`);组件插槽新增 `batch`。
- **可编辑表格 `editable`**(**纯新增、默认关闭,不开则行为与此前完全一致**):Excel 式单元格编辑 + 按数据类型自动推断编辑控件,保存方式是**批量保存**。
  - 交互:单击选中格(2px 主色内描边)、再击已选中的格 / Enter / F2 / 直接打字进入编辑;↑ ↓ ← → Tab 移动选中格(跳过只读列),Space 切复选框,Delete 清空(必填列拒绝并提示);编辑中 Enter = 提交并下移、Tab = 提交并右移、Esc = 放弃本格;点到别处 = 提交,不合法则留在编辑态(红框 + 气泡)并吞掉这次点击。改过的格左上角 6px 小三角,改回原值自动消失。
  - 推断(`inferEditor`,纯函数可单测;与 `deriveSearchDefs` / `deriveFilterDefs` 同一套「列驱动」,不另开并行配置):列显式 `editor` / `readonly` → 列声明 `options`(下拉)/ `format: 'date' | 'datetime' | 'money'` → 数据值(前 20 行第一个非空值:boolean → 复选框、number → 数字框、`YYYY-MM-DD` → 日期、`YYYY-MM-DD HH:mm:ss` → 日期时间、含换行或超过 30 字 → 多行文本框、其余 → 输入框)→ 兜底输入框。控件全部用官方 `NInput` / `NInputNumber` / `NSelect` / `NDatePicker`(日期时间用 `type="datetime"`)/ `NCheckbox`。写了 `render` 或 `#cell-*` 的列没有显式 `editor` 时不可编辑(操作列不会被兜底成输入框)。
  - 保存:改动是草稿、叠在数据上(不改宿主的行对象),搜索 / 翻页 / 重新请求都不丢;工具栏有修改时出现「放弃修改」和主色「保存修改(N)」(「新增行」降为描边,一屏只有一个主色按钮),勾选批量栏里同样带「删除所选 / 放弃修改 / 保存修改(N)」;新增行放第 1 行(待保存)、删除所选是划线淡化(保存才真正移除、放弃恢复)。`@save` 载荷 `{ changes: { updated, added, removed }, done, fail }`:宿主提交后调 `done()`(远程自动刷新当前页)或 `fail(e?)`(保留草稿);**没监听 `@save` 时保存不会丢草稿**(控制台警告)。有未保存修改时离开页面有浏览器提示(`editable: { beforeunload: false }` 可关)。
  - 校验:列上 `rules: { required, min, max, int, pattern, validator }`(必填 / 数字 / 整数 / 日期格式由控件类型自带),文案走 `labels`。
  - 窄档:`card-on-narrow` 下不逐格编辑,点卡片 → 底部抽屉表单(同一套推断),保存是整行即时保存(`@save` 的 `changes` 里只有这一行);「新增行」打开空白表单。
  - 新增:props `editable`(`boolean | EditableConfig`:`add` / `remove` / `newRow` / `beforeunload`);列 `editor` / `readonly` / `rules` / `editorProps`;事件 `cell-change` / `save` / `discard` / `invalid`;实例 `dirtyCount` / `getChanges()` / `save()` / `discard()`;导出 `inferEditor` / `inferEditorInfo` / `validateEdit` / `createEditStore` 与类型 `EditorKind` / `EditRules` / `EditableConfig` / `CellChange` / `EditChanges` / `EditSavePayload` / `EditInvalid`;新 labels(**全部可选**,`zhCNLabels` 已补中文、`defaultLabels` 有英文):`editSave`(含 `{n}`)、`editDiscard`、`editAddRow`、`editDeleteSelected`、`editNewTitle`、`editEditTitle`、`editCancel`、`editSheetSave`、`editClose`、`editYes`、`editNo`、`editRequired`、`editRequiredSelect`、`editInvalidNumber`、`editInt`、`editMin`、`editMax`、`editInvalidDate`、`editInvalidDatetime`、`editPattern`、`editInputPlaceholder`、`editSelectPlaceholder`、`editNumberPlaceholder`、`editDatetimePlaceholder`。
  - **进阶能力**(同样全是可选、默认不生效):行级只读 `editable.rowReadonly(row)` / 列 `readonly(row, index)`;多选编辑器(列有 `options` 且值是数组 → `multiselect`);`rules` 增加 `minLength` / `maxLength`,`validator` 可返回 Promise(异步,提交后单元格显示加载态、过期结果丢弃、不通过的格标红并拦住保存)且第三个参数是表里当前所有行(跨行校验);保存前统一校验,第一个不合法的格被选中并滚进视口、发 `@invalid`;`@save` 的 `changes.rows` 把 created / updated / deleted 拍平并带 `type`;待删行可在批量栏「恢复所选」;Excel 粘贴(多格块,按列类型转换并校验,任何一格不合法整块不应用,锁定 / 只读格跳过,超出范围的行忽略)与 Ctrl+C 复制;Ctrl+Z 撤销最近一次提交(栈 50);Shift+Enter 提交并上移;必填列表头自动带红 `*`;下拉 / 多选选项 > 8 个自动可搜索;`editable.save: 'cell'` 即时保存(每提交一个格发一次 `@save`,失败回滚该格);实例 `isDirty` / `setCell(rowKey, field, value)`(拖拽重排后重编号走草稿);`beforeunload` 只在有未保存修改期间注册;fillHeight 虚拟滚动下可用(方向键走到未渲染的行会自动滚入、滚出窗口的编辑格内容不丢);选中格 `aria-selected`、只读 / 锁定格 `aria-readonly`;`useRowDrag` 增加 `offset` / `filter` 选项(可编辑表格里待保存的新增行排在数据行前面、不可拖)。
  - 新增导出:`validateEditAsync`、`EditChangeItem` 类型;`SmartTableLabels` 新增可选键 `editMinLength` / `editMaxLength` / `editRestoreSelected`。
  - 不做:填充柄、区域选择、合并单元格 / 公式、查找替换、右键菜单、跨结构变更的撤销、粘贴追加新行、复制行。按 semver 是 minor 级新增,不含破坏性变更。
  - **下拉表格 `select-table` 编辑器与独立组件 `SmartSelectTable`**(同样纯新增):外部 / 主数据(几十行以上、或来自接口)用它,小的静态枚举仍用 `options`。
    - 推断:列的 `editorProps` 里有 `columns` 且有 `data` 或 `fetcher`、又没有显式 `editor` → `select-table`(优先于 `options`);也可显式 `editor: 'select-table'`。`editorProps: { columns, data | fetcher, valueKey?, labelKey?, searchKeys?, searchPlaceholder?, panelWidth?, pageSize?, pageSizes?, title?, fill? }`,单元格的值 = 选中行的 `labelKey` 字段;`fill(picked, row)` 返回 `{ 其它列 key: 值 }` 随选中一并写入(普通草稿编辑:各自脏标记、一次 Ctrl+Z 撤销、同样校验,任何一格不合法则整次不应用并标红、发 `@invalid`)。粘贴:有本地 `data` 时文本必须是已有的名称 / `valueKey` 编码(命中同样 `fill`),只给 `fetcher` 时照收文本。单元格内只支持单选。
    - **`SmartSelectTable`**(`import { SmartSelectTable } from 'smart-naive-table'`):独立的下拉表格选择,不依赖可编辑表格。触发器像 `NSelect`(`NSelect` 画的),点开是 `NPopover` 浮层(窄屏 < 600 = 底部 `NDrawer`),里面一个搜索框 + 嵌套的 `SmartTable`(`fillHeight`:虚拟滚动 + 表头吸顶 + 分页,表体固定高度,每页默认 100、可选项走库的 D4 规则 `[100, 1000, 10000]`)。属性 `columns` / `data` | `fetcher`(`{ page, pageSize, keyword }` → `{ items, total }`)/ `valueKey`(默认 `'id'`)/ `labelKey` / `renderLabel` / `multiple`(值是数组;面板带勾选列与「已选 N 项 / 清空 / 确定」,跨页跨搜索保留)/ `maxTagCount`(默认 2)/ `placeholder` / `clearable` / `disabled` / `size` / `title` / `panelWidth`(默认 640)/ `pageSize` / `pageSizes` / `searchKeys` / `searchPlaceholder` / `label` / `labels`;事件 `update:value`、`pick`;实例 `open` / `close` / `focus`。
    - 搜索只有一个框(自动聚焦、放大镜、清除 ×、占位符由搜索列标题自动拼):本地实时模糊过滤(NFKC 归一、忽略大小写 / 全半角、空白切词全部命中、每个词可命中任一字段、不做拼音;> 2000 行防抖 120ms),远程回车或停手 300ms 后请求;Esc 先清空再关闭;↓ ↑ 移动高亮(虚拟列表里未渲染的行也会滚入视口)、Enter 选中(只剩一行直接选;多选 = 确定)、多选 Space 勾选;再次打开时已选行高亮并滚入视口(本地数据翻到它所在的页)。
    - 新增导出:`SmartSelectTable`、`matchKeyword`,类型 `SmartSelectTableProps` / `SelectTableProps`;`EditorKind` 增加 `'select-table'`;新 labels(全部可选):`pickTotal`、`pickSelected`、`pickClearSel`、`pickOk`;实例 `revealRow(index)` / `goPage(page)`(`fillHeight` 虚拟滚动下滚动到某行 / 跳页)。
  - 其它可编辑表格补充(同样全是可选):`editable.add: { position: 'bottom' }`(新增行追加到末尾,新增后自动进入第一个「必填且为空」的格);列 `readonly: false` 不受 `editable.rowReadonly` 影响(如「状态」列);**锁定的格可选中 / 复制**(以前不能选中),只是不能编辑;`editable.labelWidth`(窄档抽屉标签列宽,默认 72);窄档抽屉不再为没有标题的 render 列(拖拽手柄)生成空字段。

#### 文档

- 新增升级指南 [`MIGRATION.md`](./MIGRATION.md)(2.x → 3.0.0 的破坏性变更、回退方式、升级前检查清单),并加入 `package.json` 的 `files`,随 npm 包发布;README 中英文顶部各加一行入口。

#### 内部

- 新增 `MaximizeLayer`(函数组件,只在开了放大时多包一层 `div.smart-table-layer`;不开放大时 DOM 不变)、`maximize.ts`、`useEscClose.ts`、`conditionBuilder.ts`、`ConditionPanel.vue`、`ConditionBar.vue`;`ConditionRow` 新增 `size` / `valueOnly` / `placeholder` / `lead` / `searchIcon` 与 `#field` 插槽;`ColumnFilter` 新增 `closeRequest`。
- 对照页(`/prototype.html`)补上模块 2 / 3 / 4 的条件构造器、批量栏(批量审核 + 批量删除确认框)与放大,与设计原型逐项对照;模块 1 仍是独立搜索表单卡。

### 基础部分(P0)

> 这是一次 **major** 升级:下面「默认行为变更」里的每一项,**不传任何属性、升级后也会变**。每项都写了回退方式,都是一行属性。
>
> **⚠ C2(缺陷修复,但行为会突变)**:此前给列写了 `defaultSortOrder` 却因被受控 `sortOrder` 盖掉而从未生效;升级后**首次请求会带上排序参数、静态 `data` 模式下本地数据也会按它排序、箭头会回显**。如果你有这样的列,请确认这是你想要的。
>
> 本次变更**只在 naive-ui 2.45.3 上验证过**(`peerDependencies` 是 `^2.44.0`),2.44.0 ~ 2.45.2 之间的版本未单独测。

#### 默认行为变更(B 级)

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

#### 外观调整(对齐设计原型;2.1.1 已有外观的变化)

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

#### 缺陷修复(C 级)

- C1:列上写 `sorter: { multiple }` 的多列排序不再被截成单列(箭头回显与远程参数都变正确)。
- **C2:`defaultSortOrder` 现在会生效**(见顶部提示)。它**只在首次 setup 时从列声明里读一次**:列若是异步加载进来的,`defaultSortOrder` 不会生效,请在列到位后用实例方法 `sort()`。
- C3:options 列的过滤值里带 `notEqual` / `isNull` / 「多条 equal 且」时,打开勾选面板不再静默丢条件、确认不再覆盖原条件(自动展开「高级条件」)。
- C5:开启 `search.collapsible` 时,窄屏(1 列)折叠态至少露出首个搜索字段(此前 0 个)。
- **C6:宿主在 `<SmartTable>` 上写的 `@update:sorter` 每次点表头原来会被调两次(两次载荷相同,宿主若在里面累加 / 发请求会重复),现在只调一次**(库统一经 `notifyHostSorter` 转发,不再让它再从透传属性里混进去一份)。
- **C7:单元格是纯日期串(`'2026-09-21'` 这种不带时间的形状,后端 DATE 字段常见)时,现在按浏览器本地零点解析**(2.1.1 起就有的老问题)。此前它被按 UTC 零点解析:**UTC 以西的时区(如美洲)里 `format: 'date'` / `'datetime'` 显示成前一天**,本地过滤也按前一天判定(例:「大于等于 2026-09-21」选不中这一行,「等于 2026-09-20」反而选中);**UTC 以东的时区(如 UTC+8)日期显示本来就对,但 `format: 'datetime'` 显示的是 `2026-09-21 08:00:00` 这类时区偏移小时,现在是 `00:00:00`**,过滤值是 `Date` 对象或带时间的串时的比较也随之改正。带时间部分的串(裸 datetime、带 `Z` / 偏移)、`Date` 对象、时间戳的解析不变。
- **C8:`mergeLabels` 不再被显式 `undefined` 覆盖**(2.1.1 就有的老问题,Task 2 标记过 "pre-existing" 一直没修)。`labels` prop 中某个字段显式写 `undefined`(如从可能返回 `undefined` 的表达式计算)时,此前会覆盖掉下层的默认值、导致 UI 渲染成字面 `undefined`;现在跳过 `undefined` 键,该字段退回到 global labels 或英文内置默认。修复前:宿主 `{ search: undefined }` → `merged.search = undefined`、渲染 "undefined"。修复后:宿主 `{ search: undefined }` → `merged.search = 'Search'`(内置默认)。
- **C9:`startsWith` / `endsWith` / `like` 操作符现在对数组单元格逐元素匹配,和 `contains` 一致**(3.0 新增操作符,发布前对齐)。修复前:单元格 `['apple', 'banana']` 被 join 成 `"apple,banana"`,`startsWith('b')` 判定整串是否以 `'b'` 开头(否)而不是数组中有无元素以 `'b'` 开头。修复后:`startsWith('b')` 逐元素判定、命中 `'banana'`、返回 `true`。避免了 join 边界的假阳性(如 `[1,22,3]` join 成 `"1,22,3"` 误中 `contains('1,2')`)。

#### 新增

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

#### 类型层面变更

- **`FilterAction` 联合类型由 8 个成员扩到 15 个**:宿主若有穷尽的 `Record<FilterAction, …>`,或带 `never` 兜底的 `switch (action)`,升级后 `vue-tsc` 会报错,需要补上新成员。
- `SmartTableInst` 新增 `sort` / `clearSorter`:宿主若手写了该接口的实现或 mock,需要补上。

#### 内部

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
