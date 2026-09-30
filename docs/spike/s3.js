// S3:列宽钉住后余量怎么处理(设计 3.11「最后一个数据列吸收余量」)。三种做法 + 「全部列都 fixed」的边界。
import { createApp, h } from 'vue'
import { NDataTable, NConfigProvider } from 'naive-ui'
const v = new URLSearchParams(location.search).get('v') || 'A'
const rows = Array.from({ length: 5 }, (_, i) => ({ id: i, a: 'a' + i, b: 'b' + i, c: 'c' + i, d: 'd' + i }))
const W = 1000, fixedW = { a: 150, b: 150, c: 150 }   // 前三列钉死 150,合计 450 < 容器 1000
const mk = (fixed) => ['a', 'b', 'c', 'd'].map(k => ({ key: k, title: k, resizable: true, minWidth: 80, ...(fixedW[k] ? { width: fixedW[k] } : {}), ...(fixed ? { fixed: 'left' } : {}) }))
let columns, props = {}
if (v === 'A') { columns = mk(false); columns[3].width = 150; props.scrollX = 600 }                 // 2.1.1 现状:scrollX = Σ宽度 < 容器 → 表格比容器窄?
if (v === 'B') { columns = mk(false); props.scrollX = W }                                          // 末列不设宽,scrollX = 容器宽
if (v === 'C') { columns = mk(false); columns[3].width = W - 450; props.scrollX = W }              // 末列显式吃掉余量
if (v === 'D') { columns = mk(true); columns[3].width = W - 450; props.scrollX = W }               // 全部列 fixed + 末列显式吃余量
if (v === 'E') { columns = mk(true); columns[3].width = 150; props.scrollX = 600 }                 // 全部列 fixed + 不补余量(对照)
createApp({ setup: () => () => h(NConfigProvider, null, () => h(NDataTable, { columns, data: rows, rowKey: r => r.id, size: 'small', ...props })) }).mount('#app')
