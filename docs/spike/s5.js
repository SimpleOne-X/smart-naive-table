// S5:吸收余量(3.0.0 决策 D2 / S1)。在真实 NDataTable 上模拟库的列宽状态机(钉住的 widths、
// onUnstableColumnResize 首帧 freeze、松手才 setWidth、dragDelta、resizable、minWidth、scrollX),
// 对候选方案逐一实测「拖过列宽之后余量由谁吃、Naive 内部拖拽宽度会不会盖掉我们」。
//
// 查询参数:
//   ?v=   机制变体(见下 VARIANTS)       a | b | bs | ca | cb | da | db
//   ?W=   容器宽(默认 1000)             ?colW= 每列声明宽(默认 150)
//   ?fill= 1 时给 NDataTable 传 flex-height 并定高 320px(= 3.0.0 的 fillHeight,表头 / 表体拆成两张 table);2 时再加 virtual-scroll
//   ?sc=  场景(列结构)                  plain4 | plain3 | fr | allfixed | opfree | opfree2
// 页面暴露 window.__s5 = { measure(), hide(key), show(key), absorber(), state(), reset() },由浏览器自动化驱动拖拽并读数。
//
// VARIANTS(与决策书 D2 对应):
//   a   吸收列钉住后不写 width,scroll-x = Σ下限(计划 Task 12 现方案,对照);下限 = 拖过的宽度 ?? 声明宽 ?? minWidth ?? 120
//   b   规格原方案字面:吸收列也冻结成「当前渲染宽度」,显式 width = max(冻结宽, 容器 − 其余列宽之和 − 拖拽增量),scroll-x = 其余 + 吸收列宽;每帧重算
//   bf  b 的变体:吸收列不冻结(下限取声明宽 / minWidth),其余同 b;每帧重算
//   bs  同 bf,但拖拽中不重算吸收列宽(只在松手后重算),验证「不每帧重建列」是否可行
//   ca  a + 钉住态下吸收列 resizable:false
//   cb  bf + 钉住态下吸收列 resizable:false
//   da  a + 吸收列身份变化 / 吸收列拖拽结束时 tableKey++ 重挂(清掉 Naive 内部 resizableWidthsRef)
//   db  bf + 同上重挂
//   dy  da + 吸收列 minWidth = 当前「填充宽」max(下限, 容器 − 其余列宽之和),让 Naive 自己把向左拖的宽度夹住(不产生拖拽中的抖动);松手后重挂
//   dc  da + 吸收列永远 resizable:false(含未钉住时),即最后一个可拖列不可拖(用它左邻列的把手调)
//   dk  dc + 选择性重挂:只在「新吸收列在本次挂载期间被拖过」(Naive 内部 map 里有它的残留)时才 tableKey++,并在重挂后清空记录
//   (场景里可用 swap(C,D) 交换顺序,模拟「调整列顺序」使吸收列身份变化)
// 吸收列 = 最后一个可见、非 fixed、resizable !== false 的叶子列;没有时退为最后一个叶子列并一律用「显式宽度」(b 的算法)。
import { createApp, h, ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { NDataTable, NConfigProvider } from 'naive-ui'

const q = new URLSearchParams(location.search)
const V = q.get('v') || 'a'
const W = Number(q.get('W') || 1000)
const COLW = Number(q.get('colW') || 150)
const SC = q.get('sc') || 'plain4'
const FILL = Number(q.get('fill') || 0)
const VARIANTS = {
  a: { mech: 'a' },
  b: { mech: 'b', live: true, freezeAbs: true },
  bf: { mech: 'b', live: true },
  bs: { mech: 'b', live: false },
  ca: { mech: 'a', noDragAbs: true },
  cb: { mech: 'b', live: true, noDragAbs: true },
  da: { mech: 'a', remount: true },
  db: { mech: 'b', live: true, remount: true },
  dy: { mech: 'a', remount: true, clampMin: true },
  dc: { mech: 'a', remount: true, noDragAbsAlways: true },
  dk: { mech: 'a', remount: 'sel', noDragAbsAlways: true },
}
const cfg = VARIANTS[V]
const FALLBACK = 120

const mkCol = (key, extra = {}) => ({ key, title: key, width: COLW, minWidth: 80, ...extra })
const SCENARIOS = {
  plain3: () => [mkCol('A'), mkCol('B'), mkCol('C')],
  plain4: () => [mkCol('A'), mkCol('B'), mkCol('C'), mkCol('D')],
  fr: () => [mkCol('A'), mkCol('B'), mkCol('C'), mkCol('Op', { width: 100, fixed: 'right' })],
  allfixed: () => [mkCol('A', { fixed: 'left' }), mkCol('B', { fixed: 'left' }), mkCol('C', { fixed: 'right' })],
  opfree: () => [mkCol('A'), mkCol('B'), mkCol('C'), mkCol('Op', { width: 100, resizable: false })], // 未 fixed 且 resizable:false 的操作列
  opfree2: () => [mkCol('A'), mkCol('B'), mkCol('C'), mkCol('Op', { width: 100, resizable: false, fixed: 'right' })],
}
const declared = SCENARIOS[SC]()

const Root = {
  setup() {
    const hidden = ref(new Set())
    const order = ref(declared.map((c) => c.key))
    const widths = ref({})            // 库的 widths:拖过之后钉住
    const dragDelta = ref(0)
    const hostWidth = ref(W - 2)
    const tableKey = ref(0)
    const remounts = ref(0)
    const hostEl = ref(null)
    const pinned = computed(() => Object.keys(widths.value).length > 0)
    const visible = computed(() => order.value.map((k) => declared.find((c) => c.key === k)).filter((c) => !hidden.value.has(c.key)))
    const isResizable = (c) => c.resizable !== false

    const absorberKey = computed(() => {
      const cand = visible.value.filter((c) => c.fixed === undefined && isResizable(c))
      if (cand.length) return cand[cand.length - 1].key
      return visible.value.length ? visible.value[visible.value.length - 1].key : null
    })
    // 「没有可吸收的非固定可拖列」 → 退回最后一个叶子列,用显式宽度
    const fallbackAbsorber = computed(() => {
      const cand = visible.value.filter((c) => c.fixed === undefined && isResizable(c))
      return cand.length === 0
    })
    const floorOf = (c) => widths.value[c.key] ?? c.width ?? c.minWidth ?? FALLBACK
    const widthOfOther = (c) => widths.value[c.key] ?? c.width ?? c.minWidth ?? FALLBACK
    const explicitMode = computed(() => cfg.mech === 'b' || fallbackAbsorber.value)

    // 非吸收列宽之和(静态,不含拖拽增量)
    const othersSum = computed(() =>
      visible.value.filter((c) => c.key !== absorberKey.value).reduce((s, c) => s + widthOfOther(c), 0),
    )
    const absFloor = computed(() => {
      const c = visible.value.find((x) => x.key === absorberKey.value)
      return c ? floorOf(c) : 0
    })
    // 吸收列显式宽度(b / 退路)。live:拖拽增量也计入(让出 / 占回)
    const absExplicit = computed(() =>
      Math.max(absFloor.value, hostWidth.value - othersSum.value - (cfg.live !== false || fallbackAbsorber.value ? dragDelta.value : 0)),
    )

    const columns = computed(() =>
      visible.value.map((c) => {
        const out = { key: c.key, title: c.title, minWidth: c.minWidth, resizable: isResizable(c) }
        if (c.fixed) out.fixed = c.fixed
        if (cfg.noDragAbsAlways && c.key === absorberKey.value) out.resizable = false
        if (!pinned.value) {
          out.width = c.width // 未钉住:声明宽度,Naive 自己摊余量(2.1.1 现状)
          return out
        }
        if (c.key === absorberKey.value) {
          if (cfg.noDragAbs) out.resizable = false // (c) 钉住态下吸收列不可拖
          if (cfg.clampMin) out.minWidth = Math.max(absFloor.value, hostWidth.value - othersSum.value)
          if (explicitMode.value) out.width = absExplicit.value
          // 机制 a:不写 width
          return out
        }
        out.width = widthOfOther(c)
        return out
      }),
    )
    const scrollX = computed(() => {
      if (!pinned.value) return visible.value.reduce((s, c) => s + (c.width ?? 0), 0)
      if (explicitMode.value) return othersSum.value + absExplicit.value + dragDelta.value // othersSum 是拖前的静态宽,拖拽增量始终要计入
      return othersSum.value + absFloor.value + dragDelta.value
    })

    // ---- 与 SmartTable.vue 一致的拖拽状态机 ----
    const draggedKeys = new Set() // 本次挂载期间拖过的列:它们在 Naive 的 resizableWidthsRef 里有残留
    let resizingKey = null
    let pendingWidth = 0
    function freezeWidths(getW) {
      const next = { ...widths.value }
      let changed = false
      for (const c of visible.value) {
        if (next[c.key] !== undefined) continue
        if (pinnedAbsorberSkip(c)) continue
        const w = getW(c.key)
        if (typeof w === 'number' && w > 0) { next[c.key] = Math.round(w); changed = true }
      }
      if (changed) widths.value = next
    }
    // 吸收列默认不冻结(下限取声明宽 / minWidth;「全部 fixed」退路同理,只是要写显式宽度);只有变体 b 冻结它
    function pinnedAbsorberSkip(c) {
      return !cfg.freezeAbs && c.key === absorberKey.value && visible.value.length > 1
    }
    function endResize() {
      if (resizingKey === null) return
      const key = resizingKey
      resizingKey = null
      dragDelta.value = 0
      widths.value = { ...widths.value, [key]: pendingWidth }
      if (cfg.remount && key === absorberKey.value) { tableKey.value++; remounts.value++ }
    }
    function onColumnResize(resized, limited, column, getColumnWidth) {
      const key = String(column.key)
      draggedKeys.add(key)
      if (resizingKey !== key) {
        endResize()
        resizingKey = key
        freezeWidths(getColumnWidth)
        window.addEventListener('mouseup', endResize, { once: true })
      }
      pendingWidth = limited
      dragDelta.value = limited - (widths.value[key] ?? limited)
    }

    // (d) 吸收列身份变化时重挂(只有钉住后才有意义)
    watch(absorberKey, (n, o) => {
      if (!cfg.remount || !pinned.value || n === o) return
      if (cfg.remount === 'sel' && !draggedKeys.has(n)) return
      tableKey.value++; remounts.value++
    })

    // 容器可见宽 = Naive 横向滚动容器的 clientWidth(扣掉 bordered 的 1px 边);重挂后要重新量
    const measureHost = () => {
      const sc = hostEl.value?.querySelector('.n-scrollbar-container')
      if (sc && sc.clientWidth) hostWidth.value = sc.clientWidth
    }
    watch(tableKey, () => { draggedKeys.clear(); nextTick(measureHost) })
    let ro
    onMounted(() => {
      nextTick(measureHost)
      ro = new ResizeObserver(measureHost)
      ro.observe(hostEl.value)
    })
    onBeforeUnmount(() => ro?.disconnect())

    window.__s5 = {
      cfg: { V, W, COLW, SC },
      hide: (k) => { const s = new Set(hidden.value); s.add(k); hidden.value = s },
      show: (k) => { const s = new Set(hidden.value); s.delete(k); hidden.value = s },
      swap: (a, b) => { const o = [...order.value]; const i = o.indexOf(a), j = o.indexOf(b); o[i] = b; o[j] = a; order.value = o },
      setHostWidth: (w) => { hostEl.value.style.width = w + 'px' },
      scrollLeft: () => hostEl.value.querySelector('.n-scrollbar-container')?.scrollLeft ?? 0,
      absorber: () => absorberKey.value,
      state: () => ({ widths: { ...widths.value }, pinned: pinned.value, absorber: absorberKey.value, remounts: remounts.value, scrollX: scrollX.value, dragDelta: dragDelta.value, hostWidth: hostWidth.value, explicit: explicitMode.value, colsWidthProp: columns.value.map((c) => [c.key, c.width ?? null, c.resizable]) }),
      reset: () => { widths.value = {}; tableKey.value++ },
      measure() {
        const host = hostEl.value
        const ths = [...host.querySelectorAll('th[data-col-key]')]
        const cols = {}
        ths.forEach((th) => { cols[th.getAttribute('data-col-key')] = +th.getBoundingClientRect().width.toFixed(1) })
        const tbl = host.querySelector('table')
        const hostRect = host.getBoundingClientRect()
        const sumCols = Object.values(cols).reduce((a, b) => a + b, 0)
        const lastTh = ths[ths.length - 1]
        const scroller = host.querySelector('.n-scrollbar-container') || host
        return {
          cols,
          sumCols: +sumCols.toFixed(1),
          table: tbl ? +tbl.getBoundingClientRect().width.toFixed(1) : null,
          host: hostRect.width,
          scrollW: scroller.scrollWidth,
          clientW: scroller.clientWidth,
          // 右侧留白 = 容器右缘 − 最后一列右缘(>0 表示没填满;< 0 表示超出容器,靠横向滚动)
          gapRight: lastTh ? +(scroller.getBoundingClientRect().right - lastTh.getBoundingClientRect().right).toFixed(1) : null,
          layout: tbl ? getComputedStyle(tbl).tableLayout : null,
        }
      },
    }

    const data = Array.from({ length: 3 }, (_, i) => ({ id: i, A: 'a' + i, B: 'b' + i, C: 'c' + i, D: 'd' + i, Op: 'op' }))
    return () =>
      h('div', { id: 'host', ref: hostEl, style: { width: W + 'px' } },
        h(NConfigProvider, null, () =>
          h(NDataTable, {
            key: tableKey.value,
            columns: columns.value,
            data,
            rowKey: (r) => r.id,
            size: 'small',
            bordered: true,
            singleLine: false,
            scrollX: scrollX.value,
            tableLayout: pinned.value ? 'fixed' : undefined,
            ...(FILL ? { flexHeight: true, style: { height: '320px' } } : {}),
            ...(FILL === 2 ? { virtualScroll: true, minRowHeight: 40 } : {}),
            onUnstableColumnResize: onColumnResize,
          }),
        ),
      )
  },
}
createApp(Root).mount('#app')
