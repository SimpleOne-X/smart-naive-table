// @vitest-environment jsdom
// 可编辑表格的 select-table 编辑器(外部数据 / 主数据选择,Blazor SelectTable 式):
// 点开 = 弹出面板(搜索条 + 嵌套的 SmartTable + 分页),点一行 = 选中并关闭,fill 把其它列一并填上(普通草稿编辑、一步撤销)。
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// jsdom 没有布局:面板里的表格是 fillHeight(vueuc VirtualList),靠 ResizeObserver 拿视口高度才知道渲染哪几行(见 SmartSelectTable.test.ts)。
vi.hoisted(() => {
  class RO {
    constructor(private cb: (entries: unknown[]) => void) {}
    observe(el: Element) {
      const rect = { width: 800, height: 360 }
      queueMicrotask(() =>
        this.cb([
          { target: el, contentRect: rect, borderBoxSize: [{ blockSize: 360, inlineSize: 800 }] },
        ]),
      )
    }
    unobserve() {}
    disconnect() {}
  }
  ;(window as unknown as { ResizeObserver: unknown }).ResizeObserver = RO
})
import { nextTick } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import SmartTable from '../src/SmartTable.vue'
import { inferEditorInfo, validateEdit } from '../src/index'
import { defaultLabels } from '../src/labels'
import type { SmartTableColumn } from '../src/types'

interface Row {
  id: number
  name: string
  center: string
  setup: number
}
const rows = (): Row[] => [
  { id: 1, name: 'alpha', center: 'c0', setup: 1 },
  { id: 2, name: 'beta', center: 'c0', setup: 2 },
]
interface Master {
  code: string
  name: string
  center: string
  setup: number
}
const MASTER: Master[] = Array.from({ length: 25 }, (_, i) => ({
  code: `OP${String(i + 1).padStart(3, '0')}`,
  name: i === 3 ? '精车外圆' : `工序${i + 1}`,
  center: `中心${(i % 3) + 1}`,
  setup: (i + 1) * 5,
}))
const pickerCols: SmartTableColumn<Master>[] = [
  { key: 'code', title: 'Code' },
  { key: 'name', title: 'Name' },
  { key: 'center', title: 'Center' },
  { key: 'setup', title: 'Setup' },
]
const editorProps = (extra: Record<string, unknown> = {}) => ({
  columns: pickerCols,
  data: MASTER,
  valueKey: 'code',
  labelKey: 'name',
  fill: (p: Master) => ({ center: p.center, setup: p.setup }),
  pageSize: 10,
  pageSizes: [10, 50],
  ...extra,
})
const columns = (props: Record<string, unknown> = editorProps()): SmartTableColumn<unknown>[] => [
  { key: 'name', title: 'Name', rules: { required: true }, editorProps: props },
  { key: 'center', title: 'Center' },
  { key: 'setup', title: 'Setup' },
]

beforeAll(() => {
  Element.prototype.scrollTo ??= () => {}
})
beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
})
let wrapper: VueWrapper | null = null
function mountTable(
  cols = columns(),
  attrs: Record<string, unknown> = {},
  props: Record<string, unknown> = {},
): VueWrapper {
  wrapper = mount(SmartTable, {
    props: {
      columns: cols,
      data: rows(),
      rowKey: 'id',
      pagination: false,
      editable: true,
      ...props,
    },
    attrs,
    attachTo: document.body,
  })
  return wrapper
}
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})
const td = (w: VueWrapper, id: number, key: string) => w.find(`td[data-xc="${id}|${key}"]`)
const press = (key: string, init: KeyboardEventInit = {}, target: Element = document.body) =>
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }),
  )
const settle = async () => {
  for (let i = 0; i < 4; i++) await flushPromises()
}
async function open(w: VueWrapper, id = 1, key = 'name') {
  await td(w, id, key).trigger('click')
  await td(w, id, key).trigger('click')
  await settle()
}
const panel = () => document.body.querySelector<HTMLElement>('.smart-table-xpick')
const pRows = () => [...(panel()?.querySelectorAll<HTMLElement>('.n-data-table-tbody tr') ?? [])]
const search = async (text: string) => {
  const input = panel()!.querySelector<HTMLInputElement>('.smart-table-xpick-search input')!
  input.value = text
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await nextTick()
  await settle()
}
const saveBtn = (w: VueWrapper) =>
  w.findAll('.smart-table-toolbar-actions button').find((b) => b.text().startsWith('Save changes'))

describe('推断:外部数据 → select-table;小枚举仍是下拉', () => {
  it('列声明了 editorProps.data(或 fetcher)+ columns 且没有显式 editor → select-table', () => {
    const info = (col: Record<string, unknown>) =>
      inferEditorInfo({ key: 'f', ...col } as never, [])
    expect(info({ editorProps: editorProps() })).toEqual({
      kind: 'select-table',
      via: 'editorProps',
    })
    expect(
      info({ editorProps: { columns: pickerCols, fetcher: async () => ({ items: [], total: 0 }) } })
        .kind,
    ).toBe('select-table')
    expect(info({ editorProps: { columns: pickerCols } }).kind).toBe('input') // 没有数据源:不推断
    expect(info({ editorProps: { data: MASTER } }).kind).toBe('input') // 没有 columns:不推断
  })

  it('显式 editor 优先;静态 options 仍是下拉;render 的列仍不可编辑', () => {
    const o = [{ label: 'a', value: 'a' }]
    expect(
      inferEditorInfo({ key: 'f', editor: 'input', editorProps: editorProps() } as never, []).kind,
    ).toBe('input')
    expect(
      inferEditorInfo({ key: 'f', options: o, editorProps: editorProps() } as never, []).kind,
    ).toBe('select-table')
    expect(inferEditorInfo({ key: 'f', options: o } as never, []).kind).toBe('select')
    expect(
      inferEditorInfo({ key: 'f', render: () => 'x', editorProps: editorProps() } as never, [])
        .kind,
    ).toBeNull()
    expect(inferEditorInfo({ key: 'f', editor: 'select-table' } as never, []).kind).toBe(
      'select-table',
    )
  })

  it('校验:当字符串处理;必填的空 → 请选择', () => {
    const lab = { labels: defaultLabels, field: 'Name', row: {} }
    expect(validateEdit('select-table', 'x', { ...lab, col: {} })).toEqual({ ok: true, value: 'x' })
    expect(
      validateEdit('select-table', '', { ...lab, col: { rules: { required: true } } }),
    ).toEqual({
      ok: false,
      message: 'Please select Name',
    })
  })

  it('表格里:单元格 data-xk 是 select-table', () => {
    const w = mountTable()
    expect(w.find('td[data-col-key="name"]').attributes('data-xk')).toBe('select-table')
  })
})

describe('打开 / 搜索 / 选中', () => {
  it('选中再点 = 弹出面板:一个搜索框(自动聚焦,没有按钮)+ 嵌套表格(editorProps.pageSize)+ 共 N 条', async () => {
    const w = mountTable()
    await open(w)
    expect(panel()).not.toBeNull()
    expect(document.activeElement).toBe(panel()!.querySelector('.smart-table-xpick-search input'))
    expect([...panel()!.querySelectorAll('button')].map((b) => b.textContent?.trim())).toEqual([])
    expect(panel()!.querySelector<HTMLInputElement>('input')!.placeholder).toBe(
      'Code/Name/Center/Setup',
    )
    expect(pRows()).toHaveLength(10)
    expect(panel()!.textContent).toContain('Total 25')
    expect(panel()!.querySelectorAll('thead th')).toHaveLength(4)
  })

  it('搜索:实时过滤,对所有字符串列做包含(忽略大小写);清空还原', async () => {
    const w = mountTable()
    await open(w)
    await search('精车')
    expect(pRows()).toHaveLength(1)
    expect(pRows()[0].textContent).toContain('OP004')
    expect(panel()!.textContent).toContain('Total 1')
    await search('op01') // 编码也参与
    expect(pRows()).toHaveLength(10)
    await search('')
    expect(pRows()).toHaveLength(10)
    expect(panel()!.textContent).toContain('Total 25')
    expect(panel()!.querySelector('input')!.value).toBe('')
  })

  it('searchKeys 限定搜索的列', async () => {
    const w = mountTable(columns(editorProps({ searchKeys: ['code'] })))
    await open(w)
    await search('精车')
    expect(pRows()).toHaveLength(0)
    await search('OP004')
    expect(pRows()).toHaveLength(1)
  })

  it('点一行 = 选中并关闭:单元格值 = labelKey 的值,进草稿(脏标记 + 保存修改)', async () => {
    const w = mountTable()
    await open(w)
    pRows()[3].click()
    await settle()
    expect(panel()).toBeNull()
    expect(td(w, 1, 'name').text()).toBe('精车外圆')
    expect(td(w, 1, 'name').classes()).toContain('smart-table-xd')
    expect(saveBtn(w)!.text()).toContain('Save changes')
  })

  it('再次打开时:已选中的那一行高亮', async () => {
    const w = mountTable()
    await open(w)
    pRows()[3].click()
    await settle()
    await td(w, 1, 'name').trigger('click')
    await td(w, 1, 'name').trigger('click')
    await settle()
    const hit = pRows().filter((r) => r.classList.contains('smart-table-row--active'))
    expect(hit).toHaveLength(1)
    expect(hit[0].textContent).toContain('OP004')
  })

  it('分页:点下一页换一批行(每页 10)', async () => {
    const w = mountTable()
    await open(w)
    const first = pRows()[0].textContent
    const next = panel()!.querySelectorAll<HTMLElement>('.n-pagination .n-pagination-item')
    next[next.length - 1].click()
    await settle()
    expect(pRows()[0].textContent).not.toBe(first)
    expect(pRows()[0].textContent).toContain('OP011')
  })
})

describe('fill:一并填其它列(普通草稿编辑)', () => {
  it('选中后 fill 返回的格各自进草稿(脏标记),保存载荷里一行三处改动', async () => {
    let payload: { changes: { updated: { changes: Record<string, unknown> }[] } } | undefined
    const w = mountTable(columns(), { onSave: (p: typeof payload) => (payload = p) })
    await open(w)
    pRows()[3].click()
    await settle()
    expect(td(w, 1, 'center').text()).toBe('中心1')
    expect(td(w, 1, 'setup').text()).toBe('20')
    for (const k of ['name', 'center', 'setup'])
      expect(td(w, 1, k).classes()).toContain('smart-table-xd')
    expect((w.vm as unknown as { dirtyCount: number }).dirtyCount).toBe(3)
    await saveBtn(w)!.trigger('click')
    await settle()
    expect(Object.keys(payload!.changes.updated[0].changes).sort()).toEqual([
      'center',
      'name',
      'setup',
    ])
  })

  it('一次选择 = 一步撤销(Ctrl+Z 全部还原)', async () => {
    const w = mountTable()
    await open(w)
    pRows()[3].click()
    await settle()
    press('z', { ctrlKey: true })
    await settle()
    expect(td(w, 1, 'name').text()).toBe('alpha')
    expect(td(w, 1, 'center').text()).toBe('c0')
    expect((w.vm as unknown as { dirtyCount: number }).dirtyCount).toBe(0)
  })

  it('@cell-change 对每个变化的格各发一次', async () => {
    const onChange = vi.fn()
    const w = mountTable(columns(), { onCellChange: onChange })
    await open(w)
    pRows()[3].click()
    await settle()
    expect(onChange.mock.calls.map((c) => c[0].key).sort()).toEqual(['center', 'name', 'setup'])
  })

  it('fill 的值不合法(如数字列拿到文本):不应用任何改动,标红那一格并发 @invalid', async () => {
    const onInvalid = vi.fn()
    const w = mountTable(columns(editorProps({ fill: () => ({ setup: 'abc' }) })), { onInvalid })
    await open(w)
    pRows()[3].click()
    await settle()
    expect(td(w, 1, 'name').text()).toBe('alpha')
    expect(onInvalid.mock.calls[0][0]).toMatchObject({ key: 'setup' })
  })
})

describe('键盘', () => {
  it('Enter 在选中格上打开;面板里输入框已聚焦,输入 + Enter = 搜索;↓ 进入表格第一行,Enter 选中', async () => {
    const w = mountTable()
    await td(w, 1, 'name').trigger('click')
    press('Enter')
    await settle()
    expect(panel()).not.toBeNull()
    expect(document.activeElement).toBe(panel()!.querySelector('input'))
    await search('工序1')
    const before = pRows().length
    expect(before).toBeGreaterThan(1)
    press('ArrowDown', {}, panel()!.querySelector('input')!)
    await settle()
    expect(pRows()[0].classList.contains('smart-table-xpick-hi')).toBe(true)
    press('ArrowDown', {}, panel()!)
    await settle()
    expect(pRows()[1].classList.contains('smart-table-xpick-hi')).toBe(true)
    press('ArrowUp', {}, panel()!)
    press('Enter', {}, panel()!)
    await settle()
    expect(panel()).toBeNull()
    expect(td(w, 1, 'name').text()).toBe(MASTER.find((m) => m.name.includes('工序1'))!.name)
  })

  it('Esc:输入框里有搜索内容先清空搜索,再按一次关闭(不改值)', async () => {
    const w = mountTable()
    await open(w)
    await search('精车')
    press('Escape')
    await settle()
    expect(panel()).not.toBeNull()
    expect(pRows()).toHaveLength(10)
    expect(panel()!.querySelector('input')!.value).toBe('')
    press('Escape')
    await settle()
    expect(panel()).toBeNull()
    expect(td(w, 1, 'name').text()).toBe('alpha')
    expect(saveBtn(w)).toBeUndefined()
  })

  it('直接打字进入编辑:字符作为初始搜索词', async () => {
    const w = mountTable()
    await td(w, 1, 'name').trigger('click')
    press('精')
    await settle()
    expect(panel()!.querySelector('input')!.value).toBe('精')
    expect(pRows()).toHaveLength(1)
  })

  it('点面板外面 = 关闭(保持原值)', async () => {
    const w = mountTable()
    await open(w)
    await td(w, 2, 'center').trigger('click')
    await settle()
    expect(panel()).toBeNull()
    expect(td(w, 1, 'name').text()).toBe('alpha')
  })
})

describe('粘贴 / Delete', () => {
  const paste = (text: string) => {
    const ev = new Event('paste', { bubbles: true, cancelable: true })
    Object.defineProperty(ev, 'clipboardData', { value: { getData: () => text } })
    document.body.dispatchEvent(ev)
  }

  it('粘贴的文本必须是已有的名称(或 valueKey 编码):命中则取名称并同样 fill;不命中被拒、标红、@invalid', async () => {
    const onInvalid = vi.fn()
    const w = mountTable(columns(), { onInvalid })
    await td(w, 1, 'name').trigger('click')
    paste('OP004')
    await settle()
    expect(td(w, 1, 'name').text()).toBe('精车外圆')
    expect(td(w, 1, 'setup').text()).toBe('20') // fill 也生效
    press('z', { ctrlKey: true })
    await settle()
    expect(td(w, 1, 'name').text()).toBe('alpha')
    await td(w, 2, 'name').trigger('click')
    paste('不存在的工序')
    await settle()
    expect(td(w, 2, 'name').text()).toBe('beta')
    expect(td(w, 2, 'name').classes()).toContain('smart-table-xerr')
    expect(onInvalid).toHaveBeenCalledTimes(1)
  })

  it('只给 fetcher 的数据源:粘贴不做匹配,文本照收(不 fill)', async () => {
    const fetcher = vi.fn(async () => ({ items: MASTER.slice(0, 10), total: 25 }))
    const w = mountTable(
      columns({ columns: pickerCols, fetcher, valueKey: 'code', labelKey: 'name' }),
    )
    await td(w, 1, 'name').trigger('click')
    paste('随便什么')
    await settle()
    expect(td(w, 1, 'name').text()).toBe('随便什么')
  })

  it('Delete 清空(必填列拒绝)', async () => {
    const w = mountTable()
    await td(w, 1, 'name').trigger('click')
    press('Delete')
    await settle()
    expect(td(w, 1, 'name').classes()).toContain('smart-table-xerr')
    expect(td(w, 1, 'name').text()).toBe('alpha')
  })
})

describe('fetcher 数据源(远程)', () => {
  it('打开时请求第 1 页(page / pageSize),搜索词作为 keyword 参数,总数取返回的 total', async () => {
    const fetcher = vi.fn(async (p: { page: number; pageSize: number; keyword?: string }) => {
      const all = MASTER.filter((m) => !p.keyword || m.name.includes(p.keyword))
      return { items: all.slice((p.page - 1) * p.pageSize, p.page * p.pageSize), total: all.length }
    })
    const w = mountTable(
      columns({ columns: pickerCols, fetcher, valueKey: 'code', labelKey: 'name' }),
    )
    await open(w)
    expect(fetcher).toHaveBeenCalled()
    expect(fetcher.mock.calls[0][0]).toMatchObject({ page: 1, pageSize: 100 }) // 默认每页 100
    expect(pRows().length).toBeLessThan(25) // 虚拟滚动:只渲染视口里的几行
    expect(panel()!.textContent).toContain('Total 25')
    await search('精车')
    await new Promise((r) => setTimeout(r, 350)) // 远程:停手 300ms 后才发请求
    await settle()
    expect(fetcher.mock.calls.at(-1)![0]).toMatchObject({ keyword: '精车' })
    expect(pRows()).toHaveLength(1)
    pRows()[0].click()
    await settle()
    expect(td(w, 1, 'name').text()).toBe('精车外圆')
  })
})

describe('窄档抽屉', () => {
  it('抽屉里 select-table 字段是个按钮(显示当前值),点它在底部面板里打开同一个选择器;选中后表单值与 fill 一起更新', async () => {
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get: () => 400,
    })
    const w = mountTable(columns(), {}, { cardOnNarrow: true })
    await settle()
    await w.find('.smart-table-card-item').trigger('click')
    await settle()
    const trigger = [
      ...document.body.querySelectorAll<HTMLElement>('.n-drawer .smart-table-xpick-trigger'),
    ][0]
    expect(trigger).toBeTruthy()
    expect(trigger.textContent).toContain('alpha')
    trigger.click()
    await settle()
    expect(panel()).not.toBeNull()
    pRows()[3].click()
    await settle()
    expect(panel()).toBeNull()
    expect(trigger.textContent).toContain('精车外圆')
    const inputs = [...document.body.querySelectorAll<HTMLInputElement>('.n-drawer input')].map(
      (i) => i.value,
    )
    expect(inputs).toContain('中心1') // fill 的 center
    delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth
  })
})
