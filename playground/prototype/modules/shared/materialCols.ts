// 「物料单据」列的构建器:模块 2–4 之外的物料单据表(模块 7 / 8 / 9 / 11 / 12 / 13)共用。
// 照原型 COLS:物料编码 112 / 物料名称 176(弹性,minWidth)/ 负责人 88 / 单据状态 96(options + tag)/ 部门 88(options)/
//             金额 104(右对齐、format money)/ 单据日期 112;可选前置勾选(40,固定左)+ 序号(64,固定左)与后置「操作」列(140,固定右)。
// 标题 / options 的 label 都是函数(t),随外壳语言渲染期求值;placeholder 是静态串 → 在 computed 里调用本函数,切语言才会重算:
//   const columns = computed(() => materialCols({ t, selection: true, actions: (row) => h(...) }))
// 构造器字段:search !== false 时每个数据列写 search: { actions: OPS_BY_TYPE[type], … }(模块 2–13 除豁免者外必配),
//   memo: true 再追加一个 hideInTable 的「备注」搜索专用列(原型 FIELD_DEFS 的第 8 个字段)。
// 不依赖 ProtoModule.vue(模块 1–4 有各自的排序 / 过滤配置,自己写)。
import type { VNodeChild } from 'vue'
import type { SmartTableColumn } from '../../../../src/index'
import type { Row } from '../../data'
import { deptOptions, statusOptions } from './options'
import { OPS_BY_TYPE } from './ops'

type T = (zh: string) => string

export type MaterialKey = 'no' | 'name' | 'owner' | 'status' | 'dept' | 'amount' | 'bizDate'
/** 原型 COLS:w = 表格列宽;flex = 弹性列(不写 width、w 当 minWidth)。 */
export const MATERIAL_COLS: { key: MaterialKey; label: string; w: number; flex?: boolean }[] = [
  { key: 'no', label: '物料编码', w: 112 },
  { key: 'name', label: '物料名称', w: 176, flex: true },
  { key: 'owner', label: '负责人', w: 88 },
  { key: 'status', label: '单据状态', w: 96 },
  { key: 'dept', label: '部门', w: 88 },
  { key: 'amount', label: '金额', w: 104 },
  { key: 'bizDate', label: '单据日期', w: 112 },
]

export interface MaterialColsOpts {
  t: T
  /** 只要这几列(按 MATERIAL_COLS 原顺序);缺省 7 列全要。 */
  keys?: MaterialKey[]
  /** 前置勾选列(宽 40,固定左)。 */
  selection?: boolean
  /** 序号列(宽 64,固定左,标题「序号」)。 */
  index?: boolean
  /** 后置「操作」列(宽 140、固定右、不可拖、不进列设置)的单元格渲染。不传 = 没有操作列。 */
  actions?: (row: Row, index: number) => VNodeChild
  /** 构造器字段:每个数据列写 search.actions;false = 不进构造器(豁免)。默认 true。 */
  search?: boolean
  /** 追加只出现在构造器里的「备注」字段(hideInTable)。默认 false。 */
  memo?: boolean
  /** 逐列补丁(浅合并进该列;search / filter 等对象整体替换)。键可以是 MaterialKey | 'memo' | 'actions'。 */
  patch?: Partial<Record<MaterialKey | 'memo' | 'actions', Record<string, any>>>
}

export function materialCols(o: MaterialColsOpts): SmartTableColumn<Row>[] {
  const { t } = o
  const withSearch = o.search !== false
  const patch = o.patch ?? {}
  const fin = (key: string, col: Record<string, any>) =>
    ({ ...col, ...patch[key as keyof typeof patch] }) as SmartTableColumn<Row>

  const dataCols = MATERIAL_COLS.filter((c) => !o.keys || o.keys.includes(c.key)).map((c) => {
    const col: Record<string, any> = { key: c.key, title: () => t(c.label) }
    if (c.flex) col.minWidth = c.w
    else col.width = c.w
    switch (c.key) {
      case 'status':
        col.options = statusOptions(t)
        col.tag = true
        if (withSearch) col.search = { actions: OPS_BY_TYPE.select }
        break
      case 'dept':
        col.options = deptOptions(t)
        if (withSearch) col.search = { actions: OPS_BY_TYPE.select }
        break
      case 'amount':
        col.align = 'right' // 原型:金额单元格右对齐,表头仍左对齐(titleAlign 取全局默认 left)
        col.format = 'money' // 千分位两位小数
        if (withSearch)
          col.search = {
            type: 'number',
            placeholder: t('请输入数字'),
            actions: OPS_BY_TYPE.number,
            props: { showButton: false },
          }
        break
      case 'bizDate':
        if (withSearch) col.search = { type: 'date', actions: OPS_BY_TYPE.date }
        break
      default:
        // no / name / owner:文本,placeholder 取官方 locale 的「请输入 / Please Input」
        if (withSearch) col.search = { actions: OPS_BY_TYPE.text }
    }
    return fin(c.key, col)
  })

  const out: SmartTableColumn<Row>[] = []
  if (o.selection)
    out.push({ type: 'selection', width: 40, fixed: 'left' } as SmartTableColumn<Row>)
  if (o.index)
    out.push({
      type: 'index',
      title: () => t('序号'),
      width: 64,
      fixed: 'left',
    } as SmartTableColumn<Row>)
  out.push(...dataCols)
  if (o.memo) {
    out.push(
      fin('memo', {
        key: 'memo',
        title: () => t('备注'),
        hideInTable: true,
        search: withSearch ? { actions: OPS_BY_TYPE.text } : undefined,
      }),
    )
  }
  if (o.actions) {
    out.push(
      fin('actions', {
        key: 'actions',
        title: () => t('操作'),
        width: 140, // 原型 ACTS_W:「编辑 / 删除」两个文字按钮 + 小图标放得下(设计 §2.15 D)
        fixed: 'right',
        resizable: false, // 原型:操作列没有拖拽把手、也不吸收余量
        hideInSetting: true,
        render: o.actions,
      }),
    )
  }
  return out
}
