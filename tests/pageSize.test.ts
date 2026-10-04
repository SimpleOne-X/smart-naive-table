import { describe, expect, it } from 'vitest'
import { mergePageSizes, pageSizeValue, resolveDefaultPageSize } from '../src/pageSize'

describe('pageSizeValue / mergePageSizes(并入当前值)', () => {
  it('pageSizeValue:数字取自己,对象取 value', () => {
    expect(pageSizeValue(20)).toBe(20)
    expect(pageSizeValue({ label: '每页 50 条', value: 50 })).toBe(50)
  })
  it('当前值已在里面 → 原样(拷贝);不在 → 并入并按值升序,对象项保持 { label, value }', () => {
    expect(mergePageSizes([100, 500], 100)).toEqual([100, 500])
    expect(mergePageSizes([100, 500, 1000], 10)).toEqual([10, 100, 500, 1000])
    const obj = { label: '每页 50 条', value: 50 }
    expect(mergePageSizes([20, obj, 100], 30)).toEqual([20, 30, obj, 100])
    expect(mergePageSizes([20, obj], 50)).toEqual([20, obj]) // 对象项的 value 也算「已在里面」
  })
  it('不改入参', () => {
    const list = [100, 500]
    mergePageSizes(list, 10)
    expect(list).toEqual([100, 500])
  })
})

describe('resolveDefaultPageSize(D4 的解析优先级)', () => {
  it('没有任何来源 → 库默认 100', () => {
    expect(resolveDefaultPageSize({})).toBe(100)
  })
  it('实例 prop 最高', () => {
    expect(
      resolveDefaultPageSize({
        prop: 20,
        pageSize: 30,
        defaultPageSize: 40,
        globalDefaultPageSize: 50,
        pageSizes: [60],
        globalPageSizes: [70],
      }),
    ).toBe(20)
  })
  it('其次实例 pagination.pageSize,再其次 pagination.defaultPageSize', () => {
    expect(
      resolveDefaultPageSize({ pageSize: 30, defaultPageSize: 40, globalDefaultPageSize: 50 }),
    ).toBe(30)
    expect(
      resolveDefaultPageSize({ defaultPageSize: 40, globalDefaultPageSize: 50, pageSizes: [60] }),
    ).toBe(40)
  })
  it('再其次全局 defaultPageSize,它高于任何 pageSizes[0]', () => {
    expect(
      resolveDefaultPageSize({ globalDefaultPageSize: 50, pageSizes: [60], globalPageSizes: [70] }),
    ).toBe(50)
  })
  it('宿主显式给了 pageSizes → 取 [0](实例的先于全局的;对象取 value);回退「一行」:只写 pageSizes 也能让首个请求变小', () => {
    expect(resolveDefaultPageSize({ pageSizes: [10, 20, 50] })).toBe(10)
    expect(resolveDefaultPageSize({ pageSizes: [{ label: '每页 25 条', value: 25 }, 50] })).toBe(25)
    expect(resolveDefaultPageSize({ pageSizes: [10], globalPageSizes: [70] })).toBe(10)
    expect(resolveDefaultPageSize({ globalPageSizes: [70, 80] })).toBe(70)
  })
  it('空的 pageSizes 不算「给了」', () => {
    expect(resolveDefaultPageSize({ pageSizes: [], globalPageSizes: [] })).toBe(100)
  })
})
