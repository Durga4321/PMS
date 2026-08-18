import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import { useToast } from '../components/ToastProvider'
import { verifyPharmacistResetOtp } from '../config/api'

function VerifyOTP() {
  const [otp, setOtp] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const navigate = useNavigate()
  const { showToast } = useToast()

  async function handleSubmit(event) {
    event.preventDefault()
    setIsSubmitting(true)
    const email = sessionStorage.getItem('passwordResetEmail')
    const role = sessionStorage.getItem('passwordResetRole') || 'pharmacist'

    try {
      if (role === 'pharmacist') {
        const response = await verifyPharmacistResetOtp({ email, otp })
        const resetToken = response?.resetToken || response?.token || response?.data?.resetToken || response?.data?.token
        if (resetToken) sessionStorage.setItem('passwordResetToken', resetToken)
        showToast(response?.message || 'OTP verified successfully.')
      } else {
        showToast('OTP verified successfully.')
      }

      navigate('/reset-password')
    } catch (error) {
      showToast(error.message, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthLayout title="Verify OTP" subtitle="Enter the one-time code sent to your email">
      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          OTP Code
          <input
            type="text"
            value={otp}
            onChange={(event) => setOtp(event.target.value)}
            placeholder="Enter verification code"
            inputMode="numeric"
            maxLength={6}
            required
          />
        </label>
        <button type="submit" className="button-primary" disabled={isSubmitting}>
          {isSubmitting ? 'Verifying...' : 'Verify ->'}
        </button>
      </form>
      <div className="auth-footer">
        <Link to="/forgot-password" className="link-small">
          &lt;- Back to Email
        </Link>
      </div>
      <div className="auth-meta">Check your inbox for the OTP and enter it to continue.</div>
    </AuthLayout>
  )
}

export default VerifyOTP
