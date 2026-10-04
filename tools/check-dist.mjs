// 构建产物检查:npm run build 之后跑(prepublishOnly 与 CI 都会跑)。
// 库有两份同内容的入口:
//   dist/index.js      —— 浏览器 / 打包工具用,第一行附近 import './index.css'(样式随 JS 一起到消费方)
//   dist/index.node.js —— package.json exports 的 "node" 条件指向它;去掉了 CSS 导入,
//                         纯 Node(vitest、服务端渲染把本包外部化时)直接 import 不会报 .css 不认识
// 这里确认:exports 配对、两份产物只差那一条 CSS 导入、node 入口真能在纯 Node 里加载。
import { readFileSync, existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const errors = []
const fail = (msg) => errors.push(msg)

const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const dot = pkg.exports?.['.'] ?? {}
if (dot.types !== './dist/index.d.ts')
  fail(`exports["."].types 应为 ./dist/index.d.ts,实际 ${dot.types}`)
if (dot.node !== './dist/index.node.js')
  fail(`exports["."].node 应为 ./dist/index.node.js,实际 ${dot.node}`)
if (dot.import !== './dist/index.js')
  fail(`exports["."].import 应为 ./dist/index.js,实际 ${dot.import}`)
const keys = Object.keys(dot)
// 条件按顺序匹配,node 必须排在 import 前面,否则 Node 会先命中 import
if (keys.indexOf('node') === -1 || keys.indexOf('node') > keys.indexOf('import'))
  fail(`exports["."] 里 "node" 必须排在 "import" 前面,实际顺序 ${keys.join(', ')}`)

const cssImport = /^import\s+['"]\.\/index\.css['"];?/m
const browserFile = resolve(root, 'dist/index.js')
const nodeFile = resolve(root, 'dist/index.node.js')
if (!existsSync(browserFile)) fail('缺少 dist/index.js')
if (!existsSync(nodeFile)) fail('缺少 dist/index.node.js')

if (existsSync(browserFile) && existsSync(nodeFile)) {
  const browser = readFileSync(browserFile, 'utf8')
  const node = readFileSync(nodeFile, 'utf8')
  if (!cssImport.test(browser))
    fail("dist/index.js 里没有 import './index.css':浏览器 / 打包工具的使用方会拿不到样式")
  if (cssImport.test(node))
    fail("dist/index.node.js 里还有 import './index.css':纯 Node 会报 ERR_UNKNOWN_FILE_EXTENSION")
  if (cssImport.test(browser) && browser.replace(cssImport, '') !== node)
    fail('dist/index.node.js 与 dist/index.js 除 CSS 导入外还有差异,两份产物应当同内容')
  if (!existsSync(resolve(root, 'dist/index.css'))) fail('缺少 dist/index.css')
}

if (!errors.length) {
  try {
    const m = await import(pathToFileURL(nodeFile).href)
    for (const name of ['SmartTable', 'SmartSelectTable', 'useTableCrud'])
      if (!m[name]) fail(`纯 Node 加载 dist/index.node.js 成功,但缺少导出 ${name}`)
  } catch (e) {
    fail(`纯 Node 加载 dist/index.node.js 失败:${e.code ?? ''} ${String(e.message).split('\n')[0]}`)
  }
}

if (errors.length) {
  console.error('check-dist 失败:\n- ' + errors.join('\n- '))
  process.exit(1)
}
console.log(
  'check-dist 通过:exports 配对正确;index.js 带样式导入;index.node.js 无样式导入且能在纯 Node 加载',
)
