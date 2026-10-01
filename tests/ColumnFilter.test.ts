// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { h, defineComponent } from 'vue'
import ColumnFilter from '../src/ColumnFilter.vue'
import { filterValueToOptions, optionsToFilterValue } from '../src/filter'
import type { FilterDef } from '../src/useColumns'
import type { FilterValue, SmartTableLabels } from '../src/types'

const labels = {
  filter: '过滤',
  filterReset: '重置',
  filterConfirm: '确定',
  filterSelectAll: '全选',
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
