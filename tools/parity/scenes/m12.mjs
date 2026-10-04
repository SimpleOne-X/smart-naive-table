// 模块 12 嵌入式表格:「选择物料」弹窗(宽档 720 居中弹窗)。弹层根 = 原型 .modal-card / 对照页 NModal 的 card。
export default [
  {
    name: 'm12 选择物料弹窗',
    mod: 12,
    proto: `document.querySelector('[data-act="pickOpen"]').click()`,
    prev: `[...document.querySelectorAll('[data-parity="sub"] button')].find(b => b.innerText.includes('添加物料')).click()`,
    pp: '.modal-card',
    vp: '.n-modal.n-card',
  },
  {
    name: 'm12 选择物料弹窗 勾选两行',
    mod: 12,
    proto: `document.querySelector('[data-act="pickOpen"]').click(); setTimeout(() => { document.querySelectorAll('.modal-card tbody [data-act="pickTog"]').forEach((e, i) => i < 2 && e.click()) }, 150)`,
    prev: `[...document.querySelectorAll('[data-parity="sub"] button')].find(b => b.innerText.includes('添加物料')).click(); setTimeout(() => { document.querySelectorAll('.n-modal .n-data-table-tbody .n-checkbox').forEach((e, i) => i < 2 && e.click()) }, 500)`,
    pp: '.modal-card',
    vp: '.n-modal.n-card',
    settleMs: 1800,
  },
]
