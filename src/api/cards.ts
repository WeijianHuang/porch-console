/** ID card API (porch-os ADR-0017 / design/14). Shop-scoped. */
import { api } from './client'
import type {
  ApiEnvelope, CreateCardRequest, HoldCardRequest, IdCard,
  ReleaseCardRequest, UpdateCardRequest,
} from './types'

const base = (shopId: string) => `/api/v1/shops/${encodeURIComponent(shopId)}`

export const cardsApi = {
  list: (shopId: string) =>
    api.get<ApiEnvelope<IdCard[]>>(`${base(shopId)}/cards`, { shopId }),
  create: (shopId: string, body: CreateCardRequest) =>
    api.post<ApiEnvelope<IdCard>>(`${base(shopId)}/cards`, body, { shopId }),
  update: (shopId: string, cardId: string, body: UpdateCardRequest) =>
    api.patch<ApiEnvelope<IdCard>>(
      `${base(shopId)}/cards/${encodeURIComponent(cardId)}`, body, { shopId },
    ),
  hold: (shopId: string, cardId: string, body: HoldCardRequest) =>
    api.post<ApiEnvelope<IdCard>>(
      `${base(shopId)}/cards/${encodeURIComponent(cardId)}/hold`, body, { shopId },
    ),
  release: (shopId: string, cardId: string, body: ReleaseCardRequest = {}) =>
    api.post<ApiEnvelope<IdCard>>(
      `${base(shopId)}/cards/${encodeURIComponent(cardId)}/release`, body, { shopId },
    ),
}
