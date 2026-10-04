import { describe, expect, expectTypeOf, it } from 'vitest'
import type { SmartTableProps } from '../src'

// SmartTable.vue 的 rowDraggable / dragHandle 两个 prop(README 也写了)必须同时声明在导出的 SmartTableProps 类型里 ——
// 否则宿主按类型写 props 对象时这两个键会被当成多余属性报错。这里在编译期锁住它们存在且类型正确(vue-tsc 会检查本文件)。
describe('SmartTableProps 类型补全', () => {
  it('rowDraggable / dragHandle 是可选属性', () => {
    const props: SmartTableProps = { columns: [], rowDraggable: true, dragHandle: '.my-handle' }
    expect(props.rowDraggable).toBe(true)
    expectTypeOf<SmartTableProps['rowDraggable']>().toEqualTypeOf<boolean | undefined>()
    expectTypeOf<SmartTableProps['dragHandle']>().toEqualTypeOf<string | undefined>()
  })

  it('不传也合法(向后兼容)', () => {
    const props: SmartTableProps = { columns: [] }
    expect(props.rowDraggable).toBeUndefined()
  })
})
