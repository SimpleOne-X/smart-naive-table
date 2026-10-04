// 内存后端的通用积木(模块 5–14 各自的 backends/*.ts 在它上面拼):分页切片 / 通用搜索 + 构造器 filters + 排序 / 模拟延迟。
// 求值语义与 ../fetcher.ts(模块 1–4 的后端)一致:文本字段 = 包含(忽略大小写),select / number / date = 等于;
// daterange 数组([起, 止],空端不限)→ gte + lte;其它数组 = 多选 in;urgent === true → 备注 = 加急;
// 构造器 / 列头过滤的 filters 用库导出的 matchFilterValue 当「后端求值器」。
import {
  matchFilterValue,
  type PageResult,
  type SerializedFilter,
  type SmartTableParams,
} from '../../../src/index'
import { MOCK_DELAY } from '../fetcher'

/** 模拟后端延迟(默认 420ms,与原型 mock 后端一致)。读 fetcher.ts 的 MOCK_DELAY,单测里 MOCK_DELAY.ms = 0 即全部后端不等待。 */
export const delay = (ms: number = MOCK_DELAY.ms): Promise<void> =>
  ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve()

/** 取第 page 页(page 从 1 起;越界返回空数组,total 照实)。 */
export function pageSlice<R>(
  rows: R[],
  params: Pick<SmartTableParams, 'page' | 'pageSize'>,
): PageResult<R> {
  const { page, pageSize } = params
  return { items: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length }
}

export interface FieldSpec {
  key: string
  /** text = 包含(忽略大小写);select / number / date = 等于(数字与字符串数字互认,如 3 与 '3')。 */
  type: 'text' | 'select' | 'number' | 'date'
}
export interface CommonSpec<R> {
  /** 参与「搜索参数」求值的字段(params[key] 有值才过滤);只用构造器 filters 的模块可不传。 */
  fields?: FieldSpec[]
  /** 排序取值器(字典顺序等特殊比较);缺省取 row[field]。 */
  sortVal?: (row: R, field: string) => unknown
}

/** 数字 / 字符串数字互认的比较(与 fetcher.ts 的 cmp 同)。 */
export function cmp(a: unknown, b: unknown): number {
  const na = Number(a),
    nb = Number(b)
  if (!Number.isNaN(na) && !Number.isNaN(nb) && a !== '' && b !== '')
    return na === nb ? 0 : na > nb ? 1 : -1
  const sa = String(a),
    sb = String(b)
  return sa === sb ? 0 : sa > sb ? 1 : -1
}

/** 通用求值:搜索字段 → urgent → filters(matchFilterValue)→ 排序。不分页;返回新数组(排序时拷贝,不改源)。 */
export function applyCommon<R extends Record<string, any>>(
  rows: R[],
  params: Partial<SmartTableParams>,
  spec: CommonSpec<R> = {},
): R[] {
  let out = rows
  for (const f of spec.fields ?? []) {
    const v = params[f.key]
    if (v === undefined || v === null) continue
    if (Array.isArray(v)) {
      if (f.type === 'date') {
        const [from, to] = v as Array<string | null | undefined>
        out = out.filter((r) => (!from || r[f.key] >= from) && (!to || r[f.key] <= to))
      } else if (v.length) {
        out = out.filter((r) => v.some((x) => cmp(r[f.key], x) === 0))
      }
      continue
    }
    if (String(v).trim() === '') continue
    const needle = String(v).trim()
    out = out.filter((r) =>
      f.type === 'text'
        ? String(r[f.key]).toLowerCase().includes(needle.toLowerCase())
        : cmp(r[f.key], needle) === 0,
    )
  }
  if (params.urgent === true) out = out.filter((r) => r.memo === '加急')
  const filters = params.filters as SerializedFilter[] | undefined
  if (Array.isArray(filters)) {
    for (const f of filters)
      out = out.filter((r) =>
        matchFilterValue({ logic: f.logic, conditions: f.conditions }, r[f.field]),
      )
  }
  const sorts: Array<{ field: string; order: 'asc' | 'desc' }> | undefined =
    params.sorts ??
    (params.sortField ? [{ field: params.sortField, order: params.sortOrder }] : undefined)
  if (sorts?.length) {
    const val = spec.sortVal ?? ((r: R, f: string) => r[f])
    out = out.slice().sort((a, b) => {
      for (const s of sorts) {
        const x = val(a, s.field),
          y = val(b, s.field)
        const c =
          typeof x === 'number' ? x - (y as number) : String(x).localeCompare(String(y), 'zh')
        if (c) return s.order === 'asc' ? c : -c
      }
      return 0
    })
  }
  return out
}

/** 一步到位的 fetcher 积木:delay + applyCommon + pageSlice。模块后端:`export const fetchX = (p) => fetchPage(ROWS, p, { fields })`。 */
export async function fetchPage<R extends Record<string, any>>(
  rows: R[],
  params: SmartTableParams,
  spec: CommonSpec<R> = {},
): Promise<PageResult<R>> {
  await delay()
  return pageSlice(applyCommon(rows, params, spec), params)
}
