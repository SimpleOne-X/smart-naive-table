// 翻页后滚回卡片顶部(E4,不开 fillHeight 时)。每页 100 行时卡片高约 4000px:滚到表底点「下一页」,
// 视口会停在下一页的页底(首行已在上方看不见)。判据必须是「卡片顶部已滚出滚动容器上沿」才滚,否则乱跳。

/** 沿祖先找真正会滚动的容器(overflow-y 是 auto / scroll 且内容溢出);没有 → null(文档)。 */
export function scrollParentOf(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY
    if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) return p
  }
  return null
}

/**
 * 卡片顶部(相对滚动容器上沿)< scroll-margin-top 时滚回卡片顶部,返回是否滚了。
 * `behavior: 'instant'`:宿主 `html { scroll-behavior: smooth }` 下也立即到位。
 * 宿主有固定顶栏时,给卡片设 CSS `scroll-margin-top`(= 顶栏高)即可,判据与落点都尊重它。
 */
export function keepCardTopVisible(card: HTMLElement): boolean {
  const sp = scrollParentOf(card)
  const top = card.getBoundingClientRect().top - (sp ? sp.getBoundingClientRect().top : 0)
  const margin = parseFloat(getComputedStyle(card).scrollMarginTop) || 0
  if (top >= margin) return false
  card.scrollIntoView({ block: 'start', behavior: 'instant' })
  return true
}
