<script setup lang="ts">
// 模式 2 条件构造器场景页(浏览器验证用):search.container 三种取值、容器宽(三档)、远程 / 静态数据、请求形状
import { computed, ref } from 'vue'
import { NButton, NRadioButton, NRadioGroup, NSpace, NSwitch, useMessage } from 'naive-ui'
import { SmartTable, type SmartTableColumn, type SmartTableInst } from '../src/index'
import { allRows, fetchDeptOptions, mockPage, type DemoRow } from './mock'
import { labels, tt } from './locale'
import { ProtoAddButton } from './prototype/modules/shared/toolbar'

const message = useMessage()
const container = ref<'card' | 'table' | 'none'>('table')
const hostWidth = ref<number | 'auto'>('auto')
const remote = ref(true)
const lastParams = ref('')
const tableRef = ref<SmartTableInst<DemoRow> | null>(null)

const statusOptions = [
  { label: tt('在职', 'Active'), value: 1, tagType: 'success' as const },
  { label: tt('休假', 'On leave'), value: 2, tagType: 'warning' as const },
  { label: tt('离职', 'Resigned'), value: 3, tagType: 'error' as const },
]

const columns: SmartTableColumn<DemoRow>[] = [
  { type: 'selection', fixed: 'left' },
  // 两个都写:构造器与列头漏斗是同一份条件的两个入口
  { key: 'account', title: tt('账号', 'Account'), width: 130, search: true, filter: true },
  // 只写 search:字段进构造器,表头没有漏斗
  { key: 'name', title: tt('姓名', 'Name'), width: 120, search: true },
  {
    key: 'deptId',
    title: tt('部门', 'Department'),
    width: 120,
    options: fetchDeptOptions,
    search: true,
  },
  {
    key: 'status',
    title: tt('状态', 'Status'),
    width: 110,
    options: statusOptions,
    tag: true,
    search: true,
  },
  {
    key: 'salary',
    title: tt('薪资', 'Salary'),
    width: 120,
    align: 'right',
    format: 'money',
    sorter: true,
    search: { type: 'number' },
  },
  {
    key: 'createTime',
    title: tt('创建时间', 'Created'),
    width: 190,
    format: 'datetime',
    search: { type: 'daterange', label: tt('创建日期', 'Created on') },
  },
  // 搜索专用列(不进表格)
  {
    key: 'email',
    title: 'Email',
    hideInTable: true,
    search: { placeholder: tt('邮箱关键字', 'Email keyword')() },
  },
]

const search = computed(() => ({ container: container.value }))
const style = computed(() =>
  hostWidth.value === 'auto' ? undefined : { width: `${hostWidth.value}px` },
)
function onSearch(p: Record<string, unknown>) {
  lastParams.value = JSON.stringify(p)
  message.info(`@search ${lastParams.value.slice(0, 120)}`)
}
</script>

<template>
  <div>
    <n-space align="center" :size="16" style="margin-bottom: 12px">
      <n-radio-group v-model:value="container" size="small" data-testid="container">
        <n-radio-button value="card">card</n-radio-button>
        <n-radio-button value="table">table</n-radio-button>
        <n-radio-button value="none">none</n-radio-button>
      </n-radio-group>
      <n-radio-group v-model:value="hostWidth" size="small" data-testid="hostw">
        <n-radio-button value="auto">auto</n-radio-button>
        <n-radio-button :value="1400">1400</n-radio-button>
        <n-radio-button :value="1000">1000</n-radio-button>
        <n-radio-button :value="560">560</n-radio-button>
        <n-radio-button :value="390">390</n-radio-button>
      </n-radio-group>
      <label><n-switch v-model:value="remote" size="small" data-testid="remote" /> 远程</label>
      <n-button
        size="small"
        secondary
        data-testid="set-filter"
        @click="
          tableRef?.setFilter('account', {
            logic: 'and',
            conditions: [{ action: 'startsWith', value: 'user00' }],
          })
        "
      >
        编程式 setFilter(account)
      </n-button>
    </n-space>
    <div :style="style" data-testid="m2-host">
      <SmartTable
        :key="`${container}-${remote}`"
        ref="tableRef"
        :columns="columns"
        v-bind="remote ? { fetcher: mockPage } : { data: allRows }"
        :title="tt('人员', 'Staff')()"
        :search="search"
        :labels="labels"
        :default-page-size="100"
        :toolbar="{ more: [{ label: '导出', key: 'export' }], maximize: true }"
        resizable
        @search="onSearch"
        @reset="message.info('@reset')"
        @filter-change="
          (k: string, _v: unknown, s: Record<string, unknown>) =>
            message.info(`filterChange ${k || '(batch)'} → ${Object.keys(s).length} active`)
        "
      >
        <template #toolbar-right><ProtoAddButton label="新增" /></template>
      </SmartTable>
    </div>
    <pre style="font-size: 12px; margin-top: 12px" data-testid="last-params">{{ lastParams }}</pre>
  </div>
</template>
