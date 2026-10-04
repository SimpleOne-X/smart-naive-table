import { describe, expect, it } from 'vitest'
import { applyFormat, formatDate, formatDatetime, formatMoney } from '../src/format'

/**
 * 依次切到给定时区跑 fn,结束后恢复。Node 在给 process.env.TZ 赋值时重置时区缓存,同一进程里即可切换;
 * 但 delete process.env.TZ 不会触发重置,所以原来没设 TZ 时写回解析出的系统时区名。
 * 每个时区先断言切换真的生效,防止测试在「切不动时区」的环境里假绿。
 */
function inTimeZones(zones: string[], fn: (tz: string) => void) {
  const original = process.env.TZ
  const systemZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  try {
    for (const tz of zones) {
      process.env.TZ = tz
      expect(Intl.DateTimeFormat().resolvedOptions().timeZone, 'TZ 切换未生效').toBe(tz)
      fn(tz)
    }
  } finally {
    process.env.TZ = original ?? systemZone
  }
}

const ZONES = [
  'America/New_York',
  'America/Los_Angeles',
  'Etc/GMT+11',
  'UTC',
  'Asia/Shanghai',
  'Pacific/Kiritimati',
]

describe('formatDate / formatDatetime', () => {
  // final review fix(2.1.1 起就有的老缺陷):new Date('2026-09-21') 按 ES 规范是 UTC 零点,
  // UTC 以西的时区里 getDate() 拿到的是前一天 —— 后端 DATE 字段直出的纯日期串会显示成前一天。
  it('纯日期串(yyyy-MM-dd)按本地零点解析:任意时区都显示原日历日(final review fix)', () => {
    inTimeZones(ZONES, (tz) => {
      expect(formatDate('2026-09-21'), tz).toBe('2026-09-21')
      expect(formatDatetime('2026-09-21'), tz).toBe('2026-09-21 00:00:00')
      expect(applyFormat('date', '2026-09-21', {}), tz).toBe('2026-09-21')
      expect(applyFormat('datetime', '2026-09-21', {}), tz).toBe('2026-09-21 00:00:00')
      expect(formatDate('2024-01-01'), tz).toBe('2024-01-01') // 跨年边界
    })
  })

  it('带时间部分的串不受影响:裸 datetime 按本地,带 Z / 偏移的按其时刻换算到本地', () => {
    inTimeZones(ZONES, (tz) => {
      expect(formatDatetime('2026-09-21T10:20:30'), tz).toBe('2026-09-21 10:20:30')
    })
    inTimeZones(['America/New_York'], () => {
      expect(formatDatetime('2026-09-21T00:00:00Z')).toBe('2026-09-20 20:00:00')
      expect(formatDatetime('2026-09-21T00:00:00+08:00')).toBe('2026-09-20 12:00:00')
    })
  })

  it('Date 对象与时间戳照旧;解析不了的值原样返回', () => {
    inTimeZones(['America/New_York'], () => {
      expect(formatDatetime(new Date(2026, 8, 21, 7, 8, 9))).toBe('2026-09-21 07:08:09')
      expect(formatDate(new Date(2026, 8, 21).getTime())).toBe('2026-09-21')
      expect(formatDate('2026-13-01')).toBe('2026-13-01') // 月份越界:与修复前一样解析失败、原样显示
      expect(formatDate('not a date')).toBe('not a date')
      expect(formatDate(null)).toBe('')
    })
  })
})

describe('formatMoney', () => {
  it('两位小数、千分位;非数字原样', () => {
    expect(formatMoney(1234.5)).toBe('1,234.50')
    expect(formatMoney('12')).toBe('12.00')
    expect(formatMoney('abc')).toBe('abc')
  })
})
