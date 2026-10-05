<script setup lang="ts">
// 主 demo:列驱动搜索表单、远程分页、字典/tag/格式化渲染、工具栏、列设置持久化。
import { ref } from 'vue'
import {
  NButton,
  NDescriptions,
  NDescriptionsItem,
  NDrawer,
  NDrawerContent,
  useMessage,
} from 'naive-ui'
import { SmartTable, type SmartTableColumn } from '../src/index'
import { fetchDeptOptions, mockPage, type DemoRow } from './mock'
import { labels, tt } from './locale'
import { detailAction } from './prototype/modules/shared/btn'

const message = useMessage()
// 行内「详情」:从右边弹出详情抽屉(与对照页模块 11 的详情抽屉同一做法:右侧 400px、页脚不画分隔线)
const detail = ref<DemoRow | null>(null)
const showDetail = ref(false)

const statusOptions = [
  { label: tt('在职', 'Active'), value: 1, tagType: 'success' as const },
  { label: tt('休假', 'On leave'), value: 2, tagType: 'warning' as const },
  { label: tt('离职', 'Resigned'), value: 3, tagType: 'error' as const },
]

const enabledOptions = [
  { label: tt('启用', 'Enabled'), value: true, tagType: 'success' as const },
  { label: tt('禁用', 'Disabled'), value: false, tagType: 'default' as const },
]

// toolbar.more:官方 NDropdown 的 options 原样透传;选中后库发 moreSelect(key, option),由宿主处理(库不内置导出 / 导入)
const moreOptions = [
  { label: tt('导出', 'Export'), key: 'export' },
  { label: tt('导入', 'Import'), key: 'import' },
  { type: 'divider' as const, key: 'd1' },
  { label: tt('下载导入模板', 'Download template'), key: 'tpl' },
]

const columns: SmartTableColumn<DemoRow>[] = [
  { type: 'index', fixed: 'left' },
  // filter: true —— 有 options 的列自动出勾选列表,没有的出「动作 + 值」条件行
  { key: 'account', title: tt('账号', 'Account'), width: 130, search: true, filter: true },
  { key: 'name', title: tt('姓名', 'Name'), width: 120, search: true, filter: true },
  {
    key: 'deptId',
    title: tt('部门', 'Department'),
    width: 120,
    options: fetchDeptOptions,
    search: true,
    filter: true,
  },
  {
    key: 'status',
    title: tt('状态', 'Status'),
    width: 110,
    options: statusOptions,
    tag: true,
    search: true,
    filter: true,
  },
  // 单选式勾选(Arco 的 multiple: false)
  {
    key: 'enabled',
    title: tt('启用', 'Enabled'),
    width: 110,
    options: enabledOptions,
    tag: true,
    search: true,
    filter: { multiple: false },
  },
  {
    key: 'salary',
    title: tt('薪资', 'Salary'),
    width: 120,
    align: 'right',
    format: 'money',
    sorter: true,
    filter: true,
  },
  {
    key: 'createTime',
    title: tt('创建时间', 'Created'),
    width: 190,
    format: 'datetime',
    sorter: true,
    search: { type: 'daterange', key: 'createRange' },
    filter: true,
  },
  { key: 'email', title: 'Email', minWidth: 200, hide: true },
  {
    key: 'actions',
    title: tt('操作', 'Actions'),
    width: 100,
    fixed: 'right',
    hideInSetting: true,
    render: (row) =>
      detailAction(tt('详情', 'View')(), () => {
        detail.value = row
        showDetail.value = true
      }),
  },
]
</script>

<template>
  <SmartTable
    :columns="columns"
    :fetcher="mockPage"
    :title="tt('人员列表', 'Staff')()"
    :labels="labels"
    :toolbar="{ more: moreOptions }"
    @more-select="(key) => message.info(`more: ${String(key)}`)"
    storage-key="demo-basic"
    resizable
    :single-line="false"
    @filter-change="
      (key, _v, state) =>
        message.info(`filter: ${key || '(clear)'} → ${Object.keys(state).length} active`)
    "
    @error="(e) => message.error(String(e))"
  />
  <n-drawer v-model:show="showDetail" :width="400" placement="right">
    <n-drawer-content
      :title="tt('详情', 'Details')()"
      closable
      :native-scrollbar="false"
      footer-style="border-top: none"
    >
      <n-descriptions
        v-if="detail"
        bordered
        size="small"
        :column="1"
        label-placement="left"
        :label-style="{ width: '108px' }"
      >
        <n-descriptions-item :label="tt('账号', 'Account')()">{{
          detail.account
        }}</n-descriptions-item>
        <n-descriptions-item :label="tt('姓名', 'Name')()">{{ detail.name }}</n-descriptions-item>
        <n-descriptions-item label="Email">{{ detail.email }}</n-descriptions-item>
        <n-descriptions-item :label="tt('状态', 'Status')()">{{
          statusOptions.find((o) => o.value === detail?.status)?.label() ?? detail.status
        }}</n-descriptions-item>
        <n-descriptions-item :label="tt('薪资', 'Salary')()">{{
          detail.salary
        }}</n-descriptions-item>
        <n-descriptions-item :label="tt('创建时间', 'Created')()">{{
          detail.createTime
        }}</n-descriptions-item>
      </n-descriptions>
      <template #footer>
        <n-button secondary style="min-width: 80px" @click="showDetail = false">{{
          tt('关闭', 'Close')()
        }}</n-button>
      </template>
    </n-drawer-content>
  </n-drawer>
</template>
