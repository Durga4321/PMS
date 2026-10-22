import { useEffect, useMemo, useState } from 'react'
import RowActions from '../../components/RowActions'
import { useToast } from '../../components/ToastProvider'
import {
  changePharmacyBranchStatus,
  createPharmacyBranch,
  deletePharmacyBranch,
  getAddressByPincode,
  getPharmacyBranch,
  listPharmacyBranches,
  updatePharmacyBranch,
  getPharmacySettings,
  getPharmacyAdminPharmacy,
  scopedKey,
  migrateLegacyCache,
} from '../../config/api'
import AdminLayout from './AdminLayout'
import '../Super Admin/Branches.css'

const headers = ['S.No.', 'Branch', 'Contact', 'Location', 'Status', 'Actions']
const emptyForm = { pharmacyId: '', name: '', phone: '', email: '', address: '', city: '', state: '', district: '', country: '', postalCode: '', status: 'Active' }
const digitsOnly = (value, limit = 10) => String(value || '').replace(/\D/g, '').slice(0, limit)
const LOCAL_PHARMACIES_KEY = 'pms_admin_pharmacies_list'

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

function pharmacyNameOf(p) {
  if (!p) return ''
  const item = p.pharmacy || p.admin || p.data?.pharmacy || p.data || p
  return String(item.pharmacyName || item.PharmacyName || item.name || item.Name || '').trim()
}

function pharmacyIdOf(p) {
  if (!p) return ''
  const item = p.pharmacy || p.admin || p.data?.pharmacy || p.data || p
  return String(item.pharmacyId || item.PharmacyId || item.id || item._id || '').trim()
}

const listFrom = (response) => {
  if (Array.isArray(response)) return response
  if (Array.isArray(response?.data)) return response.data
  if (Array.isArray(response?.data?.branches)) return response.data.branches
  if (Array.isArray(response?.branches)) return response.branches
  if (Array.isArray(response?.items)) return response.items
  if (Array.isArray(response?.results)) return response.results
  return []
}

function readStoredValue(key) {
  const value = sessionStorage.getItem(key) || localStorage.getItem(key)
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

const idOf = (branch) => branch?._id || branch?.id || branch?.branchId || branch?.BranchId
const nameOf = (branch) => branch?.name || branch?.branchName || branch?.BranchName || '-'
const statusOf = (branch) => {
  const value = branch?.status ?? branch?.isActive
  if (typeof value === 'boolean') return value ? 'Active' : 'Inactive'
  return value || 'Active'
}
const isActive = (branch) => String(statusOf(branch)).toLowerCase() === 'active'
const text = (value, fallback = '-') => String(value || '').trim() || fallback

function branchField(branch, field) {
  if (!branch) return '-'
  switch (field) {
    case 'phone':
      return text(branch.phone || branch.Phone || branch.phoneNumber || branch.PhoneNumber)
    case 'email':
      return text(branch.email || branch.Email || branch.emailAddress || branch.EmailAddress)
    case 'address':
      return text(branch.address || branch.Address)
    case 'city':
      return text(branch.city || branch.City)
    case 'district':
      return text(branch.district || branch.District)
    case 'state':
      return text(branch.state || branch.State)
    case 'country':
      return text(branch.country || branch.Country || 'India')
    case 'postalCode':
      return text(branch.postalCode || branch.PostalCode || branch.pincode || branch.Pincode)
    default:
      return text(branch[field])
  }
}

const locationOf = (branch) => {
  const parts = [
    branch?.address || branch?.Address,
    branch?.city || branch?.City,
    branch?.district || branch?.District,
    branch?.state || branch?.State,
    branch?.country || branch?.Country || 'India',
    branch?.postalCode || branch?.PostalCode || branch?.pincode,
  ].filter(Boolean)
  const unique = []
  parts.forEach((p) => {
    const trimmed = String(p).trim()
    if (trimmed && !unique.includes(trimmed)) {
      unique.push(trimmed)
    }
  })
  return text(unique.join(', '))
}

function payloadFrom(form) {
  return Object.fromEntries(Object.entries(form).filter(([, value]) => String(value || '').trim() !== ''))
}

function buildMainBranch(settings = {}) {
  const assignment = readStoredValue('pharmacyAdminAssignment') || {}
  const user = readStoredValue('pharmacyAdminUser') || {}
  const pharmacy = assignment.pharmacy || user.pharmacy || {}
  const branchId = assignment.branchId || assignment.BranchId || assignment.branch?.id || assignment.branch?.branchId || user.branchId || user.BranchId || user.branch?.id || user.branch?.branchId
  const pharmacyId = assignment.pharmacyId || assignment.PharmacyId || pharmacy.id || pharmacy.pharmacyId || user.pharmacyId || user.PharmacyId || user.pharmacy?.id || user.pharmacy?.pharmacyId
  const name = settings.pharmacyName || settings.name || assignment.pharmacyName || pharmacy.name || user.pharmacyName || assignment.branchName || user.branchName
  const address = settings.address || settings.pharmacyAddress || settings.branchLocation || assignment.pharmacyAddress || pharmacy.address || user.pharmacyAddress || assignment.address || user.address
  const phone = settings.phoneNumber || settings.phone || assignment.pharmacyContactNumber || pharmacy.contactNumber || user.pharmacyContactNumber || assignment.mobileNumber || user.mobileNumber
  const email = settings.emailAddress || settings.email || assignment.pharmacyEmail || pharmacy.email || user.pharmacyEmail || assignment.email || user.email

  if (!name && !address && !phone && !email) return null

  return {
    id: branchId || pharmacyId || 'main',
    branchId: branchId || pharmacyId || 'main',
    name: name || 'Main Branch',
    branchName: name || 'Main Branch',
    phone,
    email,
    address,
    city: settings.city || assignment.city || pharmacy.city || user.city,
    district: settings.district || assignment.district || pharmacy.district || user.district,
    state: settings.state || assignment.state || pharmacy.state || user.state,
    country: settings.country || assignment.country || pharmacy.country || user.country,
    postalCode: settings.postalCode || settings.pincode || assignment.postalCode || pharmacy.postalCode || user.postalCode,
    status: 'Active',
    isMainBranch: true,
  }
}

function BranchNameCell({ branch, index, pharmacies = [] }) {
  const id = idOf(branch) || index + 1
  const linkedId = branch?.pharmacyId || branch?.PharmacyId
  const linkedPharmacy = pharmacies.find((p) => String(pharmacyIdOf(p)) === String(linkedId))
  const pharmacyDisplay = branch?.pharmacyName || branch?.PharmacyName || (linkedPharmacy ? pharmacyNameOf(linkedPharmacy) : '') || (pharmacies.length ? pharmacyNameOf(pharmacies[0]) : '')
  const isMain = branch?.isMainBranch || Number(id) === 1 || String(nameOf(branch)).toLowerCase().includes('main branch')
  return (
    <span className="branches-name-cell">
      <span className="branches-location-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
      </span>
      <span>
        <strong>{nameOf(branch)}</strong>
        <small>
          {isMain ? 'Main Branch' : `Sub Branch - ID: ${id}`}
          {pharmacyDisplay ? ` • ${pharmacyDisplay}` : ''}
        </small>
      </span>
    </span>
  )
}

function ContactCell({ branch }) {
  return <span className="branches-contact-cell"><strong>{branchField(branch, 'phone')}</strong><small>{branchField(branch, 'email')}</small></span>
}

function StatusBadge({ branch }) {
  return <span className={`branches-status-pill ${isActive(branch) ? 'active' : 'inactive'}`}><i />{isActive(branch) ? 'Active' : 'Inactive'}</span>
}

export default function AdminBranches() {
  const { showToast } = useToast()
  const [branches, setBranches] = useState([])
  const [pharmacies, setPharmacies] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [modal, setModal] = useState(null)
  const [currentBranch, setCurrentBranch] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [mainBranch, setMainBranch] = useState(() => buildMainBranch())
  const displayBranches = useMemo(() => {
    if (!branches.length) {
      return mainBranch ? [mainBranch] : []
    }

    const backendMain = branches.find(
      (b) => b?.isMainBranch || Number(idOf(b)) === 1 || String(nameOf(b)).toLowerCase().includes('main branch')
    )

    if (backendMain) {
      return branches.map((b) => {
        const isMain = b === backendMain || b?.isMainBranch || Number(idOf(b)) === 1 || String(nameOf(b)).toLowerCase().includes('main branch')
        if (isMain) {
          return {
            ...b,
            isMainBranch: true,
            city: b.city || b.City || mainBranch?.city || '',
            district: b.district || b.District || mainBranch?.district || '',
            state: b.state || b.State || mainBranch?.state || '',
            country: b.country || b.Country || mainBranch?.country || 'India',
            postalCode: b.postalCode || b.PostalCode || b.pincode || mainBranch?.postalCode || '',
            phone: b.phone || b.Phone || b.phoneNumber || mainBranch?.phone || '',
            email: b.email || b.Email || b.emailAddress || mainBranch?.email || '',
            address: b.address || b.Address || mainBranch?.address || '',
          }
        }
        return b
      })
    }

    return mainBranch ? [mainBranch, ...branches] : branches
  }, [mainBranch, branches])

  async function loadMainBranchDetails() {
    try {
      const response = await getPharmacySettings({ authRole: 'pharmacyAdmin' })
      const settings = response?.settings || response?.data?.settings || response?.data || response || {}
      setMainBranch(buildMainBranch(settings))
    } catch (requestError) {
      console.log('Unable to load pharmacy settings for main branch:', requestError.message)
    }
  }

  async function loadPharmaciesList() {
    try {
      let pList = []
      try {
        const res = await getPharmacyAdminPharmacy()
        const p = res?.pharmacy || res?.data?.pharmacy || (res?.id || res?.pharmacyId ? res : null)
        if (p) pList.push(p)
      } catch {}

      if (!pList.length) {
        const assignment = readStoredValue('pharmacyAdminAssignment') || {}
        const user = readStoredValue('pharmacyAdminUser') || {}
        const defaultP = assignment.pharmacy || user.pharmacy || (assignment.pharmacyName ? { id: assignment.pharmacyId, name: assignment.pharmacyName } : null)
        if (defaultP && pharmacyIdOf(defaultP)) pList.push(defaultP)
      }

      const localItems = readLocalPharmacies()
      const map = new Map()
      pList.forEach((p) => {
        const id = pharmacyIdOf(p)
        if (id) map.set(String(id), p)
      })
      localItems.forEach((p) => {
        const id = pharmacyIdOf(p)
        if (id && !map.has(String(id))) map.set(String(id), p)
      })

      const combined = [...map.values()]
      setPharmacies(combined)
      if (combined.length > 0) {
        setForm((prev) => ({ ...prev, pharmacyId: prev.pharmacyId || pharmacyIdOf(combined[0]) }))
      }
    } catch {
      setPharmacies([])
    }
  }

  async function loadBranches() {
    setLoading(true)
    setError('')
    try {
      const response = await listPharmacyBranches()
      setBranches(listFrom(response))
    } catch (requestError) {
      setBranches([])
      console.log('Branch list API failed:', requestError.message)
      if (!mainBranch) setError(requestError.message || 'Unable to load sub branches.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMainBranchDetails()
    loadBranches()
    loadPharmaciesList()
  }, [])

  function openCreate() {
    setCurrentBranch(null)
    const defaultPid = pharmacies.length ? pharmacyIdOf(pharmacies[0]) : ''
    setForm({ ...emptyForm, pharmacyId: defaultPid })
    setError('')
    setModal('form')
  }

  async function openView(branch) {
    if (branch?.isMainBranch) {
      setCurrentBranch(branch)
      setModal('view')
      return
    }
    const id = idOf(branch)
    setCurrentBranch(branch)
    setModal('view')
    if (!id) return
    try {
      const response = await getPharmacyBranch(id)
      const data = response?.data || response?.branch || response
      if (data) setCurrentBranch(data)
    } catch {
      setCurrentBranch(branch)
    }
  }

  function openEdit(branch) {
    if (branch?.isMainBranch) return
    setCurrentBranch(branch)
    setError('')
    setForm({
      pharmacyId: branch?.pharmacyId || branch?.PharmacyId || '',
      name: nameOf(branch) === '-' ? '' : nameOf(branch),
      phone: branch?.phone || branch?.phoneNumber || branch?.contactNumber || '',
      email: branch?.email || branch?.emailAddress || '',
      address: branch?.address || '',
      city: branch?.city || '',
      state: branch?.state || '',
      district: branch?.district || '',
      country: branch?.country || '',
      postalCode: branch?.postalCode || branch?.pincode || '',
      status: statusOf(branch),
    })
    setModal('form')
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
      // Optional pincode lookup
    }
  }

  async function saveBranch(event) {
    event.preventDefault()
    if (!String(form.pharmacyId || '').trim() && pharmacies.length > 0) {
      setError('Please select a Pharmacy.')
      showToast('Please select a Pharmacy.', 'error')
      return
    }
    if (!String(form.name || '').trim()) {
      setError('Sub Branch Name is required.')
      showToast('Sub Branch Name is required.', 'error')
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
      const isEditing = Boolean(currentBranch)
      const selectedPharmacy = pharmacies.find((p) => String(pharmacyIdOf(p)) === String(form.pharmacyId))
      const pName = selectedPharmacy ? pharmacyNameOf(selectedPharmacy) : ''
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
      if (isEditing) await updatePharmacyBranch(idOf(currentBranch), payload)
      else await createPharmacyBranch(payload)
      setModal(null)
      setCurrentBranch(null)
      setForm(emptyForm)
      await loadBranches()
      showToast(isEditing ? 'Sub branch updated successfully.' : 'Sub branch created successfully.')
    } catch (requestError) {
      const msg = requestError.message || 'Unable to save sub branch.'
      setError(msg)
      showToast(msg, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function toggleStatus(branch) {
    if (branch?.isMainBranch) return
    const id = idOf(branch)
    if (!id) return
    const nextActive = !isActive(branch)
    const nextStatus = nextActive ? 'Active' : 'Inactive'
    setBranches((items) => items.map((item) => idOf(item) === id ? { ...item, status: nextStatus, isActive: nextActive } : item))
    try {
      await changePharmacyBranchStatus(id, { status: nextStatus, isActive: nextActive, IsActive: nextActive })
      showToast(`Sub branch marked as ${nextStatus}.`)
    } catch (requestError) {
      setError(requestError.message || 'Unable to update sub branch status.')
      loadBranches()
    }
  }

  async function deleteBranch(branch) {
    if (branch?.isMainBranch) return
    const id = idOf(branch)
    if (!id || !window.confirm(`Delete ${nameOf(branch)}?`)) return
    setBranches((items) => items.filter((item) => idOf(item) !== id))
    try {
      await deletePharmacyBranch(id)
      showToast('Sub branch deleted successfully.')
    } catch (requestError) {
      setError(requestError.message || 'Unable to delete sub branch.')
      loadBranches()
    }
  }

  const [workingBranchId, setWorkingBranchId] = useState(() => sessionStorage.getItem('workingBranchId') || '')

  function chooseBranch(branch) {
    const selected = { id: idOf(branch), name: nameOf(branch), type: branch?.isMainBranch ? 'main' : 'sub' }
    const id = String(selected.id || '')
    sessionStorage.setItem('workingBranchId', id)
    sessionStorage.setItem('workingBranch', JSON.stringify(selected))
    setWorkingBranchId(id)
    showToast(`Switched active branch to ${selected.name}.`)
  }

  const rows = useMemo(() => displayBranches.map((branch, index) => {
    const id = idOf(branch) || index
    const actions = branch?.isMainBranch
      ? <RowActions key={`actions-${id}`} itemName={nameOf(branch)} isActive={true} onView={() => openView(branch)} />
      : <RowActions key={`actions-${id}`} itemName={nameOf(branch)} isActive={isActive(branch)} onView={() => openView(branch)} onEdit={() => openEdit(branch)} onStatus={() => toggleStatus(branch)} onDelete={() => deleteBranch(branch)} />
    return [
      <span className="branches-serial" key="serial">{index + 1}</span>,
      <BranchNameCell key="branch" branch={branch} index={index} pharmacies={pharmacies} />,
      <ContactCell key="contact" branch={branch} />,
      <span className="branches-location-text" key="location" title={locationOf(branch)}>{locationOf(branch)}</span>,
      <StatusBadge key="status" branch={branch} />,
      actions,
    ]
  }), [displayBranches, pharmacies, workingBranchId])

  return (
    <AdminLayout activeLabel="Branches" title="Branches" subtitle="Main pharmacy branch and sub branches.">
      <section className="super-admin-module-panel">
        <div className="super-admin-module-header">
          <h2>Branches</h2>
          <button type="button" className="sa-btn-primary" onClick={openCreate}>+ Add Sub Branch</button>
        </div>
        {error ? <div className="super-admin-module-error">{error}</div> : null}
        <div className="super-admin-module-table">
          <table><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{loading ? <tr><td colSpan={headers.length}>Loading branches...</td></tr> : rows.length ? rows.map((row, index) => <tr key={idOf(displayBranches[index]) || index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>) : <tr><td colSpan={headers.length}>No branch details available.</td></tr>}</tbody></table>
        </div>
      </section>

      {modal === 'view' && currentBranch ? (
        <div className="sa-modal-backdrop" onClick={() => setModal(null)}>
          <div className="sa-modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="sa-modal-header">
              <h2>{nameOf(currentBranch)}</h2>
              <button type="button" className="sa-modal-close" onClick={() => setModal(null)}>&times;</button>
            </div>
            <div className="sa-modal-body">
              <div className="sa-modal-grid">
                <div className="sa-modal-field" style={{ gridColumn: '1 / -1' }}>
                  <label>Pharmacy</label>
                  <span>
                    {currentBranch?.pharmacyName ||
                      currentBranch?.PharmacyName ||
                      pharmacyNameOf(pharmacies.find((p) => String(pharmacyIdOf(p)) === String(currentBranch?.pharmacyId || currentBranch?.PharmacyId))) ||
                      (pharmacies.length ? pharmacyNameOf(pharmacies[0]) : '') ||
                      readStoredValue('pharmacyAdminAssignment')?.pharmacyName ||
                      readStoredValue('pharmacyAdminUser')?.pharmacyName ||
                      '-'}
                  </span>
                </div>
                {['phone', 'email', 'address', 'city', 'district', 'state', 'country', 'postalCode'].map((field) => (
                  <div className="sa-modal-field" key={field} style={field === 'address' ? { gridColumn: '1 / -1' } : undefined}>
                    <label>{field === 'postalCode' ? 'Postal Code / Pincode' : field.charAt(0).toUpperCase() + field.slice(1)}</label>
                    <span>{branchField(currentBranch, field)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="sa-modal-footer">
              <button type="button" className="sa-btn-secondary" onClick={() => setModal(null)}>Close</button>
            </div>
          </div>
        </div>
      ) : null}

      {modal === 'form' ? (
        <div className="sa-modal-backdrop" onClick={() => setModal(null)}>
          <form className="sa-modal-card" onSubmit={saveBranch} onClick={(event) => event.stopPropagation()}>
            <div className="sa-modal-header">
              <h2>{currentBranch ? 'Edit Sub Branch' : 'Create Sub Branch'}</h2>
              <button type="button" className="sa-modal-close" onClick={() => setModal(null)}>&times;</button>
            </div>
            <div className="sa-modal-body">
              {error ? <div className="super-admin-module-error" style={{ marginBottom: '12px' }}>{error}</div> : null}
              <div className="sa-modal-grid">
                {Object.keys(emptyForm).map((field) => (
                  <div
                    className="sa-modal-field"
                    key={field}
                    style={field === 'pharmacyId' || field === 'address' ? { gridColumn: '1 / -1' } : undefined}
                  >
                    <label>
                      {field === 'pharmacyId'
                        ? 'Select Pharmacy *'
                        : field === 'name'
                        ? 'Sub Branch Name *'
                        : field}
                    </label>
                    {field === 'pharmacyId' ? (
                      <select
                        required
                        value={form.pharmacyId}
                        onChange={(event) => setForm({ ...form, pharmacyId: event.target.value })}
                      >
                        <option value="">-- Select Pharmacy --</option>
                        {pharmacies.map((pharmacy) => {
                          const pid = pharmacyIdOf(pharmacy)
                          const pname = pharmacyNameOf(pharmacy)
                          return (
                            <option key={pid} value={pid}>
                              {pname} {pid ? `(ID: ${pid})` : ''}
                            </option>
                          )
                        })}
                      </select>
                    ) : field === 'address' ? (
                      <textarea
                        value={form[field]}
                        onChange={(event) => setForm({ ...form, [field]: event.target.value })}
                      />
                    ) : field === 'status' ? (
                      <select
                        value={form.status}
                        onChange={(event) => setForm({ ...form, status: event.target.value })}
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    ) : (
                      <input
                        required={field === 'name'}
                        type={field === 'email' ? 'email' : 'text'}
                        inputMode={field === 'phone' || field === 'postalCode' ? 'numeric' : undefined}
                        maxLength={field === 'phone' ? 10 : field === 'postalCode' ? 6 : undefined}
                        pattern={field === 'phone' ? '[0-9]{10}' : undefined}
                        value={form[field]}
                        onChange={(event) =>
                          field === 'postalCode'
                            ? handlePostalCodeChange(event.target.value)
                            : setForm({
                                ...form,
                                [field]: field === 'phone' ? digitsOnly(event.target.value) : event.target.value,
                              })
                        }
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="sa-modal-footer">
              <button type="button" className="sa-btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button type="submit" className="sa-btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </form>
        </div>
      ) : null}
    </AdminLayout>
  )
}


