import { describe, expect, it } from 'vitest'
import { DEFAULT_CHAIN_ORDER, defaultRules } from './defaultRules'

describe('defaultRules', () => {
  it('produces the full 8-step chain in order', () => {
    const rules = defaultRules()
    expect(rules).toHaveLength(8)
    expect(rules.map((r) => r.type)).toEqual(DEFAULT_CHAIN_ORDER)
    expect(rules.map((r) => r.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('uses a site-scoped, hold-on-hit, all-enabled baseline with no site-specific ID', () => {
    for (const r of defaultRules()) {
      expect(r.enabled).toBe(true)
      expect(r.scope).toBe('site')
      expect(r.scope_id).toBe('')
      expect(r.on_hit).toBe('hold')
      expect(r.time_window).toBeNull()
    }
  })

  it('maps only rotational as the rotation-allowing assignment method', () => {
    const byType = Object.fromEntries(defaultRules().map((r) => [r.type, r]))
    expect(byType.assignment_method_allows_rotation.assignment_methods).toEqual(['rotational'])
    for (const r of defaultRules()) {
      if (r.type !== 'assignment_method_allows_rotation') {
        expect(r.assignment_methods).toEqual([])
      }
    }
  })

  it('sets no_rotation on the steps whose hit depends on it', () => {
    const byType = Object.fromEntries(defaultRules().map((r) => [r.type, r]))
    expect(byType.overtime_no_rotation.no_rotation).toBe(true)
    expect(byType.group_a_to_b.no_rotation).toBe(true)
    expect(byType.group_b_to_a.no_rotation).toBe(true)
    expect(byType.time_reserved.no_rotation).toBe(false)
  })

  it('returns fresh objects so drafts cannot mutate the template', () => {
    const a = defaultRules()
    const b = defaultRules()
    a[0].enabled = false
    a[0].order = 99
    expect(b[0].enabled).toBe(true)
    expect(b[0].order).toBe(1)
    expect(a[0]).not.toBe(b[0])
  })
})
