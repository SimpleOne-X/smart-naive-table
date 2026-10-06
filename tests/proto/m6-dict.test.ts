// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { NConfigProvider, NMessageProvider, zhCN } from 'naive-ui'
import { h } from 'vue'
import { DICT_DATA, DICT_DEPT, DICT_STATUS } from '../../playground/prototype/data/m6-dict'
import { DATA } from '../../playground/prototype/data'
import { dictColumns } from '../../playground/prototype/data/m6-columns'
import { fetchDict, queryDict } from '../../playground/prototype/backends/m6-dict'
import { MOCK_DELAY } from '../../playground/prototype/fetcher'
import ProtoApp from '../../playground/prototype/ProtoApp.vue'
import { SmartTable } from '../../src/index'
import type { SmartTableParams } from '../../src/types'

// 模块 6「字典、标签与格式化」:数据(编码 + 时间戳 + ISO 串 + null)、后端(字典编码 / 日期取值求值)、对照页的字典翻译 / 标签 / 格式化 / 空值占位 / 初始隐藏列。
MOCK_DELAY.ms = 0

const params = (p: Record<string, unknown> = {}) =>
  ({ page: 1, pageSize: 100, ...p }) as SmartTableParams
const cond = (field: string, action: string, value: unknown) => ({
  field,
  logic: 'and' as const,
  conditions: [{ action, value }],
})

describe('模块 6 数据(原型 DICT_DATA 同一份生成器)', () => {
  it('2000 行,与物料单据同一批;状态 / 部门存编码,日期是时间戳,创建时间是 ISO 串', () => {
    expect(DICT_DATA).toHaveLength(2000)
    expect(DICT_DATA[0]).toMatchObject({
      no: 'M1000-A',
      statusCode: 'approved',
      deptId: 1,
      amount: 12800,
      creator: '张伟',
      memo: '加急',
    })
    expect(DICT_DATA[0].bizTs).toBe(Date.UTC(2026, 8, 21))
    expect(DICT_DATA[0].createdAt).toBe('2026-09-21T12:31:14')
    expect(DICT_STATUS.map((o) => o.value)).toEqual(['approved', 'pending', 'closed'])
    expect(DICT_DEPT.map((o) => o.value)).toEqual([1, 2, 3])
  })

  it('空备注是 null(不是空串)——库只把 null / undefined 当「空」', () => {
    const empty = DATA.filter((r) => !r.memo).length
    expect(empty).toBeGreaterThan(0)
    expect(DICT_DATA.filter((r) => r.memo === null)).toHaveLength(empty)
    expect(DICT_DATA.some((r) => r.memo === '')).toBe(false)
  })
})

describe('模块 6 后端', () => {
  it('分页:每页 100,total 2000', async () => {
    const r = await fetchDict(params())
    expect(r.items).toHaveLength(100)
    expect(r.total).toBe(2000)
  })

  it('字典编码求值:状态 = pending;部门 in [1,2](数字与字符串数字互认)', () => {
    const p = queryDict({ filters: [cond('statusCode', 'equal', 'pending')] })
    expect(p.length).toBeGreaterThan(0)
    expect(p.every((r) => r.statusCode === 'pending')).toBe(true)
    const d = queryDict({ filters: [cond('deptId', 'in', ['1', '2'])] })
    expect(d.every((r) => r.deptId === 1 || r.deptId === 2)).toBe(true)
    expect(d.length).toBe(DICT_DATA.filter((r) => r.deptId !== 3).length)
  })

  it('日期字段按「条件的值形式」求值:单据日期(时间戳)取 YYYY-MM-DD,创建时间(ISO 串)取日期部分', () => {
    const b = queryDict({ filters: [cond('bizTs', 'equal', '2026-09-21')] })
    expect(b.length).toBeGreaterThan(0)
    expect(b.every((r) => r.bizTs === Date.UTC(2026, 8, 21))).toBe(true)
    const c = queryDict({ filters: [cond('createdAt', 'equal', '2026-09-21')] })
    expect(c.map((r) => r.no).sort()).toEqual(b.map((r) => r.no).sort())
    const range = queryDict({
      filters: [cond('bizTs', 'gte', '2026-09-20'), cond('bizTs', 'lte', '2026-09-21')],
    })
    expect(
      range.every((r) => r.bizTs >= Date.UTC(2026, 8, 20) && r.bizTs <= Date.UTC(2026, 8, 21)),
    ).toBe(true)
  })

  it('空值:备注 isNull 命中 null 行', () => {
    const n = queryDict({ filters: [cond('memo', 'isNull', null)] })
    expect(n).toHaveLength(DICT_DATA.filter((r) => r.memo === null).length)
  })
})

describe('模块 6 对照页(ProtoApp ?m=6:真实库渲染)', () => {
  // m6 是 fillHeight(官方虚拟滚动):jsdom 没有布局,vueuc 虚拟列表一行都不画,所以行级断言用同一份列声明(data/m6-columns.ts)
  // 挂不开 fillHeight 的 SmartTable;ProtoApp ?m=6 本身只断言标题 / 表头 / 列属性。
  const real = { matchMedia: window.matchMedia, ResizeObserver: (globalThis as any).ResizeObserver }
  beforeEach(() => {
    window.matchMedia = ((q: string) => ({
      matches: false,
      media: q,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
    })) as any
    ;(globalThis as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  })
  afterEach(() => {
    window.matchMedia = real.matchMedia
    ;(globalThis as any).ResizeObserver = real.ResizeObserver
    MOCK_DELAY.ms = 0
    document.body.innerHTML = ''
  })

  const t = (s: string) => s
  async function mountTable() {
    const w = mount(
      {
        render: () =>
          h(NConfigProvider, { locale: zhCN }, () =>
            h(NMessageProvider, null, () =>
              h(SmartTable as any, {
                columns: dictColumns(t),
                fetcher: fetchDict,
                rowKey: 'no',
                title: '物料字典',
                search: { container: 'table' },
              }),
            ),
          ),
      },
      { attachTo: document.body },
    )
    for (let i = 0; i < 10; i++) {
      await flushPromises()
      if (w.findAll('.n-data-table-tbody .n-data-table-tr').length > 3) break
      await new Promise((r) => setTimeout(r, 20))
    }
    return w
  }
  const cellsOf = (w: ReturnType<typeof mount>, row: number) =>
    w
      .findAll('.n-data-table-tbody .n-data-table-tr')
      [row].findAll('td')
      .map((td) => td.text())

  it('ProtoApp ?m=6:没有工具栏标题(设计 §2.14);表头无勾选列、无操作列,创建人初始隐藏', async () => {
    history.replaceState(null, '', '/prototype.html?m=6&theme=light')
    const w = mount(ProtoApp, { attachTo: document.body })
    for (let i = 0; i < 10; i++) {
      await flushPromises()
      if (w.find('.n-data-table').exists() && w.findAll('thead th').length > 3) break
      await new Promise((r) => setTimeout(r, 20))
    }
    expect(w.find('.smart-table-title').exists()).toBe(false) // 单表模块工具栏不画表名(设计 §2.14:页顶已有页面标题)
    expect(w.findAll('thead th').map((th) => th.text())).toEqual([
      '序号',
      '物料编码',
      '物料名称',
      '单据状态',
      '部门',
      '金额',
      '单据日期',
      '创建时间',
      '距今',
      '备注',
    ])
    expect(w.find('thead .n-checkbox').exists()).toBe(false)
    expect(
      (w.findComponent(SmartTable as any) as any)
        .props('columns')
        .find((c: any) => c.key === 'creator'),
    ).toMatchObject({ hide: true })
    w.unmount()
  })

  it('字典 / 格式化:状态编码 → label 徽标,部门编码 → label,金额千分位两位小数,时间戳 → 日期,ISO 串 → 日期时间,距今 = 函数格式', async () => {
    const w = await mountTable()
    await new Promise((r) => setTimeout(r, 30))
    await flushPromises()
    // 序号 | 编码 | 名称 | 状态 | 部门 | 金额 | 单据日期 | 创建时间 | 距今 | 备注
    expect(cellsOf(w, 0)).toEqual([
      '1',
      'M1000-A',
      '不锈钢法兰',
      '已审核',
      '采购部',
      '12,800.00',
      '2026-09-21',
      '2026-09-21 12:31:14',
      '8 天前',
      '加急',
    ])
    expect(cellsOf(w, 2)[3]).toBe('未审核')
    expect(cellsOf(w, 3)[3]).toBe('已关闭')
    const rows = w.findAll('.n-data-table-tbody .n-data-table-tr')
    // 语义色:NTag 的 type 落在行内 CSS 变量里(--n-color / --n-text-color),已审核(success)≠ 未审核(warning)≠ 已关闭(default),同状态同色
    const tagStyle = (i: number) => rows[i].find('.n-tag').attributes('style')
    expect(tagStyle(0)).toBe(tagStyle(1)) // 两行都是已审核
    expect(new Set([tagStyle(0), tagStyle(2), tagStyle(3)]).size).toBe(3)
    w.unmount()
  })

  it('空值占位:备注为 null 的行显示「—」', async () => {
    const w = await mountTable()
    expect(cellsOf(w, 1)[9]).toBe('—')
    w.unmount()
  })

  it('异步字典:部门字典回来之前显示原始编码,回来后翻成 label', async () => {
    MOCK_DELAY.ms = 1 // 部门字典 900ms 后才回(其余请求几乎不等)
    const w = await mountTable()
    expect(cellsOf(w, 0)[4]).toBe('1')
    await new Promise((r) => setTimeout(r, 1100))
    await flushPromises()
    expect(cellsOf(w, 0)[4]).toBe('采购部')
    w.unmount()
  })
})
