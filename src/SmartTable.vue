<script setup lang="ts" generic="T">
// 唯一胶水层:useSmartTable(数据)+ useOptions(字典)+ useColumns(列/设置)组装。
// props 用运行时声明 + PropType:泛型 + 复杂导入类型下比纯类型声明稳。
import {
  computed,
  getCurrentInstance,
  h,
  mergeProps,
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
import { NCard, NConfigProvider, NDataTable, NPagination, useThemeVars } from 'naive-ui'
import type {
  CardProps,
  DataTableInst,
  DropdownOption,
  PaginationInfo,
  PaginationProps,
} from 'naive-ui'
import type {
  CellChange,
  Density,
  EditableConfig,
  EditInvalid,
  EditSavePayload,
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
  isSpecialColumn,
  useColumns,
  type FilterDef,
} from './useColumns'
import { activeConditions, applyFilters } from './filter'
import {
  buildChips,
  filtersAtDefaults,
  hasActiveDefaults,
  removeChipCondition,
} from './filterChips'
import { mergeCardProps } from './cardStyle'
import { mergePageSizes, resolveDefaultPageSize, resolvePageSizes } from './pageSize'
import {
  collectSorters,
  deriveInitSorts,
  normalizeSorterEvent,
  sortDrawerRows,
  sortToParams,
  sortTransition,
} from './sorts'
import { useFilters } from './useFilters'
import { mergeLabels } from './labels'
import { useSmartTableDefaults } from './config'
import { keepCardTopVisible } from './scrollToCard'
import {
  deriveBuilderDefs,
  draftFromState,
  draftMatchesState,
  patchFromDraft,
  resetPatch,
  resolveSearchContainer,
  type BuilderDraft,
} from './conditionBuilder'
import {
  hasOpenFloat,
  isKeyboardModality,
  lockScroll,
  loopTab,
  resolveMaximize,
  trackInputModality,
  unlockScroll,
} from './maximize'
import SearchForm from './SearchForm.vue'
import Toolbar from './Toolbar.vue'
import ColumnSettings from './ColumnSettings.vue'
import ColumnFilter from './ColumnFilter.vue'
import FilterChips from './FilterChips.vue'
import ConditionBar from './ConditionBar.vue'
import CardList from './CardList.vue'
import SortDrawer from './SortDrawer.vue'
import { buildCardView } from './cardColumns'
import { orderLocalRows, sliceRows } from './cardRows'
import MaximizeLayer from './MaximizeLayer'
import { ref } from 'vue'
import { useRowDrag } from './useRowDrag'
import { useEditable, type UseEditableReturn } from './useEditable'
import EditableSheet from './EditableSheet.vue'

defineOptions({ name: 'SmartTable', inheritAttrs: false })

const props = defineProps({
  columns: { type: Array as PropType<SmartTableColumn<T>[]>, required: true },
  fetcher: { type: Function as PropType<SmartTableFetcher<T>>, default: undefined },
  data: { type: Array as PropType<T[]>, default: undefined },
  rowKey: {
    type: [String, Function] as PropType<string | ((row: T) => string | number)>,
    default: 'id',
  },
  params: { type: Object as PropType<Record<string, any>>, default: undefined },
  immediate: { type: Boolean, default: true },
  defaultPageSize: { type: Number, default: undefined },
  pagination: {
    type: [Boolean, Object] as PropType<false | Partial<PaginationProps>>,
    default: undefined,
  },
  search: { type: [Boolean, Object] as PropType<false | SearchFormConfig>, default: undefined },
  filter: { type: Boolean, default: undefined },
  filterChips: { type: Boolean, default: undefined },
  toolbar: { type: [Boolean, Object] as PropType<false | ToolbarConfig>, default: undefined },
  title: { type: String, default: undefined },
  cardProps: { type: Object as PropType<Partial<CardProps>>, default: undefined },
  fillHeight: { type: Boolean, default: false },
  cardOnNarrow: { type: Boolean, default: false },
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
  editable: {
    type: [Boolean, Object] as PropType<boolean | EditableConfig<T>>,
    default: false,
  },
})

const emit = defineEmits<{
  /** 点「搜索」/ 回车。模式 1:清洗后的扁平搜索参数;模式 2:`filterSerializer` 序列化后的条件(默认 `{ filters: [...] }`),与随后的请求一致。 */
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
  /** 可编辑表格:草稿变化(改了一个格);row 已带上这次改动。 */
  cellChange: [payload: CellChange<T>]
  /** 可编辑表格:点「保存修改」(或 save());宿主提交后调 payload.done() / fail()。窄档抽屉的整行保存同样走它(changes 里只有那一行)。 */
  save: [payload: EditSavePayload<T>]
  /** 可编辑表格:点「放弃修改」。 */
  discard: []
  /** 可编辑表格:保存时发现某格不合法(已选中并标红),宿主可据此弹提示。 */
  invalid: [payload: EditInvalid<T>]
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
  /**
   * 批量栏:有勾选时原地替换工具栏左半段(标题 / 业务按钮 / 更多)。「已选 N 项」与「取消选择」由库内置。
   * 出现条件(全部满足):有 selection 列、传了本插槽、宿主绑了 checked-row-keys、且至少勾了一行。
   */
  batch?: (props: { checkedRowKeys: Array<string | number>; clear: () => void }) => any
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

// 初始每页条数:首次 setup 时解析一次。远程模式它就是首个请求的 pageSize(与 pagination.pageSize 保持一致);
// 本地模式它是 localPageSize 的初值(pagination.defaultPageSize 不会被受控的 pageSize 盖掉)。
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

/**
 * 搜索区放哪(规格 §5.1):'card'(默认,独立搜索卡片)/ 'table'(模式 2 条件构造器,并入表格卡片)/ 'none'(无卡片的内联表单,= 旧 layout: 'inline')。
 * container 优先于 layout。search: false 时没有搜索区。
 */
const searchContainer = computed(() =>
  resolveSearchContainer(typeof props.search === 'object' ? props.search : undefined),
)
const isMode2 = computed(() => props.search !== false && searchContainer.value === 'table')
// 模式 2 的搜索条件走过滤态(FilterValue → filterSerializer),不走扁平参数:扁平搜索项为空 → 不渲染 SearchForm,请求里也没有扁平搜索键
const searchDefs = computed(() => (isMode2.value ? [] : deriveSearchDefs(props.columns)))

// 排序状态(受控):sorter 列点表头 → 写这里 → 并进 fetcher 参数 + 回显箭头。
// 数组,顺序 = 优先级(列声明的 sorter.multiple 从大到小);初值来自列上的 defaultSortOrder(只在首次 setup 读一次)。
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

/** 列头漏斗用的过滤项:只含写了 filter 的列(挂漏斗、useColumns 只认它)。 */
const headerFilterDefs = computed(() =>
  filterEnabled.value ? deriveFilterDefs(props.columns) : [],
)
/** 模式 2 的构造器字段(声明了 search 且放得进一行的列);extra = 其中只写了 search、没有列头 filter 的字段。 */
const builder = computed(() =>
  isMode2.value
    ? deriveBuilderDefs(props.columns, headerFilterDefs.value)
    : { fields: [], extra: [] },
)
/** 过滤态 / 本地过滤 / chips / 序列化认的全部过滤项 = 列头的 + 只写 search 的构造器字段(它们没有漏斗,但同样是 FilterValue)。 */
const filterDefs = computed(() => [...headerFilterDefs.value, ...builder.value.extra])

const filters = useFilters<T>({
  defs: () => filterDefs.value,
  onChange: (key, value, state) => {
    // 筛选后的分页行为:宿主显式传了官方 paginationBehaviorOnFilter 就照官方;没传按库的默认行为
    // (远程回第 1 页;本地不动,页码由 Naive 夹回合法范围)。这是对官方默认值 'current' 的有意偏离,只发生在 remote。
    const behavior = (attrs.paginationBehaviorOnFilter ??
      attrs['pagination-behavior-on-filter']) as 'first' | 'current' | undefined
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

/* ---- 模式 2:条件构造器(search: { container: 'table' }) ---- */

const builderFields = computed(() => builder.value.fields)
const builderKeys = computed(() => new Set(builderFields.value.map((f) => f.key)))
/** 构造器草稿(工具栏主行 = 第 1 行,气泡 / 抽屉里改的是同一份):点「搜索」/「确认」才提交成过滤态,不是每敲一个字就查。 */
const builderDraft = ref<BuilderDraft>(draftFromState(filters.state.value, builderFields.value))
/** 过滤态里构造器管的那部分的快照:只在它变了(chips × / 列头漏斗 / setFilter / clearFilters)时才用过滤态重建草稿,列头漏斗改了别的列不会冲掉主行里还没提交的输入。 */
const builderSlice = computed(() =>
  JSON.stringify(builderFields.value.map((f) => [f.key, filters.state.value[f.key] ?? null])),
)
watch(builderSlice, () => {
  // 草稿提交后恰好等于过滤态时不重建:免得把用户排好的行序打乱(过滤态按字段分组存)
  if (!draftMatchesState(builderDraft.value, filters.state.value, builderFields.value)) {
    builderDraft.value = draftFromState(filters.state.value, builderFields.value)
  }
})
const builderAppliedCount = computed(() =>
  builderFields.value.reduce((n, f) => n + activeConditions(filters.state.value[f.key]).length, 0),
)
/** 每次变大 = 请求打开多条件面板(chips 点击)。 */
const openBuilderTick = ref(0)

/** 「搜索」/ 回车:草稿 → 过滤态(一次 onChange,远程只重查一次)。没有变化也重查(与模式 1 的「点搜索总是重查」一致)。 */
function onBuilderSearch() {
  const changed = filters.setMany(patchFromDraft(builderDraft.value, builderFields.value))
  if (!changed && isRemote.value) void table.search()
  emit('search', { ...cleanParams(params), ...filterToParams() })
}

/** 「重置」:构造器字段各自恢复 defaultValue(没有就清空),不碰列头漏斗管的条件;草稿跟着重建。 */
function onBuilderReset() {
  const changed = filters.setMany(resetPatch(builderFields.value))
  builderDraft.value = draftFromState(filters.state.value, builderFields.value)
  if (!changed && isRemote.value) void table.search()
  emit('reset')
}

const table = useSmartTable<T>(
  // 包一层保证始终取最新的 props.fetcher(模板内联箭头每次渲染都是新引用)
  (p) => props.fetcher!(p),
  {
    initParams: deriveInitParams(searchDefs.value),
    extraParams: () => ({
      ...(props.params ?? {}),
      ...sortToParams(sortState.value),
      ...filterToParams(),
    }),
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

/**
 * 拖拽过程中的临时增量。表格总宽必须跟着鼠标走(否则被拖的列变宽、总宽没变,
 * 富余量就会从别的列身上找补),但列定义不能每帧重建 —— 那会让整张表每帧重新求解布局,
 * 表现就是左侧的列跟着一起动。所以这里只让一个 CSS 变量随帧变化,列数组保持不变。
 */
const dragDelta = ref(0)

/** 表格包含块(Naive 的横向滚动容器)的可见宽度,由下方 measureHost 维护。 */
const hostWidth = ref(0)

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
  filterDefs: () => headerFilterDefs.value,
  renderFilter: renderColumnFilter,
  resizable: () => props.resizable ?? defaults.resizable,
  hostWidth: () => hostWidth.value,
  dragDelta: () => dragDelta.value,
  // 可编辑表格:editor 在下面(rowKeyFn / tableData 之后)才创建,这里只在渲染期才调用,不会碰到声明前使用
  editable: {
    enabled: () => editor.enabled.value,
    cellProps: (col, row, index, host) =>
      editor.cellProps(col as never, row as Record<string, any>, index, host as never),
    renderCell: (col, row, index, display) =>
      editor.renderCell(col as never, row as Record<string, any>, index, display),
  },
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

// 模式 2 默认开,其余模式默认关;宿主显式写了 filterChips 就听宿主的
const chipsEnabled = computed(() => props.filterChips ?? isMode2.value)

/** 字典列的 chip 显示 label 而不是 value;孤儿键(没有列声明,def 为 undefined)没有字典,按原值显示。 */
function optionLabelOf(def: FilterDef | undefined, value: unknown): string {
  if (!def) return String(value ?? '')
  const flat = (opts: SmartTableOption[]): SmartTableOption[] =>
    opts.flatMap((o) => (o.children?.length ? flat(o.children) : [o]))
  const hit = flat(options.getOptions(def.optionsKey)).find((o) => o.value === value)
  return hit ? optionLabel(hit) : String(value ?? '')
}

const chipItems = computed(() =>
  chipsEnabled.value
    ? buildChips(
        filterDefs.value as FilterDef[],
        filters.state.value,
        mergedLabels.value,
        optionLabelOf,
      )
    : [],
)
const chipsHaveDefaults = computed(() => hasActiveDefaults(filterDefs.value as FilterDef[]))
/**
 * 真正画出来的 chips:模式 2 宽 / 中档下,只有 1 条、且它就是工具栏主行里那条构造器条件时不画(主行已经显示了,原型如此);
 * 窄档主行只有输入框,≥ 1 条都画。
 */
const shownChips = computed(() => {
  const items = chipItems.value
  if (
    isMode2.value &&
    tier.value !== 'narrow' &&
    items.length === 1 &&
    builderKeys.value.has(items[0].key)
  )
    return []
  return items
})
const chipsAtDefaults = computed(() =>
  filtersAtDefaults(filterDefs.value as FilterDef[], filters.state.value),
)

/** 点 chip = 请求重开该列面板:给对应 ColumnFilter 递增 openRequest。被隐藏的列没有漏斗,递增了也是空操作。 */
const openTick = reactive<Record<string, number>>({})
function onChipOpen(key: string) {
  // 构造器管的字段 → 开构造器的多条件面板(它列着该字段的全部条件);只有列头漏斗管的列 → 开对应漏斗
  if (isMode2.value && builderKeys.value.has(key)) openBuilderTick.value++
  else openTick[key] = (openTick[key] ?? 0) + 1
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
    closeRequest: closePanelsTick.value,
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

/* ---- 列宽把手的手势 UI(规格 §5.6 / 设计 3.11):贯穿整表的引导线、拖动中的光标、开始时收起过滤气泡、松手后吞掉 click、触屏 ---- */

/** 松手后这么久内的 click 一律吞掉:松手落在表头上会连带触发排序(官方只在 click 落在把手内时才跳过排序,落在 th 其它位置不跳过)。 */
const SWALLOW_CLICK_MS = 150
const resizeGuide = ref<{ left: number; top: number; height: number } | null>(null)
/** 拖动开始 → 递增:各列头的过滤面板据此收起。 */
const closePanelsTick = ref(0)
let guideLeft0: number | null = null
let swallowClickUntil = 0

function findTh(colKey: string): HTMLElement | null {
  const ths = Array.from(scopeEl()?.querySelectorAll<HTMLElement>('th[data-col-key]') ?? [])
  return ths.find((th) => th.getAttribute('data-col-key') === colKey) ?? null
}
function startResizeUi(colKey: string) {
  document.body.classList.add('smart-table-resizing') // 鼠标离开把手后光标仍是 col-resize、不选中文字
  closePanelsTick.value++
  guideLeft0 = findTh(colKey)?.getBoundingClientRect().left ?? null // 被拖列的左缘在拖动中不动,只有右缘跟着走
}
/** 引导线落在被拖列的右缘(= 左缘 + 限幅后的宽度),相对卡片内容区定位,纵向盖住整张表(表头 + 表体,不含分页条)。 */
function moveResizeGuide(limitedWidth: number) {
  if (guideLeft0 === null) return
  const content = scopeEl()?.querySelector<HTMLElement>('.smart-table-card .n-card-content')
  const base = scopeEl()?.querySelector<HTMLElement>('.n-data-table-base-table')
  if (!content || !base) return
  const c = content.getBoundingClientRect()
  const t = base.getBoundingClientRect()
  // 落在被拖列右缘的那条 1px 边线上(边线占 [右缘 − 1, 右缘]),所以再左移 1px
  resizeGuide.value = {
    left: guideLeft0 + limitedWidth - c.left - 1,
    top: t.top - c.top,
    height: t.height,
  }
}
function stopResizeUi() {
  document.body.classList.remove('smart-table-resizing')
  resizeGuide.value = null
  guideLeft0 = null
  swallowClickUntil = performance.now() + SWALLOW_CLICK_MS
}
/** click / touchstart 的处理函数要同时挂在根元素(没开放大时没有放大层)和放大层(放大后内容在根元素之外)上,所以都写成幂等的。 */
function onLayerClickCapture(e: MouseEvent) {
  if (performance.now() < swallowClickUntil) {
    e.stopPropagation()
    e.preventDefault()
  }
}

/**
 * 触屏拖把手:官方 ResizeButton 只监听鼠标事件(把手上的 onMousedown + window 上的 mousemove / mouseup),手指拖不动(实测:触屏模拟下
 * touchStart → touchMove → touchEnd,列宽不变)。这里把「手指落在把手上」的 touchstart / touchmove / touchend 转成同位置的合成鼠标事件,
 * 其余(官方拖拽逻辑、限幅、onUnstableColumnResize、本库的钉住 / 落账)原样走。touchstart 里 preventDefault:免得浏览器随后再补发一套兼容鼠标事件、重复开始手势。
 */
let touchHandle: HTMLElement | null = null
function mouseAt(type: string, t: Touch): MouseEvent {
  return new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: t.clientX,
    clientY: t.clientY,
    button: 0,
  })
}
function onWindowTouchmove(e: TouchEvent) {
  if (!touchHandle || !e.touches[0]) return
  e.preventDefault()
  window.dispatchEvent(mouseAt('mousemove', e.touches[0]))
}
function onWindowTouchend() {
  if (!touchHandle) return
  touchHandle = null
  window.removeEventListener('touchmove', onWindowTouchmove)
  window.removeEventListener('touchend', onWindowTouchend)
  window.removeEventListener('touchcancel', onWindowTouchend)
  window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
}
function onLayerTouchstart(e: TouchEvent) {
  if (e.defaultPrevented || touchHandle) return // 已经被另一层(根元素 / 放大层)处理过
  const handle = (e.target as HTMLElement | null)?.closest<HTMLElement>(
    '.n-data-table-resize-button',
  )
  if (!handle || e.touches.length !== 1) return
  e.preventDefault()
  touchHandle = handle
  window.addEventListener('touchmove', onWindowTouchmove, { passive: false })
  window.addEventListener('touchend', onWindowTouchend)
  window.addEventListener('touchcancel', onWindowTouchend)
  handle.dispatchEvent(mouseAt('mousedown', e.touches[0]))
}

/** 松手才把宽度落进列定义(整个手势只重建一次列),并清掉临时增量。 */
function endResize() {
  if (resizingKey !== null) {
    const key = resizingKey
    const width = pendingWidth
    resizingKey = null
    dragDelta.value = 0
    stopResizeUi()
    columnsApi.setWidth(key, width)
  }
}

function onColumnResize(
  resizedWidth: number,
  limitedWidth: number,
  column: unknown,
  getColumnWidth: unknown,
) {
  const key = (column as { key?: string | number })?.key
  if (key !== undefined) {
    const colKey = String(key)
    draggedKeys.add(colKey)
    if (resizingKey !== colKey) {
      // 换了一列(或新手势):先把上一列的结果落账,再钉住当前布局
      endResize()
      resizingKey = colKey
      startResizeUi(colKey)
      columnsApi.freezeWidths(getColumnWidth as (k: string) => number | undefined)
      window.addEventListener('mouseup', endResize, { once: true })
      // 手势中途松开鼠标发生在浏览器窗口之外(拖出视口边界再放开)时,window 收不到 mouseup ——
      // 用 blur 兜底,窗口失焦也当成手势结束。否则 resizingKey/pendingWidth 会一直悬着,被下一次
      // 跟本次拖拽毫不相关的 mouseup 误触发,把陈旧宽度悄悄落回列定义。endResize 本身是幂等的
      // (resizingKey 为 null 时直接跳过),两个监听器谁先触发都安全,另一个自会在下次触发时空跑。
      window.addEventListener('blur', endResize, { once: true })
    }
    pendingWidth = limitedWidth
    moveResizeGuide(limitedWidth)
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
  delete rest['onUpdate:sorter'] // 由 onSorterChange / sort() / clearSorter() 经 notifyHostSorter 统一转发,只转发一次
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

// Naive 把拖过的列记进内部的 resizableWidthsRef,此后这些列的 <col> 宽度只认拖拽值,既不看我们传的 width 也没有清除入口
// (clearResizableWidth 不在 exposedMethods 里),唯一办法是重挂。所以:记下本次挂载期间拖过的列;
// 「拖过的列」变成吸收列(隐藏最后一列 / 调顺序 / 设固定后)时 tableKey++。tableKey 变了(含「恢复默认」)新实例里没有残留,记录清空。
// 从存储恢复的宽度不会在 Naive 里留残留,不需要重挂。
const draggedKeys = new Set<string>()
watch(tableKey, () => draggedKeys.clear())
watch(
  () => columnsApi.absorberKey.value,
  (key) => {
    if (key && colsPinned.value && draggedKeys.has(key)) tableKey.value++
  },
)

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
  document.body.classList.remove('smart-table-resizing') // 拖动中被卸载:别把光标样式留在 body 上
  window.removeEventListener('touchmove', onWindowTouchmove)
  window.removeEventListener('touchend', onWindowTouchend)
  window.removeEventListener('touchcancel', onWindowTouchend)
})

const rowKeyFn = computed(() => {
  const rk = props.rowKey
  return typeof rk === 'function' ? rk : (row: T) => (row as Record<string, any>)[rk]
})

const tableSize = computed(() => (columnsApi.density.value === 'compact' ? 'small' : 'medium'))

/**
 * fillHeight:官方 flex-height + virtual-scroll 必须一起传;min-row-height 必须 ≥ 真实行高(取 ceil),
 * 官方默认 28 会让滚到底最后一行看不全。默认主题下真实行高 small 39.4 / medium 47.4 → 40 / 48。
 * 兜底 min-height 160:父容器没给定高时表体至少能看见几行。与宿主 attrs 合并时宿主优先(见下面的 tableAttrs)。
 */
const fillOn = computed(() => props.fillHeight || maxActive.value)
// 窄档卡片模式下表格主体是隐藏的(只留分页),不撑满:撑满的是卡片列表(见样式 .smart-table--fill ... .smart-table-cards)
const fillProps = computed(() =>
  fillOn.value && !cardMode.value
    ? {
        flexHeight: true,
        virtualScroll: true,
        minRowHeight: tableSize.value === 'small' ? 40 : 48,
        minHeight: 160,
        style: { flex: '1 1 auto', minHeight: 0 },
      }
    : {},
)
/**
 * 给 <n-data-table> 的合并属性:fillHeight 的默认值在前、宿主透传的 attrs 在后(宿主优先)。
 * Vue 模板里不能写两个 v-bind(`Duplicate attribute`),所以用 mergeProps 合并;它对 style / class / 事件会合并而不是覆盖。
 * forwardedAttrs 在下面才声明,这里只在 computed 里读它,渲染时才求值,不会触发「声明前使用」。
 */
// fillHeight 下表体高度由父容器决定,宿主传的 max-height / maxHeight 会和 flex-height 打架:不透传,警告一次(规格 §4)
let warnedMaxHeight = false
const tableAttrs = computed(() => {
  const host = { ...forwardedAttrs.value } as Record<string, unknown>
  if (fillOn.value) {
    for (const k of ['maxHeight', 'max-height']) {
      if (!(k in host)) continue
      delete host[k]
      // 放大态下表体高度也由放大层决定,静默忽略;只有 fillHeight 才警告(宿主需要知道)
      if (props.fillHeight && !warnedMaxHeight) {
        warnedMaxHeight = true
        console.warn(
          '[smart-naive-table] fillHeight 开启时表体高度由父容器决定,已忽略 max-height;请给父容器设定高。',
        )
      }
    }
  }
  return mergeProps(fillProps.value, host)
})

/** 虚拟滚动(fillHeight)下把当前页第 i 行滚进视口(行高固定 = minRowHeight);已在视口内不动。可编辑表格的方向键与 SmartSelectTable 的键盘导航共用。 */
function revealRow(i: number) {
  const sc = bodyScroller()
  if (!sc || !fillOn.value) return
  // 行高 = 虚拟滚动的 min-row-height(宿主经 attrs 给了就用它,否则按密度 40 / 48)
  const rh = Number(
    attrs.minRowHeight ?? attrs['min-row-height'] ?? (tableSize.value === 'small' ? 40 : 48),
  )
  if (i * rh < sc.scrollTop) tableRef.value?.scrollTo({ top: i * rh })
  else if ((i + 1) * rh > sc.scrollTop + sc.clientHeight)
    tableRef.value?.scrollTo({ top: (i + 1) * rh - sc.clientHeight })
}

/**
 * 翻页 / 改每页条数后(点击当下,不等数据回来):开了 fillHeight → 表体自己在卡片里滚,把它滚回顶部;
 * 没开 → 卡片顶部已滚出视口上沿才滚回卡片顶部(只在需要时滚)。
 */
function onPageChanged() {
  if (fillOn.value) {
    tableRef.value?.scrollTo({ top: 0 })
    return
  }
  const card = scopeEl()?.querySelector<HTMLElement>('.smart-table-card')
  if (card) keepCardTopVisible(card)
}

// NDataTable 的 data 形参是 RowData[](Record 索引),泛型 T 无索引签名,此处收窄。
// 静态模式的过滤在这里落地(远程模式走 fetcher 参数,由后端过滤)。
const baseData = computed(() => {
  if (isRemote.value) return rows.value as Record<string, any>[]
  const local = props.data ?? []
  return applyFilters(
    local,
    filterDefs.value,
    filters.state.value,
    defaults.dateValueFormat,
  ) as Record<string, any>[]
})

/* ---- 可编辑表格(editable;状态机 / 单元格渲染都在 useEditable.ts,这里只做接线) ----
 * 草稿叠在数据上(overlay),宿主的行对象不被改;关掉 editable 时 tableData 就是 baseData,行为与没有这个能力时完全一致。 */
const editCfg = computed<EditableConfig<Record<string, any>>>(() =>
  typeof props.editable === 'object' ? (props.editable as EditableConfig<Record<string, any>>) : {},
)
// 渲染期 / 事件里要读宿主有没有写 @save,必须在 setup 里先把实例抓住(那时 getCurrentInstance 才有值)
const selfInstance = getCurrentInstance()
// 显式标注:columnsApi 的 editable 钩子引用 editor,editor 又读 columnsApi,不标注会循环推断(TS7022)
const editor: UseEditableReturn<Record<string, any>> = useEditable<Record<string, any>>({
  enabled: () => !!props.editable,
  config: () => editCfg.value,
  rowKey: (row) => rowKeyFn.value(row as T),
  rowKeyField: () => (typeof props.rowKey === 'string' ? props.rowKey : undefined),
  columns: () => props.columns as unknown as SmartTableColumn<Record<string, any>>[],
  baseRows: () => baseData.value,
  labels: () => mergedLabels.value,
  getOptions: options.getOptions,
  hasCellSlot: (key) => !!slots[`cell-${key}`],
  emptyText: () => defaults.emptyText,
  visibleKeys: () =>
    leafKeys(
      columnsApi.naiveColumns.value as unknown as Array<{ key?: unknown; children?: unknown[] }>,
    ),
  pageRows: () => pageRows.value,
  scope: () => scopeEl(),
  cardMode: () => cardMode.value,
  goEdgePage: async (position) => {
    // 新增行在顶部 → 第 1 页;在底部 → 最后一页(不分页时无事可做)
    const size = isRemote.value ? pagination.pageSize : localPageSize.value
    const total = isRemote.value ? pagination.itemCount : tableData.value.length
    const target = position === 'top' ? 1 : Math.max(1, Math.ceil(total / (size || 1)))
    if (isRemote.value) {
      if (pagination.page !== target) await table.onPage(target)
    } else if (props.pagination !== false && localPage.value !== target) {
      localPage.value = target
      tableRef.value?.page(target)
      await nextTick()
    }
  },
  checkedKeys: () => hostCheckedKeys() ?? [],
  // fillHeight 的虚拟滚动:方向键 / Tab 走到还没渲染的行 → 把它滚进视口(行高固定 = minRowHeight)
  revealRow: (i) => revealRow(i),
  clearChecked: () => clearChecked(),
  reload: () => refresh(),
  hasSaveListener: () => !!selfInstance?.vnode.props?.onSave,
  onCellChange: (p) => emit('cellChange', p as unknown as CellChange<T>),
  onSave: (p) => emit('save', p as unknown as EditSavePayload<T>),
  onDiscard: () => emit('discard'),
  onInvalid: (p) => emit('invalid', p as unknown as EditInvalid<T>),
  onError: (e) => emit('error', e),
})
/** 叶子数据列的 key(显示序):方向键 / Tab 在可编辑格之间移动用。 */
function leafKeys(cols: Array<{ key?: unknown; children?: unknown[] }>): string[] {
  const out: string[] = []
  for (const c of cols) {
    if (c.children?.length) out.push(...leafKeys(c.children as typeof cols))
    else if (typeof c.key === 'string' && !c.key.startsWith('__')) out.push(c.key)
  }
  return out
}
/**
 * 工具栏 / 批量栏的编辑按钮配置(editable 关闭时为 null,Toolbar 不渲染任何东西)。
 * 写成函数在模板里每次渲染调用(同 batchState):勾选键在宿主的 attrs 里、不是响应式的 —— 批量栏的「删除所选 / 恢复所选」按勾选里有没有待删行决定。
 */
function editToolbarState() {
  if (!editor.enabled.value) return null
  const c = editor.checkedState()
  return {
    count: editor.count.value,
    saving: editor.saving.value,
    add: editCfg.value.add !== false,
    remove: editCfg.value.remove !== false && c.live,
    restore: c.deleted,
  }
}

const tableData = computed(() => {
  const base = baseData.value
  if (!editor.enabled.value) return base
  // 远程:新增行只在它所在的那一页(顶部 = 第 1 页,底部 = 最后一页)出现、顶部时不撑大页长(与原型一致);本地:分页由 NDataTable 切,新增行天然在头 / 尾
  return editor.overlay(
    base,
    isRemote.value
      ? {
          first: pagination.page === 1,
          last: pagination.page >= Math.ceil(pagination.itemCount / (pagination.pageSize || 1)),
          size: pagination.pageSize,
        }
      : undefined,
  )
})

const searchConfig = computed<SearchFormConfig>(() => {
  const user = typeof props.search === 'object' ? props.search : {}
  // SearchForm 只认 layout:container 'none' → 内联,其余 → 网格(container 优先于 layout,见 resolveSearchContainer)
  return {
    cols: defaults.searchCols,
    ...user,
    layout: searchContainer.value === 'none' ? 'inline' : 'grid',
  } // 用户 cols 覆盖全局默认
})

const showToolbar = computed(
  () =>
    props.toolbar !== false ||
    !!props.title ||
    !!slots.title ||
    !!slots.toolbar ||
    (isMode2.value && builderFields.value.length > 0),
)

/* ---- 批量栏(#batch) ---- */

const hasSelectionColumn = computed(() =>
  props.columns.some((c) => isSpecialColumn(c) && c.type === 'selection'),
)

/**
 * 宿主绑的勾选键。库不持有勾选态(读 attrs);attrs 不是响应式的,所以这是个普通函数,在模板里每次渲染调用
 * (宿主改了 checked-row-keys → 重渲染 SmartTable → 这里重新读)。camelCase / kebab-case 两种写法都认。
 */
function hostCheckedKeys(): Array<string | number> | null {
  const v = attrs.checkedRowKeys ?? attrs['checked-row-keys']
  return Array.isArray(v) ? (v as Array<string | number>) : null
}

/** 当前页的行(批量栏的「本页全选」用):远程 = 当前页;本地 = 过滤后的数据按 localPage / 每页条数切一页;pagination: false = 全部。 */
const pageRows = computed<Record<string, any>[]>(() => {
  const all = tableData.value
  if (isRemote.value || props.pagination === false) return all
  const size =
    (typeof props.pagination === 'object' && props.pagination.pageSize) || localPageSize.value
  const page = Math.min(localPage.value, Math.max(1, Math.ceil(all.length / size)))
  return all.slice((page - 1) * size, page * size)
})
/** 本页可勾选的行(selection 列写了 disabled 的行不算,与官方表头全选一致)。 */
const checkablePageRows = computed(() => {
  const sel = props.columns.find((c) => isSpecialColumn(c) && c.type === 'selection') as
    { disabled?: (row: any) => boolean } | undefined
  return sel?.disabled ? pageRows.value.filter((r) => !sel.disabled!(r)) : pageRows.value
})

/**
 * 批量栏状态:四个条件全满足才非 null。「本页全选」复选框与原型一致:本页可勾行全勾上 = 选中,其余一律半选
 * (已选数是跨页总数,勾着别页的行而本页一行没勾时也是半选)。
 */
function batchState(): { count: number; checked: boolean; indeterminate: boolean } | null {
  if ((!slots.batch && !editToolbarState()) || !hasSelectionColumn.value) return null
  const keys = hostCheckedKeys()
  if (!keys || keys.length === 0) return null
  const set = new Set(keys)
  const page = checkablePageRows.value
  const all = page.length > 0 && page.every((r) => set.has(rowKeyFn.value(r as T)))
  return { count: keys.length, checked: all, indeterminate: !all }
}

/** 「本页全选」:true = 并入本页所有可勾行的键(已选的其它页保留),false = 去掉本页的键;载荷同官方表头全选 `(keys, rows, { row: undefined, action })`。 */
function toggleAllPage(checked: boolean) {
  const cur = hostCheckedKeys() ?? []
  const pageKeys = checkablePageRows.value.map((r) => rowKeyFn.value(r as T))
  const next = checked
    ? [...cur, ...pageKeys.filter((k) => !cur.includes(k))]
    : cur.filter((k) => !pageKeys.includes(k))
  const nextRows = pageRows.value.filter((r) => next.includes(rowKeyFn.value(r as T)))
  for (const name of ['onUpdate:checkedRowKeys', 'onUpdateCheckedRowKeys']) {
    callAll(attrs[name], next, nextRows, {
      row: undefined,
      action: checked ? 'checkAll' : 'uncheckAll',
    })
  }
}

/**
 * 「取消选择」/ 插槽的 clear():向宿主绑的更新回调报告「全部取消」(`v-model:checked-row-keys` / `@update:checked-row-keys` 编译出的
 * `onUpdate:checkedRowKeys`,与官方另一个未弃用的写法 `onUpdateCheckedRowKeys`;官方已弃用的 `onCheckedRowKeysChange` 不管;载荷形状同官方
 * `(keys, rows, { row, action })`)。宿主只绑了 checked-row-keys 没绑更新回调(只读)时是空操作。
 */
function clearChecked() {
  for (const name of ['onUpdate:checkedRowKeys', 'onUpdateCheckedRowKeys']) {
    callAll(attrs[name], [], [], { row: undefined, action: 'uncheckAll' })
  }
}
const settingsEnabled = computed(
  () =>
    props.toolbar !== false &&
    (typeof props.toolbar === 'object' ? props.toolbar.columnSettings !== false : true),
)

/**
 * chips 的落点(chips 在表格下方、与分页同一行,不放在工具栏下方——放上面时 chips 出现 / 消失会把表格整体顶下去再弹回来)。
 * 分页由 NDataTable 内置渲染,同一行放 chips 的官方机制是 `pagination.prefix` 渲染函数(NPagination 的 prefix 在页码左侧、与页码同在一个 flex 行里),
 * 所以:分页真的会画出来时,chips 渲染进 prefix(左 chips、右分页);分页不会画(pagination: false / 官方只有 1 页时不画分页)时,
 * 在表格下方自画一行(.smart-table-chips-foot)。表格自己的位置在两种情况下都不受 chips 影响。
 * 代价:仅在宿主显式关了 paginateSinglePage、总页数跨过 1 时,chips 才会在两个位置间切换并重挂一次(「+N」气泡会收起、折叠重新测量)。
 * 「分页会不会画」要先于渲染得知,所以在这里按官方 NDataTable.mergedShowPagination 的同一规则算一遍:
 * paginateSinglePage 官方默认 true(interface.mjs)→ 默认总是画分页(空表、只有 1 页也画),所以默认情况下 chips 恒在分页那一行、出现 / 消失不改变这一行;
 * 只有宿主显式写 paginateSinglePage: false 时才再看 pageCount / itemCount > pageSize。
 * 宿主自己写了 pagination.prefix(盖掉库给的 prefix)时也走自画一行,不去抢宿主的 prefix。
 */
const pagerUser = computed<Partial<PaginationProps>>(() =>
  typeof props.pagination === 'object' ? props.pagination : {},
)
const pagerShown = computed(() => {
  if (props.pagination === false) return false
  const user = pagerUser.value
  const single = attrs.paginateSinglePage ?? attrs['paginate-single-page']
  if (single === undefined || (single !== false && single !== 'false')) return true // 官方 paginateSinglePage 默认 true:只有 1 页也画分页
  if (user.pageCount !== undefined) return user.pageCount > 1
  const size = user.pageSize ?? (isRemote.value ? pagination.pageSize : localPageSize.value)
  const count = user.itemCount ?? (isRemote.value ? pagination.itemCount : tableData.value.length)
  return !!(count && size && count > size)
})
const chipsInPager = computed(
  () => chipsEnabled.value && pagerShown.value && !pagerUser.value.prefix,
)
const chipsWrap = computed(() => tier.value === 'narrow')
const chipsBind = computed(() => ({
  items: shownChips.value,
  labels: mergedLabels.value,
  hasDefaults: chipsHaveDefaults.value,
  atDefaults: chipsAtDefaults.value,
  wrap: chipsWrap.value,
  onOpen: onChipOpen,
  onRemove: onChipRemove,
  onClear: () => filters.clearFilters(),
}))

const paginationPrefix = computed(() => {
  const host = slots['pagination-prefix']
  if (!chipsInPager.value) return host ? (info: unknown) => host(info) : undefined
  // chips 在前(左)、宿主 prefix 在后(紧挨页码);没有 chip 时只剩宿主 prefix(或空),分页仍靠右
  return (info: unknown) => [
    shownChips.value.length ? h(FilterChips, { key: 'chips', ...chipsBind.value }) : null,
    host
      ? h('span', { key: 'host-prefix', class: 'smart-table-pager-host-prefix' }, host(info))
      : null,
  ]
})

/** 官方回调可能是函数也可能是数组(Naive 允许 MaybeArray),逐个调用。 */
function callAll(handler: unknown, ...args: unknown[]) {
  for (const fn of Array.isArray(handler) ? handler : [handler])
    if (typeof fn === 'function') fn(...args)
}

/**
 * 2.1.1 里改每页条数走的是官方 NDataTable,它会按多种拼写通知宿主(use-table-data.mjs:182-197、239-247):
 * pagination 级 onPageSizeChange / 'onUpdate:pageSize';表格级 onUpdatePageSize / 'onUpdate:pageSize' / onPageSizeChange。
 * 内层嵌套选择器绕开了 NDataTable,只调用了 onSize 这一个入口,上面这些拼写都不会触发——
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
  // 默认官方 simple;传 { simple: false } 回到页码序列(此时走官方 showSizePicker / pageSizes)
  const simple = user.simple ?? true
  const showSizePicker = user.showSizePicker ?? defaults.showSizePicker // 单表的 false 也要认
  const current = user.pageSize ?? (isRemote.value ? pagination.pageSize : localPageSize.value)
  // 保留 { label, value } 对象;并入当前值(官方在当前值不在选项里时显示裸值)
  // 宿主(实例或全局)没显式给 pageSizes 时按 fillHeight 取内置;fillHeight 是 prop,挂载后变化会让这个 computed 重算
  const sizes = mergePageSizes(
    resolvePageSizes({
      user: user.pageSizes,
      global: defaults.pageSizes,
      globalGiven: defaults.pageSizesGiven,
      fillHeight: props.fillHeight,
    }),
    current,
  )

  // 本地模式改每页条数的状态更新(回第 1 页同步表格页码 + 转发宿主回调),remote/local 两个
  // onUpdatePageSize 入口(内层嵌套选择器 / 非 simple 时交给官方选择器)共用这同一段状态变更逻辑。
  // onPageChanged() 放在第一行:这是本地模式下两条路径(下面 onSizeBypass 的本地分支、
  // 以及 simple:false 时 NDataTable 原生选择器直接绑的 onUpdatePageSize: applyLocalSize)
  // 唯一的汇合点 —— 写在这里而不是分别写在两条路径里,才能保证「改每页条数」在两条路径下
  // 都恰好触发一次(simple:false 的原生选择器直接绑 applyLocalSize、不经 onSizeBypass,
  // 调用若只放在 onSizeBypass 里,翻页回卡片顶部 / fillHeight 表体复位在该路径下会静默失效)。
  function applyLocalSize(n: number) {
    onPageChanged()
    localPageSize.value = n
    // 改每页条数回第 1 页(与远程一致)。官方外层本地分页只会静默夹页、不发 onUpdatePage,
    // 所以库里记页码的 localPage 要自己置 1,并同步表格的页码
    localPage.value = 1
    tableRef.value?.page(1)
    callAll(user.onUpdatePageSize, n) // 转发宿主的回调
  }

  /**
   * 「绕开 NDataTable」入口 —— 只有内层嵌套选择器(渲染在 suffix 里的那个官方 NPagination)用这个。
   * 它是我们自己 h() 出来的一个独立组件实例,完全不经过 NDataTable 内部的
   * mergedOnUpdatePageSize/doUpdatePageSize(use-table-data.mjs),所以必须自己补发 notifyPageSizeListeners
   * ——否则宿主用那 5 种拼写监听会静默收不到通知。
   */
  const onSizeBypass = isRemote.value
    ? // 远程:与 2.1.1 一致 —— 宿主给了自己的处理函数就由宿主接管,否则走 useSmartTable(回第 1 页重查)
      (n: number) => {
        onPageChanged() // 改每页条数也算翻页,当下(不等数据回来)判断是否要滚回卡片顶部 / 表体复位
        callAll(user.onUpdatePageSize ?? table.onPageSize, n)
        notifyPageSizeListeners(user, n)
      }
    : // 本地:onPageChanged() 已经在 applyLocalSize 内部触发一次,这里不重复调用
      // (否则 simple:true 的内层嵌套选择器会把 onPageChanged 触发两次)。
      (n: number) => {
        applyLocalSize(n)
        notifyPageSizeListeners(user, n)
      }

  // 窄档卡片模式:分页项放大到触控的 40px(设计原型;官方 large 项只有 34,所以用组件级主题覆盖);输入框 / 下拉的大小走下面模板里 NConfigProvider 的 Pagination.inputSize
  const base: Partial<PaginationProps> = {
    simple,
    prefix: paginationPrefix.value,
    ...(cardMode.value ? { size: 'large', themeOverrides: { itemSizeLarge: '40px' } } : {}),
  }
  // simple 下官方不渲染每页选择器(Pagination.mjs:665):在官方 suffix 里嵌一个只渲染 size-picker 的官方 NPagination。
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
  // 非 simple 回退:走官方 showSizePicker / pageSizes。pageSizes 放在 ...user 之后,免得宿主原值盖掉并入了当前值的版本
  const tail: Partial<PaginationProps> = simple ? {} : { showSizePicker, pageSizes: sizes }

  if (isRemote.value) {
    return {
      ...base,
      page: pagination.page,
      pageSize: pagination.pageSize,
      // 可编辑表格:待保存的新增行也计入总数(原型 r.total++)
      itemCount: pagination.itemCount + (editor.enabled.value ? editor.store.news.length : 0),
      ...user,
      ...tail,
      // onUpdatePage / onUpdatePageSize 放在 ...user / ...tail 之后(排在它们之前会被 spread 覆盖掉):
      // 保证宿主即使传了自己的分页回调,onPageChanged()(翻页后滚回卡片顶部 / fillHeight 下表体复位)也始终会跑;
      // 真正的分页动作仍按「宿主给了自己的处理函数就由宿主接管」的语义转发(callAll + ?? 兜底),不是库跳过宿主自己接管。
      onUpdatePage: (p: number) => {
        onPageChanged()
        callAll(user.onUpdatePage ?? table.onPage, p) // 与 2.1.1 一致:宿主给了自己的处理函数就由宿主接管
      },
      // 不复用 onSizeBypass(它额外调用 notifyPageSizeListeners):这里走的是 NDataTable 原生 pagination.onUpdatePageSize
      // 入口,官方 mergedOnUpdatePageSize(use-table-data.mjs)自己就会按 pagination 级(2 种拼写,随 ...user 并入
      // pagination 对象)+ table 级(3 种拼写,随 ...tableAttrs 并入 attrs)共 5 种拼写转发,再调
      // notifyPageSizeListeners 会把这 5 种拼写(不只是 attrs 那 3 种)全部重复通知一遍
      // (remote 同样适用)。
      onUpdatePageSize: (n: number) => {
        onPageChanged()
        callAll(user.onUpdatePageSize ?? table.onPageSize, n)
      },
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
      onPageChanged()
      callAll(user.onUpdatePage, p)
    },
    // 「走 NDataTable 原生链路」入口:simple:false 时宿主看到的是 NDataTable 自己渲染的官方选择器,
    // 改动经它内部的 mergedOnUpdatePageSize/doUpdatePageSize 流转,那条链路自己就会按 5 种拼写通知宿主
    // (且会读到这里挂的 onUpdatePageSize)——这里只做状态更新,不能再调 notifyPageSizeListeners,
    // 否则 simple:false + 本地模式下宿主会被通知两次。simple:true 时 NDataTable
    // 内部官方分页本就不画 size-picker(Pagination.mjs:665),这个 key 实际不会被那条原生链路触发,
    // 真正改每页条数走的是上面的 onSizeBypass(suffix 里的内层嵌套选择器)。
    // applyLocalSize 内部已经调用 onPageChanged():simple:false 这条原生链路也经它,
    // 改每页条数滚回卡片顶部 / fillHeight 下表体复位,跟内层嵌套选择器一样各自恰好触发一次。
    onUpdatePageSize: applyLocalSize,
  }
})

/**
 * 「列宽已钉住」态:拖过一次之后,除吸收列外每一列(含序号/勾选列)都有确定宽度。
 * table-layout 切 fixed —— Naive 默认是 auto,auto 下 <col> 宽度只是建议值,浏览器每次都按内容重新求解
 * 整张表,改一列所有列都会挪。最后一个可见、非固定、可拖的列(吸收列)不写宽度,fixed 布局下它自然拿到剩余宽度,
 * 所以表格既填满容器、右侧不留白,又不牵动任何一列(见 useColumns 的 absorber)。
 */
const colsPinned = columnsApi.pinned

// 宿主显式传了 table-layout 就听宿主的
const mergedTableLayout = computed<'auto' | 'fixed' | undefined>(() => {
  const host = (attrs.tableLayout ?? attrs['table-layout']) as 'auto' | 'fixed' | undefined
  if (host) return host
  return colsPinned.value ? 'fixed' : undefined
})

/** 库根节点宽度(ResizeObserver 维护)。< 600 视为窄档:分页不画每页选择器(卡片内宽 ≤ 340 时它会折行)。0 = 还没量到,按非窄档处理。 */
const rootWidth = ref(0)
const narrowPager = computed(() => rootWidth.value > 0 && rootWidth.value < 600)
/** 容器宽三档(设计 2.6 / 2.11;JS 判定而不是 @container:构造器的气泡 / 抽屉本来就要 JS 知道档位,且不给根元素加 container-type 的副作用):窄 < 600、中 < 1280、宽 ≥ 1280。 */
const tier = computed<'narrow' | 'mid' | 'wide'>(() =>
  rootWidth.value === 0
    ? 'wide'
    : rootWidth.value < 600
      ? 'narrow'
      : rootWidth.value < 1280
        ? 'mid'
        : 'wide',
)

/* ---- 窄档卡片模式(cardOnNarrow,规格 §5.8) ----
 * 表格主体换成卡片列表,但 NDataTable 仍然挂着:分页(含 chips 所在的 prefix、本地分页状态、远程的页码通知)、
 * 加载态、宿主透传的各种 attrs 全都继续走官方这一套,只用 CSS 把它的表体藏起来。卡片只负责「当前页的行怎么画」。 */
const cardMode = computed(() => props.cardOnNarrow && tier.value === 'narrow')
/** 窄档卡片模式的分页:页码输入框 / 下拉跟着项一起放大到 large(40px);官方 NConfigProvider 的 Pagination.inputSize / selectSize。 */
const pagerOptions = computed(() =>
  cardMode.value
    ? { Pagination: { inputSize: 'large' as const, selectSize: 'large' as const } }
    : undefined,
)

/* ---- 窄档排序抽屉:卡片模式没有表头,排序入口收在工具栏的「排序」按钮里(规格 §5.4) ---- */
const sortRows = computed(() =>
  cardMode.value ? sortDrawerRows(props.columns, sorterInfo.value) : [],
)
const sortDrawerOpen = ref(false)
watch(cardMode, (on) => {
  if (!on) sortDrawerOpen.value = false
})
/** 抽屉里改某一列后的下一个排序态(单列互斥 / 多列并存同点表头一套规则)。 */
function nextSorts(cur: SortItem[], key: string, order: 'ascend' | 'descend' | false): SortItem[] {
  return sortTransition(cur, sorterInfo.value, key, order)?.items ?? cur
}
/** 提交一份排序态:与 sort() / clearSorter() 一样转发官方 onUpdate:sorter 载荷(空 = null;含 multiple 列 = 数组,否则单个对象)。 */
function commitSorts(items: SortItem[]) {
  applySorts(items)
  if (items.length === 0) return notifyHostSorter(null)
  const events = items.map((i) => ({
    columnKey: i.field,
    sorter: sorterInfo.value.get(i.field)?.sorter,
    order: i.order,
  }))
  notifyHostSorter(items.some((i) => sorterInfo.value.get(i.field)?.multiple) ? events : events[0])
}
function onSortDrawerConfirm(items: SortItem[]) {
  sortDrawerOpen.value = false
  if (JSON.stringify(items) !== JSON.stringify(sortState.value)) commitSorts(items)
}
function onSortDrawerReset() {
  sortDrawerOpen.value = false
  const init = deriveInitSorts(props.columns)
  if (JSON.stringify(init) !== JSON.stringify(sortState.value)) commitSorts(init)
}

/** 卡片视图:列设置之后的最终列(隐藏的列不在里面)+ 声明列的标签。 */
/**
 * 窄档卡片:宿主给了 naive 的 summary(合计行)时,卡片列表里显示「合计」卡。官方 CreateSummary 返回一行(对象)或多行(数组),
 * 数组形式每行各出一张卡;每张卡:标题 = 该行里标题列(卡片标题那一列)的值,其余 = 有合计值的卡片字段(标签:值),整行都没有值的跳过。
 * summary 的入参是卡片列表当前的行(含可编辑表格的草稿)。位置同官方 summary-placement(见 cardSummaryPlacement)。
 */
type SummaryRow = Record<string, { value?: unknown } | undefined>
const cardSummary = computed(() => {
  const fn = attrs.summary as ((rows: T[]) => SummaryRow | SummaryRow[]) | undefined
  const view = cardView.value
  if (!cardMode.value || !view || typeof fn !== 'function') return null
  const res = fn(cardRows.value) ?? {}
  const cards = (Array.isArray(res) ? res : [res]).flatMap((row) => {
    const title = row?.[view.title?.key ?? '']?.value
    const metas = view.metas
      .filter((m) => row?.[m.key]?.value !== undefined)
      .map((m) => ({ key: m.key, label: m.label, value: row![m.key]!.value }))
    return title === undefined && !metas.length ? [] : [{ title, metas }]
  })
  return cards.length ? cards : null
})
// attrs 不是响应式的:写成函数、在模板里每次渲染取(同 hostCheckedKeys),宿主换 summary-placement 能跟上
const cardSummaryPlacement = (): 'top' | 'bottom' =>
  (attrs.summaryPlacement ?? attrs['summary-placement']) === 'top' ? 'top' : 'bottom'
const cardView = computed(() =>
  cardMode.value
    ? buildCardView<T>(columnsApi.naiveColumns.value, props.columns, { index: props.rowDraggable })
    : null,
)

/** 当前页的行。远程 = 请求回来的那一页;本地 = 过滤后的数据按排序态排好再切页(NDataTable 内部的结果拿不到)。 */
const cardRows = computed<T[]>(() => {
  if (!cardMode.value) return []
  if (isRemote.value) return tableData.value as T[]
  const sorted = orderLocalRows(tableData.value as T[], sortState.value, sorterInfo.value)
  if (props.pagination === false) return sorted
  const user = pagerUser.value
  return sliceRows(sorted, user.page ?? localPage.value, user.pageSize ?? localPageSize.value)
})

/** 宿主没绑 checked-row-keys 时,卡片勾选用内部态兜底(表格模式下官方自己有内部态,切档不互通)。 */
const localChecked = ref<Array<string | number>>([])
function hostExpandedKeys(): Array<string | number> {
  const v = attrs.expandedRowKeys ?? attrs['expanded-row-keys']
  return Array.isArray(v) ? (v as Array<string | number>) : []
}

/** 卡片右上角勾选框:载荷同官方单行勾选 `(keys, rows, { row, action })`。 */
function onCardCheck(row: T, checked: boolean) {
  const key = rowKeyFn.value(row)
  const host = hostCheckedKeys()
  const cur = host ?? localChecked.value
  const next = checked
    ? cur.includes(key)
      ? [...cur]
      : [...cur, key]
    : cur.filter((k) => k !== key)
  if (!host) localChecked.value = next
  const nextRows = cardRows.value.filter((r) => next.includes(rowKeyFn.value(r)))
  for (const name of ['onUpdate:checkedRowKeys', 'onUpdateCheckedRowKeys']) {
    callAll(attrs[name], next, nextRows, { row, action: checked ? 'check' : 'uncheck' })
  }
}

/** 表格总宽下限 = 各列宽度之和(含吸收列的下限)+ 拖拽中的临时增量。scroll-x 与 CSS 变量共用。 */
const colsWidth = computed(() => columnsApi.scrollX.value + dragDelta.value)

// 当前行高亮色:--smart-table-active-row-bg 只在宿主给了全局 activeRowBg 时才写(没给就不写,
// 宿主也能在祖先元素上自己设这个变量);没给时用 -auto = 当前主题主色 9%,明暗各自跟随主题。
// 库自己的元素上取不到 var(--n-*),所以走 useThemeVars()(与表头把手的引导线同一做法);CSS 里 bg 优先、auto 兜底。
const rootStyle = computed(() => ({
  '--smart-table-active-row-bg': defaults.activeRowBg,
  '--smart-table-active-row-bg-auto': `color-mix(in srgb, ${themeVars.value.primaryColor} 9%, transparent)`,
  // 行拖拽:拖影的阴影 = 主题的浮层阴影(明 / 暗各自的值);占位行 = 主题主色 12% 的淡底。同样是库自己的元素,取不到 --n-*
  '--smart-table-drag-shadow': themeVars.value.boxShadow2,
  '--smart-table-drag-tint': `color-mix(in srgb, ${themeVars.value.primaryColor} 12%, transparent)`,
  ...editor.styleVars.value,
}))

// 消费者显式传 scroll-x 时让位(v-bind 顺序也保证其覆盖)。
// 用 colsWidth 而非 scrollX:拖拽期间外层滚动容器的 min-width 要和表格总宽同步,否则表格溢出容器。
const autoScrollX = computed(() =>
  'scrollX' in attrs || 'scroll-x' in attrs ? undefined : colsWidth.value,
)

/**
 * @row-click 忽略来自行内交互控件的点击(选择器与设计原型的 `button, input, a, [data-act], [data-open], [data-stop]` 对齐,再补上 naive 的真实 DOM):
 * NButton 渲染成 button;NCheckbox / NRadio / NSwitch 的根是 div(.n-checkbox / .n-radio / .n-switch,不是原生 input);
 * NInput / NSelect / NInputNumber / NDatePicker 等的根是 .n-input / .n-base-selection / ...;展开箭头是 .n-data-table-expand-trigger。
 * NPopconfirm / NDropdown 的触发器就是宿主放进去的 button,已被 button 覆盖;它们的浮层 Teleport 到 body,点浮层不会经过行。
 */
const ROW_CLICK_IGNORE =
  'button, input, textarea, select, a, label, [role="button"], [role="checkbox"], [role="radio"], [role="switch"], [role="combobox"], ' +
  '.n-button, .n-checkbox, .n-radio, .n-switch, .n-input, .n-input-number, .n-base-selection, .n-date-picker, .n-base-close, ' +
  '.n-data-table-expand-trigger, [data-act], [data-open], [data-stop]'
/** 点击目标(或它在本行内的祖先)是交互控件。只看行内:包住整张表的 label / a 之类的外层祖先不算。 */
function clickedInteractive(e: Event): boolean {
  const target = e.target
  const row = e.currentTarget
  if (!(target instanceof Element) || !(row instanceof Element)) return false
  const hit = target.closest(ROW_CLICK_IGNORE)
  return !!hit && row.contains(hit)
}

// 行 props:合并宿主经 attrs 传入的 row-props + 内置高亮(activeRowKey)与行点击(@row-click)。
// 显式绑定在 v-bind="attrs" 之后,故此处结果最终生效(已并入宿主的 row-props)。
type RowPropsFn = (row: T, index: number) => Record<string, any>
const mergedRowProps = computed<RowPropsFn>(() => {
  const host = (attrs.rowProps ?? attrs['row-props']) as RowPropsFn | undefined
  const active = props.activeRowKey
  return (row: T, index: number) => {
    const base = host ? { ...host(row, index) } : {}
    const isActive = active !== undefined && active !== null && rowKeyFn.value(row) === active
    const cls = [
      base.class,
      isActive ? 'smart-table-row--active' : '',
      editor.rowClass(row as Record<string, any>),
    ]
      .filter(Boolean)
      .join(' ')
    const hostClick = base.onClick as ((e: MouseEvent) => void) | undefined
    return {
      ...base,
      ...(cls ? { class: cls } : {}),
      onClick: (e: MouseEvent) => {
        hostClick?.(e) // 宿主自己的 onClick 不受忽略规则影响
        if (clickedInteractive(e)) return
        // 可编辑表格的窄档卡片:点卡片 = 打开底部抽屉表单(窄档不逐格编辑)
        if (editor.enabled.value && cardMode.value) editor.openForm(String(rowKeyFn.value(row)))
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

/* ---- 放大(toolbar.maximize) ---- */

const maxCfg = computed(() =>
  resolveMaximize(typeof props.toolbar === 'object' ? props.toolbar.maximize : undefined),
)
const maximized = ref(false)
/** 放大中。宿主把 toolbar.maximize 关掉时自动回落为「未放大」(下面的 watch 负责解锁)。 */
const maxActive = computed(() => maxCfg.value.enabled && maximized.value)
/** 放大层(被 Teleport 搬到 body 的元素;只在开了 toolbar.maximize 时存在)。未放大时它在根元素里、display: contents,对布局透明。 */
const layerRef = ref<HTMLElement | null>(null)
/** 查 DOM 的范围:有放大层就是它(放大后内容不在根元素底下了),没开放大就是根元素。 */
const scopeEl = (): HTMLElement | null => layerRef.value ?? rootRef.value
/**
 * 放大层的 div 由 MaximizeLayer 渲染(Teleport 作根,拿不到本组件的 scoped 属性),而下面所有 `.smart-table :deep(...)` / `.smart-table-layer` 规则都是 scoped 的:
 * 不把本组件的 scope id 手动带上,放大(被搬到 body)后这些规则全部失效(悬停图标、把手、表头内边距……)。 */
const scopeId = (getCurrentInstance()?.type as { __scopeId?: string } | undefined)?.__scopeId
const scopeAttrs: Record<string, string> = scopeId ? { [scopeId]: '' } : {}
const toolbarRef = ref<{ focusMaximize: () => void } | null>(null)
/** 放大前根元素的高度:Teleport 走后原位留一个同高占位,宿主页面的文档高度不变(否则还原后页面滚动位置可能被夹)。 */
const holderHeight = ref(0)
const themeVars = useThemeVars()
/**
 * 放大层的底色 = 官方 NLayout embedded 的底(layout/styles/light.mjs:22 colorEmbedded = actionColor;dark.mjs:25 = bodyColor),
 * 与宿主常用的灰底页面一致,卡片在上面分得出层次。亮 / 暗靠 baseColor 区分(亮 #FFF、暗 #000,与角标文字色同一取法)。
 */
const layerStyle = computed(() => {
  if (!maxActive.value) return undefined
  const v = themeVars.value
  const dark = v.baseColor.toLowerCase() === '#000'
  return {
    zIndex: maxCfg.value.zIndex,
    background: dark ? v.bodyColor : v.actionColor,
    color: v.textColor2,
  }
})
const holderStyle = computed(() =>
  maxActive.value ? { minHeight: `${holderHeight.value}px` } : undefined,
)
const stateClass = computed(() => ({
  'smart-table--pinned-cols': colsPinned.value,
  'smart-table--fill': fillOn.value,
  'smart-table--chips-pager': chipsInPager.value,
  'smart-table--chips-wrap': chipsInPager.value && chipsWrap.value,
  'smart-table--cards': cardMode.value,
  'smart-table--editable': editor.enabled.value,
}))

/** 表体的滚动容器:虚拟滚动(fillHeight / 放大态)下是 vueuc VirtualList 的 `.v-vl`,否则是 n-scrollbar 的容器。Teleport 搬 DOM 会把它的 scrollTop 清零(spike s2 实测),切换前读、切换后还原。 */
function bodyScroller(): HTMLElement | null {
  return (
    scopeEl()?.querySelector<HTMLElement>(
      '.n-data-table-base-table-body .v-vl, .n-data-table-base-table-body .n-scrollbar-container',
    ) ?? null
  )
}

async function toggleMaximize() {
  if (!maxCfg.value.enabled) return
  const top = bodyScroller()?.scrollTop ?? 0
  if (!maximized.value)
    holderHeight.value = Math.round(rootRef.value?.getBoundingClientRect().height ?? 0)
  maximized.value = !maximized.value
  await nextTick()
  if (top > 0) {
    tableRef.value?.scrollTo({ top })
    // flex-height / 虚拟滚动切换后表体要再布局一帧才有可滚动高度,补一次
    requestAnimationFrame(() => tableRef.value?.scrollTo({ top }))
  }
  // 只有键盘操作才把焦点还给按钮:Teleport 搬 DOM 后按钮失焦;鼠标点的不还,否则会冒出黑色焦点环
  if (isKeyboardModality()) toolbarRef.value?.focusMaximize()
}

// Esc 分层:先收气泡 / 抽屉 / 下拉(它们自己处理 Esc),没有浮层了再 Esc 才还原。
// 捕获阶段先读「此刻有没有浮层」:冒泡阶段 NSelect / NDatePicker 已把自己关掉,读到的会是「没有」,会把整张表一起还原。
// 筛选面板自己在捕获阶段处理 Esc 并 stopPropagation(下拉展开时放行),所以冒泡到这里的 Esc 才可能是「该还原了」。
let escHadFloat = false
function onDocKeydownCapture(e: KeyboardEvent) {
  if (e.key === 'Escape') escHadFloat = hasOpenFloat()
}
function onDocKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape' || e.isComposing || e.defaultPrevented || escHadFloat) return
  void toggleMaximize()
}
function onLayerKeydown(e: KeyboardEvent) {
  if (maxActive.value && layerRef.value) loopTab(e, layerRef.value) // role=dialog aria-modal:Tab 在放大层内循环,不掉回被盖住的宿主页面
}
function bindMaxListeners() {
  lockScroll()
  document.addEventListener('keydown', onDocKeydownCapture, true)
  document.addEventListener('keydown', onDocKeydown)
}
function unbindMaxListeners() {
  unlockScroll()
  document.removeEventListener('keydown', onDocKeydownCapture, true)
  document.removeEventListener('keydown', onDocKeydown)
}
watch(maxActive, (on, was) => {
  if (on) bindMaxListeners()
  else if (was) unbindMaxListeners()
})
// 输入方式追踪要在「第一次点放大」之前就开始(开了 toolbar.maximize 就追踪),否则第一次是键盘还是鼠标不得而知
let releaseModality: (() => void) | null = null
watch(
  () => maxCfg.value.enabled,
  (enabled) => {
    releaseModality?.()
    releaseModality = enabled ? trackInputModality() : null
  },
  { immediate: true },
)
let warnedZ = false
watch(
  () => maxCfg.value,
  (c) => {
    // naive 的动态浮层从 2000 起,放大层 ≥ 2000 会盖住表格自己的筛选气泡 / 下拉
    if (c.enabled && c.zIndex >= 2000 && !warnedZ) {
      warnedZ = true
      console.warn(
        '[smart-naive-table] toolbar.maximize.zIndex ≥ 2000 会盖住表格自己的气泡 / 下拉(naive 的浮层层级从 2000 起),请调小。',
      )
    }
  },
  { immediate: true },
)
onBeforeUnmount(() => {
  releaseModality?.()
  releaseModality = null
  if (maxActive.value) unbindMaxListeners() // 放大中被卸载(路由切换):解除滚动锁定与监听
})

/* ---- 量出容器宽度(窄档分页 + 吸收列退路) ---- */

let resizeObserver: ResizeObserver | null = null
let observedBody: HTMLElement | null = null

/**
 * 表格的包含块是 Naive 的横向滚动容器;「没有可拖的非固定列」的退路里,吸收列的显式宽度按它的可见宽度
 * (已扣掉纵向滚动条)算(见 useColumns 的 leafWidth)。
 * 这个元素会随 tableKey 重建,所以每次测量顺手把 ResizeObserver 挪到当前这个上。
 */
function measureHost() {
  // 放大态:根元素在原位只剩一个占位,宽度取放大层的内容宽(减去两侧各 16px 内边距);否则取根元素
  const el = maxActive.value ? layerRef.value : rootRef.value
  // 量到 0 = 被 keep-alive 摘下(或 display: none),不是真的 0 宽:沿用上一次的宽度,
  // 否则档位会掉回「还没量到」的宽档,容器实际更窄时挂回页面要多渲染一帧宽档布局才回到真实档位。从没量到过(rootWidth 仍是 0)照旧。
  const measured = el?.clientWidth ?? 0
  if (measured > 0 || rootWidth.value === 0)
    rootWidth.value = Math.max(0, measured - (maxActive.value ? 32 : 0))
  const body = scopeEl()?.querySelector<HTMLElement>('.n-data-table-base-table-body') ?? null
  if (resizeObserver && body !== observedBody) {
    if (observedBody) resizeObserver.unobserve(observedBody)
    if (body) resizeObserver.observe(body)
    observedBody = body
  }
  hostWidth.value = body?.clientWidth ?? 0
}

onMounted(() => {
  // SSR / 测试环境可能没有 ResizeObserver:量一次就走(之后容器变宽变窄,退路吸收列的显式宽度不再跟着更新)
  if (typeof ResizeObserver !== 'undefined')
    resizeObserver = new ResizeObserver(() => measureHost())
  if (resizeObserver && rootRef.value) resizeObserver.observe(rootRef.value)
  if (resizeObserver && layerRef.value) resizeObserver.observe(layerRef.value) // 放大态下根元素没有尺寸,量的是放大层
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
  // 窄档卡片模式下可拖的是卡片列表(每张卡片一个子元素,等价于表体里的一行)
  getTbody: () =>
    scopeEl()?.querySelector<HTMLElement>(
      cardMode.value ? '.smart-table-cards' : '.n-data-table-tbody',
    ),
  rows: () => (isRemote.value ? rows.value : props.data) as T[] | undefined,
  handle: () => props.dragHandle,
  // 可编辑表格:新增行在顶部时排在数据行前面(不是 rows 数组里的元素),拖拽下标要减掉它们;新增行自己不能拖
  offset: () =>
    editor.enabled.value && editor.addPosition() === 'top' ? editor.store.news.length : 0,
  filter: () => (editor.enabled.value ? '.smart-table-xnew' : undefined),
  onSort: (e) => {
    emit('rowDragSort', e)
    editor.repaint() // 行重排后补画选中框
  },
})
// useRowDrag 内部只在 rows 数组变化时重新绑定;tableKey 变化(「恢复默认」强制重挂
// <n-data-table>)换掉的是 DOM 里的 tbody 本身,rows 数组引用/内容都没变,那个 watch
// 不会触发 —— sortable 实例还挂在已经被卸载的旧 tbody 上,行拖拽因此悄悄失效。这里补一次
// 主动对齐,让它去找新挂载出来的 tbody 重新绑定。
watch(tableKey, () => void rowDrag.sync())
// 切到 / 切出窄档卡片:拖拽的容器从 tbody 换成卡片列表(或反过来),重新对齐
watch(cardMode, () => void rowDrag.sync())

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
  revealRow,
  /** 跳到第 n 页(远程 = 重查;本地 = 切页)。 */
  goPage: (n: number) =>
    isRemote.value ? table.onPage(n) : Promise.resolve(tableRef.value?.page(n)),
  // 可编辑表格(editable)
  dirtyCount: editor.count,
  isDirty: editor.isDirty,
  setCell: editor.setCell,
  getChanges: editor.getChanges,
  save: editor.save,
  discard: editor.discard,
})
</script>

<template>
  <div
    ref="rootRef"
    class="smart-table"
    :class="stateClass"
    :style="[rootStyle, holderStyle]"
    @click.capture="onLayerClickCapture"
    @touchstart="onLayerTouchstart"
  >
    <MaximizeLayer
      v-bind="scopeAttrs"
      :enabled="maxCfg.enabled"
      :active="maxActive"
      :set-el="(el) => (layerRef = el)"
      class="smart-table smart-table-layer"
      :class="[stateClass, { 'smart-table-layer--maximized': maxActive }]"
      :style="[rootStyle, layerStyle]"
      :role="maxActive ? 'dialog' : undefined"
      :aria-modal="maxActive ? 'true' : undefined"
      :aria-label="maxActive ? (props.title ?? mergedLabels.maximize) : undefined"
      @keydown="onLayerKeydown"
      @click.capture="onLayerClickCapture"
      @touchstart="onLayerTouchstart"
    >
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
          ref="toolbarRef"
          :title="props.title"
          :labels="mergedLabels"
          :config="props.toolbar ?? {}"
          :density="columnsApi.density.value"
          :remote="isRemote"
          :batch="batchState()"
          :tier="tier"
          :maximizable="maxCfg.enabled"
          :maximized="maxActive"
          :fold="cardMode"
          :sort-entry="sortRows.length > 0"
          :sort-count="sortState.length"
          @open-sort="sortDrawerOpen = true"
          :edit="editToolbarState()"
          @edit-save="editor.save"
          @edit-discard="editor.discard"
          @edit-add="editor.add"
          @edit-delete-selected="editor.deleteChecked"
          @edit-restore="editor.restoreChecked"
          @refresh="refresh"
          @update:density="columnsApi.setDensity"
          @more-select="(k, o) => emit('moreSelect', k, o)"
          @clear-selection="clearChecked"
          @toggle-maximize="toggleMaximize"
          @toggle-all="toggleAllPage"
        >
          <template v-if="slots.title" #title><slot name="title" /></template>
          <template v-if="slots.batch" #batch>
            <slot name="batch" :checked-row-keys="hostCheckedKeys() ?? []" :clear="clearChecked" />
          </template>
          <template v-if="slots.toolbar" #left><slot name="toolbar" /></template>
          <template v-if="isMode2 && builderFields.length" #cond>
            <ConditionBar
              :fields="builderFields"
              :draft="builderDraft"
              :labels="mergedLabels"
              :get-options="options.getOptions"
              :is-loading-options="options.isLoading"
              :date-value-format="defaults.dateValueFormat"
              :tier="tier"
              :loading="loading"
              :applied-count="builderAppliedCount"
              :open-request="openBuilderTick"
              @update:draft="(d: BuilderDraft) => (builderDraft = d)"
              @search="onBuilderSearch"
              @reset="onBuilderReset"
            />
          </template>
          <template v-if="slots['toolbar-right']" #right><slot name="toolbar-right" /></template>
          <template v-if="settingsEnabled" #settings="{ size }">
            <ColumnSettings
              :size="size"
              :items="columnsApi.settingItems.value"
              :labels="mergedLabels"
              @toggle="columnsApi.toggleShow"
              @move="columnsApi.moveCheck"
              @set-fixed="columnsApi.setFixed"
              @reset="onResetSettings"
            />
          </template>
        </Toolbar>

        <!-- single-line:false = 单元格竖线。Naive 的 bordered 只画外框,格子线归 single-line 管。
             绑在 v-bind="attrs" 前,宿主写 :single-line="true" 可覆盖回单线样式。 -->
        <!-- 窄档卡片模式(cardOnNarrow):卡片列表替换表体;下面的 n-data-table 仍在,只留分页(见 cardMode) -->
        <SortDrawer
          v-if="cardMode && sortRows.length"
          v-model:show="sortDrawerOpen"
          :rows="sortRows"
          :current="sortState"
          :labels="mergedLabels"
          :next="nextSorts"
          @confirm="onSortDrawerConfirm"
          @reset="onSortDrawerReset"
        />
        <CardList
          v-if="cardMode && cardView"
          :rows="cardRows"
          :summary="cardSummary"
          :summary-placement="cardSummaryPlacement()"
          :view="cardView"
          :row-key="rowKeyFn"
          :row-props="mergedRowProps"
          :checked-keys="hostCheckedKeys() ?? localChecked"
          :expanded-keys="hostExpandedKeys()"
          :loading="isRemote && loading"
          @check="onCardCheck"
        >
          <template v-if="slots.empty" #empty><slot name="empty" /></template>
        </CardList>
        <n-config-provider abstract :component-options="pagerOptions">
          <n-data-table
            :key="tableKey"
            ref="tableRef"
            :class="{ 'smart-table-table--cards': cardMode }"
            :remote="isRemote"
            :columns="columnsApi.naiveColumns.value"
            :data="tableData"
            :loading="isRemote ? loading : false"
            :row-key="rowKeyFn"
            :pagination="mergedPagination"
            :size="tableSize"
            :scroll-x="autoScrollX"
            :single-line="false"
            v-bind="tableAttrs"
            :row-props="mergedRowProps"
            :table-layout="mergedTableLayout"
            :on-unstable-column-resize="onColumnResize"
            @update:sorter="onSorterChange"
          >
            <template v-if="slots.empty" #empty><slot name="empty" /></template>
          </n-data-table>
        </n-config-provider>
        <!-- 已生效条件 chips:分页会画出来时在分页同一行(渲染进 pagination.prefix,见 paginationPrefix);否则在表格下方自画一行 -->
        <div v-if="!chipsInPager && shownChips.length" class="smart-table-chips-foot">
          <FilterChips key="chips" v-bind="chipsBind" />
        </div>
        <!-- 拖动列宽时贯穿整张表(表头 + 表体)的引导线,落在被拖列的右缘;松手即消失 -->
        <div
          v-if="resizeGuide"
          class="smart-table-resize-guide"
          aria-hidden="true"
          :style="{
            left: `${resizeGuide.left}px`,
            top: `${resizeGuide.top}px`,
            height: `${resizeGuide.height}px`,
            background: `color-mix(in srgb, ${themeVars.primaryColor} 55%, transparent)`,
          }"
        />
      </n-card>
      <!-- 可编辑表格的窄档抽屉表单(点卡片打开;自己 Teleport 到 body) -->
      <EditableSheet
        v-if="editor.form.value"
        :form="editor.form.value"
        :fields="editor.sheetFields.value"
        :label-width="editor.sheetLabelWidth.value"
        :labels="mergedLabels"
        @set="editor.formSet"
        @pick="editor.formPick"
        @save="editor.formSave"
        @close="editor.closeForm"
      />
    </MaximizeLayer>
  </div>
</template>

<style scoped>
.smart-table {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
/* 放大层(toolbar.maximize):未放大时它就在根元素里,display: contents 让它对布局透明(根的 flex 列 / gap / fillHeight 链原样生效);
   放大后被 Teleport 到 body,自己 fixed 铺满视口(层级与底色由内联样式给)。层上同样带 .smart-table 与状态类,
   所以下面所有 `.smart-table :deep(...)` 规则在 body 下的放大层里一样命中。 */
.smart-table-layer {
  display: contents;
}
.smart-table-layer--maximized {
  display: flex;
  position: fixed;
  inset: 0;
  box-sizing: border-box;
  padding: 16px;
  height: 100%;
  min-height: 0;
}
/* 列宽拖拽把手(规格 §5.6、设计 3.11):沿用官方结构(.n-data-table-resize-button),只改位置与显隐。
   Naive 默认把它放偏了:命中区 right 是 container-size/2,可见竖线在命中区内又 left 了 container-size/2,
   那根线落在列界左侧 8px 处,且只有半格高;静止时还画一条表格线色的细线(暗色下每个列界都冒出一截灰条)。
   这里:热区 11px、以 th 的 border-right 为中心骑在列界线上(两侧各出约 5px,伸进右邻列的那半边也点得到);
   竖条 3px 居中压在线上、高度 = 表头整行(top: 0 + bottom: -1px 盖住 th 的下边线);静止不画,悬停 / 拖动才显示主色。
   z-index: 1:高于相邻的非固定 th(官方 th 是 position: relative / z-index: auto,不构成层叠上下文,所以非固定列不用递减 z-index),
   低于固定列的 th(fixed-left 2 / fixed-right 1 且在 DOM 里更靠后 / selection 3)——非固定列的把手滑到固定列底下时不会盖到固定列表头上;
   紧挨着固定列的非固定列,右半边被固定列盖住点不到,左半边仍可拖。th 本身没有 overflow 规则,不需要改成 visible。 */
.smart-table :deep(.n-data-table-resize-button) {
  right: -6px;
  width: 11px;
  z-index: 1;
  touch-action: none;
}
.smart-table :deep(.n-data-table-resize-button::after) {
  top: 0;
  bottom: -1px;
  left: 4px;
  right: auto;
  width: 3px;
  height: auto;
  transform: none;
  border-radius: 0;
  background-color: transparent;
  transition:
    background-color 0.15s,
    box-shadow 0.15s;
}
.smart-table :deep(.n-data-table-resize-button:hover::after),
.smart-table :deep(.n-data-table-resize-button--active::after) {
  background-color: var(--n-th-icon-color-active);
}
/* 拖动中再加一圈柔和光晕 */
.smart-table :deep(.n-data-table-resize-button--active::after) {
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--n-th-icon-color-active) 18%, transparent);
}
/* 相邻的固定列:两个 sticky th 的 z-index 相同(fixed-left 都是 2)、后者在 DOM 里更靠后,会盖住前者伸进来的那半个把手(实测:
   allfixed 的 A 列 R+3 命中的是 B 列 th)。让靠前的固定列 th 依次更高 —— 这就是「递减 z-index」,只落在固定列上、且只处理开头 6 列
   (更靠后的相邻固定列仍只能拖左半边);非固定 th 不是层叠上下文,不需要。数值都在表头容器(z-index: 3 的层叠上下文)里,不会漏到外面。 */
.smart-table :deep(.n-data-table-th--fixed-left:nth-child(1)) {
  z-index: 8;
}
.smart-table :deep(.n-data-table-th--fixed-left:nth-child(2)) {
  z-index: 7;
}
.smart-table :deep(.n-data-table-th--fixed-left:nth-child(3)) {
  z-index: 6;
}
.smart-table :deep(.n-data-table-th--fixed-left:nth-child(4)) {
  z-index: 5;
}
.smart-table :deep(.n-data-table-th--fixed-left:nth-child(5)) {
  z-index: 4;
}
.smart-table :deep(.n-data-table-th--fixed-left:nth-child(6)) {
  z-index: 3;
}
/* 触屏(没有悬停):热区加宽到 24px,竖条仍居中压在线上。官方把手只监听鼠标事件,手指拖动由上面的 onLayerTouchstart 转成合成鼠标事件。 */
@media (hover: none) {
  .smart-table :deep(.n-data-table-resize-button) {
    right: -12px;
    width: 24px;
  }
  .smart-table :deep(.n-data-table-resize-button::after) {
    left: 10px;
  }
}
/* 引导线:相对卡片内容区定位(位置由 JS 按被拖列的右缘算),不拦鼠标事件 */
.smart-table-card :deep(.n-card-content) {
  position: relative;
}
.smart-table-resize-guide {
  position: absolute;
  width: 1px;
  z-index: 5;
  pointer-events: none;
}
/* 表头「标题 + 漏斗」容器:在 Naive 内层 th 里渲染,所以要 :deep 才打得进去。 */
.smart-table :deep(.smart-table-th) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  max-width: 100%;
}
/* 过滤列的标题文字单行、放不下省略(设计原型 .th-title),漏斗不被裁:
   列被拖到下限时,「物料编码」这类 4 字标题只剩 48px,折成两行会把表头从 39.4 撑到 61.8px、图标也被挤歪。
   下限保证的是图标簇放得下,标题让位(省略)。标题文字单独包了一层(useColumns),省略号只作用在文字上,不会连漏斗一起裁掉。 */
.smart-table :deep(.smart-table-th-text) {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* 表头图标「悬停才显示」:未激活的排序箭头与漏斗平时透明(仍占位,不回流),悬停该列表头或
   键盘聚焦到表头内时淡入。官方类名已在真实 NDataTable 上核对(设计文档 9.1)。
   常驻例外:正在排序的列箭头、已筛选的列漏斗、面板打开的那一列漏斗。
   注意:所有例外规则都要带 .n-data-table-th 前缀,与隐藏规则同级(0,4,0)并写在其后,否则压不过。 */
.smart-table :deep(.n-data-table-th .n-data-table-sorter) {
  opacity: 0;
  /* 官方给排序箭头写的是 transition: color .3s var(--n-bezier)(箭头变主色时用),
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
/* 触屏兜底:没有悬停(主输入设备是触屏,如平板)。写法与设计原型一致,只写 `(hover: none)`:
   不加 `any-pointer: coarse` —— 带触屏的 Windows 笔记本它也为 true,用鼠标时图标会常显,与原型「悬停才显示」不符。
   未激活的图标淡显常驻(仍低于激活态的主色)。列宽把手在触屏下的 24px 热区见上面「触屏(没有悬停)」那块。 */
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
/* 图标间距(设计 3.11;列宽拖拽下限 93 / 102 / 123 就是按这个布局算的):
   标题 → 漏斗 8px(漏斗的 margin-left,在 ColumnFilter 里)、漏斗 → 排序箭头 6px(官方默认是 4px)、
   表头右内边距 16px(= 8px 把手 + 8px 缓冲)。 */
/* 选择 / 展开列的 th 是官方的 padding: 0 + 居中(index.cssr 的 th--selection / th--expand),不能带这 16px:
   否则全选复选框比表体行的复选框偏左 8px。 */
.smart-table
  :deep(.n-data-table-th:not(.n-data-table-th--selection):not(.n-data-table-th--expand)) {
  padding-right: 16px;
}
.smart-table :deep(.n-data-table-th .n-data-table-sorter) {
  margin-left: 6px;
}
/* 图标簇紧跟标题:官方 title-wrapper 是 flex、title 是 flex:1 —— 标题居中时 title 块被撑满整格,排序箭头被挤到格子最右,
   和标题 / 漏斗之间空出一大块(默认列宽下漏斗 → 箭头实测 20px 以上,而不是 6px)。这里的做法:wrapper 按内容收缩(inline-flex,
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
/* 列上写了 ellipsis 且可排序时,官方给省略号盒子写了 max-width: calc(100% - 18px)(给排序箭头留位)。title 按内容收缩,
   再扣 18px 会把「标题 + 漏斗」裁掉 18px(实测:漏斗被切掉);排序箭头本来就是 flex 兄弟、不会压到标题,所以还原成 100%。
   优先级:官方 (0,4,0),这里 (0,5,0)。 */
.smart-table :deep(.n-data-table-th.n-data-table-th--sortable .n-data-table-th__ellipsis) {
  max-width: 100%;
}
/* activeRowKey 命中行高亮:色走 --smart-table-active-row-bg(宿主 / 全局 activeRowBg 覆盖),没给时取 -auto(主题主色 9%,rootStyle 按亮 / 暗主题写入)。
   叠在 background-image 上、不碰 background-color:官方固定列的 td 是 position: sticky + 不透明的 --n-merged-td-color,靠这层不透明底遮住横向滚过的内容;
   半透明的 background-color 会把它整个换掉,固定列就会透出下面的列。叠加层保留官方的底(含 hover / 斑马纹 / 排序列底色),明暗主题各自的底色都不丢。
   :deep 打进内层 n-data-table 的 td —— 包内处理,消费端不必自己写 :deep。 */
.smart-table :deep(.smart-table-row--active > td) {
  background-image: linear-gradient(
    var(--smart-table-active-row-bg, var(--smart-table-active-row-bg-auto)),
    var(--smart-table-active-row-bg, var(--smart-table-active-row-bg-auto))
  );
}
/* 行拖拽(useRowDrag,sortablejs fallback 模式):拖影 = 行的克隆,留在 tbody / 卡片列表里(所以 --n-* 变量仍可用),
   position: fixed、只纵向移动、被夹在表体内(rowDragConfine.ts)。
   手感对照设计原型 .rd-chosen:被拖行抬起(阴影 + 不透明的主题悬停底),落点处留一行淡主色底的占位。
   sortablejs 给拖影写了内联 opacity: 0.8,这里用 !important 压成不透明:半透明会透出下面滑动的邻行。
   单元格不能再有 position: sticky(固定列):拖影是 fixed 的块,sticky 的 left 偏移会把固定列的格子挪走。 */
.smart-table :deep(.smart-table-drag-ghost) {
  opacity: 1 !important;
  box-shadow: var(--smart-table-drag-shadow);
  cursor: grabbing;
}
.smart-table :deep(tr.smart-table-drag-ghost > td) {
  position: static !important;
  background-color: var(--n-merged-td-color-hover) !important;
}
.smart-table :deep(.smart-table-card-item.smart-table-drag-ghost) {
  background-color: var(--st-card-bg);
  border-radius: 3px;
}
.smart-table :deep(.smart-table-drag-placeholder) {
  opacity: 0.55;
}
.smart-table :deep(tr.smart-table-drag-placeholder > td),
.smart-table :deep(.smart-table-card-item.smart-table-drag-placeholder) {
  background-image: linear-gradient(var(--smart-table-drag-tint), var(--smart-table-drag-tint));
}
/* 已生效条件 chips 的落点(表格下方、与分页同一行)。
   A. 分页会画出来(chips 渲染进 pagination.prefix,根上带 smart-table--chips-pager):NDataTable 的分页容器是 flex(justify-content: flex-end),
      让 NPagination 占满整行、prefix 吃掉页码左边的全部剩余宽度(chips 靠左,页码被挤到最右);没有 chip 时 prefix 是空的,justify-content: flex-end 保证页码仍靠右。
      prefix 自己的 8px 右外边距让给 gap(12px,chips 与宿主 pagination-prefix 之间),宿主 prefix 外包一层并保留官方的 prefix 外边距。
      选择器都带 `>` 限定直接子级:每页条数选择器是 suffix 里再嵌的一个 NPagination,不能被这里的规则命中。
      窄档(smart-table--chips-wrap):分页行允许折行、prefix 退成 contents,chips(FilterChips 的 --wrap 占满一整行)在页码上方,行距 8px(原型窄档 .dt-foot 的 gap)。
   B. 分页不画(pagination: false / 只有 1 页):chips 在表格下方自己一行,与表格间距 12px(= 官方 paginationMargin)。 */
.smart-table--chips-pager :deep(.n-data-table__pagination > .n-pagination) {
  flex: 1 1 auto;
  min-width: 0;
  justify-content: flex-end;
}
.smart-table--chips-pager :deep(.n-data-table__pagination > .n-pagination > .n-pagination-prefix) {
  flex: 1 1 0;
  min-width: 0;
  margin: 0;
  gap: 12px;
}
.smart-table--chips-pager :deep(.n-pagination-prefix > .smart-table-pager-host-prefix) {
  flex: none;
  display: flex;
  align-items: center;
  margin: var(--n-prefix-margin);
  margin-left: auto; /* 没有 chip 时 prefix 里只剩它:仍紧贴页码(靠右),不跑到行首 */
}
/* 窄档卡片模式没有 chips 时同样:宿主的 pagination-prefix(「共 N 条」)靠左、页码靠右(原型 .dt-foot) */
.smart-table--cards:not(.smart-table--chips-pager)
  :deep(.n-data-table__pagination > .n-pagination) {
  flex: 1 1 auto;
  min-width: 0;
  justify-content: flex-end;
}
.smart-table--cards:not(.smart-table--chips-pager)
  :deep(.n-data-table__pagination > .n-pagination > .n-pagination-prefix) {
  flex: 1 1 0;
  min-width: 0;
  margin: 0;
}
.smart-table--chips-wrap :deep(.n-data-table__pagination > .n-pagination) {
  flex-wrap: wrap;
  row-gap: 8px;
}
.smart-table--chips-wrap :deep(.n-data-table__pagination > .n-pagination > .n-pagination-prefix) {
  display: contents;
}
.smart-table-chips-foot {
  display: flex;
  flex: none;
  align-items: center;
  margin-top: 12px;
}
/* fillHeight:根 → 卡片 → 卡片内容区 逐层 flex 列 + flex:1 1 auto + min-height:0;表格自己的 flex 由 fillProps.style 给。
   父容器必须有确定高度(docs / CHANGELOG 写明)。 */
.smart-table--fill {
  height: 100%;
  min-height: 0;
}
/* fillHeight + 空数据:库恒传 scroll-x,官方在「横向可滚动」时把 empty 融进 table 节点并贴顶(Body.mjs 的 height: initial);
   这两条让 empty 撑满表体、在表体里垂直居中,与官方「不滚动」时的默认行为一致。非 fill 表的 100% 解析为 auto,不受影响。 */
.smart-table--fill :deep(.n-data-table-base-table-body .n-scrollbar-content),
.smart-table--fill :deep(.n-data-table-base-table-body .n-data-table-empty) {
  height: 100%;
}
.smart-table--fill > .smart-table-card {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.smart-table--fill .smart-table-card :deep(.n-card-content) {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
/* 窄档卡片模式(cardOnNarrow):NDataTable 只留分页——表体(表头 + 行)藏起来,加载转圈也不画(卡片列表自己淡出表示加载中)。
   卡片列表与表体之间的间距 = 官方 paginationMargin(12px,由分页自己的 margin-top 给)。
   fillHeight / 放大态:撑满父容器的是卡片列表,在卡片里自己滚(原型 .smart-table > .n-card > .dt > .tbl-cards)。 */
.smart-table-table--cards :deep(.n-data-table-wrapper),
.smart-table-table--cards :deep(.n-spin-body) {
  display: none;
}
.smart-table--fill.smart-table--cards .smart-table-card :deep(.smart-table-cards) {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
}
</style>

<style>
/* 列宽拖动中(SmartTable 在拖动开始 / 结束时给 body 加 / 去 smart-table-resizing):鼠标离开把手后光标仍是 col-resize、不选中文字。
   放在非 scoped 块里:body 不在组件内。 */
body.smart-table-resizing,
body.smart-table-resizing * {
  cursor: col-resize !important;
  user-select: none !important;
}
/* 行拖拽中(useRowDrag 在起拖 / 结束时给 body 加 / 去 smart-table-row-dragging):光标一律 grabbing(手柄自己的 grab 也压掉)、不选中文字 */
body.smart-table-row-dragging,
body.smart-table-row-dragging * {
  cursor: grabbing !important;
  user-select: none !important;
}
</style>
