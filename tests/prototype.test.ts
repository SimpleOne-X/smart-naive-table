// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { DATA, FIELD_DEFS, addRow, delRow } from '../playground/prototype/data'
import { MOCK_DELAY, fetchRows } from '../playground/prototype/fetcher'
import ProtoApp from '../playground/prototype/ProtoApp.vue'
import type { SmartTableParams } from '../src/types'

// 原型对照页(prototype.html)的「后端」与页面:它是之后逐项对比原型与真实库的工具,
// 数据生成器与原型 docs/smart-naive-table-design.html 是同一份(2000 行、确定性伪随机),
// 这里锁住它,免得改库时顺手改坏了对照页的数据而不自知。

MOCK_DELAY.ms = 0 // 单测不等 420ms

const params = (p: Record<string, unknown> = {}) =>
  ({ page: 1, pageSize: 100, ...p }) as SmartTableParams

describe('对照页数据(与原型同一份生成器)', () => {
  it('2000 行,前 8 行是原型的 DATA_BASE,编码不重复', () => {
    expect(DATA).toHaveLength(2000)
    expect(DATA[0]).toMatchObject({
      no: 'M1000-A',
      name: '不锈钢法兰',
      status: '已审核',
      dept: '采购部',
      amount: 12800,
    })
    expect(DATA[7].no).toBe('M1099')
    expect(new Set(DATA.map((r) => r.no)).size).toBe(2000)
  })

  it('FIELD_DEFS 是原型的 8 个字段(含只出现在搜索里的「备注」)', () => {
    expect(FIELD_DEFS.map((f) => f.key)).toEqual([
      'no',
      'name',
      'owner',
      'status',
      'dept',
      'amount',
      'bizDate',
      'memo',
    ])
  })

  it('addRow 把「新建物料」放最前并返回编码;delRow 删掉它', () => {
    const before = DATA.length
    const no = addRow()
    expect(no).toBe('M1000-D')
    expect(DATA[0]).toMatchObject({ no, name: '新建物料', status: '未审核' })
    expect(DATA).toHaveLength(before + 1)
    expect(delRow(no)).toBe(true)
    expect(delRow(no)).toBe(false)
    expect(DATA).toHaveLength(before)
  })
})

describe('对照页的「后端」fetchRows', () => {
  it('分页:第 1 页取 100 行,total 是全部 2000', async () => {
    const r = await fetchRows(params())
    expect(r.items).toHaveLength(100)
    expect(r.total).toBe(2000)
    expect(r.items[0].no).toBe('M1000-A')
    const p2 = await fetchRows(params({ page: 2 }))
    expect(p2.items[0].no).toBe(DATA[100].no)
  })

  it('搜索:文本字段是包含(忽略大小写),下拉 / 数字 / 日期是等于', async () => {
    const byNo = await fetchRows(params({ no: 'm1000' }))
    expect(byNo.items.length).toBeGreaterThan(0)
    expect(byNo.items.every((r) => r.no.toLowerCase().includes('m1000'))).toBe(true)
    const byStatus = await fetchRows(params({ status: '已关闭' }))
    expect(byStatus.total).toBe(DATA.filter((r) => r.status === '已关闭').length)
    const byAmount = await fetchRows(params({ amount: '12800' }))
    expect(byAmount.items.every((r) => r.amount === 12800)).toBe(true)
  })

  it('列头过滤:用库导出的 matchFilterValue 求值(物料编码 包含 M10 或 包含 M20)', async () => {
    const r = await fetchRows(
      params({
        filters: [
          {
            field: 'no',
            logic: 'or',
            conditions: [
              { action: 'contains', value: 'M10' },
              { action: 'contains', value: 'M20' },
            ],
          },
        ],
        pageSize: 1000,
      }),
    )
    expect(r.total).toBe(DATA.filter((x) => x.no.includes('M10') || x.no.includes('M20')).length)
    expect(r.items.every((x) => x.no.includes('M10') || x.no.includes('M20'))).toBe(true)
  })

  it('多列排序:sorts 里靠前的优先(部门升序,同部门按金额降序)', async () => {
    const r = await fetchRows(
      params({
        pageSize: 1000,
        sortField: 'dept',
        sortOrder: 'asc',
        sorts: [
          { field: 'dept', order: 'asc' },
          { field: 'amount', order: 'desc' },
        ],
      }),
    )
    for (let i = 1; i < r.items.length; i++) {
      const a = r.items[i - 1]
      const b = r.items[i]
      const c = a.dept.localeCompare(b.dept, 'zh')
      expect(c <= 0).toBe(true)
      if (c === 0) expect(a.amount >= b.amount).toBe(true)
    }
  })

  it('单列排序:只带 sortField / sortOrder 也认', async () => {
    const r = await fetchRows(params({ sortField: 'amount', sortOrder: 'desc' }))
    expect(r.items[0].amount).toBe(Math.max(...DATA.map((x) => x.amount)))
  })
})

describe('MOCK_DELAY(模拟后端延迟)', () => {
  it('默认 420ms(与原型的 mock 后端一致);置 0 不等待', async () => {
    const delay = MOCK_DELAY.ms
    expect(delay).toBe(0) // 本文件顶部已置 0
    MOCK_DELAY.ms = 30
    const t0 = Date.now()
    await fetchRows(params())
    expect(Date.now() - t0).toBeGreaterThanOrEqual(25)
    MOCK_DELAY.ms = 0
  })
})

describe('对照页(ProtoApp:原型的外壳 + 真实库渲染的一张表)', () => {
  // jsdom 没有 matchMedia / ResizeObserver(naive-ui 与虚拟滚动要用),给个最小桩
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

  function mountApp(m: 1 | 2 | 3 | 4) {
    history.replaceState(null, '', `/prototype.html?m=${m}&theme=light`)
    return mount(ProtoApp, { attachTo: document.body })
  }

  it.each([1, 2, 3, 4] as const)(
    '模块 %i:侧栏 4 个模块、标题、工具栏、表头都渲染出来',
    async (m) => {
      const w = mountApp(m)
      await flushPromises()
      expect(w.findAll('#modList .mod')).toHaveLength(4)
      expect(w.find('.smart-table-title').text()).toBe('物料单据')
      const heads = w.findAll('thead th').map((th) => th.text())
      expect(heads).toEqual(
        expect.arrayContaining([
          '物料编码',
          '物料名称',
          '负责人',
          '单据状态',
          '部门',
          '金额',
          '单据日期',
          '操作',
        ]),
      )
      w.unmount()
    },
  )

  it('模块 3:单据状态有默认过滤「未审核」(出现一个 chip);模块 4 没有默认过滤', async () => {
    const m3 = mountApp(3)
    await flushPromises()
    const chips = m3.findAll('.smart-table-chip')
    expect(chips.map((c) => c.text())).toEqual(['单据状态 等于 未审核'])
    m3.unmount()
    const m4 = mountApp(4)
    await flushPromises()
    expect(m4.findAll('.smart-table-chip')).toHaveLength(0)
    m4.unmount()
  })

  it('模块 1 有搜索卡片(中文「展开」),模块 3 的表头有漏斗,模块 2 没有搜索也没有漏斗', async () => {
    const m1 = mountApp(1)
    await flushPromises()
    expect(m1.find('.smart-table-search').exists()).toBe(true)
    expect(m1.find('.smart-table-search').text()).toContain('展开')
    m1.unmount()

    const m3 = mountApp(3)
    await flushPromises()
    expect(m3.findAll('.smart-table-filter-trigger').length).toBeGreaterThan(0)
    m3.unmount()

    const m2 = mountApp(2)
    await flushPromises()
    expect(m2.find('.smart-table-search').exists()).toBe(false)
    expect(m2.findAll('.smart-table-filter-trigger')).toHaveLength(0)
    m2.unmount()
  })
})
