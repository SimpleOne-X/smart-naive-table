// @vitest-environment jsdom
// final review fix:FilterChips 折成「+N」后,容器变宽要能重新展开。
// 13f 把 chips 列表改成 flex: 0 1 auto(按内容收缩,让「清除全部」紧跟在最后一个 chip 后面)之后,
// 列表自己的宽度只跟着内容走 —— 视口变宽时它不变,盯着它的 ResizeObserver 永远不触发,折起来的 chip 回不来。
// jsdom 没有真实布局:这里用 offsetTop 桩模拟「一行放得下几个」,用 ResizeObserver 桩模拟「哪个元素真的变了宽」
// (视口变宽 = chips 行容器变宽,列表本身不变),验证组件盯的是行容器、且「宽度没变不重量」的守卫还在。
// 真实布局只能在浏览器里验:npm run dev 后打开 /prototype.html?m=3,用 4 个条件把视口 1440 → 1000(折成「+2」)→ 1440,应恢复成 4 个 chip。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import FilterChips from '../src/FilterChips.vue'
import { defaultLabels } from '../src/labels'
import type { ChipItem } from '../src/filterChips'

class ResizeObserverStub {
  static instances: ResizeObserverStub[] = []
  targets: Element[] = []
  constructor(public cb: ResizeObserverCallback) {
    ResizeObserverStub.instances.push(this)
  }
  observe(el: Element) {
    this.targets.push(el)
  }
  unobserve(el: Element) {
    this.targets = this.targets.filter((t) => t !== el)
  }
  disconnect() {
    this.targets = []
  }
}

/** 模拟「el 的宽度变成 width」:只通知真正在盯 el 的 observer(与浏览器一致)。 */
function resize(el: Element, width: number) {
  for (const o of ResizeObserverStub.instances) {
    if (o.targets.includes(el)) {
      o.cb(
        [{ target: el, contentRect: { width } as DOMRectReadOnly } as ResizeObserverEntry],
        o as unknown as ResizeObserver,
      )
    }
  }
}

/** 第一行放得下几个 tag(含「+N」);超出的 tag offsetTop = 30(折到第二行)。 */
let perRow = Number.POSITIVE_INFINITY
const realOffsetTop = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetTop')!

async function settle() {
  for (let i = 0; i < 10; i++) await nextTick()
}

const items: ChipItem[] = [
  { key: 'a', index: 0, text: 'A contains 1' },
  { key: 'b', index: 0, text: 'B contains 2' },
  { key: 'c', index: 0, text: 'C contains 3' },
  { key: 'd', index: 0, text: 'D contains 4' },
]

describe('FilterChips:容器变宽后折叠的 chip 重新展开(final review fix)', () => {
  beforeEach(() => {
    ResizeObserverStub.instances = []
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    Object.defineProperty(HTMLElement.prototype, 'offsetTop', {
      configurable: true,
      get(this: HTMLElement) {
        if (!this.classList.contains('smart-table-chip') || !this.parentElement) return 0
        const tags = Array.from(this.parentElement.children).filter((el) =>
          el.classList.contains('smart-table-chip'),
        )
        return tags.indexOf(this) < perRow ? 0 : 30
      },
    })
  })
  afterEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'offsetTop', realOffsetTop)
    vi.unstubAllGlobals()
    perRow = Number.POSITIVE_INFINITY
  })

  const shownTexts = (w: ReturnType<typeof mount>) =>
    w.findAll('.smart-table-chips__list > .smart-table-chip').map((c) => c.text())

  it('ResizeObserver 盯的是 chips 行容器(.smart-table-chips),不是按内容收缩的列表', async () => {
    const wrapper = mount(FilterChips, {
      props: { items, labels: defaultLabels },
      attachTo: document.body,
    })
    await settle()
    const targets = ResizeObserverStub.instances.flatMap((o) => o.targets)
    expect(targets).toContain(wrapper.find('.smart-table-chips').element)
    expect(targets).not.toContain(wrapper.find('.smart-table-chips__list').element)
    wrapper.unmount()
  })

  it('窄 → 折成「+N」;行容器变宽 → 全部展开;宽度没变不重量;再变窄 → 重新折叠', async () => {
    perRow = 2 // 窄:一行只放得下 2 个 tag
    const wrapper = mount(FilterChips, {
      props: { items, labels: defaultLabels },
      attachTo: document.body,
    })
    await settle()
    const row = wrapper.find('.smart-table-chips').element
    resize(row, 1000)
    await settle()
    expect(shownTexts(wrapper)).toEqual(['A contains 1', '+3'])

    perRow = Number.POSITIVE_INFINITY // 视口变宽:行容器宽了,一行放得下全部
    resize(row, 1440)
    await settle()
    expect(shownTexts(wrapper)).toEqual([
      'A contains 1',
      'B contains 2',
      'C contains 3',
      'D contains 4',
    ])
    expect(wrapper.find('.smart-table-chip--more').exists()).toBe(false)

    // 同一宽度再通知一次(如测量时行高变化触发的回调):不重量,显示不变
    perRow = 2
    resize(row, 1440)
    await settle()
    expect(shownTexts(wrapper)).toHaveLength(4)

    // 宽度真的变了才重量
    resize(row, 1000)
    await settle()
    expect(shownTexts(wrapper)).toEqual(['A contains 1', '+3'])
    wrapper.unmount()
  })
})
