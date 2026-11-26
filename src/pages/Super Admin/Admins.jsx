import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { confirmAction } from '../../components/confirmAction'
import { useToast } from '../../components/ToastProvider'
import RowActions from '../../components/RowActions'
import SuperAdminSidebar from './SuperAdminSidebar'
import SuperAdminTopbar from './SuperAdminTopbar'
import {
  createPharmacyAdmin,
  getPharmacyAdmin,
  getSuperAdminPharmacies,
  listPharmacyAdmins,
  deleteSuperAdminRole,
  listSuperAdminRoleDropdown,
  updatePharmacyAdmin,
} from '../../config/api'
import './AdminsModern.css'

const emptyForm = {
  name: '',
  email: '',
  mobileNumber: '',
  pharmacyPermissionRoleId: '',
  city: '',
  isActive: true,
}
const digitsOnly = (value, limit = 10) => String(value || '').replace(/\D/g, '').slice(0, limit)

function mergeAdmins(current, incoming) {
  const map = new Map()
  ;[...current, ...incoming].forEach((admin) => {
    const key = getId(admin) || admin?.email || admin?.mobileNumber || JSON.stringify(admin)
    if (key) map.set(String(key), admin)
  })
  return [...map.values()]
}

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

function getValue(item, keys, fallback = '-') {
  return keys.map((key) => item?.[key]).find((value) => value !== undefined && value !== null && value !== '') ?? fallback
}

function getNestedValue(item, paths, fallback = '-') {
  for (const path of paths) {
    const value = path.split('.').reduce((source, key) => source?.[key], item)
    if (value !== undefined && value !== null && value !== '') return value
  }
  return fallback
}

function displayValue(value, fallback = '-') {
  if (value === undefined || value === null || value === '') return fallback
  if (typeof value === 'object') return value.name || value.pharmacyName || value.address || fallback
  return value
}

function getAssignedPharmacyName(item, pharmacyOptions = []) {
  const admin = unwrapAdmin(item)
  const direct = displayValue(getNestedValue(admin, ['pharmacyName', 'PharmacyName', 'pharmacy.name', 'pharmacy.pharmacyName', 'assignedPharmacy.name', 'assignedPharmacy.pharmacyName', 'hospitalName']))
  if (direct && direct !== '-') return direct

  const pId = admin?.pharmacyId || admin?.PharmacyId
  if (pId && Array.isArray(pharmacyOptions) && pharmacyOptions.length) {
    const matched = pharmacyOptions.find((p) => String(getId(p)) === String(pId))
    if (matched) return getPharmacyOptionName(matched)
  }
  return '-'
}

function getPharmacyOptionName(item) {
  const pharmacy = unwrapAdmin(item)
  return displayValue(getNestedValue(pharmacy, ['pharmacyName', 'PharmacyName', 'name', 'Name', 'pharmacy.name', 'pharmacy.pharmacyName']))
}

function getPharmacyAddress(item) {
  const admin = unwrapAdmin(item)
  return displayValue(getNestedValue(admin, ['pharmacyAddress', 'PharmacyAddress', 'pharmacy.address', 'pharmacy.pharmacyAddress', 'address']))
}

function getPharmacyContact(item) {
  const admin = unwrapAdmin(item)
  return displayValue(getNestedValue(admin, ['pharmacyContactNumber', 'PharmacyContactNumber', 'pharmacy.contactNumber', 'pharmacy.pharmacyContactNumber', 'pharmacy.phone', 'contactNumber']))
}

function getPharmacyEmail(item) {
  const admin = unwrapAdmin(item)
  return displayValue(getNestedValue(admin, ['pharmacyEmail', 'PharmacyEmail', 'pharmacy.email', 'pharmacy.pharmacyEmail']))
}

function getMobileNumber(item) {
  const admin = unwrapAdmin(item)
  return getValue(admin, ['mobileNumber', 'MobileNumber', 'phone', 'mobile', 'phoneNumber', 'PhoneNumber', 'contactNumber'])
}

function getLocation(item) {
  const admin = unwrapAdmin(item)
  return [getValue(admin, ['city', 'City'], ''), getValue(admin, ['state', 'State'], ''), getValue(admin, ['country', 'Country'], ''), getValue(admin, ['postalCode', 'PostalCode'], '')].filter(Boolean).join(', ') || '-'
}

function rolePayloadValue(value) {
  if (value === '') return undefined
  return /^\d+$/.test(String(value)) ? Number(value) : value
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

function Admins() {
  const { showToast } = useToast()
  const [admins, setAdmins] = useState([])
  const [roleOptions, setRoleOptions] = useState([])
  const [pharmacyOptions, setPharmacyOptions] = useState([])
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const [editingAdmin, setEditingAdmin] = useState(null)
  const [viewingAdmin, setViewingAdmin] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const didLoadInitialData = useRef(false)

  const filteredAdmins = useMemo(() => {
    const q = query.trim().toLowerCase()
    return admins.filter((admin) => {
      // 1. Status Filter
      const adminStatus = String(getStatus(admin)).toLowerCase()
      if (statusFilter !== 'All' && adminStatus !== statusFilter.toLowerCase()) {
        return false
      }

      // 2. Query Filter (Name, Email, Pharmacy, City, Mobile)
      if (!q) return true

      const name = getName(admin).toLowerCase()
      const email = String(admin?.email || '').toLowerCase()
      const pharmacy = String(getAssignedPharmacyName(admin, pharmacyOptions) || '').toLowerCase()
      const city = String(getValue(admin, ['city', 'City'], '')).toLowerCase()
      const location = String(getLocation(admin) || '').toLowerCase()
      const mobile = String(getMobileNumber(admin) || '').toLowerCase()

      return (
        name.includes(q) ||
        email.includes(q) ||
        pharmacy.includes(q) ||
        city.includes(q) ||
        location.includes(q) ||
        mobile.includes(q) ||
        JSON.stringify(admin).toLowerCase().includes(q)
      )
    })
  }, [admins, query, statusFilter, pharmacyOptions])

  useEffect(() => {
    setPage(1)
  }, [query, statusFilter, pageSize])

  const pageCount = Math.max(1, Math.ceil(filteredAdmins.length / pageSize))

  useEffect(() => {
    if (page > pageCount) {
      setPage(pageCount)
    }
  }, [page, pageCount])

  const visibleAdmins = filteredAdmins.slice((page - 1) * pageSize, page * pageSize)

  const loadPharmacyOptions = useCallback(async () => {
    try {
      const response = await getSuperAdminPharmacies({ page: 1, pageSize: 100 })
      const options = normalizeList(response)
      setPharmacyOptions(options)
    } catch (error) {
      setPharmacyOptions([])
      console.warn('Background load pharmacies notice:', error)
    }
  }, [])

  const loadRoleOptions = useCallback(async () => {
    try {
      const response = await listSuperAdminRoleDropdown()
      const options = Array.isArray(response) ? response : response?.data?.roles || response?.data || response?.roles || response?.items || []
      setRoleOptions(Array.isArray(options) ? options : [])
    } catch {
      setRoleOptions([])
    }
  }, [])

  const loadAdmins = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await listPharmacyAdmins({ page: 1, pageSize: 100 })
      const list = normalizeList(response)
      setAdmins(list)
    } catch (err) {
      setAdmins([])
      const message = err.message || 'Unable to load pharmacy admins.'
      setError(message)
      showToast(message, 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    if (didLoadInitialData.current) return
    didLoadInitialData.current = true

    loadAdmins()
    loadRoleOptions()
    loadPharmacyOptions()
  }, [loadAdmins, loadRoleOptions, loadPharmacyOptions])

  function openCreate() {
    setCreateOpen(true)
    setEditingAdmin(null)
    setForm(emptyForm)
  }

  function closeEditor() {
    setCreateOpen(false)
    setEditingAdmin(null)
    setForm(emptyForm)
  }

  function openEdit(admin) {
    setCreateOpen(false)
    setEditingAdmin(admin)
    setForm({
      name: getName(admin),
      pharmacyName: getValue(admin, ['pharmacyName', 'PharmacyName'], ''),
      email: admin?.email || '',
      mobileNumber: getValue(admin, ['mobileNumber', 'MobileNumber', 'phone', 'mobile'], ''),
      pharmacyAddress: getPharmacyAddress(admin) === '-' ? '' : getPharmacyAddress(admin),
      pharmacyContactNumber: getPharmacyContact(admin) === '-' ? '' : getPharmacyContact(admin),
      pharmacyEmail: getPharmacyEmail(admin) === '-' ? '' : getPharmacyEmail(admin),
      city: getValue(admin, ['city', 'City'], ''),
      state: getValue(admin, ['state', 'State'], ''),
      country: getValue(admin, ['country', 'Country'], ''),
      postalCode: getValue(admin, ['postalCode', 'PostalCode'], ''),
      pharmacyPermissionRoleId: getValue(admin, ['pharmacyPermissionRoleId', 'PharmacyPermissionRoleId'], ''),
      isActive: String(getStatus(admin)).toLowerCase() === 'active',
    })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)

    const payload = {
      name: form.name,
      email: form.email,
      mobileNumber: form.mobileNumber,
      pharmacyPermissionRoleId: rolePayloadValue(form.pharmacyPermissionRoleId),
      ...(form.city ? { city: form.city } : {}),
      ...(editingAdmin ? {
        isActive: form.isActive,
        pharmacyName: form.pharmacyName,
        pharmacyAddress: form.pharmacyAddress,
        pharmacyContactNumber: form.pharmacyContactNumber,
        pharmacyEmail: form.pharmacyEmail,
        city: form.city,
        state: form.state,
        country: form.country,
        postalCode: form.postalCode,
      } : {}),
    }

    try {
      if (editingAdmin) {
        const adminId = getId(editingAdmin)
        if (!adminId) throw new Error('Missing admin ID for update.')
        const data = await updatePharmacyAdmin(adminId, payload)
        const responseAdmin = unwrapAdmin(data)
        const hasMatchingResponseId = String(getId(responseAdmin) || '') === String(adminId)
        const updatedAdmin = hasMatchingResponseId
          ? { ...editingAdmin, ...payload, ...responseAdmin }
          : { ...editingAdmin, ...payload }
        setAdmins((current) => current.map((admin) => (
          String(getId(admin)) === String(adminId) ? updatedAdmin : admin
        )))
        showToast(data?.message || 'Admin updated successfully.')
      } else {
        const data = await createPharmacyAdmin(payload)
        const createdAdmin = unwrapAdmin(data) || data?.data?.admin || data?.admin || { ...payload, id: data?.id || data?.adminId || Date.now() }
        setAdmins((current) => mergeAdmins(current, [createdAdmin]))
        showToast(data?.message || 'Admin created successfully.')
      }

      closeEditor()
    } catch (error) {
      showToast(error.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function openView(admin) {
    const adminId = getId(admin)
    if (!adminId) {
      setViewingAdmin(unwrapAdmin(admin))
      return
    }

    try {
      const response = await getPharmacyAdmin(adminId)
      setViewingAdmin(unwrapAdmin(response))
    } catch (error) {
      showToast(error.message || 'Unable to load admin details.', 'error')
      setViewingAdmin(unwrapAdmin(admin))
    }
  }

  async function handleDelete(admin) {
    const adminId = getId(admin)
    if (!adminId) {
      showToast('Unable to delete admin: missing admin ID.', 'error')
      return
    }
    if (!await confirmAction(`Are you sure you want to delete ${getName(admin)}?`)) return

    try {
      const response = await deleteSuperAdminRole(adminId)
      showToast(response?.message || 'Admin deleted successfully.')
      await loadAdmins()
    } catch (error) {
      showToast(error.message || 'Unable to delete admin.', 'error')
    }
  }

  return (
    <div className={`admins-page-shell${sidebarOpen ? ' sidebar-open' : ''}`}>
      <SuperAdminSidebar activeLabel="Admins" />

      <main className="admins-main">
        <SuperAdminTopbar onMenu={() => setSidebarOpen((value) => !value)} />

        <section className="admins-content">
          <div className="admins-section-header">
            <div>
              <h1>Admin Management</h1>
              {loading ? (
                <p>Loading pharmacy admins...</p>
              ) : error ? (
                <p className="admins-header-error">Failed to load admins</p>
              ) : (
                <p>{filteredAdmins.length} {filteredAdmins.length === 1 ? 'admin' : 'admins'} found</p>
              )}
            </div>
            <div className="admins-header-actions">
              <button
                type="button"
                className="admins-refresh-btn"
                onClick={() => {
                  loadAdmins()
                  loadRoleOptions()
                  loadPharmacyOptions()
                }}
                disabled={loading}
                title="Refresh admins list"
                aria-label="Refresh admins list"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
                </svg>
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>

          <div className="admins-toolbar">
            <label className="admins-table-search">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6" /><path d="M16 16L21 21" /></svg>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search admins by name, email, pharmacy, or city..."
              />
            </label>
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className="admins-filter-button"
                onClick={() => setFilterDropdownOpen((prev) => !prev)}
                aria-label="Filter admins by status"
              >
                Status: {statusFilter}
                <span>▾</span>
              </button>
              {filterDropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '6px',
                    background: '#fff',
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                    borderRadius: '12px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    zIndex: 50,
                    minWidth: '130px',
                    padding: '6px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  {['All', 'Active', 'Inactive'].map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        setStatusFilter(option)
                        setFilterDropdownOpen(false)
                      }}
                      style={{
                        border: 0,
                        background: statusFilter === option ? '#eff6ff' : 'transparent',
                        color: statusFilter === option ? '#2563eb' : '#334155',
                        fontWeight: statusFilter === option ? 700 : 500,
                        padding: '8px 12px',
                        borderRadius: '8px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: '13px',
                      }}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button type="button" className="admins-primary-button" onClick={openCreate}>
              <span>＋</span>
              Create Pharmacy Admin
            </button>
          </div>

          <div className="admins-table-card">
            <table className="admins-table">
              <thead>
                <tr>
                  <th>S.No.</th>
                  <th>Name</th>
                  <th>Pharmacy Name</th>
                  <th>Email</th>
                  <th>Mobile Number</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="admins-empty-cell">
                      <span className="admins-loading-spinner" />
                      Loading admins...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan="7" className="admins-empty-cell admins-error-cell">
                      <div className="admins-error-box">
                        <span className="admins-error-icon">⚠️</span>
                        <div className="admins-error-text">
                          <strong>Failed to load admins</strong>
                          <p>{error}</p>
                        </div>
                        <button type="button" className="admins-retry-button" onClick={loadAdmins}>
                          Retry
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : visibleAdmins.length ? visibleAdmins.map((admin, index) => {
                  const adminId = getId(admin)
                  const rowKey = adminId || admin?.email || `admin-row-${(page - 1) * pageSize + index}`
                  const adminName = getName(admin)
                  const isActive = String(getStatus(admin)).toLowerCase() === 'active'

                  return (
                    <tr key={rowKey}>
                      <td>{(page - 1) * pageSize + index + 1}</td>
                      <td>
                        <span className="admin-name-cell">
                          <span className="admin-avatar">{getInitials(adminName)}</span>
                          <span className="admin-name-text">{adminName}</span>
                        </span>
                      </td>
                      <td>{getAssignedPharmacyName(admin, pharmacyOptions)}</td>
                      <td>{admin?.email || '-'}</td>
                      <td>{getMobileNumber(admin)}</td>
                      <td>
                        <span className={`admin-status ${isActive ? 'active' : 'inactive'}`}>
                          {isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <RowActions
                          itemName={adminName}
                          isActive={isActive}
                          onView={() => openView(admin)}
                          onEdit={() => openEdit(admin)}
                          onDelete={() => handleDelete(admin)}
                        />
                      </td>
                    </tr>
                  )
                }) : (
                  <tr>
                    <td className="admins-empty-cell" colSpan="7">
                      {query || statusFilter !== 'All'
                        ? 'No admins match your search or filter criteria.'
                        : 'No pharmacy admins found. Click "Create Pharmacy Admin" to add one.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="admins-pagination-row">
            <div className="admins-pagination-info">
              <span>
                Showing {filteredAdmins.length ? (page - 1) * pageSize + 1 : 0} to{' '}
                {Math.min(page * pageSize, filteredAdmins.length)} of {filteredAdmins.length} admins
              </span>
              <label className="admins-page-size-selector">
                <span>Per page:</span>
                <select
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value))
                    setPage(1)
                  }}
                  aria-label="Admins per page"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </label>
            </div>
            <div className="admins-pagination">
              <button type="button" onClick={() => setPage(1)} disabled={page === 1}>First</button>
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Prev</button>
              {Array.from({ length: pageCount }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === pageCount || Math.abs(p - page) <= 1)
                .map((pageNum) => (
                  <button
                    key={pageNum}
                    type="button"
                    className={pageNum === page ? 'is-current' : ''}
                    onClick={() => setPage(pageNum)}
                  >
                    {pageNum}
                  </button>
                ))}
              <button type="button" onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page === pageCount || pageCount === 0}>Next</button>
              <button type="button" onClick={() => setPage(pageCount)} disabled={page === pageCount || pageCount === 0}>Last</button>
            </div>
          </div>
        </section>
      </main>

      {viewingAdmin && (
        <div className="sa-modal-backdrop" onClick={() => setViewingAdmin(null)}>
          <div className="sa-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="sa-modal-header">
              <h2>Admin Details: {getName(viewingAdmin)}</h2>
              <button type="button" className="sa-modal-close" onClick={() => setViewingAdmin(null)}>&times;</button>
            </div>
            <div className="sa-modal-body">
              <div className="sa-modal-grid">
                <div className="sa-modal-field">
                  <label>Full Name</label>
                  <span>{getName(viewingAdmin)}</span>
                </div>
                <div className="sa-modal-field">
                  <label>Email Address</label>
                  <span>{viewingAdmin?.email || '-'}</span>
                </div>
                <div className="sa-modal-field">
                  <label>Mobile Number</label>
                  <span>{getMobileNumber(viewingAdmin)}</span>
                </div>
                <div className="sa-modal-field">
                  <label>Status</label>
                  <span>{getStatus(viewingAdmin)}</span>
                </div>
                <div className="sa-modal-field">
                  <label>Pharmacy Name</label>
                  <span>{getAssignedPharmacyName(viewingAdmin, pharmacyOptions)}</span>
                </div>
                <div className="sa-modal-field">
                  <label>Pharmacy Address</label>
                  <span>{getPharmacyAddress(viewingAdmin)}</span>
                </div>
                <div className="sa-modal-field">
                  <label>Pharmacy Contact</label>
                  <span>{getPharmacyContact(viewingAdmin)}</span>
                </div>
                <div className="sa-modal-field">
                  <label>Pharmacy Email</label>
                  <span>{getPharmacyEmail(viewingAdmin)}</span>
                </div>
                <div className="sa-modal-field">
                  <label>Location</label>
                  <span>{getLocation(viewingAdmin)}</span>
                </div>
              </div>
            </div>
            <div className="sa-modal-footer">
              <button type="button" className="sa-btn-secondary" onClick={() => setViewingAdmin(null)}>Close</button>
              <button
                type="button"
                className="sa-btn-primary"
                onClick={() => {
                  const a = viewingAdmin
                  setViewingAdmin(null)
                  openEdit(a)
                }}
              >
                Edit Admin
              </button>
            </div>
          </div>
        </div>
      )}

      {(createOpen || editingAdmin) ? (
        <div className="admins-modal-backdrop" onClick={closeEditor}>
          <div className="admins-modal-card" style={{ maxWidth: '640px' }} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
            <div className="admins-modal-header">
              <div className="admins-form-header" style={{ marginBottom: 0 }}>
                <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>
                  {editingAdmin ? 'Edit Admin' : 'Create new admin'}
                </h2>
                <p style={{ margin: '6px 0 0', color: 'var(--admins-muted, #64748b)', fontSize: '0.92rem' }}>
                  {editingAdmin ? 'Update pharmacy admin details and access status.' : 'Create pharmacy admin access. Assign pharmacy and main branch after creation.'}
                </p>
              </div>
              <button type="button" className="admins-modal-close" onClick={closeEditor} aria-label="Close">&times;</button>
            </div>

            <form className="admins-form" onSubmit={handleSubmit}>
              <div className="admins-form-grid">
                <label className="admins-field">
                  <span>Name</span>
                  <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Admin name" required />
                </label>
                <label className="admins-field">
                  <span>Email</span>
                  <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="admin@example.com" required />
                </label>

                <label className="admins-field">
                  <span>Mobile Number</span>
                  <input inputMode="numeric" maxLength={10} pattern="[0-9]{10}" value={form.mobileNumber} onChange={(event) => setForm({ ...form, mobileNumber: digitsOnly(event.target.value) })} placeholder="Mobile number" />
                </label>

                <label className="admins-field">
                  <span>City</span>
                  <input value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} placeholder="City" />
                </label>

                {roleOptions.length > 0 && (
                  <label className="admins-field">
                    <span>Role / Permissions</span>
                    <select
                      value={form.pharmacyPermissionRoleId}
                      onChange={(event) => setForm({ ...form, pharmacyPermissionRoleId: event.target.value })}
                    >
                      <option value="">Default Permissions</option>
                      {roleOptions.map((role) => (
                        <option key={getId(role) || role.name} value={getId(role)}>
                          {role.name || role.roleName || `Role ${getId(role)}`}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {editingAdmin ? (
                  <label className="admins-field">
                    <span>Access Status</span>
                    <select value={form.isActive ? 'true' : 'false'} onChange={(event) => setForm({ ...form, isActive: event.target.value === 'true' })}>
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </label>
                ) : null}
              </div>

              <div className="admins-form-actions" style={{ marginTop: '24px' }}>
                <button type="button" className="admins-cancel-button" onClick={closeEditor}>Cancel</button>
                <button type="submit" className="admins-submit-button" disabled={saving}>
                  {saving ? 'Saving...' : editingAdmin ? 'Save Admin' : 'Create admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default Admins
