import { confirmAction } from '../../components/confirmAction'
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useToast } from '../../components/ToastProvider'
import RowActions from '../../components/RowActions'
import {
  assignPharmacistToAdminPharmacy,
  changePharmacistStatus,
  createPharmacist,
  deletePharmacist,
  getPharmacist,
  getPharmacistPermissions,
  listPharmacyBranches,
  listPharmacists,
  resetPharmacistPassword,
  updatePharmacist,
  updatePharmacistPermissions,
  scopedKey,
  readLocalPharmacists,
} from '../../config/api'
import AdminLayout from './AdminLayout'

const emptyForm = { name: '', email: '', phone: '', branchId: '' }
const digitsOnly = (value, limit = 10) => String(value || '').replace(/\D/g, '').slice(0, limit)
const permissionKeys = ['prescriptions', 'dispensing', 'stock', 'reports']

function normalizeList(response) {
  if (Array.isArray(response)) return response
  if (Array.isArray(response?.data)) return response.data
  if (Array.isArray(response?.Data)) return response.Data
  if (Array.isArray(response?.data?.pharmacists)) return response.data.pharmacists
  if (Array.isArray(response?.data?.Pharmacists)) return response.data.Pharmacists
  if (Array.isArray(response?.data?.users)) return response.data.users
  if (Array.isArray(response?.data?.Users)) return response.data.Users
  if (Array.isArray(response?.data?.items)) return response.data.items
  if (Array.isArray(response?.data?.branches)) return response.data.branches
  if (Array.isArray(response?.pharmacists)) return response.pharmacists
  if (Array.isArray(response?.Pharmacists)) return response.Pharmacists
  if (Array.isArray(response?.users)) return response.users
  if (Array.isArray(response?.Users)) return response.Users
  if (Array.isArray(response?.items)) return response.items
  if (Array.isArray(response?.branches)) return response.branches
  if (Array.isArray(response?.results)) return response.results
  return []
}

function getId(item) {
  return item?._id || item?.id || item?.Id || item?.pharmacistId || item?.PharmacistId || item?.userId || item?.UserId || item?.uuid
}

function branchIdOf(item) {
  return item?._id || item?.id || item?.branchId || item?.BranchId || ''
}

function branchNameOf(item) {
  return item?.name || item?.branchName || item?.BranchName || item?.pharmacyName || item?.PharmacyName || 'Branch'
}

function readStoredJson(key) {
  try {
    const raw = sessionStorage.getItem(key) || localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}


function mainBranchFromPharmacy() {
  const workingBranchId = (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('workingBranchId') : null) || (typeof localStorage !== 'undefined' ? localStorage.getItem('workingBranchId') : null) || ''
  const workingPharmacyId = (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('workingPharmacyId') : null) || (typeof localStorage !== 'undefined' ? localStorage.getItem('workingPharmacyId') : null) || ''
  const assignment = readStoredJson('pharmacyAdminAssignment') || {}
  const user = readStoredJson('pharmacyAdminUser') || {}
  const settings = readStoredJson('pharmacySettings') || {}
  const localPharmacies = readStoredJson(scopedKey('pms_admin_pharmacies_list')) || readStoredJson('pms_admin_pharmacies_list') || []
  const firstLocal = Array.isArray(localPharmacies) && localPharmacies.find((p) => p && !p.isDeleted)

  const pharmacyName =
    assignment.pharmacyName ||
    assignment.PharmacyName ||
    assignment.pharmacy?.name ||
    assignment.pharmacy?.pharmacyName ||
    user.pharmacyName ||
    user.PharmacyName ||
    user.pharmacy?.name ||
    user.pharmacy?.pharmacyName ||
    settings.pharmacyName ||
    settings.name ||
    firstLocal?.name ||
    firstLocal?.pharmacyName ||
    'Main Pharmacy'

  const id =
    assignment.mainBranchId ||
    assignment.MainBranchId ||
    assignment.branchId ||
    assignment.BranchId ||
    assignment.branch?.id ||
    assignment.branch?.branchId ||
    workingBranchId ||
    '1'

  const rawPharmId = assignment.pharmacyId || assignment.PharmacyId || workingPharmacyId || firstLocal?.id || firstLocal?.pharmacyId
  const hasPharmacy = Boolean(rawPharmId || assignment.isPharmacyAssigned || (firstLocal && firstLocal.name))

  if (!hasPharmacy && !pharmacyName) return null

  return {
    id: String(id),
    branchId: String(id),
    BranchId: Number(id) || id,
    name: pharmacyName,
    branchName: `${pharmacyName} - Main Branch`,
    pharmacyName,
    isMainBranch: true,
  }
}
function storedBranchId() {
  const working = sessionStorage.getItem('workingBranchId') || localStorage.getItem('workingBranchId')
  if (working) return working
  const assignment = readStoredJson('pharmacyAdminAssignment') || {}
  const user = readStoredJson('pharmacyAdminUser') || {}
  const pharmacy = assignment.pharmacy || user.pharmacy || {}
  return assignment.branchId || assignment.BranchId || assignment.branch?.id || assignment.branch?.branchId || user.branchId || user.BranchId || user.branch?.id || user.branch?.branchId || assignment.pharmacyId || assignment.PharmacyId || pharmacy.id || user.pharmacyId || ''
}

function getName(item) {
  return item?.name || item?.Name || item?.fullName || item?.FullName || item?.pharmacistName || item?.PharmacistName || item?.email || item?.Email || 'Pharmacist'
}

const LOCAL_PHONES_KEY = 'pms_pharmacist_phones'

function getLocalPhones() {
  try {
    const key = scopedKey(LOCAL_PHONES_KEY)
    return JSON.parse(localStorage.getItem(key) || '{}')
  } catch {
    return {}
  }
}

function saveLocalPhone(phoneKey, phone) {
  if (!phoneKey || !phone) return
  try {
    const key = scopedKey(LOCAL_PHONES_KEY)
    const map = getLocalPhones()
    map[String(phoneKey)] = String(phone).trim()
    localStorage.setItem(key, JSON.stringify(map))
  } catch {}
}

function getPhone(item) {
  if (!item) return ''
  const direct =
    item.phone ||
    item.Phone ||
    item.mobile ||
    item.Mobile ||
    item.mobileNumber ||
    item.MobileNumber ||
    item.phoneNumber ||
    item.PhoneNumber ||
    item.contactNumber ||
    item.ContactNumber ||
    item.contact ||
    item.Contact ||
    item.contactNo ||
    item.ContactNo ||
    item.mobileNo ||
    item.MobileNo ||
    item.phone_number ||
    item.mobile_number

  if (direct && String(direct).trim() && String(direct).trim() !== '-') return String(direct).trim()

  const nested = item.user || item.User || item.userId || item.pharmacist || item.profile || item.details
  if (nested && typeof nested === 'object') {
    const val =
      nested.phone ||
      nested.Phone ||
      nested.mobile ||
      nested.Mobile ||
      nested.mobileNumber ||
      nested.MobileNumber ||
      nested.phoneNumber ||
      nested.PhoneNumber ||
      nested.contactNumber ||
      nested.ContactNumber ||
      nested.contact ||
      nested.contactNo ||
      nested.mobileNo ||
      nested.phone_number ||
      nested.mobile_number

    if (val && String(val).trim() && String(val).trim() !== '-') return String(val).trim()
  }

  const id = getId(item)
  const localMap = getLocalPhones()
  if (id && localMap[String(id)]) return localMap[String(id)]
  const emailKey = item.email || item.Email
  if (emailKey && localMap[String(emailKey)]) return localMap[String(emailKey)]

  return ''
}

function PasswordIcon({ visible }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'block' }}>
      {visible ? (
        <>
          <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
        </>
      ) : (
        <>
          <path d="M3 3l18 18" />
          <path d="M10.7 5.2A10.7 10.7 0 0 1 12 5c6.5 0 10 7 10 7a18.6 18.6 0 0 1-3 4.1" />
          <path d="M14.1 14.1A3 3 0 0 1 9.9 9.9" />
          <path d="M6.6 6.6C3.8 8.5 2 12 2 12s3.5 7 10 7c1.5 0 2.8-.4 4-1" />
        </>
      )}
    </svg>
  )
}

function isPharmacistActive(item) {
  if (!item) return false

  // Check explicit status string first
  const raw = String(item.status || item.user?.status || item.userId?.status || '').toLowerCase().trim()
  if (['inactive', 'deactivated', 'disabled', 'blocked', 'suspended', 'false', '0'].includes(raw)) {
    return false
  }
  if (['active', 'activated', 'enabled', 'true', '1'].includes(raw)) {
    return true
  }

  // Check explicit booleans
  if (item.isActive === false || item.is_active === false || item.active === false) return false
  if (item.user?.isActive === false || item.userId?.isActive === false) return false
  if (item.isActive === true || item.is_active === true || item.active === true) return true
  if (item.user?.isActive === true || item.userId?.isActive === true) return true

  return true
}

function getStatus(item) {
  return isPharmacistActive(item) ? 'Active' : 'Inactive'
}

function Users({ initialAdd = false }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { showToast } = useToast()

  const isAddRoute = initialAdd || location.pathname.endsWith('/add')
  const [pharmacists, setPharmacists] = useState([])
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [branches, setBranches] = useState([])
  const [branchesLoading, setBranchesLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(null)
  const [togglingId, setTogglingId] = useState(null)
  const [showTempPassword, setShowTempPassword] = useState(false)
  const [formOpen, setFormOpen] = useState(isAddRoute)
  const [form, setForm] = useState(emptyForm)
  const [permissionsFor, setPermissionsFor] = useState(null)
  const [permissions, setPermissions] = useState({})
  const [resetting, setResetting] = useState(null)
  const [temporaryPassword, setTemporaryPassword] = useState('')
  const [viewing, setViewing] = useState(null)
  // Branch options derived from API data with main branch guaranteed
  const branchOptions = useMemo(() => {
    const main = mainBranchFromPharmacy()
    const all = []
    const seen = new Set()

    const hasMainInBranches = branches.some((b) => {
      const bId = String(branchIdOf(b) || '')
      const bName = String(branchNameOf(b) || '').toLowerCase()
      return b.isMainBranch || bId === '1' || bName.includes('main branch') || (main && bId === String(main.id))
    })

    if (main && !hasMainInBranches) {
      all.push(main)
      seen.add(String(main.id))
    }

    for (const b of branches) {
      const id = String(branchIdOf(b) || '')
      if (id && !seen.has(id)) {
        seen.add(id)
        all.push(b)
      }
    }

    if (all.length === 0 && main) {
      all.push(main)
    }

    return all
  }, [branches])

  useEffect(() => {
    if (location.pathname.endsWith('/add')) {
      setEditing(null)
      setForm((prev) => ({ name: '', email: '', phone: '', branchId: prev.branchId || storedBranchId() }))
      setFormErrors({})
      setFormOpen(true)
      const timer = setTimeout(() => {
        setForm((prev) => (editing ? prev : { name: '', email: '', phone: '', branchId: prev.branchId || storedBranchId() }))
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [location.pathname])

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase()
    return pharmacists.filter((item) => {
      if (statusFilter !== 'all' && isPharmacistActive(item) !== (statusFilter === 'active')) return false
      const name = String(getName(item) || '').toLowerCase()
      const email = String(item.email || '').toLowerCase()
      const phone = String(getPhone(item) || '').toLowerCase()
      return name.includes(value) || email.includes(value) || phone.includes(value) || JSON.stringify(item).toLowerCase().includes(value)
    })
  }, [pharmacists, query, statusFilter])

  async function loadPharmacists() {
    setLoading(true)
    setLoadError('')
    const activePharmacyId = String(sessionStorage.getItem('workingPharmacyId') || localStorage.getItem('workingPharmacyId') || '')
    const assignment = readStoredJson('pharmacyAdminAssignment') || {}
    const user = readStoredJson('pharmacyAdminUser') || {}
    const rawPharmId = activePharmacyId || assignment?.pharmacyId || assignment?.PharmacyId || user?.pharmacyId || user?.PharmacyId || user?.pharmacy?.id || user?.pharmacy?.pharmacyId
    if (rawPharmId && !activePharmacyId) {
      try {
        sessionStorage.setItem('workingPharmacyId', String(rawPharmId))
        localStorage.setItem('workingPharmacyId', String(rawPharmId))
      } catch {}
    }

    try {
      const response = await listPharmacists({ search: query })
      const list = normalizeList(response) || []
      setPharmacists(list)
    } catch (error) {
      const rawMsg = error.message || 'Unable to load pharmacists.'
      let message = rawMsg
      if (rawMsg.includes('<!DOCTYPE') || rawMsg.includes('<html') || rawMsg.includes('ERR_NGROK')) {
        message = 'Backend server tunnel is currently offline (ngrok ERR_NGROK_3200). Operating in local offline mode.'
      }
      setLoadError(message)
      setPharmacists([])
      if (!/View permission for User Management/i.test(message) && !rawMsg.includes('ERR_NGROK')) {
        showToast(message, 'warning')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isAddRoute) loadPharmacists()
  }, [isAddRoute])

  useEffect(() => {
    let mounted = true
    async function loadBranchesForForm() {
      setBranchesLoading(true)
      try {
        const response = await listPharmacyBranches()
        const list = normalizeList(response)
        if (!mounted) return
        setBranches(list);
        setForm((prev) => {
          const main = mainBranchFromPharmacy()
          const existing = prev.branchId || storedBranchId();
          const fallback = existing || (main ? branchIdOf(main) : '') || (list.length ? branchIdOf(list[0]) : '');
          return { ...prev, branchId: fallback ? String(fallback) : '' };
        })
      } catch (error) {
        if (mounted && formOpen) console.warn('Unable to load branches:', error.message)
      } finally {
        if (mounted) setBranchesLoading(false)
      }
    }
    loadBranchesForForm()

    const handleTenantUpdated = () => {
      loadBranchesForForm()
    }
    window.addEventListener('pms:tenant-updated', handleTenantUpdated)
    return () => {
      mounted = false
      window.removeEventListener('pms:tenant-updated', handleTenantUpdated)
    }
  }, [isAddRoute, formOpen])
  const [formErrors, setFormErrors] = useState({})

  function validateForm() {
    const errs = {}
    const nameVal = (form.name || '').trim()
    if (!nameVal) {
      errs.name = 'Pharmacist Name is required.'
    } else if (nameVal.length < 2) {
      errs.name = 'Pharmacist Name must be at least 2 characters.'
    }

    const emailVal = (form.email || '').trim()
    if (!emailVal) {
      errs.email = 'Email Address is required.'
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(emailVal)) {
        errs.email = 'Please enter a valid email address.'
      }
    }

    const phoneVal = (form.phone || '').trim()
    if (phoneVal) {
      const cleanPhone = digitsOnly(phoneVal)
      if (!/^\d{10}$/.test(cleanPhone)) {
        errs.phone = 'Phone number must be exactly 10 digits.'
      }
    }

    setFormErrors(errs)
    const firstKey = Object.keys(errs)[0]
    if (firstKey) {
      const el = document.getElementById(`user-${firstKey}`)
      if (el) el.focus()
    }
    return Object.keys(errs).length === 0
  }

  function openCreate() {
    setEditing(null)
    setForm({ ...emptyForm, branchId: storedBranchId() })
    setFormErrors({})
    setFormOpen(true)
    if (!location.pathname.endsWith('/add')) {
      navigate('/admin/users/add')
    }
  }

  async function openView(pharmacist) {
    setViewing(pharmacist)
    const id = getId(pharmacist)
    if (id) {
      try {
        const res = await getPharmacist(id)
        const fresh = res?.data?.pharmacist || res?.data || res?.pharmacist || res
        if (fresh) {
          setViewing((prev) => (prev && getId(prev) === id ? { ...prev, ...fresh } : prev))
          const freshPhone = getPhone(fresh)
          if (freshPhone) {
            saveLocalPhone(id, freshPhone)
            if (fresh.email) saveLocalPhone(fresh.email, freshPhone)
          }
        }
      } catch (e) {
        // Continue with initial data
      }
    }
  }

  async function openEdit(pharmacist) {
    setEditing(pharmacist)
    const currentPhone = getPhone(pharmacist)
    setForm({
      name: getName(pharmacist),
      email: pharmacist?.email || pharmacist?.user?.email || pharmacist?.userId?.email || '',
      phone: currentPhone,
      branchId: pharmacist?.branchId || pharmacist?.BranchId || pharmacist?.branch?.id || pharmacist?.branch?.branchId || storedBranchId(),
    })
    setFormErrors({})
    setFormOpen(true)

    // Fetch full details in case list query omitted phone
    const id = getId(pharmacist)
    if (id) {
      try {
        const res = await getPharmacist(id)
        const fresh = res?.data?.pharmacist || res?.data || res?.pharmacist || res
        if (fresh) {
          const freshPhone = getPhone(fresh)
          if (freshPhone) {
            setForm((prev) => ({
              ...prev,
              phone: prev.phone || freshPhone,
            }))
            saveLocalPhone(id, freshPhone)
            if (fresh.email) saveLocalPhone(fresh.email, freshPhone)
          }
        }
      } catch (e) {
        // Continue with initial data
      }
    }
  }

  function closeForm() {
    setFormOpen(false)
    setEditing(null)
    setForm({ ...emptyForm, branchId: storedBranchId() })
    setFormErrors({})
    if (location.pathname.endsWith('/add')) {
      navigate('/admin/users')
    }
  }

  async function handleSave(event) {
    event.preventDefault()
    if (!validateForm()) return
    setSaving(true)
    const phoneVal = (form.phone || '').trim()
    if (!editing && !form.branchId) {
      const fallback = branchOptions.length ? branchIdOf(branchOptions[0]) : storedBranchId()
      if (fallback) {
        form.branchId = String(fallback)
      } else {
        setFormErrors((current) => ({ ...current, branchId: 'Please create or choose a branch before creating a pharmacist.' }))
        showToast('Please create or choose a branch before creating a pharmacist.', 'error')
        setSaving(false)
        return
      }
    }
    const selectedBranch = branchOptions.find((b) => String(branchIdOf(b)) === String(form.branchId)) || (branchOptions.length ? branchOptions[0] : null)
    let numericBranchId = Number(form.branchId)
    if (!Number.isSafeInteger(numericBranchId) || numericBranchId <= 0) {
      const candidate = selectedBranch?.BranchId || selectedBranch?.branchId || selectedBranch?.id
      if (Number.isSafeInteger(Number(candidate)) && Number(candidate) > 0) {
        numericBranchId = Number(candidate)
      } else {
        numericBranchId = 1
      }
    }

    const activePharmacyId = String(sessionStorage.getItem('workingPharmacyId') || localStorage.getItem('workingPharmacyId') || '1')
    const activePharmacyName = sessionStorage.getItem('workingPharmacyName') || localStorage.getItem('workingPharmacyName') || ''
    const payload = {
      name: form.name.trim(),
      email: form.email.trim(),
      mobileNumber: phoneVal,
      branchId: numericBranchId,
      pharmacyId: activePharmacyId,
      pharmacyName: activePharmacyName,
    }

    try {
      const response = editing ? await updatePharmacist(getId(editing), payload) : await createPharmacist(payload)
      const targetId = editing ? getId(editing) : getId(response?.data || response?.pharmacist || response)
      if (targetId && phoneVal) {
        saveLocalPhone(targetId, phoneVal)
      }
      if (form.email && phoneVal) {
        saveLocalPhone(form.email, phoneVal)
      }

      // Optimistically update list so table reflects phone immediately
      if (editing) {
        setPharmacists((prev) =>
          prev.map((p) => {
            if (getId(p) === getId(editing)) {
              return {
                ...p,
                name: form.name.trim(),
                email: form.email.trim(),
                phone: phoneVal,
                mobile: phoneVal,
                mobileNumber: phoneVal,
                phoneNumber: phoneVal,
                user: p.user ? { ...p.user, name: form.name.trim(), email: form.email.trim(), phone: phoneVal, mobile: phoneVal } : p.user,
              }
            }
            return p
          })
        )
      }

      showToast(response?.message || `Pharmacist ${editing ? 'updated' : 'created'} successfully.`)
      closeForm()
      await loadPharmacists()
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('pms:pharmacists-updated'))
    } catch (error) {
      showToast(error.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(pharmacist) {
    if (!await confirmAction(`Delete ${getName(pharmacist)}?`)) return
    try {
      const response = await deletePharmacist(getId(pharmacist))
      showToast(response?.message || 'Pharmacist deleted successfully.')
      await loadPharmacists()
    } catch (error) {
      showToast(error.message, 'error')
    }
  }

  async function handleStatus(pharmacist) {
    const id = getId(pharmacist)
    if (!id || togglingId === id) return

    const currentlyActive = isPharmacistActive(pharmacist)
    const nextActive = !currentlyActive
    const nextStatus = nextActive ? 'Active' : 'Inactive'
    const nextStatusLower = nextActive ? 'active' : 'inactive'

    // Optimistically update local list so UI reflects immediately
    setPharmacists((prev) =>
      prev.map((p) => {
        if (getId(p) === id) {
          return {
            ...p,
            status: nextStatus,
            isActive: nextActive,
            active: nextActive,
            is_active: nextActive,
            ...(p.user ? { user: { ...p.user, status: nextStatus, isActive: nextActive } } : {}),
            ...(p.userId ? { userId: { ...p.userId, status: nextStatus, isActive: nextActive } } : {}),
          }
        }
        return p
      })
    )

    setTogglingId(id)

    try {
      const payload = {
        status: nextStatus,
        isActive: nextActive,
        active: nextActive,
      }

      let response
      try {
        response = await changePharmacistStatus(id, payload)
      } catch (err) {
        // Fallback: try lowercase status or updatePharmacist
        try {
          response = await changePharmacistStatus(id, {
            status: nextStatusLower,
            isActive: nextActive,
          })
        } catch (err2) {
          response = await updatePharmacist(id, payload)
        }
      }

      const defaultMsg = nextActive
        ? 'Pharmacist activated successfully.'
        : 'Pharmacist deactivated successfully.'

      showToast(response?.message || defaultMsg)
      await loadPharmacists()
    } catch (error) {
      showToast(error.message || 'Failed to update pharmacist status.', 'error')
      await loadPharmacists()
    } finally {
      setTogglingId(null)
    }
  }

  async function handleAssign(pharmacist) {
    try {
      const branchId = pharmacist?.branchId || pharmacist?.BranchId || storedBranchId()
      const response = await assignPharmacistToAdminPharmacy(getId(pharmacist), branchId ? { branchId: Number(branchId), BranchId: Number(branchId) } : {})
      showToast(response?.message || 'Pharmacist branch updated successfully.')
      await loadPharmacists()
    } catch (error) {
      showToast(error.message, 'error')
    }
  }

  async function openPermissions(pharmacist) {
    setPermissionsFor(pharmacist)
    setPermissions(pharmacist?.permissions || {})
    try {
      const response = await getPharmacistPermissions(getId(pharmacist))
      const permissionData = response?.data?.permissions || response?.permissions || response?.data || response || {}
      setPermissions(permissionData)
    } catch (error) {
      showToast(error.message, 'error')
    }
  }

  async function handlePermissions(event) {
    event.preventDefault()
    try {
      const response = await updatePharmacistPermissions(getId(permissionsFor), { permissions })
      showToast(response?.message || 'Pharmacist permissions updated successfully.')
      setPermissionsFor(null)
      await loadPharmacists()
    } catch (error) {
      showToast(error.message, 'error')
    }
  }

  async function handleResetPassword(event) {
    event.preventDefault()
    try {
      const response = await resetPharmacistPassword(getId(resetting), { temporaryPassword, password: temporaryPassword })
      showToast(response?.message || 'Temporary password set successfully.')
      setResetting(null)
      setTemporaryPassword('')
    } catch (error) {
      showToast(error.message, 'error')
    }
  }

  // =========================================================================
  // SEPARATE SCREEN: Create / Edit Pharmacist
  // =========================================================================
  if (formOpen) {
    return (
      <AdminLayout
        activeLabel="Pharmacists"
        title={editing ? 'Edit Pharmacist' : 'Create Pharmacist'}
        subtitle={editing ? 'Update pharmacist credentials and contact details.' : 'Enter new pharmacist information and access credentials.'}
        headerAction={
          <button
            type="button"
            className="btn-secondary"
            onClick={closeForm}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginRight: '6px' }}>
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to Pharmacists
          </button>
        }
      >
        <section className="branch-panel pharmacist-create-panel" style={{ maxWidth: '840px', margin: '0 auto', borderTop: '3.5px solid var(--pms-accent, #0bb5aa)' }}>
          <div className="branch-panel-heading">
            <div>
              <h2>{editing ? 'Edit Pharmacist Profile' : 'New Pharmacist Registration'}</h2>
              <p>Fields marked with * are required.</p>
            </div>
            <button className="btn-primary pharmacist-header-submit" type="submit" form="pharmacist-create-form" disabled={saving}>
              {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Pharmacist'}
            </button>
          </div>

          <form id="pharmacist-create-form" onSubmit={handleSave} noValidate autoComplete="off" className="pharmacist-screen-form">
            {/* Honeypot fields to absorb browser auto-filling of saved admin credentials */}
            <input type="text" name="fake_username_remembered" style={{ position: 'absolute', opacity: 0, height: 0, width: 0, pointerEvents: 'none' }} tabIndex="-1" autoComplete="off" readOnly defaultValue="" />
            <input type="password" name="fake_password_remembered" style={{ position: 'absolute', opacity: 0, height: 0, width: 0, pointerEvents: 'none' }} tabIndex="-1" autoComplete="new-password" readOnly defaultValue="" />

            <div className="pharmacist-form-grid">
              <div className="pharmacist-form-field">
                <label htmlFor="user-name">Full Name *</label>
                <input
                  id="user-name"
                  name="pharmacist_fullname"
                  autoComplete="off"
                  value={form.name}
                  onChange={(event) => {
                    setForm({ ...form, name: event.target.value })
                    if (formErrors.name) setFormErrors({ ...formErrors, name: '' })
                  }}
                  className={formErrors.name ? 'has-error' : ''}
                  placeholder="e.g. Rahul Jonnala"
                  required
                />
                {formErrors.name && (
                  <span className="form-error-msg">{formErrors.name}</span>
                )}
              </div>

              <div className="pharmacist-form-field">
                <label htmlFor="user-email">Email Address *</label>
                <input
                  type="email"
                  id="user-email"
                  name="pharmacist_new_email"
                  autoComplete="new-password"
                  value={form.email}
                  onChange={(event) => {
                    setForm({ ...form, email: event.target.value })
                    if (formErrors.email) setFormErrors({ ...formErrors, email: '' })
                  }}
                  className={formErrors.email ? 'has-error' : ''}
                  placeholder="e.g. pharmacist@hospital.com"
                  required
                />
                {formErrors.email && (
                  <span className="form-error-msg">{formErrors.email}</span>
                )}
              </div>

              <div className="pharmacist-form-field">
                <label htmlFor="user-phone">Phone Number *</label>
                <input
                  id="user-phone" inputMode="numeric" maxLength={10} pattern="[0-9]{10}"
                  name="pharmacist_new_phone"
                  autoComplete="off"
                  value={form.phone}
                  onChange={(event) => {
                    setForm({ ...form, phone: digitsOnly(event.target.value) })
                    if (formErrors.phone) setFormErrors({ ...formErrors, phone: '' })
                  }}
                  className={formErrors.phone ? 'has-error' : ''}
                  placeholder="e.g. +91 98765 43210"
                />
                {formErrors.phone && (
                  <span className="form-error-msg">{formErrors.phone}</span>
                )}
              </div>
              <div className="pharmacist-form-field">
                <label htmlFor="user-branch">Branch *</label>
                <select
                  id="user-branch"
                  name="pharmacist_branch"
                  value={form.branchId}
                  onChange={(event) => {
                    setForm({ ...form, branchId: event.target.value })
                    if (formErrors.branchId) setFormErrors({ ...formErrors, branchId: '' })
                  }}
                  className={formErrors.branchId ? 'has-error' : ''}
                  required
                >
                  <option value="">{branchesLoading ? 'Loading branches...' : branchOptions.length ? 'Select branch' : 'Create a pharmacy / sub branch first'}</option>
                  {branchOptions.map((branch) => {
                    const id = branchIdOf(branch);
                    const isMain = branch?.isMainBranch || (branch?.branchName && /main\s*branch/i.test(branch.branchName)) || String(id) === '1';
                    const cleanName = branchNameOf(branch).replace(/\s*-\s*main\s*branch/i, '');
                    const label = `${cleanName} - ${isMain ? 'Main' : 'Sub'} Branch`;
                    return id ? <option key={id} value={id}>{label}</option> : null;
                  })}
                </select>
                {formErrors.branchId && (
                  <span className="form-error-msg">{formErrors.branchId}</span>
                )}
              </div>
            </div>

            <div className="pharmacist-form-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={closeForm}
              >
                Cancel
              </button>
              <button className="btn-primary" type="submit" disabled={saving}>
                {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Pharmacist'}
              </button>
            </div>
          </form>
        </section>
      </AdminLayout>
    )
  }

  // =========================================================================
  // MAIN TABLE SCREEN: Pharmacists Directory
  // =========================================================================
  return (
    <AdminLayout headerAction={<button className="page-heading-refresh" type="button" onClick={loadPharmacists} disabled={loading}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M20 7v5h-5M20 12a8 8 0 1 0-2.34 5.66" /></svg>Refresh</button>} activeLabel="Pharmacists" title="Manage Pharmacists" subtitle="Admin / Pharmacists">
      <section className="branch-panel pharmacist-panel">
<div className="branch-panel-heading" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
          <div className="sa-search-wrap" style={{ position: 'relative', flex: '1', maxWidth: '420px', minWidth: '240px' }}>
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="#64748b"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
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
              aria-label="Search pharmacists"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && loadPharmacists()}
              placeholder="Search pharmacists by name, email, or phone..."
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
          <div className="pharmacist-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <select
              aria-label="Filter pharmacists by status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <button
              className="btn-secondary"
              type="button"
              onClick={() => { setQuery(''); setStatusFilter('all') }}
            >
              Clear Filters
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={openCreate}
              style={{ display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginRight: '6px' }}>
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add Pharmacist
            </button>
          </div>
        </div>

        {loadError && !loadError.includes('<') ? (
          <div style={{
            background: '#fffbeb',
            border: '1px solid #fef3c7',
            color: '#b45309',
            padding: '10px 14px',
            borderRadius: '8px',
            fontSize: '13px',
            marginBottom: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span>{loadError}</span>
          </div>
        ) : null}
        <div className="branch-table-wrap">
          <table className="branch-table">
            <thead>
              <tr>
                <th style={{ width: '80px' }}>ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Pharmacy</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan="7" style={{ textAlign: 'center', padding: '24px' }}>Loading pharmacists...</td></tr> : null}
              {!loading && filtered.length ? filtered.map((pharmacist, index) => (
                <tr key={getId(pharmacist) || index}>
                  <td>
                    <span style={{ fontWeight: 700, color: '#334155' }}>
                      {getId(pharmacist) || index + 1}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{getName(pharmacist)}</td>
                  <td>{pharmacist?.email || '-'}</td>
                  <td>{getPhone(pharmacist) || '-'}</td>
                  <td>
                    {pharmacist?.branchName ||
                      (pharmacist?.branchId && branchOptions.find((b) => String(branchIdOf(b)) === String(pharmacist.branchId))
                        ? branchNameOf(branchOptions.find((b) => String(branchIdOf(b)) === String(pharmacist.branchId)))
                        : '') ||
                      pharmacist?.pharmacy?.name ||
                      pharmacist?.pharmacyName ||
                      'Main Branch'}
                  </td>
                  <td>
                    <button
                      type="button"
                      className={`table-status-badge clickable ${isPharmacistActive(pharmacist) ? 'status-success' : 'status-danger'}`}
                      onClick={() => handleStatus(pharmacist)}
                      disabled={togglingId === getId(pharmacist)}
                      title={isPharmacistActive(pharmacist) ? 'Active — Click to Deactivate' : 'Inactive — Click to Activate'}
                      aria-label={`Status: ${getStatus(pharmacist)}. Click to toggle.`}
                      style={{
                        opacity: togglingId === getId(pharmacist) ? 0.6 : 1,
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-block',
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: isPharmacistActive(pharmacist) ? '#16a34a' : '#dc2626',
                        }}
                      />
                      {getStatus(pharmacist)}
                    </button>
                  </td>
                  <td className="pharmacist-actions">
                    <RowActions itemName={getName(pharmacist)} isActive={isPharmacistActive(pharmacist)} onView={() => openView(pharmacist)} onEdit={() => openEdit(pharmacist)} onStatus={() => handleStatus(pharmacist)} onDelete={() => handleDelete(pharmacist)} statusDisabled={togglingId === getId(pharmacist)} />
                  </td>
                </tr>
              )) : null}
              {!loading && !filtered.length ? <tr><td colSpan="7" style={{ textAlign: 'center', padding: '28px', color: '#64748b' }}>No pharmacists found.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      {/* Permissions Modal */}
      {permissionsFor ? (
        <div className="sa-modal-backdrop" onClick={() => setPermissionsFor(null)}>
          <form className="sa-modal-card" onSubmit={handlePermissions} onClick={(e) => e.stopPropagation()}>
            <div className="sa-modal-header" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9' }}>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>Permissions — {getName(permissionsFor)}</h2>
              <button type="button" className="sa-modal-close" onClick={() => setPermissionsFor(null)} style={{ background: 'none', border: 0, fontSize: '20px', cursor: 'pointer', color: '#64748b' }}>&times;</button>
            </div>
            <div className="sa-modal-body" style={{ padding: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                {permissionKeys.map((key) => (
                  <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '10px', background: '#f8fafc' }}>
                    <input
                      type="checkbox"
                      checked={Boolean(permissions[key])}
                      onChange={(event) => setPermissions({ ...permissions, [key]: event.target.checked })}
                      style={{ width: '16px', height: '16px', accentColor: '#2563eb' }}
                    />
                    <span style={{ textTransform: 'capitalize', fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{key}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="sa-modal-footer" style={{ padding: '14px 20px', display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #f1f5f9' }}>
              <button type="button" className="btn-secondary" onClick={() => setPermissionsFor(null)}>Cancel</button>
              <button className="btn-primary" type="submit">Save Permissions</button>
            </div>
          </form>
        </div>
      ) : null}

      {/* Reset Password Modal */}
      {resetting ? (
        <div className="sa-modal-backdrop" onClick={() => setResetting(null)}>
          <form className="sa-modal-card" onSubmit={handleResetPassword} onClick={(e) => e.stopPropagation()}>
            <div className="sa-modal-header" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9' }}>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>Reset Password — {getName(resetting)}</h2>
              <button type="button" className="sa-modal-close" onClick={() => setResetting(null)} style={{ background: 'none', border: 0, fontSize: '20px', cursor: 'pointer', color: '#64748b' }}>&times;</button>
            </div>
            <div className="sa-modal-body" style={{ padding: '20px' }}>
              <div className="pharmacist-form-field">
                <label htmlFor="temp-password">Temporary Password *</label>
                <div className="password-input-wrap">
                  <input
                    id="temp-password"
                    type={showTempPassword ? 'text' : 'password'}
                    value={temporaryPassword}
                    onChange={(event) => setTemporaryPassword(event.target.value)}
                    placeholder="Enter temporary password"
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowTempPassword((prev) => !prev)}
                    title={showTempPassword ? 'Hide password' : 'Show password'}
                    aria-label={showTempPassword ? 'Hide password' : 'Show password'}
                  >
                    <PasswordIcon visible={showTempPassword} />
                  </button>
                </div>
              </div>
            </div>
            <div className="sa-modal-footer" style={{ padding: '14px 20px', display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #f1f5f9' }}>
              <button type="button" className="btn-secondary" onClick={() => setResetting(null)}>Cancel</button>
              <button className="btn-primary" type="submit">Set Password</button>
            </div>
          </form>
        </div>
      ) : null}

      {/* View Pharmacist Modal */}
      {viewing ? (
        <div className="sa-modal-backdrop" onClick={() => setViewing(null)}>
          <div className="sa-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px' }}>
            <div className="sa-modal-header">
              <h2>Pharmacist Details: {getName(viewing)}</h2>
              <button type="button" className="sa-modal-close" onClick={() => setViewing(null)} aria-label="Close">
                &times;
              </button>
            </div>
            <div className="sa-modal-body">
              <div className="sa-modal-grid">
                <div className="sa-modal-field">
                  <label>Full Name</label>
                  <span>{getName(viewing)}</span>
                </div>
                <div className="sa-modal-field">
                  <label>Pharmacist ID</label>
                  <span><code>{getId(viewing) || '-'}</code></span>
                </div>
                <div className="sa-modal-field">
                  <label>Email Address</label>
                  <span>{viewing?.email || viewing?.user?.email || viewing?.userId?.email || '-'}</span>
                </div>
                <div className="sa-modal-field">
                  <label>Phone Number</label>
                  <span>{getPhone(viewing) || '-'}</span>
                </div>
                <div className="sa-modal-field">
                  <label>Pharmacy</label>
                  <span>
                    {viewing?.pharmacyName ||
                      viewing?.pharmacy?.name ||
                      viewing?.PharmacyName ||
                      readStoredJson('pharmacyAdminAssignment')?.pharmacyName ||
                      readStoredJson('pharmacyAdminUser')?.pharmacyName ||
                      mainBranch?.pharmacyName ||
                      '-'}
                  </span>
                </div>
                <div className="sa-modal-field">
                  <label>Assigned Branch</label>
                  <span>
                    {(branchOptions.find((b) => String(branchIdOf(b)) === String(viewing?.branchId || viewing?.BranchId || viewing?.branch?.id))
                      ? branchNameOf(branchOptions.find((b) => String(branchIdOf(b)) === String(viewing?.branchId || viewing?.BranchId || viewing?.branch?.id)))
                      : '') ||
                      viewing?.branchName ||
                      viewing?.branch?.name ||
                      'Main Branch'}
                  </span>
                </div>
                <div className="sa-modal-field">
                  <label>Status</label>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: isPharmacistActive(viewing) ? '#16a34a' : '#dc2626' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: isPharmacistActive(viewing) ? '#16a34a' : '#dc2626' }} />
                    {getStatus(viewing)}
                  </span>
                </div>
                <div className="sa-modal-field">
                  <label>Role</label>
                  <span>{viewing?.role || 'Pharmacist'}</span>
                </div>
              </div>
            </div>
            <div className="sa-modal-footer">
              <button type="button" className="sa-btn-secondary" onClick={() => setViewing(null)}>
                Close
              </button>
              <button
                type="button"
                className="sa-btn-primary"
                onClick={() => {
                  const target = viewing
                  setViewing(null)
                  openEdit(target)
                }}
              >
                Edit Pharmacist
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AdminLayout>
  )
}

export default Users












