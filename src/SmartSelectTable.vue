<script setup lang="ts">
// 下拉表格选择(独立组件,像 Blazor 的 SelectTable):触发器长得像 NSelect,点开是浮层(窄屏 = 底部抽屉)——
// 一个搜索框 + 嵌套的 SmartTable(分页);单选点一行即选中并关闭,多选勾选 + 「确定」。可单独用在表单里,可编辑表格的 select-table 编辑器也是它。
// 数据:本地 data(实时模糊过滤)或远程 fetcher({ page, pageSize, keyword } → { items, total });选过的行缓存在组件里,多选跨页 / 跨搜索保留。
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { NDrawer, NDrawerContent, NPopover, NSelect } from 'naive-ui'
import SelectTablePanel from './SelectTablePanel.vue'
import { useSmartTableDefaults } from './config'
import { mergeLabels } from './labels'
import { matchKeyword } from './selectTable'
import type {
  PageResult,
  SmartSelectTableEmbedProps,
  SmartSelectTableProps,
  SmartTableParams,
} from './types'

const props = withDefaults(defineProps<SmartSelectTableProps & SmartSelectTableEmbedProps>(), {
  valueKey: 'id',
  multiple: false,
  clearable: false,
  disabled: false,
  maxTagCount: 2,
  panelWidth: 640,
  pageSize: 100,
  pageSizes: undefined,
  bordered: true,
  closeOnOutside: true,
  size: 'medium',
  value: undefined,
})
const emit = defineEmits<{
  'update:value': [value: unknown]
  /** 单选 = 选中的那一行;多选 = 点「确定」时选中的行数组。 */
  pick: [row: any]
  /** 面板关闭(选中 / Esc / 点外面)。 */
  close: []
}>()
defineOptions({ inheritAttrs: false })

const defaults = useSmartTableDefaults()
const labels = computed(() => mergeLabels(props.labels, defaults.labels as never))
const show = ref(false)
const seq = ref(0)
const root = ref<HTMLElement | null>(null)
const panel = ref<InstanceType<typeof SelectTablePanel> | null>(null)
/** 选过 / 加载过的行:valueKey → 行(触发器显示标签、多选跨页保留)。 */
const cache = reactive(new Map<unknown, any>())

const firstKey = computed(() => {
  const c = props.columns.find((x) => 'key' in x && x.key && !('type' in x && x.type))
  return (c as { key?: string } | undefined)?.key ?? 'id'
})
const lKey = computed(() => props.labelKey ?? firstKey.value)

/** 默认被搜索的列:有 key、不是 selection / index / expand、没有自定义 render 的列。 */
const searchFields = computed<string[]>(
  () =>
    props.searchKeys ??
    props.columns
      .filter((c) => {
        const x = c as { key?: string; type?: string; render?: unknown }
        return !!x.key && !x.type && !x.render
      })
      .map((c) => (c as { key: string }).key),
)
const phText = computed(() => {
  if (props.searchPlaceholder) return props.searchPlaceholder
  const titles = searchFields.value.map((k) => {
    const c = props.columns.find((x) => (x as { key?: string }).key === k) as
      { title?: unknown } | undefined
    const t = typeof c?.title === 'function' ? (c.title as () => unknown)() : c?.title
    return typeof t === 'string' && t ? t : k
  })
  return titles.join('/')
})

const textOfRow = (row: any): string =>
  props.renderLabel ? props.renderLabel(row) : String(row[lKey.value] ?? '')
function rowOf(v: unknown): any {
  return cache.get(v) ?? props.data?.find((r: any) => r[props.valueKey] === v)
}
function textOf(v: unknown): string {
  const r = rowOf(v)
  if (r) return textOfRow(r)
  return !props.multiple && props.label != null ? props.label : String(v)
}
const modelKeys = computed<unknown[]>(() => {
  const v = props.value
  if (props.multiple) return Array.isArray(v) ? v : []
  return v == null || v === '' ? [] : [v]
})
/** 单选 + 本地数据:已选行在全部数据里的下标,面板打开时据此翻到它所在的页并滚进视口。 */
const activeIndex = computed(() =>
  !props.multiple && !props.fetcher && props.data && !props.defaultKeyword && modelKeys.value.length
    ? props.data.findIndex((r: any) => r[props.valueKey] === modelKeys.value[0])
    : -1,
)
const options = computed(() =>
  modelKeys.value.map((v) => ({ label: textOf(v), value: v as string | number })),
)
const selectValue = computed(() =>
  props.multiple
    ? (modelKeys.value as Array<string | number>)
    : ((modelKeys.value[0] ?? null) as string | number | null),
)

/** 本地 data:关键词按空白切词、全部命中(每词可命中任一搜索字段);分页由嵌套表格的请求参数决定。 */
async function fetchPage(p: SmartTableParams): Promise<PageResult<any>> {
  if (props.fetcher) return props.fetcher(p)
  const all = props.data ?? []
  const kw = typeof p.keyword === 'string' ? p.keyword : ''
  const hit = kw.trim() ? all.filter((r: any) => matchKeyword(r, searchFields.value, kw)) : all
  const start = (p.page - 1) * p.pageSize
  return { items: hit.slice(start, start + p.pageSize), total: hit.length }
}

/* ---- 窄屏:底部抽屉 ---- */
const narrow = ref(false)
const viewport = ref(1024)
function measure() {
  const w = document.documentElement.clientWidth
  viewport.value = w > 0 ? w : 1024
  narrow.value = w > 0 && w < 600
}
const panelW = computed(() => Math.max(280, Math.min(props.panelWidth, viewport.value - 16)))

/* ---- 打开 / 关闭 / 选中 ---- */
/* 气泡总高(NPopover 内边距 16 + 搜索框 34 + 间距 8 + 表格区 396;多选再加 间距 8 + 页脚 28)与触发器之间的间隙(箭头),都是实测值 */
const POP_H = 454
const POP_H_MULTI = 36
const POP_GAP = 10
const VIEW_EDGE = 8
/** 本次是否用底部面板:窄屏,或视口放不下气泡就不硬塞。水平:触发器左对齐、右对齐都会伸出视口;纵向:触发器下方、上方都放不下整个面板(气泡只会在这两侧翻,没有夹取)。 */
const asSheet = ref(false)
function open() {
  if (props.disabled || show.value) return
  const r = root.value?.getBoundingClientRect()
  const vh = document.documentElement.clientHeight
  const need = POP_H + (props.multiple ? POP_H_MULTI : 0) + POP_GAP + VIEW_EDGE
  const fitsX = !r || r.left + panelW.value <= viewport.value - 8 || r.right - panelW.value >= 8
  const fitsY = !r || !(vh > 0) || vh - r.bottom >= need || r.top >= need
  asSheet.value = narrow.value || !fitsX || !fitsY
  seq.value++
  show.value = true
}
function close() {
  if (!show.value) return
  show.value = false
  emit('close')
}
function onTriggerClick(e: MouseEvent) {
  const t = e.target as Element | null
  if (t?.closest?.('.n-base-close, .n-base-clear')) return // 点标签的 × / 清除图标不开面板
  open()
}
function onOutside(e: MouseEvent) {
  if (!props.closeOnOutside) return
  if (root.value?.contains(e.target as Node)) return
  close()
}
function onPick(row: any) {
  const k = row[props.valueKey]
  cache.set(k, row)
  emit('update:value', k)
  emit('pick', row)
  close()
}
function onConfirm(keys: unknown[]) {
  emit('update:value', keys)
  emit('pick', keys.map((k) => rowOf(k)).filter(Boolean))
  close()
}
function onSelectUpdate(v: unknown) {
  // 触发器上的清除 / 标签 ×
  emit('update:value', props.multiple ? (Array.isArray(v) ? v : []) : (v ?? null))
}
function clearKeyword(): boolean {
  return panel.value?.clearKeyword() ?? false
}
function focus() {
  root.value?.querySelector<HTMLElement>('.n-base-selection')?.focus?.()
}

onMounted(() => {
  measure()
  window.addEventListener('resize', measure)
  if (props.defaultOpen) void nextTick(open)
})
onBeforeUnmount(() => window.removeEventListener('resize', measure))
defineExpose({ open, close, focus, clearKeyword })
</script>

<template>
  <div class="smart-select-table" v-bind="$attrs">
    <n-popover
      :show="show && !asSheet"
      trigger="manual"
      placement="bottom-start"
      show-arrow
      class="smart-table-xpick-pop"
      :theme-overrides="{ padding: '8px' }"
      :on-clickoutside="onOutside"
    >
      <template #trigger>
        <div
          ref="root"
          class="smart-table-xpick-trigger"
          :class="{ 'smart-table-xpick-trigger--open': show }"
          @click="onTriggerClick"
        >
          <n-select
            :value="selectValue"
            :options="options"
            :multiple="multiple"
            :max-tag-count="multiple ? maxTagCount : undefined"
            :placeholder="placeholder ?? labels.editSelectPlaceholder"
            :clearable="clearable"
            :disabled="disabled"
            :size="size"
            :bordered="bordered"
            :show="false"
            :show-arrow="true"
            @update:value="onSelectUpdate"
            @update:show="(v: boolean) => v && open()"
          />
        </div>
      </template>
      <!-- 外宽 = panelW:气泡自带 8px 内边距,内容宽要扣掉两侧 -->
      <div class="smart-table-xpick-wrap" :style="{ width: panelW - 16 + 'px' }">
        <SelectTablePanel
          :key="seq"
          ref="panel"
          :columns="columns"
          :fetch-page="fetchPage"
          :remote="!!fetcher"
          :local-size="data?.length ?? 0"
          :value-key="valueKey"
          :multiple="multiple"
          :model-keys="modelKeys"
          :active-index="activeIndex"
          :cache="cache"
          :page-size="pageSize"
          :page-sizes="pageSizes"
          :placeholder="phText"
          :default-keyword="defaultKeyword"
          :labels="labels"
          @pick="onPick"
          @confirm="onConfirm"
          @close="close"
        />
      </div>
    </n-popover>
    <n-drawer
      :show="show && asSheet"
      placement="bottom"
      height="auto"
      class="smart-table-xpick-sheet"
      style="max-height: 85vh"
      @update:show="(v: boolean) => !v && close()"
    >
      <n-drawer-content
        :title="title"
        closable
        :native-scrollbar="true"
        body-content-style="padding: 0"
      >
        <SelectTablePanel
          v-if="show"
          :key="seq"
          ref="panel"
          :columns="columns"
          :fetch-page="fetchPage"
          :remote="!!fetcher"
          :local-size="data?.length ?? 0"
          :value-key="valueKey"
          :multiple="multiple"
          :model-keys="modelKeys"
          :active-index="activeIndex"
          :cache="cache"
          :page-size="pageSize"
          :page-sizes="pageSizes"
          compact
          :placeholder="phText"
          :default-keyword="defaultKeyword"
          :labels="labels"
          @pick="onPick"
          @confirm="onConfirm"
          @close="close"
        />
      </n-drawer-content>
    </n-drawer>
  </div>
</template>

<style>
.smart-select-table {
  display: block;
  width: 100%;
}
.smart-table-xpick-trigger {
  width: 100%;
}
/* 窄屏底部面板:drawer 高度是 auto,官方 .n-drawer-body 的 flex 基准是 0,body 会塌成 0 高;让它按内容长,超出 85vh 内部滚动 */
.n-drawer.smart-table-xpick-sheet .n-drawer-content .n-drawer-body {
  flex: 1 0 auto !important;
}
</style>
