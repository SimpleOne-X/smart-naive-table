// 模块 6 的「后端」:条件构造器的 filters + 分页。
// 原型 DICT_FIELDS 的 get:行里存的形式与条件的值形式不同的字段,求值前先取成条件的形式 ——
// 单据日期(时间戳 → YYYY-MM-DD)、创建时间(ISO 串 → 日期部分);状态 / 部门存编码,条件的值也是编码(部门 1 与 '1' 互认,matchEqual 的比较器处理)。
import {
  matchFilterValue,
  type PageResult,
  type SerializedFilter,
  type SmartTableParams,
} from '../../../src/index'
import { DICT_DATA, type DictRow } from '../data/m6-dict'
import { isoDay } from '../data/rand'
import { delay, pageSlice } from './memory'

const GET: Partial<Record<string, (r: DictRow) => unknown>> = {
  bizTs: (r) => isoDay(r.bizTs),
  createdAt: (r) => r.createdAt.slice(0, 10),
}

export function queryDict(params: Partial<SmartTableParams>): DictRow[] {
  let rows = DICT_DATA
  const filters = params.filters as SerializedFilter[] | undefined
  if (Array.isArray(filters)) {
    for (const f of filters) {
      const get = GET[f.field] ?? ((r: DictRow) => r[f.field as keyof DictRow])
      rows = rows.filter((r) =>
        matchFilterValue({ logic: f.logic, conditions: f.conditions }, get(r)),
      )
    }
  }
  return rows
}

export async function fetchDict(params: SmartTableParams): Promise<PageResult<DictRow>> {
  await delay()
  return pageSlice(queryDict(params), params)
}
