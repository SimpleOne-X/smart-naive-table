import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'
import { isFilterActive } from './filter'
import type { FilterState, FilterValue } from './types'
import { deriveInitFilters, type FilterDef } from './useColumns'

/**
 * 两个 FilterState 内容是否一致 —— 按 key 逐个比较,而不是整体 JSON.stringify。
 * 整体序列化对「顶层键的插入顺序」敏感:哪个过滤列先激活、defaultValue 补种是在初始挂载
 * 还是列定义后追加到达,都会让同一份内容序列化出不同的字符串,把「没变」误判成「变了」,
 * clearFilters 在没有实际变化时也会白白触发一次 onChange(远程模式多打一次请求)。
 */
function filterStateEqual(a: FilterState, b: FilterState): boolean {
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) return false
  return aKeys.every((k) => JSON.stringify(a[k]) === JSON.stringify(b[k]))
}

export interface UseFiltersOpts<T> {
  /** 当前过滤项(getter:列定义变化后能补种新列的 defaultValue)。 */
  defs: () => FilterDef<T>[]
  /** 过滤态变化后回调(远程重查 / 对外 emit 都挂这里)。 */
  onChange?: (key: string, value: FilterValue | null, state: FilterState) => void
}

export interface UseFiltersReturn {
  /** 只含「生效」列的过滤态:清空某列即从对象里删键,而不是留个空壳。 */
  state: Ref<FilterState>
  getFilter: (key: string) => FilterValue | null
  /** 传 null 或无生效条件的值 → 清除该列。值没变则不触发 onChange。 */
  setFilter: (key: string, value: FilterValue | null) => void
  /**
   * 一次改多列(模式 2 的「搜索 / 重置」):补丁里值为 null 或无生效条件的键被清掉。只触发**一次** onChange(key 为空串,与 clearFilters 同口径),
   * 远程模式只重查一次。返回是否真的有变化(没变化时不触发 onChange,调用方要「点搜索总是重查」就自己补一次)。
   */
  setMany: (patch: Record<string, FilterValue | null>) => boolean
  /** 全部恢复到各列 defaultValue(没有 defaultValue 的列即清空)。 */
  clearFilters: () => void
  activeKeys: ComputedRef<string[]>
}

/**
 * 表头过滤态(UI 无关):只保存「有生效条件」的列,方便直接序列化进请求参数。
 * 列的 defaultValue 只在该列首次出现时播种一次 —— 用户手动清掉后不会被重新塞回来。
 */
export function useFilters<T>(opts: UseFiltersOpts<T>): UseFiltersReturn {
  const state = ref<FilterState>(deriveInitFilters(opts.defs()))
  const seeded = new Set(opts.defs().map((d) => d.key))

  // 列定义后追加的过滤列:补种一次 defaultValue(已播种过的列不再回填)。
  // 「defaultValue 是否生效」这条判断口径复用 deriveInitFilters(而不是在这里重新写一遍),
  // 否则两处各改各的,同一份配置在「初始挂载」和「后续追加」两条路径上会悄悄给出不同的初始
  // 过滤态 —— useColumns.ts 的 deriveInitFilters 上也留了同样的提醒。
  watch(opts.defs, (defs) => {
    const freshDefs = defs.filter((d) => !seeded.has(d.key))
    if (freshDefs.length === 0) return
    freshDefs.forEach((d) => seeded.add(d.key))
    const seededValues = deriveInitFilters(freshDefs)
    if (Object.keys(seededValues).length > 0) state.value = { ...state.value, ...seededValues }
  })

  function getFilter(key: string): FilterValue | null {
    return state.value[key] ?? null
  }

  function setFilter(key: string, value: FilterValue | null) {
    const next = { ...state.value }
    const effective = value && isFilterActive(value) ? value : null
    if (effective) next[key] = effective
    else delete next[key]
    // 同值重复提交(面板里点确定但没改动)不该触发一次远程重查
    if (JSON.stringify(next[key] ?? null) === JSON.stringify(state.value[key] ?? null)) return
    state.value = next
    opts.onChange?.(key, effective, next)
  }

  function setMany(patch: Record<string, FilterValue | null>): boolean {
    const next = { ...state.value }
    for (const [key, value] of Object.entries(patch)) {
      if (value && isFilterActive(value)) next[key] = value
      else delete next[key]
    }
    if (filterStateEqual(next, state.value)) return false
    state.value = next
    opts.onChange?.('', null, next)
    return true
  }

  function clearFilters() {
    const next = deriveInitFilters(opts.defs())
    if (filterStateEqual(next, state.value)) return
    state.value = next
    opts.onChange?.('', null, next)
  }

  const activeKeys = computed(() => Object.keys(state.value))

  return { state, getFilter, setFilter, setMany, clearFilters, activeKeys }
}
