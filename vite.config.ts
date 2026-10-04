import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'
import { libInjectCss } from 'vite-plugin-lib-inject-css'

// 库构建:ESM + d.ts;样式由 libInjectCss 注入进 JS(消费方无需单独 import 样式)。
// 纯 Node(vitest、服务端渲染把本包外部化时)不认识 .css 导入,所以另出一份去掉 CSS 导入的 dist/index.node.js,
// 由 package.json exports 的 "node" 条件指向它;浏览器 / 打包工具仍走带样式导入的 dist/index.js。
const cssImport = /^import\s+['"]\.\/index\.css['"];?\r?\n?/m

/** 构建结束后,从 dist/index.js 去掉 CSS 导入,写出 dist/index.node.js。找不到那条导入就让构建失败(说明 libInjectCss 的输出变了)。 */
function emitNodeEntry(): Plugin {
  let outDir = ''
  return {
    name: 'smart-naive-table:emit-node-entry',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      const entry = readFileSync(resolve(outDir, 'index.js'), 'utf8')
      if (!cssImport.test(entry))
        throw new Error("dist/index.js 里找不到 import './index.css',无法生成 dist/index.node.js")
      writeFileSync(resolve(outDir, 'index.node.js'), entry.replace(cssImport, ''))
    },
  }
}

// dev 模式(npm run dev)忽略 build.lib,直接用根 index.html 起 playground 调试。
export default defineConfig({
  plugins: [
    vue(),
    libInjectCss(),
    emitNodeEntry(),
    dts({
      include: ['src'],
      tsconfigPath: './tsconfig.json',
      // 插件默认只打印 d.ts 生成时的类型错误、构建照样成功;这里让它失败,CI 才拦得住
      afterDiagnostic: (diagnostics) => {
        if (diagnostics.length)
          throw new Error(`d.ts 生成有 ${diagnostics.length} 处类型错误,见上方输出`)
      },
    }),
  ],
  build: {
    lib: {
      entry: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
      formats: ['es'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      // 宿主自带 vue/naive-ui,保持外部;sortablejs 为运行时依赖且懒加载,外部化交消费端 code-split
      external: ['vue', 'naive-ui', 'sortablejs'],
    },
  },
})
