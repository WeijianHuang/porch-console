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
