import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../../components/ToastProvider'
import { changePharmacyAdminPassword, changeSignedInPharmacistPassword, changeSuperAdminPassword } from '../../config/api'
import SuperAdminSidebar from './SuperAdminSidebar'
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
  const { showToast } = useToast()
  const [tab, setTab] = useState(initialTab)
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [errors, setErrors] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [submitted, setSubmitted] = useState(false)
  const isPharmacyAdmin = roleType === 'pharmacy-admin'
  const isPharmacist = roleType === 'pharmacist'

  useEffect(() => {
    setTab(initialTab)
    // Clear errors when tab changes
    setErrors({ currentPassword: '', newPassword: '', confirmPassword: '' })
    setSubmitted(false)
  }, [initialTab])

  const user = readStoredUser(isPharmacist ? 'pharmacistUser' : isPharmacyAdmin ? 'pharmacyAdminUser' : 'superAdminUser')
  const name = user?.name || user?.fullName || (isPharmacist ? 'Pharmacist' : isPharmacyAdmin ? 'Pilla Durga Prasad' : 'Super Admin')
  const email = user?.email || (isPharmacist ? 'pharmacist@gmail.com' : isPharmacyAdmin ? 'pilla.durgaprasad666@gmail.com' : 'superadmin@gmail.com')
  const roleLabel = isPharmacist ? 'Pharmacist' : isPharmacyAdmin ? 'Admin' : 'Super Admin'
  const initials = isPharmacist ? 'PH' : isPharmacyAdmin ? 'AD' : 'SA'
  const profilePath = isPharmacist ? '/pharmacist/profile' : isPharmacyAdmin ? '/admin/profile' : '/super-admin/profile'
  const passwordPath = isPharmacist ? '/pharmacist/change-password' : isPharmacyAdmin ? '/admin/change-password' : '/super-admin/change-password'

  function validateField(fieldName, val, otherVal) {
    if (!val) {
      return 'Please fill the box.'
    }
    if (fieldName === 'newPassword') {
      const hasMinLength = val.length >= 8
      const hasUpper = /[A-Z]/.test(val)
      const hasLower = /[a-z]/.test(val)
      const hasNumber = /[0-9]/.test(val)
      const hasSpecial = /[^A-Za-z0-9]/.test(val)

      if (!hasMinLength) return 'Password must contain at least 8 characters.'
      if (!hasUpper) return 'Password must contain at least 1 uppercase letter.'
      if (!hasLower) return 'Password must contain at least 1 lowercase letter.'
      if (!hasNumber) return 'Password must contain at least 1 number.'
      if (!hasSpecial) return 'Password must contain at least 1 special character.'
    }
    if (fieldName === 'confirmPassword') {
      if (val !== otherVal) {
        return 'Passwords do not match.'
      }
    }
    return ''
  }

  const handleInputChange = (field, value) => {
    const newForm = { ...form, [field]: value }
    setForm(newForm)
    if (submitted) {
      const otherVal = field === 'confirmPassword' ? newForm.newPassword : newForm.confirmPassword
      const err = validateField(field, value, otherVal)
      setErrors(prev => {
        const next = { ...prev, [field]: err }
        if (field === 'newPassword') {
          next.confirmPassword = validateField('confirmPassword', form.confirmPassword, value)
        }
        return next
      })
    }
  }

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
    <div className="profile-page">
      
      {/* Sidebar Navigation */}
      {isPharmacyAdmin ? (
        <aside className="profile-sidebar">
          <div className="profile-brand">
            <b>PMS</b>
            <div>
              <strong>PMS</strong>
              <small>{roleLabel} Console</small>
            </div>
          </div>
          
          <nav className="profile-side-nav">
            <button 
              className={tab === 'profile' ? 'active' : ''} 
              onClick={() => { setTab('profile'); navigate(profilePath) }} 
              type="button"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
              My Profile
            </button>
            <button 
              className={tab === 'password' ? 'active' : ''} 
              onClick={() => { setTab('password'); navigate(passwordPath) }} 
              type="button"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
              Change Password
            </button>
            <button 
              className="danger" 
              onClick={logout} 
              type="button"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
              Logout
            </button>
          </nav>

          {/* Bottom user card */}
          <div className="sidebar-user-card">
            <div className="sidebar-user-avatar-wrap">
              <span className="sidebar-user-avatar">{initials}</span>
              <span className="sidebar-user-dot" />
            </div>
            <div className="sidebar-user-info-text">
              <strong>{name}</strong>
              <small>{roleLabel}</small>
              <div className="sidebar-online-status">
                <span className="online-indicator-dot" />
                Online
              </div>
            </div>
          </div>
        </aside>
      ) : (
        <SuperAdminSidebar activeLabel="" />
      )}

      {/* Main Panel Canvas */}
      <main className="profile-main">
        <header className="profile-topbar">
          <label className="profile-search"><Icon><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></Icon><input placeholder="Search dashboard, clinics, admins, reports..." /></label>
          <button className="profile-bell" type="button"><Icon><path d="M6 9a6 6 0 0 1 12 0c0 7 2 7 2 9H4c0-2 2-2-2-9" /><path d="M10 21h4" /></Icon><b>1</b></button>
          <button className="profile-pill" type="button"><span>{initials}</span><i />v</button>
        </header>

        <div className="profile-content-wrap">
          {/* Profile Header banner */}
          <div className="profile-hero-banner">
            <div className="profile-banner-pattern" />
            <span className="profile-banner-avatar">{initials}</span>
            <div className="profile-banner-meta">
              <h1>{name}</h1>
              <p>{email}</p>
            </div>
          </div>

          <div className="profile-body-sections">
            {tab === 'profile' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                
                {/* 3 Information Cards */}
                <div>
                  <h3 className="section-title">My Profile Details</h3>
                  <div className="profile-info-cards-grid">
                    <div className="profile-info-accent-card teal-accent">
                      <div className="card-icon-wrap">
                        <svg viewBox="0 0 24 24" width="18" height="18"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                      </div>
                      <div className="card-details">
                        <label>Email Address</label>
                        <strong>{email}</strong>
                      </div>
                    </div>

                    <div className="profile-info-accent-card purple-accent">
                      <div className="card-icon-wrap">
                        <svg viewBox="0 0 24 24" width="18" height="18"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                      </div>
                      <div className="card-details">
                        <label>Role</label>
                        <strong>{roleLabel}</strong>
                      </div>
                    </div>

                    <div className="profile-info-accent-card blue-accent">
                      <div className="card-icon-wrap">
                        <svg viewBox="0 0 24 24" width="18" height="18"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      </div>
                      <div className="card-details">
                        <label>Full Name</label>
                        <strong>{name}</strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Actions List */}
                <div>
                  <h3 className="section-title">Quick Actions</h3>
                  <div className="profile-actions-grid">
                    <button 
                      type="button" 
                      className="profile-action-card hover-blue"
                      onClick={() => navigate(isPharmacyAdmin ? '/admin/dashboard' : '/super-admin/dashboard')}
                    >
                      <div className="action-icon-circle blue">
                        <svg viewBox="0 0 24 24" width="20" height="20"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>
                      </div>
                      <div className="action-meta">
                        <h4>View Dashboard</h4>
                        <p>Go to main dashboard</p>
                      </div>
                    </button>

                    <button 
                      type="button" 
                      className="profile-action-card hover-purple"
                      onClick={() => { setTab('password'); navigate(passwordPath) }}
                    >
                      <div className="action-icon-circle purple">
                        <svg viewBox="0 0 24 24" width="20" height="20"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                      </div>
                      <div className="action-meta">
                        <h4>Change Password</h4>
                        <p>Update your password</p>
                      </div>
                    </button>

                    <button 
                      type="button" 
                      className="profile-action-card hover-red"
                      onClick={logout}
                    >
                      <div className="action-icon-circle red">
                        <svg viewBox="0 0 24 24" width="20" height="20"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                      </div>
                      <div className="action-meta">
                        <h4>Logout</h4>
                        <p>Sign out from account</p>
                      </div>
                    </button>
                  </div>
                </div>

              </div>
            ) : (
              <form className="password-form" onSubmit={updatePassword}>
                <h2>Change Password</h2>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label>Current Password</label>
                  <input 
                    type="password" 
                    className={errors.currentPassword ? 'input-error' : ''} 
                    value={form.currentPassword} 
                    onChange={(event) => handleInputChange('currentPassword', event.target.value)} 
                  />
                  {errors.currentPassword && (
                    <span className="validation-error">
                      <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" strokeWidth="2.5" style={{ verticalAlign: 'middle' }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      {errors.currentPassword}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label>New Password</label>
                  <input 
                    type="password" 
                    className={errors.newPassword ? 'input-error' : ''} 
                    value={form.newPassword} 
                    onChange={(event) => handleInputChange('newPassword', event.target.value)} 
                  />
                  {errors.newPassword && (
                    <span className="validation-error">
                      <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" strokeWidth="2.5" style={{ verticalAlign: 'middle' }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      {errors.newPassword}
                    </span>
                  )}
                </div>

                <ul>
                  <li>Minimum 8 characters</li>
                  <li>At least 1 uppercase letter (A-Z)</li>
                  <li>At least 1 lowercase letter (a-z)</li>
                  <li>At least 1 number (0-9)</li>
                  <li>At least 1 special character (@, #, $, %, etc.)</li>
                </ul>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label>Confirm Password</label>
                  <input 
                    type="password" 
                    className={errors.confirmPassword ? 'input-error' : ''} 
                    value={form.confirmPassword} 
                    onChange={(event) => handleInputChange('confirmPassword', event.target.value)} 
                  />
                  {errors.confirmPassword && (
                    <span className="validation-error">
                      <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" strokeWidth="2.5" style={{ verticalAlign: 'middle' }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      {errors.confirmPassword}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                  <button type="submit" className="profile-dashboard-btn" style={{ background: '#2563eb' }}>Update Password</button>
                  <button type="button" className="med-btn med-btn-secondary" style={{ height: '46px' }} onClick={() => { setTab('profile'); navigate(profilePath) }}>Cancel</button>
                </div>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
