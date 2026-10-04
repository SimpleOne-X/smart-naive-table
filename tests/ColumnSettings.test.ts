// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { NCheckbox } from 'naive-ui'
import ColumnSettings from '../src/ColumnSettings.vue'
import { defaultLabels } from '../src/labels'
import type { SettingItem } from '../src/useColumns'

// N11:列设置「至少保留一列」。原型:只剩一列可见时,那一列的勾选框禁用(无提示)。

const items = (...shows: boolean[]): SettingItem[] =>
  shows.map((show, i) => ({ key: `c${i}`, title: `列${i}`, show }))

async function openPanel(list: SettingItem[]) {
  const w = mount(ColumnSettings, {
    props: { items: list, labels: defaultLabels },
    attachTo: document.body,
  })
  await w.find('button[aria-label="Columns"]').trigger('click')
  await flushPromises()
  return w
}
const disabledFlags = (w: ReturnType<typeof mount>) =>
  w.findAllComponents(NCheckbox).map((c) => c.props('disabled'))

describe('ColumnSettings 至少保留一列(N11)', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('只剩 1 个已勾选的列:那一列的勾选框禁用,其余(未勾选的)仍可勾', async () => {
    const w = await openPanel(items(true, false, false))
    expect(disabledFlags(w)).toEqual([true, false, false])
    expect(document.body.querySelectorAll('.n-checkbox--disabled')).toHaveLength(1)
    w.unmount()
  })

  it('还有 ≥ 2 个已勾选:都不禁用,取消照常发 toggle', async () => {
    const w = await openPanel(items(true, true, false))
    expect(disabledFlags(w)).toEqual([false, false, false])
    w.findAllComponents(NCheckbox)[0].vm.$emit('update:checked', false)
    await flushPromises()
    expect(w.emitted('toggle')).toEqual([['c0', false]])
    w.unmount()
  })

  it('勾回一个被隐藏的列后,原来唯一的那一列立刻解除禁用', async () => {
    const w = await openPanel(items(true, false))
    expect(disabledFlags(w)).toEqual([true, false])
    await w.setProps({ items: items(true, true) })
    expect(disabledFlags(w)).toEqual([false, false])
    w.unmount()
  })

  it('没有提示文字(原型不弹 toast,禁用态本身就是说明)', async () => {
    const w = await openPanel(items(true, false))
    expect(document.body.querySelector('[role="status"]')).toBeNull()
    w.unmount()
  })
})
