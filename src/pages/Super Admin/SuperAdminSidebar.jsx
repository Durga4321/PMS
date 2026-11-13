import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { superAdminNavigation } from '../../components/superAdminNavigation'
import { useNotificationCount } from '../../services/notificationManager'
import './SuperAdminSidebar.css'

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
  return 'PMS'
}

function readStoredUser() {
  const value = sessionStorage.getItem('superAdminUser') || localStorage.getItem('superAdminUser')
  if (!value) return {}
  try {
    return JSON.parse(value)
  } catch {
    return { email: value }
  }
}

function initials(value) {
  const text = String(value || '').trim()
  if (!text) return 'SA'
  const parts = text.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

function SuperAdminSidebar({ activeLabel = '' }) {
  const navigate = useNavigate()
  const location = useLocation()
  const user = readStoredUser()
  const name = user?.name || user?.fullName || user?.email || 'Super Admin'
  const [appName, setAppName] = useState(getStoredAppName)
  const unreadCount = useNotificationCount('superAdmin')

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
    return () => {
      window.removeEventListener('pms:settings-updated', handleSettings)
      window.removeEventListener('pms:appname-changed', handleSettings)
    }
  }, [])

  return (
    <aside className="super-admin-sidebar" aria-label="Super admin navigation">
      <div className="super-admin-brand">
        <span className="super-admin-brand-mark">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
        </span>
        <div className="super-admin-brand-copy">
          <strong>{appName || 'PMS'}</strong>
          <small>Admin Console</small>
        </div>
      </div>

      <nav className="super-admin-nav">
        {superAdminNavigation.map(({ label, path, icon, color }) => {
          const isActive = location.pathname === path || label === activeLabel
          const isNotification = label === 'Notifications'
          return (
            <button
              type="button"
              className={`super-admin-nav-link nav-color-${color || 'blue'}${isActive ? ' is-active' : ''}`}
              onClick={() => navigate(path)}
              key={label}
              title={label}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
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

export default SuperAdminSidebar
