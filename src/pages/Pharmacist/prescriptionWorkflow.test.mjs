import assert from 'node:assert/strict'
import { test } from 'node:test'
import { newPrescription, prescriptionPayload, prescriptionTotals, savedRecord, updateMedicine, validatePrescription } from './prescriptionModel.js'

function validDraft() {
  const draft = newPrescription()
  draft.patient.patientName = 'Example Patient'
  draft.patient.doctorName = 'Example Doctor'
  draft.patient.patientPhone = '9876543210'
  draft.medicines[0] = { ...draft.medicines[0], medicineName: 'Medicine A', strength: 'As prescribed', morning: '1', afternoon: '0', evening: '1', days: '5', quantity: '10', unitPrice: '10' }
  return draft
}

test('dose schedule changes calculate quantity without losing editable medicine details', () => {
  const draft = validDraft()
  assert.equal(updateMedicine(draft.medicines[0], 'days', '7').quantity, '14')
  assert.equal(updateMedicine(draft.medicines[0], 'morning', '.5').quantity, '8')
  assert.equal(updateMedicine(draft.medicines[0], 'quantity', '20').quantity, '20')
})

test('totals use line amounts rounded to currency precision', () => {
  assert.deepEqual(prescriptionTotals([{ quantity: '3', unitPrice: '.10' }, { quantity: '2', unitPrice: '.20' }]), { quantity: 5, amount: .70, lines: [.30, .40] })
})

test('manual prescription payload preserves patient details and all three dose times', () => {
  const draft = validDraft()
  const payload = prescriptionPayload(draft)
  assert.equal(payload.patientName, 'Example Patient')
  assert.equal(payload.medicines[0].dosage, '1-0-1')
  assert.equal(payload.medicines[0].morning, true)
  assert.equal(payload.medicines[0].afternoon, false)
  assert.equal(payload.medicines[0].evening, true)
  assert.equal(payload.medicines[0].days, 5)
  assert.equal(payload.medicines[0].quantity, 10)
  assert.equal(payload.photo, undefined)
  assert.equal(payload.prescriptionDate.length, 10)
})

test('API schedule flags are booleans while fractional and multiple doses remain in dosage', () => {
  const draft = validDraft()
  draft.medicines[0] = { ...draft.medicines[0], morning: '.5', afternoon: '', evening: '2' }
  const medicine = JSON.parse(JSON.stringify(prescriptionPayload(draft))).medicines[0]
  assert.equal(medicine.morning, true)
  assert.equal(medicine.afternoon, false)
  assert.equal(medicine.evening, true)
  assert.equal(medicine.dosage, '0.5-0-2')
  assert.equal(draft.medicines[0].morning, '.5')
})

test('patient, schedule, quantity, duration and price errors prevent checkout', () => {
  const draft = validDraft()
  assert.doesNotThrow(() => validatePrescription(draft))
  for (const [key, value] of [['morning', '-1'], ['days', '0'], ['quantity', '1.5'], ['unitPrice', '-2'], ['medicineName', '']]) {
    assert.throws(() => validatePrescription({ ...draft, medicines: [{ ...draft.medicines[0], [key]: value }] }))
  }
  assert.throws(() => validatePrescription({ ...draft, patient: { ...draft.patient, patientPhone: '123' } }))
})

test('only real server prescription and bill references advance checkout', () => {
  assert.equal(savedRecord({ data: { prescription: { id: 'rx-1' } } }, 'prescription').id, 'rx-1')
  assert.equal(savedRecord({ data: { billId: 42, totalAmount: 150 } }, 'bill').id, '42')
  assert.throws(() => savedRecord({ success: true }, 'prescription'), /did not return/)
})
