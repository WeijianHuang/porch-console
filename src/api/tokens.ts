/**
 * FQ-03: access token lives in memory only; refresh token in sessionStorage.
 * Neither is persisted to localStorage or put into a URL.
 */
const REFRESH_KEY = 'porch-console:refresh-token'

let accessToken: string | null = null
let refreshToken: string | null = null

export function getAccessToken(): string | null {
  return accessToken
}

export function setAccessToken(token: string | null): void {
  accessToken = token
}

export function getRefreshToken(): string | null {
  if (refreshToken) return refreshToken
  try {
    refreshToken = sessionStorage.getItem(REFRESH_KEY)
  } catch {
    refreshToken = null
  }
  return refreshToken
}

export function setRefreshToken(token: string | null): void {
  refreshToken = token
  try {
    if (token) sessionStorage.setItem(REFRESH_KEY, token)
    else sessionStorage.removeItem(REFRESH_KEY)
  } catch {
    // sessionStorage disabled: memory-only session still works until reload.
  }
}

export function clearTokens(): void {
  accessToken = null
  refreshToken = null
  try {
    sessionStorage.removeItem(REFRESH_KEY)
  } catch {
    // ignored
  }
}
