import type { QueueRef, QueueView } from '../api/types'

/** Backend already sorts by seq; keep a client-side pure sort for optimistic UI. */
export function sortBySeq<T extends { seq: number; name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => (a.seq !== b.seq ? a.seq - b.seq : a.name.localeCompare(b.name)))
}

/** Stable view used by the queue page list. */
export function sortQueueViews(items: QueueView[]): QueueView[] {
  return sortBySeq(items)
}

export function sortQueueRefs(items: QueueRef[]): QueueRef[] {
  return sortBySeq(items)
}
