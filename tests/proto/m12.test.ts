// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import type { DefineComponent } from 'vue'
import { SmartTable } from '../../src/index'
import {
  DET_INITIAL,
  PICK_PS,
  detRow,
  initialDet,
  pickCandidates,
  sumDet,
} from '../../playground/prototype/data/m12-det'
import { DATA } from '../../playground/prototype/data'
import { mountApp, useAppStubs } from './_mount'

// 模块 12「嵌入式表格」:入库明细子表(静态 data、无搜索 / 工具栏 / 分页、striped、合计行)+ 选择物料弹窗 + 物料单据主表(不开 fillHeight)。
useAppStubs()
// SmartTable 是泛型组件,findComponent 的重载推不出 props:收窄成 DefineComponent 只为取 props / vm
const SmartTableComp = SmartTable as unknown as DefineComponent<{
  columns: unknown[]
  data?: unknown[]
  fillHeight?: boolean
}>
const settle = async () => {
  for (let i = 0; i < 4; i++) await flushPromises()
}
const $$ = (sel: string) => [...document.querySelectorAll<HTMLElement>(sel)]
const addBtn = () =>
  $$('[data-parity="sub"] button').find((b) => b.textContent?.includes('添加物料'))!

describe('m12 数据(data/m12-det.ts)', () => {
  it('detRow 由编码哈希派生:同一编码永远得到同一份数量 / 单价;金额 = 数量 x 单价', () => {
    expect(detRow('M1000-A')).toEqual(detRow('M1000-A'))
    const a = detRow('M1000-A')
    expect(a).toMatchObject({ no: 'M1000-A', name: '不锈钢法兰', qty: 28, price: 67.9 })
    expect(a.amt).toBeCloseTo(1901.2, 6)
    expect(detRow('NOPE').name).toBe('')
  })
  it('初始 6 行与原型一致,合计 459 / 32,679.80', () => {
    expect(DET_INITIAL).toEqual(['M1000-A', 'M1000-B', 'M1024', 'M2011', 'M1000-C', 'M3050'])
    const s = sumDet(initialDet())
    expect(s.qty).toBe(459)
    expect(s.amt.toFixed(2)).toBe('32679.80')
  })
  it('pickCandidates:剔除已选、关键字(编码 / 名称,忽略大小写)与状态过滤', () => {
    const used = new Set(DET_INITIAL)
    const all = pickCandidates(used, '', '')
    expect(all).toHaveLength(DATA.length - DET_INITIAL.length)
    expect(all.some((r) => used.has(r.no))).toBe(false)
    expect(pickCandidates(used, 'm1099', '').map((r) => r.no)).toEqual(['M1099'])
    expect(
      pickCandidates(used, '螺栓', '已关闭').every(
        (r) => r.status === '已关闭' && r.name.includes('螺栓'),
      ),
    ).toBe(true)
    expect(PICK_PS).toBe(8)
  })
})

describe('模块 12 页面', { timeout: 20000 }, () => {
  let desc: PropertyDescriptor | undefined
  beforeEach(() => {
    // jsdom 的 clientWidth 恒为 0 -> useTier 判窄档(弹窗会变抽屉);要测宽档弹窗就给一个宽度
    desc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth')
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get: () => 1100,
    })
  })
  afterEach(() => {
    if (desc) Object.defineProperty(HTMLElement.prototype, 'clientWidth', desc)
    else Reflect.deleteProperty(HTMLElement.prototype, 'clientWidth')
  })

  it('两张表各包一层 data-parity:sub = 入库明细,main = 物料单据;子表静态数据、无搜索 / 工具栏图标 / 分页', async () => {
    const w = await mountApp(12)
    await settle()
    const sub = document.querySelector('[data-parity="sub"]')!
    const main = document.querySelector('[data-parity="main"]')!
    expect(sub && main).toBeTruthy()
    expect(sub.querySelector('.smart-table-title')?.textContent).toBe('入库明细')
    expect(main.querySelector('.smart-table-title')?.textContent).toBe('物料单据')
    expect(sub.querySelector('.n-pagination')).toBeNull()
    expect(sub.querySelector('.smart-table-cond, .smart-table-search')).toBeNull()
    expect(sub.querySelector('button[aria-label]')).toBeNull()
    const tables = w.findAllComponents(SmartTableComp)
    expect(tables).toHaveLength(2)
    expect(tables[0].props('data')).toHaveLength(6)
    expect(tables[1].props('fillHeight')).toBeFalsy() // 主表整页滚动,不开 fillHeight
    w.unmount()
  })

  it('子表:6 行 + 合计行(合计 / 459 / 32,679.80);点「移除」删一行并重算合计', async () => {
    const w = await mountApp(12)
    await settle()
    const sub = document.querySelector('[data-parity="sub"]')!
    const rows = () => [...sub.querySelectorAll('.n-data-table-tbody .n-data-table-tr')]
    expect(rows()).toHaveLength(7)
    const sum = sub.querySelector('.n-data-table-tr--summary')!
    expect(sum.textContent).toContain('合计')
    expect(sum.textContent).toContain('459')
    expect(sum.textContent).toContain('32,679.80')
    expect([...sub.querySelectorAll('thead th')].map((th) => th.textContent?.trim())).toEqual([
      '序号',
      '物料编码',
      '物料名称',
      '数量',
      '单价',
      '金额',
      '',
    ])
    const first = rows()[0]
    expect(first.textContent).toContain('M1000-A')
    expect(first.textContent).toContain('1,901.20') // 金额 = 28 x 67.90
    ;(first.querySelector('button') as HTMLElement).click()
    await settle()
    expect(rows()).toHaveLength(6) // 5 行 + 合计
    expect(sub.querySelector('.n-data-table-tr--summary')!.textContent).toContain('431') // 459 - 28
    w.unmount()
  })

  it('主表:每页 20 行,带工具栏条件搜索与完整列', async () => {
    const w = await mountApp(12)
    await settle()
    const main = w.findAllComponents(SmartTableComp)[1]
    const vm = main.vm as unknown as { rows: unknown[]; pagination: { pageSize: number } }
    expect(vm.rows).toHaveLength(20)
    expect(vm.pagination.pageSize).toBe(20)
    expect(
      document.querySelectorAll('[data-parity="main"] .n-data-table-tbody .n-data-table-tr').length,
    ).toBe(20)
    expect(document.querySelector('[data-parity="main"] .smart-table-cond')).toBeTruthy()
    expect(
      [...document.querySelectorAll('[data-parity="main"] thead th')].map((th) =>
        th.textContent?.trim(),
      ),
    ).toEqual(
      expect.arrayContaining([
        '序号',
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
  })

  it('「添加物料」-> 选择物料弹窗:8 行 / 页、没有已在明细里的行;勾选后「确定」可点,确定后明细 +2 并出提示', async () => {
    const w = await mountApp(12)
    await settle()
    addBtn().click()
    await settle()
    const modal = document.querySelector('.n-modal')!
    expect(modal.textContent).toContain('选择物料')
    expect(modal.textContent).toContain('已选 0 项')
    const rows = [...modal.querySelectorAll('.n-data-table-tbody .n-data-table-tr')]
    expect(rows).toHaveLength(8)
    expect(rows.map((r) => r.textContent).some((s) => s!.includes('M1000-A'))).toBe(false)
    const ok = () =>
      $$('.n-modal button').find((b) => b.textContent === '确定') as HTMLButtonElement
    expect(ok().disabled).toBe(true)
    for (const r of rows.slice(0, 2)) {
      ;(r.querySelector('.n-checkbox') as HTMLElement).click()
      await settle() // 真实用户不会在同一 tick 里点两次;库按宿主绑的 checked-row-keys 算新值,要等它回写
    }
    expect(modal.textContent).toContain('已选 2 项')
    expect(ok().disabled).toBe(false)
    ok().click()
    await settle()
    const subRows = document.querySelectorAll(
      '[data-parity="sub"] .n-data-table-tbody .n-data-table-tr',
    )
    expect(subRows).toHaveLength(9) // 8 行 + 合计
    expect(document.body.textContent).toContain('已添加 2 项')
    w.unmount()
  })

  it('弹窗里搜索:关键字过滤候选', async () => {
    const w = await mountApp(12)
    await settle()
    addBtn().click()
    await settle()
    const modal = document.querySelector('.n-modal')!
    const input = modal.querySelector('.smart-table-search-inline input') as HTMLInputElement
    input.value = 'M1099'
    input.dispatchEvent(new Event('input'))
    await settle()
    ;[...modal.querySelectorAll('button')].find((b) => b.textContent === '搜索')!.click()
    await settle()
    const rows = [...modal.querySelectorAll('.n-data-table-tbody .n-data-table-tr')]
    expect(rows).toHaveLength(1)
    expect(rows[0].textContent).toContain('M1099')
    w.unmount()
  })

  it('English:子表标题 / 按钮 / 合计行走词典', async () => {
    const getContext = HTMLCanvasElement.prototype.getContext
    // jsdom 没有 canvas:textW 退回估值,别刷 not-implemented 噪音
    HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof getContext
    const w = await mountApp(12, { lang: 'en' })
    await settle()
    const sub = document.querySelector('[data-parity="sub"]')!
    expect(sub.querySelector('.smart-table-title')?.textContent).toBe('Receipt lines')
    expect(sub.textContent).toContain('Add material')
    const heads = [...sub.querySelectorAll('thead th')].map((th) => th.textContent?.trim())
    expect(heads.slice(1, 6)).toEqual([
      'Material Code',
      'Material Name',
      'Qty',
      'Unit price',
      'Amount',
    ])
    expect(sub.querySelector('.n-data-table-tr--summary')?.textContent).toContain('Total')
    w.unmount()
    HTMLCanvasElement.prototype.getContext = getContext
  })
})
