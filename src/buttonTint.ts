// 淡色按钮(secondary + type)与行内文字按钮(text + type)的字色加深(设计 §2.15 E)。
// 官方 secondary 的底和字取同一个类型色(Button.mjs:250-265:底 = 它 α 0.16、字 = 它),浅色下淡绿字对底只有 2.83 : 1;
// 官方没有「只改字色」的变量,所以按钮级覆盖 colorPrimary / colorError(它们只在 secondary 分支里被读,底随之同色相),
// 实心按钮不挂这组覆盖,仍是官方主色配白字。文字按钮的字色是独立变量 textColorText{Primary,Error}。
// 取值来自当前主题(不写死 hex):宿主换了主题或明暗切换都跟着走。默认取 pressed(比 primary 更易读),
// 但宿主常把暗色 pressed 定成「更深的蓝」(按下时压暗),字色和淡底一起变暗(实测约 2.7 : 1,issue #8),
// 所以按对比度在 pressed → primary → hover 里选第一个够 4.5 : 1 的;不依赖「pressed 一定更易读」这个假设。
import { computed, type ComputedRef } from 'vue'
import { useThemeVars } from 'naive-ui'
import type { ButtonProps } from 'naive-ui'

type ButtonOverrides = NonNullable<ButtonProps['themeOverrides']>

/** 官方 secondary 的淡底 = 类型色 α 0.16(Button.mjs:250-265,亮暗同值)。 */
const TINT_ALPHA = 0.16
/** WCAG 2.x 对正文文字的 AA 线。 */
const MIN_CONTRAST = 4.5

type Rgb = [number, number, number]

/** 认 #rgb / #rgba / #rrggbb / #rrggbbaa 与 rgb() / rgba()(alpha 一律忽略,按不透明算);命名色、hsl 等返回 null。 */
function parseColor(input: string): Rgb | null {
  const s = input.trim().toLowerCase()
  const hex = /^#([0-9a-f]+)$/.exec(s)
  if (hex) {
    let h = hex[1]
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('')
    if (h.length !== 6 && h.length !== 8) return null
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb
  }
  const fn = /^rgba?\(([^)]+)\)$/.exec(s)
  if (fn) {
    const parts = fn[1]
      .split(/[\s,/]+/)
      .filter(Boolean)
      .slice(0, 3)
      .map(Number)
    if (parts.length === 3 && parts.every(Number.isFinite)) return parts as Rgb
  }
  return null
}

function luminance([r, g, b]: Rgb): number {
  const [lr, lg, lb] = [r, g, b].map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb
}

/**
 * 字色 `text` 对 `surface`(卡片底色)的 WCAG 对比度。`tinted` = 淡色按钮:字色对的是「自己 α 0.16 叠在 surface 上」的淡底;
 * 行内文字按钮没有淡底,直接对 surface。任一颜色串解析不了返回 null。
 */
export function contrastRatio(text: string, surface: string, tinted: boolean): number | null {
  const fg = parseColor(text)
  const bg = parseColor(surface)
  if (!fg || !bg) return null
  const base: Rgb = tinted
    ? (fg.map((v, i) => v * TINT_ALPHA + bg[i] * (1 - TINT_ALPHA)) as Rgb)
    : bg
  const [hi, lo] = [luminance(fg), luminance(base)].sort((a, b) => b - a)
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * 候选里第一个对比度 ≥ 4.5 : 1 的;都不到取最高的(并列取靠前的);
 * 第一个候选或卡片底色解析不了时退回第一个候选(即不做选择,保持「取 pressed」的旧行为)。
 */
export function pickReadableColor(
  candidates: readonly string[],
  surface: string,
  tinted: boolean,
): string {
  const [first] = candidates
  if (contrastRatio(first, surface, tinted) === null) return first
  let best = first
  let bestRatio = -1
  for (const c of candidates) {
    const r = contrastRatio(c, surface, tinted)
    if (r === null) continue
    if (r >= MIN_CONTRAST) return c
    if (r > bestRatio) {
      best = c
      bestRatio = r
    }
  }
  return best
}

export interface ButtonTint {
  /** `secondary` + `type="primary"` 的淡色按钮 */
  primary: ButtonOverrides
  /** `secondary` + `type="error"` 的淡色按钮 */
  error: ButtonOverrides
  /** `text` + `type="primary"` 的文字按钮(行内「编辑」、「展开 / 收起」) */
  primaryText: ButtonOverrides
  /** `text` + `type="error"` 的文字按钮(行内「删除」) */
  errorText: ButtonOverrides
}

/** 随当前主题(含宿主的 themeOverrides、明暗)变化的淡色按钮覆盖;在 setup 或渲染函数里调用。 */
export function useButtonTint(): ComputedRef<ButtonTint> {
  const vars = useThemeVars()
  return computed<ButtonTint>(() => {
    const v = vars.value
    const surface = v.cardColor
    const primary = [v.primaryColorPressed, v.primaryColor, v.primaryColorHover]
    const error = [v.errorColorPressed, v.errorColor, v.errorColorHover]
    return {
      primary: { colorPrimary: pickReadableColor(primary, surface, true) },
      error: { colorError: pickReadableColor(error, surface, true) },
      primaryText: { textColorTextPrimary: pickReadableColor(primary, surface, false) },
      errorText: { textColorTextError: pickReadableColor(error, surface, false) },
    }
  })
}
