// @vitest-environment jsdom
// 窄档排序抽屉:行间分隔线色 = 主题 dividerColor(与官方抽屉头部线同值)。
// NDrawer 不定义 --n-divider-color,行又是库自己的元素,所以颜色必须由 useThemeVars() 经 :style 写入,明暗各自跟随。
import { afterEach, describe, expect, it } from 'vitest'
import { h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { NConfigProvider, darkTheme, lightTheme } from 'naive-ui'
import SortDrawer from '../src/SortDrawer.vue'
import sortDrawerSource from '../src/SortDrawer.vue?raw'
import { defaultLabels } from '../src/labels'

const rows = [
  { key: 'a', title: 'A' },
  { key: 'b', title: 'B' },
  { key: 'c', title: 'C' },
]

const mounted: Array<ReturnType<typeof mount>> = []
afterEach(() => {
  while (mounted.length) mounted.pop()!.unmount()
  document.body.innerHTML = ''
})

async function openIn(theme: typeof darkTheme | null) {
  const w = mount(
    {
      render: () =>
        h(NConfigProvider, { theme }, () =>
          h(SortDrawer as never, {
            show: true,
            rows,
            current: [],
            labels: defaultLabels,
            next: (cur: unknown[]) => cur,
          }),
        ),
    },
    { attachTo: document.body },
  )
  mounted.push(w)
  await flushPromises()
  return [...document.body.querySelectorAll<HTMLElement>('.smart-table-sort-row')]
}

describe('SortDrawer 行间分隔线色', () => {
  it('亮色:第 2 行起的上边线 = 亮色主题 dividerColor,第 1 行不画', async () => {
    const els = await openIn(lightTheme)
    expect(els).toHaveLength(3)
    expect(els[0].style.borderTopColor).toBe('')
    for (const el of els.slice(1)) {
      expect(el.style.borderTopColor).toBe('rgb(239, 239, 245)')
      expect(lightTheme.common.dividerColor).toBe('rgb(239, 239, 245)')
    }
  })

  it('暗色:跟随暗色主题的 dividerColor,与亮色不同', async () => {
    const els = await openIn(darkTheme)
    expect(els[0].style.borderTopColor).toBe('')
    expect(els[1].style.borderTopColor).toBe('rgba(255, 255, 255, 0.09)')
    expect(darkTheme.common.dividerColor).toBe('rgba(255, 255, 255, 0.09)')
  })

  it('样式表不用 NDrawer 取不到的 var(--n-divider-color),也没有写死的灰', () => {
    expect(sortDrawerSource).not.toContain('var(--n-divider-color')
    expect(sortDrawerSource).not.toContain('rgba(128, 128, 128')
  })
})
