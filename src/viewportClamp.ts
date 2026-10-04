// 弹层水平夹进视口。NPopover 的 placement="bottom" 把弹层居中在触发器上,触发器靠近视口边缘时(窄屏尤其明显:
// 390px 宽下 400px 的列头面板左缘落在 x = -69)弹层的一侧会被裁出屏幕。公开的 NPopover 没有「夹进视口」的开关,
// 所以量出弹层当前的位置,给内容加一个水平平移把它拉回来(设计原型 placeHpop 也是这么夹的)。
// 开了 cardOnNarrow 的窄档不渲染表头(筛选 / 排序改走底部抽屉);没开时窄容器里至少靠这个夹取保证内容不被裁掉。

/**
 * 弹层要水平平移多少像素才能完全落进 [margin, viewport − margin]。
 * left / width:弹层「不含这次平移」的自然位置与宽度;已经在范围内 → 0;放不下(比视口 − 两侧边距还宽)→ 贴左边距
 * (保证左侧的标签、比较符可见,右侧被裁比左侧被裁更不影响操作)。结果取整,避免 translateX(77.3333px) 的模糊渲染。
 */
export function clampShift(left: number, width: number, viewport: number, margin = 8): number {
  const max = viewport - margin - width
  let dx = 0
  if (max < margin) dx = margin - left
  else if (left < margin) dx = margin - left
  else if (left > max) dx = max - left
  return Math.round(dx)
}
