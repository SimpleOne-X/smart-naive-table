// 模块 6「字典、标签与格式化」的数据:原型 DICT_STATUS / DICT_DEPT / DICT_DATA 逐字移植。
// 同一批 2000 行,但状态 / 部门存成编码(statusCode / deptId),要靠字典翻成 label;日期是时间戳,创建时间是 ISO 串,备注空值是 null。
import { DATA } from '../data'
import { dayTs, hash32 } from './rand'

export interface DictRow {
  no: string
  name: string
  statusCode: string
  deptId: number
  amount: number
  /** 时间戳输入(format: 'date')。 */
  bizTs: number
  /** ISO 串输入(format: 'datetime')。 */
  createdAt: string
  /** 「距今」列(format 函数形式)的输入:同单据日期的时间戳。库的 format 只在字段值非空时才调用,所以列要有字段值。 */
  ago: number
  /** 空值用 null(库只把 null / undefined 当「空」;空串不会显示成「—」)。 */
  memo: string | null
  creator: string
}

export const DICT_STATUS = [
  { value: 'approved', label: '已审核', tagType: 'success' as const },
  { value: 'pending', label: '未审核', tagType: 'warning' as const },
  { value: 'closed', label: '已关闭', tagType: 'default' as const },
]
/** 异步字典:进入模块后 900ms 才「请求」回来(见 m6-columns.ts 的 deptDict)。 */
export const DICT_DEPT = [
  { value: 1, label: '采购部' },
  { value: 2, label: '生产部' },
  { value: 3, label: '仓储部' },
]
const STATUS_CODE: Record<string, string> = {
  已审核: 'approved',
  未审核: 'pending',
  已关闭: 'closed',
}
const DEPT_ID: Record<string, number> = { 采购部: 1, 生产部: 2, 仓储部: 3 }

export const DICT_DATA: DictRow[] = DATA.map((r) => {
  const h = hash32(r.no + '#t')
  return {
    no: r.no,
    name: r.name,
    statusCode: STATUS_CODE[r.status],
    deptId: DEPT_ID[r.dept],
    amount: r.amount,
    bizTs: dayTs(r.bizDate),
    createdAt: `${r.bizDate}T${String(8 + (h % 10)).padStart(2, '0')}:${String((h >>> 4) % 60).padStart(2, '0')}:${String((h >>> 10) % 60).padStart(2, '0')}`,
    ago: dayTs(r.bizDate),
    memo: r.memo || null,
    creator: r.owner,
  }
})
