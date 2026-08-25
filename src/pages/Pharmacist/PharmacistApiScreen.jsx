import { useCallback, useEffect, useMemo, useState } from 'react'
import { useToast } from '../../components/ToastProvider'
import PharmacistLayout from './PharmacistLayout'

const listKeys = [
  'items',
  'results',
  'records',
  'data',
  'prescriptions',
  'pendingPrescriptions',
  'dispensing',
  'bills',
  'returns',
  'payments',
  'auditLogs',
  'logs',
  'alerts',
  'inventory',
  'medicines',
  'sales',
  'purchases',
  'stockMovement',
  'stockSummary',
  'topSelling',
]

const moduleColumns = {
  Dashboard: [
    ['Metric', ['label', 'title', 'name', 'metric', 'type']],
    ['Value', ['value', 'count', 'total', 'amount', 'quantity']],
    ['Status', ['status', 'state']],
  ],
  Pending: [
    ['Prescription ID', ['prescriptionId', 'externalPrescriptionId', 'recordId', 'id', '_id']],
    ['Patient', ['patientName', 'patient.name', 'patient.fullName', 'patient']],
    ['Doctor', ['doctorName', 'doctor.name', 'doctor.fullName', 'doctor']],
    ['Medicine', ['medicineName', 'medicine.name', 'medicine']],
    ['Status', ['status', 'prescriptionStatus']],
    ['Date', ['createdAt', 'date', 'prescriptionDate']],
  ],
  Dispensing: [
    ['Prescription ID', ['prescriptionId', 'recordId', 'id', '_id']],
    ['Patient', ['patientName', 'patient.name', 'patient']],
    ['Medicine', ['medicineName', 'medicine.name', 'medicine']],
    ['Quantity', ['quantity', 'qty', 'dispensedQuantity']],
    ['Bill ID', ['billId', 'bill.id', 'invoiceId']],
    ['Status', ['status', 'paymentStatus', 'dispenseStatus']],
  ],
  Bills: [
    ['Bill ID', ['billId', 'invoiceId', 'id', '_id']],
    ['Patient', ['patientName', 'patient.name', 'patient']],
    ['Amount', ['totalAmount', 'amount', 'grandTotal', 'total']],
    ['Payment', ['paymentStatus', 'payment.status']],
    ['Status', ['status']],
    ['Date', ['createdAt', 'date', 'billDate']],
  ],
  Returns: [
    ['Return ID', ['returnId', 'id', '_id']],
    ['Bill ID', ['billId', 'bill.id', 'invoiceId']],
    ['Medicine', ['medicineName', 'medicine.name', 'medicine']],
    ['Quantity', ['quantity', 'qty', 'returnQuantity']],
    ['Reason', ['reason', 'returnReason']],
    ['Status', ['status']],
  ],
  Reports: [
    ['Report', ['title', 'name', 'report', 'type']],
    ['Category', ['category', 'reportType', 'module']],
    ['Amount', ['amount', 'total', 'revenue', 'sales']],
    ['Count', ['count', 'quantity', 'totalCount']],
    ['Status', ['status']],
    ['Date', ['createdAt', 'date', 'period']],
  ],
}

const dashboardCards = [
  ['pending', 'Total Pending', ['pendingPrescriptions', 'pendingPrescriptionsCount', 'pendingCount', 'summary.pendingPrescriptions', 'summary.pendingCount']],
  ['dispensed', 'Dispensed Today', ['todayDispensed', 'dispensedCount', 'dispensed', 'summary.todayDispensed', 'summary.dispensedCount']],
  ['bills', 'Total Bills', ['totalBills', 'billsCount', 'paidBillsCount', 'summary.totalBills', 'summary.billsCount']],
  ['returns', 'Returns', ['todayReturns', 'returnsCount', 'returns', 'summary.todayReturns', 'summary.returnsCount']],
]

function getByPath(source, path) {
  return String(path).split('.').reduce((value, key) => value?.[key], source)
}

function pick(source, paths, fallback = '-') {
  for (const path of paths) {
    const value = getByPath(source, path)
    if (value !== undefined && value !== null && value !== '') return value
  }
  return fallback
}

function displayValue(value) {
  if (Array.isArray(value)) return value.length
  if (value && typeof value === 'object') return pick(value, ['name', 'title', 'label', 'id', '_id'], JSON.stringify(value))
  return String(value ?? '-')
}

function unwrapPayload(response) {
  return response?.data?.dashboard || response?.data || response?.dashboard || response || {}
}

function findList(source) {
  if (Array.isArray(source)) return source
  if (!source || typeof source !== 'object') return []

  for (const key of listKeys) {
    const value = source[key]
    if (Array.isArray(value)) return value
    if (value && typeof value === 'object') {
      const nested = findList(value)
      if (nested.length) return nested
    }
  }

  return []
}

function metricsAsRows(source) {
  if (!source || Array.isArray(source) || typeof source !== 'object') return []
  const summary = source.summary || source.stats || source.counts || source

  return Object.entries(summary)
    .filter(([, value]) => value === null || ['string', 'number', 'boolean'].includes(typeof value))
    .map(([key, value]) => ({ label: key.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase()), value }))
}

function normalizeItems(response, activeLabel) {
  const payload = unwrapPayload(response)
  const rows = findList(payload)
  if (rows.length) return rows
  if (activeLabel === 'Dashboard') return metricsAsRows(payload)
  if (payload && typeof payload === 'object' && Object.keys(payload).length) return [payload]
  return []
}

function metricValue(source, paths) {
  const value = pick(source, paths, 0)
  if (Array.isArray(value)) return value.length
  if (value && typeof value === 'object') return Number(value.total ?? value.count ?? value.value ?? Object.keys(value).length) || 0
  return Number(value) || 0
}

function getHeaderBadge(label) {
  const name = String(label).toLowerCase()
  if (name.includes('pending')) return <span className="header-badge pending">Pending Workspace</span>
  if (name.includes('dispensing')) return <span className="header-badge dispensing">Dispensing Log</span>
  if (name.includes('bills')) return <span className="header-badge bills">Billing Center</span>
  if (name.includes('returns')) return <span className="header-badge returns">Returns Panel</span>
  if (name.includes('reports')) return <span className="header-badge reports">Analytics Desk</span>
  return <span className="header-badge dashboard">Active Session</span>
}

function ActionIcon() {
  return <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" strokeWidth="2.5" style={{ marginRight: '6px' }}><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>
}

function TabIcon() {
  return <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>
}

function PharmacistApiScreen({ activeLabel, title, subtitle, load, actions = [] }) {
  const { showToast } = useToast()
  const [items, setItems] = useState([])
  const [id, setId] = useState('')
  const [bodyText, setBodyText] = useState('{}')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [rawResponse, setRawResponse] = useState(null)
  const [activeTabLabel, setActiveTabLabel] = useState(actions[0]?.label || '')

  const refresh = useCallback(async () => {
    setLoading(true)
    setMessage('')
    try {
      const response = await load()
      setRawResponse(response)
      setItems(normalizeItems(response, activeLabel))
    } catch (error) {
      setItems([])
      setRawResponse(null)
      showToast(error.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [activeLabel, load, showToast])

  useEffect(() => {
    const timer = window.setTimeout(refresh, 0)
    return () => window.clearTimeout(timer)
  }, [refresh])

  async function run(action) {
    setActiveTabLabel(action.label)
    setActionLoading(true)
    setMessage('')
    try {
      const parsedBody = bodyText.trim() ? JSON.parse(bodyText) : {}
      const body = typeof action.payload === 'function' ? action.payload(id, parsedBody) : action.payload || parsedBody
      const response = await action.fn(id, body)
      setRawResponse(response)
      setItems(normalizeItems(response, activeLabel))
      showToast(response?.message || `${action.label} completed.`)
    } catch (error) {
      showToast(error.message, 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const columns = moduleColumns[activeLabel] || moduleColumns.Dashboard
  const payload = unwrapPayload(rawResponse)
  const stats = useMemo(() => dashboardCards.map(([key, label, paths]) => ({ key, label, value: metricValue(payload, paths) })), [payload])
  const emptyStateTitle = loading ? 'Loading data...' : activeLabel === 'Pending' ? 'No pending prescriptions found' : 'No data found'
  const emptyStateDesc = loading ? 'Please wait while latest API data loads.' : 'No records were returned by the API for this module.'
  const isDashboard = activeLabel === 'Dashboard'

  return (
    <PharmacistLayout activeLabel={activeLabel} title={title} subtitle={subtitle}>
      <div className="pharmacist-dashboard-container">
        <div className="pharmacist-main-header-row">
          <div className="pharmacist-main-header">
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          {getHeaderBadge(activeLabel)}
        </div>

        {isDashboard ? (
          <div className="pharmacist-metrics-grid">
            {stats.map((stat, index) => (
              <div className={`pharmacist-metric-card ${['blue', 'teal', 'purple', 'orange'][index] || 'blue'} animate-hover`} key={stat.key}>
                <div className="metric-header-row">
                  <div className={`metric-icon-circle ${['blue', 'teal', 'purple', 'orange'][index] || 'blue'}`}>
                    <TabIcon />
                  </div>
                  <div className="metric-header-text">
                    <span>{stat.label}</span>
                    <h2>{stat.value}</h2>
                  </div>
                </div>
                <div className="metric-footer-row"><span className="trend-subtext">Live API data</span></div>
              </div>
            ))}
          </div>
        ) : null}

        <div className="pharmacist-action-card">
          <div className="action-card-header">
            <h3>{title}</h3>
            <p>{isDashboard ? 'Review dashboard data from pharmacist APIs.' : 'Use module actions to fetch or update records.'}</p>
          </div>

          <div className="pharmacist-search-form-row">
            <div className="pharmacist-input-wrapper">
              <input value={id} onChange={(event) => setId(event.target.value)} placeholder="Record ID / Bill ID" />
              <svg viewBox="0 0 24 24" width="16" height="16" className="input-search-icon-right"><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></svg>
            </div>
            <button type="button" className="pharmacist-btn pharmacist-btn-primary refresh-action-btn" onClick={refresh} disabled={loading}>
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          {!isDashboard ? (
            <div className="pharmacist-json-input-card">
              <div className="json-input-header-row"><div className="json-input-header"><span>Request Body</span></div></div>
              <textarea value={bodyText} onChange={(event) => setBodyText(event.target.value)} rows={4} aria-label="Request Body JSON" placeholder="{}" />
            </div>
          ) : null}

          {isDashboard && actions.length > 0 ? (
            <div className="pharmacist-segmented-tabs-bar">
              {actions.map((action) => {
                const isActive = activeTabLabel === action.label
                const tabClass = action.label.toLowerCase().replace(/\s+/g, '-')
                return <button type="button" className={`pharmacist-tab-btn ${isActive ? 'active' : ''} ${tabClass}`} onClick={() => run(action)} key={action.label} disabled={actionLoading}><TabIcon /><span>{actionLoading && isActive ? 'Loading...' : action.label}</span></button>
              })}
            </div>
          ) : actions.length > 0 ? (
            <div className="pharmacist-action-buttons-row">
              {actions.map((action) => <button type="button" className="pharmacist-btn pharmacist-action-btn" onClick={() => run(action)} key={action.label} disabled={actionLoading}><ActionIcon /><span>{actionLoading && activeTabLabel === action.label ? 'Processing...' : action.label}</span></button>)}
            </div>
          ) : null}

          <div className="pharmacist-results-panel">
            <div className="results-panel-header">
              <div className="results-panel-title"><span>{activeLabel} API Results</span></div>
              {items.length > 0 ? <span className="results-status-ready">Ready</span> : null}
            </div>

            <div className="branch-table-wrap">
              <table className="pharmacist-table">
                <thead><tr>{columns.map(([header]) => <th key={header}>{header}</th>)}</tr></thead>
                <tbody>
                  {items.length ? items.map((item, index) => (
                    <tr key={pick(item, ['id', '_id', 'billId', 'prescriptionId', 'returnId'], index)}>
                      {columns.map(([header, paths]) => <td key={header}>{displayValue(pick(item, paths))}</td>)}
                    </tr>
                  )) : (
                    <tr><td colSpan={columns.length}><div className="pharmacist-empty-state"><strong>{emptyStateTitle}</strong><p>{emptyStateDesc}</p></div></td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {message ? <div className="pharmacist-json-wrapper"><pre className="pharmacist-json">{message}</pre></div> : null}
          </div>
        </div>
      </div>
    </PharmacistLayout>
  )
}

export default PharmacistApiScreen