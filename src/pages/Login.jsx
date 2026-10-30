import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import { useToast } from '../components/ToastProvider'
import { getPharmacistAssignmentStatus, getPharmacyAdminAssignmentStatus, getPharmacyAdminAuthPermissions, loginUnifiedAuth } from '../config/api'
import { permissionSource } from '../config/permissions'

const loginFlows = [
  {
    role: 'super-admin',
    tokenKey: 'superAdminToken',
    userKey: 'superAdminUser',
    dashboardPath: '/super-admin/dashboard',
    aliases: ['super-admin', 'super admin', 'superadmin', 'pharmacy-super-admin', 'pharmacy super admin'],
  },
  {
    role: 'pharmacy-admin',
    tokenKey: 'pharmacyAdminToken',
    userKey: 'pharmacyAdminUser',
    assignmentKey: 'pharmacyAdminAssignment',
    assignment: getPharmacyAdminAssignmentStatus,
    dashboardPath: '/admin/dashboard',
    aliases: ['pharmacy-admin', 'pharmacy admin', 'admin', 'branch-admin', 'branch admin'],
  },
  {
    role: 'pharmacist',
    tokenKey: 'pharmacistToken',
    userKey: 'pharmacistUser',
    assignmentKey: 'pharmacistAssignment',
    assignment: getPharmacistAssignmentStatus,
    dashboardPath: '/pharmacist/dashboard',
    aliases: ['pharmacist', 'pharmacy', 'staff'],
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
  sessionStorage.removeItem('__pms_admin_pending_auth')
  sessionStorage.removeItem('workingBranchId')
  localStorage.removeItem('workingBranchId')
  sessionStorage.removeItem('workingPharmacyId')
  localStorage.removeItem('workingPharmacyId')
}

function unwrapLogin(data) {
  return data?.data?.user ? data.data : data?.data || data || {}
}

function normalizeRole(value) {
  return String(value || '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
}

function roleValuesFrom(source) {
  if (!source || typeof source !== 'object') return []

  const directValues = [
    source.role,
    source.roleName,
    source.userRole,
    source.userType,
    source.type,
    source.accountType,
    source.designation,
  ]
  const nestedValues = [source.role, source.roles, source.userRole]
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .filter((value) => value && typeof value === 'object')
    .flatMap((value) => [value.name, value.role, value.roleName, value.slug, value.type])

  return [...directValues, ...nestedValues].filter(Boolean)
}

function matchesFlow(flow, candidates) {
  return candidates.some((candidate) => {
    const normalized = normalizeRole(candidate)
    return flow.aliases.some((alias) => {
      const normalizedAlias = normalizeRole(alias)
      return normalized === normalizedAlias || normalized.includes(normalizedAlias)
    })
  })
}

function roleFrom(loginData, user, response) {
  const candidates = [
    ...roleValuesFrom(user),
    ...roleValuesFrom(loginData),
    ...roleValuesFrom(response),
    loginData?.superAdminToken || response?.superAdminToken ? 'super-admin' : '',
    loginData?.pharmacyAdminToken || response?.pharmacyAdminToken ? 'pharmacy-admin' : '',
    loginData?.pharmacistToken || response?.pharmacistToken ? 'pharmacist' : '',
    user?.isSuperAdmin || loginData?.isSuperAdmin ? 'super-admin' : '',
    user?.isPharmacyAdmin || loginData?.isPharmacyAdmin ? 'pharmacy-admin' : '',
    user?.isPharmacist || loginData?.isPharmacist ? 'pharmacist' : '',
  ].filter(Boolean)

  return loginFlows.find((flow) => matchesFlow(flow, candidates)) || loginFlows[1]
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

  // Drop very large string fields (e.g. base64 images) so the user record stays small
  function compactUser(value) {
    if (Array.isArray(value)) return value.map(compactUser)
    if (!value || typeof value !== 'object') return typeof value === 'string' && value.length > 20000 ? '' : value
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, compactUser(v)]))
  }

  // setItem that frees space from large non-auth cache entries when storage is full
  function safeSetItem(storage, key, value) {
    try {
      storage.setItem(key, value)
      return
    } catch (err) {
      if (!/quota/i.test(String(err?.name || err?.message))) throw err
    }
    const protectedKey = (k) => /token|assignment|user|auth/i.test(k)
    for (const store of [localStorage, sessionStorage]) {
      const entries = Object.keys(store)
        .filter((k) => !protectedKey(k))
        .map((k) => [k, (store.getItem(k) || '').length])
        .sort((a, b) => b[1] - a[1])
      for (const [k] of entries) {
        store.removeItem(k)
        try {
          storage.setItem(key, value)
          return
        } catch {}
      }
    }
    storage.setItem(key, value)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      clearAuthSession()
      const storage = remember ? localStorage : sessionStorage
      const response = await loginUnifiedAuth({ email, password })
      const loginData = unwrapLogin(response)
      const user = loginData?.user || response?.user || { email }
      const flow = roleFrom(loginData, user, response)
      const token = loginData?.[flow.tokenKey] || response?.[flow.tokenKey] || loginData?.token || loginData?.accessToken || loginData?.jwt || response?.token || response?.accessToken

      if (!token) throw new Error('Login succeeded but token was not returned.')

      storage.setItem(flow.tokenKey, token)

      if (flow.role === 'pharmacy-admin') {
        sessionStorage.setItem('__pms_admin_pending_auth', JSON.stringify({ email, password }))
      }

      let storedUser = { ...user, role: user?.role || flow.role }
      if (flow.assignment) {
        try {
          const assignment = await flow.assignment()
          const assignmentData = assignment?.data || assignment
          // Merge with user data so pharmacyId is always populated
          const merged = {
            pharmacyId: assignmentData?.pharmacyId || assignmentData?.PharmacyId || user?.pharmacyId || user?.PharmacyId || assignmentData?.pharmacy?.id || assignmentData?.pharmacy?.pharmacyId || '',
            branchId: assignmentData?.branchId || assignmentData?.BranchId || assignmentData?.mainBranchId || user?.branchId || user?.BranchId || '',
            pharmacyName: assignmentData?.pharmacyName || assignmentData?.PharmacyName || user?.pharmacyName || '',
            ...assignmentData,
          }
          storage.setItem(flow.assignmentKey, JSON.stringify(merged))
          storedUser = { ...storedUser, ...merged, role: storedUser.role }
        } catch {
          // Assignment fetch failed — save what we can from the login user data
          const fallback = {
            pharmacyId: user?.pharmacyId || user?.PharmacyId || '',
            branchId: user?.branchId || user?.BranchId || user?.mainBranchId || '',
            pharmacyName: user?.pharmacyName || user?.PharmacyName || '',
          }
          if (fallback.pharmacyId) storage.setItem(flow.assignmentKey, JSON.stringify(fallback))
        }
      }

      if (flow.role === 'pharmacy-admin') {
        try {
          const permissionResponse = await getPharmacyAdminAuthPermissions()
          const permissionData = permissionResponse?.data || permissionResponse || {}
          const backendPermissions = permissionSource(permissionResponse) || permissionSource(permissionData)
          storedUser = {
            ...storedUser,
            permissions: backendPermissions || storedUser.permissions,
            modulePermissions: backendPermissions || storedUser.modulePermissions,
            role: permissionData.role || permissionResponse?.role || storedUser.role,
          }
        } catch {}
      }

      safeSetItem(storage, flow.userKey, JSON.stringify(compactUser(storedUser)))

      showToast('Welcome back to your dashboard.', 'success', response?.message || loginData?.message || 'Login successful')
      navigate(flow.dashboardPath, { replace: true })
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
          <input type="email" name="login-email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Enter email" autoComplete="off" required />
        </label>
        <label>
          Password
          <span className="auth-password-field">
            <input type={showPassword ? 'text' : 'password'} name="login-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter password" autoComplete="new-password" required />
            <button type="button" className="auth-password-toggle" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'} title={showPassword ? 'Hide password' : 'Show password'}>
              <PasswordIcon visible={showPassword} />
            </button>
          </span>
        </label>
        {error ? <div className="form-error" role="alert">{error}</div> : null}
        <div className="auth-row">
          <label className="checkbox-row"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />Remember Me</label>
          <Link to="/forgot-password" className="link-small">Forgot Password?</Link>
        </div>
        <button type="submit" className="button-primary" disabled={isSubmitting}>{isSubmitting ? 'Signing in...' : 'Login ->'}</button>
      </form>
      <div className="auth-meta">Your data is secure with us | Terms & Conditions | Privacy Policy | Version 1.0.0</div>
    </AuthLayout>
  )
}

export default Login



