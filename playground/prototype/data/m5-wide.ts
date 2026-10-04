// 模块 5「多级表头与固定列」的数据:原型 WIDE_DATA / receiptsOf(design.html)逐字移植。
// 同一份 2000 行确定性数据派生(固定种子,刷新不变),与模块 1–4 / 7–9 的 DATA 相互独立。
import { DATA } from '../data'
import { DAY_MS, dayTs, hash32, isoDay, mulberry32 } from './rand'

export interface WideRow {
  no: string
  name: string
  spec: string
  category: string
  unit: string
  brand: string
  model: string
  stockAvail: number
  stockTransit: number
  stockLocked: number
  safe: number
  price: number
  amount: number
  supplier: string
  warehouse: string
  location: string
  batch: string
  mfgDate: string
  expDate: string
  weight: number
  volume: number
  leadTime: number
  owner: string
  status: string
  memo: string
}

export const WIDE_DATA: WideRow[] = DATA.map((r, i) => {
  const rnd = mulberry32(90000 + i)
  const pick = <V>(a: V[]): V => a[Math.floor(rnd() * a.length)]
  const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1))
  const k = int(0, 3)
  const dn = pick(['DN15', 'DN20', 'DN25', 'DN32', 'DN40', 'DN50', 'DN80', 'DN100', 'DN150'])
  const mfg = dayTs(r.bizDate) - int(30, 200) * DAY_MS
  return {
    no: r.no,
    name: r.name,
    spec: `${pick(['不锈钢 304', '碳钢 Q235', '合金钢 15CrMo', '铸钢 WCB', '黄铜 H62'])},公称通径 ${dn},压力等级 PN${['10', '16', '25', '40'][k]},表面${['酸洗钝化', '热镀锌', '喷塑', '本色'][k]}处理,按 ${['GB/T 12459', 'HG/T 20592', 'GB/T 9112', 'ASME B16.5'][k]} 供货`,
    category: ['管件', '阀门', '紧固件', '密封件'][k],
    unit: pick(['件', '套', '个', '只']),
    brand: pick(['宏达', '恒通', '远东', '鼎盛', '华阳']),
    model: `${pick(['HD', 'HT', 'YD', 'DS'])}-${int(100, 999)}`,
    stockAvail: int(0, 5000),
    stockTransit: int(0, 800),
    stockLocked: int(0, 300),
    safe: int(50, 1000),
    price: Math.round((5 + rnd() * 995) * 100) / 100,
    amount: r.amount,
    supplier: pick([
      '上海宏达管阀有限公司',
      '江苏恒通金属制品股份有限公司',
      '浙江鼎盛密封材料有限公司',
      '无锡远东紧固件厂',
      '常州华阳阀门制造有限公司',
    ]),
    warehouse: pick(['一号库', '二号库', '三号库']),
    location: `A${int(1, 9)}-${String(int(1, 30)).padStart(2, '0')}`,
    batch: `B${isoDay(mfg).slice(2, 7).replace('-', '')}${String(int(1, 999)).padStart(3, '0')}`,
    mfgDate: isoDay(mfg),
    expDate: isoDay(mfg + int(1, 3) * 365 * DAY_MS),
    weight: Math.round((0.5 + rnd() * 119.5) * 10) / 10,
    volume: Math.round((0.001 + rnd() * 0.5) * 1000) / 1000,
    leadTime: int(3, 45),
    owner: r.owner,
    status: r.status,
    memo: r.memo,
  }
})

export interface Receipt {
  no: string
  qty: number
  date: string
  loc: string
}
/** 展开行里的「收货明细」:每行 3 笔,由编码派生(确定性)。 */
export function receiptsOf(
  r: Pick<WideRow, 'no' | 'mfgDate' | 'warehouse' | 'location'>,
): Receipt[] {
  const rnd = mulberry32(hash32(r.no))
  return [0, 1, 2].map((i) => ({
    no: `RC${String(hash32(r.no + i) % 1e6).padStart(6, '0')}`,
    qty: 20 + Math.floor(rnd() * 480),
    date: isoDay(dayTs(r.mfgDate) + (10 + i * 9 + Math.floor(rnd() * 5)) * DAY_MS),
    loc: `${r.warehouse} ${r.location}`,
  }))
}

/** 叶子列(导出用):原型 leavesOf('wide') 的 key + 标题,顺序同 WIDE_UNITS 展平。 */
export const WIDE_LEAVES: { key: keyof WideRow; label: string }[] = [
  { key: 'no', label: '物料编码' },
  { key: 'name', label: '物料名称' },
  { key: 'spec', label: '规格说明' },
  { key: 'category', label: '物料分类' },
  { key: 'unit', label: '单位' },
  { key: 'brand', label: '品牌' },
  { key: 'model', label: '型号' },
  { key: 'stockAvail', label: '可用' },
  { key: 'stockTransit', label: '在途' },
  { key: 'stockLocked', label: '锁定' },
  { key: 'safe', label: '安全库存' },
  { key: 'price', label: '单价' },
  { key: 'amount', label: '金额' },
  { key: 'supplier', label: '供应商' },
  { key: 'warehouse', label: '仓库' },
  { key: 'location', label: '库位' },
  { key: 'batch', label: '批次号' },
  { key: 'mfgDate', label: '生产日期' },
  { key: 'expDate', label: '有效期至' },
  { key: 'weight', label: '重量(kg)' },
  { key: 'volume', label: '体积(m³)' },
  { key: 'leadTime', label: '采购周期(天)' },
  { key: 'owner', label: '负责人' },
  { key: 'status', label: '单据状态' },
  { key: 'memo', label: '备注' },
]

/** 原型 batchExport:所选行 × 全部叶子列的 CSV(含表头)。 */
export function wideRowsToCsv(rows: WideRow[]): string {
  const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  return [WIDE_LEAVES.map((c) => c.label), ...rows.map((r) => WIDE_LEAVES.map((c) => r[c.key]))]
    .map((l) => l.map(q).join(','))
    .join('\r\n')
}
