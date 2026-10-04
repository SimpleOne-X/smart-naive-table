import { describe, expect, it } from 'vitest'
import type { DataTableColumn } from 'naive-ui'
import { buildCardView, planCardColumns, type CardColumnLike } from '../src/cardColumns'
import type { SmartTableColumn } from '../src/types'

const col = (key: string, extra: Partial<CardColumnLike> = {}): CardColumnLike => ({
  key,
  ...extra,
})
const keys = (cols: CardColumnLike[]) => cols.map((c) => c.key)

describe('planCardColumns —— 窄档卡片的列映射(规格 §5.8)', () => {
  it('零配置:第一个数据列作标题,其余全是「标签:值」', () => {
    const plan = planCardColumns([col('no'), col('name'), col('owner')])
    expect(plan.title?.key).toBe('no')
    expect(keys(plan.metas)).toEqual(['name', 'owner'])
    expect(plan.action).toBeNull()
    expect(plan.handle).toBeNull()
  })

  it('操作列 = 最后一个 fixed: right 的列,放底部、不进 meta', () => {
    const plan = planCardColumns([
      col('no'),
      col('name'),
      col('a', { fixed: 'right' }),
      col('ops', { fixed: 'right' }),
    ])
    expect(plan.action?.key).toBe('ops')
    // 前一个 fixed: right 的列不是操作列:当普通列
    expect(keys(plan.metas)).toEqual(['name', 'a'])
  })

  it('card: action 优先于 fixed: right', () => {
    const plan = planCardColumns([
      col('no'),
      col('ops', { card: 'action' }),
      col('tail', { fixed: 'right' }),
    ])
    expect(plan.action?.key).toBe('ops')
    expect(keys(plan.metas)).toEqual(['tail'])
  })

  it('card: title / meta / false 一一对应;false 的列不出现', () => {
    const plan = planCardColumns([
      col('no', { card: 'meta' }),
      col('name', { card: 'title' }),
      col('spec', { card: false }),
      col('owner'),
    ])
    expect(plan.title?.key).toBe('name')
    expect(keys(plan.metas)).toEqual(['no', 'owner'])
  })

  it('没有显式 title 时,标题取第一个没写 card 的列(跳过 card: false)', () => {
    const plan = planCardColumns([col('x', { card: false }), col('no'), col('name')])
    expect(plan.title?.key).toBe('no')
    expect(keys(plan.metas)).toEqual(['name'])
  })

  it('card: handle 的列单独放(拖拽手柄),不当标题', () => {
    const plan = planCardColumns([col('rd', { card: 'handle' }), col('name'), col('code')])
    expect(plan.handle?.key).toBe('rd')
    expect(plan.title?.key).toBe('name')
    expect(keys(plan.metas)).toEqual(['code'])
  })

  it('勾选 / 展开列分别记下,序号列忽略;它们不当标题', () => {
    const plan = planCardColumns([
      { type: 'expand', key: '__n_expand__' },
      { type: 'selection', key: '__n_selection__' },
      { key: '__index', type: 'index' } as CardColumnLike,
      col('no'),
    ])
    expect(plan.expand?.key).toBe('__n_expand__')
    expect(plan.selection?.key).toBe('__n_selection__')
    expect(plan.title?.key).toBe('no')
    expect(plan.metas).toEqual([])
  })

  it('Naive 序号列(useColumns 产出的 key 为 __index、没有 type)同样被忽略,不会当成标题', () => {
    const plan = planCardColumns([{ key: '__index' }, col('no'), col('name')])
    expect(plan.title?.key).toBe('no')
    expect(keys(plan.metas)).toEqual(['name'])
  })

  it('多级表头展开到叶子,card 写在叶子上', () => {
    const plan = planCardColumns([
      col('no', { card: 'title' }),
      col('stock', {
        children: [
          col('avail', { card: 'meta' }),
          col('transit', { card: false }),
          col('locked', { card: false }),
        ],
      }),
    ])
    expect(keys(plan.metas)).toEqual(['avail'])
  })

  it('同时写了两个 card: title:第一个是标题,第二个降为 meta', () => {
    const plan = planCardColumns([col('a', { card: 'title' }), col('b', { card: 'title' })])
    expect(plan.title?.key).toBe('a')
    expect(keys(plan.metas)).toEqual(['b'])
  })
})

describe('buildCardView —— 把最终列(Naive 列)与声明列拼成卡片视图', () => {
  interface R {
    id: number
    name: string
    note: string | null
  }
  const row: R = { id: 1, name: 'n1', note: null }

  it('标签取声明列的 title(Naive 列的 title 被漏斗包过,不能用),函数形式渲染期求值', () => {
    const declared: SmartTableColumn<R>[] = [
      { key: 'name', title: () => 'Name' },
      { key: 'note', title: '备注' },
    ]
    const naive = [
      { key: 'name', title: () => 'Name+funnel' },
      { key: 'note', title: '备注' },
    ] as unknown as DataTableColumn<R>[]
    const view = buildCardView(naive, declared)
    expect(view.title?.key).toBe('name')
    expect(view.metas[0].key).toBe('note')
    expect(view.title?.label()).toBe('Name')
    expect(view.metas[0].label()).toBe('备注')
  })

  it('没有标题的列,标签回退成列 key', () => {
    const view = buildCardView([{ key: 'a' }, { key: 'b' }] as DataTableColumn<R>[], [])
    expect(view.metas[0].label()).toBe('b')
  })

  it('单元格:有 render 用 render,否则取 row[key],空值渲染成空串', () => {
    const naive = [
      { key: 'name', render: (r: R) => `<${r.name}>` },
      { key: 'note' },
      { key: 'id' },
    ] as unknown as DataTableColumn<R>[]
    const view = buildCardView(naive, [])
    expect(view.title?.render(row, 0)).toBe('<n1>')
    expect(view.metas[0].render(row, 0)).toBe('')
    expect(view.metas[1].render(row, 0)).toBe(1)
  })

  it('勾选列的 disabled、展开列的 renderExpand 带进视图', () => {
    const naive = [
      { type: 'selection', disabled: (r: R) => r.id === 1 },
      { type: 'expand', renderExpand: (r: R) => `exp-${r.id}` },
      { key: 'name' },
    ] as unknown as DataTableColumn<R>[]
    const view = buildCardView(naive, [])
    expect(view.selectable).toBe(true)
    expect(view.isDisabled?.(row)).toBe(true)
    expect(view.renderExpand?.(row, 0)).toBe('exp-1')
  })

  it('没有勾选 / 展开列:selectable false,没有 renderExpand', () => {
    const view = buildCardView([{ key: 'name' }] as DataTableColumn<R>[], [])
    expect(view.selectable).toBe(false)
    expect(view.renderExpand).toBeUndefined()
  })
})
