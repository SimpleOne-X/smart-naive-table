<script setup lang="ts">
// 宽表 demo:selection + 20+ 列验证 auto scrollX、固定列宽度兜底、勾选透传。
import { ref } from 'vue'
import { useMessage } from 'naive-ui'
import { SmartTable, type SmartTableColumn } from '../src/index'
import { mockPage, type DemoRow } from './mock'
import { labels, tt } from './locale'

const message = useMessage()
const checked = ref<Array<string | number>>([])

const columns: SmartTableColumn<DemoRow>[] = [
  { type: 'selection', fixed: 'left' },
  { key: 'account', title: tt('账号', 'Account'), width: 120, fixed: 'left' },
  { key: 'name', title: tt('姓名', 'Name'), width: 110 },
  ...Array.from({ length: 12 }, (_, i) => ({
    key: `c${i + 1}`,
    title: () => `${tt('列', 'Col')()} ${i + 1}`,
    width: 140,
  })),
  { key: 'email', title: 'Email', width: 200 },
  {
    key: 'salary',
    title: tt('薪资', 'Salary'),
    width: 110,
    align: 'right' as const,
    format: 'money' as const,
  },
  {
    key: 'createTime',
    title: tt('创建时间', 'Created'),
    width: 180,
    format: 'datetime' as const,
    fixed: 'right',
  },
]
</script>

<template>
  <div>
    <p style="margin: 0 0 12px">checked: {{ checked.length }}</p>
    <SmartTable
      :columns="columns"
      :fetcher="mockPage"
      :labels="labels"
      storage-key="demo-wide"
      :checked-row-keys="checked"
      @update:checked-row-keys="(keys: Array<string | number>) => (checked = keys)"
      @error="(e) => message.error(String(e))"
    />
  </div>
</template>
