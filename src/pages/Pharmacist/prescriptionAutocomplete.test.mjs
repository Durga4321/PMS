import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  newMedicine,
  updateMedicine,
  prescriptionTotals,
  normalizeMedicineOption,
  filterMedicineMatches
} from './prescriptionModel.js'

test('normalizeMedicineOption maps different medicine shapes and attributes correctly', () => {
  const item1 = {
    medicineId: 101,
    name: 'Folic Acid',
    strength: '5mg',
    sellingPrice: 15.5,
    quantity: 120,
    category: 'Vitamins',
  }
  const norm1 = normalizeMedicineOption(item1)
  assert.equal(norm1.id, '101')
  assert.equal(norm1.name, 'Folic Acid')
  assert.equal(norm1.medicineName, 'Folic Acid')
  assert.equal(norm1.strength, '5mg')
  assert.equal(norm1.unitPrice, '15.5')
  assert.equal(norm1.stock, 120)
  assert.equal(norm1.category, 'Vitamins')

  // Alternate fields (e.g., from inventory or excel upload: BrandName, DosageForm, MRP)
  const item2 = {
    Id: 'MED-99',
    MedicineName: 'Amoxicillin Trihydrate',
    DosageForm: '500mg Capsule',
    MRP: '45.00',
    currentStock: '30',
  }
  const norm2 = normalizeMedicineOption(item2)
  assert.equal(norm2.id, 'MED-99')
  assert.equal(norm2.name, 'Amoxicillin Trihydrate')
  assert.equal(norm2.strength, '500mg Capsule')
  assert.equal(norm2.unitPrice, '45')
  assert.equal(norm2.stock, 30)

  // Empty or invalid item returns null
  assert.equal(normalizeMedicineOption(null), null)
  assert.equal(normalizeMedicineOption({}), null)
  assert.equal(normalizeMedicineOption({ name: '-' }), null)
})

test('autocomplete matching finds medicines starting from the first letter', () => {
  const catalogue = [
    { id: '1', name: 'Folic Acid', strength: '5mg', unitPrice: '12' },
    { id: '2', name: 'Ferrous Sulfate', strength: '200mg', unitPrice: '8' },
    { id: '3', name: 'Fluconazole', strength: '150mg', unitPrice: '25' },
    { id: '4', name: 'Paracetamol', strength: '650mg', unitPrice: '2' },
    { id: '5', name: 'Cefotaxime', strength: '1g', unitPrice: '40' },
  ]

  // 1st letter: 'f'
  const matchF = filterMedicineMatches('f', catalogue)
  assert.equal(matchF.length, 4) // Folic Acid, Ferrous Sulfate, Fluconazole (starts with), Cefotaxime (contains 'f')
  assert.equal(matchF[0].name, 'Folic Acid')
  assert.equal(matchF[1].name, 'Ferrous Sulfate')
  assert.equal(matchF[2].name, 'Fluconazole')
  assert.equal(matchF[3].name, 'Cefotaxime')

  // Prefix: 'Fol'
  const matchFol = filterMedicineMatches('Fol', catalogue)
  assert.equal(matchFol.length, 1)
  assert.equal(matchFol[0].name, 'Folic Acid')

  // Case insensitive
  const matchLowerFol = filterMedicineMatches('fol', catalogue)
  assert.equal(matchLowerFol.length, 1)
  assert.equal(matchLowerFol[0].name, 'Folic Acid')

  // Non-matching
  const matchNone = filterMedicineMatches('xyz', catalogue)
  assert.equal(matchNone.length, 0)
})

test('selecting an autocomplete option populates medicine name, strength, and unit price with automatic total calculation', () => {
  const row = newMedicine()
  assert.equal(row.medicineName, '')
  assert.equal(row.strength, '')
  assert.equal(row.unitPrice, '')

  const selectedMed = {
    id: '10',
    name: 'Folic Acid',
    strength: '5mg',
    unitPrice: '15.50',
  }

  let updated = updateMedicine(row, 'medicineName', selectedMed.name)
  updated = updateMedicine(updated, 'strength', selectedMed.strength)
  updated = updateMedicine(updated, 'unitPrice', String(selectedMed.unitPrice))

  // Set dose: 1 morning, 5 days -> qty 5
  updated = updateMedicine(updated, 'morning', '1')
  updated = updateMedicine(updated, 'days', '5')

  assert.equal(updated.medicineName, 'Folic Acid')
  assert.equal(updated.strength, '5mg')
  assert.equal(updated.unitPrice, '15.50')
  assert.equal(updated.quantity, '5')

  const totals = prescriptionTotals([updated])
  // 5 * 15.50 = 77.50
  assert.equal(totals.quantity, 5)
  assert.equal(totals.amount, 77.5)
  assert.equal(totals.lines[0], 77.5)
})
