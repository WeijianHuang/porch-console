import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeftOutlined, InfoCircleOutlined, SaveOutlined } from '@ant-design/icons'
import { Button, Card, Form, Input, Select, Space, message } from 'antd'
import { useNavigate, useParams } from 'react-router-dom'
import { authApi } from '../api/auth'
import { abortSingleShopRequests } from '../api/client'
import { queryKeys } from '../api/keys'
import { shopsApi } from '../api/shops'
import type { ShopSettings, UpdateShopRequest } from '../api/types'
import PageHeader from '../components/PageHeader'
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
  const navigate = useNavigate()
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
    <div className="page">
      <PageHeader
        eyebrow="Workspace / Shop settings"
        title="门店设置"
        description={shopQuery.data?.data.name ?? '—'}
        actions={
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/shops')}>
            返回门店列表
          </Button>
        }
      />

      <Card className="panel">
        <Form<SettingsForm> form={form} layout="vertical" onFinish={(values) => void save(values)}>
          <div className="form-section">
            <div className="form-section-head">
              <span className="form-section-index">1</span>
              <div>
                <h3>基础信息</h3>
                <p>门店名称与营业状态，保存时使用版本号做乐观锁校验。</p>
              </div>
            </div>
            <Form.Item label="门店名称" name="name" rules={[{ required: true, message: '请输入门店名称' }]}>
              <Input disabled={!canWrite} />
            </Form.Item>
            <Form.Item label="营业状态" name="status">
              <Select
                disabled={!canWrite}
                options={[
                  { value: 'active', label: '营业中' },
                  { value: 'inactive', label: '已停用' },
                ]}
              />
            </Form.Item>
          </div>

          <div className="form-section">
            <div className="form-section-head">
              <span className="form-section-index">2</span>
              <div>
                <h3>门店参数</h3>
                <p>以 JSON 对象维护；与基础信息一同保存。</p>
              </div>
            </div>
            <Form.Item label="参数内容（JSON 对象）" name="settings">
              <Input.TextArea className="json-editor" rows={10} disabled={!canWrite} />
            </Form.Item>
          </div>

          <div className="settings-note">
            <InfoCircleOutlined style={{ marginRight: 8 }} />
            {canWrite
              ? `当前参数字段：${Object.keys(settings).join('、') || '无'}。修改后点击保存，参数与基础信息一起提交。`
              : '当前账号没有 shop.write 权限，仅可查看门店设置。'}
          </div>

          <Space style={{ marginTop: 20 }}>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />} disabled={!canWrite}>
              保存更改
            </Button>
          </Space>
        </Form>
      </Card>
    </div>
  )
}
