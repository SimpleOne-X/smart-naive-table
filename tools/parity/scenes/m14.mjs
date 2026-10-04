// 模块 14 可编辑表格(工艺路线设计):弹出的编辑浮层 —— 下拉菜单 / 工序库选择面板(select-table)/ 多行文本浮层 / 校验气泡。
// 单元格按「行键|列」定位:td[data-xc="R3|center"](隐藏行键 R1 … R12,列键 name / center / type / setup / unit / report / qc / note / status;工序号是序号列,不在可编辑格里)。
// 第 1 次点击选中、第 2 次进入编辑。窄档抽屉不在这里(interact.mjs 视口固定 1440×900)。
const cell = (key, row = 'R3') => `td[data-xc="${row}|${key}"]`
const edit = (key) =>
  `(() => { const t = document.querySelector('${cell(key)}'); t.scrollIntoView({ block: 'nearest', inline: 'center' }); t.click(); t.click() })()`
export default [
  {
    name: 'm14 下拉(工作中心)',
    mod: 14,
    proto: edit('center'),
    prev: edit('center'),
    pp: '.xl-pop',
    vp: '.n-base-select-menu',
  },
  {
    name: 'm14 工序库面板(工序名称)',
    mod: 14,
    proto: edit('name'),
    prev: edit('name'),
    pp: '.xl-st .st-panel',
    vp: '.smart-table-xpick-pop',
  },
  {
    name: 'm14 多行文本浮层(工艺说明)',
    mod: 14,
    proto: edit('note'),
    prev: edit('note'),
    pp: '.xl-ta',
    vp: '.smart-table-xta',
  },
  {
    name: 'm14 校验气泡(必填清空)',
    mod: 14,
    pre: `(() => { document.querySelector('${cell('name')}').click() })()`,
    proto: `document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true }))`,
    prev: `document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true }))`,
    pp: '.pop.tip',
    vp: '.n-tooltip',
  },
]
