// 模块 5(多级表头与固定列)的交互场景:展开行 / 列设置(固定列按钮)/ 批量栏。
export default [
  {
    name: 'm5 展开行',
    mod: 5,
    proto: `document.querySelector('tbody tr [data-act="exToggle"]').click()`,
    prev: `document.querySelector('.n-data-table-tbody .n-data-table-expand-trigger').click()`,
    pp: '.exp-in',
    vp: '.m5-exp',
  },
  {
    name: 'm5 列设置',
    mod: 5,
    proto: `document.querySelector('[data-act="cols"]').click()`,
    prev: `document.querySelector('.smart-table-toolbar button[aria-label="列设置"]').click()`,
    pp: '.colset-pop',
    vp: '.n-popover:has(.smart-table-colset)',
  },
  {
    name: 'm5 批量栏',
    mod: 5,
    proto: `document.querySelector('tbody tr td.ck [data-act="toggleRow"]').click()`,
    prev: `document.querySelector('.n-data-table-tbody .n-data-table-td .n-checkbox').click()`,
    pp: '.tb-batch',
    vp: '.smart-table-batch',
  },
  {
    name: 'm5 合计行',
    mod: 5,
    proto: `document.querySelector('.tbl-scroll').scrollTop = 1e6`,
    prev: `document.querySelector('.n-data-table-base-table-body .n-scrollbar-container').scrollTop = 1e6`,
    pp: 'tr.sum-row',
    vp: '.n-data-table-tr--summary',
  },
]
