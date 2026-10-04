import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearState, loadState, mergeCols, peekStoredDensity, saveState } from '../src/storage'

// node 环境无 localStorage,用内存 stub(storage.ts 只用这四个方法)
const store = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
})

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('round-trips state', () => {
    saveState('t', 'compact', [{ key: 'a', show: true }], { a: 180 })
    expect(loadState('t')).toEqual({
      v: 2,
      density: 'compact',
      cols: [{ key: 'a', show: true }],
      widths: { a: 180 },
    })
  })

  it('defaults widths to an empty map when not given', () => {
    saveState('t', 'comfortable', [{ key: 'a', show: true }])
    expect(loadState('t')?.widths).toEqual({})
  })

  it('upgrades v1 state in place instead of discarding the user column settings', () => {
    localStorage.setItem(
      'protable:v1',
      JSON.stringify({
        v: 1,
        density: 'compact',
        cols: [{ key: 'a', show: false, fixed: 'left' }],
      }),
    )
    expect(loadState('v1')).toEqual({
      v: 2,
      density: 'compact',
      cols: [{ key: 'a', show: false, fixed: 'left' }],
      widths: {},
    })
  })

  it('returns null for missing / corrupted / version-mismatched state', () => {
    expect(loadState('missing')).toBeNull()

    localStorage.setItem('protable:bad', 'not json')
    expect(loadState('bad')).toBeNull()

    // 结构不对(cols 不是数组)→ 丢弃
    localStorage.setItem('protable:noCols', JSON.stringify({ v: 2, density: 'compact' }))
    expect(loadState('noCols')).toBeNull()

    // 未来版本 → 丢弃回声明态
    localStorage.setItem('protable:v9', JSON.stringify({ v: 9, density: 'compact', cols: [] }))
    expect(loadState('v9')).toBeNull()
  })

  it('drops a widths field that is not an object', () => {
    localStorage.setItem(
      'protable:w',
      JSON.stringify({ v: 2, density: 'compact', cols: [], widths: [1, 2] }),
    )
    expect(loadState('w')?.widths).toEqual({})
  })

  it('drops a widths map whose values are not numbers(损坏/手改的存储不该流入列宽运算)', () => {
    localStorage.setItem(
      'protable:badWidths',
      JSON.stringify({ v: 2, density: 'compact', cols: [], widths: { name: '180px' } }),
    )
    expect(loadState('badWidths')?.widths).toEqual({})
  })

  it('clearState removes the entry', () => {
    saveState('t', 'comfortable', [])
    clearState('t')
    expect(loadState('t')).toBeNull()
  })
})

describe('mergeCols', () => {
  it('stored order/visibility/fixed wins for surviving columns', () => {
    const declared = [
      { key: 'a', show: true },
      { key: 'b', show: true },
    ]
    const merged = mergeCols(declared, [
      { key: 'b', show: false, fixed: 'left' },
      { key: 'a', show: true },
    ])
    expect(merged).toEqual([
      { key: 'b', show: false, fixed: 'left' },
      { key: 'a', show: true },
    ])
  })

  it('drops stored columns that no longer exist in the declaration', () => {
    const merged = mergeCols(
      [{ key: 'a', show: true }],
      [
        { key: 'gone', show: true },
        { key: 'a', show: false },
      ],
    )
    expect(merged).toEqual([{ key: 'a', show: false }])
  })

  it('inserts newly declared columns at their declared index with declared visibility', () => {
    const declared = [
      { key: 'a', show: true },
      { key: 'new', show: true },
      { key: 'b', show: true },
    ]
    const merged = mergeCols(declared, [
      { key: 'b', show: true },
      { key: 'a', show: true },
    ])
    expect(merged.map((c) => c.key)).toEqual(['b', 'new', 'a'])
    expect(merged[1]).toEqual({ key: 'new', show: true })
  })

  it('appends a new trailing column when declared index exceeds merged length', () => {
    const declared = [
      { key: 'a', show: true },
      { key: 'b', show: true },
      { key: 'tail', show: false },
    ]
    const merged = mergeCols(declared, [{ key: 'a', show: true }])
    expect(merged.map((c) => c.key)).toEqual(['a', 'b', 'tail'])
  })
})

describe('loadState / saveState 的密度(B2 / Q-1)', () => {
  it('旧数据里没有 density 字段时回退成 compact(与内置默认一致)', () => {
    localStorage.setItem('protable:nodens', JSON.stringify({ v: 2, cols: [], widths: {} }))
    expect(loadState('nodens')?.density).toBe('compact')
  })

  it('saveState 的 density 传 undefined(用户从没选过)时不写这个字段;loadState 读回时仍回退成 compact', () => {
    saveState('nodens-w', undefined, [{ key: 'a', show: true }])
    expect(JSON.parse(localStorage.getItem('protable:nodens-w')!)).not.toHaveProperty('density')
    expect(loadState('nodens-w')?.density).toBe('compact')
  })

  it('[E6] loadState 的第二参数 fallbackDensity:记录里没有 density 字段时取它(宿主的 defaultDensity),有字段时取字段', () => {
    localStorage.setItem('protable:nodens2', JSON.stringify({ v: 2, cols: [], widths: {} }))
    expect(loadState('nodens2', 'comfortable')?.density).toBe('comfortable')
    expect(loadState('nodens2')?.density).toBe('compact') // 不传 = 内置默认 compact
    saveState('hasdens', 'compact', [])
    expect(loadState('hasdens', 'comfortable')?.density).toBe('compact')
  })

  it('peekStoredDensity:只认存储里真的存过的值(没有记录 / 没有字段 / 非法值 → undefined)', () => {
    expect(peekStoredDensity('never')).toBeUndefined()
    saveState('p1', undefined, [])
    expect(peekStoredDensity('p1')).toBeUndefined()
    saveState('p2', 'comfortable', [])
    expect(peekStoredDensity('p2')).toBe('comfortable')
    localStorage.setItem(
      'protable:p3',
      JSON.stringify({ v: 2, density: 'huge', cols: [], widths: {} }),
    )
    expect(peekStoredDensity('p3')).toBeUndefined()
  })
})
