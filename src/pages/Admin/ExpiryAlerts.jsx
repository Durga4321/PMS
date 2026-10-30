import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../../components/ToastProvider'
import RowActions from '../../components/RowActions'
import { listMedicines, disposeInventoryBatch } from '../../config/api'
import AdminLayout from './AdminLayout'

function normalizeList(response) {
  if (Array.isArray(response)) return response
  if (Array.isArray(response?.data)) return response.data
  if (Array.isArray(response?.data?.items)) return response.data.items
  if (Array.isArray(response?.items)) return response.items
  if (Array.isArray(response?.inventory)) return response.inventory
  if (Array.isArray(response?.results)) return response.results
  return []
}

export const EXPIRY_ALERT_DAYS = 10

function expiryOf(item) {
  return item?.expiryDate || item?.ExpiryDate || item?.expiresAt || item?.expiry || item?.Expiry || item?.batch?.expiryDate || ''
}

function daysLeftOf(item) {
  if (item?.daysLeft !== undefined && item?.daysLeft !== null && item?.daysLeft !== '') return Number(item.daysLeft)
  const raw = expiryOf(item)
  if (!raw) return null
  const exp = new Date(raw)
  if (isNaN(exp)) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  exp.setHours(0, 0, 0, 0)
  return Math.round((exp - today) / 86400000)
}

function formatDate(raw) {
  if (!raw) return '-'
  const d = new Date(raw)
  return isNaN(d) ? String(raw) : d.toISOString().slice(0, 10)
}

function stockOf(item) {
  const keys = ['stock', 'Stock', 'stockQuantity', 'StockQuantity', 'currentStock', 'CurrentStock', 'availableStock', 'AvailableStock', 'totalStock', 'TotalStock', 'quantity', 'Quantity', 'qty', 'initialStockCount', 'InitialStockCount']
  for (const k of keys) {
    const v = item?.[k]
    if (v !== undefined && v !== null && v !== '' && !isNaN(Number(v))) return Number(v)
  }
  return 0
}

function getMedicineName(item) {
  return item?.medicineName || item?.medicine?.name || item?.name || item?.Name || 'medicine'
}

function getId(item, index) {
  return item?._id || item?.id || item?.medicineId || item?.batchId || `${getMedicineName(item)}-${index}`
}

function formatDaysLeft(daysLeft) {
  if (daysLeft === null || daysLeft === undefined) return '-'
  if (daysLeft < 0) return `Expired ${Math.abs(daysLeft)} day(s) ago`
  if (daysLeft === 0) return 'Expires today'
  return `${daysLeft} day(s)`
}

export default function ExpiryAlerts() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [mode, setMode] = useState('alerts') // 'alerts' (all), 'near', 'expired'
  const [allAlerts, setAllAlerts] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [viewingItem, setViewingItem] = useState(null)

  async function handleDispose(item) {
    const batchNo = item?.batchNo || item?.batchNumber
    const medName = getMedicineName(item)
    if (!window.confirm(`Are you sure you want to dispose expired medicine: ${medName} (batch: ${batchNo || 'N/A'})?`)) return
    try {
      if (batchNo) {
        await disposeInventoryBatch(batchNo, { reason: 'Expired medicine alert disposal' })
      }
      setAllAlerts((current) => current.filter((it) => (it?.id || it?._id) !== (item?.id || item?._id)))
      showToast(`Medicine ${medName} removed from alerts.`, 'success')
    } catch (err) {
      showToast(err.message || 'Error disposing batch.', 'error')
    }
  }

  function handleEdit(item) {
    showToast(`Redirecting to Stock to adjust batch ${item?.batchNo || ''}...`, 'info')
    navigate('/admin/stock')
  }

  async function loadAlerts() {
    setLoading(true)
    try {
      const response = await listMedicines({ page: 1, pageSize: 1000 })
      const alerts = normalizeList(response)
        .map((m) => {
          const daysLeft = daysLeftOf(m)
          return {
            ...m,
            medicineName: getMedicineName(m),
            quantity: stockOf(m),
            expiryDate: expiryOf(m),
            daysLeft,
            status: daysLeft !== null && daysLeft < 0 ? 'expired' : 'near expiry',
          }
        })
        .filter((m) => m.daysLeft !== null && m.daysLeft <= EXPIRY_ALERT_DAYS)
        .sort((a, b) => a.daysLeft - b.daysLeft)

      setAllAlerts(alerts)
    } catch (error) {
      showToast(error.message || 'Unable to load medicines.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAlerts()
  }, [])

  // Counts for each tab
  const nearCount = useMemo(() => allAlerts.filter((m) => m.daysLeft >= 0).length, [allAlerts])
  const expiredCount = useMemo(() => allAlerts.filter((m) => m.daysLeft < 0).length, [allAlerts])
  const totalCount = allAlerts.length

  // Filter by tab
  const tabItems = useMemo(() => {
    if (mode === 'near') return allAlerts.filter((m) => m.daysLeft >= 0)
    if (mode === 'expired') return allAlerts.filter((m) => m.daysLeft < 0)
    return allAlerts
  }, [allAlerts, mode])

  // Filter by search & status dropdown
  const filteredItems = useMemo(() => {
    return tabItems.filter((item) => {
      const name = (item?.medicineName || item?.name || '').toLowerCase()
      const batch = (item?.batchNo || item?.batchNumber || item?.batchId || '').toLowerCase()
      const query = search.toLowerCase()
      const matchesSearch = name.includes(query) || batch.includes(query)

      const itemStatus = String(item?.status || '').toLowerCase()
      const matchesStatus = statusFilter === 'all' || itemStatus.includes(statusFilter)

      return matchesSearch && matchesStatus
    })
  }, [tabItems, search, statusFilter])

  function getStatusLabel(item) {
    if (item?.daysLeft !== null && item?.daysLeft < 0) return 'Expired'
    if (item?.daysLeft !== null && item?.daysLeft <= EXPIRY_ALERT_DAYS) return 'Near Expiry'
    return 'Safe'
  }

  function getStatusClass(item) {
    if (item?.daysLeft !== null && item?.daysLeft < 0) return 'expired'
    if (item?.daysLeft !== null && item?.daysLeft <= EXPIRY_ALERT_DAYS) return 'near-expiry'
    return 'active'
  }

  return (
    <AdminLayout activeLabel="Expiry Alerts" title="Expiry Inventory" subtitle="Track medicines that are near expiry or already expired.">
      <section className="branch-panel">
        <div className="branch-panel-heading" style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '16px', marginBottom: '16px', flexWrap: 'wrap', gap: '16px' }}>
          <div className="expiry-tabs-card-grid">
            {/* Tab 1: All Expiry Alerts */}
            <button
              type="button"
              className={`expiry-tab-card ${mode === 'alerts' ? 'active' : ''}`}
              style={{ '--card-accent': '#dc2626', '--card-bg': '#fee2e2', '--card-border': 'rgba(220, 38, 38, 0.25)' }}
              onClick={() => setMode('alerts')}
            >
              <div className="expiry-card-icon-wrap">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div className="expiry-card-text">
                <span>Expiry Alerts ({totalCount})</span>
                <small>All near expiry &amp; expired</small>
              </div>
            </button>

            {/* Tab 2: Near Expiry Only */}
            <button
              type="button"
              className={`expiry-tab-card ${mode === 'near' ? 'active' : ''}`}
              style={{ '--card-accent': '#f97316', '--card-bg': '#ffedd5', '--card-border': 'rgba(249, 115, 22, 0.25)' }}
              onClick={() => setMode('near')}
            >
              <div className="expiry-card-icon-wrap">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <div className="expiry-card-text">
                <span>Near Expiry ({nearCount})</span>
                <small>Expiring within {EXPIRY_ALERT_DAYS} days</small>
              </div>
            </button>

            {/* Tab 3: Expired Only */}
            <button
              type="button"
              className={`expiry-tab-card ${mode === 'expired' ? 'active' : ''}`}
              style={{ '--card-accent': '#ef4444', '--card-bg': '#fee2e2', '--card-border': 'rgba(239, 68, 68, 0.25)' }}
              onClick={() => setMode('expired')}
            >
              <div className="expiry-card-icon-wrap">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                  <path d="m14 14-4 4m0-4 4 4" />
                </svg>
              </div>
              <div className="expiry-card-text">
                <span>Expired ({expiredCount})</span>
                <small>Expired medicines only</small>
              </div>
            </button>
          </div>

          <button
            type="button"
            onClick={loadAlerts}
            style={{
              height: '38px',
              padding: '0 16px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#fff',
              color: '#475569',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            Refresh
          </button>
        </div>

        <div className="medicine-filters" style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
          <div className="report-search-input-wrap" style={{ flex: 1, maxWidth: '320px', position: 'relative', display: 'flex', alignItems: 'center' }}>
            <svg viewBox="0 0 24 24" aria-hidden="true" className="search-icon" style={{ position: 'absolute', left: '12px', width: '15px', height: '15px', stroke: '#94a3b8', fill: 'none', strokeWidth: 2 }}>
              <circle cx="11" cy="11" r="6" />
              <path d="m16 16 4 4" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search medicine, batch number..."
              style={{ width: '100%', height: '38px', padding: '0 12px 0 36px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px' }}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ height: '38px', padding: '0 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', background: '#fff', outline: 'none' }}
          >
            <option value="all">All Statuses</option>
            <option value="near">Near Expiry</option>
            <option value="expired">Expired</option>
          </select>
        </div>

        {loading ? (
          <p style={{ padding: '20px 0', color: '#64748b', fontSize: '14px' }}>Loading expiry alerts...</p>
        ) : (
          <div className="branch-table-wrap">
            <table className="branch-table">
              <thead>
                <tr>
                  <th>Medicine</th>
                  <th>Batch</th>
                  <th>Quantity</th>
                  <th>Expiry Date</th>
                  <th>Days Left</th>
                  <th>Status</th>
                  <th style={{ width: '140px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length ? (
                  filteredItems.map((item, index) => (
                    <tr key={getId(item, index)}>
                      <td>
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>
                          {item?.medicineName || item?.name || '-'}
                        </div>
                      </td>
                      <td>
                        <code>{item?.batchNo || item?.batchNumber || item?.batchId || '-'}</code>
                      </td>
                      <td>{item?.quantity ?? 0}</td>
                      <td>{formatDate(expiryOf(item))}</td>
                      <td>
                        <span style={{ fontWeight: 500, color: (item?.daysLeft ?? 30) < 0 ? '#ef4444' : '#f59e0b' }}>
                          {formatDaysLeft(item?.daysLeft)}
                        </span>
                      </td>
                      <td>
                        <span className={`branch-status ${getStatusClass(item)}`}>
                          {getStatusLabel(item)}
                        </span>
                      </td>
                      <td>
                        <RowActions
                          itemName={getMedicineName(item)}
                          onView={() => setViewingItem(item)}
                          onEdit={() => handleEdit(item)}
                          statusDisabled={true}
                          onDelete={() => handleDispose(item)}
                        />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '40px 20px' }}>
                      <div style={{ color: '#64748b', fontSize: '15px', fontWeight: 600 }}>
                        {mode === 'near' ? 'No near-expiry medicines found.' : mode === 'expired' ? 'No expired medicines found.' : 'No expiry alert medicines found.'}
                      </div>
                      <div style={{ color: '#94a3b8', fontSize: '13px', marginTop: '4px' }}>
                        All checkups complete.
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {viewingItem && (
          <div className="stock-modal-overlay" onClick={() => setViewingItem(null)}>
            <div className="stock-modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
              <div className="stock-modal-header">
                <h2>Batch Expiry Details</h2>
                <button type="button" className="stock-modal-close" onClick={() => setViewingItem(null)}>&times;</button>
              </div>
              <div className="stock-modal-body" style={{ padding: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Medicine Name</label>
                    <p style={{ margin: '4px 0 0', fontWeight: 700, color: '#0f172a', fontSize: '14px' }}>{getMedicineName(viewingItem)}</p>
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Batch Number</label>
                    <p style={{ margin: '4px 0 0', fontWeight: 700, color: '#0f172a', fontSize: '14px' }}><code>{viewingItem.batchNo || viewingItem.batchNumber || '-'}</code></p>
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Quantity Remaining</label>
                    <p style={{ margin: '4px 0 0', fontWeight: 700, color: '#0f172a', fontSize: '14px' }}>{viewingItem.quantity ?? stockOf(viewingItem)} units</p>
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Expiry Date</label>
                    <p style={{ margin: '4px 0 0', fontWeight: 700, color: '#ef4444', fontSize: '14px' }}>{formatDate(expiryOf(viewingItem))}</p>
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Days Remaining</label>
                    <p style={{ margin: '4px 0 0', fontWeight: 700, color: (viewingItem.daysLeft ?? 30) < 0 ? '#ef4444' : '#f59e0b', fontSize: '14px' }}>
                      {formatDaysLeft(viewingItem.daysLeft)}
                    </p>
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Status</label>
                    <p style={{ margin: '4px 0 0', fontWeight: 700, fontSize: '14px' }}>{getStatusLabel(viewingItem)}</p>
                  </div>
                </div>
              </div>
              <div className="stock-modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '14px 20px', borderTop: '1px solid #e2e8f0' }}>
                <button type="button" className="stock-btn stock-btn-secondary" onClick={() => setViewingItem(null)}>Close</button>
                <button type="button" className="stock-btn stock-btn-primary" onClick={() => { const it = viewingItem; setViewingItem(null); handleEdit(it) }}>Adjust in Stock &rarr;</button>
              </div>
            </div>
          </div>
        )}
      </section>
    </AdminLayout>
  )
}
