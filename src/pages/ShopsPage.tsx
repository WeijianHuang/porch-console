import { useQuery } from '@tanstack/react-query'
import { Button, Card, Space, Table, Typography } from 'antd'
import { useNavigate } from 'react-router-dom'
import { shopsApi } from '../api/shops'
import { queryKeys } from '../api/keys'
import type { Shop } from '../api/types'
import { EmptyHint, ErrorState, PageLoading } from '../components/RequestState'
import { useShopStore } from '../stores/shopStore'
import { formatUTC8 } from '../utils/datetime'

export default function ShopsPage() {
  const navigate = useNavigate()
  const currentShopId = useShopStore((state) => state.currentShopId)
  const { data, error, isPending, refetch } = useQuery({
    queryKey: queryKeys.shops(currentShopId),
    queryFn: () => shopsApi.list(),
  })

  if (isPending) return <PageLoading />
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />
  if (!data?.data.length) return <EmptyHint>暂无可用门店，请联系管理员授权</EmptyHint>

  return (
    <Card
      title={<Typography.Title level={4}>门店列表</Typography.Title>}
      extra={<Typography.Text type="secondary">共 {data.data.length} 家可见门店</Typography.Text>}
    >
      <Table<Shop>
        rowKey="public_id"
        dataSource={data.data}
        pagination={false}
        columns={[
          { title: '编码', dataIndex: 'code' },
          { title: '名称', dataIndex: 'name' },
          {
            title: '状态',
            dataIndex: 'status',
            render: (status: string) => (status === 'active' ? '营业中' : '已停用'),
          },
          {
            title: '创建时间 (UTC+8)',
            dataIndex: 'created_at',
            render: (value: string) => formatUTC8(value),
          },
          {
            title: '操作',
            key: 'actions',
            render: (_: unknown, shop: Shop) => (
              <Space>
                <Button type="link" onClick={() => navigate(`/shops/${shop.public_id}/settings`)}>
                  设置
                </Button>
              </Space>
            ),
          },
        ]}
      />
    </Card>
  )
}
