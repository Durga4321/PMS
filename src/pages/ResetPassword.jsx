import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import { useToast } from '../components/ToastProvider'
import { resetForgottenPharmacistPassword } from '../config/api'

function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const navigate = useNavigate()
  const { showToast } = useToast()

  async function handleSubmit(event) {
    event.preventDefault()
    if (password !== confirmPassword) {
      setError('Passwords must match')
      showToast('Passwords must match', 'error')
      return
    }
    setError('')
    setIsSubmitting(true)
    const email = sessionStorage.getItem('passwordResetEmail')
    const role = sessionStorage.getItem('passwordResetRole') || 'pharmacist'
    const resetToken = sessionStorage.getItem('passwordResetToken')

    try {
      if (role === 'pharmacist') {
        const response = await resetForgottenPharmacistPassword({
          email,
          resetToken,
          token: resetToken,
          password,
          newPassword: password,
          confirmPassword,
        })
        showToast(response?.message || 'Password reset successful.')
      } else {
        showToast('Password reset successful.')
      }

      sessionStorage.removeItem('passwordResetEmail')
      sessionStorage.removeItem('passwordResetRole')
      sessionStorage.removeItem('passwordResetToken')
      navigate('/login')
    } catch (resetError) {
      setError(resetError.message)
      showToast(resetError.message, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthLayout title="Reset Password" subtitle="Set a strong password to protect your PMS access">
      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          New Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter new password"
            required
          />
        </label>
        <label>
          Confirm Password
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Re-enter new password"
            required
          />
        </label>
        {error && <div className="form-error">{error}</div>}
        <button type="submit" className="button-primary" disabled={isSubmitting}>
          {isSubmitting ? 'Resetting...' : 'Reset Password'}
        </button>
      </form>
      <div className="auth-footer">
        <Link to="/login" className="link-small">
          &lt;- Back to Login
        </Link>
      </div>
      <div className="auth-meta">Password reset successful. Return to login and sign in.</div>
    </AuthLayout>
  )
}

export default ResetPassword
