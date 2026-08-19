import { useEffect, useMemo, useState } from 'react'
import { listAssignmentHospitals } from '../../config/api'
import SuperAdminSidebar from './SuperAdminSidebar'
import SuperAdminTopbar from './SuperAdminTopbar'
import './Clinics.css'

function Icon({ name }) {
  const paths = {
    eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
    map: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="3" /></>,
    phone: <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.7 2.6a2 2 0 0 1-.5 2.1L8.1 9.6a16 16 0 0 0 6.3 6.3l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.7.6 2.6.7A2 2 0 0 1 22 16.9Z" />,
    search: <><circle cx="11" cy="11" r="7" /><path d="m16 16 4 4" /></>,
  }
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

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
            <label className="clinics-search"><Icon name="search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search clinics by name, address, or email..." /></label>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter clinics by status"><option>All</option><option>Active</option><option>Inactive</option></select>
          </div>
          <div className="clinics-table-wrap">
            <table className="clinics-table">
              <thead><tr><th>S.No</th><th>Clinic Name</th><th>Address</th><th>Contact Number</th><th>Email</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan="7">Loading clinics...</td></tr> : error ? <tr><td colSpan="7" className="clinics-error">{error}</td></tr> : visibleClinics.length ? visibleClinics.map((clinic, index) => { const status = clinicStatus(clinic); return <tr key={clinic?._id || clinic?.id || `${clinicName(clinic)}-${index}`}><td>{(page - 1) * pageSize + index + 1}</td><td><span className="clinic-name"><span className="clinic-avatar">{clinicName(clinic).slice(0, 1).toUpperCase()}</span>{clinicName(clinic)}</span></td><td><span className="clinic-with-icon"><Icon name="map" />{clinicAddress(clinic)}</span></td><td><span className="clinic-with-icon"><Icon name="phone" />{clinicPhone(clinic)}</span></td><td>{clinic?.email || '-'}</td><td><span className={`clinic-status ${status.toLowerCase()}`}>{status}</span></td><td><button className="clinic-view-button" type="button" aria-label={`View ${clinicName(clinic)}`} title={`View ${clinicName(clinic)}`}><Icon name="eye" /></button></td></tr> }) : <tr><td colSpan="7">No clinics found.</td></tr>}
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
