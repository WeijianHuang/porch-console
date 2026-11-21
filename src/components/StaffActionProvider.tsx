/**
 * Staff operator menu (porch-os ADR-0015 / design/13).
 *
 * The wall, the queue board and the dispatch board all show the same person as
 * a card, so the click menu lives here once: state, position, hold, rotation
 * and queue membership. Cards only spread `menuProps(staff)` onto a <Dropdown>,
 * which keeps the three pages from drifting apart.
 *
 * Every item maps to a real endpoint; nothing is emulated locally.
 */
import { useCallback, useState, type ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Form, Input, InputNumber, Modal, Radio, Select, Space, Tag, message,
} from 'antd'
import type { MenuProps } from 'antd'
import { queryKeys } from '../api/keys'
import { staffApi } from '../api/queues'
import { schedulingApi } from '../api/scheduling'
import type { StaffSummary } from '../api/types'
import { EmptyHint } from './RequestState'
import { sortQueueRefs } from '../shop/queueSort'
import {
  StaffActionContext, nextOpenMenu, staffMenuKey, type StaffActionApi,
} from '../shop/staffActionContext'
import { manualOptions, stateLabel } from '../shop/staffStatus'

interface StaffActionProviderProps {
  shopId: string
  canWrite: boolean
  canSchedule: boolean
  children: ReactNode
}

type MoveTarget = { staff: StaffSummary; queueId: string }
type MoveWhere = 'head' | 'tail' | 'index'

export default function StaffActionProvider({
  shopId, canWrite, canSchedule, children,
}: StaffActionProviderProps) {
  const queryClient = useQueryClient()
  const [openFor, setOpenFor] = useState<string | null>(null)
  const [move, setMove] = useState<MoveTarget | null>(null)
  const [moveTo, setMoveTo] = useState<MoveWhere>('head')
  const [moveIndex, setMoveIndex] = useState(1)
  const [detail, setDetail] = useState<StaffSummary | null>(null)

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.staff(shopId) })
    // Queue details embed duty_status/position; the board embeds state + pin.
    void queryClient.invalidateQueries({ queryKey: ['shop-scope', shopId, 'queue'] })
    void queryClient.invalidateQueries({ queryKey: queryKeys.queues(shopId) })
    void queryClient.invalidateQueries({ queryKey: queryKeys.schedulingBoard(shopId) })
    void queryClient.invalidateQueries({ queryKey: queryKeys.schedulingEvents(shopId) })
  }, [queryClient, shopId])

  const setState = useMutation({
    mutationFn: ({ staffId, state }: { staffId: string; state: string }) =>
      staffApi.setState(shopId, staffId, { state }),
    onSuccess: (res) => {
      message.success(`已置为「${stateLabel(res.data.state)}」`)
      invalidate()
    },
    onError: (error) => message.error((error as Error).message || '状态更新失败'),
  })

  const setRotation = useMutation({
    mutationFn: ({ staffId, stop }: { staffId: string; stop: boolean }) =>
      staffApi.setRotation(shopId, staffId, { stop_rotation: stop }),
    onSuccess: (_res, vars) => {
      message.success(vars.stop ? '已停止轮转' : '已恢复轮转')
      invalidate()
    },
    onError: (error) => message.error((error as Error).message || '轮转设置失败'),
  })

  const pin = useMutation({
    mutationFn: ({ staffId, queueId, pinned }: { staffId: string; queueId: string; pinned: boolean }) =>
      pinned
        ? schedulingApi.pin(shopId, { queue_id: queueId, staff_id: staffId, pin_type: 'permanent' })
        : schedulingApi.unpin(shopId, { queue_id: queueId, staff_id: staffId }),
    onSuccess: (_res, vars) => {
      message.success(vars.pinned ? '已留位（置顶）' : '已取消留位')
      invalidate()
    },
    onError: (error) => message.error((error as Error).message || '留位操作失败'),
  })

  const moveStaff = useMutation({
    mutationFn: (v: { staffId: string; queueId: string; to: MoveWhere; index?: number }) =>
      staffApi.moveInQueue(shopId, v.queueId, v.staffId, { to: v.to, index: v.index }),
    onSuccess: (res) => {
      message.success(`已移动到第 ${res.data.position} 位`)
      setMove(null)
      invalidate()
    },
    onError: (error) => message.error((error as Error).message || '移动位次失败'),
  })

  const busy = setState.isPending || setRotation.isPending || pin.isPending || moveStaff.isPending

  const onMenu = (staff: StaffSummary, cardKey: string, key: string) => {
    setOpenFor((current) => nextOpenMenu(current, cardKey, false))
    if (key === 'rotation') {
      setRotation.mutate({ staffId: staff.public_id, stop: !staff.stop_rotation })
      return
    }
    if (key === 'detail') {
      setDetail(staff)
      return
    }
    if (key.startsWith('state:')) {
      setState.mutate({ staffId: staff.public_id, state: key.slice('state:'.length) })
      return
    }
    if (key.startsWith('move:')) {
      const queueId = key.slice('move:'.length)
      if (queueId === 'none') return
      setMove({ staff, queueId })
      setMoveTo('head')
      setMoveIndex(1)
      return
    }
    if (key.startsWith('pin:')) {
      const queueId = key.slice('pin:'.length)
      if (queueId === 'none') return
      const membership = staff.queues.find((q) => q.public_id === queueId)
      pin.mutate({ staffId: staff.public_id, queueId, pinned: membership?.pin_type === 'none' })
    }
  }

  const queueItems = (staff: StaffSummary, options: { queueId?: string } | undefined, prefix: string) => {
    const queues = sortQueueRefs(staff.queues)
    if (queues.length === 0) {
      return [{ key: `${prefix}:none`, label: '尚未分配队列', disabled: true }]
    }
    // The queue the card was clicked in comes first, so the common case is one
    // click away even when the person sits in several queues.
    const focusId = options?.queueId
    const ordered = focusId
      ? [...queues.filter((q) => q.public_id === focusId), ...queues.filter((q) => q.public_id !== focusId)]
      : queues
    return ordered.map((q) => {
      const suffix = q.public_id === focusId ? ' · 当前' : ''
      return {
        key: `${prefix}:${q.public_id}`,
        label: prefix === 'pin'
          ? `${q.pin_type === 'none' ? '留位' : '取消留位'} · ${q.name}${suffix}`
          : `${q.seq} · ${q.name}（第 ${q.position} 位）${suffix}`,
      }
    })
  }

  const menuItems = (staff: StaffSummary, options?: { queueId?: string }): MenuProps['items'] => [
    {
      key: 'state',
      label: `修改状态（${stateLabel(staff.state)}）`,
      disabled: !canSchedule || busy,
      children: manualOptions(staff).map((option) => ({
        key: `state:${option.state}`,
        label: option.label,
        disabled: option.disabled,
        title: option.reason,
      })),
    },
    {
      key: 'move',
      label: '移动位次',
      disabled: !canWrite || busy || staff.queues.length === 0,
      children: queueItems(staff, options, 'move'),
    },
    {
      key: 'pin',
      label: '留位',
      disabled: !canSchedule || busy || staff.queues.length === 0,
      children: queueItems(staff, options, 'pin'),
    },
    { type: 'divider' },
    {
      key: 'rotation',
      label: staff.stop_rotation ? '恢复轮转' : '停止轮转',
      disabled: !canSchedule || busy,
    },
    { key: 'detail', label: '查看队列' },
  ]

  const api: StaffActionApi = {
    canWrite,
    canSchedule,
    menuProps: (staff, options) => {
      const cardKey = staffMenuKey(staff.public_id, options)
      return {
        trigger: ['click'],
        placement: 'bottomLeft',
        menu: {
          items: menuItems(staff, options),
          onClick: ({ key }) => onMenu(staff, cardKey, String(key)),
        },
        open: openFor === cardKey,
        // Opening another card replaces the old one; closing an already
        // unrelated card must not clear the newly opened menu.
        onOpenChange: (next) => setOpenFor((current) => nextOpenMenu(current, cardKey, next)),
      }
    },
  }

  return (
    <StaffActionContext.Provider value={api}>
      {children}

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
                options={sortQueueRefs(move.staff.queues).map((q) => ({
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
        title={detail ? `${detail.display_name}（${detail.code}）所在的队列` : ''}
        open={Boolean(detail)}
        onCancel={() => setDetail(null)}
        footer={<Button onClick={() => setDetail(null)}>关闭</Button>}
      >
        {detail ? (
          detail.queues.length === 0 ? (
            <EmptyHint>该服务人员尚未分配到任何队列</EmptyHint>
          ) : (
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              {sortQueueRefs(detail.queues).map((queue) => (
                <div className="staff-detail-row" key={queue.public_id}>
                  <Tag>{queue.seq} · {queue.name}</Tag>
                  <span className="muted">第 {queue.position} 位</span>
                  {queue.pin_type !== 'none' ? <Tag color="gold">留位</Tag> : null}
                </div>
              ))}
              <span className="muted">
                {detail.stop_rotation ? '已停止轮转' : '参与轮转'}
                {' · '}
                {detail.duty_status === 'on' ? '在岗' : '离岗'}
              </span>
            </Space>
          )
        ) : null}
      </Modal>
    </StaffActionContext.Provider>
  )
}
