<script setup lang="ts">
// 下拉表格选择 SmartSelectTable 场景页(浏览器验证用):单选本地(工序库 36 行)/ 多选远程(物料 200 行,搜索 + 分页)/
// 禁用与可清除 / 1000 行与 10000 行本地(虚拟滚动 + 模糊搜索)。
import { computed, ref } from 'vue'
import { NCard, NForm, NFormItem, NSpace } from 'naive-ui'
import { SmartSelectTable, type SmartTableColumn } from '../src/index'
import { labels } from './locale'

interface Op {
  id: number
  code: string
  name: string
  center: string
  setup: number
}
const centers = ['车削中心', '铣削中心', '热处理', '装配线', '检验室']
const names = [
  '粗车',
  '精车',
  '铣面',
  '钻孔',
  '攻丝',
  '磨削',
  '去毛刺',
  '清洗',
  '渗碳',
  '淬火',
  '装配',
  '终检',
]
const ops: Op[] = Array.from({ length: 36 }, (_, i) => ({
  id: i + 1,
  code: `OP${String(i + 1).padStart(3, '0')}`,
  name: `${names[i % names.length]}${i >= names.length ? ` ${Math.floor(i / names.length) + 1}` : ''}`,
  center: centers[i % centers.length],
  setup: (i % 6) * 5 + 5,
}))
const opCols: SmartTableColumn<Op>[] = [
  { key: 'code', title: '工序编码', width: 100 },
  { key: 'name', title: '工序名称', width: 140 },
  { key: 'center', title: '工作中心', width: 120 },
  { key: 'setup', title: '准备工时(分)', width: 110, align: 'right' },
]

interface Mat {
  id: number
  code: string
  name: string
  spec: string
}
const mats: Mat[] = Array.from({ length: 200 }, (_, i) => ({
  id: i + 1,
  code: `M${String(i + 1).padStart(4, '0')}`,
  name: ['六角螺栓', '平垫圈', '弹簧垫圈', '内六角螺钉', '深沟球轴承'][i % 5] + ` ${i + 1}`,
  spec: ['M6', 'M8', 'M10', 'M12', '6204'][i % 5] + `×${10 + (i % 7) * 5}`,
}))
const matCols: SmartTableColumn<Mat>[] = [
  { key: 'code', title: '物料编号', width: 110 },
  { key: 'name', title: '物料名称', width: 180 },
  { key: 'spec', title: '物料规格', width: 120 },
]
/** 远程:模拟 300ms 接口,keyword 在编号 / 名称 / 规格里包含。 */
const matFetcher = async (p: { page: number; pageSize: number; keyword?: string }) => {
  await new Promise((r) => setTimeout(r, 300))
  const kw = (p.keyword ?? '').toLowerCase()
  const hit = kw
    ? mats.filter((m) => `${m.code} ${m.name} ${m.spec}`.toLowerCase().includes(kw))
    : mats
  return { items: hit.slice((p.page - 1) * p.pageSize, p.page * p.pageSize), total: hit.length }
}
const matRows = ref<Mat[]>([])
function onMatPick(rows: Mat[]) {
  matRows.value = rows
}

function big(n: number): Mat[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    code: `M${String(i + 1).padStart(5, '0')}`,
    name: ['六角螺栓', '平垫圈', '弹簧垫圈', '内六角螺钉', '深沟球轴承'][i % 5] + ` ${i + 1}`,
    spec: ['M6', 'M8', 'M10', 'M12', '6204'][i % 5] + `×${10 + (i % 7) * 5}`,
  }))
}
const rows1k = big(1000)
const rows10k = big(10000)

const v1 = ref<number | null>(3)
const v2 = ref<number[]>([1, 2, 3])
const v3 = ref<number | null>(5)
const v4 = ref<number | null>(null)
const v5 = ref<number | null>(null)
const v6 = ref<number[]>([])
const label = (list: Op[] | Mat[], v: number | null) =>
  (list as Array<{ id: number; name: string }>).find((r) => r.id === v)?.name ?? '—'
const text2 = computed(() => v2.value.join(', ') || '—')
</script>

<template>
  <n-space vertical :size="16" class="demo-select-table">
    <n-card title="下拉表格选择 SmartSelectTable" size="small">
      <n-form label-placement="left" label-width="150" style="max-width: 760px">
        <n-form-item label="单选 · 本地(工序库 36 行)">
          <smart-select-table
            v-model:value="v1"
            :columns="opCols"
            :data="ops"
            label-key="name"
            :labels="labels"
            clearable
            placeholder="选择工序"
          />
          <span class="val" data-testid="v1">{{ label(ops, v1) }}</span>
        </n-form-item>
        <n-form-item label="多选 · 远程(物料 200 行)">
          <smart-select-table
            v-model:value="v2"
            multiple
            :columns="matCols"
            :fetcher="matFetcher"
            label-key="name"
            :labels="labels"
            clearable
            placeholder="选择物料"
            @pick="onMatPick"
          />
          <span class="val" data-testid="v2">{{ text2 }}</span>
        </n-form-item>
        <n-form-item label="禁用">
          <smart-select-table
            v-model:value="v3"
            :columns="opCols"
            :data="ops"
            label-key="name"
            :labels="labels"
            disabled
          />
        </n-form-item>
        <n-form-item label="可清除 · 紧凑">
          <smart-select-table
            v-model:value="v4"
            :columns="opCols"
            :data="ops"
            label-key="name"
            :labels="labels"
            clearable
            size="small"
            :panel-width="520"
            placeholder="选择工序(small)"
          />
        </n-form-item>
        <n-form-item label="单选 · 本地 1000 行">
          <smart-select-table
            v-model:value="v5"
            :columns="matCols"
            :data="rows1k"
            label-key="name"
            :labels="labels"
            clearable
            placeholder="1000 行"
            data-testid="sel1k"
          />
        </n-form-item>
        <n-form-item label="多选 · 本地 10000 行">
          <smart-select-table
            v-model:value="v6"
            multiple
            :columns="matCols"
            :data="rows10k"
            label-key="name"
            :labels="labels"
            clearable
            placeholder="10000 行"
            data-testid="sel10k"
          />
        </n-form-item>
      </n-form>
    </n-card>
  </n-space>
</template>

<style scoped>
.val {
  margin-left: 12px;
  color: var(--n-text-color-3, #888);
}
</style>
