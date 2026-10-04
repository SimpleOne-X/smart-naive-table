import { nextTick, onScopeDispose, watch } from 'vue'

/**
 * 行拖拽(sortablejs 懒加载)。要点是**绑定时机**:
 *
 * Naive 的 n-data-table 在**没有行**时渲染的是空状态占位,DOM 里根本没有 `.n-data-table-tbody`。
 * 而 fetcher(远程)模式下,组件挂载那一刻数据还在路上 —— 若只在 onMounted 里绑一次,
 * 那时查不到 tbody,拖拽就**永远绑不上**(手柄画得出来,却拖不动)。
 *
 * 所以绑定跟着行数据走:每次行数组变化后对齐一次 —— tbody 换了(空↔非空会重建)就重绑,没变则原样保留。
 *
 * 对齐里有两处异步(等 DOM patch、首次加载 sortablejs chunk),期间可能又来一轮对齐或组件已卸载。
 * 每轮带一个递增序号,异步回来发现已被新一轮取代(或已销毁)就放弃,只让最新一轮落地 ——
 * 否则两轮都会在同一 tbody 上各建一个实例,前一个再也没人销毁。
 */
export interface RowDragOptions<T> {
  /** 是否启用(对应 rowDraggable) */
  enabled: () => boolean
  /** 取当前 tbody;拿不到(空表/未渲染)返回 null,等下次行变化再试 */
  getTbody: () => HTMLElement | null | undefined
  /** 当前行数组(远程=内部 rows,静态=props.data);既是 watch 源,也是拖完要重排的那个响应式数组 */
  rows: () => T[] | undefined
  /** 拖拽手柄选择器(可选;不传则整行可拖) */
  handle?: () => string | undefined
  /** 拖完回调:行数组已按新顺序重排 */
  onSort: (e: { from: number; to: number; reordered: T[] }) => void
  /** 加载 sortablejs;缺省懒加载 `import('sortablejs')`。测试注入可控的加载器以精确制造时序 */
  load?: () => Promise<SortableFactory>
}

/** 本模块用到的 sortablejs 最小接口 */
export interface SortableFactory {
  create(
    el: HTMLElement,
    options: {
      animation: number
      handle?: string
      onEnd: (evt: { oldIndex?: number; newIndex?: number }) => void
    },
  ): { destroy(): void }
}

const loadSortable = async (): Promise<SortableFactory> => (await import('sortablejs')).default

export function useRowDrag<T>(options: RowDragOptions<T>) {
  let sortable: { destroy(): void } | null = null
  let boundEl: HTMLElement | null = null
  let pending: Promise<void> = Promise.resolve()
  let round = 0 // 每次对齐 / 销毁 +1;异步回来序号对不上 = 已过期

  function teardown() {
    sortable?.destroy()
    sortable = null
    boundEl = null
  }

  function sync(): Promise<void> {
    pending = run(++round)
    return pending
  }

  async function run(my: number) {
    if (!options.enabled()) return
    await nextTick() // 行数据刚变,等 DOM patch 完再找 tbody
    if (my !== round) return // 等待期间来了新一轮,交给它
    const tbody = options.getTbody() ?? null
    if (tbody === boundEl) return // 还是同一个 tbody,已绑好,不重复建
    teardown()
    if (!tbody) return // 空表:naive 没渲染 tbody,等有行了再绑

    const Sortable = await (options.load ?? loadSortable)()
    if (my !== round) return // 加载期间来了新一轮或已卸载:不再绑定,避免重复实例 / 泄漏
    sortable = Sortable.create(tbody, {
      animation: 150,
      handle: options.handle?.(),
      onEnd: (evt: { oldIndex?: number; newIndex?: number }) => {
        const from = evt.oldIndex
        const to = evt.newIndex
        if (from == null || to == null || from === to) return
        // 直接改可复用的响应式行数组:Vue 据此重排 = DOM 最终真相(与 Sortable 的 DOM 移动一致,
        // 固定列多 tbody 也靠这次 patch 归一)。宿主收 rowDragSort 再落库/refresh。
        const arr = options.rows()
        if (!arr) return
        const [moved] = arr.splice(from, 1)
        arr.splice(to, 0, moved)
        options.onSort({ from, to, reordered: [...arr] })
      },
    })
    boundEl = tbody
  }

  watch(options.rows, () => void sync(), { immediate: true })
  onScopeDispose(() => {
    round++ // 作废仍在途的对齐
    teardown()
  })

  return {
    sync,
    /** 最近一次对齐(含 sortablejs 加载)完成时 resolve —— 需要等绑定落地时用它,不要数 tick */
    settled: () => pending,
  }
}
