// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
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
