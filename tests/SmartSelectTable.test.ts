// @vitest-environment jsdom
// 独立组件 SmartSelectTable(下拉表格选择):触发器像 NSelect,点开是浮层 = 一个搜索框 + 嵌套 SmartTable(分页)。
// 可单独用在表单里(v-model:value),不依赖可编辑表格。
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// jsdom 没有布局:面板里的表格是 fillHeight(vueuc VirtualList),它靠 ResizeObserver 拿视口高度才知道渲染哪几行。
// 在 vueuc 模块加载前(它的观察器是单例)桩一个:任何被观察的元素都回报 800 × 360。
vi.hoisted(() => {
  class RO {
    constructor(private cb: (entries: unknown[]) => void) {}
    observe(el: Element) {
      const rect = { width: 800, height: 360 }
      queueMicrotask(() =>
        this.cb([
          { target: el, contentRect: rect, borderBoxSize: [{ blockSize: 360, inlineSize: 800 }] },
        ]),
      )
    }
    unobserve() {}
    disconnect() {}
  }
  ;(window as unknown as { ResizeObserver: unknown }).ResizeObserver = RO
})
import { nextTick } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import SmartSelectTable from '../src/SmartSelectTable.vue'
import { matchKeyword, normalizeText } from '../src/selectTable'
import { zhCNLabels } from '../src/labels'
import type { SmartTableColumn } from '../src/types'

interface Mat {
  id: number
  code: string
  name: string
  spec: string
  price: number
}
const MAT: Mat[] = Array.from({ length: 25 }, (_, i) => ({
  id: i + 1,
  code: `M8-${String(i + 1).padStart(3, '0')}`,
  name: i === 2 ? '六角螺栓' : `零件${i + 1}`,
  spec: `GB/T ${5780 + i}`,
  price: 10 + i,
}))
const cols: SmartTableColumn<Mat>[] = [
  { key: 'code', title: '物料编号' },
  { key: 'name', title: '物料名称' },
  { key: 'spec', title: '规格' },
]

beforeAll(() => {
  Element.prototype.scrollTo ??= () => {}
  Element.prototype.scrollIntoView ??= () => {}
})
// 面板里的表格是 fillHeight(官方 virtual-scroll):vueuc 的 VirtualList 在 setup 里读 window.matchMedia,jsdom 没有
beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
})
let wrapper: VueWrapper<any> | null = null
function mountSel(props: Record<string, unknown> = {}): VueWrapper<any> {
  const w: VueWrapper<any> = mount(SmartSelectTable, {
    props: {
      columns: cols,
      data: MAT,
      labelKey: 'name',
      labels: zhCNLabels,
      pageSize: 10,
      pageSizes: [10, 50],
      value: null,
      'onUpdate:value': (v: unknown) => void w.setProps({ value: v }),
      ...props,
    },
    attachTo: document.body,
  })
  wrapper = w
  return w
}
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
const settle = async () => {
  for (let i = 0; i < 4; i++) await flushPromises()
}
const panel = () => document.body.querySelector<HTMLElement>('.smart-table-xpick')
const pRows = () => [...(panel()?.querySelectorAll<HTMLElement>('.n-data-table-tbody tr') ?? [])]
const input = () => panel()!.querySelector<HTMLInputElement>('.smart-table-xpick-search input')!
const press = (key: string, target: Element, init: KeyboardEventInit = {}) =>
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }),
  )
const type = async (text: string) => {
  const el = input()
  el.value = text
  el.dispatchEvent(new Event('input', { bubbles: true }))
  await nextTick()
  await settle()
}
async function open(w: VueWrapper<any>) {
  await w.find('.smart-table-xpick-trigger').trigger('click')
  await settle()
}
const trigger = (w: VueWrapper<any>) => w.find('.smart-table-xpick-trigger')
const outside = () => {
  document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
  document.body.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
  document.body.click()
}

describe('matchKeyword / normalizeText', () => {
  it('NFKC + 小写 + trim', () => {
    expect(normalizeText('  ＡＢｃ１２－３ ')).toBe('abc12-3')
  })
  it('空白切词全部命中(AND),每个词可命中任一字段', () => {
    const r = { code: 'M8-001', name: '螺栓', spec: 'GB/T 5780' }
    expect(matchKeyword(r, ['code', 'name', 'spec'], 'M8 螺栓')).toBe(true)
    expect(matchKeyword(r, ['code', 'name', 'spec'], 'm8 螺母')).toBe(false)
    expect(matchKeyword(r, ['code', 'name', 'spec'], '  ')).toBe(true)
    expect(matchKeyword(r, ['name'], 'm8')).toBe(false) // 只搜 name
  })
  it('数字字段也参与;其它类型不参与', () => {
    expect(matchKeyword({ n: 5780, o: { a: 1 } }, ['n', 'o'], '578')).toBe(true)
    expect(matchKeyword({ o: { a: 1 } }, ['o'], 'object')).toBe(false)
  })
})

describe('触发器与单选', () => {
  it('v-model:value:点一行 = 选中并关闭,触发器显示 labelKey 的值,发 update:value 与 pick', async () => {
    const onPick = vi.fn()
    const w = mountSel({ onPick })
    expect(trigger(w).text()).toContain('请选择')
    await open(w)
    expect(panel()).not.toBeNull()
    expect(pRows()).toHaveLength(10)
    pRows()[2].click()
    await settle()
    expect(panel()).toBeNull()
    expect(w.props('value')).toBe(3)
    expect(onPick.mock.calls[0][0]).toMatchObject({ code: 'M8-003' })
    expect(trigger(w).text()).toContain('六角螺栓')
  })

  it('valueKey 默认 id;labelKey 默认第一列;renderLabel 优先', async () => {
    const w = mountSel({ labelKey: undefined, value: 3 })
    expect(trigger(w).text()).toContain('M8-003')
    await w.setProps({ renderLabel: (r: Mat) => `${r.code} · ${r.name}` })
    expect(trigger(w).text()).toContain('M8-003 · 六角螺栓')
  })

  it('placeholder;label 给远程初始值的显示文字', async () => {
    const w = mountSel({ placeholder: '选物料' })
    expect(trigger(w).text()).toContain('选物料')
    await w.setProps({
      data: undefined,
      fetcher: async () => ({ items: [], total: 0 }),
      value: 99,
      label: '远程物料',
    })
    expect(trigger(w).text()).toContain('远程物料')
  })

  it('clearable:清除 → update:value(null)', async () => {
    const w = mountSel({ clearable: true, value: 3 })
    await w.find('.n-base-selection').trigger('mouseenter')
    await settle()
    const clear = w.find('.n-base-clear__clear')
    expect(clear.exists()).toBe(true)
    await clear.trigger('click')
    await settle()
    expect(w.props('value')).toBeNull()
    expect(panel()).toBeNull()
  })

  it('disabled:点了不开', async () => {
    const w = mountSel({ disabled: true })
    await open(w)
    expect(panel()).toBeNull()
  })

  it('再次打开时已选中的行高亮', async () => {
    const w = mountSel({ value: 3 })
    await open(w)
    const hit = pRows().filter((r) => r.classList.contains('smart-table-row--active'))
    expect(hit).toHaveLength(1)
    expect(hit[0].textContent).toContain('M8-003')
  })

  it('点面板外面 = 关闭,值不变', async () => {
    const w = mountSel({ value: 3 })
    await open(w)
    outside()
    await settle()
    expect(panel()).toBeNull()
    expect(w.props('value')).toBe(3)
  })

  it('面板顶部只有一个搜索框:没有「搜索」「清空搜索」按钮', async () => {
    const w = mountSel()
    await open(w)
    const names = [...panel()!.querySelectorAll('button')].map((b) => b.textContent?.trim())
    expect(names).not.toContain('Search')
    expect(names).not.toContain('搜索')
    expect(names.join('')).not.toContain('清空搜索')
    expect(panel()!.querySelectorAll('.smart-table-xpick-search input')).toHaveLength(1)
    expect(document.activeElement).toBe(input())
  })
})

describe('面板外观结构:气泡 + 尖角 + 内边距 + 表格盒', () => {
  it('气泡有尖角(show-arrow)、内边距 8px(主题变量 --n-padding)', async () => {
    const w = mountSel()
    await open(w)
    const pop = document.body.querySelector<HTMLElement>('.smart-table-xpick-pop')!
    expect(pop).toBeTruthy()
    expect(pop.querySelector('.n-popover-arrow-wrapper')).not.toBeNull()
    expect(pop.style.getPropertyValue('--n-padding').trim()).toBe('8px')
  })

  it('内部依次是 搜索框 → 表格盒(.smart-table-xpick-body 里的表格外壳)→ 页脚;多选的底栏在最后', async () => {
    const w = mountSel({ multiple: true, value: [] })
    await open(w)
    const kids = [...panel()!.children].map((c) => c.className.split(' ')[0])
    expect(kids).toEqual([
      'smart-table-xpick-search',
      'smart-table-xpick-body',
      'smart-table-xpick-foot',
    ])
    expect(panel()!.querySelector('.smart-table-xpick-body .n-data-table-wrapper')).not.toBeNull()
    // 外框 / 圆角 / 格子线全是官方 NDataTable 的(线色在气泡里由官方 insidePopover 换成 popover 版本):面板根与表格根都不自己设线色 / 分隔线色 / 圆角变量
    const style = panel()!.getAttribute('style') ?? ''
    expect(style).not.toContain('--n-merged-border-color')
    expect(style).not.toContain('--smart-table-xpick-divider')
    expect(style).not.toContain('--smart-table-xpick-radius')
    const tableStyle =
      panel()!.querySelector<HTMLElement>('.n-data-table')!.getAttribute('style') ?? ''
    expect(tableStyle).not.toContain('--n-merged-border-color')
    // 页脚间距走官方主题变量 paginationMargin(8px,不写 CSS 覆盖)
    expect(tableStyle).toContain('--n-pagination-margin: 8px 0 0 0')
    // 嵌套表格卡片内边距走官方卡片主题变量(paddingSmall: 0),不写 CSS 覆盖 .n-card-content
    const cardStyle =
      panel()!.querySelector<HTMLElement>('.smart-table-card')!.getAttribute('style') ?? ''
    expect(cardStyle).toContain('--n-padding-left: 0')
  })

  it('内容宽 = panelWidth − 16(气泡内边距两侧),外宽仍是 panelWidth', async () => {
    const w = mountSel({ panelWidth: 600 })
    await open(w)
    expect(document.body.querySelector<HTMLElement>('.smart-table-xpick-wrap')!.style.width).toBe(
      '584px',
    )
  })

  it('视口放不下气泡(触发器左对齐、右对齐都会伸出视口)→ 改用底部面板,不让气泡被切掉', async () => {
    Object.defineProperty(document.documentElement, 'clientWidth', {
      configurable: true,
      get: () => 700,
    })
    const rect = vi
      .spyOn(Element.prototype, 'getBoundingClientRect')
      .mockReturnValue({ left: 191, right: 611, x: 191, y: 252, width: 420, height: 34 } as DOMRect)
    try {
      const w = mountSel()
      await open(w)
      expect(document.body.querySelector('.smart-table-xpick-pop')).toBeNull()
      expect(
        document.body.querySelector('.smart-table-xpick-sheet .smart-table-xpick'),
      ).not.toBeNull()
    } finally {
      rect.mockRestore()
      delete (document.documentElement as { clientWidth?: number }).clientWidth
    }
  })

  describe('纵向放不下 → 底部面板(气泡只会在触发器上 / 下两侧翻,没有夹取)', () => {
    // 触发器矩形 + 视口高;水平一律放得下(宽 1440、触发器左 100)
    async function openAt(
      viewportH: number,
      top: number,
      props: Record<string, unknown> = {},
    ): Promise<boolean> {
      Object.defineProperty(document.documentElement, 'clientWidth', {
        configurable: true,
        get: () => 1440,
      })
      Object.defineProperty(document.documentElement, 'clientHeight', {
        configurable: true,
        get: () => viewportH,
      })
      const rect = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
        left: 100,
        right: 520,
        x: 100,
        top,
        bottom: top + 34,
        y: top,
        width: 420,
        height: 34,
      } as DOMRect)
      try {
        const w = mountSel(props)
        await open(w)
        const bubble = document.body.querySelector('.smart-table-xpick-pop') !== null
        const sheet =
          document.body.querySelector('.smart-table-xpick-sheet .smart-table-xpick') !== null
        expect(bubble).not.toBe(sheet)
        w.unmount()
        wrapper = null
        document.body.innerHTML = ''
        return sheet
      } finally {
        rect.mockRestore()
        delete (document.documentElement as { clientWidth?: number }).clientWidth
        delete (document.documentElement as { clientHeight?: number }).clientHeight
      }
    }

    it('上、下两侧都放不下整个面板(视口 600、触发器在中间)→ 底部面板', async () => {
      expect(await openAt(600, 300)).toBe(true)
    })
    it('视口很矮(420)→ 底部面板', async () => {
      expect(await openAt(420, 300)).toBe(true)
    })
    it('下方放得下(视口 900、触发器靠上)→ 向下的气泡', async () => {
      expect(await openAt(900, 300)).toBe(false)
    })
    it('下方放不下、上方放得下(视口 900、触发器靠下,气泡翻到上方)→ 仍是气泡', async () => {
      expect(await openAt(900, 680)).toBe(false)
    })
    it('多选多一行页脚:单选刚好放得下的位置,多选放不下 → 底部面板', async () => {
      // 单选需要 454 + 10 + 8 = 472,多选 508;下方可用 = 视口 − 触发器底
      expect(await openAt(520, 10)).toBe(false) // 520 − 44 = 476 ≥ 472
      expect(await openAt(520, 10, { multiple: true, value: [] })).toBe(true) // 476 < 508
    })
  })

  it('窄屏底部面板:同样的内部结构,没有气泡(无尖角)', async () => {
    Object.defineProperty(document.documentElement, 'clientWidth', {
      configurable: true,
      get: () => 400,
    })
    try {
      const w = mountSel()
      await open(w)
      expect(document.body.querySelector('.smart-table-xpick-pop')).toBeNull()
      expect(document.body.querySelector('.n-popover-arrow-wrapper')).toBeNull()
      const sheet = document.body.querySelector('.smart-table-xpick-sheet')!
      expect(sheet.querySelector('.smart-table-xpick > .smart-table-xpick-search')).not.toBeNull()
      expect(sheet.querySelector('.smart-table-xpick > .smart-table-xpick-body')).not.toBeNull()
    } finally {
      delete (document.documentElement as { clientWidth?: number }).clientWidth
    }
  })
})

describe('搜索(本地实时模糊)', () => {
  it('占位符 = 搜索列的标题用 / 连接;可用 searchPlaceholder 覆盖', async () => {
    const w = mountSel()
    await open(w)
    expect(input().placeholder).toBe('物料编号/物料名称/规格')
    await w.setProps({ searchPlaceholder: '编号/名称' })
    w.unmount()
    wrapper = null
    document.body.innerHTML = ''
    const w2 = mountSel({ searchPlaceholder: '编号/名称' })
    await open(w2)
    expect(input().placeholder).toBe('编号/名称')
  })

  it('默认搜索列:跳过 selection / index / 自定义 render 的列;searchKeys 可限定', async () => {
    const columns: SmartTableColumn<Mat>[] = [
      { type: 'index' } as SmartTableColumn<Mat>,
      { key: 'code', title: '编号' },
      { key: 'name', title: '名称', render: (r: Mat) => `<<${r.name}>>` },
      { key: 'spec', title: '规格' },
    ]
    const w = mountSel({ columns })
    await open(w)
    expect(input().placeholder).toBe('编号/规格')
    await type('六角') // name 的列有 render:不搜
    expect(pRows()).toHaveLength(0)
    await type('5782') // spec
    expect(pRows()).toHaveLength(1)
  })

  it('任意字段的片段都能找到:编号 / 名称 / 规格', async () => {
    const w = mountSel()
    await open(w)
    await type('M8-003')
    expect(pRows()).toHaveLength(1)
    await type('六角')
    expect(pRows()).toHaveLength(1)
    await type('5782')
    expect(pRows()).toHaveLength(1) // 规格 GB/T 5782
  })

  it('多个词 AND:每个词可命中不同字段', async () => {
    const w = mountSel()
    await open(w)
    await type('m8 螺栓')
    expect(pRows()).toHaveLength(1)
    await type('m8 螺母')
    expect(pRows()).toHaveLength(0)
    expect(panel()!.textContent).toContain('共 0 条')
  })

  it('忽略大小写、全角半角、首尾空白', async () => {
    const w = mountSel()
    await open(w)
    await type('  ｍ８－００３ ')
    expect(pRows()).toHaveLength(1)
    expect(pRows()[0].textContent).toContain('M8-003')
  })

  it('实时过滤(不用按钮),并回到第 1 页', async () => {
    const w = mountSel()
    await open(w)
    const next = panel()!.querySelectorAll<HTMLElement>('.n-pagination .n-pagination-item')
    next[next.length - 1].click()
    await settle()
    expect(pRows()[0].textContent).toContain('M8-011')
    await type('零件')
    expect(pRows()[0].textContent).toContain('零件1')
    expect(pRows()[0].textContent).toContain('M8-001')
    expect(panel()!.textContent).toContain('共 24 条')
  })

  it('搜索框非空时有清除 ×', async () => {
    const w = mountSel()
    await open(w)
    await type('零件')
    expect(panel()!.querySelector('.n-input__clear, .n-base-clear')).not.toBeNull()
  })
})

describe('键盘', () => {
  it('Esc:搜索框有字先清空(面板还在),再按一次关闭', async () => {
    const w = mountSel({ value: 3 })
    await open(w)
    await type('零件')
    press('Escape', input())
    await settle()
    expect(panel()).not.toBeNull()
    expect(input().value).toBe('')
    expect(pRows()).toHaveLength(10)
    press('Escape', input())
    await settle()
    expect(panel()).toBeNull()
    expect(w.props('value')).toBe(3)
  })

  it('↓ 进入表格,↑↓ 移动高亮,Enter 选中', async () => {
    const w = mountSel()
    await open(w)
    press('ArrowDown', input())
    await settle()
    expect(pRows()[0].classList.contains('smart-table-xpick-hi')).toBe(true)
    press('ArrowDown', panel()!)
    press('ArrowDown', panel()!)
    press('ArrowUp', panel()!)
    await settle()
    expect(pRows()[1].classList.contains('smart-table-xpick-hi')).toBe(true)
    press('Enter', panel()!)
    await settle()
    expect(w.props('value')).toBe(2)
    expect(panel()).toBeNull()
  })

  it('单选:↓ 高亮后焦点仍在搜索框,Enter(在搜索框里)选高亮行', async () => {
    const w = mountSel()
    await open(w)
    press('ArrowDown', input())
    press('ArrowDown', input())
    await settle()
    expect(document.activeElement).toBe(input())
    expect(pRows()[1].classList.contains('smart-table-xpick-hi')).toBe(true)
    press('Enter', input())
    await settle()
    expect(w.props('value')).toBe(2)
  })

  it('搜索框里只剩一行时 Enter 直接选它;多行时 Enter 不选', async () => {
    const w = mountSel()
    await open(w)
    await type('零件')
    press('Enter', input())
    await settle()
    expect(panel()).not.toBeNull()
    await type('M8-003')
    press('Enter', input())
    await settle()
    expect(w.props('value')).toBe(3)
    expect(panel()).toBeNull()
  })
})

describe('远程 fetcher', () => {
  const make = () =>
    vi.fn(async (p: { page: number; pageSize: number; keyword?: string }) => {
      const all = MAT.filter((m) => !p.keyword || `${m.code}${m.name}`.includes(p.keyword))
      return { items: all.slice((p.page - 1) * p.pageSize, p.page * p.pageSize), total: all.length }
    })

  it('打开请求第 1 页;keyword 原样带上;总数取 total', async () => {
    const fetcher = make()
    const w = mountSel({ data: undefined, fetcher })
    await open(w)
    expect(fetcher.mock.calls[0][0]).toMatchObject({ page: 1, pageSize: 10 })
    expect(panel()!.textContent).toContain('共 25 条')
    await type('六角')
    await new Promise((r) => setTimeout(r, 350)) // 300ms 停手后才发
    await settle()
    expect(fetcher.mock.calls.at(-1)![0]).toMatchObject({ page: 1, keyword: '六角' })
    expect(pRows()).toHaveLength(1)
    pRows()[0].click()
    await settle()
    expect(w.props('value')).toBe(3)
    expect(trigger(w).text()).toContain('六角螺栓')
  })

  it('停手 300ms 才发请求;Enter 立即发', async () => {
    const fetcher = make()
    const w = mountSel({ data: undefined, fetcher })
    await open(w)
    const n = fetcher.mock.calls.length
    await type('六')
    expect(fetcher.mock.calls.length).toBe(n)
    press('Enter', input())
    await settle()
    expect(fetcher.mock.calls.length).toBe(n + 1)
    expect(fetcher.mock.calls.at(-1)![0]).toMatchObject({ keyword: '六' })
  })
})

describe('多选 multiple', () => {
  const chips = (w: VueWrapper<any>) => w.findAll('.n-base-selection-tag-wrapper')
  const checks = () =>
    [...panel()!.querySelectorAll<HTMLElement>('.n-data-table-tbody .n-checkbox')].map((c) =>
      c.classList.contains('n-checkbox--checked'),
    )

  it('勾选列;点行也切换;确定才提交(update:value 是数组,pick 是行数组)', async () => {
    const onPick = vi.fn()
    const w = mountSel({ multiple: true, value: [], onPick })
    await open(w)
    expect(panel()!.querySelectorAll('thead th')).toHaveLength(4) // 勾选 + 3 列
    pRows()[0].click()
    pRows()[2].click()
    await settle()
    expect(checks().slice(0, 3)).toEqual([true, false, true])
    expect(panel()!.textContent).toContain('已选 2 项')
    expect(w.props('value')).toEqual([]) // 还没确定
    const ok = [...panel()!.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === '确定',
    )!
    ok.click()
    await settle()
    expect(panel()).toBeNull()
    expect(w.props('value')).toEqual([1, 3])
    expect((onPick.mock.calls[0][0] as Mat[]).map((r) => r.id)).toEqual([1, 3])
  })

  it('跨页、跨搜索保留已选;标签显示名称', async () => {
    const w = mountSel({ multiple: true, value: [] })
    await open(w)
    pRows()[0].click()
    const next = panel()!.querySelectorAll<HTMLElement>('.n-pagination .n-pagination-item')
    next[next.length - 1].click()
    await settle()
    pRows()[0].click() // M8-011
    await type('六角')
    pRows()[0].click() // M8-003
    await settle()
    expect(panel()!.textContent).toContain('已选 3 项')
    await type('')
    const ok = [...panel()!.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === '确定',
    )!
    ok.click()
    await settle()
    expect(w.props('value')).toEqual([1, 11, 3])
  })

  it('maxTagCount 默认 2,其余折成 +N', async () => {
    const w = mountSel({ multiple: true, value: [1, 2, 3, 4] })
    await settle()
    expect(trigger(w).text()).toContain('零件1')
    expect(trigger(w).text()).toContain('零件2')
    expect(trigger(w).text()).not.toContain('零件3')
    expect(trigger(w).text()).toContain('+2')
    await w.setProps({ maxTagCount: 3 })
    expect(trigger(w).text()).toContain('+1')
  })

  it('面板打开时已选项是勾上的;「清空」清掉勾选再确定 = 空数组', async () => {
    const w = mountSel({ multiple: true, value: [1, 2] })
    await open(w)
    expect(checks().slice(0, 3)).toEqual([true, true, false])
    const clear = [...panel()!.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === '清空',
    )!
    clear.click()
    await settle()
    expect(panel()!.textContent).toContain('已选 0 项')
    const ok = [...panel()!.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === '确定',
    )!
    ok.click()
    await settle()
    expect(w.props('value')).toEqual([])
  })

  it('Esc / 点外面 = 放弃这次勾选', async () => {
    const w = mountSel({ multiple: true, value: [1] })
    await open(w)
    pRows()[1].click()
    await settle()
    press('Escape', panel()!)
    await settle()
    expect(panel()).toBeNull()
    expect(w.props('value')).toEqual([1])
  })

  it('键盘:↓ 高亮,Space 勾选,Enter 确定', async () => {
    const w = mountSel({ multiple: true, value: [] })
    await open(w)
    press('ArrowDown', input())
    press('ArrowDown', panel()!)
    press(' ', panel()!)
    press('Enter', panel()!)
    await settle()
    expect(w.props('value')).toEqual([2])
    expect(panel()).toBeNull()
  })

  it('触发器上点标签 × 直接去掉一项', async () => {
    const w = mountSel({ multiple: true, value: [1, 2] })
    await settle()
    await w.find('.n-base-selection-tag-wrapper .n-base-close').trigger('click')
    await settle()
    expect(w.props('value')).toEqual([2])
    expect(panel()).toBeNull()
  })

  it('远程多选:选过的行缓存在组件里,翻页后标签仍显示名称', async () => {
    const fetcher = vi.fn(async (p: { page: number; pageSize: number }) => ({
      items: MAT.slice((p.page - 1) * p.pageSize, p.page * p.pageSize),
      total: MAT.length,
    }))
    const w = mountSel({ multiple: true, value: [], data: undefined, fetcher })
    await open(w)
    pRows()[0].click()
    const next = panel()!.querySelectorAll<HTMLElement>('.n-pagination .n-pagination-item')
    next[next.length - 1].click()
    await settle()
    pRows()[0].click()
    ;[...panel()!.querySelectorAll('button')].find((b) => b.textContent?.trim() === '确定')!.click()
    await settle()
    expect(w.props('value')).toEqual([1, 11])
    expect(chips(w)).toHaveLength(2)
    expect(trigger(w).text()).toContain('零件1')
    expect(trigger(w).text()).toContain('零件11')
  })
})

describe('每页条数与虚拟滚动', () => {
  const BIG: Mat[] = Array.from({ length: 1000 }, (_, i) => ({
    id: i + 1,
    code: `M8-${String(i + 1).padStart(4, '0')}`,
    name: `零件${i + 1}`,
    spec: `GB/T ${5000 + i}`,
    price: i,
  }))
  const bigProps = { data: BIG, pageSize: 1000, pageSizes: undefined }

  it('默认每页 100(可选 [100, 1000, 10000],库内置规则);远程 fetcher 拿到的 pageSize 也是 100', async () => {
    const fetcher = vi.fn(async (p: { page: number; pageSize: number }) => ({
      items: BIG.slice((p.page - 1) * p.pageSize, p.page * p.pageSize),
      total: BIG.length,
    }))
    const w = mountSel({ data: undefined, fetcher, pageSize: undefined, pageSizes: undefined })
    await open(w)
    expect(fetcher.mock.calls[0][0]).toMatchObject({ page: 1, pageSize: 100 })
    expect(panel()!.textContent).toContain('共 1000 条')
    expect(panel()!.querySelector('.n-pagination-size-picker, .n-base-selection')).not.toBeNull() // 每页条数下拉
  })

  it('1000 行一页:只渲染可见的几行(虚拟滚动,默认开启)', async () => {
    const w = mountSel(bigProps)
    await open(w)
    expect(panel()!.textContent).toContain('共 1000 条')
    expect(pRows().length).toBeGreaterThan(5)
    expect(pRows().length).toBeLessThan(40)
  })

  it('键盘 ↓ 走到窗口之外的行(第 501 行),Enter 照样选中它', async () => {
    const w = mountSel(bigProps)
    await open(w)
    press('ArrowDown', input())
    for (let i = 0; i < 500; i++) press('ArrowDown', panel()!)
    await settle()
    press('Enter', panel()!)
    await settle()
    expect(w.props('value')).toBe(501)
    expect(trigger(w).text()).toContain('零件501')
  })

  it('多选:Space 勾上窗口之外的行,确定后在值里;已勾的窗口外行不丢', async () => {
    const w = mountSel({ ...bigProps, multiple: true, value: [900] })
    await open(w)
    press('ArrowDown', input())
    for (let i = 0; i < 299; i++) press('ArrowDown', panel()!)
    press(' ', panel()!)
    await settle()
    expect(panel()!.textContent).toContain('已选 2 项')
    press('Enter', panel()!)
    await settle()
    expect(w.props('value')).toEqual([900, 300])
  })

  it('本地数据 + 单选:再次打开时翻到已选行所在的页(第 300 行在第 3 页)', async () => {
    const w = mountSel({ data: BIG, pageSize: 100, pageSizes: undefined, value: 300 })
    await open(w)
    await settle()
    expect(pRows()[0].textContent).toContain('M8-0201')
  })
})
