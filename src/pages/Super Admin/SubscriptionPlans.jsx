import { useEffect, useState } from 'react'
import SuperAdminSidebar from './SuperAdminSidebar'
import SuperAdminTopbar from './SuperAdminTopbar'
import { useToast } from '../../components/ToastProvider'
import { confirmAction } from '../../components/confirmAction'
import {
  calculateSavingsPercent,
  fetchSuperAdminSubscriptionPlans,
  fetchSuperAdminSubscriptionPlan,
  createSuperAdminPlan,
  updateSuperAdminPlan,
  deleteSuperAdminPlan,
  toggleSuperAdminPlanPublish,
} from '../../services/subscriptionPlansService'
import {
  fetchSuperAdminSubscriptionRequests,
  fetchSuperAdminSubscriptionRequestDetails,
  approveSubscriptionRequest,
  rejectSubscriptionRequest,
  resendSubscriptionInvitation,
} from '../../services/planInquiryService'
import './SubscriptionPlans.css'

export default function SubscriptionPlans() {
  const { showToast } = useToast()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('plans') // 'plans' | 'requests'

  // Live Subscription Plans state from GET /api/pharmacy-subscriptions/plans
  const [plans, setPlans] = useState([])
  const [loadingPlans, setLoadingPlans] = useState(true)
  const [plansError, setPlansError] = useState('')

  // Subscription Requests state from GET /api/pharmacy-super-admin/subscription-requests
  const [requests, setRequests] = useState([])
  const [loadingRequests, setLoadingRequests] = useState(false)
  const [requestsError, setRequestsError] = useState('')
  const [requestsFilter, setRequestsFilter] = useState('all') // 'all' | 'pending' | 'approved' | 'rejected'

  // Plan Cards Preview & Edit
  const [previewCycle, setPreviewCycle] = useState('monthly')
  const [editingPlan, setEditingPlan] = useState(null)
  const [isNewPlan, setIsNewPlan] = useState(false)
  const [submittingPlan, setSubmittingPlan] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  // Request modals
  const [viewingRequest, setViewingRequest] = useState(null)
  const [rejectingRequest, setRejectingRequest] = useState(null)
  const [rejectionReason, setRejectionReason] = useState('')

  function formatApiError(err, fallback = 'Operation failed.') {
    const status = err?.status || err?.statusCode
    const method = err?.method || ''
    const url = err?.url || ''
    if (status === 404 && url) {
      return `${method} ${url} returned HTTP 404 Not Found. This endpoint is not available in the current backend environment.`
    }
    if (status) {
      return `${method ? method + ' ' : ''}${url ? url + ' ' : ''}(HTTP ${status}): ${err.message || fallback}`
    }
    return err?.message || fallback
  }

  // 1. Load Super Admin Plan list from protected GET /api/pharmacy-subscriptions/plans
  async function loadPlans() {
    try {
      setLoadingPlans(true)
      setPlansError('')
      const data = await fetchSuperAdminSubscriptionPlans()
      setPlans(data)
    } catch (err) {
      const formatted = formatApiError(err, 'Failed to load subscription plans.')
      setPlansError(formatted)
      showToast(formatted, 'error')
    } finally {
      setLoadingPlans(false)
    }
  }

  // 2. Load Subscription Requests from GET /api/pharmacy-super-admin/subscription-requests
  async function loadRequests() {
    try {
      setLoadingRequests(true)
      setRequestsError('')
      const data = await fetchSuperAdminSubscriptionRequests()
      setRequests(data)
    } catch (err) {
      const formatted = formatApiError(err, 'Failed to load subscription requests.')
      setRequestsError(formatted)
      showToast(formatted, 'error')
    } finally {
      setLoadingRequests(false)
    }
  }

  useEffect(() => {
    loadPlans()
    loadRequests()

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

  const activePlansCount = plans.filter((p) => p.isPublished !== false && p.active !== false && p.active !== 'false').length
  const validMonthly = plans.map((p) => p.monthlyPrice).filter((p) => p != null && p > 0)
  const lowestMonthlyPrice = validMonthly.length > 0 ? Math.min(...validMonthly) : 0
  const validSavings = plans.map((p) => calculateSavingsPercent(p.monthlyPrice, p.yearlyPrice)).filter((s) => s > 0)
  const maxSavings = validSavings.length > 0 ? Math.max(...validSavings) : 0

  const pendingRequestsCount = requests.filter((r) => r.status === 'pending').length

  const filteredRequests = requests.filter((r) => {
    if (requestsFilter === 'pending') return r.status === 'pending'
    if (requestsFilter === 'approved') return r.status === 'approved' || r.status === 'invited'
    if (requestsFilter === 'rejected') return r.status === 'rejected'
    return true
  })

  // ==========================================
  // Plan CRUD & Toggle Actions
  // ==========================================

  function handleOpenAdd() {
    setIsNewPlan(true)
    setEditingPlan({
      code: '',
      name: '',
      priceRupees: 1999,
      billingIntervalMonths: 1,
      branchLimit: 1,
      isPublished: true,
      tagline: 'Ideal for independent chemists & retail pharmacies.',
      badge: '',
      popular: false,
      features: [
        '1 Pharmacy Branch / Location',
        'Staff Accounts & Access Controls',
        'Medicine Inventory Tracking',
        'POS Billing & Tax Invoices',
      ],
    })
  }

  async function handleOpenEdit(plan) {
    setIsNewPlan(false)
    setActionLoading(true)
    try {
      // Fetch full plan for editing from GET /api/pharmacy-subscriptions/plans/{id}
      const full = await fetchSuperAdminSubscriptionPlan(plan.id)
      setEditingPlan({
        id: full.id,
        code: full.code,
        name: full.name,
        priceRupees: full.amountPaise != null ? full.amountPaise / 100 : (full.priceRupees || full.monthlyPrice || ''),
        amountPaise: full.amountPaise,
        billingIntervalMonths: full.billingIntervalMonths ?? 1,
        branchLimit: full.branchLimit !== undefined ? full.branchLimit : '',
        isPublished: full.isPublished ?? true,
        tagline: full.tagline || plan.tagline || '',
        badge: full.badge || plan.badge || '',
        popular: Boolean(full.popular ?? plan.popular),
        features: full.features || plan.features || [],
      })
    } catch (err) {
      showToast(formatApiError(err, 'Failed to fetch plan details for editing.'), 'error')
    } finally {
      setActionLoading(false)
    }
  }

  function handleCloseModal() {
    setEditingPlan(null)
    setIsNewPlan(false)
    setSubmittingPlan(false)
  }

  async function handleSavePlan(e) {
    e.preventDefault()
    if (!editingPlan) return

    const trimmedName = String(editingPlan.name || '').trim()
    if (!trimmedName) {
      showToast('Please enter a plan name', 'error')
      return
    }

    if (isNewPlan) {
      const trimmedCode = String(editingPlan.code || '').trim()
      if (!trimmedCode) {
        showToast('Please enter a unique plan code (e.g. STARTER, PRO)', 'error')
        return
      }
    }

    setSubmittingPlan(true)
    try {
      if (isNewPlan) {
        // Create: POST /api/pharmacy-subscriptions/plans (expects 201)
        // Sends: code, name, amountPaise, billingIntervalMonths, branchLimit, isPublished
        await createSuperAdminPlan(editingPlan)
        showToast(`Subscription plan "${trimmedName}" created successfully!`, 'success')
      } else {
        // Edit: PUT /api/pharmacy-subscriptions/plans/{id} (expects 204)
        // Sends: name, amountPaise, billingIntervalMonths, branchLimit, isPublished (NO code!)
        await updateSuperAdminPlan(editingPlan.id, editingPlan)
        showToast(`Subscription plan "${trimmedName}" updated successfully!`, 'success')
      }

      handleCloseModal()
      await loadPlans()
    } catch (err) {
      showToast(formatApiError(err, `Failed to ${isNewPlan ? 'create' : 'update'} subscription plan.`), 'error')
    } finally {
      setSubmittingPlan(false)
    }
  }

  // Hide / Show: fetch current by ID and send full PUT with only isPublished changed
  async function handleToggleActive(plan) {
    setActionLoading(true)
    try {
      const res = await toggleSuperAdminPlanPublish(plan.id)
      showToast(
        `Plan "${plan.name}" is now ${res.isPublished ? 'Published on landing page' : 'Hidden from landing page'}.`,
        'success'
      )
      await loadPlans()
    } catch (err) {
      showToast(formatApiError(err, 'Failed to update plan publication status.'), 'error')
    } finally {
      setActionLoading(false)
    }
  }

  // Delete: confirm, disable while pending, call DELETE (expects 204), refetch
  async function handleDeletePlan(plan) {
    const confirmed = await confirmAction(
      `Are you sure you want to permanently delete the "${plan.name}" plan? This cannot be undone.`,
      {
        title: 'Permanently Delete Subscription Plan',
        confirmLabel: 'Delete Plan',
      }
    )
    if (!confirmed) return

    setActionLoading(true)
    try {
      await deleteSuperAdminPlan(plan.id)
      showToast(`Subscription plan "${plan.name}" permanently deleted.`, 'success')
      await loadPlans()
    } catch (err) {
      showToast(formatApiError(err, 'Failed to delete subscription plan.'), 'error')
    } finally {
      setActionLoading(false)
    }
  }

  // ==========================================
  // Subscription Requests Handlers
  // ==========================================

  async function handleViewRequestDetails(req) {
    try {
      setActionLoading(true)
      const details = await fetchSuperAdminSubscriptionRequestDetails(req.id)
      setViewingRequest(details || req)
    } catch {
      setViewingRequest(req)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleApproveRequest(req) {
    const confirmed = await confirmAction(
      `Approve subscription request for "${req.pharmacyName}" (${req.fullName}) and send an invitation email to ${req.email}?`,
      {
        title: 'Approve & Send Invitation',
        confirmLabel: 'Approve & Send Email',
      }
    )
    if (!confirmed) return

    try {
      setActionLoading(true)
      await approveSubscriptionRequest(req.id)
      showToast(`Subscription request approved! Invitation emailed to ${req.email}.`, 'success')
      await loadRequests()
    } catch (err) {
      showToast(formatApiError(err, 'Failed to approve subscription request.'), 'error')
    } finally {
      setActionLoading(false)
    }
  }

  function handleOpenRejectModal(req) {
    setRejectingRequest(req)
    setRejectionReason('')
  }

  async function handleConfirmReject(e) {
    e.preventDefault()
    if (!rejectingRequest) return

    try {
      setActionLoading(true)
      await rejectSubscriptionRequest(rejectingRequest.id, rejectionReason)
      showToast(`Subscription request for "${rejectingRequest.pharmacyName}" has been rejected.`, 'info')
      setRejectingRequest(null)
      setRejectionReason('')
      await loadRequests()
    } catch (err) {
      showToast(formatApiError(err, 'Failed to reject subscription request.'), 'error')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleResendInvitation(req) {
    const confirmed = await confirmAction(
      `Replace unused invitation token and resend invitation email to ${req.email}?`,
      {
        title: 'Resend Invitation',
        confirmLabel: 'Resend Email',
      }
    )
    if (!confirmed) return

    try {
      setActionLoading(true)
      await resendSubscriptionInvitation(req.id)
      showToast(`Fresh invitation token has been emailed to ${req.email}.`, 'success')
      await loadRequests()
    } catch (err) {
      showToast(formatApiError(err, 'Failed to resend invitation.'), 'error')
    } finally {
      setActionLoading(false)
    }
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
              <p>Configure pricing, tiers, features, and manage incoming pharmacy subscription requests and invitations.</p>
            </div>
            <div className="sub-plans-header-actions">
              <button
                type="button"
                className="sub-btn sub-btn-secondary"
                onClick={loadPlans}
                disabled={loadingPlans || actionLoading}
                title="Refresh plans directly from backend API"
              >
                ↻ Refresh Plans
              </button>
              <button
                type="button"
                className="sub-btn sub-btn-primary"
                onClick={handleOpenAdd}
                disabled={actionLoading}
              >
                + Add New Plan
              </button>
            </div>
          </header>

          {/* Navigation Tabs */}
          <div className="sub-plans-nav-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'plans'}
              className={`sub-nav-tab ${activeTab === 'plans' ? 'active' : ''}`}
              onClick={() => setActiveTab('plans')}
            >
              Subscription Plans ({plans.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'requests'}
              className={`sub-nav-tab ${activeTab === 'requests' ? 'active' : ''}`}
              onClick={() => setActiveTab('requests')}
            >
              Subscription Requests
              {pendingRequestsCount > 0 ? (
                <span className="sub-tab-badge">{pendingRequestsCount} Pending</span>
              ) : (
                <span style={{ marginLeft: '6px', fontSize: '11px', color: '#64748b' }}>({requests.length})</span>
              )}
            </button>
          </div>

          {/* TAB 1: SUBSCRIPTION PLANS (SUPER ADMIN VIEW) */}
          {activeTab === 'plans' && (
            <>
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
                    <span>Published on Landing</span>
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
                  <span>Displaying <strong>{plans.length} plans</strong> (including hidden)</span>
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

              {/* Inline warning if plans exist but latest background refresh failed */}
              {plansError && plans.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '12px 18px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', marginBottom: '20px', color: '#b91c1c', fontSize: '13px' }}>
                  <span>⚠ {plansError}</span>
                  <button type="button" className="sub-btn sub-btn-secondary" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={loadPlans} disabled={loadingPlans}>
                    ↻ Retry Refresh
                  </button>
                </div>
              )}

              {/* Plans Grid */}
              {loadingPlans ? (
                <div style={{ textAlign: 'center', padding: '56px 24px', background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                  <div style={{ width: '36px', height: '36px', border: '3px solid #e2e8f0', borderTopColor: '#0d9488', borderRadius: '50%', animation: 'pmsSpin 0.8s linear infinite', margin: '0 auto 16px' }} />
                  <p style={{ margin: 0, fontSize: '15px', color: '#64748b', fontWeight: 600 }}>Loading subscription plans from backend...</p>
                </div>
              ) : plansError && plans.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 24px', background: '#fef2f2', borderRadius: '16px', border: '1.5px solid #fecaca' }}>
                  <div style={{ fontSize: '36px', marginBottom: '12px' }}>⚠</div>
                  <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 700, color: '#991b1b' }}>Backend Connection Failed</h3>
                  <p style={{ margin: '0 0 20px', fontSize: '14px', color: '#b91c1c', maxWidth: '600px', marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.5 }}>
                    {plansError}
                  </p>
                  <button
                    type="button"
                    className="sub-btn sub-btn-primary"
                    onClick={loadPlans}
                    disabled={loadingPlans || actionLoading}
                    style={{ margin: '0 auto', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                  >
                    ↻ Retry Connection
                  </button>
                </div>
              ) : plans.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 24px', background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '36px', marginBottom: '12px' }}>📋</div>
                  <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>No Plans Found</h3>
                  <p style={{ margin: '0 0 20px', fontSize: '14px', color: '#64748b' }}>No subscription plans found in backend database.</p>
                  <button
                    type="button"
                    className="sub-btn sub-btn-primary"
                    onClick={handleOpenAdd}
                    style={{ margin: '0 auto' }}
                  >
                    + Add First Plan
                  </button>
                </div>
              ) : (
                <section className="sub-plans-grid">
                  {plans.map((plan) => {
                    const currentPrice = previewCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice
                    const savings = calculateSavingsPercent(plan.monthlyPrice, plan.yearlyPrice)

                    return (
                      <article
                        key={plan.id}
                        className={`sub-plan-card${plan.popular ? ' sub-plan-card--popular' : ''}${!plan.isPublished ? ' sub-plan-card--inactive' : ''}`}
                      >
                        {plan.badge && <span className="sub-plan-badge">{plan.badge}</span>}

                        <span className={`sub-plan-status-pill ${plan.isPublished ? 'active' : 'inactive'}`}>
                          {plan.isPublished ? '● Published' : '○ Hidden'}
                        </span>

                        <header className="sub-plan-header">
                          <div style={{ fontSize: '11px', fontWeight: 800, color: '#0d9488', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '4px' }}>
                            {plan.code || plan.id}
                          </div>
                          <h3>{plan.name}</h3>
                          <p>{plan.tagline || 'Standard pharmacy plan.'}</p>
                        </header>

                        <div className="sub-plan-price-row">
                          {currentPrice != null ? (
                            <>
                              <strong>₹{Number(currentPrice || 0).toLocaleString('en-IN')}</strong>
                              <span>{previewCycle === 'yearly' ? '/ year' : '/ month'}</span>
                            </>
                          ) : (
                            <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#94a3b8' }}>
                              Option Unavailable
                            </span>
                          )}
                        </div>

                        <div className="sub-plan-pricing-meta">
                          <small>
                            {previewCycle === 'yearly'
                              ? (plan.monthlyPrice != null && currentPrice != null ? `Monthly equivalent: ₹${Math.round(currentPrice / 12).toLocaleString('en-IN')}/mo` : 'Annual option')
                              : (plan.yearlyPrice != null ? `Annual full price: ₹${Number(plan.yearlyPrice).toLocaleString('en-IN')}/yr` : 'Monthly option')}
                          </small>
                          {savings > 0 && (
                            <span className="sub-savings-badge">Save {savings}%</span>
                          )}
                        </div>

                        <div style={{ fontSize: '12px', color: '#475569', margin: '8px 0', background: '#f8fafc', padding: '6px 10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                          <span>Branch Limit: <strong>{plan.branchLimit != null ? `${plan.branchLimit} Branch${plan.branchLimit > 1 ? 'es' : ''}` : 'Unlimited Branches'}</strong></span>
                          &bull; <span>Interval: <strong>{plan.billingIntervalMonths === 12 ? 'Annual (12M)' : 'Monthly (1M)'}</strong></span>
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
                          {plan.ctaText || 'Get Started'} →
                        </div>

                        <div className="sub-plan-card-actions">
                          <button
                            type="button"
                            className="sub-card-edit-btn"
                            disabled={actionLoading}
                            onClick={() => handleOpenEdit(plan)}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                            Edit Plan
                          </button>

                          <button
                            type="button"
                            className="sub-card-toggle-btn"
                            disabled={actionLoading}
                            onClick={() => handleToggleActive(plan)}
                            title={plan.isPublished ? 'Hide plan from landing page' : 'Publish plan on landing page'}
                            aria-label={plan.isPublished ? 'Hide plan' : 'Show plan'}
                          >
                            {plan.isPublished ? (
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

                          <button
                            type="button"
                            className="sub-card-toggle-btn"
                            style={{ color: '#ef4444' }}
                            disabled={actionLoading}
                            onClick={() => handleDeletePlan(plan)}
                            title="Permanently delete plan"
                            aria-label="Delete plan"
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 6h18M8 6V4h8v2M5 6l1 14h12l1-14M10 10v6M14 10v6" />
                            </svg>
                          </button>
                        </div>
                      </article>
                    )
                  })}
                </section>
              )}
            </>
          )}

          {/* TAB 2: SUBSCRIPTION REQUESTS */}
          {activeTab === 'requests' && (
            <div className="sub-requests-container">
              {/* Filter pills & refresh */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', margin: '16px 0' }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {['all', 'pending', 'approved', 'rejected'].map((f) => (
                    <button
                      key={f}
                      type="button"
                      className={`sub-btn ${requestsFilter === f ? 'sub-btn-primary' : 'sub-btn-secondary'}`}
                      style={{ padding: '6px 14px', fontSize: '12px', textTransform: 'capitalize' }}
                      onClick={() => setRequestsFilter(f)}
                    >
                      {f} {f === 'pending' && pendingRequestsCount > 0 && `(${pendingRequestsCount})`}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  className="sub-btn sub-btn-secondary"
                  style={{ padding: '6px 14px', fontSize: '12px' }}
                  onClick={loadRequests}
                  disabled={loadingRequests || actionLoading}
                >
                  ↻ Refresh Requests
                </button>
              </div>

              {/* Table of requests */}
              <div className="sub-requests-table-wrap">
                {loadingRequests ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                    Loading subscription requests...
                  </div>
                ) : requestsError ? (
                  <div style={{ padding: '36px 20px', textAlign: 'center', background: '#fef2f2', borderRadius: '12px', margin: '16px' }}>
                    <div style={{ fontSize: '28px', marginBottom: '8px' }}>⚠</div>
                    <p style={{ margin: '0 0 16px', color: '#b91c1c', fontSize: '14px', lineHeight: 1.5 }}>{requestsError}</p>
                    <button
                      type="button"
                      className="sub-btn sub-btn-primary"
                      onClick={loadRequests}
                      disabled={loadingRequests || actionLoading}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      ↻ Retry Loading Requests
                    </button>
                  </div>
                ) : filteredRequests.length === 0 ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                    No subscription requests found matching the filter.
                  </div>
                ) : (
                  <table className="sub-requests-table">
                    <thead>
                      <tr>
                        <th>S.No</th>
                        <th>Pharmacy &amp; City</th>
                        <th>Contact Person</th>
                        <th>Requested Plan</th>
                        <th>Billing Cycle</th>
                        <th>Rate</th>
                        <th>Status</th>
                        <th>Submission Date</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRequests.map((req, idx) => (
                        <tr key={req.id}>
                          <td>{idx + 1}</td>
                          <td>
                            <strong>{req.pharmacyName}</strong>
                            {req.city && <div style={{ fontSize: '11px', color: '#64748b' }}>{req.city}</div>}
                          </td>
                          <td>
                            <div>{req.fullName}</div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>{req.email} &bull; {req.phone}</div>
                          </td>
                          <td>
                            <strong style={{ color: '#0d9488' }}>{req.planName}</strong>
                          </td>
                          <td style={{ textTransform: 'capitalize' }}>{req.billingCycle}</td>
                          <td>₹{Number(req.price || 0).toLocaleString('en-IN')}</td>
                          <td>
                            <span className={`sub-req-status ${req.status}`}>
                              {req.status}
                            </span>
                          </td>
                          <td style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>
                            {new Date(req.createdAt).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </td>
                          <td>
                            <div className="sub-req-actions">
                              <button
                                type="button"
                                className="sub-req-action-btn"
                                onClick={() => handleViewRequestDetails(req)}
                                title="View full details"
                              >
                                View
                              </button>

                              {req.status === 'pending' && (
                                <>
                                  <button
                                    type="button"
                                    className="sub-req-action-btn approve"
                                    onClick={() => handleApproveRequest(req)}
                                    disabled={actionLoading}
                                  >
                                    Approve &amp; Invite
                                  </button>
                                  <button
                                    type="button"
                                    className="sub-req-action-btn reject"
                                    onClick={() => handleOpenRejectModal(req)}
                                    disabled={actionLoading}
                                  >
                                    Reject
                                  </button>
                                </>
                              )}

                              {(req.status === 'approved' || req.status === 'invited') && (
                                <button
                                  type="button"
                                  className="sub-req-action-btn"
                                  style={{ background: '#f0fdf4', borderColor: '#bbf7d0', color: '#166534' }}
                                  onClick={() => handleResendInvitation(req)}
                                  disabled={actionLoading}
                                  title="Replace and resend invitation"
                                >
                                  Resend Invitation
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
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
                disabled={submittingPlan}
                aria-label="Close modal"
              >
                ✕
              </button>
            </header>

            <form onSubmit={handleSavePlan} className="sub-modal-form">
              <div className="sub-modal-body">
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '10px 14px', borderRadius: '10px', fontSize: '12px', color: '#1e40af', marginBottom: '16px' }}>
                  ℹ <strong>Backend Contract:</strong> Persists <code>name</code>, <code>amountPaise</code> (calculated from rupees &times; 100), <code>billingIntervalMonths</code>, <code>branchLimit</code>, and <code>isPublished</code>{isNewPlan ? ' along with unique code' : ''}. Taglines, badges, and features have no backend fields yet and remain display-only.
                </div>

                {/* Plan Code: Required on Create; Read-only / Immutable on Edit */}
                <div className="sub-form-group">
                  <label htmlFor="plan-code">
                    Plan Code {isNewPlan ? '*' : ''}
                    <small>{isNewPlan ? 'Unique uppercase code (e.g., STARTER, PRO, HOSPITAL)' : '(Immutable identifier — not modified on update)'}</small>
                  </label>
                  <input
                    id="plan-code"
                    type="text"
                    required={isNewPlan}
                    disabled={!isNewPlan}
                    value={editingPlan.code || ''}
                    onChange={(e) => setEditingPlan({ ...editingPlan, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. PRO"
                    style={!isNewPlan ? { background: '#f1f5f9', cursor: 'not-allowed', color: '#64748b' } : {}}
                  />
                </div>

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

                {/* Price in Rupees & Billing Interval */}
                <div className="sub-form-row">
                  <div className="sub-form-group">
                    <label htmlFor="plan-price">
                      Price in Rupees (₹) *
                      <small>
                        Saved to API as amountPaise: <strong>{editingPlan.priceRupees !== '' && !isNaN(Number(editingPlan.priceRupees)) ? Math.round(Number(editingPlan.priceRupees) * 100) : 0} paise</strong>
                      </small>
                    </label>
                    <div className="sub-price-input-wrap">
                      <span className="sub-price-currency">₹</span>
                      <input
                        id="plan-price"
                        type="number"
                        min="0"
                        step="1"
                        required
                        value={editingPlan.priceRupees !== undefined ? editingPlan.priceRupees : ''}
                        onChange={(e) => setEditingPlan({ ...editingPlan, priceRupees: e.target.value === '' ? '' : Number(e.target.value) })}
                        placeholder="e.g. 3999"
                      />
                    </div>
                  </div>

                  <div className="sub-form-group">
                    <label htmlFor="plan-interval">
                      Billing Interval *
                      <small>1 for Monthly, 12 for Annual</small>
                    </label>
                    <select
                      id="plan-interval"
                      value={editingPlan.billingIntervalMonths ?? 1}
                      onChange={(e) => setEditingPlan({ ...editingPlan, billingIntervalMonths: Number(e.target.value) })}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px', background: '#ffffff' }}
                    >
                      <option value={1}>1 Month (Monthly billing)</option>
                      <option value={12}>12 Months (Full annual amount)</option>
                    </select>
                  </div>
                </div>

                {/* Branch Limit & Publish status */}
                <div className="sub-form-row">
                  <div className="sub-form-group">
                    <label htmlFor="plan-branch-limit">
                      Branch Limit
                      <small>Maximum branches allowed (leave blank for null / unlimited)</small>
                    </label>
                    <input
                      id="plan-branch-limit"
                      type="number"
                      min="1"
                      step="1"
                      value={editingPlan.branchLimit !== null && editingPlan.branchLimit !== undefined ? editingPlan.branchLimit : ''}
                      onChange={(e) => setEditingPlan({ ...editingPlan, branchLimit: e.target.value === '' ? null : Number(e.target.value) })}
                      placeholder="e.g. 5 (or leave empty for unlimited)"
                    />
                  </div>

                  <div className="sub-form-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <label className="sub-checkbox-group" style={{ marginTop: '16px' }}>
                      <input
                        type="checkbox"
                        checked={Boolean(editingPlan.isPublished)}
                        onChange={(e) => setEditingPlan({ ...editingPlan, isPublished: e.target.checked })}
                      />
                      <span><strong>Publish on Landing Page</strong> (isPublished: true)</span>
                    </label>
                  </div>
                </div>

                {/* Display-only marketing fields */}
                <div className="sub-form-row">
                  <div className="sub-form-group">
                    <label htmlFor="plan-tagline">
                      Tagline / Subtitle
                      <small style={{ color: '#94a3b8' }}>(Read-only display copy — not stored in backend)</small>
                    </label>
                    <input
                      id="plan-tagline"
                      type="text"
                      disabled
                      value={editingPlan.tagline || ''}
                      style={{ background: '#f8fafc', color: '#64748b', cursor: 'not-allowed' }}
                    />
                  </div>

                  <div className="sub-form-group">
                    <label htmlFor="plan-badge">
                      Marketing Badge
                      <small style={{ color: '#94a3b8' }}>(Read-only display copy — not stored in backend)</small>
                    </label>
                    <input
                      id="plan-badge"
                      type="text"
                      disabled
                      value={editingPlan.badge || ''}
                      style={{ background: '#f8fafc', color: '#64748b', cursor: 'not-allowed' }}
                    />
                  </div>
                </div>

                {/* Features list (Read-only copy) */}
                <div className="sub-features-editor">
                  <div className="sub-features-header">
                    <strong>Plan Features &amp; Inclusions</strong>
                    <span style={{ color: '#94a3b8', fontSize: '11px' }}>
                      (Display copy only — backend feature list schema pending)
                    </span>
                  </div>

                  <div className="sub-features-item-list">
                    {(editingPlan.features || []).map((feat, idx) => (
                      <div key={idx} className="sub-feature-item-row" style={{ opacity: 0.9 }}>
                        <span style={{ color: '#0d9488', fontWeight: 800, fontSize: '11px', flex: 'none' }}>✓</span>
                        <span style={{ fontSize: '13px', color: '#334155', padding: '6px 0' }}>{feat}</span>
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
                  disabled={submittingPlan}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPlan}
                  className="sub-btn sub-btn-primary"
                >
                  {submittingPlan ? 'Saving Plan...' : (isNewPlan ? 'Create Plan (201)' : 'Save Plan Changes (204)')}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {/* View Request Details Modal */}
      {viewingRequest && (
        <div className="sub-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="view-req-title">
          <div className="sub-modal-panel" style={{ maxWidth: '640px' }}>
            <header className="sub-modal-header">
              <h2 id="view-req-title">Subscription Request Details</h2>
              <button
                type="button"
                className="sub-modal-close-btn"
                onClick={() => setViewingRequest(null)}
              >
                ✕
              </button>
            </header>

            <div className="sub-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                <div>
                  <small style={{ color: '#64748b', fontSize: '12px' }}>Pharmacy Name</small>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>{viewingRequest.pharmacyName}</div>
                </div>
                <div>
                  <small style={{ color: '#64748b', fontSize: '12px' }}>Status</small>
                  <div>
                    <span className={`sub-req-status ${viewingRequest.status}`}>{viewingRequest.status}</span>
                  </div>
                </div>
                <div>
                  <small style={{ color: '#64748b', fontSize: '12px' }}>Contact Person</small>
                  <div style={{ fontSize: '14px', fontWeight: 600 }}>{viewingRequest.fullName}</div>
                </div>
                <div>
                  <small style={{ color: '#64748b', fontSize: '12px' }}>Email Address</small>
                  <div style={{ fontSize: '14px' }}>{viewingRequest.email}</div>
                </div>
                <div>
                  <small style={{ color: '#64748b', fontSize: '12px' }}>Phone Number</small>
                  <div style={{ fontSize: '14px' }}>{viewingRequest.phone}</div>
                </div>
                <div>
                  <small style={{ color: '#64748b', fontSize: '12px' }}>City &amp; Branches</small>
                  <div style={{ fontSize: '14px' }}>{viewingRequest.city || 'N/A'} ({viewingRequest.branchCount} Branch)</div>
                </div>
                <div>
                  <small style={{ color: '#64748b', fontSize: '12px' }}>Requested Plan</small>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#0d9488' }}>{viewingRequest.planName}</div>
                </div>
                <div>
                  <small style={{ color: '#64748b', fontSize: '12px' }}>Billing Cycle &amp; Rate</small>
                  <div style={{ fontSize: '14px' }}>
                    <span style={{ textTransform: 'capitalize' }}>{viewingRequest.billingCycle}</span> &bull; ₹{Number(viewingRequest.price || 0).toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              {viewingRequest.message && (
                <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <small style={{ color: '#64748b', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Customer Notes / Message</small>
                  <div style={{ fontSize: '13px', color: '#334155', fontStyle: 'italic' }}>"{viewingRequest.message}"</div>
                </div>
              )}

              {viewingRequest.rejectionReason && (
                <div style={{ background: '#fef2f2', padding: '12px 14px', borderRadius: '10px', border: '1px solid #fecaca' }}>
                  <small style={{ color: '#dc2626', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Rejection Reason</small>
                  <div style={{ fontSize: '13px', color: '#991b1b' }}>{viewingRequest.rejectionReason}</div>
                </div>
              )}
            </div>

            <footer className="sub-modal-footer">
              <button
                type="button"
                className="sub-btn sub-btn-secondary"
                onClick={() => setViewingRequest(null)}
              >
                Close
              </button>

              {viewingRequest.status === 'pending' && (
                <>
                  <button
                    type="button"
                    className="sub-btn sub-btn-danger"
                    onClick={() => {
                      const req = viewingRequest
                      setViewingRequest(null)
                      handleOpenRejectModal(req)
                    }}
                  >
                    Reject Request
                  </button>
                  <button
                    type="button"
                    className="sub-btn sub-btn-primary"
                    onClick={() => {
                      const req = viewingRequest
                      setViewingRequest(null)
                      handleApproveRequest(req)
                    }}
                  >
                    Approve &amp; Send Invitation
                  </button>
                </>
              )}
            </footer>
          </div>
        </div>
      )}

      {/* Reject Request Reason Modal */}
      {rejectingRequest && (
        <div className="sub-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="reject-req-title">
          <div className="sub-modal-panel" style={{ maxWidth: '520px' }}>
            <header className="sub-modal-header">
              <h2 id="reject-req-title">Reject Subscription Request</h2>
              <button
                type="button"
                className="sub-modal-close-btn"
                onClick={() => setRejectingRequest(null)}
              >
                ✕
              </button>
            </header>

            <form onSubmit={handleConfirmReject}>
              <div className="sub-modal-body">
                <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#475569' }}>
                  Provide a reason for rejecting the subscription request from{' '}
                  <strong>{rejectingRequest.pharmacyName}</strong> ({rejectingRequest.email}).
                </p>

                <div className="sub-form-group">
                  <label htmlFor="rejection-reason">
                    Rejection Reason
                  </label>
                  <textarea
                    id="rejection-reason"
                    rows={4}
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="e.g. Incomplete pharmacy registration details or duplicate request."
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  />
                </div>
              </div>

              <footer className="sub-modal-footer">
                <button
                  type="button"
                  className="sub-btn sub-btn-secondary"
                  onClick={() => setRejectingRequest(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="sub-btn sub-btn-danger"
                >
                  {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
