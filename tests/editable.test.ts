// 可编辑表格的纯逻辑:类型推断(inferEditor)、校验(validateEdit)、改动仓库(createEditStore)。UI 无关,与 filter.ts 同一原则。
import { describe, expect, it } from 'vitest'
import {
  createEditStore,
  fromEditString,
  inferEditor,
  inferEditorInfo,
  isValidDate,
  isValidDatetime,
  toEditString,
  validateEdit,
  validateEditAsync,
} from '../src/editable'
import { defaultLabels, zhCNLabels } from '../src/labels'
import type { SmartTableDataColumn } from '../src/types'

type Row = Record<string, any>
const col = (o: Partial<SmartTableDataColumn<Row>> = {}): SmartTableDataColumn<Row> => ({
  key: 'f',
  ...o,
})
const rows = (...v: unknown[]): Row[] => v.map((x) => ({ f: x }))

describe('inferEditor:优先级 列显式 > 列声明 > 数据值 > 兜底', () => {
  it('① 显式 editor 覆盖一切;editor: false / readonly = 不可编辑', () => {
    expect(inferEditor(col({ editor: 'textarea' }), rows(1, 2))).toBe('textarea')
    expect(
      inferEditor(col({ editor: 'datetime', options: [{ label: 'a', value: 'a' }] }), rows('x')),
    ).toBe('datetime')
    expect(inferEditor(col({ editor: false }), rows('x'))).toBeNull()
    expect(inferEditor(col({ readonly: true, editor: 'input' }), rows('x'))).toBeNull()
    expect(inferEditorInfo(col({ readonly: true }), rows('x')).via).toBe('readonly')
    expect(inferEditorInfo(col({ editor: 'select' }), rows('x')).via).toBe('editor')
  })

  it('② 列声明:options → select;format date / datetime → date / datetime;format money → number', () => {
    const o = inferEditorInfo(col({ options: [{ label: 'a', value: 1 }] }), rows('x'))
    expect(o).toEqual({ kind: 'select', via: 'options' })
    expect(inferEditor(col({ format: 'date' }), rows(1))).toBe('date')
    expect(inferEditor(col({ format: 'datetime' }), rows(1))).toBe('datetime')
    expect(inferEditorInfo(col({ format: 'money' }), rows('x'))).toEqual({
      kind: 'number',
      via: 'format',
    })
  })

  it('② 函数 format 看不出类型:落到数据值推断', () => {
    expect(inferEditor(col({ format: (v) => String(v) }), rows(12))).toBe('number')
    expect(inferEditor(col({ format: (v) => String(v) }), rows('abc'))).toBe('input')
  })

  it('③ 数据值:boolean → checkbox;number → number;Date → date', () => {
    expect(inferEditor(col(), rows(true))).toBe('checkbox')
    expect(inferEditor(col(), rows(false))).toBe('checkbox')
    expect(inferEditor(col(), rows(12.5))).toBe('number')
    expect(inferEditor(col(), rows(0))).toBe('number') // 0 / 1 不当布尔
    expect(inferEditor(col(), rows(new Date()))).toBe('date')
  })

  it('③ 数据值:YYYY-MM-DD → date;YYYY-MM-DD HH:mm:ss → datetime;含换行或 > 30 字 → textarea;其余 input', () => {
    expect(inferEditor(col(), rows('2026-06-25'))).toBe('date')
    expect(inferEditor(col(), rows('2026-08-09 13:29:27'))).toBe('datetime')
    expect(inferEditor(col(), rows('第一行\n第二行'))).toBe('textarea')
    expect(inferEditor(col(), rows('x'.repeat(31)))).toBe('textarea')
    expect(inferEditor(col(), rows('x'.repeat(30)))).toBe('input')
    expect(inferEditor(col(), rows('张伟'))).toBe('input')
    expect(inferEditorInfo(col(), rows('张伟')).via).toBe('value')
  })

  it('③ 取该列前 20 行里第一个非空值(跳过 null / undefined / 空串)', () => {
    expect(inferEditor(col(), rows(null, undefined, '', 5))).toBe('number')
    const late = Array.from({ length: 25 }, (_, i) => ({ f: i === 22 ? 5 : '' }))
    expect(inferEditorInfo(col(), late)).toEqual({ kind: 'input', via: 'fallback' }) // 第 23 行超出取样
  })

  it('④ 兜底:全空列 / 不认识的类型 → input', () => {
    expect(inferEditorInfo(col(), [])).toEqual({ kind: 'input', via: 'fallback' })
    expect(inferEditorInfo(col(), rows(null, null))).toEqual({ kind: 'input', via: 'fallback' })
    expect(inferEditor(col(), rows({ a: 1 }))).toBe('input')
  })

  it('自定义单元格(render / 插槽)且没有显式 editor:不可编辑(操作列不会被当成输入框)', () => {
    expect(inferEditor(col({ render: () => 'x' }), rows('a'))).toBeNull()
    expect(inferEditor(col({ render: () => 'x', editor: 'input' }), rows('a'))).toBe('input')
    expect(inferEditorInfo(col(), rows('a'), { customCell: true }).via).toBe('custom')
    expect(
      inferEditor(col({ options: [{ label: 'a', value: 'a' }], render: () => 'x' }), rows('a')),
    ).toBeNull()
  })
})

describe('日期串校验与编辑串互转', () => {
  it('isValidDate / isValidDatetime 校验真实日历(2 月 30 日、25 点不合法)', () => {
    expect(isValidDate('2026-02-28')).toBe(true)
    expect(isValidDate('2026-02-30')).toBe(false)
    expect(isValidDate('2026-2-8')).toBe(false)
    expect(isValidDatetime('2026-08-09 13:29:27')).toBe(true)
    expect(isValidDatetime('2026-08-09 25:00:00')).toBe(false)
    expect(isValidDatetime('2026-08-09')).toBe(false)
  })

  it('toEditString / fromEditString:字符串原样、时间戳与 Date 按原类型还原', () => {
    expect(toEditString('date', '2026-06-25')).toBe('2026-06-25')
    expect(toEditString('date', null)).toBe('')
    const ts = new Date(2026, 5, 25).getTime()
    expect(toEditString('date', ts)).toBe('2026-06-25')
    expect(toEditString('datetime', new Date(2026, 7, 9, 13, 29, 27))).toBe('2026-08-09 13:29:27')
    expect(fromEditString('date', '2026-06-25', 'x')).toBe('2026-06-25')
    expect(fromEditString('date', '2026-06-25', ts)).toBe(ts)
    expect(fromEditString('datetime', '2026-08-09 13:29:27', new Date())).toBeInstanceOf(Date)
    expect(fromEditString('date', '', ts)).toBeNull()
    expect(fromEditString('date', '', 'x')).toBe('')
  })
})

describe('validateEdit', () => {
  const ctx = (c: SmartTableDataColumn<Row>, extra = {}) => ({
    labels: zhCNLabels,
    field: '字段',
    row: {} as Row,
    col: c,
    ...extra,
  })
  const run = (c: SmartTableDataColumn<Row>, kind: any, raw: unknown, extra = {}) =>
    validateEdit(kind, raw, ctx(c, extra))

  it('checkbox 恒合法,转布尔', () => {
    expect(run(col(), 'checkbox', 1)).toEqual({ ok: true, value: true })
    expect(run(col(), 'checkbox', undefined)).toEqual({ ok: true, value: false })
  })

  it('必填:空 / 纯空白不通过,文案按控件类型区分「请输入 / 请选择」', () => {
    const c = col({ rules: { required: true } })
    expect(run(c, 'input', '  ')).toEqual({ ok: false, message: '请输入字段' })
    expect(run(c, 'select', '')).toEqual({ ok: false, message: '请选择字段' })
    expect(run(c, 'date', null)).toEqual({ ok: false, message: '请选择字段' })
    expect(run(c, 'number', null)).toEqual({ ok: false, message: '请输入字段' })
    expect(run(c, 'input', 'ok')).toEqual({ ok: true, value: 'ok' })
  })

  it('非必填的空:number → null,其余 → 空串', () => {
    expect(run(col(), 'number', null)).toEqual({ ok: true, value: null })
    expect(run(col(), 'input', '')).toEqual({ ok: true, value: '' })
  })

  it('number:格式 / int / min / max;money 保留 2 位', () => {
    expect(run(col(), 'number', 'abc')).toEqual({ ok: false, message: '请输入有效数字' })
    expect(run(col({ rules: { int: true } }), 'number', 1.5)).toEqual({
      ok: false,
      message: '字段必须是整数',
    })
    expect(run(col({ rules: { min: 0 } }), 'number', -1)).toEqual({
      ok: false,
      message: '字段不能小于 0',
    })
    expect(run(col({ rules: { max: 10 } }), 'number', 11)).toEqual({
      ok: false,
      message: '字段不能大于 10',
    })
    expect(run(col({ rules: { int: true, min: 0 } }), 'number', '12')).toEqual({
      ok: true,
      value: 12,
    })
    expect(run(col({ format: 'money' }), 'number', 1.005 * 1000)).toEqual({
      ok: true,
      value: 1005,
    })
    expect(run(col({ format: 'money' }), 'number', 1.239)).toEqual({ ok: true, value: 1.24 })
  })

  it('date / datetime 格式', () => {
    expect(run(col(), 'date', '2026-13-01')).toEqual({
      ok: false,
      message: '日期格式应为 YYYY-MM-DD',
    })
    expect(run(col(), 'date', '2026-01-31')).toEqual({ ok: true, value: '2026-01-31' })
    expect(run(col(), 'datetime', '2026-01-31')).toEqual({
      ok: false,
      message: '日期时间格式应为 YYYY-MM-DD HH:mm:ss',
    })
    expect(run(col(), 'datetime', '2026-01-31 08:00:00')).toEqual({
      ok: true,
      value: '2026-01-31 08:00:00',
    })
  })

  it('select:值必须在 options 里,返回 option 自己的值(数字 / 布尔不被字符串化)', () => {
    const options = [
      { label: 'A', value: 1 },
      { label: 'B', value: 2 },
    ]
    expect(run(col(), 'select', 2, { options })).toEqual({ ok: true, value: 2 })
    expect(run(col(), 'select', '2', { options })).toEqual({ ok: true, value: 2 })
    expect(run(col(), 'select', 9, { options })).toEqual({ ok: false, message: '请选择字段' })
  })

  it('textarea 去掉尾部空白;input 去首尾空白', () => {
    expect(run(col(), 'textarea', 'a\nb \n\n')).toEqual({ ok: true, value: 'a\nb' })
    expect(run(col(), 'input', ' x ')).toEqual({ ok: true, value: 'x' })
  })

  it('pattern / validator(自定义返回字符串 = 不通过的提示)', () => {
    const c = col({ rules: { pattern: /^M\d+$/ } })
    expect(run(c, 'input', 'x1')).toEqual({ ok: false, message: '字段格式不正确' })
    expect(run(c, 'input', 'M12')).toEqual({ ok: true, value: 'M12' })
    const v = col({ rules: { validator: (val) => (val === 'bad' ? '不能是 bad' : true) } })
    expect(run(v, 'input', 'bad')).toEqual({ ok: false, message: '不能是 bad' })
    expect(run(v, 'input', 'good')).toEqual({ ok: true, value: 'good' })
  })

  it('文案走 labels:英文包', () => {
    const c = col({ rules: { required: true } })
    expect(validateEdit('input', '', { ...ctx(c), labels: defaultLabels })).toEqual({
      ok: false,
      message: 'Please enter 字段',
    })
  })
})

describe('createEditStore:草稿 / 新增 / 待删除 / 计数 / 放弃', () => {
  const base = (): Row[] => [
    { id: 1, name: 'a', price: 10 },
    { id: 2, name: 'b', price: 20 },
    { id: 3, name: 'c', price: 30 },
  ]
  const mk = () => createEditStore<Row>((r) => r.id)

  it('改一个格:记原值,计数 +1;再改同一格不重复计;改回原值标记消失', () => {
    const s = mk()
    const [r1] = base()
    expect(s.count.value).toBe(0)
    expect(s.set(r1, 'name', 'x')).toEqual({ changed: true, oldValue: 'a' })
    expect(s.count.value).toBe(1)
    expect(s.isDirtyCell('1', 'name')).toBe(true)
    expect(s.set(r1, 'name', 'y')).toEqual({ changed: true, oldValue: 'x' })
    expect(s.count.value).toBe(1)
    expect(s.set(r1, 'name', 'y').changed).toBe(false)
    s.set(r1, 'name', 'a') // 改回原值
    expect(s.isDirtyCell('1', 'name')).toBe(false)
    expect(s.count.value).toBe(0)
  })

  it('null / undefined / 空串视为相等(清空一个本来就空的格不算改动)', () => {
    const s = mk()
    const r = { id: 9, memo: '' }
    expect(s.set(r, 'memo', null).changed).toBe(false)
    expect(s.count.value).toBe(0)
  })

  it('overlay:带草稿的行是拷贝(宿主原行不被改),没草稿的行原样返回', () => {
    const s = mk()
    const data = base()
    s.set(data[0], 'name', 'x')
    const out = s.overlay(data)
    expect(out[0]).not.toBe(data[0])
    expect(out[0].name).toBe('x')
    expect(data[0].name).toBe('a')
    expect(out[1]).toBe(data[1])
  })

  it('新增行:放在最前,不记原值,计数 +1;新增行里改格不重复计', () => {
    const s = mk()
    const data = base()
    const n = s.addNew({ id: 'n1', name: '', price: 0 })
    expect(s.isNew('n1')).toBe(true)
    expect(s.count.value).toBe(1)
    s.set(n, 'name', 'new')
    expect(s.count.value).toBe(1)
    expect(s.overlay(data)[0].name).toBe('new')
    expect(s.overlay(data)).toHaveLength(4)
    expect(s.isDirtyCell('n1', 'name')).toBe(false)
  })

  it('删除所选:新行直接移除(什么都没发生);旧行进待删除(计数 +1,行仍在 overlay 里)', () => {
    const s = mk()
    const data = base()
    const n = s.addNew({ id: 'n1', name: '' })
    s.markDelete([n, data[1]])
    expect(s.isNew('n1')).toBe(false)
    expect(s.isDeleted('2')).toBe(true)
    expect(s.count.value).toBe(1)
    expect(s.overlay(data).map((r) => r.id)).toEqual([1, 2, 3])
  })

  it('待删行里的草稿不计入 N(N = 改格 + 新增 + 待删,待删行不重复计)', () => {
    const s = mk()
    const data = base()
    s.set(data[0], 'name', 'x')
    s.set(data[0], 'price', 99)
    expect(s.count.value).toBe(2)
    s.markDelete([data[0]])
    expect(s.count.value).toBe(1)
  })

  it('changes():updated 带全部草稿值与改格的新旧值;added / removed', () => {
    const s = mk()
    const data = base()
    s.set(data[0], 'name', 'x')
    s.set(data[0], 'price', 11)
    s.addNew({ id: 'n1', name: 'N' })
    s.markDelete([data[2]])
    const c = s.changes()
    expect(c.updated).toEqual([
      {
        row: { id: 1, name: 'x', price: 11 },
        changes: { name: { value: 'x', oldValue: 'a' }, price: { value: 11, oldValue: 10 } },
      },
    ])
    expect(c.added).toEqual([{ id: 'n1', name: 'N' }])
    expect(c.removed).toEqual([data[2]])
  })

  it('changes() 不含待删行的草稿', () => {
    const s = mk()
    const data = base()
    s.set(data[0], 'name', 'x')
    s.markDelete([data[0]])
    const c = s.changes()
    expect(c.updated).toEqual([])
    expect(c.removed).toHaveLength(1)
  })

  it('clear():全部还原(草稿 / 新增 / 待删清空,计数归零)', () => {
    const s = mk()
    const data = base()
    s.set(data[0], 'name', 'x')
    s.addNew({ id: 'n1' })
    s.markDelete([data[1]])
    expect(s.count.value).toBe(3)
    s.clear()
    expect(s.count.value).toBe(0)
    expect(s.overlay(data)).toEqual(data)
  })

  it('clearRow(id):只清掉某一行的草稿(窄档抽屉整行保存用)', () => {
    const s = mk()
    const data = base()
    s.set(data[0], 'name', 'x')
    s.set(data[1], 'name', 'y')
    s.clearRow('1')
    expect(s.count.value).toBe(1)
    expect(s.isDirtyCell('2', 'name')).toBe(true)
  })

  it('currentValue:草稿值优先,否则行上的值', () => {
    const s = mk()
    const data = base()
    s.set(data[0], 'name', 'x')
    expect(s.valueOf(data[0], 'name')).toBe('x')
    expect(s.valueOf(data[1], 'name')).toBe('b')
  })
})

describe('补充:行级只读 / 长度规则 / 异步校验 / 行类型 / 撤销删除', () => {
  it('readonly 函数形式:列级推断不当成只读(按行判断在表格里做),readonly: true 仍是只读', () => {
    expect(inferEditor(col({ readonly: () => true }), rows('x'))).toBe('input')
    expect(inferEditor(col({ readonly: true }), rows('x'))).toBeNull()
  })

  it('rules.minLength / maxLength:按字符数', async () => {
    const lab = { labels: zhCNLabels, field: '字段', row: {} as Row }
    const c = col({ rules: { minLength: 2, maxLength: 4 } })
    expect(validateEdit('input', 'a', { ...lab, col: c })).toEqual({
      ok: false,
      message: '字段至少 2 个字符',
    })
    expect(validateEdit('input', 'abcde', { ...lab, col: c })).toEqual({
      ok: false,
      message: '字段最多 4 个字符',
    })
    expect(validateEdit('input', 'abc', { ...lab, col: c })).toEqual({ ok: true, value: 'abc' })
  })

  it('validateEditAsync:异步 validator(返回 Promise<string | true>),同步规则先于它', async () => {
    const lab = { labels: zhCNLabels, field: '字段', row: { id: 1 } as Row }
    const seen: unknown[] = []
    const c = col({
      rules: {
        required: true,
        validator: async (v, row) => {
          seen.push([v, row.id])
          return v === 'dup' ? '已存在' : true
        },
      },
    })
    expect(await validateEditAsync('input', '', { ...lab, col: c })).toMatchObject({ ok: false })
    expect(seen).toEqual([]) // 必填没过,不会去调异步校验
    expect(await validateEditAsync('input', 'dup', { ...lab, col: c })).toEqual({
      ok: false,
      message: '已存在',
    })
    expect(await validateEditAsync('input', 'new', { ...lab, col: c })).toEqual({
      ok: true,
      value: 'new',
    })
    // 同步 validateEdit 不等 Promise:当通过(异步部分交给 validateEditAsync)
    expect(validateEdit('input', 'dup', { ...lab, col: c })).toEqual({ ok: true, value: 'dup' })
  })

  it('changes().rows:每行一个明确的类型 created / updated / deleted', () => {
    const s = createEditStore<Row>((r) => r.id)
    const data: Row[] = [
      { id: 1, name: 'a' },
      { id: 2, name: 'b' },
    ]
    s.set(data[0], 'name', 'x')
    s.markDelete([data[1]])
    s.addNew({ id: 'n1', name: 'N' })
    const list = s.changes().rows
    expect(list.map((r) => r.type)).toEqual(['created', 'updated', 'deleted'])
    expect(list[0].row).toMatchObject({ id: 'n1' })
    expect(list[1]).toMatchObject({
      type: 'updated',
      row: { id: 1, name: 'x' },
      changes: { name: { value: 'x', oldValue: 'a' } },
    })
    expect(list[2].row).toBe(data[1])
  })

  it('unmarkDelete(撤销删除)后计数回落', () => {
    const s = createEditStore<Row>((r) => r.id)
    const data: Row[] = [{ id: 1 }]
    s.markDelete([data[0]])
    expect(s.count.value).toBe(1)
    s.unmarkDelete('1')
    expect(s.count.value).toBe(0)
    expect(s.isDeleted('1')).toBe(false)
  })
})

describe('多选(值是数组 + options)', () => {
  const opts = [
    { label: 'A', value: 'a' },
    { label: 'B', value: 'b' },
  ]
  it('列有 options 且数据值是数组 → multiselect;值不是数组 → select;显式 editor 优先', () => {
    expect(inferEditorInfo(col({ options: opts }), rows(['a', 'b']))).toEqual({
      kind: 'multiselect',
      via: 'options',
    })
    expect(inferEditor(col({ options: opts }), rows('a'))).toBe('select')
    expect(inferEditor(col({ options: opts, editor: 'select' }), rows(['a']))).toBe('select')
    expect(inferEditor(col({ options: opts, editor: 'multiselect' }), rows('a'))).toBe(
      'multiselect',
    )
  })

  it('校验:数组里每一项都得在 options 里;必填 = 至少选一项;空数组合法(非必填)', () => {
    const lab = { labels: zhCNLabels, field: '标签', row: {} as Row, options: opts }
    expect(validateEdit('multiselect', ['a', 'b'], { ...lab, col: col() })).toEqual({
      ok: true,
      value: ['a', 'b'],
    })
    expect(validateEdit('multiselect', ['a', 'z'], { ...lab, col: col() })).toEqual({
      ok: false,
      message: '请选择标签',
    })
    expect(
      validateEdit('multiselect', [], { ...lab, col: col({ rules: { required: true } }) }),
    ).toEqual({ ok: false, message: '请选择标签' })
    expect(validateEdit('multiselect', [], { ...lab, col: col() })).toEqual({ ok: true, value: [] })
  })

  it('toEditString / 比较:数组值按元素比较(改回原数组 = 没改)', () => {
    const s = createEditStore<Row>((r) => r.id)
    const r: Row = { id: 1, tags: ['a', 'b'] }
    expect(s.set(r, 'tags', ['a', 'b']).changed).toBe(false)
    expect(s.set(r, 'tags', ['a']).changed).toBe(true)
    s.set(r, 'tags', ['a', 'b'])
    expect(s.count.value).toBe(0)
  })
})
