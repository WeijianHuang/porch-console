/** Order list / detail API (porch-os ADR-0013/0014/0016/0019, design/03 §8).
 * All endpoints are shop-scoped: the public shop id is both in the path and
 * in the X-Shop-Id header (ADR-0006). Reads need `order.read`. */
import { api } from './client'
import type { ApiEnvelope, ApiList, Order } from './types'

const base = (shopId: string) => `/api/v1/shops/${encodeURIComponent(shopId)}`

export interface ListOrdersParams {
  /** Keyset cursor emitted as `page.next_cursor` by the previous page. */
  cursor?: string
  /** Server-side status filter; omitted means all statuses. */
  status?: string
  limit?: number
}

export const ordersApi = {
  list: (shopId: string, params: ListOrdersParams = {}) => {
    const query = new URLSearchParams()
    if (params.cursor) query.set('cursor', params.cursor)
    if (params.status) query.set('status', params.status)
    if (params.limit) query.set('limit', String(params.limit))
    const suffix = query.size ? `?${query.toString()}` : ''
    return api.get<ApiList<Order>>(`${base(shopId)}/orders${suffix}`, { shopId })
  },
  get: (shopId: string, orderId: string) =>
    api.get<ApiEnvelope<Order>>(`${base(shopId)}/orders/${encodeURIComponent(orderId)}`, { shopId }),
  /** Bind or replace the single card (ADR-0022 §2). The card must be active,
   * held by a staff member of this shop and free of another active order. */
  bindCard: (shopId: string, orderId: string, cardPublicId: string, version: number) =>
    api.post<ApiEnvelope<Order>>(
      `${base(shopId)}/orders/${encodeURIComponent(orderId)}/card`,
      { card_public_id: cardPublicId, version },
      { shopId },
    ),
  /** Release only the order-side binding; the staff holding is untouched. */
  unbindCard: (shopId: string, orderId: string, version: number) =>
    api.delete<ApiEnvelope<Order>>(
      `${base(shopId)}/orders/${encodeURIComponent(orderId)}/card?version=${version}`,
      { shopId },
    ),
  /** Bind or replace the room; sharing a room across orders is allowed. */
  bindRoom: (shopId: string, orderId: string, roomPublicId: string, version: number) =>
    api.post<ApiEnvelope<Order>>(
      `${base(shopId)}/orders/${encodeURIComponent(orderId)}/room`,
      { room_public_id: roomPublicId, version },
      { shopId },
    ),
}
