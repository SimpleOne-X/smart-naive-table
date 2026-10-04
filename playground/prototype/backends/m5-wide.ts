// 模块 5 的「后端」:2000 行宽表,只有条件构造器的 filters + 分页(没有独立搜索字段、没有排序)。
import type { PageResult, SmartTableParams } from '../../../src/index'
import { WIDE_DATA, type WideRow } from '../data/m5-wide'
import { applyCommon, fetchPage } from './memory'

export const fetchWide = (params: SmartTableParams): Promise<PageResult<WideRow>> =>
  fetchPage(WIDE_DATA, params)
/** 不分页的求值(测试用)。 */
export const queryWide = (params: Partial<SmartTableParams>): WideRow[] =>
  applyCommon(WIDE_DATA, params)
