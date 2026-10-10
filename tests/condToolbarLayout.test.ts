// @vitest-environment jsdom
// 条件搜索栏(search.container: 'table')所在工具栏的宽 / 中档布局(issue #14):
// 此前宽档是两列等分(条件栏只占半列,头部有内容时再被分走一块)、中档写死两行(宽度够也不并排);空的头部元素还多占一份 12px 间距。
// jsdom 不做布局,量不出像素;真实几何由浏览器实测(多个容器宽 × 头部有无 × 明暗)。
// 这里锁住规则本身(读 SFC 源码里 scoped 样式的文本),以及规则所依赖的 DOM 事实:空头部是 :empty,三档的根类名。
import { afterEach, describe, expect, it } from 'vitest'
import { h } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import Toolbar from '../src/Toolbar.vue'
import toolbarSource from '../src/Toolbar.vue?raw'
import conditionBarSource from '../src/ConditionBar.vue?raw'
import { defaultLabels } from '../src/labels'
import { ruleFor, rulesOf } from './sfcStyle'

/**
 * 浏览器口径的 :empty:没有元素子节点、没有非空文本节点(注释不算,长度 0 的文本节点不算)。
 * Vue 渲染插槽片段会在两端放长度 0 的文本节点当锚点;Blink / WebKit / Gecko 不把它们当内容,
 * jsdom 的 :empty 却会,所以不能直接用 element.matches(':empty')。
 */
function matchesEmpty(el: Element): boolean {
  return [...el.childNodes].every(
    (n) => n.nodeType === 8 || (n.nodeType === 3 && (n.nodeValue ?? '') === ''),
  )
}

const toolbarRules = rulesOf(toolbarSource)

const COND = '.smart-table-toolbar--cond'
const MID = `${COND}.smart-table-toolbar--mid`
const WIDE = `${COND}.smart-table-toolbar--wide`
const NARROW = `${COND}.smart-table-toolbar--narrow`

describe('条件栏工具栏:宽 / 中档同一套 flex 换行布局(issue #14)', () => {
  it('宽档与中档一起声明 row + wrap-reverse(放不下时后换出来的那一行放到上面,保持「操作区在上、条件栏在下」)', () => {
    const body = ruleFor(toolbarRules, MID, WIDE)
    expect(body).toMatch(/flex-flow:\s*row wrap-reverse/)
    expect(body).toMatch(/gap:\s*10px 12px/)
  })

  it('宽档不再是两列等分的 grid;中档不再是写死两行的 grid(grid 只剩窄档)', () => {
    for (const r of toolbarRules) {
      const touchesWideOrMid = r.selectors.some((s) => s.startsWith(WIDE) || s.startsWith(MID))
      if (touchesWideOrMid) {
        expect(r.body).not.toMatch(/display:\s*grid/)
        expect(r.body).not.toMatch(/grid-template/)
      }
    }
    // 窄档的两行 grid(head right / cond cond)原样保留
    const narrow = ruleFor(toolbarRules, NARROW)
    expect(narrow).toMatch(/display:\s*grid/)
    expect(narrow).toMatch(/grid-template-areas:\s*'head right' 'cond cond'/)
  })

  it('宽 / 中 / 窄档里 main 都退场(display: contents),head / cond / right 直接是工具栏的子项', () => {
    expect(ruleFor(toolbarRules, '.smart-table-toolbar-main--cond')).toMatch(/display:\s*contents/)
  })

  it('条件栏以「值输入框至少 200px」为基准宽并吃掉剩余宽度:flex: 1 1 <基准>,且允许收缩到比基准窄(min-width: 0)', () => {
    const sel = (t: string) => `.smart-table-toolbar--${t} .smart-table-toolbar-cond`
    expect(ruleFor(toolbarRules, sel('mid'), sel('wide'))).toMatch(/flex:\s*1 1 \d+px/)
    // flex 子项的 min-width 默认是 auto(内容宽):不清零的话,比基准窄的行里它收缩不动,会横向溢出
    expect(ruleFor(toolbarRules, '.smart-table-toolbar-cond')).toMatch(/min-width:\s*0/)
  })

  it('基准宽 ≥ 条件栏里值输入框以外的部分 + 200px(中 / 英文默认文案都成立)', () => {
    const body = ruleFor(
      toolbarRules,
      '.smart-table-toolbar--mid .smart-table-toolbar-cond',
      '.smart-table-toolbar--wide .smart-table-toolbar-cond',
    )
    const basis = Number(body.match(/flex:\s*1 1 (\d+)px/)?.[1])
    // 值输入框以外的宽度:常量取自 ConditionBar 的样式,其余是真实浏览器(Edge,naive-ui 2.45.3,默认主题)实测
    const px = (re: RegExp) => Number(conditionBarSource.match(re)?.[1])
    const field = px(/\.smart-table-cond__field \{[^}]*?width: (\d+)px/)
    const action = px(
      /\.smart-table-cond__main :deep\(\.smart-table-filter-action\) \{[^}]*?width: (\d+)px/,
    )
    const gap = px(/\.smart-table-cond__main \{[^}]*?gap: (\d+)px/)
    const MORE = 28 // 「»」小号圆形图标按钮
    const BUTTONS_EN = 97 + 88 // 「Search」「Reset」(带图标)
    const BUTTONS_ZH = 80 + 80 // 「查询」「重置」(带图标)
    const items = 6 // 字段 · 比较符 · 值 · » · 搜索 · 重置 → 5 处间距
    const nonValue = (buttons: number) => field + action + MORE + buttons + gap * (items - 1)
    expect(field).toBe(136)
    expect(action).toBe(112)
    expect(gap).toBe(8)
    expect(nonValue(BUTTONS_ZH)).toBe(476)
    expect(nonValue(BUTTONS_EN)).toBe(501)
    expect(basis).toBeGreaterThanOrEqual(nonValue(BUTTONS_EN) + 200)
  })

  it('操作区靠右:margin-left: auto(单独换到上一行时也贴右缘)', () => {
    const sel = (t: string) => `.smart-table-toolbar--${t} .smart-table-toolbar-right`
    // 窄档的 grid-area 规则不能带 margin-left,所以宽 / 中档单独一条
    const body = ruleFor(toolbarRules, sel('mid'), sel('wide'))
    expect(body).toMatch(/margin-left:\s*auto/)
  })

  it('宽 / 中档里没有内容的头部不占位:.smart-table-toolbar-head:empty { display: none }(窄档不动)', () => {
    const sel = (t: string) => `.smart-table-toolbar--${t} .smart-table-toolbar-head:empty`
    expect(ruleFor(toolbarRules, sel('mid'), sel('wide'))).toMatch(/display:\s*none/)
    const narrowEmpty = toolbarRules.filter((r) =>
      r.selectors.some((s) => s.includes(':empty') && s.includes('narrow')),
    )
    expect(narrowEmpty).toEqual([])
  })

  it('窄档的 grid 区域与折叠变体原样保留', () => {
    expect(ruleFor(toolbarRules, '.smart-table-toolbar--narrow .smart-table-toolbar-head')).toMatch(
      /grid-area:\s*head/,
    )
    expect(ruleFor(toolbarRules, '.smart-table-toolbar--narrow .smart-table-toolbar-cond')).toMatch(
      /grid-area:\s*cond/,
    )
    expect(
      ruleFor(toolbarRules, '.smart-table-toolbar--narrow .smart-table-toolbar-right'),
    ).toMatch(/grid-area:\s*right/)
    expect(ruleFor(toolbarRules, `${NARROW}.smart-table-toolbar--fold`)).toMatch(
      /grid-template-areas:\s*'head ops icons' 'cond cond cond'/,
    )
  })
})

describe('规则依赖的 DOM 事实', () => {
  const mounted: VueWrapper[] = []
  afterEach(() => {
    while (mounted.length) mounted.pop()!.unmount()
  })

  const mountToolbar = (
    slots: Record<string, () => unknown>,
    props: Record<string, unknown> = {},
  ) => {
    const w = mount(Toolbar, {
      props: {
        labels: defaultLabels,
        config: {},
        density: 'compact' as const,
        tier: 'mid',
        ...props,
      },
      slots: { cond: () => h('div', 'cond'), ...slots } as never,
      attachTo: document.body,
    })
    mounted.push(w)
    return w
  }

  it('既没有标题也没有 #toolbar 内容时,头部元素存在但是 :empty(CSS 据此不占位)', () => {
    const head = mountToolbar({}).get('.smart-table-toolbar-head').element
    expect(matchesEmpty(head)).toBe(true)
  })

  it('#toolbar 插槽渲染成空(v-if 为假只留注释节点)时头部仍是 :empty', () => {
    const head = mountToolbar({ left: () => null }).get('.smart-table-toolbar-head').element
    expect(matchesEmpty(head)).toBe(true)
  })

  it('有标题或 #toolbar 内容时头部不是 :empty,照常排在条件栏前面', () => {
    const withTitle = mountToolbar({}, { title: '人员' }).get('.smart-table-toolbar-head').element
    expect(matchesEmpty(withTitle)).toBe(false)
    const withLeft = mountToolbar({ left: () => h('button', '机构' as never) }).get(
      '.smart-table-toolbar-head',
    ).element
    expect(matchesEmpty(withLeft)).toBe(false)
    expect(withLeft.nextElementSibling?.classList.contains('smart-table-toolbar-cond')).toBe(true)
  })

  it('三档都会给根元素加 --cond 与对应的 --mid / --wide / --narrow 类', () => {
    for (const tier of ['mid', 'wide', 'narrow']) {
      const root = mountToolbar({}, { tier }).element as HTMLElement
      expect(root.classList.contains('smart-table-toolbar--cond')).toBe(true)
      expect(root.classList.contains(`smart-table-toolbar--${tier}`)).toBe(true)
    }
  })
})
