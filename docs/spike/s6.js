// S6:官方每页条数选择器(3.0.0 决策 D3 / S2)。在外层 simple 分页的 suffix 里嵌一个非 simple 的官方 NPagination,
// 只渲染 size-picker(displayOrder: ['size-picker']),验证它能不能替代手写的 NSelect。
//
// 查询参数:
//   ?mode=    remote(默认,受控 page / pageSize,库 useSmartTable 的形状:改每页条数 → page=1)
//             local(本地数据:page 不受控,只受控 pageSize,库现方案)
//   ?lang=    zh(zhCN + dateZhCN,默认)| en(enUS)
//   ?theme=   light(默认)| dark
//   ?opts=    num(默认 [10,20,50,100])| obj({label,value} 对象)| mix(数字与对象混用)
//   ?ps=      初始 pageSize(默认 20);不在 pageSizes 里时验证「显示空白」
//   ?page=    初始页(默认 1);用于越界夹页测试
//   ?rows=    总行数(默认 200)
//   ?W=       容器宽(默认 900)
//   ?wire=    1(默认)内层 onUpdatePage 转发给外层;0 不转发(只看内层夹页会不会触发)
//   ?merge=   1 把当前 pageSize 并入 pageSizes(验证「不在列表里也能显示」的回退做法)
//   ?size=    表格 size:small(默认)| medium;innerSize=1 时内层 NPagination 也传同一个 size
//   ?innerSize= 1 内层传 size(默认 0 不传)
//   ?keep=    1 时 setSize 不把 page 重置为 1(模拟宿主不重置页码),用来观察官方内层的越界夹页
//   ?simple=  1(默认)外层 simple;0 外层 非 simple + 官方自带选择器(对照:官方原生的位置与高度)
// window.__s6:{ log, clear(), state(), measure(), setSize(n), setPage(n) }
import { createApp, h, ref, computed } from 'vue'
import { NDataTable, NPagination, NConfigProvider, NCard, zhCN, enUS, dateZhCN, dateEnUS, darkTheme } from 'naive-ui'

const q = new URLSearchParams(location.search)
const MODE = q.get('mode') || 'remote'
const LANG = q.get('lang') || 'zh'
const THEME = q.get('theme') || 'light'
const OPTS = q.get('opts') || 'num'
const PS = Number(q.get('ps') || 20)
const PAGE0 = Number(q.get('page') || 1)
const ROWS = Number(q.get('rows') || 200)
const W = Number(q.get('W') || 900)
const WIRE = q.get('wire') !== '0'
const MERGE = q.get('merge') === '1'
const SIMPLE = q.get('simple') !== '0'
const KEEP = q.get('keep') === '1'
const SIZE = q.get('size') || 'small'
const INNER_SIZE = q.get('innerSize') === '1'
document.body.style.background = THEME === 'dark' ? '#18181c' : '#fff'

const all = Array.from({ length: ROWS }, (_, i) => ({ id: i + 1, name: '行 ' + (i + 1) }))
const columns = [{ key: 'id', title: 'ID', width: 100 }, { key: 'name', title: '名称' }]
const log = []
const L = (s) => log.push(s)

const Root = {
  setup() {
    const page = ref(PAGE0)
    const pageSize = ref(PS)
    const basePageSizes = OPTS === 'obj'
      ? [{ label: '10 条/页', value: 10 }, { label: '20 条/页', value: 20 }, { label: '50 条/页', value: 50 }, { label: '100 条/页', value: 100 }]
      : OPTS === 'mix'
        ? [10, { label: '自定义 20', value: 20 }, 50, 100]
        : [10, 20, 50, 100]
    const pageSizes = computed(() => {
      if (!MERGE) return basePageSizes
      const has = basePageSizes.some((s) => (typeof s === 'number' ? s : s.value) === pageSize.value)
      return has ? basePageSizes : [...basePageSizes, pageSize.value].sort((a, b) => (typeof a === 'number' ? a : a.value) - (typeof b === 'number' ? b : b.value))
    })
    const remote = MODE === 'remote'
    const data = computed(() => (remote ? all.slice((page.value - 1) * pageSize.value, page.value * pageSize.value) : all))

    function setPage(p) { L('outer.onUpdatePage ' + p); page.value = p }
    function setSize(s) {
      L('outer.onUpdatePageSize ' + s)
      pageSize.value = s
      if (remote && !KEEP) page.value = 1 // useSmartTable.onPageSize:改每页条数 → 回第 1 页
    }
    window.__s6 = {
      log, cfg: { MODE, LANG, THEME, OPTS, PS, PAGE0, ROWS, W, WIRE, MERGE, SIMPLE },
      clear: () => (log.length = 0),
      setSize, setPage,
      state: () => ({ page: page.value, pageSize: pageSize.value, rows: document.querySelectorAll('.n-data-table-tbody .n-data-table-tr').length, jumper: document.querySelector('.n-data-table__pagination > .n-pagination input')?.value ?? null, firstRow: document.querySelector('.n-data-table-tbody .n-data-table-td')?.textContent ?? null }),
      measure() {
        const R = (sel, root = document) => {
          const e = root.querySelector(sel)
          if (!e) return null
          const r = e.getBoundingClientRect()
          return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1), cy: +(r.y + r.height / 2).toFixed(1) }
        }
        const outer = document.querySelector('.n-data-table__pagination')
        const outerPag = outer?.querySelector(':scope > .n-pagination')
        const inner = outerPag?.querySelector('.n-pagination-suffix .n-pagination')
        return {
          container: R('.n-data-table__pagination'),
          outerPagination: R('.n-data-table__pagination > .n-pagination'),
          prefix: R('.n-pagination-prefix', outerPag || document),
          prev: R('.n-pagination-item', outerPag || document),
          jumperInput: R('.n-pagination-quick-jumper, .n-pagination-simple-jumper, .n-input', outerPag || document),
          suffix: R('.n-pagination-suffix', outerPag || document),
          innerPagination: inner ? R('.n-pagination-suffix .n-pagination', outerPag) : null,
          select: R('.n-base-selection', outerPag || document),
          selectText: document.querySelector('.n-pagination-suffix .n-base-selection-label, .n-pagination .n-base-selection-label')?.textContent ?? null,
          selectPlaceholder: !!document.querySelector('.n-pagination .n-base-selection-placeholder'),
          scrollW: outer ? outer.scrollWidth : null,
          clientW: outer ? outer.clientWidth : null,
          text: outerPag?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
        }
      },
    }

    const outerPagination = computed(() => {
      const p = {
        simple: SIMPLE,
        page: remote ? page.value : undefined,
        defaultPage: remote ? undefined : PAGE0,
        pageSize: pageSize.value,
        itemCount: remote ? ROWS : undefined,
        pageSizes: pageSizes.value,
        showSizePicker: !SIMPLE,
        prefix: (info) => h('span', { class: 'spike-prefix' }, `共 ${info.itemCount} 条`),
        onUpdatePage: setPage,
        onUpdatePageSize: setSize,
      }
      if (SIMPLE) {
        p.suffix = (info) =>
          h(NPagination, {
            displayOrder: ['size-picker'],
            ...(INNER_SIZE ? { size: SIZE } : {}),
            showSizePicker: true,
            pageSizes: pageSizes.value,
            pageSize: pageSize.value,
            itemCount: info.itemCount,
            page: info.page,
            onUpdatePageSize: (s) => { L('inner.onUpdatePageSize ' + s); setSize(s) },
            onUpdatePage: (n) => { L('inner.onUpdatePage ' + n); if (WIRE) setPage(n) },
          })
      }
      return p
    })

    return () =>
      h(NConfigProvider, { locale: LANG === 'en' ? enUS : zhCN, dateLocale: LANG === 'en' ? dateEnUS : dateZhCN, theme: THEME === 'dark' ? darkTheme : null },
        () => h('div', { id: 'box', style: { width: W + 'px' } },
          h(NCard, { size: 'small', contentStyle: 'padding:12px' }, () =>
            h(NDataTable, { columns, data: data.value, rowKey: (r) => r.id, size: SIZE, remote, pagination: outerPagination.value }),
          ),
        ),
      )
  },
}
createApp(Root).mount('#app')
