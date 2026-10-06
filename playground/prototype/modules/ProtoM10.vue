<script setup lang="ts">
// 模块 10「行拖拽排序」:用真实库的 row-draggable + drag-handle + @row-drag-sort(sortablejs)复刻原型 dragPageHtml。
// 原型:无搜索、无工具栏图标(只有标题「工序」)、无分页、静态 10 行;第一列是 48px 的拖拽手柄列(库不自动加,宿主自己加一列并给 drag-handle 选择器)。
// 键盘 ↑ / ↓ 在手柄上移一位:sortablejs 没有这个能力,宿主在手柄上自己做(库不内置)。
import { h, ref } from 'vue'
import { useThemeVars } from 'naive-ui'
import { SmartTable, type SmartTableColumn } from '../../../src/index'
import { moveItem, freshProcs, type Proc } from '../data/m10-procs'
import { registerDict } from '../i18n'
import { useProtoTable } from './shared/useProtoTable'

registerDict([
  ['工序', 'Operations'],
  ['工序号', 'Op No.'],
  ['工序名称', 'Operation'],
  ['工作中心', 'Work center'],
  ['标准工时(h)', 'Std. hours (h)'],
  ['拖动排序', 'Drag to reorder'],
  ['已保存顺序', 'Order saved'],
])

const { t, tableProps, toast } = useProtoTable()
const rows = ref<Proc[]>(freshProcs())
const themeVars = useThemeVars()

const HANDLE = 'proto-drag-handle'
/* 手柄图标 = 库的 DragIcon(2×3 点阵)的同形 SVG */
const dots = [8, 16].flatMap((x) => [6, 12, 18].map((y) => h('circle', { cx: x, cy: y, r: 1.6 })))

function onKey(e: KeyboardEvent, code: string) {
  if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
  const i = rows.value.findIndex((r) => r.code === code)
  const j = i + (e.key === 'ArrowUp' ? -1 : 1)
  e.preventDefault()
  if (!moveItem(rows.value, i, j)) return
  toast('已保存顺序')
  void Promise.resolve().then(() =>
    requestAnimationFrame(() =>
      document.querySelector<HTMLElement>(`[data-rd="${code}"]`)?.focus(),
    ),
  )
}

const columns: SmartTableColumn<Proc>[] = [
  {
    key: 'rd',
    title: '',
    width: 48,
    resizable: false,
    card: 'handle', // 窄档卡片:手柄在标题行最左(原型 .rd-head)
    render: (row: Proc) =>
      h(
        'span',
        {
          class: HANDLE,
          'data-rd': row.code,
          role: 'button',
          tabindex: 0,
          'aria-label': t('拖动排序'),
          'aria-roledescription': 'draggable',
          onKeydown: (e: KeyboardEvent) => onKey(e, row.code),
        },
        [
          h(
            'svg',
            {
              viewBox: '0 0 24 24',
              width: '1em',
              height: '1em',
              fill: 'currentColor',
              'aria-hidden': 'true',
            },
            dots,
          ),
        ],
      ),
  } as SmartTableColumn<Proc>,
  // 序号:库的 type:'index' 列会被排到最前(在手柄列之前),原型是「手柄 → 序号」,所以这里用普通列按行位置渲染
  {
    key: 'idx',
    title: () => t('序号'),
    width: 64,
    card: false,
    render: (_r: Proc, i: number) => i + 1,
  } as SmartTableColumn<Proc>,
  { key: 'code', title: () => t('工序号'), width: 96 },
  { key: 'name', title: () => t('工序名称'), width: 160, card: 'title' },
  { key: 'center', title: () => t('工作中心'), width: 140 },
  {
    key: 'hours',
    title: () => t('标准工时(h)'),
    width: 120,
    align: 'right',
    render: (r: Proc) => r.hours.toFixed(1),
  } as SmartTableColumn<Proc>,
  {
    key: 'note',
    title: () => t('备注'),
    minWidth: 120,
    render: (r: Proc) => r.note || '—',
  } as SmartTableColumn<Proc>,
]

/* 松手:库已把 rows 按新顺序就地重排(rowDragSort.reordered),宿主「落库」后提示 */
function onSort(e: { from: number; to: number; reordered: Proc[] }) {
  rows.value = e.reordered.slice()
  toast('已保存顺序')
}
</script>

<template>
  <div class="proto-host">
    <SmartTable
      v-bind="tableProps"
      card-on-narrow
      :columns="columns"
      :data="rows"
      row-key="code"
      :toolbar="false"
      :search="false"
      :pagination="false"
      row-draggable
      :drag-handle="'.' + HANDLE"
      @row-drag-sort="onSort"
    />
  </div>
</template>

<style scoped>
/* 自然高度页(registry natural:整页在主区里滚动):不铺满,卡片随内容撑高 */
.proto-host {
  flex: none;
  display: flex;
  flex-direction: column;
}
/* 原型 .drag-handle:24×24、圆角 3、textColor3、grab;悬停 = 按钮悬停底 */
.proto-host :deep(.proto-drag-handle) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  margin: -2px 0;
  border-radius: 3px;
  color: v-bind('themeVars.textColor3'); /* 原型 --n-text-2 = naive textColor3 */
  cursor: grab;
  touch-action: none;
  user-select: none;
  font-size: 16px;
}
.proto-host :deep(.proto-drag-handle:hover) {
  background: v-bind('themeVars.buttonColor2Hover');
  color: v-bind('themeVars.textColor1');
}
.proto-host :deep(.proto-drag-handle:focus-visible) {
  outline: 2px solid v-bind('themeVars.primaryColor');
  outline-offset: 1px;
}
.proto-host :deep(.smart-table-title) {
  line-height: 21px; /* 原型 .st-title:h3 行高 ≈ 1.3(工具栏 21px);库标题继承 1.6 → 25.6px */
}
</style>
