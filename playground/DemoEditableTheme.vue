<script setup lang="ts">
// 可编辑表格 × 宿主主题场景页(浏览器验证用):每种编辑控件一列,可切「宿主主题把单元格内边距设成两值写法」(SmartAdmin 内核同款)与密度,
// 量编辑态文字左缘与显示态是否一致。
import { computed, ref } from 'vue'
import { NConfigProvider, NSpace, NSwitch, type GlobalThemeOverrides } from 'naive-ui'
import { SmartTable, type SmartTableColumn } from '../src/index'

interface Row {
  id: number
  name: string
  qty: number
  status: string
  tags: string[]
  material: string
  due: string
  stamp: string
}
const rows = ref<Row[]>(
  Array.from({ length: 4 }, (_, i) => ({
    id: i + 1,
    name: `任务 ${i + 1}`,
    qty: 10 + i,
    status: ['draft', 'doing', 'done'][i % 3],
    tags: ['urgent'],
    material: `M000${i + 1}`,
    due: `2026-10-0${i + 1}`,
    stamp: `2026-10-0${i + 1} 08:30:00`,
  })),
)
const statusOptions = [
  { label: '草稿', value: 'draft' },
  { label: '进行中', value: 'doing' },
  { label: '完成', value: 'done' },
]
const tagOptions = [
  { label: '紧急', value: 'urgent' },
  { label: '缺陷', value: 'bug' },
]
interface Mat {
  code: string
  name: string
}
const mats: Mat[] = Array.from({ length: 12 }, (_, i) => ({
  code: `M${String(i + 1).padStart(4, '0')}`,
  name: `物料 ${i + 1}`,
}))
const matColumns: SmartTableColumn<Mat>[] = [
  { key: 'code', title: '编号', width: 100 },
  { key: 'name', title: '名称', width: 140 },
]

// 文字左缘是被量的对象:列一律左对齐(库缺省居中,居中的文字不贴左缘)
const columns: SmartTableColumn<Row>[] = [
  { key: 'name', title: '输入框', width: 140, editor: 'input', align: 'left' },
  { key: 'qty', title: '数字', width: 100, editor: 'number', align: 'left' },
  {
    key: 'status',
    title: '下拉',
    width: 120,
    options: statusOptions,
    editor: 'select',
    align: 'left',
  },
  {
    key: 'tags',
    title: '多选',
    width: 160,
    options: tagOptions,
    editor: 'multiselect',
    align: 'left',
  },
  {
    key: 'material',
    title: '下拉表格',
    width: 140,
    editor: 'select-table',
    align: 'left',
    editorProps: { columns: matColumns, data: mats, valueKey: 'code', labelKey: 'code' },
  },
  { key: 'due', title: '日期', width: 140, editor: 'date', align: 'left' },
  { key: 'stamp', title: '日期时间', width: 180, editor: 'datetime', align: 'left' },
]

const twoValue = ref(true)
const dense = ref(true)
/** SmartAdmin 内核的 DataTable 主题:tdPadding 是 padding 的「上下 左右」两值写法。 */
const hostTheme = computed<GlobalThemeOverrides>(() =>
  twoValue.value
    ? {
        DataTable: {
          tdPaddingSmall: '4px 10px',
          tdPaddingMedium: '4px 12px',
          borderRadius: '10px',
        },
      }
    : {},
)
</script>

<template>
  <div>
    <n-space align="center" :size="16" style="margin-bottom: 12px">
      <label
        ><n-switch v-model:value="twoValue" size="small" data-testid="two-value" /> 宿主主题
        tdPadding 两值写法('4px 10px' / '4px 12px')</label
      >
      <label><n-switch v-model:value="dense" size="small" data-testid="dense" /> 紧凑</label>
    </n-space>
    <n-config-provider :theme-overrides="hostTheme">
      <div data-testid="edit-host">
        <SmartTable
          :key="String(dense)"
          :columns="columns"
          :data="rows"
          row-key="id"
          :editable="true"
          :search="false"
          :pagination="false"
          :default-density="dense ? 'compact' : 'comfortable'"
          title="可编辑表格 × 宿主主题"
        />
      </div>
    </n-config-provider>
  </div>
</template>
