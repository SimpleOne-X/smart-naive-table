// 窄档卡片的列映射(规格 §5.8,纯函数、UI 无关、可单测)。
// 输入是列(声明列或 Naive 列都行,只读 key / type / fixed / card / children):
//   · 零配置:第一个数据列作标题,其余「标签:值」两列,操作列放底部;
//   · 列上 `card` 覆盖:'title' | 'meta' | 'action' | 'handle' | false(不出现);
//   · 操作列 = card: 'action',否则最后一个 fixed: 'right' 的列。
// 输入应已经是「列设置之后」的最终列(隐藏的列不在里面),这样列设置里隐藏的列卡片里同样隐藏,顺序也跟着设置走。
import type { VNodeChild } from 'vue'
import type { DataTableColumn } from 'naive-ui'
import { isSpecialColumn } from './useColumns'
import type { SmartTableCardRole, SmartTableColumn } from './types'

export interface CardColumnLike {
  key?: string | number
  type?: string
  fixed?: 'left' | 'right' | boolean
  card?: SmartTableCardRole | false
  children?: CardColumnLike[]
}

export interface CardPlan<C extends CardColumnLike> {
  /** 拖拽手柄列(card: 'handle'):卡片标题行最左。 */
  handle: C | null
  title: C | null
  metas: C[]
  /** 底部操作行用的列。 */
  action: C | null
  /** 勾选列:卡片右上角的复选框。 */
  selection: C | null
  /** 展开列:卡片底部的展开内容。 */
  expand: C | null
  /** 序号列(type: 'index'):行号;只有拖拽排序的卡片(opts.index)才显示在标题行末尾。 */
  index: C | null
}

function leavesOf<C extends CardColumnLike>(cols: C[]): C[] {
  const out: C[] = []
  for (const c of cols) {
    if (c.children?.length) out.push(...leavesOf(c.children as C[]))
    else out.push(c)
  }
  return out
}

export function planCardColumns<C extends CardColumnLike>(
  cols: C[],
  opts: { index?: boolean } = {},
): CardPlan<C> {
  const leaves = leavesOf(cols)
  const plan: CardPlan<C> = {
    handle: null,
    title: null,
    metas: [],
    action: null,
    selection: null,
    expand: null,
    index: null,
  }
  const data: C[] = []
  for (const c of leaves) {
    if (c.type === 'selection') plan.selection ??= c
    else if (c.type === 'expand') plan.expand ??= c
    // 序号列:useColumns 产出的 Naive 序号列把 type 摘掉了,只剩固定的 key '__index'。卡片里默认没有序号,拖拽排序的卡片(opts.index)才显示
    else if (c.type === 'index' || c.key === '__index') {
      if (opts.index) plan.index ??= c
      continue
    } else data.push(c)
  }

  plan.handle = data.find((c) => c.card === 'handle') ?? null
  plan.action =
    data.find((c) => c.card === 'action') ??
    [...data].reverse().find((c) => c.card === undefined && c.fixed === 'right') ??
    null
  plan.title =
    data.find((c) => c.card === 'title') ??
    data.find((c) => c.card === undefined && c !== plan.action) ??
    null

  plan.metas = data.filter(
    (c) =>
      c !== plan.handle &&
      c !== plan.action &&
      c !== plan.title &&
      c.card !== false &&
      c.card !== 'handle' &&
      c.card !== 'action',
  )
  return plan
}

/** 卡片里的一个字段:标签(渲染期求值)+ 单元格渲染。 */
export interface CardField<T> {
  key: string
  label: () => VNodeChild
  render: (row: T, index: number) => VNodeChild
}

/** 卡片列表渲染所需的全部列信息(由最终列 + 声明列拼出)。 */
export interface CardView<T> {
  handle: CardField<T> | null
  title: CardField<T> | null
  metas: CardField<T>[]
  action: CardField<T> | null
  /** 有勾选列:卡片右上角画复选框。 */
  selectable: boolean
  /** 勾选列的 disabled(该行复选框禁用)。 */
  isDisabled?: (row: T) => boolean
  /** 展开列的内容渲染(宿主用 expanded-row-keys 控制哪些行展开)。 */
  renderExpand?: (row: T, index: number) => VNodeChild
  /** 序号(拖拽排序的卡片:标题行末尾、勾选框之前的行号,同设计原型模块 10 的 .rc-no)。 */
  index: CardField<T> | null
}

type NaiveLike<T> = {
  key?: string | number
  type?: string
  title?: unknown
  render?: (row: T, index: number) => VNodeChild
  disabled?: (row: T) => boolean
  renderExpand?: (row: T, index: number) => VNodeChild
}

function declaredLeaves<T>(cols: SmartTableColumn<T>[]): Map<string, SmartTableColumn<T>> {
  const out = new Map<string, SmartTableColumn<T>>()
  const walk = (list: SmartTableColumn<T>[]) => {
    for (const c of list) {
      if (isSpecialColumn(c)) continue
      if (c.children?.length) walk(c.children)
      else out.set(c.key, c)
    }
  }
  walk(cols)
  return out
}

/**
 * 把「列设置之后的最终 Naive 列」映射成卡片视图。
 * 为什么标签要回头取声明列的 title:Naive 列的 title 已经被包成「标题 + 漏斗」,卡片标签里不该带漏斗;
 * 为什么取函数而不是字符串:title 可能是随语言求值的函数,必须在渲染期调用。
 */
export function buildCardView<T>(
  naiveCols: DataTableColumn<T>[],
  declared: SmartTableColumn<T>[],
  opts: { index?: boolean } = {},
): CardView<T> {
  const plan = planCardColumns(naiveCols as unknown as (CardColumnLike & NaiveLike<T>)[], opts)
  const byKey = declaredLeaves(declared)
  const field = (c: CardColumnLike & NaiveLike<T>): CardField<T> => {
    const key = String(c.key)
    const decl = byKey.get(key)
    const title = decl && !isSpecialColumn(decl) ? decl.title : undefined
    return {
      key,
      label: () => {
        const t = typeof title === 'function' ? title() : title
        return t === undefined || t === null || t === '' ? key : t
      },
      render: (row, index) => {
        if (c.render) return c.render(row, index)
        const v = (row as Record<string, unknown>)[key]
        return v === null || v === undefined ? '' : (v as VNodeChild)
      },
    }
  }
  const sel = plan.selection as NaiveLike<T> | null
  const exp = plan.expand as NaiveLike<T> | null
  return {
    handle: plan.handle ? field(plan.handle) : null,
    title: plan.title ? field(plan.title) : null,
    metas: plan.metas.map(field),
    action: plan.action ? field(plan.action) : null,
    selectable: !!sel,
    isDisabled: sel?.disabled,
    renderExpand: exp?.renderExpand,
    index: plan.index ? field(plan.index) : null,
  }
}
