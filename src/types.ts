import type { Ref, VNodeChild, MaybeRefOrGetter } from 'vue'
import type {
  CardProps,
  DataTableBaseColumn,
  DataTableInst,
  DropdownProps,
  PaginationProps,
} from 'naive-ui'
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
  SmartTableOption[] | Ref<SmartTableOption[]> | (() => Promise<SmartTableOption[]>)

/* ======================== 声明式格式化 ======================== */

/**
 * date → 'YYYY-MM-DD';datetime → 'YYYY-MM-DD HH:mm:ss'(接受 ISO 串/时间戳/Date);
 * money → 千分位保留两位;函数形式完全自定义。render 优先于 format。
 */
export type CellFormat<T = any> =
  'date' | 'datetime' | 'money' | ((value: unknown, row: T) => string)

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
  /** 自定义控件,优先于 type。模式 2(条件构造器)放不下自定义控件,带 render 的列不进构造器。 */
  render?: (ctx: SearchRenderCtx) => VNodeChild
  /** 仅模式 2(`search.container: 'table'`):该字段可选的比较符;缺省取 `filter.actions`,再缺省取按类型的推荐集合(规格 §5.9)。 */
  actions?: FilterAction[]
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
 * 窄档卡片里一列的去处(`cardOnNarrow` 开启、容器宽 < 600 时生效):
 * 'title' 卡片标题(缺省 = 第一个数据列)· 'meta' 「标签:值」两列(缺省)· 'action' 底部操作行(缺省 = 最后一个 fixed: 'right' 的列)·
 * 'handle' 拖拽手柄(`rowDraggable` 时放在标题行最左,手柄列自己渲染手柄元素)。写 false = 卡片里不出现这一列。
 */
export type SmartTableCardRole = 'title' | 'meta' | 'action' | 'handle'

/**
 * 数据列。除 pro 字段外,其余 Naive 列属性(width/minWidth/fixed/align/
 * ellipsis/sorter...)原样透传给 n-data-table。
 */
export interface SmartTableDataColumn<T = any>
  // 'filter' 被本包接管(FilterConfig,比 Naive 原生列过滤多条件行与远程联动),
  // 因此不从 Naive 列继承同名属性。
  extends Partial<
    Omit<DataTableBaseColumn<T>, 'key' | 'title' | 'render' | 'children' | 'filter'>
  > {
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
  /** 窄档卡片(`cardOnNarrow`)里这一列放哪;false = 卡片里不出现。缺省见 SmartTableCardRole。 */
  card?: SmartTableCardRole | false
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
  /**
   * 可编辑表格(`editable`)里这一列的编辑控件,优先级最高;`false` = 不可编辑。
   * 缺省按「列声明(options / format)→ 数据值 → 输入框」推断,见 `inferEditor`。
   */
  editor?: EditorKind | false
  /**
   * 可编辑表格里只读(纯展示、次要文字色):`true` = 整列不可编辑;函数 = 按行判断(如已审核的行锁定):锁定的格仍可选中 / 复制、但不能编辑,粘贴跳过;
   * 显式写 `false` = 这一列不受 `editable.rowReadonly` 影响(如「状态」列,否则被锁定的行永远没法再启用)。
   */
  readonly?: boolean | ((row: T, index: number) => boolean)
  /** 可编辑表格的校验规则;不合法时单元格红框 + 提示,不允许提交。 */
  rules?: EditRules<T>
  /**
   * 透传给编辑控件(NInput / NInputNumber / NSelect / NDatePicker)的官方属性,如 NInputNumber 的 precision;
   * `select-table`(显式或声明了 columns + data / fetcher 自动推断)时是 SelectTableProps。
   */
  editorProps?: Record<string, unknown>
  /** 多级表头(Naive 原生名,子列同样支持 pro 字段)。 */
  children?: SmartTableDataColumn<T>[]
}

/* ======================== 可编辑表格 ======================== */

/**
 * 独立的「下拉表格选择」组件 SmartSelectTable 的属性(也是编辑器 `select-table` 的 editorProps 的基础)。
 * 触发器像 NSelect;点开是浮层(窄屏 = 底部抽屉):搜索条 + 嵌套 SmartTable(分页)。单选点一行即选中并关闭;`multiple` 勾选 + 「确定」。
 */
export interface SmartSelectTableProps<R = any> {
  /** 面板里嵌套表格的列(SmartTable 的列配置)。 */
  columns: SmartTableColumn<R>[]
  /** 本地数据:搜索框实时过滤(见 searchKeys),前端分页。 */
  data?: R[]
  /** 远程数据:`fetcher({ page, pageSize, keyword })` → `{ items, total }`(SmartTableFetcher 的形状,多一个原样的 keyword);回车或停手 300ms 后请求。同给时 fetcher 优先。 */
  fetcher?: SmartTableFetcher<R>
  /** 行的唯一键字段,v-model:value 的值就是它;默认 'id'。 */
  valueKey?: string
  /** 触发器上显示的字段;默认第一列的 key。 */
  labelKey?: string
  /** 触发器文字的自定义:返回字符串(优先于 labelKey)。 */
  renderLabel?: (row: R) => string
  /**
   * 本地搜索的字段;缺省 = 面板里所有显示文字的列(有 key、不是 selection / index、没有自定义 render)。
   * 匹配:忽略大小写与全半角,空白切词、所有词都要命中(AND),每个词可命中任一字段;不做拼音。
   */
  searchKeys?: string[]
  /** 搜索框占位文字;缺省 = 搜索字段的列标题用 / 连接(如「物料编号/物料名称/物料规格」)。 */
  searchPlaceholder?: string
  /** v-model:value:单选 = valueKey 的值,多选 = 值的数组。 */
  value?: unknown
  /** 多选:v-model:value 是数组;面板里带勾选列,底部「已选 N 项 / 清空 / 确定」,跨页跨搜索保留。 */
  multiple?: boolean
  /** 多选时触发器最多显示几个标签,其余折成 +N;默认 2。 */
  maxTagCount?: number
  /** 有初始值但数据不在手边(远程)时,单选触发器显示的文字;缺省显示值本身。 */
  label?: string
  placeholder?: string
  /** 窄屏底部面板的标题(缺省不显示标题,只有关闭按钮)。 */
  title?: string
  clearable?: boolean
  disabled?: boolean
  size?: 'tiny' | 'small' | 'medium' | 'large'
  /** 面板宽度(px),受视口宽度限制;默认 640。 */
  panelWidth?: number
  /** 面板里每页行数;默认 100(与 SmartTable 非 fillHeight 的默认一致,远程 fetcher 的 pageSize 也是它)。 */
  pageSize?: number
  /** 每页条数可选项;不传 = 库内置([100, 1000, 10000],面板里的表格是 fillHeight 虚拟滚动)。 */
  pageSizes?: number[]
  /** 部分覆盖文案(同 SmartTable 的 labels)。 */
  labels?: Partial<SmartTableLabels>
}

/** SmartSelectTable 的内部用属性(嵌入可编辑表格 / 窄屏表单时用;宿主一般不需要)。 */
export interface SmartSelectTableEmbedProps {
  /** 无边框(嵌入单元格)。默认 true = 有边框。 */
  bordered?: boolean
  /** 挂载即打开面板。 */
  defaultOpen?: boolean
  /** 打开时搜索框的初始文字。 */
  defaultKeyword?: string
  /** 点面板外面是否关闭;默认 true(嵌入可编辑表格时由表格统一处理)。 */
  closeOnOutside?: boolean
}

/**
 * `select-table` 编辑器的配置(写在列的 `editorProps` 里):SmartSelectTable 的数据源部分 + `fill`。
 * 列声明了 `editorProps.columns` 且有 `data` 或 `fetcher`、又没有显式 `editor` 时自动推断成 select-table(外部 / 主数据;小的静态枚举用 options → 下拉)。
 * 单元格的值 = 选中行的 `labelKey` 字段(缺省 = 本列的 key);`fill` 返回的其它列的值按普通草稿编辑一并写入(各自带脏标记、一步撤销、同样校验)。
 * 单元格内只支持单选(多选小枚举用 multiselect)。
 */
export interface SelectTableProps<R = any> extends Pick<
  SmartSelectTableProps<R>,
  | 'columns'
  | 'data'
  | 'fetcher'
  | 'valueKey'
  | 'labelKey'
  | 'searchKeys'
  | 'searchPlaceholder'
  | 'panelWidth'
  | 'pageSize'
  | 'pageSizes'
  | 'title'
> {
  /** 选中后顺带填其它列:返回 { 列 key: 值 }。 */
  fill?: (picked: R, row: any) => Record<string, unknown>
}

/** 编辑控件类型:input / textarea → NInput;number → NInputNumber;select / multiselect(值是数组)→ NSelect;select-table → SmartSelectTable(外部 / 主数据,单选);date / datetime → NDatePicker;checkbox → NCheckbox。 */
export type EditorKind =
  | 'input'
  | 'textarea'
  | 'number'
  | 'select'
  | 'multiselect'
  | 'select-table'
  | 'date'
  | 'datetime'
  | 'checkbox'

/** 列校验规则(文案走 labels)。validator 返回 true = 通过,返回字符串 = 不通过的提示。 */
export interface EditRules<T = any> {
  required?: boolean
  min?: number
  max?: number
  /** 数字必须是整数。 */
  int?: boolean
  pattern?: RegExp
  /** 字符串长度(input / textarea)。 */
  minLength?: number
  maxLength?: number
  /**
   * 自定义校验:同步返回 true / 提示串,或返回 Promise(异步,如查重);第三个参数是表里当前所有行(已叠草稿),可做「工序号唯一」这类跨行校验。异步时单元格显示加载态、过期结果丢弃,未落定前「保存」会等它,不通过的格标红并拦住保存。
   */
  validator?: (value: unknown, row: T, rows: T[]) => string | true | Promise<string | true>
}

export interface EditableConfig<T = any> {
  /** 按行锁定(如已审核的行):该行所有格只读、抽屉里置灰;列上的 `readonly` 函数形式是按列 + 行的细粒度版。 */
  rowReadonly?: (row: T) => boolean
  /** 编辑模式;目前只有 'cell'(选中格 → 进入编辑)。 */
  mode?: 'cell'
  /**
   * 保存方式:'batch'(默认)改动留在草稿里,「保存修改(N)」一次提交;
   * 'cell' 每提交一个格(含复选框 / Delete / 粘贴)就立刻发一次 @save(载荷与批量同形,只含这一处改动),done() 后无待保存状态,
   * fail() 把这个格回滚到原值并 @error + 单元格提示;新增行 / 删除所选仍是批量待保存。
   */
  save?: 'batch' | 'cell'
  /**
   * 工具栏「新增行」,默认 true(新增行放第 1 行);`{ position: 'bottom' }` 放到列表末尾(如有顺序的工艺路线)。
   * 新增后自动进入编辑的是第一个「必填且为空」的格(没有则第一个为空的、再没有才是第一个可编辑格)。
   */
  add?: boolean | { position?: 'top' | 'bottom' }
  /** 批量栏「删除所选」(待删除,保存才生效),默认 true。 */
  remove?: boolean
  /** 新增行的初值工厂(含只读的编码等);缺省为空对象。 */
  newRow?: () => Partial<T>
  /** 有未保存修改时离开页面的浏览器提示,默认 true。 */
  beforeunload?: boolean
  /** 窄档抽屉表单的标签列宽(px),默认 72;标签较长(如「准备工时(分)」)时加宽,免得被截断。 */
  labelWidth?: number
}

/** 草稿变化(@cell-change):row 是已带上这次改动的行。 */
export interface CellChange<T = any> {
  row: T
  key: string
  value: unknown
  oldValue: unknown
}

/** 一次保存要提交的全部改动。updated 的 row 已带上全部草稿值,changes 里是改过的格(新值 / 改之前的值)。 */
export interface EditChanges<T = any> {
  updated: Array<{ row: T; changes: Record<string, { value: unknown; oldValue: unknown }> }>
  added: T[]
  removed: T[]
  /** 同样的内容拍平成一张表:每行一个明确的类型(created / updated / deleted),宿主按类型分发请求最省事。 */
  rows: EditChangeItem<T>[]
}

export interface EditChangeItem<T = any> {
  type: 'created' | 'updated' | 'deleted'
  row: T
  /** 仅 updated:改过的字段(新值 / 改之前的值)。 */
  changes?: Record<string, { value: unknown; oldValue: unknown }>
}

/** @save:宿主提交后调 done() 清掉草稿并(远程)刷新;调 fail() 保留草稿。 */
export interface EditSavePayload<T = any> {
  changes: EditChanges<T>
  done: () => void
  fail: (e?: unknown) => void
}

/** @invalid:保存时发现某格不合法(已选中该格并标红),宿主可据此弹提示。 */
export interface EditInvalid<T = any> {
  row: T
  key: string
  message: string
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
  /**
   * 搜索区放在哪:'card'(默认)独立搜索卡片 + 网格(模式 1);'table' 并入表格卡片的一行条件构造器「字段 + 比较符 + 值」(模式 2,字段候选 = 声明了
   * `search` 的列,产出走 `filterSerializer` 的 `filters`,默认开 chips);'none' 不带卡片的内联搜索表单(= 2.1.1 的 `layout: 'inline'`)。
   * **`container` 优先于 `layout`**:没写 `container` 时 `layout: 'inline'` 等价 `'none'`;两者冲突时 `layout` 被忽略。
   */
  container?: 'card' | 'table' | 'none'
  /** 布局:'grid'(默认,独立卡片 + n-grid)| 'inline'(无卡片,单行自动换行,适配窄栏)。旧写法,见 `container`。 */
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
  /**
   * 「放大」按钮:表格在页面内最大化(fixed 铺满视口 + Teleport 到 body,盖住宿主的侧栏 / 顶栏;不调用浏览器全屏 API)。默认关闭。
   * `true` = 层级默认 1999(刻意低于 naive 浮层的 2000,所以放大后列头气泡 / 抽屉 / 下拉仍显示在它上面);
   * `{ zIndex }` = 宿主顶栏层级更高时调大(≥ 2000 会盖住表格自己的气泡,开发期会警告一次)。
   */
  maximize?: boolean | { zIndex?: number }
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
   * pageSizes 没显式给(实例或全局)时按 fillHeight 区分:没开 [100, 500, 1000],开了 [100, 1000, 10000];显式给了照宿主的。
   */
  pagination?: false | Partial<PaginationProps>
  /** false 隐藏搜索表单(即使列声明了 search)。 */
  search?: false | SearchFormConfig
  /** false 关掉全部表头过滤(即使列声明了 filter);缺省跟随全局 filterable。 */
  filter?: boolean
  /** 在表格下方、与分页同一行显示「已生效条件」chips(点击重开该列面板、× 删一条、行末清除 / 恢复默认);默认 false。没有分页时在表格下方自成一行。 */
  filterChips?: boolean
  /** false 隐藏右侧工具按钮。 */
  toolbar?: false | ToolbarConfig
  /** 表格卡片标题(也可用 #title 插槽)。 */
  title?: string
  /** 库渲染的所有卡片(表格卡片、模式 1 的搜索卡片)的官方 NCard 属性,合并在库默认 size="small" + 16px 内边距覆盖之后。回退 2.1.1 外观:{ size: 'medium' }。 */
  cardProps?: Partial<CardProps>
  /**
   * 铺满父容器:表体在卡片内滚动(官方 flex-height + virtual-scroll),分页条贴底;默认 false(整页长滚动)。
   * **父容器必须有确定高度**(否则表体塌成 0,库带了 min-height: 160 兜底)。不开时翻页后若卡片顶部已滚出视口,会滚回卡片顶部。
   * 它还决定每页条数可选项的内置值(宿主没显式给 pageSizes 时):开了 [100, 1000, 10000](虚拟滚动扛得住一页上万行),没开 [100, 500, 1000]。
   */
  fillHeight?: boolean
  /**
   * 窄档卡片模式:容器宽 < 600 时,表格换成卡片列表(列映射见列的 `card`)、业务按钮折叠成「操作 ▾」、工具栏控件放大到触控尺寸。
   * 默认 false —— 不开则窄容器与宽容器仍是同一套表格与工具栏。
   */
  cardOnNarrow?: boolean
  /** 列设置 + 密度的 localStorage 持久化键;缺省不持久化。 */
  storageKey?: string
  defaultDensity?: Density // 默认 'compact';响应式(没有密度按钮时它就是当前值)
  /** 部分覆盖英文默认文案;传 computed 对象即随 locale 响应。 */
  labels?: Partial<SmartTableLabels>
  /**
   * 命中行加 .smart-table-row--active 高亮(用 rowKey 比对);配合 @row-click 做主从选中。
   * 高亮色默认取当前主题主色 9%(明暗跟随主题);全局 activeRowBg 可改。@row-click 不会被行内按钮 / 勾选框 / 链接 / 输入框等控件的点击触发。
   */
  activeRowKey?: string | number | null
  /** 所有数据列可拖拽调整列宽;列上写 resizable 可单独覆盖。配合 storageKey 记住宽度。 */
  resizable?: boolean
  /** 行拖拽排序(sortablejs 懒加载,仅开启时才加载);松手后发 @row-drag-sort。默认 false。 */
  rowDraggable?: boolean
  /** 行拖拽的把手选择器(只有按住它才能拖);缺省整行可拖。 */
  dragHandle?: string
  /** 过滤态 → 请求参数的序列化;缺省产出 `{ filters: [{ field, logic, conditions }] }`。 */
  filterSerializer?: (state: FilterState) => Record<string, any>
  /**
   * 可编辑表格(Excel 式单元格编辑 + 按数据类型推断控件):选中格再点 / Enter / F2 / 直接打字进入编辑,改动留在草稿里,
   * 工具栏「保存修改(N)」触发 @save、「放弃修改」整体还原;新增行 / 删除所选也是待保存。默认 false(旧行为完全不变)。
   * 窄档(开了 cardOnNarrow)不逐格编辑:点卡片 → 底部抽屉表单(同一套推断),保存是整行即时保存。
   */
  editable?: boolean | EditableConfig<T>
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
  /** fillHeight 的虚拟滚动下,把当前页第 i 行(0 起)滚进视口。 */
  revealRow: (index: number) => void
  /** 跳到第 n 页。 */
  goPage: (page: number) => Promise<unknown>
  /** 可编辑表格:未保存的改动数(改过的格 + 新增行 + 待删行)。 */
  dirtyCount: Ref<number>
  /** 可编辑表格:有没有未保存的改动(宿主据此做路由守卫)。 */
  isDirty: Ref<boolean>
  /** 可编辑表格:程序化改一格(如拖拽重排后重编号):走草稿,有脏标记、进 @save;不做校验,保存时统一校验。行不在表里返回 false。 */
  setCell: (rowKey: string | number, field: string, value: unknown) => boolean
  /** 可编辑表格:当前全部改动(与 @save 载荷里的 changes 同形)。 */
  getChanges: () => EditChanges<T>
  /** 可编辑表格:校验并触发 @save(等价于点「保存修改」)。 */
  save: () => void
  /** 可编辑表格:放弃全部改动(新增行消失、待删行恢复、改过的格回原值)。 */
  discard: () => void
}

/* ======================== useSmartTable ======================== */

export interface UseSmartTableOptions {
  /** 搜索参数初值,也是 reset 的恢复目标。 */
  initParams?: Record<string, any>
  /** 每次请求追加的外部参数(getter/ref,请求时求值)。 */
  extraParams?: MaybeRefOrGetter<Record<string, any>>
  immediate?: boolean // 默认 true
  defaultPageSize?: number // 默认 10
  /** 请求失败回调。search / onPage / onPageSize 失败时,先把 page / pageSize 还原到表里实际展示的那一页,再调它。 */
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
  /** 窄档折叠后的文字按钮「操作 ▾」(cardOnNarrow)。 */
  operations?: string
  /** 窄档排序抽屉(cardOnNarrow):工具栏「排序」按钮 / 抽屉标题,以及每列的「无 / 升序 / 降序」。 */
  sort?: string
  sortNone?: string
  sortAscend?: string
  sortDescend?: string
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
  /** 面板里第 1 行条件前的引导标签(第 2 行起这一列是且 / 或下拉)。 */
  filterConditionLead?: string
  /** 高级条件里含勾选表达不了的条件时,「返回」禁用的原因提示。 */
  filterCannotCollapse?: string
  /** chips 行末按钮(filterChips):没有列声明 defaultValue 时的文案。 */
  filterClearAll?: string
  /** chips 行末按钮(filterChips):有列声明生效的 defaultValue 时的文案。 */
  filterRestoreDefault?: string
  /* ---- 批量栏 ---- */
  /** 批量栏「已选 N 项」,含 {n} 占位(已选键数,跨页总数)。 */
  selectedCount?: string
  /** 批量栏「取消选择」。 */
  clearSelection?: string
  /* ---- 模式 2 条件构造器 ---- */
  /** 窄档输入框的占位:「搜索 {field}」(field = 当前字段的列标题)。 */
  searchBy?: string
  /** 「更多条件」按钮的名称 / 提示。 */
  searchMoreConditions?: string
  /** 窄档筛选抽屉里每条条件的块头:「条件 {n}」。 */
  searchConditionN?: string
  /* ---- 放大 ---- */
  /** 「放大」按钮的名称 / 提示;放大后变成 restore。 */
  maximize?: string
  restore?: string
  /* ---- 可编辑表格(editable) ---- */
  /** 工具栏 / 批量栏按钮;editSave 含 {n} 占位(待保存的改动数)。 */
  editSave?: string
  editDiscard?: string
  editAddRow?: string
  editDeleteSelected?: string
  /** 窄档抽屉表单:标题(新增 / 编辑)与底部按钮。 */
  editNewTitle?: string
  editEditTitle?: string
  editCancel?: string
  editSheetSave?: string
  editClose?: string
  /** 窄档卡片里复选框列的显示:是 / 否。 */
  editYes?: string
  editNo?: string
  /** 校验文案:{field} = 列标题,{min} / {max} = 规则值。 */
  editRequired?: string
  editRequiredSelect?: string
  editInvalidNumber?: string
  editInt?: string
  editMin?: string
  editMax?: string
  editInvalidDate?: string
  editInvalidDatetime?: string
  editPattern?: string
  /** SmartSelectTable 面板:「共 {n} 条」、「已选 {n} 项」、「清空」(已选)、「确定」。 */
  pickTotal?: string
  pickSelected?: string
  pickClearSel?: string
  pickOk?: string
  editMinLength?: string
  editMaxLength?: string
  /** 批量栏:恢复所选里的待删除行。 */
  editRestoreSelected?: string
  /** 编辑控件占位:「请输入{field}」/「请选择」/「请输入数字」/「选择日期时间」。 */
  editInputPlaceholder?: string
  editSelectPlaceholder?: string
  editNumberPlaceholder?: string
  editDatetimePlaceholder?: string
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
