// @vitest-environment jsdom
// 条件面板的引导标签(第 1 行「条件」、跨字段行的固定「且」、窄档抽屉块头「条件 N」)与同行控件同档:
// 字号取主题 fontSize{Size}、随本行 size 走,字色 textColor2,不再写死 12px / 14px(设计 §5.3、issue #7)。
// 标签在渲染期求值的字号只能经 :style 绑定到元素上,所以断言读元素的内联样式。
import { afterEach, describe, expect, it } from 'vitest'
import { h, type Component } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { NConfigProvider } from 'naive-ui'
import type { GlobalThemeOverrides } from 'naive-ui'
import ConditionRow from '../src/ConditionRow.vue'
import ConditionPanel from '../src/ConditionPanel.vue'
import { defaultLabels } from '../src/labels'
import { blankRow } from '../src/conditionBuilder'
import type { FilterDef } from '../src/useColumns'

const def: FilterDef = {
  key: 'name',
  field: 'name',
  optionsKey: 'name',
  title: '名称',
  mode: 'condition',
  multiple: true,
  type: 'input',
  actions: ['contains'],
}
const common = {
  labels: defaultLabels,
  getOptions: () => [],
  isLoadingOptions: () => false,
}

// 三档取不同的值,才能区分「随 size 走」和「恰好都是某个常量」
const SIZES: GlobalThemeOverrides = {
  common: {
    fontSizeSmall: '13px',
    fontSizeMedium: '16px',
    fontSizeLarge: '19px',
    textColor2: '#123456',
  },
}
const TEXT2 = 'rgb(18, 52, 86)'

const mounted: VueWrapper[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()!.unmount()
  document.body.innerHTML = ''
})
function mountIn(
  component: Component,
  props: Record<string, unknown>,
  overrides?: GlobalThemeOverrides,
) {
  const w = mount(
    () => h(NConfigProvider, { themeOverrides: overrides }, { default: () => h(component, props) }),
    { attachTo: document.body },
  )
  mounted.push(w)
  return w.element.parentElement as HTMLElement
}
const row = (extra: Record<string, unknown> = {}, overrides: GlobalThemeOverrides = SIZES) =>
  mountIn(
    ConditionRow,
    { ...common, def, condition: { action: 'contains', value: null }, ...extra },
    overrides,
  )
const lead = (root: HTMLElement) => root.querySelector<HTMLElement>('.smart-table-filter-lead')!

describe('ConditionRow 引导标签:字号随 size 取主题 fontSize,字色 textColor2', () => {
  it('第 1 行「条件」:默认 small → fontSizeSmall', () => {
    const el = lead(row())
    expect(el.textContent).toBe(defaultLabels.filterConditionLead)
    expect(el.style.fontSize).toBe('13px')
    expect(el.style.color).toBe(TEXT2)
  })

  it('跨字段行的固定「且」与「条件」同一个标签,同样取 fontSizeSmall', () => {
    const el = lead(row({ index: 1, lead: defaultLabels.filterLogicAnd }))
    expect(el.textContent).toBe(defaultLabels.filterLogicAnd)
    expect(el.style.fontSize).toBe('13px')
    expect(el.style.color).toBe(TEXT2)
  })

  it('size=medium → fontSizeMedium;size=large → fontSizeLarge', () => {
    expect(lead(row({ size: 'medium' })).style.fontSize).toBe('16px')
    expect(lead(row({ size: 'large' })).style.fontSize).toBe('19px')
  })

  it('不写死 px:Naive 默认主题下 small 是 fontSizeSmall 的默认值 14px,不是 12px', () => {
    expect(lead(row({}, {})).style.fontSize).toBe('14px')
  })
})

describe('ConditionPanel 窄档抽屉块头「条件 N」:同样随 size 取主题 fontSize', () => {
  const stackPanel = (size: 'small' | 'medium' | 'large') =>
    mountIn(
      ConditionPanel,
      {
        ...common,
        fields: [def],
        draft: { rows: [blankRow(def)], logic: {} },
        stack: true,
        size,
      },
      SIZES,
    )
  const head = (root: HTMLElement) =>
    root.querySelector<HTMLElement>('.smart-table-cond-panel__block-head')!

  it('large → fontSizeLarge,字色 textColor2', () => {
    const el = head(stackPanel('large'))
    expect(el.style.fontSize).toBe('19px')
    expect(el.style.color).toBe(TEXT2)
  })

  it('medium → fontSizeMedium(不是写死的 14px)', () => {
    expect(head(stackPanel('medium')).style.fontSize).toBe('16px')
  })
})
