import { h, type FunctionalComponent } from 'vue'

// 内置极简线性图标(零图标库依赖),stroke 用 currentColor 跟随宿主主题。
function lineIcon(paths: string[]): FunctionalComponent {
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
      },
      paths.map((d) => h('path', { d })),
    )
}

export const RefreshIcon = lineIcon(['M23 4v6h-6', 'M20.49 15a9 9 0 1 1-2.13-9.36L23 10'])
export const DensityIcon = lineIcon(['M3 6h18', 'M3 12h18', 'M3 18h18'])
export const ColumnsIcon = lineIcon([
  'M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  'M9 3v18',
  'M15 3v18',
])
// 小号图标(chevron / 关闭 / 加号):与设计原型 I_CHEV / I_X / I_PLUS 同一套几何(16 × 16 视口、笔画 1.8 / 1.6),
// 用在 12–13px 的小尺寸上;笔画随视口缩放,换成 24 视口 + 2 的笔画会在 12px 下细一圈。
function smallIcon(paths: string[], strokeWidth: number): FunctionalComponent {
  return () =>
    h(
      'svg',
      {
        viewBox: '0 0 16 16',
        width: '1em',
        height: '1em',
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': strokeWidth,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        'aria-hidden': 'true',
      },
      paths.map((d) => h('path', { d })),
    )
}
export const ChevronDownIcon = smallIcon(['m4 6 4 4 4-4'], 1.8)
export const CloseIcon = smallIcon(['M4 4l8 8M12 4l-8 8'], 1.8)
export const PlusIcon = smallIcon(['M8 3v10M3 8h10'], 1.6)
// 「更多条件」:双尖括号 »(不用「…」:工具栏的「更多」菜单按钮已经是文字 + 下箭头,两个「更多」不能同形)
export const MoreConditionsIcon = lineIcon(['m7 7 5 5-5 5', 'M14 7l5 5-5 5'])
// 构造器里文本输入框右侧的放大镜(原型 I_SEARCH:16 视口、14px、笔画 1.6)
export const SearchIcon: FunctionalComponent = () =>
  h(
    'svg',
    {
      viewBox: '0 0 16 16',
      width: '14',
      height: '14',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': 1.6,
      'stroke-linecap': 'round',
      'aria-hidden': 'true',
    },
    [h('circle', { cx: 7, cy: 7, r: 4.5 }), h('path', { d: 'M10.5 10.5 14 14' })],
  )
// 放大 = 四角括号向外展开,还原 = 向内收拢(只有折线、没有箭头;与「复制」图标不混)
export const MaximizeIcon = lineIcon([
  'M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3',
])
export const RestoreIcon = lineIcon([
  'M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3',
])
// 漏斗:表头过滤触发图标(实心,过滤生效时整体变主题色)
export const FilterIcon: FunctionalComponent = () =>
  h(
    'svg',
    {
      viewBox: '0 0 24 24',
      width: '1em',
      height: '1em',
      fill: 'currentColor',
      'aria-hidden': 'true',
    },
    [
      h('path', {
        d: 'M3 5.5A1.5 1.5 0 0 1 4.5 4h15A1.5 1.5 0 0 1 20.7 6.4l-5.7 6.8V19a1 1 0 0 1-1.5.9l-3-1.7a1 1 0 0 1-.5-.9v-4.1L3.3 6.4A1.5 1.5 0 0 1 3 5.5z',
      }),
    ],
  )

export const DragIcon: FunctionalComponent = () =>
  h(
    'svg',
    {
      viewBox: '0 0 24 24',
      width: '1em',
      height: '1em',
      fill: 'currentColor',
      'aria-hidden': 'true',
    },
    [8, 16].flatMap((x) => [6, 12, 18].map((y) => h('circle', { cx: x, cy: y, r: 1.6 }))),
  )
