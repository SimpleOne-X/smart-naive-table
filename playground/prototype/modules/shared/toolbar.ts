// 工具栏的宿主侧助手:内置图标配置 + 「更多」菜单 + 「新增」按钮 + CSV 下载。
// 原型 12 个有工具栏的模块右侧都有「放大」,所以 protoToolbar() 一律带 maximize: true(库的 toolbar.maximize)。
import { defineComponent, h } from 'vue'
import { NButton } from 'naive-ui'
import type { ToolbarConfig, ToolbarMoreOption } from '../../../../src/index'
import { PlusIcon } from '../../../../src/icons'
import { useButtonTint } from '../../../../src/buttonTint'

type T = (zh: string) => string

/** 表格操作列的文字按钮高 22px:官方 text 按钮是 `height: initial`(只有字高 14px),设计方案的点击热区是 22px。 */
export const ACT_BTN = { height: '22px' }

/** 内置工具栏配置:`:toolbar="protoToolbar({ more: moreOptions(t) })"`。 */
export const protoToolbar = (
  opts: { more?: ToolbarMoreOption[] } & Partial<ToolbarConfig> = {},
): ToolbarConfig => ({
  maximize: true,
  ...opts,
})

/** 「更多」菜单(官方 NDropdown options 原样透传,label 用函数形式随语言求值;选中后库发 moreSelect,导出 / 导入由宿主处理)。 */
export const moreOptions = (t: T): ToolbarMoreOption[] => [
  { label: () => t('导出'), key: 'export' },
  { label: () => t('导入'), key: 'import' },
  { type: 'divider', key: 'd1' },
  { label: () => t('下载导入模板'), key: 'tpl' },
]

/** 原型 downloadCsv:UTF-8 BOM,Excel 直接打开。 */
export function downloadCsv(name: string, text: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob(['\ufeff' + text], { type: 'text/csv;charset=utf-8' }))
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

/**
 * 工具栏右侧「新增」按钮(`#toolbar-right` 插槽里用):
 *   <ProtoAddButton :label="t('新增')" @click="openCreate" />
 * 设计 §2.15:页面上的「新增」是淡主色底(secondary + primary)+ 加号,所有模块一样(模块 1 也是淡主色底,不降成描边)。
 * 加号用库内的按钮图标(24 视口 / 1em),图标盒保持官方默认(medium 18px / large 20px),不另调尺寸。
 */
export const ProtoAddButton = defineComponent({
  name: 'ProtoAddButton',
  props: {
    label: { type: String, required: true },
  },
  emits: ['click'],
  setup(props, { emit }) {
    const tint = useButtonTint()
    return () =>
      h(
        NButton,
        {
          secondary: true,
          type: 'primary',
          themeOverrides: tint.value.primary,
          onClick: (e: MouseEvent) => emit('click', e),
        },
        { icon: PlusIcon, default: () => props.label },
      )
  },
})
