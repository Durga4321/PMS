import { useEffect, useState, useMemo } from 'react'
import { useToast } from '../../components/ToastProvider'
import RowActions from '../../components/RowActions'
import AdminLayout from './AdminLayout'
import {
  changeStockTransferStatus,
  createStockTransfer,
  dispatchStockTransfer,
  getStockTransfer,
  listStockTransfers,
  receiveStockTransfer,
  updateStockTransferDraft,
  readLocalStockTransfers,
  writeLocalStockTransfers
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
  const [items, setItems] = useState(() => {
    try {
      const local = readLocalStockTransfers()
      return Array.isArray(local) ? local : []
    } catch {
      return []
    }
  })
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [search, setSearch] = useState('')

  // Modal states
  const [viewingItem, setViewineItem] = useState(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [editItem, setEditItem] = useState(null)

  // Dashboard summaries - strictly derived from items, completely stable
  const summary = useMemo(() => {
    return {
      total: items.length,
      pending: items.filter(t => String(t?.status || 'pending').toLowerCase() === 'pending').length,
      dispatched: items.filter(t => ['dispatched', 'in transit'].includes(String(t?.status || '').toLowerCase())).length,
      received: items.filter(t => ['received', 'completed'].includes(String(t?.status || '').toLowerCase())).length,
      cancelled: items.filter(t => String(t?.status || '').toLowerCase() === 'cancelled').length
    }
  }, [items])

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

  // Validation Error States
  const [createErrors, setCreateErrors] = useState({})
  const [editErrors, setEditErrors] = useState({})

  function validateCreateForm() {
    const errs = {}
    const fromLoc = (createForm.fromLocation || '').trim()
    if (!fromLoc) {
      errs.fromLocation = 'From Location / Pharmacy is required.'
    } else if (fromLoc.length < 2) {
      errs.fromLocation = 'From Location must be at least 2 characters.'
    }

    const toLoc = (createForm.toLocation || '').trim()
    if (!toLoc) {
      errs.toLocation = 'To Location / Pharmacy is required.'
    } else if (toLoc.length < 2) {
      errs.toLocation = 'To Location must be at least 2 characters.'
    } else if (fromLoc && toLoc && fromLoc.toLowerCase() === toLoc.toLowerCase()) {
      errs.toLocation = 'Source and destination locations cannot be the same.'
    }

    const medName = (createForm.medicineName || '').trim()
    if (!medName) {
      errs.medicineName = 'Medicine Name is required.'
    } else if (medName.length < 2) {
      errs.medicineName = 'Medicine Name must be at least 2 characters.'
    }

    const batch = (createForm.batchNo || '').trim()
    if (!batch) {
      errs.batchNo = 'Batch Number is required.'
    }

    const qtyStr = String(createForm.quantity || '').trim()
    if (!qtyStr) {
      errs.quantity = 'Transfer Quantity is required.'
    } else {
      const qtyNum = Number(qtyStr)
      if (isNaN(qtyNum) || qtyNum <= 0) {
        errs.quantity = 'Transfer quantity must be greater than 0.'
      } else if (!Number.isInteger(qtyNum)) {
        errs.quantity = 'Transfer quantity must be a whole number.'
      }
    }

    const reqBy = (createForm.requestedBy || '').trim()
    if (!reqBy) {
      errs.requestedBy = 'Requested By name is required.'
    } else if (reqBy.length < 2) {
      errs.requestedBy = 'Requested By name must be at least 2 characters.'
    }

    setCreateErrors(errs)
    const firstKey = Object.keys(errs)[0]
    if (firstKey) {
      const el = document.getElementById(`create-${firstKey}`)
      if (el) el.focus()
    }
    return Object.keys(errs).length === 0
  }

  function validateEditForm() {
    const errs = {}
    const fromLoc = (editForm.fromLocation || '').trim()
    if (!fromLoc) {
      errs.fromLocation = 'From Location / Pharmacy is required.'
    } else if (fromLoc.length < 2) {
      errs.fromLocation = 'From Location must be at least 2 characters.'
    }

    const toLoc = (editForm.toLocation || '').trim()
    if (!toLoc) {
      errs.toLocation = 'To Location / Pharmacy is required.'
    } else if (toLoc.length < 2) {
      errs.toLocation = 'To Location must be at least 2 characters.'
    } else if (fromLoc && toLoc && fromLoc.toLowerCase() === toLoc.toLowerCase()) {
      errs.toLocation = 'Source and destination locations cannot be the same.'
    }

    const medName = (editForm.medicineName || '').trim()
    if (!medName) {
      errs.medicineName = 'Medicine Name is required.'
    } else if (medName.length < 2) {
      errs.medicineName = 'Medicine Name must be at least 2 characters.'
    }

    const batch = (editForm.batchNo || '').trim()
    if (!batch) {
      errs.batchNo = 'Batch Number is required.'
    }

    const qtyStr = String(editForm.quantity || '').trim()
    if (!qtyStr) {
      errs.quantity = 'Transfer Quantity is required.'
    } else {
      const qtyNum = Number(qtyStr)
      if (isNaN(qtyNum) || qtyNum <= 0) {
        errs.quantity = 'Transfer quantity must be greater than 0.'
      } else if (!Number.isInteger(qtyNum)) {
        errs.quantity = 'Transfer quantity must be a whole number.'
      }
    }

    const reqBy = (editForm.requestedBy || '').trim()
    if (!reqBy) {
      errs.requestedBy = 'Requested By name is required.'
    } else if (reqBy.length < 2) {
      errs.requestedBy = 'Requested By name must be at least 2 characters.'
    }

    const status = (editForm.status || '').trim()
    if (!status) {
      errs.status = 'Status selection is required.'
    }

    setEditErrors(errs)
    const firstKey = Object.keys(errs)[0]
    if (firstKey) {
      const el = document.getElementById(`edit-${firstKey}`)
      if (el) el.focus()
    }
    return Object.keys(errs).length === 0
  }

  async function refresh() {
    setLoading(true)
    try {
      const response = await listStockTransfers()
      const list = normalizeList(response)
      if (Array.isArray(list) && list.length > 0) {
        setItems(list)
        writeLocalStockTransfers(list)
      } else {
        const local = readLocalStockTransfers()
        if (Array.isArray(local) && local.length > 0) {
          setItems(local)
        }
      }
    } catch (error) {
      showToast(error.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  // Filtered Stock Transfers list
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const medicine = String(item?.medicineName || item?.medicine?.name || item?.name || '').toLowerCase()
      const transId = String(item?.transferId || item?._id || item?.id || '').toLowerCase()
      const batch = String(item?.batchNo || item?.batchNumber || '').toLowerCase()
      const fromLoc = String(item?.fromLocation || item?.source?.name || (typeof item?.source === 'string' ? item.source : '') || '').toLowerCase()
      const toLoc = String(item?.toLocation || item?.destination?.name || (typeof item?.destination === 'string' ? item.destination : '') || '').toLowerCase()
      const query = search.toLowerCase().trim()

      if (!query) return true
      return medicine.includes(query) || transId.includes(query) || batch.includes(query) || fromLoc.includes(query) || toLoc.includes(query)
    })
  }, [items, search])

  // Create Submit Action
  async function handleCreateSubmit(e) {
    e.preventDefault()
    if (!validateCreateForm()) return
    setSubmitting(true)
    try {
      const quantityNum = Number(createForm.quantity || 1)
      const body = {
        fromLocation: createForm.fromLocation.trim(),
        toLocation: createForm.toLocation.trim(),
        medicineName: createForm.medicineName.trim(),
        batchNumber: createForm.batchNo.trim(),
        batchNo: createForm.batchNo.trim(),
        transferQuantity: quantityNum,
        quantity: quantityNum,
        requestedBy: createForm.requestedBy.trim(),
        approvedBy: (createForm.approvedBy || '').trim()
      }
      const res = await createStockTransfer(body)
      const createdItem = res?.data || res || body

      setItems(prev => {
        const next = [createdItem, ...prev.filter(x => getId(x) !== getId(createdItem))]
        writeLocalStockTransfers(next)
        return next
      })

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
      setCreateErrors({})
      refresh()
    } catch (err) {
      showToast(err.message || 'Failed to create stock transfer request.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  // Update Submit Action
  async function handleUpdateSubmit(e) {
    e.preventDefault()
    if (!validateEditForm()) return
    setSubmitting(true)
    try {
      const quantityNum = Number(editForm.quantity || 1)
      const body = {
        fromLocation: editForm.fromLocation.trim(),
        toLocation: editForm.toLocation.trim(),
        medicineName: editForm.medicineName.trim(),
        batchNumber: editForm.batchNo.trim(),
        batchNo: editForm.batchNo.trim(),
        transferQuantity: quantityNum,
        quantity: quantityNum,
        requestedBy: editForm.requestedBy.trim(),
        approvedBy: (editForm.approvedBy || '').trim(),
        status: editForm.status
      }
      try {
        await updateStockTransferDraft(editForm.id, {
          quantity: quantityNum,
          notes: editForm.status ? `Status: ${editForm.status}` : null
        })
      } catch {}
      await changeStockTransferStatus(editForm.id, { status: editForm.status })
      setItems(prev => {
        const next = prev.map(x => getId(x) === editForm.id ? { ...x, ...body } : x)
        writeLocalStockTransfers(next)
        return next
      })
      showToast('Stock transfer updated successfully!')
      setEditItem(null)
      setEditErrors({})
      refresh()
    } catch (err) {
      showToast(err.message || 'Failed to update stock transfer.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  // Action Helpers: Dispatch & Receive & Cancel
  async function handleDispatch(id) {
    setLoading(true)
    try {
      await dispatchStockTransfer(id, {})
      setItems(prev => {
        const next = prev.map(x => getId(x) === id ? { ...x, status: 'Dispatched' } : x)
        writeLocalStockTransfers(next)
        return next
      })
      showToast('Stock transfer dispatched!')
      refresh()
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
      setItems(prev => {
        const next = prev.map(x => getId(x) === id ? { ...x, status: 'Received' } : x)
        writeLocalStockTransfers(next)
        return next
      })
      showToast('Stock transfer received and finalized!')
      refresh()
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
      setItems(prev => {
        const next = prev.map(x => getId(x) === id ? { ...x, status: 'Cancelled' } : x)
        writeLocalStockTransfers(next)
        return next
      })
      showToast('Stock transfer cancelled.')
      refresh()
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
      setViewineItem(response?.data || response || item)
    } catch (e) {
      setViewineItem(item)
    }
  }

  // Dynamic getters for columns - 100% object-safe to prevent React crashes
  const getFromLoc = (item) => {
    const val = item?.fromLocation || item?.source || '-'
    if (val && typeof val === 'object') return val.name || val.location || '-'
    return val || '-'
  }
  const getToLoc = (item) => {
    const val = item?.toLocation || item?.destination || '-'
    if (val && typeof val === 'object') return val.name || val.location || '-'
    return val || '-'
  }
  const getMedicineName = (item) => {
    const val = item?.medicineName || item?.medicine?.name || item?.name || '-'
    if (val && typeof val === 'object') return val.name || val.medicineName || '-'
    return val || '-'
  }
  const getBatchNo = (item) => {
    const val = item?.batchNumber || item?.batchNo || '-'
    if (val && typeof val === 'object') return val.number || val.batchNumber || val.batchNo || '-'
    return val || '-'
  }
  const getQty = (item) => {
    const val = item?.transferQuantity || item?.quantity || item?.qty || 0
    if (val && typeof val === 'object') return val.amount || val.transferQuantity || val.qty || 0
    return val
  }
  const getDate = (item) => {
    const d = item?.createdAt || item?.date || '-'
    if (typeof d === 'string' && d.includes('T')) return d.split('T')[0]
    if (d && typeof d === 'object') {
      if (d instanceof Date) return d.toISOString().split('T')[0]
      return d.date || d.formatted || '-'
    }
    return String(d || '-')
  }
  const getTransferId = (item) => {
    const val = item?.transferId || item?._id || '-'
    if (val && typeof val === 'object') return val.number || val.id || '-'
    return String(val || '-')
  }

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
    <AdminLayout headerAction={<button
              type="button"
              className="page-heading-refresh"
              onClick={refresh}
            >
              <svg viewBox="0 0 24 24"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
              Refresh
            </button>} activeLabel="Stock Transfers" title="Stock Transfers" subtitle="Manaee medicine stock transfers between pharmacy locations.">
      <div className="stock-scroll-area">
        <div className="transfer-layout-container">

          {/* Summary Cards (5 Equal Sized Cards) */}
          <div className="transfer-summary-grid">
            <div className="transfer-summary-card" style={{ '--card-accent': '#2563eb', '--card-bg': '#eff6ff', '--card-border': 'rgba(37, 99, 235, 0.2)' }}>
              <div className="transfer-summary-icon-wrap">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="17 1 21 5 17 9"/>
                  <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                  <polyline points="7 23 3 19 7 15"/>
                  <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                </svg>
              </div>
              <div className="transfer-summary-info">
                <label>Total Transfers</label>
                <span>{summary.total}</span>
              </div>
            </div>

            <div className="transfer-summary-card" style={{ '--card-accent': '#f59e0b', '--card-bg': '#fef3c7', '--card-border': 'rgba(245, 158, 11, 0.2)' }}>
              <div className="transfer-summary-icon-wrap">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
              </div>
              <div className="transfer-summary-info">
                <label>Pending Transfers</label>
                <span>{summary.pending}</span>
              </div>
            </div>

            <div className="transfer-summary-card" style={{ '--card-accent': '#0ea5e9', '--card-bg': '#e0f2fe', '--card-border': 'rgba(14, 165, 233, 0.2)' }}>
              <div className="transfer-summary-icon-wrap">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="13 17 18 12 13 7"/>
                  <line x1="6" y1="12" x2="18" y2="12"/>
                </svg>
              </div>
              <div className="transfer-summary-info">
                <label>Dispatched</label>
                <span>{summary.dispatched}</span>
              </div>
            </div>

            <div className="transfer-summary-card" style={{ '--card-accent': '#10b981', '--card-bg': '#ecfdf5', '--card-border': 'rgba(16, 185, 129, 0.2)' }}>
              <div className="transfer-summary-icon-wrap">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              </div>
              <div className="transfer-summary-info">
                <label>Received</label>
                <span>{summary.received}</span>
              </div>
            </div>

            <div className="transfer-summary-card" style={{ '--card-accent': '#ef4444', '--card-bg': '#fee2e2', '--card-border': 'rgba(239, 68, 68, 0.2)' }}>
              <div className="transfer-summary-icon-wrap">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="15" y1="9" x2="9" y2="15"/>
                  <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
              </div>
              <div className="transfer-summary-info">
                <label>Cancelled</label>
                <span>{summary.cancelled}</span>
              </div>
            </div>
          </div>

          {/* Table Results */}
          <section className="dispense-table-panel">
            <header className="transfer-record-header"><h2>Transfer Logs</h2>
<button
                type="button"
                className="transfer-btn transfer-btn-primary"
                onClick={() => setCreateOpen(true)}
              >
                <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Create Transfer
              </button>
            </header>
          {/* Search Inputs */}
          <div className="transfer-toolbar transfer-record-filters">
            <div className="transfer-search-wrap">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="search-icon"><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></svg>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search transfer ID, medicine, batch, location..."
              />
            </div>
          </div>



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
                          <RowActions itemName={getTransferId(item)} onView={() => openView(item)} onEdit={() => openEdit(item)} onStatus={() => handleReceive(item?._id || item?.id)} onDelete={() => handleCancel(item?._id || item?.id)} />
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
              <form onSubmit={handleCreateSubmit} className="transfer-modal-container" noValidate>
                <div className="transfer-modal-header">
                  <h2>Create Stock Transfer Request</h2>
                  <button type="button" className="transfer-modal-close" onClick={() => setCreateOpen(false)}>&times;</button>
                </div>
                <div className="transfer-modal-body">
                  <div className="transfer-form-grid">
                    <div className="transfer-form-group">
                      <label>From Location / Pharmacy *</label>
                      <input
                        type="text"
                        id="create-fromLocation"
                        value={createForm.fromLocation}
                        onChange={(e) => {
                          setCreateForm({...createForm, fromLocation: e.target.value})
                          if (createErrors.fromLocation) setCreateErrors({...createErrors, fromLocation: ''})
                        }}
                        style={createErrors.fromLocation ? { borderColor: '#ef4444' } : {}}
                        required
                      />
                      {createErrors.fromLocation && (
                        <span className="form-error-msg" style={{ color: '#ef4444', fontSize: '11px', marginTop: '2px' }}>{createErrors.fromLocation}</span>
                      )}
                    </div>
                    <div className="transfer-form-group">
                      <label>To Location / Pharmacy *</label>
                      <input
                        type="text"
                        id="create-toLocation"
                        value={createForm.toLocation}
                        onChange={(e) => {
                          setCreateForm({...createForm, toLocation: e.target.value})
                          if (createErrors.toLocation) setCreateErrors({...createErrors, toLocation: ''})
                        }}
                        style={createErrors.toLocation ? { borderColor: '#ef4444' } : {}}
                        required
                      />
                      {createErrors.toLocation && (
                        <span className="form-error-msg" style={{ color: '#ef4444', fontSize: '11px', marginTop: '2px' }}>{createErrors.toLocation}</span>
                      )}
                    </div>
                    <div className="transfer-form-group">
                      <label>Medicine Name *</label>
                      <input
                        type="text"
                        id="create-medicineName"
                        value={createForm.medicineName}
                        onChange={(e) => {
                          setCreateForm({...createForm, medicineName: e.target.value})
                          if (createErrors.medicineName) setCreateErrors({...createErrors, medicineName: ''})
                        }}
                        style={createErrors.medicineName ? { borderColor: '#ef4444' } : {}}
                        required
                      />
                      {createErrors.medicineName && (
                        <span className="form-error-msg" style={{ color: '#ef4444', fontSize: '11px', marginTop: '2px' }}>{createErrors.medicineName}</span>
                      )}
                    </div>
                    <div className="transfer-form-group">
                      <label>Batch Number *</label>
                      <input
                        type="text"
                        id="create-batchNo"
                        value={createForm.batchNo}
                        onChange={(e) => {
                          setCreateForm({...createForm, batchNo: e.target.value})
                          if (createErrors.batchNo) setCreateErrors({...createErrors, batchNo: ''})
                        }}
                        style={createErrors.batchNo ? { borderColor: '#ef4444' } : {}}
                        required
                      />
                      {createErrors.batchNo && (
                        <span className="form-error-msg" style={{ color: '#ef4444', fontSize: '11px', marginTop: '2px' }}>{createErrors.batchNo}</span>
                      )}
                    </div>
                    <div className="transfer-form-group full-width">
                      <label>Transfer Quantity *</label>
                      <input
                        type="number"
                        id="create-quantity"
                        value={createForm.quantity}
                        onChange={(e) => {
                          setCreateForm({...createForm, quantity: e.target.value})
                          if (createErrors.quantity) setCreateErrors({...createErrors, quantity: ''})
                        }}
                        style={createErrors.quantity ? { borderColor: '#ef4444' } : {}}
                        required
                      />
                      {createErrors.quantity && (
                        <span className="form-error-msg" style={{ color: '#ef4444', fontSize: '11px', marginTop: '2px' }}>{createErrors.quantity}</span>
                      )}
                    </div>
                    <div className="transfer-form-group">
                      <label>Requested By *</label>
                      <input
                        type="text"
                        id="create-requestedBy"
                        value={createForm.requestedBy}
                        onChange={(e) => {
                          setCreateForm({...createForm, requestedBy: e.target.value})
                          if (createErrors.requestedBy) setCreateErrors({...createErrors, requestedBy: ''})
                        }}
                        style={createErrors.requestedBy ? { borderColor: '#ef4444' } : {}}
                        required
                      />
                      {createErrors.requestedBy && (
                        <span className="form-error-msg" style={{ color: '#ef4444', fontSize: '11px', marginTop: '2px' }}>{createErrors.requestedBy}</span>
                      )}
                    </div>
                    <div className="transfer-form-group">
                      <label>Approved By</label>
                      <input
                        type="text"
                        id="create-approvedBy"
                        value={createForm.approvedBy}
                        onChange={(e) => setCreateForm({...createForm, approvedBy: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
                <div className="transfer-modal-footer">
                  <button type="button" className="transfer-btn transfer-btn-secondary" onClick={() => setCreateOpen(false)} disabled={submitting}>Cancel</button>
                  <button type="submit" className="transfer-btn transfer-btn-primary" disabled={submitting}>
                    {submitting ? 'Requesting...' : 'Request Transfer'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Modal 2: Edit Transfer */}
          {editItem && (
            <div className="transfer-modal-overlay">
              <form onSubmit={handleUpdateSubmit} className="transfer-modal-container" noValidate>
                <div className="transfer-modal-header">
                  <h2>Update Stock Transfer: {getTransferId(editItem)}</h2>
                  <button type="button" className="transfer-modal-close" onClick={() => setEditItem(null)}>&times;</button>
                </div>
                <div className="transfer-modal-body">
                  <div className="transfer-form-grid">
                    <div className="transfer-form-group">
                      <label>From Location / Pharmacy *</label>
                      <input
                        type="text"
                        id="edit-fromLocation"
                        value={editForm.fromLocation}
                        onChange={(e) => {
                          setEditForm({...editForm, fromLocation: e.target.value})
                          if (editErrors.fromLocation) setEditErrors({...editErrors, fromLocation: ''})
                        }}
                        style={editErrors.fromLocation ? { borderColor: '#ef4444' } : {}}
                        required
                      />
                      {editErrors.fromLocation && (
                        <span className="form-error-msg" style={{ color: '#ef4444', fontSize: '11px', marginTop: '2px' }}>{editErrors.fromLocation}</span>
                      )}
                    </div>
                    <div className="transfer-form-group">
                      <label>To Location / Pharmacy *</label>
                      <input
                        type="text"
                        id="edit-toLocation"
                        value={editForm.toLocation}
                        onChange={(e) => {
                          setEditForm({...editForm, toLocation: e.target.value})
                          if (editErrors.toLocation) setEditErrors({...editErrors, toLocation: ''})
                        }}
                        style={editErrors.toLocation ? { borderColor: '#ef4444' } : {}}
                        required
                      />
                      {editErrors.toLocation && (
                        <span className="form-error-msg" style={{ color: '#ef4444', fontSize: '11px', marginTop: '2px' }}>{editErrors.toLocation}</span>
                      )}
                    </div>
                    <div className="transfer-form-group">
                      <label>Medicine Name *</label>
                      <input
                        type="text"
                        id="edit-medicineName"
                        value={editForm.medicineName}
                        onChange={(e) => {
                          setEditForm({...editForm, medicineName: e.target.value})
                          if (editErrors.medicineName) setEditErrors({...editErrors, medicineName: ''})
                        }}
                        style={editErrors.medicineName ? { borderColor: '#ef4444' } : {}}
                        required
                      />
                      {editErrors.medicineName && (
                        <span className="form-error-msg" style={{ color: '#ef4444', fontSize: '11px', marginTop: '2px' }}>{editErrors.medicineName}</span>
                      )}
                    </div>
                    <div className="transfer-form-group">
                      <label>Batch Number *</label>
                      <input
                        type="text"
                        id="edit-batchNo"
                        value={editForm.batchNo}
                        onChange={(e) => {
                          setEditForm({...editForm, batchNo: e.target.value})
                          if (editErrors.batchNo) setEditErrors({...editErrors, batchNo: ''})
                        }}
                        style={editErrors.batchNo ? { borderColor: '#ef4444' } : {}}
                        required
                      />
                      {editErrors.batchNo && (
                        <span className="form-error-msg" style={{ color: '#ef4444', fontSize: '11px', marginTop: '2px' }}>{editErrors.batchNo}</span>
                      )}
                    </div>
                    <div className="transfer-form-group">
                      <label>Status *</label>
                      <select
                        id="edit-status"
                        value={editForm.status}
                        onChange={(e) => {
                          setEditForm({...editForm, status: e.target.value})
                          if (editErrors.status) setEditErrors({...editErrors, status: ''})
                        }}
                        style={editErrors.status ? { borderColor: '#ef4444' } : {}}
                      >
                        <option value="Draft">Draft</option>
                        <option value="Pending">Pending</option>
                        <option value="Dispatched">Dispatched</option>
                        <option value="Received">Received</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                      {editErrors.status && (
                        <span className="form-error-msg" style={{ color: '#ef4444', fontSize: '11px', marginTop: '2px' }}>{editErrors.status}</span>
                      )}
                    </div>
                    <div className="transfer-form-group">
                      <label>Transfer Quantity *</label>
                      <input
                        type="number"
                        id="edit-quantity"
                        value={editForm.quantity}
                        onChange={(e) => {
                          setEditForm({...editForm, quantity: e.target.value})
                          if (editErrors.quantity) setEditErrors({...editErrors, quantity: ''})
                        }}
                        style={editErrors.quantity ? { borderColor: '#ef4444' } : {}}
                        required
                      />
                      {editErrors.quantity && (
                        <span className="form-error-msg" style={{ color: '#ef4444', fontSize: '11px', marginTop: '2px' }}>{editErrors.quantity}</span>
                      )}
                    </div>
                    <div className="transfer-form-group">
                      <label>Requested By *</label>
                      <input
                        type="text"
                        id="edit-requestedBy"
                        value={editForm.requestedBy}
                        onChange={(e) => {
                          setEditForm({...editForm, requestedBy: e.target.value})
                          if (editErrors.requestedBy) setEditErrors({...editErrors, requestedBy: ''})
                        }}
                        style={editErrors.requestedBy ? { borderColor: '#ef4444' } : {}}
                        required
                      />
                      {editErrors.requestedBy && (
                        <span className="form-error-msg" style={{ color: '#ef4444', fontSize: '11px', marginTop: '2px' }}>{editErrors.requestedBy}</span>
                      )}
                    </div>
                    <div className="transfer-form-group">
                      <label>Approved By</label>
                      <input
                        type="text"
                        id="edit-approvedBy"
                        value={editForm.approvedBy}
                        onChange={(e) => setEditForm({...editForm, approvedBy: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
                <div className="transfer-modal-footer">
                  <button type="button" className="transfer-btn transfer-btn-secondary" onClick={() => setEditItem(null)} disabled={submitting}>Cancel</button>
                  <button type="submit" className="transfer-btn transfer-btn-primary" disabled={submitting}>
                    {submitting ? 'Updating...' : 'Update Transfer'}
                  </button>
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
                  <button type="button" className="transfer-modal-close" onClick={() => setViewineItem(null)}>&times;</button>
                </div>
                <div className="transfer-modal-body">
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
                  <button type="button" className="transfer-btn transfer-btn-primary" onClick={() => setViewineItem(null)}>Close</button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </AdminLayout>
  )
}



