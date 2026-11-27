import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ClockCircleOutlined, DeleteOutlined, EditOutlined, PlusOutlined, TeamOutlined,
} from '@ant-design/icons'
import {
  Button, Card, Checkbox, Form, Input, InputNumber, Modal, Space, Switch,
  Table, Tag, Tooltip, message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { queryKeys } from '../api/keys'
import { staffApi } from '../api/queues'
import { shiftTemplatesApi } from '../api/shiftTemplates'
import type {
  CreateShiftTemplateRequest, ShiftTemplate, StaffSummary, UpdateShiftTemplateRequest,
} from '../api/types'
import PageHeader from '../components/PageHeader'
import { EmptyHint, ErrorState, PageLoading } from '../components/RequestState'
import { hasPermission, useAuthStore } from '../stores/authStore'
import { useShopStore } from '../stores/shopStore'

interface ShiftForm {
  name: string
  start_time: string
  end_time: string
  check_in_lead_minutes: number
  next_day_flag: boolean
  sort_order: number
}

const timePattern = /^([01][0-9]|2[0-3]):[0-5][0-9]$/

export default function ShiftTemplatesPage() {
  const queryClient = useQueryClient()
  const shopId = useShopStore((state) => state.currentShopId)
  const permissions = useAuthStore((state) => state.permissions)
  const canWrite = hasPermission(permissions, 'queue.write')
  const [form] = Form.useForm<ShiftForm>()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ShiftTemplate | null>(null)
  const [assigning, setAssigning] = useState<ShiftTemplate | null>(null)
  const [selectedStaff, setSelectedStaff] = useState<string[]>([])

  const templatesQuery = useQuery({
    queryKey: queryKeys.shiftTemplates(shopId ?? ''),
    queryFn: () => shiftTemplatesApi.list(shopId!),
    enabled: Boolean(shopId),
  })
  const staffQuery = useQuery({
    queryKey: queryKeys.staff(shopId ?? ''),
    queryFn: () => staffApi.list(shopId!),
    enabled: Boolean(shopId),
  })

  const invalidate = () => {
    if (!shopId) return
    void queryClient.invalidateQueries({ queryKey: queryKeys.shiftTemplates(shopId) })
    void queryClient.invalidateQueries({ queryKey: queryKeys.staff(shopId) })
  }

  const save = useMutation({
    mutationFn: ({ templateId, body }: {
      templateId?: string
      body: CreateShiftTemplateRequest | UpdateShiftTemplateRequest
    }) =>
      templateId
        ? shiftTemplatesApi.update(shopId!, templateId, body as UpdateShiftTemplateRequest)
        : shiftTemplatesApi.create(shopId!, body as CreateShiftTemplateRequest),
    onSuccess: () => {
      setOpen(false)
      setEditing(null)
      form.resetFields()
      message.success(editing ? '班次已更新' : '班次已创建')
      invalidate()
    },
    onError: (error) => message.error((error as Error).message || '保存失败'),
  })

  const remove = useMutation({
    mutationFn: (templateId: string) => shiftTemplatesApi.remove(shopId!, templateId),
    onSuccess: () => {
      message.success('班次已删除，原成员已解除分配')
      invalidate()
    },
    onError: (error) => message.error((error as Error).message || '删除失败'),
  })

  const assign = useMutation({
    mutationFn: ({ templateId, staff_ids, version }: {
      templateId: string
      staff_ids: string[]
      version: number
    }) => shiftTemplatesApi.assignStaff(shopId!, templateId, { staff_public_ids: staff_ids, version }),
    onSuccess: () => {
      setAssigning(null)
      setSelectedStaff([])
      message.success('班次成员已更新')
      invalidate()
    },
    onError: (error) => message.error((error as Error).message || '分配失败，请刷新后重试'),
  })

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({
      check_in_lead_minutes: 0,
      next_day_flag: false,
      sort_order: 0,
    })
    setOpen(true)
  }

  const openEdit = (template: ShiftTemplate) => {
    setEditing(template)
    form.setFieldsValue({
      name: template.name,
      start_time: template.start_time,
      end_time: template.end_time,
      check_in_lead_minutes: template.check_in_lead_minutes,
      next_day_flag: template.next_day_flag,
      sort_order: template.sort_order,
    })
    setOpen(true)
  }

  const openAssign = (template: ShiftTemplate) => {
    setAssigning(template)
    const members = (staffQuery.data?.data ?? [])
      .filter((person) => person.shift_template?.public_id === template.public_id)
      .map((person) => person.public_id)
    setSelectedStaff(members)
  }

  const submit = (values: ShiftForm) => {
    if (editing) {
      save.mutate({ templateId: editing.public_id, body: { ...values, version: editing.version } })
    } else {
      save.mutate({ body: values })
    }
  }

  if (!shopId) return <EmptyHint>请先选择一个门店</EmptyHint>
  if (templatesQuery.isPending) return <PageLoading />
  if (templatesQuery.error) {
    return <ErrorState error={templatesQuery.error} onRetry={() => void templatesQuery.refetch()} />
  }

  const templates = templatesQuery.data?.data ?? []
  const staff = staffQuery.data?.data ?? []
  const columns: ColumnsType<ShiftTemplate> = [
    {
      title: '班次名',
      dataIndex: 'name',
      render: (name: string) => <strong className="cell-primary">{name}</strong>,
    },
    { title: '上班时间', dataIndex: 'start_time', width: 130 },
    { title: '下班时间', dataIndex: 'end_time', width: 130 },
    {
      title: '前置上班打卡时间',
      dataIndex: 'check_in_lead_minutes',
      width: 200,
      render: (minutes: number) => `${minutes} 分钟`,
    },
    {
      title: '次日标记',
      dataIndex: 'next_day_flag',
      width: 130,
      render: (flag: boolean) => (
        <Tag color={flag ? 'processing' : 'default'}>{flag ? '是' : '否'}</Tag>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: canWrite ? 300 : 90,
      render: (_: unknown, template: ShiftTemplate) => (
        <Space size={0} wrap={false}>
          {canWrite ? (
            <>
              <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(template)}>
                编辑
              </Button>
              <Button
                type="link"
                size="small"
                danger
                icon={<DeleteOutlined />}
                loading={remove.isPending}
                onClick={() => Modal.confirm({
                  title: '删除班次',
                  content: `确定删除「${template.name}」吗？该班次成员将变为未分配班次。`,
                  okText: '删除',
                  okButtonProps: { danger: true },
                  cancelText: '取消',
                  onOk: () => remove.mutate(template.public_id),
                })}
              >
                删除
              </Button>
              <Button
                type="link"
                size="small"
                icon={<TeamOutlined />}
                onClick={() => openAssign(template)}
              >
                分配服务人员
              </Button>
            </>
          ) : (
            <Tooltip title="只读权限">
              <span className="cell-muted">查看</span>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div className="page">
      <PageHeader
        eyebrow="Workspace / Shift templates"
        title="班次管理"
        description="维护本店可复用的班次时间模板；一名服务人员最多加入一个班次，一个班次可有多名成员。"
        actions={
          <Space>
            {canWrite ? (
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                新增班次
              </Button>
            ) : null}
          </Space>
        }
      />

      <Card className="panel shift-template-panel">
        <div className="panel-heading">
          <ClockCircleOutlined />
          <span>班次列表</span>
          <span className="panel-heading-count">{templates.length} 项</span>
        </div>
        <Table<ShiftTemplate>
          className="data-table"
          rowKey="public_id"
          dataSource={templates}
          pagination={false}
          size="middle"
          columns={columns}
          locale={{ emptyText: <EmptyHint>该门店暂无班次{canWrite ? '，点击右上角新增' : ''}</EmptyHint> }}
        />
      </Card>

      <Modal
        title={editing ? '编辑班次' : '新增班次'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={save.isPending}
        okText={editing ? '保存' : '创建'}
        cancelText="取消"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={submit}>
          <Form.Item
            name="name"
            label="班次名"
            rules={[{ required: true, message: '请输入班次名' }, { whitespace: true, message: '班次名不能为空' }]}
          >
            <Input maxLength={60} placeholder="例如：早班" />
          </Form.Item>
          <Space size={16} style={{ width: '100%' }}>
            <Form.Item
              name="start_time"
              label="上班时间"
              rules={[{ required: true, message: '请输入上班时间' }, { pattern: timePattern, message: '请使用 HH:MM 格式' }]}
            >
              <Input style={{ width: 130 }} placeholder="04:00" maxLength={5} />
            </Form.Item>
            <Form.Item
              name="end_time"
              label="下班时间"
              rules={[{ required: true, message: '请输入下班时间' }, { pattern: timePattern, message: '请使用 HH:MM 格式' }]}
            >
              <Input style={{ width: 130 }} placeholder="16:00" maxLength={5} />
            </Form.Item>
          </Space>
          <Form.Item
            name="check_in_lead_minutes"
            label="前置上班打卡时间（分钟）"
            extra="仅作为班次模板字段展示，本期不做打卡与提醒"
            rules={[{ type: 'number', min: 0, max: 1440, message: '需在 0 到 1440 之间' }]}
          >
            <InputNumber style={{ width: '100%' }} min={0} max={1440} />
          </Form.Item>
          <Form.Item name="next_day_flag" label="次日标记" valuePropName="checked">
            <Switch checkedChildren="是" unCheckedChildren="否" />
          </Form.Item>
          <Form.Item name="sort_order" label="展示顺序">
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={assigning ? `分配服务人员 · ${assigning.name}` : '分配服务人员'}
        open={Boolean(assigning)}
        onCancel={() => setAssigning(null)}
        onOk={() => {
          if (!assigning) return
          assign.mutate({ templateId: assigning.public_id, staff_ids: selectedStaff, version: assigning.version })
        }}
        confirmLoading={assign.isPending}
        okText="保存分配"
        cancelText="取消"
        width={620}
      >
        <p className="modal-hint">
          一人最多加入一个班次；勾选其他班次成员会自动改派到本班次。取消勾选即解除分配。
        </p>
        <Checkbox.Group
          className="shift-staff-grid"
          value={selectedStaff}
          onChange={(checked) => setSelectedStaff(checked.map(String))}
          options={staff.map((person: StaffSummary) => ({
            value: person.public_id,
            label: (
              <span className="shift-staff-option">
                <strong>{person.display_name}</strong>
                <small>
                  {person.code}
                  {person.shift_template ? ` · 当前 ${person.shift_template.name}` : ' · 未分配班次'}
                </small>
              </span>
            ),
          }))}
        />
        {staff.length === 0 ? <EmptyHint>该门店暂无服务人员</EmptyHint> : null}
      </Modal>
    </div>
  )
}
