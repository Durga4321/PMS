function recordKey() { return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}` }

export function newMedicine() {
  return { key: recordKey(), medicineName: '', strength: '', morning: '', afternoon: '', evening: '', days: '1', quantity: '', unitPrice: '', instructions: '' }
}

export function newPrescription() {
  return { patient: { patientName: '', patientId: '', patientAge: '', patientGender: '', patientPhone: '', doctorName: '', prescriptionDate: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }), notes: '' }, medicines: [newMedicine()], photo: null, prescriptionId: '', billId: '', billAmount: null, paymentComplete: false, paymentMethod: 'Cash', transactionReference: '', requestId: recordKey() }
}

export function updateMedicine(row, field, value) {
  const next = { ...row, [field]: value }
  if (['morning', 'afternoon', 'evening', 'days'].includes(field)) {
    const perDay = ['morning', 'afternoon', 'evening'].reduce((sum, key) => sum + (Number(next[key]) || 0), 0)
    next.quantity = perDay > 0 && Number(next.days) > 0 ? String(Math.ceil(perDay * Number(next.days))) : ''
  }
  return next
}

export function prescriptionTotals(medicines) {
  const lines = medicines.map((row) => Math.round(Number(row.quantity || 0) * Number(row.unitPrice || 0) * 100))
  return { quantity: medicines.reduce((sum, row) => sum + Number(row.quantity || 0), 0), amount: lines.reduce((sum, cents) => sum + cents, 0) / 100, lines: lines.map((cents) => cents / 100) }
}

export function validatePrescription(draft) {
  const { patient, medicines } = draft
  if (!patient.patientName.trim() || !patient.doctorName.trim()) throw new Error('Enter the patient name and doctor name.')
  if (patient.patientPhone && !/^\d{10}$/.test(patient.patientPhone)) throw new Error('Phone number must be exactly 10 digits.')
  if (patient.patientAge !== '' && (!Number.isInteger(Number(patient.patientAge)) || Number(patient.patientAge) < 0 || Number(patient.patientAge) > 130)) throw new Error('Enter a valid patient age.')
  if (!patient.prescriptionDate || !/^\d{4}-\d{2}-\d{2}$/.test(patient.prescriptionDate)) throw new Error('Enter a valid prescription date.')
  if (!medicines.length) throw new Error('Add at least one medicine.')
  for (const [index, row] of medicines.entries()) {
    if (!row.medicineName.trim()) throw new Error(`Enter the medicine name in row ${index + 1}.`)
    const doses = ['morning', 'afternoon', 'evening'].map((key) => Number(row[key] || 0))
    if (doses.some((dose) => !Number.isFinite(dose) || dose < 0) || !doses.some((dose) => dose > 0)) throw new Error(`Enter the prescribed doses in row ${index + 1}.`)
    if (!Number.isInteger(Number(row.days)) || Number(row.days) < 1 || !Number.isInteger(Number(row.quantity)) || Number(row.quantity) < 1) throw new Error(`Enter valid days and quantity in row ${index + 1}.`)
    if (row.unitPrice === '' || !Number.isFinite(Number(row.unitPrice)) || Number(row.unitPrice) < 0) throw new Error(`Enter a valid unit price in row ${index + 1}.`)
  }
  if (!Number.isFinite(prescriptionTotals(medicines).amount)) throw new Error('Enter valid medicine amounts.')
}

export function prescriptionPayload(draft) {
  validatePrescription(draft)
  return { ...draft.patient, patientAge: draft.patient.patientAge === '' ? null : Number(draft.patient.patientAge), clientRequestId: draft.requestId,
    medicines: draft.medicines.map((row) => ({ medicineName: row.medicineName.trim(), strength: row.strength.trim(), days: Number(row.days), duration: `${row.days} days`, dosage: `${Number(row.morning || 0)}-${Number(row.afternoon || 0)}-${Number(row.evening || 0)}`, morning: Number(row.morning || 0) > 0, afternoon: Number(row.afternoon || 0) > 0, evening: Number(row.evening || 0) > 0, quantity: Number(row.quantity), unitPrice: Number(row.unitPrice), instructions: row.instructions.trim() })) }
}

export function savedRecord(response, type) {
  const data = response?.data ?? response
  const record = data?.[type] ?? data
  const id = record?.[`${type}Id`] ?? record?.id ?? record?._id ?? data?.[`${type}Id`]
  if (id == null || id === '') throw new Error(`The server did not return a ${type} reference. Check the saved records before trying again.`)
  return { ...record, id: String(id) }
}
