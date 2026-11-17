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
  active: boolean
  version: number
  created_at: string
  updated_at: string
}

export interface CreateCatalogItemRequest {
  sku: string
  name: string
  type: 'product' | 'service'
  base_price: string
}

export interface UpdateCatalogItemRequest {
  name: string
  base_price: string
  active: boolean
  version: number
}

export interface UpdateShopRequest {
  name: string
  status: 'active' | 'inactive'
  version: number
}
