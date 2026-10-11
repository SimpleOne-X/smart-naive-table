// 显示态单元格的内边距。NDataTable 的 td 是 padding: var(--n-td-padding),而 tdPaddingSmall / tdPaddingMedium 是 padding 简写,
// 宿主主题可以写成两值('4px 12px' = 上下 左右)等多值写法。编辑态的单元格 padding 置 0、控件自带左内边距,
// 所以要知道显示态实际的左值与上下之和。让浏览器按简写规则解析(calc() / em / 嵌套变量也都对),不自己拆字符串。

export interface CellPadding {
  /** 左内边距(px):编辑控件的文字左缘与显示态对齐。 */
  left: string
  /** 上下内边距之和(px):不支持容器查询单位的浏览器退回的控件高 = 它 + 一行字高。 */
  y: string
}

/**
 * 在 `host`(必须在 NDataTable 之内,才取得到 --n-td-padding)里放一个吃 `padding: var(--n-td-padding)` 的探针读出解析结果,读完即移除。
 * 解析不出数值(服务端 / jsdom 解不开 var() 里的简写)返回 null,由样式里的缺省值接手。
 */
export function measureCellPadding(host: HTMLElement): CellPadding | null {
  const probe = document.createElement('span')
  probe.style.cssText =
    'position:absolute;visibility:hidden;pointer-events:none;padding:var(--n-td-padding)'
  host.appendChild(probe)
  try {
    const cs = getComputedStyle(probe)
    const left = parseFloat(cs.paddingLeft)
    const y = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom)
    if (!Number.isFinite(left) || !Number.isFinite(y)) return null
    return { left: `${left}px`, y: `${y}px` }
  } finally {
    probe.remove()
  }
}
