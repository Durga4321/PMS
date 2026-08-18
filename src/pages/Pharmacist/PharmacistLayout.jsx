import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import UserProfileMenu from '../../components/UserProfileMenu'
import { pharmacistNavigation } from './pharmacistNavigation'
import './PharmacistSidebar.css'
import './PharmacistTopbar.css'
import './pharmacist.css'

function Icon({ children }) { return <svg className="admin-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">{children}</svg> }

function PharmacistLayout({ activeLabel, title, subtitle, children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  return <div className={`pharmacist-page${open ? ' sidebar-open' : ''}`}><aside className="pharmacist-sidebar"><div className="pharmacist-brand"><b>+</b><div><strong>PMS</strong><small>Pharmacist</small></div></div><nav>{pharmacistNavigation.map(({ label, path, icon, color }) => <button type="button" className={activeLabel === label || location.pathname === path ? 'active' : ''} onClick={() => navigate(path)} key={label}><span className={`nav-icon nav-icon-${color}`}>{icon}</span><span>{label}</span></button>)}</nav><div className="pharmacist-footer"><span>PH</span><div><strong>Pharmacist</strong><small>Branch</small><em>Online</em></div></div></aside><main className="pharmacist-main"><header className="pharmacist-header"><button className="topbar-menu" type="button" onClick={() => setOpen(!open)}><Icon><path d="M4 6h16M4 12h16M4 18h16" /></Icon></button><div className="pharmacist-title"><h1>{title}</h1><p>{subtitle}</p></div><label className="pharmacist-search"><Icon><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></Icon><input placeholder="Search pharmacist workspace..." /></label><button className="pharmacist-bell" type="button"><Icon><path d="M6 9a6 6 0 0 1 12 0c0 7 2 7 2 9H4c0-2 2-2-2-9" /></Icon><b>3</b></button><UserProfileMenu roleType="pharmacist" /></header>{children}</main></div>
}

export default PharmacistLayout
