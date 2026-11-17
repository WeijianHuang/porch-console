import type { VisibleShop } from '../api/types'

/** Only active shops may become the current shop (ADR-0006 §5). */
export function activeShops(shops: VisibleShop[]): VisibleShop[] {
  return shops.filter((shop) => shop.status === 'active')
}

/**
 * Restore a remembered shop only if it is still visible and active;
 * otherwise fall back to the server-provided default (ADR-0006 §3).
 */
export function resolveCurrentShop(
  shops: VisibleShop[],
  defaultShopId: string | null,
  remembered: string | null,
): string | null {
  const active = activeShops(shops)
  if (remembered && active.some((shop) => shop.public_id === remembered)) return remembered
  if (defaultShopId && active.some((shop) => shop.public_id === defaultShopId)) return defaultShopId
  return null
}

export function shopName(shops: VisibleShop[], id: string | null): string {
  if (!id) return ''
  return shops.find((shop) => shop.public_id === id)?.name ?? id
}
