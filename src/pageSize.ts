// 每页条数相关的纯函数(UI 无关、可单测)。
import type { PaginationProps } from 'naive-ui'

/** 官方 pageSizes 的元素类型:数字,或 { label, value } 对象(从公开的 PaginationProps 推导,不自己写一份)。 */
export type PageSizeOption = NonNullable<PaginationProps['pageSizes']>[number]

export function pageSizeValue(s: PageSizeOption): number {
  return typeof s === 'number' ? s : Number(s.value)
}

/**
 * 并入当前值:官方每页选择器在当前 pageSize 不在选项里时显示裸值(如「15」,没有「/ 页」后缀、也不标记选中)。
 * 已在里面 → 原样(拷贝);不在 → 加一个数字项并按值升序。对象项保持 { label, value }。
 */
export function mergePageSizes(list: readonly PageSizeOption[], current: number): PageSizeOption[] {
  if (list.some((s) => pageSizeValue(s) === current)) return [...list]
  return [...list, current].sort((a, b) => pageSizeValue(a) - pageSizeValue(b))
}

export interface DefaultPageSizeInput {
  /** `<SmartTable default-page-size>`。 */
  prop?: number
  /** 宿主的 `pagination.pageSize` / `pagination.defaultPageSize` / `pagination.pageSizes`。 */
  pageSize?: number
  defaultPageSize?: number
  pageSizes?: readonly PageSizeOption[]
  /** 全局默认里**显式给了**的 `defaultPageSize` / `pageSizes`(没给就不要传)。 */
  globalDefaultPageSize?: number
  globalPageSizes?: readonly number[]
}

const first = (list?: readonly PageSizeOption[]) => (list && list.length ? pageSizeValue(list[0]) : undefined)

/**
 * 初始每页条数的解析优先级(D4):实例 prop > 实例 pagination.pageSize > 实例 pagination.defaultPageSize
 * > 全局 defaultPageSize > 宿主(实例、其次全局)显式给的 pageSizes[0] > 库默认 100。
 * 这样宿主只写 `pageSizes: [10, 20, 50]` 也能让首个请求的 pageSize 变成 10(B1 的回退真的是一行)。
 */
export function resolveDefaultPageSize(i: DefaultPageSizeInput, builtin = 100): number {
  return (
    i.prop ??
    i.pageSize ??
    i.defaultPageSize ??
    i.globalDefaultPageSize ??
    first(i.pageSizes) ??
    first(i.globalPageSizes) ??
    builtin
  )
}
