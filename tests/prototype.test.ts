// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { h } from 'vue'
import { NConfigProvider, zhCN } from 'naive-ui'
import {
  CSV_HEAD,
  DATA,
  FIELD_DEFS,
  MONTH_RANGE,
  addRow,
  approveRows,
  createRow,
  blankForm,
  delRow,
  delRows,
  rowsToCsv,
  updateRow,
} from '../playground/prototype/data'
import { MOCK_DELAY, fetchRows, queryRows } from '../playground/prototype/fetcher'
import ProtoApp from '../playground/prototype/ProtoApp.vue'
import ConditionBar from '../src/ConditionBar.vue'
import { SmartTable } from '../src/index'
import type { SmartTableParams } from '../src/types'

// 原型对照页(prototype.html)的「后端」与页面:它是逐项对比原型与真实库的工具,
// 数据生成器与原型 docs/smart-naive-table-design.html 是同一份(2000 行、确定性伪随机),
// 这里锁住它,免得改库时顺手改坏了对照页的数据而不自知。

MOCK_DELAY.ms = 0 // 单测不等 420ms

const params = (p: Record<string, unknown> = {}) =>
  ({ page: 1, pageSize: 100, ...p }) as SmartTableParams

describe('对照页数据(与原型同一份生成器)', () => {
  it('2000 行,前 8 行是原型的 DATA_BASE,编码不重复', () => {
    expect(DATA).toHaveLength(2000)
    expect(DATA[0]).toMatchObject({
      no: 'M1000-A',
      name: '不锈钢法兰',
      status: '已审核',
      dept: '采购部',
      amount: 12800,
    })
    expect(DATA[7].no).toBe('M1099')
    expect(new Set(DATA.map((r) => r.no)).size).toBe(2000)
  })

  it('FIELD_DEFS 是原型的 8 个字段(含只出现在搜索里的「备注」)', () => {
    expect(FIELD_DEFS.map((f) => f.key)).toEqual([
      'no',
      'name',
      'owner',
      'status',
      'dept',
      'amount',
      'bizDate',
      'memo',
    ])
  })

  it('addRow 把「新建物料」放最前并返回编码;delRow 删掉它', () => {
    const before = DATA.length
    const no = addRow()
    expect(no).toBe('M1000-D')
    expect(DATA[0]).toMatchObject({ no, name: '新建物料', status: '未审核' })
    expect(DATA).toHaveLength(before + 1)
    expect(delRow(no)).toBe(true)
    expect(delRow(no)).toBe(false)
    expect(DATA).toHaveLength(before)
  })
})

describe('对照页的「后端」fetchRows', () => {
  it('分页:第 1 页取 100 行,total 是全部 2000', async () => {
    const r = await fetchRows(params())
    expect(r.items).toHaveLength(100)
    expect(r.total).toBe(2000)
    expect(r.items[0].no).toBe('M1000-A')
    const p2 = await fetchRows(params({ page: 2 }))
    expect(p2.items[0].no).toBe(DATA[100].no)
  })

  it('搜索:文本字段是包含(忽略大小写),下拉 / 数字 / 日期是等于', async () => {
    const byNo = await fetchRows(params({ no: 'm1000' }))
    expect(byNo.items.length).toBeGreaterThan(0)
    expect(byNo.items.every((r) => r.no.toLowerCase().includes('m1000'))).toBe(true)
    const byStatus = await fetchRows(params({ status: '已关闭' }))
    expect(byStatus.total).toBe(DATA.filter((r) => r.status === '已关闭').length)
    const byAmount = await fetchRows(params({ amount: '12800' }))
    expect(byAmount.items.every((r) => r.amount === 12800)).toBe(true)
  })

  it('列头过滤:用库导出的 matchFilterValue 求值(物料编码 包含 M10 或 包含 M20)', async () => {
    const r = await fetchRows(
      params({
        filters: [
          {
            field: 'no',
            logic: 'or',
            conditions: [
              { action: 'contains', value: 'M10' },
              { action: 'contains', value: 'M20' },
            ],
          },
        ],
        pageSize: 1000,
      }),
    )
    expect(r.total).toBe(DATA.filter((x) => x.no.includes('M10') || x.no.includes('M20')).length)
    expect(r.items.every((x) => x.no.includes('M10') || x.no.includes('M20'))).toBe(true)
  })

  it('多列排序:sorts 里靠前的优先(部门升序,同部门按金额降序)', async () => {
    const r = await fetchRows(
      params({
        pageSize: 1000,
        sortField: 'dept',
        sortOrder: 'asc',
        sorts: [
          { field: 'dept', order: 'asc' },
          { field: 'amount', order: 'desc' },
        ],
      }),
    )
    for (let i = 1; i < r.items.length; i++) {
      const a = r.items[i - 1]
      const b = r.items[i]
      const c = a.dept.localeCompare(b.dept, 'zh')
      expect(c <= 0).toBe(true)
      if (c === 0) expect(a.amount >= b.amount).toBe(true)
    }
  })

  it('单列排序:只带 sortField / sortOrder 也认', async () => {
    const r = await fetchRows(params({ sortField: 'amount', sortOrder: 'desc' }))
    expect(r.items[0].amount).toBe(Math.max(...DATA.map((x) => x.amount)))
  })
})

describe('对照页「后端」补的原型搜索语义(daterange / 多选 / 加急)与导出', () => {
  it('默认「本月」(单据日期 2026-09-01 ~ 2026-09-30)→ 模块 1 总数 214,与原型一致', async () => {
    const r = await fetchRows(params({ bizDate: [...MONTH_RANGE] }))
    expect(r.total).toBe(214)
    expect(r.items.every((x) => x.bizDate >= MONTH_RANGE[0] && x.bizDate <= MONTH_RANGE[1])).toBe(
      true,
    )
    expect(r.items[0].no).toBe('M1000-A')
  })

  it('daterange 空端不限;负责人多选 = in;仅看加急(urgent=true)= 备注等于「加急」,false 不过滤', async () => {
    const openEnd = await fetchRows(params({ bizDate: ['2026-09-01', null] }))
    expect(openEnd.total).toBe(DATA.filter((x) => x.bizDate >= '2026-09-01').length)
    const multi = await fetchRows(params({ owner: ['张伟', '李娜'] }))
    expect(multi.total).toBe(DATA.filter((x) => x.owner === '张伟' || x.owner === '李娜').length)
    const urgent = await fetchRows(params({ urgent: true, bizDate: [...MONTH_RANGE] }))
    expect(urgent.items.length).toBeGreaterThan(0)
    expect(urgent.items.every((x) => x.memo === '加急')).toBe(true)
    expect((await fetchRows(params({ urgent: false }))).total).toBe(2000)
  })

  it('「我负责的」/ 自定义面板写的过滤:单条 equal 与 in 都经 matchFilterValue 求值', async () => {
    const eq = await fetchRows(
      params({
        filters: [
          { field: 'owner', logic: 'and', conditions: [{ action: 'equal', value: '张伟' }] },
        ],
      }),
    )
    expect(eq.total).toBe(DATA.filter((x) => x.owner === '张伟').length)
    const inn = await fetchRows(
      params({
        filters: [
          { field: 'owner', logic: 'and', conditions: [{ action: 'in', value: ['张伟', '李娜'] }] },
        ],
      }),
    )
    expect(inn.total).toBe(DATA.filter((x) => x.owner === '张伟' || x.owner === '李娜').length)
  })

  it('导出 = 按当前条件取全部行(不分页),金额两位小数,首行是表头', () => {
    const rows = queryRows({ bizDate: [...MONTH_RANGE] })
    expect(rows).toHaveLength(214)
    const lines = rowsToCsv(rows).split('\r\n')
    expect(lines).toHaveLength(215)
    expect(lines[0]).toBe(CSV_HEAD.map((h) => `"${h}"`).join(','))
    expect(lines[1]).toBe(
      '"M1000-A","不锈钢法兰","张伟","已审核","采购部","12800.00","2026-09-21","加急"',
    )
  })

  it('新增 / 编辑的业务规则:编码唯一(重复抛错),编辑可改编码并就地更新', () => {
    const before = DATA.length
    expect(() => createRow({ ...blankForm(), no: 'M1024', name: '重复' })).toThrow(
      '物料编码 M1024 已存在',
    )
    expect(DATA).toHaveLength(before)
    createRow({ ...blankForm(), no: 'ZZ-T1', name: '测试新增', amount: 5 })
    expect(DATA[0]).toMatchObject({
      no: 'ZZ-T1',
      name: '测试新增',
      amount: 5,
      status: '未审核',
      bizDate: '2026-09-29',
    })
    expect(() => updateRow({ ...blankForm(), no: 'M1024', name: 'x' }, 'ZZ-T1')).toThrow('已存在')
    updateRow({ ...blankForm(), no: 'ZZ-T2', name: '改名', amount: 9 }, 'ZZ-T1')
    expect(DATA[0]).toMatchObject({ no: 'ZZ-T2', name: '改名', amount: 9 })
    expect(delRow('ZZ-T2')).toBe(true)
    expect(DATA).toHaveLength(before)
  })
})

describe('MOCK_DELAY(模拟后端延迟)', () => {
  it('默认 420ms(与原型的 mock 后端一致);置 0 不等待', async () => {
    const delay = MOCK_DELAY.ms
    expect(delay).toBe(0) // 本文件顶部已置 0
    MOCK_DELAY.ms = 30
    const t0 = Date.now()
    await fetchRows(params())
    expect(Date.now() - t0).toBeGreaterThanOrEqual(25)
    MOCK_DELAY.ms = 0
  })
})

describe('对照页(ProtoApp:原型的外壳 + 真实库渲染的一张表)', () => {
  // jsdom 没有 matchMedia / ResizeObserver(naive-ui 与虚拟滚动要用),给个最小桩
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
    document.body.innerHTML = ''
  })

  // 传给 SmartTable 的列配置(SmartTable 是泛型组件,findComponent 的类型推不出 props,这里转 any)
  const columnsOf = (w: ReturnType<typeof mount>): any[] =>
    (w.findComponent(SmartTable as any) as any).props('columns')

  function mountApp(m: 1 | 2 | 3 | 4) {
    history.replaceState(null, '', `/prototype.html?m=${m}&theme=light`)
    return mount(ProtoApp, { attachTo: document.body })
  }

  // 侧栏是两级目录(组名 = 小标题,子页常显);外壳读注册表,侧栏是全部 5 组 13 个子页(含「可编辑表格」;没有组件的模块由注册表挂占位,侧栏项照出;i18n 不在侧栏)
  it.each([1, 2, 3, 4] as const)(
    '模块 %i:侧栏是 5 组 13 个子页,标题、工具栏、表头都渲染出来',
    async (m) => {
      const w = mountApp(m)
      await flushPromises()
      expect(w.findAll('#modList .nav-h').map((h) => h.text())).toEqual([
        '查询',
        '列',
        '行',
        '数据',
        '布局',
      ])
      expect(w.findAll('#modList .mod')).toHaveLength(13)
      expect(w.find('.smart-table-title').exists()).toBe(false) // 单表模块工具栏不再画表名(设计 §2.14:页顶已有页面标题)
      const heads = w.findAll('thead th').map((th) => th.text())
      expect(heads).toEqual(
        expect.arrayContaining([
          '序号',
          '物料编码',
          '物料名称',
          '负责人',
          '单据状态',
          '部门',
          '金额',
          '单据日期',
          '操作',
        ]),
      )
      w.unmount()
    },
  )

  it('侧栏两级目录:组名是小标题、子页常显(功能名,无编号),亮点项带 ★,当前子页高亮,?m= 仍是旧编号', async () => {
    const w = mountApp(3) // ?m=3 = filter = 「查询」组的第 3 个子页
    await flushPromises()
    const mods = w.findAll('#modList .mod')
    expect(mods.map((b) => b.find('.nm').text())).toEqual([
      '搜索表单',
      '条件搜索',
      '表头过滤',
      '多列排序',
      '多级表头与固定列',
      '字典、标签与格式化',
      '列设置',
      '行拖拽排序',
      '主从联动',
      '加载与错误处理',
      '增删改弹窗',
      '可编辑表格',
      '上下布局',
    ])
    expect(mods.map((b) => b.find('.no').exists())).toEqual(Array(13).fill(false))
    expect(mods.map((b) => b.find('.hl').exists())).toEqual([
      false,
      true,
      true,
      false,
      false,
      true,
      true,
      false,
      false,
      false,
      false,
      false,
      false,
    ]) // 原型 ★:条件搜索 / 表头过滤 / 字典 / 列设置
    // 状态:全部「已定」,侧栏没有状态徽标(可编辑表格 2026-10-05 起不再是提议)
    expect(mods.map((b) => b.find('.st').exists())).toEqual(Array(13).fill(false))
    expect(mods.map((b) => b.classes('on'))).toEqual([false, false, true, ...Array(10).fill(false)])
    expect(w.find('.stage-head h2').text()).toBe('表头过滤')
    expect(w.find('.crumb').text().replace(/\s+/g, ' ')).toBe(
      'SmartTable 设计方案 / 查询 / 表头过滤',
    )
    w.unmount()
  })

  it('点侧栏子页 = 切模块并同步 ?m=;窄档的分组条点当前分组不跳走,子页签列出组内全部子页', async () => {
    const w = mountApp(1)
    await flushPromises()
    const mods = () => w.findAll('#modList .mod')
    const tabs = () => w.findAll('.subtabs .subtab')
    expect(w.find('.smart-table-search').exists()).toBe(true)
    expect(w.findAll('#grpBar .mod').map((b) => b.text())).toEqual([
      '查询',
      '列',
      '行',
      '数据',
      '布局',
    ])
    expect(tabs().map((t) => t.text())).toEqual(['搜索表单', '条件搜索', '表头过滤', '多列排序'])
    expect(tabs().map((t) => t.classes('on'))).toEqual([true, false, false, false])

    await mods()[1].trigger('click') // 条件搜索 = toolbar = ?m=2
    await flushPromises()
    expect(new URLSearchParams(location.search).get('m')).toBe('2')
    expect(mods().map((b) => b.classes('on'))).toEqual([false, true, ...Array(11).fill(false)])
    expect(tabs().map((t) => t.classes('on'))).toEqual([false, true, false, false])
    expect(w.find('.smart-table-search').exists()).toBe(false)
    expect(w.find('.crumb').text().replace(/\s+/g, ' ')).toBe(
      'SmartTable 设计方案 / 查询 / 条件搜索',
    )
    await w.findAll('#grpBar .mod')[0].trigger('click') // 窄档点当前分组:保持在条件搜索
    expect(new URLSearchParams(location.search).get('m')).toBe('2')

    await tabs()[3].trigger('click') // 子页签:多列排序 = sort = ?m=4
    await flushPromises()
    expect(new URLSearchParams(location.search).get('m')).toBe('4')
    expect(w.find('.stage-head h2').text()).toBe('多列排序')
    expect(w.find('.crumb').text().replace(/\s+/g, ' ')).toBe(
      'SmartTable 设计方案 / 查询 / 多列排序',
    )
    w.unmount()
  })

  // jsdom 里 fillHeight 的虚拟滚动表体高度为 0,不渲染行,所以行 / 单元格的外观走真实浏览器读数;
  // 这里锁住的是传给 SmartTable 的列配置(序号 / 固定列 / 状态语义色 / 金额 money / 操作列固定右)与首批数据。
  it.each([1, 2, 3, 4] as const)(
    '模块 %i:列配置 = 勾选 + 序号固定左、操作固定右;状态语义色 tag;金额 money',
    async (m) => {
      const w = mountApp(m)
      await flushPromises()
      const cols = columnsOf(w)
      expect(cols[0]).toMatchObject({ type: 'selection', width: 40, fixed: 'left' })
      // 列标题是函数(随外壳语言渲染期求值),断言取函数求值结果
      expect(cols[1]).toMatchObject({ type: 'index', width: 64, fixed: 'left' })
      expect(cols[1].title()).toBe('序号')
      expect(cols.at(-1)).toMatchObject({ key: 'actions', fixed: 'right', width: 140 })
      const status = cols.find((c) => c.key === 'status')
      expect(status.tag).toBe(true)
      expect(status.options.map((o: any) => [o.value, o.tagType])).toEqual([
        ['已审核', 'success'],
        ['未审核', 'warning'],
        ['已关闭', 'default'],
      ])
      expect(cols.find((c) => c.key === 'amount').format).toBe('money')
      w.unmount()
    },
  )

  it('模块 1:挂载即带默认「本月」请求,总数 214;搜索区有 物料编码 / 单据日期 / 单据状态 …(span 累计折叠)', async () => {
    const w = mountApp(1)
    await flushPromises()
    expect(w.find('.n-pagination').text()).toContain('共 214 条')
    const labels = w.findAll('.smart-table-search .n-form-item-label').map((l) => l.text())
    expect(labels).toEqual([
      '物料编码',
      '单据日期',
      '单据状态',
      '物料名称',
      '负责人',
      '部门',
      '金额',
      '仅看加急',
      '备注',
    ])
    w.unmount()
  })

  it('模块 3 的 #toolbar 左侧有「我负责的」;点击后负责人过滤落成单条 equal 并重新请求;模块 1 / 2 / 4 没有', async () => {
    const m3 = mountApp(3)
    await flushPromises()
    const btn = m3.findAll('.smart-table-toolbar button').find((b) => b.text() === '我负责的')
    expect(btn).toBeTruthy()
    await btn!.trigger('click')
    await flushPromises()
    expect(m3.findAll('.smart-table-chip').map((c) => c.text())).toEqual([
      '负责人 等于 张伟',
      '单据状态 等于 未审核',
    ])
    expect(btn!.attributes('aria-pressed')).toBe('true')
    m3.unmount()
    for (const m of [1, 2, 4] as const) {
      const w = mountApp(m)
      await flushPromises()
      expect(w.findAll('.smart-table-toolbar button').some((b) => b.text() === '我负责的')).toBe(
        false,
      )
      w.unmount()
    }
  })

  it('行内「删除」先弹 NPopconfirm「确认删除该行?」,点气泡里的「删除」(实心红)才删;「取消」是淡灰', async () => {
    const w = mountApp(2)
    await flushPromises()
    const actions = columnsOf(w).at(-1)
    const row = DATA[3]
    const cell = mount(
      { render: () => h(NConfigProvider, { locale: zhCN }, () => actions.render(row, 0)) },
      { attachTo: document.body },
    )
    const del = cell.findAll('button').find((b) => b.text() === '删除')!
    await del.trigger('click')
    await flushPromises()
    expect(document.body.textContent).toContain('确认删除该行?')
    expect(DATA.some((r) => r.no === row.no)).toBe(true) // 还没删
    // 设计 §2.15 B6:气泡里最终确认的按钮是实心红「删除」,「取消」是淡灰(触发它的行内「删除」是无底红字,不在气泡里)
    const pop = [...document.body.querySelectorAll<HTMLButtonElement>('.n-popconfirm button')]
    const cancel = pop.find((b) => b.textContent?.trim() === '取消')!
    expect(cancel.classList.contains('n-button--secondary')).toBe(true)
    const ok = pop.find((b) => b.textContent?.trim() === '删除')!
    expect(ok.classList.contains('n-button--error-type')).toBe(true)
    expect(ok.classList.contains('n-button--secondary')).toBe(false)
    ok.click()
    await flushPromises()
    expect(DATA.some((r) => r.no === row.no)).toBe(false)
    DATA.splice(3, 0, row) // 还原,免得影响同文件其它用例
    cell.unmount()
    w.unmount()
  })

  it('模块 3:单据状态有默认过滤「未审核」(出现一个 chip);模块 4 没有默认过滤', async () => {
    const m3 = mountApp(3)
    await flushPromises()
    const chips = m3.findAll('.smart-table-chip')
    expect(chips.map((c) => c.text())).toEqual(['单据状态 等于 未审核'])
    m3.unmount()
    const m4 = mountApp(4)
    await flushPromises()
    expect(m4.findAll('.smart-table-chip')).toHaveLength(0)
    m4.unmount()
  })

  it('模块 1 有搜索卡片(中文「展开」),模块 3 的表头有漏斗,模块 2 没有搜索也没有漏斗', async () => {
    const m1 = mountApp(1)
    await flushPromises()
    expect(m1.find('.smart-table-search').exists()).toBe(true)
    expect(m1.find('.smart-table-search').text()).toContain('展开')
    m1.unmount()

    const m3 = mountApp(3)
    await flushPromises()
    expect(m3.findAll('.smart-table-filter-trigger').length).toBeGreaterThan(0)
    m3.unmount()

    const m2 = mountApp(2)
    await flushPromises()
    expect(m2.find('.smart-table-search').exists()).toBe(false)
    expect(m2.findAll('.smart-table-filter-trigger')).toHaveLength(0)
    m2.unmount()
  })
})

describe('对照页补上的 P1 场景(模块 2 / 3 / 4 = 一行式条件构造器;批量栏;放大)', () => {
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
    document.body.innerHTML = ''
  })

  function mountApp(m: 1 | 2 | 3 | 4) {
    history.replaceState(null, '', `/prototype.html?m=${m}&theme=light`)
    return mount(ProtoApp, { attachTo: document.body })
  }
  const fieldTitles = (w: ReturnType<typeof mount>): string[] =>
    (w.findComponent(ConditionBar as any) as any)
      .props('fields')
      .map((f: any) => (typeof f.title === 'function' ? f.title() : f.title)) // 标题是函数(随语言求值)
  const totalText = (w: ReturnType<typeof mount>) =>
    w.find('.n-pagination').element.parentElement!.textContent ?? ''

  it('模块 2:搜索区是条件构造器(没有独立搜索卡片、没有列头漏斗),字段候选是原型的 8 个字段(含只出现在搜索里的「备注」)', async () => {
    const w = mountApp(2)
    await flushPromises()
    expect(w.find('.smart-table-cond').exists()).toBe(true)
    expect(w.find('.smart-table-search').exists()).toBe(false)
    expect(w.findAll('.smart-table-filter-trigger')).toHaveLength(0)
    expect(fieldTitles(w)).toEqual([
      '物料编码',
      '物料名称',
      '负责人',
      '单据状态',
      '部门',
      '金额',
      '单据日期',
      '备注',
    ])
    w.unmount()
  })

  it('模块 3 / 4 的工具栏也有条件构造器(列头漏斗照旧);模块 1 没有构造器、保持独立搜索表单卡', async () => {
    const m3 = mountApp(3)
    await flushPromises()
    expect(m3.find('.smart-table-cond').exists()).toBe(true)
    expect(m3.findAll('.smart-table-filter-trigger').length).toBeGreaterThan(0)
    // 模块 3 的单据状态不进构造器(默认过滤「未审核」走列头漏斗 + chips,见 ProtoModule 注释);其余 7 个字段都在
    expect(fieldTitles(m3)).toEqual([
      '物料编码',
      '物料名称',
      '负责人',
      '部门',
      '金额',
      '单据日期',
      '备注',
    ])
    m3.unmount()

    const m4 = mountApp(4)
    await flushPromises()
    expect(m4.find('.smart-table-cond').exists()).toBe(true)
    expect(m4.findAll('.smart-table-filter-trigger').length).toBeGreaterThan(0)
    expect(fieldTitles(m4)).toEqual([
      '物料编码',
      '物料名称',
      '负责人',
      '单据状态',
      '部门',
      '金额',
      '单据日期',
      '备注',
    ])
    m4.unmount()

    const m1 = mountApp(1)
    await flushPromises()
    expect(m1.find('.smart-table-cond').exists()).toBe(false)
    expect(m1.find('.smart-table-search').exists()).toBe(true)
    m1.unmount()
  })

  it('模块 2 条件搜索真实过滤:物料编码 包含 M10 + 点「搜索」→ 总数从 2000 变成后端求值的结果;重置回全量', async () => {
    const w = mountApp(2)
    await flushPromises()
    expect(totalText(w)).toContain('共 2000 条')
    await w.find('.smart-table-cond__main .smart-table-filter-value input').setValue('M10')
    expect(totalText(w)).toContain('共 2000 条') // 敲字不提交
    await w
      .findAll('.smart-table-cond__main button')
      .find((b) => b.text() === '搜索')!
      .trigger('click')
    await flushPromises()
    const expected = DATA.filter((r) => r.no.toLowerCase().includes('m10')).length
    expect(expected).toBeGreaterThan(0)
    expect(expected).toBeLessThan(2000)
    expect(totalText(w)).toContain(`共 ${expected} 条`)
    await w
      .findAll('.smart-table-cond__main button')
      .find((b) => b.text() === '重置')!
      .trigger('click')
    await flushPromises()
    expect(totalText(w)).toContain('共 2000 条')
    w.unmount()
  })

  it('模块 3 / 4 的条件搜索同样发请求并过滤(模块 3 叠加默认过滤「未审核」)', async () => {
    const m3 = mountApp(3)
    await flushPromises()
    const base3 = DATA.filter((r) => r.status === '未审核')
    expect(totalText(m3)).toContain(`共 ${base3.length} 条`)
    await m3.find('.smart-table-cond__main .smart-table-filter-value input').setValue('M10')
    await m3
      .findAll('.smart-table-cond__main button')
      .find((b) => b.text() === '搜索')!
      .trigger('click')
    await flushPromises()
    const e3 = base3.filter((r) => r.no.toLowerCase().includes('m10')).length
    expect(e3).toBeGreaterThan(0)
    expect(totalText(m3)).toContain(`共 ${e3} 条`)
    m3.unmount()

    const m4 = mountApp(4)
    await flushPromises()
    await m4.find('.smart-table-cond__main .smart-table-filter-value input').setValue('M10')
    await m4
      .findAll('.smart-table-cond__main button')
      .find((b) => b.text() === '搜索')!
      .trigger('click')
    await flushPromises()
    expect(totalText(m4)).toContain(
      `共 ${DATA.filter((r) => r.no.toLowerCase().includes('m10')).length} 条`,
    )
    m4.unmount()
  })

  it('4 个模块的工具栏都有「放大」按钮', async () => {
    for (const m of [1, 2, 3, 4] as const) {
      const w = mountApp(m)
      await flushPromises()
      expect(w.find('button[aria-label="放大"]').exists()).toBe(true)
      w.unmount()
    }
  })

  it('表头全选 → 批量栏(已选 100 项 + 批量审核 / 批量删除 + 取消选择);取消选择 → 回到工具栏', async () => {
    const w = mountApp(2)
    await flushPromises()
    expect(w.find('.smart-table-batch').exists()).toBe(false)
    await w.find('thead .n-checkbox').trigger('click') // 虚拟滚动在 jsdom 里没有行可点,用表头全选(选中的是当前页 100 行)
    await flushPromises()
    expect(w.find('.smart-table-batch-info').text()).toContain('已选 100 项')
    expect(w.find('.smart-table-batch').text()).toContain('批量审核')
    expect(w.find('.smart-table-batch').text()).toContain('批量删除')
    await w
      .findAll('.smart-table-batch button')
      .find((b) => b.text() === '取消选择')!
      .trigger('click')
    await flushPromises()
    expect(w.find('.smart-table-batch').exists()).toBe(false)
    expect(w.find('.smart-table-cond').exists()).toBe(true) // 工具栏(含构造器)回来了
    w.unmount()
  })

  it('批量审核 / 批量删除的后端(原型 batchApprove / batchDel):审核只改「未审核」,删除作用于全部已勾选行', () => {
    const snapshot = DATA.slice()
    const targets = DATA.filter((r) => r.status === '未审核').slice(0, 2)
    const closed = DATA.find((r) => r.status === '已关闭')!
    const keys = [...targets.map((r) => r.no), closed.no]
    expect(approveRows(keys)).toBe(2) // 已关闭的不动
    expect(targets.every((r) => r.status === '已审核')).toBe(true)
    expect(closed.status).toBe('已关闭')
    targets.forEach((r) => (r.status = '未审核')) // 还原
    expect(delRows(keys)).toBe(3)
    expect(DATA).toHaveLength(snapshot.length - 3)
    DATA.splice(0, DATA.length, ...snapshot) // 还原,免得影响同文件其它用例
  })

  it('后端求值:条件构造器发出的 filters 用 matchFilterValue 真实过滤(数字 / 日期 / 为空 / NOT IN)', async () => {
    const f = (field: string, action: string, value?: unknown) =>
      fetchRows(
        params({
          pageSize: 1000,
          filters: [{ field, logic: 'and', conditions: [{ action, value }] }],
        }),
      )
    expect((await f('amount', 'gt', 40000)).total).toBe(DATA.filter((r) => r.amount > 40000).length)
    expect((await f('amount', 'lte', 500)).total).toBe(DATA.filter((r) => r.amount <= 500).length)
    expect((await f('bizDate', 'equal', '2026-09-21')).total).toBe(
      DATA.filter((r) => r.bizDate === '2026-09-21').length,
    )
    expect((await f('bizDate', 'gte', '2026-09-01')).total).toBe(
      DATA.filter((r) => r.bizDate >= '2026-09-01').length,
    )
    expect((await f('memo', 'isNull')).total).toBe(DATA.filter((r) => r.memo === '').length)
    expect((await f('memo', 'isNotNull')).total).toBe(DATA.filter((r) => r.memo !== '').length)
    expect((await f('owner', 'notIn', ['张伟', '李娜'])).total).toBe(
      DATA.filter((r) => r.owner !== '张伟' && r.owner !== '李娜').length,
    )
    expect((await f('status', 'notEqual', '未审核')).total).toBe(
      DATA.filter((r) => r.status !== '未审核').length,
    )
  })
})
