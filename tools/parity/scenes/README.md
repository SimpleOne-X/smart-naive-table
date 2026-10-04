# tools/parity/scenes — 各模块的交互场景

`interact.mjs` 启动时会把本目录下所有 `m*.mjs`(按文件名自然序)里的场景追加到既有 6 条场景之后,所以**模块 agent 只需新建 `mN.mjs`,不用改 `interact.mjs`**。既有场景(m1–m3)在 `interact.mjs` 里,不要在这里重复定义。

## 文件格式

`scenes/m6.mjs`(文件名必须以 `m` + 数字开头、`.mjs` 结尾):

```js
// 默认导出一个场景数组(单个对象也行;具名导出 scenes 也认)
export default [
  {
    name: 'm6 标签列 hover',           // 必填,全局唯一;--only <子串> 按它过滤;截图文件名由它派生(空白 → _)
    mod: 6,                            // 必填,模块编号 1–13(决定进哪个模块、用 modules.mjs 里的就绪判据)
    proto: `document.querySelector('[data-act="xxx"]').click()`,   // 必填,原型页里执行的 JS(点开弹层 / 抽屉等)
    prev:  `document.querySelector('.xxx').click()`,               // 必填,对照页里执行的 JS
    pp: '.hpop',                       // 必填,原型弹层根选择器(找第一个可见的)
    vp: '.n-popover',                  // 必填,对照页弹层根选择器
    settleMs: 1900,                    // 可选,进入模块后的稳定等待;缺省取 modules.mjs 该模块的 settleMs(m1–m4 缺省:原型 1500 / 对照页 1300)
    pre: `...`,                        // 可选,先于 proto / prev 执行的 JS(滚动、先点别的、塞入状态)
                                       //   字符串 = 两侧都执行;或 { proto: '...', prev: '...' } 两侧各自一份
  },
]
```

字段含义与 `interact.mjs` 既有场景完全一致:`proto` / `prev` 各自是「在该页面里执行的一段 JS 表达式」(脚本在后面补 `; true`,所以写成单个表达式或以分号分隔的语句都行);`pp` / `vp` 是弹层的**容器**选择器,脚本据此读弹层矩形,并列出里面的按钮 / 输入 / 勾选 / 下拉相对弹层左上角的位置。

## 运行

```
node tools/parity/interact.mjs --only "m6 标签"        # 子串匹配;没匹配到会报错并列出全部可选场景名
node tools/parity/interact.mjs --theme dark --only m6
```

加载时会校验:缺必填字段、`mod` 越界、场景名重复都会直接抛错并指出文件名。视口固定 1440x900。

## 约定

- 一个模块一个文件:`mN.mjs` 只放模块 N 的场景(`mod` 写 N)。
- 场景只读不改:每个场景开头脚本会重载页面并清 localStorage,不要依赖上一个场景的状态。
- 对照页占位组件阶段(没有表格)场景会因就绪超时而抛错——先让模块出来再加场景。
