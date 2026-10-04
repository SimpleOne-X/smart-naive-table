<script setup lang="ts">
// 可编辑表格场景页(浏览器验证用):300 行本地数据 + fillHeight 虚拟滚动 + 固定列 + 多选标签 + 行级只读 + 异步查重;
// 开关:即时保存(save: 'cell')/ 紧凑密度。保存模拟 400ms,宿主把改动写回自己的数据再 done()。
import { computed, ref } from 'vue'
import { NSpace, NSwitch, useMessage } from 'naive-ui'
import {
  SmartTable,
  type EditChanges,
  type SmartTableColumn,
  type SmartTableInst,
} from '../src/index'

interface Row {
  id: number
  code: string
  name: string
  tags: string[]
  qty: number
  done: boolean
  due: string
  locked: boolean
}
const rows = ref<Row[]>(
  Array.from({ length: 300 }, (_, i) => ({
    id: i + 1,
    code: `P${String(i + 1).padStart(4, '0')}`,
    name: `任务 ${i + 1}`,
    tags: i % 3 === 0 ? ['urgent', 'bug'] : i % 3 === 1 ? ['feature'] : [],
    qty: (i * 7) % 50,
    done: i % 4 === 0,
    due: `2026-10-${String((i % 28) + 1).padStart(2, '0')}`,
    locked: i % 10 === 9,
  })),
)
const tagOptions = [
  { label: '紧急', value: 'urgent' },
  { label: '缺陷', value: 'bug' },
  { label: '需求', value: 'feature' },
]
const message = useMessage()
const tableRef = ref<SmartTableInst<Row> | null>(null)
const cellMode = ref(false)
const dense = ref(true)

const columns: SmartTableColumn<Row>[] = [
  { type: 'selection', width: 40, fixed: 'left' },
  { key: 'code', title: '编号', width: 100, fixed: 'left', readonly: true },
  {
    key: 'name',
    title: '名称',
    width: 180,
    rules: {
      required: true,
      // 异步查重:同名任务不允许(模拟 300ms 接口)
      validator: (v, row, all) =>
        new Promise((res) =>
          setTimeout(
            () => res(all.some((r) => r.id !== row.id && r.name === v) ? '名称已存在' : true),
            300,
          ),
        ),
    },
  },
  { key: 'tags', title: '标签', width: 200, options: tagOptions },
  { key: 'qty', title: '数量', width: 100, align: 'right', rules: { int: true, min: 0, max: 99 } },
  { key: 'done', title: '完成', width: 80 },
  { key: 'due', title: '截止', width: 140 },
]
const editable = computed(() => ({
  save: cellMode.value ? ('cell' as const) : ('batch' as const),
  newRow: () => ({ code: '(新)', name: '', tags: [], qty: 0, done: false, due: '2026-10-31' }),
  rowReadonly: (r: Row) => r.locked,
}))

async function onSave(p: {
  changes: EditChanges<Row>
  done: () => void
  fail: (e?: unknown) => void
}) {
  await new Promise((r) => setTimeout(r, 400))
  for (const item of p.changes.rows) {
    if (item.type === 'updated')
      Object.assign(
        rows.value.find((r) => r.id === item.row.id)!,
        item.row,
      )
    else if (item.type === 'deleted') rows.value = rows.value.filter((r) => r.id !== item.row.id)
    else rows.value.unshift({ ...item.row, id: Date.now(), locked: false })
  }
  p.done()
  message.success(`已保存 ${p.changes.rows.length} 项`)
}
</script>

<template>
  <div>
    <n-space align="center" :size="16" style="margin-bottom: 12px">
      <label
        ><n-switch v-model:value="cellMode" size="small" data-testid="cell-mode" /> 即时保存(save:
        'cell')</label
      >
      <label><n-switch v-model:value="dense" size="small" /> 紧凑</label>
    </n-space>
    <div style="height: calc(100vh - 220px)" data-testid="edit-host">
      <SmartTable
        ref="tableRef"
        :columns="columns"
        :data="rows"
        row-key="id"
        :editable="editable"
        fill-height
        :search="false"
        :default-density="dense ? 'compact' : 'comfortable'"
        title="可编辑表格(虚拟滚动 + 固定列)"
        @save="onSave"
        @invalid="(e) => message.error(e.message)"
        @error="(e) => message.error(String(e))"
      />
    </div>
  </div>
</template>
