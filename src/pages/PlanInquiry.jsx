import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getSubscriptionPlans, fetchSubscriptionPlansFromServer } from '../services/subscriptionPlansService'
import { submitPlanInquiry } from '../services/planInquiryService'
import { useToast } from '../components/ToastProvider'
import ThemeToggle from '../components/ThemeToggle'
import './PlanInquiry.css'

function Logo() {
  return (
    <Link className="pms-logo" to="/">
      <span className="pms-logo-mark">+</span>
      <span>
        <strong>PMS</strong>
        <small>Pharmacy Management System</small>
      </span>
    </Link>
  )
}

export default function PlanInquiry() {
  const [searchParams] = useSearchParams()
  const { showToast } = useToast()
  const [allPlans, setAllPlans] = useState(() => getSubscriptionPlans().filter((p) => p.active !== false && p.active !== 'false'))

  useEffect(() => {
    fetchSubscriptionPlansFromServer().then((latest) => {
      if (Array.isArray(latest) && latest.length > 0) {
        setAllPlans(latest.filter((p) => p.active !== false && p.active !== 'false'))
      }
    })
    function onPlansUpdated(e) {
      if (Array.isArray(e.detail)) {
        setAllPlans(e.detail.filter((p) => p.active !== false && p.active !== 'false'))
      }
    }
    function onStorageChange(e) {
      if (!e.key || e.key === 'pms_subscription_plans_v2') {
        setAllPlans(getSubscriptionPlans().filter((p) => p.active !== false && p.active !== 'false'))
      }
    }
    window.addEventListener('pms:subscription-plans-updated', onPlansUpdated)
    window.addEventListener('storage', onStorageChange)
    return () => {
      window.removeEventListener('pms:subscription-plans-updated', onPlansUpdated)
      window.removeEventListener('storage', onStorageChange)
    }
  }, [])

  const initialPlanId = searchParams.get('plan') || (allPlans[0]?.id ?? 'starter')
  const initialCycle = searchParams.get('cycle') === 'yearly' ? 'yearly' : 'monthly'

  const [selectedPlanId, setSelectedPlanId] = useState(initialPlanId)
  const [billingCycle, setBillingCycle] = useState(initialCycle)

  useEffect(() => {
    if (allPlans.length > 0 && !allPlans.some((p) => p.id === selectedPlanId)) {
      setSelectedPlanId(allPlans[0].id)
    }
  }, [allPlans, selectedPlanId])
  const [submitting, setSubmitting] = useState(false)
  const [submittedData, setSubmittedData] = useState(null)

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    pharmacyName: '',
    city: '',
    branchCount: '1',
    message: '',
  })

  // Keep selected plan object in sync
  const currentPlan = useMemo(() => {
    return allPlans.find((p) => p.id === selectedPlanId) || allPlans[0] || {}
  }, [allPlans, selectedPlanId])

  const price = billingCycle === 'yearly' ? currentPlan.yearlyPrice : currentPlan.monthlyPrice

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (!form.fullName.trim()) {
      showToast('Please enter your full name', 'error')
      return
    }
    if (!form.email.trim() || !form.email.includes('@')) {
      showToast('Please enter a valid email address', 'error')
      return
    }
    if (!form.phone.trim()) {
      showToast('Please enter your phone number', 'error')
      return
    }
    if (!form.pharmacyName.trim()) {
      showToast('Please enter your pharmacy name', 'error')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        ...form,
        planId: currentPlan.id,
        planName: currentPlan.name,
        billingCycle,
        price,
      }

      await submitPlanInquiry(payload)
      setSubmittedData(payload)
      showToast('Your subscription inquiry has been sent directly to the Super Admin!', 'success')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      showToast('Unable to submit inquiry. Please try again.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="plan-inquiry-page">
      <header className="plan-inquiry-header">
        <div className="plan-inquiry-header-inner">
          <Logo />
          <div className="plan-inquiry-header-actions">
            <ThemeToggle />
            <Link className="plan-inquiry-back" to="/#pricing">
              ← Back to Pricing
            </Link>
          </div>
        </div>
      </header>

      <div className="plan-inquiry-container">
        {submittedData ? (
          <div className="plan-inquiry-success-card">
            <div className="plan-inquiry-success-icon">✓</div>
            <h2>Subscription Request Sent!</h2>
            <p>
              Thank you, <strong>{submittedData.fullName}</strong>. Your plan request for{' '}
              <strong>{submittedData.planName}</strong> has been transmitted directly to the{' '}
              <strong>Super Admin console</strong>. Our onboarding team will contact you shortly to activate your pharmacy.
            </p>

            <div className="plan-inquiry-summary-box">
              <div>
                <span>Selected Plan</span>
                <strong>{submittedData.planName}</strong>
              </div>
              <div>
                <span>Billing Cycle</span>
                <strong>{submittedData.billingCycle === 'yearly' ? 'Annual Billing' : 'Monthly Billing'}</strong>
              </div>
              <div>
                <span>Pharmacy / Organization</span>
                <strong>{submittedData.pharmacyName}</strong>
              </div>
              <div>
                <span>Estimated Rate</span>
                <strong>₹{Number(submittedData.price || 0).toLocaleString('en-IN')} / month</strong>
              </div>
              <div>
                <span>Contact Phone</span>
                <strong>{submittedData.phone}</strong>
              </div>
              <div>
                <span>Contact Email</span>
                <strong>{submittedData.email}</strong>
              </div>
            </div>

            <div className="plan-inquiry-success-actions">
              <Link className="pms-primary" to="/">
                ← Return to Home
              </Link>
              <Link className="pms-secondary" to="/login">
                Staff Login →
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="plan-inquiry-title-wrap">
              <span className="pms-eyebrow">⌁ Pharmacy Activation &amp; Onboarding</span>
              <h1>Choose Your Plan &amp; Connect with Super Admin</h1>
              <p>
                Fill in your details below. Your request goes directly to the Super Admin's dashboard notifications
                for instant review and account activation.
              </p>
            </div>

            <div className="plan-inquiry-layout">
              {/* Plan Overview Card (Left) */}
              <aside className="plan-inquiry-preview-card">
                {currentPlan.badge && (
                  <span className="plan-inquiry-preview-badge">{currentPlan.badge}</span>
                )}
                <header className="plan-inquiry-preview-header">
                  <h2>{currentPlan.name}</h2>
                  <p>{currentPlan.tagline}</p>
                </header>

                <div className="plan-inquiry-preview-price">
                  <strong>₹{Number(price || 0).toLocaleString('en-IN')}</strong>
                  <span>/ month</span>
                </div>

                <div className="plan-inquiry-preview-features-heading">Plan Inclusions:</div>
                <ul className="plan-inquiry-preview-features">
                  {(currentPlan.features || []).map((feat, idx) => {
                    const cleanFeat = String(feat || '')
                      .replace(/\s*\+\s*Cashier/gi, '')
                      .replace(/\bCashier\b/gi, '')
                      .replace(/\(\s*Pharmacist\s*\)/gi, '(Pharmacist)')
                      .trim()
                    return <li key={idx}>{cleanFeat}</li>
                  })}
                </ul>

                <div className="plan-inquiry-preview-trust">
                  ✓ 14-day trial &bull; Super Admin direct review &bull; Instant activation
                </div>
              </aside>

              {/* Inquiry Message Form (Right) */}
              <main className="plan-inquiry-form-card">
                <header className="plan-inquiry-form-header">
                  <h2>Send Plan Request to Super Admin</h2>
                  <p>Provide your pharmacy contact details and any special requirements.</p>
                </header>

                <form className="plan-inquiry-form" onSubmit={handleSubmit}>
                  {/* Plan & Cycle Selection */}
                  <div className="plan-inquiry-row">
                    <div className="plan-inquiry-field">
                      <label htmlFor="inquiry-plan">
                        Selected Plan <span>*</span>
                      </label>
                      <select
                        id="inquiry-plan"
                        value={selectedPlanId}
                        onChange={(e) => setSelectedPlanId(e.target.value)}
                        required
                      >
                        {allPlans.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} (₹{Number(billingCycle === 'yearly' ? p.yearlyPrice : p.monthlyPrice).toLocaleString('en-IN')}/mo)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="plan-inquiry-field">
                      <label>Billing Frequency</label>
                      <div className="plan-inquiry-cycle-picker" role="group" aria-label="Billing frequency">
                        <button
                          type="button"
                          aria-pressed={billingCycle === 'monthly'}
                          onClick={() => setBillingCycle('monthly')}
                        >
                          Monthly Billing
                        </button>
                        <button
                          type="button"
                          aria-pressed={billingCycle === 'yearly'}
                          onClick={() => setBillingCycle('yearly')}
                        >
                          Annual (Save 20%)
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Personal & Pharmacy Details */}
                  <div className="plan-inquiry-row">
                    <div className="plan-inquiry-field">
                      <label htmlFor="inquiry-name">
                        Full Name / Pharmacist Name <span>*</span>
                      </label>
                      <input
                        id="inquiry-name"
                        type="text"
                        required
                        placeholder="e.g. Dr. Rajesh Kumar"
                        value={form.fullName}
                        onChange={(e) => handleChange('fullName', e.target.value)}
                      />
                    </div>

                    <div className="plan-inquiry-field">
                      <label htmlFor="inquiry-pharmacy">
                        Pharmacy / Hospital Name <span>*</span>
                      </label>
                      <input
                        id="inquiry-pharmacy"
                        type="text"
                        required
                        placeholder="e.g. MedPlus City Care Pharmacy"
                        value={form.pharmacyName}
                        onChange={(e) => handleChange('pharmacyName', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="plan-inquiry-row">
                    <div className="plan-inquiry-field">
                      <label htmlFor="inquiry-email">
                        Work Email Address <span>*</span>
                      </label>
                      <input
                        id="inquiry-email"
                        type="email"
                        required
                        placeholder="e.g. rajesh@carepharmacy.in"
                        value={form.email}
                        onChange={(e) => handleChange('email', e.target.value)}
                      />
                    </div>

                    <div className="plan-inquiry-field">
                      <label htmlFor="inquiry-phone">
                        Phone / WhatsApp Mobile <span>*</span>
                      </label>
                      <input
                        id="inquiry-phone"
                        type="tel"
                        required
                        placeholder="e.g. +91 98765 43210"
                        value={form.phone}
                        onChange={(e) => handleChange('phone', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="plan-inquiry-row">
                    <div className="plan-inquiry-field">
                      <label htmlFor="inquiry-city">City / Branch Location</label>
                      <input
                        id="inquiry-city"
                        type="text"
                        placeholder="e.g. Hyderabad, Telangana"
                        value={form.city}
                        onChange={(e) => handleChange('city', e.target.value)}
                      />
                    </div>

                    <div className="plan-inquiry-field">
                      <label htmlFor="inquiry-branches">Number of Pharmacy Branches</label>
                      <select
                        id="inquiry-branches"
                        value={form.branchCount}
                        onChange={(e) => handleChange('branchCount', e.target.value)}
                      >
                        <option value="1">1 Single Location</option>
                        <option value="2-5">2 to 5 Branches</option>
                        <option value="6-15">6 to 15 Chain Branches</option>
                        <option value="15+">15+ Multi-Hospital Network</option>
                      </select>
                    </div>
                  </div>

                  {/* Row 5: Notes & Action aligned side-by-side */}
                  <div className="plan-inquiry-row plan-inquiry-row--action">
                    <div className="plan-inquiry-field">
                      <label htmlFor="inquiry-message">
                        Message / Special Requirements
                      </label>
                      <input
                        id="inquiry-message"
                        type="text"
                        placeholder="Special requirements, data migration, notes (optional)..."
                        value={form.message}
                        onChange={(e) => handleChange('message', e.target.value)}
                      />
                    </div>

                    <div className="plan-inquiry-field plan-inquiry-field--submit">
                      <label className="plan-inquiry-label-spacer" aria-hidden="true">&nbsp;</label>
                      <button
                        type="submit"
                        className="plan-inquiry-submit-btn"
                        disabled={submitting}
                      >
                        {submitting ? 'Sending Request...' : 'Send Request to Super Admin →'}
                      </button>
                    </div>
                  </div>
                </form>
              </main>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
