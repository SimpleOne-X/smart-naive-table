// 序号列树形的纯函数:拍平(只进已展开的节点、末位标记、所属根组、方框位)、项次编号、各层位置。
import { describe, expect, it } from 'vitest'
import { elbowWidth, flattenTreeRows, treeGeometry, treeNumbers } from '../src/treeIndex'

interface Node {
  id: string
  children?: Node[]
}
const tree: Node[] = [
  { id: 'a', children: [{ id: 'a1' }, { id: 'a2', children: [{ id: 'a2x' }] }] },
  { id: 'b' },
  { id: 'c', children: [{ id: 'c1' }] },
]
const opt = { childrenKey: 'children', rowKey: (r: Node) => r.id }

describe('flattenTreeRows', () => {
  it('先序拍平,折叠节点的后代不出现', () => {
    const { rows } = flattenTreeRows(tree, new Set(['a', 'a2']), opt)
    expect(rows.map((r) => r.row.id)).toEqual(['a', 'a1', 'a2', 'a2x', 'b', 'c'])
    expect(rows.map((r) => r.depth)).toEqual([0, 1, 1, 2, 0, 0])
    expect(rows.map((r) => r.expanded)).toEqual([true, false, true, false, false, false])
    expect(rows.map((r) => r.hasChildren)).toEqual([true, false, true, false, false, true])
  })

  it('父级折叠时,后代自己的键在展开集里也不出现', () => {
    const { rows } = flattenTreeRows(tree, new Set(['a2']), opt)
    expect(rows.map((r) => r.row.id)).toEqual(['a', 'b', 'c'])
  })

  it('lasts 逐层记录是否同级末位,group 是所属根', () => {
    const { rows } = flattenTreeRows(tree, new Set(['a', 'a2', 'c']), opt)
    const by = new Map(rows.map((r) => [r.row.id, r]))
    expect(by.get('a')!.lasts).toEqual([false])
    expect(by.get('a1')!.lasts).toEqual([false, false])
    expect(by.get('a2')!.lasts).toEqual([false, true])
    expect(by.get('a2x')!.lasts).toEqual([false, true, true])
    expect(by.get('c')!.lasts).toEqual([true])
    expect(by.get('c1')!.lasts).toEqual([true, true])
    expect(by.get('a2x')!.group).toBe('a')
    expect(by.get('c1')!.group).toBe('c')
  })

  it('boxDepths 看整棵树(含折叠的节点)', () => {
    expect(flattenTreeRows(tree, new Set(), opt).boxDepths).toEqual([true, true])
    expect(
      flattenTreeRows([{ id: 'x' }, { id: 'y', children: [] }], new Set(), opt).boxDepths,
    ).toEqual([])
  })
})

describe('treeNumbers', () => {
  it('根 n、子 n.m、孙 n.m.k;换父级后子序号重新从 1 起', () => {
    expect(treeNumbers([0, 1, 1, 2, 0, 0, 1], 0)).toEqual([
      '1',
      '1.1',
      '1.2',
      '1.2.1',
      '2',
      '3',
      '3.1',
    ])
  })

  it('offset 只加在根序号上', () => {
    expect(treeNumbers([0, 1, 0], 20)).toEqual(['21', '21.1', '22'])
  })
})

describe('treeGeometry / elbowWidth', () => {
  it('两层树(子级都是叶子):根文字 32、子文字 36,接线 14', () => {
    const lv = treeGeometry([true], 1)
    expect(lv[0]).toEqual({ line: 15, box: 8, text: 32 })
    expect(lv[1]).toEqual({ line: 31, box: null, text: 36 })
    expect(elbowWidth(lv, 1, false)).toBe(14)
  })

  it('第 1 层有方框位:方框在上一层中线右 9,文字在方框之后;带子级的接线接到方框左缘', () => {
    const lv = treeGeometry([true, true], 2)
    expect(lv[1]).toEqual({ line: 31, box: 24, text: 48 })
    expect(lv[2]).toEqual({ line: 47, box: null, text: 52 })
    expect(elbowWidth(lv, 1, true)).toBe(9)
    expect(elbowWidth(lv, 1, false)).toBe(14)
  })
})
