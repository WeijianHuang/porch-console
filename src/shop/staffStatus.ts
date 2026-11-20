/**
 * Staff status buckets (porch-os ADR-0013 / design/13). The engine keeps 11
 * `executor_state` values; the console folds them into 7 coloured buckets plus
 * a neutral one so a card is readable at a glance. This module is the single
 * source for that mapping — the staff wall, the queue people view and the
 * dispatch board all import it.
 */
import type { ExecutorState } from '../api/types'

export type StaffBucket =
  | 'available' | 'queued' | 'serving' | 'designated'
  | 'reserved' | 'overtime' | 'leave' | 'off'

export interface StaffBucketMeta {
  key: StaffBucket
  label: string
  /** Engine states folded into this bucket. */
  states: ExecutorState[]
}

export const STAFF_BUCKETS: StaffBucketMeta[] = [
  { key: 'available', label: '可调度', states: ['available'] },
  { key: 'queued', label: '排队中', states: ['standby', 'pinned'] },
  { key: 'serving', label: '服务中', states: ['executing', 'cross_group_support'] },
  { key: 'designated', label: '指定中', states: ['designated_occupied'] },
  { key: 'reserved', label: '时段保留', states: ['time_reserved'] },
  { key: 'overtime', label: '加班中', states: ['overtime'] },
  { key: 'leave', label: '请假', states: ['leave'] },
  { key: 'off', label: '下班 / 停用', states: ['off_duty', 'disabled'] },
]

const BUCKET_BY_STATE = new Map<string, StaffBucket>()
for (const bucket of STAFF_BUCKETS) {
  for (const state of bucket.states) BUCKET_BY_STATE.set(state, bucket.key)
}

/** Unknown values fall back to the neutral bucket rather than inventing a tone. */
export function bucketOf(state: string | undefined): StaffBucket {
  return BUCKET_BY_STATE.get(state ?? '') ?? 'off'
}

export function bucketLabel(key: StaffBucket): string {
  return STAFF_BUCKETS.find((b) => b.key === key)?.label ?? '其他'
}

/** Precise label shown on the card; buckets only drive the colour. */
export const STATE_LABELS: Record<string, string> = {
  standby: '排队中',
  available: '可调度',
  executing: '服务中',
  designated_occupied: '指定中',
  pinned: '排队中',
  time_reserved: '时段保留',
  overtime: '加班中',
  disabled: '停用',
  leave: '请假',
  off_duty: '下班',
  cross_group_support: '跨组支援',
}

export function stateLabel(state: string | undefined): string {
  return STATE_LABELS[state ?? ''] ?? state ?? '未知'
}

/** The six states an operator may set by hand (design/13 §2). */
export const MANUAL_STATES: { state: string; label: string }[] = [
  { state: 'available', label: '可调度' },
  { state: 'standby', label: '排队中' },
  { state: 'time_reserved', label: '时段保留' },
  { state: 'overtime', label: '加班中' },
  { state: 'leave', label: '请假' },
  { state: 'off_duty', label: '下班' },
]

/** States that imply a live event; only the dispatch lifecycle may leave them. */
const BUSY_STATES = new Set(['executing', 'designated_occupied', 'cross_group_support'])

export interface ManualOption {
  state: string
  label: string
  disabled: boolean
  reason?: string
}

/**
 * Mirror of the server rule so the menu does not offer an action that will be
 * rejected. The server stays authoritative; this only prevents dead clicks.
 */
export function manualOptions(staff: { state: string; status: string }): ManualOption[] {
  const busy = BUSY_STATES.has(staff.state)
  const inactive = staff.status !== 'active'
  return MANUAL_STATES.map((option) => {
    if (option.state === staff.state) {
      return { ...option, disabled: true, reason: '当前状态' }
    }
    if (busy) {
      return { ...option, disabled: true, reason: '有在途服务，请先完成或取消' }
    }
    if (inactive && option.state !== 'off_duty') {
      return { ...option, disabled: true, reason: '已停用，仅可置为下班' }
    }
    return { ...option, disabled: false }
  })
}
