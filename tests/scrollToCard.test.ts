// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { keepCardTopVisible, scrollParentOf } from '../src/scrollToCard'

function card(top: number, marginTop = '') {
  const el = document.createElement('div')
  document.body.appendChild(el)
  if (marginTop) el.style.scrollMarginTop = marginTop
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({ top } as DOMRect)
  Element.prototype.scrollIntoView = vi.fn()
  return el
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
  // @ts-expect-error jsdom 没有 scrollIntoView,测试里临时装了一个
  delete Element.prototype.scrollIntoView
})

describe('keepCardTopVisible(E4:翻页后只在需要时滚回卡片顶部)', () => {
  it('卡片顶部已滚出视口上沿(top < 0)→ scrollIntoView({ block: "start", behavior: "instant" }),返回 true', () => {
    const el = card(-120)
    expect(keepCardTopVisible(el)).toBe(true)
    expect(el.scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'instant' })
  })
  it('卡片顶部还在视口内(top ≥ 0)→ 不滚(不在卡片可见时乱跳)', () => {
    const el = card(0)
    expect(keepCardTopVisible(el)).toBe(false)
    expect(keepCardTopVisible(card(316))).toBe(false)
    expect(el.scrollIntoView).not.toHaveBeenCalled()
  })
  it('宿主用 CSS scroll-margin-top 给固定顶栏留位:判据是 top < margin', () => {
    expect(keepCardTopVisible(card(40, '56px'))).toBe(true) // 被 56px 顶栏盖住了
    expect(keepCardTopVisible(card(60, '56px'))).toBe(false)
  })
  it('宿主的内层滚动容器(overflow:auto 且真的有滚动条):top 是相对它的上沿算的', () => {
    const sp = document.createElement('div')
    sp.style.overflowY = 'auto'
    Object.defineProperty(sp, 'scrollHeight', { value: 2000, configurable: true })
    Object.defineProperty(sp, 'clientHeight', { value: 500, configurable: true })
    vi.spyOn(sp, 'getBoundingClientRect').mockReturnValue({ top: 100 } as DOMRect)
    document.body.appendChild(sp)
    const el = document.createElement('div')
    sp.appendChild(el)
    Element.prototype.scrollIntoView = vi.fn()
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({ top: 90 } as DOMRect) // 相对容器上沿 −10 → 要滚
    expect(scrollParentOf(el)).toBe(sp)
    expect(keepCardTopVisible(el)).toBe(true)
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({ top: 130 } as DOMRect) // 相对容器上沿 +30 → 不滚
    expect(keepCardTopVisible(el)).toBe(false)
  })
})

describe('scrollParentOf', () => {
  it('没有可滚动的祖先 → null(文档)', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    expect(scrollParentOf(el)).toBeNull()
  })
  it('overflow:auto 但内容没溢出(不会滚)的祖先不算', () => {
    const sp = document.createElement('div')
    sp.style.overflowY = 'auto' // jsdom 里 scrollHeight / clientHeight 都是 0
    const el = document.createElement('div')
    sp.appendChild(el)
    document.body.appendChild(sp)
    expect(scrollParentOf(el)).toBeNull()
  })
})
