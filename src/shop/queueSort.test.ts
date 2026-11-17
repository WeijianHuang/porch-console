import { describe, expect, it } from 'vitest'
import { sortBySeq } from './queueSort'

describe('sortBySeq', () => {
  it('orders by sequence then name and does not mutate input', () => {
    const input = [
      { seq: 2, name: 'Beta' },
      { seq: 1, name: 'Zeta' },
      { seq: 1, name: 'Alpha' },
    ]
    const result = sortBySeq(input)
    expect(result.map((q) => q.name)).toEqual(['Alpha', 'Zeta', 'Beta'])
    expect(input[0].name).toBe('Beta')
  })

  it('handles an empty list', () => {
    expect(sortBySeq([])).toEqual([])
  })
})
