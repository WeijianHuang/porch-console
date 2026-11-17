# Changelog

本文件遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 与语义化版本。

## [Unreleased]

### 新增

- **`docs/decisions/0001-frontend-stack-and-r1-scope.md`**：落定 FQ-01–16——采用全新技术栈（含主流方案对比）、API 类型来自后端契约、令牌按 A 方案、R1 页面范围、测试门禁与内部工程复用边界；`docs/OPEN-QUESTIONS.md` 转为已关闭的决议索引。
- **R1 前端骨架**：React 19 + TypeScript 5.9 + Vite 8 + TanStack Query v5 + React Router v7 + Ant Design + Zustand + Vitest；实现登录、全局门店切换、门店列表/设置、商品目录（新建/编辑）；统一 API client（typed fetch、`X-Shop-Id` 注入、写操作 `Idempotency-Key`、按 `error.retryable` 重试、401 刷新一次）。
- `src/api/types.ts` 为按后端冻结契约手写的临时类型层，待后端 `api/openapi.yaml` 产出后替换生成器；查询键含 `current_shop_id`，切换门店先取消在途请求、清理门店作用域缓存并重拉 `/me/permissions`。
- CI 从骨架检查替换为 `npm ci → lint → typecheck → unit → build` 门禁，并保留密钥/真实数据扫描。

- `docs/OPEN-QUESTIONS.md`：**前端待确认清单 FQ-01–16**——FQ-01–06 阻塞开工（技术栈与语言、API 类型来源、刷新令牌存储、R1 页面范围、测试/CI 门禁、内部工程复用边界），FQ-07–16 给默认口径可「按建议」推进；附「无需再确认」与「明确延后」边界。
- 对齐后端 [ADR-0008](https://github.com/WeijianHuang/porch-os/blob/main/docs/decisions/0008-design-freeze-and-nq-resolutions.md)：记录「后端详细设计已冻结」「NQ-14 前端选型依据」「审计超期查询错误契约」与新增的 `design/07`–`09` 分册入口。
- 仓库骨架：README、MIT 许可证、环境变量占位、CI 骨架检查、PR 模板、贡献指南。
- 多店交互约定与框架无关的前端工程约定（错误处理、认证、状态、类型与安全）。
- 待定决策清单：框架 / API 客户端方案 / 状态管理 / 组件库 / 实时方案 / 测试工具。
- `README.md` 补写「项目简介 / About (English)」章节，明确项目定位与「不做什么」的边界。

### 变更

- **本地联调免 CORS 配置**：Vite 开发代理把 `/api` 转发到本地后端 8080，`VITE_API_BASE_URL` 留空即走同源；生产环境仍可填完整 API 地址。
- **订正过期事实**：「本地联调」原先写「后端尚未提供可运行接口」，现改为后端 R1 已可运行（`cmd/api`：auth / me / shops / catalog / members / health / ready），单据 / 库存 / 报表 / 导出属 R2/R3；英文 About 的部署描述由「编排平台」同步为 Docker `api` × 2 / `worker` × 2；README 增加待确认清单入口。
- 待定决策章节改为「前端选型（本仓决策）」：决策权仍归本仓，选型以既有内部前端工程（待重构）实践为依据；**内部工程名称与源码不写入公开仓库**。
- 审计超期查询由「待后端确认」改为已冻结契约：`400 AUDIT_RETENTION_WINDOW_EXCEEDED` + `earliest_queryable_at`，不得渲染空态、不得静默裁剪起始时间；不提供专用审计导出端点，窗口内导出复用统一导出任务。
- 「本地联调」与「配套仓库」中「接口契约是设计提案、尚未冻结」的表述改为**已冻结**；变更需两仓同步。边界、About (English)、`CONTRIBUTING.md` 同步指向 ADR-0008。
- 补充「本地联调」说明：后端已选定 PostgreSQL 18.7，数据库由 `porch-os` 的 Compose 提供；前端不直连数据库、不在本仓库存放数据库地址与凭据。
- 「多店交互约定」明确只有门店上下文，不引入租户 / 组织 / 公司等上层切换，可见门店集合完全由后端返回（对应后端 ADR-0003）。
- 错误处理约定改为按响应体 `error.retryable` 判定重试（可重试时复用同一 `Idempotency-Key`），与后端 [03 接口设计](https://github.com/WeijianHuang/porch-os/blob/main/docs/design/03-api-design.md) 的错误码语义对齐；「本地联调」与「配套仓库」指向后端前期详细设计分册（当时为设计提案，现已由后端 [ADR-0008](https://github.com/WeijianHuang/porch-os/blob/main/docs/decisions/0008-design-freeze-and-nq-resolutions.md) 冻结）。
- 对齐后端 [ADR-0004](https://github.com/WeijianHuang/porch-os/blob/main/docs/decisions/0004-scope-baseline.md) 的范围基线：金额固定 CNY（`¥`）、业务时间统一按 UTC+8 渲染且不传时区参数；明确「网络不可用提示」不等于离线能力，不支持本地待提交队列、补传与冲突合并；不提供打印入口，凭证走后端文件导出；PR 模板与贡献指南同步措辞。
- 对齐后端 [ADR-0005](https://github.com/WeijianHuang/porch-os/blob/main/docs/decisions/0005-no-shop-groups.md)：不提供门店组 / 店群管理页、分组切换器与按组汇总视图；报表改为「单店明细 + 跨店汇总（按后端返回的可见门店集合显式多选门店）」，跨店能力不变。
- 对齐后端 [ADR-0006](https://github.com/WeijianHuang/porch-os/blob/main/docs/decisions/0006-user-shops-and-current-shop.md)：一个用户可拥有多间门店，切换器选项只来自 `/me/shops`；登录响应含 `shops` + `default_shop_id`，每个单店请求显式携带 `X-Shop-Id`；切换为纯客户端行为（无服务端切换端点），必须取消在途请求、按当前门店失效缓存并重拉权限；当前门店被撤销时回退到默认门店。
- 对齐后端 [ADR-0007](https://github.com/WeijianHuang/porch-os/blob/main/docs/decisions/0007-remaining-open-questions.md)：**确认前端框架 / API 客户端 / 组件库 / E2E 的选型归属本仓库**（后端只保证 REST + OpenAPI、不做 BFF；NQ-14 已由 ADR-0008 收口为「以既有内部前端工程实践为依据」）；新增「与后端范围基线的对齐」小节——R1 不预留外部服务回调页、编排平台多副本下不假设会话粘滞、暂不读写分离故不做复制延迟补偿 UI、审计日志 30 天保留故超期查询不得渲染成空态、不提供跨店清分入口；README 中文边界与 About (English)、`CONTRIBUTING.md`、PR 模板同步。
