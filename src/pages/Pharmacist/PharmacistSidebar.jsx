import { useLocation, useNavigate } from 'react-router-dom'
import { pharmacistNavigation } from './pharmacistNavigation'
import './PharmacistSidebar.css'

function PharmacistSidebar({ activeLabel, pharmacistName = 'Pharmacist', branchName = 'Branch' }) {
  const navigate = useNavigate()
  const location = useLocation()

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
        {pharmacistNavigation.map(({ label, path, icon }) => (
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
      <div className="pharmacist-footer">
        <span>{pharmacistName.slice(0, 2).toUpperCase()}</span>
        <div><strong>{pharmacistName}</strong><small>{branchName}</small><em><i />Online</em></div>
      </div>
    </aside>
  )
}

export default PharmacistSidebar
