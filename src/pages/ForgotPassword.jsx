import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import { useToast } from '../components/ToastProvider'
import { forgotPharmacistPassword, forgotPharmacyAdminPassword, forgotSuperAdminPassword } from '../config/api'

const forgotPasswordFlows = [
  { role: 'super-admin', request: forgotSuperAdminPassword },
  { role: 'pharmacy-admin', request: forgotPharmacyAdminPassword },
  { role: 'pharmacist', request: forgotPharmacistPassword },
]

function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const navigate = useNavigate()
  const { showToast } = useToast()

  async function handleSubmit(event) {
    event.preventDefault()
    setIsSubmitting(true)

    try {
      let resetFlow = null
      let lastError = null

      for (const flow of forgotPasswordFlows) {
        try {
          const response = await flow.request({ email })
          resetFlow = { ...flow, response }
          break
        } catch (flowError) {
          lastError = flowError
        }
      }

      if (!resetFlow) {
        throw new Error(lastError?.message || 'No account found for this email.')
      }

      showToast(resetFlow.response?.message || 'OTP sent successfully.')
      sessionStorage.setItem('passwordResetEmail', email)
      sessionStorage.setItem('passwordResetRole', resetFlow.role)
      navigate('/verify-otp')
    } catch (error) {
      showToast(error.message, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthLayout title="Forgot Password" subtitle="Enter your email to receive a secure OTP">
      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          Email ID
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Enter your registered email address"
            required
          />
        </label>
        <button type="submit" className="button-primary" disabled={isSubmitting}>
          {isSubmitting ? 'Sending...' : 'Next ->'}
        </button>
      </form>
      <div className="auth-footer">
        <Link to="/login" className="link-small">
          &lt;- Back to Login
        </Link>
      </div>
      <div className="auth-meta">2026 PMS | Secure Admin Access</div>
    </AuthLayout>
  )
}

export default ForgotPassword
