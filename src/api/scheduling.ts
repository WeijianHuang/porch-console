/**
 * Scheduling engine API (porch-os ADR-0012 / design/12). Every call is
 * single-shop: X-Shop-Id is attached by the shared client and never inferred
 * from the path. Writes carry an Idempotency-Key automatically.
 * Generic, industry-agnostic terms only.
 */
import { api } from './client'
import type {
  ApiEnvelope,
  AuditEntry,
  DecisionRecord,
  DispatchRequest,
  PolicyInput,
  RuleInput,
  SchedulingBoard,
  SchedulingEvent,
  SchedulingPolicy,
  SchedulingRule,
  SchedulingTaskType,
} from './types'

const base = (shopId: string) => `/api/v1/shops/${encodeURIComponent(shopId)}/scheduling`

export const schedulingApi = {
  board: (shopId: string) =>
    api.get<ApiEnvelope<SchedulingBoard>>(`${base(shopId)}/board`, { shopId }),
  rules: (shopId: string) =>
    api.get<ApiEnvelope<SchedulingRule[]>>(`${base(shopId)}/rules`, { shopId }),
  policies: (shopId: string) =>
    api.get<ApiEnvelope<SchedulingPolicy[]>>(`${base(shopId)}/policies`, { shopId }),
  taskTypes: (shopId: string) =>
    api.get<ApiEnvelope<SchedulingTaskType[]>>(`${base(shopId)}/task-types`, { shopId }),
  events: (shopId: string) =>
    api.get<ApiEnvelope<SchedulingEvent[]>>(`${base(shopId)}/events`, { shopId }),
  audit: (shopId: string) =>
    api.get<ApiEnvelope<AuditEntry[]>>(`${base(shopId)}/audit`, { shopId }),

  dispatch: (shopId: string, body: DispatchRequest) =>
    api.post<ApiEnvelope<DecisionRecord>>(`${base(shopId)}/dispatch`, body, { shopId }),
  pin: (shopId: string, body: { queue_id: string; staff_id: string; pin_type: string; expires_at?: string }) =>
    api.post<ApiEnvelope<{ pinned: boolean }>>(`${base(shopId)}/pins`, body, { shopId }),
  unpin: (shopId: string, body: { queue_id: string; staff_id: string }) =>
    api.delete<ApiEnvelope<{ pinned: boolean }>>(`${base(shopId)}/pins`, { shopId, body }),
  releaseExpired: (shopId: string) =>
    api.post<ApiEnvelope<{ released: number }>>(`${base(shopId)}/pins/release-expired`, {}, { shopId }),
  eventAction: (shopId: string, eventId: string, action: 'restore' | 'cancel' | 'complete', body = {}) =>
    api.post<ApiEnvelope<{ action: string }>>(
      `${base(shopId)}/events/${encodeURIComponent(eventId)}/${action}`, body, { shopId },
    ),
  changeMethod: (shopId: string, eventId: string, method: string) =>
    api.post<ApiEnvelope<{ changed: boolean }>>(
      `${base(shopId)}/events/${encodeURIComponent(eventId)}/assignment-method`,
      { method }, { shopId },
    ),
  publishRules: (shopId: string, rules: RuleInput[]) =>
    api.put<ApiEnvelope<{ rules: number }>>(`${base(shopId)}/rules`, { rules }, { shopId }),
  publishPolicies: (shopId: string, policies: PolicyInput[]) =>
    api.put<ApiEnvelope<{ policies: number }>>(`${base(shopId)}/policies`, { policies }, { shopId }),
}
