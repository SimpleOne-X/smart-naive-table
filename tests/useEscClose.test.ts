// @vitest-environment jsdom
// useEscClose:弹层打开期间 document 上的 Esc 把它关掉(NPopover / NDropdown 本身不管键盘)
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref, type Ref } from 'vue'
import { mount } from '@vue/test-utils'
import { useEscClose } from '../src/useEscClose'

function host() {
  let show!: Ref<boolean>
  const C = defineComponent({
    setup() {
      show = ref(false)
      useEscClose(show)
      return () => h('div')
    },
  })
  const w = mount(C)
  return { w, show: () => show }
}
const press = (init: KeyboardEventInit = { key: 'Escape' }) =>
  document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }))

afterEach(() => vi.restoreAllMocks())

describe('useEscClose', () => {
  it('打开期间 Esc 关闭;没打开时不监听(不拦别人的 Esc)', async () => {
    const add = vi.spyOn(document, 'addEventListener')
    const { w, show } = host()
    expect(add.mock.calls.filter((c) => c[0] === 'keydown')).toHaveLength(0) // 没打开:没有监听
    show().value = true
    await nextTick()
    expect(add.mock.calls.filter((c) => c[0] === 'keydown')).toHaveLength(1)
    press()
    expect(show().value).toBe(false)
    w.unmount()
  })

  it('其它键、输入法组词中的 Esc、已被别人 preventDefault 的 Esc 都不关', async () => {
    const { w, show } = host()
    show().value = true
    await nextTick()
    press({ key: 'Enter' })
    press({ key: 'Escape', isComposing: true })
    document.addEventListener('keydown', (e) => e.preventDefault(), { once: true, capture: true })
    press()
    expect(show().value).toBe(true)
    w.unmount()
  })

  it('关闭后摘掉监听;卸载时摘掉监听', async () => {
    const remove = vi.spyOn(document, 'removeEventListener')
    const { w, show } = host()
    show().value = true
    await nextTick()
    show().value = false
    await nextTick()
    expect(remove.mock.calls.filter((c) => c[0] === 'keydown').length).toBeGreaterThanOrEqual(1)
    show().value = true
    await nextTick()
    const before = remove.mock.calls.filter((c) => c[0] === 'keydown').length
    w.unmount()
    expect(remove.mock.calls.filter((c) => c[0] === 'keydown').length).toBeGreaterThan(before)
  })
})
