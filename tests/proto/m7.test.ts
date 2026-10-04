// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { tableOf } from './m7-tableOf'
import { mountApp, useAppStubs } from './_mount'

// 模块 7「列设置」:物料单据表 + storageKey,列的显隐 / 顺序 / 固定 / 列宽写进 localStorage(库的 protable: 前缀 v2 结构),重进页面读回。
useAppStubs()
const KEY = 'protable:smart-naive-table-proto:persist'
const ALL = ['no', 'name', 'owner', 'status', 'dept', 'amount', 'bizDate', 'memo']
const headers = () =>
  [...document.querySelectorAll('.n-data-table-th .n-data-table-th__title')].map((e) =>
    e.textContent?.trim(),
  )

beforeEach(() => localStorage.removeItem(KEY))

describe('模块 7 列设置', () => {
  it('SmartTable 带 storage-key 与 resizable;首屏默认列齐全(「备注」搜索专用列不进表)', async () => {
    const w = await mountApp(7)
    const st = tableOf(w)
    expect(st.props('storageKey')).toBe('smart-naive-table-proto:persist')
    expect(st.props('resizable')).toBe(true)
    await flushPromises()
    expect(headers()).toEqual(
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
    expect(headers()).not.toContain('备注')
    // fill-height 是虚拟滚动,jsdom 没有布局不画行:看库实例的数据(第 1 页 100 行,共 2000)
    expect(st.vm.rows).toHaveLength(100)
    expect(st.vm.pagination.itemCount).toBe(2000)
    w.unmount()
  })

  it('读回:存储里隐藏的列、固定的列重进页面后生效', async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        v: 2,
        cols: ALL.map((key) => ({
          key,
          show: key !== 'owner' && key !== 'dept',
          ...(key === 'no' ? { fixed: 'left' } : {}),
        })),
        widths: {},
      }),
    )
    const w = await mountApp(7)
    await flushPromises()
    expect(headers()).not.toContain('负责人')
    expect(headers()).not.toContain('部门')
    expect(headers()).toContain('物料编码')
    w.unmount()
  })

  it('在列设置面板里取消勾选「负责人」→ 写进 localStorage', async () => {
    const w = await mountApp(7)
    await flushPromises()
    ;(
      document.querySelector('.smart-table-toolbar button[aria-label="列设置"]') as HTMLElement
    ).click()
    await flushPromises()
    const box = [...document.querySelectorAll('.smart-table-colset .n-checkbox')].find((c) =>
      c.textContent?.includes('负责人'),
    ) as HTMLElement
    expect(box).toBeTruthy()
    box.click()
    await flushPromises()
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    expect(saved?.v).toBe(2)
    expect(saved.cols.find((c: { key: string }) => c.key === 'owner').show).toBe(false)
    expect(headers()).not.toContain('负责人')
    w.unmount()
  })

  it('「恢复默认」清掉存储并还原全部列', async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        v: 2,
        cols: ALL.map((key) => ({ key, show: key !== 'owner' })),
        widths: {},
      }),
    )
    const w = await mountApp(7)
    await flushPromises()
    expect(headers()).not.toContain('负责人')
    ;(
      document.querySelector('.smart-table-toolbar button[aria-label="列设置"]') as HTMLElement
    ).click()
    await flushPromises()
    const reset = [...document.querySelectorAll('.smart-table-colset button')].find((b) =>
      b.textContent?.includes('恢复默认'),
    ) as HTMLElement
    reset.click()
    await flushPromises()
    expect(headers()).toContain('负责人')
    w.unmount()
  })
})
