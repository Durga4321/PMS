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

function getMenuIcon(label, isActive) {
  const name = String(label).toLowerCase()
  if (name.includes('dashboard')) {
    const color = '#3b82f6'
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" stroke={color} fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/>
        <rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    )
  }
  if (name.includes('pending')) {
    const color = isActive ? '#3b82f6' : '#8b5cf6'
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" stroke={color} fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
    )
  }
  if (name.includes('dispensing')) {
    const color = isActive ? '#3b82f6' : '#0d9488'
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" stroke={color} fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 2v7.5M14 2v7.5M8.5 6h7M6 9.5a3.5 3.5 0 0 0 3.5 3.5h5a3.5 3.5 0 0 0 3.5-3.5v-2H6v2z M4.5 13L3 21h18l-1.5-8"/>
      </svg>
    )
  }
  if (name.includes('bills')) {
    const color = isActive ? '#3b82f6' : '#ec4899'
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" stroke={color} fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="4" width="16" height="16" rx="2"/>
        <line x1="9" y1="9" x2="15" y2="9"/>
        <line x1="9" y1="13" x2="15" y2="13"/>
      </svg>
    )
  }
  if (name.includes('returns')) {
    const color = isActive ? '#3b82f6' : '#f59e0b'
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" stroke={color} fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
    )
  }
  if (name.includes('reports')) {
    const color = isActive ? '#3b82f6' : '#10b981'
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" stroke={color} fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/>
        <line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    )
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
        {pharmacistNavigation.map(({ label, path }) => {
          const isActive = activeLabel === label || location.pathname === path
          return (
            <button
              type="button"
              className={isActive ? 'active' : ''}
              onClick={() => navigate(path)}
              key={label}
            >
              {getMenuIcon(label, isActive)}
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
