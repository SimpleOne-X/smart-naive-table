<script setup lang="ts">
// 表头过滤面板:漏斗触发 + 弹层。两种形态共用同一份过滤值模型(FilterValue):
//   options   —— Arco 风格,勾选候选项(等价于若干 equal 条件取「或」);底部「高级条件」展开同一份多条件编辑
//   condition —— Bootstrap Blazor 风格,多行 [操作符 + 值](最多 5 条,≥ 2 条出现且/或)
// 面板内改的是草稿,点「确定」才提交,避免每敲一个字就打一次远程请求;Esc / 点外部丢弃草稿。
// 键盘 / 焦点 / ARIA:公开的 NPopover 不管(焦点不进面板、Esc 不关闭,见设计文档 9.1),这里自己做。
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch, type PropType } from 'vue'
import { NButton, NCheckbox, NPopover, NRadio, NRadioGroup, NTooltip, useThemeVars } from 'naive-ui'
import type {
  FilterAction,
  FilterLogic,
  FilterValue,
  SmartTableLabels,
  SmartTableOption,
} from './types'
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
import { FilterIcon, PlusIcon } from './icons'
import { clampShift } from './viewportClamp'
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
  /** 每次变大 = 请求收起面板、丢弃草稿、不抢焦点(拖动列宽开始时用:气泡锚在漏斗上,列宽一变就对不上)。 */
  closeRequest: { type: Number, default: 0 },
})

const emit = defineEmits<{
  'update:value': [v: FilterValue | null]
}>()

const themeVars = useThemeVars()
// 工具行的文字按钮用官方 small 档(与同一面板里 small 的值控件一致):字 14 / 图标 18 / 内边距 0 10px / 高 heightSmall(28)。
// 官方文字按钮(text)把高度与内边距重置成 initial,所以高度取主题的 heightSmall、内边距在样式里写 paddingSmall 的值
const toolsBtnStyle = computed(() => ({ height: themeVars.value.heightSmall }))
const show = ref(false)
const active = computed(() => isFilterActive(props.value))
const activeCount = computed(() => activeConditions(props.value).length)
// 漏斗的无障碍名:多于 1 条时带条数(走 labels,渲染期求值)
const ariaLabel = computed(() =>
  activeCount.value > 1
    ? `${props.labels.filter}(${fmt(props.labels.filterActiveCount, { n: activeCount.value })})`
    : props.labels.filter,
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
    // 勾选表达不了当前值(notEqual / isNull / 且 的多条 equal …)→ 自动展开高级条件原样显示,不静默丢条件
    const representable = isOptionsRepresentable(from)
    advanced.value = !representable
    checked.value = representable ? filterValueToOptions(from) : []
  }
}

/* ---- 键盘 / 焦点 ---- */

/** 面板里可 Tab 到的控件(tabindex=-1 的面板容器自己不算)。 */
const FOCUSABLE =
  'input:not([disabled]), button:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function focusFirst() {
  panelRef.value?.querySelector<HTMLElement>(FOCUSABLE)?.focus()
}

/** 第 j 行条件的第一个可聚焦控件(第 1 行是操作符下拉;第 2 行起是首列的且 / 或下拉)。 */
function rowControl(panel: HTMLElement, j: number): HTMLElement | null | undefined {
  return panel.querySelectorAll('.smart-table-filter-row')[j]?.querySelector<HTMLElement>(FOCUSABLE)
}

/**
 * 被点的控件随这次更新被卸载(删除行的 ×、「高级条件 / 返回列表」切换)或被禁用(加到上限的「添加」)时,
 * 浏览器把焦点丢到 body —— 面板 teleport 在 body 末尾,焦点落到 body 之后 Esc / Tab 都到不了面板上的监听
 * (真实浏览器实测:Esc 关不掉面板)。只在焦点原本就在面板里时介入:更新后焦点不在面板里的可用控件上,
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

/* ---- 不出屏:NPopover 把面板居中在漏斗上,触发器靠近视口边缘时会被裁出屏幕;量出位置后给面板加一个水平平移夹回来 ---- */

const shiftX = ref(0)
let clampRaf = 0
/**
 * 盯住 follower 的 style:滚动时 vueuc 不在 scroll 事件里同步挪 follower,而是在自己排的 rAF 里
 * (Binder.js onScroll → beforeNextFrameOnce → Follower.syncPosition 改写 follower 的 transform)。
 * 下面 window 捕获阶段的 scroll 监听总是先于 vueuc 的监听触发,我们的 rAF 排在它前面,量到的是挪之前的位置 ——
 * 只靠它夹取会永远落后一拍(实测:滚动停下后面板右缘停在 567 / 视口 520)。follower 的 style 一被改写就重新夹取:
 * MutationObserver 的回调是微任务,紧跟 vueuc 的 rAF 回调、在这一帧绘制之前执行,所以同一帧就夹回来,不会先画出被裁的一帧。
 * 只盯 follower 自己的 style(不含子树),我们改的是面板(子元素)的 transform,不会自己触发自己。
 */
let followerObserver: MutationObserver | null = null
let observedHost: HTMLElement | null = null
function observeFollower(host: HTMLElement) {
  if (observedHost === host || typeof MutationObserver === 'undefined') return
  followerObserver?.disconnect()
  followerObserver = new MutationObserver(updateShift)
  followerObserver.observe(host, { attributes: true, attributeFilter: ['style'] })
  observedHost = host
}
function updateShift() {
  const el = panelRef.value
  if (!el) return
  // 量 NPopover 的定位容器(vueuc 的 follower:只有定位用的平移),不量面板自己:
  // 弹层有淡入 + 缩放的进场动画,面板自己的 rect 在动画里是缩小的,会量错;容器的 rect 就是真实的布局位置,也不含我们加的平移。
  // 找不到容器(换了版本 / 不是在 NPopover 里)就退回量面板自己,并还原它身上已有的平移。
  const host = el.closest<HTMLElement>('.v-binder-follower-content')
  if (host) observeFollower(host)
  const r = (host ?? el).getBoundingClientRect()
  const left = host ? r.left : r.left - shiftX.value
  const next = clampShift(left, r.width, window.innerWidth)
  if (next !== shiftX.value) shiftX.value = next
}
function scheduleShift() {
  cancelAnimationFrame(clampRaf)
  clampRaf = requestAnimationFrame(updateShift)
}
function startClamp() {
  scheduleShift()
  window.addEventListener('resize', scheduleShift)
  // 表头横向滚动 / 页面滚动(任意祖先,scroll 不冒泡所以用捕获阶段):NPopover 会跟着重新定位。
  // 在 NPopover 里真正的同步时机是上面的 follower 观察;这条监听兜底找不到 follower 的情况(量面板自己)
  window.addEventListener('scroll', scheduleShift, true)
}
function stopClamp() {
  cancelAnimationFrame(clampRaf)
  window.removeEventListener('resize', scheduleShift)
  window.removeEventListener('scroll', scheduleShift, true)
  followerObserver?.disconnect()
  followerObserver = null
  observedHost = null
}
onBeforeUnmount(stopClamp)

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
  if (!el) {
    stopClamp()
    shiftX.value = 0
    return
  }
  startClamp()
  if (show.value && !props.def.render) void nextTick(focusFirst)
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
watch(
  () => props.closeRequest,
  (n, o) => {
    if (n !== o && show.value) close(false)
  },
)

function close(focusBack: boolean) {
  returnFocus = focusBack
  show.value = false
}

/**
 * 自定义面板(def.render)的渲染入口,必须是稳定引用,不能在模板里就地写箭头函数。
 * `<component :is="fn">` 的 `fn` 本身就是 Vue 拿来当"组件类型"比较身份的东西(resolveDynamicComponent
 * 对函数原样返回),身份变了 isSameVNodeType 就判不同,会整棵子树卸载重挂——哪怕 fn 每次调用返回的
 * 内容一样。模板里 `:is="() => def.render!(...)"` 每次渲染都会新建一个箭头函数对象,平时不易察觉
 * (面板没开 / 没有其它响应式依赖触发重渲染时不会暴露),但只要组件因为任何别的原因重渲染(哪怕只是
 * active 这个和自定义面板毫不相关的漏斗图标高亮态翻转),面板内容就会被整个卸载重挂一次 ——
 * 拖拽 / 连续输入时会打断面板里正在交互的控件(如 NSlider 拖拽中途被卸载)。
 */
function renderCustomPanel() {
  return props.def.render!({
    value: props.value,
    setValue: (v) => emit('update:value', v),
    close: () => close(true),
  })
}

/**
 * 焦点是否在面板的首 / 尾控件 edge 上。同名的原生单选组(单选过滤的 NRadioGroup / NRadio)在浏览器里只算一个 Tab 停靠点:
 * 焦点在组里「选中的那个」或方向键移过去的那个 radio 上,不一定是 querySelectorAll 排出来的第一个 / 最后一个,
 * 但从它 Tab / Shift+Tab 出去会直接跳出整组 —— 所以 edge 所在单选组里的任意一个 radio 都算到了边上。
 * (只认 cur === edge 时,Chromium 实测焦点在第 2 个 radio 上 Shift+Tab 会逃出面板,之后 Esc 也关不掉。)
 */
function atEdge(cur: Element | null, edge: HTMLElement): boolean {
  if (cur === edge) return true
  return (
    cur instanceof HTMLInputElement &&
    edge instanceof HTMLInputElement &&
    cur.type === 'radio' &&
    edge.type === 'radio' &&
    cur.name !== '' &&
    cur.name === edge.name
  )
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
  if (e.shiftKey && (cur === panel || atEdge(cur, first))) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && atEdge(cur, last)) {
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
 * 漏斗触发器上的 Esc:面板打开期间,焦点还停在漏斗按钮上时(自定义面板 def.render 不自动聚焦,焦点就留在这里;
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
  () =>
    selectableOptions.value.length > 0 &&
    selectableOptions.value.every((o) => checked.value.includes(o.value)),
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
  const disabledChecked = checked.value.filter(
    (v) => flatOptions.value.find((o) => o.value === v)?.disabled,
  )
  checked.value = on
    ? [...disabledChecked, ...selectableOptions.value.map((o) => o.value)]
    : disabledChecked
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
const onAction = (i: number, a: FilterAction) =>
  (draft.value = setConditionAction(draft.value, i, a))
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
  <!-- raw 去掉官方气泡的底色 / 圆角 / 内边距,面板自己画;box-shadow 在官方基础 .n-popover 上、raw 不去,
       这里关掉,改由面板画同一份官方阴影:面板为避免出屏会单独平移,阴影得跟着它走,留在外壳上会错位成一块空阴影 -->
  <n-popover
    v-model:show="show"
    trigger="click"
    placement="bottom"
    :show-arrow="false"
    raw
    style="box-shadow: none"
  >
    <template #trigger>
      <!-- data-data-table-filter:官方点表头时据此跳过排序(Header.mjs:107-108 的 happensIn(e, 'dataTableFilter'))。
           不用 @click.stop:它会吞掉宿主挂在 th / 祖先上的 click 监听。 -->
      <span
        ref="triggerRef"
        class="smart-table-filter-trigger"
        :class="{
          'smart-table-filter-trigger--active': active,
          'smart-table-filter-trigger--open': show,
        }"
        data-data-table-filter
        @keydown="onTriggerKeydown"
      >
        <n-tooltip trigger="hover" :disabled="show">
          <template #trigger>
            <!-- 原生 button(设计原型 .th-filter):22×22、图标 15px、闲置色取表头图标色(与排序箭头同灰)、打开 / 悬停只加底色、
                 已筛选才变主色。不用 NButton:它的 padding / 文字色变量写在内联样式里,压不过库自己的 CSS。
                 aria-haspopup / aria-expanded:屏幕阅读器得知这个按钮会弹出对话框、当前是否展开 -->
            <button
              type="button"
              class="smart-table-filter-btn"
              :aria-label="ariaLabel"
              aria-haspopup="dialog"
              :aria-expanded="show"
            >
              <FilterIcon />
              <!-- 条数角标:绝对定位在按钮右上角(原型 .hf-n),不占行内宽度,所以多条件时表头既不变宽也不变高。
                   文字色取主题的 baseColor(亮白 / 暗黑),不写死 #fff:暗色下叠在主色上对比度太低。
                   aria-hidden:条数已在按钮的 aria-label 里,不要读两遍 -->
              <span
                v-if="activeCount > 1"
                class="smart-table-filter-badge"
                aria-hidden="true"
                :style="{ color: themeVars.baseColor }"
                >{{ activeCount }}</span
              >
            </button>
          </template>
          {{ labels.filter }}
        </n-tooltip>
      </span>
    </template>

    <!-- 面板容器:role=dialog + aria-label;tabindex=-1 让它能被鼠标聚焦 —— 点空白处时浏览器自动把焦点给它(不落到 body),不需要任何 mousedown 处理(实测) -->
    <div
      ref="panelRef"
      class="smart-table-filter"
      :class="{
        'smart-table-filter--condition': !def.render && showEditor,
        'smart-table-filter--custom': !!def.render,
      }"
      role="dialog"
      tabindex="-1"
      :aria-label="panelLabel"
      :style="{ transform: shiftX ? `translateX(${shiftX}px)` : undefined }"
      @click.stop
      @keydown.capture="onPanelKeydown"
    >
      <!-- 自定义面板:完全接管内容,只复用弹层与提交通道 -->
      <component v-if="def.render" :is="renderCustomPanel" />

      <template v-else>
        <div class="smart-table-filter-body">
          <!-- options 单选(filter.multiple: false):官方用 NRadioGroup / NRadio(data-table/src/HeaderButton/FilterMenu.mjs:118-141),
               不能用复选框模拟 -->
          <n-radio-group
            v-if="def.mode === 'options' && !advanced && !def.multiple"
            class="smart-table-filter-options"
            :name="`smart-table-filter-${def.key}`"
            :value="(checked[0] ?? null) as string | number | null"
            @update:value="(v: string | number | null) => (checked = v == null ? [] : [v])"
          >
            <n-radio
              v-for="opt in flatOptions"
              :key="String(opt.value)"
              :value="opt.value as string | number"
              :disabled="opt.disabled"
            >
              {{ optionLabel(opt) }}
            </n-radio>
            <span v-if="!flatOptions.length" :style="{ color: themeVars.textColor3 }">
              {{ isLoadingOptions(def.optionsKey) ? '...' : '—' }}
            </span>
          </n-radio-group>

          <!-- options 多选:勾选候选项 -->
          <div v-else-if="def.mode === 'options' && !advanced" class="smart-table-filter-options">
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

          <!-- 多条件编辑(condition 列恒显示;options 列展开「高级条件」后显示):首列「条件」/ 且或下拉 + 比较符 + 值 + 删除 -->
          <div v-else class="smart-table-filter-conditions">
            <ConditionRow
              v-for="(c, i) in draft.conditions"
              :key="i"
              :def="def"
              :condition="c"
              :index="i"
              :logic="draft.logic"
              :labels="labels"
              :get-options="getOptions"
              :is-loading-options="isLoadingOptions"
              :date-value-format="dateValueFormat"
              :removable="draft.conditions.length > 1"
              @update:action="(a: FilterAction) => onAction(i, a)"
              @update:value="(v: unknown) => onValue(i, v)"
              @update:logic="onLogic"
              @remove="onRemove(i)"
              @enter="confirm"
              @dropdown="(o: boolean) => onDropdown(i, o)"
            />
          </div>

          <!-- 工具行:condition / 高级条件 = 「添加条件」(文字按钮 + 加号);options 勾选态 = 「高级条件 ▾」;
               options 的高级条件态再靠右放「返回列表 ▴」 -->
          <div class="smart-table-filter-tools">
            <n-button
              v-if="def.mode === 'options' && !advanced"
              class="smart-table-filter-advanced-open"
              text
              size="small"
              :style="toolsBtnStyle"
              @click="openAdvanced"
            >
              {{ labels.filterAdvanced }} ▾
            </n-button>
            <template v-else>
              <n-button
                class="smart-table-filter-add"
                text
                size="small"
                :style="toolsBtnStyle"
                :disabled="draft.conditions.length >= MAX_CONDITIONS"
                @click="onAdd"
              >
                <template #icon><PlusIcon /></template>
                {{ labels.filterAddCondition }}
              </n-button>
              <n-button
                v-if="def.mode === 'options'"
                class="smart-table-filter-advanced-close"
                text
                size="small"
                :style="toolsBtnStyle"
                :disabled="!canCollapse"
                @click="closeAdvanced"
              >
                {{ labels.filterSimple }} ▴
              </n-button>
            </template>
          </div>
          <div
            v-if="def.mode === 'options' && advanced && !canCollapse"
            class="smart-table-filter-hint"
            :style="{ color: themeVars.textColor3 }"
          >
            {{ labels.filterCannotCollapse }}
          </div>
        </div>
      </template>

      <div
        v-if="!def.render"
        class="smart-table-filter-footer"
        :style="{ borderTop: `1px solid ${themeVars.dividerColor}` }"
      >
        <n-button size="tiny" @click="reset">{{ labels.filterReset }}</n-button>
        <n-button size="tiny" type="primary" @click="confirm">{{ labels.filterConfirm }}</n-button>
      </div>
    </div>
  </n-popover>
</template>

<style scoped>
.smart-table-filter-trigger {
  display: inline-flex;
  align-items: center;
  /* 标题 → 漏斗 8px;漏斗 → 排序箭头 6px 由 SmartTable 的样式给 */
  margin-left: 8px;
  /* 表头默认 center 对齐时,漏斗不该把标题挤偏 */
  vertical-align: middle;
}
/* 漏斗按钮(设计原型 .th-filter):22×22(图标 15px 两侧各留 3.5px,列宽拖拽下限 102 / 123 就是按它算的)。
   颜色走表头的主题变量(触发器在 th 的子树里,--n-th-* 可用):闲置 = thIconColor(与排序箭头同灰),
   悬停 / 面板打开只加 thButtonColorHover 底色(不变色),已筛选 = thIconColorActive(主色)。 */
.smart-table-filter-btn {
  position: relative;
  flex: none;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 0;
  border-radius: var(--n-border-radius);
  background: transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  line-height: 1;
  color: var(--n-th-icon-color);
  cursor: pointer;
  transition:
    color 0.15s,
    background-color 0.15s;
}
.smart-table-filter-btn:hover,
.smart-table-filter-trigger--open .smart-table-filter-btn {
  background: var(--n-th-button-color-hover);
}
.smart-table-filter-trigger--active .smart-table-filter-btn {
  color: var(--n-th-icon-color-active);
}
/* 只在键盘聚焦时画焦点环(与原型 .n-btn:focus-visible 一致:克制的主色细环,外扩 2px) */
.smart-table-filter-btn:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--n-th-icon-color-active) 55%, transparent);
  outline-offset: 2px;
}
/* 条数角标(原型 .hf-n):绝对定位,不占宽、不占高。文字色在模板里经 :style 取 themeVars.baseColor;
   背景取表头的激活图标色(= 主色) */
.smart-table-filter-badge {
  position: absolute;
  top: -3px;
  right: -5px;
  min-width: 12px;
  height: 12px;
  padding: 0 3px;
  border-radius: 6px;
  font-size: 10px;
  font-weight: 500;
  line-height: 12px;
  text-align: center;
  pointer-events: none;
  background: var(--n-th-icon-color-active);
}
/* 面板(设计原型 .hpop):外壳 padding 0,正文 12px 12px 0,底部 footer 自带 8px 12px 内边距与分隔线。
   options 面板宽度由内容定(最小 168),condition 面板固定 400(窄屏不越出视口)。 */
/* 底色 / 圆角 / 阴影 / 文字色取外壳 .n-popover 上的官方弹层变量(主题与 themeOverrides 一并跟随,亮暗自动) */
.smart-table-filter {
  background-color: var(--n-color);
  border-radius: var(--n-border-radius);
  box-shadow: var(--n-box-shadow);
  color: var(--n-text-color);
  min-width: 168px;
  max-width: calc(100vw - 16px);
  /* 表头文字常是 center,弹层内容一律左对齐 */
  text-align: left;
  font-weight: normal;
}
/* 自定义面板(def.render)沿用 2.1.1 的 8px 内边距 / 200px 最小宽,不套新的排布 */
.smart-table-filter--custom {
  min-width: 200px;
  padding: 8px;
}
/* 容器只接程序化焦点(点空白处 / Esc 的落点),不画焦点环 */
.smart-table-filter:focus {
  outline: none;
}
.smart-table-filter--condition {
  width: min(400px, calc(100vw - 16px));
}
.smart-table-filter-body {
  padding: 12px 12px 0;
}
/* options 勾选列表:选项间距 12px(行高 22.4 → 间隔 34.4),最高 240 滚动(原型 .hp-group / 官方勾选菜单) */
.smart-table-filter-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
  /* overflow-y: auto 会把 overflow-x 也变成 auto,贴边的复选框聚焦光圈(官方 box-shadow: 0 0 0 2px 向外扩)会被裁掉;
     四周留 4px 放光圈,再用等量负外边距抵消,版面位置和 240 的可视高度不变 */
  box-sizing: border-box;
  max-height: 248px;
  margin: -4px;
  padding: 4px;
  overflow-y: auto;
}
.smart-table-filter-conditions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
/* 工具行:与上方内容 8px、与下方 8px;按钮是官方 small 档(`button/styles/_common.mjs`:`heightSmall` 28 / `paddingSmall` 0 10px /
   `fontSizeSmall` 14 / `iconSizeSmall` 18),原型 `.hp-tools .n-btn.text` 同款。官方文字按钮(text)把高度与内边距重置成 initial,
   所以高度由模板里取主题 heightSmall(`toolsBtnStyle`),内边距在这里写 paddingSmall 的值;颜色保持官方文字按钮的 textColor2 / 悬停主色 */
.smart-table-filter-tools {
  display: flex;
  align-items: center;
  margin-top: 8px;
  margin-bottom: 8px;
}
.smart-table-filter-tools .n-button {
  padding: 0 10px;
}
.smart-table-filter-advanced-close {
  margin-left: auto;
}
.smart-table-filter-hint {
  margin: -4px 0 8px;
  font-size: 12px;
}
.smart-table-filter-footer {
  display: flex;
  flex-wrap: nowrap;
  justify-content: space-evenly;
  padding: 8px 12px;
}
.smart-table-filter-footer .n-button {
  margin-right: 8px;
}
.smart-table-filter-footer .n-button:last-child {
  margin-right: 0;
}
</style>
