<script setup lang="ts">
// 表格卡片头:标题 + 左侧操作区(#left)+ 右侧工具按钮(刷新/密度/列设置 #settings)。
import { computed, type PropType } from 'vue'
import { NButton, NDropdown, NSpace, NTooltip } from 'naive-ui'
import type { Density, SmartTableLabels, ToolbarConfig } from './types'
import { DensityIcon, RefreshIcon } from './icons'

const props = defineProps({
  title: { type: String, default: undefined },
  labels: { type: Object as PropType<Required<SmartTableLabels>>, required: true },
  config: { type: [Object, Boolean] as PropType<ToolbarConfig | false>, default: () => ({}) },
  density: { type: String as PropType<Density>, required: true },
})

const emit = defineEmits<{
  refresh: []
  'update:density': [d: Density]
}>()

const cfg = computed<ToolbarConfig>(() => (props.config === false ? { refresh: false, density: false, columnSettings: false } : props.config))

const densityOptions = computed(() => [
  { label: (props.density === 'comfortable' ? '✓ ' : '') + props.labels.densityComfortable, key: 'comfortable' },
  { label: (props.density === 'compact' ? '✓ ' : '') + props.labels.densityCompact, key: 'compact' },
])
</script>

<template>
  <div class="smart-table-toolbar">
    <div class="smart-table-toolbar-main">
      <h3 v-if="$slots.title || title" class="smart-table-title">
        <slot name="title">{{ title }}</slot>
      </h3>
      <slot name="left" />
    </div>
    <n-space :size="4" align="center">
      <slot name="right" />
      <n-tooltip v-if="cfg.refresh !== false" trigger="hover">
        <template #trigger>
          <n-button quaternary circle size="small" :aria-label="labels.refresh" @click="emit('refresh')">
            <template #icon><RefreshIcon /></template>
          </n-button>
        </template>
        {{ labels.refresh }}
      </n-tooltip>
      <n-dropdown
        v-if="cfg.density === true"
        trigger="click"
        :options="densityOptions"
        @select="(k: Density) => emit('update:density', k)"
      >
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-button quaternary circle size="small" :aria-label="labels.density">
              <template #icon><DensityIcon /></template>
            </n-button>
          </template>
          {{ labels.density }}
        </n-tooltip>
      </n-dropdown>
      <slot name="settings" />
    </n-space>
  </div>
</template>

<style scoped>
.smart-table-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.smart-table-toolbar-main {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.smart-table-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}
</style>
