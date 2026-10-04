// 模块 6 的列声明(原型 DICT_UNITS):ProtoM6.vue 与单测共用(单测在 jsdom 里不开 fillHeight 的虚拟滚动,直接拿同一份列去挂 SmartTable)。
// 同一批行,状态 / 部门存的是编码:单据状态 = options + tag(语义色徽标);部门 = 异步字典(进入后 900ms 才回来,之前显示原始值);
// 金额 format 'money';单据日期 format 'date'(时间戳输入);创建时间 format 'datetime'(ISO 串输入);距今 = format 函数;备注 null → emptyText「—」;
// 创建人 hide: true(初始隐藏,列设置里可勾回)。无勾选列、无操作列。
import type { SmartTableColumn, SmartTableOption } from '../../../src/index'
import { delay } from '../backends/memory'
import { TODAY } from '../data'
import { MOCK_DELAY } from '../fetcher'
import { OPS_BY_TYPE as ACT } from '../modules/shared/ops'
import { DICT_DEPT, DICT_STATUS, type DictRow } from './m6-dict'
import { DAY_MS, dayTs } from './rand'

type T = (zh: string) => string

/** 部门字典:异步函数(库内置 loading 与在途去重),原型 900ms 后 dictReady;MOCK_DELAY.ms = 0(单测)时不等。 */
export const deptDict = (t: T) => async (): Promise<SmartTableOption[]> => {
  await delay(MOCK_DELAY.ms > 0 ? 900 : 0)
  return DICT_DEPT.map((o) => ({ label: () => t(o.label), value: o.value }))
}
export const statusDict = (t: T): SmartTableOption[] =>
  DICT_STATUS.map((o) => ({ label: () => t(o.label), value: o.value, tagType: o.tagType }))

/** 「距今」:format 函数形式(原型:今天 / N 天前)。 */
export const agoText = (t: T) => (_v: unknown, row: DictRow) => {
  const n = Math.round((dayTs(TODAY) - row.bizTs) / DAY_MS)
  return n <= 0 ? t('今天') : t(`${n} 天前`)
}

/* 字典按 t 缓存:列声明随语言重算(placeholder 是静态串)时不能换掉异步字典函数,否则库会当成新字典重新请求(部门列闪回原始编码) */
const dictsOf = new WeakMap<
  T,
  { status: SmartTableOption[]; dept: () => Promise<SmartTableOption[]> }
>()
const dicts = (t: T) => {
  let d = dictsOf.get(t)
  if (!d) dictsOf.set(t, (d = { status: statusDict(t), dept: deptDict(t) }))
  return d
}

export const dictColumns = (t: T): SmartTableColumn<DictRow>[] => [
  { type: 'index', title: () => t('序号'), width: 64 } as SmartTableColumn<DictRow>,
  {
    key: 'no',
    title: () => t('物料编码'),
    width: 112,
    card: 'title',
    search: { actions: ACT.text },
  },
  { key: 'name', title: () => t('物料名称'), minWidth: 176, search: { actions: ACT.text } },
  {
    key: 'statusCode',
    title: () => t('单据状态'),
    width: 104,
    options: dicts(t).status,
    tag: true,
    search: { actions: ACT.select },
  },
  {
    key: 'deptId',
    title: () => t('部门'),
    width: 96,
    options: dicts(t).dept,
    search: { actions: ACT.select },
  },
  {
    key: 'amount',
    title: () => t('金额'),
    width: 112,
    align: 'right',
    format: 'money',
    search: {
      type: 'number',
      placeholder: t('请输入数字'),
      actions: ACT.number,
      props: { showButton: false },
    },
  },
  {
    key: 'bizTs',
    title: () => t('单据日期'),
    width: 112,
    format: 'date',
    search: { type: 'date', actions: ACT.date },
  },
  {
    key: 'createdAt',
    title: () => t('创建时间'),
    width: 168,
    format: 'datetime',
    search: { type: 'date', actions: ACT.date },
  },
  { key: 'ago', title: () => t('距今'), width: 96, format: agoText(t) },
  // 备注:null → emptyText「—」。库只在列有 format / options / render 时才走空值占位,所以这里声明一个恒等 format
  {
    key: 'memo',
    title: () => t('备注'),
    width: 120,
    format: (v: unknown) => String(v),
    search: { actions: ACT.text },
  },
  {
    key: 'creator',
    title: () => t('创建人'),
    width: 96,
    hide: true,
    search: { actions: ACT.text },
  },
]
