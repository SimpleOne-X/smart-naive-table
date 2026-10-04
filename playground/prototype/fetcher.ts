// 宿主的「后端」:对 2000 行内存数据做 搜索 / 列头过滤 / 多列排序 / 分页。
// 库是远程模式(fetcher)——过滤与排序归后端,这里用库导出的 matchFilterValue 当「后端求值器」。
// 搜索语义照原型 sfConds():text → 包含(忽略大小写),select / number / date → 等于;
// 数组值:daterange(单据日期 [起, 止])→ gte + lte;多选(负责人)→ in;开关「仅看加急」(urgent)→ 备注 = 加急。
import {
  matchFilterValue,
  type PageResult,
  type SerializedFilter,
  type SmartTableParams,
} from '../../src/index'
import { DATA, FIELD_DEFS, type Row } from './data'

/** 原型 STATUS_RANK:模块 4「按单据状态排序」是字典顺序,不是 label 的拼音。 */
const STATUS_RANK: Record<string, number> = { 已审核: 0, 未审核: 1, 已关闭: 2 }
const sortVal = (r: Row, field: string): unknown =>
  field === 'status' && r.status in STATUS_RANK ? STATUS_RANK[r.status] : r[field as keyof Row]

function cmp(a: unknown, b: unknown) {
  const na = Number(a),
    nb = Number(b)
  if (!Number.isNaN(na) && !Number.isNaN(nb) && a !== '' && b !== '')
    return na === nb ? 0 : na > nb ? 1 : -1
  const sa = String(a),
    sb = String(b)
  return sa === sb ? 0 : sa > sb ? 1 : -1
}

/** 模拟后端延迟:原型的 mock 后端是 420ms(刷新 / 搜索 / 翻页 / 排序都有 loading)。测试里置 0。 */
export const MOCK_DELAY = { ms: 420 }

/** 后端求值:搜索 + 列头过滤 + 排序(不分页)。fetchRows 与「导出全部行」共用。 */
export function queryRows(params: Partial<SmartTableParams>): Row[] {
  let rows: Row[] = DATA
  for (const f of FIELD_DEFS) {
    const v = params[f.key]
    if (v === undefined || v === null) continue
    if (Array.isArray(v)) {
      // daterange:[起, 止](空端不限);其余数组 = 多选 in
      if (f.type === 'date') {
        const [from, to] = v as Array<string | null | undefined>
        rows = rows.filter((r) => (!from || r[f.key] >= from) && (!to || r[f.key] <= to))
      } else if (v.length) {
        rows = rows.filter((r) => v.some((x) => cmp(r[f.key], x) === 0))
      }
      continue
    }
    if (String(v).trim() === '') continue
    rows = rows.filter((r) =>
      f.type === 'text'
        ? String(r[f.key]).toLowerCase().includes(String(v).trim().toLowerCase())
        : cmp(r[f.key], String(v).trim()) === 0,
    )
  }
  if (params.urgent === true) rows = rows.filter((r) => r.memo === '加急')
  const filters = params.filters as SerializedFilter[] | undefined
  if (Array.isArray(filters)) {
    for (const f of filters) {
      rows = rows.filter((r) =>
        matchFilterValue({ logic: f.logic, conditions: f.conditions }, r[f.field as keyof Row]),
      )
    }
  }
  // 排序:多列用 params.sorts(高优先级在前),单列用 sortField / sortOrder;比较器照原型 sortRows
  // (status 字段按 STATUS_RANK 字典顺序比,其余按数值 / zh 本地化字符串比)
  const sorts: Array<{ field: string; order: 'asc' | 'desc' }> | undefined =
    params.sorts ??
    (params.sortField ? [{ field: params.sortField, order: params.sortOrder }] : undefined)
  if (sorts?.length) {
    rows = rows.slice().sort((a, b) => {
      for (const s of sorts) {
        const x = sortVal(a, s.field),
          y = sortVal(b, s.field)
        const c =
          typeof x === 'number' ? x - (y as number) : String(x).localeCompare(String(y), 'zh')
        if (c) return s.order === 'asc' ? c : -c
      }
      return 0
    })
  }
  return rows
}

export async function fetchRows(params: SmartTableParams): Promise<PageResult<Row>> {
  if (MOCK_DELAY.ms > 0) await new Promise((r) => setTimeout(r, MOCK_DELAY.ms))
  const rows = queryRows(params)
  const { page, pageSize } = params
  return { items: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length }
}
