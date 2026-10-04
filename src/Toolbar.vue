<script setup lang="ts">
// 表格卡片头:标题 + 左侧操作区(#left)+ 右侧:宿主按钮(#right)、「更多」菜单、内置图标(刷新/密度/列设置 #settings)。
// 批量栏:有勾选时原地替换「标题 + 宿主按钮 + 更多」那一段,变成「已选 N 项 + #batch 插槽 + 取消选择」;
// 内置图标组留在右侧。批量栏的 min-height = 勾选前工具栏的实测高度(同一个根元素,勾选不让表格跳动)。
import { computed, onBeforeUnmount, onMounted, ref, useSlots, type PropType, type Slots } from 'vue'
import { NButton, NCheckbox, NConfigProvider, NDropdown, NTooltip, useThemeVars } from 'naive-ui'
import type { DropdownMenuProps, DropdownOption } from 'naive-ui'
import type { Density, SmartTableLabels, ToolbarConfig, ToolbarMoreOption } from './types'
import { fmt } from './labels'
import { useEscClose } from './useEscClose'
import { ChevronDownIcon, DensityIcon, MaximizeIcon, RefreshIcon, RestoreIcon } from './icons'

const props = defineProps({
  title: { type: String, default: undefined },
  labels: { type: Object as PropType<Required<SmartTableLabels>>, required: true }, // 完整文案(SmartTable 已把内置 / 全局 / 实例三层合并成 Required<>)
  // [Object, Boolean]:toolbar: false 是合法取值,只写 Object 时传 false 会让 Vue 报 prop 类型 warn
  config: { type: [Object, Boolean] as PropType<ToolbarConfig | false>, default: () => ({}) },
  density: { type: String as PropType<Density>, required: true },
  /** 远程模式(传了 fetcher)。静态数据模式下刷新什么都不做,所以不显示刷新按钮。 */
  remote: { type: Boolean, default: true },
  /**
   * 批量栏:非 null 时替换左半段。count = 已选键数(跨页总数);checked / indeterminate = 「本页全选」复选框的状态
   * (原型 .bt-info:本页行全勾上 = 选中,否则 = 半选)。出现条件由 SmartTable 判断(有 selection 列、传了 #batch、宿主绑了 checked-row-keys、且有勾选)。
   */
  batch: {
    type: Object as PropType<{ count: number; checked: boolean; indeterminate: boolean } | null>,
    default: null,
  },
  /** 容器宽档位(模式 2 的 #cond 插槽用):宽 ≥ 1280 单行三段式、中 < 1280 两行、窄 < 600 两行(第 2 行是「输入框 + 筛选」)。 */
  tier: { type: String as PropType<'narrow' | 'mid' | 'wide'>, default: 'wide' },
  /** 放大按钮是否显示(toolbar.maximize 开启),以及当前是否处于放大态(状态在 SmartTable)。 */
  maximizable: { type: Boolean, default: false },
  maximized: { type: Boolean, default: false },
  /**
   * 窄档折叠(cardOnNarrow 且容器宽 < 600,规格 §5.2 / §5.8):业务按钮折叠成文字按钮「操作 ▾」、点开原位展开一行,
   * 控件放大到触控尺寸(官方 large:高 40);批量栏有自己的窄档排布,不受影响。
   */
  fold: { type: Boolean, default: false },
  /** 窄档折叠下,工具栏最下面是否画「排序」按钮(表有可排序列;窄档没有表头,排序入口收在这里)。 */
  sortEntry: { type: Boolean, default: false },
  /** 已生效的排序条数,画成「排序」按钮的角标(0 不画)。 */
  sortCount: { type: Number, default: 0 },
  /**
   * 可编辑表格(editable)的工具栏按钮:非 null 时「放弃修改 / 新增行 / 保存修改(N)」放在业务组最前,批量栏里带「删除所选 / 放弃修改 / 保存修改(N)」。
   * 平时「新增行」是主色;有待保存修改(count > 0)时主色让给「保存修改」,「新增行」降为默认描边 —— 一屏只有一个主色按钮。
   */
  edit: {
    type: Object as PropType<{
      count: number
      saving: boolean
      add: boolean
      remove: boolean
      restore: boolean
    } | null>,
    default: null,
  },
})

const emit = defineEmits<{
  refresh: []
  'update:density': [d: Density]
  moreSelect: [key: string | number, option: DropdownOption]
  clearSelection: []
  /** 批量栏的「本页全选」复选框:true = 勾上本页所有可勾行,false = 取消本页(其它页的勾选保留)。 */
  toggleAll: [checked: boolean]
  /** 窄档「排序」按钮:请求打开排序抽屉。 */
  openSort: []
  toggleMaximize: []
  /** 可编辑表格:保存修改 / 放弃修改 / 新增行 / 删除所选(批量栏)。 */
  editSave: []
  editDiscard: []
  editAdd: []
  editDeleteSelected: []
  editRestore: []
}>()

// 「更多」/ 密度下拉:受控,好让 Esc 能关(NDropdown 只有焦点在菜单里才响应 Esc),「放大」的 Esc 分层依赖它
const moreShow = ref(false)
const densityShow = ref(false)
useEscClose(moreShow)
useEscClose(densityShow)

// Teleport 搬 DOM 会让原来聚焦的按钮失焦;键盘操作后由 SmartTable 经它把焦点还给按钮
const maximizeBtnRef = ref<{ $el?: HTMLElement } | null>(null)
defineExpose({ focusMaximize: () => maximizeBtnRef.value?.$el?.focus({ preventScroll: true }) })

// 批量栏的 min-height:只在「不是批量态」时记录工具栏行的实测高度;批量态沿用最近一次的值。
// jsdom / SSR 没有 ResizeObserver 时不设 min-height(退化成内容自然高度)。
const rootRef = ref<HTMLElement | null>(null)
const normalHeight = ref(0)
let resizeObserver: ResizeObserver | null = null
function measureNormal() {
  if (props.batch || !rootRef.value) return
  normalHeight.value = Math.round(rootRef.value.getBoundingClientRect().height)
}
onMounted(() => {
  measureNormal()
  if (typeof ResizeObserver === 'undefined' || !rootRef.value) return
  resizeObserver = new ResizeObserver(measureNormal)
  resizeObserver.observe(rootRef.value)
})
onBeforeUnmount(() => resizeObserver?.disconnect())
const rootStyle = computed(() =>
  props.batch && normalHeight.value > 0 ? { minHeight: `${normalHeight.value}px` } : undefined,
)

const themeVars = useThemeVars()
// 显式标注:slots 参与 hasBizActions 的推断,不写会让 dts 生成报 TS7022(同 SmartTable.vue 的 slots)
const slots: Slots = useSlots()

const cfg = computed<ToolbarConfig>(() =>
  props.config === false ? { refresh: false, density: false, columnSettings: false } : props.config,
)

// 选中态交给 NDropdown 的 value(官方给选中项 active 样式),label 里不再手拼勾;label 在渲染期取,切语言即时跟随
const densityOptions = computed(() => [
  { label: props.labels.densityComfortable, key: 'comfortable' },
  { label: props.labels.densityCompact, key: 'compact' },
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

// 窄档折叠:业务按钮(宿主 #right + 「更多」)收进「操作 ▾」,点开原位多出一行(不是浮层、不加动画)。批量栏出现时不折叠。
const opsOpen = ref(false)
// 「放弃修改」是静默按钮(原型 .n-btn.quiet):内边距 8px(窄档触控尺寸 12px),比官方 quaternary 默认的 12px 窄
const quietPadding = { paddingMedium: '0 8px', paddingLarge: '0 12px' }
const foldActive = computed(() => props.fold && !props.batch)
const hasBizActions = computed<boolean>(
  () => !!slots.right || moreOptions.value.length > 0 || !!props.edit,
)
// 官方 NConfigProvider 的 componentOptions:让宿主放进来的 NButton(没写 size 的)跟着变 large,不必改宿主代码
const foldOptions = computed(() =>
  props.fold ? { Button: { size: 'large' as const } } : undefined,
)
// 图标按钮:窄档 large(40×40 触控目标),其余 small(28)
const iconSize = computed<'small' | 'large'>(() => (props.fold ? 'large' : 'small'))
const iconThemeOverrides = { Button: { iconSizeSmall: '16px', iconSizeLarge: '16px' } }

// 内置图标组:刷新 / 密度 / 列设置(#settings)。一个都没有时整组不画,免得空容器多出一个组间距。
const showRefresh = computed(() => cfg.value.refresh !== false && props.remote)

function onMoreSelect(key: string | number, option: DropdownOption) {
  emit('moreSelect', key, option)
}

// 「更多」菜单的锚定(设计文档 §7.3 / 原型 .more-pop):按钮下方、左对齐(按钮在业务组末尾,右侧还有内置图标,不靠右贴边)、
// 最小宽 148、离按钮 8px。全走官方入口:
// - 左对齐 = placement="bottom-start";
// - 最小宽 = 官方 menu-props(根菜单调用时 option 为 undefined;子菜单不加)。不用 Popover 的 min-width prop:
//   naive-ui 的 PopoverBody 把它写成了 max-width(es/popover/src/PopoverBody.mjs 的 styleRef,2.45.3 实测);
// - 间距 = Dropdown 的 peers.Popover 主题覆盖 space(官方默认 6px,es/popover/styles/_common.mjs),只作用于这一个下拉。
const moreMenuProps: DropdownMenuProps = (option) => (option ? {} : { style: 'min-width: 148px' })
const moreThemeOverrides = computed(() => ({
  peers: { Popover: { space: '8px' } },
  // 窄档触控:选项高 44px(官方 medium 档是 34;主题变量 optionHeightMedium),只作用于这个下拉
  ...(props.fold ? { optionHeightMedium: '44px' } : {}),
}))
</script>

<template>
  <div
    ref="rootRef"
    class="smart-table-toolbar"
    :class="[
      {
        'smart-table-toolbar--batch': !!batch,
        'smart-table-toolbar--batch-narrow': !!batch && tier === 'narrow',
        'smart-table-toolbar--fold': foldActive,
        'smart-table-toolbar--ops-open': foldActive && opsOpen,
      },
      $slots.cond && !batch ? ['smart-table-toolbar--cond', `smart-table-toolbar--${tier}`] : '',
    ]"
    :style="rootStyle"
  >
    <n-config-provider abstract :component-options="foldOptions">
      <!-- 批量栏:替换「标题 + 业务按钮 + 更多」;内置图标组(下面的 .smart-table-toolbar-icons)留着 -->
      <div v-if="batch" class="smart-table-toolbar-main smart-table-batch">
        <span class="smart-table-batch-info">
          <n-checkbox
            :checked="batch.checked"
            :indeterminate="batch.indeterminate"
            :aria-label="labels.filterSelectAll"
            @update:checked="(v: boolean) => emit('toggleAll', v)"
          />
          {{ fmt(labels.selectedCount, { n: batch.count }) }}
        </span>
        <div class="smart-table-batch-acts">
          <slot name="batch" />
          <!-- 可编辑表格:删除所选(待删除,保存才生效)+ 待保存的修改在批量栏里也够得着 -->
          <template v-if="edit">
            <n-button
              v-if="edit.remove"
              :disabled="edit.saving"
              :text-color="themeVars.errorColor"
              @click="emit('editDeleteSelected')"
              >{{ labels.editDeleteSelected }}</n-button
            >
            <n-button v-if="edit.restore" :disabled="edit.saving" @click="emit('editRestore')">{{
              labels.editRestoreSelected
            }}</n-button>
            <template v-if="edit.count > 0">
              <n-button
                quaternary
                :disabled="edit.saving"
                :theme-overrides="quietPadding"
                @click="emit('editDiscard')"
                >{{ labels.editDiscard }}</n-button
              >
              <n-button type="primary" :loading="edit.saving" @click="emit('editSave')">{{
                fmt(labels.editSave, { n: edit.count })
              }}</n-button>
            </template>
          </template>
        </div>
        <n-button
          quaternary
          :size="tier === 'narrow' ? 'large' : 'medium'"
          @click="emit('clearSelection')"
          >{{ labels.clearSelection }}</n-button
        >
      </div>
      <!-- 模式 2:标题 + 条件构造器(#cond)。宽档整行 1:1 分成两半(左 = 标题 + 构造器,右 = 按钮 + 图标);中 / 窄档 main 退场(display: contents),
         标题 / 构造器 / 右半区落进各自的网格区域,构造器独占第 2 行 -->
      <div v-else-if="$slots.cond" class="smart-table-toolbar-main smart-table-toolbar-main--cond">
        <div class="smart-table-toolbar-head">
          <h3
            v-if="$slots.title || title"
            class="smart-table-title"
            :style="{ color: themeVars.textColor1, fontWeight: themeVars.fontWeightStrong }"
          >
            <slot name="title">{{ title }}</slot>
          </h3>
          <slot name="left" />
        </div>
        <div class="smart-table-toolbar-cond"><slot name="cond" /></div>
      </div>
      <div v-else class="smart-table-toolbar-main">
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
      <!-- 窄档折叠:业务按钮收进文字按钮「操作 ▾」(原型 .ops-toggle),展开时按钮底色同悬停底 -->
      <n-button
        v-if="foldActive && hasBizActions"
        class="smart-table-toolbar-ops"
        quaternary
        size="large"
        :aria-expanded="opsOpen"
        :theme-overrides="{
          colorQuaternary: opsOpen ? themeVars.buttonColor2Hover : undefined,
          paddingLarge: '0 12px',
        }"
        @click="opsOpen = !opsOpen"
      >
        {{ labels.operations }} {{ opsOpen ? '▴' : '▾' }}
      </n-button>
      <div class="smart-table-toolbar-right">
        <!-- 业务组:宿主按钮 + 「更多」,间距 8px(原型 .tb-actions) -->
        <div
          v-if="!batch && ($slots.right || moreOptions.length || edit)"
          class="smart-table-toolbar-actions"
        >
          <!-- 可编辑表格:放弃修改(静默)/ 新增行 / 保存修改(N)(有修改时的唯一主色) -->
          <template v-if="edit">
            <n-button
              v-if="edit.count > 0"
              quaternary
              :disabled="edit.saving"
              :theme-overrides="quietPadding"
              @click="emit('editDiscard')"
              >{{ labels.editDiscard }}</n-button
            >
            <n-button
              v-if="edit.add"
              :type="edit.count > 0 ? 'default' : 'primary'"
              :disabled="edit.saving"
              :theme-overrides="{ iconSizeMedium: '13px', iconSizeLarge: '13px' }"
              @click="emit('editAdd')"
            >
              <template #icon>
                <svg
                  viewBox="0 0 16 16"
                  width="1em"
                  height="1em"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                  aria-hidden="true"
                >
                  <path d="M8 3v10M3 8h10" />
                </svg>
              </template>
              {{ labels.editAddRow }}
            </n-button>
            <n-button
              v-if="edit.count > 0"
              type="primary"
              :loading="edit.saving"
              @click="emit('editSave')"
              >{{ fmt(labels.editSave, { n: edit.count }) }}</n-button
            >
          </template>
          <slot name="right" />
          <n-dropdown
            v-if="moreOptions.length"
            v-model:show="moreShow"
            trigger="click"
            placement="bottom-start"
            :options="moreOptions"
            :menu-props="moreMenuProps"
            :theme-overrides="moreThemeOverrides"
            @select="onMoreSelect"
          >
            <!-- 默认 medium(34px),与宿主的业务按钮同高;chevron 12px、iconColor(原型 --n-text-3),右内边距 12px(chevron 自带的留白算进去) -->
            <n-button
              icon-placement="right"
              :aria-label="labels.more"
              :theme-overrides="{ iconSizeMedium: '12px', iconSizeLarge: '12px' }"
              :style="foldActive ? undefined : 'padding-right: 12px'"
            >
              {{ labels.more }}
              <template #icon>
                <span class="smart-table-more-icon" :style="{ color: themeVars.iconColor }"
                  ><ChevronDownIcon
                /></span>
              </template>
            </n-button>
          </n-dropdown>
        </div>
        <!-- 内置图标组:刷新 / 密度 / 列设置,间距 4px(原型 .tb-icons);与业务组之间 12px(原型 .tb-right) -->
        <div
          v-if="showRefresh || cfg.density === true || maximizable || $slots.settings"
          class="smart-table-toolbar-icons"
        >
          <!-- 图标按钮的图标 16px(原型;官方 small 圆形按钮默认 18px)。abstract = 不多包一层 DOM;包住 #settings 插槽,列设置按钮同样生效 -->
          <n-config-provider abstract :theme-overrides="iconThemeOverrides">
            <n-tooltip v-if="maximizable" trigger="hover">
              <template #trigger>
                <n-button
                  ref="maximizeBtnRef"
                  :quaternary="!maximized"
                  :secondary="maximized"
                  circle
                  :size="iconSize"
                  :aria-label="maximized ? labels.restore : labels.maximize"
                  :aria-pressed="maximized"
                  @click="emit('toggleMaximize')"
                >
                  <template #icon
                    ><component :is="maximized ? RestoreIcon : MaximizeIcon"
                  /></template>
                </n-button>
              </template>
              {{ maximized ? labels.restore : labels.maximize }}
            </n-tooltip>
            <n-tooltip v-if="showRefresh" trigger="hover">
              <template #trigger>
                <n-button
                  quaternary
                  circle
                  :size="iconSize"
                  :aria-label="labels.refresh"
                  @click="emit('refresh')"
                >
                  <template #icon><RefreshIcon /></template>
                </n-button>
              </template>
              {{ labels.refresh }}
            </n-tooltip>
            <n-dropdown
              v-if="cfg.density === true"
              v-model:show="densityShow"
              trigger="click"
              :value="density"
              :options="densityOptions"
              @select="(k: Density) => emit('update:density', k)"
            >
              <n-tooltip trigger="hover">
                <template #trigger>
                  <n-button quaternary circle :size="iconSize" :aria-label="labels.density">
                    <template #icon><DensityIcon /></template>
                  </n-button>
                </template>
                {{ labels.density }}
              </n-tooltip>
            </n-dropdown>
            <slot name="settings" :size="iconSize" />
          </n-config-provider>
        </div>
      </div>
      <!-- 窄档折叠:没有表头,排序入口放在工具栏最下面一行(原型 .tb-search 的「排序」按钮,带生效条数角标) -->
      <div v-if="foldActive && sortEntry" class="smart-table-toolbar-entries">
        <span class="smart-table-toolbar-sort-wrap">
          <n-button class="smart-table-toolbar-sort" size="large" @click="emit('openSort')">{{
            labels.sort
          }}</n-button>
          <span
            v-if="sortCount > 0"
            class="smart-table-toolbar-sort-badge"
            aria-hidden="true"
            :style="{ background: themeVars.primaryColor, color: themeVars.baseColor }"
            >{{ sortCount }}</span
          >
        </span>
      </div>
    </n-config-provider>
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
/* 模式 2(设计 2.11):宽档整行 1:1 —— 左半 = 标题 + 条件构造器,右半 = 按钮 + 图标(靠右);单行阈值 1280 由 SmartTable 的 tier 给 */
.smart-table-toolbar--cond.smart-table-toolbar--wide {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  column-gap: 12px;
}
.smart-table-toolbar--wide .smart-table-toolbar-right {
  justify-self: end;
}
.smart-table-toolbar-main--cond {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.smart-table-toolbar-head {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 0 1 auto;
  min-width: 0;
}
/* 标题始终保留,放不下时单行省略(不作为第一个被牺牲的元素) */
.smart-table-toolbar-head .smart-table-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.smart-table-toolbar-cond {
  flex: 1 1 0;
  min-width: 0;
}
/* 中 / 窄档:两行 —— 行 1「标题 … 按钮 + 图标」,行 2 构造器(窄档的构造器自己画成「输入框 + 筛选」) */
.smart-table-toolbar--cond.smart-table-toolbar--mid,
.smart-table-toolbar--cond.smart-table-toolbar--narrow {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-areas:
    'head right'
    'cond cond';
  gap: 10px 12px;
}
.smart-table-toolbar--mid .smart-table-toolbar-main--cond,
.smart-table-toolbar--narrow .smart-table-toolbar-main--cond {
  display: contents;
}
.smart-table-toolbar--mid .smart-table-toolbar-head,
.smart-table-toolbar--narrow .smart-table-toolbar-head {
  grid-area: head;
}
.smart-table-toolbar--mid .smart-table-toolbar-cond,
.smart-table-toolbar--narrow .smart-table-toolbar-cond {
  grid-area: cond;
}
.smart-table-toolbar--mid .smart-table-toolbar-right,
.smart-table-toolbar--narrow .smart-table-toolbar-right {
  grid-area: right;
}
/* 批量栏(设计原型 .tb-batch):复选框 + 「已选 N 项」(34px 高)、宿主按钮组(间距 8)、取消选择,间距 12;内容贴第 1 行顶部(根元素 min-height 占位,
   两行高的中档工具栏勾选后内容不往中间飘);内置图标组仍在右侧,34px 高 */
.smart-table-toolbar--batch {
  align-items: flex-start;
}
.smart-table-batch {
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 12px;
}
.smart-table-batch-info {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  font-weight: 500;
  white-space: nowrap;
}
.smart-table-batch-acts {
  display: flex;
  align-items: center;
  gap: 8px;
}
.smart-table-toolbar--batch .smart-table-toolbar-icons {
  height: 34px;
}
/* 窄档批量栏(原型 .tb-batch @ < 600):第 1 行「已选 N 项 | 取消选择」,第 2 行宿主按钮整行等分;右侧内置图标收起。控件 40px(large) */
.smart-table-toolbar--batch-narrow {
  display: block;
}
.smart-table-toolbar--batch-narrow .smart-table-batch {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-areas:
    'info clear'
    'acts acts';
  gap: 10px 12px;
}
.smart-table-toolbar--batch-narrow .smart-table-batch-info {
  grid-area: info;
  min-width: 0;
  height: 40px;
}
.smart-table-toolbar--batch-narrow .smart-table-batch > .n-button {
  grid-area: clear;
}
.smart-table-toolbar--batch-narrow .smart-table-batch-acts {
  grid-area: acts;
}
.smart-table-toolbar--batch-narrow .smart-table-batch-acts > * {
  flex: 1 1 0;
  justify-content: center;
}
.smart-table-toolbar--batch-narrow .smart-table-toolbar-right {
  display: none;
}
/* 窄档折叠(cardOnNarrow,设计原型 @container < 600 的 .tb):行 1「标题 | 操作 ▾ | 图标」,展开后多一整行业务按钮(原位,不是浮层、不加动画),
   模式 2 的构造器(输入框 + 筛选)在最下面。列间距 12、行距 10(原型 .tb);默认态不声明 actions 行(空行也会产生 row-gap)。
   右半区 / 业务组 / 图标组用 display: contents 退场,让它们回到各自的网格区域。 */
.smart-table-toolbar--fold {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  grid-template-areas: 'head ops icons';
  align-items: center;
  gap: 10px 12px;
}
.smart-table-toolbar--fold.smart-table-toolbar--ops-open {
  grid-template-areas:
    'head ops icons'
    'actions actions actions';
}
.smart-table-toolbar--cond.smart-table-toolbar--narrow.smart-table-toolbar--fold {
  grid-template-columns: minmax(0, 1fr) auto auto;
  grid-template-areas:
    'head ops icons'
    'cond cond cond';
}
.smart-table-toolbar--cond.smart-table-toolbar--narrow.smart-table-toolbar--fold.smart-table-toolbar--ops-open {
  grid-template-areas:
    'head ops icons'
    'actions actions actions'
    'cond cond cond';
}
.smart-table-toolbar--fold > .smart-table-toolbar-main {
  grid-area: head;
}
.smart-table-toolbar--fold .smart-table-toolbar-head {
  grid-area: head;
}
.smart-table-toolbar--fold .smart-table-toolbar-ops {
  grid-area: ops;
}
.smart-table-toolbar--fold .smart-table-toolbar-right {
  display: contents;
}
.smart-table-toolbar--fold .smart-table-toolbar-actions {
  display: none;
  grid-area: actions;
}
.smart-table-toolbar--fold.smart-table-toolbar--ops-open .smart-table-toolbar-actions {
  display: flex;
}
/* 展开行里的按钮(「新增」等 + 「更多」)等分整行;padding 会计入 flex 基准,不清零就不等宽 */
.smart-table-toolbar--fold .smart-table-toolbar-actions > :deep(*) {
  flex: 1 1 0;
  min-width: 0;
}
.smart-table-toolbar--fold .smart-table-toolbar-actions > :deep(.n-button) {
  padding-right: 0;
  padding-left: 0;
}
.smart-table-toolbar--fold .smart-table-toolbar-icons {
  grid-area: icons;
  gap: 0;
}
/* 排序入口:另起一行占满整行(落在命名区域之后的隐式行里,没有它时不多出空行 / 行距) */
.smart-table-toolbar-entries {
  grid-column: 1 / -1;
}
.smart-table-toolbar-sort-wrap {
  position: relative;
  display: flex;
}
.smart-table-toolbar-sort-wrap > .n-button {
  flex: 1 1 auto;
}
/* 角标贴在按钮右上角内沿(不伸出卡片内容区,否则 390 宽下工具栏横向溢出) */
.smart-table-toolbar-sort-badge {
  position: absolute;
  top: -6px;
  right: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  font-size: 11px;
  border-radius: 8px;
  pointer-events: none;
}
</style>
