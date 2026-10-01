import { describe, expect, it } from 'vitest'
import {
  MAX_CONDITIONS,
  addCondition,
  blankDraft,
  draftFromValue,
  draftToValue,
  removeCondition,
  setConditionAction,
  setConditionValue,
  setLogic,
} from '../src/filterDraft'
import type { FilterValue } from '../src/types'

const fv = (logic: 'and' | 'or', ...c: Array<[string, unknown]>): FilterValue => ({
  logic,
  conditions: c.map(([action, value]) => ({ action: action as never, value })),
})

describe('draftFromValue / blankDraft', () => {
  it('没有值 → 一行空白条件(用给定的默认操作符)', () => {
    expect(draftFromValue(null, 'contains')).toEqual(blankDraft('contains'))
    expect(blankDraft('contains')).toEqual({ logic: 'and', conditions: [{ action: 'contains', value: null }] })
  })
  it('有值 → 拷贝全部条件(不截断,也不与输入共享引用)', () => {
    const v = fv('or', ['equal', 1], ['equal', 2])
    const d = draftFromValue(v, 'contains')
    expect(d).toEqual({ logic: 'or', conditions: [{ action: 'equal', value: 1 }, { action: 'equal', value: 2 }] })
    expect(d.conditions[0]).not.toBe(v.conditions[0])
  })
  it('超过 MAX_CONDITIONS 的编程式值不被截断(只是不能再添加)', () => {
    const v = fv('and', ...Array.from({ length: 7 }, (_, i): [string, unknown] => ['equal', i]))
    expect(draftFromValue(v, 'equal').conditions).toHaveLength(7)
  })
})

describe('addCondition / removeCondition', () => {
  it('添加:追加一行空白条件;到上限后原样返回', () => {
    let d = blankDraft('contains')
    for (let i = 1; i < MAX_CONDITIONS; i++) d = addCondition(d, 'contains')
    expect(d.conditions).toHaveLength(MAX_CONDITIONS)
    expect(addCondition(d, 'contains')).toBe(d)
  })
  it('删除:删掉指定行;删光则回到一行空白', () => {
    const d = draftFromValue(fv('and', ['contains', 'a'], ['contains', 'b']), 'contains')
    expect(removeCondition(d, 0, 'contains').conditions).toEqual([{ action: 'contains', value: 'b' }])
    const one = blankDraft('contains')
    expect(removeCondition(one, 0, 'equal')).toEqual(blankDraft('equal'))
  })
})

describe('setConditionAction(换操作符时旧值不再适用就清空)', () => {
  const d = draftFromValue(fv('and', ['contains', 'abc']), 'contains')
  it('标量 → 标量:值保留', () => {
    expect(setConditionAction(d, 0, 'equal').conditions[0]).toEqual({ action: 'equal', value: 'abc' })
  })
  it('标量 → 无值 / 数组:值清空', () => {
    expect(setConditionAction(d, 0, 'isNull').conditions[0]).toEqual({ action: 'isNull', value: null })
    expect(setConditionAction(d, 0, 'in').conditions[0]).toEqual({ action: 'in', value: null })
  })
  it('数组 → 标量:值清空;数组 → 数组(in → notIn):值保留', () => {
    const arr = draftFromValue(fv('and', ['in', [1, 2]]), 'equal')
    expect(setConditionAction(arr, 0, 'equal').conditions[0]).toEqual({ action: 'equal', value: null })
    expect(setConditionAction(arr, 0, 'notIn').conditions[0]).toEqual({ action: 'notIn', value: [1, 2] })
  })
  it('只改指定的那一行', () => {
    const two = draftFromValue(fv('and', ['contains', 'a'], ['contains', 'b']), 'contains')
    expect(setConditionAction(two, 1, 'equal').conditions.map((c) => c.action)).toEqual(['contains', 'equal'])
  })
})

describe('setConditionValue / setLogic', () => {
  it('只改指定行的值;setLogic 只改 logic', () => {
    const d = draftFromValue(fv('and', ['contains', 'a'], ['contains', 'b']), 'contains')
    expect(setConditionValue(d, 1, 'z').conditions.map((c) => c.value)).toEqual(['a', 'z'])
    expect(setLogic(d, 'or').logic).toBe('or')
  })
})

describe('draftToValue', () => {
  it('全空 → null', () => {
    expect(draftToValue(blankDraft('contains'))).toBeNull()
  })
  it('只保留生效条件;无值算子算生效', () => {
    const d = draftFromValue(fv('or', ['contains', ''], ['isNull', null], ['contains', 'x']), 'contains')
    expect(draftToValue(d)).toEqual({ logic: 'or', conditions: [{ action: 'isNull', value: null }, { action: 'contains', value: 'x' }] })
  })
  it('只剩一条生效时 logic 归位为 and(「且 / 或」只在 ≥ 2 条时有意义)', () => {
    const d = draftFromValue(fv('or', ['contains', 'x'], ['contains', '']), 'contains')
    expect(draftToValue(d)).toEqual({ logic: 'and', conditions: [{ action: 'contains', value: 'x' }] })
  })
})
