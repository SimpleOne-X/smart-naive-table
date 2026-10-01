// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { NCard, NDataTable, NPagination, NTag } from 'naive-ui'
import SmartTable from '../src/SmartTable.vue'
import ColumnSettings from '../src/ColumnSettings.vue'
import Toolbar from '../src/Toolbar.vue'
import FilterChips from '../src/FilterChips.vue'
import { saveState } from '../src/storage'
import { SMART_TABLE_DEFAULTS } from '../src/config'
import type { SmartTableColumn } from '../src/types'

// sortablejs 是懒加载的运行时依赖;这里换成假的,只观察「有没有绑、绑到了哪个 tbody」
// (同 tests/useRowDrag.test.ts)。
const sortableCreated: { el: unknown; destroyed: boolean }[] = []
vi.mock('sortablejs', () => ({
  default: {
    create: (el: unknown) => {
      const inst = { el, destroyed: false, destroy: () => (inst.destroyed = true) }
      sortableCreated.push(inst)
      return inst
    },
  },
}))

/** 动态 import('sortablejs') 走的是微任务/宏任务,不是单个 nextTick 能等完的,多 flush 几轮。 */
async function flushSortableLoad() {
  for (let i = 0; i < 5; i++) {
    await nextTick()
    await Promise.resolve()
  }
}

interface Row {
  id: number
  name: string
}

const rows: Row[] = [
  { id: 1, name: 'alice' },
  { id: 2, name: 'bob' },
]

describe('SmartTable 列宽拖拽事件透传', () => {
  it('宿主自己也监听 onUnstableColumnResize 时,不应把两个处理函数合并成数组(否则 Naive 内部按函数调用会直接抛错)', () => {
    const hostCalls: unknown[][] = []
    const wrapper = mount(SmartTable, {
      props: {
        columns: [{ key: 'name', title: 'Name', resizable: true }],
        data: rows,
        rowKey: 'id',
      },
      attrs: {
        // 模拟宿主也在模板里写了 :on-unstable-column-resize="myHandler"(Vue 编译器保留字面拼写,
        // 不会把 kebab-case 的绑定键自动转成驼峰,所以这里必须用完全相同的字面 key 才能复现碰撞)。
        'on-unstable-column-resize': (...args: unknown[]) => hostCalls.push(args),
      },
    })

    const dataTable = wrapper.findComponent(NDataTable)
    const merged = dataTable.props('onUnstableColumnResize') as unknown

    expect(typeof merged).toBe('function')
    // 真正的回归点:Naive 内部对这个 prop 是当函数直接调用的(见 Header.mjs 的
    // onUnstableColumnResize(widthAfterResize, limitWidth, column, getColumnWidth)),
    // 数组会在这里直接抛 TypeError。
    expect(() => (merged as (...a: unknown[]) => void)(120, 120, { key: 'name' }, () => undefined)).not.toThrow()

    // 宿主自己的处理函数依然要被调用到(功能没有被吞掉,只是不能靠 Vue 的数组合并)
    expect(hostCalls).toHaveLength(1)
    expect(hostCalls[0]).toEqual([120, 120, { key: 'name' }, expect.any(Function)])

    wrapper.unmount()
  })

  it('拖拽手势松手发生在浏览器窗口之外(window 收不到 mouseup)时,window blur 兜底把宽度落账', () => {
    const wrapper = mount(SmartTable, {
      props: {
        columns: [{ key: 'name', title: 'Name', resizable: true }],
        data: rows,
        rowKey: 'id',
      },
    })
    const dataTable = wrapper.findComponent(NDataTable)
    const resize = dataTable.props('onUnstableColumnResize') as (...a: unknown[]) => void

    resize(260, 260, { key: 'name' }, (k: string) => (k === 'name' ? 200 : undefined))
    // 不发 mouseup,直接模拟窗口失焦(拖出浏览器视口再松手,常见于把窗口开得不够宽的场景)
    window.dispatchEvent(new Event('blur'))

    const inst = wrapper.vm as unknown as { columnWidths: Record<string, number> }
    expect(inst.columnWidths.name).toBe(260) // blur 已经把这次手势的宽度落账

    // 手势已经结束,后续任何不相关的 mouseup 都不该再把宽度重新落一遍(resizingKey 已清空)
    window.dispatchEvent(new MouseEvent('mouseup'))
    expect(inst.columnWidths.name).toBe(260)

    wrapper.unmount()
  })
})
describe('SmartTable 列宽钉住后由吸收列吸收余量(B8,取代占位列;E1)', () => {
  /** jsdom 没有 ResizeObserver,这里替一个能手动触发的桩,用来驱动组件里的容器测量。 */
  class ResizeObserverStub {
    static instances: ResizeObserverStub[] = []
    private cb: () => void
    constructor(cb: () => void) {
      this.cb = cb
      ResizeObserverStub.instances.push(this)
    }
    observe() {}
    unobserve() {}
    disconnect() {}
    emit() {
      this.cb()
    }
  }

  const HOST_WIDTH = 900

  function mountWithHostWidth(columns: SmartTableColumn<unknown>[]) {
    ResizeObserverStub.instances = []
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    const wrapper = mount(SmartTable, {
      props: { columns, data: rows, rowKey: 'id' },
      attachTo: document.body,
    })
    // 表格的包含块 = Naive 的横向滚动容器;jsdom 不排版,直接给它一个可见宽度
    const body = wrapper.element.querySelector('.n-data-table-base-table-body') as HTMLElement
    Object.defineProperty(body, 'clientWidth', { value: HOST_WIDTH, configurable: true })
    return wrapper
  }

  function emitResizeObserver() {
    ResizeObserverStub.instances.forEach((i) => i.emit())
  }

  type Col = { key: string; width?: number; resizable?: boolean }

  /** 走一遍真实拖拽:Naive 拖动中持续回调,松手落账,此后列宽进入钉住态。 */
  function drag(wrapper: ReturnType<typeof mount>, key: string, to: number, actual: Record<string, number>) {
    const resize = wrapper.findComponent(NDataTable).props('onUnstableColumnResize') as (...a: unknown[]) => void
    resize(to, to, { key }, (k: string) => actual[k])
  }
  function release() {
    window.dispatchEvent(new MouseEvent('mouseup'))
  }

  const three = (): SmartTableColumn<unknown>[] => [
    { key: 'a', title: 'A', width: 200, resizable: true },
    { key: 'b', title: 'B', width: 200, resizable: true },
    { key: 'op', title: 'Op', width: 200, fixed: 'right' },
  ]

  it('拖非吸收列(a)后:没有占位列;吸收列(b)不写 width 且没有把手;scroll-x = 已钉列 + 吸收列下限', async () => {
    const wrapper = mountWithHostWidth(three())
    const dataTable = wrapper.findComponent(NDataTable)
    drag(wrapper, 'a', 120, { a: 200, b: 200, op: 200 })
    release()
    emitResizeObserver()
    await nextTick()

    const columns = dataTable.props('columns') as Col[]
    expect(columns.map((c) => c.key)).toEqual(['a', 'b', 'op']) // 列数恒等于声明的列数
    expect(columns[0].width).toBe(120)
    expect(columns[1].width).toBeUndefined() // 吸收列:弹性,浏览器把剩余宽度给它
    expect(columns[1].resizable).toBe(false) // 永远没有把手(Naive 内部拖拽宽度无法清除,所以吸收列不能是拖过的列)
    expect(columns[2].width).toBe(200)
    expect(dataTable.props('scrollX')).toBe(120 + 200 + 200) // 120(拖出来)+ 吸收列下限 200(声明宽)+ op 200

    wrapper.unmount()
    vi.unstubAllGlobals()
  })

  it('已钉住的表格,拖拽进行中(松手之前)scroll-x 跟着被拖的列同步,不必每帧重建列', async () => {
    const wrapper = mountWithHostWidth(three())
    const dataTable = wrapper.findComponent(NDataTable)
    drag(wrapper, 'a', 120, { a: 200, b: 200, op: 200 })
    release()
    emitResizeObserver()
    await nextTick()

    // 再次拖拽 a,但还没有松手
    drag(wrapper, 'a', 200, { a: 120, b: 200, op: 200 })
    await nextTick()
    expect(dataTable.props('scrollX')).toBe(120 + 200 + 200 + (200 - 120)) // 已钉列 + 吸收列下限 + 拖拽增量

    wrapper.unmount()
    vi.unstubAllGlobals()
  })

  it('没拖过列宽(未钉住)时不动列:拉伸交给 Naive 自己的 width:100%(吸收列仍不可拖)', async () => {
    const wrapper = mountWithHostWidth(three())
    emitResizeObserver()
    await nextTick()

    const dataTable = wrapper.findComponent(NDataTable)
    const columns = dataTable.props('columns') as Col[]
    expect(columns.map((c) => c.key)).toEqual(['a', 'b', 'op'])
    expect(columns[0].width).toBe(200)
    expect(columns[1].width).toBe(200)
    expect(columns[1].resizable).toBe(false)
    expect(dataTable.props('scrollX')).toBe(600)

    wrapper.unmount()
    vi.unstubAllGlobals()
  })

  it('列宽之和超过容器时照旧横向滚动', async () => {
    const wrapper = mountWithHostWidth([
      { key: 'a', title: 'A', width: 800, resizable: true },
      { key: 'b', title: 'B', width: 400, resizable: true },
      { key: 'op', title: 'Op', width: 300, fixed: 'right' },
    ])
    const dataTable = wrapper.findComponent(NDataTable)
    drag(wrapper, 'a', 800, { a: 800, b: 400, op: 300 })
    release()
    emitResizeObserver()
    await nextTick()
    expect(dataTable.props('scrollX')).toBe(800 + 400 + 300)

    wrapper.unmount()
    vi.unstubAllGlobals()
  })

  it('[Review Focus 4] 全部列都 fixed:最后一列写显式宽度吃掉余量(容器宽由 ResizeObserver 量到),拖别的列时它让得出来', async () => {
    const wrapper = mountWithHostWidth([
      { key: 'a', title: 'A', width: 200, fixed: 'left', resizable: true },
      { key: 'b', title: 'B', width: 200, fixed: 'right' },
    ])
    const dataTable = wrapper.findComponent(NDataTable)
    drag(wrapper, 'a', 120, { a: 200, b: 200 })
    release()
    emitResizeObserver()
    await nextTick()

    const columns = dataTable.props('columns') as Col[]
    expect(columns.map((c) => c.key)).toEqual(['a', 'b'])
    expect(columns[0].width).toBe(120)
    expect(columns[1].width).toBe(HOST_WIDTH - 120)
    expect(dataTable.props('scrollX')).toBe(HOST_WIDTH)

    wrapper.unmount()
    vi.unstubAllGlobals()
  })

  describe('拖过的列后来成为吸收列 → 重挂(tableKey++),清掉 Naive 内部的拖拽宽度', () => {
    const four = (): SmartTableColumn<unknown>[] => [
      { key: 'a', title: 'A', width: 150, resizable: true },
      { key: 'b', title: 'B', width: 150, resizable: true },
      { key: 'c', title: 'C', width: 150, resizable: true },
      { key: 'd', title: 'D', width: 150, resizable: true },
    ]
    const uid = (w: ReturnType<typeof mount>) => w.findComponent(NDataTable).vm.$.uid
    const actual = { a: 250, b: 250, c: 250, d: 250 }

    it('先拖 c(非吸收列),再隐藏 d → c 成为吸收列 → NDataTable 被重挂;c 现在不写 width', async () => {
      const wrapper = mountWithHostWidth(four())
      drag(wrapper, 'c', 290, actual)
      release()
      emitResizeObserver()
      await nextTick()
      const before = uid(wrapper)

      wrapper.findComponent(ColumnSettings).vm.$emit('toggle', 'd', false)
      await flushPromises()
      expect(uid(wrapper)).not.toBe(before) // 重挂了
      const columns = wrapper.findComponent(NDataTable).props('columns') as Col[]
      expect(columns.map((c) => c.key)).toEqual(['a', 'b', 'c'])
      expect(columns[2].width).toBeUndefined()
      expect(columns[2].resizable).toBe(false)

      wrapper.unmount()
      vi.unstubAllGlobals()
    })

    it('新吸收列在本次挂载期间没被拖过(只拖了 a,再隐藏 d → c 成吸收列)→ 不重挂', async () => {
      const wrapper = mountWithHostWidth(four())
      drag(wrapper, 'a', 210, actual)
      release()
      emitResizeObserver()
      await nextTick()
      const before = uid(wrapper)

      wrapper.findComponent(ColumnSettings).vm.$emit('toggle', 'd', false)
      await flushPromises()
      expect(uid(wrapper)).toBe(before)

      wrapper.unmount()
      vi.unstubAllGlobals()
    })

    it('重挂之后「拖过的列」记录清空:之后再换吸收列不会无谓地再重挂', async () => {
      const wrapper = mountWithHostWidth(four())
      drag(wrapper, 'c', 290, actual)
      release()
      emitResizeObserver()
      await nextTick()
      wrapper.findComponent(ColumnSettings).vm.$emit('toggle', 'd', false)
      await flushPromises()
      const afterFirst = uid(wrapper)

      wrapper.findComponent(ColumnSettings).vm.$emit('toggle', 'd', true) // d 回来,c 退出吸收 —— d 从没被拖过
      await flushPromises()
      expect(uid(wrapper)).toBe(afterFirst)
      wrapper.findComponent(ColumnSettings).vm.$emit('toggle', 'd', false) // d 再隐藏,c 再次成为吸收列:c 是重挂之前拖过的,记录已清空 → 不再重挂
      await flushPromises()
      expect(uid(wrapper)).toBe(afterFirst)

      wrapper.unmount()
      vi.unstubAllGlobals()
    })
  })
})
describe('SmartTable 暴露的 filters / columnWidths 是只读快照', () => {
  // wrapper.vm 拿到的是 defineExpose 里那份对象,顶层 ref 会被自动解包 ——
  // inst.filters / inst.columnWidths 读到的就是 readonly() 包过的 FilterState / widths 本身。

  it('直接改 filters 不会生效 —— 绕开 setFilter 会漏发 onChange(远程模式漏一次重查)', () => {
    const wrapper = mount(SmartTable, {
      props: { columns: [{ key: 'name', title: 'Name', filter: true }], data: rows, rowKey: 'id' },
    })
    const inst = wrapper.vm as unknown as {
      filters: Record<string, unknown>
      setFilter: (key: string, value: unknown) => void
    }
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    ;(inst.filters as Record<string, unknown>).name = { logic: 'and', conditions: [{ action: 'equal', value: 'x' }] }
    expect(inst.filters).toEqual({}) // 直接改被 readonly 挡下,内部过滤态没变

    inst.setFilter('name', { logic: 'and', conditions: [{ action: 'equal', value: 'alice' }] })
    expect(inst.filters.name).toBeTruthy() // 走正规入口(setFilter)才真正生效

    warn.mockRestore()
    wrapper.unmount()
  })

  it('直接改 columnWidths 不会生效 —— 绕开 setWidth 会漏掉 localStorage 持久化', () => {
    const wrapper = mount(SmartTable, {
      props: { columns: [{ key: 'name', title: 'Name', resizable: true }], data: rows, rowKey: 'id' },
    })
    const inst = wrapper.vm as unknown as { columnWidths: Record<string, number> }
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    ;(inst.columnWidths as Record<string, number>).name = 999
    expect(inst.columnWidths).toEqual({})

    warn.mockRestore()
    wrapper.unmount()
  })
})
describe('SmartTable「恢复默认」强制重挂表格时,本地分页不该跳回第 1 页', () => {
  it('翻到第 3 页后拖了列宽再点恢复默认,重挂后的分页仍从第 3 页起始', async () => {
    const manyRows = Array.from({ length: 25 }, (_, i) => ({ id: i + 1, name: `row${i + 1}` }))
    const wrapper = mount(SmartTable, {
      props: {
        columns: [{ key: 'name', title: 'Name', resizable: true }],
        data: manyRows,
        rowKey: 'id',
        pagination: { pageSize: 10 },
      },
    })

    // 先拖一次列宽(hadWidths 为 true,onResetSettings 才会触发重挂)
    let dataTable = wrapper.findComponent(NDataTable)
    const resize = dataTable.props('onUnstableColumnResize') as (...a: unknown[]) => void
    resize(220, 220, { key: 'name' }, (k: string) => (k === 'name' ? 200 : undefined))
    window.dispatchEvent(new MouseEvent('mouseup'))
    await nextTick()

    // 模拟用户翻到第 3 页(本地分页非受控,靠 onUpdatePage 通知我们)
    dataTable = wrapper.findComponent(NDataTable)
    const pagination = dataTable.props('pagination') as { onUpdatePage: (p: number) => void }
    pagination.onUpdatePage(3)
    await nextTick()

    // 点「恢复默认」:内部会因为 hadWidths 为 true 而 tableKey++ 强制重挂 <n-data-table>
    wrapper.findComponent(ColumnSettings).vm.$emit('reset')
    await nextTick()

    dataTable = wrapper.findComponent(NDataTable)
    const paginationAfter = dataTable.props('pagination') as { defaultPage?: number }
    expect(paginationAfter.defaultPage).toBe(3) // 重挂后的新实例仍从第 3 页起始,不掉回第 1 页

    wrapper.unmount()
  })
})
describe('SmartTable「恢复默认」强制重挂表格时,行拖拽要重新绑定', () => {
  it('tableKey 重挂后 sortable 实例要挂到新的 tbody 上,而不是继续挂着已经卸载的旧 tbody', async () => {
    sortableCreated.length = 0
    const wrapper = mount(SmartTable, {
      props: {
        columns: [{ key: 'name', title: 'Name', resizable: true }],
        data: [...rows],
        rowKey: 'id',
        rowDraggable: true,
      },
      attachTo: document.body,
    })
    await flushSortableLoad()
    expect(sortableCreated).toHaveLength(1)
    const firstTbody = sortableCreated[0].el

    // 拖一次列宽(hadWidths 为 true),再点「恢复默认」触发 tableKey++ 强制重挂
    let dataTable = wrapper.findComponent(NDataTable)
    const resize = dataTable.props('onUnstableColumnResize') as (...a: unknown[]) => void
    resize(220, 220, { key: 'name' }, (k: string) => (k === 'name' ? 200 : undefined))
    window.dispatchEvent(new MouseEvent('mouseup'))
    await flushSortableLoad()

    wrapper.findComponent(ColumnSettings).vm.$emit('reset')
    await flushSortableLoad()

    expect(sortableCreated.length).toBeGreaterThanOrEqual(2) // 重挂后补绑了新的一份
    const latest = sortableCreated[sortableCreated.length - 1]
    expect(latest.el).not.toBe(firstTbody) // 绑到的是新 tbody,不是已经卸载的旧的
    expect(latest.destroyed).toBe(false)

    wrapper.unmount()
  })
})

describe('SmartTable 排序(多列 / 默认排序 / 编程式)', () => {
  const cmp = () => 0
  const multiCols = [
    { key: 'g', title: 'G', sorter: { compare: cmp, multiple: 2 } },
    { key: 'n', title: 'N', sorter: { compare: cmp, multiple: 1 }, defaultSortOrder: 'ascend' as const },
  ]
  const mountRemote = (columns: unknown[], attrs: Record<string, unknown> = {}) => {
    const fetcher = vi.fn(async (_p: Record<string, unknown>) => ({ items: rows, total: 2 }))
    const wrapper = mount(SmartTable, { props: { columns: columns as SmartTableColumn<unknown>[], fetcher, rowKey: 'id' }, attrs })
    return { fetcher, wrapper }
  }
  const sorterHandler = (wrapper: ReturnType<typeof mount>) =>
    wrapper.findComponent(NDataTable).props('onUpdate:sorter') as (s: unknown) => void
  const lastParams = (fetcher: { mock: { calls: unknown[][] } }) => fetcher.mock.calls.at(-1)![0] as Record<string, unknown>
  type Inst = {
    sort: (k?: string | null, o?: 'ascend' | 'descend' | false) => void
    clearSorter: () => void
  }

  it('C2:列上的 defaultSortOrder 进入首次请求,箭头回显', async () => {
    const { fetcher, wrapper } = mountRemote(multiCols)
    await flushPromises()
    expect((fetcher.mock.calls[0][0] as Record<string, unknown>)).toMatchObject({ sortField: 'n', sortOrder: 'asc' })
    const cols = wrapper.findComponent(NDataTable).props('columns') as Array<{ key: string; sortOrder?: unknown }>
    expect(cols.find((c) => c.key === 'n')!.sortOrder).toBe('ascend')
    expect(cols.find((c) => c.key === 'g')!.sortOrder).toBe(false)
    wrapper.unmount()
  })

  it('C2(静态 data 模式):defaultSortOrder 同样生效 —— 本地数据按它排序,箭头回显', async () => {
    const data = [
      { id: 1, n: 3 },
      { id: 2, n: 1 },
      { id: 3, n: 2 },
    ]
    const wrapper = mount(SmartTable, {
      props: {
        columns: [
          { key: 'n', title: 'N', sorter: (a: { n: number }, b: { n: number }) => a.n - b.n, defaultSortOrder: 'descend' },
        ] as SmartTableColumn<unknown>[],
        data,
        rowKey: 'id',
      },
    })
    await nextTick()
    expect(wrapper.findAll('tbody tr').map((tr) => tr.text())).toEqual(['3', '2', '1'])
    wrapper.unmount()
  })

  it('C1:多列点击 → sortField 取最高优先级列,并带 sorts;两列箭头都回显', async () => {
    const { fetcher, wrapper } = mountRemote(multiCols)
    await flushPromises()
    sorterHandler(wrapper)([
      { columnKey: 'n', order: 'ascend', sorter: multiCols[1].sorter },
      { columnKey: 'g', order: 'descend', sorter: multiCols[0].sorter },
    ])
    await flushPromises()
    expect(lastParams(fetcher)).toMatchObject({
      page: 1,
      sortField: 'g',
      sortOrder: 'desc',
      sorts: [
        { field: 'g', order: 'desc' },
        { field: 'n', order: 'asc' },
      ],
    })
    const cols = wrapper.findComponent(NDataTable).props('columns') as Array<{ key: string; sortOrder?: unknown }>
    expect(cols.find((c) => c.key === 'g')!.sortOrder).toBe('descend')
    expect(cols.find((c) => c.key === 'n')!.sortOrder).toBe('ascend')
    wrapper.unmount()
  })

  it('sort() / clearSorter():编程式设置与清空,远程模式回第 1 页重查;order 缺省 ascend', async () => {
    const { fetcher, wrapper } = mountRemote(multiCols)
    await flushPromises()
    const inst = wrapper.vm as unknown as Inst
    inst.sort('g', 'descend')
    await flushPromises()
    expect(lastParams(fetcher)).toMatchObject({ page: 1, sorts: [{ field: 'g', order: 'desc' }, { field: 'n', order: 'asc' }] })

    inst.sort('n', false) // 取消 n,保留 g
    await flushPromises()
    expect(lastParams(fetcher)).toMatchObject({ sortField: 'g', sortOrder: 'desc' })
    expect(lastParams(fetcher)).not.toHaveProperty('sorts')

    inst.sort('n') // order 缺省 = 'ascend'(对齐官方)
    await flushPromises()
    expect(lastParams(fetcher)).toMatchObject({ sorts: [{ field: 'g', order: 'desc' }, { field: 'n', order: 'asc' }] })

    inst.clearSorter()
    await flushPromises()
    expect(lastParams(fetcher)).not.toHaveProperty('sortField')
    wrapper.unmount()
  })

  it('sort() 没传 columnKey(或传 null)= clearSorter()(对齐官方)', async () => {
    const { fetcher, wrapper } = mountRemote(multiCols)
    await flushPromises()
    const inst = wrapper.vm as unknown as Inst
    inst.sort()
    await flushPromises()
    expect(lastParams(fetcher)).not.toHaveProperty('sortField') // 初始的 defaultSortOrder 也被清掉
    inst.sort('g', 'descend')
    await flushPromises()
    inst.sort(null)
    await flushPromises()
    expect(lastParams(fetcher)).not.toHaveProperty('sortField')
    wrapper.unmount()
  })

  it('sort() 对没有 sorter 的列是空操作:不重查,也不通知宿主', async () => {
    const onSorter = vi.fn()
    const { fetcher, wrapper } = mountRemote([{ key: 'name', title: 'Name' }], { 'onUpdate:sorter': onSorter })
    await flushPromises()
    const before = fetcher.mock.calls.length
    ;(wrapper.vm as unknown as Inst).sort('name', 'ascend')
    await flushPromises()
    expect(fetcher.mock.calls.length).toBe(before)
    expect(onSorter).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('D7:sort() / clearSorter() 向宿主的 onUpdate:sorter 各转发一次,载荷形状与官方一致', async () => {
    const onSorter = vi.fn()
    const single = { key: 's', title: 'S', sorter: true }
    const { wrapper } = mountRemote([...multiCols, single], { 'onUpdate:sorter': onSorter })
    await flushPromises()
    const inst = wrapper.vm as unknown as Inst
    const last = () => onSorter.mock.calls.at(-1)![0]

    // multiple 列:载荷是数组 = 已激活的 multiple 列(按列声明顺序)中「同列替换、否则追加」这一项;初始 n 已由 defaultSortOrder 激活
    inst.sort('g', 'descend')
    expect(onSorter).toHaveBeenCalledTimes(1)
    expect(last()).toEqual([
      { columnKey: 'n', sorter: multiCols[1].sorter, order: 'ascend' },
      { columnKey: 'g', sorter: multiCols[0].sorter, order: 'descend' },
    ])

    // order: false:载荷里仍带这一项(order: false),与官方一致
    inst.sort('n', false)
    expect(onSorter).toHaveBeenCalledTimes(2)
    expect(last()).toEqual([
      { columnKey: 'g', sorter: multiCols[0].sorter, order: 'descend' },
      { columnKey: 'n', sorter: multiCols[1].sorter, order: false },
    ])

    // 单列互斥的 sorter:载荷是单个对象,并顶掉其它列
    inst.sort('s', 'ascend')
    expect(onSorter).toHaveBeenCalledTimes(3)
    expect(last()).toEqual({ columnKey: 's', sorter: true, order: 'ascend' })
    await flushPromises()
    const cols = wrapper.findComponent(NDataTable).props('columns') as Array<{ key: string; sortOrder?: unknown }>
    expect(cols.filter((c) => c.sortOrder === 'ascend' || c.sortOrder === 'descend').map((c) => c.key)).toEqual(['s'])

    // clearSorter():载荷是 null
    inst.clearSorter()
    expect(onSorter).toHaveBeenCalledTimes(4)
    expect(last()).toBeNull()
    wrapper.unmount()
  })

  it('[C6] 点表头排序:宿主的 onUpdate:sorter 恰好被调用 1 次(2.1.1 是 2 次)', async () => {
    const onSorter = vi.fn()
    const { wrapper } = mountRemote(multiCols, { 'onUpdate:sorter': onSorter })
    await flushPromises()
    const payload = [{ columnKey: 'g', order: 'descend', sorter: multiCols[0].sorter }]
    // 取 NDataTable 实际收到的监听器(2.1.1 里它是 [宿主, 库] 的数组)并像 Naive 那样逐个调用
    const handler = wrapper.findComponent(NDataTable).props('onUpdate:sorter') as unknown
    for (const fn of Array.isArray(handler) ? handler : [handler]) (fn as (s: unknown) => void)(payload)
    expect(onSorter).toHaveBeenCalledTimes(1)
    expect(onSorter).toHaveBeenCalledWith(payload)
    wrapper.unmount()
  })
})

describe('SmartTable 密度(B2:宿主的值必须能生效)', () => {
  const tableSize = (w: ReturnType<typeof mount>) => w.findComponent(NDataTable).props('size')
  const base = { columns: [{ key: 'name', title: 'Name' }] as SmartTableColumn<unknown>[], data: rows, rowKey: 'id' }

  afterEach(() => localStorage.clear())

  it('[Review Focus 1] 存过 comfortable 的老用户 + 宿主给 compact + 没开密度按钮 → 取 compact', () => {
    saveState('dens-a', 'comfortable', [{ key: 'name', show: true }])
    const wrapper = mount(SmartTable, { props: { ...base, storageKey: 'dens-a', defaultDensity: 'compact' } })
    expect(tableSize(wrapper)).toBe('small')
    wrapper.unmount()
  })

  it('开了 toolbar.density:true 时仍是「存储优先」(旧规则)', () => {
    saveState('dens-b', 'comfortable', [{ key: 'name', show: true }])
    const wrapper = mount(SmartTable, {
      props: { ...base, storageKey: 'dens-b', defaultDensity: 'compact', toolbar: { density: true } },
    })
    expect(tableSize(wrapper)).toBe('medium')
    wrapper.unmount()
  })

  it('没有存储、没有宿主值 → 默认紧凑(small)', () => {
    const wrapper = mount(SmartTable, { props: base })
    expect(tableSize(wrapper)).toBe('small')
    wrapper.unmount()
  })

  it('defaultDensity 是响应式的:宿主中途改值,已挂载的表格跟着变', async () => {
    const wrapper = mount(SmartTable, { props: { ...base, defaultDensity: 'compact' } })
    expect(tableSize(wrapper)).toBe('small')
    await wrapper.setProps({ defaultDensity: 'comfortable' })
    expect(tableSize(wrapper)).toBe('medium')
    wrapper.unmount()
  })
})

describe('SmartTable 密度的写入端(Q-1:保存列设置 / 列宽不把宿主的密度写进存储)', () => {
  const base = { columns: [{ key: 'name', title: 'Name' }] as SmartTableColumn<unknown>[], data: rows, rowKey: 'id' }
  const raw = (key: string) => JSON.parse(localStorage.getItem('protable:' + key) ?? 'null') as { density?: string } | null

  afterEach(() => {
    vi.useRealTimers()
    localStorage.clear()
  })

  it('存储里原有的 density 原样保留:切列显隐后仍是旧值,不是宿主给的 compact', async () => {
    saveState('dens-w1', 'comfortable', [{ key: 'name', show: true }])
    const wrapper = mount(SmartTable, { props: { ...base, storageKey: 'dens-w1', defaultDensity: 'compact' } })
    wrapper.findComponent(ColumnSettings).vm.$emit('toggle', 'name', false)
    await nextTick()
    expect(raw('dens-w1')!.density).toBe('comfortable')
    wrapper.unmount()
  })

  it('拖列宽落账(防抖写入)同样不改存储里的 density', async () => {
    vi.useFakeTimers()
    saveState('dens-w2', 'comfortable', [{ key: 'name', show: true }])
    const wrapper = mount(SmartTable, {
      props: { ...base, columns: [{ key: 'name', title: 'Name', resizable: true }], storageKey: 'dens-w2', defaultDensity: 'compact' },
    })
    const resize = wrapper.findComponent(NDataTable).props('onUnstableColumnResize') as (...a: unknown[]) => void
    resize(120, 120, { key: 'name' }, () => 200)
    window.dispatchEvent(new MouseEvent('mouseup'))
    vi.advanceTimersByTime(400)
    expect(raw('dens-w2')!.density).toBe('comfortable')
    wrapper.unmount()
  })

  it('没有存储记录、用户也没选过密度:保存列设置时不写 density 字段(不替用户做选择)', async () => {
    const wrapper = mount(SmartTable, { props: { ...base, storageKey: 'dens-w3', defaultDensity: 'compact' } })
    wrapper.findComponent(ColumnSettings).vm.$emit('toggle', 'name', false)
    await nextTick()
    expect(raw('dens-w3')).not.toBeNull()
    expect(raw('dens-w3')).not.toHaveProperty('density')
    wrapper.unmount()
  })

  it('只有 setDensity 才写:开了密度按钮、用户选「紧凑」→ 存储里是 compact;之后保存列设置不会把它改回宿主值', async () => {
    const wrapper = mount(SmartTable, {
      props: { ...base, storageKey: 'dens-w4', defaultDensity: 'comfortable', toolbar: { density: true } },
    })
    wrapper.findComponent(Toolbar).vm.$emit('update:density', 'compact')
    await nextTick()
    expect(raw('dens-w4')!.density).toBe('compact')
    wrapper.findComponent(ColumnSettings).vm.$emit('toggle', 'name', false)
    await nextTick()
    expect(raw('dens-w4')!.density).toBe('compact')
    wrapper.unmount()
  })

  it('[E6] 存储里有记录但没有 density 字段:开了密度按钮时取宿主的 defaultDensity(不是写死的回退值)', () => {
    saveState('dens-w5', undefined, [{ key: 'name', show: true }])
    const wrapper = mount(SmartTable, {
      props: { ...base, storageKey: 'dens-w5', defaultDensity: 'comfortable', toolbar: { density: true } },
    })
    expect(wrapper.findComponent(NDataTable).props('size')).toBe('medium')
    wrapper.unmount()
  })

  it('[Q-1] 记录里没有 density 字段(上次没选过):这次保存列设置仍不写这个字段', async () => {
    saveState('dens-w6', undefined, [{ key: 'name', show: true }])
    const wrapper = mount(SmartTable, { props: { ...base, storageKey: 'dens-w6', defaultDensity: 'compact' } })
    wrapper.findComponent(ColumnSettings).vm.$emit('toggle', 'name', false)
    await nextTick()
    expect(raw('dens-w6')).not.toBeNull()
    expect(raw('dens-w6')).not.toHaveProperty('density')
    wrapper.unmount()
  })

  it('[F14] 「恢复默认」清掉存储后,闭包里记着的旧密度也要清:之后保存列设置不会把旧密度写回去', async () => {
    saveState('dens-w7', 'comfortable', [{ key: 'name', show: true }])
    const wrapper = mount(SmartTable, { props: { ...base, storageKey: 'dens-w7', defaultDensity: 'compact' } })
    wrapper.findComponent(ColumnSettings).vm.$emit('reset')
    await nextTick()
    expect(raw('dens-w7')).toBeNull() // 恢复默认 = 清掉整条存储
    wrapper.findComponent(ColumnSettings).vm.$emit('toggle', 'name', false)
    await nextTick()
    expect(raw('dens-w7')).not.toBeNull()
    expect(raw('dens-w7')).not.toHaveProperty('density') // 不是 'comfortable'
    wrapper.unmount()
  })
})

describe('SmartTable 工具栏接线(B5 / more)', () => {
  const base = { columns: [{ key: 'name', title: 'Name' }] as SmartTableColumn<unknown>[], rowKey: 'id' }

  it('B5:静态数据模式不显示刷新;远程模式显示', async () => {
    const staticWrapper = mount(SmartTable, { props: { ...base, data: rows } })
    expect(staticWrapper.html()).not.toContain('aria-label="Refresh"')
    staticWrapper.unmount()

    const remoteWrapper = mount(SmartTable, { props: { ...base, fetcher: async () => ({ items: rows, total: 2 }) } })
    await flushPromises()
    expect(remoteWrapper.html()).toContain('aria-label="Refresh"')
    remoteWrapper.unmount()
  })

  it('实例方法 refresh() 在静态模式下保持空操作(不抛错)', async () => {
    const wrapper = mount(SmartTable, { props: { ...base, data: rows } })
    await expect((wrapper.vm as unknown as { refresh: () => Promise<void> }).refresh()).resolves.toBeUndefined()
    wrapper.unmount()
  })

  it('moreSelect 从 Toolbar 转发到 SmartTable 的事件', () => {
    const more = [{ label: '导出', key: 'export' }]
    const wrapper = mount(SmartTable, { props: { ...base, data: rows, toolbar: { more } } })
    wrapper.findComponent(Toolbar).vm.$emit('moreSelect', 'export', more[0])
    expect(wrapper.emitted('moreSelect')).toEqual([['export', more[0]]])
    wrapper.unmount()
  })
})

describe('SmartTable 分页(B1 / B4 / B9 / D3 / D4)', () => {
  const base = { columns: [{ key: 'name', title: 'Name' }] as SmartTableColumn<unknown>[], rowKey: 'id' }
  const many = Array.from({ length: 50 }, (_, i) => ({ id: i + 1, name: `n${i + 1}` }))
  type PagerProps = {
    simple?: boolean
    pageSize?: number
    defaultPage?: number
    showSizePicker?: boolean
    pageSizes?: unknown[]
    suffix?: (info: Record<string, number>) => { type: unknown; props: Record<string, any> }
    onUpdatePage?: (p: number) => void
  }
  const pagerProps = (w: ReturnType<typeof mount>) => w.findComponent(NDataTable).props('pagination') as PagerProps
  /** 渲染 suffix,拿到内层官方 NPagination 的 vnode */
  const picker = (w: ReturnType<typeof mount>, pageSize = 100) =>
    pagerProps(w).suffix!({ page: 1, pageSize, pageCount: 1, itemCount: 2, startIndex: 0, endIndex: 1 })
  const sizeValues = (vnode: { props: Record<string, any> }) =>
    (vnode.props.pageSizes as Array<number | { value: number }>).map((s) => (typeof s === 'number' ? s : s.value))

  it('B1 / B4:静态模式默认每页 100、simple;每页选择器是官方嵌套 NPagination,只渲染 size-picker', () => {
    const wrapper = mount(SmartTable, { props: { ...base, data: rows } })
    const p = pagerProps(wrapper)
    expect(p.simple).toBe(true)
    expect(p.pageSize).toBe(100)
    expect(p.showSizePicker).toBeUndefined() // 官方 simple 不渲染选择器,所以外层不设
    const v = picker(wrapper)
    expect(v.type).toBe(NPagination)
    expect(v.props).toMatchObject({ displayOrder: ['size-picker'], showSizePicker: true, pageSize: 100, itemCount: 2, page: 1 })
    expect(v.props.pageSizes).toEqual([100, 500, 1000])
    wrapper.unmount()
  })

  it('[Review Focus 2] 当前 pageSize 不在 pageSizes 里(宿主传 pageSize: 10)→ 传给内层的 pageSizes 并入当前值', () => {
    const wrapper = mount(SmartTable, { props: { ...base, data: rows, pagination: { pageSize: 10 } } })
    expect(sizeValues(picker(wrapper, 10))).toEqual([10, 100, 500, 1000])
    wrapper.unmount()
  })

  it('[D3 #2] 宿主 pagination.pageSizes 里的 { label, value } 对象原样保留,不被当非数字项丢掉', () => {
    const obj = { label: '每页 50 条', value: 50 }
    const wrapper = mount(SmartTable, { props: { ...base, data: rows, pagination: { pageSizes: [20, obj] } } })
    expect(picker(wrapper, 20).props.pageSizes).toEqual([20, obj])
    wrapper.unmount()
  })

  it('[D3 #1] 宿主单表 pagination.showSizePicker: false → simple 下也不画每页选择器', () => {
    const wrapper = mount(SmartTable, { props: { ...base, data: rows, pagination: { showSizePicker: false } } })
    expect(pagerProps(wrapper).suffix).toBeUndefined()
    wrapper.unmount()
  })

  it('全局 showSizePicker: false → 不画每页选择器;宿主自带 suffix 时库不覆盖', () => {
    const w1 = mount(SmartTable, {
      props: { ...base, data: rows },
      global: { provide: { [SMART_TABLE_DEFAULTS as symbol]: { showSizePicker: false } } },
    })
    expect(pagerProps(w1).suffix).toBeUndefined()
    w1.unmount()
    const mine = () => 'mine'
    const w2 = mount(SmartTable, { props: { ...base, data: rows, pagination: { suffix: mine } } })
    expect(pagerProps(w2).suffix).toBe(mine)
    w2.unmount()
  })

  it('pagination: { simple: false } → 回到页码序列,走官方 showSizePicker / pageSizes,不画 suffix', () => {
    const wrapper = mount(SmartTable, { props: { ...base, data: rows, pagination: { simple: false } } })
    const p = pagerProps(wrapper)
    expect(p.simple).toBe(false)
    expect(p.showSizePicker).toBe(true)
    expect(p.pageSizes).toEqual([100, 500, 1000])
    expect(p.suffix).toBeUndefined()
    wrapper.unmount()
  })

  it('[D3 #6] simple: false 回退时当前 pageSize 不在 pageSizes 里 → 官方选择器的选项也并入当前值', () => {
    const wrapper = mount(SmartTable, { props: { ...base, data: rows, pagination: { simple: false, pageSize: 15 } } })
    expect(pagerProps(wrapper).pageSizes).toEqual([15, 100, 500, 1000])
    wrapper.unmount()
  })

  it('远程模式:首次请求 pageSize = 100;内层选择器改 500 → 回第 1 页按 500 重查', async () => {
    const fetcher = vi.fn(async (_p: Record<string, unknown>) => ({ items: rows, total: 2 }))
    const wrapper = mount(SmartTable, { props: { ...base, fetcher } })
    await flushPromises()
    expect(fetcher.mock.calls[0][0]).toMatchObject({ page: 1, pageSize: 100 })
    picker(wrapper).props.onUpdatePageSize(500)
    await flushPromises()
    expect(fetcher.mock.calls.at(-1)![0]).toMatchObject({ page: 1, pageSize: 500 })
    wrapper.unmount()
  })

  it('[D3 #5] 远程模式宿主传 pagination.pageSize: 10:首个请求就是 10(分页条与请求一致)', async () => {
    const fetcher = vi.fn(async (_p: Record<string, unknown>) => ({ items: rows, total: 2 }))
    const wrapper = mount(SmartTable, { props: { ...base, fetcher, pagination: { pageSize: 10 } } })
    await flushPromises()
    expect(fetcher.mock.calls[0][0]).toMatchObject({ page: 1, pageSize: 10 })
    expect(pagerProps(wrapper).pageSize).toBe(10)
    wrapper.unmount()
  })

  it('[D3 #3] 本地模式:内层选择器改 500 → 表格 pageSize 变 500,并转发宿主的 onUpdatePageSize', async () => {
    const onSize = vi.fn()
    const wrapper = mount(SmartTable, { props: { ...base, data: many, pagination: { onUpdatePageSize: onSize } } })
    picker(wrapper).props.onUpdatePageSize(500)
    await nextTick()
    expect(pagerProps(wrapper).pageSize).toBe(500)
    expect(onSize).toHaveBeenCalledWith(500)
    wrapper.unmount()
  })

  it('[D3 #3 / Fix round 1 Finding 2] 本地模式:先翻到非首页,改每页条数 → 真的回第 1 页(不只是改 pageSize),并向宿主转发官方 onUpdate:page', async () => {
    const onSize = vi.fn()
    const onPage = vi.fn()
    const wrapper = mount(SmartTable, {
      // defaultPageSize(非受控的 pageSize)才能让库自己的 localPageSize 之后还能改 —— 用 pagination.pageSize 会把
      // 分页条锁死成宿主的静态值,onSize 改了 localPageSize 也不会体现到最终 pagination.pageSize 上。
      props: { ...base, data: many, pagination: { defaultPageSize: 10, onUpdatePageSize: onSize } }, // 50 行、每页 10,共 5 页
      attrs: { 'onUpdate:page': onPage },
    })
    // 真的翻到非首页(调用 Naive 官方 DataTableInst.page,而不只是摆弄库自己的 localPage 状态)
    const inst = wrapper.vm as unknown as { tableRef: { page: (p: number) => void } }
    inst.tableRef.page(3)
    await nextTick()
    expect(wrapper.findAll('tbody tr')[0]?.text()).toContain('n21') // sanity:第 3 页(每页 10)首行是第 21 条

    picker(wrapper, 10).props.onUpdatePageSize(500)
    await nextTick()

    expect(pagerProps(wrapper).pageSize).toBe(500)
    expect(onSize).toHaveBeenCalledWith(500)
    // 官方外层本地分页只会静默夹页、不发 onUpdatePage,所以库必须自己把 localPage 夹回第 1 页(体现在受控的 defaultPage 上)
    expect(pagerProps(wrapper).defaultPage).toBe(1)
    // tableRef.value?.page(1) 会触发官方 DataTableInst 的 doUpdatePage,向宿主转发表格级 onUpdate:page(use-table-data.mjs:228-236)
    expect(onPage).toHaveBeenCalledWith(1)
    wrapper.unmount()
  })

  it('[Fix round 1 Finding 1] 内层选择器改每页条数:绕开了官方 NDataTable 的通知链路,库要自己补齐多种监听拼写(pagination 级 onPageSizeChange/onUpdate:pageSize,表格级 onUpdate:pageSize/onUpdatePageSize/onPageSizeChange)', async () => {
    const fetcher = vi.fn(async (_p: Record<string, unknown>) => ({ items: rows, total: 2 }))
    const paginationUpdatePageSize = vi.fn()
    const paginationOnPageSizeChange = vi.fn()
    const attrsUpdatePageSize = vi.fn()
    const attrsOnUpdatePageSize = vi.fn()
    const attrsOnPageSizeChange = vi.fn()
    const wrapper = mount(SmartTable, {
      props: {
        ...base,
        fetcher,
        pagination: { 'onUpdate:pageSize': paginationUpdatePageSize, onPageSizeChange: paginationOnPageSizeChange },
      },
      attrs: {
        'onUpdate:pageSize': attrsUpdatePageSize,
        onUpdatePageSize: attrsOnUpdatePageSize,
        onPageSizeChange: attrsOnPageSizeChange,
      },
    })
    await flushPromises()
    picker(wrapper).props.onUpdatePageSize(500)
    await flushPromises()
    expect(paginationUpdatePageSize).toHaveBeenCalledWith(500)
    expect(paginationOnPageSizeChange).toHaveBeenCalledWith(500)
    expect(attrsUpdatePageSize).toHaveBeenCalledWith(500)
    expect(attrsOnUpdatePageSize).toHaveBeenCalledWith(500)
    expect(attrsOnPageSizeChange).toHaveBeenCalledWith(500)
    wrapper.unmount()
  })

  it('[Fix round 2] 本地模式 + simple:false:宿主经 NDataTable 原生链路收到的每页条数通知只触发一次,不是两次', async () => {
    // simple:false 时没有内层嵌套选择器(suffix 只在 simple 下画),宿主看到的是 NDataTable 自己渲染的
    // 官方 NPagination;它内部的 mergedOnUpdatePageSize/doUpdatePageSize(use-table-data.mjs)本来就会
    // 按 attrs 级拼写通知一遍 —— Fix round 1 在 onSize 里加的 notifyPageSizeListeners 如果也挂在这条路径上,
    // 就会被通知两次(Fix round 2 要修的回归)。直接触发 NDataTable 内部真实绑定给官方 NPagination 的
    // 'onUpdate:pageSize' prop(即 mergedOnUpdatePageSize 本身),比在 jsdom 里模拟下拉点击更贴近「走原生
    // 链路」,又不需要重新实现 NDataTable 内部每一层。
    const attrsUpdatePageSize = vi.fn()
    const wrapper = mount(SmartTable, {
      props: { ...base, data: many, pagination: { simple: false } },
      attrs: { 'onUpdate:pageSize': attrsUpdatePageSize },
    })
    await nextTick()
    expect(pagerProps(wrapper).suffix).toBeUndefined() // simple:false 下确实没有内层嵌套选择器
    const nativeHandler = wrapper.findComponent(NPagination).props('onUpdate:pageSize') as (n: number) => void
    nativeHandler(500)
    await nextTick()
    expect(attrsUpdatePageSize).toHaveBeenCalledTimes(1)
    expect(attrsUpdatePageSize).toHaveBeenCalledWith(500)
    wrapper.unmount()
  })

  it('[D3 #4] 本地模式宿主 pagination.defaultPageSize: 20:50 行只显示 20 行(不被受控 pageSize 盖成 100)', async () => {
    const wrapper = mount(SmartTable, { props: { ...base, data: many, pagination: { defaultPageSize: 20 } } })
    await nextTick()
    expect(pagerProps(wrapper).pageSize).toBe(20)
    expect(wrapper.findAll('tbody tr')).toHaveLength(20)
    wrapper.unmount()
  })

  it('[D4] 回退「一行」:宿主只写 pagination.pageSizes [10,20,50](没写 defaultPageSize)→ 首个请求 10', async () => {
    const fetcher = vi.fn(async (_p: Record<string, unknown>) => ({ items: rows, total: 2 }))
    const wrapper = mount(SmartTable, { props: { ...base, fetcher, pagination: { pageSizes: [10, 20, 50] } } })
    await flushPromises()
    expect(fetcher.mock.calls[0][0]).toMatchObject({ pageSize: 10 })
    wrapper.unmount()
  })

  it('[D4] 全局 pageSizes [10,20,50] 同样;全局 defaultPageSize: 30 压过 pageSizes[0];实例 default-page-size 最高', async () => {
    const first = async (defaults: Record<string, unknown>, props: Record<string, unknown> = {}) => {
      const fetcher = vi.fn(async (_p: Record<string, unknown>) => ({ items: rows, total: 2 }))
      const w = mount(SmartTable, {
        props: { ...base, fetcher, ...props },
        global: { provide: { [SMART_TABLE_DEFAULTS as symbol]: defaults } },
      })
      await flushPromises()
      w.unmount()
      return (fetcher.mock.calls[0][0] as Record<string, unknown>).pageSize
    }
    expect(await first({ pageSizes: [10, 20, 50] })).toBe(10)
    expect(await first({ pageSizes: [10, 20, 50], defaultPageSize: 30 })).toBe(30)
    expect(await first({ pageSizes: [10, 20, 50], defaultPageSize: 30 }, { defaultPageSize: 20 })).toBe(20)
  })

  describe('窄档(库根节点宽 < 600)不画每页选择器', () => {
    class RO {
      static instances: RO[] = []
      cb: () => void
      constructor(cb: () => void) {
        this.cb = cb
        RO.instances.push(this)
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    it('量到根节点宽 500 → 没有 suffix;量到 900 → 有', async () => {
      RO.instances = []
      vi.stubGlobal('ResizeObserver', RO)
      const wrapper = mount(SmartTable, { props: { ...base, data: rows }, attachTo: document.body })
      Object.defineProperty(wrapper.element, 'clientWidth', { value: 500, configurable: true })
      RO.instances.forEach((i) => i.cb())
      await nextTick()
      expect(pagerProps(wrapper).suffix).toBeUndefined()

      Object.defineProperty(wrapper.element, 'clientWidth', { value: 900, configurable: true })
      RO.instances.forEach((i) => i.cb())
      await nextTick()
      expect(typeof pagerProps(wrapper).suffix).toBe('function')
      wrapper.unmount()
      vi.unstubAllGlobals()
    })
  })

  describe('B9 筛选后分页', () => {
    const filterCols = [{ key: 'name', title: 'Name', filter: true }] as SmartTableColumn<unknown>[]
    const value = { logic: 'and' as const, conditions: [{ action: 'contains' as const, value: 'a' }] }

    it('默认(宿主没传)保持库现状:远程回第 1 页', async () => {
      const fetcher = vi.fn(async (_p: Record<string, unknown>) => ({ items: rows, total: 500 }))
      const wrapper = mount(SmartTable, { props: { columns: filterCols, fetcher, rowKey: 'id' } })
      await flushPromises()
      pagerProps(wrapper).onUpdatePage!(3)
      await flushPromises()
      ;(wrapper.vm as unknown as { setFilter: (k: string, v: unknown) => void }).setFilter('name', value)
      await flushPromises()
      expect(fetcher.mock.calls.at(-1)![0]).toMatchObject({ page: 1 })
      wrapper.unmount()
    })

    it('宿主显式传官方 paginationBehaviorOnFilter="current" → 留在当前页', async () => {
      const fetcher = vi.fn(async (_p: Record<string, unknown>) => ({ items: rows, total: 500 }))
      const wrapper = mount(SmartTable, {
        props: { columns: filterCols, fetcher, rowKey: 'id' },
        attrs: { paginationBehaviorOnFilter: 'current' },
      })
      await flushPromises()
      pagerProps(wrapper).onUpdatePage!(3)
      await flushPromises()
      ;(wrapper.vm as unknown as { setFilter: (k: string, v: unknown) => void }).setFilter('name', value)
      await flushPromises()
      expect(fetcher.mock.calls.at(-1)![0]).toMatchObject({ page: 3 })
      wrapper.unmount()
    })
  })
})

describe('SmartTable 卡片内边距(B11)与 cardProps(D10)', () => {
  const cols = [{ key: 'name', title: 'Name', search: true }] as SmartTableColumn<unknown>[]
  const mountCards = (extra: Record<string, unknown> = {}) =>
    mount(SmartTable, { props: { columns: cols, data: rows, rowKey: 'id', ...extra } })
  const cards = (w: ReturnType<typeof mount>) => w.findAllComponents(NCard)

  it('表格卡片用官方 size="small" + 只作用于它自己的 paddingSmall 覆盖(四边 16px)', () => {
    const wrapper = mountCards({ search: false })
    const card = wrapper.findComponent(NCard)
    expect(card.props('size')).toBe('small')
    expect(card.props('themeOverrides')).toEqual({ paddingSmall: '16px 16px 16px' })
    wrapper.unmount()
  })

  it('模式 1 的搜索卡片同样是 small + 16px(两张卡片一致)', () => {
    const wrapper = mountCards()
    expect(cards(wrapper)).toHaveLength(2)
    for (const c of cards(wrapper)) {
      expect(c.props('size')).toBe('small')
      expect(c.props('themeOverrides')).toEqual({ paddingSmall: '16px 16px 16px' })
    }
    wrapper.unmount()
  })

  it('cardProps 回退旧外观:{ size: "medium" } 同时作用于表格卡片与搜索卡片', () => {
    const wrapper = mountCards({ cardProps: { size: 'medium' } })
    expect(cards(wrapper).map((c) => c.props('size'))).toEqual(['medium', 'medium'])
    wrapper.unmount()
  })

  it('cardProps.themeOverrides 逐键合并:宿主只改圆角,库的 paddingSmall 覆盖仍在', () => {
    const wrapper = mountCards({ cardProps: { themeOverrides: { borderRadius: '2px' } } })
    for (const c of cards(wrapper)) {
      expect(c.props('themeOverrides')).toEqual({ paddingSmall: '16px 16px 16px', borderRadius: '2px' })
    }
    wrapper.unmount()
  })

  it('cardProps 里的其它官方属性(如 bordered)也能透传', () => {
    const wrapper = mountCards({ cardProps: { bordered: false } })
    expect(cards(wrapper).map((c) => c.props('bordered'))).toEqual([false, false])
    wrapper.unmount()
  })

  it('inline 布局的搜索区没有卡片:只剩表格卡片', () => {
    const wrapper = mountCards({ search: { layout: 'inline' } })
    expect(cards(wrapper)).toHaveLength(1)
    wrapper.unmount()
  })
})

describe('SmartTable 点漏斗不触发排序(Q-6:官方 data-data-table-filter)', () => {
  async function mountSortFilter() {
    const fetcher = vi.fn(async (_p: Record<string, unknown>) => ({ items: rows, total: 2 }))
    const wrapper = mount(SmartTable, {
      props: {
        columns: [{ key: 'name', title: 'Name', sorter: true, filter: true }] as SmartTableColumn<unknown>[],
        fetcher,
        rowKey: 'id',
      },
      attachTo: document.body,
    })
    await flushPromises()
    return { fetcher, wrapper }
  }

  it('点漏斗:不排序、不重新请求;点标题:排序(对照)', async () => {
    const { fetcher, wrapper } = await mountSortFilter()
    const before = fetcher.mock.calls.length
    await wrapper.find('.smart-table-filter-trigger').trigger('click')
    await flushPromises()
    expect(fetcher.mock.calls.length).toBe(before)
    await wrapper.find('th').trigger('click')
    await flushPromises()
    expect(fetcher.mock.calls.length).toBe(before + 1)
    expect(fetcher.mock.calls.at(-1)![0]).toMatchObject({ sortField: 'name' })
    wrapper.unmount()
  })

  it('漏斗上的点击不被 stopPropagation 吞掉:宿主挂在祖先上的 click 监听仍能收到', async () => {
    const { wrapper } = await mountSortFilter()
    const spy = vi.fn()
    document.body.addEventListener('click', spy)
    await wrapper.find('.smart-table-filter-trigger').trigger('click')
    expect(spy).toHaveBeenCalled()
    document.body.removeEventListener('click', spy)
    wrapper.unmount()
  })
})

describe('SmartTable 已生效条件 chips(filterChips)', () => {
  const cols = [
    { key: 'name', title: '姓名', filter: true },
    { key: 'dept', title: '部门', filter: true },
  ] as SmartTableColumn<unknown>[]
  const value = (action: string, v: unknown) => ({ logic: 'and' as const, conditions: [{ action: action as never, value: v }] })
  const inst = (w: ReturnType<typeof mount>) =>
    w.vm as unknown as { setFilter: (k: string, v: unknown) => void; filters: Record<string, unknown> }

  it('默认不显示 chips(P0:需显式 filterChips: true)', async () => {
    const wrapper = mount(SmartTable, { props: { columns: cols, data: rows, rowKey: 'id' } })
    inst(wrapper).setFilter('name', value('contains', 'a'))
    await nextTick()
    expect(wrapper.findComponent(FilterChips).exists()).toBe(false)
    wrapper.unmount()
  })

  it('filterChips: true:有条件才出现;每个条件一个 chip;× 只删这一条', async () => {
    const wrapper = mount(SmartTable, { props: { columns: cols, data: rows, rowKey: 'id', filterChips: true } })
    expect(wrapper.findComponent(FilterChips).exists()).toBe(false) // 无条件不占位
    inst(wrapper).setFilter('name', value('contains', 'a'))
    inst(wrapper).setFilter('dept', value('equal', 'x'))
    await nextTick()
    const chips = wrapper.findComponent(FilterChips)
    expect(chips.findAll('.smart-table-chip').map((c) => c.text())).toEqual(['姓名 Contains a', '部门 Equals x'])
    chips.findAllComponents(NTag)[0].vm.$emit('close')
    await nextTick()
    expect(Object.keys(inst(wrapper).filters)).toEqual(['dept'])
    wrapper.unmount()
  })

  it('行末按钮:没有列声明 defaultValue → 「Clear all」;点击清空全部', async () => {
    const wrapper = mount(SmartTable, { props: { columns: cols, data: rows, rowKey: 'id', filterChips: true } })
    inst(wrapper).setFilter('name', value('contains', 'a'))
    await nextTick()
    const btn = wrapper.find('.smart-table-chips__clear')
    expect(btn.text()).toBe('Clear all')
    await btn.trigger('click')
    expect(inst(wrapper).filters).toEqual({})
    wrapper.unmount()
  })

  it('行末按钮:有列声明了 defaultValue → 「Restore defaults」,点击恢复默认而不是清空', async () => {
    const withDefault = [{ key: 'name', title: '姓名', filter: { defaultValue: value('contains', 'seed') } }] as SmartTableColumn<unknown>[]
    const wrapper = mount(SmartTable, { props: { columns: withDefault, data: rows, rowKey: 'id', filterChips: true } })
    inst(wrapper).setFilter('name', value('contains', 'changed'))
    await nextTick()
    const btn = wrapper.find('.smart-table-chips__clear')
    expect(btn.text()).toBe('Restore defaults')
    await btn.trigger('click')
    expect(inst(wrapper).filters.name).toEqual(value('contains', 'seed'))
    wrapper.unmount()
  })

  it('[Q-7] 列声明里已不存在的过滤键(孤儿):chip 仍显示,标题回退成键;点击不报错;× 能清掉', async () => {
    const wrapper = mount(SmartTable, { props: { columns: cols, data: rows, rowKey: 'id', filterChips: true } })
    inst(wrapper).setFilter('ghost', value('equal', 'x'))
    await nextTick()
    const chips = wrapper.findComponent(FilterChips)
    expect(chips.findAll('.smart-table-chip').map((c) => c.text())).toEqual(['ghost Equals x'])
    await expect(chips.find('.smart-table-chip').trigger('click')).resolves.toBeUndefined() // 没有面板可开,空操作
    chips.findAllComponents(NTag)[0].vm.$emit('close')
    await nextTick()
    expect(inst(wrapper).filters).toEqual({})
    wrapper.unmount()
  })

  it('[Q-7] 孤儿键仍会进远程请求参数 —— 所以它必须看得见,「清除全部」也要渲染并能清掉它', async () => {
    const fetcher = vi.fn(async (_p: Record<string, unknown>) => ({ items: rows, total: 2 }))
    const wrapper = mount(SmartTable, { props: { columns: cols, fetcher, rowKey: 'id', filterChips: true } })
    await flushPromises()
    inst(wrapper).setFilter('ghost', value('equal', 'x'))
    await flushPromises()
    expect(JSON.stringify(fetcher.mock.calls.at(-1)![0])).toContain('ghost')
    const btn = wrapper.find('.smart-table-chips__clear')
    expect(btn.exists()).toBe(true)
    await btn.trigger('click')
    await flushPromises()
    expect(JSON.stringify(fetcher.mock.calls.at(-1)![0])).not.toContain('ghost')
    wrapper.unmount()
  })

  it('[Q-7] chips 可键盘操作:role=button、tabindex=0;Enter 等同点击(打开对应列的面板)', async () => {
    const wrapper = mount(SmartTable, {
      props: { columns: cols, data: rows, rowKey: 'id', filterChips: true },
      attachTo: document.body,
    })
    inst(wrapper).setFilter('name', value('contains', 'a'))
    await nextTick()
    const chip = wrapper.find('.smart-table-chip')
    expect(chip.attributes('role')).toBe('button')
    expect(chip.attributes('tabindex')).toBe('0')
    await chip.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(document.body.querySelector('.smart-table-filter')).not.toBeNull()
    wrapper.unmount()
  })

  it('[Review Focus 5] 指向已隐藏的列:chip 仍显示、点击不报错、× 仍能清掉那个条件', async () => {
    const hiddenCols = [{ key: 'name', title: '姓名', filter: true, hide: true }, { key: 'dept', title: '部门' }] as SmartTableColumn<unknown>[]
    const wrapper = mount(SmartTable, { props: { columns: hiddenCols, data: rows, rowKey: 'id', filterChips: true } })
    inst(wrapper).setFilter('name', value('contains', 'a'))
    await nextTick()
    const chips = wrapper.findComponent(FilterChips)
    expect(chips.findAll('.smart-table-chip')).toHaveLength(1)
    await expect(chips.find('.smart-table-chip').trigger('click')).resolves.toBeUndefined() // 没有可开的面板,空操作
    chips.findAllComponents(NTag)[0].vm.$emit('close')
    await nextTick()
    expect(inst(wrapper).filters).toEqual({})
    wrapper.unmount()
  })

  it('点击 chip → 对应列的 ColumnFilter 收到 openRequest 递增', async () => {
    const wrapper = mount(SmartTable, { props: { columns: cols, data: rows, rowKey: 'id', filterChips: true }, attachTo: document.body })
    inst(wrapper).setFilter('name', value('contains', 'a'))
    await nextTick()
    wrapper.findComponent(FilterChips).vm.$emit('open', 'name')
    await flushPromises()
    expect(document.body.querySelector('.smart-table-filter')).not.toBeNull()
    wrapper.unmount()
  })

  it('[Fix round 1] 「+N」可用键盘(Enter/Space)打开 —— NPopover 的 trigger="click" 不认键盘;打开后焦点落到气泡内第一个 chip', async () => {
    // jsdom 的 offsetTop 恒为 0,真实折叠算法量不到布局(组件头部注释已说明),所以这里按 chip 文案
    // 伪造 offsetTop(不碰组件代码):第一个 chip 在第一行、其余两个折到下一行、「+N」自己与第一行同高 ——
    // 这与真实浏览器量出来的形状等价,让真正的 recompute()/countFitting/shrinkForMore 走到「+N 可见」分支,
    // 而不是绕开测量直接摆内部状态。
    const chipCols = [
      { key: 'c0', title: 'c0', filter: true },
      { key: 'c1', title: 'c1', filter: true },
      { key: 'c2', title: 'c2', filter: true },
    ] as SmartTableColumn<unknown>[]
    const offsetTopSpy = vi
      .spyOn(HTMLElement.prototype, 'offsetTop', 'get')
      .mockImplementation(function (this: HTMLElement) {
        // NTag 内容是 `<span class="n-tag__content"> +N</span>`,「+」前面带一个空格,trim 后再判断
        const t = (this.textContent ?? '').trim()
        if (t.startsWith('+')) return 0 // 「+N」自己和第一行同高,不需要再让位
        return t.startsWith('c0') ? 0 : 30 // 第一个 chip 第一行,其余折到下一行
      })
    try {
      const wrapper = mount(SmartTable, {
        props: { columns: chipCols, data: rows, rowKey: 'id', filterChips: true },
        attachTo: document.body,
      })
      inst(wrapper).setFilter('c0', value('contains', 'x0'))
      inst(wrapper).setFilter('c1', value('contains', 'x1'))
      inst(wrapper).setFilter('c2', value('contains', 'x2'))
      await nextTick()
      await flushPromises()
      await nextTick()

      const more = wrapper.find('.smart-table-chip--more')
      expect(more.exists()).toBe(true)
      expect(more.text()).toBe('+2')
      expect(more.attributes('role')).toBe('button')
      expect(more.attributes('tabindex')).toBe('0')

      await more.trigger('keydown', { key: 'Enter' })
      await flushPromises()
      await nextTick()

      const popoverChips = Array.from(
        document.body.querySelectorAll<HTMLElement>('.smart-table-chips__more .smart-table-chip'),
      )
      expect(popoverChips).toHaveLength(2) // c1、c2 折进了气泡
      expect(document.activeElement).toBe(popoverChips[0])

      wrapper.unmount()
    } finally {
      offsetTopSpy.mockRestore()
    }
  })
})

describe('SmartTable fillHeight(D5)', () => {
  const base = { columns: [{ key: 'name', title: 'Name' }] as SmartTableColumn<unknown>[], data: rows, rowKey: 'id' }
  const tableProps = (w: ReturnType<typeof mount>) => w.findComponent(NDataTable).props() as Record<string, any>

  // vueuc 的 VirtualList(官方 virtual-scroll)在 setup 里读 window.matchMedia,jsdom 没有 → 开了 fillHeight 的用例都会抛 TypeError
  beforeEach(() => {
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }))
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('默认关闭:表格不带 flex-height / virtual-scroll,根节点没有 smart-table--fill', () => {
    const wrapper = mount(SmartTable, { props: base })
    expect(tableProps(wrapper).flexHeight).toBe(false)
    expect(tableProps(wrapper).virtualScroll).toBe(false)
    expect(wrapper.classes()).not.toContain('smart-table--fill')
    wrapper.unmount()
  })

  it('fillHeight:官方 flex-height + virtual-scroll 一起传,min-row-height 随密度(紧凑 40 / 舒适 48),带兜底 min-height,根节点加 --fill', () => {
    const compact = mount(SmartTable, { props: { ...base, fillHeight: true } }) // 默认紧凑
    expect(tableProps(compact)).toMatchObject({ flexHeight: true, virtualScroll: true, minRowHeight: 40, minHeight: 160 })
    expect(compact.classes()).toContain('smart-table--fill')
    compact.unmount()
    const comfortable = mount(SmartTable, { props: { ...base, fillHeight: true, defaultDensity: 'comfortable' } })
    expect(tableProps(comfortable).minRowHeight).toBe(48)
    comfortable.unmount()
  })

  it('宿主 attrs 的官方 min-row-height / min-height 优先于库的取值', () => {
    const wrapper = mount(SmartTable, { props: { ...base, fillHeight: true }, attrs: { 'min-row-height': 60, minHeight: 300 } })
    expect(tableProps(wrapper)).toMatchObject({ minRowHeight: 60, minHeight: 300 })
    wrapper.unmount()
  })
})

describe('SmartTable fillHeight 与 max-height(F8)', () => {
  const base = { columns: [{ key: 'name', title: 'Name' }] as SmartTableColumn<unknown>[], data: rows, rowKey: 'id' }
  const tableProps = (w: ReturnType<typeof mount>) => w.findComponent(NDataTable).props() as Record<string, any>
  beforeEach(() => {
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }))
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('fillHeight 开启时忽略宿主的 max-height / maxHeight 并警告一次;关闭时照常透传', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const mine = () => warn.mock.calls.filter((c) => String(c[0]).includes('max-height'))
    const on = mount(SmartTable, { props: { ...base, fillHeight: true }, attrs: { maxHeight: 300 } })
    expect(tableProps(on).maxHeight).toBeUndefined()
    expect(mine()).toHaveLength(1)
    on.unmount()
    const kebab = mount(SmartTable, { props: { ...base, fillHeight: true }, attrs: { 'max-height': 300 } })
    expect(tableProps(kebab).maxHeight).toBeUndefined()
    expect(mine()).toHaveLength(2) // 每个实例警告一次(同一实例里 computed 重复求值不重复警告)
    kebab.unmount()
    const off = mount(SmartTable, { props: base, attrs: { maxHeight: 300 } })
    expect(tableProps(off).maxHeight).toBe(300)
    expect(mine()).toHaveLength(2) // 关闭 fillHeight 时照常透传,不警告
    off.unmount()
  })
})

describe('SmartTable 翻页后滚回卡片顶部(E4:只在不开 fillHeight 时)', () => {
  const base = { columns: [{ key: 'name', title: 'Name' }] as SmartTableColumn<unknown>[], data: rows, rowKey: 'id' }
  let cardTop = 0
  const pagerProps = (w: ReturnType<typeof mount>) =>
    w.findComponent(NDataTable).props('pagination') as unknown as { onUpdatePage: (p: number) => void; suffix: (i: Record<string, number>) => { props: Record<string, any> } }

  beforeEach(() => {
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })) // 同上:fillHeight 用例要挂 VirtualList
    cardTop = 0
    Element.prototype.scrollIntoView = vi.fn()
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      return { top: this.classList.contains('smart-table-card') ? cardTop : 0 } as DOMRect
    })
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    // @ts-expect-error jsdom 没有 scrollIntoView,测试里临时装了一个
    delete Element.prototype.scrollIntoView
  })

  it('翻页时卡片顶部已滚出视口上沿 → 滚回卡片顶部;还在视口内 → 不滚', () => {
    const wrapper = mount(SmartTable, { props: base, attachTo: document.body })
    cardTop = 50
    pagerProps(wrapper).onUpdatePage(2)
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled()
    cardTop = -200
    pagerProps(wrapper).onUpdatePage(3)
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'instant' })
    wrapper.unmount()
  })

  it('远程模式同样在点击当下滚(不等数据回来);改每页条数也算翻页', async () => {
    const fetcher = vi.fn(async (_p: Record<string, unknown>) => ({ items: rows, total: 500 }))
    const wrapper = mount(SmartTable, { props: { columns: base.columns, fetcher, rowKey: 'id' }, attachTo: document.body })
    await flushPromises()
    cardTop = -200
    pagerProps(wrapper).onUpdatePage(2)
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1)
    pagerProps(wrapper).suffix({ page: 1, pageSize: 100, pageCount: 5, itemCount: 500, startIndex: 0, endIndex: 99 }).props.onUpdatePageSize(500)
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })

  it('开了 fillHeight:不滚窗口,改为把表体滚回顶部(官方 scrollTo)', () => {
    const wrapper = mount(SmartTable, { props: { ...base, fillHeight: true }, attachTo: document.body })
    const scrollTo = vi.spyOn(wrapper.findComponent(NDataTable).vm as unknown as { scrollTo: (o: unknown) => void }, 'scrollTo').mockImplementation(() => {}) // 不放行到真实现:jsdom 的元素没有 scrollTo
    cardTop = -200
    pagerProps(wrapper).onUpdatePage(2)
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled()
    expect(scrollTo).toHaveBeenCalledWith({ top: 0 })
    wrapper.unmount()
  })

  // [Fix round 1 review] 本地模式 + simple:false 时没有内层嵌套选择器(suffix 只在 simple 下画),宿主看到的是
  // NDataTable 自己渲染的官方 NPagination,改每页条数直接绑的是 applyLocalSize(与 [Fix round 2] 测试锁定的是
  // 同一条「原生链路」)。此前 applyLocalSize 内没有调 onPageChanged(),这条路径下改每页条数不会触发「滚回卡片
  // 顶部 / fillHeight 表体复位」(review 在真实浏览器复现:DemoFill 页面切每页条数,视口停在原地不动)。
  // 跟 [Fix round 2] 一样,直接取 NDataTable 内部真实绑定给官方 NPagination 的 'onUpdate:pageSize' prop 调用,
  // 而不是在 jsdom 里模拟下拉点击 —— 这样才是在验真实接线,不是在验测试自己搭的双替身。
  it('[Fix round 1 review] 本地 + simple:false:原生选择器改每页条数,滚回卡片顶部恰好触发一次(不是零次)', async () => {
    const wrapper = mount(SmartTable, { props: { ...base, pagination: { simple: false } }, attachTo: document.body })
    await nextTick()
    cardTop = -200
    const nativeHandler = wrapper.findComponent(NPagination).props('onUpdate:pageSize') as (n: number) => void
    nativeHandler(500)
    await nextTick()
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1)
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'instant' })
    wrapper.unmount()
  })

  it('[Fix round 1 review] 开了 fillHeight + simple:false:原生选择器改每页条数,表体 scrollTo 恰好触发一次(不是零次,也不是两次)', async () => {
    const wrapper = mount(SmartTable, { props: { ...base, fillHeight: true, pagination: { simple: false } }, attachTo: document.body })
    await nextTick()
    const scrollTo = vi.spyOn(wrapper.findComponent(NDataTable).vm as unknown as { scrollTo: (o: unknown) => void }, 'scrollTo').mockImplementation(() => {})
    const nativeHandler = wrapper.findComponent(NPagination).props('onUpdate:pageSize') as (n: number) => void
    nativeHandler(500)
    await nextTick()
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled()
    expect(scrollTo).toHaveBeenCalledTimes(1)
    expect(scrollTo).toHaveBeenCalledWith({ top: 0 })
    wrapper.unmount()
  })
})
