// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { NConfigProvider, NDropdown, darkTheme } from 'naive-ui'
import Toolbar from '../src/Toolbar.vue'
import { defaultLabels } from '../src/labels'

const mountToolbar = (
  config: Record<string, unknown> | false = {},
  extra: Record<string, unknown> = {},
) =>
  mount(Toolbar, {
    props: {
      labels: defaultLabels,
      config: config as never,
      density: 'compact' as const,
      ...extra,
    },
  })

describe('Toolbar 内置图标(B3)', () => {
  it('默认没有「密度」按钮,有「刷新」', () => {
    const html = mountToolbar().html()
    expect(html).toContain('aria-label="Refresh"')
    expect(html).not.toContain('aria-label="Density"')
  })

  it('toolbar: { density: true } 才把密度按钮请回来', () => {
    expect(mountToolbar({ density: true }).html()).toContain('aria-label="Density"')
  })

  it('toolbar: false 时两个图标都没有', () => {
    const html = mountToolbar(false).html()
    expect(html).not.toContain('aria-label="Refresh"')
    expect(html).not.toContain('aria-label="Density"')
  })
})

describe('Toolbar 刷新按钮(B5)', () => {
  it('静态模式(remote=false)不显示刷新,即使显式 toolbar.refresh: true', () => {
    expect(mountToolbar({}, { remote: false }).html()).not.toContain('aria-label="Refresh"')
    expect(mountToolbar({ refresh: true }, { remote: false }).html()).not.toContain(
      'aria-label="Refresh"',
    )
  })
  it('远程模式(默认)显示刷新;refresh: false 关掉', () => {
    expect(mountToolbar({}).html()).toContain('aria-label="Refresh"')
    expect(mountToolbar({ refresh: false }).html()).not.toContain('aria-label="Refresh"')
  })
})

describe('Toolbar「更多」菜单(toolbar.more)', () => {
  const opts = [
    { label: '导出', key: 'export' },
    { label: '导入', key: 'import' },
    { type: 'divider' as const, key: 'd1' },
    { label: '下载导入模板', key: 'tpl' },
  ]

  it('传了可选项 → 出现「更多」按钮(文字取 labels.more)', () => {
    const html = mountToolbar({ more: opts }).html()
    expect(html).toContain('aria-label="More"')
  })

  it('[Review Focus 5] 没传 / 空数组 / 只有分隔线 / toolbar:false → 不渲染按钮', () => {
    expect(mountToolbar({}).html()).not.toContain('aria-label="More"')
    expect(mountToolbar({ more: [] }).html()).not.toContain('aria-label="More"')
    expect(mountToolbar({ more: [{ type: 'divider', key: 'd' }] }).html()).not.toContain(
      'aria-label="More"',
    )
    expect(mountToolbar(false).html()).not.toContain('aria-label="More"')
  })

  it('选中菜单项 → 发出 moreSelect(key, option)', () => {
    const wrapper = mountToolbar({ more: opts })
    const onSelect = wrapper.findComponent(NDropdown).props('onSelect') as (
      k: string,
      o: unknown,
    ) => void
    onSelect('export', opts[0])
    expect(wrapper.emitted('moreSelect')).toEqual([['export', opts[0]]])
  })

  it('「更多」排在宿主 #right 插槽内容之后、刷新按钮之前', () => {
    const wrapper = mount(Toolbar, {
      props: {
        labels: defaultLabels,
        config: { more: opts } as never,
        density: 'compact' as const,
      },
      slots: { right: '<i class="host-btn">新增</i>' },
    })
    const html = wrapper.html()
    const host = html.indexOf('host-btn')
    const more = html.indexOf('aria-label="More"')
    const refresh = html.indexOf('aria-label="Refresh"')
    expect(host).toBeGreaterThan(-1)
    expect(host).toBeLessThan(more)
    expect(more).toBeLessThan(refresh)
  })
})

describe('Toolbar 外观对齐原型(L0-1 / L0-2)', () => {
  const opts = [{ label: '导出', key: 'export' }]

  it('[L0-1] 标题:字重 500(fontWeightStrong)、颜色 textColor1;不是 2.1.1 的 600 / textColor2', () => {
    const style =
      mountToolbar({}, { title: '物料单据' }).find('.smart-table-title').attributes('style') ?? ''
    expect(style).toContain('font-weight: 500')
    expect(style).toContain('color: rgb(31, 34, 37)') // 默认亮色主题的 textColor1
  })

  it('[L0-1] 标题颜色跟主题走:暗色是 textColor1 的暗色值', () => {
    const Host = defineComponent({
      render: () =>
        h(NConfigProvider, { theme: darkTheme }, () =>
          h(Toolbar, { labels: defaultLabels, config: {}, density: 'compact', title: '物料单据' }),
        ),
    })
    const style = mount(Host).find('.smart-table-title').attributes('style') ?? ''
    expect(style).toContain('color: rgba(255, 255, 255, 0.9)')
  })

  it('[L0-2]「更多」是 medium(34px,与宿主按钮同高),不再是 small;chevron 取 iconColor', () => {
    const wrapper = mountToolbar({ more: opts })
    const btn = wrapper.find('button[aria-label="More"]')
    expect(btn.attributes('style')).toContain('--n-height: 34px')
    expect(wrapper.find('.smart-table-more-icon').attributes('style')).toContain(
      'color: rgb(194, 194, 194)',
    )
  })

  it('[L0-2] 分组:宿主按钮 + 「更多」在 actions 组(间距 8),内置图标在 icons 组(间距 4),两组并排(间距 12)', () => {
    const wrapper = mount(Toolbar, {
      props: {
        labels: defaultLabels,
        config: { more: opts } as never,
        density: 'compact' as const,
      },
      slots: {
        right: '<i class="host-btn">新增</i>',
        settings: '<i class="settings-btn">设置</i>',
      },
    })
    const right = wrapper.find('.smart-table-toolbar-right')
    expect(right.exists()).toBe(true)
    const [actions, icons] = right.element.children
    expect(actions.classList.contains('smart-table-toolbar-actions')).toBe(true)
    expect(icons.classList.contains('smart-table-toolbar-icons')).toBe(true)
    expect(actions.querySelector('.host-btn')).not.toBeNull()
    expect(actions.querySelector('button[aria-label="More"]')).not.toBeNull()
    expect(icons.querySelector('button[aria-label="Refresh"]')).not.toBeNull()
    expect(icons.querySelector('.settings-btn')).not.toBeNull()
    expect(actions.querySelector('button[aria-label="Refresh"]')).toBeNull()
  })

  it('[L0-2] 内置图标按钮(刷新 / 密度 / 列设置 #settings 里的按钮)图标 16px,不是官方 small 的 18px;「更多」不受影响', () => {
    const wrapper = mount(Toolbar, {
      props: {
        labels: defaultLabels,
        config: { more: opts, density: true } as never,
        density: 'compact' as const,
      },
      slots: { settings: '<button class="settings-btn" aria-label="Columns">列</button>' },
    })
    for (const label of ['Refresh', 'Density']) {
      expect(wrapper.find(`button[aria-label="${label}"]`).attributes('style')).toContain(
        '--n-icon-size: 16px',
      )
    }
    expect(wrapper.find('button[aria-label="More"]').attributes('style')).toContain(
      '--n-icon-size: 12px',
    )
  })

  it('[L0-2] 没有宿主按钮也没有「更多」时不画 actions 组(否则空容器会多出一个 12px 的间距)', () => {
    const wrapper = mountToolbar({})
    expect(wrapper.find('.smart-table-toolbar-actions').exists()).toBe(false)
    expect(wrapper.find('.smart-table-toolbar-icons').exists()).toBe(true)
  })

  it('[L0-2] 图标全关(toolbar: false)时也不画 icons 组', () => {
    expect(mountToolbar(false).find('.smart-table-toolbar-icons').exists()).toBe(false)
  })
})

describe('Toolbar 放大按钮(toolbar.maximize,状态在 SmartTable)', () => {
  it('默认没有;maximizable 才出现,文字 / aria 取 labels.maximize,点了发 toggleMaximize', async () => {
    expect(mountToolbar().html()).not.toContain('Maximize')
    const w = mountToolbar({}, { maximizable: true })
    const btn = w.find('button[aria-label="Maximize"]')
    expect(btn.exists()).toBe(true)
    expect(btn.attributes('aria-pressed')).toBe('false')
    await btn.trigger('click')
    expect(w.emitted('toggleMaximize')).toHaveLength(1)
  })

  it('放大态:名称变「Restore」,aria-pressed = true', () => {
    const w = mountToolbar({}, { maximizable: true, maximized: true })
    const btn = w.find('button[aria-label="Restore"]')
    expect(btn.exists()).toBe(true)
    expect(btn.attributes('aria-pressed')).toBe('true')
    expect(w.find('button[aria-label="Maximize"]').exists()).toBe(false)
  })

  it('顺序:宿主按钮 · 更多 · 放大 · 刷新(规格 §5.2);批量态下放大按钮仍在(图标区不被替换)', () => {
    const w = mount(Toolbar, {
      props: {
        labels: defaultLabels,
        config: { more: [{ label: '导出', key: 'x' }] } as never,
        density: 'compact' as const,
        maximizable: true,
      },
      slots: { right: '<i class="host-btn">新增</i>' },
    })
    const html = w.html()
    const order = [
      'host-btn',
      'aria-label="More"',
      'aria-label="Maximize"',
      'aria-label="Refresh"',
    ].map((k) => html.indexOf(k))
    expect(order.every((i) => i >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    const batch = mountToolbar(
      {},
      { maximizable: true, batch: { count: 1, checked: false, indeterminate: true } },
    )
    expect(batch.find('button[aria-label="Maximize"]').exists()).toBe(true)
  })

  it('「更多」下拉受控:打开后 document 上的 Esc 能关(NDropdown 只有焦点在菜单里才响应 Esc)', async () => {
    const w = mount(Toolbar, {
      props: {
        labels: defaultLabels,
        config: { more: [{ label: '导出', key: 'x' }] } as never,
        density: 'compact' as const,
      },
      attachTo: document.body,
    })
    const dd = w.findComponent(NDropdown)
    ;(dd.props('onUpdate:show') as (v: boolean) => void)(true)
    await nextTick()
    expect(dd.props('show')).toBe(true)
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    )
    await nextTick()
    expect(dd.props('show')).toBe(false)
    w.unmount()
  })
})

describe('Toolbar「更多」菜单的锚定对齐原型(Task 7b;原型 .more-pop / 设计文档 §7.3)', () => {
  const opts = [
    { label: '导出', key: 'export' },
    { label: '导入', key: 'import' },
  ]
  const openMore = async () => {
    const w = mount(Toolbar, {
      props: {
        labels: defaultLabels,
        config: { more: opts } as never,
        density: 'compact' as const,
      },
      attachTo: document.body,
    })
    const dd = w.findComponent(NDropdown)
    ;(dd.props('onUpdate:show') as (v: boolean) => void)(true)
    await nextTick()
    await nextTick()
    return { w, dd }
  }

  it('锚在按钮下方、左对齐:placement = bottom-start(不是 bottom-end)', async () => {
    const { w, dd } = await openMore()
    expect(dd.props('placement')).toBe('bottom-start')
    w.unmount()
  })

  it('菜单最小宽 148(官方 menu-props 给根菜单的 DOM 属性;官方 min-width prop 在 PopoverBody 里被写成了 max-width,不能用)', async () => {
    const { w } = await openMore()
    const menu = document.querySelector<HTMLElement>('.n-dropdown-menu')!
    expect(menu).toBeTruthy()
    expect(menu.style.minWidth).toBe('148px')
    expect(menu.style.maxWidth).toBe('') // 没有误用 min-width prop(它会变成 max-width: 148px)
    w.unmount()
  })

  it('菜单离按钮 8px(原型 top: calc(100% + 8px);官方 Popover 主题变量 space 默认 6px,经 Dropdown 的 peers.Popover 覆盖)', async () => {
    const { w } = await openMore()
    const menu = document.querySelector<HTMLElement>('.n-dropdown-menu')!
    expect(menu.style.getPropertyValue('--n-space')).toBe('8px')
    w.unmount()
  })

  it('只影响「更多」:密度下拉仍是官方默认(placement bottom、没有 min-width / space 覆盖)', () => {
    const w = mountToolbar({ density: true })
    const dd = w.findComponent(NDropdown)
    expect(dd.props('placement')).toBe('bottom')
    expect(dd.props('menuProps')).toBeUndefined()
    expect(dd.props('themeOverrides')).toBeUndefined()
  })
})

describe('Toolbar 窄档折叠(cardOnNarrow 的 fold,规格 §5.2)', () => {
  const mountFold = (extra: Record<string, unknown> = {}, more = true) =>
    mount(Toolbar, {
      props: {
        labels: defaultLabels,
        config: (more ? { more: [{ label: '导出', key: 'export' }] } : {}) as never,
        density: 'compact' as const,
        title: '物料单据',
        fold: true,
        tier: 'narrow' as const,
        ...extra,
      },
      slots: {
        right: '<button class="host-add">新增</button>',
        settings: '<i class="slot-set" />',
      },
      attachTo: document.body,
    })

  it('默认(没有 fold):业务按钮直接显示,没有「操作」按钮', () => {
    const w = mount(Toolbar, {
      props: { labels: defaultLabels, config: {}, density: 'compact' as const },
      slots: { right: '<button class="host-add">新增</button>' },
    })
    expect(w.find('.smart-table-toolbar-ops').exists()).toBe(false)
    expect(w.find('.host-add').exists()).toBe(true)
    expect(w.find('.smart-table-toolbar').classes()).not.toContain('smart-table-toolbar--fold')
  })

  it('fold:业务按钮折叠,出现文字按钮「Actions ▾」;点开 → 业务组原位显示(带展开态 class),再点收起', async () => {
    const w = mountFold()
    const ops = w.find('.smart-table-toolbar-ops')
    expect(ops.exists()).toBe(true)
    expect(ops.text()).toBe('Actions ▾')
    expect(ops.attributes('aria-expanded')).toBe('false')
    expect(w.find('.smart-table-toolbar').classes()).toContain('smart-table-toolbar--fold')
    expect(w.find('.smart-table-toolbar').classes()).not.toContain('smart-table-toolbar--ops-open')
    await ops.trigger('click')
    expect(w.find('.smart-table-toolbar-ops').text()).toBe('Actions ▴')
    expect(w.find('.smart-table-toolbar-ops').attributes('aria-expanded')).toBe('true')
    expect(w.find('.smart-table-toolbar').classes()).toContain('smart-table-toolbar--ops-open')
    // 展开行里是宿主按钮 + 「更多」,就在工具栏里(不是浮层)
    const acts = w.find('.smart-table-toolbar-actions')
    expect(acts.find('.host-add').exists()).toBe(true)
    expect(acts.find('[aria-label="More"]').exists()).toBe(true)
    await w.find('.smart-table-toolbar-ops').trigger('click')
    expect(w.find('.smart-table-toolbar').classes()).not.toContain('smart-table-toolbar--ops-open')
    w.unmount()
  })

  it('没有业务按钮(没有 #right 也没有「更多」)时不画「操作」', () => {
    const w = mount(Toolbar, {
      props: { labels: defaultLabels, config: {}, density: 'compact' as const, fold: true },
    })
    expect(w.find('.smart-table-toolbar-ops').exists()).toBe(false)
  })

  it('fold 的「操作」文案走 labels.operations', () => {
    const w = mountFold({ labels: { ...defaultLabels, operations: '操作' } })
    expect(w.find('.smart-table-toolbar-ops').text()).toBe('操作 ▾')
    w.unmount()
  })

  it('fold:内置图标按钮换成 large(触控 40×40),设置插槽拿到同一个 size', () => {
    const w = mountFold({ remote: true })
    expect(w.find('[aria-label="Refresh"]').classes()).toContain('n-button--large-type')
    w.unmount()
    const normal = mount(Toolbar, {
      props: { labels: defaultLabels, config: {}, density: 'compact' as const },
    })
    expect(normal.find('[aria-label="Refresh"]').classes()).toContain('n-button--small-type')
  })

  it('fold + 有可排序列:工具栏最下面一行是「Sort」按钮(窄档没有表头,排序入口收在这里),角标 = 已生效排序条数,点它发 openSort', async () => {
    const w = mountFold({ sortEntry: true, sortCount: 2 })
    const btn = w.find('.smart-table-toolbar-sort')
    expect(btn.exists()).toBe(true)
    expect(btn.text()).toContain('Sort')
    expect(w.find('.smart-table-toolbar-sort-badge').text()).toBe('2')
    await btn.trigger('click')
    expect(w.emitted('openSort')).toHaveLength(1)
    w.unmount()
  })

  it('没有排序入口 / 没有生效排序:不画「排序」按钮 / 不画角标', () => {
    const none = mountFold()
    expect(none.find('.smart-table-toolbar-sort').exists()).toBe(false)
    none.unmount()
    const zero = mountFold({ sortEntry: true, sortCount: 0 })
    expect(zero.find('.smart-table-toolbar-sort').exists()).toBe(true)
    expect(zero.find('.smart-table-toolbar-sort-badge').exists()).toBe(false)
    zero.unmount()
  })

  it('批量栏出现时不折叠(批量栏自己有窄档排布)', () => {
    const w = mountFold({ batch: { count: 2, checked: false, indeterminate: true } })
    expect(w.find('.smart-table-toolbar').classes()).not.toContain('smart-table-toolbar--fold')
    expect(w.find('.smart-table-toolbar-ops').exists()).toBe(false)
    w.unmount()
  })
})

describe('Toolbar 密度下拉的选中态', () => {
  it('选中态走官方 NDropdown 的 value,选项文案里不再手拼「✓ 」', () => {
    const w = mountToolbar({ density: true }, { density: 'comfortable' })
    const dd = w.findComponent(NDropdown)
    expect(dd.props('value')).toBe('comfortable')
    const opts = dd.props('options') as Array<{ label: string; key: string }>
    expect(opts.map((o) => o.key)).toEqual(['comfortable', 'compact'])
    expect(opts.map((o) => o.label)).toEqual([
      defaultLabels.densityComfortable,
      defaultLabels.densityCompact,
    ])
    expect(JSON.stringify(opts)).not.toContain('✓')
  })

  it('value 跟随 density prop;labels 换了(切语言),选项文案在渲染期跟着变', async () => {
    const w = mountToolbar({ density: true }, { density: 'compact' })
    const dd = w.findComponent(NDropdown)
    expect(dd.props('value')).toBe('compact')
    await w.setProps({
      density: 'comfortable',
      labels: { ...defaultLabels, densityComfortable: '舒适', densityCompact: '紧凑' },
    })
    expect(dd.props('value')).toBe('comfortable')
    expect((dd.props('options') as Array<{ label: string }>).map((o) => o.label)).toEqual([
      '舒适',
      '紧凑',
    ])
  })
})
