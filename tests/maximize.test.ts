// @vitest-environment jsdom
// 放大(toolbar.maximize)的无 UI 辅助:配置解析、滚动锁定(引用计数、还原原值)、输入方式追踪、浮层探测(Esc 分层的依据)、Tab 循环
import { afterEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_MAXIMIZE_Z,
  hasOpenFloat,
  isKeyboardModality,
  lockScroll,
  loopTab,
  resolveMaximize,
  trackInputModality,
  unlockScroll,
} from '../src/maximize'

afterEach(() => {
  document.body.innerHTML = ''
  document.documentElement.style.overflow = ''
})

describe('resolveMaximize', () => {
  it('未传 / false → 关闭;true → 开启且层级 1999(低于 naive 浮层的 2000);{ zIndex } → 开启且用宿主给的值', () => {
    expect(resolveMaximize(undefined)).toEqual({ enabled: false, zIndex: DEFAULT_MAXIMIZE_Z })
    expect(resolveMaximize(false)).toEqual({ enabled: false, zIndex: DEFAULT_MAXIMIZE_Z })
    expect(resolveMaximize(true)).toEqual({ enabled: true, zIndex: 1999 })
    expect(resolveMaximize({ zIndex: 3000 })).toEqual({ enabled: true, zIndex: 3000 })
  })
  it('{} / zIndex 不是有限数 → 开启,层级取默认', () => {
    expect(resolveMaximize({})).toEqual({ enabled: true, zIndex: 1999 })
    expect(resolveMaximize({ zIndex: Number.NaN })).toEqual({ enabled: true, zIndex: 1999 })
    expect(resolveMaximize({ zIndex: undefined })).toEqual({ enabled: true, zIndex: 1999 })
  })
})

describe('滚动锁定:html { overflow: hidden },引用计数,退出还原原值', () => {
  it('锁定 → hidden;解锁 → 还原宿主原来的 overflow(不是简单清空)', () => {
    document.documentElement.style.overflow = 'scroll'
    lockScroll()
    expect(document.documentElement.style.overflow).toBe('hidden')
    unlockScroll()
    expect(document.documentElement.style.overflow).toBe('scroll')
  })

  it('锁两次、解一次:仍锁着;全部解开才还原(两张表 / 重复调用不会提前解锁)', () => {
    lockScroll()
    lockScroll()
    unlockScroll()
    expect(document.documentElement.style.overflow).toBe('hidden')
    unlockScroll()
    expect(document.documentElement.style.overflow).toBe('')
  })

  it('多解锁不抛错、不把计数减成负数(之后再锁一次仍然生效)', () => {
    expect(() => unlockScroll()).not.toThrow()
    lockScroll()
    expect(document.documentElement.style.overflow).toBe('hidden')
    unlockScroll()
  })
})

describe('输入方式追踪(只有键盘操作才把焦点还给按钮)', () => {
  it('keydown → 键盘;pointerdown → 鼠标;没有任何输入时是 false', () => {
    const release = trackInputModality()
    expect(isKeyboardModality()).toBe(false)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    expect(isKeyboardModality()).toBe(true)
    document.dispatchEvent(new Event('pointerdown'))
    expect(isKeyboardModality()).toBe(false)
    release()
  })

  it('引用计数:两个使用者,释放一个仍在追踪;全部释放后监听摘除、状态复位', () => {
    const a = trackInputModality()
    const b = trackInputModality()
    a()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }))
    expect(isKeyboardModality()).toBe(true) // b 还在
    b()
    expect(isKeyboardModality()).toBe(false) // 复位
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }))
    expect(isKeyboardModality()).toBe(false) // 监听已摘除
    b() // 重复释放是空操作
  })
})

describe('hasOpenFloat(Esc 分层:有浮层就让浮层自己处理 Esc,没有才还原)', () => {
  const follower = (inner: string) => {
    const el = document.createElement('div')
    el.className = 'v-binder-follower-content'
    el.innerHTML = inner
    document.body.appendChild(el)
    return el
  }

  it('没有任何浮层 → false', () => {
    expect(hasOpenFloat()).toBe(false)
  })

  it('打开的气泡 / 下拉(follower 里有可见内容)→ true', () => {
    follower('<div class="n-popover">panel</div>')
    expect(hasOpenFloat()).toBe(true)
  })

  it('关闭后留下的壳不算:空壳(无子元素),或里面的菜单被 v-show 成 display:none', () => {
    follower('')
    follower('<div class="n-dropdown-menu" style="display: none">x</div>')
    expect(hasOpenFloat()).toBe(false)
  })

  it('Tooltip 不算(鼠标停在按钮上它一直开着,算了会让 Esc 永远还原不了)', () => {
    follower('<div class="n-popover n-tooltip">提示</div>')
    expect(hasOpenFloat()).toBe(false)
  })

  it('Drawer / Modal 容器里有内容 → true(它们自己处理 Esc)', () => {
    const d = document.createElement('div')
    d.className = 'n-drawer-container'
    d.innerHTML = '<div class="n-drawer">x</div>'
    document.body.appendChild(d)
    expect(hasOpenFloat()).toBe(true)
  })
})

describe('loopTab(放大层 role=dialog aria-modal:Tab 不掉回被盖住的宿主页面)', () => {
  function layerWith(n: number) {
    const layer = document.createElement('div')
    layer.innerHTML = Array.from({ length: n }, (_, i) => `<button id="b${i}">b${i}</button>`).join(
      '',
    )
    document.body.appendChild(layer)
    return { layer, btn: (i: number) => layer.querySelector<HTMLElement>(`#b${i}`)! }
  }
  const tab = (shiftKey = false) =>
    new KeyboardEvent('keydown', { key: 'Tab', shiftKey, cancelable: true })

  it('最后一个控件上 Tab → 回到第一个(preventDefault)', () => {
    const { layer, btn } = layerWith(3)
    btn(2).focus()
    const e = tab()
    expect(loopTab(e, layer)).toBe(true)
    expect(e.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(btn(0))
  })

  it('第一个控件上 Shift+Tab → 去最后一个', () => {
    const { layer, btn } = layerWith(3)
    btn(0).focus()
    const e = tab(true)
    expect(loopTab(e, layer)).toBe(true)
    expect(document.activeElement).toBe(btn(2))
  })

  it('焦点在放大层之外(Teleport 搬 DOM 后落到 body)时 Shift+Tab 也拉回最后一个', () => {
    const { layer, btn } = layerWith(2)
    ;(document.activeElement as HTMLElement | null)?.blur()
    expect(loopTab(tab(true), layer)).toBe(true)
    expect(document.activeElement).toBe(btn(1))
  })

  it('中间的控件上 Tab / 非 Tab 键 / 层里没有可聚焦元素 → 不处理', () => {
    const { layer, btn } = layerWith(3)
    btn(1).focus()
    expect(loopTab(tab(), layer)).toBe(false)
    expect(loopTab(new KeyboardEvent('keydown', { key: 'a' }), layer)).toBe(false)
    const empty = document.createElement('div')
    document.body.appendChild(empty)
    expect(loopTab(tab(), empty)).toBe(false)
  })
})
