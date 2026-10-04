// 物料单据通用字典(状态 / 部门 / 负责人)。label 写成函数,随外壳语言渲染期求值:传 useT() 的 t。
// 状态徽标 = 原型 STATUS_CLS:已审核 success、未审核 warning、已关闭 default(NTag small bordered,全局 tag 默认见 ProtoApp)。
import type { SmartTableOption } from '../../../../src/index'
import { OWNERS } from '../../data'

type T = (zh: string) => string

export const STATUS_VALUES = ['已审核', '未审核', '已关闭'] as const
export const DEPT_VALUES = ['采购部', '生产部', '仓储部'] as const

export const statusOptions = (t: T): SmartTableOption[] => [
  { label: () => t('已审核'), value: '已审核', tagType: 'success' },
  { label: () => t('未审核'), value: '未审核', tagType: 'warning' },
  { label: () => t('已关闭'), value: '已关闭', tagType: 'default' },
]

export const deptOptions = (t: T): SmartTableOption[] =>
  DEPT_VALUES.map((v) => ({ label: () => t(v), value: v }))

/** 负责人是人名(业务数据),不翻译。 */
export const ownerOptions = (): SmartTableOption[] => OWNERS.map((o) => ({ label: o, value: o }))
