// 模式 2 条件构造器(`search: { container: 'table' }`)的纯逻辑(UI 无关、可单测):
// 字段从哪来、比较符默认集合、容器解析、草稿 ↔ 过滤态的互转、行编辑。
// 产出仍是 FilterValue,走现成的 FilterState / filterSerializer / 本地 applyFilters(设计文档 1);「搜索」按钮提交草稿,不是每敲一个字就查。
import { actionValueKind, activeConditions } from './filter'
import type {
  FilterAction,
  FilterConfig,
  FilterFieldType,
  FilterLogic,
  FilterState,
  FilterValue,
  SearchConfig,
  SearchFieldType,
  SearchFormConfig,
  SmartTableColumn,
} from './types'
import { inferFilterType, filterOptionsKey, isSpecialColumn, type FilterDef } from './useColumns'

/* ======================== 容器解析 ======================== */

export type SearchContainer = 'card' | 'table' | 'none'

/**
 * 搜索区放在哪(规格 §5.1):`container` 优先;`layout` 只是旧写法 —— 没写 `container` 时 `layout: 'inline'` 等价 `'none'`,否则 `'card'`。
 * `'none'` = 不带卡片的内联搜索表单(2.1.1 的 `layout: 'inline'`),`'card'` = 独立搜索卡片 + 网格(默认),`'table'` = 并入表格卡片的条件构造器(模式 2)。
 * 两者同时写且冲突(如 `container: 'card'` + `layout: 'inline'`)时 `container` 赢、`layout` 被忽略。
 */
export function resolveSearchContainer(cfg: SearchFormConfig | false | undefined): SearchContainer {
  if (!cfg) return 'card'
  return cfg.container ?? (cfg.layout === 'inline' ? 'none' : 'card')
}

/* ======================== 比较符默认集合 ======================== */

/** 模式 2 按字段类型的推荐比较符(规格 §5.9):列头面板默认是 2.1.1 的 8 个,这里默认给全。宿主用 `search.actions` / `filter.actions` 覆盖。 */
export const RECOMMENDED_ACTIONS: Record<FilterFieldType, readonly FilterAction[]> = {
  input: [
    'contains',
    'notContains',
    'equal',
    'notEqual',
    'startsWith',
    'endsWith',
    'like',
    'isNull',
    'isNotNull',
  ],
  number: ['equal', 'notEqual', 'gt', 'gte', 'lt', 'lte', 'isNull', 'isNotNull'],
  date: ['equal', 'notEqual', 'gt', 'gte', 'lt', 'lte', 'isNull', 'isNotNull'],
  select: ['equal', 'notEqual', 'in', 'notIn', 'isNull', 'isNotNull'],
}

/** 条件构造器一共最多几行(自有取值;列头面板是每列 5 条)。真有需求走编程式 setFilter。 */
export const MAX_BUILDER_ROWS = 10

/* ======================== 字段派生 ======================== */

/** 搜索控件类型 → 条件行的值控件类型。daterange 当 date(用 ≥ 与 ≤ 两行表达区间);switch / 自定义 render 放不进一行,不进构造器。 */
const SEARCH_TO_FIELD: Partial<Record<SearchFieldType, FilterFieldType>> = {
  input: 'input',
  number: 'number',
  select: 'select',
  date: 'date',
  daterange: 'date',
}

export interface BuilderDefs {
  /** 构造器的字段候选(声明了 `search` 且放得进条件行的列),按 `search.order` / 声明顺序。 */
  fields: FilterDef[]
  /** 其中「只写了 search、没有列头 filter」的字段:过滤态 / 本地过滤 / chips 也要认它们,但表头不挂漏斗。 */
  extra: FilterDef[]
}

/** 只写 `search` 的列的 `search.defaultValue`(模式 1 的扁平标量)→ 一条初始条件:input 用 contains,其余用 equal;数组 / 空值不生成。 */
function defaultToFilterValue(
  value: unknown,
  type: FilterFieldType,
  actions: FilterAction[],
): FilterValue | null {
  if (value === null || value === undefined || value === '' || Array.isArray(value)) return null
  const action: FilterAction = type === 'input' ? 'contains' : 'equal'
  return {
    logic: 'and',
    conditions: [{ action: actions.includes(action) ? action : (actions[0] ?? action), value }],
  }
}

/**
 * 从列声明派生构造器字段(规格 §5.1:「只写 search 的列如何派生 FilterDef」):
 * - 同时写了 `filter` 的列:直接复用列头的 FilterDef(同一个过滤键、同一份过滤态,构造器与漏斗是同一份条件的两个入口),只换比较符集合与标题;
 * - 只写 `search` 的列:新派生一个(过滤键 = `filter.key ?? 列 key`,**忽略 `search.key`**——模式 2 的请求走 filterSerializer 的 `filters[].field`,不是扁平参数),
 *   值控件类型取 `search.type`(daterange → date),比较符取 `search.actions ?? filter.actions ?? 推荐集合`;
 * - `search.render` / `type: 'switch'` 的列放不进「字段 + 比较符 + 值」一行,不进构造器。
 */
export function deriveBuilderDefs<T>(
  columns: SmartTableColumn<T>[],
  headerDefs: FilterDef<T>[],
): BuilderDefs {
  const items: Array<{ def: FilterDef<T>; extra: boolean; sortKey: number }> = []
  columns.forEach((col, idx) => {
    if (isSpecialColumn(col) || !col.search) return
    const sc: SearchConfig = col.search === true ? {} : col.search
    if (sc.render || sc.type === 'switch') return
    const fc: FilterConfig<T> | undefined = col.filter
      ? col.filter === true
        ? {}
        : col.filter
      : undefined
    const header = headerDefs.find((d) => d.field === col.key)
    const sortKey = sc.order ?? 1_000_000 + idx

    if (header) {
      const actions = sc.actions?.length
        ? sc.actions
        : fc?.actions?.length
          ? fc.actions
          : [...RECOMMENDED_ACTIONS[header.type]]
      items.push({
        def: { ...header, actions: [...actions], title: sc.label ?? header.title },
        extra: false,
        sortKey,
      })
      return
    }
    const hasOptions = !!(fc?.options ?? col.options)
    const type: FilterFieldType =
      (sc.type && SEARCH_TO_FIELD[sc.type]) || inferFilterType(col, hasOptions, fc?.type)
    const actions = [
      ...(sc.actions?.length
        ? sc.actions
        : fc?.actions?.length
          ? fc.actions
          : RECOMMENDED_ACTIONS[type]),
    ]
    const props: Record<string, unknown> = {
      ...(sc.placeholder !== undefined ? { placeholder: sc.placeholder } : {}),
      ...sc.props,
      ...fc?.props,
    }
    items.push({
      def: {
        key: fc?.key ?? col.key,
        field: col.key,
        optionsKey: fc?.options ? filterOptionsKey(col.key) : col.key,
        title: sc.label ?? col.title,
        mode: 'condition',
        multiple: true,
        type,
        actions,
        defaultValue: fc?.defaultValue ?? defaultToFilterValue(sc.defaultValue, type, actions),
        props: Object.keys(props).length ? props : undefined,
        filter: fc?.filter,
      },
      extra: true,
      sortKey,
    })
  })
  items.sort((a, b) => a.sortKey - b.sortKey)
  return { fields: items.map((i) => i.def), extra: items.filter((i) => i.extra).map((i) => i.def) }
}

/* ======================== 草稿 ======================== */

export interface BuilderRow {
  /** 字段 = FilterDef.key(过滤键)。 */
  field: string
  action: FilterAction
  value: unknown
}

export interface BuilderDraft {
  rows: BuilderRow[]
  /** 同字段多条的「且 / 或」:**每字段一个值**(与 FilterValue.logic 一致,改任一条联动该字段全部);缺省 and。跨字段固定「且」。 */
  logic: Record<string, FilterLogic>
}

export function blankRow(def: FilterDef): BuilderRow {
  return { field: def.key, action: def.actions[0] ?? 'equal', value: null }
}

/**
 * 过滤态 → 草稿:按字段候选的顺序、字段内按条件顺序展开成行;没有任何生效条件 → 一行空白(第一个字段)。
 * 过滤态里不属于构造器字段的键(只有列头漏斗管的列)不进草稿。
 */
export function draftFromState(state: FilterState, defs: FilterDef[]): BuilderDraft {
  const rows: BuilderRow[] = []
  const logic: Record<string, FilterLogic> = {}
  for (const d of defs) {
    const v = state[d.key]
    const conds = activeConditions(v)
    if (conds.length === 0) continue
    for (const c of conds) rows.push({ field: d.key, action: c.action, value: c.value })
    if (conds.length > 1 && v?.logic === 'or') logic[d.key] = 'or'
  }
  if (rows.length === 0 && defs[0]) rows.push(blankRow(defs[0]))
  return { rows, logic }
}

/**
 * 草稿 → 过滤态补丁(每个构造器字段一项:有生效条件 → FilterValue,没有 → null = 清掉)。
 * 生效 = 有值的有值类条件 + 无值算子;只剩一条时 logic 归位为 and。不属于构造器的键不在补丁里,所以列头漏斗管的条件不受影响。
 */
export function patchFromDraft(
  draft: BuilderDraft,
  defs: FilterDef[],
): Record<string, FilterValue | null> {
  const patch: Record<string, FilterValue | null> = {}
  for (const d of defs) {
    const conds = activeConditions({
      logic: 'and',
      conditions: draft.rows
        .filter((r) => r.field === d.key)
        .map((r) => ({ action: r.action, value: r.value })),
    })
    patch[d.key] =
      conds.length === 0
        ? null
        : {
            logic: conds.length > 1 ? (draft.logic[d.key] ?? 'and') : 'and',
            conditions: conds.map((c) => ({ ...c })),
          }
  }
  return patch
}

/** 过滤态里构造器管的那部分,和草稿提交后会得到的是否一致(一致就不必用过滤态重建草稿,免得把用户排好的行序打乱)。 */
export function draftMatchesState(
  draft: BuilderDraft,
  state: FilterState,
  defs: FilterDef[],
): boolean {
  const patch = patchFromDraft(draft, defs)
  return defs.every(
    (d) => JSON.stringify(patch[d.key] ?? null) === JSON.stringify(state[d.key] ?? null),
  )
}

/** 「重置」:构造器字段各自恢复 defaultValue(没有 / 无生效条件就清掉),不碰列头漏斗管的键。 */
export function resetPatch(defs: FilterDef[]): Record<string, FilterValue | null> {
  const patch: Record<string, FilterValue | null> = {}
  for (const d of defs) {
    const dv = d.defaultValue
    patch[d.key] = dv && activeConditions(dv).length > 0 ? dv : null
  }
  return patch
}

/* ---- 行编辑(都返回新草稿) ---- */

const defOf = (defs: FilterDef[], field: string) => defs.find((d) => d.key === field)

/** 换字段:比较符不再适用时重置为新字段的第一个;值一律清空(不同字段的值控件 / 字典不同,不做猜测性转换)。 */
export function setRowField(
  draft: BuilderDraft,
  index: number,
  field: string,
  defs: FilterDef[],
): BuilderDraft {
  const d = defOf(defs, field)
  if (!d) return draft
  return {
    ...draft,
    rows: draft.rows.map((r, i) =>
      i !== index
        ? r
        : {
            field,
            action: d.actions.includes(r.action) ? r.action : (d.actions[0] ?? 'equal'),
            value: null,
          },
    ),
  }
}

/** 换比较符:旧值的形状(无值 / 数组 / 标量)与新比较符不一致就清空。 */
export function setRowAction(
  draft: BuilderDraft,
  index: number,
  action: FilterAction,
): BuilderDraft {
  return {
    ...draft,
    rows: draft.rows.map((r, i) =>
      i !== index
        ? r
        : {
            ...r,
            action,
            value: actionValueKind(r.action) === actionValueKind(action) ? r.value : null,
          },
    ),
  }
}

export function setRowValue(draft: BuilderDraft, index: number, value: unknown): BuilderDraft {
  return { ...draft, rows: draft.rows.map((r, i) => (i === index ? { ...r, value } : r)) }
}

/** 加一行:与最后一行同字段(多条件最常见的是同字段「或」),第一个比较符;封顶 MAX_BUILDER_ROWS。 */
export function addRow(draft: BuilderDraft, defs: FilterDef[]): BuilderDraft {
  if (draft.rows.length >= MAX_BUILDER_ROWS) return draft
  const last = draft.rows[draft.rows.length - 1]
  const d = (last && defOf(defs, last.field)) || defs[0]
  if (!d) return draft
  return { ...draft, rows: [...draft.rows, blankRow(d)] }
}

/** 删一行;删光了回到一行空白(至少留一行可编辑)。 */
export function removeRow(draft: BuilderDraft, index: number, defs: FilterDef[]): BuilderDraft {
  const rows = draft.rows.filter((_, i) => i !== index)
  if (rows.length === 0 && defs[0]) return { ...draft, rows: [blankRow(defs[0])] }
  return { ...draft, rows }
}

/** 改某字段的「且 / 或」(该字段所有条件联动)。 */
export function setFieldLogic(
  draft: BuilderDraft,
  field: string,
  logic: FilterLogic,
): BuilderDraft {
  return { ...draft, logic: { ...draft.logic, [field]: logic } }
}

/**
 * 每行最左一格显示什么:第 1 行 `condition`(引导文字「条件」);其后某行之前已有同字段的行 → `logic`(「且 / 或」下拉,该字段共用);
 * 否则 `and`(跨字段固定「且」,只读文字)。
 */
export type RowLead = 'condition' | 'logic' | 'and'
export function rowLead(draft: BuilderDraft, index: number): RowLead {
  if (index === 0) return 'condition'
  const field = draft.rows[index]?.field
  return draft.rows.slice(0, index).some((r) => r.field === field) ? 'logic' : 'and'
}
