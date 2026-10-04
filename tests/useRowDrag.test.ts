import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { effectScope, ref, nextTick, type EffectScope } from 'vue'

// sortablejs 是懒加载的运行时依赖;这里换成假的,只观察「有没有绑、绑到了哪个 tbody」。
const created: { el: unknown; options: any; destroyed: boolean }[] = []
vi.mock('sortablejs', () => ({
  default: {
    create: (el: unknown, options: any) => {
      const inst = { el, options, destroyed: false, destroy: () => (inst.destroyed = true) }
      created.push(inst)
      return inst
    },
  },
}))

import { useRowDrag, type RowDragOptions, type SortableFactory } from '../src/useRowDrag'

interface Row {
  id: number
}

/**
 * 等行变化触发的 watch 跑完(nextTick),再等这次对齐真正落地(含 sortablejs 动态 import)。
 * 不数 tick:动态 import 走 vitest 模块加载,耗时随机器负载变化,固定轮数在慢 CI 上会等不够。
 */
const settle = async (drag: { settled: () => Promise<void> }) => {
  await nextTick()
  await drag.settled()
}

/** 冒充 tbody:useRowDrag 只按引用比较,不碰 DOM API */
const fakeTbody = (name: string) => ({ name }) as unknown as HTMLElement

/**
 * 手动放行的 sortablejs 加载器:load() 被调用后一直挂起,直到 release() —— 用来精确制造「加载途中」的时序。
 * 实例记在自己的 made 里(不走 vi.mock 的 created)。
 */
function gatedLoader() {
  const made: { el: unknown; destroyed: boolean }[] = []
  const factory: SortableFactory = {
    create: (el) => {
      const inst = { el, destroyed: false, destroy: () => (inst.destroyed = true) }
      made.push(inst)
      return inst
    },
  }
  let open!: () => void
  const gate = new Promise<void>((r) => (open = r))
  let calls = 0
  const waiters: { n: number; resolve: () => void }[] = []
  return {
    made,
    load: async () => {
      calls++
      waiters.filter((w) => w.n <= calls).forEach((w) => w.resolve())
      await gate
      return factory
    },
    /** 等到 load 被调用满 n 次(即第 n 次对齐已走到「等加载」这一步) */
    calledTimes: (n: number) =>
      calls >= n ? Promise.resolve() : new Promise<void>((resolve) => waiters.push({ n, resolve })),
    release: () => open(),
  }
}

// 每个用例的作用域统一在 afterEach 销毁:即使断言中途失败,未完成的绑定也不会漏进下一个用例
const scopes: EffectScope[] = []
function mount(opts: RowDragOptions<Row>) {
  const scope = effectScope()
  scopes.push(scope)
  const drag = scope.run(() => useRowDrag<Row>(opts))!
  return { scope, drag }
}

beforeEach(() => (created.length = 0))
afterEach(() => scopes.splice(0).forEach((s) => s.stop()))

describe('useRowDrag', () => {
  it('远程模式:挂载时表还是空的(naive 不渲染 tbody),行到达后仍要绑上', async () => {
    // 锁定绑定时机:若只在 onMounted 绑一次 → fetcher 模式永远绑不上,手柄拖不动。
    const rows = ref<Row[]>([])
    const tbody = fakeTbody('t1')
    const { scope, drag } = mount({
      enabled: () => true,
      getTbody: () => (rows.value.length ? tbody : null), // 空表 → 没有 tbody
      rows: () => rows.value,
      onSort: () => {},
    })

    await settle(drag)
    expect(created).toHaveLength(0) // 空表时绑不上,且不能报错

    rows.value = [{ id: 1 }, { id: 2 }] // fetcher 返回
    await settle(drag)
    expect(created).toHaveLength(1)
    expect(created[0].el).toBe(tbody)

    scope.stop()
  })

  it('tbody 被重建(空↔非空)时重绑到新元素,旧实例销毁', async () => {
    const rows = ref<Row[]>([{ id: 1 }])
    let tbody = fakeTbody('t1')
    const { scope, drag } = mount({
      enabled: () => true,
      getTbody: () => (rows.value.length ? tbody : null),
      rows: () => rows.value,
      onSort: () => {},
    })
    await settle(drag)
    expect(created).toHaveLength(1)

    rows.value = [] // 搜到空 → naive 拆掉 tbody
    await settle(drag)
    expect(created[0].destroyed).toBe(true)

    tbody = fakeTbody('t2') // 再有数据 → 是一个全新的 tbody
    rows.value = [{ id: 3 }]
    await settle(drag)
    expect(created).toHaveLength(2)
    expect(created[1].el).toBe(tbody)

    scope.stop()
  })

  it('同一个 tbody 上行数据变化不重复建实例', async () => {
    const rows = ref<Row[]>([{ id: 1 }])
    const tbody = fakeTbody('t1')
    const { scope, drag } = mount({
      enabled: () => true,
      getTbody: () => tbody,
      rows: () => rows.value,
      onSort: () => {},
    })
    await settle(drag)
    rows.value = [{ id: 2 }] // 翻页/刷新:tbody 元素还是那个
    await settle(drag)
    expect(created).toHaveLength(1)

    scope.stop()
  })

  it('未启用时不加载 sortablejs;作用域销毁时释放实例', async () => {
    const rows = ref<Row[]>([{ id: 1 }])
    const off = mount({
      enabled: () => false,
      getTbody: () => fakeTbody('t1'),
      rows: () => rows.value,
      onSort: () => {},
    })
    await settle(off.drag)
    expect(created).toHaveLength(0)
    off.scope.stop()

    const on = mount({
      enabled: () => true,
      getTbody: () => fakeTbody('t2'),
      rows: () => rows.value,
      onSort: () => {},
    })
    await settle(on.drag)
    expect(created).toHaveLength(1)
    on.scope.stop()
    expect(created[0].destroyed).toBe(true)
  })

  it('onEnd:重排响应式行数组并把新顺序发给宿主', async () => {
    const rows = ref<Row[]>([{ id: 1 }, { id: 2 }, { id: 3 }])
    const onSort = vi.fn()
    const { scope, drag } = mount({
      enabled: () => true,
      getTbody: () => fakeTbody('t1'),
      rows: () => rows.value,
      handle: () => '.drag-handle',
      onSort,
    })
    await settle(drag)
    expect(created[0].options.handle).toBe('.drag-handle')

    created[0].options.onEnd({ oldIndex: 2, newIndex: 0 }) // 把第 3 行拖到首位
    expect(rows.value.map((r) => r.id)).toEqual([3, 1, 2]) // 行数组本身已重排
    expect(onSort).toHaveBeenCalledWith({
      from: 2,
      to: 0,
      reordered: [{ id: 3 }, { id: 1 }, { id: 2 }],
    })

    created[0].options.onEnd({ oldIndex: 1, newIndex: 1 }) // 原地放下 = 不是变更
    expect(onSort).toHaveBeenCalledTimes(1)

    scope.stop()
  })

  it('sortablejs 加载途中行数据又变:同一个 tbody 只绑一个实例', async () => {
    // 首次加载 sortablejs chunk 要走网络;期间翻页/刷新会再触发一次对齐。
    // 两次对齐都看到「尚未绑定」,若都在加载回来后各建一个,就会在同一 tbody 上重复绑定,且前一个永远不释放。
    const rows = ref<Row[]>([{ id: 1 }])
    const tbody = fakeTbody('t1')
    const loader = gatedLoader()
    const { scope, drag } = mount({
      enabled: () => true,
      getTbody: () => tbody,
      rows: () => rows.value,
      onSort: () => {},
      load: loader.load,
    })
    await loader.calledTimes(1) // 第一次对齐正在等加载

    rows.value = [{ id: 2 }] // 翻页:tbody 还是那个
    await loader.calledTimes(2) // 第二次对齐也走到了等加载

    loader.release()
    await settle(drag)
    expect(loader.made).toHaveLength(1)
    expect(loader.made[0].el).toBe(tbody)

    scope.stop()
    expect(loader.made[0].destroyed).toBe(true) // 唯一实例随作用域释放
  })

  it('sortablejs 加载途中组件已卸载:加载回来后不再绑定', async () => {
    const rows = ref<Row[]>([{ id: 1 }])
    const loader = gatedLoader()
    const { scope, drag } = mount({
      enabled: () => true,
      getTbody: () => fakeTbody('t1'),
      rows: () => rows.value,
      onSort: () => {},
      load: loader.load,
    })
    await loader.calledTimes(1)

    scope.stop() // 卸载时加载还没回来
    loader.release()
    await drag.settled()
    expect(loader.made).toHaveLength(0) // 否则会在已卸载的表上建出一个再也没人销毁的实例
  })
})
