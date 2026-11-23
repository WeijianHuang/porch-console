/** Companion groups (porch-os ADR-0022 §5, design/03 §8). Shop-scoped.
 *
 * A group is an orchestration view over several already-card-bound orders: it
 * stores no money, is not a payment subject and never changes an order's card
 * or room binding. Payments stay per order, so this module exposes no payment
 * call. Reads need `order.read`, writes need `order.write`.
 */
import { api } from './client'
import type { ApiEnvelope, ApiList, CompanionGroup, CreateCompanionGroupRequest } from './types'

const base = (shopId: string) => `/api/v1/shops/${encodeURIComponent(shopId)}`

export const companionGroupsApi = {
  list: (shopId: string, params: { status?: string; cursor?: string; limit?: number } = {}) => {
    const query = new URLSearchParams()
    if (params.status) query.set('status', params.status)
    if (params.cursor) query.set('cursor', params.cursor)
    if (params.limit) query.set('limit', String(params.limit))
    const suffix = query.size ? `?${query.toString()}` : ''
    return api.get<ApiList<CompanionGroup>>(`${base(shopId)}/companion-groups${suffix}`, { shopId })
  },
  get: (shopId: string, groupId: string) =>
    api.get<ApiEnvelope<CompanionGroup>>(
      `${base(shopId)}/companion-groups/${encodeURIComponent(groupId)}`, { shopId },
    ),
  create: (shopId: string, body: CreateCompanionGroupRequest) =>
    api.post<ApiEnvelope<CompanionGroup>>(`${base(shopId)}/companion-groups`, body, { shopId }),
  /** Merge: members already in another open group are moved in one transaction. */
  join: (shopId: string, groupId: string, orderPublicIds: string[], version: number) =>
    api.post<ApiEnvelope<CompanionGroup>>(
      `${base(shopId)}/companion-groups/${encodeURIComponent(groupId)}/members`,
      { order_public_ids: orderPublicIds, version },
      { shopId },
    ),
  /** Split: only ends membership (left_at), card/room/amounts are untouched. */
  leave: (shopId: string, groupId: string, orderId: string, version: number) =>
    api.delete<ApiEnvelope<CompanionGroup>>(
      `${base(shopId)}/companion-groups/${encodeURIComponent(groupId)}` +
        `/members/${encodeURIComponent(orderId)}?version=${version}`,
      { shopId },
    ),
  close: (shopId: string, groupId: string, version: number) =>
    api.post<ApiEnvelope<CompanionGroup>>(
      `${base(shopId)}/companion-groups/${encodeURIComponent(groupId)}/close`, { version }, { shopId },
    ),
  cancel: (shopId: string, groupId: string, version: number) =>
    api.post<ApiEnvelope<CompanionGroup>>(
      `${base(shopId)}/companion-groups/${encodeURIComponent(groupId)}/cancel`, { version }, { shopId },
    ),
}
