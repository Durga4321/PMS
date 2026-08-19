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
          <input
            type="password"
            name="login-password"
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
