// @vitest-environment jsdom
// 按钮里的图标统一成一套几何(设计 §2.15 A):24 视口、笔画 2、round、1em(跟随按钮图标槽:medium 18px / large 20px)。
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { PlusIcon, ResetIcon, CheckIcon } from '../src/icons'

describe('按钮图标的几何', () => {
  it('加号 = 24 视口、笔画 2、round、1em,与其它按钮图标一致', () => {
    const svg = mount(PlusIcon).element
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24')
    expect(svg.getAttribute('width')).toBe('1em')
    expect(svg.getAttribute('height')).toBe('1em')
    expect(svg.getAttribute('stroke-width')).toBe('2')
    expect(svg.getAttribute('stroke-linecap')).toBe('round')
    expect(svg.getAttribute('stroke-linejoin')).toBe('round')
    expect(svg.getAttribute('aria-hidden')).toBe('true')
    expect(svg.querySelector('path')!.getAttribute('d')).toBe('M12 5v14M5 12h14')
  })

  it('加号与重置 / 对勾的视口和笔画一致', () => {
    const geom = (el: Element) => [
      el.getAttribute('viewBox'),
      el.getAttribute('stroke-width'),
      el.getAttribute('width'),
    ]
    const plus = geom(mount(PlusIcon).element)
    expect(geom(mount(ResetIcon).element)).toEqual(plus)
    expect(geom(mount(CheckIcon).element)).toEqual(plus)
  })
})
