const TOKEN_KEY = 'tms_token'
const REFRESH_KEY = 'tms_refresh'

export function getToken(): string | null { return localStorage.getItem(TOKEN_KEY) }
export function getRefreshToken(): string | null { return localStorage.getItem(REFRESH_KEY) }
export function setTokens(token: string, refreshToken: string) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(REFRESH_KEY, refreshToken)
}
export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_KEY)
}

function decodePayload(token: string): Record<string, unknown> | null {
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(b64))
  } catch { return null }
}

export function getUser(): { id: string; name: string; role: string; tenantId: string } | null {
  const token = getToken()
  if (!token) return null
  const payload = decodePayload(token)
  if (!payload) return null
  return {
    id: payload.sub as string,
    name: (payload.name as string) ?? '',
    role: payload.role as string,
    tenantId: payload.tenantId as string,
  }
}

/** true se o access token existe mas já expirou (sem considerar o refresh). */
export function isAccessTokenExpired(): boolean {
  const token = getToken()
  if (!token) return false
  const payload = decodePayload(token)
  if (!payload?.exp) return false
  return Date.now() / 1000 > (payload.exp as number)
}

/** true se há qualquer credencial persistida (access ou refresh). */
export function hasCredentials(): boolean {
  return !!(getToken() || getRefreshToken())
}
