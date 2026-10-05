// @vitest-environment jsdom
// 可编辑表格的两处工具栏行为:
//   · 「放弃修改」先弹官方 NPopconfirm,点「放弃」才发 @discard、才还原;取消 / 外部点击 / Esc 只关气泡,草稿保留;saving 期间禁用。
//   · 「含 M 条当前不可见」:带草稿、但不在当前页(请求结果)里的行数,放在「保存修改(N)」旁;窄档在展开的「操作」里单独占一行。
// 三个 labels 键(editDiscardConfirm / editDiscardOk / editHiddenDirty)在渲染期求值,切语言即时生效。
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import SmartTable from '../src/SmartTable.vue'
import Toolbar from '../src/Toolbar.vue'
import { createEditStore } from '../src/editable'
import { defaultLabels, fmt, mergeLabels, zhCNLabels } from '../src/labels'
import type { SmartTableColumn } from '../src/types'

interface Row {
  id: number
  name: string
}
const rows = (): Row[] => [
  { id: 1, name: 'alice' },
  { id: 2, name: 'bob' },
  { id: 3, name: 'carol' },
]
const columns = (): SmartTableColumn<unknown>[] => [{ key: 'name', title: 'Name' }]

beforeAll(() => {
  Element.prototype.scrollTo ??= () => {}
})

const mounted: VueWrapper[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()!.unmount()
  document.body.innerHTML = ''
  delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth
})

const panel = () => document.body.querySelector<HTMLElement>('.n-popconfirm__panel')
const panelBtn = (text: string) =>
  [...(panel()?.querySelectorAll<HTMLElement>('button') ?? [])].find(
    (b) => b.textContent?.trim() === text,
  )
const press = (key: string) =>
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
const btn = (root: ParentNode, text: string) =>
  [...root.querySelectorAll<HTMLElement>('button')].find((b) => b.textContent?.trim() === text)

describe('labels:三个新键(中英文,渲染期求值)', () => {
  it('zhCNLabels / defaultLabels 都有,占位符是 {n}', () => {
    expect(zhCNLabels.editDiscardConfirm).toBe('放弃全部 {n} 处未保存的修改?')
    expect(zhCNLabels.editDiscardOk).toBe('放弃')
    expect(zhCNLabels.editHiddenDirty).toBe('含 {n} 条当前不可见')
    expect(fmt(zhCNLabels.editDiscardConfirm, { n: 3 })).toBe('放弃全部 3 处未保存的修改?')
    expect(fmt(zhCNLabels.editHiddenDirty, { n: 2 })).toBe('含 2 条当前不可见')
    expect(defaultLabels.editDiscardConfirm).toBe('Discard all {n} unsaved changes?')
    expect(defaultLabels.editDiscardOk).toBe('Discard')
    expect(defaultLabels.editHiddenDirty).toContain('{n}')
    // 缺省取英文;宿主可经 labels 单键覆盖
    expect(mergeLabels({ editDiscardOk: 'Drop' }).editDiscardOk).toBe('Drop')
    expect(mergeLabels({ editDiscardOk: 'Drop' }).editDiscardConfirm).toBe(
      defaultLabels.editDiscardConfirm,
    )
  })

  it('Toolbar:切语言即时生效(气泡文案与「放弃」按钮、不可见提示都跟着换,不重挂载)', async () => {
    const w = mount(Toolbar, {
      props: {
        labels: defaultLabels,
        config: {} as never,
        density: 'compact',
        edit: { count: 3, saving: false, add: true, remove: true, restore: false, hidden: 2 },
      },
      attachTo: document.body,
    })
    mounted.push(w)
    await btn(w.element, 'Discard changes')!.click()
    await flushPromises()
    expect(panel()!.textContent).toContain('Discard all 3 unsaved changes?')
    expect(panelBtn('Discard')).toBeDefined()
    expect(w.find('.smart-table-edit-hidden').text()).toBe(
      fmt(defaultLabels.editHiddenDirty, { n: 2 }),
    )
    await w.setProps({ labels: zhCNLabels })
    await flushPromises()
    expect(panel()!.textContent).toContain('放弃全部 3 处未保存的修改?')
    expect(panelBtn('放弃')).toBeDefined()
    expect(panelBtn('取消')).toBeDefined()
    expect(w.find('.smart-table-edit-hidden').text()).toBe('含 2 条当前不可见')
  })
})

describe('Toolbar:放弃修改的确认气泡', () => {
  const edit = { count: 3, saving: false, add: true, remove: true, restore: false }
  const mountBar = (extra: Record<string, unknown> = {}) => {
    const w = mount(Toolbar, {
      props: { labels: defaultLabels, config: {} as never, density: 'compact', ...extra },
      attachTo: document.body,
    })
    mounted.push(w)
    return w
  }

  it('点「放弃修改」只弹气泡(文案带 N),不发 editDiscard;点「放弃」才发,且只发一次', async () => {
    const w = mountBar({ edit })
    await btn(w.element, 'Discard changes')!.click()
    await flushPromises()
    expect(panel()).not.toBeNull()
    expect(panel()!.textContent).toContain('Discard all 3 unsaved changes?')
    expect(w.emitted('editDiscard')).toBeUndefined()
    panelBtn('Discard')!.click()
    await flushPromises()
    expect(w.emitted('editDiscard')).toHaveLength(1)
  })

  it('气泡按钮:取消 = 淡灰 secondary,放弃 = 实心红,都是官方默认 small、不设最小宽', async () => {
    const w = mountBar({ edit })
    await btn(w.element, 'Discard changes')!.click()
    await flushPromises()
    const cancel = panelBtn('Cancel')!
    const ok = panelBtn('Discard')!
    expect(cancel.classList.contains('n-button--secondary')).toBe(true)
    expect(cancel.classList.contains('n-button--default-type')).toBe(true)
    expect(cancel.classList.contains('n-button--small-type')).toBe(true)
    expect(ok.classList.contains('n-button--error-type')).toBe(true)
    expect(ok.classList.contains('n-button--secondary')).toBe(false)
    expect(ok.classList.contains('n-button--small-type')).toBe(true)
    expect(cancel.style.minWidth).toBe('')
    expect(ok.style.minWidth).toBe('')
  })

  it('取消 / 外部点击 / Esc:只关气泡,不发 editDiscard', async () => {
    const w = mountBar({ edit })
    const open = async () => {
      await btn(w.element, 'Discard changes')!.click()
      await flushPromises()
      expect(panel()).not.toBeNull()
    }
    await open()
    panelBtn('Cancel')!.click()
    await flushPromises()
    await open()
    press('Escape')
    await flushPromises()
    await open()
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    document.body.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    expect(w.emitted('editDiscard')).toBeUndefined()
    expect(btn(w.element, 'Discard changes')).toBeDefined()
  })

  it('取消、Esc 之后气泡真的关了(再点才再开)', async () => {
    const w = mountBar({ edit })
    await btn(w.element, 'Discard changes')!.click()
    await flushPromises()
    panelBtn('Cancel')!.click()
    await new Promise((r) => setTimeout(r, 400)) // 官方 Popover 关闭有过渡
    await flushPromises()
    expect(document.body.querySelector('.n-popconfirm__panel')).toBeNull()
    await btn(w.element, 'Discard changes')!.click()
    await flushPromises()
    press('Escape')
    await new Promise((r) => setTimeout(r, 400))
    await flushPromises()
    expect(document.body.querySelector('.n-popconfirm__panel')).toBeNull()
  })

  it('saving 期间按钮禁用:点了也不弹气泡', async () => {
    const w = mountBar({ edit: { ...edit, saving: true } })
    const b = btn(w.element, 'Discard changes')!
    expect(b.hasAttribute('disabled')).toBe(true)
    b.click()
    await flushPromises()
    expect(panel()).toBeNull()
    expect(w.emitted('editDiscard')).toBeUndefined()
  })

  it('批量栏里的「放弃修改」同样先确认', async () => {
    const w = mountBar({ edit, batch: { count: 2, checked: true, indeterminate: false } })
    await btn(w.element, 'Discard changes')!.click()
    await flushPromises()
    expect(panel()!.textContent).toContain('Discard all 3 unsaved changes?')
    expect(w.emitted('editDiscard')).toBeUndefined()
    panelBtn('Discard')!.click()
    await flushPromises()
    expect(w.emitted('editDiscard')).toHaveLength(1)
  })

  it('窄档折叠的「操作」展开里同样先确认', async () => {
    const w = mountBar({ edit, fold: true, tier: 'narrow', title: 'T' })
    await w.find('.smart-table-toolbar-ops').trigger('click')
    await btn(w.element, 'Discard changes')!.click()
    await flushPromises()
    expect(panel()).not.toBeNull()
    expect(w.emitted('editDiscard')).toBeUndefined()
    panelBtn('Discard')!.click()
    await flushPromises()
    expect(w.emitted('editDiscard')).toHaveLength(1)
  })
})

describe('Toolbar:「含 M 条当前不可见」', () => {
  const base = { count: 3, saving: false, add: true, remove: true, restore: false }
  const mountBar = (extra: Record<string, unknown> = {}) => {
    const w = mount(Toolbar, {
      props: { labels: defaultLabels, config: {} as never, density: 'compact', ...extra },
      attachTo: document.body,
    })
    mounted.push(w)
    return w
  }

  it('hidden > 0 才出现,文案带 M;0 或没传不出现', () => {
    expect(
      mountBar({ edit: { ...base, hidden: 2 } })
        .find('.smart-table-edit-hidden')
        .text(),
    ).toBe(fmt(defaultLabels.editHiddenDirty, { n: 2 }))
    expect(
      mountBar({ edit: { ...base, hidden: 0 } })
        .find('.smart-table-edit-hidden')
        .exists(),
    ).toBe(false)
    expect(mountBar({ edit: base }).find('.smart-table-edit-hidden').exists()).toBe(false)
  })

  it('紧跟在「保存修改(N)」后面;样式:12px、不换行、次要文字色(textColor3,走主题变量)', () => {
    const w = mountBar({ edit: { ...base, hidden: 1 } })
    const hint = w.find('.smart-table-edit-hidden')
    expect(hint.element.previousElementSibling?.textContent).toContain('Save changes (3)')
    const style = (hint.element as HTMLElement).style
    expect(style.color).not.toBe('')
    expect(style.color).toContain('rgb')
  })

  it('批量栏里也有', () => {
    const w = mountBar({
      edit: { ...base, hidden: 4 },
      batch: { count: 1, checked: true, indeterminate: false },
    })
    expect(w.find('.smart-table-batch-acts .smart-table-edit-hidden').text()).toBe(
      fmt(defaultLabels.editHiddenDirty, { n: 4 }),
    )
  })

  it('窄档展开的「操作」里:提示是业务组里的独立一项(class 让它单独占一行),折叠时业务组整体不显示', async () => {
    const w = mountBar({ edit: { ...base, hidden: 1 }, fold: true, tier: 'narrow', title: 'T' })
    const hint = w.find('.smart-table-toolbar-actions .smart-table-edit-hidden')
    expect(hint.exists()).toBe(true)
    expect(w.classes()).toContain('smart-table-toolbar--fold')
    await w.find('.smart-table-toolbar-ops').trigger('click')
    expect(w.classes()).toContain('smart-table-toolbar--ops-open')
  })
})

describe('createEditStore.hiddenCount:带草稿但不在可见集合里的行数', () => {
  const mk = () => createEditStore<Row>((r) => r.id)

  it('无草稿 = 0', () => {
    expect(mk().hiddenCount(['1', '2'])).toBe(0)
  })

  it('改过的行:可见 = 0;被挡住(翻页 / 搜索)= 1;同一行改多格只算一行', () => {
    const s = mk()
    const [r1] = rows()
    s.set(r1, 'name', 'x')
    s.set(r1, 'id', 11)
    expect(s.hiddenCount(['1', '2'])).toBe(0)
    expect(s.hiddenCount(['2', '3'])).toBe(1)
    expect(s.hiddenCount([])).toBe(1)
  })

  it('新增行与待删行也计入;待删又带草稿的行只算一行', () => {
    const s = mk()
    const data = rows()
    s.addNew({ id: 'n1', name: '' } as unknown as Row)
    s.set(data[1], 'name', 'x')
    s.markDelete([data[1]]) // 待删行里改过的格:仍是一行
    s.markDelete([data[2]])
    expect(s.hiddenCount(['n1', '2', '3'])).toBe(0)
    expect(s.hiddenCount(['1'])).toBe(3)
    expect(s.hiddenCount(['n1', '1'])).toBe(2)
  })

  it('改回原值后不再计入', () => {
    const s = mk()
    const [r1] = rows()
    s.set(r1, 'name', 'x')
    s.set(r1, 'name', 'alice')
    expect(s.hiddenCount([])).toBe(0)
  })
})

describe('SmartTable:放弃修改的确认流程 + M 的接线', () => {
  type Inst = {
    setCell: (k: number, f: string, v: unknown) => boolean
    goPage: (n: number) => Promise<void>
    refresh: () => Promise<void>
    dirtyCount: number
  }
  const pageOf = (p: number): Row[] => rows().slice((p - 1) * 2, p * 2)
  function mountRemote(attrs: Record<string, unknown> = {}, hide: { ids: number[] } = { ids: [] }) {
    const fetcher = vi.fn(async (params: Record<string, unknown>) => ({
      items: pageOf(Number(params.page ?? 1)).filter((r) => !hide.ids.includes(r.id)),
      total: 3,
    }))
    const w = mount(SmartTable, {
      props: {
        columns: columns(),
        fetcher,
        rowKey: 'id',
        editable: true,
        pagination: { pageSize: 2 },
      },
      attrs,
      attachTo: document.body,
    })
    mounted.push(w)
    return w
  }
  const hint = (w: VueWrapper) => w.find('.smart-table-edit-hidden')
  /** 点官方分页器的第 n 页(本地模式:库自己切页)。 */
  async function clickPage(w: VueWrapper, n: number) {
    const item = w.findAll('.n-pagination-item').find((i) => i.text() === String(n))!
    await item.trigger('click')
    await nextTick()
    await flushPromises()
  }

  it('点「放弃修改」:弹气泡,草稿还在、@discard 未发;取消后草稿保留;再点「放弃」才还原并发 @discard', async () => {
    const onDiscard = vi.fn()
    const w = mountRemote({ onDiscard })
    await flushPromises()
    const vm = w.vm as unknown as Inst
    vm.setCell(1, 'name', 'zed')
    await flushPromises()
    expect(w.text()).toContain('zed')
    await btn(w.element, 'Discard changes')!.click()
    await flushPromises()
    expect(panel()!.textContent).toContain('Discard all 1 unsaved changes?')
    expect(onDiscard).not.toHaveBeenCalled()
    expect(vm.dirtyCount).toBe(1)
    panelBtn('Cancel')!.click()
    await flushPromises()
    expect(onDiscard).not.toHaveBeenCalled()
    expect(vm.dirtyCount).toBe(1)
    expect(w.text()).toContain('zed')
    await new Promise((r) => setTimeout(r, 400))
    await btn(w.element, 'Discard changes')!.click()
    await flushPromises()
    panelBtn('Discard')!.click()
    await flushPromises()
    expect(onDiscard).toHaveBeenCalledTimes(1)
    expect(vm.dirtyCount).toBe(0)
    expect(w.text()).not.toContain('zed')
    expect(w.text()).toContain('alice')
  })

  it('M:草稿行在当前页 = 不显示;翻到别的页 = 含 1 条;翻回来 = 消失', async () => {
    const w = mountRemote()
    await flushPromises()
    const vm = w.vm as unknown as Inst
    vm.setCell(1, 'name', 'zed')
    await flushPromises()
    expect(hint(w).exists()).toBe(false)
    await vm.goPage(2)
    await flushPromises()
    expect(hint(w).text()).toBe('Includes 1 not currently visible')
    await vm.goPage(1)
    await flushPromises()
    expect(hint(w).exists()).toBe(false)
  })

  it('M:被搜索 / 重新请求挡住的已改行计入(请求结果不含它),结果恢复后消失', async () => {
    const hide = { ids: [] as number[] }
    const w = mountRemote({}, hide)
    await flushPromises()
    const vm = w.vm as unknown as Inst
    vm.setCell(1, 'name', 'zed')
    vm.setCell(2, 'name', 'yan')
    await flushPromises()
    expect(hint(w).exists()).toBe(false)
    hide.ids = [1]
    await vm.refresh()
    await flushPromises()
    expect(hint(w).text()).toContain('1')
    hide.ids = [1, 2]
    await vm.refresh()
    await flushPromises()
    expect(hint(w).text()).toContain('2')
    hide.ids = []
    await vm.refresh()
    await flushPromises()
    expect(hint(w).exists()).toBe(false)
  })

  it('M:新增行只在它所在的页出现,翻页后计入;没有任何草稿时为 0', async () => {
    const w = mountRemote()
    await flushPromises()
    const vm = w.vm as unknown as Inst
    expect(hint(w).exists()).toBe(false)
    await btn(w.element, 'Add row')!.click()
    await flushPromises()
    await flushPromises()
    expect(hint(w).exists()).toBe(false)
    await vm.goPage(2)
    await flushPromises()
    expect(hint(w).text()).toContain('1')
  })

  it('本地数据:翻页挡住的已改行同样计入', async () => {
    const w = mount(SmartTable, {
      props: {
        columns: columns(),
        data: rows(),
        rowKey: 'id',
        editable: true,
        pagination: { pageSize: 2, simple: false },
      },
      attachTo: document.body,
    })
    mounted.push(w)
    await flushPromises()
    const vm = w.vm as unknown as Inst
    vm.setCell(1, 'name', 'zed')
    await flushPromises()
    expect(hint(w).exists()).toBe(false)
    await clickPage(w, 2)
    expect(hint(w).text()).toBe('Includes 1 not currently visible')
  })

  it('窄档:提示在展开的「操作」里,独占一行的 class 存在', async () => {
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get: () => 400,
    })
    const w = mount(SmartTable, {
      props: {
        columns: columns(),
        data: rows(),
        rowKey: 'id',
        editable: true,
        cardOnNarrow: true,
        pagination: { pageSize: 2, simple: false },
      },
      attachTo: document.body,
    })
    mounted.push(w)
    await flushPromises()
    const vm = w.vm as unknown as Inst
    vm.setCell(1, 'name', 'zed')
    await clickPage(w, 2)
    expect(w.find('.smart-table-toolbar--fold').exists()).toBe(true)
    expect(w.find('.smart-table-toolbar-actions .smart-table-edit-hidden').exists()).toBe(true)
  })
})
