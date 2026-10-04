// 「放大」(toolbar.maximize,页面内最大化)的无 UI 辅助:配置解析、背景滚动锁定、输入方式追踪、浮层探测、Tab 循环。
// 全部写成可在 jsdom 单测的函数;SmartTable 只做接线(Teleport / 状态 / 事件)。设计依据:设计文档 7.2、9.2、9.7(spike s2)。
import type { ToolbarConfig } from './types'

/**
 * 放大层默认层级。刻意低于 2000:naive 的 Popover / Drawer / Modal / Select 菜单等动态浮层从 2000 起递增
 * (vdirs 的 z-index-manager:nextZIndex = 2000),放大后表格自己弹出的筛选气泡、抽屉、下拉才会显示在它上面。
 */
export const DEFAULT_MAXIMIZE_Z = 1999

export interface MaximizeOptions {
  enabled: boolean
  zIndex: number
}

/** `toolbar.maximize`:`true` / `{ zIndex }` 开启;未传 / `false` / `{ enabled... }` 之外一律关闭。 */
export function resolveMaximize(cfg: ToolbarConfig['maximize']): MaximizeOptions {
  if (cfg === true) return { enabled: true, zIndex: DEFAULT_MAXIMIZE_Z }
  if (cfg && typeof cfg === 'object') {
    const z = cfg.zIndex
    return {
      enabled: true,
      zIndex: typeof z === 'number' && Number.isFinite(z) ? z : DEFAULT_MAXIMIZE_Z,
    }
  }
  return { enabled: false, zIndex: DEFAULT_MAXIMIZE_Z }
}

/* ---- 背景滚动锁定:放大态下滚轮打在放大层空白处,宿主页面照样会滚(spike s2 实测 scrollY 0 → 600) ---- */

let lockCount = 0
let savedOverflow = ''

/** `html { overflow: hidden }`;计数,多张表 / 重复调用只在 0 → 1 时记下原值,1 → 0 时还原原值。 */
export function lockScroll(): void {
  if (typeof document === 'undefined') return
  if (lockCount++ === 0) {
    savedOverflow = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
  }
}

export function unlockScroll(): void {
  if (typeof document === 'undefined' || lockCount === 0) return
  if (--lockCount === 0) document.documentElement.style.overflow = savedOverflow
}

/* ---- 输入方式追踪:只有键盘操作才把焦点还给「放大 / 还原」按钮(鼠标点按后再 focus() 会画出黑色焦点环) ---- */

let modalityUsers = 0
let keyboardModality = false
const onKey = () => {
  keyboardModality = true
}
const onPointer = () => {
  keyboardModality = false
}

/** 开始追踪(捕获阶段挂在 document 上,引用计数);返回释放函数。 */
export function trackInputModality(): () => void {
  if (typeof document === 'undefined') return () => undefined
  if (modalityUsers++ === 0) {
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('pointerdown', onPointer, true)
  }
  let released = false
  return () => {
    if (released) return
    released = true
    if (--modalityUsers === 0) {
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('pointerdown', onPointer, true)
      keyboardModality = false
    }
  }
}

/** 最近一次输入是键盘吗(没有任何输入时为 false)。 */
export function isKeyboardModality(): boolean {
  return keyboardModality
}

/* ---- Esc 分层:先收气泡 / 抽屉 / 下拉(它们自己处理 Esc),没有浮层了再 Esc 才还原 ---- */

/**
 * 当前有没有打开的浮层(naive 的 Popover / Select 菜单 / Dropdown / DatePicker 面板都经 vueuc Follower teleport 到 body 的
 * `.v-binder-follower-content`;Drawer / Modal 是各自的容器)。必须在 keydown 的**捕获阶段**读:冒泡阶段 NSelect / NDatePicker
 * 已先把自己关掉,读到的就是「没有浮层」,会把整张表一起还原。
 * 两种不算打开:① 关闭后留在 DOM 里的壳(vueuc 的 follower 不会随关闭卸载,实测:里面的菜单被 `v-show` 成 `display: none`,
 * 或者壳里已经没有子元素);② Tooltip(`.n-tooltip`):鼠标停在按钮上它一直开着,算进去会让 Esc 在鼠标没挪开时永远还原不了。
 */
export const FLOAT_SELECTOR = '.v-binder-follower-content, .n-drawer-container, .n-modal-container'

export function hasOpenFloat(doc: Document = document): boolean {
  for (const el of Array.from(doc.querySelectorAll<HTMLElement>(FLOAT_SELECTOR))) {
    const child = el.firstElementChild
    if (!child || child.classList.contains('n-tooltip')) continue
    if (getComputedStyle(child).display === 'none') continue
    return true
  }
  return false
}

/* ---- Tab 循环(放大层是 role=dialog aria-modal:焦点不能走回被盖住的宿主页面) ---- */

export const FOCUSABLE =
  'input:not([disabled]), button:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'

/**
 * Tab / Shift+Tab 走到放大层的首 / 尾时绕回另一端。返回是否处理了(调用方据此 preventDefault 已在此完成)。
 * 放大层 teleport 在 body 末尾,所以 Tab 走过最后一个控件会去浏览器界面(不会进宿主页面),只有 Shift+Tab 越过第一个控件会掉回宿主页面;
 * 两个方向都绕回,行为对称。浮层(筛选面板等)是 teleport 出去的,自带焦点循环,不经过这里。
 */
export function loopTab(e: KeyboardEvent, layer: HTMLElement): boolean {
  if (e.key !== 'Tab') return false
  const items = Array.from(layer.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.tabIndex >= 0,
  )
  if (items.length === 0) return false
  const first = items[0]
  const last = items[items.length - 1]
  const cur = document.activeElement
  if (e.shiftKey && (cur === first || cur === layer || !layer.contains(cur))) {
    e.preventDefault()
    last.focus()
    return true
  }
  if (!e.shiftKey && cur === last) {
    e.preventDefault()
    first.focus()
    return true
  }
  return false
}
