import { describe, expect, it } from 'vitest'
import source from '../src/SmartTable.vue?raw'

// jsdom 不做布局,量不出 padding / 居中;这两条 CSS 的真实效果由浏览器实测,
// 这里只锁住规则本身,防止被无意改回去。
describe('SmartTable 样式规则', () => {
  it('表头右内边距 16px 不作用于选择 / 展开列(否则全选框比行内复选框偏左 8px)', () => {
    expect(source).toMatch(
      /\.n-data-table-th:not\(\.n-data-table-th--selection\):not\(\.n-data-table-th--expand\)\)\s*\{\s*padding-right: 16px/,
    )
  })

  it('fillHeight 的空状态撑满表体并垂直居中', () => {
    expect(source).toMatch(
      /\.smart-table--fill :deep\(\.n-data-table-base-table-body \.n-scrollbar-content\),\s*\.smart-table--fill :deep\(\.n-data-table-base-table-body \.n-data-table-empty\)\s*\{\s*height: 100%/,
    )
  })
})
