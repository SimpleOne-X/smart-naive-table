<script setup lang="ts">
// 序号列树形(index 列 tree: true,设计 2.18)场景页:标准件下挂替代件(两层)、末行带三层,
// 可切可编辑 / 序号列固定 / 本地分页(按根行),看方框、树线、项次「1.1」与整组悬停。
import { computed, ref } from 'vue'
import { NSpace, NSwitch } from 'naive-ui'
import { SmartTable, type SmartTableColumn } from '../src/index'

interface Row {
  id: number
  station: string
  code: string
  name: string
  type: string
  qty: number
  children?: Row[]
}
let seq = 100
const alt = (code: string, name: string): Row => ({
  id: ++seq,
  station: '',
  code,
  name,
  type: '替代件',
  qty: 1,
})
const rows = ref<Row[]>([
  {
    id: 1,
    station: 'F01',
    code: 'R0402-10K',
    name: '贴片电阻 10K',
    type: '标准件',
    qty: 2,
    children: [alt('R0402-10K-B', '贴片电阻 10K(风华)'), alt('R0402-10K-C', '贴片电阻 10K(国巨)')],
  },
  { id: 2, station: 'F02', code: 'C0603-1U', name: '贴片电容 1uF', type: '标准件', qty: 4 },
  {
    id: 3,
    station: 'F03',
    code: 'IC-STM32F4',
    name: '主控芯片',
    type: '标准件',
    qty: 1,
    children: [alt('IC-GD32F4', '主控芯片(兆易)')],
  },
  { id: 4, station: 'F04', code: 'L0805-2U2', name: '功率电感 2.2uH', type: '标准件', qty: 1 },
  {
    id: 5,
    station: 'F05',
    code: 'CN-USB-C',
    name: 'USB-C 座',
    type: '标准件',
    qty: 1,
    children: [
      {
        ...alt('CN-USB-C-B', 'USB-C 座(立讯)'),
        children: [alt('CN-USB-C-B1', 'USB-C 座(立讯 · 沉板)')],
      },
      alt('CN-USB-C-C', 'USB-C 座(连兴旺)'),
    ],
  },
])

const editable = ref(false)
const fixedIndex = ref(true)
const paged = ref(false)
const checked = ref<number[]>([])
const columns = computed<SmartTableColumn<Row>[]>(() => [
  { type: 'selection', fixed: fixedIndex.value ? 'left' : undefined },
  {
    type: 'index',
    title: '项次',
    tree: true,
    width: 96,
    fixed: fixedIndex.value ? 'left' : undefined,
  },
  { key: 'station', title: '站位', width: 90 },
  { key: 'code', title: '物料编码', width: 160, editor: 'input' },
  { key: 'name', title: '物料名称', width: 220, editor: 'input' },
  { key: 'type', title: '物料类型', width: 100 },
  { key: 'qty', title: '用量', width: 90, editor: 'number' },
])
const pagination = computed(() => (paged.value ? { pageSize: 2 } : false))
// 合计只拿到根行(标准件),同官方树表
const summary = (page: Row[]) => ({
  station: { value: '合计' },
  qty: { value: page.reduce((n, r) => n + r.qty, 0) },
})
</script>

<template>
  <n-space vertical>
    <n-space :size="16">
      <label><n-switch v-model:value="editable" size="small" /> 可编辑</label>
      <label><n-switch v-model:value="fixedIndex" size="small" /> 项次列固定</label>
      <label><n-switch v-model:value="paged" size="small" /> 本地分页(每页 2 个根)</label>
    </n-space>
    <smart-table
      :key="String(paged)"
      :columns="columns"
      :data="rows"
      row-key="id"
      :editable="editable"
      :pagination="pagination"
      default-expand-all
      :scroll-x="900"
      v-model:checked-row-keys="checked"
      :summary="summary"
    />
    <div>已勾选:{{ checked.join(', ') }}</div>
  </n-space>
</template>
