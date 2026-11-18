/**
 * Pure floor grouping for rooms (porch-os ADR-0011 / design/11). The backend
 * returns a flat list sorted by floor; the "distinguish by floor" view is a
 * pure frontend fold. No network or store state lives here (DA-01).
 */
import type { Room } from '../api/types'

export interface FloorGroup {
  floor: number
  label: string
  rooms: Room[]
}

/** Display label only; never round-trips to the backend. */
export function floorLabel(floor: number): string {
  if (floor < 0) return `B${Math.abs(floor)}`
  if (floor === 0) return 'GF'
  return `${floor}F`
}

/**
 * Group rooms by floor. Floors are ordered descending (higher floors first,
 * basement last); rooms inside a group are ordered by code ascending. The
 * input array is never mutated.
 */
export function groupByFloor(rooms: Room[]): FloorGroup[] {
  const byFloor = new Map<number, Room[]>()
  for (const room of rooms) {
    const bucket = byFloor.get(room.floor)
    if (bucket) bucket.push(room)
    else byFloor.set(room.floor, [room])
  }
  const floors = [...byFloor.keys()].sort((a, b) => b - a)
  return floors.map((floor) => ({
    floor,
    label: floorLabel(floor),
    rooms: [...(byFloor.get(floor) ?? [])].sort((a, b) => {
      if (a.code !== b.code) return a.code.localeCompare(b.code)
      return a.public_id.localeCompare(b.public_id)
    }),
  }))
}
