<script setup lang="ts">
// 对照页宿主外壳:复刻 docs/smart-naive-table-design.html 的侧栏 / 面包屑 / 标题 / NLayout embedded 灰底 / 浅深色切换。
// 外壳本身不是被测对象(原型里也是手写的),被测的是 NLayout 里那张 <SmartTable>。
// URL 参数:?m=1..4(模块)、?theme=light|dark(缺省跟随系统,与原型一致)。
import { computed, onMounted, provide, ref, watch } from 'vue'
import { darkTheme, dateZhCN, NConfigProvider, NLayout, NMessageProvider, zhCN } from 'naive-ui'
import { SMART_TABLE_DEFAULTS, createSmartTableDefaults, zhCNLabels } from '../../src/index'
import ProtoModule from './ProtoModule.vue'

type Mod = 'search' | 'toolbar' | 'filter' | 'sort'
const MODULES: Record<Mod, { no: number; name: string; status: string; statusTxt: string }> = {
  search: { no: 1, name: '搜索区布局', status: 'done', statusTxt: '已定' },
  toolbar: { no: 2, name: '按钮与工具栏', status: 'done', statusTxt: '已定' },
  filter: { no: 3, name: '过滤筛选', status: 'done', statusTxt: '已定' },
  sort: { no: 4, name: '排序', status: 'done', statusTxt: '已定' },
}
const byNo: Record<string, Mod> = { '1': 'search', '2': 'toolbar', '3': 'filter', '4': 'sort' }

const q = new URLSearchParams(location.search)
// 原型初始模块是 toolbar(模块 2)
const mod = ref<Mod>(byNo[q.get('m') ?? ''] ?? 'toolbar')
const theme = ref<'light' | 'dark'>(
  q.get('theme') === 'dark' || q.get('theme') === 'light'
    ? (q.get('theme') as 'light' | 'dark')
    : matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light',
)
watch(theme, (t) => (document.documentElement.dataset.theme = t), { immediate: true })
watch(mod, (m) => {
  const u = new URL(location.href)
  u.searchParams.set('m', String(MODULES[m].no))
  history.replaceState(null, '', u)
})
onMounted(() => {
  document.title = 'SmartTable 设计方案(真实库对照页)'
})

const naiveTheme = computed(() => (theme.value === 'dark' ? darkTheme : null))

/* ------------------------------------------------------------------
   宿主的全局默认(H 类):把库默认值对齐原型
   - align / titleAlign:库默认 center,原型左对齐(金额列在列上写 align: 'right')
   - tag:库默认 { size: small, bordered: false },原型徽标是 NTag small + 默认 bordered
   - labels:用库自带的 zhCNLabels 打底,再把与原型措辞不同的几个词改回原型的说法
   - 其余(density compact、defaultPageSize 100、pageSizes [100,500,1000]、simple 分页、16px 卡片内边距)已是库的 3.0 默认,不用配
------------------------------------------------------------------- */
provide(
  SMART_TABLE_DEFAULTS,
  createSmartTableDefaults({
    align: 'left',
    titleAlign: 'left',
    tag: { size: 'small', bordered: true },
    labels: {
      ...zhCNLabels,
      search: '搜索', // 库中文包「查询」
      filter: '筛选', // 「过滤」
      filterConfirm: '确认', // 「确定」
      filterLike: '类似于', // 「模糊匹配」
      filterStartsWith: '左包含', // 「开头是」
      filterEndsWith: '右包含', // 「结尾是」
      filterIn: 'IN', // 「属于」
      filterNotIn: 'NOT IN', // 「不属于」
      filterNoValue: '不需要填值', // 「无需填值」
    },
  }),
)
</script>

<template>
  <n-config-provider :theme="naiveTheme" :locale="zhCN" :date-locale="dateZhCN" style="display: contents">
    <n-message-provider>
      <div class="app">
        <aside class="side">
          <h1>SmartTable 设计方案</h1>
          <p class="sub">v2.1.1 → 3.0.0 · 2026-09-30</p>
          <div class="group-title">设计模块</div>
          <div id="modList">
            <button v-for="(m, k) in MODULES" :key="k" class="mod" :class="{ on: mod === k }" @click="mod = k">
              <span class="no">{{ m.no }}</span><span class="nm">{{ m.name }}</span>
              <span class="st" :class="m.status">{{ m.statusTxt }}</span>
            </button>
          </div>
          <div id="modPanel">
            <div class="group-title">主题</div>
            <div class="mini">
              <button :class="{ on: theme === 'light' }" @click="theme = 'light'">浅色</button>
              <button :class="{ on: theme === 'dark' }" @click="theme = 'dark'">深色</button>
            </div>
          </div>
        </aside>

        <main class="main">
          <div class="crumb">SmartTable 设计方案 / {{ MODULES[mod].no }}. {{ MODULES[mod].name }}</div>
          <div class="stage-head"><h2>{{ MODULES[mod].name }}</h2></div>
          <div id="stage">
            <!-- 原型 .viewport:宿主页面区域 = NLayout embedded 的灰底,圆角 10px,内边距 22px -->
            <n-layout embedded class="viewport" content-style="display:flex;flex-direction:column;height:100%;padding:22px;box-sizing:border-box;">
              <KeepAlive>
                <ProtoModule :key="mod" :mod="mod" />
              </KeepAlive>
            </n-layout>
          </div>
        </main>
      </div>
    </n-message-provider>
  </n-config-provider>
</template>

<style>
/* 外壳 token(原型 :root / html[data-theme="dark"] 中外壳用到的那部分,改前缀 --px- 避免与 naive 组件根上的 --n-* 撞名) */
:root {
  --px-primary: #18a058;
  --px-on-primary: #ffffff;
  --px-shell-bg: #ececee;
  --px-panel-bg: #ffffff;
  --px-border: rgb(239, 239, 245);
  --px-border-strong: rgb(224, 224, 230);
  --px-text: rgb(51, 54, 57);
  --px-text-2: rgb(118, 124, 130);
  --px-item-hover: rgb(243, 243, 245);
  --px-tag-plain: #eee;
  --px-warn: #d97706;
  --px-ok: #18a058;
}
html[data-theme='dark'] {
  --px-primary: #63e2b7;
  --px-on-primary: #000000;
  --px-shell-bg: #0b0b0e;
  --px-panel-bg: rgb(24, 24, 28);
  --px-border: rgba(255, 255, 255, 0.09);
  --px-border-strong: rgba(255, 255, 255, 0.24);
  --px-text: rgba(255, 255, 255, 0.82);
  --px-text-2: rgba(255, 255, 255, 0.52);
  --px-item-hover: rgba(255, 255, 255, 0.09);
  --px-tag-plain: rgb(51, 51, 51);
  --px-warn: #fbbf24;
  --px-ok: #63e2b7;
}
* { box-sizing: border-box; }
html, body { height: 100%; overflow: hidden; }
html { color-scheme: light; }
html[data-theme='dark'] { color-scheme: dark; }
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro SC', 'PingFang SC', 'Microsoft YaHei', 'Segoe UI', sans-serif;
  font-size: 14px; color: var(--px-text); background: var(--px-shell-bg);
  -webkit-font-smoothing: antialiased;
}

/* ---------- 骨架(原型 .app / .side / .main,含「页面占满视口」片段) ---------- */
.app { line-height: normal; display: grid; grid-template-columns: 232px 1fr; height: 100vh; height: 100dvh; min-height: 0; overflow: hidden; }
.side {
  background: var(--px-panel-bg); border-right: 1px solid var(--px-border);
  padding: 22px 14px 40px; position: sticky; top: 0; height: 100%; overflow-y: auto;
}
.side h1 { font-size: 15px; margin: 0 0 4px; letter-spacing: .2px; font-weight: 700; }
.side .sub { font-size: 11.5px; color: var(--px-text-2); margin: 0 0 18px; line-height: 1.6; }
.side .group-title { font-size: 11px; font-weight: 600; letter-spacing: .08em; color: var(--px-text-2); text-transform: uppercase; margin: 22px 0 8px; }
.mod {
  display: flex; align-items: center; gap: 8px; width: 100%; text-align: left; cursor: pointer;
  border: 1px solid transparent; background: transparent; color: inherit;
  border-radius: 7px; padding: 9px 10px; margin-bottom: 3px; font-family: inherit; font-size: 13px;
  transition: background-color .15s;
}
.mod:hover { background: var(--px-item-hover); }
.mod.on { background: color-mix(in srgb, var(--px-primary) 10%, transparent); border-color: color-mix(in srgb, var(--px-primary) 35%, transparent); font-weight: 600; }
.mod .no { width: 20px; height: 20px; border-radius: 5px; flex: none; font-size: 11px; display: inline-flex; align-items: center; justify-content: center; background: var(--px-tag-plain); color: var(--px-text-2); font-weight: 600; }
.mod.on .no { background: var(--px-primary); color: var(--px-on-primary); }
.mod .nm { flex: 1 1 auto; min-width: 0; }
.mod .st { font-size: 10px; padding: 1px 5px; border-radius: 3px; flex: none; font-weight: 500; }
.st.done { background: color-mix(in srgb, var(--px-ok) 16%, transparent); color: var(--px-ok); }
.mini { display: flex; gap: 6px; }
.mini button { flex: 1; cursor: pointer; font-family: inherit; font-size: 12px; border: 1px solid var(--px-border-strong); background: transparent; color: var(--px-text-2); border-radius: 5px; padding: 5px 8px; transition: background-color .15s, border-color .15s, color .15s; }
.mini button:hover { border-color: var(--px-primary); }
.mini button.on { border-color: var(--px-primary); color: var(--px-primary); background: color-mix(in srgb, var(--px-primary) 10%, transparent); }

.main { padding: 26px 32px 26px; min-width: 0; display: flex; flex-direction: column; min-height: 0; overflow-y: auto; }
.main > * { flex: none; }
.crumb { font-size: 12px; color: var(--px-text-2); margin-bottom: 6px; }
.stage-head { display: flex; align-items: baseline; gap: 12px; margin-bottom: 6px; flex-wrap: wrap; }
.stage-head h2 { margin: 0 0 0; font-size: 20px; letter-spacing: -.01em; font-weight: 700; }
#stage { flex: 1 1 0; min-height: 0; display: flex; flex-direction: column; margin-top: 18px; }
/* 原型 .stage-desc 为空时 display:none,.stage-head 下方到 .viewport 的间距只有 stage-head 的 margin-bottom 6px;这里不再额外留 18px */
#stage { margin-top: 0; }
.viewport.n-layout { flex: 1 1 0; min-height: 0; border-radius: 10px; }
.viewport > .n-layout-scroll-container { overflow: hidden; }

@media (max-width: 860px) {
  .app { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); }
  .side { position: sticky; top: 0; z-index: 20; height: auto; overflow: visible; border-right: 0; border-bottom: 1px solid var(--px-border); padding: 10px 12px; }
  .side h1, .side .sub, .side .group-title, #modPanel { display: none; }
  #modList { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; }
  #modList::-webkit-scrollbar { display: none; }
  .mod { width: auto; flex: none; margin-bottom: 0; white-space: nowrap; }
  .main { padding: 0; }
  .crumb, .stage-head { display: none; }
  .viewport.n-layout { border-radius: 0; }
  .viewport > .n-layout-scroll-container { padding: 12px !important; }
}
</style>
