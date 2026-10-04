// 原型 docs/smart-naive-table-design.html 里的数据生成器(mulberry32 / DATA_BASE 一段),原样移植(2000 行确定性伪随机,前 8 行为 DATA_BASE)。
export interface Row {
  no: string
  name: string
  owner: string
  status: string
  dept: string
  amount: number
  bizDate: string
  memo: string
}

export const FIELD_DEFS = [
  { key: 'no', label: '物料编码', type: 'text' },
  { key: 'name', label: '物料名称', type: 'text' },
  { key: 'owner', label: '负责人', type: 'text' },
  { key: 'status', label: '单据状态', type: 'select', options: ['已审核', '未审核', '已关闭'] },
  { key: 'dept', label: '部门', type: 'select', options: ['采购部', '生产部', '仓储部'] },
  { key: 'amount', label: '金额', type: 'number' },
  { key: 'bizDate', label: '单据日期', type: 'date' },
  { key: 'memo', label: '备注', type: 'text' },
] as const

const DATA_BASE: Row[] = [
  {
    no: 'M1000-A',
    name: '不锈钢法兰',
    owner: '张伟',
    status: '已审核',
    dept: '采购部',
    amount: 12800,
    bizDate: '2026-09-21',
    memo: '加急',
  },
  {
    no: 'M1000-B',
    name: '不锈钢弯头',
    owner: '李娜',
    status: '已审核',
    dept: '采购部',
    amount: 3400,
    bizDate: '2026-09-20',
    memo: '',
  },
  {
    no: 'M1024',
    name: '碳钢管件',
    owner: '王强',
    status: '未审核',
    dept: '生产部',
    amount: 980,
    bizDate: '2026-08-18',
    memo: '待核价',
  },
  {
    no: 'M2011',
    name: '密封垫片',
    owner: '刘洋',
    status: '已关闭',
    dept: '仓储部',
    amount: 260,
    bizDate: '2026-07-17',
    memo: '',
  },
  {
    no: 'M1000-C',
    name: '不锈钢三通',
    owner: '张伟',
    status: '已审核',
    dept: '生产部',
    amount: 25600,
    bizDate: '2026-09-12',
    memo: '样品',
  },
  {
    no: 'M3050',
    name: '高压球阀',
    owner: '陈静',
    status: '未审核',
    dept: '采购部',
    amount: 47200,
    bizDate: '2026-06-30',
    memo: '',
  },
  {
    no: 'M2087',
    name: '测试专用件',
    owner: '李娜',
    status: '已关闭',
    dept: '生产部',
    amount: 120,
    bizDate: '2026-05-11',
    memo: '测试',
  },
  {
    no: 'M1099',
    name: '不锈钢螺栓',
    owner: '赵磊',
    status: '已审核',
    dept: '仓储部',
    amount: 1560,
    bizDate: '2026-09-02',
    memo: '',
  },
]

/** 负责人候选(原型 OWNERS):搜索区的多选、模块 3 的自定义过滤面板、CRUD 弹窗共用。 */
export const OWNERS = [
  '张伟',
  '李娜',
  '王强',
  '刘洋',
  '陈静',
  '赵磊',
  '周敏',
  '吴凡',
  '郑浩',
  '孙婷',
  '黄磊',
  '何欣',
]
/** 原型 TODAY:演示数据锚在 2026-09,用固定日期,不随系统时钟漂移。 */
export const TODAY = '2026-09-29'
/** 模块 1 单据日期的默认「本月」(原型 SF_DEFS_SEARCH.bizDate.def)。 */
export const MONTH_RANGE: [string, string] = ['2026-09-01', '2026-09-30']

const DATA_TOTAL = 2000
function mulberry32(seed: number) {
  return function () {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function genRows(base: Row[], total: number): Row[] {
  const rnd = mulberry32(20260929)
  const pick = <V>(arr: V[]): V => arr[Math.floor(rnd() * arr.length)]
  const wpick = (pairs: [string, number][]) => {
    let x = rnd() * pairs.reduce((s, p) => s + p[1], 0)
    for (const [v, w] of pairs) {
      if ((x -= w) < 0) return v
    }
    return pairs[0][0]
  }
  const MATERIALS = ['不锈钢', '碳钢', '合金钢', '铸钢', '镀锌', '黄铜', '铝合金']
  const PIPE = ['法兰', '弯头', '三通', '球阀', '闸阀', '截止阀', '管件', '大小头', '接头']
  const BOLT = ['螺栓', '螺母', '垫片']
  const DN = [
    'DN15',
    'DN20',
    'DN25',
    'DN32',
    'DN40',
    'DN50',
    'DN65',
    'DN80',
    'DN100',
    'DN125',
    'DN150',
    'DN200',
  ]
  const BOLT_SPEC = ['M8', 'M10', 'M12', 'M16', 'M20', 'M24']
  const MEMOS = [
    '加急',
    '待核价',
    '样品',
    '测试',
    '补货',
    '返工',
    '质检中',
    '已比价',
    '客户指定',
    '缺货',
  ]
  const DAY0 = Date.UTC(2026, 0, 1),
    DAYS = 272 // 2026-01-01 ~ 2026-09-29 共 272 天
  const used = new Set(base.map((r) => r.no))
  const rows: Row[] = []
  while (rows.length < total - base.length) {
    let no: string
    do {
      no =
        'M' +
        (1001 + Math.floor(rnd() * 8999)) +
        (rnd() < 0.25 ? '-' + 'ABCDEF'[Math.floor(rnd() * 6)] : '')
    } while (used.has(no))
    used.add(no)
    const isBolt = rnd() < 0.18
    const name = isBolt
      ? `${pick(MATERIALS)}${pick(BOLT)} ${pick(BOLT_SPEC)}`
      : `${pick(MATERIALS)}${pick(PIPE)} ${pick(DN)}`
    rows.push({
      no,
      name,
      owner: pick(OWNERS),
      status: wpick([
        ['已审核', 55],
        ['未审核', 32],
        ['已关闭', 13],
      ]),
      dept: wpick([
        ['采购部', 40],
        ['生产部', 35],
        ['仓储部', 25],
      ]),
      amount: Math.round(100 + Math.pow(rnd(), 2) * 59900),
      bizDate: new Date(DAY0 + Math.floor(rnd() * DAYS) * 864e5).toISOString().slice(0, 10),
      memo: rnd() < 0.2 ? pick(MEMOS) : '',
    })
  }
  return rows.sort((a, b) =>
    a.bizDate < b.bizDate ? 1 : a.bizDate > b.bizDate ? -1 : a.no < b.no ? -1 : 1,
  ) // 新单据在前
}
export const DATA: Row[] = [...DATA_BASE.map((r) => ({ ...r })), ...genRows(DATA_BASE, DATA_TOTAL)]

/** 原型 nextNo / addRow:新增一行「新建物料」放最前(宿主业务逻辑,库不管)。 */
function nextNo() {
  const used = new Set(DATA.map((r) => r.no))
  const seq = [...'DEFGHIJKLMNOPQRSTUVWXYZABC']
  for (const ch of seq) if (!used.has('M1000-' + ch)) return 'M1000-' + ch
  let n = 1
  while (used.has('M1000-' + n)) n++
  return 'M1000-' + n
}
export function addRow(): string {
  const row: Row = {
    no: nextNo(),
    name: '新建物料',
    owner: '张伟',
    status: '未审核',
    dept: '采购部',
    amount: 0,
    bizDate: TODAY,
    memo: '',
  }
  DATA.unshift(row)
  return row.no
}
export function delRow(no: string): boolean {
  const i = DATA.findIndex((r) => r.no === no)
  if (i < 0) return false
  DATA.splice(i, 1)
  return true
}

/** 原型 CRUD 弹窗的表单形状(物料单据一行,金额在表单里允许为空)。 */
export interface RowForm {
  no: string
  name: string
  owner: string
  status: string
  dept: string
  amount: number | null
  bizDate: string
  memo: string
}
export const blankForm = (): RowForm => ({
  no: '',
  name: '',
  owner: '张伟',
  status: '未审核',
  dept: '采购部',
  amount: null,
  bizDate: TODAY,
  memo: '',
})

const formToRow = (f: RowForm): Row => ({
  no: f.no.trim(),
  name: f.name.trim(),
  owner: f.owner,
  status: f.status,
  dept: f.dept,
  amount: Number(f.amount ?? 0),
  bizDate: f.bizDate,
  memo: f.memo.trim(),
})
/** 原型 crudSubmit(新增):后端业务规则「编码唯一」,重复抛错(弹窗保持打开)。 */
export function createRow(f: RowForm): void {
  const row = formToRow(f)
  if (DATA.some((r) => r.no === row.no)) throw new Error(`物料编码 ${row.no} 已存在`)
  DATA.unshift(row)
}
/** 原型 crudSubmit(编辑):按原编码就地更新;改编码时同样查重。 */
export function updateRow(f: RowForm, orig: string): void {
  const row = formToRow(f)
  if (DATA.some((r) => r.no === row.no && r.no !== orig))
    throw new Error(`物料编码 ${row.no} 已存在`)
  const target = DATA.find((r) => r.no === orig)
  if (target) Object.assign(target, row)
}

/** 原型 CSV_HEAD / exportCsv:导出 = 后端按当前条件取全部行(金额两位小数),UTF-8 BOM 方便 Excel 直接打开。 */
export const CSV_HEAD = [
  '物料编码',
  '物料名称',
  '负责人',
  '单据状态',
  '部门',
  '金额',
  '单据日期',
  '备注',
]
const csvQ = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
export const rowsToCsv = (rows: Row[]) =>
  [
    CSV_HEAD,
    ...rows.map((r) => [
      r.no,
      r.name,
      r.owner,
      r.status,
      r.dept,
      r.amount.toFixed(2),
      r.bizDate,
      r.memo,
    ]),
  ]
    .map((l) => l.map(csvQ).join(','))
    .join('\r\n')

/** 原型 batchApprove:勾选行里「未审核」的改为「已审核」,返回真正变化的行数。 */
export function approveRows(nos: readonly string[]): number {
  const set = new Set(nos)
  let n = 0
  for (const r of DATA)
    if (set.has(r.no) && r.status === '未审核') {
      r.status = '已审核'
      n++
    }
  return n
}
/** 原型 batchDel:删除全部已勾选行(含其它页的),返回删除条数。 */
export function delRows(nos: readonly string[]): number {
  const set = new Set(nos)
  let n = 0
  for (let i = DATA.length - 1; i >= 0; i--)
    if (set.has(DATA[i].no)) {
      DATA.splice(i, 1)
      n++
    }
  return n
}
