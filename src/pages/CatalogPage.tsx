import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AppstoreOutlined, CheckCircleOutlined, ClockCircleOutlined, PlusOutlined,
} from '@ant-design/icons'
import { Button, Card, Form, Input, Modal, Select, Space, Table, message } from 'antd'
import { catalogApi } from '../api/catalog'
import { queryKeys } from '../api/keys'
import type { CatalogItem } from '../api/types'
import PageHeader from '../components/PageHeader'
import { ErrorState, PageLoading } from '../components/RequestState'
import { hasPermission, useAuthStore } from '../stores/authStore'
import { formatUTC8 } from '../utils/datetime'
import { formatCNY, isValidMoney } from '../utils/money'

interface CatalogFormValues {
  sku?: string
  name: string
  type?: 'product' | 'service'
  base_price: string
  active?: boolean
  version?: number
}

export default function CatalogPage() {
  const queryClient = useQueryClient()
  const permissions = useAuthStore((state) => state.permissions)
  const canWrite = hasPermission(permissions, 'catalog.write')
  const [form] = Form.useForm<CatalogFormValues>()
  const [editing, setEditing] = useState<CatalogItem | null>(null)
  const [open, setOpen] = useState(false)
  const { data, error, isPending, refetch } = useQuery({
    queryKey: queryKeys.catalog,
    queryFn: () => catalogApi.list(),
  })

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ type: 'product', active: true })
    setOpen(true)
  }

  const openEdit = (item: CatalogItem) => {
    setEditing(item)
    form.setFieldsValue({
      name: item.name,
      base_price: item.base_price,
      active: item.active,
      version: item.version,
    })
    setOpen(true)
  }

  const submit = async (values: CatalogFormValues) => {
    if (!isValidMoney(values.base_price)) {
      message.error('请输入合法的金额')
      return
    }
    try {
      if (editing) {
        await catalogApi.update(editing.public_id, {
          name: values.name,
          base_price: values.base_price,
          active: Boolean(values.active),
          version: Number(values.version ?? editing.version),
        })
      } else {
        await catalogApi.create({
          sku: values.sku ?? '',
          name: values.name,
          type: values.type ?? 'product',
          base_price: values.base_price,
        })
      }
      setOpen(false)
      message.success(editing ? '已更新' : '已创建')
      await queryClient.invalidateQueries({ queryKey: queryKeys.catalog })
    } catch (err) {
      message.error((err as Error).message || '保存失败，请重试')
    }
  }

  if (isPending) return <PageLoading />
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />

  const items = data?.data ?? []
  const activeCount = items.filter((item) => item.active).length

  return (
    <div className="page">
      <PageHeader
        eyebrow="Workspace / Catalog"
        title="商品目录"
        description="维护可在门店使用的商品与服务条目；所有金额均以 CNY 展示。"
        actions={
          canWrite ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              新建目录项
            </Button>
          ) : null
        }
      />

      <div className="stat-strip">
        <div className="stat-tile">
          <span className="stat-icon slate"><AppstoreOutlined /></span>
          <div className="stat-text">
            <div className="stat-label">目录条目</div>
            <div className="stat-value">{items.length}</div>
          </div>
        </div>
        <div className="stat-tile">
          <span className="stat-icon"><CheckCircleOutlined /></span>
          <div className="stat-text">
            <div className="stat-label">已上架</div>
            <div className="stat-value">{activeCount}</div>
          </div>
        </div>
        <div className="stat-tile">
          <span className="stat-icon amber"><ClockCircleOutlined /></span>
          <div className="stat-text">
            <div className="stat-label">已下架</div>
            <div className="stat-value">{items.length - activeCount}</div>
          </div>
        </div>
      </div>

      <Card className="panel">
        <Table<CatalogItem>
          className="data-table"
          rowKey="public_id"
          dataSource={items}
          pagination={false}
          columns={[
            { title: 'SKU', dataIndex: 'sku', className: 'cell-money' },
            { title: '名称', dataIndex: 'name', className: 'cell-primary' },
            {
              title: '类型',
              dataIndex: 'type',
              width: 90,
              render: (type: string) => (
                <span className="pill plain">{type === 'service' ? '服务' : '商品'}</span>
              ),
            },
            {
              title: '基础价',
              dataIndex: 'base_price',
              width: 120,
              align: 'right',
              render: (value: string) => <span className="cell-money">{formatCNY(value)}</span>,
            },
            {
              title: '状态',
              dataIndex: 'active',
              width: 100,
              render: (active: boolean) => (
                <span className={`pill ${active ? 'on' : 'off'}`}>{active ? '上架' : '下架'}</span>
              ),
            },
            {
              title: '更新时间 (UTC+8)',
              dataIndex: 'updated_at',
              width: 190,
              render: (value: string) => <span className="muted">{formatUTC8(value)}</span>,
            },
            {
              title: '操作',
              key: 'actions',
              width: 90,
              render: (_: unknown, item: CatalogItem) =>
                canWrite ? (
                  <Button type="link" onClick={() => openEdit(item)}>编辑</Button>
                ) : null,
            },
          ]}
        />

        <Modal
          title={editing ? '编辑目录项' : '新建目录项'}
          open={open}
          onCancel={() => setOpen(false)}
          onOk={() => form.submit()}
          destroyOnHidden
        >
          <Form<CatalogFormValues> form={form} layout="vertical" onFinish={(values) => void submit(values)}>
            {!editing ? (
              <Space direction="vertical" style={{ width: '100%' }}>
                <Form.Item label="SKU" name="sku" rules={[{ required: true, message: '请输入 SKU' }]}>
                  <Input />
                </Form.Item>
                <Form.Item label="类型" name="type">
                  <Select
                    options={[
                      { value: 'product', label: '商品' },
                      { value: 'service', label: '服务' },
                    ]}
                  />
                </Form.Item>
              </Space>
            ) : null}
            <Form.Item label="名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
              <Input />
            </Form.Item>
            <Form.Item
              label="基础价"
              name="base_price"
              rules={[{ required: true, message: '请输入基础价' }]}
            >
              <Input placeholder="例如 19.90" />
            </Form.Item>
            {editing ? (
              <Space>
                <Form.Item label="上架" name="active">
                  <Select
                    options={[
                      { value: true, label: '上架' },
                      { value: false, label: '下架' },
                    ]}
                  />
                </Form.Item>
                <Form.Item label="版本（乐观锁）" name="version">
                  <Input disabled />
                </Form.Item>
              </Space>
            ) : null}
          </Form>
        </Modal>
      </Card>
    </div>
  )
}
