import { onBeforeUnmount, watch, type Ref } from 'vue'

/**
 * 弹层打开期间,Esc 关闭它。官方 NPopover 不管键盘;NDropdown 只有焦点在菜单里时才响应 Esc(spike 实测:点开「更多」后焦点还在按钮上,
 * Esc 没有任何反应)。库里自己的弹层(「更多」、密度、列设置、chips 的「+N」)都用它,这样「放大」的 Esc 分层才成立:
 * 先 Esc 收弹层,没有弹层了再 Esc 才还原。监听挂在 document 冒泡阶段,只在弹层打开期间存在。
 */
export function useEscClose(show: Ref<boolean>): void {
  const onKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && !e.isComposing && !e.defaultPrevented) show.value = false
  }
  watch(
    show,
    (open) => {
      if (open) document.addEventListener('keydown', onKeydown)
      else document.removeEventListener('keydown', onKeydown)
    },
    { immediate: true },
  )
  onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
}
