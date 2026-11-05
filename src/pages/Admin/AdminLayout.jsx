import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import UserProfileMenu from '../../components/UserProfileMenu'
import ThemeToggle from '../../components/ThemeToggle'
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
  const [hospitalName, setHospitalName] = useState(() => assignment?.hospitalName || assignment?.hospital?.name || assignment?.clinicName || assignment?.clinic?.name || 'PMS')
  const [branchName, setBranchName] = useState(() => {
    const assignedName = assignment?.pharmacyName || assignment?.pharmacy?.name || user?.pharmacyName || assignment?.branchName || assignment?.branch?.name
    if (assignedName && String(assignedName).trim().toLowerCase() !== 'goutham pharmacy') return assignedName
    const scope = user?.adminId || user?.id || user?.email || 'default'
    const scopedSettingsKey = `pharmacySettings_admin_${String(scope).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_')}`
    const scopedSettings = readStoredValue(scopedSettingsKey) || {}
    if (scopedSettings?.pharmacyName && String(scopedSettings.pharmacyName).trim().toLowerCase() !== 'goutham pharmacy') return scopedSettings.pharmacyName
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
        const existing = readStoredValue('pharmacyAdminAssignment') || {}
        const nestedAssignment = data?.assignment || data?.pharmacyAssignment || data?.assignedPharmacy || data?.tenant || {}
        const pharmacyRecord = data?.pharmacy || nestedAssignment?.pharmacy || nestedAssignment
        const branchRecord = data?.branch || nestedAssignment?.branch || {}
        const pharmacyId = data?.pharmacyId || data?.PharmacyId || data?.assignedPharmacyId || data?.AssignedPharmacyId || pharmacyRecord?.id || pharmacyRecord?.pharmacyId || existing.pharmacyId || ''
        const branchId = data?.branchId || data?.BranchId || data?.mainBranchId || branchRecord?.id || branchRecord?.branchId || nestedAssignment?.mainBranchId || existing.branchId || ''
        const merged = { ...existing, ...data, ...(nestedAssignment && typeof nestedAssignment === 'object' ? nestedAssignment : {}), pharmacyId: String(pharmacyId), branchId: String(branchId) }
        sessionStorage.setItem('pharmacyAdminAssignment', JSON.stringify(merged))
        localStorage.setItem('pharmacyAdminAssignment', JSON.stringify(merged))
        sessionStorage.setItem('workingPharmacyId', String(pharmacyId))
        localStorage.setItem('workingPharmacyId', String(pharmacyId))
        sessionStorage.setItem('workingBranchId', String(branchId))
        localStorage.setItem('workingBranchId', String(branchId))
      })
      .catch(() => {
        const existing = readStoredValue('pharmacyAdminAssignment') || {}
        const pharmacyId = existing.pharmacyId || ''
        const branchId = existing.branchId || ''
        sessionStorage.setItem('workingPharmacyId', String(pharmacyId))
        localStorage.setItem('workingPharmacyId', String(pharmacyId))
        sessionStorage.setItem('workingBranchId', String(branchId))
        localStorage.setItem('workingBranchId', String(branchId))
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
            <button className="branch-admin-notification" type="button" aria-label="Notifications" title="Notifications" onClick={() => navigate('/admin/expiry-alerts')}>
              <Icon><path d="M6 9a6 6 0 0 1 12 0c0 7 2 7 2 9H4c0-2 2-2 2-9" /><path d="M10 21h4" /></Icon>
              <b className="unread-dot" />
            </button>
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
