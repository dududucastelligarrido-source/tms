import { getToken, getRefreshToken, setTokens, clearTokens } from './auth.js'

const BASE = `${import.meta.env.VITE_API_URL ?? ''}/api/v1`
const STORAGE_KEY = 'tms_offline_queue'
const FAILED_KEY = 'tms_offline_failed'

export interface QueuedMutation {
  id: string
  method: 'POST' | 'PATCH' | 'DELETE'
  path: string
  body?: unknown
  label: string
  queuedAt: number
}

export interface FailedMutation extends QueuedMutation {
  failedAt: number
  status: number
  error: string
}

type Listener = () => void
const listeners = new Set<Listener>()

function notify() {
  listeners.forEach(l => l())
  window.dispatchEvent(new CustomEvent('offline-queue-changed'))
}

export function subscribeQueue(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getQueue(): QueuedMutation[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

function setQueue(queue: QueuedMutation[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue))
  notify()
}

export function getPendingCount(): number {
  return getQueue().length
}

export function getFailed(): FailedMutation[] {
  try {
    return JSON.parse(localStorage.getItem(FAILED_KEY) ?? '[]')
  } catch {
    return []
  }
}

export function getFailedCount(): number {
  return getFailed().length
}

export function clearFailed() {
  localStorage.removeItem(FAILED_KEY)
  notify()
}

function recordFailure(item: QueuedMutation, status: number, error: string) {
  const failed = getFailed()
  failed.push({ ...item, failedAt: Date.now(), status, error })
  localStorage.setItem(FAILED_KEY, JSON.stringify(failed))
}

// Generates a stable idempotency key — reused for the online attempt and any
// later replays of the same mutation, so the server can dedupe retries.
export function newIdempotencyKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function enqueue(mutation: Omit<QueuedMutation, 'id' | 'queuedAt'> & { id?: string }): QueuedMutation {
  const item: QueuedMutation = {
    ...mutation,
    id: mutation.id ?? newIdempotencyKey(),
    queuedAt: Date.now(),
  }
  setQueue([...getQueue(), item])
  return item
}

async function refreshToken(): Promise<string | null> {
  const rt = getRefreshToken()
  if (!rt) return null
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt }),
    })
    if (!res.ok) return null
    const { token } = await res.json()
    setTokens(token, rt)
    return token as string
  } catch {
    return null
  }
}

type SendResult = 'sent' | 'failed' // 'failed' = permanently rejected (4xx), moved to the failed list

async function sendOne(item: QueuedMutation): Promise<SendResult> {
  const token = getToken()
  const doFetch = (authToken: string | null) => fetch(`${BASE}${item.path}`, {
    method: item.method,
    headers: {
      'Content-Type': 'application/json',
      // Stable key lets the server dedupe a mutation that committed but whose
      // response was lost, so a replay never creates a duplicate record.
      'Idempotency-Key': item.id,
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: item.body != null ? JSON.stringify(item.body) : undefined,
  })

  let res = await doFetch(token)
  if (res.status === 401) {
    const newToken = await refreshToken()
    if (!newToken) { clearTokens(); throw new Error('auth') }
    res = await doFetch(newToken)
  }
  // 2xx → success; 4xx (except 401) → permanent rejection, surface to user; 5xx → keep for retry
  if (res.ok) return 'sent'
  if (res.status >= 400 && res.status < 500) {
    const msg = await res.json().then(b => b?.error).catch(() => null)
    recordFailure(item, res.status, typeof msg === 'string' ? msg : `HTTP ${res.status}`)
    return 'failed'
  }
  throw new Error(`HTTP ${res.status}`)
}

let flushing = false

/**
 * Replays queued mutations in order. Stops on the first network/server failure
 * (keeps the remaining items for the next attempt). Safe to call repeatedly.
 * Returns the number of mutations successfully drained.
 */
export async function flushQueue(): Promise<number> {
  if (flushing || !navigator.onLine) return 0
  flushing = true
  let drained = 0
  let failed = 0
  try {
    let queue = getQueue()
    while (queue.length > 0) {
      const item = queue[0]
      try {
        const result = await sendOne(item)
        if (result === 'failed') failed++
        else drained++
      } catch (err: any) {
        if (err?.message === 'auth') { flushing = false; return drained }
        break // network/5xx — stop and retry later
      }
      queue = getQueue().filter(q => q.id !== item.id)
      setQueue(queue)
    }
    if (drained > 0) window.dispatchEvent(new CustomEvent('offline-queue-flushed', { detail: { drained } }))
    if (failed > 0) window.dispatchEvent(new CustomEvent('offline-queue-failed', { detail: { failed } }))
    return drained
  } finally {
    flushing = false
  }
}

// Auto-flush when connectivity returns.
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { flushQueue() })
}
