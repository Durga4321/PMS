import { confirmAction } from '../../components/confirmAction'
import { useEffect, useMemo, useRef, useState } from 'react'
import RowActions from '../../components/RowActions'
import { useToast } from '../../components/ToastProvider'
import {
  changePharmacyBranchStatus,
  createPharmacyBranch,
  readLocalSubBranches,
  writeLocalSubBranches,
  pharmacyTenantContext,
  syncPharmacyAdminTenantContext,
  deletePharmacyBranch,
  getAddressByPincode,
  getPharmacyBranch,
  listPharmacyBranches,
  updatePharmacyBranch,
  getPharmacySettings,
  updatePharmacySettings,
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

const locationOf = (branch) => {
  return formatAddress(branch)
}

function payloadFrom(form) {
  return Object.fromEntries(Object.entries(form).filter(([, value]) => String(value || '').trim() !== ''))
}

function isDefaultOwner(name) {
  return String(name || '').trim().toLowerCase() === 'goutham pharmacy'
}

function buildMainBranch(settings = {}) {
  const localPharmacies = readLocalPharmacies().filter((p) => {
    const name = String(pharmacyNameOf(p) || p.name || p.pharmacyName || '').trim()
    return name && !isDefaultOwner(name)
  })
  const firstPharmacy = localPharmacies[0]
  const assignment = readStoredValue('pharmacyAdminAssignment') || {}

  let pharmacyRecord = firstPharmacy || null
  if (!pharmacyRecord && assignment.pharmacyName && !isDefaultOwner(assignment.pharmacyName) && assignment.pharmacyId) {
    pharmacyRecord = {
      id: assignment.pharmacyId,
      branchId: assignment.branchId || assignment.mainBranchId || assignment.pharmacyId,
      name: assignment.pharmacyName,
      branchName: assignment.pharmacyName,
      phone: assignment.pharmacyContactNumber || assignment.phone || assignment.mobileNumber || '',
      email: assignment.pharmacyEmail || assignment.email || '',
      address: assignment.pharmacyAddress || assignment.address || '',
      city: assignment.city || '',
      district: assignment.district || '',
      state: assignment.state || '',
      country: assignment.country || 'India',
      postalCode: assignment.postalCode || '',
      status: 'Active',
    }
  }

  if (!pharmacyRecord || !idOf(pharmacyRecord)) return null

  const name = pharmacyNameOf(pharmacyRecord) || pharmacyRecord.pharmacyName || pharmacyRecord.name || pharmacyRecord.branchName
  if (!name || isDefaultOwner(name)) return null

  const phone = branchField(pharmacyRecord, 'phone') !== '-' ? branchField(pharmacyRecord, 'phone') : (pharmacyRecord.phone || pharmacyRecord.phoneNumber || pharmacyRecord.pharmacyContactNumber || '')
  const email = branchField(pharmacyRecord, 'email') !== '-' ? branchField(pharmacyRecord, 'email') : (pharmacyRecord.email || pharmacyRecord.emailAddress || pharmacyRecord.pharmacyEmail || '')
  const address = branchField(pharmacyRecord, 'address') !== '-' ? branchField(pharmacyRecord, 'address') : (pharmacyRecord.address || pharmacyRecord.pharmacyAddress || '')

  return {
    id: idOf(pharmacyRecord) || pharmacyRecord.branchId,
    branchId: idOf(pharmacyRecord) || pharmacyRecord.branchId,
    name,
    branchName: name,
    phone,
    email,
    address,
    city: pharmacyRecord.city || '',
    district: pharmacyRecord.district || '',
    state: pharmacyRecord.state || '',
    country: pharmacyRecord.country || 'India',
    postalCode: pharmacyRecord.postalCode || '',
    status: pharmacyRecord.status || 'Active',
    isMainBranch: true,
  }
}

function isMainBranchRecord(b, mainBranch) {
  if (!b) return false
  if (b.isMainBranch === false || b.isSubBranch === true) return false
  if (b.isMainBranch === true || b.IsMainBranch === true) return true
  const bName = String(nameOf(b) || '').trim().toLowerCase()
  if (bName.includes('sub branch') || bName.includes('sub-branch')) return false
  if (bName.includes('main branch')) return true
  if (mainBranch) {
    const mName = String(nameOf(mainBranch) || '').trim().toLowerCase().replace(/\s*-\s*main\s*branch/i, '')
    if (mName && bName === mName && (String(idOf(b)) === String(idOf(mainBranch)) || Number(idOf(b)) === 1)) {
      return true
    }
  }
  return false
}

function BranchNameCell({ branch, index, pharmacies = [] }) {
  const id = idOf(branch) || index + 1
  const linkedId = branch?.pharmacyId || branch?.PharmacyId
  const linkedPharmacy = pharmacies.find((p) => String(pharmacyIdOf(p)) === String(linkedId))
  const pharmacyDisplay = branch?.pharmacyName || branch?.PharmacyName || (linkedPharmacy ? pharmacyNameOf(linkedPharmacy) : '') || (pharmacies.length ? pharmacyNameOf(pharmacies[0]) : '')
  const isMain = Boolean(branch?.isMainBranch) || index === 0
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
  const [branches, setBranches] = useState(() => {
    try {
      const items = typeof readLocalSubBranches === 'function' ? readLocalSubBranches() : []
      return Array.isArray(items) ? items : []
    } catch {
      return []
    }
  })
  const [pharmacies, setPharmacies] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const branchRequestRef = useRef(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [modal, setModal] = useState(null)
  const [currentBranch, setCurrentBranch] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [mainBranch, setMainBranch] = useState(() => buildMainBranch())
  

  const displayBranches = useMemo(() => {
    // 1. Detect if backend branches already has the Main Branch record
    const backendMain = branches.find((b) => isMainBranchRecord(b, mainBranch))
    const resolvedMain = backendMain
      ? {
          ...(mainBranch || {}),
          ...backendMain,
          isMainBranch: true,
          name: (nameOf(mainBranch) && nameOf(mainBranch) !== '-' ? nameOf(mainBranch) : nameOf(backendMain)).replace(/\s*-\s*main\s+branch/i, ''),
          branchName: (nameOf(mainBranch) && nameOf(mainBranch) !== '-' ? nameOf(mainBranch) : nameOf(backendMain)).replace(/\s*-\s*main\s+branch/i, ''),
          phone: branchField(backendMain, 'phone') !== '-' ? branchField(backendMain, 'phone') : branchField(mainBranch, 'phone'),
          email: branchField(backendMain, 'email') !== '-' ? branchField(backendMain, 'email') : branchField(mainBranch, 'email'),
          address: backendMain.address || backendMain.Address || mainBranch?.address || '',
          city: backendMain.city || backendMain.City || mainBranch?.city || '',
          district: backendMain.district || backendMain.District || mainBranch?.district || '',
          state: backendMain.state || backendMain.State || mainBranch?.state || '',
          country: backendMain.country || backendMain.Country || mainBranch?.country || 'India',
          postalCode: backendMain.postalCode || backendMain.PostalCode || backendMain.pincode || mainBranch?.postalCode || '',
        }
      : mainBranch

    // 2. Only actual sub branches remain (eliminating ANY duplicate of main branch)
    const subBranches = branches.filter((b) => {
      if (backendMain && b === backendMain) return false
      if (isMainBranchRecord(b, resolvedMain)) return false
      return true
    })

    return resolvedMain ? [resolvedMain, ...subBranches] : subBranches
  }, [mainBranch, branches])

  async function loadMainBranchDetails() {
    setMainBranch(buildMainBranch())
  }

  async function loadPharmaciesList() {
    try {
      const localItems = readLocalPharmacies().filter((p) => {
        const name = String(pharmacyNameOf(p) || p.name || '').trim()
        return name && !isDefaultOwner(name)
      })
      const assignment = readStoredValue('pharmacyAdminAssignment') || {}
      if (!localItems.length && assignment.pharmacyName && !isDefaultOwner(assignment.pharmacyName) && assignment.pharmacyId) {
        localItems.push({
          id: assignment.pharmacyId,
          name: assignment.pharmacyName,
          pharmacyName: assignment.pharmacyName,
        })
      }
      setPharmacies(localItems)
      if (localItems.length > 0) {
        setForm((prev) => ({ ...prev, pharmacyId: prev.pharmacyId || pharmacyIdOf(localItems[0]) }))
      }
    } catch {
      setPharmacies([])
    }
  }

  async function loadBranches() {
    const requestId = ++branchRequestRef.current
    setLoading(true)
    setError('')
    try {
      const storedPharmacyId = (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('workingPharmacyId') : null) || (typeof localStorage !== 'undefined' ? localStorage.getItem('workingPharmacyId') : null) || ''
      const assignment = readStoredValue('pharmacyAdminAssignment') || {}
      const user = readStoredValue('pharmacyAdminUser') || {}
      const effectivePharmacyId = storedPharmacyId || assignment.pharmacyId || assignment.PharmacyId || user.pharmacyId || user.PharmacyId || ''
      if (!effectivePharmacyId) {
        setBranches([])
        setLoading(false)
        return
      }
      const response = await listPharmacyBranches()
      if (requestId !== branchRequestRef.current) return
      const isDeletedRecord = (b) => Boolean(b?.isDeleted || b?.IsDeleted || b?.deletedAt || b?.DeletedAt || b?.deletedOn || b?.DeletedOn)
      const remoteList = listFrom(response).filter((b) => !isDeletedRecord(b))
      const localList = (typeof readLocalSubBranches === 'function' ? readLocalSubBranches() : []).filter((b) => !isDeletedRecord(b))
      const map = new Map()
      remoteList.forEach((b) => {
        const id = String(idOf(b) || '')
        if (id) map.set(id, b)
      })
      localList.forEach((b) => {
        const id = String(idOf(b) || '')
        if (id && !map.has(id)) map.set(id, b)
      })
      setBranches(Array.from(map.values()))
    } catch (requestError) {
      if (requestId !== branchRequestRef.current) return
      const localList = (typeof readLocalSubBranches === 'function' ? readLocalSubBranches() : [])
      setBranches(localList)
      console.log('Branch list API failed:', requestError.message)
      if (!mainBranch && !localList.length) setError(requestError.message || 'Unable to load sub branches.')
    } finally {
      if (requestId === branchRequestRef.current) setLoading(false)
    }
  }

  useEffect(() => {
    loadMainBranchDetails()
    loadBranches()
    loadPharmaciesList()

    const onTenantUpdated = () => {
      loadMainBranchDetails()
      loadPharmaciesList()
      loadBranches()
    }
    window.addEventListener('pms:tenant-updated', onTenantUpdated)
    return () => { branchRequestRef.current += 1; window.removeEventListener('pms:tenant-updated', onTenantUpdated) }
  }, [])

  function openCreate() {
    if (!mainBranch && !pharmacies.length) {
      showToast('Please create a pharmacy first before adding sub branches.', 'error')
      return
    }
    setCurrentBranch(null)
    const defaultPid = pharmacies.length ? pharmacyIdOf(pharmacies[0]) : (mainBranch?.id || '')
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
      const ctx = typeof pharmacyTenantContext === 'function' ? pharmacyTenantContext() : {}
      const activePharmacyId = form.pharmacyId || (selectedPharmacy ? pharmacyIdOf(selectedPharmacy) : '') || ctx.pharmacyId
      if (activePharmacyId) {
        try {
          sessionStorage.setItem('workingPharmacyId', String(activePharmacyId))
          localStorage.setItem('workingPharmacyId', String(activePharmacyId))
        } catch {}
      }
      const pName = selectedPharmacy ? pharmacyNameOf(selectedPharmacy) : ''
      const payload = {
        ...(activePharmacyId ? { pharmacyId: Number(activePharmacyId) || activePharmacyId, PharmacyId: Number(activePharmacyId) || activePharmacyId } : {}),
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
      if (isEditing) {
        const editId = idOf(currentBranch)
        const isMain = Boolean(currentBranch?.isMainBranch) || Number(editId) === 1
        let branchSaved = false
        let branchError = null
        if (/^\d+$/.test(String(editId))) {
          try {
            await updatePharmacyBranch(editId, payload)
            branchSaved = true
          } catch (err) {
            branchError = err
          }
        }
        // Main branch details are also derived from pharmacy settings, so keep them in sync
        if (isMain) {
          try {
            const sRes = await getPharmacySettings({ authRole: 'pharmacyAdmin' })
            const current = sRes?.settings || sRes?.data?.settings || sRes?.data || sRes || {}
            await updatePharmacySettings({
              ...current,
              phoneNumber: payload.phone || current.phoneNumber,
              emailAddress: payload.email || current.emailAddress,
              address: payload.address || current.address,
              isActive: current.isActive ?? current.IsActive ?? true,
            }, { authRole: 'pharmacyAdmin' })
            branchSaved = true
          } catch (err) {
            branchError = branchError || err
          }
          loadMainBranchDetails()
        }
        if (!branchSaved) throw branchError || new Error('Unable to update branch.')
        const patch = (item) => (idOf(item) === editId ? { ...item, ...payload } : item)
        setBranches((items) => items.map(patch))
        if (isMain) setMainBranch((m) => (m ? { ...m, ...payload } : m))
      }
      else {
        const res = await createPharmacyBranch(payload)
        const createdObj = res?.branch || res?.data?.branch || res?.data || res || {}
        const createdId = createdObj?.branchId || createdObj?.BranchId || createdObj?.id || createdObj?._id || res?.branchId || res?.id || `sub_${Date.now()}`
        const newBranch = {
          ...payload,
          ...(typeof createdObj === 'object' ? createdObj : {}),
          id: String(createdId),
          branchId: String(createdId),
          BranchId: Number(createdId) || createdId,
          isMainBranch: false,
          isSubBranch: true,
          status: payload.status || 'Active',
          isActive: true,
        }
        const currentSub = (typeof readLocalSubBranches === 'function' ? readLocalSubBranches() : []).filter((b) => String(idOf(b)) !== String(createdId))
        if (typeof writeLocalSubBranches === 'function') {
          writeLocalSubBranches([...currentSub, newBranch])
        }
        setBranches((items) => [...items.filter((b) => String(idOf(b)) !== String(createdId)), newBranch])
      }
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
    const id = idOf(branch)
    if (!id || !await confirmAction(`Delete ${nameOf(branch)}?`)) return
    setError('')
    try {
      await deletePharmacyBranch(id)
    } catch (requestError) {
      const msg = requestError.message || 'Unable to delete branch from the database.'
      setError(msg)
      showToast(msg, 'error')
      await loadBranches()
      return
    }
    // Clear working branch selection if it pointed to the deleted branch
    if (String(sessionStorage.getItem('workingBranchId') || '') === String(id)) {
      sessionStorage.removeItem('workingBranchId')
      sessionStorage.removeItem('workingBranch')
      localStorage.removeItem('workingBranchId')
    }
    if (branch?.isMainBranch) setMainBranch(null)
    setBranches((items) => items.filter((item) => idOf(item) !== id))
    await loadBranches()
    showToast('Branch deleted successfully.')
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

  const filteredBranches = useMemo(() => {
if (!search.trim()) return displayBranches
    const term = search.trim().toLowerCase()
    return displayBranches.filter((b) => {
      const name = String(nameOf(b) || '').toLowerCase()
      const loc = String(locationOf(b) || '').toLowerCase()
      const phone = String(branchField(b, 'phone') || '').toLowerCase()
      const email = String(branchField(b, 'email') || '').toLowerCase()
      return name.includes(term) || loc.includes(term) || phone.includes(term) || email.includes(term)
    })
  }, [displayBranches, search])

  const rows = useMemo(() => filteredBranches.map((branch, index) => {
    const id = idOf(branch) || index
    const actions = <RowActions key={`actions-${id}`} itemName={nameOf(branch)} isActive={isActive(branch)} onView={() => openView(branch)} onEdit={() => openEdit(branch)} onStatus={() => toggleStatus(branch)} onDelete={branch?.isMainBranch ? undefined : () => deleteBranch(branch)} />
    return [
      <span className="branches-serial" key="serial">{index + 1}</span>,
      <BranchNameCell key="branch" branch={branch} index={index} pharmacies={pharmacies} />,
      <ContactCell key="contact" branch={branch} />,
      <span className="branches-location-text" key="location" title={locationOf(branch)}>{locationOf(branch)}</span>,
      <StatusBadge key="status" branch={branch} />,
      actions,
    ]
  }), [filteredBranches, pharmacies, workingBranchId])

  return (
    <AdminLayout activeLabel="Branches" title="Branches" subtitle="Main pharmacy branch and sub branches.">
<section className="super-admin-module-panel admin-branches-panel">
        <div className="super-admin-module-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
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
              aria-label="Search branches"
              className="admin-branches-search"
              placeholder="Search branches by name, location, contact..."
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
          <button type="button" className="sa-btn-primary" onClick={openCreate}>+ Add Sub Branch</button>
        </div>
        {error ? <div className="super-admin-module-error">{error}</div> : null}
        <div className="super-admin-module-table" aria-busy={loading}>
          <table><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{loading && !displayBranches.length ? <tr><td colSpan={headers.length}>Loading branches...</td></tr> : rows.length ? rows.map((row, index) => <tr key={idOf(filteredBranches[index]) || index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>) : <tr><td colSpan={headers.length}>No branch details available.</td></tr>}</tbody></table>
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
                        : field === 'postalCode'
                        ? 'Postal Code *'
                        : `${field.charAt(0).toUpperCase() + field.slice(1)} *`}
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


