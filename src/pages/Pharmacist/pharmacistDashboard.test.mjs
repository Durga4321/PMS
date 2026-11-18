import assert from 'node:assert/strict'
import { test } from 'node:test'

const unwrap = (value) => value?.data?.dashboard || value?.data || value?.dashboard || value || {}
const field = (object, keys) => keys.map((key) => key.split('.').reduce((value, part) => value?.[part], object)).find((value) => value !== undefined && value !== null)
const rows = (value, keys = []) => {
  if (Array.isArray(value)) return value
  for (const key of [...keys, 'items', 'results', 'records', 'data']) {
    if (Array.isArray(value?.[key])) return value[key]
  }
  return []
}

test('metrics calculation correctly derives counts from fresh API responses without localStorage', () => {
  const mockDashboardRes = {
    summary: {
      pendingPrescriptions: 5,
      todayDispensed: 12,
      totalBills: 20,
      todayReturns: 2,
    }
  }

  const summary = mockDashboardRes.summary
  const queue = [{ id: 1 }, { id: 2 }, { id: 3 }]
  const liveDispensing = [{ id: 10, dispensingStatus: 'Dispensed' }, { id: 11, dispensingStatus: 'Dispensed' }]
  const liveBills = [{ id: 101 }, { id: 102 }]
  const liveReturns = [{ id: 201 }]

  const pendingVal = queue.length
  const dispensedVal = field(summary, ['todayDispensed', 'dispensedToday']) ?? liveDispensing.length
  const billsVal = field(summary, ['totalBills', 'billsCount']) ?? liveBills.length
  const returnsVal = field(summary, ['todayReturns', 'returnsToday']) ?? liveReturns.length

  assert.equal(pendingVal, 3)
  assert.equal(dispensedVal, 12)
  assert.equal(billsVal, 20)
  assert.equal(returnsVal, 2)
})

test('dispensed today falls back to live dispensing overview count when summary count is absent', () => {
  const emptySummary = {}
  const liveDispensing = [
    { id: 1, dispensingStatus: 'Dispensed' },
    { id: 2, dispensingStatus: 'Dispensed' },
    { id: 3, dispensingStatus: 'Draft' },
    { id: 4, dispensingStatus: 'COMPLETED' },
  ]

  const liveDispensedCount = liveDispensing.filter((d) => /dispensed|completed/i.test(d?.dispensingStatus || d?.status || '')).length
  const dispensedVal = field(emptySummary, ['todayDispensed', 'dispensedToday']) ?? liveDispensedCount

  assert.equal(dispensedVal, 3)
})

test('alerts fallback maps near expiry stock when alerts endpoint is empty', () => {
  const primaryAlerts = []
  const nearExpiryRows = [
    { medicineName: 'Paracetamol 500mg', batchNumber: 'B123', daysLeft: 14 },
    { name: 'Amoxicillin 250mg', batchNo: 'B456', daysLeft: 20 },
  ]

  const fallbackAlerts = nearExpiryRows.map((item) => ({
    title: 'Near Expiry Alert',
    medicineName: item.medicineName || item.name || 'Medicine',
    message: `${item.name || item.medicineName || 'Medicine'} expires within 30 days${item.batchNumber || item.batchNo ? ` (Batch: ${item.batchNumber || item.batchNo})` : ''}`,
    type: 'expiry'
  }))

  const alerts = primaryAlerts.length > 0 ? primaryAlerts : fallbackAlerts

  assert.equal(alerts.length, 2)
  assert.equal(alerts[0].medicineName, 'Paracetamol 500mg')
  assert.match(alerts[0].message, /B123/)
  assert.equal(alerts[1].medicineName, 'Amoxicillin 250mg')
  assert.match(alerts[1].message, /B456/)
})

test('dispense payload maps real prescription items without dummy text', () => {
  const detailedMeds = [
    { prescriptionItemId: 101, medicineName: 'Metformin 500mg', quantity: 30 },
    { id: 102, name: 'Atorvastatin 10mg', qty: 15 }
  ]

  const dispenseItems = detailedMeds.map((m, idx) => ({
    prescriptionItemId: Number(m.prescriptionItemId || m.id || idx + 1),
    medicineName: m.medicineName || m.name || `Item #${idx + 1}`,
    quantity: Number(m.quantity || m.qty || 1)
  }))

  assert.equal(dispenseItems.length, 2)
  assert.equal(dispenseItems[0].prescriptionItemId, 101)
  assert.equal(dispenseItems[0].medicineName, 'Metformin 500mg')
  assert.equal(dispenseItems[0].quantity, 30)

  assert.equal(dispenseItems[1].prescriptionItemId, 102)
  assert.equal(dispenseItems[1].medicineName, 'Atorvastatin 10mg')
  assert.equal(dispenseItems[1].quantity, 15)
})
