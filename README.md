# Porch Console · 门廊控制台

> **One console, every shop.** 一个控制台，管全部门店。

Porch OS（[porch-os](https://github.com/WeijianHuang/porch-os)）的前端控制台：面向小微门店经营者的多店后台，负责门店切换、开单收银、会员、库存与报表。

**状态：早期设计阶段，后端详细设计已冻结。** 本仓库目前只有工程约定，尚无可运行代码；框架与 API 客户端的决策权归本仓，选型依据既有内部前端工程（待重构）的实践确定，工程名称不在公开仓库记录。

License: MIT · 语言：中文文档（发布前补英文版）

## 项目简介

Porch Console 是 Porch OS 的多店后台控制台，是店长和店员每天真正打开的那个界面。**一个用户可拥有多间门店**（后端 [ADR-0006](https://github.com/WeijianHuang/porch-os/blob/main/docs/decisions/0006-user-shops-and-current-shop.md)）：登录后从后端返回的可见门店集合里选定当前门店，顶部切换器随时切换。后端 `porch-os` 撑起结构与数据，这里负责把「多店」变得可操作：把当前在看哪家店做成全局上下文，切一次门店，看板、单据、库存、报表和权限全部跟着重取；跨店汇总按后端返回的可见门店集合显式多选门店，不设门店组，也不让前端自己猜。

界面覆盖经营看板、商品与服务、开单收银、会员、报表、权限与店员。错误处理、令牌刷新、加载态、空态与网络不可用提示都有统一约定，避免每个页面各写一套。名字里的 `console` 是中性的：未来加店员端、老板手机端或顾客小程序，都不需要改名。

> 这里的「网络不可用提示」只是错误态文案，**不代表支持离线收银**：断网期间一律不允许提交单据，详见 [后端 ADR-0004](https://github.com/WeijianHuang/porch-os/blob/main/docs/decisions/0004-scope-baseline.md)。

框架与 API 客户端的具体选型由本仓按既有内部前端工程实践确定并单独记录，当前仓库先固定交互约定与工程规范；后端接口契约已由 [ADR-0008](https://github.com/WeijianHuang/porch-os/blob/main/docs/decisions/0008-design-freeze-and-nq-resolutions.md) 冻结，不阻塞前端选型。

**边界（不做什么）**

- 不内置业务规则与金额计算，只做展示与交互，规则由后端负责
- 不在前端推导可见门店范围或权限；**当前门店不是权限依据**，只是单店视图的上下文
- 不做服务端「切换当前门店」写入：不调用切换端点、不新增 `current_shop` 状态表，切换只在本地改上下文与请求头（后端 [ADR-0006](https://github.com/WeijianHuang/porch-os/blob/main/docs/decisions/0006-user-shops-and-current-shop.md)）
- 不把令牌放进 localStorage 或 URL（当前门店 ID 不是令牌，可本地保存但不得作为权限依据）
- 不硬编码 API 地址，不预设框架绑定的目录结构
- **不做离线收银**：不建本地待提交队列、不缓存写操作、不做恢复补传与冲突合并；断网只提示，恢复后由用户重新提交（复用同一 `Idempotency-Key`）
- **不做打印入口**：无小票模板、打印按钮与设备适配；需要凭证时用后端导出接口下载文件
- **不做币种与时区选择**：金额一律人民币 `¥`，业务时间统一按 UTC+8 展示，不随浏览器本地时区变化，也不传时区参数
- **不做门店组 / 店群**：没有分组管理页、分组切换器与按组汇总视图；跨店视图由后端返回的可见门店集合 + 显式多选门店驱动，与后端 [ADR-0005](https://github.com/WeijianHuang/porch-os/blob/main/docs/decisions/0005-no-shop-groups.md) 一致
- 以上边界与后端的 [ADR-0004](https://github.com/WeijianHuang/porch-os/blob/main/docs/decisions/0004-scope-baseline.md) / [ADR-0005](https://github.com/WeijianHuang/porch-os/blob/main/docs/decisions/0005-no-shop-groups.md) / [ADR-0006](https://github.com/WeijianHuang/porch-os/blob/main/docs/decisions/0006-user-shops-and-current-shop.md) / [ADR-0007](https://github.com/WeijianHuang/porch-os/blob/main/docs/decisions/0007-remaining-open-questions.md) / [ADR-0008](https://github.com/WeijianHuang/porch-os/blob/main/docs/decisions/0008-design-freeze-and-nq-resolutions.md) 一致

## About (English)

Porch Console is the web console for Porch OS — the screen shop owners and staff open every day. One user can manage several shops (ADR-0006): after login the backend returns the visible shops and a default, and the switcher lets the user pick the active shop. The active shop is a request-time context, not an authorization source: every single-shop request carries it explicitly, and the backend validates it against `user_shops` on every call. Switching is client-side only (no backend endpoint): it cancels in-flight requests, invalidates cached queries keyed by the active shop and refreshes permissions, while cross-shop views are driven by the set of shops the backend says you can see and are unaffected by the switch. It covers dashboards, catalog, checkout, members, reports and staff permissions, with shared conventions for error mapping, token refresh, loading, empty and network-unavailable states. There is no shop-group concept: cross-shop views select shops explicitly from the set the backend says you can see (ADR-0005). Offline checkout, printing, currency/timezone pickers and shop groups are explicitly out of scope (ADR-0004 / ADR-0005): the console shows one currency (CNY) and one timezone (UTC+8), and a network failure never turns into a locally queued order. ADR-0007 closes the backend's remaining open questions: no external integrations in R1, orchestrated deployment without read replicas, no automatic cross-shop settlement, and audit logs retained for a configurable 30 days — an audit query beyond that window must say so explicitly instead of rendering an empty state. ADR-0008 freezes the backend detailed design and fixes a Docker 2+2 runtime baseline; such an out-of-window query returns 400 AUDIT_RETENTION_WINDOW_EXCEEDED together with the earliest queryable timestamp.

The name is deliberately neutral: adding a staff app, an owner mobile view or a customer mini program later will not require a rename. The concrete framework and API client are decided by this repository following its existing internal frontend practice (NQ-14, ADR-0008); ADR-0007 confirms this repository owns that choice and the backend provides REST + OpenAPI only. The internal project name is deliberately not recorded in this public repository. This repository currently fixes the interaction and engineering conventions.

## 核心视图（规划）

| 视图 | 说明 |
|---|---|
| 门店上下文 | 全局门店切换器（选项只来自 `/me/shops`，一个用户可有多间门店）；单店视图与跨店汇总视图显式区分，切换不影响跨店范围 |
| 经营看板 | 今日/区间关键指标，按店对比 |
| 商品与服务 | 统一目录 + 按店价格、库存、上下架覆盖 |
| 开单收银 | 单据绑定门店与操作人，提交幂等 |
| 会员 | 跨店档案、余额与消费记录 |
| 报表 | 单店明细、跨店汇总（按后端返回的可见门店集合选择门店，不设门店组），导出走流式下载 |
| 权限与店员 | 角色配置、门店可见范围 |

## 多店交互约定

- **一个用户可拥有多间门店**（后端 [ADR-0006](https://github.com/WeijianHuang/porch-os/blob/main/docs/decisions/0006-user-shops-and-current-shop.md)）：登录响应给出 `shops` + `default_shop_id`，切换器选项只来自 `GET /me/shops`；可见集合允许为空，此时显示「暂无可用门店」而非空白页。
- 门店是**全局上下文**，切换后所有派生查询与缓存必须按 `(user_id, current_shop_id, query_key)` 失效重取，不能只改前端状态；切换前取消在途单店请求，或丢弃带旧 `shop_id` 的响应。
- **每个单店请求显式携带 `X-Shop-Id`**（缺头后端返回 400，不再隐式默认到唯一门店）；**当前门店不是权限依据**，服务端每次仍用 `user_shops` 求交校验。切换是纯客户端行为：**没有服务端切换端点**、不写库、不改变权限与数据归属。
- 切换门店后重新拉取 `/me/permissions`；出现无权限时给出可读提示，不显示空白页。当前门店被撤销或停用时自动回退到 `default_shop_id`。
- 当前门店可存 localStorage（非令牌、非权限依据）；URL 中不携带令牌与门店敏感参数，刷新页面后用最新 `/me/shops` 复核并恢复到合法门店上下文。
- 跨店视图必须由后端返回的可见门店集合驱动，用显式多选门店指定范围，且**不随当前门店切换而变化**；不信任本地伪造的门店 ID；**不存在门店组 / 店群维度，也不做按组汇总**（后端 [ADR-0005](https://github.com/WeijianHuang/porch-os/blob/main/docs/decisions/0005-no-shop-groups.md)）。
- **只有门店上下文，没有租户 / 组织 / 公司等上层切换**；可见门店集合完全由后端返回，隔离模型见 [后端 ADR-0003](https://github.com/WeijianHuang/porch-os/blob/main/docs/decisions/0003-shop-level-isolation.md)。

## 前端工程约定（与框架无关）

| 主题 | 约定 |
|---|---|
| API 客户端 | 统一封装，Base URL 走环境变量；令牌自动附加，**每个单店请求自动注入 `X-Shop-Id`**，不在业务组件里裸调 fetch；切换时取消在途请求或丢弃旧门店响应 |
| 门店上下文 | 当前门店由客户端持有（可存 localStorage，非令牌/权限依据）；缓存键含 `current_shop_id`，切换后失效重取并重新拉权限；跨店视图按 `shop_ids` 独立缓存（后端 ADR-0006） |
| 错误处理 | 按响应体 `error.retryable` 决定是否重试，不按 HTTP 大类猜；可重试最多 3 次并复用同一 `Idempotency-Key`，不可重试映射为可读文案；网络失败显示「网络不可用」提示并保留草稿，**不允许离线提交单据**。错误码表见 [后端接口设计](https://github.com/WeijianHuang/porch-os/blob/main/docs/design/03-api-design.md) |
| 时间展示 | 后端返回 ISO 8601 UTC，前端统一按 `Asia/Shanghai`（UTC+8）渲染；业务日、日报分组、单号日期都以后端口径为准，不用浏览器本地时区，也不传 `tz` 参数 |
| 金额展示 | 单一 CNY，固定 `¥` 前缀；金额字段是字符串，解析为定点类型后再格式化，不用浮点运算；没有币种切换与汇率显示 |
| 认证 | 401 自动刷新令牌后重试一次；访问令牌不存 localStorage，也不放进 URL |
| 状态 | 每个数据视图都有加载态、错误态、空态；禁止用占位错误提示 |
| 类型 | 前后端错误结构与响应形状保持类型一致；禁止硬编码 API 地址 |
| 安全 | CORS 用显式来源；错误提示不回显后端堆栈或内部细节 |
| 长任务 | 不在页面里轮询等待后端重计算；报表导出走流式下载 |

## 与后端范围基线的对齐（ADR-0007 / 0008）

- **R1 不接外部服务**：不预留第三方支付 / 短信 / 对象存储的回调页与配置入口；后端 Outbox 订阅者全在进程内。
- **后端本期落地 Docker 多副本（`api` × 2 / `worker` × 2）、暂不读写分离**：前端不假设会话粘滞或服务端本地状态，API Base URL 只由环境变量注入；当前门店本来就在客户端（ADR-0006），天然适配多副本。写入成功后按后端返回直接展示，不做「刷新直到查到」这类针对复制延迟的补偿 UI。
- **审计日志默认保留 30 天**：若将来提供审计查询视图，**超出保留期必须显示明确的「超出保留期」提示，不能渲染成空态**。错误契约已由 [ADR-0008](https://github.com/WeijianHuang/porch-os/blob/main/docs/decisions/0008-design-freeze-and-nq-resolutions.md) 冻结：`400 AUDIT_RETENTION_WINDOW_EXCEEDED`，`details` 带 `earliest_queryable_at` / `retention_days` / `cutoff_at`；可提供「从最早可查时间重试」，但**不得静默裁剪起始时间**。不提供专用审计导出端点，窗口内导出复用统一导出任务（后端 `design/08` §4）。保留天数是运维配置，前端不提供调整入口。
- **不做跨店自动清分**：门店间差额只在按店分组的报表里呈现，不提供结算 / 清分操作入口。
- **后端详细设计已冻结**：`docs/design/00`–`09` 与 ADR-0001–0008 为契约基线；新增 `07` 部署与运行基线、`08` 审计日志保留与清理、`09` 跨店差额与清分边界。前端按冻结契约对接，不在本地另造口径。

以上边界与后端 [ADR-0007](https://github.com/WeijianHuang/porch-os/blob/main/docs/decisions/0007-remaining-open-questions.md) / [ADR-0008](https://github.com/WeijianHuang/porch-os/blob/main/docs/decisions/0008-design-freeze-and-nq-resolutions.md) 一致。

## 前端选型（本仓决策）

> 后端 [ADR-0007](https://github.com/WeijianHuang/porch-os/blob/main/docs/decisions/0007-remaining-open-questions.md) 已确认**决策权归本仓库**，[ADR-0008](https://github.com/WeijianHuang/porch-os/blob/main/docs/decisions/0008-design-freeze-and-nq-resolutions.md)（NQ-14）进一步确定**选型以既有内部前端工程（待重构）的实践为依据**，由本仓独立记录；后端只保证 REST + OpenAPI、不做 BFF、不绑定任何框架。下表不是「等后端拍板」，而是本仓自己的待办；**内部工程名称与源码不写入公开仓库**，也不阻塞后端 R1。

| 项目 | 状态 |
|---|---|
| 前端框架与构建工具 | 由本仓按既有内部前端工程实践确定并记录 |
| API 客户端方案（类型化 fetch / React Query / OpenAPI 生成 / tRPC） | 由本仓按同一依据确定 |
| 状态管理与缓存失效策略 | 由本仓按同一依据确定 |
| 组件库、国际化、主题 | 由本仓按同一依据确定 |
| 实时能力（轮询 / SSE / WebSocket） | 由本仓按同一依据确定 |
| 测试与 E2E 工具 | 由本仓按同一依据确定 |

骨架阶段刻意不写入任何框架相关目录，也不把框架名放进仓库名；内部工程名称同样不出现在公开仓库。后端详细设计已冻结，选型落地后按 `error.retryable` 与既定错误码表对接即可。

## 快速开始

```bash
git clone https://github.com/WeijianHuang/porch-console.git
cd porch-console
cp .env.example .env   # 按框架调整变量名前缀，.env 不提交
```

`.env.example` 中 `API_BASE_URL` 指向本地 `porch-os`；具体前缀按框架调整（Vite 用 `VITE_`，Next.js 用 `NEXT_PUBLIC_`）。

## 仓库结构

```
.github/           CI 工作流与 PR 模板
.env.example       配置占位（仅示例值）
CONTRIBUTING.md    贡献流程
CHANGELOG.md       变更记录
```

源码目录待框架确定后添加。

## 本地联调（当前）

后端 `porch-os` 已选定 PostgreSQL 18.7，本地数据库由该仓库的 Compose 启动，步骤见 [后端本地开发环境](https://github.com/WeijianHuang/porch-os/blob/main/docs/LOCAL-DEV.md)。前端只通过 `API_BASE_URL` 访问后端 HTTP 接口：

- **前端不直连数据库**，本仓库不存放数据库地址、账号或口令。
- 数据库属于后端实现细节，不影响前端接口契约；接口契约为 **REST + OpenAPI**，见 [后端接口设计](https://github.com/WeijianHuang/porch-os/blob/main/docs/design/03-api-design.md) 与 [详细设计总览](https://github.com/WeijianHuang/porch-os/blob/main/docs/design/00-overview.md)。
- 后端范围基线已锁定（[ADR-0004](https://github.com/WeijianHuang/porch-os/blob/main/docs/decisions/0004-scope-baseline.md)）：单币种 CNY、统一 UTC+8、暂不归档、不打印、不离线收银；前端据此不预留币种/时区选择、打印与离线提交入口。后端 [ADR-0005](https://github.com/WeijianHuang/porch-os/blob/main/docs/decisions/0005-no-shop-groups.md) 取消门店组，前端同样不预留分组管理与按组汇总入口。后端 [ADR-0006](https://github.com/WeijianHuang/porch-os/blob/main/docs/decisions/0006-user-shops-and-current-shop.md) 明确一个用户可拥有多间门店、当前门店可切换：前端需按 `/me/shops` 渲染切换器、为每个单店请求注入 `X-Shop-Id`，且不预留服务端切换端点。
- 后端尚未提供可运行接口，因此本地暂时没有可联调的服务；`.env.example` 里的 `API_BASE_URL` 只是占位。接口契约已由后端 [ADR-0008](https://github.com/WeijianHuang/porch-os/blob/main/docs/decisions/0008-design-freeze-and-nq-resolutions.md) **冻结**；后续变更走设计变更或新 ADR，并需两仓同步。

## 配套仓库

后端：同一账号下的 **[porch-os](https://github.com/WeijianHuang/porch-os)** 仓库。接口契约见 [03 接口设计](https://github.com/WeijianHuang/porch-os/blob/main/docs/design/03-api-design.md)，详细设计见 [00 总览](https://github.com/WeijianHuang/porch-os/blob/main/docs/design/00-overview.md)；契约变更需两边同步。

## 贡献

见 [`CONTRIBUTING.md`](CONTRIBUTING.md)。

## 许可证

[MIT](LICENSE)，与 `porch-os` 保持一致。
