import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const navigate = useNavigate()

  function handleSubmit(event) {
    event.preventDefault()
    navigate('/super-admin/dashboard')
  }

  return (
    <AuthLayout title="PMS Login" subtitle="Welcome back to your Pharmacy Management System">
      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          Email Address
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="admin@gmail.com"
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            required
          />
        </label>
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
        <button type="submit" className="button-primary">
          Login -&gt;
        </button>
      </form>
      <div className="auth-register-row">
        <p className="auth-register">New pharmacy staff?</p>
        <Link to="/forgot-password" className="create-account-btn create-account-btn--outline">
          Create Account
        </Link>
      </div>
      <div className="auth-meta">
        Your data is secure with us | Terms & Conditions | Privacy Policy | Version 1.0.0
      </div>
    </AuthLayout>
  )
}

export default Login
