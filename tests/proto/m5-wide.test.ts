// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import {
  WIDE_DATA,
  WIDE_LEAVES,
  receiptsOf,
  wideRowsToCsv,
} from '../../playground/prototype/data/m5-wide'
import { fetchWide, queryWide } from '../../playground/prototype/backends/m5-wide'
import { MOCK_DELAY } from '../../playground/prototype/fetcher'
import ProtoApp from '../../playground/prototype/ProtoApp.vue'
import { SmartTable } from '../../src/index'
import type { SmartTableParams } from '../../src/types'

// 模块 5「多级表头与固定列」:数据与原型 WIDE_DATA 同源、后端求值、对照页组件的列方案 / 展开行 / 合计行。
MOCK_DELAY.ms = 0

const params = (p: Record<string, unknown> = {}) =>
  ({ page: 1, pageSize: 20, ...p }) as SmartTableParams

describe('模块 5 数据(与原型 WIDE_DATA 同一份生成器)', () => {
  it('2000 行,前 8 行锚在 DATA_BASE,25 个叶子列都有值', () => {
    expect(WIDE_DATA).toHaveLength(2000)
    expect(WIDE_DATA[0]).toMatchObject({
      no: 'M1000-A',
      name: '不锈钢法兰',
      owner: '张伟',
      status: '已审核',
      amount: 12800,
    })
    expect(WIDE_LEAVES).toHaveLength(25)
    for (const c of WIDE_LEAVES) expect(WIDE_DATA[0][c.key], c.key).not.toBeUndefined()
    expect(WIDE_DATA.every((r) => ['管件', '阀门', '紧固件', '密封件'].includes(r.category))).toBe(
      true,
    )
  })

  it('收货明细:每行 3 笔,确定性(同一行永远同一份;值与原型截图一致)', () => {
    const a = receiptsOf(WIDE_DATA[0])
    expect(a).toHaveLength(3)
    expect(receiptsOf(WIDE_DATA[0])).toEqual(a)
    expect(a[0]).toEqual({ no: 'RC487397', qty: 102, date: '2026-04-18', loc: '二号库 A6-11' })
  })

  it('导出所选的 CSV:表头 = 25 个叶子列标题,每行一条', () => {
    const csv = wideRowsToCsv(WIDE_DATA.slice(0, 2)).split('\r\n')
    expect(csv).toHaveLength(3)
    expect(csv[0].split(',').map((s) => s.replace(/"/g, ''))).toEqual(
      WIDE_LEAVES.map((c) => c.label),
    )
  })
})

describe('模块 5 后端', () => {
  it('分页:每页 20,total 2000', async () => {
    const r = await fetchWide(params())
    expect(r.items).toHaveLength(20)
    expect(r.total).toBe(2000)
    expect((await fetchWide(params({ page: 3 }))).items[0].no).toBe(WIDE_DATA[40].no)
  })

  it('构造器 filters:select 等于 / 数字大于 / 文本包含 / 日期区间 可叠加(列间为「与」)', () => {
    const cat = queryWide({
      filters: [
        { field: 'category', logic: 'and', conditions: [{ action: 'equal', value: '阀门' }] },
      ],
    })
    expect(cat.length).toBeGreaterThan(0)
    expect(cat.every((r) => r.category === '阀门')).toBe(true)
    const both = queryWide({
      filters: [
        { field: 'category', logic: 'and', conditions: [{ action: 'equal', value: '阀门' }] },
        { field: 'stockAvail', logic: 'and', conditions: [{ action: 'gt', value: 4000 }] },
        { field: 'name', logic: 'and', conditions: [{ action: 'contains', value: '不锈钢' }] },
      ],
    })
    expect(
      both.every((r) => r.category === '阀门' && r.stockAvail > 4000 && r.name.includes('不锈钢')),
    ).toBe(true)
    expect(both.length).toBeLessThan(cat.length)
    const d = queryWide({
      filters: [
        {
          field: 'mfgDate',
          logic: 'and',
          conditions: [
            { action: 'gte', value: '2026-06-01' },
            { action: 'lte', value: '2026-06-30' },
          ],
        },
      ],
    })
    expect(d.length).toBeGreaterThan(0)
    expect(d.every((r) => r.mfgDate >= '2026-06-01' && r.mfgDate <= '2026-06-30')).toBe(true)
  })
})

describe('模块 5 对照页(ProtoApp ?m=5:真实库渲染)', () => {
  const real = { matchMedia: window.matchMedia, ResizeObserver: (globalThis as any).ResizeObserver }
  beforeEach(() => {
    window.matchMedia = ((q: string) => ({
      matches: false,
      media: q,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
    })) as any
    ;(globalThis as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  })
  afterEach(() => {
    window.matchMedia = real.matchMedia
    ;(globalThis as any).ResizeObserver = real.ResizeObserver
    document.body.innerHTML = ''
  })

  async function mountM5() {
    history.replaceState(null, '', '/prototype.html?m=5&theme=light')
    const w = mount(ProtoApp, { attachTo: document.body })
    for (let i = 0; i < 10; i++) {
      await flushPromises()
      if (
        w.find('.n-data-table').exists() &&
        w.findAll('.n-data-table-tbody .n-data-table-tr').length > 3
      )
        break
      await new Promise((r) => setTimeout(r, 20))
    }
    return w
  }
  const columnsOf = (w: ReturnType<typeof mount>): any[] =>
    (w.findComponent(SmartTable as any) as any).props('columns')

  it('没有工具栏标题(设计 §2.14);两级表头:「库存」组头跨 3 列,下面是 可用 / 在途 / 锁定', async () => {
    const w = await mountM5()
    expect(w.find('.smart-table-title').exists()).toBe(false) // 单表模块工具栏不画表名(设计 §2.14:页顶已有页面标题)
    const group = w.findAll('thead th').find((th) => th.text() === '库存')!
    expect(group).toBeTruthy()
    expect(group.attributes('colspan')).toBe('3')
    const heads = w.findAll('thead th').map((th) => th.text())
    expect(heads).toEqual(
      expect.arrayContaining(['可用', '在途', '锁定', '序号', '物料编码', '采购周期(天)', '操作']),
    )
    w.unmount()
  })

  it('列方案:展开 / 勾选 / 序号 固定在左,操作固定在右且不进列设置;数据列 25 个叶子', async () => {
    const w = await mountM5()
    const cols = columnsOf(w)
    expect(cols.slice(0, 3).map((c) => [c.type, c.fixed])).toEqual([
      ['expand', 'left'],
      ['selection', 'left'],
      ['index', 'left'],
    ])
    const act = cols[cols.length - 1]
    expect(act).toMatchObject({
      key: 'actions',
      fixed: 'right',
      resizable: false,
      hideInSetting: true,
      width: 120,
    })
    const leaves = cols.flatMap((c) =>
      c.children ? c.children : c.key && c.type === undefined && c.key !== 'actions' ? [c] : [],
    )
    expect(leaves.map((c) => c.key)).toEqual(WIDE_LEAVES.map((c) => c.key))
    w.unmount()
  })

  it('首屏 20 行(分页默认 20),分页尾有「共 2000 条」', async () => {
    const w = await mountM5()
    expect(
      w.findAll('.n-data-table-tbody .n-data-table-tr:not(.n-data-table-tr--summary)'),
    ).toHaveLength(20)
    expect(w.find('.n-pagination').text()).toContain('共 2000 条')
    w.unmount()
  })

  it('合计行:最后一行,「合计」+ 当前页 可用 / 在途 / 锁定 / 金额 求和(金额两位小数、千分位)', async () => {
    const w = await mountM5()
    const sum = w.find('.n-data-table-tr--summary')
    expect(sum.exists()).toBe(true)
    const page = WIDE_DATA.slice(0, 20)
    const tot = (k: 'stockAvail' | 'stockTransit' | 'stockLocked' | 'amount') =>
      page.reduce((n, r) => n + r[k], 0)
    const text = sum.text()
    expect(text).toContain('合计')
    expect(text).toContain(tot('stockAvail').toLocaleString('en-US'))
    expect(text).toContain(tot('stockTransit').toLocaleString('en-US'))
    expect(text).toContain(tot('stockLocked').toLocaleString('en-US'))
    expect(text).toContain(tot('amount').toLocaleString('en-US', { minimumFractionDigits: 2 }))
    w.unmount()
  })

  it('展开行:点「详情」展开收货明细小表(3 行,按钮变「收起」),再点收起', async () => {
    const w = await mountM5()
    expect(w.find('.m5-exp').exists()).toBe(false)
    const btn = () =>
      w
        .findAll('.n-data-table-tbody .n-data-table-tr')[0]
        .findAll('button')
        .find((b) => ['详情', '收起'].includes(b.text()))!
    expect(btn().text()).toBe('详情')
    await btn().trigger('click')
    await flushPromises()
    const exp = w.find('.m5-exp')
    expect(exp.exists()).toBe(true)
    expect(exp.find('.m5-exp-t').text()).toBe('收货明细')
    expect(exp.findAll('thead th').map((th) => th.text())).toEqual([
      '收货单号',
      '数量',
      '收货日期',
      '库位',
    ])
    // 选择器带上小表的类名:exp.findAll('tbody tr') 会把外层表格的 tbody(展开行所在的那一行)也匹配进来
    expect(exp.findAll('.m5-exp-table tbody tr')).toHaveLength(3)
    expect(exp.find('.m5-exp-table tbody tr').text()).toContain('RC487397')
    expect(btn().text()).toBe('收起')
    await btn().trigger('click')
    await flushPromises()
    expect(w.find('.m5-exp').exists()).toBe(false)
    w.unmount()
  })

  it('勾选一行出现批量栏「已选 1 项」+「导出所选」', async () => {
    const w = await mountM5()
    await w.find('.n-data-table-tbody .n-data-table-tr .n-checkbox').trigger('click')
    await flushPromises()
    const bar = w.find('.smart-table-batch')
    expect(bar.exists()).toBe(true)
    expect(bar.text()).toContain('已选 1 项')
    expect(bar.text()).toContain('导出所选')
    w.unmount()
  })
})
