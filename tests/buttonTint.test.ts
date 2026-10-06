// @vitest-environment jsdom
// 淡色(secondary + type)按钮与行内文字按钮的字色加深(设计 §2.15 E):
// 官方 secondary 的底和字取同一个主色(Button.mjs:250-265),浅色下淡绿字对底只有 2.83 : 1;
// 库里这类按钮的字色(与跟着变的淡底)取当前主题的 primaryColorPressed / errorColorPressed,实心按钮不动。
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, type Component } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { NConfigProvider, NDataTable, darkTheme } from 'naive-ui'
import type { GlobalThemeOverrides } from 'naive-ui'
import Toolbar from '../src/Toolbar.vue'
import SearchForm from '../src/SearchForm.vue'
import ConditionBar from '../src/ConditionBar.vue'
import ConditionPanel from '../src/ConditionPanel.vue'
import { defaultLabels } from '../src/labels'
import { useButtonTint } from '../src/buttonTint'
import {
  deleteTrigger,
  detailAction,
  editAction,
  removeAction,
} from '../playground/prototype/modules/shared/btn'
import { blankRow } from '../src/conditionBuilder'
import type { FilterDef, SearchDef } from '../src/useColumns'

const mounted: VueWrapper[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()!.unmount()
  document.body.innerHTML = ''
})

// 官方默认主题(common/light.mjs、dark.mjs)
const LIGHT = { primary: '#18a058', primaryPressed: '#0c7a43', errorPressed: '#ab1f3f' }
const DARK = { primary: '#63e2b7', primaryPressed: '#5acea7', errorPressed: '#e57272' }

type Provider = { dark?: boolean; overrides?: GlobalThemeOverrides }
function mountIn(component: Component, props: Record<string, unknown>, p: Provider = {}) {
  const w = mount(
    () =>
      h(
        NConfigProvider,
        { theme: p.dark ? darkTheme : null, themeOverrides: p.overrides },
        { default: () => h(component, props) },
      ),
    { attachTo: document.body },
  )
  mounted.push(w)
  return w.element.parentElement as HTMLElement
}

const byText = (root: ParentNode, text: string) =>
  [...root.querySelectorAll<HTMLElement>('button')].find((b) => b.textContent?.trim() === text)!
// 官方按钮把解析好的颜色写在根元素的 --n-* 内联变量上
const textColor = (el: HTMLElement) => el.style.getPropertyValue('--n-text-color').toLowerCase()
const bgColor = (el: HTMLElement) => el.style.getPropertyValue('--n-color').replace(/\s/g, '')
const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

const edit = { count: 2, saving: false, add: true, remove: true, restore: true }
const toolbar = (p: Provider = {}) =>
  mountIn(Toolbar, { labels: defaultLabels, config: {}, density: 'compact', edit }, p)
const batchBar = (p: Provider = {}) =>
  mountIn(
    Toolbar,
    {
      labels: defaultLabels,
      config: {},
      density: 'compact',
      edit,
      batch: { count: 3, checked: true, indeterminate: false },
    },
    p,
  )

const conditionDef: FilterDef = {
  key: 'name',
  field: 'name',
  optionsKey: 'name',
  title: '名称',
  mode: 'condition',
  multiple: true,
  type: 'input',
  actions: ['contains'],
}
const searchDefs: SearchDef[] = [
  { key: 'name', label: '名称', type: 'input', optionsKey: 'name' } as SearchDef,
]
const searchForm = (extra: Record<string, unknown> = {}, p: Provider = {}) =>
  mountIn(
    SearchForm,
    {
      fields: searchDefs,
      params: {},
      labels: defaultLabels,
      getOptions: () => [],
      isLoadingOptions: () => false,
      ...extra,
    },
    p,
  )

describe('库内淡色按钮:字色 = 当前主题的 pressed 色,底随之同色相', () => {
  it('工具栏淡绿(新增行 / 保存修改)字色取 primaryColorPressed,不再是 primaryColor', () => {
    const root = toolbar()
    for (const text of ['Add row', 'Save changes (2)']) {
      const b = byText(root, text)
      expect(textColor(b)).toBe(LIGHT.primaryPressed)
      expect(bgColor(b)).toBe(rgba(LIGHT.primaryPressed, 0.16))
    }
  })

  it('批量栏淡红(删除所选)取 errorColorPressed;淡绿保存取 primaryColorPressed', () => {
    const root = batchBar()
    const del = byText(root, defaultLabels.editDeleteSelected)
    expect(textColor(del)).toBe(LIGHT.errorPressed)
    expect(bgColor(del)).toBe(rgba(LIGHT.errorPressed, 0.16))
    expect(textColor(byText(root, 'Save changes (2)'))).toBe(LIGHT.primaryPressed)
  })

  it('搜索卡 grid / inline 的「搜索」、条件构造器工具栏的「搜索」同样取 pressed 色', () => {
    expect(textColor(byText(searchForm(), defaultLabels.search))).toBe(LIGHT.primaryPressed)
    expect(
      textColor(byText(searchForm({ config: { layout: 'inline' } }), defaultLabels.search)),
    ).toBe(LIGHT.primaryPressed)
    const defs = [conditionDef]
    const bar = mountIn(ConditionBar, {
      fields: defs,
      draft: { rows: [blankRow(defs[0])], logic: {} },
      labels: defaultLabels,
      getOptions: () => [],
      isLoadingOptions: () => false,
      tier: 'wide',
    })
    expect(textColor(byText(bar, defaultLabels.search))).toBe(LIGHT.primaryPressed)
  })

  it('搜索卡「展开 / 收起」文字按钮取 primaryColorPressed', () => {
    const root = searchForm({ config: { collapsible: true } })
    expect(textColor(byText(root, defaultLabels.expand))).toBe(LIGHT.primaryPressed)
  })

  it('淡灰与实心按钮不动:放弃修改仍是中性淡灰;条件面板「确认」实心主色仍取 primaryColor', () => {
    const discard = byText(toolbar(), 'Discard changes')
    expect(bgColor(discard)).toBe('rgba(46,51,56,.05)')
    expect(textColor(discard)).not.toBe(LIGHT.primaryPressed)
    const defs = [conditionDef]
    const panel = mountIn(ConditionPanel, {
      fields: defs,
      draft: { rows: [blankRow(defs[0])], logic: {} },
      labels: defaultLabels,
      getOptions: () => [],
      isLoadingOptions: () => false,
      dateValueFormat: 'yyyy-MM-dd',
    })
    const ok = byText(panel, defaultLabels.filterConfirm)
    expect(bgColor(ok)).toBe(LIGHT.primary)
    expect(textColor(ok)).toBe('#fff')
  })
})

describe('明暗切换:暗色取暗色主题的 pressed 色', () => {
  it('暗色下淡绿 #5acea7、淡红 #e57272', () => {
    const root = toolbar({ dark: true })
    expect(textColor(byText(root, 'Add row'))).toBe(DARK.primaryPressed)
    expect(textColor(byText(batchBar({ dark: true }), defaultLabels.editDeleteSelected))).toBe(
      DARK.errorPressed,
    )
  })
})

describe('宿主自定义主题:跟随宿主给的 pressed 色,不写死 hex', () => {
  const overrides: GlobalThemeOverrides = {
    common: {
      primaryColor: '#2080f0',
      primaryColorPressed: '#1060c9',
      errorColor: '#ff0000',
      errorColorPressed: '#990000',
    },
  }
  it('宿主换了主色 / 错误色,淡色按钮字色取宿主的 pressed', () => {
    const root = toolbar({ overrides })
    expect(textColor(byText(root, 'Add row'))).toBe('#1060c9')
    expect(textColor(byText(batchBar({ overrides }), defaultLabels.editDeleteSelected))).toBe(
      '#990000',
    )
    expect(textColor(byText(searchForm({}, { overrides }), defaultLabels.search))).toBe('#1060c9')
  })
})

// 宿主写法:行内文字按钮(playground 的 btn.ts)与库内淡色按钮同一来源
describe('宿主行内文字按钮:编辑 / 详情 取 primary pressed,删除 / 移除 取 error pressed', () => {
  const noop = () => {}
  const Actions = defineComponent(
    () => () =>
      h('div', [
        editAction('编辑', noop),
        detailAction('详情', noop),
        deleteTrigger('删除'),
        removeAction('移除', noop),
      ]),
  )
  const read = (root: HTMLElement) =>
    ['编辑', '详情', '删除', '移除'].map((t) => textColor(byText(root, t)))

  it('浅色', () => {
    expect(read(mountIn(Actions, {}))).toEqual([
      LIGHT.primaryPressed,
      LIGHT.primaryPressed,
      LIGHT.errorPressed,
      LIGHT.errorPressed,
    ])
  })
  it('暗色', () => {
    expect(read(mountIn(Actions, {}, { dark: true }))).toEqual([
      DARK.primaryPressed,
      DARK.primaryPressed,
      DARK.errorPressed,
      DARK.errorPressed,
    ])
  })
  it('宿主自定义主题', () => {
    const overrides: GlobalThemeOverrides = {
      common: { primaryColorPressed: '#1060c9', errorColorPressed: '#990000' },
    }
    expect(read(mountIn(Actions, {}, { overrides }))).toEqual([
      '#1060c9',
      '#1060c9',
      '#990000',
      '#990000',
    ])
  })
  it('放在 NDataTable 的列 render 里同样生效', () => {
    const Table = defineComponent(
      () => () =>
        h(NDataTable, {
          columns: [{ key: 'a', title: 'A', render: () => editAction('编辑', noop) }],
          data: [{ a: 1 }],
        }),
    )
    expect(textColor(byText(mountIn(Table, {}), '编辑'))).toBe(LIGHT.primaryPressed)
  })
})

describe('useButtonTint:四组覆盖只含官方按钮变量', () => {
  it('随主题给出 pressed 色', () => {
    let got: ReturnType<typeof useButtonTint> | undefined
    const Probe = defineComponent(() => {
      got = useButtonTint()
      return () => h('i')
    })
    mountIn(Probe, {})
    expect(got!.value).toEqual({
      primary: { colorPrimary: LIGHT.primaryPressed },
      error: { colorError: LIGHT.errorPressed },
      primaryText: { textColorTextPrimary: LIGHT.primaryPressed },
      errorText: { textColorTextError: LIGHT.errorPressed },
    })
  })
})
