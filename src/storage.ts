import type { Density, StoredTableState } from './types'

/** 列的声明态(由 useColumns 从 props.columns 派生,persist/restore 的输入)。 */
export interface DeclaredCol {
  key: string
  show: boolean
  fixed?: 'left' | 'right'
}

// 存储键前缀是持久化格式:改动会丢掉用户已存的列设置。
const PREFIX = 'protable:'

/** 当前结构版本。v1(只有 density+cols)读到时就地升级,不丢用户已存的列设置。 */
const VERSION = 2

export function loadState(
  storageKey: string,
  fallbackDensity: Density = 'compact',
): StoredTableState | null {
  try {
    const raw = localStorage.getItem(PREFIX + storageKey)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Omit<Partial<StoredTableState>, 'v'> & { v?: number }
    // 结构不对 → 整体丢弃,回声明态
    if (!Array.isArray(parsed?.cols)) return null
    // v1 无 widths 字段,补一个空表即可升级;其余未知版本按不兼容处理
    if (parsed.v !== 1 && parsed.v !== VERSION) return null
    return {
      v: VERSION,
      density: parsed.density ?? fallbackDensity,
      cols: parsed.cols,
      widths: isWidthMap(parsed.widths) ? parsed.widths : {},
    }
  } catch {
    return null
  }
}

/** 存储里**真的存过**的 density;没有记录、或记录里没有这个字段 → undefined。写回时用它,免得把回退值当成用户的选择写进去。 */
export function peekStoredDensity(storageKey: string): Density | undefined {
  try {
    const raw = localStorage.getItem(PREFIX + storageKey)
    const d = raw ? (JSON.parse(raw) as { density?: unknown } | null)?.density : undefined
    return d === 'comfortable' || d === 'compact' ? d : undefined
  } catch {
    return undefined
  }
}

function isWidthMap(v: unknown): v is Record<string, number> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false
  // 值必须都是有限数字 —— 手改/半写坏的存储混进字符串会污染 leafWidth 的加法(字符串拼接成 "0180px")
  return Object.values(v).every((n) => typeof n === 'number' && Number.isFinite(n))
}

export function saveState(
  storageKey: string,
  density: Density | undefined,
  cols: DeclaredCol[],
  widths: Record<string, number> = {},
): void {
  try {
    const state: Omit<StoredTableState, 'density'> & { density?: Density } = {
      v: VERSION,
      ...(density ? { density } : {}),
      cols,
      widths,
    }
    localStorage.setItem(PREFIX + storageKey, JSON.stringify(state))
  } catch {
    // 存储满/隐私模式等,静默失败(功能退化为内存态)
  }
}

export function clearState(storageKey: string): void {
  try {
    localStorage.removeItem(PREFIX + storageKey)
  } catch {
    // 同上
  }
}

/**
 * 恢复合并:存储里已不存在于当前声明的 key → 剔除;
 * 新增列(声明有、存储无)按声明下标插入,show 取声明值;
 * 其余列顺序/显隐/固定以存储为准。
 */
export function mergeCols(
  declared: DeclaredCol[],
  stored: StoredTableState['cols'],
): DeclaredCol[] {
  const declaredByKey = new Map(declared.map((c) => [c.key, c]))
  const merged: DeclaredCol[] = stored
    .filter((s) => declaredByKey.has(s.key))
    .map((s) => ({ key: s.key, show: s.show, fixed: s.fixed }))
  const mergedKeys = new Set(merged.map((c) => c.key))
  declared.forEach((c, idx) => {
    if (mergedKeys.has(c.key)) return
    merged.splice(Math.min(idx, merged.length), 0, { ...c })
  })
  return merged
}
