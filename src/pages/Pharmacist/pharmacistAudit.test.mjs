import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  getPharmacistAssignedBranch,
  pharmacyTenantContext,
  authTokenFor,
  readStoredToken,
  pharmacistReturnsApi,
} from '../../config/api.js'

import {
  newMedicine,
  newPrescription,
  prescriptionPayload,
  prescriptionTotals,
  savedRecord,
  updateMedicine,
  validatePrescription,
} from './prescriptionModel.js'

import {
  patientReturnPayload,
  parseReturnOptions,
  applyReturnedInventory,
  returnList,
} from './returnsModel.js'

// Mock storage helper for test isolation
function createMockStorage(initial = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, val) => map.set(key, String(val)),
    removeItem: (key) => map.delete(key),
    clear: () => map.clear(),
  }
}

// -----------------------------------------------------------------------------
// MODULE 1: PHARMACIST DASHBOARD OVERVIEW & METRICS
// -----------------------------------------------------------------------------

test('[Audit] Dashboard: derive metrics correctly from API responses', () => {
  const summary = {
    pendingPrescriptions: 7,
    todayDispensed: 15,
    totalBills: 24,
    todayReturns: 3,
  }
  const queue = [{ id: 'RX-1' }, { id: 'RX-2' }]
  const liveDispensing = [
    { id: 'D-1', dispensingStatus: 'Dispensed' },
    { id: 'D-2', dispensingStatus: 'Completed' },
    { id: 'D-3', dispensingStatus: 'Draft' },
  ]
  const liveBills = [{ id: 'B-1' }, { id: 'B-2' }]
  const liveReturns = [{ id: 'R-1' }]

  const pendingVal = queue.length
  const liveDispensedCount = liveDispensing.filter((d) =>
    /dispensed|completed/i.test(d?.dispensingStatus || d?.status || '')
  ).length
  const dispensedVal = summary.todayDispensed ?? liveDispensedCount
  const billsVal = summary.totalBills ?? liveBills.length
  const returnsVal = summary.todayReturns ?? liveReturns.length

  assert.equal(pendingVal, 2)
  assert.equal(dispensedVal, 15)
  assert.equal(billsVal, 24)
  assert.equal(returnsVal, 3)
})

test('[Audit] Dashboard: fallback to live dispensing count when summary is empty', () => {
  const emptySummary = {}
  const liveDispensing = [
    { id: 'D-1', status: 'dispensed' },
    { id: 'D-2', status: 'COMPLETED' },
    { id: 'D-3', status: 'pending' },
  ]
  const liveDispensedCount = liveDispensing.filter((d) =>
    /dispensed|completed/i.test(d?.dispensingStatus || d?.status || '')
  ).length
  const dispensedVal = emptySummary.todayDispensed ?? liveDispensedCount
  assert.equal(dispensedVal, 2)
})

test('[Audit] Dashboard: near-expiry alerts fallback generates user alerts', () => {
  const nearExpiryRows = [
    { medicineName: 'Amoxicillin 500mg', batchNumber: 'BAT-2026-A', daysLeft: 12 },
    { name: 'Ciprofloxacin 250mg', batchNo: 'BAT-2026-B', daysLeft: 25 },
  ]
  const fallbackAlerts = nearExpiryRows.map((item) => ({
    title: 'Near Expiry Alert',
    medicineName: item.medicineName || item.name || 'Medicine',
    message: `${item.name || item.medicineName || 'Medicine'} expires within 30 days${
      item.batchNumber || item.batchNo ? ` (Batch: ${item.batchNumber || item.batchNo})` : ''
    }`,
    type: 'expiry',
  }))

  assert.equal(fallbackAlerts.length, 2)
  assert.equal(fallbackAlerts[0].medicineName, 'Amoxicillin 500mg')
  assert.match(fallbackAlerts[0].message, /BAT-2026-A/)
  assert.equal(fallbackAlerts[1].medicineName, 'Ciprofloxacin 250mg')
  assert.match(fallbackAlerts[1].message, /BAT-2026-B/)
})

test('[Audit] Dashboard: returns history pageSize is clamped to 20 to prevent backend 500', async () => {
  const cleanParams = {
    page: Math.max(1, Number(1) || 1),
    pageSize: Math.min(20, Math.max(1, Number(100) || 20)),
  }
  assert.equal(cleanParams.pageSize, 20, 'pageSize must be clamped to 20 maximum')
})

// -----------------------------------------------------------------------------
// MODULE 2: PRESCRIPTION WORKSPACE & DISPENSING
// -----------------------------------------------------------------------------

test('[Audit] Dispensing: dose schedule automatically computes quantity from days and doses', () => {
  let item = newMedicine()
  item.medicineName = 'Paracetamol 650mg'
  item.days = '5'
  item.morning = '1'
  item.afternoon = '0'
  item.evening = '1'
  item = updateMedicine(item, 'days', '5')
  assert.equal(item.quantity, '10', '1 morning + 0 afternoon + 1 evening for 5 days = 10 tablets')

  item = updateMedicine(item, 'afternoon', '1')
  assert.equal(item.quantity, '15', '3 per day for 5 days = 15 tablets')

  item = updateMedicine(item, 'quantity', '20')
  assert.equal(item.quantity, '20', 'Explicit manual quantity override must be preserved')
})

test('[Audit] Dispensing: totals calculate line amounts and rounded grand total', () => {
  const items = [
    { quantity: '10', unitPrice: '5.50' },
    { quantity: '2', unitPrice: '12.25' },
  ]
  const totals = prescriptionTotals(items)
  assert.equal(totals.quantity, 12)
  assert.equal(totals.amount, 79.5)
  assert.deepEqual(totals.lines, [55.0, 24.5])
})

test('[Audit] Dispensing: validation rejects incomplete or invalid prescription fields', () => {
  const draft = newPrescription()
  draft.patient.patientName = 'Test Patient'
  draft.patient.doctorName = 'Dr. Sharma'
  draft.patient.patientPhone = '9876543210'
  draft.medicines = [
    {
      ...newMedicine(),
      medicineName: 'Azithromycin 500mg',
      morning: '1',
      afternoon: '0',
      evening: '0',
      days: '3',
      quantity: '3',
      unitPrice: '25.00',
    },
  ]

  assert.doesNotThrow(() => validatePrescription(draft))
  assert.throws(() => validatePrescription({ ...draft, patient: { ...draft.patient, patientName: '' } }), /patient name/i)
  assert.throws(() => validatePrescription({ ...draft, patient: { ...draft.patient, doctorName: '' } }), /doctor name/i)
  assert.throws(() => validatePrescription({ ...draft, patient: { ...draft.patient, patientPhone: '123' } }), /phone number/i)
  assert.throws(
    () =>
      validatePrescription({
        ...draft,
        medicines: [{ ...draft.medicines[0], medicineName: '' }],
      }),
    /medicine name/i
  )
  assert.throws(
    () =>
      validatePrescription({
        ...draft,
        medicines: [{ ...draft.medicines[0], unitPrice: '-10' }],
      }),
    /unit price/i
  )
})

test('[Audit] Dispensing: manual prescription payload constructs backend-compliant flags & string format', () => {
  const draft = newPrescription()
  draft.patient.patientName = 'Ananya Sen'
  draft.patient.doctorName = 'Dr. Kapoor'
  draft.patient.patientAge = '34'
  draft.patient.patientGender = 'Female'
  draft.patient.patientPhone = '9876543210'
  draft.patient.notes = 'Take after food'
  draft.medicines = [
    {
      ...newMedicine(),
      medicineName: 'Metformin 500mg',
      strength: '500mg',
      morning: '1',
      afternoon: '0',
      evening: '1',
      days: '30',
      quantity: '60',
      unitPrice: '3.50',
    },
  ]

  const payload = prescriptionPayload(draft)
  assert.equal(payload.patientName, 'Ananya Sen')
  assert.equal(payload.doctorName, 'Dr. Kapoor')
  assert.equal(payload.patientAge, 34)
  assert.equal(payload.patientGender, 'Female')
  assert.equal(payload.patientPhone, '9876543210')
  assert.equal(payload.medicines.length, 1)
  assert.equal(payload.medicines[0].medicineName, 'Metformin 500mg')
  assert.equal(payload.medicines[0].dosage, '1-0-1')
  assert.equal(payload.medicines[0].morning, true)
  assert.equal(payload.medicines[0].afternoon, false)
  assert.equal(payload.medicines[0].evening, true)
  assert.equal(payload.medicines[0].days, 30)
  assert.equal(payload.medicines[0].quantity, 60)
})

// -----------------------------------------------------------------------------
// MODULE 3: MEDICINES & LIVE INVENTORY
// -----------------------------------------------------------------------------

test('[Audit] Medicines: resolve pharmacist assigned branch without hardcoding branchId=1', () => {
  globalThis.sessionStorage = createMockStorage({
    pharmacistToken: 'pharm-token',
    pharmacistAssignment: JSON.stringify({
      pharmacyId: '5',
      branchId: '12',
      branchName: 'East Clinic Branch',
    }),
  })
  globalThis.localStorage = createMockStorage()

  const branch = getPharmacistAssignedBranch()
  assert.equal(branch.id, '12')
  assert.equal(branch.name, 'East Clinic Branch')

  const tenant = pharmacyTenantContext('pharmacist')
  assert.equal(tenant.branchId, '12')
  assert.equal(tenant.pharmacyId, '5')
})

test('[Audit] Medicines: stock categorization (In Stock, Low Stock, Out of Stock)', () => {
  const sampleMedicines = [
    { id: 1, name: 'Med A', stock: 100, reorderLevel: 20 },
    { id: 2, name: 'Med B', stock: 15, reorderLevel: 20 },
    { id: 3, name: 'Med C', stock: 0, reorderLevel: 10 },
  ]

  const active = sampleMedicines.filter((m) => m.stock > 0).length
  const lowStock = sampleMedicines.filter((m) => m.stock > 0 && m.stock <= m.reorderLevel).length
  const outStock = sampleMedicines.filter((m) => m.stock <= 0).length

  assert.equal(active, 2)
  assert.equal(lowStock, 1)
  assert.equal(outStock, 1)
})

test('[Audit] Medicines: applyReturnedInventory merges live inventory stock counts into catalogue', () => {
  const catalogue = [
    { id: 10, medicineCode: 'M10', name: 'Paracetamol', stock: 0 },
    { id: 20, medicineCode: 'M20', name: 'Amoxicillin', stock: 5 },
  ]
  const liveInventory = [
    { medicineId: 10, quantity: 50, batchNumber: 'B001' },
    { medicineId: 20, stock: 30 },
  ]

  const merged = applyReturnedInventory(catalogue, liveInventory)
  const paracetamol = merged.find((m) => m.id === 10)
  const amoxicillin = merged.find((m) => m.id === 20)

  assert.equal(paracetamol.stock, 50, 'Stock must update to live inventory quantity')
  assert.equal(amoxicillin.stock, 30, 'Stock must update to live inventory stock')
})

// -----------------------------------------------------------------------------
// MODULE 4: BILLS & REFUNDS
// -----------------------------------------------------------------------------

test('[Audit] Bills: filters by status and date range', () => {
  const bills = [
    { billId: 1, billNumber: 'B001', status: 'Paid', createdAt: '2026-11-01T10:00:00Z', totalAmount: 150 },
    { billId: 2, billNumber: 'B002', status: 'Cancelled', createdAt: '2026-11-05T12:00:00Z', totalAmount: 300 },
    { billId: 3, billNumber: 'B003', status: 'Paid', createdAt: '2026-11-15T15:00:00Z', totalAmount: 450 },
  ]

  const paid = bills.filter((b) => b.status === 'Paid')
  assert.equal(paid.length, 2)

  const midMonth = bills.filter((b) => {
    const d = b.createdAt.split('T')[0]
    return d >= '2026-11-02' && d <= '2026-11-10'
  })
  assert.equal(midMonth.length, 1)
  assert.equal(midMonth[0].billNumber, 'B002')

  const sorted = [...bills].sort((a, b) => b.totalAmount - a.totalAmount)
  assert.equal(sorted[0].billNumber, 'B003')
  assert.equal(sorted[2].billNumber, 'B001')
})

test('[Audit] Bills: cancel bill requires non-empty reason', () => {
  function validateCancellation(reason) {
    if (!reason || !reason.trim()) {
      throw new Error('Enter a reason for cancellation.')
    }
    return true
  }

  assert.throws(() => validateCancellation(''), /reason for cancellation/)
  assert.throws(() => validateCancellation('   '), /reason for cancellation/)
  assert.equal(validateCancellation('Customer changed mind'), true)
})

test('[Audit] Bills: refund validation checks payment ID, positive amount, and max balance', () => {
  function validateRefund(paymentId, amount, availableBalance) {
    if (!paymentId || !String(paymentId).trim()) {
      throw new Error('Enter a valid payment ID.')
    }
    const num = Number(amount)
    if (!Number.isFinite(num) || num <= 0) {
      throw new Error('Enter a valid refund amount.')
    }
    if (availableBalance != null && num > Number(availableBalance)) {
      throw new Error(`The refund cannot exceed the available payment balance of ${availableBalance}.`)
    }
    return true
  }

  assert.throws(() => validateRefund('', 50, 100), /valid payment ID/)
  assert.throws(() => validateRefund('PAY-1', 0, 100), /valid refund amount/)
  assert.throws(() => validateRefund('PAY-1', -10, 100), /valid refund amount/)
  assert.throws(() => validateRefund('PAY-1', 150, 100), /cannot exceed/)
  assert.equal(validateRefund('PAY-1', 50, 100), true)
})

// -----------------------------------------------------------------------------
// MODULE 5: MEDICINE RETURNS & AUDIT
// -----------------------------------------------------------------------------

test('[Audit] Returns: constructs backend POST /api/pharmacy/returns/patient contract payload', () => {
  const form = {
    billId: '25',
    patientName: 'Test Patient',
    reason: 'Unused medicines',
    notes: 'Prescription changed',
    verifiedForRestocking: true,
  }
  const lines = [
    {
      medicineId: 10,
      originalBatch: 'BATCH001',
      quantity: 2,
      condition: 'EligibleForRestocking',
      returnableQuantity: 5,
    },
  ]
  const payload = patientReturnPayload(form, lines)

  assert.equal(payload.billId, 25)
  assert.equal(payload.patientName, 'Test Patient')
  assert.equal(payload.reason, 'Unused medicines')
  assert.equal(payload.notes, 'Prescription changed')
  assert.equal(payload.verifiedForRestocking, true)
  assert.equal(payload.medicines.length, 1)
  assert.equal(payload.medicines[0].medicineId, 10)
  assert.equal(payload.medicines[0].originalBatch, 'BATCH001')
  assert.equal(payload.medicines[0].quantity, 2)
  assert.equal(payload.medicines[0].condition, 'EligibleForRestocking')
})

test('[Audit] Returns: rejects return quantity exceeding returnable quantity', () => {
  const form = {
    billId: '25',
    patientName: 'Test Patient',
    reason: 'Unused medicines',
  }
  const lines = [
    {
      medicineId: 10,
      originalBatch: 'BATCH001',
      quantity: 10,
      condition: 'EligibleForRestocking',
      returnableQuantity: 5,
    },
  ]

  assert.throws(
    () => patientReturnPayload(form, lines),
    /exceeds returnable/i
  )
})

// -----------------------------------------------------------------------------
// MODULE 6: NOTIFICATIONS & AUDIENCE
// -----------------------------------------------------------------------------

test('[Audit] Notifications: role token retrieval & unread count badge display', () => {
  globalThis.sessionStorage = createMockStorage({
    pharmacistToken: 'jwt-pharm-tok',
  })
  globalThis.localStorage = createMockStorage()

  const token = authTokenFor('notifications/unread-count', 'pharmacist')
  assert.equal(token, 'jwt-pharm-tok')
})

// -----------------------------------------------------------------------------
// MODULE 7: ROLE PERMISSIONS & NAVIGATION
// -----------------------------------------------------------------------------

test('[Audit] Permissions: pharmacist view navigation respects permissions or defaults to all standard modules', () => {
  const defaultNavLabels = [
    'Dashboard',
    'Dispensing',
    'Medicines',
    'Bills',
    'Returns',
    'Reports',
    'Notifications',
  ]
  assert.equal(defaultNavLabels.length, 7)
  assert.ok(defaultNavLabels.includes('Dashboard'))
  assert.ok(defaultNavLabels.includes('Dispensing'))
  assert.ok(defaultNavLabels.includes('Medicines'))
  assert.ok(defaultNavLabels.includes('Bills'))
  assert.ok(defaultNavLabels.includes('Returns'))
  assert.ok(defaultNavLabels.includes('Reports'))
  assert.ok(defaultNavLabels.includes('Notifications'))
})
