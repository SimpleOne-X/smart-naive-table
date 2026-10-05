// @vitest-environment jsdom
// 全部按钮统一(设计 §2.15):页面上的操作按钮 = 淡色底 + 左图标(secondary,颜色对应用途);
// 表单 / 面板 / 抽屉的操作区 = 两档(默认动作 = 实心主色且只有一个,其余 = 淡灰 secondary),底栏按钮不带图标。
// 搜索 / 重置在 SearchForm.test.ts、ConditionBar.test.ts 里,这里是其余库自己渲染的按钮。
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { NDrawerContent } from 'naive-ui'
import Toolbar from '../src/Toolbar.vue'
import ConditionPanel from '../src/ConditionPanel.vue'
import SortDrawer from '../src/SortDrawer.vue'
import EditableSheet from '../src/EditableSheet.vue'
import { defaultLabels } from '../src/labels'
import { blankRow, type BuilderDraft } from '../src/conditionBuilder'
import type { FilterDef } from '../src/useColumns'
import type { SortItem } from '../src/types'

const mounted: VueWrapper[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()!.unmount()
  document.body.innerHTML = ''
})

const cls = (el: Element) => [...el.classList]
const isTint = (el: Element) =>
  cls(el).includes('n-button--secondary') && cls(el).includes('n-button--primary-type')
const isNeutral = (el: Element) =>
  cls(el).includes('n-button--secondary') && cls(el).includes('n-button--default-type')
const isSolid = (el: Element) =>
  cls(el).includes('n-button--primary-type') && !cls(el).includes('n-button--secondary')
const hasIcon = (el: Element) => el.querySelector('.n-button__icon svg') !== null
const byText = (root: ParentNode, text: string) =>
  [...root.querySelectorAll<HTMLElement>('button')].find((b) => b.textContent?.trim() === text)!

describe('Toolbar:页面上的按钮都带图标,颜色对应用途', () => {
  const edit = { count: 2, saving: false, add: true, remove: true, restore: true }
  const mountBar = (extra: Record<string, unknown> = {}, config: Record<string, unknown> = {}) => {
    const w = mount(Toolbar, {
      props: { labels: defaultLabels, config: config as never, density: 'compact', ...extra },
      attachTo: document.body,
    })
    mounted.push(w)
    return w.element as HTMLElement
  }

  it('可编辑表格工具栏:放弃修改 = 淡灰 + 图标;新增行 / 保存修改 = 淡主色 + 图标;没有实心按钮', () => {
    const root = mountBar({ edit })
    expect(isNeutral(byText(root, 'Discard changes'))).toBe(true)
    expect(hasIcon(byText(root, 'Discard changes'))).toBe(true)
    expect(isTint(byText(root, 'Add row'))).toBe(true)
    expect(hasIcon(byText(root, 'Add row'))).toBe(true)
    const save = byText(root, 'Save changes (2)')
    expect(isTint(save)).toBe(true)
    expect(hasIcon(save)).toBe(true)
    expect([...root.querySelectorAll('button')].filter(isSolid)).toHaveLength(0)
  })

  it('保存中:转圈在同一个图标槽里替换对勾,按钮仍带 loading', () => {
    const root = mountBar({ edit: { ...edit, saving: true } })
    const save = byText(root, 'Save changes (2)')
    expect(save.classList.contains('n-button--loading')).toBe(true)
    expect(save.querySelector('.n-button__icon')).not.toBeNull()
  })

  it('批量栏(可编辑):删除所选 = 淡红 + 垃圾桶;恢复 / 放弃 / 清除选择 = 淡灰 + 图标;保存 = 淡主色 + 对勾', () => {
    const root = mountBar({ edit, batch: { count: 3, checked: true, indeterminate: false } })
    const del = byText(root, defaultLabels.editDeleteSelected)
    expect(cls(del)).toContain('n-button--error-type')
    expect(cls(del)).toContain('n-button--secondary')
    expect(hasIcon(del)).toBe(true)
    for (const text of [
      defaultLabels.editRestoreSelected,
      defaultLabels.editDiscard,
      defaultLabels.clearSelection,
    ]) {
      expect(isNeutral(byText(root, text))).toBe(true)
      expect(hasIcon(byText(root, text))).toBe(true)
    }
    expect(isTint(byText(root, 'Save changes (2)'))).toBe(true)
    expect([...root.querySelectorAll('button')].filter(isSolid)).toHaveLength(0)
  })

  it('「更多」菜单按钮 = 淡灰(尾部下拉箭头充当图标);窄档折叠的「操作」与「排序」也是淡灰', () => {
    const root = mountBar({}, { more: [{ label: '导出', key: 'export' }] })
    const more = byText(root, defaultLabels.more)
    expect(isNeutral(more)).toBe(true)
    expect(hasIcon(more)).toBe(true)
    const fold = mountBar(
      { fold: true, tier: 'narrow', sortEntry: true, title: 'T' },
      { more: [{ label: '导出', key: 'export' }] },
    )
    const ops = fold.querySelector<HTMLElement>('.smart-table-toolbar-ops')!
    expect(isNeutral(ops)).toBe(true)
    const sort = byText(fold, defaultLabels.sort)
    expect(isNeutral(sort)).toBe(true)
    expect(hasIcon(sort)).toBe(true)
  })
})

describe('操作区底栏(设计 §2.15 B):默认动作实心主色、其余淡灰,不带图标', () => {
  it('条件面板(气泡):添加条件 = 淡灰 + 加号;重置 = 淡灰无图标;确认 = 实心主色', () => {
    const defs: FilterDef[] = [
      {
        key: 'name',
        field: 'name',
        optionsKey: 'name',
        title: '名称',
        mode: 'condition',
        type: 'input',
        multiple: true,
        actions: ['contains', 'equal'],
      },
    ]
    const draft: BuilderDraft = { rows: [blankRow(defs[0])], logic: {} }
    const w = mount(ConditionPanel, {
      props: {
        fields: defs,
        draft,
        labels: defaultLabels,
        getOptions: () => [],
        isLoadingOptions: () => false,
        dateValueFormat: 'yyyy-MM-dd',
      },
      attachTo: document.body,
    })
    mounted.push(w)
    const root = w.element as HTMLElement
    const add = byText(root, defaultLabels.filterAddCondition)
    expect(isNeutral(add)).toBe(true)
    expect(hasIcon(add)).toBe(true)
    const reset = byText(root, defaultLabels.filterReset)
    expect(isNeutral(reset)).toBe(true)
    expect(hasIcon(reset)).toBe(false)
    const ok = byText(root, defaultLabels.filterConfirm)
    expect(isSolid(ok)).toBe(true)
    expect(hasIcon(ok)).toBe(false)
    expect(
      [...root.querySelectorAll('.smart-table-cond-panel__footer button')].filter(isSolid),
    ).toHaveLength(1)
  })

  it('排序抽屉:重置 = 淡灰无图标;确认 = 实心主色;页脚不画分隔线', async () => {
    const w = mount(SortDrawer, {
      props: {
        show: true,
        rows: [{ key: 'a', title: 'A' }],
        current: [],
        labels: defaultLabels,
        next: (cur: SortItem[]) => cur,
      },
      attachTo: document.body,
    })
    mounted.push(w)
    await flushPromises()
    const foot = document.body.querySelector<HTMLElement>('.smart-table-sort-foot')!
    expect(isNeutral(byText(foot, defaultLabels.filterReset))).toBe(true)
    expect(hasIcon(byText(foot, defaultLabels.filterReset))).toBe(false)
    expect(isSolid(byText(foot, defaultLabels.filterConfirm))).toBe(true)
    // jsdom 的 cssstyle 会吞掉 border-top 简写,量不到内联样式:这里锁传给官方 NDrawerContent 的 footerStyle,真实效果在浏览器实测
    expect(w.findComponent(NDrawerContent).props('footerStyle')).toMatch(/border-top:\s*none/)
  })

  it('单据弹窗(窄档底部抽屉):取消 = 淡灰、保存 = 实心主色,等宽并排,无图标,无分隔线;保存中取消置灰', async () => {
    const form = { id: 'k', isNew: true, vals: {}, errs: {}, saving: false, locked: [] }
    const w = mount(EditableSheet, {
      props: { form, fields: [], labels: defaultLabels },
      attachTo: document.body,
    })
    mounted.push(w)
    await flushPromises()
    const foot = document.body.querySelector<HTMLElement>('.smart-table-sheet-foot')!
    const cancel = byText(foot, defaultLabels.editCancel)
    const save = byText(foot, defaultLabels.editSheetSave)
    expect(isNeutral(cancel)).toBe(true)
    expect(isSolid(save)).toBe(true)
    expect(hasIcon(cancel) || hasIcon(save)).toBe(false)
    expect(w.findComponent(NDrawerContent).props('footerStyle')).toMatch(/border-top:\s*none/)
    await w.setProps({ form: { ...form, saving: true } })
    await nextTick()
    expect(byText(foot, defaultLabels.editCancel).hasAttribute('disabled')).toBe(true)
    expect(save.classList.contains('n-button--loading')).toBe(true)
  })
})
