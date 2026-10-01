// 搜索表单折叠态的列数判断(C5)。n-grid 的折叠判定(Grid.mjs:198)在「1 列 × 1 行」时一上来就满,
// 折叠态 0 个字段;库不知道当前列数。
// 不自己按视口宽度 + 默认断点推算(宿主用 NConfigProvider 的 breakpoints 自定义断点时会算错),
// 也不用 naive 的 useBreakpoints(不是公开导出):渲染后直接读 n-grid 根元素 computed 的
// grid-template-columns 有几个轨道 —— 浏览器算出来的就是 n-grid 真实用的列数。

/**
 * computed 的 grid-template-columns → 轨道数。浏览器解析后是一串 px("100px 100px");
 * 个别环境(jsdom)保留 repeat(N, …) 原样,取 N。括号里的空格不算分隔。none / 空 / 读不到 → 0(未知)。
 */
export function countTracks(gridTemplateColumns: string): number {
  const s = typeof gridTemplateColumns === 'string' ? gridTemplateColumns.trim() : ''
  if (!s || s === 'none') return 0
  const repeat = /^repeat\(\s*(\d+)\s*,/.exec(s)
  if (repeat) return Number(repeat[1])
  let depth = 0
  let count = 0
  let inToken = false
  for (const ch of s) {
    if (ch === '(') depth++
    else if (ch === ')') depth = Math.max(0, depth - 1)
    const space = depth === 0 && /\s/.test(ch)
    if (!space && !inToken) count++
    inToken = !space
  }
  return count
}

/**
 * 传给 n-grid 的 collapsed-rows:折叠可见字段数 = max(1, collapsedRows × 列数 − 1)。
 * 只有 collapsedRows × 列数 < 2(即 1 列 × 1 行)时需要修正 → 抬到 2 行;其余档位保持配置值。
 * 轨道数为 0(未知)时不改,免得误伤 cols ≥ 2 的现有用户。
 */
export function effectiveCollapsedRows(trackCount: number, collapsedRows = 1): number {
  return trackCount > 0 && collapsedRows * trackCount < 2 ? 2 : collapsedRows
}
