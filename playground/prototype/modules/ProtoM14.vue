<script setup lang="ts">
// 模块 14「可编辑表格」(key excel,提议):用真实库的 `editable` 复刻原型 docs/smart-naive-table-design.html 的 MC.excel(设计文档「可编辑表格」一节)。
// 场景「工艺路线设计」:产品「变速箱壳体 GB-2201」的 12 道工序,数组顺序 = 加工顺序。一页里用到:
//   单元格编辑 · 批量保存 · 行拖拽排序(松手即保存顺序)· select-table(工序名称从工序库里选,自动带出其余列)· 行级只读(状态 = 停用)· 合计行 · 条件搜索。
// 列上只声明业务信息,控件靠推断:
//   工序名称:rules.required + editorProps(columns + data → select-table,外部 / 主数据)· 工作中心 / 工序类型 / 状态:声明了 options → 下拉(类型 / 状态带 tag)·
//   准备工时 / 单件工时:只有 rules,类型靠数据值(number)· 报工 / 质检:什么都没声明,靠数据值(boolean → 复选框)· 工艺说明:editor: 'textarea'。
// 「工序号」= 库的序号列 { type: 'index' }(位置 1, 2, 3 …):不是数据、不可编辑;拖动后序号跟着位置变,不产生脏标记,顺序在松手时即时保存(同模块 10,「已保存顺序」);
// 行主键 no(R1 …)是隐藏字段。合计行(naive 的 summary)实时算(含草稿 / 新增行,不含待删行);停用的工序行级只读(editable.rowReadonly,「状态」列 readonly: false 不受影响)。
// 保存方式 = 批量保存。窄档(< 600)走既有卡片(card-on-narrow;标题 = 工序名称,右侧行号 = 工序号)+ 底部抽屉表单(库内置,整行即时保存)。
import { computed, h, ref } from 'vue'
import { useThemeVars } from 'naive-ui'
import {
  SmartTable,
  type EditableConfig,
  type EditChanges,
  type SmartTableColumn,
  type SmartTableInst,
} from '../../../src/index'
import { fetchRoute, saveOrder, saveRoute } from '../backends/m14-routing'
import {
  ROUTE_CENTERS,
  ROUTE_OPS,
  ROUTE_TYPES,
  newRouteRow,
  type OpRow,
  type RouteRow,
} from '../data/m14-routing'
import { registerDict, textW } from '../i18n'
import { OPS_BY_TYPE } from './shared/ops'
import { useProtoTable } from './shared/useProtoTable'
import { useTier } from './shared/useTier'

// 英文词条同原型 EN_PAIRS;业务数据(工序名 / 工作中心 / 工艺说明)不翻译。「检验」「质检」「报工」「状态」只整段匹配(原型 EN_EXACT),
// 否则「检验室」会被译成「Inspection室」。
registerDict(
  [
    ['工艺路线 · 变速箱壳体 GB-2201', 'Routing · Gearbox housing GB-2201'],
    ['新增工序', 'Add operation'],
    ['编辑工序', 'Edit operation'],
    ['工序号', 'Op No.'],
    ['工序名称', 'Operation'],
    ['工作中心', 'Work center'],
    ['工序类型', 'Type'],
    ['准备工时(分)', 'Setup (min)'],
    ['单件工时(分)', 'Per piece (min)'],
    ['报工', 'Reporting'],
    ['质检', 'QC'],
    ['工艺说明', 'Process notes'],
    ['自制', 'In-house'],
    ['外协', 'Outsourced'],
    ['检验', 'Inspection'],
    ['状态', 'Status'],
    ['启用', 'Enabled'],
    ['停用', 'Disabled'],
    ['合计', 'Total'],
    ['工序编码/名称/工作中心', 'Code / name / work center'],
    ['工序编码', 'Code'],
    ['标准准备(分)', 'Std. setup (min)'],
    ['标准单件(分)', 'Std. per piece (min)'],
    ['选择工序', 'Select operation'],
    ['拖动排序', 'Drag to reorder'],
    ['已保存顺序', 'Order saved'],
    ['已放弃修改', 'Changes discarded'],
    ['是', 'Yes'],
    ['否', 'No'],
  ],
  [],
  ['状态', '报工', '质检', '自制', '外协', '检验'],
)

const { shell, t, tableProps, toast } = useProtoTable()
const { el, tier } = useTier()
const themeVars = useThemeVars()
const tableRef = ref<SmartTableInst<RouteRow> | null>(null)
const checked = ref<Array<string | number>>([])

const HANDLE = 'proto-drag-handle'
/* 手柄图标 = 库的 DragIcon(2×3 点阵)的同形 SVG */
const dots = [8, 16].flatMap((x) => [6, 12, 18].map((y) => h('circle', { cx: x, cy: y, r: 1.6 })))
const dragSvg = () =>
  h(
    'svg',
    {
      viewBox: '0 0 24 24',
      width: '1em',
      height: '1em',
      fill: 'currentColor',
      'aria-hidden': 'true',
    },
    dots,
  )

/** 有搜索条件时拖不动(过滤后的可见行下标不是路线里的位置,拖会改错行)。 */
const hasConditions = (): boolean =>
  Object.keys((tableRef.value?.filters as unknown as Record<string, unknown>) ?? {}).length > 0
const removedNos = (): Set<string> => new Set(tableRef.value?.getChanges().removed.map((r) => r.no))
const isLocked = (r: RouteRow) => r.status === '停用'

/* 即时保存顺序:库已把行按新顺序就地重排(rowDragSort.reordered);宿主「落库」后提示。草稿按行跟着走,不产生脏标记,放弃修改也不还原顺序 */
function persistOrder(list: RouteRow[]) {
  void saveOrder(list.map((r) => r.no))
  toast('已保存顺序')
}
function onDragSort(e: { reordered: RouteRow[] }) {
  persistOrder(e.reordered)
}
/* 键盘:手柄聚焦时 ↑ / ↓ 移一位(同模块 10) */
function onHandleKey(e: KeyboardEvent, no: string) {
  if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
  const list = tableRef.value?.rows as unknown as RouteRow[] | undefined
  if (!list) return
  const i = list.findIndex((r) => r.no === no)
  const j = i + (e.key === 'ArrowUp' ? -1 : 1)
  e.preventDefault()
  if (i < 0 || j < 0 || j >= list.length) return
  const [m] = list.splice(i, 1)
  list.splice(j, 0, m)
  persistOrder(list)
  void Promise.resolve().then(() =>
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-rd="${no}"]`)?.focus()),
  )
}
const handleCell = (row: RouteRow) => {
  const off = isLocked(row) || removedNos().has(row.no) || hasConditions()
  return off
    ? h('span', { class: 'proto-drag-off', 'aria-disabled': 'true', 'aria-label': t('拖动排序') }, [
        dragSvg(),
      ])
    : h(
        'span',
        {
          class: HANDLE,
          'data-rd': row.no,
          role: 'button',
          tabindex: 0,
          'aria-label': t('拖动排序'),
          'aria-roledescription': 'draggable',
          onKeydown: (e: KeyboardEvent) => onHandleKey(e, row.no),
        },
        [dragSvg()],
      )
}

const TYPE_TAG: Record<string, 'info' | 'warning' | 'primary'> = {
  自制: 'info',
  外协: 'warning',
  检验: 'primary',
}
const opt = (v: string, tagType?: 'default' | 'primary' | 'info' | 'warning') => ({
  label: () => t(v),
  value: v,
  ...(tagType ? { tagType } : {}),
})
const yesNo = () => [
  { label: () => t('是'), value: true },
  { label: () => t('否'), value: false },
]
const num = () => ({
  type: 'number' as const,
  placeholder: t('请输入数字'),
  actions: OPS_BY_TYPE.number,
  props: { showButton: false },
})

/* 工序库(select-table 的数据源):窄档只显示前 4 列(原型);选一道工序 = 一次写入 5 列(普通草稿编辑,各自脏标记、一步撤销) */
const opColumns = computed<SmartTableColumn<OpRow>[]>(() => {
  const all: SmartTableColumn<OpRow>[] = [
    { key: 'code', title: () => t('工序编码'), width: 96 },
    { key: 'name', title: () => t('工序名称'), width: 96 },
    { key: 'center', title: () => t('工作中心'), width: 108 },
    {
      key: 'type',
      title: () => t('工序类型'),
      width: 96,
      options: ROUTE_TYPES.map((o) => opt(o, TYPE_TAG[o])),
      tag: true,
    },
    { key: 'setup', title: () => t('标准准备(分)'), width: 124, align: 'right' },
    {
      key: 'unit',
      title: () => t('标准单件(分)'),
      width: 108,
      align: 'right',
      format: (v: unknown) => Number(v).toFixed(1),
    },
  ]
  // 窄档:只显示前 4 列,贴底面板的表格盒 ≈ 364px 宽,4 列要放得下(84 + 80 + 100 + 80)
  const NARROW_W = [84, 80, 100, 80]
  return tier.value === 'narrow'
    ? all.slice(0, 4).map((c, i) => ({ ...c, width: NARROW_W[i] }) as SmartTableColumn<OpRow>)
    : all
})

// computed:标题 / label 是函数、渲染期求值;窄档的工序库只有 4 列
const baseColumns = computed<SmartTableColumn<RouteRow>[]>(() => [
  { type: 'selection', width: 40 } as SmartTableColumn<RouteRow>,
  {
    key: 'rd',
    title: '',
    width: 48,
    resizable: false,
    card: 'handle',
    render: handleCell,
  } as SmartTableColumn<RouteRow>,
  // 工序号 = 库的序号列(位置,不是数据、不可编辑;拖动后跟着变);声明在手柄之后,所以排在手柄后面;窄档卡片标题行末尾显示行号(同模块 10)
  { type: 'index', title: () => t('工序号'), width: 80 } as SmartTableColumn<RouteRow>,
  {
    key: 'name',
    title: () => t('工序名称'),
    minWidth: 144,
    rules: { required: true },
    card: 'title',
    search: { actions: OPS_BY_TYPE.text },
    editorProps: {
      columns: opColumns.value,
      data: ROUTE_OPS,
      valueKey: 'code',
      labelKey: 'name',
      title: t('选择工序'),
      // 搜索:编码 / 名称 / 工作中心 / 类型(字符串列),占位符同原型「工序编码/名称/工作中心」;每页条数 [100, 1000, 10000](= 原型 PAGER_CFG)
      searchKeys: ['code', 'name', 'center', 'type'],
      searchPlaceholder: t('工序编码/名称/工作中心'),
      pageSizes: [100, 1000, 10000],
      fill: (p: OpRow) => ({
        center: p.center,
        type: p.type,
        setup: p.setup,
        unit: p.unit,
      }),
    },
  },
  {
    key: 'center',
    title: () => t('工作中心'),
    width: 112,
    options: ROUTE_CENTERS.map((c) => opt(c)),
    card: 'meta',
    search: { actions: OPS_BY_TYPE.select },
  },
  {
    key: 'type',
    title: () => t('工序类型'),
    width: 100,
    options: ROUTE_TYPES.map((o) => opt(o, TYPE_TAG[o])),
    tag: true,
    card: 'meta',
    search: { actions: OPS_BY_TYPE.select },
  },
  {
    key: 'setup',
    title: () => t('准备工时(分)'),
    width: 120,
    align: 'right',
    rules: { int: true, min: 0 },
    card: 'meta',
    search: num(),
  },
  {
    key: 'unit',
    title: () => t('单件工时(分)'),
    width: 120,
    align: 'right',
    format: (v: unknown) => Number(v).toFixed(1),
    editorProps: { precision: 1 },
    rules: { min: 0 },
    card: 'meta',
    search: num(),
  },
  {
    key: 'report',
    title: () => t('报工'),
    width: 72,
    card: 'meta',
    search: { type: 'select', options: yesNo(), actions: OPS_BY_TYPE.select },
  },
  {
    key: 'qc',
    title: () => t('质检'),
    width: 72,
    card: 'meta',
    search: { type: 'select', options: yesNo(), actions: OPS_BY_TYPE.select },
  },
  {
    key: 'note',
    title: () => t('工艺说明'),
    width: 200,
    ellipsis: { tooltip: false },
    editor: 'textarea',
    card: false, // 卡片里不放,抽屉里可编辑
    search: { actions: OPS_BY_TYPE.text },
  },
  {
    key: 'status',
    title: () => t('状态'),
    width: 88,
    options: [opt('启用', 'primary'), opt('停用', 'default')],
    tag: true,
    readonly: false, // 停用的行整行锁定,唯独「状态」可改(否则被停用的工序永远没法再启用)
    card: 'meta',
    search: { actions: OPS_BY_TYPE.select },
  },
])

/* 英文表头宽度按 t(标题) 的真实文字宽度重算,不让标题被截断(原型 titleFit:textW + 28);中文不动 */
const columns = computed<SmartTableColumn<RouteRow>[]>(() =>
  shell.lang !== 'en'
    ? baseColumns.value
    : baseColumns.value.map((c) => {
        if (!('key' in c) || typeof c.title !== 'function') return c
        const w = Math.ceil(textW(String(c.title()))) + 28
        return c.width !== undefined
          ? { ...c, width: Math.max(Number(c.width), w) }
          : { ...c, minWidth: Math.max(Number(c.minWidth ?? 0), w) }
      }),
)

/* 新增行追加在末尾并立刻打开工序库(工艺路线是有序的);停用的工序行级只读 */
const editable = computed<EditableConfig<RouteRow>>(() => ({
  add: { position: 'bottom' },
  labelWidth: 120, // 窄档抽屉标签列:最长「准备工时(分)」72px 放不下(原型 .xl-form 120px)
  newRow: () => newRouteRow(),
  rowReadonly: isLocked,
}))

/* @save:宿主「落库」(500ms)后 done();失败 fail() 保留草稿 */
async function onSave(p: {
  changes: EditChanges<RouteRow>
  done: () => void
  fail: (e?: unknown) => void
}) {
  try {
    const n = await saveRoute(p.changes)
    p.done()
    toast(`已保存 ${n} 处修改`, 'success')
  } catch (e) {
    p.fail(e)
  }
}

/* 合计行(naive 的 summary):pageData 是表里当前的行(含草稿、新增行、停用行);待删行不计 */
const sum = (rows: RouteRow[], key: 'setup' | 'unit') =>
  rows.reduce((n, r) => n + (Number(r[key]) || 0), 0)
function summary(pageData: unknown) {
  const removed = removedNos()
  const rows = (pageData as RouteRow[]).filter((r) => !removed.has(r.no))
  return {
    name: { value: t('合计') },
    setup: { value: String(sum(rows, 'setup')) },
    unit: { value: sum(rows, 'unit').toFixed(1) },
  }
}

// 库文案:抽屉标题 / 新增按钮用工序口径(库默认是通用的「新增行 / 新增 / 编辑」)
const labels = computed(() => ({
  editAddRow: t('新增工序'),
  editNewTitle: t('新增工序'),
  editEditTitle: t('编辑工序'),
}))
</script>

<template>
  <div ref="el" class="proto-host">
    <SmartTable
      ref="tableRef"
      v-bind="tableProps"
      v-model:checked-row-keys="checked"
      card-on-narrow
      row-draggable
      fill-height
      :drag-handle="'.' + HANDLE"
      :editable="editable"
      :columns="columns"
      :fetcher="fetchRoute"
      row-key="no"
      :title="t('工艺路线 · 变速箱壳体 GB-2201')"
      :search="{ container: 'table' }"
      :filter="false"
      :pagination="false"
      :toolbar="{ maximize: true }"
      :labels="labels"
      :summary="summary"
      @row-drag-sort="onDragSort"
      @save="onSave"
      @discard="toast('已放弃修改')"
      @invalid="(e) => toast(e.message, 'error')"
    />
  </div>
</template>

<style scoped>
.proto-host {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.proto-host > :deep(.smart-table) {
  flex: 1 1 0;
}
/* 原型 .st-title:h3 行高 ≈ 1.3(工具栏 21px);库标题继承 1.6 → 25.6px(与模块 10 同一处理) */
.proto-host :deep(.smart-table-title) {
  line-height: 21px;
}
/* 拖拽手柄(与模块 10 同款):24×24、圆角 3、textColor3、grab;悬停 = 按钮悬停底;停用态(.proto-drag-off)= 原型 .drag-handle.off:半透明、not-allowed */
.proto-host :deep(.proto-drag-handle),
.proto-host :deep(.proto-drag-off) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  margin: -2px 0;
  border-radius: 3px;
  color: v-bind('themeVars.textColor3');
  cursor: grab;
  touch-action: none;
  user-select: none;
  font-size: 16px;
}
.proto-host :deep(.proto-drag-handle:hover) {
  background: v-bind('themeVars.buttonColor2Hover');
  color: v-bind('themeVars.textColor1');
}
/* 表格里手柄 24px 是 inline-flex、按基线对齐,会把 22.4px 的行内盒撑到约 26px → 紧凑行高 39.4 变 41.4;顶对齐 + 上下各 -1px = 22px,行高不变(原型 [data-xl] td.rd-h .drag-handle) */
.proto-host :deep(td .proto-drag-handle),
.proto-host :deep(td .proto-drag-off) {
  vertical-align: top;
  margin: -1px 0;
}
.proto-host :deep(.proto-drag-off) {
  opacity: 0.35;
  cursor: not-allowed;
}
</style>
