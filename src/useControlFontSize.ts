// 与 Naive 控件同档的字号:small / medium / large 对应主题的 fontSizeSmall / Medium / Large。
// 库里自己画的文字(条件面板的引导标签、抽屉块头)要跟同行的 NSelect / NInput 一样大,而且宿主改了主题字号也跟着走,
// 所以不在 CSS 里写 px,经 :style 绑定这个值(var(--n-*) 在库自己的元素上取不到,见 SearchForm 头部注释)。
import { computed, type ComputedRef } from 'vue'
import { useThemeVars } from 'naive-ui'

const FONT_SIZE_KEY = {
  small: 'fontSizeSmall',
  medium: 'fontSizeMedium',
  large: 'fontSizeLarge',
} as const

/** 控件尺寸档;和 NSelect / NInput 的 `size` 同取值。 */
export type ControlSize = keyof typeof FONT_SIZE_KEY

export function useControlFontSize(size: () => ControlSize): ComputedRef<string> {
  const vars = useThemeVars()
  return computed(() => vars.value[FONT_SIZE_KEY[size()]])
}
