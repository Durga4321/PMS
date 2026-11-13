import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { adminNavigation } from './adminNavigation'
import { hasPermission, readAdminPermissions } from '../../config/permissions'
import { useNotificationCount } from '../../services/notificationManager'
import './AdminSidebar.css'

function getStoredAppName() {
  try {
    const direct = localStorage.getItem('pms_app_name') || sessionStorage.getItem('pms_app_name')
    if (direct) return direct
    const raw = localStorage.getItem('pms_system_settings') || sessionStorage.getItem('pms_system_settings')
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed.appName) return parsed.appName
    }
  } catch {}
  return ''
}

function getStoredPharmacyTitle() {
  try {
    const assignment = JSON.parse(localStorage.getItem('pharmacyAdminAssignment') || sessionStorage.getItem('pharmacyAdminAssignment') || '{}')
    const user = JSON.parse(localStorage.getItem('pharmacyAdminUser') || sessionStorage.getItem('pharmacyAdminUser') || '{}')
    if (assignment?.pharmacyId && assignment?.pharmacyName) {
      return assignment.pharmacyName
    }
    if (user?.pharmacyId && user?.pharmacyName) {
      return user.pharmacyName
    }
  } catch {}
  return ''
}

function AdminSidebar({ activeLabel, hospitalName = 'PMS', branchName = 'Admin Console', adminName = 'Admin' }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [appName, setAppName] = useState(getStoredAppName)
  const [currentPharmacyName, setCurrentPharmacyName] = useState(() => getStoredPharmacyTitle() || branchName || 'Admin Console')
  const [permissions, setPermissions] = useState(readAdminPermissions)
  const unreadCount = useNotificationCount('pharmacyAdmin')

  useEffect(() => {
    function handleSettings(e) {
      const updated = e.detail?.appName !== undefined ? e.detail.appName : (typeof e.detail === 'string' ? e.detail : '')
      if (typeof updated === 'string' && updated.trim()) {
        setAppName(updated.trim())
      } else {
        setAppName(getStoredAppName())
      }
    }

    function handlePharmacySettings(e) {
      const detail = e.detail || {}
      if (detail.pharmacyName) {
        setCurrentPharmacyName(detail.pharmacyName)
      } else if (typeof detail === 'string') {
        setCurrentPharmacyName(detail)
      } else {
        const title = getStoredPharmacyTitle()
        if (title) setCurrentPharmacyName(title)
      }
    }

    function handlePermissionsUpdate() {
      setPermissions(readAdminPermissions())
    }

    window.addEventListener('pms:settings-updated', handleSettings)
    window.addEventListener('pms:settings-updated', handlePharmacySettings)
    window.addEventListener('pms:pharmacy-settings-updated', handlePharmacySettings)
    window.addEventListener('pms:appname-changed', handleSettings)
    window.addEventListener('pms:permissions-updated', handlePermissionsUpdate)
    window.addEventListener('storage', () => {
      handleSettings({})
      handlePharmacySettings({})
    })
    return () => {
      window.removeEventListener('pms:settings-updated', handleSettings)
      window.removeEventListener('pms:settings-updated', handlePharmacySettings)
      window.removeEventListener('pms:pharmacy-settings-updated', handlePharmacySettings)
      window.removeEventListener('pms:appname-changed', handleSettings)
      window.removeEventListener('pms:permissions-updated', handlePermissionsUpdate)
    }
  }, [])

  const visibleNavigation = adminNavigation.filter((item) =>
    item.label === 'Dashboard' ||
    item.label === 'Roles & Permissions' ||
    hasPermission(permissions, item.label, 'view')
  )

  return (
    <aside className="branch-admin-sidebar" aria-label="Admin navigation">
      {/* Brand Header */}
      <div className="branch-admin-brand" onClick={() => navigate('/admin/dashboard')} role="button" tabIndex={0}>
        <span className="branch-admin-brand-mark">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
        </span>
        <div className="branch-admin-brand-copy">
          <strong>{appName || hospitalName || 'PMS'}</strong>
          <small>{currentPharmacyName || branchName || 'Admin Console'}</small>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="branch-admin-nav">
        {visibleNavigation.map(({ label, path, icon, color }) => {
          const isActive = activeLabel === label || location.pathname === path
          const isNotification = label === 'Notifications'
          return (
            <button
              type="button"
              className={`branch-admin-nav-link nav-color-${color || 'blue'}${isActive ? ' is-active' : ''}`}
              onClick={() => navigate(path)}
              key={label}
            >
              <span className={`nav-icon-badge badge-${color || 'blue'}`}>
                {icon}
              </span>
              <span className="nav-label">{label}</span>
              {isNotification && unreadCount > 0 ? (
                <span className="sidebar-unread-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
              ) : null}
            </button>
          )
        })}
      </nav>
    </aside>
  )
}

export default AdminSidebar
