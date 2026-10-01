// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { h, defineComponent } from 'vue'
import { NConfigProvider, darkTheme } from 'naive-ui'
import ColumnFilter from '../src/ColumnFilter.vue'
import { filterValueToOptions, optionsToFilterValue } from '../src/filter'
import { fmt } from '../src/labels'
import type { FilterDef } from '../src/useColumns'
import type { FilterValue, SmartTableLabels } from '../src/types'

const labels = {
  filter: '过滤',
  filterReset: '重置',
  filterConfirm: '确定',
  filterSelectAll: '全选',
  filterActiveCount: '已筛选 {n} 条',
} as unknown as Required<SmartTableLabels>

let mountCount = 0
const TrackedPanel = defineComponent({
  setup() {
    mountCount++
    return () => h('div', { class: 'tracked-panel' }, 'panel')
  },
})

function buildDef(): FilterDef {
  return {
    key: 'deptId',
    field: 'deptId',
    optionsKey: 'deptId',
    mode: 'condition',
    multiple: false,
    type: 'input',
    actions: ['equal'],
    render: () => h(TrackedPanel),
  }
}

function buildOptionsDef(): FilterDef {
  return {
    key: 'status',
    field: 'status',
    optionsKey: 'status',
    mode: 'options',
    multiple: true,
    type: 'input',
    actions: ['equal'],
  }
}

// n-popover 的内容通过 v-binder-follower-container teleport 到 document.body 顶层,
// 不在 wrapper 自己的 DOM 子树里 —— wrapper.find()/trigger() 找不到,只能直接查 document
// 并派发原生事件(Vue 的合成事件底层就是原生 DOM 监听器,派发原生事件一样能触发)。
function click(el: Element | null) {
  if (!el) throw new Error('element not found')
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
}

describe('ColumnFilter 勾选列表:全选不该替 disabled 选项做主', () => {
  const options = [
    { label: 'A', value: 'a' },
    { label: 'B(disabled)', value: 'b', disabled: true },
    { label: 'C', value: 'c' },
  ]

  it('点「全选」只勾上用户能操作的选项;之前就勾着的 disabled 选项保持勾选,没勾的 disabled 选项不会被顺带选中', async () => {
    const wrapper = mount(ColumnFilter, {
      props: {
        def: buildOptionsDef(),
        value: optionsToFilterValue(['b']), // 编程式预先勾了 disabled 选项 b
        labels,
        getOptions: () => options,
        isLoadingOptions: () => false,
      },
      attachTo: document.body,
    })
    await wrapper.find('.smart-table-filter-trigger').trigger('click')
    await wrapper.vm.$nextTick()

    click(document.body.querySelector('.smart-table-filter-all'))
    await wrapper.vm.$nextTick()

    // 确定后校验最终值:a、c(可操作项全选)+ b(disabled,维持原状),不多不少
    const buttons = document.body.querySelectorAll('.smart-table-filter-footer button')
    click(buttons[1])
    const emitted = wrapper.emitted('update:value')!
    const value = emitted[emitted.length - 1][0] as FilterValue | null
    expect(filterValueToOptions(value).sort()).toEqual(['a', 'b', 'c'])

    wrapper.unmount()
  })

  it('全不选(取消全选)时,disabled 选项的勾选状态不受影响', async () => {
    const wrapper = mount(ColumnFilter, {
      props: {
        def: buildOptionsDef(),
        value: optionsToFilterValue(['a', 'b', 'c']),
        labels,
        getOptions: () => options,
        isLoadingOptions: () => false,
      },
      attachTo: document.body,
    })
    await wrapper.find('.smart-table-filter-trigger').trigger('click')
    await wrapper.vm.$nextTick()

    click(document.body.querySelector('.smart-table-filter-all')) // 当前全选态,点一下变全不选
    await wrapper.vm.$nextTick()
    const buttons = document.body.querySelectorAll('.smart-table-filter-footer button')
    click(buttons[1])

    const emitted = wrapper.emitted('update:value')!
    const value = emitted[emitted.length - 1][0] as FilterValue | null
    expect(filterValueToOptions(value)).toEqual(['b']) // 只剩下用户碰不到的 disabled 项

    wrapper.unmount()
  })
})

describe('ColumnFilter 自定义过滤面板', () => {
  it('拖拽/连续更新 value 时不应重新挂载自定义面板(否则交互中的控件会被打断重建)', async () => {
    mountCount = 0
    const wrapper = mount(ColumnFilter, {
      props: {
        def: buildDef(),
        value: null,
        labels,
        getOptions: () => [],
        isLoadingOptions: () => false,
      },
    })

    await wrapper.find('.smart-table-filter-trigger').trigger('click')
    await wrapper.vm.$nextTick()

    expect(mountCount).toBe(1)

    // 模拟自定义面板内部连续 setValue(如拖动 NSlider 期间父级 value prop 连续更新)
    await wrapper.setProps({ value: { logic: 'and', conditions: [{ action: 'equal', value: 1 }] } })
    await wrapper.setProps({ value: { logic: 'and', conditions: [{ action: 'equal', value: 2 }] } })
    await wrapper.setProps({ value: { logic: 'and', conditions: [{ action: 'equal', value: 3 }] } })

    expect(mountCount).toBe(1)

    wrapper.unmount()
  })
})

describe('fmt', () => {
  it('替换 {n} 占位,未提供的变量原样保留', () => {
    expect(fmt('已筛选 {n} 条', { n: 3 })).toBe('已筛选 3 条')
    expect(fmt('{a}-{b}', { a: 1 })).toBe('1-{b}')
  })
})

describe('ColumnFilter 漏斗触发器(B6 / 键盘可达)', () => {
  function mountFilter(value: FilterValue | null) {
    return mount(ColumnFilter, {
      props: { def: buildOptionsDef(), value, labels, getOptions: () => [], isLoadingOptions: () => false },
      attachTo: document.body,
    })
  }

  it('漏斗按钮可被键盘聚焦(不再是 tabindex=-1)', () => {
    const wrapper = mountFilter(null)
    const btn = wrapper.find('.smart-table-filter-trigger button')
    expect(btn.exists()).toBe(true)
    expect(btn.attributes('tabindex')).not.toBe('-1')
    wrapper.unmount()
  })

  it('未生效:没有 --active 类、没有角标,aria-label 就是「过滤」', () => {
    const wrapper = mountFilter(null)
    expect(wrapper.find('.smart-table-filter-trigger--active').exists()).toBe(false)
    expect(wrapper.find('.smart-table-filter-badge').exists()).toBe(false)
    expect(wrapper.find('.smart-table-filter-trigger button').attributes('aria-label')).toBe('过滤')
    wrapper.unmount()
  })

  it('生效 1 条:有 --active 类,没有角标', () => {
    const wrapper = mountFilter({ logic: 'and', conditions: [{ action: 'equal', value: 1 }] })
    expect(wrapper.find('.smart-table-filter-trigger--active').exists()).toBe(true)
    expect(wrapper.find('.smart-table-filter-badge').exists()).toBe(false)
    wrapper.unmount()
  })

  it('生效 > 1 条:出现条数角标,aria-label 带「已筛选 N 条」', () => {
    const wrapper = mountFilter(optionsToFilterValue([1, 2, 3]))
    expect(wrapper.find('.smart-table-filter-badge').text()).toBe('3')
    expect(wrapper.find('.smart-table-filter-trigger button').attributes('aria-label')).toBe('过滤(已筛选 3 条)')
    wrapper.unmount()
  })
})

describe('ColumnFilter 条数角标的文字色(Q-2)', () => {
  function mountBadge(theme: typeof darkTheme | null) {
    const value = optionsToFilterValue([1, 2, 3])
    const Host = defineComponent({
      render: () =>
        h(NConfigProvider, { theme }, () =>
          h(ColumnFilter, { def: buildOptionsDef(), value, labels, getOptions: () => [], isLoadingOptions: () => false }),
        ),
    })
    return mount(Host, { attachTo: document.body })
  }

  it('文字色取主题的 baseColor:亮色白、暗色黑;源码里没有写死的颜色', () => {
    const light = mountBadge(null)
    expect(light.find('.smart-table-filter-badge').attributes('style')).toContain('rgb(255, 255, 255)')
    light.unmount()
    const dark = mountBadge(darkTheme)
    expect(dark.find('.smart-table-filter-badge').attributes('style')).toContain('rgb(0, 0, 0)')
    dark.unmount()
  })
})
