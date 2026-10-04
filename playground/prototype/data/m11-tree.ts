// 模块 11「主从联动」的数据:左侧部门树(原型 MS_TREE)+ 节点 → 后端参数 / 计数的纯函数。
import { DATA } from '../data'

export interface MsNode {
  key: string
  /** 缺省 = 用 key 当文案(叶子是部门名,不翻译成别的,但英文走字典:生产部 → Production)。 */
  label?: string
  children?: MsNode[]
}

export const MS_TREE: MsNode[] = [
  {
    key: 'all',
    label: '全部部门',
    children: [
      { key: 'g-prod', label: '生产系', children: [{ key: '生产部' }, { key: '仓储部' }] },
      { key: 'g-func', label: '职能系', children: [{ key: '采购部' }] },
    ],
  },
]

/** 默认展开的节点(原型 state.ms.exp)。 */
export const MS_EXPANDED = ['all', 'g-prod', 'g-func']

export const msLeaves = (n: MsNode): string[] =>
  n.children ? n.children.flatMap(msLeaves) : [n.key]

export function msFind(key: string, list: MsNode[] = MS_TREE): MsNode | null {
  for (const n of list) {
    if (n.key === key) return n
    const f = n.children && msFind(key, n.children)
    if (f) return f
  }
  return null
}

/** 节点下的物料单据数(原型 msCount:按部门叶子统计全部 2000 行)。 */
export function msCount(n: MsNode): number {
  const set = new Set(msLeaves(n))
  return DATA.filter((r) => set.has(r.dept)).length
}

/**
 * 选中节点 → 传给 <SmartTable :params> 的联动参数(原型 msConds):
 * 全部 = 不限;分组 = dept IN 叶子;叶子 = dept = 该部门。params 变化库会回第 1 页重查。
 */
export function msParams(sel: string): Record<string, unknown> {
  if (sel === 'all') return {}
  const n = msFind(sel)
  if (!n) return {}
  return n.children ? { dept: msLeaves(n) } : { dept: sel }
}
