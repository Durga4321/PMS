import assert from 'node:assert/strict'
import { after, beforeEach, test } from 'node:test'
import { createServer } from 'vite'

const savedFetch = globalThis.fetch
const storage = new Map([
  ['pharmacyAdminToken', 'test-admin-token'],
  ['pharmacistToken', 'test-pharmacist-token'],
])

globalThis.localStorage = globalThis.sessionStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
}

globalThis.window = new EventTarget()
globalThis.window.location = { pathname: '/admin/dashboard' }
globalThis.document = { visibilityState: 'visible', addEventListener: () => {}, removeEventListener: () => {} }

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })

after(async () => {
  await server.close()
  globalThis.fetch = savedFetch
  delete globalThis.window
  delete globalThis.document
  delete globalThis.localStorage
  delete globalThis.sessionStorage
})

const {
  fetchNotificationCount,
  getNotificationCount,
  setNotificationCount,
  clearNotificationCount,
  subscribeNotificationCount,
} = await server.ssrLoadModule('/src/services/notificationManager.js')

test('returns 0 and does not fetch when user is unauthenticated', async () => {
  clearNotificationCount('pharmacyAdmin')
  storage.delete('pharmacyAdminToken')

  let fetchCalled = false
  globalThis.fetch = async () => {
    fetchCalled = true
    return new Response(JSON.stringify({ data: { unreadCount: 5 } }), { status: 200 })
  }

  const count = await fetchNotificationCount('pharmacyAdmin')
  assert.equal(count, 0)
  assert.equal(fetchCalled, false)
})

test('deduplicates simultaneous in-flight requests into a single network call', async () => {
  storage.set('pharmacyAdminToken', 'test-admin-token')
  clearNotificationCount('pharmacyAdmin')

  let callCount = 0
  globalThis.fetch = async (url) => {
    callCount++
    await new Promise((resolve) => setTimeout(resolve, 20))
    return new Response(JSON.stringify({ data: { unreadCount: 7 } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Fire two requests concurrently (simulating Header Bell and Sidebar mounting together, or StrictMode)
  const [res1, res2] = await Promise.all([
    fetchNotificationCount('pharmacyAdmin', { force: true }),
    fetchNotificationCount('pharmacyAdmin'),
  ])

  assert.equal(res1, 7)
  assert.equal(res2, 7)
  assert.equal(callCount, 1, 'Expected exactly 1 network call due to in-flight deduplication')
  assert.equal(getNotificationCount('pharmacyAdmin'), 7)
})

test('serves subsequent calls from cache within TTL without re-fetching', async () => {
  storage.set('pharmacyAdminToken', 'test-admin-token')
  let callCount = 0
  globalThis.fetch = async () => {
    callCount++
    return new Response(JSON.stringify({ data: { unreadCount: 12 } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const first = await fetchNotificationCount('pharmacyAdmin')
  const second = await fetchNotificationCount('pharmacyAdmin')

  assert.equal(first, 7) // from previous test cached
  assert.equal(second, 7)
  assert.equal(callCount, 0, 'Should not fetch again within TTL')
})

test('updates count directly when pms:notifications-updated provides unreadCount', async () => {
  let notifiedCount = null
  const unsub = subscribeNotificationCount('pharmacyAdmin', (val) => {
    notifiedCount = val
  })

  window.dispatchEvent(
    new CustomEvent('pms:notifications-updated', {
      detail: { role: 'pharmacyAdmin', unreadCount: 3 },
    })
  )

  assert.equal(notifiedCount, 3)
  assert.equal(getNotificationCount('pharmacyAdmin'), 3)
  unsub()
})

test('handles AbortError gracefully as expected lifecycle event without clearing count', async () => {
  storage.set('pharmacyAdminToken', 'test-admin-token')
  setNotificationCount('pharmacyAdmin', 5)

  const controller = new AbortController()
  controller.abort()

  globalThis.fetch = async (url, options) => {
    const error = new Error('The operation was aborted')
    error.name = 'AbortError'
    throw error
  }

  const result = await fetchNotificationCount('pharmacyAdmin', { force: true, signal: controller.signal })
  assert.equal(result, 5, 'Should preserve existing count on AbortError')
})
