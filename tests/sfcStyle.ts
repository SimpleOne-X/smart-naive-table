// 测试辅助:读 SFC 源码(import xxx from '../src/Xxx.vue?raw')里 scoped 样式的文本,拆成规则。
// jsdom 不做布局、也不注入 SFC 的样式,量不出像素;这类测试锁的是规则本身,真实几何由浏览器实测(同 treeEllipsis.test.ts)。

export interface Rule {
  selectors: string[]
  body: string
}

/** 取 SFC 的 <style> 块,去注释,拆成「选择器列表 + 声明体」。选择器按顶层逗号拆开(:is() / :deep() 里的逗号不拆)。 */
export function rulesOf(source: string): Rule[] {
  const style = source
    .slice(source.indexOf('<style'))
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
  const out: Rule[] = []
  for (const m of style.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors: string[] = []
    let depth = 0
    let cur = ''
    for (const ch of m[1]) {
      if (ch === '(') depth++
      if (ch === ')') depth--
      if (ch === ',' && depth === 0) {
        selectors.push(cur.trim())
        cur = ''
      } else cur += ch
    }
    selectors.push(cur.trim())
    out.push({
      selectors,
      body: m[2]
        .trim()
        .replace(/\s*([:;])\s*/g, '$1 ')
        .trim(),
    })
  }
  return out
}

/** 选择器列表(顺序无关)与给定集合完全相同的规则;同一组选择器出现多次时合并声明体。没有这样的规则返回空串。 */
export function ruleFor(rules: Rule[], ...selectors: string[]): string {
  const want = [...selectors].sort().join(' | ')
  return rules
    .filter((r) => [...r.selectors].sort().join(' | ') === want)
    .map((r) => r.body)
    .join(' ')
}
