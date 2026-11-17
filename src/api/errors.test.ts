import { describe, expect, it } from 'vitest'
import { ApiError, shouldRetry, toApiError } from './errors'

describe('error contract', () => {
  it('uses the server retryable flag instead of the HTTP class', () => {
    const retryableServerError = toApiError(
      {
        error: { code: 'IDEMPOTENCY_IN_PROGRESS', message: '处理中', retryable: true },
        meta: { request_id: 'req-1' },
      },
      409,
    )
    const nonRetryableServerError = toApiError(
      { error: { code: 'PERMISSION_DENIED', message: '无权访问', retryable: false } },
      403,
    )
    expect(shouldRetry(retryableServerError)).toBe(true)
    expect(shouldRetry(nonRetryableServerError)).toBe(false)
    expect(retryableServerError.requestId).toBe('req-1')
  })

  it('treats unclassified 5xx as retryable but never exposes server details', () => {
    const error = toApiError(undefined, 500)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.code).toBe('INTERNAL')
    expect(shouldRetry(error)).toBe(true)
    expect(error.message).not.toMatch(/sql|password|stack/i)
  })
})
