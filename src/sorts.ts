// 排序态的纯函数(UI 无关、可单测)。
// 官方语义(naive-ui 2.45.3 use-sorter.mjs,已核):多列优先级 = 列声明的 sorter.multiple,
// 大者优先,与点击顺序无关;非 multiple 的 sorter 是「单列互斥」。
import type { SmartTableColumn, SortItem } from './types'
import { isSpecialColumn } from './useColumns'

export interface SorterInfo {
  /** sorter.multiple 的值;单列互斥 = 0。 */
  priority: number
  multiple: boolean
  /** 列上声明的 sorter 原值(编程式 sort() 构造官方 onUpdate:sorter 载荷时要带上)。 */
  sorter: unknown
}

/** 官方 onUpdate:sorter 载荷里的一项(DataTable 的 SortState)。order 为 false = 取消该列。 */
export interface SorterEvent {
  columnKey: string
  sorter: unknown
  order: 'ascend' | 'descend' | false
}

type Sorterish = { sorter?: unknown; defaultSortOrder?: unknown }

function sorterInfoOf(sorter: unknown): SorterInfo | null {
  if (sorter === undefined || sorter === null || sorter === false) return null
  if (typeof sorter === 'object' && typeof (sorter as { multiple?: unknown }).multiple === 'number') {
    return { priority: (sorter as { multiple: number }).multiple, multiple: true, sorter }
  }
  return { priority: 0, multiple: false, sorter }
}

/** 收集可排序叶子列(列 key → 优先级信息;Map 的迭代顺序 = 列声明顺序)。多级表头递归到叶子,特殊列与只作搜索项的 hideInTable 列(没有表头)跳过。 */
export function collectSorters<T>(columns: SmartTableColumn<T>[]): Map<string, SorterInfo> {
  const out = new Map<string, SorterInfo>()
  const walk = (cols: SmartTableColumn<T>[]) => {
    for (const c of cols) {
      if (isSpecialColumn(c) || c.hideInTable) continue
      if (c.children?.length) {
        walk(c.children)
        continue
      }
      const info = sorterInfoOf((c as Sorterish).sorter)
      if (info) out.set(c.key, info)
    }
  }
  walk(columns)
  return out
}

/** 按声明的优先级从大到小排序(稳定;未知列按 0 算,排在有优先级的列之后)。 */
export function orderByPriority(items: SortItem[], info: Map<string, SorterInfo>): SortItem[] {
  return items
    .map((item, index) => ({ item, index, priority: info.get(item.field)?.priority ?? 0 }))
    .sort((a, b) => b.priority - a.priority || a.index - b.index)
    .map((x) => x.item)
}

/** 官方 onUpdate:sorter 的回传(单个对象 / 数组 / null)→ SortItem[](按声明优先级排序,丢掉 order 为 false 的)。 */
export function normalizeSorterEvent(s: unknown, info: Map<string, SorterInfo>): SortItem[] {
  const list = Array.isArray(s) ? s : s ? [s] : []
  const items: SortItem[] = []
  for (const x of list as Array<{ columnKey?: string | number; order?: unknown }>) {
    if (!x || (x.order !== 'ascend' && x.order !== 'descend') || x.columnKey === undefined) continue
    items.push({ field: String(x.columnKey), order: x.order })
  }
  return orderByPriority(items, info)
}

/**
 * 编程式 sort(columnKey, order) 的结果:下一个排序态 + 向宿主转发的官方 onUpdate:sorter 载荷
 * (官方 use-sorter.mjs:75-112 的 getUpdatedSorterState / deriveNextSorter)。
 * - 列没有 sorter → null(空操作,与官方一致)。
 * - 单列互斥的 sorter:载荷是单个 SortState,其它列的排序被它顶掉;
 * - multiple 的 sorter:载荷是数组 = 当前已激活的 multiple 列(按列声明顺序)中,同列替换、否则追加这一项;
 *   单列互斥的旧排序被丢掉。order 为 false 时状态里去掉该列,但载荷里仍带那一项(官方原样)。
 */
export function sortTransition(
  current: SortItem[],
  info: Map<string, SorterInfo>,
  columnKey: string,
  order: 'ascend' | 'descend' | false,
): { items: SortItem[]; event: SorterEvent | SorterEvent[] } | null {
  const hit = info.get(columnKey)
  if (!hit) return null
  const state: SorterEvent = { columnKey, sorter: hit.sorter, order }
  if (!hit.multiple) return { items: normalizeSorterEvent(state, info), event: state }
  const active = new Map(current.map((i) => [i.field, i.order] as const))
  const event: SorterEvent[] = []
  for (const [key, inf] of info) {
    if (inf.multiple && active.has(key)) event.push({ columnKey: key, sorter: inf.sorter, order: active.get(key)! })
  }
  const at = event.findIndex((e) => e.columnKey === columnKey)
  if (at >= 0) event[at] = state
  else event.push(state)
  return { items: normalizeSorterEvent(event, info), event }
}

/**
 * 由列上的 defaultSortOrder 推导初始排序态(C2:官方在存在受控 sortOrder 的列时会忽略 defaultSortOrder,
 * 库给每个 sorter 列都写受控 sortOrder,所以必须自己接住它)。
 * 库的选择(官方初值不做单列互斥,use-sorter.mjs:31-37):单列互斥的 sorter 只留最后声明的那一个;multiple 列可并存。
 * 只在 SmartTable 首次 setup 时读一次 —— 列若是异步加载进来的,defaultSortOrder 不会生效,请用实例方法 sort()。
 */
export function deriveInitSorts<T>(columns: SmartTableColumn<T>[]): SortItem[] {
  const info = collectSorters(columns)
  let state: Array<SortItem & { multiple: boolean }> = []
  const walk = (cols: SmartTableColumn<T>[]) => {
    for (const c of cols) {
      if (isSpecialColumn(c) || c.hideInTable) continue
      if (c.children?.length) {
        walk(c.children)
        continue
      }
      const order = (c as Sorterish).defaultSortOrder
      const i = info.get(c.key)
      if (!i || (order !== 'ascend' && order !== 'descend')) continue
      if (i.multiple) state = [...state.filter((s) => s.multiple && s.field !== c.key), { field: c.key, order, multiple: true }]
      else state = [{ field: c.key, order, multiple: false }]
    }
  }
  walk(columns)
  return orderByPriority(
    state.map(({ field, order }) => ({ field, order })),
    info,
  )
}

/** 排序态 → 远程请求参数。单列保持 2.1.1 的形状;多列仍带最高优先级列(老后端至少拿到主排序),另加 sorts。 */
export function sortToParams(items: SortItem[]): Record<string, any> {
  if (items.length === 0) return {}
  const dir = (o: SortItem['order']) => (o === 'ascend' ? 'asc' : 'desc')
  const [main] = items
  const out: Record<string, any> = { sortField: main.field, sortOrder: dir(main.order) }
  if (items.length > 1) out.sorts = items.map((i) => ({ field: i.field, order: dir(i.order) }))
  return out
}
