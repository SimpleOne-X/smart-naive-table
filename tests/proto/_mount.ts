// 对照页组件测试的公共脚手架(jsdom 文件头要自己写 // @vitest-environment jsdom)。
//   import { mountApp, useAppStubs } from './_mount'
//   useAppStubs()                                   // describe 顶层调一次:每个用例前装 matchMedia / ResizeObserver 桩,用例后还原并清 body
//   const w = await mountApp(5, { lang: 'en' })     // 挂整个 ProtoApp 并进入模块 5;await 已等模块组件(异步)与首批请求
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach } from 'vitest'
import ProtoApp from '../../playground/prototype/ProtoApp.vue'
import { loaderOf } from '../../playground/prototype/modules/registry'
import { MOCK_DELAY } from '../../playground/prototype/fetcher'

export interface MountOpts {
  theme?: 'light' | 'dark'
  lang?: 'zh' | 'en'
  bg?: 'gray' | 'white'
  density?: 'compact' | 'comfortable'
  /** 额外 query(原样拼进 URL)。 */
  query?: string
}

/** jsdom 没有 matchMedia / ResizeObserver(naive-ui 与虚拟滚动要用),给最小桩。 */
export function installStubs() {
  const real = { matchMedia: window.matchMedia, ResizeObserver: (globalThis as any).ResizeObserver }
  window.matchMedia = ((q: string) => ({
    matches: false,
    media: q,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  })) as any
  ;(globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  return () => {
    window.matchMedia = real.matchMedia
    ;(globalThis as any).ResizeObserver = real.ResizeObserver
  }
}

/** describe 顶层调用:用例前装桩、模拟后端延迟置 0;用例后还原并清空 body。 */
export function useAppStubs() {
  let restore: (() => void) | undefined
  beforeEach(() => {
    restore = installStubs()
    MOCK_DELAY.ms = 0
  })
  afterEach(() => {
    restore?.()
    document.body.innerHTML = ''
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.removeAttribute('data-bg')
  })
}

/** 挂整个 ProtoApp 并进入模块 m(1..14)。 */
export async function mountApp(m: number, opts: MountOpts = {}): Promise<VueWrapper> {
  const qs = new URLSearchParams({ m: String(m), theme: opts.theme ?? 'light' })
  if (opts.lang) qs.set('lang', opts.lang)
  if (opts.bg) qs.set('bg', opts.bg)
  if (opts.density) qs.set('density', opts.density)
  history.replaceState(null, '', `/prototype.html?${qs}${opts.query ? '&' + opts.query : ''}`)
  await loaderOf(m)?.() // 模块组件是懒加载的:先把它 import 进模块缓存,挂载后 flushPromises 就够
  const w = mount(ProtoApp, { attachTo: document.body })
  await flushPromises()
  await flushPromises()
  return w as VueWrapper
}
