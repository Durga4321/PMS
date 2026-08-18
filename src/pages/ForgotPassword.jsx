import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import { useToast } from '../components/ToastProvider'
import { forgotPharmacistPassword } from '../config/api'

function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('pharmacist')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const navigate = useNavigate()
  const { showToast } = useToast()

  async function handleSubmit(event) {
    event.preventDefault()
    setIsSubmitting(true)

    try {
      if (role === 'pharmacist') {
        const response = await forgotPharmacistPassword({ email })
        showToast(response?.message || 'OTP sent successfully.')
      } else {
        showToast('OTP sent successfully.')
      }

      sessionStorage.setItem('passwordResetEmail', email)
      sessionStorage.setItem('passwordResetRole', role)
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
          Reset Role
          <select value={role} onChange={(event) => setRole(event.target.value)}>
            <option value="pharmacist">Pharmacist</option>
            <option value="admin">Admin</option>
          </select>
        </label>
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
