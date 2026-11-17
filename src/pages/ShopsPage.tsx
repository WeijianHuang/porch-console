import { RightOutlined, ShopOutlined } from '@ant-design/icons'
import { Button, Card } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { shopsApi } from '../api/shops'
import { queryKeys } from '../api/keys'
import PageHeader from '../components/PageHeader'
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

  const shops = data?.data ?? []

  return (
    <div className="page">
      <PageHeader
        eyebrow="Workspace / Shops"
        title="门店列表"
        description="当前账号可见的全部门店。点击「进入设置」可直接编辑对应门店。"
        actions={
          <span className="pill plain">共 {shops.length} 家可见门店</span>
        }
      />

      <Card className="panel">
        {shops.length === 0 ? (
          <EmptyHint>暂无可用门店，请联系管理员授权</EmptyHint>
        ) : (
          <div className="card-grid">
            {shops.map((shop) => (
              <article
                className={`entity-card${shop.public_id === currentShopId ? ' is-current' : ''}`}
                key={shop.public_id}
              >
                <div className="entity-card-head">
                  <span className="entity-avatar"><ShopOutlined /></span>
                  <div className="entity-card-title">
                    <strong>{shop.name}</strong>
                    <span>{shop.code}</span>
                  </div>
                </div>
                <div className="entity-card-meta">
                  <span className={`pill ${shop.status === 'active' ? 'on' : 'off'}`}>
                    {shop.status === 'active' ? '营业中' : '已停用'}
                  </span>
                  {shop.public_id === currentShopId ? <span className="pill plain">当前门店</span> : null}
                </div>
                <div className="entity-card-foot">
                  <span className="queue-lane-count">创建于 {formatUTC8(shop.created_at)}</span>
                  <Button type="link" onClick={() => navigate(`/shops/${shop.public_id}/settings`)}>
                    进入设置 <RightOutlined />
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
