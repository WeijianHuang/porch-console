import { describe, expect, it } from 'vitest'
import type { Room } from '../api/types'
import { floorLabel, groupByFloor } from './roomGroup'

function room(public_id: string, floor: number, code: string, status = 'active'): Room {
  return {
    public_id, floor, code, name: code, status, version: 0,
    created_at: '', updated_at: '',
  }
}

describe('floorLabel', () => {
  it('formats basement, ground and upper floors', () => {
    expect(floorLabel(-2)).toBe('B2')
    expect(floorLabel(-1)).toBe('B1')
    expect(floorLabel(0)).toBe('GF')
    expect(floorLabel(1)).toBe('1F')
    expect(floorLabel(12)).toBe('12F')
  })
})

describe('groupByFloor', () => {
  it('orders floors descending and rooms by code ascending', () => {
    const rooms = [
      room('c', 1, '102'),
      room('a', 2, '201'),
      room('d', 1, '101'),
      room('b', -1, 'B01'),
    ]
    const groups = groupByFloor(rooms)
    expect(groups.map((g) => g.floor)).toEqual([2, 1, -1])
    expect(groups.map((g) => g.label)).toEqual(['2F', '1F', 'B1'])
    expect(groups[1].rooms.map((r) => r.code)).toEqual(['101', '102'])
  })

  it('keeps inactive rooms in their group', () => {
    const groups = groupByFloor([room('x', 1, '101', 'inactive')])
    expect(groups).toHaveLength(1)
    expect(groups[0].rooms[0].status).toBe('inactive')
  })

  it('does not mutate the input', () => {
    const rooms = [room('c', 1, '102'), room('d', 1, '101')]
    groupByFloor(rooms)
    expect(rooms.map((r) => r.code)).toEqual(['102', '101'])
  })

  it('returns an empty list for no rooms', () => {
    expect(groupByFloor([])).toEqual([])
  })
})
