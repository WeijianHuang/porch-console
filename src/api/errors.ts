import type { ApiErrorDetail, ApiErrorPayload } from './types'

export class ApiError extends Error {
  readonly code: string
  readonly retryable: boolean
  readonly status: number
  readonly details: ApiErrorDetail[]
  readonly requestId?: string

  constructor(params: {
    code: string
    message: string
    retryable: boolean
    status: number
    details?: ApiErrorDetail[]
    requestId?: string
  }) {
    super(params.message)
    this.name = 'ApiError'
    this.code = params.code
    this.retryable = params.retryable
    this.status = params.status
    this.details = params.details ?? []
    this.requestId = params.requestId
  }
}

export function toApiError(payload: ApiErrorPayload | undefined, status: number): ApiError {
  const error = payload?.error
  if (!error) {
    return new ApiError({
      code: status >= 500 ? 'INTERNAL' : 'UNPROCESSABLE',
      message: status >= 500 ? '服务暂时不可用，请稍后重试' : '请求无法处理，请检查输入',
      retryable: status >= 500,
      status,
    })
  }
  return new ApiError({
    code: error.code,
    message: error.message,
    retryable: error.retryable,
    status,
    details: error.details,
    requestId: payload?.meta?.request_id,
  })
}

export function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError && /fetch|network|load failed/i.test(error.message)
}

/** UI never guesses retryability from HTTP status (design/03 §4). */
export function shouldRetry(error: unknown): boolean {
  if (error instanceof ApiError) return error.retryable
  return isNetworkError(error)
}
