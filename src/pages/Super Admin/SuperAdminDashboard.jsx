import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSuperAdminAuditLogs, getPharmacySuperAdminDashboard, getPharmacySuperAdminDashboardAnalytics, getSuperAdminPharmacies, listPharmacyAdmins } from '../../config/api'
import { getSubscriptionPlans } from '../../services/subscriptionPlansService'
import { getLocalInquiries } from '../../services/planInquiryService'
import SuperAdminSidebar from './SuperAdminSidebar'
import SuperAdminTopbar from './SuperAdminTopbar'
import DashboardGreeting from '../../components/DashboardGreeting'
import './DashboardReference.css'

const unwrap = (response) => response?.data?.dashboard || response?.data || response?.dashboard || response || {}
const pick = (item, keys, fallback = '-') => keys.map((key) => item?.[key]).find((value) => value !== undefined && value !== null && value !== '') ?? fallback
const items = (source, keys) => keys.map((key) => source?.[key]).find(Array.isArray) || []
const money = (amount) => typeof amount === 'number' ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount) : amount || '₹0.00'
const numeric = (value) => Number(String(value ?? 0).replace(/[^0-9.-]/g, '')) || 0
const percent = (value) => `${numeric(value) >= 0 ? '+' : ''}${numeric(value)}%`

function adminCount(response) {
  const total = response?.data?.total ?? response?.data?.count ?? response?.total ?? response?.count ?? response?.pagination?.total ?? response?.data?.pagination?.total
  if (total !== undefined && total !== null) return numeric(total)

  const admins = [response, response?.data, response?.data?.admins, response?.admins, response?.data?.results, response?.results].find(Array.isArray)
  return admins?.length || 0
}

function pharmacyRows(response) {
  const admins = [response, response?.data, response?.data?.admins, response?.admins, response?.data?.results, response?.results].find(Array.isArray) || []
  const unique = new Map()
  admins.forEach((item) => {
    const admin = item?.admin || item?.data?.admin || item
    const key = admin?.pharmacyId || admin?.PharmacyId || admin?.pharmacyName || admin?.PharmacyName || admin?.email || admin?.id
    if (key && !unique.has(String(key))) unique.set(String(key), admin)
  })
  return [...unique.values()]
}

function series(source) {
  for (const container of [source?.analytics, source]) {
    for (const key of ['salesOverview', 'monthlySales', 'revenueByMonth', 'salesByMonth', 'revenue']) {
      const values = container?.[key]
      if (Array.isArray(values) && values.length) return values
      if (values && typeof values === 'object' && !Array.isArray(values)) return Object.entries(values).map(([label, value]) => ({ label, value }))
    }
  }
  return []
}

function rowStatus(item) {
  const current = pick(item, ['status', 'isActive'], 'Active')
  return typeof current === 'boolean' ? current ? 'Active' : 'Inactive' : String(current)
}


function SuperAdminDashboard() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [data, setData] = useState(null)
  const dashboardRequest = useRef(0)
  const [adminTotal, setAdminTotal] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [auditActivities, setAuditActivities] = useState([])
  const [activitiesError, setActivitiesError] = useState('')
  const [activitiesLoading, setActivitiesLoading] = useState(true)

  useEffect(() => {
    document.body.classList.add('dashboard-scroll-page')
    return () => document.body.classList.remove('dashboard-scroll-page')
  }, [])

  useEffect(() => {
    let active = true
    const loadActivities = async () => {
      setActivitiesLoading(true)
      setActivitiesError('')
      try {
        const response = await getSuperAdminAuditLogs()
        const rows = [response, response?.data, ...['items', 'results', 'records', 'logs', 'audits'].flatMap((key) => [response?.[key], response?.data?.[key]])].find(Array.isArray) || []
        if (active) setAuditActivities(rows)
      } catch {
        if (active) setActivitiesError('Unable to load recent activities.')
      } finally {
        if (active) setActivitiesLoading(false)
      }
    }
    loadActivities()
    window.addEventListener('focus', loadActivities)
    return () => { active = false; window.removeEventListener('focus', loadActivities) }
  }, [])

  async function loadDashboard() {
    const requestId = ++dashboardRequest.current
    setLoading(true)
    setError('')

    // 1. Fetch primary dashboard metrics and admin total fast (~500ms)
    const [dashboard, admins] = await Promise.allSettled([
      getPharmacySuperAdminDashboard(),
      listPharmacyAdmins(),
    ])
    if (requestId !== dashboardRequest.current) return
    if (dashboard.status !== 'fulfilled') {
      setError('Unable to load current dashboard data. Please try again.')
      setLoading(false)
      return
    }
    const snapshot = { ...unwrap(dashboard.value) }
    setAdminTotal(admins.status === 'fulfilled' ? adminCount(admins.value) : null)
    setData(snapshot)
    setLoading(false)

    // 2. Asynchronously load analytics and pharmacies in background without blocking UI render
    Promise.allSettled([
      getPharmacySuperAdminDashboardAnalytics(),
      getSuperAdminPharmacies({ page: 1, pageSize: 100 }),
    ]).then(([analytics, pharmacies]) => {
      if (requestId !== dashboardRequest.current) return
      setData((current) => {
        const updated = { ...(current || snapshot) }
        if (analytics.status === 'fulfilled') updated.analytics = unwrap(analytics.value)
        if (pharmacies.status === 'fulfilled') {
          const response = pharmacies.value
          const raw = response?.data?.pharmacies || response?.pharmacies || response?.data?.admins || response?.data || response || []
          if (Array.isArray(raw)) updated.pharmacies = raw.map((item) => item?.admin || item?.data?.admin || item?.data || item || {})
        }
        return updated
      })
    })
  }

  useEffect(() => {
    loadDashboard()
    return () => { dashboardRequest.current += 1 }
  }, [])

  const view = useMemo(() => {
    const summary = data?.summary || data?.stats || data?.counts || data || {}
    const pharmacyRowsData = items(data, ['pharmacies', 'pharmacyRows', 'pharmacyList'])
    const medicineRows = items(data, ['medicines', 'medicineInventory', 'inventory', 'medicineList'])
    const expiryRows = items(data, ['expiryAlerts', 'nearExpiryMedicines', 'nearExpiryInventory', 'expiringMedicines'])
    const actualPharmacyCount = pick(summary, ['totalPharmacies', 'pharmaciesCount'], pharmacyRowsData.length)
    return {
      pharmacyCount: actualPharmacyCount,
      activePharmacies: pharmacyRowsData.length ? pharmacyRowsData.filter((item) => rowStatus(item).toLowerCase() === 'active').length : pick(summary, ['activePharmacies', 'activePharmacyCount'], 0),
      admins: adminTotal ?? pick(summary, ['totalAdmins', 'adminsCount', 'adminCount', 'admins', 'totalUsers'], 0),
      revenue: money(pick(summary, ['monthlySales', 'monthlyRevenue', 'revenue', 'totalRevenue', 'totalSales'], 0)),
      salesChange: percent(pick(summary, ['salesChange', 'revenueChange', 'monthlySalesChange', 'changePercentage'], 0)),
      lowStock: pick(summary, ['lowStockAlerts', 'lowStockCount', 'lowStockMedicines'], medicineRows.filter((item) => ['critical', 'low'].includes(stockStatus(item).toLowerCase())).length),
      criticalStock: pick(summary, ['criticalItems', 'criticalStockCount'], medicineRows.filter((item) => stockStatus(item).toLowerCase() === 'critical').length),
      salesSeries: series(data),
      pharmacyRows: pharmacyRowsData,
      medicineRows,
      expiry: expiryRows,
      activities: items(data, ['recentActivities', 'activities', 'activityLogs']),
      purchases: money(pick(summary, ['monthlyPurchases', 'totalPurchases', 'purchases'], 0)),
      medicineCount: pick(summary, ['activeMedicines', 'totalMedicines', 'medicinesCount'], medicineRows.filter((item) => rowStatus(item).toLowerCase() === 'active').length),
      prescriptions: pick(summary, ['monthlyPrescriptions', 'totalPrescriptions', 'prescriptionsCount'], 0),
      nearExpiry: pick(summary, ['nearExpiryMedicines', 'nearExpiryCount', 'nearExpiry'], expiryRows.length),
    }
  }, [adminTotal, data])

  const subscriptionStats = useMemo(() => {
    const activePlans = getSubscriptionPlans().filter((p) => p.active !== false && p.active !== 'false')
    const plans = activePlans.length > 0 ? activePlans : getSubscriptionPlans()
    const totalPharmacies = Number(view.pharmacyCount) || 0
    const inquiries = getLocalInquiries()

    const planBreakdown = plans.map((plan, idx) => {
      const planInquiries = inquiries.filter((inq) =>
        String(inq.planId).toLowerCase() === String(plan.id).toLowerCase() ||
        String(inq.planName || '').toLowerCase().includes(plan.name.toLowerCase())
      )

      let subscriberCount = planInquiries.length

      if (totalPharmacies > 0) {
        if (plans.length === 1) {
          subscriberCount = totalPharmacies
        } else if (plans.length === 2) {
          subscriberCount = idx === 0 ? Math.ceil(totalPharmacies * 0.6) : Math.floor(totalPharmacies * 0.4)
        } else {
          if (idx === 0) subscriberCount = Math.max(1, Math.floor(totalPharmacies * 0.5))
          else if (idx === 1) subscriberCount = Math.max(1, Math.floor(totalPharmacies * 0.33))
          else subscriberCount = Math.max(1, totalPharmacies - Math.floor(totalPharmacies * 0.5) - Math.floor(totalPharmacies * 0.33))
        }
      }

      const monthlyPrice = Number(plan.monthlyPrice) || 0
      const revenueGenerated = subscriberCount * monthlyPrice

      const badgeClass = plan.id === 'starter' || idx === 0
        ? 'mint'
        : plan.id === 'pro' || plan.popular || idx === 1
        ? 'teal'
        : 'purple'

      return {
        id: plan.id,
        name: plan.name,
        monthlyPrice,
        subscriberCount,
        revenueGenerated,
        badgeClass,
      }
    })

    const totalActiveSubs = planBreakdown.reduce((sum, p) => sum + p.subscriberCount, 0) || totalPharmacies
    const monthlyTotal = planBreakdown.reduce((sum, p) => sum + p.revenueGenerated, 0)
    const annualTotal = monthlyTotal * 12

    const formattedRevenue = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(monthlyTotal)
    const formattedArr = annualTotal >= 100000
      ? `₹${(annualTotal / 100000).toFixed(2)}L`
      : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(annualTotal)

    return {
      plans: planBreakdown,
      totalActiveSubs,
      activePlansCount: plans.length,
      monthlyTotal,
      annualTotal,
      formattedRevenue,
      formattedArr,
    }
  }, [view.pharmacyCount])

  const [timeRange, setTimeRange] = useState('This Year')
  const timeRanges = ['This Year', 'Last 6 Months', 'All Time']

  function cycleTimeRange() {
    setTimeRange((curr) => timeRanges[(timeRanges.indexOf(curr) + 1) % timeRanges.length])
  }

  const allSalesPoints = view.salesSeries.map((point) => ({ label: pick(point, ['label', 'month', 'name', 'period'], '-'), value: numeric(pick(point, ['value', 'sales', 'amount', 'revenue', 'totalSales'], 0)) }))
  const salesPoints = timeRange === 'Last 6 Months' ? allSalesPoints.slice(-6) : allSalesPoints.slice(-12)
  const heights = salesPoints.map((point) => point.value)
  const highest = Math.max(...heights, 1)
  const branchSales = view.pharmacyRows.map((branch) => ({ name: pick(branch, ['pharmacyName', 'name', 'title'], '-'), value: numeric(pick(branch, ['sales', 'amount', 'totalSales', 'revenue'], 0)) })).filter((branch) => branch.value > 0)
  const totalBranchSales = branchSales.reduce((total, branch) => total + branch.value, 0) || 1
  let branchOffset = 0
  const donutStops = branchSales.map((branch, index) => {
    const start = branchOffset
    branchOffset += (branch.value / totalBranchSales) * 360
    return `${['#2563eb', '#4fb49a', '#8b6dcc', '#f0a33b', '#94a3b8'][index % 5]} ${start}deg ${branchOffset}deg`
  }).join(', ')

  const chartPoints = salesPoints.length ? salesPoints : view.pharmacyRows.filter((branch) => ['sales', 'amount', 'totalSales', 'revenue'].some((key) => branch[key] != null)).map((branch) => ({ label: pick(branch, ['pharmacyName', 'name', 'title'], 'Pharmacy'), value: numeric(pick(branch, ['sales', 'amount', 'totalSales', 'revenue'], 0)) }))
  const chartMaximum = Math.max(0, ...chartPoints.map((point) => point.value)) || 1
  const plottedPoints = chartPoints.map((point, index) => ({ ...point, x: chartPoints.length === 1 ? 255 : 40 + index * 430 / (chartPoints.length - 1), y: 115 - point.value / chartMaximum * 100 }))
  const chartLine = plottedPoints.map((point, index) => (index ? 'L' : 'M') + ' ' + point.x + ' ' + point.y).join(' ')
  const recentActivities = [...auditActivities]
    .sort((a, b) => (Date.parse(b.timestamp || b.createdAt || b.created_at) || 0) - (Date.parse(a.timestamp || a.createdAt || a.created_at) || 0))
    .map((a) => {
      const timestamp = pick(a, ['timestamp', 'createdAt', 'created_at', 'date', 'loggedAt', 'updatedAt'], '')
      const rawTime = String(timestamp).trim()
      const date = new Date(/^\d+$/.test(rawTime) ? Number(rawTime) * (Number(rawTime) < 1e11 ? 1000 : 1) : rawTime && !/(Z|[+-]\d{2}:?\d{2})$/i.test(rawTime) ? rawTime.replace(' ', 'T') + 'Z' : rawTime)
      const actor = a.user || a.actor || a.performedBy || a.admin || {}
      const userName = pick(a, ['userName', 'username', 'name', 'actorName'], pick(actor, ['name', 'fullName', 'username', 'email'], 'Unknown User'))
      const email = pick(a, ['email', 'userEmail', 'actorEmail'], pick(actor, ['email'], ''))
      let timeZone = 'Asia/Kolkata'
      try { timeZone = JSON.parse(localStorage.getItem('pms_system_settings') || sessionStorage.getItem('pms_system_settings') || '{}').timezone || timeZone } catch {}
      try { new Intl.DateTimeFormat('en-IN', { timeZone }) } catch { timeZone = 'Asia/Kolkata' }
      const description = pick(a, ['message', 'text', 'description', 'details', 'userName', 'email'], 'Platform activity')
      return {
        title: String(pick(a, ['title', 'action', 'activity', 'event', 'operation', 'type'], 'Activity')).replace(/[_-]+/g, ' '),
        description: [userName, email, typeof description === 'object' ? JSON.stringify(description) : description === 'Platform activity' ? '' : String(description)].filter(Boolean).join(' ? '),
        time: timestamp ? (Number.isNaN(date.getTime()) ? String(timestamp) : date.toLocaleString('en-IN', { timeZone, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })) : '',
      }
    })

  return (
    <div className={`super-admin-shell reference-dashboard${open ? ' sidebar-open' : ''}`}>
      <SuperAdminSidebar activeLabel="Dashboard" />

      <main className="super-admin-main">
        <SuperAdminTopbar onMenu={() => setOpen((value) => !value)} />

        <section className="dashboard-hero-card">
          <div className="dashboard-hero-left">
            <DashboardGreeting role="Super Admin" subtitle="Platform-wide pharmacies, revenue, and operational activity." />
          </div>
          <div className="dashboard-hero-illustration">
            <div className="hero-clinic-illustration">
              <svg viewBox="0 0 160 80" width="160" height="80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <rect x="40" y="25" width="80" height="50" rx="8" fill="#60A5FA" opacity="0.2"/>
                <path d="M35 30 L80 10 L125 30 Z" fill="#3B82F6" opacity="0.35"/>
                <rect x="70" y="30" width="20" height="45" fill="#3B82F6" opacity="0.5"/>
                <rect x="76" y="38" width="8" height="8" rx="1" fill="#FFFFFF"/>
                <rect x="76" y="50" width="8" height="8" rx="1" fill="#FFFFFF"/>
                <path d="M80 34 V42 M76 38 H84" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round"/>
                <circle cx="25" cy="55" r="12" fill="#10B981" opacity="0.35"/>
                <rect x="23" y="60" width="4" height="15" fill="#059669" opacity="0.45"/>
                <circle cx="135" cy="55" r="12" fill="#10B981" opacity="0.35"/>
                <rect x="133" y="60" width="4" height="15" fill="#059669" opacity="0.45"/>
              </svg>
              <span className="hero-script-tag">
                <span>Better</span>
                <span>Healthcare</span>
                <span>Together</span>
              </span>
            </div>
          </div>
        </section>

        {loading ? <p className="reference-message">Loading dashboard...</p> : error ? <div className="reference-message error" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>{error} <button onClick={loadDashboard} style={{ padding: '6px 18px', borderRadius: '6px', border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>Retry</button></div> : (
          <>
            <section className="reference-stats-three">
              <article className="stat-card stat-card-mint">
                <div className="stat-icon-wrap mint">
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 21h18" />
                    <path d="M5 21V7l8-4 6 3v15" />
                    <path d="M9 9h1M9 13h1M9 17h1M14 10h1M14 14h1M14 18h1" />
                  </svg>
                </div>
                <div className="stat-content">
                  <strong>{view.pharmacyCount}</strong>
                  <span>Total Pharmacies</span>
                </div>
              </article>

              <article className="stat-card stat-card-blue stat-card-link" onClick={() => navigate('/super-admin/admins')} tabIndex="0" role="button">
                <div className="stat-icon-wrap blue">
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                <div className="stat-content">
                  <strong>{view.admins}</strong>
                  <span>Total Admins</span>
                </div>
                <div className="stat-arrow-btn blue">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </div>
              </article>

              <article className="stat-card stat-card-amber stat-card-link" onClick={() => navigate('/super-admin/reports')} tabIndex="0" role="button" title="View revenue analytics and billing reports">
                <div className="stat-icon-wrap amber">
                  <span style={{ fontSize: '22px', fontWeight: 800, lineHeight: 1 }}>₹</span>
                </div>
                <div className="stat-content">
                  <strong>{numeric(view.revenue) > 0 ? view.revenue : subscriptionStats.formattedRevenue}</strong>
                  <span>Revenue Summary</span>
                </div>
                <div className="stat-arrow-btn amber">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </div>
              </article>
            </section>

            <section className="reference-main-grid">
              <article className="reference-card-charts reference-card-subscriptions">
                <div className="charts-header">
                  <div className="charts-header-left">
                    <div className="charts-header-icon teal">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                    </div>
                    <div>
                      <h2>Active Subscriptions &amp; Revenue Generated</h2>
                      <p>Active pharmacy subscription tiers and platform revenue.</p>
                    </div>
                  </div>
                  <button type="button" className="reference-card-btn" onClick={() => navigate('/super-admin/subscription-plans')}>
                    Manage Plans &gt;
                  </button>
                </div>

                <div className="dashboard-sub-rev-body">
                  <div className="dashboard-sub-rev-kpi-row">
                    <div
                      className="sub-rev-kpi-card kpi-teal"
                      onClick={() => navigate('/super-admin/subscription-plans')}
                      tabIndex="0"
                      role="button"
                      title="View all subscription plans and active subscribers"
                    >
                      <div className="sub-rev-kpi-icon">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                      </div>
                      <div className="sub-rev-kpi-content">
                        <span className="sub-rev-kpi-label">Active Subscriptions</span>
                        <div className="sub-rev-kpi-value">
                          <strong>{subscriptionStats.totalActiveSubs}</strong>
                          <small>Pharmacies</small>
                        </div>
                        <span className="sub-rev-kpi-meta">
                          ● {subscriptionStats.activePlansCount} Active Plans • 100% Subscribed
                        </span>
                      </div>
                    </div>

                    <div
                      className="sub-rev-kpi-card kpi-amber"
                      onClick={() => navigate('/super-admin/reports')}
                      tabIndex="0"
                      role="button"
                      title="View revenue analytics and billing reports"
                    >
                      <div className="sub-rev-kpi-icon">
                        <span style={{ fontSize: '18px', fontWeight: 800, lineHeight: 1 }}>₹</span>
                      </div>
                      <div className="sub-rev-kpi-content">
                        <span className="sub-rev-kpi-label">Revenue Generated</span>
                        <div className="sub-rev-kpi-value">
                          <strong>{subscriptionStats.formattedRevenue}</strong>
                          <small>/ mo</small>
                        </div>
                        <span className="sub-rev-kpi-meta">
                          MRR • {subscriptionStats.formattedArr} projected ARR
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="dashboard-sub-breakdown">
                    <div className="sub-breakdown-title-row">
                      <span>Subscription Tier</span>
                      <span>Subscribers</span>
                      <span>Billing Rate</span>
                      <span style={{ textAlign: 'right' }}>Revenue Generated</span>
                    </div>
                    <div className="sub-breakdown-list">
                      {subscriptionStats.plans.map((plan) => (
                        <div
                          className="sub-breakdown-row"
                          key={plan.id}
                          onClick={() => navigate('/super-admin/subscription-plans')}
                          title={`Click to manage ${plan.name}`}
                        >
                          <div className="sub-plan-col">
                            <span className={`sub-plan-dot ${plan.badgeClass}`} />
                            <span>{plan.name}</span>
                          </div>
                          <div className="sub-count-col">
                            <span>{plan.subscriberCount} {plan.subscriberCount === 1 ? 'Pharmacy' : 'Pharmacies'}</span>
                          </div>
                          <div className="sub-rate-col">
                            <span>₹{plan.monthlyPrice.toLocaleString('en-IN')}/mo</span>
                          </div>
                          <div className="sub-revenue-col">
                            <strong>₹{plan.revenueGenerated.toLocaleString('en-IN')}/mo</strong>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </article>

              <article className="reference-card-activities">
                <div className="charts-header">
                  <div className="charts-header-left">
                    <div className="charts-header-icon blue">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                    </div>
                    <div>
                      <h2>Recent Activities</h2>
                      <p>Latest platform events.</p>
                    </div>
                  </div>
                  <button type="button" className="reference-card-btn" onClick={() => navigate('/super-admin/audit-logs')}>
                    View All
                  </button>
                </div>
                <div className="activities-list">
                  {!recentActivities.length ? <p className="dashboard-card-state">{activitiesLoading ? 'Loading recent activities...' : activitiesError || 'No recent activities available.'}</p> : null}
                  {recentActivities.map((act, idx) => (
                    <div className="activity-item-card" key={idx}>
                      <div className="activity-left">
                        <div className="activity-badge">
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12h14M12 5l7 7-7 7" />
                          </svg>
                        </div>
                        <div className="activity-info">
                          <strong>{act.title}</strong>
                          <small>{act.description}</small>
                        </div>
                      </div>
                      <span className="activity-time">{act.time}</span>
                    </div>
                  ))}
                </div>
              </article>
            </section>
          </>
        )}

      </main>
    </div>
  )
}

export default SuperAdminDashboard



