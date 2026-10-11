// @vitest-environment jsdom
// 窄档卡片的树表(issue #16,设计 2.17):带 children-key 的表格切成卡片后,子级按先序拍平显示。
// 语义对齐官方 NDataTable(naive-ui 2.45.3 es/data-table/src):分页 / 排序只作用于根行,展开键集 expanded-row-keys / default-expanded-row-keys /
// default-expand-all,勾选按 cascade(默认 true)级联;没有行带 children 的表格,卡片与此前完全一致。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import SmartTable from '../src/SmartTable.vue'
import type { SmartTableColumn } from '../src/types'

interface Org {
  id: number
  no: string
  name: string
  children?: Org[]
}
//  A ─┬─ A1
//     └─ A2 ── A21
//  B ── B1
//  C
const tree: Org[] = [
  {
    id: 1,
    no: 'A',
    name: 'root-a',
    children: [
      { id: 11, no: 'A1', name: 'a-1' },
      { id: 12, no: 'A2', name: 'a-2', children: [{ id: 121, no: 'A21', name: 'a-21' }] },
    ],
  },
  { id: 2, no: 'B', name: 'root-b', children: [{ id: 21, no: 'B1', name: 'b-1' }] },
  { id: 3, no: 'C', name: 'root-c' },
]

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

const columns: SmartTableColumn<any>[] = [
  { key: 'no', title: '编码' },
  { key: 'name', title: '名称' },
]
const selColumns: SmartTableColumn<any>[] = [{ type: 'selection' }, ...columns]

async function mountAt(props: Record<string, unknown> = {}, attrs: Record<string, unknown> = {}) {
  RO.instances = []
  vi.stubGlobal('ResizeObserver', RO)
  const w = mount(SmartTable, {
    props: { columns, data: tree, rowKey: 'id', cardOnNarrow: true, ...props },
    attrs,
    attachTo: document.body,
  })
  Object.defineProperty(w.element, 'clientWidth', { value: 390, configurable: true })
  RO.instances.forEach((i) => i.cb())
  await nextTick()
  await flushPromises()
  return w
}

const items = (w: VueWrapper) => w.findAll('.smart-table-card-item')
const titles = (w: VueWrapper) => items(w).map((i) => i.find('.smart-table-card-title').text())
const tgOf = (w: VueWrapper, no: string) =>
  items(w)
    .find((i) => i.find('.smart-table-card-title').text() === no)!
    .find('.smart-table-card-tg')
const leadPad = (w: VueWrapper, no: string) =>
  items(w)
    .find((i) => i.find('.smart-table-card-title').text() === no)!
    .find('.smart-table-card-lead')
    .attributes('style')

describe('窄档卡片的树表:先序拍平 + 缩进 + 展开入口', () => {
  let wrapper: VueWrapper | undefined
  beforeEach(() => {
    document.body.innerHTML = ''
  })
  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    vi.unstubAllGlobals()
  })

  it('没有行带 children:卡片里没有任何树元素(箭头 / 占位 / 缩进外壳),DOM 与此前一致', async () => {
    wrapper = await mountAt({ data: tree.map(({ id, no, name }) => ({ id, no, name })) })
    expect(titles(wrapper)).toEqual(['A', 'B', 'C'])
    expect(wrapper.find('.smart-table-card-lead').exists()).toBe(false)
    expect(wrapper.find('.smart-table-card-tg').exists()).toBe(false)
    expect(wrapper.find('.smart-table-card-tg-ph').exists()).toBe(false)
  })

  it('默认全部折叠:只显示根;有子级的卡片带展开箭头(aria-expanded=false),叶子留同宽占位', async () => {
    wrapper = await mountAt()
    expect(titles(wrapper)).toEqual(['A', 'B', 'C'])
    const a = tgOf(wrapper, 'A')
    expect(a.exists()).toBe(true)
    expect(a.attributes('aria-expanded')).toBe('false')
    expect(a.attributes('aria-label')).toBe('Expand')
    expect(a.element.tagName).toBe('BUTTON')
    // C 是叶子:没有箭头,但有占位,让同层标题对齐
    const c = items(wrapper).find((i) => i.find('.smart-table-card-title').text() === 'C')!
    expect(c.find('.smart-table-card-tg').exists()).toBe(false)
    expect(c.find('.smart-table-card-tg-ph').exists()).toBe(true)
  })

  it('default-expanded-row-keys:展开的节点其子级按先序出现,折叠的节点其后代不出现;每层缩进 indent(默认 16)', async () => {
    wrapper = await mountAt({}, { defaultExpandedRowKeys: [1] })
    expect(titles(wrapper)).toEqual(['A', 'A1', 'A2', 'B', 'C'])
    expect(leadPad(wrapper, 'A')).toContain('padding-left: 0px')
    expect(leadPad(wrapper, 'A1')).toContain('padding-left: 16px')
    expect(leadPad(wrapper, 'A2')).toContain('padding-left: 16px')
    expect(tgOf(wrapper, 'A').attributes('aria-expanded')).toBe('true')
    expect(tgOf(wrapper, 'A').attributes('aria-label')).toBe('Collapse')
    expect(tgOf(wrapper, 'A2').attributes('aria-expanded')).toBe('false')
  })

  it('default-expand-all:全部非叶子节点展开,逐层缩进(A21 在第三层 = 32px)', async () => {
    wrapper = await mountAt({}, { defaultExpandAll: true })
    expect(titles(wrapper)).toEqual(['A', 'A1', 'A2', 'A21', 'B', 'B1', 'C'])
    expect(leadPad(wrapper, 'A21')).toContain('padding-left: 32px')
  })

  it('indent 取宿主传给 NDataTable 的值', async () => {
    wrapper = await mountAt({}, { defaultExpandAll: true, indent: 24 })
    expect(leadPad(wrapper, 'A1')).toContain('padding-left: 24px')
    expect(leadPad(wrapper, 'A21')).toContain('padding-left: 48px')
  })

  it('children-key 可改(宿主的子级字段不叫 children)', async () => {
    const kids = [{ id: 1, no: 'A', kids: [{ id: 2, no: 'A1' }] }]
    wrapper = await mountAt(
      { data: kids, columns: [{ key: 'no', title: '编码' }] },
      { childrenKey: 'kids', defaultExpandAll: true },
    )
    expect(titles(wrapper)).toEqual(['A', 'A1'])
  })

  it('kebab-case 写法(模板里的 default-expand-all / expanded-row-keys)同样认', async () => {
    wrapper = await mountAt({}, { 'default-expand-all': true })
    expect(titles(wrapper)).toHaveLength(7)
    wrapper.unmount()
    wrapper = await mountAt({}, { 'expanded-row-keys': [2] })
    expect(titles(wrapper)).toEqual(['A', 'B', 'B1', 'C'])
  })

  it('空数组 children 算叶子:不画箭头', async () => {
    wrapper = await mountAt({ data: [{ id: 1, no: 'A', children: [] }, tree[2]] })
    expect(wrapper.find('.smart-table-card-tg').exists()).toBe(false)
  })
})

describe('窄档卡片的树表:展开 / 折叠', () => {
  let wrapper: VueWrapper | undefined
  beforeEach(() => {
    document.body.innerHTML = ''
  })
  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    vi.unstubAllGlobals()
  })

  it('未绑 expanded-row-keys:点箭头展开 / 再点折叠(库内部持有),并按官方形状通知 onUpdate:expandedRowKeys(keys);不触发 rowClick', async () => {
    const onExpand = vi.fn()
    wrapper = await mountAt({}, { 'onUpdate:expandedRowKeys': onExpand })
    await tgOf(wrapper, 'A').trigger('click')
    expect(titles(wrapper)).toEqual(['A', 'A1', 'A2', 'B', 'C'])
    expect(onExpand).toHaveBeenLastCalledWith([1])
    await tgOf(wrapper, 'A2').trigger('click')
    expect(titles(wrapper)).toEqual(['A', 'A1', 'A2', 'A21', 'B', 'C'])
    expect(onExpand).toHaveBeenLastCalledWith([1, 12])
    await tgOf(wrapper, 'A').trigger('click')
    expect(titles(wrapper)).toEqual(['A', 'B', 'C'])
    expect(onExpand).toHaveBeenLastCalledWith([12])
    expect(wrapper.emitted('rowClick')).toBeUndefined()
  })

  it('另一种拼写 onUpdateExpandedRowKeys 也通知(官方两种都调)', async () => {
    const onExpand = vi.fn()
    wrapper = await mountAt({}, { onUpdateExpandedRowKeys: onExpand })
    await tgOf(wrapper, 'B').trigger('click')
    expect(onExpand).toHaveBeenCalledWith([2])
  })

  it('绑了 expanded-row-keys(受控):点箭头只通知宿主,宿主不改则卡片不变;宿主改了才跟着变', async () => {
    const onExpand = vi.fn()
    wrapper = await mountAt({}, { expandedRowKeys: [1], 'onUpdate:expandedRowKeys': onExpand })
    expect(titles(wrapper)).toEqual(['A', 'A1', 'A2', 'B', 'C'])
    await tgOf(wrapper, 'A').trigger('click')
    expect(onExpand).toHaveBeenLastCalledWith([])
    expect(titles(wrapper)).toEqual(['A', 'A1', 'A2', 'B', 'C']) // 宿主还没改,不自己动
    await wrapper.setProps({ expandedRowKeys: [] } as never)
    await nextTick()
    expect(titles(wrapper)).toEqual(['A', 'B', 'C'])
  })

  it('点卡片本身仍是 rowClick(树表也一样)', async () => {
    wrapper = await mountAt({}, { defaultExpandAll: true })
    await items(wrapper)[1].find('.smart-table-card-title').trigger('click')
    const [row] = wrapper.emitted('rowClick')![0] as [Org, number]
    expect(row.no).toBe('A1')
  })

  it('远程模式:fetcher 返回的当前页同样拍平', async () => {
    const fetcher = vi.fn(async () => ({ items: tree, total: 3 }))
    wrapper = await mountAt({ data: undefined, fetcher }, { defaultExpandedRowKeys: [1] })
    expect(titles(wrapper)).toEqual(['A', 'A1', 'A2', 'B', 'C'])
  })
})

describe('窄档卡片的树表:分页 / 排序只作用于根行(同官方)', () => {
  let wrapper: VueWrapper | undefined
  beforeEach(() => {
    document.body.innerHTML = ''
  })
  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    vi.unstubAllGlobals()
  })

  it('分页按根行计:每页 2 个根,第 1 页 = A、B 连同展开的后代,第 2 页只有 C', async () => {
    wrapper = await mountAt({ pagination: { pageSize: 2 } }, { defaultExpandAll: true })
    expect(titles(wrapper)).toEqual(['A', 'A1', 'A2', 'A21', 'B', 'B1'])
    expect(wrapper.find('.n-pagination').exists()).toBe(true)
    // 点分页的「下一页」(程序切页 goPage 与卡片的同步见 SmartTable.goPage.test.ts)
    const buttons = wrapper.findAll('.n-pagination-item--button')
    await buttons[buttons.length - 1].trigger('click')
    await flushPromises()
    expect(titles(wrapper)).toEqual(['C'])
  })

  it('排序只排根行,子级保持原序:按编码降序 → C、B、A,A 的子级仍是 A1、A2', async () => {
    wrapper = await mountAt(
      {
        columns: [
          { key: 'no', title: '编码', sorter: 'default', defaultSortOrder: 'descend' },
          { key: 'name', title: '名称' },
        ],
      },
      { defaultExpandAll: true },
    )
    expect(titles(wrapper)).toEqual(['C', 'B', 'B1', 'A', 'A1', 'A2', 'A21'])
  })
})

describe('窄档卡片的树表:勾选(cascade,默认 true)', () => {
  let wrapper: VueWrapper | undefined
  beforeEach(() => {
    document.body.innerHTML = ''
  })
  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    vi.unstubAllGlobals()
  })
  const boxOf = (w: VueWrapper, no: string) =>
    items(w)
      .find((i) => i.find('.smart-table-card-title').text() === no)!
      .find('.n-checkbox')
  const sorted = (keys: unknown) => [...(keys as number[])].sort((a, b) => a - b)

  it('勾父(即使后代折叠着)→ 键集含全部后代;载荷同官方 (keys, rows, { row, action })', async () => {
    const onUpdate = vi.fn()
    wrapper = await mountAt(
      { columns: selColumns },
      { checkedRowKeys: [], 'onUpdate:checkedRowKeys': onUpdate },
    )
    await boxOf(wrapper, 'A').trigger('click')
    const [keys, rows, meta] = onUpdate.mock.calls[0]
    expect(sorted(keys)).toEqual([1, 11, 12, 121])
    expect(rows.map((r: Org) => r.no).sort()).toEqual(['A', 'A1', 'A2', 'A21'])
    expect(meta).toMatchObject({ action: 'check', row: { id: 1 } })
    expect(wrapper.emitted('rowClick')).toBeUndefined()
  })

  it('取消一个子级 → 它的祖先一并取消(不再是全勾)', async () => {
    const onUpdate = vi.fn()
    wrapper = await mountAt(
      { columns: selColumns },
      {
        checkedRowKeys: [1, 11, 12, 121],
        defaultExpandAll: true,
        'onUpdate:checkedRowKeys': onUpdate,
      },
    )
    await boxOf(wrapper, 'A21').trigger('click')
    const [keys, , meta] = onUpdate.mock.calls[0]
    expect(sorted(keys)).toEqual([11])
    expect(meta).toMatchObject({ action: 'uncheck', row: { id: 121 } })
  })

  it('子全勾 → 父自动勾上', async () => {
    const onUpdate = vi.fn()
    wrapper = await mountAt(
      { columns: selColumns },
      { checkedRowKeys: [11], defaultExpandAll: true, 'onUpdate:checkedRowKeys': onUpdate },
    )
    await boxOf(wrapper, 'A21').trigger('click')
    expect(sorted(onUpdate.mock.calls[0][0])).toEqual([1, 11, 12, 121])
  })

  it('半选:有后代被勾、自己没被勾的卡片是半选;子树全勾的节点(A2 只有 A21 一个子级)整体是选中', async () => {
    wrapper = await mountAt(
      { columns: selColumns },
      { checkedRowKeys: [121], defaultExpandAll: true },
    )
    expect(boxOf(wrapper, 'A21').classes()).toContain('n-checkbox--checked')
    expect(boxOf(wrapper, 'A2').classes()).toContain('n-checkbox--checked') // 它唯一的子级勾了 = 全勾
    expect(boxOf(wrapper, 'A').classes()).toContain('n-checkbox--indeterminate') // A1 没勾 → 半选
    expect(boxOf(wrapper, 'A').classes()).not.toContain('n-checkbox--checked')
    expect(boxOf(wrapper, 'B').classes()).not.toContain('n-checkbox--indeterminate')
  })

  it('宿主给的键集只含父 → 卡片按官方归一化,后代也显示为选中', async () => {
    wrapper = await mountAt(
      { columns: selColumns },
      { checkedRowKeys: [2], defaultExpandAll: true },
    )
    expect(boxOf(wrapper, 'B').classes()).toContain('n-checkbox--checked')
    expect(boxOf(wrapper, 'B1').classes()).toContain('n-checkbox--checked')
    expect(items(wrapper).filter((i) => i.classes('smart-table-card-item--checked')).length).toBe(2)
  })

  it('selection 列的 disabled 行:级联跳过它', async () => {
    const onUpdate = vi.fn()
    wrapper = await mountAt(
      { columns: [{ type: 'selection', disabled: (r: Org) => r.id === 12 }, ...columns] },
      { checkedRowKeys: [], 'onUpdate:checkedRowKeys': onUpdate },
    )
    await boxOf(wrapper, 'A').trigger('click')
    expect(sorted(onUpdate.mock.calls[0][0])).toEqual([1, 11])
  })

  it('cascade: false:只勾这一张,没有半选', async () => {
    const onUpdate = vi.fn()
    wrapper = await mountAt(
      { columns: selColumns },
      {
        cascade: false,
        checkedRowKeys: [121],
        defaultExpandAll: true,
        'onUpdate:checkedRowKeys': onUpdate,
      },
    )
    expect(boxOf(wrapper, 'A').classes()).not.toContain('n-checkbox--indeterminate')
    await boxOf(wrapper, 'A').trigger('click')
    expect(onUpdate.mock.calls[0][0]).toEqual([121, 1])
  })

  it('没有 children 的表格:勾选仍是原来的「追加键」行为(不做任何归一化)', async () => {
    const onUpdate = vi.fn()
    const flat = tree.map(({ id, no, name }) => ({ id, no, name }))
    wrapper = await mountAt(
      { columns: selColumns, data: flat },
      { checkedRowKeys: [3], 'onUpdate:checkedRowKeys': onUpdate },
    )
    await boxOf(wrapper, 'A').trigger('click')
    expect(onUpdate.mock.calls[0][0]).toEqual([3, 1])
  })
})
