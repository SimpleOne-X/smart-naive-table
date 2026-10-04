// 模块 14「可编辑表格」的示例数据:工艺路线设计器 —— 产品「变速箱壳体 GB-2201」的 12 道工序(数组顺序 = 加工顺序)。
// 数据逐字抄自设计原型 docs/smart-naive-table-design.html 的 XL_CENTERS / XL_OPS / XL_DATA(改原型时同步这里):
//   · 「工序号」= 表格序号(位置 1, 2, 3 …),不是数据字段、不可编辑;拖动后序号跟着位置变,不产生脏标记。行主键 no(R1 …)是隐藏字段(不是列)。
//   · 工序库 XL_OPS(36 行)是 select-table 的数据源:路线里的 12 道工序名都在库里,工作中心 / 类型一致;setup / unit 是标准工时,路线里可以不同。
//   · 12 行里:2 道外协(热处理、磨削)、1 道检验(终检)、1 道停用(去毛刺,行级只读)。
export interface RouteRow {
  /** 行主键(隐藏,稳定,不随重排变)。 */
  no: string
  name: string
  center: string
  type: string
  /** 准备工时(分钟,整数 ≥ 0)。 */
  setup: number
  /** 单件工时(分钟,1 位小数 ≥ 0)。 */
  unit: number
  report: boolean
  qc: boolean
  note: string
  status: string
}

/** 工序库一行(主数据)。 */
export interface OpRow {
  code: string
  name: string
  center: string
  type: string
  setup: number
  unit: number
}

export const ROUTE_PRODUCT = '变速箱壳体 GB-2201'
export const ROUTE_CENTERS = [
  '数控车间',
  '加工中心',
  '热处理线',
  '磨床组',
  '清洗线',
  '检验室',
  '包装线',
]
export const ROUTE_TYPES = ['自制', '外协', '检验']
export const ROUTE_STATUS = ['启用', '停用']

type OpRaw = [string, string, string, number, number]
const OPS_RAW: OpRaw[] = [
  ['下料', '数控车间', '自制', 15, 3.5],
  ['粗车', '数控车间', '自制', 30, 8.0],
  ['精车', '数控车间', '自制', 25, 11.5],
  ['钻孔', '加工中心', '自制', 40, 6.0],
  ['铣面', '加工中心', '自制', 30, 9.0],
  ['热处理', '热处理线', '外协', 10, 20.0],
  ['磨削', '磨床组', '外协', 20, 14.0],
  ['去毛刺', '加工中心', '自制', 5, 4.0],
  ['清洗', '清洗线', '自制', 10, 3.0],
  ['终检', '检验室', '检验', 20, 10.0],
  ['防锈', '包装线', '自制', 5, 2.0],
  ['入库', '包装线', '自制', 5, 1.5],
  ['镗孔', '加工中心', '自制', 45, 10.5],
  ['攻丝', '加工中心', '自制', 20, 2.5],
  ['拉削', '数控车间', '自制', 30, 6.0],
  ['滚齿', '数控车间', '自制', 40, 14.0],
  ['插齿', '数控车间', '自制', 40, 16.5],
  ['珩磨', '磨床组', '自制', 25, 9.5],
  ['喷砂', '清洗线', '外协', 10, 5.0],
  ['发黑', '热处理线', '外协', 10, 12.0],
  ['电镀', '热处理线', '外协', 15, 18.0],
  ['焊接', '加工中心', '自制', 20, 12.5],
  ['校直', '数控车间', '自制', 10, 4.5],
  ['动平衡', '检验室', '检验', 15, 6.0],
  ['装配', '包装线', '自制', 20, 18.0],
  ['试压', '检验室', '检验', 15, 8.0],
  ['包装', '包装线', '自制', 5, 3.0],
  ['倒角', '数控车间', '自制', 5, 1.5],
  ['研磨', '磨床组', '自制', 20, 11.0],
  ['抛光', '磨床组', '自制', 10, 7.5],
  ['探伤', '检验室', '检验', 20, 9.0],
  ['渗碳', '热处理线', '外协', 15, 45.0],
  ['淬火', '热处理线', '自制', 10, 25.0],
  ['磷化', '清洗线', '外协', 10, 6.0],
  ['涂装', '包装线', '外协', 15, 10.0],
  ['首件检验', '检验室', '检验', 15, 12.0],
]
/** 工序库(36 行):OP001 … OP036。 */
export const ROUTE_OPS: OpRow[] = OPS_RAW.map(([name, center, type, setup, unit], i) => ({
  code: 'OP' + String(i + 1).padStart(3, '0'),
  name,
  center,
  type,
  setup,
  unit,
}))

type Raw = [string, string, string, number, number, boolean, boolean, string, string]
const KEYS = ['name', 'center', 'type', 'setup', 'unit', 'report', 'qc', 'note', 'status'] as const
const DATA_RAW: Raw[] = [
  ['下料', '数控车间', '自制', 15, 3.5, true, false, '带锯下料,留加工余量 5 mm', '启用'],
  ['粗车', '数控车间', '自制', 30, 8.5, true, false, '粗车端面及内孔,单边留余量 1.5 mm', '启用'],
  ['精车', '数控车间', '自制', 25, 12.0, true, true, '精车内孔至 Φ120H7,同轴度 0.02', '启用'],
  [
    '钻孔',
    '加工中心',
    '自制',
    40,
    6.5,
    true,
    false,
    '钻 M10 螺纹底孔 12 个\n按钻孔夹具定位',
    '启用',
  ],
  ['铣面', '加工中心', '自制', 35, 9.0, true, true, '铣结合面,平面度 0.05,粗糙度 Ra3.2', '启用'],
  [
    '热处理',
    '热处理线',
    '外协',
    10,
    20.0,
    true,
    false,
    '委外调质处理,硬度 HB180-220,附热处理报告',
    '启用',
  ],
  ['磨削', '磨床组', '外协', 20, 15.0, true, true, '委外精磨结合面,平面度 0.02', '启用'],
  ['去毛刺', '加工中心', '自制', 5, 4.0, false, false, '人工去毛刺,已并入清洗', '停用'],
  ['清洗', '清洗线', '自制', 10, 3.0, true, false, '超声波清洗,残留杂质不大于 0.5 mg', '启用'],
  ['终检', '检验室', '检验', 20, 10.0, true, true, '全尺寸测量,出具报告', '启用'],
  ['防锈', '包装线', '自制', 5, 2.5, false, false, '涂防锈油,覆盖全部加工面', '启用'],
  ['入库', '包装线', '自制', 5, 1.5, true, false, '包装后入成品库,随件附流转卡', '启用'],
]
export const genRoute = (): RouteRow[] =>
  DATA_RAW.map(
    (a, i) =>
      ({
        no: 'R' + (i + 1),
        ...Object.fromEntries(KEYS.map((k, j) => [k, a[j]])),
      }) as unknown as RouteRow,
  )

/** 「数据库」:后端读写它(会话态,切走再切回数据不丢;单测用 resetRoute 还原)。数组顺序 = 加工顺序。 */
export const ROUTE_DATA: RouteRow[] = genRoute()
export function resetRoute(): void {
  ROUTE_DATA.splice(0, ROUTE_DATA.length, ...genRoute())
  issued = 0
}

/** 行主键:R + 当前最大号 + 1(隐藏,与工序号无关);已发出还没保存的号也算,同时新增多行不会撞号。 */
let issued = 0
export function nextRouteNo(): string {
  const max = ROUTE_DATA.reduce((n, r) => Math.max(n, Number(r.no.slice(1)) || 0), 0)
  issued = Math.max(issued, max) + 1
  return 'R' + issued
}

/** 新增行初值(同原型 xlNewRow):名称空、工作中心取第一项、自制、工时 0、默认报工、启用。 */
export const newRouteRow = (): RouteRow => ({
  no: nextRouteNo(),
  name: '',
  center: ROUTE_CENTERS[0],
  type: '自制',
  setup: 0,
  unit: 0,
  report: true,
  qc: false,
  note: '',
  status: '启用',
})
