import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { deriveFilterDefs, deriveInitFilters, type FilterDef } from '../src/useColumns'
import { useFilters } from '../src/useFilters'
import type { FilterValue, SmartTableColumn } from '../src/types'

interface Row {
  name: string
  status: number
  createTime: string
  salary: number
}

const v = (value: unknown): FilterValue => ({
  logic: 'and',
  conditions: [{ action: 'equal', value }],
})

describe('deriveFilterDefs', () => {
  it('缺省按有无字典推断 mode,按 format 推断 condition 的值控件', () => {
    const cols: SmartTableColumn<Row>[] = [
      { key: 'name', title: 'N', filter: true },
      { key: 'status', title: 'S', options: [{ label: 'A', value: 1 }], filter: true },
      { key: 'createTime', title: 'C', format: 'datetime', filter: true },
      { key: 'salary', title: 'M', format: 'money', filter: true },
    ]
    const defs = deriveFilterDefs(cols)
    expect(defs.map((d) => [d.key, d.mode, d.type])).toEqual([
      ['name', 'condition', 'input'],
      ['status', 'options', 'select'],
      ['createTime', 'condition', 'date'],
      ['salary', 'condition', 'number'],
    ])
  })

  it('默认动作按值类型给,显式 actions 优先', () => {
    const [text, num] = deriveFilterDefs<Row>([
      { key: 'name', filter: true },
      { key: 'salary', format: 'money', filter: { actions: ['gt'] } },
    ])
    expect(text.actions).toEqual(['contains', 'notContains', 'equal', 'notEqual'])
    expect(num.actions).toEqual(['gt'])
  })

  it('[B7 / D1] 列头面板的默认可选操作符保持 2.1.1:新增的 7 个只在列上显式写 filter.actions 时出现', () => {
    const [text, num, date, sel, explicit] = deriveFilterDefs<Row>([
      { key: 'name', filter: true },
      { key: 'salary', format: 'money', filter: true },
      { key: 'createTime', format: 'datetime', filter: true },
      { key: 'status', options: [{ label: 'A', value: 1 }], filter: { mode: 'condition' } },
      { key: 'nick', filter: { actions: ['like', 'isNull', 'in'] } },
    ])
    expect(text.actions).toEqual(['contains', 'notContains', 'equal', 'notEqual'])
    expect(num.actions).toEqual(['equal', 'notEqual', 'gt', 'gte', 'lt', 'lte'])
    expect(date.actions).toEqual(['equal', 'notEqual', 'gt', 'gte', 'lt', 'lte'])
    expect(sel.actions).toEqual(['equal', 'notEqual'])
    expect(explicit.actions).toEqual(['like', 'isNull', 'in'])
  })

  it('跳过特殊列、无 filter 的列,以及只作搜索项的 hideInTable 列', () => {
    const defs = deriveFilterDefs<Row>([
      { type: 'index' },
      { key: 'name' },
      { key: 'status', filter: true, hideInTable: true },
      { key: 'salary', filter: true },
    ])
    expect(defs.map((d) => d.key)).toEqual(['salary'])
  })

  it('filter.key 覆写过滤键,field 仍是列 key;filter.options 用独立字典键', () => {
    const [def] = deriveFilterDefs<Row>([
      {
        key: 'status',
        options: [{ label: 'A', value: 1 }],
        filter: { key: 'st', options: [{ label: 'B', value: 2 }] },
      },
    ])
    expect(def.key).toBe('st')
    expect(def.field).toBe('status')
    expect(def.optionsKey).toBe('__filter:status')
  })

  it('deriveInitFilters 只播种有 defaultValue 的列', () => {
    const defs = deriveFilterDefs<Row>([
      { key: 'name', filter: true },
      { key: 'status', filter: { defaultValue: v(1) } },
    ])
    expect(deriveInitFilters(defs)).toEqual({ status: v(1) })
  })

  it('deriveInitFilters 跳过条件全空的「不生效」defaultValue,与 useFilters 的补种口径一致', () => {
    const inert: FilterValue = { logic: 'and', conditions: [{ action: 'gt', value: null }] }
    const defs = deriveFilterDefs<Row>([{ key: 'salary', filter: { defaultValue: inert } }])
    expect(deriveInitFilters(defs)).toEqual({})
  })

  it('多级表头(children)里的列同样能声明 filter,与 resizable 的递归口径一致', () => {
    const defs = deriveFilterDefs<Row>([
      {
        key: 'contact',
        title: 'Contact',
        children: [
          { key: 'email', title: 'Email', filter: true },
          { key: 'phone', title: 'Phone', resizable: true },
        ],
      } as SmartTableColumn<Row>,
    ])
    expect(defs.map((d) => d.key)).toEqual(['email'])
  })

  it('未显式声明 actions 时,各列拿到彼此独立的默认动作数组(共享同一个模块级数组会被外部 mutate 污染)', () => {
    const [a, b] = deriveFilterDefs<Row>([
      { key: 'name', filter: true },
      { key: 'status', filter: true },
    ])
    a.actions.push('gt' as never)
    expect(b.actions).not.toContain('gt')
  })
})

describe('useFilters', () => {
  function build(cols: SmartTableColumn<Row>[]) {
    const columns = ref(cols)
    const onChange = vi.fn()
    const defs = () => deriveFilterDefs(columns.value)
    return { columns, onChange, api: useFilters<Row>({ defs, onChange }) }
  }

  it('初始态来自各列 defaultValue', () => {
    const { api } = build([
      { key: 'name', filter: true },
      { key: 'status', filter: { defaultValue: v(1) } },
    ])
    expect(api.state.value).toEqual({ status: v(1) })
    expect(api.activeKeys.value).toEqual(['status'])
  })

  it('setFilter 写入生效值,传 null 或空条件则删键', () => {
    const { api, onChange } = build([{ key: 'name', filter: true }])
    api.setFilter('name', v('a'))
    expect(api.state.value).toEqual({ name: v('a') })
    expect(onChange).toHaveBeenLastCalledWith('name', v('a'), { name: v('a') })

    api.setFilter('name', null)
    expect(api.state.value).toEqual({})
    expect(onChange).toHaveBeenLastCalledWith('name', null, {})

    // 空条件等价于清除,不会留个空壳
    api.setFilter('name', { logic: 'and', conditions: [{ action: 'equal', value: '' }] })
    expect(api.state.value).toEqual({})
  })

  it('同值重复提交不再触发 onChange(面板点确定但没改动)', () => {
    const { api, onChange } = build([{ key: 'name', filter: true }])
    api.setFilter('name', v('a'))
    expect(onChange).toHaveBeenCalledTimes(1)
    api.setFilter('name', v('a'))
    expect(onChange).toHaveBeenCalledTimes(1)
    api.setFilter('name', null)
    api.setFilter('name', null)
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it('clearFilters 恢复各列 defaultValue', () => {
    const { api, onChange } = build([
      { key: 'name', filter: true },
      { key: 'status', filter: { defaultValue: v(1) } },
    ])
    api.setFilter('name', v('a'))
    api.setFilter('status', v(9))
    api.clearFilters()
    expect(api.state.value).toEqual({ status: v(1) })
    expect(onChange).toHaveBeenLastCalledWith('', null, { status: v(1) })
  })

  it('clearFilters 判断「是否真的变了」不受 state 顶层键插入顺序影响', () => {
    const { api, onChange } = build([
      { key: 'a', filter: { defaultValue: v(1) } },
      { key: 'b', filter: { defaultValue: v(2) } },
    ])
    expect(Object.keys(api.state.value)).toEqual(['a', 'b']) // 初始态按声明顺序

    // 删掉 a 再加回来:a 在 state.value 里被重新插入到末尾,顶层键序变成 [b, a],
    // 内容其实跟 deriveInitFilters 重新算出来的 { a, b }(声明顺序)一模一样
    api.setFilter('a', null)
    api.setFilter('a', v(1))
    expect(Object.keys(api.state.value)).toEqual(['b', 'a'])
    expect(api.state.value).toEqual({ a: v(1), b: v(2) })
    onChange.mockClear()

    api.clearFilters()
    expect(onChange).not.toHaveBeenCalled() // 内容没变,键序不同不该被当成「变了」
    expect(api.state.value).toEqual({ a: v(1), b: v(2) })
  })

  it('列定义后追加的过滤列补种一次 defaultValue,用户清掉后不回填', async () => {
    const { columns, api } = build([{ key: 'name', filter: true }])
    columns.value = [...columns.value, { key: 'status', filter: { defaultValue: v(1) } }]
    await nextTick()
    expect(api.state.value).toEqual({ status: v(1) })

    api.setFilter('status', null)
    columns.value = [...columns.value]
    await nextTick()
    expect(api.state.value).toEqual({})
  })
})

describe('useFilters.setMany(模式 2 的「搜索 / 重置」:一次改多列,只触发一次 onChange)', () => {
  const defs = (): FilterDef[] => [
    {
      key: 'a',
      field: 'a',
      optionsKey: 'a',
      mode: 'condition',
      multiple: false,
      type: 'input',
      actions: ['equal'],
    },
    {
      key: 'b',
      field: 'b',
      optionsKey: 'b',
      mode: 'condition',
      multiple: false,
      type: 'input',
      actions: ['equal'],
    },
  ]
  const v = (value: string): FilterValue => ({
    logic: 'and',
    conditions: [{ action: 'equal', value }],
  })

  it('补丁里的键一次生效,onChange 只调一次(key 为空串、value 为 null,与 clearFilters 同口径),返回 true', () => {
    const calls: Array<[string, unknown, unknown]> = []
    const f = useFilters({ defs, onChange: (k, val, st) => calls.push([k, val, st]) })
    expect(f.setMany({ a: v('1'), b: v('2') })).toBe(true)
    expect(f.state.value).toEqual({ a: v('1'), b: v('2') })
    expect(calls).toHaveLength(1)
    expect(calls[0][0]).toBe('')
    expect(calls[0][1]).toBeNull()
  })

  it('null / 无生效条件的值 = 清掉该键;补丁里没有的键不动', () => {
    const f = useFilters({ defs })
    f.setMany({ a: v('1'), b: v('2') })
    f.setMany({ a: null })
    expect(f.state.value).toEqual({ b: v('2') })
    f.setMany({ b: { logic: 'and', conditions: [{ action: 'equal', value: '' }] } })
    expect(f.state.value).toEqual({})
  })

  it('没有实际变化 → 不触发 onChange,返回 false(调用方要「点搜索总是重查」就自己补一次)', () => {
    let n = 0
    const f = useFilters({ defs, onChange: () => n++ })
    f.setMany({ a: v('1') })
    expect(n).toBe(1)
    expect(f.setMany({ a: v('1'), b: null })).toBe(false)
    expect(n).toBe(1)
  })
})
