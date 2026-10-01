// S8:fillHeight 与翻页位置(3.0.0 决策 D5 / S4)。
// 模式 fill:父容器定高,根元素 flex 列布局,NDataTable 传官方 flex-height(+ virtual-scroll),验证「表格填满、体内滚动、
//          分页条在底部可见、DOM 行数远小于每页行数、首屏渲染耗时」,以及宿主需要满足的前提(父容器高度、min-height:0 链)。
// 模式 flow:不开 fillHeight,整页长滚动;验证翻页后视口位置,以及「只在卡片顶部滚出视口时才滚回卡片顶部」的做法是否可靠。
//
// 查询参数:
//   ?mode=    fill(默认)| flow
//   ?H=       fill 模式父容器高度(默认 600)
//   ?ps=      每页行数(默认 100);总行数 ?total=(默认 2000,本地分页)
//   ?flex=    1(默认)传 flex-height | 0 不传(对照)
//   ?virt=    1(默认)传 virtual-scroll | 0 不传(对照:每页 N 行就是 N 行真实 DOM)
//   ?mrh=     min-row-height(不传 = 官方默认 28)
//   ?size=    small(默认,库「紧凑」)| medium(库「舒适」)
//   ?css=     full(默认)完整的 flex 链(每层 flex:1 1 0 + min-height:0)| nomin 各层缺 min-height:0 | noh 父容器没有定高(宿主没给高度)
//             basisauto 各层 flex:1 1 auto(看「没定高时能否退回自然高度」);可与 noh 组合:?css=noh-auto
//   ?minh=    传官方 min-height(px),验证「宿主没给定高时的兜底」
//   ?theme=   light | dark
//   flow 模式:
//   ?fix=     0(默认)不处理 | 1 翻页时若卡片顶部已滚出滚动容器上沿,则 scrollIntoView({block:'start'})
//   ?host=    window(默认)整页滚动 | inner 卡片在一个 overflow:auto 的宿主容器里
//   ?remote=  0(默认)本地切片 | 1 远程(翻页后 300ms 才换数据)
//   ?sticky=  0 | 1:宿主有 56px 固定顶栏,卡片设 scroll-margin-top:56px 来避让
// window.__s8 = { measure(), bottom(), nextPage(), state(), t }
import { createApp, h, ref, computed, nextTick, onMounted } from 'vue'
import { NDataTable, NConfigProvider, NCard, darkTheme, zhCN, dateZhCN } from 'naive-ui'

const q = new URLSearchParams(location.search)
const MODE = q.get('mode') || 'fill'
const H = Number(q.get('H') || 600)
const PS = Number(q.get('ps') || 100)
const TOTAL = Number(q.get('total') || 2000)
const FLEX = q.get('flex') !== '0'
const VIRT = q.get('virt') !== '0'
const MRH = q.get('mrh') ? Number(q.get('mrh')) : undefined
const SIZE = q.get('size') || 'small'
const MINH = q.get('minh') ? Number(q.get('minh')) : undefined
const CSS = q.get('css') || 'full'
const BASIS = CSS.endsWith('auto') ? '1 1 auto' : '1 1 0'
const NOH = CSS.startsWith('noh')
const THEME = q.get('theme') || 'light'
const FIX = q.get('fix') === '1'
const HOST = q.get('host') || 'window'
const REMOTE = q.get('remote') === '1'
const STICKY = q.get('sticky') === '1'
document.body.style.background = THEME === 'dark' ? '#18181c' : '#f5f5f7'

const t0 = performance.now()
const all = Array.from({ length: TOTAL }, (_, i) => ({ id: i + 1, code: 'M' + (1000 + i), name: '物料 ' + (i + 1), dept: ['采购部', '生产部', '仓储部'][i % 3], qty: (i * 37) % 900, note: '备注 ' + i }))
const columns = [
  { key: 'id', title: 'ID', width: 80 }, { key: 'code', title: '编码', width: 120 }, { key: 'name', title: '名称', width: 160 },
  { key: 'dept', title: '部门', width: 120 }, { key: 'qty', title: '数量', width: 100 }, { key: 'note', title: '备注' },
]

const state = { t: {}, pageChanges: [], fixCalls: 0 }
window.__s8 = state

function scrollParentOf(el) {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY
    if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) return p
  }
  return null // 文档
}

const Root = {
  setup() {
    const page = ref(1)
    const cardRef = ref(null)
    const remoteRows = ref(null)
    const data = computed(() => (REMOTE ? remoteRows.value ?? all.slice(0, PS) : all))
    function onPage(p) {
      const card = cardRef.value?.$el
      const before = { scrollY: window.scrollY, top: card?.getBoundingClientRect().top }
      page.value = p
      if (REMOTE) setTimeout(() => (remoteRows.value = all.slice((p - 1) * PS, p * PS)), 300)
      if (FIX && card) {
        // 只在卡片顶部已滚出滚动容器上沿时才滚;在点击的当下就滚(卡片顶部位置与表体高度无关,不必等数据回来)
        const sp = scrollParentOf(card)
        const top = card.getBoundingClientRect().top - (sp ? sp.getBoundingClientRect().top : 0)
        const margin = STICKY ? 56 : 0
        if (top < margin) { state.fixCalls++; card.scrollIntoView({ block: 'start', behavior: 'instant' }) }
      }
      state.pageChanges.push({ p, before })
    }
    const pagination = computed(() => ({
      page: page.value, pageSize: PS, simple: true, ...(REMOTE ? { itemCount: TOTAL } : {}),
      prefix: (i) => h('span', `共 ${i.itemCount} 条`), onUpdatePage: onPage,
    }))
    const tableProps = computed(() => ({
      columns, data: data.value, rowKey: (r) => r.id, size: SIZE, remote: REMOTE, pagination: pagination.value,
      ...(MODE === 'fill' ? {
        ...(FLEX ? { flexHeight: true } : {}), ...(VIRT ? { virtualScroll: true } : {}), ...(MRH ? { minRowHeight: MRH } : {}), ...(MINH ? { minHeight: MINH } : {}),
        style: { flex: BASIS, minHeight: CSS === 'nomin' ? undefined : 0 },
      } : {}),
    }))

    const q = (s) => document.querySelector(s)
    const R = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return { top: +r.top.toFixed(1), bottom: +r.bottom.toFixed(1), h: +r.height.toFixed(1), w: +r.width.toFixed(1) } }
    Object.assign(state, {
      measure() {
        const parent = q('#parent') || q('#inner-host')
        const tbodyRows = document.querySelectorAll('.n-data-table-tbody .n-data-table-tr, .n-data-table-tr')
        const body = q('.n-data-table-base-table-body')
        const sc = q('.n-data-table-base-table-body .n-scrollbar-container')
        const pag = q('.n-data-table__pagination')
        return {
          parent: R(parent), card: R(q('.n-card')), table: R(q('.n-data-table')), body: R(body), pagination: R(pag),
          header: R(q('.n-data-table-base-table-header')), rowsInDom: [...document.querySelectorAll('tr.n-data-table-tr')].length,
          rowH: R(q('tr.n-data-table-tr'))?.h ?? null,
          bodyScroll: sc ? { scrollTop: sc.scrollTop, scrollHeight: sc.scrollHeight, clientHeight: sc.clientHeight } : null,
          virtualList: !!q('.v-vl'), tableLayout: getComputedStyle(q('.n-data-table-table') || document.body).tableLayout,
          pagVisibleInParent: pag && parent ? (R(pag).bottom <= R(parent).bottom + 0.5 && R(pag).top >= R(body)?.top) : null,
          docScrollH: document.documentElement.scrollHeight, winH: window.innerHeight, scrollY: window.scrollY,
          firstId: q('tr.n-data-table-tr td')?.textContent ?? null,
          t: state.t,
        }
      },
      scrollBodyToBottom() {
        const sc = q('.n-data-table-base-table-body .n-scrollbar-container') || q('.v-vl')
        if (!sc) return Promise.resolve(null)
        sc.scrollTop = sc.scrollHeight
        return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => {
          try {
            const rows = [...document.querySelectorAll('tr.n-data-table-tr')]
            const lastRow = rows[rows.length - 1]
            const bodyEl = q('.n-data-table-base-table-body') || sc
            const bodyR = bodyEl.getBoundingClientRect()
            const lr = lastRow?.getBoundingClientRect()
            resolve({ rowsInDom: rows.length, lastText: lastRow?.querySelector('td')?.textContent, lastVisible: lr ? lr.bottom <= bodyR.bottom + 1 && lr.top >= bodyR.top : null, gapBelowLast: lr ? +(bodyR.bottom - lr.bottom).toFixed(1) : null, scrollTop: sc.scrollTop, scrollHeight: sc.scrollHeight, clientHeight: sc.clientHeight })
          } catch (e) { resolve({ error: String(e) }) } // 回调里抛错会让 Promise 永不 resolve,evaluate 就永远挂住
        })))
      },
      nextPage: () => q('.n-data-table__pagination .n-pagination-item:last-of-type, .n-data-table__pagination .n-pagination-item--button:last-of-type')?.click(),
      pageNow: () => page.value,
    })

    onMounted(() => {
      requestAnimationFrame(() => requestAnimationFrame(() => { state.t.firstPaint = Math.round(performance.now() - t0) }))
    })

    const table = () => h(NDataTable, tableProps.value)
    const card = () =>
      h(NCard, {
        ref: cardRef, size: 'small', style: MODE === 'fill' ? { flex: BASIS, minHeight: CSS === 'nomin' ? undefined : 0, display: 'flex', flexDirection: 'column', ...(STICKY ? {} : {}) } : { scrollMarginTop: STICKY ? '56px' : undefined },
        contentStyle: MODE === 'fill' ? { flex: BASIS, minHeight: CSS === 'nomin' ? undefined : 0, display: 'flex', flexDirection: 'column', padding: '12px' } : 'padding:12px',
      }, () => [
        h('div', { style: 'height:32px;display:flex;align-items:center;margin-bottom:8px' }, '〔工具栏占位 32px〕'),
        table(),
      ])

    return () =>
      h(NConfigProvider, { locale: zhCN, dateLocale: dateZhCN, theme: THEME === 'dark' ? darkTheme : null }, () => {
        if (MODE === 'fill') {
          return h('div', { id: 'parent', style: { height: NOH ? undefined : H + 'px', display: 'flex', flexDirection: 'column', border: '1px dashed #c00', boxSizing: 'border-box' } },
            h('div', { class: 'smart-root', style: { flex: BASIS, minHeight: CSS === 'nomin' ? undefined : 0, display: 'flex', flexDirection: 'column' } }, card()))
        }
        const flowCard = h('div', { id: 'flow' }, [
          h('div', { style: 'height:300px;background:' + (THEME === 'dark' ? '#222' : '#e8e8ee') }, '〔页面上方 300px 内容〕'),
          card(),
          h('div', { style: 'height:1500px' }, '〔页面下方 1500px 内容〕'),
        ])
        const sticky = STICKY ? h('div', { style: 'position:fixed;top:0;left:0;right:0;height:56px;background:#36a;color:#fff;z-index:10;line-height:56px;padding-left:16px' }, '宿主固定顶栏 56px') : null
        if (HOST === 'inner') return h('div', { id: 'inner-host', style: 'height:520px;overflow:auto;border:1px solid #888' }, [flowCard])
        return h('div', null, [sticky, flowCard])
      })
  },
}
createApp(Root).mount('#app')
