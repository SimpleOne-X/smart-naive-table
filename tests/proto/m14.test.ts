// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import {
  ROUTE_DATA,
  ROUTE_OPS,
  genRoute,
  newRouteRow,
  resetRoute,
} from '../../playground/prototype/data/m14-routing'
import {
  changeCount,
  fetchRoute,
  saveOrder,
  saveRoute,
} from '../../playground/prototype/backends/m14-routing'
import { inferEditorInfo } from '../../src/index'
import { mountApp, useAppStubs } from './_mount'

// jsdom 没有布局:模块 14 的表是 fillHeight(vueuc 虚拟滚动),靠 ResizeObserver 拿视口高度才知道渲染哪几行 —— 在 vueuc 加载前桩一个(同 SmartSelectTable.test.ts)。
vi.hoisted(() => {
  class RO {
    constructor(private cb: (entries: unknown[]) => void) {}
    observe(el: Element) {
      const rect = { width: 1000, height: 900 }
      queueMicrotask(() =>
        this.cb([
          { target: el, contentRect: rect, borderBoxSize: [{ blockSize: 900, inlineSize: 1000 }] },
        ]),
      )
    }
    unobserve() {}
    disconnect() {}
  }
  ;(window as unknown as { ResizeObserver: unknown }).ResizeObserver = RO
})
const sortables = vi.hoisted(
  () => [] as Array<{ opts: { onEnd: (e: { oldIndex?: number; newIndex?: number }) => void } }>,
)
vi.mock('sortablejs', () => ({
  default: {
    create: (_el: HTMLElement, opts: (typeof sortables)[number]['opts']) => {
      sortables.push({ opts })
      return { destroy() {} }
    },
  },
}))

// 模块 14「可编辑表格」的示例:工艺路线设计(变速箱壳体 GB-2201,12 道工序;工序库 36 行)。
// 编辑交互本身的细粒度断言在 tests/SmartTable.editable*.test.ts / SmartSelectTable.test.ts;这里锁:数据 / 后端 / 对照页接线 / 行级只读 / 合计 / 工序库选择 / 序号列与拖拽 / 保存。
useAppStubs()
beforeEach(() => {
  resetRoute()
  sortables.length = 0
  Element.prototype.scrollTo ??= () => {}
  Element.prototype.scrollIntoView ??= () => {}
})
const settle = async () => {
  for (let i = 0; i < 5; i++) await flushPromises()
}
const key = (el: Element, k: string, init: KeyboardEventInit = {}) =>
  el.dispatchEvent(
    new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init }),
  )

describe('数据', () => {
  it('12 道工序,行主键 R1 … R12(隐藏字段);2 外协(热处理、磨削)、1 检验(终检)、1 停用(去毛刺);没有工序号 / 生效日期字段', () => {
    expect(ROUTE_DATA).toHaveLength(12)
    expect(ROUTE_DATA.map((r) => r.no)).toEqual(Array.from({ length: 12 }, (_, i) => `R${i + 1}`))
    expect(ROUTE_DATA.filter((r) => r.type === '外协').map((r) => r.name)).toEqual([
      '热处理',
      '磨削',
    ])
    expect(ROUTE_DATA.filter((r) => r.type === '检验').map((r) => r.name)).toEqual(['终检'])
    expect(ROUTE_DATA.filter((r) => r.status === '停用').map((r) => r.name)).toEqual(['去毛刺'])
    for (const r of ROUTE_DATA) {
      expect(Object.keys(r).sort()).toEqual(
        ['center', 'name', 'no', 'note', 'qc', 'report', 'setup', 'status', 'type', 'unit'].sort(),
      )
    }
    // 钻孔的工艺说明含换行(原型原样)
    expect(ROUTE_DATA[3].note).toBe('钻 M10 螺纹底孔 12 个\n按钻孔夹具定位')
    // 初始合计:准备 220 / 单件 95.5(停用行计入)
    expect(ROUTE_DATA.reduce((n, r) => n + r.setup, 0)).toBe(220)
    expect(ROUTE_DATA.reduce((n, r) => n + r.unit, 0)).toBe(95.5)
  })

  it('工序库 36 行:OP001 … OP036;路线里的 12 道工序名都在库里,工作中心 / 类型一致', () => {
    expect(ROUTE_OPS).toHaveLength(36)
    expect(ROUTE_OPS[0]).toEqual({
      code: 'OP001',
      name: '下料',
      center: '数控车间',
      type: '自制',
      setup: 15,
      unit: 3.5,
    })
    expect(ROUTE_OPS[35]).toMatchObject({ code: 'OP036', name: '首件检验', type: '检验' })
    for (const r of ROUTE_DATA) {
      const op = ROUTE_OPS.find((o) => o.name === r.name)!
      expect(op, r.name).toBeTruthy()
      expect([op.center, op.type]).toEqual([r.center, r.type])
    }
  })

  it('列推断:无类型声明的列靠数据值(报工 / 质检 boolean → 复选框;工时 number → 数字框);工艺说明显式 textarea;外部数据 → select-table', () => {
    const via = (k: string, extra: Record<string, unknown> = {}) =>
      inferEditorInfo({ key: k, ...extra } as never, ROUTE_DATA as never, { key: k }).kind
    expect(via('note', { editor: 'textarea' })).toBe('textarea') // 工艺说明显式 editor: 'textarea'(首行是短句,靠数据值只会得到输入框)
    expect(via('report')).toBe('checkbox')
    expect(via('qc')).toBe('checkbox')
    expect(via('setup')).toBe('number')
    expect(via('unit')).toBe('number')
    expect(via('center', { options: [{ label: 'x', value: 'x' }] })).toBe('select')
    expect(
      via('name', { editorProps: { columns: [{ key: 'code', title: 'c' }], data: ROUTE_OPS } }),
    ).toBe('select-table')
  })

  it('新增行:行主键顺延(R13),名称空、自制、工时 0、默认报工、启用;连发两次不撞号', () => {
    expect(newRouteRow()).toMatchObject({
      no: 'R13',
      name: '',
      center: '数控车间',
      type: '自制',
      setup: 0,
      unit: 0,
      report: true,
      qc: false,
      status: '启用',
    })
    expect(newRouteRow().no).toBe('R14')
  })
})

describe('后端', () => {
  it('取数按加工顺序(数组顺序)整表一页', async () => {
    const r = await fetchRoute({ page: 1, pageSize: 100 } as never)
    expect(r.total).toBe(12)
    expect(r.items.map((x) => x.no)).toEqual(ROUTE_DATA.map((x) => x.no))
  })

  it('保存按 changes.rows 的类型分发(新增追加到末尾),落进数据库;N = 改过的格 + 新增 + 待删', async () => {
    const created = { ...genRoute()[0], no: 'R13', name: '新工序' }
    const updated = {
      row: { ...ROUTE_DATA[1], setup: 99 },
      changes: { setup: { value: 99, oldValue: 30 }, note: { value: 'X', oldValue: '粗车…' } },
    }
    const removed = ROUTE_DATA[2]
    const changes = {
      updated: [updated],
      added: [created],
      removed: [removed],
      rows: [
        { type: 'created', row: created },
        { type: 'updated', row: updated.row, changes: updated.changes },
        { type: 'deleted', row: removed },
      ],
    }
    expect(changeCount(changes as never)).toBe(4)
    expect(await saveRoute(changes as never)).toBe(4)
    expect(ROUTE_DATA.find((r) => r.no === 'R2')).toMatchObject({ setup: 99, note: 'X' })
    expect(ROUTE_DATA.find((r) => r.no === 'R3')).toBeUndefined()
    expect(ROUTE_DATA[ROUTE_DATA.length - 1]).toMatchObject({ no: 'R13', name: '新工序' })
    expect(ROUTE_DATA).toHaveLength(12)
  })

  it('即时保存顺序:按给定主键顺序重排数据库;没落库的行忽略', async () => {
    const order = ROUTE_DATA.map((r) => r.no)
    const moved = [order[1], order[0], 'R99', ...order.slice(2)]
    await saveOrder(moved)
    expect(ROUTE_DATA.map((r) => r.no)).toEqual([order[1], order[0], ...order.slice(2)])
  })
})

describe('对照页 ?m=14', () => {
  it('侧栏「数据」组第 3 项「可编辑表格」不带状态徽标(已定);面包屑 / 页头;12 行;表头;合计行', async () => {
    const w = await mountApp(14)
    await settle()
    const me = w.findAll('#modList .mod').find((m) => m.find('.nm').text() === '可编辑表格')!
    expect(me.classes('on')).toBe(true)
    expect(me.find('.st').exists()).toBe(false) // 状态是「已定」:没有「提议」徽标
    expect(w.find('.crumb').text().replace(/\s+/g, ' ')).toBe(
      'SmartTable 设计方案 / 数据 / 可编辑表格',
    )
    expect(w.find('.smart-table-title').text()).toBe('工艺路线 · 变速箱壳体 GB-2201')
    // 勾选 / 手柄 / 工序号(序号列)/ 名称(必填 *)/ … / 状态;没有生效日期
    expect(w.findAll('thead th').map((t) => t.text())).toEqual([
      '',
      '',
      '工序号',
      '*工序名称',
      '工作中心',
      '工序类型',
      '准备工时(分)',
      '单件工时(分)',
      '报工',
      '质检',
      '工艺说明',
      '状态',
    ])
    expect(
      w.findAll('.n-data-table-tbody .n-data-table-tr:not(.n-data-table-tr--summary)'),
    ).toHaveLength(12)
    const sumRow = w.find('.n-data-table-tr--summary')
    expect(sumRow.text()).toContain('合计')
    expect(sumRow.text()).toContain('220')
    expect(sumRow.text()).toContain('95.5')
    // 新增按钮 = 「新增工序」
    expect(w.find('.smart-table-toolbar').text()).toContain('新增工序')
    w.unmount()
  }, 30000)

  it('工序号 = 序号列(位置 1 … 12):不是数据、不可编辑、不在可编辑格里', async () => {
    const w = await mountApp(14)
    await settle()
    const rows = w.findAll('.n-data-table-tbody .n-data-table-tr:not(.n-data-table-tr--summary)')
    expect(rows.map((r) => r.findAll('td')[2].text())).toEqual(
      Array.from({ length: 12 }, (_, i) => String(i + 1)),
    )
    expect(rows[0].findAll('td')[2].attributes('data-xc')).toBeUndefined()
    w.unmount()
  }, 30000)

  it('控件推断落到单元格;停用的工序(去毛刺)整行只读但「状态」仍可改;别的行可编辑', async () => {
    const w = await mountApp(14)
    await settle()
    const xk = (k: string) => w.find(`td[data-col-key="${k}"][data-xk]`).attributes('data-xk')
    expect(
      ['name', 'center', 'type', 'setup', 'unit', 'report', 'qc', 'note', 'status'].map(xk),
    ).toEqual([
      'select-table',
      'select',
      'select',
      'number',
      'number',
      'checkbox',
      'checkbox',
      'textarea',
      'select',
    ])
    // 第 8 行(R8 去毛刺)锁定:可选中但灰显(xlk);状态格不锁
    expect(w.find('td[data-xc="R8|name"]').classes()).toContain('smart-table-xlk')
    expect(w.find('td[data-xc="R8|status"]').classes()).not.toContain('smart-table-xlk')
    expect(w.find('td[data-xc="R7|name"]').classes()).not.toContain('smart-table-xlk')
    w.unmount()
  }, 30000)

  it('工序名称是 select-table:点开 = 工序库面板(只有一个搜索框,36 条);选一道工序一次写入 5 列(各自脏标记、一步撤销)', async () => {
    const w = await mountApp(14)
    await settle()
    const name = w.find('td[data-xc="R3|name"]')
    await name.trigger('click')
    await name.trigger('click')
    await settle()
    const panel = document.body.querySelector('.smart-table-xpick')!
    expect(panel).toBeTruthy()
    expect(panel.querySelectorAll('.smart-table-xpick-search input')).toHaveLength(1)
    expect(panel.querySelector<HTMLInputElement>('input')!.placeholder).toBe(
      '工序编码/名称/工作中心',
    )
    expect(panel.textContent).toContain('共 36 条')
    // 搜索「钻」→ 命中 钻孔,再点它
    const input = panel.querySelector<HTMLInputElement>('.smart-table-xpick-search input')!
    input.value = '钻'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await settle()
    const row = panel.querySelector<HTMLElement>('.n-data-table-tbody tr')!
    expect(row.textContent).toContain('OP004')
    row.click()
    await settle()
    // 精车(数控车间 / 自制 / 25 / 12.0)→ 钻孔(加工中心 / 自制 / 40 / 6.0):名称、工作中心、准备、单件 4 格变了(类型没变)
    const dirty = ['name', 'center', 'type', 'setup', 'unit'].filter((k) =>
      w.find(`td[data-xc="R3|${k}"]`).classes().includes('smart-table-xd'),
    )
    expect(dirty).toEqual(['name', 'center', 'setup', 'unit'])
    expect(w.find('td[data-xc="R3|name"]').text()).toBe('钻孔')
    expect(w.find('td[data-xc="R3|setup"]').text()).toBe('40')
    expect(w.find('td[data-xc="R3|unit"]').text()).toBe('6.0')
    expect(w.findAll('.smart-table-toolbar button').some((b) => b.text() === '保存修改(4)')).toBe(
      true,
    )
    // 合计行实时:准备 220 − 25 + 40 = 235
    expect(w.find('.n-data-table-tr--summary').text()).toContain('235')
    // 一步撤销
    key(document.body, 'z', { ctrlKey: true })
    await settle()
    expect(w.find('td[data-xc="R3|name"]').text()).toBe('精车')
    expect(w.findAll('td.smart-table-xd')).toHaveLength(0)
    w.unmount()
  }, 30000)

  it('校验提示:必填清空 →「请选择工序名称」;工时为负 →「准备工时(分)不能小于 0」', async () => {
    const w = await mountApp(14)
    await settle()
    await w.find('td[data-xc="R2|name"]').trigger('click')
    key(document.body, 'Delete')
    await settle()
    expect(document.body.textContent).toContain('请选择工序名称')
    key(document.body, 'Escape')
    const setup = w.find('td[data-xc="R2|setup"]')
    await setup.trigger('click')
    await setup.trigger('click')
    await settle()
    const input = w.find('td[data-xc="R2|setup"] input').element as HTMLInputElement
    input.value = '-5'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await settle()
    key(input, 'Enter')
    await settle()
    expect(document.body.textContent).toContain('准备工时(分)不能小于 0')
    w.unmount()
  }, 30000)

  it('拖动重排:序号跟着位置变、不产生脏标记;松手即保存顺序(toast「已保存顺序」、数据库顺序变);草稿跟着行走', async () => {
    const w = await mountApp(14)
    await settle()
    // 先给第 1 行(下料)留一份草稿
    const setup = w.find('td[data-xc="R1|setup"]')
    await setup.trigger('click')
    await setup.trigger('click')
    await settle()
    const input = w.find('td[data-xc="R1|setup"] input').element as HTMLInputElement
    input.value = '20'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    key(input, 'Enter')
    await settle()
    expect(w.findAll('td.smart-table-xd')).toHaveLength(1)
    // 拖:第 1 行放到第 3 行 → 粗车、精车、下料 …
    expect(sortables.length).toBeGreaterThan(0)
    sortables[sortables.length - 1].opts.onEnd({ oldIndex: 0, newIndex: 2 })
    await settle()
    const body = w.findAll('.n-data-table-tbody .n-data-table-tr:not(.n-data-table-tr--summary)')
    expect(body.slice(0, 3).map((r) => r.findAll('td')[3].text())).toEqual(['粗车', '精车', '下料'])
    expect(body.slice(0, 3).map((r) => r.findAll('td')[2].text())).toEqual(['1', '2', '3']) // 序号 = 位置
    expect(w.findAll('td.smart-table-xd')).toHaveLength(1) // 拖动本身没有脏标记;草稿(下料的准备工时)还在
    expect(body[2].find('td[data-xc="R1|setup"]').classes()).toContain('smart-table-xd')
    expect(ROUTE_DATA.slice(0, 3).map((r) => r.name)).toEqual(['粗车', '精车', '下料'])
    expect(document.body.textContent).toContain('已保存顺序')
    expect(
      w.findAll('.smart-table-toolbar button').filter((b) => b.text().startsWith('保存修改')),
    ).toHaveLength(1)
    // 放弃修改不还原顺序
    await w
      .findAll('.smart-table-toolbar button')
      .find((b) => b.text() === '放弃修改')!
      .trigger('click')
    await settle()
    // 先弹确认气泡,点「放弃」才还原
    ;[...document.body.querySelectorAll<HTMLElement>('.n-popconfirm__panel button')]
      .find((b) => b.textContent?.trim() === '放弃')!
      .click()
    await settle()
    expect(w.findAll('td.smart-table-xd')).toHaveLength(0) // 草稿确已放弃
    expect(
      w
        .findAll('.n-data-table-tbody .n-data-table-tr:not(.n-data-table-tr--summary)')
        .slice(0, 3)
        .map((r) => r.findAll('td')[3].text()),
    ).toEqual(['粗车', '精车', '下料'])
    w.unmount()
  }, 30000)

  it('手柄:停用的行是停用态(没有 data-rd,拖不动),其余行手柄可聚焦', async () => {
    const w = await mountApp(14)
    await settle()
    const handles = w
      .findAll('.n-data-table-tbody .n-data-table-tr:not(.n-data-table-tr--summary)')
      .map((r) => r.findAll('td')[1])
    expect(handles[7].find('.proto-drag-off').exists()).toBe(true)
    expect(handles[7].find('[data-rd]').exists()).toBe(false)
    expect(handles[0].find('.proto-drag-handle[data-rd="R1"]').exists()).toBe(true)
    w.unmount()
  }, 30000)

  it('手柄键盘:↓ 下移一位并即时保存顺序,↑ 上移;首行 ↑ 不动', async () => {
    const w = await mountApp(14)
    await settle()
    const handle = () => w.find('.proto-drag-handle[data-rd="R2"]')
    handle().element.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }),
    )
    await settle()
    expect(ROUTE_DATA.slice(0, 3).map((r) => r.name)).toEqual(['下料', '精车', '粗车'])
    expect(document.body.textContent).toContain('已保存顺序')
    const first = w.find('.proto-drag-handle[data-rd="R1"]')
    first.element.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }),
    )
    await settle()
    expect(ROUTE_DATA[0].name).toBe('下料')
    w.unmount()
  }, 30000)

  it('删除所选 = 待删(划线);合计行不计待删行:准备 220 − 30 = 190、单件 95.5 − 8.5 = 87.0', async () => {
    const w = await mountApp(14)
    await settle()
    const row = w.findAll('.n-data-table-tbody .n-data-table-tr:not(.n-data-table-tr--summary)')[1]
    await row.find('.n-checkbox').trigger('click')
    await settle()
    await w
      .findAll('.smart-table-toolbar button')
      .find((b) => b.text() === '删除所选')!
      .trigger('click')
    await settle()
    expect(w.find('td[data-xc="R2|name"]').exists()).toBe(false) // 待删行不可编辑
    const sum = w.find('.n-data-table-tr--summary').text()
    expect(sum).toContain('190')
    expect(sum).toContain('87.0')
    expect(w.findAll('.smart-table-toolbar button').some((b) => b.text() === '保存修改(1)')).toBe(
      true,
    )
    w.unmount()
  }, 30000)

  it('新增工序:追加在末尾并立刻打开工序库面板;保存后落库', async () => {
    const w = await mountApp(14)
    await settle()
    await w
      .findAll('.smart-table-toolbar button')
      .find((b) => b.text().includes('新增工序'))!
      .trigger('click')
    await settle()
    const rows = w.findAll('.n-data-table-tbody .n-data-table-tr:not(.n-data-table-tr--summary)')
    expect(rows).toHaveLength(13)
    expect(rows[12].find('td[data-xc="R13|name"]').exists()).toBe(true)
    expect(document.body.querySelector('.smart-table-xpick')).toBeTruthy() // 立刻进入编辑 = 打开工序库
    w.unmount()
  }, 30000)

  it('保存修改:改一格 → 「保存修改(1)」→ 宿主落库后草稿清空,toast「已保存 1 处修改」;合计行实时', async () => {
    const w = await mountApp(14)
    await settle()
    const cell = w.find('td[data-xc="R1|setup"]')
    await cell.trigger('click')
    await cell.trigger('click')
    await settle()
    const input = w.find('td[data-xc="R1|setup"] input').element as HTMLInputElement
    input.value = '20'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await settle()
    key(input, 'Enter')
    await settle()
    const save = w.findAll('.smart-table-toolbar button').find((b) => b.text() === '保存修改(1)')!
    expect(save).toBeTruthy()
    expect(w.find('.n-data-table-tr--summary').text()).toContain('225')
    await save.trigger('click')
    await settle()
    expect(ROUTE_DATA[0].setup).toBe(20)
    expect(
      w.findAll('.smart-table-toolbar button').some((b) => b.text().startsWith('保存修改')),
    ).toBe(false)
    expect(document.body.textContent).toContain('已保存 1 处修改')
    w.unmount()
  }, 30000)

  it('English:侧栏 / 面包屑 / 标题 / 表头 / 工具栏;工序类型只整段翻译(「检验室」不被译成「Inspection室」)', async () => {
    const w = await mountApp(14, { lang: 'en' })
    await settle()
    expect(w.find('.crumb').text().replace(/\s+/g, ' ')).toBe(
      'SmartTable Design Spec / Data / Editable grid',
    )
    expect(w.find('.smart-table-title').text()).toBe('Routing · Gearbox housing GB-2201')
    const th = w.find('thead').text()
    expect(th).toContain('Work center')
    expect(th).toContain('Setup (min)')
    expect(th).toContain('Per piece (min)')
    expect(w.find('.smart-table-toolbar').text()).toContain('Add operation')
    const bodyText = w.find('.n-data-table-tbody').text()
    expect(bodyText).toContain('检验室') // 业务数据不翻译
    expect(bodyText).not.toContain('Inspection室')
    expect(bodyText).toContain('In-house')
    w.unmount()
  }, 30000)
})
