// 原型 docs/smart-naive-table-design.html vs 对照页 /prototype.html:模块 1–14 × 视口 × 明暗 × 外壳开关,并排读数 + 截图。
//   node tools/parity/parity-all.mjs [--w 1440] [--theme light|dark] [--mods 1,2,3,4] [--diff-only]
//                                    [--lang zh|en] [--bg gray|white] [--density compact|comfortable]
// 每个模块的就绪判据 / 稳定等待 / 额外元素见 modules.mjs。
import {
  launch,
  Page,
  sleep,
  args,
  OUT,
  PORT,
  KEY,
  SHELL_VALUES,
  previewUrl,
  protoShellJs,
  shellSuffix,
} from './cdp.mjs'
import { modCfg } from './modules.mjs'
import path from 'node:path'
import fs from 'node:fs'

const A = args({
  w: { type: 'string', default: '1440' },
  theme: { type: 'string', default: 'light' },
  mods: { type: 'string', default: '1,2,3,4' },
  'diff-only': { type: 'boolean', default: false },
  lang: { type: 'string' },
  bg: { type: 'string' },
  density: { type: 'string' },
})
const vw = A.w,
  theme = A.theme,
  modsArg = A.mods,
  diffOnly = A['diff-only']
const shell = Object.fromEntries(
  ['lang', 'bg', 'density'].filter((k) => A[k] !== undefined).map((k) => [k, A[k]]),
)
const sfx = shellSuffix(shell)
if (!['light', 'dark'].includes(theme)) throw new Error('--theme 只能是 light 或 dark')
if (!(Number(vw) > 0)) throw new Error('--w 需为正整数像素宽度')
for (const m of modsArg.split(','))
  if (!KEY[m]) throw new Error(`--mods 取值 ${Object.keys(KEY).join(',')}(逗号分隔),收到 ${m}`)
for (const [k, v] of Object.entries(shell))
  if (!SHELL_VALUES[k].includes(v))
    throw new Error(`--${k} 只能是 ${SHELL_VALUES[k].join(' 或 ')},收到 ${v}`)
fs.mkdirSync(OUT, { recursive: true })
const VH = vw === '390' ? 844 : 900

// [名字, 原型选择器, 对照页选择器]
const ELS = [
  ['viewport', '.viewport', '.viewport'],
  ['root', '.smart-table', '.smart-table'],
  ['search card', '.search-card', '.smart-table-search'],
  ['table card', '.smart-table > .n-card:not(.search-card)', '.smart-table-card'],
  ['toolbar', '.tb', '.smart-table-toolbar'],
  ['title', '.st-title', '.smart-table-title'],
  ['tb-actions', '.tb-actions', '.smart-table-toolbar-actions'],
  ['tb-icons', '.tb-icons', '.smart-table-toolbar-icons'],
  ['chips', '.chips', '.smart-table-chips'],
  ['chips clear', '.chips .clear', '.smart-table-chips__clear'],
  ['data table', '.dt', '.n-data-table'],
  ['thead', 'thead', '.n-data-table-thead'],
  ['pagination', '.n-pagination', '.n-pagination'],
  // 表格底部一行(chips 靠左 + 分页靠右同一行):原型 .dt-foot ↔ 对照页 NDataTable 的分页容器(库把 chips 放进 pagination.prefix);分页不画时落到 .smart-table-chips-foot
  ['bottom row', '.dt-foot', '.n-data-table__pagination, .smart-table-chips-foot'],
]
/** 默认元素表 + 模块 els(同名覆盖,否则追加) */
const elsFor = (cfg) => {
  const out = ELS.map((e) => [...e])
  for (const e of cfg.els) {
    const i = out.findIndex((x) => x[0] === e[0])
    i >= 0 ? (out[i] = e) : out.push(e)
  }
  return out
}

const READ = (side, cfg) => `(() => {
  const P = ${side === 'proto'};
  const H = ${JSON.stringify(cfg.readHints[side === 'proto' ? 'proto' : 'prev'])};
  const SC = H.scope ?? '';
  const sc = (s) => SC ? s.split(',').map(x => SC + ' ' + x.trim()).join(',') : s;
  const ROW = sc(H.rowSel ?? (P ? 'tbody tr' : '.n-data-table-tbody tr.n-data-table-tr'));
  const TH = sc(H.thSel ?? 'thead th');
  const vis = (e) => e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
  const q1 = (s) => [...document.querySelectorAll(s)].find(vis) ?? null;
  const qa = (s) => [...document.querySelectorAll(s)].filter(vis);
  const R = (e) => { const b = e.getBoundingClientRect(); return [b.x, b.y, b.width, b.height].map(v => Math.round(v * 10) / 10).join(',') };
  const T = (e) => (e.innerText ?? e.textContent).replace(/\\s+/g, ' ').trim();
  const out = { pgItems: [], acts: [], thd: [], cell0: [], els: {}, lists: {}, styles: {}, btns: [], form: [], th: [], rows: [], chips: [], pager: '', rowH: null, docOverflow: null, htmlLang: document.documentElement.lang, errors: window.__errs ?? [] };
  for (const [n, p, q] of ${JSON.stringify(elsFor(cfg))}) { const e = q1(P ? p : q); out.els[n] = e ? R(e) : '-'; }
  const st = (n, sel, props) => { const e = q1(sel); if (!e) { out.styles[n] = '-'; return } const cs = getComputedStyle(e); out.styles[n] = props.map(p => cs[p]).join(' | ') };
  st('title font', P ? '.st-title' : '.smart-table-title', ['fontSize', 'fontWeight', 'color']);
  st('card bg/radius', P ? '.smart-table > .n-card:not(.search-card)' : '.smart-table-card', ['backgroundColor', 'borderRadius', 'borderTopColor']);
  st('viewport bg', '.viewport', ['backgroundColor']);
  st('th[1] bg/color', sc('thead th:nth-child(2)'), ['backgroundColor', 'color', 'fontWeight']);
  st('td bg', sc(P ? 'tbody tr:not(.vs-pad) td:nth-child(3)' : '.n-data-table-tbody .n-data-table-tr td:nth-child(3)'), ['backgroundColor', 'color']);
  st('tag 已审核', sc(P ? 'tbody .pill:not(.warn):not(.off)' : '.n-data-table-tbody .n-tag'), ['backgroundColor', 'color', 'borderTopColor', 'height']);
  st('pager select', sc(P ? '.pg-size .n-select' : '.n-pagination .n-base-selection'), ['width', 'height']);
  // 每个 th:漏斗 / 箭头相对 th 右缘的位置;第一行:标签、操作按钮相对 td 左缘
  out.thd = qa(TH).map(th => { const r = th.getBoundingClientRect(); const f = th.querySelector(P ? '.th-filter' : '.smart-table-filter-trigger'); const so = th.querySelector(P ? '.th-sorter' : '.n-data-table-sorter');
    const rel = (e) => { if (!e || !vis(e)) return '-'; const b = e.getBoundingClientRect(); return [Math.round(b.x - r.x), Math.round(b.y - r.y), Math.round(b.width), Math.round(b.height)].join(',') };
    const op = (e) => e ? getComputedStyle(e).opacity + '/' + getComputedStyle(e).color : '-';
    return (T(th) || '·') + ' funnel ' + rel(f) + ' ' + op(f && (f.querySelector('svg') ?? f)) + ' sorter ' + rel(so) + ' ' + op(so) });
  const tr0 = qa(ROW).find(tr => tr.cells.length > 2 && T(tr));
  out.cell0 = tr0 ? [...tr0.cells].map(td => { const r = td.getBoundingClientRect(); const k = td.querySelector('button, .n-tag, .pill, .n-checkbox, [role=checkbox]'); if (!k) return T(td) + '·' + getComputedStyle(td).textAlign; const b = k.getBoundingClientRect(); return (T(td) || '☐') + ' +' + Math.round(b.x - r.x) + ',' + Math.round(b.y - r.y) + ' ' + Math.round(b.width) + 'x' + Math.round(b.height) }) : [];
  // 搜索卡 / 工具栏 / chips 里的按钮(按 DOM 顺序)
  const bsel = P ? '.search-card button, .tb button, .chips button' : '.smart-table-search button, .smart-table-toolbar button, .smart-table-chips button';
  out.btns = qa(bsel).map(b => (T(b) || b.getAttribute('aria-label') || '?') + ' @' + R(b));
  out.form = qa(P ? '.search-card .n-form-item' : '.smart-table-search .n-form-item').map(e => T(e).slice(0, 24) + ' @' + R(e));
  out.th = qa(TH).map(e => (T(e) || '·') + ' @' + R(e));
  const trs = qa(ROW).filter(tr => tr.cells.length > 2 && T(tr));
  out.rows = trs.slice(0, 3).map(tr => [...tr.cells].map(td => T(td)).join(' ¦ '));
  out.rowH = trs[0] ? Math.round(trs[0].getBoundingClientRect().height * 100) / 100 : null;
  out.chips = qa(sc(P ? '.chips .chip' : '.smart-table-chip')).map(e => T(e) + ' @' + R(e));
  const pg = q1(sc('.n-pagination'));
  out.pager = pg ? T(pg) : '-';
  out.pgItems = pg ? [...pg.children].filter(vis).map(c => (T(c) || c.className.split(' ')[0]).slice(0, 18) + ' @' + R(c)) : [];
  out.acts = (() => { const tr = qa(ROW).find(tr => tr.cells.length > 2 && T(tr)); if (!tr) return []; const ac = H.actsCol ?? -1; const td = tr.cells[ac < 0 ? tr.cells.length + ac : ac]; if (!td) return []; const r = td.getBoundingClientRect();
    const rg = document.createRange(); return [...td.querySelectorAll('button')].map(b => { rg.selectNodeContents(b); const t = [...rg.getClientRects()].pop(); return T(b) + ' text@+' + Math.round(t.x - r.x) + ' btn ' + Math.round(b.getBoundingClientRect().width) + 'x' + Math.round(b.getBoundingClientRect().height) + ' ' + getComputedStyle(b).color }) })();
  for (const [n, p, q] of ${JSON.stringify(cfg.lists)}) { const raw = P ? p : q; const stk = raw.startsWith('sticky:'); const s = stk ? raw.slice(7) : raw; out.lists[n] = qa(s).filter(e => !stk || getComputedStyle(e).position === 'sticky').slice(0, 12).map(e => (T(e).slice(0, 18) || e.className.toString().split(' ')[0] || e.tagName.toLowerCase()) + ' @' + R(e)) }
  const de = document.documentElement; out.docOverflow = [de.scrollWidth, de.clientWidth, de.scrollHeight, de.clientHeight].join(',');
  return out;
})()`

const b = await launch(PORT)
const all = {}
try {
  const p = await Page.open(PORT)
  await p.viewport(Number(vw), VH, theme === 'dark')
  // 原型:每个视口 / 主题重新加载一次,清 localStorage,切主题
  await p.gotoProto()
  await p.eval(`localStorage.clear()`)
  await p.gotoProto()
  // 外壳开关(传了才设;未传 = 原型缺省 zh / gray / compact):先设外壳,再进模块
  await p.eval(
    `window.__errs = []; window.addEventListener('error', e => window.__errs.push(String(e.message))); runAct('theme', '${theme}'); ${protoShellJs(shell)} true`,
  )
  for (const m of modsArg.split(',')) {
    const cfg = modCfg(m)
    await p.eval(`enterModule('${KEY[m]}'); true`)
    if (!(await p.waitReady(cfg.ready.proto, 8000)))
      console.error(`警告:模块 ${m} 原型没达到就绪条件(${cfg.ready.proto}),proto 读数可能不完整`)
    await p.hover(2, 2)
    await sleep(cfg.settleMs)
    all[m] = {
      proto: await p.eval(READ('proto', cfg)),
      protoShell: await p.eval(
        `({ lang: state.lang, pageBg: state.pageBg, density: state.compact ? 'compact' : 'comfortable', theme: state.theme })`,
      ),
    }
    await p.shot(path.join(OUT, `m${m}-${theme}-${vw}${sfx}-proto.png`))
  }
  p.logs.length = 0
  for (const m of modsArg.split(',')) {
    const cfg = modCfg(m),
      url = previewUrl(m, theme, shell)
    await p.goto(url, 600)
    await p.eval(`localStorage.clear(); true`)
    await p.goto(url, 600)
    if (!(await p.waitReady(cfg.ready.prev)))
      console.error(
        `警告:模块 ${m} 对照页没达到就绪条件(${cfg.ready.prev};${url}),下面的 prev 读数不可信(占位组件 / dev server 没起 / 编译报错):` +
          p.logs.slice(-3).join(' | '),
      )
    await p.hover(2, 2)
    await sleep(cfg.settleMs)
    all[m].preview = await p.eval(READ('preview', cfg))
    all[m].previewUrl = url
    all[m].preview.errors = p.logs.filter((l) => /error|exception|warn/i.test(l)).slice(0, 8)
    p.logs.length = 0
    await p.shot(path.join(OUT, `m${m}-${theme}-${vw}${sfx}-prev.png`))
  }
} finally {
  await b.close()
}

fs.writeFileSync(
  path.join(OUT, `read-${theme}-${vw}${sfx}-m${modsArg.replaceAll(',', '_')}.json`),
  JSON.stringify(all, null, 1),
)
let total = 0
const perMod = []
for (const [m, { proto, preview, protoShell }] of Object.entries(all)) {
  const cfg = modCfg(m)
  let n = 0 // 本模块差异项数
  const buf = []
  const emit = (diff, text) => {
    if (diff) n++
    if (!diffOnly || diff) buf.push((diff ? '≠ ' : '  ') + text)
  }
  for (const k of Object.keys(proto.els)) {
    const a = proto.els[k],
      c = preview.els[k]
    emit(a !== c, `${k.padEnd(14)} proto ${a.padEnd(26)} prev ${c}`)
  }
  for (const k of Object.keys(proto.styles)) {
    const a = proto.styles[k],
      c = preview.styles[k]
    emit(a !== c, `${k.padEnd(14)} proto ${a}\n${''.padEnd(16)} prev  ${c}`)
  }
  for (const k of ['rowH', 'pager', 'docOverflow'])
    emit(
      proto[k] !== preview[k],
      `${k.padEnd(14)} proto ${proto[k]}\n${''.padEnd(16)} prev  ${preview[k]}`,
    )
  // 数组类读数 = 固定项 + 模块 lists;lists 以 'list:名字' 作键
  const arrays = [
    ...['form', 'btns', 'th', 'thd', 'cell0', 'acts', 'pgItems', 'chips', 'rows'],
    ...cfg.lists.map((l) => 'list:' + l[0]),
    'errors',
  ]
  const arr = (o, k) => (k.startsWith('list:') ? o.lists[k.slice(5)] : o[k]) ?? []
  for (const k of arrays) {
    const lines = []
    const pa = arr(proto, k),
      va = arr(preview, k)
    const len = Math.max(pa.length, va.length)
    let kd = 0
    for (let i = 0; i < len; i++) {
      const a = pa[i] ?? '(无)',
        c = va[i] ?? '(无)'
      const diff = a !== c
      if (diff) kd++
      if (!diffOnly || diff)
        lines.push(`${diff ? '≠ ' : '  '}[${i}] proto ${a}\n${''.padEnd(6)}prev  ${c}`)
    }
    n += kd
    if (!diffOnly || kd) buf.push(`-- ${k}`, ...lines)
  }
  total += n
  perMod.push(`模块 ${m}(${KEY[m]}):${n}`)
  console.log(`\n================ 模块 ${m}(${KEY[m]})· ${vw} · ${theme}${sfx} ================`)
  console.log(
    `外壳 proto state:lang=${protoShell.lang} pageBg=${protoShell.pageBg} density=${protoShell.density} theme=${protoShell.theme};prev:html lang=${preview.htmlLang || '-'},url ${all[m].previewUrl.replace(/^.*prototype\.html/, '')}(对照页是否认 lang/bg/density 以它的读数为准:html lang、viewport bg、rowH)`,
  )
  if (cfg.note) console.log('备注:' + cfg.note)
  if (diffOnly && n === 0) console.log('(无差异)')
  else console.log(buf.join('\n'))
}
console.log(
  `\n差异汇总 · ${vw} · ${theme}${sfx}:共 ${total} 项 ≠(${perMod.join(';')});截图与 JSON 在 ${path.relative(process.cwd(), OUT) || OUT}`,
)
