import { message, Select, Tag, Tooltip } from 'antd'
import { useQueryClient } from '@tanstack/react-query'
import { authApi } from '../api/auth'
import { abortSingleShopRequests } from '../api/client'
import { belongsToShopScope } from '../api/keys'
import { activeShops } from '../shop/visibility'
import { useAuthStore } from '../stores/authStore'
import { useShopStore } from '../stores/shopStore'

/** Switching is client-only: abort in-flight requests, drop scoped cache, reload permissions. */
export default function ShopSwitcher() {
  const shops = useAuthStore((state) => state.shops)
  const currentShopId = useShopStore((state) => state.currentShopId)
  const setCurrent = useShopStore((state) => state.setCurrent)
  const queryClient = useQueryClient()
  const available = activeShops(shops)

  const handleChange = async (id: string) => {
    abortSingleShopRequests()
    setCurrent(id)
    queryClient.removeQueries({ predicate: (query) => belongsToShopScope(query.queryKey) })
    try {
      const permissions = await authApi.permissions()
      useAuthStore.setState({ permissions: permissions.data.permissions })
      void queryClient.invalidateQueries({ queryKey: ['identity'] })
      message.success('已切换门店，页面数据已重取')
    } catch {
      message.warning('门店已切换，但权限刷新失败，请刷新页面重试')
    }
  }

  if (available.length === 0) {
    return <Tag color="warning">暂无可用门店</Tag>
  }

  return (
    <Tooltip title="当前门店只影响单店视图，跨店数据不受影响">
      <Select
        aria-label="当前门店"
        value={currentShopId ?? undefined}
        placeholder="选择门店"
        style={{ width: 220 }}
        onChange={(id) => void handleChange(id)}
        options={available.map((shop) => ({ value: shop.public_id, label: shop.name }))}
      />
    </Tooltip>
  )
}
