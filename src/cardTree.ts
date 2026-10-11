// 窄档卡片的树表(cardOnNarrow + children-key,设计 2.17)用到的纯函数,UI 无关、可单测:
// ① flattenTree:把「当前页的根行」按先序拍平,只进入已展开的节点(分页 / 排序 / 过滤只作用于根行,同官方 NDataTable);
// ② cascade 勾选:语义对齐官方(naive-ui 内部用 treemate 做这件事),逐步对拍见 tests/cardTree.parity.test.ts。
//    自己写而不 import treemate:它是 naive-ui 的内部依赖,不是本库声明的依赖。
export type RowKey = string | number

export interface TreeOptions<T> {
  /** 子级字段名,同官方 `children-key`(默认 'children')。 */
  childrenKey: string
  rowKey: (row: T) => RowKey
  /** selection 列的 `disabled`:级联时跳过它,它也不参与父节点的「全勾 / 半选」判断(同官方)。 */
  isDisabled?: (row: T) => boolean
}

export interface CardNode<T> {
  row: T
  /** 层级,根 = 0。 */
  depth: number
  hasChildren: boolean
  /** 有子级且在展开集里(叶子恒为 false)。 */
  expanded: boolean
}

/** SmartTable 交给 CardList 的树表视图:每张卡片的层级 / 展开态,以及缩进与箭头的无障碍文案。没有树时不传,卡片与此前逐字节一致。 */
export interface CardTreeView<T> {
  /** 每层缩进(px),取宿主传给 NDataTable 的 `indent`,默认 16。 */
  indent: number
  info: (row: T) => { depth: number; hasChildren: boolean; expanded: boolean }
  expandLabel: string
  collapseLabel: string
}

/** 子级;空数组算叶子(官方 `ignoreEmptyChildren: true`)。 */
function childrenOf<T>(row: T, childrenKey: string): T[] {
  const kids = (row as Record<string, unknown>)[childrenKey]
  return Array.isArray(kids) ? (kids as T[]) : []
}

/** 先序拍平:折叠的节点其后代不出现(即使后代自己的键在展开集里)。没有任何 children 时与入参逐项一致。 */
export function flattenTree<T>(
  rows: readonly T[],
  expanded: ReadonlySet<RowKey>,
  opt: Pick<TreeOptions<T>, 'childrenKey' | 'rowKey'>,
): CardNode<T>[] {
  const out: CardNode<T>[] = []
  const walk = (row: T, depth: number): void => {
    const kids = childrenOf(row, opt.childrenKey)
    const hasChildren = kids.length > 0
    const open = hasChildren && expanded.has(opt.rowKey(row))
    out.push({ row, depth, hasChildren, expanded: open })
    if (open) kids.forEach((kid) => walk(kid, depth + 1))
  }
  rows.forEach((row) => walk(row, 0))
  return out
}

/** 整棵树里所有有子级的节点键(先序),= 官方 `default-expand-all` 的初值(treeMate.getNonLeafKeys)。 */
export function nonLeafKeys<T>(
  rows: readonly T[],
  opt: Pick<TreeOptions<T>, 'childrenKey' | 'rowKey'>,
): RowKey[] {
  const out: RowKey[] = []
  const walk = (row: T): void => {
    const kids = childrenOf(row, opt.childrenKey)
    if (!kids.length) return
    out.push(opt.rowKey(row))
    kids.forEach(walk)
  }
  rows.forEach(walk)
  return out
}

interface TreeNode<T> {
  key: RowKey
  row: T
  parent: TreeNode<T> | null
  children: TreeNode<T>[]
  disabled: boolean
}

export interface TreeIndex<T> {
  nodes: Map<RowKey, TreeNode<T>>
  /** 按层级分组(levels[0] = 根),勾选的「自下而上」归位要用。 */
  levels: TreeNode<T>[][]
  hasChildren: boolean
}

/** 给整份数据(本地模式 = 全部行;远程 = 当前页)建索引。级联要看到整棵树,所以不能只用当前页的卡片行。 */
export function indexTree<T>(rows: readonly T[], opt: TreeOptions<T>): TreeIndex<T> {
  const nodes = new Map<RowKey, TreeNode<T>>()
  const levels: TreeNode<T>[][] = []
  let hasChildren = false
  const build = (row: T, parent: TreeNode<T> | null, level: number): TreeNode<T> => {
    const node: TreeNode<T> = {
      key: opt.rowKey(row),
      row,
      parent,
      children: [],
      disabled: !!opt.isDisabled?.(row),
    }
    nodes.set(node.key, node)
    ;(levels[level] ??= []).push(node)
    const kids = childrenOf(row, opt.childrenKey)
    if (kids.length) hasChildren = true
    node.children = kids.map((kid) => build(kid, node, level + 1))
    return node
  }
  rows.forEach((row) => build(row, null, 0))
  return { nodes, levels, hasChildren }
}

/** 给定键各自连同后代一起纳入集合;遇到 disabled 节点就停(它的后代不纳入)。键不在树里的原样保留(别页的行)。 */
function extend<T>(index: TreeIndex<T>, keys: Iterable<RowKey>): Set<RowKey> {
  const out = new Set<RowKey>(keys)
  const visit = (node: TreeNode<T>): void => {
    if (node.disabled) return
    out.add(node.key)
    node.children.forEach(visit)
  }
  for (const key of [...out]) {
    const node = index.nodes.get(key)
    if (node) visit(node)
  }
  return out
}

/** 自下而上归位:非 disabled 的子全勾 → 父勾上;有子被勾 / 半选但没全勾 → 父半选。返回半选键。 */
function settle<T>(index: TreeIndex<T>, checked: Set<RowKey>): Set<RowKey> {
  const half = new Set<RowKey>()
  for (let level = index.levels.length - 1; level >= 0; level--) {
    for (const node of index.levels[level]) {
      if (!node.children.length || node.disabled) continue
      let all = true
      let some = false
      let usable = false
      for (const child of node.children) {
        if (child.disabled) continue
        usable = true
        if (checked.has(child.key)) some = true
        else if (half.has(child.key)) {
          some = true
          all = false
        } else all = false
      }
      if (!usable) continue
      if (all) checked.add(node.key)
      else if (some) half.add(node.key)
    }
  }
  return half
}

/** 取消时要连带去掉的祖先:一路向上,碰到 disabled 的祖先或已访问过的就停(同官方 getAvailableAscendantNodeSet)。 */
function ascendantsOf<T>(index: TreeIndex<T>, key: RowKey): Set<RowKey> {
  const out = new Set<RowKey>()
  let cursor = index.nodes.get(key)?.parent ?? null
  while (cursor && !cursor.disabled && !out.has(cursor.key)) {
    out.add(cursor.key)
    cursor = cursor.parent
  }
  return out
}

/** 把宿主给的键集归一化成「实际勾选 / 半选」:cascade 时后代算勾上、子全勾则父算勾上(同官方 getCheckedKeys)。 */
export function normalizeChecked<T>(
  index: TreeIndex<T>,
  keys: readonly RowKey[],
  cascade: boolean,
): { checked: RowKey[]; indeterminate: RowKey[] } {
  if (!cascade) return { checked: [...keys], indeterminate: [] }
  const checked = extend(index, keys)
  const half = settle(index, checked)
  return { checked: [...checked], indeterminate: [...half] }
}

/** 勾上一个节点后的键集(cascade 时连带后代,并让祖先自动归位)。`current` 取已归一化的当前键集(官方也是)。 */
export function checkKey<T>(
  index: TreeIndex<T>,
  current: readonly RowKey[],
  key: RowKey,
  cascade: boolean,
): RowKey[] {
  if (!cascade) return current.includes(key) ? [...current] : [...current, key]
  const checked = extend(index, [...current, key])
  settle(index, checked)
  return [...checked]
}

/** 取消一个节点后的键集(cascade 时连带后代,并取消它的祖先:祖先不可能再是「全勾」)。 */
export function uncheckKey<T>(
  index: TreeIndex<T>,
  current: readonly RowKey[],
  key: RowKey,
  cascade: boolean,
): RowKey[] {
  if (!cascade) return current.filter((k) => k !== key)
  const checked = extend(index, current)
  const drop = extend(index, [key])
  const ascendants = ascendantsOf(index, key)
  for (const k of [...checked]) if (drop.has(k) || ascendants.has(k)) checked.delete(k)
  settle(index, checked)
  return [...checked]
}
