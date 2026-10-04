<script setup lang="ts">
// 模块 11「主从联动」(key ms):左侧部门树(官方 NTree)+ 右侧物料单据表(真实 SmartTable)+ 点行开详情抽屉(官方 NDrawer + NDescriptions)。
// 库的部分:`:params`(树选中 → 联动参数,变了回第 1 页重查)、`active-row-key` 行高亮、`@row-click`(忽略行内按钮 / 勾选 / 链接上的点击)。
// 宿主的部分:树 / 抽屉 / 窄档的下拉树(< 720 容器宽:NTreeSelect)。布局类名沿用原型 md / md-side / md-main(tools/parity 按这些类名读数)。
// 宽(≥ 1280)树 240 · 中树 200 · 窄(< 720)树退成表格上方的「部门」下拉;抽屉 < 600 变底部抽屉。
import { computed, h, ref } from 'vue'
import {
  NButton,
  NCard,
  NDescriptions,
  NDescriptionsItem,
  NDrawer,
  NDrawerContent,
  NTag,
  NTree,
  NTreeSelect,
  useThemeVars,
  type TreeOption,
} from 'naive-ui'
import { SmartTable } from '../../../src/index'
import { DATA, type Row } from '../data'
import { useMaterialPage } from '../data/m7-materialPage'
import { MS_EXPANDED, MS_TREE, msCount, msParams, type MsNode } from '../data/m11-tree'
import { fetchRows } from '../fetcher'
import { registerDict } from '../i18n'
import CrudModal from './shared/CrudModal.vue'
import { statusOptions } from './shared/options'
import { ProtoAddButton, protoToolbar } from './shared/toolbar'
import { useTier } from './shared/useTier'

registerDict([
  ['全部部门', 'All departments'],
  ['物料详情', 'Material details'],
  ['部门', 'Department'],
])

const crudRef = ref<InstanceType<typeof CrudModal> | null>(null)
const { el, width, tier } = useTier()
const themeVars = useThemeVars()
const {
  t,
  tableProps,
  tableRef,
  checked,
  columns,
  fetcher,
  more,
  onMore,
  onBatchApprove,
  onBatchDelete,
} = useMaterialPage({
  fetcher: fetchRows,
  onEdit: (row) => crudRef.value?.openEdit(row),
})

/* ---- 树:选中 + 展开 ---- */
const sel = ref('all')
const expanded = ref<string[]>([...MS_EXPANDED])
const params = computed(() => msParams(sel.value))
const treeData = computed<TreeOption[]>(() => {
  const conv = (n: MsNode): TreeOption => ({
    key: n.key,
    label: t(n.label ?? n.key),
    count: msCount(n),
    children: n.children?.map(conv),
  })
  return MS_TREE.map(conv)
})
/* 原型树节点 = 内容 30px + 包装上下各 3px(行距 36);官方 NTree 的 nodeHeight 30px 是含包装的总高(内容 24、行距 30),所以这里 nodeHeight 调成 36px 对齐原型 */
/* 原型 msLayout:容器 < 720 窄(树变下拉)、< 1280 中、其余宽;首帧还没量到宽度(0)按宽档,避免闪一下 */
const lay = computed<'narrow' | 'mid' | 'wide'>(() =>
  width.value === 0 ? 'wide' : width.value < 720 ? 'narrow' : width.value < 1280 ? 'mid' : 'wide',
)

/* 切换部门:清掉行高亮与抽屉(原型 tnSel),表格由 params 变化自动回第 1 页重查 */
function onSelect(keys: Array<string | number>) {
  if (!keys.length) return // 官方 NTree 点已选中节点会取消选中;原型是恒选一个
  sel.value = String(keys[0])
  active.value = null
  showDrawer.value = false
}
/* 原型箭头 = 14px 向右 chevron(展开时官方 CSS 转 90°);官方默认是实心三角,这里用 render-switcher-icon 换成原型的形状 */
const renderSwitcherIcon = () =>
  h(
    'svg',
    { viewBox: '0 0 16 16', width: 14, height: 14, fill: 'currentColor', style: 'display:block' },
    [
      h('path', {
        d: 'M5.64645 3.14645C5.45118 3.34171 5.45118 3.65829 5.64645 3.85355L9.79289 8L5.64645 12.1464C5.45118 12.3417 5.45118 12.6583 5.64645 12.8536C5.84171 13.0488 6.15829 13.0488 6.35355 12.8536L10.8536 8.35355C11.0488 8.15829 11.0488 7.84171 10.8536 7.64645L6.35355 3.14645C6.15829 2.95118 5.84171 2.95118 5.64645 3.14645Z',
      }),
    ],
  )
const renderSuffix = ({ option }: { option: TreeOption }) =>
  h('span', { class: 'tn-cnt' }, String(option.count))

/* ---- 行点击 → 高亮 + 详情抽屉 ---- */
const active = ref<string | null>(null)
const showDrawer = ref(false)
const detail = ref<Row | null>(null)
function onRowClick(row: Row) {
  active.value = row.no
  detail.value = DATA.find((r) => r.no === row.no) ?? row
  showDrawer.value = true
}
const statusOpt = computed(() => statusOptions(t))
const tagTypeOf = (v: string) => statusOpt.value.find((o) => o.value === v)?.tagType ?? 'default'
const money = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
function editFromDrawer() {
  const r = detail.value
  showDrawer.value = false
  if (r) crudRef.value?.openEdit(r)
}

function onSaved(p: { mode: 'create' | 'edit'; orig: string | null; no: string }) {
  if (p.mode === 'edit') checked.value = checked.value.map((k) => (k === p.orig ? p.no : k))
  if (p.mode === 'edit' && active.value === p.orig) active.value = p.no
  void (p.mode === 'create' ? tableRef.value?.search() : tableRef.value?.refresh())
}
</script>

<template>
  <div ref="el" class="proto-host">
    <div class="md" :data-t="lay">
      <n-card v-if="lay === 'narrow'" size="small" class="md-pick" content-class="md-pick-ct">
        <span class="lab">{{ t('部门') }}</span>
        <n-tree-select
          :value="sel"
          :options="treeData"
          :default-expanded-keys="MS_EXPANDED"
          @update:value="(v: string | null) => v && onSelect([v])"
        />
      </n-card>
      <n-card v-else size="small" class="md-side" content-class="md-side-ct">
        <div class="md-title">{{ t('部门') }}</div>
        <n-tree
          v-model:expanded-keys="expanded"
          :data="treeData"
          :selected-keys="[sel]"
          :cancelable="false"
          block-line
          selectable
          :render-suffix="renderSuffix"
          :render-switcher-icon="renderSwitcherIcon"
          :theme-overrides="{ nodeHeight: '36px' }"
          @update:selected-keys="onSelect"
        />
      </n-card>
      <div class="md-main">
        <SmartTable
          ref="tableRef"
          v-bind="tableProps"
          card-on-narrow
          v-model:checked-row-keys="checked"
          :columns="columns"
          :fetcher="fetcher"
          :params="params"
          row-key="no"
          :title="t('物料单据')"
          :search="{ container: 'table' }"
          :toolbar="protoToolbar({ more })"
          :pagination="{ pageSizes: [50, 100] }"
          :active-row-key="active"
          fill-height
          resizable
          @more-select="onMore"
          @row-click="onRowClick"
        >
          <template #toolbar-right
            ><ProtoAddButton :label="t('新增')" @click="crudRef?.openCreate()"
          /></template>
          <template #batch="{ checkedRowKeys, clear }">
            <n-button @click="onBatchApprove(checkedRowKeys, clear)">{{ t('批量审核') }}</n-button>
            <n-button
              :text-color="themeVars.errorColor"
              aria-haspopup="dialog"
              @click="onBatchDelete(checkedRowKeys, clear)"
              >{{ t('批量删除') }}</n-button
            >
          </template>
          <template #pagination-prefix="info">{{ t(`共 ${info.itemCount} 条`) }}</template>
        </SmartTable>
      </div>
    </div>

    <!-- 详情抽屉(原型 drawerHtml):宽 / 中档右侧 400px;窄档(< 600)底部抽屉。NDescriptions bordered · small · 左置 label · 1 列 -->
    <n-drawer
      v-model:show="showDrawer"
      :placement="tier === 'narrow' ? 'bottom' : 'right'"
      :width="tier === 'narrow' ? undefined : 400"
      :height="tier === 'narrow' ? 'auto' : undefined"
      :style="tier === 'narrow' ? 'max-height: 85vh' : 'max-width: 100vw'"
    >
      <n-drawer-content
        class="proto-m11-drawer"
        :title="t('物料详情')"
        closable
        :native-scrollbar="true"
      >
        <n-descriptions
          v-if="detail"
          bordered
          size="small"
          label-placement="left"
          :column="1"
          :label-style="{ width: '108px' }"
        >
          <n-descriptions-item :label="t('物料编码')">{{ detail.no }}</n-descriptions-item>
          <n-descriptions-item :label="t('物料名称')">{{ detail.name }}</n-descriptions-item>
          <n-descriptions-item :label="t('负责人')">{{ detail.owner }}</n-descriptions-item>
          <n-descriptions-item :label="t('单据状态')">
            <n-tag size="small" :type="tagTypeOf(detail.status)">{{ t(detail.status) }}</n-tag>
          </n-descriptions-item>
          <n-descriptions-item :label="t('部门')">{{ t(detail.dept) }}</n-descriptions-item>
          <n-descriptions-item :label="t('金额')">{{ money(detail.amount) }}</n-descriptions-item>
          <n-descriptions-item :label="t('单据日期')">{{ detail.bizDate }}</n-descriptions-item>
          <n-descriptions-item :label="t('备注')">{{ detail.memo || '—' }}</n-descriptions-item>
        </n-descriptions>
        <template #footer>
          <div class="dw-foot">
            <n-button @click="showDrawer = false">{{ t('关闭') }}</n-button>
            <n-button type="primary" @click="editFromDrawer">{{ t('编辑') }}</n-button>
          </div>
        </template>
      </n-drawer-content>
    </n-drawer>
    <CrudModal ref="crudRef" :narrow="tier === 'narrow'" @success="onSaved" />
  </div>
</template>

<style scoped>
.proto-host {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
/* 原型 .md 系列(design.html 模块 11 样式) */
.md {
  display: flex;
  gap: 16px;
  flex: 1 1 0;
  min-height: 0;
  align-items: stretch;
}
.md[data-t='narrow'] {
  flex-direction: column;
  gap: 12px;
}
.md-side {
  flex: none;
  width: 240px;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.md[data-t='mid'] .md-side {
  width: 200px;
}
.md-side :deep(.md-side-ct) {
  padding: 16px 12px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: auto;
  flex: 1 1 auto;
}
.md-title {
  font-size: 14px;
  font-weight: 500;
  color: v-bind('themeVars.textColor1');
  padding: 0 4px 8px;
  line-height: normal;
}
.md-main {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.md-main > :deep(.smart-table) {
  flex: 1 1 0;
  min-height: 0;
}
.md[data-t='narrow'] .md-main {
  flex: 1 1 0;
}
.md-pick {
  flex: none;
}
.md-pick :deep(.md-pick-ct) {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
}
.md-pick .lab {
  flex: none;
  font-size: 14px;
  color: v-bind('themeVars.textColor2');
}
.md-pick :deep(.n-tree-select) {
  flex: 1 1 auto;
  min-width: 0;
}
/* 树节点计数:12px、textColor3、等宽数字(原型 .tn-cnt) */
.md-side :deep(.tn-cnt) {
  flex: none;
  font-size: 12px;
  color: v-bind('themeVars.textColor3');
  font-variant-numeric: tabular-nums;
}
.dw-foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  width: 100%;
}
</style>

<!-- 抽屉被传送到 body,scoped 够不着:底部抽屉(height: auto)下官方 .n-drawer-body 的 flex:1 + overflow:hidden 会塌成 0,改成按内容撑开 -->
<style>
.n-drawer .n-drawer-content.proto-m11-drawer .n-drawer-body {
  flex: 0 0 auto;
  overflow: visible;
}
</style>
