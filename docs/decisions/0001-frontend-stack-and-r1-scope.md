# ADR-0001: 全新前端技术栈与 R1 页面范围

- 状态：已接受（2026-11-17）
- 决策问题：前端采用什么技术栈、API 类型从何而来、令牌如何存储、R1 交付哪些页面
- 上游：后端 ADR-0008（详细设计冻结）、[FQ 清单](../OPEN-QUESTIONS.md)
- 影响：本仓目录结构、CI、依赖许可、R1 页面范围；不修改后端冻结契约

## 背景

后端详细设计已冻结（`porch-os/docs/design/00`–`09` + ADR-0001–0008），前端只保证 REST + OpenAPI 对接。NQ-14 把具体框架决策权交回本仓。2026-11-17 用户一次性答复 FQ-01–16：采用**全新技术栈**；API 类型从后端契约来；令牌按 A 方案；R1 只做登录 + 门店切换 + 门店列表/设置 + 商品目录；测试按 A；复用按行业通用方式；FQ-07–16 按建议。

### 主流技术栈对比（FQ-01 要求提供）

| 方案 | 组成 | 适用 | 取舍 |
|---|---|---|---|
| **A · 采用** | React 19 + TypeScript + Vite + TanStack Query v5 + React Router v7 + Ant Design + Zustand + Vitest | 多店中后台，重交互与表格表单，需要成熟组件库 | 生态最大、招聘面广；与既有 React 系实践最接近但与旧工程零源码复用；纯客户端无 SSR 负担 |
| B | Next.js App Router + TypeScript + TanStack Query + Ant Design | 有 SEO / SSR / BFF 诉求 | 后端明确不做 BFF，SSR 收益低，部署与缓存复杂度显著增加 |
| C | Vue 3 + Vite + TypeScript + Pinia + Element Plus | 团队以 Vue 为主 | 与既有 React 系资产脱节，组件与测试生态需重建 |
| D | Angular + TypeScript + RxJS + Angular Material | 强规范的大型团队 | 学习曲线陡、模板与 DI 约定重，不适合当前小团队快速交付 |

**选 A**：它同时满足「全新技术栈」「类型化 API 层」「成熟中后台组件」「轻量无服务端」四项约束；组件库与多店表格/表单场景契合，Vitest 与 Vite 同源减少配置面。

## 决策

1. **技术栈（FQ-01）**：采用方案 A。版本在 `package.json` 锁定；TypeScript 固定在 5.9.x（`typescript-eslint` 当前不支持 TS 7）；ESLint 10 扁平配置；E2E 工具留到 R2。
2. **API 类型（FQ-02 = A）**：先按后端冻结的 `design/03` 手写类型与 API client；后端生成 `api/openapi.yaml` 后改为从契约生成。**类型来源始终是后端契约**，不得在前端另造字段。
3. **令牌（FQ-03 = A）**：access token 只存内存；refresh token 存 sessionStorage（关标签页失效）；两者都不进 localStorage / URL。401 自动刷新一次并重放原请求；刷新失败清空并跳登录。
4. **R1 范围（FQ-04）**：登录 + 门店切换 + 门店列表/设置 + 商品目录（含创建/编辑）。**不实现**会员、单据、库存、报表、导出页面；后端 R2/R3 端点尚未提供，前端不预留调用入口。
5. **测试与 CI（FQ-05 = A）**：lint + typecheck + unit + build 为必过门禁；后端 `openapi.yaml` 产出后追加契约无 diff 校验；E2E 放 R2。
6. **复用边界（FQ-06，行业通用方式）**：只复用设计约定与通用组件写法，不复制任何内部私有源码；依赖全部走公开 npm 包，保留许可证文件并在引入前核对许可与来源；公开仓不出现内部工程名、真实经营数据或私有路径。
7. **默认口径（FQ-07–16）**：组件库沿用 Ant Design、浅色主题、中文文案；金额用 decimal.js 定点解析、时间用 dayjs(utc/timezone) 按 UTC+8 渲染；门店切换器 ≤20 全量、>20 搜索、>50 分页；多标签页不同步；403 静默回退默认店；导出手动刷新；错误文案直用后端 `message`；仅本地 dev + 一个可配环境；桌面 Chrome/Edge 最近两版、最小 1280；菜单按 `/me/permissions` 渲染但不作授权依据。

## 理由

- 全新技术栈避免继承旧工程的构建与状态管理债务；React 系 + Ant Design 是中后台最通用的组合。
- 类型来自后端契约可避免前后端字段漂移；后端 OpenAPI 尚未生成，手写层是临时桥接且有明确退出条件。
- 令牌不落 localStorage 降低 XSS 持久化窃取面；sessionStorage 兼顾刷新页面后仍可静默续期。
- R1 范围与后端已实现端点严格对齐，避免出现「页面点了但接口不存在」的假功能。

## 后果与限制

- 首次加载需要一次 `/auth/refresh` 才能恢复会话；新标签页需重新登录（与 FQ-10「多标签页不同步」一致）。
- `src/api/types.ts` 是手写类型，后端 `openapi.yaml` 产出后必须替换生成器并删除手写副本，否则违反 FQ-02。
- TypeScript 固定 5.9.x 是工具链兼容约束，升级到 7 前须先升级 `typescript-eslint`。
- 本决策只约束前端；后端 ADR-0008 的解冻 / 变更仍需走后端新 ADR。
