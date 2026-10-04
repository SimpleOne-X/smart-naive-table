# docs/spike —— 真实 naive-ui 上的一次性验证

**不随包发布、不是库代码。** 只用仓库现有的 vite / vue / naive-ui / @vitejs/plugin-vue,不新增依赖;`s4` 只读引用 `../../src`,不修改它。

运行(在仓库根目录):`node_modules/.bin/vite docs/spike --port 5174`,然后打开 `http://localhost:5174/s1.html` … `s8.html`。`s5`–`s8` 用 `?v=` / `?mode=` 等查询参数切换变体(参数说明写在各 `.js` 文件头注释里),并暴露 `window.__s5` … `window.__s8` 供浏览器自动化读数。

| 文件 | 验证什么 | 结论写在 |
|---|---|---|
| `s1` | 真实 `NDataTable`:表头「标题→漏斗→官方排序箭头」、悬停显现、键盘可达、`simple` 分页、多列排序、`NPopover` 的 Esc / 焦点 | 设计文档 9.1 |
| `s2` | 「放大」= `Teleport` + `position:fixed`:状态 / 滚动 / 焦点是否保留、宿主 transform 祖先、z-index、滚动锁定 | 设计文档 9.2 |
| `s3` | 拖过列宽后的余量:`scrollX` 与末列宽度的几种做法、全部列 fixed 的边界 | 设计文档 9.3 |
| `s4` | 多列排序(C1)与 `defaultSortOrder`(C2)的夹具:只读引用 `../../src`,远程模式下看请求参数与箭头回显(两处缺陷已修,现在应表现正常) | 设计文档 9.4 |
| `s5` | 3.0.0 S1 吸收余量:在真实 `NDataTable` 上模拟库的列宽状态机(`onUnstableColumnResize` 首帧冻结、松手落账、`resizable`、`scroll-x`),对比 11 种机制变体(`?v=a/b/bf/bs/ca/cb/da/db/dy/dc/dk`)在拖非吸收列 / 拖吸收列 / 隐藏末列 / 先拖再成吸收列 / 全部 fixed / `fixed:right` 操作列 / 未 fixed 的 `resizable:false` 操作列下的列宽、表宽与拖拽过程;`?fill=1/2` 叠加 `flex-height` / 虚拟滚动 | 设计文档 9.6 |
| `s6` | 3.0.0 S2 官方每页条数选择器:外层 `simple` 分页的 `suffix` 里嵌非 simple 的官方 `NPagination`(`displayOrder: ['size-picker']`):同行对齐 / 28px、明暗、zh / en、`{label,value}` 选项、越界夹页与事件联动、pageSize 不在列表里、窄容器换行 | 设计文档 9.6 |
| `s7` | 3.0.0 S3 列头过滤面板键盘:漏斗触发器 + `NPopover` 面板(`NSelect` / `NDatePicker` / `NInput`):`data-data-table-filter` 是否足以阻止排序、Esc 与下拉协作(capture 阶段)、焦点进出 / Tab 循环 / 空白处点击 / 点外部关闭 | 设计文档 9.6 |
| `s8` | 3.0.0 S4 `fillHeight`:父容器定高 + `flex-height` + `virtual-scroll`(`min-row-height` 必须 ≥ 真实行高),100 / 1000 行、明暗、宿主前提;以及不开 `fillHeight` 时「翻页后卡片顶部在视口上方才滚回」的做法(`?mode=flow&fix=1`) | 设计文档 9.6 |
