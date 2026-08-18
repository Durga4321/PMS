import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../../components/ToastProvider'
import { changePharmacyAdminPassword } from '../../config/api'
import SuperAdminSidebar from './SuperAdminSidebar'
import './SuperAdminTopbar.css'
import './SuperAdminProfile.css'

function Icon({ children }) {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">{children}</svg>
}

function readStoredUser(key) {
  const value = sessionStorage.getItem(key) || localStorage.getItem(key)
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return { email: value }
  }
}

function SuperAdminProfile({ initialTab = 'profile', roleType = 'super-admin' }) {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [tab, setTab] = useState(initialTab)
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const isPharmacyAdmin = roleType === 'pharmacy-admin'

  useEffect(() => setTab(initialTab), [initialTab])

  const user = readStoredUser(isPharmacyAdmin ? 'pharmacyAdminUser' : 'superAdminUser')
  const name = user?.name || user?.fullName || (isPharmacyAdmin ? 'Admin' : 'Super Admin')
  const email = user?.email || (isPharmacyAdmin ? 'admin@gmail.com' : 'superadmin@gmail.com')
  const roleLabel = isPharmacyAdmin ? 'Admin' : 'Super Admin'
  const initials = isPharmacyAdmin ? 'AD' : 'SA'
  const profilePath = isPharmacyAdmin ? '/admin/profile' : '/super-admin/profile'
  const passwordPath = isPharmacyAdmin ? '/admin/change-password' : '/super-admin/change-password'

  async function updatePassword(event) {
    event.preventDefault()
    if (!form.currentPassword || !form.newPassword || !form.confirmPassword) {
      showToast('Please fill all password fields.', 'error')
      return
    }
    if (form.newPassword !== form.confirmPassword) {
      showToast('New password and confirm password must match.', 'error')
      return
    }

    try {
      await changePharmacyAdminPassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      })
      showToast('Password changed successfully.')
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (error) {
      showToast(error.message, 'error')
    }
  }

  function logout() {
    const keys = isPharmacyAdmin
      ? ['pharmacyAdminToken', 'pharmacyAdminUser', 'pharmacyAdminAssignment']
      : ['superAdminToken', 'superAdminUser']

    keys.forEach((key) => {
      sessionStorage.removeItem(key)
      localStorage.removeItem(key)
    })
    showToast('Logout successful.')
    navigate('/login')
  }

  return (
    <div className="profile-page">
      {isPharmacyAdmin ? <aside className="profile-sidebar">
        {isPharmacyAdmin ? (
          <>
            <div className="profile-brand"><b>PMS</b><div><strong>PMS</strong><small>{roleLabel} Console</small></div></div>
            <nav className="profile-side-nav">
              <button type="button" onClick={() => navigate('/admin/dashboard')}>Dashboard</button>
            </nav>
          </>
        ) : null}
        <div className="profile-sidebar-footer"><span>{initials}</span><div><strong>{name}</strong><small>{roleLabel}</small><em>Online</em></div></div>
      </aside> : <SuperAdminSidebar activeLabel="" />}
      <main className="profile-main">
        <header className="profile-topbar">
          <label className="profile-search"><Icon><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></Icon><input placeholder="Search dashboard, clinics, admins, reports..." /></label>
          <button className="profile-bell" type="button"><Icon><path d="M6 9a6 6 0 0 1 12 0c0 7 2 7 2 9H4c0-2 2-2-2-9" /><path d="M10 21h4" /></Icon><b>1</b></button>
          <button className="profile-pill" type="button"><span>{initials}</span><i />v</button>
        </header>
        <section className="profile-hero"><span>{initials}</span><div><h1>{name}</h1><p>{email}</p></div></section>
        <section className="profile-panel">
          <nav className="profile-tabs">
            <button className={tab === 'profile' ? 'active' : ''} onClick={() => { setTab('profile'); navigate(profilePath) }} type="button">My Profile</button>
            <button className={tab === 'password' ? 'active' : ''} onClick={() => { setTab('password'); navigate(passwordPath) }} type="button">Change Password</button>
            <button className="danger" onClick={logout} type="button">Logout</button>
          </nav>
          {tab === 'profile' ? (
            <div className="profile-details"><h2>My Profile</h2><div className="profile-detail-grid"><article><b>@</b><small>Email</small><strong>{email}</strong></article><article><b>#</b><small>Role</small><strong>{roleLabel}</strong></article><article><b>ID</b><small>Name</small><strong>{name}</strong></article></div></div>
          ) : (
            <form className="password-form" onSubmit={updatePassword}><h2>Change Password</h2><label>Current Password<input type="password" value={form.currentPassword} onChange={(event) => setForm({ ...form, currentPassword: event.target.value })} /></label><label>New Password<input type="password" value={form.newPassword} onChange={(event) => setForm({ ...form, newPassword: event.target.value })} /></label><ul><li>Minimum 8 characters</li><li>At least 1 uppercase letter (A-Z)</li><li>At least 1 lowercase letter (a-z)</li><li>At least 1 number (0-9)</li><li>At least 1 special character (@, #, $, %, etc.)</li></ul><label>Confirm Password<input type="password" value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} /></label><button type="submit">Update Password</button></form>
          )}
        </section>
      </main>
    </div>
  )
}

export default SuperAdminProfile
