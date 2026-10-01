<script setup lang="ts">
// 表格卡片头:标题 + 左侧操作区(#left)+ 右侧:宿主按钮(#right)、「更多」菜单、内置图标(刷新/密度/列设置 #settings)。
import { computed, type PropType } from 'vue'
import { NButton, NDropdown, NSpace, NTooltip } from 'naive-ui'
import type { DropdownOption } from 'naive-ui'
import type { Density, SmartTableLabels, ToolbarConfig, ToolbarMoreOption } from './types'
import { ChevronDownIcon, DensityIcon, RefreshIcon } from './icons'

const props = defineProps({
  title: { type: String, default: undefined },
  labels: { type: Object as PropType<Required<SmartTableLabels>>, required: true }, // 保留 Task 2 改好的 Required<>(D9)
  // [Object, Boolean]:toolbar: false 是合法取值,只写 Object 时传 false 会让 Vue 报 prop 类型 warn(Q-11)
  config: { type: [Object, Boolean] as PropType<ToolbarConfig | false>, default: () => ({}) },
  density: { type: String as PropType<Density>, required: true },
  /** 远程模式(传了 fetcher)。静态数据模式下刷新什么都不做,所以不显示刷新按钮。 */
  remote: { type: Boolean, default: true },
})

const emit = defineEmits<{
  refresh: []
  'update:density': [d: Density]
  moreSelect: [key: string | number, option: DropdownOption]
}>()

const cfg = computed<ToolbarConfig>(() => (props.config === false ? { refresh: false, density: false, columnSettings: false } : props.config))

const densityOptions = computed(() => [
  { label: (props.density === 'comfortable' ? '✓ ' : '') + props.labels.densityComfortable, key: 'comfortable' },
  { label: (props.density === 'compact' ? '✓ ' : '') + props.labels.densityCompact, key: 'compact' },
])

// 只有分隔线 / 自定义渲染项时没有可选的东西,不渲染「更多」按钮
const moreOptions = computed<ToolbarMoreOption[]>(() => {
  const list = cfg.value.more ?? []
  const selectable = list.some((o) => {
    const t = (o as { type?: string }).type
    return t !== 'divider' && t !== 'render'
  })
  return selectable ? list : []
})

function onMoreSelect(key: string | number, option: DropdownOption) {
  emit('moreSelect', key, option)
}
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
      <n-dropdown v-if="moreOptions.length" trigger="click" placement="bottom-end" :options="moreOptions" @select="onMoreSelect">
        <n-button size="small" icon-placement="right" :aria-label="labels.more">
          {{ labels.more }}
          <template #icon><ChevronDownIcon /></template>
        </n-button>
      </n-dropdown>
      <n-tooltip v-if="cfg.refresh !== false && remote" trigger="hover">
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
