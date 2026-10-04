<script setup lang="ts" generic="T">
// 窄档卡片列表(cardOnNarrow,规格 §5.8):容器宽 < 600 时替换表格主体。
// 外观取自设计原型 .tbl-cards / .rc:无描边、淡底(actionColor)、圆角 3、内边距 12 16、卡片间距 8、标题 16 / 500、
// 「标签:值」两列(13px)、操作行上方 1px 分隔线、勾选框 18px(热区 44×44)在右上角、操作按钮 44 高;卡片固定舒适间距,不响应密度。
// 库自己的元素上取不到 naive 的 --n-* 变量,颜色一律走 useThemeVars + v-bind。
// 行点击 / 当前行高亮 / 宿主 row-props 沿用表格那一套:SmartTable 传进来的 rowProps 直接绑在卡片根上。
import { defineComponent, type PropType, type VNodeChild } from 'vue'
import { NCheckbox, NConfigProvider, NEmpty, useThemeVars } from 'naive-ui'
import type { CardView } from './cardColumns'

defineProps<{
  rows: T[]
  view: CardView<T>
  rowKey: (row: T) => string | number
  /** 与表格同一份行属性(含 .smart-table-row--active 与 @row-click 的忽略行内控件规则)。 */
  rowProps: (row: T, index: number) => Record<string, unknown>
  /** 宿主绑的 checked-row-keys(没绑 = null,由 SmartTable 用内部态兜底)。 */
  checkedKeys: Array<string | number>
  /** 宿主绑的 expanded-row-keys。 */
  expandedKeys: Array<string | number>
  loading: boolean
  /**
   * 合计卡(宿主给了 naive 的 summary 时,SmartTable 在窄档把它换成卡片):每个合计行一张,标题 + 「标签:值」。
   * 官方 summary 可以返回一行或多行,所以是数组;空 / null = 不画。
   */
  summary?: Array<{
    title: unknown
    metas: Array<{ key: string; label: () => VNodeChild; value: unknown }>
  }> | null
  /** 合计卡的位置,同官方 summary-placement:bottom(默认)= 列表末尾,top = 列表顶部。 */
  summaryPlacement?: 'top' | 'bottom'
}>()

const emit = defineEmits<{ check: [row: T, checked: boolean] }>()

// 标签 / 单元格是 VNodeChild(字符串、数字或 VNode):用一个只吐出它的小组件渲染,patch 时按位置复用,不会每次重挂
const RenderNode = defineComponent({
  props: { node: { type: null as unknown as PropType<VNodeChild>, default: null } },
  setup: (p) => () => p.node,
})

const themeVars = useThemeVars()
// 操作行里宿主的按钮跟着变大(触控 44px 的目标靠样式补足高度):官方 NConfigProvider 的 componentOptions,不改宿主代码
const ACTION_OPTIONS = { Button: { size: 'large' as const } }
</script>

<template>
  <div
    class="smart-table-cards"
    :class="{ 'smart-table-cards--loading': loading }"
    :style="{
      '--st-card-fill': themeVars.actionColor,
      '--st-card-divider': themeVars.dividerColor,
      '--st-card-text1': themeVars.textColor1,
      '--st-card-text2': themeVars.textColor2,
      '--st-card-text3': themeVars.textColor3,
      '--st-card-primary': themeVars.primaryColor,
      '--st-card-bg': themeVars.cardColor,
      // loading 透明度同官方 DataTable 的 opacityLoading(= 主题 opacityDisabled:亮 .5 / 暗 .38,见 naive-ui es/_styles/common/light.mjs|dark.mjs);
      // 直接绑 opacity 而不是写在 scoped CSS:取值随明暗主题变
      opacity: loading ? themeVars.opacityDisabled : undefined,
    }"
  >
    <template v-if="rows.length">
      <template v-if="summaryPlacement === 'top'">
        <div
          v-for="(card, ci) in summary"
          :key="`sum-${ci}`"
          class="smart-table-card-item smart-table-card-sum"
        >
          <div class="smart-table-card-head">
            <span class="smart-table-card-title"
              ><RenderNode :node="card.title as VNodeChild"
            /></span>
          </div>
          <dl v-if="card.metas.length" class="smart-table-card-desc">
            <div v-for="m in card.metas" :key="m.key">
              <dt><RenderNode :node="m.label()" /></dt>
              <dd><RenderNode :node="m.value as VNodeChild" /></dd>
            </div>
          </dl>
        </div>
      </template>
      <div
        v-for="(row, i) in rows"
        :key="rowKey(row)"
        class="smart-table-card-item"
        :class="{ 'smart-table-card-item--checked': checkedKeys.includes(rowKey(row)) }"
        v-bind="rowProps(row, i)"
      >
        <div
          class="smart-table-card-head"
          :class="{ 'smart-table-card-head--handle': view.handle }"
        >
          <span v-if="view.handle" class="smart-table-card-handle">
            <RenderNode :node="view.handle.render(row, i)" />
          </span>
          <span class="smart-table-card-title">
            <RenderNode v-if="view.title" :node="view.title.render(row, i)" />
          </span>
          <span v-if="view.index" class="smart-table-card-no"
            ><RenderNode :node="view.index.render(row, i)"
          /></span>
          <span v-if="view.selectable" class="smart-table-card-check">
            <n-checkbox
              size="large"
              :checked="checkedKeys.includes(rowKey(row))"
              :disabled="view.isDisabled?.(row)"
              @update:checked="(v: boolean) => emit('check', row, v)"
            />
          </span>
        </div>
        <dl v-if="view.metas.length" class="smart-table-card-desc">
          <div v-for="m in view.metas" :key="m.key">
            <dt><RenderNode :node="m.label()" /></dt>
            <dd><RenderNode :node="m.render(row, i)" /></dd>
          </div>
        </dl>
        <div
          v-if="view.renderExpand && expandedKeys.includes(rowKey(row))"
          class="smart-table-card-more"
        >
          <RenderNode :node="view.renderExpand(row, i)" />
        </div>
        <div v-if="view.action" class="smart-table-card-act">
          <n-config-provider abstract :component-options="ACTION_OPTIONS">
            <RenderNode :node="view.action.render(row, i)" />
          </n-config-provider>
        </div>
      </div>
      <template v-if="summaryPlacement !== 'top'">
        <div
          v-for="(card, ci) in summary"
          :key="`sum-${ci}`"
          class="smart-table-card-item smart-table-card-sum"
        >
          <div class="smart-table-card-head">
            <span class="smart-table-card-title"
              ><RenderNode :node="card.title as VNodeChild"
            /></span>
          </div>
          <dl v-if="card.metas.length" class="smart-table-card-desc">
            <div v-for="m in card.metas" :key="m.key">
              <dt><RenderNode :node="m.label()" /></dt>
              <dd><RenderNode :node="m.value as VNodeChild" /></dd>
            </div>
          </dl>
        </div>
      </template>
    </template>
    <div v-else class="smart-table-card-empty">
      <slot name="empty"><n-empty /></slot>
    </div>
  </div>
</template>

<style scoped>
.smart-table-cards {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}
/* 加载中:整列表淡出 + 不可点(原型 .dt.loading > .tbl-cards);淡出程度见模板里的 opacity 绑定 */
.smart-table-cards--loading {
  pointer-events: none;
  transition: opacity 0.2s;
}
.smart-table-card-item {
  flex: none;
  padding: 12px 16px;
  border-radius: 3px;
  background-color: var(--st-card-fill);
  transition: background-color 0.15s;
}
/* 勾选态(原型 .rc.sel):主色 8% 压在卡片底色上;当前行(activeRowKey)比它略重一点,两者可叠加时 active 在后 */
.smart-table-card-item--checked {
  background-color: color-mix(in srgb, var(--st-card-primary) 8%, transparent);
}
.smart-table-card-item.smart-table-row--active {
  background-color: var(
    --smart-table-active-row-bg,
    color-mix(in srgb, var(--st-card-primary) 9%, var(--st-card-bg))
  );
}
.smart-table-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
/* 有手柄的卡片:标题行里手柄 / 标题垂直居中,间距 8(原型 .rd-head) */
.smart-table-card-head--handle {
  align-items: center;
  gap: 8px;
}
.smart-table-card-title {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  font-size: 16px;
  font-weight: 500;
  line-height: 1.6;
  color: var(--st-card-text1);
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* 拖拽手柄(rowDraggable + card: 'handle'):触控目标 44×44,负外边距让它的视觉位置落在内边距里(原型 .rc .drag-handle) */
.smart-table-card-handle {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  margin: -10px 0 -10px -10px;
}
.smart-table-card-handle :deep(*) {
  touch-action: none;
}
.smart-table-card-no {
  flex: none;
  font-variant-numeric: tabular-nums;
}
.smart-table-card-check {
  display: inline-flex;
  flex: none;
  margin-top: 3px;
}
/* 勾选框热区 44×44:只加不可见热区、外观不变(18px 框 + 1px 边 + 13px × 2);右上角内边距 16 / 上 12 + 3,热区不伸出卡片外。
   伪元素的点击冒泡到 .n-checkbox 根,由官方的 click 处理 */
.smart-table-card-check :deep(.n-checkbox) {
  position: relative;
}
.smart-table-card-check :deep(.n-checkbox)::before {
  content: '';
  position: absolute;
  inset: -13px;
}
/* 13px:有意偏离官方 NDescriptions small 的 14px(与原型一致)—— 卡片套卡片后每对「标签:值」只有约 137px,14px 时「单据日期 2026-09-21」会折行 */
.smart-table-card-desc {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 12px;
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.6;
}
.smart-table-card-desc > div {
  display: flex;
  min-width: 0;
  column-gap: 8px;
}
.smart-table-card-desc dt {
  flex: none;
  margin: 0;
  font-weight: 400;
  color: var(--st-card-text3);
}
/* 字段值单行省略:卡片等高(以后接虚拟滚动也需要) */
.smart-table-card-desc dd {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  color: var(--st-card-text2);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.smart-table-card-more {
  margin-top: 8px;
  padding-top: 8px;
  overflow-x: auto;
  border-top: 1px solid var(--st-card-divider);
}
.smart-table-card-act {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
  padding-top: 4px;
  border-top: 1px solid var(--st-card-divider);
}
/* 操作按钮热区 44×44(触控目标,与勾选框一致):官方文字按钮的 --n-height 是 initial、没有固定高度,所以直接写 height / min-width;文字仍靠左 */
.smart-table-card-act :deep(.n-button) {
  justify-content: flex-start;
  min-width: 44px;
  /* !important:官方按钮样式里 height 的优先级更高(实测只写 height 不生效,量到 22px) */
  height: 44px !important;
}
.smart-table-card-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 160px;
}
</style>
