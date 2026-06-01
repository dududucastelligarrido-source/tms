import { useState, useEffect } from 'react'
import { subscribeQueue, getPendingCount, flushQueue } from '../lib/offlineQueue.js'

/**
 * Tracks connectivity and the offline mutation queue size.
 * Triggers a flush on mount and whenever the browser comes back online.
 */
export function useOfflineStatus() {
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [pending, setPending] = useState(getPendingCount())

  useEffect(() => {
    function onOnline() { setOnline(true); flushQueue() }
    function onOffline() { setOnline(false) }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    const unsub = subscribeQueue(() => setPending(getPendingCount()))

    // Attempt to drain anything left from a previous session.
    flushQueue()

    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      unsub()
    }
  }, [])

  return { online, pending }
}
