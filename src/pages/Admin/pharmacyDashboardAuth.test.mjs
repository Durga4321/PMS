import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'

const savedFetch = globalThis.fetch
const storage = new Map([
  ['pharmacyAdminToken', 'test-pharmacy-admin-jwt'],
  ['pharmacyAdminUser', JSON.stringify({ id: 10, email: 'admin@pharmacy.com', name: 'Pharmacy Admin', isPharmacyAssigned: true })],
  ['pharmacyAdminAssignment', JSON.stringify({ isPharmacyAssigned: true, pharmacyId: 1, branchId: 2, pharmacyName: 'City Pharmacy' })],
])

globalThis.localStorage = globalThis.sessionStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
}
globalThis.document = { documentElement: { lang: 'en' }, visibilityState: 'visible' }
globalThis.window = new EventTarget()
window.location = { pathname: '/admin/dashboard' }

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
  authTokenFor,
  listBills,
  getDailySalesReport,
  listMedicines,
  getInventory,
  getPharmacyPayments,
  getPharmacyAdminDashboard,
  listPharmacyBranches,
  pharmacyTenantContext,
} = await server.ssrLoadModule('/src/config/api.js')

test('[Auth] authTokenFor resolves pharmacyAdminToken on /admin/dashboard even for pharmacy/bills', () => {
  const token = authTokenFor('pharmacy/bills')
  assert.equal(token, 'test-pharmacy-admin-jwt')
  const tokenWithRole = authTokenFor('pharmacy/bills', 'pharmacist')
  assert.equal(tokenWithRole, 'test-pharmacy-admin-jwt', 'Must fall back to active admin session when pharmacist token is missing')
})

test('[Auth] authTokenFor resolves superAdminToken when logged in as Super Admin', () => {
  storage.delete('pharmacyAdminToken')
  storage.set('superAdminToken', 'test-super-admin-jwt')
  window.location.pathname = '/admin/dashboard'

  const token = authTokenFor('pharmacy/bills', 'pharmacist')
  assert.equal(token, 'test-super-admin-jwt', 'Super Admin session must authorize pharmacy/bills')

  // Restore admin token
  storage.set('pharmacyAdminToken', 'test-pharmacy-admin-jwt')
  storage.delete('superAdminToken')
})

test('[Auth] pharmacyTenantContext resolves Pharmacy Admin context on /admin/dashboard', () => {
  const context = pharmacyTenantContext('pharmacist')
  assert.equal(context.pharmacyId, '1', 'Must resolve admin pharmacyId when on admin route')
  assert.equal(context.branchId, '2', 'Must resolve admin branchId when on admin route')
})

test('[Dashboard APIs] All 7 dashboard endpoints attach Authorization Bearer token for Pharmacy Admin', async () => {
  const capturedRequests = []

  globalThis.fetch = async (url, options = {}) => {
    capturedRequests.push({ url: String(url), options })
    const urlStr = String(url)
    let mockData = {}

    if (urlStr.includes('pharmacy/bills')) {
      mockData = { bills: [{ id: 1, total: 100 }], total: 1 }
    } else if (urlStr.includes('daily-sales')) {
      mockData = { totalSales: 500, date: '2026-11-23' }
    } else if (urlStr.includes('pharmacy/branches')) {
      mockData = { branches: [{ id: 2, branchName: 'Main Branch' }] }
    } else if (urlStr.includes('pharmacy/payments')) {
      mockData = { payments: [{ id: 1, amount: 100 }] }
    } else if (urlStr.includes('pharmacy/dashboard')) {
      mockData = { summary: { totalSales: 1000 } }
    } else if (urlStr.includes('inventory')) {
      mockData = { items: [{ id: 5, stock: 50 }] }
    } else if (urlStr.includes('medicine')) {
      mockData = [{ id: 1, name: 'Paracetamol' }]
    }

    return new Response(JSON.stringify({ data: mockData, success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // 1. /api/pharmacy/bills
  await listBills()
  const billsCall = capturedRequests.at(-1)
  assert.match(billsCall.url, /\/api\/pharmacy\/bills/)
  assert.equal(billsCall.options.headers.Authorization, 'Bearer test-pharmacy-admin-jwt')

  // 2. /api/pharmacy/reports/daily-sales (and aliased daily-sales)
  await getDailySalesReport()
  const dailyCall = capturedRequests.at(-1)
  assert.match(dailyCall.url, /\/api\/pharmacy\/reports\/daily-sales/)
  assert.equal(dailyCall.options.headers.Authorization, 'Bearer test-pharmacy-admin-jwt')

  // 3. /api/pharmacy/branches
  await listPharmacyBranches()
  const branchCall = capturedRequests.find((r) => r.url.includes('pharmacy/branches'))
  assert.ok(branchCall, 'Must call pharmacy/branches')
  assert.equal(branchCall.options.headers.Authorization, 'Bearer test-pharmacy-admin-jwt')

  // 4. /api/pharmacy/payments
  await getPharmacyPayments()
  const payCall = capturedRequests.at(-1)
  assert.match(payCall.url, /\/api\/pharmacy\/payments/)
  assert.equal(payCall.options.headers.Authorization, 'Bearer test-pharmacy-admin-jwt')

  // 5. /api/pharmacy/dashboard
  await getPharmacyAdminDashboard()
  const dashCall = capturedRequests.at(-1)
  assert.match(dashCall.url, /\/api\/pharmacy\/dashboard/)
  assert.equal(dashCall.options.headers.Authorization, 'Bearer test-pharmacy-admin-jwt')

  // 6. /api/inventory
  await getInventory()
  const invCall = capturedRequests.at(-1)
  assert.match(invCall.url, /\/api\/inventory/)
  assert.equal(invCall.options.headers.Authorization, 'Bearer test-pharmacy-admin-jwt')

  // 7. /api/medicine
  await listMedicines()
  const medCall = capturedRequests.at(-1)
  assert.match(medCall.url, /\/api\/medicine/)
  assert.equal(medCall.options.headers.Authorization, 'Bearer test-pharmacy-admin-jwt')
})

test('[Auth] Centralized 401 response handling dispatches event and does not loop', async () => {
  let unauthorizedEvent = null
  const onUnauthorized = (e) => { unauthorizedEvent = e.detail }
  window.addEventListener('pms:auth-unauthorized', onUnauthorized)

  globalThis.fetch = async () => {
    return new Response(JSON.stringify({ success: false, message: 'Authentication token is missing, invalid or expired.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  await assert.rejects(
    async () => { await listBills() },
    (err) => {
      assert.equal(err.status, 401)
      assert.match(err.message, /session has expired|longer valid/i)
      return true
    }
  )

  assert.ok(unauthorizedEvent, 'Must dispatch pms:auth-unauthorized event')
  assert.equal(unauthorizedEvent.status, 401)
  assert.match(unauthorizedEvent.message, /session has expired/i)

  window.removeEventListener('pms:auth-unauthorized', onUnauthorized)
})
