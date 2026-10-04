// @vitest-environment jsdom
// 可编辑表格(对标 Handsontable / AG Grid / vxe-table):必填列表头红星、下拉选项多时自动可搜索、
// save: 'cell' 即时保存(失败回滚)、Ctrl+Z 撤销最近一次提交、aria-selected / aria-readonly。
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import SmartTable from '../src/SmartTable.vue'
import type { EditSavePayload, SmartTableColumn } from '../src/types'

interface Row {
  id: number
  name: string
  qty: number
  kind: string
  on: boolean
}
const rows = (): Row[] => [
  { id: 1, name: 'alice', qty: 3, kind: 'a', on: true },
  { id: 2, name: 'bob', qty: 4, kind: 'b', on: false },
]
const opts = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ label: `L${i}`, value: `v${i}` }))
const columns = (n = 3): SmartTableColumn<unknown>[] => [
  { key: 'name', title: 'Name', rules: { required: true } },
  { key: 'qty', title: 'Qty' },
  { key: 'kind', title: 'Kind', options: opts(n) },
  { key: 'on', title: 'On' },
]

beforeAll(() => {
  Element.prototype.scrollTo ??= () => {}
})
let wrapper: VueWrapper | null = null
function mountTable(
  props: Record<string, unknown> = {},
  attrs: Record<string, unknown> = {},
): VueWrapper {
  wrapper = mount(SmartTable, {
    props: {
      columns: columns(),
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
})
const td = (w: VueWrapper, id: number | string, key: string) => w.find(`td[data-xc="${id}|${key}"]`)
const press = (key: string, init: KeyboardEventInit = {}, target: Element = document.body) =>
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }),
  )
async function editCell(w: VueWrapper, id: number | string, key: string) {
  await td(w, id, key).trigger('click')
  await td(w, id, key).trigger('click')
  await flushPromises()
}
async function commitText(w: VueWrapper, id: number | string, key: string, text: string) {
  await editCell(w, id, key)
  const input = w.find('.smart-table-xe input').element as HTMLInputElement
  input.value = text
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await nextTick()
  press('Enter', {}, input)
  await flushPromises()
}

describe('必填列的表头红星(纯推断)', () => {
  it('列有 rules.required:表头标题前自动出现红色 *;没有 required 的列、没开 editable 的表格都没有', () => {
    const w = mountTable()
    const stars = (key: string) => w.find(`th[data-col-key="${key}"] .smart-table-xreq`).exists()
    expect(stars('name')).toBe(true)
    expect(stars('qty')).toBe(false)
    expect(w.find('th[data-col-key="name"] .smart-table-xreq').text()).toBe('*')
    expect(w.find('th[data-col-key="name"]').text()).toContain('Name')
    w.unmount()
    const off = mountTable({ editable: false })
    expect(off.find('.smart-table-xreq').exists()).toBe(false)
  })
})

describe('下拉选项多时自动可搜索', () => {
  it('选项 ≤ 8 个:不可搜索;> 8 个:自动 filterable;列的 editorProps.filterable 可覆盖', async () => {
    const few = mountTable({ columns: columns(8) })
    await editCell(few, 1, 'kind')
    expect(few.findComponent({ name: 'Select' }).props('filterable')).toBe(false)
    press('Escape')
    few.unmount()
    const many = mountTable({ columns: columns(9) })
    await editCell(many, 1, 'kind')
    expect(many.findComponent({ name: 'Select' }).props('filterable')).toBe(true)
    press('Escape')
    many.unmount()
    const cols = columns(9)
    ;(cols[2] as Record<string, unknown>).editorProps = { filterable: false }
    const forced = mountTable({ columns: cols })
    await editCell(forced, 1, 'kind')
    expect(forced.findComponent({ name: 'Select' }).props('filterable')).toBe(false)
  })
})

describe("editable.save: 'cell' 即时保存", () => {
  const cellTable = (onSave: (p: EditSavePayload<Row>) => void) =>
    mountTable({ editable: { save: 'cell' } }, { onSave })

  it('提交一个格就立刻发 @save,载荷只含这一处改动(与批量同形,rows 里带 type);done 后没有待保存状态', async () => {
    let payload: EditSavePayload<Row> | undefined
    const w = cellTable((p) => (payload = p))
    await commitText(w, 1, 'name', 'zed')
    expect(payload).toBeDefined()
    expect(payload!.changes.updated).toEqual([
      {
        row: expect.objectContaining({ id: 1, name: 'zed' }),
        changes: { name: { value: 'zed', oldValue: 'alice' } },
      },
    ])
    expect(payload!.changes.rows).toEqual([
      expect.objectContaining({
        type: 'updated',
        changes: { name: { value: 'zed', oldValue: 'alice' } },
      }),
    ])
    expect(payload!.changes.added).toEqual([])
    expect(payload!.changes.removed).toEqual([])
    payload!.done()
    await flushPromises()
    expect((w.vm as unknown as { dirtyCount: number }).dirtyCount).toBe(0)
    expect(td(w, 1, 'name').classes()).not.toContain('smart-table-xd')
  })

  it('失败:这个格回滚到原值,@error 带错误,单元格上提示原因', async () => {
    let payload: EditSavePayload<Row> | undefined
    const onError = vi.fn()
    const w = mountTable(
      { editable: { save: 'cell' } },
      { onSave: (p: EditSavePayload<Row>) => (payload = p), onError },
    )
    await commitText(w, 1, 'name', 'zed')
    payload!.fail(new Error('服务器拒绝'))
    await flushPromises()
    expect(onError).toHaveBeenCalledTimes(1)
    expect(td(w, 1, 'name').text()).toBe('alice')
    expect((w.vm as unknown as { dirtyCount: number }).dirtyCount).toBe(0)
    expect(document.body.textContent).toContain('服务器拒绝')
  })

  it('复选框 / Delete 清空 / 粘贴同样即时保存;新增行仍是批量待保存(不自动发)', async () => {
    const onSave = vi.fn()
    const w = cellTable(onSave)
    await w.find('td[data-xc="1|on"] .n-checkbox').trigger('click')
    await flushPromises()
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave.mock.calls[0][0].changes.updated[0].changes).toEqual({
      on: { value: false, oldValue: true },
    })
    onSave.mock.calls[0][0].done()
    await flushPromises()
    await w
      .findAll('.smart-table-toolbar-actions button')
      .find((b) => b.text() === 'Add row')!
      .trigger('click')
    await flushPromises()
    await flushPromises()
    expect(onSave).toHaveBeenCalledTimes(1) // 新增行没有自动保存
    expect((w.vm as unknown as { dirtyCount: number }).dirtyCount).toBe(1)
  })

  it('保存中不能再提交别的格(编辑被锁),done 后恢复', async () => {
    let payload: EditSavePayload<Row> | undefined
    const w = cellTable((p) => (payload = p))
    await commitText(w, 1, 'name', 'zed')
    await td(w, 2, 'name').trigger('click')
    await td(w, 2, 'name').trigger('click')
    expect(w.find('.smart-table-xe').exists()).toBe(false)
    payload!.done()
    await flushPromises()
    await editCell(w, 2, 'name')
    expect(w.find('.smart-table-xe input').exists()).toBe(true)
  })
})

describe('Ctrl+Z 撤销最近一次提交', () => {
  it('撤销最近一次提交的格(栈,逐个回退);编辑中 / 没东西可撤时不处理', async () => {
    const w = mountTable()
    await commitText(w, 1, 'name', 'one')
    await commitText(w, 2, 'name', 'two')
    expect(td(w, 2, 'name').text()).toBe('two')
    press('z', { ctrlKey: true })
    await flushPromises()
    expect(td(w, 2, 'name').text()).toBe('bob')
    expect(td(w, 1, 'name').text()).toBe('one')
    press('z', { metaKey: true })
    await flushPromises()
    expect(td(w, 1, 'name').text()).toBe('alice')
    expect((w.vm as unknown as { dirtyCount: number }).dirtyCount).toBe(0)
    const ev = new KeyboardEvent('keydown', {
      key: 'z',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    })
    document.body.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(false) // 栈空:不拦,浏览器照常
  })

  it('有编辑器开着时 Ctrl+Z 交给输入框自己(不撤销已提交的格)', async () => {
    const w = mountTable()
    await commitText(w, 1, 'name', 'one')
    await editCell(w, 2, 'name')
    press('z', { ctrlKey: true }, w.find('.smart-table-xe input').element)
    await flushPromises()
    expect(td(w, 1, 'name').text()).toBe('one')
  })

  it('保存 / 放弃之后撤销栈清空', async () => {
    const w = mountTable()
    await commitText(w, 1, 'name', 'one')
    ;(w.vm as unknown as { discard: () => void }).discard()
    await flushPromises()
    press('z', { ctrlKey: true })
    await flushPromises()
    expect(td(w, 1, 'name').text()).toBe('alice')
  })
})

describe('无障碍', () => {
  it('选中格 aria-selected;锁定 / 只读格 aria-readonly', async () => {
    const cols = columns()
    ;(cols[1] as Record<string, unknown>).readonly = true
    const w = mountTable({ columns: cols })
    await td(w, 1, 'name').trigger('click')
    await nextTick()
    expect(td(w, 1, 'name').attributes('aria-selected')).toBe('true')
    await td(w, 2, 'name').trigger('click')
    await nextTick()
    expect(td(w, 1, 'name').attributes('aria-selected')).toBeUndefined()
    expect(w.find('td[data-col-key="qty"]').attributes('aria-readonly')).toBe('true')
    expect(td(w, 1, 'name').attributes('aria-readonly')).toBeUndefined()
  })
})
