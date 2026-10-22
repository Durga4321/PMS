import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPharmacySuperAdminDashboard, getPharmacySuperAdminDashboardAnalytics, getPharmacySuperAdminDashboardExpiryAlerts, getPharmacySuperAdminDashboardLowStock, getSuperAdminPharmacies, listPharmacyAdmins } from '../../config/api'
import SuperAdminSidebar from './SuperAdminSidebar'
import SuperAdminTopbar from './SuperAdminTopbar'
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
  const values = items(source, ['salesOverview', 'monthlySales', 'revenueByMonth', 'salesByMonth', 'revenue'])
  if (Array.isArray(values)) return values
  if (values && typeof values === 'object') return Object.entries(values).map(([label, value]) => ({ label, value }))
  return []
}

function rowStatus(item) {
  const current = pick(item, ['status', 'isActive'], 'Active')
  return typeof current === 'boolean' ? current ? 'Active' : 'Inactive' : String(current)
}

function stockStatus(item) {
  const status = String(pick(item, ['stockStatus', 'inventoryStatus', 'status'], '')).toLowerCase()
  if (status.includes('critical')) return 'Critical'
  if (status.includes('low')) return 'Low'
  const current = numeric(pick(item, ['stock', 'currentStock', 'quantity', 'qty'], 0))
  const minimum = numeric(pick(item, ['minStock', 'minimumStock', 'reorderLevel', 'minimumLevel'], 0))
  return current <= minimum ? 'Critical' : current <= minimum * 1.5 ? 'Low' : 'Normal'
}

function expiryStatus(item) {
  const days = numeric(pick(item, ['daysRemaining', 'daysToExpiry', 'remainingDays'], 0))
  return { days, label: days < 0 ? 'Expired' : `In ${days} days` }
}

function SmallTable({ type, rows }) {
  const isPharmacies = type === 'Pharmacies'
  const columns = isPharmacies ? ['Pharmacy Name', 'Contact', 'Address', 'Email', 'Status'] : ['Medicine Name', 'Category', 'Manufacturer', 'Stock', 'Min. Stock', 'Status']

  return (
    <div className="reference-table-wrap">
      <table className="reference-table">
        <thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
        <tbody>
          {rows.length ? rows.slice(0, 4).map((row, index) => (
            <tr key={pick(row, ['_id', 'id', 'branchId', 'medicineId', 'sku'], index)}>
              {isPharmacies ? (
                <>
                  <td>{pick(row, ['pharmacyName', 'PharmacyName', 'name'], '-')}</td>
                  <td>{pick(row, ['pharmacyContactNumber', 'mobileNumber', 'phone'], '-')}</td>
                  <td>{[pick(row, ['pharmacyAddress', 'address'], ''), [pick(row, ['city'], ''), pick(row, ['state'], ''), pick(row, ['country'], ''), pick(row, ['postalCode'], '')].filter(Boolean).join(', ')].filter(Boolean).join(', ') || '-'}</td>
                  <td>{pick(row, ['pharmacyEmail', 'email'], '-')}</td>
                </>
              ) : (
                <>
                  <td>{pick(row, ['medicineName', 'name', 'medicine'])}</td>
                  <td>{pick(row, ['category', 'categoryName'])}</td>
                  <td>{pick(row, ['manufacturer', 'brand', 'company'])}</td>
                  <td>{pick(row, ['stock', 'currentStock', 'quantity', 'qty'], 0)}</td>
                  <td>{pick(row, ['minStock', 'minimumStock', 'reorderLevel', 'minimumLevel'], 0)}</td>
                </>
              )}
              <td><span className={`reference-status ${(isPharmacies ? rowStatus(row) : stockStatus(row)).toLowerCase()}`}>{isPharmacies ? rowStatus(row) : stockStatus(row)}</span></td>
            </tr>
          )) : <tr><td colSpan={columns.length}>No {type.toLowerCase()} available.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

function SuperAdminDashboard() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [data, setData] = useState(null)
  const [adminTotal, setAdminTotal] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    document.body.classList.add('dashboard-scroll-page')
    return () => document.body.classList.remove('dashboard-scroll-page')
  }, [])

  function loadDashboard() {
    setLoading(true)
    setError('')

    Promise.allSettled([
      getPharmacySuperAdminDashboard(),
      listPharmacyAdmins(),
      getPharmacySuperAdminDashboardAnalytics(),
      getPharmacySuperAdminDashboardExpiryAlerts(),
      getPharmacySuperAdminDashboardLowStock(),
      getSuperAdminPharmacies({ page: 1, pageSize: 100 }),
    ])
      .then(([dashboardResult, adminsResult, analyticsResult, expiryResult, lowStockResult, pharmaciesResult]) => {
        // Build dashboard from whatever succeeded — don't fail completely if one call times out
        const dashboard = dashboardResult.status === 'fulfilled' ? unwrap(dashboardResult.value) : {}
        const analytics = analyticsResult.status === 'fulfilled' ? unwrap(analyticsResult.value) : {}
        const expiry = expiryResult.status === 'fulfilled' ? unwrap(expiryResult.value) : {}
        const lowStock = lowStockResult.status === 'fulfilled' ? unwrap(lowStockResult.value) : {}

        let parsedPharmacies = []
        if (pharmaciesResult?.status === 'fulfilled') {
          const raw = pharmaciesResult.value?.data?.pharmacies || pharmaciesResult.value?.pharmacies || pharmaciesResult.value?.data?.admins || pharmaciesResult.value?.data || pharmaciesResult.value || []
          parsedPharmacies = (Array.isArray(raw) ? raw : []).map((item) => item?.admin || item?.data?.admin || item?.data || item || {})
        }
        if (!parsedPharmacies.length && adminsResult.status === 'fulfilled') {
          parsedPharmacies = pharmacyRows(adminsResult.value)
        }

        setData({
          ...dashboard,
          analytics,
          pharmacies: parsedPharmacies,
          expiryAlerts: items(expiry, ['expiryAlerts', 'nearExpiryMedicines', 'nearExpiryInventory', 'items', 'results', 'data']),
          medicineInventory: items(lowStock, ['lowStock', 'lowStockMedicines', 'items', 'results', 'data']),
        })

        // Only show error if ALL calls failed
        const allFailed = [dashboardResult, adminsResult, analyticsResult, expiryResult, lowStockResult, pharmaciesResult].every((r) => r.status === 'rejected')
        if (allFailed) {
          setError(dashboardResult.reason?.message || 'Unable to load dashboard. Please check your connection and try again.')
        }

        if (adminsResult.status === 'fulfilled') setAdminTotal(adminCount(adminsResult.value))
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadDashboard()
  }, [])

  const view = useMemo(() => {
    const summary = data?.summary || data?.stats || data?.counts || data || {}
    const pharmacyRowsData = items(data, ['pharmacies', 'pharmacyRows', 'pharmacyList'])
    const medicineRows = items(data, ['medicines', 'medicineInventory', 'inventory', 'medicineList'])
    const expiryRows = items(data, ['expiryAlerts', 'nearExpiryMedicines', 'nearExpiryInventory', 'expiringMedicines'])
    const actualPharmacyCount = pharmacyRowsData.length || pick(summary, ['totalPharmacies', 'pharmaciesCount', 'pharmacies'], 0)
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

  const clinicNames = view.pharmacyRows.slice(0, 3).map((b) => pick(b, ['pharmacyName', 'name', 'title'], 'Pharmacy'))
  const recentActivities = view.activities.slice(0, 3).map((a) => ({
    title: pick(a, ['title', 'action', 'event', 'type'], 'Activity'),
    description: pick(a, ['message', 'text', 'description'], 'Platform activity'),
    time: pick(a, ['timeAgo', 'time', 'createdAt'], '-'),
    isLogin: String(pick(a, ['title', 'action', 'type'], '')).toLowerCase().includes('login')
  }))

  return (
    <div className={`super-admin-shell reference-dashboard${open ? ' sidebar-open' : ''}`}>
      <SuperAdminSidebar activeLabel="Dashboard" />

      <main className="super-admin-main">
        <SuperAdminTopbar onMenu={() => setOpen((value) => !value)} />

        <section className="dashboard-hero-card">
          <div className="dashboard-hero-left">
            <div className="dashboard-hero-icon">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 21h18" />
                <path d="M5 21V7l8-4 6 3v15" />
                <path d="M9 9h1M9 13h1M9 17h1M14 10h1M14 14h1M14 18h1" />
              </svg>
            </div>
            <div>
              <h1>Super Admin Dashboard</h1>
              <p>Platform-wide pharmacies, revenue, and operational activity.</p>
            </div>
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

              <article className="stat-card stat-card-amber">
                <div className="stat-icon-wrap amber">
                  <span style={{ fontSize: '22px', fontWeight: 800, lineHeight: 1 }}>₹</span>
                </div>
                <div className="stat-content">
                  <strong>{view.revenue || '₹0.00'}</strong>
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
              <article className="reference-card-charts">
                <div className="charts-header">
                  <div className="charts-header-left">
                    <div className="charts-header-icon blue">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="20" x2="18" y2="10" />
                        <line x1="12" y1="20" x2="12" y2="4" />
                        <line x1="6" y1="20" x2="6" y2="14" />
                      </svg>
                    </div>
                    <div>
                      <h2>Charts &amp; Statistics</h2>
                      <p>Revenue growth across all pharmacies.</p>
                    </div>
                  </div>
                  <button type="button" className="reference-card-btn" onClick={() => navigate('/super-admin/reports')}>
                    View Details &gt;
                  </button>
                </div>

                <div className="chart-svg-container">
                  <svg viewBox="0 0 500 130" preserveAspectRatio="none" className="chart-svg-graphic">
                    <defs>
                      <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    <line x1="30" y1="15" x2="480" y2="15" stroke="#e2e8f0" strokeDasharray="4 4" strokeWidth="1" />
                    <line x1="30" y1="45" x2="480" y2="45" stroke="#e2e8f0" strokeDasharray="4 4" strokeWidth="1" />
                    <line x1="30" y1="75" x2="480" y2="75" stroke="#e2e8f0" strokeDasharray="4 4" strokeWidth="1" />
                    <line x1="30" y1="105" x2="480" y2="105" stroke="#e2e8f0" strokeDasharray="4 4" strokeWidth="1" />

                    <path d="M 80 85 C 160 65, 200 50, 255 50 C 330 50, 390 90, 430 95 L 430 115 L 80 115 Z" fill="url(#chartGradient)" />
                    <path d="M 80 85 C 160 65, 200 50, 255 50 C 330 50, 390 90, 430 95" fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" />

                    <circle cx="80" cy="85" r="4.5" fill="#ffffff" stroke="#2563eb" strokeWidth="2.5" />
                    <circle cx="255" cy="50" r="4.5" fill="#ffffff" stroke="#2563eb" strokeWidth="2.5" />
                    <circle cx="430" cy="95" r="4.5" fill="#ffffff" stroke="#2563eb" strokeWidth="2.5" />
                  </svg>
                  <div className="chart-yaxis-values">
                    <span>4</span><span>3</span><span>2</span><span>1</span><span>0</span>
                  </div>
                  <div className="chart-xaxis-labels">
                    {clinicNames.length ? clinicNames.map((name, i) => (
                      <span key={`${name}-${i}`}>{name}</span>
                    )) : (
                      <><span>Sekhar</span><span>Apollo</span><span>Venkata Goutham Kommineni</span></>
                    )}
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

            <section className="reference-directory">
              <article className="reference-card">
                <header>
                  <div className="card-header-left">
                    <div className="card-header-icon blue">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 21h18" />
                        <path d="M5 21V7l8-4 6 3v15" />
                      </svg>
                    </div>
                    <div>
                      <h2>Pharmacies</h2>
                    </div>
                  </div>
                </header>
                <SmallTable type="Pharmacies" rows={view.pharmacyRows} />
              </article>

              <article className="reference-card">
                <header>
                  <div className="card-header-left">
                    <div className="card-header-icon purple">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
                        <path d="m8.5 8.5 7 7" />
                      </svg>
                    </div>
                    <div>
                      <h2>Medicines</h2>
                    </div>
                  </div>
                  <button onClick={() => navigate('/super-admin/medicines')} type="button" className="reference-card-btn">
                    View All &gt;
                  </button>
                </header>
                <SmallTable type="Medicines" rows={view.medicineRows} />
              </article>
            </section>
            <section className="reference-card expiry-card"><header><div><h2>Expiry Alerts</h2><p>Medicines nearing expiry.</p></div><button onClick={() => navigate('/super-admin/reports')} type="button">View All</button></header><div className="reference-table-wrap"><table className="reference-table"><thead><tr>{['Medicine Name', 'Batch No.', 'Expiry Date', 'Status'].map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{view.expiry.length ? view.expiry.slice(0, 5).map((row, index) => { const status = expiryStatus(row); return <tr key={pick(row, ['_id', 'id', 'batchNo'], index)}><td>{pick(row, ['medicineName', 'name', 'medicine'])}</td><td>{pick(row, ['batchNo', 'batchNumber', 'batch'])}</td><td>{pick(row, ['expiryDate', 'expiresAt', 'expiry'])}</td><td><span className={`reference-status ${status.days <= 7 ? 'critical' : 'low'}`}>{status.label}</span></td></tr> }) : <tr><td colSpan="4">No expiry alerts available.</td></tr>}</tbody></table></div></section>
            <section className="reference-stats reference-bottom-stats">
              <article><i>Rs</i><div><strong>{view.purchases}</strong><span>Total Purchases (This Month)</span></div></article>
              <article><i>+</i><div><strong>{view.medicineCount}</strong><span>Total Medicines (Active)</span></div></article>
              <article><i>#</i><div><strong>{view.prescriptions}</strong><span>Total Prescriptions (This Month)</span></div></article>
              <article><i>!</i><div><strong>{view.nearExpiry}</strong><span>Near Expiry Medicines (Within 30 Days)</span></div></article>
            </section>
          </>
        )}
      </main>
    </div>
  )
}

export default SuperAdminDashboard



