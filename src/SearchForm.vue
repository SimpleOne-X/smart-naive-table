<script setup lang="ts">
// 搜索表单:由列派生的 SearchDef 渲染,纯受控(params 由父级持有)。
// label/选项文案在模板渲染期求值,切换语言即时生效(红线:不得 setup 期解成字符串)。
// 两种布局:'grid'(默认,独立卡片 + n-grid)/ 'inline'(无卡片,单行自动换行,适配窄栏)。
import { computed, h, onBeforeUnmount, onMounted, ref, type PropType, type VNodeChild } from 'vue'
import {
  NButton,
  NCard,
  NDatePicker,
  NForm,
  NFormItem,
  NFormItemGi,
  NGrid,
  NInput,
  NInputNumber,
  NSelect,
  NSpace,
  NSwitch,
  useThemeVars,
} from 'naive-ui'
import type { CardProps, SelectGroupOption, SelectOption } from 'naive-ui'
import type { SmartTableLabels, SmartTableOption, SearchFormConfig } from './types'
import type { SearchDef } from './useColumns'
import { optionLabel } from './useOptions'
import { countTracks, effectiveCollapsedRows } from './searchCols'
import { MagnifierIcon, ResetIcon } from './icons'

// 官方没有公开导出 SelectMixedOption(只在 select/src/interface 里,深导入会随版本改路径),用公开的两个选项类型拼出同一个联合。
type SelectMixedOption = SelectOption | SelectGroupOption

const props = defineProps({
  fields: { type: Array as PropType<SearchDef[]>, required: true },
  params: { type: Object as PropType<Record<string, any>>, required: true },
  config: { type: Object as PropType<SearchFormConfig>, default: () => ({}) },
  labels: { type: Object as PropType<Required<SmartTableLabels>>, required: true },
  loading: { type: Boolean, default: false },
  dateValueFormat: { type: String, default: 'yyyy-MM-dd' },
  getOptions: { type: Function as PropType<(key: string) => SmartTableOption[]>, required: true },
  isLoadingOptions: { type: Function as PropType<(key: string) => boolean>, required: true },
  cardProps: { type: Object as PropType<Partial<CardProps>>, default: () => ({}) },
})

const emit = defineEmits<{
  search: []
  reset: []
}>()

const themeVars = useThemeVars()
const isInline = computed(() => props.config.layout === 'inline')

// 折叠:仅 grid 布局;collapsed 初始跟随 config.collapsible。
const collapsible = computed(() => !isInline.value && props.config.collapsible === true)
const collapsed = ref(true)

// 渲染后读 n-grid 根元素 computed 的 grid-template-columns 轨道数(0 = 未知),让窄屏 1 列的折叠态至少露出首个字段。
// 用 ResizeObserver 跟随视口 / 容器变化重读;只在轨道数变了时才改 collapsed-rows,所以它自己引起的高度变化不会循环触发。
const gridHostRef = ref<HTMLElement | null>(null)
const gridTracks = ref(0)
function measureTracks() {
  const el = gridHostRef.value?.querySelector<HTMLElement>('.n-grid')
  gridTracks.value = el ? countTracks(getComputedStyle(el).gridTemplateColumns) : 0
}
let resizeObserver: ResizeObserver | null = null
onMounted(() => {
  measureTracks()
  const el = gridHostRef.value?.querySelector<HTMLElement>('.n-grid')
  if (typeof ResizeObserver !== 'undefined' && el) {
    resizeObserver = new ResizeObserver(measureTracks)
    resizeObserver.observe(el)
  }
})
onBeforeUnmount(() => resizeObserver?.disconnect())
const gridCollapsedRows = computed(() =>
  effectiveCollapsedRows(gridTracks.value, props.config.collapsedRows ?? 1),
)

function resolveLabel(label: SearchDef['label']): string | undefined {
  if (typeof label === 'function') {
    const v = label()
    return typeof v === 'string' ? v : String(v ?? '')
  }
  return label
}

function toSelectOptions(opts: SmartTableOption[]): SelectMixedOption[] {
  return opts.map((o) =>
    o.children?.length
      ? {
          type: 'group' as const,
          label: optionLabel(o),
          key: String(o.value),
          children: toSelectOptions(o.children),
        }
      : { label: optionLabel(o), value: o.value as string | number, disabled: o.disabled },
  )
}

function selectOptions(f: SearchDef): SelectMixedOption[] {
  return toSelectOptions(props.getOptions(f.optionsKey))
}

function onEnter(e: KeyboardEvent) {
  if (e.key === 'Enter') emit('search')
}

// 单个控件渲染 —— grid / inline 两种布局共用,避免控件标记重复。
function renderField(f: SearchDef): VNodeChild {
  if (f.render) {
    return f.render({
      value: props.params[f.key],
      setValue: (v) => {
        props.params[f.key] = v
      },
      params: props.params,
      search: () => emit('search'),
    })
  }
  const setValue = (v: unknown) => {
    props.params[f.key] = v
  }
  const bind = { value: props.params[f.key], 'onUpdate:value': setValue }
  switch (f.type) {
    case 'number':
      return h(NInputNumber, {
        ...bind,
        clearable: true,
        style: 'width:100%',
        placeholder: f.placeholder,
        onKeyup: onEnter,
        ...f.props,
      })
    case 'select':
      return h(NSelect, {
        ...bind,
        clearable: true,
        options: selectOptions(f),
        loading: props.isLoadingOptions(f.optionsKey),
        placeholder: f.placeholder,
        ...f.props,
      })
    case 'date':
    case 'daterange':
      return h(NDatePicker, {
        formattedValue: props.params[f.key],
        'onUpdate:formattedValue': setValue,
        type: f.type,
        valueFormat: props.dateValueFormat,
        clearable: true,
        style: 'width:100%',
        ...f.props,
      })
    case 'switch':
      return h(NSwitch, { ...bind, ...f.props })
    case 'input':
    default:
      return h(NInput, {
        ...bind,
        clearable: true,
        placeholder: f.placeholder,
        onKeyup: onEnter,
        ...f.props,
      })
  }
}
</script>

<template>
  <!-- inline:无卡片,单行自动换行,塞进窄栏 -->
  <n-form
    v-if="isInline"
    class="smart-table-search-inline"
    :show-feedback="false"
    :label-placement="config.labelPlacement ?? 'left'"
    :label-width="config.labelWidth"
  >
    <div class="smart-table-search-inline-row">
      <n-form-item
        v-for="f in fields"
        :key="f.key"
        class="smart-table-search-inline-item"
        :label="resolveLabel(f.label)"
      >
        <component :is="() => renderField(f)" />
      </n-form-item>
      <n-space :size="8">
        <!-- 搜索 = 淡主色底 + 放大镜,重置 = 淡灰底 + 逆时针箭头(设计 §2.13 / §2.15 A):官方 secondary,不是实心;
             图标槽一直在,loading 时官方把同一个槽里的图标换成转圈,按钮宽度不变(issue #5 不再需要额外 CSS) -->
        <n-button secondary type="primary" :loading="loading" @click="emit('search')">
          <template #icon><MagnifierIcon /></template>
          {{ labels.search }}
        </n-button>
        <n-button secondary @click="emit('reset')">
          <template #icon><ResetIcon /></template>
          {{ labels.reset }}
        </n-button>
      </n-space>
    </div>
  </n-form>

  <!-- grid(默认):独立卡片 + n-grid -->
  <n-card v-else :bordered="true" class="smart-table-search" v-bind="cardProps">
    <n-form
      :show-feedback="false"
      :label-placement="config.labelPlacement ?? 'left'"
      :label-width="config.labelWidth"
    >
      <div ref="gridHostRef">
        <n-grid
          :cols="config.cols ?? '1 s:2 m:3 l:4'"
          responsive="screen"
          :x-gap="16"
          :y-gap="12"
          :collapsed="collapsible && collapsed"
          :collapsed-rows="gridCollapsedRows"
        >
          <n-form-item-gi
            v-for="f in fields"
            :key="f.key"
            :span="f.span"
            :label="resolveLabel(f.label)"
          >
            <component :is="() => renderField(f)" />
          </n-form-item-gi>
          <n-form-item-gi suffix>
            <n-space align="center">
              <n-button secondary type="primary" :loading="loading" @click="emit('search')">
                <template #icon><MagnifierIcon /></template>
                {{ labels.search }}
              </n-button>
              <n-button secondary @click="emit('reset')">
                <template #icon><ResetIcon /></template>
                {{ labels.reset }}
              </n-button>
              <n-button
                v-if="collapsible"
                class="smart-table-search-toggle"
                :style="{ height: themeVars.heightMedium }"
                text
                type="primary"
                @click="collapsed = !collapsed"
              >
                {{ collapsed ? labels.expand : labels.collapse }}
              </n-button>
            </n-space>
          </n-form-item-gi>
        </n-grid>
      </div>
    </n-form>
  </n-card>
</template>

<style scoped>
/* 「展开 / 收起」:官方文字按钮没有固定高度和内边距(--n-height 是 initial,实测 28×14,比同排 34px 的按钮矮、还窄 8px);
   与设计原型一致:高度与同排按钮同高(模板里取主题的 heightMedium)、左右内边距 4px */
.smart-table-search-toggle {
  padding: 0 4px;
}
.smart-table-search-inline-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 12px 16px;
}
.smart-table-search-inline-item {
  flex: 0 1 auto;
}
</style>
