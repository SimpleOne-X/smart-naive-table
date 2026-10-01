import type { Ref, VNodeChild, MaybeRefOrGetter } from 'vue'
import type { CardProps, DataTableBaseColumn, DataTableInst, DropdownProps, PaginationProps } from 'naive-ui'
// naive-ui 只出现在类型位置;运行时 hooks(useSmartTable/useTableCrud/useOptions)不 import 它。

/* ======================== 数据契约 ======================== */

/** 分页结果。任何后端在 fetcher 内适配成这个形状。 */
export interface PageResult<T> {
  items: T[]
  total: number
}

/**
 * 每次请求的参数:page/pageSize + 清洗后的搜索参数 + 外部附加参数。
 * 值类型用 any 而非 unknown —— strict 下 unknown 会让窄签名的 api 函数
 * (如 `(p: {page:number; account?:string}) => ...`)因参数逆变无法直接赋给 fetcher。
 */
export type SmartTableParams = { page: number; pageSize: number } & Record<string, any>

/** 请求适配器 —— 包的唯一后端契约,入/出参不同就在这一层映射。 */
export type SmartTableFetcher<T> = (params: SmartTableParams) => Promise<PageResult<T>>

/* ======================== 字典 / 选项 ======================== */

export type TagType = 'default' | 'primary' | 'info' | 'success' | 'warning' | 'error'

export interface SmartTableOption {
  /** 函数形式在渲染期求值 —— 宿主 () => t('...') 切换语言即时生效。 */
  label: string | (() => string)
  value: string | number | boolean | null
  /** 列开启 tag:true 时,该项渲染成对应 type 的 NTag。 */
  tagType?: TagType
  /** 仅影响搜索 select,不影响单元格翻译。 */
  disabled?: boolean
  /** 树形选项(透传搜索控件;单元格翻译按扁平化查找)。 */
  children?: SmartTableOption[]
}

/** 选项来源:静态数组 / 响应式 ref / 异步函数(内置 loading 与在途去重)。 */
export type OptionsSource =
  | SmartTableOption[]
  | Ref<SmartTableOption[]>
  | (() => Promise<SmartTableOption[]>)

/* ======================== 声明式格式化 ======================== */

/**
 * date → 'YYYY-MM-DD';datetime → 'YYYY-MM-DD HH:mm:ss'(接受 ISO 串/时间戳/Date);
 * money → 千分位保留两位;函数形式完全自定义。render 优先于 format。
 */
export type CellFormat<T = any> = 'date' | 'datetime' | 'money' | ((value: unknown, row: T) => string)

/* ======================== 搜索 ======================== */

export type SearchFieldType = 'input' | 'number' | 'select' | 'date' | 'daterange' | 'switch'

/** 自定义搜索控件的渲染上下文。 */
export interface SearchRenderCtx {
  value: unknown
  setValue: (v: unknown) => void
  /** 整个搜索参数对象(reactive),字段联动用。 */
  params: Record<string, any>
  /** 触发查询(自定义控件回车等场景)。 */
  search: () => void
}

export interface SearchConfig {
  /** 控件类型;缺省:列有 options → 'select',否则 'input'。 */
  type?: SearchFieldType
  /** 参数名,默认列 key(搜索键与展示字段不同时覆盖)。 */
  key?: string
  /** 表单 label;缺省取列 title(函数同样透传,保证语言切换生效)。 */
  label?: string | (() => string)
  /** 缺省交给 Naive locale 的默认占位。 */
  placeholder?: string
  /** 初始值 = reset 恢复目标;缺省视为 null。 */
  defaultValue?: unknown
  /** 排序,小的在前;缺省按列声明顺序。 */
  order?: number
  /** 占据 n-grid 的列数,默认 1。 */
  span?: number
  /** 透传对应 Naive 控件(NInput/NInputNumber/NSelect/NDatePicker/NSwitch)。 */
  props?: Record<string, unknown>
  /** 自定义控件,优先于 type。 */
  render?: (ctx: SearchRenderCtx) => VNodeChild
}

/* ======================== 过滤 ======================== */

/** 条件动作(对齐 Bootstrap Blazor 的 FilterAction)。isNull / isNotNull 不需要值;in / notIn 的值是数组。 */
export type FilterAction =
  | 'equal'
  | 'notEqual'
  | 'contains'
  | 'notContains'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'isNull'
  | 'isNotNull'
  | 'like'
  | 'startsWith'
  | 'endsWith'
  | 'in'
  | 'notIn'

/** 同一列内多个条件的连接方式。 */
export type FilterLogic = 'and' | 'or'

export interface FilterCondition {
  action: FilterAction
  /** 值为空(null/''/[])的条件不参与求值。 */
  value: unknown
}

/**
 * 一列的过滤值;conditions 全空即未过滤。
 * 内置面板只产出单条条件(condition 模式)或若干 equal 取「或」(options 模式),
 * 但求值与序列化支持任意条数 —— 编程式 setFilter / defaultValue 可以给多条。
 */
export interface FilterValue {
  logic: FilterLogic
  conditions: FilterCondition[]
}

/** 全表过滤态:过滤键(filter.key ?? 列 key)→ 过滤值。 */
export type FilterState = Record<string, FilterValue>

/**
 * 'options' —— Arco 风格,勾选候选项(内部等价于若干 equal 条件取「或」);
 * 'condition' —— Blazor 风格,一行 [动作 + 值]。
 */
export type FilterMode = 'options' | 'condition'

/** condition 模式下值控件的类型。 */
export type FilterFieldType = 'input' | 'number' | 'select' | 'date'

/** 自定义过滤面板的渲染上下文。 */
export interface FilterRenderCtx {
  /** 当前生效值(未过滤为 null)。 */
  value: FilterValue | null
  /** 提交;传 null 即清除该列过滤。 */
  setValue: (v: FilterValue | null) => void
  /** 关闭弹层。 */
  close: () => void
}

export interface FilterConfig<T = any> {
  /** 缺省:列或 filter 上有 options → 'options',否则 'condition'。 */
  mode?: FilterMode
  /** 过滤参数名 / 过滤态的键,默认列 key。 */
  key?: string
  /** options 模式的候选项;缺省复用列上的 options 字典。 */
  options?: OptionsSource
  /** options 模式是否多选,默认 true。 */
  multiple?: boolean
  /** condition 模式的值控件;缺省由列 format 推断(date/datetime → date,money → number)。 */
  type?: FilterFieldType
  /** condition 模式可选的动作;缺省按 type 给一组合理默认。 */
  actions?: FilterAction[]
  /** 初始过滤值,也是面板里「重置」恢复的目标。 */
  defaultValue?: FilterValue | null
  /** 透传 condition 模式的值控件 / options 模式的 NSelect 风格控件。 */
  props?: Record<string, unknown>
  /** 自定义整个过滤面板,优先于 mode。 */
  render?: (ctx: FilterRenderCtx) => VNodeChild
  /** 静态 data 模式下自定义匹配;缺省用内置条件求值。远程模式无效。 */
  filter?: (value: FilterValue, row: T) => boolean
}

/* ======================== 列 ======================== */

/**
 * 数据列。除 pro 字段外,其余 Naive 列属性(width/minWidth/fixed/align/
 * ellipsis/sorter...)原样透传给 n-data-table。
 */
export interface SmartTableDataColumn<T = any>
  // 'filter' 被本包接管(FilterConfig,比 Naive 原生列过滤多条件行与远程联动),
  // 因此不从 Naive 列继承同名属性。
  extends Partial<Omit<DataTableBaseColumn<T>, 'key' | 'title' | 'render' | 'children' | 'filter'>> {
  /** 数据字段名;同时是搜索参数默认键、列设置持久化 id、动态插槽名。 */
  key: string
  /** 函数形式在表格渲染期求值 —— 切换语言自动生效。 */
  title?: string | (() => VNodeChild)
  /** 自定义单元格,优先级最高。 */
  render?: (row: T, rowIndex: number) => VNodeChild
  /** 声明式格式化(render/插槽未命中时生效)。 */
  format?: CellFormat<T>
  /** 字典:单元格翻译 + 搜索 select 选项,一处声明两处用。 */
  options?: OptionsSource
  /** 值经 options 翻译后渲染为 NTag(取命中项 tagType,默认 'default')。 */
  tag?: boolean
  /** 初始隐藏,列设置里可勾回。 */
  hide?: boolean
  /** 只作搜索项,不进表格也不进列设置。 */
  hideInTable?: boolean
  /** 在表格显示,但不出现在列设置面板(典型:操作列)。 */
  hideInSetting?: boolean
  /** 搜索项配置;true = 全默认(input / 有 options 则 select)。 */
  search?: boolean | SearchConfig
  /** 表头过滤;true = 全默认(有 options 则勾选列表,否则条件行)。 */
  filter?: boolean | FilterConfig<T>
  /** 多级表头(Naive 原生名,子列同样支持 pro 字段)。 */
  children?: SmartTableDataColumn<T>[]
}

/** 特殊列:勾选 / 展开 / 序号。显式 type,不进搜索/列设置/持久化。 */
export interface SmartTableSpecialColumn<T = any> {
  type: 'selection' | 'expand' | 'index'
  width?: number
  fixed?: 'left' | 'right'
  /** index 列表头,默认 '#'。 */
  title?: string | (() => VNodeChild)
  /** type='expand' 的展开内容。 */
  renderExpand?: (row: T, rowIndex: number) => VNodeChild
  /** 其余 Naive 同名属性透传(如 selection 的 multiple)。 */
  [key: string]: unknown
}

/** 判别方式:有 type 字段即特殊列。 */
export type SmartTableColumn<T = any> = SmartTableDataColumn<T> | SmartTableSpecialColumn<T>

/* ======================== 组件 Props ======================== */

export type Density = 'comfortable' | 'compact'

/** 一列的排序态;多列时数组顺序 = 优先级(高 → 低,即列声明的 sorter.multiple 从大到小)。 */
export interface SortItem {
  field: string
  order: 'ascend' | 'descend'
}

export interface SearchFormConfig {
  /** 布局:'grid'(默认,独立卡片 + n-grid)| 'inline'(无卡片,单行自动换行,适配窄栏)。 */
  layout?: 'grid' | 'inline'
  /** n-grid 的 cols(responsive="screen"),默认取全局 searchCols('1 s:2 m:3 l:4');inline 模式忽略。 */
  cols?: number | string
  labelPlacement?: 'left' | 'top'
  labelWidth?: number | string
  /** 搜索项多时折叠(默认展开首行 + "展开/收起");仅 grid 布局。默认 false。 */
  collapsible?: boolean
  /** 折叠时保留的行数,默认 1。 */
  collapsedRows?: number
}

/** 「更多」菜单的选项:官方 NDropdown 的 options 原样透传(文档只保证 label / key / disabled 与 { type: 'divider' })。 */
export type ToolbarMoreOption = NonNullable<DropdownProps['options']>[number]

export interface ToolbarConfig {
  refresh?: boolean // 默认 true;静态数据模式(没传 fetcher)一律不显示
  /** 是否显示「密度」按钮;默认 false(3.0 起密度交给宿主的个人设置经 defaultDensity 传入)。传 true 时存储里的密度优先。 */
  density?: boolean
  columnSettings?: boolean // 默认 true
  /** 「更多」菜单(导出 / 导入 / …由宿主定义);不传、空数组或只有分隔线时不显示按钮。选中后发 moreSelect。 */
  more?: ToolbarMoreOption[]
}

export interface SmartTableProps<T = any> {
  columns: SmartTableColumn<T>[]
  /** 远程模式;与 data 二选一,同给时 fetcher 优先。 */
  fetcher?: SmartTableFetcher<T>
  /** 静态模式:客户端分页,不发请求。 */
  data?: T[]
  /** 字段名或函数,默认 'id'。 */
  rowKey?: string | ((row: T) => string | number)
  /** 外部附加参数(树筛选联动):深监听 → 回第 1 页重查;合并优先级最高。 */
  params?: Record<string, any>
  /** 挂载即请求,默认 true。 */
  immediate?: boolean
  defaultPageSize?: number // 默认取宿主给的 pageSizes[0],再缺省 100(解析优先级见 pageSize.ts)
  /**
   * false 隐藏分页;对象与内置默认合并后透传 n-data-table 分页。
   * 3.0 起默认官方 simple(输入框 / 总页数),每页条数选择器由库用官方嵌套 NPagination 画;传 { simple: false } 回到页码序列。
   */
  pagination?: false | Partial<PaginationProps>
  /** false 隐藏搜索表单(即使列声明了 search)。 */
  search?: false | SearchFormConfig
  /** false 关掉全部表头过滤(即使列声明了 filter);缺省跟随全局 filterable。 */
  filter?: boolean
  /** 在工具栏下方显示「已生效条件」chips(点击重开该列面板、× 删一条、行末清除 / 恢复默认);默认 false。 */
  filterChips?: boolean
  /** false 隐藏右侧工具按钮。 */
  toolbar?: false | ToolbarConfig
  /** 表格卡片标题(也可用 #title 插槽)。 */
  title?: string
  /** 库渲染的所有卡片(表格卡片、模式 1 的搜索卡片)的官方 NCard 属性,合并在库默认 size="small" + 16px 内边距覆盖之后。回退 2.1.1 外观:{ size: 'medium' }。 */
  cardProps?: Partial<CardProps>
  /** 列设置 + 密度的 localStorage 持久化键;缺省不持久化。 */
  storageKey?: string
  defaultDensity?: Density // 默认 'compact';响应式(没有密度按钮时它就是当前值)
  /** 部分覆盖英文默认文案;传 computed 对象即随 locale 响应。 */
  labels?: Partial<SmartTableLabels>
  /** 命中行加 .smart-table-row--active 高亮(用 rowKey 比对);配合 @row-click 做主从选中。 */
  activeRowKey?: string | number | null
  /** 所有数据列可拖拽调整列宽;列上写 resizable 可单独覆盖。配合 storageKey 记住宽度。 */
  resizable?: boolean
  /** 过滤态 → 请求参数的序列化;缺省产出 `{ filters: [{ field, logic, conditions }] }`。 */
  filterSerializer?: (state: FilterState) => Record<string, any>
}

/* ======================== 实例(模板 ref) ======================== */

export interface SmartTableInst<T = any> {
  /** 保持当前页与参数重查。 */
  refresh: () => Promise<void>
  /** 回第 1 页查询。 */
  search: () => Promise<void>
  /** 重置搜索项(defaultValue ?? null)并查询。 */
  reset: () => Promise<void>
  loading: Ref<boolean>
  rows: Ref<T[]>
  /** 响应式搜索参数(可编程读写)。 */
  params: Record<string, any>
  pagination: { page: number; pageSize: number; itemCount: number }
  /** 重新加载异步字典;缺省全部,传列 key 只刷一个。 */
  reloadOptions: (key?: string) => Promise<void>
  /** 当前过滤态(只读快照,改动请用 setFilter)。 */
  filters: Ref<FilterState>
  /** 编程式设置某列过滤;传 null 清除该列。远程模式会回第 1 页重查。 */
  setFilter: (key: string, value: FilterValue | null) => void
  /** 清空全部过滤(恢复各列 defaultValue)。 */
  clearFilters: () => void
  /**
   * 设置某列排序(对齐官方 DataTableInst.sort:order 缺省 'ascend';columnKey 为空 = clearSorter();
   * 没有 sorter 的列是空操作)。远程模式回第 1 页重查,并向宿主的 onUpdate:sorter 转发一次(载荷形状与官方一致)。
   */
  sort: (columnKey?: string | null, order?: 'ascend' | 'descend' | false) => void
  /** 清空全部排序;向宿主的 onUpdate:sorter 转发 null(与官方一致)。 */
  clearSorter: () => void
  /** 当前各列被拖拽后的宽度(未拖过的列不在表里)。 */
  columnWidths: Ref<Record<string, number>>
  /** Naive 原生实例(scrollTo / sort 等)。 */
  tableRef: Ref<DataTableInst | null>
}

/* ======================== useSmartTable ======================== */

export interface UseSmartTableOptions {
  /** 搜索参数初值,也是 reset 的恢复目标。 */
  initParams?: Record<string, any>
  /** 每次请求追加的外部参数(getter/ref,请求时求值)。 */
  extraParams?: MaybeRefOrGetter<Record<string, any>>
  immediate?: boolean // 默认 true
  defaultPageSize?: number // 默认 10
  onError?: (e: unknown) => void
}

export interface UseSmartTableReturn<T> {
  loading: Ref<boolean>
  rows: Ref<T[]>
  /** reactive 搜索参数。 */
  params: Record<string, any>
  /** reactive 分页(字段名对齐 Naive:itemCount)。 */
  pagination: { page: number; pageSize: number; itemCount: number }
  /** 按当前 page/params 请求。 */
  load: () => Promise<void>
  /** load 的语义化别名。 */
  refresh: () => Promise<void>
  /** page=1 + load。 */
  search: () => Promise<void>
  /** params 恢复 initParams,其余键置 null(绝不 delete),page=1 + load。 */
  reset: () => Promise<void>
  onPage: (p: number) => Promise<void>
  onPageSize: (s: number) => Promise<void>
}

/* ======================== useTableCrud ======================== */

export interface UseTableCrudOptions<Row, Form> {
  /** 新建时的空表单工厂。 */
  form: () => Form
  /** 编辑时行 → 表单;缺省浅拷贝行上与空表单同名的字段。 */
  toForm?: (row: Row) => Form
  create: (form: Form) => Promise<unknown>
  update: (form: Form, row: Row) => Promise<unknown>
  remove?: (row: Row) => Promise<unknown>
  /** 增删改成功后回调,通常 () => tableRef.value?.refresh()。 */
  onSuccess?: () => void
  onError?: (e: unknown) => void
}

export interface UseTableCrudReturn<Row, Form> {
  visible: Ref<boolean>
  mode: Ref<'create' | 'edit'>
  /** 表单模型,直接给 n-form。 */
  model: Ref<Form>
  editingRow: Ref<Row | null>
  submitting: Ref<boolean>
  openCreate: () => void
  openEdit: (row: Row) => void
  /** 成功返回 true 并自动关窗 + onSuccess;失败返回 false(已回调 onError,窗口保持)。 */
  submit: () => Promise<boolean>
  removeRow: (row: Row) => Promise<boolean>
  close: () => void
}

/* ======================== 文案 ======================== */

/** 组件自身 chrome 文案;列标题/选项 label 走函数形式,不在此列。 */
export interface SmartTableLabels {
  search: string
  reset: string
  refresh: string
  density: string
  densityComfortable: string
  densityCompact: string
  columnSettings: string
  columnSettingsReset: string
  fixedLeft: string
  fixedRight: string
  fixedNone: string
  /** 搜索折叠:展开 / 收起。 */
  expand: string
  collapse: string
  /* ---- 表头过滤 ---- */
  filter: string
  filterConfirm: string
  filterReset: string
  filterSelectAll: string
  /** 条件动作文案。 */
  filterEqual: string
  filterNotEqual: string
  filterContains: string
  filterNotContains: string
  filterGt: string
  filterGte: string
  filterLt: string
  filterLte: string
  /* ---- 3.0 新增的键一律可选:2.1.1 宿主写的完整 labels 对象不会因此报类型错误;
         缺省取英文默认(defaultLabels),中文宿主整包用 zhCNLabels ---- */
  filterIsNull?: string
  filterIsNotNull?: string
  filterLike?: string
  filterStartsWith?: string
  filterEndsWith?: string
  filterIn?: string
  filterNotIn?: string
  /** 无值算子的值位置占位。 */
  filterNoValue?: string
  /** 工具栏「更多」菜单按钮文字。 */
  more?: string
  /** 漏斗 aria-label 的后缀,含 {n} 占位(有效条件数)。 */
  filterActiveCount?: string
  filterAddCondition?: string
  filterRemoveCondition?: string
  /** 同一列多条件的连接方式(「且 / 或」分段按钮)。 */
  filterLogicAnd?: string
  filterLogicOr?: string
  /** options 列底部展开多条件编辑的入口 / 收起回勾选列表的入口。 */
  filterAdvanced?: string
  filterSimple?: string
  /** chips 行末按钮(filterChips):没有列声明 defaultValue 时的文案。 */
  filterClearAll?: string
  /** chips 行末按钮(filterChips):有列声明生效的 defaultValue 时的文案。 */
  filterRestoreDefault?: string
}

/* ======================== 持久化存储结构 ======================== */

export interface StoredTableState {
  /** 结构版本;v1(无 widths)自动升级,更高/更低的未知版本整体丢弃回退声明态。 */
  v: 2
  density: Density
  /** 数组顺序即列顺序。 */
  cols: { key: string; show: boolean; fixed?: 'left' | 'right' }[]
  /** 列 key → 拖拽后的列宽(px);未拖过的列不在表里。 */
  widths: Record<string, number>
}
