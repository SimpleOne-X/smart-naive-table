// 宿主的「后端」:对 2000 行内存数据做 搜索 / 列头过滤 / 多列排序 / 分页。
// 库是远程模式(fetcher)——过滤与排序归后端,这里用库导出的 matchFilterValue 当「后端求值器」。
// 搜索语义照原型 sfConds():text → 包含(忽略大小写),select / number / date → 等于。
import { matchFilterValue, type PageResult, type SerializedFilter, type SmartTableParams } from '../../src/index'
import { DATA, FIELD_DEFS, type Row } from './data'

function cmp(a: unknown, b: unknown) {
  const na = Number(a), nb = Number(b)
  if (!Number.isNaN(na) && !Number.isNaN(nb) && a !== '' && b !== '') return na === nb ? 0 : na > nb ? 1 : -1
  const sa = String(a), sb = String(b)
  return sa === sb ? 0 : sa > sb ? 1 : -1
}

/** 模拟后端延迟:原型的 mock 后端是 420ms(刷新 / 搜索 / 翻页 / 排序都有 loading)。测试里置 0。 */
export const MOCK_DELAY = { ms: 420 }

export async function fetchRows(params: SmartTableParams): Promise<PageResult<Row>> {
  if (MOCK_DELAY.ms > 0) await new Promise((r) => setTimeout(r, MOCK_DELAY.ms))
  let rows: Row[] = DATA
  for (const f of FIELD_DEFS) {
    const v = params[f.key]
    if (v === undefined || v === null || String(v).trim() === '') continue
    rows = rows.filter((r) =>
      f.type === 'text'
        ? String(r[f.key]).toLowerCase().includes(String(v).trim().toLowerCase())
        : cmp(r[f.key], String(v).trim()) === 0,
    )
  }
  const filters = params.filters as SerializedFilter[] | undefined
  if (Array.isArray(filters)) {
    for (const f of filters) {
      rows = rows.filter((r) => matchFilterValue({ logic: f.logic, conditions: f.conditions }, r[f.field as keyof Row]))
    }
  }
  // 排序:多列用 params.sorts(高优先级在前),单列用 sortField / sortOrder;比较器照原型 computeRows
  const sorts: Array<{ field: string; order: 'asc' | 'desc' }> | undefined =
    params.sorts ?? (params.sortField ? [{ field: params.sortField, order: params.sortOrder }] : undefined)
  if (sorts?.length) {
    rows = rows.slice().sort((a, b) => {
      for (const s of sorts) {
        const x = a[s.field as keyof Row], y = b[s.field as keyof Row]
        const c = typeof x === 'number' ? x - (y as number) : String(x).localeCompare(String(y), 'zh')
        if (c) return s.order === 'asc' ? c : -c
      }
      return 0
    })
  }
  const { page, pageSize } = params
  return { items: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length }
}
