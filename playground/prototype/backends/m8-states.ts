// 模块 8「加载与错误处理」的后端(原型 hookStates):
//   · validate:真实业务规则「查询的日期范围不能超过 1 年,超过就 400」—— 单据日期同时有 ≥ 与 ≤ 两端且相隔 > 365 天 → 抛错(请求失败)
//   · latency:奇数页慢(750ms)、偶数页快(300ms):连点翻页时旧响应会比新响应晚到,靠库的请求序号丢弃(竞态守卫)
// 求值与分页走 ../fetcher.ts 的 queryRows(与模块 2 同一份 2000 行数据),只把延迟换成按页奇偶的。
import type { PageResult, SerializedFilter, SmartTableParams } from '../../../src/index'
import type { Row } from '../data'
import { MOCK_DELAY, queryRows } from '../fetcher'
import { DAY_MS, dayTs } from '../data/rand'

export const RANGE_ERROR = '请求失败(400):日期范围过大,请缩小到 1 年以内'

/** 原型 MC.states.validate:从 filters 里收集单据日期的 gte / lte,跨度 > 365 天抛错。 */
export function validateRange(params: Partial<SmartTableParams>): void {
  const filters = (params.filters as SerializedFilter[] | undefined) ?? []
  const conds = filters.filter((f) => f.field === 'bizDate').flatMap((f) => f.conditions)
  const lo = conds.find((c) => c.action === 'gte'),
    hi = conds.find((c) => c.action === 'lte')
  if (lo && hi && (dayTs(String(hi.value)) - dayTs(String(lo.value))) / DAY_MS > 365)
    throw new Error(RANGE_ERROR)
}

/** 原型 MC.states.latency:奇数页 750ms,偶数页 300ms。 */
export const latencyOf = (page: number): number => 300 + (page % 2 ? 450 : 0)

export async function fetchStates(params: SmartTableParams): Promise<PageResult<Row>> {
  if (MOCK_DELAY.ms > 0) await new Promise((r) => setTimeout(r, latencyOf(params.page)))
  validateRange(params)
  const rows = queryRows(params)
  return {
    items: rows.slice((params.page - 1) * params.pageSize, params.page * params.pageSize),
    total: rows.length,
  }
}
