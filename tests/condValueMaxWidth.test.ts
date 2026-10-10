// @vitest-environment jsdom
// 条件搜索栏(search.container: 'table')工具栏主行里的值输入框:宽度上限 320px,可用 CSS 变量调(issue #13)。
// 此前它只有 flex: 1 1 100px,吃掉所在行的全部剩余宽度,表格卡片越宽越长(中档约 = 卡片宽 − 502,宽档约 = 卡片宽 / 2 − 503)。
// jsdom 量不出像素:这里锁住规则本身,以及规则依赖的 DOM 事实(上限规则只命中主行里的值输入框);真实宽度由浏览器实测。
import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import ConditionBar from '../src/ConditionBar.vue'
import conditionBarSource from '../src/ConditionBar.vue?raw'
import conditionPanelSource from '../src/ConditionPanel.vue?raw'
import conditionRowSource from '../src/ConditionRow.vue?raw'
import { defaultLabels } from '../src/labels'
import type { FilterDef } from '../src/useColumns'
import { blankRow } from '../src/conditionBuilder'
import { ruleFor, rulesOf } from './sfcStyle'

const conditionBarRules = rulesOf(conditionBarSource)
const SEL = '.smart-table-cond__main :deep(.smart-table-filter-value)'

describe('值输入框封顶(issue #13)', () => {
  it('限定在 .smart-table-cond__main 内,封顶取 --smart-table-cond-value-max-width,缺省 320px', () => {
    expect(ruleFor(conditionBarRules, SEL)).toMatch(
      /max-width:\s*var\(--smart-table-cond-value-max-width, 320px\)/,
    )
  })

  it('原来的弹性与下限不变:flex: 1 1 100px、min-width: 100px', () => {
    const body = ruleFor(conditionBarRules, SEL)
    expect(body).toMatch(/flex:\s*1 1 100px/)
    expect(body).toMatch(/min-width:\s*100px/)
  })

  it('窄档输入框、「更多条件」弹层、抽屉里的值控件所在的规则都没有 max-width', () => {
    for (const r of conditionBarRules) {
      if (r.selectors.includes(SEL)) continue
      expect(r.body, r.selectors.join(', ')).not.toMatch(/max-width/)
    }
    for (const r of rulesOf(conditionPanelSource)) {
      expect(r.body, r.selectors.join(', ')).not.toMatch(/max-width/)
    }
    for (const r of rulesOf(conditionRowSource)) {
      expect(r.body, r.selectors.join(', ')).not.toMatch(/max-width/)
    }
  })
})

describe('上限规则依赖的 DOM 事实', () => {
  const mounted: VueWrapper[] = []
  afterEach(() => {
    while (mounted.length) mounted.pop()!.unmount()
  })

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
  ]
  const mountBar = (tier: 'narrow' | 'mid' | 'wide') => {
    const w = mount(ConditionBar, {
      props: {
        fields: defs,
        draft: { rows: [blankRow(defs[0])], logic: {} },
        labels: defaultLabels,
        getOptions: () => [],
        isLoadingOptions: () => false,
        tier,
      },
      attachTo: document.body,
    })
    mounted.push(w)
    return w
  }

  it('宽 / 中档的值输入框在 .smart-table-cond__main 里(上限规则会命中)', () => {
    for (const tier of ['wide', 'mid'] as const) {
      const w = mountBar(tier)
      expect(w.find('.smart-table-cond__main .smart-table-filter-value').exists()).toBe(true)
    }
  })

  it('窄档的输入框不在 .smart-table-cond__main 里(上限规则不会命中,仍铺满整行)', () => {
    const w = mountBar('narrow')
    expect(w.find('.smart-table-cond__main').exists()).toBe(false)
    expect(w.find('.smart-table-cond__narrow-input .smart-table-filter-value').exists()).toBe(true)
  })
})
