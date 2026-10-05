<script setup lang="ts">
// 模式 2 的条件构造器(工具栏里的一行):宽 / 中档「字段 + 比较符 + 值 + » + 搜索 + 重置」,点 » 展开多条件气泡;
// 窄档(< 600)「输入框 + 筛选」,点「筛选」从底部抽屉展开同一份多条件面板。
// 草稿由 SmartTable 持有(主行 = 草稿第 1 行,气泡 / 抽屉里改的是同一份),点「搜索」/「确认」才提交;Esc / 点外部只收起面板,草稿保留。
import { computed, nextTick, ref, watch, type PropType } from 'vue'
import {
  NButton,
  NDrawer,
  NDrawerContent,
  NPopover,
  NSelect,
  NTooltip,
  useThemeVars,
} from 'naive-ui'
import type { FilterAction, SmartTableLabels, SmartTableOption } from './types'
import { actionValueKind } from './filter'
import { fmt } from './labels'
import { filterDefTitle, type FilterDef } from './useColumns'
import { MoreConditionsIcon, PlusIcon } from './icons'
import { loopTab } from './maximize'
import {
  MAX_BUILDER_ROWS,
  addRow,
  setRowAction,
  setRowField,
  setRowValue,
  type BuilderDraft,
} from './conditionBuilder'
import ConditionRow from './ConditionRow.vue'
import ConditionPanel from './ConditionPanel.vue'

const props = defineProps({
  fields: { type: Array as PropType<FilterDef[]>, required: true },
  draft: { type: Object as PropType<BuilderDraft>, required: true },
  labels: { type: Object as PropType<Required<SmartTableLabels>>, required: true },
  getOptions: { type: Function as PropType<(key: string) => SmartTableOption[]>, required: true },
  isLoadingOptions: { type: Function as PropType<(key: string) => boolean>, required: true },
  dateValueFormat: { type: String, default: 'yyyy-MM-dd' },
  /** 容器宽档位(SmartTable 按根元素宽度算):窄 < 600、中 < 1280、宽 ≥ 1280。 */
  tier: { type: String as PropType<'narrow' | 'mid' | 'wide'>, default: 'wide' },
  loading: { type: Boolean, default: false },
  /** 已生效的构造器条件数(来自过滤态):» / 「筛选」的角标。 */
  appliedCount: { type: Number, default: 0 },
  /** 每次变大 = 请求打开多条件面板(已生效条件 chips 点击时用)。 */
  openRequest: { type: Number, default: 0 },
})

const emit = defineEmits<{
  'update:draft': [d: BuilderDraft]
  search: []
  reset: []
}>()

const themeVars = useThemeVars()
const update = (d: BuilderDraft) => emit('update:draft', d)

const narrow = computed(() => props.tier === 'narrow')
const main = computed(() => props.draft.rows[0])
const mainDef = computed(
  () => props.fields.find((f) => f.key === main.value?.field) ?? props.fields[0],
)
const mainCond = computed(() => ({
  action: main.value?.action ?? 'equal',
  value: main.value?.value ?? null,
}))
const fieldOptions = computed(() =>
  props.fields.map((f) => ({ label: filterDefTitle(f), value: f.key })),
)
// 窄档输入框的占位:「搜索 {当前字段名}」(渲染期求值,切语言即时生效)
const narrowPlaceholder = computed(() =>
  fmt(props.labels.searchBy, { field: mainDef.value ? filterDefTitle(mainDef.value) : '' }),
)

/* ---- 面板开合 / 键盘 ---- */

const panelOpen = ref(false)
const panelRef = ref<HTMLElement | null>(null)
const moreBtnRef = ref<{ $el?: HTMLElement } | null>(null)
const dropdownOpen = ref(false)

watch(
  () => props.openRequest,
  (n, o) => {
    if (n > 0 && n !== o) panelOpen.value = true
  },
)
// 弹层内容挂载(每次打开都重新挂载,且是 teleport 出去的)后再把焦点移到第一个可编辑控件
watch(panelRef, (el) => {
  if (el && panelOpen.value)
    void nextTick(() =>
      el.querySelector<HTMLElement>('input, button, [tabindex]:not([tabindex="-1"])')?.focus(),
    )
})
watch(panelOpen, (o) => {
  if (!o) dropdownOpen.value = false
})

function closePanel(focusBack: boolean) {
  panelOpen.value = false
  if (focusBack) void nextTick(() => moreBtnRef.value?.$el?.focus())
}
function togglePanel() {
  if (panelOpen.value) closePanel(false)
  else panelOpen.value = true
}
/** 气泡里的键盘:Esc —— 有下拉展开就放行(下拉自己收,不然草稿跟着面板一起丢了),否则收起面板;Tab 在面板内循环。捕获阶段,理由同列头面板。 */
function onPanelKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (dropdownOpen.value) return
    e.stopPropagation()
    closePanel(true)
    return
  }
  if (panelRef.value) loopTab(e, panelRef.value)
}
/** 焦点还在主行 / » 按钮上时(面板开着)按 Esc 也要能收起。 */
function onMainKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape' || !panelOpen.value || dropdownOpen.value) return
  e.stopPropagation()
  closePanel(true)
}

function onSearch() {
  closePanel(false)
  emit('search')
}
function onReset() {
  closePanel(false)
  emit('reset')
}

/** 窄档:枚举类字段(标量)选完即生效(窄档没有「搜索」按钮,枚举也没有回车可按);其余靠回车。 */
function onNarrowValue(v: unknown) {
  update(setRowValue(props.draft, 0, v))
  if (mainDef.value?.type === 'select' && actionValueKind(mainCond.value.action) === 'scalar')
    emit('search')
}
</script>

<template>
  <div class="smart-table-cond" :class="`smart-table-cond--${tier}`" @keydown="onMainKeydown">
    <!-- 窄档:输入框 + 筛选 -->
    <template v-if="narrow">
      <ConditionRow
        v-if="mainDef"
        class="smart-table-cond__narrow-input"
        value-only
        search-icon
        size="large"
        :def="mainDef"
        :condition="mainCond"
        :labels="labels"
        :get-options="getOptions"
        :is-loading-options="isLoadingOptions"
        :date-value-format="dateValueFormat"
        :placeholder="narrowPlaceholder"
        @update:value="onNarrowValue"
        @enter="onSearch"
      />
      <span class="smart-table-cond__more">
        <n-button
          ref="moreBtnRef"
          size="large"
          aria-haspopup="dialog"
          :aria-expanded="panelOpen"
          @click="togglePanel"
          >{{ labels.filter }}</n-button
        >
        <span
          v-if="appliedCount > 0"
          class="smart-table-cond__badge"
          :style="{ background: themeVars.primaryColor, color: themeVars.baseColor }"
          >{{ appliedCount }}</span
        >
      </span>
      <!-- 高度随内容、最高 85vh(条件再多也不顶出视口,中间正文滚动):NDrawer 的 style 并进 .n-drawer 本体 -->
      <n-drawer
        v-model:show="panelOpen"
        class="smart-table-cond__drawer"
        placement="bottom"
        height="auto"
        style="max-height: 85vh"
      >
        <!-- 正文内边距:每条条件块自己带 16px 的上内边距(原型 .sb),所以这里只留左右 24 与底部 8 -->
        <n-drawer-content
          :title="labels.filter"
          closable
          :native-scrollbar="true"
          body-content-style="padding: 0 24px 8px"
        >
          <ConditionPanel
            stack
            size="large"
            :fields="fields"
            :draft="draft"
            :labels="labels"
            :get-options="getOptions"
            :is-loading-options="isLoadingOptions"
            :date-value-format="dateValueFormat"
            @update:draft="update"
            @confirm="onSearch"
            @reset="onReset"
            @dropdown="(o: boolean) => (dropdownOpen = o)"
          />
          <template #footer>
            <div class="smart-table-cond__drawer-foot">
              <n-button
                quaternary
                size="large"
                :disabled="draft.rows.length >= MAX_BUILDER_ROWS"
                @click="update(addRow(draft, fields))"
              >
                <template #icon><PlusIcon /></template>
                {{ labels.filterAddCondition }}
              </n-button>
              <n-button size="large" @click="onReset">{{ labels.filterReset }}</n-button>
              <n-button size="large" type="primary" @click="onSearch">{{
                labels.filterConfirm
              }}</n-button>
            </div>
          </template>
        </n-drawer-content>
      </n-drawer>
    </template>

    <!-- 宽 / 中档:字段 + 比较符 + 值 + » + 搜索 + 重置;气泡锚在整行(左对齐、在下方) -->
    <n-popover
      v-else
      :show="panelOpen"
      trigger="manual"
      placement="bottom-start"
      :show-arrow="false"
      raw
      style="box-shadow: none"
      @clickoutside="closePanel(false)"
    >
      <template #trigger>
        <div class="smart-table-cond__main">
          <ConditionRow
            v-if="mainDef"
            class="smart-table-cond__row"
            size="medium"
            search-icon
            :lead="null"
            :def="mainDef"
            :condition="mainCond"
            :labels="labels"
            :get-options="getOptions"
            :is-loading-options="isLoadingOptions"
            :date-value-format="dateValueFormat"
            @update:action="(a: FilterAction) => update(setRowAction(draft, 0, a))"
            @update:value="(v: unknown) => update(setRowValue(draft, 0, v))"
            @enter="onSearch"
          >
            <template #field>
              <n-select
                class="smart-table-cond__field"
                size="medium"
                :value="main?.field"
                :options="fieldOptions"
                :consistent-menu-width="false"
                @update:value="(f: string) => update(setRowField(draft, 0, f, fields))"
              />
            </template>
          </ConditionRow>
          <span class="smart-table-cond__more">
            <n-tooltip trigger="hover" :disabled="panelOpen">
              <template #trigger>
                <n-button
                  ref="moreBtnRef"
                  quaternary
                  circle
                  size="small"
                  :theme-overrides="{ iconSizeSmall: '16px' }"
                  :aria-label="labels.searchMoreConditions"
                  aria-haspopup="dialog"
                  :aria-expanded="panelOpen"
                  @click="togglePanel"
                >
                  <template #icon><MoreConditionsIcon /></template>
                </n-button>
              </template>
              {{ labels.searchMoreConditions }}
            </n-tooltip>
            <span
              v-if="appliedCount > 1"
              class="smart-table-cond__badge"
              :style="{ background: themeVars.primaryColor, color: themeVars.baseColor }"
              >{{ appliedCount }}</span
            >
          </span>
          <n-button class="smart-table-cond__search" :loading="loading" @click="onSearch">{{
            labels.search
          }}</n-button>
          <n-button quaternary @click="onReset">{{ labels.reset }}</n-button>
        </div>
      </template>

      <!-- 面板:底色 / 圆角 / 阴影取官方弹层变量(见 style 里 .smart-table-cond__popover,与列头面板同一套);
           外壳的 box-shadow 关掉,只留面板这一份(raw 不去官方阴影)。role=dialog + tabindex=-1,点空白处焦点落在容器,Esc 仍生效 -->
      <div
        ref="panelRef"
        class="smart-table-cond__popover"
        role="dialog"
        tabindex="-1"
        :aria-label="labels.searchMoreConditions"
        @keydown.capture="onPanelKeydown"
      >
        <ConditionPanel
          size="small"
          :fields="fields"
          :draft="draft"
          :labels="labels"
          :get-options="getOptions"
          :is-loading-options="isLoadingOptions"
          :date-value-format="dateValueFormat"
          @update:draft="update"
          @confirm="onSearch"
          @reset="onReset"
          @dropdown="(o: boolean) => (dropdownOpen = o)"
        />
      </div>
    </n-popover>
  </div>
</template>

<style scoped>
.smart-table-cond {
  min-width: 0;
}
.smart-table-cond__main {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.smart-table-cond__field {
  flex: 0 0 136px;
  width: 136px;
}
/* 主行:ConditionRow 的根节点退场(display: contents),它的格子(字段插槽 / 比较符 / 值)直接是这一行 flex 的子项:
   字段 136 · 比较符 112 · 值弹性(最小 100px:宽档 1:1 的最窄点,整行 1280,左半区 609px,值框只剩约 114px)(设计原型 .cond) */
.smart-table-cond__main > .smart-table-cond__row {
  display: contents;
}
.smart-table-cond__main :deep(.smart-table-filter-action) {
  flex: 0 0 112px;
  width: 112px;
}
.smart-table-cond__main :deep(.smart-table-filter-value) {
  flex: 1 1 100px;
  min-width: 100px;
}
.smart-table-cond__main > :deep(.n-button),
.smart-table-cond__more {
  flex: none;
}
/* 「搜索」按钮进 / 出 loading 时宽度不变:官方 loading 会塞一个 16px + 6px 间距的转圈槽(.n-button__icon)撑宽按钮,
   退出时它再走 width 过渡收回,按钮逐帧变窄,同排 flex: 1 的值输入框被动跟着变宽(issue #5)。
   所以让转圈槽脱离文档流、居中盖在按钮上,loading 期间文字淡出给它让位(进出各 .2s 交叉淡入淡出);
   max-width 钉死,官方进出场过渡改 max-width 的动画就不会把转圈槽裁掉。点击拦截 / 无障碍状态仍是官方 loading 的。 */
.smart-table-cond__search.n-button :deep(.n-button__icon) {
  position: absolute;
  top: 50%;
  left: 50%;
  margin: 0;
  max-width: var(--n-icon-size) !important;
  transform: translate(-50%, -50%);
}
.smart-table-cond__search.n-button :deep(.n-button__content) {
  transition: opacity 0.2s var(--n-bezier);
}
.smart-table-cond__search.n-button--loading :deep(.n-button__content) {
  opacity: 0;
}
.smart-table-cond__more {
  position: relative;
  display: inline-flex;
}
.smart-table-cond__badge {
  position: absolute;
  top: -3px;
  right: -3px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  box-sizing: border-box;
  border-radius: 8px;
  font-size: 11px;
  line-height: 16px;
  text-align: center;
  pointer-events: none;
}
.smart-table-cond__popover {
  background-color: var(--n-color);
  border-radius: var(--n-border-radius);
  box-shadow: var(--n-box-shadow);
  color: var(--n-text-color);
  box-sizing: border-box;
  position: relative;
  top: 2px; /* NPopover 距触发器 6px(外壳自带的 margin,我们的 margin-top 会与它折叠、不生效),原型是 8px(.cond-panel top: calc(100% + 8px)) */
  width: min(660px, calc(100vw - 16px));
  padding: 14px;
  text-align: left;
  font-weight: normal;
}
.smart-table-cond__popover:focus {
  outline: none;
}
/* 抽屉高度随内容(最高 85vh):官方 .n-drawer-body 是 flex: 1 0 0 + overflow: hidden,父级高度 auto 时它塌成 0;
   把 NDrawer 本体到正文这一路都改成 flex 列、正文 flex: 1 1 auto + min-height: 0,内容少时撑开、多时在 max-height 内由正文自己滚 */
/* NDrawer 是 teleport 到 body 的,拿不到本组件的 scoped 属性,所以这几条用 :global */
:global(.smart-table-cond__drawer) {
  display: flex;
  flex-direction: column;
}
:global(.n-drawer.smart-table-cond__drawer .n-drawer-content-wrapper) {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
:global(.n-drawer.smart-table-cond__drawer .n-drawer-content) {
  min-height: 0;
}
:global(.n-drawer.smart-table-cond__drawer .n-drawer-content .n-drawer-body) {
  flex: 1 1 auto;
  min-height: 0;
}
/* 抽屉页脚:「添加条件」靠左,重置 / 确认靠右(设计原型 .sheet-foot) */
.smart-table-cond__drawer-foot {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  gap: 8px;
}
.smart-table-cond__drawer-foot > :first-child {
  margin-right: auto;
}
/* 窄档:输入框占满,「筛选」在右 */
.smart-table-cond--narrow {
  display: flex;
  align-items: center;
  gap: 8px;
}
.smart-table-cond__narrow-input {
  flex: 1 1 0;
  min-width: 0;
}
</style>
