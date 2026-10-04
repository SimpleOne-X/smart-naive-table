// @vitest-environment jsdom
// @row-click 只在点到「行本身」(普通单元格、单元格空白)时触发;
// 点到行内的按钮 / 勾选框 / 单选框 / 链接 / 输入框 / 下拉等交互控件不触发。宿主自己传的 row-props.onClick 不受影响。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { NButton, NCheckbox, NInput, NPopconfirm, NRadio, NSelect, NSwitch } from 'naive-ui'
import SmartTable from '../src/SmartTable.vue'
import type { SmartTableColumn } from '../src/types'

interface Row {
  id: number
  name: string
}
const rows: Row[] = [
  { id: 1, name: 'alice' },
  { id: 2, name: 'bob' },
]

// 用 any:与 SmartTable 的 columns prop(SmartTableColumn<unknown>[])对齐
const columns: SmartTableColumn<any>[] = [
  { key: 'name', title: 'Name' },
  {
    key: 'btn',
    title: 'Btn',
    render: () => h(NButton, { size: 'tiny', class: 'c-btn' }, () => '编辑'),
  },
  {
    key: 'native',
    title: 'Native',
    render: () => h('button', { class: 'c-native-btn' }, '原生按钮'),
  },
  { key: 'chk', title: 'Chk', render: () => h(NCheckbox, { class: 'c-chk' }) },
  { key: 'radio', title: 'Radio', render: () => h(NRadio, { class: 'c-radio' }) },
  { key: 'sw', title: 'Sw', render: () => h(NSwitch, { class: 'c-sw' }) },
  {
    key: 'link',
    title: 'Link',
    render: (row) => h('a', { class: 'c-link', href: '#x' }, `链接 ${row.name}`),
  },
  { key: 'input', title: 'Input', render: () => h(NInput, { class: 'c-input' }) },
  { key: 'rawInput', title: 'RawInput', render: () => h('input', { class: 'c-raw-input' }) },
  {
    key: 'select',
    title: 'Select',
    render: () => h(NSelect, { class: 'c-select', options: [{ label: 'a', value: 'a' }] }),
  },
  {
    key: 'pop',
    title: 'Pop',
    render: () =>
      h(NPopconfirm, null, {
        trigger: () => h(NButton, { class: 'c-pop' }, () => '删除'),
        default: () => '确认删除?',
      }),
  },
  {
    key: 'wrapped',
    title: 'Wrapped',
    render: () =>
      h('button', { class: 'c-wrapped' }, [h('span', { class: 'c-wrapped-inner' }, '内层')]),
  },
]

const mounted: Array<ReturnType<typeof mount>> = []
// 点 NSelect 会展开菜单:vueuc VirtualList 在 setup 里读 window.matchMedia、展开后调 Element.scrollTo,jsdom 都没有
const hadScrollTo = 'scrollTo' in Element.prototype
beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
  if (!hadScrollTo) Element.prototype.scrollTo = () => {}
})
afterEach(() => {
  while (mounted.length) mounted.pop()!.unmount()
  vi.unstubAllGlobals()
  if (!hadScrollTo) delete (Element.prototype as { scrollTo?: unknown }).scrollTo
})

async function mountTable(
  attrs: Record<string, unknown> = {},
  extra: Record<string, unknown> = {},
) {
  const w = mount(SmartTable, {
    props: { columns, data: rows, rowKey: 'id', ...extra },
    attrs,
    attachTo: document.body,
  })
  mounted.push(w)
  await flushPromises()
  return w
}

const firstRow = (w: ReturnType<typeof mount>) => w.findAll('tbody tr')[0]

describe('SmartTable @row-click 的触发范围(D2)', () => {
  it('点普通单元格 → 触发,载荷 (row, index)', async () => {
    const w = await mountTable()
    await firstRow(w).findAll('td')[0].trigger('click')
    expect(w.emitted('rowClick')).toEqual([[rows[0], 0]])
  })

  it('点单元格空白(tr 本身)→ 触发', async () => {
    const w = await mountTable()
    await firstRow(w).trigger('click')
    expect(w.emitted('rowClick')).toHaveLength(1)
  })

  it('点第二行 → index 为 1', async () => {
    const w = await mountTable()
    await w.findAll('tbody tr')[1].findAll('td')[0].trigger('click')
    expect(w.emitted('rowClick')).toEqual([[rows[1], 1]])
  })

  // 每一项:选择器 → 点它(或它内部)的元素
  const controls: Array<[string, string]> = [
    ['NButton(渲染成 button)', '.c-btn'],
    ['原生 button', '.c-native-btn'],
    ['button 里面的子元素(span)', '.c-wrapped-inner'],
    ['NCheckbox(.n-checkbox 是 div,不是原生 input)', '.c-chk'],
    ['NCheckbox 里的小方块(.n-checkbox-box)', '.c-chk .n-checkbox-box'],
    ['NRadio(.n-radio)', '.c-radio'],
    ['NSwitch(.n-switch)', '.c-sw'],
    ['链接 a', '.c-link'],
    ['NInput(.n-input)', '.c-input'],
    ['NInput 里的原生 input', '.c-input input'],
    ['原生 input', '.c-raw-input'],
    ['NSelect(.n-base-selection)', '.c-select .n-base-selection'],
    ['NPopconfirm 的触发按钮', '.c-pop'],
  ]
  for (const [name, sel] of controls) {
    it(`点 ${name} → 不触发`, async () => {
      const w = await mountTable()
      const el = firstRow(w).find(sel)
      expect(el.exists(), `找不到 ${sel}`).toBe(true)
      await el.trigger('click')
      expect(w.emitted('rowClick')).toBeUndefined()
    })
  }

  it('勾选列的 NCheckbox(列 type: selection)→ 不触发;点勾选列单元格空白 → 触发', async () => {
    const w = await mountTable(
      {},
      { columns: [{ type: 'selection' }, { key: 'name', title: 'Name' }] },
    )
    const td = firstRow(w).findAll('td')[0]
    await td.find('.n-checkbox').trigger('click')
    expect(w.emitted('rowClick')).toBeUndefined()
    await td.trigger('click')
    expect(w.emitted('rowClick')).toHaveLength(1)
  })

  it('点控件时宿主的 row-props.onClick 仍被调用(行 class 等其它 row-props 也照常)', async () => {
    const hostClick = vi.fn()
    const w = await mountTable({
      rowProps: (row: Row) => ({ onClick: hostClick, class: `host-${row.id}` }),
    })
    expect(firstRow(w).classes()).toContain('host-1')
    await firstRow(w).find('.c-btn').trigger('click')
    expect(hostClick).toHaveBeenCalledTimes(1)
    expect(w.emitted('rowClick')).toBeUndefined()
  })

  it('点普通单元格:宿主 row-props.onClick 先于 rowClick 调用,两者都触发', async () => {
    let rowClickSeenByHost: unknown = 'unset'
    let w!: ReturnType<typeof mount>
    w = await mountTable({
      rowProps: () => ({ onClick: () => (rowClickSeenByHost = w.emitted('rowClick')) }),
    })
    await firstRow(w).findAll('td')[0].trigger('click')
    expect(rowClickSeenByHost).toBeUndefined() // 宿主被调用时 rowClick 还没发
    expect(w.emitted('rowClick')).toHaveLength(1)
  })

  it('包住整张表的 label / a 祖先不会让行点击失效(只看行内的目标)', async () => {
    const host = document.createElement('label')
    document.body.appendChild(host)
    const w = mount(SmartTable, { props: { columns, data: rows, rowKey: 'id' }, attachTo: host })
    mounted.push(w)
    await flushPromises()
    await firstRow(w).findAll('td')[0].trigger('click')
    expect(w.emitted('rowClick')).toHaveLength(1)
    host.remove()
  })
})
