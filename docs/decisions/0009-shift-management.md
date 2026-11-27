# ADR-0009 · 班次管理

- 状态：Accepted（2026-11-27）
- 对齐后端：[ADR-0025](../../../porch-os/docs/decisions/0025-staff-shift-templates.md)，前端承接其班次模板、`staff.shift_template` 投影与全量分配契约
- 影响：新增 `src/api/shiftTemplates.ts`、`src/pages/ShiftTemplatesPage.tsx`；扩展 `src/api/types.ts` / `src/api/keys.ts` / `src/App.tsx` / `src/components/AppShell.tsx` / `src/styles.css`

## 背景

用户要求新增班次管理页面，并给出列表参考图：班次名、上班时间、下班时间、前置上班打卡时间、次日是否打头牌，操作含编辑 / 删除 / 分配；同时明确一个服务人员只能加入一个班次。

后端 ADR-0025 用 `shift_templates`（模板）与订单域 `shifts`（营业班次实例）分离，服务人员侧用标量 `shift_template_id` 保证「一人一班」。前端此前没有班次模板的展示与维护入口。

## 决策

### 1. 数据与 API

- 新增 `ShiftTemplateRef` / `ShiftTemplate` / `CreateShiftTemplateRequest` / `UpdateShiftTemplateRequest` / `AssignShiftTemplateStaffRequest` 类型。
- `Staff` / `StaffSummary` / `StaffDetail` 增量 `shift_template: ShiftTemplateRef | null`。
- `shiftTemplatesApi` 提供 `list` / `create` / `update` / `remove` / `assignStaff`，全部带 shopId；写操作沿用统一 `Idempotency-Key` 注入。
- 查询用 `queue.read`、维护用 `queue.write`；不新增权限点。
- 查询键 `queryKeys.shiftTemplates(shopId)` 与 `queryKeys.staff(shopId)` 同属 `shop-scope` 前缀，切店时统一失效与取消在途请求。

### 2. 页面与交互

- 导航新增「班次管理」，路由 `/shift-templates`，页面标题「班次管理」。
- 页面主体为单张表格：班次名 / 上班时间 / 下班时间 / 前置上班打卡时间 / 次日标记 / 操作（编辑、删除、分配服务人员）；右上角为「新增班次」按钮。列顺序与参考图一致。
- 新增 / 编辑用同一弹窗：班次名、上班时间、下班时间（`HH:MM`）、提前打卡分钟数（`0..1440`）、次日标记开关、展示顺序。编辑携带 `version`，冲突提示刷新后重试。
- 删除先确认，成功后刷新列表与服务人员缓存；后端会把该班次成员解绑为「未分配班次」。
- 「分配服务人员」弹窗列出本店服务人员，显示姓名、工号、当前班次，可多选；提交为 `PUT /shift-templates/{id}/staff` 全量替换，因此必须回显当前成员，漏传即解绑。跨班次改派由服务端同事务替换，一人一班始终成立。

### 3. 文案与边界

- 公开仓库统一使用「服务人员」「班次」「分配服务人员」「次日标记」，不引入参考图中的行业专属称谓。
- 「前置上班打卡时间」以分钟数展示，不做打卡、提醒、考勤判定。
- 「次日标记」仅为布尔展示字段，不实现头牌、排位或绩效规则，不参与调度与金额。
- 本页不读写营业班次实例（`GET /shifts/current` 等），也不改开单弹窗的执行服务员选择逻辑。

## 后果

班次管理页与「服务人员」页共享 `GET /staff` 数据，但两者职责不同：前者维护班次模板与成员，后者维护人员档案、分类、资质与状态。任一页面写成功后同时失效两份缓存，避免当前班次显示滞后。
