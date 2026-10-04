// 模块 11 主从联动:点行 → 右侧详情抽屉(原型 .drawer ↔ 官方 NDrawer)。
export default [
  {
    name: 'm11 详情抽屉',
    mod: 11,
    proto: `document.querySelectorAll('#preview tbody tr[data-no]')[1].children[3].click()`,
    prev: `document.querySelectorAll('.n-data-table-tbody .n-data-table-tr')[1].children[3].click()`,
    pp: '.drawer',
    vp: '.n-drawer',
    settleMs: 1500,
  },
]
