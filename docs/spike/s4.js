// S4:用库 2.1.1 现状的 src(只读引用)复现 C1(多列排序被截成单列)与 C2(defaultSortOrder 被受控 sortOrder 盖掉)。
import { createApp, h } from 'vue'
import { NConfigProvider } from 'naive-ui'
import { SmartTable } from '../../src/index'

const items = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, g: ['A', 'B', 'C'][i % 3], n: (i * 7) % 12, d: (i * 5) % 12 }))
const log = { c1: [], c2: [] }
window.__log = log
const page = (list) => async (params) => ({ items: list, total: list.length })

// C1:两列都写 sorter: { multiple },远程模式,看请求参数与箭头
const c1cols = [
  { key: 'id', title: 'id', width: 80 },
  { key: 'g', title: 'g', width: 100, sorter: { compare: (a, b) => a.g.localeCompare(b.g), multiple: 2 } },
  { key: 'n', title: 'n', width: 100, sorter: { compare: (a, b) => a.n - b.n, multiple: 1 } },
]
// C2:列上写 defaultSortOrder,远程模式,看首次请求有没有带排序、箭头有没有回显
const c2cols = [
  { key: 'id', title: 'id', width: 80 },
  { key: 'd', title: 'd', width: 100, sorter: { compare: (a, b) => a.d - b.d, multiple: 1 }, defaultSortOrder: 'descend' },
]
createApp({
  setup: () => () => h(NConfigProvider, null, () => [
    h('div', { class: 'box', id: 'c1' }, h(SmartTable, { columns: c1cols, rowKey: 'id', toolbar: false, fetcher: async (p) => { log.c1.push(JSON.parse(JSON.stringify(p))); return { items, total: items.length } } })),
    h('div', { class: 'box', id: 'c2' }, h(SmartTable, { columns: c2cols, rowKey: 'id', toolbar: false, fetcher: async (p) => { log.c2.push(JSON.parse(JSON.stringify(p))); return { items, total: items.length } } })),
  ]),
}).mount('#app')
