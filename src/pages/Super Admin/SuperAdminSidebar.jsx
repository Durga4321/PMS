import { useLocation, useNavigate } from 'react-router-dom'
import { superAdminNavigation } from '../../components/superAdminNavigation'
import './SuperAdminSidebar.css'

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

  return (
    <aside className="super-admin-sidebar" aria-label="Super admin navigation">
      <div className="super-admin-brand">
        <span className="super-admin-brand-mark">PMS</span>
        <div>
          <strong>PMS</strong>
          <small>Super Admin Console</small>
        </div>
      </div>

      <nav className="super-admin-nav">
        {superAdminNavigation.map(({ label, path, icon }) => (
          <button
            type="button"
            className={`super-admin-nav-link${location.pathname === path || label === activeLabel ? ' is-active' : ''}`}
            onClick={() => navigate(path)}
            key={label}
          >
            {icon}
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="super-admin-sidebar-footer">
        <span>{initials(name)}</span>
        <div>
          <strong>{name}</strong>
          <small>Super Admin</small>
          <em><i />Online</em>
        </div>
      </div>
    </aside>
  )
}

export default SuperAdminSidebar


