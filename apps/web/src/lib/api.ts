import { getToken, getRefreshToken, setTokens, clearTokens } from './auth.js'
import { enqueue } from './offlineQueue.js'

export interface QueuedResult { queued: true }
export function isQueued(r: unknown): r is QueuedResult {
  return !!r && typeof r === 'object' && (r as any).queued === true
}

const BASE = `${import.meta.env.VITE_API_URL ?? ''}/api/v1`

let refreshPromise: Promise<string | null> | null = null

async function tryRefresh(): Promise<string | null> {
  if (refreshPromise) return refreshPromise
  refreshPromise = (async () => {
    const refreshToken = getRefreshToken()
    if (!refreshToken) return null
    try {
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      })
      if (!res.ok) return null
      const { token } = await res.json()
      setTokens(token, refreshToken)
      return token as string
    } catch {
      return null
    } finally {
      refreshPromise = null
    }
  })()
  return refreshPromise
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  }

  const res = await fetch(`${BASE}${path}`, { ...options, headers })

  if (res.status === 401 && path !== '/auth/login' && path !== '/auth/refresh') {
    const newToken = await tryRefresh()
    if (!newToken) {
      clearTokens()
      window.location.href = '/login'
      throw new Error('Unauthorized')
    }
    const retryHeaders: HeadersInit = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${newToken}`,
      ...options.headers,
    }
    const retry = await fetch(`${BASE}${path}`, { ...options, headers: retryHeaders })
    if (!retry.ok) {
      if (retry.status === 401) {
        clearTokens()
        window.location.href = '/login'
        throw new Error('Unauthorized')
      }
      const error = await retry.json().catch(() => ({ error: 'Unknown error' }))
      const msg = Array.isArray(error.error)
        ? error.error.map((e: any) => e.message ?? JSON.stringify(e)).join(', ')
        : error.error ?? `HTTP ${retry.status}`
      throw new Error(msg)
    }
    if (retry.status === 204) return undefined as T
    return retry.json()
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unknown error' }))
    const msg = Array.isArray(error.error)
      ? error.error.map((e: any) => e.message ?? JSON.stringify(e)).join(', ')
      : error.error ?? `HTTP ${res.status}`
    throw new Error(msg)
  }

  if (res.status === 204) return undefined as T
  return res.json()
}

// Mutations that are safe to defer when offline (fire-and-forget field actions).
// If offline, the request is queued and replayed on reconnect; returns { queued: true }.
// If online, behaves like a normal request but falls back to the queue on network failure.
async function requestQueued<T>(method: 'POST' | 'PATCH' | 'DELETE', path: string, body: unknown, label: string): Promise<T | QueuedResult> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    enqueue({ method, path, body, label })
    return { queued: true }
  }
  try {
    return await request<T>(path, { method, body: body != null ? JSON.stringify(body) : undefined })
  } catch (err: any) {
    // Network failure (server unreachable) → defer. Re-throw real HTTP/validation errors.
    if (err instanceof TypeError || err?.message === 'Failed to fetch') {
      enqueue({ method, path, body, label })
      return { queued: true }
    }
    throw err
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  postQueued: <T>(path: string, body: unknown, label: string) => requestQueued<T>('POST', path, body, label),
  patchQueued: <T>(path: string, body: unknown, label: string) => requestQueued<T>('PATCH', path, body, label),
}
