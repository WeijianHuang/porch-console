/**
 * Queue / staff API (porch-os ADR-0009, design/10). Every call is single-shop:
 * it carries X-Shop-Id via the shared client and never infers it from the path.
 */
import { api } from './client'
import type {
  ApiEnvelope,
  CreateQueueRequest,
  CreateStaffRequest,
  MoveQueueStaffRequest,
  Queue,
  QueueDetail,
  QueueRef,
  QueueView,
  ReorderQueueStaffRequest,
  SetStaffRotationRequest,
  SetStaffServiceItemsRequest,
  SetStaffStateRequest,
  Staff,
  StaffDetail,
  StaffRef,
  StaffSummary,
  UpdateQueueRequest,
  UpdateStaffRequest,
} from './types'

const base = (shopId: string) => `/api/v1/shops/${encodeURIComponent(shopId)}`

export const queuesApi = {
  list: (shopId: string) =>
    api.get<ApiEnvelope<QueueView[]>>(`${base(shopId)}/queues`, { shopId }),
  create: (shopId: string, body: CreateQueueRequest) =>
    api.post<ApiEnvelope<Queue>>(`${base(shopId)}/queues`, body, { shopId }),
  get: (shopId: string, queueId: string) =>
    api.get<ApiEnvelope<QueueDetail>>(`${base(shopId)}/queues/${encodeURIComponent(queueId)}`, { shopId }),
  update: (shopId: string, queueId: string, body: UpdateQueueRequest) =>
    api.patch<ApiEnvelope<Queue>>(
      `${base(shopId)}/queues/${encodeURIComponent(queueId)}`, body, { shopId },
    ),
  remove: (shopId: string, queueId: string) =>
    api.delete(`${base(shopId)}/queues/${encodeURIComponent(queueId)}`, { shopId }),
  staffOfQueue: (shopId: string, queueId: string) =>
    api.get<ApiEnvelope<StaffRef[]>>(
      `${base(shopId)}/queues/${encodeURIComponent(queueId)}/staff`, { shopId },
    ),
  reorderStaff: (shopId: string, queueId: string, body: ReorderQueueStaffRequest) =>
    api.put<ApiEnvelope<QueueDetail>>(
      `${base(shopId)}/queues/${encodeURIComponent(queueId)}/staff/order`, body, { shopId },
    ),
  assign: (shopId: string, queueId: string, staffId: string) =>
    api.put(
      `${base(shopId)}/queues/${encodeURIComponent(queueId)}/staff/${encodeURIComponent(staffId)}`,
      {},
      { shopId },
    ),
  unassign: (shopId: string, queueId: string, staffId: string) =>
    api.delete(
      `${base(shopId)}/queues/${encodeURIComponent(queueId)}/staff/${encodeURIComponent(staffId)}`,
      { shopId },
    ),
}

export const staffApi = {
  list: (shopId: string) =>
    api.get<ApiEnvelope<StaffSummary[]>>(`${base(shopId)}/staff`, { shopId }),
  create: (shopId: string, body: CreateStaffRequest) =>
    api.post<ApiEnvelope<Staff>>(`${base(shopId)}/staff`, body, { shopId }),
  get: (shopId: string, staffId: string) =>
    api.get<ApiEnvelope<StaffDetail>>(`${base(shopId)}/staff/${encodeURIComponent(staffId)}`, { shopId }),
  update: (shopId: string, staffId: string, body: UpdateStaffRequest) =>
    api.patch<ApiEnvelope<Staff>>(
      `${base(shopId)}/staff/${encodeURIComponent(staffId)}`, body, { shopId },
    ),
  remove: (shopId: string, staffId: string) =>
    api.delete(`${base(shopId)}/staff/${encodeURIComponent(staffId)}`, { shopId }),
  /** Operator controls (porch-os ADR-0015). State is the scheduling state, not
   * the employment status; the server validates the manual transition. */
  setState: (shopId: string, staffId: string, body: SetStaffStateRequest) =>
    api.post<ApiEnvelope<StaffSummary>>(
      `${base(shopId)}/staff/${encodeURIComponent(staffId)}/state`, body, { shopId },
    ),
  setRotation: (shopId: string, staffId: string, body: SetStaffRotationRequest) =>
    api.patch<ApiEnvelope<StaffSummary>>(
      `${base(shopId)}/staff/${encodeURIComponent(staffId)}/rotation`, body, { shopId },
    ),
  moveInQueue: (shopId: string, queueId: string, staffId: string, body: MoveQueueStaffRequest) =>
    api.post<ApiEnvelope<{ queue_id: string; staff_id: string; position: number }>>(
      `${base(shopId)}/queues/${encodeURIComponent(queueId)}/staff/${encodeURIComponent(staffId)}/move`,
      body, { shopId },
    ),
  /** ADR-0023: service-item qualifications. Full replacement, versioned. */
  serviceItems: (shopId: string, staffId: string) =>
    api.get<ApiEnvelope<{ staff_public_id: string; service_item_ids: string[] }>>(
      `${base(shopId)}/staff/${encodeURIComponent(staffId)}/service-items`, { shopId },
    ),
  setServiceItems: (shopId: string, staffId: string, body: SetStaffServiceItemsRequest) =>
    api.put<ApiEnvelope<StaffSummary>>(
      `${base(shopId)}/staff/${encodeURIComponent(staffId)}/service-items`, body, { shopId },
    ),
}

export type { QueueRef, StaffRef }
