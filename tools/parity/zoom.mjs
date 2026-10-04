// 3 倍放大截图:分页器 / 工具栏右侧 / 首行,原型与对照页各一张,用于肉眼核对像素级细节(固定 1440x900 视口)。
//   node tools/parity/zoom.mjs [--mod 3] [--theme light|dark]   输出 tools/parity/out/z-*.png
import { launch, Page, sleep, args, OUT, PORT, KEY, previewUrl } from './cdp.mjs'
import path from 'node:path'
import fs from 'node:fs'

const A = args({
  mod: { type: 'string', default: '3' },
  theme: { type: 'string', default: 'light' },
})
const mod = A.mod,
  theme = A.theme
if (!KEY[mod]) throw new Error('--mod 取值 1,2,3,4,收到 ' + mod)
if (!['light', 'dark'].includes(theme)) throw new Error('--theme 只能是 light 或 dark')
fs.mkdirSync(OUT, { recursive: true })
const CLIPS = {
  pager: { x: 1000, y: 795, width: 380, height: 50 },
  tbright: { x: 1090, y: 110, width: 290, height: 50 },
  row: { x: 1100, y: 238, width: 280, height: 42 },
}
const b = await launch(PORT)
const shot = async (p, name, c) => {
  const r = await p.send('Page.captureScreenshot', { format: 'png', clip: { ...c, scale: 3 } })
  fs.writeFileSync(path.join(OUT, `z-${name}.png`), Buffer.from(r.data, 'base64'))
}
try {
  const p = await Page.open(PORT)
  await p.viewport(1440, 900, theme === 'dark')
  await p.goto(previewUrl(mod, theme), 600)
  if (!(await p.waitTable()))
    throw new Error(
      '对照页没渲染出表格:' + previewUrl(mod, theme) + ' | ' + p.logs.slice(-3).join(' | '),
    )
  await p.hover(2, 2)
  await sleep(1300)
  for (const [k, c] of Object.entries(CLIPS)) await shot(p, `${k}-m${mod}-prev`, c)
  await p.gotoProto()
  await p.eval(`runAct('theme', '${theme}'); enterModule('${KEY[mod]}'); true`)
  await p.hover(2, 2)
  await sleep(1500)
  for (const [k, c] of Object.entries(CLIPS)) await shot(p, `${k}-m${mod}-proto`, c)
} finally {
  await b.close()
}
