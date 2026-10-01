<script setup lang="ts" generic="T">
// 唯一胶水层:useSmartTable(数据)+ useOptions(字典)+ useColumns(列/设置)组装。
// props 用运行时声明 + PropType:泛型 + 复杂导入类型下比纯类型声明稳。
import {
  computed,
  h,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  readonly,
  toValue,
  useAttrs,
  useSlots,
  watch,
  type PropType,
  type Slots,
} from 'vue'
import { NCard, NDataTable, NPagination } from 'naive-ui'
import type { CardProps, DataTableInst, DropdownOption, PaginationInfo, PaginationProps } from 'naive-ui'
import type {
  Density,
  FilterState,
  FilterValue,
  SmartTableColumn,
  SmartTableDataColumn,
  SmartTableFetcher,
  SmartTableLabels,
  SmartTableOption,
  SearchFormConfig,
  SortItem,
  ToolbarConfig,
} from './types'
import { cleanParams, useSmartTable } from './useSmartTable'
import { optionLabel, useOptions } from './useOptions'
import {
  deriveFilterDefs,
  deriveInitParams,
  deriveOptionsSources,
  deriveSearchDefs,
  useColumns,
  withFillerColumn,
  type FilterDef,
} from './useColumns'
import { applyFilters } from './filter'
import { buildChips, hasActiveDefaults, removeChipCondition } from './filterChips'
import { mergeCardProps } from './cardStyle'
import { mergePageSizes, resolveDefaultPageSize } from './pageSize'
import { collectSorters, deriveInitSorts, normalizeSorterEvent, sortToParams, sortTransition } from './sorts'
import { useFilters } from './useFilters'
import { mergeLabels } from './labels'
import { useSmartTableDefaults } from './config'
import SearchForm from './SearchForm.vue'
import Toolbar from './Toolbar.vue'
import ColumnSettings from './ColumnSettings.vue'
import ColumnFilter from './ColumnFilter.vue'
import FilterChips from './FilterChips.vue'
import { ref } from 'vue'
import { useRowDrag } from './useRowDrag'

defineOptions({ name: 'SmartTable', inheritAttrs: false })

const props = defineProps({
  columns: { type: Array as PropType<SmartTableColumn<T>[]>, required: true },
  fetcher: { type: Function as PropType<SmartTableFetcher<T>>, default: undefined },
  data: { type: Array as PropType<T[]>, default: undefined },
  rowKey: { type: [String, Function] as PropType<string | ((row: T) => string | number)>, default: 'id' },
  params: { type: Object as PropType<Record<string, any>>, default: undefined },
  immediate: { type: Boolean, default: true },
  defaultPageSize: { type: Number, default: undefined },
  pagination: { type: [Boolean, Object] as PropType<false | Partial<PaginationProps>>, default: undefined },
  search: { type: [Boolean, Object] as PropType<false | SearchFormConfig>, default: undefined },
  filter: { type: Boolean, default: undefined },
  filterChips: { type: Boolean, default: undefined },
  toolbar: { type: [Boolean, Object] as PropType<false | ToolbarConfig>, default: undefined },
  title: { type: String, default: undefined },
  cardProps: { type: Object as PropType<Partial<CardProps>>, default: undefined },
  storageKey: { type: String, default: undefined },
  defaultDensity: { type: String as PropType<Density>, default: undefined },
  labels: { type: Object as PropType<Partial<SmartTableLabels>>, default: undefined },
  activeRowKey: { type: [String, Number] as PropType<string | number | null>, default: undefined },
  rowDraggable: { type: Boolean, default: false },
  dragHandle: { type: String, default: undefined },
  resizable: { type: Boolean, default: undefined },
  filterSerializer: {
    type: Function as PropType<(state: FilterState) => Record<string, any>>,
    default: undefined,
  },
})

const emit = defineEmits<{
  search: [params: Record<string, any>]
  reset: []
  loaded: [rows: T[], total: number]
  error: [err: unknown]
  rowClick: [row: T, index: number]
  rowDragSort: [e: { from: number; to: number; reordered: T[] }]
  /** 某列过滤变化;key 为过滤键(clearFilters 时为空串),state 是变更后的全表过滤态。 */
  filterChange: [key: string, value: FilterValue | null, state: FilterState]
  /** 拖拽调整列宽(拖动过程中持续触发,与 Arco 的 column-resize 一致)。 */
  columnResize: [key: string, width: number]
  /** 「更多」菜单(toolbar.more)选中某项。 */
  moreSelect: [key: string | number, option: DropdownOption]
}>()

// 仅声明插槽类型(对外):cell-* / header-* 是按列 key 动态读取的,模板里没有对应 <slot>,
// 不声明的话宿主写 #cell-name 会被 vue-tsc / Volar 报「插槽不存在」。
// 返回值用 any(Vue 文档的 defineSlots 写法):写 VNodeChild 时,dts 生成所用的 language-core
// 会把 useSlots() 推断成这里的类型,与下方的 Slots(要求返回 VNode[])不兼容而报 TS2322。
defineSlots<{
  title?: () => any
  /** 工具栏左侧 */
  toolbar?: () => any
  /** 工具栏右侧,内置按钮之前 */
  'toolbar-right'?: () => any
  empty?: () => any
  /** 分页栏左侧 */
  'pagination-prefix'?: (info: PaginationInfo) => any
  /** 自定义单元格:#cell-{列 key} */
  [cell: `cell-${string}`]: ((props: { row: T; index: number }) => any) | undefined
  /** 自定义表头:#header-{列 key} */
  [header: `header-${string}`]: ((props: { column: SmartTableDataColumn<T> }) => any) | undefined
}>()

// 显式标注:slots 进入 useColumns 又参与 expose 类型,dts 生成会因自引用推断报 TS7022
const slots: Slots = useSlots()
const attrs = useAttrs()

const defaults = useSmartTableDefaults()

const isRemote = computed(() => !!props.fetcher)
const mergedCardProps = computed(() => mergeCardProps(props.cardProps))
// 三层合并:内置 < 全局默认(defaults.labels,渲染期 toValue 解引用保持 locale 响应)< 实例 prop
const mergedLabels = computed(() => mergeLabels(props.labels, toValue(defaults.labels)))

// 初始每页条数(D4):首次 setup 时解析一次。远程模式它就是首个请求的 pageSize(也解决了 pagination.pageSize 与首个请求不一致);
// 本地模式它是 localPageSize 的初值(解决 pagination.defaultPageSize 被受控 pageSize 盖掉)。
const userPagination = typeof props.pagination === 'object' ? props.pagination : undefined
const initialPageSize = resolveDefaultPageSize({
  prop: props.defaultPageSize,
  pageSize: userPagination?.pageSize,
  defaultPageSize: userPagination?.defaultPageSize,
  pageSizes: userPagination?.pageSizes,
  globalDefaultPageSize: defaults.defaultPageSize,
  globalPageSizes: defaults.pageSizesGiven ? defaults.pageSizes : undefined,
})

/* ---- 搜索项与数据核 ---- */

const searchDefs = computed(() => deriveSearchDefs(props.columns))

// 排序状态(受控):sorter 列点表头 → 写这里 → 并进 fetcher 参数 + 回显箭头。
// 数组,顺序 = 优先级(列声明的 sorter.multiple 从大到小);初值来自列上的 defaultSortOrder(C2,只在首次 setup 读一次)。
// 不持久化(会话态,与过滤态一致)。
const sortState = ref<SortItem[]>(deriveInitSorts(props.columns))
const sorterInfo = computed(() => collectSorters(props.columns))
function applySorts(items: SortItem[]) {
  sortState.value = items
  if (isRemote.value) void table.search()
}

/* ---- 表头过滤 ---- */

// 表级开关(实例 prop > 全局默认):关掉后列上的 filter 声明一并失效 ——
// 没有漏斗、不参与本地过滤、也不进请求参数。与 :search="false" 同一套语义。
const filterEnabled = computed(() => props.filter ?? defaults.filterable)

const filterDefs = computed(() => (filterEnabled.value ? deriveFilterDefs(props.columns) : []))

const filters = useFilters<T>({
  defs: () => filterDefs.value,
  onChange: (key, value, state) => {
    // 筛选后的分页行为:宿主显式传了官方 paginationBehaviorOnFilter 就照官方;没传保持库现状
    // (远程回第 1 页;本地不动,页码由 Naive 夹回合法范围)。这是对官方默认值 'current' 的有意偏离,只发生在 remote。
    const behavior = (attrs.paginationBehaviorOnFilter ?? attrs['pagination-behavior-on-filter']) as
      | 'first'
      | 'current'
      | undefined
    if (isRemote.value) void (behavior === 'current' ? table.load() : table.search())
    else if (behavior === 'first') {
      localPage.value = 1
      tableRef.value?.page(1)
    }
    emit('filterChange', key, value, state)
  },
})

/** 远程模式下过滤态 → 请求参数;实例 prop 的序列化器优先于全局默认。 */
function filterToParams(): Record<string, any> {
  return (props.filterSerializer ?? defaults.filterSerializer)(filters.state.value)
}

const table = useSmartTable<T>(
  // 包一层保证始终取最新的 props.fetcher(模板内联箭头每次渲染都是新引用)
  (p) => props.fetcher!(p),
  {
    initParams: deriveInitParams(searchDefs.value),
    extraParams: () => ({ ...(props.params ?? {}), ...sortToParams(sortState.value), ...filterToParams() }),
    immediate: isRemote.value && props.immediate,
    defaultPageSize: initialPageSize,
    onError: (e) => emit('error', e),
  },
)
const { loading, rows, params, pagination } = table

// 列定义后追加的搜索字段:补种 key,保证 Naive 控件受控(null 而非 undefined)
watch(searchDefs, (defs) => {
  for (const d of defs) {
    if (!(d.key in params)) params[d.key] = d.defaultValue ?? null
  }
})

// 外部附加参数变化(树筛选联动)→ 回第 1 页重查
watch(
  () => props.params,
  () => {
    if (isRemote.value) void table.search()
  },
  { deep: true },
)

// 请求成功(竞态守卫已过滤过期响应)→ loaded
watch(rows, (r) => {
  if (isRemote.value) emit('loaded', r, pagination.itemCount)
})

/* ---- 字典与列 ---- */

const options = useOptions(() => deriveOptionsSources(props.columns))

const columnsApi = useColumns<T>({
  columns: () => props.columns,
  storageKey: props.storageKey,
  defaultDensity: () => props.defaultDensity ?? defaults.density,
  respectStoredDensity: () => typeof props.toolbar === 'object' && props.toolbar.density === true,
  getOptions: options.getOptions,
  slots,
  indexOffset: () => (isRemote.value ? (pagination.page - 1) * pagination.pageSize : 0),
  defaults,
  sortState: () => sortState.value,
  filterDefs: () => filterDefs.value,
  renderFilter: renderColumnFilter,
  resizable: () => props.resizable ?? defaults.resizable,
})

/** 向宿主挂的 onUpdate:sorter 转发(可能是函数也可能是数组)。 */
function notifyHostSorter(payload: unknown) {
  const hostHandler = attrs['onUpdate:sorter']
  const list = Array.isArray(hostHandler) ? hostHandler : [hostHandler]
  for (const fn of list) if (typeof fn === 'function') (fn as (v: unknown) => void)(payload)
}

// Naive @update:sorter → 更新受控排序态 + 远程重查(回第 1 页)。宿主若另挂 handler 也转发。
function onSorterChange(s: unknown) {
  applySorts(normalizeSorterEvent(s, sorterInfo.value))
  notifyHostSorter(s)
}

/**
 * 编程式排序(对齐官方 DataTableInst.sort,use-sorter.mjs:105-118):order 缺省 'ascend';
 * columnKey 为空 = clearSorter();没有 sorter 的列是空操作。单列互斥的 sorter 会顶掉其它列。
 * 与官方一样会通知宿主的 onUpdate:sorter(载荷形状见 sorts.ts 的 sortTransition)。
 */
function sort(columnKey?: string | null, order: 'ascend' | 'descend' | false = 'ascend') {
  if (!columnKey) return clearSorter()
  const next = sortTransition(sortState.value, sorterInfo.value, columnKey, order)
  if (!next) return
  applySorts(next.items)
  notifyHostSorter(next.event)
}

/** 清空全部排序;与官方一致,向宿主转发 null。 */
function clearSorter() {
  applySorts([])
  notifyHostSorter(null)
}

/* ---- 已生效条件 chips ---- */

// P0:默认关;模式 2(条件构造器)落地后才会默认开
const chipsEnabled = computed(() => props.filterChips === true)

/** 字典列的 chip 显示 label 而不是 value;孤儿键(没有列声明,def 为 undefined)没有字典,按原值显示。 */
function optionLabelOf(def: FilterDef | undefined, value: unknown): string {
  if (!def) return String(value ?? '')
  const flat = (opts: SmartTableOption[]): SmartTableOption[] =>
    opts.flatMap((o) => (o.children?.length ? flat(o.children) : [o]))
  const hit = flat(options.getOptions(def.optionsKey)).find((o) => o.value === value)
  return hit ? optionLabel(hit) : String(value ?? '')
}

const chipItems = computed(() =>
  chipsEnabled.value ? buildChips(filterDefs.value as FilterDef[], filters.state.value, mergedLabels.value, optionLabelOf) : [],
)
const chipsHaveDefaults = computed(() => hasActiveDefaults(filterDefs.value as FilterDef[]))

/** 点 chip = 请求重开该列面板:给对应 ColumnFilter 递增 openRequest。被隐藏的列没有漏斗,递增了也是空操作。 */
const openTick = reactive<Record<string, number>>({})
function onChipOpen(key: string) {
  openTick[key] = (openTick[key] ?? 0) + 1
}
function onChipRemove(key: string, index: number) {
  const v = filters.getFilter(key)
  if (v) filters.setFilter(key, removeChipCondition(v, index))
}

/**
 * 表头漏斗:由 useColumns 在列标题后调用。放在这里而不是 useColumns 内,
 * 是为了让 useColumns 保持纯 TS(不 import SFC),node 环境下仍可直接单测。
 */
function renderColumnFilter(def: FilterDef<T>) {
  return h(ColumnFilter, {
    key: def.key,
    def: def as FilterDef,
    value: filters.getFilter(def.key),
    labels: mergedLabels.value,
    getOptions: options.getOptions,
    isLoadingOptions: options.isLoading,
    dateValueFormat: defaults.dateValueFormat,
    openRequest: openTick[def.key] ?? 0,
    'onUpdate:value': (v: FilterValue | null) => filters.setFilter(def.key, v),
  })
}

/**
 * Naive 的列宽拖拽只存在组件内部,不对外抛事件;onUnstableColumnResize 是唯一出口,
 * 接住它才能把宽度持久化 + 转成 @column-resize。拖动过程中每帧触发,
 * localStorage 写入在 useColumns.setWidth 里防抖。
 *
 * 首帧先 freezeWidths:把所有列钉成当前实际宽度,消掉 table-layout:fixed 的宽度摊派,
 * 否则一拖就跳、列宽涨得比鼠标位移多得多(详见 useColumns.freezeWidths 注释)。
 * 此处拿到的 getColumnWidth 读的是 DOM 实测宽,且本回调在 Naive 写入新宽度之前执行,
 * 量到的正是拖拽前的布局。
 */
let resizingKey: string | null = null
let pendingWidth = 0

/** 松手才把宽度落进列定义(整个手势只重建一次列),并清掉临时增量。 */
function endResize() {
  if (resizingKey !== null) {
    const key = resizingKey
    const width = pendingWidth
    resizingKey = null
    dragDelta.value = 0
    columnsApi.setWidth(key, width)
  }
}

function onColumnResize(resizedWidth: number, limitedWidth: number, column: unknown, getColumnWidth: unknown) {
  const key = (column as { key?: string | number })?.key
  if (key !== undefined) {
    const colKey = String(key)
    if (resizingKey !== colKey) {
      // 换了一列(或新手势):先把上一列的结果落账,再钉住当前布局
      endResize()
      resizingKey = colKey
      columnsApi.freezeWidths(getColumnWidth as (k: string) => number | undefined)
      window.addEventListener('mouseup', endResize, { once: true })
      // 手势中途松开鼠标发生在浏览器窗口之外(拖出视口边界再放开)时,window 收不到 mouseup ——
      // 用 blur 兜底,窗口失焦也当成手势结束。否则 resizingKey/pendingWidth 会一直悬着,被下一次
      // 跟本次拖拽毫不相关的 mouseup 误触发,把陈旧宽度悄悄落回列定义。endResize 本身是幂等的
      // (resizingKey 为 null 时直接跳过),两个监听器谁先触发都安全,另一个自会在下次触发时空跑。
      window.addEventListener('blur', endResize, { once: true })
    }
    pendingWidth = limitedWidth
    // 拖拽期间列宽由 Naive 内部的拖拽态渲染,我们只负责让表格总宽跟上
    dragDelta.value = limitedWidth - (columnsApi.widths.value[colKey] ?? limitedWidth)
    emit('columnResize', colKey, limitedWidth)
  }
  const hostHandler = attrs.onUnstableColumnResize ?? attrs['on-unstable-column-resize']
  if (typeof hostHandler === 'function') {
    ;(hostHandler as (...a: unknown[]) => void)(resizedWidth, limitedWidth, column, getColumnWidth)
  }
}

/**
 * 透传给 n-data-table 的 attrs,剔除 on(-)unstable-column-resize 与 onUpdate:sorter。
 *
 * 模板里 `v-bind="attrs"` 之后又显式绑定了 `:on-unstable-column-resize="onColumnResize"`——
 * 这个 key 命中 Vue 的 isOn() 判定,同名时 mergeProps 会把两个函数合并成数组而不是后者覆盖前者
 * (class/style/on* 是 mergeProps 里唯一「合并」而非「覆盖」的特例)。宿主若也写了同名 attr,
 * 数组传给 Naive 就会在它当函数调用时直接抛 TypeError。宿主处理函数已经在 onColumnResize 里
 * 从 attrs 读出来手动转发了,这里只需要把它从透传对象里摘掉,避免它再从 v-bind 混进去参与合并。
 */
const forwardedAttrs = computed(() => {
  const rest = { ...attrs } as Record<string, unknown>
  delete rest.onUnstableColumnResize
  delete rest['on-unstable-column-resize']
  delete rest['onUpdate:sorter'] // 由 onSorterChange / sort() / clearSorter() 经 notifyHostSorter 统一转发,只转发一次(C6)
  return rest
})

/* ---- 组装 ---- */

const tableRef = ref<DataTableInst | null>(null)

// Naive 把拖拽后的列宽存在 NDataTable 内部,且既不抛事件也不在实例上给清除入口,
// 它还盖过我们回填的 column.width。所以「恢复默认」若真清掉过宽度,只能重挂一次表格。
const tableKey = ref(0)
function onResetSettings() {
  const hadWidths = Object.keys(columnsApi.widths.value).length > 0
  columnsApi.resetSettings()
  if (hadWidths) tableKey.value++
}

// 本地模式的分页是非受控的(不传 page,交给 Naive 自己的 uncontrolledCurrentPageRef);
// tableKey 变化强制重挂 <n-data-table> 时,新实例的分页状态会从头初始化回第 1 页 ——
// 拿 localPage 记住用户翻到的页码,重挂后用 defaultPage 把起始页续上,而不是把分页
// 也改成受控(那是更大的行为变更,这里只需要「重挂不掉页」)。
const localPage = ref(1)

// 本地模式的每页条数:官方 simple 分页自己没有选择器,库用嵌套的官方 NPagination 画的选择器要能改它,所以用受控的 pageSize
const localPageSize = ref(initialPageSize)

onBeforeUnmount(() => {
  window.removeEventListener('mouseup', endResize)
  window.removeEventListener('blur', endResize)
  resizingKey = null
})

const rowKeyFn = computed(() => {
  const rk = props.rowKey
  return typeof rk === 'function' ? rk : (row: T) => (row as Record<string, any>)[rk]
})

const tableSize = computed(() => (columnsApi.density.value === 'compact' ? 'small' : 'medium'))

// NDataTable 的 data 形参是 RowData[](Record 索引),泛型 T 无索引签名,此处收窄。
// 静态模式的过滤在这里落地(远程模式走 fetcher 参数,由后端过滤)。
const tableData = computed(() => {
  if (isRemote.value) return rows.value as Record<string, any>[]
  const local = props.data ?? []
  return applyFilters(local, filterDefs.value, filters.state.value, defaults.dateValueFormat) as Record<string, any>[]
})

const searchConfig = computed<SearchFormConfig>(() => {
  const user = typeof props.search === 'object' ? props.search : {}
  return { cols: defaults.searchCols, ...user } // 用户 cols 覆盖全局默认
})

const showToolbar = computed(
  () => props.toolbar !== false || !!props.title || !!slots.title || !!slots.toolbar,
)
const settingsEnabled = computed(
  () => props.toolbar !== false && (typeof props.toolbar === 'object' ? props.toolbar.columnSettings !== false : true),
)

const paginationPrefix = computed(() =>
  slots['pagination-prefix'] ? (info: unknown) => slots['pagination-prefix']!(info) : undefined,
)

/** 官方回调可能是函数也可能是数组(Naive 允许 MaybeArray),逐个调用。 */
function callAll(handler: unknown, ...args: unknown[]) {
  for (const fn of Array.isArray(handler) ? handler : [handler]) if (typeof fn === 'function') fn(...args)
}

/**
 * 2.1.1 里改每页条数走的是官方 NDataTable,它会按多种拼写通知宿主(use-table-data.mjs:182-197、239-247):
 * pagination 级 onPageSizeChange / 'onUpdate:pageSize';表格级 onUpdatePageSize / 'onUpdate:pageSize' / onPageSizeChange。
 * 内层嵌套选择器(E2)绕开了 NDataTable,只调用了 onSize 这一个入口,上面这些拼写都不会再触发——
 * 这里补齐,保证 2.1.1 宿主不管用哪种拼写监听都不会静默失效。是额外通知,不替代 onSize 里已有的
 * user.onUpdatePageSize / table.onPageSize 那一路(那一路决定「谁接管回第 1 页重查」的语义)。
 */
function notifyPageSizeListeners(user: Partial<PaginationProps>, n: number) {
  callAll(user['onUpdate:pageSize'], n)
  callAll(user.onPageSizeChange, n)
  callAll(attrs['onUpdate:pageSize'], n)
  callAll(attrs.onUpdatePageSize, n)
  callAll(attrs.onPageSizeChange, n)
}

const mergedPagination = computed<false | PaginationProps>(() => {
  if (props.pagination === false) return false
  const user = props.pagination ?? {}
  // 3.0 起默认官方 simple;传 { simple: false } 回到页码序列(此时走官方 showSizePicker / pageSizes)
  const simple = user.simple ?? true
  const showSizePicker = user.showSizePicker ?? defaults.showSizePicker // D3 #1:单表的 false 也要认
  const current = user.pageSize ?? (isRemote.value ? pagination.pageSize : localPageSize.value)
  // D3 #2 / #6:保留 { label, value } 对象;并入当前值(官方在当前值不在选项里时显示裸值)
  const sizes = mergePageSizes(user.pageSizes ?? defaults.pageSizes, current)

  // 本地模式改每页条数的状态更新(回第 1 页同步表格页码 + 转发宿主回调),remote/local 两个
  // onUpdatePageSize 入口(内层嵌套选择器 / 非 simple 时交给官方选择器)共用这同一段状态变更逻辑。
  function applyLocalSize(n: number) {
    localPageSize.value = n
    // 改每页条数回第 1 页(与远程一致)。官方外层本地分页只会静默夹页、不发 onUpdatePage,
    // 所以库里记页码的 localPage 要自己置 1,并同步表格的页码
    localPage.value = 1
    tableRef.value?.page(1)
    callAll(user.onUpdatePageSize, n) // D3 #3:转发宿主的回调
  }

  /**
   * 「绕开 NDataTable」入口 —— 只有内层嵌套选择器(E2,渲染在 suffix 里的那个官方 NPagination)用这个。
   * 它是我们自己 h() 出来的一个独立组件实例,完全不经过 NDataTable 内部的
   * mergedOnUpdatePageSize/doUpdatePageSize(use-table-data.mjs),所以必须自己补发 notifyPageSizeListeners
   * ——否则宿主用那 5 种拼写监听会静默收不到通知(Fix round 1 Finding 1)。
   */
  const onSizeBypass = isRemote.value
    ? // 远程:与 2.1.1 一致 —— 宿主给了自己的处理函数就由宿主接管,否则走 useSmartTable(回第 1 页重查)
      (n: number) => {
        callAll(user.onUpdatePageSize ?? table.onPageSize, n)
        notifyPageSizeListeners(user, n)
      }
    : (n: number) => {
        applyLocalSize(n)
        notifyPageSizeListeners(user, n)
      }

  const base: Partial<PaginationProps> = { simple, prefix: paginationPrefix.value }
  // simple 下官方不渲染每页选择器(Pagination.mjs:665):在官方 suffix 里嵌一个只渲染 size-picker 的官方 NPagination(E2)。
  // 窄档(会折行)、宿主自带 suffix、关了选择器时都不画。不传 onUpdatePage:受控下内层夹页永远不会触发。
  if (simple && showSizePicker && !narrowPager.value && !user.suffix) {
    base.suffix = (info) =>
      h(NPagination, {
        displayOrder: ['size-picker'],
        showSizePicker: true,
        pageSizes: sizes,
        pageSize: info.pageSize,
        itemCount: info.itemCount,
        page: info.page,
        onUpdatePageSize: onSizeBypass,
      })
  }
  // 非 simple 回退:走官方 showSizePicker / pageSizes。pageSizes 放在 ...user 之后,免得宿主原值盖掉并入了当前值的版本(D3 #6)
  const tail: Partial<PaginationProps> = simple ? {} : { showSizePicker, pageSizes: sizes }

  if (isRemote.value) {
    return {
      ...base,
      page: pagination.page,
      pageSize: pagination.pageSize,
      itemCount: pagination.itemCount,
      onUpdatePage: table.onPage,
      onUpdatePageSize: table.onPageSize,
      ...user,
      ...tail,
    }
  }
  return {
    ...base,
    pageSize: localPageSize.value,
    defaultPage: localPage.value,
    ...user,
    ...tail,
    onUpdatePage: (p: number) => {
      localPage.value = p
      callAll(user.onUpdatePage, p)
    },
    // 「走 NDataTable 原生链路」入口:simple:false 时宿主看到的是 NDataTable 自己渲染的官方选择器,
    // 改动经它内部的 mergedOnUpdatePageSize/doUpdatePageSize 流转,那条链路自己就会按 5 种拼写通知宿主
    // (且会读到这里挂的 onUpdatePageSize)——这里只做状态更新,不能再调 notifyPageSizeListeners,
    // 否则 simple:false + 本地模式下宿主会被通知两次(Fix round 2 修的回归)。simple:true 时 NDataTable
    // 内部官方分页本就不画 size-picker(Pagination.mjs:665),这个 key 实际不会被那条原生链路触发,
    // 真正改每页条数走的是上面的 onSizeBypass(suffix 里的内层嵌套选择器)。
    onUpdatePageSize: applyLocalSize,
  }
})

/**
 * 「列宽已钉住」态:拖过一次之后,每一列(含序号/勾选列)都有确定宽度。
 * 此时必须同时做两件事,否则拖一列会牵动其它列:
 *  1. table-layout 切 fixed —— Naive 默认是 auto,auto 下 <col> 宽度只是建议值,
 *     浏览器每次都按内容重新求解整张表,改一列所有列都会挪。
 *  2. 表格宽度写死成各列之和(而不是 CSS 里的 width:100%)—— 否则收窄某列腾出的
 *     富余宽度会被摊回其余列,左侧的列跟着变宽。富余宽度改由一列占位列独自吃掉
 *     (见 fillerWidth),表格因此既填满容器又不牵动任何一列。
 */
const colsPinned = columnsApi.pinned

// 宿主显式传了 table-layout 就听宿主的
const mergedTableLayout = computed<'auto' | 'fixed' | undefined>(() => {
  const host = (attrs.tableLayout ?? attrs['table-layout']) as 'auto' | 'fixed' | undefined
  if (host) return host
  return colsPinned.value ? 'fixed' : undefined
})

/**
 * 拖拽过程中的临时增量。表格总宽必须跟着鼠标走(否则被拖的列变宽、总宽没变,
 * 富余量就会从别的列身上找补),但列定义不能每帧重建 —— 那会让整张表每帧重新求解布局,
 * 表现就是左侧的列跟着一起动。所以这里只让一个 CSS 变量随帧变化,列数组保持不变。
 */
const dragDelta = ref(0)

/** 表格包含块(Naive 的横向滚动容器)的可见宽度,由下方 measureHost 维护。 */
const hostWidth = ref(0)

/** 库根节点宽度(ResizeObserver 维护)。< 600 视为窄档:分页不画每页选择器(卡片内宽 ≤ 340 时它会折行)。0 = 还没量到,按非窄档处理。 */
const rootWidth = ref(0)
const narrowPager = computed(() => rootWidth.value > 0 && rootWidth.value < 600)

/**
 * 列宽之和小于容器时的富余宽度,交给一列占位列独自吃掉(见 withFillerColumn):
 * 表头底色、行底色、边框都铺到容器右缘,每一列仍是拖出来的精确宽度。
 * 含 dragDelta:拖拽期间正在拖的列由 Naive 实时渲染出新宽度,若占位列宽度不
 * 跟着让出这部分增量,表格总宽(colsWidth)会在松手前偏离容器宽度,右侧短暂
 * 露出留白(或反向撑出横向滚动条)——这正是本次 PR 要修的那个 bug,拖拽中也
 * 不能再犯。富余耗尽(含正在拖拽的增量后)则钉到 0,退回横向滚动。
 */
const fillerWidth = computed(() =>
  colsPinned.value ? Math.max(0, hostWidth.value - columnsApi.scrollX.value - dragDelta.value) : 0,
)

/** 交给 Naive 的最终列:钉住且有富余时,在右固定列之前补一列占位。 */
const displayColumns = computed(() => withFillerColumn(columnsApi.naiveColumns.value, fillerWidth.value))

/** 表格总宽 = 各列宽度之和 + 占位列(+ 拖拽中的临时增量)。scroll-x 与 CSS 变量共用,两者必须一致。 */
const colsWidth = computed(() => columnsApi.scrollX.value + fillerWidth.value + dragDelta.value)

const rootStyle = computed(() => ({
  '--smart-table-active-row-bg': defaults.activeRowBg,
  ...(colsPinned.value ? { '--smart-table-cols-width': `${colsWidth.value}px` } : {}),
}))

// 消费者显式传 scroll-x 时让位(v-bind 顺序也保证其覆盖)。
// 用 colsWidth 而非 scrollX:拖拽期间外层滚动容器的 min-width 要和表格总宽同步,否则表格溢出容器。
const autoScrollX = computed(() =>
  'scrollX' in attrs || 'scroll-x' in attrs ? undefined : colsWidth.value,
)

// 行 props:合并宿主经 attrs 传入的 row-props + 内置高亮(activeRowKey)与行点击(@row-click)。
// 显式绑定在 v-bind="attrs" 之后,故此处结果最终生效(已并入宿主的 row-props)。
type RowPropsFn = (row: T, index: number) => Record<string, any>
const mergedRowProps = computed<RowPropsFn>(() => {
  const host = (attrs.rowProps ?? attrs['row-props']) as RowPropsFn | undefined
  const active = props.activeRowKey
  return (row: T, index: number) => {
    const base = host ? { ...host(row, index) } : {}
    const isActive = active !== undefined && active !== null && rowKeyFn.value(row) === active
    const cls = [base.class, isActive ? 'smart-table-row--active' : ''].filter(Boolean).join(' ')
    const hostClick = base.onClick as ((e: MouseEvent) => void) | undefined
    return {
      ...base,
      ...(cls ? { class: cls } : {}),
      onClick: (e: MouseEvent) => {
        hostClick?.(e)
        emit('rowClick', row, index)
      },
    }
  }
})

function onSearch() {
  if (isRemote.value) void table.search()
  emit('search', cleanParams(params))
}

function onReset() {
  void table.reset()
  emit('reset')
}

function refresh(): Promise<void> {
  return isRemote.value ? table.load() : Promise.resolve()
}

/* ---- 行拖拽排序(sortablejs 懒加载,仅 rowDraggable 时) ---- */
const rootRef = ref<HTMLElement | null>(null)

/* ---- 占位列:量出容器宽度 ---- */

let resizeObserver: ResizeObserver | null = null
let observedBody: HTMLElement | null = null

/**
 * 表格的包含块是 Naive 的横向滚动容器,占位列按它的可见宽度(已扣掉纵向滚动条)补。
 * 这个元素会随 tableKey 重建,所以每次测量顺手把 ResizeObserver 挪到当前这个上。
 */
function measureHost() {
  rootWidth.value = rootRef.value?.clientWidth ?? 0
  const body = rootRef.value?.querySelector<HTMLElement>('.n-data-table-base-table-body') ?? null
  if (resizeObserver && body !== observedBody) {
    if (observedBody) resizeObserver.unobserve(observedBody)
    if (body) resizeObserver.observe(body)
    observedBody = body
  }
  hostWidth.value = body?.clientWidth ?? 0
}

onMounted(() => {
  // SSR / 测试环境可能没有 ResizeObserver:量一次就走,占位列退化成不补(与本次改动前一致)
  if (typeof ResizeObserver !== 'undefined') resizeObserver = new ResizeObserver(() => measureHost())
  if (resizeObserver && rootRef.value) resizeObserver.observe(rootRef.value)
  measureHost()
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  observedBody = null
})

// 列增删/显隐与表格重建会换掉滚动容器,ResizeObserver 收不到,这里补一次测量
watch([() => columnsApi.naiveColumns.value.length, tableKey], () => void nextTick(measureHost))

const rowDrag = useRowDrag<T>({
  enabled: () => props.rowDraggable,
  getTbody: () => rootRef.value?.querySelector<HTMLElement>('.n-data-table-tbody'),
  rows: () => (isRemote.value ? rows.value : props.data) as T[] | undefined,
  handle: () => props.dragHandle,
  onSort: (e) => emit('rowDragSort', e),
})
// useRowDrag 内部只在 rows 数组变化时重新绑定;tableKey 变化(「恢复默认」强制重挂
// <n-data-table>)换掉的是 DOM 里的 tbody 本身,rows 数组引用/内容都没变,那个 watch
// 不会触发 —— sortable 实例还挂在已经被卸载的旧 tbody 上,行拖拽因此悄悄失效。这里补一次
// 主动对齐,让它去找新挂载出来的 tbody 重新绑定。
watch(tableKey, () => void rowDrag.sync())

defineExpose({
  refresh,
  search: () => table.search(),
  reset: () => table.reset(),
  loading,
  rows,
  params,
  pagination,
  reloadOptions: options.reload,
  // readonly() 包一层:文档写的是「只读快照,改动请用 setFilter/setWidth」,但暴露原始 ref
  // 只是君子协定,host 直接 `.value =` 赋值一样能改——会绕开 setFilter 的去重 + onChange
  // 回调(远程模式漏发重查)、绕开 setWidth 的 localStorage 持久化(下次刷新被覆盖)。
  // readonly 让这类赋值在开发环境下报警并不生效,读取/深层响应式不受影响。
  filters: readonly(filters.state),
  setFilter: filters.setFilter,
  clearFilters: filters.clearFilters,
  sort,
  clearSorter,
  columnWidths: readonly(columnsApi.widths),
  tableRef,
})
</script>

<template>
  <div ref="rootRef" class="smart-table" :class="{ 'smart-table--pinned-cols': colsPinned }" :style="rootStyle">
    <SearchForm
      v-if="props.search !== false && searchDefs.length > 0"
      :fields="searchDefs"
      :params="params"
      :config="searchConfig"
      :labels="mergedLabels"
      :loading="loading"
      :date-value-format="defaults.dateValueFormat"
      :get-options="options.getOptions"
      :is-loading-options="options.isLoading"
      @search="onSearch"
      @reset="onReset"
      :card-props="mergedCardProps"
    />

    <n-card :bordered="true" class="smart-table-card" v-bind="mergedCardProps">
      <Toolbar
        v-if="showToolbar"
        :title="props.title"
        :labels="mergedLabels"
        :config="props.toolbar ?? {}"
        :density="columnsApi.density.value"
        :remote="isRemote"
        @refresh="refresh"
        @update:density="columnsApi.setDensity"
        @more-select="(k, o) => emit('moreSelect', k, o)"
      >
        <template v-if="slots.title" #title><slot name="title" /></template>
        <template v-if="slots.toolbar" #left><slot name="toolbar" /></template>
        <template v-if="slots['toolbar-right']" #right><slot name="toolbar-right" /></template>
        <template v-if="settingsEnabled" #settings>
          <ColumnSettings
            :items="columnsApi.settingItems.value"
            :labels="mergedLabels"
            @toggle="columnsApi.toggleShow"
            @move="columnsApi.moveCheck"
            @set-fixed="columnsApi.setFixed"
            @reset="onResetSettings"
          />
        </template>
      </Toolbar>

      <FilterChips
        v-if="chipItems.length"
        :items="chipItems"
        :labels="mergedLabels"
        :has-defaults="chipsHaveDefaults"
        @open="onChipOpen"
        @remove="onChipRemove"
        @clear="filters.clearFilters"
      />

      <!-- single-line:false = 单元格竖线。Naive 的 bordered 只画外框,格子线归 single-line 管。
           绑在 v-bind="attrs" 前,宿主写 :single-line="true" 可覆盖回单线样式。 -->
      <n-data-table
        :key="tableKey"
        ref="tableRef"
        :remote="isRemote"
        :columns="displayColumns"
        :data="tableData"
        :loading="isRemote ? loading : false"
        :row-key="rowKeyFn"
        :pagination="mergedPagination"
        :size="tableSize"
        :scroll-x="autoScrollX"
        :single-line="false"
        v-bind="forwardedAttrs"
        :row-props="mergedRowProps"
        :table-layout="mergedTableLayout"
        :on-unstable-column-resize="onColumnResize"
        @update:sorter="onSorterChange"
      >
        <template v-if="slots.empty" #empty><slot name="empty" /></template>
      </n-data-table>
    </n-card>
  </div>
</template>

<style scoped>
.smart-table {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
/* 列宽钉住后,表格宽度 = 各列宽度之和 + 占位列(Naive 基础样式是 width:100%)。
   不改的话收窄某列腾出的富余宽度会被摊回其余列,拖一列左侧的列跟着动;
   富余宽度由占位列独自吃掉,表格照样填满容器,右侧不留白(见 withFillerColumn)。 */
.smart-table--pinned-cols :deep(.n-data-table-table) {
  width: var(--smart-table-cols-width);
}
/* 占位列(withFillerColumn)不是真实数据列,只用来把富余宽度填满容器:
   去掉指针交互提示,免得它看起来像还能点的一格。 */
.smart-table :deep(.smart-table-filler-col) {
  pointer-events: none;
}
/* 列宽拖拽手柄归位。Naive 默认把它放偏了:命中区 right 是 container-size/2,
   可见竖线在命中区内又 left 了 container-size/2,两次叠加 —— 那根线落在列边界左侧
   整整一个 container-size(8px)处,且只有半格高,跟列分隔线对不上。
   这里把命中区贴到列右边缘、竖线拉满整格,与 th 的 border-right 重合。 */
.smart-table :deep(.n-data-table-resize-button) {
  right: 0;
}
.smart-table :deep(.n-data-table-resize-button::after) {
  top: 0;
  bottom: 0;
  left: auto;
  right: 0;
  height: auto;
  transform: none;
  /* 静止时不画:表格自己有 border-right(single-line=false)时会叠成一条粗线。
     分隔线交给表格,手柄只在悬停/拖拽时显形 —— 与 Arco 一致。 */
  background-color: transparent;
}
.smart-table :deep(.n-data-table-resize-button:hover::after),
.smart-table :deep(.n-data-table-resize-button--active::after) {
  background-color: var(--n-th-icon-color-active);
}
/* 表头「标题 + 漏斗」容器:在 Naive 内层 th 里渲染,所以要 :deep 才打得进去。 */
.smart-table :deep(.smart-table-th) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0;
}
/* 表头图标「悬停才显示」(B6):未激活的排序箭头与漏斗平时透明(仍占位,不回流),悬停该列表头或
   键盘聚焦到表头内时淡入。官方类名已在真实 NDataTable 上核对(设计文档 9.1)。
   常驻例外:正在排序的列箭头、已筛选的列漏斗、面板打开的那一列漏斗。
   注意:所有例外规则都要带 .n-data-table-th 前缀,与隐藏规则同级(0,4,0)并写在其后,否则压不过(P-4)。 */
.smart-table :deep(.n-data-table-th .n-data-table-sorter) {
  opacity: 0;
  /* Q-3:官方给排序箭头写的是 transition: color .3s var(--n-bezier)(箭头变主色时用),
     这里的 transition 会整条覆盖它,所以两个都要写 */
  transition:
    opacity 0.15s,
    color 0.3s var(--n-bezier);
}
.smart-table :deep(.n-data-table-th .smart-table-filter-trigger) {
  opacity: 0;
  transition: opacity 0.15s;
}
.smart-table :deep(.n-data-table-th:hover .n-data-table-sorter),
.smart-table :deep(.n-data-table-th:hover .smart-table-filter-trigger),
.smart-table :deep(.n-data-table-th:focus-within .smart-table-filter-trigger),
.smart-table :deep(.n-data-table-th--sorting .n-data-table-sorter),
.smart-table :deep(.n-data-table-th .smart-table-filter-trigger--active),
.smart-table :deep(.n-data-table-th .smart-table-filter-trigger--open) {
  opacity: 1;
}
/* 触屏兜底(Q-4):没有悬停(主输入设备是触屏,如平板)。写法与设计原型一致,只写 `(hover: none)`(F16):
   不加 `any-pointer: coarse` —— 带触屏的 Windows 笔记本它也为 true,用鼠标时图标会常显,与原型「悬停才显示」不符。
   未激活的图标淡显常驻(仍低于激活态的主色)。
   24px 的列宽拖拽热区 P0 不做:它与现有 ::after 竖条错位、伸进下一列的一半会被后一个 th 盖住,
   连同把手的视觉整体归 P1(规格 §5.6)。 */
@media (hover: none) {
  .smart-table :deep(.n-data-table-th .n-data-table-sorter),
  .smart-table :deep(.n-data-table-th .smart-table-filter-trigger) {
    opacity: 0.5;
  }
  .smart-table :deep(.n-data-table-th .smart-table-filter-trigger--active),
  .smart-table :deep(.n-data-table-th .smart-table-filter-trigger--open),
  .smart-table :deep(.n-data-table-th--sorting .n-data-table-sorter) {
    opacity: 1;
  }
}
/* 图标间距(Q-5,设计 3.11;B12 的拖拽下限 93 / 102 / 123 就是按这个布局算的):
   标题 → 漏斗 8px(漏斗的 margin-left,在 ColumnFilter 里)、漏斗 → 排序箭头 6px(官方默认是 4px)、
   表头右内边距 16px(= 8px 把手 + 8px 缓冲)。 */
.smart-table :deep(.n-data-table-th) {
  padding-right: 16px;
}
.smart-table :deep(.n-data-table-th .n-data-table-sorter) {
  margin-left: 6px;
}
/* 图标簇紧跟标题(F2):官方 title-wrapper 是 flex、title 是 flex:1 —— 标题居中时 title 块被撑满整格,排序箭头被挤到格子最右,
   和标题 / 漏斗之间空出一大块(默认列宽下漏斗 → 箭头实测 20px 以上,而不是 6px)。改成:wrapper 按内容收缩(inline-flex,
   随 th 的 text-align 居中 / 靠左 / 靠右),title 按内容宽(flex: 0 1 auto,放不下时仍可收缩,min-width:0 是官方的),
   于是「标题 + 漏斗 + 箭头」是一组、间距固定。只改 CSS,不改官方渲染结构。vertical-align:top 避免 inline 行框把表头撑高 1px。
   优先级:官方是 (0,3,0) / (0,4,0),scoped 的 :deep 写法是 (0,4,0) / (0,5,0),刚好压过。 */
.smart-table :deep(.n-data-table-th .n-data-table-th__title-wrapper) {
  display: inline-flex;
  vertical-align: top;
}
.smart-table :deep(.n-data-table-th .n-data-table-th__title-wrapper .n-data-table-th__title) {
  flex: 0 1 auto;
}
/* 列上写了 ellipsis 且可排序时,官方给省略号盒子写了 max-width: calc(100% - 18px)(给排序箭头留位)。title 现在按内容收缩,
   再扣 18px 会把「标题 + 漏斗」裁掉 18px(实测:漏斗被切掉);排序箭头本来就是 flex 兄弟、不会压到标题,所以还原成 100%。
   优先级:官方 (0,4,0),这里 (0,5,0)。 */
.smart-table :deep(.n-data-table-th.n-data-table-th--sortable .n-data-table-th__ellipsis) {
  max-width: 100%;
}
/* activeRowKey 命中行高亮:背景走 --smart-table-active-row-bg,宿主/主题可覆盖。
   :deep 打进内层 n-data-table 的 td —— 包内处理,消费端不必自己写 :deep。 */
.smart-table :deep(.smart-table-row--active > td) {
  background-color: var(--smart-table-active-row-bg, rgba(99, 102, 241, 0.08));
}
</style>
