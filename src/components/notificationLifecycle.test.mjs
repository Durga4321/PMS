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

const { notificationApis } = await server.ssrLoadModule('/src/config/api.js')
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
  assert.match(bellUrl, /pageSize=100/)
})

test('[Notification Lifecycle] Effect cleanup abort cancels in-flight fetch and remount starts fresh request', async () => {
  let callCount = 0
  const controllers = []

  globalThis.fetch = async (url, options = {}) => {
    callCount++
    const currentCall = callCount
    const signal = options.signal

    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        return reject(new DOMException('The user aborted a request.', 'AbortError'))
      }

      signal?.addEventListener('abort', () => {
        reject(new DOMException('The user aborted a request.', 'AbortError'))
      })

      // Simulate network delay
      setTimeout(() => {
        if (signal?.aborted) {
          reject(new DOMException('The user aborted a request.', 'AbortError'))
        } else {
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
        }
      }, 50)
    })
  }

  // First mount: Starts request 1
  const controller1 = new AbortController()
  controllers.push(controller1)
  const req1Promise = notificationApis.superAdmin.list(
    { folder: 'inbox', page: 1, pageSize: 20 },
    { signal: controller1.signal }
  )

  // User navigates away to System Settings while req1 is in flight:
  // Component unmounts -> cleanup aborts controller1
  controller1.abort()

  // Verify req1 rejects with AbortError (handled quietly in frontend)
  await assert.rejects(req1Promise, (err) => {
    return err.name === 'AbortError' || err.code === 'ERR_CANCELED'
  })

  // Returning to Notifications from System Settings:
  // Component remounts -> creates fresh AbortController and starts req2
  const controller2 = new AbortController()
  controllers.push(controller2)
  assert.equal(controller2.signal.aborted, false, 'New controller must not be aborted')

  const req2Res = await notificationApis.superAdmin.list(
    { folder: 'inbox', page: 1, pageSize: 20 },
    { signal: controller2.signal }
  )

  // Req 2 completes successfully
  const body = notificationBody(req2Res)
  const incoming = notificationList(req2Res)
  assert.equal(incoming.length, 1)
  assert.equal(incoming[0].id, 2)
  assert.equal(incoming[0].title, 'Notice 2')
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
