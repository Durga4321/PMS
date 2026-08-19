import { useEffect, useState, useMemo } from 'react'
import { useToast } from '../../components/ToastProvider'
import AdminLayout from './AdminLayout'
import {
  getDailySalesReport,
  getPharmacyAlerts,
  getPharmacyAuditLogs,
  getPharmacyDashboard,
  getPharmacyExpiryReport,
  getPharmacyPayments,
  getPharmacyPurchasesReport,
  getPharmacySalesReport,
  getPharmacyStockMovementReport,
  getPharmacyStockSummaryReport,
  getPharmacyTopSellingReport
} from '../../config/api'
import './Reports.css'

function readStoredValue(key) {
  const value = sessionStorage.getItem(key) || localStorage.getItem(key)
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

const normalizeList = (response) => {
  if (Array.isArray(response)) return response
  if (Array.isArray(response?.data)) return response.data
  if (Array.isArray(response?.items)) return response.items
  if (Array.isArray(response?.results)) return response.results
  if (Array.isArray(response?.suppliers)) return response.suppliers
  if (Array.isArray(response?.orders)) return response.orders
  if (Array.isArray(response?.transfers)) return response.transfers
  return []
}

export default function Reports() {
  const { showToast } = useToast()
  const [items, setItems] = useState([])
  const [searchId, setSearchId] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedReportTitle, setSelectedReportTitle] = useState('')
  
  const [pharmacyInfo, setPharmacyInfo] = useState({
    name: 'Pharmacy Console',
    branch: 'Main Branch',
    phone: '-',
    email: '-',
    address: '-',
    status: 'Active'
  })

  useEffect(() => {
    const user = readStoredValue('pharmacyAdminUser') || {}
    const assignment = readStoredValue('pharmacyAdminAssignment') || {}
    setPharmacyInfo({
      name: assignment?.pharmacyName || assignment?.pharmacy?.name || assignment?.hospitalName || assignment?.hospital?.name || 'Pharmacy Console',
      branch: assignment?.branchName || assignment?.branch?.name || 'Main Branch',
      phone: user?.phone || user?.mobile || assignment?.phone || '-',
      email: user?.email || assignment?.email || '-',
      address: assignment?.address || assignment?.location || '-',
      status: assignment?.status || 'Active'
    })
    
    loadInitialData()
  }, [])

  async function loadInitialData() {
    setLoading(true)
    try {
      const response = await getPharmacyDashboard()
      const data = normalizeList(response)
      setItems(data)
      setMessage(JSON.stringify(response?.data && !Array.isArray(response.data) ? response.data : '', null, 2))
    } catch (error) {
      showToast(error.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  async function runReport(reportName, reportFn) {
    setLoading(true)
    setSelectedReportTitle(reportName)
    try {
      const response = await reportFn(searchId)
      const list = normalizeList(response)
      setItems(list)
      setMessage(JSON.stringify(response?.data || response, null, 2))
      showToast(`${reportName} loaded successfully.`)
    } catch (error) {
      showToast(error.message, 'error')
      setItems([])
      setMessage('')
    } finally {
      setLoading(false)
    }
  }

  const reportCards = [
    {
      title: 'Sales Report',
      description: 'Comprehensive view of sales transactions and revenue trends.',
      bgTint: '#eff6ff',
      colorAccent: '#2563eb',
      icon: (
        <svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
      ),
      fn: getPharmacySalesReport
    },
    {
      title: 'Purchase Report',
      description: 'Track incoming pharmacy inventory purchases and invoice logs.',
      bgTint: '#faf5ff',
      colorAccent: '#9333ea',
      icon: (
        <svg viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
      ),
      fn: getPharmacyPurchasesReport
    },
    {
      title: 'Daily Sales',
      description: 'Check daily breakdowns of pharmacy checkout register logs.',
      bgTint: '#fff7ed',
      colorAccent: '#ea580c',
      icon: (
        <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      ),
      fn: getDailySalesReport
    },
    {
      title: 'Payments Report',
      description: 'Audit payment transaction history, cash, card, and digital logs.',
      bgTint: '#f0fdf4',
      colorAccent: '#16a34a',
      icon: (
        <svg viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
      ),
      fn: getPharmacyPayments
    },
    {
      title: 'Stock Summary',
      description: 'Get real-time quantity summaries of current medicine batches.',
      bgTint: '#f0fdfa',
      colorAccent: '#0d9488',
      icon: (
        <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
      ),
      fn: getPharmacyStockSummaryReport
    },
    {
      title: 'Stock Movement',
      description: 'Monitor supply chain movement, transfers, and inventory audits.',
      bgTint: '#eef2ff',
      colorAccent: '#4f46e5',
      icon: (
        <svg viewBox="0 0 24 24"><polyline points="17 11 12 6 7 11"/><polyline points="17 18 12 13 7 18"/></svg>
      ),
      fn: getPharmacyStockMovementReport
    },
    {
      title: 'Expiry Report',
      description: 'Highlight near-expiry and already expired medicine stocks.',
      bgTint: '#fffbeb',
      colorAccent: '#d97706',
      icon: (
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      ),
      fn: getPharmacyExpiryReport
    },
    {
      title: 'Top Selling Products',
      description: 'Identify top performing medicine brands by demand and sales.',
      bgTint: '#fdf2f8',
      colorAccent: '#db2777',
      icon: (
        <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>
      ),
      fn: getPharmacyTopSellingReport
    },
    {
      title: 'Audit Logs',
      description: 'Detailed security and system access logs for audit compliance.',
      bgTint: '#f8fafc',
      colorAccent: '#475569',
      icon: (
        <svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
      ),
      fn: getPharmacyAuditLogs
    },
    {
      title: 'Alerts & Notifications',
      description: 'Access triggered safety alerts, low-stock warnings, and updates.',
      bgTint: '#fff5f5',
      colorAccent: '#e03131',
      icon: (
        <svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
      ),
      fn: getPharmacyAlerts
    }
  ]

  const keys = useMemo(() => {
    return [...new Set(items.flatMap((item) => Object.keys(item || {})))].slice(0, 7)
  }, [items])

  return (
    <AdminLayout activeLabel="Reports" title="Pharmacy Reports Dashboard" subtitle="Admin / Reports">
      <div className="stock-scroll-area">
        <div className="reports-layout-container">

          {/* Report Cards Grid */}
          <div className="reports-cards-grid">
            {reportCards.map((report) => (
              <div 
                key={report.title} 
                className={`report-card ${selectedReportTitle === report.title ? 'is-active' : ''}`}
              >
                <div 
                  className="report-card-icon"
                  style={{
                    background: report.bgTint,
                    color: report.colorAccent
                  }}
                >
                  {report.icon}
                </div>
                <div className="report-card-info">
                  <h3>{report.title}</h3>
                  <p>{report.description}</p>
                </div>
                <button 
                  type="button" 
                  className="report-card-action"
                  onClick={() => runReport(report.title, report.fn)}
                >
                  Open report &rarr;
                </button>
              </div>
            ))}
          </div>

          {/* Search Toolbar */}
          <div className="report-search-toolbar">
            <div className="report-search-input-wrap">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="search-icon"><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></svg>
              <input 
                value={searchId} 
                onChange={(event) => setSearchId(event.target.value)} 
                placeholder="Enter Record ID / Bill ID to filter..." 
              />
            </div>
            <button 
              className="report-refresh-btn" 
              type="button" 
              onClick={() => {
                const active = reportCards.find(r => r.title === selectedReportTitle)
                if (active) {
                  runReport(active.title, active.fn)
                } else {
                  loadInitialData()
                }
              }}
            >
              Refresh
            </button>
          </div>

          {/* Results Details Display */}
          <section className="report-results-panel">
            <div className="report-results-header">
              <h2>{selectedReportTitle || 'General Dashboard Data'}</h2>
              <p>Tabular results preview and JSON logs</p>
            </div>
            
            {loading ? (
              <p>Running report query, please wait...</p>
            ) : (
              <>
                <div className="branch-table-wrap">
                  <table className="branch-table">
                    <thead>
                      <tr>
                        {keys.length ? keys.map((key) => <th key={key}>{key}</th>) : <th>Result</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {items.length ? items.map((item, index) => (
                        <tr key={item?._id || item?.id || index}>
                          {keys.map((key) => <td key={key}>{String(item?.[key] ?? '-')}</td>)}
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={Math.max(keys.length, 1)}>No data found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {message ? (
                  <pre className="inventory-json" style={{ marginTop: '20px' }}>{message}</pre>
                ) : null}
              </>
            )}
          </section>

        </div>
      </div>
    </AdminLayout>
  )
}
