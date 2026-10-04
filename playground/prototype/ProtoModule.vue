<script setup lang="ts">
// 对照页的一个模块:用真实库(../../src)复刻原型的一张表。
// 规则:宿主能配的都照原型配(全局默认见 ProtoApp 的 provide、props、插槽里的宿主按钮、fillHeight、collapsible 搜索……);
// 库做不到的(列头筛选面板的窄档抽屉……)一律留空,不用自定义代码假装;窄档卡片 / 操作折叠 / 排序抽屉是库的 cardOnNarrow,这里只加 card-on-narrow。
// 除模块 1(独立搜索表单卡)外,模块 2 / 3 / 4 的工具栏都是真实的一行式条件构造器(search.container: 'table'),
// 比较符取原型 OPS_BY_TYPE;批量栏(#batch)与放大(toolbar.maximize)四个模块都有(原型每个模块的 iconsHtml() 都带放大按钮)。
// 库默认就对的地方宿主**不覆盖**:空状态(官方 NEmpty「无数据」)、日期占位(官方 locale 的「选择日期」)、loading(NDataTable 官方样子)。
// 外壳四个开关对本模块生效 —— 密度 / 语言经 useProtoTable(),底色 / 明暗在 ProtoApp。
// 列标题、搜索 label、字典 label 都是函数(t),宿主文案走 t();列配置是 computed(placeholder 是静态串,切语言才会重算)。
// 新增 / 编辑弹窗在本模块里是内联 NModal(模块 7 / 8 / 9 用 modules/shared/CrudModal.vue)。
import { computed, h, ref } from 'vue'
import {
  NButton,
  NDatePicker,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NModal,
  NPopconfirm,
  NSelect,
  NSpace,
  useDialog,
  useThemeVars,
  type FormInst,
  type FormRules,
} from 'naive-ui'
import {
  SmartTable,
  useTableCrud,
  type SmartTableColumn,
  type SmartTableInst,
  type FilterState,
  type FilterValue,
  type SmartTableParams,
} from '../../src/index'
import {
  CSV_HEAD,
  MONTH_RANGE,
  OWNERS,
  approveRows,
  blankForm,
  createRow,
  delRow,
  delRows,
  rowsToCsv,
  updateRow,
  type Row,
  type RowForm,
} from './data'
import { MOCK_DELAY, fetchRows, queryRows } from './fetcher'
import { textW } from './i18n'
import {
  deptOptions as makeDeptOptions,
  statusOptions as makeStatusOptions,
} from './modules/shared/options'
import { OPS_BY_TYPE as ACT } from './modules/shared/ops'
import {
  ACT_BTN,
  ProtoAddButton,
  downloadCsv,
  moreOptions as makeMoreOptions,
} from './modules/shared/toolbar'
import { useProtoTable } from './modules/shared/useProtoTable'

type Mod = 'search' | 'toolbar' | 'filter' | 'sort'
const props = defineProps<{ mod: Mod }>()

const { shell, t, tableProps, toast, message } = useProtoTable()
const dialog = useDialog()
const tableRef = ref<SmartTableInst<Row> | null>(null)
const checked = ref<Array<string | number>>([])

const hdr = props.mod === 'filter' || props.mod === 'sort'

/* ---- 原型 COLS(w = 表格列宽,flex = 弹性列:不写 width、w 当最小宽度) ---- */
const COLS = [
  { key: 'no', label: '物料编码', w: 112 },
  { key: 'name', label: '物料名称', w: 176, flex: true },
  { key: 'owner', label: '负责人', w: 88 },
  { key: 'status', label: '单据状态', w: 96 },
  { key: 'dept', label: '部门', w: 88 },
  { key: 'amount', label: '金额', w: 104 },
  { key: 'bizDate', label: '单据日期', w: 112 },
]

/* ---- 原型 H_CFG:模块 3 = sorter: true(单列互斥);模块 4 = sorter: { multiple: n } + 日期列 defaultSortOrder
   单据状态(status)也可排,multiple: 4(原型 H_CFG.sort.sorters.status,字典顺序见 fetcher.ts 的 STATUS_RANK,不是 label 拼音)---- */
const SORTERS: Record<string, Record<string, any>> = {
  filter: { no: true, amount: true, bizDate: true },
  sort: {
    status: { multiple: 4 },
    dept: { multiple: 3 },
    amount: { multiple: 2 },
    bizDate: { multiple: 1 },
  },
}
const sorterOf = (key: string) => (hdr ? SORTERS[props.mod][key] : undefined)

/* 原型 hdrColW:模块 3 / 4 的列宽要放得下「标题 + 漏斗 + 箭头」 */
const labelW = (c: (typeof COLS)[number]) =>
  shell.lang === 'en' ? Math.ceil(textW(t(c.label))) : Math.ceil(c.label.length * 14.5)
const hdrColW = (c: (typeof COLS)[number]) =>
  Math.max(c.w, 12 + labelW(c) + 30 + (sorterOf(c.key) ? 21 : 0) + 16)
/* 原型 colMin:模块 3 / 4 的初始列宽不能低于自己的拖拽下限,否则一开始拖就跳一下。
   下限 = 库的 headerIconFloor(useColumns.ts)同一套算法:左内边距 12 + 标题占位 44(两个字)+ 漏斗簇 30(模块 3 / 4 列头恒有过滤)
   + 箭头簇 21(可排序时)+ 右内边距 16;与库的 resizeMinWidth 下限(60)取大者——这两个数恒 ≥ 60,下面直接按 102 / 123 算。*/
const colMin = (c: (typeof COLS)[number]) => (sorterOf(c.key) ? 123 : 102)
// 英文表头宽度按 t(label) 的真实文字宽度重算,不让标题被截断(原型 titleFit:textW + 28)
const colW = (c: (typeof COLS)[number]) =>
  hdr ? Math.max(hdrColW(c), colMin(c)) : shell.lang === 'en' ? Math.max(c.w, labelW(c) + 28) : c.w

/* 比较符 ACT = 原型 OPS_BY_TYPE(modules/shared/ops.ts):库默认只给 8 个,宿主在列上写 search.actions / filter.actions 才出现新的 */

/* 状态徽标(原型 STATUS_CLS):语义色 NTag small bordered —— 已审核 success、未审核 warning、已关闭 default(全局 tag 默认见 ProtoApp);
   label 是函数,随语言求值(modules/shared/options.ts) */
const statusOptions = makeStatusOptions(t)
const deptOptions = makeDeptOptions(t)
const STATUS_DEFAULT = {
  logic: 'and' as const,
  conditions: [{ action: 'equal' as const, value: '未审核' }],
}

/* 模块 1 搜索区字段顺序(原型 SF_DEFS_SEARCH):物料编码 · 单据日期(span 2)· 单据状态 · 物料名称 · 负责人 · 部门 · 金额 · 仅看加急 · 备注(span 2) */
const SEARCH_ORDER: Record<string, number> = {
  no: 1,
  bizDate: 2,
  status: 3,
  name: 4,
  owner: 5,
  dept: 6,
  amount: 7,
  urgent: 8,
  memo: 9,
}
const srch = (key: string, cfg: Record<string, any> = {}) => ({ order: SEARCH_ORDER[key], ...cfg })

/* 负责人搜索控件(原型 ctl: 'multi'):search.render 自定义,宿主用 NSelect multiple 拼 */
const ownerSearch = {
  order: SEARCH_ORDER.owner,
  render: (ctx: { value: unknown; setValue: (v: unknown) => void }) =>
    h(NSelect, {
      multiple: true,
      value: Array.isArray(ctx.value) ? (ctx.value as string[]) : [],
      'onUpdate:value': (v: string[]) => ctx.setValue(v),
      options: OWNERS.map((o) => ({ label: o, value: o })),
      placeholder: t('请选择'),
    }),
}

/* 负责人列头过滤的自定义面板(原型 H_CUSTOM.filter.owner / custOwner,仅模块 3):宿主用 NButton 拼负责人选择,
   点一下就经 setValue 落到过滤态并重新请求,面板不自带「确认」。当前值 = 单条 in(数组)或「我负责的」写入的单条 equal。 */
const ownerFilter = {
  render: ({
    value,
    setValue,
  }: {
    value: FilterValue | null
    setValue: (v: FilterValue | null) => void
  }) => {
    const cv = value?.conditions[0]?.value
    const cur: string[] = Array.isArray(cv) ? [...(cv as string[])] : cv ? [String(cv)] : []
    const toggle = (o: string) => {
      const next = cur.includes(o) ? cur.filter((x) => x !== o) : [...cur, o]
      setValue(next.length ? { logic: 'and', conditions: [{ action: 'in', value: next }] } : null)
    }
    return h(
      'div',
      {
        style: 'display:flex;flex-wrap:wrap;gap:8px;padding:12px;width:244px;box-sizing:border-box',
      },
      OWNERS.map((o) =>
        h(
          NButton,
          {
            size: 'tiny',
            type: cur.includes(o) ? 'primary' : 'default',
            ghost: cur.includes(o),
            onClick: () => toggle(o),
          },
          () => o,
        ),
      ),
    )
  },
}

const fieldCol = (c: (typeof COLS)[number] & { flex?: boolean }): SmartTableColumn<Row> => {
  const base: Record<string, any> = { key: c.key, title: () => t(c.label) }
  if (c.flex) base.minWidth = c.w
  else base.width = colW(c)
  const s = sorterOf(c.key)
  if (s) base.sorter = s
  if (props.mod === 'sort' && c.key === 'bizDate') base.defaultSortOrder = 'descend'

  // 搜索(只模块 1):按原型 SF_DEFS_SEARCH 配 input / select / number / daterange / switch / render 自定义 / span
  switch (c.key) {
    case 'status':
      base.options = statusOptions
      base.tag = true
      if (props.mod === 'search') base.search = srch('status')
      // 模块 3 的单据状态不进条件构造器(原型的构造器有这个字段,对照页留空):库里搜索与列头漏斗共用同一份过滤态,
      // 一旦进构造器,默认过滤「未审核」会落在工具栏主行,而库不为「主行里的唯一一条」画 chip,「默认过滤出现一个 chip」的行为就变了
      else if (props.mod !== 'filter') base.search = { actions: ACT.select }
      // 原型模块 3:单据状态带 filter.defaultValue = 未审核 —— 初始过滤态 = 默认值,面板「重置」恢复默认,chips 行末偏离默认时出现「恢复默认」
      if (hdr)
        base.filter = {
          actions: ACT.select,
          ...(props.mod === 'filter' ? { defaultValue: STATUS_DEFAULT } : {}),
        }
      break
    case 'dept':
      base.options = deptOptions
      if (props.mod === 'search') base.search = srch('dept')
      else base.search = { actions: ACT.select }
      // 原型模块 3:部门是单选勾选列(filter.multiple: false,官方用 NRadio)
      if (hdr)
        base.filter = {
          actions: ACT.select,
          ...(props.mod === 'filter' ? { multiple: false } : {}),
        }
      break
    case 'amount':
      base.align = 'right' // 原型:金额单元格右对齐,表头仍左对齐(titleAlign 取全局默认 left)
      base.format = 'money' // 千分位两位小数(12,800.00)
      if (props.mod === 'search')
        base.search = srch('amount', {
          type: 'number',
          placeholder: t('请输入数字'),
          props: { clearable: false, showButton: false },
        })
      else
        base.search = {
          type: 'number',
          placeholder: t('请输入数字'),
          actions: ACT.number,
          props: { showButton: false },
        }
      if (hdr) base.filter = { type: 'number', actions: ACT.number }
      break
    case 'bizDate':
      // 单据日期:daterange,占 2 格,默认「本月」(重置回本月而不是清空)
      if (props.mod === 'search')
        base.search = srch('bizDate', {
          type: 'daterange',
          span: 2,
          defaultValue: [...MONTH_RANGE],
        })
      else base.search = { type: 'date', actions: ACT.date }
      if (hdr) base.filter = { type: 'date', actions: ACT.date }
      break
    case 'owner':
      if (props.mod === 'search') base.search = ownerSearch
      else base.search = { placeholder: t('请输入'), actions: ACT.text }
      if (hdr)
        base.filter = props.mod === 'filter' ? ownerFilter : { type: 'input', actions: ACT.text }
      break
    default:
      if (props.mod === 'search')
        base.search = srch(c.key, { placeholder: t('请输入'), props: { clearable: false } })
      else base.search = { placeholder: t('请输入'), actions: ACT.text }
      if (hdr) base.filter = { type: 'input', actions: ACT.text }
  }
  return base as SmartTableColumn<Row>
}

/* 删除:行内「删除」先弹 NPopconfirm(与 playground/DemoCrud.vue 一致,文案「确认删除该行?」),点「确认」才真删 */
const rowActions = (row: Row) =>
  h(NSpace, { size: 12, wrapItem: false }, () => [
    h(NButton, { text: true, style: ACT_BTN, onClick: () => crud.openEdit(row) }, () => t('编辑')),
    h(
      NPopconfirm,
      { onPositiveClick: () => void onDel(row.no) },
      {
        trigger: () => h(NButton, { text: true, type: 'error', style: ACT_BTN }, () => t('删除')),
        default: () => t('确认删除该行?'),
      },
    ),
  ])

const columns = computed<SmartTableColumn<Row>[]>(() => [
  // 原型:勾选列与序号列固定在左(序号宽 64、跨页连续),操作列固定在右
  { type: 'selection', width: 40, fixed: 'left' },
  { type: 'index', title: () => t('序号'), width: 64, fixed: 'left' },
  ...COLS.map(fieldCol),
  // 只出现在搜索里、不进表格:模块 1 的搜索表单有「仅看加急」(switch,开 = 备注 = 加急)与「备注」(input,span 2);
  // 模块 2 / 3 / 4 的条件构造器字段 = 原型 FIELD_DEFS 的 8 个字段,「备注」是只在构造器里出现的搜索专用列(switch 放不进一行,构造器没有「仅看加急」)
  ...(props.mod === 'search'
    ? ([
        {
          key: 'urgent',
          title: () => t('仅看加急'),
          hideInTable: true,
          search: srch('urgent', { type: 'switch' }),
        },
        {
          key: 'memo',
          title: () => t('备注'),
          hideInTable: true,
          search: srch('memo', { span: 2, placeholder: t('请输入'), props: { clearable: false } }),
        },
      ] as SmartTableColumn<Row>[])
    : ([
        {
          key: 'memo',
          title: () => t('备注'),
          hideInTable: true,
          search: { placeholder: t('请输入'), actions: ACT.text },
        },
      ] as SmartTableColumn<Row>[])),
  {
    key: 'actions',
    title: () => t('操作'),
    width: 120, // 原型 ACTS_W:「编辑 / 删除」两个文字按钮放得下,112 会被省略号截断
    fixed: 'right',
    resizable: false, // 原型:操作列没有拖拽把手、也不吸收余量
    hideInSetting: true,
    render: rowActions,
  } as SmartTableColumn<Row>,
])

/* 记下最近一次请求的参数:「导出」= 后端按当前生效的条件导出全部行(不是当前页) */
let lastParams: Partial<SmartTableParams> = {}
const fetcher = (p: SmartTableParams) => {
  lastParams = p
  return fetchRows(p)
}

/* 「更多」菜单:官方 NDropdown options 原样透传(modules/shared/toolbar.ts);选中后库发 moreSelect,导出 / 导入由宿主处理 */
const moreOptions = makeMoreOptions(t)
/** 原型 importCsv:弹文件选择,读 CSV 数行数(不改数据,只反馈)。 */
function importCsv() {
  const inp = document.createElement('input')
  inp.type = 'file'
  inp.accept = '.csv,text/csv'
  inp.onchange = () => {
    const f = inp.files?.[0]
    if (!f) return
    void f.text().then((txt) =>
      toast(
        `已导入 ${f.name}:${Math.max(
          0,
          txt
            .replace(/^\ufeff/, '')
            .split(/\r?\n/)
            .filter(Boolean).length - 1,
        )} 条`,
      ),
    )
  }
  inp.click()
}
function onMore(key: string | number) {
  if (key === 'export') {
    const rows = queryRows(lastParams)
    downloadCsv('物料单据.csv', rowsToCsv(rows))
    toast(`已导出 ${rows.length} 条`)
  } else if (key === 'import') importCsv()
  else if (key === 'tpl') {
    downloadCsv('物料导入模板.csv', CSV_HEAD.join(','))
    toast('已下载导入模板')
  }
}

/* 批量栏(原型 .tb-batch):批量审核 = 勾选行里「未审核」改「已审核」;批量删除 = NDialog warning 确认(原型 dlg-card),作用于全部已勾选行含其它页的 */
async function onBatchApprove(keys: Array<string | number>, clear: () => void) {
  const n = approveRows(keys.map(String))
  clear()
  await tableRef.value?.refresh()
  toast(n ? `已审核 ${n} 项` : `所选 ${keys.length} 项无需审核`)
}
function onBatchDelete(keys: Array<string | number>, clear: () => void) {
  dialog.warning({
    title: t('确认删除'),
    content: t(`确定删除所选 ${keys.length} 项吗?`),
    positiveText: t('确认'),
    negativeText: t('取消'),
    onPositiveClick: async () => {
      const n = delRows(keys.map(String))
      clear()
      await tableRef.value?.refresh()
      toast(`已删除 ${n} 项`, 'success')
    },
  })
}

async function onDel(no: string) {
  if (delRow(no)) {
    checked.value = checked.value.filter((k) => k !== no)
    await tableRef.value?.refresh()
    toast(`已删除 ${no}`)
  }
}

/* ---- 新增 / 编辑:useTableCrud + NModal(原型 CRUD 弹窗:宽 480、label 左置 80、必填校验、编码唯一、提交带 loading,成功「操作成功」) ---- */
const backend = (fn: () => void) =>
  new Promise<void>((resolve, reject) =>
    setTimeout(
      () => {
        try {
          fn()
          resolve()
        } catch (e) {
          reject(e)
        }
      },
      MOCK_DELAY.ms > 0 ? 700 : 0,
    ),
  )
const crud = useTableCrud<Row, RowForm>({
  form: blankForm,
  toForm: (row) => ({
    no: row.no,
    name: row.name,
    owner: row.owner,
    status: row.status,
    dept: row.dept,
    amount: row.amount,
    bizDate: row.bizDate,
    memo: row.memo,
  }),
  create: (f) => backend(() => createRow(f)),
  update: (f, row) =>
    backend(() => {
      updateRow(f, row.no)
      checked.value = checked.value.map((k) => (k === row.no ? f.no.trim() : k))
    }),
  onSuccess: () => {
    toast('操作成功', 'success')
    // 新增 → search():回第 1 页;编辑 → refresh():停在当前页
    void (crud.mode.value === 'create' ? tableRef.value?.search() : tableRef.value?.refresh())
  },
  onError: (e) => message.error(t(e instanceof Error ? e.message : String(e))),
})
const formRef = ref<FormInst | null>(null)
const req = (msg: string, trigger: string[] = ['input', 'blur']) => ({
  required: true,
  message: msg,
  trigger,
})
const formRules = computed<FormRules>(() => ({
  no: req(t('请输入物料编码')),
  name: req(t('请输入物料名称')),
  bizDate: req(t('请选择单据日期'), ['change', 'blur']),
}))
const optsOf = (vs: readonly string[], tr = false) =>
  vs.map((v) => ({ label: tr ? t(v) : v, value: v }))
async function onSave() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  await crud.submit()
}

/* 模块 3 #toolbar 插槽:宿主的快捷过滤按钮「我负责的」(经 setFilter 写负责人列的过滤值;再点一次清除) */
const themeVars = useThemeVars()
const mineOn = computed(() => {
  const v = (tableRef.value?.filters as unknown as FilterState | undefined)?.owner
  return v?.conditions.length === 1 && v.conditions[0].action === 'equal'
})
function toggleMine() {
  tableRef.value?.setFilter(
    'owner',
    mineOn.value ? null : { logic: 'and', conditions: [{ action: 'equal', value: '张伟' }] },
  )
}

/* 模块 1 的搜索区:首行 + 展开 / 收起(collapsible);label 区 70px(库的 labelWidth 含 12px 右内边距 = 原型 62px 文字区 + 8px 间距) */
const searchCfg =
  props.mod === 'search' ? { collapsible: true, labelWidth: 70 } : { container: 'table' as const }
</script>

<template>
  <div class="proto-host">
    <SmartTable
      ref="tableRef"
      :columns="columns"
      :fetcher="fetcher"
      row-key="no"
      :title="t('物料单据')"
      :search="searchCfg"
      :toolbar="{ more: moreOptions, maximize: true }"
      v-bind="tableProps"
      card-on-narrow
      fill-height
      :filter-chips="hdr ? true : undefined"
      v-model:checked-row-keys="checked"
      @more-select="onMore"
    >
      <!-- 原型模块 3:#toolbar 左侧插槽放宿主的快捷过滤按钮「我负责的」(NButton quaternary,内边距 0 8px;生效时底色 = quaternary hover) -->
      <template v-if="mod === 'filter'" #toolbar>
        <n-button
          quaternary
          :aria-pressed="mineOn"
          :theme-overrides="{
            paddingMedium: '0 8px',
            colorQuaternary: mineOn ? themeVars.buttonColor2Hover : undefined,
          }"
          @click="toggleMine"
        >
          {{ t('我负责的') }}
        </n-button>
      </template>
      <template #toolbar-right>
        <!-- 「新增」图标 13px:见 modules/shared/toolbar.ts ProtoAddButton -->
        <proto-add-button
          :type="mod === 'search' ? 'default' : 'primary'"
          :label="t('新增')"
          @click="crud.openCreate()"
        />
      </template>
      <!-- 批量栏(原型 .tb-batch):批量审核 + 批量删除(原型是 NDialog warning 确认,这里 useDialog().warning) -->
      <template #batch="{ checkedRowKeys, clear }">
        <n-button @click="onBatchApprove(checkedRowKeys, clear)">{{ t('批量审核') }}</n-button>
        <n-button
          :text-color="themeVars.errorColor"
          aria-haspopup="dialog"
          @click="onBatchDelete(checkedRowKeys, clear)"
          >{{ t('批量删除') }}</n-button
        >
      </template>
      <template #pagination-prefix="info">{{ t(`共 ${info.itemCount} 条`) }}</template>
    </SmartTable>

    <!-- 原型 CRUD 弹窗:NModal preset=card 宽 480;NForm 左置 label、宽 80;footer 取消 / 保存(保存带 loading) -->
    <n-modal
      v-model:show="crud.visible.value"
      preset="card"
      style="width: 480px"
      :title="t(crud.mode.value === 'create' ? '新增物料' : '编辑物料')"
      :mask-closable="!crud.submitting.value"
      :close-on-esc="!crud.submitting.value"
    >
      <n-form
        ref="formRef"
        :model="crud.model.value"
        :rules="formRules"
        label-placement="left"
        label-width="80"
        require-mark-placement="right"
      >
        <n-form-item :label="t('物料编码')" path="no"
          ><n-input v-model:value="crud.model.value.no" :placeholder="t('请输入物料编码')"
        /></n-form-item>
        <n-form-item :label="t('物料名称')" path="name"
          ><n-input v-model:value="crud.model.value.name" :placeholder="t('请输入物料名称')"
        /></n-form-item>
        <n-form-item :label="t('负责人')" path="owner"
          ><n-select
            v-model:value="crud.model.value.owner"
            :options="optsOf(OWNERS)"
            :placeholder="t('请选择')"
        /></n-form-item>
        <n-form-item :label="t('单据状态')" path="status"
          ><n-select
            v-model:value="crud.model.value.status"
            :options="optsOf(['已审核', '未审核', '已关闭'], true)"
            :placeholder="t('请选择')"
        /></n-form-item>
        <n-form-item :label="t('部门')" path="dept"
          ><n-select
            v-model:value="crud.model.value.dept"
            :options="optsOf(['采购部', '生产部', '仓储部'], true)"
            :placeholder="t('请选择')"
        /></n-form-item>
        <n-form-item :label="t('金额')" path="amount"
          ><n-input-number
            v-model:value="crud.model.value.amount"
            :clearable="false"
            :placeholder="t('请输入数字')"
            style="width: 100%"
        /></n-form-item>
        <n-form-item :label="t('单据日期')" path="bizDate"
          ><n-date-picker
            v-model:formatted-value="crud.model.value.bizDate"
            type="date"
            value-format="yyyy-MM-dd"
            style="width: 100%"
        /></n-form-item>
        <n-form-item :label="t('备注')" path="memo"
          ><n-input
            v-model:value="crud.model.value.memo"
            type="textarea"
            :rows="3"
            :resizable="false"
            :placeholder="t('请输入备注')"
        /></n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button :disabled="crud.submitting.value" @click="crud.close()">{{
            t('取消')
          }}</n-button>
          <n-button type="primary" :loading="crud.submitting.value" @click="onSave">{{
            t('保存')
          }}</n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<style scoped>
/* 宿主给 fillHeight 的确定高度:flex 链末端(.viewport 内的剩余高度) */
.proto-host {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.proto-host > :deep(.smart-table) {
  flex: 1 1 0;
}
</style>
