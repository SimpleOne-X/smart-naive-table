<script setup lang="ts">
// 模块 7「列设置」(key persist):物料单据表 + 工具栏「列设置」,顺序 / 显隐 / 固定 / 列宽经 storageKey 写进真实 localStorage(原型 MC.persist.storageKey)。
// 与原型模块 2 同一张表(一行式条件搜索 + 批量栏 + 放大 + 新增弹窗),区别只是多了 storage-key。
// 列设置面板 / 列宽拖拽 / 「恢复默认」都是库自己的能力,宿主只传 storage-key + resizable。
import { ref } from 'vue'
import { useMaterialPage } from '../data/m7-materialPage'
import { fetchRows } from '../fetcher'
import { SmartTable } from '../../../src/index'
import { NButton } from 'naive-ui'
import { CheckIcon, TrashIcon } from './shared/btn'
import CrudModal from './shared/CrudModal.vue'
import { ProtoAddButton, protoToolbar } from './shared/toolbar'
import { useTier } from './shared/useTier'

/** 原型 persist.storageKey(原型用 'smart-naive-table-design:cols:v2');对照页自己一份,不与原型页互相覆盖 */
const STORAGE_KEY = 'smart-naive-table-proto:persist'

const crudRef = ref<InstanceType<typeof CrudModal> | null>(null)
const { el, tier } = useTier()
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
      :storage-key="STORAGE_KEY"
      fill-height
      resizable
      @more-select="onMore"
    >
      <template #toolbar-right
        ><ProtoAddButton :label="t('新增')" @click="crudRef?.openCreate()"
      /></template>
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
    <CrudModal ref="crudRef" :narrow="tier === 'narrow'" @success="onSaved" />
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
