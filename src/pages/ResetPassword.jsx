import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'

function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  function handleSubmit(event) {
    event.preventDefault()
    if (password !== confirmPassword) {
      setError('Passwords must match')
      return
    }
    setError('')
    navigate('/login')
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
        <button type="submit" className="button-primary">
          Reset Password
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
