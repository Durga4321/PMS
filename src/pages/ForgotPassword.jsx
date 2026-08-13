import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'

function ForgotPassword() {
  const [email, setEmail] = useState('')
  const navigate = useNavigate()

  function handleSubmit(event) {
    event.preventDefault()
    navigate('/verify-otp')
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
        <button type="submit" className="button-primary">
          Next -&gt;
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
