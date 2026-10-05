<script setup lang="ts">
// SmartSelectTable 的面板内容(内部组件):顶部一个搜索框(自动聚焦,前缀放大镜)+ 固定高度的嵌套 SmartTable(fillHeight:虚拟滚动 + 表头吸顶 + 分页)+ 多选时的底部条。
// 搜索:本地数据实时过滤(数据量大于 2000 行时防抖 120ms),远程 fetcher 回车或停手 300ms 后发请求;改搜索词回第 1 页、表体回顶部。
// 键盘:Esc 先清空搜索再关闭;↓ / ↑ 在表格行间移动高亮(滚进视口,虚拟列表里还没渲染的行也行);Enter 选中高亮行(多选 = 确定;
// 搜索框里只剩一行时 Enter 直接选它);Space 勾选 / 取消勾选高亮行(多选)。
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type Component } from 'vue'
import { NButton, NInput, useThemeVars } from 'naive-ui'
import SmartTableImpl from './SmartTable.vue'
import { SearchIcon } from './icons'
import { fmt } from './labels'
import type { PageResult, SmartTableColumn, SmartTableLabels, SmartTableParams } from './types'

const props = defineProps<{
  columns: SmartTableColumn<any>[]
  /** 取一页数据(本地 / 远程已在外面统一成 fetcher 形状);params 里有 keyword。 */
  fetchPage: (p: SmartTableParams) => Promise<PageResult<any>>
  remote: boolean
  /** 本地数据的行数(决定搜索防抖)。 */
  localSize: number
  valueKey: string
  multiple: boolean
  /** 当前值(单选 = 0 或 1 项)。 */
  modelKeys: unknown[]
  /** 本地数据时单选已选行在全部数据里的下标(打开时翻到它所在的页);否则 -1。 */
  activeIndex: number
  /** 行缓存:选过的行(跨页 / 跨搜索保留,触发器据此显示标签)。 */
  cache: Map<unknown, any>
  pageSize: number
  pageSizes?: number[]
  /** 窄屏底部面板:不显示「每页条数」下拉、「共 N 条」放在左下角。 */
  compact?: boolean
  placeholder: string
  defaultKeyword?: string
  labels: Required<SmartTableLabels>
}>()
const emit = defineEmits<{
  pick: [row: any]
  confirm: [keys: unknown[]]
  close: []
}>()

// SmartTable → useEditable → EditableEditor → SmartSelectTable → 本面板 → SmartTable 是一个组件环:运行时没问题(模块内都是延迟求值),
// 但类型推断会在这个环上打转(d.ts 生成报「隐式 any」),所以这里把 SmartTable 当成无类型的 Component 用。
const SmartTable = SmartTableImpl as unknown as Component

type TableInst = {
  revealRow: (i: number) => void
  goPage: (n: number) => Promise<unknown>
  tableRef: { scrollTo: (o: { top: number }) => void } | null
}
/** 面板表格的行高(= SmartTable 的 min-row-height,见模板;CSS 里也固定 36)。 */
const ROW_H = 36
const themeVars = useThemeVars()
const root = ref<HTMLElement | null>(null)
const table = ref<TableInst | null>(null)
const text = ref(props.defaultKeyword ?? '')
const keyword = ref((props.defaultKeyword ?? '').trim())
const hi = ref(-1)
const total = ref(0)
const pageRows = ref<any[]>([])
const draft = ref<unknown[]>(props.multiple ? [...props.modelKeys] : [])

/** 稳定的对象:每次渲染都新建会让嵌套表格的 params 深监听当成变化而反复回第 1 页重查。 */
const tableParams = computed(() => ({ keyword: keyword.value || undefined }))
/** 不传 pageSizes:fillHeight 的内置规则 → [100, 1000, 10000];宿主显式给的优先。 */
const pagination = computed(() => ({
  ...(props.pageSizes ? { pageSizes: props.pageSizes } : {}),
  // 面板自己决定要不要每页条数下拉(不受全局默认影响):窄屏底部面板不要
  showSizePicker: !props.compact,
}))
const tableColumns = computed<SmartTableColumn<any>[]>(() =>
  props.multiple
    ? [{ type: 'selection' } as SmartTableColumn<any>, ...props.columns]
    : props.columns,
)

/** 单选再次打开:把已选行滚进视口(在当前页就直接滚;本地数据在别的页先翻过去)。 */
let pendingReveal = !props.multiple && props.modelKeys.length > 0
let jumped = false
async function revealPicked(items: any[]) {
  pendingReveal = false
  const key = props.modelKeys[0]
  const i = items.findIndex((r) => r[props.valueKey] === key)
  if (i >= 0) {
    await nextTick()
    requestAnimationFrame(() => {
      // 把已选行滚到表体正中(行高固定 = min-row-height 36);表体不够高 / 行靠前时贴边
      const sc = root.value?.querySelector<HTMLElement>('.v-vl')
      if (!sc || !sc.clientHeight) return table.value?.revealRow(i)
      table.value?.tableRef?.scrollTo({
        top: Math.max(0, i * ROW_H - (sc.clientHeight - ROW_H) / 2),
      })
    })
    return
  }
  if (props.activeIndex >= 0 && !jumped) {
    jumped = true
    const page = Math.floor(props.activeIndex / props.pageSize) + 1
    if (page > 1) {
      pendingReveal = true
      await table.value?.goPage(page)
    }
  }
}
async function source(p: SmartTableParams): Promise<PageResult<any>> {
  const r = await props.fetchPage(p)
  for (const row of r.items) props.cache.set(row[props.valueKey], row)
  pageRows.value = r.items
  total.value = r.total
  hi.value = -1
  if (pendingReveal && !keyword.value) void nextTick(() => revealPicked(r.items))
  return r
}

/* ---- 搜索 ---- */
let timer: ReturnType<typeof setTimeout> | undefined
const wait = computed(() => (props.remote ? 300 : props.localSize > 2000 ? 120 : 0))
function apply() {
  clearTimeout(timer)
  keyword.value = text.value.trim()
}
watch(keyword, () => table.value?.tableRef?.scrollTo({ top: 0 }))
function onInput(v: string) {
  text.value = v
  clearTimeout(timer)
  if (wait.value === 0) apply()
  else timer = setTimeout(apply, wait.value)
}
onBeforeUnmount(() => clearTimeout(timer))
/** Esc:有搜索内容先清空(返回 true = 已处理),否则返回 false 由外面关闭。 */
function clearKeyword(): boolean {
  if (!text.value && !keyword.value) return false
  text.value = ''
  apply()
  focusInput()
  return true
}
function focusInput() {
  root.value?.querySelector<HTMLInputElement>('.smart-table-xpick-search input')?.focus()
}
onMounted(async () => {
  await nextTick()
  const el = root.value?.querySelector<HTMLInputElement>('.smart-table-xpick-search input')
  if (!el) return
  el.focus({ preventScroll: true })
  try {
    el.setSelectionRange(el.value.length, el.value.length)
  } catch {
    /* 个别 input 类型不支持选区 */
  }
})

/* ---- 选中 ---- */
const keyOf = (row: any) => row[props.valueKey]
function toggle(row: any) {
  const k = keyOf(row)
  props.cache.set(k, row)
  draft.value = draft.value.includes(k) ? draft.value.filter((x) => x !== k) : [...draft.value, k]
}
function onRow(row: any) {
  if (props.multiple) toggle(row)
  else emit('pick', row)
}
function onChecked(keys: Array<string | number>, rows: any[]) {
  for (const r of rows) if (r) props.cache.set(keyOf(r), r)
  draft.value = keys
}
function confirm() {
  emit('confirm', [...draft.value])
}
const rowProps = (_row: any, index: number) =>
  index === hi.value ? { class: 'smart-table-xpick-hi' } : {}
function setHi(i: number) {
  hi.value = i
  if (i >= 0) table.value?.revealRow(i)
}

function onKeydown(e: KeyboardEvent) {
  if (e.isComposing || e.keyCode === 229) return
  const t = e.target as Element | null
  if (t?.closest?.('.n-pagination')) return // 分页里的跳转输入框 / 条数下拉自己管键盘
  const inSearch = !!t?.closest?.('.smart-table-xpick-search')
  const stop = () => {
    e.preventDefault()
    e.stopPropagation()
  }
  switch (e.key) {
    case 'Escape':
      stop()
      if (!clearKeyword()) emit('close')
      return
    case 'ArrowDown':
      if (!pageRows.value.length) return
      stop()
      setHi(Math.min(hi.value + 1, pageRows.value.length - 1))
      // 单选:焦点留在搜索框(继续打字 / Enter 选高亮行);多选:焦点移到面板,Space 勾选 / Enter 确定
      if (props.multiple) root.value?.focus({ preventScroll: true })
      return
    case 'ArrowUp':
      if (hi.value < 0) return
      stop()
      setHi(hi.value - 1)
      if (hi.value < 0 && props.multiple) focusInput()
      return
    case 'Enter':
      stop()
      if (inSearch) {
        const pending = text.value.trim() !== keyword.value
        apply()
        if (props.multiple) return
        // 单选:有高亮行就选它;否则搜索框里只剩一行(实时过滤已生效)时选那一行
        if (hi.value >= 0 && pageRows.value[hi.value]) emit('pick', pageRows.value[hi.value])
        else if (!pending && total.value === 1 && pageRows.value.length === 1)
          emit('pick', pageRows.value[0])
        return
      }
      if (props.multiple) confirm()
      else if (hi.value >= 0) emit('pick', pageRows.value[hi.value])
      return
    case ' ':
      if (props.multiple && !inSearch && hi.value >= 0) {
        stop()
        toggle(pageRows.value[hi.value])
      }
      return
  }
}

defineExpose({ clearKeyword, focusInput })
</script>

<template>
  <div
    ref="root"
    class="smart-table-xpick"
    tabindex="-1"
    :style="{ '--smart-table-xpick-primary': themeVars.primaryColor }"
    @keydown="onKeydown"
  >
    <div class="smart-table-xpick-search">
      <n-input
        :value="text"
        clearable
        :placeholder="placeholder"
        :input-props="{ spellcheck: false, autocomplete: 'off' }"
        @update:value="onInput"
      >
        <template #prefix>
          <span class="smart-table-xpick-search-icon" :style="{ color: themeVars.textColor3 }"
            ><SearchIcon
          /></span>
        </template>
      </n-input>
    </div>
    <div class="smart-table-xpick-body">
      <SmartTable
        ref="table"
        fill-height
        :columns="tableColumns"
        :fetcher="source"
        :row-key="valueKey"
        :params="tableParams"
        :search="false"
        :toolbar="false"
        :filter="false"
        :default-page-size="pageSize"
        :pagination="pagination"
        :active-row-key="multiple ? undefined : (modelKeys[0] as string | number | undefined)"
        :labels="labels"
        :card-props="{ bordered: false, themeOverrides: { paddingSmall: '0' } }"
        :theme-overrides="{ paginationMargin: '8px 0 0 0' }"
        :checked-row-keys="multiple ? (draft as Array<string | number>) : undefined"
        :row-props="rowProps"
        :min-row-height="ROW_H"
        @update:checked-row-keys="onChecked"
        @row-click="onRow"
      >
        <template v-if="!compact" #pagination-prefix>
          <span :style="{ color: themeVars.textColor2 }">{{
            fmt(labels.pickTotal, { n: total })
          }}</span>
        </template>
      </SmartTable>
      <div
        v-if="compact"
        class="smart-table-xpick-total"
        :style="{ color: themeVars.textColor3 }"
        aria-live="polite"
      >
        {{ fmt(labels.pickTotal, { n: total }) }}
      </div>
    </div>
    <div v-if="multiple" class="smart-table-xpick-foot">
      <span class="smart-table-xpick-count" :style="{ color: themeVars.textColor3 }">{{
        fmt(labels.pickSelected, { n: draft.length })
      }}</span>
      <span class="smart-table-xpick-gap" />
      <n-button size="small" secondary :disabled="!draft.length" @click="draft = []">{{
        labels.pickClearSel
      }}</n-button>
      <n-button size="small" type="primary" @click="confirm">{{ labels.pickOk }}</n-button>
    </div>
  </div>
</template>

<style>
/* 面板 = 气泡里的「卡片」:气泡自带 8px 内边距(NPopover 的 padding 主题变量),里面依次是 搜索框 → 8px → 带细圆角边框的表格盒 → 8px → 页脚(无边框)。
   表格盒的外框 / 圆角 / 格子线全是官方 NDataTable 自己画的(bordered、single-line=false;线色在气泡里取官方的 popover 版本);嵌套表格的卡片内边距与页脚间距走主题变量(见模板);选中行字色 primary */
.smart-table-xpick {
  outline: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
/* 表格区固定高度 = 表格盒 360 + 8 + 页脚 28:表体在盒子里虚拟滚动、表头吸顶 */
.smart-table-xpick-body {
  position: relative;
  height: 396px;
  display: flex;
  flex-direction: column;
}
.smart-table-xpick-body > .smart-table {
  height: 100%;
}
.smart-table-xpick .n-data-table-tbody .n-data-table-tr {
  cursor: pointer;
}
/* 行高固定 36(原型 35.4):虚拟滚动按 min-row-height 估算滚动高度,真实行高必须 ≥ 它,所以不用 35.4 */
.smart-table-xpick .n-data-table-td,
.smart-table-xpick .n-data-table-th {
  height: 36px;
  padding-top: 0;
  padding-bottom: 0;
}
.smart-table-xpick .n-data-table-tr.smart-table-row--active .n-data-table-td {
  color: var(--smart-table-xpick-primary);
  background-color: transparent;
}
.smart-table-xpick .n-data-table-tr:hover .n-data-table-td,
.smart-table-xpick .n-data-table-tr.smart-table-xpick-hi .n-data-table-td {
  background-color: var(--n-merged-td-color-hover);
}
.smart-table-xpick-search-icon {
  display: inline-flex;
  align-items: center;
}
/* 多选的「已选 N 项 / 清空 / 确定」:页脚下面一行,无边框 */
.smart-table-xpick-foot {
  display: flex;
  align-items: center;
  gap: 8px;
}
.smart-table-xpick-gap {
  flex: 1 1 auto;
}
.smart-table-xpick-total {
  position: absolute;
  left: 0;
  bottom: 0;
  font-size: 14px;
  line-height: 28px;
  pointer-events: none;
}
/* 窄屏底部面板:同样的内部结构,没有气泡尖角,12px 内边距 */
.smart-table-xpick-sheet .smart-table-xpick {
  padding: 12px;
}
</style>
