<script setup lang="ts">
// 表格卡片头:标题 + 左侧操作区(#left)+ 右侧:宿主按钮(#right)、「更多」菜单、内置图标(刷新/密度/列设置 #settings)。
import { computed, type PropType } from 'vue'
import { NButton, NConfigProvider, NDropdown, NTooltip, useThemeVars } from 'naive-ui'
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

const themeVars = useThemeVars()

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

// 内置图标组:刷新 / 密度 / 列设置(#settings)。一个都没有时整组不画,免得空容器多出一个组间距。
const showRefresh = computed(() => cfg.value.refresh !== false && props.remote)

function onMoreSelect(key: string | number, option: DropdownOption) {
  emit('moreSelect', key, option)
}
</script>

<template>
  <div class="smart-table-toolbar">
    <div class="smart-table-toolbar-main">
      <!-- 标题取主题的 textColor1 / fontWeightStrong(与官方卡片标题一致;设计原型 .st-title:16px / 500 / textColor1)。
           走 useThemeVars,不依赖 NCard 的 --n-* 变量,换位置(如 #title 插槽放到别处)也跟着明暗主题走 -->
      <h3
        v-if="$slots.title || title"
        class="smart-table-title"
        :style="{ color: themeVars.textColor1, fontWeight: themeVars.fontWeightStrong }"
      >
        <slot name="title">{{ title }}</slot>
      </h3>
      <slot name="left" />
    </div>
    <div class="smart-table-toolbar-right">
      <!-- 业务组:宿主按钮 + 「更多」,间距 8px(原型 .tb-actions) -->
      <div v-if="$slots.right || moreOptions.length" class="smart-table-toolbar-actions">
        <slot name="right" />
        <n-dropdown v-if="moreOptions.length" trigger="click" placement="bottom-end" :options="moreOptions" @select="onMoreSelect">
          <!-- 默认 medium(34px),与宿主的业务按钮同高;chevron 12px、iconColor(原型 --n-text-3),右内边距 12px(chevron 自带的留白算进去) -->
          <n-button
            icon-placement="right"
            :aria-label="labels.more"
            :theme-overrides="{ iconSizeMedium: '12px' }"
            style="padding-right: 12px"
          >
            {{ labels.more }}
            <template #icon>
              <span class="smart-table-more-icon" :style="{ color: themeVars.iconColor }"><ChevronDownIcon /></span>
            </template>
          </n-button>
        </n-dropdown>
      </div>
      <!-- 内置图标组:刷新 / 密度 / 列设置,间距 4px(原型 .tb-icons);与业务组之间 12px(原型 .tb-right) -->
      <div v-if="showRefresh || cfg.density === true || $slots.settings" class="smart-table-toolbar-icons">
        <!-- 图标按钮的图标 16px(原型;官方 small 圆形按钮默认 18px)。abstract = 不多包一层 DOM;包住 #settings 插槽,列设置按钮同样生效 -->
        <n-config-provider abstract :theme-overrides="{ Button: { iconSizeSmall: '16px' } }">
          <n-tooltip v-if="showRefresh" trigger="hover">
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
        </n-config-provider>
      </div>
    </div>
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
}
/* 右侧两组:业务组(宿主按钮 + 更多)8px、内置图标组 4px、组间 12px —— 设计原型 .tb-actions / .tb-icons / .tb-right。
   n-dropdown / n-tooltip 的触发器不额外包一层,所以 flex 的 gap 直接落在按钮之间。 */
.smart-table-toolbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}
.smart-table-toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.smart-table-toolbar-icons {
  display: flex;
  align-items: center;
  gap: 4px;
}
/* 宿主的 #right 插槽里全是 v-if 为假的内容时,组容器是空的:不占位 */
.smart-table-toolbar-actions:empty,
.smart-table-toolbar-icons:empty {
  display: none;
}
.smart-table-more-icon {
  display: inline-flex;
}
</style>
