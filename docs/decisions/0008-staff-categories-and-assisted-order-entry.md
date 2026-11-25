# ADR-0008 · 服务人员分类与开单辅助选人

- 状态：Accepted（2026-11-24；2026-11-25 布局复核，仅调整前端展示与文案）
- 对齐后端：[ADR-0024](../../../porch-os/docs/decisions/0024-staff-categories-and-assisted-order-entry.md)，前端承接其服务人员分类、目录项分组与开单辅助选人契约
- 影响：新增 `src/api/staffCategories.ts`、扩展 `src/api/types.ts` / `src/api/queues.ts` / `src/api/catalog.ts`；新增 `src/components/StaffPickerModal.tsx`；改造 `src/components/OrderEntryModal.tsx` 与 `src/pages/StaffPage.tsx`；同步 `src/shop/orderStaff.ts` 与样式

## 背景

后端 ADR-0024 给服务人员增加店内分类（一人最多一个），并给目录项增加全局分组。用户同时要求在开单弹窗提供按服务员添加服务的入口；经 2026-11-25 布局复核，点击后打开的页面对齐最新截图：上方是执行人下拉与服务分组单选，中部是项目分类页签，下方是带「添加」操作的服务项表格。

前端此前只有两条路径：

- 服务人员页：卡片 + 资质维护（前端 ADR-0007）；
- 开单弹窗：先用项目下拉框加明细，再在每行下拉框选执行服务员。

缺少「先按分类选人，再连续把该服务员的多个服务项加入购物车」的批量交互。

## 决策

### 1. 数据与 API

- 新增 `StaffCategoryRef` / `StaffCategory` / `CreateStaffCategoryRequest` / `UpdateStaffCategoryRequest` 类型。
- `Staff` / `StaffSummary` / `StaffDetail` 增量 `category: StaffCategoryRef | null`。
- `CatalogItem` 增量 `category_public_id` / `category_name`（可空）。
- `UpdateStaffRequest` 增量 `category_public_id?: string | null`；`staffApi` 复用既有 `update()`，不新增改派端点。
- `staffCategoriesApi` 提供 `list` / `create` / `update`，写操作沿用统一 `Idempotency-Key` 注入。
- 服务人员分类读用 `queue.read`，写用 `queue.write`；服务项分类只读复用 `catalogApi.categories()`。

### 2. 服务人员页

- 卡片显示分类名（无分类显示「未分类」）。
- 卡片底部新增「分类」按钮，打开单选弹窗；只列 `status='active'` 的分类，可清空。
- 保存走 `PATCH /staff/{staffId}`，携带当前 `version`；成功后刷新服务人员列表与详情缓存。
- 分类定义通过同一个弹窗里的轻输入框创建（`POST /staff-categories`），不另开页面。

### 3. 开单弹窗「添加服务员」

> 2026-11-25 布局复核：按新参考图收敛为「单行工具栏 + 项目页签 + 六列表格」。本调整只改前端布局与文案，不改变 ADR-0024 的 schema / 端点契约。弹窗标题为「添加项目」。

- 「明细」区标题旁同时显示 **添加服务员** 与 **添加服务** 两个按钮，与项目下拉框并列；两者都打开同一个 `StaffPickerModal`，便于从人员或服务任一入口进入相同工作流。
- 点击打开 `StaffPickerModal`，标题为「添加项目」：
  - 顶部一行为「执行服务员」下拉框与「服务分组」单选组；下拉只列 `status='active'` 的服务员，标签含姓名、工号、分类；单选项来自 `staffCategoriesApi.list(shopId)`，含「全部」，切换后清空不再可选的执行人。
  - 「服务分组」只过滤可选人员，不把分类当作资质或授权来源。
  - 中部为项目分类页签，来自 `catalogApi.categories()`，含「全部项目」；页签切换只过滤表格。
  - 表格列为编号 / 项目名 / 服务类型 / 持续时间 / 价格 / 操作；只列 `type='service' && active` 的目录项。「服务类型」由目录项类型投影，不新增 schema 字段；「添加」按钮在未选服务员或该服务员无资质时禁用。
- 点「添加」时把 `{ item, quantity: 1, staffId: selected.public_id }` 追加到购物车；弹窗保持打开，允许连续添加；同一项目允许重复添加形成多条明细。
- 关闭弹窗后，购物车每行仍可改派执行服务员；`staffMissing` 与提交禁用规则不变。
- 分类筛选只是**收窄可选项**，不改变 ADR-0007 的资格规则：`qualifiedStaffForItem()` 仍只按 `status='active'` 与 `service_item_ids` 过滤，不按 `duty_status` / `state` 过滤。

### 4. 术语与脱钩

公开仓库不出现参考截图中的行业专属称谓。界面统一使用「服务人员」「分类」「状态」「执行服务员」「绩效」等通用词；参考图只作为布局与交互顺序依据，不复制其文案。

## 备选方案

| 议题 | 采用 | 不选另一方案的原因 |
|---|---|---|
| 分类筛选位置 | 前端过滤 `GET /staff` 结果 | 新增专用查询端点会多一套投影；服务人员数量小，本地过滤足够 |
| 服务项分组来源 | `catalog_items.category_public_id` | 用 SKU 前缀或自由文本不可维护，也无法复用既有目录分类 |
| 选人弹窗状态 | 单选服务员 + 多次添加服务项 | 一次选多人会让一行服务明细出现多个执行人，违反 ADR-0023 |
| 分类维护入口 | 服务人员卡片上的单选弹窗 | 另建分类管理页增加导航成本，且本期只有「绑定一个分类」一个动作 |

## 后果

- 新增一个选人弹窗组件，但复用现有查询缓存，不产生 N+1。
- 服务人员卡片增加分类按钮；资质按钮（ADR-0007）与分类按钮并列，均需 `stopPropagation`，避免触发卡片操作菜单。
- 状态筛选只影响弹窗展示，不写服务端、不影响授权与派单。
- 验收：typecheck / lint / 单测 / build 全绿；浏览器实测分类筛选、状态筛选、选人后添加、无资质禁用、重复添加、购物车改派；1440 / 1024 无横向溢出；脱钩词扫描零命中。
