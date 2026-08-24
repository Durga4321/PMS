import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import { useToast } from '../components/ToastProvider'
import { getPharmacistAssignmentStatus, getPharmacyAdminAssignmentStatus, loginPharmacist, loginPharmacyAdmin, loginSuperAdmin } from '../config/api'

const loginFlows = [
  {
    role: 'super-admin',
    login: loginSuperAdmin,
    tokenKey: 'superAdminToken',
    userKey: 'superAdminUser',
    dashboardPath: '/super-admin/dashboard',
  },
  {
    role: 'pharmacy-admin',
    login: loginPharmacyAdmin,
    tokenKey: 'pharmacyAdminToken',
    userKey: 'pharmacyAdminUser',
    assignmentKey: 'pharmacyAdminAssignment',
    assignment: getPharmacyAdminAssignmentStatus,
    dashboardPath: '/admin/dashboard',
  },
  {
    role: 'pharmacist',
    login: loginPharmacist,
    tokenKey: 'pharmacistToken',
    userKey: 'pharmacistUser',
    assignmentKey: 'pharmacistAssignment',
    assignment: getPharmacistAssignmentStatus,
    dashboardPath: '/pharmacist/dashboard',
  },
]

function PasswordIcon({ visible }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {visible ? (
        <>
          <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
        </>
      ) : (
        <>
          <path d="M3 3l18 18" />
          <path d="M10.7 5.2A10.7 10.7 0 0 1 12 5c6.5 0 10 7 10 7a18.6 18.6 0 0 1-3 4.1" />
          <path d="M14.1 14.1A3 3 0 0 1 9.9 9.9" />
          <path d="M6.6 6.6C3.8 8.5 2 12 2 12s3.5 7 10 7c1.5 0 2.8-.4 4-1" />
        </>
      )}
    </svg>
  )
}

function clearAuthSession() {
  loginFlows.forEach(({ tokenKey, userKey, assignmentKey }) => {
    sessionStorage.removeItem(tokenKey)
    sessionStorage.removeItem(userKey)
    localStorage.removeItem(tokenKey)
    localStorage.removeItem(userKey)
    if (assignmentKey) {
      sessionStorage.removeItem(assignmentKey)
      localStorage.removeItem(assignmentKey)
    }
  })
}

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
      clearAuthSession()
      const storage = remember ? localStorage : sessionStorage
      let authenticated = null
      let lastError = null

      for (const flow of loginFlows) {
        try {
          const data = await flow.login({ email, password })
          authenticated = { flow, data }
          break
        } catch (flowError) {
          lastError = flowError
        }
      }

      if (!authenticated) {
        throw new Error(lastError?.message || 'Invalid email or password.')
      }

      const { flow, data } = authenticated
      const token = data?.token || data?.accessToken || data?.data?.token || data?.data?.accessToken
      const user = data?.user || data?.data?.user || { email, role: flow.role }

      if (token) storage.setItem(flow.tokenKey, token)
      storage.setItem(flow.userKey, JSON.stringify(user))

      if (flow.assignment) {
        try {
          const assignment = await flow.assignment()
          storage.setItem(flow.assignmentKey, JSON.stringify(assignment?.data || assignment))
        } catch {
          storage.removeItem(flow.assignmentKey)
        }
      }

      showToast('Welcome back to your dashboard.', 'success', data?.message || 'Login successful')
      navigate(flow.dashboardPath)
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
          Email Address
          <input
            type="email"
            name="login-email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Enter email"
            autoComplete="off"
            required
          />
        </label>
        <label>
          Password
          <span className="auth-password-field">
            <input
              type={showPassword ? 'text' : 'password'}
              name="login-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter password"
              autoComplete="new-password"
              required
            />
            <button
              type="button"
              className="auth-password-toggle"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              <PasswordIcon visible={showPassword} />
            </button>
          </span>
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
