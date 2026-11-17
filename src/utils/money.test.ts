import { describe, expect, it } from 'vitest'
import { formatCNY, isValidMoney } from './money'

describe('money', () => {
  it('formats fixed-point strings with the CNY prefix', () => {
    expect(formatCNY('19.9')).toBe('¥19.90')
    expect(formatCNY('0')).toBe('¥0.00')
    expect(formatCNY('1234.567')).toBe('¥1234.57')
  })

  it('rejects non numeric input', () => {
    expect(isValidMoney('abc')).toBe(false)
    expect(() => formatCNY('abc')).toThrow()
  })
})
