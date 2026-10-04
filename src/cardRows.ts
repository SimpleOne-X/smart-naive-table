// 窄档卡片列表的行数据(本地模式用):排序 + 分页切片。纯函数、可单测。
// 为什么要自己算:卡片列表不是 NDataTable 画的,拿不到它内部已排序已分页的行;远程模式直接用请求回来的当前页,不走这里。
// 排序语义照官方 use-sorter.mjs 的 getSortFunction:'default' / { compare: 'default' } 用默认比较(空值最小、数字相减、字符串 localeCompare),
// 函数或 { compare: fn } 用它;`sorter: true` / 只有 { multiple } 的没有本地比较(留给后端),本地不排。
import type { SortItem } from './types'
import type { SorterInfo } from './sorts'

type Compare<T> = (a: T, b: T) => number

function defaultCompare<T>(key: string): Compare<T> {
  return (a, b) => {
    const v1 = (a as Record<string, unknown>)[key]
    const v2 = (b as Record<string, unknown>)[key]
    if (v1 === null || v1 === undefined) return v2 === null || v2 === undefined ? 0 : -1
    if (v2 === null || v2 === undefined) return 1
    if (typeof v1 === 'number' && typeof v2 === 'number') return v1 - v2
    if (typeof v1 === 'string' && typeof v2 === 'string') return v1.localeCompare(v2)
    return 0
  }
}

function compareOf<T>(key: string, sorter: unknown): Compare<T> | null {
  if (sorter === 'default') return defaultCompare(key)
  if (typeof sorter === 'function') return sorter as Compare<T>
  if (sorter && typeof sorter === 'object') {
    const compare = (sorter as { compare?: unknown }).compare
    if (compare === 'default') return defaultCompare(key)
    if (typeof compare === 'function') return compare as Compare<T>
  }
  return null
}

/** 按排序态(数组顺序 = 优先级)排本地行;稳定排序,不改入参。 */
export function orderLocalRows<T>(
  rows: readonly T[],
  sorts: SortItem[],
  info: Map<string, SorterInfo>,
): T[] {
  const chain = sorts
    .map((s) => ({
      cmp: compareOf<T>(s.field, info.get(s.field)?.sorter),
      sign: s.order === 'ascend' ? 1 : -1,
    }))
    .filter((x): x is { cmp: Compare<T>; sign: number } => x.cmp !== null)
  if (chain.length === 0) return [...rows]
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      for (const { cmp, sign } of chain) {
        const r = cmp(a.row, b.row) * sign
        if (r !== 0) return r
      }
      return a.index - b.index
    })
    .map((x) => x.row)
}

/** 按页码切一页;页码越界夹到合法范围(官方本地分页同样静默夹页);没有每页条数 = 不分页,返回全部。 */
export function sliceRows<T>(rows: readonly T[], page: number, pageSize: number | undefined): T[] {
  if (!pageSize || pageSize <= 0) return [...rows]
  const pages = Math.max(1, Math.ceil(rows.length / pageSize))
  const p = Math.min(Math.max(1, page), pages)
  return rows.slice((p - 1) * pageSize, p * pageSize)
}
