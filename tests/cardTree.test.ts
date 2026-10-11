// 窄档卡片的树表(issue #16,设计 2.17)用到的纯函数:先序拍平 + cascade 勾选。
// 语义以官方为准:拍平的是「当前页的根行」,只进入已展开的节点;勾选对齐 NDataTable(treemate)的 cascade ——
// 勾父 = 勾上后代(跳过 disabled),子全勾则父自动勾上、部分勾则父半选;取消反之。官方对拍见 cardTree.parity.test.ts。
import { describe, expect, it } from 'vitest'
import {
  checkKey,
  flattenTree,
  indexTree,
  nonLeafKeys,
  normalizeChecked,
  uncheckKey,
  type RowKey,
} from '../src/cardTree'

interface Row {
  id: string
  name?: string
  off?: boolean
  children?: Row[]
}

//  a ─┬─ a1
//     ├─ a2 ─┬─ a21
//     │      └─ a22
//     └─ a3
//  b ── b1
//  c
const TREE: Row[] = [
  {
    id: 'a',
    children: [{ id: 'a1' }, { id: 'a2', children: [{ id: 'a21' }, { id: 'a22' }] }, { id: 'a3' }],
  },
  { id: 'b', children: [{ id: 'b1' }] },
  { id: 'c' },
]
const OPT = { childrenKey: 'children', rowKey: (r: Row) => r.id }
const keysOf = (nodes: { row: Row }[]) => nodes.map((n) => n.row.id)
const sorted = (keys: readonly RowKey[]) => [...keys].map(String).sort()

describe('flattenTree:先序拍平,只进入已展开的节点', () => {
  it('都折叠 → 只有根;每个节点带 depth / hasChildren / expanded', () => {
    const nodes = flattenTree(TREE, new Set(), OPT)
    expect(keysOf(nodes)).toEqual(['a', 'b', 'c'])
    expect(nodes.map((n) => [n.depth, n.hasChildren, n.expanded])).toEqual([
      [0, true, false],
      [0, true, false],
      [0, false, false],
    ])
  })

  it('展开 a 与 a2 → 先序:a, a1, a2, a21, a22, a3, b, c;层级 0 1 1 2 2 1 0 0', () => {
    const nodes = flattenTree(TREE, new Set(['a', 'a2']), OPT)
    expect(keysOf(nodes)).toEqual(['a', 'a1', 'a2', 'a21', 'a22', 'a3', 'b', 'c'])
    expect(nodes.map((n) => n.depth)).toEqual([0, 1, 1, 2, 2, 1, 0, 0])
    expect(nodes.find((n) => n.row.id === 'a2')).toMatchObject({
      hasChildren: true,
      expanded: true,
    })
  })

  it('折叠的节点其后代不出现,即使后代自己的键在展开集里(a 折叠、a2 展开 → 看不到 a21)', () => {
    expect(keysOf(flattenTree(TREE, new Set(['a2']), OPT))).toEqual(['a', 'b', 'c'])
  })

  it('空数组 children 算叶子(同官方 ignoreEmptyChildren),展开它不多出东西', () => {
    const rows: Row[] = [{ id: 'x', children: [] }]
    const nodes = flattenTree(rows, new Set(['x']), OPT)
    expect(nodes).toHaveLength(1)
    expect(nodes[0]).toMatchObject({ hasChildren: false, expanded: false })
  })

  it('没有任何 children → 与入参逐项一致(depth 0、无子级),保证没有树的表格卡片不变', () => {
    const flat: Row[] = [{ id: 'p' }, { id: 'q' }]
    const nodes = flattenTree(flat, new Set(['p']), OPT)
    expect(nodes.map((n) => n.row)).toEqual(flat)
    expect(nodes.every((n) => n.depth === 0 && !n.hasChildren && !n.expanded)).toBe(true)
  })

  it('children-key 可改;键可以是数字', () => {
    const rows = [{ k: 1, kids: [{ k: 2 }] }]
    const nodes = flattenTree(rows, new Set([1]), {
      childrenKey: 'kids',
      rowKey: (r: { k: number }) => r.k,
    })
    expect(nodes.map((n) => n.row.k)).toEqual([1, 2])
  })
})

describe('nonLeafKeys:default-expand-all 的初值(官方 getNonLeafKeys)', () => {
  it('整棵树里所有有子级的节点键,先序', () => {
    expect(nonLeafKeys(TREE, OPT)).toEqual(['a', 'a2', 'b'])
  })
})

describe('cascade 勾选(默认)', () => {
  const idx = indexTree(TREE, OPT)

  it('勾父 → 后代全勾;祖先按「子是否全勾」自动归位', () => {
    expect(sorted(checkKey(idx, [], 'a2', true))).toEqual(['a2', 'a21', 'a22'])
    // a2 全勾了,但 a 还有 a1 / a3 没勾 → a 不勾
  })

  it('子全勾 → 父自动勾上,一路向上', () => {
    let keys: RowKey[] = []
    for (const k of ['a1', 'a21', 'a22', 'a3']) keys = checkKey(idx, keys, k, true)
    expect(sorted(keys)).toEqual(['a', 'a1', 'a2', 'a21', 'a22', 'a3'])
  })

  it('取消一个子级 → 它的全部祖先都被取消(不再是全勾)', () => {
    const all = checkKey(idx, [], 'a', true)
    expect(sorted(all)).toEqual(['a', 'a1', 'a2', 'a21', 'a22', 'a3'])
    expect(sorted(uncheckKey(idx, all, 'a21', true))).toEqual(['a1', 'a22', 'a3'])
  })

  it('取消父 → 后代全取消;兄弟子树不受影响', () => {
    const keys = [...checkKey(idx, [], 'a', true), ...checkKey(idx, [], 'b', true)]
    expect(sorted(uncheckKey(idx, keys, 'a2', true))).toEqual(['a1', 'a3', 'b', 'b1'])
  })

  it('半选:有后代被勾、自己没被勾;全勾 / 全不勾都不是半选', () => {
    expect(normalizeChecked(idx, ['a21'], true)).toEqual({
      checked: ['a21'],
      indeterminate: expect.arrayContaining(['a2', 'a']),
    })
    expect(sorted(normalizeChecked(idx, ['a21'], true).indeterminate)).toEqual(['a', 'a2'])
    expect(normalizeChecked(idx, [], true).indeterminate).toEqual([])
    expect(normalizeChecked(idx, ['b'], true)).toEqual({
      checked: expect.arrayContaining(['b', 'b1']),
      indeterminate: [],
    })
  })

  it('宿主给的键集不规范(只给了父)→ 归一化后后代也算勾上(同官方 getCheckedKeys)', () => {
    expect(sorted(normalizeChecked(idx, ['a2'], true).checked)).toEqual(['a2', 'a21', 'a22'])
  })

  it('不在树里的键(别页的行)原样保留', () => {
    expect(sorted(checkKey(idx, ['elsewhere'], 'c', true))).toEqual(['c', 'elsewhere'])
    expect(sorted(uncheckKey(idx, ['elsewhere', 'c'], 'c', true))).toEqual(['elsewhere'])
  })
})

describe('cascade 勾选 + disabled 行(同官方:级联跳过 disabled,disabled 的节点不参与父的「全勾」判断)', () => {
  const rows: Row[] = [
    {
      id: 'p',
      children: [{ id: 'p1' }, { id: 'p2', off: true }, { id: 'p3' }],
    },
  ]
  const idx = indexTree(rows, { ...OPT, isDisabled: (r: Row) => !!r.off })

  it('勾父 → 只勾非 disabled 的后代', () => {
    expect(sorted(checkKey(idx, [], 'p', true))).toEqual(['p', 'p1', 'p3'])
  })

  it('非 disabled 的子全勾 → 父自动勾上(disabled 的子不拦着)', () => {
    let keys: RowKey[] = []
    for (const k of ['p1', 'p3']) keys = checkKey(idx, keys, k, true)
    expect(sorted(keys)).toEqual(['p', 'p1', 'p3'])
  })

  it('disabled 的父不被自动勾上 / 半选', () => {
    const r2: Row[] = [{ id: 'q', off: true, children: [{ id: 'q1' }] }]
    const i2 = indexTree(r2, { ...OPT, isDisabled: (r: Row) => !!r.off })
    expect(sorted(checkKey(i2, [], 'q1', true))).toEqual(['q1'])
    expect(normalizeChecked(i2, ['q1'], true).indeterminate).toEqual([])
  })
})

describe('cascade: false', () => {
  const idx = indexTree(TREE, OPT)

  it('勾 / 取消只动这一个键,没有半选', () => {
    expect(checkKey(idx, ['c'], 'a', false)).toEqual(['c', 'a'])
    expect(checkKey(idx, ['a'], 'a', false)).toEqual(['a'])
    expect(uncheckKey(idx, ['a', 'a1', 'c'], 'a', false)).toEqual(['a1', 'c'])
    expect(normalizeChecked(idx, ['a1'], false)).toEqual({ checked: ['a1'], indeterminate: [] })
  })
})
