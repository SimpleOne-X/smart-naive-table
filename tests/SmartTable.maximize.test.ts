// @vitest-environment jsdom
// 放大(toolbar.maximize)接线:Teleport 到 body、层级、滚动锁定、Esc 分层、键盘才还焦点、与 fillHeight 同一套映射
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { h, nextTick } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { NConfigProvider, NDataTable } from 'naive-ui'
import SmartTable from '../src/SmartTable.vue'
import type { SmartTableColumn } from '../src/types'

interface Row {
  id: number
  name: string
}
const rows: Row[] = [
  { id: 1, name: 'alice' },
  { id: 2, name: 'bob' },
]
const columns: SmartTableColumn<unknown>[] = [{ key: 'name', title: 'Name' }]

const mounted: VueWrapper[] = []
function mountTable(toolbar: unknown = { maximize: true }, extra: Record<string, unknown> = {}) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const w = mount(SmartTable, {
    props: {
      columns,
      data: rows,
      rowKey: 'id',
      pagination: false,
      search: false,
      toolbar: toolbar as never,
      ...extra,
    },
    attachTo: host,
  })
  mounted.push(w)
  return w
}
/**
 * 同 mountTable,但外面包一层官方 NConfigProvider。只给「console.warn 一次都没有 / 恰好一次」这两条断言用:
 * peerDependencies 允许的 naive-ui 2.44.x 里,DataTableBody 在没有 NConfigProvider 祖先时 inject('n-config-provider') 不带默认值,
 * Vue 会发一条与本库无关的 dev 警告;本地实装的 2.45.3 是 inject(key, null)(es/data-table/src/TableParts/Body.mjs:157),不警告。
 * 包一层 provider 让两个版本下的结果一致,只是消掉这条第三方警告,断言本身不变(库或 Vue 的任何其它 warn 仍算数)。
 */
function mountTableInProvider(toolbar: unknown) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const w = mount(NConfigProvider, {
    slots: {
      default: () =>
        h(SmartTable, {
          columns,
          data: rows,
          rowKey: 'id',
          pagination: false,
          search: false,
          toolbar: toolbar as never,
        }),
    },
    attachTo: host,
  })
  mounted.push(w)
  return w
}
const layer = () => document.querySelector<HTMLElement>('.smart-table-layer')!
const maxBtn = () =>
  document.querySelector<HTMLElement>('button[aria-label="Maximize"], button[aria-label="Restore"]')
const isMaximized = () => !!document.querySelector('.smart-table-layer--maximized')
const press = (key: string) =>
  document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
const flush = async () => {
  await nextTick()
  await nextTick()
}

// 放大态映射官方 virtual-scroll:vueuc 的 VirtualList 在 setup 里读 window.matchMedia,jsdom 没有(同 fillHeight 的用例)
beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
})

afterEach(() => {
  while (mounted.length) mounted.pop()!.unmount()
  document.body.innerHTML = ''
  document.documentElement.style.overflow = ''
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('toolbar.maximize 默认关闭(新增能力,不改变默认:DOM 也与没有这个能力时一致)', () => {
  it('不传 / false:没有按钮;没有放大层这一层 div(根元素的直接子节点就是搜索卡片 / 表格卡片)', () => {
    for (const toolbar of [{}, { maximize: false }]) {
      const w = mountTable(toolbar)
      expect(maxBtn()).toBeNull()
      expect(document.querySelector('.smart-table-layer')).toBeNull()
      expect([...w.element.children].some((c) => c.classList.contains('smart-table-card'))).toBe(
        true,
      )
      w.unmount()
      mounted.pop()
    }
  })

  it('toolbar: false 也没有按钮', () => {
    mountTable(false)
    expect(maxBtn()).toBeNull()
  })

  it('开了但没放大:放大层在根元素里(display: contents,对布局透明),没有 dialog 语义', () => {
    const w = mountTable()
    expect(layer().parentElement).toBe(w.element)
    expect(layer().getAttribute('role')).toBeNull()
    expect(layer().classList.contains('smart-table-layer--maximized')).toBe(false)
  })
})

describe('放大 / 还原', () => {
  it('放大层带着与根元素相同的 scoped 属性(data-v-*):它由 MaximizeLayer 渲染,不手动带上的话放大后所有 scoped 样式(悬停图标 / 把手 / 表头内边距)都失效', async () => {
    const w = mountTable()
    const scopeOf = (el: Element) =>
      [...el.attributes].map((a) => a.name).find((n) => n.startsWith('data-v-'))
    const rootScope = scopeOf(w.element)
    expect(rootScope).toBeTruthy()
    expect(scopeOf(layer())).toBe(rootScope) // 未放大时
    maxBtn()!.click()
    await flush()
    expect(layer().parentElement).toBe(document.body)
    expect(scopeOf(layer())).toBe(rootScope) // 放大后(已搬到 body)
  })

  it('点按钮:放大层被搬到 body、fixed 铺满、role=dialog aria-modal、层级 1999;根元素原位留同高占位;html 滚动被锁', async () => {
    const w = mountTable()
    expect(maxBtn()!.getAttribute('aria-label')).toBe('Maximize')
    maxBtn()!.click()
    await flush()
    const l = layer()
    expect(l.parentElement).toBe(document.body)
    expect(l.classList.contains('smart-table-layer--maximized')).toBe(true)
    expect(l.getAttribute('role')).toBe('dialog')
    expect(l.getAttribute('aria-modal')).toBe('true')
    expect(l.style.zIndex).toBe('1999')
    expect(l.style.background).not.toBe('') // 底色取主题变量,不是透明
    expect(document.documentElement.style.overflow).toBe('hidden')
    expect(w.element.getAttribute('style')).toContain('min-height') // 占位,宿主页面的文档高度不变
    expect(maxBtn()!.getAttribute('aria-label')).toBe('Restore')
    expect(maxBtn()!.getAttribute('aria-pressed')).toBe('true')
  })

  it('再点一次:放大层回到根元素里,滚动锁定还原宿主原来的 overflow,占位去掉', async () => {
    document.documentElement.style.overflow = 'scroll'
    const w = mountTable()
    maxBtn()!.click()
    await flush()
    maxBtn()!.click()
    await flush()
    expect(layer().parentElement).toBe(w.element)
    expect(isMaximized()).toBe(false)
    expect(document.documentElement.style.overflow).toBe('scroll')
    expect(w.element.getAttribute('style') ?? '').not.toContain('min-height')
  })

  it('{ zIndex } 可配置(宿主顶栏层级更高时);< 2000 不警告', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    mountTableInProvider({ maximize: { zIndex: 1500 } })
    maxBtn()!.click()
    await flush()
    expect(layer().style.zIndex).toBe('1500')
    expect(warn).not.toHaveBeenCalled()
  })

  it('zIndex ≥ 2000 会盖住表格自己的气泡:开发期警告,每个实例一次(与 max-height 警告同口径)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    mountTableInProvider({ maximize: { zIndex: 3000 } })
    maxBtn()!.click()
    await flush()
    maxBtn()!.click()
    await flush()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0][0])).toContain('toolbar.maximize.zIndex')
  })

  it('放大态复用 fillHeight 的映射:表体在卡片内滚动(flex-height + virtual-scroll),还原后去掉;宿主 max-height 在放大态被忽略', async () => {
    const w = mountTable({ maximize: true }, { maxHeight: 300 })
    const flex = () => w.findComponent(NDataTable).props('flexHeight')
    expect(flex()).toBeFalsy()
    maxBtn()!.click()
    await flush()
    expect(flex()).toBe(true)
    expect(w.findComponent(NDataTable).props('virtualScroll')).toBe(true)
    expect(w.findComponent(NDataTable).props('maxHeight')).toBeUndefined()
    maxBtn()!.click()
    await flush()
    expect(flex()).toBeFalsy()
    expect(w.findComponent(NDataTable).props('maxHeight')).toBe(300) // 还原后宿主的 max-height 回来
  })

  it('宿主把 toolbar.maximize 关掉:自动还原并解锁', async () => {
    const w = mountTable()
    maxBtn()!.click()
    await flush()
    await w.setProps({ toolbar: {} })
    await flush()
    expect(isMaximized()).toBe(false)
    expect(document.documentElement.style.overflow).toBe('')
  })

  it('放大中被卸载(路由切换):解除滚动锁定,摘掉 document 上的 keydown 监听', async () => {
    const w = mountTable()
    maxBtn()!.click()
    await flush()
    const remove = vi.spyOn(document, 'removeEventListener')
    w.unmount()
    mounted.pop()
    expect(document.documentElement.style.overflow).toBe('')
    expect(remove.mock.calls.filter((c) => c[0] === 'keydown').length).toBeGreaterThanOrEqual(2) // 捕获 + 冒泡各一个(另有输入方式追踪)
    expect(document.querySelector('.smart-table-layer')).toBeNull() // body 上不留残骸
  })
})

describe('Esc 分层:先收浮层,没有浮层了再 Esc 才还原', () => {
  it('没有浮层:Esc 还原', async () => {
    mountTable()
    maxBtn()!.click()
    await flush()
    press('Escape')
    await flush()
    expect(isMaximized()).toBe(false)
  })

  it('有浮层(气泡 / 下拉 / 抽屉)时 Esc 不还原;浮层关掉后再 Esc 才还原', async () => {
    mountTable()
    maxBtn()!.click()
    await flush()
    const float = document.createElement('div')
    float.className = 'v-binder-follower-content'
    float.innerHTML = '<div class="n-popover">panel</div>'
    document.body.appendChild(float)
    press('Escape') // 浮层自己处理这一下(这里没人处理,只验证放大层不抢)
    await flush()
    expect(isMaximized()).toBe(true)
    float.remove() // 浮层被 Esc 关掉了
    press('Escape')
    await flush()
    expect(isMaximized()).toBe(false)
  })

  it('浮层在捕获阶段就读:浮层自己在冒泡阶段把自己关掉(NSelect 的做法),这一下 Esc 也不能还原', async () => {
    mountTable()
    maxBtn()!.click()
    await flush()
    const float = document.createElement('div')
    float.className = 'v-binder-follower-content'
    float.innerHTML = '<div class="n-base-select-menu">menu</div>'
    document.body.appendChild(float)
    // 模拟 NSelect:在 Esc 的冒泡阶段先把自己关掉(早于放大层的监听)
    const closeSelf = () => float.remove()
    document.addEventListener('keydown', closeSelf, { once: true })
    press('Escape')
    await flush()
    expect(isMaximized()).toBe(true) // 冒泡到放大层时浮层已不在,但捕获阶段读到过它
    press('Escape')
    await flush()
    expect(isMaximized()).toBe(false)
  })

  it('筛选面板在捕获阶段处理并 stopPropagation 的 Esc,不会冒泡到放大层(整张表不还原)', async () => {
    mountTable()
    maxBtn()!.click()
    await flush()
    const panel = document.createElement('div')
    panel.addEventListener('keydown', (e) => e.stopPropagation(), true) // 与 ColumnFilter 面板同样的做法
    const input = document.createElement('input')
    panel.appendChild(input)
    document.body.appendChild(panel)
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    )
    await flush()
    expect(isMaximized()).toBe(true)
  })

  it('没放大时 Esc 完全不管(没有 document 监听,不会误触别的 Esc)', async () => {
    const add = vi.spyOn(document, 'addEventListener')
    mountTable()
    expect(add.mock.calls.filter((c) => c[0] === 'keydown' && c[2] === true).length).toBe(1) // 只有输入方式追踪的那一个(捕获)
    press('Escape')
    await flush()
    expect(isMaximized()).toBe(false)
  })

  it('「更多」「列设置」等库自己的弹层可以用 Esc 关(NPopover / NDropdown 本身不管键盘),放大层随后才还原', async () => {
    mountTable({ maximize: true, more: [{ label: '导出', key: 'x' }] })
    maxBtn()!.click()
    await flush()
    const colBtn = document.querySelector<HTMLElement>('button[aria-label="Columns"]')!
    colBtn.click()
    await flush()
    await new Promise((r) => setTimeout(r, 60))
    expect(document.querySelector('.smart-table-colset')).not.toBeNull()
    press('Escape')
    await flush()
    expect(isMaximized()).toBe(true) // 这一下只关气泡
  })
})

describe('焦点:只有键盘操作才还给按钮(鼠标点按后再 focus 会画出黑色焦点环)', () => {
  it('键盘(keydown)后放大:焦点在按钮上', async () => {
    mountTable()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    maxBtn()!.click()
    await flush()
    expect(document.activeElement).toBe(maxBtn())
  })

  it('鼠标(pointerdown)后放大:焦点不还给按钮', async () => {
    mountTable()
    document.dispatchEvent(new Event('pointerdown'))
    maxBtn()!.click()
    await flush()
    expect(document.activeElement).not.toBe(maxBtn())
  })
})
