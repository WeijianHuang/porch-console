# Changelog

本文件遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 与语义化版本。

## [Unreleased]

### 新增

- 仓库骨架：README、MIT 许可证、环境变量占位、CI 骨架检查、PR 模板、贡献指南。
- 多店交互约定与框架无关的前端工程约定（错误处理、认证、状态、类型与安全）。
- 待定决策清单：框架 / API 客户端方案 / 状态管理 / 组件库 / 实时方案 / 测试工具。
- `README.md` 补写「项目简介 / About (English)」章节，明确项目定位与「不做什么」的边界。

### 变更

- 补充「本地联调」说明：后端已选定 PostgreSQL 18.7，数据库由 `porch-os` 的 Compose 提供；前端不直连数据库、不在本仓库存放数据库地址与凭据。
- 「多店交互约定」明确只有门店上下文，不引入租户 / 组织 / 公司等上层切换，可见门店集合完全由后端返回（对应后端 ADR-0003）。
- 错误处理约定改为按响应体 `error.retryable` 判定重试（可重试时复用同一 `Idempotency-Key`），与后端 [03 接口设计](https://github.com/WeijianHuang/porch-os/blob/main/docs/design/03-api-design.md) 的错误码语义对齐；「本地联调」与「配套仓库」指向后端前期详细设计分册（设计提案，尚未冻结）。
- 对齐后端 [ADR-0004](https://github.com/WeijianHuang/porch-os/blob/main/docs/decisions/0004-scope-baseline.md) 的范围基线：金额固定 CNY（`¥`）、业务时间统一按 UTC+8 渲染且不传时区参数；明确「网络不可用提示」不等于离线能力，不支持本地待提交队列、补传与冲突合并；不提供打印入口，凭证走后端文件导出；PR 模板与贡献指南同步措辞。
- 对齐后端 [ADR-0005](https://github.com/WeijianHuang/porch-os/blob/main/docs/decisions/0005-no-shop-groups.md)：不提供门店组 / 店群管理页、分组切换器与按组汇总视图；报表改为「单店明细 + 跨店汇总（按后端返回的可见门店集合显式多选门店）」，跨店能力不变。
- 对齐后端 [ADR-0006](https://github.com/WeijianHuang/porch-os/blob/main/docs/decisions/0006-user-shops-and-current-shop.md)：一个用户可拥有多间门店，切换器选项只来自 `/me/shops`；登录响应含 `shops` + `default_shop_id`，每个单店请求显式携带 `X-Shop-Id`；切换为纯客户端行为（无服务端切换端点），必须取消在途请求、按当前门店失效缓存并重拉权限；当前门店被撤销时回退到默认门店。
- 对齐后端 [ADR-0007](https://github.com/WeijianHuang/porch-os/blob/main/docs/decisions/0007-remaining-open-questions.md)：**确认前端框架 / API 客户端 / 组件库 / E2E 的选型归属本仓库**（后端只保证 REST + OpenAPI、不做 BFF，具体框架仍待定）；新增「与后端范围基线的对齐」小节——R1 不预留外部服务回调页、编排平台多副本下不假设会话粘滞、暂不读写分离故不做复制延迟补偿 UI、审计日志 30 天保留故超期查询不得渲染成空态、不提供跨店清分入口；README 中文边界与 About (English)、`CONTRIBUTING.md`、PR 模板同步。
