// 模块 7 / 8 / 9 共用的「物料单据」整页胶水:列(materialCols + 选择列 / 序号 / 操作列)、工具栏「更多」、批量审核 / 批量删除、行删除、导出。
// 三个模块的区别只有:后端(fetcher)、storageKey、immediate、新增 / 编辑怎么处理,其余与原型模块 2 同一张表。
// 必须在 setup 里调用(用到 useDialog / useProtoTable)。
import { computed, h, ref } from 'vue'
import { NButton, NPopconfirm, NSpace, useDialog } from 'naive-ui'
import type {
  SmartTableColumn,
  SmartTableInst,
  SmartTableParams,
  SmartTableFetcher,
} from '../../../src/index'
import { CSV_HEAD, approveRows, delRow, delRows, rowsToCsv, type Row } from '../data'
import { queryRows } from '../fetcher'
import { materialCols } from '../modules/shared/materialCols'
import { ACT_BTN, downloadCsv, moreOptions } from '../modules/shared/toolbar'
import { useProtoTable } from '../modules/shared/useProtoTable'

export interface MaterialPageOpts {
  fetcher: SmartTableFetcher<Row>
  /** 点「编辑」(m9 打开弹窗);不传 = 点编辑无反应。 */
  onEdit?: (row: Row) => void
}

/** 原型操作列文字按钮 22px 高(官方 text 按钮是行内 auto 高,14px) */

export function useMaterialPage(opts: MaterialPageOpts) {
  const { shell, t, tableProps, toast, message } = useProtoTable()
  const dialog = useDialog()
  const tableRef = ref<SmartTableInst<Row> | null>(null)
  const checked = ref<Array<string | number>>([])

  async function onDel(no: string) {
    if (delRow(no)) {
      checked.value = checked.value.filter((k) => k !== no)
      await tableRef.value?.refresh()
      toast(`已删除 ${no}`)
    }
  }

  /* 删除:行内「删除」先弹 NPopconfirm(文案「确认删除该行?」),点「确认」才真删 */
  const rowActions = (row: Row) =>
    h(NSpace, { size: 12, wrapItem: false }, () => [
      h(NButton, { text: true, style: ACT_BTN, onClick: () => opts.onEdit?.(row) }, () =>
        t('编辑'),
      ),
      h(
        NPopconfirm,
        {
          onPositiveClick: () => void onDel(row.no),
          positiveText: t('确认'),
          negativeText: t('取消'),
        },
        {
          trigger: () => h(NButton, { text: true, type: 'error', style: ACT_BTN }, () => t('删除')),
          default: () => t('确认删除该行?'),
        },
      ),
    ])

  const columns = computed<SmartTableColumn<Row>[]>(() =>
    materialCols({ t, selection: true, index: true, memo: true, actions: rowActions }),
  )

  /* 记下最近一次请求的参数:「导出」= 后端按当前生效的条件导出全部行(不是当前页) */
  let lastParams: Partial<SmartTableParams> = {}
  const fetcher: SmartTableFetcher<Row> = (p) => {
    lastParams = p
    return opts.fetcher(p)
  }

  const more = computed(() => moreOptions(t))
  function importCsv() {
    const inp = document.createElement('input')
    inp.type = 'file'
    inp.accept = '.csv,text/csv'
    inp.onchange = () => {
      const f = inp.files?.[0]
      if (!f) return
      void f
        .text()
        .then((txt) =>
          toast(
            `已导入 ${f.name}:${Math.max(0, txt.replace(/^﻿/, '').split(/\r?\n/).filter(Boolean).length - 1)} 条`,
          ),
        )
    }
    inp.click()
  }
  function onMore(key: string | number) {
    if (key === 'export') {
      const rows = queryRows(lastParams)
      downloadCsv('物料单据.csv', rowsToCsv(rows))
      toast(`已导出 ${rows.length} 条`)
    } else if (key === 'import') importCsv()
    else if (key === 'tpl') {
      downloadCsv('物料导入模板.csv', CSV_HEAD.join(','))
      toast('已下载导入模板')
    }
  }

  async function onBatchApprove(keys: Array<string | number>, clear: () => void) {
    const n = approveRows(keys.map(String))
    clear()
    await tableRef.value?.refresh()
    toast(n ? `已审核 ${n} 项` : `所选 ${keys.length} 项无需审核`)
  }
  function onBatchDelete(keys: Array<string | number>, clear: () => void) {
    dialog.warning({
      title: t('确认删除'),
      content: t(`确定删除所选 ${keys.length} 项吗?`),
      positiveText: t('确认'),
      negativeText: t('取消'),
      onPositiveClick: async () => {
        const n = delRows(keys.map(String))
        clear()
        await tableRef.value?.refresh()
        toast(`已删除 ${n} 项`, 'success')
      },
    })
  }

  return {
    shell,
    t,
    tableProps,
    toast,
    message,
    tableRef,
    checked,
    columns,
    fetcher,
    more,
    onMore,
    onBatchApprove,
    onBatchDelete,
    onDel,
  }
}
