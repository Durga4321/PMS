import { useEffect, useState, useMemo } from 'react'
import { useToast } from '../../components/ToastProvider'
import AdminLayout from './AdminLayout'
import {
  getDailySalesReport,
  getPharmacyAlerts,
  getPharmacyAuditLogs,
  getPharmacyAdminDashboard,
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
  const value = (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(key) : null) || 
                (typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null)
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

const normalizeList = (response) => {
  if (Array.isArray(response)) return response
  const data = response?.data ?? response
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.items)) return data.items
  if (Array.isArray(data?.results)) return data.results
  if (Array.isArray(data?.records)) return data.records
  if (Array.isArray(data?.logs)) return data.logs
  if (Array.isArray(data?.bills)) return data.bills
  if (Array.isArray(data?.payments)) return data.payments
  if (Array.isArray(data?.medicines)) return data.medicines
  if (Array.isArray(data?.suppliers)) return data.suppliers
  if (Array.isArray(data?.orders)) return data.orders
  if (Array.isArray(data?.transfers)) return data.transfers
  if (Array.isArray(data?.sales)) return data.sales
  if (Array.isArray(response?.items)) return response.items
  if (Array.isArray(response?.results)) return response.results
  return []
}

const IGNORED_KEYS = new Set([
  'clinicId', 'clinic', 'branch', '__v', 'password', 'hash', 'salt',
  'deletedAt', 'updatedAt', 'systemAction', 'isLoginActivity'
])

function formatHeaderName(key) {
  const MAP = {
    id: 'ID',
    userId: 'User ID',
    userName: 'User Name',
    role: 'Role',
    action: 'Action',
    ipAddress: 'IP Address',
    createdAt: 'Date & Time',
    timestamp: 'Date & Time',
    date: 'Date',
    orderDate: 'Order Date',
    medicineName: 'Medicine Name',
    medicineCode: 'Medicine Code',
    genericName: 'Generic Name',
    batchNo: 'Batch No.',
    batchNumber: 'Batch No.',
    quantity: 'Quantity',
    qty: 'Quantity',
    stock: 'Stock Qty',
    totalAmount: 'Total Amount',
    amount: 'Amount',
    total: 'Total',
    paymentMethod: 'Payment Mode',
    paymentMode: 'Payment Mode',
    status: 'Status',
    notes: 'Notes',
    expiryDate: 'Expiry Date',
    supplierName: 'Supplier Name',
    contactPerson: 'Contact Person',
    phone: 'Phone',
    email: 'Email'
  }
  if (MAP[key]) return MAP[key]
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()).trim()
}

function formatCellValue(val, key) {
  if (val === null || val === undefined || val === '') return '-'
  if (typeof val === 'boolean') {
    return val ? 'Yes' : 'No'
  }
  if (typeof val === 'object') {
    if (val instanceof Date) return val.toLocaleString()
    return val.name || val.userName || val.label || '-'
  }
  const sKey = String(key || '').toLowerCase()
  if (sKey.includes('date') || sKey.includes('time')) {
    const str = String(val)
    if (str.includes('T') || !isNaN(Date.parse(str))) {
      const d = new Date(str)
      if (!isNaN(d.getTime())) return d.toLocaleString()
    }
  }
  if (sKey.includes('amount') || sKey.includes('price') || sKey === 'total' || sKey === 'grandtotal' || sKey === 'sales') {
    if (!isNaN(Number(val)) && Number(val) > 0 && !sKey.includes('id') && !sKey.includes('code') && !sKey.includes('qty') && !sKey.includes('quantity')) {
      return `₹${Number(val).toLocaleString('en-IN')}`
    }
  }
  return String(val)
}

export default function Reports() {
  const { showToast } = useToast()
  const [items, setItems] = useState([])
  const [searchId, setSearchId] = useState('')
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
    // Automatically load Sales Report on initial render
    runReport('Sales Report', getPharmacySalesReport)
  }, [])

  async function runReport(reportName, reportFn) {
    setLoading(true)
    setSelectedReportTitle(reportName)
    try {
      const response = await reportFn(searchId)
      const list = normalizeList(response)
      setItems(list)
      showToast(`${reportName} loaded (${list.length} records).`)
    } catch (error) {
      showToast(error.message, 'error')
      setItems([])
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
    const rawKeys = [...new Set(items.flatMap((item) => Object.keys(item || {})))]
    return rawKeys.filter((k) => !IGNORED_KEYS.has(k)).slice(0, 8)
  }, [items])

  return (
    <AdminLayout headerAction={<button
              className="page-heading-refresh"
              type="button"
              onClick={() => {
                const active = reportCards.find(r => r.title === selectedReportTitle)
                if (active) {
                  runReport(active.title, active.fn)
                } else {
                  runReport('Sales Report', getPharmacySalesReport)
                }
              }}
            ><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M20 7v5h-5M20 12a8 8 0 1 0-2.34 5.66" /></svg>Refresh</button>} activeLabel="Reports" title="Pharmacy Reports Dashboard" subtitle="Admin / Reports">
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
                  runReport('Sales Report', getPharmacySalesReport)
                }
              }}
            >
              Refresh
            </button>
          </div>

          {/* Results Details Display */}
          <section className="report-results-panel">
            <div className="report-results-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2>{selectedReportTitle || 'Operational Records'}</h2>
                <p>Showing {items.length} records</p>
              </div>
            </div>

            {loading ? (
              <p style={{ padding: '24px 0', color: '#64748b' }}>Running report query, please wait...</p>
            ) : (
              <div 
                className="branch-table-wrap dashboard-table-scroll-box"
                style={{ maxHeight: '440px', overflowY: 'auto', overflowX: 'auto', scrollbarWidth: 'thin' }}
              >
                <table className="branch-table">
                  <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 2 }}>
                    <tr>
                      <th style={{ width: '60px', position: 'sticky', top: 0, background: '#f8fafc', zIndex: 2 }}>S.No</th>
                      {keys.map((key) => (
                        <th key={key} style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 2 }}>
                          {formatHeaderName(key)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.length ? items.map((item, index) => (
                      <tr key={item?._id || item?.id || index}>
                        <td>{index + 1}</td>
                        {keys.map((key) => {
                          const val = item?.[key]
                          const sKey = String(key).toLowerCase()
                          if (sKey === 'status') {
                            const sVal = String(val ?? 'Active')
                            const isGood = sVal.toLowerCase().includes('active') || sVal.toLowerCase().includes('in stock') || sVal.toLowerCase().includes('success') || sVal.toLowerCase().includes('ready')
                            return (
                              <td key={key}>
                                <span className={`branch-status ${isGood ? 'active' : 'expired'}`}>{sVal}</span>
                              </td>
                            )
                          }
                          if (sKey === 'role') {
                            return (
                              <td key={key}>
                                <span className="sup-cat-pill">{String(val || '-')}</span>
                              </td>
                            )
                          }
                          if (sKey === 'action') {
                            return (
                              <td key={key}>
                                <span className="branch-status active">{String(val || '-')}</span>
                              </td>
                            )
                          }
                          return (
                            <td key={key}>
                              {formatCellValue(val, key)}
                            </td>
                          )
                        })}
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={keys.length + 1} style={{ textAlign: 'center', padding: '36px 16px', color: '#64748b' }}>
                          No records found for this report.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>

        </div>
      </div>
    </AdminLayout>
  )
}
