// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { NGrid } from 'naive-ui'
import SearchForm from '../src/SearchForm.vue'
import { defaultLabels } from '../src/labels'
import { deriveSearchDefs } from '../src/useColumns'

const fields = deriveSearchDefs([
  { key: 'a', title: 'A', search: true },
  { key: 'b', title: 'B', search: true },
])

function mountForm(gridTemplateColumns: string, config: Record<string, unknown> = { collapsible: true }) {
  const real = window.getComputedStyle.bind(window)
  vi.spyOn(window, 'getComputedStyle').mockImplementation((el: Element, pseudo?: string | null) =>
    el.classList?.contains('n-grid') ? ({ gridTemplateColumns } as CSSStyleDeclaration) : real(el, pseudo),
  )
  return mount(SearchForm, {
    props: { fields, params: {}, config, labels: defaultLabels, getOptions: () => [], isLoadingOptions: () => false },
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
