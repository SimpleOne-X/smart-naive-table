<script setup lang="ts">
// 单元格里的编辑控件(可编辑表格 editable):按推断出的类型直接用 naive-ui 官方控件,不自画。
//   input → NInput · number → NInputNumber · select → NSelect(进入即展开) · date / datetime → NDatePicker(进入即展开面板,
//   datetime 用官方 type="datetime":头部「日期 + 时间选择」、底部 此刻 / 确认)。多行文本框在浮层里,见 EditableTextPop。
// 控件撑满单元格、去掉自带边框,选中 / 编辑的 2px 内描边由 td 自己画(见 SmartTable 的样式),所以进入编辑不改行高、文字不跳。
// 键盘(Enter / Tab / Esc)由 useEditable 在 document 捕获阶段统一处理,这里只负责挂载聚焦、把值交回去。
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { NDatePicker, NInput, NInputNumber, NSelect } from 'naive-ui'
import { measureCellPadding } from './cellPadding'
import type { EditorCtrl } from './editable'
import type { EditorKind, SmartTableLabels, SmartTableOption } from './types'
import { optionLabel } from './useOptions'
import SmartSelectTable from './SmartSelectTable.vue'

const props = defineProps<{
  kind: Exclude<EditorKind, 'textarea' | 'checkbox'>
  value: unknown
  options: SmartTableOption[]
  extra?: Record<string, unknown>
  invalid: boolean
  /** 直接打字进入编辑时敲的那个字符:替换原值。 */
  typed?: string
  /** 鼠标进入编辑时全选原文,键盘进入时光标在末尾。 */
  selectAll?: boolean
  /** 下拉菜单最小宽 = max(单元格宽, 120)。 */
  menuMinWidth: number
  placeholder?: string
  /** 列的 key(select-table 的 labelKey 缺省取它)。 */
  colKey?: string
  /** 表格的文案(select-table 面板沿用)。 */
  labels?: Partial<SmartTableLabels>
  ctrl: EditorCtrl
}>()

/** 选项超过这个数的下拉自动可搜索(editorProps.filterable 可覆盖)。 */
const FILTERABLE_MIN = 8
const root = ref<HTMLElement | null>(null)
const control = ref<{ focus?: () => void } | null>(null)
const pick = ref<{ clearKeyword: () => boolean } | null>(null)
/** 显示态单元格实际的内边距(挂载时量出,写在根元素上);量不到时用样式里的缺省(--n-td-padding 为单值时与显示态一致)。 */
const padVars = ref<Record<string, string>>()
/** select-table:面板的 Esc 先清空搜索(useEditable 在 document 捕获阶段问一声)。 */
const pickProps = computed<Record<string, any>>(() => {
  const {
    fill: _fill,
    valueKey: _vk,
    labelKey,
    ...rest
  } = (props.extra ?? {}) as Record<string, unknown>
  return { ...rest, labelKey: (labelKey as string | undefined) ?? props.colKey }
})

const selectOptions = computed(() =>
  props.options.map((o) => ({
    label: optionLabel(o),
    value: o.value as string | number,
    disabled: o.disabled,
  })),
)
const menuProps = computed(() => ({ style: `min-width: ${props.menuMinWidth}px` }))
/** NSelect 按严格相等匹配选项,而草稿值常是字符串(行里的数字被 String 化):按 String() 双边比较(同提交校验)取选项自己的 value。 */
const optionValueOf = (v: unknown): string | number | undefined =>
  v == null ? undefined : selectOptions.value.find((o) => String(o.value) === String(v))?.value
const selectValue = computed(() => {
  if (props.kind !== 'multiselect') {
    // 单选对不上选项时给 null:触发器显示占位文字,而不是 NSelect 默认回显的原始值(0 / 雪花 id)
    return optionValueOf(props.value) ?? null
  }
  // 多选对不上的项原样保留(显示成原值标签,不悄悄丢掉)
  const list = Array.isArray(props.value) ? props.value : []
  return list.map((v) => optionValueOf(v) ?? v) as Array<string | number>
})
const textValue = computed(() => (props.value == null ? '' : String(props.value)))
const numberValue = computed(() => (typeof props.value === 'number' ? props.value : null))
const dateValue = computed(() => (props.value ? String(props.value) : null))
const dateFormat = computed(() =>
  props.kind === 'datetime' ? 'yyyy-MM-dd HH:mm:ss' : 'yyyy-MM-dd',
)

onMounted(async () => {
  const pad = root.value ? measureCellPadding(root.value) : null
  if (pad) padVars.value = { '--smart-xe-pad-left': pad.left, '--smart-xe-pad-y': pad.y }
  if (props.kind === 'select-table') {
    props.ctrl.pickEsc = () => pick.value?.clearKeyword() ?? false
    return // 面板自己聚焦搜索框
  }
  await nextTick()
  const inner = root.value?.querySelector<HTMLInputElement>('input')
  if (
    props.kind === 'select' ||
    props.kind === 'multiselect' ||
    props.kind === 'date' ||
    props.kind === 'datetime'
  ) {
    control.value?.focus?.()
    return
  }
  if (!inner) return
  inner.focus({ preventScroll: true })
  if (props.typed !== undefined) {
    // 直接打字 = 用输入替换原值:走一遍真实的 input 事件,NInput / NInputNumber 的受控与过滤规则照常生效(数字框不会收下字母)
    inner.value = props.typed
    inner.dispatchEvent(new Event('input', { bubbles: true }))
    return
  }
  try {
    if (props.selectAll) inner.select()
    else inner.setSelectionRange(inner.value.length, inner.value.length)
  } catch {
    /* 个别 input 类型不支持选区 */
  }
})
onBeforeUnmount(() => {
  if (props.kind === 'select-table') props.ctrl.pickEsc = undefined
})
</script>

<template>
  <div
    ref="root"
    class="smart-table-xe"
    :class="{ 'smart-table-xe--err': invalid }"
    :style="padVars"
    :data-xe="kind"
    @click.stop
  >
    <n-input
      v-if="kind === 'input'"
      :value="textValue"
      :bordered="false"
      :placeholder="placeholder"
      :input-props="{ spellcheck: false, autocomplete: 'off' }"
      v-bind="extra"
      @update:value="ctrl.update"
    />
    <n-input-number
      v-else-if="kind === 'number'"
      :value="numberValue"
      :bordered="false"
      :clearable="false"
      :placeholder="placeholder"
      v-bind="extra"
      @update:value="ctrl.update"
    />
    <smart-select-table
      v-else-if="kind === 'select-table'"
      ref="pick"
      :value="textValue"
      :value-key="pickProps.labelKey"
      :columns="pickProps.columns"
      v-bind="pickProps"
      :bordered="false"
      :default-open="true"
      :default-keyword="typed"
      :close-on-outside="false"
      :labels="labels"
      :placeholder="placeholder"
      @pick="ctrl.pickRow"
    />
    <n-select
      v-else-if="kind === 'select' || kind === 'multiselect'"
      ref="control"
      :multiple="kind === 'multiselect'"
      :filterable="options.length > FILTERABLE_MIN"
      :value="selectValue"
      :options="selectOptions"
      :show="true"
      :bordered="false"
      :placeholder="placeholder"
      :consistent-menu-width="false"
      :menu-props="menuProps"
      v-bind="extra"
      @update:value="kind === 'multiselect' ? ctrl.update($event) : ctrl.pick($event)"
    />
    <n-date-picker
      v-else
      ref="control"
      :type="kind"
      :formatted-value="dateValue"
      :value-format="dateFormat"
      :show="true"
      :bordered="false"
      clearable
      :placeholder="placeholder"
      v-bind="extra"
      @update:formatted-value="(v: string | null) => ctrl.pickDate(v ?? '')"
      @confirm="
        (_v: unknown, f: unknown) => ctrl.confirmDate(typeof f === 'string' ? f : undefined)
      "
      @clear="ctrl.clearDate"
    />
  </div>
</template>

<style>
/* 可编辑表格(editable)的单元格样式。非 scoped:选择器都在 .smart-table--editable(根元素状态类)之下,类名统一 smart-table-x* 前缀。
   主题色(主色 / 错误 / 警示 / 只读字色)经根元素的 CSS 变量(--smart-table-xl-*,useEditable.styleVars 按主题下发)。编辑器与新增行在 td 里面,底色直接取官方的 var(--n-merged-td-color)
   (NDataTable 根上定义,放进 modal / drawer / popover 时官方会换成对应的底色,编辑格与周围单元格始终同色);窄档卡片不在 NDataTable 里,仍用 --smart-table-xl-bg。
   选中 / 编辑框 = 2px 内描边(inset box-shadow,不占布局),所以进入编辑不改行高、文字不跳;编辑态单元格 padding 置 0、控件撑满;
   动效只有颜色类、不做位移。 */
.smart-table--editable .n-data-table-td.smart-table-xc {
  cursor: default;
}
/* 脏标记小三角要定位在 td 左上:固定列 td 已是 sticky(本身就是定位元素),不能改成 relative 否则固定列失效 */
.smart-table--editable
  .n-data-table-td.smart-table-xc:not(.n-data-table-td--fixed-left):not(
    .n-data-table-td--fixed-right
  ) {
  position: relative;
}
.smart-table--editable .n-data-table-td.smart-table-xro {
  color: var(--smart-table-xl-ro);
}
.smart-table--editable .n-data-table-td.smart-table-xk-ck {
  text-align: center;
}
.smart-table--editable .n-data-table-td.smart-table-xk-ck .n-checkbox {
  vertical-align: middle;
}
.smart-table--editable .n-data-table-td[data-xsel] {
  box-shadow: inset 0 0 0 2px var(--smart-table-xl-primary);
  outline: 0;
}
.smart-table--editable .n-data-table-td.smart-table-xerr {
  box-shadow: inset 0 0 0 2px var(--smart-table-xl-error);
}
.smart-table--editable .n-data-table-td.smart-table-xd::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 0;
  height: 0;
  pointer-events: none;
  border-style: solid;
  border-width: 6px 6px 0 0;
  border-color: var(--smart-table-xl-warn) transparent transparent transparent;
}
/* 编辑态:控件撑满单元格(绝对定位铺满 td,不参与行高计算) */
.smart-table--editable .n-data-table-td.smart-table-xed:not(.smart-table-xed--ta) {
  padding: 0;
  overflow: visible;
}
.smart-table--editable .n-data-table-td.smart-table-xed--ta {
  box-shadow: inset 0 0 0 2px var(--smart-table-xl-primary);
}
.smart-table-xreq {
  margin-right: 4px;
  color: var(--smart-table-xl-error);
  font-weight: 400;
  user-select: none;
}
/* 锁定的格(行级只读):灰显,标签 / 复选框淡化;仍可选中 / 复制 */
.smart-table--editable .n-data-table-td.smart-table-xlk {
  color: var(--smart-table-xl-ro);
}
.smart-table--editable .n-data-table-td.smart-table-xlk .n-tag,
.smart-table--editable .n-data-table-td.smart-table-xlk .n-checkbox {
  opacity: 0.55;
}
.smart-table--editable .smart-table-card-item.smart-table-xlk .smart-table-card-title,
.smart-table--editable .smart-table-card-item.smart-table-xlk .smart-table-card-desc dd {
  color: var(--smart-table-xl-ro);
}
.smart-table--editable .smart-table-card-item.smart-table-xlk .n-tag {
  opacity: 0.55;
}
/* --smart-xe-pad-left / --smart-xe-pad-y:显示态单元格的左内边距、上下内边距之和。挂载后被 measureCellPadding 量出的实际值盖掉(行内样式);
   这里是量不到时的缺省,--n-td-padding 为单值(Naive 默认主题)时与显示态一致 */
.smart-table-xe {
  position: absolute;
  inset: 0;
  display: flex;
  background: var(--n-merged-td-color);
  container-type: size;
  --smart-xe-pad-left: var(--n-td-padding);
  --smart-xe-pad-y: calc(var(--n-td-padding) * 2);
}
.smart-table-xe::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  box-shadow: inset 0 0 0 2px var(--smart-table-xl-primary);
}
.smart-table-xe--err::after {
  box-shadow: inset 0 0 0 2px var(--smart-table-xl-error);
}
.smart-table-xe > * {
  flex: 1 1 auto;
  min-width: 0;
  height: 100%;
}
/* 控件高 = 单元格内框高:.smart-table-xe 是尺寸容器,100cqh 取它的实际高度,与控件嵌套多深无关。
   行比一行字高(行内有更高的内容、字号 15px、舒适密度)时,文字仍垂直居中,下拉表格的浮层锚点也落在单元格下沿。
   不认容器查询单位的浏览器退回 单元格上下内边距之和 + 一行字 22.4px(默认主题紧凑 38.4 / 舒适 46.4,= 默认行高 − 1px 边线;行更高时文字偏上)。
   文字左缘与显示态对齐,取 --smart-xe-pad-left(默认主题紧凑 8px / 舒适 12px),不直接用 --n-td-padding:宿主主题可以把它写成 '4px 12px' 这样的两值,
   代进「0 26px 0 …」得到五个值,整条声明失效、左内边距落回 0。单行(single)与多选(multiple)是官方两套独立的内边距变量,都要盖。
   官方控件的 --n-* 变量在它自己的根元素上以内联样式写入,这里用 !important 盖掉 */
.smart-table-xe .n-input,
.smart-table-xe .n-base-selection {
  --n-height: calc(var(--smart-xe-pad-y) + 22.4px) !important;
  --n-line-height: 22.4px !important;
  --n-padding-left: var(--smart-xe-pad-left) !important;
  --n-padding-single: 0 26px 0 var(--smart-xe-pad-left) !important;
  --n-padding-multiple: 3px 26px 0 var(--smart-xe-pad-left) !important;
  --n-color: var(--n-merged-td-color) !important;
  --n-color-focus: var(--n-merged-td-color) !important;
  --n-color-active: var(--n-merged-td-color) !important;
  --n-color-focus-warning: var(--n-merged-td-color) !important;
}
@supports (height: 1cqh) {
  .smart-table-xe .n-input,
  .smart-table-xe .n-base-selection {
    --n-height: 100cqh !important;
  }
}
/* 下拉表格的触发器是浮层(面板 + 小箭头)的锚点:铺满单元格,面板才落在单元格下沿 + 间距,不压进单元格 */
.smart-table-xe .smart-table-xpick-trigger {
  height: 100%;
}
/* 数字框的 −/+ 按钮:单元格里收成 16px、右边留 6px(官方 18px;原型同款) */
.smart-table-xe .n-input-number .n-input {
  --n-padding-right: 6px !important;
}
.smart-table-xe .n-input-number .n-input__suffix .n-button {
  width: 16px !important;
  height: 16px !important;
  --n-icon-size: 16px !important;
}
/* 新增行(待保存):主色 7% 底 + 首格左侧 3px 主色条;待删行:淡化 + 删除线(勾选列 / 序号不淡化,仍可取消勾选) */
.smart-table--editable .n-data-table-tr.smart-table-xnew > .n-data-table-td {
  background-color: color-mix(in srgb, var(--smart-table-xl-primary) 7%, var(--n-merged-td-color));
}
.smart-table--editable .n-data-table-tr.smart-table-xnew > .n-data-table-td:first-child {
  box-shadow: inset 3px 0 0 var(--smart-table-xl-primary);
}
.smart-table--editable
  .n-data-table-tr.smart-table-xdel
  > .n-data-table-td:not(.n-data-table-td--selection):not([data-col-key='__index']) {
  opacity: 0.5;
  text-decoration: line-through;
}
/* 窄档卡片:新增(主色 8% 底)/ 已修改(左侧 3px 警示条)/ 待删除(标题与描述淡化 + 删除线);卡片可点(开抽屉表单) */
.smart-table--editable .smart-table-card-item {
  cursor: pointer;
}
.smart-table--editable .smart-table-card-item.smart-table-xnew {
  background-color: color-mix(in srgb, var(--smart-table-xl-primary) 8%, var(--smart-table-xl-bg));
}
.smart-table--editable .smart-table-card-item.smart-table-xdirty {
  box-shadow: inset 3px 0 0 var(--smart-table-xl-warn);
}
.smart-table--editable .smart-table-card-item.smart-table-xdel .smart-table-card-title,
.smart-table--editable .smart-table-card-item.smart-table-xdel .smart-table-card-desc {
  opacity: 0.5;
  text-decoration: line-through;
}
</style>
