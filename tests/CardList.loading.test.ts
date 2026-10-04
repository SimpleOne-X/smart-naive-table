// @vitest-environment jsdom
// 窄档卡片列表的 loading 透明度:取 naive 主题的 opacityDisabled(亮 .5 / 暗 .38),与官方 DataTable loading 一致。
// jsdom 不计算 <style scoped>,所以透明度必须走 :style 内联才可测。
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { darkTheme, NConfigProvider, type GlobalTheme } from 'naive-ui'
import CardList from '../src/CardList.vue'
import type { CardView } from '../src/cardColumns'

interface Row {
  id: number
  name: string
}
const rows: Row[] = [
  { id: 1, name: 'bolt' },
  { id: 2, name: 'nut' },
]
const view: CardView<Row> = {
  handle: null,
  title: { key: 'name', label: () => '名称', render: (r: Row) => r.name } as never,
  metas: [],
  action: null,
  selectable: false,
  index: null,
}

function mountList(loading: boolean, theme?: GlobalTheme) {
  const Host = defineComponent({
    setup: () => () =>
      h(NConfigProvider, { abstract: true, theme }, () =>
        h(CardList as never, {
          rows,
          view,
          rowKey: (r: Row) => r.id,
          rowProps: () => ({}),
          checkedKeys: [],
          expandedKeys: [],
          loading,
        }),
      ),
  })
  const w = mount(Host)
  return w.find('.smart-table-cards').element as HTMLElement
}

describe('CardList loading 透明度', () => {
  it('亮色 loading:opacity = .5(opacityDisabled)', () => {
    const el = mountList(true)
    expect(el.classList.contains('smart-table-cards--loading')).toBe(true)
    expect(el.style.opacity).toBe('0.5')
  })

  it('暗色 loading:opacity = .38(darkTheme 的 opacityDisabled)', () => {
    const el = mountList(true, darkTheme)
    expect(el.classList.contains('smart-table-cards--loading')).toBe(true)
    expect(el.style.opacity).toBe('0.38')
  })

  it('非 loading:不带 loading 类,也没有内联 opacity', () => {
    for (const theme of [undefined, darkTheme]) {
      const el = mountList(false, theme)
      expect(el.classList.contains('smart-table-cards--loading')).toBe(false)
      expect(el.style.opacity).toBe('')
    }
  })
})
