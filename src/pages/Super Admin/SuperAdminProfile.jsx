import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../../components/ToastProvider'
import { superAdminNavigation } from '../../components/superAdminNavigation'
import { changePharmacyAdminPassword } from '../../config/api'
import './SuperAdminSidebar.css'
import './SuperAdminTopbar.css'
import './SuperAdminProfile.css'

function Icon({ children }) {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">{children}</svg>
}

function SuperAdminProfile({ initialTab = 'profile' }) {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [tab, setTab] = useState(initialTab)
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })

  useEffect(() => setTab(initialTab), [initialTab])

  const storedUser = sessionStorage.getItem('superAdminUser') || localStorage.getItem('superAdminUser')
  let user = null
  try {
    user = storedUser ? JSON.parse(storedUser) : null
  } catch {
    user = null
  }

  const name = user?.name || user?.fullName || 'Super Admin'
  const email = user?.email || 'superadmin@gmail.com'

  async function updatePassword(event) {
    event.preventDefault()
    if (form.newPassword !== form.confirmPassword) {
      showToast('New password and confirm password must match.', 'error')
      return
    }
    try {
      await changePharmacyAdminPassword(form)
      showToast('Password updated successfully.')
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (error) {
      showToast(error.message, 'error')
    }
  }

  function logout() {
    sessionStorage.clear()
    localStorage.removeItem('superAdminToken')
    localStorage.removeItem('superAdminUser')
    showToast('Logout successful.')
    navigate('/login')
  }

  return (
    <div className="profile-page">
      <aside className="profile-sidebar">
        <div className="profile-brand"><b>+</b><div><strong>PMS</strong><small>Super Admin Console</small></div></div>
        <nav className="profile-side-nav">
          {superAdminNavigation.map(({ label, path, icon, color }) => (
            <button type="button" onClick={() => navigate(path)} key={label}>
              <span className={`nav-icon nav-icon-${color}`} aria-hidden="true">{icon}</span>{label}
            </button>
          ))}
        </nav>
        <div className="profile-sidebar-footer"><span>SA</span><div><strong>{name}</strong><small>Super Admin</small><em>Online</em></div></div>
      </aside>
      <main className="profile-main">
        <header className="profile-topbar">
          <label className="profile-search"><Icon><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></Icon><input placeholder="Search dashboard, clinics, admins, reports..." /></label>
          <button className="profile-bell" type="button"><Icon><path d="M6 9a6 6 0 0 1 12 0c0 7 2 7 2 9H4c0-2 2-2-2-9" /><path d="M10 21h4" /></Icon><b>1</b></button>
          <button className="profile-pill" type="button"><span>SA</span><i />⌄</button>
        </header>
        <section className="profile-hero"><span>SA</span><div><h1>{name}</h1><p>{email}</p></div></section>
        <section className="profile-panel">
          <nav className="profile-tabs">
            <button className={tab === 'profile' ? 'active' : ''} onClick={() => { setTab('profile'); navigate('/profile') }} type="button">♙ My Profile</button>
            <button className={tab === 'password' ? 'active' : ''} onClick={() => { setTab('password'); navigate('/change-password') }} type="button">⚿ Change Password</button>
            <button className="danger" onClick={logout} type="button">↪ Logout</button>
          </nav>
          {tab === 'profile' ? (
            <div className="profile-details"><h2>My Profile</h2><div className="profile-detail-grid"><article><b>✉</b><small>Email</small><strong>{email}</strong></article><article><b>♢</b><small>Role</small><strong>Super Admin</strong></article><article><b>♙</b><small>Name</small><strong>{name}</strong></article></div></div>
          ) : (
            <form className="password-form" onSubmit={updatePassword}><h2>Change Password</h2><label>Current Password<input type="password" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} /></label><label>New Password<input type="password" value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} /></label><ul><li>Minimum 8 characters</li><li>At least 1 uppercase letter (A-Z)</li><li>At least 1 lowercase letter (a-z)</li><li>At least 1 number (0-9)</li><li>At least 1 special character (@, #, $, %, etc.)</li></ul><label>Confirm Password<input type="password" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} /></label><button type="submit">Update Password</button></form>
          )}
        </section>
      </main>
    </div>
  )
}

export default SuperAdminProfile
