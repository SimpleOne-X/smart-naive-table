// @vitest-environment jsdom
// 可编辑表格(进阶):行级只读 / 异步规则 / 保存前统一校验 / 多选 / 撤销删除与变更类型 / Excel 粘贴复制 / Shift+Enter / 离开保护。
// (基础交互见 SmartTable.editable.test.ts)
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import SmartTable from '../src/SmartTable.vue'
import type { EditSavePayload, SmartTableColumn } from '../src/types'

interface Row {
  id: number
  name: string
  note: string
  qty: number
  kind: string
  on: boolean
  day: string
}
const rows = (): Row[] => [
  { id: 1, name: 'alice', note: 'n-a', qty: 3, kind: 'a', on: true, day: '2026-06-25' },
  { id: 2, name: 'bob', note: 'n-b', qty: 4, kind: 'b', on: false, day: '2026-06-26' },
  { id: 3, name: 'carol', note: 'n-c', qty: 5, kind: 'a', on: true, day: '2026-06-27' },
]
const kinds = [
  { label: 'A', value: 'a' },
  { label: 'B', value: 'b' },
]
const columns = (): SmartTableColumn<unknown>[] => [
  { type: 'selection' },
  { key: 'name', title: 'Name', rules: { required: true } },
  { key: 'note', title: 'Note' },
  { key: 'qty', title: 'Qty', rules: { int: true, min: 0 } },
  { key: 'kind', title: 'Kind', options: kinds },
  { key: 'on', title: 'On' },
  { key: 'day', title: 'Day' },
]
const col = (cols: SmartTableColumn<unknown>[], key: string) =>
  cols.find((c) => 'key' in c && c.key === key) as Record<string, unknown>

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
  delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth
})

const td = (w: VueWrapper, id: number | string, key: string) => w.find(`td[data-xc="${id}|${key}"]`)
const rowTd = (w: VueWrapper, rowIndex: number, key: string) =>
  w.findAll('.n-data-table-tbody tr')[rowIndex].find(`td[data-col-key="${key}"]`)
const press = (key: string, init: KeyboardEventInit = {}, target: Element = document.body) =>
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }),
  )
async function selectCell(w: VueWrapper, id: number | string, key: string) {
  await td(w, id, key).trigger('click')
  await nextTick()
}
async function editCell(w: VueWrapper, id: number | string, key: string) {
  await selectCell(w, id, key)
  await td(w, id, key).trigger('click')
  await flushPromises()
}
async function typeInto(w: VueWrapper, text: string) {
  const input = w.find('.smart-table-xe input').element as HTMLInputElement
  input.value = text
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await nextTick()
}
async function commitText(w: VueWrapper, id: number | string, key: string, text: string) {
  await editCell(w, id, key)
  await typeInto(w, text)
  press('Enter', {}, w.find('.smart-table-xe input').element)
  await flushPromises()
}
const saveBtn = (w: VueWrapper) =>
  w.findAll('.smart-table-toolbar-actions button').find((b) => b.text().startsWith('Save changes'))
const btnByText = (w: VueWrapper, t: string) =>
  w.findAll('button').find((b) => b.text().trim() === t)

function paste(text: string, target: Element = document.body) {
  const ev = new Event('paste', { bubbles: true, cancelable: true })
  Object.defineProperty(ev, 'clipboardData', {
    value: { getData: (t: string) => (t === 'text/plain' || t === 'text' ? text : '') },
  })
  target.dispatchEvent(ev)
  return ev
}

describe('行级只读(锁定的格:可选中、不可编辑)', () => {
  it('editable.rowReadonly:该行所有格可选中但不能进入编辑(灰显 xlk、aria-readonly),复选框置灰;别的行不受影响', async () => {
    const w = mountTable({ editable: { rowReadonly: (r: Row) => r.id === 2 } })
    expect(td(w, 2, 'name').exists()).toBe(true)
    expect(td(w, 2, 'name').classes()).toContain('smart-table-xlk')
    expect(td(w, 2, 'name').attributes('aria-readonly')).toBe('true')
    expect(td(w, 1, 'name').classes()).not.toContain('smart-table-xlk')
    await selectCell(w, 2, 'name')
    expect(td(w, 2, 'name').attributes('data-xsel')).toBeDefined()
    await td(w, 2, 'name').trigger('click') // 再点也不进编辑
    press('F2')
    press('x') // 直接打字也不进
    await flushPromises()
    expect(w.find('.smart-table-xe').exists()).toBe(false)
    expect(rowTd(w, 1, 'on').find('.n-checkbox--disabled').exists()).toBe(true)
    await rowTd(w, 1, 'on').find('.n-checkbox').trigger('click')
    press(' ')
    press('Delete')
    await flushPromises()
    expect(saveBtn(w)).toBeUndefined()
  })

  it('列 readonly 函数形式 (row, index):按行锁定该列的格;方向键照常落到锁定的格上(可复制),只是不能编辑', async () => {
    const cols = columns()
    col(cols, 'name').readonly = (r: Row) => r.id === 2
    const w = mountTable({ columns: cols })
    expect(td(w, 2, 'name').classes()).toContain('smart-table-xlk')
    expect(td(w, 2, 'note').classes()).not.toContain('smart-table-xlk') // 只锁这一列的这一行
    await selectCell(w, 1, 'name')
    press('ArrowDown')
    expect(td(w, 2, 'name').attributes('data-xsel')).toBeDefined()
    press('Enter')
    await flushPromises()
    expect(w.find('.smart-table-xe').exists()).toBe(false)
    press('ArrowDown')
    expect(td(w, 3, 'name').attributes('data-xsel')).toBeDefined()
  })

  it('列显式 readonly: false 压过 rowReadonly(如「状态」列,否则停用的行永远没法再启用)', async () => {
    const cols = columns()
    col(cols, 'note').readonly = false
    const w = mountTable({ columns: cols, editable: { rowReadonly: (r: Row) => r.id === 2 } })
    expect(td(w, 2, 'note').classes()).not.toContain('smart-table-xlk')
    expect(td(w, 2, 'name').classes()).toContain('smart-table-xlk')
    await editCell(w, 2, 'note')
    expect(w.find('td[data-xc="2|note"] .smart-table-xe input').exists()).toBe(true)
  })

  it('锁定行在窄档抽屉里整行置灰(被 readonly: false 解锁的列除外)、都锁了就不能保存', async () => {
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get: () => 400,
    })
    const cols = columns()
    col(cols, 'note').readonly = false
    const w = mountTable({
      columns: cols,
      cardOnNarrow: true,
      editable: { rowReadonly: (r: Row) => r.id === 1 },
    })
    await flushPromises()
    await w.find('.smart-table-card-item').trigger('click')
    await flushPromises()
    const items = [...document.body.querySelectorAll('.n-drawer .n-form-item')]
    const inputOf = (label: string) =>
      items
        .find((i) =>
          i
            .querySelector('.n-form-item-label')
            ?.textContent?.replace(/ /g, ' ')
            .trim()
            .startsWith(label),
        )
        ?.querySelector<HTMLInputElement>('input')
    expect(inputOf('Name')!.disabled).toBe(true)
    expect(inputOf('Note')!.disabled).toBe(false)
  })

  it('整行都锁死(没有解锁的列)时抽屉「保存」置灰', async () => {
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get: () => 400,
    })
    const w = mountTable({ cardOnNarrow: true, editable: { rowReadonly: (r: Row) => r.id === 1 } })
    await flushPromises()
    await w.find('.smart-table-card-item').trigger('click')
    await flushPromises()
    const save = [...document.body.querySelectorAll<HTMLButtonElement>('.n-drawer button')].find(
      (b) => b.textContent?.trim() === 'Save',
    )!
    expect(save.disabled).toBe(true)
  })
})

describe('新增行:位置与自动聚焦', () => {
  it('editable.add: { position: "bottom" }:新增行追加在列表末尾;默认仍在最前', async () => {
    const top = mountTable()
    await btnByText(top, 'Add row')!.trigger('click')
    await flushPromises()
    await flushPromises()
    expect(top.findAll('.n-data-table-tbody tr')[0].classes()).toContain('smart-table-xnew')
    top.unmount()
    const w = mountTable({ editable: { add: { position: 'bottom' } } })
    await btnByText(w, 'Add row')!.trigger('click')
    await flushPromises()
    await flushPromises()
    const trs = w.findAll('.n-data-table-tbody tr')
    expect(trs).toHaveLength(4)
    expect(trs[3].classes()).toContain('smart-table-xnew')
    expect(trs[0].classes()).not.toContain('smart-table-xnew')
  })

  it('editable.add: false 仍然关掉「新增行」按钮', () => {
    const w = mountTable({ editable: { add: false } })
    expect(btnByText(w, 'Add row')).toBeUndefined()
  })

  it('新增后直接进入编辑的是「第一个必填且为空的格」(没有就第一个为空的可编辑格,再没有才是第一个可编辑格)', async () => {
    const w = mountTable({ editable: { newRow: () => ({ code: 'X1', qty: 1 }) } })
    await btnByText(w, 'Add row')!.trigger('click')
    await flushPromises()
    await flushPromises()
    expect(w.find('.smart-table-xe').exists()).toBe(true)
    expect(w.find('td.smart-table-xed').attributes('data-col-key')).toBe('name') // name 必填且为空
  })

  it('没有必填列时:第一个为空的可编辑格', async () => {
    const cols = columns()
    col(cols, 'name').rules = undefined
    const w = mountTable({
      columns: cols,
      editable: { newRow: () => ({ name: 'n', note: '', qty: 1 }) },
    })
    await btnByText(w, 'Add row')!.trigger('click')
    await flushPromises()
    await flushPromises()
    // name 有值 → note 是第一个为空的
    expect(w.find('td.smart-table-xed').attributes('data-col-key')).toBe('note')
  })
})

describe('异步校验(rules.validator 返回 Promise)', () => {
  function asyncTable() {
    const resolvers: Array<(v: string | true) => void> = []
    const cols = columns()
    col(cols, 'name').rules = {
      required: true,
      validator: () => new Promise<string | true>((res) => resolvers.push(res)),
    }
    const onSave = vi.fn()
    const w = mountTable({ columns: cols }, { onSave })
    return { w, onSave, resolve: (i: number, v: string | true) => resolvers[i](v) }
  }

  it('提交后值先进草稿,单元格显示加载态;落定为不通过 → 标红,「保存」被拦住并选中该格', async () => {
    const { w, onSave, resolve } = asyncTable()
    await commitText(w, 1, 'name', 'dup')
    expect(td(w, 1, 'name').text()).toBe('dup')
    expect(td(w, 1, 'name').classes()).toContain('smart-table-xchecking')
    resolve(0, '名称已存在')
    await flushPromises()
    expect(td(w, 1, 'name').classes()).not.toContain('smart-table-xchecking')
    expect(td(w, 1, 'name').classes()).toContain('smart-table-xerr')
    await saveBtn(w)!.trigger('click')
    await flushPromises()
    expect(onSave).not.toHaveBeenCalled()
    expect(td(w, 1, 'name').attributes('data-xsel')).toBeDefined()
  })

  it('保存会等还在校验的格;全部通过才发 @save', async () => {
    const { w, onSave, resolve } = asyncTable()
    await commitText(w, 1, 'name', 'ok')
    await saveBtn(w)!.trigger('click')
    await flushPromises()
    expect(onSave).not.toHaveBeenCalled()
    resolve(0, true)
    await flushPromises()
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('过期结果丢弃:同一格又改了值,先发出的校验结果回来也不生效', async () => {
    const { w, resolve } = asyncTable()
    await commitText(w, 1, 'name', 'first')
    await commitText(w, 1, 'name', 'second')
    resolve(0, '旧结果不通过')
    await flushPromises()
    expect(td(w, 1, 'name').classes()).not.toContain('smart-table-xerr')
    expect(td(w, 1, 'name').classes()).toContain('smart-table-xchecking') // 新的还在等
    resolve(1, true)
    await flushPromises()
    expect(td(w, 1, 'name').classes()).not.toContain('smart-table-xchecking')
    expect(td(w, 1, 'name').classes()).not.toContain('smart-table-xerr')
  })
})

describe('保存前统一校验', () => {
  it('草稿里有校验不过的值(规则后来变了)→ 不保存,选中第一个不合法的格,发 @invalid', async () => {
    const cols = columns()
    const onSave = vi.fn()
    const onInvalid = vi.fn()
    const w = mountTable({ columns: cols }, { onSave, onInvalid })
    await commitText(w, 1, 'name', 'ab')
    col(cols, 'name').rules = { required: true, minLength: 5 }
    await w.setProps({ columns: [...cols] })
    await saveBtn(w)!.trigger('click')
    await flushPromises()
    expect(onSave).not.toHaveBeenCalled()
    expect(onInvalid.mock.calls[0][0]).toMatchObject({
      key: 'name',
      message: 'Name needs at least 5 characters',
    })
    expect(td(w, 1, 'name').attributes('data-xsel')).toBeDefined()
    expect(td(w, 1, 'name').classes()).toContain('smart-table-xerr')
  })
})

describe('多选编辑器(值是数组 + options)', () => {
  const tagOpts = [
    { label: 'Red', value: 'r' },
    { label: 'Blue', value: 'b' },
    { label: 'Green', value: 'g' },
  ]
  const tagCols = (): SmartTableColumn<unknown>[] => [
    { key: 'name', title: 'Name' },
    { key: 'tags', title: 'Tags', options: tagOpts },
  ]
  const tagRows = () => [
    { id: 1, name: 'a', tags: ['r', 'b'] },
    { id: 2, name: 'b', tags: [] },
  ]

  it('推断:options + 数组值 → multiselect;非编辑态显示标签文字;进入编辑是 NSelect', async () => {
    const w = mountTable({ columns: tagCols(), data: tagRows() })
    expect(w.find('td[data-col-key="tags"]').attributes('data-xk')).toBe('multiselect')
    expect(td(w, 1, 'tags').text()).toBe('Red, Blue')
    await editCell(w, 1, 'tags')
    expect(w.find('.smart-table-xe .n-select').exists()).toBe(true)
  })

  it('改选后提交 = 数组进草稿;@cell-change 的 value / oldValue 都是数组', async () => {
    const onChange = vi.fn()
    const w = mountTable({ columns: tagCols(), data: tagRows() }, { onCellChange: onChange })
    await editCell(w, 2, 'tags')
    w.findComponent({ name: 'Select' }).vm.$emit('update:value', ['g'])
    await flushPromises()
    press('Enter', {}, w.find('.smart-table-xe').element)
    await flushPromises()
    expect(td(w, 2, 'tags').text()).toBe('Green')
    expect(onChange.mock.calls[0][0]).toMatchObject({ key: 'tags', value: ['g'], oldValue: [] })
    expect(saveBtn(w)!.text()).toBe('Save changes (1)')
  })
})

describe('撤销删除 / 变更类型', () => {
  function mountChecked(initial: Array<string | number>, attrs: Record<string, unknown> = {}) {
    const Host = defineComponent({
      setup() {
        const checked = ref<Array<string | number>>(initial)
        return () =>
          h(SmartTable as never, {
            columns: columns(),
            data: rows(),
            rowKey: 'id',
            pagination: false,
            editable: true,
            checkedRowKeys: checked.value,
            'onUpdate:checkedRowKeys': (k: Array<string | number>) => (checked.value = k),
            ...attrs,
          })
      },
    })
    wrapper = mount(Host, { attachTo: document.body })
    return wrapper
  }

  it('待删除的行重新勾上后批量栏出现「恢复所选」:点它撤销删除(行恢复、N 回落)', async () => {
    const w = mountChecked([2])
    await btnByText(w, 'Delete selected')!.trigger('click')
    await flushPromises()
    expect(w.findAll('.n-data-table-tbody tr')[1].classes()).toContain('smart-table-xdel')
    await w
      .findAll('.n-data-table-tbody .n-data-table-td--selection .n-checkbox')[1]
      .trigger('click')
    await flushPromises()
    expect(btnByText(w, 'Delete selected')).toBeUndefined()
    await btnByText(w, 'Restore selected')!.trigger('click')
    await flushPromises()
    expect(w.findAll('.n-data-table-tbody tr')[1].classes()).not.toContain('smart-table-xdel')
    expect(td(w, 2, 'name').exists()).toBe(true)
    expect(saveBtn(w)).toBeUndefined()
  })

  it('@save 的 changes.rows 每项带 type:created / updated / deleted', async () => {
    let payload: EditSavePayload<Row> | undefined
    const w = mountChecked([3], { onSave: (p: EditSavePayload<Row>) => (payload = p) })
    await commitText(w, 1, 'name', 'zed')
    await btnByText(w, 'Delete selected')!.trigger('click')
    await btnByText(w, 'Add row')!.trigger('click')
    await flushPromises()
    await flushPromises()
    await typeInto(w, 'fresh') // 新增行的第一个可编辑格已自动进入编辑
    press('Enter', {}, w.find('.smart-table-xe input').element)
    await flushPromises()
    await saveBtn(w)!.trigger('click')
    await flushPromises()
    await flushPromises()
    expect(payload!.changes.rows.map((r) => r.type)).toEqual(['created', 'updated', 'deleted'])
    expect(payload!.changes.rows[1]).toMatchObject({
      type: 'updated',
      changes: { name: { value: 'zed' } },
    })
  })
})

describe('Excel 粘贴 / 复制', () => {
  it('单格粘贴:按列类型转换(数字 / 布尔 / 选项标签 → 值),进草稿', async () => {
    const w = mountTable()
    await selectCell(w, 1, 'qty')
    paste('42')
    await flushPromises()
    expect(td(w, 1, 'qty').text()).toBe('42')
    await selectCell(w, 1, 'on')
    paste('FALSE')
    await flushPromises()
    expect(td(w, 1, 'on').find('.n-checkbox--checked').exists()).toBe(false)
    await selectCell(w, 1, 'kind')
    paste('B')
    await flushPromises()
    expect(td(w, 1, 'kind').text()).toBe('B')
    expect(saveBtn(w)!.text()).toBe('Save changes (3)')
  })

  it('多格块粘贴(制表符分列、换行分行):从选中格起向右向下填充,锁定行的格被跳过(对应数据丢弃)', async () => {
    const w = mountTable({ editable: { rowReadonly: (r: Row) => r.id === 2 } })
    await selectCell(w, 1, 'name')
    paste('n1\tnote1\t11\nn2\tnote2\t22\nn3\tnote3\t33')
    await flushPromises()
    expect(td(w, 1, 'name').text()).toBe('n1')
    expect(td(w, 1, 'note').text()).toBe('note1')
    expect(td(w, 1, 'qty').text()).toBe('11')
    expect(rowTd(w, 1, 'name').text()).toBe('bob')
    expect(td(w, 3, 'name').text()).toBe('n3')
    expect(td(w, 3, 'qty').text()).toBe('33')
  })

  it('块里有一格不合法:整块都不应用,选中并标红那一格,发 @invalid', async () => {
    const onInvalid = vi.fn()
    const w = mountTable({}, { onInvalid })
    await selectCell(w, 1, 'name')
    paste('ok\tnote1\t-5')
    await flushPromises()
    expect(td(w, 1, 'name').text()).toBe('alice')
    expect(saveBtn(w)).toBeUndefined()
    expect(td(w, 1, 'qty').classes()).toContain('smart-table-xerr')
    expect(onInvalid.mock.calls[0][0]).toMatchObject({ key: 'qty' })
  })

  it('超出当前列表的行被忽略(不自动追加新行);末尾换行不产生空行', async () => {
    const w = mountTable()
    await selectCell(w, 3, 'name')
    paste('x1\nx2\nx3\n')
    await flushPromises()
    expect(td(w, 3, 'name').text()).toBe('x1')
    expect(w.findAll('.n-data-table-tbody tr')).toHaveLength(3)
    expect(saveBtn(w)!.text()).toBe('Save changes (1)')
  })

  it('编辑中(输入框里)的粘贴交给浏览器,不拦', async () => {
    const w = mountTable()
    await editCell(w, 1, 'name')
    const ev = paste('zzz', w.find('.smart-table-xe input').element)
    expect(ev.defaultPrevented).toBe(false)
  })

  it('Ctrl+C:复制选中格的文本(日期 / 数字原样,布尔 TRUE / FALSE)', async () => {
    const w = mountTable()
    const copy = async (id: number, key: string) => {
      await selectCell(w, id, key)
      const ev = new Event('copy', { bubbles: true, cancelable: true })
      const setData = vi.fn()
      Object.defineProperty(ev, 'clipboardData', { value: { setData } })
      document.body.dispatchEvent(ev)
      return { text: setData.mock.calls[0]?.[1], prevented: ev.defaultPrevented }
    }
    expect(await copy(1, 'name')).toEqual({ text: 'alice', prevented: true })
    expect((await copy(1, 'qty')).text).toBe('3')
    expect((await copy(1, 'on')).text).toBe('TRUE')
    expect((await copy(2, 'on')).text).toBe('FALSE')
    expect((await copy(1, 'day')).text).toBe('2026-06-25')
  })
})

describe('校验出错不重挂编辑控件', () => {
  it('直接打字进入编辑 → 提交出错:输入框还是同一个节点、内容不被「首字符」覆盖回去', async () => {
    const cols = columns()
    col(cols, 'name').rules = { required: true, minLength: 3 }
    const w = mountTable({ columns: cols })
    await selectCell(w, 1, 'name')
    press('q')
    await flushPromises()
    const input = w.find('.smart-table-xe input').element as HTMLInputElement
    input.value = 'qa'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    press('Enter', {}, input)
    await flushPromises()
    expect(td(w, 1, 'name').classes()).toContain('smart-table-xerr')
    const after = w.find('.smart-table-xe input').element as HTMLInputElement
    expect(after).toBe(input)
    expect(after.isConnected).toBe(true)
    expect(after.value).toBe('qa')
  })
})

describe('键盘补充', () => {
  it('编辑中 Shift+Enter = 提交并上移一格', async () => {
    const w = mountTable()
    await editCell(w, 2, 'name')
    await typeInto(w, 'zed')
    press('Enter', { shiftKey: true }, w.find('.smart-table-xe input').element)
    await flushPromises()
    expect(td(w, 2, 'name').text()).toBe('zed')
    expect(td(w, 1, 'name').attributes('data-xsel')).toBeDefined()
  })
})

describe('离开保护', () => {
  it('实例暴露 isDirty(布尔)与 dirtyCount;discard 之后回落', async () => {
    const w = mountTable()
    const vm = w.vm as unknown as { isDirty: boolean; dirtyCount: number; discard: () => void }
    expect(vm.isDirty).toBe(false)
    await w.find('td[data-xc="1|on"] .n-checkbox').trigger('click')
    await flushPromises()
    expect(vm.isDirty).toBe(true)
    expect(vm.dirtyCount).toBe(1)
    vm.discard()
    await flushPromises()
    expect(vm.isDirty).toBe(false)
  })

  it('beforeunload 提示只在有未保存修改时才注册、清空后摘掉;editable.beforeunload: false 不注册', async () => {
    const add = vi.spyOn(window, 'addEventListener')
    const remove = vi.spyOn(window, 'removeEventListener')
    const n = (spy: typeof add) => spy.mock.calls.filter((c) => c[0] === 'beforeunload').length
    const w = mountTable()
    expect(n(add)).toBe(0)
    await w.find('td[data-xc="1|on"] .n-checkbox').trigger('click')
    await flushPromises()
    expect(n(add)).toBe(1)
    ;(w.vm as unknown as { discard: () => void }).discard()
    await flushPromises()
    expect(n(remove)).toBe(1)
    add.mockClear()
    wrapper?.unmount()
    const w2 = mountTable({ editable: { beforeunload: false } })
    await w2.find('td[data-xc="1|on"] .n-checkbox').trigger('click')
    await flushPromises()
    expect(n(add)).toBe(0)
    add.mockRestore()
    remove.mockRestore()
  })
})
