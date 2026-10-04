// 容器档位(原型 T_NARROW = 600、T_WIDE = 1280;按「容器」宽度,不是视口):
//   窄 < 600 · 中 600–1279 · 宽 ≥ 1280。库自己的三档由库自己判(宿主不管);这里给宿主层要变形的地方用:
//   模块 9 / 11 / 12 的弹窗与抽屉(窄档变底部抽屉)、模块 11 的树(窄 < 720 变 NTreeSelect,树宽宽档 240 / 中档 200)。
// 用法:
//   const { el, width, tier } = useTier()
//   <div ref="el" class="proto-host"> … </div>      // 量这个根元素的宽度;tier.value === 'narrow' 时走窄档分支
// jsdom 没有 ResizeObserver:测试里按 tests/proto/_mount.ts 的桩装;没有 ResizeObserver 时 width 恒 0(= 'narrow'),
// 单测里要测某一档,直接 width.value = 1400(或调 tierOf(1400))。
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

export const T_NARROW = 600
export const T_WIDE = 1280
export type Tier = 'narrow' | 'mid' | 'wide'
export const tierOf = (w: number): Tier => (w < T_NARROW ? 'narrow' : w < T_WIDE ? 'mid' : 'wide')

export function useTier() {
  const el = ref<HTMLElement | null>(null)
  const width = ref(0)
  let ro: ResizeObserver | undefined
  onMounted(() => {
    const node = el.value
    if (!node) return
    width.value = node.clientWidth || node.getBoundingClientRect().width || 0
    if (typeof ResizeObserver === 'undefined') return
    ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w != null) width.value = w
    })
    ro.observe(node)
  })
  onBeforeUnmount(() => ro?.disconnect())
  return { el, width, tier: computed<Tier>(() => tierOf(width.value)) }
}
