// @vitest-environment jsdom
// activeRowKey 命中行的高亮色。宿主没给 activeRowBg 时取「当前主题主色 9%」(明暗各自跟随主题),
// 给了全局 activeRowBg 就照宿主的。库自己的元素上取不到 var(--n-*),所以用 useThemeVars() 的主色(与表头把手引导线同一做法)。
import { afterEach, describe, expect, it } from 'vitest'
import { h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { NConfigProvider, darkTheme, lightTheme } from 'naive-ui'
import SmartTable from '../src/SmartTable.vue'
import smartTableSource from '../src/SmartTable.vue?raw'
import { SMART_TABLE_DEFAULTS } from '../src/config'

const rows = [
  { id: 1, name: 'alice' },
  { id: 2, name: 'bob' },
]
const AUTO = '--smart-table-active-row-bg-auto'
const HOST = '--smart-table-active-row-bg'

const mounted: Array<ReturnType<typeof mount>> = []
afterEach(() => {
  while (mounted.length) mounted.pop()!.unmount()
})

async function mountIn(theme: typeof darkTheme | null, defaults?: Record<string, unknown>) {
  const w = mount(
    {
      render: () =>
        h(NConfigProvider, { theme }, () =>
          h(SmartTable as never, {
            columns: [{ key: 'name', title: 'Name' }],
            data: rows,
            rowKey: 'id',
            activeRowKey: 2,
          }),
        ),
    },
    {
      global: defaults ? { provide: { [SMART_TABLE_DEFAULTS as symbol]: defaults } } : undefined,
      attachTo: document.body,
    },
  )
  mounted.push(w)
  await flushPromises()
  const root = w.element.matches('.smart-table')
    ? (w.element as HTMLElement)
    : (w.element.querySelector('.smart-table') as HTMLElement)
  return { w, root }
}

describe('SmartTable 当前行高亮色(D1)', () => {
  it('命中行仍加 smart-table-row--active', async () => {
    const { w } = await mountIn(null)
    const trs = w.findAll('tbody tr')
    expect(trs[0].classes()).not.toContain('smart-table-row--active')
    expect(trs[1].classes()).toContain('smart-table-row--active')
  })

  it('亮色主题:默认取主题主色 9%(不再是写死的靛蓝 rgba(99,102,241,0.08))', async () => {
    const { root } = await mountIn(lightTheme)
    expect(root.style.getPropertyValue(AUTO)).toBe(
      `color-mix(in srgb, ${lightTheme.common.primaryColor} 9%, transparent)`,
    )
    expect(root.style.getPropertyValue(AUTO)).not.toContain('99, 102, 241')
    expect(root.style.getPropertyValue(HOST)).toBe('') // 没给 activeRowBg:不写宿主那一档变量
  })

  it('暗色主题:跟随暗色主题的主色,与亮色不同', async () => {
    const dark = await mountIn(darkTheme)
    const light = await mountIn(lightTheme)
    expect(dark.root.style.getPropertyValue(AUTO)).toBe(
      `color-mix(in srgb, ${darkTheme.common.primaryColor} 9%, transparent)`,
    )
    expect(dark.root.style.getPropertyValue(AUTO)).not.toBe(light.root.style.getPropertyValue(AUTO))
  })

  it('没有 NConfigProvider:取 naive 默认(亮色)主题主色', async () => {
    const w = mount(SmartTable, {
      props: {
        columns: [{ key: 'name', title: 'Name' }],
        data: rows,
        rowKey: 'id',
        activeRowKey: 1,
      },
      attachTo: document.body,
    })
    mounted.push(w)
    await flushPromises()
    expect((w.element as HTMLElement).style.getPropertyValue(AUTO)).toBe(
      `color-mix(in srgb, ${lightTheme.common.primaryColor} 9%, transparent)`,
    )
  })

  it('宿主给了全局 activeRowBg:写进 --smart-table-active-row-bg(CSS 里它压过自动值),明暗都一样', async () => {
    for (const theme of [lightTheme, darkTheme]) {
      const { root } = await mountIn(theme, { activeRowBg: 'rgba(255, 0, 0, 0.1)' })
      expect(root.style.getPropertyValue(HOST)).toBe('rgba(255, 0, 0, 0.1)')
    }
  })

  it('样式表:命中行的色优先取宿主变量(含祖先元素上写的 --smart-table-active-row-bg),其次才是自动值', () => {
    const src = smartTableSource
    expect(src).toContain(
      '.smart-table :deep(.smart-table-row--active > td) {\n  background-image: linear-gradient(\n    var(--smart-table-active-row-bg, var(--smart-table-active-row-bg-auto)),\n    var(--smart-table-active-row-bg, var(--smart-table-active-row-bg-auto))\n  );',
    )
    expect(src).not.toContain('99, 102, 241')
  })

  it('样式表:命中行只叠 background-image,不覆盖 background-color(固定列 td 的不透明底、hover / 斑马纹底色都保留)', () => {
    const m = /\.smart-table :deep\(\.smart-table-row--active > td\) \{([^}]*)\}/.exec(
      smartTableSource,
    )
    expect(m).not.toBeNull()
    expect(m![1]).not.toContain('background-color')
    expect(m![1]).toContain('background-image')
  })
})
