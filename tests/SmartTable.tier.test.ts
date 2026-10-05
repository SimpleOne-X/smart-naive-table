// @vitest-environment jsdom
// 容器宽度档位:ResizeObserver 报宽度 0(组件被 keep-alive 摘下)时沿用上一次的档位(issue #5 附带的小问题)。
// 防回归:若 0 被当成「还没量到」按宽档处理,容器实际 < 1280 时每次切回会先按宽档多渲染一帧,下一帧才回到真实档位。
// 档位的可观察结果取窄档卡片模式(cardOnNarrow):窄档 = 卡片列表,否则 = 表格(jsdom 不做布局,宽度用 clientWidth 桩)。
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import SmartTable from '../src/SmartTable.vue'

const rows = [
  { no: 'R1', name: 'turn' },
  { no: 'R2', name: 'drill' },
]
const columns = [{ key: 'name', title: 'Name', card: 'title' }]

class RO {
  static instances: RO[] = []
  cb: () => void
  constructor(cb: () => void) {
    this.cb = cb
    RO.instances.push(this)
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

let wrapper: VueWrapper | undefined
/** 把根元素量到的宽度改成 width 并触发 ResizeObserver 回调(0 = keep-alive 摘下时的读数) */
async function resizeTo(width: number) {
  Object.defineProperty(wrapper!.element, 'clientWidth', { value: width, configurable: true })
  RO.instances.forEach((i) => i.cb())
  await nextTick()
  await flushPromises()
}
const isCards = () => wrapper!.find('.smart-table-cards').exists()

async function mountTable() {
  RO.instances = []
  vi.stubGlobal('ResizeObserver', RO)
  wrapper = mount(SmartTable, {
    props: { columns, data: rows, rowKey: 'no', pagination: false, cardOnNarrow: true } as never,
    attachTo: document.body,
  })
  await flushPromises()
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

describe('SmartTable 容器宽度为 0 时沿用上一次的档位', () => {
  it('窄档(390)→ 宽度 0(keep-alive 摘下)→ 仍是窄档,不先闪成宽档', async () => {
    await mountTable()
    await resizeTo(390)
    expect(isCards()).toBe(true)
    await resizeTo(0)
    expect(isCards()).toBe(true)
  })

  it('摘下后挂回,真实宽度回来时按新宽度重算(沿用只是 0 的那一刻)', async () => {
    await mountTable()
    await resizeTo(390)
    await resizeTo(0)
    expect(isCards()).toBe(true)
    await resizeTo(1400)
    expect(isCards()).toBe(false)
    await resizeTo(0)
    expect(isCards()).toBe(false)
    await resizeTo(390)
    expect(isCards()).toBe(true)
  })

  it('从没量到过宽度(一直是 0)时仍按宽档', async () => {
    await mountTable()
    await resizeTo(0)
    expect(isCards()).toBe(false)
  })
})
