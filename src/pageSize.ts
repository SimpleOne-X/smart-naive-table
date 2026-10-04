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

/** 内置每页条数可选项(没开 fillHeight)。 */
export const DEFAULT_PAGE_SIZES: readonly number[] = [100, 500, 1000]
/**
 * 内置每页条数可选项(开了 fillHeight)。fillHeight 走官方虚拟滚动,一页 10000 行切换约 45ms;
 * 不开时是整页渲染,一页 10000 行切换 9.4s、排序 22.8s、JS 堆 1.3GB(Edge 实测),所以只在开了 fillHeight 时才给到 10000。
 */
export const FILL_PAGE_SIZES: readonly number[] = [100, 1000, 10000]

export interface PageSizesInput {
  /** 实例 `pagination.pageSizes`。 */
  user?: readonly PageSizeOption[]
  /** 全局默认里的 `pageSizes`(是不是宿主显式给的看 globalGiven)。 */
  global?: readonly PageSizeOption[]
  /** 全局 `pageSizes` 是宿主显式注入的(`resolveDefaults` 记在 `pageSizesGiven` 上);只是内置兜底就是 false。 */
  globalGiven?: boolean
  /** 这张表开了 `fillHeight`。 */
  fillHeight: boolean
}

/**
 * 每页条数可选项:实例 pagination.pageSizes > 全局显式给的 pageSizes > 内置(开了 fillHeight [100, 1000, 10000],没开 [100, 500, 1000])。
 * 宿主(实例或全局)显式给了就照宿主的,不分 fillHeight。返回值可能就是传入数组本身,调用方别原地改。
 */
export function resolvePageSizes(i: PageSizesInput): readonly PageSizeOption[] {
  if (i.user) return i.user
  if (i.globalGiven && i.global) return i.global
  return i.fillHeight ? FILL_PAGE_SIZES : DEFAULT_PAGE_SIZES
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

const first = (list?: readonly PageSizeOption[]) =>
  list && list.length ? pageSizeValue(list[0]) : undefined

/**
 * 初始每页条数的解析优先级(与 fillHeight 无关,两种内置可选项的第一项都是 100):实例 prop > 实例 pagination.pageSize > 实例 pagination.defaultPageSize
 * > 全局 defaultPageSize > 宿主(实例、其次全局)显式给的 pageSizes[0] > 库默认 100。
 * 这样宿主只写 `pageSizes: [10, 20, 50]` 也能让首个请求的 pageSize 变成 10。
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
