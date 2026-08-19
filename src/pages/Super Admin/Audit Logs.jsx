import { useEffect, useMemo, useState } from 'react'
import { getPharmacyAuditLogs, listAssignmentHospitals, listHospitalBranches } from '../../config/api'
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
  return {
    id: idOf(item) || index,
    userName: valueOf(item, ['userName', 'username', 'name', 'actorName'], valueOf(user, ['name', 'fullName', 'username', 'email'], 'Unknown User')),
    email: valueOf(item, ['email', 'userEmail', 'actorEmail'], valueOf(user, ['email'], '-')),
    role: normalizeRole(valueOf(item, ['role', 'userRole', 'actorRole'], valueOf(user, ['role', 'userType'], 'Pharmacist'))),
    action: action.charAt(0).toUpperCase() + action.slice(1),
    module: valueOf(item, ['module', 'resource', 'entity', 'section'], 'Pharmacy'),
    description: valueOf(item, ['description', 'details', 'message', 'metadata'], ''),
    ipAddress: valueOf(item, ['ipAddress', 'ip', 'ip_address', 'clientIp'], '-'),
    login: Boolean(item?.isLogin ?? item?.login ?? /login|sign in/i.test(action)),
    timestamp,
    branchId: valueOf(item, ['branchId', 'branch_id'], item?.branch?._id || item?.branch?.id || ''),
    branchName: valueOf(item, ['branchName', 'branch', 'location'], item?.branch?.name || ''),
    hospitalId: valueOf(item, ['hospitalId', 'hospital_id'], item?.hospital?._id || item?.hospital?.id || ''),
    hospitalName: valueOf(item, ['hospitalName', 'hospital', 'clinicName'], item?.hospital?.name || ''),
  }
}

function normalizeLocation(item) {
  return { id: valueOf(item, ['_id', 'id', 'branchId', 'externalBranchId', 'uuid']), name: valueOf(item, ['name', 'branchName', 'title', 'externalBranchId'], 'Branch') }
}

function normalizeHospital(item) {
  return { id: valueOf(item, ['_id', 'id', 'hospitalId', 'externalHospitalId', 'uuid']), name: valueOf(item, ['name', 'hospitalName', 'clinicName', 'title'], 'Hospital') }
}

function formatTimestamp(value) {
  if (!value) return 'Date unavailable'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function initials(name) {
  return String(name || 'U').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}

function AuditLogs() {
  const [logs, setLogs] = useState([])
  const [hospitals, setHospitals] = useState([])
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)
  const [locationsLoading, setLocationsLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [tab, setTab] = useState('all')
  const [query, setQuery] = useState('')
  const [actionFilter, setActionFilter] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [hospitalId, setHospitalId] = useState('')
  const [branchId, setBranchId] = useState('')
  const [page, setPage] = useState(1)

  async function loadLogs() {
    setLoading(true)
    try {
      const response = await getPharmacyAuditLogs()
      setLogs(listFrom(response).map(normalizeLog))
    } catch {
      setLogs([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLogs()
    async function loadHospitals() {
      try {
        const response = await listAssignmentHospitals()
        setHospitals(listFrom(response, ['hospitals', 'data', 'items', 'results']).map(normalizeHospital))
      } catch {
        setHospitals([])
      }
    }
    loadHospitals()
  }, [])

  useEffect(() => {
    setBranches([])
    setBranchId('')
    if (!hospitalId) return
    setLocationsLoading(true)
    listHospitalBranches(hospitalId)
      .then((response) => setBranches(listFrom(response, ['branches', 'data', 'items', 'results']).map(normalizeLocation)))
      .catch(() => setBranches([]))
      .finally(() => setLocationsLoading(false))
  }, [hospitalId])

  const filteredLogs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const start = startDate ? new Date(`${startDate}T00:00:00`) : null
    const end = endDate ? new Date(`${endDate}T23:59:59`) : null
    return logs.filter((log) => {
      const date = log.timestamp ? new Date(log.timestamp) : null
      const matchesTab = tab === 'all' || (tab === 'login' ? log.login : !log.login)
      const matchesAction = actionFilter === 'all' || log.action.toLowerCase() === actionFilter
      const searchable = [log.userName, log.email, log.action, log.ipAddress, log.timestamp, log.role, log.module, log.branchName].join(' ').toLowerCase()
      const matchesQuery = !normalizedQuery || searchable.includes(normalizedQuery)
      const matchesStart = !start || (date && !Number.isNaN(date.getTime()) && date >= start)
      const matchesEnd = !end || (date && !Number.isNaN(date.getTime()) && date <= end)
      const selectedHospital = hospitals.find((hospital) => hospital.id === hospitalId)
      const selectedBranch = branches.find((branch) => branch.id === branchId)
      const matchesHospital = !hospitalId || log.hospitalId === hospitalId || log.hospitalName === selectedHospital?.name
      const matchesBranch = !branchId || log.branchId === branchId || log.branchName === selectedBranch?.name
      return matchesTab && matchesAction && matchesQuery && matchesStart && matchesEnd && matchesHospital && matchesBranch
    })
  }, [actionFilter, branchId, branches, endDate, hospitalId, hospitals, logs, query, startDate, tab])

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const visibleLogs = filteredLogs.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const loginCount = filteredLogs.filter((log) => log.login).length
  const dataChangeCount = filteredLogs.filter((log) => !log.login && /create|update|edit|delete|change|add|remove|assign|reset|approve|cancel/i.test(log.action)).length
  const actions = [...new Set(logs.map((log) => log.action.toLowerCase()))].sort()

  function updateFilter(setter, value) {
    setter(value)
    setPage(1)
  }

  function changeHospital(value) {
    updateFilter(setHospitalId, value)
  }

  return <div className={`super-admin-shell${sidebarOpen ? ' sidebar-open' : ''}`}>
    <SuperAdminSidebar activeLabel="Audit Logs" />
    <main className="super-admin-main audit-page">
      <SuperAdminTopbar onMenu={() => setSidebarOpen((value) => !value)} />
      <section className="audit-heading"><div><p className="super-admin-eyebrow">Pharmacy Super Admin</p><h1>Audit Logs</h1><p>Trace pharmacy operations, account activity, IP addresses, and timestamps.</p></div><button className="audit-refresh" type="button" onClick={loadLogs}><Icon><path d="M20 11a8 8 0 1 0 2 5.3" /><path d="M20 4v7h-7" /></Icon>Refresh</button></section>
      <section className="audit-stats"><article><span className="audit-stat-icon stat-teal"><Icon><path d="M8 5h8a4 4 0 0 1 0 8H8a4 4 0 0 1 0-8Z" /><path d="m8 5 8 8" /></Icon></span><div><small>Pharmacy Audit Records</small><strong>{logs.length}</strong><em>All pharmacy operations</em></div></article><article><span className="audit-stat-icon stat-green"><Icon><path d="M5 12h5M14 7l5 5-5 5M19 12H9" /></Icon></span><div><small>Staff Login Activities</small><strong>{loginCount}</strong><em>Selected period</em></div></article><article><span className="audit-stat-icon stat-orange"><Icon><path d="m15 5 4 4M4 20l3.5-1 10.8-10.8a2.8 2.8 0 0 0-4-4L3.5 15z" /></Icon></span><div><small>Inventory &amp; Data Changes</small><strong>{dataChangeCount}</strong><em>Selected period</em></div></article></section>
      <section className="audit-panel">
        <div className="audit-tabs"><button className={tab === 'all' ? 'is-active' : ''} type="button" onClick={() => updateFilter(setTab, 'all')}>All Audit Logs</button><button className={tab === 'login' ? 'is-active' : ''} type="button" onClick={() => updateFilter(setTab, 'login')}>Login History</button></div>
        <div className="audit-search-row"><label className="audit-search"><Icon><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></Icon><input value={query} onChange={(event) => updateFilter(setQuery, event.target.value)} placeholder="Search by user name, action, IP address, or timestamp..." /></label><select value={actionFilter} onChange={(event) => updateFilter(setActionFilter, event.target.value)} aria-label="Filter by action"><option value="all">All</option>{actions.map((action) => <option key={action} value={action}>{action.charAt(0).toUpperCase() + action.slice(1)}</option>)}</select></div>
        <div className="audit-filters"><label><span>Start Date</span><input type="date" value={startDate} onChange={(event) => updateFilter(setStartDate, event.target.value)} /></label><label><span>End Date</span><input type="date" value={endDate} onChange={(event) => updateFilter(setEndDate, event.target.value)} /></label><label><span>Branch / Hospital</span><select value={hospitalId} onChange={(event) => changeHospital(event.target.value)}><option value="">All Branches</option>{hospitals.map((hospital) => <option key={hospital.id} value={hospital.id}>{hospital.name}</option>)}</select></label><label><span>Sub-branch / Location</span><select value={branchId} disabled={!hospitalId || locationsLoading} onChange={(event) => updateFilter(setBranchId, event.target.value)}><option value="">{locationsLoading ? 'Loading locations...' : hospitalId ? 'All locations' : 'Select branch first'}</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label></div>
        <div className="audit-table-wrap"><table><thead><tr><th>S.No</th><th>User</th><th>Email Address</th><th>Action</th><th>IP Address</th><th>Login</th><th>Timestamp</th><th>Role</th></tr></thead><tbody>{loading ? <tr><td className="audit-table-state" colSpan="8">Loading audit logs...</td></tr> : visibleLogs.length ? visibleLogs.map((log, index) => <tr key={`${log.id}-${index}`}><td>{(currentPage - 1) * PAGE_SIZE + index + 1}</td><td><span className="audit-user"><b>{initials(log.userName)}</b>{log.userName}</span></td><td>{log.email}</td><td><span className="audit-action">{log.action}</span></td><td>{log.ipAddress}</td><td><span className={`audit-login ${log.login ? 'is-yes' : 'is-no'}`}>{log.login ? 'Yes' : 'No'}</span></td><td>{formatTimestamp(log.timestamp)}</td><td><span className={`audit-role role-${log.role.toLowerCase().replace(/\s+/g, '-')}`}>{log.role}</span></td></tr>) : <tr><td className="audit-table-state" colSpan="8">No data found</td></tr>}</tbody></table></div>
        <footer className="audit-footer"><span>Showing {visibleLogs.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0} to {Math.min(currentPage * PAGE_SIZE, filteredLogs.length)} of {filteredLogs.length} records</span><div><button type="button" disabled={currentPage === 1} onClick={() => setPage(1)}>First</button><button type="button" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Prev</button><strong>Page {currentPage} of {totalPages}</strong><button type="button" disabled={currentPage === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next</button><button type="button" disabled={currentPage === totalPages} onClick={() => setPage(totalPages)}>Last</button></div></footer>
      </section>
    </main>
  </div>
}

export default AuditLogs
