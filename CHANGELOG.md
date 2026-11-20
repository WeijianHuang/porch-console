# Changelog

本文件遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 与语义化版本。

## [Unreleased]

### 新增

- **判定链默认模板（一键载入）**：`/rules` 判定链页新增「载入默认规则」——站点尚未初始化时空态提供主按钮、已有规则时操作区提供带确认的按钮；点击后把一套推荐 8 步默认链（site 作用域、命中即保持、`rotational` 允许轮转、加班与跨组步骤标记不轮转、时段留空遵循 C-12 无固定默认值）填入草稿，不自动写入服务端，仍需确认后点「发布新版本」。默认链为纯函数 `defaultRules()`，不含任何站点 / 执行者 / 队列专属 ID，配 5 个单测。
- **调度台并入（对齐后端 ADR-0012 / design/12）**：新增 `/board` 调度看板、`/rules` 判定链配置、`/linkage` 联动策略、`/audit` 审计与指标四页与侧栏入口。调度看板复用服务人员作为执行者，队列并排展示位次卡（状态色标 + 文字、主队列 / 置顶标记）、派单抽屉（≤3 步）、置顶 / 解除、回原位 / 完成 / 取消、决策解释抽屉（命中规则 + 逐链 + 位次变更）。判定链页可编辑 8 步顺序 / 开关 / 作用域 / 命中动作 / 时段并发布；联动页支持六种模式、名单 / 排除与逐队列动作映射（各自落位）；审计页呈现实测指标不设阈值。`src/api/scheduling.ts` 全部单店请求带 `X-Shop-Id`、写带 `Idempotency-Key`；query keys 含 shop 前缀随站点切换失效。UI 文案只用通用术语，敏感词对照表不入库。新增 `docs/decisions/0004-scheduling-console.md`。
- **房间管理（对齐后端 ADR-0011 / design/11）**：新增 `/rooms` 与侧边栏「房间管理」入口；房间页按楼层分区展示（楼层降序、组内按房间号升序），支持新建 / 编辑 / 启停 / 删除（二次确认）；`src/api/rooms.ts` 对齐 `/rooms` 端点、全部单店请求带 `X-Shop-Id`、写操作带 `Idempotency-Key`；`room.read` / `room.write` 权限控制；纯函数 `groupByFloor` / `floorLabel` 与单测。新增 `docs/decisions/0003-rooms-and-floors.md`。
- **队列与服务人员（对齐后端 ADR-0009 / design/10）**：主页默认路由改为 `/queues`；新增队列页（序号 + 名称、按 `seq` 排序、队列内服务人员勾选分配）与服务人员页（建档、查看每人所在多个队列）；`src/api/queues.ts` 对齐 `/queues` / `/staff` / `queues/{id}/staff` 端点，全部单店请求带 `X-Shop-Id`、写操作带 `Idempotency-Key`。新增 `queue.read` / `queue.write` 权限控制；`sortBySeq` 纯函数与单测。

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

### 修复

- **前端样式与操作逻辑优化**：
  - 窄屏侧栏重叠：Ant Design `Sider` 折叠到 0 宽时会自动生成一个浮动 `.ant-layout-sider-zero-width-trigger`，盖在页面标题上且与顶栏汉堡按钮重复。给 `Sider` 设 `trigger={null}`，顶栏 `nav-toggle` 成为唯一折叠入口，窄屏标题不再被遮挡。
  - 判定链编辑串位（严重）：`/rules` 表格对 `draft` 排序后渲染，但各列编辑回调用排序后的行下标修改原始 `draft`，用户改动「顺序」后编辑其它规则会改错对象。改为按稳定的规则 `type` 定位，行键从 `type-order` 改为 `type`（改顺序时不再重挂载行、丢失输入焦点）。
  - 事件「解释」假操作：`/board` 历史事件解释按钮原会发一次无用的 events 请求，再用空判定链伪造决策记录，抽屉永远提示「逐链未返回」。改为直接用行数据展示真实事件摘要（决策、命中规则、操作者、说明），并明确提示历史事件不持久化逐链明细；派单完成后的解释仍展示完整链路与位次变更。
  - 终态操作加确认：事件的「完成 / 取消」增加二次确认，置顶释放、事件操作按钮在请求进行中禁用，防止连点重复提交。
  - 派单抽屉状态残留：派单成功后仅重置步骤、未清空执行者 / 队列 / 任务选择，下次打开会带入旧值。改为成功后完整重置，并让「选择执行者」时按其主队列预填来源队列（仅在启用队列中），确认页展示更清晰。
  - 事件表操作列固定到右侧并允许换行，避免窄屏贴边裁切。
- **门店切换器顶栏错位**：`.app-header`（Ant Design `Layout.Header`）自带约 72px 行高，子元素继承后把「当前工作区」标签与日期各撑到 72px，导致 `.header-context` 高达 110px、溢出 66px 顶栏并把切换器挤到贴底。给顶栏显式 `line-height: normal` 断开继承，并将切换器改为单行紧凑布局（标签 + 门店名同行、宽度 200px），与日期、账号菜单对齐。仅视觉修复，不改变门店切换的客户端语义与任何契约。

### 变更

- **队列页第三种视图（矩阵视图）**：视图切换器扩为三项——在「队列视图」（横向泳道 / 组内竖向卡片）与「人员视图」（人员网格）之外，新增「矩阵视图」：队列按 `seq` 纵向堆叠为分组，每组内服务人员横向排成一行卡片（队列视图的转置呈现）。复用既有队列详情、在岗切换、行内排序与分配弹窗，不改端点 / 权限 / 门店上下文 / 幂等与缓存协议；ADR-0002 决策 8 同步。
- **队列页双视图**：新增 Segmented 视图切换——「队列视图」保留横向泳道（队列多、服务员少），「人员视图」按人员卡片网格展示头像 / 姓名 / 工号 / 在职与在岗状态 / 所属队列胶囊（服务员多、队列少），并支持在岗筛选与姓名 / 工号搜索；人员视图可在卡片上切换在岗状态、勾选所属队列，均复用既有端点。两视图共享统计条与门店作用域缓存失效；ADR-0002 决策 7 同步。
- **统一视觉设计系统**：新增 `src/theme.ts`（Ant Design token 与组件主题）与 CSS 设计令牌，统一森林绿 / 暖灰配色、圆角、阴影与排版；重构应用外壳为深色侧栏 + 吸顶顶栏（门店切换器、日期、账号菜单），新增 `PageHeader` 统一页面标题与操作区；登录页改为品牌介绍 + 表单的双栏布局。业务页面同步美化：队列看板增加统计条、队列泳道配色、在岗胶囊与虚线「新建队列」磁贴；服务人员与门店列表改为卡片网格（当前门店高亮）；商品目录改为统计条 + 精修表格；门店设置改为分段表单。仅视觉与交互呈现变化，API、权限、门店上下文、幂等与缓存协议不变。
- **在岗状态与队列内排序（对齐后端 ADR-0010）**：服务人员列表新增在岗 / 下班标记与切换按钮（`PATCH /staff/{id}` 带 `duty_status` + `version`）；队列小卡片显示在岗标记、下班弱化；卡片支持拖拽重排并提供上移 / 下移按钮，统一调用 `PUT /queues/{queueId}/staff/order` 提交全量有序 `staff_ids`，失败回滚并重取。ADR-0002 决策 2 / 3 同步。
- **登录后落地页修正**：`LoginPage` 提交成功后跳转 `/queues`，与 ADR-0002「主页默认队列」及 `App.tsx` 的 `/` 重定向保持一致；此前跳到 `/shops` 是漏改。
- **队列页改为横向看板**：队列按 `seq` 从左到右以列展示（不再是表格列表），每列内的服务人员改为小卡片（头像首字 + 姓名，可见工号时附带）；每列详情按店作用域 query key 独立拉取，分配变更后统一失效重取；ADR-0002 决策 2 同步。
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
