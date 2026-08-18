import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import { useToast } from '../components/ToastProvider'
import { getPharmacistAssignmentStatus, getPharmacyAdminAssignmentStatus, loginPharmacist, loginPharmacyAdmin, loginSuperAdmin } from '../config/api'

function Login() {
  const [loginRole, setLoginRole] = useState('super-admin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const navigate = useNavigate()
  const { showToast } = useToast()

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const isPharmacyAdmin = loginRole === 'pharmacy-admin'
      const isPharmacist = loginRole === 'pharmacist'
      const data = await (isPharmacist ? loginPharmacist({ email, password }) : isPharmacyAdmin ? loginPharmacyAdmin({ email, password }) : loginSuperAdmin({ email, password }))
      const token = data?.token || data?.accessToken || data?.data?.token || data?.data?.accessToken
      const user = data?.user || data?.data?.user || { email }
      const storage = remember ? localStorage : sessionStorage
      const tokenKey = isPharmacist ? 'pharmacistToken' : isPharmacyAdmin ? 'pharmacyAdminToken' : 'superAdminToken'
      const userKey = isPharmacist ? 'pharmacistUser' : isPharmacyAdmin ? 'pharmacyAdminUser' : 'superAdminUser'

      if (token) {
        storage.setItem(tokenKey, token)
      }

      storage.setItem(userKey, JSON.stringify(user))

      if (isPharmacyAdmin) {
        try {
          const assignment = await getPharmacyAdminAssignmentStatus()
          storage.setItem('pharmacyAdminAssignment', JSON.stringify(assignment?.data || assignment))
        } catch {
          storage.removeItem('pharmacyAdminAssignment')
        }
      }

      if (isPharmacist) {
        try {
          const assignment = await getPharmacistAssignmentStatus()
          storage.setItem('pharmacistAssignment', JSON.stringify(assignment?.data || assignment))
        } catch {
          storage.removeItem('pharmacistAssignment')
        }
      }

      showToast(data?.message || 'Login successful.')
      navigate(isPharmacist ? '/pharmacist/dashboard' : isPharmacyAdmin ? '/admin/dashboard' : '/super-admin/dashboard')
    } catch (loginError) {
      setError(loginError.message)
      showToast(loginError.message, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthLayout title="PMS Login" subtitle="Welcome back to your Pharmacy Management System">
      <form className="auth-form" onSubmit={handleSubmit} autoComplete="off">
        <label>
          Login Role
          <select value={loginRole} onChange={(event) => setLoginRole(event.target.value)}>
            <option value="super-admin">Super Admin</option>
            <option value="pharmacy-admin">Pharmacy Admin</option>
            <option value="pharmacist">Pharmacist</option>
          </select>
        </label>
        <label>
          Email Address
          <input
            type="email"
            name={`${loginRole}-login-email`}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Enter email"
            autoComplete="off"
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            name={`${loginRole}-login-password`}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter password"
            autoComplete="new-password"
            required
          />
        </label>
        {error ? <div className="form-error" role="alert">{error}</div> : null}
        <div className="auth-row">
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
            />
            Remember Me
          </label>
          <Link to="/forgot-password" className="link-small">
            Forgot Password?
          </Link>
        </div>
        <button type="submit" className="button-primary" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in...' : 'Login ->'}
        </button>
      </form>
      <div className="auth-meta">
        Your data is secure with us | Terms & Conditions | Privacy Policy | Version 1.0.0
      </div>
    </AuthLayout>
  )
}

export default Login
