# 贡献指南

## 分支规则

- **dev**:日常开发分支,所有 Pull Request 请提交到这里。
- **main**:发布分支,仅由仓库所有者直接推送发版,不接受任何 Pull Request(提到 main 的 PR 会被自动关闭)。

## 提交 PR 前

请确保以下命令本地能跑通:

```bash
npm run typecheck
npm test
npm run build
```

## 流程

1. Fork 本仓库,基于 `dev` 创建自己的分支。
2. 完成修改并补充/更新测试。
3. 提交 Pull Request,目标分支选择 `dev`。

## 对照设计原型

`npm run dev` 后访问 `/prototype.html`(`?m=1..4` 选模块,`?theme=light|dark` 选明暗):用真实库复刻 `docs/smart-naive-table-design.html` 的模块 1–4,与原型并排逐项比较外观与行为。库做不到的部分留空,不用自定义代码假装。改库的外观 / 排布前后都对着它看一眼。
