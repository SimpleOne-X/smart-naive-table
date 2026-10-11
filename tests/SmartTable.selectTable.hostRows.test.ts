// @vitest-environment jsdom
// 宿主在可编辑表格外面新增行(整体换数组引用)后,新增行上的 select-table 选中行为;原地 push 的行不可编辑。
// 写法对照下游工艺路线弹窗:save: 'cell'、函数式 row-key、labelKey 指向字符串字段 + renderLabel、
// 带 readonly 函数列与 render 列、row-draggable + row-props。
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

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
import { defineComponent, h, nextTick, ref, type Component } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import SmartTable from '../src/SmartTable.vue'
import type { EditSavePayload, SmartTableColumn } from '../src/types'

interface Draft {
  __key: number
  operationId: string
  isRepair: boolean
  compare: number
  target: number | null
}
interface Operation {
  id: number
  pickId: string
  number: string
  name: string
}
const OPERATIONS: Operation[] = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  pickId: String(i + 1),
  number: `OP${String(i + 1).padStart(3, '0')}`,
  name: `工序${i + 1}`,
}))
const pickerColumns: SmartTableColumn<Operation>[] = [
  { key: 'number', title: '编号' },
  { key: 'name', title: '名称' },
]
const newDraft = (key: number): Draft => ({
  __key: key,
  operationId: '',
  isRepair: false,
  compare: 1,
  target: null,
})

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
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

const settle = async () => {
  for (let i = 0; i < 4; i++) await flushPromises()
}
const panel = () => document.body.querySelector<HTMLElement>('.smart-table-xpick')
const pRows = () => [...(panel()?.querySelectorAll<HTMLElement>('.n-data-table-tbody tr') ?? [])]

/** 宿主:数据在宿主的 ref 里,逐格 @save 把改动写回草稿行再 done(),新增行靠换数组引用。 */
function mountHost(options: { withReadonly: boolean; draggable?: boolean }) {
  const rows = ref<Draft[]>([newDraft(1)])
  const saved: Array<EditSavePayload<Draft>['changes']> = []
  const columns: SmartTableColumn<Draft>[] = [
    { type: 'index', title: '#', width: 56 },
    {
      key: 'operationId',
      title: '工序',
      minWidth: 180,
      editor: 'select-table',
      editorProps: {
        columns: pickerColumns,
        get data() {
          return OPERATIONS
        },
        labelKey: 'pickId',
        searchKeys: ['number', 'name'],
        renderLabel: (row: Operation) => `${row.number} | ${row.name}`,
      },
      render: (row) => h('span', row.operationId || '请选择'),
    },
    { key: 'isRepair', title: '返修', editor: 'checkbox' },
    ...(options.withReadonly
      ? ([
          {
            key: 'target',
            title: '目标值',
            editor: 'number',
            readonly: (row: Draft) => row.compare === 7,
          },
        ] as SmartTableColumn<Draft>[])
      : []),
  ]
  const Host = defineComponent({
    setup() {
      return () =>
        h(SmartTable as unknown as Component, {
          columns,
          data: rows.value,
          rowKey: (row: Draft) => row.__key,
          pagination: false,
          toolbar: false,
          editable: { save: 'cell', add: false, remove: false },
          rowDraggable: options.draggable,
          dragHandle: '.drag-handle',
          rowProps: (row: Draft) => ({ class: row.__key === 1 ? 'picked' : '' }),
          onSave: ({ changes, done }: EditSavePayload<Draft>) => {
            saved.push(changes)
            for (const { row, changes: c } of changes.updated) {
              const target = rows.value.find((r) => r.__key === row.__key)
              if (target)
                for (const [k, v] of Object.entries(c)) Object.assign(target, { [k]: v.value })
            }
            done()
          },
        })
    },
  })
  wrapper = mount(Host, { attachTo: document.body })
  return { rows, saved }
}
const td = (key: number, col: string) =>
  document.body.querySelector<HTMLElement>(`td[data-xc="${key}|${col}"]`)
async function enterCell(key: number, col: string) {
  td(key, col)!.click()
  await settle()
  td(key, col)!.click()
  await settle()
}

describe.each([
  ['两列:select-table + checkbox', { withReadonly: false }],
  ['带 readonly 函数列', { withReadonly: true }],
  ['带 readonly 函数列 + row-draggable', { withReadonly: true, draggable: true }],
])('宿主换数组引用新增的行:%s', (_name, options) => {
  it('已有行选中一行 → 提交 @save', async () => {
    const { saved } = mountHost(options)
    await settle()
    await enterCell(1, 'operationId')
    expect(panel()).not.toBeNull()
    pRows()[2].click()
    await settle()
    expect(saved).toHaveLength(1)
    expect(saved[0].updated[0].changes.operationId.value).toBe('3')
  })

  it('新增行选中一行 → 提交 @save', async () => {
    const { rows, saved } = mountHost(options)
    await settle()
    rows.value = [...rows.value, newDraft(2)]
    await settle()
    await enterCell(2, 'operationId')
    expect(panel()).not.toBeNull()
    pRows()[2].click()
    await settle()
    expect(panel()).toBeNull()
    expect(saved).toHaveLength(1)
    expect(saved[0].updated[0].changes.operationId.value).toBe('3')
  })
})

describe('原地 push 进来的行', () => {
  it('和整体换引用新增的行一样可编辑:进入编辑、选中一行 → 提交 @save', async () => {
    const { rows, saved } = mountHost({ withReadonly: true })
    await settle()
    rows.value.push(newDraft(2))
    await nextTick()
    await settle()
    expect(td(2, 'operationId')).not.toBeNull()
    await enterCell(2, 'operationId')
    expect(panel()).not.toBeNull()
    pRows()[2].click()
    await settle()
    expect(saved).toHaveLength(1)
    expect(saved[0].updated[0].changes.operationId.value).toBe('3')
  })

  it('原地 push 之后宿主再 splice 掉的行不再显示,留下的行照常可编辑', async () => {
    const { rows } = mountHost({ withReadonly: false })
    await settle()
    rows.value.push(newDraft(2), newDraft(3))
    await nextTick()
    await settle()
    rows.value.splice(1, 1)
    await nextTick()
    await settle()
    expect(td(2, 'operationId')).toBeNull()
    expect(td(3, 'operationId')).not.toBeNull()
  })
})
