# docs/spike —— 真实 naive-ui 上的一次性验证

**不随包发布、不是库代码。** 只用仓库现有的 vite / vue / naive-ui / @vitejs/plugin-vue,不新增依赖;`s4` 只读引用 `../../src`,不修改它。

运行(在仓库根目录):`node_modules/.bin/vite docs/spike --port 5174`,然后打开 `http://localhost:5174/s1.html` … `s4.html`。

| 文件 | 验证什么 | 结论写在 |
|---|---|---|
| `s1` | 真实 `NDataTable`:表头「标题→漏斗→官方排序箭头」、悬停显现、键盘可达、`simple` 分页、多列排序、`NPopover` 的 Esc / 焦点 | 设计文档 9.1 |
| `s2` | 「放大」= `Teleport` + `position:fixed`:状态 / 滚动 / 焦点是否保留、宿主 transform 祖先、z-index、滚动锁定 | 设计文档 9.2 |
| `s3` | 拖过列宽后的余量:`scrollX` 与末列宽度的几种做法、全部列 fixed 的边界 | 设计文档 9.3 |
| `s4` | 用库 2.1.1 现状复现缺陷 C1(多列排序被截成单列)、C2(`defaultSortOrder` 不生效) | 设计文档 9.4 |
