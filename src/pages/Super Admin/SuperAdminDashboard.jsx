import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getPharmacySuperAdminDashboard,
  getPharmacySuperAdminDashboardAnalytics,
  getPharmacySuperAdminDashboardExpiryAlerts,
  getPharmacySuperAdminDashboardLowStock,
} from '../../config/api'
import SuperAdminSidebar from './SuperAdminSidebar'
import SuperAdminTopbar from './SuperAdminTopbar'
import './DashboardReference.css'

const unwrap = (response) => response?.data?.dashboard || response?.data || response?.dashboard || response || {}
const pick = (item, keys, fallback = '-') => keys.map((key) => item?.[key]).find((value) => value !== undefined && value !== null && value !== '') ?? fallback
const items = (source, keys) => keys.map((key) => source?.[key]).find(Array.isArray) || []
const listFrom = (source, keys) => Array.isArray(source) ? source : items(source, keys)
const money = (amount) => typeof amount === 'number' ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount) : amount || '0'

function rowStatus(item) {
  const current = pick(item, ['status', 'isActive'], 'Active')
  return typeof current === 'boolean' ? current ? 'Active' : 'Inactive' : String(current)
}

function SmallTable({ type, rows }) {
  const isBranches = type === 'Branches'
  const columns = isBranches ? ['Branch Name', 'Clinic', 'Location', 'Status'] : ['Medicine Name', 'Category', 'Manufacturer', 'Stock', 'Status']

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
                </>
              )}
              <td><span className={`reference-status ${rowStatus(row).toLowerCase()}`}>{rowStatus(row)}</span></td>
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    Promise.allSettled([
      getPharmacySuperAdminDashboard(),
      getPharmacySuperAdminDashboardAnalytics(),
      getPharmacySuperAdminDashboardExpiryAlerts(),
      getPharmacySuperAdminDashboardLowStock(),
    ])
      .then((results) => {
        if (!active) return
        const [dashboard, analytics, expiryAlerts, lowStock] = results.map((result) => result.status === 'fulfilled' ? unwrap(result.value) : null)
        setData({
          ...(dashboard || {}),
          analytics: analytics || dashboard?.analytics,
          expiryAlerts: listFrom(expiryAlerts, ['expiryAlerts', 'items', 'results', 'data']),
          lowStock: listFrom(lowStock, ['lowStock', 'items', 'results', 'data']),
        })
      })
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [])

  const view = useMemo(() => {
    const summary = data?.summary || data?.stats || data?.counts || data || {}
    return {
      clinics: pick(summary, ['totalClinics', 'clinicsCount', 'clinics'], 0),
      admins: pick(summary, ['totalAdmins', 'adminsCount', 'admins', 'totalUsers'], 0),
      revenue: money(pick(summary, ['revenue', 'totalRevenue', 'monthlySales', 'totalSales'], 0)),
      branches: items(data, ['branches', 'branchPerformance', 'branchesPerformance']),
      medicines: items(data, ['medicines', 'medicineInventory', 'inventory', 'medicineList', 'lowStock']),
      expiryAlerts: items(data, ['expiryAlerts']),
      lowStock: items(data, ['lowStock']),
      activities: items(data, ['recentActivities', 'activities', 'activityLogs']),
    }
  }, [data])

  const heights = view.branches.map((branch) => Number(pick(branch, ['sales', 'amount', 'totalSales', 'revenue'], 0)) || 0)
  const highest = Math.max(...heights, 1)

  return (
    <div className={`super-admin-shell reference-dashboard${open ? ' sidebar-open' : ''}`}>
      <SuperAdminSidebar activeLabel="Dashboard" />
      <main className="super-admin-main">
        <SuperAdminTopbar onMenu={() => setOpen((value) => !value)} />

        <div className="super-admin-content">
          <section className="reference-heading"><h1>Super Admin Dashboard</h1><p>Platform-wide clinics, revenue, and operational activity.</p></section>
          {loading ? <p className="reference-message">Loading dashboard...</p> : error ? <p className="reference-message error">{error}</p> : (
            <>
              <section className="reference-stats">
                <article><i>+</i><div><strong>{view.clinics}</strong><span>Total Clinics</span></div></article>
                <article><i>+</i><div><strong>{view.admins}</strong><span>Total Admins</span></div></article>
                <article><i>Rs</i><div><strong>{view.revenue}</strong><span>Revenue Summary</span></div></article>
              </section>
              <div className="dashboard-scroll-area">
                <section className="reference-insights">
                  <article className="reference-card chart-card">
                    <header><div><h2>Charts &amp; Statistics</h2><p>Revenue growth across all clinics.</p></div><button type="button">This Month</button></header>
                    <div className="bar-chart">{view.branches.length ? view.branches.slice(0, 6).map((branch, index) => <div key={pick(branch, ['_id', 'id', 'branchId', 'name'], index)}><span style={{ height: `${Math.max(6, (heights[index] / highest) * 100)}%` }} /><small>{pick(branch, ['branchName', 'name'], '-')}</small></div>) : <p>No revenue data available.</p>}</div>
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
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

export default SuperAdminDashboard

