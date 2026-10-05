// 淡色按钮(secondary + type)与行内文字按钮(text + type)的字色加深(设计 §2.15 E)。
// 官方 secondary 的底和字取同一个类型色(Button.mjs:250-265:底 = 它 α 0.16、字 = 它),浅色下淡绿字对底只有 2.83 : 1;
// 官方没有「只改字色」的变量,所以按钮级覆盖 colorPrimary / colorError(它们只在 secondary 分支里被读,底随之同色相),
// 实心按钮不挂这组覆盖,仍是官方主色配白字。文字按钮的字色是独立变量 textColorText{Primary,Error}。
// 取值来自当前主题的 primaryColorPressed / errorColorPressed(不写死 hex):宿主换了主题或明暗切换都跟着走。
import { computed, type ComputedRef } from 'vue'
import { useThemeVars } from 'naive-ui'
import type { ButtonProps } from 'naive-ui'

type ButtonOverrides = NonNullable<ButtonProps['themeOverrides']>

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
    const { primaryColorPressed, errorColorPressed } = vars.value
    return {
      primary: { colorPrimary: primaryColorPressed },
      error: { colorError: errorColorPressed },
      primaryText: { textColorTextPrimary: primaryColorPressed },
      errorText: { textColorTextError: errorColorPressed },
    }
  })
}
