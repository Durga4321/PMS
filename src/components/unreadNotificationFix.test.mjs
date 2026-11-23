import assert from 'node:assert/strict'
import { after, beforeEach, test } from 'node:test'
import { createServer } from 'vite'

const savedFetch = globalThis.fetch
const storage = new Map()

globalThis.localStorage = globalThis.sessionStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
  clear: () => storage.clear(),
}

globalThis.window = new EventTarget()
globalThis.window.location = { pathname: '/super-admin/dashboard' }
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
} = await server.ssrLoadModule('/src/services/notificationManager.js')

const {
  authTokenFor,
  notificationApis,
} = await server.ssrLoadModule('/src/config/api.js')

test('PharmacySuperAdmin calls /api/pharmacy-super-admin/notifications?status=unread&page=1&pageSize=1 and reads counts.unread', async () => {
  storage.clear()
  storage.set('superAdminToken', 'super-jwt-token')
  window.location.pathname = '/super-admin/dashboard'
  clearNotificationCount()

  const capturedUrls = []
  globalThis.fetch = async (url, options = {}) => {
    capturedUrls.push({ url: String(url), headers: options.headers })
    return new Response(
      JSON.stringify({
        data: {
          items: [{ id: 1, title: 'Super Admin Notice' }],
          counts: { unread: 5 },
          total: 5,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const count = await fetchNotificationCount('superAdmin', { force: true })
  assert.equal(count, 5, 'Must read counts.unread from the response for Super Admin')
  assert.equal(capturedUrls.length, 1)
  assert.equal(capturedUrls[0].url, '/api/pharmacy-super-admin/notifications?status=unread&page=1&pageSize=1')
  assert.equal(capturedUrls[0].headers.Authorization, 'Bearer super-jwt-token')
  assert.ok(!capturedUrls.some((c) => c.url.includes('notifications/unread-count')), 'Super Admin must never call notifications/unread-count')
})

test('PharmacyAdmin calls /api/notifications/unread-count and reads unreadCount', async () => {
  storage.clear()
  storage.set('pharmacyAdminToken', 'admin-jwt-token')
  storage.set('workingPharmacyId', '11')
  storage.set('pharmacyAdminAssignment', JSON.stringify({ pharmacyId: '11', isPharmacyAssigned: true }))
  window.location.pathname = '/admin/dashboard'
  clearNotificationCount()

  const capturedUrls = []
  globalThis.fetch = async (url, options = {}) => {
    capturedUrls.push({ url: String(url), headers: options.headers })
    return new Response(
      JSON.stringify({
        data: {
          unreadCount: 3,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const count = await fetchNotificationCount('pharmacyAdmin', { force: true })
  assert.equal(count, 3, 'Must read unreadCount for Pharmacy Admin')
  assert.equal(capturedUrls.length, 1)
  assert.equal(capturedUrls[0].url, '/api/notifications/unread-count')
  assert.equal(capturedUrls[0].headers.Authorization, 'Bearer admin-jwt-token')
  assert.equal(capturedUrls[0].headers['X-Pharmacy-Id'], '11')
})

test('Pharmacist calls /api/notifications/unread-count and reads unreadCount', async () => {
  storage.clear()
  storage.set('pharmacistToken', 'pharmacist-jwt-token')
  storage.set('workingPharmacyId', '11')
  storage.set('workingBranchId', '22')
  window.location.pathname = '/pharmacist/dashboard'
  clearNotificationCount()

  const capturedUrls = []
  globalThis.fetch = async (url, options = {}) => {
    capturedUrls.push({ url: String(url), headers: options.headers })
    return new Response(
      JSON.stringify({
        unreadCount: 4,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const count = await fetchNotificationCount('pharmacist', { force: true })
  assert.equal(count, 4, 'Must read unreadCount for Pharmacist')
  assert.equal(capturedUrls.length, 1)
  assert.equal(capturedUrls[0].url, '/api/notifications/unread-count')
  assert.equal(capturedUrls[0].headers.Authorization, 'Bearer pharmacist-jwt-token')
})

test('When unauthenticated, does not fetch and returns 0', async () => {
  storage.clear()
  clearNotificationCount()

  let fetchCalled = false
  globalThis.fetch = async () => {
    fetchCalled = true
    return new Response('{}', { status: 200 })
  }

  const count = await fetchNotificationCount('superAdmin', { force: true })
  assert.equal(count, 0)
  assert.equal(fetchCalled, false, 'Must not make fetch call when unauthenticated')
})

test('Switching roles clears previous badge counts and does not carry over count', async () => {
  // Step 1: Logged in as Super Admin
  storage.clear()
  storage.set('superAdminToken', 'super-jwt-token')
  window.location.pathname = '/super-admin/dashboard'
  setNotificationCount('superAdmin', 8)
  assert.equal(getNotificationCount('superAdmin'), 8)

  // Step 2: Switch to Pharmacy Admin (session reset)
  storage.clear()
  storage.set('pharmacyAdminToken', 'admin-jwt-token')
  window.location.pathname = '/admin/dashboard'
  clearNotificationCount()

  assert.equal(getNotificationCount('superAdmin'), 0, 'Super admin count must be cleared')
  assert.equal(getNotificationCount('pharmacyAdmin'), 0, 'Admin count starts at 0 before fetch')

  // Step 3: Fetch new role
  globalThis.fetch = async (url) => {
    assert.equal(url, '/api/notifications/unread-count')
    return new Response(JSON.stringify({ data: { unreadCount: 2 } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }

  const count = await fetchNotificationCount('pharmacyAdmin', { force: true })
  assert.equal(count, 2)
  assert.equal(getNotificationCount('superAdmin'), 0, 'Super admin count remains 0')
  assert.equal(getNotificationCount('pharmacyAdmin'), 2)
})

test('Pharmacy Admin 403 Active pharmacy assignment required is handled as account setup issue', async () => {
  storage.clear()
  storage.set('pharmacyAdminToken', 'admin-jwt-token')
  window.location.pathname = '/admin/dashboard'
  clearNotificationCount()

  globalThis.fetch = async () => {
    return new Response(
      JSON.stringify({
        message: 'Active pharmacy assignment required.',
      }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // fetchNotificationCount should catch the error and log warning without crashing or carrying count
  const count = await fetchNotificationCount('pharmacyAdmin', { force: true })
  assert.equal(count, 0)
})
