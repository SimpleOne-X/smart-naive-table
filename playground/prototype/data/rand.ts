// 确定性伪随机与日期小工具(原型 docs/smart-naive-table-design.html 的 mulberry32 / hash32 / dayTs / isoDay / DAY_MS 逐字拷贝;
// 不动 ../data.ts,模块 5–13 的数据文件从这里取,保证与原型同一份序列)。
export function mulberry32(seed: number): () => number {
  return function () {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const DAY_MS = 864e5
/** UTC 毫秒 → 'YYYY-MM-DD'(全程用 UTC,与时区无关)。 */
export const isoDay = (ts: number): string => new Date(ts).toISOString().slice(0, 10)
/** 'YYYY-MM-DD'(或更长的 ISO 串)→ UTC 零点毫秒。 */
export const dayTs = (s: string): number =>
  Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10))
/** 字符串 → 32 位无符号哈希(FNV-1a),给「同一行永远派生出同一份数据」用。 */
export const hash32 = (str: string): number => {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
