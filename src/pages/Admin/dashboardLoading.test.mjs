import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'

const savedFetch = globalThis.fetch
const storage = new Map([
  ['pharmacyAdminToken', 'test-admin-jwt'],
  ['pharmacyAdminUser', JSON.stringify({ id: 1, email: 'admin@pms.com', isPharmacyAssigned: true, pharmacyId: 1 })],
  ['pharmacyAdminAssignment', JSON.stringify({ isPharmacyAssigned: true, pharmacyId: 1, branchId: 1, pharmacyName: 'Main' })],
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
  getPharmacyAdminDashboard,
  getPharmacyPayments,
  getInventory,
  listMedicines,
  listBills,
  listPharmacyBranches,
  getDailySalesReport,
} = await server.ssrLoadModule('/src/config/api.js')

test('[Dashboard Loading] API helpers accept options including timeout and signal', async () => {
  const intercepted = []
  globalThis.fetch = async (url, options) => {
    intercepted.push({ url: String(url), options })
    return new Response(JSON.stringify({ data: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }

  const controller = new AbortController()
  await getPharmacyAdminDashboard({ range: 'today' }, { signal: controller.signal, timeout: 15000 })
  assert.equal(intercepted.at(-1).options.signal.aborted, false)
  assert.match(intercepted.at(-1).url, /pharmacy\/dashboard\?range=today/)

  await getPharmacyPayments({ page: 1 }, { signal: controller.signal, timeout: 15000 })
  assert.match(intercepted.at(-1).url, /pharmacy\/payments\?page=1/)

  await getInventory({ page: 1 }, { signal: controller.signal, timeout: 15000 })
  assert.match(intercepted.at(-1).url, /inventory\?page=1/)

  await listMedicines({}, { signal: controller.signal, timeout: 15000 })
  assert.match(intercepted.at(-1).url, /medicine/)
})

test('[Dashboard Loading] Envelope array unwrapping extracts bills, payments, and branches', async () => {
  // Simulate helper function used in AdminDashboard
  const unwrapArray = (response) => {
    if (Array.isArray(response)) return response
    if (!response || typeof response !== 'object') return []
    const data = response?.data ?? response?.Data ?? response
    if (Array.isArray(data)) return data
    const candidateKeys = [
      'bills', 'Bills',
      'payments', 'Payments',
      'branches', 'Branches',
      'medicines', 'Medicines',
      'inventory', 'Inventory',
      'items', 'Items',
      'results', 'Results',
      'records', 'Records',
      'prescriptions', 'Prescriptions',
      'sales', 'Sales',
      'data', 'Data',
    ]
    for (const k of candidateKeys) {
      if (Array.isArray(data?.[k])) return data[k]
      if (Array.isArray(response?.[k])) return response[k]
    }
    return []
  }

  const billsEnvelope = { success: true, data: { bills: [{ id: 101, total: 500 }] } }
  assert.equal(unwrapArray(billsEnvelope).length, 1)
  assert.equal(unwrapArray(billsEnvelope)[0].id, 101)

  const directBills = { bills: [{ id: 102, total: 300 }] }
  assert.equal(unwrapArray(directBills).length, 1)

  const paymentsEnvelope = { payments: [{ id: 201, amount: 250 }] }
  assert.equal(unwrapArray(paymentsEnvelope).length, 1)
  assert.equal(unwrapArray(paymentsEnvelope)[0].amount, 250)

  const branchesEnvelope = { success: true, branches: [{ id: 301, branchName: 'East Branch' }] }
  assert.equal(unwrapArray(branchesEnvelope).length, 1)
  assert.equal(unwrapArray(branchesEnvelope)[0].branchName, 'East Branch')
})
