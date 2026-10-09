// @vitest-environment jsdom
// 条件构造器的两个 SFC:ConditionPanel(多条件面板内容,气泡 / 抽屉共用)与 ConditionBar(工具栏一行 + 面板开合 / 键盘)
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { NButton, NInput, NSelect } from 'naive-ui'
import ConditionBar from '../src/ConditionBar.vue'
import conditionBarSource from '../src/ConditionBar.vue?raw'
import ConditionPanel from '../src/ConditionPanel.vue'
import ConditionRow from '../src/ConditionRow.vue'
import { defaultLabels } from '../src/labels'
import { MAX_BUILDER_ROWS, blankRow, type BuilderDraft } from '../src/conditionBuilder'
import type { FilterDef } from '../src/useColumns'

const defs: FilterDef[] = [
  {
    key: 'name',
    field: 'name',
    optionsKey: 'name',
    title: '名称',
    mode: 'condition',
    multiple: true,
    type: 'input',
    actions: ['contains', 'equal', 'isNull'],
  },
  {
    key: 'amount',
    field: 'amount',
    optionsKey: 'amount',
    title: '金额',
    mode: 'condition',
    multiple: true,
    type: 'number',
    actions: ['equal', 'gt', 'lt'],
  },
  {
    key: 'status',
    field: 'status',
    optionsKey: 'status',
    title: '状态',
    mode: 'condition',
    multiple: true,
    type: 'select',
    actions: ['equal', 'in'],
  },
]
const base = (
  rows: BuilderDraft['rows'] = [blankRow(defs[0])],
  logic: BuilderDraft['logic'] = {},
): BuilderDraft => ({ rows, logic })
const common = {
  fields: defs,
  labels: defaultLabels,
  getOptions: () => [{ label: '已审核', value: 'ok' }],
  isLoadingOptions: () => false,
}

const mounted: VueWrapper[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()!.unmount()
  document.body.innerHTML = ''
})
function mountPanel(draft: BuilderDraft, extra: Record<string, unknown> = {}) {
  const w = mount(ConditionPanel, {
    props: { ...common, draft, ...extra },
    attachTo: document.body,
  })
  mounted.push(w)
  return w
}
const lastDraft = (w: VueWrapper) => w.emitted('update:draft')!.at(-1)![0] as BuilderDraft

describe('ConditionPanel', () => {
  it('每行最左一格:第 1 行「条件」;同字段后续行是「且 / 或」下拉;不同字段是固定「且」', () => {
    const draft = base([
      { field: 'name', action: 'contains', value: 'a' },
      { field: 'name', action: 'contains', value: 'b' },
      { field: 'amount', action: 'gt', value: 1 },
    ])
    const w = mountPanel(draft)
    const rows = w.findAllComponents(ConditionRow)
    // 引导格由 ConditionRow 画(与列头面板同一套):第 1 行「条件」文字,同字段后续行 = 且 / 或下拉,跨字段后续行 = 固定「且」
    expect(rows[0].find('.smart-table-filter-lead').text()).toBe('Where')
    expect(rows[1].find('.smart-table-filter-logic').exists()).toBe(true)
    expect(rows[1].find('.smart-table-filter-lead').exists()).toBe(false)
    expect(rows[2].find('.smart-table-filter-logic').exists()).toBe(false)
    expect(rows[2].find('.smart-table-filter-lead').text()).toBe('AND')
  })

  it('加条件:与最后一行同字段;封顶后「添加」禁用', async () => {
    const w = mountPanel(base([{ field: 'amount', action: 'gt', value: 1 }]))
    const add = w.find('.smart-table-cond-panel__footer > .n-button')
    await add.trigger('click')
    expect(lastDraft(w).rows[1]).toEqual({ field: 'amount', action: 'equal', value: null })

    const full = mountPanel(base(Array.from({ length: MAX_BUILDER_ROWS }, () => blankRow(defs[0]))))
    expect(
      full.find('.smart-table-cond-panel__footer > .n-button').attributes('disabled'),
    ).toBeDefined()
  })

  it('改行内比较符 / 值 → update:draft(经 ConditionRow 的事件);删除只有 ≥ 2 行时才有', async () => {
    const draft = base([blankRow(defs[0]), blankRow(defs[0])])
    const w = mountPanel(draft)
    const rows = w.findAllComponents(ConditionRow)
    rows[0].vm.$emit('update:value', 'abc')
    await nextTick()
    expect(lastDraft(w).rows[0].value).toBe('abc')
    rows[1].vm.$emit('update:action', 'equal')
    await nextTick()
    expect(lastDraft(w).rows[1].action).toBe('equal')
    rows[1].vm.$emit('remove')
    await nextTick()
    expect(lastDraft(w).rows).toHaveLength(1)
    expect(mountPanel(base()).findComponent(ConditionRow).props('removable')).toBe(false)
  })

  it('ConditionRow 的回车 → confirm;页脚「重置」→ reset,「确认」→ confirm(文案沿用 filterReset / filterConfirm)', async () => {
    const w = mountPanel(base())
    w.findComponent(ConditionRow).vm.$emit('enter')
    expect(w.emitted('confirm')).toHaveLength(1)
    const [resetBtn, okBtn] = w.findAll('.smart-table-cond-panel__actions button')
    expect(resetBtn.text()).toBe(defaultLabels.filterReset)
    expect(okBtn.text()).toBe(defaultLabels.filterConfirm)
    await resetBtn.trigger('click')
    await okBtn.trigger('click')
    expect(w.emitted('reset')).toHaveLength(1)
    expect(w.emitted('confirm')).toHaveLength(2)
  })

  it('下拉展开计数:行里任一下拉展开 → dropdown(true);全部收起 → dropdown(false)(外层据此区分 Esc 是收下拉还是关面板)', async () => {
    const w = mountPanel(base([blankRow(defs[0]), blankRow(defs[0])]))
    const rows = w.findAllComponents(ConditionRow)
    rows[0].vm.$emit('dropdown', true)
    rows[1].vm.$emit('dropdown', true)
    await nextTick()
    expect(w.emitted('dropdown')!.at(-1)).toEqual([true])
    rows[0].vm.$emit('dropdown', false)
    await nextTick()
    expect(w.emitted('dropdown')!.length).toBe(1) // 还有一行展开,没有变成 false
    rows[1].vm.$emit('dropdown', false)
    await nextTick()
    expect(w.emitted('dropdown')!.at(-1)).toEqual([false])
  })

  it('stack(抽屉)排布:带 --stack 类', () => {
    expect(mountPanel(base(), { stack: true, size: 'large' }).classes()).toContain(
      'smart-table-cond-panel--stack',
    )
  })
})

describe('ConditionBar', () => {
  function mountBar(extra: Record<string, unknown> = {}, draft: BuilderDraft = base()) {
    const w = mount(ConditionBar, {
      props: { ...common, draft, ...extra },
      attachTo: document.body,
    })
    mounted.push(w)
    return w
  }
  const moreBtn = () => document.querySelector<HTMLElement>('.smart-table-cond__more button')!
  const panel = () => document.querySelector<HTMLElement>('.smart-table-cond__popover')
  const press = (el: Element, key: string, init: KeyboardEventInit = {}) =>
    el.dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }),
    )

  it('宽 / 中档主行:字段下拉 + 比较符 + 值 + » + 搜索 + 重置;点搜索 / 重置发事件', async () => {
    const w = mountBar()
    expect(w.find('.smart-table-cond__field').exists()).toBe(true)
    expect(moreBtn().getAttribute('aria-label')).toBe(defaultLabels.searchMoreConditions)
    const buttons = [
      ...document.querySelectorAll<HTMLElement>('.smart-table-cond__main > .n-button'),
    ]
    buttons.find((b) => b.textContent!.trim() === 'Search')!.click()
    buttons.find((b) => b.textContent!.trim() === 'Reset')!.click()
    await nextTick()
    expect(w.emitted('search')).toHaveLength(1)
    expect(w.emitted('reset')).toHaveLength(1)
  })

  it('角标:宽 / 中档 ≥ 2 条才显示(1 条主行已经显示了);窄档 ≥ 1 条显示', () => {
    mountBar({ appliedCount: 1 })
    expect(document.querySelector('.smart-table-cond__badge')).toBeNull()
    mountBar({ appliedCount: 2 })
    expect(document.querySelector('.smart-table-cond__badge')!.textContent!.trim()).toBe('2')
    mountBar({ appliedCount: 1, tier: 'narrow' })
    expect(
      [...document.querySelectorAll('.smart-table-cond__badge')].map((e) => e.textContent!.trim()),
    ).toContain('1')
  })

  it('openRequest 变大 → 面板打开,焦点进面板;Esc → 收起并把焦点还给 » 按钮;不发 search(草稿保留)', async () => {
    const w = mountBar()
    await w.setProps({ openRequest: 1 })
    await flushPromises()
    expect(moreBtn().getAttribute('aria-expanded')).toBe('true')
    expect(panel()).not.toBeNull()
    expect(panel()!.getAttribute('role')).toBe('dialog')
    press(panel()!.querySelector('input')!, 'Escape')
    await flushPromises()
    expect(moreBtn().getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(moreBtn())
    expect(w.emitted('search')).toBeUndefined()
  })

  it('面板里有下拉展开时 Esc 放行(下拉自己收,面板不关);下拉收起后再 Esc 才关面板', async () => {
    const w = mountBar()
    await w.setProps({ openRequest: 1 })
    await flushPromises()
    const panelComp = w.findComponent(ConditionPanel)
    panelComp.vm.$emit('dropdown', true)
    await nextTick()
    const input = panel()!.querySelector('input')!
    const ev = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    input.dispatchEvent(ev)
    await flushPromises()
    expect(moreBtn().getAttribute('aria-expanded')).toBe('true') // 面板还在
    panelComp.vm.$emit('dropdown', false)
    await nextTick()
    press(input, 'Escape')
    await flushPromises()
    expect(moreBtn().getAttribute('aria-expanded')).toBe('false')
  })

  it('面板里 Tab 循环:最后一个控件 Tab → 第一个', async () => {
    const w = mountBar()
    await w.setProps({ openRequest: 1 })
    await flushPromises()
    const items = [
      ...panel()!.querySelectorAll<HTMLElement>('input, button, [tabindex]:not([tabindex="-1"])'),
    ].filter((e) => e.tabIndex >= 0)
    items[items.length - 1].focus()
    const ev = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    items[items.length - 1].dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(items[0])
  })

  it('焦点还停在主行 / » 按钮上(面板开着)时按 Esc 也能收起', async () => {
    mountBar()
    moreBtn().click()
    await flushPromises()
    expect(moreBtn().getAttribute('aria-expanded')).toBe('true')
    press(moreBtn(), 'Escape')
    await flushPromises()
    expect(moreBtn().getAttribute('aria-expanded')).toBe('false')
  })

  it('窄档:枚举(select)字段的标量比较符,选完即生效 = 发 update:draft 之后马上发 search;文本字段不会', async () => {
    const select = base([{ field: 'status', action: 'equal', value: null }])
    const w = mountBar({ tier: 'narrow' }, select)
    w.findComponent(ConditionRow).vm.$emit('update:value', 'ok')
    await nextTick()
    expect(lastDraft(w).rows[0].value).toBe('ok')
    expect(w.emitted('search')).toHaveLength(1)

    const text = mountBar({ tier: 'narrow' })
    text.findComponent(ConditionRow).vm.$emit('update:value', 'abc')
    await nextTick()
    expect(text.emitted('search')).toBeUndefined()
  })

  it('窄档主行只画值控件(没有比较符下拉),占位 = 「Search {字段名}」', () => {
    const w = mountBar({ tier: 'narrow' })
    const row = w.findComponent(ConditionRow)
    expect(row.props('valueOnly')).toBe(true)
    expect(row.props('size')).toBe('large')
    expect(row.find('.smart-table-filter-action').exists()).toBe(false)
    expect(w.find('input').attributes('placeholder')).toBe('Search 名称')
  })
})

describe('ConditionRow 的 size / valueOnly / placeholder(列头面板默认不变)', () => {
  const row = (extra: Record<string, unknown> = {}) =>
    mount(ConditionRow, {
      props: {
        def: defs[0],
        condition: { action: 'contains', value: '' },
        labels: defaultLabels,
        getOptions: () => [],
        isLoadingOptions: () => false,
        ...extra,
      },
    })
  it('默认 small、带比较符、占位取 def.props', () => {
    const w = row()
    expect(w.find('.smart-table-filter-action').exists()).toBe(true)
    expect(w.find('.n-input--small-size').exists()).toBe(true)
  })
  it('size="medium" / valueOnly / placeholder 覆盖', () => {
    const w = row({ size: 'medium', valueOnly: true, placeholder: '搜索 名称' })
    expect(w.find('.smart-table-filter-action').exists()).toBe(false)
    expect(w.find('.n-input--medium-size').exists()).toBe(true)
    expect(w.find('input').attributes('placeholder')).toBe('搜索 名称')
  })
  it('不给 placeholder 时 def.props.placeholder 仍生效(不会被 undefined 顶掉)', () => {
    const w = row({ def: { ...defs[0], props: { placeholder: '关键字' } } })
    expect(w.find('input').attributes('placeholder')).toBe('关键字')
  })
})

describe('ConditionBar 气泡阴影只有一份', () => {
  // 同列头面板:外壳 .n-popover 的官方阴影关掉,面板的底色 / 圆角 / 阴影 / 文字色来自样式表里的官方 --n-* 变量,不内联手抄。
  // jsdom 不加载 SFC 样式,真实浏览器里的视觉值靠浏览器实测。
  it('外壳 .n-popover 的 box-shadow 为 none;面板不带内联的底色 / 圆角 / 阴影 / 文字色', async () => {
    const w = mount(ConditionBar, { props: { ...common, draft: base() }, attachTo: document.body })
    mounted.push(w)
    await w.setProps({ openRequest: 1 })
    await flushPromises()
    const panel = document.querySelector<HTMLElement>('.smart-table-cond__popover')!
    const shell = panel.closest<HTMLElement>('.n-popover')!
    expect(shell.style.boxShadow).toBe('none')
    for (const prop of [
      'background',
      'backgroundColor',
      'borderRadius',
      'boxShadow',
      'color',
    ] as const)
      expect(panel.style[prop]).toBe('')
  })
})

describe('ConditionBar 「搜索」「重置」按钮:淡色底 + 左图标(设计 §2.13 / §2.15),loading 不改变按钮宽度(issue #5)', () => {
  // 图标槽(.n-button__icon)一直在:空闲时放图标,loading 时官方把同一个槽里的图标换成转圈,按钮宽度不变,
  // 转圈槽不脱离文档流。jsdom 不做布局,量不出像素:这里只锁结构事实,真实宽度由浏览器实测。
  const btnOf = (text: string) =>
    [...document.querySelectorAll<HTMLElement>('.smart-table-cond__main > .n-button')].find(
      (b) => b.textContent!.trim() === text,
    )!
  const searchBtn = () => btnOf('Search')
  function mountBar(extra: Record<string, unknown> = {}) {
    const w = mount(ConditionBar, {
      props: { ...common, draft: base(), ...extra },
      attachTo: document.body,
    })
    mounted.push(w)
    return w
  }

  it('图标槽(.n-button__icon)不设 position: absolute:转圈槽不脱离文档流', () => {
    expect(conditionBarSource).not.toMatch(/\.n-button__icon\)\s*\{[^}]*position: absolute/)
  })

  it('「搜索」= secondary + primary(淡主色底),图标槽空闲与 loading 时都在', async () => {
    const w = mountBar()
    expect(searchBtn().classList.contains('n-button--primary-type')).toBe(true)
    expect(searchBtn().classList.contains('n-button--secondary')).toBe(true)
    expect(searchBtn().querySelector('.n-button__icon svg')).not.toBeNull()
    expect(searchBtn().classList.contains('n-button--loading')).toBe(false)
    await w.setProps({ loading: true })
    expect(searchBtn().classList.contains('n-button--loading')).toBe(true)
    expect(searchBtn().querySelector('.n-button__icon')).not.toBeNull()
    await w.setProps({ loading: false })
    expect(searchBtn().querySelector('.n-button__icon svg')).not.toBeNull()
  })

  it('「重置」= secondary 默认型(淡灰底,不是无底的 quaternary),带图标', () => {
    mountBar()
    const reset = btnOf('Reset')
    expect(reset.classList.contains('n-button--default-type')).toBe(true)
    expect(reset.classList.contains('n-button--secondary')).toBe(true)
    expect(reset.querySelector('.n-button__icon svg')).not.toBeNull()
  })

  it('loading 期间点「搜索」不发 search(不可重复触发),结束后恢复', async () => {
    const w = mountBar({ loading: true })
    searchBtn().click()
    await nextTick()
    expect(w.emitted('search')).toBeUndefined()
    await w.setProps({ loading: false })
    searchBtn().click()
    await nextTick()
    expect(w.emitted('search')).toHaveLength(1)
  })
})

describe('条件面板与工具栏主行同档(issue #11)', () => {
  // 气泡里的第 1 行就是工具栏主行的同一条条件,两处并排时必须同高(设计 §3.6)。
  // jsdom 量不出像素:这里锁「传给每个控件的 size 与主行一致」,真实高度由浏览器实测。
  async function openPanel(draft: BuilderDraft) {
    const w = mount(ConditionBar, { props: { ...common, draft }, attachTo: document.body })
    mounted.push(w)
    await w.setProps({ openRequest: 1 })
    await flushPromises()
    return w
  }
  const twoSameField = base([
    { field: 'name', action: 'contains', value: 'a' },
    { field: 'name', action: 'contains', value: 'b' },
  ])

  it('面板的 size 与工具栏主行的 size 相同,都是 medium', async () => {
    const w = await openPanel(base())
    const panelComp = w.findComponent(ConditionPanel)
    const mainRow = w
      .findAllComponents(ConditionRow)
      .find((r) => !panelComp.element.contains(r.element))!
    expect(mainRow.props('size')).toBe('medium')
    expect(panelComp.props('size')).toBe(mainRow.props('size'))
  })

  it('面板里的下拉 / 输入框 / 按钮(含第 2 行起的「且 / 或」下拉)全是 medium;圆形删除图标按钮不随档', async () => {
    const w = await openPanel(twoSameField)
    const panelComp = w.findComponent(ConditionPanel)
    const selects = panelComp.findAllComponents(NSelect)
    // 每行:字段 + 比较符,第 2 行再加「且 / 或」
    expect(selects.length).toBeGreaterThanOrEqual(5)
    for (const s of selects) expect(s.props('size')).toBe('medium')
    const inputs = panelComp.findAllComponents(NInput)
    expect(inputs.length).toBe(2)
    for (const i of inputs) expect(i.props('size')).toBe('medium')
    const buttons = panelComp.findAllComponents(NButton)
    const round = buttons.filter((b) => b.props('circle'))
    expect(round.length).toBe(2) // 多于一行时每行一个删除按钮
    for (const b of round) expect(b.props('size')).toBe('small')
    const text = buttons.filter((b) => !b.props('circle'))
    expect(text.length).toBe(3) // 添加条件 · 重置 · 确认
    for (const b of text) expect(b.props('size')).toBe('medium')
  })
})

describe('ConditionRow:第 2 行起的「且 / 或」下拉随本行 size(issue #11)', () => {
  const logicSelect = (size?: 'small' | 'medium' | 'large') => {
    const w = mount(ConditionRow, {
      props: {
        def: defs[0],
        condition: { action: 'contains', value: '' },
        index: 1,
        labels: defaultLabels,
        getOptions: () => [],
        isLoadingOptions: () => false,
        ...(size ? { size } : {}),
      },
    })
    mounted.push(w)
    return w
      .findAllComponents(NSelect)
      .find((s) => s.classes().includes('smart-table-filter-logic'))!
  }
  it('size="medium" / "large" → 且 / 或下拉同档', () => {
    expect(logicSelect('medium').props('size')).toBe('medium')
    expect(logicSelect('large').props('size')).toBe('large')
  })
  it('不传 size(列头面板)仍是 small', () => {
    expect(logicSelect().props('size')).toBe('small')
  })
})
