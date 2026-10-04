import { reactive, ref, toValue, type Ref } from 'vue'
import type {
  PageResult,
  SmartTableFetcher,
  UseSmartTableOptions,
  UseSmartTableReturn,
} from './types'

/**
 * 请求参数清洗(不改表单原值):字符串 trim,空串丢弃;丢弃 undefined/null/空数组;
 * 保留 false 和 0。
 */
export function cleanParams(params: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue
    if (typeof v === 'string') {
      const t = v.trim()
      if (t === '') continue
      out[k] = t
      continue
    }
    if (Array.isArray(v) && v.length === 0) continue
    out[k] = v
  }
  return out
}

/**
 * 列表页数据核(与 Naive 无关):loading / 数据 / 查询参数 / 分页 / 竞态守卫。
 * 消息提示留在宿主(onError),包内不弹任何 UI。
 */
export function useSmartTable<T>(
  fetcher: SmartTableFetcher<T>,
  opts?: UseSmartTableOptions,
): UseSmartTableReturn<T> {
  const loading = ref(false)
  const rows = ref<T[]>([]) as Ref<T[]>
  const params = reactive<Record<string, any>>({ ...opts?.initParams })
  const pagination = reactive({ page: 1, pageSize: opts?.defaultPageSize ?? 10, itemCount: 0 })

  // 竞态守卫:快速翻页/改页码会并发多次 load,慢的旧请求可能后到并覆盖新数据。
  // 只认最新一次请求的结果,过期响应(成功或失败)直接丢弃,loading 也只由最新请求收尾。
  let reqSeq = 0

  async function load() {
    const seq = ++reqSeq
    loading.value = true
    try {
      const extra = toValue(opts?.extraParams) ?? {}
      const result: PageResult<T> = await fetcher({
        page: pagination.page,
        pageSize: pagination.pageSize,
        ...cleanParams(params),
        ...extra,
      })
      if (seq !== reqSeq) return
      rows.value = result.items
      pagination.itemCount = result.total
    } catch (e) {
      if (seq !== reqSeq) return
      opts?.onError?.(e)
    } finally {
      if (seq === reqSeq) loading.value = false
    }
  }

  function search() {
    pagination.page = 1
    return load()
  }

  function reset() {
    const init = opts?.initParams ?? {}
    // 一律赋 null 绝不 delete/undefined:Naive 受控组件收到 undefined 会退回
    // 非受控内部值,残留旧选择。
    for (const k of Object.keys(params)) params[k] = k in init ? init[k] : null
    for (const [k, v] of Object.entries(init)) params[k] = v
    pagination.page = 1
    return load()
  }

  function onPage(p: number) {
    pagination.page = p
    return load()
  }

  function onPageSize(s: number) {
    pagination.pageSize = s
    pagination.page = 1
    return load()
  }

  if (opts?.immediate !== false) void load()

  return {
    loading,
    rows,
    params,
    pagination,
    load,
    refresh: load,
    search,
    reset,
    onPage,
    onPageSize,
  }
}
