import { flushPromises } from '@vue/test-utils'

/**
 * 轮询到条件成立再返回;超时抛错。
 * 按时间而不是按次数等:jsdom 里首次渲染 25 列的表格,机器忙时能超出「10 轮 × 20ms」;
 * 超时必须报错,静默放行会让后面的断言落在还没渲染的表格上,变成偶发失败。
 * timeout 要小于 vitest 单个用例的默认 5000ms,否则看到的是用例超时而不是这里的报错。
 */
export async function waitUntil(cond: () => boolean, timeout = 4000): Promise<void> {
  const deadline = Date.now() + timeout
  for (;;) {
    await flushPromises()
    if (cond()) return
    if (Date.now() > deadline) throw new Error(`waitUntil 超时(${timeout}ms):条件始终不成立`)
    await new Promise((r) => setTimeout(r, 20))
  }
}
