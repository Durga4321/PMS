import { useEffect, useMemo, useState, useCallback } from 'react'
import { getSuperAdminAuditLogs, getSuperAdminBranches } from '../../config/api'
import SuperAdminSidebar from './SuperAdminSidebar'
import SuperAdminTopbar from './SuperAdminTopbar'
import './Audit Logs.css'

const PAGE_SIZE = 10

function Icon({ children }) {
  return <svg className="audit-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">{children}</svg>
}

function listFrom(response, keys = ['data', 'items', 'results', 'records', 'logs', 'audits']) {
  if (Array.isArray(response)) return response
  for (const key of keys) {
    if (Array.isArray(response?.[key])) return response[key]
    if (Array.isArray(response?.data?.[key])) return response.data[key]
  }
  return []
}

function valueOf(item, names, fallback = '') {
  for (const name of names) {
    if (item?.[name] !== undefined && item?.[name] !== null && item?.[name] !== '') return item[name]
  }
  return fallback
}

function idOf(item) {
  return valueOf(item, ['_id', 'id', 'auditId', 'logId', 'uuid'])
}

function normalizeRole(value) {
  const role = String(value || 'Pharmacist').toLowerCase().replace(/[_-]+/g, ' ')
  if (role.includes('super')) return 'Super Admin'
  if (role.includes('admin')) return 'Pharmacy Admin'
  return 'Pharmacist'
}

function normalizeLog(item, index) {
  const user = item?.user || item?.actor || item?.performedBy || item?.admin || {}
  const action = String(valueOf(item, ['action', 'activity', 'event', 'operation', 'type'], 'View')).replace(/[_-]+/g, ' ')
  const timestamp = valueOf(item, ['timestamp', 'createdAt', 'created_at', 'date', 'loggedAt', 'updatedAt'])
  const isLoginExplicit = item?.isLogin ?? item?.login ?? item?.IsLogin ?? item?.Login
  const isLoginFromAction = /login|sign\s*in|logged\s*in|authenticated/i.test(action) || /login|auth/i.test(item?.module || item?.type || '')
  const login = isLoginExplicit !== undefined ? Boolean(isLoginExplicit) : isLoginFromAction
  return {
    id: idOf(item) || index,
    userName: valueOf(item, ['userName', 'username', 'name', 'actorName'], valueOf(user, ['name', 'fullName', 'username', 'email'], 'Unknown User')),
    email: valueOf(item, ['email', 'userEmail', 'actorEmail'], valueOf(user, ['email'], '-')),
    role: normalizeRole(valueOf(item, ['role', 'userRole', 'actorRole'], valueOf(user, ['role', 'userType'], 'Pharmacist'))),
    action: action.charAt(0).toUpperCase() + action.slice(1),
    module: valueOf(item, ['module', 'resource', 'entity', 'section'], 'Pharmacy'),
    description: valueOf(item, ['description', 'details', 'message', 'metadata'], ''),
    ipAddress: valueOf(item, ['ipAddress', 'ip', 'ip_address', 'clientIp'], '-'),
    login,
    timestamp,
    branchId: valueOf(item, ['branchId', 'branch_id'], item?.branch?._id || item?.branch?.id || ''),
    branchName: valueOf(item, ['branchName', 'branch', 'location'], item?.branch?.name || ''),
    hospitalId: valueOf(item, ['hospitalId', 'hospital_id'], item?.hospital?._id || item?.hospital?.id || ''),
    hospitalName: valueOf(item, ['hospitalName', 'hospital', 'clinicName'], item?.hospital?.name || ''),
  }
}

function normalizeBranch(item) {
  const id = valueOf(item, ['id', '_id', 'branchId', 'externalBranchId', 'uuid'])
  const branchName = valueOf(item, ['branchName', 'name', 'title', 'externalBranchId'], `Branch ${id || ''}`)
  return { id: String(id || ''), branchName: String(branchName || '') }
}

function getAppTimezone() {
  try {
    const raw = localStorage.getItem('pms_system_settings') || sessionStorage.getItem('pms_system_settings')
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed.timezone) return parsed.timezone
    }
  } catch {}
  return 'Asia/Kolkata'
}

function parseTimestampToDate(value) {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value === 'number') {
    const ms = value < 1e11 ? value * 1000 : value
    const date = new Date(ms)
    return Number.isNaN(date.getTime()) ? null : date
  }
  const str = String(value).trim()
  if (!str) return null

  // Epoch numeric string
  if (/^\d+$/.test(str)) {
    const num = Number(str)
    const ms = num < 1e11 ? num * 1000 : num
    const date = new Date(ms)
    return Number.isNaN(date.getTime()) ? null : date
  }

  // Already has explicit timezone suffix
  const hasTimezone = /[Zz]$|[+-]\d{2}(:?\d{2})?$/.test(str)
  if (hasTimezone) {
    const date = new Date(str)
    return Number.isNaN(date.getTime()) ? null : date
  }

  // If backend stored UTC without timezone offset, append Z
  const isoUtc = str.replace(' ', 'T') + 'Z'
  const utcDate = new Date(isoUtc)
  if (!Number.isNaN(utcDate.getTime())) {
    return utcDate
  }

  const fallback = new Date(str)
  return Number.isNaN(fallback.getTime()) ? null : fallback
}

function formatTimestamp(value) {
  const date = parseTimestampToDate(value)
  if (!date) return 'Date unavailable'
  const timeZone = getAppTimezone()
  try {
    return date.toLocaleString('en-IN', {
      timeZone,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
  } catch {
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
  }
}

function initials(name) {
  return String(name || 'U').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}

function AuditLogs() {
  const [logs, setLogs] = useState([])
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [branchesLoading, setBranchesLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [tab, setTab] = useState('all')
  const [query, setQuery] = useState('')
  const [actionFilter, setActionFilter] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [branchId, setBranchId] = useState('')
  const [page, setPage] = useState(1)

  const loadLogs = useCallback(async (targetBranchId = branchId) => {
    setLoading(true)
    setError(null)
    try {
      const params = {}
      if (targetBranchId && String(targetBranchId).trim()) {
        params.branchId = String(targetBranchId).trim()
      }
      const response = await getSuperAdminAuditLogs(params, { authRole: 'superAdmin' })
      setLogs(listFrom(response).map(normalizeLog))
    } catch (err) {
      setLogs([])
      setError(err?.message || 'Unable to load audit logs.')
    } finally {
      setLoading(false)
    }
  }, [branchId])

  async function loadBranches() {
    setBranchesLoading(true)
    try {
      let allBranches = []
      let currentPage = 1
      const pageSize = 100
      let total = 0

      do {
        const response = await getSuperAdminBranches({ page: currentPage, pageSize })
        const body = response?.data ?? response
        const items = Array.isArray(body?.branches)
          ? body.branches
          : Array.isArray(response?.branches)
          ? response.branches
          : Array.isArray(body)
          ? body
          : Array.isArray(body?.items)
          ? body.items
          : []

        total = Number(body?.total ?? response?.total ?? items.length)
        const serverPageSize = Number(body?.pageSize ?? response?.pageSize ?? pageSize)
        allBranches = [...allBranches, ...items]

        if (!items.length || allBranches.length >= total) break
        currentPage++
      } while (allBranches.length < total && currentPage <= 20)

      setBranches(allBranches.map(normalizeBranch).filter((b) => b.id))
    } catch {
      setBranches([])
    } finally {
      setBranchesLoading(false)
    }
  }

  useEffect(() => {
    loadLogs('')
    loadBranches()
  }, [])

  function handleBranchChange(newBranchId) {
    setBranchId(newBranchId)
    setPage(1)
    loadLogs(newBranchId)
  }

  const filteredLogs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const start = startDate ? new Date(`${startDate}T00:00:00`) : null
    const end = endDate ? new Date(`${endDate}T23:59:59`) : null
    return logs.filter((log) => {
      const date = parseTimestampToDate(log.timestamp)
      const matchesTab = tab === 'all' || (tab === 'login' ? log.login : !log.login)
      const matchesAction = actionFilter === 'all' || log.action.toLowerCase() === actionFilter
      const formattedTime = formatTimestamp(log.timestamp).toLowerCase()
      const searchable = [log.userName, log.email, log.action, log.ipAddress, log.timestamp, formattedTime, log.role, log.module, log.branchName].join(' ').toLowerCase()
      const matchesQuery = !normalizedQuery || searchable.includes(normalizedQuery)
      const matchesStart = !start || (date && date >= start)
      const matchesEnd = !end || (date && date <= end)
      const selectedBranch = branches.find((branch) => String(branch.id) === String(branchId))
      const matchesBranch = !branchId || String(log.branchId) === String(branchId) || log.branchName === selectedBranch?.branchName
      return matchesTab && matchesAction && matchesQuery && matchesStart && matchesEnd && matchesBranch
    })
  }, [actionFilter, branchId, branches, endDate, logs, query, startDate, tab])

  const periodLogs = useMemo(() => {
    const start = startDate ? new Date(`${startDate}T00:00:00`) : null
    const end = endDate ? new Date(`${endDate}T23:59:59`) : null
    return logs.filter((log) => {
      const date = parseTimestampToDate(log.timestamp)
      const matchesStart = !start || (date && date >= start)
      const matchesEnd = !end || (date && date <= end)
      const selectedBranch = branches.find((branch) => String(branch.id) === String(branchId))
      const matchesBranch = !branchId || String(log.branchId) === String(branchId) || log.branchName === selectedBranch?.branchName
      return matchesStart && matchesEnd && matchesBranch
    })
  }, [branches, endDate, branchId, logs, startDate])

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const visibleLogs = filteredLogs.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const loginCount = useMemo(() => periodLogs.filter((log) => log.login).length, [periodLogs])
  const dataChangeCount = useMemo(() => periodLogs.filter((log) => !log.login && /create|update|edit|delete|change|add|remove|assign|reset|approve|cancel/i.test(log.action)).length, [periodLogs])
  const actions = [...new Set(logs.map((log) => log.action.toLowerCase()))].sort()

  function updateFilter(setter, value) {
    setter(value)
    setPage(1)
  }

  return <div className={`super-admin-shell${sidebarOpen ? ' sidebar-open' : ''}`}>
    <SuperAdminSidebar activeLabel="Audit Logs" />
    <main className="super-admin-main audit-page">
      <SuperAdminTopbar onMenu={() => setSidebarOpen((value) => !value)} />
      <section className="audit-heading"><div><p className="super-admin-eyebrow">Pharmacy Super Admin</p><h1>Audit Logs</h1><p>Trace pharmacy operations, account activity, IP addresses, and timestamps.</p></div><button className="audit-refresh" type="button" onClick={() => loadLogs(branchId)} disabled={loading} aria-busy={loading}><Icon><path d="M20 7v5h-5" /><path d="M20 12a8 8 0 1 0-2.34 5.66M20 12a8 8 0 0 0-2.34-5.66" /></Icon>{loading ? 'Refreshing...' : 'Refresh'}</button></section>
      <section className="audit-stats"><article><span className="audit-stat-icon stat-teal"><Icon><path d="M8 5h8a4 4 0 0 1 0 8H8a4 4 0 0 1 0-8Z" /><path d="m8 5 8 8" /></Icon></span><div><small>Pharmacy Audit Records</small><strong>{logs.length}</strong><em>All pharmacy operations</em></div></article><article><span className="audit-stat-icon stat-green"><Icon><path d="M5 12h5M14 7l5 5-5 5M19 12H9" /></Icon></span><div><small>Staff Login Activities</small><strong>{loginCount}</strong><em>Selected period</em></div></article><article><span className="audit-stat-icon stat-orange"><Icon><path d="m15 5 4 4M4 20l3.5-1 10.8-10.8a2.8 2.8 0 0 0-4-4L3.5 15z" /></Icon></span><div><small>Inventory &amp; Data Changes</small><strong>{dataChangeCount}</strong><em>Selected period</em></div></article></section>
      <section className="audit-panel">
        <div className="audit-tabs"><button className={tab === 'all' ? 'is-active' : ''} type="button" onClick={() => updateFilter(setTab, 'all')}>All Audit Logs</button><button className={tab === 'login' ? 'is-active' : ''} type="button" onClick={() => updateFilter(setTab, 'login')}>Login History</button></div>
        <div className="audit-search-row"><label className="audit-search"><Icon><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></Icon><input value={query} onChange={(event) => updateFilter(setQuery, event.target.value)} placeholder="Search by user name, action, IP address, or timestamp..." /></label><select value={actionFilter} onChange={(event) => updateFilter(setActionFilter, event.target.value)} aria-label="Filter by action"><option value="all">All</option>{actions.map((action) => <option key={action} value={action}>{action.charAt(0).toUpperCase() + action.slice(1)}</option>)}</select></div>
        <div className="audit-filters"><label><span>Start Date</span><input type="date" value={startDate} onChange={(event) => updateFilter(setStartDate, event.target.value)} /></label><label><span>End Date</span><input type="date" value={endDate} onChange={(event) => updateFilter(setEndDate, event.target.value)} /></label><label><span>Branch</span><select value={branchId} onChange={(event) => handleBranchChange(event.target.value)} disabled={branchesLoading} aria-label="Filter by branch"><option value="">{branchesLoading ? 'Loading branches...' : 'All Branches'}</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.branchName}</option>)}</select></label></div>
        <div className="audit-table-wrap"><table><thead><tr><th>S.No</th><th>Name</th><th>Email Address</th><th>Action</th><th>IP Address</th><th>Login</th><th>Timestamp</th><th>Role</th></tr></thead><tbody>{loading ? <tr><td className="audit-table-state" colSpan="8">Loading audit logs...</td></tr> : error ? <tr><td className="audit-table-state" colSpan="8"><div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '16px' }}><span>⚠️ {error}</span><button type="button" className="audit-refresh" onClick={() => loadLogs(branchId)}>Retry</button></div></td></tr> : visibleLogs.length ? visibleLogs.map((log, index) => <tr key={`${log.id}-${index}`}><td>{(currentPage - 1) * PAGE_SIZE + index + 1}</td><td><span className="audit-user"><b>{initials(log.userName)}</b>{log.userName}</span></td><td>{log.email}</td><td><span className="audit-action">{log.action}</span></td><td>{log.ipAddress}</td><td><span className={`audit-login ${log.login ? 'is-yes' : 'is-no'}`}>{log.login ? 'Yes' : 'No'}</span></td><td>{formatTimestamp(log.timestamp)}</td><td><span className={`audit-role role-${log.role.toLowerCase().replace(/\s+/g, '-')}`}>{log.role}</span></td></tr>) : <tr><td className="audit-table-state" colSpan="8">No data found</td></tr>}</tbody></table></div>
        <footer className="audit-footer"><span>Showing {visibleLogs.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0} to {Math.min(currentPage * PAGE_SIZE, filteredLogs.length)} of {filteredLogs.length} records</span><div><button type="button" disabled={currentPage === 1} onClick={() => setPage(1)}>First</button><button type="button" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Prev</button><strong>Page {currentPage} of {totalPages}</strong><button type="button" disabled={currentPage === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next</button><button type="button" disabled={currentPage === totalPages} onClick={() => setPage(totalPages)}>Last</button></div></footer>
      </section>
    </main>
  </div>
}

export default AuditLogs
