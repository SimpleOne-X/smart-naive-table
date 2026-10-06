// 宿主侧按钮的统一写法(设计 §2.15):页面上的按钮 = 淡色底 + 左图标,颜色对应用途;
// 表格行内的「编辑 / 删除」是无底文字按钮,只加颜色和小图标;确认弹窗 / 确认气泡的按钮按 macOS 两档。
// 库自己渲染的按钮图标在 src/icons.ts;这里只补宿主按钮才用的几枚(铅笔 / 下载 / 用户),库不内置。
import { h, type FunctionalComponent } from 'vue'
import { NButton } from 'naive-ui'
import type { ButtonProps } from 'naive-ui'
import { ACT_BTN } from './toolbar'
import { useButtonTint } from '../../../../src/buttonTint'

export {
  CheckIcon,
  ClearIcon,
  FunnelIcon,
  MagnifierIcon,
  PlusIcon,
  ResetIcon,
  SortIcon,
  TrashIcon,
} from '../../../../src/icons'
import { TrashIcon } from '../../../../src/icons'

// 与 src/icons.ts 的 lineIcon 同一套几何:24 视口、笔画 2、1em、currentColor
function line(paths: string[], extra: Record<string, unknown> = {}): FunctionalComponent {
  return () =>
    h(
      'svg',
      {
        viewBox: '0 0 24 24',
        width: '1em',
        height: '1em',
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': 2,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        'aria-hidden': 'true',
        ...extra,
      },
      paths.map((d) => h('path', { d })),
    )
}
export const EditIcon = line(['M12 20h9', 'M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z'])
export const DownloadIcon = line(['M12 4v11', 'm7 11 5 5 5-5', 'M5 20h14'])
// 详情:眼睛(与 EditIcon 同一套几何)
export const DetailIcon: FunctionalComponent = () =>
  h(
    'svg',
    {
      viewBox: '0 0 24 24',
      width: '1em',
      height: '1em',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': 2,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true',
    },
    [
      h('path', { d: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z' }),
      h('circle', { cx: 12, cy: 12, r: 3 }),
    ],
  )
export const UserIcon: FunctionalComponent = () =>
  h(
    'svg',
    {
      viewBox: '0 0 24 24',
      width: '1em',
      height: '1em',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': 2,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true',
    },
    [h('circle', { cx: 12, cy: 8, r: 4 }), h('path', { d: 'M4 21a8 8 0 0 1 16 0' })],
  )

/** 行内文字按钮:图标 14px(= 字号 1em)、与字间距 4px(原型 .n-btn.text .btn-ic),高度沿用 ACT_BTN。 */
const TEXT_ICON = { iconSizeMedium: '14px', iconMarginMedium: '4px' }

/**
 * 行内文字按钮的主题覆盖:小图标 + 字色取当前主题的 pressed 色(设计 §2.15 E,与库内淡色按钮同一来源)。
 * 在渲染函数里调用(列的 render 在表格渲染期执行),明暗切换时随渲染重取。
 */
function textOverrides(type: 'primary' | 'error') {
  const tint = useButtonTint().value
  return { ...TEXT_ICON, ...(type === 'primary' ? tint.primaryText : tint.errorText) }
}

/** 行内「编辑」:主色字 + 铅笔,无底。 */
export const editAction = (label: string, onClick: () => void) =>
  h(
    NButton,
    {
      text: true,
      type: 'primary',
      style: ACT_BTN,
      themeOverrides: textOverrides('primary'),
      onClick,
    },
    { icon: () => h(EditIcon), default: () => label },
  )

/** 行内「详情」:主色字 + 眼睛,无底(同「编辑」写法),点开右侧详情抽屉。 */
export const detailAction = (label: string, onClick: () => void) =>
  h(
    NButton,
    {
      text: true,
      type: 'primary',
      style: ACT_BTN,
      themeOverrides: textOverrides('primary'),
      onClick,
    },
    { icon: () => h(DetailIcon), default: () => label },
  )

/** 行内「删除」(放在 NPopconfirm 的 trigger 里):红字 + 垃圾桶,无底。 */
export const deleteTrigger = (label: string) =>
  h(
    NButton,
    { text: true, type: 'error', style: ACT_BTN, themeOverrides: textOverrides('error') },
    { icon: () => h(TrashIcon), default: () => label },
  )

/** 子表行内「移除」:同「删除」写法(红字 + 垃圾桶,无底),直接带点击回调。 */
export const removeAction = (label: string, onClick: () => void) =>
  h(
    NButton,
    { text: true, type: 'error', style: ACT_BTN, themeOverrides: textOverrides('error'), onClick },
    { icon: () => h(TrashIcon), default: () => label },
  )

const MIN_W = { minWidth: '80px' }

/**
 * 删除确认的按钮(设计 §2.15 B6):最终确认的「删除」= 实心红,「取消」= 淡灰,最小宽 80px,放在 NDialog 的
 * `positiveButtonProps` / `negativeButtonProps`。
 */
export const DELETE_DIALOG_BTNS: {
  positiveButtonProps: ButtonProps
  negativeButtonProps: ButtonProps
} = {
  // 官方 NDialog 的按钮默认 small、取消按钮是 ghost(Dialog.mjs:189-192):这里改回常规尺寸、关掉 ghost,取消才是淡灰底
  // 官方 ButtonProps 的类型里没有 style(它是透传给 <button> 的属性),运行时有效,所以断言一下
  positiveButtonProps: { type: 'error', size: 'medium', style: MIN_W } as ButtonProps,
  negativeButtonProps: {
    secondary: true,
    ghost: false,
    size: 'medium',
    style: MIN_W,
  } as ButtonProps,
}

/** 行内删除的确认气泡(NPopconfirm,官方默认 small):取消 = 淡灰、删除 = 实心红(原型 .pconf 的 sm sec / sm err,不设最小宽)。 */
export const DELETE_POPCONFIRM_BTNS: {
  positiveButtonProps: ButtonProps
  negativeButtonProps: ButtonProps
} = {
  positiveButtonProps: { type: 'error' },
  negativeButtonProps: { secondary: true },
}
