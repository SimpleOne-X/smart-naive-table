import type { FilterAction, SmartTableLabels } from './types'

/**
 * 英文默认文案;宿主经 labels prop 部分覆盖(传 computed 即随 locale 响应)。
 * 类型是 Required<SmartTableLabels>:3.0 新增的键在 SmartTableLabels 里是可选的(不破坏 2.1.1 宿主),
 * 但默认包必须给全 —— 库内部拿到的 labels 一律是 Required 形状,渲染期直接取,不用判空。
 */
export const defaultLabels: Required<SmartTableLabels> = {
  search: 'Search',
  reset: 'Reset',
  refresh: 'Refresh',
  density: 'Density',
  densityComfortable: 'Comfortable',
  densityCompact: 'Compact',
  columnSettings: 'Columns',
  columnSettingsReset: 'Restore defaults',
  fixedLeft: 'Pin left',
  fixedRight: 'Pin right',
  fixedNone: 'Unpin',
  expand: 'Expand',
  collapse: 'Collapse',
  filter: 'Filter',
  filterConfirm: 'OK',
  filterReset: 'Reset',
  filterSelectAll: 'Select all',
  filterEqual: 'Equals',
  filterNotEqual: 'Not equals',
  filterContains: 'Contains',
  filterNotContains: 'Not contains',
  filterGt: 'Greater than',
  filterGte: 'Greater or equal',
  filterLt: 'Less than',
  filterLte: 'Less or equal',
  filterIsNull: 'Is empty',
  filterIsNotNull: 'Is not empty',
  filterLike: 'Like',
  filterStartsWith: 'Starts with',
  filterEndsWith: 'Ends with',
  filterIn: 'In',
  filterNotIn: 'Not in',
  filterNoValue: 'No value needed',
  more: 'More',
  filterActiveCount: 'filtered by {n}',
  filterAddCondition: 'Add condition',
  filterRemoveCondition: 'Remove condition',
  filterLogicAnd: 'AND',
  filterLogicOr: 'OR',
  filterAdvanced: 'Advanced conditions',
  filterSimple: 'Back to list',
  filterConditionLead: 'Where',
  filterCannotCollapse: 'Contains conditions checkboxes cannot show',
  filterClearAll: 'Clear all',
  filterRestoreDefault: 'Restore defaults',
}

/**
 * 完整中文文案(含 2.1.1 已有的键与 3.0 新增的键)。纯数据、零依赖:
 * 中文宿主 `:labels="zhCNLabels"` 即可,不必自己抄一份;想改个别词就 `{ ...zhCNLabels, search: '查找' }`。
 */
export const zhCNLabels: Required<SmartTableLabels> = {
  search: '查询',
  reset: '重置',
  refresh: '刷新',
  density: '密度',
  densityComfortable: '舒适',
  densityCompact: '紧凑',
  columnSettings: '列设置',
  columnSettingsReset: '恢复默认',
  fixedLeft: '固定到左侧',
  fixedRight: '固定到右侧',
  fixedNone: '取消固定',
  expand: '展开',
  collapse: '收起',
  filter: '过滤',
  filterConfirm: '确定',
  filterReset: '重置',
  filterSelectAll: '全选',
  filterEqual: '等于',
  filterNotEqual: '不等于',
  filterContains: '包含',
  filterNotContains: '不包含',
  filterGt: '大于',
  filterGte: '大于等于',
  filterLt: '小于',
  filterLte: '小于等于',
  filterIsNull: '为空',
  filterIsNotNull: '不为空',
  filterLike: '模糊匹配',
  filterStartsWith: '开头是',
  filterEndsWith: '结尾是',
  filterIn: '属于',
  filterNotIn: '不属于',
  filterNoValue: '无需填值',
  more: '更多',
  filterActiveCount: '已筛选 {n} 条',
  filterAddCondition: '添加条件',
  filterRemoveCondition: '删除条件',
  filterLogicAnd: '且',
  filterLogicOr: '或',
  filterAdvanced: '高级条件',
  filterSimple: '返回列表',
  filterConditionLead: '条件',
  filterCannotCollapse: '含勾选无法表达的条件',
  filterClearAll: '清除全部',
  filterRestoreDefault: '恢复默认',
}

/** 浅合并助手:跳过值为 undefined 的键,避免 undefined 覆盖下一层的默认值。 */
function mergeDefined(
  base: Required<SmartTableLabels>,
  ...overrides: Array<Partial<SmartTableLabels> | undefined>
): Required<SmartTableLabels> {
  const result = { ...base }
  for (const override of overrides) {
    if (!override) continue
    for (const [key, v] of Object.entries(override)) {
      if (v !== undefined) {
        ;(result as Record<string, unknown>)[key] = v
      }
    }
  }
  return result
}

/** 三层合并:内置英文 < 全局默认(global)< 实例 prop(partial)。结果是 Required 形状(缺的键已由英文默认补齐)。 */
export function mergeLabels(
  partial?: Partial<SmartTableLabels>,
  global?: Partial<SmartTableLabels>,
): Required<SmartTableLabels> {
  return mergeDefined(defaultLabels, global, partial)
}

/** 操作符 → 文案键(ColumnFilter / ConditionRow / chips 共用)。 */
export const ACTION_LABEL_KEY: Record<FilterAction, keyof SmartTableLabels> = {
  equal: 'filterEqual',
  notEqual: 'filterNotEqual',
  contains: 'filterContains',
  notContains: 'filterNotContains',
  gt: 'filterGt',
  gte: 'filterGte',
  lt: 'filterLt',
  lte: 'filterLte',
  isNull: 'filterIsNull',
  isNotNull: 'filterIsNotNull',
  like: 'filterLike',
  startsWith: 'filterStartsWith',
  endsWith: 'filterEndsWith',
  in: 'filterIn',
  notIn: 'filterNotIn',
}

/** 极简模板:把 {name} 替换成 vars[name];没提供的变量原样保留。 */
export function fmt(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m))
}
