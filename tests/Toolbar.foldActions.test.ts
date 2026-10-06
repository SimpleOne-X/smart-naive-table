import { describe, expect, it } from 'vitest'
import source from '../src/Toolbar.vue?raw'

// jsdom 不做布局,量不出窄档「操作」展开行里按钮的实际宽度;真实效果由浏览器实测(英文 390 宽:
// 「Discard changes / Add operation / Save changes (1)」三个带图标的按钮等分 332px 放不下,最后一个被裁出视口)。
// 这里锁住规则本身:展开行允许换行,等分的按钮不小于内容宽,放不下就换到下一行。
function ruleBody(selector: string): string {
  const style = source.slice(source.indexOf('<style')).replace(/\/\*[\s\S]*?\*\//g, '')
  for (const m of style.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (m[1].trim() === selector) return m[2]
  }
  return ''
}

describe('窄档「操作」展开行:按钮等分但不小于内容宽', () => {
  it('展开行允许换行', () => {
    expect(
      ruleBody(
        '.smart-table-toolbar--fold.smart-table-toolbar--ops-open .smart-table-toolbar-actions',
      ),
    ).toMatch(/flex-wrap:\s*wrap/)
  })

  it('子项等分整行(flex: 1 1 0),但最小宽是内容宽(max-content),不被挤扁、不超出视口', () => {
    const body = ruleBody('.smart-table-toolbar--fold .smart-table-toolbar-actions > :deep(*)')
    expect(body).toMatch(/flex:\s*1 1 0/)
    expect(body).toMatch(/min-width:\s*max-content/)
  })
})
