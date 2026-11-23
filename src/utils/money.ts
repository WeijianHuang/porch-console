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

/** Line amount = unit price × quantity, rounded to the schema's 2 decimals.
 * Display only: the server snapshots the authoritative amount. */
export function lineAmount(unitPrice: string, quantity: number): string {
  return new Decimal(unitPrice).times(quantity).toFixed(2)
}

/** Sum of decimal strings; returns a 2-decimal string so callers never pass a
 * float to an endpoint that compares decimals exactly (design/03 §8 submit). */
export function sumAmounts(values: string[]): string {
  return values
    .reduce((total, value) => total.plus(new Decimal(value)), new Decimal(0))
    .toFixed(2)
}
