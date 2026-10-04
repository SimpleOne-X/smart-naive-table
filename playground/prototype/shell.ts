// 对照页外壳状态:明暗 / 语言 / 页面底色 / 密度 四个全局开关(原型侧栏「全局设置」组),对全部 14 个模块生效。
// URL 参数:?m= &theme=light|dark &lang=zh|en &bg=gray|white &density=compact|comfortable
// 缺省(与 docs/baseline/README.md「截图前外壳开关默认值」一致):zh / gray / compact;theme 缺省跟随系统(与原型一致)。
//
// 模块里这样用(全文见 modules/README.md):
//   const shell = useShell()          // reactive:shell.lang / shell.bg / shell.density / shell.theme 直接读写,模板里不用 .value
//   <SmartTable v-bind="shell.tableProps" …/>   // 含 defaultDensity,所有模块必带(密度响应外壳开关)
import { computed, inject, reactive, ref, type InjectionKey } from 'vue'
import type { Density } from '../../src/index'

export type Lang = 'zh' | 'en'
export type PageBg = 'gray' | 'white'
export type Theme = 'light' | 'dark'

export interface ShellState {
  theme: Theme
  lang: Lang
  bg: PageBg
  density: Density
  /** 每个 <SmartTable> 都要 v-bind 的外壳级 props:个人密度(响应式;不能放进 SMART_TABLE_DEFAULTS,config.ts 的 resolveDefaults 会把它拷成标量)+ 列宽可拖。 */
  readonly tableProps: { defaultDensity: Density; resizable: boolean }
  readonly isEn: boolean
}

export const SHELL_KEY: InjectionKey<ShellState> = Symbol('proto-shell')

function pick<V extends string>(v: string | null, allowed: readonly V[], fallback: V): V {
  return (allowed as readonly string[]).includes(v ?? '') ? (v as V) : fallback
}

/** 读 URL 参数建外壳状态;theme 缺省跟随系统。 */
export function createShell(
  search: string = typeof location === 'undefined' ? '' : location.search,
): ShellState {
  const q = new URLSearchParams(search)
  const sysDark =
    typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches
  const theme = ref<Theme>(
    pick<Theme>(q.get('theme'), ['light', 'dark'], sysDark ? 'dark' : 'light'),
  )
  const lang = ref<Lang>(pick<Lang>(q.get('lang'), ['zh', 'en'], 'zh'))
  const bg = ref<PageBg>(pick<PageBg>(q.get('bg'), ['gray', 'white'], 'gray'))
  const density = ref<Density>(
    pick<Density>(q.get('density'), ['compact', 'comfortable'], 'compact'),
  )
  // reactive 会把 ref / computed 解包:读写 shell.lang 就是读写 ref,模板里也不用 .value
  return reactive({
    theme,
    lang,
    bg,
    density,
    tableProps: computed(() => ({ defaultDensity: density.value, resizable: true })),
    isEn: computed(() => lang.value === 'en'),
  }) as unknown as ShellState
}

let fallback: ShellState | undefined
/** 取外壳状态。ProtoApp 里 provide;没有 provide 时(单测里单独挂模块)退回一个不读 URL 的默认状态。 */
export function useShell(): ShellState {
  return inject(SHELL_KEY, null) ?? (fallback ??= createShell(''))
}
