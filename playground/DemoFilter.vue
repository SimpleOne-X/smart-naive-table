<script setup lang="ts">
// 过滤 + 列宽 demo:静态 data(前端过滤),覆盖 options / condition / 自定义面板三种形态,
// 并把 @filter-change、@column-resize 的实时结果打在上方。
import { computed, h, ref } from 'vue'
import { NButton, NSlider, NSpace, NTag } from 'naive-ui'
import {
  SmartTable,
  type FilterState,
  type SmartTableColumn,
  type SmartTableInst,
} from '../src/index'
import { allRows, type DemoRow } from './mock'
import { labels, tt } from './locale'

const tableRef = ref<SmartTableInst<DemoRow> | null>(null)
const hostRef = ref<HTMLElement | null>(null)
const state = ref<FilterState>({})
const lastResize = ref('')
const probe = ref('')

/**
 * 列宽自检:把「声明宽」和「实测宽」并排打出来。
 * 拖完之后两者应当逐列相等 —— 不相等就说明表格还在摊派富余宽度,
 * 那正是「拖一列、左边的列跟着动」的直接证据。
 */
function measure() {
  const host = hostRef.value
  if (!host) return
  const declared: Record<string, number> = tableRef.value?.columnWidths ?? {}
  const table = host.querySelector<HTMLElement>('.n-data-table-table')
  const ths = [...host.querySelectorAll<HTMLElement>('th[data-col-key]')]
  const seen = new Set<string>()
  const lines: string[] = []
  let mismatch = 0
  for (const th of ths) {
    const key = th.dataset.colKey ?? ''
    if (!key || seen.has(key)) continue // 分组表头下同一 key 只量一次
    seen.add(key)
    const actual = Math.round(th.getBoundingClientRect().width)
    const dec = declared[key]
    if (dec !== undefined && dec !== actual) mismatch += 1
    lines.push(`${key.padEnd(12)} 声明=${dec ?? '—'}  实测=${actual}`)
  }
  const sum = [...seen].reduce((acc, k) => acc + (declared[k] ?? 0), 0)
  lines.unshift(
    `表格宽=${Math.round(table?.getBoundingClientRect().width ?? 0)}  声明之和=${sum}  不一致列数=${mismatch}`,
  )
  probe.value = lines.join(String.fromCharCode(10))
}

const statusOptions = [
  { label: tt('在职', 'Active'), value: 1, tagType: 'success' as const },
  { label: tt('休假', 'On leave'), value: 2, tagType: 'warning' as const },
  { label: tt('离职', 'Resigned'), value: 3, tagType: 'error' as const },
]

const rows = computed(() => allRows.slice(0, 200))

const columns: SmartTableColumn<DemoRow>[] = [
  { type: 'index', width: 60 },
  // condition 模式:文本列默认给 包含 / 不包含 / 等于 / 不等于
  { key: 'account', title: tt('账号', 'Account'), width: 150, filter: true },
  { key: 'name', title: tt('姓名', 'Name'), width: 120, filter: true },
  // options 模式:有字典就是勾选列表,默认多选
  {
    key: 'status',
    title: tt('状态', 'Status'),
    width: 120,
    options: statusOptions,
    tag: true,
    filter: true,
  },
  // condition 模式:money 列默认给 等于 / 大于 / 小于… 这组动作,并带一个初始过滤值
  {
    key: 'salary',
    title: tt('薪资', 'Salary'),
    width: 140,
    align: 'right',
    format: 'money',
    filter: { defaultValue: { logic: 'and', conditions: [{ action: 'gte', value: 10000 }] } },
  },
  // 日期列:纯日期值按「整天」比较,「等于 2024-03-05」能命中当天任意时刻
  {
    key: 'createTime',
    title: tt('创建时间', 'Created'),
    width: 190,
    format: 'datetime',
    filter: true,
  },
  // 自定义面板:接管整个弹层,只复用提交通道
  {
    key: 'deptId',
    title: tt('部门', 'Department'),
    width: 150,
    filter: {
      render: ({ value, setValue, close }) => {
        const current = (value?.conditions[0]?.value as number) ?? 1
        return h('div', { style: 'padding:12px;min-width:200px' }, [
          h('div', { style: 'margin-bottom:8px' }, `${tt('部门 ≤', 'Dept ≤')()} ${current}`),
          h(NSlider, {
            value: current,
            min: 1,
            max: 4,
            'onUpdate:value': (v: number | [number, number]) =>
              setValue({ logic: 'and', conditions: [{ action: 'lte', value: v as number }] }),
          }),
          h(
            NButton,
            { size: 'tiny', style: 'margin-top:8px', onClick: () => (setValue(null), close()) },
            () => tt('清除', 'Clear')(),
          ),
        ])
      },
    },
    render: (row) => h(NTag, { size: 'small' }, () => `#${row.deptId}`),
  },
]
</script>

<template>
  <div ref="hostRef">
    <n-space align="center" :size="12" style="margin-bottom: 12px">
      <n-button size="small" @click="tableRef?.clearFilters()">{{
        tt('清空全部过滤', 'Clear all filters')()
      }}</n-button>
      <n-button
        size="small"
        @click="
          tableRef?.setFilter('status', {
            logic: 'or',
            conditions: [{ action: 'equal', value: 3 }],
          })
        "
      >
        {{ tt('编程式:只看离职', 'Set filter: resigned')() }}
      </n-button>
      <n-button
        size="small"
        @click="
          tableRef?.setFilter('status', {
            logic: 'and',
            conditions: [{ action: 'notEqual', value: 1 }],
          })
        "
      >
        {{ tt('编程式:状态 ≠ 在职', 'Set filter: status ≠ Active')() }}
      </n-button>
      <span>{{ tt('过滤态', 'Filter state') }}: {{ JSON.stringify(state) }}</span>
      <span v-if="lastResize">{{ tt('最近列宽', 'Last resize') }}: {{ lastResize }}</span>
      <n-button size="small" secondary @click="measure">{{ tt('量一下列宽', 'Measure') }}</n-button>
    </n-space>
    <pre v-if="probe" class="probe">{{ probe }}</pre>

    <SmartTable
      ref="tableRef"
      :columns="columns"
      :data="rows"
      :labels="labels"
      :title="tt('前端过滤 + 列宽拖拽', 'Local filtering + resizable')()"
      :pagination="{ pageSizes: [20, 50, { label: '每页 100 条', value: 100 }] }"
      storage-key="demo-filter"
      resizable
      :single-line="false"
      @filter-change="(_k, _v, s) => (state = s)"
      @column-resize="(key, width) => (lastResize = `${key} = ${Math.round(width)}px`)"
    />
  </div>
</template>

<style scoped>
.probe {
  margin: 0 0 12px;
  padding: 8px 10px;
  font-size: 12px;
  line-height: 1.6;
  border-radius: 6px;
  background: rgba(127, 127, 127, 0.12);
  overflow: auto;
}
</style>
