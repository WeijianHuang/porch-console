/** Staff category API (porch-console ADR-0008 / porch-os ADR-0024). */
import { api } from './client'
import type {
  ApiEnvelope,
  CreateStaffCategoryRequest,
  StaffCategory,
  UpdateStaffCategoryRequest,
} from './types'

const base = (shopId: string) => `/api/v1/shops/${encodeURIComponent(shopId)}`

export const staffCategoriesApi = {
  list: (shopId: string) =>
    api.get<ApiEnvelope<StaffCategory[]>>(`${base(shopId)}/staff-categories`, { shopId }),
  create: (shopId: string, body: CreateStaffCategoryRequest) =>
    api.post<ApiEnvelope<StaffCategory>>(`${base(shopId)}/staff-categories`, body, { shopId }),
  update: (shopId: string, categoryId: string, body: UpdateStaffCategoryRequest) =>
    api.patch<ApiEnvelope<StaffCategory>>(
      `${base(shopId)}/staff-categories/${encodeURIComponent(categoryId)}`, body, { shopId },
    ),
}
