// 模块 10「行拖拽排序」的数据:原型 PROCS(design.html),10 道工序,静态数据。
export interface Proc {
  code: string
  name: string
  center: string
  hours: number
  note: string
}

export const PROCS: Proc[] = [
  { code: '10', name: '下料', center: '下料中心', hours: 0.5, note: '锯切 / 激光' },
  { code: '20', name: '粗车', center: '车削一组', hours: 1.5, note: '留量 1.5mm' },
  { code: '30', name: '钻孔', center: '加工中心', hours: 0.8, note: '' },
  { code: '40', name: '铣面', center: '加工中心', hours: 1.2, note: '密封面' },
  { code: '50', name: '热处理', center: '热处理车间', hours: 4.0, note: '外协' },
  { code: '60', name: '精车', center: '车削二组', hours: 1.8, note: '公差 ±0.02' },
  { code: '70', name: '磨削', center: '磨床组', hours: 2.2, note: '' },
  { code: '80', name: '酸洗钝化', center: '表面处理', hours: 1.0, note: '不锈钢件' },
  { code: '90', name: '检验', center: '质检中心', hours: 0.6, note: '全检' },
  { code: '100', name: '包装', center: '成品库', hours: 0.4, note: '' },
]

/** 每次进入模块都从原型初始顺序重新开始(拷贝,宿主拖拽会就地改这个数组)。 */
export const freshProcs = (): Proc[] => PROCS.map((p) => ({ ...p }))

/** 把 from 位的元素移到 to 位(原地,返回是否真的移动了);键盘 ↑ / ↓ 用。 */
export function moveItem<T>(arr: T[], from: number, to: number): boolean {
  if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return false
  const [m] = arr.splice(from, 1)
  arr.splice(to, 0, m)
  return true
}
