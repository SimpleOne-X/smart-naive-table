// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import type { DefineComponent } from 'vue'
import { SmartTable } from '../../src/index'
import type { Row } from '../../playground/prototype/data'
import { mountApp, useAppStubs } from './_mount'

// 模块 13「多语言与页面底色」:一张物料单据表(工具栏条件搜索,没有搜索卡),列标题是函数式标题,随外壳语言变;
// 金额带单位,备注列空值显示 —。
useAppStubs()
// SmartTable 是泛型组件,findComponent 的重载推不出 props:收窄成 DefineComponent 只为取 props / vm
const SmartTableComp = SmartTable as unknown as DefineComponent<{
  columns: unknown[]
  data?: unknown[]
  fillHeight?: boolean
}>
const stOf = (w: VueWrapper) => w.findComponent(SmartTableComp)
const settle = async () => {
  for (let i = 0; i < 4; i++) await flushPromises()
}
const heads = () => [...document.querySelectorAll('thead th')].map((th) => th.textContent?.trim())

// 只声明本测试读到的列字段:库的列类型是联合 + 透传 Naive 属性,直接断言取不到 options / render
interface ColView {
  key?: string
  type?: string
  title?: string | (() => string)
  width?: number
  hideInTable?: boolean
  tag?: boolean
  search?: unknown
  options?: Array<{ label: () => string; tagType?: string }>
  render?: (row: Row, index: number) => unknown
}
const colsOf = (w: VueWrapper): ColView[] => stOf(w).props('columns') as unknown as ColView[]
const tableVm = (w: VueWrapper) => stOf(w).vm as unknown as { rows: Row[] }
const titleOf = (c: ColView) => (typeof c.title === 'function' ? c.title() : c.title)

// jsdom 没有 canvas:textW 退回估值,同时别刷 not-implemented 噪音
function stubCanvas() {
  const real = HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof real
  return () => {
    HTMLCanvasElement.prototype.getContext = real
  }
}

describe('模块 13 页面', { timeout: 20000 }, () => {
  it('中文:列 = 勾选 / 序号 / 7 个业务列(金额带单位)/ 备注 / 操作;条件搜索一行、没有独立搜索卡;fillHeight', async () => {
    const w = await mountApp(13)
    await settle()
    expect(heads()).toEqual([
      '',
      '序号',
      '物料编码',
      '物料名称',
      '负责人',
      '单据状态',
      '部门',
      '金额(元)',
      '单据日期',
      '备注',
      '操作',
    ])
    expect(document.querySelector('.smart-table-title')).toBeNull() // 单表模块工具栏不再画表名(设计 §2.14:页顶已有页面标题)
    expect(document.querySelector('.smart-table-cond')).toBeTruthy()
    expect(document.querySelector('.smart-table-search')).toBeNull()
    expect(stOf(w).props('fillHeight')).toBe(true)
    expect(tableVm(w).rows).toHaveLength(100)
    expect(document.querySelector('.n-pagination')?.parentElement?.textContent).toContain(
      '共 2000 条',
    )
    w.unmount()
  })

  it('备注列:有值显示原文,空值显示 —(不是空白);状态列是字典标签', async () => {
    const w = await mountApp(13)
    await settle()
    // fillHeight 开了虚拟滚动,jsdom 里没有高度 -> 不画行;直接取列配置的渲染函数 + 请求到的行数据
    const rows = tableVm(w).rows
    const memo = colsOf(w).find((c) => c.key === 'memo')!
    expect(memo.hideInTable).toBe(false)
    expect(memo.width).toBe(128)
    expect(memo.render!(rows[0], 0)).toBe('加急') // M1000-A
    const empty = memo.render!(rows[1], 1) as { children: unknown } // M1000-B 备注为空 -> <span>—</span>
    expect(empty.children).toBe('—')
    const status = colsOf(w).find((c) => c.key === 'status')!
    expect(status.tag).toBe(true)
    expect(status.options!.map((o) => [o.label(), o.tagType])).toEqual([
      ['已审核', 'success'],
      ['未审核', 'warning'],
      ['已关闭', 'default'],
    ])
    w.unmount()
  })

  it('备注同时是条件搜索的字段(原型 8 个字段),金额字段标题带单位', async () => {
    const w = await mountApp(13)
    await settle()
    const fields = colsOf(w).filter((c) => !c.type && c.search)
    expect(fields.map(titleOf)).toEqual([
      '物料编码',
      '物料名称',
      '负责人',
      '单据状态',
      '部门',
      '金额(元)',
      '单据日期',
      '备注',
    ])
    w.unmount()
  })

  it('English:函数式列标题随语言重算(Amount (CNY) / Remarks),字典标签、分页文案也是英文', async () => {
    const restore = stubCanvas()
    const w = await mountApp(13, { lang: 'en' })
    await settle()
    expect(heads()).toEqual([
      '',
      'No.',
      'Material Code',
      'Material Name',
      'Owner',
      'Document Status',
      'Department',
      'Amount (CNY)',
      'Document Date',
      'Remarks',
      'Actions',
    ])
    expect(document.querySelector('.smart-table-title')).toBeNull()
    const status = colsOf(w).find((c) => c.key === 'status')!
    expect(status.options!.map((o) => o.label())).toEqual(['Approved', 'Pending', 'Closed'])
    expect(document.querySelector('.n-pagination')?.parentElement?.textContent).toContain(
      'Total 2000',
    )
    w.unmount()
    restore()
  })

  it('英文下表头不被截断:列宽 >= 标题文字宽度 + 28(原型 titleFit);中文列宽不变', async () => {
    const restore = stubCanvas()
    const widthOf = (w: VueWrapper, key: string) => colsOf(w).find((c) => c.key === key)?.width ?? 0
    const zh = await mountApp(13)
    await settle()
    expect(widthOf(zh, 'status')).toBe(96)
    zh.unmount()
    const en = await mountApp(13, { lang: 'en' })
    await settle()
    expect(widthOf(en, 'status')).toBeGreaterThan(96) // 'Document Status' 比 96px 宽
    expect(widthOf(en, 'amount')).toBeGreaterThan(104)
    en.unmount()
    restore()
  })
})
