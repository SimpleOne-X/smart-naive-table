// 空状态图标:线性托盘(原型 const I_EMPTY)。
// 宿主经官方接口全局替换,库默认值不变:
//   <NConfigProvider :component-options="{ Empty: { renderIcon: () => h(TrayIcon) } }">
// (config-provider/src/internal-interface.d.ts 的 Empty: Pick<EmptyProps, 'description' | 'renderIcon'>),下拉 / 树 / 穿梭框的空状态也一起换。
// viewBox 裁到 3–37 让图形撑满 40px 框;只用 currentColor,明暗跟随 NEmpty 的 iconColor。
import { defineComponent, h } from 'vue'

const PATH =
  'M6 30V22.1Q6 20.5 6.62 19.02L10.23 10.35Q11 8.5 13 8.5H27Q29 8.5 29.77 10.35L33.38 19.02Q34 20.5 34 22.1V30Q34 32.5 31.5 32.5H8.5Q6 32.5 6 30ZM6 23h7.2c.6 0 1.1.4 1.3 1 .7 2 2.9 3.4 5.5 3.4s4.8-1.4 5.5-3.4c.2-.6.7-1 1.3-1H34'

export const TrayIcon = defineComponent({
  name: 'ProtoTrayIcon',
  render: () =>
    h(
      'svg',
      {
        viewBox: '3 3 34 34',
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': 1.3,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        'aria-hidden': 'true',
        'data-proto-tray': '',
      },
      [h('path', { d: PATH })],
    ),
})

/** 官方 NConfigProvider 的 component-options。 */
export const COMPONENT_OPTIONS = { Empty: { renderIcon: () => h(TrayIcon) } }
