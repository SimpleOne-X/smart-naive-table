// 可编辑表格编辑态的文字左缘:每种编辑控件进入编辑后,文字左缘(相对单元格左缘)应与显示态一致。
// 对照页是 playground 的「可编辑 · 宿主主题」页:宿主主题 tdPadding 分单值(Naive 默认)/ 两值('4px 12px',SmartAdmin 内核同款)两种,
// 紧凑 / 舒适两档,逐列读数;任何一格相差超过 0.5px 就以退出码 1 结束。
//   node tools/parity/xe-pad.mjs [--url http://localhost:5173/playground.html]
import { launch, Page, sleep, args, PORT } from './cdp.mjs'

const A = args({ url: { type: 'string', default: 'http://localhost:5173/playground.html' } })
const KINDS = ['name', 'qty', 'status', 'tags', 'material', 'due', 'stamp']
const TOLERANCE = 0.5

/** 页面内读数函数:返回文字左缘相对 box 左缘的距离(display = 单元格 td,edit = 编辑容器 .smart-table-xe) */
const READER = `
(() => {
  const px = (v) => parseFloat(v) || 0
  const textNodeLeft = (scope) => {
    const w = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT)
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (!n.textContent.trim()) continue
      const r = document.createRange()
      r.selectNodeContents(n)
      return r.getBoundingClientRect().left
    }
    return null
  }
  const contentLeft = (scope) => {
    const tag = scope.querySelector('.n-tag')
    if (tag) return tag.getBoundingClientRect().left
    const input = scope.querySelector('input.n-input__input-el')
    if (input) {
      const cs = getComputedStyle(input)
      return input.getBoundingClientRect().left + px(cs.paddingLeft) + px(cs.borderLeftWidth)
    }
    return textNodeLeft(scope)
  }
  return {
    display(key) {
      const td = document.querySelector('td[data-xc="1|' + key + '"]')
      return contentLeft(td) - td.getBoundingClientRect().left
    },
    edit(key) {
      const td = document.querySelector('td[data-xc="1|' + key + '"]')
      const xe = td.querySelector('.smart-table-xe')
      if (!xe) return null
      const ctl = xe.querySelector('.n-input, .n-base-selection')
      const cs = ctl ? getComputedStyle(ctl) : null
      return {
        left: contentLeft(xe) - xe.getBoundingClientRect().left,
        tdPadding: cs && cs.getPropertyValue('--n-td-padding'),
        padLeft: cs && cs.getPropertyValue('--n-padding-left'),
        padSingle: cs && cs.getPropertyValue('--n-padding-single'),
      }
    },
    switchOn(id) {
      return document.querySelector('[data-testid="' + id + '"]').classList.contains('n-switch--active')
    },
  }
})()
`

const b = await launch(PORT)
let bad = 0
try {
  const p = await Page.open(PORT)
  await p.viewport(1400, 900)
  for (const twoValue of [false, true]) {
    for (const dense of [true, false]) {
      await p.goto(A.url, 800)
      await p.eval(
        `[...document.querySelectorAll('.n-tabs-tab')].find((e) => e.textContent.includes('宿主主题')).click(); true`,
      )
      await p.waitFor(`!!document.querySelector('[data-testid="two-value"]')`)
      for (const [id, want] of [
        ['two-value', twoValue],
        ['dense', dense],
      ]) {
        const cur = await p.eval(`(${READER}).switchOn('${id}')`)
        if (cur !== want) await p.clickSel(`[data-testid="${id}"]`)
        await sleep(300)
      }
      await p.waitFor(`!!document.querySelector('td[data-xc="1|name"]')`)
      await sleep(300)
      const head = `${twoValue ? '两值 4px 12px/4px 10px' : '单值(Naive 默认 12px/8px)'} · ${dense ? '紧凑' : '舒适'}`
      console.log(`\n== ${head}`)
      for (const key of KINDS) {
        const display = await p.eval(`(${READER}).display('${key}')`)
        await p.clickSel(`td[data-xc="1|${key}"]`)
        await sleep(150)
        await p.clickSel(`td[data-xc="1|${key}"]`)
        await p.waitFor(`!!document.querySelector('td[data-xc="1|${key}"] .smart-table-xe')`, 2000)
        await sleep(350)
        const e = await p.eval(`(${READER}).edit('${key}')`)
        if (!e) {
          console.log(`  ${key.padEnd(9)} 未进入编辑态`)
          bad++
          continue
        }
        const diff = e.left - display
        const flag = Math.abs(diff) > TOLERANCE ? '≠' : ' '
        if (flag === '≠') bad++
        console.log(
          `${flag} ${key.padEnd(9)} 显示态 ${display.toFixed(1).padStart(5)}  编辑态 ${e.left.toFixed(1).padStart(5)}  差 ${diff.toFixed(1).padStart(5)}  [td-padding=${e.tdPadding?.trim()} padding-left=${e.padLeft?.trim()} padding-single=${e.padSingle?.trim()}]`,
        )
        await p.key('Escape', 'Escape', { vk: 27 })
        await sleep(250)
      }
    }
  }
  if (p.logs.some((l) => l.startsWith('[exception]')))
    console.log('\n页面异常:\n' + p.logs.filter((l) => l.startsWith('[exception]')).join('\n'))
} finally {
  await b.close()
}
console.log(bad ? `\n共 ${bad} 项不一致` : '\n全部一致')
process.exit(bad ? 1 : 0)
