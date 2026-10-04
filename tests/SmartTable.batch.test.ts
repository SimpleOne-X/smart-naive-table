// @vitest-environment jsdom
// 批量栏 #batch(规格 §3 / §5.2 / §6 第 5 条):出现条件、「已选 N 项 / 取消选择」、clear()、两种写法、与工具栏同一 min-height
import { afterEach, describe, expect, it, vi } from 'vitest'
import { h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import SmartTable from '../src/SmartTable.vue'
import Toolbar from '../src/Toolbar.vue'
import { defaultLabels, zhCNLabels } from '../src/labels'
import type { SmartTableColumn } from '../src/types'

interface Row {
  id: number
  name: string
}
const rows: Row[] = [
  { id: 1, name: 'alice' },
  { id: 2, name: 'bob' },
  { id: 3, name: 'carol' },
]
// 泛型传 unknown(与 tests/SmartTable.test.ts 一致),否则 mount 会把 T 推成 unknown 报 TS2322
const withSel: SmartTableColumn<unknown>[] = [{ type: 'selection' }, { key: 'name', title: 'Name' }]
const noSel: SmartTableColumn<unknown>[] = [{ key: 'name', title: 'Name' }]

const batchSlot = (p: { checkedRowKeys: Array<string | number>; clear: () => void }) =>
  h('button', { class: 'host-batch-btn', onClick: p.clear }, `批量处理 ${p.checkedRowKeys.length}`)

function mountTable(
  attrs: Record<string, unknown>,
  columns = withSel,
  slots: Record<string, unknown> | null = { batch: batchSlot },
) {
  return mount(SmartTable, {
    props: { columns, data: rows, rowKey: 'id', pagination: false },
    attrs,
    ...(slots ? { slots: slots as never } : {}),
  })
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('批量栏出现条件(四个条件全满足)', () => {
  it('全满足:有 selection 列 + 传了 #batch + 绑了 checked-row-keys + 有勾选 → 出现,「已选 N 项」取 labels.selectedCount', () => {
    const w = mountTable({ checkedRowKeys: [1, 2] })
    expect(w.find('.smart-table-batch').exists()).toBe(true)
    expect(w.find('.smart-table-batch-info').text()).toBe('2 selected') // 英文默认
    expect(w.find('.host-batch-btn').text()).toBe('批量处理 2') // #batch 插槽拿到 checkedRowKeys
  })

  it('kebab-case 写法(checked-row-keys)同样认', () => {
    const w = mountTable({ 'checked-row-keys': [3] })
    expect(w.find('.smart-table-batch').exists()).toBe(true)
  })

  it('文案跟 labels:中文包 → 「已选 2 项」「取消选择」', () => {
    const w = mount(SmartTable, {
      props: { columns: withSel, data: rows, rowKey: 'id', pagination: false, labels: zhCNLabels },
      attrs: { checkedRowKeys: [1, 2] },
      slots: { batch: batchSlot as never },
    })
    expect(w.find('.smart-table-batch-info').text()).toBe('已选 2 项')
    expect(w.text()).toContain('取消选择')
  })

  it.each([
    [
      '没有 selection 列',
      { columns: noSel, attrs: { checkedRowKeys: [1] }, slots: { batch: batchSlot } },
    ],
    ['没传 #batch 插槽', { columns: withSel, attrs: { checkedRowKeys: [1] }, slots: null }],
    [
      '宿主没绑 checked-row-keys(库不持有勾选态,没绑就没有批量栏)',
      { columns: withSel, attrs: {}, slots: { batch: batchSlot } },
    ],
    [
      '绑了但没有勾选(空数组)',
      { columns: withSel, attrs: { checkedRowKeys: [] }, slots: { batch: batchSlot } },
    ],
  ])('缺一个条件 → 没有批量栏,工具栏原样:%s', (_name, c) => {
    const w = mountTable(
      c.attrs,
      c.columns as SmartTableColumn<unknown>[],
      c.slots as Record<string, unknown> | null,
    )
    expect(w.find('.smart-table-batch').exists()).toBe(false)
    expect(w.find('.smart-table-toolbar').exists()).toBe(true)
  })

  it('宿主改了 checked-row-keys → 批量栏随之出现 / 更新 / 消失(attrs 非响应式,靠宿主重渲染)', async () => {
    const keys = ref<number[]>([])
    const w = mount({
      render: () =>
        h(
          SmartTable as never,
          {
            columns: withSel,
            data: rows,
            rowKey: 'id',
            pagination: false,
            checkedRowKeys: keys.value,
          },
          { batch: batchSlot },
        ),
    })
    expect(w.find('.smart-table-batch').exists()).toBe(false)
    keys.value = [1]
    await nextTick()
    expect(w.find('.smart-table-batch-info').text()).toBe('1 selected')
    keys.value = [1, 2, 3]
    await nextTick()
    expect(w.find('.smart-table-batch-info').text()).toBe('3 selected')
    keys.value = []
    await nextTick()
    expect(w.find('.smart-table-batch').exists()).toBe(false)
  })
})

describe('批量栏的替换范围与 clear()', () => {
  it('替换「标题 + 业务按钮 + 更多」,内置图标(列设置)留在右侧;「更多」随之不显示', () => {
    const w = mount(SmartTable, {
      props: {
        columns: withSel,
        data: rows,
        rowKey: 'id',
        pagination: false,
        title: '人员',
        toolbar: { more: [{ label: '导出', key: 'x' }] },
      },
      attrs: { checkedRowKeys: [1] },
      slots: { batch: batchSlot as never, 'toolbar-right': '<i class="host-add">新增</i>' },
    })
    expect(w.find('.smart-table-title').exists()).toBe(false)
    expect(w.find('.host-add').exists()).toBe(false)
    expect(w.html()).not.toContain('aria-label="More"')
    expect(w.html()).toContain('aria-label="Columns"') // 列设置图标仍在
  })

  it('「取消选择」→ 宿主的 onUpdate:checkedRowKeys 收到 ([], [], { action: "uncheckAll" })(载荷同官方)', async () => {
    const spy = vi.fn()
    const w = mountTable({ checkedRowKeys: [1, 2], 'onUpdate:checkedRowKeys': spy })
    const clearBtn = w
      .findAll('.smart-table-batch button')
      .find((b) => b.text() === 'Clear selection')!
    await clearBtn.trigger('click')
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith([], [], { row: undefined, action: 'uncheckAll' })
  })

  it('插槽的 clear() 与「取消选择」同一个出口;两个官方写法宿主绑了哪个就调哪个(各 1 次)', async () => {
    const a = vi.fn()
    const b = vi.fn()
    const w = mountTable({
      checkedRowKeys: [1],
      'onUpdate:checkedRowKeys': a,
      onUpdateCheckedRowKeys: b,
    })
    await w.find('.host-batch-btn').trigger('click')
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
  })

  it('宿主只绑了 checked-row-keys、没绑更新回调(只读)→ clear() 是空操作,不抛错', async () => {
    const w = mountTable({ checkedRowKeys: [1] })
    await expect(w.find('.host-batch-btn').trigger('click')).resolves.toBeUndefined()
    expect(w.find('.smart-table-batch').exists()).toBe(true)
  })
})

describe('批量栏的「本页全选」复选框(原型 .bt-info:本页可勾行全勾上 = 选中,其余 = 半选)', () => {
  // NCheckbox 的真实 DOM:选中 / 半选态是根上的 class
  const box = (w: ReturnType<typeof mountTable>) => w.find('.smart-table-batch-info .n-checkbox')

  it('本页行全勾上 → 选中;只勾了一部分 → 半选;本页一行没勾、只勾着别页的 → 也是半选(已选数是跨页总数)', () => {
    expect(box(mountTable({ checkedRowKeys: [1, 2, 3] })).classes()).toContain(
      'n-checkbox--checked',
    )
    const part = box(mountTable({ checkedRowKeys: [1] }))
    expect(part.classes()).toContain('n-checkbox--indeterminate')
    expect(part.classes()).not.toContain('n-checkbox--checked')
    const other = box(mountTable({ checkedRowKeys: [99] })) // 99 不在当前数据里(别页)
    expect(other.classes()).toContain('n-checkbox--indeterminate')
  })

  it('点半选的复选框 → 并入本页所有可勾行(已选的保留),载荷同官方表头全选:([...], rows, { row: undefined, action: "checkAll" })', async () => {
    const spy = vi.fn()
    const w = mountTable({ checkedRowKeys: [99, 1], 'onUpdate:checkedRowKeys': spy })
    await box(w).trigger('click')
    expect(spy).toHaveBeenCalledTimes(1)
    const [keys, rowsArg, meta] = spy.mock.calls[0]
    expect(keys).toEqual([99, 1, 2, 3])
    expect((rowsArg as Row[]).map((r) => r.id)).toEqual([1, 2, 3]) // 官方只给得出本页已知的行
    expect(meta).toEqual({ row: undefined, action: 'checkAll' })
  })

  it('点选中的复选框 → 去掉本页的键、别页的已选保留:action = uncheckAll', async () => {
    const spy = vi.fn()
    const w = mountTable({ checkedRowKeys: [99, 1, 2, 3], 'onUpdate:checkedRowKeys': spy })
    await box(w).trigger('click')
    expect(spy).toHaveBeenCalledWith([99], [], { row: undefined, action: 'uncheckAll' })
  })

  it('selection 列的 disabled 行不参与:本页可勾行 = 1、3,全选后是 [1, 3];只勾了这两行也算「全勾上」', async () => {
    const cols: SmartTableColumn<unknown>[] = [
      { type: 'selection', disabled: (r: Row) => r.id === 2 },
      { key: 'name', title: 'Name' },
    ]
    const spy = vi.fn()
    const w = mountTable({ checkedRowKeys: [1], 'onUpdate:checkedRowKeys': spy }, cols)
    await box(w).trigger('click')
    expect(spy.mock.calls[0][0]).toEqual([1, 3])
    expect(box(mountTable({ checkedRowKeys: [1, 3] }, cols)).classes()).toContain(
      'n-checkbox--checked',
    )
  })

  it('本地分页:「本页」= 当前页的行(每页 2 行,第 1 页 = 行 1、2);勾上 1、2 → 选中,第 3 行(第 2 页)不影响', async () => {
    const w = mount(SmartTable, {
      props: { columns: withSel, data: rows, rowKey: 'id', pagination: { pageSize: 2 } },
      attrs: { checkedRowKeys: [1, 2] },
      slots: { batch: batchSlot as never },
    })
    expect(box(w as never).classes()).toContain('n-checkbox--checked')
  })
})

describe('Toolbar 批量栏与工具栏同一 min-height(勾选不让表格跳动)', () => {
  class RO {
    static all: RO[] = []
    constructor(private cb: () => void) {
      RO.all.push(this)
    }
    observe() {}
    unobserve() {}
    disconnect() {}
    fire() {
      this.cb()
    }
  }

  it('非批量态记录工具栏行的实测高度;切到批量态后根元素 min-height = 该高度,切回后去掉', async () => {
    vi.stubGlobal('ResizeObserver', RO)
    const rect = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({ height: 34 } as DOMRect)
    const w = mount(Toolbar, {
      props: { labels: defaultLabels, config: {}, density: 'compact' as const },
    })
    expect(w.attributes('style') ?? '').not.toContain('min-height')

    await w.setProps({ batch: { count: 2, checked: false, indeterminate: true } })
    expect(w.attributes('style')).toContain('min-height: 34px')

    // 批量态下 ResizeObserver 触发不会把批量栏自己的高度当成「工具栏高度」
    rect.mockReturnValue({ height: 80 } as DOMRect)
    RO.all.forEach((r) => r.fire())
    await nextTick()
    expect(w.attributes('style')).toContain('min-height: 34px')

    await w.setProps({ batch: null })
    expect(w.attributes('style') ?? '').not.toContain('min-height')
    rect.mockRestore()
    vi.unstubAllGlobals()
  })
})
