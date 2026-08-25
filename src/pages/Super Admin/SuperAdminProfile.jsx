import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useToast } from '../../components/ToastProvider'
import { changePharmacyAdminPassword, changeSignedInPharmacistPassword, changeSuperAdminPassword, getSuperAdminProfile } from '../../config/api'
import SuperAdminSidebar from './SuperAdminSidebar'
import SuperAdminTopbar from './SuperAdminTopbar'
import './SuperAdminTopbar.css'
import './SuperAdminProfile.css'

function Icon({ children }) {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
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

export default function SuperAdminProfile({ initialTab = 'profile', roleType = 'super-admin' }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { showToast } = useToast()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [tab, setTab] = useState(initialTab)
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [errors, setErrors] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [submitted, setSubmitted] = useState(false)
  const isPharmacyAdmin = roleType === 'pharmacy-admin'
  const isPharmacist = roleType === 'pharmacist'
  const [profileUser, setProfileUser] = useState(null)

  const routeTab = searchParams.get('tab') === 'password' ? 'password' : initialTab

  useEffect(() => setTab(routeTab), [routeTab])

  useEffect(() => {
    if (isPharmacyAdmin || isPharmacist) return
    let active = true
    getSuperAdminProfile()
      .then((response) => {
        const data = response?.data?.user || response?.data || response?.user || response
        if (active) setProfileUser(data)
      })
      .catch(() => {})
    return () => { active = false }
  }, [isPharmacyAdmin, isPharmacist])

  const user = profileUser || readStoredUser(isPharmacyAdmin ? 'pharmacyAdminUser' : 'superAdminUser')
  const name = user?.name || user?.fullName || (isPharmacyAdmin ? 'Admin' : 'Super Admin')
  const email = user?.email || (isPharmacyAdmin ? 'admin@gmail.com' : 'superadmin@gmail.com')
  const roleLabel = isPharmacyAdmin ? 'Admin' : 'Super Admin'
  const initials = isPharmacyAdmin ? 'AD' : 'SA'
  const profilePath = isPharmacyAdmin ? '/admin/profile' : '/profile'
  const passwordPath = isPharmacyAdmin ? '/admin/change-password' : '/profile?tab=password'

  async function updatePassword(event) {
    event.preventDefault()
    setSubmitted(true)

    const curErr = validateField('currentPassword', form.currentPassword)
    const newErr = validateField('newPassword', form.newPassword)
    const confErr = validateField('confirmPassword', form.confirmPassword, form.newPassword)

    setErrors({
      currentPassword: curErr,
      newPassword: newErr,
      confirmPassword: confErr
    })

    if (curErr || newErr || confErr) {
      return
    }

    try {
      const changePassword = isPharmacist ? changeSignedInPharmacistPassword : isPharmacyAdmin ? changePharmacyAdminPassword : changeSuperAdminPassword
      await changePassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      })
      showToast('Password changed successfully.')
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setSubmitted(false)
      setErrors({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (error) {
      showToast(error.message, 'error')
    }
  }

  function logout() {
    const keys = isPharmacyAdmin
      ? ['pharmacyAdminToken', 'pharmacyAdminUser', 'pharmacyAdminAssignment']
      : isPharmacist
      ? ['pharmacistToken', 'pharmacistUser', 'pharmacistAssignment']
      : ['superAdminToken', 'superAdminUser']

    keys.forEach((key) => {
      sessionStorage.removeItem(key)
      localStorage.removeItem(key)
    })
    navigate('/login')
  }

  return (
    <div className={`profile-page${isPharmacyAdmin ? '' : ' profile-super-admin-shell'}${sidebarOpen ? ' sidebar-open' : ''}`}>
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
        {isPharmacyAdmin ? <header className="profile-topbar">
          <label className="profile-search"><Icon><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></Icon><input placeholder="Search dashboard, clinics, admins, reports..." /></label>
          <button className="profile-bell" type="button"><Icon><path d="M6 9a6 6 0 0 1 12 0c0 7 2 7 2 9H4c0-2 2-2-2-9" /><path d="M10 21h4" /></Icon><b>1</b></button>
          <button className="profile-pill" type="button"><span>{initials}</span><i />v</button>
        </header> : <SuperAdminTopbar onMenu={() => setSidebarOpen((value) => !value)} />}
        <section className="profile-hero"><button className="profile-back" type="button" onClick={() => navigate(isPharmacyAdmin ? '/admin/dashboard' : '/super-admin/dashboard')}>Back</button><span>{initials}</span><div><h1>{name}</h1><p>{email}</p></div></section>
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
