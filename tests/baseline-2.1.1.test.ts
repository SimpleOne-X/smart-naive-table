// @vitest-environment jsdom
// 2.1.1 行为的「特征测试」:锁住后面要被有意翻转的默认值。
// 每条标题里的 [Bn] / [Cn] = 由哪个任务翻转。翻转时在同一个提交里改断言,
// 并在提交说明里写明这是有意的默认行为变更(见计划 Global Constraints)。
import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { NDataTable } from 'naive-ui'
import SmartTable from '../src/SmartTable.vue'
import Toolbar from '../src/Toolbar.vue'
import { BUILTIN_DEFAULTS } from '../src/config'
import { saveState } from '../src/storage'
import { defaultLabels } from '../src/labels'

const rows = [
  { id: 1, name: 'alice' },
  { id: 2, name: 'bob' },
]

afterEach(() => localStorage.clear())

describe('2.1.1 特征:内置默认值', () => {
  it('[B1 已翻转] 内置兜底:每页 [100,500,1000];[B2 已翻转] 密度 compact', () => {
    expect(BUILTIN_DEFAULTS.pageSizes).toEqual([100, 500, 1000])
    expect(BUILTIN_DEFAULTS.density).toBe('compact')
  })
})

describe('3.0 分页(B1 / B4 已翻转)', () => {
  it('静态模式:默认每页 100、simple、带每页选择器(suffix)', () => {
    const wrapper = mount(SmartTable, {
      props: { columns: [{ key: 'name', title: 'Name' }], data: rows, rowKey: 'id' },
    })
    const p = wrapper.findComponent(NDataTable).props('pagination') as Record<string, unknown>
    expect(p.pageSize).toBe(100)
    expect(p.simple).toBe(true)
    expect(typeof p.suffix).toBe('function')
    wrapper.unmount()
  })

  it('远程模式:首次请求 pageSize = 100', async () => {
    const fetcher = vi.fn(async () => ({ items: rows, total: 2 }))
    const wrapper = mount(SmartTable, {
      props: { columns: [{ key: 'name', title: 'Name' }], fetcher, rowKey: 'id' },
    })
    await flushPromises()
    expect(fetcher).toHaveBeenCalledWith(expect.objectContaining({ page: 1, pageSize: 100 }))
    wrapper.unmount()
  })
})

describe('3.0 密度(B2 已翻转)', () => {
  it('默认紧凑(small)', () => {
    const plain = mount(SmartTable, {
      props: { columns: [{ key: 'name', title: 'Name' }], data: rows, rowKey: 'id' },
    })
    expect(plain.findComponent(NDataTable).props('size')).toBe('small')
    plain.unmount()
  })

  it('存储里存过 comfortable 的用户,没有密度按钮时存储不参与:取默认 compact(small)', () => {
    saveState('baseline-density', 'comfortable', [{ key: 'name', show: true }])
    const stored = mount(SmartTable, {
      props: {
        columns: [{ key: 'name', title: 'Name' }],
        data: rows,
        rowKey: 'id',
        storageKey: 'baseline-density',
      },
    })
    expect(stored.findComponent(NDataTable).props('size')).toBe('small')
    stored.unmount()
  })
})

describe('3.0 工具栏(B3 已翻转)', () => {
  it('默认只有「刷新」,没有「密度」', () => {
    const wrapper = mount(Toolbar, {
      props: { labels: defaultLabels, config: {}, density: 'compact' },
    })
    const html = wrapper.html()
    expect(html).toContain('aria-label="Refresh"')
    expect(html).not.toContain('aria-label="Density"')
    wrapper.unmount()
  })
})

describe('2.1.1 特征:排序', () => {
  const sortCols = [
    { key: 'a', title: 'A', sorter: true },
    { key: 'b', title: 'B', sorter: true },
  ]

  it('单列点击 → 远程参数 { sortField, sortOrder: asc|desc }(本行为在 3.0 保持不变)', async () => {
    const fetcher = vi.fn(async () => ({ items: rows, total: 2 }))
    const wrapper = mount(SmartTable, { props: { columns: sortCols, fetcher, rowKey: 'id' } })
    await flushPromises()
    const onSorter = wrapper.findComponent(NDataTable).props('onUpdate:sorter') as (
      s: unknown,
    ) => void
    onSorter({ columnKey: 'a', order: 'ascend', sorter: true })
    await flushPromises()
    expect(fetcher).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, sortField: 'a', sortOrder: 'asc' }),
    )
    wrapper.unmount()
  })

  it('[C2 已修] defaultSortOrder 进入首次请求', async () => {
    const fetcher = vi.fn(async () => ({ items: rows, total: 2 }))
    const wrapper = mount(SmartTable, {
      props: {
        columns: [{ key: 'a', title: 'A', sorter: true, defaultSortOrder: 'descend' }],
        fetcher,
        rowKey: 'id',
      },
    })
    await flushPromises()
    const first = (fetcher.mock.calls[0] as unknown[])[0] as Record<string, unknown>
    expect(first).toMatchObject({ sortField: 'a', sortOrder: 'desc' })
    wrapper.unmount()
  })

  it('[C1 已修] 多列排序:带 sortField(最高优先级)与 sorts', async () => {
    const fetcher = vi.fn(async () => ({ items: rows, total: 2 }))
    const multiCols = [
      { key: 'a', title: 'A', sorter: { compare: () => 0, multiple: 2 } },
      { key: 'b', title: 'B', sorter: { compare: () => 0, multiple: 1 } },
    ]
    const wrapper = mount(SmartTable, { props: { columns: multiCols, fetcher, rowKey: 'id' } })
    await flushPromises()
    const onSorter = wrapper.findComponent(NDataTable).props('onUpdate:sorter') as (
      s: unknown,
    ) => void
    onSorter([
      { columnKey: 'a', order: 'ascend', sorter: multiCols[0].sorter },
      { columnKey: 'b', order: 'descend', sorter: multiCols[1].sorter },
    ])
    await flushPromises()
    const last = (fetcher.mock.calls.at(-1) as unknown[])[0] as Record<string, unknown>
    expect(last).toMatchObject({
      sortField: 'a',
      sortOrder: 'asc',
      sorts: [
        { field: 'a', order: 'asc' },
        { field: 'b', order: 'desc' },
      ],
    })
    wrapper.unmount()
  })
})
