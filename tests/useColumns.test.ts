import { describe, expect, it, vi } from 'vitest'
import { h, ref, type Slots, type VNode } from 'vue'
import {
  deriveFilterDefs,
  headerIconFloor,
  useColumns,
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
    hostWidth?: () => number
    dragDelta?: () => number
  },
) {
  const defaults = resolveDefaults(defaultsIn)
  const opts = {
    columns: () => columns,
    defaultDensity: () => 'comfortable' as const,
    getOptions: (k: string): SmartTableOption[] =>
      k === 'st' ? [{ label: 'A', value: 1, tagType: 'success' as const }] : [],
    slots,
    indexOffset: () => 0,
    defaults,
    sortState,
    filterDefs: () => deriveFilterDefs<Row>(columns),
    renderFilter: extra?.renderFilter as ((def: FilterDef<Row>) => any) | undefined,
    resizable: extra?.resizable,
    hostWidth: extra?.hostWidth,
    dragDelta: extra?.dragDelta,
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
        { key: 'mid', title: 'M' }, // E1:最后一个可拖的非固定列是吸收列(没有把手),夹具里补一个它,name 才仍是普通可拖列
        { key: 'amt', title: 'A', resizable: false },
      ],
      undefined,
      {},
      undefined,
      { resizable: () => true },
    )
    expect(col(api, 'name').resizable).toBe(true)
    expect(col(api, 'amt').resizable).toBe(false)
    expect(col(api, 'mid').resizable).toBe(false) // 吸收列
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

  it('freezeWidths 把没有显式宽度的可见列钉成实测宽度(吸收列除外:它弹性,不钉)', () => {
    const api = build(
      [
        { key: 'name', title: 'N', width: 100 },
        { key: 'mid', title: 'M' },
        { key: 'amt', title: 'A' },
      ],
      undefined,
      {},
      undefined,
      { resizable: () => true },
    )
    // 实测宽 > 声明宽,正是 table-layout:fixed 摊派富余宽度的结果
    api.freezeWidths((k) => ({ name: 189.4, mid: 150.2, amt: 210.6 })[k])
    // amt 是最后一个可见非固定列 = 吸收列,不钉
    expect(api.widths.value).toEqual({ name: 189, mid: 150 })
    expect(col(api, 'amt').width).toBeUndefined()
    // scroll-x = 已钉列 + 吸收列的下限(无声明宽 / minWidth → 兜底宽 120)
    expect(api.scrollX.value).toBe(189 + 150 + 120)
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

  it('freezeWidths 跳过隐藏列(只钉当前可见的);可见的最后一列是吸收列', () => {
    const api = build([
      { key: 'name', title: 'N' },
      { key: 'mid', title: 'M' },
      { key: 'amt', title: 'A', hide: true },
    ])
    api.freezeWidths(() => 150)
    expect(api.widths.value).toEqual({ name: 150 }) // mid 是可见的最后一列 → 吸收列,不钉;amt 隐藏,不碰
  })

  it('freezeWidths 连特殊列一起钉,否则残余富余量还会摊给所有列', () => {
    const api = build([{ type: 'index' }, { type: 'selection' }, { key: 'name', title: 'N' }])
    api.freezeWidths((k) => ({ __index: 118, __n_selection__: 74, name: 300 })[k])
    // name 是唯一的数据列 = 吸收列,不钉;特殊列照钉
    expect(api.widths.value).toEqual({ __index: 118, __n_selection__: 74 })
    expect(col(api, '__index').width).toBe(118)
    expect(api.scrollX.value).toBe(118 + 74 + 120) // + 吸收列下限(兜底宽 120)
  })

  it('钉住后除吸收列外每列都有确定宽度;已钉列宽度之和 + 吸收列下限 = scrollX', () => {
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

    // st 是最后一个可见非固定列 = 吸收列:不写 width(弹性),下限 = minWidth 90
    const widths = () => api.naiveColumns.value.map((c) => (c as { width?: number }).width)
    expect(widths()).toEqual([70, 240, 150, undefined])
    expect(api.scrollX.value).toBe(70 + 240 + 150 + 90)

    // 拖宽一列:只有这一列变,其余列纹丝不动,scrollX 同步涨
    api.setWidth('name', 300)
    expect(widths()).toEqual([70, 300, 150, undefined])
    expect(api.scrollX.value).toBe(70 + 300 + 150 + 90)

    // 收窄同理 —— 富余宽度由吸收列自然吃掉,不会被摊给别的列
    api.setWidth('name', 180)
    expect(widths()).toEqual([70, 180, 150, undefined])
    expect(api.scrollX.value).toBe(70 + 180 + 150 + 90)
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

  describe('吸收余量的列(B8,E1 / S1 的 dk 方案)', () => {
    const three = (): SmartTableColumn<Row>[] => [
      { key: 'name', title: 'N', width: 200 },
      { key: 'amt', title: 'A', width: 100 },
      { key: 'op', title: 'Op', width: 80, fixed: 'right' },
    ]
    const resizable = { resizable: () => true }

    it('吸收列 = 最后一个可见、非固定的叶子列:freezeWidths 跳过它(不冻结成实测宽);钉住后它不写 width,下限(声明宽)计入 scrollX', () => {
      const api = build(three(), undefined, {}, undefined, resizable)
      api.freezeWidths((k) => ({ name: 210, amt: 150, op: 80 })[k])
      expect(api.widths.value).toEqual({ name: 210, op: 80 }) // amt 没被冻结:冻结成 Naive 摊出来的实测宽会让它成为下限,拖别的列时它不肯缩(S1 实测溢出 61px)
      expect('width' in col(api, 'amt')).toBe(false) // 声明的 width:100 也被摘掉,交给浏览器弹性分配
      expect(col(api, 'name').width).toBe(210)
      expect(col(api, 'op').width).toBe(80)
      expect(api.absorberKey.value).toBe('amt')
      expect(api.scrollX.value).toBe(210 + 100 + 80) // 吸收列下限 = 声明宽 100
    })

    it('吸收列永远传 resizable:false(含还没钉住时):它没有拖拽把手,其它列照旧', () => {
      const api = build(three(), undefined, {}, undefined, resizable)
      expect(col(api, 'amt').resizable).toBe(false)
      expect(col(api, 'name').resizable).toBe(true)
      // 没钉住:吸收列照 2.1.1 写声明宽(Naive 自己按 width:100% 摊余量)
      expect(col(api, 'amt').width).toBe(100)
    })

    it('列上写 resizable: false 的列不参与吸收:未 fixed 的操作列被跳过,吸收列顺延到前一列(回退入口,S1 ⑦)', () => {
      const api = build(
        [
          { key: 'name', title: 'N', width: 200 },
          { key: 'amt', title: 'A', width: 100 },
          { key: 'op', title: 'Op', width: 80, resizable: false },
        ],
        undefined,
        {},
        undefined,
        resizable,
      )
      expect(api.absorberKey.value).toBe('amt')
      api.freezeWidths((k) => ({ name: 210, amt: 150, op: 80 })[k])
      expect(api.widths.value).toEqual({ name: 210, op: 80 }) // op 当普通列冻结,不参与吸收
    })

    it('[Review Focus 4] 隐藏最后一列 → 前一列顶上成为吸收列', () => {
      const api = build(
        [
          { key: 'a', title: 'A', width: 100 },
          { key: 'b', title: 'B', width: 100 },
          { key: 'c', title: 'C', width: 100 },
        ],
        undefined,
        {},
        undefined,
        resizable,
      )
      expect(api.absorberKey.value).toBe('c')
      api.toggleShow('c', false)
      expect(api.absorberKey.value).toBe('b')
      api.freezeWidths(() => 100)
      expect(api.widths.value).toEqual({ a: 100 }) // b 现在是最后一个可见列 → 吸收列,不钉
      expect('width' in col(api, 'b')).toBe(false)
    })

    it('固定与否以列设置为准:在设置里把声明了 fixed 的最后一列取消固定,它就是非固定列、成为吸收列;设成固定则让出吸收', () => {
      const api = build(three(), undefined, {}, undefined, resizable)
      expect(api.absorberKey.value).toBe('amt')
      api.setFixed('op', undefined) // 渲染上 op 已不再固定(toNaive 用的是设置里的值),吸收列也得跟着认
      expect(col(api, 'op').fixed).toBeUndefined()
      expect(api.absorberKey.value).toBe('op')
      api.setFixed('amt', 'left')
      api.setFixed('op', 'right')
      expect(api.absorberKey.value).toBe('name')
    })

    it('[Review Focus 4] 只有一列:它就是吸收列,freezeWidths 不钉它,表格不进入钉住态', () => {
      const api = build([{ key: 'name', title: 'N' }], undefined, {}, undefined, resizable)
      api.freezeWidths(() => 300)
      expect(api.widths.value).toEqual({})
      expect(api.pinned.value).toBe(false)
    })

    it('吸收列的陈旧宽度(上次会话存下的 / 调顺序后才成为吸收列的)只当下限:仍不写 width', () => {
      const api = build(
        [
          { key: 'a', title: 'A', width: 100 },
          { key: 'b', title: 'B', width: 100 },
        ],
        undefined,
        {},
        undefined,
        resizable,
      )
      api.freezeWidths(() => 100)
      api.setWidth('b', 260)
      expect(api.widths.value).toEqual({ a: 100, b: 260 })
      expect('width' in col(api, 'b')).toBe(false)
      expect(api.scrollX.value).toBe(100 + 260)
    })

    describe('退路:没有可拖的非固定列时,最后一个叶子列写显式宽度', () => {
      it('[Review Focus 4] 全部列都 fixed:显式宽 = max(下限, 容器宽 − 其余列宽 − 拖拽增量),且不冻结它', () => {
        const delta = ref(0) // 要是响应式的:useColumns 里的 naiveColumns 是 computed,普通变量变了它不会重算
        const api = build(
          [
            { key: 'a', title: 'A', width: 200, fixed: 'left' },
            { key: 'b', title: 'B', width: 200, fixed: 'right' },
          ],
          undefined,
          {},
          undefined,
          { ...resizable, hostWidth: () => 900, dragDelta: () => delta.value },
        )
        expect(api.absorberKey.value).toBe('b')
        api.freezeWidths((k) => ({ a: 200, b: 200 })[k])
        expect(api.widths.value).toEqual({ a: 200 }) // b 不冻结
        expect(col(api, 'b').width).toBe(700) // 900 − a(200)
        expect(api.scrollX.value).toBe(900)
        delta.value = 50 // 拖拽进行中,a 被拖宽了 50:SmartTable 会把 dragDelta 加进 scroll-x,吸收列让出这 50
        expect(col(api, 'b').width).toBe(650)
        delta.value = 0
        api.setWidth('a', 120)
        expect(col(api, 'b').width).toBe(780)
        expect(api.scrollX.value).toBe(900)
      })

      it('全部列都 fixed 且列宽之和已超过容器:不缩,取下限,横向滚动', () => {
        const api = build(
          [
            { key: 'a', title: 'A', width: 600, fixed: 'left' },
            { key: 'b', title: 'B', width: 600, fixed: 'right' },
          ],
          undefined,
          {},
          undefined,
          { ...resizable, hostWidth: () => 900 },
        )
        api.freezeWidths((k) => ({ a: 600, b: 600 })[k])
        expect(col(api, 'b').width).toBe(600)
        expect(api.scrollX.value).toBe(1200)
      })

      it('全部非固定列都写了 resizable: false(没有可拖的非固定列):同样走退路,取最后一个叶子列', () => {
        const api = build(
          [
            { key: 'c', title: 'C', width: 200, fixed: 'left' },
            { key: 'a', title: 'A', width: 200, resizable: false },
            { key: 'b', title: 'B', width: 200, resizable: false },
          ],
          undefined,
          {},
          undefined,
          { ...resizable, hostWidth: () => 1000 },
        )
        api.freezeWidths(() => 200)
        expect(api.absorberKey.value).toBe('b')
        expect(api.widths.value).toEqual({ c: 200, a: 200 }) // b 不冻结
        expect(col(api, 'b').width).toBe(600) // 1000 − c(200) − a(200)
      })
    })
  })

  describe('带图标列的拖拽下限(B12)', () => {
    it('headerIconFloor:仅排序 93、仅过滤 102、两者 123,都没有 0', () => {
      expect(headerIconFloor(false, false)).toBe(0)
      expect(headerIconFloor(false, true)).toBe(93)
      expect(headerIconFloor(true, false)).toBe(102)
      expect(headerIconFloor(true, true)).toBe(123)
    })

    it('可拖拽列的 minWidth = max(resizeMinWidth, 图标下限);列上显式 minWidth 不被覆盖', () => {
      const api = build(
        [
          { key: 'plain', title: 'P' },
          { key: 'sort', title: 'S', sorter: true },
          { key: 'filt', title: 'F', filter: true },
          { key: 'both', title: 'B', sorter: true, filter: true },
          { key: 'explicit', title: 'E', sorter: true, minWidth: 40 },
        ],
        { resizeMinWidth: 60 },
        {},
        undefined,
        { resizable: () => true },
      )
      expect(col(api, 'plain').minWidth).toBe(60)
      expect(col(api, 'sort').minWidth).toBe(93)
      expect(col(api, 'filt').minWidth).toBe(102)
      expect(col(api, 'both').minWidth).toBe(123)
      expect(col(api, 'explicit').minWidth).toBe(40)
    })

    it('不可拖拽的列不受影响(不补 minWidth)', () => {
      const api = build([{ key: 'sort', title: 'S', sorter: true }])
      expect('minWidth' in col(api, 'sort')).toBe(false)
    })
  })

  it('列被移除后,widths 里对应的旧宽度也跟着清掉,不会被新声明的同名列悄悄继承', () => {
    const columns = ref<SmartTableColumn<Row>[]>([
      { key: 'name', title: 'N', width: 100 },
      { key: 'amt', title: 'A', width: 100 },
    ])
    const api = useColumns<Row>({
      columns: () => columns.value,
      defaultDensity: () => 'comfortable',
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
    // 有意翻转(P-2):amt 现在是吸收列,钉住后不写 width;要锁的是它没继承陈旧的 240 —— 下限是它自己声明的 100
    expect('width' in col(api, 'amt')).toBe(false)
    expect(col(api, 'name').width).toBe(260)
    expect(api.scrollX.value).toBe(260 + 100)
  })
})
