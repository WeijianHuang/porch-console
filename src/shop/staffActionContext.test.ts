import { describe, expect, it } from 'vitest'
import { nextOpenMenu, staffMenuKey } from './staffActionContext'

describe('staffMenuKey', () => {
  it('keeps one card per person when no queue context is given', () => {
    expect(staffMenuKey('s1')).toBe('s1')
    expect(staffMenuKey('s1', {})).toBe('s1')
  })

  it('separates the same person shown in different queues', () => {
    const inQ1 = staffMenuKey('s1', { queueId: 'q1' })
    const inQ2 = staffMenuKey('s1', { queueId: 'q2' })
    expect(inQ1).not.toBe(inQ2)
    expect(inQ1).toBe('s1|q1')
  })

  it('never collides with a different person in the same queue', () => {
    expect(staffMenuKey('s1', { queueId: 'q1' })).not.toBe(staffMenuKey('s2', { queueId: 'q1' }))
  })
})

describe('nextOpenMenu', () => {
  const q1 = staffMenuKey('s1', { queueId: 'q1' })
  const q2 = staffMenuKey('s1', { queueId: 'q2' })

  it('opens only the clicked card', () => {
    expect(nextOpenMenu(null, q1, true)).toBe(q1)
    expect(nextOpenMenu(q1, q2, true)).toBe(q2)
  })

  it('keeps the open card when a different card emits a close', () => {
    expect(nextOpenMenu(q2, q1, false)).toBe(q2)
    expect(nextOpenMenu(q2, q2, false)).toBeNull()
  })
})
