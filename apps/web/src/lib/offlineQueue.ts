import { getToken, getRefreshToken, setTokens, clearTokens } from './auth.js'

const BASE = `${import.meta.env.VITE_API_URL ?? ''}/api/v1`
const STORAGE_KEY = 'tms_offline_queue'

export interface QueuedMutation {
  id: string
  method: 'POST' | 'PATCH' | 'DELETE'
  path: string
  body?: unknown
  label: string
  queuedAt: number
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

export function enqueue(mutation: Omit<QueuedMutation, 'id' | 'queuedAt'>): QueuedMutation {
  const item: QueuedMutation = {
    ...mutation,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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

async function sendOne(item: QueuedMutation): Promise<boolean> {
  const token = getToken()
  const doFetch = (authToken: string | null) => fetch(`${BASE}${item.path}`, {
    method: item.method,
    headers: {
      'Content-Type': 'application/json',
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
  // 2xx → success; 4xx (except 401) → drop the item (it would never succeed); 5xx → keep for retry
  if (res.ok) return true
  if (res.status >= 400 && res.status < 500) return true // drop bad requests so the queue doesn't stall
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
  try {
    let queue = getQueue()
    while (queue.length > 0) {
      const item = queue[0]
      try {
        await sendOne(item)
      } catch (err: any) {
        if (err?.message === 'auth') { flushing = false; return drained }
        break // network/5xx — stop and retry later
      }
      queue = getQueue().filter(q => q.id !== item.id)
      setQueue(queue)
      drained++
    }
    if (drained > 0) window.dispatchEvent(new CustomEvent('offline-queue-flushed', { detail: { drained } }))
    return drained
  } finally {
    flushing = false
  }
}

// Auto-flush when connectivity returns.
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { flushQueue() })
}
