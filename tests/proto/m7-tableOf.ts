// m7 / m8 / m9 测试共用:从挂好的整页里取出 SmartTable 的包装。
// 为什么自己声明类型:findComponent(泛型 SFC) 在 vue-tsc 下推不出 vm,而 exposed 的 ref 经组件代理已被解包,
// 所以这里只声明测试真正用到的那几项(行 / 分页 / search / setFilter),不用 any。
import type { VueWrapper } from '@vue/test-utils'
import type { Component } from 'vue'
import { SmartTable, type FilterValue } from '../../src/index'
import type { Row } from '../../playground/prototype/data'

export interface TableWrapper {
  props: (key: string) => unknown
  vm: {
    rows: Row[]
    pagination: { page: number; pageSize: number; itemCount: number }
    search: () => Promise<void>
    setFilter: (key: string, value: FilterValue | null) => void
  }
}

export const tableOf = (w: VueWrapper): TableWrapper =>
  w.findComponent(SmartTable as Component) as unknown as TableWrapper
