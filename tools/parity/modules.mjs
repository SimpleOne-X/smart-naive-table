// 模块表:每个模块的就绪判据、稳定等待、额外元素 / 列表读数、读数口径提示。parity-all.mjs 与 interact.mjs 共用。
// 编号 → 原型键见 cdp.mjs 的 KEY。要给某个模块加东西,只改下面 MODS 里对应的项。
//
// 每项字段(全部可省,省了用 DEFAULT):
//   ready     { proto, prev }  就绪表达式(页面里求值为真即就绪)。proto 在 enterModule 之后等;prev 在对照页加载后等,超时只警告、读数不可信。
//   settleMs  就绪之后再等多久(让动画 / 异步字典 / 虚拟滚动落定);默认 1500。
//   els       [名字, 原型选择器, 对照页选择器][]:并入元素几何表。与默认表同名则覆盖,否则追加。读不到记 '-'。
//   lists     [名字, 原型选择器, 对照页选择器][]:每项读出「所有可见匹配元素」的 文本 + 矩形(最多 12 个),按下标配对比对。
//             选择器以 'sticky:' 开头 = 只留 computed position 为 sticky 的元素(固定列)。
//   readHints { proto, prev }  读数口径覆盖(两侧各一份,字段全可省):
//             scope   给 thead th / 行 / 分页 / chips 的选择器加的祖先前缀(多表页面用,例如 m12 取主表)
//             rowSel  行选择器(缺省 proto 'tbody tr';对照页 '.n-data-table-tbody tr.n-data-table-tr')
//             thSel   表头单元格选择器(缺省 'thead th')
//             actsCol 操作列的单元格下标(缺省 -1 = 最后一列)
//   note      一句话备注,打印在模块标题下。
//
// 约定 data-parity:对照页同一页面里有多张表时,给每张表的外层包一层 data-parity="main"(主表)/ "sub"(子表,如 m12 入库明细)。
// 原型侧没有这个属性,用各自的类名定位(见下面 m12);对照页没打标记前,m12 的 sub / main 读数全是 '-',属正常。

const ROWS_GT3 = `document.querySelectorAll('.n-data-table-tbody .n-data-table-tr').length > 3`

export const DEFAULT = {
  ready: { proto: 'true', prev: ROWS_GT3 },
  settleMs: 1500,
  els: [],
  lists: [],
  readHints: {},
  note: '',
}

export const MODS = {
  // m5 多级表头 + 固定列:行里可能夹着展开行(单格),读数已自动过滤单格行;固定列看 lists。
  5: {
    lists: [
      // 固定列按类名认:原型固定单元格带 .fx(thead th.fx / tbody td.fx),对照页是官方 n-data-table-th/td--fixed-left|right。
      // (不用 'sticky:thead th':它在原型侧会命中所有 th——表头行本身是 position: sticky 的——两侧长度对不上。)
      [
        'fixed th',
        'thead th.fx',
        'thead th.n-data-table-th--fixed-left, thead th.n-data-table-th--fixed-right',
      ],
      [
        'fixed td',
        'tbody tr:not(.exp-row) td.fx',
        '.n-data-table-tbody .n-data-table-tr td.n-data-table-td--fixed-left, .n-data-table-tbody .n-data-table-tr td.n-data-table-td--fixed-right',
      ],
    ],
    note: '固定列:lists 里 fixed th / fixed td 比较固定列的矩形(按类名选,不再用 sticky 判定);多级表头的 th 数组两侧同序。',
  },
  // m6 异步字典:原型 enterModule 后 setTimeout 900ms 才 dictReady,对照页同口径(字典 0.9s 异步)。
  6: { settleMs: 1900, note: '字典 0.9s 异步,就绪后多等到 1900ms。' },
  // m7 列设置 + storageKey:每次读数前 localStorage 已清,首屏 = 默认列。
  7: {},
  // m8 加载与错误:immediate:false,首屏没有行,默认「行数 > 3」判据会超时 → 就绪 = 出现空状态 .n-empty。
  8: {
    ready: {
      proto: `!!document.querySelector('.n-empty')`,
      prev: `!!document.querySelector('.n-empty')`,
    },
    els: [
      ['empty', '.n-empty', '.n-empty'],
      ['empty icon', '.n-empty__icon', '.n-empty__icon'],
    ],
    note: '首屏不请求:就绪 = 出现 .n-empty(空状态),不是出现行。',
  },
  9: {},
  // m10 行拖拽:自然高度页(整页在主区里滚动),10 行静态数据,默认判据即可;stage 的尺寸用来核对 data-nat 外壳。
  10: {
    els: [['stage', '#stage', '#stage']],
    note: '自然高度页:看 stage 与 docOverflow;表格不铺满视口。',
  },
  // m11 主从联动:左树 + 右表。窄档(< 720 容器)树变 NTreeSelect,树元素读 '-' 属正常。
  11: {
    els: [
      ['md', '.md', '.md'],
      ['md-side', '.md-side', '.md-side'],
      ['tree', '.n-tree', '.n-tree'],
      ['md-main', '.md-main', '.md-main'],
    ],
    lists: [['tree nodes', '.n-tree .tn', '.n-tree .n-tree-node']],
    note: '树 + 表:对照页的树侧栏请带 .md / .md-side / .md-main 类(与原型同名)。',
  },
  // m12 上下布局:原型是一个 .smart-table 里两张卡(上 = 物料单据主表卡,下 = .sub-card 入库明细子表卡);对照页是两个 SmartTable 根,
  // 各包一层 data-parity="main" / "sub"(外层 .m12 竖排两者,间距 16)。整页恒为一屏:主表 fillHeight + 虚拟滚动吃剩余高度,子表自然高度、封顶。
  // 主表的读数(th / 行 / 分页 / chips / 按钮)用 scope 限定到主表;子表的几何与按钮在 els / lists 里单列。
  12: {
    ready: {
      proto: 'true',
      prev: `document.querySelectorAll('[data-parity="main"] .n-data-table-tbody .n-data-table-tr').length > 3 && document.querySelectorAll('[data-parity="sub"] .n-data-table-tbody .n-data-table-tr').length > 1`,
    },
    readHints: {
      proto: { scope: '.smart-table > .n-card:not(.sub-card)' },
      prev: { scope: '[data-parity="main"]' },
    },
    els: [
      ['stage', '#stage', '#stage'],
      // 整页的竖排容器:原型的 .smart-table(两张卡的父级)↔ 对照页的 .m12(包住两个 SmartTable 根)
      ['root', '.smart-table', '.m12'],
      ['sub card', '.sub-card', '[data-parity="sub"] .smart-table-card'],
      ['sub title', '.sub-card .card-title', '[data-parity="sub"] .smart-table-title'],
      ['sub table', '.sub-card .dt', '[data-parity="sub"] .n-data-table'],
      ['sub thead', '.sub-card thead', '[data-parity="sub"] .n-data-table-thead'],
      [
        'sub row0',
        '.sub-card tbody tr',
        '[data-parity="sub"] .n-data-table-tbody .n-data-table-tr',
      ],
      ['sub sum row', '.sub-card .sum-row', '[data-parity="sub"] .n-data-table-tr--summary'],
      // 主表覆盖默认表里「取第一个可见」会落到子表的那几项
      [
        'table card',
        '.smart-table > .n-card:not(.search-card):not(.sub-card)',
        '[data-parity="main"] .smart-table-card',
      ],
      [
        'toolbar',
        '.smart-table > .n-card:not(.sub-card) .tb',
        '[data-parity="main"] .smart-table-toolbar',
      ],
      // 工具栏里的几块也限定到主表(窄档主表卡片态没有 tb-actions,不限定会落到子表工具栏的「添加物料」上)
      [
        'title',
        '.smart-table > .n-card:not(.sub-card) .st-title',
        '[data-parity="main"] .smart-table-title',
      ],
      [
        'tb-actions',
        '.smart-table > .n-card:not(.sub-card) .tb-actions',
        '[data-parity="main"] .smart-table-toolbar-actions',
      ],
      [
        'tb-icons',
        '.smart-table > .n-card:not(.sub-card) .tb-icons',
        '[data-parity="main"] .smart-table-toolbar-icons',
      ],
      [
        'data table',
        '.smart-table > .n-card:not(.sub-card) .dt',
        '[data-parity="main"] .n-data-table',
      ],
      [
        'thead',
        '.smart-table > .n-card:not(.sub-card) thead',
        '[data-parity="main"] .n-data-table-thead',
      ],
      [
        'pagination',
        '.smart-table > .n-card:not(.sub-card) .n-pagination',
        '[data-parity="main"] .n-pagination',
      ],
      [
        'bottom row',
        '.smart-table > .n-card:not(.sub-card) .dt-foot',
        '[data-parity="main"] .n-data-table__pagination, [data-parity="main"] .smart-table-chips-foot',
      ],
    ],
    lists: [
      // 子表的按钮(parity-all 的 btns 已用 scope 限定到主表;子表右上的「添加物料」和每行「移除」在这里比)
      [
        'sub btns',
        '.sub-card .card-hd button, .sub-card tbody button',
        '[data-parity="sub"] .smart-table-toolbar button, [data-parity="sub"] .n-data-table-tbody button',
      ],
      // 子表表头各格
      ['sub th', '.sub-card thead th', '[data-parity="sub"] .n-data-table-thead th'],
    ],
    note: '上下布局:main = 上方物料单据大表,sub = 下方入库明细子表;对照页用 data-parity="main|sub" 区分(见 README),root = 整页竖排容器(原型 .smart-table ↔ 对照页 .m12)。主表读数(th / 行 / btns / 分页)限定在主表;子表见 sub * 与 list:sub btns / sub th。',
  },
  13: {},
  // m14 可编辑表格(提议):工艺路线 12 行(静态直出),默认判据(行 > 3)即可;可编辑格 / 手柄格(只读的 render 列)/ 复选框格的几何用 els 比(原型 td.xc / td.rd-h / td.xk-ck,对照页 td.smart-table-xc / -xro / -xk-ck)。
  // 没有操作列:cell0 / acts 默认读「最后一列」(状态),两侧口径一致。交互态(选中 / 编辑 / 保存 N / 校验 / 工序库面板)的几何见 scenes/m14.mjs。
  14: {
    els: [
      [
        'xl editable td',
        'tbody td.xc:not(.xk-ck)',
        '.n-data-table-tbody td.smart-table-xc:not(.smart-table-xk-ck)',
      ],
      ['xl handle td', 'tbody td.rd-h', '.n-data-table-tbody td.smart-table-xro'],
      ['xl checkbox td', 'tbody td.xk-ck', '.n-data-table-tbody td.smart-table-xk-ck'],
      [
        'xl checkbox',
        'tbody td.xk-ck .n-check',
        '.n-data-table-tbody td.smart-table-xk-ck .n-checkbox',
      ],
    ],
    note: '可编辑表格:没有操作列(cell0 / acts 读最后一列「状态」);选中 / 编辑 / 校验等交互态看 interact.mjs 的 m14 场景。',
  },
}

/** 取某模块的完整配置(MODS 项覆盖 DEFAULT;ready 逐字段合并) */
export function modCfg(no) {
  const m = MODS[no] ?? {}
  return {
    ...DEFAULT,
    ...m,
    ready: { ...DEFAULT.ready, ...(m.ready ?? {}) },
    readHints: { proto: {}, prev: {}, ...(m.readHints ?? {}) },
  }
}
