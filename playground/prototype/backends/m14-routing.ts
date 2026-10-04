// 模块 14 的「后端」:按加工顺序(数组顺序)整表一页返回,支持条件搜索(构造器 filters);批量保存(模拟 500ms)把改动落进「数据库」;
// 拖动重排即时保存顺序(saveOrder,同模块 10 的「松手 = 已保存顺序」),所以重新请求看到的就是拖过的顺序。
import type { EditChanges, PageResult, SmartTableParams } from '../../../src/index'
import { ROUTE_DATA, type RouteRow } from '../data/m14-routing'
import { MOCK_DELAY } from '../fetcher'
import { applyCommon, delay } from './memory'

export async function fetchRoute(p: SmartTableParams): Promise<PageResult<RouteRow>> {
  await delay()
  const items = applyCommon(ROUTE_DATA, p).map((r) => ({ ...r }))
  return { items, total: items.length }
}

/** 「保存修改(N)」里的 N:改过的格 + 新增行 + 待删行(= 库的 dirtyCount)。 */
export const changeCount = (c: EditChanges<RouteRow>): number =>
  c.updated.reduce((n, u) => n + Object.keys(u.changes).length, 0) +
  c.added.length +
  c.removed.length

/** 保存:按 changes.rows 的类型分发(created 追加到末尾 / updated 逐格改 / deleted 删除);返回 N。 */
export async function saveRoute(c: EditChanges<RouteRow>): Promise<number> {
  await delay(MOCK_DELAY.ms > 0 ? 500 : 0)
  for (const item of c.rows) {
    if (item.type === 'deleted') {
      const i = ROUTE_DATA.findIndex((r) => r.no === item.row.no)
      if (i >= 0) ROUTE_DATA.splice(i, 1)
    } else if (item.type === 'updated') {
      const row = ROUTE_DATA.find((r) => r.no === item.row.no)
      if (row)
        for (const [k, v] of Object.entries(item.changes ?? {}))
          (row as unknown as Record<string, unknown>)[k] = v.value
    } else {
      ROUTE_DATA.push({ ...item.row })
    }
  }
  return changeCount(c)
}

/** 即时保存顺序:按给定的主键顺序重排「数据库」里已有的行(没落库的新增行忽略)。 */
export async function saveOrder(nos: string[]): Promise<void> {
  await delay(0)
  const rank = new Map(nos.map((no, i) => [no, i]))
  const saved = ROUTE_DATA.filter((r) => rank.has(r.no)).sort(
    (a, b) => rank.get(a.no)! - rank.get(b.no)!,
  )
  let k = 0
  ROUTE_DATA.splice(
    0,
    ROUTE_DATA.length,
    ...ROUTE_DATA.map((r) => (rank.has(r.no) ? saved[k++] : r)),
  )
}
