<script setup lang="ts">
// 批量栏 + 放大 的场景页(浏览器验证用):
// - 勾选行 → 工具栏原位变成批量栏(#batch);取消选择 / 插槽的 clear()
// - toolbar.maximize:宿主顶栏层级(低于 / 高于放大层)、宿主祖先带 transform(Teleport 验证)、fillHeight、同页第二张表
import { computed, ref } from 'vue'
import { NButton, NRadioButton, NRadioGroup, NSpace, NSwitch, useMessage } from 'naive-ui'
import { SmartTable, type SmartTableColumn } from '../src/index'
import { allRows, mockPage, type DemoRow } from './mock'
import { labels } from './locale'

const message = useMessage()
const checked = ref<Array<string | number>>([])
const fill = ref(false)
const transformHost = ref(false)
const hostBarZ = ref<0 | 100 | 2500>(100)
const maxZ = ref<'default' | 3000>('default')
const showSecond = ref(false)

const columns: SmartTableColumn<DemoRow>[] = [
  { type: 'selection', fixed: 'left' },
  { key: 'account', title: '账号', width: 140, search: true, filter: true, sorter: true },
  { key: 'name', title: '姓名', width: 120, search: true, filter: true },
  { key: 'email', title: 'Email', minWidth: 220 },
  { key: 'salary', title: '薪资', width: 120, align: 'right', format: 'money', sorter: true },
]
const toolbar = computed(() => ({
  maximize: maxZ.value === 'default' ? true : { zIndex: maxZ.value },
  more: [
    { label: '导出', key: 'export' },
    { label: '导入', key: 'import' },
  ],
}))
</script>

<template>
  <div>
    <n-space align="center" :size="16" style="margin-bottom: 12px">
      <label><n-switch v-model:value="fill" size="small" data-testid="fill" /> fillHeight</label>
      <label
        ><n-switch v-model:value="transformHost" size="small" data-testid="transform" /> 宿主祖先
        transform</label
      >
      <label
        ><n-switch v-model:value="showSecond" size="small" data-testid="second" />
        同页第二张表</label
      >
      <n-radio-group v-model:value="hostBarZ" size="small" data-testid="hostbar">
        <n-radio-button :value="0">无宿主顶栏</n-radio-button>
        <n-radio-button :value="100">顶栏 z=100</n-radio-button>
        <n-radio-button :value="2500">顶栏 z=2500</n-radio-button>
      </n-radio-group>
      <n-radio-group v-model:value="maxZ" size="small" data-testid="maxz">
        <n-radio-button value="default">maximize: true</n-radio-button>
        <n-radio-button :value="3000">zIndex: 3000</n-radio-button>
      </n-radio-group>
    </n-space>

    <!-- 宿主顶栏:position: fixed,模拟后台的固定顶栏;放大层(1999)应盖住 z=100 的、被 z=2500 的盖住(这时要调大 zIndex) -->
    <div
      v-if="hostBarZ"
      data-testid="host-topbar"
      :style="{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '40px',
        zIndex: hostBarZ,
        background: '#2d8cf0',
        color: '#fff',
        lineHeight: '40px',
        paddingLeft: '16px',
      }"
    >
      宿主顶栏(z-index {{ hostBarZ }})
    </div>

    <div
      :style="{
        transform: transformHost ? 'translateZ(0)' : undefined,
        height: fill ? 'calc(100vh - 260px)' : undefined,
      }"
      data-testid="max-host"
    >
      <SmartTable
        v-model:checked-row-keys="checked"
        :columns="columns"
        :fetcher="mockPage"
        title="批量 / 放大"
        :labels="labels"
        :toolbar="toolbar"
        :fill-height="fill"
        :default-page-size="100"
        :pagination="{ simple: true, pageSizes: [20, 100] }"
        row-key="id"
        resizable
        @more-select="(k) => message.info(`more: ${String(k)}`)"
      >
        <template #toolbar-right><NButton size="small" type="primary">新增</NButton></template>
        <template #batch="{ checkedRowKeys, clear }">
          <NButton
            size="small"
            data-testid="batch-export"
            @click="message.info(`导出 ${checkedRowKeys.length} 项`)"
            >批量导出</NButton
          >
          <NButton
            size="small"
            type="error"
            ghost
            data-testid="batch-del"
            @click="
              () => {
                message.warning(`删除 ${checkedRowKeys.length} 项`)
                clear()
              }
            "
            >批量删除</NButton
          >
        </template>
      </SmartTable>
    </div>

    <div v-if="showSecond" style="margin-top: 24px" data-testid="second-table">
      <SmartTable
        :columns="columns.slice(1)"
        :data="allRows.slice(0, 30)"
        :labels="labels"
        title="第二张表"
        :toolbar="{ maximize: true }"
        :pagination="false"
        :search="false"
      />
    </div>
  </div>
</template>
