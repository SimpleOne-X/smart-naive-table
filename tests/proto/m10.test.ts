// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import type { Component } from 'vue'
import { SmartTable } from '../../src/index'
import { PROCS, freshProcs, moveItem } from '../../playground/prototype/data/m10-procs'
import { mountApp, useAppStubs } from './_mount'

// 模块 10「行拖拽排序」:原型 PROCS 10 道工序、手柄列、row-draggable + drag-handle、@row-drag-sort 落到宿主数组、键盘 ↑ / ↓。
// sortablejs 的真实拖拽在 jsdom 里做不了(没有布局 / 原生 DnD),真实拖一次是在 Edge 里用 CDP 做的;这里锁数据、接线与事件处理。
useAppStubs()
// SmartTable 是泛型组件,findComponent 的重载认不出它:当普通组件查,props / vm 仍可用
const stOf = (w: VueWrapper) => w.findComponent(SmartTable as unknown as Component)
const propsOf = (w: VueWrapper) => stOf(w).props() as unknown as Record<string, unknown>
const settle = async () => {
  for (let i = 0; i < 4; i++) await flushPromises()
}
const names = () =>
  [...document.querySelectorAll('.n-data-table-tbody .n-data-table-tr')].map((tr) =>
    tr.children[3]?.textContent?.trim(),
  )

describe('数据与纯函数', () => {
  it('原型 PROCS:10 行,首行下料 / 末行包装,备注为空的是 3 / 7 / 10 号', () => {
    expect(PROCS).toHaveLength(10)
    expect(PROCS[0]).toMatchObject({
      code: '10',
      name: '下料',
      center: '下料中心',
      hours: 0.5,
      note: '锯切 / 激光',
    })
    expect(PROCS[9]).toMatchObject({ code: '100', name: '包装' })
    expect(PROCS.filter((p) => !p.note).map((p) => p.code)).toEqual(['30', '70', '100'])
  })

  it('freshProcs 是深拷贝:改它不影响常量', () => {
    const a = freshProcs()
    a[0].name = 'x'
    moveItem(a, 0, 3)
    expect(PROCS[0].name).toBe('下料')
  })

  it('moveItem:前移 / 后移 / 越界与原位不动', () => {
    const a = [1, 2, 3, 4]
    expect(moveItem(a, 0, 2)).toBe(true)
    expect(a).toEqual([2, 3, 1, 4])
    expect(moveItem(a, 3, 0)).toBe(true)
    expect(a).toEqual([4, 2, 3, 1])
    expect(moveItem(a, 1, 1)).toBe(false)
    expect(moveItem(a, 0, -1)).toBe(false)
    expect(moveItem(a, 0, 4)).toBe(false)
    expect(a).toEqual([4, 2, 3, 1])
  })
})

describe('对照页 ?m=10', () => {
  it('表头 = 手柄列 / 序号 / 工序号 / 工序名称 / 工作中心 / 标准工时(h) / 备注;无搜索、无分页;10 行', async () => {
    const w = await mountApp(10)
    await settle()
    expect([...document.querySelectorAll('thead th')].map((th) => th.textContent?.trim())).toEqual([
      '',
      '序号',
      '工序号',
      '工序名称',
      '工作中心',
      '标准工时(h)',
      '备注',
    ])
    expect(names()).toEqual(PROCS.map((p) => p.name))
    expect(document.querySelectorAll('.proto-drag-handle')).toHaveLength(10)
    expect(document.querySelector('.n-pagination')).toBeNull()
    expect(document.querySelector('.smart-table-title')).toBeNull() // 单表模块工具栏不再画表名(设计 §2.14:页顶已有页面标题)
    // 备注空 → 破折号;工时一位小数
    const row3 = document.querySelectorAll('.n-data-table-tbody .n-data-table-tr')[2]
    expect([...row3.children].map((c) => c.textContent?.trim())).toEqual([
      '',
      '3',
      '30',
      '钻孔',
      '加工中心',
      '0.8',
      '—',
    ])
    w.unmount()
  })

  it('SmartTable 接线:row-draggable + drag-handle 选择器指向手柄类', async () => {
    const w = await mountApp(10)
    await settle()
    expect(propsOf(w).rowDraggable).toBe(true)
    expect(propsOf(w).dragHandle).toBe('.proto-drag-handle')
    expect(document.querySelector(propsOf(w).dragHandle as string)).toBeTruthy()
    w.unmount()
  })

  it('@row-drag-sort:库发出重排结果 → 页面按新顺序渲染、序号随位置变化,并提示「已保存顺序」', async () => {
    const w = await mountApp(10)
    await settle()
    const st = stOf(w)
    const next = freshProcs()
    moveItem(next, 0, 3) // 下料 拖到第 4 位
    st.vm.$emit('rowDragSort', { from: 0, to: 3, reordered: next })
    await settle()
    expect(names()).toEqual([
      '粗车',
      '钻孔',
      '铣面',
      '下料',
      '热处理',
      '精车',
      '磨削',
      '酸洗钝化',
      '检验',
      '包装',
    ])
    expect(
      [...document.querySelectorAll('.n-data-table-tbody .n-data-table-tr')].map((tr) =>
        tr.children[1].textContent?.trim(),
      ),
    ).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'])
    expect(document.body.textContent).toContain('已保存顺序')
    w.unmount()
  })

  it('键盘:手柄上 ↓ 下移一位、↑ 上移一位,首行 ↑ / 末行 ↓ 不动', async () => {
    const w = await mountApp(10)
    await settle()
    const key = (i: number, k: string) =>
      document
        .querySelectorAll('.proto-drag-handle')
        [i].dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }))
    key(0, 'ArrowUp')
    await settle()
    expect(names()[0]).toBe('下料')
    key(0, 'ArrowDown')
    await settle()
    expect(names().slice(0, 3)).toEqual(['粗车', '下料', '钻孔'])
    key(2, 'ArrowUp')
    await settle()
    expect(names().slice(0, 3)).toEqual(['粗车', '钻孔', '下料'])
    key(9, 'ArrowDown')
    await settle()
    expect(names()[9]).toBe('包装')
    w.unmount()
  })

  it('英文:标题 / 表头走词典(Operations / Op No. / Std. hours (h))', async () => {
    const w = await mountApp(10, { lang: 'en' })
    await settle()
    expect(document.querySelector('.smart-table-title')).toBeNull()
    const ths = [...document.querySelectorAll('thead th')].map((th) => th.textContent?.trim())
    expect(ths).toContain('Op No.')
    expect(ths).toContain('Std. hours (h)')
    w.unmount()
  })
})
