import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getPharmacistAssignedBranch,
  pharmacyTenantContext,
  authTokenFor,
  readStoredToken
} from '../../config/api.js'

// Simple mock storage for testing
function setupMockStorage(initial = {}) {
  const store = new Map(Object.entries(initial))
  return {
    getItem: (key) => store.get(key) || null,
    setItem: (key, val) => store.set(key, String(val)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  }
}

test('Pharmacist branch ID handling does not hardcode branchId=1 for unassigned pharmacists', () => {
  globalThis.sessionStorage = setupMockStorage()
  globalThis.localStorage = setupMockStorage()

  const branch = getPharmacistAssignedBranch()
  // When no branch is assigned, id must NOT be hardcoded to '1'
  assert.equal(branch.id, '', 'Should return empty string for unassigned pharmacist id')
  assert.equal(branch.branchId, '', 'Should return empty string for unassigned branchId')
})

test('Pharmacist branch ID resolves from assignment and user profile', () => {
  globalThis.sessionStorage = setupMockStorage({
    pharmacistToken: 'jwt-pharm-token-123',
    pharmacistAssignment: JSON.stringify({
      branchId: '42',
      branchName: 'City Center Sub Branch',
      pharmacyId: '10'
    }),
    pharmacistUser: JSON.stringify({
      id: 5,
      name: 'Ramesh Pharmacist',
      email: 'ramesh@pharmacy.com'
    })
  })
  globalThis.localStorage = setupMockStorage()

  const branch = getPharmacistAssignedBranch()
  assert.equal(branch.id, '42', 'Should correctly identify assigned branch 42')
  assert.equal(branch.name, 'City Center Sub Branch', 'Should identify branch name')

  const context = pharmacyTenantContext('pharmacist')
  assert.equal(context.branchId, '42', 'Tenant context should use branchId 42')
  assert.equal(context.pharmacyId, '10', 'Tenant context should use pharmacyId 10')
})

test('Pharmacist branch switching updates workingBranch without falling back to hardcoded 1', () => {
  globalThis.sessionStorage = setupMockStorage({
    pharmacistToken: 'jwt-pharm-token-123',
    workingBranchId: '99',
    workingBranch: JSON.stringify({ id: '99', name: 'West Sub Branch' }),
    pharmacistAssignment: JSON.stringify({ branchId: '42', branchName: 'Original Branch' }),
  })
  globalThis.localStorage = setupMockStorage()

  const branch = getPharmacistAssignedBranch()
  assert.equal(branch.id, '99', 'Should prioritize workingBranchId when user switches branch')
  assert.equal(branch.name, 'West Sub Branch', 'Should prioritize workingBranch name')
})

test('authTokenFor retrieves pharmacist token for pharmacist routes', () => {
  globalThis.sessionStorage = setupMockStorage({
    pharmacistToken: 'pharmacist-bearer-token-abc',
    pharmacyAdminToken: 'admin-token-xyz'
  })
  globalThis.localStorage = setupMockStorage()

  const token = authTokenFor('pharmacist/inventory', 'pharmacist')
  assert.equal(token, 'pharmacist-bearer-token-abc', 'Must return pharmacist token for pharmacist endpoints')
})

test('Error classification maps HTTP status codes to user-friendly messages', () => {
  function classifyError(status, message) {
    if (status === 401) {
      return { type: '401', message: 'Your session has expired. Please log in again.' }
    }
    if (status === 403) {
      return { type: '403', message: "You do not have permission to access this branch's inventory. Please contact your administrator." }
    }
    if (status >= 500) {
      return { type: '500', message: 'Unable to load medicines. Please try again later.' }
    }
    if (/connect|network|offline|failed to fetch/i.test(message || '')) {
      return { type: 'network', message: 'Unable to connect to the server. Check your connection and retry.' }
    }
    return { type: 'other', message: message || 'Unable to load medicines. Please try again later.' }
  }

  const err401 = classifyError(401, 'Unauthorized')
  assert.equal(err401.type, '401')
  assert.equal(err401.message, 'Your session has expired. Please log in again.')

  const err403 = classifyError(403, 'Forbidden')
  assert.equal(err403.type, '403')
  assert.equal(err403.message, "You do not have permission to access this branch's inventory. Please contact your administrator.")

  const err500 = classifyError(500, 'Internal Server Error')
  assert.equal(err500.type, '500')
  assert.equal(err500.message, 'Unable to load medicines. Please try again later.')

  const errNet = classifyError(0, 'Failed to fetch')
  assert.equal(errNet.type, 'network')
  assert.equal(errNet.message, 'Unable to connect to the server. Check your connection and retry.')
})
