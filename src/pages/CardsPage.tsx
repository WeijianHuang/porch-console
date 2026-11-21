/** ID card administration (porch-os ADR-0017 / design/14). */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PlusOutlined, PoweroffOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { Button, Card, Form, Input, Modal, Segmented, Select, Space, Tag, Tooltip, message } from 'antd'
import { cardsApi } from '../api/cards'
import { staffApi } from '../api/queues'
import { queryKeys } from '../api/keys'
import type { CreateCardRequest, IdCard, StaffSummary } from '../api/types'
import PageHeader from '../components/PageHeader'
import { EmptyHint, ErrorState, PageLoading } from '../components/RequestState'
import { hasPermission, useAuthStore } from '../stores/authStore'
import { useShopStore } from '../stores/shopStore'

type StatusFilter = 'all' | 'active' | 'inactive' | 'held'

interface CardForm {
  code: string
  name: string
}

export default function CardsPage() {
  const shopId = useShopStore((state) => state.currentShopId)
  const permissions = useAuthStore((state) => state.permissions)
  const canWrite = hasPermission(permissions, 'card.write')
  const queryClient = useQueryClient()
  const [form] = Form.useForm<CardForm>()
  const [open, setOpen] = useState(false)
  const [holdTarget, setHoldTarget] = useState<IdCard | null>(null)
  const [staffId, setStaffId] = useState<string | undefined>()
  const [filter, setFilter] = useState<StatusFilter>('all')

  const cardsQ = useQuery({
    queryKey: queryKeys.cards(shopId ?? ''),
    queryFn: () => cardsApi.list(shopId!),
    enabled: Boolean(shopId),
  })
  const staffQ = useQuery({
    queryKey: queryKeys.staff(shopId ?? ''),
    queryFn: () => staffApi.list(shopId!),
    enabled: Boolean(shopId),
  })

  const invalidate = () => {
    if (!shopId) return
    void queryClient.invalidateQueries({ queryKey: queryKeys.cards(shopId) })
    void queryClient.invalidateQueries({ queryKey: queryKeys.staff(shopId) })
    void queryClient.invalidateQueries({ queryKey: queryKeys.schedulingBoard(shopId) })
  }

  const create = useMutation({
    mutationFn: (body: CreateCardRequest) => cardsApi.create(shopId!, body),
    onSuccess: () => { message.success('卡片已建档'); setOpen(false); form.resetFields(); invalidate() },
    onError: (e) => message.error((e as Error).message || '建档失败'),
  })
  const setStatus = useMutation({
    mutationFn: ({ card, status }: { card: IdCard; status: 'active' | 'inactive' }) =>
      cardsApi.update(shopId!, card.public_id, { status, version: card.version }),
    onSuccess: (_r, v) => { message.success(v.status === 'active' ? '已生效' : '已失效'); invalidate() },
    onError: (e) => message.error((e as Error).message || '状态更新失败'),
  })
  const hold = useMutation({
    mutationFn: ({ card, staff }: { card: IdCard; staff: string }) =>
      cardsApi.hold(shopId!, card.public_id, { staff_id: staff }),
    onSuccess: () => { message.success('已绑定服务人员'); setHoldTarget(null); setStaffId(undefined); invalidate() },
    onError: (e) => message.error((e as Error).message || '绑定失败'),
  })
  const release = useMutation({
    mutationFn: (card: IdCard) => cardsApi.release(shopId!, card.public_id, { reason: 'console' }),
    onSuccess: () => { message.success('已解除绑定'); invalidate() },
    onError: (e) => message.error((e as Error).message || '解绑失败'),
  })

  if (!shopId) return <EmptyHint>请先选择门店</EmptyHint>
  if (cardsQ.isPending) return <PageLoading />
  if (cardsQ.isError) return <ErrorState error={cardsQ.error} onRetry={() => void cardsQ.refetch()} />

  const all = cardsQ.data?.data ?? []
  const staffList = (staffQ.data?.data ?? []) as StaffSummary[]
  const visible = all.filter((c) => {
    if (filter === 'all') return true
    if (filter === 'held') return Boolean(c.holder)
    return c.status === filter
  })

  const openHold = (card: IdCard) => {
    setHoldTarget(card)
    setStaffId(card.holder?.public_id ?? staffList.find((s) => !s.id_card)?.public_id)
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Workspace / ID Cards"
        title="ID 卡管理"
        description="店内卡片档案与持有关系：同一时刻一张卡只被一人持有，一人也只持有一张卡。"
        actions={canWrite ? (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>新建卡片</Button>
        ) : undefined}
      />
      <Card className="panel">
        <div className="staff-toolbar">
          <Segmented<StatusFilter>
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: `全部 ${all.length}` },
              { value: 'active', label: `生效 ${all.filter((c) => c.status === 'active').length}` },
              { value: 'held', label: `已持有 ${all.filter((c) => c.holder).length}` },
              { value: 'inactive', label: `失效 ${all.filter((c) => c.status === 'inactive').length}` },
            ]}
          />
        </div>
        {visible.length === 0 ? <EmptyHint>没有符合条件的卡片</EmptyHint> : (
          <div className="card-admin-grid">
            {visible.map((card) => (
              <div className="card-admin-item" key={card.public_id} data-status={card.status}>
                <div className="card-admin-head">
                  <strong>{card.name}</strong>
                  <Tag color={card.status === 'active' ? 'green' : 'default'}>
                    {card.status === 'active' ? '生效' : '失效'}
                  </Tag>
                </div>
                <div className="card-admin-code">{card.code}</div>
                <div className="card-admin-holder">
                  {card.holder ? (
                    <>
                      <span>持有：{card.holder.display_name}</span>
                      <span className="muted">自 {new Date(card.holder.held_from).toLocaleString('zh-CN', { hour12: false })}</span>
                    </>
                  ) : <span className="muted">未被持有</span>}
                </div>
                {canWrite ? (
                  <Space size={4} wrap>
                    {card.holder ? (
                      <Button size="small" disabled={release.isPending} onClick={() => release.mutate(card)}>
                        解除绑定
                      </Button>
                    ) : (
                      <Button size="small" type="primary" disabled={card.status !== 'active'} onClick={() => openHold(card)}>
                        绑定人员
                      </Button>
                    )}
                    <Tooltip title={card.holder ? '请先解除绑定' : ''}>
                      <Button
                        size="small"
                        icon={card.status === 'active' ? <PoweroffOutlined /> : <CheckCircleOutlined />}
                        disabled={Boolean(card.holder) || setStatus.isPending}
                        onClick={() => setStatus.mutate({
                          card, status: card.status === 'active' ? 'inactive' : 'active',
                        })}
                      >
                        {card.status === 'active' ? '置失效' : '置生效'}
                      </Button>
                    </Tooltip>
                  </Space>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        title="新建 ID 卡"
        open={open}
        onCancel={() => { setOpen(false); form.resetFields() }}
        onOk={() => form.submit()}
        confirmLoading={create.isPending}
        okText="创建"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" onFinish={(v) => create.mutate(v)}>
          <Form.Item label="卡号" name="code" rules={[{ required: true, message: '请输入卡号' }]}>
            <Input placeholder="店内唯一，例如 C-001" />
          </Form.Item>
          <Form.Item label="卡片名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="例如 一号卡" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={holdTarget ? `绑定人员 · ${holdTarget.name}` : ''}
        open={Boolean(holdTarget)}
        onCancel={() => { setHoldTarget(null); setStaffId(undefined) }}
        onOk={() => { if (holdTarget && staffId) hold.mutate({ card: holdTarget, staff: staffId }) }}
        confirmLoading={hold.isPending}
        okText="绑定"
        cancelText="取消"
      >
        <Select
          style={{ width: '100%' }}
          placeholder="选择服务人员"
          value={staffId}
          onChange={setStaffId}
          options={staffList.map((s) => ({
            value: s.public_id,
            label: `${s.display_name}（${s.code}）${s.id_card ? ' · 已持卡' : ''}`,
          }))}
        />
      </Modal>
    </div>
  )
}
