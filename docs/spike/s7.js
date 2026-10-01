// S7:列头过滤面板的键盘与焦点(3.0.0 决策 D6 / Q-6 / S3)。真实 NDataTable 表头里放库式漏斗触发器 + NPopover 面板,
// 面板内放 NSelect / NDatePicker / NInput / 两个按钮,验证 Esc 与下拉的协作、焦点进出与循环、空白处点击、点外部关闭、
// 以及「点漏斗不触发排序」到底要不要 stopPropagation。
//
// 查询参数:
//   ?trig=    attr(默认)漏斗 span 带 data-data-table-filter,不 stopPropagation(官方 Header.mjs:107 的跳过标记)
//             stop  旧做法:@click.stop,无 data 属性
//             none  对照:既无属性也不 stop(应当触发排序)
//   ?esc=     cap(默认)面板 keydown 用 capture 阶段:有下拉展开就放行给下拉,否则关面板并 stopPropagation
//             plan  计划 Task 10 原写法:冒泡阶段,无条件 close + stopPropagation
//             bubble 冒泡阶段 + 下拉展开标志(预期失效:下拉已先把自己关掉,标志已清)
//   ?focus=   full(默认)tabindex=-1 容器 + 打开自动聚焦第一个控件 + Tab 循环 + Esc/确定/重置后焦点还给漏斗
//             none  只有 NPopover 默认行为
//   ?pop=     click(默认,与计划 Task 10 相同:trigger='click' + v-model:show)| manual(受控 + onClickoutside)
//   ?theme=   light | dark
// window.__s7 = { log, state(), active(), clear() }
import { createApp, h, ref, defineComponent, nextTick, watch } from 'vue'
import {
  NDataTable, NPopover, NSelect, NDatePicker, NInput, NButton, NConfigProvider, NCard, darkTheme, zhCN, dateZhCN,
} from 'naive-ui'

const q = new URLSearchParams(location.search)
const TRIG = q.get('trig') || 'attr'
const ESC = q.get('esc') || 'cap'
const FOCUS = q.get('focus') || 'full'
const POP = q.get('pop') || 'click'
const THEME = q.get('theme') || 'light'
document.body.style.background = THEME === 'dark' ? '#18181c' : '#fff'

const log = []
const L = (s) => log.push(s)
let sortCount = 0
let hostClicks = 0

const Funnel = defineComponent({
  setup() {
    const show = ref(false)
    const panelRef = ref(null)
    const trigRef = ref(null)
    const selOpen = ref(false)
    const dateOpen = ref(false)
    const action = ref('contains')
    const text = ref('')
    const date = ref(null)
    let returnFocus = false

    const focusables = () =>
      [...(panelRef.value?.querySelectorAll('input:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? [])]
    watch(show, (open) => {
      L(open ? 'show=true' : 'show=false')
      if (!open && FOCUS === 'full' && returnFocus) {
        returnFocus = false
        trigRef.value?.querySelector('button')?.focus()
      }
    })
    watch(panelRef, (el) => {
      if (el && show.value && FOCUS === 'full') nextTick(() => focusables()[0]?.focus())
    })
    function close(back) { returnFocus = back; show.value = false }

    function onKeydown(e) {
      if (e.key === 'Escape') {
        L(`panel.keydown(Esc) phase=${e.eventPhase === 1 ? 'capture' : 'bubble'} selOpen=${selOpen.value} dateOpen=${dateOpen.value}`)
        if (ESC === 'plan') { e.stopPropagation(); close(true); return }
        if (ESC === 'bubble') { if (selOpen.value || dateOpen.value) return; e.stopPropagation(); close(true); return }
        // cap
        if (selOpen.value || dateOpen.value) return // 放行:NSelect / NDatePicker 自己关下拉
        e.stopPropagation()
        close(true)
        return
      }
      if (e.key === 'Tab' && FOCUS === 'full') {
        const f = focusables()
        if (!f.length) return
        const a = document.activeElement
        if (e.shiftKey && (a === f[0] || a === panelRef.value)) { e.preventDefault(); f[f.length - 1].focus() }
        else if (!e.shiftKey && a === f[f.length - 1]) { e.preventDefault(); f[0].focus() }
      }
    }

    const panel = () =>
      h('div', {
        ref: panelRef, class: 'panel', role: 'dialog', 'aria-label': '筛选 名称', tabindex: FOCUS === 'full' ? -1 : undefined,
        style: { background: THEME === 'dark' ? '#48484e' : '#fff', color: THEME === 'dark' ? '#ddd' : '#333', borderRadius: '3px', boxShadow: '0 3px 9px rgba(0,0,0,.18)' },
        onClick: (e) => e.stopPropagation(),
        ...(ESC === 'cap' ? { onKeydownCapture: onKeydown } : { onKeydown }),
      }, [
        h('div', { class: 'row' }, [
          h(NSelect, { size: 'small', value: action.value, options: [{ label: '包含', value: 'contains' }, { label: '等于', value: 'equal' }, { label: '大于', value: 'gt' }], consistentMenuWidth: false, style: 'width:110px',
            'onUpdate:value': (v) => (action.value = v), 'onUpdate:show': (v) => { selOpen.value = v; L('select.show=' + v) } }),
          h(NInput, { size: 'small', clearable: true, value: text.value, 'onUpdate:value': (v) => (text.value = v), placeholder: '关键字' }),
        ]),
        h('div', { class: 'row' }, [
          h(NDatePicker, { type: 'date', size: 'small', clearable: true, style: 'width:100%', value: date.value, 'onUpdate:value': (v) => (date.value = v),
            'onUpdate:show': (v) => { dateOpen.value = v; L('date.show=' + v) } }),
        ]),
        h('div', { class: 'foot' }, [
          h(NButton, { size: 'tiny', onClick: () => { text.value = ''; action.value = 'contains'; date.value = null; close(true) } }, () => '重置'),
          h(NButton, { size: 'tiny', type: 'primary', onClick: () => { L('confirm'); close(true) } }, () => '确定'),
        ]),
      ])

    const trigger = () =>
      h('span', {
        ref: trigRef, class: 'th-funnel',
        ...(TRIG === 'attr' ? { 'data-data-table-filter': 'true' } : {}),
        ...(TRIG === 'stop' ? { onClick: (e) => e.stopPropagation() } : {}),
        ...(POP === 'manual' ? { onClick: (e) => { if (TRIG === 'stop') e.stopPropagation(); show.value = !show.value } } : {}),
      }, h(NButton, { quaternary: true, size: 'tiny', 'aria-label': '筛选', 'aria-haspopup': 'dialog', 'aria-expanded': show.value ? 'true' : 'false' }, () => '▼'))

    window.__s7_funnel = { text, action, date, show }
    return () =>
      h(NPopover, POP === 'manual'
        ? { trigger: 'manual', show: show.value, placement: 'bottom', showArrow: false, raw: true, 'onClickoutside': () => { L('popover.clickoutside'); close(false) } }
        : { trigger: 'click', show: show.value, 'onUpdate:show': (v) => { if (!v) L('popover.update:show(false)'); show.value = v }, placement: 'bottom', showArrow: false, raw: true },
      { trigger, default: panel })
  },
})

const columns = [
  { key: 'a', title: () => h('span', { style: 'display:inline-flex;align-items:center' }, ['名称', h(Funnel)]), sorter: (a, b) => a.a.localeCompare(b.a), width: 220 },
  { key: 'b', title: '其它' },
]
const rows = Array.from({ length: 5 }, (_, i) => ({ id: i, a: 'r' + (5 - i), b: 'b' + i }))

const vis = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden'

createApp({
  setup() {
    window.__s7 = {
      log,
      clear: () => { log.length = 0; sortCount = 0; hostClicks = 0 },
      state: () => ({ sortCount, hostClicks, show: window.__s7_funnel.show.value,
        // 可见性口径:弹层关闭后 DOM 可能还在(离场过渐变 / display:none),只数真正占了版面的
        panelOpen: [...document.querySelectorAll('.panel')].some(vis), selMenu: [...document.querySelectorAll('.n-base-select-menu')].some(vis),
        input: window.__s7_funnel.text.value, action: window.__s7_funnel.action.value, datePanel: [...document.querySelectorAll('.n-date-panel')].some(vis),
        sortedFirst: document.querySelector('.n-data-table-tbody .n-data-table-td')?.textContent }),
      active: () => {
        const a = document.activeElement
        if (!a) return null
        return `${a.tagName.toLowerCase()}${a.className ? '.' + String(a.className).split(' ').filter(Boolean).slice(0, 3).join('.') : ''}${a.getAttribute?.('aria-label') ? '[' + a.getAttribute('aria-label') + ']' : ''}${a.getAttribute?.('role') ? '{' + a.getAttribute('role') + '}' : ''}`
      },
    }
    return () =>
      h(NConfigProvider, { locale: zhCN, dateLocale: dateZhCN, theme: THEME === 'dark' ? darkTheme : null }, () =>
        h('div', { id: 'box', onClick: () => hostClicks++ },
          h(NCard, { size: 'small' }, () =>
            h(NDataTable, { columns, data: rows, rowKey: (r) => r.id, size: 'small', 'onUpdate:sorter': (s) => { sortCount++; L('sorter ' + JSON.stringify(s)) } }))))
  },
}).mount('#app')
