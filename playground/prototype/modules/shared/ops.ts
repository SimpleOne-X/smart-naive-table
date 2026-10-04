// 条件构造器 / 表头过滤的比较符:按字段类型分发(原型 OPS_BY_TYPE,设计文档 6.3 的 DEFAULT_ACTIONS 扩展)。
// 库默认只给 8 个,宿主在列上写 search.actions / filter.actions 才出现新的。
import type { FilterAction } from '../../../../src/index'

export type OpsType = 'text' | 'number' | 'date' | 'select'

export const OPS_BY_TYPE: Record<OpsType, FilterAction[]> = {
  text: [
    'contains',
    'notContains',
    'equal',
    'notEqual',
    'startsWith',
    'endsWith',
    'like',
    'isNull',
    'isNotNull',
    'in',
    'notIn',
  ],
  number: ['equal', 'notEqual', 'gt', 'gte', 'lt', 'lte', 'isNull', 'isNotNull', 'in', 'notIn'],
  date: ['equal', 'notEqual', 'gt', 'gte', 'lt', 'lte', 'isNull', 'isNotNull'],
  select: ['equal', 'notEqual', 'in', 'notIn', 'isNull', 'isNotNull'],
}

/** 取某类型的比较符(返回拷贝,宿主改它不影响常量)。 */
export const opsOf = (type: OpsType): FilterAction[] => [...OPS_BY_TYPE[type]]
