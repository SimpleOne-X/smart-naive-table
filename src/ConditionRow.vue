<script setup lang="ts">
// 面板里的一行条件:操作符 + 值控件 + 删除。受控(草稿由 ColumnFilter 持有),只发事件。
// 值控件按操作符的值形状分发:无值(isNull 等)→ 禁用的占位框;数组(in / notIn)→ 多选;标量 → 按列类型选控件。
import { computed, onBeforeUnmount, reactive, watch, type PropType } from 'vue'
import { NButton, NDatePicker, NInput, NInputNumber, NSelect } from 'naive-ui'
import type { SelectProps } from 'naive-ui'
import type { FilterAction, FilterCondition, SmartTableLabels, SmartTableOption } from './types'
import type { FilterDef } from './useColumns'
import { actionValueKind } from './filter'
import { ACTION_LABEL_KEY } from './labels'
import { optionLabel } from './useOptions'
import { CloseIcon } from './icons'

/** NSelect 的选项类型:官方没有公开导出 SelectMixedOption,从公开的 SelectProps 推导。 */
type SelectOpt = NonNullable<SelectProps['options']>[number]

const props = defineProps({
  def: { type: Object as PropType<FilterDef>, required: true },
  condition: { type: Object as PropType<FilterCondition>, required: true },
  labels: { type: Object as PropType<Required<SmartTableLabels>>, required: true },
  getOptions: { type: Function as PropType<(key: string) => SmartTableOption[]>, required: true },
  isLoadingOptions: { type: Function as PropType<(key: string) => boolean>, required: true },
  dateValueFormat: { type: String, default: 'yyyy-MM-dd' },
  /** 至少留一行:只有一行时不给删除按钮。 */
  removable: { type: Boolean, default: false },
})

const emit = defineEmits<{
  'update:action': [a: FilterAction]
  'update:value': [v: unknown]
  remove: []
  enter: []
  /** 这一行里有 NSelect / NDatePicker 的下拉浮层展开(true)/ 全部收起(false)。 */
  dropdown: [open: boolean]
}>()

const kind = computed(() => actionValueKind(props.condition.action))

// 下拉展开状态:操作符下拉与值控件各记一份,任意一个展开就算「这一行有下拉展开」。
// 面板要靠它区分 Esc 是「收起下拉」还是「关闭面板」(NSelect / NDatePicker 收起自己时不 stopPropagation)。
const open = reactive({ action: false, value: false })
watch(
  () => open.action || open.value,
  (v) => emit('dropdown', v),
)
onBeforeUnmount(() => {
  if (open.action || open.value) emit('dropdown', false)
})

// 当前操作符不在 def.actions 里时(编程式给了列声明之外的操作符),也要能在下拉里显示出来,不能变成空白
const actionOptions = computed<SelectOpt[]>(() => {
  const cur = props.condition.action
  const list = props.def.actions.includes(cur) ? props.def.actions : [cur, ...props.def.actions]
  return list.map((a) => ({ label: props.labels[ACTION_LABEL_KEY[a]], value: a }))
})

/** 过滤勾选 / 下拉按扁平处理:分组选项的父节点本身不是可选值。 */
function flatten(opts: SmartTableOption[]): SmartTableOption[] {
  return opts.flatMap((o) => (o.children?.length ? flatten(o.children) : [o]))
}
const selectOptions = computed<SelectOpt[]>(() =>
  flatten(props.getOptions(props.def.optionsKey)).map((o) => ({
    label: optionLabel(o),
    value: o.value as string | number,
    disabled: o.disabled,
  })),
)

const arrayValue = computed(() => (Array.isArray(props.condition.value) ? (props.condition.value as Array<string | number>) : []))

function onKeyup(e: KeyboardEvent) {
  if (e.key === 'Enter') emit('enter')
}
</script>

<template>
  <div class="smart-table-filter-row">
    <n-select
      class="smart-table-filter-action"
      size="small"
      :value="condition.action"
      :options="actionOptions"
      :consistent-menu-width="false"
      @update:value="(a: FilterAction) => emit('update:action', a)"
      @update:show="(v: boolean) => (open.action = v)"
    />
    <!-- 值控件写成真实元素(不走 <component :is>):重渲染时被 patch 而不是重挂,输入过程中不会掉焦点。
         def.props 放最前面,可透传但盖不掉值绑定与回调。 -->
    <div class="smart-table-filter-value">
      <n-input v-if="kind === 'none'" size="small" disabled :placeholder="labels.filterNoValue" />
      <n-select
        v-else-if="kind === 'array'"
        v-bind="def.props"
        size="small"
        multiple
        filterable
        :tag="def.type !== 'select'"
        :show-arrow="def.type === 'select'"
        :value="arrayValue"
        :options="def.type === 'select' ? selectOptions : []"
        @update:value="(v: unknown) => emit('update:value', v)"
        @update:show="(v: boolean) => (open.value = v)"
      />
      <n-input-number
        v-else-if="def.type === 'number'"
        v-bind="def.props"
        size="small"
        clearable
        style="width: 100%"
        :value="(condition.value ?? null) as number | null"
        @update:value="(v: unknown) => emit('update:value', v)"
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
        @update:formatted-value="(v: unknown) => emit('update:value', v)"
        @update:show="(v: boolean) => (open.value = v)"
      />
      <n-select
        v-else-if="def.type === 'select'"
        v-bind="def.props"
        size="small"
        clearable
        :value="(condition.value ?? null) as string | number | null"
        :options="selectOptions"
        :loading="isLoadingOptions(def.optionsKey)"
        @update:value="(v: unknown) => emit('update:value', v)"
        @update:show="(v: boolean) => (open.value = v)"
      />
      <n-input
        v-else
        v-bind="def.props"
        size="small"
        clearable
        :value="(condition.value ?? null) as string | null"
        @update:value="(v: unknown) => emit('update:value', v)"
        @keyup="onKeyup"
      />
    </div>
    <n-button
      v-if="removable"
      class="smart-table-filter-remove"
      quaternary
      circle
      size="tiny"
      :aria-label="labels.filterRemoveCondition"
      @click="emit('remove')"
    >
      <template #icon><CloseIcon /></template>
    </n-button>
  </div>
</template>

<style scoped>
.smart-table-filter-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
/* 定宽 basis:NSelect 根节点是 width:100%,用 flex-basis:auto 会把整行吃掉,值控件被挤成 0 宽。 */
.smart-table-filter-action {
  flex: 0 0 108px;
}
.smart-table-filter-value {
  flex: 1 1 auto;
  min-width: 0;
}
</style>
