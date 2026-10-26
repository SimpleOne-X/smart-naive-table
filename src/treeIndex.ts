// 序号列树形(index 列 `tree: true`,设计 2.18)用到的纯函数,UI 无关、可单测:
// ① flattenTreeRows:当前页的根行按先序拍平,只进入已展开的节点,带每行的层级、是否同级末位、所属根组;
// ② treeNumbers:按最终显示顺序编项次「1 / 1.1 / 1.1.2」(新增行这类不在树里的行按根行计);
// ③ treeGeometry:方框、树线、文字的横向位置(px,相对单元格左缘)。
import type { RowKey } from './cardTree'

export interface TreeRow<T> {
  row: T
  /** 层级,根 = 0。 */
  depth: number
  hasChildren: boolean
  /** 有子级且在展开集里。 */
  expanded: boolean
  /** lasts[k] = 第 k 层的祖先(lasts[depth] = 自己)是不是同级里的最后一个;决定树线往下续不续。 */
  lasts: boolean[]
  /** 所属根行的键(整组悬停)。 */
  group: RowKey
}

export interface TreeFlat<T> {
  rows: TreeRow<T>[]
  /** boxDepths[d] = 这一页的树里第 d 层有没有带子级的节点(含折叠起来看不见的),有才给这一层留方框位。 */
  boxDepths: boolean[]
}

function childrenOf<T>(row: T, childrenKey: string): T[] {
  const kids = (row as Record<string, unknown>)[childrenKey]
  return Array.isArray(kids) ? (kids as T[]) : []
}

/** 整棵树的全部节点(先序,不看展开态)。 */
export function treeNodes<T>(roots: readonly T[], childrenKey: string): T[] {
  const out: T[] = []
  const walk = (row: T): void => {
    out.push(row)
    childrenOf(row, childrenKey).forEach(walk)
  }
  roots.forEach(walk)
  return out
}

/** 先序拍平;折叠节点的后代不出现。boxDepths 走整棵树,展开 / 折叠时同一层的文字不左右跳。 */
export function flattenTreeRows<T>(
  roots: readonly T[],
  expanded: ReadonlySet<RowKey>,
  opt: { childrenKey: string; rowKey: (row: T) => RowKey },
): TreeFlat<T> {
  const rows: TreeRow<T>[] = []
  const boxDepths: boolean[] = []
  const mark = (row: T, depth: number): void => {
    const kids = childrenOf(row, opt.childrenKey)
    if (!kids.length) return
    boxDepths[depth] = true
    kids.forEach((kid) => mark(kid, depth + 1))
  }
  const walk = (row: T, depth: number, lasts: boolean[], group: RowKey): void => {
    const kids = childrenOf(row, opt.childrenKey)
    const open = kids.length > 0 && expanded.has(opt.rowKey(row))
    rows.push({ row, depth, hasChildren: kids.length > 0, expanded: open, lasts, group })
    if (open)
      kids.forEach((kid, i) => walk(kid, depth + 1, [...lasts, i === kids.length - 1], group))
  }
  roots.forEach((root, i) => {
    mark(root, 0)
    walk(root, 0, [i === roots.length - 1], opt.rowKey(root))
  })
  for (let d = 0; d < boxDepths.length; d++) boxDepths[d] = !!boxDepths[d]
  return { rows, boxDepths }
}

/** 按显示顺序编项次:depths[i] 是第 i 行的层级,offset 是根序号的起点(翻页 = (页 - 1) × 每页根数)。 */
export function treeNumbers(depths: readonly number[], offset: number): string[] {
  const counters: number[] = []
  return depths.map((d) => {
    counters.length = d + 1
    counters[d] = (counters[d] ?? 0) + 1
    const parts: number[] = []
    for (let k = 0; k <= d; k++) parts.push(counters[k] ?? 1)
    parts[0] = (parts[0] ?? 1) + offset
    return parts.join('.')
  })
}

/** 一层的位置:line = 这一层节点方框中线(子级的树线从这里落下),box = 方框左缘,text = 项次文字左缘。 */
export interface TreeLevel {
  line: number
  box: number | null
  text: number
}

/** 根层:方框 15px 宽、左缘 8,中线 15(1px 线落在 15–16,居中于方框);文字 32。 */
const ROOT: TreeLevel = { line: 15, box: 8, text: 32 }

/**
 * 各层位置。没有方框位的层(这一层谁都没子级)只是叶子:接线 14px 长,文字在上一层中线右 21px,
 * 两层的树(标准件 + 替代件)就是根 32、子 36;有方框位的层:方框在上一层中线右 9px,文字右移到方框之后。
 */
export function treeGeometry(boxDepths: readonly boolean[], depth: number): TreeLevel[] {
  const out: TreeLevel[] = [ROOT]
  for (let d = 1; d <= depth; d++) {
    const up = out[d - 1]!.line
    out.push(
      boxDepths[d]
        ? { line: up + 16, box: up + 9, text: up + 33 }
        : { line: up + 16, box: null, text: up + 21 },
    )
  }
  return out
}

/** 接线(上一层中线拐到本行)的长度:接到本行方框左缘,没有方框接 14px。 */
export function elbowWidth(
  levels: readonly TreeLevel[],
  depth: number,
  hasChildren: boolean,
): number {
  const lv = levels[depth]!
  return hasChildren && lv.box !== null ? lv.box - levels[depth - 1]!.line : 14
}
