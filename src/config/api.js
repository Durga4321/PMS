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
    localStorage.getItem('pharmacyAdminToken')

  const response = await fetch(apiUrl(path), {
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
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

export function getPharmacyAdminAssignmentStatus() {
  return request('pharmacy-admin-auth/assignment-status')
}

export function changePharmacyAdminPassword(payload) {
  return request('pharmacy-admin-auth/change-password', {
    method: 'POST',
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
