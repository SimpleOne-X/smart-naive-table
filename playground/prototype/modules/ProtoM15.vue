<script setup lang="ts">
// 模块 15「树形表格」(key tree):用真实库的 children-key(默认 children)+ cardOnNarrow 复刻原型 treePageHtml(设计 2.17)。
// 原型:无工具栏、无搜索;一棵机构树(5 个根,每页 3 个根 → 2 页),默认展开「总部」「生产中心」;勾选带 cascade(半选);
// 宽 / 中档是官方 NDataTable 的树形态(箭头 / 缩进由官方画),窄档是库的卡片(先序拍平、只缩进标题、44×44 的展开箭头)。
// 没有新增属性:default-expanded-row-keys / children-key / cascade 都是透传给 NDataTable 的官方属性,库在卡片模式里也认它们。
import { ref } from 'vue'
import { SmartTable, type SmartTableColumn } from '../../../src/index'
import { ORG_DEFAULT_EXPANDED, ORG_PAGE_SIZE, freshOrgs, type Org } from '../data/m15-orgs'
import { registerDict } from '../i18n'
import { useProtoTable } from './shared/useProtoTable'

registerDict([
  ['机构名称', 'Organization'],
  ['机构编码', 'Code'],
  ['人数', 'Headcount'],
  ['状态', 'Status'],
  ['启用', 'Enabled'],
  ['停用', 'Disabled'],
  ['总部', 'Headquarters'],
  ['生产中心', 'Production'],
  ['车削一组', 'Turning 1'],
  ['车削二组', 'Turning 2'],
  ['加工中心', 'Machining'],
  ['质量中心', 'Quality'],
  ['来料检验组', 'Incoming QC'],
  ['实验室', 'Lab'],
  ['华东分公司', 'East China'],
  ['销售部', 'Sales'],
  ['一号库', 'Warehouse 1'],
  ['二号库', 'Warehouse 2'],
  ['华南分公司', 'South China'],
  ['研发院', 'R&D Institute'],
  ['机械设计组', 'Mechanical design'],
  ['电气设计组', 'Electrical design'],
  ['共享服务中心', 'Shared services'],
])

const { t, tableProps } = useProtoTable()
const orgs = ref<Org[]>(freshOrgs())
const checked = ref<Array<string | number>>([])

const columns: SmartTableColumn<Org>[] = [
  { type: 'selection' } as SmartTableColumn<Org>,
  // 名称列:官方树形态的箭头 / 缩进画在第一个有内容的列里;窄档卡片的标题 = 这一列
  {
    key: 'name',
    title: () => t('机构名称'),
    minWidth: 200,
    card: 'title',
    render: (row: Org) => t(row.name),
  } as SmartTableColumn<Org>,
  { key: 'code', title: () => t('机构编码'), width: 140 },
  { key: 'owner', title: () => t('负责人'), width: 120 },
  { key: 'heads', title: () => t('人数'), width: 100, align: 'right' },
  {
    key: 'status',
    title: () => t('状态'),
    width: 100,
    options: [
      { label: () => t('启用'), value: '启用', tagType: 'success' },
      { label: () => t('停用'), value: '停用', tagType: 'default' },
    ],
    tag: true,
  },
]
</script>

<template>
  <div class="proto-host">
    <SmartTable
      v-bind="tableProps"
      v-model:checked-row-keys="checked"
      card-on-narrow
      :columns="columns"
      :data="orgs"
      row-key="id"
      :toolbar="false"
      :search="false"
      :pagination="{ pageSize: ORG_PAGE_SIZE, showSizePicker: false }"
      :default-expanded-row-keys="ORG_DEFAULT_EXPANDED"
    >
      <template #pagination-prefix="info">{{ t(`共 ${info.itemCount} 条`) }}</template>
    </SmartTable>
  </div>
</template>

<style scoped>
/* 自然高度页(registry natural:整页在主区里滚动):不铺满,卡片随内容撑高(同模块 10) */
.proto-host {
  flex: none;
  display: flex;
  flex-direction: column;
}
</style>
