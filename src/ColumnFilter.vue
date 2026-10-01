<script setup lang="ts">
// 表头过滤面板:漏斗触发 + 弹层。两种形态共用同一份过滤值模型(FilterValue):
//   options   —— Arco 风格,勾选候选项(等价于若干 equal 条件取「或」)
//   condition —— Bootstrap Blazor 风格,一行 [动作 + 值]
// 面板内改的是草稿,点「确定」才提交,避免每敲一个字就打一次远程请求。
import { computed, ref, watch, type PropType } from 'vue'
import {
  NButton,
  NCheckbox,
  NDatePicker,
  NInput,
  NInputNumber,
  NPopover,
  NSelect,
  NSpace,
  NTooltip,
  useThemeVars,
} from 'naive-ui'
import type { SelectMixedOption } from 'naive-ui/es/select/src/interface'
import type { FilterAction, FilterCondition, FilterValue, SmartTableLabels, SmartTableOption } from './types'
import type { FilterDef } from './useColumns'
import { filterValueToOptions, isFilterActive, optionsToFilterValue } from './filter'
import { ACTION_LABEL_KEY } from './labels'
import { optionLabel } from './useOptions'
import { FilterIcon } from './icons'

const props = defineProps({
  def: { type: Object as PropType<FilterDef>, required: true },
  value: { type: Object as PropType<FilterValue | null>, default: null },
  labels: { type: Object as PropType<Required<SmartTableLabels>>, required: true },
  getOptions: { type: Function as PropType<(key: string) => SmartTableOption[]>, required: true },
  isLoadingOptions: { type: Function as PropType<(key: string) => boolean>, required: true },
  dateValueFormat: { type: String, default: 'yyyy-MM-dd' },
})

const emit = defineEmits<{
  'update:value': [v: FilterValue | null]
}>()

const themeVars = useThemeVars()
const show = ref(false)
const active = computed(() => isFilterActive(props.value))

/* ---- 草稿:打开弹层时从当前生效值回填 ---- */

// condition 模式固定一条条件(面板不提供加/减行);多条只来自编程式赋值。
const condition = ref<FilterCondition>({ action: 'equal', value: null })
const checked = ref<unknown[]>([])

function blankCondition(): FilterCondition {
  return { action: props.def.actions[0] ?? 'equal', value: null }
}

function loadDraft(from: FilterValue | null) {
  if (props.def.mode === 'options') {
    checked.value = filterValueToOptions(from)
    return
  }
  const first = from?.conditions?.find((c) => c)
  condition.value = first ? { ...first } : blankCondition()
}

watch(show, (open) => {
  if (open) loadDraft(props.value)
})
// 外部(编程式 setFilter / clearFilters)改了值,弹层开着也要跟上
watch(
  () => props.value,
  (v) => {
    if (show.value) loadDraft(v)
  },
)

/* ---- 选项(options 模式) ---- */

/** 过滤勾选列表按扁平处理:分组选项的父节点本身不是可选值。 */
function flatten(opts: SmartTableOption[]): SmartTableOption[] {
  return opts.flatMap((o) => (o.children?.length ? flatten(o.children) : [o]))
}
const flatOptions = computed(() => flatten(props.getOptions(props.def.optionsKey)))
// disabled 选项的勾选框用户碰不到(界面上就是禁用的),「全选/全不选」不该替它们做主 ——
// 只对用户实际能操作的选项生效,disabled 选项当前是勾是不勾,toggleAll 前后保持不变。
const selectableOptions = computed(() => flatOptions.value.filter((o) => !o.disabled))
const allChecked = computed(
  () => selectableOptions.value.length > 0 && selectableOptions.value.every((o) => checked.value.includes(o.value)),
)
const someChecked = computed(
  () => selectableOptions.value.some((o) => checked.value.includes(o.value)) && !allChecked.value,
)

function toggleOption(value: unknown, on: boolean) {
  if (!props.def.multiple) {
    checked.value = on ? [value] : []
    return
  }
  checked.value = on ? [...checked.value, value] : checked.value.filter((v) => v !== value)
}

function toggleAll(on: boolean) {
  const disabledChecked = checked.value.filter((v) => flatOptions.value.find((o) => o.value === v)?.disabled)
  checked.value = on ? [...disabledChecked, ...selectableOptions.value.map((o) => o.value)] : disabledChecked
}

/* ---- 条件行(condition 模式) ---- */

const actionOptions = computed<SelectMixedOption[]>(() =>
  props.def.actions.map((a) => ({ label: actionLabel(a), value: a })),
)

function actionLabel(a: FilterAction): string {
  return props.labels[ACTION_LABEL_KEY[a]]
}

const selectOptions = computed<SelectMixedOption[]>(() =>
  flatOptions.value.map((o) => ({
    label: optionLabel(o),
    value: o.value as string | number,
    disabled: o.disabled,
  })),
)

function setAction(action: FilterAction) {
  condition.value = { ...condition.value, action }
}

function setValue(value: unknown) {
  condition.value = { ...condition.value, value }
}

function onValueKeyup(e: KeyboardEvent) {
  if (e.key === 'Enter') confirm()
}

/* ---- 提交 / 重置 ---- */

function draftValue(): FilterValue | null {
  if (props.def.mode === 'options') return optionsToFilterValue(checked.value)
  return { logic: 'and', conditions: [{ ...condition.value }] }
}

function confirm() {
  const v = draftValue()
  emit('update:value', v && isFilterActive(v) ? v : null)
  show.value = false
}

function reset() {
  const fallback = props.def.defaultValue ?? null
  loadDraft(fallback)
  emit('update:value', fallback && isFilterActive(fallback) ? fallback : null)
  show.value = false
}
</script>

<template>
  <n-popover v-model:show="show" trigger="click" placement="bottom" :show-arrow="false" raw>
    <template #trigger>
      <!-- stop:sorter 列的表头点击会触发排序,点漏斗不该顺带把表排一遍 -->
      <span class="smart-table-filter-trigger" @click.stop>
        <n-tooltip trigger="hover" :disabled="show">
          <template #trigger>
            <n-button
              quaternary
              size="tiny"
              :type="active ? 'primary' : 'default'"
              :aria-label="labels.filter"
              :focusable="false"
            >
              <template #icon><FilterIcon /></template>
            </n-button>
          </template>
          {{ labels.filter }}
        </n-tooltip>
      </span>
    </template>

    <div
      class="smart-table-filter"
      :class="{ 'smart-table-filter--condition': !def.render && def.mode === 'condition' }"
      :style="{
        background: themeVars.popoverColor,
        borderRadius: themeVars.borderRadius,
        boxShadow: themeVars.boxShadow2,
        color: themeVars.textColor2,
      }"
      @click.stop
    >
      <!-- 自定义面板:完全接管内容,只复用弹层与提交通道 -->
      <component
        v-if="def.render"
        :is="() => def.render!({ value, setValue: (v) => emit('update:value', v), close: () => (show = false) })"
      />

      <template v-else>
        <!-- options:勾选候选项 -->
        <div v-if="def.mode === 'options'" class="smart-table-filter-options">
          <n-checkbox
            v-if="def.multiple && flatOptions.length > 1"
            class="smart-table-filter-all"
            :checked="allChecked"
            :indeterminate="someChecked"
            @update:checked="toggleAll"
          >
            {{ labels.filterSelectAll }}
          </n-checkbox>
          <n-checkbox
            v-for="opt in flatOptions"
            :key="String(opt.value)"
            :checked="checked.includes(opt.value)"
            :disabled="opt.disabled"
            @update:checked="(v: boolean) => toggleOption(opt.value, v)"
          >
            {{ optionLabel(opt) }}
          </n-checkbox>
          <span v-if="!flatOptions.length" :style="{ color: themeVars.textColor3 }">
            {{ isLoadingOptions(def.optionsKey) ? '...' : '—' }}
          </span>
        </div>

        <!-- condition:一行「动作 + 值」 -->
        <div v-else class="smart-table-filter-conditions">
          <div class="smart-table-filter-row">
            <n-select
              class="smart-table-filter-action"
              size="small"
              :value="condition.action"
              :options="actionOptions"
              :consistent-menu-width="false"
              @update:value="setAction"
            />
            <!-- 值控件写成真实元素(不走 <component :is>):重渲染时被 patch 而不是重挂,
                 输入过程中不会掉焦点。def.props 放最前面,可透传但盖不掉值绑定与回调。 -->
            <div class="smart-table-filter-value">
              <n-input-number
                v-if="def.type === 'number'"
                v-bind="def.props"
                size="small"
                clearable
                style="width: 100%"
                :value="(condition.value ?? null) as number | null"
                @update:value="setValue"
              />
              <n-date-picker
                v-else-if="def.type === 'date'"
                v-bind="def.props"
                type="date"
                size="small"
                clearable
                style="width: 100%"
                :value-format="dateValueFormat"
                :formatted-value="(condition.value ?? null) as string | null"
                @update:formatted-value="setValue"
              />
              <n-select
                v-else-if="def.type === 'select'"
                v-bind="def.props"
                size="small"
                clearable
                :value="(condition.value ?? null) as string | number | null"
                :options="selectOptions"
                :loading="isLoadingOptions(def.optionsKey)"
                @update:value="setValue"
              />
              <n-input
                v-else
                v-bind="def.props"
                size="small"
                clearable
                :value="(condition.value ?? null) as string | null"
                @update:value="setValue"
                @keyup="onValueKeyup"
              />
            </div>
          </div>
        </div>
      </template>

      <div
        v-if="!def.render"
        class="smart-table-filter-footer"
        :style="{ borderTop: `1px solid ${themeVars.dividerColor}` }"
      >
        <n-space :size="8">
          <n-button size="tiny" @click="reset">{{ labels.filterReset }}</n-button>
          <n-button size="tiny" type="primary" @click="confirm">{{ labels.filterConfirm }}</n-button>
        </n-space>
      </div>
    </div>
  </n-popover>
</template>

<style scoped>
.smart-table-filter-trigger {
  display: inline-flex;
  align-items: center;
  margin-left: 4px;
  /* 表头默认 center 对齐时,漏斗不该把标题挤偏 */
  vertical-align: middle;
}
.smart-table-filter {
  min-width: 200px;
  padding: 8px;
  /* 表头文字常是 center,弹层内容一律左对齐 */
  text-align: left;
  font-weight: normal;
}
/* 条件面板给定宽:两个控件并排,靠内层 min-width 撑不出稳定布局 */
.smart-table-filter--condition {
  width: 340px;
}
.smart-table-filter-options {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 260px;
  overflow: auto;
}
.smart-table-filter-conditions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.smart-table-filter-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
/* 定宽 basis:NSelect 根节点是 width:100%,用 flex-basis:auto 会把整行吃掉,
   值控件被挤成 0 宽(看起来就像只剩一个下拉框)。 */
.smart-table-filter-action {
  flex: 0 0 108px;
}
.smart-table-filter-value {
  flex: 1 1 auto;
  min-width: 0;
}
.smart-table-filter-logic {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.smart-table-filter-footer {
  margin-top: 8px;
  padding-top: 8px;
  display: flex;
  justify-content: flex-end;
}
</style>
