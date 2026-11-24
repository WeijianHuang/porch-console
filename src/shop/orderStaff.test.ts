import { describe, expect, it } from 'vitest'
import type { CatalogItem, StaffSummary } from '../api/types'
import { isServiceItem, missingServiceStaffLines, qualifiedStaffForItem } from './orderStaff'

const staff = (publicId: string, serviceItemIds: string[], status = 'active') =>
  ({ public_id: publicId, display_name: publicId, status, service_item_ids: serviceItemIds }) as StaffSummary

const item = (publicId: string, type: string) =>
  ({ public_id: publicId, type }) as CatalogItem

describe('qualifiedStaffForItem', () => {
  it('only returns active holders of the exact qualification', () => {
    const people = [
      staff('a', ['svc-1', 'svc-2']),
      staff('b', ['svc-2']),
      staff('c', [], 'inactive'),
    ]
    expect(qualifiedStaffForItem(people, 'svc-1').map((s) => s.public_id)).toEqual(['a'])
    expect(qualifiedStaffForItem(people, 'svc-2').map((s) => s.public_id)).toEqual(['a', 'b'])
  })

  it('does not hide an on-duty hint by filtering on executor state', () => {
    const people = [staff('a', ['svc-1'])]
    people[0].duty_status = 'off'
    people[0].state = 'leave'
    expect(qualifiedStaffForItem(people, 'svc-1')).toHaveLength(1)
  })
})

describe('isServiceItem', () => {
  it('treats only service as requiring an executor', () => {
    expect(isServiceItem(item('s', 'service'))).toBe(true)
    expect(isServiceItem(item('p', 'product'))).toBe(false)
    expect(isServiceItem(undefined)).toBe(false)
  })
})

describe('missingServiceStaffLines', () => {
  const catalog = [item('s1', 'service'), item('s2', 'service'), item('p1', 'product')]

  it('flags only service lines with no executor', () => {
    const lines = [
      { line_no: 1, catalog_item_id: 's1', staff_public_id: null },
      { line_no: 2, catalog_item_id: 's2', staff_public_id: 'a' },
      { line_no: 3, catalog_item_id: 'p1', staff_public_id: null },
      { line_no: 4, catalog_item_id: 's2', staff_public_id: undefined },
    ]
    expect(missingServiceStaffLines(lines, catalog)).toEqual([1, 4])
  })

  it('returns nothing for a product-only order', () => {
    const lines = [{ line_no: 1, catalog_item_id: 'p1', staff_public_id: null }]
    expect(missingServiceStaffLines(lines, catalog)).toEqual([])
  })
})
