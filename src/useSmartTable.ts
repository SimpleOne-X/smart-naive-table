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

  // 「表里当前实际展示的那一页」:最近一次成功请求时的 page / pageSize,初值 = 初始分页。
  // 翻页 / 改每页条数 / 搜索是「先改页码再请求」,请求失败时页码要退回这里:
  // 否则分页条指向没拿到的页、表里却是旧页的行。取「最近成功展示的」而不是「发起请求前的值」,
  // 是因为前一个翻页请求还没回时再发一个,「发起前的值」指向一页从没展示过的数据。
  let shown = { page: pagination.page, pageSize: pagination.pageSize }

  async function run(restoreOnError: boolean) {
    const seq = ++reqSeq
    const asked = { page: pagination.page, pageSize: pagination.pageSize }
    loading.value = true
    try {
      const extra = toValue(opts?.extraParams) ?? {}
      const result: PageResult<T> = await fetcher({
        page: asked.page,
        pageSize: asked.pageSize,
        ...cleanParams(params),
        ...extra,
      })
      if (seq !== reqSeq) return
      rows.value = result.items
      pagination.itemCount = result.total
      shown = asked
    } catch (e) {
      if (seq !== reqSeq) return
      // 只还原最新那次请求;被更新请求取代的旧请求失败(上一行)什么都不动
      if (restoreOnError) {
        pagination.page = shown.page
        pagination.pageSize = shown.pageSize
      }
      opts?.onError?.(e)
    } finally {
      if (seq === reqSeq) loading.value = false
    }
  }

  // 对外的 load / refresh 不带参数(宿主可能直接 @click="table.load",事件对象不能被当成 restoreOnError)
  const load = () => run(false)

  function search() {
    pagination.page = 1
    return run(true)
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
    return run(true)
  }

  function onPageSize(s: number) {
    pagination.pageSize = s
    pagination.page = 1
    return run(true)
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
