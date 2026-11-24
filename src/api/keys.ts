/** Query keys always carry the current shop for single-shop data (ADR-0006). */
export const queryKeys = {
  shops: (shopId: string | null) => ['shop-scope', shopId, 'shops'] as const,
  shop: (shopId: string) => ['shop-scope', shopId, 'detail'] as const,
  settings: (shopId: string) => ['shop-scope', shopId, 'settings'] as const,
  catalog: ['catalog', 'items'] as const,
  catalogCategories: ['catalog', 'categories'] as const,
  queues: (shopId: string) => ['shop-scope', shopId, 'queues'] as const,
  queue: (shopId: string, queueId: string) => ['shop-scope', shopId, 'queue', queueId] as const,
  queueStaff: (shopId: string, queueId: string) => ['shop-scope', shopId, 'queue-staff', queueId] as const,
  staff: (shopId: string) => ['shop-scope', shopId, 'staff'] as const,
  staffCategories: (shopId: string) => ['shop-scope', shopId, 'staff-categories'] as const,
  staffDetail: (shopId: string, staffId: string) => ['shop-scope', shopId, 'staff', staffId] as const,
  rooms: (shopId: string) => ['shop-scope', shopId, 'rooms'] as const,
  cards: (shopId: string) => ['shop-scope', shopId, 'cards'] as const,
  orders: (shopId: string, status?: string) => ['shop-scope', shopId, 'orders', status ?? 'all'] as const,
  order: (shopId: string, orderId: string) => ['shop-scope', shopId, 'order', orderId] as const,
  companionGroups: (shopId: string, status?: string) =>
    ['shop-scope', shopId, 'companion-groups', status ?? 'all'] as const,
  companionGroup: (shopId: string, groupId: string) =>
    ['shop-scope', shopId, 'companion-group', groupId] as const,
  schedulingBoard: (shopId: string) => ['shop-scope', shopId, 'scheduling-board'] as const,
  schedulingRules: (shopId: string) => ['shop-scope', shopId, 'scheduling-rules'] as const,
  schedulingPolicies: (shopId: string) => ['shop-scope', shopId, 'scheduling-policies'] as const,
  schedulingTaskTypes: (shopId: string) => ['shop-scope', shopId, 'scheduling-task-types'] as const,
  schedulingEvents: (shopId: string) => ['shop-scope', shopId, 'scheduling-events'] as const,
  schedulingAudit: (shopId: string) => ['shop-scope', shopId, 'scheduling-audit'] as const,
  permissions: ['identity', 'permissions'] as const,
}

export function belongsToShopScope(key: unknown): boolean {
  return Array.isArray(key) && key[0] === 'shop-scope'
}
