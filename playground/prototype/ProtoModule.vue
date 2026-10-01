<script setup lang="ts">
// 对照页的一个模块:用真实库(../../src)复刻原型的一张表。
// 规则:宿主能配的都照原型配(全局默认见 ProtoApp 的 provide、props、插槽里的宿主按钮、fillHeight、collapsible 搜索……);
// 库做不到的(条件构造器、放大、批量栏、窄档卡片 / 操作折叠 / 筛选抽屉……)一律留空,不用自定义代码假装。
// 库默认就对的地方宿主**不覆盖**:空状态(官方 NEmpty「无数据」)、日期占位(官方 locale 的「选择日期」)、loading(NDataTable 官方样子)。
import { h, ref } from 'vue'
import { NButton, NSpace, useMessage } from 'naive-ui'
import { SmartTable, type SmartTableColumn, type SmartTableInst, type FilterAction } from '../../src/index'
import { addRow, delRow, type Row } from './data'
import { fetchRows } from './fetcher'

type Mod = 'search' | 'toolbar' | 'filter' | 'sort'
const props = defineProps<{ mod: Mod }>()

const message = useMessage()
const tableRef = ref<SmartTableInst<Row> | null>(null)
const checked = ref<Array<string | number>>([])
const toast = (msg: string) => message.create(msg, { type: 'default' })

const hdr = props.mod === 'filter' || props.mod === 'sort'

/* ---- 原型 COLS(w = 表格列宽,flex = 弹性列:不写 width、w 当最小宽度) ---- */
const COLS = [
  { key: 'no', label: '物料编码', w: 112 },
  { key: 'name', label: '物料名称', w: 176, flex: true },
  { key: 'owner', label: '负责人', w: 88 },
  { key: 'status', label: '单据状态', w: 96 },
  { key: 'dept', label: '部门', w: 88 },
  { key: 'amount', label: '金额', w: 104 },
  { key: 'bizDate', label: '单据日期', w: 112 },
]

/* ---- 原型 H_CFG:模块 3 = sorter: true(单列互斥);模块 4 = sorter: { multiple: n } + 日期列 defaultSortOrder ---- */
const SORTERS: Record<string, Record<string, any>> = {
  filter: { no: true, amount: true, bizDate: true },
  sort: { dept: { multiple: 3 }, amount: { multiple: 2 }, bizDate: { multiple: 1 } },
}
const sorterOf = (key: string) => (hdr ? SORTERS[props.mod][key] : undefined)

/* 原型 hdrColW:模块 3 / 4 的列宽要放得下「标题 + 漏斗 + 箭头」 */
const colW = (c: (typeof COLS)[number]) =>
  hdr ? Math.max(c.w, 12 + Math.ceil(c.label.length * 14.5) + 30 + (sorterOf(c.key) ? 21 : 0) + 16) : c.w

/* ---- 原型 OPS_BY_TYPE:15 个操作符按字段类型分发;库默认只给 8 个,宿主在列上写 filter.actions 才出现新的 ---- */
const ACT: Record<'text' | 'number' | 'date' | 'select', FilterAction[]> = {
  text: ['contains', 'notContains', 'equal', 'notEqual', 'startsWith', 'endsWith', 'like', 'isNull', 'isNotNull', 'in', 'notIn'],
  number: ['equal', 'notEqual', 'gt', 'gte', 'lt', 'lte', 'isNull', 'isNotNull', 'in', 'notIn'],
  date: ['equal', 'notEqual', 'gt', 'gte', 'lt', 'lte', 'isNull', 'isNotNull'],
  select: ['equal', 'notEqual', 'in', 'notIn', 'isNull', 'isNotNull'],
}

/* 状态徽标:原型里「已审核 / 未审核」是主色 pill,「已关闭」是默认灰 pill */
const statusOptions = [
  { label: '已审核', value: '已审核', tagType: 'primary' as const },
  { label: '未审核', value: '未审核', tagType: 'primary' as const },
  { label: '已关闭', value: '已关闭', tagType: 'default' as const },
]
const deptOptions = ['采购部', '生产部', '仓储部'].map((v) => ({ label: v, value: v }))
const STATUS_DEFAULT = { logic: 'and' as const, conditions: [{ action: 'equal' as const, value: '未审核' }] }

const fieldCol = (c: (typeof COLS)[number] & { flex?: boolean }): SmartTableColumn<Row> => {
  const base: Record<string, any> = { key: c.key, title: c.label }
  if (c.flex) base.minWidth = c.w
  else base.width = colW(c)
  const s = sorterOf(c.key)
  if (s) base.sorter = s
  if (props.mod === 'sort' && c.key === 'bizDate') base.defaultSortOrder = 'descend'

  // 搜索(只模块 1):原型是 n-form-item + 普通输入框 / 下拉;金额、日期原型里是文本输入框(库是 NInputNumber / NDatePicker)
  switch (c.key) {
    case 'status':
      base.options = statusOptions
      base.tag = true
      if (props.mod === 'search') base.search = true
      // 原型模块 3:单据状态带 filter.defaultValue = 未审核 —— 初始过滤态 = 默认值,面板「重置」恢复默认,chips 行末偏离默认时出现「恢复默认」
      if (hdr) base.filter = { actions: ACT.select, ...(props.mod === 'filter' ? { defaultValue: STATUS_DEFAULT } : {}) }
      break
    case 'dept':
      base.options = deptOptions
      if (props.mod === 'search') base.search = true
      // 原型模块 3:部门是单选勾选列(filter.multiple: false,官方用 NRadio)
      if (hdr) base.filter = { actions: ACT.select, ...(props.mod === 'filter' ? { multiple: false } : {}) }
      break
    case 'amount':
      base.align = 'right' // 原型:金额单元格右对齐,表头仍左对齐(titleAlign 取全局默认 left)
      base.format = (v: unknown) => Number(v).toLocaleString()
      if (props.mod === 'search') base.search = { type: 'number', placeholder: '请输入数字', props: { clearable: false, showButton: false } }
      if (hdr) base.filter = { type: 'number', actions: ACT.number }
      break
    case 'bizDate':
      if (props.mod === 'search') base.search = { type: 'date' }
      if (hdr) base.filter = { type: 'date', actions: ACT.date }
      break
    default:
      if (props.mod === 'search') base.search = { placeholder: '请输入', props: { clearable: false } }
      if (hdr) base.filter = { type: 'input', actions: ACT.text }
  }
  return base as SmartTableColumn<Row>
}

const columns: SmartTableColumn<Row>[] = [
  { type: 'selection', width: 40 },
  ...COLS.map(fieldCol),
  // 备注:只在模块 1 的搜索表单里出现,不进表格(原型 FIELD_DEFS 有 memo、COLS 没有)
  ...(props.mod === 'search'
    ? [{ key: 'memo', title: '备注', hideInTable: true, search: { placeholder: '请输入', props: { clearable: false } } } as SmartTableColumn<Row>]
    : []),
  {
    key: 'actions',
    title: '操作',
    width: 112,
    resizable: false, // 原型:操作列没有拖拽把手、也不吸收余量
    hideInSetting: true,
    render: (row: Row) =>
      h(NSpace, { size: 12, wrapItem: false }, () => [
        h(NButton, { text: true, onClick: () => toast(`正在编辑 ${row.no}`) }, () => '编辑'),
        h(NButton, { text: true, type: 'error', onClick: () => onDel(row.no) }, () => '删除'),
      ]),
  } as SmartTableColumn<Row>,
]

/* 「更多」菜单:官方 NDropdown options 原样透传;选中后库发 moreSelect,导出 / 导入由宿主处理 */
const moreOptions = [
  { label: '导出', key: 'export' },
  { label: '导入', key: 'import' },
  { type: 'divider' as const, key: 'd1' },
  { label: '下载导入模板', key: 'tpl' },
]
function onMore(key: string | number) {
  if (key === 'export') toast(`已导出 ${tableRef.value?.pagination.itemCount ?? 0} 条`)
  else if (key === 'import') toast('请选择要导入的文件')
  else if (key === 'tpl') toast('已下载导入模板')
}

async function onAdd() {
  const no = addRow()
  await tableRef.value?.refresh()
  toast(`已新增 ${no}`)
}
async function onDel(no: string) {
  if (delRow(no)) {
    await tableRef.value?.refresh()
    toast(`已删除 ${no}`)
  }
}

/* 模块 1 的搜索区:首行 + 展开 / 收起(collapsible);label 区 70px(库的 labelWidth 含 12px 右内边距 = 原型 62px 文字区 + 8px 间距) */
const searchCfg = props.mod === 'search' ? { collapsible: true, labelWidth: 70 } : undefined
</script>

<template>
  <div class="proto-host">
    <SmartTable
      ref="tableRef"
      :columns="columns"
      :fetcher="fetchRows"
      row-key="no"
      title="物料单据"
      :search="searchCfg"
      :toolbar="{ more: moreOptions }"
      fill-height
      resizable
      :filter-chips="hdr"
      v-model:checked-row-keys="checked"
      @more-select="onMore"
    >
      <template #toolbar-right>
        <!-- 原型的「新增」图标是 13px;官方 NButton 的图标盒默认 18px(会让按钮宽 3px),所以宿主这里把 iconSizeMedium 调成 13px -->
        <n-button :type="mod === 'search' ? 'default' : 'primary'" :theme-overrides="{ iconSizeMedium: '13px' }" @click="onAdd">
          <template #icon>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M8 3v10M3 8h10" /></svg>
          </template>
          新增
        </n-button>
      </template>
      <template #pagination-prefix="info">共 {{ info.itemCount }} 条</template>
    </SmartTable>
  </div>
</template>

<style scoped>
/* 宿主给 fillHeight 的确定高度:flex 链末端(.viewport 内的剩余高度) */
.proto-host {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.proto-host > :deep(.smart-table) {
  flex: 1 1 0;
}
</style>
