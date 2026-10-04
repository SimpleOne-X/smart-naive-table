<script setup lang="ts">
// 「增删改弹窗」(模块 7 / 8 / 9 的「新增」「编辑」共用,原型 docs/smart-naive-table-design.html 的 crudOpen / crudSubmit / modalRootHtml):
//   宽 / 中档 = NModal preset=card 宽 480;窄档(< 600)= 底部抽屉(NDrawer bottom,控件 large 40px,label 72px,页脚按钮靠右)。
//   表单 = NForm label-placement=left label-width=80;必填(编码 / 名称 / 日期)触发 input|blur;提交带 loading、700ms 后端;
//   编码唯一是后端业务规则:失败 = message.error 且窗口保持(useTableCrud 的 onError)。
//   成功:message「操作成功」+ emit('success', { mode, orig, no }),宿主按 mode 决定 search() / refresh()。
// 用法:
//   <CrudModal ref="crudRef" :narrow="tier === 'narrow'" @success="onSaved" />   crudRef.value.openCreate() / openEdit(row)
import { computed, ref } from 'vue'
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
  NSelect,
  NSpace,
  type FormInst,
  type FormRules,
} from 'naive-ui'
import { useTableCrud } from '../../../../src/index'
import { OWNERS, blankForm, createRow, updateRow, type Row, type RowForm } from '../../data'
import { MOCK_DELAY } from '../../fetcher'
import { useT } from '../../i18n'
import { useProtoTable } from './useProtoTable'

defineProps<{ narrow?: boolean }>()
const emit = defineEmits<{
  success: [payload: { mode: 'create' | 'edit'; orig: string | null; no: string }]
}>()

const { message } = useProtoTable()
const t = useT()

/** 后端:700ms 后执行(原型 crudSubmit 的 setTimeout 700);单测里 MOCK_DELAY.ms = 0 即不等待。fn 抛错 = 业务失败。 */
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
  update: (f, row) => backend(() => updateRow(f, row.no)),
  onSuccess: () => {
    message.success(t('操作成功'))
    emit('success', {
      mode: crud.mode.value,
      orig: crud.editingRow.value?.no ?? null,
      no: crud.model.value.no.trim(),
    })
  },
  // 业务错误文案(「物料编码 X 已存在」)是整句 → 走 t() 的句式翻译
  onError: (e) => message.error(t(e instanceof Error ? e.message : String(e))),
})

const formRef = ref<FormInst | null>(null)
const req = (msg: string, trigger: string[] = ['input', 'blur']) => ({
  required: true,
  message: () => t(msg),
  trigger,
})
const rules = computed<FormRules>(() => ({
  no: req('请输入物料编码'),
  name: req('请输入物料名称'),
  bizDate: req('请选择单据日期', ['change', 'blur']),
}))
const optsOf = (vs: readonly string[]) => vs.map((v) => ({ label: t(v), value: v }))
const owners = computed(() => OWNERS.map((o) => ({ label: o, value: o })))
const statuses = computed(() => optsOf(['已审核', '未审核', '已关闭']))
const depts = computed(() => optsOf(['采购部', '生产部', '仓储部']))

async function onSave() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  await crud.submit()
}

const title = computed(() => t(crud.mode.value === 'create' ? '新增物料' : '编辑物料'))

defineExpose({ openCreate: crud.openCreate, openEdit: crud.openEdit, crud })
</script>

<template>
  <!-- 表单本体:宽 / 中档与窄档同一份,窄档控件按 size=large(抽屉内 40px / 15px) -->
  <template v-if="narrow">
    <n-drawer
      v-model:show="crud.visible.value"
      class="proto-crud-drawer"
      placement="bottom"
      height="auto"
      style="max-height: 85vh"
      :mask-closable="!crud.submitting.value"
      :close-on-esc="!crud.submitting.value"
    >
      <n-drawer-content
        :title="title"
        closable
        :native-scrollbar="true"
        body-content-style="padding: 16px 24px 8px"
      >
        <n-form
          ref="formRef"
          :model="crud.model.value"
          :rules="rules"
          label-placement="left"
          label-width="72"
          require-mark-placement="right"
          size="large"
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
              :options="owners"
              :placeholder="t('请选择')"
          /></n-form-item>
          <n-form-item :label="t('单据状态')" path="status"
            ><n-select
              v-model:value="crud.model.value.status"
              :options="statuses"
              :placeholder="t('请选择')"
          /></n-form-item>
          <n-form-item :label="t('部门')" path="dept"
            ><n-select
              v-model:value="crud.model.value.dept"
              :options="depts"
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
          <n-space justify="end" style="flex: 1 1 auto">
            <n-button size="large" :disabled="crud.submitting.value" @click="crud.close()">{{
              t('取消')
            }}</n-button>
            <n-button
              size="large"
              type="primary"
              :loading="crud.submitting.value"
              @click="onSave"
              >{{ t('保存') }}</n-button
            >
          </n-space>
        </template>
      </n-drawer-content>
    </n-drawer>
  </template>
  <n-modal
    v-else
    v-model:show="crud.visible.value"
    preset="card"
    style="width: 480px"
    :title="title"
    :mask-closable="!crud.submitting.value"
    :close-on-esc="!crud.submitting.value"
  >
    <n-form
      ref="formRef"
      :model="crud.model.value"
      :rules="rules"
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
          :options="owners"
          :placeholder="t('请选择')"
      /></n-form-item>
      <n-form-item :label="t('单据状态')" path="status"
        ><n-select
          v-model:value="crud.model.value.status"
          :options="statuses"
          :placeholder="t('请选择')"
      /></n-form-item>
      <n-form-item :label="t('部门')" path="dept"
        ><n-select
          v-model:value="crud.model.value.dept"
          :options="depts"
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
      <n-space justify="end" size="small">
        <n-button :disabled="crud.submitting.value" @click="crud.close()">{{ t('取消') }}</n-button>
        <n-button type="primary" :loading="crud.submitting.value" @click="onSave">{{
          t('保存')
        }}</n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<style>
/* 抽屉高度随内容(最高 85vh):官方 .n-drawer-body 是 flex: 1 0 0 + overflow: hidden,父级高度 auto 时塌成 0;
   与库 ConditionBar 的窄档抽屉同一套修法(NDrawer 是 teleport 到 body 的,所以不能 scoped) */
.proto-crud-drawer {
  display: flex;
  flex-direction: column;
}
.n-drawer.proto-crud-drawer .n-drawer-content-wrapper {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.n-drawer.proto-crud-drawer .n-drawer-content {
  min-height: 0;
}
.n-drawer.proto-crud-drawer .n-drawer-content .n-drawer-body {
  flex: 1 1 auto;
  min-height: 0;
}
/* 窄档 label 区 72px 放不下「物料编码 + 星号」:不换行(原型 .fm-lab white-space: nowrap) */
.proto-crud-drawer .n-form-item-label {
  white-space: nowrap;
}
</style>
