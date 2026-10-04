// 模块 6(字典、标签与格式化)的交互场景:列设置(创建人初始隐藏)/ 条件构造器里的字典下拉。
export default [
  {
    name: 'm6 列设置',
    mod: 6,
    proto: `document.querySelector('[data-act="cols"]').click()`,
    prev: `document.querySelector('.smart-table-toolbar button[aria-label="列设置"]').click()`,
    pp: '.colset-pop',
    vp: '.n-popover:has(.smart-table-colset)',
  },
]
