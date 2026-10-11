// @vitest-environment jsdom
// 可填格提示(editable.fillHint):默认关,关时单元格的类名与没有这个开关时一致;打开后「有编辑器且未锁定」的格多带 smart-table-xfill,
// 锁定格(xlk)/ 无编辑器的列(xro)/ 待删行的格没有。底色与悬停描边的层叠规则由 EditableEditor.vue 的样式表承担,
// jsdom 不做样式计算,这里锁规则本身(同 EditableEditor.style.test.ts);真实渲染由浏览器目视核对。
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import SmartTable from '../src/SmartTable.vue'
import source from '../src/EditableEditor.vue?raw'
import type { SmartTableColumn } from '../src/types'
import { rulesOf, type Rule } from './sfcStyle'

interface Row {
  id: number
  code: string
  name: string
  qty: number
}
const rows = (): Row[] => [
  { id: 1, code: 'C1', name: 'alice', qty: 3 },
  { id: 2, code: 'C2', name: 'bob', qty: 4 },
  { id: 3, code: 'C3', name: 'carol', qty: 5 },
]
const columns = (): SmartTableColumn<Row>[] => [
  { type: 'selection' },
  { key: 'code', title: 'Code', readonly: true }, // 无编辑器的列:xro
  { key: 'name', title: 'Name' },
  { key: 'qty', title: 'Qty', readonly: (r: Row) => r.id === 2 }, // 按行锁定:xlk
]

beforeAll(() => {
  Element.prototype.scrollTo ??= () => {}
})
let wrapper: VueWrapper | null = null
function mountTable(props: Record<string, unknown> = {}): VueWrapper {
  wrapper = mount(SmartTable, {
    props: {
      columns: columns() as SmartTableColumn<unknown>[],
      data: rows(),
      rowKey: 'id',
      pagination: false,
      editable: { fillHint: true },
      ...props,
    },
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
const allClasses = (w: VueWrapper) =>
  w.findAll('.n-data-table-tbody td').map((t) => t.classes().join(' '))
const btnByText = (w: VueWrapper, t: string) =>
  w.findAll('button').find((b) => b.text().trim() === t)

describe('editable.fillHint:默认关闭', () => {
  it('不写 / false 时没有任何格带 smart-table-xfill,类名与 editable: true 完全一致', () => {
    const base = allClasses(mountTable({ editable: true }))
    expect(base.some((c) => c.includes('smart-table-xfill'))).toBe(false)
    wrapper?.unmount()
    const withEmpty = allClasses(mountTable({ editable: {} }))
    wrapper?.unmount()
    const withFalse = allClasses(mountTable({ editable: { fillHint: false } }))
    expect(withEmpty).toEqual(base)
    expect(withFalse).toEqual(base)
  })
})

describe('editable.fillHint:打开后', () => {
  it('可编辑且未锁定的格带 smart-table-xfill(同时仍是 xc、不是 xlk)', () => {
    const w = mountTable()
    for (const [id, key] of [
      [1, 'name'],
      [2, 'name'],
      [3, 'name'],
      [1, 'qty'],
      [3, 'qty'],
    ] as const) {
      const cls = td(w, id, key).classes()
      expect(cls, `${id}|${key}`).toContain('smart-table-xfill')
      expect(cls).toContain('smart-table-xc')
      expect(cls).not.toContain('smart-table-xlk')
    }
  })

  it('锁定的格(readonly 函数形式 / rowReadonly)没有 xfill:仍可选中、灰字', () => {
    const byColumn = mountTable()
    expect(td(byColumn, 2, 'qty').classes()).toContain('smart-table-xlk')
    expect(td(byColumn, 2, 'qty').classes()).not.toContain('smart-table-xfill')
    byColumn.unmount()
    const byRow = mountTable({ editable: { fillHint: true, rowReadonly: (r: Row) => r.id === 3 } })
    for (const key of ['name', 'qty']) {
      expect(td(byRow, 3, key).classes()).toContain('smart-table-xlk')
      expect(td(byRow, 3, key).classes()).not.toContain('smart-table-xfill')
    }
    expect(td(byRow, 1, 'name').classes()).toContain('smart-table-xfill')
  })

  it('列显式 readonly: false 解锁的格(rowReadonly 之下仍可改)带 xfill', () => {
    const cols = columns()
    ;(cols[2] as Record<string, unknown>).readonly = false
    const w = mountTable({
      columns: cols,
      editable: { fillHint: true, rowReadonly: (r: Row) => r.id === 3 },
    })
    expect(td(w, 3, 'name').classes()).toContain('smart-table-xfill')
    expect(td(w, 3, 'qty').classes()).toContain('smart-table-xlk')
    expect(td(w, 3, 'qty').classes()).not.toContain('smart-table-xfill')
  })

  it('无编辑器的列(xro)没有 xfill,也不是 xc', () => {
    const w = mountTable()
    const cell = rowTd(w, 0, 'code')
    expect(cell.classes()).toContain('smart-table-xro')
    expect(cell.classes()).not.toContain('smart-table-xfill')
    expect(cell.classes()).not.toContain('smart-table-xc')
  })

  it('特殊列(勾选)没有 xfill', () => {
    const w = mountTable()
    const cell = w.find('.n-data-table-tbody .n-data-table-td--selection')
    expect(cell.classes()).not.toContain('smart-table-xfill')
  })

  it('新增行里的可填格带 xfill(底色谁压谁由样式表决定);待删行的格没有', async () => {
    const Host = defineComponent({
      setup() {
        const keys = ref<Array<string | number>>([2])
        return () =>
          h(SmartTable as never, {
            columns: columns(),
            data: rows(),
            rowKey: 'id',
            pagination: false,
            editable: { fillHint: true, newRow: () => ({ code: 'NEW', name: '', qty: 0 }) },
            checkedRowKeys: keys.value,
            'onUpdate:checkedRowKeys': (k: Array<string | number>) => (keys.value = k),
          })
      },
    })
    const w = mount(Host, { attachTo: document.body })
    wrapper = w
    await btnByText(w, 'Delete selected')!.trigger('click')
    await flushPromises()
    const deleted = w.findAll('.n-data-table-tbody tr')[1]
    expect(deleted.classes()).toContain('smart-table-xdel')
    expect(deleted.findAll('td').some((t) => t.classes().includes('smart-table-xfill'))).toBe(false)

    await btnByText(w, 'Add row')!.trigger('click')
    await flushPromises()
    await flushPromises()
    const fresh = w.findAll('.n-data-table-tbody tr')[0]
    expect(fresh.classes()).toContain('smart-table-xnew')
    expect(fresh.find('td[data-col-key="name"]').classes()).toContain('smart-table-xfill')
    expect(fresh.find('td[data-col-key="code"]').classes()).not.toContain('smart-table-xfill')
  })

  it('窄档卡片(cardOnNarrow)没有逐格编辑:没有可编辑的 td(xc),也没有 xfill', async () => {
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get: () => 400,
    })
    const w = mountTable({ cardOnNarrow: true })
    await flushPromises()
    expect(w.find('.smart-table-card-item').exists()).toBe(true)
    expect(w.find('td[data-xc]').exists()).toBe(false)
    expect(w.html()).not.toContain('smart-table-xfill')
  })

  it('运行时切换 fillHint:类名随之增删', async () => {
    const w = mountTable({ editable: { fillHint: false } })
    expect(td(w, 1, 'name').classes()).not.toContain('smart-table-xfill')
    await w.setProps({ editable: { fillHint: true } })
    await flushPromises()
    expect(td(w, 1, 'name').classes()).toContain('smart-table-xfill')
    await w.setProps({ editable: { fillHint: false } })
    await flushPromises()
    expect(td(w, 1, 'name').classes()).not.toContain('smart-table-xfill')
  })
})

// ---- 样式表:底色 / 悬停描边的层叠规则 ----
// prettier 会把长选择器折行,rulesOf 折成空格后括号内侧会多出空白:比较前去掉
const rules: Rule[] = rulesOf(source).map((r) => ({
  ...r,
  selectors: r.selectors.map((s) => s.replace(/\(\s+/g, '(').replace(/\s+\)/g, ')')),
}))
const fillRules = rules.filter((r) => r.selectors.some((s) => s.includes('smart-table-xfill')))
const tint = fillRules.find((r) => r.body.includes('background-image'))
const hasNew = (r: Rule) => r.selectors.some((s) => s.includes('.smart-table-xnew'))
const hovers = fillRules.filter((r) => r.selectors.some((s) => s.includes(':hover')))
const ring = hovers.find((r) => !hasNew(r))
const ringOnNewRow = hovers.find(hasNew)
const STATES = [':not([data-xsel])', ':not(.smart-table-xerr)', ':not(.smart-table-xed)']

describe('editable.fillHint 的样式规则', () => {
  it('淡底用 background-image 叠在 td 原有底色上,不改写 background-color / background(固定列的实底不被盖成半透明)', () => {
    expect(tint).toBeDefined()
    expect(tint!.body).toContain('linear-gradient(')
    for (const r of fillRules) {
      expect(r.body).not.toMatch(/(^|[;\s])background(-color)?:/)
    }
  })

  it('淡底取主题主色(--smart-table-xl-primary)做 color-mix,不硬编码颜色;明暗两套都走这个变量', () => {
    expect(tint!.body).toContain(
      'color-mix(in srgb, var(--smart-table-xl-primary) 6%, transparent)',
    )
    for (const r of fillRules) expect(r.body).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i)
  })

  it('选中 / 校验错误 / 编辑中的格不加淡底,新增行里也不叠(新增行自己的底色与首格色条优先)', () => {
    const sel = tint!.selectors.join(' ')
    for (const s of STATES) expect(sel).toContain(s)
    expect(sel).toContain(':not(.smart-table-xnew)')
  })

  it('悬停描边是 1px 内描边(inset box-shadow,不占布局),比选中的 2px 更细;选中 / 校验错误 / 编辑中的格不加', () => {
    expect(ring).toBeDefined()
    expect(ring!.body).toContain('box-shadow: inset 0 0 0 1px')
    expect(ring!.body).toContain(
      'color-mix(in srgb, var(--smart-table-xl-primary) 40%, transparent)',
    )
    const sel = ring!.selectors.join(' ')
    for (const s of STATES) expect(sel).toContain(s)
  })

  it('新增行首格的悬停描边与 3px 主色条合成,条不被描边顶掉', () => {
    expect(ringOnNewRow).toBeDefined()
    expect(ringOnNewRow!.body).toContain('inset 3px 0 0 var(--smart-table-xl-primary)')
    expect(ringOnNewRow!.body).toContain('inset 0 0 0 1px')
    for (const st of STATES) expect(ringOnNewRow!.selectors.join(' ')).toContain(st)
  })

  it('不放位移 / 过渡动效', () => {
    for (const r of fillRules) expect(r.body).not.toMatch(/transform|transition|animation/)
  })
})
