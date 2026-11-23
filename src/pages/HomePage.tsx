/**
 * Home overview (frontend ADR-0005, amended by ADR-0006): the dispatch board's
 * queues and the shop's rooms. Everything is read-only except one entry point —
 * clicking an active room opens the order-entry modal, which then writes
 * through the ordinary order endpoints.
 */
import { useMemo, useState } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import {
  ApartmentOutlined, CalendarOutlined, CheckCircleOutlined,
  DashboardOutlined, TeamOutlined,
} from '@ant-design/icons'
import { Button, Card, Space } from 'antd'
import { useNavigate } from 'react-router-dom'
import { queryKeys } from '../api/keys'
import { queuesApi } from '../api/queues'
import { roomsApi } from '../api/rooms'
import type { Room } from '../api/types'
import PageHeader from '../components/PageHeader'
import OrderEntryModal from '../components/OrderEntryModal'
import { EmptyHint, ErrorState, PageLoading } from '../components/RequestState'
import { sortQueueViews } from '../shop/queueSort'
import { floorLabel, groupByFloor } from '../shop/roomGroup'
import { hasPermission, useAuthStore } from '../stores/authStore'
import { useShopStore } from '../stores/shopStore'

/** How many names fit in a queue card before the rest collapse into "+N". */
const MEMBER_PREVIEW = 6

export default function HomePage() {
  const navigate = useNavigate()
  const shopId = useShopStore((state) => state.currentShopId)
  const permissions = useAuthStore((state) => state.permissions)
  const canWriteOrder = hasPermission(permissions, 'order.write')
  const [entryRoom, setEntryRoom] = useState<Room | null>(null)
  const [entryOpen, setEntryOpen] = useState(false)

  const openEntry = (room: Room) => {
    setEntryRoom(room)
    setEntryOpen(true)
  }

  const queuesQuery = useQuery({
    queryKey: queryKeys.queues(shopId ?? ''),
    queryFn: () => queuesApi.list(shopId!),
    enabled: Boolean(shopId),
  })
  const roomsQuery = useQuery({
    queryKey: queryKeys.rooms(shopId ?? ''),
    queryFn: () => roomsApi.list(shopId!),
    enabled: Boolean(shopId),
  })

  const queueViews = useMemo(
    () => sortQueueViews(queuesQuery.data?.data ?? []),
    [queuesQuery.data],
  )
  // The queue list carries only a count; the names come from each lane detail.
  const detailQueries = useQueries({
    queries: queueViews.map((queue) => ({
      queryKey: queryKeys.queue(shopId ?? '', queue.public_id),
      queryFn: () => queuesApi.get(shopId!, queue.public_id),
      enabled: Boolean(shopId),
    })),
  })

  const rooms = useMemo(
    () => groupByFloor(roomsQuery.data?.data ?? []).flatMap((group) => group.rooms),
    [roomsQuery.data],
  )

  if (!shopId) return <EmptyHint>请先选择一个门店</EmptyHint>
  if (queuesQuery.isPending) return <PageLoading />
  if (queuesQuery.error) {
    return <ErrorState error={queuesQuery.error} onRetry={() => void queuesQuery.refetch()} />
  }

  const members = detailQueries.flatMap((query) => query.data?.data.staff ?? [])
  const onDuty = members.filter((member) => member.duty_status === 'on').length
  const activeRooms = rooms.filter((room) => room.status === 'active').length

  return (
    <div className="page">
      <PageHeader
        eyebrow="Workspace / Home"
        title="首页"
        description="当前门店的队列在列情况与房间状态一览；点击启用中的房间可直接开单，其余内容只读。"
        actions={
          <Space wrap>
            <Button icon={<DashboardOutlined />} onClick={() => navigate('/board')}>
              调度看板
            </Button>
            <Button type="primary" icon={<CalendarOutlined />} onClick={() => navigate('/queues')}>
              队列看板
            </Button>
          </Space>
        }
      />

      <div className="stat-strip">
        <div className="stat-tile">
          <span className="stat-icon"><CalendarOutlined /></span>
          <div className="stat-text">
            <div className="stat-label">队列数量</div>
            <div className="stat-value">{queueViews.length}</div>
          </div>
        </div>
        <div className="stat-tile">
          <span className="stat-icon slate"><TeamOutlined /></span>
          <div className="stat-text">
            <div className="stat-label">在列人次</div>
            <div className="stat-value">{members.length}</div>
          </div>
        </div>
        <div className="stat-tile">
          <span className="stat-icon"><CheckCircleOutlined /></span>
          <div className="stat-text">
            <div className="stat-label">在岗</div>
            <div className="stat-value">{onDuty}</div>
          </div>
        </div>
        <div className="stat-tile">
          <span className="stat-icon amber"><ApartmentOutlined /></span>
          <div className="stat-text">
            <div className="stat-label">房间（启用）</div>
            <div className="stat-value">{activeRooms} / {rooms.length}</div>
          </div>
        </div>
      </div>

      <Card className="panel">
        <div className="panel-head">
          <h2>调度看板队列</h2>
          <span className="muted">按序号排列，成员取队列内位次顺序，最多显示 {MEMBER_PREVIEW} 人</span>
        </div>
        {queueViews.length === 0 ? (
          <EmptyHint>该门店还没有队列，可先到「队列看板」新建</EmptyHint>
        ) : (
          <div className="home-queue-grid">
            {queueViews.map((queue, index) => {
              const detailQuery = detailQueries[index]
              const lane = detailQuery?.data?.data
              const sorted = [...(lane?.staff ?? [])].sort((a, b) => a.position - b.position)
              const visible = sorted.slice(0, MEMBER_PREVIEW)
              const hidden = sorted.length - visible.length
              return (
                <section
                  className="home-queue-card"
                  key={queue.public_id}
                  aria-label={`队列 ${queue.seq} ${queue.name}`}
                >
                  <header className="home-queue-head">
                    <span className="queue-seq">{queue.seq}</span>
                    <strong title={queue.name}>{queue.name}</strong>
                    <span className={`pill ${queue.status === 'active' ? 'on' : 'off'}`}>
                      {queue.status === 'active' ? '启用' : '停用'}
                    </span>
                  </header>
                  <div className="home-queue-members">
                    {detailQuery?.isPending ? (
                      <span className="home-queue-empty">成员加载中…</span>
                    ) : detailQuery?.isError ? (
                      <span className="home-queue-empty">成员加载失败</span>
                    ) : sorted.length === 0 ? (
                      <span className="home-queue-empty">暂无服务人员</span>
                    ) : (
                      <>
                        {visible.map((member) => (
                          <span
                            className="home-queue-member"
                            data-duty={member.duty_status === 'on' ? 'on' : 'off'}
                            key={member.public_id}
                            title={`位次 ${member.position} · ${member.duty_status === 'on' ? '在岗' : '离岗'}`}
                          >
                            {member.display_name}
                          </span>
                        ))}
                        {hidden > 0 ? (
                          <span className="home-queue-member is-more">+{hidden}</span>
                        ) : null}
                      </>
                    )}
                  </div>
                  <footer className="home-queue-foot">
                    <span className="queue-lane-count">{queue.staff_count} 人在列</span>
                    <Button type="link" size="small" onClick={() => navigate('/queues')}>
                      查看队列
                    </Button>
                  </footer>
                </section>
              )
            })}
          </div>
        )}
      </Card>

      <Card className="panel">
        <div className="panel-head">
          <h2>房间</h2>
          <span className="muted">按楼层降序、房号升序排列，共 {rooms.length} 间</span>
        </div>
        {roomsQuery.isPending ? (
          <PageLoading />
        ) : roomsQuery.error ? (
          <ErrorState error={roomsQuery.error} onRetry={() => void roomsQuery.refetch()} />
        ) : rooms.length === 0 ? (
          <EmptyHint>该门店还没有房间，可先到「房间管理」新建</EmptyHint>
        ) : (
          <div className="home-room-grid">
            {rooms.map((room) => {
              // Only an active room can be billed against (the backend rejects
              // an inactive one with 409 ROOM_INACTIVE), so the card is inert
              // instead of promising a modal that would fail on submit.
              const bookable = canWriteOrder && room.status === 'active'
              const hint = room.status !== 'active'
                ? '房间已停用，不能开单'
                : !canWriteOrder ? '没有开单权限' : ''
              return (
                <article
                  className={[
                    'home-room-card',
                    room.status === 'active' ? '' : 'is-inactive',
                    bookable ? 'is-clickable' : '',
                  ].filter(Boolean).join(' ')}
                  key={room.public_id}
                  role={bookable ? 'button' : undefined}
                  tabIndex={bookable ? 0 : undefined}
                  aria-label={bookable ? `为房间 ${room.code} ${room.name} 开单` : undefined}
                  onClick={bookable ? () => openEntry(room) : undefined}
                  onKeyDown={bookable ? (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      openEntry(room)
                    }
                  } : undefined}
                >
                  <div className="home-room-name" title={room.name}>{room.name}</div>
                  <div className="home-room-meta">
                    <span className="home-room-code">{room.code}</span>
                    <span className="home-room-floor">{floorLabel(room.floor)}</span>
                    <span className={`pill ${room.status === 'active' ? 'on' : 'off'}`}>
                      {room.status === 'active' ? '启用' : '停用'}
                    </span>
                  </div>
                  {bookable ? (
                    <span className="home-room-action">开单</span>
                  ) : hint ? (
                    <span className="home-room-note">{hint}</span>
                  ) : null}
                </article>
              )
            })}
          </div>
        )}
      </Card>

      <OrderEntryModal
        open={entryOpen}
        shopId={shopId}
        room={entryRoom}
        onClose={() => setEntryOpen(false)}
        onCreated={() => void roomsQuery.refetch()}
      />
    </div>
  )
}
