// @vitest-environment jsdom
// 列宽把手的手势 UI(规格 §5.6 / 设计 3.11):拖动开始收起过滤气泡、body 光标类、贯穿整表的引导线、松手后 150ms 内吞掉 click
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { NDataTable } from 'naive-ui'
import SmartTable from '../src/SmartTable.vue'
import ColumnFilter from '../src/ColumnFilter.vue'
import type { SmartTableColumn } from '../src/types'

interface Row {
  id: number
  name: string
  code: string
}
const rows: Row[] = [
  { id: 1, name: 'alice', code: 'a' },
  { id: 2, name: 'bob', code: 'b' },
]
const columns: SmartTableColumn<unknown>[] = [
  { key: 'name', title: 'Name', width: 160, sorter: true, filter: true },
  { key: 'code', title: 'Code', width: 120 },
]

const mounted: VueWrapper[] = []
function mountTable() {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const w = mount(SmartTable, {
    props: {
      columns,
      data: rows,
      rowKey: 'id',
      resizable: true,
      pagination: false,
      search: false,
      toolbar: false,
    },
    attachTo: host,
  })
  mounted.push(w)
  return w
}
/** 模拟官方在拖动每一帧调用的 onUnstableColumnResize(用同名列;getColumnWidth 给「起始宽」)。 */
const dragFrame = (w: VueWrapper, limited: number, key = 'name') =>
  (w.findComponent(NDataTable).props('onUnstableColumnResize') as (...a: unknown[]) => void)(
    limited,
    limited,
    { key },
    () => 160,
  )

afterEach(() => {
  while (mounted.length) mounted.pop()!.unmount()
  document.body.innerHTML = ''
  document.body.className = ''
  vi.restoreAllMocks()
})

describe('拖动开始:收起过滤气泡', () => {
  it('第一帧起各列 ColumnFilter 收到的 closeRequest 递增(一个手势只递增一次)', async () => {
    const w = mountTable()
    const before = w.findComponent(ColumnFilter).props('closeRequest') as number
    dragFrame(w, 170)
    await nextTick()
    const after = w.findComponent(ColumnFilter).props('closeRequest') as number
    expect(after).toBe(before + 1)
    dragFrame(w, 180)
    dragFrame(w, 190)
    await nextTick()
    expect(w.findComponent(ColumnFilter).props('closeRequest')).toBe(after) // 同一手势后续帧不再递增
  })
})

describe('拖动中的 body 光标类与引导线', () => {
  it('第一帧加 body.smart-table-resizing,松手(window mouseup)去掉;拖动中途卸载也要去掉', async () => {
    const w = mountTable()
    expect(document.body.classList.contains('smart-table-resizing')).toBe(false)
    dragFrame(w, 170)
    expect(document.body.classList.contains('smart-table-resizing')).toBe(true)
    window.dispatchEvent(new MouseEvent('mouseup'))
    expect(document.body.classList.contains('smart-table-resizing')).toBe(false)

    dragFrame(w, 170)
    expect(document.body.classList.contains('smart-table-resizing')).toBe(true)
    w.unmount()
    mounted.pop()
    expect(document.body.classList.contains('smart-table-resizing')).toBe(false)
  })

  it('拖动中有贯穿整表的引导线(落在被拖列的右缘 = 左缘 + 限幅后的宽度,再左移 1px 压在边线上),松手消失', async () => {
    const w = mountTable()
    expect(document.querySelector('.smart-table-resize-guide')).toBeNull()
    dragFrame(w, 200)
    await nextTick()
    const guide = document.querySelector<HTMLElement>('.smart-table-resize-guide')!
    expect(guide).not.toBeNull()
    expect(guide.style.left).toBe('199px') // jsdom 里所有 rect 都是 0:左缘 0 + 200 − 0 − 1
    expect(guide.getAttribute('aria-hidden')).toBe('true')
    dragFrame(w, 230)
    await nextTick()
    expect(guide.style.left).toBe('229px') // 跟手
    window.dispatchEvent(new MouseEvent('mouseup'))
    await nextTick()
    expect(document.querySelector('.smart-table-resize-guide')).toBeNull()
  })
})

describe('松手后 150ms 内吞掉 click(松手落在表头上会连带触发排序)', () => {
  it('松手后 150ms 内的 click 到不了 th(捕获阶段被拦);之后的 click 正常', async () => {
    const w = mountTable()
    const th = document.querySelector<HTMLElement>('thead th[data-col-key="name"]')!
    const onClick = vi.fn()
    th.addEventListener('click', onClick)

    let now = 1000
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    dragFrame(w, 200)
    window.dispatchEvent(new MouseEvent('mouseup')) // endResize:swallowClickUntil = 1000 + 150

    now = 1100
    th.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    expect(onClick).not.toHaveBeenCalled() // 100ms:吞掉

    now = 1200
    th.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    expect(onClick).toHaveBeenCalledTimes(1) // 200ms:放行
  })

  it('没有发生过拖动的普通点击不受影响(纯点击把手、没有任何 resize 帧时不吞)', () => {
    mountTable()
    const th = document.querySelector<HTMLElement>('thead th[data-col-key="name"]')!
    const onClick = vi.fn()
    th.addEventListener('click', onClick)
    th.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})

describe('触屏拖把手:官方把手只认鼠标事件,手指拖动转成合成鼠标事件', () => {
  /** jsdom 没有 Touch 构造器:造一个带 touches 的普通事件。 */
  const touch = (type: string, x: number, y = 5, fingers = 1) => {
    const ev = new Event(type, { bubbles: true, cancelable: true }) as Event & {
      touches: Array<{ clientX: number; clientY: number }>
    }
    ev.touches = Array.from({ length: fingers }, () => ({ clientX: x, clientY: y }))
    return ev
  }
  const handle = () => document.querySelector<HTMLElement>('.n-data-table-resize-button')!

  it('touchstart 落在把手上 → 把手收到 mousedown(同坐标);touchmove → window 收到 mousemove;touchend → window 收到 mouseup;touchstart 被 preventDefault', () => {
    mountTable()
    const down = vi.fn()
    const move = vi.fn()
    const up = vi.fn()
    handle().addEventListener('mousedown', down)
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)

    const start = touch('touchstart', 100)
    handle().dispatchEvent(start)
    expect(start.defaultPrevented).toBe(true)
    expect(down).toHaveBeenCalledTimes(1)
    expect((down.mock.calls[0][0] as MouseEvent).clientX).toBe(100)

    const mv = touch('touchmove', 130)
    window.dispatchEvent(mv)
    expect(mv.defaultPrevented).toBe(true) // 阻止页面跟着滚
    expect(move).toHaveBeenCalledTimes(1)
    expect((move.mock.calls[0][0] as MouseEvent).clientX).toBe(130)

    window.dispatchEvent(touch('touchend', 130, 5, 0))
    expect(up).toHaveBeenCalledTimes(1)

    // 手势结束后 touchmove 不再转发
    window.dispatchEvent(touch('touchmove', 160))
    expect(move).toHaveBeenCalledTimes(1)
    window.removeEventListener('mousemove', move)
    window.removeEventListener('mouseup', up)
  })

  it('落在把手之外的 touchstart、多指触摸:不处理(照常滚动 / 缩放)', () => {
    mountTable()
    const down = vi.fn()
    handle().addEventListener('mousedown', down)
    const th = document.querySelector<HTMLElement>('thead th')!
    const outside = touch('touchstart', 50)
    th.dispatchEvent(outside)
    expect(outside.defaultPrevented).toBe(false)
    const twoFingers = touch('touchstart', 50, 5, 2)
    handle().dispatchEvent(twoFingers)
    expect(twoFingers.defaultPrevented).toBe(false)
    expect(down).not.toHaveBeenCalled()
  })

  it('touchcancel 也收尾(发 mouseup);拖动中卸载摘掉 window 上的 touch 监听', () => {
    const w = mountTable()
    const up = vi.fn()
    window.addEventListener('mouseup', up)
    handle().dispatchEvent(touch('touchstart', 100))
    window.dispatchEvent(touch('touchcancel', 100, 5, 0))
    expect(up).toHaveBeenCalledTimes(1)

    handle().dispatchEvent(touch('touchstart', 100))
    const remove = vi.spyOn(window, 'removeEventListener')
    w.unmount()
    mounted.pop()
    expect(remove.mock.calls.map((c) => c[0])).toEqual(
      expect.arrayContaining(['touchmove', 'touchend', 'touchcancel']),
    )
    window.removeEventListener('mouseup', up)
  })
})
