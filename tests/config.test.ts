import { describe, expect, it } from 'vitest'
import { createApp, ref } from 'vue'
import {
  BUILTIN_DEFAULTS,
  SMART_TABLE_DEFAULTS,
  resolveDefaults,
  useSmartTableDefaults,
} from '../src/config'
import { ACTION_LABEL_KEY, defaultLabels, mergeLabels, zhCNLabels } from '../src/labels'
import type { FilterAction, SmartTableLabels } from '../src/types'

describe('resolveDefaults 优先级', () => {
  it('不注入 → 全部用内置兜底', () => {
    expect(resolveDefaults()).toEqual(BUILTIN_DEFAULTS)
    expect(resolveDefaults(null)).toEqual(BUILTIN_DEFAULTS)
  })

  it('注入的字段覆盖兜底,未给的字段保持兜底', () => {
    const r = resolveDefaults({ align: 'left', indexWidth: 80 })
    expect(r.align).toBe('left')
    expect(r.indexWidth).toBe(80)
    expect(r.titleAlign).toBe('center') // 未给 → 兜底
    expect(r.pageSizes).toEqual([100, 500, 1000]) // 内置默认每页条数
  })

  it('undefined 字段不得覆盖兜底', () => {
    const r = resolveDefaults({ align: undefined, emptyText: 'N/A' })
    expect(r.align).toBe('center')
    expect(r.emptyText).toBe('N/A')
  })

  it('开关类默认值:列宽拖拽默认关,表头过滤默认开', () => {
    // 两者语义相反是有意的:列宽拖拽属于增强,过滤要列上声明了才出现,
    // filterable 只作为「一键全关」的总闸。
    expect(BUILTIN_DEFAULTS.resizable).toBe(false)
    expect(BUILTIN_DEFAULTS.filterable).toBe(true)
    expect(resolveDefaults({ resizable: true, filterable: false })).toMatchObject({
      resizable: true,
      filterable: false,
    })
  })

  it('tag 部分合并:只给 size,bordered 仍兜底', () => {
    const r = resolveDefaults({ tag: { size: 'medium' } })
    expect(r.tag).toEqual({ size: 'medium', bordered: false })
  })
})

describe('useSmartTableDefaults 注入接线', () => {
  function withProvide<T>(provide: unknown, fn: () => T): T {
    const app = createApp({})
    if (provide) app.provide(SMART_TABLE_DEFAULTS, provide as never)
    return app.runWithContext(fn)
  }

  it('无 provide → 兜底', () => {
    expect(withProvide(null, () => useSmartTableDefaults()).align).toBe('center')
  })

  it('有 provide → 生效', () => {
    const r = withProvide({ align: 'left' }, () => useSmartTableDefaults())
    expect(r.align).toBe('left')
  })
})

describe('mergeLabels 三层合并', () => {
  it('内置 < 全局 < 实例', () => {
    const merged = mergeLabels({ search: 'S-inst' }, { search: 'S-global', reset: 'R-global' })
    expect(merged.search).toBe('S-inst') // 实例胜
    expect(merged.reset).toBe('R-global') // 全局胜内置
    expect(merged.refresh).toBe('Refresh') // 内置兜底
  })

  it('全局 labels 可来自 ref(渲染期 toValue,此处直接解引用后传入)', () => {
    const global = ref({ search: '搜索' })
    const merged = mergeLabels(undefined, global.value)
    expect(merged.search).toBe('搜索')
  })

  it('partial 显式传 undefined 不覆盖,应退回 global 或 defaultLabels', () => {
    const merged = mergeLabels({ search: undefined }, { reset: 'R-global' })
    expect(merged.search).toBe(defaultLabels.search) // 退回内置默认,不是 undefined
    expect(merged.reset).toBe('R-global')
  })

  it('global 显式传 undefined 不覆盖,应退回 defaultLabels', () => {
    const merged = mergeLabels({ search: 'S-inst' }, { search: undefined })
    expect(merged.search).toBe('S-inst') // partial 有值,还是胜
    const merged2 = mergeLabels(undefined, { search: undefined })
    expect(merged2.search).toBe(defaultLabels.search) // 都没有非 undefined 值,退回内置默认
  })

  it('三层都没传某个键,拿到 defaultLabels', () => {
    const merged = mergeLabels({ reset: 'R-inst' }, { search: 'S-global' })
    expect(merged.refresh).toBe(defaultLabels.refresh)
  })
})

describe('15 个操作符都有文案', () => {
  const ALL: FilterAction[] = [
    'equal',
    'notEqual',
    'contains',
    'notContains',
    'gt',
    'gte',
    'lt',
    'lte',
    'isNull',
    'isNotNull',
    'like',
    'startsWith',
    'endsWith',
    'in',
    'notIn',
  ]
  it('ACTION_LABEL_KEY 覆盖全部操作符,且每个键在英文默认与中文包里都有非空值', () => {
    expect(Object.keys(ACTION_LABEL_KEY).sort()).toEqual([...ALL].sort())
    for (const a of ALL) {
      expect(defaultLabels[ACTION_LABEL_KEY[a]]).toBeTruthy()
      expect(zhCNLabels[ACTION_LABEL_KEY[a]]).toBeTruthy()
    }
  })
})

describe('labels 约定(D9):新增键可选、英文默认与中文包保持完整', () => {
  it('defaultLabels 与 zhCNLabels 的键集合完全一致且没有空值(之后每个 Task 加键时两处都要补,漏一处这里变红)', () => {
    expect(Object.keys(zhCNLabels).sort()).toEqual(Object.keys(defaultLabels).sort())
    for (const [k, v] of Object.entries(defaultLabels)) expect(v, `defaultLabels.${k}`).toBeTruthy()
    for (const [k, v] of Object.entries(zhCNLabels)) expect(v, `zhCNLabels.${k}`).toBeTruthy()
  })

  it('2.1.1 宿主写的完整 labels 对象(没有任何新键)仍能通过类型检查,缺的键取英文默认', () => {
    // 这个常量本身就是类型回归测试:只要有任何新增键被写成必填,vue-tsc 会在这里报错(不是 vitest 失败)
    const legacy: SmartTableLabels = {
      search: '查询',
      reset: '重置',
      refresh: '刷新',
      density: '密度',
      densityComfortable: '舒适',
      densityCompact: '紧凑',
      columnSettings: '列设置',
      columnSettingsReset: '恢复默认',
      fixedLeft: '固定到左侧',
      fixedRight: '固定到右侧',
      fixedNone: '取消固定',
      expand: '展开',
      collapse: '收起',
      filter: '过滤',
      filterConfirm: '确定',
      filterReset: '重置',
      filterSelectAll: '全选',
      filterEqual: '等于',
      filterNotEqual: '不等于',
      filterContains: '包含',
      filterNotContains: '不包含',
      filterGt: '大于',
      filterGte: '大于等于',
      filterLt: '小于',
      filterLte: '小于等于',
    }
    const merged = mergeLabels(legacy)
    expect(merged.search).toBe('查询')
    expect(merged.filterIsNull).toBe(defaultLabels.filterIsNull)
  })
})

describe('defaultPageSize / pageSizesGiven(D4)', () => {
  it('不注入:pageSizesGiven 为 false,没有全局 defaultPageSize', () => {
    const r = resolveDefaults()
    expect(r.pageSizes).toEqual([100, 500, 1000])
    expect(r.pageSizesGiven).toBe(false)
    expect(r.defaultPageSize).toBeUndefined()
  })
  it('注入了 pageSizes → pageSizesGiven 为 true;注入 defaultPageSize 原样透传', () => {
    expect(resolveDefaults({ pageSizes: [10, 20] })).toMatchObject({
      pageSizes: [10, 20],
      pageSizesGiven: true,
    })
    expect(resolveDefaults({ defaultPageSize: 30 }).defaultPageSize).toBe(30)
    expect(resolveDefaults({ defaultPageSize: 30 }).pageSizesGiven).toBe(false)
  })
})
