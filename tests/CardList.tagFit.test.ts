import { describe, expect, it } from 'vitest'
import source from '../src/CardList.vue?raw'

// jsdom 不做布局,量不出「标签:值」两列里值还剩多少宽;真实效果由浏览器实测(英文 390 宽:
// 「Document Status」标签约 100px,每对只有约 137px,值只剩 29px,70px 宽的 Approved 标签被 dd 的 overflow 裁成「App」)。
// 这里锁住规则本身:值里有 NTag 时,标签(dt)让位——它可收缩 + 省略,值(dd)不收缩、只被卡片宽度封顶。
// 文字值的行为不动(dt 仍是 flex: none,值单行省略),所以中文下的外观不变。
function ruleBody(selector: string): string {
  const style = source.slice(source.indexOf('<style')).replace(/\/\*[\s\S]*?\*\//g, '')
  for (const m of style.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (m[1].trim() === selector) return m[2]
  }
  return ''
}

describe('窄档卡片「标签:值」:值是 NTag 时的让位规则', () => {
  it('dt 在值含 .n-tag 的那对里可收缩并省略(否则被 flex: none 的长英文标签挤掉值的宽度)', () => {
    const body = ruleBody('.smart-table-card-desc > div:has(dd .n-tag) dt')
    expect(body).toMatch(/flex-shrink:\s*1/)
    expect(body).toMatch(/min-width:\s*0/)
    expect(body).toMatch(/overflow:\s*hidden/)
    expect(body).toMatch(/text-overflow:\s*ellipsis/)
    expect(body).toMatch(/white-space:\s*nowrap/)
  })

  it('dd 在值含 .n-tag 的那对里不收缩,只用 max-width: 100% 封顶', () => {
    const body = ruleBody('.smart-table-card-desc > div:has(dd .n-tag) dd')
    expect(body).toMatch(/flex-shrink:\s*0/)
    expect(body).toMatch(/max-width:\s*100%/)
  })

  it('文字值的默认规则不变:dt 不收缩,dd 可收缩并单行省略', () => {
    expect(ruleBody('.smart-table-card-desc dt')).toMatch(/flex:\s*none/)
    const dd = ruleBody('.smart-table-card-desc dd')
    expect(dd).toMatch(/min-width:\s*0/)
    expect(dd).toMatch(/text-overflow:\s*ellipsis/)
  })
})
