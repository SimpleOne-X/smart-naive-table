// @vitest-environment jsdom
// 模式 2 条件构造器(search: { container: 'table' })接线:容器解析、数据通路(请求形状 / @search / @reset / 本地过滤)、chips 默认开、窄档、与列头漏斗共用过滤态
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import SmartTable from '../src/SmartTable.vue'
import FilterChips from '../src/FilterChips.vue'
import ConditionBar from '../src/ConditionBar.vue'
import type { BuilderDraft } from '../src/conditionBuilder'
import type { SmartTableColumn } from '../src/types'

interface Row {
  id: number
  name: string
  code: string
  amount: number
}
const rows: Row[] = [
  { id: 1, name: 'alice', code: 'A1', amount: 10 },
  { id: 2, name: 'bob', code: 'B2', amount: 200 },
  { id: 3, name: 'carol', code: 'A3', amount: 300 },
]
const columns: SmartTableColumn<unknown>[] = [
  { key: 'name', title: '名称', search: true }, // 只写 search:进构造器,没有漏斗
  { key: 'code', title: '编码', search: true, filter: true }, // 两个都写:构造器与漏斗共用过滤态
  { key: 'amount', title: '金额', search: { type: 'number' } },
  { key: 'plain', title: '没有 search' },
]
const T2 = { container: 'table' as const }

const mounted: VueWrapper[] = []
const fetcher = () =>
  vi.fn(async (_p: Record<string, unknown>) => ({ items: rows, total: rows.length }))
function mountTable(props: Record<string, unknown> = {}, opts: Record<string, unknown> = {}) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const w = mount(SmartTable, {
    props: { columns, rowKey: 'id', search: T2, pagination: false, ...props },
    attachTo: host,
    ...opts,
  })
  mounted.push(w)
  return w
}
const mainInput = () =>
  document.querySelector<HTMLInputElement>('.smart-table-cond__main input.n-input__input-el')!
const type = async (el: HTMLInputElement, value: string) => {
  el.value = value
  el.dispatchEvent(new Event('input', { bubbles: true }))
  await nextTick()
}
const btn = (text: string) =>
  [...document.querySelectorAll<HTMLElement>('.smart-table-cond__main > .n-button')].find(
    (b) => b.textContent!.trim() === text,
  )!
const click = async (el: Element) => {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  await flushPromises()
}
const chipTexts = () =>
  [...document.querySelectorAll('.smart-table-chip:not(.smart-table-chip--more)')].map((c) =>
    c.textContent!.trim(),
  )
const lastParams = (f: ReturnType<typeof fetcher>) => f.mock.calls.at(-1)![0]

// 窄档要靠根元素宽度:jsdom 没有 ResizeObserver,换一个能手动触发的桩(同 tests/SmartTable.test.ts 的分页窄档用例)
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

beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
})
afterEach(() => {
  while (mounted.length) mounted.pop()!.unmount()
  document.body.innerHTML = ''
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('container × layout 的解析与渲染', () => {
  const search = (cfg: Record<string, unknown>) => mountTable({ data: rows, search: cfg })
  const has = (sel: string) => !!document.querySelector(sel)

  it("默认 / container: 'card':独立搜索卡片 + 网格,没有构造器", () => {
    search({})
    expect(has('.smart-table-search')).toBe(true)
    expect(has('.smart-table-cond')).toBe(false)
  })

  it("旧写法 layout: 'inline'(没写 container)= 'none':内联表单,没有卡片、没有构造器(2.1.1 行为不变)", () => {
    search({ layout: 'inline' })
    expect(has('.smart-table-search-inline')).toBe(true)
    expect(has('.smart-table-search')).toBe(false)
    expect(has('.smart-table-cond')).toBe(false)
  })

  it("container: 'none':内联表单", () => {
    search({ container: 'none' })
    expect(has('.smart-table-search-inline')).toBe(true)
  })

  it("container: 'table':构造器进工具栏,没有搜索卡片;container 优先于 layout(同时写 layout: 'inline' 仍是构造器)", () => {
    search({ container: 'table', layout: 'inline' })
    expect(has('.smart-table-cond__main')).toBe(true)
    expect(has('.smart-table-search')).toBe(false)
    expect(has('.smart-table-search-inline')).toBe(false)
  })

  it("container: 'card' + layout: 'inline' → container 赢:卡片 + 网格", () => {
    search({ container: 'card', layout: 'inline' })
    expect(has('.smart-table-search')).toBe(true)
    expect(has('.smart-table-search-inline')).toBe(false)
  })

  it('search: false → 什么搜索区都没有(含模式 2)', () => {
    mountTable({ data: rows, search: false })
    expect(has('.smart-table-cond')).toBe(false)
    expect(has('.smart-table-search')).toBe(false)
  })

  it('没有任何声明 search 的列 → 没有构造器,工具栏原样', () => {
    mountTable({
      data: rows,
      columns: [{ key: 'name', title: 'n' }] as SmartTableColumn<unknown>[],
    })
    expect(has('.smart-table-cond')).toBe(false)
  })

  it('toolbar: false 时模式 2 的构造器仍在(它是搜索区,不是内置图标)', () => {
    mountTable({ data: rows, toolbar: false })
    expect(has('.smart-table-cond__main')).toBe(true)
  })

  it('字段候选 = 声明了 search 的列(含只写 search 的):主行字段下拉的选项', () => {
    mountTable({ data: rows })
    expect(document.querySelectorAll('.smart-table-cond__main .n-select').length).toBeGreaterThan(0)
    // 漏斗只挂在写了 filter 的列上
    expect(
      document.querySelector('th[data-col-key="code"] .smart-table-filter-trigger'),
    ).not.toBeNull()
    expect(document.querySelector('th[data-col-key="name"] .smart-table-filter-trigger')).toBeNull()
  })
})

describe('数据通路:搜索 / 重置 / @search / 请求形状(远程)', () => {
  it('敲字不提交;点「搜索」才请求:filters 带 field / logic / conditions,回第 1 页;没有扁平搜索键', async () => {
    const f = fetcher()
    mountTable({ fetcher: f })
    await flushPromises()
    expect(f).toHaveBeenCalledTimes(1)
    expect(lastParams(f)).not.toHaveProperty('filters')

    await type(mainInput(), 'ali')
    expect(f).toHaveBeenCalledTimes(1) // 只改草稿
    await click(btn('Search'))
    expect(f).toHaveBeenCalledTimes(2)
    expect(lastParams(f)).toMatchObject({
      page: 1,
      filters: [
        { field: 'name', logic: 'and', conditions: [{ action: 'contains', value: 'ali' }] },
      ],
    })
    expect(lastParams(f)).not.toHaveProperty('name') // 模式 2 不发扁平参数
  })

  it('@search 的载荷 = 序列化后的条件(与随后的请求一致);回车(值输入框 keyup Enter)等价点「搜索」', async () => {
    const f = fetcher()
    const w = mountTable({ fetcher: f })
    await flushPromises()
    await type(mainInput(), 'bob')
    mainInput().dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }))
    await flushPromises()
    expect(f).toHaveBeenCalledTimes(2)
    expect(w.emitted('search')![0][0]).toEqual({
      filters: [
        { field: 'name', logic: 'and', conditions: [{ action: 'contains', value: 'bob' }] },
      ],
    })
  })

  it('没有任何变化再点「搜索」:仍然重查一次(与模式 1 的「点搜索总是重查」一致),且 @search 仍发出', async () => {
    const f = fetcher()
    const w = mountTable({ fetcher: f })
    await flushPromises()
    await type(mainInput(), 'ali')
    await click(btn('Search'))
    await click(btn('Search'))
    expect(f).toHaveBeenCalledTimes(3)
    expect(w.emitted('search')).toHaveLength(2)
  })

  it('一次「搜索」提交多个字段:filterChange 只发一次(key 为空串 = 批量),远程只重查一次,filters 带两个字段', async () => {
    const f = fetcher()
    const w = mountTable({ fetcher: f })
    await flushPromises()
    // 草稿里有两个字段的条件(面板里加行再换字段的结果;这里直接让构造器发出 update:draft,免得在 jsdom 里点 NSelect)
    const draft: BuilderDraft = {
      rows: [
        { field: 'name', action: 'contains', value: 'ali' },
        { field: 'amount', action: 'gt', value: 100 },
      ],
      logic: {},
    }
    w.findComponent(ConditionBar).vm.$emit('update:draft', draft)
    await nextTick()
    await click(btn('Search'))
    expect(w.emitted('filterChange')).toHaveLength(1)
    expect(w.emitted('filterChange')![0][0]).toBe('')
    expect(f).toHaveBeenCalledTimes(2) // 首次 + 这一次,不是每个字段各查一次
    expect((lastParams(f).filters as Array<{ field: string }>).map((x) => x.field).sort()).toEqual([
      'amount',
      'name',
    ])
  })

  it('「重置」:清空构造器条件并重查,发 @reset;主行值回到空', async () => {
    const f = fetcher()
    const w = mountTable({ fetcher: f })
    await flushPromises()
    await type(mainInput(), 'ali')
    await click(btn('Search'))
    expect(lastParams(f)).toHaveProperty('filters')
    await click(btn('Reset'))
    expect(f).toHaveBeenCalledTimes(3)
    expect(lastParams(f)).not.toHaveProperty('filters')
    expect(w.emitted('reset')).toHaveLength(1)
    expect(mainInput().value).toBe('')
  })

  it('「重置」恢复 search.defaultValue(模式 1 的扁平标量 → 一条初始条件),它也进首次请求', async () => {
    const f = fetcher()
    const cols: SmartTableColumn<unknown>[] = [
      { key: 'name', title: '名称', search: { defaultValue: 'al' } },
    ]
    mountTable({ fetcher: f, columns: cols })
    await flushPromises()
    expect(lastParams(f)).toMatchObject({
      filters: [{ field: 'name', conditions: [{ action: 'contains', value: 'al' }] }],
    })
    await type(mainInput(), 'zzz')
    await click(btn('Search'))
    await click(btn('Reset'))
    expect(lastParams(f)).toMatchObject({
      filters: [{ field: 'name', conditions: [{ action: 'contains', value: 'al' }] }],
    })
  })

  it('自定义 filterSerializer 照样接管序列化(模式 2 不改请求形状的出口)', async () => {
    const f = fetcher()
    mountTable({
      fetcher: f,
      filterSerializer: (s: Record<string, unknown>) => ({ q: Object.keys(s).join(',') }),
    })
    await flushPromises()
    await type(mainInput(), 'ali')
    await click(btn('Search'))
    expect(lastParams(f)).toMatchObject({ q: 'name' })
  })
})

describe('静态 data:只写 search 的列也能本地过滤', () => {
  it('搜索 → 表格只剩命中行;重置 → 恢复全部', async () => {
    const w = mountTable({ data: rows })
    const names = () =>
      [...document.querySelectorAll('tbody td[data-col-key="name"]')].map((e) =>
        e.textContent!.trim(),
      )
    expect(names()).toEqual(['alice', 'bob', 'carol'])
    await type(mainInput(), 'ar') // carol
    await click(btn('Search'))
    await flushPromises()
    expect(names()).toEqual(['carol'])
    await click(btn('Reset'))
    await flushPromises()
    expect(names()).toEqual(['alice', 'bob', 'carol'])
    expect(w.emitted('search')).toHaveLength(1)
  })
})

describe('已生效条件 chips:模式 2 默认开(B10)', () => {
  const setFilter = (w: VueWrapper, key: string, ...vals: string[]) =>
    (w.vm as unknown as { setFilter: (k: string, v: unknown) => void }).setFilter(key, {
      logic: 'and',
      conditions: vals.map((v) => ({ action: 'contains', value: v })),
    })

  it('模式 2 默认开;filterChips: false 关;模式 1 默认关(P0 行为不变)', async () => {
    const w = mountTable({ data: rows })
    setFilter(w, 'name', 'a', 'o') // 同字段 2 条
    await nextTick()
    expect(w.findComponent(FilterChips).exists()).toBe(true)
    w.unmount()
    mounted.pop()

    const off = mountTable({ data: rows, filterChips: false })
    setFilter(off, 'name', 'a', 'o')
    await nextTick()
    expect(off.findComponent(FilterChips).exists()).toBe(false)
    off.unmount()
    mounted.pop()

    const m1 = mountTable({ data: rows, search: {} })
    ;(m1.vm as unknown as { setFilter: (k: string, v: unknown) => void }).setFilter('code', {
      logic: 'and',
      conditions: [{ action: 'contains', value: 'A' }],
    })
    await nextTick()
    expect(m1.findComponent(FilterChips).exists()).toBe(false)
  })

  it('宽 / 中档:只有 1 条、且是构造器主行里的那条 → 不画(主行已显示);≥ 2 条才画', async () => {
    const w = mountTable({ data: rows })
    setFilter(w, 'name', 'a')
    await nextTick()
    expect(chipTexts()).toEqual([])
    setFilter(w, 'name', 'a', 'o')
    await nextTick()
    expect(chipTexts()).toHaveLength(2)
  })

  it('宽 / 中档:1 条且不是构造器字段(孤儿键)→ 照常画(主行里看不到它)', async () => {
    const w = mountTable({ data: rows })
    setFilter(w, 'ghost', 'x')
    await nextTick()
    expect(chipTexts()).toHaveLength(1)
  })

  it('点构造器字段的 chip → 多条件面板打开(aria-expanded);删 chip 的 × → 过滤态与主行同步', async () => {
    const w = mountTable({ data: rows })
    setFilter(w, 'name', 'a', 'o')
    await nextTick()
    const chip = document.querySelector<HTMLElement>(
      '.smart-table-chip:not(.smart-table-chip--more)',
    )!
    chip.click()
    await flushPromises()
    expect(
      document.querySelector('.smart-table-cond__more button')!.getAttribute('aria-expanded'),
    ).toBe('true')
    document
      .querySelector<HTMLElement>('.smart-table-chip:not(.smart-table-chip--more) .n-base-close')!
      .click()
    await flushPromises()
    const state = (w.vm as unknown as { filters: Record<string, { conditions: unknown[] }> })
      .filters
    expect(state.name.conditions).toHaveLength(1)
  })
})

describe('与列头漏斗共用同一份过滤态', () => {
  it('漏斗(setFilter)写的条件 → 构造器主行同步(字段 / 值);构造器搜索 → 漏斗变激活', async () => {
    const w = mountTable({ data: rows })
    ;(w.vm as unknown as { setFilter: (k: string, v: unknown) => void }).setFilter('code', {
      logic: 'and',
      conditions: [{ action: 'contains', value: 'A' }],
    })
    await flushPromises()
    expect(mainInput().value).toBe('A') // 第 1 行 = code 的条件(构造器字段顺序里 name 没有生效条件,code 排第一)
    expect(
      document.querySelector('th[data-col-key="code"] .smart-table-filter-trigger--active'),
    ).not.toBeNull()
  })

  it('构造器搜索 code → 漏斗激活;列头只写 filter 的键(不属于构造器)的条件不被「重置」清掉', async () => {
    const cols: SmartTableColumn<unknown>[] = [
      ...columns,
      { key: 'hdr', title: '只有漏斗', filter: true },
    ]
    const w = mountTable({ data: rows, columns: cols })
    const v = w.vm as unknown as {
      setFilter: (k: string, val: unknown) => void
      filters: Record<string, unknown>
    }
    v.setFilter('hdr', { logic: 'and', conditions: [{ action: 'contains', value: 'x' }] })
    await flushPromises()
    await type(mainInput(), 'ali')
    await click(btn('Search'))
    expect(Object.keys(v.filters).sort()).toEqual(['hdr', 'name'])
    await click(btn('Reset'))
    expect(Object.keys(v.filters)).toEqual(['hdr']) // 构造器字段清了,漏斗管的 hdr 还在
  })

  it('过滤态在外面变了但构造器字段没变(别的列漏斗改了)→ 主行里还没提交的输入不被冲掉', async () => {
    const cols: SmartTableColumn<unknown>[] = [
      ...columns,
      { key: 'hdr', title: '只有漏斗', filter: true },
    ]
    const w = mountTable({ data: rows, columns: cols })
    await type(mainInput(), 'unsent')
    ;(w.vm as unknown as { setFilter: (k: string, v: unknown) => void }).setFilter('hdr', {
      logic: 'and',
      conditions: [{ action: 'contains', value: 'x' }],
    })
    await flushPromises()
    expect(mainInput().value).toBe('unsent')
  })
})

describe('窄档(根元素宽 < 600):输入框 + 筛选', () => {
  async function narrowTable(width: number, props: Record<string, unknown> = {}) {
    RO.instances = []
    vi.stubGlobal('ResizeObserver', RO)
    const w = mountTable({ data: rows, ...props })
    Object.defineProperty(w.element, 'clientWidth', { value: width, configurable: true })
    RO.instances.forEach((i) => i.cb())
    await nextTick()
    return w
  }

  it('宽 ≥ 1280 / 中 600–1279:字段 + 比较符 + 值;< 600:只有输入框 + 「筛选」,没有字段 / 比较符下拉和「搜索」按钮', async () => {
    const wide = await narrowTable(1400)
    expect(document.querySelector('.smart-table-cond--wide')).not.toBeNull()
    wide.unmount()
    mounted.pop()
    const mid = await narrowTable(900)
    expect(document.querySelector('.smart-table-cond--mid')).not.toBeNull()
    mid.unmount()
    mounted.pop()
    await narrowTable(500)
    expect(document.querySelector('.smart-table-cond--narrow')).not.toBeNull()
    expect(document.querySelector('.smart-table-cond__field')).toBeNull()
    expect(document.querySelector('.smart-table-cond--narrow button')!.textContent!.trim()).toBe(
      'Filter',
    )
    expect(
      document.querySelector('.smart-table-cond--narrow input')!.getAttribute('placeholder'),
    ).toBe('Search 名称') // 渲染期求值的 {field}
  })

  it('窄档回车 = 搜索;窄档 chips 有 1 条就画', async () => {
    const f = fetcher()
    const w = await narrowTable(500, { data: undefined, fetcher: f })
    await flushPromises()
    const input = document.querySelector<HTMLInputElement>('.smart-table-cond--narrow input')!
    await type(input, 'ali')
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }))
    await flushPromises()
    expect(lastParams(f)).toMatchObject({ filters: [{ field: 'name' }] })
    expect(chipTexts()).toHaveLength(1)
    expect(document.querySelector('.smart-table-cond__badge')!.textContent!.trim()).toBe('1')
    expect(w.emitted('search')).toHaveLength(1)
  })

  it('窄档批量栏:根上带 --batch-narrow(CSS 排成「已选 N 项 | 取消选择」一行 + 宿主按钮整行),取消选择按钮是 large(40px)', async () => {
    RO.instances = []
    vi.stubGlobal('ResizeObserver', RO)
    const w = mountTable(
      { columns: [{ type: 'selection' }, ...columns], data: rows },
      { attrs: { checkedRowKeys: [1] }, slots: { batch: () => 'x' } },
    )
    Object.defineProperty(w.element, 'clientWidth', { value: 500, configurable: true })
    RO.instances.forEach((i) => i.cb())
    await nextTick()
    expect(document.querySelector('.smart-table-toolbar--batch-narrow')).not.toBeNull()
    // 官方 NButton 的尺寸在内联 CSS 变量里:large = heightLarge 40px(medium 34px)
    expect(
      document.querySelector('.smart-table-batch > .n-button')!.getAttribute('style'),
    ).toContain('--n-height: 40px')
  })

  it('窄档点「筛选」→ 抽屉打开(aria-expanded);抽屉里是同一份多条件面板(堆叠排布)', async () => {
    await narrowTable(500)
    document.querySelector<HTMLElement>('.smart-table-cond--narrow button')!.click()
    await flushPromises()
    await new Promise((r) => setTimeout(r, 60))
    expect(
      document.querySelector('.smart-table-cond--narrow button')!.getAttribute('aria-expanded'),
    ).toBe('true')
    expect(document.querySelector('.smart-table-cond-panel--stack')).not.toBeNull()
  })
})
