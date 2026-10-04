// @vitest-environment jsdom
// 行拖拽的「限定在表体内」:指针夹取(纯函数 + DOM 接线)、传给 sortablejs 的选项、拖影的列宽 / 裁剪。
// jsdom 没有布局,所有 getBoundingClientRect 都是测试里手工指定的;真实拖拽要在浏览器里用 CDP 验证。
import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref, type EffectScope } from 'vue'
import { clampDragY, ghostClip, ghostCorrection } from '../src/rowDragConfine'
import { useRowDrag, type SortableFactory, type SortableOptions } from '../src/useRowDrag'

const rect = (left: number, top: number, right: number, bottom: number): DOMRect =>
  ({
    left,
    top,
    right,
    bottom,
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
    toJSON: () => ({}),
  }) as DOMRect
const place = (el: Element, r: DOMRect) => {
  el.getBoundingClientRect = () => r
}

describe('clampDragY:把指针 Y 夹到「被拖行整体落在表体内」的范围', () => {
  const bounds = { top: 100, bottom: 500 }
  // 行高 40、抓在行内 10px 处 → 指针 Y 的合法范围 = [100 + 10, 500 - (40 - 10)] = [110, 470]
  it('范围内原样返回', () => {
    expect(clampDragY(300, 10, 40, bounds, 900)).toBe(300)
  })
  it('越过上沿 / 下沿时夹回,且被拖行刚好贴边', () => {
    expect(clampDragY(-999, 10, 40, bounds, 900)).toBe(110)
    expect(clampDragY(9999, 10, 40, bounds, 900)).toBe(470)
  })
  it('表体比视口长(页面整体滚动)时,指针不能出视口:上限取视口高度', () => {
    expect(clampDragY(9999, 10, 40, { top: 100, bottom: 5000 }, 800)).toBe(800)
    expect(clampDragY(-5, 10, 40, { top: -300, bottom: 5000 }, 800)).toBe(0)
  })
  it('表体矮于一行(退化)时不抛、贴上沿', () => {
    expect(clampDragY(300, 10, 40, { top: 100, bottom: 120 }, 900)).toBe(110)
  })
})

describe('ghostClip:拖影只露出表格可视区内的那一段(宽表横向滚动时不会伸出表格)', () => {
  it('行比可视区宽:右 / 左各裁掉溢出的部分,上下留出阴影的位置', () => {
    expect(ghostClip({ left: 0, right: 1728 }, { left: 0, right: 1064 })).toBe(
      'inset(-36px 664px -36px 0px)',
    )
    expect(ghostClip({ left: -200, right: 1528 }, { left: 0, right: 1064 })).toBe(
      'inset(-36px 464px -36px 200px)',
    )
  })
  it('行没有超出可视区:左右各 0(阴影也不伸到表格外面)', () => {
    expect(ghostClip({ left: 0, right: 800 }, { left: 0, right: 1064 })).toBe(
      'inset(-36px 0px -36px 0px)',
    )
  })
})

describe('ghostCorrection:拖影实际位置与期望位置的差', () => {
  const want = { left: 40, top: 180 }
  it('在容差(0.5px)内不改', () => {
    expect(ghostCorrection(want, rect(40.3, 179.8, 300, 220))).toBeNull()
  })
  it('偏了就返回要补的位移', () => {
    expect(ghostCorrection(want, rect(40, 170, 300, 210))).toEqual({ dx: 0, dy: 10 })
    expect(ghostCorrection(want, rect(55, 200, 300, 240))).toEqual({ dx: -15, dy: -20 })
  })
})

/* ---- 经 useRowDrag 接线:拿到传给 sortablejs 的选项,手动触发它的回调 ---- */
interface Row {
  id: number
}
interface Captured {
  opts: SortableOptions
  destroyed: boolean
}
const scopes: EffectScope[] = []
afterEach(() => {
  scopes.splice(0).forEach((s) => s.stop())
  document.body.innerHTML = ''
  document.body.className = ''
})

/** 3 行 × 2 列的表体:滚动容器 [100,220],行高 40;第 2 行带一个拖影行(sortablejs 在 fallback 模式下插进 tbody 的克隆) */
function buildTable() {
  const scroller = document.createElement('div')
  scroller.style.overflowY = 'auto'
  const table = document.createElement('table')
  const tbody = document.createElement('tbody')
  table.append(tbody)
  scroller.append(table)
  document.body.append(scroller)
  const trs = [0, 1, 2].map((i) => {
    const tr = document.createElement('tr')
    for (let c = 0; c < 2; c++) tr.append(document.createElement('td'))
    place(tr, rect(0, 100 + i * 40, 300, 140 + i * 40))
    place(tr.children[0], rect(0, 100 + i * 40, 100, 140 + i * 40))
    place(tr.children[1], rect(100, 100 + i * 40, 300, 140 + i * 40))
    tbody.append(tr)
    return tr
  })
  place(tbody, rect(0, 100, 300, 220))
  place(scroller, rect(0, 100, 250, 220))
  return { tbody, trs, scroller }
}

async function mountDrag(tbody: HTMLElement) {
  const captured: Captured[] = []
  const factory: SortableFactory = {
    create: (_el, opts) => {
      const c = { opts, destroyed: false }
      captured.push(c)
      return { destroy: () => (c.destroyed = true) }
    },
  }
  const rows = ref<Row[]>([{ id: 1 }, { id: 2 }, { id: 3 }])
  const scope = effectScope()
  scopes.push(scope)
  const drag = scope.run(() =>
    useRowDrag<Row>({
      enabled: () => true,
      getTbody: () => tbody,
      rows: () => rows.value,
      onSort: () => {},
      load: async () => factory,
    }),
  )!
  await nextTick()
  await drag.settled()
  return { opts: captured[0].opts, captured, scope }
}

/** 记录「文档上的监听者」看到的坐标:sortablejs 的监听就挂在 document 上 */
function probe(type: string) {
  const seen: { x: number; y: number }[] = []
  const fn = (e: Event) => seen.push({ x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY })
  document.addEventListener(type, fn)
  return { seen, off: () => document.removeEventListener(type, fn) }
}
const move = (type: string, x: number, y: number) =>
  document.body.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true }))

describe('传给 sortablejs 的选项', () => {
  it('强制走 fallback(拖影在 DOM 里,才能被约束)、拖影留在表体内、更柔和的动画与自带的 class', async () => {
    const { tbody } = buildTable()
    const { opts } = await mountDrag(tbody)
    expect(opts.forceFallback).toBe(true)
    expect(opts.fallbackOnBody).toBe(false) // 拖到 body 下会丢掉 n-data-table 子树里的 --n-* 变量,拖影变成没样式的裸行
    expect(opts.fallbackTolerance).toBeGreaterThanOrEqual(3) // 原生 DnD 有 ~4px 起拖阈值;fallback 默认 0,点一下手柄就会误起拖
    expect(opts.animation).toBeGreaterThanOrEqual(150)
    expect(opts.animation).toBeLessThanOrEqual(200)
    expect(opts.easing).toBe('cubic-bezier(0.2, 0, 0, 1)')
    expect(opts.ghostClass).toBe('smart-table-drag-placeholder')
    expect(opts.chosenClass).toBe('smart-table-drag-chosen')
    expect(opts.fallbackClass).toBe('smart-table-drag-ghost')
    expect(opts.scrollSensitivity).toBeGreaterThan(30) // 指针被夹在表体内,贴不到容器边;灵敏区要比默认 30 大才能触发自动滚动
  })
})

describe('指针约束(onChoose 开始、onUnchoose / onEnd 结束)', () => {
  const down = { clientX: 50, clientY: 150 } // 按在第 2 行(top 140)内 10px 处

  it('拖动中:X 锁在按下处,Y 夹在表体内 —— 指针拖到表格外面(左 / 右 / 上 / 下)也一样', async () => {
    const { tbody, trs } = buildTable()
    const { opts } = await mountDrag(tbody)
    const p = probe('pointermove')
    opts.onChoose?.({ item: trs[1], originalEvent: down } as never)

    move('pointermove', -400, 9999) // 往左下方远远拖出去
    move('pointermove', 5000, -9999) // 往右上方
    move('pointermove', 70, 160) // 回到表内(但 X 不是按下处)
    // 表体 [100,220] 行高 40 抓点 10 → Y 合法范围 [110, 190];X 恒为 50
    expect(p.seen).toEqual([
      { x: 50, y: 190 },
      { x: 50, y: 110 },
      { x: 50, y: 160 },
    ])
    p.off()
  })

  it('mousemove / touchmove 同样被约束(sortablejs 在无 PointerEvent 的环境下听的是它们)', async () => {
    const { tbody, trs } = buildTable()
    const { opts } = await mountDrag(tbody)
    const m = probe('mousemove')
    opts.onChoose?.({ item: trs[1], originalEvent: down } as never)
    move('mousemove', -400, 9999)
    expect(m.seen).toEqual([{ x: 50, y: 190 }])
    m.off()

    const touch = { clientX: -10, clientY: -10 }
    const ev = new Event('touchmove', { bubbles: true })
    Object.assign(ev, { touches: [touch], changedTouches: [touch] })
    let got: { clientX: number; clientY: number } | undefined
    const onTouch = (e: Event) => (got = (e as unknown as { touches: (typeof touch)[] }).touches[0])
    document.addEventListener('touchmove', onTouch)
    document.body.dispatchEvent(ev)
    document.removeEventListener('touchmove', onTouch)
    expect(got).toMatchObject({ clientX: 50, clientY: 110 })
  })

  it('onUnchoose 之后不再改写;放手没拖动(只是点了一下)也会走到它', async () => {
    const { tbody, trs } = buildTable()
    const { opts } = await mountDrag(tbody)
    const p = probe('pointermove')
    opts.onChoose?.({ item: trs[1], originalEvent: down } as never)
    opts.onUnchoose?.({} as never)
    move('pointermove', -400, 9999)
    expect(p.seen).toEqual([{ x: -400, y: 9999 }])
    p.off()
  })

  it('onEnd 也会解除;重复解除不抛;作用域销毁时(拖动中被卸载)同样解除并清掉 body 上的类', async () => {
    const { tbody, trs } = buildTable()
    const { opts, scope } = await mountDrag(tbody)
    const p = probe('pointermove')

    opts.onChoose?.({ item: trs[1], originalEvent: down } as never)
    opts.onStart?.({ item: trs[1] } as never)
    expect(document.body.classList.contains('smart-table-row-dragging')).toBe(true)
    opts.onEnd({ oldIndex: 1, newIndex: 1 })
    expect(document.body.classList.contains('smart-table-row-dragging')).toBe(false)
    opts.onUnchoose?.({} as never) // 重复
    move('pointermove', -400, 9999)
    expect(p.seen).toEqual([{ x: -400, y: 9999 }])

    opts.onChoose?.({ item: trs[1], originalEvent: down } as never)
    opts.onStart?.({ item: trs[1] } as never)
    scope.stop() // 拖动中被卸载
    expect(document.body.classList.contains('smart-table-row-dragging')).toBe(false)
    move('pointermove', -400, 9999)
    expect(p.seen.at(-1)).toEqual({ x: -400, y: 9999 })
    p.off()
  })

  it('拿不到按下的坐标(未知形态的 originalEvent)时不约束,也不抛', async () => {
    const { tbody, trs } = buildTable()
    const { opts } = await mountDrag(tbody)
    const p = probe('pointermove')
    expect(() => opts.onChoose?.({ item: trs[1] } as never)).not.toThrow()
    move('pointermove', -400, 9999)
    expect(p.seen).toEqual([{ x: -400, y: 9999 }])
    p.off()
  })
})

describe('拖影(onStart)', () => {
  it('表格行:拖影被浏览器当成块,列宽会塌 —— 把源行每个单元格的宽度抄上去;并按可视区裁掉横向溢出', async () => {
    const { tbody, trs } = buildTable()
    const ghost = document.createElement('tr')
    ghost.className = 'smart-table-drag-ghost'
    for (let c = 0; c < 2; c++) ghost.append(document.createElement('td'))
    tbody.append(ghost)
    const { opts } = await mountDrag(tbody)

    opts.onStart?.({ item: trs[1] } as never)
    const cells = [...ghost.children] as HTMLElement[]
    expect(cells.map((c) => c.style.width)).toEqual(['100px', '200px'])
    expect(cells.every((c) => c.style.boxSizing === 'border-box')).toBe(true)
    // 行 [0,300],滚动容器可视区 [0,250] → 右边裁掉 50
    expect(ghost.style.getPropertyValue('clip-path')).toBe('inset(-36px 50px -36px 0px)')
  })

  it('卡片(非 tr)不动单元格宽度', async () => {
    const { tbody } = buildTable()
    const card = document.createElement('div')
    card.append(document.createElement('div'))
    place(card, rect(0, 100, 300, 180))
    tbody.append(card)
    const ghost = document.createElement('div')
    ghost.className = 'smart-table-drag-ghost'
    ghost.append(document.createElement('div'))
    tbody.append(ghost)
    const { opts } = await mountDrag(tbody)
    opts.onStart?.({ item: card } as never)
    expect((ghost.children[0] as HTMLElement).style.width).toBe('')
  })
})

describe('拖影钉在视口坐标上(虚拟滚动的内容区带 transform,fixed 的拖影会跟着内容漂)', () => {
  it('每帧量拖影的实际位置,偏了就改它的 transform 补回;解除后不再动', async () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] })
    try {
      const { tbody, trs } = buildTable()
      const ghost = document.createElement('tr')
      ghost.className = 'smart-table-drag-ghost'
      ghost.style.transform = 'matrix(1,0,0,1,0,30)'
      tbody.append(ghost)
      // 期望:按下点在行内 10px 处,指针被夹到 y=190 → 拖影顶应在 180;实际量到 170(内容区的 transform 把它带偏了)
      place(ghost, rect(0, 170, 300, 210))
      const { opts } = await mountDrag(tbody)
      opts.onChoose?.({ item: trs[1], originalEvent: { clientX: 50, clientY: 150 } } as never)
      move('pointermove', -400, 9999)

      vi.advanceTimersToNextFrame()
      expect(ghost.style.transform.replace(/\s/g, '')).toBe('matrix(1,0,0,1,0,40)')

      // 自动滚动:指针没动、表体范围变了(下沿从 220 缩到 200 → 指针 Y 上限 170 → 拖影顶应在 160),下一帧按新范围重夹
      place(tbody, rect(0, 100, 300, 200))
      place(ghost, rect(0, 180, 300, 220))
      vi.advanceTimersToNextFrame()
      expect(ghost.style.transform.replace(/\s/g, '')).toBe('matrix(1,0,0,1,0,20)')

      opts.onUnchoose?.({} as never)
      place(ghost, rect(0, 100, 300, 140))
      vi.advanceTimersToNextFrame()
      expect(ghost.style.transform.replace(/\s/g, '')).toBe('matrix(1,0,0,1,0,20)')
    } finally {
      vi.useRealTimers()
    }
  })
})
