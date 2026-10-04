// 模块注册表:对照页「模块 ↔ 键 ↔ 组件 ↔ 元数据」的唯一来源。ProtoApp 只读它。
// 元数据逐项照抄原型 docs/smart-naive-table-design.html 的 MODULES / GROUPS / MC(natural / rowClick),
// 改原型这几张表时同步这里(tests/proto/registry.test.ts 会拿原型文件对表,漂移会红)。
//
// 组件自动发现:模块 N(N ≥ 5)的组件就是 modules/ProtoM${N}.vue,存在就用,不存在显示 ProtoPlaceholder。
// 所以新增一个模块只需新建 modules/ProtoM5.vue 之类的文件,**不用改注册表**。
// 模块 1–4 指向 ../ProtoModule.vue 并传 { mod: 键 }。
import { defineAsyncComponent, type Component } from 'vue'
import ProtoModule from '../ProtoModule.vue'
import ProtoPlaceholder from './ProtoPlaceholder.vue'

export type ModKey =
  | 'search'
  | 'toolbar'
  | 'filter'
  | 'sort'
  | 'wide'
  | 'dict'
  | 'persist'
  | 'states'
  | 'crud'
  | 'drag'
  | 'ms'
  | 'embed'
  | 'i18n'
  | 'excel'
export type ModStatus = 'done' | 'doing' | 'todo'

export interface ModMeta {
  /** 内部编号:?m=N、docs/baseline 的 mN 文件名;界面上不显示。 */
  no: number
  key: ModKey
  /** 功能名(侧栏 / 面包屑 / 页头标题)。 */
  name: string
  /** 英文功能名(English 下直接出,不走词典)。 */
  en: string
  /** 所属分组名(中文);i18n 不在任何分组里。 */
  group?: string
  /** 侧栏 ★ 亮点。 */
  hl?: boolean
  status: ModStatus
  /** 原型 MC.<key>.natural:整页在主区里滚动、不铺满(#stage[data-nat])。 */
  natural?: boolean
  /** 原型 MC.<key>.rowClick:行可点(#stage[data-rowclick] 行 cursor:pointer)。 */
  rowClick?: boolean
}

export interface ModEntry extends ModMeta {
  comp: Component
  /** 传给组件的 props(1–4:{ mod: 键 })。 */
  props?: Record<string, unknown>
}

export interface GroupMeta {
  name: string
  en: string
  keys: ModKey[]
}

/** 键序 = 原型 MODULES 的声明序(= 编号 1..14)。 */
export const META: ModMeta[] = [
  { no: 1, key: 'search', name: '搜索表单', en: 'Search form', status: 'done' },
  { no: 2, key: 'toolbar', name: '条件搜索', en: 'Query builder', status: 'done', hl: true },
  { no: 3, key: 'filter', name: '表头过滤', en: 'Header filters', status: 'done', hl: true },
  { no: 4, key: 'sort', name: '多列排序', en: 'Multi-column sorting', status: 'done' },
  { no: 5, key: 'wide', name: '多级表头与固定列', en: 'Column groups & pinning', status: 'done' },
  {
    no: 6,
    key: 'dict',
    name: '字典、标签与格式化',
    en: 'Dicts, tags and formats',
    status: 'done',
    hl: true,
  },
  { no: 7, key: 'persist', name: '列设置', en: 'Column settings', status: 'done', hl: true },
  { no: 8, key: 'states', name: '加载与错误处理', en: 'Loading & errors', status: 'done' },
  { no: 9, key: 'crud', name: '增删改弹窗', en: 'CRUD dialogs', status: 'done' },
  { no: 10, key: 'drag', name: '行拖拽排序', en: 'Row reordering', status: 'done', natural: true },
  { no: 11, key: 'ms', name: '主从联动', en: 'Master-detail', status: 'done', rowClick: true },
  {
    no: 12,
    key: 'embed',
    name: '嵌入式表格',
    en: 'Embedded tables',
    status: 'done',
    natural: true,
  },
  { no: 13, key: 'i18n', name: '多语言与页面底色', en: 'Language & background', status: 'done' },
  // 提议:可编辑表格(Excel 式单元格编辑 + 类型推断);侧栏「数据」组第 3 项,带「提议」徽标,不加 ★
  { no: 14, key: 'excel', name: '可编辑表格', en: 'Editable grid', status: 'doing' },
]

/** 侧栏两级目录(原型 GROUPS)。i18n(m13)不在任何分组里,只能 ?m=13 进入。 */
export const GROUPS: GroupMeta[] = [
  { name: '查询', en: 'Query', keys: ['search', 'toolbar', 'filter', 'sort'] },
  { name: '列', en: 'Columns', keys: ['wide', 'dict', 'persist'] },
  { name: '行', en: 'Rows', keys: ['drag', 'ms'] },
  { name: '数据', en: 'Data', keys: ['states', 'crud', 'excel'] },
  { name: '布局', en: 'Layout', keys: ['embed'] },
]

/** 状态徽标文案:只在非「已定」时显示。 */
export const STATUS_TXT: Record<ModStatus, string> = { done: '已定', doing: '提议', todo: '待议' }

/** 缺省模块 = 原型初始模块 toolbar(2)。 */
export const DEFAULT_MOD: ModKey = 'toolbar'

/* ---------- 组件解析 ---------- */
// 懒加载:一个模块文件写坏(编译错误)只影响它自己那一页,不拖垮其它模块。
const loaders = import.meta.glob<{ default: Component }>('./ProtoM*.vue')
export const loaderOf = (no: number): (() => Promise<{ default: Component }>) | undefined =>
  loaders[`./ProtoM${no}.vue`]

function compOf(m: ModMeta): { comp: Component; props?: Record<string, unknown> } {
  if (m.no <= 4) return { comp: ProtoModule, props: { mod: m.key } }
  const load = loaderOf(m.no)
  if (!load) return { comp: ProtoPlaceholder, props: { no: m.no, name: m.name } }
  return { comp: defineAsyncComponent(load) }
}

export const MODULES: ModEntry[] = META.map((m) => ({
  ...m,
  group: GROUPS.find((g) => g.keys.includes(m.key))?.name,
  ...compOf(m),
}))

export const byKey = (k: ModKey): ModEntry => MODULES.find((m) => m.key === k)!
export const byNo = (n: number | string | null | undefined): ModEntry | undefined =>
  MODULES.find((m) => String(m.no) === String(n))
/** 某分组里的模块条目(分组键序)。 */
export const groupModules = (g: GroupMeta): ModEntry[] => g.keys.map(byKey)
