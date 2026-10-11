// 模块 15「树形表格」的数据:原型 TREE_ROWS(design.html)逐字移植(改原型时同步这里)。
// 一棵机构树:5 个根(总部 / 华东分公司 / 华南分公司 / 研发院 / 共享服务中心),最深三层;
// 每页 3 个根 → 2 页,用来演示「分页按根行计」(设计 2.17)。
export interface Org {
  id: string
  name: string
  code: string
  owner: string
  heads: number
  status: '启用' | '停用'
  children?: Org[]
}

export const ORGS: Org[] = [
  {
    id: 'HQ',
    name: '总部',
    code: 'HQ',
    owner: '张伟',
    heads: 128,
    status: '启用',
    children: [
      {
        id: 'HQ-PD',
        name: '生产中心',
        code: 'HQ-PD',
        owner: '李强',
        heads: 86,
        status: '启用',
        children: [
          {
            id: 'PD-L1',
            name: '车削一组',
            code: 'PD-L1',
            owner: '王强',
            heads: 24,
            status: '启用',
          },
          {
            id: 'PD-L2',
            name: '车削二组',
            code: 'PD-L2',
            owner: '陈静',
            heads: 22,
            status: '启用',
          },
          {
            id: 'PD-MC',
            name: '加工中心',
            code: 'PD-MC',
            owner: '黄磊',
            heads: 40,
            status: '停用',
          },
        ],
      },
      {
        id: 'HQ-QA',
        name: '质量中心',
        code: 'HQ-QA',
        owner: '赵敏',
        heads: 18,
        status: '启用',
        children: [
          {
            id: 'QA-IQ',
            name: '来料检验组',
            code: 'QA-IQ',
            owner: '孙悦',
            heads: 10,
            status: '启用',
          },
          { id: 'QA-LB', name: '实验室', code: 'QA-LB', owner: '吴磊', heads: 8, status: '启用' },
        ],
      },
      { id: 'HQ-PU', name: '采购部', code: 'HQ-PU', owner: '周杰', heads: 12, status: '启用' },
    ],
  },
  {
    id: 'EC',
    name: '华东分公司',
    code: 'EC',
    owner: '郑浩',
    heads: 64,
    status: '启用',
    children: [
      { id: 'EC-SA', name: '销售部', code: 'EC-SA', owner: '冯雪', heads: 30, status: '启用' },
      {
        id: 'EC-WH',
        name: '仓储部',
        code: 'EC-WH',
        owner: '蒋涛',
        heads: 34,
        status: '启用',
        children: [
          { id: 'WH-1', name: '一号库', code: 'WH-1', owner: '沈洋', heads: 18, status: '启用' },
          { id: 'WH-2', name: '二号库', code: 'WH-2', owner: '韩梅', heads: 16, status: '停用' },
        ],
      },
    ],
  },
  {
    id: 'SC',
    name: '华南分公司',
    code: 'SC',
    owner: '杨帆',
    heads: 41,
    status: '启用',
    children: [
      { id: 'SC-SA', name: '销售部', code: 'SC-SA', owner: '朱琳', heads: 41, status: '启用' },
    ],
  },
  {
    id: 'RD',
    name: '研发院',
    code: 'RD',
    owner: '徐静',
    heads: 52,
    status: '启用',
    children: [
      { id: 'RD-ME', name: '机械设计组', code: 'RD-ME', owner: '何军', heads: 28, status: '启用' },
      { id: 'RD-EE', name: '电气设计组', code: 'RD-EE', owner: '高峰', heads: 24, status: '启用' },
    ],
  },
  { id: 'SS', name: '共享服务中心', code: 'SS', owner: '林芳', heads: 9, status: '停用' },
]

/** 原型每次进入模块都是全新数据(宿主重新挂载表格):深拷贝,改它不影响常量。 */
export const freshOrgs = (): Org[] => JSON.parse(JSON.stringify(ORGS)) as Org[]

/** 每页 3 个根节点(设计 2.17:分页按根行计)。 */
export const ORG_PAGE_SIZE = 3
/** 默认展开「总部」「生产中心」(= default-expanded-row-keys)。 */
export const ORG_DEFAULT_EXPANDED = ['HQ', 'HQ-PD']
