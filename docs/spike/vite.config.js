// 一次性验证用,不随包发布:只用仓库现有的 vite / vue / naive-ui / @vitejs/plugin-vue,不新增依赖。
// s4 只读引用 ../../src 来复现库的现状缺陷,不修改 src。
import vue from '@vitejs/plugin-vue'
export default { plugins: [vue()], server: { fs: { allow: ['../..'] } }, build: { target: 'esnext' } }
