<script setup lang="ts">
// 模块 5「多级表头与固定列」(key wide):用真实库(../../../src)复刻原型 design.html 的 MC.wide。
// 对照原型:25 个数据列(「库存」是三列多级表头)· 左固定 展开 / 勾选 / 序号,右固定「操作」(详情 / 收起)· 列设置里可把任意列固定到左 / 右 ·
// 展开行 = 收货明细小表 · 合计行 summary(当前页求和)· 批量栏「导出所选」· 分页 [20, 50, 100] 默认 20 · 工具栏一行式条件构造器(字段 = 全部数据列)。
// 窄档卡片映射 card 由库的 cardOnNarrow 承接(见 CARD);库做不到的(合计行跟随列设置里「第一个可见列」)这里不假装。
import { computed, h, onBeforeUnmount, onMounted, ref } from 'vue'
import { NButton, NTable } from 'naive-ui'
import { SmartTable, type SmartTableColumn } from '../../../src/index'
import { WIDE_DATA, receiptsOf, wideRowsToCsv, type WideRow } from '../data/m5-wide'
import { fetchWide } from '../backends/m5-wide'
import { fitTitles } from './shared/fitTitles'
import { OPS_BY_TYPE as ACT } from './shared/ops'
import { ACT_BTN, protoToolbar, downloadCsv } from './shared/toolbar'
import { DownloadIcon } from './shared/btn'
import { useProtoTable } from './shared/useProtoTable'

const { shell, t, tableProps, toast } = useProtoTable()
const checked = ref<Array<string | number>>([])
const expanded = ref<Array<string | number>>([])

/* 展开内容不随横向滚动(原型 .exp-in:position: sticky; left: 0; width = 表体可视宽):官方展开行的内容是一个横跨全部列的单元格,
   会跟着表格一起滚走,所以宿主量出表体可视宽度写进 --m5-sc-w,展开内容自己 sticky 贴在可视区左缘。 */
const host = ref<HTMLElement | null>(null)
const scW = ref(0)
let ro: ResizeObserver | undefined
const measure = () => {
  const sc =
    host.value?.querySelector<HTMLElement>(
      '.n-data-table-base-table-body .n-scrollbar-container',
    ) ?? host.value?.querySelector<HTMLElement>('.n-data-table')
  if (sc) scW.value = sc.clientWidth
}
onMounted(() => {
  if (typeof ResizeObserver === 'undefined' || !host.value) return
  ro = new ResizeObserver(measure)
  ro.observe(host.value)
  measure()
})
onBeforeUnmount(() => ro?.disconnect())

const toggleRow = (no: string) => {
  expanded.value = expanded.value.includes(no)
    ? expanded.value.filter((k) => k !== no)
    : [...expanded.value, no]
}

/* 展开行里的「收货明细」(renderExpand):一张小表,宿主自己拼 */
const receipts = (row: WideRow) =>
  h('div', { class: 'm5-exp' }, [
    h('div', { class: 'm5-exp-t' }, t('收货明细')),
    h(NTable, { class: 'm5-exp-table', size: 'small', singleLine: false }, () => [
      h(
        'thead',
        h(
          'tr',
          ['收货单号', '数量', '收货日期', '库位'].map((c) => h('th', t(c))),
        ),
      ),
      h(
        'tbody',
        receiptsOf(row).map((x) =>
          h('tr', [
            h('td', x.no),
            h('td', { class: 'num' }, x.qty.toLocaleString('en-US')),
            h('td', x.date),
            h('td', x.loc),
          ]),
        ),
      ),
    ]),
  ])

/* ---- 列:原型 WIDE_UNITS(w = 宽;num = 右对齐数字;dec = 小数位;ell = 超长省略 + Tooltip) ---- */
type Kind = 'text' | 'select' | 'number' | 'date'
interface U {
  key: keyof WideRow
  label: string
  w: number
  kind?: Kind
  num?: boolean
  dec?: number
  money?: boolean
  ell?: boolean
  options?: string[]
  tag?: boolean
}
const U_COLS: Record<string, U> = {
  no: { key: 'no', label: '物料编码', w: 112 },
  name: { key: 'name', label: '物料名称', w: 176 },
  spec: { key: 'spec', label: '规格说明', w: 220, ell: true },
  category: {
    key: 'category',
    label: '物料分类',
    w: 96,
    options: ['管件', '阀门', '紧固件', '密封件'],
  },
  unit: { key: 'unit', label: '单位', w: 64, options: ['件', '套', '个', '只'] },
  brand: { key: 'brand', label: '品牌', w: 88 },
  model: { key: 'model', label: '型号', w: 104 },
  stockAvail: { key: 'stockAvail', label: '可用', w: 88, num: true },
  stockTransit: { key: 'stockTransit', label: '在途', w: 88, num: true },
  stockLocked: { key: 'stockLocked', label: '锁定', w: 88, num: true },
  safe: { key: 'safe', label: '安全库存', w: 104, num: true },
  price: { key: 'price', label: '单价', w: 104, num: true, money: true },
  amount: { key: 'amount', label: '金额', w: 112, num: true, money: true },
  supplier: { key: 'supplier', label: '供应商', w: 200, ell: true },
  warehouse: { key: 'warehouse', label: '仓库', w: 88, options: ['一号库', '二号库', '三号库'] },
  location: { key: 'location', label: '库位', w: 88 },
  batch: { key: 'batch', label: '批次号', w: 128 },
  mfgDate: { key: 'mfgDate', label: '生产日期', w: 112, kind: 'date' },
  expDate: { key: 'expDate', label: '有效期至', w: 112, kind: 'date' },
  weight: { key: 'weight', label: '重量(kg)', w: 104, num: true, dec: 1 },
  volume: { key: 'volume', label: '体积(m³)', w: 104, num: true, dec: 3 },
  leadTime: { key: 'leadTime', label: '采购周期(天)', w: 128, num: true },
  owner: { key: 'owner', label: '负责人', w: 88 },
  status: {
    key: 'status',
    label: '单据状态',
    w: 104,
    options: ['已审核', '未审核', '已关闭'],
    tag: true,
  },
  memo: { key: 'memo', label: '备注', w: 160, ell: true },
}
const TAG_OF: Record<string, 'success' | 'warning' | 'default'> = {
  已审核: 'success',
  未审核: 'warning',
  已关闭: 'default',
}

/* 窄档卡片映射(原型 WIDE_UNITS 的 card):编码是标题,名称 / 分类 / 可用 / 金额 / 负责人 / 状态是「标签:值」,其余 25 列里的不进卡片 */
const CARD: Record<string, 'title' | 'meta' | false> = {
  no: 'title',
  name: 'meta',
  category: 'meta',
  stockAvail: 'meta',
  amount: 'meta',
  owner: 'meta',
  status: 'meta',
}
const dataCol = (u: U): SmartTableColumn<WideRow> => {
  const c: Record<string, any> = {
    key: u.key,
    title: () => t(u.label),
    width: u.w,
    card: CARD[u.key] ?? false,
  }
  if (u.options) {
    c.options = u.options.map((v) => ({
      label: () => t(v),
      value: v,
      ...(u.tag ? { tagType: TAG_OF[v] } : {}),
    }))
    if (u.tag) c.tag = true
    c.search = { actions: ACT.select }
  } else if (u.num) {
    c.align = 'right' // 原型:数字单元格右对齐,表头左对齐
    if (u.money) c.format = 'money'
    else if (u.dec !== undefined) c.format = (v: unknown) => Number(v).toFixed(u.dec)
    else c.format = (v: unknown) => Number(v).toLocaleString('en-US')
    c.search = {
      type: 'number',
      placeholder: t('请输入数字'),
      actions: ACT.number,
      props: { showButton: false },
    }
  } else if (u.kind === 'date') {
    c.search = { type: 'date', actions: ACT.date }
  } else {
    c.search = { actions: ACT.text }
  }
  if (u.ell) c.ellipsis = { tooltip: true }
  return c as SmartTableColumn<WideRow>
}
const grp = (k: string) => dataCol(U_COLS[k])

const columns = computed<SmartTableColumn<WideRow>[]>(() =>
  fitTitles(
    [
      // 原型 colPlan:展开 · 勾选 · 序号 固定在左,操作固定在右
      {
        type: 'expand',
        width: 40,
        fixed: 'left',
        renderExpand: (row: WideRow) => receipts(row),
      } as SmartTableColumn<WideRow>,
      { type: 'selection', width: 40, fixed: 'left' } as SmartTableColumn<WideRow>,
      {
        type: 'index',
        title: () => t('序号'),
        width: 64,
        fixed: 'left',
      } as SmartTableColumn<WideRow>,
      grp('no'),
      grp('name'),
      grp('spec'),
      grp('category'),
      grp('unit'),
      grp('brand'),
      grp('model'),
      // 多级表头:「库存」下分可用 / 在途 / 锁定(列设置里整组为一项)
      {
        key: 'stock',
        title: () => t('库存'),
        children: [grp('stockAvail'), grp('stockTransit'), grp('stockLocked')],
      } as SmartTableColumn<WideRow>,
      grp('safe'),
      grp('price'),
      grp('amount'),
      grp('supplier'),
      grp('warehouse'),
      grp('location'),
      grp('batch'),
      grp('mfgDate'),
      grp('expDate'),
      grp('weight'),
      grp('volume'),
      grp('leadTime'),
      grp('owner'),
      grp('status'),
      grp('memo'),
      {
        key: 'actions',
        title: () => t('操作'),
        width: 120,
        fixed: 'right',
        resizable: false,
        hideInSetting: true,
        render: (row: WideRow) =>
          h(
            NButton,
            {
              text: true,
              style: ACT_BTN,
              'aria-expanded': expanded.value.includes(row.no),
              onClick: () => toggleRow(row.no),
            },
            () => t(expanded.value.includes(row.no) ? '收起' : '详情'),
          ),
      } as SmartTableColumn<WideRow>,
    ],
    shell.lang === 'en',
  ),
)

/* 合计行(summary,官方 NDataTable 的 summary):当前页求和;「合计」落在物料编码列 */
const SUM_KEYS = ['stockAvail', 'stockTransit', 'stockLocked', 'amount'] as const
const fmt = (v: number, money: boolean) =>
  money
    ? v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : v.toLocaleString('en-US')
const summary = (page: readonly WideRow[]) => {
  const out: Record<string, { value: string }> = { no: { value: t('合计') } }
  for (const k of SUM_KEYS)
    out[k] = {
      value: fmt(
        page.reduce((n, r) => n + Number(r[k]), 0),
        k === 'amount',
      ),
    }
  return out
}

/* 批量栏「导出所选」(原型 batchExport):所选行 × 全部叶子列 */
function onExportSel(keys: Array<string | number>) {
  const set = new Set(keys.map(String))
  const rows = WIDE_DATA.filter((r) => set.has(r.no))
  downloadCsv('物料清单-所选.csv', wideRowsToCsv(rows))
  toast(`已导出所选 ${rows.length} 项`)
}
</script>

<template>
  <div ref="host" class="proto-host" :style="{ '--m5-sc-w': scW ? scW + 'px' : '100%' }">
    <SmartTable
      v-bind="tableProps"
      card-on-narrow
      :columns="columns"
      :fetcher="fetchWide"
      row-key="no"
      :search="{ container: 'table' }"
      :toolbar="protoToolbar()"
      :default-page-size="20"
      :pagination="{ pageSizes: [20, 50, 100] }"
      fill-height
      resizable
      :virtual-scroll="false"
      :summary="summary"
      v-model:checked-row-keys="checked"
      v-model:expanded-row-keys="expanded"
    >
      <template #batch="{ checkedRowKeys }">
        <n-button secondary @click="onExportSel(checkedRowKeys)">
          <template #icon><DownloadIcon /></template>
          {{ t('导出所选') }}
        </n-button>
      </template>
      <template #pagination-prefix="info">{{ t(`共 ${info.itemCount} 条`) }}</template>
    </SmartTable>
  </div>
</template>

<style scoped>
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

<style>
/* 展开行里的收货明细(原型 .exp-in / .exp-t / table.n-table.mt) */
.m5-exp {
  position: sticky;
  left: 0;
  box-sizing: border-box;
  width: var(--m5-sc-w, 100%);
  margin: -8px;
  padding: 12px 16px 14px 56px;
}
.m5-exp-t {
  font-size: 13px;
  color: var(--n-text-color-2, inherit);
  margin-bottom: 8px;
}
.m5-exp-table.n-table {
  width: auto;
  min-width: 420px;
  font-size: 13px;
}
.m5-exp-table.n-table .n-table-th,
.m5-exp-table.n-table th,
.m5-exp-table.n-table td {
  padding: 6px 12px;
  white-space: nowrap;
}
.m5-exp-table.n-table td.num {
  text-align: right;
}
</style>
