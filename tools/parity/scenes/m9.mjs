// 模块 9 增删改弹窗:新增弹窗 / 提交空表单(必填校验) / 编辑弹窗(原型 .modal-card ↔ 对照页 NModal 的 .n-card)。
const ADD_PREV = `[...document.querySelectorAll('.smart-table-toolbar button')].find(b => b.innerText.trim() === '新增').click()`
const EDIT_PREV = `[...document.querySelectorAll('.n-data-table-tbody .n-data-table-tr:first-child button')].find(b => b.innerText.trim() === '编辑').click()`
const SAVE_PREV = `[...document.querySelectorAll('.n-modal.n-card button')].find(b => b.innerText.trim() === '保存').click()`
export default [
  {
    name: 'm9 新增弹窗',
    mod: 9,
    proto: `document.querySelector('[data-act="add"]').click()`,
    prev: ADD_PREV,
    pp: '.modal-card',
    vp: '.n-modal.n-card',
  },
  {
    name: 'm9 必填校验',
    mod: 9,
    pre: { proto: `document.querySelector('[data-act="add"]').click()`, prev: ADD_PREV },
    proto: `document.querySelector('[data-act="crudSave"]').click()`,
    prev: SAVE_PREV,
    pp: '.modal-card',
    vp: '.n-modal.n-card',
  },
  {
    name: 'm9 编辑弹窗',
    mod: 9,
    proto: `document.querySelector('[data-act="edit"]').click()`,
    prev: EDIT_PREV,
    pp: '.modal-card',
    vp: '.n-modal.n-card',
  },
]
