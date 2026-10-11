// @vitest-environment jsdom
// 可编辑表格的格内控件要和显示态单元格的文字左缘对齐。宿主主题可以把 tdPadding 设成 padding 简写的多值写法,
// 所以不能假定 --n-td-padding 是单个值:编辑器挂载时放一个吃 --n-td-padding 的探针,让浏览器按简写规则解出左内边距与上下内边距之和。
// jsdom 解不开 var() 里的简写(paddingLeft 为空串),这里用桩替换 getComputedStyle 返回浏览器会给的解析结果;真实几何由 tools/parity/xe-pad.mjs 在浏览器里实测。
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { measureCellPadding } from '../src/cellPadding'
import EditableEditor from '../src/EditableEditor.vue'

interface Resolved {
  top: string
  bottom: string
  left: string
}

/** 把探针(行内样式 padding 含 --n-td-padding 的元素)的 computed style 换成给定的解析结果,其余元素走真实实现。 */
function stubProbe(resolved: Resolved): void {
  const real = window.getComputedStyle.bind(window)
  vi.spyOn(window, 'getComputedStyle').mockImplementation((el, pseudo) => {
    if (el instanceof HTMLElement && el.style.padding.includes('--n-td-padding')) {
      return {
        paddingTop: resolved.top,
        paddingBottom: resolved.bottom,
        paddingLeft: resolved.left,
      } as CSSStyleDeclaration
    }
    return real(el, pseudo)
  })
}

afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

describe('measureCellPadding', () => {
  it('两值写法 4px 10px:左 10px、上下之和 8px', () => {
    stubProbe({ top: '4px', bottom: '4px', left: '10px' })
    expect(measureCellPadding(document.body)).toEqual({ left: '10px', y: '8px' })
  })

  it('单值写法 8px:左 8px、上下之和 16px', () => {
    stubProbe({ top: '8px', bottom: '8px', left: '8px' })
    expect(measureCellPadding(document.body)).toEqual({ left: '8px', y: '16px' })
  })

  it('四值写法上下不等:上下之和是两者相加', () => {
    stubProbe({ top: '2px', bottom: '6px', left: '12px' })
    expect(measureCellPadding(document.body)).toEqual({ left: '12px', y: '8px' })
  })

  it('探针量完即移除,不留在 DOM 里', () => {
    stubProbe({ top: '4px', bottom: '4px', left: '10px' })
    const host = document.createElement('div')
    document.body.appendChild(host)
    measureCellPadding(host)
    expect(host.childElementCount).toBe(0)
  })

  it('解不出数值(jsdom / 服务端:var() 里的简写没有解析结果)返回 null,由样式里的缺省值接手', () => {
    expect(measureCellPadding(document.body)).toBeNull()
  })
})

describe('EditableEditor 把量到的内边距写成变量', () => {
  const ctrl = {
    update: () => {},
    pick: () => {},
    pickRow: () => {},
    pickDate: () => {},
    confirmDate: () => {},
    clearDate: () => {},
  }
  const mountEditor = () =>
    mount(EditableEditor, {
      props: {
        kind: 'input',
        value: 'abc',
        options: [],
        invalid: false,
        menuMinWidth: 120,
        ctrl,
      },
      attachTo: document.body,
    })

  it('根元素带 --smart-xe-pad-left / --smart-xe-pad-y,值是显示态单元格的实际内边距', async () => {
    stubProbe({ top: '4px', bottom: '4px', left: '10px' })
    const w = mountEditor()
    await nextTick()
    const root = w.get('.smart-table-xe').element as HTMLElement
    expect(root.style.getPropertyValue('--smart-xe-pad-left')).toBe('10px')
    expect(root.style.getPropertyValue('--smart-xe-pad-y')).toBe('8px')
    w.unmount()
  })

  it('量不到时不写内联变量,用样式里的缺省(--n-td-padding 为单值时与显示态一致)', async () => {
    const w = mountEditor()
    await nextTick()
    const root = w.get('.smart-table-xe').element as HTMLElement
    expect(root.style.getPropertyValue('--smart-xe-pad-left')).toBe('')
    expect(root.style.getPropertyValue('--smart-xe-pad-y')).toBe('')
    w.unmount()
  })
})
