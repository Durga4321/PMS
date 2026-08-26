import { useLocation, useNavigate } from 'react-router-dom'
import { pharmacistNavigation } from './pharmacistNavigation'
import './PharmacistSidebar.css'

function readUser(keys) {
  for (const key of keys) {
    const value = sessionStorage.getItem(key) || localStorage.getItem(key)
    if (!value) continue
    try {
      return JSON.parse(value)
    } catch {
      return { email: value }
    }
  }
  return null
}

function getInitials(name) {
  const text = String(name || '').trim()
  if (!text) return 'PH'
  const parts = text.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

function PharmacistSidebar({ activeLabel }) {
  const navigate = useNavigate()
  const location = useLocation()

  const user = readUser(['pharmacistUser'])
  const assignment = readUser(['pharmacistAssignment'])
  
  const name = user?.name || user?.fullName || user?.email || 'Pharmacist'
  const branch = assignment?.branchName || assignment?.branch?.name || assignment?.pharmacyName || 'Main Branch'
  const initials = getInitials(name)

  return (
    <aside className="pharmacist-sidebar" aria-label="Pharmacist navigation">
      <div className="pharmacist-brand">
        <b>+</b>
        <div>
          <strong>PMS</strong>
          <small>Pharmacist Console</small>
        </div>
      </div>
      
      <nav>
        {pharmacistNavigation.map(({ label, path, icon }) => {
          const isActive = activeLabel === label || location.pathname === path
          return (
            <button
              type="button"
              className={isActive ? 'active' : ''}
              onClick={() => navigate(path)}
              key={label}
            >
              {icon}
              <span>{label}</span>
            </button>
          )
        })}
      </nav>

      {/* Wave pattern decoration */}
      <div className="sidebar-wave-decor">
        <svg viewBox="0 0 260 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0 60 C80 80 150 40 210 60 C240 70 250 85 260 80 L260 120 L0 120 Z" fill="#dbeafe" opacity="0.6"/>
          <path d="M0 80 C80 100 140 70 210 90 C230 95 250 110 260 105 L260 120 L0 120 Z" fill="#eff6ff" opacity="0.9"/>
        </svg>
      </div>

      <div className="pharmacist-footer">
        <div className="pharmacist-avatar-wrap">
          <span>{initials}</span>
        </div>
        <div className="pharmacist-footer-info">
          <strong>{name}</strong>
          <small>{branch}</small>
          <em><span className="footer-status-dot" />Online</em>
        </div>
      </div>
    </aside>
  )
}

export default PharmacistSidebar
