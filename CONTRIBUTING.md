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
- 4xx 不重试并映射文案；5xx 最多自动重试 3 次（复用同一 `Idempotency-Key`）；网络失败只显示「网络不可用」并保留草稿，**不支持离线提交**，详见后端 ADR-0004。
- 令牌不进 localStorage、不进 URL；401 走刷新令牌后重试一次。
- 不硬编码 API 地址，Base URL 一律来自环境变量。
- 切换门店后：取消在途单店请求（或丢弃旧门店响应）、按 `(user_id, current_shop_id, query_key)` 失效并重取全部派生查询与缓存、重新拉取权限；跨店视图不随切换变化（后端 ADR-0006）。
- 每个单店请求由 API 客户端统一注入 `X-Shop-Id`；切换器选项只来自 `/me/shops`，不信任本地伪造或 URL 传入的门店 ID；当前门店可存 localStorage（非令牌、非权限依据），刷新后用 `/me/shops` 复核，被撤销时回退到 `default_shop_id`。
- 跨店视图的可见门店集合以后端返回为准，不信任本地传入的门店 ID；不引入门店组 / 店群、分组切换器或按组汇总（后端 ADR-0005）。
- 框架、API 客户端、组件库与 E2E 选型**由本仓独立决定**（后端 ADR-0007 确认归属；NQ-14 已由 ADR-0008 收口：以既有内部前端工程实践为依据，工程名称不写入公开仓库）：后端只给 REST + OpenAPI、不做 BFF；前端不假设会话粘滞或服务端本地状态，API Base URL 只来自环境变量，后端多副本部署也不改变任何交互约定。
- 后端暂不读写分离、不做跨店自动清分（ADR-0007）：不做「刷新直到查到」的复制延迟补偿 UI，也不提供结算 / 清分入口；跨店差额只在按店分组的报表呈现。
- 若提供审计日志查询视图：超出保留期必须按后端冻结契约显示「超出保留期」提示（`400 AUDIT_RETENTION_WINDOW_EXCEEDED` + `earliest_queryable_at`），**不能渲染成空态、不能静默裁剪起始时间**；保留天数由运维配置，前端不提供调整入口，也不预留外部服务回调页（后端 ADR-0007 / ADR-0008，`design/08` §4）。
- 后端 `docs/design/00`–`09` 与 ADR-0001–0008 已冻结：接口契约变更须走后端设计变更或新 ADR，并同步本仓文档与类型定义；前端不得在页面里另造金额、时区、门店范围或错误重试口径。

## 测试

- 交互逻辑用组件级单测保持快速；涉及真实接口契约的测试连真实后端或契约桩，不要为提速 mock 掉整个服务层。
- 接口形状变化需同步 `porch-os` 的对应 issue。
