import { isRef, reactive, toValue, watchEffect, type MaybeRefOrGetter } from 'vue'
import type { OptionsSource, SmartTableOption } from './types'

interface AsyncEntry {
  loading: boolean
  options: SmartTableOption[]
}

/**
 * OptionsSource 解析器(UI 无关):静态数组/ref 读时求值;
 * 异步函数触发一次并缓存,in-flight 去重,失败置 [] + console.warn(不弹 UI)。
 */
export function useOptions(sources: MaybeRefOrGetter<Record<string, OptionsSource>>) {
  // 异步源的加载状态;静态/ref 源不进这里
  const asyncState = reactive<Record<string, AsyncEntry>>({})
  const inflight = new Map<string, Promise<void>>()
  const triggered = new Set<string>()

  function fire(key: string, fn: () => Promise<SmartTableOption[]>): Promise<void> {
    const existing = inflight.get(key)
    if (existing) return existing
    if (!asyncState[key]) asyncState[key] = { loading: false, options: [] }
    asyncState[key].loading = true
    const p = fn()
      .then((opts) => {
        asyncState[key].options = opts
      })
      .catch((e) => {
        asyncState[key].options = []
        console.warn(`[smart-table] load options for "${key}" failed:`, e)
      })
      .finally(() => {
        asyncState[key].loading = false
        inflight.delete(key)
      })
    inflight.set(key, p)
    return p
  }

  // 挂载及 sources 变化时,把新出现的异步源各触发一次
  watchEffect(() => {
    const map = toValue(sources)
    for (const [key, src] of Object.entries(map)) {
      if (typeof src === 'function' && !triggered.has(key)) {
        triggered.add(key)
        void fire(key, src)
      }
    }
  })

  function getOptions(key: string): SmartTableOption[] {
    const src = toValue(sources)[key]
    if (!src) return []
    if (typeof src === 'function') return asyncState[key]?.options ?? []
    if (isRef(src)) return src.value
    return src
  }

  function isLoading(key: string): boolean {
    return asyncState[key]?.loading ?? false
  }

  /** 强制重取异步字典;缺省全部。静态/ref 源无需 reload,跳过。 */
  async function reload(key?: string): Promise<void> {
    const map = toValue(sources)
    const keys = key ? [key] : Object.keys(map)
    await Promise.all(
      keys.map((k) => {
        const src = map[k]
        if (typeof src !== 'function') return Promise.resolve()
        inflight.delete(k)
        return fire(k, src)
      }),
    )
  }

  return { getOptions, isLoading, reload }
}

/** 按 value 在选项树中查找(单元格翻译用,扁平化递归)。 */
export function findOption(
  options: SmartTableOption[],
  value: unknown,
): SmartTableOption | undefined {
  for (const opt of options) {
    if (opt.value === value) return opt
    if (opt.children) {
      const hit = findOption(opt.children, value)
      if (hit) return hit
    }
  }
  return undefined
}

/** 渲染期求值 label(函数形式支持语言切换)。 */
export function optionLabel(opt: SmartTableOption): string {
  return typeof opt.label === 'function' ? opt.label() : opt.label
}
