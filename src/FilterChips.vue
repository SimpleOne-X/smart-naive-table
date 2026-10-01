<script setup lang="ts">
// 已生效条件 chips 行:NTag,超过一行折成「+N」(点它在气泡里展开完整列表);行末「清除全部 / 恢复默认」。
// 折叠个数靠测量:先把全部 chip 渲染出来量 offsetTop(同一帧内完成,不会闪),再按 countFitting 决定显示几个;
// 「+N」渲染出来后自己也占位,若它折到了第二行就再让出一个位置(shrinkForMore),直到稳定;
// 容器宽度变了再量一次(只在宽度变化时重量,否则测量时行高变化会触发死循环)。
// 键盘:chip 是 role="button" tabindex="0",Enter / Space 等同点击;「孤儿」chip(列已不存在)没有面板可开,点击是空操作,× 照常清除。
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type PropType } from 'vue'
import { NButton, NPopover, NTag } from 'naive-ui'
import type { SmartTableLabels } from './types'
import { countFitting, shrinkForMore, type ChipItem } from './filterChips'

const props = defineProps({
  items: { type: Array as PropType<ChipItem[]>, required: true },
  labels: { type: Object as PropType<Required<SmartTableLabels>>, required: true },
  hasDefaults: { type: Boolean, default: false },
})

const emit = defineEmits<{
  open: [key: string]
  remove: [key: string, index: number]
  clear: []
}>()

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
  if (typeof ResizeObserver === 'undefined' || !listRef.value) return
  observer = new ResizeObserver((entries) => {
    const w = Math.round(entries[0]?.contentRect.width ?? 0)
    if (w === lastWidth) return
    lastWidth = w
    void recompute()
  })
  observer.observe(listRef.value)
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div class="smart-table-chips">
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
        @click="openChip(c)"
        @keydown="(e: KeyboardEvent) => onChipKeydown(e, c)"
        @close="emit('remove', c.key, c.index)"
      >
        {{ c.text }}
      </n-tag>
      <n-popover v-if="hidden.length" trigger="click" placement="bottom-start">
        <template #trigger>
          <n-tag class="smart-table-chip smart-table-chip--more" role="button" tabindex="0" round size="small">
            +{{ hidden.length }}
          </n-tag>
        </template>
        <div class="smart-table-chips__more">
          <n-tag
            v-for="c in hidden"
            :key="c.key + ':' + c.index"
            :class="{ 'smart-table-chip--orphan': c.orphan }"
            role="button"
            tabindex="0"
            round
            closable
            size="small"
            @click="openChip(c)"
            @keydown="(e: KeyboardEvent) => onChipKeydown(e, c)"
            @close="emit('remove', c.key, c.index)"
          >
            {{ c.text }}
          </n-tag>
        </div>
      </n-popover>
    </div>
    <n-button class="smart-table-chips__clear" text size="tiny" @click="emit('clear')">
      {{ hasDefaults ? labels.filterRestoreDefault : labels.filterClearAll }}
    </n-button>
  </div>
</template>

<style scoped>
.smart-table-chips {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 0 0 8px;
}
.smart-table-chips__list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  flex: 1 1 auto;
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
  align-self: center;
}
</style>
