import { computed, h, ref, watch, type ComputedRef, type Ref, type Slots, type VNodeChild } from 'vue'
import { NTag } from 'naive-ui'
import type { DataTableBaseColumn, DataTableColumn } from 'naive-ui'
import type {
  Density,
  FilterAction,
  FilterConfig,
  FilterFieldType,
  FilterMode,
  FilterRenderCtx,
  FilterValue,
  OptionsSource,
  SmartTableColumn,
  SmartTableDataColumn,
  SmartTableOption,
  SmartTableSpecialColumn,
  SearchConfig,
  SearchFieldType,
  SearchRenderCtx,
  SortItem,
} from './types'
import { applyFormat } from './format'
import { isFilterActive } from './filter'
import { findOption, optionLabel } from './useOptions'
import { clearState, loadState, mergeCols, peekStoredDensity, saveState, type DeclaredCol } from './storage'
import type { ResolvedSmartTableDefaults } from './config'

export function isSpecialColumn<T>(c: SmartTableColumn<T>): c is SmartTableSpecialColumn<T> {
  return 'type' in c && typeof (c as SmartTableSpecialColumn<T>).type === 'string'
}

/**
 * 特殊列在 Naive 内部的列 key —— 量宽度、钉宽度都要用它。
 * selection/expand 的 key 由 Naive 自己生成(见其 utils.getColKey),这里对齐。
 */
export function specialColumnKey<T>(col: SmartTableSpecialColumn<T>): string {
  if (col.type === 'selection') return '__n_selection__'
  if (col.type === 'expand') return '__n_expand__'
  return '__index'
}

/* ======================== 搜索项派生 ======================== */

export interface SearchDef {
  /** 搜索参数名(search.key ?? 列 key)。 */
  key: string
  /** 字典查找键(始终是列 key,options 挂在列上)。 */
  optionsKey: string
  label?: string | (() => VNodeChild)
  type: SearchFieldType
  placeholder?: string
  defaultValue?: unknown
  span: number
  props?: Record<string, unknown>
  render?: (ctx: SearchRenderCtx) => VNodeChild
}

/** 从列定义派生搜索项:带 search 的数据列(含 hideInTable/hide 的)。 */
export function deriveSearchDefs<T>(columns: SmartTableColumn<T>[]): SearchDef[] {
  const defs: Array<SearchDef & { sortKey: number }> = []
  columns.forEach((col, idx) => {
    if (isSpecialColumn(col) || !col.search) return
    const cfg: SearchConfig = col.search === true ? {} : col.search
    defs.push({
      key: cfg.key ?? col.key,
      optionsKey: col.key,
      label: cfg.label ?? col.title,
      type: cfg.type ?? (col.options ? 'select' : 'input'),
      placeholder: cfg.placeholder,
      defaultValue: cfg.defaultValue,
      span: cfg.span ?? 1,
      props: cfg.props,
      render: cfg.render,
      // 显式 order 排前段(小的在前),未指定的按声明顺序排后段
      sortKey: cfg.order ?? 1_000_000 + idx,
    })
  })
  return defs.sort((a, b) => a.sortKey - b.sortKey).map(({ sortKey: _sortKey, ...d }) => d)
}

/** 搜索参数初值:defaultValue ?? null(null 保证 Naive 控件受控)。 */
export function deriveInitParams(defs: SearchDef[]): Record<string, any> {
  const out: Record<string, any> = {}
  for (const d of defs) out[d.key] = d.defaultValue ?? null
  return out
}

/**
 * 收集列上的字典源(列 key → OptionsSource)。
 * filter.options 单独覆写时挂在 `__filter:{列 key}` 下,与单元格翻译用的字典互不干扰。
 */
export function deriveOptionsSources<T>(columns: SmartTableColumn<T>[]): Record<string, OptionsSource> {
  const out: Record<string, OptionsSource> = {}
  for (const col of columns) {
    if (isSpecialColumn(col)) continue
    if (col.options) out[col.key] = col.options
    const cfg = typeof col.filter === 'object' ? col.filter : undefined
    if (cfg?.options) out[filterOptionsKey(col.key)] = cfg.options
  }
  return out
}

/* ======================== 过滤项派生 ======================== */

/** filter.options 覆写时的字典键 —— 与列自身 options 分开缓存。 */
export function filterOptionsKey(colKey: string): string {
  return `__filter:${colKey}`
}

/** 各值类型的默认可选动作(对齐 Bootstrap Blazor 的过滤器分类)。 */
const DEFAULT_ACTIONS: Record<FilterFieldType, FilterAction[]> = {
  input: ['contains', 'notContains', 'equal', 'notEqual'],
  number: ['equal', 'notEqual', 'gt', 'gte', 'lt', 'lte'],
  date: ['equal', 'notEqual', 'gt', 'gte', 'lt', 'lte'],
  select: ['equal', 'notEqual'],
}

/** 一列的过滤项(表头面板渲染 + 本地过滤 + 远程序列化共用)。 */
export interface FilterDef<T = any> {
  /** 过滤态的键 / 远程参数字段名(filter.key ?? 列 key)。 */
  key: string
  /** 行数据字段名(始终是列 key),本地过滤取值用。 */
  field: string
  /** 字典查找键:filter.options 覆写时为 `__filter:{列 key}`,否则列 key。 */
  optionsKey: string
  title?: string | (() => VNodeChild)
  mode: FilterMode
  multiple: boolean
  type: FilterFieldType
  actions: FilterAction[]
  defaultValue?: FilterValue | null
  props?: Record<string, unknown>
  render?: (ctx: FilterRenderCtx) => VNodeChild
  filter?: (value: FilterValue, row: T) => boolean
}

/**
 * 从列定义派生过滤项:带 filter 且会进表格的数据列(hideInTable 的列没有表头,不参与)。
 * mode 缺省按有无字典推断;condition 模式的值控件类型缺省按 format 推断。
 */
export function deriveFilterDefs<T>(columns: SmartTableColumn<T>[]): FilterDef<T>[] {
  const defs: FilterDef<T>[] = []
  // 多级表头:filter 只可能声明在叶子列上,分组表头(有 children)只递归、自身不产出 def,
  // 与 toNaive/freezeWidths 对 children 的递归口径保持一致。
  const walk = (cols: SmartTableColumn<T>[]) => {
    for (const col of cols) {
      if (isSpecialColumn(col)) continue
      if (col.children?.length) {
        walk(col.children)
        continue
      }
      if (!col.filter || col.hideInTable) continue
      const cfg: FilterConfig<T> = col.filter === true ? {} : col.filter
      const hasOptions = !!(cfg.options ?? col.options)
      const mode: FilterMode = cfg.mode ?? (hasOptions ? 'options' : 'condition')
      const type: FilterFieldType =
        cfg.type ??
        (hasOptions
          ? 'select'
          : col.format === 'date' || col.format === 'datetime'
            ? 'date'
            : col.format === 'money'
              ? 'number'
              : 'input')
      defs.push({
        key: cfg.key ?? col.key,
        field: col.key,
        optionsKey: cfg.options ? filterOptionsKey(col.key) : col.key,
        title: col.title,
        mode,
        multiple: cfg.multiple ?? true,
        type,
        // 拷贝一份:DEFAULT_ACTIONS[type] 是模块级共享数组,deriveFilterDefs/FilterDef
        // 是导出的公开 API,调用方 mutate 返回的 actions 不该污染其它列/其它实例。
        actions: cfg.actions?.length ? cfg.actions : [...DEFAULT_ACTIONS[type]],
        defaultValue: cfg.defaultValue ?? null,
        props: cfg.props,
        render: cfg.render,
        filter: cfg.filter,
      })
    }
  }
  walk(columns)
  return defs
}

/** 过滤项初值:有 defaultValue 的列进初始过滤态。 */
export function deriveInitFilters<T>(defs: FilterDef<T>[]): Record<string, FilterValue> {
  const out: Record<string, FilterValue> = {}
  for (const d of defs) {
    // 与 useFilters 里「列定义后追加时」的补种口径一致:条件全空的 defaultValue 视为不生效,
    // 否则同一份配置会因「初始挂载」还是「后续追加」而给出不同的初始过滤态。
    if (d.defaultValue && isFilterActive(d.defaultValue)) out[d.key] = d.defaultValue
  }
  return out
}

/* ======================== 列派生中枢 ======================== */

export interface SettingItem {
  key: string
  title?: string | (() => VNodeChild)
  show: boolean
  fixed?: 'left' | 'right'
}

export interface UseColumnsOpts<T> {
  columns: () => SmartTableColumn<T>[]
  storageKey?: string
  /** 宿主给的密度(getter:响应式;没有密度按钮时它就是当前值)。 */
  defaultDensity: () => Density
  /** 是否让存储里的 density 优先(仅 toolbar.density === true 时为 true);缺省 false = 忽略存储里的密度。 */
  respectStoredDensity?: () => boolean
  getOptions: (key: string) => SmartTableOption[]
  slots: Slots
  /** index 特殊列的序号偏移(远程分页 = (page-1)*pageSize)。 */
  indexOffset: () => number
  /** 全局默认值(align/emptyText/tag/宽度兜底等),已含内置兜底。 */
  defaults: ResolvedSmartTableDefaults
  /** 当前受控排序态(sorter 列箭头回显,多列同时回显);getter 保证 computed 内追踪。 */
  sortState?: () => SortItem[]
  /** 当前过滤项;有 def 的列表头会挂过滤入口。getter 保证 computed 内追踪。 */
  filterDefs?: () => FilterDef<T>[]
  /** 渲染表头过滤入口(由 SmartTable 提供,useColumns 不直接依赖 SFC)。 */
  renderFilter?: (def: FilterDef<T>) => VNodeChild
  /** 表级列宽拖拽开关;列上显式 resizable 优先。 */
  resizable?: () => boolean
}

export interface UseColumnsReturn<T> {
  density: ComputedRef<Density>
  setDensity: (d: Density) => void
  settingItems: ComputedRef<SettingItem[]>
  toggleShow: (key: string, show: boolean) => void
  moveCheck: (from: number, to: number) => void
  setFixed: (key: string, fixed?: 'left' | 'right') => void
  resetSettings: () => void
  /** 列 key → 拖拽后的宽度(px)。 */
  widths: Ref<Record<string, number>>
  /** 记录拖拽宽度(写 localStorage 做了防抖,高频 mousemove 不会打爆存储)。 */
  setWidth: (key: string, width: number) => void
  /** 把还没有显式宽度的可见列钉成当前实际渲染宽度(拖拽开始时调用)。 */
  freezeWidths: (measure: (key: string) => number | undefined) => void
  /** 是否已进入「列宽钉住」态(拖过一次列宽之后)。 */
  pinned: ComputedRef<boolean>
  naiveColumns: ComputedRef<DataTableColumn<T>[]>
  scrollX: ComputedRef<number>
}

export function useColumns<T>(opts: UseColumnsOpts<T>): UseColumnsReturn<T> {
  const d = opts.defaults
  const stored = opts.storageKey ? loadState(opts.storageKey, opts.defaultDensity()) : null
  // 用户改过的列状态(可能落后于最新列声明,effectiveChecks 里始终重新 merge)
  const checks = ref<DeclaredCol[]>(stored?.cols ?? [])
  // 用户在密度按钮上选的值:仅当开了密度按钮(respectStoredDensity)时才读存储;其余情况取宿主的值。
  // 存储格式里的 density 字段仍照常写入(不动 VERSION),只是读取时不采用。
  const userDensity = ref<Density | null>(opts.respectStoredDensity?.() ? (stored?.density ?? null) : null)
  const density = computed<Density>(() => userDensity.value ?? opts.defaultDensity())
  // 写回存储的 density:只有两个来源 —— 存储里原有的值,或用户在密度按钮上选的值(setDensity)。
  // 保存列设置 / 列宽时绝不把宿主给的 defaultDensity 当成用户的选择写进去;
  // 没有存储记录、用户也没选过 → undefined,saveState 不写这个字段。
  let storedDensity: Density | undefined = opts.storageKey ? peekStoredDensity(opts.storageKey) : undefined
  const widths = ref<Record<string, number>>({ ...stored?.widths })

  const dataCols = computed(() =>
    opts.columns().filter((c): c is SmartTableDataColumn<T> => !isSpecialColumn(c) && !c.hideInTable),
  )
  const specialCols = computed(() => opts.columns().filter(isSpecialColumn))
  const managedCols = computed(() => dataCols.value.filter((c) => !c.hideInSetting))

  const declaredChecks = computed<DeclaredCol[]>(() =>
    managedCols.value.map((c) => ({
      key: c.key,
      show: !c.hide,
      fixed: c.fixed === 'left' || c.fixed === 'right' ? c.fixed : undefined,
    })),
  )

  // 声明与存储/用户态的合并结果 —— 列增删后依然一致
  const effectiveChecks = computed(() => mergeCols(declaredChecks.value, checks.value))

  /**
   * 「列宽钉住」态:拖过一次之后每列都有确定宽度,表格随之切到 table-layout:fixed
   * 且宽度写死成列宽之和(见 SmartTable)。此态下每一列都必须给得出具体宽度。
   */
  const pinned = computed(() => Object.keys(widths.value).length > 0)

  /**
   * 叶子数据列的最终宽度。toNaive 与 scrollX 共用这一套口径 —— 两者一旦对不上,
   * 差额就会被表格摊回各列,拖一列左侧的列跟着动。
   */
  function leafWidth(col: SmartTableDataColumn<T>, fixed?: 'left' | 'right'): number | undefined {
    const w = widths.value[col.key]
    if (w !== undefined) return w
    if (col.width !== undefined) return Number(col.width)
    // 固定列必须有具体宽度(否则 Naive 固定列错位);钉住态下所有列同理
    if (fixed || pinned.value) return Number(col.minWidth ?? d.fixedFallbackWidth)
    return undefined
  }

  /** 特殊列(序号/勾选/展开)的最终宽度,同样两处共用。 */
  function specialWidth(col: SmartTableSpecialColumn<T>): number {
    return Number(widths.value[specialColumnKey(col)] ?? col.width ?? d.indexWidth)
  }

  function persist(next: DeclaredCol[]) {
    checks.value = next
    if (opts.storageKey) saveState(opts.storageKey, storedDensity, next, widths.value)
  }

  function setDensity(next: Density) {
    userDensity.value = next
    storedDensity = next
    if (opts.storageKey) saveState(opts.storageKey, next, effectiveChecks.value, widths.value)
  }

  // 列宽拖拽期间 mousemove 每帧都回调,localStorage 写入必须防抖(内存态仍即时更新)
  let persistWidthTimer: ReturnType<typeof setTimeout> | undefined
  function setWidth(key: string, width: number) {
    if (widths.value[key] === width) return
    widths.value = { ...widths.value, [key]: width }
    if (!opts.storageKey) return
    clearTimeout(persistWidthTimer)
    persistWidthTimer = setTimeout(() => {
      saveState(opts.storageKey!, storedDensity, effectiveChecks.value, widths.value)
    }, 300)
  }

  function toggleShow(key: string, show: boolean) {
    persist(effectiveChecks.value.map((c) => (c.key === key ? { ...c, show } : c)))
  }

  function moveCheck(from: number, to: number) {
    const next = [...effectiveChecks.value]
    const [moved] = next.splice(from, 1)
    if (!moved) return
    next.splice(to, 0, moved)
    persist(next)
  }

  function setFixed(key: string, fixed?: 'left' | 'right') {
    persist(effectiveChecks.value.map((c) => (c.key === key ? { ...c, fixed } : c)))
  }

  /**
   * 列宽拖拽开始前,把所有可见叶子列钉成「当前实际渲染宽度」。
   *
   * 为什么必须做:表格是 table-layout:fixed + width:100%,声明宽度之和小于容器时,
   * 浏览器会把富余宽度按比例摊给每一列 —— 实际渲染宽度因此大于声明宽度。
   * Naive 拖拽时以「实际宽度 + 位移」为新宽度,却把该列钉死成这个值、其余列继续摊,
   * 于是一拖就跳、手柄跟不上鼠标。先全部钉成实际宽度,声明之和 == 容器宽度,
   * 摊派消失,之后每一像素位移都 1:1 落到列宽上。
   */
  function freezeWidths(measure: (key: string) => number | undefined) {
    const next = { ...widths.value }
    let changed = false
    // 多级表头:宽度挂在叶子列上,和 scrollX 的口径保持一致
    const walk = (cols: SmartTableDataColumn<T>[]) => {
      for (const col of cols) {
        if (col.children?.length) {
          walk(col.children)
          continue
        }
        if (next[col.key] !== undefined) continue
        const w = measure(col.key)
        if (typeof w === 'number' && w > 0) {
          next[col.key] = Math.round(w)
          changed = true
        }
      }
    }
    walk(orderedVisibleData.value.map((r) => r.col))
    // 特殊列(序号/勾选/展开)同样要钉:漏掉哪怕一列,它的「实际宽 - 声明宽」
    // 就是残余富余量,会继续摊给所有列 —— 表现就是拖一列、其余列跟着动。
    for (const col of specialCols.value) {
      const key = specialColumnKey(col)
      if (next[key] !== undefined) continue
      const w = measure(key)
      if (typeof w === 'number' && w > 0) {
        next[key] = Math.round(w)
        changed = true
      }
    }
    if (changed) widths.value = next
  }

  function resetSettings() {
    checks.value = []
    widths.value = {}
    clearTimeout(persistWidthTimer)
    if (opts.storageKey) clearState(opts.storageKey)
    storedDensity = undefined
  }

  /**
   * 列被移除(不再声明)后,widths 里那份旧宽度要跟着清掉 —— 不然要是之后一个新列复用了
   * 同一个 key,会莫名其妙地继承一份自己从没拖过的宽度;effectiveChecks/mergeCols 对
   * 列设置(checks)本身已经做了这层过滤,widths 之前一直没有对应的清理入口。
   * immediate:mount 时也顺手清一遍上一次会话留下的、对应列已经不在了的陈旧宽度。
   */
  watch(
    () => opts.columns(),
    () => {
      const validKeys = new Set<string>(specialCols.value.map(specialColumnKey))
      const walk = (cols: SmartTableDataColumn<T>[]) => {
        for (const col of cols) {
          if (col.children?.length) walk(col.children)
          else validKeys.add(col.key)
        }
      }
      walk(dataCols.value)

      const staleKeys = Object.keys(widths.value).filter((k) => !validKeys.has(k))
      if (staleKeys.length === 0) return
      const next = { ...widths.value }
      staleKeys.forEach((k) => delete next[k])
      widths.value = next
      if (opts.storageKey) saveState(opts.storageKey, storedDensity, effectiveChecks.value, next)
    },
    // sync:同步清理,不等下一轮 flush —— 否则列刚被移除的这一帧,naiveColumns/scrollX
    // 还能读到那份陈旧宽度,可能闪一下不该出现的列宽再恢复。
    { immediate: true, flush: 'sync' },
  )

  const settingItems = computed<SettingItem[]>(() => {
    const titleByKey = new Map(managedCols.value.map((c) => [c.key, c.title]))
    return effectiveChecks.value.map((c) => ({ ...c, title: titleByKey.get(c.key) }))
  })

  /* ---- 数据列 → Naive 列 ---- */

  function toNaive(col: SmartTableDataColumn<T>, override?: { fixed?: 'left' | 'right' }): DataTableColumn<T> {
    const {
      key,
      title,
      render,
      format,
      options,
      tag,
      hide: _hide,
      hideInTable: _hideInTable,
      hideInSetting: _hideInSetting,
      search: _search,
      // 本包接管的表头过滤配置(FilterConfig),类型上已 Omit<..., 'filter'> 不继承 Naive
      // 同名属性 —— 这里必须同样从 rest 里摘掉,否则会原样透传给 n-data-table,撞上它自己
      // 内部的 filter/filterOptions/uncontrolledFilterStateRef 机制。
      filter: _filter,
      children,
      ...naiveRest
    } = col

    const result: Record<string, any> = {
      ...naiveRest,
      key,
      title: title as DataTableBaseColumn<T>['title'],
      titleAlign: naiveRest.titleAlign ?? d.titleAlign, // 表头默认对齐,用户显式值优先
      align: naiveRest.align ?? d.align, // 单元格默认对齐,用户显式值优先
    }

    // 列表头自定义:#header-{key} 插槽(列已声明函数 title 时不覆盖)
    const headerSlot = opts.slots[`header-${key}`]
    if (headerSlot && typeof title !== 'function') {
      result.title = () => headerSlot({ column: col })
    }

    // 受控排序:sorter 列的箭头由 sortState 决定(远程模式非受控箭头会漂);多列时每列各自回显
    if (naiveRest.sorter != null && (naiveRest.sorter as unknown) !== false) {
      const hit = opts.sortState?.().find((s) => s.field === key)
      result.sortOrder = hit ? hit.order : false
    }

    if (children?.length) {
      result.children = children.map((c) => toNaive(c))
      return result as DataTableColumn<T>
    }

    // 表头过滤入口:标题后挂漏斗。包一层是为了 sorter 列点漏斗不会连带触发排序
    // (ColumnFilter 内部 stopPropagation),同时让漏斗贴着标题而不是被 th 撑开。
    const filterDef = opts.filterDefs?.().find((f) => f.field === key)
    if (filterDef && opts.renderFilter) {
      const baseTitle = result.title as string | ((c: unknown) => VNodeChild) | undefined
      result.title = (c: unknown) =>
        h('span', { class: 'smart-table-th' }, [
          typeof baseTitle === 'function' ? baseTitle(c) : baseTitle,
          opts.renderFilter!(filterDef),
        ])
    }

    // 列宽拖拽:列显式 resizable 优先于表级开关;拖过的宽度回填成 width,
    // 刷新页面后(Naive 内部拖拽态已清空)仍由它还原。
    const resizable = naiveRest.resizable ?? opts.resizable?.() ?? false
    result.resizable = resizable
    // 没有下限时能被拖成 0 宽,列头直接消失且拖不回来
    if (resizable && result.minWidth === undefined) result.minWidth = d.resizeMinWidth

    const fixed = override && 'fixed' in override ? override.fixed : col.fixed
    result.fixed = fixed
    const width = leafWidth(col, fixed)
    if (width !== undefined) result.width = width

    const slot = opts.slots[`cell-${key}`]
    if (render || slot || options || format) {
      result.render = (row: T, rowIndex: number): VNodeChild => {
        if (render) return render(row, rowIndex)
        if (slot) return slot({ row, index: rowIndex })
        const value = (row as Record<string, unknown>)[key]
        if (options) {
          if (value === null || value === undefined) return d.emptyText
          const hit = findOption(opts.getOptions(key), value as SmartTableOption['value'])
          if (!hit) return String(value)
          const label = optionLabel(hit)
          return tag
            ? h(NTag, { type: hit.tagType ?? 'default', size: d.tag.size, bordered: d.tag.bordered }, () => label)
            : label
        }
        // 此处必有 format
        if (value === null || value === undefined) return d.emptyText
        return applyFormat(format!, value, row)
      }
    }
    return result as DataTableColumn<T>
  }

  function specialToNaive(col: SmartTableSpecialColumn<T>): DataTableColumn<T> {
    const { type, title, renderExpand, ...rest } = col
    // 钉住的宽度优先于声明宽度(freezeWidths 之后每一列都有确定宽度,富余量为 0)
    const width = specialWidth(col)
    if (type === 'index') {
      return {
        ...rest,
        key: '__index',
        title: (title ?? '#') as DataTableBaseColumn<T>['title'],
        width,
        align: (rest.align as 'left' | 'center' | 'right' | undefined) ?? d.align,
        render: (_row: T, rowIndex: number) => opts.indexOffset() + rowIndex + 1,
      } as DataTableColumn<T>
    }
    // 勾选/展开列缺省由 Naive 自己定宽,只有钉住态才写死,免得平时改了它的默认观感
    const pinnedWidth = pinned.value ? { width } : {}
    // 显式给 key:Naive 内部的列宽拖拽回调(handleColumnResizeStart/handleColumnResize)
    // 直接读 column.key,不会像 getColKey 那样替它们兜底成 __n_selection__/__n_expand__ ——
    // 少这个 key,可拖拽的勾选/展开列一拖，onColumnResize 就因 key 是 undefined 而整段跳过。
    const key = specialColumnKey(col)
    // Naive 的 TableExpandColumn/TableSelectionColumn 类型声明里没有 key 字段(它按内部约定
    // 自己认 __n_expand__/__n_selection__),但运行时的拖拽回调确实直接读 column.key ——
    // 类型声明与运行时用法在这一点上不一致,只能整体转 unknown 再转回目标类型。
    if (type === 'expand') {
      return { ...rest, key, type: 'expand', ...pinnedWidth, renderExpand } as unknown as DataTableColumn<T>
    }
    return { ...rest, key, type: 'selection', ...pinnedWidth } as unknown as DataTableColumn<T>
  }

  /** 最终列:特殊列(声明序,恒在前)+ 数据列(managed 按设置排序,hideInSetting 保持声明位)。 */
  const orderedVisibleData = computed<Array<{ col: SmartTableDataColumn<T>; fixed?: 'left' | 'right'; managed: boolean }>>(() => {
    const cols = dataCols.value
    const eff = effectiveChecks.value
    const colByKey = new Map(cols.map((c) => [c.key, c]))
    const managedSlots: number[] = []
    cols.forEach((c, i) => {
      if (!c.hideInSetting) managedSlots.push(i)
    })
    const result: Array<{ col: SmartTableDataColumn<T>; fixed?: 'left' | 'right'; managed: boolean } | undefined> = new Array(
      cols.length,
    )
    cols.forEach((c, i) => {
      if (c.hideInSetting) result[i] = { col: c, fixed: c.fixed === 'left' || c.fixed === 'right' ? c.fixed : undefined, managed: false }
    })
    eff.forEach((chk, orderIdx) => {
      const slot = managedSlots[orderIdx]
      const col = colByKey.get(chk.key)
      if (slot === undefined || !col) return
      result[slot] = chk.show ? { col, fixed: chk.fixed, managed: true } : undefined
    })
    return result.filter((r): r is NonNullable<typeof r> => r !== undefined)
  })

  const naiveColumns = computed<DataTableColumn<T>[]>(() => [
    ...specialCols.value.map(specialToNaive),
    ...orderedVisibleData.value.map(({ col, fixed, managed }) => toNaive(col, managed ? { fixed } : undefined)),
  ])

  /** auto scrollX = Σ可见叶子列 (width ?? minWidth ?? 兜底宽);特殊列缺省按 indexWidth。 */
  const scrollX = computed(() => {
    let sum = 0
    for (const col of specialCols.value) sum += specialWidth(col)
    const walk = (cols: SmartTableDataColumn<T>[]) => {
      for (const c of cols) {
        if (c.children?.length) walk(c.children)
        // 未钉住且没写宽度的列,leafWidth 返回 undefined —— scroll-x 仍按兜底宽估算
        else sum += leafWidth(c, c.fixed) ?? Number(c.minWidth ?? d.fixedFallbackWidth)
      }
    }
    walk(orderedVisibleData.value.map((r) => r.col))
    return sum
  })

  return {
    density,
    setDensity,
    settingItems,
    toggleShow,
    moveCheck,
    setFixed,
    resetSettings,
    widths,
    setWidth,
    freezeWidths,
    pinned,
    naiveColumns,
    scrollX,
  }
}

/** 占位列的 key。它不进列设置、不排序、不过滤、不可拖拽,只负责把表格填满容器。 */
export const FILLER_COLUMN_KEY = '__smart_filler'

/**
 * 列宽钉住(table-layout: fixed + 表格宽度 = 各列宽之和)后,列宽之和小于容器时补一列占位,
 * 把富余宽度独自吃掉:表头底色、行底色、边框都铺到容器右缘,而每一列仍是拖出来的精确宽度。
 * 不补的话表格右侧就是一块空白,补进真实列则会把富余摊回各列,拖一列会牵动其它列。
 *
 * 插在右固定列这一串的最前面 —— 找的是从数组末尾往前数、连续都是 fixed:'right' 的那一段
 * 的起点,而不是第一个匹配项:右固定列理应声明在最后,但没有任何校验强制这一点,若中间也混了
 * 一个 fixed:'right'(声明顺序或列设置里拖拽出来的),占位列仍要落在真正的尾部之前,不能卡在
 * 表格中间把后续的非固定列隔断。`allowExport: false` 让它不进 downloadCsv 导出。
 * width <= 0 时原样返回。
 */
export function withFillerColumn<T>(columns: DataTableColumn<T>[], width: number): DataTableColumn<T>[] {
  if (!(width > 0)) return columns
  const filler: DataTableBaseColumn<T> = {
    key: FILLER_COLUMN_KEY,
    title: '',
    width,
    className: 'smart-table-filler-col',
    allowExport: false,
    render: () => null,
  }
  let at = columns.length
  while (at > 0 && columns[at - 1].fixed === 'right') at--
  return [...columns.slice(0, at), filler, ...columns.slice(at)]
}
