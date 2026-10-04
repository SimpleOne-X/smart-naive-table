// @vitest-environment jsdom
// 可编辑表格 + 行拖拽排序共存:拖拽重排后宿主经 setCell 重编号,走草稿仓库(有脏标记、进 @save),不破坏编辑 / 脏态 / 选中。
// sortablejs 在 jsdom 里没有真实拖拽,这里用 mock 捕获创建参数,手动触发 onEnd(真实拖一次要在浏览器里做)。
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import SmartTable from '../src/SmartTable.vue'
import type { EditSavePayload, SmartTableColumn } from '../src/types'

const created = vi.hoisted(
  () =>
    [] as Array<{
      el: HTMLElement
      opts: { filter?: string; onEnd: (e: { oldIndex?: number; newIndex?: number }) => void }
    }>,
)
vi.mock('sortablejs', () => ({
  default: {
    create: (el: HTMLElement, opts: (typeof created)[number]['opts']) => {
      created.push({ el, opts })
      return { destroy() {} }
    },
  },
}))

interface Row {
  id: number
  seq: number
  name: string
}
const rows = (): Row[] => [
  { id: 1, seq: 10, name: 'turn' },
  { id: 2, seq: 20, name: 'drill' },
  { id: 3, seq: 30, name: 'grind' },
]
const columns: SmartTableColumn<unknown>[] = [
  { key: 'seq', title: 'Seq', rules: { int: true, min: 1 } },
  { key: 'name', title: 'Name', rules: { required: true } },
]

beforeAll(() => {
  Element.prototype.scrollTo ??= () => {}
})
let wrapper: VueWrapper | null = null
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
  created.length = 0
})

type Vm = {
  setCell: (k: number, f: string, v: unknown) => boolean
  dirtyCount: number
  getChanges: () => EditSavePayload<Row>['changes']
}
async function mountDraggable(onSave?: (p: EditSavePayload<Row>) => void) {
  const data = rows()
  const onSort = vi.fn((e: { reordered: Row[] }) => {
    // 宿主:按新顺序重编号 10,20,30…,走草稿仓库
    e.reordered.forEach((r, i) => (wrapper!.vm as unknown as Vm).setCell(r.id, 'seq', (i + 1) * 10))
  })
  wrapper = mount(SmartTable, {
    props: {
      columns,
      data,
      rowKey: 'id',
      pagination: false,
      editable: true,
      rowDraggable: true,
      dragHandle: '.n-data-table-td',
    },
    attrs: { onRowDragSort: onSort, ...(onSave ? { onSave } : {}) },
    attachTo: document.body,
  })
  await flushPromises()
  await flushPromises()
  return { data, onSort }
}
const td = (w: VueWrapper, id: number, key: string) => w.find(`td[data-xc="${id}|${key}"]`)

describe('可编辑 + 行拖拽共存', () => {
  it('editable 开着时拖拽照样绑上,并声明新增行不可拖(filter)', async () => {
    await mountDraggable()
    expect(created).toHaveLength(1)
    expect(created[0].opts.filter).toBe('.smart-table-xnew')
  })

  it('拖拽重排后宿主 setCell 重编号:变了的工序号格有脏标记、N 计数、进 @save;已有的草稿不丢', async () => {
    let payload: EditSavePayload<Row> | undefined
    const { onSort } = await mountDraggable((p) => (payload = p))
    const w = wrapper!
    // 先改一格名称(草稿)
    await td(w, 1, 'name').trigger('click')
    await td(w, 1, 'name').trigger('click')
    const input = w.find('.smart-table-xe input').element as HTMLInputElement
    input.value = 'turn2'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    )
    await flushPromises()
    expect((w.vm as unknown as Vm).dirtyCount).toBe(1)
    // 拖:第 1 行放到第 3 行 → 顺序 2,3,1
    created[0].opts.onEnd({ oldIndex: 0, newIndex: 2 })
    await flushPromises()
    expect(onSort).toHaveBeenCalledTimes(1)
    expect(onSort.mock.calls[0][0].reordered.map((r) => r.id)).toEqual([2, 3, 1])
    // seq:行 2→10(原 20)、行 3→20(原 30)、行 1→30(原 10),三格都变了,再加上名称那一格
    expect((w.vm as unknown as Vm).dirtyCount).toBe(4)
    expect(td(w, 2, 'seq').classes()).toContain('smart-table-xd')
    expect(td(w, 1, 'name').classes()).toContain('smart-table-xd') // 拖拽前的草稿还在
    expect(td(w, 2, 'seq').text()).toBe('10')
    // 保存:updated 里每行只带改过的字段
    await w
      .findAll('.smart-table-toolbar-actions button')
      .find((b) => b.text().startsWith('Save'))!
      .trigger('click')
    await flushPromises()
    const byId = Object.fromEntries(payload!.changes.updated.map((u) => [u.row.id, u.changes]))
    expect(byId[2]).toEqual({ seq: { value: 10, oldValue: 20 } })
    expect(byId[3]).toEqual({ seq: { value: 20, oldValue: 30 } })
    expect(byId[1]).toEqual({
      name: { value: 'turn2', oldValue: 'turn' },
      seq: { value: 30, oldValue: 10 },
    })
  })

  it('选中状态在重排后保留(同一个 id + 列),可继续用键盘', async () => {
    await mountDraggable()
    const w = wrapper!
    await td(w, 3, 'name').trigger('click')
    created[0].opts.onEnd({ oldIndex: 2, newIndex: 0 })
    await flushPromises()
    await nextTick()
    expect(td(w, 3, 'name').attributes('data-xsel')).toBeDefined()
  })

  it('有待保存的新增行时(排在数据行前面),拖拽下标要减掉它们,拖的是正确的两行', async () => {
    const { onSort } = await mountDraggable()
    const w = wrapper!
    await w
      .findAll('.smart-table-toolbar-actions button')
      .find((b) => b.text() === 'Add row')!
      .trigger('click')
    await flushPromises()
    await flushPromises()
    created[0].opts.onEnd({ oldIndex: 1, newIndex: 3 }) // DOM 下标:0 = 新增行,1..3 = 数据行
    await flushPromises()
    expect(onSort.mock.calls[0][0].reordered.map((r) => r.id)).toEqual([2, 3, 1])
  })

  it('setCell:行不存在 / 待删 / editable 没开 → false;写入后 cell-change 触发', async () => {
    const { data } = await mountDraggable()
    const vm = wrapper!.vm as unknown as Vm
    expect(vm.setCell(99, 'seq', 1)).toBe(false)
    expect(vm.setCell(1, 'seq', 11)).toBe(true)
    expect(vm.getChanges().updated[0].changes).toEqual({ seq: { value: 11, oldValue: 10 } })
    expect(data[0].seq).toBe(10) // 宿主的行不被改
  })
})

describe('可编辑 + 行拖拽 + 序号列', () => {
  it('序号列(type: index)按位置显示、拖后跟着变,不产生脏标记;已有草稿按行跟着走(行主键,不是下标)', async () => {
    const data = rows()
    wrapper = mount(SmartTable, {
      props: {
        columns: [
          { type: 'index', title: '#' },
          { key: 'name', title: 'Name', rules: { required: true } },
        ],
        data,
        rowKey: 'id',
        pagination: false,
        editable: true,
        rowDraggable: true,
        dragHandle: '.n-data-table-td',
      } as never,
      attachTo: document.body,
    })
    await flushPromises()
    const w = wrapper
    const order = () =>
      w.findAll('tbody tr').map((tr) =>
        tr
          .findAll('td')
          .map((c) => c.text())
          .join('|'),
      )
    expect(order()).toEqual(['1|turn', '2|drill', '3|grind'])
    // 先给第 1 行(turn)留一份草稿
    await td(w, 1, 'name').trigger('click')
    await td(w, 1, 'name').trigger('click')
    const input = w.find('.smart-table-xe input').element as HTMLInputElement
    input.value = 'turn2'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    )
    await flushPromises()
    expect((w.vm as unknown as Vm).dirtyCount).toBe(1)
    // 拖:第 1 行放到末尾 → drill, grind, turn2;序号仍是 1 2 3(位置),草稿跟着 turn2 走
    created[0].opts.onEnd({ oldIndex: 0, newIndex: 2 })
    await flushPromises()
    await nextTick()
    expect(order()).toEqual(['1|drill', '2|grind', '3|turn2'])
    expect(w.findAll('tbody tr')[2].find('td[data-xc="1|name"]').classes()).toContain(
      'smart-table-xd',
    )
    expect((w.vm as unknown as Vm).dirtyCount).toBe(1) // 拖动本身没有产生任何脏标记
    expect(w.findAll('td.smart-table-xd')).toHaveLength(1)
  })
})
