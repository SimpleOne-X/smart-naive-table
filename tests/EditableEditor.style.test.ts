import { describe, expect, it } from 'vitest'
import source from '../src/EditableEditor.vue?raw'
import { ruleFor, rulesOf } from './sfcStyle'

// jsdom 不做布局,量不出控件高度 / 文字位置;真实几何由浏览器实测(行高 38.4 / 56 两档)。
// 这里锁住规则本身:格内编辑控件的高度取单元格(.smart-table-xe)的实际高度,不再写死「内边距 × 2 + 22.4px」,
// 行比这个数高(行内有更高的内容、字号 15px、舒适密度)时文字才仍然垂直居中、浮层锚点才落在单元格下沿。
const rules = rulesOf(source)
const CONTROLS = ['.smart-table-xe .n-input', '.smart-table-xe .n-base-selection']

describe('EditableEditor 格内控件的高度', () => {
  it('编辑容器是尺寸容器:控件的 --n-height 取容器高度(100cqh),与嵌套层数无关', () => {
    expect(ruleFor(rules, '.smart-table-xe')).toContain('container-type: size')
    const enhanced = rules.find(
      (r) =>
        CONTROLS.every((s) => r.selectors.includes(s)) &&
        r.body.includes('--n-height: 100cqh !important'),
    )
    expect(enhanced).toBeDefined()
  })

  it('不支持容器查询单位的浏览器仍用原来的「内边距 × 2 + 22.4px」', () => {
    const fallback = rules.find(
      (r) =>
        CONTROLS.every((s) => r.selectors.includes(s)) &&
        r.body.includes('--n-height: calc(var(--n-td-padding) * 2 + 22.4px) !important'),
    )
    expect(fallback).toBeDefined()
    // 100cqh 只能放在 @supports 里,否则旧浏览器上 height 会失效
    expect(source).toMatch(/@supports \(height: 1cqh\)\s*\{[^@]*--n-height: 100cqh !important/)
  })

  it('下拉表格的触发器(浮层锚点)铺满单元格高度', () => {
    expect(ruleFor(rules, '.smart-table-xe .smart-table-xpick-trigger')).toContain('height: 100%')
  })
})
