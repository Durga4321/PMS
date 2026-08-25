import { useEffect, useMemo, useState } from 'react'
import { exportSuperAdminRevenueExcel, exportSuperAdminRevenuePdf, getSuperAdminRevenueReport } from '../../config/api'
import SuperAdminSidebar from './SuperAdminSidebar'
import SuperAdminTopbar from './SuperAdminTopbar'
import './Reports.css'

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 })
const number = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 })

function valueOf(item, names, fallback = '') {
  return names.reduce((value, name) => value || item?.[name], '') || fallback
}

function numeric(value) {
  const parsed = Number(String(value ?? '').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

function recordsFrom(response) {
  if (Array.isArray(response)) return response
  return ['data', 'items', 'results', 'reports', 'rows', 'records'].reduce((records, key) => records.length ? records : (Array.isArray(response?.[key]) ? response[key] : []), [])
}

function normalize(item, index) {
  return {
    id: valueOf(item, ['_id', 'id', 'reportId'], index),
    admin: valueOf(item, ['adminName', 'admin', 'createdBy', 'pharmacyAdmin'], 'Unassigned'),
    branch: valueOf(item, ['branchName', 'branch', 'pharmacyName'], 'Unassigned'),
    date: valueOf(item, ['date', 'reportDate', 'saleDate', 'createdAt'], ''),
    status: valueOf(item, ['status', 'reportStatus', 'paymentStatus'], 'Completed'),
    purchases: numeric(valueOf(item, ['purchases', 'purchaseAmount', 'totalPurchases'])),
    sales: numeric(valueOf(item, ['sales', 'salesAmount', 'totalSales', 'saleAmount'])),
    prescriptions: numeric(valueOf(item, ['prescriptions', 'prescriptionCount', 'totalPrescriptions'])),
    gst: numeric(valueOf(item, ['gst', 'gstAmount', 'totalGst', 'tax'])),
    revenue: numeric(valueOf(item, ['totalRevenue', 'revenue', 'amount', 'netRevenue', 'total'])),
    performance: numeric(valueOf(item, ['branchPerformance', 'performance', 'performanceScore'])) || null,
  }
}

function displayDate(value) {
  if (!value) return 'Unknown'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? String(value).slice(0, 10) : parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

function Icon({ children }) {
  return <svg className="reports-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">{children}</svg>
}

function Reports() {
  const [records, setRecords] = useState([])
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  async function loadReport() {
    setLoading(true)
    try {
      const response = await getSuperAdminRevenueReport({ startDate, endDate })
      setRecords(recordsFrom(response).map(normalize))
    } catch {
      setRecords([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadReport() }, [])

  const filteredRecords = useMemo(() => records.filter((record) => {
    const text = [record.admin, record.branch, record.revenue, record.sales].join(' ').toLowerCase()
    const matchesQuery = !query.trim() || text.includes(query.trim().toLowerCase())
    const date = record.date ? new Date(record.date) : null
    const matchesStart = !startDate || !date || date >= new Date(`${startDate}T00:00:00`)
    const matchesEnd = !endDate || !date || date <= new Date(`${endDate}T23:59:59`)
    const status = valueOf(record, ['status'], 'Completed')
    return matchesQuery && matchesStart && matchesEnd && (filter === 'All' || status === filter)
  }), [endDate, filter, query, records, startDate])

  const totals = useMemo(() => {
    const revenue = filteredRecords.reduce((sum, record) => sum + record.revenue, 0)
    const branchCount = new Set(filteredRecords.map((record) => record.branch)).size
    const scored = filteredRecords.filter((record) => record.performance !== null)
    const performance = scored.length ? scored.reduce((sum, record) => sum + record.performance, 0) / scored.length : 0
    const maximum = Math.max(...filteredRecords.map((record) => record.revenue), 0)
    return { revenue, branchCount, performance, maximum }
  }, [filteredRecords])

  const timeline = useMemo(() => {
    const grouped = new Map()
    filteredRecords.forEach((record) => grouped.set(record.date || record.branch, (grouped.get(record.date || record.branch) || 0) + record.revenue))
    return [...grouped.entries()].slice(-8)
  }, [filteredRecords])

  const branches = useMemo(() => {
    const grouped = new Map()
    filteredRecords.forEach((record) => grouped.set(record.branch, (grouped.get(record.branch) || 0) + record.revenue))
    return [...grouped.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
  }, [filteredRecords])

  async function exportReport(type) {
    const params = { startDate, endDate }
    if (type === 'PDF') await exportSuperAdminRevenuePdf(params)
    else await exportSuperAdminRevenueExcel(params)
  }

  return <div className={`super-admin-shell${sidebarOpen ? ' sidebar-open' : ''}`}>
    <SuperAdminSidebar activeLabel="Reports" />
    <main className="super-admin-main reports-page">
      <SuperAdminTopbar onMenu={() => setSidebarOpen((value) => !value)} />
      <section className="reports-heading"><div><p className="super-admin-eyebrow">Super Admin</p><h1>Pharmacy Reports</h1><p>Sales, revenue, and performance reports.</p></div><div className="reports-actions"><button type="button" onClick={() => exportReport('PDF')}>Export PDF</button><button className="reports-primary" type="button" onClick={() => exportReport('Excel')}>Export Excel</button></div></section>
      <section className="reports-panel reports-toolbar"><label className="reports-search"><Icon><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></Icon><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search reports by admin, branch, revenue, or status..." /></label><select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Report filter"><option>All</option><option>Completed</option><option>Pending</option><option>Cancelled</option></select><button className="reports-tab" type="button">Revenue Report</button><div className="reports-date-row"><label>Start Date<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label><label>End Date<input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label><button className="reports-primary reports-fetch" type="button" onClick={loadReport}>Fetch Report</button></div></section>
      <section className="reports-stat-grid"><article className="reports-stat"><span className="stat-mark revenue-mark">₹</span><div><small>Total Revenue</small><strong>{money.format(totals.revenue)}</strong><em>Across all branches</em></div></article><article className="reports-stat"><span className="stat-mark performance-mark">↗</span><div><small>Avg. Branch Performance</small><strong>{number.format(totals.performance)}%</strong><em>Performance Score</em></div></article><article className="reports-stat"><span className="stat-mark branch-mark">▦</span><div><small>Total Branches</small><strong>{number.format(totals.branchCount)}</strong><em>Active branches</em></div></article></section>
      <section className="reports-chart-grid"><article className="reports-panel chart-panel"><h2>Revenue Overview</h2>{loading ? <div className="reports-state">Loading chart data...</div> : timeline.length ? <div className="bar-chart">{timeline.map(([label, revenue]) => <div className="bar-item" key={label}><span style={{ height: `${Math.max((revenue / totals.maximum) * 100, 5)}%` }} title={money.format(revenue)} /><small>{displayDate(label)}</small></div>)}</div> : <div className="reports-state">No revenue data for this range.</div>}</article><article className="reports-panel chart-panel"><h2>Revenue by Branch</h2>{loading ? <div className="reports-state">Loading branch data...</div> : branches.length ? <div className="branch-chart"><div className="donut" style={{ background: `conic-gradient(${branches.map(([branch, revenue], index) => `${['#0f9d9d', '#3b82f6', '#f59e0b', '#94a3b8'][index % 4]} ${branches.slice(0, index).reduce((sum, item) => sum + item[1], 0) / totals.revenue * 100}% ${branches.slice(0, index + 1).reduce((sum, item) => sum + item[1], 0) / totals.revenue * 100}%`).join(', ')}` }}><b>{money.format(totals.revenue)}</b></div><div className="branch-legend">{branches.map(([branch, revenue], index) => <div key={branch}><i className={`legend-dot dot-${index % 4}`} /><b>{branch}</b><small>{money.format(revenue)} <em>{totals.revenue ? `${number.format(revenue / totals.revenue * 100)}%` : '0%'}</em></small></div>)}</div></div> : <div className="reports-state">No branch data for this range.</div>}</article></section>
      <section className="reports-panel reports-table-panel"><header className="reports-table-heading"><div><h2>Branch Revenue Details</h2><p>Performance by pharmacy branch and administrator.</p></div><span>{loading ? 'Loading...' : `Showing ${filteredRecords.length} of ${records.length} records`}</span></header><div className="reports-table-wrap"><table><thead><tr>{['S.No', 'Admin', 'Branch', 'Purchases', 'Sales', 'Prescriptions', 'GST', 'Total Revenue', 'Branch Performance', 'Actions'].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead><tbody>{loading ? <tr><td colSpan="10"><div className="reports-state">Loading report rows...</div></td></tr> : filteredRecords.length ? filteredRecords.map((record, index) => { const performance = record.performance ?? (totals.maximum ? record.revenue / totals.maximum * 100 : 0); return <tr key={record.id}><td>{index + 1}</td><td><span className="admin-avatar">{record.admin.slice(0, 2).toUpperCase()}</span>{record.admin}</td><td>{record.branch}</td><td>{money.format(record.purchases)}</td><td>{money.format(record.sales)}</td><td>{number.format(record.prescriptions)}</td><td>{money.format(record.gst)}</td><td><strong>{money.format(record.revenue)}</strong></td><td><div className="performance-cell"><span><i style={{ width: `${Math.min(Math.max(performance, 0), 100)}%` }} /></span><b>{number.format(performance)}%</b></div></td><td><button className="view-button" type="button" aria-label={`View ${record.branch}`}>◉</button></td></tr> }) : <tr><td colSpan="10"><div className="reports-state">No pharmacy reports found.</div></td></tr>}</tbody></table></div></section>
    </main>
  </div>
}

export default Reports
