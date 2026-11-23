import { useState } from 'react'
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { DollarOutlined, FileDoneOutlined, ReloadOutlined, ShrinkOutlined } from '@ant-design/icons'
import { Button, Drawer, Select, Space, Table, Tooltip } from 'antd'
import { ordersApi } from '../api/orders'
import { queryKeys } from '../api/keys'
import type { Order } from '../api/types'
import PageHeader from '../components/PageHeader'
import OrderContextPanel from '../components/OrderContextPanel'
import { EmptyHint, ErrorState, PageLoading } from '../components/RequestState'
import { hasPermission, useAuthStore } from '../stores/authStore'
import { useShopStore } from '../stores/shopStore'
import { formatUTC8 } from '../utils/datetime'
import { formatCNY } from '../utils/money'

/** Order status is a closed set (ADR-0014 state machine). Unknown values from
 * a future contract fall back to a neutral pill rather than being invented. */
const STATUS_OPTIONS = [
  { value: 'all', label: '全部状态' },
  { value: 'draft', label: '草稿' },
  { value: 'open', label: '进行中' },
  { value: 'pending_payment', label: '待收款' },
  { value: 'paid', label: '已收款' },
  { value: 'completed', label: '已完成' },
  { value: 'partially_refunded', label: '部分退款' },
  { value: 'refunded', label: '已退款' },
  { value: 'cancelled', label: '已取消' },
]

const STATUS_META: Record<string, { label: string; tone: string }> = {
  draft: { label: '草稿', tone: 'plain' },
  open: { label: '进行中', tone: 'warn' },
  pending_payment: { label: '待收款', tone: 'warn' },
  paid: { label: '已收款', tone: 'on' },
  completed: { label: '已完成', tone: 'on' },
  partially_refunded: { label: '部分退款', tone: 'warn' },
  refunded: { label: '已退款', tone: 'off' },
  cancelled: { label: '已取消', tone: 'off' },
}

function StatusPill({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, tone: 'plain' }
  return <span className={`pill ${meta.tone}`}>{meta.label}</span>
}

function shortId(value: string | null): string {
  return value ? value.slice(0, 8) : '—'
}

export default function OrdersPage() {
  const queryClient = useQueryClient()
  const shopId = useShopStore((state) => state.currentShopId)
  const permissions = useAuthStore((state) => state.permissions)
  const canRead = hasPermission(permissions, 'order.read')
  const canWrite = hasPermission(permissions, 'order.write')
  const [status, setStatus] = useState('all')
  const [active, setActive] = useState<Order | null>(null)

  const ordersQuery = useInfiniteQuery({
    queryKey: queryKeys.orders(shopId ?? '', status),
    queryFn: ({ pageParam }) =>
      ordersApi.list(shopId!, {
        status: status === 'all' ? undefined : status,
        cursor: pageParam || undefined,
        limit: 20,
      }),
    initialPageParam: '',
    getNextPageParam: (last) => (last.page?.has_more ? last.page.next_cursor || undefined : undefined),
    enabled: Boolean(shopId) && canRead,
  })

  const detailQuery = useQuery({
    queryKey: queryKeys.order(shopId ?? '', active?.public_id ?? ''),
    queryFn: () => ordersApi.get(shopId!, active!.public_id),
    enabled: Boolean(shopId && active),
  })

  if (!shopId) return <PageLoading />
  if (!canRead) return <ErrorState error={{ message: '当前账号没有查看订单的权限（order.read）' }} />

  const rows = ordersQuery.data?.pages.flatMap((page) => page.data) ?? []
  const loadedCount = rows.length
  const pendingCount = rows.filter((o) => o.status === 'pending_payment').length
  const paidCount = rows.filter((o) => o.status === 'paid' || o.status === 'completed').length
  const detail = active ? detailQuery.data?.data ?? null : null

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.orders(shopId, status) })
    if (active) void queryClient.invalidateQueries({ queryKey: queryKeys.order(shopId, active.public_id) })
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Workspace / Orders"
        title="订单列表"
        description="按门店隔离的订单流水；金额为固定小数字符串，不落库的实付／已退／可退在详情中按成功流水派生。"
        actions={
          <Button icon={<ReloadOutlined />} onClick={refresh} loading={ordersQuery.isFetching}>
            刷新
          </Button>
        }
      />

      <div className="stat-strip">
        <div className="stat-tile">
          <span className="stat-icon slate"><FileDoneOutlined /></span>
          <div className="stat-text">
            <div className="stat-label">已加载订单</div>
            <div className="stat-value">{loadedCount}</div>
          </div>
        </div>
        <div className="stat-tile">
          <span className="stat-icon amber"><DollarOutlined /></span>
          <div className="stat-text">
            <div className="stat-label">待收款（已加载）</div>
            <div className="stat-value">{pendingCount}</div>
          </div>
        </div>
        <div className="stat-tile">
          <span className="stat-icon"><ShrinkOutlined /></span>
          <div className="stat-text">
            <div className="stat-label">已收款／完成（已加载）</div>
            <div className="stat-value">{paidCount}</div>
          </div>
        </div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <Space wrap>
            <Select
              value={status}
              onChange={(value) => { setStatus(value); setActive(null) }}
              options={STATUS_OPTIONS}
              style={{ width: 160 }}
              aria-label="订单状态筛选"
            />
            <span className="muted">服务端游标分页，每页 20 条</span>
          </Space>
        </div>

        {ordersQuery.isPending ? (
          <PageLoading />
        ) : ordersQuery.isError ? (
          <ErrorState error={ordersQuery.error} onRetry={() => void ordersQuery.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyHint>该门店当前没有符合条件的订单</EmptyHint>
        ) : (
          <>
            <Table<Order>
              className="data-table"
              rowKey="public_id"
              size="small"
              dataSource={rows}
              pagination={false}
              scroll={{ x: 980 }}
              columns={[
                {
                  title: '单号', dataIndex: 'order_no', className: 'cell-primary',
                  render: (value: string) => <span className="cell-money">{value}</span>,
                },
                {
                  title: '状态', dataIndex: 'status', width: 110,
                  render: (value: string) => <StatusPill status={value} />,
                },
                {
                  title: '订单额', dataIndex: 'total_amount', width: 120, align: 'right',
                  render: (value: string) => <span className="cell-money">{formatCNY(value)}</span>,
                },
                {
                  title: '让利', dataIndex: 'discount_amount', width: 110, align: 'right',
                  render: (value: string) => (
                    <span className="cell-money">{value === '0.00' ? '—' : formatCNY(value)}</span>
                  ),
                },
                {
                  title: '会员', dataIndex: 'member_id', width: 110,
                  render: (value: string | null) => (
                    <Tooltip title={value ?? '散客'}><span className="muted">{shortId(value)}</span></Tooltip>
                  ),
                },
                {
                  title: '操作员', dataIndex: 'operator_id', width: 90,
                  render: (value: number) => <span className="muted">#{value}</span>,
                },
                {
                  title: '创建时间 (UTC+8)', dataIndex: 'created_at', width: 170,
                  render: (value: string) => <span className="muted">{formatUTC8(value)}</span>,
                },
                {
                  title: '操作', key: 'actions', width: 80,
                  render: (_: unknown, order: Order) => (
                    <Button type="link" size="small" onClick={() => setActive(order)}>详情</Button>
                  ),
                },
              ]}
            />
            <div className="orders-more">
              {ordersQuery.hasNextPage ? (
                <Button
                  onClick={() => void ordersQuery.fetchNextPage()}
                  loading={ordersQuery.isFetchingNextPage}
                >
                  加载更多
                </Button>
              ) : (
                <span className="muted">已加载全部符合条件订单</span>
              )}
            </div>
          </>
        )}
      </section>

      <Drawer
        title={active ? `订单 ${active.order_no}` : '订单详情'}
        open={Boolean(active)}
        onClose={() => setActive(null)}
        size={520}
        destroyOnHidden
      >
        {detailQuery.isPending ? (
          <PageLoading />
        ) : detailQuery.isError ? (
          <ErrorState error={detailQuery.error} onRetry={() => void detailQuery.refetch()} />
        ) : detail ? (
          <div className="order-detail">
            <div className="order-detail-head">
              <StatusPill status={detail.status} />
              <span className="muted">版本 {detail.version} · 更新于 {formatUTC8(detail.updated_at)}</span>
            </div>
            <div className="order-amounts">
              <div><span>订单额</span><strong>{formatCNY(detail.total_amount)}</strong></div>
              <div><span>让利</span><strong>{formatCNY(detail.discount_amount)}</strong></div>
              <div><span>实付（派生）</span><strong>{formatCNY(detail.paid_amount ?? '0.00')}</strong></div>
              <div><span>已退（派生）</span><strong>{formatCNY(detail.refunded_amount ?? '0.00')}</strong></div>
              <div><span>可退（派生）</span><strong>{formatCNY(detail.refundable_amount ?? '0.00')}</strong></div>
            </div>
            <OrderContextPanel
              shopId={shopId}
              order={detail}
              canWrite={canWrite}
              onChanged={() => {
                void queryClient.invalidateQueries({ queryKey: queryKeys.order(shopId, detail.public_id) })
                void queryClient.invalidateQueries({ queryKey: queryKeys.orders(shopId, status) })
              }}
            />
            <div className="panel-head"><h3>订单明细</h3></div>
            <Table
              className="data-table"
              rowKey="line_no"
              size="small"
              pagination={false}
              dataSource={detail.lines ?? []}
              columns={[
                { title: '#', dataIndex: 'line_no', width: 40 },
                { title: '项目', dataIndex: 'item_name_snapshot' },
                { title: '数量', dataIndex: 'quantity', width: 70, align: 'right' },
                {
                  title: '单价', dataIndex: 'unit_price', width: 100, align: 'right',
                  render: (value: string) => <span className="cell-money">{formatCNY(value)}</span>,
                },
                {
                  title: '小计', dataIndex: 'amount', width: 100, align: 'right',
                  render: (value: string) => <span className="cell-money">{formatCNY(value)}</span>,
                },
              ]}
            />
            {(detail.lines ?? []).length === 0 ? <p className="muted">该订单暂无明细行</p> : null}
          </div>
        ) : null}
      </Drawer>
    </div>
  )
}
