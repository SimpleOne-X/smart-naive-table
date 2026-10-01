import { computed, ref } from 'vue'
import { zhCNLabels } from '../src/index'

/** playground 的极简双语开关:演示 labels prop 与函数型列标题的语言响应。 */
export const locale = ref<'zh' | 'en'>('zh')

/** 函数型文案:渲染期求值,切语言即时生效(与宿主用 vue-i18n 的 () => t() 同机制)。 */
export const tt = (zh: string, en: string) => () => (locale.value === 'zh' ? zh : en)

/** zh 传库导出的中文包;en 传 undefined 走包内英文默认。 */
export const labels = computed(() => (locale.value === 'zh' ? zhCNLabels : undefined))
