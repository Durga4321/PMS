import { useEffect, useState } from 'react'
import SuperAdminSidebar from './SuperAdminSidebar'
import SuperAdminTopbar from './SuperAdminTopbar'
import { useToast } from '../../components/ToastProvider'
import { confirmAction } from '../../components/confirmAction'
import {
  calculateSavingsPercent,
  DEFAULT_SUBSCRIPTION_PLANS,
  getSubscriptionPlans,
  resetSubscriptionPlans,
  saveSubscriptionPlans,
} from '../../services/subscriptionPlansService'
import './SubscriptionPlans.css'

export default function SubscriptionPlans() {
  const { showToast } = useToast()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [plans, setPlans] = useState(getSubscriptionPlans)
  const [previewCycle, setPreviewCycle] = useState('monthly')
  const [editingPlan, setEditingPlan] = useState(null)
  const [isNewPlan, setIsNewPlan] = useState(false)
  const [newFeatureText, setNewFeatureText] = useState('')

  useEffect(() => {
    function onPlansUpdated(e) {
      if (Array.isArray(e.detail)) {
        setPlans(e.detail)
      }
    }
    function onStorageChange(e) {
      if (!e.key || e.key === 'pms_subscription_plans_v2') {
        setPlans(getSubscriptionPlans())
      }
    }
    window.addEventListener('pms:subscription-plans-updated', onPlansUpdated)
    window.addEventListener('storage', onStorageChange)
    return () => {
      window.removeEventListener('pms:subscription-plans-updated', onPlansUpdated)
      window.removeEventListener('storage', onStorageChange)
    }
  }, [])

  const activePlansCount = plans.filter((p) => p.active !== false && p.active !== 'false').length
  const lowestMonthlyPrice = plans.length > 0 ? Math.min(...plans.map((p) => p.monthlyPrice)) : 0
  const maxSavings = plans.length > 0
    ? Math.max(...plans.map((p) => calculateSavingsPercent(p.monthlyPrice, p.yearlyPrice)))
    : 0

  function handleOpenAdd() {
    setIsNewPlan(true)
    setEditingPlan({
      id: `plan-${Date.now()}`,
      name: '',
      tagline: '',
      monthlyPrice: 1999,
      yearlyPrice: 1599,
      popular: false,
      badge: '',
      features: [
        '1 Pharmacy Branch / Location',
        'Staff Accounts & Access Controls',
        'Medicine Inventory Tracking',
        'POS Billing & Tax Invoices',
      ],
      ctaText: 'Get Started',
      ctaLink: '/login',
      active: true,
    })
    setNewFeatureText('')
  }

  function handleOpenEdit(plan) {
    setIsNewPlan(false)
    setEditingPlan(JSON.parse(JSON.stringify(plan)))
    setNewFeatureText('')
  }

  function handleCloseModal() {
    setEditingPlan(null)
    setIsNewPlan(false)
    setNewFeatureText('')
  }

  function handleSavePlan(e) {
    e.preventDefault()
    if (!editingPlan) return

    const trimmedName = String(editingPlan.name || '').trim()
    if (!trimmedName) {
      showToast('Please enter a plan name', 'error')
      return
    }

    const mPrice = Number(editingPlan.monthlyPrice)
    const yPrice = Number(editingPlan.yearlyPrice)

    if (isNaN(mPrice) || mPrice < 0) {
      showToast('Please enter a valid monthly price', 'error')
      return
    }
    if (isNaN(yPrice) || yPrice < 0) {
      showToast('Please enter a valid yearly price', 'error')
      return
    }

    let updatedPlans
    if (isNewPlan) {
      updatedPlans = [...plans, editingPlan]
    } else {
      updatedPlans = plans.map((p) => (p.id === editingPlan.id ? editingPlan : p))
    }

    const res = saveSubscriptionPlans(updatedPlans)
    if (res.success) {
      setPlans(res.plans)
      showToast(`Subscription plan "${trimmedName}" saved successfully!`, 'success')
      handleCloseModal()
    } else {
      showToast('Failed to save subscription plan.', 'error')
    }
  }

  async function handleToggleActive(plan) {
    const nextStatus = !plan.active
    const updated = plans.map((p) => (p.id === plan.id ? { ...p, active: nextStatus } : p))
    const res = saveSubscriptionPlans(updated)
    if (res.success) {
      setPlans(res.plans)
      showToast(`Plan "${plan.name}" is now ${nextStatus ? 'Active' : 'Hidden from landing page'}.`, 'success')
    }
  }

  async function handleDeletePlan(plan) {
    if (plans.length <= 1) {
      showToast('You must maintain at least one subscription plan.', 'warning')
      return
    }
    const confirmed = await confirmAction(`Are you sure you want to delete the "${plan.name}" plan?`, {
      title: 'Delete Subscription Plan',
      confirmLabel: 'Delete Plan',
    })
    if (!confirmed) return

    const updated = plans.filter((p) => p.id !== plan.id)
    const res = saveSubscriptionPlans(updated)
    if (res.success) {
      setPlans(res.plans)
      showToast(`Plan "${plan.name}" deleted successfully.`, 'success')
    }
  }

  async function handleResetDefaults() {
    const confirmed = await confirmAction(
      'This will restore Starter, Professional Chain, and Hospital Network plans to their original default prices and features.',
      {
        title: 'Reset to Default Plans?',
        confirmLabel: 'Reset Defaults',
      }
    )
    if (!confirmed) return

    const defaults = resetSubscriptionPlans()
    setPlans(defaults)
    showToast('Subscription plans restored to original defaults.', 'success')
  }

  function handleAddFeature() {
    const text = newFeatureText.trim()
    if (!text || !editingPlan) return
    setEditingPlan({
      ...editingPlan,
      features: [...(editingPlan.features || []), text],
    })
    setNewFeatureText('')
  }

  function handleUpdateFeature(index, text) {
    if (!editingPlan) return
    const updated = [...editingPlan.features]
    updated[index] = text
    setEditingPlan({ ...editingPlan, features: updated })
  }

  function handleDeleteFeature(index) {
    if (!editingPlan) return
    const updated = editingPlan.features.filter((_, i) => i !== index)
    setEditingPlan({ ...editingPlan, features: updated })
  }

  function handleMoveFeature(index, direction) {
    if (!editingPlan) return
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= editingPlan.features.length) return
    const updated = [...editingPlan.features]
    const temp = updated[index]
    updated[index] = updated[targetIndex]
    updated[targetIndex] = temp
    setEditingPlan({ ...editingPlan, features: updated })
  }

  return (
    <div className={`super-admin-shell subscription-plans-shell${sidebarOpen ? ' sidebar-open' : ''}`}>
      <SuperAdminSidebar activeLabel="Subscription Plans" />

      <main className="super-admin-main subscription-plans-main">
        <SuperAdminTopbar onMenu={() => setSidebarOpen((v) => !v)} />

        <div className="sub-plans-content">
          <header className="sub-plans-header">
            <div className="sub-plans-header-copy">
              <h1>Subscription Plans &amp; Pricing</h1>
              <p>Configure pricing, monthly/annual tiers, features, and marketing badges displayed on the public PMS landing page.</p>
            </div>
            <div className="sub-plans-header-actions">
              <button
                type="button"
                className="sub-btn sub-btn-secondary"
                onClick={handleResetDefaults}
                title="Reset to default plans and pricing"
              >
                ↺ Reset to Defaults
              </button>
              <button
                type="button"
                className="sub-btn sub-btn-primary"
                onClick={handleOpenAdd}
              >
                + Add New Plan
              </button>
            </div>
          </header>

          {/* KPI Summary Row */}
          <section className="sub-plans-stats">
            <article className="sub-stat-card">
              <div className="sub-stat-icon teal">▣</div>
              <div className="sub-stat-info">
                <strong>{plans.length}</strong>
                <span>Total Plans</span>
              </div>
            </article>

            <article className="sub-stat-card">
              <div className="sub-stat-icon blue">✓</div>
              <div className="sub-stat-info">
                <strong>{activePlansCount}</strong>
                <span>Active on Landing Page</span>
              </div>
            </article>

            <article className="sub-stat-card">
              <div className="sub-stat-icon amber">₹</div>
              <div className="sub-stat-info">
                <strong>₹{lowestMonthlyPrice.toLocaleString('en-IN')}</strong>
                <span>Starting Price / mo</span>
              </div>
            </article>

            <article className="sub-stat-card">
              <div className="sub-stat-icon purple">%</div>
              <div className="sub-stat-info">
                <strong>{maxSavings}%</strong>
                <span>Max Annual Savings</span>
              </div>
            </article>
          </section>

          {/* Toolbar with preview cycle switch */}
          <div className="sub-plans-toolbar">
            <div className="sub-plans-toolbar-info">
              <span>Displaying <strong>{plans.length} subscription plans</strong></span>
            </div>

            <div className="sub-preview-toggle-wrap">
              <span className="sub-preview-label">Live Preview Cycle:</span>
              <div className="sub-cycle-toggle" role="group" aria-label="Preview billing cycle">
                <button
                  type="button"
                  aria-pressed={previewCycle === 'monthly'}
                  onClick={() => setPreviewCycle('monthly')}
                >
                  Monthly View
                </button>
                <button
                  type="button"
                  aria-pressed={previewCycle === 'yearly'}
                  onClick={() => setPreviewCycle('yearly')}
                >
                  Annual View
                </button>
              </div>
            </div>
          </div>

          {/* Plans Grid */}
          <section className="sub-plans-grid">
            {plans.map((plan) => {
              const currentPrice = previewCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice
              const savings = calculateSavingsPercent(plan.monthlyPrice, plan.yearlyPrice)

              return (
                <article
                  key={plan.id}
                  className={`sub-plan-card${plan.popular ? ' sub-plan-card--popular' : ''}${!plan.active ? ' sub-plan-card--inactive' : ''}`}
                >
                  {plan.badge && <span className="sub-plan-badge">{plan.badge}</span>}

                  <span className={`sub-plan-status-pill ${plan.active ? 'active' : 'inactive'}`}>
                    {plan.active ? '● Active' : '○ Hidden'}
                  </span>

                  <header className="sub-plan-header">
                    <h3>{plan.name}</h3>
                    <p>{plan.tagline || 'No tagline configured.'}</p>
                  </header>

                  <div className="sub-plan-price-row">
                    <strong>₹{Number(currentPrice || 0).toLocaleString('en-IN')}</strong>
                    <span>/ month</span>
                  </div>

                  <div className="sub-plan-pricing-meta">
                    <small>
                      {previewCycle === 'yearly'
                        ? `Billed annually (Monthly: ₹${Number(plan.monthlyPrice || 0).toLocaleString('en-IN')})`
                        : `Annual rate: ₹${Number(plan.yearlyPrice || 0).toLocaleString('en-IN')}/mo`}
                    </small>
                    {savings > 0 && (
                      <span className="sub-savings-badge">Save {savings}%</span>
                    )}
                  </div>

                  <ul className="sub-plan-features-list">
                    {(plan.features || []).map((feat, idx) => {
                      const cleanFeat = String(feat || '')
                        .replace(/\s*\+\s*Cashier/gi, '')
                        .replace(/\bCashier\b/gi, '')
                        .replace(/\(\s*Pharmacist\s*\)/gi, '(Pharmacist)')
                        .trim()
                      return <li key={idx}>{cleanFeat}</li>
                    })}
                  </ul>

                  <div className={`sub-plan-preview-cta${plan.popular ? ' popular' : ''}`}>
                    {plan.ctaText} →
                  </div>

                  <div className="sub-plan-card-actions">
                    <button
                      type="button"
                      className="sub-card-edit-btn"
                      onClick={() => handleOpenEdit(plan)}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                      Edit Plan &amp; Pricing
                    </button>

                    <button
                      type="button"
                      className="sub-card-toggle-btn"
                      onClick={() => handleToggleActive(plan)}
                      title={plan.active ? 'Hide plan from landing page' : 'Make plan visible on landing page'}
                      aria-label={plan.active ? 'Hide plan' : 'Show plan'}
                    >
                      {plan.active ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                          <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                          <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                          <line x1="2" y1="2" x2="22" y2="22" />
                        </svg>
                      )}
                    </button>

                    {plans.length > 1 && (
                      <button
                        type="button"
                        className="sub-card-toggle-btn"
                        style={{ color: '#ef4444' }}
                        onClick={() => handleDeletePlan(plan)}
                        title="Delete plan"
                        aria-label="Delete plan"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18M8 6V4h8v2M5 6l1 14h12l1-14M10 10v6M14 10v6" />
                        </svg>
                      </button>
                    )}
                  </div>
                </article>
              )
            })}
          </section>
        </div>
      </main>

      {/* Edit / Create Plan Modal */}
      {editingPlan && (
        <div className="sub-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="edit-plan-modal-title">
          <div className="sub-modal-panel">
            <header className="sub-modal-header">
              <h2 id="edit-plan-modal-title">
                {isNewPlan ? 'Add Subscription Plan' : `Edit "${editingPlan.name}" Plan`}
              </h2>
              <button
                type="button"
                className="sub-modal-close-btn"
                onClick={handleCloseModal}
                aria-label="Close modal"
              >
                ✕
              </button>
            </header>

            <form onSubmit={handleSavePlan} className="sub-modal-form">
              <div className="sub-modal-body">
                <div className="sub-form-group">
                  <label htmlFor="plan-name">
                    Plan Name *
                    <small>e.g., Starter Pharmacy, Professional Chain</small>
                  </label>
                  <input
                    id="plan-name"
                    type="text"
                    required
                    value={editingPlan.name}
                    onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                    placeholder="Enter plan name"
                  />
                </div>

                <div className="sub-form-group">
                  <label htmlFor="plan-tagline">
                    Tagline / Subtitle
                    <small>Short description of who this plan is tailored for</small>
                  </label>
                  <input
                    id="plan-tagline"
                    type="text"
                    value={editingPlan.tagline}
                    onChange={(e) => setEditingPlan({ ...editingPlan, tagline: e.target.value })}
                    placeholder="e.g. Best for growing multi-branch pharmacy chains"
                  />
                </div>

                {/* Price configuration */}
                <div className="sub-form-row">
                  <div className="sub-form-group">
                    <label htmlFor="plan-monthly-price">
                      Monthly Billing Price (₹) *
                      <small>Charged month-to-month</small>
                    </label>
                    <div className="sub-price-input-wrap">
                      <span className="sub-price-currency">₹</span>
                      <input
                        id="plan-monthly-price"
                        type="number"
                        min="0"
                        step="1"
                        required
                        value={editingPlan.monthlyPrice}
                        onChange={(e) => setEditingPlan({ ...editingPlan, monthlyPrice: Number(e.target.value) })}
                      />
                    </div>
                  </div>

                  <div className="sub-form-group">
                    <label htmlFor="plan-yearly-price">
                      Annual Billing Price (₹ / mo) *
                      <small>Discounted rate when paid annually</small>
                    </label>
                    <div className="sub-price-input-wrap">
                      <span className="sub-price-currency">₹</span>
                      <input
                        id="plan-yearly-price"
                        type="number"
                        min="0"
                        step="1"
                        required
                        value={editingPlan.yearlyPrice}
                        onChange={(e) => setEditingPlan({ ...editingPlan, yearlyPrice: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                </div>

                {/* Auto Savings summary */}
                <div style={{ background: '#f0fdfa', border: '1px solid #ccfbf1', padding: '10px 14px', borderRadius: '10px', fontSize: '12px', color: '#0f766e', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>
                    Annual Billing Savings:{' '}
                    <strong>
                      {calculateSavingsPercent(editingPlan.monthlyPrice, editingPlan.yearlyPrice)}% discount
                    </strong>{' '}
                    (Saves ₹{Math.max(0, editingPlan.monthlyPrice - editingPlan.yearlyPrice).toLocaleString('en-IN')}/mo)
                  </span>
                  <span className="sub-savings-badge">
                    Save {calculateSavingsPercent(editingPlan.monthlyPrice, editingPlan.yearlyPrice)}%
                  </span>
                </div>

                {/* Badges and marketing flags */}
                <div className="sub-form-row">
                  <div className="sub-form-group">
                    <label htmlFor="plan-badge">
                      Marketing Badge
                      <small>e.g., ★ Most Popular, Enterprise</small>
                    </label>
                    <input
                      id="plan-badge"
                      type="text"
                      value={editingPlan.badge || ''}
                      onChange={(e) => setEditingPlan({ ...editingPlan, badge: e.target.value })}
                      placeholder="e.g. ★ Most Popular"
                    />
                  </div>

                  <div className="sub-form-group">
                    <label htmlFor="plan-cta-text">
                      Call to Action Button Text
                      <small>Text shown on plan card button</small>
                    </label>
                    <input
                      id="plan-cta-text"
                      type="text"
                      value={editingPlan.ctaText || ''}
                      onChange={(e) => setEditingPlan({ ...editingPlan, ctaText: e.target.value })}
                      placeholder="e.g. Start 14-Day Free Trial"
                    />
                  </div>
                </div>

                <div className="sub-form-row">
                  <label className="sub-checkbox-group">
                    <input
                      type="checkbox"
                      checked={Boolean(editingPlan.popular)}
                      onChange={(e) => setEditingPlan({ ...editingPlan, popular: e.target.checked })}
                    />
                    <span>Highlight as "Most Popular" (elevated card style)</span>
                  </label>

                  <label className="sub-checkbox-group">
                    <input
                      type="checkbox"
                      checked={editingPlan.active !== false}
                      onChange={(e) => setEditingPlan({ ...editingPlan, active: e.target.checked })}
                    />
                    <span>Visible on Public Landing Page</span>
                  </label>
                </div>

                {/* Features list editor */}
                <div className="sub-features-editor">
                  <div className="sub-features-header">
                    <strong>Plan Features &amp; Inclusions</strong>
                    <span>({editingPlan.features?.length || 0} features listed)</span>
                  </div>

                  <div className="sub-add-feature-bar">
                    <input
                      type="text"
                      value={newFeatureText}
                      onChange={(e) => setNewFeatureText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleAddFeature()
                        }
                      }}
                      placeholder="Add a new feature or inclusion..."
                    />
                    <button type="button" onClick={handleAddFeature}>
                      + Add Feature
                    </button>
                  </div>

                  <div className="sub-features-item-list">
                    {(editingPlan.features || []).map((feat, idx) => (
                      <div key={idx} className="sub-feature-item-row">
                        <span style={{ color: '#0d9488', fontWeight: 800, fontSize: '11px', flex: 'none' }}>
                          ✓
                        </span>
                        <input
                          type="text"
                          value={feat}
                          onChange={(e) => handleUpdateFeature(idx, e.target.value)}
                        />
                        <div className="sub-feature-row-btns">
                          <button
                            type="button"
                            title="Move up"
                            disabled={idx === 0}
                            onClick={() => handleMoveFeature(idx, -1)}
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            title="Move down"
                            disabled={idx === editingPlan.features.length - 1}
                            onClick={() => handleMoveFeature(idx, 1)}
                          >
                            ▼
                          </button>
                          <button
                            type="button"
                            className="delete"
                            title="Remove feature"
                            onClick={() => handleDeleteFeature(idx)}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <footer className="sub-modal-footer">
                <button
                  type="button"
                  className="sub-btn sub-btn-secondary"
                  onClick={handleCloseModal}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="sub-btn sub-btn-primary"
                >
                  Save Plan Changes
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
