<script setup lang="ts">
// 窄档排序抽屉(cardOnNarrow,规格 §5.4 / §5.8):窄档没有表头,排序入口收在工具栏的「排序」按钮里,
// 点开从底部抽屉(官方 NDrawer bottom)列出可排序列,每列一行「无 / 升序 / 降序」分段(官方 NRadioGroup + NRadioButton);
// 行序 = 声明的优先级(sorter.multiple 大者在前),手机上不能改优先级、只能启停各列;改的是草稿,点「确认」才生效。
import { computed, ref, watch, type PropType, type VNodeChild } from 'vue'
import { NButton, NDrawer, NDrawerContent, NRadioButton, NRadioGroup, useThemeVars } from 'naive-ui'
import type { SmartTableLabels, SortItem } from './types'

type Order = 'ascend' | 'descend' | false

const props = defineProps({
  show: { type: Boolean, default: false },
  /** 可排序列,已按优先级排好(sortDrawerRows)。 */
  rows: {
    type: Array as PropType<Array<{ key: string; title?: string | (() => VNodeChild) }>>,
    required: true,
  },
  /** 当前生效的排序态(打开时回填草稿)。 */
  current: { type: Array as PropType<SortItem[]>, required: true },
  labels: { type: Object as PropType<Required<SmartTableLabels>>, required: true },
  /** 改某一列后的下一个排序态(单列互斥 / 多列并存的规则在 sorts.ts 的 sortTransition,由宿主给)。 */
  next: {
    type: Function as PropType<(cur: SortItem[], key: string, order: Order) => SortItem[]>,
    required: true,
  },
})

const emit = defineEmits<{
  'update:show': [v: boolean]
  confirm: [items: SortItem[]]
  /** 「重置」:恢复列声明的默认排序并立即生效、关闭。 */
  reset: []
}>()

// 行间分隔线色 = 主题 dividerColor(与官方抽屉头部 / 底部分隔线同值,明暗各自跟随)。行是库自己的元素,
// 取不到 NDrawer 子树里的 var(--n-*)(NDrawer 本身也不定义 --n-divider-color),所以走 useThemeVars() 再经 :style 绑定。
const themeVars = useThemeVars()
const rowStyle = (i: number) =>
  i > 0 ? { borderTopColor: themeVars.value.dividerColor } : undefined

const draft = ref<SortItem[]>([])
// 每次打开都从当前生效值重新回填(关闭 = 丢弃草稿)
watch(
  () => props.show,
  (open) => {
    if (open) draft.value = props.current.map((s) => ({ ...s }))
  },
  { immediate: true },
)

const orderOf = (key: string): 'none' | 'ascend' | 'descend' =>
  draft.value.find((s) => s.field === key)?.order ?? 'none'
function setOrder(key: string, value: 'none' | 'ascend' | 'descend') {
  draft.value = props.next(draft.value, key, value === 'none' ? false : value)
}
const titleOf = (row: { key: string; title?: string | (() => VNodeChild) }): VNodeChild => {
  const t = typeof row.title === 'function' ? row.title() : row.title
  return t === undefined || t === null || t === '' ? row.key : t
}
const segments = computed(() => [
  { value: 'none' as const, label: props.labels.sortNone },
  { value: 'ascend' as const, label: props.labels.sortAscend },
  { value: 'descend' as const, label: props.labels.sortDescend },
])
</script>

<template>
  <!-- 高度随内容、最高 85vh(同条件构造器的抽屉:官方 .n-drawer-body 在父级高度 auto 时会塌成 0,下面几条 :global 把这一路改成 flex 列) -->
  <n-drawer
    :show="show"
    class="smart-table-sort-drawer"
    placement="bottom"
    height="auto"
    style="max-height: 85vh"
    @update:show="(v: boolean) => emit('update:show', v)"
  >
    <n-drawer-content
      :title="labels.sort"
      closable
      :native-scrollbar="true"
      body-content-style="padding: 0 24px 8px"
      footer-style="border-top: none"
    >
      <div
        v-for="(row, i) in rows"
        :key="row.key"
        class="smart-table-sort-row"
        :style="rowStyle(i)"
      >
        <span class="smart-table-sort-label"><component :is="() => titleOf(row)" /></span>
        <n-radio-group
          size="large"
          :name="`smart-table-sort-${row.key}`"
          :value="orderOf(row.key)"
          :aria-label="String(titleOf(row))"
          @update:value="(v: 'none' | 'ascend' | 'descend') => setOrder(row.key, v)"
        >
          <n-radio-button v-for="seg in segments" :key="seg.value" :value="seg.value">
            {{ seg.label }}
          </n-radio-button>
        </n-radio-group>
      </div>
      <template #footer>
        <div class="smart-table-sort-foot">
          <n-button size="large" secondary @click="emit('reset')">{{
            labels.filterReset
          }}</n-button>
          <n-button size="large" type="primary" @click="emit('confirm', draft)">{{
            labels.filterConfirm
          }}</n-button>
        </div>
      </template>
    </n-drawer-content>
  </n-drawer>
</template>

<style scoped>
/* 每列一行:标签靠左(过长省略)、分段靠右;行间 1px 分隔线(原型 .sd-row,上下 12px 内边距),线色由模板 :style 按主题 dividerColor 写入 */
.smart-table-sort-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 0;
}
.smart-table-sort-row + .smart-table-sort-row {
  border-top: 1px solid;
}
.smart-table-sort-label {
  min-width: 0;
  overflow: hidden;
  font-size: 15px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.smart-table-sort-foot {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  gap: 8px;
}
/* 「重置」靠左,「确认」靠右(原型 .sheet-foot) */
.smart-table-sort-foot > :first-child {
  margin-right: auto;
}
/* 抽屉页脚按钮最小宽 80px(设计 §2.15 B3) */
.smart-table-sort-foot > .n-button {
  min-width: 80px;
}
/* 抽屉高度随内容(最高 85vh):teleport 到 body,拿不到 scoped 属性,用 :global */
:global(.smart-table-sort-drawer) {
  display: flex;
  flex-direction: column;
}
:global(.n-drawer.smart-table-sort-drawer .n-drawer-content-wrapper) {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
:global(.n-drawer.smart-table-sort-drawer .n-drawer-content) {
  min-height: 0;
}
:global(.n-drawer.smart-table-sort-drawer .n-drawer-content .n-drawer-body) {
  flex: 1 1 auto;
  min-height: 0;
}
</style>
