import Decimal from 'decimal.js'

/** Amounts arrive as strings; format with fixed-point math, never floats (ADR-0004). */
export function formatCNY(value: string): string {
  const amount = new Decimal(value)
  if (!amount.isFinite()) throw new Error(`非法金额: ${value}`)
  return `¥${amount.toFixed(2)}`
}

export function isValidMoney(value: string): boolean {
  try {
    return new Decimal(value).isFinite()
  } catch {
    return false
  }
}
