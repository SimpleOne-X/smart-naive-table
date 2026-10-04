import { describe, expect, it, vi } from 'vitest'
import { useSmartTable } from '../src/useSmartTable'
import type { PageResult } from '../src/types'

interface Row {
  id: number
}

function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const page = (ids: number[], total = 100): PageResult<Row> => ({
  items: ids.map((id) => ({ id })),
  total,
})

describe('useSmartTable', () => {
  it('race guard: out-of-order stale response is discarded', async () => {
    const d1 = deferred<PageResult<Row>>()
    const d2 = deferred<PageResult<Row>>()
    const queue = [d1, d2]
    const table = useSmartTable<Row>(() => queue.shift()!.promise, { immediate: false })

    const p1 = table.load()
    const p2 = table.load()
    // 后发的先回,先发的(过期)后回
    d2.resolve(page([2]))
    await p2
    d1.resolve(page([1]))
    await p1

    expect(table.rows.value).toEqual([{ id: 2 }])
    expect(table.loading.value).toBe(false)
  })

  it('race guard: stale failure neither reports error nor flips loading', async () => {
    const d1 = deferred<PageResult<Row>>()
    const d2 = deferred<PageResult<Row>>()
    const queue = [d1, d2]
    const onError = vi.fn()
    const table = useSmartTable<Row>(() => queue.shift()!.promise, { immediate: false, onError })

    const p1 = table.load()
    const p2 = table.load()
    d2.resolve(page([2]))
    await p2
    d1.reject(new Error('stale'))
    await p1

    expect(onError).not.toHaveBeenCalled()
    expect(table.rows.value).toEqual([{ id: 2 }])
  })

  it('search resets to page 1; pageSize change resets page and reloads', async () => {
    const calls: Array<Record<string, any>> = []
    const table = useSmartTable<Row>(
      async (p) => {
        calls.push(p)
        return page([1])
      },
      { immediate: false },
    )

    await table.onPage(3)
    expect(calls.at(-1)).toMatchObject({ page: 3, pageSize: 10 })

    await table.search()
    expect(calls.at(-1)).toMatchObject({ page: 1 })

    await table.onPage(5)
    await table.onPageSize(20)
    expect(calls.at(-1)).toMatchObject({ page: 1, pageSize: 20 })
    expect(table.pagination.page).toBe(1)
    expect(table.pagination.pageSize).toBe(20)
  })

  it('sends cleaned search params plus extraParams, and stores total', async () => {
    const calls: Array<Record<string, any>> = []
    const table = useSmartTable<Row>(
      async (p) => {
        calls.push(p)
        return page([1], 42)
      },
      {
        immediate: false,
        initParams: { name: '', account: ' tom ' },
        extraParams: () => ({ orgId: 7 }),
      },
    )

    await table.load()
    expect(calls[0]).toEqual({ page: 1, pageSize: 10, account: 'tom', orgId: 7 })
    expect(table.pagination.itemCount).toBe(42)
  })

  it('failure calls onError and ends loading', async () => {
    const onError = vi.fn()
    const table = useSmartTable<Row>(async () => Promise.reject(new Error('boom')), {
      immediate: false,
      onError,
    })

    await table.load()
    expect(onError).toHaveBeenCalledOnce()
    expect(table.loading.value).toBe(false)
  })

  it('reset restores initParams, nulls extra keys (never deletes), and goes to page 1', async () => {
    const table = useSmartTable<Row>(async () => page([1]), {
      immediate: false,
      initParams: { name: 'a' },
    })

    table.params.name = 'changed'
    table.params.added = 'x'
    table.pagination.page = 9
    await table.reset()

    expect(table.params.name).toBe('a')
    expect(table.params.added).toBeNull()
    expect('added' in table.params).toBe(true)
    expect(table.pagination.page).toBe(1)
  })

  it('immediate defaults to true', async () => {
    const fetcher = vi.fn(async () => page([1]))
    useSmartTable<Row>(fetcher)
    await Promise.resolve()
    expect(fetcher).toHaveBeenCalledOnce()
  })
})

describe('请求失败后的页码(D3:3.0.0 起还原到上一次成功展示的页)', () => {
  const failing = () => Promise.reject(new Error('boom'))

  /** 先成功拉到第 1 页(每页 10),再让 fetcher 之后的调用失败 */
  async function failAfterFirst(opts?: { onError?: (e: unknown) => void }) {
    let ok = true
    const table = useSmartTable<Row>(async () => (ok ? page([1]) : failing()), {
      immediate: false,
      ...opts,
    })
    await table.load()
    ok = false
    return table
  }

  it('onPage(p) 失败 → page 还原,onError 照常调用', async () => {
    const onError = vi.fn()
    const table = await failAfterFirst({ onError })
    await table.onPage(3)
    expect(table.pagination.page).toBe(1)
    expect(onError).toHaveBeenCalledOnce()
    expect(table.rows.value).toEqual([{ id: 1 }]) // 表里仍是旧页的行
  })

  it('onPageSize(s) 失败 → pageSize 与 page 都还原', async () => {
    let ok = true
    const table = useSmartTable<Row>(async () => (ok ? page([1]) : failing()), { immediate: false })
    await table.onPage(4)
    expect(table.pagination.page).toBe(4)
    ok = false
    await table.onPageSize(50)
    expect(table.pagination.pageSize).toBe(10)
    expect(table.pagination.page).toBe(4)
  })

  it('search() 失败 → page 还原(不是停在 1)', async () => {
    let ok = true
    const table = useSmartTable<Row>(async () => (ok ? page([1]) : failing()), { immediate: false })
    await table.onPage(5)
    ok = false
    await table.search()
    expect(table.pagination.page).toBe(5)
  })

  it('成功时行为不变:页码 / 每页条数停在新值', async () => {
    const table = useSmartTable<Row>(async () => page([1]), { immediate: false })
    await table.onPage(3)
    await table.onPageSize(20)
    expect(table.pagination).toMatchObject({ page: 1, pageSize: 20 })
    await table.onPage(2)
    expect(table.pagination.page).toBe(2)
  })

  it('load() / refresh() 失败不动页码(它们本来就没改页码)', async () => {
    let ok = true
    const table = useSmartTable<Row>(async () => (ok ? page([1]) : failing()), { immediate: false })
    await table.onPage(3)
    ok = false
    await table.load()
    expect(table.pagination.page).toBe(3)
  })

  it('竞态:被更新请求取代的旧请求失败,不还原(页码仍指向最新请求)', async () => {
    const d1 = deferred<PageResult<Row>>()
    const d2 = deferred<PageResult<Row>>()
    const queue = [d1, d2]
    const table = useSmartTable<Row>(() => queue.shift()!.promise, { immediate: false })
    const p1 = table.onPage(2)
    const p2 = table.onPage(3)
    d1.reject(new Error('stale'))
    await p1
    expect(table.pagination.page).toBe(3) // 旧请求失败:不还原
    d2.resolve(page([3]))
    await p2
    expect(table.pagination.page).toBe(3)
    expect(table.rows.value).toEqual([{ id: 3 }])
  })

  it('竞态:最新请求失败,还原到「表里实际展示的页」(前一个未回的请求没有展示过)', async () => {
    const d0 = deferred<PageResult<Row>>()
    const d1 = deferred<PageResult<Row>>()
    const d2 = deferred<PageResult<Row>>()
    const queue = [d0, d1, d2]
    const table = useSmartTable<Row>(() => queue.shift()!.promise, { immediate: false })
    const p0 = table.load()
    d0.resolve(page([1]))
    await p0 // 第 1 页已展示
    const p1 = table.onPage(2) // 未回
    const p2 = table.onPage(3)
    d2.reject(new Error('boom'))
    await p2
    expect(table.pagination.page).toBe(1) // 不是 2:第 2 页从未展示过
    d1.resolve(page([2])) // 旧请求后到,被丢弃
    await p1
    expect(table.rows.value).toEqual([{ id: 1 }])
    expect(table.pagination.page).toBe(1)
  })
})
