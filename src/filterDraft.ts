// 列头过滤面板的「草稿」状态机(UI 无关、可单测)。面板内改的是草稿,点「确定」才提交。
import { actionValueKind, activeConditions } from './filter'
import type { FilterAction, FilterCondition, FilterLogic, FilterValue } from './types'

/** 一列最多几条条件(自有取值:超过 5 条的面板在 400px 宽的气泡里已不可读;真有需求走编程式 setFilter)。 */
export const MAX_CONDITIONS = 5

export interface FilterDraft {
  logic: FilterLogic
  conditions: FilterCondition[]
}

export function blankDraft(action: FilterAction): FilterDraft {
  return { logic: 'and', conditions: [{ action, value: null }] }
}

/** 由已生效的过滤值回填草稿;没有值 → 一行空白。条件不截断(编程式给的超过上限的值也原样保留)。 */
export function draftFromValue(
  value: FilterValue | null | undefined,
  action: FilterAction,
): FilterDraft {
  const conditions = (value?.conditions ?? []).filter((c) => c).map((c) => ({ ...c }))
  if (conditions.length === 0) return blankDraft(action)
  return { logic: value?.logic === 'or' ? 'or' : 'and', conditions }
}

export function addCondition(d: FilterDraft, action: FilterAction): FilterDraft {
  if (d.conditions.length >= MAX_CONDITIONS) return d
  return { ...d, conditions: [...d.conditions, { action, value: null }] }
}

/** 删一行;删光了就回到一行空白(面板里至少留一行可编辑)。 */
export function removeCondition(d: FilterDraft, index: number, action: FilterAction): FilterDraft {
  const conditions = d.conditions.filter((_, i) => i !== index)
  return conditions.length ? { ...d, conditions } : blankDraft(action)
}

/** 换操作符:旧值的形状(无值 / 数组 / 标量)与新操作符不一致就清空,不做猜测性转换。 */
export function setConditionAction(
  d: FilterDraft,
  index: number,
  action: FilterAction,
): FilterDraft {
  return {
    ...d,
    conditions: d.conditions.map((c, i) =>
      i !== index
        ? c
        : { action, value: actionValueKind(c.action) === actionValueKind(action) ? c.value : null },
    ),
  }
}

export function setConditionValue(d: FilterDraft, index: number, value: unknown): FilterDraft {
  return { ...d, conditions: d.conditions.map((c, i) => (i === index ? { ...c, value } : c)) }
}

export function setLogic(d: FilterDraft, logic: FilterLogic): FilterDraft {
  return { ...d, logic }
}

/** 草稿 → 提交值:只留生效条件(无值算子算生效);全空 → null;只剩一条时 logic 归位为 and。 */
export function draftToValue(d: FilterDraft): FilterValue | null {
  const conditions = activeConditions({ logic: d.logic, conditions: d.conditions })
  if (conditions.length === 0) return null
  return {
    logic: conditions.length > 1 ? d.logic : 'and',
    conditions: conditions.map((c) => ({ ...c })),
  }
}
