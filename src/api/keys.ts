/** Query keys always carry the current shop for single-shop data (ADR-0006). */
export const queryKeys = {
  shops: (shopId: string | null) => ['shop-scope', shopId, 'shops'] as const,
  shop: (shopId: string) => ['shop-scope', shopId, 'detail'] as const,
  settings: (shopId: string) => ['shop-scope', shopId, 'settings'] as const,
  catalog: ['catalog', 'items'] as const,
  queues: (shopId: string) => ['shop-scope', shopId, 'queues'] as const,
  queue: (shopId: string, queueId: string) => ['shop-scope', shopId, 'queue', queueId] as const,
  queueStaff: (shopId: string, queueId: string) => ['shop-scope', shopId, 'queue-staff', queueId] as const,
  staff: (shopId: string) => ['shop-scope', shopId, 'staff'] as const,
  staffDetail: (shopId: string, staffId: string) => ['shop-scope', shopId, 'staff', staffId] as const,
  rooms: (shopId: string) => ['shop-scope', shopId, 'rooms'] as const,
  permissions: ['identity', 'permissions'] as const,
}

export function belongsToShopScope(key: unknown): boolean {
  return Array.isArray(key) && key[0] === 'shop-scope'
}
