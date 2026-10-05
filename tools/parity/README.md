# tools/parity — 原型 vs 对照页 并排读数

把「设计原型」(`docs/smart-naive-table-design.html`,静态页)和「真实库对照页」(playground 的 `/prototype.html`,用 SmartTable 真实组件复刻同一份界面)在同一视口、同一主题下各读一遍 DOM 几何与样式,逐项并排比对,并截图留档。每批改动之后一条命令就能复跑,不必再靠肉眼翻图。

零依赖:只用 Node 内置的 `fetch` / `WebSocket`(Node 24)+ 本机 Edge 无头 + CDP(Chrome DevTools Protocol)。

## 前置条件

1. 先在仓库根起 playground:`npm run dev`(端口以 vite 输出为准,vite 缺省 5173)。对照页地址是 `http://localhost:<端口>/prototype.html`。
2. 本机装有 Edge(Windows 默认路径见下表)。
3. Node 24。

| 环境变量 | 缺省 | 作用 |
|---|---|---|
| `EDGE_PATH` | `C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe` | Edge 可执行文件 |
| `PARITY_PREVIEW` | `http://localhost:5173/prototype.html` | 对照页地址(不带 query;脚本自己拼 `?m=&theme=&lang=&bg=&density=`)。dev server 不在 5173 时必须设 |
| `PARITY_PORT` | `9351` | Edge 远程调试端口 |

原型文件路径由 `import.meta.url` 推导(仓库根/docs/smart-naive-table-design.html),与当前工作目录无关。输出统一写到 `tools/parity/out/`(已在 `.gitignore`)。临时 Edge profile 在系统临时目录 `smart-table-kit-edge/cdp-<端口>`,脚本结束时 Edge 进程树会被关掉(先 CDP `Browser.close`,再 `taskkill /T`)。

PowerShell 里设环境变量:`$env:PARITY_PORT = '9362'; node tools/parity/parity-all.mjs ...`;Git Bash 里:`PARITY_PORT=9362 node tools/parity/parity-all.mjs ...`。

## parity-all.mjs — 模块读数(主力脚本)

```
node tools/parity/parity-all.mjs [--w 1440] [--theme light|dark] [--mods 1,2,3,4] [--diff-only]
                                 [--lang zh|en] [--bg gray|white] [--density compact|comfortable]
```

- `--w`:视口宽度,缺省 1440;390 时高度 844,其余 900。
- `--theme`:`light`(缺省)或 `dark`。
- `--mods`:模块编号,逗号分隔,缺省 `1,2,3,4`(要跑 5–13 必须显式写)。编号与原型 `enterModule(键)` 的键见下表;取值校验由 `cdp.mjs` 的 `KEY` 生成。
- `--diff-only`:只打印有差异的项,相同的不打印;没有差异的模块打印 `(无差异)`。
- `--lang` / `--bg` / `--density`:外壳开关,**只在传了时生效**。原型侧在 `enterModule` 之前执行 `runAct('lang'|'pageBg'|'density', 值)`(每个模块标题下一行 `外壳 proto state:` 是读回的 `state.lang / pageBg / compact`,可确认真的变了);对照页侧追加 `&lang=&bg=&density=` 到 URL。对照页是否认这三个参数取决于外壳是否实现——看标题行里 `prev:html lang=…` 与 `rowH`、`viewport bg` 读数判断,不认时 prev 不变、会出现整片 `≠`,不是脚本问题。文件名带后缀,如 `m6-light-1440-en-white-comfortable-proto.png`。

模块编号(`cdp.mjs` 的 `KEY`,原型 `MODULES` 同序;**比对范围 1–14,14 = 可编辑表格 excel**):

| 编号 | 键 | 编号 | 键 | 编号 | 键 |
|---|---|---|---|---|---|
| 1 | search | 6 | dict | 11 | ms |
| 2 | toolbar | 7 | persist | 12 | embed |
| 3 | filter | 8 | states | 13 | i18n |
| 4 | sort | 9 | crud | 14 | excel |
| 5 | wide | 10 | drag | | |

对照页参数:`/prototype.html?m=N&theme=light|dark&lang=zh|en&bg=gray|white&density=compact|comfortable`。

输出(每个模块一段):

- 第一部分是元素几何(`x,y,宽,高`,四舍五入到 0.1px):viewport / root / search card / table card / toolbar / title / tb-actions / tb-icons / chips / data table / thead / pagination,之后是关键样式(字号字重颜色、卡片背景圆角、th/td 底色、标签色、分页 select 尺寸)、`rowH`(首行行高)、`pager`(分页文字)、`docOverflow`(scrollWidth,clientWidth,scrollHeight,clientHeight)。
- 之后是逐项数组:`form`(搜索表单项)、`btns`(搜索卡/工具栏/chips 里的按钮,按 DOM 顺序)、`th`(表头单元格矩形)、`thd`(每列漏斗与排序箭头相对 th 的位置与颜色)、`cell0`(首行每格,按钮相对 td 的偏移与尺寸)、`acts`(操作列按钮文字位置)、`pgItems`(分页子元素)、`chips`、`rows`(前 3 行文本)、`errors`(对照页的 console 报错/异常)。
- 每行形如 `≠ 名称 proto <原型值> prev <对照页值>`。**行首 `≠` 表示两边读数不同;行首两个空格表示逐字符一致**。数组项按下标配对,所以某一边多/少一个元素时,其后所有下标都会错位成 `≠`——先看第一个 `≠` 是不是「(无)」,那才是根因。
- `-` 表示该元素在该侧不存在或不可见;`(无)` 表示该侧数组更短。
- 末尾一行汇总:`差异汇总 · <宽> · <主题>:共 N 项 ≠(模块 x:n;...)`。
- 同时落盘 `out/read-<主题>-<宽>[-外壳后缀]-m<模块列表>.json`(完整读数;文件名含 `--mods`,并行跑不同模块不会互相覆盖)、`out/m<模块>-<主题>-<宽>[-外壳后缀]-proto.png` 与 `-prev.png`(两侧截图)。
- 元素表里新增 `bottom row`(表格底部一行 = chips 靠左 + 分页靠右):原型 `.dt-foot` ↔ 对照页 `.n-data-table__pagination`(库把 chips 放进分页的 prefix;分页不画时落到 `.smart-table-chips-foot`)。
- 每个模块的就绪判据 / 等待 / 额外元素 / 备注来自 `modules.mjs`;标题下的 `备注:` 行就是它的 `note`。

「一致」的含义:数值是同一浏览器、同一视口下读出的原始 DOM 值,所以一致就是像素级相同(含亚像素,如 `39.41` 与 `39.39` 也会算 ≠)。没有容差——判断「差 0.02px 要不要管」是人的事。

对照页没达到该模块的就绪条件(dev server 没起、源码编译报错、模块还是占位组件)时,会在 stderr 打印「警告:…prev 读数不可信」,此时 prev 全是 `-`,差异数会爆炸,先修环境再看结果;占位模块照样出报告(全是 `≠` 正常),只是每个模块要多等 10 秒超时。

## modules.mjs — 每个模块的就绪 / 等待 / 额外读数

`{ [编号]: { ready: { proto, prev }, settleMs, els, lists, readHints, note } }`,全部可省,省了用 `DEFAULT`(对照页就绪 = 表格行数 > 3,原型不等;就绪后再等 1500ms)。**每个模块 agent 只改自己那一条**,字段含义写在文件头注释里。已有覆盖:

| 模块 | 覆盖 |
|---|---|
| 5 wide | `lists`:`sticky th / sticky td`(只留 `position: sticky` 的元素,比固定列矩形) |
| 6 dict | `settleMs: 1900`(异步字典 0.9s) |
| 8 states | 就绪 = 出现 `.n-empty`(`immediate:false`,首屏没有行);`els` 加空状态 |
| 10 drag | `els` 加 `#stage`;自然高度页 |
| 11 ms | `els` 加 `.md / .md-side / .n-tree / .md-main`,`lists` 比树节点。对照页侧栏请沿用原型类名 `md`、`md-side`、`md-main` |
| 12 embed(上下布局) | 见下「`data-parity` 约定」 |
| 14 excel | `els` 比可编辑格 / 只读格 / 复选框格的几何;交互态(下拉 / 日期 / 日期时间 / 多行浮层 / 校验气泡)见 `scenes/m14.mjs`(`node tools/parity/interact.mjs --only m14`) |

`readHints`(每侧一份,字段全可省):`scope`(给 th / 行 / 分页 / chips 选择器加祖先前缀)、`rowSel`、`thSel`、`actsCol`(操作列单元格下标,缺省 -1);用于 `cell0` / `acts` / `rows` 取错单元格的模块。

### `data-parity` 约定(多表页面)

对照页同一页面里有多张表时(m12「上下布局」:上方物料单据主表 + 下方入库明细子表,原型是一个 `.smart-table` 里两张卡,对照页是两个 `SmartTable` 根),**模块 agent 给每张表的外层包一层元素并打标记**:

- `data-parity="main"`:主表(物料单据)——`th` / 行 / 分页 / chips 读数、`table card / toolbar / data table / thead / pagination / bottom row` 都限定在它里面。
- `data-parity="sub"`:子表(入库明细)——读 `sub card / sub table / sub thead / sub row0 / sub sum row`(对照页选择器见 `modules.mjs` 的 12 项:`[data-parity="sub"] .smart-table-card`、`… .n-data-table`、`… .n-data-table-tr--summary`)。

原型侧没有这个属性,靠类名(`.sub-card` 等)定位,不用改原型。m12 的 `root` 读原型 `.smart-table` / 对照页 `.m12`;设了 scope 的模块里 `btns` 只读主表,子表按钮看 `list:sub btns`。对照页没打标记之前,m12 的 main / sub 读数全是 `-`,并会触发就绪超时警告。其他模块只有一张表时不需要标记。

## interact.mjs — 交互态弹层读数

```
node tools/parity/interact.mjs [--theme light|dark] [--only <场景名子串>]
```

点开弹层后比较弹层本身矩形及其中按钮/输入/勾选的相对位置。内置场景:`m3 漏斗 单据状态`、`m3 漏斗 部门(单选)`、`m1 展开`、`m2 列设置`、`m2 更多`;`--only 漏斗` 会匹配前两个,不传则全跑。视口固定 1440x900。

**模块自己的场景**放在 `tools/parity/scenes/m*.mjs`,启动时自动追加在内置场景之后(格式 `{ name, mod, proto, prev, pp, vp, settleMs?, pre? }`,见 `scenes/README.md`)。就绪判据与稳定等待按场景的 `mod` 查 `modules.mjs`;场景名重复、缺字段会直接抛错并指出文件。

输出每个场景一段:`P panel` 是原型弹层(矩形 + 文本),`V panel` 是对照页弹层;其后 `P ...`/`V ...` 成对列出内部元素(`标签.类名 文字 @相对弹层的 x,y,宽,高`)。**这里没有 `≠` 标记,靠肉眼对 P/V 两行**。两边按各自 DOM 顺序列出、不按下标对齐:原型的勾选/单选是 `span.n-radio`、没有文字,对照页是整块 `label`/`div.n-checkbox`,所以这类行天然长得不一样,比较的是 `@x,y` 是否落在同一位置,且两边按钮(高级条件 / 重置 / 确认)的 `@` 应当相同。截图在 `out/i-<场景>-proto.png` / `-prev.png`。`--only` 没匹配到场景时报错并列出可选场景名。

## zoom.mjs — 3 倍放大截图

```
node tools/parity/zoom.mjs [--mod 3] [--theme light|dark]
```

固定 1440x900 视口,对分页器、工具栏右侧、首行三块区域各截 3 倍放大图,原型与对照页各一张,输出 `out/z-<区域>-m<模块>-proto.png` / `-prev.png`,用于肉眼核对图标、箭头、文字的亚像素细节。区域坐标写死在脚本的 `CLIPS` 里,布局变了要同步改。

## 已知的「预期差异」

这些 `≠` 是已经评估过、不当作缺陷的,复跑时可以直接忽略(分级沿用设计文档的 P1/P2):

| 现象 | 归类 | 说明 |
|---|---|---|
| 工具栏里原型多一个「放大」按钮(`btns`/`tb-icons` 因此整体错位) | P1 | 放大/全屏尚未实现,属后续项 |
| 原型有「条件构造器」入口/面板,对照页没有(搜索卡 `btns`、`form`、弹层读数里出现 `(无)`) | P1 | 条件构造器尚未实现 |
| 窄档(`--w 390` 等)下表格卡片化、行结构不同 | P2 | 窄档卡片布局不做逐像素对齐 |
| 表头外框差 1px:`thead` 原型 `303,199,…` 对照页 `304,200,…`,高 40.4 对 39.4,`th` 的 x/y 整体偏 1 | 预期 | 对照页的 n-data-table 自带 1px 外框,`th` 的 y 因此整体 +1;漏斗/排序相对 th 的 y 也 -1(`9`→`8`、`13`→`12`),同源 |
| 标题行高 21 对 25.6(`title` 矩形高度不同) | 预期 | 文字中心一致(`125.5+10.5` 与 `123.2+12.8` 都是 136),视觉无差 |
| `rowH` 差 0.02 左右、`pager select` 宽 92.9 对 90.9 | 预期 | 字体度量/亚像素舍入 |
| `tag 已审核` 原型侧显示 `-`、对照页有值 | 预期(读数口径) | 该行的原型选择器是「第一个非 warn/off 的 pill」,首屏数据里原型侧没命中;这一项只有单侧读数,不代表标签样式有差,标签颜色请看截图或 `cell0` 里的 `未审核 +8,8 50x22` 尺寸是否一致 |

不在表里的 `≠` 都当作待查:先看是不是数组错位(第一个 `(无)`),再看数值。

## 换端口并行跑

多个终端/多个智能体同时跑时,给每个进程不同的 `PARITY_PORT`(Edge 调试端口与临时 profile 目录都按端口隔离),输出目录 `out/` 是共用的——截图按「模块 × 主题 × 宽 × 外壳」命名、JSON 另含 `--mods`,所以并行跑**不同模块**或**不同** `--w`/`--theme` 不会互相覆盖;同模块同参数并行会互相覆盖截图。对照页换 dev server 端口时设 `PARITY_PREVIEW`。

**端口分配**(Edge 调试端口,按组划段;不要杀别人的 node / vite / msedge 进程):

| 用途 | 端口段 |
|---|---|
| 缺省(`PARITY_PORT` 不设) | 9351 |
| A 组模块 agent | 9430–9439 |
| B 组模块 agent | 9440–9449 |
| C 组模块 agent | 9450–9459 |
| 脚本维护 / 回归 | 9420–9429 |

每个 agent 在自己的段内给每条并发命令挑不同端口(同一时刻同一端口只能一个进程)。

```
PARITY_PORT=9362 PARITY_PREVIEW=http://localhost:5194/prototype.html \
  node tools/parity/parity-all.mjs --w 390 --theme dark --mods 1,2 --diff-only
```

## 文件

- `cdp.mjs`:CDP 小工具(启动 Edge、`Page` 封装、路径/端口/参数配置、`KEY` 模块表、`previewUrl`),各脚本共用。
- `modules.mjs`:每个模块的就绪 / 等待 / 额外元素读数配置。
- `scenes/`:各模块的交互场景(`m*.mjs`)与格式说明。
- `parity-all.mjs` / `interact.mjs` / `zoom.mjs`:见上。
- `out/`:产物,已忽略。
