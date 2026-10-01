<script setup lang="ts">
// 列设置面板:显隐勾选 + 原生 HTML5 拖拽排序 + 固定切换 + 恢复默认。零拖拽库依赖。
// 至少保留一列(N11,原型一致):只剩一个已勾选的列时,那一列的勾选框禁用(没有提示文字,禁用态本身就是说明)。
import { ref, type PropType, type VNodeChild } from 'vue'
import { NButton, NCheckbox, NPopover, NTooltip, useThemeVars } from 'naive-ui'
import type { SmartTableLabels } from './types'
import { canHideColumn, type SettingItem } from './useColumns'
import { ColumnsIcon, DragIcon } from './icons'

const props = defineProps({
  items: { type: Array as PropType<SettingItem[]>, required: true },
  labels: { type: Object as PropType<Required<SmartTableLabels>>, required: true },
})

const emit = defineEmits<{
  toggle: [key: string, show: boolean]
  move: [from: number, to: number]
  setFixed: [key: string, fixed: 'left' | 'right' | undefined]
  reset: []
}>()

const themeVars = useThemeVars()
const dragFrom = ref<number | null>(null)
const dragOver = ref<number | null>(null)

function onDragStart(idx: number, e: DragEvent) {
  dragFrom.value = idx
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}

function onDrop(idx: number) {
  if (dragFrom.value !== null && dragFrom.value !== idx) emit('move', dragFrom.value, idx)
  dragFrom.value = null
  dragOver.value = null
}

// 只剩一个已勾选的列时,隐藏它会让表格没有数据列 → 禁用它的勾选框(useColumns.toggleShow 同样兜底拒绝,编程式调用也隐藏不掉)
const isLastShown = (item: SettingItem) => item.show && !canHideColumn(props.items, item.key)

function renderTitle(title: SettingItem['title']): VNodeChild {
  return typeof title === 'function' ? title() : title
}

function toggleFixed(item: SettingItem, side: 'left' | 'right') {
  emit('setFixed', item.key, item.fixed === side ? undefined : side)
}
</script>

<template>
  <n-popover trigger="click" placement="bottom-end" :show-arrow="false">
    <template #trigger>
      <n-tooltip trigger="hover">
        <template #trigger>
          <n-button quaternary circle size="small" :aria-label="labels.columnSettings">
            <template #icon><ColumnsIcon /></template>
          </n-button>
        </template>
        {{ labels.columnSettings }}
      </n-tooltip>
    </template>

    <div class="smart-table-colset">
      <div
        v-for="(item, idx) in items"
        :key="item.key"
        class="smart-table-colset-row"
        :class="{ 'is-over': dragOver === idx }"
        :style="dragOver === idx ? { background: themeVars.hoverColor } : undefined"
        draggable="true"
        @dragstart="onDragStart(idx, $event)"
        @dragover.prevent="dragOver = idx"
        @dragleave="dragOver === idx && (dragOver = null)"
        @drop.prevent="onDrop(idx)"
        @dragend="((dragFrom = null), (dragOver = null))"
      >
        <span class="smart-table-colset-drag" :style="{ color: themeVars.textColor3 }"><DragIcon /></span>
        <n-checkbox :checked="item.show" :disabled="isLastShown(item)" @update:checked="(v: boolean) => emit('toggle', item.key, v)">
          <component :is="() => renderTitle(item.title)" />
        </n-checkbox>
        <span class="smart-table-colset-pins">
          <n-tooltip trigger="hover">
            <template #trigger>
              <n-button
                quaternary
                circle
                size="tiny"
                :type="item.fixed === 'left' ? 'primary' : 'default'"
                :aria-label="item.fixed === 'left' ? labels.fixedNone : labels.fixedLeft"
                @click="toggleFixed(item, 'left')"
              >⇤</n-button>
            </template>
            {{ item.fixed === 'left' ? labels.fixedNone : labels.fixedLeft }}
          </n-tooltip>
          <n-tooltip trigger="hover">
            <template #trigger>
              <n-button
                quaternary
                circle
                size="tiny"
                :type="item.fixed === 'right' ? 'primary' : 'default'"
                :aria-label="item.fixed === 'right' ? labels.fixedNone : labels.fixedRight"
                @click="toggleFixed(item, 'right')"
              >⇥</n-button>
            </template>
            {{ item.fixed === 'right' ? labels.fixedNone : labels.fixedRight }}
          </n-tooltip>
        </span>
      </div>
      <div class="smart-table-colset-footer" :style="{ borderTop: `1px solid ${themeVars.dividerColor}` }">
        <n-button quaternary size="tiny" @click="emit('reset')">{{ labels.columnSettingsReset }}</n-button>
      </div>
    </div>
  </n-popover>
</template>

<style scoped>
.smart-table-colset {
  min-width: 200px;
  max-height: 320px;
  overflow: auto;
}
.smart-table-colset-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 6px;
  border-radius: 6px;
}
.smart-table-colset-drag {
  cursor: grab;
  display: inline-flex;
  align-items: center;
}
.smart-table-colset-row :deep(.n-checkbox) {
  flex: 1;
  min-width: 0;
}
.smart-table-colset-pins {
  display: inline-flex;
  gap: 2px;
}
.smart-table-colset-footer {
  margin-top: 6px;
  padding-top: 6px;
  display: flex;
  justify-content: flex-end;
}
</style>
