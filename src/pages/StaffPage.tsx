import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRightOutlined, CheckCircleOutlined, ClockCircleOutlined, PlusOutlined, TeamOutlined,
} from '@ant-design/icons'
import { Avatar, Button, Card, Form, Input, Modal, Space, message } from 'antd'
import { useNavigate } from 'react-router-dom'
import { queryKeys } from '../api/keys'
import { staffApi } from '../api/queues'
import type { CreateStaffRequest, StaffDetail, UpdateStaffRequest } from '../api/types'
import PageHeader from '../components/PageHeader'
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
  const onDuty = staff.filter((item) => item.duty_status === 'on').length

  return (
    <div className="page">
      <PageHeader
        eyebrow="Workspace / Staff"
        title="服务人员"
        description="在本店建档并管理人员；在岗状态会同步显示在队列看板的服务人员卡片上。"
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
          <span className="stat-icon amber"><ClockCircleOutlined /></span>
          <div className="stat-text">
            <div className="stat-label">下班</div>
            <div className="stat-value">{staff.length - onDuty}</div>
          </div>
        </div>
      </div>

      <Card className="panel">
        {staff.length === 0 ? (
          <EmptyHint>该门店暂无服务人员{canWrite ? '，点击右上角建档' : ''}</EmptyHint>
        ) : (
          <div className="card-grid">
            {staff.map((item) => (
              <article className="entity-card" key={item.public_id}>
                <div className="entity-card-head">
                  <Avatar
                    size={42}
                    className="entity-avatar"
                    style={{ backgroundColor: 'transparent', color: 'inherit' }}
                  >
                    {item.display_name.slice(0, 1)}
                  </Avatar>
                  <div className="entity-card-title">
                    <strong>{item.display_name}</strong>
                    <span>{item.code}</span>
                  </div>
                </div>
                <div className="entity-card-meta">
                  <span className={`pill ${item.status === 'active' ? 'on' : 'off'}`}>
                    {item.status === 'active' ? '在职' : '停用'}
                  </span>
                  <span className={`pill ${item.duty_status === 'on' ? 'on' : 'off'}`}>
                    {item.duty_status === 'on' ? '在岗' : '下班'}
                  </span>
                </div>
                <div className="entity-card-foot">
                  <Button type="link" onClick={() => void openDetail(item.public_id)}>
                    查看队列
                  </Button>
                  {canWrite && item.status === 'active' ? (
                    <Button
                      type={item.duty_status === 'on' ? 'default' : 'primary'}
                      size="small"
                      loading={setDuty.isPending}
                      onClick={() => setDuty.mutate({
                        staffId: item.public_id,
                        body: {
                          duty_status: item.duty_status === 'on' ? 'off' : 'on',
                          version: item.version,
                        },
                      })}
                    >
                      {item.duty_status === 'on' ? '标记下班' : '标记上班'}
                    </Button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
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
    </div>
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
          <div className="card-grid">
            {sortQueueRefs(queues).map((queue) => (
              <div className="entity-card" key={queue.public_id}>
                <div className="entity-card-head">
                  <span className="entity-avatar">{queue.seq}</span>
                  <div className="entity-card-title">
                    <strong>{queue.name}</strong>
                    <span>序号 {queue.seq}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : null}
    </Modal>
  )
}
