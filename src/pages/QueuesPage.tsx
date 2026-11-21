import { Fragment, useEffect, useState, type CSSProperties } from 'react'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AppstoreOutlined, CalendarOutlined, CheckCircleOutlined, ClockCircleOutlined,
  PlusOutlined, SearchOutlined, TableOutlined, TeamOutlined,
} from '@ant-design/icons'
import {
  Avatar, Button, Card, Checkbox, Dropdown, Form, Input, InputNumber, Modal,
  Segmented, Space, Typography, message,
} from 'antd'
import { useNavigate } from 'react-router-dom'
import { queryKeys } from '../api/keys'
import { queuesApi, staffApi } from '../api/queues'
import type {
  CreateQueueRequest, QueueDetail, QueueView, StaffDetail, StaffSummary,
} from '../api/types'
import PageHeader from '../components/PageHeader'
import StaffActionProvider from '../components/StaffActionProvider'
import ServiceSlot from '../components/ServiceSlot'
import { EmptyHint, ErrorState, PageLoading } from '../components/RequestState'
import { hasPermission, useAuthStore } from '../stores/authStore'
import { useShopStore } from '../stores/shopStore'
import { sortQueueRefs, sortQueueViews } from '../shop/queueSort'
import { useStaffActionMenu } from '../shop/staffActionContext'
import { bucketOf, stateLabel } from '../shop/staffStatus'

interface QueueForm {
  seq: number
  name: string
}

const laneAccents = ['#2f7d5b', '#3f8f9e', '#d99a4e', '#7c6bb0', '#c6697b']

type BoardView = 'queues' | 'staff' | 'matrix'
type DutyFilter = 'all' | 'on' | 'off'

export default function QueuesPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const shopId = useShopStore((state) => state.currentShopId)
  const permissions = useAuthStore((state) => state.permissions)
  const canWrite = hasPermission(permissions, 'queue.write')
  const canSchedule = hasPermission(permissions, 'scheduling.write')
  const [form] = Form.useForm<QueueForm>()
  const [open, setOpen] = useState(false)
  const [selectedQueueId, setSelectedQueueId] = useState<string | null>(null)
  const [view, setView] = useState<BoardView>('queues')
  const [dutyFilter, setDutyFilter] = useState<DutyFilter>('all')
  const [search, setSearch] = useState('')
  const [managedStaffId, setManagedStaffId] = useState<string | null>(null)

  const queuesQuery = useQuery({
    queryKey: queryKeys.queues(shopId ?? ''),
    queryFn: () => queuesApi.list(shopId!),
    enabled: Boolean(shopId),
  })
  const staffQuery = useQuery({
    queryKey: queryKeys.staff(shopId ?? ''),
    queryFn: () => staffApi.list(shopId!),
    enabled: Boolean(shopId),
  })

  const queueViews = sortQueueViews(queuesQuery.data?.data ?? [])
  // Each lane needs its own member list; keys stay shop-scoped (ADR-0006).
  const detailQueries = useQueries({
    queries: queueViews.map((queue) => ({
      queryKey: queryKeys.queue(shopId ?? '', queue.public_id),
      queryFn: () => queuesApi.get(shopId!, queue.public_id),
      enabled: Boolean(shopId),
    })),
  })
  // People view needs each member's queue refs; keys stay shop-scoped (ADR-0006).
  const staffDetailQueries = useQueries({
    queries: (view === 'staff' ? staffQuery.data?.data ?? [] : []).map((person) => ({
      queryKey: queryKeys.staffDetail(shopId ?? '', person.public_id),
      queryFn: () => staffApi.get(shopId!, person.public_id),
      enabled: Boolean(shopId) && view === 'staff',
    })),
  })

  useEffect(() => {
    setSelectedQueueId(null)
    setManagedStaffId(null)
    setSearch('')
    setDutyFilter('all')
  }, [shopId])

  const invalidate = () => {
    if (!shopId) return
    void queryClient.invalidateQueries({ queryKey: queryKeys.queues(shopId) })
    // Prefix match refreshes every lane detail without touching queue-staff keys.
    void queryClient.invalidateQueries({ queryKey: ['shop-scope', shopId, 'queue'] })
    void queryClient.invalidateQueries({ queryKey: queryKeys.staff(shopId) })
  }

  const createQueue = useMutation({
    mutationFn: (body: CreateQueueRequest) => queuesApi.create(shopId!, body),
    onSuccess: () => {
      setOpen(false)
      form.resetFields()
      message.success('队列已创建')
      invalidate()
    },
    onError: (error) => message.error((error as Error).message || '创建失败'),
  })

  const reorder = useMutation({
    mutationFn: ({ queueId, staffIds, version }: {
      queueId: string
      staffIds: string[]
      version: number
    }) => queuesApi.reorderStaff(shopId!, queueId, { staff_ids: staffIds, version }),
    onSuccess: () => {
      message.success('队列顺序已更新')
      invalidate()
    },
    onError: (error) => message.error((error as Error).message || '排序失败，请重读后重试'),
  })

  const submitOrder = (queueId: string, staffIds: string[], version: number) =>
    reorder.mutateAsync({ queueId, staffIds, version })

  const openCreate = () => {
    form.resetFields()
    form.setFieldsValue({ seq: 1 })
    setOpen(true)
  }

  const submit = (values: QueueForm) => {
    if (!shopId) return
    createQueue.mutate({ seq: Number(values.seq), name: values.name })
  }

  if (!shopId) return <EmptyHint>请先选择一个门店</EmptyHint>
  if (queuesQuery.isPending) return <PageLoading />
  if (queuesQuery.error) {
    return <ErrorState error={queuesQuery.error} onRetry={() => void queuesQuery.refetch()} />
  }

  const staff = staffQuery.data?.data ?? []
  const staffByPublicId = new Map(staff.map((item) => [item.public_id, item]))
  const selectedIndex = queueViews.findIndex((queue) => queue.public_id === selectedQueueId)
  const detail = selectedIndex >= 0 ? detailQueries[selectedIndex]?.data?.data ?? null : null
  const managedIndex = staff.findIndex((person) => person.public_id === managedStaffId)
  const managedDetail = managedIndex >= 0 ? staffDetailQueries[managedIndex]?.data?.data ?? null : null

  const assigned = detailQueries.flatMap((query) => query.data?.data?.staff ?? [])
  const onDuty = assigned.filter((member) => member.duty_status === 'on').length

  return (
    <StaffActionProvider shopId={shopId} canWrite={canWrite} canSchedule={canSchedule}>
      <div className="page">
        <PageHeader
          eyebrow="Workspace / Queues"
          title="队列看板"
          description={
            view === 'queues'
              ? '队列多、服务员少：按队列横向排列，拖动卡片或使用箭头调整队列内顺序。'
              : view === 'staff'
                ? '服务员多、队列少：按人员网格排列，可筛选在岗状态并查看每人所属队列。'
                : '队列纵向堆叠、人员横向成行：同时纵览多条队列并逐行查看成员。'
          }
          actions={
            <Space wrap>
              <Segmented<BoardView>
                value={view}
                onChange={setView}
                options={[
                  { value: 'queues', label: '队列视图', icon: <AppstoreOutlined /> },
                  { value: 'staff', label: '人员视图', icon: <TeamOutlined /> },
                  { value: 'matrix', label: '矩阵视图', icon: <TableOutlined /> },
                ]}
              />
              <Button icon={<TeamOutlined />} onClick={() => navigate('/staff')}>
                服务人员
              </Button>
              {canWrite ? (
                <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                  新建队列
                </Button>
              ) : null}
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
              <div className="stat-label">已分配人员</div>
              <div className="stat-value">{assigned.length}</div>
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
            <span className="stat-icon amber"><ClockCircleOutlined /></span>
            <div className="stat-text">
              <div className="stat-label">离岗</div>
              <div className="stat-value">{assigned.length - onDuty}</div>
            </div>
          </div>
        </div>

        <Card className="panel">
          {view === 'queues' ? (
            queueViews.length === 0 ? (
              <EmptyHint>该门店还没有队列{canWrite ? '，点击右上角新建' : ''}</EmptyHint>
            ) : (
              <div className="queue-board">
                {queueViews.map((queue, index) => {
                  const detailQuery = detailQueries[index]
                  return (
                    <QueueLane
                      key={queue.public_id}
                      queue={queue}
                      detail={detailQuery?.data?.data}
                      loading={detailQuery?.isPending ?? false}
                      error={detailQuery?.isError ?? false}
                      staffByPublicId={staffByPublicId}
                      canWrite={canWrite}
                      reordering={reorder.isPending}
                      onSubmitOrder={submitOrder}
                      onManage={() => setSelectedQueueId(queue.public_id)}
                    />
                  )
                })}
                {canWrite ? (
                  <button type="button" className="queue-lane queue-lane-add" onClick={openCreate}>
                    <span className="add-icon"><PlusOutlined /></span>
                    <strong>新建队列</strong>
                    <span>为当前门店添加一条队列</span>
                  </button>
                ) : null}
              </div>
            )
          ) : view === 'matrix' ? (
            queueViews.length === 0 ? (
              <EmptyHint>该门店还没有队列{canWrite ? '，点击右上角新建' : ''}</EmptyHint>
            ) : (
              <div className="matrix-board">
                {queueViews.map((queue, index) => {
                  const detailQuery = detailQueries[index]
                  return (
                    <MatrixRow
                      key={queue.public_id}
                      queue={queue}
                      detail={detailQuery?.data?.data}
                      loading={detailQuery?.isPending ?? false}
                      error={detailQuery?.isError ?? false}
                      staffByPublicId={staffByPublicId}
                      canWrite={canWrite}
                      reordering={reorder.isPending}
                      onSubmitOrder={submitOrder}
                      onManage={() => setSelectedQueueId(queue.public_id)}
                    />
                  )
                })}
              </div>
            )
          ) : (
            <PeopleBoard
              shopId={shopId}
              staff={staff}
              detailQueries={staffDetailQueries}
              queues={queueViews}
              canWrite={canWrite}
              dutyFilter={dutyFilter}
              search={search}
              onDutyFilterChange={setDutyFilter}
              onSearchChange={setSearch}
              onManage={setManagedStaffId}
              onChanged={invalidate}
            />
          )}

          <Modal
            title="新建队列"
            open={open}
            onCancel={() => setOpen(false)}
            onOk={() => form.submit()}
            confirmLoading={createQueue.isPending}
            okText="创建"
            cancelText="取消"
          >
            <Form form={form} layout="vertical" onFinish={submit}>
              <Form.Item
                name="seq"
                label="序号"
                rules={[{ required: true, message: '请输入序号' }]}
                extra="同一门店内序号唯一，从 1 开始"
              >
                <InputNumber min={1} precision={0} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item
                name="name"
                label="名称"
                rules={[{ required: true, message: '请输入名称' }, { whitespace: true, message: '名称不能为空' }]}
              >
                <Input maxLength={60} placeholder="例如：一号队列" />
              </Form.Item>
            </Form>
          </Modal>

          <StaffQueueModal
            shopId={shopId}
            staffDetail={managedDetail}
            queues={queueViews}
            onClose={() => setManagedStaffId(null)}
            onChanged={invalidate}
          />

          <QueueAssignModal
            shopId={shopId}
            queue={detail}
            staff={staff}
            canWrite={canWrite}
            onClose={() => setSelectedQueueId(null)}
            onChanged={invalidate}
          />
        </Card>
      </div>
    </StaffActionProvider>
  )
}

interface StaffDetailQuery {
  data?: { data: StaffDetail }
  isPending: boolean
  isError: boolean
}

interface PeopleBoardProps {
  shopId: string
  staff: StaffSummary[]
  detailQueries: StaffDetailQuery[]
  queues: QueueView[]
  canWrite: boolean
  dutyFilter: DutyFilter
  search: string
  onDutyFilterChange: (value: DutyFilter) => void
  onSearchChange: (value: string) => void
  onManage: (staffId: string) => void
  onChanged: () => void
}

/** People-first view: one card per staff member, with their queue membership. */
function PeopleBoard({
  shopId, staff, detailQueries, queues, canWrite, dutyFilter, search,
  onDutyFilterChange, onSearchChange, onManage, onChanged,
}: PeopleBoardProps) {
  const { menuProps } = useStaffActionMenu()
  const setDuty = useMutation({
    mutationFn: ({ person, duty }: { person: StaffSummary; duty: 'on' | 'off' }) =>
      staffApi.update(shopId, person.public_id, {
        duty_status: duty,
        version: person.version,
      }),
    onSuccess: () => {
      message.success('在岗状态已更新')
      onChanged()
    },
    onError: (error) => message.error((error as Error).message || '状态更新失败'),
  })

  const needle = search.trim().toLowerCase()
  const visible = staff.filter((person) => {
    if (dutyFilter !== 'all' && person.duty_status !== dutyFilter) return false
    if (!needle) return true
    return person.display_name.toLowerCase().includes(needle)
      || person.code.toLowerCase().includes(needle)
  })

  return (
    <div className="people-board">
      <div className="people-toolbar">
        <Segmented<DutyFilter>
          value={dutyFilter}
          onChange={onDutyFilterChange}
          options={[
            { value: 'all', label: '全部' },
            { value: 'on', label: '在岗' },
            { value: 'off', label: '离岗' },
          ]}
        />
        <Input
          className="people-search"
          prefix={<SearchOutlined />}
          placeholder="搜索姓名或工号"
          allowClear
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
        <span className="queue-lane-count">显示 {visible.length} / {staff.length} 人</span>
      </div>

      {staff.length === 0 ? (
        <EmptyHint>该门店暂无服务人员{canWrite ? '，可先在「服务人员」页建档' : ''}</EmptyHint>
      ) : visible.length === 0 ? (
        <EmptyHint>没有符合条件的服务人员，可调整筛选或搜索词</EmptyHint>
      ) : (
        <div className="card-grid">
          {visible.map((person) => {
            const index = staff.findIndex((item) => item.public_id === person.public_id)
            const detailQuery = detailQueries[index]
            const queueRefs = sortQueueRefs(detailQuery?.data?.data?.queues ?? [])
            const card = (
              <article
                className="entity-card person-card"
                data-bucket={bucketOf(person.state)}
                data-actionable="true"
              >
                <div className="entity-card-head">
                  <Avatar size={42} className="entity-avatar" style={{ backgroundColor: 'transparent', color: 'inherit' }}>
                    {person.display_name.slice(0, 1)}
                  </Avatar>
                  <div className="entity-card-title">
                    <strong>{person.display_name}</strong>
                    <span>{person.code}</span>
                  </div>
                  {canWrite && person.status === 'active' ? (
                    <Button
                      size="small"
                      type={person.duty_status === 'on' ? 'default' : 'primary'}
                      loading={setDuty.isPending}
                      title={person.duty_status === 'on' ? '点击将该人员置为离岗' : '点击将该人员置为在岗'}
                      onClick={(event) => {
                        event.stopPropagation()
                        setDuty.mutate({
                          person,
                          duty: person.duty_status === 'on' ? 'off' : 'on',
                        })
                      }}
                    >
                      {person.duty_status === 'on' ? '设为离岗' : '设为在岗'}
                    </Button>
                  ) : null}
                </div>
                <div className="entity-card-meta">
                  <span className={`pill ${person.status === 'active' ? 'on' : 'off'}`}>
                    {person.status === 'active' ? '在职' : '停用'}
                  </span>
                  <span className="staff-state-pill">{stateLabel(person.state)}</span>
                  <span className={`pill ${person.duty_status === 'on' ? 'on' : 'off'}`}>
                    {person.duty_status === 'on' ? '在岗' : '离岗'}
                  </span>
                  <span className="queue-lane-count">{queueRefs.length} 个队列</span>
                  <span className="staff-card-id-card" title={person.id_card ? `${person.id_card.name} · ${person.id_card.code}` : '未绑定 ID 卡'}>
                    {person.id_card ? person.id_card.name : '未绑卡'}
                  </span>
                </div>
                <div className="staff-queue-chips">
                  {detailQuery?.isPending ? <span className="queue-lane-empty">所属队列加载中…</span> : null}
                  {detailQuery?.isError ? <span className="queue-lane-empty">所属队列加载失败</span> : null}
                  {detailQuery && !detailQuery.isPending && !detailQuery.isError && queueRefs.length === 0 ? (
                    <span className="queue-lane-empty">尚未分配队列</span>
                  ) : null}
                  {queueRefs.map((queue) => (
                    <span className="queue-chip" key={queue.public_id} title={queue.name}>
                      <b>{queue.seq}</b>
                      {queue.name}
                    </span>
                  ))}
                </div>
                <div className="entity-card-foot">
                  <span className="queue-lane-count">共 {queues.length} 个队列可用</span>
                  {canWrite ? (
                    <Button
                      type="link"
                      onClick={(event) => { event.stopPropagation(); onManage(person.public_id) }}
                    >
                      管理队列
                    </Button>
                  ) : null}
                </div>
              </article>
            )
            return (
              <Dropdown key={person.public_id} {...menuProps(person)}>
                {card}
              </Dropdown>
            )
          })}
        </div>
      )}
    </div>
  )
}

interface StaffQueueModalProps {
  shopId: string
  staffDetail: StaffDetail | null
  queues: QueueView[]
  onClose: () => void
  onChanged: () => void
}

function StaffQueueModal({ shopId, staffDetail, queues, onClose, onChanged }: StaffQueueModalProps) {
  const [selected, setSelected] = useState<string[]>([])

  useEffect(() => {
    if (staffDetail) setSelected(staffDetail.queues.map((queue) => queue.public_id))
  }, [staffDetail])

  const mutate = useMutation({
    mutationFn: async ({ queueId, assign }: { queueId: string; assign: boolean }) => {
      if (!staffDetail) return
      if (assign) await queuesApi.assign(shopId, queueId, staffDetail.public_id)
      else await queuesApi.unassign(shopId, queueId, staffDetail.public_id)
    },
    onSuccess: () => {
      message.success('队列分配已更新')
      onChanged()
    },
    onError: (error) => message.error((error as Error).message || '操作失败'),
  })

  const toggle = (queueId: string, checked: boolean) => {
    setSelected((current) =>
      checked ? [...current, queueId] : current.filter((id) => id !== queueId),
    )
    mutate.mutate({ queueId, assign: checked })
  }

  return (
    <Modal
      title={staffDetail ? `${staffDetail.display_name}（${staffDetail.code}）所在队列` : ''}
      open={Boolean(staffDetail)}
      onCancel={onClose}
      footer={<Button onClick={onClose}>关闭</Button>}
    >
      {staffDetail ? (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Typography.Text type="secondary">勾选即加入该队列；同一人员可在本店多个队列服务</Typography.Text>
          {queues.length === 0 ? (
            <EmptyHint>该门店暂无队列，请先在队列视图新建</EmptyHint>
          ) : (
            sortQueueViews(queues).map((queue) => (
              <Checkbox
                key={queue.public_id}
                checked={selected.includes(queue.public_id)}
                disabled={mutate.isPending}
                onChange={(event) => toggle(queue.public_id, event.target.checked)}
              >
                序号 {queue.seq} · {queue.name}
              </Checkbox>
            ))
          )}
        </Space>
      ) : null}
    </Modal>
  )
}

type OrderHandlers = Pick<QueueLaneProps, 'queue' | 'detail' | 'canWrite' | 'onSubmitOrder'>

/** Shared local ordering with optimistic update + rollback (ADR-0002 decision 2). */
function useStaffOrder({ queue, detail, canWrite, onSubmitOrder }: OrderHandlers) {
  const [order, setOrder] = useState<string[]>(() => detail?.staff.map((s) => s.public_id) ?? [])
  useEffect(() => {
    setOrder(detail?.staff.map((s) => s.public_id) ?? [])
  }, [detail])

  const members = new Map(detail?.staff.map((s) => [s.public_id, s]) ?? [])

  const applyOrder = async (next: string[]) => {
    if (!detail || !canWrite) return
    setOrder(next)
    try {
      await onSubmitOrder(queue.public_id, next, detail.version)
    } catch {
      setOrder(detail.staff.map((s) => s.public_id))
    }
  }

  const move = (staffId: string, delta: number) => {
    const next = [...order]
    const from = next.indexOf(staffId)
    const to = from + delta
    if (from < 0 || to < 0 || to >= next.length) return
    next.splice(from, 1)
    next.splice(to, 0, staffId)
    void applyOrder(next)
  }

  const dropOn = (targetId: string, sourceId: string) => {
    if (!sourceId || sourceId === targetId) return
    const next = [...order]
    const from = next.indexOf(sourceId)
    const to = next.indexOf(targetId)
    if (from < 0 || to < 0) return
    next.splice(from, 1)
    next.splice(to, 0, sourceId)
    void applyOrder(next)
  }

  return { order, members, move, dropOn }
}

interface QueueLaneProps {
  queue: QueueView
  detail?: QueueDetail
  loading: boolean
  error: boolean
  staffByPublicId: Map<string, StaffSummary>
  canWrite: boolean
  reordering: boolean
  onSubmitOrder: (queueId: string, staffIds: string[], version: number) => Promise<unknown>
  onManage: () => void
}

/** One horizontal lane; members are draggable cards with a click fallback. */
function QueueLane({
  queue, detail, loading, error, staffByPublicId, canWrite, reordering, onSubmitOrder, onManage,
}: QueueLaneProps) {
  const { order, members, move, dropOn } = useStaffOrder({ queue, detail, canWrite, onSubmitOrder })
  const { menuProps } = useStaffActionMenu()
  const accent = laneAccents[(queue.seq - 1) % laneAccents.length]

  return (
    <section
      className="queue-lane"
      style={{ '--lane-accent': accent } as CSSProperties}
      aria-label={`队列 ${queue.seq} ${queue.name}`}
    >
      <header className="queue-lane-head">
        <span className="queue-seq">{queue.seq}</span>
        <span className="queue-lane-title" title={queue.name}>{queue.name}</span>
        {queue.status === 'active' ? <span className="pill on">启用</span> : <span className="pill off">停用</span>}
      </header>
      <div className="queue-lane-meta">
        <span className={`pill ${queue.staff_count > 0 ? 'plain' : 'off'}`}>
          {queue.staff_count} 人在列
        </span>
        {canWrite ? <span className="queue-meta-hint">拖动卡片或用箭头调整顺序</span> : null}
      </div>
      <div className="queue-staff-list">
        {loading ? <div className="queue-lane-empty">服务人员加载中…</div> : null}
        {error ? <div className="queue-lane-empty">服务人员加载失败</div> : null}
        {detail && order.length === 0 ? <div className="queue-lane-empty">暂无服务人员</div> : null}
        {order.map((staffId) => {
          const member = members.get(staffId)
          if (!member) return null
          const summary = staffByPublicId.get(staffId)
          const code = summary?.code
          const index = order.indexOf(staffId)
          const card = (
            <article
              className={`staff-card${member.duty_status === 'on' ? '' : ' off-duty'}`}
              data-bucket={summary ? bucketOf(summary.state) : undefined}
              data-actionable={summary ? 'true' : undefined}
              draggable={canWrite}
              title={canWrite ? '拖动调整顺序，点击打开操作菜单' : '点击打开操作菜单'}
              onDragStart={(event) => event.dataTransfer.setData('text/plain', staffId)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault()
                dropOn(staffId, event.dataTransfer.getData('text/plain'))
              }}
            >
              <span className="staff-position">{index + 1}</span>
              <Avatar
                size={32}
                style={{ backgroundColor: member.duty_status === 'on' ? accent : '#b7c3bb', flexShrink: 0 }}
              >
                {member.display_name.slice(0, 1)}
              </Avatar>
              <div className="staff-card-body">
                <div className="staff-card-name">{member.display_name}</div>
                <div className="staff-card-meta">
                  <span className={`pill ${member.duty_status === 'on' ? 'on' : 'off'}`}>
                    {member.duty_status === 'on' ? '在岗' : '离岗'}
                  </span>
                  {code ? <span className="staff-card-code">{code}</span> : null}
                  {summary?.id_card ? (
                    <span className="staff-card-id-card" title={summary.id_card.name}>{summary.id_card.name}</span>
                  ) : null}
                </div>
              </div>
              {canWrite ? (
                <div className="staff-card-actions">
                  <Button
                    type="text"
                    size="small"
                    title="上移"
                    aria-label={`上移 ${member.display_name}`}
                    disabled={reordering || index === 0}
                    onClick={(event) => { event.stopPropagation(); move(staffId, -1) }}
                  >
                    ↑
                  </Button>
                  <Button
                    type="text"
                    size="small"
                    title="下移"
                    aria-label={`下移 ${member.display_name}`}
                    disabled={reordering || index === order.length - 1}
                    onClick={(event) => { event.stopPropagation(); move(staffId, 1) }}
                  >
                    ↓
                  </Button>
                </div>
              ) : null}
            </article>
          )
          // The menu needs the full summary (state, memberships); without it
          // the card still renders, it just is not clickable.
          if (!summary) return <Fragment key={staffId}>{card}</Fragment>
          return (
            <Dropdown key={staffId} {...menuProps(summary, { queueId: queue.public_id })}>
              {card}
            </Dropdown>
          )
        })}
      </div>
      <footer className="queue-lane-foot">
        <span className="queue-lane-count">序号 {queue.seq} · {order.length} 人</span>
        <Button type="link" size="small" onClick={onManage}>管理</Button>
      </footer>
    </section>
  )
}

type MatrixRowProps = QueueLaneProps

/** One queue as a vertical row; members sit in a horizontal line of cards. */
function MatrixRow({
  queue, detail, loading, error, staffByPublicId, canWrite, reordering, onSubmitOrder, onManage,
}: MatrixRowProps) {
  const { order, members, move, dropOn } = useStaffOrder({ queue, detail, canWrite, onSubmitOrder })
  const { menuProps } = useStaffActionMenu()
  const accent = laneAccents[(queue.seq - 1) % laneAccents.length]

  return (
    <section
      className="matrix-row"
      style={{ '--lane-accent': accent } as CSSProperties}
      aria-label={`矩阵队列 ${queue.seq} ${queue.name}`}
    >
      <header className="matrix-row-head">
        <span className="queue-seq">{queue.seq}</span>
        <span className="matrix-row-title" title={queue.name}>{queue.name}</span>
        {queue.status === 'active' ? <span className="pill on">启用</span> : <span className="pill off">停用</span>}
        <span className={`pill ${queue.staff_count > 0 ? 'plain' : 'off'}`}>
          {queue.staff_count} 人在列
        </span>
        <span className="matrix-row-spacer" />
        <Button type="link" size="small" onClick={onManage}>管理</Button>
      </header>
      <div className="matrix-row-body">
        {loading ? <div className="queue-lane-empty">服务人员加载中…</div> : null}
        {error ? <div className="queue-lane-empty">服务人员加载失败</div> : null}
        {detail && order.length === 0 ? <div className="queue-lane-empty">暂无服务人员</div> : null}
        {order.map((staffId) => {
          const member = members.get(staffId)
          if (!member) return null
          const summary = staffByPublicId.get(staffId)
          const code = summary?.code
          const index = order.indexOf(staffId)
          const card = (
            <article
              className="matrix-card"
              data-actionable={summary ? 'true' : undefined}
              draggable={canWrite}
              title={canWrite ? '拖动调整顺序，点击打开操作菜单' : '点击打开操作菜单'}
              onDragStart={(event) => event.dataTransfer.setData('text/plain', staffId)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault()
                dropOn(staffId, event.dataTransfer.getData('text/plain'))
              }}
            >
              <ServiceSlot
                name={member.display_name}
                code={code}
                state={summary?.state ?? 'standby'}
                position={index + 1}
                duty={member.duty_status}
                idCard={summary?.id_card}
                remainingMinutes={summary?.service_remaining_minutes}
                bucket={summary ? bucketOf(summary.state) : undefined}
                actions={canWrite ? (
                  <>
                    <Button
                      type="text" size="small" title="前移" aria-label={`前移 ${member.display_name}`}
                      disabled={reordering || index === 0}
                      onClick={(event) => { event.stopPropagation(); move(staffId, -1) }}
                    >←</Button>
                    <Button
                      type="text" size="small" title="后移" aria-label={`后移 ${member.display_name}`}
                      disabled={reordering || index === order.length - 1}
                      onClick={(event) => { event.stopPropagation(); move(staffId, 1) }}
                    >→</Button>
                  </>
                ) : undefined}
              />
            </article>
          )
          if (!summary) return <Fragment key={staffId}>{card}</Fragment>
          return (
            <Dropdown key={staffId} {...menuProps(summary, { queueId: queue.public_id })}>
              {card}
            </Dropdown>
          )
        })}
      </div>
    </section>
  )
}

interface AssignModalProps {
  shopId: string
  queue: QueueDetail | null
  staff: StaffSummary[]
  canWrite: boolean
  onClose: () => void
  onChanged: () => void
}

function QueueAssignModal({ shopId, queue, staff, canWrite, onClose, onChanged }: AssignModalProps) {
  const [selected, setSelected] = useState<string[]>([])

  // Reset the checkbox state whenever a different queue (or its staff) is opened.
  useEffect(() => {
    if (queue) setSelected(queue.staff.map((s) => s.public_id))
  }, [queue])

  const mutate = useMutation({
    mutationFn: async ({ staffId, assign }: { staffId: string; assign: boolean }) => {
      if (!queue) return
      if (assign) await queuesApi.assign(shopId, queue.public_id, staffId)
      else await queuesApi.unassign(shopId, queue.public_id, staffId)
    },
    onSuccess: () => {
      message.success('分配已更新')
      onChanged()
    },
    onError: (error) => message.error((error as Error).message || '操作失败'),
  })

  const toggle = (staffId: string, checked: boolean) => {
    setSelected((current) =>
      checked ? [...current, staffId] : current.filter((id) => id !== staffId),
    )
    mutate.mutate({ staffId, assign: checked })
  }

  return (
    <Modal
      title={queue ? `队列管理 · ${queue.name}（序号 ${queue.seq}）` : ''}
      open={Boolean(queue)}
      onCancel={onClose}
      footer={<Button onClick={onClose}>关闭</Button>}
    >
      {queue ? (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Typography.Text type="secondary">服务人员（勾选即加入该队列，可跨多个队列）</Typography.Text>
          {staff.length === 0 ? (
            <EmptyHint>该门店暂无服务人员，请先在「服务人员」页建档</EmptyHint>
          ) : (
            staff.map((item) => (
              <Checkbox
                key={item.public_id}
                checked={selected.includes(item.public_id)}
                disabled={!canWrite || mutate.isPending}
                onChange={(event) => toggle(item.public_id, event.target.checked)}
              >
                {item.display_name} <Typography.Text type="secondary">（{item.code}）</Typography.Text>
              </Checkbox>
            ))
          )}
        </Space>
      ) : null}
    </Modal>
  )
}
