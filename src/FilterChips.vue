<script setup lang="ts">
// 已生效条件 chips 行:NTag,超过一行折成「+N」(点它在气泡里展开完整列表);行末「清除全部 / 恢复默认」。
// 折叠个数靠测量:先把全部 chip 渲染出来量 offsetTop(同一帧内完成,不会闪),再按 countFitting 决定显示几个;
// 「+N」渲染出来后自己也占位,若它折到了第二行就再让出一个位置(shrinkForMore),直到稳定;
// 容器宽度变了再量一次(只在宽度变化时重量,否则测量时行高变化会触发死循环)。
// 盯的是行容器 .smart-table-chips(块级、宽度跟着父级走),不是列表:列表是 flex: 0 1 auto、按内容收缩,
// 折成「+N」后视口再变宽,列表自己的宽度不变,盯着它的 ResizeObserver 不会触发,折起来的 chip 就回不来了(final review fix)。
// 键盘:chip 是 role="button" tabindex="0",Enter / Space 等同点击;「孤儿」chip(列已不存在)没有面板可开,点击是空操作,× 照常清除。
// 外观(设计原型 .chips / .chip):主色可点的 NTag small(22px 高)、间距 8px 12px、行下方 12px、「清除全部」紧跟在 chips 后面;孤儿 chip 与「+N」保持默认灰。
// 「+N」键盘可开(Fix round 1):NPopover 的 trigger="click" 只认真实 click 事件(naive-ui 源码
// popover/src/Popover.mjs 的 click 分支只挂 onClick),role="button" 的 div 上按 Enter / Space
// 浏览器不会自动转成 click —— 这里改成受控 show(v-model:show),键盘直接翻状态而不是伪造 click。
// 打开后把焦点移到气泡内第一个 chip,让 Tab 能从那里继续走完剩下的隐藏 chip(与 ColumnFilter.vue
// 的 focusFirst 同一套思路:panelRef 从 null 变非 null 时聚焦,因为内容是 displayDirective="if" 的
// teleport 内容,show 变 true 的那一刻还不在 DOM 里)。
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type PropType } from 'vue'
import { NButton, NPopover, NTag } from 'naive-ui'
import type { SmartTableLabels } from './types'
import { countFitting, shrinkForMore, type ChipItem } from './filterChips'

const props = defineProps({
  items: { type: Array as PropType<ChipItem[]>, required: true },
  labels: { type: Object as PropType<Required<SmartTableLabels>>, required: true },
  hasDefaults: { type: Boolean, default: false },
  /** 当前过滤态已经等于各列声明的默认值(有默认值的表上,此时不需要「恢复默认」)。 */
  atDefaults: { type: Boolean, default: false },
})

// 行末按钮出现的规则(原型一致):有默认值的表 = 偏离默认才出现「恢复默认」(1 个 chip 也出现);没有默认值的表 = ≥ 2 个 chip 才出现「清除全部」
const showAction = computed(() => (props.hasDefaults ? !props.atDefaults : props.items.length > 1))

const emit = defineEmits<{
  open: [key: string]
  remove: [key: string, index: number]
  clear: []
}>()

const rowRef = ref<HTMLElement | null>(null)
const listRef = ref<HTMLElement | null>(null)
const visible = ref(Number.POSITIVE_INFINITY)
const measuring = ref(true)
const shown = computed(() => (measuring.value ? props.items : props.items.slice(0, visible.value)))
const hidden = computed(() => props.items.slice(shown.value.length))

function openChip(c: ChipItem) {
  if (!c.orphan) emit('open', c.key)
}
function onChipKeydown(e: KeyboardEvent, c: ChipItem) {
  // 只处理 chip 自己收到的按键:× 上的 Enter / Space 不能被当成「打开面板」
  if (e.target !== e.currentTarget) return
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    openChip(c)
  }
}

/* ---- 「+N」气泡:受控 show,键盘可开,开启后聚焦气泡内第一个 chip ---- */

const moreOpen = ref(false)
const moreContentRef = ref<HTMLElement | null>(null)

function onMoreKeydown(e: KeyboardEvent) {
  if (e.target !== e.currentTarget) return
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    moreOpen.value = true
  }
}

watch(moreContentRef, (el) => {
  if (el && moreOpen.value) void nextTick(() => el.querySelector<HTMLElement>('.smart-table-chip')?.focus())
})

async function recompute() {
  measuring.value = true
  await nextTick()
  const chips = Array.from(listRef.value?.children ?? []).filter((el): el is HTMLElement =>
    el.classList.contains('smart-table-chip'),
  )
  let n = chips.length ? countFitting(chips.map((el) => el.offsetTop)) : props.items.length
  visible.value = n
  measuring.value = false
  // 「+N」自己也占位:它折到了第二行就再让出一个位置,直到放得下;让到 0 = 只显示 +N(F10)
  while (n > 0 && n < props.items.length) {
    await nextTick()
    const more = listRef.value?.querySelector<HTMLElement>('.smart-table-chip--more')
    const first = listRef.value?.querySelector<HTMLElement>('.smart-table-chip:not(.smart-table-chip--more)')
    if (!more || !first) break
    const next = shrinkForMore(n, first.offsetTop, more.offsetTop)
    if (next === n) break
    n = next
    visible.value = n
  }
}

watch(() => props.items.map((i) => `${i.key}:${i.index}:${i.text}`).join('|'), recompute, { flush: 'post' })

let observer: ResizeObserver | null = null
let lastWidth = -1
onMounted(() => {
  void recompute()
  if (typeof ResizeObserver === 'undefined' || !rowRef.value) return
  observer = new ResizeObserver((entries) => {
    const w = Math.round(entries[0]?.contentRect.width ?? 0)
    if (w === lastWidth) return
    lastWidth = w
    void recompute()
  })
  observer.observe(rowRef.value)
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div ref="rowRef" class="smart-table-chips">
    <div ref="listRef" class="smart-table-chips__list">
      <n-tag
        v-for="c in shown"
        :key="c.key + ':' + c.index"
        class="smart-table-chip"
        :class="{ 'smart-table-chip--orphan': c.orphan }"
        role="button"
        tabindex="0"
        round
        closable
        size="small"
        :type="c.orphan ? 'default' : 'primary'"
        @click="openChip(c)"
        @keydown="(e: KeyboardEvent) => onChipKeydown(e, c)"
        @close="emit('remove', c.key, c.index)"
      >
        {{ c.text }}
      </n-tag>
      <n-popover v-if="hidden.length" v-model:show="moreOpen" trigger="click" placement="bottom-start">
        <template #trigger>
          <n-tag
            class="smart-table-chip smart-table-chip--more"
            role="button"
            tabindex="0"
            round
            size="small"
            @keydown="onMoreKeydown"
          >
            +{{ hidden.length }}
          </n-tag>
        </template>
        <div ref="moreContentRef" class="smart-table-chips__more">
          <n-tag
            v-for="c in hidden"
            :key="c.key + ':' + c.index"
            class="smart-table-chip"
            :class="{ 'smart-table-chip--orphan': c.orphan }"
            role="button"
            tabindex="0"
            round
            closable
            size="small"
            :type="c.orphan ? 'default' : 'primary'"
            @click="openChip(c)"
            @keydown="(e: KeyboardEvent) => onChipKeydown(e, c)"
            @close="emit('remove', c.key, c.index)"
          >
            {{ c.text }}
          </n-tag>
        </div>
      </n-popover>
    </div>
    <n-button v-if="showAction" class="smart-table-chips__clear" text size="tiny" @click="emit('clear')">
      {{ hasDefaults ? labels.filterRestoreDefault : labels.filterClearAll }}
    </n-button>
  </div>
</template>

<style scoped>
/* 清除按钮紧跟在 chips 后面(原型是同一个 wrap 行里的下一个元素);list 按内容收缩而不是撑满,放不下时 chips 在 list 里折行(测量用),
   最终显示的是一行 + 「+N」。行与表格之间 12px。 */
.smart-table-chips {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.smart-table-chips__list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  flex: 0 1 auto;
  min-width: 0;
}
.smart-table-chip {
  cursor: pointer;
}
/* 孤儿 chip 没有面板可开:光标不给「可点」的暗示 */
.smart-table-chip--orphan {
  cursor: default;
}
.smart-table-chips__more {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  max-width: 320px;
}
.smart-table-chips__clear {
  flex: none;
  /* 官方文字按钮没有固定高度和内边距(--n-height 是 initial):与 chip 同高 22px、左右内边距 4px(原型 .chips .clear) */
  height: 22px;
  padding: 0 4px;
}
</style>
