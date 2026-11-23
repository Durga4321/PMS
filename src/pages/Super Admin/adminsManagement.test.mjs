import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  apiUrl,
  listPharmacyAdmins,
  getSuperAdminAuditLogs,
  authTokenFor,
} from '../../config/api.js'

// Extract logic matching Admins.jsx helpers for verification
function unwrapAdmin(item) {
  if (!item || typeof item !== 'object') return item
  if (item.admin && typeof item.admin === 'object') return item.admin
  if (item.data && typeof item.data === 'object' && !item.name && !item.email && !item.id && !item.adminId && !item.adminUserId) {
    return item.data.admin || item.data
  }
  return item
}

function normalizeList(response) {
  const body = response?.data ?? response
  if (Array.isArray(body)) return body.map(unwrapAdmin)
  if (Array.isArray(body?.admins)) return body.admins.map(unwrapAdmin)
  if (Array.isArray(body?.items)) return body.items.map(unwrapAdmin)
  if (Array.isArray(body?.results)) return body.results.map(unwrapAdmin)
  if (Array.isArray(body?.data)) return body.data.map(unwrapAdmin)
  if (Array.isArray(body?.list)) return body.list.map(unwrapAdmin)
  if (Array.isArray(body?.rows)) return body.rows.map(unwrapAdmin)
  if (Array.isArray(response?.admins)) return response.admins.map(unwrapAdmin)
  if (Array.isArray(response?.items)) return response.items.map(unwrapAdmin)
  if (Array.isArray(response?.results)) return response.results.map(unwrapAdmin)
  if (Array.isArray(response?.data?.admins)) return response.data.admins.map(unwrapAdmin)
  if (Array.isArray(response?.data?.items)) return response.data.items.map(unwrapAdmin)
  if (Array.isArray(response?.data?.results)) return response.data.results.map(unwrapAdmin)
  if (Array.isArray(response?.data?.pharmacies)) return response.data.pharmacies.map(unwrapAdmin)
  if (Array.isArray(response?.pharmacies)) return response.pharmacies.map(unwrapAdmin)
  return []
}

function getId(item) {
  if (!item) return ''
  const val =
    item.id ??
    item.adminId ??
    item.adminUserId ??
    item.userId ??
    item.AdminId ??
    item.AdminUserId ??
    item.UserId ??
    item.Id ??
    item._id ??
    item.pharmacyId ??
    item.PharmacyId ??
    item.hospitalId ??
    item.branchId ??
    item.uuid ??
    ''
  return String(val)
}

function getName(item) {
  if (!item) return 'Pharmacy Admin'
  const val = item.name || item.fullName || item.adminName || item.pharmacyAdminName || item.userName || item.email
  if (typeof val === 'string' && val.trim()) return val.trim()
  if (typeof val === 'object' && val !== null) {
    const combined = [val.firstName, val.lastName].filter(Boolean).join(' ')
    if (combined.trim()) return combined.trim()
    if (val.name) return String(val.name).trim()
  }
  return 'Pharmacy Admin'
}

function getInitials(name) {
  const str = String(name || '').trim()
  if (!str) return 'PA'
  const parts = str.split(/\s+/).filter(Boolean)
  if (!parts.length) return 'PA'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return parts.slice(0, 2).map((part) => part.charAt(0)).join('').toUpperCase() || 'PA'
}

function getStatus(item) {
  const value = item?.status ?? item?.isActive
  if (typeof value === 'boolean') return value ? 'Active' : 'Inactive'
  if (typeof value === 'number') return value === 1 ? 'Active' : 'Inactive'
  if (typeof value === 'string' && value.trim()) {
    const s = value.trim().toLowerCase()
    if (s === 'active' || s === 'true' || s === '1') return 'Active'
    if (s === 'inactive' || s === 'false' || s === '0' || s === 'deactivated' || s === 'disabled') return 'Inactive'
    return value
  }
  return 'Active'
}

function getAssignedPharmacyName(item, pharmacyOptions = []) {
  const admin = unwrapAdmin(item)
  const direct = admin?.pharmacyName || admin?.PharmacyName || admin?.pharmacy?.name || admin?.assignedPharmacy?.name || '-'
  if (direct && direct !== '-') return direct

  const pId = admin?.pharmacyId || admin?.PharmacyId
  if (pId && Array.isArray(pharmacyOptions)) {
    const matched = pharmacyOptions.find((p) => String(getId(p)) === String(pId))
    if (matched) return matched.pharmacyName || matched.name || '-'
  }
  return '-'
}

function filterAdmins(admins, query, statusFilter, pharmacyOptions = []) {
  const q = query.trim().toLowerCase()
  return admins.filter((admin) => {
    const adminStatus = String(getStatus(admin)).toLowerCase()
    if (statusFilter !== 'All' && adminStatus !== statusFilter.toLowerCase()) {
      return false
    }

    if (!q) return true

    const name = getName(admin).toLowerCase()
    const email = String(admin?.email || '').toLowerCase()
    const pharmacy = String(getAssignedPharmacyName(admin, pharmacyOptions) || '').toLowerCase()
    const city = String(admin?.city || admin?.City || '').toLowerCase()
    const mobile = String(admin?.mobileNumber || admin?.phone || '').toLowerCase()

    return (
      name.includes(q) ||
      email.includes(q) ||
      pharmacy.includes(q) ||
      city.includes(q) ||
      mobile.includes(q) ||
      JSON.stringify(admin).toLowerCase().includes(q)
    )
  })
}

test('[Admin Management] getId handles all database and DTO identifier shapes', () => {
  assert.equal(getId({ id: 10 }), '10')
  assert.equal(getId({ adminId: 20 }), '20')
  assert.equal(getId({ adminUserId: 30 }), '30')
  assert.equal(getId({ userId: 40 }), '40')
  assert.equal(getId({ AdminId: 50 }), '50')
  assert.equal(getId({ AdminUserId: 60 }), '60')
  assert.equal(getId({ UserId: 70 }), '70')
  assert.equal(getId({ _id: 'mongo-80' }), 'mongo-80')
  assert.equal(getId({ uuid: 'uuid-90' }), 'uuid-90')
  assert.equal(getId({ pharmacyId: 100 }), '100')
  assert.equal(getId(null), '')
  assert.equal(getId({}), '')
})

test('[Admin Management] getName and getInitials safely handle strings, nulls, and nested objects', () => {
  assert.equal(getName({ name: 'Ravi Kumar' }), 'Ravi Kumar')
  assert.equal(getInitials('Ravi Kumar'), 'RK')

  assert.equal(getName({ fullName: 'Priya Sharma' }), 'Priya Sharma')
  assert.equal(getInitials('Priya Sharma'), 'PS')

  assert.equal(getName({ adminName: 'SingleWord' }), 'SingleWord')
  assert.equal(getInitials('SingleWord'), 'SI')

  // Handles structured name object safely without throwing .split TypeError
  assert.equal(getName({ name: { firstName: 'Kiran', lastName: 'Reddy' } }), 'Kiran Reddy')
  assert.equal(getInitials(getName({ name: { firstName: 'Kiran', lastName: 'Reddy' } })), 'KR')

  // Empty / fallback
  assert.equal(getName(null), 'Pharmacy Admin')
  assert.equal(getName({}), 'Pharmacy Admin')
  assert.equal(getInitials(''), 'PA')
  assert.equal(getInitials(null), 'PA')
})

test('[Admin Management] normalizeList extracts array from various envelope structures', () => {
  const admin1 = { id: 1, name: 'Admin 1' }
  const admin2 = { id: 2, name: 'Admin 2' }

  // Direct array
  assert.deepEqual(normalizeList([admin1, admin2]), [admin1, admin2])

  // { data: [ ... ] }
  assert.deepEqual(normalizeList({ data: [admin1, admin2] }), [admin1, admin2])

  // { data: { admins: [ ... ] } }
  assert.deepEqual(normalizeList({ data: { admins: [admin1, admin2] } }), [admin1, admin2])

  // { total: 8, admins: [ ... ] }
  assert.deepEqual(normalizeList({ total: 2, admins: [admin1, admin2] }), [admin1, admin2])

  // { data: { items: [ ... ] } }
  assert.deepEqual(normalizeList({ data: { items: [admin1, admin2] } }), [admin1, admin2])

  // Empty or invalid responses return safe []
  assert.deepEqual(normalizeList(null), [])
  assert.deepEqual(normalizeList({}), [])
  assert.deepEqual(normalizeList({ message: 'Error' }), [])
})

test('[Admin Management] getStatus correctly normalizes boolean, integer, and string statuses', () => {
  assert.equal(getStatus({ isActive: true }), 'Active')
  assert.equal(getStatus({ isActive: false }), 'Inactive')
  assert.equal(getStatus({ status: 'active' }), 'Active')
  assert.equal(getStatus({ status: 'inactive' }), 'Inactive')
  assert.equal(getStatus({ status: 'Inactive' }), 'Inactive')
  assert.equal(getStatus({ isActive: 1 }), 'Active')
  assert.equal(getStatus({ isActive: 0 }), 'Inactive')
  assert.equal(getStatus({ status: 'disabled' }), 'Inactive')
})

test('[Admin Management] Search filters accurately across name, email, pharmacy, and city', () => {
  const pharmacyOptions = [
    { id: '101', name: 'Apollo Hyderabad Central' },
    { id: '102', name: 'MedPlus Vijayawada' },
  ]

  const mockAdmins = [
    { id: 1, name: 'Suresh Patel', email: 'suresh@apollo.com', pharmacyId: '101', city: 'Hyderabad', isActive: true, mobileNumber: '9848011223' },
    { id: 2, name: 'Ananya Rao', email: 'ananya@medplus.com', pharmacyId: '102', city: 'Vijayawada', isActive: false, mobileNumber: '9848099887' },
    { id: 3, name: 'Vikram Singh', email: 'vikram@care.com', pharmacyName: 'Care Pharmacy', city: 'Warangal', isActive: true, mobileNumber: '9123456780' },
  ]

  // Search by name
  const nameResult = filterAdmins(mockAdmins, 'suresh', 'All', pharmacyOptions)
  assert.equal(nameResult.length, 1)
  assert.equal(nameResult[0].id, 1)

  // Search by email
  const emailResult = filterAdmins(mockAdmins, 'ananya@medplus', 'All', pharmacyOptions)
  assert.equal(emailResult.length, 1)
  assert.equal(emailResult[0].id, 2)

  // Search by pharmacy name (resolved from pharmacyId via pharmacyOptions)
  const pharmacyResult = filterAdmins(mockAdmins, 'apollo', 'All', pharmacyOptions)
  assert.equal(pharmacyResult.length, 1)
  assert.equal(pharmacyResult[0].id, 1)

  // Search by city
  const cityResult = filterAdmins(mockAdmins, 'warangal', 'All', pharmacyOptions)
  assert.equal(cityResult.length, 1)
  assert.equal(cityResult[0].id, 3)

  // Status filtering combined with search
  const activeOnly = filterAdmins(mockAdmins, '', 'Active', pharmacyOptions)
  assert.equal(activeOnly.length, 2)
  const inactiveOnly = filterAdmins(mockAdmins, '', 'Inactive', pharmacyOptions)
  assert.equal(inactiveOnly.length, 1)
  assert.equal(inactiveOnly[0].id, 2)
})

test('[Admin Management] Pagination and page size selection slices items correctly and clamps page', () => {
  const mock8Admins = Array.from({ length: 8 }, (_, i) => ({
    id: i + 1,
    name: `Admin ${i + 1}`,
    email: `admin${i + 1}@pms.com`,
    isActive: true,
  }))

  // With pageSize 5, total pages = 2
  let pageSize = 5
  let page = 1
  let visible = mock8Admins.slice((page - 1) * pageSize, page * pageSize)
  assert.equal(visible.length, 5)
  assert.equal(visible[0].id, 1)
  assert.equal(visible[4].id, 5)

  // Page 2 shows remaining 3
  page = 2
  visible = mock8Admins.slice((page - 1) * pageSize, page * pageSize)
  assert.equal(visible.length, 3)
  assert.equal(visible[0].id, 6)
  assert.equal(visible[2].id, 8)

  // Switching page size to 10 displays all 8 admins
  pageSize = 10
  page = 1
  visible = mock8Admins.slice((page - 1) * pageSize, page * pageSize)
  assert.equal(visible.length, 8)

  // Clamping prevents out-of-range empty table when page exceeds total pages
  const stalePage = 4
  const pageCount = Math.max(1, Math.ceil(mock8Admins.length / pageSize)) // = 1
  const clampedPage = stalePage > pageCount ? pageCount : stalePage
  assert.equal(clampedPage, 1)
  visible = mock8Admins.slice((clampedPage - 1) * pageSize, clampedPage * pageSize)
  assert.equal(visible.length, 8, 'Clamped page ensures rows are visible, preventing empty table')
})

test('[Admin Management] API endpoint paths and authentication configuration', () => {
  // Test apiUrl formats
  const adminsUrl = apiUrl('pharmacy-super-admin/admins')
  assert.match(adminsUrl, /\/api\/pharmacy-super-admin\/admins$/)
  assert.doesNotMatch(adminsUrl, /\/api\/api\//)

  const auditLogsUrl = apiUrl('pharmacy-super-admin/audit-logs')
  assert.match(auditLogsUrl, /\/api\/pharmacy-super-admin\/audit-logs$/)
  assert.doesNotMatch(auditLogsUrl, /\/api\/api\//)

  // Test authTokenFor attaches superAdminToken for pharmacy-super-admin routes
  const mockStorage = new Map()
  mockStorage.set('superAdminToken', 'mock-super-admin-jwt-token')
  globalThis.sessionStorage = {
    getItem: (k) => mockStorage.get(k) || null,
    setItem: (k, v) => mockStorage.set(k, v),
  }
  globalThis.localStorage = {
    getItem: (k) => mockStorage.get(k) || null,
    setItem: (k, v) => mockStorage.set(k, v),
  }

  const token = authTokenFor('pharmacy-super-admin/admins', 'superAdmin')
  assert.equal(token, 'mock-super-admin-jwt-token')

  const auditToken = authTokenFor('pharmacy-super-admin/audit-logs', 'superAdmin')
  assert.equal(auditToken, 'mock-super-admin-jwt-token')
})
