<script setup lang="ts">
// 模块 12「嵌入式表格」:用真实库复刻原型 embedPageHtml。整页 = 两张表 + 一个弹窗(natural:整页在主区里滚动,不铺满):
//   ① 「入库明细」子表:静态 data · search:false · toolbar:false(只剩标题 + 右侧「添加物料」)· pagination:false · striped + 合计行(summary)
//   ② 「选择物料」弹窗:search.container:'none'(无卡片、单行自动换行的内联搜索)+ 勾选 + toolbar:false + 每页 8 行(simple 分页);窄档改底部抽屉
//   ③ 下方「物料单据」主表:不开 fillHeight(整页滚动),翻页后卡片顶部滚出就滚回(库内置);每页 20 / 50
// 对照脚本靠 data-parity 区分两张表:子表外层 data-parity="sub"、主表外层 data-parity="main"。
// 库做不到的原型效果不造假。
import { computed, h, ref } from 'vue'
import {
  NButton,
  NDatePicker,
  NDrawer,
  NDrawerContent,
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
  type SmartTableParams,
  type PageResult,
} from '../../../src/index'
import {
  CSV_HEAD,
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
} from '../data'
import { PICK_PS, detRow, initialDet, pickCandidates, sumDet, type DetRow } from '../data/m12-det'
import { MOCK_DELAY, fetchRows, queryRows } from '../fetcher'
import { registerDict, textW } from '../i18n'
import { materialCols } from './shared/materialCols'
import { STATUS_VALUES, statusOptions } from './shared/options'
import {
  ACT_BTN,
  downloadCsv,
  moreOptions as makeMoreOptions,
  protoToolbar,
} from './shared/toolbar'
import { useProtoTable } from './shared/useProtoTable'
import { useTier } from './shared/useTier'

registerDict(
  [
    ['入库明细', 'Receipt lines'],
    ['添加物料', 'Add material'],
    ['选择物料', 'Select materials'],
    ['确定', 'OK'],
    ['名称', 'Name'],
  ],
  [[/已添加 (\d+) 项/g, 'Added $1 item(s)']],
)

const { shell, t, tableProps, toast, message } = useProtoTable()
const dialog = useDialog()
const themeVars = useThemeVars()
const { el: hostEl, tier } = useTier()
const isNarrow = computed(() => tier.value === 'narrow')

/* ================= ① 入库明细子表 ================= */
const det = ref<DetRow[]>(initialDet())
const fmtMoney = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const num = { align: 'right', titleAlign: 'right' } as const
const subColumns = computed<SmartTableColumn<DetRow>[]>(() => [
  { type: 'index', title: () => t('序号'), width: 64 },
  { key: 'no', title: () => t('物料编码'), width: 120 },
  { key: 'name', title: () => t('物料名称'), minWidth: 120 },
  { key: 'qty', title: () => t('数量'), width: 96, ...num },
  { key: 'price', title: () => t('单价'), width: 112, format: 'money', ...num },
  { key: 'amt', title: () => t('金额'), width: 128, format: 'money', ...num },
  {
    key: 'ops',
    title: '',
    width: 72,
    render: (row: DetRow) =>
      h(
        NButton,
        {
          text: true,
          type: 'error',
          onClick: () => (det.value = det.value.filter((d) => d.no !== row.no)),
        },
        () => t('移除'),
      ),
  },
])
/** 合计行(原型 .sum-row):合计 / 数量合计 / 金额合计;没有行时不出合计。 */
const summary = (): Record<string, { value: string | number }> | [] => {
  if (!det.value.length) return []
  const s = sumDet(det.value)
  return { no: { value: t('合计') }, qty: { value: s.qty }, amt: { value: fmtMoney(s.amt) } }
}

/* ================= ② 选择物料弹窗 ================= */
const pickShow = ref(false)
const pickChecked = ref<Array<string | number>>([])
function openPick() {
  pickChecked.value = []
  pickShow.value = true
}
const closePick = () => (pickShow.value = false)
function okPick() {
  const n = pickChecked.value.length
  for (const no of pickChecked.value) det.value.push(detRow(String(no)))
  closePick()
  toast(`已添加 ${n} 项`, 'success')
}
/** 候选行的「后端」:同步切片(原型 pickRows 也是同步的,没有 loading)。 */
const pickFetcher = async (p: SmartTableParams): Promise<PageResult<Row>> => {
  const all = pickCandidates(
    new Set(det.value.map((d) => d.no)),
    String(p.kw ?? ''),
    String(p.status ?? ''),
  )
  return { items: all.slice((p.page - 1) * p.pageSize, p.page * p.pageSize), total: all.length }
}
/** 弹窗里的表格不要卡片外框 / 内边距(原型 .pk-tbl 直接放在弹窗正文里,弹窗卡片同色)。 */
const pickCardProps = { bordered: false, themeOverrides: { paddingSmall: '0' } }
const pickColumns = computed<SmartTableColumn<Row>[]>(() => [
  {
    key: 'kw',
    title: () => t('关键字'),
    hideInTable: true,
    search: { placeholder: t('物料编码 / 名称'), order: 1, props: { style: { width: '168px' } } },
  },
  { type: 'selection', width: 40 },
  { key: 'no', title: () => t('物料编码'), width: 112 },
  { key: 'name', title: () => t('物料名称'), minWidth: 120 },
  {
    key: 'status',
    title: () => t('单据状态'),
    width: 96,
    options: statusOptions(t),
    tag: true,
    search: { order: 2, placeholder: t('请选择'), props: { style: { width: '168px' } } },
  },
  { key: 'amount', title: () => t('金额'), width: 112, format: 'money', ...num },
])

/* ================= ③ 物料单据主表 ================= */
const tableRef = ref<SmartTableInst<Row> | null>(null)
const checked = ref<Array<string | number>>([])
const moreOptions = makeMoreOptions(t)
const toolbar = protoToolbar({ more: moreOptions })

/* 记下最近一次请求的参数:「导出」= 后端按当前条件导出全部行 */
let lastParams: Partial<SmartTableParams> = {}
const fetcher = (p: SmartTableParams) => {
  lastParams = p
  return fetchRows(p)
}
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
            .replace(/^\uFEFF/, '')
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
/* 英文表头宽度按 t(标题) 的真实文字宽度重算,不让标题被截断(原型 titleFit:textW + 28);中文不动 */
const fitTitles = (cols: SmartTableColumn<Row>[]): SmartTableColumn<Row>[] =>
  shell.lang !== 'en'
    ? cols
    : cols.map((c) => {
        if ('type' in c || typeof c.title !== 'function' || c.key === 'actions') return c
        const w = Math.ceil(textW(String(c.title()))) + 28
        if (c.width != null) return w > Number(c.width) ? { ...c, width: w } : c
        return w > Number(c.minWidth ?? 0) ? { ...c, minWidth: w } : c
      })

const columns = computed<SmartTableColumn<Row>[]>(() =>
  fitTitles(materialCols({ t, selection: true, index: true, memo: true, actions: rowActions })),
)

async function onDel(no: string) {
  if (delRow(no)) {
    checked.value = checked.value.filter((k) => k !== no)
    await tableRef.value?.refresh()
    toast(`已删除 ${no}`)
  }
}
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

/* 新增 / 编辑弹窗(原型 CRUD 弹窗:宽 480、label 左置 80、必填校验、编码唯一) */
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
const optsOf = (vs: readonly string[]) => vs.map((v) => ({ label: t(v), value: v }))
async function onSave() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  await crud.submit()
}
</script>

<template>
  <div ref="hostEl" class="m12">
    <!-- ① 入库明细 -->
    <div data-parity="sub">
      <SmartTable
        :columns="subColumns"
        :data="det"
        row-key="no"
        :title="t('入库明细')"
        :search="false"
        :toolbar="false"
        :pagination="false"
        :card-props="{ contentStyle: { paddingBottom: '8px' } }"
        :default-density="shell.density"
        striped
        :summary="summary"
        :scroll-x="isNarrow ? 760 : undefined"
      >
        <template #toolbar-right>
          <n-button
            :type="det.length ? 'default' : 'primary'"
            :theme-overrides="{ iconSizeMedium: '13px' }"
            @click="openPick"
          >
            <template #icon>
              <svg
                width="13"
                height="13"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
              >
                <path d="M8 3v10M3 8h10" />
              </svg>
            </template>
            {{ t('添加物料') }}
          </n-button>
        </template>
      </SmartTable>
    </div>

    <!-- ③ 物料单据 -->
    <div data-parity="main">
      <SmartTable
        ref="tableRef"
        v-model:checked-row-keys="checked"
        v-bind="tableProps"
        card-on-narrow
        :columns="columns"
        :fetcher="fetcher"
        row-key="no"
        :title="t('物料单据')"
        :search="{ container: 'table' }"
        :toolbar="toolbar"
        :pagination="{ pageSizes: [20, 50] }"
        @more-select="onMore"
      >
        <template #toolbar-right>
          <n-button
            type="primary"
            :theme-overrides="{ iconSizeMedium: '13px' }"
            @click="crud.openCreate()"
          >
            <template #icon>
              <svg
                width="13"
                height="13"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
              >
                <path d="M8 3v10M3 8h10" />
              </svg>
            </template>
            {{ t('新增') }}
          </n-button>
        </template>
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
    </div>

    <!-- ② 选择物料:宽档 NModal(720),窄档底部抽屉 -->
    <template v-if="!isNarrow">
      <n-modal
        v-model:show="pickShow"
        class="m12-pick"
        preset="card"
        style="width: 720px"
        :title="t('选择物料')"
        :mask-closable="true"
        role="dialog"
        aria-modal="true"
      >
        <SmartTable
          v-model:checked-row-keys="pickChecked"
          :columns="pickColumns"
          :fetcher="pickFetcher"
          row-key="no"
          :search="{ container: 'none' }"
          :toolbar="false"
          :default-page-size="PICK_PS"
          :pagination="{ showSizePicker: false }"
          :card-props="pickCardProps"
          default-density="comfortable"
        >
          <template #pagination-prefix="info">{{ t(`共 ${info.itemCount} 条`) }}</template>
        </SmartTable>
        <template #footer>
          <div class="pk-foot">
            <span class="pk-sel">{{ t(`已选 ${pickChecked.length} 项`) }}</span>
            <n-button @click="closePick">{{ t('取消') }}</n-button>
            <n-button type="primary" :disabled="!pickChecked.length" @click="okPick">{{
              t('确定')
            }}</n-button>
          </div>
        </template>
      </n-modal>
    </template>
    <n-drawer v-else v-model:show="pickShow" placement="bottom" height="85%" :auto-focus="false">
      <n-drawer-content
        :title="t('选择物料')"
        closable
        :body-content-style="{ padding: '12px 16px' }"
      >
        <SmartTable
          v-model:checked-row-keys="pickChecked"
          :columns="pickColumns"
          :fetcher="pickFetcher"
          row-key="no"
          :search="{ container: 'none' }"
          :toolbar="false"
          :default-page-size="PICK_PS"
          :pagination="{ showSizePicker: false }"
          :card-props="pickCardProps"
          default-density="comfortable"
        />
        <template #footer>
          <div class="pk-foot">
            <span class="pk-sel">{{ t(`已选 ${pickChecked.length} 项`) }}</span>
            <n-button @click="closePick">{{ t('取消') }}</n-button>
            <n-button type="primary" :disabled="!pickChecked.length" @click="okPick">{{
              t('确定')
            }}</n-button>
          </div>
        </template>
      </n-drawer-content>
    </n-drawer>

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
            :options="OWNERS.map((o) => ({ label: o, value: o }))"
            :placeholder="t('请选择')"
        /></n-form-item>
        <n-form-item :label="t('单据状态')" path="status"
          ><n-select
            v-model:value="crud.model.value.status"
            :options="optsOf(STATUS_VALUES)"
            :placeholder="t('请选择')"
        /></n-form-item>
        <n-form-item :label="t('部门')" path="dept"
          ><n-select
            v-model:value="crud.model.value.dept"
            :options="optsOf(['采购部', '生产部', '仓储部'])"
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
/* natural 页:整页在主区里滚动。两张表之间 16px(原型 .smart-table 里两张 n-card 的间距) */
.m12 {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.pk-foot {
  display: flex;
  align-items: center;
  gap: 8px;
}
.pk-sel {
  flex: 1;
  color: v-bind('themeVars.textColor3');
  font-size: 14px;
}
</style>

<style>
/* 选择物料弹窗(Teleport 到 body,所以用非 scoped 样式):内联搜索的间距 = 原型 .si(8px 12px、下留 12px) */
.m12-pick .smart-table {
  gap: 12px;
}
.m12-pick .smart-table-search-inline-row {
  gap: 8px 12px;
}
.m12-pick .smart-table-search-inline-row .n-space {
  gap: 12px !important;
}
.m12-pick .smart-table-search-inline-item .n-form-item-label {
  padding-right: 8px;
}
</style>
