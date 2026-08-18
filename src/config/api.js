const DEFAULT_API_BASE_URL = 'https://mop-hyperlink-crank.ngrok-free.dev'
const DEFAULT_API_ASSET_BASE_URL = DEFAULT_API_BASE_URL

const env = typeof process !== 'undefined' ? process.env : {}

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  env.REACT_APP_API_BASE_URL ||
  DEFAULT_API_BASE_URL
).replace(/\/+$/, '')

export const API_ASSET_BASE_URL = (
  import.meta.env.VITE_API_ASSET_BASE_URL ||
  env.REACT_APP_API_ASSET_BASE_URL ||
  DEFAULT_API_ASSET_BASE_URL
).replace(/\/+$/, '')

export const apiUrl = (path) => {
  const cleanPath = String(path || '')
    .replace(/^\/+/, '')
    .replace(/^api\/?/i, '')

  return `${API_BASE_URL}/api/${cleanPath}`
}

export const replacePathParams = (path, params = {}) =>
  String(path || '').replace(/{([^}]+)}/g, (_, key) => {
    const value = params[key]
    return value === undefined || value === null ? '' : encodeURIComponent(String(value))
  })

async function request(path, options = {}) {
  const token =
    sessionStorage.getItem('superAdminToken') ||
    localStorage.getItem('superAdminToken') ||
    sessionStorage.getItem('pharmacyAdminToken') ||
    localStorage.getItem('pharmacyAdminToken') ||
    sessionStorage.getItem('pharmacistToken') ||
    localStorage.getItem('pharmacistToken')

  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData
  const response = await fetch(apiUrl(path), {
    headers: {
      'ngrok-skip-browser-warning': 'true',
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
  })

  const contentType = response.headers.get('content-type')
  const data = contentType?.includes('application/json') ? await response.json() : null

  if (!response.ok) {
    throw new Error(data?.message || data?.error || 'Request failed. Please try again.')
  }

  return data
}

export function loginSuperAdmin(credentials) {
  return request('pharmacy-super-admin-auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  })
}

export function logoutSuperAdmin(token) {
  return request('pharmacy-super-admin-auth/logout', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
}

export function forgotSuperAdminPassword(payload) {
  return request('pharmacy-super-admin-auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function verifySuperAdminResetOtp(payload) {
  return request('pharmacy-super-admin-auth/verify-reset-otp', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function resetForgottenSuperAdminPassword(payload) {
  return request('pharmacy-super-admin-auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function loginPharmacyAdmin(credentials) {
  return request('pharmacy-admin-auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  })
}

export function logoutPharmacyAdmin(token) {
  return request('pharmacy-admin-auth/logout', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
}

export function forgotPharmacyAdminPassword(payload) {
  return request('pharmacy-admin-auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function verifyPharmacyAdminResetOtp(payload) {
  return request('pharmacy-admin-auth/verify-reset-otp', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function resetForgottenPharmacyAdminPassword(payload) {
  return request('pharmacy-admin-auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function loginPharmacist(credentials) {
  return request('pharmacy-auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  })
}

export function logoutPharmacist(token) {
  return request('pharmacy-auth/logout', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
}

export function getPharmacistAssignmentStatus() {
  return request('pharmacy-auth/assignment-status')
}

export function changeSignedInPharmacistPassword(payload) {
  return request('pharmacy-auth/change-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function forgotPharmacistPassword(payload) {
  return request('pharmacy-auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function verifyPharmacistResetOtp(payload) {
  return request('pharmacy-auth/verify-reset-otp', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function resetForgottenPharmacistPassword(payload) {
  return request('pharmacy-auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function listMedicines(params = {}) {
  const query = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, value)
  })

  return request(`medicine${query.toString() ? `?${query}` : ''}`)
}

export function createMedicine(payload) {
  return request('medicine', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function getMedicine(id) {
  return request(replacePathParams('medicine/{id}', { id }))
}

export function updateMedicine(id, payload) {
  return request(replacePathParams('medicine/{id}', { id }), {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function deleteMedicine(id) {
  return request(replacePathParams('medicine/{id}', { id }), {
    method: 'DELETE',
  })
}

export function listAvailableMedicines(params = {}) {
  const query = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, value)
  })

  return request(`medicine/available${query.toString() ? `?${query}` : ''}`)
}

export function listMedicineCategories() {
  return request('medicine/categories')
}

export function listMedicineDosageForms() {
  return request('medicine/dosage-forms')
}

export function searchMedicines(params = {}) {
  const query = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, value)
  })

  return request(`medicine/search${query.toString() ? `?${query}` : ''}`)
}

export function validateMedicineImport(file) {
  const formData = new FormData()
  formData.append('file', file)
  return request('medicine-import/validate', {
    method: 'POST',
    body: formData,
  })
}

export function commitMedicineImport(importId, payload = {}) {
  return request(replacePathParams('medicine-import/{importId}/commit', { importId }), {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function getMedicineImportErrors(importId) {
  return request(replacePathParams('medicine-import/{importId}/errors', { importId }))
}

export function getMedicineImportStatus(importId) {
  return request(replacePathParams('medicine-import/{importId}/status', { importId }))
}

export function downloadMedicineImportTemplate() {
  return fetch(apiUrl('medicine-import/template'), {
    headers: {
      'ngrok-skip-browser-warning': 'true',
      ...(sessionStorage.getItem('pharmacyAdminToken') || localStorage.getItem('pharmacyAdminToken')
        ? { Authorization: `Bearer ${sessionStorage.getItem('pharmacyAdminToken') || localStorage.getItem('pharmacyAdminToken')}` }
        : {}),
    },
  })
}

export function getInventory(params = {}) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, value)
  })
  return request(`inventory${query.toString() ? `?${query}` : ''}`)
}

export function addInventoryStock(payload) {
  return request('inventory/add-stock', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function getLowStockInventory() {
  return request('inventory/low-stock')
}

export function getNearExpiryInventory() {
  return request('inventory/near-expiry')
}

export function getOutOfStockInventory() {
  return request('inventory/out-of-stock')
}

export function getMedicineStock(medicineId) {
  return request(replacePathParams('inventory/{medicineId}', { medicineId }))
}

export function getMedicineBatches(medicineId) {
  return request(replacePathParams('inventory/{medicineId}/batches', { medicineId }))
}

export function updateInventoryLevels(medicineId, payload) {
  return request(replacePathParams('inventory/{medicineId}/levels', { medicineId }), {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function adjustInventory(payload) {
  return request('inventory/adjustments', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function getInventoryBatch(batchId) {
  return request(replacePathParams('inventory/batches/{batchId}', { batchId }))
}

export function disposeInventoryBatch(batchId, payload) {
  return request(replacePathParams('inventory/batches/{batchId}/dispose', { batchId }), {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function quarantineInventoryBatch(batchId, payload) {
  return request(replacePathParams('inventory/batches/{batchId}/quarantine', { batchId }), {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function getExpiredInventory() {
  return request('inventory/expired')
}

export function getNearExpiryInventoryDetails() {
  return request('inventory/near-expiry-details')
}

export function getInventorySummary() {
  return request('inventory/summary')
}

export function getInventoryTransactions(params = {}) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, value)
  })
  return request(`inventory/transactions${query.toString() ? `?${query}` : ''}`)
}

export function getInventoryValuation() {
  return request('inventory/valuation')
}

const queryString = (params = {}) => {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, value)
  })
  return query.toString() ? `?${query}` : ''
}

export const listSuppliers = (params = {}) => request(`suppliers${queryString(params)}`)
export const createSupplier = (payload) => request('suppliers', { method: 'POST', body: JSON.stringify(payload) })
export const getSupplier = (id) => request(replacePathParams('suppliers/{id}', { id }))
export const updateSupplier = (id, payload) => request(replacePathParams('suppliers/{id}', { id }), { method: 'PUT', body: JSON.stringify(payload) })
export const deleteSupplier = (id) => request(replacePathParams('suppliers/{id}', { id }), { method: 'DELETE' })
export const getSupplierPurchaseHistory = (id) => request(replacePathParams('suppliers/{id}/purchase-history', { id }))
export const changeSupplierStatus = (id, payload) => request(replacePathParams('suppliers/{id}/status', { id }), { method: 'PATCH', body: JSON.stringify(payload) })

export const listPurchaseOrders = (params = {}) => request(`purchase-orders${queryString(params)}`)
export const createPurchaseOrder = (payload) => request('purchase-orders', { method: 'POST', body: JSON.stringify(payload) })
export const getPurchaseOrder = (id) => request(replacePathParams('purchase-orders/{id}', { id }))
export const receivePurchaseOrder = (id, payload) => request(replacePathParams('purchase-orders/{id}/receive', { id }), { method: 'POST', body: JSON.stringify(payload) })
export const changePurchaseOrderStatus = (id, payload) => request(replacePathParams('purchase-orders/{id}/status', { id }), { method: 'PATCH', body: JSON.stringify(payload) })
export const listPendingPurchaseOrders = () => request('purchase-orders/pending')

export const upsertIntegrationAppointment = (externalAppointmentId, payload) => request(replacePathParams('integration/appointments/{externalAppointmentId}', { externalAppointmentId }), { method: 'PUT', body: JSON.stringify(payload) })
export const upsertIntegrationDoctor = (externalDoctorId, payload) => request(replacePathParams('integration/doctors/{externalDoctorId}', { externalDoctorId }), { method: 'PUT', body: JSON.stringify(payload) })
export const getIntegrationMedicines = (params = {}) => request(`integration/medicines${queryString(params)}`)
export const upsertIntegrationPatient = (externalPatientId, payload) => request(replacePathParams('integration/patients/{externalPatientId}', { externalPatientId }), { method: 'PUT', body: JSON.stringify(payload) })
export const createIntegrationPrescription = (payload) => request('integration/prescriptions', { method: 'POST', body: JSON.stringify(payload) })

export const createDoctorPrescription = (payload) => request('doctor/prescriptions', { method: 'POST', body: JSON.stringify(payload) })
export const getDoctorPrescription = (id) => request(replacePathParams('doctor/prescriptions/{id}', { id }))
export const updateDoctorPrescription = (id, payload) => request(replacePathParams('doctor/prescriptions/{id}', { id }), { method: 'PUT', body: JSON.stringify(payload) })
export const cancelDoctorPrescription = (id, payload = {}) => request(replacePathParams('doctor/prescriptions/{id}/cancel', { id }), { method: 'POST', body: JSON.stringify(payload) })
export const completeDoctorPrescription = (id, payload = {}) => request(replacePathParams('doctor/prescriptions/{id}/complete', { id }), { method: 'POST', body: JSON.stringify(payload) })

export const dispensePrescription = (payload) => request('pharmacy/dispense', { method: 'POST', body: JSON.stringify(payload) })
export const generateBill = (payload) => request('pharmacy/generate-bill', { method: 'POST', body: JSON.stringify(payload) })
export const getInvoice = (billId) => request(replacePathParams('pharmacy/invoice/{billId}', { billId }))
export const recordPayment = (payload) => request('pharmacy/payment', { method: 'POST', body: JSON.stringify(payload) })
export const getPendingPharmacyPrescriptions = () => request('pharmacy/pending')
export const getPharmacyPrescription = (id) => request(replacePathParams('pharmacy/prescriptions/{id}', { id }))
export const getDailySalesReport = (params = {}) => request(`pharmacy/reports/daily-sales${queryString(params)}`)

export const listBills = (params = {}) => request(`pharmacy/bills${queryString(params)}`)
export const getBill = (id) => request(replacePathParams('pharmacy/bills/{id}', { id }))
export const cancelBill = (id, payload = {}) => request(replacePathParams('pharmacy/bills/{id}/cancel', { id }), { method: 'POST', body: JSON.stringify(payload) })
export const refundPayment = (id, payload = {}) => request(replacePathParams('pharmacy/payments/{id}/refund', { id }), { method: 'POST', body: JSON.stringify(payload) })

export const listMedicineReturns = (params = {}) => request(`pharmacy/returns${queryString(params)}`)
export const createMedicineReturn = (payload) => request('pharmacy/returns', { method: 'POST', body: JSON.stringify(payload) })
export const getMedicineReturn = (id) => request(replacePathParams('pharmacy/returns/{id}', { id }))
export const approveMedicineReturn = (id, payload = {}) => request(replacePathParams('pharmacy/returns/{id}/approve', { id }), { method: 'POST', body: JSON.stringify(payload) })
export const cancelMedicineReturn = (id, payload = {}) => request(replacePathParams('pharmacy/returns/{id}/cancel', { id }), { method: 'POST', body: JSON.stringify(payload) })

export const listStockTransfers = (params = {}) => request(`inventory/transfers${queryString(params)}`)
export const createStockTransfer = (payload) => request('inventory/transfers', { method: 'POST', body: JSON.stringify(payload) })
export const getStockTransfer = (id) => request(replacePathParams('inventory/transfers/{id}', { id }))
export const dispatchStockTransfer = (id, payload = {}) => request(replacePathParams('inventory/transfers/{id}/dispatch', { id }), { method: 'POST', body: JSON.stringify(payload) })
export const receiveStockTransfer = (id, payload = {}) => request(replacePathParams('inventory/transfers/{id}/receive', { id }), { method: 'POST', body: JSON.stringify(payload) })
export const changeStockTransferStatus = (id, payload) => request(replacePathParams('inventory/transfers/{id}/status', { id }), { method: 'POST', body: JSON.stringify(payload) })

export const getPharmacyAlerts = () => request('pharmacy/alerts')
export const getPharmacyAuditLogs = (params = {}) => request(`pharmacy/audit-logs${queryString(params)}`)
export const getPharmacyDashboard = () => request('pharmacy/dashboard')
export const getPharmacyPayments = (params = {}) => request(`pharmacy/payments${queryString(params)}`)
export const getPharmacyExpiryReport = () => request('pharmacy/reports/expiry')
export const getPharmacyPurchasesReport = () => request('pharmacy/reports/purchases')
export const getPharmacySalesReport = () => request('pharmacy/reports/sales')
export const getPharmacyStockMovementReport = () => request('pharmacy/reports/stock-movement')
export const getPharmacyStockSummaryReport = () => request('pharmacy/reports/stock-summary')
export const getPharmacyTopSellingReport = () => request('pharmacy/reports/top-selling')

export function getPharmacyAdminAssignmentStatus() {
  return request('pharmacy-admin-auth/assignment-status')
}

export function changePharmacyAdminPassword(payload) {
  const token = sessionStorage.getItem('pharmacyAdminToken') || localStorage.getItem('pharmacyAdminToken')
  return request('pharmacy-admin-auth/change-password', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: JSON.stringify(payload),
  })
}

export function listPharmacists(params = {}) {
  const query = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, value)
  })

  return request(`pharmacy-admin/pharmacists${query.toString() ? `?${query}` : ''}`)
}

export function createPharmacist(payload) {
  return request('pharmacy-admin/pharmacists', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function getPharmacist(id) {
  return request(replacePathParams('pharmacy-admin/pharmacists/{id}', { id }))
}

export function updatePharmacist(id, payload) {
  return request(replacePathParams('pharmacy-admin/pharmacists/{id}', { id }), {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function deletePharmacist(id) {
  return request(replacePathParams('pharmacy-admin/pharmacists/{id}', { id }), {
    method: 'DELETE',
  })
}

export function updatePharmacistPermissions(id, payload) {
  return request(replacePathParams('pharmacy-admin/pharmacists/{id}/permissions', { id }), {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function assignPharmacistToAdminPharmacy(id, payload = {}) {
  return request(replacePathParams('pharmacy-admin/pharmacists/{id}/pharmacy-assignment', { id }), {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function resetPharmacistPassword(id, payload) {
  return request(replacePathParams('pharmacy-admin/pharmacists/{id}/reset-password', { id }), {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function changePharmacistStatus(id, payload) {
  return request(replacePathParams('pharmacy-admin/pharmacists/{id}/status', { id }), {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function upsertIntegrationHospital(externalHospitalId, payload) {
  return request(replacePathParams('integration/hospitals/{externalHospitalId}', { externalHospitalId }), {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function upsertIntegrationBranch(externalHospitalId, externalBranchId, payload) {
  return request(
    replacePathParams('integration/hospitals/{externalHospitalId}/branches/{externalBranchId}', {
      externalHospitalId,
      externalBranchId,
    }),
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
  )
}

export function listIntegrationHospitals() {
  return request('integration/hospitals')
}

export function listIntegrationHospitalBranches(externalHospitalId) {
  return request(replacePathParams('integration/hospitals/{externalHospitalId}/branches', { externalHospitalId }))
}

export function listPharmacyAdmins(params = {}) {
  const query = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, value)
    }
  })

  return request(`pharmacy-super-admin/admins${query.toString() ? `?${query}` : ''}`)
}

export function createPharmacyAdmin(payload) {
  return request('pharmacy-super-admin/admins', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function getPharmacyAdmin(id) {
  return request(replacePathParams('pharmacy-super-admin/admins/{id}', { id }))
}

export function updatePharmacyAdmin(id, payload) {
  return request(replacePathParams('pharmacy-super-admin/admins/{id}', { id }), {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function deletePharmacyAdmin(id) {
  return request(replacePathParams('pharmacy-super-admin/admins/{id}', { id }), {
    method: 'DELETE',
  })
}

export function assignPharmacyAdmin(id, payload) {
  return request(replacePathParams('pharmacy-super-admin/admins/{id}/pharmacy-assignment', { id }), {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function resetPharmacyAdminPassword(id, payload) {
  return request(replacePathParams('pharmacy-super-admin/admins/{id}/reset-password', { id }), {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function changePharmacyAdminStatus(id, payload) {
  return request(replacePathParams('pharmacy-super-admin/admins/{id}/status', { id }), {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function getPharmacySuperAdminDashboard() {
  return request('pharmacy-super-admin/dashboard')
}

export async function listAssignmentHospitals() {
  try {
    return await listIntegrationHospitals()
  } catch {
    return request('pharmacy-super-admin/hospitals')
  }
}

export async function listHospitalBranches(hospitalId) {
  try {
    return await listIntegrationHospitalBranches(hospitalId)
  } catch {
    return request(replacePathParams('pharmacy-super-admin/hospitals/{hospitalId}/branches', { hospitalId }))
  }
}
