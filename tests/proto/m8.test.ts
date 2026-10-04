// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import type { SmartTableParams } from '../../src/index'
import {
  RANGE_ERROR,
  fetchStates,
  latencyOf,
  validateRange,
} from '../../playground/prototype/backends/m8-states'
import { MOCK_DELAY } from '../../playground/prototype/fetcher'
import { tableOf } from './m7-tableOf'
import { mountApp, useAppStubs } from './_mount'

// 模块 8「加载与错误处理」:immediate:false 首屏空状态;后端规则(日期范围 > 1 年 → 400;奇数页慢偶数页快);有条件时的自定义空状态。
useAppStubs()
const range = (lo: string, hi: string) =>
  ({
    page: 1,
    pageSize: 100,
    filters: [
      {
        field: 'bizDate',
        logic: 'and',
        conditions: [
          { action: 'gte', value: lo },
          { action: 'lte', value: hi },
        ],
      },
    ],
  }) as unknown as SmartTableParams
const settle = async () => {
  for (let i = 0; i < 4; i++) await flushPromises()
}

describe('m8 后端规则(backends/m8-states.ts)', () => {
  it('latency:奇数页 750ms、偶数页 300ms', () => {
    expect([1, 2, 3, 4].map(latencyOf)).toEqual([750, 300, 750, 300])
  })
  it('validateRange:跨度 > 365 天抛 400 文案;恰好 365 天、只有一端、别的字段都放行', () => {
    expect(() => validateRange(range('2025-01-01', '2026-09-29'))).toThrow(RANGE_ERROR)
    expect(RANGE_ERROR).toBe('请求失败(400):日期范围过大,请缩小到 1 年以内')
    expect(() => validateRange(range('2025-09-29', '2026-09-29'))).not.toThrow() // 365 天
    expect(() => validateRange(range('2025-09-28', '2026-09-29'))).toThrow() // 366 天
    expect(() =>
      validateRange({
        page: 1,
        pageSize: 100,
        filters: [
          { field: 'bizDate', logic: 'and', conditions: [{ action: 'gte', value: '2020-01-01' }] },
        ],
      } as unknown as SmartTableParams),
    ).not.toThrow()
    expect(() => validateRange({ page: 1, pageSize: 100 } as SmartTableParams)).not.toThrow()
  })
  it('fetchStates:正常查询分页;超范围 reject', async () => {
    MOCK_DELAY.ms = 0
    const ok = await fetchStates(range('2026-09-01', '2026-09-30'))
    expect(ok.items.length).toBeGreaterThan(0)
    expect(ok.items.every((r) => r.bizDate >= '2026-09-01' && r.bizDate <= '2026-09-30')).toBe(true)
    await expect(fetchStates(range('2020-01-01', '2026-09-29'))).rejects.toThrow('日期范围过大')
  })
})

describe('模块 8 页面', () => {
  it('immediate:false:首屏没有请求,表体是官方 NEmpty「无数据」;search() 才出数据', async () => {
    const w = await mountApp(8)
    await settle()
    const st = tableOf(w)
    expect(st.props('immediate')).toBe(false)
    expect(st.vm.rows).toHaveLength(0)
    expect(document.querySelector('.n-empty')?.textContent).toContain('无数据')
    expect(document.querySelector('.n-empty .n-button')).toBeNull() // 没有条件 → 没有「清除条件」
    await st.vm.search()
    await settle()
    expect(st.vm.rows).toHaveLength(100)
    w.unmount()
  })

  it('请求失败:保留旧行、页码退回,message.error 出库抛的文案', async () => {
    const w = await mountApp(8)
    await settle()
    const st = tableOf(w)
    await st.vm.search()
    await settle()
    st.vm.setFilter('bizDate', {
      logic: 'and',
      conditions: [
        { action: 'gte', value: '2020-01-01' },
        { action: 'lte', value: '2026-09-29' },
      ],
    })
    await settle()
    expect(document.body.textContent).toContain(RANGE_ERROR)
    expect(st.vm.rows).toHaveLength(100) // 旧行还在
    expect(st.vm.pagination.page).toBe(1)
    w.unmount()
  })

  it('有查询条件且无结果:#empty 换成「没有符合条件的单据」+「清除条件」,点了清掉条件并重查', async () => {
    const w = await mountApp(8)
    await settle()
    const st = tableOf(w)
    st.vm.setFilter('no', {
      logic: 'and',
      conditions: [{ action: 'contains', value: 'ZZZZ-不存在' }],
    })
    await settle()
    expect(st.vm.rows).toHaveLength(0)
    const empty = document.querySelector('.n-empty') as HTMLElement
    expect(empty.textContent).toContain('没有符合条件的单据')
    const btn = [...empty.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('清除条件'),
    ) as HTMLElement
    expect(btn).toBeTruthy()
    btn.click()
    await settle()
    expect(st.vm.rows).toHaveLength(100)
    w.unmount()
  })
})
