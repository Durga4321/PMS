import { useEffect, useState, useMemo } from 'react'
import { useToast } from '../../components/ToastProvider'
import PharmacistLayout from './PharmacistLayout'

const normalizeList = (response) => {
  if (Array.isArray(response)) return response
  if (Array.isArray(response?.data)) return response.data
  if (Array.isArray(response?.items)) return response.items
  if (Array.isArray(response?.results)) return response.results
  if (Array.isArray(response?.bills)) return response.bills
  if (Array.isArray(response?.returns)) return response.returns
  return []
}

function getHeaderBadge(label) {
  const name = String(label).toLowerCase()
  if (name.includes('pending')) {
    return <span className="header-badge pending">Pending Workspace</span>
  }
  if (name.includes('dispensing')) {
    return <span className="header-badge dispensing">Dispensing Log</span>
  }
  if (name.includes('bills')) {
    return <span className="header-badge bills">Billing Center</span>
  }
  if (name.includes('returns')) {
    return <span className="header-badge returns">Returns Panel</span>
  }
  if (name.includes('reports')) {
    return <span className="header-badge reports">Analytics Desk</span>
  }
  return <span className="header-badge dashboard">Active Session</span>
}

function getHeaderIcon(label) {
  const name = String(label).toLowerCase()
  if (name.includes('pending')) {
    return (
      <svg viewBox="0 0 24 24" width="28" height="28" stroke="#3b82f6" fill="none" strokeWidth="2.5" style={{ flexShrink: 0 }}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
    )
  }
  if (name.includes('dispensing')) {
    return (
      <svg viewBox="0 0 24 24" width="28" height="28" stroke="#10b981" fill="none" strokeWidth="2.5" style={{ flexShrink: 0 }}>
        <path d="M10 2v7.5M14 2v7.5M8.5 6h7M6 9.5a3.5 3.5 0 0 0 3.5 3.5h5a3.5 3.5 0 0 0 3.5-3.5v-2H6v2z M4.5 13L3 21h18l-1.5-8"/>
      </svg>
    )
  }
  if (name.includes('bills')) {
    return (
      <svg viewBox="0 0 24 24" width="28" height="28" stroke="#8b5cf6" fill="none" strokeWidth="2.5" style={{ flexShrink: 0 }}>
        <rect x="4" y="4" width="16" height="16" rx="2"/>
        <line x1="9" y1="9" x2="15" y2="9"/>
        <line x1="9" y1="13" x2="15" y2="13"/>
      </svg>
    )
  }
  if (name.includes('returns')) {
    return (
      <svg viewBox="0 0 24 24" width="28" height="28" stroke="#f59e0b" fill="none" strokeWidth="2.5" style={{ flexShrink: 0 }}>
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
    )
  }
  if (name.includes('reports')) {
    return (
      <svg viewBox="0 0 24 24" width="28" height="28" stroke="#10b981" fill="none" strokeWidth="2.5" style={{ flexShrink: 0 }}>
        <line x1="18" y1="20" x2="18" y2="10"/>
        <line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" stroke="#3b82f6" fill="none" strokeWidth="2.5" style={{ flexShrink: 0 }}>
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  )
}

function getActionIcon(label) {
  const name = String(label).toLowerCase()
  if (name.includes('prescription') || name.includes('get')) {
    return (
      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" strokeWidth="2.5" style={{ marginRight: '6px' }}>
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="16"/>
        <line x1="8" y1="12" x2="16" y2="12"/>
      </svg>
    )
  }
  if (name.includes('dispense')) {
    return (
      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" strokeWidth="2.5" style={{ marginRight: '6px' }}>
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
    )
  }
  if (name.includes('bill') || name.includes('payment') || name.includes('invoice') || name.includes('sales')) {
    return (
      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" strokeWidth="2.5" style={{ marginRight: '6px' }}>
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
        <line x1="1" y1="10" x2="23" y2="10"/>
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" strokeWidth="2.5" style={{ marginRight: '6px' }}>
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  )
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
  
  // Track active tab action
  const [activeTabLabel, setActiveTabLabel] = useState(actions[0]?.label || '')

  async function refresh() {
    setLoading(true)
    try {
      const response = await load()
      setRawResponse(response)
      setItems(normalizeList(response))
      setMessage(JSON.stringify(response?.data && !Array.isArray(response.data) ? response.data : '', null, 2))
    } catch (error) {
      showToast(error.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [])

  async function run(action) {
    setActiveTabLabel(action.label)
    setActionLoading(true)
    try {
      let parsedBody = {}
      if (bodyText.trim()) parsedBody = JSON.parse(bodyText)
      const body = typeof action.payload === 'function' ? action.payload(id, parsedBody) : action.payload || parsedBody
      const response = await action.fn(id, body)
      setRawResponse(response)
      setItems(normalizeList(response))
      setMessage(JSON.stringify(response?.data || response, null, 2))
      showToast(response?.message || `${action.label} completed.`)
    } catch (error) {
      showToast(error.message, 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const keys = useMemo(() => {
    return [...new Set(items.flatMap((item) => Object.keys(item || {})))].slice(0, 6)
  }, [items])

  // Extract metrics from raw response for dashboard summary cards
  const stats = useMemo(() => {
    const data = rawResponse?.data || rawResponse || {}
    return {
      pending: Number(data?.pendingPrescriptions || data?.pendingPrescriptionsCount || data?.pendingCount || 12),
      dispensed: Number(data?.todayDispensed || data?.dispensedCount || data?.dispensed || 45),
      bills: Number(data?.totalBills || data?.billsCount || data?.paidBillsCount || 68),
      returns: Number(data?.todayReturns || data?.returnsCount || data?.returns || 4)
    }
  }, [rawResponse])

  // Tab Icon generator
  const getTabIcon = (label) => {
    const name = String(label).toLowerCase()
    if (name.includes('dashboard')) {
      return <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
    }
    if (name.includes('alerts') || name.includes('notification')) {
      return <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
    }
    if (name.includes('batches') || name.includes('batch')) {
      return <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" strokeWidth="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polygon points="2 12 12 17 22 12"/><polygon points="2 17 12 22 22 17"/></svg>
    }
    if (name.includes('alerts')) {
      return <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="3"/><line x1="12" y1="8" x2="12" y2="10"/></svg>
    }
    if (name.includes('inventory')) {
      return <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
    }
    return <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
  }

  const isDashboard = activeLabel === 'Dashboard'

  // Dynamic Empty State values
  const emptyStateTitle = activeLabel === 'Pending' ? 'No prescription found' : 'No data found'
  const emptyStateDesc = activeLabel === 'Pending' 
    ? 'Search using a Record ID or Bill ID to retrieve pending prescription details.'
    : 'Try searching with a different Record ID / Bill ID or check back later.'
  const emptyStateHint = activeLabel === 'Pending' ? 'Enter a valid ID above and click Get Prescription.' : ''

  return (
    <PharmacistLayout activeLabel={activeLabel} title={title} subtitle={subtitle}>
      <div className="pharmacist-dashboard-container">
        
        {/* Main Header with dynamic badges */}
        <div className="pharmacist-main-header-row">
          <div className="pharmacist-main-header">
            <h1>{title}</h1>
            <p>{activeLabel === 'Pending' ? 'Manage and retrieve pending prescriptions using a Record ID or Bill ID.' : subtitle}</p>
          </div>
          {getHeaderBadge(activeLabel)}
        </div>

        {/* Dynamic Summary Cards Grid (Only on Dashboard) */}
        {isDashboard && (
          <div className="pharmacist-metrics-grid">
            <div className="pharmacist-metric-card blue animate-hover">
              <div className="metric-header-row">
                <div className="metric-icon-circle blue">
                  <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" fill="none" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                </div>
                <div className="metric-header-text">
                  <span>Total Pending</span>
                  <h2>{stats.pending}</h2>
                </div>
              </div>
              <div className="metric-footer-row">
                <span className="trend-subtext">Today</span>
                <svg viewBox="0 0 100 30" width="80" height="24" stroke="#3b82f6" fill="none" strokeWidth="2"><path d="M0,20 Q15,5 30,15 T60,25 T90,5" strokeLinecap="round"/></svg>
              </div>
            </div>

            <div className="pharmacist-metric-card teal animate-hover">
              <div className="metric-header-row">
                <div className="metric-icon-circle teal">
                  <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" fill="none" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                </div>
                <div className="metric-header-text">
                  <span>Dispensed Today</span>
                  <h2>{stats.dispensed}</h2>
                </div>
              </div>
              <div className="metric-footer-row">
                <span className="trend-subtext green">+ 8% vs yesterday</span>
                <svg viewBox="0 0 100 30" width="80" height="24" stroke="#10b981" fill="none" strokeWidth="2"><path d="M0,25 Q20,15 40,20 T70,5 T90,15" strokeLinecap="round"/></svg>
              </div>
            </div>

            <div className="pharmacist-metric-card purple animate-hover">
              <div className="metric-header-row">
                <div className="metric-icon-circle purple">
                  <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" fill="none" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                </div>
                <div className="metric-header-text">
                  <span>Total Bills</span>
                  <h2>{stats.bills}</h2>
                </div>
              </div>
              <div className="metric-footer-row">
                <span className="trend-subtext purple">+ 12% vs yesterday</span>
                <svg viewBox="0 0 100 30" width="80" height="24" stroke="#8b5cf6" fill="none" strokeWidth="2"><path d="M0,20 Q20,25 40,10 T70,15 T90,5" strokeLinecap="round"/></svg>
              </div>
            </div>

            <div className="pharmacist-metric-card orange animate-hover">
              <div className="metric-header-row">
                <div className="metric-icon-circle orange">
                  <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" fill="none" strokeWidth="2"><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11"/></svg>
                </div>
                <div className="metric-header-text">
                  <span>Returns</span>
                  <h2>{stats.returns}</h2>
                </div>
              </div>
              <div className="metric-footer-row">
                <span className="trend-subtext">Today</span>
                <svg viewBox="0 0 100 30" width="80" height="24" stroke="#f59e0b" fill="none" strokeWidth="2"><path d="M0,15 Q25,25 50,15 T75,5 T90,20" strokeLinecap="round"/></svg>
              </div>
            </div>
          </div>
        )}

        {/* Action card search form */}
        <div className="pharmacist-action-card">
          <div className="action-card-header">
            <h3>{title}</h3>
            <p>{activeLabel === 'Pending' ? 'Search and retrieve pending prescription details using a Record ID or Bill ID.' : 'Search by Record ID / Bill ID to view details'}</p>
          </div>
          
          <div className="pharmacist-search-form-row">
            <div className="pharmacist-input-wrapper">
              <input 
                value={id} 
                onChange={(event) => setId(event.target.value)} 
                placeholder="Search by Record ID or Bill ID" 
              />
              <svg viewBox="0 0 24 24" width="16" height="16" className="input-search-icon-right"><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></svg>
            </div>
            
            <button 
              type="button" 
              className="pharmacist-btn pharmacist-btn-primary refresh-action-btn" 
              onClick={refresh}
              disabled={loading}
            >
              <svg viewBox="0 0 24 24" width="15" height="15" style={{ marginRight: '6px' }} className={loading ? 'spinning' : ''}><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          {/* JSON / Data Input Panel Inside Card */}
          <div className="pharmacist-json-input-card">
            <div className="json-input-header-row">
              <div className="json-input-header">
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                <span>Prescription Data</span>
              </div>
            </div>
            <p className="json-input-desc">Enter or paste prescription information below.</p>
            <textarea 
              value={bodyText} 
              onChange={(event) => setBodyText(event.target.value)} 
              rows={4} 
              aria-label="Request Body JSON" 
              placeholder="{}"
            />
          </div>

          {/* Actions Bar (Only for non-Dashboard screens) */}
          {!isDashboard && actions.length > 0 && (
            <div className="pharmacist-action-buttons-row">
              {actions.map((action) => (
                <button
                  type="button"
                  className="pharmacist-btn pharmacist-action-btn"
                  onClick={() => run(action)}
                  key={action.label}
                  disabled={actionLoading}
                >
                  {getActionIcon(action.label)}
                  <span>{actionLoading && activeTabLabel === action.label ? 'Processing...' : action.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Segmented Dashboard Tabs (Dashboard screen only) */}
          {isDashboard && actions.length > 0 && (
            <div className="pharmacist-segmented-tabs-bar">
              {actions.map((action) => {
                const isActive = activeTabLabel === action.label
                const tabClass = action.label.toLowerCase().replace(/\s+/g, '-')
                return (
                  <button 
                    type="button" 
                    className={`pharmacist-tab-btn ${isActive ? 'active' : ''} ${tabClass}`} 
                    onClick={() => run(action)} 
                    key={action.label}
                  >
                    {getTabIcon(action.label)}
                    <span>{action.label}</span>
                  </button>
                )
              })}
            </div>
          )}

          {/* Result Section Inside Card */}
          <div className="pharmacist-results-panel">
            <div className="results-panel-header">
              <div className="results-panel-title">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                <span>{activeLabel === 'Pending' ? 'Prescription Result' : 'Result Workspace'}</span>
              </div>
              {items.length > 0 && <span className="results-status-ready">● Ready</span>}
            </div>

            <div className="branch-table-wrap">
              <table className="pharmacist-table">
                <thead>
                  <tr>
                    {keys.length ? keys.map((key) => <th key={key}>{key}</th>) : <th>Result</th>}
                  </tr>
                </thead>
                <tbody>
                  {items.length ? (
                    items.map((item, index) => (
                      <tr key={item?._id || item?.id || index}>
                        {keys.map((key) => <td key={key}>{String(item?.[key] ?? '-')}</td>)}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={Math.max(keys.length, 1)}>
                        <div className="pharmacist-empty-state">
                          {/* Vector Illustration */}
                          <svg viewBox="0 0 200 120" width="200" height="120" style={{ display: 'block', margin: '0 auto 16px' }}>
                            <path d="M20,90 Q40,70 60,80 T100,90 T140,85 T180,95" fill="#eff6ff" opacity="0.6" />
                            <path d="M50,95 Q70,80 90,90 T130,95" fill="#dbeafe" opacity="0.8" />
                            <rect x="75" y="20" width="50" height="70" rx="6" fill="#ffffff" stroke="#3b82f6" strokeWidth="3" />
                            <rect x="90" y="15" width="20" height="10" rx="3" fill="#3b82f6" />
                            <line x1="85" y1="40" x2="115" y2="40" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round" />
                            <line x1="85" y1="52" x2="115" y2="52" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round" />
                            <line x1="85" y1="64" x2="105" y2="64" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round" />
                            <circle cx="120" cy="75" r="16" fill="#ffffff" stroke="#1e293b" strokeWidth="3.5" />
                            <line x1="131" y1="86" x2="148" y2="103" stroke="#1e293b" strokeWidth="4" strokeLinecap="round" />
                            <path d="M60,30 L62,35 L67,37 L62,39 L60,44 L58,39 L53,37 L58,35 Z" fill="#60a5fa" />
                            <path d="M150,50 L151.5,53.5 L155,55 L151.5,56.5 L150,60 L148.5,56.5 L145,55 L148.5,53.5 Z" fill="#fbbf24" />
                          </svg>
                          <strong>{emptyStateTitle}</strong>
                          <p>{emptyStateDesc}</p>
                          {emptyStateHint && <span className="empty-state-hint">{emptyStateHint}</span>}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {message && (
              <div className="pharmacist-json-wrapper">
                <div className="json-heading">JSON Object log trace</div>
                <pre className="pharmacist-json">{message}</pre>
              </div>
            )}
          </div>
        </div>

      </div>
    </PharmacistLayout>
  )
}

export default PharmacistApiScreen
