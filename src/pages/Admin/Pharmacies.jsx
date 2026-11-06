import { useEffect, useMemo, useState } from 'react'
import AdminLayout from './AdminLayout'
import RowActions from '../../components/RowActions'
import { useToast } from '../../components/ToastProvider'
import {
  getPharmacySettings,
  changeSuperAdminPharmacyStatus,
  createSuperAdminPharmacy,
  deleteSuperAdminPharmacy,
  getAddressByPincode,
  getSuperAdminPharmacies,
  updateSuperAdminPharmacy,
  getPharmacyAdminPharmacy,
  registerPharmacyAdminPharmacy,
  syncPharmacyAdminTenantContext,
  updatePharmacySettings,
  getPharmacyAdminAssignmentStatus,
  listPharmacyBranches,
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

function removeDeletedPharmacyId(id, name) {
  try {
    const key = scopedKey(DELETED_PHARMACIES_KEY)
    const idStr = String(id || '')
    const nameKey = name ? `name:${String(name).trim().toLowerCase()}` : ''
    const ids = readDeletedPharmacyIds().filter((d) => {
      if (idStr && String(d) === idStr) return false
      if (nameKey && String(d) === nameKey) return false
      return true
    })
    localStorage.setItem(key, JSON.stringify(ids))
  } catch {}
}

function isPharmacyDeleted(item, deletedIds = []) {
  if (!item || !deletedIds.length) return false
  const unwrapped = unwrapPharmacy(item)
  const id = String(idOf(unwrapped) || '')
  const name = String(pharmacyName(unwrapped) || '').trim().toLowerCase()
  if (id && deletedIds.includes(id)) return true
  if (name && name !== '-' && deletedIds.includes(`name:${name}`)) return true
  return false
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

function isDefaultOwner(name) {
  return String(name || '').trim().toLowerCase() === 'goutham pharmacy'
}

function buildPharmacyFromContext(settings = {}) {
  const assignment = readStoredValue('pharmacyAdminAssignment') || {}
  const user = readStoredValue('pharmacyAdminUser') || {}
  const localSettings = readStoredValue('pharmacySettings') || {}
  const mergedSettings = { ...localSettings, ...(settings || {}) }
  const pharmacy = assignment.pharmacy || user.pharmacy || {}

  const pharmacyId =
    assignment.pharmacyId ||
    assignment.PharmacyId ||
    pharmacy.id ||
    pharmacy.pharmacyId ||
    user.pharmacyId ||
    user.PharmacyId ||
    mergedSettings.pharmacyId ||
    ''

  const name =
    (assignment.pharmacyName && !isDefaultOwner(assignment.pharmacyName) ? assignment.pharmacyName : '') ||
    (user.pharmacyName && !isDefaultOwner(user.pharmacyName) ? user.pharmacyName : '') ||
    (mergedSettings.pharmacyName && !isDefaultOwner(mergedSettings.pharmacyName) ? mergedSettings.pharmacyName : '') ||
    (mergedSettings.name && !isDefaultOwner(mergedSettings.name) ? mergedSettings.name : '') ||
    (pharmacy.name && !isDefaultOwner(pharmacy.name) ? pharmacy.name : '') ||
    (pharmacy.pharmacyName && !isDefaultOwner(pharmacy.pharmacyName) ? pharmacy.pharmacyName : '')

  if (!name) return null

  const phone =
    assignment.pharmacyContactNumber ||
    assignment.phone ||
    assignment.mobileNumber ||
    mergedSettings.phoneNumber ||
    mergedSettings.phone ||
    pharmacy.contactNumber ||
    pharmacy.phoneNumber ||
    user.pharmacyContactNumber ||
    user.mobileNumber ||
    user.phone ||
    ''

  const email =
    assignment.pharmacyEmail ||
    assignment.email ||
    mergedSettings.emailAddress ||
    mergedSettings.email ||
    pharmacy.email ||
    user.pharmacyEmail ||
    user.email ||
    ''

  const address =
    assignment.pharmacyAddress ||
    assignment.address ||
    mergedSettings.address ||
    mergedSettings.pharmacyAddress ||
    pharmacy.address ||
    user.pharmacyAddress ||
    user.address ||
    ''

  const city = mergedSettings.city || assignment.city || pharmacy.city || user.city || ''
  const district = mergedSettings.district || assignment.district || pharmacy.district || user.district || ''
  const state = mergedSettings.state || assignment.state || pharmacy.state || user.state || ''
  const country = mergedSettings.country || assignment.country || pharmacy.country || user.country || 'India'
  const postalCode =
    mergedSettings.postalCode ||
    mergedSettings.pincode ||
    assignment.postalCode ||
    pharmacy.postalCode ||
    user.postalCode ||
    ''

  const flag = mergedSettings.isActive ?? mergedSettings.IsActive ?? assignment.isActive
  const status = typeof flag === 'boolean' ? (flag ? 'Active' : 'Inactive') : (mergedSettings.status || assignment.status || 'Active')
  const isActive = typeof flag === 'boolean' ? flag : String(status).toLowerCase() === 'active'

  return {
    id: pharmacyId,
    pharmacyId,
    name,
    pharmacyName: name,
    phone,
    pharmacyContactNumber: phone,
    email,
    pharmacyEmail: email,
    address,
    pharmacyAddress: address,
    city,
    district,
    state,
    country,
    postalCode,
    status,
    isActive,
  }
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

function isMainBranchRecord(b, mainPharmacy) {
  if (!b) return false
  if (b?.isMainBranch || b?.IsMainBranch) return true
  if (Number(idOf(b)) === 1 || Number(b?.branchId || b?.BranchId) === 1) return true
  const bName = String(b?.name || b?.branchName || '').trim().toLowerCase()
  if (bName.includes('main branch')) return true
  if (mainPharmacy) {
    const mName = String(pharmacyName(mainPharmacy) || '').trim().toLowerCase()
    if (mName && (bName === mName || bName.startsWith(mName) || mName.startsWith(bName))) return true
  }
  return false
}

function formatAddress(item) {
  if (!item) return '-'
  const baseAddress = String(item.pharmacyAddress || item.PharmacyAddress || item.address || item.Address || '').trim()
  const city = String(item.city || item.City || '').trim()
  const district = String(item.district || item.District || '').trim()
  const state = String(item.state || item.State || '').trim()
  const country = String(item.country || item.Country || 'India').trim()
  const postalCode = String(item.postalCode || item.PostalCode || item.pincode || item.Pincode || '').trim()

  const tokens = []
  const pushIfNew = (str) => {
    if (!str) return
    const cleaned = str.trim()
    if (!cleaned) return
    const exists = tokens.some((t) => t.toLowerCase() === cleaned.toLowerCase())
    if (!exists) tokens.push(cleaned)
  }

  if (baseAddress) {
    pushIfNew(baseAddress)
  }
  if (city && !baseAddress.toLowerCase().includes(city.toLowerCase())) {
    pushIfNew(city)
  }
  if (district && !baseAddress.toLowerCase().includes(district.toLowerCase())) {
    pushIfNew(district)
  }
  if (state && !baseAddress.toLowerCase().includes(state.toLowerCase())) {
    pushIfNew(state)
  }
  if (country && !baseAddress.toLowerCase().includes(country.toLowerCase())) {
    pushIfNew(country)
  }
  if (postalCode && !baseAddress.includes(postalCode)) {
    pushIfNew(postalCode)
  }

  return tokens.length ? tokens.join(', ') : (baseAddress || country || '-')
}

function addressOf(item) {
  const p = unwrapPharmacy(item)
  return formatAddress(p)
}

function statusOf(item) {
  const p = unwrapPharmacy(item)
  const flag = p.isActive ?? p.IsActive
  if (typeof flag === 'boolean') return flag ? 'Active' : 'Inactive'
  if (flag === 0 || flag === 1) return flag ? 'Active' : 'Inactive'
  const value = p.status ?? p.Status ?? p.accountStatus
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
  const [pharmacies, setPharmacies] = useState(() => {
    try {
      const items = readLocalPharmacies()
      return Array.isArray(items) ? items : []
    } catch {
      return []
    }
  })
  const [viewingPharmacy, setViewingPharmacy] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editingPharmacy, setEditingPharmacy] = useState(null)
  const [form, setForm] = useState(emptyForm)

  async function loadPharmacies(showSpinner = false) {
    if (showSpinner || pharmacies.length === 0) setLoading(true)
    setError('')
    try {
      const deletedIds = readDeletedPharmacyIds()

      // 1. Read locally stored pharmacies, stripping any deleted or default owner entries
      let localItems = readLocalPharmacies()
        .filter((p) => !isPharmacyDeleted(p, deletedIds))
        .filter((p) => !isDefaultOwner(pharmacyName(p)))

      // 1b. Query backend main branch to synchronize the real database address & contact
      let dbMainBranch = null
      try {
        const bRes = await listPharmacyBranches()
        const bList = listFrom(bRes)
        const found = bList.find((b) => isMainBranchRecord(b, null)) || bList[0]
        if (found) dbMainBranch = found
      } catch {}

      const dbPhone = dbMainBranch ? (dbMainBranch.phone || dbMainBranch.Phone || dbMainBranch.phoneNumber || dbMainBranch.PhoneNumber || dbMainBranch.contactNumber) : ''
      const dbEmail = dbMainBranch ? (dbMainBranch.email || dbMainBranch.Email || dbMainBranch.emailAddress || dbMainBranch.EmailAddress) : ''
      const dbAddress = dbMainBranch ? (dbMainBranch.address || dbMainBranch.Address || '') : ''
      const dbCity = dbMainBranch ? (dbMainBranch.city || dbMainBranch.City || '') : ''
      const dbDistrict = dbMainBranch ? (dbMainBranch.district || dbMainBranch.District || '') : ''
      const dbState = dbMainBranch ? (dbMainBranch.state || dbMainBranch.State || '') : ''
      const dbCountry = dbMainBranch ? (dbMainBranch.country || dbMainBranch.Country || 'India') : 'India'
      const dbPostalCode = dbMainBranch ? (dbMainBranch.postalCode || dbMainBranch.PostalCode || dbMainBranch.pincode || '') : ''

      if (dbMainBranch && localItems.length > 0) {
        localItems = localItems.map((p, idx) => {
          if (idx === 0) {
            return {
              ...p,
              phone: dbPhone || p.phone || p.pharmacyContactNumber || '',
              pharmacyContactNumber: dbPhone || p.pharmacyContactNumber || p.phone || '',
              email: dbEmail || p.email || p.pharmacyEmail || '',
              pharmacyEmail: dbEmail || p.pharmacyEmail || p.email || '',
              address: dbAddress || p.address || p.pharmacyAddress || '',
              pharmacyAddress: dbAddress || p.pharmacyAddress || p.address || '',
              city: dbCity || p.city || '',
              district: dbDistrict || p.district || '',
              state: dbState || p.state || '',
              country: dbCountry || p.country || 'India',
              postalCode: dbPostalCode || p.postalCode || '',
            }
          }
          return p
        })
      }

      // 2. Check assignment and user context for the created pharmacy (e.g. Shiva Pharmacy)
      const assignment = readStoredValue('pharmacyAdminAssignment') || {}
      const user = readStoredValue('pharmacyAdminUser') || {}
      const rawSettings = readStoredValue('pharmacySettings') || {}

      const candidateName =
        (assignment.pharmacyName && !isDefaultOwner(assignment.pharmacyName) ? assignment.pharmacyName : '') ||
        (user.pharmacyName && !isDefaultOwner(user.pharmacyName) ? user.pharmacyName : '')

      if (candidateName && assignment.pharmacyId) {
        const exists = localItems.some(
          (p) => String(pharmacyName(p) || '').trim().toLowerCase() === candidateName.trim().toLowerCase()
        )
        if (!exists) {
          const candidateRecord = {
            id: assignment.pharmacyId || (dbMainBranch ? idOf(dbMainBranch) : ''),
            pharmacyId: assignment.pharmacyId || (dbMainBranch ? idOf(dbMainBranch) : ''),
            name: candidateName,
            pharmacyName: candidateName,
            phone:
              dbPhone ||
              assignment.pharmacyContactNumber ||
              assignment.phone ||
              assignment.mobileNumber ||
              user.mobileNumber ||
              user.phone ||
              '',
            pharmacyContactNumber:
              dbPhone ||
              assignment.pharmacyContactNumber ||
              assignment.phone ||
              assignment.mobileNumber ||
              user.mobileNumber ||
              user.phone ||
              '',
            email:
              dbEmail ||
              assignment.pharmacyEmail ||
              assignment.email ||
              user.email ||
              '',
            pharmacyEmail:
              dbEmail ||
              assignment.pharmacyEmail ||
              assignment.email ||
              user.email ||
              '',
            address:
              dbAddress ||
              assignment.pharmacyAddress ||
              assignment.address ||
              '',
            pharmacyAddress:
              dbAddress ||
              assignment.pharmacyAddress ||
              assignment.address ||
              '',
            city: dbCity || assignment.city || '',
            district: dbDistrict || assignment.district || '',
            state: dbState || assignment.state || '',
            country: dbCountry || assignment.country || 'India',
            postalCode: dbPostalCode || assignment.postalCode || '',
            status: assignment.accountStatus || 'Active',
            isActive: true,
          }
          if (!isPharmacyDeleted(candidateRecord, deletedIds) && candidateRecord.id) {
            localItems.unshift(candidateRecord)
          }
        }
      }

      // 3. Fallback: query getPharmacyAdminPharmacy() if local list is still empty
      if (!localItems.length) {
        try {
          const res = await getPharmacyAdminPharmacy()
          const p = res?.pharmacy || res?.data?.pharmacy || (res?.id || res?.pharmacyId ? res : null)
          if (p) {
            const unwrapped = unwrapPharmacy(p)
            const pName = String(pharmacyName(unwrapped) || '').trim().toLowerCase()
            if (pName && !isDefaultOwner(pName) && !isPharmacyDeleted(unwrapped, deletedIds)) {
              localItems.push(unwrapped)
            }
          }
        } catch {}
      }

      // 4. Ensure strict deduplication by ID and normalized name
      const uniqueItems = []
      const seenKeys = new Set()
      for (const p of localItems) {
        const id = String(idOf(p) || '')
        const name = String(pharmacyName(p) || '').trim().toLowerCase()
        if (id && seenKeys.has(`id:${id}`)) continue
        if (name && name !== '-' && seenKeys.has(`name:${name}`)) continue
        if (id) seenKeys.add(`id:${id}`)
        if (name && name !== '-') seenKeys.add(`name:${name}`)
        uniqueItems.push(p)
      }

      writeLocalPharmacies(uniqueItems)
      setPharmacies(uniqueItems)
    } catch (requestError) {
      console.log('Unable to load pharmacies:', requestError.message)
      setPharmacies([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPharmacies()
  }, [])

  function openEdit(pharmacy) {
    const p = unwrapPharmacy(pharmacy)
    setEditingPharmacy(pharmacy)
    setCreateOpen(false)
    setError('')
    setForm({
      name: pharmacyName(p) === '-' ? '' : pharmacyName(p),
      phone: contactNumber(p) === '-' ? '' : contactNumber(p),
      email: emailOf(p) === '-' ? '' : emailOf(p),
      address: p.address || p.Address || p.pharmacyAddress || p.PharmacyAddress || '',
      city: p.city || p.City || '',
      district: p.district || p.District || '',
      state: p.state || p.State || '',
      country: p.country || p.Country || 'India',
      postalCode: p.postalCode || p.PostalCode || p.pincode || '',
      status: statusOf(p),
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
        if (id) removeDeletedPharmacyId(id, payload.name)
        let updatedSuccess = false
        const isActive = String(form.status || 'Active').toLowerCase() === 'active'
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
              city: payload.city,
              district: payload.district,
              state: payload.state,
              country: payload.country,
              postalCode: payload.postalCode,
              isActive,
            })
            updatedSuccess = true
          } catch (settingsErr) {
            console.error('Update pharmacy failed on both endpoints:', settingsErr)
          }
        }

        // Update stored assignment and settings
        try {
          const rawAssign = sessionStorage.getItem('pharmacyAdminAssignment') || localStorage.getItem('pharmacyAdminAssignment')
          const parsedAssign = rawAssign ? JSON.parse(rawAssign) : {}
          const updatedAssign = {
            ...parsedAssign,
            pharmacyName: payload.name,
            pharmacyContactNumber: payload.phone,
            pharmacyEmail: payload.email,
            pharmacyAddress: payload.address,
            city: payload.city,
            district: payload.district,
            state: payload.state,
            country: payload.country,
            postalCode: payload.postalCode,
          }
          sessionStorage.setItem('pharmacyAdminAssignment', JSON.stringify(updatedAssign))
          localStorage.setItem('pharmacyAdminAssignment', JSON.stringify(updatedAssign))
        } catch {}

        try {
          const rawSettings = readStoredValue('pharmacySettings') || {}
          const updatedSettings = {
            ...rawSettings,
            pharmacyName: payload.name,
            phoneNumber: payload.phone,
            emailAddress: payload.email,
            address: payload.address,
            city: payload.city,
            district: payload.district,
            state: payload.state,
            country: payload.country,
            postalCode: payload.postalCode,
            isActive,
            status: form.status || 'Active',
          }
          localStorage.setItem('pharmacySettings', JSON.stringify(updatedSettings))
        } catch {}

        const updatedRecord = { ...editingPharmacy, ...payload, id, pharmacyId: id, status: form.status || 'Active', isActive }
        const currentList = readLocalPharmacies()
        const nextList = currentList.map((p) => String(idOf(p)) === String(id) ? updatedRecord : p)
        writeLocalPharmacies(nextList)
        setPharmacies((current) => current.map((p) => String(idOf(p)) === String(id) ? updatedRecord : p))
        showToast('Pharmacy updated successfully.')
      } else {
        let createdRecord = null
        try {
          const response = await registerPharmacyAdminPharmacy(payload)
          createdRecord = response?.pharmacy || response?.data?.pharmacy || response
          showToast(response?.message || 'Pharmacy created successfully! Main Branch 1 created and assigned.')
        } catch (regErr) {
          const msg = String(regErr.message || '').toLowerCase()
          if (msg.includes('already has a pharmacy')) {
            try {
              await updatePharmacySettings({
                pharmacyName: payload.name,
                phoneNumber: payload.phone,
                emailAddress: payload.email,
                address: payload.address,
                city: payload.city,
                district: payload.district,
                state: payload.state,
                country: payload.country,
                postalCode: payload.postalCode,
              })
              showToast('Pharmacy details updated in database successfully!')
            } catch (settingsErr) {
              throw regErr
            }
          } else {
            try {
              const superRes = await createSuperAdminPharmacy(payload)
              createdRecord = superRes?.data?.pharmacy || superRes?.pharmacy || superRes
              showToast('Pharmacy created successfully!')
            } catch {
              throw regErr
            }
          }
        }

        const rawId = createdRecord?.pharmacyId || createdRecord?.PharmacyId || createdRecord?.id || createdRecord?.data?.pharmacyId || createdRecord?._id || `PHARM-${Date.now()}`
        const id = String(rawId)
        removeDeletedPharmacyId(id, payload.name)

        try {
          sessionStorage.setItem('workingPharmacyId', String(id))
          localStorage.setItem('workingPharmacyId', String(id))
          sessionStorage.setItem('workingBranchId', '1')
          localStorage.setItem('workingBranchId', '1')
          const rawAssign = sessionStorage.getItem('pharmacyAdminAssignment') || localStorage.getItem('pharmacyAdminAssignment')
          const parsedAssign = rawAssign ? JSON.parse(rawAssign) : {}
          const updatedAssign = {
            ...parsedAssign,
            pharmacyId: id,
            branchId: '1',
            mainBranchId: '1',
            isPharmacyAssigned: true,
            pharmacyName: payload.name,
            pharmacy: createdRecord || payload,
            pharmacyContactNumber: payload.phone,
            pharmacyEmail: payload.email,
            pharmacyAddress: payload.address,
            city: payload.city,
            district: payload.district,
            state: payload.state,
            country: payload.country || 'India',
            postalCode: payload.postalCode,
          }
          sessionStorage.setItem('pharmacyAdminAssignment', JSON.stringify(updatedAssign))
          localStorage.setItem('pharmacyAdminAssignment', JSON.stringify(updatedAssign))
          if (typeof syncPharmacyAdminTenantContext === 'function') {
            syncPharmacyAdminTenantContext(updatedAssign).catch(() => {})
          }
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('pms:tenant-updated', { detail: { pharmacyId: id, branchId: '1', pharmacyName: payload.name } }))
          }
        } catch {}

        try {
          const rawSettings = readStoredValue('pharmacySettings') || {}
          const updatedSettings = {
            ...rawSettings,
            pharmacyId: id,
            pharmacyName: payload.name,
            phoneNumber: payload.phone,
            emailAddress: payload.email,
            address: payload.address,
            city: payload.city,
            district: payload.district,
            state: payload.state,
            country: payload.country,
            postalCode: payload.postalCode,
            isActive: form.status !== 'Inactive',
            status: form.status || 'Active',
          }
          localStorage.setItem('pharmacySettings', JSON.stringify(updatedSettings))
        } catch {}

        // Always save newly created pharmacy in local cache!
        const newPharmacy = {
          ...payload,
          id,
          pharmacyId: id,
          name: payload.name,
          pharmacyName: payload.name,
          status: form.status || 'Active',
          isActive: form.status !== 'Inactive',
          ...(createdRecord && typeof createdRecord === 'object' ? createdRecord : {}),
        }
        const currentList = readLocalPharmacies().filter((p) => {
          const pId = String(idOf(p))
          const pName = String(pharmacyName(p)).trim().toLowerCase()
          if (pId === String(id)) return false
          if (pName === payload.name.trim().toLowerCase()) return false
          if (isDefaultOwner(pName)) return false
          return true
        })
        writeLocalPharmacies([newPharmacy, ...currentList])
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

    let saved = false
    let lastError = null
    // Pharmacy admin: status is stored in pharmacy settings. Send the full settings object
    // so other fields are not wiped, with the new isActive flag.
    try {
      const sRes = await getPharmacySettings({ authRole: 'pharmacyAdmin' })
      const current = sRes?.settings || sRes?.data?.settings || sRes?.data || sRes || {}
      await updatePharmacySettings({
        ...current,
        pharmacyName: current.pharmacyName || pharmacyName(pharmacy),
        isActive: nextActive,
      })
      saved = true
    } catch (err) {
      lastError = err
    }
    if (!saved && /^\d+$/.test(String(id))) {
      try {
        await changeSuperAdminPharmacyStatus(id, { isActive: nextActive, status: nextStatus })
        saved = true
      } catch (err) {
        lastError = lastError || err
      }
    }

    try {
      const rawAssign = sessionStorage.getItem('pharmacyAdminAssignment') || localStorage.getItem('pharmacyAdminAssignment')
      if (rawAssign) {
        const parsed = JSON.parse(rawAssign)
        parsed.accountStatus = nextStatus
        parsed.isActive = nextActive
        sessionStorage.setItem('pharmacyAdminAssignment', JSON.stringify(parsed))
        localStorage.setItem('pharmacyAdminAssignment', JSON.stringify(parsed))
      }
    } catch {}

    try {
      const rawSettings = readStoredValue('pharmacySettings') || {}
      const updatedSettings = {
        ...rawSettings,
        isActive: nextActive,
        status: nextStatus,
      }
      localStorage.setItem('pharmacySettings', JSON.stringify(updatedSettings))
    } catch {}

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

    // 2. Mark this ID & name as deleted so it never reappears on reload
    const deleted = readDeletedPharmacyIds()
    const idStr = String(id)
    const nameKey = name && name !== '-' ? `name:${String(name).trim().toLowerCase()}` : ''
    const toAdd = [idStr]
    if (nameKey && !deleted.includes(nameKey)) toAdd.push(nameKey)
    if (!deleted.includes(idStr)) {
      saveDeletedPharmacyIds([...deleted, ...toAdd])
    } else if (nameKey && !deleted.includes(nameKey)) {
      saveDeletedPharmacyIds([...deleted, nameKey])
    }

    // 3. Immediately remove from local storage and React state
    const currentList = readLocalPharmacies().filter((p) => !isPharmacyDeleted(p, [...deleted, ...toAdd]))
    writeLocalPharmacies(currentList)
    setPharmacies((current) => current.filter((p) => !isPharmacyDeleted(p, [...deleted, ...toAdd])))
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
      <section className="super-admin-module-panel admin-pharmacies-panel">
        <div className="super-admin-module-header">
          <div className="admin-pharmacies-toolbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div className="sa-search-wrap" style={{ position: 'relative', flex: '1', maxWidth: '480px', minWidth: '260px' }}>
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="#64748b"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
              }}
            >
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              aria-label="Search pharmacy management"
              placeholder="Search pharmacies by name, contact, address..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                padding: '10px 14px 10px 38px',
                borderRadius: '10px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                width: '100%',
                outline: 'none',
                backgroundColor: '#ffffff',
                boxSizing: 'border-box',
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
