import { useEffect, useState } from 'react'
import { authTokenFor, notificationApis } from '../config/api'
import { notificationBody } from '../components/notificationModel'

const CACHE_TTL_MS = 20000 // 20 seconds cache TTL

const stores = {
  pharmacyAdmin: { count: 0, lastFetched: 0, inFlight: null, token: null },
  pharmacist: { count: 0, lastFetched: 0, inFlight: null, token: null },
  superAdmin: { count: 0, lastFetched: 0, inFlight: null, token: null },
}

const listeners = {
  pharmacyAdmin: new Set(),
  pharmacist: new Set(),
  superAdmin: new Set(),
}

function notify(role) {
  const store = stores[role]
  if (!store || !listeners[role]) return
  for (const callback of listeners[role]) {
    try {
      callback(store.count)
    } catch (err) {
      console.error('Error notifying notification listener', err)
    }
  }
}

export function getNotificationCount(role) {
  return stores[role]?.count || 0
}

export function setNotificationCount(role, count) {
  const store = stores[role]
  if (!store) return
  const safe = Number.isFinite(Number(count)) ? Math.max(0, Math.floor(Number(count))) : 0
  if (store.count !== safe) {
    store.count = safe
    notify(role)
  }
}

export function clearNotificationCount(role) {
  if (role && stores[role]) {
    stores[role].count = 0
    stores[role].lastFetched = 0
    stores[role].inFlight = null
    stores[role].token = null
    notify(role)
  } else {
    for (const r of ['pharmacyAdmin', 'pharmacist', 'superAdmin']) {
      if (stores[r]) {
        stores[r].count = 0
        stores[r].lastFetched = 0
        stores[r].inFlight = null
        stores[r].token = null
        notify(r)
      }
    }
  }
}

export async function fetchNotificationCount(role, { force = false, signal } = {}) {
  const store = stores[role]
  if (!store || !notificationApis[role]) return 0

  // 1. Check Authentication: only fetch if token is present
  const token = authTokenFor('', role)
  if (!token) {
    if (store.count !== 0 || store.token !== null) {
      store.count = 0
      store.lastFetched = 0
      store.token = null
      notify(role)
    }
    return 0
  }

  // 2. Invalidate store if token changed (switched account / re-login)
  if (store.token && store.token !== token) {
    store.count = 0
    store.lastFetched = 0
  }
  store.token = token

  // 3. Return cached count if within TTL and not forced
  const now = Date.now()
  if (!force && store.lastFetched > 0 && now - store.lastFetched < CACHE_TTL_MS) {
    return store.count
  }

  // 4. Deduplicate: if already in flight, reuse the exact active Promise
  if (store.inFlight) {
    return store.inFlight
  }

  // 5. Fire single deduplicated request
  const capturedToken = token
  const requestPromise = (async () => {
    try {
      const response = await notificationApis[role].unreadCount(signal ? { signal } : {})

      // If token changed while request was in-flight, discard stale result
      if (authTokenFor('', role) !== capturedToken) {
        return store.count
      }

      const body = notificationBody(response)
      const rawCount = body?.unreadCount ?? body?.data?.unreadCount ?? body?.count ?? response?.unreadCount ?? 0
      const count = Number.isFinite(Number(rawCount)) ? Math.max(0, Math.floor(Number(rawCount))) : 0

      store.count = count
      store.lastFetched = Date.now()
      notify(role)
      return count
    } catch (err) {
      // Treat intentional cancellations as normal lifecycle events
      if (err?.name === 'AbortError' || err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') {
        return store.count
      }
      console.warn('Unable to load notification count for role:', role, err?.message || err)
      return store.count
    } finally {
      store.inFlight = null
    }
  })()

  store.inFlight = requestPromise
  return requestPromise
}

export function subscribeNotificationCount(role, callback) {
  if (!listeners[role]) return () => {}
  listeners[role].add(callback)
  return () => {
    listeners[role]?.delete(callback)
  }
}

export function useNotificationCount(role) {
  const [count, setCount] = useState(() => getNotificationCount(role))

  useEffect(() => {
    if (!role) return

    setCount(getNotificationCount(role))

    const unsubscribe = subscribeNotificationCount(role, (nextCount) => {
      setCount(nextCount)
    })

    // Fetch notification count on mount (deduplicated across components, cached by TTL)
    fetchNotificationCount(role)

    return () => {
      unsubscribe()
    }
  }, [role])

  return count
}

// Global browser listeners (run once in browser environment)
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  // Listen for custom notifications updated event
  window.addEventListener('pms:notifications-updated', (event) => {
    const role = event.detail?.role
    const unread = event.detail?.unreadCount
    if (role && stores[role]) {
      if (typeof unread === 'number' && Number.isFinite(unread)) {
        setNotificationCount(role, unread)
      } else {
        fetchNotificationCount(role, { force: true })
      }
    } else {
      for (const r of ['pharmacyAdmin', 'pharmacist', 'superAdmin']) {
        if (authTokenFor('', r)) {
          fetchNotificationCount(r, { force: true })
        }
      }
    }
  })

  // Listen for logout / auth changes
  const handleAuthReset = () => {
    for (const r of ['pharmacyAdmin', 'pharmacist', 'superAdmin']) {
      if (!authTokenFor('', r)) {
        clearNotificationCount(r)
      }
    }
  }

  window.addEventListener('pms:auth-logout', handleAuthReset)
  window.addEventListener('pms:auth-login', () => {
    for (const r of ['pharmacyAdmin', 'pharmacist', 'superAdmin']) {
      if (authTokenFor('', r)) {
        fetchNotificationCount(r, { force: true })
      }
    }
  })
  window.addEventListener('storage', handleAuthReset)

  // Subtle revalidation when window regains focus or tab becomes visible
  const handleVisibility = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
    for (const r of ['pharmacyAdmin', 'pharmacist', 'superAdmin']) {
      const store = stores[r]
      if (store && authTokenFor('', r) && Date.now() - store.lastFetched >= CACHE_TTL_MS) {
        fetchNotificationCount(r)
      }
    }
  }

  window.addEventListener('focus', handleVisibility)
  if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('visibilitychange', handleVisibility)
  }
}
