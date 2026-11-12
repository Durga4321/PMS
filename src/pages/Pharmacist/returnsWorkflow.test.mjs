import assert from 'node:assert/strict'
import { test } from 'node:test'
import { applyReturnedInventory, isReturnApproved, matchingReturnMedicine, medicineOptions, newReturnLine, returnList, returnMedicineLabel, returnPayload, returnedRecord } from './returnsModel.js'

const medicines = medicineOptions([{ medicineId: 7, medicineName: 'Medicine A', batchNumber: 'B-1', quantity: 20 }])
const form = { billId: '42', patientName: 'Example Patient', reason: 'Unused medicines', notes: '', verified: true }
const line = { ...newReturnLine(), medicineId: '7', batchNumber: 'B-1', quantity: '3' }

test('medicine name lookup ignores case and rejects unknown or ambiguous names', () => {
  assert.equal(matchingReturnMedicine(medicines, ' medicine a ').id, '7')
  assert.equal(matchingReturnMedicine(medicines, 'unknown'), null)
  const duplicates = [{ id: '1', name: 'Medicine A', strength: '10mg' }, { id: '2', name: 'Medicine A', strength: '20mg' }]
  assert.equal(matchingReturnMedicine(duplicates, 'Medicine A'), null)
  assert.equal(matchingReturnMedicine(duplicates, returnMedicineLabel(duplicates[1])).id, '2')
})

test('return payload identifies an existing medicine, original bill, batch and whole tablet quantity', () => {
  const payload = returnPayload(form, line, medicines)
  assert.equal(payload.medicineId, 7)
  assert.equal(payload.medicineName, 'Medicine A')
  assert.equal(payload.quantity, 3)
  assert.equal(payload.billId, 42)
  assert.equal(payload.batchNumber, 'B-1')
  assert.equal(payload.restock, true)
  assert.equal(payload.clientRequestId, line.key)
})

test('missing references, invalid quantities and unverified restocking are rejected', () => {
  for (const quantity of ['0', '-1', '1.5', '', 'NaN']) assert.throws(() => returnPayload(form, { ...line, quantity }, medicines))
  assert.throws(() => returnPayload({ ...form, verified: false }, line, medicines), /inspected/)
  assert.throws(() => returnPayload(form, { ...line, medicineId: 'unknown' }, medicines), /existing medicine/)
  assert.throws(() => returnPayload({ ...form, billId: '' }, line, medicines), /bill ID/)
  assert.throws(() => returnPayload(form, { ...line, batchNumber: '' }, medicines), /batch number/)
})

test('expired or damaged returns are kept separate and never submitted for restocking', () => {
  assert.throws(() => returnPayload(form, { ...line, expiryDate: '2000-01-01' }, medicines), /Expired medicines/)
  for (const condition of ['damaged', 'expired']) assert.equal(returnPayload({ ...form, verified: false }, { ...line, condition, expiryDate: '2000-01-01' }, medicines).restock, false)
})

test('server stock replaces cache values without double addition or cross-branch updates', () => {
  const catalogue = [{ medicineId: 7, name: 'Medicine A', branchId: 'a', stock: 20 }, { medicineId: 7, name: 'Medicine A', branchId: 'b', stock: 40 }]
  const inventory = [{ medicineId: 7, branchId: 'a', batchId: 1, quantity: 13 }, { medicineId: 7, branchId: 'a', batchId: 2, quantity: 10 }]
  const updated = applyReturnedInventory(catalogue, inventory)
  assert.equal(updated[0].stock, 23)
  assert.equal(updated[1].stock, 40)
  assert.equal(applyReturnedInventory(updated, inventory)[0].stock, 23)
  assert.equal(catalogue[0].stock, 20)
})

test('return responses require real IDs and approval is distinguished from pending', () => {
  assert.equal(returnedRecord({ data: { returnId: 7, status: 'Pending' } }).id, '7')
  assert.equal(isReturnApproved({ status: 'Approved' }), true)
  assert.equal(isReturnApproved({ status: 'Pending' }), false)
  assert.throws(() => returnedRecord({ success: true }), /return ID/)
  assert.equal(returnList({ data: { items: [] } }).length, 0)
})
