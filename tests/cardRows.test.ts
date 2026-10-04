import { describe, expect, it } from 'vitest'
import { orderLocalRows, sliceRows } from '../src/cardRows'
import { collectSorters } from '../src/sorts'
import type { SmartTableColumn, SortItem } from '../src/types'

interface R {
  id: number
  name: string
  n: number | null
}
const rows: R[] = [
  { id: 1, name: 'b', n: 3 },
  { id: 2, name: 'a', n: 1 },
  { id: 3, name: 'a', n: 2 },
  { id: 4, name: 'c', n: null },
]
const ids = (rs: R[]) => rs.map((r) => r.id)

function order(columns: SmartTableColumn<R>[], sorts: SortItem[]): number[] {
  return ids(orderLocalRows(rows, sorts, collectSorters(columns)))
}

describe('orderLocalRows —— 本地模式卡片列表的排序(与官方 use-sorter 同语义)', () => {
  it('没有排序态:原样返回', () => {
    expect(order([{ key: 'n', sorter: 'default' }], [])).toEqual([1, 2, 3, 4])
  })

  it('sorter: default 按数字升 / 降,空值最小', () => {
    const cols: SmartTableColumn<R>[] = [{ key: 'n', sorter: 'default' }]
    expect(order(cols, [{ field: 'n', order: 'ascend' }])).toEqual([4, 2, 3, 1])
    expect(order(cols, [{ field: 'n', order: 'descend' }])).toEqual([1, 3, 2, 4])
  })

  it('sorter 是函数:用它比较', () => {
    const cols: SmartTableColumn<R>[] = [{ key: 'n', sorter: (a: R, b: R) => b.id - a.id }]
    expect(order(cols, [{ field: 'n', order: 'ascend' }])).toEqual([4, 3, 2, 1])
  })

  it('sorter: true / { multiple } 没有 compare:本地不排(官方同样不排,留给后端)', () => {
    expect(order([{ key: 'n', sorter: true }], [{ field: 'n', order: 'ascend' }])).toEqual([
      1, 2, 3, 4,
    ])
    expect(
      order([{ key: 'n', sorter: { multiple: 1 } }], [{ field: 'n', order: 'ascend' }]),
    ).toEqual([1, 2, 3, 4])
  })

  it('多列:数组顺序 = 优先级,前一列相等才看后一列;相等项保持原序(稳定)', () => {
    const cols: SmartTableColumn<R>[] = [
      { key: 'name', sorter: { multiple: 2, compare: 'default' } },
      { key: 'n', sorter: { multiple: 1, compare: 'default' } },
    ]
    expect(
      order(cols, [
        { field: 'name', order: 'ascend' },
        { field: 'n', order: 'descend' },
      ]),
    ).toEqual([3, 2, 1, 4])
  })

  it('不修改入参数组', () => {
    const copy = [...rows]
    orderLocalRows(
      rows,
      [{ field: 'n', order: 'ascend' }],
      collectSorters([{ key: 'n', sorter: 'default' }] as SmartTableColumn<R>[]),
    )
    expect(rows).toEqual(copy)
  })
})

describe('sliceRows —— 本地分页切片', () => {
  const all = [1, 2, 3, 4, 5]
  it('按页码与每页条数切', () => {
    expect(sliceRows(all, 2, 2)).toEqual([3, 4])
  })
  it('页码越界夹到最后一页(官方同样静默夹页)', () => {
    expect(sliceRows(all, 9, 2)).toEqual([5])
  })
  it('页码 < 1 夹到第 1 页', () => {
    expect(sliceRows(all, 0, 2)).toEqual([1, 2])
  })
  it('pageSize 缺省(不分页)返回全部', () => {
    expect(sliceRows(all, 3, undefined)).toEqual(all)
  })
})
