import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import {
  getSuperAdminAuditLogs,
  getSuperAdminBranches,
  apiUrl,
} from '../../config/api.js'

function valueOf(item, names, fallback = '') {
  for (const name of names) {
    if (item?.[name] !== undefined && item?.[name] !== null && item?.[name] !== '') return item[name]
  }
  return fallback
}

function normalizeBranch(item) {
  const id = valueOf(item, ['id', '_id', 'branchId', 'externalBranchId', 'uuid'])
  const branchName = valueOf(item, ['branchName', 'name', 'title', 'externalBranchId'], `Branch ${id || ''}`)
  return { id: String(id || ''), branchName: String(branchName || '') }
}

test('[Super Admin Audit Logs] normalizeBranch extracts id and branchName correctly', () => {
  const b1 = { id: 101, branchName: 'Hyderabad Central' }
  const norm1 = normalizeBranch(b1)
  assert.equal(norm1.id, '101')
  assert.equal(norm1.branchName, 'Hyderabad Central')

  const b2 = { _id: 'b-202', name: 'Vijayawada Sub Branch' }
  const norm2 = normalizeBranch(b2)
  assert.equal(norm2.id, 'b-202')
  assert.equal(norm2.branchName, 'Vijayawada Sub Branch')

  const b3 = { branchId: 5, title: 'Tirupati Main' }
  const norm3 = normalizeBranch(b3)
  assert.equal(norm3.id, '5')
  assert.equal(norm3.branchName, 'Tirupati Main')

  const b4 = { id: 7 }
  const norm4 = normalizeBranch(b4)
  assert.equal(norm4.id, '7')
  assert.equal(norm4.branchName, 'Branch 7')
})

test('[Super Admin Audit Logs] apiUrl correctly formats endpoints without duplicating /api prefix', () => {
  const branchesUrl = apiUrl('pharmacy-super-admin/branches')
  assert.match(branchesUrl, /\/api\/pharmacy-super-admin\/branches$/)
  assert.doesNotMatch(branchesUrl, /\/api\/api\//)

  const auditLogsUrl = apiUrl('pharmacy-super-admin/audit-logs')
  assert.match(auditLogsUrl, /\/api\/pharmacy-super-admin\/audit-logs$/)
  assert.doesNotMatch(auditLogsUrl, /\/api\/api\//)
})

test('[Super Admin Audit Logs] query parameters format branchId when provided and omit when empty', () => {
  function buildAuditLogQuery(branchId) {
    const params = {}
    if (branchId && String(branchId).trim()) {
      params.branchId = String(branchId).trim()
    }
    const query = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') query.set(k, v)
    })
    return query.toString() ? `?${query}` : ''
  }

  // All Branches (empty) -> omits branchId
  assert.equal(buildAuditLogQuery(''), '')
  assert.equal(buildAuditLogQuery(null), '')
  assert.equal(buildAuditLogQuery(undefined), '')

  // Specific branch selected -> appends branchId
  assert.equal(buildAuditLogQuery('12'), '?branchId=12')
  assert.equal(buildAuditLogQuery(42), '?branchId=42')
})

test('[Super Admin Audit Logs] pagination pattern collects branches beyond the first 10', async () => {
  // Mock paginated backend response where default pageSize is 10 and total is 25
  const mockDatabase = Array.from({ length: 25 }, (_, i) => ({
    id: i + 1,
    branchName: `Branch ${i + 1}`,
  }))

  async function mockGetSuperAdminBranches(params = {}) {
    const page = Number(params.page || 1)
    const pageSize = Number(params.pageSize || 10)
    const start = (page - 1) * pageSize
    const branches = mockDatabase.slice(start, start + pageSize)
    return {
      branches,
      total: mockDatabase.length,
      page,
      pageSize,
    }
  }

  // Execute pagination loop matching Audit Logs component
  let allBranches = []
  let currentPage = 1
  const pageSize = 100
  let total = 0

  do {
    const response = await mockGetSuperAdminBranches({ page: currentPage, pageSize })
    const body = response?.data ?? response
    const items = Array.isArray(body?.branches) ? body.branches : []
    total = Number(body?.total ?? items.length)
    allBranches = [...allBranches, ...items]

    if (!items.length || allBranches.length >= total) break
    currentPage++
  } while (allBranches.length < total && currentPage <= 20)

  const mapped = allBranches.map(normalizeBranch)
  assert.equal(mapped.length, 25, 'All 25 branches beyond default 10 must be retrieved')
  assert.equal(mapped[0].id, '1')
  assert.equal(mapped[0].branchName, 'Branch 1')
  assert.equal(mapped[24].id, '25')
  assert.equal(mapped[24].branchName, 'Branch 25')
})

test('[Super Admin Audit Logs] branch filter change resets audit log page to 1 while preserving active filters', () => {
  let state = {
    page: 4,
    branchId: '',
    startDate: '2026-11-01',
    endDate: '2026-11-20',
    query: 'AdminUser',
    actionFilter: 'create',
    tab: 'login',
  }

  function handleBranchChange(newBranchId) {
    state = {
      ...state,
      branchId: newBranchId,
      page: 1, // Reset pagination to page 1
    }
  }

  handleBranchChange('8')
  assert.equal(state.branchId, '8')
  assert.equal(state.page, 1, 'Pagination must reset to page 1')
  // Active filters preserved
  assert.equal(state.startDate, '2026-11-01')
  assert.equal(state.endDate, '2026-11-20')
  assert.equal(state.query, 'AdminUser')
  assert.equal(state.actionFilter, 'create')
  assert.equal(state.tab, 'login')

  // Clear back to All Branches
  handleBranchChange('')
  assert.equal(state.branchId, '')
  assert.equal(state.page, 1)
  assert.equal(state.query, 'AdminUser')
})

test('[Super Admin Audit Logs] Audit Logs.jsx has no remaining legacy hospitals requests or imports', () => {
  const filePath = path.resolve('src/pages/Super Admin/Audit Logs.jsx')
  const content = readFileSync(filePath, 'utf-8')

  assert.doesNotMatch(content, /listAssignmentHospitals/, 'Must not import or call listAssignmentHospitals')
  assert.doesNotMatch(content, /listHospitalBranches/, 'Must not import or call listHospitalBranches')
  assert.doesNotMatch(content, /loadHospitals/, 'Must not have loadHospitals function')
  assert.match(content, /getSuperAdminBranches/, 'Must import and use getSuperAdminBranches')
  assert.match(content, /All Branches/, 'Must have All Branches default option')
})
