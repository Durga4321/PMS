import { useEffect, useMemo, useRef, useState } from 'react'
import {
  exportSuperAdminRevenueExcel,
  exportSuperAdminRevenuePdf,
  getSuperAdminPharmacies,
  getSuperAdminRevenueReport,
  listPharmacyAdmins,
} from '../../config/api'
import SuperAdminSidebar from './SuperAdminSidebar'
import SuperAdminTopbar from './SuperAdminTopbar'
import './Reports.css'

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 })
const number = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 })

function valueOf(item, names, fallback = '') {
  if (!item || typeof item !== 'object') return fallback
  for (const name of names) {
    if (item[name] !== undefined && item[name] !== null && item[name] !== '') {
      return item[name]
    }
  }
  return fallback
}

function numeric(value) {
  const parsed = Number(String(value ?? '').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

function recordsFrom(response) {
  if (Array.isArray(response)) return response
  return ['data', 'items', 'results', 'reports', 'rows', 'records'].reduce(
    (records, key) => records.length ? records : (Array.isArray(response?.[key]) ? response[key] : []),
    []
  )
}

function unwrapList(response, preferredKey) {
  const body = response?.data ?? response
  if (Array.isArray(body)) return body
  if (preferredKey && Array.isArray(body?.[preferredKey])) return body[preferredKey]
  if (Array.isArray(body?.pharmacies)) return body.pharmacies
  if (Array.isArray(body?.admins)) return body.admins
  if (Array.isArray(body?.items)) return body.items
  if (Array.isArray(body?.results)) return body.results
  if (Array.isArray(body?.data)) return body.data
  return []
}

function getOptionId(item) {
  if (!item) return ''
  return String(item.id ?? item.pharmacyId ?? item.adminId ?? item.userId ?? item.AdminId ?? item._id ?? '')
}

function getAdminName(admin) {
  if (!admin) return 'Unassigned'
  return admin.name || admin.fullName || admin.adminName || admin.userName || admin.email || 'Admin'
}

function getPharmacyName(pharmacy) {
  if (!pharmacy) return 'All Branches'
  return pharmacy.pharmacyName || pharmacy.name || pharmacy.branchName || `Branch ${pharmacy.id || ''}`
}

function normalize(item, index, adminOptions = [], pharmacyOptions = []) {
  const adminId = valueOf(item, ['adminId', 'AdminId', 'pharmacyAdminId', 'userId'])
  let admin = valueOf(item, ['adminName', 'admin', 'createdBy', 'pharmacyAdmin', 'assignedAdminName'], '')
  if (!admin && adminId && adminOptions.length) {
    const matched = adminOptions.find((a) => String(getOptionId(a)) === String(adminId))
    if (matched) admin = getAdminName(matched)
  }
  if (!admin) admin = 'Unassigned'

  const pharmacyId = valueOf(item, ['pharmacyId', 'PharmacyId', 'branchId', 'BranchId', 'hospitalId'])
  let branch = valueOf(item, ['branchName', 'branch', 'pharmacyName', 'name'], '')
  if (!branch && pharmacyId && pharmacyOptions.length) {
    const matched = pharmacyOptions.find((p) => String(getOptionId(p)) === String(pharmacyId))
    if (matched) branch = getPharmacyName(matched)
  }
  if (!branch) branch = 'Main Branch'

  const purchases = numeric(valueOf(item, ['purchases', 'purchaseAmount', 'totalPurchases']))
  const sales = numeric(valueOf(item, ['sales', 'salesAmount', 'totalSales', 'saleAmount']))
  const prescriptions = numeric(valueOf(item, ['prescriptions', 'prescriptionCount', 'totalPrescriptions', 'orders', 'orderCount']))
  const gst = numeric(valueOf(item, ['gst', 'gstAmount', 'totalGst', 'tax']))
  const revenue = numeric(valueOf(item, ['totalRevenue', 'revenue', 'amount', 'netRevenue', 'total'])) || (sales + gst)
  const performanceVal = valueOf(item, ['branchPerformance', 'performance', 'performanceScore'])
  const performance = performanceVal !== '' && performanceVal !== null ? numeric(performanceVal) : null

  return {
    id: valueOf(item, ['_id', 'id', 'reportId'], `rep_${index + 1}`),
    adminId: String(adminId || ''),
    pharmacyId: String(pharmacyId || ''),
    admin,
    branch,
    date: valueOf(item, ['date', 'reportDate', 'saleDate', 'createdAt'], ''),
    status: valueOf(item, ['status', 'reportStatus', 'paymentStatus'], 'Completed'),
    purchases,
    sales,
    prescriptions,
    gst,
    revenue,
    performance,
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
  const [adminFilter, setAdminFilter] = useState('')
  const [branchFilter, setBranchFilter] = useState('')
  const [activeTab, setActiveTab] = useState('Revenue Report')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [adminOptions, setAdminOptions] = useState([])
  const [pharmacyOptions, setPharmacyOptions] = useState([])
  const [optionsLoading, setOptionsLoading] = useState(false)

  const initialLoadRef = useRef(false)

  async function loadOptions() {
    setOptionsLoading(true)
    try {
      const [adminsRes, pharmaciesRes] = await Promise.all([
        listPharmacyAdmins({ page: 1, pageSize: 100 }).catch(() => []),
        getSuperAdminPharmacies({ page: 1, pageSize: 100 }).catch(() => []),
      ])
      setAdminOptions(unwrapList(adminsRes, 'admins'))
      setPharmacyOptions(unwrapList(pharmaciesRes, 'pharmacies'))
    } catch (err) {
      console.warn('Failed to load filter options:', err)
    } finally {
      setOptionsLoading(false)
    }
  }

  async function loadReport(branchOverride) {
    setLoading(true)
    setError(null)
    try {
      const activeBranch = branchOverride !== undefined ? branchOverride : branchFilter
      const params = {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        pharmacyId: activeBranch || undefined,
      }
      const response = await getSuperAdminRevenueReport(params)
      const list = recordsFrom(response).map((item, idx) => normalize(item, idx, adminOptions, pharmacyOptions))
      setRecords(list)
    } catch (err) {
      setError(err?.message || 'Failed to load pharmacy reports. Please check your connection and try again.')
      setRecords([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!initialLoadRef.current) {
      initialLoadRef.current = true
      loadOptions()
      loadReport('')
    }
  }, [])

  const filteredRecords = useMemo(() => records.filter((record) => {
    const text = [record.admin, record.branch, record.revenue, record.sales, record.status].join(' ').toLowerCase()
    const matchesQuery = !query.trim() || text.includes(query.trim().toLowerCase())
    const date = record.date ? new Date(record.date) : null
    const matchesStart = !startDate || !date || date >= new Date(`${startDate}T00:00:00`)
    const matchesEnd = !endDate || !date || date <= new Date(`${endDate}T23:59:59`)
    const matchesStatus = filter === 'All' || String(record.status || '').toLowerCase() === filter.toLowerCase()
    const matchesAdmin = !adminFilter ||
      String(record.adminId || '').toLowerCase() === adminFilter.toLowerCase() ||
      String(record.admin || '').toLowerCase() === adminFilter.toLowerCase() ||
      String(record.admin || '').toLowerCase().includes(adminFilter.toLowerCase())
    const matchesBranch = !branchFilter ||
      String(record.pharmacyId || '').toLowerCase() === branchFilter.toLowerCase() ||
      String(record.branch || '').toLowerCase() === branchFilter.toLowerCase() ||
      String(record.branch || '').toLowerCase().includes(branchFilter.toLowerCase())
    return matchesQuery && matchesStart && matchesEnd && matchesStatus && matchesAdmin && matchesBranch
  }), [endDate, filter, query, records, startDate, adminFilter, branchFilter])

  const totals = useMemo(() => {
    const revenue = filteredRecords.reduce((sum, record) => sum + record.revenue, 0)
    const sales = filteredRecords.reduce((sum, record) => sum + record.sales, 0)
    const purchases = filteredRecords.reduce((sum, record) => sum + record.purchases, 0)
    const prescriptions = filteredRecords.reduce((sum, record) => sum + record.prescriptions, 0)
    const gst = filteredRecords.reduce((sum, record) => sum + record.gst, 0)
    const branchCount = new Set(filteredRecords.map((record) => record.branch)).size
    const scored = filteredRecords.filter((record) => record.performance !== null)
    const performance = scored.length ? scored.reduce((sum, record) => sum + record.performance, 0) / scored.length : 0
    const maximum = Math.max(...filteredRecords.map((record) => record.revenue), 0)
    const sortedByPerf = [...filteredRecords].sort((a, b) => (b.performance ?? 0) - (a.performance ?? 0))
    const topBranch = sortedByPerf[0]?.branch || '-'
    return { revenue, sales, purchases, prescriptions, gst, branchCount, performance, maximum, topBranch }
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
    if (type === 'PDF') {
      await exportSuperAdminRevenuePdf(filteredRecords)
    } else {
      await exportSuperAdminRevenueExcel(filteredRecords)
    }
  }

  return (
    <div className={`super-admin-shell${sidebarOpen ? ' sidebar-open' : ''}`}>
      <SuperAdminSidebar activeLabel="Reports" />
      <main className="super-admin-main reports-page">
        <SuperAdminTopbar onMenu={() => setSidebarOpen((value) => !value)} />
        <section className="reports-heading">
          <div>
            <p className="super-admin-eyebrow">Super Admin</p>
            <h1>Pharmacy Reports</h1>
            <p>Sales, revenue, and performance reports across all pharmacy branches.</p>
          </div>
          <div className="reports-actions">
            <button type="button" onClick={() => exportReport('PDF')}>
              <Icon><path d="M6 3h9l3 3v15H6zM15 3v4h4M9 13h6M9 17h4" /></Icon>
              Export PDF
            </button>
            <button className="reports-primary" type="button" onClick={() => exportReport('Excel')}>
              <Icon><path d="M5 3h14v18H5zM8 8h8M8 12h8M8 16h5" /></Icon>
              Export Excel
            </button>
          </div>
        </section>

        {error && (
          <div className="reports-error" role="alert">
            <span>{error}</span>
            <button type="button" onClick={() => loadReport()}>Retry</button>
          </div>
        )}

        <section className="reports-panel reports-toolbar">
          <label className="reports-search">
            <Icon><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></Icon>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search reports by admin, branch, revenue, or status..."
            />
          </label>

          <select
            value={adminFilter}
            onChange={(event) => setAdminFilter(event.target.value)}
            aria-label="Filter by admin"
            className="reports-select-admin"
          >
            <option value="">All Admins</option>
            {adminOptions.map((admin) => {
              const id = getOptionId(admin)
              const name = getAdminName(admin)
              return <option key={id || name} value={id || name}>{name}</option>
            })}
          </select>

          <select
            value={branchFilter}
            onChange={(event) => setBranchFilter(event.target.value)}
            aria-label="Filter by branch"
            className="reports-select-branch"
          >
            <option value="">All Branches</option>
            {pharmacyOptions.map((pharmacy) => {
              const id = getOptionId(pharmacy)
              const name = getPharmacyName(pharmacy)
              return <option key={id || name} value={id}>{name}</option>
            })}
          </select>

          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            aria-label="Report filter"
          >
            <option value="All">All Statuses</option>
            <option value="Completed">Completed</option>
            <option value="Pending">Pending</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          <div className="reports-tabs-row">
            {['Revenue Report', 'Sales & Orders', 'Branch Performance'].map((tab) => (
              <button
                key={tab}
                className={`reports-tab${activeTab === tab ? ' is-active' : ''}`}
                aria-pressed={activeTab === tab}
                type="button"
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="reports-date-row">
            <label>
              Start Date
              <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </label>
            <label>
              End Date
              <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            </label>
            <button className="reports-primary reports-fetch" type="button" onClick={() => loadReport()}>
              Fetch Report
            </button>
          </div>
        </section>

        {/* Dynamic Category Stat Cards */}
        <section className="reports-stat-grid">
          {activeTab === 'Revenue Report' && (
            <>
              <article className="reports-stat">
                <span className="stat-mark revenue-mark">
                  <Icon><path d="M12 3v18M16 7.5c-.7-.8-1.8-1.2-3.2-1.2-1.8 0-3.2 1-3.2 2.5s1.2 2.2 3.2 2.7c2 .5 3.2 1.2 3.2 2.8s-1.4 2.5-3.2 2.5c-1.4 0-2.5-.4-3.2-1.2" /></Icon>
                </span>
                <div>
                  <small>Total Revenue</small>
                  <strong>{money.format(totals.revenue)}</strong>
                  <em>Across all branches</em>
                </div>
              </article>
              <article className="reports-stat">
                <span className="stat-mark performance-mark">
                  <Icon><path d="M5 17 10 12l3 3 6-8" /><path d="M15 7h4v4" /></Icon>
                </span>
                <div>
                  <small>Avg. Branch Performance</small>
                  <strong>{number.format(totals.performance)}%</strong>
                  <em>Performance Score</em>
                </div>
              </article>
              <article className="reports-stat">
                <span className="stat-mark branch-mark">
                  <Icon><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 8h8M8 12h8M8 16h8" /></Icon>
                </span>
                <div>
                  <small>Total Branches</small>
                  <strong>{number.format(totals.branchCount)}</strong>
                  <em>Active branches</em>
                </div>
              </article>
            </>
          )}

          {activeTab === 'Sales & Orders' && (
            <>
              <article className="reports-stat">
                <span className="stat-mark revenue-mark">
                  <Icon><path d="M12 3v18M16 7.5c-.7-.8-1.8-1.2-3.2-1.2-1.8 0-3.2 1-3.2 2.5s1.2 2.2 3.2 2.7c2 .5 3.2 1.2 3.2 2.8s-1.4 2.5-3.2 2.5c-1.4 0-2.5-.4-3.2-1.2" /></Icon>
                </span>
                <div>
                  <small>Total Sales Volume</small>
                  <strong>{money.format(totals.sales)}</strong>
                  <em>Gross medicines sales</em>
                </div>
              </article>
              <article className="reports-stat">
                <span className="stat-mark performance-mark">
                  <Icon><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 8h8M8 12h8M8 16h8" /></Icon>
                </span>
                <div>
                  <small>Total Prescriptions / Orders</small>
                  <strong>{number.format(totals.prescriptions)}</strong>
                  <em>Fulfilled prescriptions</em>
                </div>
              </article>
              <article className="reports-stat">
                <span className="stat-mark branch-mark">
                  <Icon><path d="M5 17 10 12l3 3 6-8" /><path d="M15 7h4v4" /></Icon>
                </span>
                <div>
                  <small>Avg. Order Value</small>
                  <strong>{money.format(totals.prescriptions ? totals.sales / totals.prescriptions : 0)}</strong>
                  <em>Revenue per prescription</em>
                </div>
              </article>
            </>
          )}

          {activeTab === 'Branch Performance' && (
            <>
              <article className="reports-stat">
                <span className="stat-mark performance-mark">
                  <Icon><path d="M5 17 10 12l3 3 6-8" /><path d="M15 7h4v4" /></Icon>
                </span>
                <div>
                  <small>Top Performing Branch</small>
                  <strong>{totals.topBranch}</strong>
                  <em>Highest efficiency score</em>
                </div>
              </article>
              <article className="reports-stat">
                <span className="stat-mark revenue-mark">
                  <Icon><path d="M12 3v18M16 7.5c-.7-.8-1.8-1.2-3.2-1.2-1.8 0-3.2 1-3.2 2.5s1.2 2.2 3.2 2.7c2 .5 3.2 1.2 3.2 2.8s-1.4 2.5-3.2 2.5c-1.4 0-2.5-.4-3.2-1.2" /></Icon>
                </span>
                <div>
                  <small>Avg. Performance Score</small>
                  <strong>{number.format(totals.performance)}%</strong>
                  <em>Efficiency index</em>
                </div>
              </article>
              <article className="reports-stat">
                <span className="stat-mark branch-mark">
                  <Icon><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 8h8M8 12h8M8 16h8" /></Icon>
                </span>
                <div>
                  <small>Active Branches</small>
                  <strong>{number.format(totals.branchCount)}</strong>
                  <em>Locations tracked</em>
                </div>
              </article>
            </>
          )}
        </section>

        <section className="reports-chart-grid">
          <article className="reports-panel chart-panel">
            <h2>Revenue Overview</h2>
            {loading ? (
              <div className="reports-state">Loading chart data...</div>
            ) : timeline.length ? (
              <div className="bar-chart">
                {timeline.map(([label, revenue]) => (
                  <div className="bar-item" key={label}>
                    <span
                      style={{ height: `${Math.max((revenue / (totals.maximum || 1)) * 100, 5)}%` }}
                      title={money.format(revenue)}
                    />
                    <small>{displayDate(label)}</small>
                  </div>
                ))}
              </div>
            ) : (
              <div className="reports-state">No revenue data for this range.</div>
            )}
          </article>

          <article className="reports-panel chart-panel">
            <h2>Revenue by Branch</h2>
            {loading ? (
              <div className="reports-state">Loading branch data...</div>
            ) : branches.length ? (
              <div className="branch-chart">
                <div
                  className="donut"
                  style={{
                    background: `conic-gradient(${branches
                      .map(
                        ([branch, revenue], index) =>
                          `${['#0f9d9d', '#3b82f6', '#f59e0b', '#94a3b8'][index % 4]} ${
                            (branches.slice(0, index).reduce((sum, item) => sum + item[1], 0) / (totals.revenue || 1)) * 100
                          }% ${
                            (branches.slice(0, index + 1).reduce((sum, item) => sum + item[1], 0) / (totals.revenue || 1)) * 100
                          }%`
                      )
                      .join(', ')})`,
                  }}
                >
                  <b>{money.format(totals.revenue)}</b>
                </div>
                <div className="branch-legend">
                  {branches.map(([branch, revenue], index) => (
                    <div key={branch}>
                      <i className={`legend-dot dot-${index % 4}`} />
                      <b>{branch}</b>
                      <small>
                        {money.format(revenue)}{' '}
                        <em>{totals.revenue ? `${number.format((revenue / totals.revenue) * 100)}%` : '0%'}</em>
                      </small>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="reports-state">No branch data for this range.</div>
            )}
          </article>
        </section>

        <section className="reports-panel reports-table-panel">
          <header className="reports-table-heading">
            <div>
              <h2>Branch Revenue Details</h2>
              <p>Performance by pharmacy branch and administrator.</p>
            </div>
            <span>{loading ? 'Loading...' : `Showing ${filteredRecords.length} of ${records.length} records`}</span>
          </header>
          <div className="reports-table-wrap">
            <table>
              <thead>
                <tr>
                  {activeTab === 'Sales & Orders' ? (
                    ['S.No', 'Admin', 'Branch', 'Prescriptions', 'Sales Amount', 'Purchases', 'GST', 'Total Revenue', 'Status', 'Actions'].map((heading) => (
                      <th key={heading}>{heading}</th>
                    ))
                  ) : activeTab === 'Branch Performance' ? (
                    ['S.No', 'Admin', 'Branch', 'Total Revenue', 'Purchases', 'Sales', 'GST', 'Branch Performance', 'Status', 'Actions'].map((heading) => (
                      <th key={heading}>{heading}</th>
                    ))
                  ) : (
                    ['S.No', 'Admin', 'Branch', 'Purchases', 'Sales', 'Prescriptions', 'GST', 'Total Revenue', 'Branch Performance', 'Actions'].map((heading) => (
                      <th key={heading}>{heading}</th>
                    ))
                  )}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="10">
                      <div className="reports-state">Loading report rows...</div>
                    </td>
                  </tr>
                ) : filteredRecords.length ? (
                  filteredRecords.map((record, index) => {
                    const performance = record.performance ?? (totals.maximum ? (record.revenue / totals.maximum) * 100 : 75)
                    return (
                      <tr key={record.id || index}>
                        <td>{index + 1}</td>
                        <td>
                          <span className="admin-avatar">{(record.admin || 'PA').slice(0, 2).toUpperCase()}</span>
                          {record.admin}
                        </td>
                        <td>{record.branch}</td>

                        {activeTab === 'Sales & Orders' ? (
                          <>
                            <td>{number.format(record.prescriptions)}</td>
                            <td>{money.format(record.sales)}</td>
                            <td>{money.format(record.purchases)}</td>
                            <td>{money.format(record.gst)}</td>
                            <td><strong>{money.format(record.revenue)}</strong></td>
                            <td>
                              <span className={`status-pill status-${String(record.status || '').toLowerCase()}`}>
                                {record.status || 'Completed'}
                              </span>
                            </td>
                          </>
                        ) : activeTab === 'Branch Performance' ? (
                          <>
                            <td><strong>{money.format(record.revenue)}</strong></td>
                            <td>{money.format(record.purchases)}</td>
                            <td>{money.format(record.sales)}</td>
                            <td>{money.format(record.gst)}</td>
                            <td>
                              <div className="performance-cell">
                                <span><i style={{ width: `${Math.min(Math.max(performance, 0), 100)}%` }} /></span>
                                <b>{number.format(performance)}%</b>
                              </div>
                            </td>
                            <td>
                              <span className={`status-pill status-${String(record.status || '').toLowerCase()}`}>
                                {record.status || 'Completed'}
                              </span>
                            </td>
                          </>
                        ) : (
                          <>
                            <td>{money.format(record.purchases)}</td>
                            <td>{money.format(record.sales)}</td>
                            <td>{number.format(record.prescriptions)}</td>
                            <td>{money.format(record.gst)}</td>
                            <td><strong>{money.format(record.revenue)}</strong></td>
                            <td>
                              <div className="performance-cell">
                                <span><i style={{ width: `${Math.min(Math.max(performance, 0), 100)}%` }} /></span>
                                <b>{number.format(performance)}%</b>
                              </div>
                            </td>
                          </>
                        )}

                        <td>
                          <button
                            className="view-button"
                            type="button"
                            aria-label={`View ${record.branch}`}
                            title={`View ${record.branch} details`}
                            onClick={() => setSelectedRecord(record)}
                          >
                            ◉
                          </button>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan="10">
                      <div className="reports-state">No pharmacy reports found matching the selected filters.</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {selectedRecord && (
        <div className="sa-modal-backdrop" onClick={() => setSelectedRecord(null)}>
          <div className="sa-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="sa-modal-header">
              <h2>Branch Performance: {selectedRecord.branch}</h2>
              <button type="button" className="sa-modal-close" onClick={() => setSelectedRecord(null)}>
                &times;
              </button>
            </div>
            <div className="sa-modal-body">
              <div className="sa-modal-grid">
                <div className="sa-modal-field">
                  <label>Branch Name</label>
                  <span>{selectedRecord.branch}</span>
                </div>
                <div className="sa-modal-field">
                  <label>Assigned Admin</label>
                  <span>{selectedRecord.admin}</span>
                </div>
                <div className="sa-modal-field">
                  <label>Total Revenue</label>
                  <strong style={{ color: '#0f9d9d', fontSize: '16px' }}>{money.format(selectedRecord.revenue)}</strong>
                </div>
                <div className="sa-modal-field">
                  <label>Total Sales</label>
                  <span>{money.format(selectedRecord.sales)}</span>
                </div>
                <div className="sa-modal-field">
                  <label>Total Purchases</label>
                  <span>{money.format(selectedRecord.purchases)}</span>
                </div>
                <div className="sa-modal-field">
                  <label>Prescriptions Count</label>
                  <span>{number.format(selectedRecord.prescriptions)}</span>
                </div>
                <div className="sa-modal-field">
                  <label>GST / Tax</label>
                  <span>{money.format(selectedRecord.gst)}</span>
                </div>
                <div className="sa-modal-field">
                  <label>Status</label>
                  <span>{selectedRecord.status || 'Completed'}</span>
                </div>
                <div className="sa-modal-field">
                  <label>Performance Score</label>
                  <div className="performance-cell" style={{ marginTop: '4px' }}>
                    <span>
                      <i style={{ width: `${Math.min(Math.max(selectedRecord.performance ?? 75, 0), 100)}%` }} />
                    </span>
                    <b>{number.format(selectedRecord.performance ?? 75)}%</b>
                  </div>
                </div>
              </div>
            </div>
            <div className="sa-modal-footer">
              <button type="button" className="sa-btn-primary" onClick={() => setSelectedRecord(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Reports
