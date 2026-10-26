// @vitest-environment jsdom
// 序号列树形(index 列 tree: true,设计 2.18):展开钮是项次格里的方框,项次「1 / 1.1」;展开键集读官方同名属性
// (expanded-row-keys / default-expand-all …),Alt + 点击整表展开 / 收起;同组(同一个根)的行悬停一起点亮。
// 只读:官方 NDataTable 画树(勾选级联、合计只算根行照官方),官方的箭头在项次格里由样式藏掉;
// 可编辑:库按根行排序 / 分页、按展开态先序拍平后交给可编辑层与 NDataTable(官方不画树),子级的格同样可编辑。不写 tree 的序号列与此前一致。
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import SmartTable from '../src/SmartTable.vue'
import type { SmartTableColumn } from '../src/types'

interface Item {
  id: number
  no: string
  children?: Item[]
}
//  A ─┬─ A1
//     └─ A2
//  B
//  C ── C1
const tree = (): Item[] => [
  {
    id: 1,
    no: 'A',
    children: [
      { id: 11, no: 'A1' },
      { id: 12, no: 'A2' },
    ],
  },
  { id: 2, no: 'B' },
  { id: 3, no: 'C', children: [{ id: 31, no: 'C1' }] },
]
const columns = (tree = true): SmartTableColumn<Item>[] => [
  { type: 'index', title: '项次', tree, width: 80 },
  { key: 'no', title: '编码' },
]

beforeAll(() => {
  Element.prototype.scrollTo ??= () => {}
})
let wrapper: VueWrapper | null = null
async function mountTable(
  props: Record<string, unknown> = {},
  attrs: Record<string, unknown> = {},
) {
  wrapper = mount(SmartTable, {
    props: { columns: columns() as never, data: tree(), rowKey: 'id', pagination: false, ...props },
    attrs: { 'default-expand-all': true, ...attrs },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

const trs = (w: VueWrapper) =>
  w.findAll('.n-data-table-tbody tr').filter((tr) => !tr.classes('n-data-table-tr--summary'))
const codes = (w: VueWrapper) => trs(w).map((tr) => tr.find('td[data-col-key="no"]').text())
const numbers = (w: VueWrapper) =>
  trs(w).map((tr) => tr.find('td[data-col-key="__index"] .smart-table-tree-no').text())
const boxOf = (w: VueWrapper, no: string) =>
  trs(w)
    .find((tr) => tr.find('td[data-col-key="no"]').text() === no)!
    .find('.smart-table-tree-box')

describe.each([
  ['只读(官方画树)', false],
  ['可编辑(库拍平)', true],
])('index 列 tree: true · %s', (_, editable) => {
  const mountIt = (props: Record<string, unknown> = {}, attrs: Record<string, unknown> = {}) =>
    mountTable({ editable, ...props }, attrs)

  it('默认全展开:先序显示,项次 1 / 1.1 / 1.2 / 2 / 3 / 3.1,只有带子级的行有方框', async () => {
    const w = await mountIt()
    expect(codes(w)).toEqual(['A', 'A1', 'A2', 'B', 'C', 'C1'])
    expect(numbers(w)).toEqual(['1', '1.1', '1.2', '2', '3', '3.1'])
    expect(w.findAll('.smart-table-tree-box')).toHaveLength(2)
    expect(boxOf(w, 'A').attributes('aria-expanded')).toBe('true')
  })

  it('子级行带 --child,最后一个子级带 --last,展开的父级带 --open;同组同一个 data-smart-tree-group', async () => {
    const w = await mountIt()
    const cls = trs(w).map((tr) => tr.classes())
    expect(cls[0]).toContain('smart-table-tree-row--open')
    expect(cls[1]).toContain('smart-table-tree-row--child')
    expect(cls[1]).not.toContain('smart-table-tree-row--last')
    expect(cls[2]).toContain('smart-table-tree-row--last')
    expect(cls[3]).not.toContain('smart-table-tree-row--child')
    const groups = trs(w).map((tr) => tr.attributes('data-smart-tree-group'))
    expect(groups).toEqual(['1', '1', '1', '2', '3', '3'])
  })

  it('点方框折叠 / 展开:不触发 row-click,通知 onUpdate:expandedRowKeys(未受控时库自己持有)', async () => {
    const keys: unknown[] = []
    const w = await mountIt({}, { 'onUpdate:expandedRowKeys': (k: unknown) => keys.push(k) })
    await boxOf(w, 'A').trigger('click')
    expect(codes(w)).toEqual(['A', 'B', 'C', 'C1'])
    expect(numbers(w)).toEqual(['1', '2', '3', '3.1'])
    expect(keys.at(-1)).toEqual([3])
    expect(w.emitted('rowClick')).toBeUndefined()
    await boxOf(w, 'A').trigger('click')
    expect(codes(w)).toEqual(['A', 'A1', 'A2', 'B', 'C', 'C1'])
  })

  it('Alt + 点击:按这一行要去的状态整表展开或收起', async () => {
    const w = await mountIt()
    await boxOf(w, 'C').trigger('click', { altKey: true })
    expect(codes(w)).toEqual(['A', 'B', 'C'])
    await boxOf(w, 'A').trigger('click', { altKey: true })
    expect(codes(w)).toEqual(['A', 'A1', 'A2', 'B', 'C', 'C1'])
  })

  it('受控 expanded-row-keys:宿主改键集,行跟着变', async () => {
    const Host = defineComponent({
      setup() {
        const keys = ref<number[]>([3])
        return () =>
          h(SmartTable as never, {
            columns: columns(),
            data: tree(),
            rowKey: 'id',
            pagination: false,
            editable,
            expandedRowKeys: keys.value,
            'onUpdate:expandedRowKeys': (k: number[]) => (keys.value = k),
          })
      },
    })
    wrapper = mount(Host, { attachTo: document.body })
    await flushPromises()
    expect(codes(wrapper)).toEqual(['A', 'B', 'C', 'C1'])
    await boxOf(wrapper, 'A').trigger('click')
    expect(codes(wrapper)).toEqual(['A', 'A1', 'A2', 'B', 'C', 'C1'])
  })

  it('本地分页按根行:每页 2 个根,第 2 页项次从 3 起', async () => {
    const w = await mountIt({ pagination: { pageSize: 2 } })
    expect(codes(w)).toEqual(['A', 'A1', 'A2', 'B'])
    ;(w.vm as unknown as { goPage: (n: number) => void }).goPage(2)
    await nextTick()
    await flushPromises()
    expect(codes(w)).toEqual(['C', 'C1'])
    expect(numbers(w)).toEqual(['3', '3.1'])
  })

  it('同组悬停:进入任一行,同组的行都带 --hot;离开后去掉', async () => {
    const w = await mountIt()
    await trs(w)[1].trigger('mouseenter')
    const hot = () => trs(w).map((tr) => tr.classes().includes('smart-table-tree-row--hot'))
    expect(hot()).toEqual([true, true, true, false, false, false])
    await trs(w)[1].trigger('mouseleave')
    expect(hot()).toEqual([false, false, false, false, false, false])
  })

  it('合计(summary)只拿到根行,同官方树表的口径', async () => {
    const seen: string[][] = []
    const w = await mountIt(
      {},
      {
        summary: (rows: Item[]) => {
          seen.push(rows.map((r) => r.no))
          return { no: { value: String(rows.length) } }
        },
      },
    )
    expect(seen.at(-1)).toEqual(['A', 'B', 'C'])
    expect(w.find('.n-data-table-tr--summary td[data-col-key="no"]').text()).toBe('3')
  })

  it('没有任何行带子级:与普通序号列一样(不留方框位)', async () => {
    const w = await mountIt({
      data: [
        { id: 1, no: 'X' },
        { id: 2, no: 'Y' },
      ],
    })
    expect(w.findAll('.smart-table-tree-box')).toHaveLength(0)
    expect(trs(w).map((tr) => tr.find('td[data-col-key="__index"]').text())).toEqual(['1', '2'])
    expect(w.find('td[data-col-key="__index"]').attributes('style') ?? '').not.toContain('padding')
  })

  it('row-draggable 不与树形同用:关掉行拖拽并警告一次', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await mountIt({ rowDraggable: true })
    expect(warn.mock.calls.filter((c) => String(c[0]).includes('row-draggable'))).toHaveLength(1)
  })
})

describe('只读:官方画树', () => {
  it('官方的展开钮只在项次格里(样式藏掉),别的列不缩进', async () => {
    const w = await mountTable()
    const all = w.findAll('.n-data-table-expand-trigger')
    expect(all).toHaveLength(2)
    expect(w.findAll('td[data-col-key="__index"] .n-data-table-expand-trigger')).toHaveLength(2)
    expect(w.findAll('td[data-col-key="no"] .n-data-table-indent')).toHaveLength(0)
  })

  it('勾选按官方 cascade 级联:勾父 = 带上子级', async () => {
    const keys: unknown[] = []
    const w = await mountTable(
      {
        columns: [{ type: 'selection' }, ...columns()] as never,
      },
      { 'onUpdate:checkedRowKeys': (k: unknown) => keys.push(k) },
    )
    await trs(w)[0].find('.n-checkbox').trigger('click')
    expect(keys.at(-1)).toEqual(expect.arrayContaining([1, 11, 12]))
  })
})

describe('可编辑:库拍平', () => {
  it('官方不画树(没有展开钮);子级的格同样可编辑', async () => {
    const w = await mountTable({ editable: true })
    expect(w.findAll('.n-data-table-expand-trigger')).toHaveLength(0)
    expect(w.find('td[data-xc="11|no"]').exists()).toBe(true)
    expect(w.find('td[data-xc="31|no"]').exists()).toBe(true)
  })
})

describe('不写 tree:序号列与官方树表照旧', () => {
  it('官方展开箭头仍在,没有方框', async () => {
    const w = await mountTable({ columns: columns(false) })
    expect(w.findAll('.n-data-table-expand-trigger').length).toBeGreaterThan(0)
    expect(w.findAll('.smart-table-tree-box')).toHaveLength(0)
  })
})
