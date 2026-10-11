// @vitest-environment jsdom
// 锁定格灰底(editable.lockedFill):默认关,关时单元格的类名与根元素样式变量和没有这个开关时一致;打开后锁定的格(xlk)与没有编辑器的数据列(xro)
// 多带 smart-table-xgray,可填格(有编辑器且未锁定)多带 smart-table-xring(悬停描边),特殊列 / 拖拽手柄 / 操作列 / 待删行的格都没有。
// 灰色与各状态的合成由 EditableEditor.vue 的样式表承担,jsdom 不做样式计算,这里锁规则本身(同 SmartTable.editable.fillHint.test.ts);真实渲染由浏览器目视与 getComputedStyle 核对。
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
      editable: { lockedFill: true },
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
const rootStyle = (w: VueWrapper) => w.find('.smart-table--editable').attributes('style') ?? ''
const btnByText = (w: VueWrapper, t: string) =>
  w.findAll('button').find((b) => b.text().trim() === t)

describe('editable.lockedFill:默认关闭', () => {
  it('不写 / false 时没有任何格带 xgray / xring,类名与根元素样式与 editable: true 完全一致', () => {
    const base = mountTable({ editable: true })
    const baseClasses = allClasses(base)
    const baseStyle = rootStyle(base)
    expect(baseClasses.some((c) => /smart-table-x(gray|ring)/.test(c))).toBe(false)
    expect(baseStyle).not.toContain('--smart-table-xl-lock')
    wrapper?.unmount()
    const withEmpty = mountTable({ editable: {} })
    expect(allClasses(withEmpty)).toEqual(baseClasses)
    expect(rootStyle(withEmpty)).toBe(baseStyle)
    wrapper?.unmount()
    const withFalse = mountTable({ editable: { lockedFill: false } })
    expect(allClasses(withFalse)).toEqual(baseClasses)
    expect(rootStyle(withFalse)).toBe(baseStyle)
  })

  it('只开 fillHint 时与 lockedFill 无关:没有 xgray / xring,可填格仍只带 xfill', () => {
    const w = mountTable({ editable: { fillHint: true } })
    expect(allClasses(w).some((c) => /smart-table-x(gray|ring)/.test(c))).toBe(false)
    expect(td(w, 1, 'name').classes()).toContain('smart-table-xfill')
    expect(rootStyle(w)).not.toContain('--smart-table-xl-lock')
  })
})

describe('editable.lockedFill:打开后', () => {
  it('按行锁定的格(readonly 函数形式)带 xgray,同时仍是 xlk + xc,不带 xring', () => {
    const w = mountTable()
    const cls = td(w, 2, 'qty').classes()
    expect(cls).toContain('smart-table-xgray')
    expect(cls).toContain('smart-table-xlk')
    expect(cls).toContain('smart-table-xc')
    expect(cls).not.toContain('smart-table-xring')
  })

  it('rowReadonly 锁住的整行都是灰格;列显式 readonly: false 解锁的格不灰、可填', () => {
    const cols = columns()
    ;(cols[2] as Record<string, unknown>).readonly = false
    const w = mountTable({
      columns: cols,
      editable: { lockedFill: true, rowReadonly: (r: Row) => r.id === 3 },
    })
    expect(td(w, 3, 'qty').classes()).toContain('smart-table-xgray')
    expect(td(w, 3, 'name').classes()).not.toContain('smart-table-xgray')
    expect(td(w, 3, 'name').classes()).toContain('smart-table-xring')
  })

  it('无编辑器的数据列(readonly: true,xro)带 xgray,不是 xc,也没有 xring', () => {
    const w = mountTable()
    for (const i of [0, 1, 2]) {
      const cell = rowTd(w, i, 'code')
      expect(cell.classes()).toContain('smart-table-xro')
      expect(cell.classes()).toContain('smart-table-xgray')
      expect(cell.classes()).not.toContain('smart-table-xc')
      expect(cell.classes()).not.toContain('smart-table-xring')
    }
  })

  it('editor: false 与带 render 的展示列同样是灰格', () => {
    const cols: SmartTableColumn<Row>[] = [
      { key: 'code', title: 'Code', editor: false },
      { key: 'name', title: 'Name', render: (r: Row) => h('b', r.name) },
      { key: 'qty', title: 'Qty' },
    ]
    const w = mountTable({ columns: cols })
    expect(rowTd(w, 0, 'code').classes()).toContain('smart-table-xgray')
    expect(rowTd(w, 0, 'name').classes()).toContain('smart-table-xgray')
    expect(rowTd(w, 0, 'qty').classes()).not.toContain('smart-table-xgray')
  })

  it('可填格(有编辑器且未锁定)带 xring,不带 xgray', () => {
    const w = mountTable()
    for (const [id, key] of [
      [1, 'name'],
      [2, 'name'],
      [3, 'name'],
      [1, 'qty'],
      [3, 'qty'],
    ] as const) {
      const cls = td(w, id, key).classes()
      expect(cls, `${id}|${key}`).toContain('smart-table-xring')
      expect(cls).toContain('smart-table-xc')
      expect(cls).not.toContain('smart-table-xgray')
      expect(cls).not.toContain('smart-table-xfill')
    }
  })

  it('特殊列(勾选)不上灰也没有 xring', () => {
    const w = mountTable()
    const cell = w.find('.n-data-table-tbody .n-data-table-td--selection')
    expect(cell.classes()).not.toContain('smart-table-xgray')
    expect(cell.classes()).not.toContain('smart-table-xring')
  })

  it('序号列(type: index)不上灰', () => {
    const w = mountTable({ columns: [{ type: 'index' }, ...columns()] })
    const cell = w.find('.n-data-table-tbody td[data-col-key="__index"]')
    expect(cell.exists()).toBe(true)
    expect(cell.classes()).not.toContain('smart-table-xgray')
  })

  it('列上写 lockedFill: false 退出(有标题、没写 card 的控件列);写 true 强制上灰,优先于自动判断', () => {
    const cols: SmartTableColumn<Row>[] = [
      { key: 'drag', title: 'Drag', lockedFill: false, render: () => h('i', '::') },
      { key: 'blank', title: '', lockedFill: true, render: () => h('i', '-') },
      { key: 'plain', title: 'Plain', render: () => h('i', '-') },
      { key: 'name', title: 'Name' },
      { key: 'qty', title: 'Qty', lockedFill: false, readonly: (r: Row) => r.id === 2 },
    ]
    const w = mountTable({ columns: cols })
    expect(rowTd(w, 0, 'drag').classes()).toContain('smart-table-xro')
    expect(rowTd(w, 0, 'drag').classes()).not.toContain('smart-table-xgray')
    expect(rowTd(w, 0, 'blank').classes()).toContain('smart-table-xgray')
    expect(rowTd(w, 0, 'plain').classes()).toContain('smart-table-xgray')
    // 锁定的格(有编辑器的列被行级锁住)同样服从列上的退出
    expect(td(w, 2, 'qty').classes()).toContain('smart-table-xlk')
    expect(td(w, 2, 'qty').classes()).not.toContain('smart-table-xgray')
    // 列上的开关只在 editable.lockedFill 打开时有意义
    wrapper?.unmount()
    const off = mountTable({ columns: cols, editable: true })
    expect(allClasses(off).some((c) => /smart-table-x(gray|ring)/.test(c))).toBe(false)
  })

  it('拖拽手柄 / 操作列这类纯展示列不上灰:card 为 handle / action,或标题为空', () => {
    const cols: SmartTableColumn<Row>[] = [
      { key: 'handle', title: 'H', card: 'handle', render: () => h('i', '::') },
      { key: 'blank', title: '', render: () => h('i', '-') },
      { key: 'name', title: 'Name' },
      { key: 'code', title: 'Code', readonly: true },
      { key: 'op', title: 'Op', card: 'action', render: () => h('button', 'x') },
    ]
    const w = mountTable({ columns: cols })
    for (const key of ['handle', 'blank', 'op']) {
      const cls = rowTd(w, 0, key).classes()
      expect(cls, key).toContain('smart-table-xro')
      expect(cls, key).not.toContain('smart-table-xgray')
      expect(cls, key).not.toContain('smart-table-xring')
    }
    expect(rowTd(w, 0, 'code').classes()).toContain('smart-table-xgray')
  })

  it('待删行的格没有 xgray(整行已淡化 + 删除线),新增行里的灰格 / 可填格照常', async () => {
    const Host = defineComponent({
      setup() {
        const keys = ref<Array<string | number>>([2])
        return () =>
          h(SmartTable as never, {
            columns: columns(),
            data: rows(),
            rowKey: 'id',
            pagination: false,
            editable: { lockedFill: true, newRow: () => ({ code: 'NEW', name: '', qty: 0 }) },
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
    expect(
      deleted.findAll('td').some((t) => /smart-table-x(gray|ring)/.test(t.classes().join(' '))),
    ).toBe(false)

    await btnByText(w, 'Add row')!.trigger('click')
    await flushPromises()
    await flushPromises()
    const fresh = w.findAll('.n-data-table-tbody tr')[0]
    expect(fresh.classes()).toContain('smart-table-xnew')
    expect(fresh.find('td[data-col-key="code"]').classes()).toContain('smart-table-xgray')
    expect(fresh.find('td[data-col-key="name"]').classes()).toContain('smart-table-xring')
    expect(fresh.find('td[data-col-key="name"]').classes()).not.toContain('smart-table-xgray')
  })

  it('窄档卡片(cardOnNarrow)没有逐格编辑:没有 td,也没有 xgray / xring', async () => {
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get: () => 400,
    })
    const w = mountTable({ cardOnNarrow: true })
    await flushPromises()
    expect(w.find('.smart-table-card-item').exists()).toBe(true)
    expect(w.find('td[data-xc]').exists()).toBe(false)
    expect(w.html()).not.toMatch(/smart-table-x(gray|ring)/)
  })

  it('根元素下发 --smart-table-xl-lock(宿主主题的 inputColorDisabled),不写死色值', () => {
    const w = mountTable()
    expect(rootStyle(w)).toMatch(/--smart-table-xl-lock:\s*rgb\(250,\s*250,\s*252\)/)
  })

  it('运行时切换 lockedFill:类名与样式变量随之增删', async () => {
    const w = mountTable({ editable: { lockedFill: false } })
    expect(td(w, 1, 'name').classes()).not.toContain('smart-table-xring')
    expect(rootStyle(w)).not.toContain('--smart-table-xl-lock')
    await w.setProps({ editable: { lockedFill: true } })
    await flushPromises()
    expect(td(w, 1, 'name').classes()).toContain('smart-table-xring')
    expect(td(w, 2, 'qty').classes()).toContain('smart-table-xgray')
    expect(rootStyle(w)).toContain('--smart-table-xl-lock')
    await w.setProps({ editable: { lockedFill: false } })
    await flushPromises()
    expect(td(w, 1, 'name').classes()).not.toContain('smart-table-xring')
    expect(td(w, 2, 'qty').classes()).not.toContain('smart-table-xgray')
    expect(rootStyle(w)).not.toContain('--smart-table-xl-lock')
  })

  it('与 fillHint 同开:可填格 xfill + xring,灰格 xgray 且没有 xfill,各管各的', () => {
    const w = mountTable({ editable: { lockedFill: true, fillHint: true } })
    const fillable = td(w, 1, 'name').classes()
    expect(fillable).toContain('smart-table-xfill')
    expect(fillable).toContain('smart-table-xring')
    expect(fillable).not.toContain('smart-table-xgray')
    const locked = td(w, 2, 'qty').classes()
    expect(locked).toContain('smart-table-xgray')
    expect(locked).not.toContain('smart-table-xfill')
    expect(locked).not.toContain('smart-table-xring')
  })
})

// ---- 样式表:灰底与各状态的合成规则 ----
// prettier 会把长选择器折行,rulesOf 折成空格后括号内侧会多出空白:比较前去掉
const rules: Rule[] = rulesOf(source).map((r) => ({
  ...r,
  selectors: r.selectors.map((s) => s.replace(/\(\s+/g, '(').replace(/\s+\)/g, ')')),
}))
const grayRules = rules.filter((r) => r.selectors.some((s) => s.includes('smart-table-xgray')))
const GRAY = 'inset 0 0 0 9999px var(--smart-table-xl-lock)'
const grayBase = grayRules.find(
  (r) =>
    r.selectors.length === 1 &&
    !r.selectors[0].includes('[data-xsel]') &&
    !r.selectors[0].includes('smart-table-xerr') &&
    !r.selectors[0].includes('smart-table-xnew'),
)
const graySel = grayRules.find((r) => r.selectors.some((s) => s.includes('[data-xsel]')))
const grayErr = grayRules.find((r) => r.selectors.some((s) => s.includes('smart-table-xerr')))
const grayNew = grayRules.find((r) => r.selectors.some((s) => s.includes('smart-table-xnew')))
const ringRules = rules.filter((r) => r.selectors.some((s) => s.includes('smart-table-xring')))

describe('editable.lockedFill 的样式规则', () => {
  it('灰画成 inset box-shadow(铺满单元格),不改 background-color / background / background-image(固定列实底、行高亮不被顶掉)', () => {
    expect(grayBase).toBeDefined()
    expect(grayBase!.body).toContain(`box-shadow: ${GRAY}`)
    for (const r of grayRules) {
      expect(r.body).not.toMatch(/(^|[;\s])background(-color|-image)?:/)
    }
  })

  it('灰取 --smart-table-xl-lock(宿主主题的 inputColorDisabled),不硬编码颜色,不套比例', () => {
    for (const r of grayRules) {
      expect(r.body).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|color-mix/i)
    }
  })

  it('选中 / 校验错误 / 新增行首格:灰与各自的内描边 / 色条合成,不被顶掉也不顶掉它们', () => {
    expect(graySel).toBeDefined()
    expect(graySel!.body).toContain('inset 0 0 0 2px var(--smart-table-xl-primary)')
    expect(graySel!.body).toContain(GRAY)
    expect(grayErr).toBeDefined()
    expect(grayErr!.body).toContain('inset 0 0 0 2px var(--smart-table-xl-error)')
    expect(grayErr!.body).toContain(GRAY)
    expect(grayNew).toBeDefined()
    expect(grayNew!.selectors.join(' ')).toContain(':first-child')
    expect(grayNew!.body).toContain('inset 3px 0 0 var(--smart-table-xl-primary)')
    expect(grayNew!.body).toContain(GRAY)
  })

  it('校验错误的规则在选中之后(同一格既选中又出错时红框优先,与不带灰时一致)', () => {
    expect(rules.indexOf(grayErr!)).toBeGreaterThan(rules.indexOf(graySel!))
  })

  it('可填格悬停的 1px 描边与 fillHint 共用同一组规则:选择器里同时有 xfill 与 xring,声明体不重复', () => {
    expect(ringRules.length).toBe(2)
    for (const r of ringRules) {
      const sel = r.selectors.join(' ')
      expect(sel).toContain('smart-table-xfill')
      expect(sel).toContain(':hover')
      for (const s of [':not([data-xsel])', ':not(.smart-table-xerr)', ':not(.smart-table-xed)'])
        expect(sel).toContain(s)
    }
    const plain = ringRules.find((r) => !r.selectors.some((s) => s.includes('.smart-table-xnew')))!
    expect(plain.body).toContain('box-shadow: inset 0 0 0 1px')
    expect(plain.body).toContain(
      'color-mix(in srgb, var(--smart-table-xl-primary) 40%, transparent)',
    )
  })

  it('灰与悬停描边都不放位移 / 过渡动效', () => {
    for (const r of [...grayRules, ...ringRules])
      expect(r.body).not.toMatch(/transform|transition|animation/)
  })
})
