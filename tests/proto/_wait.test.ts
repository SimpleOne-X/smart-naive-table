import { describe, expect, it } from 'vitest'
import { waitUntil } from './_wait'

// 对照页测试里「等表格渲染出来」的轮询。此前写成「最多 10 轮、每轮 20ms」且超时静默放行:
// 机器忙时渲染超出预算,断言就跑在还没渲染的表格上,表现成随机失败。
describe('waitUntil', () => {
  it('条件很快成立:立即返回', async () => {
    await waitUntil(() => true)
  })

  it('条件稍后才成立:一直等到成立再返回(不是等固定次数)', async () => {
    let ready = false
    setTimeout(() => (ready = true), 300)
    await waitUntil(() => ready, 2000)
    expect(ready).toBe(true)
  })

  it('超时:抛错,不静默放行', async () => {
    await expect(waitUntil(() => false, 100)).rejects.toThrow(/waitUntil/)
  })
})
