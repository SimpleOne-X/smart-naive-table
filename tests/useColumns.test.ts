import { describe, expect, it, vi } from 'vitest'
import { h, ref, type Slots, type VNode } from 'vue'
import type { DataTableBaseColumn, DataTableColumn } from 'naive-ui'
import {
  deriveFilterDefs,
  useColumns,
  withFillerColumn,
  FILLER_COLUMN_KEY,
  type FilterDef,
} from '../src/useColumns'
import { resolveDefaults } from '../src/config'
import type { SmartTableColumn, SmartTableOption, SortItem } from '../src/types'

interface Row {
  name: string
  st: number | null
  amt: number
}

function build(
  columns: SmartTableColumn<Row>[],
  defaultsIn?: Parameters<typeof resolveDefaults>[0],
  slots: Slots = {},
  sortState?: () => SortItem[],
  extra?: {
    renderFilter?: (def: FilterDef<Row>) => unknown
    resizable?: () => boolean
  },
) {
  const defaults = resolveDefaults(defaultsIn)
  const opts = {
    columns: () => columns,
    defaultDensity: 'comfortable' as const,
    getOptions: (k: string): SmartTableOption[] =>
      k === 'st' ? [{ label: 'A', value: 1, tagType: 'success' as const }] : [],
    slots,
    indexOffset: () => 0,
    defaults,
    sortState,
    filterDefs: () => deriveFilterDefs<Row>(columns),
    renderFilter: extra?.renderFilter as ((def: FilterDef<Row>) => any) | undefined,
    resizable: extra?.resizable,
  }
  return useColumns<Row>(opts)
}

// 按 key 找生成后的 Naive 列
function col(api: ReturnType<typeof build>, key: string) {
  return api.naiveColumns.value.find((c) => (c as { key?: string }).key === key) as Record<string, any>
}

describe('useColumns 消费全局默认', () => {
  it('align/titleAlign 默认取 defaults;列显式值优先', () => {
    const api = build(
      [
        { key: 'name', title: 'N' },
        { key: 'amt', title: 'A', align: 'right' },
      ],
      { align: 'left', titleAlign: 'left' },
    )
    expect(col(api, 'name').align).toBe('left')
    expect(col(api, 'name').titleAlign).toBe('left')
    expect(col(api, 'amt').align).toBe('right') // 列显式胜全局
  })

  it('空值渲染取 defaults.emptyText', () => {
    const api = build([{ key: 'st', title: 'S', format: 'money' }], { emptyText: 'N/A' })
    const render = col(api, 'st').render as (row: Row, i: number) => unknown
    expect(render({ name: 'x', st: null, amt: 0 }, 0)).toBe('N/A')
  })

  it('tag 样式取 defaults.tag', () => {
    const api = build([{ key: 'st', title: 'S', options: [{ label: 'A', value: 1 }], tag: true }], {
      tag: { size: 'medium', bordered: true },
    })
    const render = col(api, 'st').render as (row: Row, i: number) => VNode
    const vnode = render({ name: 'x', st: 1, amt: 0 }, 0)
    expect(vnode.props?.size).toBe('medium')
    expect(vnode.props?.bordered).toBe(true)
  })

  it('index 列宽/对齐取 defaults', () => {
    const api = build([{ type: 'index' }, { key: 'name', title: 'N' }], { indexWidth: 80, align: 'left' })
    const idx = col(api, '__index')
    expect(idx.width).toBe(80)
    expect(idx.align).toBe('left')
  })

  it('sorter 列受控回显:命中列取 sortState 里的 order,其余 sortable 列为 false;多列同时回显', () => {
    const api = build(
      [
        { key: 'name', title: 'N', sorter: true },
        { key: 'amt', title: 'A', sorter: true },
        { key: 'st', title: 'S', sorter: true },
      ],
      undefined,
      {},
      () => [
        { field: 'amt', order: 'descend' },
        { field: 'st', order: 'ascend' },
      ],
    )
    expect(col(api, 'amt').sortOrder).toBe('descend')
    expect(col(api, 'st').sortOrder).toBe('ascend') // C1:多列都回显,不再只认第一列
    expect(col(api, 'name').sortOrder).toBe(false)
  })

  it('无 sortState 时 sorter 列 sortOrder 为 false;非 sorter 列不设 sortOrder', () => {
    const api = build([
      { key: 'name', title: 'N', sorter: true },
      { key: 'amt', title: 'A' },
    ])
    expect(col(api, 'name').sortOrder).toBe(false)
    expect('sortOrder' in col(api, 'amt')).toBe(false)
  })

  it('#header-{key} 插槽覆盖表头(列无函数 title 时)', () => {
    const api = build([{ key: 'name', title: 'N' }], undefined, {
      'header-name': () => 'CUSTOM',
    } as unknown as Slots)
    const title = col(api, 'name').title as () => unknown
    expect(typeof title).toBe('function')
    expect(title()).toBe('CUSTOM')
  })
})

describe('useColumns 表头过滤入口', () => {
  const renderFilter = (def: FilterDef<Row>) => h('i', { class: 'funnel', 'data-key': def.key })

  it('filter 列的标题包成「原标题 + 漏斗」;未声明 filter 的列标题原样', () => {
    const api = build(
      [
        { key: 'name', title: 'N', filter: true },
        { key: 'amt', title: 'A' },
      ],
      undefined,
      {},
      undefined,
      { renderFilter },
    )
    const title = col(api, 'name').title as (c: unknown) => VNode
    expect(typeof title).toBe('function')
    const vnode = title(undefined)
    const children = vnode.children as VNode[]
    expect(children[0]).toBe('N')
    expect((children[1] as VNode).props?.['data-key']).toBe('name')

    expect(col(api, 'amt').title).toBe('A') // 无 filter 不包装
  })

  it('函数型标题(i18n)在包装后仍是渲染期求值', () => {
    let lang = 'zh'
    const api = build(
      [{ key: 'name', title: () => (lang === 'zh' ? '姓名' : 'Name'), filter: true }],
      undefined,
      {},
      undefined,
      { renderFilter },
    )
    const title = col(api, 'name').title as (c: unknown) => VNode
    expect((title(undefined).children as VNode[])[0]).toBe('姓名')
    lang = 'en'
    expect((title(undefined).children as VNode[])[0]).toBe('Name')
  })

  it('没有 renderFilter 时不包装(useColumns 可脱离 UI 单独使用)', () => {
    const api = build([{ key: 'name', title: 'N', filter: true }])
    expect(col(api, 'name').title).toBe('N')
  })

  it('本包的 filter 配置(FilterConfig)不透传给 n-data-table —— 撞的是它自己保留的同名字段', () => {
    const api = build([
      { key: 'name', title: 'N', filter: true },
      { key: 'amt', title: 'A', filter: { multiple: false } },
    ])
    expect(col(api, 'name').filter).toBeUndefined()
    expect(col(api, 'amt').filter).toBeUndefined()
  })
})

describe('useColumns 列宽拖拽', () => {
  it('表级 resizable 下放到数据列,列上显式值优先', () => {
    const api = build(
      [
        { key: 'name', title: 'N' },
        { key: 'amt', title: 'A', resizable: false },
      ],
      undefined,
      {},
      undefined,
      { resizable: () => true },
    )
    expect(col(api, 'name').resizable).toBe(true)
    expect(col(api, 'amt').resizable).toBe(false)
  })

  it('可拖拽列补上 minWidth 兜底,避免被拖成 0 宽', () => {
    const api = build([{ key: 'name', title: 'N' }, { key: 'amt', title: 'A', minWidth: 200 }], { resizeMinWidth: 80 }, {}, undefined, {
      resizable: () => true,
    })
    expect(col(api, 'name').minWidth).toBe(80)
    expect(col(api, 'amt').minWidth).toBe(200) // 列显式值不被覆盖
  })

  it('setWidth 回填成列 width,并计入 scrollX', () => {
    const api = build([
      { key: 'name', title: 'N', width: 100 },
      { key: 'amt', title: 'A', width: 100 },
    ])
    expect(api.scrollX.value).toBe(200)
    api.setWidth('name', 260)
    expect(col(api, 'name').width).toBe(260)
    expect(api.widths.value).toEqual({ name: 260 })
    expect(api.scrollX.value).toBe(360)
  })

  it('恢复默认会一并清掉拖拽宽度', () => {
    const api = build([{ key: 'name', title: 'N', width: 100 }])
    api.setWidth('name', 260)
    api.resetSettings()
    expect(api.widths.value).toEqual({})
    expect(col(api, 'name').width).toBe(100)
  })

  it('freezeWidths 把没有显式宽度的可见列钉成实测宽度', () => {
    const api = build(
      [
        { key: 'name', title: 'N', width: 100 },
        { key: 'amt', title: 'A' },
      ],
      undefined,
      {},
      undefined,
      { resizable: () => true },
    )
    // 实测宽 > 声明宽,正是 table-layout:fixed 摊派富余宽度的结果
    api.freezeWidths((k) => ({ name: 189.4, amt: 210.6 })[k])
    expect(api.widths.value).toEqual({ name: 189, amt: 211 })
    // 钉完之后声明宽度之和 == 实际渲染宽度之和,摊派消失
    expect(api.scrollX.value).toBe(400)
  })

  it('freezeWidths 不覆盖已拖过的列,也不碰量不到的列', () => {
    const api = build([
      { key: 'name', title: 'N', width: 100 },
      { key: 'amt', title: 'A', width: 100 },
    ])
    api.setWidth('name', 260)
    api.freezeWidths((k) => (k === 'name' ? 999 : undefined))
    expect(api.widths.value).toEqual({ name: 260 }) // name 保留拖拽值,amt 量不到不写
  })

  it('freezeWidths 跳过隐藏列(只钉当前可见的)', () => {
    const api = build([
      { key: 'name', title: 'N' },
      { key: 'amt', title: 'A', hide: true },
    ])
    api.freezeWidths(() => 150)
    expect(api.widths.value).toEqual({ name: 150 })
  })

  it('freezeWidths 连特殊列一起钉,否则残余富余量还会摊给所有列', () => {
    const api = build([{ type: 'index' }, { type: 'selection' }, { key: 'name', title: 'N' }])
    api.freezeWidths((k) => ({ __index: 118, __n_selection__: 74, name: 300 })[k])
    expect(api.widths.value).toEqual({ __index: 118, __n_selection__: 74, name: 300 })
    // 钉住的宽度要真的落到 Naive 列上,并计入 scrollX
    expect(col(api, '__index').width).toBe(118)
    expect(api.scrollX.value).toBe(492)
  })

  it('钉住后每列都给得出宽度,且之和恰好等于 scrollX', () => {
    // 这是「拖一列不牵动其它列」的前提:表格宽度写死成 scrollX,
    // 列宽之和与它对不上的话,差额会被 table-layout:fixed 摊回各列。
    const api = build(
      [
        { type: 'index' },
        { key: 'name', title: 'N' },
        { key: 'amt', title: 'A', fixed: 'right' },
        { key: 'st', title: 'S', minWidth: 90 },
      ],
      undefined,
      {},
      undefined,
      { resizable: () => true },
    )
    expect(api.pinned.value).toBe(false)
    api.freezeWidths((k) => ({ __index: 70, name: 240, amt: 150, st: 140 })[k])
    expect(api.pinned.value).toBe(true)

    const declared = api.naiveColumns.value.map((c) => (c as { width?: number }).width)
    expect(declared).toEqual([70, 240, 150, 140]) // 每列都有确定宽度
    expect(declared.reduce<number>((a, b) => a + (b ?? 0), 0)).toBe(api.scrollX.value)

    // 拖宽一列:只有这一列变,其余列纹丝不动,scrollX 同步涨
    api.setWidth('name', 300)
    expect(api.naiveColumns.value.map((c) => (c as { width?: number }).width)).toEqual([70, 300, 150, 140])
    expect(api.scrollX.value).toBe(660)

    // 收窄同理 —— 富余宽度不会被摊给别的列
    api.setWidth('name', 180)
    expect(api.naiveColumns.value.map((c) => (c as { width?: number }).width)).toEqual([70, 180, 150, 140])
    expect(api.scrollX.value).toBe(540)
  })

  it('未钉住时,没写宽度的普通列不硬塞 width(保持自适应)', () => {
    const api = build([{ key: 'name', title: 'N' }])
    expect('width' in col(api, 'name')).toBe(false)
  })

  it('可拖拽的勾选/展开特殊列在生成的 Naive 列上带显式 key,供拖拽回调按 key 定位列', () => {
    const api = build([
      { type: 'selection', resizable: true },
      { type: 'expand', resizable: true },
      { key: 'name', title: 'N' },
    ])
    expect(col(api, '__n_selection__')).toBeTruthy()
    expect(col(api, '__n_expand__')).toBeTruthy()
  })

  it('无 storageKey 时不写 localStorage(仅内存态)', () => {
    const setItem = vi.fn()
    vi.stubGlobal('localStorage', { getItem: () => null, setItem, removeItem: () => {} })
    const api = build([{ key: 'name', title: 'N' }])
    api.setWidth('name', 260)
    expect(setItem).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('列被移除后,widths 里对应的旧宽度也跟着清掉,不会被新声明的同名列悄悄继承', () => {
    const columns = ref<SmartTableColumn<Row>[]>([
      { key: 'name', title: 'N', width: 100 },
      { key: 'amt', title: 'A', width: 100 },
    ])
    const api = useColumns<Row>({
      columns: () => columns.value,
      defaultDensity: 'comfortable',
      getOptions: () => [],
      slots: {},
      indexOffset: () => 0,
      defaults: resolveDefaults(),
      filterDefs: () => deriveFilterDefs<Row>(columns.value),
    })
    api.setWidth('name', 260)
    api.setWidth('amt', 240)
    expect(api.widths.value).toEqual({ name: 260, amt: 240 })

    columns.value = [{ key: 'name', title: 'N', width: 100 }] // amt 不再声明
    expect(api.widths.value).toEqual({ name: 260 }) // amt 的陈旧宽度被清掉,name 保留

    // 之后来了个同名(amt)的新列,不该莫名其妙继承一份自己从没拖过的宽度
    columns.value = [
      { key: 'name', title: 'N', width: 100 },
      { key: 'amt', title: 'A', width: 100 },
    ]
    expect(api.widths.value).toEqual({ name: 260 })
    expect(col(api, 'amt').width).toBe(100) // 走的是列自己声明的 width,不是残留的 240
  })
})
describe('withFillerColumn:列宽钉住后用占位列填满容器', () => {
  const cols = (): DataTableColumn<Row>[] => [
    { key: 'name', title: 'N', width: 100 },
    { key: 'amt', title: 'A', width: 100 },
    { key: 'op', title: 'OP', width: 100, fixed: 'right' },
  ]

  it('富余宽度 <= 0 时原样返回,不补列', () => {
    const input = cols()
    expect(withFillerColumn(input, 0)).toBe(input)
    expect(withFillerColumn(input, -20)).toBe(input)
  })

  it('补出来的占位列宽度就是富余宽度,原有列一列不动', () => {
    const out = withFillerColumn(cols(), 260)
    const filler = out.find((c) => 'key' in c && c.key === FILLER_COLUMN_KEY) as DataTableBaseColumn<Row>
    expect(filler.width).toBe(260)
    expect(out.filter((c) => 'key' in c && c.key !== FILLER_COLUMN_KEY)).toEqual(cols())
  })

  it('占位列插在右固定列之前 —— 操作列仍贴容器右缘', () => {
    const out = withFillerColumn(cols(), 260)
    expect(out.map((c) => ('key' in c ? c.key : ''))).toEqual(['name', 'amt', FILLER_COLUMN_KEY, 'op'])
  })

  it('没有右固定列时补在最后', () => {
    const out = withFillerColumn(cols().slice(0, 2), 260)
    expect(out.map((c) => ('key' in c ? c.key : ''))).toEqual(['name', 'amt', FILLER_COLUMN_KEY])
  })

  it('右固定列不是连续的尾部一段时,占位列仍要落在真正的尾部之前,不能卡在中间', () => {
    // 中间混了一个 fixed:'right'(声明顺序或列设置拖拽出来的),op2 才是真正贴右缘的那一个
    const withMidFixed: DataTableColumn<Row>[] = [
      { key: 'name', title: 'N', width: 100 },
      { key: 'amt', title: 'A', width: 100, fixed: 'right' },
      { key: 'remark', title: 'R', width: 100 },
      { key: 'op2', title: 'OP2', width: 100, fixed: 'right' },
    ]
    const out = withFillerColumn(withMidFixed, 260)
    expect(out.map((c) => ('key' in c ? c.key : ''))).toEqual(['name', 'amt', 'remark', FILLER_COLUMN_KEY, 'op2'])
  })

  it('占位列不可拖拽、不排序、不过滤、不进 CSV 导出 —— 只是一块填白', () => {
    const filler = withFillerColumn(cols(), 260).find(
      (c) => 'key' in c && c.key === FILLER_COLUMN_KEY,
    ) as DataTableBaseColumn<Row>
    expect(filler.resizable).toBeUndefined()
    expect(filler.sorter).toBeUndefined()
    expect(filler.filter).toBeUndefined()
    expect(filler.allowExport).toBe(false)
    expect(filler.title).toBe('')
  })
})
