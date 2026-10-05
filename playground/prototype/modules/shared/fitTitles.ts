// 英文表头的默认列宽:每个数据列的宽度不低于 titleFit(t(标题))(原型 titleFit,见 ../../i18n.ts),放不下就加宽那一列,不改词、不缩中文。
// 官方表头标题没有 nowrap,内容盒比文字窄 1px 就整列折成两行、整行表头被撑高;所以每个模块的列在交给 SmartTable 之前都过一遍。
// 用法(必须在 computed 里,随语言重算):computed(() => fitTitles(cols, shell.lang === 'en'))
// 规则:
//   · 只处理标题是函数的数据列(key + title()):序号 / 勾选 / 展开 / 手柄(无 key 或标题不是函数)和固定宽度的「操作」列不动;
//   · 声明了 width 的列在文字更宽时把 width 加到 titleFit,声明了 minWidth(弹性列)的加 minWidth;已经够宽的不动;
//   · 多级表头递归处理 children(分组标题的宽度 = 子列之和,不单独处理);
//   · 中文(en = false)原样返回。
import { titleFit } from '../../i18n'

interface Col {
  key?: unknown
  type?: unknown
  title?: unknown
  width?: unknown
  minWidth?: unknown
  children?: Col[]
}

export function fitTitles<C extends object>(cols: C[], en: boolean): C[] {
  if (!en) return cols
  return cols.map((raw) => {
    const c = raw as Col
    if (c.children) return { ...c, children: fitTitles(c.children, en) } as C
    if (c.type !== undefined || c.key === undefined || c.key === 'actions') return raw
    if (typeof c.title !== 'function') return raw
    const w = titleFit(String((c.title as () => unknown)()))
    if (c.width != null) return w > Number(c.width) ? ({ ...c, width: w } as C) : raw
    return w > Number(c.minWidth ?? 0) ? ({ ...c, minWidth: w } as C) : raw
  })
}
