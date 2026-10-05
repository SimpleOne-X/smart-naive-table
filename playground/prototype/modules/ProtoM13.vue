<script setup lang="ts">
// 模块 13「多语言与页面底色」:一张物料单据表(工具栏一行式条件搜索,没有搜索卡),语言 / 页面底色 / 密度由外壳「全局设置」控制,
// 表格上的体现 = 函数式列标题(title: () => t(...),渲染期求值,随语言变)、金额列带单位「金额(元)」、备注列放得下长文案(空值 —)、
// 库自己的 chrome 文案(搜索 / 重置 / 分页 / 过滤面板…)由 ProtoApp 的 SMART_TABLE_DEFAULTS.labels(zhCNLabels / 英文默认)随语言切换。
// 英文表头宽度按真实文字宽度重算,不让标题被截断(原型 titleFit)。
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
  type SmartTableParams,
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
import { MOCK_DELAY, fetchRows, queryRows } from '../fetcher'
import { textW } from '../i18n'
import {
  CheckIcon,
  DELETE_DIALOG_BTNS,
  DELETE_POPCONFIRM_BTNS,
  TrashIcon,
  deleteTrigger,
  editAction,
} from './shared/btn'
import { materialCols } from './shared/materialCols'
import { STATUS_VALUES } from './shared/options'
import { downloadCsv, moreOptions as makeMoreOptions, protoToolbar } from './shared/toolbar'
import { useProtoTable } from './shared/useProtoTable'

const { shell, t, tableProps, toast, message } = useProtoTable()
const dialog = useDialog()
const themeVars = useThemeVars()

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
    editAction(t('编辑'), () => crud.openEdit(row)),
    h(
      NPopconfirm,
      {
        onPositiveClick: () => void onDel(row.no),
        positiveText: t('删除'),
        negativeText: t('取消'),
        ...DELETE_POPCONFIRM_BTNS,
      },
      {
        trigger: () => deleteTrigger(t('删除')),
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
  fitTitles(
    materialCols({
      t,
      selection: true,
      index: true,
      memo: true,
      actions: rowActions,
      patch: {
        no: { card: 'title' }, // 原型 I18N_UNITS:窄档卡片的标题
        amount: { title: () => t('金额(元)') }, // 原型 I18N_UNITS:金额带单位
        // 备注列放得下长文案(宽 128),空值显示「—」(原型 dash,颜色同正文)
        memo: {
          hideInTable: false,
          width: 128,
          render: (r: Row) =>
            r.memo ? r.memo : h('span', { style: { color: themeVars.value.textColor2 } }, '—'),
        },
      },
    }),
  ),
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
    positiveText: t('删除'),
    negativeText: t('取消'),
    ...DELETE_DIALOG_BTNS,
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
  <div class="proto-host">
    <SmartTable
      ref="tableRef"
      v-model:checked-row-keys="checked"
      v-bind="tableProps"
      card-on-narrow
      :columns="columns"
      :fetcher="fetcher"
      row-key="no"
      :search="{ container: 'table' }"
      :toolbar="toolbar"
      fill-height
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
        <n-button secondary type="primary" @click="onBatchApprove(checkedRowKeys, clear)">
          <template #icon><CheckIcon /></template>
          {{ t('批量审核') }}
        </n-button>
        <n-button
          secondary
          type="error"
          aria-haspopup="dialog"
          @click="onBatchDelete(checkedRowKeys, clear)"
        >
          <template #icon><TrashIcon /></template>
          {{ t('批量删除') }}
        </n-button>
      </template>
      <template #pagination-prefix="info">{{ t(`共 ${info.itemCount} 条`) }}</template>
    </SmartTable>

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
          <n-button
            secondary
            style="min-width: 80px"
            :disabled="crud.submitting.value"
            @click="crud.close()"
            >{{ t('取消') }}</n-button
          >
          <n-button
            type="primary"
            style="min-width: 80px"
            :loading="crud.submitting.value"
            @click="onSave"
            >{{ t('保存') }}</n-button
          >
        </n-space>
      </template>
    </n-modal>
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
</style>
