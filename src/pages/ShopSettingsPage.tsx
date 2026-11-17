import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Form, Input, Select, Space, Typography, message } from 'antd'
import { useParams } from 'react-router-dom'
import { authApi } from '../api/auth'
import { abortSingleShopRequests } from '../api/client'
import { queryKeys } from '../api/keys'
import { shopsApi } from '../api/shops'
import type { ShopSettings, UpdateShopRequest } from '../api/types'
import { ErrorState, PageLoading } from '../components/RequestState'
import { hasPermission, useAuthStore } from '../stores/authStore'
import { useShopStore } from '../stores/shopStore'

interface SettingsForm {
  name: string
  status: 'active' | 'inactive'
  settings: string
}

export default function ShopSettingsPage() {
  const { shopId } = useParams<{ shopId: string }>()
  const queryClient = useQueryClient()
  const currentShopId = useShopStore((state) => state.currentShopId)
  const setCurrent = useShopStore((state) => state.setCurrent)
  const permissions = useAuthStore((state) => state.permissions)
  const [form] = Form.useForm<SettingsForm>()
  const [settings, setSettings] = useState<ShopSettings>({})
  const canWrite = hasPermission(permissions, 'shop.write')

  useEffect(() => {
    if (shopId && currentShopId !== shopId) {
      abortSingleShopRequests()
      setCurrent(shopId)
      void authApi.permissions().then((response) => {
        useAuthStore.setState({ permissions: response.data.permissions })
      })
    }
  }, [shopId, currentShopId, setCurrent])

  const shopQuery = useQuery({
    queryKey: queryKeys.shop(shopId ?? ''),
    queryFn: () => shopsApi.get(shopId!),
    enabled: Boolean(shopId),
  })
  const settingsQuery = useQuery({
    queryKey: queryKeys.settings(shopId ?? ''),
    queryFn: () => shopsApi.settings(shopId!),
    enabled: Boolean(shopId),
  })

  useEffect(() => {
    if (!shopQuery.data || !settingsQuery.data) return
    setSettings(settingsQuery.data.data)
    form.setFieldsValue({
      name: shopQuery.data.data.name,
      status: shopQuery.data.data.status as 'active' | 'inactive',
      settings: JSON.stringify(settingsQuery.data.data, null, 2),
    })
  }, [shopQuery.data, settingsQuery.data, form])

  const save = async (values: SettingsForm) => {
    let parsed: ShopSettings
    try {
      const candidate: unknown = JSON.parse(values.settings || '{}')
      if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
        throw new Error('必须是 JSON 对象')
      }
      parsed = candidate as ShopSettings
    } catch {
      message.error('门店参数必须是合法的 JSON 对象')
      return
    }
    if (!shopId || !shopQuery.data) return
    const body: UpdateShopRequest = {
      name: values.name,
      status: values.status,
      version: shopQuery.data.data.version,
    }
    try {
      await shopsApi.update(shopId, body)
      await shopsApi.updateSettings(shopId, parsed)
      message.success('已保存')
      setSettings(parsed)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.shop(shopId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.settings(shopId) }),
      ])
    } catch (error) {
      message.error((error as Error).message || '保存失败，请重试')
    }
  }

  if (!shopId) return <ErrorState error={new Error('缺少门店标识')} />
  if (shopQuery.isPending || settingsQuery.isPending) return <PageLoading />
  if (shopQuery.error || settingsQuery.error) {
    return (
      <ErrorState
        error={shopQuery.error ?? settingsQuery.error}
        onRetry={() => {
          void shopQuery.refetch()
          void settingsQuery.refetch()
        }}
      />
    )
  }

  return (
    <Card title={<Typography.Title level={4}>门店设置</Typography.Title>}>
      <Form<SettingsForm> form={form} layout="vertical" onFinish={(values) => void save(values)}>
        <Form.Item label="名称" name="name" rules={[{ required: true, message: '请输入门店名称' }]}>
          <Input disabled={!canWrite} />
        </Form.Item>
        <Form.Item label="状态" name="status">
          <Select
            disabled={!canWrite}
            options={[
              { value: 'active', label: '营业中' },
              { value: 'inactive', label: '已停用' },
            ]}
          />
        </Form.Item>
        <Form.Item label="门店参数（JSON 对象）" name="settings">
          <Input.TextArea rows={8} disabled={!canWrite} />
        </Form.Item>
        <Space>
          <Button type="primary" htmlType="submit" disabled={!canWrite}>
            保存
          </Button>
          <Typography.Text type="secondary">
            {canWrite ? `当前参数字段：${Object.keys(settings).join('、') || '无'}` : '当前账号没有 shop.write 权限，仅可查看'}
          </Typography.Text>
        </Space>
      </Form>
    </Card>
  )
}
