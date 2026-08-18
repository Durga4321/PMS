import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import UserProfileMenu from '../../components/UserProfileMenu'
import { superAdminNavigation } from '../../components/superAdminNavigation'
import { getPharmacySuperAdminDashboard } from '../../config/api'
import './SuperAdminSidebar.css'
import './SuperAdminTopbar.css'

const unwrap = (response) => response?.data?.dashboard || response?.data || response?.dashboard || response || {}
const pick = (source, keys, fallback = '') => keys.reduce((value, key) => value ?? source?.[key], undefined) ?? fallback
const toList = (source, keys) => {
  const value = pick(source, keys, [])
  return Array.isArray(value) ? value : []
}

function currency(value) {
  if (value === undefined || value === null || value === '') return '0'
  if (typeof value === 'string') return value
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value)
}

function rows(items, fields) {
  return items.map((item, index) => fields.map(({ keys, fallback }) => pick(item, keys, fallback ?? index + 1)))
}

function dashboardView(data) {
  const summary = data.summary || data.stats || data.counts || data
  return {
    stats: [
      ['Total Branches', pick(summary, ['totalBranches', 'branchesCount', 'branches'], 0), 'Active Branches:', pick(summary, ['activeBranches'], 0)],
      ['Total Users', pick(summary, ['totalUsers', 'usersCount', 'users'], 0), 'Active Users:', pick(summary, ['activeUsers'], 0)],
      ['Total Medicines', pick(summary, ['totalMedicines', 'medicinesCount', 'medicines'], 0), 'Active Medicines', pick(summary, ['activeMedicines'], '')],
      ['Total Sales (This Month)', currency(pick(summary, ['monthlySales', 'totalSalesThisMonth', 'totalSales', 'sales'], 0)), pick(summary, ['salesGrowthText', 'salesGrowth'], ''), ''],
      ['Low Stock Alerts', pick(summary, ['lowStockAlerts', 'lowStock', 'lowStockCount'], 0), 'Critical Items:', pick(summary, ['criticalItems', 'criticalStock'], 0)],
      ['Expiring Medicines', pick(summary, ['expiringMedicines', 'expiryAlerts', 'expiringCount'], 0), 'Within 30 Days', ''],
    ],
    stock: rows(toList(data, ['lowStockMedicines', 'lowStock', 'stockAlerts']), [
      { keys: ['medicineName', 'name', 'medicine'], fallback: '-' },
      { keys: ['currentStock', 'stock', 'quantity', 'qty'], fallback: 0 },
      { keys: ['minimumStock', 'minStock', 'threshold'], fallback: 0 },
      { keys: ['status'], fallback: 'Low' },
    ]),
    expiry: rows(toList(data, ['expiryAlerts', 'expiringMedicines', 'expiry']), [
      { keys: ['medicineName', 'name', 'medicine'], fallback: '-' },
      { keys: ['batchNo', 'batchNumber', 'batch'], fallback: '-' },
      { keys: ['expiryDate', 'expiresAt'], fallback: '-' },
      { keys: ['daysLeft'], fallback: '-' },
      { keys: ['status'], fallback: 'Expiring' },
    ]),
    prescriptions: rows(toList(data, ['recentPrescriptions', 'prescriptions']), [
      { keys: ['prescriptionId', 'rxNo', 'id'], fallback: '-' },
      { keys: ['patientName', 'patient'], fallback: '-' },
      { keys: ['doctorName', 'doctor'], fallback: '-' },
      { keys: ['branchName', 'branch'], fallback: '-' },
      { keys: ['date', 'createdAt'], fallback: '-' },
      { keys: ['totalAmount', 'amount'], fallback: 0 },
      { keys: ['status'], fallback: '-' },
    ]),
    transactions: rows(toList(data, ['recentTransactions', 'transactions']), [
      { keys: ['invoiceNo', 'invoiceId', 'id'], fallback: '-' },
      { keys: ['branchName', 'branch'], fallback: '-' },
      { keys: ['date', 'createdAt'], fallback: '-' },
      { keys: ['amount', 'totalAmount'], fallback: 0 },
      { keys: ['paymentMode', 'mode'], fallback: '-' },
      { keys: ['status'], fallback: '-' },
    ]),
    activities: toList(data, ['recentActivities', 'activities', 'activityLogs']).map((item, index) => [
      pick(item, ['message', 'text', 'activity', 'action'], `Activity ${index + 1}`),
      pick(item, ['timeAgo', 'time', 'createdAt'], ''),
    ]),
    branches: toList(data, ['branchPerformance', 'branchesPerformance', 'branches']).map((item, index) => [
      pick(item, ['branchName', 'name'], `Branch ${index + 1}`),
      pick(item, ['salesText', 'amountText'], `${currency(pick(item, ['sales', 'amount', 'totalSales'], 0))}${pick(item, ['percentage'], '') ? ` (${pick(item, ['percentage'])}%)` : ''}`),
    ]),
  }
}

function Icon({ children }) {
  return <svg className="admin-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">{children}</svg>
}

function Status({ value }) {
  return <span className={`status-badge status-${String(value).toLowerCase().replaceAll(' ', '-')}`}>{value}</span>
}

function Table({ headers, tableRows }) {
  return <div className="dashboard-table-wrap"><table className="dashboard-table"><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{tableRows.length ? tableRows.map((row) => <tr key={row.join('-')}>{row.map((cell, index) => <td key={`${row[0]}-${index}`}>{index === row.length - 1 ? <Status value={cell} /> : cell}</td>)}</tr>) : <tr><td colSpan={headers.length}>No data found.</td></tr>}</tbody></table></div>
}

function Panel({ title, children, viewAll }) {
  return <section className="dashboard-card"><div className="dashboard-card-heading"><h2>{title}</h2>{viewAll && <button className="view-all-button" type="button">View All</button>}</div>{children}</section>
}

function SuperAdminDashboard() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const view = useMemo(() => dashboardView(dashboard || {}), [dashboard])

  useEffect(() => {
    let active = true
    async function loadDashboard() {
      setLoading(true)
      setError('')
      try {
        const response = await getPharmacySuperAdminDashboard()
        if (active) setDashboard(unwrap(response))
      } catch (err) {
        if (active) setError(err.message)
      } finally {
        if (active) setLoading(false)
      }
    }
    loadDashboard()
    return () => { active = false }
  }, [])

  return <div className={`admin-shell${open ? ' sidebar-open' : ''}`}>
    <aside className="admin-sidebar"><div className="admin-brand"><span className="admin-brand-mark">+</span><div><strong>PMS</strong><small>Super Admin Console</small></div></div><nav className="admin-nav">{superAdminNavigation.map(({ label, path, icon, color }) => <button type="button" onClick={() => navigate(path)} className={`admin-nav-link${label === 'Dashboard' ? ' is-active' : ''}`} key={label}><span className={`nav-icon nav-icon-${color}`} aria-hidden="true">{icon}</span><span>{label}</span></button>)}</nav><div className="admin-sidebar-footer"><span className="profile-avatar">SA</span><div><strong>Super Admin</strong><small>Super Admin</small><em>Online</em></div></div></aside>
    <main className="admin-main"><header className="admin-topbar"><button className="topbar-menu" type="button" onClick={() => setOpen(!open)}><Icon><path d="M4 6h16M4 12h16M4 18h16" /></Icon></button><div className="topbar-title"><h1>Super Admin Dashboard</h1><p>Welcome back! Here&apos;s what&apos;s happening in your pharmacy system.</p></div><div className="admin-topbar-actions"><label className="dashboard-search"><Icon><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></Icon><input placeholder="Search dashboard, clinics, admins, reports..." /></label><button className="notification-button" type="button"><Icon><path d="M6 9a6 6 0 0 1 12 0c0 7 2 7 2 9H4c0-2 2-2-2-9" /><path d="M10 21h4" /></Icon><b>1</b></button><UserProfileMenu roleType="super-admin" /></div></header>
      <section className="dashboard-hero"><h1>Super Admin Dashboard</h1><p>Platform-wide clinics, revenue, and operational activity.</p></section>
      {loading ? <section className="dashboard-card"><p>Loading dashboard...</p></section> : null}
      {error ? <section className="dashboard-card"><p>{error}</p></section> : null}
      {!loading && !error ? <>
        <section className="summary-grid">{view.stats.map(([title, value, note, detail], i) => <article className={`summary-card summary-card-${i + 1}`} key={title}><span className="summary-icon">{i === 3 ? '₹' : i === 4 ? '!' : '+'}</span><div><p>{title}</p><strong>{value}</strong><small>{note} {detail !== '' && <b>{detail}</b>}</small></div></article>)}</section>
        <section className="analytics-grid"><Panel title="Sales Overview"><div className="panel-controls"><button>This Month</button></div><div className="sales-chart"><span>₹20L</span><span>₹15L</span><span>₹10L</span><span>₹5L</span><span>₹0</span><svg viewBox="0 0 600 180" preserveAspectRatio="none"><defs><linearGradient id="area" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#1673f1" stopOpacity=".25" /><stop offset="1" stopColor="#1673f1" stopOpacity="0" /></linearGradient></defs><path d="M25 132 L85 65 L145 105 L205 125 L265 112 L325 132 L385 105 L445 112 L505 62 L550 94 L590 54 L590 175 L25 175Z" fill="url(#area)" /><path d="M25 132 L85 65 L145 105 L205 125 L265 112 L325 132 L385 105 L445 112 L505 62 L550 94 L590 54" fill="none" stroke="#126cf0" strokeWidth="3" /></svg><div className="chart-labels"><span>01</span><span>05</span><span>10</span><span>15</span><span>20</span><span>25</span><span>31</span></div></div></Panel><Panel title="Branch Performance"><div className="panel-controls"><button>This Month</button></div><div className="branch-chart"><div className="donut"><div><small>Total Sales</small><strong>{view.stats[3]?.[1] || '0'}</strong></div></div><ul>{view.branches.length ? view.branches.map(([name, amount], index) => <li key={name}><i className={`branch-dot dot-${index}`} /><span>{name}</span><b>{amount}</b></li>) : <li><span>No branch data found.</span></li>}</ul></div></Panel></section>
        <section className="mid-grid"><Panel title="Recent Activity" viewAll><div className="activity-list">{view.activities.length ? view.activities.map(([text, time]) => <div key={text}><span className="activity-icon">+</span><p>{text}</p><small>{time}</small></div>) : <p>No activity found.</p>}</div></Panel><Panel title="Low Stock Medicines" viewAll><Table headers={['Medicine Name', 'Current Stock', 'Min. Stock', 'Status']} tableRows={view.stock} /></Panel><Panel title="Expiry Alerts" viewAll><Table headers={['Medicine Name', 'Batch No.', 'Expiry Date', 'Days Left', 'Status']} tableRows={view.expiry} /></Panel></section>
        <section className="bottom-grid"><Panel title="Recent Prescriptions"><Table headers={['Prescription ID', 'Patient Name', 'Doctor Name', 'Branch', 'Date', 'Total Amount', 'Status']} tableRows={view.prescriptions} /></Panel><Panel title="Recent Transactions" viewAll><Table headers={['Invoice No.', 'Branch', 'Date', 'Amount', 'Payment Mode', 'Status']} tableRows={view.transactions} /></Panel></section>
      </> : null}
    </main>
  </div>
}

export default SuperAdminDashboard
