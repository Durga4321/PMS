import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import UserProfileMenu from '../../components/UserProfileMenu'
import ThemeToggle from '../../components/ThemeToggle'
import NotificationBell from '../../components/NotificationBell'
import AdminSidebar from './AdminSidebar'
import { adminNavigation } from './adminNavigation'
import { hasPermission, readAdminPermissions } from '../../config/permissions'
import { getPharmacyAdminAssignmentStatus } from '../../config/api'
import './AdminTopbar.css'
import './admin.css'

function Icon({ children }) {
  return <svg className="branch-admin-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">{children}</svg>
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

function AdminLayout({ activeLabel, title, subtitle, headerAction, children }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [showResults, setShowResults] = useState(false)
  const [permissions, setPermissions] = useState(readAdminPermissions)
  const user = readStoredValue('pharmacyAdminUser') || {}
  const assignment = readStoredValue('pharmacyAdminAssignment') || {}
  const savedSettings = readStoredValue('pharmacySettings') || {}
  const adminName = user?.name || user?.fullName || user?.email || 'Admin'
  const [hospitalName, setHospitalName] = useState(() => assignment?.hospitalName || assignment?.hospital?.name || 'PMS')
  const [branchName, setBranchName] = useState(() => {
    if (assignment?.pharmacyId && assignment?.pharmacyName) return assignment.pharmacyName
    if (user?.pharmacyId && user?.pharmacyName) return user.pharmacyName
    return 'Admin Console'
  })

  useEffect(() => {
    function handlePermissionsUpdate() {
      setPermissions(readAdminPermissions())
    }
    function handleSettingsLive(e) {
      const detail = e.detail || readStoredValue('pharmacySettings') || {}
      if (detail.pharmacyName) {
        setBranchName(detail.pharmacyName)
      }
      if (detail.hospitalName) {
        setHospitalName(detail.hospitalName)
      }
    }
    window.addEventListener('pms:permissions-updated', handlePermissionsUpdate)
    window.addEventListener('pms:pharmacy-settings-updated', handleSettingsLive)
    window.addEventListener('pms:settings-updated', handleSettingsLive)
    window.addEventListener('storage', handleSettingsLive)
    return () => {
      window.removeEventListener('pms:permissions-updated', handlePermissionsUpdate)
      window.removeEventListener('pms:pharmacy-settings-updated', handleSettingsLive)
      window.removeEventListener('pms:settings-updated', handleSettingsLive)
      window.removeEventListener('storage', handleSettingsLive)
    }
  }, [])

  const visibleNavigation = useMemo(() => adminNavigation.filter((item) => item.label === 'Dashboard' || hasPermission(permissions, item.label, 'view')), [permissions])

  // Re-fetch and persist assignment on every page load so tenant headers (X-Pharmacy-Id) are always populated
  useEffect(() => {
    getPharmacyAdminAssignmentStatus()
      .then((res) => {
        const data = res?.data || res || {}
        const isAssigned = Boolean(data?.isPharmacyAssigned || data?.isAssigned)
        if (!isAssigned) {
          sessionStorage.removeItem('workingPharmacyId')
          localStorage.removeItem('workingPharmacyId')
          sessionStorage.removeItem('workingPharmacyName')
          localStorage.removeItem('workingPharmacyName')
          sessionStorage.removeItem('workingBranchId')
          localStorage.removeItem('workingBranchId')
          const emptyAssignment = { isPharmacyAssigned: false, pharmacyId: '', branchId: '', pharmacyName: '' }
          sessionStorage.setItem('pharmacyAdminAssignment', JSON.stringify(emptyAssignment))
          localStorage.setItem('pharmacyAdminAssignment', JSON.stringify(emptyAssignment))
          setBranchName('Admin Console')
          return
        }
        const existing = readStoredValue('pharmacyAdminAssignment') || {}
        const nestedAssignment = data?.assignment || data?.pharmacyAssignment || data?.assignedPharmacy || data?.tenant || {}
        const pharmacyRecord = data?.pharmacy || nestedAssignment?.pharmacy || nestedAssignment
        const branchRecord = data?.branch || nestedAssignment?.branch || {}
        const rawPharmId = data?.pharmacyId || data?.PharmacyId || data?.assignedPharmacyId || data?.AssignedPharmacyId || pharmacyRecord?.id || pharmacyRecord?.pharmacyId || ''
        const rawBranchId = data?.branchId || data?.BranchId || data?.mainBranchId || branchRecord?.id || branchRecord?.branchId || nestedAssignment?.mainBranchId || ''
        const rawPharmName = data?.pharmacyName || data?.PharmacyName || pharmacyRecord?.name || pharmacyRecord?.pharmacyName || ''
        const pharmacyId = rawPharmId ? String(rawPharmId) : ''
        const branchId = rawBranchId ? String(rawBranchId) : ''
        const pharmacyName = pharmacyId ? rawPharmName : ''
        const merged = { ...existing, ...data, ...(nestedAssignment && typeof nestedAssignment === 'object' ? nestedAssignment : {}), pharmacyId, branchId, pharmacyName, isPharmacyAssigned: Boolean(pharmacyId) }
        sessionStorage.setItem('pharmacyAdminAssignment', JSON.stringify(merged))
        localStorage.setItem('pharmacyAdminAssignment', JSON.stringify(merged))
        if (pharmacyId) {
          sessionStorage.setItem('workingPharmacyId', pharmacyId)
          localStorage.setItem('workingPharmacyId', pharmacyId)
        } else {
          sessionStorage.removeItem('workingPharmacyId')
          localStorage.removeItem('workingPharmacyId')
        }
        if (branchId) {
          sessionStorage.setItem('workingBranchId', branchId)
          localStorage.setItem('workingBranchId', branchId)
        } else {
          sessionStorage.removeItem('workingBranchId')
          localStorage.removeItem('workingBranchId')
        }
        if (pharmacyName) {
          sessionStorage.setItem('workingPharmacyName', pharmacyName)
          localStorage.setItem('workingPharmacyName', pharmacyName)
          setBranchName(pharmacyName)
        } else {
          sessionStorage.removeItem('workingPharmacyName')
          localStorage.removeItem('workingPharmacyName')
          setBranchName('Admin Console')
        }
      })
      .catch(() => {
        const existing = readStoredValue('pharmacyAdminAssignment') || {}
        if (!existing.isPharmacyAssigned) {
          sessionStorage.removeItem('workingPharmacyId')
          localStorage.removeItem('workingPharmacyId')
          sessionStorage.removeItem('workingPharmacyName')
          localStorage.removeItem('workingPharmacyName')
          sessionStorage.removeItem('workingBranchId')
          localStorage.removeItem('workingBranchId')
          setBranchName('Admin Console')
        }
      })
  }, [])
  
  const results = useMemo(() => {
    const value = query.trim().toLowerCase()
    if (!value) return visibleNavigation
    return visibleNavigation.filter((item) => item.label.toLowerCase().includes(value))
  }, [query, visibleNavigation])

  function goTo(path) {
    setQuery('')
    setShowResults(false)
    navigate(path)
  }

  function submitSearch(event) {
    event.preventDefault()
    if (results[0]) goTo(results[0].path)
  }

  function handleMenuToggle() {
    if (window.innerWidth <= 1024) {
      setOpen(!open)
    } else {
      const shell = document.querySelector('.branch-admin-page')
      if (shell) shell.classList.toggle('sidebar-collapsed')
    }
  }

  return (
    <div className={`branch-admin-page${open ? ' branch-admin-sidebar-open' : ''}`}>
      <AdminSidebar activeLabel={activeLabel} hospitalName={hospitalName} branchName={branchName} adminName={adminName} />

      <main className="branch-admin-main">
        <header className="branch-admin-header">
          <button className="branch-admin-menu" type="button" onClick={handleMenuToggle} aria-label="Toggle sidebar">
            <Icon><path d="M4 6h16M4 12h16M4 18h16" /></Icon>
          </button>
          
          <form
            className="branch-admin-top-search"
            onSubmit={submitSearch}
            onBlur={() => window.setTimeout(() => setShowResults(false), 120)}
          >
            <Icon><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></Icon>
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setShowResults(true)
              }}
              onFocus={() => setShowResults(true)}
              placeholder="Search dashboard, medicines, pharmacists, reports..."
            />
            {showResults ? (
              <div className="branch-admin-search-results">
                {results.length ? results.slice(0, 7).map((item) => (
                  <button type="button" key={item.path} onMouseDown={(event) => event.preventDefault()} onClick={() => goTo(item.path)}>
                    {item.label}
                  </button>
                )) : <span>No matching module</span>}
              </div>
            ) : null}
          </form>

          <div className="header-right-actions">
            <ThemeToggle />
            <NotificationBell role="pharmacyAdmin" path="/admin/notifications" />
            <UserProfileMenu roleType="pharmacy-admin" />
          </div>
        </header>

        {title && activeLabel !== 'Dashboard' ? (
          <section className="reference-heading-card admin-heading-card">
            <div className="reference-heading-accent" />
            <div className="admin-heading-text-wrap">
              <h1>{title}</h1>
              {subtitle ? <p>{subtitle}</p> : null}
            </div>
            {headerAction ? <div className="admin-heading-action">{headerAction}</div> : null}
          </section>
        ) : null}

        <div className={`branch-admin-content${activeLabel === 'Dashboard' ? ' is-dashboard' : ''}`}>
          {children}
        </div>
      </main>
    </div>
  )
}

export default AdminLayout
