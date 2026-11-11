import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { pharmacistNavigation } from './pharmacistNavigation'
import { hasPharmacistPermission, readPharmacistPermissions } from '../../config/permissions'
import '../Admin/AdminSidebar.css'
import './PharmacistSidebar.css'

function getStoredAppName() {
  try {
    const direct = localStorage.getItem('pms_app_name') || sessionStorage.getItem('pms_app_name')
    if (direct) return direct
    const raw = localStorage.getItem('pms_system_settings') || sessionStorage.getItem('pms_system_settings')
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed.appName) return parsed.appName
    }
  } catch { /* Use the default name when stored settings cannot be read. */ }
  return 'PMS'
}

function PharmacistSidebar({ activeLabel, onNavigate }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [appName, setAppName] = useState(getStoredAppName)
  const [permissions, setPermissions] = useState(readPharmacistPermissions)

  function goTo(path) {
    navigate(path)
    onNavigate?.()
  }

  useEffect(() => {
    function handleSettings(e) {
      const updated = e.detail?.appName !== undefined ? e.detail.appName : (typeof e.detail === 'string' ? e.detail : '')
      if (typeof updated === 'string' && updated.trim()) {
        setAppName(updated.trim())
      } else {
        setAppName(getStoredAppName())
      }
    }
    window.addEventListener('pms:settings-updated', handleSettings)
    window.addEventListener('pms:appname-changed', handleSettings)

    function handlePermissionsUpdate() {
      setPermissions(readPharmacistPermissions())
    }
    window.addEventListener('pms:permissions-updated', handlePermissionsUpdate)
    window.addEventListener('storage', handlePermissionsUpdate)

    return () => {
      window.removeEventListener('pms:settings-updated', handleSettings)
      window.removeEventListener('pms:appname-changed', handleSettings)
      window.removeEventListener('pms:permissions-updated', handlePermissionsUpdate)
      window.removeEventListener('storage', handlePermissionsUpdate)
    }
  }, [])

  const visibleNavigation = pharmacistNavigation.filter((item) =>
    item.label === 'Dashboard' || hasPharmacistPermission(permissions, item.label, 'view')
  )

  return (
    <aside className="branch-admin-sidebar pharmacist-sidebar" aria-label="Pharmacist navigation">
      {/* Brand Header */}
      <div className="branch-admin-brand" onClick={() => goTo('/pharmacist/dashboard')} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); goTo('/pharmacist/dashboard') } }} role="button" tabIndex={0}>
        <span className="branch-admin-brand-mark">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
        </span>
        <div className="branch-admin-brand-copy">
          <strong>{appName || 'PMS'}</strong>
          <small>Pharmacist Console</small>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="branch-admin-nav">
        {visibleNavigation.map(({ label, path, icon, color }) => {
          const isActive = activeLabel === label || location.pathname === path
          return (
            <button
              type="button"
              className={`branch-admin-nav-link nav-color-${color || 'blue'}${isActive ? ' is-active' : ''}`}
              onClick={() => goTo(path)}
              aria-current={isActive ? 'page' : undefined}
              key={label}
            >
              <span className={`nav-icon-badge badge-${color || 'blue'}`}>
                {icon}
              </span>
              <span className="nav-label">{label}</span>
            </button>
          )
        })}
      </nav>

    </aside>
  )
}

export default PharmacistSidebar
