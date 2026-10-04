// @vitest-environment jsdom
// 序号列(type: 'index'):① 声明在某个数据列之后就排在那一列后面(如「勾选 → 手柄 → 序号」),前面没有数据列时仍在最前;
// ② 拖拽排序的窄档卡片(card-on-narrow + row-draggable)在标题行末尾显示行号(同设计原型模块 10 的 .rc-no),其它卡片仍不显示序号。
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import SmartTable from '../src/SmartTable.vue'
import { buildCardView, planCardColumns } from '../src/cardColumns'
import type { SmartTableColumn } from '../src/types'

vi.mock('sortablejs', () => ({ default: { create: () => ({ destroy() {} }) } }))

interface Row {
  no: string
  name: string
}
const rows: Row[] = [
  { no: 'R1', name: 'turn' },
  { no: 'R2', name: 'drill' },
  { no: 'R3', name: 'grind' },
]
const cols = (order: 'handle-first' | 'index-first'): SmartTableColumn<Row>[] =>
  order === 'handle-first'
    ? [
        { type: 'selection', width: 40 },
        { key: 'rd', title: '', width: 48, card: 'handle', render: () => 'H' } as never,
        { type: 'index', title: 'No.', width: 80 },
        { key: 'name', title: 'Name', card: 'title' },
      ]
    : [
        { type: 'selection', width: 40 },
        { type: 'index', title: 'No.', width: 80 },
        { key: 'rd', title: '', width: 48, card: 'handle', render: () => 'H' } as never,
        { key: 'name', title: 'Name', card: 'title' },
      ]

class RO {
  cb: () => void
  constructor(cb: () => void) {
    this.cb = cb
    RO.instances.push(this)
  }
  static instances: RO[] = []
  observe() {}
  unobserve() {}
  disconnect() {}
}
let wrapper: VueWrapper | undefined
async function mountAt(width: number, props: Record<string, unknown>) {
  RO.instances = []
  vi.stubGlobal('ResizeObserver', RO)
  const w = mount(SmartTable, {
    props: { data: rows, rowKey: 'no', pagination: false, ...props } as never,
    attachTo: document.body,
  })
  Object.defineProperty(w.element, 'clientWidth', { value: width, configurable: true })
  RO.instances.forEach((i) => i.cb())
  await nextTick()
  await flushPromises()
  wrapper = w
  return w
}
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})
const headers = (w: VueWrapper) => w.findAll('thead th').map((th) => th.text())

describe('序号列的位置', () => {
  it('声明在数据列(手柄)之后 → 排在手柄后面', async () => {
    const w = await mountAt(1200, { columns: cols('handle-first') })
    expect(headers(w)).toEqual(['', '', 'No.', 'Name'])
    expect(w.findAll('thead th')[1].classes().join(' ')).not.toContain('selection')
    // 第三列是序号:1 2 3
    const tds = w.findAll('tbody tr').map((tr) => tr.findAll('td')[2].text())
    expect(tds).toEqual(['1', '2', '3'])
    expect(w.findAll('tbody tr')[0].findAll('td')[1].text()).toBe('H')
  })

  it('声明在最前(没有数据列在它前面)→ 仍在最前,和以前一样', async () => {
    const w = await mountAt(1200, { columns: cols('index-first') })
    const tds = w.findAll('tbody tr').map((tr) => tr.findAll('td')[1].text())
    expect(tds).toEqual(['1', '2', '3'])
    expect(w.findAll('tbody tr')[0].findAll('td')[2].text()).toBe('H')
  })
})

describe('卡片里的序号', () => {
  it('planCardColumns:默认忽略序号;opts.index 才收下', () => {
    const list = [{ key: '__index' }, { key: 'name' }]
    expect(planCardColumns(list).index).toBeNull()
    expect(planCardColumns(list, { index: true }).index?.key).toBe('__index')
    expect(planCardColumns(list, { index: true }).title?.key).toBe('name') // 序号不会当成标题
  })

  it('buildCardView:index 字段按行号渲染', () => {
    const view = buildCardView(
      [{ key: '__index', render: (_r: Row, i: number) => i + 1 }, { key: 'name' }] as never,
      [{ key: 'name', title: 'Name' }],
      { index: true },
    )
    expect(view.index?.render(rows[1], 1)).toBe(2)
  })

  it('拖拽排序的窄档卡片:标题行末尾有行号;不可拖拽的卡片不显示', async () => {
    const drag = await mountAt(390, {
      columns: cols('handle-first'),
      cardOnNarrow: true,
      rowDraggable: true,
      dragHandle: '.h',
    })
    const nos = drag.findAll('.smart-table-card-no').map((n) => n.text())
    expect(nos).toEqual(['1', '2', '3'])
    // 顺序:手柄、标题、行号、勾选框
    const head = drag.find('.smart-table-card-head')
    const kids = [...head.element.children].map((c) => c.className)
    expect(kids.findIndex((c) => c.includes('card-no'))).toBeGreaterThan(
      kids.findIndex((c) => c.includes('card-title')),
    )
    expect(kids.findIndex((c) => c.includes('card-no'))).toBeLessThan(
      kids.findIndex((c) => c.includes('card-check')),
    )
    drag.unmount()
    wrapper = undefined
    const plain = await mountAt(390, { columns: cols('handle-first'), cardOnNarrow: true })
    expect(plain.findAll('.smart-table-card-no')).toHaveLength(0)
  })

  it('远程模式:卡片同样显示行号', async () => {
    const fetcher = vi.fn(async (p: { page: number; pageSize: number }) => ({
      items: rows.slice(0, 2),
      total: 4 + p.page * 0,
    }))
    const w = await mountAt(390, {
      columns: cols('handle-first'),
      cardOnNarrow: true,
      rowDraggable: true,
      dragHandle: '.h',
      data: undefined,
      fetcher,
      pagination: { pageSize: 2 },
      defaultPageSize: 2,
    })
    await flushPromises()
    expect(w.findAll('.smart-table-card-no').map((n) => n.text())).toEqual(['1', '2'])
  })
})
