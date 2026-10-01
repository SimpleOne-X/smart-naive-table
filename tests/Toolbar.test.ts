// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { NDropdown } from 'naive-ui'
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
