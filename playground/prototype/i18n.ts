// 对照页宿主文案的翻译:以「中文原文」为键查英文词典(原型 trCore / trText 的移植)。
// 用法:
//   const t = useT()            // setup 里取;在模板 / render / computed / 列标题函数里调用 t('新增') 即随外壳语言响应
//   title: () => t('物料编码')   // 列标题 / search.label / options.label 一律写成函数(库的「函数式标题」能力,渲染期求值)
// 业务词条在模块自己的文件里注册,不改本文件:
//   registerDict([['工序', 'Operations'], ['标准工时(h)', 'Std. hours (h)']], [[/共 (\d+) 道/g, '$1 steps']])
// 不翻译的是业务数据(物料名称 / 人名 / 备注),与真实应用一致;字典标签(状态 / 部门)走字典 → 翻译。
import { EN_PAIRS, makeRx } from './i18n-dict'
import { useShell } from './shell'

export type Pair = [zh: string, en: string]
export type RxPair = [RegExp, string | ((substring: string, ...args: any[]) => string)]

const pairs: Pair[] = [...EN_PAIRS]
const extraRx: RxPair[] = []
/** 只整段匹配、不参与子串替换的词条(如「检验」「质检」:否则业务数据「检验室」会被译成「Inspection室」,原型 EN_EXACT)。 */
const exactOnly = new Set<string>()
let map: Map<string, string> | null = null
let subRx: RegExp | null = null
let baseRx: RxPair[] | null = null

const esc = (k: string) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function build() {
  map = new Map(pairs)
  const subs = pairs
    .map(([k]) => k)
    .filter((k) => k.length >= 2 && !exactOnly.has(k))
    .sort((a, b) => b.length - a.length)
  subRx = subs.length ? new RegExp(subs.map(esc).join('|'), 'g') : null
  baseRx = [...extraRx, ...makeRx(translateCore)] // 模块注册的句式更具体,排在通用句式前面
}

/** 注册模块自己的英文词条(幂等:同键后注册的覆盖先注册的)。rx 是额外的整句句式。 */
export function registerDict(more: Pair[], rx: RxPair[] = [], exact: string[] = []) {
  for (const p of more) {
    const i = pairs.findIndex((x) => x[0] === p[0])
    if (i >= 0) pairs[i] = p
    else pairs.push(p)
  }
  extraRx.push(...rx)
  for (const k of exact) exactOnly.add(k)
  map = subRx = baseRx = null
}

/** 翻译一段中文(整段命中 → 句式 → 词典子串替换),总是输出英文。 */
export function translateCore(c: string): string {
  if (!map || !subRx || !baseRx) build()
  if (map!.has(c)) return map!.get(c)!
  let t = c
  for (const [rx, f] of baseRx!) t = t.replace(rx, f as any)
  return subRx ? t.replace(subRx, (m) => map!.get(m) ?? m) : t
}

/** 保留首尾空白;不含汉字原样返回(对应原型 trText)。 */
export function translate(s: string): string {
  const core = s.trim()
  if (!core || !/[一-鿿]/.test(core)) return s
  const i = s.indexOf(core)
  const out = translateCore(core)
  return out === core ? s : s.slice(0, i) + out + s.slice(i + core.length)
}

/**
 * 文本宽度(canvas 量,默认 500 字重 14px 页面字体):英文表头宽度按「函数式列标题」随语言重算,不让标题被截断(原型 textW / titleFit)。
 * jsdom 没有 canvas(getContext 返回 null)→ 退回「每字 8px / 汉字 14.5px」的估值。
 */
let _ctx: CanvasRenderingContext2D | null | undefined
export function textW(s: string, weight = 500): number {
  if (_ctx === undefined) {
    try {
      // jsdom 的 getContext 会往控制台打 Not implemented:直接跳过,走下面的估值
      _ctx = /jsdom/i.test(navigator.userAgent)
        ? null
        : document.createElement('canvas').getContext('2d')
    } catch {
      _ctx = null
    }
  }
  if (_ctx) {
    _ctx.font = `${weight} 14px ${getComputedStyle(document.body).fontFamily}`
    return _ctx.measureText(s).width
  }
  return [...s].reduce((w, ch) => w + (/[一-鿿]/.test(ch) ? 14.5 : 8), 0)
}

/** 取翻译函数。读 shell.lang,所以在响应式上下文(render / computed / 列标题函数)里调用 t() 会随语言切换更新。 */
export function useT() {
  const shell = useShell()
  return (zh: string): string => (shell.lang === 'en' ? translate(zh) : zh)
}
