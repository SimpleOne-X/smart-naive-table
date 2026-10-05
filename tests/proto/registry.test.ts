// @vitest-environment jsdom
// 模块注册表:14 项、编号 1..14、键序 / 名称 / 亮点 / 状态 / 分组 / natural / rowClick 与原型 docs/smart-naive-table-design.html
// 的 MODULES / GROUPS / MC 逐项一致(含模块 14「可编辑表格」)(读原型文件原文对表,改原型这几张表而没同步注册表会红)。
import { describe, expect, it } from 'vitest'
import ProtoModule from '../../playground/prototype/ProtoModule.vue'
import ProtoPlaceholder from '../../playground/prototype/modules/ProtoPlaceholder.vue'
import {
  DEFAULT_MOD,
  GROUPS,
  META,
  MODULES,
  byKey,
  byNo,
  loaderOf,
} from '../../playground/prototype/modules/registry'

// ?raw:vite 把原型文件原文当字符串导入(tsconfig 的 types 里没有 node,不用 node:fs)
import html from '../../docs/smart-naive-table-design.html?raw'

/** 取原型里 `const NAME = <字面量>;` 的字面量文本(到行首的 `};` / `];` 为止)并求值。 */
function literal(name: string, close: '}' | ']'): any {
  const start = html.indexOf(`const ${name} = ${close === '}' ? '{' : '['}`)
  expect(start, `原型里找不到 const ${name}`).toBeGreaterThan(-1)
  const open = html.indexOf('=', start) + 1
  const end = html.indexOf(`\n${close};`, start)
  return new Function(`return (${html.slice(open, end + 2).trim()})`)()
}

// 原型可能多出对照页范围之外的模块 —— 只对 no ≤ 14 的部分对表(14 = excel 可编辑表格)
const protoMods = Object.entries(literal('MODULES', '}') as Record<string, any>).filter(
  ([, m]) => m.no <= 14,
)
const protoGroups = (literal('GROUPS', ']') as { name: string; en: string; keys: string[] }[]).map(
  (g) => ({
    ...g,
    keys: g.keys.filter((k) => protoMods.some(([pk]) => pk === k)),
  }),
)

describe('模块注册表', () => {
  it('14 项,no 为 1..14,键序与原型 MODULES 一致', () => {
    expect(MODULES).toHaveLength(14)
    expect(MODULES.map((m) => m.no)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14])
    expect(META.map((m) => m.key)).toEqual(protoMods.map(([k]) => k))
    expect(MODULES.map((m) => m.key)).toEqual([
      'search',
      'toolbar',
      'filter',
      'sort',
      'wide',
      'dict',
      'persist',
      'states',
      'crud',
      'drag',
      'ms',
      'embed',
      'i18n',
      'excel',
    ])
  })

  it('名称 / 英文名 / ★ 亮点 / 状态与原型 MODULES 一致', () => {
    for (const [key, p] of protoMods) {
      const m = byKey(key as any)
      expect({ no: m.no, name: m.name, en: m.en, status: m.status, hl: !!m.hl }, key).toEqual({
        no: p.no,
        name: p.name,
        en: p.en,
        status: p.status,
        hl: !!p.hl,
      })
    }
  })

  it('组归属与原型 GROUPS 一致(5 组、组名 / 英文名 / 子页键序),i18n 不在任何分组', () => {
    expect(GROUPS.map((g) => g.name)).toEqual(['查询', '列', '行', '数据', '布局'])
    expect(GROUPS).toEqual(protoGroups)
    expect(byKey('i18n').group).toBeUndefined()
    for (const g of GROUPS) for (const k of g.keys) expect(byKey(k).group).toBe(g.name)
    expect(new Set(GROUPS.flatMap((g) => g.keys)).size).toBe(13)
  })

  it('natural / rowClick 与原型 MC 一致(原型 MC 里 natural: 仅模块 10;rowClick: 模块 11;模块 12 恒为一屏)', () => {
    const mc = html.slice(html.indexOf('const MC = {'), html.indexOf('const MCx'))
    for (const [key] of protoMods) {
      const m = new RegExp(`^  ${key}:\\s*\\{[\\s\\S]*?(?=^  \\w+:\\s*\\{|^\\};)`, 'm').exec(mc)
      expect(m, `原型 MC 里找不到 ${key}`).toBeTruthy()
      expect(!!byKey(key as any).natural, `${key}.natural`).toBe(/natural:\s*true/.test(m![0]))
      expect(!!byKey(key as any).rowClick, `${key}.rowClick`).toBe(/rowClick:\s*true/.test(m![0]))
    }
    expect(MODULES.filter((m) => m.natural).map((m) => m.no)).toEqual([10])
    expect(MODULES.filter((m) => m.rowClick).map((m) => m.no)).toEqual([11])
  })

  it('组件解析:1–4 → ProtoModule + { mod: 键 };≥ 5 有 ProtoM{N}.vue 就是它(异步),没有就是占位', () => {
    for (const m of MODULES) {
      if (m.no <= 4) {
        expect(m.comp).toBe(ProtoModule)
        expect(m.props).toEqual({ mod: m.key })
      } else if (loaderOf(m.no)) {
        expect(m.comp, `模块 ${m.no} 有文件却没挂上`).not.toBe(ProtoPlaceholder)
      } else {
        expect(m.comp, `模块 ${m.no} 没文件应是占位`).toBe(ProtoPlaceholder)
        expect(m.props).toMatchObject({ no: m.no })
      }
    }
  })

  it('byNo / 缺省模块', () => {
    expect(byNo('7')?.key).toBe('persist')
    expect(byNo(13)?.key).toBe('i18n')
    expect(byNo(14)?.key).toBe('excel')
    expect(byNo(15)).toBeUndefined()
    expect(byNo(null)).toBeUndefined()
    expect(DEFAULT_MOD).toBe('toolbar')
  })
})
