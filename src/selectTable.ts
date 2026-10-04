// SmartSelectTable 的搜索匹配(纯函数,可单测)。

/** 归一化:NFKC(全角 → 半角、兼容字符)+ 小写 + 去首尾空白。 */
export function normalizeText(s: unknown): string {
  return String(s ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .trim()
}

/**
 * 关键词是否命中这一行:按空白切词,所有词都要命中(AND),每个词可以命中任一搜索字段(包含、忽略大小写 / 全半角)。
 * 只看字符串或数字的字段值。没有词 = 命中。不做拼音。
 */
export function matchKeyword(
  row: Record<string, unknown>,
  keys: string[],
  keyword: string,
): boolean {
  const tokens = normalizeText(keyword).split(/\s+/).filter(Boolean)
  if (!tokens.length) return true
  const texts: string[] = []
  for (const k of keys) {
    const v = row[k]
    if (typeof v === 'string' || typeof v === 'number') texts.push(normalizeText(v))
  }
  return tokens.every((t) => texts.some((x) => x.includes(t)))
}
