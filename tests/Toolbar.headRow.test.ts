// @vitest-environment jsdom
// 窄档折叠下 #toolbar 槽独占一行(issue #17,设计 2.16):
// 此前头部与「操作 ▾」、内置图标同在第一行,后两者是 auto 列先拿走宽度,头部只剩约 115px,放进去的范围控件被挤坏。
// jsdom 不做布局,量不出像素;真实几何由浏览器实测。这里锁住规则本身(读 SFC 源码里 scoped 样式的文本)
// 以及规则所依赖的 DOM 事实:什么时候给根节点加 --head-row 类。
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Toolbar from '../src/Toolbar.vue'
import toolbarSource from '../src/Toolbar.vue?raw'
import { defaultLabels } from '../src/labels'
import { ruleFor, rulesOf } from './sfcStyle'

const HEAD_ROW = 'smart-table-toolbar--head-row'

/** noRight:不传 #right(传空串也算传了槽,「操作」按钮仍会出现)。 */
function mountBar(opts: {
  props?: Record<string, unknown>
  slots?: Record<string, string>
  config?: unknown
  noRight?: boolean
}) {
  return mount(Toolbar, {
    props: {
      labels: defaultLabels,
      config: (opts.config ?? {}) as never,
      density: 'compact' as const,
      title: '物料单据',
      fold: true,
      tier: 'narrow' as const,
      ...opts.props,
    },
    slots: {
      ...(opts.noRight ? {} : { right: '<button class="host-add">新增</button>' }),
      ...opts.slots,
    },
  })
}

describe('窄档折叠:#toolbar 槽有内容时头部独占一行(--head-row)', () => {
  it('fold + 传了 #left(宿主的 #toolbar 槽)→ 根节点带 --head-row', () => {
    const w = mountBar({ slots: { left: '<span class="host-range">日期范围</span>' } })
    expect(w.find('.smart-table-toolbar').classes()).toContain(HEAD_ROW)
  })

  it('fold 但没传 #left(只有标题)→ 不带,保持单行「标题 | 操作 ▾ | 图标」', () => {
    const w = mountBar({})
    expect(w.find('.smart-table-toolbar').classes()).not.toContain(HEAD_ROW)
  })

  it('没有 fold(宽 / 中档,或没开 cardOnNarrow)→ 不带', () => {
    const w = mountBar({
      props: { fold: false, tier: 'wide' },
      slots: { left: '<span class="host-range">日期范围</span>' },
    })
    expect(w.find('.smart-table-toolbar').classes()).not.toContain(HEAD_ROW)
  })

  it('批量栏出现时 fold 不生效 → 不带', () => {
    const w = mountBar({
      props: { batch: { count: 2, checked: false, indeterminate: true } },
      slots: { left: '<span class="host-range">日期范围</span>' },
    })
    expect(w.find('.smart-table-toolbar').classes()).not.toContain(HEAD_ROW)
  })

  it('第二行没有任何东西可放(没有业务按钮、也没有内置图标)→ 不带,免得多出一行空行距', () => {
    const w = mountBar({
      config: false,
      noRight: true,
      props: { remote: false },
      slots: { left: '<span class="host-range">日期范围</span>' },
    })
    expect(w.find('.smart-table-toolbar-ops').exists()).toBe(false)
    expect(w.find('.smart-table-toolbar-icons').exists()).toBe(false)
    expect(w.find('.smart-table-toolbar').classes()).not.toContain(HEAD_ROW)
  })

  it('只有内置图标(没有业务按钮)也算第二行有内容 → 带', () => {
    const w = mountBar({
      noRight: true,
      slots: { left: '<span class="host-range">日期范围</span>' },
    })
    expect(w.find('.smart-table-toolbar-ops').exists()).toBe(false)
    expect(w.find('.smart-table-toolbar-icons').exists()).toBe(true)
    expect(w.find('.smart-table-toolbar').classes()).toContain(HEAD_ROW)
  })

  it('模式 2(#cond)同样带', () => {
    const w = mountBar({
      slots: {
        left: '<span class="host-range">日期范围</span>',
        cond: '<div class="host-cond" />',
      },
    })
    expect(w.find('.smart-table-toolbar').classes()).toContain(HEAD_ROW)
    expect(w.find('.smart-table-toolbar-head .host-range').exists()).toBe(true)
  })
})

const rules = rulesOf(toolbarSource)
const FOLD = '.smart-table-toolbar--fold'
const ROW = `${FOLD}.${HEAD_ROW}`
const OPEN = '.smart-table-toolbar--ops-open'
const COND_FOLD = `.smart-table-toolbar--cond.smart-table-toolbar--narrow${FOLD}.${HEAD_ROW}`

describe('窄档折叠 + --head-row 的网格(设计 2.16)', () => {
  it('行 1 = 头部通栏;行 2 = 「操作 ▾」靠左、内置图标靠右(中间一列 1fr 把它们推开)', () => {
    const body = ruleFor(rules, ROW)
    expect(body).toMatch(/grid-template-columns:\s*auto minmax\(0, 1fr\) auto/)
    expect(body).toMatch(/grid-template-areas:\s*'head head head' 'ops \. icons'/)
  })

  it('「操作」展开后,业务按钮行接在行 2 之下', () => {
    expect(ruleFor(rules, `${ROW}${OPEN}`)).toMatch(
      /grid-template-areas:\s*'head head head' 'ops \. icons' 'actions actions actions'/,
    )
  })

  it('模式 2:条件栏行在最下面;列模板要重声明(窄档 cond 的 fold 规则优先级更高,会盖回 1fr auto auto)', () => {
    const plain = ruleFor(rules, COND_FOLD)
    expect(plain).toMatch(/grid-template-columns:\s*auto minmax\(0, 1fr\) auto/)
    expect(plain).toMatch(/grid-template-areas:\s*'head head head' 'ops \. icons' 'cond cond cond'/)
    expect(ruleFor(rules, `${COND_FOLD}${OPEN}`)).toMatch(
      /grid-template-areas:\s*'head head head' 'ops \. icons' 'actions actions actions' 'cond cond cond'/,
    )
  })

  it('头部放不下就换行(flex-wrap),不再把宿主控件压成一格窄条;模式 1 的 main 与模式 2 的 head 都要', () => {
    const sel = [
      `.smart-table-toolbar--${'head-row'} > .smart-table-toolbar-main`,
      `.smart-table-toolbar--${'head-row'} .smart-table-toolbar-head`,
    ]
    expect(ruleFor(rules, ...sel)).toMatch(/flex-wrap:\s*wrap/)
  })

  it('没传 #toolbar 的默认折叠网格原样保留(单行 head ops icons)', () => {
    const body = ruleFor(rules, FOLD)
    expect(body).toMatch(/grid-template-columns:\s*minmax\(0, 1fr\) auto auto/)
    expect(body).toMatch(/grid-template-areas:\s*'head ops icons'/)
  })
})
