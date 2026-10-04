import { describe, expect, it } from 'vitest'
import { cleanParams } from '../src/useSmartTable'

describe('cleanParams', () => {
  it('drops undefined / null / empty string / empty array', () => {
    expect(cleanParams({ a: undefined, b: null, c: '', d: '   ', e: [] })).toEqual({})
  })

  it('keeps false and 0', () => {
    expect(cleanParams({ enabled: false, count: 0 })).toEqual({ enabled: false, count: 0 })
  })

  it('trims strings and sends the trimmed value', () => {
    expect(cleanParams({ name: '  tom  ' })).toEqual({ name: 'tom' })
  })

  it('keeps non-empty arrays and plain values', () => {
    expect(cleanParams({ ids: [1, 2], page: 3, s: 'x' })).toEqual({ ids: [1, 2], page: 3, s: 'x' })
  })

  it('does not mutate the input', () => {
    const input = { name: '  tom  ', empty: '' }
    cleanParams(input)
    expect(input).toEqual({ name: '  tom  ', empty: '' })
  })
})
