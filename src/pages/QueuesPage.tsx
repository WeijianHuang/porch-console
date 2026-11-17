import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button, Card, Checkbox, Divider, Form, Input, InputNumber, List, Modal,
  Space, Table, Tag, Typography, message,
} from 'antd'
import { useNavigate } from 'react-router-dom'
import { queryKeys } from '../api/keys'
import { queuesApi, staffApi } from '../api/queues'
import type { CreateQueueRequest, QueueDetail, QueueView, Staff } from '../api/types'
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
  const [detail, setDetail] = useState<QueueDetail | null>(null)

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

  const invalidate = () => {
    if (!shopId) return
    void queryClient.invalidateQueries({ queryKey: queryKeys.queues(shopId) })
    void queryClient.invalidateQueries({ queryKey: queryKeys.staff(shopId) })
    if (detail) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.queue(shopId, detail.public_id) })
    }
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

  const openDetail = async (queueId: string) => {
    if (!shopId) return
    try {
      const response = await queuesApi.get(shopId, queueId)
      setDetail(response.data)
    } catch (error) {
      message.error((error as Error).message || '加载队列详情失败')
    }
  }

  if (!shopId) return <EmptyHint>请先选择一个门店</EmptyHint>
  if (queuesQuery.isPending) return <PageLoading />
  if (queuesQuery.error) {
    return <ErrorState error={queuesQuery.error} onRetry={() => void queuesQuery.refetch()} />
  }

  const queues = sortQueueViews(queuesQuery.data?.data ?? [])
  const staff = staffQuery.data?.data ?? []

  return (
    <Card
      title={<Typography.Title level={4}>队列（当前门店）</Typography.Title>}
      extra={
        <Space>
          <Button onClick={() => navigate('/staff')}>服务人员</Button>
          {canWrite ? (
            <Button type="primary" onClick={openCreate}>新建队列</Button>
          ) : null}
        </Space>
      }
    >
      {queues.length === 0 ? (
        <EmptyHint>该门店还没有队列{canWrite ? '，点击右上角新建' : ''}</EmptyHint>
      ) : (
        <Table<QueueView>
          rowKey="public_id"
          dataSource={queues}
          pagination={false}
          columns={[
            { title: '序号', dataIndex: 'seq', width: 80, sorter: (a, b) => a.seq - b.seq },
            { title: '名称', dataIndex: 'name' },
            {
              title: '服务人员',
              dataIndex: 'staff_count',
              width: 120,
              render: (count: number) => <Tag color={count > 0 ? 'blue' : 'default'}>{count} 人</Tag>,
            },
            {
              title: '状态',
              dataIndex: 'status',
              width: 100,
              render: (status: string) =>
                status === 'active' ? <Tag color="green">启用</Tag> : <Tag>停用</Tag>,
            },
            {
              title: '操作',
              key: 'actions',
              width: 100,
              render: (_: unknown, item: QueueView) => (
                <Button type="link" onClick={() => void openDetail(item.public_id)}>
                  管理
                </Button>
              ),
            },
          ]}
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

      <QueueAssignModal
        shopId={shopId}
        queue={detail}
        staff={staff}
        canWrite={canWrite}
        onClose={() => setDetail(null)}
        onChanged={invalidate}
        onReload={openDetail}
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
  onReload: (queueId: string) => void
}

function QueueAssignModal({ shopId, queue, staff, canWrite, onClose, onChanged, onReload }: AssignModalProps) {
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
      if (queue) onReload(queue.public_id)
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
        <>
          <Typography.Text type="secondary">服务人员（勾选即加入该队列，可跨多个队列）</Typography.Text>
          <Divider style={{ margin: '12px 0' }} />
          <List
            dataSource={staff}
            locale={{ emptyText: '该门店暂无服务人员，请先在「服务人员」页建档' }}
            renderItem={(item) => (
              <List.Item>
                <Checkbox
                  checked={selected.includes(item.public_id)}
                  disabled={!canWrite || mutate.isPending}
                  onChange={(e) => toggle(item.public_id, e.target.checked)}
                >
                  {item.display_name} <Typography.Text type="secondary">（{item.code}）</Typography.Text>
                </Checkbox>
              </List.Item>
            )}
          />
        </>
      ) : null}
    </Modal>
  )
}
