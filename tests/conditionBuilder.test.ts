// 模式 2 条件构造器的纯逻辑:容器解析、字段派生(只写 search 的列如何派生 FilterDef)、草稿 ↔ 过滤态、行编辑
import { describe, expect, it } from 'vitest'
import {
  MAX_BUILDER_ROWS,
  RECOMMENDED_ACTIONS,
  addRow,
  blankRow,
  deriveBuilderDefs,
  draftFromState,
  draftMatchesState,
  patchFromDraft,
  removeRow,
  resetPatch,
  resolveSearchContainer,
  rowLead,
  setFieldLogic,
  setRowAction,
  setRowField,
  setRowValue,
  type BuilderDraft,
} from '../src/conditionBuilder'
import { deriveFilterDefs } from '../src/useColumns'
import type { FilterState, SmartTableColumn } from '../src/types'

interface Row {
  code: string
  name: string
  amount: number
  status: string
  at: string
}

const cols: SmartTableColumn<Row>[] = [
  { key: 'code', title: '编码', search: true, filter: true }, // 两个都写:复用列头的 FilterDef
  { key: 'name', title: '名称', search: true }, // 只写 search
  { key: 'amount', title: '金额', search: { type: 'number', label: '金额(元)' } },
  { key: 'status', title: '状态', options: [{ label: '已审核', value: 'ok' }], search: true },
  { key: 'at', title: '日期', search: { type: 'daterange', actions: ['gte', 'lte'] } },
  {
    key: 'memo',
    title: '备注',
    hideInTable: true,
    search: { placeholder: '关键字', props: { maxlength: 20 } },
  }, // 搜索专用列
  { key: 'flag', title: '开关', search: { type: 'switch' } }, // 放不进一行
  { key: 'custom', title: '自定义', search: { render: () => null } }, // 同上
  { key: 'plain', title: '没有 search' },
  { type: 'selection' },
]

describe('resolveSearchContainer:container 优先于 layout', () => {
  it('缺省 card;layout: inline 是旧写法 = none;container 写了就赢(冲突时 layout 被忽略)', () => {
    expect(resolveSearchContainer(undefined)).toBe('card')
    expect(resolveSearchContainer(false)).toBe('card')
    expect(resolveSearchContainer({})).toBe('card')
    expect(resolveSearchContainer({ layout: 'grid' })).toBe('card')
    expect(resolveSearchContainer({ layout: 'inline' })).toBe('none')
    expect(resolveSearchContainer({ container: 'table' })).toBe('table')
    expect(resolveSearchContainer({ container: 'none' })).toBe('none')
    expect(resolveSearchContainer({ container: 'card', layout: 'inline' })).toBe('card')
    expect(resolveSearchContainer({ container: 'table', layout: 'inline' })).toBe('table')
  })
})

describe('RECOMMENDED_ACTIONS(规格 §5.9)', () => {
  it('四种类型的推荐集合', () => {
    expect(RECOMMENDED_ACTIONS.input).toEqual([
      'contains',
      'notContains',
      'equal',
      'notEqual',
      'startsWith',
      'endsWith',
      'like',
      'isNull',
      'isNotNull',
    ])
    expect(RECOMMENDED_ACTIONS.number).toEqual([
      'equal',
      'notEqual',
      'gt',
      'gte',
      'lt',
      'lte',
      'isNull',
      'isNotNull',
    ])
    expect(RECOMMENDED_ACTIONS.date).toEqual(RECOMMENDED_ACTIONS.number)
    expect(RECOMMENDED_ACTIONS.select).toEqual([
      'equal',
      'notEqual',
      'in',
      'notIn',
      'isNull',
      'isNotNull',
    ])
  })
})

describe('deriveBuilderDefs:只写 search 的列如何派生 FilterDef', () => {
  const header = deriveFilterDefs<Row>(cols)
  const { fields, extra } = deriveBuilderDefs<Row>(cols, header)

  it('字段候选 = 声明了 search 且放得进一行的列;switch / render 不进;没有 search 的列不进;顺序按声明', () => {
    expect(fields.map((f) => f.key)).toEqual(['code', 'name', 'amount', 'status', 'at', 'memo'])
  })

  it('同时写了 filter 的列复用列头 FilterDef(同一个过滤键);比较符换成推荐集合', () => {
    const code = fields.find((f) => f.key === 'code')!
    expect(code.field).toBe('code')
    expect(code.actions).toEqual([...RECOMMENDED_ACTIONS.input])
    expect(header.find((h) => h.key === 'code')!.actions).toEqual([
      'contains',
      'notContains',
      'equal',
      'notEqual',
    ]) // 列头自己的默认集合不变
    expect(extra.map((f) => f.key)).not.toContain('code') // 不是「只写 search」的字段,过滤态里本来就有它
  })

  it('只写 search 的列:extra 里,类型取自 search.type / 推断,标题取 search.label ?? 列标题', () => {
    expect(extra.map((f) => f.key)).toEqual(['name', 'amount', 'status', 'at', 'memo'])
    expect(fields.find((f) => f.key === 'name')).toMatchObject({
      type: 'input',
      mode: 'condition',
      title: '名称',
    })
    expect(fields.find((f) => f.key === 'amount')).toMatchObject({
      type: 'number',
      title: '金额(元)',
    })
    expect(fields.find((f) => f.key === 'status')).toMatchObject({
      type: 'select',
      optionsKey: 'status',
    }) // 有字典 → select
    expect(fields.find((f) => f.key === 'at')).toMatchObject({ type: 'date' }) // daterange → date
  })

  it('比较符:search.actions 优先,其次 filter.actions,再次推荐集合', () => {
    expect(fields.find((f) => f.key === 'at')!.actions).toEqual(['gte', 'lte'])
    expect(fields.find((f) => f.key === 'amount')!.actions).toEqual([...RECOMMENDED_ACTIONS.number])
    const c2: SmartTableColumn<Row>[] = [
      { key: 'name', title: 'n', search: true, filter: { actions: ['equal', 'isNull'] } },
    ]
    expect(deriveBuilderDefs<Row>(c2, []).fields[0].actions).toEqual(['equal', 'isNull'])
  })

  it('过滤键 = filter.key ?? 列 key;忽略 search.key(模式 2 走 filterSerializer 的 filters[].field,不是扁平参数)', () => {
    const c: SmartTableColumn<Row>[] = [
      { key: 'name', title: 'n', search: { key: 'nameLike' } },
      { key: 'code', title: 'c', search: true, filter: { key: 'codeKey' } },
    ]
    const defs = deriveBuilderDefs<Row>(c, deriveFilterDefs<Row>(c)).fields
    expect(defs.map((d) => d.key)).toEqual(['name', 'codeKey'])
    expect(defs[0].field).toBe('name')
  })

  it('搜索专用列(hideInTable)照样是字段;placeholder / props 进值控件的 props', () => {
    expect(fields.find((f) => f.key === 'memo')!.props).toEqual({
      placeholder: '关键字',
      maxlength: 20,
    })
  })

  it('search.order 排前面;search.defaultValue(模式 1 的扁平标量)→ 一条初始条件(input 用 contains,其余 equal),也是「重置」的目标', () => {
    const c: SmartTableColumn<Row>[] = [
      { key: 'name', title: 'n', search: { defaultValue: '张' } },
      { key: 'amount', title: 'a', search: { type: 'number', defaultValue: 5, order: 1 } },
      {
        key: 'at',
        title: 't',
        search: { type: 'daterange', defaultValue: ['2024-01-01', '2024-02-01'] },
      }, // 数组不生成
    ]
    const defs = deriveBuilderDefs<Row>(c, []).fields
    expect(defs.map((d) => d.key)).toEqual(['amount', 'name', 'at'])
    expect(defs[0].defaultValue).toEqual({
      logic: 'and',
      conditions: [{ action: 'equal', value: 5 }],
    })
    expect(defs[1].defaultValue).toEqual({
      logic: 'and',
      conditions: [{ action: 'contains', value: '张' }],
    })
    expect(defs[2].defaultValue).toBeNull()
  })

  it('没有任何 search 列 → 空', () => {
    expect(deriveBuilderDefs<Row>([{ key: 'name', title: 'n' }], [])).toEqual({
      fields: [],
      extra: [],
    })
  })
})

describe('草稿 ↔ 过滤态', () => {
  const { fields } = deriveBuilderDefs<Row>(cols, deriveFilterDefs<Row>(cols))
  const state: FilterState = {
    code: {
      logic: 'or',
      conditions: [
        { action: 'contains', value: 'M10' },
        { action: 'contains', value: 'M20' },
      ],
    },
    amount: { logic: 'and', conditions: [{ action: 'gt', value: 100 }] },
    other: { logic: 'and', conditions: [{ action: 'equal', value: 'x' }] }, // 构造器不管的键(只有列头漏斗管)
  }

  it('draftFromState:按字段候选顺序展开成行,or 的 logic 记在字段上;不属于构造器的键不进草稿', () => {
    const d = draftFromState(state, fields)
    expect(d.rows).toEqual([
      { field: 'code', action: 'contains', value: 'M10' },
      { field: 'code', action: 'contains', value: 'M20' },
      { field: 'amount', action: 'gt', value: 100 },
    ])
    expect(d.logic).toEqual({ code: 'or' })
  })

  it('没有任何生效条件 → 一行空白(第一个字段、它的第一个比较符)', () => {
    const d = draftFromState({}, fields)
    expect(d.rows).toEqual([{ field: 'code', action: 'contains', value: null }])
  })

  it('patchFromDraft:只留有值的有值类条件 + 无值算子;其余字段补 null(清掉);单条时 logic 归位 and', () => {
    const draft: BuilderDraft = {
      rows: [
        { field: 'code', action: 'contains', value: 'M10' },
        { field: 'code', action: 'contains', value: '' }, // 没填值:丢弃
        { field: 'name', action: 'isNull', value: null }, // 无值算子:放行
        { field: 'amount', action: 'gt', value: 100 },
        { field: 'amount', action: 'lt', value: 200 },
      ],
      logic: { code: 'or', amount: 'or' },
    }
    const p = patchFromDraft(draft, fields)
    expect(p.code).toEqual({ logic: 'and', conditions: [{ action: 'contains', value: 'M10' }] }) // 只剩一条 → and
    expect(p.name).toEqual({ logic: 'and', conditions: [{ action: 'isNull', value: null }] })
    expect(p.amount).toEqual({
      logic: 'or',
      conditions: [
        { action: 'gt', value: 100 },
        { action: 'lt', value: 200 },
      ],
    })
    expect(p.status).toBeNull()
    expect(Object.keys(p).sort()).toEqual(fields.map((f) => f.key).sort()) // 每个构造器字段一项;没有 other
  })

  it('往返:draftFromState → patchFromDraft 得到原来的 FilterValue(构造器管的那部分)', () => {
    const p = patchFromDraft(draftFromState(state, fields), fields)
    expect(p.code).toEqual(state.code)
    expect(p.amount).toEqual(state.amount)
  })

  it('draftMatchesState:提交草稿会得到的与当前过滤态一致 → true(此时不必重建草稿,免得打乱行序);不一致 → false', () => {
    const d = draftFromState(state, fields)
    expect(draftMatchesState(d, state, fields)).toBe(true)
    expect(draftMatchesState(setRowValue(d, 0, 'zzz'), state, fields)).toBe(false)
    // 草稿里还没填值的空行不影响一致性(它本来就不生效)
    expect(draftMatchesState({ ...d, rows: [...d.rows, blankRow(fields[1])] }, state, fields)).toBe(
      true,
    )
  })

  it('resetPatch:各字段恢复 defaultValue(没有 / 无生效条件 → null)', () => {
    const c: SmartTableColumn<Row>[] = [
      { key: 'name', title: 'n', search: { defaultValue: '张' } },
      { key: 'code', title: 'c', search: true },
    ]
    const defs = deriveBuilderDefs<Row>(c, []).fields
    expect(resetPatch(defs)).toEqual({
      name: { logic: 'and', conditions: [{ action: 'contains', value: '张' }] },
      code: null,
    })
  })
})

describe('行编辑', () => {
  const { fields } = deriveBuilderDefs<Row>(cols, deriveFilterDefs<Row>(cols))
  const base: BuilderDraft = draftFromState({}, fields)

  it('换字段:比较符不再适用 → 重置为新字段的第一个;仍适用 → 保留;值一律清空', () => {
    const d1 = setRowValue(setRowAction(base, 0, 'equal'), 0, 'abc')
    const toName = setRowField(d1, 0, 'name', fields) // name 是 input:equal 仍适用
    expect(toName.rows[0]).toEqual({ field: 'name', action: 'equal', value: null })
    const toAmount = setRowField(setRowAction(base, 0, 'contains'), 0, 'amount', fields) // contains 对 number 不适用
    expect(toAmount.rows[0]).toEqual({ field: 'amount', action: 'equal', value: null })
    expect(setRowField(base, 0, '不存在', fields)).toBe(base)
  })

  it('换比较符:值的形状变了(标量 ↔ 数组 ↔ 无值)才清空', () => {
    const d = setRowValue(base, 0, 'abc') // contains + 标量
    expect(setRowAction(d, 0, 'startsWith').rows[0].value).toBe('abc') // 都是标量:保留
    expect(setRowAction(d, 0, 'isNull').rows[0].value).toBeNull() // 标量 → 无值:清空
    const sel = setRowValue(setRowAction(setRowField(base, 0, 'status', fields), 0, 'in'), 0, [
      'ok',
    ])
    expect(setRowAction(sel, 0, 'notIn').rows[0].value).toEqual(['ok']) // 数组 → 数组:保留
    expect(setRowAction(sel, 0, 'equal').rows[0].value).toBeNull() // 数组 → 标量:清空
  })

  it('加一行:与最后一行同字段 + 第一个比较符;封顶 MAX_BUILDER_ROWS', () => {
    let d = setRowField(base, 0, 'amount', fields)
    d = addRow(d, fields)
    expect(d.rows[1]).toEqual({ field: 'amount', action: 'equal', value: null })
    while (d.rows.length < MAX_BUILDER_ROWS) d = addRow(d, fields)
    expect(addRow(d, fields)).toBe(d)
  })

  it('删一行;删光回到一行空白', () => {
    const two = addRow(base, fields)
    expect(removeRow(two, 0, fields).rows).toHaveLength(1)
    expect(removeRow(base, 0, fields).rows).toEqual([blankRow(fields[0])])
  })

  it('rowLead:第 1 行「条件」;之前有同字段 → 「且 / 或」下拉;不同字段 → 固定「且」', () => {
    let d: BuilderDraft = { rows: [blankRow(fields[0])], logic: {} }
    d = addRow(d, fields) // 同字段
    d = { ...d, rows: [...d.rows, blankRow(fields[1])] } // 另一字段
    expect([0, 1, 2].map((i) => rowLead(d, i))).toEqual(['condition', 'logic', 'and'])
  })

  it('setFieldLogic:每字段一个值,联动该字段全部', () => {
    const d = setFieldLogic(base, 'code', 'or')
    expect(d.logic).toEqual({ code: 'or' })
    expect(setFieldLogic(d, 'name', 'and').logic).toEqual({ code: 'or', name: 'and' })
  })
})
