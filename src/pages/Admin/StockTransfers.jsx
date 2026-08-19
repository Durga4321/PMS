import { useEffect, useState, useMemo } from 'react'
import { useToast } from '../../components/ToastProvider'
import AdminLayout from './AdminLayout'
import { 
  changeStockTransferStatus, 
  createStockTransfer, 
  dispatchStockTransfer, 
  getStockTransfer, 
  listStockTransfers, 
  receiveStockTransfer,
  getPharmacyDashboard
} from '../../config/api'
import './StockTransfers.css'

const normalizeList = (response) => {
  if (Array.isArray(response)) return response
  if (Array.isArray(response?.data)) return response.data
  if (Array.isArray(response?.items)) return response.items
  if (Array.isArray(response?.results)) return response.results
  if (Array.isArray(response?.transfers)) return response.transfers
  return []
}

function getId(item, index) {
  return item?._id || item?.id || item?.transferId || `${index}`
}

export default function StockTransfers() {
  const { showToast } = useToast()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  
  // Modal states
  const [viewingItem, setViewingItem] = useState(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [editItem, setEditItem] = useState(null)
  
  // Dashboard summaries
  const [summary, setSummary] = useState({
    total: 0,
    pending: 0,
    dispatched: 0,
    received: 0,
    cancelled: 0
  })

  // Create Form State
  const [createForm, setCreateForm] = useState({
    fromLocation: '',
    toLocation: '',
    medicineName: '',
    batchNo: '',
    quantity: '',
    requestedBy: '',
    approvedBy: ''
  })

  // Edit Form State
  const [editForm, setEditForm] = useState({
    id: '',
    fromLocation: '',
    toLocation: '',
    medicineName: '',
    batchNo: '',
    quantity: '',
    requestedBy: '',
    approvedBy: '',
    status: 'Pending'
  })

  async function loadSummaryMetrics() {
    try {
      const response = await getPharmacyDashboard()
      const data = response?.data || response || {}
      setSummary({
        total: Number(data?.totalTransfers || data?.transfersCount || 0),
        pending: Number(data?.pendingTransfers || data?.pendingTransfersCount || 0),
        dispatched: Number(data?.dispatchedTransfers || data?.dispatchedCount || 0),
        received: Number(data?.receivedTransfers || data?.receivedCount || 0),
        cancelled: Number(data?.cancelledTransfers || data?.cancelledCount || 0)
      })
    } catch (e) {
      console.log('Unable to load transfer metrics:', e.message)
    }
  }

  async function refresh() {
    setLoading(true)
    try {
      const response = await listStockTransfers()
      const list = normalizeList(response)
      setItems(list)
      // Recalculate summary totals locally if dashboard is offline
      if (list.length > 0) {
        setSummary(prev => ({
          ...prev,
          total: list.length,
          pending: list.filter(t => String(t.status || 'pending').toLowerCase() === 'pending').length,
          dispatched: list.filter(t => String(t.status).toLowerCase() === 'dispatched' || String(t.status).toLowerCase() === 'in transit').length,
          received: list.filter(t => String(t.status).toLowerCase() === 'received' || String(t.status).toLowerCase() === 'completed').length,
          cancelled: list.filter(t => String(t.status).toLowerCase() === 'cancelled').length
        }))
      }
    } catch (error) {
      showToast(error.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSummaryMetrics()
    refresh()
  }, [])

  // Filtered Stock Transfers list
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const medicine = (item?.medicineName || item?.medicine?.name || item?.name || '').toLowerCase()
      const transId = (item?.transferId || item?._id || '').toLowerCase()
      const batch = (item?.batchNo || item?.batchNumber || '').toLowerCase()
      const fromLoc = (item?.fromLocation || item?.source || '').toLowerCase()
      const toLoc = (item?.toLocation || item?.destination || '').toLowerCase()
      const query = search.toLowerCase()
      
      return medicine.includes(query) || transId.includes(query) || batch.includes(query) || fromLoc.includes(query) || toLoc.includes(query)
    })
  }, [items, search])

  // Create Submit Action
  async function handleCreateSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const body = {
        fromLocation: createForm.fromLocation,
        toLocation: createForm.toLocation,
        medicineName: createForm.medicineName,
        batchNo: createForm.batchNo,
        quantity: Number(createForm.quantity || 1),
        requestedBy: createForm.requestedBy,
        approvedBy: createForm.approvedBy
      }
      await createStockTransfer(body)
      showToast('Stock transfer created successfully!')
      setCreateOpen(false)
      setCreateForm({
        fromLocation: '',
        toLocation: '',
        medicineName: '',
        batchNo: '',
        quantity: '',
        requestedBy: '',
        approvedBy: ''
      })
      await refresh()
      loadSummaryMetrics()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  // Update Submit Action
  async function handleUpdateSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const body = {
        fromLocation: editForm.fromLocation,
        toLocation: editForm.toLocation,
        medicineName: editForm.medicineName,
        batchNo: editForm.batchNo,
        quantity: Number(editForm.quantity || 1),
        requestedBy: editForm.requestedBy,
        approvedBy: editForm.approvedBy,
        status: editForm.status
      }
      await changeStockTransferStatus(editForm.id, body)
      showToast('Stock transfer updated successfully!')
      setEditItem(null)
      await refresh()
      loadSummaryMetrics()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  // Action Helpers: Dispatch & Receive & Cancel
  async function handleDispatch(id) {
    setLoading(true)
    try {
      await dispatchStockTransfer(id, {})
      showToast('Stock transfer dispatched!')
      await refresh()
      loadSummaryMetrics()
    } catch (error) {
      showToast(error.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleReceive(id) {
    setLoading(true)
    try {
      await receiveStockTransfer(id, {})
      showToast('Stock transfer received and finalized!')
      await refresh()
      loadSummaryMetrics()
    } catch (error) {
      showToast(error.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleCancel(id) {
    setLoading(true)
    try {
      await changeStockTransferStatus(id, { status: 'Cancelled' })
      showToast('Stock transfer cancelled.')
      await refresh()
      loadSummaryMetrics()
    } catch (error) {
      showToast(error.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  function openEdit(item) {
    setEditForm({
      id: item?._id || item?.id,
      fromLocation: item?.fromLocation || item?.source || '',
      toLocation: item?.toLocation || item?.destination || '',
      medicineName: item?.medicineName || item?.name || '',
      batchNo: item?.batchNo || item?.batchNumber || '',
      quantity: String(item?.quantity || ''),
      requestedBy: item?.requestedBy || '',
      approvedBy: item?.approvedBy || '',
      status: item?.status || 'Pending'
    })
    setEditItem(item)
  }

  async function openView(item) {
    const id = item?._id || item?.id
    try {
      const response = await getStockTransfer(id)
      setViewingItem(response?.data || response || item)
    } catch (e) {
      setViewingItem(item)
    }
  }

  // Dynamic getters for columns
  const getFromLoc = (item) => item?.fromLocation || item?.source || '-'
  const getToLoc = (item) => item?.toLocation || item?.destination || '-'
  const getMedicineName = (item) => item?.medicineName || item?.medicine?.name || item?.name || '-'
  const getBatchNo = (item) => item?.batchNo || item?.batchNumber || '-'
  const getQty = (item) => item?.quantity || item?.qty || 0
  const getDate = (item) => {
    const d = item?.createdAt || item?.date || '-'
    return d.includes('T') ? d.split('T')[0] : d
  }
  const getTransferId = (item) => item?.transferId || item?._id || '-'

  // Badge Status Class
  const getStatusBadge = (item) => {
    const status = String(item?.status || 'Pending').toLowerCase()
    if (status.includes('completed') || status.includes('received')) return <span className="branch-status active">Received</span>
    if (status.includes('cancelled')) return <span className="branch-status expired">Cancelled</span>
    if (status.includes('dispatched') || status.includes('transit')) return <span className="branch-status view">Dispatched</span>
    if (status.includes('draft')) return <span className="branch-status" style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' }}>Draft</span>
    return <span className="branch-status near-expiry">Pending</span>
  }

  return (
    <AdminLayout activeLabel="Stock Transfers" title="Stock Transfers" subtitle="Manage medicine stock transfers between pharmacy locations.">
      <div className="stock-scroll-area">
        <div className="transfer-layout-container">

          {/* Workflow Buttons Toolbar */}
          <div className="transfer-toolbar" style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '16px', marginBottom: '8px' }}>
            <div className="transfer-action-btns">
              <button 
                type="button" 
                className="transfer-btn transfer-btn-primary"
                onClick={() => setCreateOpen(true)}
              >
                <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Create Transfer
              </button>
            </div>
            <button 
              type="button" 
              className="transfer-btn transfer-btn-secondary"
              onClick={refresh}
            >
              <svg viewBox="0 0 24 24"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
              Refresh
            </button>
          </div>

          {/* Summary Cards */}
          <div className="transfer-summary-grid">
            <div className="transfer-summary-card">
              <label>Total Transfers</label>
              <span>{summary.total}</span>
            </div>
            <div className="transfer-summary-card" style={{ borderLeft: '3px solid #f59e0b' }}>
              <label style={{ color: '#f59e0b' }}>Pending Transfers</label>
              <span style={{ color: '#f59e0b' }}>{summary.pending}</span>
            </div>
            <div className="transfer-summary-card" style={{ borderLeft: '3px solid #2563eb' }}>
              <label style={{ color: '#2563eb' }}>Dispatched</label>
              <span style={{ color: '#2563eb' }}>{summary.dispatched}</span>
            </div>
            <div className="transfer-summary-card" style={{ borderLeft: '3px solid #10b981' }}>
              <label style={{ color: '#10b981' }}>Received</label>
              <span style={{ color: '#10b981' }}>{summary.received}</span>
            </div>
            <div className="transfer-summary-card" style={{ borderLeft: '3px solid #ef4444' }}>
              <label style={{ color: '#ef4444' }}>Cancelled</label>
              <span style={{ color: '#ef4444' }}>{summary.cancelled}</span>
            </div>
          </div>

          {/* Search Inputs */}
          <div className="transfer-toolbar">
            <div className="transfer-search-wrap">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="search-icon"><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></svg>
              <input 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
                placeholder="Search transfer ID, medicine, batch, location..." 
              />
            </div>
          </div>

          {/* Table Results */}
          <section className="dispense-table-panel">
            <h2>Transfer Logs</h2>
            
            {loading ? (
              <div className="dispense-skeleton-row">
                <div className="dispense-skeleton-line" style={{ width: '80%' }}></div>
                <div className="dispense-skeleton-line" style={{ width: '90%' }}></div>
                <div className="dispense-skeleton-line" style={{ width: '70%' }}></div>
              </div>
            ) : (
              <div className="branch-table-wrap">
                <table className="branch-table">
                  <thead>
                    <tr>
                      <th>Transfer ID</th>
                      <th>From Location</th>
                      <th>To Location</th>
                      <th>Medicine</th>
                      <th>Batch Number</th>
                      <th>Quantity</th>
                      <th>Transfer Date</th>
                      <th>Status</th>
                      <th style={{ width: '180px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.length ? filteredItems.map((item, index) => (
                      <tr key={getId(item, index)}>
                        <td><code>{getTransferId(item)}</code></td>
                        <td>{getFromLoc(item)}</td>
                        <td>{getToLoc(item)}</td>
                        <td><div style={{ fontWeight: 600, color: '#1e293b' }}>{getMedicineName(item)}</div></td>
                        <td><code>{getBatchNo(item)}</code></td>
                        <td>{getQty(item)}</td>
                        <td>{getDate(item)}</td>
                        <td>{getStatusBadge(item)}</td>
                        <td>
                          <div className="admin-action-group">
                            <button 
                              type="button" 
                              className="admin-action-button view" 
                              aria-label="View Details" 
                              title="View Details"
                              onClick={() => openView(item)}
                            >
                              <svg viewBox="0 0 24 24"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>
                            </button>
                            <button 
                              type="button" 
                              className="admin-action-button edit" 
                              aria-label="Update Details" 
                              title="Update Details"
                              onClick={() => openEdit(item)}
                            >
                              <svg viewBox="0 0 24 24"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" /></svg>
                            </button>
                            <button 
                              type="button" 
                              className="admin-action-button assign" 
                              aria-label="Dispatch Stock" 
                              title="Dispatch Stock"
                              onClick={() => handleDispatch(item?._id || item?.id)}
                            >
                              <svg viewBox="0 0 24 24"><polyline points="13 17 18 12 13 7"/><line x1="6" y1="12" x2="18" y2="12"/></svg>
                            </button>
                            <button 
                              type="button" 
                              className="admin-action-button assign" 
                              style={{ color: '#10b981', borderColor: '#a7f3d0', background: '#ecfdf5' }}
                              aria-label="Receive Stock" 
                              title="Receive Stock"
                              onClick={() => handleReceive(item?._id || item?.id)}
                            >
                              <svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                            </button>
                            <button 
                              type="button" 
                              className="admin-action-button danger" 
                              aria-label="Cancel Transfer" 
                              title="Cancel Transfer"
                              onClick={() => handleCancel(item?._id || item?.id)}
                            >
                              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan="9">
                          <div className="dispense-empty-state">
                            <h3>No stock transfers found.</h3>
                            <p>Stock transfers will appear here when medicine is transferred between pharmacy locations.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Modal 1: Create Transfer */}
          {createOpen && (
            <div className="transfer-modal-overlay">
              <form onSubmit={handleCreateSubmit} className="transfer-modal-container">
                <div className="transfer-modal-header">
                  <h2>Create Stock Transfer Request</h2>
                  <button type="button" className="transfer-modal-close" onClick={() => setCreateOpen(false)}>&times;</button>
                </div>
                <div className="transfer-modal-body">
                  <div className="transfer-detail-row">
                    <div className="transfer-form-group">
                      <label>From Location / Pharmacy</label>
                      <input 
                        type="text" 
                        value={createForm.fromLocation} 
                        onChange={(e) => setCreateForm({...createForm, fromLocation: e.target.value})} 
                        required 
                      />
                    </div>
                    <div className="transfer-form-group">
                      <label>To Location / Pharmacy</label>
                      <input 
                        type="text" 
                        value={createForm.toLocation} 
                        onChange={(e) => setCreateForm({...createForm, toLocation: e.target.value})} 
                        required 
                      />
                    </div>
                  </div>
                  <div className="transfer-detail-row">
                    <div className="transfer-form-group">
                      <label>Medicine Name</label>
                      <input 
                        type="text" 
                        value={createForm.medicineName} 
                        onChange={(e) => setCreateForm({...createForm, medicineName: e.target.value})} 
                        required 
                      />
                    </div>
                    <div className="transfer-form-group">
                      <label>Batch Number</label>
                      <input 
                        type="text" 
                        value={createForm.batchNo} 
                        onChange={(e) => setCreateForm({...createForm, batchNo: e.target.value})} 
                        required 
                      />
                    </div>
                  </div>
                  <div className="transfer-form-group">
                    <label>Transfer Quantity</label>
                    <input 
                      type="number" 
                      value={createForm.quantity} 
                      onChange={(e) => setCreateForm({...createForm, quantity: e.target.value})} 
                      required 
                    />
                  </div>
                  <div className="transfer-detail-row">
                    <div className="transfer-form-group">
                      <label>Requested By</label>
                      <input 
                        type="text" 
                        value={createForm.requestedBy} 
                        onChange={(e) => setCreateForm({...createForm, requestedBy: e.target.value})} 
                      />
                    </div>
                    <div className="transfer-form-group">
                      <label>Approved By</label>
                      <input 
                        type="text" 
                        value={createForm.approvedBy} 
                        onChange={(e) => setCreateForm({...createForm, approvedBy: e.target.value})} 
                      />
                    </div>
                  </div>
                </div>
                <div className="transfer-modal-footer">
                  <button type="button" className="transfer-btn transfer-btn-secondary" onClick={() => setCreateOpen(false)}>Cancel</button>
                  <button type="submit" className="transfer-btn transfer-btn-primary">Request Transfer</button>
                </div>
              </form>
            </div>
          )}

          {/* Modal 2: Edit Transfer */}
          {editItem && (
            <div className="transfer-modal-overlay">
              <form onSubmit={handleUpdateSubmit} className="transfer-modal-container">
                <div className="transfer-modal-header">
                  <h2>Update Stock Transfer: {getTransferId(editItem)}</h2>
                  <button type="button" className="transfer-modal-close" onClick={() => setEditItem(null)}>&times;</button>
                </div>
                <div className="transfer-modal-body">
                  <div className="transfer-detail-row">
                    <div className="transfer-form-group">
                      <label>From Location / Pharmacy</label>
                      <input 
                        type="text" 
                        value={editForm.fromLocation} 
                        onChange={(e) => setEditForm({...editForm, fromLocation: e.target.value})} 
                        required 
                      />
                    </div>
                    <div className="transfer-form-group">
                      <label>To Location / Pharmacy</label>
                      <input 
                        type="text" 
                        value={editForm.toLocation} 
                        onChange={(e) => setEditForm({...editForm, toLocation: e.target.value})} 
                        required 
                      />
                    </div>
                  </div>
                  <div className="transfer-detail-row">
                    <div className="transfer-form-group">
                      <label>Medicine Name</label>
                      <input 
                        type="text" 
                        value={editForm.medicineName} 
                        onChange={(e) => setEditForm({...editForm, medicineName: e.target.value})} 
                        required 
                      />
                    </div>
                    <div className="transfer-form-group">
                      <label>Batch Number</label>
                      <input 
                        type="text" 
                        value={editForm.batchNo} 
                        onChange={(e) => setEditForm({...editForm, batchNo: e.target.value})} 
                        required 
                      />
                    </div>
                  </div>
                  <div className="transfer-detail-row">
                    <div className="transfer-form-group">
                      <label>Transfer Quantity</label>
                      <input 
                        type="number" 
                        value={editForm.quantity} 
                        onChange={(e) => setEditForm({...editForm, quantity: e.target.value})} 
                        required 
                      />
                    </div>
                    <div className="transfer-form-group">
                      <label>Status</label>
                      <select 
                        value={editForm.status} 
                        onChange={(e) => setEditForm({...editForm, status: e.target.value})}
                      >
                        <option value="Draft">Draft</option>
                        <option value="Pending">Pending</option>
                        <option value="Dispatched">Dispatched</option>
                        <option value="Received">Received</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </div>
                  </div>
                  <div className="transfer-detail-row">
                    <div className="transfer-form-group">
                      <label>Requested By</label>
                      <input 
                        type="text" 
                        value={editForm.requestedBy} 
                        onChange={(e) => setEditForm({...editForm, requestedBy: e.target.value})} 
                      />
                    </div>
                    <div className="transfer-form-group">
                      <label>Approved By</label>
                      <input 
                        type="text" 
                        value={editForm.approvedBy} 
                        onChange={(e) => setEditForm({...editForm, approvedBy: e.target.value})} 
                      />
                    </div>
                  </div>
                </div>
                <div className="transfer-modal-footer">
                  <button type="button" className="transfer-btn transfer-btn-secondary" onClick={() => setEditItem(null)}>Cancel</button>
                  <button type="submit" className="transfer-btn transfer-btn-primary">Update Transfer</button>
                </div>
              </form>
            </div>
          )}

          {/* Modal 3: View Details */}
          {viewingItem && (
            <div className="transfer-modal-overlay">
              <div className="transfer-modal-container">
                <div className="transfer-modal-header">
                  <h2>Stock Transfer Details: {getTransferId(viewingItem)}</h2>
                  <button type="button" className="transfer-modal-close" onClick={() => setViewingItem(null)}>&times;</button>
                </div>
                <div className="presc-modal-body">
                  <div className="transfer-detail-row">
                    <div className="transfer-detail-item">
                      <label>Source Location</label>
                      <span>{getFromLoc(viewingItem)}</span>
                    </div>
                    <div className="transfer-detail-item">
                      <label>Destination Location</label>
                      <span>{getToLoc(viewingItem)}</span>
                    </div>
                  </div>
                  <div className="transfer-detail-row">
                    <div className="transfer-detail-item">
                      <label>Medicine Name</label>
                      <span>{getMedicineName(viewingItem)}</span>
                    </div>
                    <div className="transfer-detail-item">
                      <label>Batch Number</label>
                      <span><code>{getBatchNo(viewingItem)}</code></span>
                    </div>
                  </div>
                  <div className="transfer-detail-row">
                    <div className="transfer-detail-item">
                      <label>Transfer Quantity</label>
                      <span>{getQty(viewingItem)} units</span>
                    </div>
                    <div className="transfer-detail-item">
                      <label>Transfer Date</label>
                      <span>{getDate(viewingItem)}</span>
                    </div>
                  </div>
                  <div className="transfer-detail-row">
                    <div className="transfer-detail-item">
                      <label>Requested By</label>
                      <span>{viewingItem?.requestedBy || '-'}</span>
                    </div>
                    <div className="transfer-detail-item">
                      <label>Approved By</label>
                      <span>{viewingItem?.approvedBy || '-'}</span>
                    </div>
                  </div>
                  <div className="transfer-detail-item">
                    <label>Transfer Status</label>
                    <div style={{ marginTop: '4px' }}>{getStatusBadge(viewingItem)}</div>
                  </div>
                </div>
                <div className="transfer-modal-footer">
                  <button type="button" className="transfer-btn transfer-btn-primary" onClick={() => setViewingItem(null)}>Close</button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </AdminLayout>
  )
}
