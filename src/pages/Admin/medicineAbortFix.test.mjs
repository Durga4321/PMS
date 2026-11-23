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

const { isAbortError, listMedicines } = await server.ssrLoadModule('/src/config/api.js')

test('[isAbortError] Identifies all cancellation error variants and distinguishes genuine errors', () => {
  assert.equal(isAbortError(new DOMException('signal is aborted without reason', 'AbortError')), true)
  assert.equal(isAbortError({ name: 'AbortError', message: 'The user aborted a request.' }), true)
  assert.equal(isAbortError({ name: 'CanceledError', code: 'ERR_CANCELED' }), true)
  assert.equal(isAbortError({ message: 'Request was cancelled' }), true)
  assert.equal(isAbortError(new Error('signal is aborted without reason')), true)

  // Genuine errors must NOT be classified as abort errors
  assert.equal(isAbortError(new Error('Internal Server Error')), false)
  assert.equal(isAbortError({ status: 500, message: 'Server error' }), false)
  assert.equal(isAbortError({ status: 401, message: 'Unauthorized' }), false)
  assert.equal(isAbortError(new TypeError('Failed to fetch')), false)
  assert.equal(isAbortError(null), false)
})

test('[listMedicines] When request is aborted, rethrows AbortError and does NOT log or use local dummy fallback', async () => {
  const warnings = []
  const originalWarn = console.warn
  console.warn = (...args) => warnings.push(args.join(' '))

  try {
    const controller = new AbortController()
    controller.abort('intentional test abort')

    globalThis.fetch = async () => {
      throw new DOMException('signal is aborted without reason', 'AbortError')
    }

    await assert.rejects(
      async () => {
        await listMedicines({}, { signal: controller.signal })
      },
      (err) => isAbortError(err)
    )

    // Verify no warnings were logged claiming backend failed or local medicines were used
    assert.equal(
      warnings.some((w) => w.includes('Backend listMedicines failed, using local medicines')),
      false,
      'Must NOT log backend failure warning on intentional abort'
    )
  } finally {
    console.warn = originalWarn
  }
})

test('[listMedicines] When backend succeeds, returns actual backend medicine records', async () => {
  const backendMeds = [
    { id: 101, name: 'Amoxicillin 500mg', category: 'Antibiotic', stockQuantity: 150 },
    { id: 102, name: 'Paracetamol 650mg', category: 'Analgesic', stockQuantity: 300 },
  ]

  globalThis.fetch = async () => {
    return new Response(JSON.stringify({ success: true, data: { medicines: backendMeds } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const result = await listMedicines({}, {})
  assert.ok(Array.isArray(result))
  assert.ok(result.some((m) => m.name === 'Amoxicillin 500mg'))
  assert.ok(result.some((m) => m.name === 'Paracetamol 650mg'))
})

test('[listMedicines] When backend genuinely fails with throwOnError, throws genuine error instead of silent fake data', async () => {
  globalThis.fetch = async () => {
    return new Response(JSON.stringify({ message: 'Database connection failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  await assert.rejects(
    async () => {
      await listMedicines({}, { throwOnError: true })
    },
    (err) => err.status === 500 || /database connection failed|unable to retrieve/i.test(err.message)
  )
})
