/**
 * Dispatch board (ADR-0012 / design/12). Generic terms only. Every read comes
 * from the server; mutations go through command endpoints. The console holds
 * only UI filter state. Site switching re-keys all queries via X-Shop-Id.
 */
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert, Button, Drawer, Empty, Popconfirm, Select, Space, Table, Tag, Tooltip, message,
} from 'antd'
import {
  ArrowRightOutlined, CheckCircleOutlined, ClockCircleOutlined,
  PlusOutlined, ReloadOutlined, RestOutlined, StopOutlined,
} from '@ant-design/icons'
import PageHeader from '../components/PageHeader'
import { ErrorState, PageLoading } from '../components/RequestState'
import { schedulingApi } from '../api/scheduling'
import { queryKeys } from '../api/keys'
import { useShopStore } from '../stores/shopStore'
import type {
  BoardMember, DecisionRecord, DispatchRequest, SchedulingEvent,
} from '../api/types'
import { formatUTC8 } from '../utils/datetime'

const STATE_LABEL: Record<string, string> = {
  standby: '待命', available: '可调度', executing: '执行中',
  designated_occupied: '指定占用', pinned: '置顶', time_reserved: '时段保留',
  overtime: '加班中', disabled: '停用', leave: '请假',
  off_duty: '下班', cross_group_support: '跨组支援',
}

const STATE_TONE: Record<string, string> = {
  available: 'success', executing: 'processing', pinned: 'warning',
  standby: 'default', cross_group_support: 'cyan', time_reserved: 'purple',
}

function stateTag(state: string) {
  return <Tag color={STATE_TONE[state] ?? 'default'}>{STATE_LABEL[state] ?? state}</Tag>
}

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

  const board = boardQ.data?.data
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
                disabled={releaseMut.isPending} onClick={() => releaseMut.mutate()}>
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

      {queues.length === 0 ? (
        <Empty description="当前站点还没有队列" />
      ) : (
        <div className="board-lanes">
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
                  <span className="muted">{members.length} 位</span>
                </header>
                <div className="lane-members">
                  {members.length === 0 ? (
                    <div className="lane-empty">暂无执行者</div>
                  ) : members.map((m) => (
                    <div className={`position-card ${m.pin_type !== 'none' ? 'is-pinned' : ''}`} key={`${m.queue_id}-${m.executor_id}`}>
                      <span className="pos-number">{m.position}</span>
                      <div className="pos-main">
                        <div className="pos-name">
                          <strong>{m.display_name}</strong>
                          {m.is_primary ? <Tag color="green">主队列</Tag> : null}
                          {m.pin_type !== 'none' ? <Tag color="gold">置顶</Tag> : null}
                        </div>
                        <div className="pos-meta">
                          <span className="muted">{m.code}</span>
                          {stateTag(m.state)}
                          {m.duty_status === 'off' ? <Tag>下班</Tag> : null}
                        </div>
                      </div>
                      <div className="pos-actions">
                        {m.pin_type === 'none' ? (
                          <Tooltip title="置顶到队首">
                            <Button size="small" type="text" icon={<ArrowRightOutlined />}
                              onClick={() => pinMut.mutate({ queue_id: m.queue_id, staff_id: m.executor_id, pin: true })} />
                          </Tooltip>
                        ) : (
                          <Tooltip title="解除置顶">
                            <Button size="small" type="text" icon={<RestOutlined />}
                              onClick={() => pinMut.mutate({ queue_id: m.queue_id, staff_id: m.executor_id, pin: false })} />
                          </Tooltip>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}

      <section className="panel">
        <div className="panel-head"><h2>最近事件</h2><span className="muted">一次事件一次决策，可回原位</span></div>
        {eventsQ.isLoading ? <PageLoading /> : (eventsQ.data?.data.length ?? 0) === 0 ? (
          <Empty description="还没有派单事件" />
        ) : (
          <Table<SchedulingEvent>
            rowKey="public_id"
            size="small"
            scroll={{ x: 980 }}
            dataSource={eventsQ.data?.data ?? []}
            pagination={{ pageSize: 6, hideOnSinglePage: true }}
            columns={[
              { title: '事件', dataIndex: 'event_id', key: 'event_id' },
              { title: '执行者', dataIndex: 'staff_id', key: 'staff_id', render: (v: string) =>
                board?.executors.find((e) => e.public_id === v)?.display_name ?? v.slice(0, 8) },
              { title: '指派方式', dataIndex: 'method', key: 'method' },
              { title: '决策', dataIndex: 'decision', key: 'decision', render: (v: string) =>
                <Tag color={v === 'rotate' ? 'green' : 'default'}>{v === 'rotate' ? '轮转' : '保持'}</Tag> },
              { title: '说明', dataIndex: 'explain', key: 'explain', ellipsis: true },
              { title: '时间', dataIndex: 'occurred_at', key: 'occurred_at', render: formatUTC8 },
              { title: '操作', key: 'op', fixed: 'right', width: 210, render: (_: unknown, row) => (
                <Space size={2} wrap className="event-row-actions">
                  <Button size="small" type="link"
                    onClick={() => setDetail({ kind: 'event', event: row })}>解释</Button>
                  <Button size="small" type="link" disabled={actionMut.isPending}
                    onClick={() => actionMut.mutate({ event: row.event_id, action: 'restore' })}>回原位</Button>
                  <Popconfirm title="标记该事件已完成？" okText="完成" cancelText="取消"
                    disabled={actionMut.isPending}
                    onConfirm={() => actionMut.mutate({ event: row.event_id, action: 'complete' })}>
                    <Button size="small" type="link" disabled={actionMut.isPending}>完成</Button>
                  </Popconfirm>
                  <Popconfirm title="取消该事件并恢复位次？" okText="取消事件" cancelText="返回"
                    okButtonProps={{ danger: true }} disabled={actionMut.isPending}
                    onConfirm={() => actionMut.mutate({ event: row.event_id, action: 'cancel' })}>
                    <Button size="small" type="link" danger disabled={actionMut.isPending}>取消</Button>
                  </Popconfirm>
                </Space>
              ) },
            ]}
          />
        )}
      </section>

      <DispatchDrawer
        open={dispatchOpen}
        onClose={() => setDispatchOpen(false)}
        shopId={shopId!}
        queues={board?.queues ?? []}
        executors={dispatchable}
        taskTypes={(tasksQ.data?.data ?? []).map((t) => ({ value: t.public_id, label: `${t.code} · ${t.name}` }))}
        onDispatched={(rec) => {
          setDispatchOpen(false)
          invalidate()
          setDetail({ kind: 'record', record: rec })
        }}
      />

      <Drawer
        title={detail?.kind === 'event' ? '事件摘要' : '决策解释'}
        width={520}
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
        message={common.decision === 'rotate' ? '判定为位次轮转' : '判定为位次保持'}
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

function DispatchDrawer({ open, onClose, shopId, queues, executors, taskTypes, onDispatched }: {
  open: boolean
  onClose: () => void
  shopId: string
  queues: { public_id: string; seq: number; name: string; enabled: boolean }[]
  executors: { public_id: string; code: string; display_name: string; primary_queue_id: string }[]
  taskTypes: { value: string; label: string }[]
  onDispatched: (rec: DecisionRecord) => void
}) {
  const [step, setStep] = useState(0)
  const [staff, setStaff] = useState<string | undefined>()
  const [queue, setQueue] = useState<string | undefined>()
  const [task, setTask] = useState<string | undefined>()

  const reset = () => { setStep(0); setStaff(undefined); setQueue(undefined); setTask(undefined) }

  // Derive the source queue from the executor's primary queue: dispatch must
  // start from a queue the executor actually belongs to. Keep only enabled
  // queues so a disabled primary falls back to the first enabled one.
  const staffOptions = executors.map((e) => ({
    value: e.public_id,
    label: `${e.code} · ${e.display_name}`,
    primary: e.primary_queue_id,
  }))
  const initialQueueFor = (staffId: string | undefined) => {
    if (!staffId) return undefined
    const primary = staffOptions.find((e) => e.value === staffId)?.primary
    const enabled = queues.filter((q) => q.enabled)
    if (primary && enabled.some((q) => q.public_id === primary)) return primary
    return undefined
  }
  const pickStaff = (v: string) => { setStaff(v); setQueue(initialQueueFor(v)) }

  const mut = useMutation({
    mutationFn: () => {
      const body: DispatchRequest = {
        event_id: `evt-${crypto.randomUUID()}`,
        staff_id: staff!,
        source_queue_id: queue!,
        task_type_id: task!,
        assignment_method: 'rotational',
      }
      return schedulingApi.dispatch(shopId, body)
    },
    // Reset all steps on success so the next open starts clean.
    onSuccess: (res) => { reset(); onDispatched(res.data) },
    onError: (e) => message.error((e as Error).message ?? '派单失败'),
  })

  const close = () => { reset(); onClose() }

  return (
    <Drawer title="派单" open={open} onClose={close} width={440}
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
          options={queues.filter((q) => q.enabled).map((q) => ({ value: q.public_id, label: `${q.seq} · ${q.name}` }))} />
      ) : null}
      {step === 2 ? (
        <div className="page-stack">
          <p>执行者：{staffOptions.find((e) => e.value === staff)?.label ?? '—'}</p>
          <p>来源队列：{queues.find((q) => q.public_id === queue)
            ? `${queues.find((q) => q.public_id === queue)!.seq} · ${queues.find((q) => q.public_id === queue)!.name}`
            : '—'}</p>
          <Select placeholder="选择任务类型" value={task} onChange={setTask} style={{ width: '100%' }}
            options={taskTypes} />
          <Alert type="info" showIcon message="确认后一次事务内完成判定、联动与审计" />
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
