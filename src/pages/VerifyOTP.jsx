import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import { useToast } from '../components/ToastProvider'

function VerifyOTP() {
  const [otp, setOtp] = useState('')
  const navigate = useNavigate()
  const { showToast } = useToast()

  function handleSubmit(event) {
    event.preventDefault()
    showToast('OTP verified successfully.')
    navigate('/reset-password')
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
        <button type="submit" className="button-primary">
          Verify -&gt;
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
