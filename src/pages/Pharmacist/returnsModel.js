export function returnList(response) {
  if (Array.isArray(response)) return response
  if (!response || typeof response !== 'object') return []
  for (const key of ['items', 'returns', 'records', 'results', 'inventory', 'medicines', 'batches', 'data']) {
    if (Array.isArray(response[key])) return response[key]
    if (response[key] && typeof response[key] === 'object') {
      const nested = returnList(response[key])
      if (nested.length) return nested
    }
  }
  return []
}

export function medicineIdentity(item) { return item?.medicineId ?? item?.MedicineId ?? item?.medicine?.id ?? item?.backendId ?? item?.id ?? item?._id }
export function medicineName(item) { return item?.medicineName ?? item?.medicine?.name ?? item?.name ?? item?.Name ?? '' }
export function stockValue(item) {
  const value = item?.availableQuantity ?? item?.availableStock ?? item?.currentStock ?? item?.stock ?? item?.quantity ?? item?.Quantity
  return value != null && Number.isFinite(Number(value)) ? Number(value) : null
}

export function medicineOptions(inventory) {
  const medicines = new Map()
  for (const item of inventory) {
    const id = medicineIdentity(item)
    if (id == null || !medicineName(item)) continue
    if (!medicines.has(String(id))) medicines.set(String(id), { id: String(id), apiId: id, name: medicineName(item), strength: item.strength ?? item.medicine?.strength ?? '' })
  }
  return [...medicines.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export function returnMedicineLabel(medicine) { return `${medicine.name}${medicine.strength ? ` · ${medicine.strength}` : ''}` }
export function matchingReturnMedicine(medicines, name) {
  const query = name.trim().toLocaleLowerCase()
  if (!query) return null
  const exact = medicines.filter((medicine) => returnMedicineLabel(medicine).toLocaleLowerCase() === query)
  if (exact.length === 1) return exact[0]
  const byName = medicines.filter((medicine) => medicine.name.toLocaleLowerCase() === query)
  return byName.length === 1 ? byName[0] : null
}

export function formatConditionLabel(val) {
  const str = String(val || '')
  if (/EligibleForRestocking|restock/i.test(str)) return 'Eligible for restocking'
  if (/Damaged/i.test(str)) return 'Damaged — keep separate'
  if (/Expired/i.test(str)) return 'Expired — keep separate'
  return str.replace(/([a-z])([A-Z])/g, '$1 $2')
}

export function parseReturnOptions(data) {
  const root = data?.data || data || {}

  const rawReasons = root?.reasons || root?.returnReasons || (Array.isArray(root) ? root : [])
  const reasons = (Array.isArray(rawReasons) ? rawReasons : []).map((r) => {
    if (typeof r === 'string') return { value: r, label: r }
    const val = r?.value ?? r?.id ?? r?.code ?? r?.name ?? r?.label ?? String(r)
    const label = r?.label ?? r?.name ?? r?.description ?? String(val)
    return { value: String(val), label: String(label) }
  }).filter((r) => r.value)

  const rawConditions = root?.conditions || root?.medicineConditions || root?.returnConditions || []
  const conditions = (Array.isArray(rawConditions) ? rawConditions : []).map((c) => {
    if (typeof c === 'string') {
      return { value: c, label: formatConditionLabel(c) }
    }
    const val = c?.code ?? c?.value ?? c?.name ?? c?.id ?? String(c)
    const label = c?.label ?? c?.name ?? formatConditionLabel(String(val))
    return { value: String(val), label: String(label) }
  }).filter((c) => c.value)

  return {
    reasons,
    conditions,
  }
}

export function newReturnLine(defaultCondition = 'EligibleForRestocking') {
  return {
    key: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    medicineId: '',
    batchId: '',
    batchNumber: '',
    originalBatch: '',
    expiryDate: '',
    quantity: '',
    condition: defaultCondition,
    returnableQuantity: null,
    returnId: '',
    completed: false,
    error: '',
  }
}

export function returnPayload(form, row, medicines) {
  if (!form.billId.trim()) throw new Error('Enter the original bill ID from Bills.')
  if (!form.reason.trim()) throw new Error('Select a reason for the return.')
  const medicine = medicines.find((item) => item.id === row.medicineId)
  if (!medicine) throw new Error('Select an existing medicine from your inventory.')
  if (!row.batchNumber.trim()) throw new Error('Enter or select the original batch number.')
  const quantity = Number(row.quantity)
  if (!Number.isSafeInteger(quantity) || quantity < 1) throw new Error('Returned quantity must be a positive whole number.')
  if (!['restock', 'damaged', 'expired', 'EligibleForRestocking', 'Damaged', 'Expired'].some((c) => c.toLowerCase() === String(row.condition).toLowerCase())) {
    throw new Error('Select a valid medicine condition.')
  }
  if (row.condition === 'restock' || /EligibleForRestocking/i.test(row.condition)) {
    if (!form.verified) throw new Error('Confirm that the returned medicines have been inspected before restocking.')
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
    if (row.expiryDate && String(row.expiryDate).slice(0, 10) <= today) throw new Error('Expired medicines cannot be added to available stock. Select Expired instead.')
  }
  const billId = /^\d+$/.test(form.billId.trim()) && Number.isSafeInteger(Number(form.billId)) ? Number(form.billId) : form.billId.trim()
  return { billId, patientName: form.patientName.trim(), medicineId: medicine.apiId, medicineName: medicine.name, batchNumber: row.batchNumber.trim(), ...(row.batchId ? { batchId: row.batchId } : {}), quantity, reason: form.reason, notes: form.notes.trim(), condition: row.condition, restock: row.condition === 'restock' || /EligibleForRestocking/i.test(row.condition), clientRequestId: row.key }
}

export function patientReturnPayload(form, lines, medicines = [], allowedOptions = null) {
  const rawBillId = String(form?.billId ?? '').trim()
  const billId = Number(rawBillId)
  if (!rawBillId || !Number.isInteger(billId) || billId <= 0) {
    throw new Error('Enter a valid numeric Bill ID.')
  }
  const reason = String(form?.reason || '').trim()
  if (!reason) {
    throw new Error('Select a reason for the return.')
  }
  if (allowedOptions?.reasons?.length > 0) {
    const validReasonValues = allowedOptions.reasons.map((r) => typeof r === 'string' ? r : r.value)
    if (!validReasonValues.includes(reason)) {
      throw new Error('Please select a valid return reason from the options.')
    }
  }

  const validLines = (lines || []).filter((row) => !row.completed)
  if (!validLines.length) {
    throw new Error('Please add at least one medicine to return.')
  }

  const mappedMedicines = validLines.map((row, index) => {
    const medIdRaw = row.medicineId || (Array.isArray(medicines) ? medicines.find((m) => String(m.id) === String(row.medicineId))?.apiId : null) || row.medicineId
    const medId = Number(medIdRaw)
    if (!medId || !Number.isInteger(medId) || medId <= 0) {
      throw new Error(`Select an eligible medicine for row ${index + 1}.`)
    }
    const batch = String(row.originalBatch || row.batchNumber || '').trim()
    if (!batch) {
      throw new Error(`Enter or select the original batch number for row ${index + 1}.`)
    }
    const quantity = Number(row.quantity)
    if (!Number.isSafeInteger(quantity) || quantity < 1) {
      throw new Error(`Returned quantity for row ${index + 1} must be a positive whole number.`)
    }
    if (row.returnableQuantity != null && Number.isFinite(Number(row.returnableQuantity))) {
      const maxReturnable = Number(row.returnableQuantity)
      if (quantity > maxReturnable) {
        throw new Error(`Returned quantity (${quantity}) exceeds returnable quantity (${maxReturnable}) for row ${index + 1}.`)
      }
    }

    let condition = 'EligibleForRestocking'
    const condStr = String(row.condition || '')
    if (condStr === 'damaged' || /Damaged/i.test(condStr)) {
      condition = 'Damaged'
    } else if (condStr === 'expired' || /Expired/i.test(condStr)) {
      condition = 'Expired'
    } else if (condStr === 'restock' || /EligibleForRestocking|restock/i.test(condStr)) {
      condition = 'EligibleForRestocking'
      if (!form?.verified && !form?.verifiedForRestocking) {
        throw new Error('Confirm that the returned medicines have been inspected before restocking.')
      }
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
      if (row.expiryDate && String(row.expiryDate).slice(0, 10) <= today) {
        throw new Error('Expired medicines cannot be added to available stock. Select Expired instead.')
      }
    } else if (condStr) {
      condition = condStr
    }

    if (allowedOptions?.conditions?.length > 0) {
      const validConditionValues = allowedOptions.conditions.map((c) => typeof c === 'string' ? c : c.value)
      const matches = validConditionValues.some((v) => v.toLowerCase() === condStr.toLowerCase() || v.toLowerCase() === condition.toLowerCase())
      if (!matches) {
        throw new Error(`Select a valid medicine condition for row ${index + 1}.`)
      }
    }

    return {
      medicineId: medId,
      originalBatch: batch,
      quantity,
      condition,
    }
  })

  return {
    billId,
    patientName: String(form?.patientName || '').trim(),
    reason,
    notes: String(form?.notes || '').trim(),
    verifiedForRestocking: Boolean(form?.verified ?? form?.verifiedForRestocking),
    medicines: mappedMedicines,
  }
}

export function returnedRecord(response) {
  const data = response?.data ?? response
  const record = data?.return ?? data?.medicineReturn ?? data
  const id = record?.returnId ?? record?.id ?? record?._id
  if (id == null || id === '') throw new Error('The server did not return a return ID. Refresh Return History before retrying.')
  return { ...record, id: String(id) }
}

export function isReturnApproved(record) { return record?.restocked === true || /^(approved|completed|restocked)$/i.test(String(record?.status ?? record?.state ?? '')) }

// Use the server's absolute inventory quantities. Never increment a medicine
// by its name in the browser: that can affect another branch or double-count.
export function applyReturnedInventory(catalogue, inventory) {
  return catalogue.map((medicine) => {
    const id = medicineIdentity(medicine)
    if (id == null) return medicine
    const branch = medicine.branchId ?? medicine.BranchId
    const pharmacy = medicine.pharmacyId ?? medicine.PharmacyId
    const matches = inventory.filter((item) => String(medicineIdentity(item)) === String(id)
      && (branch == null || item.branchId == null || String(item.branchId) === String(branch))
      && (pharmacy == null || item.pharmacyId == null || String(item.pharmacyId) === String(pharmacy)))
    if (!matches.length) return medicine
    const totals = matches.filter((item) => item.batchId == null && item.batchNumber == null)
    let stock
    if (totals.length) stock = stockValue(totals[0])
    else {
      const batches = new Map(matches.map((item) => [String(item.batchId ?? item.batchNumber), stockValue(item)]))
      stock = [...batches.values()].every((value) => value != null) ? [...batches.values()].reduce((sum, value) => sum + value, 0) : null
    }
    return stock == null ? medicine : { ...medicine, stock, quantity: stock, currentStock: stock, availableStock: stock, initialStockCount: stock }
  })
}
