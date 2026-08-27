//const DEFAULT_API_BASE_URL = 'https://mop-hyperlink-crank.ngrok-free.dev'
const DEFAULT_API_BASE_URL = ' https://irritant-kilobyte-until.ngrok-free.dev'
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

function authTokenFor(path = '') {
  const cleanPath = String(path || '').replace(/^\/+/, '').replace(/^api\/?/i, '')
  const route = typeof window !== 'undefined' ? window.location.pathname : ''
  const read = (name) => sessionStorage.getItem(name) || localStorage.getItem(name)

  if (cleanPath.startsWith('pharmacy-super-admin') || route.startsWith('/super-admin')) return read('superAdminToken')
  if (cleanPath.startsWith('pharmacy-admin') || route.startsWith('/admin')) return read('pharmacyAdminToken')
  if (cleanPath.startsWith('pharmacist') || cleanPath.startsWith('pharmacy-auth') || route.startsWith('/pharmacist')) return read('pharmacistToken')
  if (cleanPath.startsWith('pharmacy/')) return read('pharmacistToken') || read('pharmacyAdminToken')
  return read('superAdminToken') || read('pharmacyAdminToken') || read('pharmacistToken')
}

async function request(path, options = {}) {
  const token = authTokenFor(path)

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


async function downloadRequest(path, filename) {
  const token = authTokenFor(path)
  const response = await fetch(apiUrl(path), {
    headers: {
      'ngrok-skip-browser-warning': 'true',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  if (!response.ok) {
    const data = response.headers.get('content-type')?.includes('application/json') ? await response.json() : null
    throw new Error(data?.message || data?.error || 'Download failed. Please try again.')
  }
  const blob = await response.blob()
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
  return true
}
export function loginUnifiedAuth(credentials) {
  return request('auth/login', {
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

export function changeSuperAdminPassword(payload) {
  return request('pharmacy-super-admin-auth/change-password', {
    method: 'POST',
    body: JSON.stringify(payload),
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

export function listMedicineStrengths() {
  return request('medicine/strengths')
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
  return request('inventory/adjust', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function adjustInventoryWithReason(payload) {
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
export const updatePurchaseOrder = (id, payload) => request(replacePathParams('purchase-orders/{id}', { id }), { method: 'PUT', body: JSON.stringify(payload) })
export const receivePurchaseOrder = (id, payload) => request(replacePathParams('purchase-orders/{id}/receive', { id }), { method: 'POST', body: JSON.stringify(payload) })
export const changePurchaseOrderStatus = (id, payload) => request(replacePathParams('purchase-orders/{id}/status', { id }), { method: 'PATCH', body: JSON.stringify(payload) })
export const listPendingPurchaseOrders = () => request('purchase-orders/pending')

export const upsertIntegrationAppointment = (externalAppointmentId, payload) => request(replacePathParams('integration/appointments/{externalAppointmentId}', { externalAppointmentId }), { method: 'PUT', body: JSON.stringify(payload) })
export const getIntegrationAppointment = (externalAppointmentId) => request(replacePathParams('integration/appointments/{externalAppointmentId}', { externalAppointmentId }))
export const cancelIntegrationAppointment = (externalAppointmentId, payload = {}) => request(replacePathParams('integration/appointments/{externalAppointmentId}', { externalAppointmentId }), { method: 'DELETE', body: JSON.stringify(payload) })
export const upsertIntegrationDoctor = (externalDoctorId, payload) => request(replacePathParams('integration/doctors/{externalDoctorId}', { externalDoctorId }), { method: 'PUT', body: JSON.stringify(payload) })
export const getIntegrationDoctor = (externalDoctorId) => request(replacePathParams('integration/doctors/{externalDoctorId}', { externalDoctorId }))
export const deleteIntegrationDoctor = (externalDoctorId) => request(replacePathParams('integration/doctors/{externalDoctorId}', { externalDoctorId }), { method: 'DELETE' })
export const getIntegrationMedicines = (params = {}) => request(`integration/medicines${queryString(params)}`)
export const upsertIntegrationPatient = (externalPatientId, payload) => request(replacePathParams('integration/patients/{externalPatientId}', { externalPatientId }), { method: 'PUT', body: JSON.stringify(payload) })
export const getIntegrationPatient = (externalPatientId) => request(replacePathParams('integration/patients/{externalPatientId}', { externalPatientId }))
export const deleteIntegrationPatient = (externalPatientId) => request(replacePathParams('integration/patients/{externalPatientId}', { externalPatientId }), { method: 'DELETE' })
export const createIntegrationPrescription = (payload) => request('integration/prescriptions', { method: 'POST', body: JSON.stringify(payload) })
export const getIntegrationPrescription = (sourceSystem, externalPrescriptionId) => request(replacePathParams('integration/prescriptions/{sourceSystem}/{externalPrescriptionId}', { sourceSystem, externalPrescriptionId }))
export const updateIntegrationPrescription = (sourceSystem, externalPrescriptionId, payload) => request(replacePathParams('integration/prescriptions/{sourceSystem}/{externalPrescriptionId}', { sourceSystem, externalPrescriptionId }), { method: 'PUT', body: JSON.stringify(payload) })
export const cancelIntegrationPrescription = (sourceSystem, externalPrescriptionId, payload = {}) => request(replacePathParams('integration/prescriptions/{sourceSystem}/{externalPrescriptionId}', { sourceSystem, externalPrescriptionId }), { method: 'DELETE', body: JSON.stringify(payload) })
export const getIntegrationPrescriptionStatus = (sourceSystem, externalPrescriptionId) => request(replacePathParams('integration/prescriptions/{sourceSystem}/{externalPrescriptionId}/status', { sourceSystem, externalPrescriptionId }))

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
export const getPharmacyAdminDashboard = () => request('pharmacy-admin/dashboard')
export const getPharmacistDashboard = () => request('pharmacist/dashboard')
export const getPharmacistInventory = (params = {}) => request(`pharmacist/inventory${queryString(params)}`)
export const getPharmacistInventoryBatches = (medicineId) => request(replacePathParams('pharmacist/inventory/{medicineId}/batches', { medicineId }))
export const getPharmacistInventoryAlerts = () => request('pharmacist/inventory/alerts')

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

export function getPharmacistPermissions(id) {
  return request(replacePathParams('pharmacy-admin/pharmacists/{id}/permissions', { id }))
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

export function getIntegrationHospital(externalHospitalId) {
  return request(replacePathParams('integration/hospitals/{externalHospitalId}', { externalHospitalId }))
}

export function deleteIntegrationHospital(externalHospitalId) {
  return request(replacePathParams('integration/hospitals/{externalHospitalId}', { externalHospitalId }), { method: 'DELETE' })
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

export function getIntegrationHospitalBranch(externalHospitalId, externalBranchId) {
  return request(replacePathParams('integration/hospitals/{externalHospitalId}/branches/{externalBranchId}', {
    externalHospitalId,
    externalBranchId,
  }))
}

export function deleteIntegrationHospitalBranch(externalHospitalId, externalBranchId) {
  return request(replacePathParams('integration/hospitals/{externalHospitalId}/branches/{externalBranchId}', {
    externalHospitalId,
    externalBranchId,
  }), { method: 'DELETE' })
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

export function getPharmacySuperAdminDashboardAnalytics() {
  return request('pharmacy-super-admin/dashboard/analytics')
}

export function getPharmacySuperAdminDashboardExpiryAlerts() {
  return request('pharmacy-super-admin/dashboard/expiry-alerts')
}

export function getPharmacySuperAdminDashboardLowStock() {
  return request('pharmacy-super-admin/dashboard/low-stock')
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

export function getPharmacySettings() {
  return request('pharmacy/settings')
}

export function updatePharmacySettings(payload) {
  return request('pharmacy/settings', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function getPharmacyCmsOptions(params = {}) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, value)
  })
  return request(`pharmacy/settings/cms-options${query.toString() ? `?${query}` : ''}`)
}

export function updatePharmacyCmsIntegration(payload) {
  return request('pharmacy/settings/cms-integration', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function createManualPharmacyPrescription(payload) {
  return request('pharmacy/prescriptions/manual', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
export const getPharmacyAdminAuthPermissions = () => request('pharmacy-admin-auth/permissions')
export const getSuperAdminProfile = () => request('pharmacy-super-admin-auth/profile')
export const getPharmacyPrescriptions = (params = {}) => request(`pharmacy/prescriptions${queryString(params)}`)
export const getPharmacyDispensingOverview = (params = {}) => request(`pharmacy/dispensing${queryString(params)}`)
export const getSuperAdminAuditLogs = (params = {}) => request(`pharmacy-super-admin/audit-logs${queryString(params)}`)
export const getSuperAdminAuditLogSummary = () => request('pharmacy-super-admin/audit-logs/summary')
export const getSuperAdminBranches = (params = {}) => request(`pharmacy-super-admin/branches${queryString(params)}`)
export const changeSuperAdminBranchStatus = (id, payload) => request(replacePathParams('pharmacy-super-admin/branches/{id}/status', { id }), { method: 'PATCH', body: JSON.stringify(payload) })
export const changeSuperAdminHospitalStatus = (id, payload) => request(replacePathParams('pharmacy-super-admin/hospitals/{id}/status', { id }), { method: 'PATCH', body: JSON.stringify(payload) })
export const getSuperAdminMedicines = (params = {}) => request(`pharmacy-super-admin/medicines${queryString(params)}`)
export const changeSuperAdminMedicineStatus = (id, payload) => request(replacePathParams('pharmacy-super-admin/medicines/{id}/status', { id }), { method: 'PATCH', body: JSON.stringify(payload) })
export const getSuperAdminRevenueReport = (params = {}) => request(`pharmacy-super-admin/reports/revenue${queryString(params)}`)
export const exportSuperAdminRevenueExcel = (params = {}) => downloadRequest(`pharmacy-super-admin/reports/revenue/export-excel${queryString(params)}`, 'revenue-report.xlsx')
export const exportSuperAdminRevenuePdf = (params = {}) => downloadRequest(`pharmacy-super-admin/reports/revenue/export-pdf${queryString(params)}`, 'revenue-report.pdf')
export const getSuperAdminSettings = () => request('pharmacy-super-admin/settings')
export const updateSuperAdminSettings = (payload) => request('pharmacy-super-admin/settings', { method: 'PUT', body: JSON.stringify(payload) })
export const listSuperAdminRoles = (params = {}) => request(`pharmacy-super-admin/roles${queryString(params)}`)
export const createSuperAdminRole = (payload) => request('pharmacy-super-admin/roles', { method: 'POST', body: JSON.stringify(payload) })
export const updateSuperAdminRole = (id, payload) => request(replacePathParams('pharmacy-super-admin/roles/{id}', { id }), { method: 'PUT', body: JSON.stringify(payload) })
export const deleteSuperAdminRole = (id) => request(replacePathParams('pharmacy-super-admin/roles/{id}', { id }), { method: 'DELETE' })
export const getSuperAdminRolePermissions = (roleId) => request(replacePathParams('pharmacy-super-admin/roles/{roleId}/permissions', { roleId }))
export const updateSuperAdminRolePermissions = (roleId, payload) => request(replacePathParams('pharmacy-super-admin/roles/{roleId}/permissions', { roleId }), { method: 'PUT', body: JSON.stringify(payload) })
export const listSuperAdminRoleDropdown = () => request('pharmacy-super-admin/roles/dropdown')
export const getPharmacyAdminRole = (adminId) => request(replacePathParams('pharmacy-super-admin/admins/{adminId}/role', { adminId }))
export const assignPharmacyAdminRole = (adminId, payload) => request(replacePathParams('pharmacy-super-admin/admins/{adminId}/role', { adminId }), { method: 'PUT', body: JSON.stringify(payload) })
export const listSuperAdminNotifications = (params = {}) => request(`pharmacy-super-admin/notifications${queryString(params)}`)
export const sendSuperAdminNotification = (payload) => request('pharmacy-super-admin/notifications', { method: 'POST', body: JSON.stringify(payload) })
export const deleteSuperAdminNotification = (id) => request(replacePathParams('pharmacy-super-admin/notifications/{id}', { id }), { method: 'DELETE' })
export const markSuperAdminNotificationRead = (id) => request(replacePathParams('pharmacy-super-admin/notifications/{id}/read', { id }), { method: 'PATCH' })
export const markAllSuperAdminNotificationsRead = () => request('pharmacy-super-admin/notifications/mark-all-read', { method: 'PATCH' })