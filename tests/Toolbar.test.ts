// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { NConfigProvider, NDropdown, darkTheme } from 'naive-ui'
import Toolbar from '../src/Toolbar.vue'
import { defaultLabels } from '../src/labels'

const mountToolbar = (config: Record<string, unknown> | false = {}, extra: Record<string, unknown> = {}) =>
  mount(Toolbar, { props: { labels: defaultLabels, config: config as never, density: 'compact' as const, ...extra } })

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
    expect(mountToolbar({ refresh: true }, { remote: false }).html()).not.toContain('aria-label="Refresh"')
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
    expect(mountToolbar({ more: [{ type: 'divider', key: 'd' }] }).html()).not.toContain('aria-label="More"')
    expect(mountToolbar(false).html()).not.toContain('aria-label="More"')
  })

  it('选中菜单项 → 发出 moreSelect(key, option)', () => {
    const wrapper = mountToolbar({ more: opts })
    const onSelect = wrapper.findComponent(NDropdown).props('onSelect') as (k: string, o: unknown) => void
    onSelect('export', opts[0])
    expect(wrapper.emitted('moreSelect')).toEqual([['export', opts[0]]])
  })

  it('「更多」排在宿主 #right 插槽内容之后、刷新按钮之前', () => {
    const wrapper = mount(Toolbar, {
      props: { labels: defaultLabels, config: { more: opts } as never, density: 'compact' as const },
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
    const style = mountToolbar({}, { title: '物料单据' }).find('.smart-table-title').attributes('style') ?? ''
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
    expect(wrapper.find('.smart-table-more-icon').attributes('style')).toContain('color: rgb(194, 194, 194)')
  })

  it('[L0-2] 分组:宿主按钮 + 「更多」在 actions 组(间距 8),内置图标在 icons 组(间距 4),两组并排(间距 12)', () => {
    const wrapper = mount(Toolbar, {
      props: { labels: defaultLabels, config: { more: opts } as never, density: 'compact' as const },
      slots: { right: '<i class="host-btn">新增</i>', settings: '<i class="settings-btn">设置</i>' },
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
      props: { labels: defaultLabels, config: { more: opts, density: true } as never, density: 'compact' as const },
      slots: { settings: '<button class="settings-btn" aria-label="Columns">列</button>' },
    })
    for (const label of ['Refresh', 'Density']) {
      expect(wrapper.find(`button[aria-label="${label}"]`).attributes('style')).toContain('--n-icon-size: 16px')
    }
    expect(wrapper.find('button[aria-label="More"]').attributes('style')).toContain('--n-icon-size: 12px')
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
