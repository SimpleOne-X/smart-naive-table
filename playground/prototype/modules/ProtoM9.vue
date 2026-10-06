<script setup lang="ts">
// 模块 9「增删改弹窗」(key crud):物料单据表 + 「新增」/ 行内「编辑」→ 弹窗表单(modules/shared/CrudModal.vue,内部用库的 useTableCrud),
// 行内「删除」先 NPopconfirm 确认。宽 / 中档弹窗 NModal preset=card 宽 480;窄档(< 600)底部抽屉。
// 表单:必填(编码 / 名称 / 日期)校验;提交带 loading(700ms 后端);编码唯一是后端业务规则 → 失败 message.error 且窗口保持;
// 成功「操作成功」:新增 → search() 回第 1 页,编辑 → refresh() 停在当前页。
import { ref } from 'vue'
import { NButton } from 'naive-ui'
import { SmartTable } from '../../../src/index'
import { useMaterialPage } from '../data/m7-materialPage'
import { fetchRows } from '../fetcher'
import { CheckIcon, TrashIcon } from './shared/btn'
import CrudModal from './shared/CrudModal.vue'
import { ProtoAddButton, protoToolbar } from './shared/toolbar'
import { useTier } from './shared/useTier'
import { useButtonTint } from '../../../src/buttonTint'

const crudRef = ref<InstanceType<typeof CrudModal> | null>(null)
const { el, tier } = useTier()
const tint = useButtonTint()
const {
  t,
  tableProps,
  tableRef,
  checked,
  columns,
  fetcher,
  more,
  onMore,
  onBatchApprove,
  onBatchDelete,
} = useMaterialPage({
  fetcher: fetchRows,
  onEdit: (row) => crudRef.value?.openEdit(row),
})

function onSaved(p: { mode: 'create' | 'edit'; orig: string | null; no: string }) {
  // 编辑改了编码:勾选集合里的旧编码跟着换(原型 state.checked.map)
  if (p.mode === 'edit') checked.value = checked.value.map((k) => (k === p.orig ? p.no : k))
  void (p.mode === 'create' ? tableRef.value?.search() : tableRef.value?.refresh())
}
</script>

<template>
  <div ref="el" class="proto-host">
    <SmartTable
      ref="tableRef"
      v-bind="tableProps"
      card-on-narrow
      v-model:checked-row-keys="checked"
      :columns="columns"
      :fetcher="fetcher"
      row-key="no"
      :search="{ container: 'table' }"
      :toolbar="protoToolbar({ more })"
      fill-height
      resizable
      @more-select="onMore"
    >
      <template #toolbar-right
        ><ProtoAddButton :label="t('新增')" @click="crudRef?.openCreate()"
      /></template>
      <template #batch="{ checkedRowKeys, clear }">
        <n-button
          secondary
          type="primary"
          :theme-overrides="tint.primary"
          @click="onBatchApprove(checkedRowKeys, clear)"
        >
          <template #icon><CheckIcon /></template>
          {{ t('批量审核') }}
        </n-button>
        <n-button
          secondary
          type="error"
          :theme-overrides="tint.error"
          aria-haspopup="dialog"
          @click="onBatchDelete(checkedRowKeys, clear)"
        >
          <template #icon><TrashIcon /></template>
          {{ t('批量删除') }}
        </n-button>
      </template>
      <template #pagination-prefix="info">{{ t(`共 ${info.itemCount} 条`) }}</template>
    </SmartTable>
    <CrudModal ref="crudRef" :narrow="tier === 'narrow'" @success="onSaved" />
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
