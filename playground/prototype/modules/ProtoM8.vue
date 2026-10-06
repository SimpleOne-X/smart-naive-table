<script setup lang="ts">
// 模块 8「加载与错误处理」(key states):immediate: false —— 首屏不请求,表体直接是官方 NEmpty「无数据」,点「搜索」才发请求(原型 MC.states.immediate = false)。
// 后端(backends/m8-states.ts)带两条规则:日期范围 > 1 年 → 400 抛错(库保留旧行、页码退回、宿主 message.error);奇数页慢 / 偶数页快 → 连点翻页靠库的竞态守卫丢弃旧响应。
// #empty 插槽:有查询条件时换成「没有符合条件的单据」+ extra「清除条件」(原型 MC.states.emptySlot)。
// 表格 loading(半透明 + spinner)是官方 NDataTable 自带的样子,宿主不覆盖。
import { computed, ref } from 'vue'
import { NButton, NEmpty } from 'naive-ui'
import { SmartTable } from '../../../src/index'
import { fetchStates } from '../backends/m8-states'
import { useMaterialPage } from '../data/m7-materialPage'
import { CheckIcon, ResetIcon, TrashIcon } from './shared/btn'
import CrudModal from './shared/CrudModal.vue'
import { ProtoAddButton, protoToolbar } from './shared/toolbar'
import { useTier } from './shared/useTier'
import { useButtonTint } from '../../../src/buttonTint'

const crudRef = ref<InstanceType<typeof CrudModal> | null>(null)
const { el, tier } = useTier()
const tint = useButtonTint()
const page = useMaterialPage({
  fetcher: fetchStates,
  onEdit: (row) => crudRef.value?.openEdit(row),
})
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
  message,
} = page

/** 请求失败:库保留旧行并把页码退回(useSmartTable),宿主只负责提示(message.error,原型 toast error) */
const onError = (e: unknown) => message.error(t(e instanceof Error ? e.message : String(e)))

/** 当前是否有查询条件:读库的过滤态(条件搜索与列头过滤共用) */
const hasCond = computed(() => {
  const f = tableRef.value?.filters as unknown as
    Record<string, { conditions: unknown[] } | undefined> | undefined
  return !!f && Object.values(f).some((v) => v && v.conditions.length > 0)
})
const clearCond = () => tableRef.value?.clearFilters()

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
      :immediate="false"
      row-key="no"
      :search="{ container: 'table' }"
      :toolbar="protoToolbar({ more })"
      fill-height
      resizable
      @more-select="onMore"
      @error="onError"
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
      <!-- 有查询条件时的自定义空状态(原型 emptySlot);没有条件时不给插槽内容,库用官方 NEmpty -->
      <template v-if="hasCond" #empty>
        <n-empty :description="t('没有符合条件的单据')">
          <template #extra
            ><n-button size="small" secondary @click="clearCond"
              ><template #icon><ResetIcon /></template>{{ t('清除条件') }}</n-button
            ></template
          >
        </n-empty>
      </template>
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
