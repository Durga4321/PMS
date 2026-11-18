import assert from 'node:assert/strict'
import { test } from 'node:test'
import { pharmacistReturnsApi } from '../../config/api.js'

function isAbortError(err) {
  return (
    err?.name === 'AbortError' ||
    err?.code === 20 ||
    err?.isCanceled === true ||
    /aborted|canceled/i.test(err?.message || '')
  )
}

function classifyError(err, fallback = 'An unexpected error occurred.') {
  if (!err) return null
  if (isAbortError(err)) return { type: 'canceled', isAbort: true, message: '' }
  const status = err.status || err.response?.status
  const rawMsg = String(err.message || '')
  if (status === 401 || /401|unauthorized/i.test(rawMsg)) {
    return { type: '401', status: 401, message: 'Your session has expired. Please log in again to continue.' }
  }
  if (status === 403 || /403|forbidden|access denied/i.test(rawMsg)) {
    return { type: '403', status: 403, message: 'Access denied for this pharmacist account. Verify your permissions and branch assignment.' }
  }
  if (status === 404 || /404|not found/i.test(rawMsg)) {
    return { type: '404', status: 404, message: 'The requested returns service endpoint was not found on the server (404).' }
  }
  if (status === 500 || status === 502 || status === 503 || /500|502|503|internal server error/i.test(rawMsg)) {
    return { type: '500', status: status || 500, message: `Server error (${status || 500}). The backend service encountered an issue. Please retry.` }
  }
  if (/network|failed to fetch|unable to connect/i.test(rawMsg)) {
    return { type: 'network', message: 'Unable to connect to the server. Check your connection and retry.' }
  }
  return { type: 'general', status, message: rawMsg || fallback }
}

function validateBillInBranch(bill, assignedBranchId) {
  const currentBranchId = String(assignedBranchId || '').trim()
  const billBranchId = String(
    bill?.branchId ??
    bill?.BranchId ??
    bill?.branch?.id ??
    bill?.branch?.branchId ??
    (Array.isArray(bill?.items) ? bill.items[0]?.branchId : '') ??
    ''
  ).trim()

  if (currentBranchId && billBranchId && currentBranchId !== billBranchId) {
    return { verified: false, error: 'Bill not found in this branch.' }
  }
  return { verified: true, error: '', patientName: bill?.patientName || bill?.patient?.name || '' }
}

test('classifyError properly categorizes HTTP errors and cancellations', () => {
  // Cancellation
  const abortErr = new Error('The user aborted a request.')
  abortErr.name = 'AbortError'
  const c1 = classifyError(abortErr)
  assert.equal(c1.isAbort, true)
  assert.equal(c1.type, 'canceled')

  // 401
  const err401 = new Error('Unauthorized')
  err401.status = 401
  assert.equal(classifyError(err401).type, '401')
  assert.match(classifyError(err401).message, /session has expired/i)

  // 403
  const err403 = new Error('Forbidden')
  err403.status = 403
  assert.equal(classifyError(err403).type, '403')
  assert.match(classifyError(err403).message, /access denied/i)

  // 404
  const err404 = new Error('Not found')
  err404.status = 404
  assert.equal(classifyError(err404).type, '404')
  assert.match(classifyError(err404).message, /not found/i)

  // 500
  const err500 = new Error('Internal Server Error')
  err500.status = 500
  assert.equal(classifyError(err500).type, '500')
  assert.match(classifyError(err500).message, /server error/i)

  // Network
  const netErr = new Error('Failed to fetch')
  assert.equal(classifyError(netErr).type, 'network')
  assert.match(classifyError(netErr).message, /unable to connect/i)
})

test('validateBillInBranch validates matching branch and rejects mismatched branch', () => {
  // Matching branch
  const bill1 = { id: 101, branchId: 'branch-1', patientName: 'John Doe' }
  const res1 = validateBillInBranch(bill1, 'branch-1')
  assert.equal(res1.verified, true)
  assert.equal(res1.error, '')
  assert.equal(res1.patientName, 'John Doe')

  // Mismatched branch
  const bill2 = { id: 102, branchId: 'branch-2', patientName: 'Jane Smith' }
  const res2 = validateBillInBranch(bill2, 'branch-1')
  assert.equal(res2.verified, false)
  assert.equal(res2.error, 'Bill not found in this branch.')

  // Bill with nested branch object
  const bill3 = { id: 103, branch: { id: 'branch-3' }, patient: { name: 'Alice' } }
  const res3 = validateBillInBranch(bill3, 'branch-3')
  assert.equal(res3.verified, true)
  assert.equal(res3.patientName, 'Alice')
})

test('pharmacistReturnsApi defines required fresh return methods with seamless aliases', () => {
  assert.equal(typeof pharmacistReturnsApi.options, 'function')
  assert.equal(typeof pharmacistReturnsApi.billItems, 'function')
  assert.equal(typeof pharmacistReturnsApi.eligibleMedicines, 'function')
  assert.equal(typeof pharmacistReturnsApi.createPatientReturn, 'function')
  assert.equal(typeof pharmacistReturnsApi.history, 'function')
  assert.equal(typeof pharmacistReturnsApi.historyItem, 'function')
  assert.equal(typeof pharmacistReturnsApi.approveHistoryItem, 'function')
  assert.equal(typeof pharmacistReturnsApi.cancelHistoryItem, 'function')

  // Aliases for Returns.jsx
  assert.equal(typeof pharmacistReturnsApi.list, 'function')
  assert.equal(typeof pharmacistReturnsApi.inventory, 'function')
  assert.equal(typeof pharmacistReturnsApi.batches, 'function')
  assert.equal(typeof pharmacistReturnsApi.create, 'function')
  assert.equal(typeof pharmacistReturnsApi.approve, 'function')
  assert.equal(typeof pharmacistReturnsApi.cancel, 'function')
})

test('eligibleMedicines rejects when billId is missing or non-positive integer', async () => {
  await assert.rejects(
    async () => pharmacistReturnsApi.eligibleMedicines({}),
    /valid numeric Bill ID/
  )
  await assert.rejects(
    async () => pharmacistReturnsApi.eligibleMedicines({ billId: 'abc' }),
    /valid numeric Bill ID/
  )
  await assert.rejects(
    async () => pharmacistReturnsApi.eligibleMedicines({ billId: -5 }),
    /valid numeric Bill ID/
  )
  await assert.rejects(
    async () => pharmacistReturnsApi.eligibleMedicines({ billId: 0 }),
    /valid numeric Bill ID/
  )
})

test('inventory helper does not make network call when billId is missing', async () => {
  const res = await pharmacistReturnsApi.inventory()
  assert.deepEqual(res, [])
})

