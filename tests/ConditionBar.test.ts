// @vitest-environment jsdom
// 条件构造器的两个 SFC:ConditionPanel(多条件面板内容,气泡 / 抽屉共用)与 ConditionBar(工具栏一行 + 面板开合 / 键盘)
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
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

describe('ConditionRow 新增的 size / valueOnly / placeholder(列头面板默认不变)', () => {
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
  // 同列头面板:外壳 .n-popover 的官方阴影关掉,面板的底色 / 圆角 / 阴影 / 文字色来自样式表里的官方 --n-* 变量,不再内联手抄。
  // jsdom 不加载 SFC 样式,真实浏览器里的视觉值实测见任务汇报。
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

describe('ConditionBar 「搜索」按钮的 loading 不改变按钮宽度', () => {
  // 官方 NButton 的 loading 会往按钮里塞 span.n-button__icon(16px + 6px 间距),进 / 出 loading 时它走 width 过渡,
  // 按钮宽度逐帧变化,同一行 flex: 1 的值输入框被动跟着变宽(issue #5)。
  // jsdom 不做布局,量不出像素:这里只锁住「按钮带了隔离用的 class + 样式规则让转圈槽脱离文档流」这两个结构事实,
  // 真实宽度由浏览器实测(见任务汇报)。
  const searchBtn = () =>
    [...document.querySelectorAll<HTMLElement>('.smart-table-cond__main > .n-button')].find(
      (b) => b.textContent!.trim() === 'Search',
    )!
  function mountBar(extra: Record<string, unknown> = {}) {
    const w = mount(ConditionBar, {
      props: { ...common, draft: base(), ...extra },
      attachTo: document.body,
    })
    mounted.push(w)
    return w
  }

  it('转圈槽 .n-button__icon 脱离文档流:不撑宽按钮,过渡期间也不挪动邻居', () => {
    expect(conditionBarSource).toMatch(
      /\.smart-table-cond__search\.n-button :deep\(\.n-button__icon\)\s*\{[^}]*position: absolute/,
    )
  })

  it('loading 与否按钮都带 smart-table-cond__search,且 loading 时仍是官方 loading 态', async () => {
    const w = mountBar()
    expect(searchBtn().classList.contains('smart-table-cond__search')).toBe(true)
    expect(searchBtn().classList.contains('n-button--loading')).toBe(false)
    await w.setProps({ loading: true })
    expect(searchBtn().classList.contains('smart-table-cond__search')).toBe(true)
    expect(searchBtn().classList.contains('n-button--loading')).toBe(true)
    await w.setProps({ loading: false })
    expect(searchBtn().classList.contains('smart-table-cond__search')).toBe(true)
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
