import { reactive } from 'vue'
import { matchFilterValue, type PageResult, type SerializedFilter, type SmartTableParams } from '../src/index'
import { tt } from './locale'

export interface DemoRow {
  id: number
  account: string
  name: string
  email: string
  deptId: number
  status: number
  enabled: boolean
  salary: number
  createTime: string
  [key: string]: unknown // 宽表 c1..c12 动态列
}

export const mockState = reactive({
  /** 打开后所有请求 reject,验证 error 事件与竞态守卫。 */
  fail: false,
})

const SURNAMES = ['张', '李', '王', '赵', '钱', '孙', '周', '吴', '郑', '陈']
const GIVEN = ['伟', '芳', '娜', '磊', '静', '强', '洋', '艳', '勇', '杰']

const rows: DemoRow[] = Array.from({ length: 1000 }, (_, i) => {
  const id = i + 1
  const row: DemoRow = {
    id,
    account: `user${String(id).padStart(4, '0')}`,
    name: SURNAMES[i % 10] + GIVEN[(i * 7) % 10],
    email: `user${id}@example.com`,
    deptId: (i % 4) + 1,
    status: (i % 3) + 1,
    enabled: i % 5 !== 0,
    salary: 6000 + ((i * 137) % 30000),
    createTime: new Date(Date.UTC(2024, i % 24, (i % 27) + 1, i % 24, (i * 13) % 60, 0)).toISOString(),
  }
  for (let c = 1; c <= 12; c++) row[`c${c}`] = `${id}-${c}`
  return row
})

/** 静态 data 模式的 demo 直接取这份数组(前端分页 + 前端过滤)。 */
export const allRows = rows

let nextId = rows.length + 1

function delay(): Promise<void> {
  return new Promise((res) => setTimeout(res, 300 + Math.random() * 500))
}

/** mock 请求:延迟 300-800ms,支持过滤 + 分页切片;fail 开关下 reject。 */
export async function mockPage(params: SmartTableParams): Promise<PageResult<DemoRow>> {
  await delay()
  if (mockState.fail) throw new Error('mock request failed (toggle on)')

  let list = rows
  const { page, pageSize, account, name, status, enabled, deptId, createRange } = params
  if (account) list = list.filter((r) => r.account.includes(String(account)))
  if (name) list = list.filter((r) => r.name.includes(String(name)))
  if (status !== undefined) list = list.filter((r) => r.status === status)
  if (enabled !== undefined) list = list.filter((r) => r.enabled === enabled)
  if (deptId !== undefined) list = list.filter((r) => r.deptId === deptId)
  if (Array.isArray(createRange)) {
    const [start, end] = createRange as [string, string]
    list = list.filter((r) => {
      const d = r.createTime.slice(0, 10)
      return d >= start && d <= end
    })
  }
  // 表头过滤:默认序列化器产出 { filters: [{ field, logic, conditions }] },
  // 真实后端在这里翻译成 SQL/ORM 条件;demo 直接复用包内导出的求值函数。
  const filters = params.filters as SerializedFilter[] | undefined
  if (Array.isArray(filters)) {
    for (const f of filters) {
      list = list.filter((r) => matchFilterValue({ logic: f.logic, conditions: f.conditions }, r[f.field]))
    }
  }
  // 排序:{ sortField, sortOrder: 'asc' | 'desc' };多列时另带 sorts,demo 只取主排序
  const sortField = params.sortField as string | undefined
  if (sortField) {
    const dir = params.sortOrder === 'desc' ? -1 : 1
    const key = (r: DemoRow) => r[sortField] as string | number
    list = [...list].sort((a, b) => (key(a) > key(b) ? 1 : key(a) < key(b) ? -1 : 0) * dir)
  }
  return {
    items: list.slice((page - 1) * pageSize, page * pageSize),
    total: list.length,
  }
}

export interface DemoForm {
  account: string
  name: string
  email: string
  enabled: boolean
}

export async function mockCreate(form: DemoForm): Promise<void> {
  await delay()
  if (mockState.fail) throw new Error('mock create failed')
  const row: DemoRow = {
    id: nextId++,
    ...form,
    deptId: 1,
    status: 1,
    salary: 8000,
    createTime: new Date().toISOString(),
  }
  for (let c = 1; c <= 12; c++) row[`c${c}`] = `${row.id}-${c}`
  rows.unshift(row)
}

export async function mockUpdate(form: DemoForm, row: DemoRow): Promise<void> {
  await delay()
  if (mockState.fail) throw new Error('mock update failed')
  Object.assign(rows.find((r) => r.id === row.id) ?? {}, form)
}

export async function mockRemove(row: DemoRow): Promise<void> {
  await delay()
  if (mockState.fail) throw new Error('mock remove failed')
  const idx = rows.findIndex((r) => r.id === row.id)
  if (idx >= 0) rows.splice(idx, 1)
}

/** 异步字典:800ms 后返回部门选项,演示搜索下拉 loading 态 + 函数型选项 label。 */
export async function fetchDeptOptions() {
  await new Promise((res) => setTimeout(res, 800))
  return [
    { label: tt('研发部', 'R&D'), value: 1 },
    { label: tt('市场部', 'Marketing'), value: 2 },
    { label: tt('财务部', 'Finance'), value: 3 },
    { label: tt('人事部', 'HR'), value: 4 },
  ]
}
