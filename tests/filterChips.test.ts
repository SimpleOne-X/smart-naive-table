import { describe, expect, it } from 'vitest'
import {
  buildChips,
  countFitting,
  filtersAtDefaults,
  hasActiveDefaults,
  removeChipCondition,
  shrinkForMore,
} from '../src/filterChips'
import { defaultLabels } from '../src/labels'
import type { FilterDef } from '../src/useColumns'
import type { FilterState, FilterValue } from '../src/types'

const def = (over: Partial<FilterDef> & { key: string }): FilterDef => ({
  field: over.key,
  optionsKey: over.key,
  mode: 'condition',
  multiple: true,
  type: 'input',
  actions: ['contains'],
  ...over,
})
const v = (logic: 'and' | 'or', ...c: Array<[string, unknown]>): FilterValue => ({
  logic,
  conditions: c.map(([action, value]) => ({ action: action as never, value })),
})
const plain = (_d: FilterDef | undefined, value: unknown) => String(value)

describe('buildChips', () => {
  const defs = [
    def({ key: 'name', title: '姓名' }),
    def({ key: 'status', title: () => '状态', type: 'select' }),
  ]

  it('每个生效条件一个 chip:「列标题 操作符 值」;按列声明顺序', () => {
    const state: FilterState = {
      status: v('and', ['equal', 1]),
      name: v('and', ['contains', 'ali']),
    }
    expect(buildChips(defs, state, defaultLabels, plain)).toEqual([
      { key: 'name', index: 0, text: '姓名 Contains ali' },
      { key: 'status', index: 0, text: '状态 Equals 1' },
    ])
  })

  it('同列 logic 为 or 时,第 2 条起加「OR」前缀', () => {
    const chips = buildChips(
      defs,
      { name: v('or', ['contains', 'a'], ['contains', 'b']) },
      defaultLabels,
      plain,
    )
    expect(chips.map((c) => c.text)).toEqual(['姓名 Contains a', 'OR 姓名 Contains b'])
  })

  it('无值算子:没有值部分;in / notIn:值用逗号连接,每项走 optionLabelOf', () => {
    const chips = buildChips(
      defs,
      { name: v('and', ['isNull', null]), status: v('and', ['in', [1, 2]]) },
      defaultLabels,
      (_d, val) => `#${val}`,
    )
    expect(chips.map((c) => c.text)).toEqual(['姓名 Is empty', '状态 In #1, #2'])
  })

  it('没有生效条件的列不出 chip', () => {
    expect(buildChips(defs, { name: v('and', ['contains', '']) }, defaultLabels, plain)).toEqual([])
  })

  it('[Q-7] 孤儿键(state 里有、defs 里没有)也出 chip:排在列声明的 chip 之后,标题回退成键,标 orphan', () => {
    const state: FilterState = { ghost: v('and', ['equal', 1]), name: v('and', ['contains', 'a']) }
    expect(buildChips(defs, state, defaultLabels, plain)).toEqual([
      { key: 'name', index: 0, text: '姓名 Contains a' },
      { key: 'ghost', index: 0, text: 'ghost Equals 1', orphan: true },
    ])
    // optionLabelOf 对孤儿收到的 def 是 undefined(没有字典可查)
    const seen: unknown[] = []
    buildChips(
      defs,
      { ghost: v('and', ['equal', 1]) },
      defaultLabels,
      (d, val) => (seen.push(d), String(val)),
    )
    expect(seen).toEqual([undefined])
  })

  it('标题是返回非字符串(VNode)的函数时回退成列 key', () => {
    const d = def({ key: 'k', title: (() => ({})) as never })
    expect(buildChips([d], { k: v('and', ['contains', 'x']) }, defaultLabels, plain)[0].text).toBe(
      'k Contains x',
    )
  })
})

describe('removeChipCondition', () => {
  it('删掉指定的一条;剩一条时 logic 归位 and;删光返回 null', () => {
    const value = v('or', ['contains', 'a'], ['contains', 'b'])
    expect(removeChipCondition(value, 0)).toEqual(v('and', ['contains', 'b']))
    expect(removeChipCondition(v('and', ['contains', 'a']), 0)).toBeNull()
  })
  it('下标按「生效条件」算(与 buildChips 一致):无效条件不占下标', () => {
    const value = v('and', ['contains', ''], ['contains', 'a'], ['contains', 'b'])
    expect(removeChipCondition(value, 0)).toEqual(v('and', ['contains', 'b']))
  })
})

describe('countFitting(折成 +N 的个数)', () => {
  it('全在第一行 → 全部显示', () => {
    expect(countFitting([0, 0, 0])).toBe(3)
    expect(countFitting([])).toBe(0)
  })
  it('有折到第二行的 → 第一行放得下的个数再让出一个位置给「+N」,至少保留 1 个', () => {
    expect(countFitting([0, 0, 0, 30, 30])).toBe(2)
    expect(countFitting([0, 30, 30])).toBe(1)
  })
})

describe('shrinkForMore(「+N」自己也占位)', () => {
  it('+N 与第一行同高 → 原样;折到了下一行 → 再让出一个位置;只剩 1 个还放不下 → 0(只显示 +N,全部进气泡,F10)', () => {
    expect(shrinkForMore(3, 0, 0)).toBe(3)
    expect(shrinkForMore(3, 0, 30)).toBe(2)
    expect(shrinkForMore(1, 0, 30)).toBe(0)
    expect(shrinkForMore(0, 0, 30)).toBe(0) // 下限 0,不会变负
  })
})

describe('hasActiveDefaults', () => {
  it('任一列声明了生效的 defaultValue → true;空条件的 defaultValue 不算', () => {
    expect(
      hasActiveDefaults([
        def({ key: 'a' }),
        def({ key: 'b', defaultValue: v('and', ['equal', 1]) }),
      ]),
    ).toBe(true)
    expect(hasActiveDefaults([def({ key: 'a', defaultValue: v('and', ['equal', '']) })])).toBe(
      false,
    )
    expect(hasActiveDefaults([])).toBe(false)
  })
})

describe('filtersAtDefaults(过滤态是否就是默认值)', () => {
  const withDefault = [def({ key: 'a', defaultValue: v('and', ['equal', 'x']) }), def({ key: 'b' })]

  it('没有任何默认值、也没有条件 → 是默认态', () => {
    expect(filtersAtDefaults([def({ key: 'a' })], {})).toBe(true)
  })

  it('没有默认值但有生效条件 → 偏离', () => {
    expect(filtersAtDefaults([def({ key: 'a' })], { a: v('and', ['contains', '1']) })).toBe(false)
  })

  it('有默认值:状态恰好等于默认 → 是;被清掉 / 改了值 / 多了别的列的条件 / 多了孤儿键 → 偏离', () => {
    expect(filtersAtDefaults(withDefault, { a: v('and', ['equal', 'x']) })).toBe(true)
    expect(filtersAtDefaults(withDefault, {})).toBe(false)
    expect(filtersAtDefaults(withDefault, { a: v('and', ['equal', 'y']) })).toBe(false)
    expect(
      filtersAtDefaults(withDefault, {
        a: v('and', ['equal', 'x']),
        b: v('and', ['contains', '1']),
      }),
    ).toBe(false)
    expect(
      filtersAtDefaults(withDefault, {
        a: v('and', ['equal', 'x']),
        ghost: v('and', ['equal', '1']),
      }),
    ).toBe(false)
  })

  it('空条件(无生效)不算条件;单条时 logic 不同也算相同', () => {
    expect(
      filtersAtDefaults(withDefault, {
        a: v('and', ['equal', 'x']),
        b: v('and', ['contains', '']),
      }),
    ).toBe(true)
    expect(
      filtersAtDefaults(withDefault, {
        a: { logic: 'or', conditions: [{ action: 'equal', value: 'x' }] },
      }),
    ).toBe(true)
  })
})
