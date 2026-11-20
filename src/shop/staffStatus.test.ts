import { describe, expect, it } from 'vitest'
import {
  STAFF_BUCKETS, bucketLabel, bucketOf, manualOptions, stateLabel,
} from './staffStatus'

describe('bucketOf', () => {
  it('maps every documented engine state to a bucket', () => {
    for (const bucket of STAFF_BUCKETS) {
      for (const state of bucket.states) {
        expect(bucketOf(state)).toBe(bucket.key)
      }
    }
  })

  it('folds the eight display buckets exactly once per state', () => {
    const states = STAFF_BUCKETS.flatMap((b) => b.states)
    expect(new Set(states).size).toBe(states.length)
    expect(STAFF_BUCKETS).toHaveLength(8)
  })

  it('falls back to the neutral bucket for unknown or missing states', () => {
    expect(bucketOf(undefined)).toBe('off')
    expect(bucketOf('')).toBe('off')
    expect(bucketOf('teleporting')).toBe('off')
  })
})

describe('labels', () => {
  it('keeps a precise label per state', () => {
    expect(stateLabel('designated_occupied')).toBe('指定中')
    expect(stateLabel('cross_group_support')).toBe('跨组支援')
    expect(stateLabel('pinned')).toBe('排队中')
    expect(stateLabel('off_duty')).toBe('下班')
  })

  it('labels buckets for the legend', () => {
    expect(bucketLabel('queued')).toBe('排队中')
    expect(bucketLabel('off')).toBe('下班 / 停用')
  })
})

describe('manualOptions', () => {
  it('offers six targets and disables the current one', () => {
    const options = manualOptions({ state: 'available', status: 'active' })
    expect(options).toHaveLength(6)
    expect(options.filter((o) => o.disabled).map((o) => o.state)).toEqual(['available'])
  })

  it('blocks every target while the staff member has a live event', () => {
    const options = manualOptions({ state: 'executing', status: 'active' })
    expect(options.every((o) => o.disabled)).toBe(true)
    expect(options[0].reason).toContain('在途服务')
  })

  it('lets disabled staff only move to off duty', () => {
    const options = manualOptions({ state: 'off_duty', status: 'inactive' })
    const enabled = options.filter((o) => !o.disabled).map((o) => o.state)
    expect(enabled).toEqual([])
    expect(options.find((o) => o.state === 'available')?.reason).toContain('已停用')
  })
})
