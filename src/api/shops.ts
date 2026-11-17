import { api } from './client'
import type {
  ApiEnvelope,
  ApiList,
  Shop,
  ShopSettings,
  UpdateShopRequest,
} from './types'

export const shopsApi = {
  list: (cursor?: string) =>
    api.get<ApiList<Shop>>(`/api/v1/shops${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`),
  get: (shopId: string) =>
    api.get<ApiEnvelope<Shop>>(`/api/v1/shops/${shopId}`, { shopId }),
  update: (shopId: string, body: UpdateShopRequest) =>
    api.patch<ApiEnvelope<Shop>>(`/api/v1/shops/${shopId}`, body, { shopId }),
  settings: (shopId: string) =>
    api.get<ApiEnvelope<ShopSettings>>(`/api/v1/shops/${shopId}/settings`, { shopId }),
  updateSettings: (shopId: string, value: ShopSettings) =>
    api.patch<ApiEnvelope<ShopSettings>>(
      `/api/v1/shops/${shopId}/settings`,
      { value },
      { shopId },
    ),
}
