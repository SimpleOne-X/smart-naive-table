// 已生效条件 chips 的纯函数(UI 无关、可单测)。
import { activeConditions, isFilterActive, isValuelessAction } from './filter'
import { ACTION_LABEL_KEY } from './labels'
import type { FilterState, FilterValue, SmartTableLabels } from './types'
import { filterDefTitle, type FilterDef } from './useColumns'

export interface ChipItem {
  /** 过滤态的键(FilterDef.key)。 */
  key: string
  /** 该条件在 activeConditions(value) 里的下标(删除时按它定位)。 */
  index: number
  text: string
  /**
   * 孤儿:过滤态里有、但列声明里已经没有对应的过滤项(列被移除 / 改了 filter.key / 总开关关了)。
   * 没有面板可开,但它仍会进远程请求参数 —— 所以也要让用户看得见、清得掉(Q-7)。只在孤儿上设置。
   */
  orphan?: true
}

function chipsOf(
  def: FilterDef | undefined,
  key: string,
  value: FilterValue | undefined,
  labels: Required<SmartTableLabels>,
  optionLabelOf: (def: FilterDef | undefined, value: unknown) => string,
  orphan: boolean,
): ChipItem[] {
  const title = def ? filterDefTitle(def) : key // 孤儿没有列标题,回退成键
  return activeConditions(value).map((c, index) => {
    const valueText = isValuelessAction(c.action)
      ? ''
      : Array.isArray(c.value)
        ? c.value.map((x) => optionLabelOf(def, x)).join(', ')
        : optionLabelOf(def, c.value)
    const text = [index > 0 && value?.logic === 'or' ? labels.filterLogicOr : '', title, labels[ACTION_LABEL_KEY[c.action]], valueText]
      .filter(Boolean)
      .join(' ')
    return { key, index, text, ...(orphan ? { orphan: true as const } : {}) }
  })
}

/**
 * 每个生效条件一个 chip;顺序按列声明,**之后**是孤儿键(按过滤态的键顺序)。
 * optionLabelOf 把值翻成展示文字(字典列显示 label 而不是 value;孤儿传 undefined 的 def,按原值显示)。
 */
export function buildChips(
  defs: FilterDef[],
  state: FilterState,
  labels: Required<SmartTableLabels>,
  optionLabelOf: (def: FilterDef | undefined, value: unknown) => string,
): ChipItem[] {
  const out: ChipItem[] = []
  const known = new Set<string>()
  for (const def of defs) {
    known.add(def.key)
    out.push(...chipsOf(def, def.key, state[def.key], labels, optionLabelOf, false))
  }
  for (const key of Object.keys(state)) {
    if (!known.has(key)) out.push(...chipsOf(undefined, key, state[key], labels, optionLabelOf, true))
  }
  return out
}

/** 删掉一个 chip 对应的条件(下标按生效条件算);剩一条时 logic 归位 and;删光返回 null。 */
export function removeChipCondition(value: FilterValue, index: number): FilterValue | null {
  const rest = activeConditions(value).filter((_, i) => i !== index)
  if (rest.length === 0) return null
  return { logic: rest.length > 1 ? value.logic : 'and', conditions: rest }
}

/**
 * 折叠个数:给定每个 chip 的 offsetTop,第一行放得下的个数;有折到下一行的,再让出一个位置给「+N」(至少留 1 个)。
 * 组件测量时先把全部 chip 渲染出来量 offsetTop,再用这个数决定显示几个。
 */
export function countFitting(tops: number[]): number {
  if (tops.length === 0) return 0
  const fit = tops.filter((t) => t === tops[0]).length
  return fit >= tops.length ? tops.length : Math.max(1, fit - 1)
}

/**
 * 「+N」标签本身也占位:让出一个位置只是估算,渲染出来后若 +N 仍折到了第二行(offsetTop 与第一行不同),
 * 再让出一个位置,可以让到 0(连首个 chip + +N 都放不下时只显示 +N,F10);放得下就原样返回。组件在 +N 渲染后重测,直到稳定(Q-7)。
 */
export function shrinkForMore(visible: number, firstTop: number, moreTop: number): number {
  return moreTop === firstTop ? visible : Math.max(0, visible - 1)
}

/** 表里是否有列声明了生效的 defaultValue —— 决定行末按钮叫「恢复默认」还是「清除全部」。 */
export function hasActiveDefaults(defs: FilterDef[]): boolean {
  return defs.some((d) => !!d.defaultValue && isFilterActive(d.defaultValue))
}

/** 一列的过滤值归一成可比较的形状:无生效条件 → null;只有 1 条时 logic 恒为 and(它在单条时没有意义)。 */
function canon(value: FilterValue | null | undefined): string {
  const conds = activeConditions(value)
  if (!conds.length) return ''
  return JSON.stringify({ logic: conds.length > 1 ? value!.logic : 'and', conditions: conds.map((c) => [c.action, c.value ?? null]) })
}

/**
 * 当前过滤态是不是就等于各列声明的默认值(只比生效的条件):没有默认值的列要求没有生效条件,孤儿键有生效条件就算偏离。
 * chips 行末按钮据此决定要不要出现(原型一致):有默认值的表,**偏离**默认才出现「恢复默认」;
 * 没有默认值的表则看 chip 个数(≥ 2 才出现「清除全部」)。
 */
export function filtersAtDefaults(defs: FilterDef[], state: FilterState): boolean {
  const keys = new Set([...Object.keys(state), ...defs.map((d) => d.key)])
  const defaultOf = new Map(defs.map((d) => [d.key, d.defaultValue]))
  for (const k of keys) {
    if (canon(state[k]) !== canon(defaultOf.get(k))) return false
  }
  return true
}
