import { ApiError, shouldRetry, toApiError } from './errors'
import { clearTokens, getAccessToken, getRefreshToken, setAccessToken, setRefreshToken } from './tokens'
import type { ApiEnvelope, ApiErrorPayload, RefreshResponse } from './types'

/** Empty in dev: requests go to same-origin Vite proxy; production sets an explicit URL. */
const baseURL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')
const MAX_RETRIES = 3

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

export interface RequestOptions {
  method?: HttpMethod
  body?: unknown
  /** Required for every single-shop endpoint; never inferred from the path. */
  shopId?: string | null
  signal?: AbortSignal
}

const singleShopControllers = new Set<AbortController>()
const refreshListeners = new Set<(response: RefreshResponse) => void>()

/** Called by the shop switcher before changing context (ADR-0006 / FQ-10). */
export function abortSingleShopRequests(): void {
  for (const controller of singleShopControllers) controller.abort()
  singleShopControllers.clear()
}

export function onSessionRefreshed(listener: (response: RefreshResponse) => void): () => void {
  refreshListeners.add(listener)
  return () => refreshListeners.delete(listener)
}

function requestId(): string {
  return crypto.randomUUID()
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

interface PerformResult<T> {
  status: number
  data: T | null
}

async function perform<T>(
  path: string,
  options: RequestOptions,
  idempotencyKey: string,
): Promise<PerformResult<T>> {
  const method = options.method ?? 'GET'
  const isWrite = method !== 'GET'
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Request-Id': requestId(),
  }
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  const access = getAccessToken()
  if (access) headers.Authorization = `Bearer ${access}`
  if (options.shopId) headers['X-Shop-Id'] = options.shopId
  if (isWrite) headers['Idempotency-Key'] = idempotencyKey

  const controller = new AbortController()
  if (options.signal) {
    options.signal.addEventListener('abort', () => controller.abort(), { once: true })
  }
  if (options.shopId) singleShopControllers.add(controller)

  try {
    const response = await fetch(`${baseURL}${path}`, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    })
    const text = await response.text()
    const payload = text ? (JSON.parse(text) as unknown) : null
    if (!response.ok) {
      throw toApiError(payload as ApiErrorPayload | undefined, response.status)
    }
    return { status: response.status, data: payload as T | null }
  } finally {
    singleShopControllers.delete(controller)
  }
}

let refreshInFlight: Promise<RefreshResponse> | null = null

/** Single-flight refresh; updates the in-memory access token and session refresh token. */
export function refreshSession(): Promise<RefreshResponse> {
  if (refreshInFlight) return refreshInFlight
  refreshInFlight = (async () => {
    const token = getRefreshToken()
    if (!token) {
      clearTokens()
      throw new ApiError({
        code: 'UNAUTHENTICATED',
        message: '登录已过期，请重新登录',
        retryable: false,
        status: 401,
      })
    }
    const result = await perform<ApiEnvelope<RefreshResponse>>(
      '/api/v1/auth/refresh',
      { method: 'POST', body: { refresh_token: token } },
      requestId(),
    )
    const session = result.data?.data
    if (!session) throw new Error('刷新令牌响应为空')
    setAccessToken(session.access_token)
    setRefreshToken(session.refresh_token)
    for (const listener of refreshListeners) listener(session)
    return session
  })().finally(() => {
    refreshInFlight = null
  })
  return refreshInFlight
}

/** Every response keeps the frozen envelope; callers unwrap `.data` themselves. */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const idempotencyKey = requestId()
  const isAuthEndpoint = path.startsWith('/api/v1/auth/')
  let refreshed = false
  let attempt = 0

  while (true) {
    try {
      return (await perform<T>(path, options, idempotencyKey)).data as T
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.code === 'UNAUTHENTICATED' &&
        !isAuthEndpoint &&
        !refreshed &&
        getRefreshToken()
      ) {
        refreshed = true
        await refreshSession()
        continue
      }
      if (shouldRetry(error) && attempt < MAX_RETRIES - 1) {
        attempt += 1
        await sleep(200 * attempt)
        continue
      }
      throw error
    }
  }
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PATCH', body }),
  put: <T>(path: string, body: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PUT', body }),
}
