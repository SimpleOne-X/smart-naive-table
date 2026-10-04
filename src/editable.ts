// 可编辑表格的纯逻辑(UI 无关、可单测,与 filter.ts 同一原则):
//   · inferEditor     —— 按「列显式 editor → 列声明(options / format)→ 数据值 → 输入框」推断每列的编辑控件,
//                        走与 deriveSearchDefs / deriveFilterDefs 同一套「列驱动」思路,不另开并行配置;
//   · validateEdit    —— 列 rules + 控件类型自带的格式要求,文案走 labels(渲染期求值,切语言即时生效);
//   · createEditStore —— 草稿 / 新增行 / 待删除行的仓库。草稿叠在数据上(overlay),不改宿主的行对象,
//                        所以搜索 / 翻页 / 重新请求都不丢草稿;「改回原值」自动取消脏标记。
import { computed, reactive, toRaw, type ComputedRef } from 'vue'
import type {
  EditChangeItem,
  EditChanges,
  EditorKind,
  SmartTableDataColumn,
  SmartTableLabels,
  SmartTableOption,
} from './types'
import { fmt } from './labels'
import { formatDate, formatDatetime } from './format'

/* ======================== 类型推断 ======================== */

export const EDITOR_KINDS: readonly EditorKind[] = [
  'input',
  'textarea',
  'number',
  'select',
  'multiselect',
  'select-table',
  'date',
  'datetime',
  'checkbox',
]

/** 命中的是哪一条规则(单元格 data-xk / 测试 / 设计文档的「命中」列都用它)。 */
export type EditorVia =
  'readonly' | 'editor' | 'editorProps' | 'options' | 'format' | 'value' | 'fallback' | 'custom'

export interface EditorInfo {
  /** null = 不可编辑(纯展示)。 */
  kind: EditorKind | null
  via: EditorVia
}

/** 推断只看列声明里的这几个字段。 */
type InferColumn = Pick<
  SmartTableDataColumn<any>,
  'editor' | 'readonly' | 'options' | 'format' | 'render' | 'editorProps'
>

/** 取该列前这么多行里第一个非空值来判断数据类型(设计文档 §3)。 */
export const INFER_SAMPLE = 20
/** 字符串长度超过它推成多行文本框(含换行也算)。 */
const TEXTAREA_MIN_LEN = 30

const DATE_RX = /^\d{4}-\d{2}-\d{2}$/
const DATETIME_RX = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/

export function isValidDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return false
  const t = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  return t.getUTCFullYear() === +m[1] && t.getUTCMonth() === +m[2] - 1 && t.getUTCDate() === +m[3]
}

export function isValidDatetime(s: string): boolean {
  return (
    DATETIME_RX.test(s) &&
    isValidDate(s.slice(0, 10)) &&
    +s.slice(11, 13) < 24 &&
    +s.slice(14, 16) < 60 &&
    +s.slice(17, 19) < 60
  )
}

const isBlank = (v: unknown): boolean => v === null || v === undefined || v === ''

/** 取该列前 INFER_SAMPLE 行里第一个非空值。 */
function firstValue(
  rows: ReadonlyArray<Record<string, unknown>>,
  key: string | undefined,
): unknown {
  if (key === undefined) return undefined
  for (let i = 0; i < Math.min(rows.length, INFER_SAMPLE); i++) {
    const x = rows[i][key]
    if (!isBlank(x)) return x
  }
  return undefined
}

/**
 * 推断一列的编辑控件(含命中的规则)。优先级从高到低:
 *   ① 列 `readonly` / `editor: false` → 不可编辑;显式 `editor` → 按声明;
 *   ②「自定义单元格」(render / #cell-* 插槽)且没有显式 editor → 不可编辑 —— 宿主接管了显示,最典型的是操作列,不能被兜底成输入框;
 *   ③ 列声明:`options` → select;`format: 'date' | 'datetime'` → 对应日期控件;`format: 'money'` → number(函数 format 看不出类型,继续往下);
 *   ④ 数据值(前 INFER_SAMPLE 行的第一个非空值):boolean → checkbox;number → number;Date → date;字符串按形状 date / datetime / textarea / input;
 *   ⑤ 兜底:全空列 / 不认识的类型 → input。
 * 为什么列声明优先于数据值:数据值天然有歧义('2026-09-21' 可能就是批次号、全空列推不出类型),宿主明说的不能被猜盖掉;
 * 而 options / format 本来就在列上,不必为编辑再声明一遍。猜错了宿主写一行 `editor` 纠正。
 */
export function inferEditorInfo(
  col: InferColumn,
  rows: ReadonlyArray<Record<string, unknown>>,
  opts: { customCell?: boolean; key?: string } = {},
): EditorInfo {
  // readonly 函数形式是按行判断(useEditable 里做),不影响列级推断;只有 true 才是整列只读
  if (col.editor === false || col.readonly === true)
    return { kind: null, via: col.readonly === true ? 'readonly' : 'editor' }
  if (col.editor && EDITOR_KINDS.includes(col.editor)) return { kind: col.editor, via: 'editor' }
  if (col.render || opts.customCell) return { kind: null, via: 'custom' }
  // 外部 / 主数据:声明了面板的列(columns + data 或 fetcher)→ select-table(优先于静态 options;小的静态枚举才是下拉)
  const ep = col.editorProps as { columns?: unknown; data?: unknown; fetcher?: unknown } | undefined
  if (ep?.columns && (ep.data || ep.fetcher)) return { kind: 'select-table', via: 'editorProps' }
  if (col.options)
    // 列有字典且数据值是数组(标签这类多值字段)→ 多选;否则单选
    return {
      kind: Array.isArray(firstValue(rows, opts.key ?? (col as { key?: string }).key))
        ? 'multiselect'
        : 'select',
      via: 'options',
    }
  if (col.format === 'date' || col.format === 'datetime') return { kind: col.format, via: 'format' }
  if (col.format === 'money') return { kind: 'number', via: 'format' }
  const key = opts.key ?? (col as { key?: string }).key
  if (key !== undefined) {
    const v = firstValue(rows, key)
    if (typeof v === 'boolean') return { kind: 'checkbox', via: 'value' }
    if (typeof v === 'number') return { kind: 'number', via: 'value' }
    if (v instanceof Date) return { kind: 'date', via: 'value' }
    if (typeof v === 'string') {
      if (DATE_RX.test(v)) return { kind: 'date', via: 'value' }
      if (DATETIME_RX.test(v)) return { kind: 'datetime', via: 'value' }
      if (v.includes('\n') || v.length > TEXTAREA_MIN_LEN) return { kind: 'textarea', via: 'value' }
      return { kind: 'input', via: 'value' }
    }
  }
  return { kind: 'input', via: 'fallback' }
}

/** 推断结果的控件类型(null = 不可编辑)。公开的纯函数,可单测。 */
export function inferEditor<T>(
  col: SmartTableDataColumn<T>,
  rows: ReadonlyArray<Record<string, unknown>>,
): EditorKind | null {
  return inferEditorInfo(col, rows, { key: col.key }).kind
}

/* ======================== 日期值与编辑串互转 ======================== */

/**
 * 日期 / 日期时间在编辑器里一律是格式化后的字符串(NDatePicker 的 formatted-value):
 * 宿主存的是字符串就原样,时间戳 / Date 按本地时间格式化。
 */
export function toEditString(kind: 'date' | 'datetime', v: unknown): string {
  if (isBlank(v)) return ''
  if (typeof v === 'string') return v
  return kind === 'date' ? formatDate(v) : formatDatetime(v)
}

/** 编辑串 → 宿主存的类型:原值是时间戳就还时间戳、是 Date 就还 Date,否则(字符串 / 空)字符串。空串 → 原类型的「空」。 */
export function fromEditString(kind: 'date' | 'datetime', s: string, original: unknown): unknown {
  if (typeof original !== 'number' && !(original instanceof Date)) return s
  if (s === '') return null
  const [d, t = '00:00:00'] = s.split(' ')
  const [y, mo, da] = d.split('-').map(Number)
  const [h, mi, se] = (kind === 'datetime' ? t : '00:00:00').split(':').map(Number)
  const date = new Date(y, mo - 1, da, h, mi, se)
  return original instanceof Date ? date : date.getTime()
}

/* ======================== 校验 ======================== */

export interface ValidateCtx<T = any> {
  labels: Required<SmartTableLabels>
  /** 提示里的字段名(列标题的字符串形式)。 */
  field: string
  row: T
  col: Pick<SmartTableDataColumn<T>, 'rules' | 'format'>
  /** select 的可选项(用来校验值必须在其中,并还原 option 自己的值类型)。 */
  options?: SmartTableOption[]
  /** 表里当前所有行(已叠草稿),给自定义 validator 做「唯一」这类跨行校验。 */
  rows?: T[]
}

export type ValidateResult = { ok: true; value: unknown } | { ok: false; message: string }

/**
 * 校验一个待提交的编辑值,通过则返回规整后的值。
 * 规整:number → Number(money 列保留两位);textarea 去尾部空白;input 去首尾空白;select 还原 option 的值类型;checkbox → 布尔。
 * 顺序:必填 → 控件类型的格式(数字 / 整数 / 日期)→ min / max → pattern → 自定义 validator。
 */
export function validateEdit<T>(
  kind: EditorKind,
  raw: unknown,
  ctx: ValidateCtx<T>,
): ValidateResult {
  // 同步版不等 Promise:validator 返回 Promise 时按通过处理(异步部分由 validateEditAsync / useEditable 的提交后检查负责)
  return validateEditPending(kind, raw, ctx).result
}

/** 异步版:同步规则先过,再等 validator(可返回 Promise)。同步规则没过时不会调用 validator。 */
export async function validateEditAsync<T>(
  kind: EditorKind,
  raw: unknown,
  ctx: ValidateCtx<T>,
): Promise<ValidateResult> {
  const { result, pending } = validateEditPending(kind, raw, ctx)
  return pending ? pending : result
}

/**
 * 校验的底层实现:同步规则 + validator 只调用一次。validator 同步返回 → 结果里直接反映;返回 Promise → result 先按通过给出,
 * pending 是异步落定后的最终结果(useEditable 提交后在单元格上显示加载态、过期丢弃,保存时等它)。
 */
export function validateEditPending<T>(
  kind: EditorKind,
  raw: unknown,
  ctx: ValidateCtx<T>,
): { result: ValidateResult; pending?: Promise<ValidateResult> } {
  const { labels: L, field } = ctx
  const rules = ctx.col.rules ?? {}
  const fail = (message: string): { result: ValidateResult } => ({
    result: { ok: false, message },
  })
  if (kind === 'checkbox') return { result: { ok: true, value: !!raw } }

  const blank =
    isBlank(raw) ||
    (typeof raw === 'string' && raw.trim() === '') ||
    (kind === 'multiselect' && Array.isArray(raw) && raw.length === 0)
  if (blank) {
    if (rules.required)
      return fail(
        fmt(
          kind === 'select' ||
            kind === 'select-table' ||
            kind === 'multiselect' ||
            kind === 'date' ||
            kind === 'datetime'
            ? L.editRequiredSelect
            : L.editRequired,
          { field },
        ),
      )
    return {
      result: { ok: true, value: kind === 'number' ? null : kind === 'multiselect' ? [] : '' },
    }
  }

  let value: unknown
  switch (kind) {
    case 'number': {
      const s = typeof raw === 'number' ? String(raw) : String(raw).trim()
      if (typeof raw === 'number' ? !Number.isFinite(raw) : !/^-?\d+(\.\d+)?$/.test(s))
        return fail(L.editInvalidNumber)
      let n = Number(s)
      if (rules.int && !Number.isInteger(n)) return fail(fmt(L.editInt, { field }))
      if (rules.min !== undefined && n < rules.min)
        return fail(fmt(L.editMin, { field, min: rules.min }))
      if (rules.max !== undefined && n > rules.max)
        return fail(fmt(L.editMax, { field, max: rules.max }))
      if (ctx.col.format === 'money') n = Math.round(n * 100) / 100
      value = n
      break
    }
    case 'date': {
      const s = String(raw).trim()
      if (!isValidDate(s)) return fail(L.editInvalidDate)
      value = s
      break
    }
    case 'datetime': {
      const s = String(raw).trim()
      if (!isValidDatetime(s)) return fail(L.editInvalidDatetime)
      value = s
      break
    }
    case 'select': {
      const hit = (ctx.options ?? []).find((o) => String(o.value) === String(raw))
      if (!hit) return fail(fmt(L.editRequiredSelect, { field }))
      value = hit.value
      break
    }
    case 'multiselect': {
      const list = Array.isArray(raw) ? raw : [raw]
      const hits = list.map((x) => (ctx.options ?? []).find((o) => String(o.value) === String(x)))
      if (hits.some((h) => !h)) return fail(fmt(L.editRequiredSelect, { field }))
      value = hits.map((h) => h!.value)
      break
    }
    case 'textarea':
      value = String(raw).replace(/\s+$/, '')
      break
    default:
      value = String(raw).trim()
  }
  if (typeof value === 'string') {
    if (rules.minLength !== undefined && value.length < rules.minLength)
      return fail(fmt(L.editMinLength, { field, min: rules.minLength }))
    if (rules.maxLength !== undefined && value.length > rules.maxLength)
      return fail(fmt(L.editMaxLength, { field, max: rules.maxLength }))
    if (rules.pattern && !rules.pattern.test(value)) return fail(fmt(L.editPattern, { field }))
  }
  if (rules.validator) {
    const r = rules.validator(value, ctx.row, ctx.rows ?? [])
    if (r instanceof Promise || (typeof r === 'object' && r !== null && 'then' in r)) {
      return {
        result: { ok: true, value },
        pending: Promise.resolve(r).then(
          (x): ValidateResult =>
            x === true ? { ok: true, value } : { ok: false, message: String(x) },
          (e): ValidateResult => ({
            ok: false,
            message: e instanceof Error ? e.message : String(e),
          }),
        ),
      }
    }
    if (r !== true) return fail(String(r))
  }
  return { result: { ok: true, value } }
}

/* ======================== 改动仓库 ======================== */

const norm = (v: unknown): unknown => (v === null || v === undefined ? '' : v)
const sameValue = (a: unknown, b: unknown): boolean => {
  const x = norm(a)
  const y = norm(b)
  if (x instanceof Date && y instanceof Date) return x.getTime() === y.getTime()
  if (Array.isArray(x) && Array.isArray(y))
    return x.length === y.length && x.every((v, i) => v === y[i])
  return x === y
}

interface Draft {
  orig: unknown
  val: unknown
}
interface RowDraft<T> {
  row: T
  cells: Record<string, Draft>
}

export interface EditStore<T> {
  /** 未保存的改动数:改过的格 + 新增行 + 待删行(新增 / 待删行里改的格不重复计)。 */
  count: ComputedRef<number>
  /** 新增行(待保存),最新的在前。 */
  news: T[]
  idOf: (row: T) => string
  /** 改一个格:只记第一次的原值,改回原值就取消标记。新增行的格直接写(整行都是待保存)。 */
  set: (row: T, key: string, value: unknown) => { changed: boolean; oldValue: unknown }
  /** 该格当前值:草稿优先,否则行上的值。 */
  valueOf: (row: T, key: string) => unknown
  isDirtyCell: (id: string, key: string) => boolean
  /** 这一行有没有草稿(未删除、非新增时才算「已修改行」)。 */
  isDirtyRow: (id: string) => boolean
  isNew: (id: string) => boolean
  isDeleted: (id: string) => boolean
  /** 新增行放顶部(默认)还是底部(显示序;changes().added 按这个顺序)。 */
  addNew: (row: T, position?: 'top' | 'bottom') => T
  /** 新行直接移除;旧行进待删除。 */
  markDelete: (rows: T[]) => void
  /** 取消删除标记(窄档抽屉 / 放弃时用)。 */
  unmarkDelete: (id: string) => void
  /** 把草稿叠到行上(带草稿的行是拷贝,没草稿的原样)并把新增行放最前。 */
  overlay: (rows: T[], position?: 'top' | 'bottom') => T[]
  changes: () => EditChanges<T>
  /** 全部未删除行里的脏格(保存前统一校验用):基础行 + 格 + 草稿值。 */
  dirtyCells: () => Array<{ id: string; key: string; row: T; value: unknown }>
  /** 只提取给定这些格的改动(save: 'cell' 即时保存用);新增行的格不算。 */
  changesFor: (cells: Array<{ id: string; key: string }>) => EditChanges<T>
  /** 清掉某一格的草稿(即时保存成功 / 失败回滚后)。 */
  clearCell: (id: string, key: string) => void
  clear: () => void
  /** 只清某一行的草稿(窄档抽屉整行即时保存之后)。 */
  clearRow: (id: string) => void
}

/** `rowKey`:行 → 键(与表格的 row-key 同一个函数)。 */
export function createEditStore<T extends object>(
  rowKey: (row: T) => string | number,
): EditStore<T> {
  const idOf = (row: T): string => String(rowKey(row))
  // reactive 的深层解包类型对泛型 T 过于保守,这里按存入的类型读写,统一断言回 T
  const edits = reactive({}) as Record<string, RowDraft<T>>
  const news = reactive([]) as unknown as T[]
  const dels = reactive(new Map()) as unknown as Map<string, T>
  const read = (row: T, key: string): unknown => (row as Record<string, unknown>)[key]

  const isNew = (id: string): boolean => news.some((r) => idOf(r) === id)

  const count = computed(() => {
    let n = news.length + dels.size
    for (const [id, d] of Object.entries(edits)) {
      if (!dels.has(id)) n += Object.keys(d.cells).length
    }
    return n
  })

  function set(row: T, key: string, value: unknown) {
    const id = idOf(row)
    if (isNew(id)) {
      const target = news.find((r) => idOf(r) === id)!
      const oldValue = read(target, key)
      if (sameValue(oldValue, value)) return { changed: false, oldValue }
      ;(target as Record<string, unknown>)[key] = value
      return { changed: true, oldValue }
    }
    const d = edits[id]
    const oldValue = d?.cells[key] ? d.cells[key].val : read(row, key)
    if (sameValue(oldValue, value)) return { changed: false, oldValue }
    const rd = (edits[id] ??= { row, cells: {} })
    const cell = (rd.cells[key] ??= { orig: read(rd.row, key), val: oldValue })
    cell.val = value
    if (sameValue(cell.orig, value)) {
      delete rd.cells[key]
      if (!Object.keys(rd.cells).length) delete edits[id]
    }
    return { changed: true, oldValue }
  }

  // 不能写成 `?? read(...)`:草稿值被清空成 null / '' 时会错误地回落到原值
  const valueOf = (row: T, key: string): unknown => {
    const c = edits[idOf(row)]?.cells[key]
    return c ? c.val : read(row, key)
  }

  function addNew(row: T, position: 'top' | 'bottom' = 'top'): T {
    if (position === 'bottom') {
      news.push(row)
      return news[news.length - 1]
    }
    news.unshift(row)
    return news[0]
  }

  function markDelete(rows: T[]) {
    for (const r of rows) {
      const id = idOf(r)
      const i = news.findIndex((n) => idOf(n) === id)
      if (i >= 0) news.splice(i, 1)
      else dels.set(id, r)
    }
  }

  function overlay(rows: T[], position: 'top' | 'bottom' = 'top'): T[] {
    const out = rows.map((r) => {
      const d = edits[idOf(r)]
      if (!d) return r
      const patch: Record<string, unknown> = {}
      for (const [k, c] of Object.entries(d.cells)) patch[k] = c.val
      return { ...r, ...patch } as T
    })
    if (!news.length) return out
    return position === 'bottom' ? [...out, ...news] : [...news, ...out]
  }

  function changes(): EditChanges<T> {
    const updated: EditChanges<T>['updated'] = []
    for (const [id, d] of Object.entries(edits)) {
      if (dels.has(id)) continue
      const patch: Record<string, unknown> = {}
      const changed: Record<string, { value: unknown; oldValue: unknown }> = {}
      for (const [k, c] of Object.entries(d.cells)) {
        patch[k] = c.val
        changed[k] = { value: c.val, oldValue: c.orig }
      }
      updated.push({ row: { ...d.row, ...patch } as T, changes: changed })
    }
    const added = news.map((r) => ({ ...r }))
    // 待删行给宿主的是它自己数据里的原对象(reactive 代理剥掉),宿主可以按引用对上
    const removed = [...dels.values()].map((r) => toRaw(r))
    return {
      updated,
      added,
      removed,
      rows: [
        ...added.map((row): EditChangeItem<T> => ({ type: 'created', row })),
        ...updated.map((u): EditChangeItem<T> => ({
          type: 'updated',
          row: u.row,
          changes: u.changes,
        })),
        ...removed.map((row): EditChangeItem<T> => ({ type: 'deleted', row })),
      ],
    }
  }

  function dirtyCells() {
    const out: Array<{ id: string; key: string; row: T; value: unknown }> = []
    for (const [id, d] of Object.entries(edits)) {
      if (dels.has(id)) continue
      for (const [key, c] of Object.entries(d.cells))
        out.push({ id, key, row: d.row, value: c.val })
    }
    return out
  }

  function changesFor(cells: Array<{ id: string; key: string }>): EditChanges<T> {
    const by = new Map<string, Record<string, { value: unknown; oldValue: unknown }>>()
    const rowOf = new Map<string, T>()
    for (const { id, key } of cells) {
      const d = edits[id]
      const c = d?.cells[key]
      if (!d || !c || dels.has(id)) continue
      rowOf.set(id, d.row)
      const m = by.get(id) ?? {}
      m[key] = { value: c.val, oldValue: c.orig }
      by.set(id, m)
    }
    const updated: EditChanges<T>['updated'] = []
    for (const [id, changes] of by) {
      const patch: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(changes)) patch[k] = v.value
      updated.push({ row: { ...rowOf.get(id)!, ...patch } as T, changes })
    }
    return {
      updated,
      added: [],
      removed: [],
      rows: updated.map((u): EditChangeItem<T> => ({
        type: 'updated',
        row: u.row,
        changes: u.changes,
      })),
    }
  }

  function clearCell(id: string, key: string) {
    const d = edits[id]
    if (!d) return
    delete d.cells[key]
    if (!Object.keys(d.cells).length) delete edits[id]
  }

  function clear() {
    for (const id of Object.keys(edits)) delete edits[id]
    news.splice(0)
    dels.clear()
  }

  return {
    count,
    news,
    idOf,
    set,
    valueOf,
    isDirtyCell: (id, key) => !!edits[id]?.cells[key],
    isDirtyRow: (id) => !!edits[id] && !dels.has(id),
    isNew,
    isDeleted: (id) => dels.has(id),
    addNew,
    markDelete,
    unmarkDelete: (id) => void dels.delete(id),
    overlay,
    changes,
    dirtyCells,
    changesFor,
    clearCell,
    clear,
    clearRow: (id) => void delete edits[id],
  }
}

/** 编辑控件(EditableEditor / EditableTextPop)与 useEditable 之间的回调:控件只管渲染与交回值,提交 / 校验 / 移动都在 useEditable。 */
export interface EditorCtrl {
  /** 值变化(输入框每次敲字 / 数字框 / datetime 面板里改日期)。 */
  update: (v: unknown) => void
  /** 下拉选中一项 = 提交(Enter 选中时再下移一格)。 */
  pick: (v: unknown) => void
  /** select-table:选中面板里的一行(单元格值 = labelKey,fill 的其它列一并写入)。 */
  pickRow: (row: Record<string, unknown>) => void
  /** select-table 面板的 Esc:有搜索内容先清空并返回 true(已处理),否则返回 false 由外面放弃编辑。面板挂载时设置。 */
  pickEsc?: () => boolean
  /** date:点一天 = 提交;datetime:只改值,等「确认」。 */
  pickDate: (formatted: string) => void
  /** datetime 面板「确认」(官方 confirm 事件带格式化后的值;点日期时官方只改面板内的待定值,到确认才落成值)。 */
  confirmDate: (formatted?: string) => void
  /** 日期面板「清除」= 清空并提交。 */
  clearDate: () => void
}
