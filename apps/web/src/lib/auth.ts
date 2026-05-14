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

export function getUser(): { id: string; name: string; role: string; tenantId: string } | null {
  const token = getToken()
  if (!token) return null
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(b64))
    return { id: payload.sub, name: payload.name ?? '', role: payload.role, tenantId: payload.tenantId }
  } catch { return null }
}
