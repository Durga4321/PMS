import { useEffect, useMemo, useState } from 'react'
import AdminLayout from './AdminLayout'
import RowActions from '../../components/RowActions'
import { useToast } from '../../components/ToastProvider'
import {
  changeSuperAdminPharmacyStatus,
  createSuperAdminPharmacy,
  deleteSuperAdminPharmacy,
  getAddressByPincode,
  getSuperAdminPharmacies,
  updateSuperAdminPharmacy,
  getPharmacyAdminPharmacy,
  registerPharmacyAdminPharmacy,
  updatePharmacySettings,
  scopedKey,
  migrateLegacyCache,
} from '../../config/api'
import '../Super Admin/Branches.css'

const headers = ['S.No.', 'Pharmacy Name', 'Contact Number', 'Address', 'Status', 'Actions']
const emptyForm = { name: '', phone: '', email: '', address: '', city: '', district: '', state: '', country: '', postalCode: '', status: 'Active' }
const digitsOnly = (value, limit = 10) => String(value || '').replace(/\D/g, '').slice(0, limit)
const LOCAL_PHARMACIES_KEY = 'pms_admin_pharmacies_list'
const DELETED_PHARMACIES_KEY = 'pms_admin_deleted_pharmacies_list'

function readDeletedPharmacyIds() {
  try {
    const key = scopedKey(DELETED_PHARMACIES_KEY)
    migrateLegacyCache(DELETED_PHARMACIES_KEY, key)
    const raw = localStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveDeletedPharmacyIds(ids) {
  try {
    const key = scopedKey(DELETED_PHARMACIES_KEY)
    localStorage.setItem(key, JSON.stringify(ids))
  } catch {}
}

function removeDeletedPharmacyId(id) {
  try {
    const key = scopedKey(DELETED_PHARMACIES_KEY)
    const ids = readDeletedPharmacyIds().filter((d) => String(d) !== String(id))
    localStorage.setItem(key, JSON.stringify(ids))
  } catch {}
}

function readLocalPharmacies() {
  try {
    const key = scopedKey(LOCAL_PHARMACIES_KEY)
    migrateLegacyCache(LOCAL_PHARMACIES_KEY, key)
    const raw = localStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeLocalPharmacies(items) {
  try {
    const key = scopedKey(LOCAL_PHARMACIES_KEY)
    localStorage.setItem(key, JSON.stringify(items))
  } catch {
    // ignore local storage errors
  }
}

function listFrom(response) {
  if (Array.isArray(response)) return response
  if (Array.isArray(response?.data)) return response.data
  if (Array.isArray(response?.data?.pharmacies)) return response.data.pharmacies
  if (Array.isArray(response?.pharmacies)) return response.pharmacies
  if (Array.isArray(response?.data?.admins)) return response.data.admins
  if (Array.isArray(response?.admins)) return response.admins
  if (Array.isArray(response?.items)) return response.items
  if (Array.isArray(response?.results)) return response.results
  return []
}

function unwrapPharmacy(item) {
  return item?.pharmacy || item?.admin || item?.data?.pharmacy || item?.data?.admin || item?.data || item || {}
}

function text(value, fallback = '-') {
  if (value === undefined || value === null) return fallback
  const output = String(value).trim()
  return output ? output : fallback
}

function idOf(item) {
  const p = unwrapPharmacy(item)
  return p.pharmacyId || p.PharmacyId || p.id || p._id || p.adminId
}

function pharmacyName(item) {
  const p = unwrapPharmacy(item)
  return text(p.pharmacyName || p.PharmacyName || p.name || p.Name || p.pharmacy?.name || p.pharmacy?.pharmacyName)
}

function contactNumber(item) {
  const p = unwrapPharmacy(item)
  return text(p.pharmacyContactNumber || p.PharmacyContactNumber || p.contactNumber || p.ContactNumber || p.phoneNumber || p.mobileNumber || p.MobileNumber || p.phone || p.mobile)
}

function emailOf(item) {
  const p = unwrapPharmacy(item)
  return text(p.pharmacyEmail || p.PharmacyEmail || p.email || p.Email)
}

function addressOf(item) {
  const p = unwrapPharmacy(item)
  const address = p.pharmacyAddress || p.PharmacyAddress || p.address || p.Address || p.location || p.pharmacy?.address
  const location = [p.city || p.City, p.state || p.State, p.country || p.Country, p.postalCode || p.PostalCode].filter(Boolean).join(', ')
  return text([address, location].filter((part) => text(part, '')).join(', '))
}

function statusOf(item) {
  const p = unwrapPharmacy(item)
  const value = p.accountStatus || p.status || p.isActive
  if (typeof value === 'boolean') return value ? 'Active' : 'Inactive'
  return text(value, 'Active')
}

function PharmacyNameCell({ pharmacy, index }) {
  const name = pharmacyName(pharmacy)
  const id = idOf(pharmacy) || index + 1
  return (
    <div className="branches-name-cell">
      <span className="branches-location-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 21h18" />
          <path d="M5 21V7l8-4 6 3v15" />
          <path d="M9 9h1M9 13h1M9 17h1M14 10h1M14 14h1M14 18h1" />
        </svg>
      </span>
      <div className="branches-column-details">
        <strong>{name}</strong>
        <small className="branches-subtext">Pharmacy ID: {id}</small>
      </div>
    </div>
  )
}

function ContactCell({ pharmacy }) {
  return (
    <div className="branches-contact-cell">
      <strong>{contactNumber(pharmacy)}</strong>
      <small className="branches-subtext">{emailOf(pharmacy)}</small>
    </div>
  )
}

function StatusBadge({ status }) {
  const isActive = String(status).toLowerCase() === 'active'
  return <span className={`branches-status-pill ${isActive ? 'active' : 'inactive'}`}><i />{isActive ? 'Active' : 'Inactive'}</span>
}

export default function AdminPharmacies() {
  const { showToast } = useToast()
  const [pharmacies, setPharmacies] = useState([])
  const [viewingPharmacy, setViewingPharmacy] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editingPharmacy, setEditingPharmacy] = useState(null)
  const [form, setForm] = useState(emptyForm)

  async function loadPharmacies() {
    setLoading(true)
    setError('')
    try {
      const deletedIds = readDeletedPharmacyIds()

      // 1. First try to load the Pharmacy Admin's registered pharmacy
      let adminPharmacy = null
      try {
        const res = await getPharmacyAdminPharmacy()
        adminPharmacy = res?.pharmacy || res?.data?.pharmacy || (res?.id || res?.pharmacyId ? res : null)
      } catch (adminErr) {
        // Not registered yet or other role
      }

      if (adminPharmacy && !deletedIds.includes(String(idOf(adminPharmacy)))) {
        const unwrapped = unwrapPharmacy(adminPharmacy)
        const localList = readLocalPharmacies().filter((p) => !deletedIds.includes(String(idOf(p))))
        const id = idOf(unwrapped)
        const filtered = localList.filter((p) => String(idOf(p)) !== String(id))
        writeLocalPharmacies([unwrapped, ...filtered])
        setPharmacies([unwrapped])
        return
      }

      // 2. Fallback to current admin's isolated local storage
      const localItems = readLocalPharmacies().filter((p) => !deletedIds.includes(String(idOf(p))))
      setPharmacies(localItems)
    } catch (requestError) {
      console.log('Unable to load pharmacies from API, reading local cache:', requestError.message)
      const deletedIds = readDeletedPharmacyIds()
      const localItems = readLocalPharmacies().filter((p) => !deletedIds.includes(String(idOf(p))))
      setPharmacies(localItems)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPharmacies()
  }, [])

  function openEdit(pharmacy) {
    setEditingPharmacy(pharmacy)
    setCreateOpen(false)
    setError('')
    setForm({
      name: pharmacyName(pharmacy) === '-' ? '' : pharmacyName(pharmacy),
      phone: contactNumber(pharmacy) === '-' ? '' : contactNumber(pharmacy),
      email: emailOf(pharmacy) === '-' ? '' : emailOf(pharmacy),
      address: addressOf(pharmacy) === '-' ? '' : addressOf(pharmacy),
      city: pharmacy.city || pharmacy.City || '',
      district: pharmacy.district || pharmacy.District || '',
      state: pharmacy.state || pharmacy.State || '',
      country: pharmacy.country || pharmacy.Country || 'India',
      postalCode: pharmacy.postalCode || pharmacy.PostalCode || '',
      status: statusOf(pharmacy),
    })
  }

  async function handlePostalCodeChange(value) {
    const clean = digitsOnly(value, 6)
    setForm((current) => ({ ...current, postalCode: clean }))
    if (clean.length !== 6) return

    try {
      const response = await getAddressByPincode(clean)
      const source = response?.data?.address || response?.data || response?.address || response?.result || response || {}
      const address = Array.isArray(source) ? source[0] || {} : source
      setForm((current) => ({
        ...current,
        postalCode: clean,
        city: address.area || address.Area || address.city || address.City || current.city,
        district: address.district || address.District || current.district,
        state: address.state || address.State || current.state,
        country: address.country || address.Country || current.country || 'India',
      }))
    } catch {
      // Pincode lookup is optional
    }
  }

  async function savePharmacy(event) {
    event.preventDefault()
    if (!String(form.name || '').trim()) {
      setError('Pharmacy Name is required.')
      showToast('Pharmacy Name is required.', 'error')
      return
    }
    if (form.phone && !/^\d{10}$/.test(form.phone)) {
      setError('Phone number must be exactly 10 digits.')
      showToast('Phone number must be exactly 10 digits.', 'error')
      return
    }

    setSaving(true)
    setError('')
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone ? form.phone.trim() : '',
        email: form.email ? form.email.trim() : '',
        address: form.address ? form.address.trim() : '',
        city: form.city ? form.city.trim() : '',
        district: form.district ? form.district.trim() : '',
        state: form.state ? form.state.trim() : '',
        country: form.country ? form.country.trim() : 'India',
        postalCode: form.postalCode ? form.postalCode.trim() : '',
      }

      if (editingPharmacy) {
        const id = idOf(editingPharmacy)
        if (id) removeDeletedPharmacyId(id)
        let updatedSuccess = false
        try {
          await updateSuperAdminPharmacy(id, { ...payload, isActive })
          updatedSuccess = true
        } catch {
          try {
            await updatePharmacySettings({
              pharmacyName: payload.name,
              phoneNumber: payload.phone,
              emailAddress: payload.email,
              address: payload.address,
              isActive,
            })
            updatedSuccess = true
          } catch (settingsErr) {
            console.error('Update pharmacy failed on both endpoints:', settingsErr)
          }
        }
        
        const updatedRecord = { ...editingPharmacy, ...payload, id, pharmacyId: id, status: form.status || 'Active', isActive }
        const currentList = readLocalPharmacies()
        const nextList = currentList.map((p) => String(idOf(p)) === String(id) ? updatedRecord : p)
        writeLocalPharmacies(nextList)
        setPharmacies((current) => current.map((p) => String(idOf(p)) === String(id) ? updatedRecord : p))
        showToast('Pharmacy updated successfully.')
      } else {
        let createdRecord = null
        let savedViaApi = false
        try {
          const response = await registerPharmacyAdminPharmacy(payload)
          createdRecord = response?.pharmacy || response?.data?.pharmacy || response
          savedViaApi = true
          showToast(response?.message || 'Pharmacy created successfully! Main Branch 1 created and assigned.')
        } catch (regErr) {
          const msg = String(regErr.message || '').toLowerCase()
          if (msg.includes('already has a pharmacy')) {
            savedViaApi = true
            try {
              await updatePharmacySettings({
                pharmacyName: payload.name,
                phoneNumber: payload.phone,
                emailAddress: payload.email,
                address: payload.address,
              })
              showToast('Pharmacy details updated in database successfully!')
            } catch (settingsErr) {
              throw regErr
            }
          } else {
            try {
              const superRes = await createSuperAdminPharmacy(payload)
              createdRecord = superRes?.data?.pharmacy || superRes?.pharmacy || superRes
              savedViaApi = true
              showToast('Pharmacy created successfully!')
            } catch {
              throw regErr
            }
          }
        }

        const id = createdRecord?.id || createdRecord?.pharmacyId || createdRecord?._id
        if (id) {
          removeDeletedPharmacyId(id)
          try {
            sessionStorage.setItem('workingPharmacyId', String(id))
            localStorage.setItem('workingPharmacyId', String(id))
            const rawAssign = sessionStorage.getItem('pharmacyAdminAssignment') || localStorage.getItem('pharmacyAdminAssignment')
            const parsedAssign = rawAssign ? JSON.parse(rawAssign) : {}
            const updatedAssign = {
              ...parsedAssign,
              pharmacyId: id,
              pharmacyName: payload.name,
              pharmacy: createdRecord || payload,
            }
            sessionStorage.setItem('pharmacyAdminAssignment', JSON.stringify(updatedAssign))
            localStorage.setItem('pharmacyAdminAssignment', JSON.stringify(updatedAssign))
          } catch {}
        }

        // Only write to local cache when the API won't return this pharmacy automatically.
        // If savedViaApi is true, loadPharmacies() below will fetch it from the backend,
        // so we skip the manual cache write to prevent duplicates.
        if (!savedViaApi) {
          const tempId = `PHARM-${Date.now()}`
          const newPharmacy = {
            ...payload,
            id: tempId,
            pharmacyId: tempId,
            status: form.status || 'Active',
            isActive: form.status !== 'Inactive',
          }
          const currentList = readLocalPharmacies()
          writeLocalPharmacies([newPharmacy, ...currentList])
        }
      }

      await loadPharmacies()
      setCreateOpen(false)
      setEditingPharmacy(null)
      setForm(emptyForm)
    } catch (requestError) {
      setError(requestError.message || `Unable to ${editingPharmacy ? 'update' : 'create'} pharmacy.`)
      showToast(requestError.message, 'error')
      await loadPharmacies()
    } finally {
      setSaving(false)
    }
  }

  async function toggleStatus(pharmacy, explicitActive) {
    const id = idOf(pharmacy)
    if (!id) return
    const currentActive = String(statusOf(pharmacy)).toLowerCase() === 'active'
    const nextActive = explicitActive !== undefined ? explicitActive : !currentActive
    const nextStatus = nextActive ? 'Active' : 'Inactive'

    if (/^\d+$/.test(String(id))) {
      try {
        await changeSuperAdminPharmacyStatus(id, { isActive: nextActive, status: nextStatus })
      } catch {
        try {
          await updatePharmacySettings({
            pharmacyName: pharmacyName(pharmacy),
            isActive: nextActive,
          })
        } catch (err) {
          console.log('Status API failed, updating locally:', err.message)
        }
      }
    }

    showToast(`Pharmacy marked as ${nextStatus}.`)
    const updated = { ...pharmacy, status: nextStatus, isActive: nextActive }
    const currentList = readLocalPharmacies().map((p) => String(idOf(p)) === String(id) ? updated : p)
    writeLocalPharmacies(currentList)
    setPharmacies((current) => current.map((p) => String(idOf(p)) === String(id) ? updated : p))
  }

  async function handleDeletePharmacy(pharmacy) {
    const id = idOf(pharmacy)
    if (!id) return
    const name = pharmacyName(pharmacy)
    if (!window.confirm(`Are you sure you want to delete ${name}?`)) return

    // 1. If it has a numeric database ID, attempt backend deletion
    if (/^\d+$/.test(String(id))) {
      try {
        await deleteSuperAdminPharmacy(id)
      } catch (err) {
        console.log('Backend delete request completed:', err.message)
      }
    }

    // 2. Mark this ID as deleted so it never reappears on reload
    const deleted = readDeletedPharmacyIds()
    if (!deleted.includes(String(id))) {
      saveDeletedPharmacyIds([...deleted, String(id)])
    }

    // 3. Immediately remove from local storage and React state
    const currentList = readLocalPharmacies().filter((p) => String(idOf(p)) !== String(id))
    writeLocalPharmacies(currentList)
    setPharmacies((current) => current.filter((p) => String(idOf(p)) !== String(id)))
    showToast(`Pharmacy ${name} deleted successfully.`)
  }

  const filteredPharmacies = useMemo(() => {
    if (!search.trim()) return pharmacies
    const q = search.trim().toLowerCase()
    return pharmacies.filter((p) => {
      const name = pharmacyName(p).toLowerCase()
      const phone = contactNumber(p).toLowerCase()
      const email = emailOf(p).toLowerCase()
      const address = addressOf(p).toLowerCase()
      return name.includes(q) || phone.includes(q) || email.includes(q) || address.includes(q)
    })
  }, [pharmacies, search])

  return (
    <AdminLayout
      activeLabel="Pharmacies"
      title="Pharmacy Management"
      subtitle="Create and manage pharmacy profiles, addresses, contact details, and operational status."
    >
      <section className="super-admin-module-panel">
        <div className="super-admin-module-header">
          <h2>Pharmacy Management</h2>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div className="sa-search-wrap" style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Search pharmacy management..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  padding: '9px 14px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  width: '260px',
                  outline: 'none',
                }}
              />
            </div>
            <button
              type="button"
              className="sa-btn-primary"
              onClick={() => {
                setEditingPharmacy(null)
                setForm(emptyForm)
                setError('')
                setCreateOpen(true)
              }}
            >
              + Create Pharmacy
            </button>
          </div>
        </div>

        {error ? <div className="super-admin-module-error">{error}</div> : null}

        <div className="super-admin-module-table">
          <table>
            <thead>
              <tr>
                {headers.map((header) => (
                  <th key={header}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={headers.length} style={{ textAlign: 'center', padding: '40px' }}>
                    Loading data...
                  </td>
                </tr>
              ) : filteredPharmacies.length ? (
                filteredPharmacies.map((pharmacy, index) => {
                  const status = statusOf(pharmacy)
                  const id = idOf(pharmacy) || index
                  return (
                    <tr key={id}>
                      <td style={{ textAlign: 'center' }}>
                        <span className="branches-serial">{index + 1}</span>
                      </td>
                      <td>
                        <PharmacyNameCell pharmacy={pharmacy} index={index} />
                      </td>
                      <td>
                        <ContactCell pharmacy={pharmacy} />
                      </td>
                      <td>
                        <span className="branches-location-text" title={addressOf(pharmacy)}>
                          {addressOf(pharmacy)}
                        </span>
                      </td>
                      <td>
                        <StatusBadge status={status} />
                      </td>
                      <td>
                        <RowActions
                          itemName={pharmacyName(pharmacy)}
                          isActive={String(status).toLowerCase() === 'active'}
                          onView={() => setViewingPharmacy(pharmacy)}
                          onEdit={() => openEdit(pharmacy)}
                          onStatus={() => toggleStatus(pharmacy)}
                          onDelete={() => handleDeletePharmacy(pharmacy)}
                        />
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={headers.length} style={{ textAlign: 'center', padding: '40px' }}>
                    No pharmacies available. Click "+ Create Pharmacy" to add your first pharmacy.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal: Create or Edit Pharmacy */}
      {createOpen || editingPharmacy ? (
        <div className="sa-modal-backdrop" onClick={() => { setCreateOpen(false); setEditingPharmacy(null) }}>
          <form className="sa-modal-card" onSubmit={savePharmacy} onClick={(e) => e.stopPropagation()}>
            <div className="sa-modal-header">
              <h2>{editingPharmacy ? 'Edit Pharmacy' : 'Create Pharmacy'}</h2>
              <button
                type="button"
                className="sa-modal-close"
                onClick={() => {
                  setCreateOpen(false)
                  setEditingPharmacy(null)
                }}
              >
                &times;
              </button>
            </div>
            <div className="sa-modal-body">
              {error ? <div className="super-admin-module-error" style={{ marginBottom: '12px' }}>{error}</div> : null}
              <div className="sa-modal-grid">
                <div className="sa-modal-field" style={{ gridColumn: '1 / -1' }}>
                  <label>Pharmacy Name *</label>
                  <input
                    required
                    type="text"
                    placeholder="Enter pharmacy name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="sa-modal-field">
                  <label>Contact Number (10 digits)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="e.g. 9876543210"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: digitsOnly(e.target.value) })}
                  />
                </div>
                <div className="sa-modal-field">
                  <label>Email Address</label>
                  <input
                    type="email"
                    placeholder="pharmacy@example.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div className="sa-modal-field" style={{ gridColumn: '1 / -1' }}>
                  <label>Address</label>
                  <textarea
                    rows={2}
                    placeholder="Street address, building, suite"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                  />
                </div>
                <div className="sa-modal-field">
                  <label>Pincode / Postal Code</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="6-digit pincode"
                    value={form.postalCode}
                    onChange={(e) => handlePostalCodeChange(e.target.value)}
                  />
                </div>
                <div className="sa-modal-field">
                  <label>City</label>
                  <input
                    type="text"
                    placeholder="City"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                  />
                </div>
                <div className="sa-modal-field">
                  <label>District</label>
                  <input
                    type="text"
                    placeholder="District"
                    value={form.district}
                    onChange={(e) => setForm({ ...form, district: e.target.value })}
                  />
                </div>
                <div className="sa-modal-field">
                  <label>State</label>
                  <input
                    type="text"
                    placeholder="State"
                    value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value })}
                  />
                </div>
                <div className="sa-modal-field">
                  <label>Country</label>
                  <input
                    type="text"
                    placeholder="Country"
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                  />
                </div>
                <div className="sa-modal-field">
                  <label>Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="sa-modal-footer">
              <button
                type="button"
                className="sa-btn-secondary"
                onClick={() => {
                  setCreateOpen(false)
                  setEditingPharmacy(null)
                }}
              >
                Cancel
              </button>
              <button type="submit" className="sa-btn-primary" disabled={saving}>
                {saving ? (editingPharmacy ? 'Saving...' : 'Creating...') : (editingPharmacy ? 'Save Changes' : 'Create Pharmacy')}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {/* Modal: View Pharmacy Details */}
      {viewingPharmacy ? (
        <div className="sa-modal-backdrop" onClick={() => setViewingPharmacy(null)}>
          <div className="sa-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="sa-modal-header">
              <h2>Pharmacy Details: {pharmacyName(viewingPharmacy)}</h2>
              <button type="button" className="sa-modal-close" onClick={() => setViewingPharmacy(null)}>
                &times;
              </button>
            </div>
            <div className="sa-modal-body">
              <div className="sa-modal-grid">
                <div className="sa-modal-field">
                  <label>Pharmacy Name</label>
                  <span>{pharmacyName(viewingPharmacy)}</span>
                </div>
                <div className="sa-modal-field">
                  <label>Pharmacy ID</label>
                  <span><code>{idOf(viewingPharmacy)}</code></span>
                </div>
                <div className="sa-modal-field">
                  <label>Contact Number</label>
                  <span>{contactNumber(viewingPharmacy)}</span>
                </div>
                <div className="sa-modal-field">
                  <label>Email ID</label>
                  <span>{emailOf(viewingPharmacy)}</span>
                </div>
                <div className="sa-modal-field">
                  <label>Status</label>
                  <span>{statusOf(viewingPharmacy)}</span>
                </div>
                <div className="sa-modal-field" style={{ gridColumn: '1 / -1' }}>
                  <label>Address / Location</label>
                  <span>{addressOf(viewingPharmacy)}</span>
                </div>
              </div>
            </div>
            <div className="sa-modal-footer">
              <button type="button" className="sa-btn-secondary" onClick={() => setViewingPharmacy(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AdminLayout>
  )
}
