import { api } from './client'
import type {
  ApiEnvelope,
  ApiList,
  CatalogItem,
  CreateCatalogItemRequest,
  UpdateCatalogItemRequest,
} from './types'

export const catalogApi = {
  list: (cursor?: string) =>
    api.get<ApiList<CatalogItem>>(
      `/api/v1/catalog-items${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
    ),
  create: (body: CreateCatalogItemRequest) =>
    api.post<ApiEnvelope<CatalogItem>>('/api/v1/catalog-items', body),
  update: (id: string, body: UpdateCatalogItemRequest) =>
    api.patch<ApiEnvelope<CatalogItem>>(`/api/v1/catalog-items/${id}`, body),
}
