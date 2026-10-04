// 对照页共享件(modules/shared、data/rand、backends/memory)——纯逻辑,node 环境。
import { describe, expect, it } from 'vitest'
import { DATA } from '../../playground/prototype/data'
import { MOCK_DELAY, queryRows } from '../../playground/prototype/fetcher'
import { applyCommon, cmp, delay, pageSlice } from '../../playground/prototype/backends/memory'
import { DAY_MS, dayTs, hash32, isoDay, mulberry32 } from '../../playground/prototype/data/rand'
import { MATERIAL_COLS, materialCols } from '../../playground/prototype/modules/shared/materialCols'
import {
  deptOptions,
  ownerOptions,
  statusOptions,
} from '../../playground/prototype/modules/shared/options'
import { OPS_BY_TYPE, opsOf } from '../../playground/prototype/modules/shared/ops'
import { moreOptions, protoToolbar } from '../../playground/prototype/modules/shared/toolbar'
import { translate } from '../../playground/prototype/i18n'

MOCK_DELAY.ms = 0
const idT = (s: string) => s
const enT = (s: string) => translate(s)
const label = (l: string | (() => string)) => (typeof l === 'function' ? l() : l)

describe('ops.ts:比较符与原型 OPS_BY_TYPE 一致', () => {
  it('四组长度 11 / 10 / 8 / 6,元素逐个一致', () => {
    expect(OPS_BY_TYPE.text).toEqual([
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
    ])
    expect(OPS_BY_TYPE.number).toEqual([
      'equal',
      'notEqual',
      'gt',
      'gte',
      'lt',
      'lte',
      'isNull',
      'isNotNull',
      'in',
      'notIn',
    ])
    expect(OPS_BY_TYPE.date).toEqual([
      'equal',
      'notEqual',
      'gt',
      'gte',
      'lt',
      'lte',
      'isNull',
      'isNotNull',
    ])
    expect(OPS_BY_TYPE.select).toEqual(['equal', 'notEqual', 'in', 'notIn', 'isNull', 'isNotNull'])
    expect(
      [OPS_BY_TYPE.text, OPS_BY_TYPE.number, OPS_BY_TYPE.date, OPS_BY_TYPE.select].map(
        (a) => a.length,
      ),
    ).toEqual([11, 10, 8, 6])
  })
  it('opsOf 返回拷贝', () => {
    const a = opsOf('select')
    a.push('gt')
    expect(OPS_BY_TYPE.select).toHaveLength(6)
  })
})

describe('options.ts', () => {
  it('状态语义色 success / warning / default;label 是函数,随 t 求值', () => {
    const o = statusOptions(enT)
    expect(o.map((x) => [x.value, x.tagType])).toEqual([
      ['已审核', 'success'],
      ['未审核', 'warning'],
      ['已关闭', 'default'],
    ])
    expect(o.map((x) => label(x.label))).toEqual(['Approved', 'Pending', 'Closed'])
    expect(deptOptions(idT).map((x) => label(x.label))).toEqual(['采购部', '生产部', '仓储部'])
    expect(ownerOptions().map((x) => x.value)).toContain('张伟')
  })
})

describe('materialCols.ts', () => {
  const titleOf = (c: any) => (typeof c.title === 'function' ? c.title() : c.title)
  it('7 个数据列顺序与宽度(原型 COLS):编码 112 / 名称 minWidth 176 / 负责人 88 / 状态 96 / 部门 88 / 金额 104 / 日期 112', () => {
    const cols = materialCols({ t: idT }) as any[]
    expect(cols.map((c) => c.key)).toEqual([
      'no',
      'name',
      'owner',
      'status',
      'dept',
      'amount',
      'bizDate',
    ])
    expect(cols.map((c) => c.width ?? `min${c.minWidth}`)).toEqual([
      112,
      'min176',
      88,
      96,
      88,
      104,
      112,
    ])
    expect(cols.map(titleOf)).toEqual(MATERIAL_COLS.map((c) => c.label))
    expect(cols.find((c) => c.key === 'amount')).toMatchObject({ align: 'right', format: 'money' })
    expect(cols.find((c) => c.key === 'status')).toMatchObject({ tag: true })
  })
  it('勾选 / 序号 / 操作列:前置固定左、后置固定右、操作列不可拖不进列设置;memo 是 hideInTable 的构造器专用列', () => {
    const cols = materialCols({
      t: idT,
      selection: true,
      index: true,
      memo: true,
      actions: () => 'x',
    }) as any[]
    expect(cols[0]).toMatchObject({ type: 'selection', width: 40, fixed: 'left' })
    expect(cols[1]).toMatchObject({ type: 'index', width: 64, fixed: 'left' })
    expect(cols.at(-1)).toMatchObject({
      key: 'actions',
      width: 120,
      fixed: 'right',
      resizable: false,
      hideInSetting: true,
    })
    expect(cols.at(-2)).toMatchObject({ key: 'memo', hideInTable: true })
  })
  it('构造器字段:每个数据列 search.actions = OPS_BY_TYPE[类型];search:false 时没有任何 search 键', () => {
    const cols = materialCols({ t: idT, memo: true }) as any[]
    const act = (k: string) => cols.find((c) => c.key === k).search.actions
    expect(act('no')).toEqual(OPS_BY_TYPE.text)
    expect(act('status')).toEqual(OPS_BY_TYPE.select)
    expect(act('dept')).toEqual(OPS_BY_TYPE.select)
    expect(act('amount')).toEqual(OPS_BY_TYPE.number)
    expect(act('bizDate')).toEqual(OPS_BY_TYPE.date)
    expect(act('memo')).toEqual(OPS_BY_TYPE.text)
    expect(cols.find((c) => c.key === 'amount').search).toMatchObject({ type: 'number' })
    expect(cols.find((c) => c.key === 'bizDate').search).toMatchObject({ type: 'date' })
    const none = materialCols({ t: idT, memo: true, search: false }) as any[]
    expect(none.every((c) => !c.search)).toBe(true)
  })
  it('keys 子集 + patch 逐列补丁;英文标题随 t', () => {
    const cols = materialCols({
      t: enT,
      keys: ['no', 'amount'],
      patch: { amount: { width: 200 } },
    }) as any[]
    expect(cols.map((c) => c.key)).toEqual(['no', 'amount'])
    expect(cols.map(titleOf)).toEqual(['Material Code', 'Amount'])
    expect(cols[1].width).toBe(200)
  })
})

describe('toolbar.ts', () => {
  it('protoToolbar 一律带 maximize;更多菜单 = 导出 / 导入 / 分隔线 / 下载导入模板', () => {
    expect(protoToolbar()).toEqual({ maximize: true })
    const more = moreOptions(idT)
    expect(protoToolbar({ more }).more).toBe(more)
    expect(more.map((o: any) => o.key)).toEqual(['export', 'import', 'd1', 'tpl'])
    expect((more[0] as any).label()).toBe('导出')
    expect((moreOptions(enT)[3] as any).label()).toBe('Download template')
  })
})

describe('data/rand.ts(原型同款确定性序列)', () => {
  it('mulberry32 同种子同序列、取值 [0,1);hash32 稳定;日期互转', () => {
    const a = mulberry32(42),
      b = mulberry32(42)
    const xs = [a(), a(), a()]
    expect(xs).toEqual([b(), b(), b()])
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true)
    expect(hash32('M1000-A')).toBe(hash32('M1000-A'))
    expect(hash32('M1000-A')).not.toBe(hash32('M1000-B'))
    expect(isoDay(dayTs('2026-09-29'))).toBe('2026-09-29')
    expect(dayTs('2026-09-30') - dayTs('2026-09-29')).toBe(DAY_MS)
  })
  it('与 data.ts 里的生成器同一序列(DATA 第 9 行起由 mulberry32(20260929) 生成,编码形如 M{4 位}…)', () => {
    expect(DATA[8].no).toMatch(/^M\d{4}(-[A-F])?$/)
  })
})

describe('backends/memory.ts', () => {
  const rows = Array.from({ length: 25 }, (_, i) => ({
    id: i + 1,
    name: i % 2 ? 'Beta' : 'alpha',
    amount: i * 10,
    memo: i % 5 === 0 ? '加急' : '',
    day: `2026-09-${String((i % 28) + 1).padStart(2, '0')}`,
  }))
  const p = (o: object = {}) => ({ page: 1, pageSize: 10, ...o }) as any

  it('pageSlice:首页 / 末页(不满)/ 越界(空,total 照实)', () => {
    expect(pageSlice(rows, p()).items.map((r) => r.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(pageSlice(rows, p({ page: 3 })).items).toHaveLength(5)
    const over = pageSlice(rows, p({ page: 9 }))
    expect(over.items).toEqual([])
    expect(over.total).toBe(25)
  })
  it('applyCommon:文本包含(忽略大小写)/ 数字等于(3 与 "3" 互认)/ daterange / 多选 / urgent / filters / 排序', () => {
    const fields = [
      { key: 'name', type: 'text' as const },
      { key: 'amount', type: 'number' as const },
      { key: 'day', type: 'date' as const },
    ]
    expect(applyCommon(rows, p({ name: 'ALP' }), { fields })).toHaveLength(13)
    expect(applyCommon(rows, p({ amount: '30' }), { fields }).map((r) => r.id)).toEqual([4])
    expect(
      applyCommon(rows, p({ day: ['2026-09-05', '2026-09-06'] }), { fields }).every(
        (r) => r.day >= '2026-09-05' && r.day <= '2026-09-06',
      ),
    ).toBe(true)
    expect(
      applyCommon(rows, p({ day: ['2026-09-27', null] }), { fields }).every(
        (r) => r.day >= '2026-09-27',
      ),
    ).toBe(true)
    expect(applyCommon(rows, p({ amount: [10, 20] }), { fields }).map((r) => r.id)).toEqual([2, 3])
    expect(applyCommon(rows, p({ urgent: true }), { fields }).every((r) => r.memo === '加急')).toBe(
      true,
    )
    expect(applyCommon(rows, p({ urgent: false }), { fields })).toHaveLength(25)
    const f = [{ field: 'amount', logic: 'and', conditions: [{ action: 'gt', value: 200 }] }]
    expect(applyCommon(rows, p({ filters: f }), {}).map((r) => r.id)).toEqual([22, 23, 24, 25])
    const sorted = applyCommon(rows, p({ sorts: [{ field: 'amount', order: 'desc' }] }), {})
    expect(sorted[0].id).toBe(25)
    expect(rows[0].id).toBe(1) // 不改源数组
    const byRank = applyCommon(rows, p({ sortField: 'name', sortOrder: 'asc' }), {
      sortVal: (r, field) => (field === 'name' ? (r.name === 'Beta' ? 0 : 1) : (r as any)[field]),
    })
    expect(byRank[0].name).toBe('Beta')
  })
  it('与 fetcher.ts 的 queryRows 对同一组参数结果一致(语义同源)', () => {
    const fields = [
      { key: 'no', type: 'text' as const },
      { key: 'owner', type: 'text' as const },
      { key: 'status', type: 'select' as const },
      { key: 'dept', type: 'select' as const },
      { key: 'amount', type: 'number' as const },
      { key: 'bizDate', type: 'date' as const },
      { key: 'memo', type: 'text' as const },
    ]
    const cases = [
      { no: 'm10' },
      { status: '已关闭', dept: '生产部' },
      { owner: ['张伟', '李娜'] },
      { bizDate: ['2026-09-01', '2026-09-30'] },
      { urgent: true },
      { amount: '12800' },
    ]
    for (const c of cases)
      expect(applyCommon(DATA, c as any, { fields }).map((r) => r.no)).toEqual(
        queryRows(c as any).map((r) => r.no),
      )
  })
  it('cmp 与 delay', async () => {
    expect([cmp(3, '3'), cmp('b', 'a'), cmp('a', 'b'), cmp('', 0)]).toEqual([0, 1, -1, -1])
    const t0 = Date.now()
    await delay(0)
    await delay(30)
    expect(Date.now() - t0).toBeGreaterThanOrEqual(25)
  })
})
