import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { acceptSubscriptionInvitation } from '../config/api'
import { useToast } from '../components/ToastProvider'
import ThemeToggle from '../components/ThemeToggle'
import './PlanInquiry.css'

export default function AcceptInvitation() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { showToast } = useToast()

  const initialToken = searchParams.get('token') || ''
  const [token, setToken] = useState(initialToken)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const cleanToken = token.trim()
    if (!cleanToken) {
      setError('Please provide your invitation token.')
      return
    }

    if (!password) {
      setError('Please enter a password.')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    try {
      await acceptSubscriptionInvitation({
        token: cleanToken,
        password,
        confirmPassword,
      })

      showToast('Invitation accepted successfully! Please sign in to finish your pharmacy setup.', 'success')
      navigate('/login?accepted=true')
    } catch (err) {
      const msg = err.message || 'Unable to accept invitation. The token may be expired or invalid.'
      setError(msg)
      showToast(msg, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="plan-inquiry-page">
      <header className="plan-inquiry-header">
        <div className="plan-inquiry-header-inner">
          <Link className="pms-logo" to="/">
            <span className="pms-logo-mark">+</span>
            <span>
              <strong>PMS</strong>
              <small>Pharmacy Management System</small>
            </span>
          </Link>
          <div className="plan-inquiry-header-actions">
            <ThemeToggle />
            <Link className="plan-inquiry-back" to="/login">
              Staff Login →
            </Link>
          </div>
        </div>
      </header>

      <div className="plan-inquiry-container" style={{ maxWidth: '560px', margin: '40px auto' }}>
        <div className="plan-inquiry-title-wrap" style={{ textAlign: 'center', marginBottom: '28px' }}>
          <span className="pms-eyebrow">⌁ Pharmacy Admin Onboarding</span>
          <h1 style={{ fontSize: '28px' }}>Accept Subscription Invitation</h1>
          <p>
            Welcome to PMS! Set your administrative password below to activate your account and finish your pharmacy setup.
          </p>
        </div>

        <div style={{ background: '#ffffff', borderRadius: '16px', padding: '32px', boxShadow: '0 10px 30px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' }}>
          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '12px 16px', borderRadius: '10px', fontSize: '13px', marginBottom: '20px' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="plan-inquiry-field" style={{ marginBottom: '18px' }}>
              <label htmlFor="invitation-token" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Invitation Token *
              </label>
              <input
                id="invitation-token"
                type="text"
                required
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste your invitation token here"
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
              />
            </div>

            <div className="plan-inquiry-field" style={{ marginBottom: '18px' }}>
              <label htmlFor="invitation-password" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                New Password *
              </label>
              <input
                id="invitation-password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter at least 6 characters"
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
              />
            </div>

            <div className="plan-inquiry-field" style={{ marginBottom: '24px' }}>
              <label htmlFor="invitation-confirm" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Confirm Password *
              </label>
              <input
                id="invitation-confirm"
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="pms-primary"
              style={{ width: '100%', padding: '12px', fontSize: '15px', fontWeight: 700, borderRadius: '8px', cursor: submitting ? 'wait' : 'pointer' }}
            >
              {submitting ? 'Activating Account...' : 'Set Password & Activate Account →'}
            </button>
          </form>

          <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '13px', color: '#64748b' }}>
            Already set up your password? <Link to="/login" style={{ color: '#0d9488', fontWeight: 600 }}>Sign in here</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
