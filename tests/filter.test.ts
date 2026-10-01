import { describe, expect, it } from 'vitest'
import {
  actionValueKind,
  activeConditions,
  applyFilters,
  defaultFilterSerializer,
  filterValueToOptions,
  isFilterActive,
  isValuelessAction,
  matchCondition,
  matchFilterValue,
  NO_VALUE_ACTIONS,
  optionsToFilterValue,
} from '../src/filter'
import type { FilterAction, FilterValue } from '../src/types'

function cond(action: FilterAction, value: unknown) {
  return { action, value }
}
function val(logic: 'and' | 'or', ...conds: Array<{ action: FilterAction; value: unknown }>): FilterValue {
  return { logic, conditions: conds }
}

describe('matchCondition', () => {
  it('equal / notEqual 跨字符串与数字(表单值常是字符串)', () => {
    expect(matchCondition(cond('equal', '3'), 3)).toBe(true)
    expect(matchCondition(cond('equal', 3), '3')).toBe(true)
    expect(matchCondition(cond('notEqual', 3), 4)).toBe(true)
    expect(matchCondition(cond('equal', false), false)).toBe(true)
    expect(matchCondition(cond('equal', true), false)).toBe(false)
  })

  it('contains / notContains 忽略大小写', () => {
    expect(matchCondition(cond('contains', 'AB'), 'xxabyy')).toBe(true)
    expect(matchCondition(cond('notContains', 'zz'), 'xxabyy')).toBe(true)
    expect(matchCondition(cond('contains', 'a'), 123)).toBe(false)
  })

  it('大小比较:数字按数值,字符串按字典序', () => {
    expect(matchCondition(cond('gt', 10), 11)).toBe(true)
    expect(matchCondition(cond('gt', 10), '9')).toBe(false) // 数值比较,不是 '9' > '10'
    expect(matchCondition(cond('gte', 10), 10)).toBe(true)
    expect(matchCondition(cond('lt', 10), 9)).toBe(true)
    expect(matchCondition(cond('lte', 10), 10)).toBe(true)
    expect(matchCondition(cond('gt', 'b'), 'c')).toBe(true)
  })

  it('空单元格:notEqual / notContains 为真,其余为假', () => {
    expect(matchCondition(cond('equal', 1), null)).toBe(false)
    expect(matchCondition(cond('notEqual', 1), null)).toBe(true)
    expect(matchCondition(cond('contains', 'a'), undefined)).toBe(false)
    expect(matchCondition(cond('notContains', 'a'), undefined)).toBe(true)
    expect(matchCondition(cond('gt', 1), null)).toBe(false)
  })

  it('过滤值是纯日期串时按「整天」比较,而不是时间戳点', () => {
    const cell = '2024-03-05T08:30:00.000Z'
    expect(matchCondition(cond('equal', '2024-03-05'), cell)).toBe(true)
    expect(matchCondition(cond('equal', '2024-03-06'), cell)).toBe(false)
    expect(matchCondition(cond('notEqual', '2024-03-05'), cell)).toBe(false)
    // 大于当天 = 当天结束之后;大于等于当天 = 当天零点起
    expect(matchCondition(cond('gt', '2024-03-05'), cell)).toBe(false)
    expect(matchCondition(cond('gte', '2024-03-05'), cell)).toBe(true)
    expect(matchCondition(cond('lt', '2024-03-05'), cell)).toBe(false)
    expect(matchCondition(cond('lte', '2024-03-05'), cell)).toBe(true)
    expect(matchCondition(cond('gt', '2024-03-04'), cell)).toBe(true)
  })

  it('整天边界按本地时区锚定,与 formatDate/formatDatetime 的展示基准一致 —— 不按 UTC 零点切', () => {
    // 单元格是不带时区偏移的裸 datetime 串(后端直出的常见形状):Date.parse 按运行环境
    // 本地时区解析,「等于该单元格本地日历日」这条不变式在任意时区下都应成立 —— 这才是
    // 用户在表格里实际看到的那一行(formatDatetime 同样用本地时间渲染)。
    const originalTZ = process.env.TZ
    try {
      for (const tz of ['Asia/Shanghai', 'Etc/GMT+11', 'Pacific/Kiritimati']) {
        process.env.TZ = tz
        const cell = '2024-03-05T02:00:00'
        expect(matchCondition(cond('equal', '2024-03-05'), cell)).toBe(true)
        expect(matchCondition(cond('equal', '2024-03-06'), cell)).toBe(false)
        expect(matchCondition(cond('gte', '2024-03-05'), cell)).toBe(true)
        expect(matchCondition(cond('lt', '2024-03-05'), cell)).toBe(false)
      }
    } finally {
      process.env.TZ = originalTZ
    }
  })

  it('过滤值按 UTC 锚定、单元格按本地解析的旧实现会漂移的场景:东半球时区下,裸 datetime 串接近午夜也要按本地日历日匹配', () => {
    // 复现:TZ=Asia/Shanghai(UTC+8)时,'2024-03-05T02:00:00' 本地是 3 月 5 日凌晨,
    // 但当年若按「过滤值锚 UTC 零点、单元格用 Date.parse 的本地时间」两套基准比较,
    // 换算成 UTC 是 3 月 4 日 18:00,落在 UTC 的 3 月 5 日区间之外,会被误判成不匹配。
    const originalTZ = process.env.TZ
    try {
      process.env.TZ = 'Asia/Shanghai'
      const cell = '2024-03-05T02:00:00'
      expect(matchCondition(cond('equal', '2024-03-05'), cell)).toBe(true)
    } finally {
      process.env.TZ = originalTZ
    }
  })

  it('dateValueFormat 改成 yyyy/MM/dd 后,过滤值按同一种形状解析,整天语义不失效', () => {
    const originalTZ = process.env.TZ
    try {
      // 固定时区:cellTs(08:30 UTC)在极端时区(如西 9 区以西)会跨到本地日历的前一天,
      // 与本用例要验证的「格式解析」是两回事,这里用 Asia/Shanghai 避免那种跨天噪音。
      process.env.TZ = 'Asia/Shanghai'
      const cell = '2024-03-05T08:30:00.000Z'
      expect(matchCondition(cond('equal', '2024/03/05'), cell, 'yyyy/MM/dd')).toBe(true)
      expect(matchCondition(cond('equal', '2024/03/06'), cell, 'yyyy/MM/dd')).toBe(false)
      expect(matchCondition(cond('gte', '2024/03/05'), cell, 'yyyy/MM/dd')).toBe(true)
      // 不传 dateValueFormat 时按缺省 'yyyy-MM-dd' 解析,yyyy/MM/dd 形状的值解析不出来,
      // 退回标量比较(旧行为,不会比不做这个功能更差)
      expect(matchCondition(cond('equal', '2024/03/05'), cell)).toBe(false)
    } finally {
      process.env.TZ = originalTZ
    }
  })

  it('无法按 dateValueFormat 解析出 yyyy/MM/dd 三个 token 时,dayRange 放弃,退回标量比较', () => {
    expect(matchCondition(cond('equal', '2024-03-05'), '2024-03-05T08:30:00.000Z', 'yy-MM-dd')).toBe(false)
  })

  it('未识别的 action 视为不匹配,而不是放行全部行', () => {
    expect(matchCondition({ action: 'bogus' as FilterAction, value: 1 }, 1)).toBe(false)
    expect(matchCondition({ action: 'bogus' as FilterAction, value: 1 }, 999)).toBe(false)
  })

  it('数组单元格的 contains 按元素匹配,不把整个数组拼接成字符串比较', () => {
    expect(matchCondition(cond('contains', '1,2'), [1, 22, 3])).toBe(false)
    expect(matchCondition(cond('contains', '22'), [1, 22, 3])).toBe(true)
    expect(matchCondition(cond('notContains', '1,2'), [1, 22, 3])).toBe(true)
  })
})

describe('matchFilterValue', () => {
  it('and 全中,or 任一中', () => {
    const v = (logic: 'and' | 'or') => val(logic, cond('gt', 5), cond('lt', 3))
    expect(matchFilterValue(v('and'), 10)).toBe(false)
    expect(matchFilterValue(v('or'), 10)).toBe(true)
    expect(matchFilterValue(v('or'), 4)).toBe(false)
  })

  it('值为空的条件不参与求值;全空 = 未过滤,放行', () => {
    expect(activeConditions(val('and', cond('contains', ''), cond('equal', null)))).toEqual([])
    expect(matchFilterValue(val('and', cond('contains', '')), 'anything')).toBe(true)
    // 0 / false 是有效值,不算空
    expect(activeConditions(val('and', cond('equal', 0), cond('equal', false)))).toHaveLength(2)
  })

  it('isFilterActive 与 activeConditions 口径一致', () => {
    expect(isFilterActive(null)).toBe(false)
    expect(isFilterActive(val('and', cond('equal', '')))).toBe(false)
    expect(isFilterActive(val('and', cond('equal', 1)))).toBe(true)
  })
})

describe('applyFilters', () => {
  interface Row {
    name: string
    status: number
    salary: number
  }
  const rows: Row[] = [
    { name: 'alice', status: 1, salary: 9000 },
    { name: 'bob', status: 2, salary: 5000 },
    { name: 'carol', status: 1, salary: 12000 },
  ]
  const fields = [
    { key: 'name', field: 'name' },
    { key: 'status', field: 'status' },
    { key: 'salary', field: 'salary' },
  ]

  it('无生效过滤时原样返回', () => {
    expect(applyFilters(rows, fields, {})).toBe(rows)
    expect(applyFilters(rows, fields, { name: val('and', cond('contains', '')) })).toBe(rows)
  })

  it('列间恒为「与」,列内按 logic', () => {
    const out = applyFilters(rows, fields, {
      status: val('or', cond('equal', 1)),
      salary: val('and', cond('gt', 10000)),
    })
    expect(out.map((r) => r.name)).toEqual(['carol'])
  })

  it('勾选多个选项 = 若干 equal 取「或」', () => {
    const value = optionsToFilterValue([1, 2])!
    expect(value.logic).toBe('or')
    expect(applyFilters(rows, fields, { status: value })).toHaveLength(3)
    expect(applyFilters(rows, fields, { status: optionsToFilterValue([2])! })).toHaveLength(1)
    expect(optionsToFilterValue([])).toBeNull()
  })

  it('过滤键与数据字段可以不同(filter.key 覆写时)', () => {
    const out = applyFilters(rows, [{ key: 'q', field: 'name' }], { q: val('and', cond('contains', 'car')) })
    expect(out.map((r) => r.name)).toEqual(['carol'])
  })

  it('自定义 filter 接管匹配', () => {
    const out = applyFilters(rows, [{ key: 'name', field: 'name', filter: (_v, row) => row.salary < 6000 }], {
      name: val('and', cond('contains', 'zzz')),
    })
    expect(out.map((r) => r.name)).toEqual(['bob'])
  })
})

describe('filterValueToOptions', () => {
  it('是 optionsToFilterValue 的逆运算,并忽略非 equal 条件', () => {
    expect(filterValueToOptions(optionsToFilterValue([1, 'a']))).toEqual([1, 'a'])
    expect(filterValueToOptions(val('or', cond('equal', 1), cond('gt', 5)))).toEqual([1])
    expect(filterValueToOptions(null)).toEqual([])
  })
})

describe('defaultFilterSerializer', () => {
  it('产出 { filters: [...] },并剔除空条件与空列', () => {
    expect(
      defaultFilterSerializer({
        name: val('and', cond('contains', 'ali'), cond('equal', '')),
        status: val('or'),
      }),
    ).toEqual({
      filters: [{ field: 'name', logic: 'and', conditions: [cond('contains', 'ali')] }],
    })
  })

  it('全空时不产出 filters 键(避免给后端传空数组)', () => {
    expect(defaultFilterSerializer({})).toEqual({})
    expect(defaultFilterSerializer({ name: val('and', cond('equal', null)) })).toEqual({})
  })
})

describe('新增 7 个操作符', () => {
  it('isNull / isNotNull:空值 = null / undefined / 空白串 / 空数组;0 与 false 不算空;不需要值', () => {
    for (const empty of [null, undefined, '', '   ', []]) {
      expect(matchCondition(cond('isNull', null), empty)).toBe(true)
      expect(matchCondition(cond('isNotNull', null), empty)).toBe(false)
    }
    for (const filled of [0, false, 'x', [1]]) {
      expect(matchCondition(cond('isNull', null), filled)).toBe(false)
      expect(matchCondition(cond('isNotNull', null), filled)).toBe(true)
    }
  })

  it('startsWith / endsWith:忽略大小写;空单元格不匹配', () => {
    expect(matchCondition(cond('startsWith', 'AL'), 'alice')).toBe(true)
    expect(matchCondition(cond('startsWith', 'ce'), 'alice')).toBe(false)
    expect(matchCondition(cond('endsWith', 'CE'), 'alice')).toBe(true)
    expect(matchCondition(cond('endsWith', 'al'), 'alice')).toBe(false)
    expect(matchCondition(cond('startsWith', 'a'), null)).toBe(false)
    expect(matchCondition(cond('endsWith', 'a'), undefined)).toBe(false)
  })

  it('like:% 任意长度、_ 单个字符,整串匹配、忽略大小写;正则元字符按字面量', () => {
    expect(matchCondition(cond('like', 'ali%'), 'Alice')).toBe(true)
    expect(matchCondition(cond('like', '%ice'), 'Alice')).toBe(true)
    expect(matchCondition(cond('like', 'a_ice'), 'alice')).toBe(true)
    expect(matchCondition(cond('like', 'a_ice'), 'aice')).toBe(false)
    expect(matchCondition(cond('like', 'lic'), 'alice')).toBe(false) // 整串匹配,不是包含
    expect(matchCondition(cond('like', 'a.c'), 'abc')).toBe(false) // . 是字面量
    expect(matchCondition(cond('like', 'a.c'), 'a.c')).toBe(true)
    expect(matchCondition(cond('like', '%'), null)).toBe(false)
  })

  it('like:另一个正则元字符(括号)按字面量,不是分组语法', () => {
    expect(matchCondition(cond('like', 'a(b)c'), 'abc')).toBe(false)
    expect(matchCondition(cond('like', 'a(b)c'), 'a(b)c')).toBe(true)
  })

  it('like:% 能匹配跨「换行」的内容(等价于旧正则实现的 dotAll)', () => {
    expect(matchCondition(cond('like', 'a%c'), 'a\nb\nc')).toBe(true)
    expect(matchCondition(cond('like', 'a_c'), 'a\nc')).toBe(true) // _ 本身也匹配换行这一个字符
  })

  it('like:不走正则回溯,%-heavy pattern 在不匹配输入上也是线性时间,不会卡死(ReDoS 回归)', () => {
    // 旧的「翻译成正则再交给引擎」实现在这类 pattern 上会指数级回溯(k=10 时单次调用 ~40s)。
    // 这里不断言具体耗时,调用本身能在测试超时内返回就是线性实现的证明。
    const pattern = '%a'.repeat(10) + '%b'
    const cell = 'a'.repeat(40)
    expect(matchCondition(cond('like', pattern), cell)).toBe(false)
  })

  it('in / notIn:值是数组,命中任一项即 in;空单元格时 notIn 为真;值不是数组则 in 为假', () => {
    expect(matchCondition(cond('in', [1, 2]), 2)).toBe(true)
    expect(matchCondition(cond('in', [1, 2]), '2')).toBe(true) // 沿用 equal 的跨类型
    expect(matchCondition(cond('in', [1, 2]), 3)).toBe(false)
    expect(matchCondition(cond('notIn', [1, 2]), 3)).toBe(true)
    expect(matchCondition(cond('notIn', [1, 2]), 1)).toBe(false)
    expect(matchCondition(cond('in', [1, 2]), null)).toBe(false)
    expect(matchCondition(cond('notIn', [1, 2]), null)).toBe(true)
    expect(matchCondition(cond('in', 'x'), 'x')).toBe(false)
  })

  it('notIn 的值不是数组(脏数据)时按不匹配处理,与 in 的 fail-closed 口径一致,不会放行全部行', () => {
    expect(matchCondition(cond('notIn', 'x'), 'x')).toBe(false)
    expect(matchCondition(cond('notIn', 'x'), 'y')).toBe(false)
  })
})

describe('无值算子(C4)', () => {
  it('NO_VALUE_ACTIONS / isValuelessAction / actionValueKind', () => {
    expect([...NO_VALUE_ACTIONS]).toEqual(['isNull', 'isNotNull'])
    expect(isValuelessAction('isNull')).toBe(true)
    expect(isValuelessAction('equal')).toBe(false)
    expect(actionValueKind('isNotNull')).toBe('none')
    expect(actionValueKind('in')).toBe('array')
    expect(actionValueKind('notIn')).toBe('array')
    expect(actionValueKind('contains')).toBe('scalar')
  })

  it('值为空的无值算子仍算「生效」:不被 activeConditions 丢掉,也进序列化与求值', () => {
    const v = val('and', cond('isNull', null))
    expect(activeConditions(v)).toEqual([cond('isNull', null)])
    expect(isFilterActive(v)).toBe(true)
    expect(matchFilterValue(v, null)).toBe(true)
    expect(matchFilterValue(v, 'x')).toBe(false)
    expect(defaultFilterSerializer({ name: v })).toEqual({
      filters: [{ field: 'name', logic: 'and', conditions: [cond('isNull', null)] }],
    })
  })

  it('有值类算子的空值仍被丢弃(口径不变);空数组的 in 也不生效', () => {
    expect(activeConditions(val('and', cond('equal', ''), cond('in', [])))).toEqual([])
  })
})
