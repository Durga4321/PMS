import { useEffect, useMemo, useState } from 'react'
import { FiEye, FiMapPin, FiPhone, FiSearch } from 'react-icons/fi'
import { listAssignmentHospitals } from '../../config/api'
import SuperAdminSidebar from './SuperAdminSidebar'
import SuperAdminTopbar from './SuperAdminTopbar'
import './Clinics.css'

function normalizeList(response) {
  if (Array.isArray(response)) return response
  if (Array.isArray(response?.data)) return response.data
  if (Array.isArray(response?.data?.hospitals)) return response.data.hospitals
  if (Array.isArray(response?.data?.results)) return response.data.results
  if (Array.isArray(response?.hospitals)) return response.hospitals
  if (Array.isArray(response?.results)) return response.results
  return []
}

function clinicName(clinic) {
  return clinic?.name || clinic?.clinicName || clinic?.hospitalName || clinic?.title || '-'
}

function clinicAddress(clinic) {
  return clinic?.address || clinic?.location || [clinic?.city, clinic?.state, clinic?.country].filter(Boolean).join(', ') || '-'
}

function clinicPhone(clinic) {
  return clinic?.phone || clinic?.mobile || clinic?.contactNumber || clinic?.contact || '-'
}

function clinicStatus(clinic) {
  const value = clinic?.status ?? clinic?.isActive
  if (typeof value === 'boolean') return value ? 'Active' : 'Inactive'
  return value || 'Active'
}

function Clinics() {
  const [clinics, setClinics] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [page, setPage] = useState(1)
  const pageSize = 5

  useEffect(() => {
    let active = true

    async function loadClinics() {
      setLoading(true)
      setError('')

      try {
        const response = await listAssignmentHospitals()
        if (active) setClinics(normalizeList(response))
      } catch (requestError) {
        if (active) setError(requestError.message || 'Unable to load clinics.')
      } finally {
        if (active) setLoading(false)
      }
    }

    loadClinics()
    return () => {
      active = false
    }
  }, [])

  const filteredClinics = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return clinics.filter((clinic) => {
      const matchesQuery = !normalizedQuery || [clinicName(clinic), clinicAddress(clinic), clinicPhone(clinic), clinic?.email].join(' ').toLowerCase().includes(normalizedQuery)
      const matchesStatus = statusFilter === 'All' || clinicStatus(clinic).toLowerCase() === statusFilter.toLowerCase()
      return matchesQuery && matchesStatus
    })
  }, [clinics, query, statusFilter])

  useEffect(() => setPage(1), [query, statusFilter])

  const pageCount = Math.max(1, Math.ceil(filteredClinics.length / pageSize))
  const visibleClinics = filteredClinics.slice((page - 1) * pageSize, page * pageSize)

  return (
    <div className="super-admin-shell clinics-page">
      <SuperAdminSidebar activeLabel="Clinics" />
      <main className="super-admin-main">
        <SuperAdminTopbar onMenu={() => {}} />
        <section className="clinics-heading"><h1>Clinic Management</h1><p>{filteredClinics.length} clinics found</p></section>
        <section className="clinics-panel">
          <div className="clinics-toolbar">
            <label className="clinics-search"><FiSearch aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search clinics by name, address, or email..." /></label>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter clinics by status"><option>All</option><option>Active</option><option>Inactive</option></select>
          </div>
          <div className="clinics-table-wrap">
            <table className="clinics-table">
              <thead><tr><th>S.No</th><th>Clinic Name</th><th>Address</th><th>Contact Number</th><th>Email</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan="7">Loading clinics...</td></tr> : error ? <tr><td colSpan="7" className="clinics-error">{error}</td></tr> : visibleClinics.length ? visibleClinics.map((clinic, index) => { const status = clinicStatus(clinic); return <tr key={clinic?._id || clinic?.id || `${clinicName(clinic)}-${index}`}><td>{(page - 1) * pageSize + index + 1}</td><td><span className="clinic-name"><span className="clinic-avatar">{clinicName(clinic).slice(0, 1).toUpperCase()}</span>{clinicName(clinic)}</span></td><td><span className="clinic-with-icon"><FiMapPin aria-hidden="true" />{clinicAddress(clinic)}</span></td><td><span className="clinic-with-icon"><FiPhone aria-hidden="true" />{clinicPhone(clinic)}</span></td><td>{clinic?.email || '-'}</td><td><span className={`clinic-status ${status.toLowerCase()}`}>{status}</span></td><td><button className="clinic-view-button" type="button" aria-label={`View ${clinicName(clinic)}`} title={`View ${clinicName(clinic)}`}><FiEye aria-hidden="true" /></button></td></tr> }) : <tr><td colSpan="7">No clinics found.</td></tr>}
              </tbody>
            </table>
          </div>
          <footer className="clinics-footer"><span>Showing {visibleClinics.length} of {filteredClinics.length} clinics</span><div><button type="button" onClick={() => setPage(1)} disabled={page === 1}>First</button><button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1}>Prev</button><strong>Page {page} of {pageCount}</strong><button type="button" onClick={() => setPage((value) => Math.min(pageCount, value + 1))} disabled={page === pageCount}>Next</button><button type="button" onClick={() => setPage(pageCount)} disabled={page === pageCount}>Last</button></div></footer>
        </section>
      </main>
    </div>
  )
}

export default Clinics
