import { useEffect, useMemo, useState } from 'react'
import { createSuperAdminPharmacy, getAddressByPincode, getSuperAdminPharmacies } from '../../config/api'
import SuperAdminModulePage from './SuperAdminModulePage'
import RowActions from '../../components/RowActions'
import './Branches.css'

const headers = ['S.No.', 'Pharmacy Name', 'Contact Number', 'Address', 'Email ID', 'Status', 'Actions']
const emptyForm = { name: '', phone: '', email: '', address: '', city: '', district: '', state: '', country: '', postalCode: '' }
const digitsOnly = (value, limit = 10) => String(value || '').replace(/\D/g, '').slice(0, limit)
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

function unwrapAdmin(item) {
  return item?.admin || item?.data?.admin || item?.data || item || {}
}

function text(value, fallback = '-') {
  if (value === undefined || value === null) return fallback
  const output = String(value).trim()
  return output ? output : fallback
}

function idOf(item) {
  const admin = unwrapAdmin(item)
  return admin.pharmacyId || admin.PharmacyId || admin.id || admin.adminId || admin._id
}

function pharmacyName(item) {
  const admin = unwrapAdmin(item)
  return text(admin.pharmacyName || admin.PharmacyName || admin.name || admin.Name || admin.pharmacy?.name || admin.pharmacy?.pharmacyName)
}

function contactNumber(item) {
  const admin = unwrapAdmin(item)
  return text(admin.pharmacyContactNumber || admin.PharmacyContactNumber || admin.contactNumber || admin.ContactNumber || admin.phoneNumber || admin.mobileNumber || admin.MobileNumber || admin.phone || admin.mobile)
}

function emailOf(item) {
  const admin = unwrapAdmin(item)
  return text(admin.pharmacyEmail || admin.PharmacyEmail || admin.email || admin.Email)
}

function addressOf(item) {
  const admin = unwrapAdmin(item)
  const address = admin.pharmacyAddress || admin.PharmacyAddress || admin.address || admin.Address || admin.location || admin.pharmacy?.address
  const location = [admin.city || admin.City, admin.state || admin.State, admin.country || admin.Country, admin.postalCode || admin.PostalCode].filter(Boolean).join(', ')
  return text([address, location].filter((part) => text(part, '')).join(', '))
}

function statusOf(item) {
  const admin = unwrapAdmin(item)
  const value = admin.accountStatus || admin.status || admin.isActive
  if (typeof value === 'boolean') return value ? 'Active' : 'Inactive'
  return text(value, 'Active')
}

function PharmacyNameCell({ pharmacy, index }) {
  const name = pharmacyName(pharmacy)
  const id = idOf(pharmacy) || index + 1
  return <span className="branches-name-cell"><span className="branches-location-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 21h18" /><path d="M5 21V7l8-4 6 3v15" /><path d="M9 9h1M9 13h1M9 17h1M14 10h1M14 14h1M14 18h1" /></svg></span><span><strong>{name}</strong><small>Pharmacy ID: {id}</small></span></span>
}

function ContactCell({ pharmacy }) {
  return <span className="branches-contact-cell"><strong>{contactNumber(pharmacy)}</strong><small>{emailOf(pharmacy)}</small></span>
}

function StatusBadge({ status }) {
  const isActive = String(status).toLowerCase() === 'active'
  return <span className={`branches-status-pill ${isActive ? 'active' : 'inactive'}`}><i />{isActive ? 'Active' : 'Inactive'}</span>
}

export default function Pharmacies() {
  const [pharmacies, setPharmacies] = useState([])
  const [viewingPharmacy, setViewingPharmacy] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    let active = true

    async function loadPharmacies() {
      setLoading(true)
      setError('')
      try {
        const response = await getSuperAdminPharmacies({ page: 1, pageSize: 100 })
        if (!active) return
        const items = listFrom(response).map(unwrapAdmin)
        setPharmacies(items)
      } catch (requestError) {
        if (active) setError(requestError.message || 'Unable to load pharmacies.')
      } finally {
        if (active) setLoading(false)
      }
    }

    loadPharmacies()
    return () => { active = false }
  }, [])


  async function createPharmacy(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, String(value || '').trim()]).filter(([, value]) => value !== ''))
      const response = await createSuperAdminPharmacy(payload)
      const created = response?.data?.pharmacy || response?.pharmacy || response?.data || response
      const mainBranch = response?.data?.mainBranch || response?.mainBranch
      if (created?.id || created?.pharmacyId) sessionStorage.setItem('lastCreatedPharmacyId', String(created.id || created.pharmacyId))
      if (mainBranch?.id || mainBranch?.branchId) sessionStorage.setItem('lastCreatedMainBranchId', String(mainBranch.id || mainBranch.branchId))
      setCreateOpen(false)
      setForm(emptyForm)
      const listResponse = await getSuperAdminPharmacies({ page: 1, pageSize: 100 })
      const items = listFrom(listResponse).map(unwrapAdmin)
      setPharmacies(items)
    } catch (requestError) {
      setError(requestError.message || 'Unable to create pharmacy.')
    } finally {
      setSaving(false)
    }
  }

  async function handlePostalCodeChange(value) {
    setForm((current) => ({ ...current, postalCode: value }))
    const pincode = String(value || '').replace(/\D/g, '')
    if (pincode.length !== 6) return

    try {
      const response = await getAddressByPincode(pincode)
      const source = response?.data?.address || response?.data || response?.address || response?.result || response || {}
      const address = Array.isArray(source) ? source[0] || {} : source
      setForm((current) => ({
        ...current,
        postalCode: value,
        city: address.area || address.Area || address.city || address.City || current.city,
        district: address.district || address.District || current.district,
        state: address.state || address.State || current.state,
        country: address.country || address.Country || current.country || 'India',
      }))
    } catch {
      // Pincode lookup is optional; users can still fill the address manually.
    }
  }
  const rows = useMemo(() => pharmacies.map((pharmacy, index) => {
    const status = statusOf(pharmacy)
    return [
      <span className="branches-serial" key="serial">{index + 1}</span>,
      <PharmacyNameCell key="name" pharmacy={pharmacy} index={index} />,
      <ContactCell key="contact" pharmacy={pharmacy} />,
      <span className="branches-location-text" key="address" title={addressOf(pharmacy)}>{addressOf(pharmacy)}</span>,
      <span className="branches-location-text" key="email" title={emailOf(pharmacy)}>{emailOf(pharmacy)}</span>,
      <StatusBadge key="status" status={status} />,
      <RowActions key={`actions-${idOf(pharmacy) || index}`} itemName={pharmacyName(pharmacy)} isActive={String(status).toLowerCase() === 'active'} onView={() => setViewingPharmacy(pharmacy)} />,
    ]
  }), [pharmacies])

  return (
    <SuperAdminModulePage
      title="Pharmacy Management"
      headers={headers}
      rows={rows}
      loading={loading}
      error={error}
      action={<button type="button" className="sa-btn-primary" onClick={() => setCreateOpen(true)}>+ Create Pharmacy</button>}
      emptyText="No pharmacies available."
    >
      {createOpen ? (
        <div className="sa-modal-backdrop" onClick={() => setCreateOpen(false)}>
          <form className="sa-modal-card" onSubmit={createPharmacy} onClick={(event) => event.stopPropagation()}>
            <div className="sa-modal-header"><h2>Create Pharmacy</h2><button type="button" className="sa-modal-close" onClick={() => setCreateOpen(false)}>&times;</button></div>
            <div className="sa-modal-body"><div className="sa-modal-grid">
              {Object.keys(emptyForm).map((field) => <div className="sa-modal-field" key={field} style={field === 'address' ? { gridColumn: '1 / -1' } : undefined}><label>{field === 'name' ? 'Pharmacy Name *' : field === 'postalCode' ? 'Pincode' : field.replace(/([A-Z])/g, ' $1')}</label>{field === 'address' ? <textarea value={form[field]} onChange={(event) => setForm({ ...form, [field]: event.target.value })} /> : <input required={field === 'name'} type={field === 'email' ? 'email' : 'text'} inputMode={field === 'phone' || field === 'postalCode' ? 'numeric' : undefined} maxLength={field === 'phone' ? 10 : field === 'postalCode' ? 6 : undefined} pattern={field === 'phone' ? '[0-9]{10}' : undefined} value={form[field]} onChange={(event) => field === 'postalCode' ? handlePostalCodeChange(digitsOnly(event.target.value, 6)) : setForm({ ...form, [field]: field === 'phone' ? digitsOnly(event.target.value) : event.target.value })} />}</div>)}
            </div></div>
            <div className="sa-modal-footer"><button type="button" className="sa-btn-secondary" onClick={() => setCreateOpen(false)}>Cancel</button><button type="submit" className="sa-btn-primary" disabled={saving}>{saving ? 'Creating...' : 'Create Pharmacy'}</button></div>
          </form>
        </div>
      ) : null}
      {viewingPharmacy ? (
        <div className="sa-modal-backdrop" onClick={() => setViewingPharmacy(null)}>
          <div className="sa-modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="sa-modal-header">
              <h2>Pharmacy Details: {pharmacyName(viewingPharmacy)}</h2>
              <button type="button" className="sa-modal-close" onClick={() => setViewingPharmacy(null)}>&times;</button>
            </div>
            <div className="sa-modal-body">
              <div className="sa-modal-grid">
                <div className="sa-modal-field"><label>Pharmacy Name</label><span>{pharmacyName(viewingPharmacy)}</span></div>
                <div className="sa-modal-field"><label>Contact Number</label><span>{contactNumber(viewingPharmacy)}</span></div>
                <div className="sa-modal-field"><label>Email ID</label><span>{emailOf(viewingPharmacy)}</span></div>
                <div className="sa-modal-field"><label>Status</label><span>{statusOf(viewingPharmacy)}</span></div>
                <div className="sa-modal-field" style={{ gridColumn: '1 / -1' }}><label>Address / Location</label><span>{addressOf(viewingPharmacy)}</span></div>
              </div>
            </div>
            <div className="sa-modal-footer"><button type="button" className="sa-btn-secondary" onClick={() => setViewingPharmacy(null)}>Close</button></div>
          </div>
        </div>
      ) : null}
    </SuperAdminModulePage>
  )
}


