<script setup lang="ts">
// 表头过滤面板:漏斗触发 + 弹层。两种形态共用同一份过滤值模型(FilterValue):
//   options   —— Arco 风格,勾选候选项(等价于若干 equal 条件取「或」);底部「高级条件」展开同一份多条件编辑
//   condition —— Bootstrap Blazor 风格,多行 [操作符 + 值](最多 5 条,≥ 2 条出现且/或)
// 面板内改的是草稿,点「确定」才提交,避免每敲一个字就打一次远程请求;Esc / 点外部丢弃草稿。
// 键盘 / 焦点 / ARIA:公开的 NPopover 不管(焦点不进面板、Esc 不关闭,见设计文档 9.1),这里自己做(D6)。
import { computed, nextTick, reactive, ref, watch, type PropType } from 'vue'
import { NButton, NCheckbox, NPopover, NRadioButton, NRadioGroup, NSpace, NTooltip, useThemeVars } from 'naive-ui'
import type { FilterAction, FilterLogic, FilterValue, SmartTableLabels, SmartTableOption } from './types'
import { filterDefTitle, type FilterDef } from './useColumns'
import {
  activeConditions,
  filterValueToOptions,
  isFilterActive,
  isOptionsRepresentable,
  optionsToFilterValue,
} from './filter'
import { fmt } from './labels'
import { optionLabel } from './useOptions'
import { FilterIcon } from './icons'
import ConditionRow from './ConditionRow.vue'
import {
  MAX_CONDITIONS,
  addCondition,
  blankDraft,
  draftFromValue,
  draftToValue,
  removeCondition,
  setConditionAction,
  setConditionValue,
  setLogic,
  type FilterDraft,
} from './filterDraft'

const props = defineProps({
  def: { type: Object as PropType<FilterDef>, required: true },
  value: { type: Object as PropType<FilterValue | null>, default: null },
  labels: { type: Object as PropType<Required<SmartTableLabels>>, required: true },
  getOptions: { type: Function as PropType<(key: string) => SmartTableOption[]>, required: true },
  isLoadingOptions: { type: Function as PropType<(key: string) => boolean>, required: true },
  dateValueFormat: { type: String, default: 'yyyy-MM-dd' },
  /** 每次变大 = 请求打开面板(已生效条件 chips 点击时用)。 */
  openRequest: { type: Number, default: 0 },
})

const emit = defineEmits<{
  'update:value': [v: FilterValue | null]
}>()

const themeVars = useThemeVars()
const show = ref(false)
const active = computed(() => isFilterActive(props.value))
const activeCount = computed(() => activeConditions(props.value).length)
// 漏斗的无障碍名:多于 1 条时带条数(走 labels,渲染期求值)
const ariaLabel = computed(() =>
  activeCount.value > 1 ? `${props.labels.filter}(${fmt(props.labels.filterActiveCount, { n: activeCount.value })})` : props.labels.filter,
)
// 面板的无障碍名:「列标题 + 过滤」(渲染期求值,切语言即时生效)
const panelLabel = computed(() => `${filterDefTitle(props.def)} ${props.labels.filter}`)

const panelRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLElement | null>(null)
/** 关闭后是否把焦点还给漏斗:Esc / 确定 / 重置 → 是;点外部关闭 → 否(别抢走用户刚点的控件的焦点)。 */
let returnFocus = false

/* ---- 草稿:打开弹层时从当前生效值回填 ---- */

const firstAction = (): FilterAction => props.def.actions[0] ?? 'equal'
const draft = ref<FilterDraft>(blankDraft(firstAction()))
const checked = ref<unknown[]>([])
/** options 列:是否展开「高级条件」(多条件编辑)。 */
const advanced = ref(false)

function loadDraft(from: FilterValue | null) {
  draft.value = draftFromValue(from, firstAction())
  if (props.def.mode === 'options') {
    // 勾选表达不了当前值(notEqual / isNull / 且 的多条 equal …)→ 自动展开高级条件原样显示,不静默丢条件(C3)
    const representable = isOptionsRepresentable(from)
    advanced.value = !representable
    checked.value = representable ? filterValueToOptions(from) : []
  }
}

/* ---- 键盘 / 焦点(D6) ---- */

/** 面板里可 Tab 到的控件(tabindex=-1 的面板容器自己不算)。 */
const FOCUSABLE = 'input:not([disabled]), button:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function focusFirst() {
  panelRef.value?.querySelector<HTMLElement>(FOCUSABLE)?.focus()
}

/** 第 j 行条件的第一个可聚焦控件(操作符下拉)。 */
function rowControl(panel: HTMLElement, j: number): HTMLElement | null | undefined {
  return panel.querySelectorAll('.smart-table-filter-row')[j]?.querySelector<HTMLElement>(FOCUSABLE)
}

/**
 * 被点的控件随这次更新被卸载(删除行的 ×、「高级条件 / 返回列表」切换)或被禁用(加到上限的「添加」)时,
 * 浏览器把焦点丢到 body —— 面板 teleport 在 body 末尾,焦点落到 body 之后 Esc / Tab 都到不了面板上的监听
 * (Step 13 真实浏览器实测:Esc 关不掉面板)。只在焦点原本就在面板里时介入:更新后焦点不在面板里的可用控件上,
 * 就移到 pick 给的控件(找不到则面板容器)。
 */
function keepFocusInPanel(pick: (panel: HTMLElement) => HTMLElement | null | undefined) {
  if (!panelRef.value?.contains(document.activeElement)) return
  void nextTick(() => {
    const panel = panelRef.value
    if (!panel || !show.value) return
    const cur = document.activeElement as (HTMLElement & { disabled?: boolean }) | null
    if (cur && panel.contains(cur) && !cur.disabled) return
    ;(pick(panel) ?? panel).focus()
  })
}

/** 有 NSelect / NDatePicker 下拉展开的条件行下标。展开期间 Esc 只该收起那个下拉,不能连面板一起关掉(草稿会丢)。 */
const dropdownRows = reactive(new Set<number>())
const dropdownOpen = computed(() => dropdownRows.size > 0)
function onDropdown(i: number, open: boolean) {
  if (open) dropdownRows.add(i)
  else dropdownRows.delete(i)
}

watch(show, (open) => {
  dropdownRows.clear()
  if (open) {
    loadDraft(props.value)
    return
  }
  if (returnFocus) {
    returnFocus = false
    triggerRef.value?.querySelector<HTMLElement>('button')?.focus()
  }
})
// 弹层内容挂载(每次打开都会重新挂载)后再聚焦第一个可编辑控件:内容是 teleport 出去的,show 变 true 时还不在 DOM 里。
// 宿主自定义面板(def.render)不自动聚焦:里面是什么控件库不知道,抢焦点可能打断宿主自己的逻辑。
watch(panelRef, (el) => {
  if (el && show.value && !props.def.render) void nextTick(focusFirst)
})
// 外部(编程式 setFilter / clearFilters)改了值,弹层开着也要跟上
watch(
  () => props.value,
  (v) => {
    if (show.value) loadDraft(v)
  },
)
watch(
  () => props.openRequest,
  (n, o) => {
    if (n > 0 && n !== o) show.value = true
  },
)

function close(focusBack: boolean) {
  returnFocus = focusBack
  show.value = false
}

/** Tab 在面板内循环(role=dialog 的常规做法;草稿不丢):最后一个控件 Tab → 第一个,第一个 Shift+Tab → 最后一个。 */
function trapTab(e: KeyboardEvent) {
  const panel = panelRef.value
  if (!panel) return
  const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
  if (!items.length) return
  const first = items[0]
  const last = items[items.length - 1]
  const cur = document.activeElement
  if (e.shiftKey && (cur === first || cur === panel)) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && cur === last) {
    e.preventDefault()
    first.focus()
  }
}

/**
 * 面板键盘处理(捕获阶段挂在面板容器上)。
 * Esc:有下拉展开 → 放行,让 NSelect / NDatePicker 自己收起它(它们只 markEventEffectPerformed,不 stopPropagation,
 * 所以必须在捕获阶段、它们动手之前判断,不然它们收起后我们这边读到的「是否有下拉」已经变了);
 * 没有下拉 → 关闭面板、丢弃草稿、焦点还给漏斗。自定义面板(def.render)同样适用 Esc。
 */
function onPanelKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (dropdownOpen.value) return
    e.stopPropagation()
    close(true) // 丢弃草稿:不 emit
    return
  }
  if (e.key === 'Tab' && !props.def.render) trapTab(e)
}

/**
 * 漏斗触发器上的 Esc(F3):面板打开期间,焦点还停在漏斗按钮上时(自定义面板 def.render 不自动聚焦,焦点就留在这里;
 * 这时 keydown 到不了面板容器上的捕获监听)也要能关:关闭、丢弃草稿、焦点留在漏斗。面板没开时什么也不做,不拦别人的 Esc。
 */
function onTriggerKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape' || !show.value || dropdownOpen.value) return
  e.stopPropagation()
  close(true)
}

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

/* ---- 勾选 ↔ 高级条件 ---- */

/** 勾选 → 条件:0 个 = 空白行,1 个 = equal,≥ 2 个 = 一条 in(不丢选择)。 */
function checkedToDraft(): FilterDraft {
  const n = checked.value.length
  if (n === 0) return blankDraft(firstAction())
  if (n === 1) return { logic: 'and', conditions: [{ action: 'equal', value: checked.value[0] }] }
  return { logic: 'and', conditions: [{ action: 'in', value: [...checked.value] }] }
}
function openAdvanced() {
  draft.value = checkedToDraft()
  advanced.value = true
  keepFocusInPanel((p) => p.querySelector<HTMLElement>(FOCUSABLE)) // 被点的「高级条件」按钮已被替换
}
/** 高级 → 勾选:仅当草稿能被勾选无损表达时允许。 */
const canCollapse = computed(() => isOptionsRepresentable(draftToValue(draft.value)))
function closeAdvanced() {
  if (!canCollapse.value) return
  checked.value = filterValueToOptions(draftToValue(draft.value))
  advanced.value = false
  keepFocusInPanel((p) => p.querySelector<HTMLElement>(FOCUSABLE)) // 被点的「返回列表」按钮已被替换
}

/* ---- 条件行编辑 ---- */

const showEditor = computed(() => props.def.mode === 'condition' || advanced.value)
const onAction = (i: number, a: FilterAction) => (draft.value = setConditionAction(draft.value, i, a))
const onValue = (i: number, v: unknown) => (draft.value = setConditionValue(draft.value, i, v))
const onRemove = (i: number) => {
  dropdownRows.clear() // 行号会整体前移,旧的展开记录作废;该行上的下拉随行一起卸载
  draft.value = removeCondition(draft.value, i, firstAction())
  // 被点的 × 随行卸载:焦点给顶替它的那一行(删的是最后一行则给前一行)
  const j = Math.min(i, draft.value.conditions.length - 1)
  keepFocusInPanel((p) => rowControl(p, j))
}
const onAdd = () => {
  draft.value = addCondition(draft.value, firstAction())
  // 加到上限时「添加」随之禁用、焦点会丢:给新加的那一行。没到上限时焦点仍在「添加」上,keepFocusInPanel 不动它
  const last = draft.value.conditions.length - 1
  keepFocusInPanel((p) => rowControl(p, last))
}
const onLogic = (l: FilterLogic) => (draft.value = setLogic(draft.value, l))

/* ---- 提交 / 重置 ---- */

function draftValue(): FilterValue | null {
  if (props.def.mode === 'options' && !advanced.value) return optionsToFilterValue(checked.value)
  return draftToValue(draft.value)
}

function confirm() {
  const v = draftValue()
  emit('update:value', v && isFilterActive(v) ? v : null)
  close(true)
}

function reset() {
  const fallback = props.def.defaultValue ?? null
  loadDraft(fallback)
  emit('update:value', fallback && isFilterActive(fallback) ? fallback : null)
  close(true)
}
</script>

<template>
  <n-popover v-model:show="show" trigger="click" placement="bottom" :show-arrow="false" raw>
    <template #trigger>
      <!-- data-data-table-filter:官方点表头时据此跳过排序(Header.mjs:107-108 的 happensIn(e, 'dataTableFilter'))。
           不用 @click.stop:它会吞掉宿主挂在 th / 祖先上的 click 监听(Q-6)。 -->
      <span
        ref="triggerRef"
        class="smart-table-filter-trigger"
        :class="{ 'smart-table-filter-trigger--active': active, 'smart-table-filter-trigger--open': show }"
        data-data-table-filter
        @keydown="onTriggerKeydown"
      >
        <n-tooltip trigger="hover" :disabled="show">
          <template #trigger>
            <!-- aria-haspopup / aria-expanded:屏幕阅读器得知这个按钮会弹出对话框、当前是否展开(D6) -->
            <n-button
              quaternary
              size="tiny"
              :type="active ? 'primary' : 'default'"
              :aria-label="ariaLabel"
              aria-haspopup="dialog"
              :aria-expanded="show"
            >
              <template #icon><FilterIcon /></template>
            </n-button>
          </template>
          {{ labels.filter }}
        </n-tooltip>
        <!-- 文字色取主题的 baseColor(亮白 / 暗黑),不写死 #fff:暗色下叠在主色上对比度太低(Q-2) -->
        <span v-if="activeCount > 1" class="smart-table-filter-badge" :style="{ color: themeVars.baseColor }">{{
          activeCount
        }}</span>
      </span>
    </template>

    <!-- 面板容器:role=dialog + aria-label;tabindex=-1 让它能被鼠标聚焦 —— 点空白处时浏览器自动把焦点给它(不落到 body),不需要任何 mousedown 处理(E3,S3 实测) -->
    <div
      ref="panelRef"
      class="smart-table-filter"
      :class="{ 'smart-table-filter--condition': !def.render && showEditor }"
      role="dialog"
      tabindex="-1"
      :aria-label="panelLabel"
      :style="{
        background: themeVars.popoverColor,
        borderRadius: themeVars.borderRadius,
        boxShadow: themeVars.boxShadow2,
        color: themeVars.textColor2,
      }"
      @click.stop
      @keydown.capture="onPanelKeydown"
    >
      <!-- 自定义面板:完全接管内容,只复用弹层与提交通道 -->
      <component
        v-if="def.render"
        :is="() => def.render!({ value, setValue: (v) => emit('update:value', v), close: () => close(true) })"
      />

      <template v-else>
        <!-- options:勾选候选项 -->
        <div v-if="def.mode === 'options' && !advanced" class="smart-table-filter-options">
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

        <!-- 多条件编辑(condition 列恒显示;options 列展开「高级条件」后显示) -->
        <div v-else class="smart-table-filter-conditions">
          <ConditionRow
            v-for="(c, i) in draft.conditions"
            :key="i"
            :def="def"
            :condition="c"
            :labels="labels"
            :get-options="getOptions"
            :is-loading-options="isLoadingOptions"
            :date-value-format="dateValueFormat"
            :removable="draft.conditions.length > 1"
            @update:action="(a: FilterAction) => onAction(i, a)"
            @update:value="(v: unknown) => onValue(i, v)"
            @remove="onRemove(i)"
            @enter="confirm"
            @dropdown="(o: boolean) => onDropdown(i, o)"
          />
          <div v-if="draft.conditions.length > 1" class="smart-table-filter-logic">
            <n-radio-group size="small" :value="draft.logic" @update:value="onLogic">
              <n-radio-button value="and">{{ labels.filterLogicAnd }}</n-radio-button>
              <n-radio-button value="or">{{ labels.filterLogicOr }}</n-radio-button>
            </n-radio-group>
          </div>
          <n-button
            class="smart-table-filter-add"
            text
            size="tiny"
            type="primary"
            :disabled="draft.conditions.length >= MAX_CONDITIONS"
            @click="onAdd"
          >
            + {{ labels.filterAddCondition }}
          </n-button>
        </div>

        <!-- options 列:勾选 ↔ 高级条件 的切换入口 -->
        <div v-if="def.mode === 'options'" class="smart-table-filter-advanced">
          <n-button v-if="!advanced" class="smart-table-filter-advanced-open" text size="tiny" @click="openAdvanced">
            {{ labels.filterAdvanced }}
          </n-button>
          <n-button
            v-else
            class="smart-table-filter-advanced-close"
            text
            size="tiny"
            :disabled="!canCollapse"
            @click="closeAdvanced"
          >
            {{ labels.filterSimple }}
          </n-button>
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
  /* 标题 → 漏斗 8px(Q-5);漏斗 → 排序箭头 6px 由 SmartTable 的样式给 */
  margin-left: 8px;
  /* 表头默认 center 对齐时,漏斗不该把标题挤偏 */
  vertical-align: middle;
}
.smart-table-filter-badge {
  margin-left: 2px;
  min-width: 14px;
  height: 14px;
  padding: 0 3px;
  border-radius: 7px;
  font-size: 10px;
  line-height: 14px;
  text-align: center;
  /* 文字色在模板里经 :style 取 themeVars.baseColor(Q-2);背景取官方的激活图标色(角标在 th 的子树里,--n-* 变量可用) */
  background: var(--n-th-icon-color-active);
}
.smart-table-filter {
  min-width: 200px;
  padding: 8px;
  /* 表头文字常是 center,弹层内容一律左对齐 */
  text-align: left;
  font-weight: normal;
}
/* 容器只接程序化焦点(点空白处 / Esc 的落点),不画焦点环 */
.smart-table-filter:focus {
  outline: none;
}
/* 条件面板:一行「操作符 | 值 | 删除」放得下;窄屏不越出视口 */
.smart-table-filter--condition {
  width: min(400px, calc(100vw - 16px));
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
.smart-table-filter-logic {
  display: flex;
  align-items: center;
}
.smart-table-filter-add {
  align-self: flex-start;
}
.smart-table-filter-advanced {
  margin-top: 8px;
}
.smart-table-filter-footer {
  margin-top: 8px;
  padding-top: 8px;
  display: flex;
  justify-content: flex-end;
}
</style>
