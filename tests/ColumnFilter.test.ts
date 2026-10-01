// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
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

  async function openPanel(def: FilterDef, value: FilterValue | null, getOptions = () => [] as never[]) {
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
    expect(document.body.querySelector('.smart-table-filter-add')!.hasAttribute('disabled')).toBe(true)
    w.unmount()
  })

  it('两行 + 「或」:确认后提交 { logic: or, conditions: [两条] }', async () => {
    const w = await openPanel(conditionDef(), null)
    docClick(document.body.querySelector('.smart-table-filter-add'))
    await nextTick()
    const rows = w.findAllComponents(ConditionRow)
    rows[0].vm.$emit('update:value', 'a')
    rows[1].vm.$emit('update:value', 'b')
    w.findComponent(NRadioGroup).vm.$emit('update:value', 'or')
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
    // 文件顶部现成的 buildOptionsDef() 是 type: 'input'(Q-12),所以这里显式改成 select;下面 isNull 那条专门覆盖 select + 无值算子。
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
      const input = document.body.querySelector('.smart-table-filter-value input') as HTMLInputElement
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
      const close = () => document.body.querySelector('.smart-table-filter-advanced-close') as HTMLElement
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
      panelEl().dispatchEvent(new KeyboardEvent('keydown', { key: k, shiftKey, bubbles: true, cancelable: true }))
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
        props: { def: conditionDef({ title: '姓名' }), value: null, labels, getOptions: () => [], isLoadingOptions: () => false },
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
      (document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }))
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
    const expanded = (w: ReturnType<typeof mount>) => w.find('.smart-table-filter-trigger button').attributes('aria-expanded')

    it('删除一行(被点的 × 随行卸载):焦点落到顶替它的那一行;之后 Esc 照常关闭面板', async () => {
      const w = await openPanel(conditionDef(), v('and', ['contains', 'a'], ['contains', 'b']))
      focusAndClick(document.body.querySelector('.smart-table-filter-remove'))
      await flushPromises()
      expectFocusUsableInPanel()
      expect(document.body.querySelector('.smart-table-filter-row')!.contains(document.activeElement)).toBe(true)
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
      expect(document.body.querySelector('.smart-table-filter-add')!.hasAttribute('disabled')).toBe(true)
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
      expect(document.body.querySelector('.smart-table-filter-row')!.contains(document.activeElement)).toBe(true)
      focusAndClick(document.body.querySelector('.smart-table-filter-advanced-close'))
      await flushPromises()
      expectFocusUsableInPanel()
      expect(document.body.querySelector('.smart-table-filter-options')!.contains(document.activeElement)).toBe(true)
      pressOnFocused('Escape')
      await flushPromises()
      expect(expanded(w)).toBe('false')
      w.unmount()
    })
  })

  it('openRequest 变大 = 请求打开面板(chips 点击用)', async () => {
    const w = mount(ColumnFilter, {
      props: { def: conditionDef(), value: null, labels, getOptions: () => [], isLoadingOptions: () => false, openRequest: 0 },
      attachTo: document.body,
    })
    expect(document.body.querySelector('.smart-table-filter')).toBeNull()
    await w.setProps({ openRequest: 1 })
    await flushPromises()
    expect(document.body.querySelector('.smart-table-filter')).not.toBeNull()
    w.unmount()
  })
})
