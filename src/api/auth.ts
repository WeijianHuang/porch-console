import { api } from './client'
import type {
  ApiEnvelope,
  LoginRequest,
  LoginResponse,
  LogoutResponse,
  MeResponse,
  MeShopsResponse,
  PermissionsResponse,
} from './types'

export const authApi = {
  login: (body: LoginRequest) =>
    api.post<ApiEnvelope<LoginResponse>>('/api/v1/auth/login', body),
  logout: (refreshToken: string) =>
    api.post<ApiEnvelope<LogoutResponse>>('/api/v1/auth/logout', { refresh_token: refreshToken }),
  me: () => api.get<ApiEnvelope<MeResponse>>('/api/v1/me'),
  myShops: () => api.get<ApiEnvelope<MeShopsResponse>>('/api/v1/me/shops'),
  permissions: () => api.get<ApiEnvelope<PermissionsResponse>>('/api/v1/me/permissions'),
}
