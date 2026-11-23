/** Order list / detail API (porch-os ADR-0013/0014/0016/0019, design/03 §8).
 * All endpoints are shop-scoped: the public shop id is both in the path and
 * in the X-Shop-Id header (ADR-0006). Reads need `order.read`. */
import { api } from './client'
import type { ApiEnvelope, ApiList, Order, PaymentEntry, PaymentResult } from './types'

const base = (shopId: string) => `/api/v1/shops/${encodeURIComponent(shopId)}`

export interface CreateOrderRequest {
  /** Both bindings are optional at create time (ADR-0022) but required at
   * submit: the server answers 422 ORDER_CARD_REQUIRED / ORDER_ROOM_REQUIRED. */
  card_public_id?: string
  room_public_id?: string
  member_id?: string
}

export interface SubmitOrderRequest {
  version: number
  /** Must equal the sum of the server's line snapshots, not a client estimate. */
  total_amount: string
  adjustments: unknown[]
}

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
  /** Creates a draft order. Card and room may be attached in the same request
   * so the common case costs one round-trip (ADR-0022 §1). */
  create: (shopId: string, body: CreateOrderRequest = {}) =>
    api.post<ApiEnvelope<Order>>(`${base(shopId)}/orders`, body, { shopId }),
  /** Appends one line; the unit price is snapshotted server-side from the
   * catalog item, so a client price can never be submitted. */
  addLine: (shopId: string, orderId: string, catalogItemId: string, quantity: string) =>
    api.post<ApiEnvelope<Order>>(
      `${base(shopId)}/orders/${encodeURIComponent(orderId)}/lines`,
      { catalog_item_id: catalogItemId, quantity },
      { shopId },
    ),
  removeLine: (shopId: string, orderId: string, lineNo: number) =>
    api.delete<ApiEnvelope<Order>>(
      `${base(shopId)}/orders/${encodeURIComponent(orderId)}/lines?line_no=${lineNo}`,
      { shopId },
    ),
  /** draft/open → pending_payment. Rejects with 422 when the card or room is
   * missing; the total must match the server's own line sum exactly. */
  submit: (shopId: string, orderId: string, body: SubmitOrderRequest) =>
    api.post<ApiEnvelope<Order>>(
      `${base(shopId)}/orders/${encodeURIComponent(orderId)}/submit`,
      body,
      { shopId },
    ),
  /** Settles one order. Both entries must add up to the outstanding amount;
   * settlement releases the card binding and the staff holding (ADR-0022 §4). */
  pay: (shopId: string, orderId: string, entries: PaymentEntry[]) =>
    api.post<ApiEnvelope<PaymentResult>>(
      `${base(shopId)}/orders/${encodeURIComponent(orderId)}/payments`,
      { entries },
      { shopId },
    ),
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
