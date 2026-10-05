// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { NGrid } from 'naive-ui'
import SearchForm from '../src/SearchForm.vue'
import searchFormSource from '../src/SearchForm.vue?raw'
import { defaultLabels } from '../src/labels'
import { deriveSearchDefs } from '../src/useColumns'

const fields = deriveSearchDefs([
  { key: 'a', title: 'A', search: true },
  { key: 'b', title: 'B', search: true },
])

function mountForm(
  gridTemplateColumns: string,
  config: Record<string, unknown> = { collapsible: true },
) {
  const real = window.getComputedStyle.bind(window)
  vi.spyOn(window, 'getComputedStyle').mockImplementation((el: Element, pseudo?: string | null) =>
    el.classList?.contains('n-grid')
      ? ({ gridTemplateColumns } as CSSStyleDeclaration)
      : real(el, pseudo),
  )
  return mount(SearchForm, {
    props: {
      fields,
      params: {},
      config,
      labels: defaultLabels,
      getOptions: () => [],
      isLoadingOptions: () => false,
    },
    attachTo: document.body,
  })
}

afterEach(() => vi.restoreAllMocks())

describe('SearchForm 折叠态的 collapsed-rows(C5,按 n-grid 实际轨道数判断)', () => {
  it('窄屏 1 个轨道 → collapsed-rows 抬到 2', async () => {
    const w = mountForm('300px')
    await nextTick() // onMounted 里读到轨道数后,collapsed-rows 在下一轮渲染才更新
    expect(w.findComponent(NGrid).props('collapsedRows')).toBe(2)
    w.unmount()
  })

  it('2 个及以上轨道(含宿主自定义断点下算出的列数)→ 保持配置值 1', async () => {
    const w = mountForm('150px 150px')
    await nextTick()
    expect(w.findComponent(NGrid).props('collapsedRows')).toBe(1)
    w.unmount()
  })

  it('读不到轨道数(none)→ 保持配置值,不改现有行为', async () => {
    const w = mountForm('none')
    await nextTick()
    expect(w.findComponent(NGrid).props('collapsedRows')).toBe(1)
    w.unmount()
  })

  it('宿主自己配了 collapsedRows: 2 时,1 个轨道也不再抬', async () => {
    const w = mountForm('300px', { collapsible: true, collapsedRows: 2 })
    await nextTick()
    expect(w.findComponent(NGrid).props('collapsedRows')).toBe(2)
    w.unmount()
  })
})

describe('SearchForm 操作区对齐(L0-7)', () => {
  it('搜索 / 重置 / 展开 同排垂直居中(n-space align=center),不再默认顶对齐', () => {
    const w = mountForm('150px 150px')
    const space = w.find('.smart-table-search .n-space')
    expect(space.attributes('style')).toContain('align-items: center')
    w.unmount()
  })

  it('「展开」文字按钮与同排按钮同高(主题 heightMedium = 34px;官方文字按钮自己的高度是 initial)', () => {
    const w = mountForm('150px 150px')
    const toggle = w.find('.smart-table-search-toggle')
    expect(toggle.exists()).toBe(true)
    expect(toggle.text()).toBe('Expand')
    expect(toggle.attributes('style')).toContain('height: 34px')
    w.unmount()
  })
})

describe('SearchForm 「搜索」按钮的 loading 不改变按钮宽度(与 ConditionBar 同一缺陷,issue #5)', () => {
  // 官方 NButton 的 loading 会加一个 16px + 6px 间距的转圈槽,进 / 出 loading 时按钮宽度逐帧变化,
  // 同排的「重置」/「展开」被推着动。jsdom 不做布局,这里只锁结构事实;真实宽度由浏览器实测(见任务汇报)。
  function mountLoading(layout: 'grid' | 'inline', loading: boolean) {
    return mount(SearchForm, {
      props: {
        fields,
        params: {},
        config: { layout },
        labels: defaultLabels,
        loading,
        getOptions: () => [],
        isLoadingOptions: () => false,
      },
      attachTo: document.body,
    })
  }

  it('转圈槽 .n-button__icon 脱离文档流', () => {
    expect(searchFormSource).toMatch(
      /\.smart-table-search-submit\.n-button :deep\(\.n-button__icon\)\s*\{[^}]*position: absolute/,
    )
  })

  it.each(['grid', 'inline'] as const)(
    '%s 布局:「搜索」按钮带 smart-table-search-submit',
    (layout) => {
      const w = mountLoading(layout, true)
      const btn = w.findAll('button').find((b) => b.text() === 'Search')!
      expect(btn.classes()).toContain('smart-table-search-submit')
      expect(btn.classes()).toContain('n-button--loading')
      w.unmount()
    },
  )

  it.each(['grid', 'inline'] as const)(
    '%s 布局:loading 期间点「搜索」不发 search',
    async (layout) => {
      const w = mountLoading(layout, true)
      await w
        .findAll('button')
        .find((b) => b.text() === 'Search')!
        .trigger('click')
      expect(w.emitted('search')).toBeUndefined()
      await w.setProps({ loading: false })
      await w
        .findAll('button')
        .find((b) => b.text() === 'Search')!
        .trigger('click')
      expect(w.emitted('search')).toHaveLength(1)
      w.unmount()
    },
  )
})
