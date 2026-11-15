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
