import { describe, expect, it } from 'vitest'
import { clampShift } from '../src/viewportClamp'

describe('clampShift(L0-9:弹层水平夹进视口)', () => {
  it('完全在视口内(两侧都留得出 8px)→ 0', () => {
    expect(clampShift(100, 400, 1440)).toBe(0)
    expect(clampShift(8, 400, 1440)).toBe(0) // 恰好贴着边距
    expect(clampShift(1440 - 8 - 400, 400, 1440)).toBe(0)
  })

  it('左侧出屏 → 右移到 left = 8', () => {
    expect(clampShift(-69, 374, 390)).toBe(77)
    expect(clampShift(0, 300, 1000)).toBe(8)
  })

  it('右侧出屏 → 左移到 right = viewport − 8', () => {
    expect(clampShift(300, 200, 390)).toBe(-118)
    expect(clampShift(1300, 400, 1440)).toBe(-268)
  })

  it('比「视口 − 两侧边距」还宽(放不下)→ 贴左边距,保证左侧的内容(标签、比较符)可见', () => {
    expect(clampShift(-20, 500, 400)).toBe(28)
    expect(clampShift(50, 500, 400)).toBe(-42)
  })

  it('边距可配', () => {
    expect(clampShift(2, 100, 400, 16)).toBe(14)
  })

  it('结果取整(亚像素 rect 不会产生 translateX(77.3333px) 这类模糊渲染)', () => {
    expect(Number.isInteger(clampShift(-69.4, 374.2, 390))).toBe(true)
  })
})
