import { useLocation, useNavigate } from 'react-router-dom'
import { adminNavigation } from './adminNavigation'
import './AdminSidebar.css'

function AdminSidebar({ activeLabel, hospitalName = 'PMS', branchName = 'Admin Console', adminName = 'Admin' }) {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <aside className="branch-admin-sidebar" aria-label="Admin navigation">
      <div className="branch-admin-brand">
        <b>+</b>
        <div>
          <strong>{hospitalName}</strong>
          <small>{branchName}</small>
        </div>
      </div>
      <nav>
        {adminNavigation.map(({ label, path, icon }) => (
          <button
            type="button"
            className={activeLabel === label || location.pathname === path ? 'active' : ''}
            onClick={() => navigate(path)}
            key={label}
          >
            {icon}
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="branch-admin-sidebar-footer">
        <span>{adminName.slice(0, 2).toUpperCase()}</span>
        <div><strong>{adminName}</strong><small>{branchName}</small><em><i />Online</em></div>
      </div>
    </aside>
  )
}

export default AdminSidebar
