// @vitest-environment jsdom
// 卡片树表的 cascade 勾选(src/cardTree.ts)与官方 NDataTable 对拍(issue #16,设计 2.17):
// 同一棵树、同一串点击,官方发出的 `onUpdate:checkedRowKeys` 键集、以及每个勾选框的 选中 / 半选 状态,必须与 cardTree 一致。
// 官方侧用真实 NDataTable(全部展开,逐个点行首的勾选框),不 mock、不引入 treemate;期望值就是官方实际给的。
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { NDataTable } from 'naive-ui'
import { checkKey, indexTree, normalizeChecked, uncheckKey, type RowKey } from '../src/cardTree'

interface Row {
  id: string
  off?: boolean
  children?: Row[]
}

const OPT = { childrenKey: 'children', rowKey: (r: Row) => r.id }

/** 先序摊平整棵树(官方 defaultExpandAll 之后看到的行序)。 */
function preorder(rows: Row[]): Row[] {
  return rows.flatMap((r) => [r, ...preorder(r.children ?? [])])
}
const sorted = (keys: readonly RowKey[]) => [...keys].map(String).sort()

/** 官方一侧:挂 NDataTable(受控 checked-row-keys),返回「点第 i 行的勾选框 → 发出的键集 + 各行状态」。 */
function mountOfficial(data: Row[], cascade: boolean) {
  const flat = preorder(data)
  const keys = ref<RowKey[]>([])
  const last = { payload: [] as RowKey[] }
  const Host = defineComponent({
    setup: () => () =>
      h(NDataTable, {
        columns: [
          { type: 'selection', disabled: (r: Row) => !!r.off },
          { title: 'id', key: 'id' },
        ] as never,
        data: data as never,
        rowKey: (r: Row) => r.id,
        defaultExpandAll: true,
        cascade,
        checkedRowKeys: keys.value,
        'onUpdate:checkedRowKeys': (k: RowKey[]) => {
          last.payload = k
          keys.value = k
        },
      }),
  })
  const w = mount(Host, { attachTo: document.body })
  const boxes = () => [
    ...(w.element as HTMLElement).querySelectorAll<HTMLElement>('tbody .n-checkbox'),
  ]
  return {
    flat,
    async click(key: string) {
      const i = flat.findIndex((r) => r.id === key)
      boxes()[i].click()
      await nextTick()
      await nextTick()
      return [...last.payload]
    },
    state() {
      const out = { checked: [] as string[], indeterminate: [] as string[] }
      boxes().forEach((b, i) => {
        if (b.classList.contains('n-checkbox--checked')) out.checked.push(flat[i].id)
        if (b.classList.contains('n-checkbox--indeterminate')) out.indeterminate.push(flat[i].id)
      })
      return out
    },
    unmount: () => w.unmount(),
  }
}

/** 同一串点击,分别喂给官方和 cardTree;每一步都要求键集、勾选框状态一致。 */
async function expectParity(data: Row[], clicks: string[], cascade: boolean) {
  const off = mountOfficial(data, cascade)
  const idx = indexTree(data, { ...OPT, isDisabled: (r) => !!r.off })
  let mine: RowKey[] = []
  for (const key of clicks) {
    const official = await off.click(key)
    const on = normalizeChecked(idx, mine, cascade).checked.includes(key)
    mine = on ? uncheckKey(idx, mine, key, cascade) : checkKey(idx, mine, key, cascade)
    expect(sorted(mine), `点 ${key} 后的键集`).toEqual(sorted(official))
    const st = normalizeChecked(idx, mine, cascade)
    const real = off.state()
    expect(sorted(st.checked), `点 ${key} 后的选中框`).toEqual(sorted(real.checked))
    expect(sorted(st.indeterminate), `点 ${key} 后的半选框`).toEqual(sorted(real.indeterminate))
  }
  off.unmount()
}

const TREE: Row[] = [
  {
    id: 'a',
    children: [{ id: 'a1' }, { id: 'a2', children: [{ id: 'a21' }, { id: 'a22' }] }, { id: 'a3' }],
  },
  { id: 'b', children: [{ id: 'b1' }] },
  { id: 'c' },
]

describe('cardTree 的 cascade 勾选与官方 NDataTable 对拍', () => {
  it('cascade: true:勾父 / 勾子 / 全勾后取消子 / 取消父,逐步一致', async () => {
    await expectParity(TREE, ['a2', 'a1', 'a3', 'a21', 'a', 'a22', 'b1', 'b', 'c', 'a', 'b'], true)
  })

  it('cascade: true:先勾叶子再勾它的兄弟直到祖先自动勾上,再逐个取消', async () => {
    await expectParity(TREE, ['a21', 'a22', 'a1', 'a3', 'a21', 'a22', 'a1', 'a3', 'a2'], true)
  })

  it('cascade: true + disabled 行:级联跳过 disabled,disabled 的子不拦着父自动勾上', async () => {
    const withOff: Row[] = [
      { id: 'p', children: [{ id: 'p1' }, { id: 'p2', off: true }, { id: 'p3' }] },
      { id: 'q', children: [{ id: 'q1', off: true }, { id: 'q2' }] },
    ]
    await expectParity(withOff, ['p', 'p1', 'p3', 'p', 'q2', 'q', 'q2'], true)
  })

  it('cascade: false:勾 / 取消只动这一个键,没有半选', async () => {
    await expectParity(TREE, ['a', 'a1', 'a', 'b1', 'b', 'c'], false)
  })
})
