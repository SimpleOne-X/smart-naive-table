<script setup lang="ts">
// CRUD demo:useTableCrud 弹窗状态机 + #toolbar 新增按钮 + 行内编辑/删除。
import { h, ref } from 'vue'
import {
  NButton,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NPopconfirm,
  NSpace,
  NSwitch,
  useMessage,
} from 'naive-ui'
import { SmartTable, useTableCrud, type SmartTableColumn, type SmartTableInst } from '../src/index'
import { mockCreate, mockPage, mockRemove, mockUpdate, type DemoForm, type DemoRow } from './mock'
import { labels, tt } from './locale'

const message = useMessage()
const tableRef = ref<SmartTableInst<DemoRow>>()

const crud = useTableCrud<DemoRow, DemoForm>({
  form: () => ({ account: '', name: '', email: '', enabled: true }),
  create: mockCreate,
  update: mockUpdate,
  remove: mockRemove,
  onSuccess: () => {
    message.success(tt('操作成功', 'Done')())
    void tableRef.value?.refresh()
  },
  onError: (e) => message.error(String(e)),
})

const columns: SmartTableColumn<DemoRow>[] = [
  { type: 'index' },
  { key: 'account', title: tt('账号', 'Account'), search: true },
  { key: 'name', title: tt('姓名', 'Name'), search: true },
  { key: 'email', title: 'Email', minWidth: 180 },
  { key: 'createTime', title: tt('创建时间', 'Created'), width: 180, format: 'datetime' },
  {
    key: 'actions',
    title: tt('操作', 'Actions'),
    width: 140,
    fixed: 'right',
    hideInSetting: true,
    render: (row) =>
      h(NSpace, { size: 4 }, () => [
        h(
          NButton,
          { size: 'small', quaternary: true, type: 'primary', onClick: () => crud.openEdit(row) },
          () => tt('编辑', 'Edit')(),
        ),
        h(
          NPopconfirm,
          { onPositiveClick: () => void crud.removeRow(row) },
          {
            trigger: () =>
              h(NButton, { size: 'small', quaternary: true, type: 'error' }, () =>
                tt('删除', 'Delete')(),
              ),
            default: () => tt('确认删除该行?', 'Delete this row?')(),
          },
        ),
      ]),
  },
]
</script>

<template>
  <SmartTable
    ref="tableRef"
    :columns="columns"
    :fetcher="mockPage"
    :title="tt('人员管理', 'Staff management')()"
    :labels="labels"
    @error="(e) => message.error(String(e))"
  >
    <template #toolbar>
      <n-button type="primary" size="small" @click="crud.openCreate()">{{
        tt('新增', 'Create')()
      }}</n-button>
    </template>
    <template #cell-email="{ row }">
      <a :href="`mailto:${row.email}`">{{ row.email }}</a>
    </template>
  </SmartTable>

  <n-modal
    v-model:show="crud.visible.value"
    preset="card"
    style="width: 480px"
    :title="
      crud.mode.value === 'create'
        ? tt('新增人员', 'Create staff')()
        : tt('编辑人员', 'Edit staff')()
    "
  >
    <n-form :model="crud.model.value" label-placement="left" label-width="80">
      <n-form-item :label="tt('账号', 'Account')()">
        <n-input v-model:value="crud.model.value.account" />
      </n-form-item>
      <n-form-item :label="tt('姓名', 'Name')()">
        <n-input v-model:value="crud.model.value.name" />
      </n-form-item>
      <n-form-item label="Email">
        <n-input v-model:value="crud.model.value.email" />
      </n-form-item>
      <n-form-item :label="tt('启用', 'Enabled')()">
        <n-switch v-model:value="crud.model.value.enabled" />
      </n-form-item>
    </n-form>
    <template #footer>
      <n-space justify="end">
        <n-button @click="crud.close()">{{ tt('取消', 'Cancel')() }}</n-button>
        <n-button type="primary" :loading="crud.submitting.value" @click="crud.submit()">
          {{ tt('保存', 'Save')() }}
        </n-button>
      </n-space>
    </template>
  </n-modal>
</template>
