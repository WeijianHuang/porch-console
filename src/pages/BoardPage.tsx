/**
 * Dispatch board (ADR-0012 / design/12). Generic terms only. Every read comes
 * from the server; mutations go through command endpoints. The console holds
 * only UI filter state. Site switching re-keys all queries via X-Shop-Id.
 */
import { Fragment, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert, Button, Drawer, Dropdown, Empty, Popconfirm, Segmented, Select, Space, Table, Tag, Tooltip, message,
} from 'antd'
import {
  ArrowRightOutlined, CheckCircleOutlined, ClockCircleOutlined,
  PlusOutlined, ReloadOutlined, RestOutlined, StopOutlined,
} from '@ant-design/icons'
import PageHeader from '../components/PageHeader'
import StaffActionProvider from '../components/StaffActionProvider'
import ServiceSlot from '../components/ServiceSlot'
import { ErrorState, PageLoading } from '../components/RequestState'
import { schedulingApi } from '../api/scheduling'
import { staffApi } from '../api/queues'
import { queryKeys } from '../api/keys'
import { useShopStore } from '../stores/shopStore'
import { hasPermission, useAuthStore } from '../stores/authStore'
import { useBoardDensity, type BoardDensity } from '../stores/boardDensity'
import type {
  BoardMember, DecisionRecord, DispatchRequest, SchedulingEvent, StaffSummary,
} from '../api/types'
import { formatUTC8 } from '../utils/datetime'
import { useStaffActionMenu } from '../shop/staffActionContext'
import { bucketOf } from '../shop/staffStatus'

/**
 * Two real sources for the detail drawer:
 *  - 'record': full DecisionRecord returned live from dispatch (has chain + changes)
 *  - 'event': persisted SchedulingEvent summary (no per-step chain stored)
 * The old code fabricated an empty chain and issued a pointless refetch.
 */
type DecisionDetail =
  | { kind: 'record'; record: DecisionRecord }
  | { kind: 'event'; event: SchedulingEvent }

export default function BoardPage() {
  const shopId = useShopStore((s) => s.currentShopId)
  const permissions = useAuthStore((s) => s.permissions)
  const canWrite = hasPermission(permissions, 'queue.write')
  const canSchedule = hasPermission(permissions, 'scheduling.write')

  if (!shopId) return <EmptyHintShop />

  return (
    <StaffActionProvider shopId={shopId} canWrite={canWrite} canSchedule={canSchedule}>
      <BoardView />
    </StaffActionProvider>
  )
}

function BoardView() {
  const shopId = useShopStore((s) => s.currentShopId)
  const { menuProps } = useStaffActionMenu()
  const boardDensity = useBoardDensity((s) => s.boardDensity)
  const setBoardDensity = useBoardDensity((s) => s.setBoardDensity)
  const qc = useQueryClient()
  const [dispatchOpen, setDispatchOpen] = useState(false)
  const [detail, setDetail] = useState<DecisionDetail | null>(null)
  const [selectedQueue, setSelectedQueue] = useState<string>('all')

  const boardQ = useQuery({
    queryKey: queryKeys.schedulingBoard(shopId ?? ''),
    queryFn: () => schedulingApi.board(shopId!),
    enabled: !!shopId,
  })
  const eventsQ = useQuery({
    queryKey: queryKeys.schedulingEvents(shopId ?? ''),
    queryFn: () => schedulingApi.events(shopId!),
    enabled: !!shopId,
  })
  const tasksQ = useQuery({
    queryKey: queryKeys.schedulingTaskTypes(shopId ?? ''),
    queryFn: () => schedulingApi.taskTypes(shopId!),
    enabled: !!shopId,
  })
  // Board members carry state but not memberships; the operator menu needs the
  // full summary, so read the staff list alongside the board.
  const staffQ = useQuery({
    queryKey: queryKeys.staff(shopId ?? ''),
    queryFn: () => staffApi.list(shopId!),
    enabled: !!shopId,
  })

  const invalidate = () => {
    if (!shopId) return
    void qc.invalidateQueries({ queryKey: queryKeys.schedulingBoard(shopId) })
    void qc.invalidateQueries({ queryKey: queryKeys.schedulingEvents(shopId) })
  }

  const pinMut = useMutation({
    mutationFn: (v: { queue_id: string; staff_id: string; pin: boolean }) =>
      v.pin
        ? schedulingApi.pin(shopId!, { queue_id: v.queue_id, staff_id: v.staff_id, pin_type: 'permanent' })
        : schedulingApi.unpin(shopId!, { queue_id: v.queue_id, staff_id: v.staff_id }),
    onSuccess: () => { message.success('位次状态已更新'); invalidate() },
    onError: (e) => message.error((e as Error).message ?? '操作失败'),
  })
  const releaseMut = useMutation({
    mutationFn: () => schedulingApi.releaseExpired(shopId!),
    onSuccess: (r) => { message.success(`已释放 ${r.data.released} 个置顶`); invalidate() },
    onError: (e) => message.error((e as Error).message ?? '操作失败'),
  })
  const actionMut = useMutation({
    mutationFn: (v: { event: string; action: 'restore' | 'cancel' | 'complete' }) =>
      schedulingApi.eventAction(shopId!, v.event, v.action),
    onSuccess: (_r, v) => {
      message.success(v.action === 'restore' ? '已回原位' : v.action === 'cancel' ? '已取消' : '已完成')
      invalidate()
    },
    onError: (e) => message.error((e as Error).message ?? '操作失败'),
  })
  const methodMut = useMutation({
    mutationFn: (v: { event: string; method: 'rotational' | 'designated' }) =>
      schedulingApi.changeMethod(shopId!, v.event, v.method),
    onSuccess: () => { message.success('指派方式已更新'); invalidate() },
    onError: (e) => message.error((e as Error).message ?? '操作失败'),
  })

  const busy = pinMut.isPending || releaseMut.isPending || actionMut.isPending || methodMut.isPending

  const board = boardQ.data?.data
  const staffByPublicId = useMemo(() => {
    const m = new Map<string, StaffSummary>()
    for (const item of staffQ.data?.data ?? []) m.set(item.public_id, item)
    return m
  }, [staffQ.data])
  const membersByQueue = useMemo(() => {
    const m = new Map<string, BoardMember[]>()
    for (const member of board?.members ?? []) {
      const list = m.get(member.queue_id) ?? []
      list.push(member)
      m.set(member.queue_id, list)
    }
    for (const list of m.values()) list.sort((a, b) => a.position - b.position)
    return m
  }, [board])

  if (!shopId) return <EmptyHintShop />
  if (boardQ.isLoading) return <PageLoading />
  if (boardQ.isError) return <ErrorState error={boardQ.error} onRetry={() => boardQ.refetch()} />

  const queues = (board?.queues ?? []).filter(
    (q) => selectedQueue === 'all' || q.public_id === selectedQueue,
  )
  const dispatchable = (board?.executors ?? []).filter(
    (e) => e.duty_status === 'on' && e.state !== 'executing' && e.state !== 'disabled' && e.state !== 'leave',
  )

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="调度引擎"
        title="调度看板"
        description="按队列查看执行者位次；派单、置顶、回原位均为单店隔离操作。"
        actions={
          <Space>
            <Tooltip title="释放到期或不可用的置顶">
              <Button icon={<RestOutlined />} loading={releaseMut.isPending}
                disabled={busy} onClick={() => releaseMut.mutate()}>
                释放置顶
              </Button>
            </Tooltip>
            <Button icon={<ReloadOutlined />} onClick={invalidate}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setDispatchOpen(true)}>
              派单
            </Button>
          </Space>
        }
      />

      <div className="stat-strip">
        <div className="stat-tile">
          <span className="stat-icon green"><CheckCircleOutlined /></span>
          <div><strong>{board?.executors.filter((e) => e.state === 'available').length ?? 0}</strong><span>可调度</span></div>
        </div>
        <div className="stat-tile">
          <span className="stat-icon amber"><ClockCircleOutlined /></span>
          <div><strong>{board?.executors.filter((e) => e.state === 'executing').length ?? 0}</strong><span>执行中</span></div>
        </div>
        <div className="stat-tile">
          <span className="stat-icon"><StopOutlined /></span>
          <div><strong>{board?.members.filter((m) => m.pin_type !== 'none').length ?? 0}</strong><span>置顶位次</span></div>
        </div>
        <div className="stat-tile">
          <span className="stat-icon"><ArrowRightOutlined /></span>
          <div><strong>{eventsQ.data?.data.length ?? 0}</strong><span>最近事件</span></div>
        </div>
      </div>

      <div className="board-toolbar">
        <div className="toolbar-group">
          <span className="muted">队列筛选</span>
          <Select
            value={selectedQueue}
            onChange={setSelectedQueue}
            style={{ width: 220 }}
            options={[
              { value: 'all', label: '全部队列' },
              ...(board?.queues ?? []).map((q) => ({ value: q.public_id, label: `${q.seq} · ${q.name}` })),
            ]}
          />
        </div>
        <div className="toolbar-group">
          <Tooltip title="仅影响本机显示，不改变位次与调度结果">
            <span className="muted">卡片密度</span>
          </Tooltip>
          <Segmented<BoardDensity>
            className="board-density"
            size="small"
            value={boardDensity}
            onChange={setBoardDensity}
            options={[
              { label: '紧凑', value: 'compact' },
              { label: '中度', value: 'medium' },
              { label: '宽松', value: 'loose' },
            ]}
          />
        </div>
      </div>

      {queues.length === 0 ? (
        <Empty description="当前站点还没有队列" />
      ) : (
        <div className="board-lanes" data-density={boardDensity}>
          {queues.map((q) => {
            const members = membersByQueue.get(q.public_id) ?? []
            return (
              <section className={`board-lane ${q.enabled ? '' : 'is-inactive'}`} key={q.public_id}>
                <header className="lane-head">
                  <div>
                    <span className="lane-seq">{q.seq}</span>
                    <strong>{q.name}</strong>
                    {q.frozen ? <Tag color="blue">冻结</Tag> : null}
                  </div>
                  <span className="lane-count">{members.length} 位</span>
                </header>
                <div className="lane-members">
                  {members.length === 0 ? (
                    <div className="lane-empty">暂无执行者</div>
                  ) : members.map((m) => {
                    const summary = staffByPublicId.get(m.executor_id)
                    const cardKey = `${m.queue_id}-${m.executor_id}`
                    const pinAction = (
                      <Tooltip title={m.pin_type === 'none' ? '置顶到队首' : '解除置顶'}>
                        <Button
                          size="small" type="text"
                          icon={m.pin_type === 'none' ? <ArrowRightOutlined /> : <RestOutlined />}
                          disabled={busy}
                          onClick={(event) => {
                            event.stopPropagation()
                            pinMut.mutate({ queue_id: m.queue_id, staff_id: m.executor_id, pin: m.pin_type === 'none' })
                          }}
                        />
                      </Tooltip>
                    )
                    const card = (
                      <div
                        className="position-card"
                        data-actionable={summary ? 'true' : undefined}
                      >
                        <ServiceSlot
                          name={m.display_name}
                          code={m.code}
                          state={m.state}
                          position={m.position}
                          duty={m.duty_status}
                          idCard={m.id_card}
                          remainingMinutes={m.service_remaining_minutes}
                          bucket={bucketOf(m.state)}
                          primary={m.is_primary}
                          pinned={m.pin_type !== 'none'}
                          compact={boardDensity === 'compact'}
                          corner={(
                            <>
                              {m.is_primary ? <span className="pos-primary-dot" title="主队列" aria-label="主队列" /> : null}
                              {m.is_primary ? <Tag color="green" className="pos-primary-tag">主队列</Tag> : null}
                              {m.pin_type !== 'none' ? <Tag color="gold" className="pos-pin-tag">置顶</Tag> : null}
                            </>
                          )}
                          actions={pinAction}
                        />
                      </div>
                    )
                    // Without a staff summary the menu has no memberships to act
                    // on, so the card stays read-only rather than opening an
                    // empty menu.
                    if (!summary) return <Fragment key={cardKey}>{card}</Fragment>
                    return (
                      <Dropdown key={cardKey} {...menuProps(summary, { queueId: m.queue_id })}>
                        {card}
                      </Dropdown>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}

      <section className="panel">
        <div className="panel-head"><h2>最近事件</h2><span className="muted">一次事件一次决策，可回原位</span></div>
        {eventsQ.isError ? (
          <ErrorState error={eventsQ.error} onRetry={() => eventsQ.refetch()} />
        ) : eventsQ.isLoading ? <PageLoading /> : (eventsQ.data?.data.length ?? 0) === 0 ? (
          <Empty description="还没有派单事件" />
        ) : (
          <Table<SchedulingEvent>
            rowKey="public_id"
            size="small"
            scroll={{ x: 1040 }}
            dataSource={eventsQ.data?.data ?? []}
            pagination={{ pageSize: 6, hideOnSinglePage: true }}
            columns={[
              { title: '事件', dataIndex: 'event_id', key: 'event_id', width: 172 },
              { title: '执行者', dataIndex: 'staff_id', key: 'staff_id', render: (v: string) =>
                board?.executors.find((e) => e.public_id === v)?.display_name ?? v.slice(0, 8) },
              { title: '指派方式', dataIndex: 'method', key: 'method', width: 90, render: (v: string) =>
                <Tag>{v === 'designated' ? '指定' : '轮转'}</Tag> },
              { title: '决策', dataIndex: 'decision', key: 'decision', render: (v: string) =>
                <Tag color={v === 'rotate' ? 'green' : 'default'}>{v === 'rotate' ? '轮转' : '保持'}</Tag> },
              { title: '说明', dataIndex: 'explain', key: 'explain', ellipsis: true },
              { title: '时间', dataIndex: 'occurred_at', key: 'occurred_at', width: 152, render: formatUTC8 },
              { title: '操作', key: 'op', width: 290, render: (_: unknown, row) => {
                const state = board?.executors.find((e) => e.public_id === row.staff_id)?.state
                const canChange = state === 'executing' || state === 'designated_occupied'
                const nextMethod = row.method === 'designated' ? 'rotational' : 'designated'
                return (
                  <Space size={2} wrap className="event-row-actions">
                    <Button size="small" type="link"
                      onClick={() => setDetail({ kind: 'event', event: row })}>解释</Button>
                    <Popconfirm title="恢复该事件执行前的位次？" okText="回原位" cancelText="返回"
                      disabled={busy}
                      onConfirm={() => actionMut.mutate({ event: row.event_id, action: 'restore' })}>
                      <Button size="small" type="link" disabled={busy}>回原位</Button>
                    </Popconfirm>
                    <Popconfirm title="标记该事件已完成？" okText="完成" cancelText="取消"
                      disabled={busy}
                      onConfirm={() => actionMut.mutate({ event: row.event_id, action: 'complete' })}>
                      <Button size="small" type="link" disabled={busy}>完成</Button>
                    </Popconfirm>
                    <Popconfirm title="取消该事件并恢复位次？" okText="取消事件" cancelText="返回"
                      okButtonProps={{ danger: true }} disabled={busy}
                      onConfirm={() => actionMut.mutate({ event: row.event_id, action: 'cancel' })}>
                      <Button size="small" type="link" danger disabled={busy}>取消</Button>
                    </Popconfirm>
                    {canChange ? (
                      <Popconfirm
                        title={`将指派方式改为「${nextMethod === 'rotational' ? '轮转' : '指定'}」？`}
                        okText="确认" cancelText="返回" disabled={busy}
                        onConfirm={() => methodMut.mutate({ event: row.event_id, method: nextMethod })}>
                        <Button size="small" type="link" disabled={busy}>改方式</Button>
                      </Popconfirm>
                    ) : null}
                  </Space>
                )
              } },
            ]}
          />
        )}
      </section>

      <DispatchDrawer
        open={dispatchOpen}
        onClose={() => setDispatchOpen(false)}
        shopId={shopId!}
        queues={board?.queues ?? []}
        members={board?.members ?? []}
        executors={dispatchable}
        taskTypes={(tasksQ.data?.data ?? []).map((t) => ({ value: t.public_id, label: `${t.code} · ${t.name}` }))}
        onDispatched={(rec) => {
          setDispatchOpen(false)
          invalidate()
          setDetail({ kind: 'record', record: rec })
        }}
      />

      <Drawer
        className="scheduling-drawer"
        title={detail?.kind === 'event' ? '事件摘要' : '决策解释'}
        size={520}
        open={!!detail}
        onClose={() => setDetail(null)}
      >
        {detail ? <DecisionDetailView detail={detail} /> : null}
      </Drawer>
    </div>
  )
}

function DecisionDetailView({ detail }: { detail: DecisionDetail }) {
  // Both sources carry these common fields; only a live dispatch has chain/changes.
  const common = detail.kind === 'record'
    ? {
      decision: detail.record.decision,
      explain: detail.record.explain,
      rule: detail.record.hit_rule_id,
      operator: detail.record.operator,
      eventId: detail.record.event_id,
    }
    : {
      decision: detail.event.decision as 'rotate' | 'hold',
      explain: detail.event.explain,
      rule: detail.event.hit_rule,
      operator: detail.event.operator,
      eventId: detail.event.event_id,
    }

  return (
    <div className="explain-body">
      <Alert type={common.decision === 'rotate' ? 'success' : 'info'} showIcon
        title={common.decision === 'rotate' ? '判定为位次轮转' : '判定为位次保持'}
        description={common.explain || '—'} />
      <div className="detail-facts">
        <div><span>事件</span><code>{common.eventId}</code></div>
        <div><span>命中规则</span><code>{common.rule || '无'}</code></div>
        <div><span>决策</span><Tag color={common.decision === 'rotate' ? 'green' : 'default'}>
          {common.decision === 'rotate' ? '轮转' : '保持'}</Tag></div>
        <div><span>操作者</span>{common.operator || '—'}</div>
      </div>

      {detail.kind === 'event' ? (
        <p className="muted detail-note">
          历史事件仅保留决策摘要，未持久化逐步骤链明细；需要完整链路请在派单后查看。
        </p>
      ) : (
        <>
          <h3>判定链</h3>
          {detail.record.chain.length === 0 ? (
            <p className="muted">本次派单未返回逐链明细。</p>
          ) : (
            <ol className="chain-list">
              {detail.record.chain.map((s, i) => (
                <li key={`${s.rule_id}-${i}`} className={s.hit ? 'chain-hit' : ''}>
                  <code>{s.type}</code>
                  <span>{s.scope}</span>
                  {s.hit ? <Tag color="orange">命中</Tag> : <Tag>通过</Tag>}
                  {s.reason ? <span className="muted">{s.reason}</span> : null}
                </li>
              ))}
            </ol>
          )}
          {detail.record.changes.length > 0 ? (
            <>
              <h3>位次变更</h3>
              <Table size="small" rowKey={(r) => `${r.queue_id}-${r.executor_id}`} dataSource={detail.record.changes}
                pagination={false} columns={[
                  { title: '队列', dataIndex: 'queue_id', ellipsis: true },
                  { title: '原', dataIndex: 'old_position', width: 50 },
                  { title: '新', dataIndex: 'new_position', width: 50 },
                  { title: '动作', dataIndex: 'action' },
                ]} />
            </>
          ) : null}
        </>
      )}
    </div>
  )
}

function DispatchDrawer({ open, onClose, shopId, queues, members, executors, taskTypes, onDispatched }: {
  open: boolean
  onClose: () => void
  shopId: string
  queues: { public_id: string; seq: number; name: string; enabled: boolean }[]
  members: BoardMember[]
  executors: { public_id: string; code: string; display_name: string; primary_queue_id: string }[]
  taskTypes: { value: string; label: string }[]
  onDispatched: (rec: DecisionRecord) => void
}) {
  const [step, setStep] = useState(0)
  const [staff, setStaff] = useState<string | undefined>()
  const [queue, setQueue] = useState<string | undefined>()
  const [task, setTask] = useState<string | undefined>()
  const [method, setMethod] = useState<'rotational' | 'designated'>('rotational')

  const reset = () => {
    setStep(0); setStaff(undefined); setQueue(undefined); setTask(undefined)
    setMethod('rotational')
  }

  // The backend rejects a source queue the executor does not belong to.
  // Derive the eligible set from board memberships, then prefer the primary.
  const staffOptions = executors.map((e) => ({
    value: e.public_id,
    label: `${e.code} · ${e.display_name}`,
    primary: e.primary_queue_id,
  }))
  const eligibleQueues = (staffId: string | undefined) => {
    if (!staffId) return []
    const memberQueues = new Set(
      members.filter((m) => m.executor_id === staffId).map((m) => m.queue_id),
    )
    return queues.filter((q) => q.enabled && memberQueues.has(q.public_id))
  }
  const initialQueueFor = (staffId: string | undefined) => {
    const allowed = eligibleQueues(staffId)
    const primary = staffOptions.find((e) => e.value === staffId)?.primary
    return primary && allowed.some((q) => q.public_id === primary) ? primary : undefined
  }
  const pickStaff = (v: string) => { setStaff(v); setQueue(initialQueueFor(v)) }

  const mut = useMutation({
    mutationFn: () => {
      const body: DispatchRequest = {
        event_id: `evt-${crypto.randomUUID()}`,
        staff_id: staff!,
        source_queue_id: queue!,
        task_type_id: task!,
        assignment_method: method,
      }
      return schedulingApi.dispatch(shopId, body)
    },
    // Reset all steps on success so the next open starts clean.
    onSuccess: (res) => { reset(); onDispatched(res.data) },
    onError: (e) => message.error((e as Error).message ?? '派单失败'),
  })

  const close = () => { reset(); onClose() }

  return (
    <Drawer className="scheduling-drawer" title="派单" open={open} onClose={close} size={440}
      footer={
        <Space>
          {step > 0 ? <Button onClick={() => setStep(step - 1)}>上一步</Button> : null}
          {step < 2 ? (
            <Button type="primary" disabled={
              (step === 0 && !staff) || (step === 1 && !queue)
            } onClick={() => setStep(step + 1)}>下一步</Button>
          ) : (
            <Button type="primary" loading={mut.isPending} disabled={!task}
              onClick={() => mut.mutate()}>确认派单</Button>
          )}
        </Space>
      }>
      <div className="dispatch-steps">
        <div className={step === 0 ? 'ds-active' : ''}>1 · 选择执行者</div>
        <div className={step === 1 ? 'ds-active' : ''}>2 · 选择队列</div>
        <div className={step === 2 ? 'ds-active' : ''}>3 · 确认任务</div>
      </div>
      {step === 0 ? (
        <Select showSearch placeholder="选择执行者" value={staff} onChange={pickStaff}
          style={{ width: '100%' }} optionFilterProp="label" options={staffOptions} />
      ) : null}
      {step === 1 ? (
        <Select placeholder="选择来源队列" value={queue} onChange={setQueue} style={{ width: '100%' }}
          options={eligibleQueues(staff).map((q) => ({ value: q.public_id, label: `${q.seq} · ${q.name}` }))} />
      ) : null}
      {step === 2 ? (
        <div className="page-stack">
          <p>执行者：{staffOptions.find((e) => e.value === staff)?.label ?? '—'}</p>
          <p>来源队列：{queues.find((q) => q.public_id === queue)
            ? `${queues.find((q) => q.public_id === queue)!.seq} · ${queues.find((q) => q.public_id === queue)!.name}`
            : '—'}</p>
          <Select placeholder="选择任务类型" value={task} onChange={setTask} style={{ width: '100%' }}
            options={taskTypes} />
          <label className="dispatch-field">
            <span>指派方式</span>
            <Select value={method} onChange={setMethod} style={{ width: '100%' }}
              options={[
                { value: 'rotational', label: '轮转（按位次判定）' },
                { value: 'designated', label: '指定（占用当前位次）' },
              ]} />
          </label>
          <Alert type="info" showIcon title="确认后一次事务内完成判定、联动与审计" />
        </div>
      ) : null}
    </Drawer>
  )
}

function EmptyHintShop() {
  return (
    <div className="page-stack">
      <PageHeader eyebrow="调度引擎" title="调度看板" />
      <Empty description="请先选择站点" />
    </div>
  )
}
