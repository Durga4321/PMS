import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'

const savedFetch = globalThis.fetch
const storage = new Map([
  ['superAdminToken', 'test-super-admin-token'],
  ['pharmacyAdminToken', 'test-pharmacy-admin-token'],
])
globalThis.localStorage = globalThis.sessionStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
}
globalThis.document = { documentElement: { lang: 'en' }, visibilityState: 'visible' }
globalThis.window = new EventTarget()
window.location = { pathname: '/super-admin/notifications' }

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
after(async () => {
  await server.close()
  globalThis.fetch = savedFetch
  delete globalThis.window
  delete globalThis.document
  delete globalThis.localStorage
  delete globalThis.sessionStorage
})

const { notificationApis, clearNotificationsInFlight } = await server.ssrLoadModule('/src/config/api.js')
const {
  fetchNotificationCount,
  getNotificationCount,
  setNotificationCount,
  clearNotificationCount,
} = await server.ssrLoadModule('/src/services/notificationManager.js')
const {
  notificationBody,
  notificationList,
  normalizeNotification,
} = await server.ssrLoadModule('/src/components/notificationModel.js')

test('[Notification Lifecycle] Distinguish paginated inbox request from header bell unread request', async () => {
  const capturedRequests = []

  globalThis.fetch = async (url, options = {}) => {
    capturedRequests.push({ url: String(url), options })
    return new Response(
      JSON.stringify({
        data: {
          notifications: [
            { id: 1, title: 'System Notice', message: 'Backup complete', isRead: false, createdAt: '2026-11-20T10:00:00Z' },
          ],
          counts: { unread: 1, inbox: 1 },
          unreadCount: 1,
          total: 1,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // 1. Paginated inbox request (from NotificationCenter on Notifications page)
  const inboxRes = await notificationApis.superAdmin.list({ folder: 'inbox', page: 1, pageSize: 20 })
  assert.equal(capturedRequests.length, 1)
  const inboxUrl = capturedRequests[0].url
  assert.match(inboxUrl, /\/api\/pharmacy-super-admin\/notifications/)
  assert.match(inboxUrl, /folder=inbox/)
  assert.match(inboxUrl, /page=1/)
  assert.match(inboxUrl, /pageSize=20/)
  assert.equal(capturedRequests[0].options.headers.Authorization, 'Bearer test-super-admin-token')

  const items = notificationList(inboxRes).map((item) => normalizeNotification(item, 'inbox'))
  assert.equal(items.length, 1)
  assert.equal(items[0].id, '1')
  assert.equal(items[0].title, 'System Notice')
  assert.equal(items[0].status, 'unread')

  // 2. Unread notification request (from NotificationBell in topbar header)
  const unreadCount = await fetchNotificationCount('superAdmin', { force: true })
  assert.equal(unreadCount, 1)
  assert.equal(capturedRequests.length, 2)
  const bellUrl = capturedRequests[1].url
  assert.match(bellUrl, /\/api\/pharmacy-super-admin\/notifications/)
  assert.match(bellUrl, /status=unread/)
  assert.match(bellUrl, /pageSize=1/)
})

test('[Notification Lifecycle] React StrictMode replay shares in-flight startup fetch (1 network call, 0 canceled)', async () => {
  clearNotificationsInFlight?.()
  let callCount = 0

  globalThis.fetch = async (url, options = {}) => {
    callCount++
    const currentCall = callCount
    return new Promise((resolve) => {
      // Simulate network delay
      setTimeout(() => {
        resolve(
          new Response(
            JSON.stringify({
              data: {
                notifications: [{ id: currentCall, title: `Notice ${currentCall}` }],
                total: 1,
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        )
      }, 50)
    })
  }

  // Mount 1 starts request 1 (initial load, revision = 0)
  const controller1 = new AbortController()
  const req1Promise = notificationApis.superAdmin.list(
    { folder: 'inbox', page: 1, pageSize: 20 },
    { signal: controller1.signal }
  )

  // React StrictMode immediately unmounts Mount 1 to verify cleanup:
  controller1.abort()

  // Mount 1 caller promise rejects with AbortError (handled quietly in frontend, preventing stale state update)
  await assert.rejects(req1Promise, (err) => {
    return err.name === 'AbortError' || err.code === 'ERR_CANCELED'
  })

  // Mount 2 immediately starts request 2 during StrictMode remount:
  const controller2 = new AbortController()
  const req2Promise = notificationApis.superAdmin.list(
    { folder: 'inbox', page: 1, pageSize: 20 },
    { signal: controller2.signal }
  )

  // Both mounts share the SAME in-flight network request!
  const req2Res = await req2Promise
  assert.equal(callCount, 1, 'Exactly one network fetch must be executed across StrictMode replay')

  const incoming = notificationList(req2Res)
  assert.equal(incoming.length, 1)
  assert.equal(incoming[0].id, 1)
  assert.equal(incoming[0].title, 'Notice 1')
})

test('[Notification Lifecycle] User Refresh with force: true initiates fresh network request', async () => {
  clearNotificationsInFlight?.()
  let callCount = 0

  globalThis.fetch = async () => {
    callCount++
    const current = callCount
    return new Response(
      JSON.stringify({
        data: {
          notifications: [{ id: current, title: `Refresh Notice ${current}` }],
          total: 1,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Initial load
  const res1 = await notificationApis.superAdmin.list(
    { folder: 'inbox', page: 1, pageSize: 20 },
    { force: false }
  )
  assert.equal(callCount, 1)
  assert.equal(notificationList(res1)[0].id, 1)

  // Manual Refresh with force: true
  const res2 = await notificationApis.superAdmin.list(
    { folder: 'inbox', page: 1, pageSize: 20 },
    { force: true }
  )
  assert.equal(callCount, 2)
  assert.equal(notificationList(res2)[0].id, 2)
})

test('[Notification Lifecycle] Tab switching generates distinct query parameters without in-flight collision', async () => {
  clearNotificationsInFlight?.()
  const requestedUrls = []

  globalThis.fetch = async (url) => {
    requestedUrls.push(String(url))
    return new Response(
      JSON.stringify({
        data: {
          notifications: [],
          total: 0,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // All / Inbox tab
  await notificationApis.superAdmin.list({ folder: 'inbox', page: 1, pageSize: 20 })
  // Unread tab
  await notificationApis.superAdmin.list({ folder: 'inbox', status: 'unread', page: 1, pageSize: 20 })
  // Read tab
  await notificationApis.superAdmin.list({ folder: 'inbox', status: 'read', page: 1, pageSize: 20 })
  // Sent tab
  await notificationApis.superAdmin.list({ folder: 'sent', page: 1, pageSize: 20 })

  assert.equal(requestedUrls.length, 4)
  assert.match(requestedUrls[0], /folder=inbox/)
  assert.doesNotMatch(requestedUrls[0], /status=/)
  assert.match(requestedUrls[1], /folder=inbox/)
  assert.match(requestedUrls[1], /status=unread/)
  assert.match(requestedUrls[2], /folder=inbox/)
  assert.match(requestedUrls[2], /status=read/)
  assert.match(requestedUrls[3], /folder=sent/)
})

test('[Notification Lifecycle] Pagination preserves fetching and requests page 2 correctly', async () => {
  let capturedPage = null

  globalThis.fetch = async (url) => {
    const parsed = new URL(String(url), 'http://localhost')
    capturedPage = parsed.searchParams.get('page')
    return new Response(
      JSON.stringify({
        data: {
          notifications: [
            { id: 21, title: 'Item on page 2' },
          ],
          total: 25,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const resPage2 = await notificationApis.superAdmin.list({ folder: 'inbox', page: 2, pageSize: 20 })
  assert.equal(capturedPage, '2')
  const incoming = notificationList(resPage2)
  assert.equal(incoming.length, 1)
  assert.equal(incoming[0].id, 21)
})

test('[Notification Lifecycle] Header unread count updates via store and custom event without re-fetching', async () => {
  clearNotificationCount('superAdmin')
  assert.equal(getNotificationCount('superAdmin'), 0)

  // Direct count set
  setNotificationCount('superAdmin', 5)
  assert.equal(getNotificationCount('superAdmin'), 5)

  // Custom event dispatched from NotificationCenter when response contains unreadCount
  window.dispatchEvent(
    new CustomEvent('pms:notifications-updated', {
      detail: { role: 'superAdmin', unreadCount: 3 },
    })
  )

  assert.equal(getNotificationCount('superAdmin'), 3)
})
