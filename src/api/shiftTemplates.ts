/** Shift template API (porch-console ADR-0009 / porch-os ADR-0025). */
import { api } from './client'
import type {
  ApiEnvelope,
  AssignShiftTemplateStaffRequest,
  CreateShiftTemplateRequest,
  ShiftTemplate,
  UpdateShiftTemplateRequest,
} from './types'

const base = (shopId: string) => `/api/v1/shops/${encodeURIComponent(shopId)}`

export const shiftTemplatesApi = {
  list: (shopId: string) =>
    api.get<ApiEnvelope<ShiftTemplate[]>>(`${base(shopId)}/shift-templates`, { shopId }),
  create: (shopId: string, body: CreateShiftTemplateRequest) =>
    api.post<ApiEnvelope<ShiftTemplate>>(`${base(shopId)}/shift-templates`, body, { shopId }),
  update: (shopId: string, templateId: string, body: UpdateShiftTemplateRequest) =>
    api.patch<ApiEnvelope<ShiftTemplate>>(
      `${base(shopId)}/shift-templates/${encodeURIComponent(templateId)}`, body, { shopId },
    ),
  remove: (shopId: string, templateId: string) =>
    api.delete<ApiEnvelope<null>>(
      `${base(shopId)}/shift-templates/${encodeURIComponent(templateId)}`, { shopId },
    ),
  assignStaff: (shopId: string, templateId: string, body: AssignShiftTemplateStaffRequest) =>
    api.put<ApiEnvelope<ShiftTemplate>>(
      `${base(shopId)}/shift-templates/${encodeURIComponent(templateId)}/staff`, body, { shopId },
    ),
}
