// S1:真实 NDataTable 上验证 —— 表头「标题→漏斗→官方排序箭头」、悬停显现、键盘可达、simple 分页、多列排序
import { createApp, h, ref, defineComponent } from 'vue'
import { NDataTable, NPopover, NConfigProvider, NInput, NSelect, NButton } from 'naive-ui'

const rows = Array.from({ length: 300 }, (_, i) => ({ id: i + 1, code: 'M' + (1000 + i), name: '物料' + i, dept: ['采购部', '生产部', '仓储部'][i % 3], amount: (i * 37) % 900 + 10 }))

// 自有漏斗:<button>(可聚焦),放在 title 渲染里;气泡里是「多条件」内容的最小替身(真实内容在 ColumnFilter 里)
const Funnel = defineComponent({
  props: { active: Boolean },
  setup(p) {
    const show = ref(false)
    return () => h(NPopover, { trigger: 'click', placement: 'bottom', show: show.value, 'onUpdate:show': v => (show.value = v) }, {
      trigger: () => h('button', { class: ['th-funnel', p.active && 'on'], type: 'button', 'aria-label': '筛选', onClick: e => e.stopPropagation() }, '▼'),
      default: () => h('div', { class: 'pop-body', style: 'width:240px;display:flex;flex-direction:column;gap:8px' }, [
        h(NSelect, { size: 'small', value: 'contains', options: [{ label: '包含', value: 'contains' }, { label: '等于', value: 'equal' }] }),
        h(NInput, { size: 'small', placeholder: '请输入' }),
        h(NButton, { size: 'small', type: 'primary', onClick: () => (show.value = false) }, () => '确定'),
      ]),
    })
  },
})

const columns = [
  { type: 'selection' },
  { key: 'code', title: () => h('span', { class: 'smart-table-th' }, ['编码', h(Funnel)]), sorter: { compare: (a, b) => a.code.localeCompare(b.code), multiple: 1 }, width: 140, resizable: true, minWidth: 100 },
  { key: 'name', title: () => h('span', { class: 'smart-table-th' }, ['名称', h(Funnel)]), width: 200, resizable: true, minWidth: 100 },
  { key: 'dept', title: '部门', sorter: { compare: (a, b) => a.dept.localeCompare(b.dept), multiple: 2 }, width: 140, resizable: true, minWidth: 100 },
  { key: 'amount', title: '金额', sorter: { compare: (a, b) => a.amount - b.amount, multiple: 3 }, width: 140, align: 'right', resizable: true, minWidth: 100 },
]

createApp({
  setup: () => () => h(NConfigProvider, null, () => h(NDataTable, {
    columns, data: rows, rowKey: r => r.id, size: 'small', maxHeight: 420, scrollX: 720,
    pagination: { simple: true, pageSize: 100, pageSizes: [100, 500, 1000], showSizePicker: true, prefix: ({ itemCount }) => `共 ${itemCount} 条`, suffix: () => h(NSelect, { size: 'small', style: 'width:110px', value: 100, options: [100, 500, 1000].map(n => ({ label: n + ' / 页', value: n })) }) },
  })),
}).mount('#app')
