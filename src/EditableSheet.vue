<script setup lang="ts">
// 窄档(cardOnNarrow 卡片模式)的底部抽屉表单:窄档不逐格编辑,点卡片 → 这里一行一行编辑,表单控件按「同一套推断」生成
// (只读 / 输入 / 多行 / 下拉 / 数字 / 复选 / 日期 / 日期时间,与宽档逐列一致)。保存是整行的即时保存:走 @save(changes 里只有这一行)。
// 外观沿用官方 NDrawer(bottom)+ NForm(label 在左 72px、控件 large 40px、必填星号在右),与设计原型的 CrudModal 窄档抽屉同一套。
import { computed } from 'vue'
import {
  NButton,
  NCheckbox,
  NDatePicker,
  NDrawer,
  NDrawerContent,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NSelect,
  NSpace,
  useThemeVars,
} from 'naive-ui'
import type { EditorKind, SmartTableLabels, SmartTableOption } from './types'
import type { EditFormState } from './useEditable'
import { fmt } from './labels'
import SmartSelectTable from './SmartSelectTable.vue'
import { optionLabel } from './useOptions'

export interface SheetField {
  key: string
  label: string
  kind: EditorKind | null
  required: boolean
  options: SmartTableOption[]
  extra?: Record<string, unknown>
}

const props = defineProps<{
  form: EditFormState
  fields: SheetField[]
  labels: Required<SmartTableLabels>
  labelWidth?: number
}>()
const emit = defineEmits<{
  set: [key: string, value: unknown]
  pick: [key: string, row: Record<string, unknown>]
  save: []
  close: []
}>()

const themeVars = useThemeVars()
const title = computed(() =>
  props.form.isNew ? props.labels.editNewTitle : props.labels.editEditTitle,
)

const selectOptions = (f: SheetField) =>
  f.options.map((o) => ({
    label: optionLabel(o),
    value: o.value as string | number,
    disabled: o.disabled,
  }))
const isLocked = (f: SheetField): boolean => props.form.locked.includes(f.key)
/** 这一行能编辑的格全被锁了(如整行只读):抽屉只读,不给保存。 */
const allLocked = computed(() => props.fields.every((f) => f.kind === null || isLocked(f)))
/** select-table:editorProps 去掉 fill / valueKey;值就是 labelKey 那一列的文本,所以 valueKey = labelKey。 */
const pickProps = (f: SheetField): Record<string, any> => {
  const {
    fill: _fill,
    valueKey: _vk,
    labelKey,
    ...rest
  } = (f.extra ?? {}) as Record<string, unknown>
  const lk = (labelKey as string | undefined) ?? f.key
  return { ...rest, labelKey: lk, valueKey: lk }
}
const textOf = (v: unknown): string => (v == null ? '' : String(v))
const placeholderOf = (f: SheetField): string => {
  const L = props.labels
  switch (f.kind) {
    case 'select':
    case 'multiselect':
    case 'select-table':
      return L.editSelectPlaceholder
    case 'number':
      return L.editNumberPlaceholder
    case 'datetime':
      return L.editDatetimePlaceholder
    case 'date':
      return ''
    default:
      return fmt(L.editInputPlaceholder, { field: f.label })
  }
}
</script>

<template>
  <n-drawer
    :show="true"
    class="smart-table-sheet"
    placement="bottom"
    height="auto"
    style="max-height: 85vh"
    :mask-closable="!form.saving"
    :close-on-esc="!form.saving"
    @update:show="(v: boolean) => !v && emit('close')"
  >
    <n-drawer-content
      :title="title"
      closable
      :native-scrollbar="true"
      body-content-style="padding: 16px 24px 8px"
    >
      <n-form
        label-placement="left"
        :label-width="labelWidth ?? 72"
        require-mark-placement="right"
        size="large"
        @submit.prevent
      >
        <n-form-item
          v-for="f in fields"
          :key="f.key"
          :label="f.label"
          :required="f.required"
          :validation-status="form.errs[f.key] ? 'error' : undefined"
          :feedback="form.errs[f.key]"
        >
          <span
            v-if="f.kind === null"
            class="smart-table-sheet-ro"
            :style="{ color: themeVars.textColor3 }"
            >{{ textOf(form.vals[f.key]) }}</span
          >
          <n-input
            v-else-if="f.kind === 'input'"
            :value="textOf(form.vals[f.key])"
            :placeholder="placeholderOf(f)"
            :disabled="isLocked(f)"
            v-bind="f.extra"
            @update:value="(v: string) => emit('set', f.key, v)"
          />
          <n-input
            v-else-if="f.kind === 'textarea'"
            type="textarea"
            :rows="4"
            :resizable="false"
            :value="textOf(form.vals[f.key])"
            :placeholder="placeholderOf(f)"
            :disabled="isLocked(f)"
            v-bind="f.extra"
            @update:value="(v: string) => emit('set', f.key, v)"
          />
          <n-input-number
            v-else-if="f.kind === 'number'"
            :value="typeof form.vals[f.key] === 'number' ? (form.vals[f.key] as number) : null"
            :clearable="false"
            :placeholder="placeholderOf(f)"
            :disabled="isLocked(f)"
            style="width: 100%"
            v-bind="f.extra"
            @update:value="(v: number | null) => emit('set', f.key, v)"
          />
          <n-select
            v-else-if="f.kind === 'select' || f.kind === 'multiselect'"
            :multiple="f.kind === 'multiselect'"
            :value="
              f.kind === 'multiselect'
                ? ((Array.isArray(form.vals[f.key]) ? form.vals[f.key] : []) as Array<
                    string | number
                  >)
                : ((form.vals[f.key] as string | number | null) ?? null)
            "
            :options="selectOptions(f)"
            :placeholder="placeholderOf(f)"
            :filterable="f.options.length > 8"
            :disabled="isLocked(f)"
            v-bind="f.extra"
            @update:value="(v: unknown) => emit('set', f.key, v)"
          />
          <smart-select-table
            v-else-if="f.kind === 'select-table'"
            :value="textOf(form.vals[f.key]) || null"
            :columns="pickProps(f).columns"
            v-bind="pickProps(f)"
            :placeholder="placeholderOf(f)"
            :disabled="isLocked(f)"
            :labels="labels"
            :clearable="!f.required"
            size="large"
            @update:value="(v: unknown) => v == null && emit('set', f.key, '')"
            @pick="(r: Record<string, unknown>) => emit('pick', f.key, r)"
          />
          <n-checkbox
            v-else-if="f.kind === 'checkbox'"
            :checked="!!form.vals[f.key]"
            :disabled="isLocked(f)"
            @update:checked="(v: boolean) => emit('set', f.key, v)"
          />
          <n-date-picker
            v-else
            :type="f.kind"
            :formatted-value="form.vals[f.key] ? String(form.vals[f.key]) : null"
            :value-format="f.kind === 'datetime' ? 'yyyy-MM-dd HH:mm:ss' : 'yyyy-MM-dd'"
            :placeholder="placeholderOf(f)"
            :disabled="isLocked(f)"
            clearable
            style="width: 100%"
            v-bind="f.extra"
            @update:formatted-value="(v: string | null) => emit('set', f.key, v ?? '')"
          />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end" style="flex: 1 1 auto">
          <n-button size="large" :disabled="form.saving" @click="emit('close')">{{
            labels.editCancel
          }}</n-button>
          <n-button
            size="large"
            type="primary"
            :loading="form.saving"
            :disabled="allLocked"
            @click="emit('save')"
            >{{ labels.editSheetSave }}</n-button
          >
        </n-space>
      </template>
    </n-drawer-content>
  </n-drawer>
</template>

<style>
/* 抽屉高度随内容(最高 85vh):官方 .n-drawer-body 是 flex: 1 0 0 + overflow: hidden,父级高度 auto 时塌成 0;
   与库 ConditionBar 的窄档抽屉同一套修法(NDrawer 是 teleport 到 body 的,所以不能 scoped) */
.smart-table-sheet {
  display: flex;
  flex-direction: column;
}
.n-drawer.smart-table-sheet .n-drawer-content-wrapper {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.n-drawer.smart-table-sheet .n-drawer-content {
  min-height: 0;
}
.n-drawer.smart-table-sheet .n-drawer-content .n-drawer-body {
  flex: 1 1 auto;
  min-height: 0;
}
/* label 区 72px 放不下「物料编码 + 星号」:不换行 */
.smart-table-sheet .n-form-item-label {
  white-space: nowrap;
}
.smart-table-sheet-ro {
  line-height: 40px;
}
</style>
