import { describe, expect, it } from 'vitest'
import { BOARD_DENSITIES, parseBoardDensity } from './boardDensity'

describe('parseBoardDensity', () => {
  it('accepts the three documented densities', () => {
    for (const d of BOARD_DENSITIES) expect(parseBoardDensity(d)).toBe(d)
  })

  it('falls back to medium for unknown or missing values', () => {
    expect(parseBoardDensity(null)).toBe('medium')
    expect(parseBoardDensity(undefined)).toBe('medium')
    expect(parseBoardDensity('')).toBe('medium')
    expect(parseBoardDensity('tiny')).toBe('medium')
    expect(parseBoardDensity('COMPACT')).toBe('medium')
  })
})
