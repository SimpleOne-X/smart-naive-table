// 模块 12「嵌入式表格」的数据:入库明细子表(原型 state.det / detRow)与「选择物料」弹窗的候选行(原型 pickRows)。
// detRow 的数量 / 单价由编码哈希派生(同一编码永远得到同一份数据),与原型同一算法。
import { DATA, type Row } from '../data'
import { hash32 } from './rand'

export interface DetRow {
  no: string
  name: string
  qty: number
  price: number
  amt: number
}

/** 原型 detRow:数量 20–199、单价 10.0–99.9。name / amt 是派生列(原型渲染时现算)。 */
export function detRow(no: string): DetRow {
  const h = hash32(no + '#d')
  const qty = 20 + (h % 180)
  const price = Number((10 + ((h >>> 8) % 900) / 10).toFixed(2))
  return { no, name: DATA.find((r) => r.no === no)?.name ?? '', qty, price, amt: qty * price }
}

/** 原型初始明细:6 行。 */
export const DET_INITIAL = ['M1000-A', 'M1000-B', 'M1024', 'M2011', 'M1000-C', 'M3050']
export const initialDet = (): DetRow[] => DET_INITIAL.map(detRow)

/** 原型 PICK_PS:选择物料弹窗每页 8 行。 */
export const PICK_PS = 8

/** 原型 pickRows:剔除已在明细里的,按关键字(编码 / 名称,忽略大小写)和单据状态过滤。 */
export function pickCandidates(used: ReadonlySet<string>, kw: string, status: string): Row[] {
  const k = kw.trim().toLowerCase()
  return DATA.filter(
    (r) =>
      !used.has(r.no) &&
      (!k || r.no.toLowerCase().includes(k) || r.name.toLowerCase().includes(k)) &&
      (!status || r.status === status),
  )
}

/** 合计行(原型 sum-row):数量、金额。 */
export const sumDet = (rows: readonly DetRow[]): { qty: number; amt: number } => ({
  qty: rows.reduce((n, r) => n + r.qty, 0),
  amt: rows.reduce((n, r) => n + r.amt, 0),
})
