/**
 * Queue / staff API (porch-os ADR-0009, design/10). Every call is single-shop:
 * it carries X-Shop-Id via the shared client and never infers it from the path.
 */
import { api } from './client'
import type {
  ApiEnvelope,
  CreateQueueRequest,
  CreateStaffRequest,
  Queue,
  QueueDetail,
  QueueRef,
  QueueView,
  ReorderQueueStaffRequest,
  Staff,
  StaffDetail,
  StaffRef,
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
    api.get<ApiEnvelope<Staff[]>>(`${base(shopId)}/staff`, { shopId }),
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
}

export type { QueueRef, StaffRef }
