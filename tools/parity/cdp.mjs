// 极简 CDP 助手:用 Edge 无头 + remote-debugging-port + Node 内置 WebSocket / fetch,零依赖。
// 配置(环境变量):
//   EDGE_PATH       Edge 可执行文件,缺省 C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe
//   PARITY_PORT     CDP 远程调试端口,缺省 9351(并行跑多份时给每份不同端口)
//   PARITY_PREVIEW  对照页地址,缺省 http://localhost:5173/prototype.html(npm run dev 的 vite 缺省端口)
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'

const EDGE = process.env.EDGE_PATH ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const HERE = path.dirname(fileURLToPath(import.meta.url))
/** 仓库根:tools/parity/ 往上两级 */
export const ROOT = path.resolve(HERE, '..', '..')
/** 输出目录(截图 / JSON),已在 .gitignore */
export const OUT = path.join(HERE, 'out')
export const PORT = Number(process.env.PARITY_PORT ?? 9351)
/** 对照页(playground 的 /prototype.html),不带 query */
export const PREVIEW = process.env.PARITY_PREVIEW ?? 'http://localhost:5173/prototype.html'
/** 原型(仓库内静态 html) */
export const PROTO = pathToFileURL(path.join(ROOT, 'docs', 'smart-naive-table-design.html')).href
/** 模块编号 → 原型 enterModule 的键 */
export const KEY = {
  1: 'search',
  2: 'toolbar',
  3: 'filter',
  4: 'sort',
  5: 'wide',
  6: 'dict',
  7: 'persist',
  8: 'states',
  9: 'crud',
  10: 'drag',
  11: 'ms',
  12: 'embed',
  13: 'i18n',
  14: 'excel',
}
/** 外壳开关的合法取值(原型 runAct('lang'|'pageBg'|'density', v) 与对照页 ?lang=&bg=&density= 同值) */
export const SHELL_VALUES = {
  lang: ['zh', 'en'],
  bg: ['gray', 'white'],
  density: ['compact', 'comfortable'],
}
/** 外壳开关 → 原型 runAct 的动作名 */
const SHELL_ACT = { lang: 'lang', bg: 'pageBg', density: 'density' }
/** 原型侧设外壳开关的 JS(只含传了的项;theme 另行处理)。须在 enterModule 之前执行。 */
export const protoShellJs = (shell = {}) =>
  Object.keys(SHELL_ACT)
    .filter((k) => shell[k])
    .map((k) => `runAct('${SHELL_ACT[k]}', '${shell[k]}');`)
    .join(' ')
/** 外壳开关 → 文件名后缀(未传的不进名字,即不带后缀) */
export const shellSuffix = (shell = {}) =>
  ['lang', 'bg', 'density']
    .filter((k) => shell[k])
    .map((k) => '-' + shell[k])
    .join('')
/** 对照页带 ?m=&theme= 的完整地址 */
/** shell = { lang?, bg?, density? },只拼传了的项;对照页不认的参数会被它忽略 */
export const previewUrl = (mod, theme, shell = {}) =>
  `${PREVIEW}${PREVIEW.includes('?') ? '&' : '?'}m=${mod}&theme=${theme}` +
  ['lang', 'bg', 'density']
    .filter((k) => shell[k])
    .map((k) => `&${k}=${shell[k]}`)
    .join('')
/** 具名参数解析:schema 同 node:util.parseArgs 的 options */
export function args(options) {
  return parseArgs({ options, strict: true, allowPositionals: false }).values
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export async function launch(port = PORT, extra = []) {
  const profile = path.join(os.tmpdir(), 'smart-table-kit-edge', 'cdp-' + port) // 临时 profile 放系统临时目录: 不能放在 vite 根目录里:Edge 锁着的 Cookies 文件会让 vite 的文件监听崩掉
  fs.mkdirSync(profile, { recursive: true })
  const proc = spawn(
    EDGE,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      `--user-data-dir=${profile}`,
      `--remote-debugging-port=${port}`,
      '--remote-allow-origins=*',
      '--allow-file-access-from-files',
      'about:blank',
      ...extra,
    ],
    { stdio: 'ignore' },
  )
  let ready = false
  for (let i = 0; i < 60 && !ready; i++) {
    try {
      ready = (await fetch(`http://127.0.0.1:${port}/json/version`)).ok
    } catch {}
    if (!ready) await sleep(250)
  }
  if (!ready) {
    try {
      proc.kill()
    } catch {}
    throw new Error(`Edge 未能在端口 ${port} 启动(检查 EDGE_PATH=${EDGE} 与端口占用)`)
  }
  // 关闭:先走 CDP Browser.close,再 taskkill /T 兜底杀整棵进程树,保证脚本结束后无残留 msedge
  const close = async () => {
    try {
      const v = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()
      const ws = new WebSocket(v.webSocketDebuggerUrl)
      await new Promise((res, rej) => {
        ws.addEventListener('open', res)
        ws.addEventListener('error', rej)
      })
      ws.send(JSON.stringify({ id: 1, method: 'Browser.close' }))
      await sleep(300)
    } catch {}
    try {
      if (process.platform === 'win32' && proc.pid)
        spawnSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' })
      else proc.kill()
    } catch {}
  }
  return { proc, port, close }
}

export class Page {
  constructor(ws) {
    this.ws = ws
    this.id = 0
    this.pending = new Map()
    this.logs = []
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data)
      if (m.id && this.pending.has(m.id)) {
        const { res, rej } = this.pending.get(m.id)
        this.pending.delete(m.id)
        m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result)
      } else if (m.method === 'Runtime.consoleAPICalled') {
        this.logs.push(
          `[${m.params.type}] ` + m.params.args.map((a) => a.value ?? a.description).join(' '),
        )
      } else if (m.method === 'Runtime.exceptionThrown') {
        this.logs.push(
          '[exception] ' +
            (m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text),
        )
      }
    })
  }
  static async open(port) {
    const r = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })
    const t = await r.json()
    const ws = new WebSocket(t.webSocketDebuggerUrl)
    await new Promise((res, rej) => {
      ws.addEventListener('open', res)
      ws.addEventListener('error', rej)
    })
    const p = new Page(ws)
    p.targetId = t.id
    p.port = port
    await p.send('Page.enable')
    await p.send('Runtime.enable')
    return p
  }
  send(method, params = {}) {
    const id = ++this.id
    this.ws.send(JSON.stringify({ id, method, params }))
    return new Promise((res, rej) => this.pending.set(id, { res, rej }))
  }
  async viewport(w, h, dark = false, touch = false) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width: w,
      height: h,
      deviceScaleFactor: 1,
      mobile: false,
    })
    await this.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }],
    })
    await this.send('Emulation.setTouchEmulationEnabled', { enabled: touch })
  }
  async goto(url, waitMs = 1500) {
    await this.send('Page.navigate', { url })
    await sleep(waitMs)
  }
  async eval(expr) {
    const r = await this.send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true,
    })
    if (r.exceptionDetails)
      throw new Error(
        'eval failed: ' + (r.exceptionDetails.exception?.description ?? r.exceptionDetails.text),
      )
    return r.result.value
  }
  async waitFor(expr, timeout = 8000) {
    const t0 = Date.now()
    while (Date.now() - t0 < timeout) {
      try {
        if (await this.eval(expr)) return true
      } catch {}
      await sleep(150)
    }
    return false
  }
  /** 打开原型并等它的脚本就绪(runAct 可用);固定 sleep 在大文件冷启动时会偶发 runAct is not defined */
  async gotoProto() {
    await this.goto(PROTO, 600)
    if (
      !(await this.waitFor(
        "typeof runAct === 'function' && typeof enterModule === 'function'",
        10000,
      ))
    )
      throw new Error('原型脚本未就绪:' + PROTO + ' | ' + this.logs.slice(-3).join(' | '))
    await sleep(600)
  }
  /** 等任意就绪表达式为真(modules.mjs 的 ready.prev / ready.proto);超时返回 false */
  waitReady(expr, timeout = 10000) {
    return this.waitFor(expr, timeout)
  }
  /** 等对照页表格渲染出 >3 行;超时返回 false(多半是 dev server 没起 / 对照页源码正在被改而编译报错) */
  waitTable(timeout = 10000) {
    return this.waitFor(
      `document.querySelectorAll('.n-data-table-tbody .n-data-table-tr').length > 3`,
      timeout,
    )
  }
  async shot(file, { clip } = {}) {
    const r = await this.send('Page.captureScreenshot', {
      format: 'png',
      ...(clip ? { clip: { ...clip, scale: 1 } } : {}),
    })
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, Buffer.from(r.data, 'base64'))
  }
  async mouse(type, x, y, extra = {}) {
    await this.send('Input.dispatchMouseEvent', {
      type,
      x,
      y,
      button: 'left',
      clickCount: 1,
      ...extra,
    })
  }
  async click(x, y) {
    await this.mouse('mouseMoved', x, y)
    await this.mouse('mousePressed', x, y)
    await this.mouse('mouseReleased', x, y)
  }
  async hover(x, y) {
    await this.mouse('mouseMoved', x, y, { button: 'none' })
  }
  async key(key, code, extra = {}) {
    await this.send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key,
      code,
      windowsVirtualKeyCode: extra.vk ?? 0,
      ...extra,
    })
    await this.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key,
      code,
      windowsVirtualKeyCode: extra.vk ?? 0,
    })
  }
  /** 取元素中心点(视口坐标) */
  async center(sel, idx = 0) {
    return this.eval(
      `(() => { const e = document.querySelectorAll(${JSON.stringify(sel)})[${idx}]; if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2, w: r.width, h: r.height, l: r.left, t: r.top, r: r.right, b: r.bottom } })()`,
    )
  }
  async clickSel(sel, idx = 0) {
    const c = await this.center(sel, idx)
    if (!c) throw new Error('no element ' + sel)
    await this.click(c.x, c.y)
    return c
  }
  close() {
    try {
      this.ws.close()
    } catch {}
  }
}

export { sleep }
