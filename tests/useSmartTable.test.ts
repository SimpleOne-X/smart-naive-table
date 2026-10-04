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
