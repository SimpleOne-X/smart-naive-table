// @vitest-environment jsdom
// 窄档卡片的合计卡:宿主给了 naive 的 summary(合计行)时,卡片列表末尾多一张「合计」卡(标题 = 卡片标题列的值,其余 = 有合计值的卡片字段)。
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import SmartTable from '../src/SmartTable.vue'

interface Row {
  no: string
  name: string
  hours: number
  cost: number
}
const rows: Row[] = [
  { no: 'R1', name: 'turn', hours: 10, cost: 1.5 },
  { no: 'R2', name: 'drill', hours: 20, cost: 2.5 },
]
const columns = [
  { key: 'name', title: 'Name', card: 'title' },
  { key: 'hours', title: 'Hours' },
  { key: 'cost', title: 'Cost' },
  { key: 'other', title: 'Other' },
]
const summary = (data: Row[]) => ({
  name: { value: 'Total' },
  hours: { value: String(data.reduce((n, r) => n + r.hours, 0)) },
  cost: { value: data.reduce((n, r) => n + r.cost, 0).toFixed(1) },
})

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
let wrapper: VueWrapper | undefined
async function mountAt(width: number, attrs: Record<string, unknown>) {
  RO.instances = []
  vi.stubGlobal('ResizeObserver', RO)
  const w = mount(SmartTable, {
    props: { columns, data: rows, rowKey: 'no', pagination: false, cardOnNarrow: true } as never,
    attrs,
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

describe('卡片合计卡', () => {
  it('窄档:列表末尾一张合计卡,标题 + 有合计值的字段;没有合计值的字段不出现', async () => {
    const w = await mountAt(390, { summary })
    const items = w.findAll('.smart-table-card-item')
    expect(items).toHaveLength(3)
    const sum = w.find('.smart-table-card-sum')
    expect(sum.exists()).toBe(true)
    expect(items[2].classes()).toContain('smart-table-card-sum')
    expect(sum.find('.smart-table-card-title').text()).toBe('Total')
    const dd = sum.findAll('dl > div').map((d) => d.text().replace(/\s+/g, ''))
    expect(dd).toEqual(['Hours30', 'Cost4.0'])
  })

  it('没给 summary、或宽档:没有合计卡', async () => {
    const none = await mountAt(390, {})
    expect(none.find('.smart-table-card-sum').exists()).toBe(false)
    none.unmount()
    wrapper = undefined
    const wide = await mountAt(1200, { summary })
    expect(wide.find('.smart-table-card-sum').exists()).toBe(false)
  })

  // 官方 CreateSummary = (pageData) => SummaryRowData | SummaryRowData[]:数组 = 多行合计,每行一张卡
  const summaryRows = (data: Row[]) => [
    {
      name: { value: 'Subtotal' },
      hours: { value: String(data.reduce((n, r) => n + r.hours, 0)) },
    },
    { name: { value: 'Total' }, cost: { value: data.reduce((n, r) => n + r.cost, 0).toFixed(1) } },
  ]
  const sumTitles = (w: VueWrapper) =>
    w.findAll('.smart-table-card-sum').map((c) => c.find('.smart-table-card-title').text())

  it('summary 返回数组(多行合计):每行一张卡,各取自己那行的标题和字段', async () => {
    const w = await mountAt(390, { summary: summaryRows })
    expect(w.findAll('.smart-table-card-item')).toHaveLength(4)
    expect(sumTitles(w)).toEqual(['Subtotal', 'Total'])
    const dd = w
      .findAll('.smart-table-card-sum')
      .map((c) => c.findAll('dl > div').map((d) => d.text().replace(/\s+/g, '')))
    expect(dd).toEqual([['Hours30'], ['Cost4.0']])
    // 默认位置:末尾
    const items = w.findAll('.smart-table-card-item')
    expect(items[2].classes()).toContain('smart-table-card-sum')
    expect(items[3].classes()).toContain('smart-table-card-sum')
  })

  it('数组里整行都没有值的行跳过;空数组不画合计卡', async () => {
    const w = await mountAt(390, {
      summary: () => [{ unknown: { value: 1 } }, { name: { value: 'T' } }],
    })
    expect(sumTitles(w)).toEqual(['T'])
    w.unmount()
    wrapper = undefined
    const empty = await mountAt(390, { summary: () => [] })
    expect(empty.find('.smart-table-card-sum').exists()).toBe(false)
    expect(empty.findAll('.smart-table-card-item')).toHaveLength(2)
  })

  it('summary-placement="top":合计卡放在卡片列表最前(单对象 / 数组形式都是)', async () => {
    const one = await mountAt(390, { summary, 'summary-placement': 'top' })
    let items = one.findAll('.smart-table-card-item')
    expect(items).toHaveLength(3)
    expect(items[0].classes()).toContain('smart-table-card-sum')
    expect(items[1].classes()).not.toContain('smart-table-card-sum')
    one.unmount()
    wrapper = undefined
    const many = await mountAt(390, { summary: summaryRows, summaryPlacement: 'top' })
    items = many.findAll('.smart-table-card-item')
    expect(items).toHaveLength(4)
    expect(sumTitles(many)).toEqual(['Subtotal', 'Total'])
    expect(items[0].classes()).toContain('smart-table-card-sum')
    expect(items[1].classes()).toContain('smart-table-card-sum')
    expect(items[2].classes()).not.toContain('smart-table-card-sum')
  })

  it('summary-placement="bottom":仍在末尾', async () => {
    const w = await mountAt(390, { summary, 'summary-placement': 'bottom' })
    const items = w.findAll('.smart-table-card-item')
    expect(items[2].classes()).toContain('smart-table-card-sum')
  })
})
