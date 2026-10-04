// 模块 7 列设置:点开列设置气泡(同 m2 列设置,多了 storageKey;面板本体是库的 ColumnSettings)。
export default [
  {
    name: 'm7 列设置',
    mod: 7,
    proto: `document.querySelector('[data-act="cols"]').click()`,
    prev: `document.querySelector('.smart-table-toolbar button[aria-label="列设置"]').click()`,
    pp: '.colset-pop',
    vp: '.n-popover:has(.smart-table-colset)',
  },
]
