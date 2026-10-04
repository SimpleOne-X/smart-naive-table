<script setup lang="ts">
// fillHeight 场景页(浏览器验证用):父容器定高,表格铺满并在卡片内虚拟滚动;
// 关掉 fillHeight 可对照「翻页后滚回卡片顶部」;关掉「父容器定高」可看没定高时的兜底。
import { ref } from 'vue'
import { NSpace, NSwitch } from 'naive-ui'
import { SmartTable, type SmartTableColumn } from '../src/index'
import { allRows, type DemoRow } from './mock'

const fill = ref(true)
const dense = ref(true)
const fixedParent = ref(true)
// 页码序列(pagination.simple: false):带上一页 / 下一页按钮,浏览器验证「翻页后滚回卡片顶部」要点按钮(页码输入框在页底,键入时浏览器自己会滚)
const pager = ref(false)
const columns: SmartTableColumn<DemoRow>[] = [
  { type: 'index', width: 70 },
  { key: 'account', title: '账号', width: 140 },
  { key: 'name', title: '姓名', width: 120 },
  { key: 'email', title: 'Email', minWidth: 220 },
  { key: 'salary', title: '薪资', width: 120, align: 'right', format: 'money' },
]
</script>

<template>
  <div>
    <n-space align="center" :size="16" style="margin-bottom: 12px">
      <label><n-switch v-model:value="fill" size="small" data-testid="fill" /> fillHeight</label>
      <label><n-switch v-model:value="dense" size="small" data-testid="dense" /> 紧凑</label>
      <label
        ><n-switch v-model:value="fixedParent" size="small" data-testid="fixed-parent" />
        父容器定高</label
      >
      <label
        ><n-switch v-model:value="pager" size="small" data-testid="pager" /> 页码序列(非
        simple)</label
      >
    </n-space>
    <div
      :style="fill && fixedParent ? { height: 'calc(100vh - 220px)' } : {}"
      data-testid="fill-host"
    >
      <SmartTable
        :columns="columns"
        :data="allRows"
        :fill-height="fill"
        :default-page-size="100"
        :pagination="{ simple: !pager, pageSizes: [10, 100, 500, 1000] }"
        :default-density="dense ? 'compact' : 'comfortable'"
        :search="false"
        :toolbar="false"
        title="铺满演示"
      />
    </div>
  </div>
</template>
