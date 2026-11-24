/** Order context bindings (porch-os ADR-0022): one card, one room and at most
 * one companion group per order.
 *
 * A companion group is not a payment subject — the panel only merges/splits
 * orders and shows read-only totals. Payments stay on each order, so nothing
 * here charges anything.
 *
 * A room is attribution, not a lock: several guests in one room may hold
 * separate orders, and whether they pay separately or together is decided by
 * membership in a group, never by the room.
 */
import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApartmentOutlined, IdcardOutlined, TeamOutlined } from '@ant-design/icons'
import { Button, Modal, Select, Space, Table, Tag, Tooltip, message } from 'antd'
import { cardsApi } from '../api/cards'
import { catalogApi } from '../api/catalog'
import { companionGroupsApi } from '../api/companionGroups'
import { ordersApi } from '../api/orders'
import { roomsApi } from '../api/rooms'
import { staffApi } from '../api/queues'
import { queryKeys } from '../api/keys'
import type { CompanionGroup, CatalogItem, Order } from '../api/types'
import { isServiceItem, qualifiedStaffForItem } from '../shop/orderStaff'
import { formatCNY } from '../utils/money'

/** Binding is possible only while the order is unsettled (ADR-0022 §2). */
const EDITABLE_STATUS = new Set(['draft', 'open', 'pending_payment'])

const GROUP_STATUS: Record<string, { label: string; color: string }> = {
  open: { label: '进行中', color: 'processing' },
  closed: { label: '已关闭', color: 'default' },
  cancelled: { label: '已取消', color: 'error' },
}

const RELEASE_REASON: Record<string, string> = {
  settled: '已结算释放',
  cancelled: '已取消释放',
  unbound: '已手动解绑',
  replaced: '已换卡',
}

/** uuidv7 starts with a timestamp, so same-day groups share their first
 * characters. The tail is what actually distinguishes them in a list. */
function groupTag(value: string): string {
  return value.replace(/-/g, '').slice(-6).toUpperCase()
}

export default function OrderContextPanel({
  shopId, order, canWrite, onChanged,
}: {
  shopId: string
  order: Order
  canWrite: boolean
  onChanged: () => void
}) {
  const queryClient = useQueryClient()
  const [cardPick, setCardPick] = useState<string | undefined>()
  const [cardOpen, setCardOpen] = useState(false)
  const [roomPick, setRoomPick] = useState<string | undefined>()
  const [roomOpen, setRoomOpen] = useState(false)
  const [groupPick, setGroupPick] = useState<string | undefined>()
  const [groupOpen, setGroupOpen] = useState(false)
  // ADR-0023: draft values for reassigning a service line's executor.
  const [lineStaff, setLineStaff] = useState<Record<number, string>>({})

  const editable = canWrite && EDITABLE_STATUS.has(order.status)
  const groupId = order.companion_group?.public_id

  const cardsQ = useQuery({
    queryKey: queryKeys.cards(shopId),
    queryFn: () => cardsApi.list(shopId),
    enabled: cardOpen,
  })
  const roomsQ = useQuery({
    queryKey: queryKeys.rooms(shopId),
    queryFn: () => roomsApi.list(shopId),
    enabled: roomOpen,
  })
  const openGroupsQ = useQuery({
    queryKey: queryKeys.companionGroups(shopId, 'open'),
    queryFn: () => companionGroupsApi.list(shopId, { status: 'open', limit: 50 }),
    enabled: groupOpen,
  })
  const groupDetailQ = useQuery({
    queryKey: queryKeys.companionGroup(shopId, groupId ?? ''),
    queryFn: () => companionGroupsApi.get(shopId, groupId!),
    enabled: Boolean(groupId),
  })
  const catalogQ = useQuery({
    queryKey: queryKeys.catalog,
    queryFn: () => catalogApi.list(),
    enabled: Boolean(order.lines?.length),
  })
  const staffQ = useQuery({
    queryKey: queryKeys.staff(shopId),
    queryFn: () => staffApi.list(shopId),
    enabled: editable && Boolean(order.lines?.length),
  })
  const catalogById = new Map((catalogQ.data?.data ?? []).map((item) => [item.public_id, item]))
  const serviceLines = (order.lines ?? []).filter((line) =>
    isServiceItem(catalogById.get(line.catalog_item_id) as CatalogItem | undefined))
  useEffect(() => {
    const initial: Record<number, string> = {}
    for (const line of order.lines ?? []) {
      if (line.staff_public_id) initial[line.line_no] = line.staff_public_id
    }
    setLineStaff(initial)
  }, [order.lines])

  const afterContext = (text: string) => {
    message.success(text)
    onChanged()
    void queryClient.invalidateQueries({ queryKey: queryKeys.cards(shopId) })
  }

  const bindCard = useMutation({
    mutationFn: (cardPublicId: string) => ordersApi.bindCard(shopId, order.public_id, cardPublicId, order.version),
    onSuccess: () => { setCardOpen(false); setCardPick(undefined); afterContext('卡已绑定') },
    onError: (e) => message.error((e as Error).message || '绑定失败'),
  })
  const unbindCard = useMutation({
    mutationFn: () => ordersApi.unbindCard(shopId, order.public_id, order.version),
    onSuccess: () => afterContext('已解绑（未释放人员持卡）'),
    onError: (e) => message.error((e as Error).message || '解绑失败'),
  })
  const bindRoom = useMutation({
    mutationFn: (roomPublicId: string) => ordersApi.bindRoom(shopId, order.public_id, roomPublicId, order.version),
    onSuccess: () => { setRoomOpen(false); setRoomPick(undefined); afterContext('房间已绑定') },
    onError: (e) => message.error((e as Error).message || '绑定失败'),
  })

  const reassignStaff = useMutation({
    mutationFn: (lineNo: number) => ordersApi.setLineStaff(
      shopId, order.public_id, lineNo, lineStaff[lineNo] ? lineStaff[lineNo] : null,
    ),
    onSuccess: () => { afterContext('执行服务员已更新') },
    onError: (e) => message.error((e as Error).message || '改派失败'),
  })

  const refreshGroup = () => {
    onChanged()
    void queryClient.invalidateQueries({ queryKey: queryKeys.companionGroups(shopId) })
    if (groupId) void queryClient.invalidateQueries({ queryKey: queryKeys.companionGroup(shopId, groupId) })
  }

  const createGroup = useMutation({
    mutationFn: () => companionGroupsApi.create(shopId, { order_public_ids: [order.public_id] }),
    onSuccess: () => { setGroupOpen(false); refreshGroup(); message.success('已建立同行组') },
    onError: (e) => message.error((e as Error).message || '建组失败'),
  })
  const joinGroup = useMutation({
    mutationFn: ({ target, version }: { target: string; version: number }) =>
      companionGroupsApi.join(shopId, target, [order.public_id], version),
    onSuccess: () => { setGroupOpen(false); setGroupPick(undefined); refreshGroup(); message.success('已合并到同行组') },
    onError: (e) => message.error((e as Error).message || '合并失败'),
  })
  const leaveGroup = useMutation({
    mutationFn: (version: number) => companionGroupsApi.leave(shopId, groupId!, order.public_id, version),
    onSuccess: () => { refreshGroup(); message.success('已拆出，订单恢复独立') },
    onError: (e) => message.error((e as Error).message || '拆出失败'),
  })
  const closeGroup = useMutation({
    mutationFn: (version: number) => companionGroupsApi.close(shopId, groupId!, version),
    onSuccess: () => { refreshGroup(); message.success('同行组已关闭') },
    onError: (e) => message.error((e as Error).message || '关闭失败'),
  })

  const group: CompanionGroup | null = groupId ? groupDetailQ.data?.data ?? null : null
  // Only cards that can actually be bound: active, held by a staff member, and
  // not occupied by another active order (ADR-0022 §2).
  const cardOptions = (cardsQ.data?.data ?? [])
    .filter((c) => c.status === 'active' && c.holder && !c.bound_order)
    .map((c) => ({ value: c.public_id, label: `${c.code} · ${c.name}（${c.holder?.display_name}）` }))
  const roomOptions = (roomsQ.data?.data ?? [])
    .filter((r) => r.status === 'active')
    .map((r) => ({ value: r.public_id, label: `${r.floor}F · ${r.code} ${r.name}` }))
  const groupOptions = (openGroupsQ.data?.data ?? [])
    .filter((g) => g.public_id !== groupId)
    .map((g) => ({ value: g.public_id, label: `#${groupTag(g.public_id)} · ${g.status}` }))

  const targetGroup = (openGroupsQ.data?.data ?? []).find((g) => g.public_id === groupPick)

  return (
    <div className="order-context">
      <div className="panel-head"><h3>单据上下文</h3></div>

      <div className="context-row">
        <span className="context-icon"><IdcardOutlined /></span>
        <div className="context-body">
          <div className="context-label">ID 卡</div>
          {order.card ? (
            <div className="context-value">
              <Tag color="blue">{order.card.code}</Tag>{order.card.name}
            </div>
          ) : order.card_binding_history ? (
            <div className="context-value muted">
              已释放 · {RELEASE_REASON[order.card_binding_history.reason] ?? order.card_binding_history.reason}
              （{order.card_binding_history.card.code}）
            </div>
          ) : (
            <div className="context-value muted">未绑定，提交前必须绑定</div>
          )}
        </div>
        {editable ? (
          <Space size={4}>
            <Button size="small" onClick={() => setCardOpen(true)}>{order.card ? '换卡' : '绑卡'}</Button>
            {order.card ? (
              <Button size="small" onClick={() => unbindCard.mutate()} loading={unbindCard.isPending}>
                解绑
              </Button>
            ) : null}
          </Space>
        ) : null}
      </div>

      <div className="context-row">
        <span className="context-icon"><ApartmentOutlined /></span>
        <div className="context-body">
          <div className="context-label">房间</div>
          {order.room ? (
            <div className="context-value">
              <Tag>{order.room.floor}F</Tag>{order.room.code} {order.room.name}
            </div>
          ) : (
            <div className="context-value muted">未绑定，提交前必须绑定</div>
          )}
        </div>
        {editable ? (
          <Button size="small" onClick={() => setRoomOpen(true)}>{order.room ? '换房' : '绑房'}</Button>
        ) : null}
      </div>

      {serviceLines.length ? (
        <div className="context-staff">
          <div className="context-label">服务执行人（ADR-0023）</div>
          {serviceLines.map((line) => {
            const item = catalogById.get(line.catalog_item_id)
            const options = qualifiedStaffForItem(staffQ.data?.data ?? [], line.catalog_item_id)
              .map((person) => ({
                value: person.public_id,
                label: `${person.display_name} · ${person.code}`,
              }))
            return (
              <div className="context-staff-line" key={line.line_no}>
                <span>
                  #{line.line_no} {item?.name ?? line.item_name_snapshot}
                  {!line.staff_public_id && !line.staff_name_snapshot ? <em> · 未指定</em> : null}
                </span>
                {!line.staff_public_id && line.staff_name_snapshot ? (
                  <span className="muted">历史：{line.staff_name_snapshot}</span>
                ) : null}
                {editable ? (
                  <Space size={4}>
                    <Select
                      size="small"
                      style={{ width: 180 }}
                      value={lineStaff[line.line_no] ?? undefined}
                      onChange={(value) => setLineStaff((prev) => ({ ...prev, [line.line_no]: value }))}
                      options={options}
                      placeholder="有资质的服务员"
                      showSearch
                      optionFilterProp="label"
                      notFoundContent="暂无有资质的服务员"
                    />
                    <Button
                      size="small"
                      loading={reassignStaff.isPending}
                      onClick={() => reassignStaff.mutate(line.line_no)}
                    >
                      改派
                    </Button>
                  </Space>
                ) : (
                  <span>{line.staff_name_snapshot ?? '—'}</span>
                )}
              </div>
            )
          })}
        </div>
      ) : null}

      <div className="context-row">
        <span className="context-icon"><TeamOutlined /></span>
        <div className="context-body">
          <div className="context-label">同行组（合并 / 拆分结算）</div>
          {order.companion_group ? (
            <div className="context-value">
              <Tooltip title={order.companion_group.public_id}>
                <Tag color={GROUP_STATUS[order.companion_group.status]?.color ?? 'default'}>
                  {GROUP_STATUS[order.companion_group.status]?.label ?? order.companion_group.status}
                </Tag>
              </Tooltip>
              <span className="muted">#{groupTag(order.companion_group.public_id)}</span>
            </div>
          ) : (
            <div className="context-value muted">未加入，本单独立结算</div>
          )}
        </div>
        {editable ? (
          <Space size={4}>
            {order.companion_group ? (
              <>
                <Button
                  size="small"
                  onClick={() => leaveGroup.mutate(group?.version ?? 0)}
                  loading={leaveGroup.isPending}
                  disabled={!group || order.companion_group.status !== 'open'}
                >
                  拆出
                </Button>
                <Button
                  size="small"
                  onClick={() => closeGroup.mutate(group?.version ?? 0)}
                  loading={closeGroup.isPending}
                  disabled={!group || order.companion_group.status !== 'open'}
                >
                  关闭组
                </Button>
              </>
            ) : (
              <>
                <Button size="small" onClick={() => createGroup.mutate()} loading={createGroup.isPending}>
                  建组
                </Button>
                <Button size="small" onClick={() => setGroupOpen(true)}>合入已有组</Button>
              </>
            )}
          </Space>
        ) : null}
      </div>

      {group ? (
        <div className="context-group">
          <div className="context-group-totals">
            <span>组内成员 <strong>{group.members?.length ?? 0}</strong></span>
            <span>应付合计 <strong>{formatCNY(group.payable_total ?? '0.00')}</strong></span>
            <span>已付合计 <strong>{formatCNY(group.paid_total ?? '0.00')}</strong></span>
          </div>
          <Table
            className="data-table"
            rowKey="order_public_id"
            size="small"
            pagination={false}
            dataSource={group.members ?? []}
            columns={[
              { title: '单号', dataIndex: 'order_no', render: (v: string) => <span className="cell-money">{v}</span> },
              { title: '状态', dataIndex: 'status', width: 100 },
              {
                title: '应付', dataIndex: 'payable_amount', width: 90, align: 'right',
                render: (v: string) => <span className="cell-money">{formatCNY(v)}</span>,
              },
            ]}
          />
          <p className="muted">合计为只读派生；付款仍逐单在各订单上完成。</p>
        </div>
      ) : null}

      <Modal
        title={order.card ? '更换 ID 卡' : '绑定 ID 卡'}
        open={cardOpen}
        onCancel={() => setCardOpen(false)}
        onOk={() => cardPick && bindCard.mutate(cardPick)}
        confirmLoading={bindCard.isPending}
        okButtonProps={{ disabled: !cardPick }}
        destroyOnHidden
      >
        <Select
          style={{ width: '100%' }}
          placeholder="选择一张已被持有且未被占用的有效卡"
          value={cardPick}
          onChange={setCardPick}
          options={cardOptions}
          loading={cardsQ.isLoading}
          notFoundContent="没有可绑定的卡：卡需生效、已被人员持有且未被其他活跃订单占用"
        />
      </Modal>

      <Modal
        title={order.room ? '更换房间' : '绑定房间'}
        open={roomOpen}
        onCancel={() => setRoomOpen(false)}
        onOk={() => roomPick && bindRoom.mutate(roomPick)}
        confirmLoading={bindRoom.isPending}
        okButtonProps={{ disabled: !roomPick }}
        destroyOnHidden
      >
        <Select
          style={{ width: '100%' }}
          placeholder="选择房间"
          value={roomPick}
          onChange={setRoomPick}
          options={roomOptions}
          loading={roomsQ.isLoading}
          showSearch
          optionFilterProp="label"
          notFoundContent="该门店没有可用房间"
        />
        <p className="muted">同一房间可同时挂多张订单：分开买单各自支付，合并买单请加入同一同行组。</p>
      </Modal>

      <Modal
        title="合入已有同行组"
        open={groupOpen}
        onCancel={() => setGroupOpen(false)}
        onOk={() => targetGroup && joinGroup.mutate({ target: targetGroup.public_id, version: targetGroup.version })}
        confirmLoading={joinGroup.isPending}
        okButtonProps={{ disabled: !targetGroup }}
        destroyOnHidden
      >
        <Select
          style={{ width: '100%' }}
          placeholder="选择一个进行中的同行组"
          value={groupPick}
          onChange={setGroupPick}
          options={groupOptions}
          loading={openGroupsQ.isLoading}
          notFoundContent="没有进行中的同行组，可先建组"
        />
        <p className="muted">若本单已在其他组，会在同一事务里从原组移出；原组无成员则自动关闭。</p>
      </Modal>
    </div>
  )
}
