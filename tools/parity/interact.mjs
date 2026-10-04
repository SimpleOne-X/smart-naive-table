// 交互态读数:点开漏斗 / 展开搜索 / 列设置 / 更多等弹层,并排对比原型与对照页弹层内元素的相对位置。
//   node tools/parity/interact.mjs [--theme light|dark] [--only <场景名子串>]
//   场景名:m3 漏斗 单据状态 / m3 漏斗 部门(单选) / m1 展开 / m2 列设置 / m2 更多(--only 漏斗 即匹配前两个)
//   另外自动并入 tools/parity/scenes/m*.mjs 里各模块自己写的场景(格式见 scenes/README.md)。
import { launch, Page, sleep, args, OUT, PORT, KEY, previewUrl } from './cdp.mjs'
import { modCfg } from './modules.mjs'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

const A = args({ theme: { type: 'string', default: 'light' }, only: { type: 'string' } })
const theme = A.theme
if (!['light', 'dark'].includes(theme)) throw new Error('--theme 只能是 light 或 dark')
fs.mkdirSync(OUT, { recursive: true })
function read(P, panelSel) {
  const vis = (e) =>
    e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden'
  const R = (e) => {
    const b = e.getBoundingClientRect()
    return [b.x, b.y, b.width, b.height].map((v) => Math.round(v * 10) / 10).join(',')
  }
  const T = (e) => (e.innerText ?? e.textContent).replace(/\s+/g, ' ').trim()
  const pn = [...document.querySelectorAll(panelSel)].find(vis)
  if (!pn) return { panel: '-' }
  const pr = pn.getBoundingClientRect()
  const rel = (e) => {
    const b = e.getBoundingClientRect()
    return [b.x - pr.x, b.y - pr.y, b.width, b.height].map((v) => Math.round(v * 10) / 10).join(',')
  }
  const items = [
    ...pn.querySelectorAll(
      'button, input, .n-select, .n-base-selection, .n-checkbox, .n-radio, .n-input',
    ),
  ]
    .filter(vis)
    .filter((e) => !e.parentElement.closest('.n-input, .n-base-selection, .n-checkbox, .n-radio'))
    .map(
      (e) =>
        (e.tagName.toLowerCase() + '.' + (e.className.baseVal ?? e.className).split(' ')[0])
          .slice(0, 26)
          .padEnd(27) +
        (T(e).slice(0, 14) || e.placeholder || '') +
        ' @' +
        rel(e),
    )
  return { panel: R(pn), text: T(pn).slice(0, 120), items }
}
const ONLY = A.only
const SCEN0 = [
  //x { name: 'm3 漏斗 物料编码', mod: 3, proto: `document.querySelector('th[data-ck="no"] .th-filter').click()`, prev: `[...document.querySelectorAll('thead th')].find(t => t.innerText.includes('物料编码')).querySelector('.smart-table-filter-trigger').click()`, pp: '.hpop', vp: '.smart-table-filter' },
  {
    name: 'm3 漏斗 单据状态',
    mod: 3,
    proto: `document.querySelector('th[data-ck="status"] .th-filter').click()`,
    prev: `[...document.querySelectorAll('thead th')].find(t => t.innerText.includes('单据状态')).querySelector('.smart-table-filter-trigger').click()`,
    pp: '.hpop',
    vp: '.smart-table-filter',
  },
  {
    name: 'm3 漏斗 部门(单选)',
    mod: 3,
    proto: `document.querySelector('th[data-ck="dept"] .th-filter').click()`,
    prev: `[...document.querySelectorAll('thead th')].find(t => t.innerText.includes('部门')).querySelector('.smart-table-filter-trigger').click()`,
    pp: '.hpop',
    vp: '.smart-table-filter',
  },
  {
    name: 'm1 展开',
    mod: 1,
    proto: `document.querySelector('[data-act="sfToggle"]').click()`,
    prev: `[...document.querySelectorAll('.smart-table-search button')].find(b => b.innerText.includes('展开')).click()`,
    pp: '.search-card',
    vp: '.smart-table-search',
  },
  {
    name: 'm2 列设置',
    mod: 2,
    proto: `document.querySelector('[data-act="cols"]').click()`,
    prev: `document.querySelector('.smart-table-toolbar button[aria-label="列设置"]').click()`,
    pp: '.colset-pop',
    vp: '.n-popover:has(.smart-table-colset)',
  },
  {
    name: 'm2 更多',
    mod: 2,
    proto: `document.querySelector('[data-act="more"]').click()`,
    prev: `[...document.querySelectorAll('.smart-table-toolbar button')].find(b => b.innerText.includes('更多')).click()`,
    pp: '.more-pop',
    vp: '.n-dropdown-menu',
  },
]
// 合并 scenes/m*.mjs:每个文件 export default 一个场景对象或场景数组(也认具名导出 scenes)。只追加,不改上面的既有场景。
const SCENES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'scenes')
const EXTRA = []
if (fs.existsSync(SCENES_DIR)) {
  for (const f of fs
    .readdirSync(SCENES_DIR)
    .filter((n) => /^m\d+.*\.mjs$/.test(n))
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))) {
    const mod = await import(pathToFileURL(path.join(SCENES_DIR, f)).href)
    const list = [mod.default ?? mod.scenes ?? []].flat()
    for (const s of list) {
      const miss = ['name', 'mod', 'proto', 'prev', 'pp', 'vp'].filter(
        (k) => s?.[k] === undefined || s[k] === '',
      )
      if (miss.length)
        throw new Error(
          `scenes/${f}:场景 ${JSON.stringify(s?.name)} 缺字段 ${miss.join(',')}(格式见 scenes/README.md)`,
        )
      if (!KEY[s.mod])
        throw new Error(
          `scenes/${f}:场景 ${s.name} 的 mod=${s.mod} 不在 1–${Object.keys(KEY).length}`,
        )
      EXTRA.push({ ...s, file: f })
    }
  }
}
const ALL = [...SCEN0, ...EXTRA]
{
  const seen = new Set()
  for (const s of ALL) {
    if (seen.has(s.name)) throw new Error('场景名重复:' + s.name)
    seen.add(s.name)
  }
}
const SCEN = ONLY ? ALL.filter((s) => s.name.includes(ONLY)) : ALL
if (!SCEN.length)
  throw new Error(`--only ${ONLY} 没有匹配的场景;可选:` + ALL.map((s) => s.name).join(' / '))
const b = await launch(PORT)
const res = []
try {
  const p = await Page.open(PORT)
  await p.viewport(1440, 900, theme === 'dark')
  for (const s of SCEN) {
    await p.gotoProto()
    const cfg = modCfg(s.mod)
    const pre = (side) => (typeof s.pre === 'string' ? s.pre : s.pre?.[side]) ?? ''
    await p.eval(
      `localStorage.clear(); runAct('theme', '${theme}'); enterModule('${KEY[s.mod]}'); true`,
    )
    if (!(await p.waitReady(cfg.ready.proto, 8000)))
      console.error(`警告:场景 ${s.name} 原型没达到就绪条件(${cfg.ready.proto})`)
    await p.hover(2, 2)
    await sleep(s.settleMs ?? cfg.settleMs)
    if (pre('proto')) {
      await p.eval(pre('proto') + '; true')
      await sleep(300)
    }
    await p.eval(s.proto + '; true')
    await sleep(600)
    const P = await p.eval(`(${read.toString()})(true, ${JSON.stringify(s.pp)})`)
    await p.shot(path.join(OUT, `i-${s.name.replace(/\s+/g, '_')}-proto.png`))
    await p.goto(previewUrl(s.mod, theme), 600)
    await p.eval('localStorage.clear(); true')
    await p.goto(previewUrl(s.mod, theme), 600)
    if (!(await p.waitReady(cfg.ready.prev)))
      throw new Error(
        '对照页没达到就绪条件(' +
          cfg.ready.prev +
          '):' +
          previewUrl(s.mod, theme) +
          ' | ' +
          p.logs.slice(-3).join(' | '),
      )
    await p.hover(2, 2)
    await sleep(s.settleMs ?? (cfg.settleMs === 1500 ? 1300 : cfg.settleMs)) // 未声明 settleMs 的模块等 1300ms
    if (pre('prev')) {
      await p.eval(pre('prev') + '; true')
      await sleep(300)
    }
    await p.eval(s.prev + '; true')
    await sleep(600)
    const V = await p.eval(`(${read.toString()})(false, ${JSON.stringify(s.vp)})`)
    await p.shot(path.join(OUT, `i-${s.name.replace(/\s+/g, '_')}-prev.png`))
    console.log(`\n=== ${s.name}\nP panel ${P.panel}  ${P.text}\nV panel ${V.panel}  ${V.text}`)
    const n = Math.max(P.items?.length ?? 0, V.items?.length ?? 0)
    for (let i = 0; i < n; i++) {
      const a = P.items?.[i] ?? '(无)',
        c = V.items?.[i] ?? '(无)'
      console.log(`  P ${a}\n  V ${c}`)
    }
  }
} finally {
  await b.close()
}
