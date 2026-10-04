// 模块 13 多语言:表头过滤与列设置沿用 m2/m3 的场景;这里只补本模块特有的「备注」列(长文案列宽 128)——
// 点工具栏「更多」,弹层读数与 m2 同源,确认 m13 的工具栏位置一致。
export default [
  {
    name: 'm13 列设置',
    mod: 13,
    proto: `document.querySelector('[data-act="cols"]').click()`,
    prev: `document.querySelector('.smart-table-toolbar button[aria-label="列设置"]').click()`,
    pp: '.colset-pop',
    vp: '.n-popover:has(.smart-table-colset)',
  },
]
