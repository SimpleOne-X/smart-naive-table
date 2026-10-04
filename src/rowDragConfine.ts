/**
 * 行拖拽「限定在表体内」。
 *
 * sortablejs 默认走浏览器原生 HTML5 拖放:拖影是浏览器自己画的位图,不在 DOM 里,谁也约束不了 ——
 * 指针拖到哪它就跟到哪(拖出表格、拖出页面),松手时再「弹回」。所以 useRowDrag 用 sortablejs 的
 * fallback 模式(`forceFallback`):拖影是 DOM 里的一份行克隆,位置由 sortablejs 按「指针相对按下点的位移」算。
 *
 * 约束的做法是**改写指针坐标**,而不是事后去改拖影的 transform:sortablejs 的拖影位移、落点判定
 * (`elementFromPoint`)、自动滚动的边缘判定读的都是同一份 `clientX / clientY`。在它之前(window 捕获阶段)
 * 把这两个值夹好,三件事自然一致 —— 拖影贴着表体边缘、指针在表外时落点就是最近的那一行、
 * 贴边仍能触发自动滚动。事后改 transform 的话,sortablejs 下一次 move 是在「上一次的 transform」上累加位移,
 * 夹出去的那段会累积成漂移。
 */

/** 表体的可视纵向范围(视口坐标) */
export interface DragBounds {
  top: number
  bottom: number
}

/** 拖影(sortablejs 的 fallbackClass / dragClass):样式在 SmartTable.vue */
export const GHOST_CLASS = 'smart-table-drag-ghost'
/** 拖动期间挂在 body 上的类:光标 grabbing、禁选文字(样式在 SmartTable.vue 的非 scoped 块) */
export const DRAGGING_BODY_CLASS = 'smart-table-row-dragging'
/** 拖影上下各留多少 px 给阴影(clip-path 只裁左右) */
const SHADOW_ROOM = 36

/**
 * 把指针 Y 夹到「被拖行整体落在表体内」的范围。
 * `grabY` 是按下点离行顶的距离(拖影顶 = 指针 Y - grabY);`viewportHeight` 一并限制指针不出视口 ——
 * 页面整体滚动、表体比视口长时,指针出了视口就没法触发窗口的自动滚动。
 * 表体比一行还矮(退化)时贴上沿,不抛。
 */
export function clampDragY(
  pointerY: number,
  grabY: number,
  rowHeight: number,
  bounds: DragBounds,
  viewportHeight: number,
): number {
  const min = Math.max(bounds.top + grabY, 0)
  const max = Math.min(bounds.bottom - (rowHeight - grabY), viewportHeight)
  return max < min ? min : Math.min(max, Math.max(min, pointerY))
}

/**
 * 拖影的横向裁剪:宽表横向滚动时,行比可视区宽,拖影(position: fixed,不受滚动容器裁剪)会伸出表格。
 * 只裁左右,上下留出阴影的位置(`inset` 的负值)。
 */
export function ghostClip(
  row: { left: number; right: number },
  clip: { left: number; right: number },
): string {
  const left = Math.max(0, clip.left - row.left)
  const right = Math.max(0, row.right - clip.right)
  return `inset(-${SHADOW_ROOM}px ${right}px -${SHADOW_ROOM}px ${left}px)`
}

/**
 * 拖影该在的视口位置(`want`)与实际量到的位置(`rect`)的差;在容差内返回 null。
 * 虚拟滚动(fillHeight)的内容区带 `transform: translateY(...)`,它会成为 `position: fixed` 拖影的包含块 ——
 * 内容区一滚(自动滚动、滚轮),拖影就跟着内容漂,脱离「指针 Y - 抓点」。每帧量一次、补回去。
 */
export function ghostCorrection(
  want: { left: number; top: number },
  rect: { left: number; top: number },
): { dx: number; dy: number } | null {
  const dx = want.left - rect.left
  const dy = want.top - rect.top
  return Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5 ? { dx, dy } : null
}

/** 拖影:sortablejs 把它插在容器(tbody / 卡片列表)里,带 fallbackClass */
function findGhost(container: HTMLElement): HTMLElement | undefined {
  return Array.from(container.children).find((c) => c.classList.contains(GHOST_CLASS)) as
    HTMLElement | undefined
}

/** 最近的会裁剪内容的祖先(纵向 overflow 为 auto / scroll / hidden / clip):虚拟滚动是 `.v-vl`,普通表是 n-scrollbar 的容器 */
function nearestClip(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    if (/auto|scroll|hidden|clip/.test(getComputedStyle(p).overflowY)) return p
  }
  return null
}

interface Point {
  clientX: number
  clientY: number
}
const MOVE_EVENTS = ['pointermove', 'mousemove', 'touchmove'] as const

/**
 * 拖动期间改写指针坐标:X 锁在按下处(只许纵向移动),Y 夹在表体可视范围内。
 * 返回解除函数(幂等)。在 sortablejs 的 `onChoose` 里调用 —— 比 `onStart` 早,
 * 起拖前的那几次 move 也被约束,横着拖不会起拖(也就不会和选中文字抢)。
 * 监听挂在 window 的捕获阶段,先于 sortablejs 挂在 document 上的 move 监听。
 */
export function confineRowDrag(tbody: HTMLElement, item: HTMLElement, down: Point): () => void {
  const itemRect = item.getBoundingClientRect()
  const grabY = down.clientY - itemRect.top
  const clip = nearestClip(tbody)
  // 表体范围每次现量:自动滚动、窗口缩放、行数变化都会改它
  const bounds = (): DragBounds => {
    const body = tbody.getBoundingClientRect()
    const vis = clip?.getBoundingClientRect()
    return {
      top: Math.max(body.top, vis?.top ?? -Infinity),
      bottom: Math.min(body.bottom, vis?.bottom ?? Infinity),
    }
  }
  const clampY = (rawY: number) =>
    clampDragY(rawY, grabY, itemRect.height, bounds(), window.innerHeight)
  let rawY = down.clientY // 最近一次指针的原始 Y(未夹)
  const pin = (p: Point) => {
    rawY = p.clientY
    const y = clampY(rawY)
    // 事件的坐标是原型上的只读访问器,在实例上定义同名自有属性即可遮住它
    Object.defineProperty(p, 'clientX', { value: down.clientX, configurable: true })
    Object.defineProperty(p, 'clientY', { value: y, configurable: true })
  }
  const onMove = (e: Event) => {
    const t = e as Event & { touches?: ArrayLike<Point>; changedTouches?: ArrayLike<Point> }
    if (t.touches) {
      for (const list of [t.touches, t.changedTouches])
        for (const p of Array.from(list ?? [])) pin(p)
    } else pin(e as unknown as Point)
  }
  MOVE_EVENTS.forEach((type) => window.addEventListener(type, onMove, true))

  // sortablejs 的拖影 transform 是 `matrix(a,b,c,d,e,f)`,下一次 move 在它的基础上累加位移,所以直接改 e / f 即可
  let raf = 0
  const keepGhost = () => {
    raf = requestAnimationFrame(keepGhost)
    const ghost = findGhost(tbody)
    if (!ghost) return
    const fix = ghostCorrection(
      // 自动滚动时指针不动、表体在动(范围变了),所以每帧按最新范围重夹,而不是沿用上一次 move 时夹出来的值
      { left: itemRect.left, top: clampY(rawY) - grabY },
      ghost.getBoundingClientRect(),
    )
    if (!fix) return
    const m = /matrix\(([^)]+)\)/.exec(ghost.style.transform)?.[1].split(',').map(Number)
    const [a, b, c, d, e, f] = m && m.length === 6 ? m : [1, 0, 0, 1, 0, 0]
    ghost.style.transform = `matrix(${a},${b},${c},${d},${e + fix.dx},${f + fix.dy})`
  }
  raf = requestAnimationFrame(keepGhost)

  return () => {
    cancelAnimationFrame(raf)
    MOVE_EVENTS.forEach((type) => window.removeEventListener(type, onMove, true))
  }
}

/**
 * 拖影修正(sortablejs 的 `onStart` 时拖影已插进容器)。
 * 表格行:拖影是 `position: fixed` 的 `<tr>`,会被浏览器当块处理、各列宽度重新按内容分配 —— 把源行每个单元格的实际宽度抄上去。
 * 所有形态:按表体可视区裁掉横向溢出。
 */
export function fitGhost(tbody: HTMLElement, item: HTMLElement): void {
  const ghost = findGhost(tbody)
  if (!ghost) return
  const itemRect = item.getBoundingClientRect()
  if (item.tagName === 'TR') {
    Array.from(item.children).forEach((cell, i) => {
      const to = ghost.children[i] as HTMLElement | undefined
      if (!to) return
      to.style.width = `${cell.getBoundingClientRect().width}px`
      to.style.boxSizing = 'border-box'
    })
  }
  const clip = nearestClip(tbody)
  if (clip) ghost.style.setProperty('clip-path', ghostClip(itemRect, clip.getBoundingClientRect()))
}
