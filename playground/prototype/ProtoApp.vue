<script setup lang="ts">
// 对照页宿主外壳:复刻 docs/smart-naive-table-design.html 的侧栏 / 面包屑 / 标题 / NLayout embedded 灰底 / 全局设置四个开关。
// 外壳本身不是被测对象(原型里也是手写的),被测的是 NLayout 里那张 <SmartTable>。
// 外壳只读模块注册表(modules/registry.ts);新增模块不用改这个文件。
// URL 参数:?m=1..14(模块)、?theme=light|dark(缺省跟随系统)、?lang=zh|en、?bg=gray|white、?density=compact|comfortable。
import { computed, onMounted, provide, ref, watch } from 'vue'
import {
  darkTheme,
  dateEnUS,
  dateZhCN,
  enUS,
  NConfigProvider,
  NDialogProvider,
  NLayout,
  NMessageProvider,
  zhCN,
} from 'naive-ui'
import {
  SMART_TABLE_DEFAULTS,
  createSmartTableDefaults,
  defaultLabels,
  zhCNLabels,
} from '../../src/index'
import { translate } from './i18n'
import { SHELL_KEY, createShell } from './shell'
import { COMPONENT_OPTIONS } from './TrayIcon'
import {
  DEFAULT_MOD,
  GROUPS,
  STATUS_TXT,
  byKey,
  byNo,
  groupModules,
  type GroupMeta,
  type ModKey,
} from './modules/registry'

const shell = createShell()
provide(SHELL_KEY, shell)

const q = new URLSearchParams(location.search)
const mod = ref<ModKey>(byNo(q.get('m'))?.key ?? DEFAULT_MOD)
const cur = computed(() => byKey(mod.value))

const t = (zh: string) => (shell.lang === 'en' ? translate(zh) : zh)
/* 侧栏 / 面包屑 / 页头标题的名称按语言直接出(原型 navName:MODULES / GROUPS 自带 en,不走词典 —— 「列」「行」「数据」这类短词进词典会误伤别处) */
const navName = (o: { name: string; en: string }) => (shell.lang === 'en' ? o.en : o.name)

/* 侧栏两级目录:5 组(原型 GROUPS)。i18n(m13)不在任何分组里,只能 ?m=13 进。
   窄档(≤ 860px)侧栏收成顶部分组条(#grpBar),组内 ≥2 个子页时在内容区上方出子页签。 */
const groups = GROUPS.map((g) => ({ meta: g, mods: groupModules(g) }))
const curGroup = computed(() => groups.find((g) => g.meta.keys.includes(mod.value)))
const subTabs = computed(() =>
  curGroup.value && curGroup.value.mods.length > 1 ? curGroup.value.mods : [],
)
// 窄档分组条:点分组 = 进入其第一个子页;已在组内则保持当前子页
const pickGroup = (g: { meta: GroupMeta }) => {
  if (curGroup.value?.meta !== g.meta) mod.value = g.meta.keys[0]
}

watch(mod, (m) => {
  const u = new URL(location.href)
  u.searchParams.set('m', String(byKey(m).no))
  history.replaceState(null, '', u)
})
watch(
  () => shell.theme,
  (v) => (document.documentElement.dataset.theme = v),
  { immediate: true },
)
watch(
  () => shell.bg,
  (v) => (document.documentElement.dataset.bg = v),
  { immediate: true },
)
watch(
  () => shell.lang,
  (v) => (document.documentElement.lang = v === 'en' ? 'en' : 'zh-CN'),
  { immediate: true },
)
onMounted(() => {
  document.title = 'SmartTable 设计方案(真实库对照页)'
})

const naiveTheme = computed(() => (shell.theme === 'dark' ? darkTheme : null))

/* ------------------------------------------------------------------
   宿主的全局默认(H 类):把库默认值对齐原型
   - align / titleAlign:库默认 center,原型左对齐(金额列在列上写 align: 'right')
   - tag:库默认 { size: small, bordered: false },原型徽标是 NTag small + 默认 bordered
   - labels:随语言切换(传 computed,库在渲染期 toValue 解引用)。中文 = 库自带 zhCNLabels 打底,再把与原型措辞不同的几个词改回原型的说法;
     英文 = 库默认(英文)包,原型英文里 IN / NOT IN 无汉字不翻
   - 其余(density compact、defaultPageSize 100、pageSizes [100,500,1000]、simple 分页、16px 卡片内边距)已是库的默认,不用配
   - 密度不放在这里(resolveDefaults 把它拷成标量,不响应):每张表 v-bind="shell.tableProps" 带 defaultDensity
------------------------------------------------------------------- */
const ZH_LABELS = {
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
  filterSimple: '收起高级条件', // 「返回列表」
}
const EN_LABELS = { ...defaultLabels, filterIn: 'IN', filterNotIn: 'NOT IN' }
provide(
  SMART_TABLE_DEFAULTS,
  createSmartTableDefaults({
    align: 'left',
    titleAlign: 'left',
    tag: { size: 'small', bordered: true },
    labels: () => (shell.lang === 'en' ? EN_LABELS : ZH_LABELS),
  }),
)

/* 侧栏「全局设置」4 行(原型 renderSidePanel):[开关名, shell 字段, [值, 文案, 是否原文(不翻)][]] */
type Seg = {
  label: string
  field: 'theme' | 'lang' | 'bg' | 'density'
  items: [string, string, boolean?][]
}
const SEGS: Seg[] = [
  {
    label: '明暗',
    field: 'theme',
    items: [
      ['light', '浅色'],
      ['dark', '深色'],
    ],
  },
  {
    label: '语言',
    field: 'lang',
    items: [
      ['zh', '中文', true],
      ['en', 'English', true],
    ],
  },
  {
    label: '页面底色',
    field: 'bg',
    items: [
      ['gray', '灰'],
      ['white', '白'],
    ],
  },
  {
    label: '密度',
    field: 'density',
    items: [
      ['compact', '紧凑'],
      ['comfortable', '舒适'],
    ],
  },
]
const setShell = (field: Seg['field'], v: string) => ((shell as any)[field] = v)
</script>

<template>
  <n-config-provider
    :theme="naiveTheme"
    :locale="shell.lang === 'en' ? enUS : zhCN"
    :date-locale="shell.lang === 'en' ? dateEnUS : dateZhCN"
    :component-options="COMPONENT_OPTIONS"
    style="display: contents"
  >
    <n-message-provider>
      <n-dialog-provider>
        <div class="app">
          <aside class="side">
            <h1>{{ t('SmartTable 设计方案') }}</h1>
            <p class="sub" id="verLine">v3.0.0 · 2026-10-03</p>
            <div class="group-title">{{ t('设计模块') }}</div>
            <nav id="modList">
              <template v-for="g in groups" :key="g.meta.name">
                <div class="nav-h">{{ navName(g.meta) }}</div>
                <button
                  v-for="m in g.mods"
                  :key="m.key"
                  class="mod"
                  :class="{ on: m.key === mod }"
                  :data-mod="m.no"
                  @click="mod = m.key"
                >
                  <span class="nm">{{ navName(m) }}</span>
                  <span
                    v-if="m.hl"
                    class="hl"
                    :title="shell.isEn ? 'Highlight' : '亮点'"
                    :aria-label="shell.isEn ? 'Highlight' : '亮点'"
                    >★</span
                  >
                  <span v-if="m.status !== 'done'" class="st" :class="m.status">{{
                    t(STATUS_TXT[m.status])
                  }}</span>
                </button>
              </template>
            </nav>
            <div id="grpBar">
              <button
                v-for="g in groups"
                :key="g.meta.name"
                class="mod"
                :class="{ on: curGroup === g }"
                @click="pickGroup(g)"
              >
                <span class="nm">{{ navName(g.meta) }}</span>
              </button>
            </div>
            <div id="modPanel">
              <div class="group-title">{{ t('全局设置') }}</div>
              <div v-for="s in SEGS" :key="s.field" class="shell-row" :data-shell="s.field">
                <span class="sr-l">{{ t(s.label) }}</span>
                <div class="mini">
                  <button
                    v-for="[v, label, raw] in s.items"
                    :key="v"
                    :class="{ on: shell[s.field] === v }"
                    :data-v="v"
                    @click="setShell(s.field, v)"
                  >
                    {{ raw ? label : t(label) }}
                  </button>
                </div>
              </div>
            </div>
          </aside>

          <main class="main">
            <div class="crumb">
              {{
                [t('SmartTable 设计方案'), curGroup && navName(curGroup.meta), navName(cur)]
                  .filter(Boolean)
                  .join(' / ')
              }}
            </div>
            <div class="stage-head" :data-sub="subTabs.length ? '' : undefined">
              <h2>{{ navName(cur) }}</h2>
              <div class="subtabs">
                <button
                  v-for="m in subTabs"
                  :key="m.key"
                  class="subtab"
                  :class="{ on: m.key === mod }"
                  @click="mod = m.key"
                >
                  {{ navName(m) }}
                </button>
              </div>
            </div>
            <div
              id="stage"
              :data-nat="cur.natural ? '' : undefined"
              :data-rowclick="cur.rowClick ? '' : undefined"
            >
              <!-- 原型 .viewport:宿主页面区域 = NLayout 的灰底(embedded)/ 白底,圆角 10px,内边距 22px。暗色下两者官方同色 -->
              <n-layout
                :embedded="shell.bg === 'gray'"
                class="viewport"
                content-style="display:flex;flex-direction:column;height:100%;padding:22px;box-sizing:border-box;"
              >
                <!-- 不用 KeepAlive:原型 enterModule 是「宿主重新挂载表格」(勾选清空、挂载即请求、字典重新计时、storageKey 重读),KeepAlive 会让这些场景失真 -->
                <component :is="cur.comp" :key="mod" v-bind="cur.props" />
              </n-layout>
            </div>
          </main>
        </div>
      </n-dialog-provider>
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
* {
  box-sizing: border-box;
}
html,
body {
  height: 100%;
  overflow: hidden;
}
html {
  color-scheme: light;
}
html[data-theme='dark'] {
  color-scheme: dark;
}
body {
  margin: 0;
  font-family:
    -apple-system, BlinkMacSystemFont, 'SF Pro SC', 'PingFang SC', 'Microsoft YaHei', 'Segoe UI',
    sans-serif;
  font-size: 14px;
  color: var(--px-text);
  background: var(--px-shell-bg);
  -webkit-font-smoothing: antialiased;
}

/* ---------- 骨架(原型 .app / .side / .main,含「页面占满视口」片段) ---------- */
.app {
  line-height: normal;
  display: grid;
  grid-template-columns: 232px 1fr;
  height: 100vh;
  height: 100dvh;
  min-height: 0;
  overflow: hidden;
}
.side {
  background: var(--px-panel-bg);
  border-right: 1px solid var(--px-border);
  padding: 22px 14px 8px; /* 侧栏底部内边距 8(同原型):13 个子页在 1440×900 下刚好放下、不出滚动 */
  position: sticky;
  top: 0;
  height: 100%;
  overflow-y: auto;
}
.side h1 {
  font-size: 15px;
  margin: 0 0 4px;
  letter-spacing: 0.2px;
  font-weight: 700;
}
.side .sub {
  font-size: 11.5px;
  color: var(--px-text-2);
  margin: 0 0 18px;
  line-height: 1.6;
}
.side .group-title {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--px-text-2);
  text-transform: uppercase;
  margin: 16px 0 8px; /* 原型 .side .group-title 末尾覆盖是 16px */
}
.mod {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  text-align: left;
  cursor: pointer;
  border: 1px solid transparent;
  background: transparent;
  color: inherit;
  border-radius: 7px;
  padding: 9px 10px;
  margin-bottom: 3px;
  font-family: inherit;
  font-size: 13px;
  transition: background-color 0.15s;
}
.mod:hover {
  background: var(--px-item-hover);
}
.mod.on {
  background: color-mix(in srgb, var(--px-primary) 10%, transparent);
  border-color: color-mix(in srgb, var(--px-primary) 35%, transparent);
  font-weight: 600;
}
.mod .nm {
  flex: 1 1 auto;
  min-width: 0;
}
.mod .st {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 3px;
  flex: none;
  font-weight: 500;
}
.st.doing {
  background: color-mix(in srgb, var(--px-warn) 16%, transparent);
  color: var(--px-warn);
}
.st.todo {
  background: var(--px-tag-plain);
  color: var(--px-text-2);
}
/* 两级目录(原型 .nav-h / .hl):组名是不可点的小标题;亮点 ★ 用 warn 色、不加底 */
#modList .mod {
  padding: 6px 10px;
  margin-bottom: 1px;
}
.nav-h {
  font-size: 12px;
  font-weight: 600;
  color: var(--px-text);
  margin: 11px 0 3px 10px;
}
.nav-h:first-child {
  margin-top: 0;
}
.mod .hl {
  flex: none;
  font-size: 11px;
  line-height: 1;
  color: var(--px-warn);
}
#grpBar {
  display: none;
}
.mini {
  display: flex;
  gap: 6px;
}
/* 全局设置:每行 = 小标签 + 分段按钮(原型 .shell-row / .sr-l) */
.shell-row {
  margin-bottom: 6px;
}
.shell-row .sr-l {
  display: block;
  font-size: 11px;
  line-height: 1.3;
  color: var(--px-text-2);
  margin: 0 0 3px 2px;
}
.shell-row .mini button {
  padding: 4px 6px;
}
/* 子页签(原型 .subtabs):只在窄档出现(宽档侧栏已列出全部子页);分段控件,无描边,槽底 tag-plain,选中项卡片底 + 主色字 */
.subtabs {
  display: none;
  gap: 2px;
  padding: 2px;
  border-radius: 7px;
  background: var(--px-tag-plain);
  align-self: center;
}
.subtab {
  cursor: pointer;
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
  white-space: nowrap;
  border: 0;
  background: transparent;
  color: var(--px-text-2);
  border-radius: 5px;
  padding: 3px 12px;
  transition:
    background-color 0.15s,
    color 0.15s;
}
.subtab:hover {
  color: var(--px-text);
}
.subtab.on {
  background: var(--px-panel-bg);
  color: var(--px-primary);
}
.mini button {
  flex: 1;
  cursor: pointer;
  font-family: inherit;
  font-size: 12px;
  border: 1px solid var(--px-border-strong);
  background: transparent;
  color: var(--px-text-2);
  border-radius: 5px;
  padding: 5px 8px;
  transition:
    background-color 0.15s,
    border-color 0.15s,
    color 0.15s;
}
.mini button:hover {
  border-color: var(--px-primary);
}
.mini button.on {
  border-color: var(--px-primary);
  color: var(--px-primary);
  background: color-mix(in srgb, var(--px-primary) 10%, transparent);
}

.main {
  padding: 26px 32px 26px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow-y: auto;
}
.main > * {
  flex: none;
}
.crumb {
  font-size: 12px;
  color: var(--px-text-2);
  margin-bottom: 6px;
}
.stage-head {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 6px;
  flex-wrap: wrap;
}
.stage-head h2 {
  margin: 0 0 0;
  font-size: 20px;
  letter-spacing: -0.01em;
  font-weight: 700;
}
#stage {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  margin-top: 18px;
}
/* 原型 .stage-desc 为空时 display:none,.stage-head 下方到 .viewport 的间距只有 stage-head 的 margin-bottom 6px;这里不额外留 18px */
#stage {
  margin-top: 0;
}
.viewport.n-layout {
  flex: 1 1 0;
  min-height: 0;
  border-radius: 10px;
}
.viewport > .n-layout-scroll-container {
  overflow: hidden;
}

/* natural 模块(原型 MC.<key>.natural:模块 10 / 12):整页在主区里滚动、不铺满视口(原型 #stage[data-nat] …) */
#stage[data-nat] {
  flex: none;
}
#stage[data-nat] > .viewport.n-layout {
  flex: none;
}
#stage[data-nat] > .viewport > .n-layout-scroll-container {
  overflow: visible;
}
#stage[data-nat] .smart-table-card {
  scroll-margin-top: 16px;
}
/* rowClick 模块(模块 11):行可点(原型 #stage[data-rowclick] tbody tr[data-no] { cursor: pointer }) */
#stage[data-rowclick] .n-data-table-tbody .n-data-table-tr {
  cursor: pointer;
}

@media (max-width: 860px) {
  .app {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);
  }
  .side {
    position: sticky;
    top: 0;
    z-index: 20;
    height: auto;
    overflow: visible;
    border-right: 0;
    border-bottom: 1px solid var(--px-border);
    padding: 10px 12px;
  }
  .side h1,
  .side .sub,
  .side .group-title,
  #modPanel,
  #modList {
    display: none;
  }
  #grpBar {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    scrollbar-width: none;
  }
  #grpBar::-webkit-scrollbar {
    display: none;
  }
  .mod {
    width: auto;
    flex: none;
    margin-bottom: 0;
    white-space: nowrap;
  }
  .main {
    padding: 0;
  }
  .crumb,
  .stage-head {
    display: none;
  }
  .stage-head[data-sub] {
    display: block;
    margin: 0;
    padding: 10px 12px 0;
  }
  .stage-head[data-sub] h2 {
    display: none;
  }
  .subtabs {
    display: inline-flex;
    max-width: 100%;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .subtabs::-webkit-scrollbar {
    display: none;
  }
  .subtab {
    padding: 5px 14px;
  }
  .viewport.n-layout {
    border-radius: 0;
  }
  .viewport > .n-layout-scroll-container {
    padding: 12px !important;
  }
}
</style>
