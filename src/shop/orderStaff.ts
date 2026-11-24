/** Pure selection rules for service-line executors (porch-os ADR-0023).
 *
 * The backend is the authority: it rechecks qualification at assign time and
 * again at submit. These helpers only keep the UI from offering a person who
 * would be rejected, and from submitting an obviously incomplete cart.
 */
import type { CatalogItem, OrderLine, StaffSummary } from '../api/types'

/** Only active members who hold the qualification for this exact service item
 * may be offered. Employment status is checked; duty/executor state is shown
 * as a hint but deliberately not used as a filter (ADR-0023 §2). */
export function qualifiedStaffForItem(staff: StaffSummary[], itemId: string): StaffSummary[] {
  return staff.filter(
    (person) => person.status === 'active' && (person.service_item_ids ?? []).includes(itemId),
  )
}

export function isServiceItem(item: CatalogItem | undefined): boolean {
  return item?.type === 'service'
}

/** Line numbers of service lines still missing an executor. Product lines are
 * never included: they are not allowed to carry one at all. */
export function missingServiceStaffLines(
  lines: Array<Pick<OrderLine, 'line_no' | 'catalog_item_id' | 'staff_public_id'>>,
  catalog: CatalogItem[],
): number[] {
  const byId = new Map(catalog.map((item) => [item.public_id, item]))
  return lines
    .filter((line) => isServiceItem(byId.get(line.catalog_item_id)) && !line.staff_public_id)
    .map((line) => line.line_no)
}
