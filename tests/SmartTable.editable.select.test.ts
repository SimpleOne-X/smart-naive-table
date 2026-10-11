// @vitest-environment jsdom
// 可编辑表格里 select / multiselect 的编辑态回显:
// 草稿值是字符串(行里的数字被 String 化)或与选项 value 类型不同,而官方 NSelect 按严格相等匹配选项,
// 对不上时触发器显示原始值(0 / 雪花 id)。这里锁住:交给 NSelect 的值是选项自己的 value(原类型)、触发器显示选项文字、
// 对不上时显示占位文字;提交仍按 String() 比较并还原选项值类型;字符串选项值、select-table 的行为不变。
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// select-table 的面板里是 fillHeight 的嵌套表格,jsdom 没有布局,靠 ResizeObserver 拿视口高度(同 SmartTable.selectTable.test.ts)
vi.hoisted(() => {
  class RO {
    constructor(private cb: (entries: unknown[]) => void) {}
    observe(el: Element) {
      const rect = { width: 800, height: 360 }
      queueMicrotask(() =>
        this.cb([
          { target: el, contentRect: rect, borderBoxSize: [{ blockSize: 360, inlineSize: 800 }] },
        ]),
      )
    }
    unobserve() {}
    disconnect() {}
  }
  ;(window as unknown as { ResizeObserver: unknown }).ResizeObserver = RO
})
import { nextTick } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import SmartTable from '../src/SmartTable.vue'
import { defaultLabels } from '../src/labels'
import type { SmartTableColumn } from '../src/types'

const PLACEHOLDER = defaultLabels.editSelectPlaceholder
const procOptions = [
  { label: 'Cut', value: 1 },
  { label: 'Weld', value: 2 },
  { label: 'Paint', value: 3 },
]
const kindOptions = [
  { label: 'A', value: 'a' },
  { label: 'B', value: 'b' },
]
const cols = (): SmartTableColumn<unknown>[] => [
  { key: 'name', title: 'Name' },
  { key: 'proc', title: 'Proc', editor: 'select', options: procOptions },
  { key: 'kind', title: 'Kind', editor: 'select', options: kindOptions },
  { key: 'tags', title: 'Tags', editor: 'multiselect', options: procOptions },
]
interface Row {
  id: number
  name: string
  proc: unknown
  kind: unknown
  tags: unknown[]
}
const rows = (): Row[] => [
  { id: 1, name: 'a', proc: 2, kind: 'a', tags: [1, 2] },
  { id: 2, name: 'b', proc: 0, kind: '', tags: ['1', '2'] },
  { id: 3, name: 'c', proc: null, kind: 'b', tags: [1, 99] },
  { id: 4, name: 'd', proc: '2', kind: 'b', tags: [] },
  { id: 5, name: 'e', proc: 99, kind: 'b', tags: [] },
]

beforeAll(() => {
  Element.prototype.scrollTo ??= () => {}
})
beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
})
let wrapper: VueWrapper | null = null
function mountTable(
  props: Record<string, unknown> = {},
  attrs: Record<string, unknown> = {},
): VueWrapper {
  wrapper = mount(SmartTable, {
    props: {
      columns: cols(),
      data: rows(),
      rowKey: 'id',
      pagination: false,
      editable: true,
      ...props,
    },
    attrs,
    attachTo: document.body,
  })
  return wrapper
}
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

const td = (w: VueWrapper, id: number, key: string) => w.find(`td[data-xc="${id}|${key}"]`)
const press = (key: string, target: Element = document.body) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
async function editCell(w: VueWrapper, id: number, key: string) {
  await td(w, id, key).trigger('click')
  await nextTick()
  await td(w, id, key).trigger('click')
  await flushPromises()
}
const nSelect = (w: VueWrapper) => w.findComponent({ name: 'Select' })
/** 触发器里看得见的文字:选中项的 label,或没有选中时的占位文字。 */
const triggerText = (w: VueWrapper) => w.find('.smart-table-xe .n-base-selection').text()
const tagTexts = (w: VueWrapper) =>
  w.findAll('.smart-table-xe .n-base-selection-tag-wrapper').map((t) => t.text())
const saveBtn = (w: VueWrapper) =>
  w.findAll('.smart-table-toolbar-actions button').find((b) => b.text().startsWith('Save changes'))

describe('select 编辑态:数字选项值', () => {
  it('当前值是数字:交给 NSelect 的值与选项 value 同类型(数字),触发器显示选项文字', async () => {
    const w = mountTable()
    await editCell(w, 1, 'proc')
    expect(nSelect(w).props('value')).toBe(2)
    expect(triggerText(w)).toBe('Weld')
  })

  it('行里是字符串 "2"、选项值是数字 2:同样回显选项文字,交给 NSelect 的是数字 2', async () => {
    const w = mountTable()
    await editCell(w, 4, 'proc')
    expect(nSelect(w).props('value')).toBe(2)
    expect(triggerText(w)).toBe('Weld')
  })

  it('改选后提交:写回的是选项自己的数字值,@cell-change 的 value / oldValue 类型不变', async () => {
    const onChange = vi.fn()
    const w = mountTable({}, { onCellChange: onChange })
    await editCell(w, 1, 'proc')
    nSelect(w).vm.$emit('update:value', 1)
    await flushPromises()
    expect(td(w, 1, 'proc').text()).toBe('Cut')
    expect(onChange.mock.calls[0][0]).toMatchObject({ key: 'proc', value: 1, oldValue: 2 })
    expect(saveBtn(w)!.text()).toBe('Save changes (1)')
  })

  it('不改选直接 Esc 放弃:格子不变、没有脏标记', async () => {
    const w = mountTable()
    await editCell(w, 1, 'proc')
    press('Escape')
    await flushPromises()
    expect(td(w, 1, 'proc').text()).toBe('Weld')
    expect(td(w, 1, 'proc').classes()).not.toContain('smart-table-xd')
    expect(saveBtn(w)).toBeUndefined()
  })
})

describe('select 编辑态:对不上选项时显示占位文字', () => {
  it('当前值 0、选项里没有 0:触发器显示占位文字,不回显 0', async () => {
    const w = mountTable()
    await editCell(w, 2, 'proc')
    expect(nSelect(w).props('value')).toBeNull()
    expect(triggerText(w)).toBe(PLACEHOLDER)
  })

  it('当前值是 null:触发器显示占位文字', async () => {
    const w = mountTable()
    await editCell(w, 3, 'proc')
    expect(triggerText(w)).toBe(PLACEHOLDER)
  })

  it('当前值是空串:触发器显示占位文字', async () => {
    const w = mountTable()
    await editCell(w, 2, 'kind')
    expect(triggerText(w)).toBe(PLACEHOLDER)
  })

  it('当前值不在选项里(99):触发器显示占位文字;不选就离开仍按「请选择」校验,不会悄悄清空原值', async () => {
    const w = mountTable()
    await editCell(w, 5, 'proc')
    expect(triggerText(w)).toBe(PLACEHOLDER)
    press('Tab', w.find('.smart-table-xe').element)
    await flushPromises()
    expect(td(w, 5, 'proc').classes()).toContain('smart-table-xed')
    expect(td(w, 5, 'proc').classes()).toContain('smart-table-xerr')
    press('Escape')
    await flushPromises()
    expect(td(w, 5, 'proc').classes()).not.toContain('smart-table-xd')
    expect(saveBtn(w)).toBeUndefined()
  })

  it('当前值为空、列非必填:不选就离开 = 保持为空,不产生改动', async () => {
    const w = mountTable()
    await editCell(w, 3, 'proc')
    press('Tab', w.find('.smart-table-xe').element)
    await flushPromises()
    expect(td(w, 3, 'proc').classes()).not.toContain('smart-table-xed')
    expect(td(w, 3, 'proc').classes()).not.toContain('smart-table-xd')
    expect(saveBtn(w)).toBeUndefined()
  })
})

describe('select 编辑态:字符串选项值不变', () => {
  it('当前值与选项 value 都是字符串:NSelect 的值仍是该字符串,触发器显示选项文字', async () => {
    const w = mountTable()
    await editCell(w, 1, 'kind')
    expect(nSelect(w).props('value')).toBe('a')
    expect(triggerText(w)).toBe('A')
  })

  it('改选后提交:写回字符串选项值', async () => {
    const onChange = vi.fn()
    const w = mountTable({}, { onCellChange: onChange })
    await editCell(w, 1, 'kind')
    nSelect(w).vm.$emit('update:value', 'b')
    await flushPromises()
    expect(onChange.mock.calls[0][0]).toMatchObject({ key: 'kind', value: 'b', oldValue: 'a' })
  })
})

describe('multiselect 编辑态', () => {
  it('数组里是数字、选项值是数字:NSelect 的值是同类型数组,标签显示选项文字', async () => {
    const w = mountTable()
    await editCell(w, 1, 'tags')
    expect(nSelect(w).props('value')).toEqual([1, 2])
    expect(tagTexts(w)).toEqual(['Cut', 'Weld'])
  })

  it('数组里是字符串 "1" "2"、选项值是数字:按 String() 对上选项,交给 NSelect 的是数字,标签显示选项文字', async () => {
    const w = mountTable()
    await editCell(w, 2, 'tags')
    expect(nSelect(w).props('value')).toEqual([1, 2])
    expect(tagTexts(w)).toEqual(['Cut', 'Weld'])
  })

  it('数组里有不在选项里的项:该项原样保留(不悄悄丢掉),其余照常对上', async () => {
    const w = mountTable()
    await editCell(w, 3, 'tags')
    expect(nSelect(w).props('value')).toEqual([1, 99])
  })

  it('改选后提交:数组里写回选项自己的数字值', async () => {
    const onChange = vi.fn()
    const w = mountTable({}, { onCellChange: onChange })
    await editCell(w, 4, 'tags')
    nSelect(w).vm.$emit('update:value', [3, 1])
    await flushPromises()
    press('Tab', w.find('.smart-table-xe').element)
    await flushPromises()
    expect(onChange.mock.calls[0][0]).toMatchObject({ key: 'tags', value: [3, 1], oldValue: [] })
  })
})

describe('select-table 编辑态:值仍走 labelKey 的字符串语义', () => {
  it('当前值是数字 7:传给下拉表格的值是字符串 "7",不经 options 对应', async () => {
    const master = [
      { code: 'P1', label: 7 },
      { code: 'P2', label: 8 },
    ]
    const w = mountTable({
      columns: [
        {
          key: 'label',
          title: 'Label',
          editorProps: {
            columns: [{ key: 'label', title: 'Label' }],
            data: master,
            valueKey: 'code',
            labelKey: 'label',
          },
        },
      ],
      data: [{ id: 1, label: 7 }],
    })
    await editCell(w, 1, 'label')
    expect(w.findComponent({ name: 'SmartSelectTable' }).props('value')).toBe('7')
  })
})
