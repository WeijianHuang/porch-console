import { useEffect, useState } from 'react'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Avatar, Button, Card, Checkbox, Form, Input, InputNumber, Modal,
  Space, Tag, Typography, message,
} from 'antd'
import { useNavigate } from 'react-router-dom'
import { queryKeys } from '../api/keys'
import { queuesApi, staffApi } from '../api/queues'
import type { CreateQueueRequest, QueueDetail, Staff } from '../api/types'
import { EmptyHint, ErrorState, PageLoading } from '../components/RequestState'
import { hasPermission, useAuthStore } from '../stores/authStore'
import { useShopStore } from '../stores/shopStore'
import { sortQueueViews } from '../shop/queueSort'

interface QueueForm {
  seq: number
  name: string
}

export default function QueuesPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const shopId = useShopStore((state) => state.currentShopId)
  const permissions = useAuthStore((state) => state.permissions)
  const canWrite = hasPermission(permissions, 'queue.write')
  const [form] = Form.useForm<QueueForm>()
  const [open, setOpen] = useState(false)
  const [selectedQueueId, setSelectedQueueId] = useState<string | null>(null)

  const queuesQuery = useQuery({
    queryKey: queryKeys.queues(shopId ?? ''),
    queryFn: () => queuesApi.list(shopId!),
    enabled: Boolean(shopId),
  })
  const staffQuery = useQuery({
    queryKey: queryKeys.staff(shopId ?? ''),
    queryFn: () => staffApi.list(shopId!),
    enabled: Boolean(shopId) && canWrite,
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

  useEffect(() => {
    setSelectedQueueId(null)
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

  return (
    <Card
      title={<Typography.Title level={4}>队列看板（当前门店）</Typography.Title>}
      extra={
        <Space>
          <Button onClick={() => navigate('/staff')}>服务人员</Button>
          {canWrite ? (
            <Button type="primary" onClick={openCreate}>新建队列</Button>
          ) : null}
        </Space>
      }
    >
      {queueViews.length === 0 ? (
        <EmptyHint>该门店还没有队列{canWrite ? '，点击右上角新建' : ''}</EmptyHint>
      ) : (
        <div className="queue-board">
          {queueViews.map((queue, index) => {
            const detailQuery = detailQueries[index]
            const members = detailQuery?.data?.data?.staff ?? []
            return (
              <section
                key={queue.public_id}
                className="queue-lane"
                aria-label={`队列 ${queue.seq} ${queue.name}`}
              >
                <header className="queue-lane-head">
                  <span className="queue-seq">{queue.seq}</span>
                  <span className="queue-lane-title" title={queue.name}>{queue.name}</span>
                  {queue.status === 'active' ? <Tag color="green">启用</Tag> : <Tag>停用</Tag>}
                </header>
                <div className="queue-lane-meta">
                  <Tag color={queue.staff_count > 0 ? 'blue' : 'default'}>{queue.staff_count} 人</Tag>
                </div>
                <div className="queue-staff-list">
                  {detailQuery?.isPending ? (
                    <div className="queue-lane-empty">服务人员加载中…</div>
                  ) : null}
                  {detailQuery?.isError ? (
                    <div className="queue-lane-empty">服务人员加载失败</div>
                  ) : null}
                  {detailQuery?.isSuccess && members.length === 0 ? (
                    <div className="queue-lane-empty">暂无服务人员</div>
                  ) : null}
                  {members.map((member) => {
                    const code = staffByPublicId.get(member.public_id)?.code
                    return (
                      <article key={member.public_id} className="staff-card">
                        <Avatar size={32} style={{ backgroundColor: '#1677ff', flexShrink: 0 }}>
                          {member.display_name.slice(0, 1)}
                        </Avatar>
                        <div className="staff-card-body">
                          <div className="staff-card-name">{member.display_name}</div>
                          {code ? <div className="staff-card-code">工号 {code}</div> : null}
                        </div>
                      </article>
                    )
                  })}
                </div>
                <footer className="queue-lane-foot">
                  <Button type="link" size="small" onClick={() => setSelectedQueueId(queue.public_id)}>
                    管理
                  </Button>
                </footer>
              </section>
            )
          })}
        </div>
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

      <QueueAssignModal
        shopId={shopId}
        queue={detail}
        staff={staff}
        canWrite={canWrite}
        onClose={() => setSelectedQueueId(null)}
        onChanged={invalidate}
      />
    </Card>
  )
}

interface AssignModalProps {
  shopId: string
  queue: QueueDetail | null
  staff: Staff[]
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
