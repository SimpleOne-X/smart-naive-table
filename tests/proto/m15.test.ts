// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import {
  ORGS,
  ORG_DEFAULT_EXPANDED,
  ORG_PAGE_SIZE,
  freshOrgs,
} from '../../playground/prototype/data/m15-orgs'
import { mountApp, useAppStubs } from './_mount'

// 模块 15「树形表格」(设计 2.17):原型 TREE_ROWS(5 个根、最深三层,每页 3 个根)、默认展开「总部」「生产中心」、勾选 cascade。
// 宽档 = 官方 NDataTable 的树形态;窄档卡片的行为由 tests/SmartTable.cardTree.test.ts 锁住(这里挂整个 ProtoApp,jsdom 里没有真实容器宽)。
useAppStubs()
const settle = async () => {
  for (let i = 0; i < 4; i++) await flushPromises()
}
const rowsText = () =>
  [...document.querySelectorAll('.n-data-table-tbody .n-data-table-tr')].map((tr) =>
    tr.children[1]?.textContent?.trim(),
  )

describe('数据', () => {
  it('原型 TREE_ROWS:5 个根,最深三层;共享服务中心是叶子', () => {
    expect(ORGS.map((o) => o.id)).toEqual(['HQ', 'EC', 'SC', 'RD', 'SS'])
    const depth = (o: { children?: unknown[] }): number =>
      1 + Math.max(0, ...((o.children ?? []) as { children?: unknown[] }[]).map((c) => depth(c)))
    expect(Math.max(...ORGS.map(depth))).toBe(3)
    expect(ORGS[4].children).toBeUndefined()
  })

  it('每页 3 个根 → 2 页;默认展开「总部」「生产中心」', () => {
    expect(ORG_PAGE_SIZE).toBe(3)
    expect(Math.ceil(ORGS.length / ORG_PAGE_SIZE)).toBe(2)
    expect(ORG_DEFAULT_EXPANDED).toEqual(['HQ', 'HQ-PD'])
  })

  it('freshOrgs 是深拷贝:改它不影响常量', () => {
    const a = freshOrgs()
    a[0].children![0].name = 'x'
    expect(ORGS[0].children![0].name).toBe('生产中心')
  })
})

describe('对照页 ?m=15', () => {
  it('表头 = 勾选列 / 机构名称 / 机构编码 / 负责人 / 人数 / 状态;第 1 页按根行计:3 个根 + 默认展开的后代 = 9 行', async () => {
    const w = await mountApp(15)
    await settle()
    expect([...document.querySelectorAll('thead th')].map((th) => th.textContent?.trim())).toEqual([
      '',
      '机构名称',
      '机构编码',
      '负责人',
      '人数',
      '状态',
    ])
    expect(rowsText()).toEqual([
      '总部',
      '生产中心',
      '车削一组',
      '车削二组',
      '加工中心',
      '质量中心',
      '采购部',
      '华东分公司',
      '华南分公司',
    ])
    expect(document.querySelector('.n-pagination')?.textContent).toContain('共 5 条')
    expect(document.querySelector('.smart-table-title')).toBeNull() // 单表模块不画工具栏标题(设计 §2.14)
    w.unmount()
  })

  it('官方树形态:有子级的行画展开箭头(默认展开的两个是展开态);勾父 → 后代全勾、祖先半选', async () => {
    const w = await mountApp(15)
    await settle()
    const triggers = document.querySelectorAll('.n-data-table-expand-trigger')
    expect(triggers.length).toBeGreaterThanOrEqual(5)
    expect(document.querySelectorAll('.n-data-table-expand-trigger--expanded')).toHaveLength(2)
    const rows = () => [...document.querySelectorAll('.n-data-table-tbody .n-data-table-tr')]
    ;(rows()[1].querySelector('.n-checkbox') as HTMLElement).click() // 勾「生产中心」
    await settle()
    const state = rows().map((r) => {
      const c = r.querySelector('.n-checkbox')!
      return c.classList.contains('n-checkbox--checked')
        ? 'on'
        : c.classList.contains('n-checkbox--indeterminate')
          ? 'half'
          : 'off'
    })
    expect(state.slice(0, 5)).toEqual(['half', 'on', 'on', 'on', 'on'])
    w.unmount()
  })

  it('English:机构名称 / 状态 / 机构名都翻成英文', async () => {
    const w = await mountApp(15, { lang: 'en' })
    await settle()
    expect([...document.querySelectorAll('thead th')].map((th) => th.textContent?.trim())).toEqual([
      '',
      'Organization',
      'Code',
      'Owner',
      'Headcount',
      'Status',
    ])
    expect(rowsText()[0]).toBe('Headquarters')
    expect(document.querySelector('.n-data-table-tbody')?.textContent).toContain('Enabled')
    w.unmount()
  })
})
