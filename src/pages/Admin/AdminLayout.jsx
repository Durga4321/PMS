import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import UserProfileMenu from '../../components/UserProfileMenu'
import { adminNavigation } from './adminNavigation'
import './AdminSidebar.css'
import './AdminTopbar.css'
import './admin.css'

function Icon({ children }) {
  return <svg className="admin-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">{children}</svg>
}

function AdminLayout({ activeLabel, title, subtitle, children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)

  return (
    <div className={`branch-admin-page${open ? ' branch-admin-sidebar-open' : ''}`}>
      <aside className="branch-admin-sidebar" aria-label="Admin navigation">
        <div className="branch-admin-brand">
          <b>+</b>
          <div>
            <strong>PMS</strong>
            <small>Admin - Branch A</small>
          </div>
        </div>
        <nav>
          {adminNavigation.map(({ label, path, icon, color }) => (
            <button type="button" className={activeLabel === label || location.pathname === path ? 'active' : ''} onClick={() => navigate(path)} key={label}>
              <span className={`nav-icon nav-icon-${color}`} aria-hidden="true">{icon}</span>
              {label}
            </button>
          ))}
        </nav>
        <div className="branch-admin-sidebar-footer">
          <span>A</span>
          <div><strong>Admin</strong><small>Branch A</small><em>Online</em></div>
        </div>
      </aside>

      <main className="branch-admin-main">
        <header className="branch-admin-header">
          <button className="branch-admin-menu" type="button" onClick={() => setOpen(!open)}><Icon><path d="M4 6h16M4 12h16M4 18h16" /></Icon></button>
          <div className="branch-admin-title">
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <label className="branch-admin-top-search">
            <Icon><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></Icon>
            <input placeholder="Search dashboard, medicines, users, reports..." />
          </label>
          <button className="branch-admin-notification" type="button" aria-label="Notifications"><Icon><path d="M6 9a6 6 0 0 1 12 0c0 7 2 7 2 9H4c0-2 2-2-2-9" /><path d="M10 21h4" /></Icon></button>
          <UserProfileMenu roleType="pharmacy-admin" />
        </header>

        {children}
      </main>
    </div>
  )
}

export default AdminLayout
