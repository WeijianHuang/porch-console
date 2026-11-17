import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Form, Input, Modal, Select, Space, Table, Typography, message } from 'antd'
import { catalogApi } from '../api/catalog'
import { queryKeys } from '../api/keys'
import type { CatalogItem } from '../api/types'
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

  return (
    <Card
      title={<Typography.Title level={4}>商品目录</Typography.Title>}
      extra={
        canWrite ? (
          <Button type="primary" onClick={openCreate}>
            新建目录项
          </Button>
        ) : null
      }
    >
      <Table<CatalogItem>
        rowKey="public_id"
        dataSource={data?.data ?? []}
        pagination={false}
        columns={[
          { title: 'SKU', dataIndex: 'sku' },
          { title: '名称', dataIndex: 'name' },
          { title: '类型', dataIndex: 'type', render: (type: string) => (type === 'service' ? '服务' : '商品') },
          { title: '基础价', dataIndex: 'base_price', render: (value: string) => formatCNY(value) },
          { title: '状态', dataIndex: 'active', render: (active: boolean) => (active ? '上架' : '下架') },
          {
            title: '更新时间 (UTC+8)',
            dataIndex: 'updated_at',
            render: (value: string) => formatUTC8(value),
          },
          {
            title: '操作',
            key: 'actions',
            render: (_: unknown, item: CatalogItem) =>
              canWrite ? (
                <Button type="link" onClick={() => openEdit(item)}>
                  编辑
                </Button>
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
            <>
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
            </>
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
  )
}
