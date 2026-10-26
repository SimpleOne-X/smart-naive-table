// @vitest-environment jsdom
// 结束编辑(Enter / Tab / Esc)时,编辑器的输入框先在渲染之前失焦(issue #32)。
// Chrome 移除仍有焦点的 input 会同步补发 change / blur;落在 NEllipsis 气泡的 vueuc Target 的 patch 里时,NInput 读到的 ref
// 被记成 Target 的依赖,Target 随后复用旧 trigger vnode 重渲染、指令叠加,Vue 在 invokeDirectiveHook 里报 TypeError。
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import SmartTable from '../src/SmartTable.vue'
import type { SmartTableColumn } from '../src/types'

interface Row {
  id: number
  name: string
  memo: string
}
const rows = (): Row[] => [
  { id: 1, name: 'alice', memo: 'm1' },
  { id: 2, name: 'bob', memo: 'm2' },
]
const columns = (): SmartTableColumn<unknown>[] => [
  { key: 'name', title: 'Name', ellipsis: { tooltip: true } },
  { key: 'memo', title: 'Memo' },
]

beforeAll(() => {
  Element.prototype.scrollTo ??= () => {}
})

/** 模拟 Chrome：移除含焦点元素的节点时，同步给该元素补发 change + blur。 */
function emulateBlurOnRemove(): () => void {
  const original = Node.prototype.removeChild
  Node.prototype.removeChild = function <T extends Node>(this: Node, child: T): T {
    const active = document.activeElement
    if (active instanceof HTMLElement && active !== document.body && child.contains(active)) {
      active.dispatchEvent(new Event('change', { bubbles: true }))
      active.dispatchEvent(new FocusEvent('blur'))
      active.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    }
    return original.call(this, child) as T
  }
  return () => {
    Node.prototype.removeChild = original
  }
}

let wrapper: VueWrapper | null = null
let restore: (() => void) | null = null
const errors: unknown[] = []
function mountTable(): VueWrapper {
  wrapper = mount(SmartTable, {
    props: { columns: columns(), data: rows(), rowKey: 'id', pagination: false, editable: true },
    attachTo: document.body,
    global: {
      config: {
        errorHandler: (err) => {
          errors.push(err)
        },
      },
    },
  })
  return wrapper
}
afterEach(() => {
  restore?.()
  restore = null
  wrapper?.unmount()
  wrapper = null
  errors.length = 0
  document.body.innerHTML = ''
})

const td = (w: VueWrapper, id: number, key: string) => w.find(`td[data-xc="${id}|${key}"]`)
const press = (key: string, target: Element) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
async function editAndType(w: VueWrapper, id: number, key: string, text: string) {
  await td(w, id, key).trigger('click')
  await nextTick()
  await td(w, id, key).trigger('click')
  await flushPromises()
  const input = w.find('.smart-table-xe input').element as HTMLInputElement
  input.value = text
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await nextTick()
  return input
}

describe('结束编辑时编辑器先失焦', () => {
  it('Enter 提交：blur 发生在输入框还挂在文档上的时候，卸载时不再有焦点', async () => {
    const w = mountTable()
    const input = await editAndType(w, 1, 'memo', 'new')
    const blurs: boolean[] = []
    input.addEventListener('blur', () => blurs.push(input.isConnected))
    press('Enter', input)
    await flushPromises()
    expect(blurs).toEqual([true])
    expect(input.isConnected).toBe(false)
    expect(td(w, 1, 'memo').text()).toBe('new')
  })

  it('Esc 放弃：同样先失焦', async () => {
    const w = mountTable()
    const input = await editAndType(w, 1, 'memo', 'new')
    const blurs: boolean[] = []
    input.addEventListener('blur', () => blurs.push(input.isConnected))
    press('Escape', input)
    await flushPromises()
    expect(blurs).toEqual([true])
    expect(td(w, 1, 'memo').text()).toBe('m1')
  })

  it('列写 ellipsis: { tooltip: true }：连续提交两格不报错、值都写回(模拟 Chrome 移除焦点元素时补发 blur)', async () => {
    restore = emulateBlurOnRemove()
    const w = mountTable()
    let input = await editAndType(w, 1, 'name', 'one')
    press('Enter', input)
    await flushPromises()
    input = await editAndType(w, 2, 'name', 'two')
    press('Enter', input)
    await flushPromises()
    expect(errors).toEqual([])
    expect(td(w, 1, 'name').text()).toBe('one')
    expect(td(w, 2, 'name').text()).toBe('two')
  })

  it('提交后焦点回到选中的单元格，键盘导航照常', async () => {
    const w = mountTable()
    const input = await editAndType(w, 1, 'memo', 'new')
    press('Enter', input)
    await flushPromises()
    expect(document.activeElement).toBe(td(w, 2, 'memo').element)
  })
})
