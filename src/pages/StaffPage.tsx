/**
 * Staff wall (porch-os ADR-0015 / design/13). Cards are coloured by the
 * scheduling state bucket; clicking a card opens the operator menu (state,
 * position, hold, rotation). Every action maps to a real endpoint — nothing is
 * emulated in the browser.
 */
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRightOutlined, CheckCircleOutlined, ClockCircleOutlined, PlusOutlined,
  SearchOutlined, TeamOutlined,
} from '@ant-design/icons'
import {
  Avatar, Button, Dropdown, Form, Input, InputNumber, Modal, Radio, Select, Space, Tag, message,
} from 'antd'
import type { MenuProps } from 'antd'
import { useNavigate } from 'react-router-dom'
import { queryKeys } from '../api/keys'
import { staffApi } from '../api/queues'
import { schedulingApi } from '../api/scheduling'
import type {
  CreateStaffRequest, StaffDetail, StaffQueueRef, StaffSummary,
} from '../api/types'
import PageHeader from '../components/PageHeader'
import { EmptyHint, ErrorState, PageLoading } from '../components/RequestState'
import { hasPermission, useAuthStore } from '../stores/authStore'
import { useShopStore } from '../stores/shopStore'
import { sortQueueRefs } from '../shop/queueSort'
import {
  STAFF_BUCKETS, bucketOf, manualOptions, stateLabel, type StaffBucket,
} from '../shop/staffStatus'

interface StaffForm {
  code: string
  display_name: string
}

type MoveTarget = { staff: StaffSummary; queueId: string }

export default function StaffPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const shopId = useShopStore((state) => state.currentShopId)
  const permissions = useAuthStore((state) => state.permissions)
  const canWrite = hasPermission(permissions, 'queue.write')
  const canSchedule = hasPermission(permissions, 'scheduling.write')
  const [form] = Form.useForm<StaffForm>()
  const [open, setOpen] = useState(false)
  const [detail, setDetail] = useState<StaffDetail | null>(null)
  const [search, setSearch] = useState('')
  const [bucket, setBucket] = useState<StaffBucket | 'all'>('all')
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [move, setMove] = useState<MoveTarget | null>(null)
  const [moveTo, setMoveTo] = useState<'head' | 'tail' | 'index'>('head')
  const [moveIndex, setMoveIndex] = useState<number>(1)

  const staffQuery = useQuery({
    queryKey: queryKeys.staff(shopId ?? ''),
    queryFn: () => staffApi.list(shopId!),
    enabled: Boolean(shopId),
  })

  const invalidate = () => {
    if (!shopId) return
    void queryClient.invalidateQueries({ queryKey: queryKeys.staff(shopId) })
    // Queue details embed duty_status/position; the board embeds state + pin.
    void queryClient.invalidateQueries({ queryKey: ['shop-scope', shopId, 'queue'] })
    void queryClient.invalidateQueries({ queryKey: queryKeys.queues(shopId) })
    void queryClient.invalidateQueries({ queryKey: queryKeys.schedulingBoard(shopId) })
  }

  const create = useMutation({
    mutationFn: (body: CreateStaffRequest) => staffApi.create(shopId!, body),
    onSuccess: () => {
      setOpen(false)
      form.resetFields()
      message.success('服务人员已建档')
      invalidate()
    },
    onError: (error) => message.error((error as Error).message || '建档失败'),
  })

  const setState = useMutation({
    mutationFn: ({ staffId, state }: { staffId: string; state: string }) =>
      staffApi.setState(shopId!, staffId, { state }),
    onSuccess: (res) => {
      message.success(`已置为「${stateLabel(res.data.state)}」`)
      invalidate()
    },
    onError: (error) => message.error((error as Error).message || '状态更新失败'),
  })

  const setRotation = useMutation({
    mutationFn: ({ staffId, stop }: { staffId: string; stop: boolean }) =>
      staffApi.setRotation(shopId!, staffId, { stop_rotation: stop }),
    onSuccess: (_res, vars) => {
      message.success(vars.stop ? '已停止轮转' : '已恢复轮转')
      invalidate()
    },
    onError: (error) => message.error((error as Error).message || '轮转设置失败'),
  })

  const pin = useMutation({
    mutationFn: ({ staffId, queueId, pinned }: { staffId: string; queueId: string; pinned: boolean }) =>
      pinned
        ? schedulingApi.pin(shopId!, { queue_id: queueId, staff_id: staffId, pin_type: 'permanent' })
        : schedulingApi.unpin(shopId!, { queue_id: queueId, staff_id: staffId }),
    onSuccess: (_res, vars) => {
      message.success(vars.pinned ? '已留位（置顶）' : '已取消留位')
      invalidate()
    },
    onError: (error) => message.error((error as Error).message || '留位操作失败'),
  })

  const moveStaff = useMutation({
    mutationFn: (v: { staffId: string; queueId: string; to: 'head' | 'tail' | 'index'; index?: number }) =>
      staffApi.moveInQueue(shopId!, v.queueId, v.staffId, { to: v.to, index: v.index }),
    onSuccess: (res) => {
      message.success(`已移动到第 ${res.data.position} 位`)
      setMove(null)
      invalidate()
    },
    onError: (error) => message.error((error as Error).message || '移动位次失败'),
  })

  const openDetail = async (staffId: string) => {
    if (!shopId) return
    try {
      const response = await staffApi.get(shopId, staffId)
      setDetail(response.data)
    } catch (error) {
      message.error((error as Error).message || '加载详情失败')
    }
  }

  const staff = useMemo(() => staffQuery.data?.data ?? [], [staffQuery.data])
  const counts = useMemo(() => {
    const map = new Map<StaffBucket, number>()
    for (const item of staff) {
      const key = bucketOf(item.state)
      map.set(key, (map.get(key) ?? 0) + 1)
    }
    return map
  }, [staff])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return staff.filter((item) => {
      if (bucket !== 'all' && bucketOf(item.state) !== bucket) return false
      if (!q) return true
      return item.display_name.toLowerCase().includes(q) || item.code.toLowerCase().includes(q)
    })
  }, [staff, search, bucket])

  if (!shopId) return <EmptyHint>请先选择一个门店</EmptyHint>
  if (staffQuery.isPending) return <PageLoading />
  if (staffQuery.error) {
    return <ErrorState error={staffQuery.error} onRetry={() => void staffQuery.refetch()} />
  }

  const onDuty = staff.filter((item) => item.duty_status === 'on').length
  const serving = staff.filter((item) => {
    const b = bucketOf(item.state)
    return b === 'serving' || b === 'designated'
  }).length
  const leave = counts.get('leave') ?? 0

  const busy = setState.isPending || setRotation.isPending || pin.isPending || moveStaff.isPending

  const menuItems = (item: StaffSummary): MenuProps['items'] => [
    {
      key: 'state',
      label: '修改状态',
      disabled: !canSchedule || busy,
      children: manualOptions(item).map((option) => ({
        key: `state:${option.state}`,
        label: option.label,
        disabled: option.disabled,
        title: option.reason,
      })),
    },
    {
      key: 'move',
      label: '移动位次',
      disabled: !canWrite || busy || item.queues.length === 0,
      children: item.queues.length === 0
        ? [{ key: 'move:none', label: '尚未分配队列', disabled: true }]
        : item.queues.map((q) => ({
          key: `move:${q.public_id}`,
          label: `${q.seq} · ${q.name}（第 ${q.position} 位）`,
        })),
    },
    {
      key: 'pin',
      label: '留位',
      disabled: !canSchedule || busy || item.queues.length === 0,
      children: item.queues.length === 0
        ? [{ key: 'pin:none', label: '尚未分配队列', disabled: true }]
        : item.queues.map((q) => ({
          key: `pin:${q.public_id}`,
          label: q.pin_type === 'none' ? `留位 · ${q.name}` : `取消留位 · ${q.name}`,
        })),
    },
    { type: 'divider' },
    {
      key: 'rotation',
      label: item.stop_rotation ? '恢复轮转' : '停止轮转',
      disabled: !canSchedule || busy,
    },
    { key: 'detail', label: '查看队列' },
  ]

  const onMenu = (item: StaffSummary, key: string) => {
    setMenuFor(null)
    if (key === 'rotation') {
      setRotation.mutate({ staffId: item.public_id, stop: !item.stop_rotation })
      return
    }
    if (key === 'detail') {
      void openDetail(item.public_id)
      return
    }
    if (key.startsWith('state:')) {
      setState.mutate({ staffId: item.public_id, state: key.slice('state:'.length) })
      return
    }
    if (key.startsWith('move:')) {
      const queueId = key.slice('move:'.length)
      if (queueId === 'none') return
      setMove({ staff: item, queueId })
      setMoveTo('head')
      setMoveIndex(1)
      return
    }
    if (key.startsWith('pin:')) {
      const queueId = key.slice('pin:'.length)
      if (queueId === 'none') return
      const membership = item.queues.find((q) => q.public_id === queueId)
      pin.mutate({
        staffId: item.public_id,
        queueId,
        pinned: membership?.pin_type === 'none',
      })
    }
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Workspace / Staff"
        title="服务人员"
        description="每张卡片按当前状态着色；点击卡片可直接改状态、调位次、留位与停止轮转。"
        actions={
          <Space>
            <Button icon={<ArrowRightOutlined />} onClick={() => navigate('/queues')}>
              返回队列
            </Button>
            {canWrite ? (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => { form.resetFields(); setOpen(true) }}
              >
                新建服务人员
              </Button>
            ) : null}
          </Space>
        }
      />

      <div className="stat-strip">
        <div className="stat-tile">
          <span className="stat-icon slate"><TeamOutlined /></span>
          <div className="stat-text">
            <div className="stat-label">人员总数</div>
            <div className="stat-value">{staff.length}</div>
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
          <span className="stat-icon"><ArrowRightOutlined /></span>
          <div className="stat-text">
            <div className="stat-label">服务中 / 指定</div>
            <div className="stat-value">{serving}</div>
          </div>
        </div>
        <div className="stat-tile">
          <span className="stat-icon amber"><ClockCircleOutlined /></span>
          <div className="stat-text">
            <div className="stat-label">请假</div>
            <div className="stat-value">{leave}</div>
          </div>
        </div>
      </div>

      <section className="panel staff-wall">
        <div className="staff-toolbar">
          <Input
            className="staff-search"
            allowClear
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            prefix={<SearchOutlined />}
            placeholder="搜索姓名或工号"
          />
          <div className="staff-legend" role="group" aria-label="按状态筛选">
            <button
              type="button"
              className={`staff-legend-chip ${bucket === 'all' ? 'is-active' : ''}`}
              onClick={() => setBucket('all')}
            >
              全部<em>{staff.length}</em>
            </button>
            {STAFF_BUCKETS.map((entry) => (
              <button
                key={entry.key}
                type="button"
                data-bucket={entry.key}
                className={`staff-legend-chip ${bucket === entry.key ? 'is-active' : ''}`}
                onClick={() => setBucket(bucket === entry.key ? 'all' : entry.key)}
              >
                <span className="staff-legend-dot" />
                {entry.label}
                <em>{counts.get(entry.key) ?? 0}</em>
              </button>
            ))}
          </div>
        </div>

        {staff.length === 0 ? (
          <EmptyHint>该门店暂无服务人员{canWrite ? '，点击右上角建档' : ''}</EmptyHint>
        ) : visible.length === 0 ? (
          <EmptyHint>没有符合筛选条件的服务人员</EmptyHint>
        ) : (
          <div className="staff-grid">
            {visible.map((item) => {
              const key = bucketOf(item.state)
              const card = (
                <article
                  className="staff-card"
                  data-bucket={key}
                  data-muted={item.status === 'active' ? undefined : 'true'}
                  role="button"
                  tabIndex={0}
                  aria-label={`${item.display_name}，${stateLabel(item.state)}，点击打开操作菜单`}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setMenuFor(item.public_id)
                    }
                    if (event.key === 'Escape') setMenuFor(null)
                  }}
                >
                  <div className="staff-card-top">
                    <Avatar size={36} className="staff-avatar">{item.display_name.slice(0, 1)}</Avatar>
                    <div className="staff-identity">
                      <strong>{item.display_name}</strong>
                      <span>{item.code}</span>
                    </div>
                    <span className="staff-state-pill">{stateLabel(item.state)}</span>
                  </div>

                  <div className="staff-card-queues">
                    {item.queues.length === 0 ? (
                      <span className="staff-queue-empty">未分配队列</span>
                    ) : item.queues.map((q) => (
                      <span className="staff-queue-chip" key={q.public_id}>
                        <b>{q.seq} · {q.name}</b>
                        <em>第 {q.position} 位</em>
                        {q.pin_type !== 'none' ? <i>留位</i> : null}
                      </span>
                    ))}
                  </div>

                  <div className="staff-card-foot">
                    <span className={`pill ${item.duty_status === 'on' ? 'on' : 'off'}`}>
                      {item.duty_status === 'on' ? '在岗' : '离岗'}
                    </span>
                    {item.status !== 'active' ? <span className="pill off">停用</span> : null}
                    {item.stop_rotation ? <span className="staff-no-rotation">不轮转</span> : null}
                    <span className="staff-open-hint">点击操作</span>
                  </div>
                </article>
              )
              return (
                <Dropdown
                  key={item.public_id}
                  trigger={['click']}
                  placement="bottomLeft"
                  menu={{ items: menuItems(item), onClick: ({ key: menuKey }) => onMenu(item, String(menuKey)) }}
                  open={menuFor === item.public_id}
                  onOpenChange={(next) => setMenuFor(next ? item.public_id : null)}
                >
                  {card}
                </Dropdown>
              )
            })}
          </div>
        )}
      </section>

      <Modal
        title="移动位次"
        open={Boolean(move)}
        onCancel={() => setMove(null)}
        onOk={() => {
          if (!move) return
          moveStaff.mutate({
            staffId: move.staff.public_id,
            queueId: move.queueId,
            to: moveTo,
            index: moveTo === 'index' ? moveIndex : undefined,
          })
        }}
        confirmLoading={moveStaff.isPending}
        okText="移动"
        cancelText="取消"
      >
        {move ? (
          <Form layout="vertical">
            <Form.Item label="服务人员">
              <Input value={`${move.staff.display_name}（${move.staff.code}）`} disabled />
            </Form.Item>
            <Form.Item label="目标队列">
              <Select
                value={move.queueId}
                onChange={(value) => setMove({ staff: move.staff, queueId: value })}
                options={move.staff.queues.map((q: StaffQueueRef) => ({
                  value: q.public_id,
                  label: `${q.seq} · ${q.name}（当前第 ${q.position} 位）`,
                }))}
              />
            </Form.Item>
            <Form.Item label="位置">
              <Radio.Group value={moveTo} onChange={(event) => setMoveTo(event.target.value)}>
                <Radio.Button value="head">队首</Radio.Button>
                <Radio.Button value="tail">队尾</Radio.Button>
                <Radio.Button value="index">指定位次</Radio.Button>
              </Radio.Group>
            </Form.Item>
            {moveTo === 'index' ? (
              <Form.Item label="第几位" extra="超出队列长度时按队尾处理">
                <InputNumber min={1} max={99} value={moveIndex} onChange={(v) => setMoveIndex(v ?? 1)} />
              </Form.Item>
            ) : null}
          </Form>
        ) : null}
      </Modal>

      <Modal
        title="新建服务人员"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={create.isPending}
        okText="建档"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" onFinish={(values) => create.mutate(values)}>
          <Form.Item
            name="code"
            label="工号"
            rules={[{ required: true, message: '请输入工号' }, { whitespace: true, message: '工号不能为空' }]}
          >
            <Input maxLength={40} placeholder="例如：S001" />
          </Form.Item>
          <Form.Item
            name="display_name"
            label="姓名"
            rules={[{ required: true, message: '请输入姓名' }, { whitespace: true, message: '姓名不能为空' }]}
          >
            <Input maxLength={60} placeholder="例如：张三" />
          </Form.Item>
        </Form>
      </Modal>

      <StaffDetailModal detail={detail} onClose={() => setDetail(null)} />
    </div>
  )
}

function StaffDetailModal({ detail, onClose }: { detail: StaffDetail | null; onClose: () => void }) {
  return (
    <Modal
      title={detail ? `${detail.display_name}（${detail.code}）所在的队列` : ''}
      open={Boolean(detail)}
      onCancel={onClose}
      footer={<Button onClick={onClose}>关闭</Button>}
    >
      {detail ? (
        sortQueueRefs(detail.queues).length === 0 ? (
          <EmptyHint>该服务人员尚未分配到任何队列，可在「队列」页管理</EmptyHint>
        ) : (
          <Space wrap size={[8, 8]}>
            {sortQueueRefs(detail.queues).map((queue) => (
              <Tag key={queue.public_id} className="staff-detail-queue">
                {queue.seq} · {queue.name}
              </Tag>
            ))}
          </Space>
        )
      ) : null}
    </Modal>
  )
}
