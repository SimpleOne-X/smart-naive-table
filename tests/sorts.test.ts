import { describe, expect, it } from 'vitest'
import {
  collectSorters,
  deriveInitSorts,
  normalizeSorterEvent,
  orderByPriority,
  sortToParams,
  sortTransition,
} from '../src/sorts'
import type { SmartTableColumn } from '../src/types'

const cmp = () => 0
const cols: SmartTableColumn<any>[] = [
  { key: 'id', title: 'id' },
  { key: 'g', title: 'g', sorter: { compare: cmp, multiple: 2 } },
  { key: 'n', title: 'n', sorter: { compare: cmp, multiple: 1 } },
  { key: 's', title: 's', sorter: true },
  { type: 'index' },
]

describe('collectSorters', () => {
  it('只收有 sorter 的数据叶子列:multiple 的带优先级,true / 函数是单列互斥(priority 0)', () => {
    const info = collectSorters(cols)
    expect([...info.keys()].sort()).toEqual(['g', 'n', 's'])
    expect(info.get('g')).toMatchObject({ priority: 2, multiple: true })
    expect(info.get('n')).toMatchObject({ priority: 1, multiple: true })
    expect(info.get('s')).toMatchObject({ priority: 0, multiple: false, sorter: true })
  })

  it('hideInTable 的列(只作搜索项,没有表头)不收', () => {
    const info = collectSorters([
      { key: 'q', title: 'q', sorter: true, hideInTable: true },
    ] as SmartTableColumn<any>[])
    expect(info.size).toBe(0)
  })

  it('多级表头:递归到叶子', () => {
    const info = collectSorters([
      {
        key: 'grp',
        title: 'grp',
        children: [{ key: 'x', title: 'x', sorter: { compare: cmp, multiple: 3 } }],
      },
    ] as SmartTableColumn<any>[])
    expect(info.get('x')).toMatchObject({ priority: 3, multiple: true })
  })
})

describe('orderByPriority', () => {
  it('按声明的 multiple 从大到小;与传入顺序无关;未知列排最后', () => {
    const info = collectSorters(cols)
    const out = orderByPriority(
      [
        { field: 'n', order: 'ascend' },
        { field: 'zzz', order: 'ascend' },
        { field: 'g', order: 'descend' },
      ],
      info,
    )
    expect(out.map((i) => i.field)).toEqual(['g', 'n', 'zzz'])
  })
})

describe('normalizeSorterEvent(官方 onUpdate:sorter 的回传 → SortItem[])', () => {
  const info = collectSorters(cols)
  it('单个对象与数组都接受;order 为 false / null 的丢掉', () => {
    expect(normalizeSorterEvent({ columnKey: 's', order: 'ascend', sorter: true }, info)).toEqual([
      { field: 's', order: 'ascend' },
    ])
    expect(normalizeSorterEvent({ columnKey: 's', order: false, sorter: true }, info)).toEqual([])
    expect(normalizeSorterEvent(null, info)).toEqual([])
  })
  it('数组按声明优先级排序,不信任事件里的顺序', () => {
    const out = normalizeSorterEvent(
      [
        { columnKey: 'n', order: 'descend' },
        { columnKey: 'g', order: 'ascend' },
      ],
      info,
    )
    expect(out).toEqual([
      { field: 'g', order: 'ascend' },
      { field: 'n', order: 'descend' },
    ])
  })
})

describe('deriveInitSorts(C2:由列上的 defaultSortOrder 推导初始排序态)', () => {
  it('没有 defaultSortOrder → 空', () => {
    expect(deriveInitSorts(cols)).toEqual([])
  })
  it('multiple 列各自生效,按优先级排', () => {
    const out = deriveInitSorts([
      { key: 'n', title: 'n', sorter: { compare: cmp, multiple: 1 }, defaultSortOrder: 'ascend' },
      { key: 'g', title: 'g', sorter: { compare: cmp, multiple: 2 }, defaultSortOrder: 'descend' },
    ] as SmartTableColumn<any>[])
    expect(out).toEqual([
      { field: 'g', order: 'descend' },
      { field: 'n', order: 'ascend' },
    ])
  })
  it('单列互斥的 sorter:只保留最后声明的那一个(库的选择;官方初值不做单列互斥,use-sorter.mjs:31-37)', () => {
    const out = deriveInitSorts([
      { key: 'a', title: 'a', sorter: true, defaultSortOrder: 'ascend' },
      { key: 'b', title: 'b', sorter: true, defaultSortOrder: 'descend' },
    ] as SmartTableColumn<any>[])
    expect(out).toEqual([{ field: 'b', order: 'descend' }])
  })
  it('没有 sorter 的列写了 defaultSortOrder 也不生效', () => {
    expect(
      deriveInitSorts([
        { key: 'a', title: 'a', defaultSortOrder: 'ascend' },
      ] as SmartTableColumn<any>[]),
    ).toEqual([])
  })
  it('hideInTable 的列(只作搜索项)写了 defaultSortOrder 也不生效', () => {
    const hidden = [
      { key: 'a', title: 'a', sorter: true, defaultSortOrder: 'ascend', hideInTable: true },
    ] as SmartTableColumn<any>[]
    expect(deriveInitSorts(hidden)).toEqual([])
  })
})

describe('sortTransition(D7:编程式 sort() 的下一个排序态 + 官方 onUpdate:sorter 载荷)', () => {
  const info = collectSorters(cols)
  const gSorter = (cols[1] as { sorter: unknown }).sorter
  const nSorter = (cols[2] as { sorter: unknown }).sorter
  it('列没有 sorter / 不存在 → null(空操作,与官方 sort() 一致)', () => {
    expect(sortTransition([], info, 'id', 'ascend')).toBeNull()
    expect(sortTransition([], info, 'nope', 'ascend')).toBeNull()
  })
  it('单列互斥的 sorter:载荷是单个 SortState;其它列的排序被顶掉;order: false 时状态清空、载荷仍带 order: false', () => {
    const cur = [{ field: 'g', order: 'ascend' as const }]
    expect(sortTransition(cur, info, 's', 'descend')).toEqual({
      items: [{ field: 's', order: 'descend' }],
      event: { columnKey: 's', sorter: true, order: 'descend' },
    })
    expect(sortTransition([{ field: 's', order: 'descend' }], info, 's', false)).toEqual({
      items: [],
      event: { columnKey: 's', sorter: true, order: false },
    })
  })
  it('multiple 列:载荷是数组 = 已激活的 multiple 列(按列声明顺序)中同列替换、否则追加;单列互斥的旧排序被丢掉', () => {
    const cur = [
      { field: 'n', order: 'ascend' as const },
      { field: 's', order: 'ascend' as const }, // 单列互斥:被丢掉
    ]
    expect(sortTransition(cur, info, 'g', 'descend')).toEqual({
      items: [
        { field: 'g', order: 'descend' },
        { field: 'n', order: 'ascend' },
      ],
      event: [
        { columnKey: 'n', sorter: nSorter, order: 'ascend' },
        { columnKey: 'g', sorter: gSorter, order: 'descend' },
      ],
    })
  })
  it('multiple 列取消(order: false):状态里去掉该列,载荷里仍带 order: false 的那一项', () => {
    const cur = [
      { field: 'g', order: 'descend' as const },
      { field: 'n', order: 'ascend' as const },
    ]
    expect(sortTransition(cur, info, 'n', false)).toEqual({
      items: [{ field: 'g', order: 'descend' }],
      event: [
        { columnKey: 'g', sorter: gSorter, order: 'descend' },
        { columnKey: 'n', sorter: nSorter, order: false },
      ],
    })
  })
})

describe('sortToParams(C1:远程参数)', () => {
  it('空 → {};单列 → { sortField, sortOrder };多列 → 仍带最高优先级列,另加 sorts', () => {
    expect(sortToParams([])).toEqual({})
    expect(sortToParams([{ field: 'a', order: 'ascend' }])).toEqual({
      sortField: 'a',
      sortOrder: 'asc',
    })
    expect(
      sortToParams([
        { field: 'g', order: 'descend' },
        { field: 'n', order: 'ascend' },
      ]),
    ).toEqual({
      sortField: 'g',
      sortOrder: 'desc',
      sorts: [
        { field: 'g', order: 'desc' },
        { field: 'n', order: 'asc' },
      ],
    })
  })
})
