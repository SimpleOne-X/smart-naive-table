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

  it('不支持容器查询单位的浏览器退回「单元格上下内边距之和 + 22.4px」', () => {
    const fallback = rules.find(
      (r) =>
        CONTROLS.every((s) => r.selectors.includes(s)) &&
        r.body.includes('--n-height: calc(var(--smart-xe-pad-y) + 22.4px) !important'),
    )
    expect(fallback).toBeDefined()
    // 100cqh 只能放在 @supports 里,否则旧浏览器上 height 会失效
    expect(source).toMatch(/@supports \(height: 1cqh\)\s*\{[^@]*--n-height: 100cqh !important/)
  })

  it('下拉表格的触发器(浮层锚点)铺满单元格高度', () => {
    expect(ruleFor(rules, '.smart-table-xe .smart-table-xpick-trigger')).toContain('height: 100%')
  })
})

// 宿主主题可以把 tdPaddingSmall / tdPaddingMedium 设成 padding 简写的两值写法(SmartAdmin 内核:'4px 12px' / '4px 10px')。
// --n-td-padding 此时是「4px 10px」,直接代进「0 26px 0 var(--n-td-padding)」得到五个值,整条声明在计算时失效,左内边距落回 0。
// 所以格内控件不直接用 --n-td-padding:编辑器挂载时量出显示态单元格实际的左内边距与上下内边距之和,写成库自己的两个变量。
describe('EditableEditor 格内控件的文字左缘', () => {
  const left = 'var(--smart-xe-pad-left)'

  it('单行输入类控件与下拉的左内边距取 --smart-xe-pad-left', () => {
    const body = rules
      .filter((r) => CONTROLS.every((s) => r.selectors.includes(s)))
      .map((r) => r.body)
      .join(' ')
    expect(body).toContain(`--n-padding-left: ${left} !important`)
    expect(body).toContain(`--n-padding-single: 0 26px 0 ${left} !important`)
  })

  it('多选的左内边距同样取 --smart-xe-pad-left(官方多选另有一套 --n-padding-multiple)', () => {
    const body = ruleFor(rules, ...CONTROLS)
    expect(body).toContain(`--n-padding-multiple: 3px 26px 0 ${left} !important`)
  })

  it('--n-td-padding 只出现在两个变量的缺省定义里,不被代进任何多值简写', () => {
    const users = rules.filter((r) => r.body.includes('--n-td-padding'))
    expect(users.map((r) => r.selectors.join(', '))).toEqual(['.smart-table-xe'])
    const body = users[0].body
    expect(body).toContain('--smart-xe-pad-left: var(--n-td-padding)')
    expect(body).toContain('--smart-xe-pad-y: calc(var(--n-td-padding) * 2)')
  })
})
