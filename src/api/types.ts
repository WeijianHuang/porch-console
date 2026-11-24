/**
 * Types mirror porch-os docs/design/03 (frozen contract).
 * Temporary hand-written layer: replace with generated types once the backend
 * commits api/openapi.yaml. Never invent fields here (ADR-0001 / FQ-02).
 */

export interface ApiMeta {
  request_id: string
}

export interface ApiEnvelope<T> {
  data: T
  meta: ApiMeta
}

export interface PageInfo {
  next_cursor: string
  has_more: boolean
}

export interface ApiList<T> {
  data: T[]
  page?: PageInfo
  meta: ApiMeta
}

export interface ApiErrorDetail {
  field?: string
  reason?: string
}

export interface ApiErrorPayload {
  error: {
    code: string
    message: string
    retryable: boolean
    details?: ApiErrorDetail[]
  }
  meta?: ApiMeta
}

export interface VisibleShop {
  public_id: string
  name: string
  status: 'active' | 'inactive' | string
}

export interface LoginRequest {
  login: string
  password: string
}

export interface LoginResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
  shops: VisibleShop[]
  default_shop_id: string | null
}

export interface RefreshResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  default_shop_id: string | null
}

export interface LogoutResponse {
  logged_out: boolean
}

export interface MeResponse {
  user_id: number
  login: string
  roles: string[]
}

export interface MeShopsResponse {
  shops: VisibleShop[]
  default_shop_id: string | null
}

export interface PermissionsResponse {
  roles: string[]
  permissions: string[]
}

export interface Shop {
  public_id: string
  code: string
  name: string
  status: string
  version: number
  created_at: string
  updated_at: string
}

export type ShopSettings = Record<string, unknown>

export interface CatalogItem {
  public_id: string
  sku: string
  name: string
  type: 'product' | 'service' | string
  base_price: string
  duration_minutes: number | null
  active: boolean
  version: number
  created_at: string
  updated_at: string
  /** ADR-0024: read-only grouping for the order entry staff picker. */
  category_public_id?: string | null
  category_name?: string | null
}

export interface CatalogCategory {
  public_id: string
  parent_id: string | null
  code: string
  name: string
  sort_order: number
}

export interface CreateCatalogItemRequest {
  sku: string
  name: string
  type: 'product' | 'service'
  base_price: string
  duration_minutes?: number
  category_public_id?: string
}

export interface UpdateCatalogItemRequest {
  name: string
  base_price: string
  active: boolean
  version: number
  duration_minutes?: number
  category_public_id?: string
}

export interface UpdateShopRequest {
  name: string
  status: 'active' | 'inactive'
  version: number
}

/** Queues and staff (porch-os ADR-0009 / design/10). Shop-scoped resources. */
export interface Queue {
  public_id: string
  seq: number
  name: string
  status: string
  version: number
  created_at: string
  updated_at: string
}

export interface QueueView extends Queue {
  staff_count: number
}

export interface StaffRef {
  public_id: string
  display_name: string
  duty_status: 'on' | 'off' | string
  position: number
}

export interface QueueRef {
  public_id: string
  name: string
  seq: number
}

export interface QueueDetail extends Queue {
  staff: StaffRef[]
}

/** ADR-0024: shop-scoped classification metadata; not a permission or qualification. */
export interface StaffCategoryRef {
  public_id: string
  code: string
  name: string
}

export interface StaffCategory extends StaffCategoryRef {
  status: string
  sort_order: number
  version: number
}

export interface CreateStaffCategoryRequest {
  code: string
  name: string
  sort_order?: number
}

export interface UpdateStaffCategoryRequest {
  name?: string
  sort_order?: number
  status?: 'active' | 'inactive'
  version: number
}

export interface Staff {
  public_id: string
  code: string
  display_name: string
  status: string
  duty_status: 'on' | 'off' | string
  version: number
  created_at: string
  updated_at: string
  category?: StaffCategoryRef | null
}

export interface StaffDetail extends Staff {
  queues: QueueRef[]
  /** ADR-0023: qualified service catalog item public_ids. */
  service_item_ids?: string[]
}

export interface StaffQueueRef {
  public_id: string
  name: string
  seq: number
  position: number
  pin_type: string
}

/** ID card projection on board/staff rows (porch-os ADR-0017). */
export interface CardRef {
  public_id: string
  code: string
  name: string
}

export interface CardHolder {
  public_id: string
  display_name: string
  held_from: string
}

export interface IdCard extends CardRef {
  status: 'active' | 'inactive' | string
  version: number
  holder: CardHolder | null
  /** Active order occupying the card; null when free (ADR-0022). */
  bound_order?: CardBoundOrder | null
}

export interface CardBoundOrder {
  public_id: string
  order_no: string
  status: string
}

export interface CreateCardRequest {
  code: string
  name: string
  status?: 'active' | 'inactive'
}

export interface UpdateCardRequest {
  name?: string
  status?: 'active' | 'inactive'
  version: number
}

export interface HoldCardRequest {
  staff_id: string
  reason?: string
}

export interface ReleaseCardRequest {
  reason?: string
}

/** `GET /staff` projection (porch-os ADR-0015): state + every membership. */
export interface StaffSummary extends Staff {
  state: ExecutorState | string
  stop_rotation: boolean
  primary_queue_id: string
  queues: StaffQueueRef[]
  id_card: CardRef | null
  service_remaining_minutes: number | null
  /** ADR-0023: qualified service catalog item public_ids. */
  service_item_ids: string[]
}

export interface SetStaffStateRequest {
  state: string
  reason?: string
  version?: number
}

/** ADR-0023: full replacement of a staff member's service-item qualifications. */
export interface SetStaffServiceItemsRequest {
  catalog_item_ids: string[]
  version: number
}

export interface SetStaffRotationRequest {
  stop_rotation: boolean
  version?: number
}

export interface MoveQueueStaffRequest {
  to: 'head' | 'tail' | 'index'
  index?: number
}

export interface CreateQueueRequest {
  seq: number
  name: string
}

export interface UpdateQueueRequest {
  seq?: number
  name?: string
  status?: 'active' | 'inactive'
  version: number
}

export interface CreateStaffRequest {
  code: string
  display_name: string
}

export interface UpdateStaffRequest {
  display_name?: string
  status?: 'active' | 'inactive'
  duty_status?: 'on' | 'off'
  /** ADR-0024: pass "" to clear the category. */
  category_public_id?: string
  version: number
}

/** Full ordered member list; never adds or removes members (ADR-0010). */
export interface ReorderQueueStaffRequest {
  staff_ids: string[]
  version: number
}

/** Rooms and floors (porch-os ADR-0011 / design/11). Shop-scoped resources.
 * Floor is an integer scalar (-5..200), not an entity; no floor_id. */
export interface Room {
  public_id: string
  floor: number
  code: string
  name: string
  status: 'active' | 'inactive' | string
  version: number
  created_at: string
  updated_at: string
}

export interface CreateRoomRequest {
  floor: number
  code: string
  name: string
}

export interface UpdateRoomRequest {
  floor?: number
  code?: string
  name?: string
  status?: 'active' | 'inactive'
  version: number
}

/** Scheduling engine (porch-os ADR-0012 / design/12). Generic terms only. */

export type ExecutorState =
  | 'standby' | 'available' | 'executing' | 'designated_occupied' | 'pinned'
  | 'time_reserved' | 'overtime' | 'disabled' | 'leave' | 'off_duty'
  | 'cross_group_support'

export interface BoardQueue {
  public_id: string
  seq: number
  name: string
  type: string
  frozen: boolean
  enabled: boolean
}

export interface BoardMember {
  queue_id: string
  executor_id: string
  display_name: string
  code: string
  position: number
  source: string
  pin_type: string
  duty_status: string
  state: string
  is_primary: boolean
  id_card: CardRef | null
  service_remaining_minutes: number | null
}

export interface BoardExecutor {
  public_id: string
  code: string
  display_name: string
  duty_status: string
  state: string
  primary_queue_id: string
  stop_rotation: boolean
  id_card: CardRef | null
  service_remaining_minutes: number | null
}

export interface SchedulingBoard {
  queues: BoardQueue[]
  members: BoardMember[]
  executors: BoardExecutor[]
}

export interface TimeWindow {
  start: string
  end: string
  days?: number[]
}

export type ScopeLevel = 'executor' | 'queue' | 'task_type' | 'site' | 'global'
export type RuleType =
  | 'executor_stopped_rotation' | 'rotation_master_switch'
  | 'assignment_method_allows_rotation' | 'task_type_no_rotation'
  | 'overtime_no_rotation' | 'time_reserved' | 'group_a_to_b' | 'group_b_to_a'
export type Decision = 'rotate' | 'hold'

export interface SchedulingRule {
  public_id: string
  type: RuleType
  order: number
  enabled: boolean
  scope: ScopeLevel
  scope_id: string
  on_hit: Decision
  time_window: TimeWindow | null
  assignment_methods: string[]
  from_group: string
  to_group: string
  no_rotation: boolean
  version: number
}

export type RuleInput = Pick<SchedulingRule,
  'type' | 'order' | 'enabled' | 'scope' | 'scope_id' | 'on_hit' |
  'time_window' | 'assignment_methods' | 'from_group' | 'to_group' | 'no_rotation'>

export type PropagationMode =
  | 'independent' | 'all' | 'same_group' | 'allowlist' | 'exclude' | 'frozen'
export type QueueAction =
  | 'move_to_tail' | 'restore' | 'insert_at' | 'suspend' | 'remove'

export interface SchedulingPolicy {
  public_id: string
  primary_queue_id: string
  mode: PropagationMode
  allowlist: string[]
  exclude: string[]
  group: string
  action_map: Record<string, QueueAction>
  insert_at: Record<string, number>
  version: number
}

export interface PolicyInput {
  primary_queue_id: string
  mode: PropagationMode
  allowlist: string[]
  exclude: string[]
  group: string
  action_map: Record<string, QueueAction>
  insert_at: Record<string, number>
}

export interface SchedulingTaskType {
  public_id: string
  code: string
  name: string
  group: string
  no_rotation: boolean
  version: number
}

export interface SchedulingEvent {
  public_id: string
  event_id: string
  staff_id: string
  source_queue_id: string
  method: string
  decision: string
  hit_rule: string
  explain: string
  operator: string
  occurred_at: string
}

/** Orders (porch-os ADR-0013/0014/0016/0019, design/03 §8). Shop-scoped.
 * Amounts are decimal strings; `paid/refunded/refundable` are derived on read
 * and only present on the detail response (omitempty in the list projection). */
export interface OrderLine {
  line_no: number
  catalog_item_id: string
  item_name_snapshot: string
  quantity: string
  unit_price: string
  amount: string
  /** ADR-0023: executor of a service line; product lines carry null. */
  staff_public_id?: string | null
  /** Historical name kept even after the staff row is deleted. */
  staff_name_snapshot?: string | null
}

export interface Order {
  public_id: string
  order_no: string
  status: string
  member_id: string | null
  shift_id: string | null
  operator_id: number
  total_amount: string
  discount_amount: string
  version: number
  created_at: string
  updated_at: string
  lines?: OrderLine[]
  paid_amount?: string
  refunded_amount?: string
  refundable_amount?: string
  /** Active card binding; null once released (ADR-0022). */
  card?: OrderCardRef | null
  /** Last released binding only — a settled order never advertises a usable card. */
  card_binding_history?: OrderCardBinding
  room?: OrderRoomRef | null
  /** Current active membership's group; null when the order is standalone. */
  companion_group?: OrderCompanionGroupRef
}

/** Order-side card projection (ADR-0022 §1). */
export interface OrderCardRef {
  public_id: string
  code: string
  name: string
}

export interface OrderCardBinding {
  card: OrderCardRef
  released_at: string
  reason: 'settled' | 'cancelled' | 'unbound' | 'replaced' | string
}

/** Room is attribution, never an exclusive lock: many orders may share one. */
export interface OrderRoomRef {
  public_id: string
  floor: number
  code: string
  name: string
}

/** `status` is present because a membership outlives group close/cancel. */
export interface OrderCompanionGroupRef {
  public_id: string
  status: 'open' | 'closed' | 'cancelled' | string
}

/** Payment channels allowed by the schema CHECK (`00010_orders.sql`): real
 * funds only. `balance` needs a member account and is not offered here. */
export type PaymentMethod = 'cash' | 'card'

export interface PaymentEntry {
  method: PaymentMethod
  amount: string
}

export interface Payment {
  public_id: string
  kind: string
  order_id: string | null
  member_id: string | null
  status: string
  amount: string
  entries: PaymentEntry[]
  paid_at?: string
}

/** `POST /orders/{id}/payments` returns the receipt together with the order as
 * it stands after settlement (card already released, ADR-0022 §4). */
export interface PaymentResult {
  payment: Payment
  order: Order
}

/** Companion groups (ADR-0022 §5). The group stores no amount and is never a
 * payment subject: totals are read-only derivations over member orders. */
export interface CompanionMember {
  order_public_id: string
  order_no: string
  status: string
  total_amount: string
  discount_amount: string
  paid_amount: string
  refunded_amount: string
  refundable_amount: string
  payable_amount: string
  joined_at: string
}

export interface CompanionGroup {
  public_id: string
  status: 'open' | 'closed' | 'cancelled' | string
  version: number
  created_at: string
  updated_at: string
  members?: CompanionMember[]
  payable_total?: string
  paid_total?: string
}

export interface CreateCompanionGroupRequest {
  order_public_ids?: string[]
}

export interface AuditEntry {
  public_id: string
  action: string
  target_type: string
  target_id: string
  payload: Record<string, unknown>
  operator: string
  created_at: string
}

export interface ChainStep {
  rule_id: string
  type: RuleType
  scope: ScopeLevel
  hit: boolean
  decision: Decision
  reason: string
}

export interface PositionChange {
  queue_id: string
  executor_id: string
  old_position: number
  new_position: number
  action: string
  source: string
}

export interface DecisionRecord {
  event_id: string
  site_id: string
  source_queue_id: string
  decision: Decision
  hit_rule_id: string
  hit_rule_type: RuleType | ''
  hit_scope: ScopeLevel | ''
  chain: ChainStep[]
  fell_back: boolean
  changes: PositionChange[]
  explain: string
  operator: string
}

export interface DispatchRequest {
  event_id: string
  staff_id: string
  source_queue_id: string
  task_type_id: string
  assignment_method: string
}
