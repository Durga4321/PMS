import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPharmacySuperAdminDashboard, listPharmacyAdmins } from '../../config/api'
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
  const isBranches = type === 'Branches'
  const columns = isBranches ? ['Branch Name', 'Clinic', 'Location', 'Status'] : ['Medicine Name', 'Category', 'Manufacturer', 'Stock', 'Min. Stock', 'Status']

  return (
    <div className="reference-table-wrap">
      <table className="reference-table">
        <thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
        <tbody>
          {rows.length ? rows.slice(0, 4).map((row, index) => (
            <tr key={pick(row, ['_id', 'id', 'branchId', 'medicineId', 'sku'], index)}>
              {isBranches ? (
                <>
                  <td>{pick(row, ['branchName', 'name', 'title'])}</td>
                  <td>{pick(row, ['clinicName', 'hospitalName', 'clinic'])}</td>
                  <td>{pick(row, ['location', 'address', 'city'])}</td>
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
              <td><span className={`reference-status ${(isBranches ? rowStatus(row) : stockStatus(row)).toLowerCase()}`}>{isBranches ? rowStatus(row) : stockStatus(row)}</span></td>
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

  useEffect(() => {
    let active = true

    Promise.allSettled([getPharmacySuperAdminDashboard(), listPharmacyAdmins()])
      .then(([dashboardResult, adminsResult]) => {
        if (!active) return
        if (dashboardResult.status === 'fulfilled') setData(unwrap(dashboardResult.value))
        else setError(dashboardResult.reason?.message || 'Unable to load dashboard.')
        if (adminsResult.status === 'fulfilled') setAdminTotal(adminCount(adminsResult.value))
      })
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [])

  const view = useMemo(() => {
    const summary = data?.summary || data?.stats || data?.counts || data || {}
    const branchRows = items(data, ['branches', 'branchPerformance', 'branchesPerformance'])
    const medicineRows = items(data, ['medicines', 'medicineInventory', 'inventory', 'medicineList'])
    const expiryRows = items(data, ['expiryAlerts', 'nearExpiryMedicines', 'nearExpiryInventory', 'expiringMedicines'])
    return {
      branches: pick(summary, ['totalBranches', 'branchesCount', 'branches'], branchRows.length),
      activeBranches: pick(summary, ['activeBranches', 'activeBranchCount'], branchRows.filter((item) => rowStatus(item).toLowerCase() === 'active').length),
      admins: adminTotal ?? pick(summary, ['totalAdmins', 'adminsCount', 'adminCount', 'admins', 'totalUsers'], 0),
      revenue: money(pick(summary, ['monthlySales', 'monthlyRevenue', 'revenue', 'totalRevenue', 'totalSales'], 0)),
      salesChange: percent(pick(summary, ['salesChange', 'revenueChange', 'monthlySalesChange', 'changePercentage'], 0)),
      lowStock: pick(summary, ['lowStockAlerts', 'lowStockCount', 'lowStockMedicines'], medicineRows.filter((item) => ['critical', 'low'].includes(stockStatus(item).toLowerCase())).length),
      criticalStock: pick(summary, ['criticalItems', 'criticalStockCount'], medicineRows.filter((item) => stockStatus(item).toLowerCase() === 'critical').length),
      salesSeries: series(data),
      branches: branchRows,
      medicines: medicineRows,
      expiry: expiryRows,
      activities: items(data, ['recentActivities', 'activities', 'activityLogs']),
      purchases: money(pick(summary, ['monthlyPurchases', 'totalPurchases', 'purchases'], 0)),
      medicineCount: pick(summary, ['activeMedicines', 'totalMedicines', 'medicinesCount'], medicineRows.filter((item) => rowStatus(item).toLowerCase() === 'active').length),
      prescriptions: pick(summary, ['monthlyPrescriptions', 'totalPrescriptions', 'prescriptionsCount'], 0),
      nearExpiry: pick(summary, ['nearExpiryMedicines', 'nearExpiryCount', 'nearExpiry'], expiryRows.length),
    }
  }, [adminTotal, data])

  const salesPoints = view.salesSeries.map((point) => ({ label: pick(point, ['label', 'month', 'name', 'period'], '-'), value: numeric(pick(point, ['value', 'sales', 'amount', 'revenue', 'totalSales'], 0)) }))
  const heights = salesPoints.map((point) => point.value)
  const highest = Math.max(...heights, 1)
  const branchSales = view.branches.map((branch) => ({ name: pick(branch, ['branchName', 'name', 'title'], '-'), value: numeric(pick(branch, ['sales', 'amount', 'totalSales', 'revenue'], 0)) })).filter((branch) => branch.value > 0)
  const totalBranchSales = branchSales.reduce((total, branch) => total + branch.value, 0) || 1
  let branchOffset = 0
  const donutStops = branchSales.map((branch, index) => {
    const start = branchOffset
    branchOffset += (branch.value / totalBranchSales) * 360
    return `${['#2563eb', '#4fb49a', '#8b6dcc', '#f0a33b', '#94a3b8'][index % 5]} ${start}deg ${branchOffset}deg`
  }).join(', ')

  return (
    <div className={`super-admin-shell reference-dashboard${open ? ' sidebar-open' : ''}`}>
      <SuperAdminSidebar activeLabel="Dashboard" />
      <main className="super-admin-main">
        <SuperAdminTopbar onMenu={() => setOpen((value) => !value)} />

        <section className="reference-heading"><h1>Super Admin Dashboard</h1><p>Platform-wide clinics, revenue, and operational activity.</p></section>
        {loading ? <p className="reference-message">Loading dashboard...</p> : error ? <p className="reference-message error">{error}</p> : (
          <>
            <section className="reference-stats">
              <article className="reference-stat-link" onClick={() => navigate('/super-admin/branches')} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') navigate('/super-admin/branches') }} role="button" tabIndex="0"><i>+</i><div><strong>{view.branches}</strong><span>Active Branches: {view.activeBranches}</span></div></article>
              <article className="reference-stat-link" onClick={() => navigate('/super-admin/admins')} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') navigate('/super-admin/admins') }} role="button" tabIndex="0"><i>+</i><div><strong>{view.admins}</strong><span>Total Admins</span></div></article>
              <article><i>Rs</i><div><strong>{view.revenue}</strong><span>vs Last Month {view.salesChange}</span></div></article>
              <article className="reference-stat-link" onClick={() => navigate('/super-admin/medicines')} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') navigate('/super-admin/medicines') }} role="button" tabIndex="0"><i>!</i><div><strong>{view.lowStock}</strong><span>Critical Items: {view.criticalStock}</span></div></article>
            </section>
            <section className="reference-insights">
              <article className="reference-card chart-card">
                <header><div><h2>Sales Overview (This Year)</h2><p>Revenue growth across all clinics.</p></div><button type="button">This Year</button></header>
                <div className="bar-chart">{salesPoints.length ? salesPoints.slice(0, 12).map((point, index) => <div key={`${point.label}-${index}`}><span style={{ height: `${Math.max(6, (point.value / highest) * 100)}%` }} /><small>{point.label}</small></div>) : <p>No sales data available.</p>}</div>
              </article>
              <article className="reference-card branch-performance-card">
                <header><div><h2>Branch Performance Summary</h2><p>Total sales by branch.</p></div><button onClick={() => navigate('/super-admin/branches')} type="button">View All</button></header>
                <div className="branch-performance"><div className="donut-chart" style={{ background: donutStops ? `conic-gradient(${donutStops})` : '#e2e8f0' }}><div><span>Total Sales</span><strong>{view.revenue}</strong></div></div><div className="branch-legend">{branchSales.length ? branchSales.slice(0, 5).map((branch, index) => <div key={branch.name}><i style={{ background: ['#2563eb', '#4fb49a', '#8b6dcc', '#f0a33b', '#94a3b8'][index % 5] }} /><span>{branch.name}</span><b>{money(branch.value)} <small>({((branch.value / totalBranchSales) * 100).toFixed(1)}%)</small></b></div>) : <p>No branch sales data available.</p>}</div></div>
              </article>
              <article className="reference-card activities-card">
                <header><div><h2>Recent Activities</h2><p>Latest platform events.</p></div><button onClick={() => navigate('/super-admin/audit-logs')} type="button">View All</button></header>
                <div className="reference-activities">{view.activities.length ? view.activities.slice(0, 5).map((activity, index) => <div key={pick(activity, ['_id', 'id'], index)}><p><b>{pick(activity, ['title', 'action', 'event', 'type'], 'Activity')}</b><span>{pick(activity, ['message', 'text', 'description'], '')}</span></p><time>{pick(activity, ['timeAgo', 'time', 'createdAt'], '')}</time></div>) : <p>No recent activities.</p>}</div>
              </article>
            </section>
            <section className="reference-directory">
              <article className="reference-card"><header><div><h2>Branches</h2><p>All registered branches.</p></div><button onClick={() => navigate('/super-admin/branches')} type="button">View All</button></header><SmallTable type="Branches" rows={view.branches} /></article>
              <article className="reference-card"><header><div><h2>Medicines</h2><p>All medicines in inventory.</p></div><button onClick={() => navigate('/super-admin/medicines')} type="button">View All</button></header><SmallTable type="Medicines" rows={view.medicines} /></article>
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

