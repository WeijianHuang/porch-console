/**
 * Room API (porch-os ADR-0011, design/11). Every call is single-shop: it carries
 * X-Shop-Id via the shared client and never infers it from the path. Rooms are
 * returned flat and sorted by floor then code; grouping is a frontend concern.
 */
import { api } from './client'
import type {
  ApiEnvelope,
  CreateRoomRequest,
  Room,
  UpdateRoomRequest,
} from './types'

const base = (shopId: string) => `/api/v1/shops/${encodeURIComponent(shopId)}`

export const roomsApi = {
  list: (shopId: string) =>
    api.get<ApiEnvelope<Room[]>>(`${base(shopId)}/rooms`, { shopId }),
  create: (shopId: string, body: CreateRoomRequest) =>
    api.post<ApiEnvelope<Room>>(`${base(shopId)}/rooms`, body, { shopId }),
  get: (shopId: string, roomId: string) =>
    api.get<ApiEnvelope<Room>>(`${base(shopId)}/rooms/${encodeURIComponent(roomId)}`, { shopId }),
  update: (shopId: string, roomId: string, body: UpdateRoomRequest) =>
    api.patch<ApiEnvelope<Room>>(
      `${base(shopId)}/rooms/${encodeURIComponent(roomId)}`, body, { shopId },
    ),
  remove: (shopId: string, roomId: string) =>
    api.delete(`${base(shopId)}/rooms/${encodeURIComponent(roomId)}`, { shopId }),
}
