# Porch Console · 门廊控制台

> **One console, every shop.** 一个控制台，管全部门店。

Porch OS（[porch-os](https://github.com/WeijianHuang/porch-os)）的前端控制台：面向小微门店经营者的多店后台，负责门店切换、开单收银、会员、库存与报表。

**状态：早期设计阶段。** 本仓库目前只有工程约定，尚无可运行代码；框架与 API 客户端方案尚未锁定。

License: MIT · 语言：中文文档（发布前补英文版）

## 项目简介

Porch Console 是 Porch OS 的多店后台控制台，是店长和店员每天真正打开的那个界面。后端 `porch-os` 撑起结构与数据，这里负责把「多店」变得可操作：把当前在看哪家店做成全局上下文，切一次门店，看板、单据、库存、报表和权限全部跟着重取；跨店汇总只展示后端说你能看见的店，不让前端自己猜。

界面覆盖经营看板、商品与服务、开单收银、会员、报表、权限与店员。错误处理、令牌刷新、加载态、空态与离线提示都有统一约定，避免每个页面各写一套。名字里的 `console` 是中性的：未来加店员端、老板手机端或顾客小程序，都不需要改名。

框架与 API 客户端方案尚未锁定，当前仓库先固定交互约定与工程规范。

**边界（不做什么）**

- 不内置业务规则与金额计算，只做展示与交互，规则由后端负责
- 不在前端推导可见门店范围或权限
- 不把令牌放进 localStorage 或 URL
- 不硬编码 API 地址，不预设框架绑定的目录结构

## About (English)

Porch Console is the web console for Porch OS — the screen shop owners and staff open every day. The active shop is a global context: switching it invalidates every derived query and refreshes permissions, while cross-shop views are driven by the set of shops the backend says you can see. It covers dashboards, catalog, checkout, members, reports and staff permissions, with shared conventions for error mapping, token refresh, loading, empty and offline states.

The name is deliberately neutral: adding a staff app, an owner mobile view or a customer mini program later will not require a rename. Framework and API client are still undecided; this repository currently fixes the interaction and engineering conventions.

## 核心视图（规划）

| 视图 | 说明 |
|---|---|
| 门店上下文 | 全局门店切换器；单店视图与跨店汇总视图显式区分 |
| 经营看板 | 今日/区间关键指标，按店对比 |
| 商品与服务 | 统一目录 + 按店价格、库存、上下架覆盖 |
| 开单收银 | 单据绑定门店与操作人，提交幂等 |
| 会员 | 跨店档案、余额与消费记录 |
| 报表 | 单店明细、店群汇总，导出走流式下载 |
| 权限与店员 | 角色配置、门店可见范围 |

## 多店交互约定

- 门店是**全局上下文**，切换后所有派生查询与缓存必须失效重取，不能只改前端状态。
- 跨店视图必须由后端返回的可见门店集合驱动，不信任本地伪造的门店 ID。
- 切换门店后重新拉取权限；出现无权限时给出可读提示，不显示空白页。
- URL 中不携带令牌、门店敏感参数；刷新页面能恢复到合法门店上下文。

## 前端工程约定（与框架无关）

| 主题 | 约定 |
|---|---|
| API 客户端 | 统一封装，Base URL 走环境变量；令牌自动附加，不在业务组件里裸调 fetch |
| 错误处理 | 4xx 不重试并映射为可读文案；5xx 自动重试最多 3 次；网络失败显示离线提示 |
| 认证 | 401 自动刷新令牌后重试一次；访问令牌不存 localStorage，也不放进 URL |
| 状态 | 每个数据视图都有加载态、错误态、空态；禁止用占位错误提示 |
| 类型 | 前后端错误结构与响应形状保持类型一致；禁止硬编码 API 地址 |
| 安全 | CORS 用显式来源；错误提示不回显后端堆栈或内部细节 |
| 长任务 | 不在页面里轮询等待后端重计算；报表导出走流式下载 |

## 待定决策

| 项目 | 状态 |
|---|---|
| 前端框架与构建工具 | 待定 |
| API 客户端方案（类型化 fetch / React Query / OpenAPI 生成 / tRPC） | 待定 |
| 状态管理与缓存失效策略 | 待定 |
| 组件库、国际化、主题 | 待定 |
| 实时能力（轮询 / SSE / WebSocket） | 待定 |
| 测试与 E2E 工具 | 待定 |

骨架阶段刻意不写入任何框架相关目录，也不把框架名放进仓库名。

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

## 配套仓库

后端：同一账号下的 **[porch-os](https://github.com/WeijianHuang/porch-os)** 仓库。接口契约变更需两边同步。

## 贡献

见 [`CONTRIBUTING.md`](CONTRIBUTING.md)。

## 许可证

[MIT](LICENSE)，与 `porch-os` 保持一致。
