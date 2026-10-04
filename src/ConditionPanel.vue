<script setup lang="ts">
// 模式 2 条件构造器的多条件面板内容:气泡(宽 / 中档)与底部抽屉(窄档)共用同一份,只换容器、换排布(stack)。
// 受控:草稿由 SmartTable 持有(与工具栏主行共用,第 1 行就是主行),这里只发事件。
// 每行直接复用列头面板的 ConditionRow(引导列「条件」/ 且或下拉 + 比较符 + 值 + 删除),字段下拉经它的 #field 插槽放进同一排:
// ConditionRow 的根节点在这里改成 5 列网格 [引导 64 | 字段 | 比较符 | 值 1.5fr | 删除 28](设计原型 .cond-panel .row),字段插槽正好是第 2 格。
// 抽屉(stack):每条一块 —— 头(「条件 N」+ 同字段的且 / 或 + 删除),下面是 [字段 | 比较符] 两列、值整行(设计原型 .sb)。
import { computed, reactive, watch, type PropType } from 'vue'
import { NButton, NSelect, useThemeVars } from 'naive-ui'
import type { FilterAction, FilterLogic, SmartTableLabels, SmartTableOption } from './types'
import { filterDefTitle, type FilterDef } from './useColumns'
import { fmt } from './labels'
import { CloseIcon, PlusIcon } from './icons'
import ConditionRow from './ConditionRow.vue'
import {
  MAX_BUILDER_ROWS,
  addRow,
  removeRow,
  rowLead,
  setFieldLogic,
  setRowAction,
  setRowField,
  setRowValue,
  type BuilderDraft,
} from './conditionBuilder'

const props = defineProps({
  fields: { type: Array as PropType<FilterDef[]>, required: true },
  draft: { type: Object as PropType<BuilderDraft>, required: true },
  labels: { type: Object as PropType<Required<SmartTableLabels>>, required: true },
  getOptions: { type: Function as PropType<(key: string) => SmartTableOption[]>, required: true },
  isLoadingOptions: { type: Function as PropType<(key: string) => boolean>, required: true },
  dateValueFormat: { type: String, default: 'yyyy-MM-dd' },
  /** 抽屉排布:每条一块纵向堆叠;页脚(添加 / 重置 / 确认)由抽屉容器自己放在 NDrawerContent 的 #footer 里。 */
  stack: { type: Boolean, default: false },
  size: { type: String as PropType<'small' | 'medium' | 'large'>, default: 'small' },
})

const emit = defineEmits<{
  'update:draft': [d: BuilderDraft]
  confirm: []
  reset: []
  /** 面板里有 NSelect / NDatePicker 的下拉展开(true)/ 全部收起(false):外层据此区分 Esc 是「收下拉」还是「关面板」。 */
  dropdown: [open: boolean]
}>()

const themeVars = useThemeVars()
const update = (d: BuilderDraft) => emit('update:draft', d)

const fieldOptions = computed(() =>
  props.fields.map((f) => ({ label: filterDefTitle(f), value: f.key })),
)
const logicOptions = computed(() => [
  { label: props.labels.filterLogicAnd, value: 'and' },
  { label: props.labels.filterLogicOr, value: 'or' },
])
const defOf = (field: string) => props.fields.find((f) => f.key === field)
/** 跨字段的后续行,引导格是固定的「且」(同字段才有且 / 或下拉);其余交给 ConditionRow 按行号决定(第 0 行「条件」、之后是下拉)。 */
const fixedLead = (i: number) =>
  rowLead(props.draft, i) === 'and' ? props.labels.filterLogicAnd : undefined

// 下拉展开计数(每行有字段 / 且或 / 比较符 / 值多个下拉):用 Set 记「哪一行的哪个下拉」,面板里任何一个展开就算展开
const open = reactive(new Set<string>())
const markOpen = (id: string, isOpen: boolean) => (isOpen ? open.add(id) : open.delete(id))
watch(
  () => open.size > 0,
  (v) => emit('dropdown', v),
)
// 删行 / 行序变了:旧的展开记录作废(该行上的下拉随行一起卸载)
function onRemove(i: number) {
  open.clear()
  update(removeRow(props.draft, i, props.fields))
}
</script>

<template>
  <div class="smart-table-cond-panel" :class="{ 'smart-table-cond-panel--stack': stack }">
    <div class="smart-table-cond-panel__rows">
      <template v-for="(row, i) in draft.rows" :key="i">
        <!-- 气泡 / 中宽档:一行 5 格 -->
        <ConditionRow
          v-if="!stack && defOf(row.field)"
          class="smart-table-cond-panel__row"
          search-icon
          :index="i"
          :logic="draft.logic[row.field] ?? 'and'"
          :lead="fixedLead(i)"
          :def="defOf(row.field)!"
          :condition="{ action: row.action, value: row.value }"
          :labels="labels"
          :get-options="getOptions"
          :is-loading-options="isLoadingOptions"
          :date-value-format="dateValueFormat"
          :removable="draft.rows.length > 1"
          :size="size"
          @update:action="(a: FilterAction) => update(setRowAction(draft, i, a))"
          @update:value="(v: unknown) => update(setRowValue(draft, i, v))"
          @update:logic="(l: FilterLogic) => update(setFieldLogic(draft, row.field, l))"
          @remove="onRemove(i)"
          @enter="emit('confirm')"
          @dropdown="(o: boolean) => markOpen(`r${i}`, o)"
        >
          <template #field>
            <n-select
              class="smart-table-cond-panel__field"
              :size="size"
              :value="row.field"
              :options="fieldOptions"
              :consistent-menu-width="false"
              @update:value="(f: string) => update(setRowField(draft, i, f, fields))"
              @update:show="(o: boolean) => markOpen(`f${i}`, o)"
            />
          </template>
        </ConditionRow>

        <!-- 抽屉:每条一块 -->
        <div
          v-else-if="stack && defOf(row.field)"
          class="smart-table-cond-panel__block"
          :style="{ borderTopColor: themeVars.dividerColor }"
        >
          <div class="smart-table-cond-panel__block-head" :style="{ color: themeVars.textColor2 }">
            <span>{{ fmt(labels.searchConditionN, { n: i + 1 }) }}</span>
            <n-select
              v-if="rowLead(draft, i) === 'logic'"
              class="smart-table-cond-panel__logic"
              :size="size"
              :value="draft.logic[row.field] ?? 'and'"
              :options="logicOptions"
              :consistent-menu-width="false"
              @update:value="(l: FilterLogic) => update(setFieldLogic(draft, row.field, l))"
              @update:show="(o: boolean) => markOpen(`l${i}`, o)"
            />
            <n-button
              v-if="draft.rows.length > 1"
              quaternary
              :size="size"
              :aria-label="labels.filterRemoveCondition"
              @click="onRemove(i)"
            >
              <template #icon><CloseIcon /></template>
            </n-button>
          </div>
          <ConditionRow
            class="smart-table-cond-panel__body"
            search-icon
            :lead="null"
            :removable="false"
            :def="defOf(row.field)!"
            :condition="{ action: row.action, value: row.value }"
            :labels="labels"
            :get-options="getOptions"
            :is-loading-options="isLoadingOptions"
            :date-value-format="dateValueFormat"
            :size="size"
            @update:action="(a: FilterAction) => update(setRowAction(draft, i, a))"
            @update:value="(v: unknown) => update(setRowValue(draft, i, v))"
            @enter="emit('confirm')"
            @dropdown="(o: boolean) => markOpen(`r${i}`, o)"
          >
            <template #field>
              <n-select
                :size="size"
                :value="row.field"
                :options="fieldOptions"
                :consistent-menu-width="false"
                @update:value="(f: string) => update(setRowField(draft, i, f, fields))"
                @update:show="(o: boolean) => markOpen(`f${i}`, o)"
              />
            </template>
          </ConditionRow>
        </div>
      </template>
    </div>
    <div
      v-if="!stack"
      class="smart-table-cond-panel__footer"
      :style="{ borderTop: `1px solid ${themeVars.dividerColor}` }"
    >
      <!-- 原型 .panel-foot:「添加条件」「重置」是无边框的次级按钮(quaternary),「确认」是默认描边(主色实心留给宿主的「新增」) -->
      <n-button
        quaternary
        :size="size"
        :disabled="draft.rows.length >= MAX_BUILDER_ROWS"
        :theme-overrides="{ iconSizeSmall: '13px' }"
        @click="update(addRow(draft, fields))"
      >
        <template #icon><PlusIcon /></template>
        {{ labels.filterAddCondition }}
      </n-button>
      <div class="smart-table-cond-panel__actions">
        <n-button quaternary :size="size" @click="emit('reset')">{{ labels.filterReset }}</n-button>
        <n-button :size="size" @click="emit('confirm')">{{ labels.filterConfirm }}</n-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.smart-table-cond-panel__rows {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
/* 气泡:覆盖 ConditionRow 自己的 4 列网格(56 / 112 / 1fr / 28)——字段插槽多出一格,变成 5 列 */
.smart-table-cond-panel__rows > :deep(.smart-table-cond-panel__row) {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.5fr) 28px;
  align-items: center;
  gap: 8px;
}
.smart-table-cond-panel__field {
  min-width: 0;
}
.smart-table-cond-panel__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 10px;
  padding-top: 12px;
}
.smart-table-cond-panel__actions {
  display: flex;
  gap: 8px;
}
/* 抽屉:每条一块,块之间 16px + 分隔线;块头「条件 N」靠左,同字段的且 / 或与删除靠右(设计原型 .sb / .sb-head) */
.smart-table-cond-panel--stack .smart-table-cond-panel__rows {
  gap: 0;
}
.smart-table-cond-panel__block {
  padding-top: 16px;
}
.smart-table-cond-panel__block + .smart-table-cond-panel__block {
  margin-top: 16px;
  border-top: 1px solid;
}
.smart-table-cond-panel__block-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-size: 14px;
}
.smart-table-cond-panel__block-head > span {
  flex: 1 1 auto;
}
.smart-table-cond-panel__logic {
  flex: none;
  width: 88px;
}
.smart-table-cond-panel__block > :deep(.smart-table-cond-panel__body) {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 12px 8px;
}
.smart-table-cond-panel__body :deep(.smart-table-filter-value) {
  grid-column: 1 / -1;
}
</style>
