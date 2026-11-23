import { useEffect, useState } from 'react'
import { authTokenFor, notificationApis, normalizeRole, getSignedInRole } from '../config/api'
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
  const target = normalizeRole(role)
  const store = stores[target]
  if (!store || !listeners[target]) return
  for (const callback of listeners[target]) {
    try {
      callback(store.count)
    } catch (err) {
      console.error('Error notifying notification listener', err)
    }
  }
}

export function getNotificationCount(role) {
  const target = normalizeRole(role) || getSignedInRole()
  return (target && stores[target]?.count) || 0
}

export function setNotificationCount(role, count) {
  const target = normalizeRole(role) || getSignedInRole()
  const store = target && stores[target]
  if (!store) return
  const safe = Number.isFinite(Number(count)) ? Math.max(0, Math.floor(Number(count))) : 0
  if (store.count !== safe) {
    store.count = safe
    notify(target)
  }
}

export function clearNotificationCount(role) {
  const target = normalizeRole(role)
  if (target && stores[target]) {
    stores[target].count = 0
    stores[target].lastFetched = 0
    stores[target].inFlight = null
    stores[target].token = null
    notify(target)
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
  const targetRole = normalizeRole(role) || getSignedInRole()
  if (!targetRole) return 0
  const store = stores[targetRole]
  if (!store || !notificationApis[targetRole]) return 0

  // 1. Check Authentication: wait until authentication is available before fetching
  const token = authTokenFor('', targetRole)
  if (!token) {
    if (store.count !== 0 || store.token !== null) {
      store.count = 0
      store.lastFetched = 0
      store.token = null
      notify(targetRole)
    }
    return 0
  }

  // 2. Active Session Match: ensure role request matches active signed-in session
  const activeRole = getSignedInRole()
  if (activeRole && activeRole !== targetRole) {
    if (store.count !== 0) {
      store.count = 0
      store.lastFetched = 0
      store.token = null
      notify(targetRole)
    }
    return 0
  }

  // 3. Invalidate store if token changed (switched account / re-login)
  if (store.token && store.token !== token) {
    store.count = 0
    store.lastFetched = 0
  }
  store.token = token

  // 4. Return cached count if within TTL and not forced
  const now = Date.now()
  if (!force && store.lastFetched > 0 && now - store.lastFetched < CACHE_TTL_MS) {
    return store.count
  }

  // 5. Deduplicate: if already in flight, reuse the exact active Promise
  if (store.inFlight) {
    return store.inFlight
  }

  // 6. Fire single deduplicated request via authenticated API client
  const capturedToken = token
  const requestPromise = (async () => {
    try {
      const response = await notificationApis[targetRole].unreadCount(signal ? { signal } : {})

      // If token changed while request was in-flight, discard stale result
      if (authTokenFor('', targetRole) !== capturedToken) {
        return store.count
      }

      const body = notificationBody(response)
      // For superAdmin read counts.unread; for pharmacyAdmin/pharmacist read unreadCount
      const rawCount = targetRole === 'superAdmin'
        ? (body?.counts?.unread ?? body?.counts?.Unread ?? response?.counts?.unread ?? response?.counts?.Unread ?? body?.unreadCount ?? response?.unreadCount ?? body?.total ?? response?.total ?? 0)
        : (body?.unreadCount ?? body?.data?.unreadCount ?? body?.count ?? response?.unreadCount ?? 0)
      const count = Number.isFinite(Number(rawCount)) ? Math.max(0, Math.floor(Number(rawCount))) : 0

      store.count = count
      store.lastFetched = Date.now()
      notify(targetRole)
      return count
    } catch (err) {
      // Treat intentional cancellations as normal lifecycle events
      if (err?.name === 'AbortError' || err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') {
        return store.count
      }
      if (/active pharmacy assignment required/i.test(err?.message || '')) {
        console.warn(`[PMS Account Setup] Pharmacy Admin notification access: ${err.message}`)
      } else {
        console.warn(`Unable to load notification count for role (${targetRole}):`, err?.message || err)
      }
      return store.count
    } finally {
      store.inFlight = null
    }
  })()

  store.inFlight = requestPromise
  return requestPromise
}

export function subscribeNotificationCount(role, callback) {
  const target = normalizeRole(role)
  if (!target || !listeners[target]) return () => {}
  listeners[target].add(callback)
  return () => {
    listeners[target]?.delete(callback)
  }
}

export function useNotificationCount(role) {
  const targetRole = normalizeRole(role) || getActiveAuthRole()
  const [count, setCount] = useState(() => getNotificationCount(targetRole))

  useEffect(() => {
    const activeTarget = normalizeRole(role) || getActiveAuthRole()
    if (!activeTarget) {
      setCount(0)
      return
    }

    setCount(getNotificationCount(activeTarget))

    const unsubscribe = subscribeNotificationCount(activeTarget, (nextCount) => {
      setCount(nextCount)
    })

    // Wait until authentication is available before fetching
    const token = authTokenFor('', activeTarget)
    if (token) {
      fetchNotificationCount(activeTarget)
    } else {
      setCount(0)
    }

    // Stop polling and clean up when role/session changes or component unmounts
    let pollTimer = null
    if (typeof window !== 'undefined') {
      pollTimer = window.setInterval(() => {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
        const currentActive = normalizeRole(role) || getActiveAuthRole()
        if (currentActive && authTokenFor('', currentActive)) {
          fetchNotificationCount(currentActive)
        }
      }, 60000)
    }

    return () => {
      unsubscribe()
      if (pollTimer) window.clearInterval(pollTimer)
    }
  }, [role])

  return count
}

// Global browser listeners (run once in browser environment)
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  // Listen for custom notifications updated event
  window.addEventListener('pms:notifications-updated', (event) => {
    const rawRole = event.detail?.role
    const unread = event.detail?.unreadCount
    const role = normalizeRole(rawRole) || getActiveAuthRole()
    if (role && stores[role]) {
      if (typeof unread === 'number' && Number.isFinite(unread)) {
        setNotificationCount(role, unread)
      } else {
        fetchNotificationCount(role, { force: true })
      }
    }
  })

  // Listen for logout / auth changes
  const handleAuthReset = () => {
    clearNotificationCount()
  }

  window.addEventListener('pms:auth-logout', handleAuthReset)
  window.addEventListener('pms:auth-login', () => {
    const activeRole = getActiveAuthRole()
    for (const r of ['pharmacyAdmin', 'pharmacist', 'superAdmin']) {
      if (r !== activeRole) {
        clearNotificationCount(r)
      }
    }
    if (activeRole) {
      fetchNotificationCount(activeRole, { force: true })
    }
  })
  window.addEventListener('storage', (e) => {
    if (!e || (e.key && /token|auth|user/i.test(e.key))) {
      const activeRole = getActiveAuthRole()
      for (const r of ['pharmacyAdmin', 'pharmacist', 'superAdmin']) {
        if (!authTokenFor('', r) || (activeRole && r !== activeRole)) {
          clearNotificationCount(r)
        }
      }
      if (activeRole) {
        fetchNotificationCount(activeRole)
      }
    }
  })

  // Subtle revalidation when window regains focus or tab becomes visible
  const handleVisibility = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
    const activeRole = getActiveAuthRole()
    if (activeRole) {
      const store = stores[activeRole]
      if (store && authTokenFor('', activeRole) && Date.now() - store.lastFetched >= CACHE_TTL_MS) {
        fetchNotificationCount(activeRole)
      }
    }
  }

  window.addEventListener('focus', handleVisibility)
  if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('visibilitychange', handleVisibility)
  }
}

