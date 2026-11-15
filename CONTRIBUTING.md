# 贡献指南

感谢参与 Porch Console。项目处于早期设计阶段，交互约定、错误文案和测试用例的贡献与写页面同样有价值。

## 开始之前

- 先读 [`README.md`](README.md)，尤其是「多店交互约定」和「前端工程约定」。
- 后端模型与授权规则见 `porch-os` 仓库的 `docs/ARCHITECTURE.md`。
- 大改动先在 issue 里讨论，避免直接提大 PR。
- 参与讨论请遵守 [Contributor Covenant](https://www.contributor-covenant.org/version/2/1/code_of_conduct/)。

## 开发流程

1. Fork 后从 `main` 建分支，命名 `feat/xxx`、`fix/xxx`、`docs/xxx`。
2. 本地配置：`cp .env.example .env`，按框架调整变量名前缀；`.env` 不提交。
3. 提交信息遵循 [Conventional Commits](https://www.conventionalcommits.org/)。
4. PR 里附上改动前后的界面截图（UI 改动必填）。
5. 提交前自检：无 `.env`、无密钥、无真实经营数据。

## 前端自查约定

- 每个数据视图都有加载态、错误态、空态，错误提示可读，不出现占位文案。
- 4xx 不重试并映射文案；5xx 最多自动重试 3 次；网络失败显示离线提示。
- 令牌不进 localStorage、不进 URL；401 走刷新令牌后重试一次。
- 不硬编码 API 地址，Base URL 一律来自环境变量。
- 切换门店后相关查询与缓存全部失效重取，并重新拉取权限。
- 跨店视图的可见门店集合以后端返回为准，不信任本地传入的门店 ID。

## 测试

- 交互逻辑用组件级单测保持快速；涉及真实接口契约的测试连真实后端或契约桩，不要为提速 mock 掉整个服务层。
- 接口形状变化需同步 `porch-os` 的对应 issue。
