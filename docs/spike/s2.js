// S2:「放大」= Teleport(to=body, disabled 随放大态切换)+ position:fixed + 滚动锁定。
// 验证:组件状态是否保留、DOM 搬动后表格滚动位置 / 焦点 / 输入框内容是否丢失、宿主祖先有 transform 时是否仍能盖满视口、宿主顶栏 z-index 更高时的表现。
import { createApp, h, ref, nextTick, Teleport } from 'vue'
import { NDataTable, NConfigProvider, NInput, NButton } from 'naive-ui'

const rows = Array.from({ length: 500 }, (_, i) => ({ id: i + 1, code: 'M' + (1000 + i), name: '物料' + i }))
const columns = [{ type: 'selection' }, { key: 'code', title: '编码', width: 140 }, { key: 'name', title: '名称' }]
const FIXED_H = new URLSearchParams(location.search).has('fixedh')   // 隔离变量:高度属性恒定,只看 Teleport 搬 DOM 本身
const max = ref(false)
const checked = ref([])
window.__s2 = { max, checked }

createApp({
  setup: () => () => h(NConfigProvider, null, () => h(Teleport, { to: 'body', disabled: !max.value }, h('div', { class: max.value ? 'max-layer' : '', id: 'layer' }, [
    h('div', { style: 'display:flex;gap:8px;margin-bottom:8px' }, [
      h(NInput, { id: 'kw', placeholder: '输入后再放大', style: 'width:200px' }),
      h(NButton, { id: 'maxbtn', onClick: () => (max.value = !max.value) }, () => (max.value ? '还原' : '放大')),
    ]),
    h('div', { class: 'box' }, h(NDataTable, { columns, data: rows, rowKey: r => r.id, size: 'small', maxHeight: FIXED_H ? 360 : (max.value ? undefined : 360), flexHeight: FIXED_H ? false : max.value, style: !FIXED_H && max.value ? 'height:100%' : '', virtualScroll: false, checkedRowKeys: checked.value, 'onUpdate:checkedRowKeys': v => (checked.value = v), pagination: false })),
  ]))),
}).mount('#app')
