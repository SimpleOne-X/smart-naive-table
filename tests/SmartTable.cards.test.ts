// @vitest-environment jsdom
// 「窄档卡片」(cardOnNarrow,规格 §5.8):容器宽 < 600 且开了 cardOnNarrow 时,表格主体换成卡片列表。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { h, nextTick } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { NButton } from 'naive-ui'
import SmartTable from '../src/SmartTable.vue'
import type { SmartTableColumn } from '../src/types'

interface Row {
  id: number
  no: string
  name: string
  amount: number
  status: string
}
const rows: Row[] = [
  { id: 1, no: 'M1', name: 'bolt', amount: 30, status: 'a' },
  { id: 2, no: 'M2', name: 'nut', amount: 10, status: 'b' },
  { id: 3, no: 'M3', name: 'pipe', amount: 20, status: 'a' },
]

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

const columns: SmartTableColumn<any>[] = [
  { key: 'no', title: '编码' },
  { key: 'name', title: '名称' },
  { key: 'amount', title: '金额', sorter: 'default', defaultSortOrder: 'ascend' },
  { key: 'status', title: '状态', hide: true },
  {
    key: 'ops',
    title: '操作',
    fixed: 'right',
    render: (row: Row) => h(NButton, { text: true, class: 'row-btn' }, () => `编辑${row.no}`),
  },
]

async function mountAt(width: number, props: Record<string, unknown> = {}, attrs = {}) {
  RO.instances = []
  vi.stubGlobal('ResizeObserver', RO)
  const w = mount(SmartTable, {
    props: { columns, data: rows, rowKey: 'id', cardOnNarrow: true, ...props },
    attrs,
    attachTo: document.body,
  })
  Object.defineProperty(w.element, 'clientWidth', { value: width, configurable: true })
  RO.instances.forEach((i) => i.cb())
  await nextTick()
  await flushPromises()
  return w
}

const items = (w: VueWrapper) => w.findAll('.smart-table-card-item')

describe('SmartTable cardOnNarrow', () => {
  let wrapper: VueWrapper | undefined
  beforeEach(() => {
    document.body.innerHTML = ''
  })
  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    vi.unstubAllGlobals()
  })

  it('默认不开:窄容器仍是表格,没有卡片列表(不改已发布用户的行为)', async () => {
    wrapper = await mountAt(390, { cardOnNarrow: undefined })
    expect(wrapper.find('.smart-table-cards').exists()).toBe(false)
    expect(wrapper.find('.n-data-table-wrapper').exists()).toBe(true)
  })

  it('开了:宽 390 渲染卡片;宽 900 回到表格', async () => {
    wrapper = await mountAt(390)
    expect(items(wrapper)).toHaveLength(3)
    Object.defineProperty(wrapper.element, 'clientWidth', { value: 900, configurable: true })
    RO.instances.forEach((i) => i.cb())
    await nextTick()
    expect(wrapper.find('.smart-table-cards').exists()).toBe(false)
  })

  it('零配置映射:第一列是标题,其余是「标签:值」,操作列在底部;列设置里隐藏的列(hide)卡片里也没有', async () => {
    wrapper = await mountAt(390)
    const first = items(wrapper)[0]
    // 本地模式按 amount 升序:M2(10) 在最前
    expect(first.find('.smart-table-card-title').text()).toBe('M2')
    const pairs = first.findAll('.smart-table-card-desc > div').map((d) => d.text())
    expect(pairs).toEqual(['名称nut', '金额10'])
    expect(first.find('.smart-table-card-act').text()).toBe('编辑M2')
    expect(first.text()).not.toContain('状态')
  })

  it('列上的 card: false / title / meta 覆盖默认映射', async () => {
    wrapper = await mountAt(390, {
      columns: [
        { key: 'no', title: '编码', card: 'meta' },
        { key: 'name', title: '名称', card: 'title' },
        { key: 'amount', title: '金额', card: false },
      ],
    })
    const first = items(wrapper)[0]
    expect(first.find('.smart-table-card-title').text()).toBe('bolt')
    expect(first.findAll('.smart-table-card-desc > div').map((d) => d.text())).toEqual(['编码M1'])
    expect(first.find('.smart-table-card-act').exists()).toBe(false)
  })

  it('点卡片 = rowClick;点卡片里的按钮不触发(沿用 D2 的忽略规则)', async () => {
    wrapper = await mountAt(390)
    const first = items(wrapper)[0]
    await first.find('.smart-table-card-title').trigger('click')
    expect(wrapper.emitted('rowClick')).toHaveLength(1)
    expect((wrapper.emitted('rowClick')![0] as [Row, number])[0].no).toBe('M2')
    await first.find('.row-btn').trigger('click')
    expect(wrapper.emitted('rowClick')).toHaveLength(1)
  })

  it('勾选框在卡片右上:点它按官方形状通知宿主的 update:checkedRowKeys,且不触发 rowClick', async () => {
    const onUpdate = vi.fn()
    wrapper = await mountAt(
      390,
      { columns: [{ type: 'selection' }, ...columns] },
      { checkedRowKeys: [3], 'onUpdate:checkedRowKeys': onUpdate },
    )
    const first = items(wrapper)[0]
    expect(first.find('.smart-table-card-head .smart-table-card-check').exists()).toBe(true)
    await first.find('.n-checkbox').trigger('click')
    expect(onUpdate).toHaveBeenCalledTimes(1)
    const [keys, , meta] = onUpdate.mock.calls[0]
    expect(keys).toEqual([3, 2])
    expect(meta).toMatchObject({ action: 'check' })
    expect(wrapper.emitted('rowClick')).toBeUndefined()
    // 已勾选的那张卡片带勾选态
    const checked = items(wrapper).filter((i) => i.classes('smart-table-card-item--checked'))
    expect(checked).toHaveLength(1)
    expect(checked[0].find('.smart-table-card-title').text()).toBe('M3')
  })

  it('activeRowKey 命中的卡片带 smart-table-row--active', async () => {
    wrapper = await mountAt(390, { activeRowKey: 1 })
    const active = items(wrapper).filter((i) => i.classes('smart-table-row--active'))
    expect(active).toHaveLength(1)
    expect(active[0].find('.smart-table-card-title').text()).toBe('M1')
  })

  it('展开列:宿主 expanded-row-keys 里的行,卡片底部显示展开内容', async () => {
    wrapper = await mountAt(
      390,
      {
        columns: [
          { type: 'expand', renderExpand: (r: Row) => h('i', { class: 'exp' }, `详情${r.no}`) },
          ...columns,
        ],
      },
      { expandedRowKeys: [1] },
    )
    const more = wrapper.findAll('.smart-table-card-more')
    expect(more).toHaveLength(1)
    expect(more[0].text()).toBe('详情M1')
  })

  it('没有数据:卡片区显示官方空状态', async () => {
    wrapper = await mountAt(390, { data: [] })
    expect(wrapper.find('.smart-table-card-empty .n-empty').exists()).toBe(true)
  })

  it('分页仍由官方 simple 分页画(窄档不画每页选择器),卡片只显示当前页', async () => {
    const many = Array.from({ length: 5 }, (_, i) => ({ id: i + 1, no: `M${i + 1}`, name: 'x' }))
    wrapper = await mountAt(390, {
      columns: [{ key: 'no', title: '编码' }],
      data: many,
      pagination: { pageSize: 2 },
    })
    expect(items(wrapper)).toHaveLength(2)
    expect(wrapper.find('.n-pagination').exists()).toBe(true)
  })

  it('远程模式:卡片显示 fetcher 返回的当前页', async () => {
    const fetcher = vi.fn(async () => ({ items: rows, total: 3 }))
    wrapper = await mountAt(390, { data: undefined, fetcher })
    expect(items(wrapper)).toHaveLength(3)
  })
})

describe('SmartTable 窄档排序抽屉(cardOnNarrow,规格 §5.4)', () => {
  let wrapper: VueWrapper | undefined
  beforeEach(() => {
    document.body.innerHTML = ''
  })
  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    vi.unstubAllGlobals()
  })
  const titles = (w: VueWrapper) => items(w).map((i) => i.find('.smart-table-card-title').text())
  const drawerEl = () => document.body.querySelector('.smart-table-sort-drawer')
  const segBtn = (rowIdx: number, text: string) =>
    [
      ...document.body
        .querySelectorAll('.smart-table-sort-row')
        [rowIdx].querySelectorAll('.n-radio-button'),
    ].find((b) => b.textContent?.trim() === text) as HTMLElement

  it('有可排序列:工具栏出现「Sort」按钮(带生效条数角标);没有可排序列时不出现', async () => {
    wrapper = await mountAt(390)
    expect(wrapper.find('.smart-table-toolbar-sort').exists()).toBe(true)
    expect(wrapper.find('.smart-table-toolbar-sort-badge').text()).toBe('1') // amount 默认升序
    wrapper.unmount()
    wrapper = await mountAt(390, { columns: [{ key: 'no', title: '编码' }] })
    expect(wrapper.find('.smart-table-toolbar-sort').exists()).toBe(false)
  })

  it('点「Sort」从底部抽屉列出可排序列(每列「无 / 升序 / 降序」),打开时回填当前排序;确认才生效', async () => {
    const onSorter = vi.fn()
    wrapper = await mountAt(390, {}, { 'onUpdate:sorter': onSorter })
    expect(titles(wrapper)).toEqual(['M2', 'M3', 'M1']) // amount 升序
    await wrapper.find('.smart-table-toolbar-sort').trigger('click')
    await nextTick()
    await flushPromises()
    expect(drawerEl()).not.toBeNull()
    const rows = document.body.querySelectorAll('.smart-table-sort-row')
    expect(rows).toHaveLength(1)
    expect(rows[0].textContent).toContain('金额')
    const checked = rows[0].querySelector('.n-radio-button--checked')
    expect(checked?.textContent?.trim()).toBe('Ascending')

    segBtn(0, 'Descending').click()
    await nextTick()
    // 草稿还没提交:卡片顺序不变
    expect(titles(wrapper)).toEqual(['M2', 'M3', 'M1'])
    ;(
      document.body.querySelector('.smart-table-sort-foot .n-button--primary-type') as HTMLElement
    ).click()
    await nextTick()
    await flushPromises()
    expect(titles(wrapper)).toEqual(['M1', 'M3', 'M2'])
    expect(onSorter).toHaveBeenCalledTimes(1)
    expect(onSorter.mock.calls[0][0]).toMatchObject({ columnKey: 'amount', order: 'descend' })
  })

  it('抽屉里选「无」:确认后清掉该列排序,角标消失', async () => {
    wrapper = await mountAt(390)
    await wrapper.find('.smart-table-toolbar-sort').trigger('click')
    await flushPromises()
    segBtn(0, 'None').click()
    await nextTick()
    ;(
      document.body.querySelector('.smart-table-sort-foot .n-button--primary-type') as HTMLElement
    ).click()
    await flushPromises()
    expect(titles(wrapper)).toEqual(['M1', 'M2', 'M3'])
    expect(wrapper.find('.smart-table-toolbar-sort-badge').exists()).toBe(false)
  })

  it('「重置」恢复列声明的默认排序', async () => {
    wrapper = await mountAt(390)
    const w = wrapper
    ;(w.vm as unknown as { sort: (k: string, o: 'descend') => void }).sort('amount', 'descend')
    await flushPromises()
    expect(titles(w)).toEqual(['M1', 'M3', 'M2'])
    await w.find('.smart-table-toolbar-sort').trigger('click')
    await flushPromises()
    ;(
      document.body.querySelector(
        '.smart-table-sort-foot .n-button:not(.n-button--primary-type)',
      ) as HTMLElement
    ).click()
    await flushPromises()
    expect(titles(w)).toEqual(['M2', 'M3', 'M1'])
  })

  it('窄档 + 模式 2(输入框 + 筛选)与卡片模式共存:卡片、操作 ▾、条件构造器同时在', async () => {
    wrapper = await mountAt(390, {
      search: { container: 'table' },
      columns: [
        { key: 'no', title: '编码', search: true },
        { key: 'name', title: '名称', search: true },
      ],
    })
    expect(items(wrapper)).toHaveLength(3)
    expect(wrapper.find('.smart-table-toolbar--narrow').exists()).toBe(true)
    expect(wrapper.find('.smart-table-cond').exists()).toBe(true)
    expect(wrapper.find('.smart-table-cond input').exists()).toBe(true)
  })
})
