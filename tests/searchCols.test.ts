import { describe, expect, it } from 'vitest'
import { countTracks, effectiveCollapsedRows } from '../src/searchCols'

describe('countTracks(computed grid-template-columns → 轨道数)', () => {
  it('浏览器解析后的形状是一串 px:数空白分隔的项', () => {
    expect(countTracks('300px')).toBe(1)
    expect(countTracks('100px 100px 100px')).toBe(3)
    expect(countTracks('  150.5px   150.5px ')).toBe(2)
  })
  it('未解析的 repeat(N, …)(jsdom / 个别环境):取 N', () => {
    expect(countTracks('repeat(4, minmax(0px, 1fr))')).toBe(4)
    expect(countTracks('repeat(2,1fr)')).toBe(2)
  })
  it('括号里的空格不算分隔', () => {
    expect(countTracks('minmax(0px, 1fr) 1fr')).toBe(2)
  })
  it('none / 空串 / 读不到 → 0(未知,调用方不改配置值)', () => {
    expect(countTracks('none')).toBe(0)
    expect(countTracks('')).toBe(0)
    expect(countTracks(undefined as unknown as string)).toBe(0)
  })
})

describe('effectiveCollapsedRows(C5)', () => {
  it('1 列 × 1 行(折叠态 0 个字段的那一档)→ 抬到 2 行:首个字段 + 下一行操作区', () => {
    expect(effectiveCollapsedRows(1, 1)).toBe(2)
    expect(effectiveCollapsedRows(1)).toBe(2) // collapsedRows 缺省按 1
  })
  it('其余档位不变:2 / 3 / 4 列仍是配置值;1 列但 collapsedRows ≥ 2 也不变(本来就有字段)', () => {
    expect(effectiveCollapsedRows(2, 1)).toBe(1)
    expect(effectiveCollapsedRows(3, 1)).toBe(1)
    expect(effectiveCollapsedRows(4, 1)).toBe(1)
    expect(effectiveCollapsedRows(1, 2)).toBe(2)
    expect(effectiveCollapsedRows(1, 3)).toBe(3)
  })
  it('轨道数未知(0)→ 原样返回配置值,不改现有用户的行为', () => {
    expect(effectiveCollapsedRows(0, 1)).toBe(1)
    expect(effectiveCollapsedRows(0, 2)).toBe(2)
  })
})
