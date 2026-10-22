const DEFAULT_API_BASE_URL = 'https://jackpot-citrus-compare.ngrok-free.dev';
//const DEFAULT_API_BASE_URL = ' https://irritant-kilobyte-until.ngrok-free.dev'
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

const REQUEST_TIMEOUT_MS = 45000

const tokenKeysByRole = {
  superAdmin: 'superAdminToken',
  pharmacyAdmin: 'pharmacyAdminToken',
  pharmacist: 'pharmacistToken',
}

function readStoredToken(name) {
  return sessionStorage.getItem(name) || localStorage.getItem(name)
}

function readStoredJson(name) {
  try {
    const raw = sessionStorage.getItem(name) || localStorage.getItem(name)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function getTenantScope() {
  const pharmacist = readStoredJson('pharmacistUser') || {}
  const pharmacistAssignment = readStoredJson('pharmacistAssignment') || {}
  if (pharmacist && (pharmacist.id || pharmacist.email || pharmacist.pharmacyId)) {
    const pScope = pharmacist.pharmacyId || pharmacistAssignment.pharmacyId || pharmacist.id || pharmacist.email
    return `pharma_${String(pScope).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_')}`
  }

  const user = readStoredJson('pharmacyAdminUser') || {}
  const assignment = readStoredJson('pharmacyAdminAssignment') || {}
  const pendingAuth = readStoredJson('__pms_admin_pending_auth') || {}

  const scopeVal =
    user.adminId ||
    user.id ||
    user._id ||
    user.userId ||
    user.email ||
    pendingAuth.email ||
    assignment.adminId ||
    assignment.pharmacyId ||
    'default'

  return `admin_${String(scopeVal).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_')}`
}

export function scopedKey(baseKey) {
  const scope = getTenantScope()
  return `${baseKey}_${scope}`
}

export function pharmacyTenantContext() {
  const assignment = readStoredJson('pharmacyAdminAssignment') || {}
  const user = readStoredJson('pharmacyAdminUser') || {}
  // Also read pharmacist-specific storage so tenant headers work for pharmacist logins
  const pharmAssignment = readStoredJson('pharmacistAssignment') || {}
  const pharmUser = readStoredJson('pharmacistUser') || {}
  const storedWorkingBranchId = (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('workingBranchId') : null) || (typeof localStorage !== 'undefined' ? localStorage.getItem('workingBranchId') : null) || ''
  const storedWorkingPharmacyId = (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('workingPharmacyId') : null) || (typeof localStorage !== 'undefined' ? localStorage.getItem('workingPharmacyId') : null) || ''

  const pharmacyId = storedWorkingPharmacyId || assignment.pharmacyId || assignment.PharmacyId || assignment.pharmacy?.id || assignment.pharmacy?.pharmacyId || user.pharmacyId || user.PharmacyId || user.pharmacy?.id || user.pharmacy?.pharmacyId || pharmAssignment.pharmacyId || pharmAssignment.PharmacyId || pharmAssignment.pharmacy?.id || pharmAssignment.pharmacy?.pharmacyId || pharmUser.pharmacyId || pharmUser.PharmacyId || pharmUser.pharmacy?.id || pharmUser.pharmacy?.pharmacyId || ''
  const branchId = storedWorkingBranchId || assignment.branchId || assignment.BranchId || assignment.mainBranchId || assignment.MainBranchId || assignment.branch?.id || assignment.branch?.branchId || user.branchId || user.BranchId || user.mainBranchId || user.MainBranchId || user.branch?.id || user.branch?.branchId || pharmAssignment.branchId || pharmAssignment.BranchId || pharmAssignment.mainBranchId || pharmAssignment.branch?.id || pharmAssignment.branch?.branchId || pharmUser.branchId || pharmUser.BranchId || pharmUser.mainBranchId || pharmUser.branch?.id || pharmUser.branch?.branchId || ''
  // Only use explicit CMS hospital IDs — do NOT fall back to pharmacyId/branchId,
  // because that causes backend CMS integration errors for non-CMS setups.
  const hospitalId = assignment.hospitalId || assignment.HospitalId || assignment.cmsHospitalId || assignment.CmsHospitalId || assignment.pharmacy?.hospitalId || assignment.pharmacy?.HospitalId || user.hospitalId || user.HospitalId || user.cmsHospitalId || user.CmsHospitalId || user.pharmacy?.hospitalId || user.pharmacy?.HospitalId || pharmAssignment.hospitalId || pharmAssignment.HospitalId || pharmUser.hospitalId || pharmUser.HospitalId || ''
  const cmsBranchId = assignment.cmsBranchId || assignment.CmsBranchId || assignment.hospitalBranchId || assignment.HospitalBranchId || user.cmsBranchId || user.CmsBranchId || user.hospitalBranchId || user.HospitalBranchId || pharmAssignment.cmsBranchId || pharmAssignment.CmsBranchId || pharmUser.cmsBranchId || pharmUser.CmsBranchId || ''
  return { pharmacyId, branchId, hospitalId, cmsBranchId }
}

function pharmacyTenantHeaders(path = '', authRole = '') {
  const cleanPath = String(path || '').replace(/^\/+/, '').replace(/^api\/?/i, '')
  const route = typeof window !== 'undefined' ? window.location.pathname : ''
  const isInventoryRoute = [
    '/admin',
    '/inventory',
    '/low-stock',
    '/near-expiry',
    '/out-of-stock',
    '/stock-summary',
    '/transactions',
    '/valuation',
    '/expired',
  ].some((prefix) => route.startsWith(prefix))
  const isPharmacyAdminRequest = authRole === 'pharmacyAdmin' || isInventoryRoute || cleanPath.startsWith('pharmacy-admin') || cleanPath.startsWith('medicine') || cleanPath.startsWith('inventory') || cleanPath.startsWith('pharmacy/')
  if (!isPharmacyAdminRequest) return {}

  const { pharmacyId, branchId, hospitalId, cmsBranchId } = pharmacyTenantContext()
  return {
    ...(pharmacyId ? { 'X-Pharmacy-Id': String(pharmacyId), 'x-pharmacy-id': String(pharmacyId), PharmacyId: String(pharmacyId) } : {}),
    ...(branchId ? { 'X-Branch-Id': String(branchId), 'x-branch-id': String(branchId), BranchId: String(branchId) } : {}),
    ...(hospitalId ? { 'X-Hospital-Id': String(hospitalId), 'x-hospital-id': String(hospitalId), HospitalId: String(hospitalId), CmsHospitalId: String(hospitalId) } : {}),
    ...(cmsBranchId ? { 'X-Cms-Branch-Id': String(cmsBranchId), 'x-cms-branch-id': String(cmsBranchId), CmsBranchId: String(cmsBranchId) } : {}),
  }
}

function authTokenFor(path = '', authRole = '') {
  const cleanPath = String(path || '').replace(/^\/+/, '').replace(/^api\/?/i, '')
  const route = typeof window !== 'undefined' ? window.location.pathname : ''

  if (authRole && tokenKeysByRole[authRole]) {
    const roleToken = readStoredToken(tokenKeysByRole[authRole])
    if (roleToken) return roleToken
  }
  if (cleanPath.startsWith('pharmacy-super-admin')) {
    return readStoredToken('superAdminToken') || readStoredToken('pharmacyAdminToken') || readStoredToken('pharmacistToken')
  }
  if (cleanPath.startsWith('pharmacy-admin-auth') || cleanPath.startsWith('pharmacy-admin')) {
    return readStoredToken('pharmacyAdminToken') || readStoredToken('superAdminToken') || readStoredToken('pharmacistToken')
  }
  if (cleanPath.startsWith('pharmacist') || cleanPath.startsWith('pharmacy-auth')) {
    return readStoredToken('pharmacistToken') || readStoredToken('pharmacyAdminToken') || readStoredToken('superAdminToken')
  }
  if (cleanPath.startsWith('pharmacy/')) {
    if (route.startsWith('/pharmacist')) return readStoredToken('pharmacistToken')
    if (route.startsWith('/admin')) return readStoredToken('pharmacyAdminToken')
    return readStoredToken('pharmacistToken') || readStoredToken('pharmacyAdminToken') || readStoredToken('superAdminToken')
  }
  const isInventoryRoute = [
    '/admin',
    '/inventory',
    '/low-stock',
    '/near-expiry',
    '/out-of-stock',
    '/stock-summary',
    '/transactions',
    '/valuation',
    '/expired',
  ].some((prefix) => route.startsWith(prefix))

  if (route.startsWith('/super-admin')) return readStoredToken('superAdminToken') || readStoredToken('pharmacyAdminToken')
  if (isInventoryRoute || cleanPath.startsWith('inventory') || cleanPath.startsWith('medicine')) {
    return readStoredToken('pharmacyAdminToken') || readStoredToken('pharmacistToken') || readStoredToken('superAdminToken')
  }
  if (route.startsWith('/pharmacist')) return readStoredToken('pharmacistToken') || readStoredToken('pharmacyAdminToken')
  return readStoredToken('pharmacyAdminToken') || readStoredToken('pharmacistToken') || readStoredToken('superAdminToken')
}


const specialPayloadKeys = {
  gst: 'GST',
  otp: 'Otp',
  apiKey: 'ApiKey',
  apiSecret: 'ApiSecret',
  smsApiKey: 'SmsApiKey',
  smsApiSecret: 'SmsApiSecret',
}

function toApiKey(key) {
  if (specialPayloadKeys[key]) return specialPayloadKeys[key]
  return key ? `${key.charAt(0).toUpperCase()}${key.slice(1)}` : key
}

function apiPayload(value) {
  if (Array.isArray(value)) return value.map(apiPayload)
  if (!value || typeof value !== 'object' || value instanceof Date || (typeof FormData !== 'undefined' && value instanceof FormData)) return value
  return Object.entries(value).reduce((payload, [key, item]) => {
    payload[key] = apiPayload(item)
    payload[toApiKey(key)] = apiPayload(item)
    return payload
  }, {})
}

function superAdminStatusPayload(payload = {}) {
  const value = payload.IsActive ?? payload.isActive ?? (payload.status !== undefined ? String(payload.status).toLowerCase() === 'active' : undefined)
  return value === undefined ? payload : { ...payload, isActive: value, IsActive: value }
}

function passwordResetPayload(payload = {}) {
  const value = payload.NewPassword ?? payload.newPassword ?? payload.temporaryPassword ?? payload.password
  return value === undefined ? payload : { ...payload, newPassword: value, NewPassword: value }
}
async function request(path, options = {}) {
  const { authRole, signal, headers: customHeaders, ...fetchOptions } = options
  const token = authTokenFor(path, authRole)

  const isFormData = typeof FormData !== 'undefined' && fetchOptions.body instanceof FormData
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  if (signal) {
    if (signal.aborted) controller.abort()
    else signal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  const mergedHeaders = {
    'ngrok-skip-browser-warning': 'true',
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    Accept: 'application/json, text/plain, */*',
    ...(token ? { Authorization: 'Bearer ' + token } : {}),
    ...pharmacyTenantHeaders(path, authRole),
    ...(customHeaders || {}),
  }

  let response
  try {
    response = await fetch(apiUrl(path), {
      ...fetchOptions,
      headers: mergedHeaders,
      signal: controller.signal,
    })
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('API request timed out. Please check that the backend server or ngrok tunnel is running.')
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }

  const contentType = response.headers.get('content-type') || ''
  let data = null
  if (contentType.includes('json')) {
    try {
      data = await response.json()
    } catch {
      data = null
    }
  } else {
    try {
      const text = await response.text()
      if (text) {
        try {
          data = JSON.parse(text)
        } catch {
          data = { message: text }
        }
      }
    } catch {
      data = null
    }
  }

  if (!response.ok) {
    let errorMsg =
      data?.message ||
      data?.Message ||
      data?.errorMessage ||
      data?.ErrorMessage ||
      data?.error ||
      data?.Error ||
      data?.detail ||
      data?.Detail ||
      data?.description ||
      data?.Description
    if (!errorMsg && data?.errors && typeof data.errors === 'object') {
      const validationMsgs = Object.values(data.errors)
        .flat()
        .filter((msg) => typeof msg === 'string' && msg.trim())
      if (validationMsgs.length) errorMsg = validationMsgs.join(' ')
    }
    if (!errorMsg) {
      errorMsg = data?.title || data?.Title || response.statusText || 'Request failed. Please try again.'
    }
    const error = new Error(errorMsg)
    error.status = response.status
    error.data = data
    throw error
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
    body: JSON.stringify(apiPayload(credentials)),
  })
}


export function logoutSuperAdmin(token) {
  return request('pharmacy-super-admin-auth/logout', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
}

function cleanChangePasswordPayload(payload = {}) {
  return {
    currentPassword: String(payload.currentPassword ?? payload.CurrentPassword ?? '').trim(),
    newPassword: String(payload.newPassword ?? payload.NewPassword ?? '').trim(),
  }
}

export function changeSuperAdminPassword(payload) {
  return request('pharmacy-super-admin-auth/change-password', {
    authRole: 'superAdmin',
    method: 'POST',
    body: JSON.stringify(cleanChangePasswordPayload(payload)),
  })
}

export function forgotSuperAdminPassword(payload) {
  return request('pharmacy-auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify(apiPayload(payload)),
  })
}

export function verifySuperAdminResetOtp(payload) {
  return request('pharmacy-auth/verify-reset-otp', {
    method: 'POST',
    body: JSON.stringify(apiPayload(payload)),
  })
}

export function resetForgottenSuperAdminPassword(payload) {
  return request('pharmacy-auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(apiPayload(payload)),
  })
}


export function logoutPharmacyAdmin(token) {
  return request('pharmacy-admin-auth/logout', {
    authRole: 'pharmacyAdmin',
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
}

export function forgotPharmacyAdminPassword(payload) {
  return request('pharmacy-auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify(apiPayload(payload)),
  })
}

export function verifyPharmacyAdminResetOtp(payload) {
  return request('pharmacy-auth/verify-reset-otp', {
    method: 'POST',
    body: JSON.stringify(apiPayload(payload)),
  })
}

export function resetForgottenPharmacyAdminPassword(payload) {
  return request('pharmacy-auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(apiPayload(payload)),
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
    authRole: 'pharmacist',
    method: 'POST',
    body: JSON.stringify(cleanChangePasswordPayload(payload)),
  })
}

export function forgotPharmacistPassword(payload) {
  return request('pharmacy-auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify(apiPayload(payload)),
  })
}

export function verifyPharmacistResetOtp(payload) {
  return request('pharmacy-auth/verify-reset-otp', {
    method: 'POST',
    body: JSON.stringify(apiPayload(payload)),
  })
}

export function resetForgottenPharmacistPassword(payload) {
  return request('pharmacy-auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(apiPayload(payload)),
  })
}

const MEDICINE_CACHE_KEY = 'pms_medicine_catalogue_cache'
const LOCAL_MEDICINES_KEY = 'pms_local_medicines'
const DELETED_MEDICINES_KEY = 'pms_deleted_medicines'
const LEGACY_OWNER_KEY = 'pms_legacy_data_owner'

export function migrateLegacyCache(baseKey, scopedTarget) {
  try {
    const legacy = localStorage.getItem(baseKey)
    if (legacy && !localStorage.getItem(scopedTarget)) {
      const owner = localStorage.getItem(LEGACY_OWNER_KEY)
      const currentScope = getTenantScope()
      if (!owner || owner === currentScope) {
        localStorage.setItem(LEGACY_OWNER_KEY, currentScope)
        localStorage.setItem(scopedTarget, legacy)
      }
    }
  } catch {}
}

export function readLocalMedicines() {
  try {
    const key = scopedKey(LOCAL_MEDICINES_KEY)
    migrateLegacyCache(LOCAL_MEDICINES_KEY, key)
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function writeLocalMedicines(items) {
  try {
    const key = scopedKey(LOCAL_MEDICINES_KEY)
    localStorage.setItem(key, JSON.stringify(items || []))
  } catch {
    // ignore storage errors
  }
}

export function readDeletedMedicineIds() {
  try {
    const key = scopedKey(DELETED_MEDICINES_KEY)
    migrateLegacyCache(DELETED_MEDICINES_KEY, key)
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveDeletedMedicineIds(ids) {
  try {
    const key = scopedKey(DELETED_MEDICINES_KEY)
    localStorage.setItem(key, JSON.stringify(ids || []))
  } catch {
    // ignore storage errors
  }
}

function readMedicineCache() {
  try {
    const key = scopedKey(MEDICINE_CACHE_KEY)
    migrateLegacyCache(MEDICINE_CACHE_KEY, key)
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function writeMedicineCache(cache) {
  try {
    const key = scopedKey(MEDICINE_CACHE_KEY)
    localStorage.setItem(key, JSON.stringify(cache))
  } catch {
    // ignore storage errors
  }
}

function medicineCacheKeys(item = {}) {
  const keys = []
  const id = item?._id || item?.id || item?.medicineId || item?.uuid || item?.Id || item?.MedicineId
  const code = item?.medicineCode || item?.code || item?.MedicineCode || item?.Code
  const name = item?.name || item?.medicineName || item?.Name || item?.MedicineName
  const generic = item?.genericName || item?.GenericName

  if (id) keys.push(`id:${String(id).trim().toLowerCase()}`)
  if (code) keys.push(`code:${String(code).trim().toLowerCase()}`)
  if (name) keys.push(`name:${String(name).trim().toLowerCase()}`)
  if (generic) keys.push(`generic:${String(generic).trim().toLowerCase()}`)
  return keys
}

function saveMedicineToCache(payload = {}, responseData = null) {
  const merged = {
    ...(payload || {}),
    ...(responseData?.data || responseData?.medicine || responseData || {}),
  }
  const keys = [...new Set([...medicineCacheKeys(payload), ...medicineCacheKeys(merged)])]
  if (!keys.length) return

  const sellingPriceVal = payload?.sellingPrice ?? payload?.price ?? payload?.mrp ?? payload?.unitPrice
  const purchasePriceVal = payload?.purchasePrice ?? payload?.costPrice
  const stockVal = payload?.initialStockCount ?? payload?.stock ?? payload?.stockQuantity ?? payload?.currentStock ?? payload?.quantity
  const minStockVal = payload?.minimumStockThreshold ?? payload?.minStock ?? payload?.minimumStock
  const maxStockVal = payload?.maximumStock ?? payload?.maxStock
  const reorderVal = payload?.reorderStockLevel ?? payload?.reorderLevel

  const entry = {
    ...(sellingPriceVal !== undefined && sellingPriceVal !== '' ? { sellingPrice: Number(sellingPriceVal) } : {}),
    ...(purchasePriceVal !== undefined && purchasePriceVal !== '' ? { purchasePrice: Number(purchasePriceVal) } : {}),
    ...(stockVal !== undefined && stockVal !== '' ? { stock: Number(stockVal) } : {}),
    ...(minStockVal !== undefined && minStockVal !== '' ? { minStock: Number(minStockVal) } : {}),
    ...(maxStockVal !== undefined && maxStockVal !== '' ? { maxStock: Number(maxStockVal) } : {}),
    ...(reorderVal !== undefined && reorderVal !== '' ? { reorderLevel: Number(reorderVal) } : {}),
    ...(payload?.gst !== undefined && payload?.gst !== '' ? { gst: Number(payload.gst) } : {}),
    ...(payload?.expiryDate ? { expiryDate: payload.expiryDate } : {}),
    ...(payload?.unit ? { unit: payload.unit } : {}),
    ...(payload?.packSize ? { packSize: payload.packSize } : {}),
    ...(payload?.strength ? { strength: payload.strength } : {}),
    ...(payload?.manufacturer ? { manufacturer: payload.manufacturer } : {}),
    ...(payload?.brandName ? { brandName: payload.brandName } : {}),
    ...(payload?.medicineCode || payload?.code ? { code: payload.medicineCode || payload.code } : {}),
    ...(payload?.status ? { status: payload.status } : {}),
    ...(payload?.prescriptionRequired !== undefined ? { prescriptionRequired: payload.prescriptionRequired } : {}),
    ...(payload?.notes || payload?.description ? { notes: payload.notes || payload.description } : {}),
  }

  const cache = readMedicineCache()
  keys.forEach((key) => {
    cache[key] = { ...(cache[key] || {}), ...entry }
  })
  writeMedicineCache(cache)
}

export function normalizeMedicineRecord(item) {
  if (!item || typeof item !== 'object') return item
  const cache = readMedicineCache()
  const cached = medicineCacheKeys(item).map((k) => cache[k]).find(Boolean) || {}

  const rawPriceCandidates = [
    item?.sellingPrice,
    item?.SellingPrice,
    item?.price,
    item?.Price,
    item?.mrp,
    item?.MRP,
    item?.unitPrice,
    item?.UnitPrice,
    cached?.sellingPrice,
  ]
  let resolvedPrice = 0
  for (const candidate of rawPriceCandidates) {
    const num = Number(candidate)
    if (candidate !== undefined && candidate !== null && candidate !== '' && !isNaN(num) && num > 0) {
      resolvedPrice = num
      break
    }
  }

  const rawStockCandidates = [
    item?.stock,
    item?.Stock,
    item?.stockQuantity,
    item?.StockQuantity,
    item?.initialStockCount,
    item?.InitialStockCount,
    item?.currentStock,
    item?.CurrentStock,
    item?.totalStock,
    item?.TotalStock,
    item?.availableStock,
    item?.AvailableStock,
    item?.quantity,
    item?.Quantity,
    item?.qty,
  ]
  let resolvedStock = null
  for (const candidate of rawStockCandidates) {
    const num = Number(candidate)
    if (candidate !== undefined && candidate !== null && candidate !== '' && !isNaN(num) && num > 0) {
      resolvedStock = num
      break
    }
  }
  if (resolvedStock === null && cached?.stock !== undefined && cached?.stock !== null && !isNaN(Number(cached.stock))) {
    resolvedStock = Number(cached.stock)
  }
  if ((resolvedStock === null || resolvedStock === 0) && cached?.stock === undefined) {
    const unitMatch = String(item?.unit || item?.Unit || '').trim().match(/^(\d+)\s*(units?|tablets?|capsules?|strips?|bottles?|vials?|packs?)?$/i)
    if (unitMatch && Number(unitMatch[1]) > 0) {
      resolvedStock = Number(unitMatch[1])
    }
  }
  if (resolvedStock === null) {
    resolvedStock = 0
  }

  const resolvedPurchasePrice = Number(
    item?.purchasePrice ?? item?.PurchasePrice ?? item?.costPrice ?? item?.CostPrice ?? cached?.purchasePrice ?? 0
  ) || 0
  const resolvedMinStock = Number(
    item?.minStock ?? item?.MinStock ?? item?.minimumStock ?? item?.MinimumStock ?? item?.minimumStockThreshold ?? item?.MinimumStockThreshold ?? cached?.minStock ?? 10
  )
  const resolvedReorder = Number(
    item?.reorderLevel ?? item?.ReorderLevel ?? item?.reorderStockLevel ?? item?.ReorderStockLevel ?? cached?.reorderLevel ?? 5
  )

  return {
    ...item,
    name: item?.name || item?.Name || item?.medicineName || item?.MedicineName || item?.genericName || item?.GenericName || '',
    medicineName: item?.medicineName || item?.MedicineName || item?.name || item?.Name || item?.genericName || item?.GenericName || '',
    genericName: item?.genericName || item?.GenericName || item?.name || item?.Name || '',
    code: item?.code || item?.Code || item?.medicineCode || item?.MedicineCode || cached?.code || '',
    medicineCode: item?.medicineCode || item?.MedicineCode || item?.code || item?.Code || cached?.code || '',
    brandName: item?.brandName || item?.BrandName || cached?.brandName || '',
    category: item?.category || item?.Category || item?.categoryName || item?.CategoryName || 'General',
    dosageForm: item?.dosageForm || item?.DosageForm || item?.form || item?.Form || 'Tablet',
    strength: item?.strength || item?.Strength || cached?.strength || '',
    unit: item?.unit || item?.Unit || cached?.unit || '',
    packSize: item?.packSize || item?.PackSize || cached?.packSize || '',
    manufacturer: item?.manufacturer || item?.Manufacturer || cached?.manufacturer || '',
    sellingPrice: resolvedPrice,
    price: resolvedPrice,
    mrp: resolvedPrice,
    purchasePrice: resolvedPurchasePrice,
    stock: resolvedStock,
    stockQuantity: resolvedStock,
    initialStockCount: resolvedStock,
    currentStock: resolvedStock,
    quantity: resolvedStock,
    minStock: !isNaN(resolvedMinStock) ? resolvedMinStock : 10,
    minimumStock: !isNaN(resolvedMinStock) ? resolvedMinStock : 10,
    reorderLevel: !isNaN(resolvedReorder) ? resolvedReorder : 5,
    expiryDate: item?.expiryDate || item?.ExpiryDate || cached?.expiryDate || null,
    gst: item?.gst ?? item?.GST ?? cached?.gst ?? 0,
    notes: item?.notes || item?.Notes || item?.description || item?.Description || cached?.notes || '',
  }
}

function normalizeMedicineResponse(response) {
  if (Array.isArray(response)) return response.map(normalizeMedicineRecord)
  if (!response || typeof response !== 'object') return response
  const next = { ...response }
  if (Array.isArray(next.data)) {
    next.data = next.data.map(normalizeMedicineRecord)
  } else if (next.data && typeof next.data === 'object') {
    next.data = { ...next.data }
    ;['medicines', 'Medicines', 'items', 'Items', 'results', 'Results', 'records', 'Records'].forEach((k) => {
      if (Array.isArray(next.data[k])) next.data[k] = next.data[k].map(normalizeMedicineRecord)
    })
  }
  ;['medicines', 'Medicines', 'items', 'Items', 'results', 'Results', 'records', 'Records'].forEach((k) => {
    if (Array.isArray(next[k])) next[k] = next[k].map(normalizeMedicineRecord)
  })
  return next
}

export async function listMedicines(params = {}) {
  const query = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, value)
  })

  let backendList = []
  try {
    const response = await request(`medicine${query.toString() ? `?${query}` : ''}`)
    const normalized = normalizeMedicineResponse(response)
    if (Array.isArray(normalized)) {
      backendList = normalized
    } else if (Array.isArray(normalized?.data)) {
      backendList = normalized.data
    } else if (Array.isArray(normalized?.Data)) {
      backendList = normalized.Data
    } else if (Array.isArray(normalized?.medicines)) {
      backendList = normalized.medicines
    } else if (Array.isArray(normalized?.Medicines)) {
      backendList = normalized.Medicines
    } else if (Array.isArray(normalized?.items)) {
      backendList = normalized.items
    }
  } catch (error) {
    console.warn('Backend listMedicines failed, using local medicines:', error.message)
  }

  const localItems = readLocalMedicines()
  const deletedIds = readDeletedMedicineIds().map(String)

  const combined = []
  const seenKeys = new Set()

  // First include local items (newest additions / updates)
  for (const item of localItems) {
    const id = String(item?.id || item?._id || item?.medicineId || '')
    if (id && deletedIds.includes(id)) continue
    const key = (item?.code || item?.medicineCode || item?.name || item?.medicineName || id).trim().toLowerCase()
    if (!seenKeys.has(key)) {
      seenKeys.add(key)
      if (id) seenKeys.add(id)
      combined.push(normalizeMedicineRecord(item))
    }
  }

  // Then include backend items if not deleted or already in local list
  for (const item of backendList) {
    const id = String(item?.id || item?._id || item?.medicineId || '')
    if (id && deletedIds.includes(id)) continue
    const key = (item?.code || item?.medicineCode || item?.name || item?.medicineName || id).trim().toLowerCase()
    if (!seenKeys.has(key) && !seenKeys.has(id)) {
      seenKeys.add(key)
      if (id) seenKeys.add(id)
      combined.push(normalizeMedicineRecord(item))
    }
  }

  // Cache combined list so other pages (like Stock/Inventory) have immediate access
  if (combined.length > 0) {
    writeLocalMedicines(combined)
  }

  return combined
}

export async function createMedicine(payload) {
  const newId = payload?.id || payload?._id || payload?.medicineId || `med_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
  const initialRecord = normalizeMedicineRecord({
    id: newId,
    _id: newId,
    medicineId: newId,
    createdAt: new Date().toISOString(),
    ...payload,
  })

  // Prepend to local medicines immediately
  const currentLocal = readLocalMedicines()
  const pName = (payload.name || payload.medicineName || '').toLowerCase().trim()
  const pCode = (payload.code || payload.medicineCode || '').toLowerCase().trim()

  const filtered = currentLocal.filter((m) => {
    const mId = String(m?.id || m?._id || m?.medicineId || '')
    const mName = (m.name || m.medicineName || '').toLowerCase().trim()
    const mCode = (m.code || m.medicineCode || '').toLowerCase().trim()
    if (mId === String(newId)) return false
    if (pCode && mCode && pCode === mCode) return false
    if (pName && mName && pName === mName) return false
    return true
  })
  writeLocalMedicines([initialRecord, ...filtered])
  saveMedicineToCache(payload, initialRecord)

  try {
    const response = await request('medicine', {
      method: 'POST',
      body: JSON.stringify(apiPayload(payload)),
    })
    const backendData = response?.data || response?.medicine || response
    if (backendData && typeof backendData === 'object') {
      const backendId = backendData.id || backendData._id || backendData.medicineId
      if (backendId) {
        initialRecord.id = backendId
        initialRecord._id = backendId
        initialRecord.medicineId = backendId
      }
      const updatedLocal = readLocalMedicines().map((m) => {
        const mId = String(m?.id || m?._id || m?.medicineId || '')
        return mId === String(newId) ? { ...m, ...backendData, id: backendId || newId } : m
      })
      writeLocalMedicines(updatedLocal)
    }
    saveMedicineToCache(payload, response)
    return response || { success: true, message: 'Medicine created successfully.', data: initialRecord }
  } catch (error) {
    console.warn('Backend createMedicine threw error, item preserved locally:', error.message)
    return { success: true, message: 'Medicine created successfully.', data: initialRecord }
  }
}

export async function getMedicine(id) {
  const response = await request(replacePathParams('medicine/{id}', { id }))
  if (response?.data && typeof response.data === 'object' && !Array.isArray(response.data)) {
    return { ...response, data: normalizeMedicineRecord(response.data) }
  }
  return normalizeMedicineRecord(response)
}

export async function updateMedicine(id, payload) {
  const strId = String(id)
  const currentLocal = readLocalMedicines()
  const updatedLocal = currentLocal.map((m) => {
    const mId = String(m?.id || m?._id || m?.medicineId || '')
    return mId === strId ? normalizeMedicineRecord({ ...m, ...payload }) : m
  })
  writeLocalMedicines(updatedLocal)
  saveMedicineToCache({ ...payload, id })

  try {
    const response = await request(replacePathParams('medicine/{id}', { id }), {
      method: 'PUT',
      body: JSON.stringify(apiPayload(payload)),
    })
    return response || { success: true, message: 'Medicine updated successfully.' }
  } catch (error) {
    console.warn('Backend updateMedicine failed, updated locally:', error.message)
    return { success: true, message: 'Medicine updated successfully.' }
  }
}

export async function deleteMedicine(id) {
  const strId = String(id)
  const currentDeleted = readDeletedMedicineIds()
  if (!currentDeleted.includes(strId)) {
    saveDeletedMedicineIds([...currentDeleted, strId])
  }
  const currentLocal = readLocalMedicines().filter((m) => {
    const mId = String(m?.id || m?._id || m?.medicineId || '')
    return mId !== strId
  })
  writeLocalMedicines(currentLocal)

  try {
    return await request(replacePathParams('medicine/{id}', { id }), {
      method: 'DELETE',
    })
  } catch (error) {
    console.warn('Backend deleteMedicine failed, deleted locally:', error.message)
    return { success: true, message: 'Medicine deleted successfully.' }
  }
}

export async function listAvailableMedicines(params = {}) {
  const query = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, value)
  })

  const response = await request(`medicine/available${query.toString() ? `?${query}` : ''}`)
  return normalizeMedicineResponse(response)
}

export function listMedicineCategories() {
  return request('medicine/categories')
}

export function listMedicineDosageForms() {
  return request('medicine/dosage-forms')
}

export async function searchMedicines(params = {}) {
  const queryStr = String(params.search || params.q || '').trim().toLowerCase()
  const all = await listMedicines(params)
  if (!queryStr) return all
  return all.filter((m) => {
    const name = String(m?.name || m?.medicineName || '').toLowerCase()
    const generic = String(m?.genericName || '').toLowerCase()
    const code = String(m?.code || m?.medicineCode || '').toLowerCase()
    return name.includes(queryStr) || generic.includes(queryStr) || code.includes(queryStr)
  })
}

export function listMedicineStrengths() {
  return request('medicine/strengths')
}

export function validateMedicineImport(file, options = {}) {
  const formData = new FormData()
  formData.append('File', file)
  const { pharmacyId, branchId, hospitalId, cmsBranchId } = pharmacyTenantContext()
  if (pharmacyId) {
    formData.append('pharmacyId', String(pharmacyId))
    formData.append('PharmacyId', String(pharmacyId))
  }
  if (branchId) {
    formData.append('branchId', String(branchId))
    formData.append('BranchId', String(branchId))
  }
  if (hospitalId) {
    formData.append('hospitalId', String(hospitalId))
    formData.append('HospitalId', String(hospitalId))
  }
  if (cmsBranchId) {
    formData.append('cmsBranchId', String(cmsBranchId))
    formData.append('CmsBranchId', String(cmsBranchId))
  }
  Object.entries(options).forEach(([key, value]) => {
    if (value !== undefined && value !== null) formData.append(key, String(value))
  })
  return request('medicine-import/validate', {
    authRole: 'pharmacyAdmin',
    method: 'POST',
    body: formData,
  })
}

export function commitMedicineImport(importId, payload = {}) {
  const importPayload = {
    skipInvalidRows: true,
    SkipInvalidRows: true,
    importInvalidRows: false,
    ImportInvalidRows: false,
    ...payload,
  }
  return request(replacePathParams('medicine-import/{importId}/commit', { importId }), {
    authRole: 'pharmacyAdmin',
    method: 'POST',
    body: JSON.stringify(apiPayload(importPayload)),
  })
}

export function getMedicineImportErrors(importId) {
  return request(replacePathParams('medicine-import/{importId}/errors', { importId }), { authRole: 'pharmacyAdmin' })
}

export function getMedicineImportStatus(importId) {
  return request(replacePathParams('medicine-import/{importId}/status', { importId }), { authRole: 'pharmacyAdmin' })
}

export function downloadMedicineImportTemplate(format = 'xlsx') {
  const query = format ? '?format=' + encodeURIComponent(format) : ''
  return fetch(apiUrl('medicine-import/template' + query), {
    headers: {
      'ngrok-skip-browser-warning': 'true',
      ...(sessionStorage.getItem('pharmacyAdminToken') || localStorage.getItem('pharmacyAdminToken')
        ? { Authorization: `Bearer ${sessionStorage.getItem('pharmacyAdminToken') || localStorage.getItem('pharmacyAdminToken')}` }
        : {}),
      ...pharmacyTenantHeaders('medicine-import/template', 'pharmacyAdmin'),
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
    body: JSON.stringify(apiPayload(payload)),
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
    body: JSON.stringify(apiPayload(payload)),
  })
}

export function adjustInventory(payload) {
  return request('inventory/adjust', {
    method: 'POST',
    body: JSON.stringify(apiPayload(payload)),
  })
}

export function adjustInventoryWithReason(payload) {
  return request('inventory/adjustments', {
    method: 'POST',
    body: JSON.stringify(apiPayload(payload)),
  })
}

export function getInventoryBatch(batchId) {
  return request(replacePathParams('inventory/batches/{batchId}', { batchId }))
}

export function disposeInventoryBatch(batchId, payload) {
  return request(replacePathParams('inventory/batches/{batchId}/dispose', { batchId }), {
    method: 'POST',
    body: JSON.stringify(apiPayload(payload)),
  })
}

export function quarantineInventoryBatch(batchId, payload) {
  return request(replacePathParams('inventory/batches/{batchId}/quarantine', { batchId }), {
    method: 'PATCH',
    body: JSON.stringify(apiPayload(payload)),
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

export const getAddressByPincode = async (pincode) => {
  try {
    return await request(replacePathParams('address/pincode/{pincode}', { pincode }), { authRole: 'pharmacyAdmin' })
  } catch (err) {
    // Fallback: try the India Post public API if backend returns error
    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`)
      const json = await res.json()
      if (json?.[0]?.Status === 'Success') {
        const po = json[0].PostOffice?.[0] || {}
        return {
          data: {
            address: {
              area: po.Name || '',
              district: po.District || '',
              state: po.State || '',
              country: po.Country || 'India',
              city: po.Block || po.Division || po.District || '',
            }
          }
        }
      }
    } catch {
      // ignore fallback failure
    }
    throw err
  }
}
export const listSuppliers = (params = {}) => request(`suppliers${queryString(params)}`)
export const createSupplier = (payload) => request('suppliers', { method: 'POST', body: JSON.stringify(apiPayload(payload)) })
export const getSupplier = (id) => request(replacePathParams('suppliers/{id}', { id }))
export const updateSupplier = (id, payload) => request(replacePathParams('suppliers/{id}', { id }), { method: 'PUT', body: JSON.stringify(apiPayload(payload)) })
export const deleteSupplier = (id) => request(replacePathParams('suppliers/{id}', { id }), { method: 'DELETE' })
export const getSupplierPurchaseHistory = (id) => request(replacePathParams('suppliers/{id}/purchase-history', { id }))
export const changeSupplierStatus = (id, payload) => request(replacePathParams('suppliers/{id}/status', { id }), { method: 'PATCH', body: JSON.stringify(apiPayload(payload)) })

export const listPurchaseOrders = (params = {}) => request(`purchase-orders${queryString(params)}`)
export const createPurchaseOrder = (payload) => request('purchase-orders', { method: 'POST', body: JSON.stringify(apiPayload(payload)) })
export const getPurchaseOrder = (id) => request(replacePathParams('purchase-orders/{id}', { id }))
export const updatePurchaseOrder = (id, payload) => request(replacePathParams('purchase-orders/{id}', { id }), { method: 'PUT', body: JSON.stringify(apiPayload(payload)) })
export const receivePurchaseOrder = (id, payload) => request(replacePathParams('purchase-orders/{id}/receive', { id }), { method: 'POST', body: JSON.stringify(apiPayload(payload)) })
export const changePurchaseOrderStatus = (id, payload) => request(replacePathParams('purchase-orders/{id}/status', { id }), { method: 'PATCH', body: JSON.stringify(apiPayload(payload)) })
export const listPendingPurchaseOrders = () => request('purchase-orders/pending')

export const upsertIntegrationAppointment = (externalAppointmentId, payload) => request(replacePathParams('integration/appointments/{externalAppointmentId}', { externalAppointmentId }), { method: 'PUT', body: JSON.stringify(apiPayload(payload)) })
export const getIntegrationAppointment = (externalAppointmentId) => request(replacePathParams('integration/appointments/{externalAppointmentId}', { externalAppointmentId }))
export const cancelIntegrationAppointment = (externalAppointmentId, payload = {}) => request(replacePathParams('integration/appointments/{externalAppointmentId}', { externalAppointmentId }), { method: 'DELETE', body: JSON.stringify(apiPayload(payload)) })
export const upsertIntegrationDoctor = (externalDoctorId, payload) => request(replacePathParams('integration/doctors/{externalDoctorId}', { externalDoctorId }), { method: 'PUT', body: JSON.stringify(apiPayload(payload)) })
export const getIntegrationDoctor = (externalDoctorId) => request(replacePathParams('integration/doctors/{externalDoctorId}', { externalDoctorId }))
export const deleteIntegrationDoctor = (externalDoctorId) => request(replacePathParams('integration/doctors/{externalDoctorId}', { externalDoctorId }), { method: 'DELETE' })
export const getIntegrationMedicines = (params = {}) => request(`integration/medicines${queryString(params)}`)
export const upsertIntegrationPatient = (externalPatientId, payload) => request(replacePathParams('integration/patients/{externalPatientId}', { externalPatientId }), { method: 'PUT', body: JSON.stringify(apiPayload(payload)) })
export const getIntegrationPatient = (externalPatientId) => request(replacePathParams('integration/patients/{externalPatientId}', { externalPatientId }))
export const deleteIntegrationPatient = (externalPatientId) => request(replacePathParams('integration/patients/{externalPatientId}', { externalPatientId }), { method: 'DELETE' })
export const createIntegrationPrescription = (payload) => request('integration/prescriptions', { method: 'POST', body: JSON.stringify(apiPayload(payload)) })
export const getIntegrationPrescription = (sourceSystem, externalPrescriptionId) => request(replacePathParams('integration/prescriptions/{sourceSystem}/{externalPrescriptionId}', { sourceSystem, externalPrescriptionId }))
export const updateIntegrationPrescription = (sourceSystem, externalPrescriptionId, payload) => request(replacePathParams('integration/prescriptions/{sourceSystem}/{externalPrescriptionId}', { sourceSystem, externalPrescriptionId }), { method: 'PUT', body: JSON.stringify(apiPayload(payload)) })
export const cancelIntegrationPrescription = (sourceSystem, externalPrescriptionId, payload = {}) => request(replacePathParams('integration/prescriptions/{sourceSystem}/{externalPrescriptionId}', { sourceSystem, externalPrescriptionId }), { method: 'DELETE', body: JSON.stringify(apiPayload(payload)) })
export const getIntegrationPrescriptionStatus = (sourceSystem, externalPrescriptionId) => request(replacePathParams('integration/prescriptions/{sourceSystem}/{externalPrescriptionId}/status', { sourceSystem, externalPrescriptionId }))

export const createDoctorPrescription = (payload) => request('doctor/prescriptions', { method: 'POST', body: JSON.stringify(apiPayload(payload)) })
export const getDoctorPrescription = (id) => request(replacePathParams('doctor/prescriptions/{id}', { id }))
export const updateDoctorPrescription = (id, payload) => request(replacePathParams('doctor/prescriptions/{id}', { id }), { method: 'PUT', body: JSON.stringify(apiPayload(payload)) })
export const cancelDoctorPrescription = (id, payload = {}) => request(replacePathParams('doctor/prescriptions/{id}/cancel', { id }), { method: 'POST', body: JSON.stringify(apiPayload(payload)) })
export const completeDoctorPrescription = (id, payload = {}) => request(replacePathParams('doctor/prescriptions/{id}/complete', { id }), { method: 'POST', body: JSON.stringify(apiPayload(payload)) })

export const dispensePrescription = (payload) => request('pharmacy/dispense', { method: 'POST', body: JSON.stringify(apiPayload(payload)) })
export const generateBill = (payload) => request('pharmacy/generate-bill', { method: 'POST', body: JSON.stringify(apiPayload(payload)) })
export const getInvoice = (billId) => request(replacePathParams('pharmacy/invoice/{billId}', { billId }))
export const recordPayment = (payload) => request('pharmacy/payment', { method: 'POST', body: JSON.stringify(apiPayload(payload)) })
export const getPendingPharmacyPrescriptions = () => request('pharmacy/pending')
export const getPharmacyPrescription = (id) => request(replacePathParams('pharmacy/prescriptions/{id}', { id }))
export const getDailySalesReport = (params = {}) => request(`pharmacy/reports/daily-sales${queryString(params)}`)

export const listBills = (params = {}) => request(`pharmacy/bills${queryString(params)}`)
export const getBill = (id) => request(replacePathParams('pharmacy/bills/{id}', { id }))
export const cancelBill = (id, payload = {}) => request(replacePathParams('pharmacy/bills/{id}/cancel', { id }), { method: 'POST', body: JSON.stringify(apiPayload(payload)) })
export const refundPayment = (id, payload = {}) => request(replacePathParams('pharmacy/payments/{id}/refund', { id }), { method: 'POST', body: JSON.stringify(apiPayload(payload)) })

export const listMedicineReturns = (params = {}) => request(`pharmacy/returns${queryString(params)}`)
export const createMedicineReturn = (payload) => request('pharmacy/returns', { method: 'POST', body: JSON.stringify(apiPayload(payload)) })
export const getMedicineReturn = (id) => request(replacePathParams('pharmacy/returns/{id}', { id }))
export const approveMedicineReturn = (id, payload = {}) => request(replacePathParams('pharmacy/returns/{id}/approve', { id }), { method: 'POST', body: JSON.stringify(apiPayload(payload)) })
export const cancelMedicineReturn = (id, payload = {}) => request(replacePathParams('pharmacy/returns/{id}/cancel', { id }), { method: 'POST', body: JSON.stringify(apiPayload(payload)) })

export const listStockTransfers = (params = {}) => request(`inventory/transfers${queryString(params)}`)
export const createStockTransfer = (payload) => request('inventory/transfers', { method: 'POST', body: JSON.stringify(apiPayload(payload)) })
export const getStockTransfer = (id) => request(replacePathParams('inventory/transfers/{id}', { id }))
export const dispatchStockTransfer = (id, payload = {}) => request(replacePathParams('inventory/transfers/{id}/dispatch', { id }), { method: 'POST', body: JSON.stringify(apiPayload(payload)) })
export const receiveStockTransfer = (id, payload = {}) => request(replacePathParams('inventory/transfers/{id}/receive', { id }), { method: 'POST', body: JSON.stringify(apiPayload(payload)) })
export const changeStockTransferStatus = (id, payload) => request(replacePathParams('inventory/transfers/{id}/status', { id }), { method: 'POST', body: JSON.stringify(apiPayload(payload)) })

export const getPharmacyAlerts = () => request('pharmacy/alerts')
export const getPharmacyAuditLogs = (params = {}) => request(`pharmacy/audit-logs${queryString(params)}`)
export const getPharmacyDashboard = () => request('pharmacy/dashboard')
export const getPharmacyPayments = (params = {}) => request(`pharmacy/payments${queryString(params)}`)
export const getPharmacyExpiryReport = (params = {}) => request(`pharmacy/reports/expiry${queryString(params)}`)
export const getPharmacyPurchasesReport = (params = {}) => request(`pharmacy/reports/purchases${queryString(params)}`)
export const getPharmacySalesReport = (params = {}) => request(`pharmacy/reports/sales${queryString(params)}`)
export const getPharmacyStockMovementReport = (params = {}) => request(`pharmacy/reports/stock-movement${queryString(params)}`)
export const getPharmacyStockSummaryReport = () => request('pharmacy/reports/stock-summary')
export const getPharmacyTopSellingReport = (params = {}) => request(`pharmacy/reports/top-selling${queryString(params)}`)
export const getPharmacyAdminDashboard = () => request('pharmacy/dashboard', { authRole: 'pharmacyAdmin' })
export const getPharmacistDashboard = () => request('pharmacy/dashboard', { authRole: 'pharmacist' })
export const getPharmacistInventory = (params = {}) => request(`inventory${queryString(params)}`, { authRole: 'pharmacist' })
export const getPharmacistInventoryBatches = (medicineId) => request(replacePathParams('inventory/{medicineId}/batches', { medicineId }), { authRole: 'pharmacist' })
export const getPharmacistInventoryAlerts = () => request('pharmacy/alerts', { authRole: 'pharmacist' })

export function getPharmacyAdminAssignmentStatus() {
  return request('pharmacy-admin-auth/assignment-status', { authRole: 'pharmacyAdmin' })
}

export function changePharmacyAdminPassword(payload) {
  return request('pharmacy-admin-auth/change-password', {
    authRole: 'pharmacyAdmin',
    method: 'POST',
    body: JSON.stringify(cleanChangePasswordPayload(payload)),
  })
}

const LOCAL_PHARMACISTS_KEY = 'pms_pharmacy_pharmacists'

export function readLocalPharmacists() {
  try {
    const key = scopedKey(LOCAL_PHARMACISTS_KEY)
    migrateLegacyCache(LOCAL_PHARMACISTS_KEY, key)
    const raw = localStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function writeLocalPharmacists(list) {
  try {
    const key = scopedKey(LOCAL_PHARMACISTS_KEY)
    localStorage.setItem(key, JSON.stringify(list))
  } catch {
    // ignore storage errors
  }
}

function extractPharmacistsArray(response) {
  if (Array.isArray(response)) return response
  if (Array.isArray(response?.data)) return response.data
  if (Array.isArray(response?.data?.pharmacists)) return response.data.pharmacists
  if (Array.isArray(response?.pharmacists)) return response.pharmacists
  if (Array.isArray(response?.results)) return response.results
  return []
}

function parsePositiveInt(val) {
  if (val === undefined || val === null || val === '') return undefined
  const str = String(val).trim()
  if (!/^\d+$/.test(str)) return undefined
  const num = Number(str)
  return Number.isSafeInteger(num) && num > 0 ? num : undefined
}

export async function listPharmacists(params = {}) {
  const query = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, value)
  })

  const localList = readLocalPharmacists()
  try {
    const response = await request(`pharmacy-admin/pharmacists${query.toString() ? `?${query}` : ''}`)
    const apiList = extractPharmacistsArray(response)
    const localByIdOrEmail = new Map()
    localList.forEach((p) => {
      const pid = String(p?._id || p?.id || p?.pharmacistId || '')
      const pemail = String(p?.email || '').trim().toLowerCase()
      if (pid) localByIdOrEmail.set(`id:${pid}`, p)
      if (pemail) localByIdIdOrEmailSet(localByIdOrEmail, `email:${pemail}`, p)
    })

    const apiIds = new Set()
    const apiEmails = new Set()
    const enrichedApi = apiList.map((item) => {
      const id = String(item?._id || item?.id || item?.pharmacistId || '')
      const email = String(item?.email || item?.user?.email || '').trim().toLowerCase()
      if (id) apiIds.add(id)
      if (email) apiEmails.add(email)
      const cached = (id && localByIdOrEmail.get(`id:${id}`)) || (email && localByIdOrEmail.get(`email:${email}`))
      if (!cached) return item
      return {
        ...cached,
        ...item,
        phone: item?.phone || item?.mobileNumber || cached?.phone || cached?.mobileNumber || '',
        mobileNumber: item?.mobileNumber || item?.phone || cached?.mobileNumber || cached?.phone || '',
        branchId: item?.branchId || item?.BranchId || cached?.branchId || '',
        branchName: item?.branchName || item?.pharmacy?.name || item?.pharmacyName || cached?.branchName || '',
      }
    })

    const remainingLocal = localList.filter((p) => {
      const pid = String(p?._id || p?.id || p?.pharmacistId || '')
      const pemail = String(p?.email || '').trim().toLowerCase()
      if (pid && apiIds.has(pid)) return false
      if (pemail && apiEmails.has(pemail)) return false
      return true
    })

    const merged = [...enrichedApi, ...remainingLocal]
    return { ...(typeof response === 'object' && response ? response : {}), data: merged, pharmacists: merged }
  } catch (err) {
    if (localList.length) {
      return { data: localList, pharmacists: localList }
    }
    throw err
  }
}

function localByIdIdOrEmailSet(map, key, val) {
  map.set(key, val)
}

export function cleanPharmacyPayload(payload = {}) {
  const name = String(payload.name || payload.pharmacyName || '').trim()
  const phone = String(payload.phone || payload.phoneNumber || payload.contactNumber || payload.mobileNumber || '').trim()
  const email = String(payload.email || payload.emailAddress || '').trim()
  const address = String(payload.address || '').trim()
  const city = String(payload.city || '').trim()
  const state = String(payload.state || '').trim()
  const district = String(payload.district || '').trim()
  const country = String(payload.country || 'India').trim()
  const postalCode = String(payload.postalCode || payload.pincode || '').trim()

  return {
    name,
    ...(phone ? { phone } : {}),
    ...(email ? { email } : {}),
    ...(address ? { address } : {}),
    ...(city ? { city } : {}),
    ...(state ? { state } : {}),
    ...(district ? { district } : {}),
    ...(country ? { country } : {}),
    ...(postalCode ? { postalCode } : {}),
  }
}

export function cleanBranchPayload(payload = {}) {
  const name = String(payload.name || payload.branchName || '').trim()
  const phone = String(payload.phone || payload.phoneNumber || payload.contactNumber || payload.mobileNumber || '').trim()
  const email = String(payload.email || payload.emailAddress || '').trim()
  const address = String(payload.address || '').trim()
  const city = String(payload.city || '').trim()
  const state = String(payload.state || '').trim()
  const district = String(payload.district || '').trim()
  const country = String(payload.country || 'India').trim()
  const postalCode = String(payload.postalCode || payload.pincode || '').trim()

  return {
    name,
    ...(phone ? { phone } : {}),
    ...(email ? { email } : {}),
    ...(address ? { address } : {}),
    ...(city ? { city } : {}),
    ...(state ? { state } : {}),
    ...(district ? { district } : {}),
    ...(country ? { country } : {}),
    ...(postalCode ? { postalCode } : {}),
  }
}

export function cleanPharmacistPayload(payload = {}) {
  const name = String(payload.name || '').trim()
  const email = String(payload.email || '').trim()
  const mobileNumber = String(payload.mobileNumber || payload.phone || payload.phoneNumber || payload.mobile || '').trim()
  const rawBranch = payload.branchId ?? payload.BranchId
  const branchId = parsePositiveInt(rawBranch)

  return {
    name,
    email,
    ...(mobileNumber ? { mobileNumber } : {}),
    ...(branchId ? { branchId } : {}),
  }
}

export async function createPharmacist(payload = {}) {
  const rawBranch = payload.branchId ?? payload.BranchId
  const numericBranchId = parsePositiveInt(rawBranch)
  const tenant = pharmacyTenantContext()
  const fallbackBranchId = numericBranchId || parsePositiveInt(tenant.branchId) || parsePositiveInt(tenant.pharmacyId)

  if (!fallbackBranchId) {
    throw new Error('A valid numeric branch selection is required before creating a pharmacist.')
  }

  const cleanPayload = {
    name: String(payload.name || '').trim(),
    email: String(payload.email || '').trim(),
    ...(payload.mobileNumber || payload.phone ? { mobileNumber: String(payload.mobileNumber || payload.phone).trim() } : {}),
    branchId: fallbackBranchId,
  }

  const response = await request('pharmacy-admin/pharmacists', {
    authRole: 'pharmacyAdmin',
    method: 'POST',
    body: JSON.stringify(cleanPayload),
  })

  const created = response?.pharmacist || response?.data?.pharmacist || response?.data || response || {}
  const id = created?.pharmacistId || created?.PharmacistId || created?.id || created?._id || created?.userId || created?.UserId

  if (id) {
    const record = {
      id,
      pharmacistId: id,
      name: cleanPayload.name,
      email: cleanPayload.email,
      phone: cleanPayload.mobileNumber || '',
      mobileNumber: cleanPayload.mobileNumber || '',
      branchId: fallbackBranchId,
      status: 'Active',
      isActive: true,
      ...created,
    }
    const current = readLocalPharmacists().filter((p) => String(p?.id || p?.pharmacistId) !== String(id))
    writeLocalPharmacists([record, ...current])
  }

  return response
}

export async function getPharmacist(id) {
  try {
    return await request(replacePathParams('pharmacy-admin/pharmacists/{id}', { id }))
  } catch (err) {
    const found = readLocalPharmacists().find((p) => String(p?._id || p?.id || p?.pharmacistId) === String(id))
    if (found) return { data: found, pharmacist: found }
    throw err
  }
}

export async function updatePharmacist(id, payload = {}) {
  const rawBranch = payload.branchId ?? payload.BranchId
  const numericBranchId = parsePositiveInt(rawBranch)
  const cleanPayload = {
    name: String(payload.name || '').trim(),
    email: String(payload.email || '').trim(),
    ...(payload.mobileNumber || payload.phone ? { mobileNumber: String(payload.mobileNumber || payload.phone).trim() } : {}),
    ...(numericBranchId ? { branchId: numericBranchId } : {}),
  }

  const response = await request(replacePathParams('pharmacy-admin/pharmacists/{id}', { id }), {
    authRole: 'pharmacyAdmin',
    method: 'PUT',
    body: JSON.stringify(cleanPayload),
  })

  const updated = response?.pharmacist || response?.data?.pharmacist || response?.data || response || {}
  const list = readLocalPharmacists()
  const idx = list.findIndex((p) => String(p?._id || p?.id || p?.pharmacistId) === String(id))
  const merged = { ...(idx >= 0 ? list[idx] : {}), ...cleanPayload, ...updated, id, pharmacistId: id }
  if (idx >= 0) list[idx] = merged
  else list.push(merged)
  writeLocalPharmacists(list)

  return response
}

export async function deletePharmacist(id) {
  const filtered = readLocalPharmacists().filter((p) => String(p?._id || p?.id || p?.pharmacistId) !== String(id))
  writeLocalPharmacists(filtered)
  try {
    return await request(replacePathParams('pharmacy-admin/pharmacists/{id}', { id }), {
      method: 'DELETE',
    })
  } catch {
    return { message: 'Pharmacist deleted successfully.' }
  }
}

export function getPharmacistPermissions(id) {
  return request(replacePathParams('pharmacy-admin/pharmacists/{id}/permissions', { id }))
}

export function updatePharmacistPermissions(id, payload) {
  return request(replacePathParams('pharmacy-admin/pharmacists/{id}/permissions', { id }), {
    method: 'PUT',
    body: JSON.stringify(apiPayload(payload)),
  })
}

export function assignPharmacistToAdminPharmacy(id, payload = {}) {
  const rawBranch = payload.branchId ?? payload.BranchId
  const numericBranchId = parsePositiveInt(rawBranch)
  const cleanPayload = numericBranchId ? { branchId: numericBranchId, BranchId: numericBranchId } : {}
  return request(replacePathParams('pharmacy-admin/pharmacists/{id}/pharmacy-assignment', { id }), {
    method: 'PUT',
    body: JSON.stringify(apiPayload(cleanPayload)),
  })
}

export const transferPharmacistBranch = assignPharmacistToAdminPharmacy

export function resetPharmacistPassword(id, payload) {
  return request(replacePathParams('pharmacy-admin/pharmacists/{id}/reset-password', { id }), {
    method: 'POST',
    body: JSON.stringify(apiPayload(passwordResetPayload(payload))),
  })
}

export async function changePharmacistStatus(id, payload) {
  const statusPayload = superAdminStatusPayload(payload)
  const list = readLocalPharmacists().map((p) =>
    String(p?._id || p?.id || p?.pharmacistId) === String(id)
      ? { ...p, status: statusPayload.status || (statusPayload.isActive ? 'Active' : 'Inactive'), isActive: statusPayload.isActive }
      : p
  )
  writeLocalPharmacists(list)
  return request(replacePathParams('pharmacy-admin/pharmacists/{id}/status', { id }), {
    method: 'PATCH',
    body: JSON.stringify(apiPayload(statusPayload)),
  })
}

export function upsertIntegrationHospital(externalHospitalId, payload) {
  return request(replacePathParams('integration/hospitals/{externalHospitalId}', { externalHospitalId }), {
    method: 'PUT',
    body: JSON.stringify(apiPayload(payload)),
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
      body: JSON.stringify(apiPayload(payload)),
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
    body: JSON.stringify(apiPayload(payload)),
  })
}

export function assignPharmacyToAdmin(id, payload) {
  return request(replacePathParams('pharmacy-super-admin/admins/{id}/pharmacy-assignment', { id }), {
    method: 'PUT',
    body: JSON.stringify(apiPayload(payload)),
  })
}

export function getPharmacyAdmin(id) {
  return request(replacePathParams('pharmacy-super-admin/admins/{id}', { id }))
}

export function updatePharmacyAdmin(id, payload) {
  return request(replacePathParams('pharmacy-super-admin/admins/{id}', { id }), {
    method: 'PUT',
    body: JSON.stringify(apiPayload(payload)),
  })
}

export function resetPharmacyAdminPassword(id, payload) {
  return request(replacePathParams('pharmacy-super-admin/admins/{id}/reset-password', { id }), {
    method: 'POST',
    body: JSON.stringify(apiPayload(passwordResetPayload(payload))),
  })
}

export function changePharmacyAdminStatus(id, payload) {
  return request(replacePathParams('pharmacy-super-admin/admins/{id}/status', { id }), {
    method: 'PATCH',
    body: JSON.stringify(apiPayload(superAdminStatusPayload(payload))),
  })
}

export function getPharmacySuperAdminDashboard() {
  return request('pharmacy-super-admin/dashboard')
}

export function getPharmacySuperAdminDashboardAnalytics() {
  return request('pharmacy-super-admin/dashboard')
}

export function getPharmacySuperAdminDashboardExpiryAlerts() {
  return request('pharmacy-super-admin/medicines')
}

export function getPharmacySuperAdminDashboardLowStock() {
  return request('pharmacy-super-admin/medicines')
}

export function listAssignmentHospitals(params = {}) {
  return listSuperAdminHospitals(params)
}

export function listHospitalBranches(hospitalId) {
  return listSuperAdminHospitalBranches(hospitalId)
}

export function getPharmacySettings(options = {}) {
  return request('pharmacy/settings', options)
}

export function cleanPharmacyAdminSettingsPayload(payload = {}) {
  const currentSettings = readStoredJson('pharmacySettings') || {}
  const name = String(payload.pharmacyName || payload.name || payload.Name || currentSettings.pharmacyName || '').trim()
  const phone = payload.phoneNumber || payload.phone || payload.Phone || currentSettings.phoneNumber || currentSettings.phone || null
  const email = payload.emailAddress || payload.email || payload.Email || currentSettings.emailAddress || currentSettings.email || null
  const license = payload.licenseNumber || payload.LicenseNumber || currentSettings.licenseNumber || null
  const gst = payload.gstNumber || payload.GSTNumber || currentSettings.gstNumber || null
  const address = payload.address || payload.Address || currentSettings.address || null
  const isActive = payload.isActive !== undefined ? Boolean(payload.isActive) : (payload.status !== undefined ? String(payload.status).toLowerCase() === 'active' : true)

  return {
    pharmacyName: name,
    phoneNumber: phone,
    emailAddress: email,
    licenseNumber: license,
    gstNumber: gst,
    address: address,
    isActive,
    currency: String(payload.currency || payload.Currency || currentSettings.currency || 'INR').trim(),
    taxGSTRate: Number(payload.taxGSTRate ?? payload.TaxGSTRate ?? currentSettings.taxGSTRate ?? 18),
    invoicePrefix: String(payload.invoicePrefix || payload.InvoicePrefix || currentSettings.invoicePrefix || 'PHAR-').trim(),
    paymentTerms: String(payload.paymentTerms || payload.PaymentTerms || currentSettings.paymentTerms || 'Due on Receipt').trim(),
    businessHours: String(payload.businessHours || payload.BusinessHours || currentSettings.businessHours || '9:00 AM - 10:00 PM').trim(),
    lowStockThreshold: Number(payload.lowStockThreshold ?? payload.LowStockThreshold ?? currentSettings.lowStockThreshold ?? 10),
    expiryAlertHorizonDays: Number(payload.expiryAlertHorizonDays ?? payload.ExpiryAlertHorizonDays ?? currentSettings.expiryAlertHorizonDays ?? 90),
    stockManagementEnabled: Boolean(payload.stockManagementEnabled ?? payload.StockManagementEnabled ?? currentSettings.stockManagementEnabled ?? true),
    batchExpiryTrackingEnabled: Boolean(payload.batchExpiryTrackingEnabled ?? payload.BatchExpiryTrackingEnabled ?? currentSettings.batchExpiryTrackingEnabled ?? true),
    maximumAllowedDiscount: Number(payload.maximumAllowedDiscount ?? payload.MaximumAllowedDiscount ?? currentSettings.maximumAllowedDiscount ?? 10),
    salesInvoiceDetails: String(payload.salesInvoiceDetails || payload.SalesInvoiceDetails || currentSettings.salesInvoiceDetails || 'Show Tax Details').trim(),
    returnWindowDays: Number(payload.returnWindowDays ?? payload.ReturnWindowDays ?? currentSettings.returnWindowDays ?? 7),
    automaticReorderingEnabled: Boolean(payload.automaticReorderingEnabled ?? payload.AutomaticReorderingEnabled ?? currentSettings.automaticReorderingEnabled ?? false),
    lowStockNotificationsEnabled: Boolean(payload.lowStockNotificationsEnabled ?? payload.LowStockNotificationsEnabled ?? currentSettings.lowStockNotificationsEnabled ?? true),
    expiryWarningAlertsEnabled: Boolean(payload.expiryWarningAlertsEnabled ?? payload.ExpiryWarningAlertsEnabled ?? currentSettings.expiryWarningAlertsEnabled ?? true),
    orderTransferWarningsEnabled: Boolean(payload.orderTransferWarningsEnabled ?? payload.OrderTransferWarningsEnabled ?? currentSettings.orderTransferWarningsEnabled ?? true),
  }
}

export function updatePharmacySettings(payload, options = {}) {
  const fullPayload = cleanPharmacyAdminSettingsPayload(payload)
  return request('pharmacy/settings', {
    ...options,
    method: 'PUT',
    body: JSON.stringify(apiPayload(fullPayload)),
  })
}

export function getPharmacyCmsOptions(params = {}, options = {}) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, value)
  })
  return request(`pharmacy/settings/cms-options${query.toString() ? `?${query}` : ''}`, options)
}

export function updatePharmacyCmsIntegration(payload, options = {}) {
  return request('pharmacy/settings/cms-integration', {
    ...options,
    method: 'PUT',
    body: JSON.stringify(apiPayload(payload)),
  })
}

export function createManualPharmacyPrescription(payload) {
  return request('pharmacy/prescriptions/manual', {
    method: 'POST',
    body: JSON.stringify(apiPayload(payload)),
  })
}
export const getPharmacyAdminAuthPermissions = () => request('pharmacy-admin-auth/permissions', { authRole: 'pharmacyAdmin' })
export const getSuperAdminProfile = () => request('pharmacy-super-admin-auth/profile')
export const getPharmacyPrescriptions = (params = {}) => request(`pharmacy/prescriptions${queryString(params)}`)
export const getPharmacyDispensingOverview = (params = {}) => request(`pharmacy/dispensing${queryString(params)}`)
export const getSuperAdminAuditLogs = (params = {}) => request(`pharmacy-super-admin/audit-logs${queryString(params)}`)
export const getSuperAdminAuditLogSummary = () => request('pharmacy-super-admin/audit-logs/summary')
const SUB_BRANCHES_CACHE_KEY = 'pms_pharmacy_sub_branches'

export function readLocalSubBranches() {
  try {
    const key = scopedKey(SUB_BRANCHES_CACHE_KEY)
    migrateLegacyCache(SUB_BRANCHES_CACHE_KEY, key)
    const raw = localStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function writeLocalSubBranches(branches) {
  try {
    const key = scopedKey(SUB_BRANCHES_CACHE_KEY)
    localStorage.setItem(key, JSON.stringify(branches))
  } catch {
    // ignore storage errors
  }
}

function enrichBranchPayload(payload = {}) {
  const ctx = pharmacyTenantContext()
  const pharmacyId = payload.pharmacyId || payload.PharmacyId || ctx.pharmacyId
  const branchId = ctx.branchId
  const hospitalId = ctx.hospitalId
  const cmsBranchId = ctx.cmsBranchId
  const name = String(payload.name || payload.branchName || '').trim()
  const phone = String(payload.phone || payload.phoneNumber || payload.contactNumber || '').trim()
  const email = String(payload.email || payload.emailAddress || '').trim()
  const postalCode = String(payload.postalCode || payload.pincode || '').trim()
  const status = payload.status || (payload.isActive === false ? 'Inactive' : 'Active')
  const isActive = String(status).toLowerCase() === 'active'

  return {
    ...payload,
    ...(name ? { name, branchName: name } : {}),
    ...(phone ? { phone, phoneNumber: phone, contactNumber: phone, mobileNumber: phone } : {}),
    ...(email ? { email, emailAddress: email } : {}),
    ...(postalCode ? { postalCode, pincode: postalCode } : {}),
    status,
    isActive,
    ...(pharmacyId ? { pharmacyId, PharmacyId: pharmacyId } : {}),
    ...(hospitalId ? { hospitalId, HospitalId: hospitalId } : {}),
    ...(branchId ? { parentBranchId: branchId, mainBranchId: branchId } : {}),
    ...(cmsBranchId ? { cmsBranchId } : {}),
  }
}

function extractBranchesArray(response) {
  if (Array.isArray(response)) return response
  if (Array.isArray(response?.data)) return response.data
  if (Array.isArray(response?.data?.branches)) return response.data.branches
  if (Array.isArray(response?.branches)) return response.branches
  if (Array.isArray(response?.items)) return response.items
  if (Array.isArray(response?.results)) return response.results
  return []
}

export const listPharmacyBranches = async (params = {}, options = {}) => {
  const localBranches = readLocalSubBranches()
  try {
    const response = await request('pharmacy/branches' + queryString(params), { authRole: 'pharmacyAdmin', ...options })
    const apiBranches = extractBranchesArray(response)
    const apiIds = new Set(apiBranches.map((b) => String(b?._id || b?.id || b?.branchId || '')).filter(Boolean))
    const merged = [...apiBranches, ...localBranches.filter((b) => !apiIds.has(String(b?._id || b?.id || b?.branchId || '')))]
    return { ...(typeof response === 'object' && response ? response : {}), data: merged, branches: merged }
  } catch {
    return { data: localBranches, branches: localBranches }
  }
}

export const createPharmacyBranch = async (payload) => {
  const cleanPayload = cleanBranchPayload(payload)
  const response = await request('pharmacy/branches', {
    authRole: 'pharmacyAdmin',
    method: 'POST',
    body: JSON.stringify(cleanPayload),
  })
  const created = response?.branch || response?.data?.branch || response?.data || response || {}
  const id = created?.branchId || created?.BranchId || created?.id || created?._id
  if (id) {
    const record = { ...cleanPayload, ...created, id, branchId: id }
    const current = readLocalSubBranches().filter((b) => String(b?.id || b?.branchId) !== String(id))
    writeLocalSubBranches([...current, record])
  }
  return response
}

export const getPharmacyBranch = async (id, options = {}) => {
  try {
    return await request(replacePathParams('pharmacy/branches/{id}', { id }), { authRole: 'pharmacyAdmin', ...options })
  } catch {
    const found = readLocalSubBranches().find((b) => String(b?._id || b?.id || b?.branchId) === String(id))
    return found ? { data: found, branch: found } : null
  }
}

export const updatePharmacyBranch = async (id, payload) => {
  const cleanPayload = cleanBranchPayload(payload)
  const response = await request(replacePathParams('pharmacy/branches/{id}', { id }), {
    authRole: 'pharmacyAdmin',
    method: 'PUT',
    body: JSON.stringify(cleanPayload),
  })
  const updated = response?.branch || response?.data?.branch || response?.data || response || {}
  const current = readLocalSubBranches()
  const idx = current.findIndex((b) => String(b?._id || b?.id || b?.branchId) === String(id))
  const merged = { ...(idx >= 0 ? current[idx] : {}), ...cleanPayload, ...updated, id, branchId: id }
  if (idx >= 0) current[idx] = merged
  else current.push(merged)
  writeLocalSubBranches(current)
  return response
}

export const deletePharmacyBranch = async (id) => {
  const current = readLocalSubBranches().filter((b) => String(b?._id || b?.id || b?.branchId) !== String(id))
  writeLocalSubBranches(current)
  return await request(replacePathParams('pharmacy/branches/{id}', { id }), { authRole: 'pharmacyAdmin', method: 'DELETE' })
}

export const changePharmacyBranchStatus = async (id, payload) => {
  const isActive = payload.isActive ?? (payload.status !== undefined ? String(payload.status).toLowerCase() === 'active' : true)
  const response = await request(replacePathParams('pharmacy/branches/{id}/status', { id }), {
    authRole: 'pharmacyAdmin',
    method: 'PATCH',
    body: JSON.stringify({ isActive, IsActive: isActive }),
  })
  const current = readLocalSubBranches().map((b) =>
    String(b?._id || b?.id || b?.branchId) === String(id)
      ? { ...b, status: isActive ? 'Active' : 'Inactive', isActive }
      : b
  )
  writeLocalSubBranches(current)
  return response
}

export const getPharmacyAdminPharmacy = (options = {}) =>
  request('pharmacy-admin/pharmacy', { authRole: 'pharmacyAdmin', ...options })

export const registerPharmacyAdminPharmacy = async (payload, options = {}) => {
  const cleanPayload = cleanPharmacyPayload(payload)
  const response = await request('pharmacy-admin/pharmacy', {
    authRole: 'pharmacyAdmin',
    method: 'POST',
    body: JSON.stringify(cleanPayload),
    ...options,
  })

  const pharmacyId = response?.pharmacyId || response?.data?.pharmacyId
  const pharmacyName = response?.pharmacyName || response?.data?.pharmacyName || cleanPayload.name
  const mainBranchId = response?.mainBranch?.branchId || response?.data?.mainBranch?.branchId || 1

  if (pharmacyId) {
    const prevAssignment = readStoredJson('pharmacyAdminAssignment') || {}
    const newAssignment = {
      ...prevAssignment,
      pharmacyId,
      pharmacyName,
      branchId: mainBranchId,
      mainBranchId,
      isPharmacyAssigned: true,
      accountStatus: 'Active',
    }
    sessionStorage.setItem('pharmacyAdminAssignment', JSON.stringify(newAssignment))
    localStorage.setItem('pharmacyAdminAssignment', JSON.stringify(newAssignment))

    const prevUser = readStoredJson('pharmacyAdminUser') || {}
    const newUser = {
      ...prevUser,
      pharmacyId,
      pharmacyName,
      branchId: mainBranchId,
      mainBranchId,
      isPharmacyAssigned: true,
      accountStatus: 'Active',
    }
    sessionStorage.setItem('pharmacyAdminUser', JSON.stringify(newUser))
    localStorage.setItem('pharmacyAdminUser', JSON.stringify(newUser))

    const pendingAuth = readStoredJson('__pms_admin_pending_auth')
    if (pendingAuth?.email && pendingAuth?.password) {
      try {
        const refreshed = await loginUnifiedAuth(pendingAuth)
        const loginData = unwrapLogin(refreshed)
        const token = loginData?.pharmacyAdminToken || refreshed?.pharmacyAdminToken || loginData?.token || refreshed?.token
        if (token) {
          localStorage.setItem('pharmacyAdminToken', token)
          sessionStorage.setItem('pharmacyAdminToken', token)
        }
      } catch (reAuthErr) {
        console.warn('Auto token refresh after pharmacy registration failed:', reAuthErr)
      }
    }
  }

  return response
}

export const getSuperAdminPharmacies = (params = {}) => request('pharmacy-super-admin/pharmacies' + queryString(params))
export const createSuperAdminPharmacy = (payload) => request('pharmacy-super-admin/pharmacies', { method: 'POST', body: JSON.stringify(apiPayload(payload)) })
export const getSuperAdminPharmacy = (id) => request(replacePathParams('pharmacy-super-admin/pharmacies/{id}', { id }))
export const updateSuperAdminPharmacy = (id, payload) => request(replacePathParams('pharmacy-super-admin/pharmacies/{id}', { id }), { method: 'PUT', body: JSON.stringify(apiPayload({ ...cleanPharmacyPayload(payload), isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : (payload.status !== undefined ? String(payload.status).toLowerCase() === 'active' : true), IsActive: payload.isActive !== undefined ? Boolean(payload.isActive) : (payload.status !== undefined ? String(payload.status).toLowerCase() === 'active' : true) })) })
export const changeSuperAdminPharmacyStatus = (id, payload) => request(replacePathParams('pharmacy-super-admin/pharmacies/{id}/status', { id }), { method: 'PATCH', body: JSON.stringify(apiPayload(superAdminStatusPayload(payload))) })
export const deleteSuperAdminPharmacy = (id) => request(replacePathParams('pharmacy-super-admin/pharmacies/{id}', { id }), { method: 'DELETE' })
export const getSuperAdminBranches = (params = {}) => request('pharmacy-super-admin/branches' + queryString(params))
export const getSuperAdminBranch = (id) => request(replacePathParams('pharmacy-super-admin/branches/{id}', { id }))
export const changeSuperAdminHospitalStatus = (id, payload) => request(replacePathParams('pharmacy-super-admin/hospitals/{id}/status', { id }), { method: 'PATCH', body: JSON.stringify(apiPayload(superAdminStatusPayload(payload))) })
export const getSuperAdminMedicines = async (params = {}) => normalizeMedicineResponse(await request(`pharmacy-super-admin/medicines${queryString(params)}`))
export const changeSuperAdminMedicineStatus = (id, payload) => request(replacePathParams('pharmacy-super-admin/medicines/{id}/status', { id }), { method: 'PATCH', body: JSON.stringify(apiPayload(superAdminStatusPayload(payload))) })
export const getSuperAdminRevenueReport = (params = {}) => request(`pharmacy-super-admin/reports/revenue${queryString(params)}`)
export const exportSuperAdminRevenueExcel = (params = {}) => downloadRequest(`pharmacy-super-admin/reports/revenue/export-excel${queryString(params)}`, 'revenue-report.xlsx')
export const exportSuperAdminRevenuePdf = (params = {}) => downloadRequest(`pharmacy-super-admin/reports/revenue/export-pdf${queryString(params)}`, 'revenue-report.pdf')
export const getSuperAdminSettings = () => request('pharmacy-super-admin/settings')
export const updateSuperAdminSettings = (payload) => request('pharmacy-super-admin/settings', { method: 'PUT', body: JSON.stringify(apiPayload({ ...payload, isEnabled: payload.isEnabled ?? payload.IsEnabled ?? String(payload.status || '').toLowerCase() !== 'disabled' })) })
export const listSuperAdminRoles = async (params = {}) => {
  const response = await listPharmacyAdmins(params)
  const admins = Array.isArray(response) ? response : response?.data?.admins || response?.admins || response?.data || response?.items || []
  return {
    data: Array.isArray(admins)
      ? admins.map((admin) => ({
          ...admin,
          roleId: admin?.id || admin?.adminId || admin?.adminUserId || admin?.userId,
          roleName: admin?.name || admin?.fullName || admin?.adminName || admin?.email || 'Admin Permissions',
        }))
      : [],
  }
}
export const createSuperAdminRole = (payload) => request('pharmacy-super-admin/admins', { method: 'POST', body: JSON.stringify(apiPayload(payload)) })
export const updateSuperAdminRole = (id, payload) => updatePharmacyAdmin(id, payload)
export const deleteSuperAdminRole = (id) => request(replacePathParams('pharmacy-super-admin/admins/{id}', { id }), { method: 'DELETE' })
export const getSuperAdminRolePermissions = (roleId) => request(replacePathParams('pharmacy-super-admin/admins/{id}/permissions', { id: roleId }))
export const updateSuperAdminRolePermissions = (roleId, payload) => request(replacePathParams('pharmacy-super-admin/admins/{id}/permissions', { id: roleId }), { method: 'PUT', body: JSON.stringify(apiPayload(payload?.permissions || payload?.Permissions || payload)) })
export const listSuperAdminRoleDropdown = () => Promise.resolve({ data: [] })
export const getPharmacyAdminPermissionsForSuperAdmin = (adminId) => getSuperAdminRolePermissions(adminId)
export const updatePharmacyAdminPermissionsForSuperAdmin = (adminId, payload) => updateSuperAdminRolePermissions(adminId, payload)
export const getPharmacyAdminRole = (adminId) => Promise.resolve({ data: { role: { id: adminId, roleId: adminId } } })
export const assignPharmacyAdminRole = (adminId) => Promise.resolve({ data: { id: adminId, roleId: adminId } })
export const listSuperAdminNotifications = (params = {}) => request(`pharmacy-super-admin/notifications${queryString(params)}`)
export const sendSuperAdminNotification = (payload) => request('pharmacy-super-admin/notifications', { method: 'POST', body: JSON.stringify(apiPayload(payload)) })
export const deleteSuperAdminNotification = (id) => request(replacePathParams('pharmacy-super-admin/notifications/{id}', { id }), { method: 'DELETE' })
export const markSuperAdminNotificationRead = (id) => request(replacePathParams('pharmacy-super-admin/notifications/{id}/read', { id }), { method: 'PATCH' })
export const markAllSuperAdminNotificationsRead = () => request('pharmacy-super-admin/notifications/mark-all-read', { method: 'PATCH' })

export const listSuperAdminHospitals = (params = {}) => request(`pharmacy-super-admin/hospitals${queryString(params)}`)
export const listSuperAdminHospitalBranches = (hospitalId) => request(replacePathParams('pharmacy-super-admin/hospitals/{hospitalId}/branches', { hospitalId }))

export const findPharmacyMedicineByBarcode = (barcode) => request(replacePathParams('pharmacy/operations/barcode/{barcode}', { barcode }))
export const updatePharmacyMedicineControls = (medicineId, payload) => request(replacePathParams('pharmacy/operations/medicines/{medicineId}/controls', { medicineId }), { method: 'PUT', body: JSON.stringify(apiPayload(payload)) })
export const recallPharmacyMedicineBatch = (payload) => request('pharmacy/operations/recalls', { method: 'POST', body: JSON.stringify(apiPayload(payload)) })
export const openPharmacyShift = (payload) => request('pharmacy/operations/shifts/open', { method: 'POST', body: JSON.stringify(apiPayload(payload)) })
export const getPharmacyShift = (id) => request(replacePathParams('pharmacy/operations/shifts/{id}', { id }))
export const closePharmacyShift = (id, payload) => request(replacePathParams('pharmacy/operations/shifts/{id}/close', { id }), { method: 'POST', body: JSON.stringify(apiPayload(payload)) })
export const createSupplierInvoice = (payload) => request('pharmacy/operations/supplier-invoices', { method: 'POST', body: JSON.stringify(apiPayload(payload)) })
export const splitBillPayment = (billId, payload) => request(replacePathParams('pharmacy/operations/bills/{billId}/split-payment', { billId }), { method: 'POST', body: JSON.stringify(apiPayload(payload)) })

export const getInventoryStockDetails = (params = {}) => request(`inventory/stock-details${queryString(params)}`)

export const createMedicineImportRow = (importId, payload) => request(replacePathParams('medicine-import/{importId}/rows', { importId }), { authRole: 'pharmacyAdmin', method: 'POST', body: JSON.stringify(apiPayload(payload)) })
export const listMedicineImportRows = (importId) => request(replacePathParams('medicine-import/{importId}/rows', { importId }), { authRole: 'pharmacyAdmin' })
export const updateMedicineImportRow = (importId, rowId, payload) => request(replacePathParams('medicine-import/{importId}/rows/{rowId}', { importId, rowId }), { authRole: 'pharmacyAdmin', method: 'PUT', body: JSON.stringify(apiPayload(payload)) })
export const deleteMedicineImportRow = (importId, rowId) => request(replacePathParams('medicine-import/{importId}/rows/{rowId}', { importId, rowId }), { authRole: 'pharmacyAdmin', method: 'DELETE' })














