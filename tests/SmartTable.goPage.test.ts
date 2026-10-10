// @vitest-environment jsdom
// 实例方法 goPage(n)(本地模式 = 切页)必须同步库自己记的页码 localPage。
// 官方 NDataTable 的实例方法 page(n) 只走 doUpdatePage:改表格自己的页码、转发表格级回调,不经过分页组件的 onUpdatePage;
// 而 SmartTable 的 localPage 只在分页组件的 onUpdatePage 里更新 —— 于是 goPage 之后表格翻页了、localPage 还停在旧页:
//   · 窄档卡片列表(cardRows 按 localPage 自己切页)不翻页;
//   · 批量栏「本页全选」(pageRows 按 localPage)拿到的是旧页的行,勾错页。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { h, nextTick } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import SmartTable from '../src/SmartTable.vue'
import type { SmartTableColumn } from '../src/types'

interface Row {
  id: number
  no: string
}
const rows: Row[] = Array.from({ length: 5 }, (_, i) => ({ id: i + 1, no: `M${i + 1}` }))

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

const goPage = async (w: VueWrapper, n: number) => {
  await (w.vm as unknown as { goPage: (p: number) => Promise<unknown> }).goPage(n)
  await flushPromises()
}

describe('goPage(n) 与窄档卡片列表', () => {
  let wrapper: VueWrapper | undefined
  beforeEach(() => {
    document.body.innerHTML = ''
  })
  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    vi.unstubAllGlobals()
  })

  async function mountCards(props: Record<string, unknown> = {}) {
    RO.instances = []
    vi.stubGlobal('ResizeObserver', RO)
    const w = mount(SmartTable, {
      props: {
        columns: [{ key: 'no', title: '编码' }] as SmartTableColumn<unknown>[],
        data: rows,
        rowKey: 'id',
        cardOnNarrow: true,
        pagination: { pageSize: 2 },
        ...props,
      },
      attachTo: document.body,
    })
    Object.defineProperty(w.element, 'clientWidth', { value: 390, configurable: true })
    RO.instances.forEach((i) => i.cb())
    await nextTick()
    await flushPromises()
    return w
  }
  const titles = (w: VueWrapper) => w.findAll('.smart-table-card-title').map((t) => t.text())
  const pagerButtons = (w: VueWrapper) => w.findAll('.n-pagination-item--button')

  it('goPage(2) / goPage(3) / goPage(1):卡片列表跟着切到对应页', async () => {
    wrapper = await mountCards()
    expect(titles(wrapper)).toEqual(['M1', 'M2'])
    await goPage(wrapper, 2)
    expect(titles(wrapper)).toEqual(['M3', 'M4'])
    await goPage(wrapper, 3)
    expect(titles(wrapper)).toEqual(['M5'])
    await goPage(wrapper, 1)
    expect(titles(wrapper)).toEqual(['M1', 'M2'])
  })

  it('goPage 之后点分页的「下一页」接着翻(两边页码同步,不跳页)', async () => {
    wrapper = await mountCards()
    await goPage(wrapper, 2)
    const buttons = pagerButtons(wrapper)
    await buttons[buttons.length - 1].trigger('click')
    await flushPromises()
    expect(titles(wrapper)).toEqual(['M5'])
  })

  it('页码越界:夹到最后一页(同官方本地分页静默夹页)', async () => {
    wrapper = await mountCards()
    await goPage(wrapper, 99)
    expect(titles(wrapper)).toEqual(['M5'])
  })

  it('pagination: false 时 goPage 不报错、卡片仍是全部行', async () => {
    wrapper = await mountCards({ pagination: false })
    await goPage(wrapper, 2)
    expect(titles(wrapper)).toEqual(['M1', 'M2', 'M3', 'M4', 'M5'])
  })
})

describe('goPage(n) 与批量栏「本页全选」(表格模式)', () => {
  const cols: SmartTableColumn<unknown>[] = [{ type: 'selection' }, { key: 'no', title: '编码' }]
  const batchSlot = () => h('button', { class: 'host-batch-btn' }, '批量')
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('goPage(2) 之后,「本页」= 第 2 页的行(3、4):点半选的复选框并入 [3, 4],不是第 1 页的 1、2', async () => {
    const spy = vi.fn()
    const w = mount(SmartTable, {
      props: { columns: cols, data: rows, rowKey: 'id', pagination: { pageSize: 2 } },
      attrs: { checkedRowKeys: [3], 'onUpdate:checkedRowKeys': spy },
      slots: { batch: batchSlot as never },
      attachTo: document.body,
    })
    await goPage(w as never, 2)
    const box = w.find('.smart-table-batch-info .n-checkbox')
    // 第 2 页(3、4)里只勾了 3 → 半选;停在第 1 页口径时本页(1、2)一个没勾,也是半选,所以状态区分不出来,靠点击后的键集断言
    await box.trigger('click')
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0][0]).toEqual([3, 4])
    w.unmount()
  })
})
