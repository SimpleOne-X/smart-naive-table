// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { h, defineComponent, nextTick } from 'vue'
import { NConfigProvider, NRadioGroup, NSelect, darkTheme } from 'naive-ui'
import ColumnFilter from '../src/ColumnFilter.vue'
import ConditionRow from '../src/ConditionRow.vue'
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
  filterAddCondition: '添加条件',
  filterRemoveCondition: '删除条件',
  filterLogicAnd: '且',
  filterLogicOr: '或',
  filterAdvanced: '高级条件',
  filterSimple: '返回列表',
  filterConditionLead: '条件',
  filterCannotCollapse: '含勾选无法表达的条件',
  filterNoValue: '无需填值',
  filterEqual: '等于',
  filterNotEqual: '不等于',
  filterContains: '包含',
  filterIsNull: '为空',
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

  it('已生效状态(漏斗图标高亮)翻转时不应重新挂载自定义面板(根因:`:is` 绑定内联箭头函数,身份每次渲染都变)', async () => {
    mountCount = 0
    const wrapper = mount(ColumnFilter, {
      props: {
        def: buildDef(),
        value: { logic: 'and', conditions: [{ action: 'equal', value: 1 }] },
        labels,
        getOptions: () => [],
        isLoadingOptions: () => false,
      },
    })

    await wrapper.find('.smart-table-filter-trigger').trigger('click')
    await wrapper.vm.$nextTick()
    expect(mountCount).toBe(1)

    // 值变空(active: true -> false)、再变回非空(false -> true)——这两次翻转都只影响漏斗图标的
    // CSS class,和自定义面板内容毫无关系,但 `:is="() => def.render!(...)"` 这种写法下,面板所在的
    // v-if 分支每次父组件重渲染都会生成一个新的箭头函数对象当"组件类型",Vue 据此判定成不同组件,
    // 整个卸载重挂——拖拽/连续输入中途的面板就会被打断重建。这里没有外部可观察的因果(面板内容本该
    // 和 active 无关),只有通过 mountCount 才能抓到。
    await wrapper.setProps({
      value: { logic: 'and', conditions: [{ action: 'equal', value: '' }] },
    })
    expect(mountCount).toBe(1)
    await wrapper.setProps({ value: { logic: 'and', conditions: [{ action: 'equal', value: 2 }] } })
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
      props: {
        def: buildOptionsDef(),
        value,
        labels,
        getOptions: () => [],
        isLoadingOptions: () => false,
      },
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
    expect(wrapper.find('.smart-table-filter-trigger button').attributes('aria-label')).toBe(
      '过滤(已筛选 3 条)',
    )
    wrapper.unmount()
  })
})

describe('ColumnFilter 条数角标的文字色(Q-2)', () => {
  function mountBadge(theme: typeof darkTheme | null) {
    const value = optionsToFilterValue([1, 2, 3])
    const Host = defineComponent({
      render: () =>
        h(NConfigProvider, { theme }, () =>
          h(ColumnFilter, {
            def: buildOptionsDef(),
            value,
            labels,
            getOptions: () => [],
            isLoadingOptions: () => false,
          }),
        ),
    })
    return mount(Host, { attachTo: document.body })
  }

  it('文字色取主题的 baseColor:亮色白、暗色黑;源码里没有写死的颜色', () => {
    const light = mountBadge(null)
    expect(light.find('.smart-table-filter-badge').attributes('style')).toContain(
      'rgb(255, 255, 255)',
    )
    light.unmount()
    const dark = mountBadge(darkTheme)
    expect(dark.find('.smart-table-filter-badge').attributes('style')).toContain('rgb(0, 0, 0)')
    dark.unmount()
  })
})

describe('ColumnFilter 多条件面板(B7 / C3)', () => {
  const docClick = click
  const conditionDef = (over: Partial<FilterDef> = {}): FilterDef => ({
    key: 'name',
    field: 'name',
    optionsKey: 'name',
    mode: 'condition',
    multiple: true,
    type: 'input',
    actions: ['contains', 'equal', 'isNull'],
    ...over,
  })
  const v = (logic: 'and' | 'or', ...conds: Array<[string, unknown]>): FilterValue => ({
    logic,
    conditions: conds.map(([action, value]) => ({ action: action as never, value })),
  })

  async function openPanel(
    def: FilterDef,
    value: FilterValue | null,
    getOptions = () => [] as never[],
  ) {
    const wrapper = mount(ColumnFilter, {
      props: { def, value, labels, getOptions, isLoadingOptions: () => false },
      attachTo: document.body,
    })
    await wrapper.find('.smart-table-filter-trigger').trigger('click')
    await flushPromises()
    return wrapper
  }
  const footerButtons = () => document.body.querySelectorAll('.smart-table-filter-footer button')
  const confirmBtn = () => footerButtons()[1]
  const lastEmitted = (w: ReturnType<typeof mount>) => {
    const e = w.emitted('update:value')!
    return e[e.length - 1][0] as FilterValue | null
  }

  it('condition 列:面板里能看到全部已有条件(不再只取第一条)', async () => {
    const w = await openPanel(conditionDef(), v('or', ['contains', 'a'], ['equal', 'b']))
    expect(document.body.querySelectorAll('.smart-table-filter-row')).toHaveLength(2)
    w.unmount()
  })

  it('添加条件到上限 5 条后「添加」按钮禁用;≥ 2 条才出现且/或', async () => {
    const w = await openPanel(conditionDef(), null)
    expect(document.body.querySelector('.smart-table-filter-logic')).toBeNull()
    for (let i = 0; i < 4; i++) {
      docClick(document.body.querySelector('.smart-table-filter-add'))
      await nextTick()
    }
    expect(document.body.querySelectorAll('.smart-table-filter-row')).toHaveLength(5)
    expect(document.body.querySelector('.smart-table-filter-logic')).not.toBeNull()
    expect(document.body.querySelector('.smart-table-filter-add')!.hasAttribute('disabled')).toBe(
      true,
    )
    w.unmount()
  })

  it('两行 + 「或」:确认后提交 { logic: or, conditions: [两条] }', async () => {
    const w = await openPanel(conditionDef(), null)
    docClick(document.body.querySelector('.smart-table-filter-add'))
    await nextTick()
    const rows = w.findAllComponents(ConditionRow)
    rows[0].vm.$emit('update:value', 'a')
    rows[1].vm.$emit('update:value', 'b')
    rows[1].vm.$emit('update:logic', 'or') // 且 / 或 是第 2 行起首列的下拉,事件在条件行上
    await nextTick()
    docClick(confirmBtn())
    expect(lastEmitted(w)).toEqual(v('or', ['contains', 'a'], ['contains', 'b']))
    w.unmount()
  })

  it('删除到只剩一行:没有「删除」按钮,且提交时 logic 归位为 and', async () => {
    const w = await openPanel(conditionDef(), v('or', ['contains', 'a'], ['contains', 'b']))
    docClick(document.body.querySelector('.smart-table-filter-remove'))
    await nextTick()
    expect(document.body.querySelectorAll('.smart-table-filter-row')).toHaveLength(1)
    expect(document.body.querySelector('.smart-table-filter-remove')).toBeNull()
    docClick(confirmBtn())
    expect(lastEmitted(w)).toEqual(v('and', ['contains', 'b']))
    w.unmount()
  })

  it('无值算子:值位置是禁用的占位框;不填值也能提交', async () => {
    const w = await openPanel(conditionDef(), v('and', ['isNull', null]))
    const input = document.body.querySelector('.smart-table-filter-value input') as HTMLInputElement
    expect(input.disabled).toBe(true)
    expect(input.placeholder).toBe('无需填值')
    docClick(confirmBtn())
    expect(lastEmitted(w)).toEqual(v('and', ['isNull', null]))
    w.unmount()
  })

  it('换操作符:旧值形状不再适用就清空(contains → isNull)', async () => {
    const w = await openPanel(conditionDef(), v('and', ['contains', 'abc']))
    w.findComponent(ConditionRow).vm.$emit('update:action', 'isNull')
    await nextTick()
    docClick(confirmBtn())
    expect(lastEmitted(w)).toEqual(v('and', ['isNull', null]))
    w.unmount()
  })

  it('列声明之外的操作符(编程式给了 notEqual)在下拉里也能显示,不是空白', async () => {
    const def = conditionDef({ actions: ['contains'] })
    const w = await openPanel(def, v('and', ['notEqual', 'x']))
    const select = w.findComponent(ConditionRow).findComponent(NSelect)
    const options = select.props('options') as Array<{ value: string }>
    expect(options.map((o) => o.value)).toEqual(['notEqual', 'contains'])
    w.unmount()
  })

  describe('options 列:勾选 ↔ 高级条件(C3:不丢信息)', () => {
    const opts = [
      { label: 'A', value: 1 },
      { label: 'B', value: 2 },
    ]
    // 真实派生里 options 列的值控件类型是 'select'(deriveFilterDefs);夹具也按这个来 —— 否则数字值会灌进 NInput,Vue 报 prop 类型 warn。
    // 文件顶部现成的 buildOptionsDef() 是 type: 'input',所以这里显式改成 select;下面 isNull 那条专门覆盖 select + 无值算子。
    const optionsDef = (): FilterDef => ({ ...buildOptionsDef(), type: 'select' })

    it('[Review Focus 3] 当前值是 notEqual:打开时自动展开高级条件并原样显示,确认不覆盖', async () => {
      const value = v('and', ['notEqual', 1])
      const w = await openPanel(optionsDef(), value, () => opts as never[])
      expect(document.body.querySelector('.smart-table-filter-options')).toBeNull() // 没有勾选列表
      expect(document.body.querySelectorAll('.smart-table-filter-row')).toHaveLength(1)
      docClick(confirmBtn())
      expect(lastEmitted(w)).toEqual(value)
      w.unmount()
    })

    it('[Review Focus 3] type: "select" 的 options 列,值是 isNull:同样自动展开高级条件,确认原样提交', async () => {
      const def = optionsDef()
      expect(def.type).toBe('select')
      const value = v('and', ['isNull', null])
      const w = await openPanel(def, value, () => opts as never[])
      expect(document.body.querySelector('.smart-table-filter-options')).toBeNull()
      expect(document.body.querySelectorAll('.smart-table-filter-row')).toHaveLength(1)
      const input = document.body.querySelector(
        '.smart-table-filter-value input',
      ) as HTMLInputElement
      expect(input.disabled).toBe(true) // isNull 无需填值
      docClick(confirmBtn())
      expect(lastEmitted(w)).toEqual(value)
      w.unmount()
    })

    it('多条 equal 取「且」(勾选读成「或」会变语义):同样展开高级条件,确认原样提交', async () => {
      const value = v('and', ['equal', 1], ['equal', 2])
      const w = await openPanel(optionsDef(), value, () => opts as never[])
      expect(document.body.querySelector('.smart-table-filter-options')).toBeNull()
      docClick(confirmBtn())
      expect(lastEmitted(w)).toEqual(value)
      w.unmount()
    })

    it('可表达(equal 取「或」)→ 仍是勾选列表', async () => {
      const w = await openPanel(optionsDef(), optionsToFilterValue([1, 2]), () => opts as never[])
      expect(document.body.querySelector('.smart-table-filter-options')).not.toBeNull()
      expect(document.body.querySelector('.smart-table-filter-row')).toBeNull()
      w.unmount()
    })

    it('勾选 → 高级:把勾选转写成条件(1 个 = equal,2 个 = 一条 in),不丢选择', async () => {
      const w = await openPanel(optionsDef(), optionsToFilterValue([1, 2]), () => opts as never[])
      docClick(document.body.querySelector('.smart-table-filter-advanced-open'))
      await nextTick()
      expect(document.body.querySelectorAll('.smart-table-filter-row')).toHaveLength(1)
      docClick(confirmBtn())
      expect(lastEmitted(w)).toEqual(v('and', ['in', [1, 2]]))
      w.unmount()
    })

    it('高级 → 返回列表:草稿不可表达时按钮禁用;改成可表达后才能返回', async () => {
      const w = await openPanel(optionsDef(), v('and', ['notEqual', 1]), () => opts as never[])
      const close = () =>
        document.body.querySelector('.smart-table-filter-advanced-close') as HTMLElement
      expect(close().hasAttribute('disabled')).toBe(true)
      w.findComponent(ConditionRow).vm.$emit('update:action', 'equal')
      await nextTick()
      expect(close().hasAttribute('disabled')).toBe(false)
      docClick(close())
      await nextTick()
      expect(document.body.querySelector('.smart-table-filter-options')).not.toBeNull()
      w.unmount()
    })
  })

  describe('键盘 / 焦点 / ARIA(公开的 NPopover 不管,库自己做;D6)', () => {
    const panelEl = () => document.body.querySelector('.smart-table-filter') as HTMLElement
    const key = (k: string, shiftKey = false) =>
      panelEl().dispatchEvent(
        new KeyboardEvent('keydown', { key: k, shiftKey, bubbles: true, cancelable: true }),
      )
    const FOCUSABLE =
      'input:not([disabled]), button:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

    it('打开后焦点进入面板', async () => {
      const w = await openPanel(conditionDef(), null)
      await flushPromises()
      expect(panelEl().contains(document.activeElement)).toBe(true)
      w.unmount()
    })

    it('Esc:关闭并丢弃草稿(不提交),焦点还给漏斗按钮', async () => {
      const w = await openPanel(conditionDef(), null)
      w.findComponent(ConditionRow).vm.$emit('update:value', 'draft-only')
      await nextTick()
      key('Escape')
      await flushPromises()
      expect(w.emitted('update:value')).toBeUndefined()
      expect(document.activeElement).toBe(w.find('.smart-table-filter-trigger button').element)
      w.unmount()
    })

    it('点「确定」关闭后焦点也还给漏斗按钮', async () => {
      const w = await openPanel(conditionDef(), null)
      w.findComponent(ConditionRow).vm.$emit('update:value', 'x')
      await nextTick()
      docClick(confirmBtn())
      await flushPromises()
      expect(document.activeElement).toBe(w.find('.smart-table-filter-trigger button').element)
      w.unmount()
    })

    it('[D6] 下拉展开时按 Esc:只留给下拉去收,面板与草稿都还在(确认仍能提交草稿)', async () => {
      const w = await openPanel(conditionDef(), null)
      const row = w.findComponent(ConditionRow)
      row.vm.$emit('update:value', 'draft')
      row.findComponent(NSelect).vm.$emit('update:show', true) // 操作符下拉展开
      await nextTick()
      key('Escape')
      await flushPromises()
      expect(panelEl()).not.toBeNull()
      expect(w.emitted('update:value')).toBeUndefined()
      docClick(confirmBtn())
      expect(lastEmitted(w)).toEqual(v('and', ['contains', 'draft']))
      w.unmount()
    })

    it('[D6] 下拉收起之后再按 Esc:才关闭面板(丢弃草稿)', async () => {
      const w = await openPanel(conditionDef(), null)
      const row = w.findComponent(ConditionRow)
      row.vm.$emit('update:value', 'draft')
      row.findComponent(NSelect).vm.$emit('update:show', true)
      row.findComponent(NSelect).vm.$emit('update:show', false)
      await nextTick()
      key('Escape')
      await flushPromises()
      expect(w.emitted('update:value')).toBeUndefined()
      expect(document.activeElement).toBe(w.find('.smart-table-filter-trigger button').element)
      w.unmount()
    })

    it('[D6 / E3] 点空白处靠容器 tabindex=-1 自动聚焦(不写 mousedown 处理):容器可聚焦,聚焦后 Esc 仍然生效', async () => {
      const w = await openPanel(conditionDef(), null)
      expect(panelEl().getAttribute('tabindex')).toBe('-1')
      panelEl().focus() // 浏览器里点空白处的效果;jsdom 不模拟鼠标点击的默认聚焦,这里直接 focus()
      expect(document.activeElement).toBe(panelEl())
      key('Escape')
      await flushPromises()
      expect(document.activeElement).toBe(w.find('.smart-table-filter-trigger button').element)
      w.unmount()
    })

    it('[D6] Tab 在面板内循环:最后一个控件 Tab → 第一个;第一个 Shift+Tab → 最后一个', async () => {
      const w = await openPanel(conditionDef(), null)
      const items = Array.from(panelEl().querySelectorAll<HTMLElement>(FOCUSABLE))
      const first = items[0]
      const last = items[items.length - 1]
      expect(first).not.toBe(last)
      last.focus()
      key('Tab')
      expect(document.activeElement).toBe(first)
      key('Tab', true)
      expect(document.activeElement).toBe(last)
      w.unmount()
    })

    it('[D6] ARIA:漏斗按钮 aria-haspopup / aria-expanded;面板 role=dialog + aria-label(列标题 + 过滤)', async () => {
      const w = mount(ColumnFilter, {
        props: {
          def: conditionDef({ title: '姓名' }),
          value: null,
          labels,
          getOptions: () => [],
          isLoadingOptions: () => false,
        },
        attachTo: document.body,
      })
      const btn = w.find('.smart-table-filter-trigger button')
      expect(btn.attributes('aria-haspopup')).toBe('dialog')
      expect(btn.attributes('aria-expanded')).toBe('false')
      await w.find('.smart-table-filter-trigger').trigger('click')
      await flushPromises()
      expect(btn.attributes('aria-expanded')).toBe('true')
      expect(panelEl().getAttribute('role')).toBe('dialog')
      expect(panelEl().getAttribute('aria-label')).toBe('姓名 过滤')
      w.unmount()
    })

    it('[D6] 自定义面板(def.render):不自动聚焦(不抢焦点);Esc 仍能关闭,焦点还给漏斗', async () => {
      const def = conditionDef({ render: () => h('button', { class: 'host-btn' }, 'x') })
      const w = await openPanel(def, null)
      await flushPromises()
      expect(panelEl().contains(document.activeElement)).toBe(false)
      key('Escape')
      await flushPromises()
      expect(document.activeElement).toBe(w.find('.smart-table-filter-trigger button').element)
      w.unmount()
    })

    it('[F3] 自定义面板不自动聚焦、焦点留在漏斗上:对漏斗按钮按 Esc 同样关闭面板,焦点留在漏斗(真实浏览器里 keydown 到不了面板容器)', async () => {
      const def = conditionDef({ render: () => h('button', { class: 'host-btn' }, 'x') })
      const w = await openPanel(def, null)
      await flushPromises()
      const btn = w.find('.smart-table-filter-trigger button')
      expect(btn.attributes('aria-expanded')).toBe('true')
      ;(btn.element as HTMLElement).focus()
      await btn.trigger('keydown', { key: 'Escape' })
      await flushPromises()
      expect(btn.attributes('aria-expanded')).toBe('false')
      expect(document.activeElement).toBe(btn.element)
      expect(w.emitted('update:value')).toBeUndefined() // 丢弃,不提交
      w.unmount()
    })
  })

  describe('[Step 13 实测] 被点的控件随更新卸载 / 禁用:焦点收回面板,不掉到 body(Esc / Tab 仍有人接)', () => {
    const panelEl = () => document.body.querySelector('.smart-table-filter') as HTMLElement
    // 真实键盘事件的目标是当前焦点元素(不是面板容器):焦点掉到 body 时,面板上的监听根本收不到
    const pressOnFocused = (k: string) =>
      (document.activeElement ?? document.body).dispatchEvent(
        new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }),
      )
    // 浏览器里点按钮会先把焦点给它,再触发 click
    const focusAndClick = (el: Element | null) => {
      ;(el as HTMLElement).focus()
      docClick(el)
    }
    const expectFocusUsableInPanel = () => {
      const a = document.activeElement as HTMLElement & { disabled?: boolean }
      expect(a).not.toBe(document.body)
      expect(panelEl().contains(a)).toBe(true)
      expect(a.disabled ?? false).toBe(false)
    }
    const expanded = (w: ReturnType<typeof mount>) =>
      w.find('.smart-table-filter-trigger button').attributes('aria-expanded')

    it('删除一行(被点的 × 随行卸载):焦点落到顶替它的那一行;之后 Esc 照常关闭面板', async () => {
      const w = await openPanel(conditionDef(), v('and', ['contains', 'a'], ['contains', 'b']))
      focusAndClick(document.body.querySelector('.smart-table-filter-remove'))
      await flushPromises()
      expectFocusUsableInPanel()
      expect(
        document.body.querySelector('.smart-table-filter-row')!.contains(document.activeElement),
      ).toBe(true)
      pressOnFocused('Escape')
      await flushPromises()
      expect(expanded(w)).toBe('false')
      expect(w.emitted('update:value')).toBeUndefined()
      w.unmount()
    })

    it('添加到上限(被点的「添加」随之禁用):焦点移到新加的那一行;之后 Esc 照常关闭面板', async () => {
      const w = await openPanel(conditionDef(), null)
      for (let i = 0; i < 4; i++) {
        focusAndClick(document.body.querySelector('.smart-table-filter-add'))
        await flushPromises()
      }
      expect(document.body.querySelector('.smart-table-filter-add')!.hasAttribute('disabled')).toBe(
        true,
      )
      expectFocusUsableInPanel()
      const rows = document.body.querySelectorAll('.smart-table-filter-row')
      expect(rows[rows.length - 1].contains(document.activeElement)).toBe(true)
      pressOnFocused('Escape')
      await flushPromises()
      expect(expanded(w)).toBe('false')
      w.unmount()
    })

    it('没到上限时「添加」后焦点留在「添加」按钮上(不多管闲事)', async () => {
      const w = await openPanel(conditionDef(), null)
      const add = document.body.querySelector('.smart-table-filter-add')
      focusAndClick(add)
      await flushPromises()
      expect(document.activeElement).toBe(add)
      w.unmount()
    })

    it('勾选 → 高级条件 → 返回列表(被点的切换按钮每次都被替换):焦点落到新内容的第一个控件;之后 Esc 照常关闭面板', async () => {
      const opts = [
        { label: 'A', value: 1 },
        { label: 'B', value: 2 },
      ]
      const def: FilterDef = { ...buildOptionsDef(), type: 'select' }
      const w = await openPanel(def, optionsToFilterValue([1]), () => opts as never[])
      focusAndClick(document.body.querySelector('.smart-table-filter-advanced-open'))
      await flushPromises()
      expectFocusUsableInPanel()
      expect(
        document.body.querySelector('.smart-table-filter-row')!.contains(document.activeElement),
      ).toBe(true)
      focusAndClick(document.body.querySelector('.smart-table-filter-advanced-close'))
      await flushPromises()
      expectFocusUsableInPanel()
      expect(
        document.body
          .querySelector('.smart-table-filter-options')!
          .contains(document.activeElement),
      ).toBe(true)
      pressOnFocused('Escape')
      await flushPromises()
      expect(expanded(w)).toBe('false')
      w.unmount()
    })
  })

  it('openRequest 变大 = 请求打开面板(chips 点击用)', async () => {
    const w = mount(ColumnFilter, {
      props: {
        def: conditionDef(),
        value: null,
        labels,
        getOptions: () => [],
        isLoadingOptions: () => false,
        openRequest: 0,
      },
      attachTo: document.body,
    })
    expect(document.body.querySelector('.smart-table-filter')).toBeNull()
    await w.setProps({ openRequest: 1 })
    await flushPromises()
    expect(document.body.querySelector('.smart-table-filter')).not.toBeNull()
    w.unmount()
  })
})

describe('ColumnFilter 漏斗触发器的外观(L0-3 / L0-4,对齐原型 .th-filter / .hf-n)', () => {
  function mountFilter(value: FilterValue | null) {
    return mount(ColumnFilter, {
      props: {
        def: buildOptionsDef(),
        value,
        labels,
        getOptions: () => [],
        isLoadingOptions: () => false,
      },
      attachTo: document.body,
    })
  }

  it('[L0-3] 触发器是原生 <button type="button">(不是 NButton):尺寸与颜色由库自己的 CSS 定,不受 NButton 的 padding / 颜色变量牵制', () => {
    const w = mountFilter(null)
    const btn = w.find('.smart-table-filter-trigger button')
    expect(btn.classes()).toContain('smart-table-filter-btn')
    expect(btn.classes()).not.toContain('n-button')
    expect(btn.attributes('type')).toBe('button')
    expect(btn.attributes('aria-haspopup')).toBe('dialog')
    expect(btn.find('svg').exists()).toBe(true)
    w.unmount()
  })

  it('[L0-4] 条数角标在按钮「里面」(绝对定位,锚是 22px 的按钮,不占行内宽度,不撑宽 / 撑高表头),且 aria-hidden(条数已在按钮的 aria-label 里)', () => {
    const w = mountFilter(optionsToFilterValue([1, 2, 3]))
    const badge = w.find('.smart-table-filter-trigger button .smart-table-filter-badge')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toBe('3')
    expect(badge.attributes('aria-hidden')).toBe('true')
    // 按钮的无障碍名只有 aria-label,不含角标的文字
    expect(w.find('.smart-table-filter-trigger button').attributes('aria-label')).toBe(
      '过滤(已筛选 3 条)',
    )
    w.unmount()
  })

  it('[L0-3] 面板打开 → 触发器带 --open(只加底色,不变色);--active(主色)只属于「已筛选」', async () => {
    const w = mountFilter(null)
    expect(w.find('.smart-table-filter-trigger--open').exists()).toBe(false)
    await w.find('.smart-table-filter-trigger').trigger('click')
    await flushPromises()
    expect(w.find('.smart-table-filter-trigger--open').exists()).toBe(true)
    expect(w.find('.smart-table-filter-trigger--active').exists()).toBe(false)
    w.unmount()
  })
})

describe('ColumnFilter 面板排布(L0-5,对齐原型 .hpop)', () => {
  const conditionDef = (over: Partial<FilterDef> = {}): FilterDef => ({
    key: 'name',
    field: 'name',
    optionsKey: 'name',
    mode: 'condition',
    multiple: true,
    type: 'input',
    actions: ['contains', 'equal', 'isNull'],
    ...over,
  })
  const two: FilterValue = {
    logic: 'or',
    conditions: [
      { action: 'contains', value: 'a' },
      { action: 'equal', value: 'b' },
    ],
  }
  async function openPanel(def: FilterDef, value: FilterValue | null) {
    const w = mount(ColumnFilter, {
      props: { def, value, labels, getOptions: () => [], isLoadingOptions: () => false },
      attachTo: document.body,
    })
    await w.find('.smart-table-filter-trigger').trigger('click')
    await flushPromises()
    return w
  }
  const q = (sel: string) => document.body.querySelector(sel) as HTMLElement | null
  const qa = (sel: string) => Array.from(document.body.querySelectorAll<HTMLElement>(sel))

  it('首列:第 1 行是「条件」引导标签,第 2 行起是且 / 或下拉(显示当前连接方式)', async () => {
    const w = await openPanel(conditionDef(), two)
    const rows = qa('.smart-table-filter-row')
    expect(rows).toHaveLength(2)
    expect(rows[0].querySelector('.smart-table-filter-lead')!.textContent).toBe('条件')
    expect(rows[0].querySelector('.smart-table-filter-logic')).toBeNull()
    expect(rows[1].querySelector('.smart-table-filter-lead')).toBeNull()
    expect(rows[1].querySelector('.smart-table-filter-logic')!.textContent).toBe('或')
    w.unmount()
  })

  it('只有 1 行时没有且 / 或下拉;下方也不再有分段按钮', async () => {
    const w = await openPanel(conditionDef(), null)
    expect(qa('.smart-table-filter-logic')).toHaveLength(0)
    expect(qa('.n-radio-group')).toHaveLength(0)
    w.unmount()
  })

  it('改且 / 或:第 2 行起任意一行的下拉都改整组的连接方式,确认后提交', async () => {
    const w = await openPanel(conditionDef(), two)
    const rows = w.findAllComponents(ConditionRow)
    expect(rows[1].props('logic')).toBe('or')
    rows[1].vm.$emit('update:logic', 'and')
    await nextTick()
    expect(w.findAllComponents(ConditionRow)[1].props('logic')).toBe('and')
    click(qa('.smart-table-filter-footer button')[1])
    const e = w.emitted('update:value')!
    expect((e[e.length - 1][0] as FilterValue).logic).toBe('and')
    w.unmount()
  })

  it('「添加条件」:官方 small 档的文字按钮,带加号图标,文字不再自带「+ 」前缀,也不再是主色', async () => {
    const w = await openPanel(conditionDef(), null)
    const add = q('.smart-table-filter-add')!
    expect(add.querySelector('svg')).not.toBeNull()
    expect(add.textContent!.trim()).toBe('添加条件')
    expect(add.classList.contains('n-button--primary-type')).toBe(false)
    // 官方 small 档(与同一面板里 small 的值控件一致):字 14 / 图标 18 / 高取主题 heightSmall 28
    expect(add.getAttribute('style')).toContain('--n-font-size: 14px')
    expect(add.getAttribute('style')).toContain('--n-icon-size: 18px')
    expect(add.getAttribute('style')).toContain('height: 28px')
    w.unmount()
  })

  it('底部「重置 / 确认」在 footer 里,footer 在面板最底部、带分隔线', async () => {
    const w = await openPanel(conditionDef(), null)
    const footer = q('.smart-table-filter-footer')!
    expect(Array.from(footer.querySelectorAll('button')).map((b) => b.textContent!.trim())).toEqual(
      ['重置', '确定'],
    )
    expect(footer.parentElement!.lastElementChild).toBe(footer)
    expect(footer.getAttribute('style')).toContain('border-top')
    w.unmount()
  })

  it('自定义面板(def.render)仍是 8px 内边距的老样式,不套新的条件面板排布', async () => {
    const w = await openPanel(
      conditionDef({ render: () => h('div', { class: 'custom' }, 'x') }),
      null,
    )
    expect(q('.smart-table-filter')!.classList.contains('smart-table-filter--custom')).toBe(true)
    expect(q('.smart-table-filter-body')).toBeNull()
    w.unmount()
  })

  describe('options 列', () => {
    const opts = [
      { label: 'A', value: 1 },
      { label: 'B', value: 2 },
    ]
    const optionsDef = (): FilterDef => ({ ...buildOptionsDef(), type: 'select' })
    async function open(value: FilterValue | null) {
      const w = mount(ColumnFilter, {
        props: {
          def: optionsDef(),
          value,
          labels,
          getOptions: () => opts as never,
          isLoadingOptions: () => false,
        },
        attachTo: document.body,
      })
      await w.find('.smart-table-filter-trigger').trigger('click')
      await flushPromises()
      return w
    }

    it('底部入口带箭头:「高级条件 ▾」;展开后「返回列表 ▴」', async () => {
      const w = await open(null)
      expect(q('.smart-table-filter-advanced-open')!.textContent!.trim()).toBe('高级条件 ▾')
      click(q('.smart-table-filter-advanced-open'))
      await nextTick()
      expect(q('.smart-table-filter-advanced-close')!.textContent!.trim()).toBe('返回列表 ▴')
      w.unmount()
    })

    it('高级条件里含勾选表达不了的条件:「返回」禁用,并给出原因提示', async () => {
      const w = await open({ logic: 'and', conditions: [{ action: 'notEqual', value: 1 }] })
      expect(q('.smart-table-filter-advanced-close')!.hasAttribute('disabled')).toBe(true)
      expect(q('.smart-table-filter-hint')!.textContent).toBe('含勾选无法表达的条件')
      w.unmount()
    })

    it('能无损收起时没有提示', async () => {
      const w = await open(null)
      click(q('.smart-table-filter-advanced-open'))
      await nextTick()
      expect(q('.smart-table-filter-hint')).toBeNull()
      w.unmount()
    })

    describe('单选(filter.multiple: false)用官方 NRadio,不是复选框', () => {
      async function openSingle(value: FilterValue | null) {
        const w = mount(ColumnFilter, {
          props: {
            def: { ...optionsDef(), multiple: false },
            value,
            labels,
            getOptions: () => opts as never,
            isLoadingOptions: () => false,
          },
          attachTo: document.body,
        })
        await w.find('.smart-table-filter-trigger').trigger('click')
        await flushPromises()
        return w
      }
      const lastValue = (w: ReturnType<typeof mount>) => {
        const e = w.emitted('update:value')!
        return e[e.length - 1][0] as FilterValue | null
      }

      it('选项是 NRadio(官方 FilterMenu.mjs:118-141 同款),没有 NCheckbox、没有「全选」', async () => {
        const w = await openSingle(null)
        expect(qa('.smart-table-filter-options .n-radio')).toHaveLength(2)
        expect(qa('.smart-table-filter-options .n-checkbox')).toHaveLength(0)
        expect(q('.smart-table-filter-options')!.classList.contains('n-radio-group')).toBe(true)
        w.unmount()
      })

      it('已有 equal 条件时对应的 radio 是选中的;换选另一个 → 提交的是新的单个 equal', async () => {
        const w = await openSingle({ logic: 'and', conditions: [{ action: 'equal', value: 1 }] })
        const radios = qa('.smart-table-filter-options .n-radio')
        expect(radios.map((r) => r.classList.contains('n-radio--checked'))).toEqual([true, false])
        w.findComponent(NRadioGroup).vm.$emit('update:value', 2)
        await nextTick()
        click(qa('.smart-table-filter-footer button')[1])
        expect(lastValue(w)).toEqual({ logic: 'or', conditions: [{ action: 'equal', value: 2 }] })
        w.unmount()
      })

      it('没选就确认 → 提交 null(清除);多选列(默认)仍是复选框', async () => {
        const w = await openSingle(null)
        click(qa('.smart-table-filter-footer button')[1])
        expect(lastValue(w)).toBeNull()
        w.unmount()
        const multi = await open(null)
        expect(qa('.smart-table-filter-options .n-checkbox').length).toBeGreaterThan(0)
        expect(qa('.smart-table-filter-options .n-radio')).toHaveLength(0)
        multi.unmount()
      })

      // 同名(name)的原生单选组在浏览器里只算一个 Tab 停靠点 ——
      // 从「高级条件 ▾」Shift+Tab 回到单选组时焦点落在「选中的那个」(或方向键移过去的那个),不一定是第 1 个 radio。
      // 所以焦点在任一 radio 上 Shift+Tab 时 trapTab 都要绕回;否则焦点会逃出面板落到页面上,之后 Esc 也关不掉面板。
      // jsdom 不模拟原生 Tab 移动焦点,所以这里断言的是 trapTab 自己的绕回。
      it('[批准的偏离 · Task 10 trapTab] 焦点在非首个 radio(同名单选组)上 Shift+Tab:绕回面板最后一个控件,不逃出面板', async () => {
        const w = await openSingle({ logic: 'and', conditions: [{ action: 'equal', value: 2 }] })
        const inputs = qa('.smart-table-filter-options input[type="radio"]')
        expect(inputs).toHaveLength(2)
        expect(inputs[0].getAttribute('name')).toBeTruthy()
        expect(inputs[1].getAttribute('name')).toBe(inputs[0].getAttribute('name'))
        inputs[1].focus()
        inputs[1].dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'Tab',
            shiftKey: true,
            bubbles: true,
            cancelable: true,
          }),
        )
        expect(document.activeElement).toBe(qa('.smart-table-filter-footer button')[1])
        w.unmount()
      })
    })
  })
})

describe('ColumnFilter 面板不出屏(L0-9)', () => {
  const def: FilterDef = {
    key: 'name',
    field: 'name',
    optionsKey: 'name',
    mode: 'condition',
    multiple: true,
    type: 'input',
    actions: ['contains'],
  }
  const realInnerWidth = window.innerWidth
  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: realInnerWidth, configurable: true })
    vi.restoreAllMocks()
  })
  const frame = () => new Promise((r) => requestAnimationFrame(() => r(null)))

  async function openAt(left: number, width: number, viewport: number) {
    Object.defineProperty(window, 'innerWidth', { value: viewport, configurable: true })
    // jsdom 没有布局:给 NPopover 的定位容器(.v-binder-follower-content,真实布局位置、不含面板自己的平移)合成一个 rect
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      if (!this.classList.contains('v-binder-follower-content')) return new DOMRect(0, 0, 0, 0)
      return new DOMRect(left, 100, width, 200)
    })
    const w = mount(ColumnFilter, {
      props: { def, value: null, labels, getOptions: () => [], isLoadingOptions: () => false },
      attachTo: document.body,
    })
    await w.find('.smart-table-filter-trigger').trigger('click')
    await flushPromises()
    await frame()
    await nextTick()
    return w
  }
  const panel = () => document.body.querySelector('.smart-table-filter') as HTMLElement

  it('左侧被裁出屏幕(left = -69,宽 374,视口 390)→ 向右平移到距左边 8px', async () => {
    const w = await openAt(-69, 374, 390)
    expect(panel().style.transform).toBe('translateX(77px)')
    w.unmount()
  })

  it('右侧被裁(left = 300,宽 200,视口 390)→ 向左平移到距右边 8px', async () => {
    const w = await openAt(300, 200, 390)
    expect(panel().style.transform).toBe('translateX(-118px)')
    w.unmount()
  })

  it('本来就在视口内 → 不加任何平移', async () => {
    const w = await openAt(100, 400, 1440)
    expect(panel().style.transform).toBe('')
    w.unmount()
  })

  it('窗口缩放时重新夹取', async () => {
    const w = await openAt(100, 400, 1440)
    expect(panel().style.transform).toBe('')
    Object.defineProperty(window, 'innerWidth', { value: 420, configurable: true })
    window.dispatchEvent(new Event('resize'))
    await frame()
    await nextTick()
    expect(panel().style.transform).toBe('translateX(-88px)')
    w.unmount()
  })

  // 滚动时 vueuc 不是在 scroll 事件里同步挪 follower,而是 Binder.js 的
  // onScroll → beforeNextFrameOnce 排一个 rAF,在 rAF 里 Follower.syncPosition 改写 .v-binder-follower-content 的 transform。
  // 我们挂在 window 捕获阶段的 scroll 监听总是先于它触发,我们的 rAF 排在它前面 → 若只在自己的 rAF 里夹取,量到的是挪之前的位置,夹取会落后一拍。
  // 这里按真实顺序模拟:先派发 scroll(我们排 rAF),再排「vueuc 的」rAF 去挪 follower。
  it('[Step 5 实测偏离] 滚动时 follower 在 vueuc 自己的 rAF 里(排在我们的 rAF 之后)才挪:挪完要重新夹取,不能落后一拍', async () => {
    let rect = new DOMRect(100, 100, 400, 200)
    Object.defineProperty(window, 'innerWidth', { value: 1440, configurable: true })
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.classList.contains('v-binder-follower-content') ? rect : new DOMRect(0, 0, 0, 0)
    })
    const w = mount(ColumnFilter, {
      props: { def, value: null, labels, getOptions: () => [], isLoadingOptions: () => false },
      attachTo: document.body,
    })
    await w.find('.smart-table-filter-trigger').trigger('click')
    await flushPromises()
    await frame()
    await nextTick()
    expect(panel().style.transform).toBe('')
    const follower = panel().closest('.v-binder-follower-content') as HTMLElement
    window.dispatchEvent(new Event('scroll')) // 我们的捕获监听先触发,排下自己的 rAF
    requestAnimationFrame(() => {
      // 「vueuc 的」rAF:把 follower 挪到右侧出屏的位置(改写它的 transform,与 Follower.syncPosition 一致)
      rect = new DOMRect(1300, 100, 400, 200)
      follower.style.transform = 'translateX(1300px) translateY(100px)'
    })
    await frame()
    await flushPromises()
    expect(panel().style.transform).toBe('translateX(-268px)')
    w.unmount()
  })
})

describe('ColumnFilter closeRequest(拖动列宽开始时收起面板:气泡锚在漏斗上,列宽一变就对不上)', () => {
  it('面板开着时 closeRequest 变大 → 面板收起、草稿丢弃(不 emit)、焦点不还给漏斗(别抢走用户刚按下的把手)', async () => {
    const wrapper = mount(ColumnFilter, {
      props: {
        def: buildOptionsDef(),
        value: null,
        labels,
        getOptions: () => [{ label: 'A', value: 'a' }],
        isLoadingOptions: () => false,
      },
      attachTo: document.body,
    })
    const btn = () => wrapper.find('.smart-table-filter-trigger button')
    await wrapper.find('.smart-table-filter-trigger').trigger('click')
    await nextTick()
    expect(btn().attributes('aria-expanded')).toBe('true')

    await wrapper.setProps({ closeRequest: 1 })
    await nextTick()
    expect(btn().attributes('aria-expanded')).toBe('false')
    expect(wrapper.emitted('update:value')).toBeUndefined()
    expect(document.activeElement).not.toBe(btn().element)

    wrapper.unmount()
  })

  it('面板没开时 closeRequest 变大什么都不做', async () => {
    const wrapper = mount(ColumnFilter, {
      props: {
        def: buildOptionsDef(),
        value: null,
        labels,
        getOptions: () => [],
        isLoadingOptions: () => false,
      },
      attachTo: document.body,
    })
    await wrapper.setProps({ closeRequest: 1 })
    await nextTick()
    expect(wrapper.find('.smart-table-filter-trigger button').attributes('aria-expanded')).toBe(
      'false',
    )
    wrapper.unmount()
  })
})

describe('ColumnFilter 弹层阴影只有一份', () => {
  // 官方 raw 气泡只去掉底色 / 圆角 / 内边距,box-shadow 仍在外壳 .n-popover 上。面板自己画同一份阴影(会单独平移出屏),
  // 所以外壳的阴影必须关掉,面板上也不能再有手抄的内联底色 / 圆角 / 阴影(它们取自外壳的官方 --n-* 变量,由样式表给)。
  // jsdom 不加载 SFC 样式,算不出最终的视觉值:真实浏览器里的 box-shadow / 圆角实测见任务汇报。
  it('外壳 .n-popover 的 box-shadow 为 none;面板不带内联的底色 / 圆角 / 阴影 / 文字色', async () => {
    const wrapper = mount(ColumnFilter, {
      props: {
        def: buildDef(),
        value: null,
        labels,
        getOptions: () => [],
        isLoadingOptions: () => false,
      },
      attachTo: document.body,
    })
    await wrapper.find('.smart-table-filter-trigger').trigger('click')
    await flushPromises()
    const panel = document.body.querySelector<HTMLElement>('.smart-table-filter')!
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
    wrapper.unmount()
  })
})
