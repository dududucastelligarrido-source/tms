import { useState, useEffect } from 'react'
import { subscribeQueue, getPendingCount, getFailedCount, flushQueue } from '../lib/offlineQueue.js'

/**
 * Tracks connectivity, the offline mutation queue size, and the count of
 * mutations permanently rejected on replay (4xx). Triggers a flush on mount
 * and whenever the browser comes back online.
 */
export function useOfflineStatus() {
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [pending, setPending] = useState(getPendingCount())
  const [failed, setFailed] = useState(getFailedCount())

  useEffect(() => {
    function onOnline() { setOnline(true); flushQueue() }
    function onOffline() { setOnline(false) }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    const unsub = subscribeQueue(() => {
      setPending(getPendingCount())
      setFailed(getFailedCount())
    })

    // Attempt to drain anything left from a previous session.
    flushQueue()

    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      unsub()
    }
  }, [])

  return { online, pending, failed }
}
