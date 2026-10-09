<script setup lang="ts">
// 面板里的一行条件:首列(第 1 行是「条件」引导标签,第 2 行起是且 / 或下拉)+ 操作符 + 值控件 + 删除。
// 受控(草稿由 ColumnFilter 持有),只发事件。排布是 4 列网格 56 / 112 / 1fr / 28(设计原型 .hp-row),删除列恒占位,所以 1 行与多行的值输入同宽。
// 值控件按操作符的值形状分发:无值(isNull 等)→ 禁用的占位框;数组(in / notIn)→ 多选;标量 → 按列类型选控件。
import { computed, onBeforeUnmount, reactive, watch, type PropType } from 'vue'
import { NButton, NDatePicker, NInput, NInputNumber, NSelect, useThemeVars } from 'naive-ui'
import type { SelectProps } from 'naive-ui'
import type {
  FilterAction,
  FilterCondition,
  FilterLogic,
  SmartTableLabels,
  SmartTableOption,
} from './types'
import type { FilterDef } from './useColumns'
import { actionValueKind } from './filter'
import { ACTION_LABEL_KEY } from './labels'
import { optionLabel } from './useOptions'
import { CloseIcon, SearchIcon } from './icons'
import { useControlFontSize } from './useControlFontSize'

/** NSelect 的选项类型:官方没有公开导出 SelectMixedOption,从公开的 SelectProps 推导。 */
type SelectOpt = NonNullable<SelectProps['options']>[number]

const props = defineProps({
  def: { type: Object as PropType<FilterDef>, required: true },
  condition: { type: Object as PropType<FilterCondition>, required: true },
  /** 这是第几行(0 起):第 0 行首列是「条件」引导标签,其余行是且 / 或下拉。 */
  index: { type: Number, default: 0 },
  /** 整组条件的连接方式(第 2 行起的首列下拉显示它;改它就是改整组)。 */
  logic: { type: String as PropType<FilterLogic>, default: 'and' },
  labels: { type: Object as PropType<Required<SmartTableLabels>>, required: true },
  getOptions: { type: Function as PropType<(key: string) => SmartTableOption[]>, required: true },
  isLoadingOptions: { type: Function as PropType<(key: string) => boolean>, required: true },
  dateValueFormat: { type: String, default: 'yyyy-MM-dd' },
  /** 至少留一行:只有一行时不给删除按钮。 */
  removable: { type: Boolean, default: false },
  /** 控件尺寸:列头面板 small(默认);模式 2 的工具栏行与展开面板 medium、窄档 large。 */
  size: { type: String as PropType<'small' | 'medium' | 'large'>, default: 'small' },
  /** 只画值控件(不画引导列 / 比较符 / 删除):模式 2 窄档的「输入框 + 筛选」。 */
  valueOnly: { type: Boolean, default: false },
  /** 覆盖值控件的占位(缺省取 def.props.placeholder)。 */
  placeholder: { type: String, default: undefined },
  /** 引导列:undefined = 按行号(第 0 行「条件」、之后是且 / 或下拉,列头面板的行为);字符串 = 固定文字(模式 2 跨字段的后续行是「且」);null = 不画(模式 2 的主行 / 抽屉)。 */
  lead: { type: String as PropType<string | null>, default: undefined },
  /** 文本输入框右侧画放大镜(模式 2 的构造器)。 */
  searchIcon: { type: Boolean, default: false },
})

const emit = defineEmits<{
  'update:action': [a: FilterAction]
  'update:logic': [l: FilterLogic]
  'update:value': [v: unknown]
  remove: []
  enter: []
  /** 这一行里有 NSelect / NDatePicker 的下拉浮层展开(true)/ 全部收起(false)。 */
  dropdown: [open: boolean]
}>()

const themeVars = useThemeVars()
// 引导标签与本行控件同档(随 size 取主题 fontSize{Size}),字色 textColor2 —— 与同列的「且」下拉文字、窄档块头「条件 N」一致
const leadFontSize = useControlFontSize(() => props.size)
const leadStyle = computed(() => ({
  color: themeVars.value.textColor2,
  fontSize: leadFontSize.value,
}))
const kind = computed(() => actionValueKind(props.condition.action))
// 值控件的透传 props:def.props 在前;给了 placeholder 才覆盖(直接写 :placeholder 会在 undefined 时把 def.props 里的占位也顶掉)
const controlProps = computed(() =>
  props.placeholder ? { ...props.def.props, placeholder: props.placeholder } : props.def.props,
)

// 下拉展开状态:操作符下拉与值控件各记一份,任意一个展开就算「这一行有下拉展开」。
// 面板要靠它区分 Esc 是「收起下拉」还是「关闭面板」(NSelect / NDatePicker 收起自己时不 stopPropagation)。
const open = reactive({ logic: false, action: false, value: false })
watch(
  () => open.logic || open.action || open.value,
  (v) => emit('dropdown', v),
)
onBeforeUnmount(() => {
  if (open.logic || open.action || open.value) emit('dropdown', false)
})

// 且 / 或:文案走 labels(渲染期求值)
const logicOptions = computed<SelectOpt[]>(() => [
  { label: props.labels.filterLogicAnd, value: 'and' },
  { label: props.labels.filterLogicOr, value: 'or' },
])

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

const arrayValue = computed(() =>
  Array.isArray(props.condition.value) ? (props.condition.value as Array<string | number>) : [],
)

function onKeyup(e: KeyboardEvent) {
  if (e.key === 'Enter') emit('enter')
}
</script>

<template>
  <div class="smart-table-filter-row" :class="{ 'smart-table-filter-row--value-only': valueOnly }">
    <!-- 首列:第 1 行「条件」引导标签(字号随 size、textColor2);第 2 行起是且 / 或下拉,选哪个都是改整组的连接方式。
         lead 给了字符串 = 固定文字,给了 null = 不画(模式 2);valueOnly 时整个前半段都不画 -->
    <span
      v-if="!valueOnly && (typeof lead === 'string' || (lead === undefined && index === 0))"
      class="smart-table-filter-lead"
      :style="leadStyle"
      >{{ lead ?? labels.filterConditionLead }}</span
    >
    <n-select
      v-else-if="!valueOnly && lead === undefined"
      class="smart-table-filter-logic"
      :size="size"
      :value="logic"
      :options="logicOptions"
      @update:value="(l: FilterLogic) => emit('update:logic', l)"
      @update:show="(v: boolean) => (open.logic = v)"
    />
    <!-- 模式 2 的字段下拉:放在引导列与比较符之间 -->
    <slot v-if="!valueOnly" name="field" />
    <n-select
      v-if="!valueOnly"
      class="smart-table-filter-action"
      :size="size"
      :value="condition.action"
      :options="actionOptions"
      :consistent-menu-width="false"
      @update:value="(a: FilterAction) => emit('update:action', a)"
      @update:show="(v: boolean) => (open.action = v)"
    />
    <!-- 值控件写成真实元素(不走 <component :is>):重渲染时被 patch 而不是重挂,输入过程中不会掉焦点。
         def.props 放最前面,可透传但盖不掉值绑定与回调。 -->
    <div class="smart-table-filter-value">
      <n-input v-if="kind === 'none'" :size="size" disabled :placeholder="labels.filterNoValue" />
      <n-select
        v-else-if="kind === 'array'"
        v-bind="controlProps"
        :size="size"
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
        v-bind="controlProps"
        :size="size"
        clearable
        style="width: 100%"
        :value="(condition.value ?? null) as number | null"
        @update:value="(v: unknown) => emit('update:value', v)"
      />
      <n-date-picker
        v-else-if="def.type === 'date'"
        v-bind="controlProps"
        type="date"
        :size="size"
        clearable
        style="width: 100%"
        :value-format="dateValueFormat"
        :formatted-value="(condition.value ?? null) as string | null"
        @update:formatted-value="(v: unknown) => emit('update:value', v)"
        @update:show="(v: boolean) => (open.value = v)"
      />
      <n-select
        v-else-if="def.type === 'select'"
        v-bind="controlProps"
        :size="size"
        clearable
        :value="(condition.value ?? null) as string | number | null"
        :options="selectOptions"
        :loading="isLoadingOptions(def.optionsKey)"
        @update:value="(v: unknown) => emit('update:value', v)"
        @update:show="(v: boolean) => (open.value = v)"
      />
      <n-input
        v-else
        v-bind="controlProps"
        :size="size"
        clearable
        :value="(condition.value ?? null) as string | null"
        @update:value="(v: unknown) => emit('update:value', v)"
        @keyup="onKeyup"
      >
        <template v-if="searchIcon" #suffix>
          <span class="smart-table-filter-search-icon" :style="{ color: themeVars.textColor3 }"
            ><SearchIcon
          /></span>
        </template>
      </n-input>
    </div>
    <n-button
      v-if="removable && !valueOnly"
      class="smart-table-filter-remove"
      quaternary
      circle
      size="small"
      :theme-overrides="{ iconSizeSmall: '12px' }"
      :aria-label="labels.filterRemoveCondition"
      @click="emit('remove')"
    >
      <template #icon><CloseIcon /></template>
    </n-button>
  </div>
</template>

<style scoped>
/* 4 列网格(设计原型 .hp-row):首列 56(「条件」/ 且或)、比较符 112、值 1fr、删除 28(恒占位)、间距 8。
   NSelect / NInput 的根节点都是 width:100%,放进网格单元即可,不需要 flex-basis 的技巧。 */
.smart-table-filter-row {
  display: grid;
  grid-template-columns: 56px 112px minmax(0, 1fr) 28px;
  align-items: center;
  gap: 8px;
}
.smart-table-filter-lead {
  min-width: 0;
  text-align: center;
}
.smart-table-filter-logic,
.smart-table-filter-action {
  min-width: 0;
}
/* flex 而不是块级:里面的 .n-input 是 inline-flex、vertical-align: baseline,块级容器会按基线对齐,
   控件高度和行高凑巧相等时(紧凑主题的 24px 档)在控件下面多出 1px,整行被撑高、值框比同行下拉低半像素 */
.smart-table-filter-value {
  display: flex;
  min-width: 0;
}
/* 只画值控件(模式 2 窄档的输入框):单列,不要被 4 列网格(56 / 112 / 1fr / 28)压进第一格 */
.smart-table-filter-row--value-only {
  grid-template-columns: minmax(0, 1fr);
}
.smart-table-filter-search-icon {
  display: inline-flex;
}
</style>
