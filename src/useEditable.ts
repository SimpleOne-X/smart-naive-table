// 可编辑表格(props.editable)的状态机与单元格渲染:SmartTable 只做加法式接线(overlay 数据 / 列的 render + cellProps / 行 class / 工具栏按钮),逻辑都在这里。
//
// 模型:「选中格 → 进入编辑」+ 批量保存。
//   · 改动是草稿,叠在数据上(createEditStore.overlay),不改宿主的行对象 —— 搜索 / 翻页 / 重新请求都不丢草稿(翻页不拦截,草稿跨页保留);
//   · 新增行 / 删除所选也是待保存(新行默认放第 1 行、待删行划线淡化、可撤销),「保存修改(N)」→ @save,宿主提交后 done() 才清草稿;
//   · 选中框是 DOM 属性(data-xsel)而不是响应式状态:方向键移动选中格时不重渲染整页(100 行 × 14 列重渲一次几十毫秒,按住方向键会卡);
//     Vue 打补丁只比较新旧 vnode,不会碰这个手工加的属性,每次状态变化 / 表体滚动后 repaint 一次兜底(td 被重建时,如虚拟滚动);
//   · 进入编辑 / 脏标记 / 校验错误是响应式的,只重渲染受影响的单元格(Naive 每个单元格是独立组件,column.render 里读到的状态由它自己追踪)。
// 键盘 / 复制粘贴 / 「点到别处提交」挂在 document 捕获阶段:编辑控件里的浮层(下拉菜单 / 日期面板)被 Teleport 到 body,不在表格 DOM 里。
import {
  computed,
  h,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
  type ComputedRef,
  type VNodeChild,
} from 'vue'
import { NCheckbox, NSpin, NTooltip, useThemeVars } from 'naive-ui'
import type {
  CellChange,
  EditableConfig,
  EditChanges,
  EditInvalid,
  EditorKind,
  EditSavePayload,
  SmartTableColumn,
  SmartTableDataColumn,
  SmartTableLabels,
  SmartTableOption,
  SelectTableProps,
} from './types'
import {
  createEditStore,
  fromEditString,
  inferEditorInfo,
  toEditString,
  validateEdit,
  validateEditAsync,
  validateEditPending,
  type EditorCtrl,
  type EditorInfo,
  type ValidateCtx,
} from './editable'
import { filterDefTitle, isSpecialColumn } from './useColumns'
import { fmt } from './labels'
import { optionLabel } from './useOptions'
import EditableEditor from './EditableEditor.vue'
import EditableTextPop from './EditableTextPop.vue'
import type { SheetField } from './EditableSheet.vue'

export type EditMove = 'up' | 'down' | 'left' | 'right'

/** 当前处于编辑态的格。val 是控件的原始值(字符串 / 数字 / 数组 / 日期串),提交时才校验并规整。 */
interface EditState {
  id: string
  key: string
  kind: EditorKind
  val: unknown
  typed?: string
  selectAll: boolean
}

/** 窄档抽屉表单的状态:整行即时保存(与批量草稿互不混用)。locked = 这一行里锁定(只读)的列。 */
export interface EditFormState {
  id: string
  isNew: boolean
  vals: Record<string, unknown>
  errs: Record<string, string>
  saving: boolean
  locked: string[]
}

export interface UseEditableOpts<T extends object> {
  enabled: () => boolean
  config: () => EditableConfig<T>
  rowKey: (row: T) => string | number
  /** 表格 row-key 是字段名时给出它,新增行没带键时往这个字段写临时键;函数形式的 row-key 由宿主在 newRow() 里给键。 */
  rowKeyField: () => string | undefined
  columns: () => SmartTableColumn<T>[]
  /** 未叠草稿的当前数据(推断取样 / 草稿的原值 / 查行)。 */
  baseRows: () => T[]
  labels: () => Required<SmartTableLabels>
  getOptions: (key: string) => SmartTableOption[]
  hasCellSlot: (key: string) => boolean
  /** 空值占位(窄档卡片里空值显示它)。 */
  emptyText: () => string
  /** 当前可见的叶子数据列 key(显示序)。 */
  visibleKeys: () => string[]
  /** 当前页显示的行(已叠草稿、含新增行)。 */
  pageRows: () => T[]
  scope: () => HTMLElement | null
  /** 窄档卡片正在显示:不逐格编辑,点卡片开抽屉表单。 */
  cardMode: () => boolean
  /** 翻到新增行所在的页(顶部 = 第 1 页,底部 = 最后一页);已经在那一页时不应发请求。 */
  goEdgePage: (position: 'top' | 'bottom') => Promise<void>
  checkedKeys: () => Array<string | number>
  clearChecked: () => void
  /** 保存成功后刷新(远程重查当前页;本地模式空操作)。 */
  reload: () => Promise<void>
  hasSaveListener: () => boolean
  /** 虚拟滚动(fillHeight)下目标行不在渲染窗口里时,把第 index 行滚进视口。 */
  revealRow?: (index: number) => void
  onCellChange: (p: CellChange<T>) => void
  onSave: (p: EditSavePayload<T>) => void
  onDiscard: () => void
  onInvalid: (p: EditInvalid<T>) => void
  onError: (e: unknown) => void
}

/** 当前「活跃」的可编辑表格:页面上有多张可编辑表时,方向键 / 粘贴只给最后操作过的那一张。 */
let activeOwner: symbol | null = null

const q = (s: string): string => s.replace(/["\\]/g, '\\$&')
const NL = /\r\n?|\n/
const TRUE_TEXT = /^(true|1|yes|y|是|√|✓|x)$/i

/** 解析剪贴板文本(Excel:制表符分列、换行分行,末尾多一个换行不产生空行)。 */
export function parseClipboard(text: string): string[][] {
  const lines = text.split(NL)
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop()
  return lines.map((l) => l.split('\t'))
}

export function useEditable<T extends object>(opts: UseEditableOpts<T>) {
  const owner = Symbol('smart-table-editable')
  const store = createEditStore<T>(opts.rowKey)
  const idOf = store.idOf
  const enabled = computed(() => opts.enabled())
  const count = store.count
  const isDirty = computed(() => count.value > 0)
  /** 带草稿、但不在当前页里的行数(「保存修改」旁的「含 M 条当前不可见」);pageRows 含新增行与待删行,所以它们在本页就算可见。 */
  const hiddenDirty = computed(() => store.hiddenCount(opts.pageRows().map(idOf)))
  const saving = ref(false)
  const themeVars = useThemeVars()
  const edit = ref<EditState | null>(null)
  const err = ref<{ id: string; key: string; message: string } | null>(null)
  const form = ref<EditFormState | null>(null)
  /** 提交后异步校验未通过的格(key = `${id}|${列}`),一直标红直到重新改它;checking = 还在等结果的格(值 = 令牌,过期结果按令牌丢弃)。 */
  const bad = reactive(new Map<string, string>())
  const checking = reactive(new Map<string, number>())
  const settling = new Set<Promise<unknown>>()
  let checkSeq = 0
  /** 非响应式:选中格(见文件头注释)。 */
  let sel: { id: string; key: string } | null = null
  /** 点到编辑格之外提交后,紧接着的这次点击只选中、不进入编辑。 */
  let skipEnter = false
  /** 新增行后等它出现在当前页再进入编辑(回第 1 页的请求可能还没回来)。 */
  let pendingEdit: { id: string; key: string } | null = null
  /** 下拉里按 Enter 选中:选中后提交并下移一格(Space / 鼠标选中不动)。 */
  let selectPickMove: EditMove | null = null

  /**
   * 选中框 / 编辑框 / 脏标记 / 校验框 / 窄档卡片底色(库自己的根元素上取不到 var(--n-*),经 CSS 变量下发,明暗跟随主题)。
   * td 内部(编辑器、新增行底色)不走这里:直接用 NDataTable 根上的 var(--n-merged-td-color),放进 modal / drawer / popover 时跟随官方换色。
   * 脏标记取设计原型 --warn:亮 #d97706 / 暗 #fbbf24(白底 / 卡片底上对比度够;官方 warningColor 在白底上偏浅)。
   */
  const noVars: Record<string, string> = {}
  const styleVars = computed<Record<string, string>>(() => {
    if (!enabled.value) return noVars
    const v = themeVars.value
    const dark = v.baseColor.toLowerCase() === '#000'
    return {
      '--smart-table-xl-primary': v.primaryColor,
      '--smart-table-xl-error': v.errorColor,
      '--smart-table-xl-warn': dark ? '#fbbf24' : '#d97706',
      '--smart-table-xl-bg': v.cardColor,
      '--smart-table-xl-ro': v.textColor3,
    }
  })

  /* ---- 列与推断 ---- */

  function leaves(): SmartTableDataColumn<T>[] {
    const out: SmartTableDataColumn<T>[] = []
    const walk = (cols: SmartTableColumn<T>[]) => {
      for (const c of cols) {
        if (isSpecialColumn(c)) continue
        if (c.children?.length) walk(c.children)
        else out.push(c)
      }
    }
    walk(opts.columns())
    return out
  }
  const colOf = (key: string): SmartTableDataColumn<T> | undefined =>
    leaves().find((c) => c.key === key)

  /** 推断结果的缓存(按列对象):空列(兜底)不缓存,数据到了再推。不是响应式的 —— 数据到达会让单元格重渲染,渲染时重新问一次即可。 */
  const memo = new WeakMap<object, EditorInfo>()
  function infoOf(col: SmartTableDataColumn<T>): EditorInfo {
    const hit = memo.get(col)
    if (hit) return hit
    const info = inferEditorInfo(col, opts.baseRows() as unknown as Record<string, unknown>[], {
      customCell: opts.hasCellSlot(col.key),
      key: col.key,
    })
    if (info.via !== 'fallback') memo.set(col, info)
    return info
  }
  const kindOf = (col: SmartTableDataColumn<T>): EditorKind | null => infoOf(col).kind

  /** 这个格是否被锁定(行级只读):editable.rowReadonly(整行)或列 readonly 的函数形式(按列 + 行)。 */
  function isLocked(col: SmartTableDataColumn<T>, row: T, index: number): boolean {
    if (col.readonly === false) return false // 列显式 readonly: false:不受行级锁定影响
    if (opts.config().rowReadonly?.(row)) return true
    return typeof col.readonly === 'function' && !!col.readonly(row, index)
  }
  /** 这个格此刻的编辑控件:列推断结果,被锁定时为 null。 */
  const kindAt = (col: SmartTableDataColumn<T>, row: T, index: number): EditorKind | null =>
    isLocked(col, row, index) ? null : kindOf(col)
  const indexOfRow = (row: T): number => opts.pageRows().indexOf(row)

  /** 窄档抽屉表单的字段:每个数据叶子列一项,控件类型就是宽档推断出来的那个(不可编辑的列显示为只读文本)。 */
  const sheetFields = computed<SheetField[]>(() =>
    leaves()
      // 没有标题的纯展示列(拖拽手柄 / 操作列这类 render 列)不进表单
      .filter((c) => !(kindOf(c) === null && (c.card === 'handle' || c.title === '')))
      .map((c) => ({
        key: c.key,
        label: fieldOf(c),
        kind: kindOf(c),
        required: !!c.rules?.required,
        options: optionsOf(c),
        extra: c.editorProps,
      })),
  )

  /* ---- 行的查找 ---- */

  /** 见过的原始行(按 id,最新的覆盖):草稿记原值 / 窄档抽屉 / 勾选跨页删除都要用到不在当前页的行。 */
  const known = new Map<string, T>()
  watch(
    () => opts.baseRows(),
    (rows) => {
      for (const r of rows) known.set(idOf(r), r)
    },
    { immediate: true },
  )
  const baseRowOf = (id: string): T | undefined =>
    store.news.find((r) => idOf(r) === id) ?? known.get(id)
  const shownRowOf = (id: string): T | undefined => opts.pageRows().find((r) => idOf(r) === id)

  function optionsOf(col: SmartTableDataColumn<T>): SmartTableOption[] {
    const extra = col.editorProps?.options as SmartTableOption[] | undefined
    return extra ?? opts.getOptions(col.key)
  }
  const fieldOf = (col: SmartTableDataColumn<T>): string => filterDefTitle(col)

  /** 校验上下文(自定义 validator 的第三个参数 = 表里当前所有行,含草稿、不含待删)。 */
  function vctx(col: SmartTableDataColumn<T>, kind: EditorKind, row: T): ValidateCtx<T> {
    return {
      labels: opts.labels(),
      field: fieldOf(col),
      row,
      col,
      options: kind === 'select' || kind === 'multiselect' ? optionsOf(col) : undefined,
      rows: opts.pageRows().filter((r) => !store.isDeleted(idOf(r))),
    }
  }
  /** 存在行上的值 → 校验用的原始值(日期统一成编辑串)。 */
  const rawOf = (kind: EditorKind, v: unknown): unknown =>
    kind === 'date' || kind === 'datetime' ? toEditString(kind, v) : v

  /* ---- 草稿读写 ---- */

  /**
   * Ctrl+Z 撤销栈:每项是「一次提交」(粘贴一块 = 一项多格),最多 50 项;只记用户操作(提交 / 清空 / 复选框 / 粘贴),
   * 宿主的 setCell、撤销自己、save: 'cell'(每格已经落库了)不记;保存 / 放弃后清空。
   */
  type UndoItem = { id: string; key: string; old: unknown }
  const UNDO_MAX = 50
  const undoStack: UndoItem[][] = []
  let undoGroup: UndoItem[] | null = null
  function recordUndo(item: UndoItem) {
    if (opts.config().save === 'cell') return
    if (undoGroup) undoGroup.push(item)
    else undoStack.push([item])
    if (undoStack.length > UNDO_MAX) undoStack.shift()
  }
  function undo(): boolean {
    const group = undoStack.pop()
    if (!group) return false
    for (const it of [...group].reverse()) {
      bad.delete(`${it.id}|${it.key}`)
      checking.delete(`${it.id}|${it.key}`)
      applySet(it.id, it.key, it.old, false)
    }
    clearErr()
    repaint()
    return true
  }

  function applySet(id: string, key: string, value: unknown, record = true) {
    const base = baseRowOf(id)
    if (!base) return
    const r = store.set(base, key, value)
    if (!r.changed) return
    if (record) recordUndo({ id, key, old: r.oldValue })
    const row = store.overlay([base])
    opts.onCellChange({
      row: (store.isNew(id) ? base : (row.find((x) => idOf(x) === id) ?? base)) as T,
      key,
      value,
      oldValue: r.oldValue,
    })
  }

  /** 宿主程序化改一格(如拖拽重排后重编号):走草稿仓库,有脏标记、进 @save;不做校验(保存时统一校验)。 */
  function setCell(rowKey: string | number, field: string, value: unknown): boolean {
    const id = String(rowKey)
    if (!enabled.value || !baseRowOf(id) || store.isDeleted(id)) return false
    const k = `${id}|${field}`
    checking.delete(k)
    bad.delete(k)
    applySet(id, field, value, false)
    repaint()
    return true
  }

  /** 提交 / 粘贴之后对异步 validator 的跟进:单元格显示加载态,结果落定后标红或放行;同一格又改了值 → 旧结果按令牌丢弃。 */
  function track(
    id: string,
    key: string,
    pending: Promise<{ ok: boolean; message?: string }> | undefined,
  ) {
    const k = `${id}|${key}`
    bad.delete(k)
    if (!pending) {
      checking.delete(k)
      return
    }
    const token = ++checkSeq
    checking.set(k, token)
    const p = pending.then((r) => {
      if (checking.get(k) !== token) return
      checking.delete(k)
      if (!r.ok) bad.set(k, r.message ?? '')
    })
    settling.add(p)
    void p.finally(() => settling.delete(p))
  }

  /* ---- 选中 / 重绘 ---- */

  const tdOf = (id: string, key: string): HTMLElement | null =>
    opts.scope()?.querySelector<HTMLElement>(`td[data-xc="${q(`${id}|${key}`)}"]`) ?? null

  let revealTried = false
  function paintSel(scroll = true) {
    const root = opts.scope()
    if (!root) return
    root.querySelectorAll('td[data-xsel]').forEach((t) => {
      t.removeAttribute('data-xsel')
      t.removeAttribute('aria-selected')
      t.removeAttribute('tabindex')
    })
    if (!sel || !enabled.value) return
    const td = tdOf(sel.id, sel.key)
    if (!td) {
      // 虚拟滚动:目标行还没渲染出来 → 把它滚进视口,渲染后再画一次选中框(只试一轮,免得目标根本不在这一页时死循环)
      if (scroll && opts.revealRow && !revealTried) {
        const i = opts.pageRows().findIndex((r) => idOf(r) === sel!.id)
        if (i >= 0) {
          revealTried = true
          opts.revealRow(i)
          requestAnimationFrame(() => {
            paintSel(true)
            revealTried = false
          })
        }
      }
      return
    }
    td.setAttribute('data-xsel', '')
    td.setAttribute('aria-selected', 'true')
    td.setAttribute('tabindex', '0')
    if (!edit.value) {
      td.focus({ preventScroll: true })
      // jsdom 等没有 scrollIntoView 的环境:可选调用
      if (scroll) td.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
    }
  }
  const repaint = (): void => void nextTick(() => paintSel(false))
  function setSel(id: string, key: string) {
    sel = { id, key }
    activeOwner = owner
    paintSel()
  }
  function clearSel() {
    sel = null
    paintSel()
  }

  /** 当前页里能移动到的格:可见列里有控件的列 × 未删除的行;具体某格能不能落脚还要看它有没有被锁定。 */
  function grid() {
    const kinds = new Set(
      leaves()
        .filter((c) => kindOf(c))
        .map((c) => c.key),
    )
    const cols = opts.visibleKeys().filter((k) => kinds.has(k))
    const rows = opts.pageRows().filter((r) => !store.isDeleted(idOf(r)))
    return { cols, rows }
  }
  // 锁定的格仍可落脚(可复制),只是不能编辑;不可落脚的只有「没有控件的列」(grid() 已排除)
  const editableAt = (_row: T, _key: string): boolean => true
  /** 沿方向找下一个格;left / right 在行首行尾可换行。找不到返回 null。 */
  function stepFrom(
    rows: T[],
    cols: string[],
    ri: number,
    ci: number,
    dir: EditMove,
    wrap: boolean,
  ): [number, number] | null {
    let r = ri
    let c = ci
    for (;;) {
      if (dir === 'left') {
        if (c > 0) c--
        else if (wrap && r > 0) {
          r--
          c = cols.length - 1
        } else return null
      } else if (dir === 'right') {
        if (c < cols.length - 1) c++
        else if (wrap && r < rows.length - 1) {
          r++
          c = 0
        } else return null
      } else if (dir === 'up') {
        if (r > 0) r--
        else return null
      } else if (r < rows.length - 1) r++
      else return null
      if (editableAt(rows[r], cols[c])) return [r, c]
    }
  }
  function move(dir: EditMove, wrap: boolean): boolean {
    if (!sel) return false
    const { cols, rows } = grid()
    const ri = rows.findIndex((r) => idOf(r) === sel!.id)
    const ci = cols.indexOf(sel.key)
    if (ri < 0 || ci < 0) return false
    const to = stepFrom(rows, cols, ri, ci, dir, wrap)
    if (!to) return false
    sel = { id: idOf(rows[to[0]]), key: cols[to[1]] }
    return true
  }

  /* ---- 错误态 ---- */

  function setErr(id: string, key: string, message: string) {
    err.value = { id, key, message }
  }
  const clearErr = (): void => {
    if (err.value) err.value = null
  }

  /* ---- 进入 / 提交 / 放弃编辑 ---- */

  function enter(id: string, key: string, how: 'mouse' | 'key' | { ch: string }): boolean {
    if (saving.value || !enabled.value) return false
    const col = colOf(key)
    const row = shownRowOf(id)
    if (!col || !row) return false
    const kind = kindAt(col, row, indexOfRow(row))
    if (!kind || kind === 'checkbox' || store.isDeleted(id)) return false
    const cur = (row as Record<string, unknown>)[key]
    let val: unknown
    if (kind === 'date' || kind === 'datetime') val = toEditString(kind, cur)
    else if (kind === 'number')
      val = typeof cur === 'number' ? cur : cur == null || cur === '' ? null : Number(cur)
    else if (kind === 'multiselect') val = Array.isArray(cur) ? [...cur] : []
    else val = cur == null ? '' : String(cur)
    edit.value = {
      id,
      key,
      kind,
      val,
      typed: typeof how === 'object' ? how.ch : undefined,
      selectAll: how === 'mouse',
    }
    sel = { id, key }
    activeOwner = owner
    clearErr()
    return true
  }

  /** 把校验通过的值写进草稿(日期按原类型还原),并跟进异步校验。 */
  function writeValue(
    id: string,
    col: SmartTableDataColumn<T>,
    kind: EditorKind,
    row: T,
    value: unknown,
    pending?: Promise<{ ok: boolean; message?: string }>,
  ) {
    const cur = (row as Record<string, unknown>)[col.key]
    applySet(
      id,
      col.key,
      kind === 'date' || kind === 'datetime' ? fromEditString(kind, value as string, cur) : value,
    )
    track(id, col.key, pending)
  }

  /**
   * 提交当前编辑:不通过则留在编辑态(红框 + 提示)。
   * trusted = 值刚由控件事件(点日期 / 清除 / 确认)交上来,以 e.val 为准;否则(Enter / Tab / 点别处)日期框里手敲了字还没落成值时按敲的内容校验。
   */
  function commit(trusted = false): boolean {
    const e = edit.value
    if (!e) return true
    const col = colOf(e.key)
    const row = shownRowOf(e.id)
    if (!col || !row) {
      edit.value = null
      return true
    }
    let raw = e.val
    if (!trusted && (e.kind === 'date' || e.kind === 'datetime')) {
      // 日期框里手敲了字还没落成值:按敲的内容校验(不静默回退成旧值)
      const typed = tdOf(e.id, e.key)?.querySelector<HTMLInputElement>('input')?.value.trim()
      if (typed !== undefined && typed !== '' && typed !== String(e.val ?? '')) raw = typed
    }
    const { result: r, pending } = validateEditPending(e.kind, raw, vctx(col, e.kind, row))
    if (!r.ok) {
      setErr(e.id, e.key, r.message)
      return false
    }
    writeValue(e.id, col, e.kind, row, r.value, pending)
    autoSave([{ id: e.id, key: e.key, pending }])
    sel = { id: e.id, key: e.key }
    edit.value = null
    clearErr()
    return true
  }

  /** 提交 → (可选)移动选中格。不通过返回 false 并弹错误提示。 */
  function finish(to: EditMove | null, trusted = false): boolean {
    if (!commit(trusted)) {
      repaint()
      return false
    }
    if (to) move(to, to === 'left' || to === 'right')
    void nextTick(() => paintSel())
    return true
  }
  function cancel() {
    edit.value = null
    clearErr()
    void nextTick(() => paintSel())
  }

  /** Delete / Backspace:清空选中格;必填列拒绝并提示。 */
  function clearCell() {
    if (!sel || saving.value) return
    const { id, key } = sel
    const col = colOf(key)
    const row = shownRowOf(id)
    if (!col || !row || store.isDeleted(id)) return
    const kind = kindAt(col, row, indexOfRow(row))
    if (!kind) return
    if (kind === 'checkbox') {
      applySet(id, key, false)
      autoSave([{ id, key }])
    } else {
      const { result: r, pending } = validateEditPending(kind, '', vctx(col, kind, row))
      if (!r.ok) {
        setErr(id, key, r.message)
        return
      }
      writeValue(id, col, kind, row, r.value, pending)
      autoSave([{ id, key, pending }])
    }
    clearErr()
    repaint()
  }

  function toggleCheckbox(id: string, key: string) {
    if (saving.value || store.isDeleted(id)) return
    const row = shownRowOf(id)
    const col = colOf(key)
    if (!row || !col || isLocked(col, row, indexOfRow(row))) return
    applySet(id, key, !(row as Record<string, unknown>)[key])
    autoSave([{ id, key }])
    setSel(id, key)
    clearErr()
  }

  /* ---- 编辑控件的回调 ---- */

  const ctrl: EditorCtrl = {
    update(v) {
      if (!edit.value) return
      edit.value.val = v
      clearErr()
    },
    pick(v) {
      if (!edit.value) return
      edit.value.val = v
      const to = selectPickMove
      selectPickMove = null
      finish(to, true)
    },
    pickRow(picked) {
      const e = edit.value
      if (!e || e.kind !== 'select-table') return
      const col = colOf(e.key)
      const row = shownRowOf(e.id)
      if (!col || !row) {
        edit.value = null
        return
      }
      const sp = selectTableProps(col)
      const label = String(picked[sp.labelKey ?? col.key] ?? '')
      const plan = planPick(e.id, col, row, label, picked)
      if (!plan.ok) {
        // 主值不合法(如必填却为空)留在编辑态;fill 的某格不合法:整次都不应用,选中并标红那一格
        if (plan.key === col.key) setErr(e.id, e.key, plan.message)
        else failAt(row, plan.key, plan.message)
        return
      }
      edit.value = null
      commitWrites(plan.writes)
      sel = { id: e.id, key: e.key }
      clearErr()
      void nextTick(() => paintSel())
    },
    pickDate(s) {
      const e = edit.value
      if (!e) return
      e.val = s
      clearErr()
      if (e.kind === 'date') finish(null, true)
    },
    confirmDate(formatted) {
      if (!edit.value) return
      if (formatted !== undefined) edit.value.val = formatted
      finish(null, true)
    },
    clearDate() {
      if (!edit.value) return
      edit.value.val = ''
      finish(null, true)
    },
  }

  /* ---- 单元格点击 ---- */

  function onCellClick(_e: MouseEvent, id: string, key: string) {
    if (saving.value) return
    const skip = skipEnter
    skipEnter = false
    const e = edit.value
    if (e && e.id === id && e.key === key) return // 点在编辑控件里
    const col = colOf(key)
    const kind = col ? kindOf(col) : null
    if (kind === 'checkbox') {
      // 复选框自己的点击会切换值(NCheckbox);td 这里只负责选中
      setSel(id, key)
      clearErr()
      return
    }
    if (sel && sel.id === id && sel.key === key && !skip) {
      enter(id, key, 'mouse')
      return
    }
    sel = { id, key }
    activeOwner = owner
    clearErr()
    paintSel()
  }

  /* ---- 单元格 / 行的渲染接线(useColumns.toNaive、SmartTable.mergedRowProps 调用) ---- */

  type Attrs = Record<string, unknown>

  /** 列的 cellProps:可编辑格带 data-xc / 点击;只读 / 锁定格次要文字色;脏格小三角;编辑 / 报错 / 校验中态。宿主自己写的 cellProps 先调、再合并。 */
  function cellProps(
    col: SmartTableDataColumn<T>,
    row: T,
    index: number,
    host?: (row: T, index: number) => Attrs,
  ): Attrs {
    const base: Attrs = host ? { ...host(row, index) } : {}
    if (!enabled.value) return base
    const id = idOf(row)
    // 合计行(summary)也会走 cellProps,它的「行」不是数据行:不接线
    if (!known.has(id) && !store.isNew(id)) return base
    const colKind = kindOf(col)
    const kind = kindAt(col, row, index)
    const cls: unknown[] = [base.class]
    const attrs: Attrs = { ...base, 'data-xk': colKind ?? '' }
    if (!colKind) {
      cls.push('smart-table-xro')
      attrs['aria-readonly'] = 'true'
    } else if (!store.isDeleted(id) && !opts.cardMode()) {
      // 锁定的格:可选中 / 复制,灰显(xlk),不能编辑
      if (!kind) {
        cls.push('smart-table-xlk')
        attrs['aria-readonly'] = 'true'
      }
      cls.push('smart-table-xc')
      attrs['data-xc'] = `${id}|${col.key}`
      const hostClick = base.onClick as ((e: MouseEvent) => void) | undefined
      attrs.onClick = (e: MouseEvent) => {
        hostClick?.(e)
        onCellClick(e, id, col.key)
      }
    }
    if (colKind === 'checkbox') {
      cls.push('smart-table-xk-ck')
      // 复选框默认居中(列自己写了 align 就听列的);inline 的 text-align 来自表格默认对齐,样式表盖不过它,只能在这里给
      if (col.align === undefined) attrs.style = [base.style, { textAlign: 'center' }]
    }
    if (store.isDirtyCell(id, col.key)) cls.push('smart-table-xd')
    const k = `${id}|${col.key}`
    if (checking.has(k)) cls.push('smart-table-xchecking')
    const ed = edit.value
    if (ed && ed.id === id && ed.key === col.key) cls.push('smart-table-xed')
    if (ed && ed.id === id && ed.key === col.key && ed.kind === 'textarea')
      cls.push('smart-table-xed--ta')
    const er = err.value
    if ((er && er.id === id && er.key === col.key) || bad.has(k)) {
      cls.push('smart-table-xerr')
      attrs['aria-invalid'] = 'true'
    }
    attrs.class = cls.filter(Boolean)
    return attrs
  }

  function rowClass(row: T): string {
    if (!enabled.value) return ''
    const id = idOf(row)
    return [
      store.isNew(id) && 'smart-table-xnew',
      store.isDeleted(id) && 'smart-table-xdel',
      store.isDirtyRow(id) && 'smart-table-xdirty',
      opts.config().rowReadonly?.(row) && 'smart-table-xlk',
    ]
      .filter(Boolean)
      .join(' ')
  }

  /** 多选值的显示:标签文字用逗号连接(列写了 render / 插槽时用宿主的)。 */
  function multiDisplay(col: SmartTableDataColumn<T>, value: unknown): string {
    if (!Array.isArray(value) || !value.length) return ''
    const all = optionsOf(col)
    return value
      .map((v) => {
        const hit = all.find((o) => String(o.value) === String(v))
        return hit ? optionLabel(hit) : String(v)
      })
      .join(', ')
  }

  /** 列的单元格:不可编辑 → 原样;复选框 → 常显的 NCheckbox(单击直接切换);编辑中 → 官方控件;其余 → 常规显示。 */
  function renderCell(
    col: SmartTableDataColumn<T>,
    row: T,
    index: number,
    display: () => VNodeChild,
  ): VNodeChild {
    if (!enabled.value) return display()
    const colKind = kindOf(col)
    if (!colKind) return display()
    const id = idOf(row)
    const key = col.key
    const k = `${id}|${key}`
    const locked = isLocked(col, row, index)
    const show: () => VNodeChild =
      colKind === 'multiselect' && !col.render
        ? () => multiDisplay(col, (row as Record<string, unknown>)[key])
        : display
    if (opts.cardMode()) {
      // 窄档卡片:不逐格编辑,值只读显示(复选框列显示 是 / 否,空值显示占位)
      if (colKind === 'checkbox')
        return (row as Record<string, unknown>)[key] ? opts.labels().editYes : opts.labels().editNo
      const shown = show()
      return shown === '' ? opts.emptyText() : shown
    }
    if (colKind === 'checkbox') {
      return h(NCheckbox, {
        checked: !!(row as Record<string, unknown>)[key],
        disabled: saving.value || store.isDeleted(id) || locked,
        'aria-label': fieldOf(col),
        'onUpdate:checked': () => toggleCheckbox(id, key),
      })
    }
    if (locked) return show()
    const e = edit.value
    const er = err.value
    const editing = !!e && e.id === id && e.key === key
    const invalid = !!er && er.id === id && er.key === key
    const L = opts.labels()
    const placeholder =
      colKind === 'select' || colKind === 'multiselect' || colKind === 'select-table'
        ? L.editSelectPlaceholder
        : colKind === 'number'
          ? L.editNumberPlaceholder
          : colKind === 'datetime'
            ? L.editDatetimePlaceholder
            : colKind === 'input' || colKind === 'textarea'
              ? fmt(L.editInputPlaceholder, { field: fieldOf(col) })
              : undefined
    let content: VNodeChild
    if (editing && e.kind === 'textarea') {
      content = [
        show(),
        h(EditableTextPop, {
          value: e.val == null ? '' : String(e.val),
          invalid,
          typed: e.typed,
          selectAll: e.selectAll,
          placeholder,
          ctrl,
        }),
      ]
    } else if (editing) {
      content = h(EditableEditor, {
        kind: e.kind as Exclude<EditorKind, 'textarea' | 'checkbox'>,
        value: e.val,
        options: e.kind === 'select' || e.kind === 'multiselect' ? optionsOf(col) : [],
        extra: col.editorProps,
        invalid,
        typed: e.typed,
        selectAll: e.selectAll,
        menuMinWidth: Math.max(tdOf(id, key)?.getBoundingClientRect().width ?? 0, 120),
        placeholder,
        colKey: key,
        labels: L,
        ctrl,
      })
    } else {
      const shown = show()
      // 异步校验中:内容旁一个小转圈
      content = checking.has(k)
        ? [shown, h(NSpin, { size: 12, class: 'smart-table-xspin', 'aria-busy': 'true' })]
        : shown
    }
    if (invalid || editing) {
      // 编辑中的格一直包着气泡(没出错时 show 为 false):出错 / 恢复时结构不变,编辑控件不会被卸载重挂(重挂会丢光标、并把「直接打字」的首字符再写一遍)
      // 校验未过:气泡常显(键盘提交失败时不依赖悬停),单元格红框由 td 的 .smart-table-xerr 画
      return h(
        NTooltip,
        {
          show: invalid,
          trigger: 'manual',
          placement: 'top',
          // 气泡盖在相邻的单元格上(默认在上方,顶部放不下时官方会翻到下方):不拦鼠标,点它盖住的格子照常生效
          style: 'max-width: 280px; pointer-events: none',
          // 气泡离单元格上沿 10px(原型 tip 的 top - h - 10):带箭头时间距取 spaceArrow(官方默认 10px,实测盒子离单元格只有 2.4px)
          themeOverrides: { peers: { Popover: { spaceArrow: '17px' } } },
        },
        {
          trigger: () => h('div', { class: 'smart-table-xcell' }, [content]),
          default: () => er?.message ?? '',
        },
      )
    }
    if (bad.has(k) && !editing) {
      // 异步校验未通过(已提交的值):悬停看原因
      return h(
        NTooltip,
        { trigger: 'hover', placement: 'top', style: 'max-width: 280px' },
        {
          trigger: () => h('div', { class: 'smart-table-xcell' }, [content]),
          default: () => bad.get(k),
        },
      )
    }
    return content
  }

  /* ---- 新增 / 删除 / 恢复 / 保存 / 放弃 ---- */

  let tempSeq = 0
  function blankRow(): T {
    const row = { ...(opts.config().newRow?.() ?? {}) } as Record<string, unknown>
    const kf = opts.rowKeyField()
    if (kf && (row[kf] === undefined || row[kf] === null || row[kf] === ''))
      row[kf] = `__new_${++tempSeq}`
    return row as T
  }

  const addPosition = (): 'top' | 'bottom' => {
    const a = opts.config().add
    return typeof a === 'object' && a.position === 'bottom' ? 'bottom' : 'top'
  }
  /** 新增后进入编辑的格:第一个「必填且为空」的,没有就第一个为空的,再没有才是第一个可编辑格(跳过复选框 / 锁定 / 不可见列)。 */
  function firstCellToEdit(row: T): string | undefined {
    const visible = opts.visibleKeys()
    const cols = leaves()
      .filter((c) => visible.includes(c.key))
      .sort((a, b) => visible.indexOf(a.key) - visible.indexOf(b.key))
      .filter((c) => {
        const k = kindAt(c, row, 0)
        return !!k && k !== 'checkbox'
      })
    const empty = (c: SmartTableDataColumn<T>) => {
      const v = (row as Record<string, unknown>)[c.key]
      return v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)
    }
    return (cols.find((c) => c.rules?.required && empty(c)) ?? cols.find(empty) ?? cols[0])?.key
  }

  async function add() {
    if (saving.value || !enabled.value) return
    if (opts.cardMode()) {
      openForm(null)
      return
    }
    const position = addPosition()
    const row = store.addNew(blankRow(), position)
    edit.value = null
    clearErr()
    sel = null
    const first = firstCellToEdit(row)
    pendingEdit = first ? { id: idOf(row), key: first } : null
    await opts.goEdgePage(position)
    await nextTick()
    resolvePending()
  }
  /** 新增行已经出现在当前页:选中并进入第一个可编辑格(键盘进入 = 光标在末尾)。 */
  function resolvePending() {
    if (!pendingEdit) return
    const p = pendingEdit
    if (!shownRowOf(p.id)) return
    pendingEdit = null
    void nextTick(() => {
      enter(p.id, p.key, 'key')
    })
  }
  // 挂载后才开始盯当前页:pageRows 在 SmartTable 里声明得比本组合函数晚,setup 期立即求值会撞上「声明前使用」
  const ready = ref(false)
  onMounted(() => (ready.value = true))
  watch(
    () => (ready.value ? opts.pageRows() : null),
    () => {
      if (pendingEdit) resolvePending()
      repaint()
    },
  )

  function checkedRows(): T[] {
    return opts
      .checkedKeys()
      .map((k) => baseRowOf(String(k)))
      .filter((r): r is T => !!r)
  }
  function deleteChecked() {
    if (saving.value) return
    const rows = checkedRows().filter((r) => !store.isDeleted(idOf(r)))
    if (!rows.length) return
    store.markDelete(rows)
    for (const r of rows) dropChecks(idOf(r))
    edit.value = null
    clearErr()
    if (sel && store.isDeleted(sel.id)) sel = null
    opts.clearChecked()
    repaint()
  }
  /** 撤销删除:勾选里的待删行恢复成正常行。 */
  function restoreChecked() {
    if (saving.value) return
    for (const r of checkedRows()) store.unmarkDelete(idOf(r))
    opts.clearChecked()
    repaint()
  }
  /** 当前勾选里有没有待删行 / 没删的行(批量栏据此显示「恢复所选」/「删除所选」)。 */
  function checkedState(): { live: boolean; deleted: boolean } {
    const rows = checkedRows()
    return {
      live: rows.some((r) => !store.isDeleted(idOf(r))),
      deleted: rows.some((r) => store.isDeleted(idOf(r))),
    }
  }
  function dropChecks(id: string) {
    for (const m of [bad, checking])
      for (const k of [...m.keys()]) if (k.startsWith(`${id}|`)) m.delete(k)
  }

  function getChanges(): EditChanges<T> {
    return store.changes()
  }

  /**
   * 保存前统一校验,返回第一个不合法的格(按表里的显示顺序;不在当前页的排最后):
   * 先等还在异步校验的格落定 → 提交后异步没过的格 → 草稿格的同步规则(规则可能后来变了)→ 新增行所有格(含异步 validator,它们没经过单格提交)。
   */
  async function firstInvalid(): Promise<{
    id: string
    key: string
    row: T
    message: string
  } | null> {
    while (settling.size) await Promise.all([...settling])
    const bads: Array<{ id: string; key: string; row: T; message: string }> = []
    for (const [k, message] of bad) {
      const [id, key] = [k.slice(0, k.indexOf('|')), k.slice(k.indexOf('|') + 1)]
      const row = shownRowOf(id) ?? baseRowOf(id)
      if (row) bads.push({ id, key, row, message })
    }
    for (const c of store.dirtyCells()) {
      const col = colOf(c.key)
      const kind = col ? kindOf(col) : null
      if (!col || !kind) continue
      const row = shownRowOf(c.id) ?? c.row
      const r = validateEdit(
        kind,
        rawOf(kind, (row as Record<string, unknown>)[c.key]),
        vctx(col, kind, row),
      )
      if (!r.ok) bads.push({ id: c.id, key: c.key, row, message: r.message })
    }
    for (const row of store.news) {
      for (const col of leaves()) {
        const kind = kindOf(col)
        if (!kind) continue
        const r = await validateEditAsync(
          kind,
          rawOf(kind, (row as Record<string, unknown>)[col.key]),
          vctx(col, kind, row),
        )
        if (!r.ok) bads.push({ id: idOf(row), key: col.key, row, message: r.message })
      }
    }
    if (!bads.length) return null
    const order = opts.pageRows()
    const keys = opts.visibleKeys()
    const rank = (b: { id: string; key: string }) => {
      const ri = order.findIndex((r) => idOf(r) === b.id)
      const ci = keys.indexOf(b.key)
      return (ri < 0 ? 1e6 : ri) * 1000 + (ci < 0 ? 999 : ci)
    }
    return bads.sort((a, b) => rank(a) - rank(b))[0]
  }

  async function save(): Promise<void> {
    if (saving.value || !enabled.value || count.value === 0) return
    if (edit.value && !commit()) {
      repaint()
      return
    }
    saving.value = true // 校验期间也锁住编辑,免得校验和草稿打架
    const bad1 = await firstInvalid()
    if (bad1) {
      saving.value = false
      sel = { id: bad1.id, key: bad1.key }
      activeOwner = owner
      setErr(bad1.id, bad1.key, bad1.message)
      opts.onInvalid({ row: bad1.row, key: bad1.key, message: bad1.message })
      await nextTick()
      paintSel() // 选中并滚进视口(虚拟滚动下先把行滚出来)
      return
    }
    if (!opts.hasSaveListener()) {
      saving.value = false
      console.warn(
        '[smart-naive-table] editable 需要监听 @save 才能提交修改(宿主提交后调用载荷里的 done() / fail())。',
      )
      return
    }
    edit.value = null
    clearErr()
    opts.onSave({
      changes: store.changes(),
      done: () => {
        if (!saving.value) return
        store.clear()
        bad.clear()
        checking.clear()
        undoStack.length = 0
        saving.value = false
        sel = null
        clearErr()
        opts.clearChecked()
        void opts.reload()
        repaint()
      },
      fail: (e?: unknown) => {
        saving.value = false
        if (e !== undefined) opts.onError(e)
      },
    })
  }

  /**
   * save: 'cell':每次用户提交(含复选框 / Delete / 粘贴)后立刻把涉及的格作为一次 @save 发出(载荷只含这些格的改动);
   * 有异步校验还没落定的先等,不通过就不发(格留着标红)。done() → 清这些格的草稿并刷新;fail() → 回滚这些格 + @error + 单元格提示。新增行不自动发。
   */
  function autoSave(items: Array<{ id: string; key: string; pending?: Promise<{ ok: boolean }> }>) {
    if (opts.config().save !== 'cell') return
    const cells = items.filter((i) => !store.isNew(i.id)).map(({ id, key }) => ({ id, key }))
    if (!cells.length) return
    void (async () => {
      const pend = items.map((i) => i.pending).filter((p): p is Promise<{ ok: boolean }> => !!p)
      if (pend.length && (await Promise.all(pend)).some((r) => !r.ok)) return
      if (saving.value) return
      const changes = store.changesFor(cells)
      if (!changes.updated.length) return
      if (!opts.hasSaveListener()) {
        console.warn(
          '[smart-naive-table] editable.save: "cell" 需要监听 @save(宿主提交后调用载荷里的 done() / fail())。',
        )
        return
      }
      saving.value = true
      const settle = () => {
        for (const c of cells) store.clearCell(c.id, c.key)
        saving.value = false
      }
      opts.onSave({
        changes,
        done: () => {
          if (!saving.value) return
          settle()
          void opts.reload()
          repaint()
        },
        fail: (e?: unknown) => {
          if (!saving.value) return
          settle() // 回滚:这些格回到原值
          if (e !== undefined) {
            opts.onError(e)
            setErr(cells[0].id, cells[0].key, e instanceof Error ? e.message : String(e))
            sel = { ...cells[0] }
          }
          repaint()
        },
      })
    })()
  }

  function discard() {
    if (saving.value || count.value === 0) return
    store.clear()
    bad.clear()
    checking.clear()
    undoStack.length = 0
    edit.value = null
    clearErr()
    sel = null
    opts.clearChecked()
    opts.onDiscard()
    repaint()
  }

  /* ---- 窄档抽屉表单(整行即时保存) ---- */

  function openForm(id: string | null) {
    const base = id ? baseRowOf(id) : undefined
    if (id && (!base || store.isDeleted(id))) return
    const shown = id ? (shownRowOf(id) ?? base) : undefined
    const vals: Record<string, unknown> = shown
      ? { ...(shown as Record<string, unknown>) }
      : { ...(opts.config().newRow?.() ?? {}) }
    const kf = opts.rowKeyField()
    const idx = shown ? indexOfRow(shown) : -1
    const locked = shown
      ? leaves()
          .filter((c) => kindOf(c) && isLocked(c, shown, idx))
          .map((c) => c.key)
      : []
    form.value = {
      id: id ?? String(kf ? (vals[kf] ?? `__new_${++tempSeq}`) : `__new_${++tempSeq}`),
      isNew: !id,
      vals,
      errs: {},
      saving: false,
      locked,
    }
  }
  function closeForm() {
    form.value = null
  }
  function formSet(key: string, value: unknown) {
    const f = form.value
    if (!f) return
    f.vals[key] = value
    delete f.errs[key]
  }
  /** 抽屉里 select-table 选中一行:字段值 = labelKey,fill 的其它列(没被锁的)一并填进表单,保存时统一校验。 */
  function formPick(key: string, picked: Record<string, unknown>) {
    const f = form.value
    const col = colOf(key)
    if (!f || !col) return
    const sp = selectTableProps(col)
    formSet(key, String(picked[sp.labelKey ?? key] ?? ''))
    const patch = sp.fill?.(picked, f.vals) ?? {}
    for (const [k, v] of Object.entries(patch))
      if (k !== key && !f.locked.includes(k)) formSet(k, v)
  }
  async function formSave() {
    const f = form.value
    if (!f || f.saving) return
    f.errs = {}
    f.saving = true
    const out: Record<string, unknown> = {}
    for (const col of leaves()) {
      const kind = kindOf(col)
      if (!kind || f.locked.includes(col.key)) continue
      const raw = f.vals[col.key]
      const r = await validateEditAsync(kind, rawOf(kind, raw), vctx(col, kind, f.vals as T))
      if (r.ok)
        out[col.key] =
          kind === 'date' || kind === 'datetime'
            ? fromEditString(kind, r.value as string, raw)
            : r.value
      else f.errs[col.key] = r.message
    }
    if (Object.keys(f.errs).length) {
      f.saving = false
      return
    }
    const finishForm = () => {
      form.value = null
      store.clearRow(f.id)
      void opts.reload()
    }
    const fail = (e?: unknown) => {
      f.saving = false
      if (e !== undefined) opts.onError(e)
    }
    if (f.isNew) {
      const row = { ...f.vals, ...out } as T
      opts.onSave({
        changes: {
          updated: [],
          added: [row],
          removed: [],
          rows: [{ type: 'created', row }],
        },
        done: finishForm,
        fail,
      })
      return
    }
    const base = baseRowOf(f.id)!
    // 与「改之前的值」比:草稿里已改的格也算这次保存的(保存后这一行的草稿清掉)
    const changes: Record<string, { value: unknown; oldValue: unknown }> = {}
    for (const [k, v] of Object.entries(out)) {
      const was = (base as Record<string, unknown>)[k]
      const same =
        Array.isArray(v) && Array.isArray(was)
          ? String(v) === String(was)
          : (was ?? '') === (v ?? '')
      if (!same) changes[k] = { value: v, oldValue: was }
    }
    if (!Object.keys(changes).length) {
      finishForm()
      return
    }
    const row = { ...base, ...out } as T
    opts.onSave({
      changes: {
        updated: [{ row, changes }],
        added: [],
        removed: [],
        rows: [{ type: 'updated', row, changes }],
      },
      done: finishForm,
      fail,
    })
  }

  /* ---- 复制 / 粘贴(Excel) ---- */

  /** 剪贴板里的一段文本 → 这一列控件认的原始值(选项按标签或值匹配、布尔认 TRUE / 是 等、数字去千分位、日期补零)。 */
  function coerce(kind: EditorKind, col: SmartTableDataColumn<T>, text: string): unknown {
    const t = text.trim()
    switch (kind) {
      case 'checkbox':
        return TRUE_TEXT.test(t)
      case 'number':
        return t === '' ? null : /^-?[\d,]+(\.\d+)?$/.test(t) ? t.replace(/,/g, '') : t
      case 'select':
      case 'multiselect': {
        const all = optionsOf(col)
        const one = (s: string): unknown => {
          const x = s.trim()
          const hit =
            all.find((o) => optionLabel(o).toLowerCase() === x.toLowerCase()) ??
            all.find((o) => String(o.value) === x)
          return hit ? hit.value : x
        }
        if (kind === 'select') return t === '' ? '' : one(t)
        return t === '' ? [] : t.split(/[,，;；、|]/).map(one)
      }
      case 'date':
      case 'datetime': {
        const [d, tm] = t.replace(/\//g, '-').split(/\s+/)
        const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(d ?? '')
        if (!m) return t
        const day = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
        if (kind === 'date') return day
        const tp = (tm ?? '00:00:00').split(':')
        while (tp.length < 3) tp.push('00')
        return `${day} ${tp.map((x) => x.padStart(2, '0')).join(':')}`
      }
      default:
        return text
    }
  }

  /* ---- select-table:选中一行 = 单元格值 + fill 的其它列(普通草稿编辑) ---- */

  const selectTableProps = (col: SmartTableDataColumn<T>): SelectTableProps =>
    (col.editorProps ?? {}) as unknown as SelectTableProps

  type Write = {
    id: string
    col?: SmartTableDataColumn<T>
    key: string
    kind?: EditorKind
    row: T
    value: unknown
    pending?: Promise<{ ok: boolean; message?: string }>
  }
  type Plan = { ok: true; writes: Write[] } | { ok: false; key: string; message: string }

  /** 主值 + fill 产出的所有写入,先全部校验:任何一格不合法 → 不应用任何改动。fill 指向只读 / 锁定 / 不存在的列时跳过(不存在的字段原样写进草稿)。 */
  function planPick(
    id: string,
    col: SmartTableDataColumn<T>,
    row: T,
    label: string,
    picked: Record<string, unknown> | null,
  ): Plan {
    const main = validateEditPending('select-table', label, vctx(col, 'select-table', row))
    if (!main.result.ok) return { ok: false, key: col.key, message: main.result.message }
    const writes: Write[] = [
      {
        id,
        col,
        key: col.key,
        kind: 'select-table',
        row,
        value: main.result.value,
        pending: main.pending,
      },
    ]
    const patch = picked ? (selectTableProps(col).fill?.(picked, row) ?? {}) : {}
    for (const [k, v] of Object.entries(patch)) {
      if (k === col.key) continue
      const c = colOf(k)
      if (!c) {
        writes.push({ id, key: k, row, value: v })
        continue
      }
      const kind = kindAt(c, row, indexOfRow(row))
      if (!kind) continue
      const r = validateEditPending(kind, rawOf(kind, v), vctx(c, kind, row))
      if (!r.result.ok) return { ok: false, key: k, message: r.result.message }
      writes.push({ id, col: c, key: k, kind, row, value: r.result.value, pending: r.pending })
    }
    return { ok: true, writes }
  }

  /** 一次提交的多格写入 = 一步撤销、各自脏标记与 @cell-change;save: 'cell' 时逐格自动保存。 */
  function commitWrites(writes: Write[]) {
    undoGroup = []
    for (const w of writes) {
      if (w.col && w.kind) writeValue(w.id, w.col, w.kind, w.row, w.value, w.pending)
      else applySet(w.id, w.key, w.value)
    }
    if (undoGroup.length) {
      undoStack.push(undoGroup)
      if (undoStack.length > UNDO_MAX) undoStack.shift()
    }
    undoGroup = null
    autoSave(writes.map((w) => ({ id: w.id, key: w.key, pending: w.pending })))
    repaint()
  }

  /** 某格不合法:选中并标红它,并发 @invalid。 */
  function failAt(row: T, key: string, message: string) {
    edit.value = null
    sel = { id: idOf(row), key }
    setErr(idOf(row), key, message)
    opts.onInvalid({ row, key, message })
    repaint()
  }

  /** 粘贴的文本 → select-table 的单元格值:有本地 data 时必须是已有的名称(labelKey)或 valueKey 编码,命中得到整行(用来 fill);只有 fetcher 的数据源照收文本。 */
  function resolvePick(
    col: SmartTableDataColumn<T>,
    text: string,
  ): { label: string; picked: Record<string, unknown> | null; missing?: boolean } {
    const sp = selectTableProps(col)
    const t = text.trim()
    if (!sp.data || t === '') return { label: t, picked: null }
    const lk = sp.labelKey ?? col.key
    const vk = sp.valueKey ?? lk
    const hit =
      sp.data.find(
        (r) => String((r as Record<string, unknown>)[lk]).toLowerCase() === t.toLowerCase(),
      ) ?? sp.data.find((r) => String((r as Record<string, unknown>)[vk]) === t)
    return hit
      ? {
          label: String((hit as Record<string, unknown>)[lk]),
          picked: hit as Record<string, unknown>,
        }
      : { label: t, picked: null, missing: true }
  }

  /**
   * 粘贴一块文本:从选中格起向右向下依次填充(每个目标格按自己列的类型转换并校验);锁定 / 只读 / 待删的格跳过(对应数据丢弃),
   * 超出当前列表的行 / 列忽略(不自动追加新行)。任何一格不合法 → 整块都不应用,选中并标红第一个不合法的格(并发 @invalid)。
   */
  function applyPaste(matrix: string[][]) {
    if (!sel) return
    const { cols, rows } = grid()
    const ri0 = rows.findIndex((r) => idOf(r) === sel!.id)
    const ci0 = cols.indexOf(sel.key)
    if (ri0 < 0 || ci0 < 0) return
    const writes: Write[] = []
    for (let r = 0; r < matrix.length && ri0 + r < rows.length; r++) {
      const row = rows[ri0 + r]
      for (let c = 0; c < matrix[r].length && ci0 + c < cols.length; c++) {
        const col = colOf(cols[ci0 + c])
        const kind = col ? kindAt(col, row, indexOfRow(row)) : null
        if (!col || !kind) continue
        if (kind === 'select-table') {
          // 命中本地数据的名称 / 编码 → 取名称并同样 fill;不命中被拒
          const hit = resolvePick(col, matrix[r][c])
          if (hit.missing) {
            failAt(row, col.key, fmt(opts.labels().editRequiredSelect, { field: fieldOf(col) }))
            return
          }
          const plan = planPick(idOf(row), col, row, hit.label, hit.picked)
          if (!plan.ok) {
            failAt(row, plan.key, plan.message)
            return
          }
          writes.push(...plan.writes)
          continue
        }
        const v = validateEditPending(kind, coerce(kind, col, matrix[r][c]), vctx(col, kind, row))
        if (!v.result.ok) {
          failAt(row, col.key, v.result.message)
          return
        }
        writes.push({
          id: idOf(row),
          col,
          key: col.key,
          kind,
          row,
          value: v.result.value,
          pending: v.pending,
        })
      }
    }
    clearErr()
    commitWrites(writes) // 一次粘贴 = 一步撤销
  }

  /** 复制用的文本:选项显示标签、布尔 TRUE / FALSE、日期原样。 */
  function copyText(): string | null {
    if (!sel) return null
    const col = colOf(sel.key)
    const row = shownRowOf(sel.id)
    if (!col || !row) return null
    const v = (row as Record<string, unknown>)[sel.key]
    const kind = kindOf(col)
    if (kind === 'checkbox') return v ? 'TRUE' : 'FALSE'
    if (kind === 'multiselect') return multiDisplay(col, v)
    if (kind === 'select') {
      const hit = optionsOf(col).find((o) => String(o.value) === String(v))
      return hit ? optionLabel(hit) : v == null ? '' : String(v)
    }
    if (kind === 'date' || kind === 'datetime') return toEditString(kind, v)
    return v == null ? '' : String(v)
  }

  /** 复制 / 粘贴只在「选中格、没在编辑、焦点在 body 或选中的 td 上」时接管;编辑中的粘贴交给输入框自己。 */
  function clipboardTarget(e: Event): boolean {
    if (!enabled.value || form.value || opts.cardMode() || edit.value || saving.value) return false
    if (!sel || activeOwner !== owner) return false
    const t = e.target as Element | null
    return t === document.body || !!t?.matches?.('td[data-xsel]')
  }
  function onDocPaste(e: ClipboardEvent) {
    if (!clipboardTarget(e)) return
    const text = e.clipboardData?.getData('text/plain') ?? ''
    if (text === '') return
    e.preventDefault()
    applyPaste(parseClipboard(text))
  }
  function onDocCopy(e: ClipboardEvent) {
    if (!clipboardTarget(e)) return
    const text = copyText()
    if (text === null || !e.clipboardData) return
    e.clipboardData.setData('text/plain', text)
    e.preventDefault()
  }

  /* ---- document 级:键盘 / 点到别处提交 ---- */

  /** 事件落在编辑控件及它的浮层里(下拉菜单 / 日期面板 / 多行浮层 / 报错气泡)。 */
  function insideEditor(t: EventTarget | null): boolean {
    const el = t as Element | null
    const e = edit.value
    if (!el || !e || typeof el.closest !== 'function') return false
    if (el.closest('.smart-table-xta, .v-binder-follower-content, .n-tooltip')) return true
    const td = el.closest('td[data-xc]')
    return !!td && td.getAttribute('data-xc') === `${e.id}|${e.key}`
  }
  /** 键盘事件的目标是编辑控件本体(而不是日期面板里自己的输入框):Enter / Tab 才由我们接管。 */
  function onEditorBody(t: EventTarget | null): boolean {
    const el = t as Element | null
    const e = edit.value
    if (!el || !e || typeof el.closest !== 'function') return false
    if (el === document.body || el.closest('.smart-table-xta')) return true
    const td = el.closest('td[data-xc]')
    return !!td && td.getAttribute('data-xc') === `${e.id}|${e.key}`
  }

  function onDocClick(e: MouseEvent) {
    if (!enabled.value || !edit.value || insideEditor(e.target)) return
    // 点到编辑格之外:合法 = 提交并继续处理这次点击;不合法 = 留在编辑态(红框 + 提示)并吞掉这次点击
    if (!commit()) {
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
      repaint()
      return
    }
    skipEnter = true
    setTimeout(() => (skipEnter = false), 0)
    repaint()
  }

  function onDocKeydown(e: KeyboardEvent) {
    if (!enabled.value || form.value || opts.cardMode()) return
    if (e.isComposing || e.keyCode === 229) return
    const k = e.key
    const ed = edit.value
    const stop = () => {
      e.preventDefault()
      e.stopImmediatePropagation()
    }
    if (ed) {
      if (k === 'Escape') {
        stop()
        // select-table:面板搜索框里有字先清空搜索,再按一次才放弃
        if (ed.kind === 'select-table' && ctrl.pickEsc?.()) return
        cancel()
        return
      }
      if (ed.kind === 'select-table') {
        // 面板自己处理 ↑ ↓ Enter(选中)/ 搜索;Tab = 放弃并移到下一格
        if (k === 'Tab') {
          stop()
          cancel()
          if (move(e.shiftKey ? 'left' : 'right', true)) paintSel()
        }
        return
      }
      if (k === 'Tab' && onEditorBody(e.target)) {
        stop()
        finish(e.shiftKey ? 'left' : 'right')
        return
      }
      if (ed.kind === 'select') {
        // 下拉由官方 NSelect 处理 ↑ ↓ Enter / Space 选中;选中后 pick() 提交,Enter 再下移一格
        if (k === 'Enter') selectPickMove = 'down'
        else if (k === ' ') selectPickMove = null
        return
      }
      if (k === 'Enter' && onEditorBody(e.target)) {
        if (ed.kind === 'textarea' && e.shiftKey) return // 多行里 Shift+Enter 换行
        stop()
        finish(e.shiftKey ? 'up' : 'down') // Enter 提交下移、Shift+Enter 提交上移(与 Excel 一致)
      }
      return
    }
    // Ctrl / ⌘ + Z:撤销最近一次提交(没有编辑器开着、栈里有东西时才接管,否则交给浏览器)
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && k.toLowerCase() === 'z') {
      const t = e.target as Element | null
      if (
        undoStack.length &&
        !saving.value &&
        activeOwner === owner &&
        (t === document.body || !!t?.closest?.('td[data-xc]'))
      ) {
        stop()
        undo()
      }
      return
    }
    const s = sel
    if (!s || saving.value || activeOwner !== owner) return
    const t = e.target as Element | null
    if (!(t === document.body || (t && t.matches?.('td[data-xsel]')))) return
    const col = colOf(s.key)
    const kind = col ? kindOf(col) : null
    const nav = (
      { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' } as Record<
        string,
        EditMove
      >
    )[k]
    if (nav) {
      stop()
      if (move(nav, false)) paintSel()
      return
    }
    if (k === 'Tab') {
      stop()
      if (move(e.shiftKey ? 'left' : 'right', true)) paintSel()
      return
    }
    if (k === 'Enter' || k === 'F2') {
      stop()
      enter(s.id, s.key, 'key')
      return
    }
    if (k === ' ') {
      stop()
      if (kind === 'checkbox') toggleCheckbox(s.id, s.key)
      return
    }
    if (k === 'Delete' || k === 'Backspace') {
      stop()
      clearCell()
      return
    }
    if (
      k.length === 1 &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey &&
      (kind === 'input' || kind === 'textarea' || kind === 'number' || kind === 'select-table')
    ) {
      if (kind === 'number' && !/[0-9.-]/.test(k)) return
      stop()
      enter(s.id, s.key, { ch: k })
    }
  }

  /** 表体滚动(虚拟滚动会重建 td)后补画选中框;rAF 合并。 */
  let scrollRaf = 0
  function onDocScroll() {
    if (!sel || scrollRaf) return
    scrollRaf = requestAnimationFrame(() => {
      scrollRaf = 0
      paintSel(false)
    })
  }

  function beforeUnload(e: BeforeUnloadEvent) {
    e.preventDefault()
    e.returnValue = ''
  }

  // document 级监听只在 editable 开着时挂(没开 editable 的表格不多出任何全局监听,放大层的 Esc 分层测试依赖这一点)
  let bound = false
  function bind() {
    if (bound) return
    bound = true
    document.addEventListener('click', onDocClick, true)
    document.addEventListener('keydown', onDocKeydown, true)
    document.addEventListener('paste', onDocPaste, true)
    document.addEventListener('copy', onDocCopy, true)
    document.addEventListener('scroll', onDocScroll, true)
  }
  function unbind() {
    if (!bound) return
    bound = false
    document.removeEventListener('click', onDocClick, true)
    document.removeEventListener('keydown', onDocKeydown, true)
    document.removeEventListener('paste', onDocPaste, true)
    document.removeEventListener('copy', onDocCopy, true)
    document.removeEventListener('scroll', onDocScroll, true)
  }
  // 离开页面的浏览器提示:只在「有未保存修改」期间才注册(editable.beforeunload: false 可关)
  let unloadBound = false
  const wantUnload = computed(
    () => enabled.value && isDirty.value && opts.config().beforeunload !== false,
  )
  function syncUnload() {
    if (wantUnload.value === unloadBound) return
    unloadBound = wantUnload.value
    if (unloadBound) window.addEventListener('beforeunload', beforeUnload)
    else window.removeEventListener('beforeunload', beforeUnload)
  }
  watch(wantUnload, syncUnload)
  onMounted(() => {
    if (enabled.value) bind()
    syncUnload()
  })
  watch(enabled, (on) => {
    if (!ready.value) return
    if (on) bind()
    else unbind()
  })
  onBeforeUnmount(() => {
    unbind()
    if (unloadBound) window.removeEventListener('beforeunload', beforeUnload)
    unloadBound = false
    cancelAnimationFrame(scrollRaf)
    if (activeOwner === owner) activeOwner = null
  })

  // 关掉 editable:收掉所有编辑态(草稿保留在仓库里,重新打开还在)
  watch(enabled, (on) => {
    if (on) return
    edit.value = null
    err.value = null
    form.value = null
    sel = null
  })

  /** 叠草稿后的行(新增行放最前);remote 时新增行只在第 1 页显示且不撑大页长。 */
  function overlay(rows: T[], page?: { first: boolean; last: boolean; size: number }): T[] {
    if (!enabled.value) return rows
    const position = addPosition()
    const out = store.overlay(rows, position)
    if (!page) return out
    const nNew = store.news.length
    if (position === 'bottom') return !page.last && nNew ? out.slice(0, out.length - nNew) : out // 底部:只在最后一页出现、不截断
    if (!page.first && nNew) return out.slice(nNew) // 顶部:非第 1 页新增行不出现
    return page.size > 0 && out.length > page.size ? out.slice(0, page.size) : out
  }

  return {
    store,
    enabled,
    addPosition,
    count: count as ComputedRef<number>,
    isDirty: isDirty as ComputedRef<boolean>,
    hiddenDirty: hiddenDirty as ComputedRef<number>,
    saving,
    edit,
    err,
    form,
    overlay,
    styleVars,
    sheetFields,
    sheetLabelWidth: computed(() => opts.config().labelWidth ?? 72),
    kindOf,
    infoOf,
    leaves,
    optionsOf,
    cellProps,
    rowClass,
    renderCell,
    add,
    deleteChecked,
    restoreChecked,
    checkedState,
    save,
    discard,
    getChanges,
    setCell,
    openForm,
    closeForm,
    formSet,
    formPick,
    formSave,
    paintSel,
    repaint,
    clearSel,
    /** 单测用:直接驱动状态机。 */
    api: { enter, commit, finish, cancel, clearCell, toggleCheckbox, setSel, move, ctrl },
  }
}

export type UseEditableReturn<T extends object> = ReturnType<typeof useEditable<T>>
