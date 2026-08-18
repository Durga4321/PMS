import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../../components/ToastProvider'
import UserProfileMenu from '../../components/UserProfileMenu'
import { superAdminNavigation } from '../../components/superAdminNavigation'
import { listAssignmentHospitals, listHospitalBranches } from '../../config/api'
import './Branches.css'

function normalizeHospitalList(response) {
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

  return items.map((item, index) => ({
    id: item?._id || item?.id || item?.hospitalId || item?.externalHospitalId || item?.uuid || index,
    name: item?.name || item?.clinicName || item?.hospitalName || item?.title || 'Clinic',
    email: item?.email || '',
    phone: item?.phone || item?.mobile || item?.contactNumber || '',
    address: item?.address || item?.location || item?.streetAddress || [item?.city, item?.state, item?.country].filter(Boolean).join(', ') || '—',
  }))
}

function normalizeBranchList(response) {
  const items = Array.isArray(response)
    ? response
    : Array.isArray(response?.data)
      ? response.data
      : Array.isArray(response?.data?.branches)
        ? response.data.branches
        : Array.isArray(response?.data?.results)
          ? response.data.results
          : Array.isArray(response?.branches)
            ? response.branches
            : Array.isArray(response?.results)
              ? response.results
              : []

  return items.map((item, index) => {
    const statusValue = item?.status ?? item?.isActive
    const status = typeof statusValue === 'boolean' ? (statusValue ? 'Active' : 'Inactive') : (statusValue || 'Active')

    return {
      id: item?._id || item?.id || item?.branchId || item?.externalBranchId || item?.uuid || index + 1,
      name: item?.name || item?.branchName || item?.title || 'Branch',
      phone: item?.phone || item?.mobile || item?.contactNumber || item?.contact || '',
      email: item?.email || '',
      location: item?.location || item?.address || [item?.city, item?.state, item?.country].filter(Boolean).join(', ') || '—',
      status,
    }
  })
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

function ClinicIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 21V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14" />
      <path d="M8 7V4h8v3" />
      <path d="M2 21h20" />
      <path d="M8 11h8M8 15h8" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function actionIcon(name) {
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

const emptyBranchForm = {
  branchName: '',
  clinicName: '',
  phone: '',
  email: '',
  pincode: '',
  streetName: '',
  area: '',
  city: '',
  state: '',
  country: 'India',
  finalAddress: '',
}

export default function Branches() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [hospitals, setHospitals] = useState([])
  const [selectedHospitalId, setSelectedHospitalId] = useState('')
  const [branches, setBranches] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [branchLoading, setBranchLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyBranchForm)

  useEffect(() => {
    let isMounted = true

    async function loadHospitals() {
      try {
        const response = await listAssignmentHospitals()
        if (!isMounted) return
        const normalized = normalizeHospitalList(response)
        setHospitals(normalized)
        setSelectedHospitalId((current) => current || normalized[0]?.id || '')
      } catch (error) {
        if (!isMounted) return
        setHospitals([])
        setSelectedHospitalId('')
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadHospitals()
    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!selectedHospitalId) {
      setBranches([])
      setBranchLoading(false)
      return
    }

    let isMounted = true

    async function loadBranches() {
      setBranchLoading(true)
      try {
        const response = await listHospitalBranches(selectedHospitalId)
        if (!isMounted) return
        setBranches(normalizeBranchList(response))
      } catch (error) {
        if (!isMounted) return
        setBranches([])
      } finally {
        if (isMounted) setBranchLoading(false)
      }
    }

    loadBranches()
    return () => {
      isMounted = false
    }
  }, [selectedHospitalId])

  const selectedHospital = useMemo(
    () => hospitals.find((hospital) => hospital.id === selectedHospitalId) || hospitals[0] || null,
    [hospitals, selectedHospitalId],
  )

  const filteredBranches = useMemo(() => {
    const value = query.trim().toLowerCase()
    if (!value) return branches
    return branches.filter((branch) => `${branch.name} ${branch.phone} ${branch.email} ${branch.location}`.toLowerCase().includes(value))
  }, [branches, query])

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function openAddBranch() {
    setForm({
      ...emptyBranchForm,
      clinicName: selectedHospital?.name || '',
    })
    setModalOpen(true)
  }

  function closeAddBranch() {
    setModalOpen(false)
    setForm(emptyBranchForm)
  }

  function handleCreateBranch(event) {
    event.preventDefault()

    const branchName = form.branchName.trim()
    const phone = form.phone.trim()
    const email = form.email.trim()
    const streetName = form.streetName.trim()
    const city = form.city.trim()
    const state = form.state.trim()
    const country = form.country.trim()
    const finalAddress = form.finalAddress.trim()

    if (!branchName) {
      showToast('Branch name is required.', 'error')
      return
    }

    if (!/^\d{10}$/.test(phone)) {
      showToast('Phone must be a 10-digit Indian mobile number.', 'error')
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showToast('Please enter a valid email address.', 'error')
      return
    }

    if (!streetName || !city || !state || !country || !finalAddress) {
      showToast('Please complete the branch address.', 'error')
      return
    }

    const nextBranch = {
      id: Date.now(),
      name: branchName,
      phone,
      email,
      location: finalAddress,
      status: 'Active',
    }

    setBranches((current) => [nextBranch, ...current])
    closeAddBranch()
    showToast('Branch created successfully.')
  }

  return (
    <div className="branches-page-shell">
      <aside className="branches-sidebar" aria-label="Super admin navigation">
        <div className="branches-brand">
          <div className="branches-brand-mark">PMS</div>
          <div className="branches-brand-copy">
            <strong>PMS</strong>
            <small>Super Admin Console</small>
          </div>
        </div>

        <nav className="branches-nav" aria-label="Sidebar menu">
          {superAdminNavigation.map(({ label, path, icon, color }) => (
            <button
              key={label}
              type="button"
              className={`branches-nav-link${window.location.pathname === path ? ' is-active' : ''}`}
              onClick={() => navigate(path)}
            >
              <span className={`branches-icon accent-${color}`}>{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="branches-sidebar-footer">
          <span className="branches-sidebar-avatar">SA</span>
          <div>
            <strong>Super Admin</strong>
            <small>Super Admin</small>
            <em>● Online</em>
          </div>
        </div>
      </aside>

      <main className="branches-main">
        <header className="branches-topbar">
          <label className="branches-global-search" aria-label="Global search">
            <SearchIcon />
            <input type="search" placeholder="Search patients, doctors, appointments..." />
          </label>

          <div className="branches-topbar-right">
            <button type="button" className="branches-notification" aria-label="Notifications">
              <BellIcon />
              <span>14</span>
            </button>
            <UserProfileMenu roleType="super-admin" />
          </div>
        </header>

        <section className="branches-content">
          <div className="branches-page-header">
            <div>
              <h1>Branches</h1>
              <p>{selectedHospital ? `${filteredBranches.length} branch records for ${selectedHospital.name}` : 'Loading branches...'}</p>
            </div>

            <button type="button" className="branches-add-button" onClick={openAddBranch}>
              <PlusIcon />
              Add Branch
            </button>
          </div>

          <div className="branches-clinic-row">
            <div className="branches-clinic-tag">
              <span className="branches-clinic-icon"><ClinicIcon /></span>
              <span className="branches-clinic-label">CLINIC NAME</span>
              <strong>{selectedHospital?.name || 'Loading...'}</strong>
            </div>
          </div>

          <div className="branches-list-panel">
            <label className="branches-search-field">
              <SearchIcon />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search branch, city, email, phone..."
              />
            </label>

            <div className="branches-table-wrap">
              {loading || branchLoading ? (
                <div className="branches-empty-state">Loading branches...</div>
              ) : filteredBranches.length ? (
                <table className="branches-table">
                  <thead>
                    <tr>
                      <th>S.No.</th>
                      <th>Branch</th>
                      <th>Contact</th>
                      <th>Location</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBranches.map((branch, index) => (
                      <tr key={branch.id ?? `${branch.name}-${index}`}>
                        <td>{index + 1}</td>
                        <td className="branch-name-cell">
                          <span className="branch-pin">◉</span>
                          <div>
                            <strong>{branch.name}</strong>
                            <small>ID: {branch.id}</small>
                          </div>
                        </td>
                        <td className="branch-contact-cell">
                          <div>{branch.phone}</div>
                          <small>{branch.email || '—'}</small>
                        </td>
                        <td className="branch-location-cell">{branch.location}</td>
                        <td>
                          <span className={`branch-status ${String(branch.status).toLowerCase()}`}>{branch.status}</span>
                        </td>
                        <td>
                          <div className="branch-action-group">
                            <button type="button" className="branch-action-button" aria-label="View branch" title="View branch">{actionIcon('view')}</button>
                            <button type="button" className="branch-action-button" aria-label="Edit branch" title="Edit branch">{actionIcon('edit')}</button>
                            <button type="button" className="branch-action-button danger" aria-label="Delete branch" title="Delete branch">{actionIcon('delete')}</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="branches-empty-state">No branches found.</div>
              )}
            </div>
          </div>
        </section>
      </main>

      {modalOpen && (
        <div className="branches-modal-backdrop" onClick={closeAddBranch}>
          <div className="branches-modal" onClick={(event) => event.stopPropagation()} aria-modal="true" role="dialog">
            <div className="branches-modal-header">
              <div className="branches-modal-title-wrap">
                <span className="branches-modal-icon"><ClinicIcon /></span>
                <div>
                  <h2>Add Branch</h2>
                  <strong>{selectedHospital?.name || 'Clinic'}</strong>
                </div>
              </div>
              <button type="button" className="branches-modal-close" onClick={closeAddBranch} aria-label="Close">×</button>
            </div>

            <form className="branches-form" onSubmit={handleCreateBranch}>
              <div className="branches-form-grid">
                <label className="branches-field">
                  <span>Branch Name</span>
                  <input type="text" value={form.branchName} onChange={(event) => updateField('branchName', event.target.value)} placeholder="Branch Name" />
                </label>

                <label className="branches-field">
                  <span>Clinic Name</span>
                  <input type="text" value={selectedHospital?.name || form.clinicName} readOnly />
                </label>

                <label className="branches-field">
                  <span>Phone</span>
                  <input type="tel" value={form.phone} onChange={(event) => updateField('phone', event.target.value)} placeholder="10-digit Indian mobile number" />
                </label>

                <label className="branches-field">
                  <span>Email</span>
                  <input type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} placeholder="Email" />
                </label>

                <label className="branches-field">
                  <span>Address</span>
                  <div className="branches-subgrid">
                    <input type="text" value={form.pincode} onChange={(event) => updateField('pincode', event.target.value)} placeholder="Pincode" />
                    <input type="text" value={form.streetName} onChange={(event) => updateField('streetName', event.target.value)} placeholder="Street/Village Name" />
                    <input type="text" value={form.area} onChange={(event) => updateField('area', event.target.value)} placeholder="Area" />
                    <input type="text" value={form.city} onChange={(event) => updateField('city', event.target.value)} placeholder="City/District" />
                    <input type="text" value={form.state} onChange={(event) => updateField('state', event.target.value)} placeholder="State" />
                    <input type="text" value={form.country} onChange={(event) => updateField('country', event.target.value)} placeholder="Country" />
                    <textarea rows="3" value={form.finalAddress} onChange={(event) => updateField('finalAddress', event.target.value)} placeholder="Final Address" />
                  </div>
                </label>
              </div>

              <div className="branches-form-actions">
                <button type="button" className="branches-cancel-button" onClick={closeAddBranch}>Cancel</button>
                <button type="submit" className="branches-create-button">Create Branch</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
