// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import type { Component } from 'vue'
import { SmartTable } from '../../src/index'
import { DATA, type Row } from '../../playground/prototype/data'
import {
  MS_TREE,
  msCount,
  msFind,
  msLeaves,
  msParams,
} from '../../playground/prototype/data/m11-tree'
import { mountApp, useAppStubs } from './_mount'

// 模块 11「主从联动」:部门树 → params 联动表格、行点击 → 高亮 + 详情抽屉、树计数与原型一致。
useAppStubs()
// SmartTable 是泛型组件,findComponent 的重载认不出它:当普通组件查,props / vm 仍可用
const stOf = (w: VueWrapper) => w.findComponent(SmartTable as unknown as Component)
const propsOf = (w: VueWrapper) => stOf(w).props() as unknown as Record<string, unknown>
const settle = async () => {
  for (let i = 0; i < 5; i++) await flushPromises()
}
const total = () => document.querySelector('.n-pagination-prefix')?.textContent?.trim()
const nodes = () => [...document.querySelectorAll('.n-tree-node-content')]
const nodeBy = (txt: string) => nodes().find((n) => n.textContent?.includes(txt)) as HTMLElement
// 填满高度的表走官方虚拟滚动,jsdom 没有布局、不渲染行 DOM:行数据读库实例暴露的 rows
const rowsOf = (w: VueWrapper) => (stOf(w).vm as unknown as { rows: Row[] }).rows
const depts = (w: VueWrapper) => [...new Set(rowsOf(w).map((r) => r.dept))].sort()
// 虚拟滚动下没有行 DOM 可点,用库的 @row-click 事件走宿主的处理(「行内按钮不触发」由库自己的 SmartTable.rowClick 测试锁)
const clickRow = (w: VueWrapper, i: number) => stOf(w).vm.$emit('rowClick', rowsOf(w)[i], i)

describe('树数据与联动参数(纯函数)', () => {
  it('原型 MS_TREE:全部部门 → 生产系(生产部 / 仓储部)+ 职能系(采购部)', () => {
    expect(MS_TREE[0].key).toBe('all')
    expect(msLeaves(MS_TREE[0])).toEqual(['生产部', '仓储部', '采购部'])
    expect(msFind('g-func')?.children?.map((c) => c.key)).toEqual(['采购部'])
    expect(msFind('不存在')).toBeNull()
  })

  it('计数 = 按部门叶子统计全部 2000 行(与原型屏幕上的 2000 / 1234 / 698 / 536 / 766 一致)', () => {
    expect(DATA).toHaveLength(2000)
    expect(msCount(MS_TREE[0])).toBe(2000)
    expect(msCount(msFind('g-prod')!)).toBe(1234)
    expect(msCount(msFind('生产部')!)).toBe(698)
    expect(msCount(msFind('仓储部')!)).toBe(536)
    expect(msCount(msFind('g-func')!)).toBe(766)
  })

  it('msParams:全部 = 空;分组 = dept IN 叶子;叶子 = dept 等于', () => {
    expect(msParams('all')).toEqual({})
    expect(msParams('g-prod')).toEqual({ dept: ['生产部', '仓储部'] })
    expect(msParams('采购部')).toEqual({ dept: '采购部' })
    expect(msParams('乱写')).toEqual({})
  })
})

describe('对照页 ?m=11', () => {
  it('布局:.md > .md-side(树)+ .md-main(表);宽档 data-t=wide;树 6 个节点带计数,默认选中「全部部门」', async () => {
    const w = await mountApp(11)
    await settle()
    const md = document.querySelector('.md') as HTMLElement
    expect(md.dataset.t).toBe('wide')
    expect(md.querySelector('.md-side .n-tree')).toBeTruthy()
    expect(md.querySelector('.md-main .smart-table')).toBeTruthy()
    expect(nodes().map((n) => n.textContent?.replace(/\s+/g, ''))).toEqual([
      '全部部门2000',
      '生产系1234',
      '生产部698',
      '仓储部536',
      '职能系766',
      '采购部766',
    ])
    expect(document.querySelector('.n-tree-node--selected')?.textContent).toContain('全部部门')
    expect(total()).toBe('共 2000 条')
    w.unmount()
  })

  it('点「生产系」→ 表格只剩生产部 / 仓储部、总数 1234;点叶子「采购部」→ 766 且全是采购部;点回「全部部门」→ 2000', async () => {
    const w = await mountApp(11)
    await settle()
    nodeBy('生产系').click()
    await settle()
    expect(total()).toBe('共 1234 条')
    expect(depts(w)).toEqual(['仓储部', '生产部'])
    nodeBy('采购部').click()
    await settle()
    expect(total()).toBe('共 766 条')
    expect(depts(w)).toEqual(['采购部'])
    expect(document.querySelector('.n-tree-node--selected')?.textContent).toContain('采购部')
    nodeBy('全部部门').click()
    await settle()
    expect(total()).toBe('共 2000 条')
    w.unmount()
  })

  it('点已选中的节点不会取消选中(官方 NTree 默认会取消,原型恒选一个)', async () => {
    const w = await mountApp(11)
    await settle()
    nodeBy('全部部门').click()
    await settle()
    expect(document.querySelector('.n-tree-node--selected')?.textContent).toContain('全部部门')
    w.unmount()
  })

  it('SmartTable 接线:params / active-row-key / fetcher,每页 50(pageSizes [50, 100])', async () => {
    const w = await mountApp(11)
    await settle()
    expect(propsOf(w).params).toEqual({})
    expect(propsOf(w).activeRowKey).toBeNull()
    expect(propsOf(w).pagination).toMatchObject({ pageSizes: [50, 100] })
    expect(rowsOf(w)).toHaveLength(50)
    w.unmount()
  })

  it('点行 → active-row-key 取该行编码 + 详情抽屉(物料详情 / 8 个字段 / 关闭 + 编辑)', async () => {
    const w = await mountApp(11)
    await settle()
    expect(document.querySelector('.n-drawer')).toBeNull()
    clickRow(w, 1)
    await settle()
    expect(propsOf(w).activeRowKey).toBe('M1000-B')
    const dr = document.querySelector('.n-drawer') as HTMLElement
    expect(dr.querySelector('.n-drawer-header__main')?.textContent).toBe('物料详情')
    expect(
      [...dr.querySelectorAll('.n-descriptions-table-header')].map((e) => e.textContent?.trim()),
    ).toEqual(['物料编码', '物料名称', '负责人', '单据状态', '部门', '金额', '单据日期', '备注'])
    expect(dr.textContent).toContain('M1000-B')
    expect(dr.textContent).toContain('不锈钢弯头')
    expect(dr.textContent).toContain('3,400.00')
    expect(dr.textContent).toContain('—') // 备注为空
    expect(
      [...dr.querySelectorAll('.n-drawer-footer button')].map((b) => b.textContent?.trim()),
    ).toEqual(['关闭', '编辑'])
    w.unmount()
  })

  it('切换部门会清掉行高亮并收起抽屉', async () => {
    const w = await mountApp(11)
    await settle()
    clickRow(w, 1)
    await settle()
    expect(propsOf(w).activeRowKey).toBe('M1000-B')
    nodeBy('生产系').click()
    await settle()
    expect(propsOf(w).activeRowKey).toBeNull()
    w.unmount()
  })

  it('英文:树根 All departments、标题 Department', async () => {
    const w = await mountApp(11, { lang: 'en' })
    await settle()
    expect(nodes()[0].textContent).toContain('All departments')
    expect(document.querySelector('.md-title')?.textContent).toBe('Department')
    w.unmount()
  })
})
