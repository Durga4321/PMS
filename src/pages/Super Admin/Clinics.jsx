import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useToast } from '../../components/ToastProvider'
import UserProfileMenu from '../../components/UserProfileMenu'
import { superAdminNavigation } from '../../components/superAdminNavigation'
import { listAssignmentHospitals } from '../../config/api'
import './Clinics.css'

function normalizeClinicList(response) {
  const items = Array.isArray(response)
    ? response
    : Array.isArray(response?.data)
      ? response.data
      : Array.isArray(response?.data?.hospitals)
        ? response.data.hospitals
        : Array.isArray(response?.data?.results)
          ? response.data.results
          : Array.isArray(response?.hospitals)
            ? response.hospitals
            : Array.isArray(response?.results)
              ? response.results
              : []

  return items.map((item, index) => {
    const id = item?._id || item?.id || item?.hospitalId || item?.externalHospitalId || item?.uuid || index
    const statusValue = item?.status ?? item?.isActive
    const status = typeof statusValue === 'boolean' ? (statusValue ? 'Active' : 'Inactive') : statusValue || 'Active'

    return {
      id,
      name: item?.name || item?.clinicName || item?.hospitalName || item?.title || 'Clinic',
      address: item?.address || item?.location || item?.streetAddress || [item?.city, item?.state, item?.country].filter(Boolean).join(', ') || '—',
      contact: item?.phone || item?.mobile || item?.contactNumber || item?.contact || '',
      email: item?.email || '',
      status,
    }
  })
}

const emptyForm = {
  clinicName: '',
  contactNumber: '',
  email: '',
  status: 'Active',
  pincode: '',
  streetName: '',
  area: '',
  city: '',
  state: '',
  country: 'India',
  finalAddress: '',
}

function ClinicBrand() {
  return (
    <div className="clinic-brand">
      <div className="clinic-brand-mark">PMS</div>
      <div className="clinic-brand-copy">
        <strong>PMS</strong>
        <small>Super Admin Console</small>
      </div>
    </div>
  )
}

function ClinicSidebar() {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <aside className="clinic-sidebar" aria-label="Super admin navigation">
      <ClinicBrand />
      <nav className="clinic-nav" aria-label="Sidebar menu">
        {superAdminNavigation.map(({ label, path, icon, color }) => (
          <button
            key={label}
            type="button"
            className={`clinic-nav-link${location.pathname === path ? ' is-active' : ''}`}
            onClick={() => navigate(path)}
          >
            <span className={`clinic-icon accent-${color}`}>{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="clinic-sidebar-footer">
        <span className="clinic-sidebar-avatar">SA</span>
        <div>
          <strong>Super Admin</strong>
          <small>Super Admin</small>
          <em>● Online</em>
        </div>
      </div>
    </aside>
  )
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="6" />
      <path d="M16 16L21 21" />
    </svg>
  )
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </svg>
  )
}

function tableActionIcon(name) {
  const icons = {
    view: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
    edit: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
      </svg>
    ),
    delete: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 6h18" />
        <path d="M8 6V4h8v2" />
        <path d="M19 6l-1 14H6L5 6" />
        <path d="M10 11v6M14 11v6" />
      </svg>
    ),
  }

  return icons[name] ?? icons.view
}

function ClinicsListPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [clinics, setClinics] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let isMounted = true

    async function loadClinics() {
      setLoading(true)
      setError('')

      try {
        const response = await listAssignmentHospitals()
        if (!isMounted) return
        setClinics(normalizeClinicList(response))
      } catch (loadError) {
        if (!isMounted) return
        setClinics([])
        setError(loadError.message || 'Unable to load clinics.')
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadClinics()

    return () => {
      isMounted = false
    }
  }, [])

  const filteredClinics = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return clinics
    return clinics.filter((clinic) => `${clinic.name} ${clinic.address} ${clinic.contact} ${clinic.email}`.toLowerCase().includes(term))
  }, [clinics, query])

  return (
    <div className="clinic-page-shell">
      <ClinicSidebar />
      <main className="clinic-main">
        <header className="clinic-topbar">
          <label className="clinic-global-search" aria-label="Global search">
            <SearchIcon />
            <input type="search" placeholder="Search dashboard, clinics, admins, reports..." />
          </label>

          <div className="clinic-topbar-right">
            <button type="button" className="clinic-notification" aria-label="Notifications">
              <BellIcon />
              <span>14</span>
            </button>
            <UserProfileMenu roleType="super-admin" />
          </div>
        </header>

        <section className="clinic-content">
          <div className="clinic-section-header">
            <div>
              <h1>Clinic Management</h1>
              <p>{filteredClinics.length} clinics found</p>
            </div>
            <button type="button" className="clinic-primary-button" onClick={() => navigate('/super-admin/clinics/add')}>
              <span>＋</span>
              Add Clinic
            </button>
          </div>

          <div className="clinic-list-panel">
            <div className="clinic-toolbar">
              <label className="clinic-search-field">
                <SearchIcon />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search clinics by name, address, or email..."
                />
              </label>

              <button type="button" className="clinic-filter-button">
                All
                <span>▾</span>
              </button>
            </div>

            <div className="clinic-table-wrap">
              {error ? (
                <div className="clinic-empty-message">{error}</div>
              ) : (
                <table className="clinic-table">
                  <thead>
                    <tr>
                      <th>S.No.</th>
                      <th>Clinic Name</th>
                      <th>Address</th>
                      <th>Contact Number</th>
                      <th>Email</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan="7" className="clinic-empty-message">Loading clinics...</td>
                      </tr>
                    ) : filteredClinics.length ? (
                      filteredClinics.map((clinic, index) => (
                        <tr key={clinic.id ?? `${clinic.name}-${index}`}>
                          <td>{index + 1}</td>
                          <td className="clinic-name-cell">
                            <span className="clinic-avatar">{clinic.name?.charAt(0)?.toUpperCase() || 'C'}</span>
                            {clinic.name}
                          </td>
                          <td>{clinic.address}</td>
                          <td>{clinic.contact}</td>
                          <td>{clinic.email}</td>
                          <td>
                            <span className={`clinic-status ${String(clinic.status).toLowerCase()}`}>{clinic.status}</span>
                          </td>
                          <td>
                            <div className="clinic-action-group">
                              <button type="button" className="clinic-action-button" aria-label="View clinic" title="View clinic">
                                {tableActionIcon('view')}
                              </button>
                              <button type="button" className="clinic-action-button" aria-label="Edit clinic" title="Edit clinic">
                                {tableActionIcon('edit')}
                              </button>
                              <button type="button" className="clinic-action-button" aria-label="Delete clinic" title="Delete clinic">
                                {tableActionIcon('delete')}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="7" className="clinic-empty-message">No clinics found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {!error && (
              <div className="clinic-pagination">
                <span>Showing {filteredClinics.length} of {clinics.length} clinics</span>
                <div className="clinic-pagination-controls">
                  <button type="button">First</button>
                  <button type="button">Prev</button>
                  <button type="button" className="is-current">1</button>
                  <button type="button">Next</button>
                  <button type="button">Last</button>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}

function AddClinicPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function handleSubmit(event) {
    event.preventDefault()

    const contactNumber = form.contactNumber.trim()
    const email = form.email.trim()
    const clinicName = form.clinicName.trim()
    const streetName = form.streetName.trim()
    const city = form.city.trim()
    const state = form.state.trim()
    const country = form.country.trim()
    const finalAddress = form.finalAddress.trim()

    if (!clinicName) {
      showToast('Clinic name is required.', 'error')
      return
    }

    if (!/^\d{10}$/.test(contactNumber)) {
      showToast('Contact number must be a 10-digit mobile number.', 'error')
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showToast('Please enter a valid email address.', 'error')
      return
    }

    if (!streetName || !city || !state || !country || !finalAddress) {
      showToast('Please complete the address details.', 'error')
      return
    }

    setSaving(true)

    const nextClinic = {
      id: Date.now(),
      name: clinicName,
      address: finalAddress,
      contact: contactNumber,
      email,
      status: form.status || 'Active',
    }

    const current = window.sessionStorage.getItem('superAdminClinics')
    const list = current ? JSON.parse(current) : []
    const updatedList = [nextClinic, ...(Array.isArray(list) ? list : [])]
    window.sessionStorage.setItem('superAdminClinics', JSON.stringify(updatedList))

    setSaving(false)
    showToast('Clinic saved successfully.')
    navigate('/super-admin/clinics')
  }

  return (
    <div className="clinic-page-shell">
      <ClinicSidebar />
      <main className="clinic-main">
        <header className="clinic-topbar">
          <label className="clinic-global-search" aria-label="Global search">
            <SearchIcon />
            <input type="search" placeholder="Search dashboard, clinics, admins, reports..." />
          </label>

          <div className="clinic-topbar-right">
            <button type="button" className="clinic-notification" aria-label="Notifications">
              <BellIcon />
              <span>14</span>
            </button>
            <UserProfileMenu roleType="super-admin" />
          </div>
        </header>

        <section className="clinic-form-section">
          <div className="clinic-form-header">
            <h1>Add Clinic</h1>
            <p>Manage clinic profile and availability status.</p>
          </div>

          <form className="clinic-form-card" onSubmit={handleSubmit}>
            <div className="clinic-form-grid">
              <label className="clinic-field">
                <span>Clinic Name</span>
                <input type="text" value={form.clinicName} onChange={(event) => updateField('clinicName', event.target.value)} placeholder="Clinic Name" />
              </label>

              <label className="clinic-field">
                <span>Contact Number</span>
                <input type="tel" value={form.contactNumber} onChange={(event) => updateField('contactNumber', event.target.value)} placeholder="10-digit Indian mobile number" />
              </label>

              <label className="clinic-field">
                <span>Email</span>
                <input type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} placeholder="Email" />
              </label>

              <label className="clinic-field">
                <span>Status</span>
                <select value={form.status} onChange={(event) => updateField('status', event.target.value)}>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </label>

              <label className="clinic-field">
                <span>Pincode</span>
                <input type="text" value={form.pincode} onChange={(event) => updateField('pincode', event.target.value)} placeholder="Pincode" />
              </label>

              <label className="clinic-field">
                <span>Street/Village Name</span>
                <input type="text" value={form.streetName} onChange={(event) => updateField('streetName', event.target.value)} placeholder="Street/Village Name" />
              </label>

              <label className="clinic-field">
                <span>Area</span>
                <input type="text" value={form.area} onChange={(event) => updateField('area', event.target.value)} placeholder="Area" />
              </label>

              <label className="clinic-field">
                <span>City/District</span>
                <input type="text" value={form.city} onChange={(event) => updateField('city', event.target.value)} placeholder="City/District" />
              </label>

              <label className="clinic-field">
                <span>State</span>
                <input type="text" value={form.state} onChange={(event) => updateField('state', event.target.value)} placeholder="State" />
              </label>

              <label className="clinic-field">
                <span>Country</span>
                <input type="text" value={form.country} onChange={(event) => updateField('country', event.target.value)} placeholder="Country" />
              </label>

              <label className="clinic-field clinic-field-full">
                <span>Final Address</span>
                <textarea rows="4" value={form.finalAddress} onChange={(event) => updateField('finalAddress', event.target.value)} placeholder="Final Address" />
              </label>
            </div>

            <div className="clinic-form-actions">
              <button type="button" className="clinic-secondary-button" onClick={() => navigate('/super-admin/clinics')}>
                Cancel
              </button>
              <button type="submit" className="clinic-primary-button" disabled={saving}>
                <span>💾</span>
                {saving ? 'Saving...' : 'Save Clinic'}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  )
}

export default function Clinics() {
  const location = useLocation()
  return location.pathname.endsWith('/add') ? <AddClinicPage /> : <ClinicsListPage />
}
