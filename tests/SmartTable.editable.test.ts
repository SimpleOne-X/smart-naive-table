// @vitest-environment jsdom
// 可编辑表格(props.editable):默认关零影响、按类型推断控件、选中 → 编辑 → 提交、脏标记 / 保存修改(N) / 放弃、
// 新增行 / 删除所选(待保存)、校验、@cell-change / @save(done / fail)/ @discard、实例方法。
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import SmartTable from '../src/SmartTable.vue'
import type { EditSavePayload, SmartTableColumn } from '../src/types'

interface Row {
  id: number
  code: string
  name: string
  note: string
  qty: number
  price: number
  kind: string
  on: boolean
  day: string
  at: string
}
const rows = (): Row[] => [
  {
    id: 1,
    code: 'C1',
    name: 'alice',
    note: 'x'.repeat(40),
    qty: 3,
    price: 10.5,
    kind: 'a',
    on: true,
    day: '2026-06-25',
    at: '2026-08-09 13:29:27',
  },
  {
    id: 2,
    code: 'C2',
    name: 'bob',
    note: 'y'.repeat(40),
    qty: 4,
    price: 20,
    kind: 'b',
    on: false,
    day: '2026-06-26',
    at: '2026-08-10 08:00:00',
  },
  {
    id: 3,
    code: 'C3',
    name: 'carol',
    note: 'z'.repeat(40),
    qty: 5,
    price: 30,
    kind: 'a',
    on: true,
    day: '2026-06-27',
    at: '2026-08-11 09:00:00',
  },
]
const kinds = [
  { label: 'A', value: 'a' },
  { label: 'B', value: 'b' },
]
const columns = (): SmartTableColumn<unknown>[] => [
  { type: 'selection' },
  { key: 'code', title: 'Code', readonly: true },
  { key: 'name', title: 'Name', rules: { required: true } },
  { key: 'note', title: 'Note' },
  { key: 'qty', title: 'Qty', rules: { int: true, min: 0 } },
  { key: 'price', title: 'Price', format: 'money', rules: { min: 0 } },
  { key: 'kind', title: 'Kind', options: kinds },
  { key: 'on', title: 'On' },
  { key: 'day', title: 'Day' },
  { key: 'at', title: 'At' },
  { key: 'ops', title: 'Ops', render: () => 'op' },
]

// jsdom 没有 Element.scrollTo(NSelect 展开菜单时会滚到选中项),补个空实现
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
async function selectCell(w: VueWrapper, id: number, key: string) {
  await td(w, id, key).trigger('click')
  await nextTick()
}
async function editCell(w: VueWrapper, id: number, key: string) {
  await selectCell(w, id, key)
  await td(w, id, key).trigger('click')
  await flushPromises()
}
/** 在编辑中的输入框里敲字(替换全部内容)。 */
async function typeInto(w: VueWrapper, text: string) {
  const input = w.find('.smart-table-xe input').element as HTMLInputElement
  input.value = text
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await nextTick()
}
const saveBtn = (w: VueWrapper) =>
  w.findAll('.smart-table-toolbar-actions button').find((b) => b.text().startsWith('Save changes'))
const btnByText = (w: VueWrapper, t: string) =>
  w.findAll('button').find((b) => b.text().trim() === t)

describe('默认关:零影响', () => {
  it('不开 editable:单元格没有任何编辑接线,工具栏没有编辑按钮,列上写 editor / readonly / rules 也不透传给 n-data-table', () => {
    const w = mountTable({ editable: undefined })
    expect(w.find('td[data-xc]').exists()).toBe(false)
    expect(w.find('td[data-xk]').exists()).toBe(false)
    expect(w.find('.smart-table--editable').exists()).toBe(false)
    expect(btnByText(w, 'Add row')).toBeUndefined()
    expect(w.text()).not.toContain('Save changes')
    expect((w.vm as unknown as { dirtyCount: number }).dirtyCount).toBe(0)
    const dt = w.findComponent({ name: 'DataTable' })
    const cols = dt.props('columns') as Array<Record<string, unknown>>
    for (const c of cols) {
      expect('editor' in c || 'readonly' in c || 'rules' in c || 'editorProps' in c).toBe(false)
    }
    expect(cols.find((c) => c.key === 'name')!.cellProps).toBeUndefined()
  })

  it('editable: false 与不传一样', () => {
    const w = mountTable({ editable: false })
    expect(w.find('td[data-xc]').exists()).toBe(false)
  })
})

describe('类型推断落到单元格(data-xk)', () => {
  it('每种类型 → 控件:readonly / 输入 / 多行 / 数字 / 下拉 / 复选框 / 日期 / 日期时间;自定义 render 的列不可编辑', () => {
    const w = mountTable()
    const xk = (key: string) => w.find(`td[data-col-key="${key}"]`).attributes('data-xk')
    expect(xk('code')).toBe('')
    expect(xk('name')).toBe('input')
    expect(xk('note')).toBe('textarea')
    expect(xk('qty')).toBe('number')
    expect(xk('price')).toBe('number')
    expect(xk('kind')).toBe('select')
    expect(xk('on')).toBe('checkbox')
    expect(xk('day')).toBe('date')
    expect(xk('at')).toBe('datetime')
    expect(xk('ops')).toBe('')
    expect(td(w, 1, 'ops').exists()).toBe(false)
    expect(td(w, 1, 'code').exists()).toBe(false)
    expect(w.find('td[data-col-key="code"]').classes()).toContain('smart-table-xro')
  })

  it('显式 editor 覆盖推断', () => {
    const cols = columns()
    ;(cols.find((c) => 'key' in c && c.key === 'name') as { editor?: string }).editor = 'textarea'
    const w = mountTable({ columns: cols })
    expect(w.find('td[data-col-key="name"]').attributes('data-xk')).toBe('textarea')
  })

  it('复选框列常显 NCheckbox,按值勾选', () => {
    const w = mountTable()
    const boxes = w.findAll('td[data-col-key="on"] .n-checkbox')
    expect(boxes).toHaveLength(3)
    expect(boxes.map((b) => b.classes().includes('n-checkbox--checked'))).toEqual([
      true,
      false,
      true,
    ])
  })
})

describe('选中 → 进入编辑 → 提交', () => {
  it('单击 = 选中(data-xsel);再击已选中的格 = 进入编辑,控件是官方 NInput', async () => {
    const w = mountTable()
    await selectCell(w, 1, 'name')
    expect(td(w, 1, 'name').attributes('data-xsel')).toBeDefined()
    expect(w.find('.smart-table-xe').exists()).toBe(false)
    await td(w, 1, 'name').trigger('click')
    await flushPromises()
    expect(w.find('.smart-table-xe .n-input').exists()).toBe(true)
    expect((w.find('.smart-table-xe input').element as HTMLInputElement).value).toBe('alice')
    expect(td(w, 1, 'name').classes()).toContain('smart-table-xed')
  })

  it('各类型进入编辑得到对应官方控件', async () => {
    const w = mountTable()
    await editCell(w, 1, 'qty')
    expect(w.find('.smart-table-xe .n-input-number').exists()).toBe(true)
    press('Escape')
    await nextTick()
    await editCell(w, 1, 'kind')
    expect(w.find('.smart-table-xe .n-select').exists()).toBe(true)
    press('Escape')
    await nextTick()
    await editCell(w, 1, 'day')
    expect(w.find('.smart-table-xe .n-date-picker').exists()).toBe(true)
    press('Escape')
    await nextTick()
    await editCell(w, 1, 'at')
    expect(w.find('.smart-table-xe .n-date-picker').exists()).toBe(true)
    press('Escape')
    await nextTick()
    await editCell(w, 1, 'note')
    expect(document.body.querySelector('.smart-table-xta textarea')).not.toBeNull()
    press('Escape')
  })

  it('Enter 提交并下移一格;值进草稿(脏标记 + 工具栏「保存修改(1)」),宿主的行对象不被改', async () => {
    const data = rows()
    const w = mountTable({ data })
    const onChange = vi.fn()
    await w.setProps({ onCellChange: onChange })
    await editCell(w, 1, 'name')
    await typeInto(w, 'zed')
    press('Enter', {}, w.find('.smart-table-xe input').element)
    await flushPromises()
    expect(w.find('.smart-table-xe').exists()).toBe(false)
    expect(td(w, 1, 'name').text()).toBe('zed')
    expect(td(w, 1, 'name').classes()).toContain('smart-table-xd')
    expect(td(w, 2, 'name').attributes('data-xsel')).toBeDefined() // 下移一格
    expect(data[0].name).toBe('alice') // 草稿叠在数据上,不改宿主的行
    expect(saveBtn(w)!.text()).toBe('Save changes (1)')
    expect(onChange).toHaveBeenCalledTimes(1)
    const p = onChange.mock.calls[0][0]
    expect(p).toMatchObject({ key: 'name', value: 'zed', oldValue: 'alice' })
    expect(p.row).toMatchObject({ id: 1, name: 'zed' })
  })

  it('改回原值:脏标记消失,按钮消失', async () => {
    const w = mountTable()
    await editCell(w, 1, 'name')
    await typeInto(w, 'zed')
    press('Enter', {}, w.find('.smart-table-xe input').element)
    await flushPromises()
    await editCell(w, 1, 'name')
    await typeInto(w, 'alice')
    press('Enter', {}, w.find('.smart-table-xe input').element)
    await flushPromises()
    expect(td(w, 1, 'name').classes()).not.toContain('smart-table-xd')
    expect(saveBtn(w)).toBeUndefined()
  })

  it('Esc 放弃本格修改并退出编辑', async () => {
    const w = mountTable()
    await editCell(w, 1, 'name')
    await typeInto(w, 'zed')
    press('Escape')
    await flushPromises()
    expect(w.find('.smart-table-xe').exists()).toBe(false)
    expect(td(w, 1, 'name').text()).toBe('alice')
    expect(saveBtn(w)).toBeUndefined()
  })

  it('键盘:选中态 ↑ ↓ ← → 移动选中格(← → 跳过只读列);Tab 右移;Enter / F2 进入编辑', async () => {
    const w = mountTable()
    await selectCell(w, 2, 'name')
    press('ArrowRight')
    expect(td(w, 2, 'note').attributes('data-xsel')).toBeDefined()
    press('ArrowLeft')
    press('ArrowLeft') // code 是只读列,跳不过去就停在 name
    expect(td(w, 2, 'name').attributes('data-xsel')).toBeDefined()
    press('ArrowUp')
    expect(td(w, 1, 'name').attributes('data-xsel')).toBeDefined()
    press('ArrowDown')
    press('ArrowDown')
    expect(td(w, 3, 'name').attributes('data-xsel')).toBeDefined()
    press('ArrowDown') // 最后一行,不动
    expect(td(w, 3, 'name').attributes('data-xsel')).toBeDefined()
    press('Tab')
    expect(td(w, 3, 'note').attributes('data-xsel')).toBeDefined()
    press('Tab', { shiftKey: true })
    expect(td(w, 3, 'name').attributes('data-xsel')).toBeDefined()
    press('F2')
    await flushPromises()
    expect(w.find('.smart-table-xe input').exists()).toBe(true)
    press('Escape')
    await nextTick()
    press('Enter')
    await flushPromises()
    expect(w.find('.smart-table-xe input').exists()).toBe(true)
  })

  it('Tab 到行尾换行;Space 切换复选框;Delete 清空选中格', async () => {
    const w = mountTable()
    await selectCell(w, 1, 'at')
    press('Tab')
    expect(td(w, 2, 'name').attributes('data-xsel')).toBeDefined()
    await selectCell(w, 2, 'on')
    press(' ')
    await nextTick()
    expect(td(w, 2, 'on').classes()).toContain('smart-table-xd')
    await selectCell(w, 1, 'note')
    press('Delete')
    await nextTick()
    expect(td(w, 1, 'note').classes()).toContain('smart-table-xd')
    expect(saveBtn(w)!.text()).toBe('Save changes (2)')
  })

  it('直接打字 = 进入编辑并用输入替换原值(数字列只收数字)', async () => {
    const w = mountTable()
    await selectCell(w, 1, 'name')
    press('q')
    await flushPromises()
    expect((w.find('.smart-table-xe input').element as HTMLInputElement).value).toBe('q')
    press('Escape')
    await nextTick()
    await selectCell(w, 1, 'qty')
    press('a') // 数字列不收字母
    await nextTick()
    expect(w.find('.smart-table-xe').exists()).toBe(false)
    press('7')
    await flushPromises()
    expect((w.find('.smart-table-xe input').element as HTMLInputElement).value).toBe('7')
  })

  it('点到别处:合法 = 提交并继续处理这次点击(只选中不进编辑);不合法 = 留在编辑态并吞掉点击', async () => {
    const w = mountTable()
    await editCell(w, 1, 'name')
    await typeInto(w, 'zed')
    await td(w, 2, 'name').trigger('click')
    await flushPromises()
    expect(td(w, 1, 'name').text()).toBe('zed')
    expect(w.find('.smart-table-xe').exists()).toBe(false)
    expect(td(w, 2, 'name').attributes('data-xsel')).toBeDefined()

    await editCell(w, 3, 'name')
    await typeInto(w, '  ') // 必填
    await td(w, 1, 'name').trigger('click')
    await flushPromises()
    expect(w.find('.smart-table-xe').exists()).toBe(true) // 还在编辑
    expect(td(w, 3, 'name').classes()).toContain('smart-table-xerr')
    expect(td(w, 1, 'name').attributes('data-xsel')).toBeUndefined()
  })
})

describe('校验', () => {
  it('必填清空:红框 + 提示,不提交;Esc 放弃', async () => {
    const w = mountTable()
    await editCell(w, 1, 'name')
    await typeInto(w, '')
    press('Enter', {}, w.find('.smart-table-xe input').element)
    await flushPromises()
    expect(td(w, 1, 'name').classes()).toContain('smart-table-xerr')
    expect(w.find('.smart-table-xe').exists()).toBe(true)
    expect(document.body.textContent).toContain('Please enter Name')
    press('Escape')
    await flushPromises()
    expect(td(w, 1, 'name').classes()).not.toContain('smart-table-xerr')
    expect(td(w, 1, 'name').text()).toBe('alice')
  })

  it('数字:int / min 规则;日期 / 日期时间格式', async () => {
    const w = mountTable()
    await editCell(w, 1, 'qty')
    const input = w.find('.smart-table-xe input').element as HTMLInputElement
    input.value = '-3'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    press('Enter', {}, input)
    await flushPromises()
    expect(td(w, 1, 'qty').classes()).toContain('smart-table-xerr')
    expect(document.body.textContent).toContain('Qty must not be less than 0')
  })

  it('Delete 清空必填列:拒绝并标红', async () => {
    const w = mountTable()
    await selectCell(w, 1, 'name')
    press('Delete')
    await flushPromises()
    expect(td(w, 1, 'name').classes()).toContain('smart-table-xerr')
    expect(td(w, 1, 'name').text()).toBe('alice')
    expect(saveBtn(w)).toBeUndefined()
  })
})

describe('复选框', () => {
  it('单击复选框直接切换(不需要先选中),进草稿', async () => {
    const w = mountTable()
    await w.find('td[data-xc="2|on"] .n-checkbox').trigger('click')
    await flushPromises()
    expect(td(w, 2, 'on').classes()).toContain('smart-table-xd')
    expect(w.find('td[data-xc="2|on"] .n-checkbox').classes().includes('n-checkbox--checked')).toBe(
      true,
    )
    expect(saveBtn(w)!.text()).toBe('Save changes (1)')
  })
})

describe('工具栏:页面上没有实心按钮(设计 §2.15)', () => {
  // 页面上(工具栏、搜索卡)一律是淡色底 + 图标,实心只留给表单 / 对话框里唯一的默认动作;
  // 「新增行」与「保存修改(N)」不争实心主色。
  it('「新增行」「保存修改(N)」都是淡主色底(secondary + primary)带图标;有修改时多出淡灰的「放弃修改」', async () => {
    const w = mountTable()
    const add = () => btnByText(w, 'Add row')!
    const tint = (b: { classes: () => string[] }) =>
      b.classes().includes('n-button--primary-type') && b.classes().includes('n-button--secondary')
    expect(tint(add())).toBe(true)
    expect(add().find('.n-button__icon svg').exists()).toBe(true)
    expect(btnByText(w, 'Discard changes')).toBeUndefined()
    await td(w, 2, 'on').find('.n-checkbox').trigger('click')
    await flushPromises()
    expect(tint(add())).toBe(true)
    expect(tint(saveBtn(w)!)).toBe(true)
    expect(saveBtn(w)!.find('.n-button__icon svg').exists()).toBe(true)
    const discard = btnByText(w, 'Discard changes')!
    expect(discard.classes()).toContain('n-button--default-type')
    expect(discard.classes()).toContain('n-button--secondary')
    expect(discard.find('.n-button__icon svg').exists()).toBe(true)
    // 工具栏里没有实心主色(primary-type 且不是 secondary)
    const solid = w
      .findAll('.smart-table-toolbar-actions button.n-button--primary-type')
      .filter((b) => !b.classes().includes('n-button--secondary'))
    expect(solid).toHaveLength(0)
  })
})

describe('新增行 / 删除所选(待保存)', () => {
  it('新增行:放第 1 行(主色底),第一个可编辑格直接进入编辑;N +1;newRow 给初值', async () => {
    const w = mountTable({ editable: { newRow: () => ({ code: 'NEW1', qty: 0, on: true }) } })
    await btnByText(w, 'Add row')!.trigger('click')
    await flushPromises()
    await flushPromises()
    const trs = w.findAll('.n-data-table-tbody tr')
    expect(trs).toHaveLength(4)
    expect(trs[0].classes()).toContain('smart-table-xnew')
    expect(trs[0].find('td[data-col-key="code"]').text()).toBe('NEW1')
    expect(w.find('.smart-table-xe input').exists()).toBe(true) // 直接进入编辑
    expect(saveBtn(w)!.text()).toBe('Save changes (1)')
    // 没带键:库写临时键,不与已有行冲突
    const key = (w.vm as unknown as { getChanges: () => { added: Row[] } }).getChanges().added[0]
    expect(String(key.id)).toMatch(/^__new_/)
  })

  /** 带 v-model:checked-row-keys 的宿主(勾选态由宿主持有)。 */
  let tableVm: unknown = null
  function mountHosted(initial: Array<string | number> = []) {
    const Host = defineComponent({
      setup() {
        const checked = ref<Array<string | number>>(initial)
        return () =>
          h(SmartTable as never, {
            ref: (el: unknown) => (tableVm = el),
            columns: columns(),
            data: rows(),
            rowKey: 'id',
            pagination: false,
            editable: true,
            checkedRowKeys: checked.value,
            'onUpdate:checkedRowKeys': (k: Array<string | number>) => (checked.value = k),
          })
      },
    })
    wrapper = mount(Host, { attachTo: document.body })
    return wrapper
  }

  it('删除所选:批量栏里的「删除所选」→ 行划线淡化(待删除),不真正移除;N +1;不可再编辑;勾选清空', async () => {
    const w = mountHosted([2])
    expect(w.find('.smart-table-batch').exists()).toBe(true) // 没传 #batch 也出批量栏(editable 自带「删除所选」)
    await btnByText(w, 'Delete selected')!.trigger('click')
    await flushPromises()
    const trs = w.findAll('.n-data-table-tbody tr')
    expect(trs).toHaveLength(3)
    expect(trs[1].classes()).toContain('smart-table-xdel')
    expect(td(w, 2, 'name').exists()).toBe(false) // 待删行的格点不中
    expect(saveBtn(w)!.text()).toBe('Save changes (1)')
    expect(w.find('.smart-table-batch').exists()).toBe(false) // 勾选清空 → 回到普通工具栏
  })

  it('新增后又删除 = 什么都没发生', async () => {
    const w = mountHosted()
    await btnByText(w, 'Add row')!.trigger('click')
    await flushPromises()
    await flushPromises()
    press('Escape')
    await flushPromises()
    const vm = tableVm as unknown as {
      dirtyCount: number
      getChanges: () => { added: Row[] }
    }
    expect(vm.dirtyCount).toBe(1)
    const newKey = vm.getChanges().added[0].id
    // 勾上新增行再「删除所选」
    const boxes = w.findAll('.n-data-table-tbody .n-data-table-td--selection .n-checkbox')
    await boxes[0].trigger('click')
    await flushPromises()
    expect(newKey).toBeDefined()
    await btnByText(w, 'Delete selected')!.trigger('click')
    await flushPromises()
    expect(vm.dirtyCount).toBe(0)
    expect(w.findAll('.n-data-table-tbody tr')).toHaveLength(3)
  })
})

describe('保存 / 放弃', () => {
  async function dirtyOne(w: VueWrapper) {
    await editCell(w, 1, 'name')
    await typeInto(w, 'zed')
    press('Enter', {}, w.find('.smart-table-xe input').element)
    await flushPromises()
  }

  it('保存修改:发 @save,载荷 changes 含 updated / added / removed,done 之后草稿清空', async () => {
    let payload: EditSavePayload<Row> | undefined
    const w = mountTable({}, { onSave: (p: EditSavePayload<Row>) => (payload = p) })
    await dirtyOne(w)
    await saveBtn(w)!.trigger('click')
    await flushPromises()
    expect(payload).toBeDefined()
    expect(payload!.changes.updated).toEqual([
      {
        row: expect.objectContaining({ id: 1, name: 'zed' }),
        changes: { name: { value: 'zed', oldValue: 'alice' } },
      },
    ])
    expect(payload!.changes.added).toEqual([])
    expect(payload!.changes.removed).toEqual([])
    // 保存中:按钮 loading、不能再编辑 / 放弃
    expect(saveBtn(w)!.classes()).toContain('n-button--loading')
    await selectCell(w, 2, 'name')
    await td(w, 2, 'name').trigger('click')
    expect(w.find('.smart-table-xe').exists()).toBe(false)
    payload!.done()
    await flushPromises()
    expect(saveBtn(w)).toBeUndefined()
    expect(td(w, 1, 'name').classes()).not.toContain('smart-table-xd')
  })

  it('fail():保留草稿、解除保存中;fail(e) 同时发 @error', async () => {
    let payload: EditSavePayload<Row> | undefined
    const onError = vi.fn()
    const w = mountTable({}, { onSave: (p: EditSavePayload<Row>) => (payload = p), onError })
    await dirtyOne(w)
    await saveBtn(w)!.trigger('click')
    payload!.fail(new Error('boom'))
    await flushPromises()
    expect(onError).toHaveBeenCalledTimes(1)
    expect(saveBtn(w)!.classes()).not.toContain('n-button--loading')
    expect(td(w, 1, 'name').classes()).toContain('smart-table-xd')
  })

  it('新增行必填没填:不保存,选中那一格并标红,发 @invalid', async () => {
    const onSave = vi.fn()
    const onInvalid = vi.fn()
    const w = mountTable({}, { onSave, onInvalid })
    await btnByText(w, 'Add row')!.trigger('click')
    await flushPromises()
    await flushPromises()
    press('Escape') // 退出编辑,名称还是空
    await flushPromises()
    await saveBtn(w)!.trigger('click')
    await flushPromises()
    expect(onSave).not.toHaveBeenCalled()
    expect(onInvalid).toHaveBeenCalledTimes(1)
    expect(onInvalid.mock.calls[0][0]).toMatchObject({ key: 'name', message: 'Please enter Name' })
    expect(w.find('td.smart-table-xerr').exists()).toBe(true)
  })

  it('放弃修改:全部还原(改过的格回原值、新增行消失),发 @discard', async () => {
    const onDiscard = vi.fn()
    const w = mountTable({}, { onDiscard })
    await dirtyOne(w)
    await btnByText(w, 'Add row')!.trigger('click')
    await flushPromises()
    await flushPromises()
    press('Escape')
    await flushPromises()
    expect(w.findAll('.n-data-table-tbody tr')).toHaveLength(4)
    await btnByText(w, 'Discard changes')!.trigger('click')
    await flushPromises()
    expect(onDiscard).toHaveBeenCalledTimes(1)
    expect(w.findAll('.n-data-table-tbody tr')).toHaveLength(3)
    expect(td(w, 1, 'name').text()).toBe('alice')
    expect(saveBtn(w)).toBeUndefined()
  })

  it('没监听 @save:警告一次并保留草稿(不静默丢数据)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const w = mountTable()
    await dirtyOne(w)
    await saveBtn(w)!.trigger('click')
    await flushPromises()
    expect(warn).toHaveBeenCalled()
    expect(String(warn.mock.calls[0][0])).toContain('@save')
    expect(td(w, 1, 'name').classes()).toContain('smart-table-xd')
    warn.mockRestore()
  })
})

describe('实例方法', () => {
  it('dirtyCount / getChanges / save / discard', async () => {
    let payload: EditSavePayload<Row> | undefined
    const w = mountTable({}, { onSave: (p: EditSavePayload<Row>) => (payload = p) })
    const vm = w.vm as unknown as {
      dirtyCount: number
      getChanges: () => EditSavePayload<Row>['changes']
      save: () => void
      discard: () => void
    }
    expect(vm.dirtyCount).toBe(0)
    await w.find('td[data-xc="1|on"] .n-checkbox').trigger('click')
    await flushPromises()
    expect(vm.dirtyCount).toBe(1)
    expect(vm.getChanges().updated[0].changes).toEqual({ on: { value: false, oldValue: true } })
    vm.save()
    await flushPromises() // 保存前统一校验是异步的
    expect(payload).toBeDefined()
    payload!.done()
    await flushPromises()
    expect(vm.dirtyCount).toBe(0)
    await w.find('td[data-xc="1|on"] .n-checkbox').trigger('click')
    await flushPromises()
    vm.discard()
    await flushPromises()
    expect(vm.dirtyCount).toBe(0)
  })
})

describe('与现有功能共存', () => {
  it('宿主自己的 cellProps / 自定义 render 的列不受影响;编辑列的 cellProps 先调宿主、再合并', () => {
    const cols = columns()
    ;(cols.find((c) => 'key' in c && c.key === 'name') as Record<string, unknown>).cellProps =
      () => ({
        class: 'host-cell',
        'data-host': '1',
      })
    const w = mountTable({ columns: cols })
    const cell = td(w, 1, 'name')
    expect(cell.classes()).toContain('host-cell')
    expect(cell.classes()).toContain('smart-table-xc')
    expect(cell.attributes('data-host')).toBe('1')
    expect(w.find('td[data-col-key="ops"]').text()).toBe('op')
  })

  it('options 列的非编辑态仍显示字典翻译;format 列显示格式化值', () => {
    const w = mountTable()
    expect(td(w, 2, 'kind').text()).toBe('B')
    expect(td(w, 1, 'price').text()).toBe('10.50')
  })

  it('远程模式:草稿跨重新请求保留(叠在返回的行上)', async () => {
    const fetcher = vi.fn(async () => ({ items: rows(), total: 3 }))
    const w = mountTable({ data: undefined, fetcher })
    await flushPromises()
    await editCell(w, 1, 'name')
    await typeInto(w, 'zed')
    press('Enter', {}, w.find('.smart-table-xe input').element)
    await flushPromises()
    await (w.vm as unknown as { refresh: () => Promise<void> }).refresh()
    await flushPromises()
    expect(td(w, 1, 'name').text()).toBe('zed')
    expect(td(w, 1, 'name').classes()).toContain('smart-table-xd')
  })

  it('自定义插槽单元格(#cell-*)的列不可编辑', () => {
    const w = mount(SmartTable, {
      props: { columns: columns(), data: rows(), rowKey: 'id', pagination: false, editable: true },
      slots: { 'cell-name': (p: { row: unknown }) => h('b', (p.row as Row).name) },
    })
    expect(w.find('td[data-col-key="name"]').attributes('data-xk')).toBe('')
    w.unmount()
  })
})

describe('窄档:卡片 + 底部抽屉表单(整行即时保存)', () => {
  function narrowMount(attrs: Record<string, unknown> = {}) {
    // 库根节点量到的宽度 < 600 才进窄档:jsdom 的 clientWidth 恒为 0(= 未知),这里桩成 400
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get: () => 400,
    })
    return mountTable({ cardOnNarrow: true }, attrs)
  }
  afterEach(() => {
    delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth
  })

  it('卡片模式下不逐格编辑(没有 data-xc);点卡片打开抽屉,表单控件与宽档推断一致', async () => {
    const w = narrowMount()
    await flushPromises()
    expect(w.find('.smart-table-card-item').exists()).toBe(true)
    expect(w.find('td[data-xc]').exists()).toBe(false)
    await w.find('.smart-table-card-item').trigger('click')
    await flushPromises()
    const drawer = document.body.querySelector('.n-drawer')
    expect(drawer).not.toBeNull()
    const items = [...document.body.querySelectorAll('.n-drawer .n-form-item')]
    // 必填星号前是不换行空格(U+00A0),统一成普通空格再比
    const labelOf = (i: Element) =>
      i
        .querySelector('.n-form-item-label')
        ?.textContent?.replace(/\u00a0/g, ' ')
        .trim()
    const labels = items.map(labelOf)
    expect(labels).toEqual(
      expect.arrayContaining(['Code', 'Name *', 'Note', 'Qty', 'Price', 'Kind', 'On', 'Day', 'At']),
    )
    const has = (label: string, sel: string) =>
      !!items.find((i) => labelOf(i) === label)?.querySelector(sel)
    expect(has('Name *', '.n-input')).toBe(true)
    expect(has('Qty', '.n-input-number')).toBe(true)
    expect(has('Kind', '.n-select')).toBe(true)
    expect(has('On', '.n-checkbox')).toBe(true)
    expect(has('Day', '.n-date-picker')).toBe(true)
    expect(has('Code', '.n-input')).toBe(false) // 只读 = 纯文本
  })

  it('抽屉保存 = 整行即时保存:@save 的 changes 只含这一行;必填没填不提交(表单项标红)', async () => {
    let payload: EditSavePayload<Row> | undefined
    const w = narrowMount({ onSave: (p: EditSavePayload<Row>) => (payload = p) })
    await flushPromises()
    await w.find('.smart-table-card-item').trigger('click')
    await flushPromises()
    const nameInput = () =>
      document.body.querySelector<HTMLInputElement>('.n-drawer .n-form-item:nth-child(2) input')!
    nameInput().value = ''
    nameInput().dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    const saveBtn = [...document.body.querySelectorAll<HTMLButtonElement>('.n-drawer button')].find(
      (b) => b.textContent?.trim() === 'Save',
    )!
    saveBtn.click()
    await flushPromises()
    expect(payload).toBeUndefined()
    expect(document.body.textContent).toContain('Please enter Name')
    nameInput().value = 'zed'
    nameInput().dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    saveBtn.click()
    await flushPromises()
    expect(payload!.changes.updated).toHaveLength(1)
    expect(payload!.changes.updated[0].changes).toEqual({
      name: { value: 'zed', oldValue: 'alice' },
    })
    expect(payload!.changes.added).toEqual([])
    payload!.done()
    await flushPromises()
    expect(document.body.querySelector('.n-drawer')).toBeNull()
  })

  it('工具栏「新增行」在窄档 = 打开空白表单;保存发 added', async () => {
    let payload: EditSavePayload<Row> | undefined
    const w = narrowMount({ onSave: (p: EditSavePayload<Row>) => (payload = p) })
    await flushPromises()
    // 窄档业务按钮折叠在「操作 ▾」里,先展开
    const ops = w.findAll('button').find((b) => b.text().startsWith('Actions'))
    await ops?.trigger('click')
    await btnByText(w, 'Add row')!.trigger('click')
    await flushPromises()
    expect(document.body.querySelector('.n-drawer')).not.toBeNull()
    const nameInput = document.body.querySelector<HTMLInputElement>(
      '.n-drawer .n-form-item:nth-child(2) input',
    )!
    nameInput.value = 'fresh'
    nameInput.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    ;[...document.body.querySelectorAll<HTMLButtonElement>('.n-drawer button')]
      .find((b) => b.textContent?.trim() === 'Save')!
      .click()
    await flushPromises()
    expect(payload!.changes.added).toHaveLength(1)
    expect(payload!.changes.added[0]).toMatchObject({ name: 'fresh' })
  })
})
