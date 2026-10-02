import type { CellFormat } from './types'

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

/** 纯日期串:yyyy-MM-dd,不带时间部分(后端 DATE 字段常见的序列化形状)。 */
const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * 纯日期串按「本地零点」解析成 Date;不是这个形状返回 null,调用方照旧走原来的解析。
 * 为什么不直接 new Date(s) / Date.parse(s):ES 规范把不带时间的 ISO 日期串当成 UTC 零点,
 * UTC 以西的时区里那一刻还是本地的前一天 —— '2026-09-21' 会被显示成 9 月 20 日,日期过滤也按前一天算。
 * new Date(y, m, d) 这种分量构造恒按本地时区解释,与 formatDate 的 getFullYear/getDate、
 * 过滤值整天边界(filter.ts dayRange)是同一套本地基准。
 * 分量构造会把越界值进位(2026-02-30 → 3 月 2 日)、把 0–99 年当成 1900–1999 年:这类日期分量
 * 对不回去的值同样返回 null,让调用方按修复前的方式解析,结果与修复前一致。
 */
export function parseDateOnlyLocal(value: string): Date | null {
  const m = DATE_ONLY_RE.exec(value)
  if (!m) return null
  const y = Number(m[1])
  const month = Number(m[2]) - 1
  const day = Number(m[3])
  const d = new Date(y, month, day)
  return d.getFullYear() === y && d.getMonth() === month && d.getDate() === day ? d : null
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value
  if (typeof value === 'number') {
    const d = new Date(value)
    return isNaN(d.getTime()) ? null : d
  }
  if (typeof value === 'string' && value !== '') {
    const d = parseDateOnlyLocal(value) ?? new Date(value)
    return isNaN(d.getTime()) ? null : d
  }
  return null
}

export function formatDate(value: unknown): string {
  const d = toDate(value)
  if (!d) return String(value ?? '')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function formatDatetime(value: unknown): string {
  const d = toDate(value)
  if (!d) return String(value ?? '')
  return `${formatDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export function formatMoney(value: unknown): string {
  const n = typeof value === 'number' ? value : Number(value)
  if (!isFinite(n)) return String(value ?? '')
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** 应用声明式格式化;null/undefined 由调用方先行处理成 '—'。 */
export function applyFormat<T>(format: CellFormat<T>, value: unknown, row: T): string {
  if (typeof format === 'function') return format(value, row)
  switch (format) {
    case 'date':
      return formatDate(value)
    case 'datetime':
      return formatDatetime(value)
    case 'money':
      return formatMoney(value)
  }
}
