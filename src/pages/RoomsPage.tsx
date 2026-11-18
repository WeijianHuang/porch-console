import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ApartmentOutlined, CheckCircleOutlined, PlusOutlined, PoweroffOutlined,
} from '@ant-design/icons'
import { Button, Card, Form, InputNumber, Input, Modal, Space, Tooltip, message } from 'antd'
import { queryKeys } from '../api/keys'
import { roomsApi } from '../api/rooms'
import type { CreateRoomRequest, Room, UpdateRoomRequest } from '../api/types'
import PageHeader from '../components/PageHeader'
import { EmptyHint, ErrorState, PageLoading } from '../components/RequestState'
import { groupByFloor } from '../shop/roomGroup'
import { hasPermission, useAuthStore } from '../stores/authStore'
import { useShopStore } from '../stores/shopStore'

interface RoomForm {
  floor: number
  code: string
  name: string
}

export default function RoomsPage() {
  const queryClient = useQueryClient()
  const shopId = useShopStore((state) => state.currentShopId)
  const permissions = useAuthStore((state) => state.permissions)
  const canWrite = hasPermission(permissions, 'room.write')
  const [form] = Form.useForm<RoomForm>()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Room | null>(null)

  const roomsQuery = useQuery({
    queryKey: queryKeys.rooms(shopId ?? ''),
    queryFn: () => roomsApi.list(shopId!),
    enabled: Boolean(shopId),
  })

  const invalidate = () => {
    if (shopId) void queryClient.invalidateQueries({ queryKey: queryKeys.rooms(shopId) })
  }

  const save = useMutation({
    mutationFn: ({ roomId, body }: { roomId?: string; body: CreateRoomRequest | UpdateRoomRequest }) =>
      roomId ? roomsApi.update(shopId!, roomId, body as UpdateRoomRequest) : roomsApi.create(shopId!, body as CreateRoomRequest),
    onSuccess: () => {
      setOpen(false)
      setEditing(null)
      form.resetFields()
      message.success(editing ? '房间已更新' : '房间已创建')
      invalidate()
    },
    onError: (error) => message.error((error as Error).message || '保存失败'),
  })

  const toggleStatus = useMutation({
    mutationFn: (room: Room) =>
      roomsApi.update(shopId!, room.public_id, {
        status: room.status === 'active' ? 'inactive' : 'active',
        version: room.version,
      }),
    onSuccess: () => {
      message.success('房间状态已更新')
      invalidate()
    },
    onError: (error) => message.error((error as Error).message || '状态更新失败'),
  })

  const remove = useMutation({
    mutationFn: (roomId: string) => roomsApi.remove(shopId!, roomId),
    onSuccess: () => {
      message.success('房间已删除')
      invalidate()
    },
    onError: (error) => message.error((error as Error).message || '删除失败'),
  })

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ floor: 1 })
    setOpen(true)
  }

  const openEdit = (room: Room) => {
    setEditing(room)
    form.setFieldsValue({ floor: room.floor, code: room.code, name: room.name })
    setOpen(true)
  }

  const submit = (values: RoomForm) => {
    if (editing) {
      save.mutate({ roomId: editing.public_id, body: { ...values, version: editing.version } })
    } else {
      save.mutate({ body: values })
    }
  }

  if (!shopId) return <EmptyHint>请先选择一个门店</EmptyHint>
  if (roomsQuery.isPending) return <PageLoading />
  if (roomsQuery.error) {
    return <ErrorState error={roomsQuery.error} onRetry={() => void roomsQuery.refetch()} />
  }

  const rooms = roomsQuery.data?.data ?? []
  const groups = groupByFloor(rooms)
  const activeCount = rooms.filter((r) => r.status === 'active').length

  return (
    <div className="page">
      <PageHeader
        eyebrow="Workspace / Rooms"
        title="房间管理"
        description="按楼层分区维护本店房间；楼层为数字（负数表示地下），房间号在门店内唯一。"
        actions={
          <Space>
            {canWrite ? (
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                新建房间
              </Button>
            ) : null}
          </Space>
        }
      />

      <div className="stat-strip">
        <div className="stat-tile">
          <span className="stat-icon slate"><ApartmentOutlined /></span>
          <div className="stat-text">
            <div className="stat-label">房间总数</div>
            <div className="stat-value">{rooms.length}</div>
          </div>
        </div>
        <div className="stat-tile">
          <span className="stat-icon"><CheckCircleOutlined /></span>
          <div className="stat-text">
            <div className="stat-label">启用中</div>
            <div className="stat-value">{activeCount}</div>
          </div>
        </div>
        <div className="stat-tile">
          <span className="stat-icon amber"><PoweroffOutlined /></span>
          <div className="stat-text">
            <div className="stat-label">楼层数</div>
            <div className="stat-value">{groups.length}</div>
          </div>
        </div>
      </div>

      {groups.length === 0 ? (
        <Card className="panel">
          <EmptyHint>该门店暂无房间{canWrite ? '，点击右上角新建' : ''}</EmptyHint>
        </Card>
      ) : (
        <div className="floor-list">
          {groups.map((group) => (
            <Card className="panel floor-panel" key={group.floor}>
              <div className="floor-panel-head">
                <div className="floor-panel-title">
                  <span className="floor-badge">{group.label}</span>
                  <strong>{group.floor < 0 ? '地下' : group.floor === 0 ? '地面层' : '地上'}楼层</strong>
                </div>
                <span className="floor-count">{group.rooms.length} 间</span>
              </div>
              <div className="card-grid">
                {group.rooms.map((room) => (
                  <article className={`entity-card room-card ${room.status === 'inactive' ? 'is-inactive' : ''}`} key={room.public_id}>
                    <div className="entity-card-head">
                      <span className="room-code">{room.code}</span>
                      <div className="entity-card-title">
                        <strong>{room.name}</strong>
                        <span>{group.label} · {room.code}</span>
                      </div>
                    </div>
                    <div className="entity-card-meta">
                      <span className={`pill ${room.status === 'active' ? 'on' : 'off'}`}>
                        {room.status === 'active' ? '启用' : '停用'}
                      </span>
                    </div>
                    {canWrite ? (
                      <div className="entity-card-foot">
                        <Button type="link" size="small" onClick={() => openEdit(room)}>编辑</Button>
                        <Tooltip title={room.status === 'active' ? '停用房间' : '启用房间'}>
                          <Button
                            size="small"
                            loading={toggleStatus.isPending}
                            onClick={() => toggleStatus.mutate(room)}
                          >
                            {room.status === 'active' ? '停用' : '启用'}
                          </Button>
                        </Tooltip>
                        <Button
                          size="small"
                          danger
                          loading={remove.isPending}
                          onClick={() => {
                            Modal.confirm({
                              title: '删除房间',
                              content: `确定删除「${room.name}（${room.code}）」吗？此操作不可撤销。`,
                              okText: '删除',
                              okButtonProps: { danger: true },
                              cancelText: '取消',
                              onOk: () => remove.mutate(room.public_id),
                            })
                          }}
                        >
                          删除
                        </Button>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        title={editing ? '编辑房间' : '新建房间'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={save.isPending}
        okText={editing ? '保存' : '创建'}
        cancelText="取消"
      >
        <Form form={form} layout="vertical" onFinish={submit}>
          <Form.Item
            name="floor"
            label="楼层"
            extra="整数：1 表示 1F，0 表示地面层，-1 表示 B1"
            rules={[
              { required: true, message: '请输入楼层' },
              { type: 'number', min: -5, max: 200, message: '楼层需在 -5 到 200 之间' },
            ]}
          >
            <InputNumber style={{ width: '100%' }} placeholder="例如：1" />
          </Form.Item>
          <Form.Item
            name="code"
            label="房间号"
            rules={[
              { required: true, message: '请输入房间号' },
              { whitespace: true, message: '房间号不能为空' },
            ]}
          >
            <Input maxLength={40} placeholder="例如：101" />
          </Form.Item>
          <Form.Item
            name="name"
            label="房间名称"
            rules={[
              { required: true, message: '请输入房间名称' },
              { whitespace: true, message: '房间名称不能为空' },
            ]}
          >
            <Input maxLength={60} placeholder="例如：标准间 A" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
