<script setup lang="ts">
// 模块 6「字典、标签与格式化」(key dict):用真实库复刻原型 design.html 的 MC.dict(DICT_UNITS)。
// 列声明在 ../data/m6-columns.ts(含各列的字典 / 格式化说明);这里只负责挂 SmartTable:工具栏一行式条件构造器、无勾选列、无操作列。
import { computed } from 'vue'
import { SmartTable } from '../../../src/index'
import { fetchDict } from '../backends/m6-dict'
import { dictColumns } from '../data/m6-columns'
import { protoToolbar } from './shared/toolbar'
import { useProtoTable } from './shared/useProtoTable'

const { t, tableProps } = useProtoTable()
// computed:placeholder 是静态串,切语言才会重算
const columns = computed(() => dictColumns(t))
</script>

<template>
  <div class="proto-host">
    <SmartTable
      v-bind="tableProps"
      card-on-narrow
      :columns="columns"
      :fetcher="fetchDict"
      row-key="no"
      :search="{ container: 'table' }"
      :toolbar="protoToolbar()"
      fill-height
      resizable
    >
      <template #pagination-prefix="info">{{ t(`共 ${info.itemCount} 条`) }}</template>
    </SmartTable>
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
