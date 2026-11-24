# ADR-0007: 服务项资质维护与开单执行服务员

- 状态：已接受（2026-11-24）
- 决策问题：后端 [ADR-0023](https://github.com/WeijianHuang/porch-os/blob/main/docs/decisions/0023-service-item-qualifications-and-line-staff.md) 引入「服务员可做哪些服务项」与「每条服务明细由谁执行」两层关系，前端需要在人员页维护资质，并在开单弹窗里为服务明细选人
- 影响范围：`StaffPage` 卡片增加服务项资质入口、`OrderEntryModal` 购物车增加执行服务员列、`OrderContextPanel` 显示与改派执行人；`staffApi` / `ordersApi` 补端点；新增纯函数 `src/shop/orderStaff.ts` 与单测；修订 [ADR-0006](0006-room-card-order-entry.md) §3 的「弹窗四件事」

## 背景

ADR-0006 把「点房间开单」做成最短闭环：房间、ID 卡、明细、提交四件事。那时尚未落地服务人员归属，购物车只存 `catalog_item_id` + `quantity`，订单详情也没有执行人。后端 ADR-0023 落地后，服务端会做三处校验：授予资质时只允许 `type='service'`；加明细时商品行不允许带人、服务行带人必须有资质；提交时每条服务行必须有**仍然合格且未停用**的服务员。如果前端不先过滤，用户只能在最后一步收到 `422 ORDER_LINE_STAFF_REQUIRED`。

业务同时要求「服务员需要绑定服务」包含两层：建档时维护资质，开单时记录真人。这两层缺一不可——只维护资质无法回答「这单是谁做的」，只记录执行人无法在选人时排除没有资质的人。

## 决策

1. **资质在人员卡上维护，全量替换**。每张服务人员卡底部新增「服务项 N」按钮，仅 `queue.write` 可见。点开后多选**启用中的服务目录项**，保存调用 `PUT /staff/{staffId}/service-items`，请求体为 `{catalog_item_ids, version}`（全量替换）。不提供逐项增删端点，也不允许给商品项授权；后端拒绝非服务项与版本冲突，前端把错误直接呈现。卡片点击仍打开原有操作菜单，资质按钮 `stopPropagation`，不与菜单冲突。

2. **开单购物车按行选执行服务员**。服务项目的下拉选项加「需服务员」标记；购物车对 `type='service'` 的行显示执行服务员选择框，选项由该行的 `catalog_item_id` 过滤 `staff.service_item_ids` 得到，只保留 `status='active'` 的人员；商品行显示「—」，不渲染选择框。`duty_status` / `executor_state` 只在标签上提示「在岗 / 离岗」，**不作为过滤条件**——后端 ADR-0023 也不按调度态拒绝，避免把人工状态和历史单据耦合。

3. **缺人在购物车阶段就拦截**。只要任一服务行未选人，「开单（提交）」按钮禁用；`createOrder` 的 mutation 里再判一次并给出明确提示，防止禁用状态被绕过。提交链路仍是「建单 → 逐条加明细（带 `staff_public_id`）→ 回读快照求和 → submit」，金额口径不变。

4. **走同一个资质真源，不做第二套缓存**。资质随 `GET /staff` 的 `service_item_ids[]` 一次返回，开单弹窗与人员页共用 `queryKeys.staff(shopId)`；保存资质后失效该键与 `staffDetail`。没有新增 query key，也没有本地资质偏好。

5. **订单详情显示与改派**。`OrderContextPanel` 增加「服务执行人」区块：按明细行显示当前执行人；已结单只读，显示姓名快照；未结单且可写时提供有资质人员下拉与「改派」按钮，调用 `PUT /orders/{id}/lines/{lineNo}/staff`。删除服务员后 `staff_id` 为空但快照保留，界面显示「历史：姓名」并提示未指定，引导改派。

6. **不新增权限、不改门店切换协议**。资质维护用 `queue.write`，改派与开单用 `order.write`，读取用 `queue.read` / `order.read`；所有单店请求经共享 client 注入 `X-Shop-Id` 与写幂等键，门店切换沿用既有失效规则。

## 备选方案（不采用）

- **把资质做成服务人员新建表单的一部分**：建档时往往还不知道要负责哪些项目，且项目会增减；独立入口可随时维护，也不阻塞建档。
- **购物车里给全店服务员列表不过滤**：会把无资质人员暴露给用户，提交必被后端拒绝；过滤在纯函数里做，前后端规则一致。
- **前端按 `duty_status='on'` 再过滤**：后端不拒绝离岗人员，前端额外收紧会造成「明明有人却选不到」，且人工改状态与订单历史互相耦合。
- **一条服务明细多选服务员**：后端只支持一人；多人协作须拆成两条明细，界面不做无法落库的假多选。
- **改派走整单提交而不是明细端点**：会让已经落库的价格快照与让利重算，风险远大于只改一列。

## 影响

- `api/types.ts`：`StaffSummary` / `StaffDetail` 增 `service_item_ids`，`OrderLine` 增 `staff_public_id` / `staff_name_snapshot`，新增 `SetStaffServiceItemsRequest`。
- `api/queues.ts`：`staffApi.serviceItems` / `setServiceItems`；`api/orders.ts`：`addLine` 增加可选 `staffPublicId`，新增 `setLineStaff`。
- 新增 `src/shop/orderStaff.ts`（`qualifiedStaffForItem` / `isServiceItem` / `missingServiceStaffLines`）与 5 个单测；校验逻辑是纯函数，不依赖组件状态。
- 本次不新增页面、不新增路由；首页 `/home` 的只读边界不变（唯一写入口仍是房间卡开单弹窗）。
