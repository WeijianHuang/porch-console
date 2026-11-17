import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button, Card, Form, Input, Modal, Space, Table, Tag, Typography, message,
} from 'antd'
import { useNavigate } from 'react-router-dom'
import { queryKeys } from '../api/keys'
import { staffApi } from '../api/queues'
import type { CreateStaffRequest, Staff, StaffDetail, UpdateStaffRequest } from '../api/types'
import { EmptyHint, ErrorState, PageLoading } from '../components/RequestState'
import { hasPermission, useAuthStore } from '../stores/authStore'
import { useShopStore } from '../stores/shopStore'
import { sortQueueRefs } from '../shop/queueSort'

interface StaffForm {
  code: string
  display_name: string
}

export default function StaffPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const shopId = useShopStore((state) => state.currentShopId)
  const permissions = useAuthStore((state) => state.permissions)
  const canWrite = hasPermission(permissions, 'queue.write')
  const [form] = Form.useForm<StaffForm>()
  const [open, setOpen] = useState(false)
  const [detail, setDetail] = useState<StaffDetail | null>(null)

  const staffQuery = useQuery({
    queryKey: queryKeys.staff(shopId ?? ''),
    queryFn: () => staffApi.list(shopId!),
    enabled: Boolean(shopId),
  })

  const create = useMutation({
    mutationFn: (body: CreateStaffRequest) => staffApi.create(shopId!, body),
    onSuccess: () => {
      setOpen(false)
      form.resetFields()
      message.success('服务人员已建档')
      if (shopId) void queryClient.invalidateQueries({ queryKey: queryKeys.staff(shopId) })
    },
    onError: (error) => message.error((error as Error).message || '建档失败'),
  })

  const setDuty = useMutation({
    mutationFn: ({ staffId, body }: { staffId: string; body: UpdateStaffRequest }) =>
      staffApi.update(shopId!, staffId, body),
    onSuccess: () => {
      message.success('在岗状态已更新')
      if (!shopId) return
      void queryClient.invalidateQueries({ queryKey: queryKeys.staff(shopId) })
      // Queue details embed duty_status on every StaffRef (ADR-0010).
      void queryClient.invalidateQueries({ queryKey: ['shop-scope', shopId, 'queue'] })
    },
    onError: (error) => message.error((error as Error).message || '状态更新失败'),
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

  if (!shopId) return <EmptyHint>请先选择一个门店</EmptyHint>
  if (staffQuery.isPending) return <PageLoading />
  if (staffQuery.error) {
    return <ErrorState error={staffQuery.error} onRetry={() => void staffQuery.refetch()} />
  }

  const staff = staffQuery.data?.data ?? []

  return (
    <Card
      title={<Typography.Title level={4}>服务人员（当前门店）</Typography.Title>}
      extra={
        <Space>
          <Button onClick={() => navigate('/queues')}>返回队列</Button>
          {canWrite ? (
            <Button type="primary" onClick={() => { form.resetFields(); setOpen(true) }}>
              新建服务人员
            </Button>
          ) : null}
        </Space>
      }
    >
      {staff.length === 0 ? (
        <EmptyHint>该门店暂无服务人员{canWrite ? '，点击右上角建档' : ''}</EmptyHint>
      ) : (
        <Table<Staff>
          rowKey="public_id"
          dataSource={staff}
          pagination={false}
          columns={[
            { title: '工号', dataIndex: 'code', width: 120 },
            { title: '姓名', dataIndex: 'display_name' },
            {
              title: '状态',
              dataIndex: 'status',
              width: 100,
              render: (status: string) =>
                status === 'active' ? <Tag color="green">在职</Tag> : <Tag>停用</Tag>,
            },
            {
              title: '在岗',
              dataIndex: 'duty_status',
              width: 90,
              render: (duty: string) =>
                duty === 'on' ? <Tag color="blue">在岗</Tag> : <Tag>下班</Tag>,
            },
            {
              title: '操作',
              key: 'actions',
              width: 180,
              render: (_: unknown, item: Staff) => (
                <Space size={0}>
                  <Button type="link" onClick={() => void openDetail(item.public_id)}>
                    查看队列
                  </Button>
                  {canWrite && item.status === 'active' ? (
                    <Button
                      type="link"
                      loading={setDuty.isPending}
                      onClick={() => setDuty.mutate({
                        staffId: item.public_id,
                        body: {
                          duty_status: item.duty_status === 'on' ? 'off' : 'on',
                          version: item.version,
                        },
                      })}
                    >
                      {item.duty_status === 'on' ? '下班' : '上班'}
                    </Button>
                  ) : null}
                </Space>
              ),
            },
          ]}
        />
      )}

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
    </Card>
  )
}

function StaffDetailModal({ detail, onClose }: { detail: StaffDetail | null; onClose: () => void }) {
  const [queues, setQueues] = useState(detail?.queues ?? [])
  useEffect(() => { setQueues(detail?.queues ?? []) }, [detail])

  return (
    <Modal
      title={detail ? `${detail.display_name}（${detail.code}）所在的队列` : ''}
      open={Boolean(detail)}
      onCancel={onClose}
      footer={<Button onClick={onClose}>关闭</Button>}
    >
      {detail ? (
        sortQueueRefs(queues).length === 0 ? (
          <EmptyHint>该服务人员尚未分配到任何队列，可在「队列」页管理</EmptyHint>
        ) : (
          <Space direction="vertical" style={{ width: '100%' }}>
            {sortQueueRefs(queues).map((q) => (
              <Card key={q.public_id} size="small" title={`${q.name}（序号 ${q.seq}）`} />
            ))}
          </Space>
        )
      ) : null}
    </Modal>
  )
}
