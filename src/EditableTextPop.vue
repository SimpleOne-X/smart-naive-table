<script setup lang="ts">
// 多行文本框的编辑浮层(可编辑表格 editable 里推断成 textarea 的列):单元格照常显示文本,编辑框是盖在单元格上的浮层
// (宽 ≥ 320、4 行),放在 body 下 + fixed 定位,不被表格的横向 / 纵向滚动容器裁掉。位置按单元格实时算,表格滚动 / 窗口缩放时跟着走。
// Enter 提交、Shift+Enter 换行、Esc 放弃由 useEditable 在 document 捕获阶段统一处理;这里负责聚焦与定位。
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { NInput, useThemeVars } from 'naive-ui'
import type { EditorCtrl } from './editable'

const props = defineProps<{
  value: string
  invalid: boolean
  typed?: string
  selectAll?: boolean
  placeholder?: string
  ctrl: EditorCtrl
}>()

const themeVars = useThemeVars()
const anchor = ref<HTMLElement | null>(null)
const box = ref<HTMLElement | null>(null)
const pos = ref({ left: 0, top: 0, width: 320, visible: false })

const MIN_W = 320
/** 浮层留给视口边缘的间距。 */
const GAP = 8

function place() {
  const td = anchor.value?.closest('td')
  if (!td) return
  const r = td.getBoundingClientRect()
  // 单元格被表格容器滚出可视区:浮层先藏起来(与单元格一起「消失」)
  const scroller = td.closest('.n-scrollbar-container, .n-data-table-base-table-body')
  const sc = scroller?.getBoundingClientRect()
  if (sc && (r.bottom < sc.top || r.top > sc.bottom)) {
    pos.value = { ...pos.value, visible: false }
    return
  }
  const width = Math.max(r.width, MIN_W)
  const h = box.value?.offsetHeight ?? 0
  const left = Math.max(GAP, Math.min(r.left, window.innerWidth - width - GAP))
  let top = r.top
  if (top + h > window.innerHeight - GAP) top = Math.max(GAP, window.innerHeight - h - GAP)
  pos.value = { left, top, width, visible: true }
}

onMounted(async () => {
  place()
  window.addEventListener('resize', place)
  document.addEventListener('scroll', place, true)
  await nextTick()
  place()
  const el = box.value?.querySelector<HTMLTextAreaElement>('textarea')
  if (!el) return
  el.focus({ preventScroll: true })
  if (props.typed !== undefined) {
    el.value = props.typed
    el.dispatchEvent(new Event('input', { bubbles: true }))
  } else if (props.selectAll) el.select()
  else el.setSelectionRange(el.value.length, el.value.length)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', place)
  document.removeEventListener('scroll', place, true)
})
</script>

<template>
  <span ref="anchor" class="smart-table-xta-anchor" />
  <Teleport to="body">
    <div
      ref="box"
      class="smart-table-xta"
      :class="{ 'smart-table-xta--err': invalid }"
      :style="{
        '--smart-table-xl-primary': themeVars.primaryColor,
        '--smart-table-xl-error': themeVars.errorColor,
        boxShadow: themeVars.boxShadow2,
        borderRadius: themeVars.borderRadius,
        background: themeVars.popoverColor,
        left: `${pos.left}px`,
        top: `${pos.top}px`,
        width: `${pos.width}px`,
        visibility: pos.visible ? 'visible' : 'hidden',
      }"
      @click.stop
    >
      <n-input
        type="textarea"
        :value="value"
        :rows="4"
        :resizable="false"
        :placeholder="placeholder"
        :input-props="{ spellcheck: false }"
        @update:value="ctrl.update"
      />
    </div>
  </Teleport>
</template>

<style>
/* Teleport 到 body 的浮层:不能 scoped。盖在单元格上;z-index 2001:高于放大层(默认 1999)和 naive 浮层起点(2000)。阴影 / 圆角 / 底色走主题变量(内联) */
.smart-table-xta {
  position: fixed;
  z-index: 2001;
}
.smart-table-xta-anchor {
  display: none;
}
/* 浮层文本框常亮 1px 主色描边(校验未过时红色),与原型 .xl-pop .n-input.ta 一致 */
.smart-table-xta .n-input .n-input__border,
.smart-table-xta .n-input .n-input__state-border {
  border-color: var(--smart-table-xl-primary);
}
.smart-table-xta--err .n-input .n-input__border,
.smart-table-xta--err .n-input .n-input__state-border {
  border-color: var(--smart-table-xl-error);
}
</style>
