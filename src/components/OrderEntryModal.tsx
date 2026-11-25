/** Order entry from a room card (frontend ADR-0005 amendment).
 *
 * Opening an order is the one write the home page is allowed to start, and it
 * only starts it: the modal collects a room, a card and a cart, then hands the
 * work to the same endpoints the order pages use. Nothing is priced on the
 * client — the total shown as 预计 is an estimate, and the submitted
 * total_amount is read back from the server's line snapshots, because submit
 * compares the two as exact decimals (design/03 §8).
 *
 * A room is not a lock (ADR-0022): opening a second order on the same room is
 * allowed, and this modal says so instead of blocking it.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DeleteOutlined, IdcardOutlined, PlusOutlined } from '@ant-design/icons'
import { Alert, Button, InputNumber, Modal, Select, Space, Table, Tag, Tooltip, message } from 'antd'
import { useNavigate } from 'react-router-dom'
import { cardsApi } from '../api/cards'
import { catalogApi } from '../api/catalog'
import { ordersApi } from '../api/orders'
import { roomsApi } from '../api/rooms'
import { staffApi } from '../api/queues'
import { queryKeys } from '../api/keys'
import type { CatalogItem, Order, PaymentMethod, Room, StaffSummary } from '../api/types'
import { isServiceItem, qualifiedStaffForItem } from '../shop/orderStaff'
import { floorLabel } from '../shop/roomGroup'
import { formatCNY, lineAmount, sumAmounts } from '../utils/money'
import StaffPickerModal from './StaffPickerModal'

interface CartLine {
  key: string
  item: CatalogItem
  quantity: number
  /** ADR-0023: executor of a service line; product lines leave it empty. */
  staffId?: string
}

const PAY_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: '现金' },
  { value: 'card', label: '刷卡' },
]

export default function OrderEntryModal({
  open, shopId, room, onClose, onCreated,
}: {
  open: boolean
  shopId: string
  /** Room clicked on the home page; prefilled but still switchable. */
  room: Room | null
  onClose: () => void
  onCreated: () => void
}) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [step, setStep] = useState<'entry' | 'done' | 'draft'>('entry')
  const [failure, setFailure] = useState<string | null>(null)
  const [roomId, setRoomId] = useState<string | undefined>()
  const [cardId, setCardId] = useState<string | undefined>()
  const [itemId, setItemId] = useState<string | undefined>()
  const [cart, setCart] = useState<CartLine[]>([])
  const [created, setCreated] = useState<Order | null>(null)
  const [payOpen, setPayOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [method, setMethod] = useState<PaymentMethod>('cash')
  // Set as soon as POST /orders returns. onError must read it from a ref:
  // setCreated lands in the next render, so the mutation's own closure would
  // still see null and silently drop the "draft already exists" hint.
  const draftRef = useRef<Order | null>(null)

  // A fresh room click always starts a fresh order: reusing the previous cart
  // would silently bill the next guest for the previous guest's items.
  useEffect(() => {
    if (!open) return
    setStep('entry')
    setCreated(null)
    setFailure(null)
    draftRef.current = null
    setCart([])
    setCardId(undefined)
    setItemId(undefined)
    setRoomId(room?.public_id)
    setMethod('cash')
    setPickerOpen(false)
  }, [open, room?.public_id])

  const roomsQ = useQuery({
    queryKey: queryKeys.rooms(shopId),
    queryFn: () => roomsApi.list(shopId),
    enabled: open,
  })
  const cardsQ = useQuery({
    queryKey: queryKeys.cards(shopId),
    queryFn: () => cardsApi.list(shopId),
    enabled: open,
  })
  const catalogQ = useQuery({
    queryKey: queryKeys.catalog,
    queryFn: () => catalogApi.list(),
    enabled: open,
  })
  // ADR-0023: qualification comes from the staff list in one call; each line
  // filters it by its own service item instead of issuing an N+1 request.
  const staffQ = useQuery({
    queryKey: queryKeys.staff(shopId),
    queryFn: () => staffApi.list(shopId),
    enabled: open,
  })

  // A card is bindable only while it is active, held by a staff member and not
  // already occupied by another active order (ADR-0022 §2). Filtering here
  // keeps 409 CARD_NOT_HELD / CARD_BOUND_TO_ORDER off the happy path.
  const cardOptions = (cardsQ.data?.data ?? [])
    .filter((c) => c.status === 'active' && c.holder && !c.bound_order)
    .map((c) => ({
      value: c.public_id,
      label: `${c.code} · ${c.name}（${c.holder?.display_name}）`,
    }))
  const roomOptions = (roomsQ.data?.data ?? [])
    .filter((r) => r.status === 'active')
    .map((r) => ({
      value: r.public_id,
      label: `${floorLabel(r.floor)} · ${r.code} ${r.name}`,
    }))
  const itemOptions = (catalogQ.data?.data ?? [])
    .filter((item) => item.active)
    .map((item) => ({
      value: item.public_id,
      label: `${item.name} · ${formatCNY(item.base_price)}${isServiceItem(item) ? ' · 需服务员' : ''}`,
    }))
  const staffList: StaffSummary[] = staffQ.data?.data ?? []
  const staffOptionsFor = (item: CatalogItem) =>
    qualifiedStaffForItem(staffList, item.public_id).map((person) => ({
      value: person.public_id,
      label: `${person.display_name} · ${person.code}${person.duty_status === 'on' ? '（在岗）' : '（离岗）'}`,
    }))

  const estimate = useMemo(
    () => sumAmounts(cart.map((line) => lineAmount(line.item.base_price, line.quantity))),
    [cart],
  )

  const addItem = (value: string) => {
    const item = (catalogQ.data?.data ?? []).find((i) => i.public_id === value)
    if (!item) return
    setCart((prev) => [...prev, { key: crypto.randomUUID(), item, quantity: 1 }])
    setItemId(undefined)
  }

  // ADR-0024: the picker adds a service line with its executor preselected.
  // It reuses the same cart shape, so the existing per-line editor stays
  // authoritative and the server still revalidates qualifications on submit.
  const addFromPicker = (item: CatalogItem, staffPublicID: string) => {
    setCart((prev) => [
      ...prev,
      { key: crypto.randomUUID(), item, quantity: 1, staffId: staffPublicID },
    ])
  }

  const setQuantity = (key: string, quantity: number | null) => {
    setCart((prev) =>
      prev.map((line) => (line.key === key ? { ...line, quantity: quantity ?? 1 } : line)),
    )
  }

  const setLineStaff = (key: string, staffId: string | undefined) => {
    setCart((prev) =>
      prev.map((line) => (line.key === key ? { ...line, staffId } : line)),
    )
  }

  const invalidateOrderData = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.orders(shopId) })
    void queryClient.invalidateQueries({ queryKey: queryKeys.cards(shopId) })
    onCreated()
  }

  const createOrder = useMutation({
    mutationFn: async () => {
      if (!roomId || !cardId) throw new Error('请先选择房间与 ID 卡')
      if (cart.length === 0) throw new Error('请至少添加一条明细')
      if (staffMissing) throw new Error('请为每条服务明细选择有资质的服务员')
      const order = (await ordersApi.create(shopId, {
        room_public_id: roomId,
        card_public_id: cardId,
      })).data
      // The order exists from here on. If a later step fails we surface its
      // number so the draft is findable instead of silently orphaned.
      setCreated(order)
      draftRef.current = order
      for (const line of cart) {
        await ordersApi.addLine(
          shopId, order.public_id, line.item.public_id, String(line.quantity), line.staffId,
        )
      }
      const detail = (await ordersApi.get(shopId, order.public_id)).data
      const lines = detail.lines ?? []
      if (lines.length === 0) throw new Error('明细未写入，订单仍为草稿')
      // Submit compares decimals exactly, so the total must come from the
      // server's snapshots rather than from the estimate above.
      const total = sumAmounts(lines.map((l) => l.amount))
      return (await ordersApi.submit(shopId, order.public_id, {
        version: detail.version,
        total_amount: total,
        adjustments: [],
      })).data
    },
    onSuccess: (order) => {
      setCreated(order)
      setStep('done')
      message.success(`已开单 ${order.order_no}`)
      invalidateOrderData()
    },
    onError: (error) => {
      const draft = draftRef.current
      const text = (error as Error).message || '开单失败'
      if (!draft) {
        message.error(text)
        return
      }
      // The draft holds this card and room now, so re-submitting the same form
      // would fail with CARD_BOUND_TO_ORDER. Hand the draft back instead.
      setFailure(text)
      setStep('draft')
      invalidateOrderData()
    },
  })

  const settle = useMutation({
    mutationFn: () => ordersApi.pay(shopId, created!.public_id, [
      { method, amount: created!.total_amount },
    ]),
    onSuccess: () => {
      setPayOpen(false)
      message.success('已收款，ID 卡已自动释放')
      invalidateOrderData()
      onClose()
    },
    onError: (error) => message.error((error as Error).message || '收款失败'),
  })

  // ADR-0023: a service line without a qualified executor must not be
  // submitted; the server would answer 422 ORDER_LINE_STAFF_REQUIRED.
  const staffMissing = cart.some((line) => isServiceItem(line.item) && !line.staffId)
  const canSubmit = Boolean(roomId && cardId) && cart.length > 0 && !staffMissing
  const selectedRoom = (roomsQ.data?.data ?? []).find((r) => r.public_id === roomId)

  return (
    <>
      <Modal
        title={step === 'entry' ? '开单' : step === 'done' ? '开单完成' : '开单未完成'}
        open={open}
        onCancel={onClose}
        width={900}
        destroyOnHidden
        maskClosable={false}
        footer={step === 'entry' ? undefined : null}
        okText="开单（提交）"
        cancelText="取消"
        onOk={() => createOrder.mutate()}
        confirmLoading={createOrder.isPending}
        okButtonProps={{ disabled: !canSubmit }}
      >
        {step === 'entry' ? (
          <>
            <div className="entry-context">
              <label className="entry-field">
                <span>房间</span>
                <Select
                  style={{ width: '100%' }}
                  placeholder="选择房间"
                  value={roomId}
                  onChange={setRoomId}
                  options={roomOptions}
                  loading={roomsQ.isLoading}
                  showSearch
                  optionFilterProp="label"
                  notFoundContent="该门店没有可用房间"
                />
              </label>
              <label className="entry-field">
                <span>ID 卡（提交前必绑）</span>
                <Select
                  style={{ width: '100%' }}
                  placeholder="选择一张已被持有且未被占用的有效卡"
                  value={cardId}
                  onChange={setCardId}
                  options={cardOptions}
                  loading={cardsQ.isLoading}
                  showSearch
                  optionFilterProp="label"
                  notFoundContent="没有可绑定的卡：需生效、已被人员持有且未被其他活跃订单占用"
                />
              </label>
            </div>

            <Alert
              type="info"
              showIcon
              className="entry-note"
              message="同一房间可同时挂多张订单"
              description="分开买单时各单独立收款；需要合并买单，请在订单详情里建同行组后一并查看合计。服务明细须选择有资质的服务员，商品明细不绑定。"
            />

            <div className="panel-head entry-lines-head">
              <h4>明细</h4>
              <Space size={8}>
                <Button icon={<PlusOutlined />} onClick={() => setPickerOpen(true)}>
                  添加服务员
                </Button>
                <Button icon={<PlusOutlined />} onClick={() => setPickerOpen(true)}>
                  添加服务
                </Button>
                <Select
                  style={{ width: 320 }}
                  placeholder="搜索项目后加入明细"
                  value={itemId}
                  onChange={addItem}
                  options={itemOptions}
                  loading={catalogQ.isLoading}
                  showSearch
                  optionFilterProp="label"
                  suffixIcon={<PlusOutlined />}
                  notFoundContent="没有可用的目录项"
                />
              </Space>
            </div>

            <Table
              className="data-table"
              rowKey="key"
              size="small"
              pagination={false}
              dataSource={cart}
              locale={{ emptyText: '还没有明细，先在上面选一个项目' }}
              columns={[
                {
                  title: '项目', key: 'name', width: 220,
                  render: (_: unknown, line: CartLine) => (
                    <Space size={6}>
                      <Tag>{line.item.sku}</Tag>
                      <Tooltip title={line.item.name}>
                        <span style={{ maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {line.item.name}
                        </span>
                      </Tooltip>
                    </Space>
                  ),
                },
                {
                  title: '执行服务员', key: 'staff', width: 190,
                  render: (_: unknown, line: CartLine) => isServiceItem(line.item) ? (
                    <Select
                      size="small"
                      style={{ width: '100%' }}
                      placeholder="选择有资质的服务员"
                      value={line.staffId}
                      onChange={(value) => setLineStaff(line.key, value)}
                      options={staffOptionsFor(line.item)}
                      loading={staffQ.isLoading}
                      showSearch
                      optionFilterProp="label"
                      notFoundContent="该服务项暂无有资质的服务员"
                    />
                  ) : (
                    <span>—</span>
                  ),
                },
                {
                  title: '单价', key: 'price', width: 100, align: 'right',
                  render: (_: unknown, line: CartLine) => (
                    <span className="cell-money">{formatCNY(line.item.base_price)}</span>
                  ),
                },
                {
                  title: '数量', key: 'qty', width: 110,
                  render: (_: unknown, line: CartLine) => (
                    <InputNumber
                      min={0.01}
                      step={1}
                      precision={2}
                      value={line.quantity}
                      onChange={(value) => setQuantity(line.key, value)}
                      style={{ width: '100%' }}
                    />
                  ),
                },
                {
                  title: '金额', key: 'amount', width: 110, align: 'right',
                  render: (_: unknown, line: CartLine) => (
                    <span className="cell-money">
                      {formatCNY(lineAmount(line.item.base_price, line.quantity))}
                    </span>
                  ),
                },
                {
                  title: '', key: 'remove', width: 44,
                  render: (_: unknown, line: CartLine) => (
                    <Tooltip title="移除">
                      <Button
                        type="text"
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={() => setCart((prev) => prev.filter((l) => l.key !== line.key))}
                      />
                    </Tooltip>
                  ),
                },
              ]}
            />

            <div className="entry-total">
              <span className="muted">预计合计 · 实际金额以提交时服务端快照为准</span>
              <strong className="cell-money">{formatCNY(estimate)}</strong>
            </div>
          </>
        ) : created ? (
          <div className="entry-done">
            {step === 'draft' ? (
              <Alert
                type="warning"
                showIcon
                message="订单已建立为草稿，但提交未完成"
                description={`${failure ?? '提交失败'}；草稿单 ${created.order_no} 已保存，卡与房间仍绑在它上面。请到订单列表继续处理，或先解绑再重开一单。`}
              />
            ) : (
              <Alert
                type="success"
                showIcon
                message={`已开单，等待收款 ${formatCNY(created.total_amount)}`}
                description="单号与明细已入库；收款完成后 ID 卡会自动释放回人员手上。"
              />
            )}
            <dl className="entry-summary">
              <div><dt>单号</dt><dd className="cell-money">{created.order_no}</dd></div>
              <div><dt>房间</dt><dd>{selectedRoom ? `${selectedRoom.code} ${selectedRoom.name}` : '—'}</dd></div>
              <div>
                <dt>ID 卡</dt>
                <dd>{created.card ? <Tag color="blue">{created.card.code}</Tag> : '—'}</dd>
              </div>
              <div>
                <dt>状态</dt>
                <dd>
                  {step === 'draft'
                    ? <span className="pill plain">草稿</span>
                    : <span className="pill warn">待收款</span>}
                </dd>
              </div>
              <div>
                <dt>{step === 'draft' ? '预计' : '应收'}</dt>
                <dd className="cell-money">
                  {formatCNY(step === 'draft' ? estimate : created.total_amount)}
                </dd>
              </div>
            </dl>
            <div className="entry-done-actions">
              {step === 'draft' ? (
                <>
                  <Button onClick={onClose}>关闭</Button>
                  <Button type="primary" onClick={() => { onClose(); navigate('/orders') }}>
                    去订单列表
                  </Button>
                </>
              ) : (
                <>
                  <Button onClick={onClose}>稍后收款</Button>
                  <Button type="primary" onClick={() => setPayOpen(true)}>
                    立即收款
                  </Button>
                </>
              )}
            </div>
          </div>
        ) : null}
      </Modal>

      <StaffPickerModal
        open={pickerOpen}
        shopId={shopId}
        staff={staffList}
        items={catalogQ.data?.data ?? []}
        onClose={() => setPickerOpen(false)}
        onAdd={addFromPicker}
      />

      <Modal
        title="收款"
        open={payOpen}
        onCancel={() => setPayOpen(false)}
        onOk={() => settle.mutate()}
        confirmLoading={settle.isPending}
        okText="确认收款"
        destroyOnHidden
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <div className="entry-pay-amount">
            <span className="muted">应收金额</span>
            <strong className="cell-money">{created ? formatCNY(created.total_amount) : '—'}</strong>
          </div>
          <label className="entry-field">
            <span>收款方式</span>
            <Select
              style={{ width: '100%' }}
              value={method}
              onChange={(value: PaymentMethod) => setMethod(value)}
              options={PAY_METHODS}
            />
          </label>
          <p className="muted">
            <IdcardOutlined /> 收款后本单的 ID 卡绑定与人员持卡会在同一事务内释放（ADR-0022 §4）。
          </p>
        </Space>
      </Modal>
    </>
  )
}
