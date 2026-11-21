/**
 * Operator menu contract shared by every card that represents a staff member
 * (porch-os ADR-0015 / design/13). The provider owns the mutations and the two
 * dialogs; a card only needs the Dropdown props.
 *
 * Kept in a non-component module so the provider file exports components only
 * (react-refresh).
 */
import { createContext, useContext } from 'react'
import type { MenuProps } from 'antd'
import type { StaffSummary } from '../api/types'

/** Props to spread on <Dropdown> so the wrapped card opens the operator menu. */
export interface StaffMenuBinding {
  trigger: 'click'[]
  placement: 'bottomLeft'
  menu: MenuProps
  open: boolean
  onOpenChange: (open: boolean) => void
}

export interface StaffMenuOptions {
  /**
   * Queue the card was clicked in. It both puts that queue first in the
   * "move"/"pin" submenus and identifies the card: one person may appear in
   * several queues at once, and only the clicked card may open its menu.
   */
  queueId?: string
}

/**
 * Identity of one card, not of one person. A person in three queues has three
 * cards, so keying the open menu by `public_id` alone opens all three at once.
 */
export function staffMenuKey(publicId: string, options?: StaffMenuOptions): string {
  return options?.queueId ? `${publicId}|${options.queueId}` : publicId
}

/**
 * Controlled Dropdown state. Only the card whose key matches is open; a
 * close event from another card must not clear the newly opened menu.
 */
export function nextOpenMenu(current: string | null, cardKey: string, open: boolean): string | null {
  return open ? cardKey : (current === cardKey ? null : current)
}

export interface StaffActionApi {
  canWrite: boolean
  canSchedule: boolean
  menuProps: (staff: StaffSummary, options?: StaffMenuOptions) => StaffMenuBinding
}

export const StaffActionContext = createContext<StaffActionApi | null>(null)

export function useStaffActionMenu(): StaffActionApi {
  const context = useContext(StaffActionContext)
  if (!context) {
    throw new Error('useStaffActionMenu must be used inside StaffActionProvider')
  }
  return context
}
