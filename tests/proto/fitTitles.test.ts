// @vitest-environment jsdom
// 英文表头默认列宽(原型 titleFit):文字宽 + 12 + 16 + 1 + 1;jsdom 没有 canvas,textW 退回估值「英文每字 8px / 汉字 14.5px」。
import { describe, expect, it } from 'vitest'
import { titleFit } from '../../playground/prototype/i18n'
import { fitTitles } from '../../playground/prototype/modules/shared/fitTitles'

type Col = {
  key?: string
  type?: string
  title?: string | (() => string)
  width?: number
  minWidth?: number
  children?: Col[]
}
const col = (key: string, title: string, o: Partial<Col> = {}): Col => ({
  key,
  title: () => title,
  ...o,
})

describe('titleFit', () => {
  it('= ceil(文字宽) + 左内边距 12 + 右内边距 16 + 右边框 1 + 亚像素余量 1', () => {
    // 'Reporting' 9 个字 × 8px = 72
    expect(titleFit('Reporting')).toBe(72 + 30)
    expect(titleFit('')).toBe(30)
  })
})

describe('fitTitles', () => {
  it('中文(en = false)原样返回同一个数组', () => {
    const cols = [col('a', 'Reporting', { width: 72 })]
    expect(fitTitles(cols, false)).toBe(cols)
  })

  it('width 列:文字更宽就加宽到 titleFit,已经够宽的不动', () => {
    const out = fitTitles(
      [col('a', 'Reporting', { width: 72 }), col('b', 'QC', { width: 72 })],
      true,
    )
    expect(out[0].width).toBe(titleFit('Reporting'))
    expect(out[1].width).toBe(72) // 'QC' 16 + 30 = 46 < 72
  })

  it('minWidth(弹性)列加 minWidth,不凭空写 width', () => {
    const [c] = fitTitles([col('n', 'Operation name here', { minWidth: 60 })], true)
    expect(c.minWidth).toBe(titleFit('Operation name here'))
    expect(c.width).toBeUndefined()
  })

  it('序号 / 勾选(有 type)、操作列、标题不是函数的列(手柄)不动', () => {
    const idx: Col = { type: 'index', title: () => 'Op No.', width: 20 }
    const act = col('actions', 'Actions', { width: 20 })
    const handle: Col = { key: 'rd', title: '', width: 20 }
    const out = fitTitles([idx, act, handle], true)
    expect(out[0]).toBe(idx)
    expect(out[1]).toBe(act)
    expect(out[2]).toBe(handle)
  })

  it('多级表头递归处理 children,分组标题自己不加宽', () => {
    const grp: Col = {
      key: 'stock',
      title: () => 'Stock',
      children: [col('a', 'In transit', { width: 40 })],
    }
    const [g] = fitTitles([grp], true)
    expect(g.children?.[0].width).toBe(titleFit('In transit'))
    expect(g.width).toBeUndefined()
  })
})
