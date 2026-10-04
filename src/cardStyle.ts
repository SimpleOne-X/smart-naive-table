import type { CardProps } from 'naive-ui'

/**
 * 库里两张卡片(搜索卡片、表格卡片)的内边距:四边 16px。
 * 官方 medium 的无 header 卡片内容区实际是 上 20 / 左右 24 / 下 20
 * (paddingMedium 的 19 只在有 header 时用;内容区 padding-top 取的是 --n-padding-bottom);small 是 12px 16px 12px。
 * 做法:size="small" + 只作用于这张卡片的 paddingSmall 覆盖(getPadding 拆成 top / left / bottom),
 * 不动宿主的全局主题。回退 2.1.1 外观(官方 medium):SmartTable 的 cardProps={{ size: 'medium' }}。
 */
export const CARD_THEME_OVERRIDES: NonNullable<CardProps['themeOverrides']> = {
  paddingSmall: '16px 16px 16px',
}

/** 库默认(size small + 16px 覆盖)之上合并宿主的 cardProps;themeOverrides 逐键合并,不整个替换。 */
export function mergeCardProps(user?: Partial<CardProps>): Partial<CardProps> {
  return {
    size: 'small',
    ...user,
    themeOverrides: { ...CARD_THEME_OVERRIDES, ...user?.themeOverrides },
  }
}
