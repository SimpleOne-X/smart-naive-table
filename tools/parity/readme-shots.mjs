// README 配图拍摄脚本:从「组件预览」(dev server 的 /prototype.html,真实 SmartTable)截图,写到 assets/preview-*.png。
// 用法(dev server 须已在跑;缺省 http://localhost:5173/prototype.html,其它端口设 PARITY_PREVIEW):
//   node tools/parity/readme-shots.mjs                    # 全部重拍
//   node tools/parity/readme-shots.mjs --only filter      # 只拍名字含 filter 的
//   node tools/parity/readme-shots.mjs --list             # 列出全部图名
//   PARITY_CDP_PORT=9461 node ...                         # Edge 远程调试端口,缺省 9461
// 注意:库代码(选择面板 / 列头过滤 / 窄档抽屉等)外观有改动后,需要重拍对应的图(见 SHOTS 里每张图的 note)。
// 每张图 = 一个预览模块 + 视口 + 主题 + 可选的交互步骤 + 裁剪区域。图都是 1x,不超过 ~600KB。
import { launch, Page, sleep, previewUrl, ROOT } from './cdp.mjs'
import path from 'node:path'
import fs from 'node:fs'
import { parseArgs } from 'node:util'

const A = parseArgs({
  options: { only: { type: 'string' }, list: { type: 'boolean' } },
  strict: true,
}).values
const OUT = path.join(ROOT, 'assets')
const PORT = Number(process.env.PARITY_CDP_PORT ?? 9461)

// 裁剪区域:宽档 1440×900 去掉左侧栏(只留内容区);窄档 390×844 去掉顶部的分组条 / 子页签(预览外壳,不是库)。
const WIDE = { x: 248, y: 72, width: 1176, height: 812 }
const NARROW = { x: 0, y: 104, width: 390, height: 740 }
const FULL_NARROW = { x: 0, y: 0, width: 390, height: 844 }

const cell = (key, row) => `td[data-xc="${row}|${key}"]`

/** @type {{ name: string, mod: number, theme: 'light'|'dark', w: number, h: number, clip: object, note: string, act?: (p: Page) => Promise<void> }[]} */
const SHOTS = [
  {
    name: 'preview-wide-light',
    mod: 2,
    theme: 'light',
    w: 1440,
    h: 900,
    clip: WIDE,
    note: 'm2 条件搜索,宽档:一行式条件构造器 + 业务按钮 / 更多 / 工具栏图标 + 状态标签 + 分页',
  },
  {
    name: 'preview-narrow-light',
    mod: 2,
    theme: 'light',
    w: 390,
    h: 844,
    clip: NARROW,
    note: 'm2 同一份配置在 390 宽:自动变卡片列表(操作 ▾ / 输入框 + 筛选 / 简洁分页)',
  },
  {
    name: 'preview-wide-dark',
    mod: 2,
    theme: 'dark',
    w: 1440,
    h: 900,
    clip: WIDE,
    note: 'm2 宽档暗色',
  },
  {
    name: 'preview-narrow-dark',
    mod: 2,
    theme: 'dark',
    w: 390,
    h: 844,
    clip: NARROW,
    note: 'm2 窄档暗色',
  },
  {
    name: 'preview-header-filter',
    mod: 3,
    theme: 'light',
    w: 1440,
    h: 900,
    clip: WIDE,
    note: '【面板外观:库改动后需重拍】m3 点开「单据状态」漏斗面板(勾选式 + 高级条件)',
    act: async (p) => {
      await p.eval(
        `[...document.querySelectorAll('thead th')].find(t => t.innerText.includes('单据状态')).querySelector('.smart-table-filter-trigger').click(); true`,
      )
      await sleep(700)
    },
  },
  {
    name: 'preview-column-settings',
    mod: 7,
    theme: 'light',
    w: 1440,
    h: 900,
    clip: WIDE,
    note: 'm7 列设置面板(显隐 / 拖拽排序 / 左右固定,storage-key 持久化)',
    act: async (p) => {
      await p.eval(
        `document.querySelector('.smart-table-toolbar button[aria-label="列设置"]').click(); true`,
      )
      await sleep(700)
    },
  },
  {
    name: 'preview-editable-grid',
    mod: 14,
    theme: 'light',
    w: 1440,
    h: 900,
    clip: WIDE,
    note: 'm14 可编辑表格:改过的格带脏标记,工具栏出现「放弃修改 / 保存修改(N)」',
    act: async (p) => {
      // 选中格 → Enter 进入编辑 → 全选后键入新值 → Enter 提交(提交后选中格下移,所以两次编辑之间要重新点选)
      for (const [key, row, val] of [
        ['setup', 'R3', '40'],
        ['setup', 'R5', '45'],
      ]) {
        await p.eval(`document.querySelector('${cell(key, row)}').click(); true`)
        await sleep(400)
        await p.key('Enter', 'Enter', { vk: 13 })
        await sleep(400)
        await p.key('a', 'KeyA', { vk: 65, modifiers: 2 })
        await p.send('Input.insertText', { text: val })
        await sleep(200)
        await p.key('Enter', 'Enter', { vk: 13 })
        await sleep(500)
      }
      await p.key('Escape', 'Escape', { vk: 27 })
      await p.hover(2, 2)
      await sleep(500)
    },
  },
  {
    name: 'preview-select-table',
    mod: 14,
    theme: 'dark',
    w: 1440,
    h: 900,
    clip: WIDE,
    note: '【面板外观:库改动后需重拍】m14 点开「工序名称」:搜索框 + 带分页的表(select-table)',
    act: async (p) => {
      await p.eval(
        `(() => { const t = document.querySelector('${cell('name', 'R3')}'); t.click(); t.click(); return true })()`,
      )
      await sleep(900)
    },
  },
  {
    name: 'preview-narrow-sort-sheet',
    mod: 4,
    theme: 'dark',
    w: 390,
    h: 844,
    clip: FULL_NARROW,
    note: '【抽屉外观:库改动后需重拍】m4 窄档点「排序」:底部抽屉,每列「无 / 升序 / 降序」',
    act: async (p) => {
      await p.eval(`document.querySelector('.smart-table-toolbar-sort').click(); true`)
      await sleep(900)
    },
  },
  {
    name: 'preview-narrow-edit-sheet',
    mod: 14,
    theme: 'light',
    w: 390,
    h: 844,
    clip: FULL_NARROW,
    note: '【抽屉外观:库改动后需重拍】m14 窄档点卡片:底部抽屉表单(整行即时保存)',
    act: async (p) => {
      await p.eval(
        `(() => { document.querySelectorAll('.smart-table-card-item')[1].click(); return true })()`,
      )
      await sleep(900)
    },
  },
]

if (A.list) {
  for (const s of SHOTS) console.log(s.name.padEnd(30), s.note)
  process.exit(0)
}
const todo = A.only ? SHOTS.filter((s) => s.name.includes(A.only)) : SHOTS
if (!todo.length) throw new Error('--only 没有匹配;可选:' + SHOTS.map((s) => s.name).join(' / '))
fs.mkdirSync(OUT, { recursive: true })
const b = await launch(PORT)
try {
  for (const s of todo) {
    // 每张图一个新标签页:可编辑表格有未保存修改时离开页面会弹 beforeunload,复用同一页会卡住后续导航
    const p = await Page.open(b.port)
    await p.viewport(s.w, s.h, s.theme === 'dark', s.w < 600)
    const url = previewUrl(s.mod, s.theme)
    await p.goto(url, 500)
    await p.eval('localStorage.clear(); true') // 列设置 / 过滤态以默认值开始
    await p.goto(url, 500)
    if (
      !(await p.waitReady(
        `document.querySelectorAll('.n-data-table-tbody .n-data-table-tr, .smart-table-card-item').length > 3`,
        12000,
      ))
    )
      throw new Error('预览没渲染出表格:' + url + ' | ' + p.logs.slice(-3).join(' | '))
    await p.hover(2, 2)
    await sleep(1800) // 异步字典 / mock 后端落定
    await s.act?.(p)
    const file = path.join(OUT, s.name + '.png')
    await p.shot(file, { clip: s.clip })
    await fetch(`http://127.0.0.1:${b.port}/json/close/${p.targetId}`).catch(() => {})
    p.close()
    console.log(`${s.name}.png  ${(fs.statSync(file).size / 1024).toFixed(0)} KB  ${s.note}`)
  }
} finally {
  await b.close()
}
