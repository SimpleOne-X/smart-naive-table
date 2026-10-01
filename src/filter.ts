// 过滤内核(UI 无关、可单测):条件求值 + 本地过滤 + 远程参数序列化。
// 条件模型对齐 Bootstrap Blazor 的 FilterAction/FilterLogic(等于/包含/大于… + 且/或),
// 选项勾选模式(Arco 风格)只是「若干 equal 条件 + or」的一层语法糖,两者共用同一份求值逻辑。
import type { FilterAction, FilterCondition, FilterLogic, FilterState, FilterValue } from './types'

const DAY = 86_400_000
/** dayRange() 不传 dateValueFormat 时的缺省形状,对齐 ColumnFilter/SearchForm 的默认值。 */
const DEFAULT_DATE_VALUE_FORMAT = 'yyyy-MM-dd'

/**
 * 按 dateValueFormat(SmartTableDefaults 里配的那个,ColumnFilter 的日期条件用它当
 * n-date-picker 的 value-format)把纯日期串解析成 { y, m, d }。只支持 yyyy/MM/dd 三个
 * token 各出现一次、之间用任意字面分隔符隔开的形状 —— 覆盖 'yyyy-MM-dd'/'yyyy/MM/dd'/
 * 'dd/MM/yyyy' 这类常见自定义格式。解析不出来(用了 yy/M/d 这类短 token,或 host 传了别的
 * 花样格式)就返回 null,调用方照旧退回按原始值的标量比较 —— 不会比不做这个解析更差。
 */
function buildDateOnlyPattern(format: string): { regex: RegExp; order: Array<'y' | 'm' | 'd'> } | null {
  const order: Array<'y' | 'm' | 'd'> = []
  let pattern = ''
  let i = 0
  while (i < format.length) {
    if (format.startsWith('yyyy', i)) {
      order.push('y')
      pattern += '(\\d{4})'
      i += 4
    } else if (format.startsWith('MM', i)) {
      order.push('m')
      pattern += '(\\d{2})'
      i += 2
    } else if (format.startsWith('dd', i)) {
      order.push('d')
      pattern += '(\\d{2})'
      i += 2
    } else {
      pattern += format[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      i += 1
    }
  }
  if (order.length !== 3 || new Set(order).size !== 3) return null
  return { regex: new RegExp(`^${pattern}$`), order }
}

/** 同一个 format 反复解析没必要重建正则,按 format 字符串缓存。 */
const dateOnlyPatternCache = new Map<string, ReturnType<typeof buildDateOnlyPattern>>()

function parseDateOnly(value: string, format: string): { y: number; m: number; d: number } | null {
  let parser = dateOnlyPatternCache.get(format)
  if (parser === undefined) {
    parser = buildDateOnlyPattern(format)
    dateOnlyPatternCache.set(format, parser)
  }
  if (!parser) return null
  const m = parser.regex.exec(value.trim())
  if (!m) return null
  const result = { y: 0, m: 0, d: 0 }
  parser.order.forEach((key, idx) => {
    result[key] = Number(m[idx + 1])
  })
  return result
}

/** 空值:null / undefined / 空串 / 空数组。false 与 0 不算空。 */
export function isBlank(v: unknown): boolean {
  if (v === null || v === undefined) return true
  if (typeof v === 'string') return v.trim() === ''
  if (Array.isArray(v)) return v.length === 0
  return false
}

/** 不需要填值的操作符:值为空也算「写了」,不能被 activeConditions 当成没填丢掉(C4)。 */
export const NO_VALUE_ACTIONS: readonly FilterAction[] = ['isNull', 'isNotNull']

export function isValuelessAction(action: FilterAction): boolean {
  return NO_VALUE_ACTIONS.includes(action)
}

/** 操作符期望的值形状:无值 / 数组(in、notIn)/ 标量。换操作符时据此判断旧值是否还适用。 */
export type ActionValueKind = 'none' | 'array' | 'scalar'

export function actionValueKind(action: FilterAction): ActionValueKind {
  if (isValuelessAction(action)) return 'none'
  return action === 'in' || action === 'notIn' ? 'array' : 'scalar'
}

/** 值非空的条件才参与求值 —— 用户只填了动作没填值时视为没写;无值算子(isNull 等)除外。 */
export function activeConditions(value: FilterValue | null | undefined): FilterCondition[] {
  if (!value || !Array.isArray(value.conditions)) return []
  return value.conditions.filter((c) => c && (isValuelessAction(c.action) || !isBlank(c.value)))
}

/** 该列是否处于生效的过滤态(表头漏斗图标高亮、是否进请求参数都看它)。 */
export function isFilterActive(value: FilterValue | null | undefined): boolean {
  return activeConditions(value).length > 0
}

/** 统一成可比较标量:布尔/数字串 → number,Date/日期串 → 时间戳,其余 → 原字符串。 */
function toComparable(v: unknown): number | string | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'boolean') return Number(v)
  if (typeof v === 'number') return Number.isNaN(v) ? null : v
  if (v instanceof Date) {
    const t = v.getTime()
    return Number.isNaN(t) ? null : t
  }
  const s = String(v)
  if (s.trim() === '') return null
  const n = Number(s)
  if (!Number.isNaN(n)) return n
  const t = Date.parse(s)
  return Number.isNaN(t) ? s : t
}

/** a<b → -1,a>b → 1,相等 → 0;任一侧不可比较 → null(调用方按「不匹配」处理)。 */
function compareValues(a: unknown, b: unknown): number | null {
  const ca = toComparable(a)
  const cb = toComparable(b)
  if (ca === null || cb === null) return null
  if (typeof ca === 'number' && typeof cb === 'number') return ca < cb ? -1 : ca > cb ? 1 : 0
  const sa = String(ca)
  const sb = String(cb)
  return sa < sb ? -1 : sa > sb ? 1 : 0
}

/**
 * 过滤值是纯日期串、单元格是可解析时间时,返回当天的 [起, 止) 时间戳。
 * 否则返回 null,走普通标量比较。
 * —— 让「创建时间 等于 2024-03-05」能命中当天任意时刻,而不是要求毫秒级相等。
 */
function dayRange(
  cell: unknown,
  value: unknown,
  dateValueFormat: string,
): { cellTs: number; start: number; end: number } | null {
  if (typeof value !== 'string') return null
  const parsed = parseDateOnly(value, dateValueFormat)
  if (!parsed) return null
  const cellTs = cell instanceof Date ? cell.getTime() : typeof cell === 'string' ? Date.parse(cell) : NaN
  if (Number.isNaN(cellTs)) return null
  // 本地时区锚定,不用 UTC:单元格若是不带时区偏移的裸日期时间串(常见于后端直出的
  // datetime 字段),Date.parse 按运行环境本地时区解析 —— 与 formatDate/formatDatetime
  // 展示用的 getFullYear/getHours 是同一套本地时间基准。「整天」边界也必须锚在同一基准上,
  // 否则「等于 2024-03-05」按 UTC 零点切,裸日期时间串按本地零点切,两边对不齐,会让页面上
  // 明明显示在 3 月 5 日的行被判定成不匹配(时区在 UTC 前面时尤其明显)。
  const start = new Date(parsed.y, parsed.m - 1, parsed.d).getTime()
  if (Number.isNaN(start)) return null
  return { cellTs, start, end: start + DAY }
}

function matchEqual(cell: unknown, value: unknown, dateValueFormat: string): boolean {
  if (cell === value) return true
  const day = dayRange(cell, value, dateValueFormat)
  if (day) return day.cellTs >= day.start && day.cellTs < day.end
  return compareValues(cell, value) === 0
}

function matchContains(cell: unknown, value: unknown): boolean {
  if (cell === null || cell === undefined) return false
  const needle = String(value).toLowerCase()
  // 数组单元格逐元素匹配 —— 整体 join 成字符串比较会在元素边界上产生假阳性(如 [1,22,3] 误中 '1,2')
  if (Array.isArray(cell)) return cell.some((v) => String(v).toLowerCase().includes(needle))
  return String(cell).toLowerCase().includes(needle)
}

function matchStartsWith(cell: unknown, value: unknown): boolean {
  if (cell === null || cell === undefined) return false
  return String(cell).toLowerCase().startsWith(String(value).toLowerCase())
}

function matchEndsWith(cell: unknown, value: unknown): boolean {
  if (cell === null || cell === undefined) return false
  return String(cell).toLowerCase().endsWith(String(value).toLowerCase())
}

/** SQL LIKE:% 任意长度、_ 单个字符,整串匹配、忽略大小写;其余字符按字面量。 */
function matchLike(cell: unknown, value: unknown): boolean {
  if (cell === null || cell === undefined) return false
  const source = String(value)
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/%/g, '.*')
    .replace(/_/g, '.')
  return new RegExp(`^${source}$`, 'is').test(String(cell))
}

function matchIn(cell: unknown, value: unknown, dateValueFormat: string): boolean {
  return Array.isArray(value) && value.some((v) => matchEqual(cell, v, dateValueFormat))
}

/**
 * 单条件求值。单元格为空时:notEqual/notContains/notIn 为真,其余为假。
 * dateValueFormat 对齐 ColumnFilter 日期条件用的 n-date-picker value-format(缺省
 * 'yyyy-MM-dd')—— host 改了这个配置,「等于某天」的判定也要按同一种形状解析过滤值,
 * 否则值形状对不上,day-range 直接退化成普通标量比较,整天语义悄悄失效。
 */
export function matchCondition(
  cond: FilterCondition,
  cell: unknown,
  dateValueFormat: string = DEFAULT_DATE_VALUE_FORMAT,
): boolean {
  const { action, value } = cond
  switch (action) {
    case 'equal':
      return matchEqual(cell, value, dateValueFormat)
    case 'notEqual':
      return !matchEqual(cell, value, dateValueFormat)
    case 'contains':
      return matchContains(cell, value)
    case 'notContains':
      return !matchContains(cell, value)
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      const day = dayRange(cell, value, dateValueFormat)
      if (day) {
        // 日期粒度:> 某天 = 该天结束之后;<= 某天 = 该天结束之前
        if (action === 'gt') return day.cellTs >= day.end
        if (action === 'gte') return day.cellTs >= day.start
        if (action === 'lt') return day.cellTs < day.start
        return day.cellTs < day.end
      }
      const c = compareValues(cell, value)
      if (c === null) return false
      if (action === 'gt') return c > 0
      if (action === 'gte') return c >= 0
      if (action === 'lt') return c < 0
      return c <= 0
    }
    case 'isNull':
      return isBlank(cell)
    case 'isNotNull':
      return !isBlank(cell)
    case 'startsWith':
      return matchStartsWith(cell, value)
    case 'endsWith':
      return matchEndsWith(cell, value)
    case 'like':
      return matchLike(cell, value)
    case 'in':
      return matchIn(cell, value, dateValueFormat)
    case 'notIn':
      return !matchIn(cell, value, dateValueFormat)
    default:
      // 未识别的 action(如反序列化/编程式构造出的脏数据)按不匹配处理 ——
      // fail-open(默认放行)会让 or 逻辑下整列过滤被一条脏条件悄悄短路成「放行全部」。
      return false
  }
}

/** 一列的过滤值对单个单元格求值;无生效条件 → 放行。 */
export function matchFilterValue(
  value: FilterValue | null | undefined,
  cell: unknown,
  dateValueFormat: string = DEFAULT_DATE_VALUE_FORMAT,
): boolean {
  const conds = activeConditions(value)
  if (conds.length === 0) return true
  const logic: FilterLogic = value?.logic === 'or' ? 'or' : 'and'
  return logic === 'or'
    ? conds.some((c) => matchCondition(c, cell, dateValueFormat))
    : conds.every((c) => matchCondition(c, cell, dateValueFormat))
}

/** applyFilters 需要的最小列信息(由 FilterDef 满足)。 */
export interface FilterableField<T = any> {
  /** 过滤态的键(filter.key ?? 列 key)。 */
  key: string
  /** 行数据字段名(始终是列 key)。 */
  field: string
  /** 自定义匹配,优先于内置条件求值。 */
  filter?: (value: FilterValue, row: T) => boolean
}

/** 本地(静态 data)过滤:各列之间恒为「与」,列内部由 logic 决定。 */
export function applyFilters<T>(
  rows: T[],
  fields: FilterableField<T>[],
  state: FilterState,
  dateValueFormat: string = DEFAULT_DATE_VALUE_FORMAT,
): T[] {
  const active = fields.filter((f) => isFilterActive(state[f.key]))
  if (active.length === 0) return rows
  return rows.filter((row) =>
    active.every((f) => {
      const value = state[f.key]!
      if (f.filter) return f.filter(value, row)
      return matchFilterValue(value, (row as Record<string, unknown>)[f.field], dateValueFormat)
    }),
  )
}

/** 序列化后的单列过滤(默认序列化器的产物形状)。 */
export interface SerializedFilter {
  field: string
  logic: FilterLogic
  conditions: FilterCondition[]
}

/** 过滤态 → 请求参数。默认实现产出 `{ filters: [...] }`,后端形状不同就自己传一个。 */
export type FilterSerializer = (state: FilterState) => Record<string, any>

export const defaultFilterSerializer: FilterSerializer = (state) => {
  const filters: SerializedFilter[] = []
  for (const [field, value] of Object.entries(state)) {
    const conditions = activeConditions(value)
    if (conditions.length) filters.push({ field, logic: value.logic === 'or' ? 'or' : 'and', conditions })
  }
  return filters.length ? { filters } : {}
}

/** 勾选若干选项 → 过滤值(若干 equal 条件取「或」);空选择返回 null。 */
export function optionsToFilterValue(values: unknown[]): FilterValue | null {
  if (!values.length) return null
  return { logic: 'or', conditions: values.map((value) => ({ action: 'equal' as FilterAction, value })) }
}

/** 过滤值 → 已勾选的选项值(optionsToFilterValue 的逆运算,用于回显)。 */
export function filterValueToOptions(value: FilterValue | null | undefined): unknown[] {
  return activeConditions(value)
    .filter((c) => c.action === 'equal')
    .map((c) => c.value)
}
