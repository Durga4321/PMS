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
  if (!patient.patientName?.trim() || !patient.doctorName?.trim()) throw new Error('Enter the patient name and doctor name.')
  if (!patient.patientPhone || !/^\d{10}$/.test(String(patient.patientPhone).trim())) throw new Error('Patient phone number is required and must be exactly 10 digits.')
  if (patient.patientAge !== '' && (!Number.isInteger(Number(patient.patientAge)) || Number(patient.patientAge) < 0 || Number(patient.patientAge) > 130)) throw new Error('Enter a valid patient age.')
  if (!patient.prescriptionDate || !/^\d{4}-\d{2}-\d{2}$/.test(patient.prescriptionDate)) throw new Error('Enter a valid prescription date.')
  if (!medicines.length) throw new Error('Add at least one medicine.')
  for (const [index, row] of medicines.entries()) {
    if (!row.medicineName.trim()) throw new Error(`Enter the medicine name in row ${index + 1}.`)
    const doses = ['morning', 'afternoon', 'evening'].map((key) => Number(row[key] || 0))
    if (doses.some((dose) => !Number.isFinite(dose) || dose < 0)) throw new Error(`Enter valid doses in row ${index + 1}.`)
    if (!Number.isInteger(Number(row.days)) || Number(row.days) < 1 || !Number.isInteger(Number(row.quantity)) || Number(row.quantity) < 1) throw new Error(`Enter valid days and quantity in row ${index + 1}.`)
    if (row.unitPrice === '' || !Number.isFinite(Number(row.unitPrice)) || Number(row.unitPrice) < 0) throw new Error(`Enter a valid unit price in row ${index + 1}.`)
  }
  if (!Number.isFinite(prescriptionTotals(medicines).amount)) throw new Error('Enter valid medicine amounts.')
}

export function prescriptionPayload(draft) {
  validatePrescription(draft)
  const rawPid = String(draft.patient?.patientId || '').trim()
  const cleanPatientId = rawPid && !isNaN(Number(rawPid)) ? Number(rawPid) : null
  return {
    ...draft.patient,
    patientId: cleanPatientId,
    patientAge: draft.patient.patientAge === '' ? null : Number(draft.patient.patientAge),
    clientRequestId: draft.requestId,
    medicines: draft.medicines.map((row) => ({
      medicineName: row.medicineName.trim(),
      strength: row.strength.trim(),
      days: Number(row.days),
      duration: `${row.days} days`,
      dosage: `${Number(row.morning || 0)}-${Number(row.afternoon || 0)}-${Number(row.evening || 0)}`,
      morning: Number(row.morning || 0) > 0,
      afternoon: Number(row.afternoon || 0) > 0,
      evening: Number(row.evening || 0) > 0,
      quantity: Number(row.quantity),
      unitPrice: Number(row.unitPrice),
      instructions: row.instructions.trim(),
    })),
  }
}

export function savedRecord(response, type) {
  const data = response?.data ?? response
  const record = data?.[type] ?? data
  const id = record?.[`${type}Id`] ?? record?.id ?? record?._id ?? data?.[`${type}Id`]
  if (id == null || id === '') throw new Error(`The server did not return a ${type} reference. Check the saved records before trying again.`)
  return { ...record, id: String(id) }
}

export function normalizeMedicineOption(item) {
  if (!item || typeof item !== 'object') return null
  const name = String(
    item.name ||
    item.medicineName ||
    item.MedicineName ||
    item.Name ||
    item.brandName ||
    item.BrandName ||
    ''
  ).trim()
  if (!name || name === '-') return null

  const strength = String(
    item.strength ||
    item.power ||
    item.dosageForm ||
    item.DosageForm ||
    item.form ||
    ''
  ).trim()

  const candidatesPrice = [
    item.sellingPrice,
    item.SellingPrice,
    item.unitPrice,
    item.UnitPrice,
    item.price,
    item.Price,
    item.mrp,
    item.MRP,
    item.costPrice,
    item.rate
  ]
  let unitPrice = ''
  for (const c of candidatesPrice) {
    if (c !== undefined && c !== null && c !== '') {
      const n = Number(c)
      if (!Number.isNaN(n) && n >= 0) {
        unitPrice = String(n)
        break
      }
    }
  }

  const stockVal = item.stock ?? item.quantity ?? item.currentStock ?? item.availableQuantity ?? item.availableStock ?? null
  const stock = stockVal != null && !Number.isNaN(Number(stockVal)) ? Number(stockVal) : null

  const id = String(
    item.id ||
    item.Id ||
    item.backendId ||
    item.BackendId ||
    item.medicineId ||
    item.MedicineId ||
    item._id ||
    item.medicineCode ||
    item.MedicineCode ||
    item.code ||
    item.Code ||
    name
  ).trim()

  return {
    id,
    name,
    medicineName: name,
    strength,
    unitPrice,
    stock,
    category: item.category || item.categoryName || '',
    batchNumber: item.batchNumber || item.batchNo || ''
  }
}

export function filterMedicineMatches(queryStr, availableMeds) {
  const q = (queryStr || '').trim().toLowerCase()
  if (!Array.isArray(availableMeds) || availableMeds.length === 0) return []
  if (!q) {
    return availableMeds.slice(0, 8)
  }
  const prefixMatches = []
  const containsMatches = []
  for (const med of availableMeds) {
    const lower = String(med.name || med.medicineName || '').toLowerCase()
    if (lower.startsWith(q)) {
      prefixMatches.push(med)
    } else if (lower.includes(q)) {
      containsMatches.push(med)
    }
  }
  return [...prefixMatches, ...containsMatches].slice(0, 10)
}

export function extractUniqueStrengths(availableMeds = [], apiStrengths = []) {
  const set = new Set()
  const result = []

  const apiList = Array.isArray(apiStrengths)
    ? apiStrengths
    : Array.isArray(apiStrengths?.data)
      ? apiStrengths.data
      : []
  for (const s of apiList) {
    const str = String(typeof s === 'string' ? s : (s?.strength || s?.name || s?.value || '')).trim()
    const k = str.toLowerCase()
    if (str && !set.has(k)) {
      set.add(k)
      result.push(str)
    }
  }

  for (const med of (availableMeds || [])) {
    const str = String(med.strength || med.power || med.dosageForm || '').trim()
    const k = str.toLowerCase()
    if (str && str !== '-' && str.toLowerCase() !== 'as prescribed' && !set.has(k)) {
      set.add(k)
      result.push(str)
    }
  }

  const common = ['100 mg', '250 mg', '500 mg', '650 mg', '1 g', '5 mg', '10 mg', '20 mg', '40 mg', '50 mg', '5 ml', '10 ml', '15 ml']
  for (const c of common) {
    const k = c.toLowerCase()
    if (!set.has(k)) {
      set.add(k)
      result.push(c)
    }
  }

  return result
}

export function filterStrengthMatches(queryStr, availableStrengths = [], currentMedicineName = '', availableMeds = []) {
  const q = String(queryStr || '').trim().toLowerCase()

  // 1. If row already has a medicineName, find strengths specific to that medicine
  const medSpecific = []
  if (currentMedicineName && Array.isArray(availableMeds)) {
    const cleanMedName = currentMedicineName.trim().toLowerCase()
    const matchingMeds = availableMeds.filter((m) => {
      const mName = String(m.name || m.medicineName || '').trim().toLowerCase()
      return mName === cleanMedName || mName.startsWith(cleanMedName)
    })
    for (const m of matchingMeds) {
      const str = String(m.strength || m.power || '').trim()
      if (str && !medSpecific.some((item) => item.strength.toLowerCase() === str.toLowerCase())) {
        const price = m.sellingPrice || m.unitPrice || m.price || m.costPrice
        medSpecific.push({
          strength: str,
          isSpecific: true,
          unitPrice: price != null && price !== '' ? String(price) : '',
        })
      }
    }
  }

  // 2. Combine medicine-specific strengths (first) and general strengths
  const allCandidates = []
  const seen = new Set()

  for (const item of medSpecific) {
    const k = item.strength.toLowerCase()
    if (k && !seen.has(k)) {
      seen.add(k)
      allCandidates.push(item)
    }
  }

  for (const s of (availableStrengths || [])) {
    const str = typeof s === 'string' ? s : (s?.strength || s?.name || s?.value || String(s))
    const cleanStr = String(str || '').trim()
    const k = cleanStr.toLowerCase()
    if (k && !seen.has(k)) {
      seen.add(k)
      allCandidates.push({ strength: cleanStr, isSpecific: false, unitPrice: '' })
    }
  }

  if (!q) {
    return allCandidates.slice(0, 8)
  }

  const prefixMatches = []
  const containsMatches = []

  for (const item of allCandidates) {
    const lower = item.strength.toLowerCase()
    if (lower.startsWith(q)) {
      prefixMatches.push(item)
    } else if (lower.includes(q)) {
      containsMatches.push(item)
    }
  }

  return [...prefixMatches, ...containsMatches].slice(0, 10)
}


