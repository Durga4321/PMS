import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  apiUrl,
  authTokenFor,
  getSuperAdminPharmacies,
  getSuperAdminRevenueReport,
  exportSuperAdminRevenueExcel,
  exportSuperAdminRevenuePdf,
} from '../../config/api.js'

// Extract logic matching Reports.jsx helpers for thorough unit testing
function valueOf(item, names, fallback = '') {
  if (!item || typeof item !== 'object') return fallback
  for (const name of names) {
    if (item[name] !== undefined && item[name] !== null && item[name] !== '') {
      return item[name]
    }
  }
  return fallback
}

function numeric(value) {
  const parsed = Number(String(value ?? '').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

function recordsFrom(response) {
  if (Array.isArray(response)) return response
  return ['data', 'items', 'results', 'reports', 'rows', 'records'].reduce(
    (records, key) => (records.length ? records : Array.isArray(response?.[key]) ? response[key] : []),
    []
  )
}

function unwrapList(response, preferredKey) {
  const body = response?.data ?? response
  if (Array.isArray(body)) return body
  if (preferredKey && Array.isArray(body?.[preferredKey])) return body[preferredKey]
  if (Array.isArray(body?.pharmacies)) return body.pharmacies
  if (Array.isArray(body?.admins)) return body.admins
  if (Array.isArray(body?.items)) return body.items
  if (Array.isArray(body?.results)) return body.results
  if (Array.isArray(body?.data)) return body.data
  return []
}

function getOptionId(item) {
  if (!item) return ''
  return String(item.id ?? item.pharmacyId ?? item.adminId ?? item.userId ?? item.AdminId ?? item._id ?? '')
}

function getAdminName(admin) {
  if (!admin) return 'Unassigned'
  return admin.name || admin.fullName || admin.adminName || admin.userName || admin.email || 'Admin'
}

function getPharmacyName(pharmacy) {
  if (!pharmacy) return 'All Branches'
  return pharmacy.pharmacyName || pharmacy.name || pharmacy.branchName || `Branch ${pharmacy.id || ''}`
}

function normalize(item, index, adminOptions = [], pharmacyOptions = []) {
  const adminId = valueOf(item, ['adminId', 'AdminId', 'pharmacyAdminId', 'userId'])
  let admin = valueOf(item, ['adminName', 'admin', 'createdBy', 'pharmacyAdmin', 'assignedAdminName'], '')
  if (!admin && adminId && adminOptions.length) {
    const matched = adminOptions.find((a) => String(getOptionId(a)) === String(adminId))
    if (matched) admin = getAdminName(matched)
  }
  if (!admin) admin = 'Unassigned'

  const pharmacyId = valueOf(item, ['pharmacyId', 'PharmacyId', 'branchId', 'BranchId', 'hospitalId'])
  let branch = valueOf(item, ['branchName', 'branch', 'pharmacyName', 'name'], '')
  if (!branch && pharmacyId && pharmacyOptions.length) {
    const matched = pharmacyOptions.find((p) => String(getOptionId(p)) === String(pharmacyId))
    if (matched) branch = getPharmacyName(matched)
  }
  if (!branch) branch = 'Main Branch'

  const purchases = numeric(valueOf(item, ['purchases', 'purchaseAmount', 'totalPurchases']))
  const sales = numeric(valueOf(item, ['sales', 'salesAmount', 'totalSales', 'saleAmount']))
  const prescriptions = numeric(valueOf(item, ['prescriptions', 'prescriptionCount', 'totalPrescriptions', 'orders', 'orderCount']))
  const gst = numeric(valueOf(item, ['gst', 'gstAmount', 'totalGst', 'tax']))
  const revenue = numeric(valueOf(item, ['totalRevenue', 'revenue', 'amount', 'netRevenue', 'total'])) || (sales + gst)
  const performanceVal = valueOf(item, ['branchPerformance', 'performance', 'performanceScore'])
  const performance = performanceVal !== '' && performanceVal !== null ? numeric(performanceVal) : null

  return {
    id: valueOf(item, ['_id', 'id', 'reportId'], `rep_${index + 1}`),
    adminId: String(adminId || ''),
    pharmacyId: String(pharmacyId || ''),
    admin,
    branch,
    date: valueOf(item, ['date', 'reportDate', 'saleDate', 'createdAt'], ''),
    status: valueOf(item, ['status', 'reportStatus', 'paymentStatus'], 'Completed'),
    purchases,
    sales,
    prescriptions,
    gst,
    revenue,
    performance,
  }
}

function filterRecords(records, { query = '', adminFilter = '', branchFilter = '', filter = 'All', startDate = '', endDate = '' }) {
  return records.filter((record) => {
    const text = [record.admin, record.branch, record.revenue, record.sales, record.status].join(' ').toLowerCase()
    const matchesQuery = !query.trim() || text.includes(query.trim().toLowerCase())
    const date = record.date ? new Date(record.date) : null
    const matchesStart = !startDate || !date || date >= new Date(`${startDate}T00:00:00`)
    const matchesEnd = !endDate || !date || date <= new Date(`${endDate}T23:59:59`)
    const matchesStatus = filter === 'All' || String(record.status || '').toLowerCase() === filter.toLowerCase()
    const matchesAdmin =
      !adminFilter ||
      String(record.adminId || '').toLowerCase() === adminFilter.toLowerCase() ||
      String(record.admin || '').toLowerCase() === adminFilter.toLowerCase() ||
      String(record.admin || '').toLowerCase().includes(adminFilter.toLowerCase())
    const matchesBranch =
      !branchFilter ||
      String(record.pharmacyId || '').toLowerCase() === branchFilter.toLowerCase() ||
      String(record.branch || '').toLowerCase() === branchFilter.toLowerCase() ||
      String(record.branch || '').toLowerCase().includes(branchFilter.toLowerCase())
    return matchesQuery && matchesStart && matchesEnd && matchesStatus && matchesAdmin && matchesBranch
  })
}

// ==================== TESTS ====================

test('[Reports] apiUrl and authTokenFor attach superAdminToken for reports and pharmacies endpoints', () => {
  const reportsUrl = apiUrl('pharmacy-super-admin/reports/revenue')
  assert.match(reportsUrl, /\/api\/pharmacy-super-admin\/reports\/revenue$/)
  assert.doesNotMatch(reportsUrl, /\/api\/api\//)

  const pharmaciesUrl = apiUrl('pharmacy-super-admin/pharmacies')
  assert.match(pharmaciesUrl, /\/api\/pharmacy-super-admin\/pharmacies$/)

  const mockStorage = new Map()
  mockStorage.set('superAdminToken', 'mock-super-admin-token-123')
  globalThis.sessionStorage = { getItem: (k) => mockStorage.get(k) || null, setItem: (k, v) => mockStorage.set(k, v) }
  globalThis.localStorage = { getItem: (k) => mockStorage.get(k) || null, setItem: (k, v) => mockStorage.set(k, v) }

  const token = authTokenFor('pharmacy-super-admin/reports/revenue', 'superAdmin')
  assert.equal(token, 'mock-super-admin-token-123')
})

test('[Reports] unwrapList and getOptionId correctly extract items across all envelope variations', () => {
  // Direct array
  assert.equal(unwrapList([{ id: 1 }]).length, 1)

  // Enveloped in data
  assert.equal(unwrapList({ data: [{ id: 2 }] }).length, 1)

  // Enveloped in pharmacies
  assert.equal(unwrapList({ pharmacies: [{ id: 3 }, { id: 4 }] }).length, 2)

  // Enveloped in admins
  assert.equal(unwrapList({ admins: [{ id: 5 }] }).length, 1)

  // Preferred key
  assert.equal(unwrapList({ data: { custom: [{ id: 6 }] } }, 'custom').length, 1)

  // getOptionId handles various ID fields
  assert.equal(getOptionId({ id: 10 }), '10')
  assert.equal(getOptionId({ pharmacyId: 20 }), '20')
  assert.equal(getOptionId({ adminId: 30 }), '30')
  assert.equal(getOptionId({ userId: 40 }), '40')
  assert.equal(getOptionId({ _id: 'mongo_50' }), 'mongo_50')
  assert.equal(getOptionId(null), '')
})

test('[Reports] normalize accurately maps IDs and formats report metrics', () => {
  const adminOptions = [
    { id: '101', name: 'Dr. Ramesh Kumar' },
    { id: '102', name: 'Priya Sharma' },
  ]
  const pharmacyOptions = [
    { id: '501', pharmacyName: 'Apollo Jubilee Hills' },
    { id: '502', pharmacyName: 'MedPlus Banjara Hills' },
  ]

  const rawRecord = {
    id: 'rep_1',
    adminId: '101',
    pharmacyId: '501',
    date: '2026-11-15T10:00:00',
    status: 'Completed',
    purchases: 45000,
    sales: 85000,
    prescriptions: 120,
    gst: 15300,
    totalRevenue: 100300,
    branchPerformance: 94,
  }

  const normalized = normalize(rawRecord, 0, adminOptions, pharmacyOptions)
  assert.equal(normalized.id, 'rep_1')
  assert.equal(normalized.admin, 'Dr. Ramesh Kumar')
  assert.equal(normalized.branch, 'Apollo Jubilee Hills')
  assert.equal(normalized.purchases, 45000)
  assert.equal(normalized.sales, 85000)
  assert.equal(normalized.prescriptions, 120)
  assert.equal(normalized.gst, 15300)
  assert.equal(normalized.revenue, 100300)
  assert.equal(normalized.performance, 94)
  assert.equal(normalized.status, 'Completed')
})

test('[Reports] filterRecords filters by query, admin, branch, status, and date range', () => {
  const sampleRecords = [
    {
      id: '1',
      adminId: '101',
      admin: 'Ramesh Kumar',
      pharmacyId: '501',
      branch: 'Apollo Jubilee Hills',
      date: '2026-11-10T10:00:00',
      status: 'Completed',
      sales: 50000,
      revenue: 60000,
    },
    {
      id: '2',
      adminId: '102',
      admin: 'Priya Sharma',
      pharmacyId: '502',
      branch: 'MedPlus Banjara Hills',
      date: '2026-11-15T12:00:00',
      status: 'Pending',
      sales: 75000,
      revenue: 88000,
    },
    {
      id: '3',
      adminId: '101',
      admin: 'Ramesh Kumar',
      pharmacyId: '503',
      branch: 'Care Pharmacy Secunderabad',
      date: '2026-11-20T14:00:00',
      status: 'Cancelled',
      sales: 20000,
      revenue: 23600,
    },
  ]

  // Query filter (matches branch)
  const queryResult = filterRecords(sampleRecords, { query: 'jubilee' })
  assert.equal(queryResult.length, 1)
  assert.equal(queryResult[0].id, '1')

  // Admin filter
  const adminResult = filterRecords(sampleRecords, { adminFilter: '101' })
  assert.equal(adminResult.length, 2)

  // Branch filter
  const branchResult = filterRecords(sampleRecords, { branchFilter: '502' })
  assert.equal(branchResult.length, 1)
  assert.equal(branchResult[0].branch, 'MedPlus Banjara Hills')

  // Status filter
  const pendingResult = filterRecords(sampleRecords, { filter: 'Pending' })
  assert.equal(pendingResult.length, 1)
  assert.equal(pendingResult[0].id, '2')

  // Date range filter
  const dateResult = filterRecords(sampleRecords, { startDate: '2026-11-12', endDate: '2026-11-18' })
  assert.equal(dateResult.length, 1)
  assert.equal(dateResult[0].id, '2')
})

test('[Reports] getSuperAdminRevenueReport calls primary endpoint with authRole: superAdmin', async () => {
  const originalFetch = globalThis.fetch
  let calledUrl = ''
  let calledHeaders = {}

  globalThis.fetch = async (url, options = {}) => {
    calledUrl = String(url)
    calledHeaders = options.headers || {}
    return {
      ok: true,
      status: 200,
      headers: {
        get: (h) => (h && h.toLowerCase() === 'content-type' ? 'application/json' : null),
      },
      json: async () => ({
        success: true,
        data: [
          {
            id: 1,
            pharmacyName: 'Primary Test Branch',
            totalRevenue: 125000,
            sales: 100000,
            purchases: 60000,
            gst: 18000,
            prescriptions: 250,
            branchPerformance: 92,
            adminName: 'Super Admin',
          },
        ],
      }),
    }
  }

  try {
    const res = await getSuperAdminRevenueReport({
      startDate: '2026-11-01',
      endDate: '2026-11-30',
      pharmacyId: 501,
    })

    assert.match(calledUrl, /pharmacy-super-admin\/reports\/revenue/)
    assert.match(calledUrl, /startDate=2026-11-01/)
    assert.match(calledUrl, /endDate=2026-11-30/)
    assert.match(calledUrl, /pharmacyId=501/)
    assert.equal(calledHeaders.Authorization, 'Bearer mock-super-admin-token-123')

    const records = recordsFrom(res)
    assert.equal(records.length, 1)
    assert.equal(records[0].pharmacyName, 'Primary Test Branch')
    assert.equal(records[0].totalRevenue, 125000)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('[Reports] export functions accept in-memory records directly without triggering fetch', async () => {
  const originalFetch = globalThis.fetch
  let fetchCallCount = 0

  globalThis.fetch = async () => {
    fetchCallCount++
    return { ok: true, json: async () => ({}) }
  }

  const preloadedRecords = [
    {
      admin: 'Test Admin',
      branch: 'Test Branch',
      purchases: 1000,
      sales: 2000,
      prescriptions: 5,
      gst: 360,
      revenue: 2360,
      performance: 95,
      status: 'Completed',
    },
  ]

  try {
    // Calling exportSuperAdminRevenueExcel with preloaded array does not trigger fetch
    await exportSuperAdminRevenueExcel(preloadedRecords)
    assert.equal(fetchCallCount, 0, 'No network fetch should occur when records are passed directly')

    // Calling exportSuperAdminRevenuePdf with preloaded array does not trigger fetch
    await exportSuperAdminRevenuePdf(preloadedRecords)
    assert.equal(fetchCallCount, 0, 'No network fetch should occur for PDF export with preloaded records')
  } finally {
    globalThis.fetch = originalFetch
  }
})
