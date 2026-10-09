// @vitest-environment jsdom
// 树列(tree: true)配 ellipsis 时,省略号盒子的 max-width: 100% 不扣前面的缩进 + 展开箭头,盒子比单元格内容区宽:
// 单元格不换行时「…」画出右边界,会换行时箭头与文字被拆成两行(issue #10)。
// 官方在 data-table 样式里本来有 calc(100% - var(--indent-offset) * 16px - 24px) 的补偿,但它只挂在布尔形式的
// .n-data-table-td__ellipsis 上,且 2.45.x 里 --indent-offset 写不进 DOM(Body.mjs 的子节点惰性求值,晚于 style 规范化)。
// jsdom 不做布局,量不出越界;真实几何由浏览器实测。这里锁住规则本身,以及宿主自定义 indent 能透传到根变量。
import { afterEach, describe, expect, it } from 'vitest'
import { h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import SmartTable from '../src/SmartTable.vue'
import source from '../src/SmartTable.vue?raw'

const style = source
  .slice(source.indexOf('<style'))
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\s+/g, ' ')
const rules = [...style.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
  selector: m[1].trim().replace(/\s*([(),>])\s*/g, '$1'),
  body: m[2].trim(),
}))

const LEVEL = '--smart-table-tree-level'
const INDENT = '--smart-table-indent'
const MAX_LEVEL = 10

describe('树列省略号:按缩进层数扣宽(issue #10)', () => {
  it(`第 1..${MAX_LEVEL} 层的单元格各写一次层级变量,按层数升序(后写的层数大,同优先级下盖过前面的)`, () => {
    const found = rules
      .filter((r) => r.body.includes(LEVEL))
      .map((r) => ({
        n: Number(
          r.selector.match(
            /^\.smart-table :deep\(\.n-data-table-td:has\(>\.n-data-table-indent:nth-child\((\d+)\)\)\)$/,
          )?.[1],
        ),
        body: r.body,
      }))
      .filter((r) => !Number.isNaN(r.n))
    expect(found.map((r) => r.n)).toEqual(Array.from({ length: MAX_LEVEL }, (_, i) => i + 1))
    for (const r of found) expect(r.body).toBe(`${LEVEL}: ${r.n};`)
  })

  it('树单元格(直接子节点里有展开箭头或叶子占位)里的两种省略号盒子都按「24px + 层数 × 缩进」扣宽', () => {
    const rule = rules.find(
      (r) =>
        r.selector.includes('.n-data-table-expand-trigger') &&
        r.selector.includes('.n-data-table-expand-placeholder') &&
        r.selector.includes('.n-ellipsis') &&
        r.selector.includes('.n-data-table-td__ellipsis'),
    )
    expect(rule).toBeDefined()
    // 只作用于单元格的直接子节点(省略号盒子紧跟在缩进 / 箭头后面),不碰单元格里更深的元素
    expect(rule!.selector).toMatch(/>:is\(/)
    expect(rule!.body.replace(/\s+/g, '')).toBe(
      `max-width:calc(100%-24px-var(${LEVEL},0)*var(${INDENT},16px));`,
    )
  })

  it('第 0 层(根节点)的树单元格没有缩进 div,层级变量取默认 0,只扣箭头 24px', () => {
    // 层级变量只在有缩进 div 时才写;读取处的 var(..., 0) 兜底 0 层
    expect(style).toContain(`var(${LEVEL}, 0)`)
  })
})

describe('自定义 indent 透传到根变量', () => {
  const mounted: Array<ReturnType<typeof mount>> = []
  afterEach(() => {
    while (mounted.length) mounted.pop()!.unmount()
  })

  async function rootOf(extra: Record<string, unknown>) {
    const w = mount(
      {
        render: () =>
          h(SmartTable as never, {
            columns: [{ key: 'name', title: 'Name', tree: true, ellipsis: { tooltip: true } }],
            data: [{ id: 1, name: 'a', children: [{ id: 2, name: 'b' }] }],
            rowKey: 'id',
            ...extra,
          }),
      },
      { attachTo: document.body },
    )
    mounted.push(w)
    await flushPromises()
    return w.element.matches('.smart-table')
      ? (w.element as HTMLElement)
      : (w.element.querySelector('.smart-table') as HTMLElement)
  }

  it('宿主给 NDataTable 的 indent(数字)写成根上的 --smart-table-indent', async () => {
    const root = await rootOf({ indent: 24 })
    expect(root.style.getPropertyValue(INDENT)).toBe('24px')
  })

  it('没传 indent 时不写这个变量(CSS 里用官方默认 16px 兜底)', async () => {
    const root = await rootOf({})
    expect(root.style.getPropertyValue(INDENT)).toBe('')
  })
})
