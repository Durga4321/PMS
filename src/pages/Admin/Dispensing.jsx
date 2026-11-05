import { useEffect, useState, useMemo } from 'react'
import { useToast } from '../../components/ToastProvider'
import RowActions from '../../components/RowActions'
import AdminLayout from './AdminLayout'
import { 
  dispensePrescription, 
  generateBill, 
  getInvoice, 
  getPendingPharmacyPrescriptions,
  getPharmacyDispensingOverview, 
  getPharmacyPrescription, 
  recordPayment,
  getPharmacyAdminDashboard,
  listBills,
  getPharmacyPayments,
  deductMedicineStock,
  readLocalMedicines,
  listMedicines
} from '../../config/api'
import './Dispensing.css'

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
  if (Array.isArray(response?.prescriptions)) return response.prescriptions
  if (Array.isArray(response?.bills)) return response.bills
  if (Array.isArray(response?.payments)) return response.payments
  return []
}

export default function Dispensing() {
  const { showToast } = useToast()
  const [items, setItems] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeWorkflow, setActiveWorkflow] = useState('prescriptions') // prescriptions, dispense, bill, invoices, payments
  const [giveModalOpen, setGiveModalOpen] = useState(false)
  const [availableMedicines, setAvailableMedicines] = useState(() => readLocalMedicines())
  const [giveForm, setGiveForm] = useState({
    patientName: '',
    medicineId: '',
    quantity: 1,
    prescribedBy: '',
    paymentStatus: 'Paid',
    notes: ''
  })
  
  // Dashboard summary metrics
  const [summary, setSummary] = useState({
    pendingPrescriptions: '0',
    todayDispensing: '0',
    pendingBills: '0',
    paidBills: '0',
    todayRevenue: '0'
  })

  // Load summary metrics from Dashboard data
  async function loadSummary() {
    try {
      const response = await getPharmacyAdminDashboard()
      const data = response?.data || response || {}
      setSummary({
        pendingPrescriptions: String(data?.pendingPrescriptions || data?.pendingPrescriptionsCount || '0'),
        todayDispensing: String(data?.todayDispensed || data?.dispensedCount || '0'),
        pendingBills: String(data?.pendingBills || data?.unpaidBillsCount || '0'),
        paidBills: String(data?.paidBills || data?.paidBillsCount || '0'),
        todayRevenue: `₹${data?.todayRevenue || data?.revenue || '0'}`
      })
    } catch (e) {
      console.log('Unable to load billing summary details:', e.message)
    }
  }

  // Load the active tab data
  async function loadActiveTab(workflow = activeWorkflow) {
    setLoading(true)
    setActiveWorkflow(workflow)
    try {
      let response
      if (workflow === 'prescriptions') {
        response = await getPendingPharmacyPrescriptions()
      } else if (workflow === 'dispense') {
        response = await getPharmacyDispensingOverview()
      } else if (workflow === 'bill' || workflow === 'invoices') {
        response = await listBills()
      } else if (workflow === 'payments') {
        response = await getPharmacyPayments()
      }
      setItems(normalizeList(response))
    } catch (error) {
      showToast(error.message, 'error')
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSummary()
    loadActiveTab('prescriptions')

    async function loadMeds() {
      try {
        const res = await listMedicines()
        const normalized = Array.isArray(res) ? res : (res?.data || [])
        if (normalized.length > 0) {
          setAvailableMedicines(normalized)
        } else {
          setAvailableMedicines(readLocalMedicines())
        }
      } catch {
        setAvailableMedicines(readLocalMedicines())
      }
    }
    loadMeds()

    function handleSync() {
      loadSummary()
      setAvailableMedicines(readLocalMedicines())
    }
    window.addEventListener('pms:stock-updated', handleSync)
    window.addEventListener('pms:medicines-updated', handleSync)
    window.addEventListener('storage', handleSync)
    return () => {
      window.removeEventListener('pms:stock-updated', handleSync)
      window.removeEventListener('pms:medicines-updated', handleSync)
      window.removeEventListener('storage', handleSync)
    }
  }, [])

  // Filtered list based on Search query
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const pName = String(item?.patientName || item?.patient?.name || item?.patient || '').toLowerCase()
      const rxId = String(item?.prescriptionId || item?.rxNo || item?._id || '').toLowerCase()
      const billId = String(item?.billNo || item?.invoiceNumber || '').toLowerCase()
      const query = search.toLowerCase()
      
      return pName.includes(query) || rxId.includes(query) || billId.includes(query)
    })
  }, [items, search])

  // Click handler for Actions column functions
  async function handleView(item) {
    const id = item?.prescriptionId || item?.rxNo || item?._id
    showToast(`Viewing prescription: ${id}`)
    try {
      const response = await getPharmacyPrescription(id)
      showToast(`Loaded: ${response?.data?.patientName || 'Details'}`)
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  async function handleDispense(item) {
    setLoading(true)
    try {
      const id = item?.prescriptionId || item?._id
      const meds = Array.isArray(item?.medicines) && item.medicines.length > 0
        ? item.medicines
        : (item?.medicineName ? [{ medicineName: item.medicineName, quantity: item.quantity || 1 }] : [])
      
      // Auto-deduct stock for each medicine dispensed
      meds.forEach(m => {
        deductMedicineStock(m, Number(m?.quantity || m?.qty || 1), 'dispense')
      })

      const response = await dispensePrescription({
        prescriptionId: Number(id) || id,
        medicines: meds.map((medicine) => ({
          prescriptionItemId: Number(medicine.prescriptionItemId || medicine.id || medicine.prescriptionItem?.id || 1),
          quantity: Number(medicine.quantity || 1),
          medicineName: medicine.medicineName || medicine.name
        }))
      })

      // Update dispensing status on the item
      setItems(prev => prev.map(it => (it?._id === item?._id || it?.prescriptionId === item?.prescriptionId ? { ...it, dispensingStatus: 'Dispensed', status: 'Dispensed' } : it)))

      showToast(response?.message || 'Medicine dispensed successfully! Stock reduced in inventory.')
      loadSummary()
    } catch (error) {
      showToast(error.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleDirectDispense(e) {
    e.preventDefault()
    if (!giveForm.patientName.trim()) {
      return showToast('Please enter Patient Name.', 'error')
    }
    if (!giveForm.medicineId) {
      return showToast('Please select a medicine.', 'error')
    }
    const qty = Math.max(1, Number(giveForm.quantity) || 1)
    const targetMed = availableMedicines.find(m => String(m.id || m._id || m.medicineId) === String(giveForm.medicineId))
    if (!targetMed) {
      return showToast('Selected medicine not found.', 'error')
    }

    const availableStock = Number(targetMed.stock ?? targetMed.quantity ?? targetMed.currentStock ?? 0)
    if (availableStock < qty) {
      if (!window.confirm(`Available stock is only ${availableStock} units. Do you still want to dispense ${qty} units?`)) {
        return
      }
    }

    setLoading(true)
    try {
      // 1. Deduct stock in real-time
      deductMedicineStock(targetMed, qty, 'dispense')

      // 2. Call backend dispense
      try {
        await dispensePrescription({
          patientName: giveForm.patientName,
          medicines: [{
            medicineId: targetMed.id || targetMed._id,
            medicineName: targetMed.name || targetMed.medicineName,
            quantity: qty
          }]
        })
      } catch (err) {
        console.warn('Backend dispensePrescription notice:', err.message)
      }

      // 3. Add record to local items so it reflects immediately in table
      const price = Number(targetMed.sellingPrice || targetMed.price || targetMed.mrp || 0)
      const newRecord = {
        _id: `disp_${Date.now()}`,
        prescriptionId: `RX-${Math.floor(1000 + Math.random() * 9000)}`,
        patientName: giveForm.patientName,
        medicines: [{
          medicineName: targetMed.name || targetMed.medicineName,
          quantity: qty,
          unitPrice: price
        }],
        quantity: qty,
        amount: price * qty,
        paymentStatus: giveForm.paymentStatus || 'Paid',
        dispensingStatus: 'Dispensed',
        createdAt: new Date().toISOString()
      }
      setItems(prev => [newRecord, ...prev])

      showToast(`Successfully dispensed ${qty} unit(s) of ${targetMed.name || targetMed.medicineName}! Stock reduced.`)
      setGiveModalOpen(false)
      setGiveForm({
        patientName: '',
        medicineId: '',
        quantity: 1,
        prescribedBy: '',
        paymentStatus: 'Paid',
        notes: ''
      })
      loadSummary()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerateBill(item) {
    setLoading(true)
    try {
      const id = item?.prescriptionId || item?._id
      const response = await generateBill({ prescriptionId: Number(id), discount: 0 })
      showToast(response?.message || 'Bill generated successfully!')
      await loadActiveTab('invoices')
      loadSummary()
    } catch (error) {
      showToast(error.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleInvoice(item) {
    const billId = item?._id || item?.id
    showToast(`Downloading invoice ${billId}...`)
    try {
      const response = await getInvoice(billId)
      showToast(`Invoice loaded: ${response?.data?.invoiceNumber || 'Completed'}`)
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  async function handlePayment(item) {
    setLoading(true)
    try {
      const id = item?._id || item?.id
      const response = await recordPayment({ billId: Number(id), paymentMode: 'Cash', transactionId: item?.transactionId || '', paidAmount: Number(item?.amount || item?.totalPrice || item?.total || 0) })
      showToast(response?.message || 'Payment recorded successfully!')
      await loadActiveTab('payments')
      loadSummary()
    } catch (error) {
      showToast(error.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  // Helpers to retrieve formatting values dynamically
  const getPatientName = (item) => item?.patientName || item?.patient?.name || item?.patient || '-'
  const getRxId = (item) => item?.prescriptionId || item?.rxNo || item?.billNo || item?.invoiceNumber || item?._id || '-'
  const getMedicineNames = (item) => {
    if (Array.isArray(item?.medicines)) {
      return item.medicines.map(m => m.medicineName || m.name || m).join(', ')
    }
    return item?.medicineName || item?.medicine || '-'
  }
  const getQty = (item) => {
    if (Array.isArray(item?.medicines)) {
      return item.medicines.map(m => Number(m.quantity || m.qty || 0)).reduce((a, b) => a + b, 0)
    }
    return item?.quantity || item?.qty || 1
  }
  const getAmount = (item) => `₹${item?.amount || item?.totalPrice || item?.total || '0'}`
  const getDate = (item) => {
    const d = item?.createdAt || item?.date || '-'
    return d.includes('T') ? d.split('T')[0] : d
  }

  // Get status badge templates
  const getPaymentBadge = (item) => {
    const status = String(item?.paymentStatus || item?.payment || 'Unpaid').toLowerCase()
    if (status.includes('paid') && !status.includes('un')) {
      return <span className="branch-status active">Paid</span>
    }
    return <span className="branch-status expired">Unpaid</span>
  }

  const getDispenseBadge = (item) => {
    const status = String(item?.dispensingStatus || item?.status || 'Pending').toLowerCase()
    if (status.includes('completed') || status.includes('dispensed')) {
      return <span className="branch-status view">Dispensed</span>
    }
    if (status.includes('cancelled')) {
      return <span className="branch-status expired">Cancelled</span>
    }
    return <span className="branch-status near-expiry">Pending</span>
  }

  return (
    <AdminLayout activeLabel="Dispensing" title="Dispensing & Billing" subtitle="Manage prescriptions, medicine dispensing, invoices, and payments.">
      <div className="stock-scroll-area">
        <div className="dispense-layout-container">

          {/* Workflow Tabs (Spaced Card Buttons) */}
          <div className="dispense-workflow-cards-grid">
            <button 
              type="button" 
              className={`dispense-workflow-card ${activeWorkflow === 'prescriptions' ? 'active' : ''}`}
              style={{ '--card-accent': '#2563eb', '--card-bg': '#eff6ff', '--card-border': 'rgba(37, 99, 235, 0.25)' }}
              onClick={() => loadActiveTab('prescriptions')}
            >
              <div className="dispense-card-icon-wrap">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
              </div>
              <div className="dispense-card-text">
                <span>Prescriptions</span>
                <small>Rx Queue</small>
              </div>
            </button>

            <button 
              type="button" 
              className={`dispense-workflow-card ${activeWorkflow === 'dispense' ? 'active' : ''}`}
              style={{ '--card-accent': '#0ea5e9', '--card-bg': '#e0f2fe', '--card-border': 'rgba(14, 165, 233, 0.25)' }}
              onClick={() => loadActiveTab('dispense')}
            >
              <div className="dispense-card-icon-wrap">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m14.5 4.5 5 5a4.24 4.24 0 0 1-6 6l-5-5a4.24 4.24 0 0 1 6-6Z"/>
                  <path d="m10 9 5 5"/>
                </svg>
              </div>
              <div className="dispense-card-text">
                <span>Dispense Medicine</span>
                <small>Fulfill Rx</small>
              </div>
            </button>

            <button 
              type="button" 
              className={`dispense-workflow-card ${activeWorkflow === 'bill' ? 'active' : ''}`}
              style={{ '--card-accent': '#f59e0b', '--card-bg': '#fef3c7', '--card-border': 'rgba(245, 158, 11, 0.25)' }}
              onClick={() => loadActiveTab('bill')}
            >
              <div className="dispense-card-icon-wrap">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </div>
              <div className="dispense-card-text">
                <span>Generate Bill</span>
                <small>Create Invoice</small>
              </div>
            </button>

            <button 
              type="button" 
              className={`dispense-workflow-card ${activeWorkflow === 'invoices' ? 'active' : ''}`}
              style={{ '--card-accent': '#8b5cf6', '--card-bg': '#f3e8ff', '--card-border': 'rgba(139, 92, 246, 0.25)' }}
              onClick={() => loadActiveTab('invoices')}
            >
              <div className="dispense-card-icon-wrap">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
              </div>
              <div className="dispense-card-text">
                <span>Invoices</span>
                <small>Billing Records</small>
              </div>
            </button>

            <button 
              type="button" 
              className={`dispense-workflow-card ${activeWorkflow === 'payments' ? 'active' : ''}`}
              style={{ '--card-accent': '#10b981', '--card-bg': '#ecfdf5', '--card-border': 'rgba(16, 185, 129, 0.25)' }}
              onClick={() => loadActiveTab('payments')}
            >
              <div className="dispense-card-icon-wrap">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                  <line x1="1" y1="10" x2="23" y2="10"/>
                  <circle cx="12" cy="15" r="2"/>
                </svg>
              </div>
              <div className="dispense-card-text">
                <span>Payments</span>
                <small>Record Payment</small>
              </div>
            </button>
          </div>

          {/* Billing Summary Cards (5 Equal Sized Cards) */}
          <div className="dispense-summary-grid">
            <div className="dispense-summary-card" style={{ '--card-accent': '#2563eb', '--card-bg': '#eff6ff', '--card-border': 'rgba(37, 99, 235, 0.2)' }}>
              <div className="dispense-summary-icon-wrap">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                </svg>
              </div>
              <div className="dispense-summary-info">
                <label>Pending Prescriptions</label>
                <span>{summary.pendingPrescriptions}</span>
              </div>
            </div>

            <div className="dispense-summary-card" style={{ '--card-accent': '#0ea5e9', '--card-bg': '#e0f2fe', '--card-border': 'rgba(14, 165, 233, 0.2)' }}>
              <div className="dispense-summary-icon-wrap">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m14.5 4.5 5 5a4.24 4.24 0 0 1-6 6l-5-5a4.24 4.24 0 0 1 6-6Z"/>
                </svg>
              </div>
              <div className="dispense-summary-info">
                <label>Today's Dispensing</label>
                <span>{summary.todayDispensing}</span>
              </div>
            </div>

            <div className="dispense-summary-card" style={{ '--card-accent': '#f59e0b', '--card-bg': '#fef3c7', '--card-border': 'rgba(245, 158, 11, 0.2)' }}>
              <div className="dispense-summary-icon-wrap">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </div>
              <div className="dispense-summary-info">
                <label>Pending Bills</label>
                <span>{summary.pendingBills}</span>
              </div>
            </div>

            <div className="dispense-summary-card" style={{ '--card-accent': '#8b5cf6', '--card-bg': '#f3e8ff', '--card-border': 'rgba(139, 92, 246, 0.2)' }}>
              <div className="dispense-summary-icon-wrap">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              </div>
              <div className="dispense-summary-info">
                <label>Paid Bills</label>
                <span>{summary.paidBills}</span>
              </div>
            </div>

            <div className="dispense-summary-card" style={{ '--card-accent': '#10b981', '--card-bg': '#ecfdf5', '--card-border': 'rgba(16, 185, 129, 0.2)' }}>
              <div className="dispense-summary-icon-wrap">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="1" x2="12" y2="23"/>
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                </svg>
              </div>
              <div className="dispense-summary-info">
                <label style={{ color: '#10b981' }}>Today's Revenue</label>
                <span style={{ color: '#10b981' }}>{summary.todayRevenue}</span>
              </div>
            </div>
          </div>

          {/* Search bar */}
          <div className="dispense-search-row">
            <div className="dispense-search-wrap">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="search-icon"><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></svg>
              <input 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
                placeholder="Search prescription, patient, invoice..." 
              />
            </div>
            <div className="dispense-btn-group">
              <button 
                type="button" 
                className="dispense-btn-primary"
                onClick={() => setGiveModalOpen(true)}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '6px', verticalAlign: 'middle' }}>
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Dispense Medicine
              </button>
              <button 
                type="button" 
                className="dispense-btn-secondary"
                onClick={() => {
                  loadSummary()
                  loadActiveTab(activeWorkflow)
                }}
              >
                Refresh
              </button>
            </div>
          </div>

          {/* Results Table Panel */}
          <section className="dispense-table-panel">
            <h2>Workflow Records</h2>
            
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
                      <th>Patient</th>
                      <th>Prescription ID</th>
                      <th>Medicine</th>
                      <th>Quantity</th>
                      <th>Amount</th>
                      <th>Payment Status</th>
                      <th>Dispensing Status</th>
                      <th>Date</th>
                      <th style={{ width: '180px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.length ? filteredItems.map((item, index) => (
                      <tr key={item?._id || item?.id || index}>
                        <td><div style={{ fontWeight: 600, color: '#1e293b' }}>{getPatientName(item)}</div></td>
                        <td><code>{getRxId(item)}</code></td>
                        <td>{getMedicineNames(item)}</td>
                        <td>{getQty(item)}</td>
                        <td>{getAmount(item)}</td>
                        <td>{getPaymentBadge(item)}</td>
                        <td>{getDispenseBadge(item)}</td>
                        <td>{getDate(item)}</td>
                        <td>
                          <RowActions itemName={getRxId(item)} onView={() => handleView(item)} onEdit={() => handleDispense(item)} statusDisabled={true} onDelete={() => handleInvoice(item)} />
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan="9">
                          <div className="dispense-empty-state">
                            <h3>No dispensing or billing records found.</h3>
                            <p>Records will appear here when prescriptions are available.</p>
                          </div>
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

      {/* Give / Dispense Medicine Modal */}
      {giveModalOpen && (
        <div className="dispense-modal-overlay" onClick={() => setGiveModalOpen(false)}>
          <div className="dispense-modal-card" onClick={e => e.stopPropagation()}>
            <div className="dispense-modal-header">
              <div>
                <h2>Dispense Medicine</h2>
                <p>Dispense medicine directly to patient. Stock will decrease in real time.</p>
              </div>
              <button 
                type="button" 
                className="med-modal-close" 
                onClick={() => setGiveModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleDirectDispense}>
              <div className="dispense-modal-body">
                <div className="dispense-form-group">
                  <label htmlFor="disp-patient">Patient Name *</label>
                  <input 
                    type="text" 
                    id="disp-patient"
                    placeholder="e.g. Ramesh Kumar"
                    value={giveForm.patientName}
                    onChange={e => setGiveForm({ ...giveForm, patientName: e.target.value })}
                    required
                  />
                </div>

                <div className="dispense-form-group">
                  <label htmlFor="disp-medicine">Select Medicine *</label>
                  <select 
                    id="disp-medicine"
                    value={giveForm.medicineId}
                    onChange={e => setGiveForm({ ...giveForm, medicineId: e.target.value })}
                    required
                  >
                    <option value="">-- Choose medicine from stock --</option>
                    {availableMedicines.map((med, idx) => {
                      const mId = med.id || med._id || med.medicineId || idx
                      const mName = med.name || med.medicineName || 'Unnamed'
                      const mStock = Number(med.stock ?? med.quantity ?? med.currentStock ?? 0)
                      const mPrice = Number(med.sellingPrice || med.price || 0)
                      return (
                        <option key={mId} value={mId}>
                          {mName} (Stock: {mStock}) {mPrice > 0 ? `- ₹${mPrice}` : ''}
                        </option>
                      )
                    })}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="dispense-form-group">
                    <label htmlFor="disp-qty">Quantity to Give *</label>
                    <input 
                      type="number" 
                      id="disp-qty"
                      min="1"
                      value={giveForm.quantity}
                      onChange={e => setGiveForm({ ...giveForm, quantity: e.target.value })}
                      required
                    />
                  </div>

                  <div className="dispense-form-group">
                    <label htmlFor="disp-payment">Payment Status</label>
                    <select 
                      id="disp-payment"
                      value={giveForm.paymentStatus}
                      onChange={e => setGiveForm({ ...giveForm, paymentStatus: e.target.value })}
                    >
                      <option value="Paid">Paid</option>
                      <option value="Unpaid">Unpaid</option>
                    </select>
                  </div>
                </div>

                <div className="dispense-form-group">
                  <label htmlFor="disp-doctor">Prescribed By / Doctor</label>
                  <input 
                    type="text" 
                    id="disp-doctor"
                    placeholder="e.g. Dr. Sharma"
                    value={giveForm.prescribedBy}
                    onChange={e => setGiveForm({ ...giveForm, prescribedBy: e.target.value })}
                  />
                </div>

                <div className="dispense-form-group">
                  <label htmlFor="disp-notes">Notes / Instructions</label>
                  <input 
                    type="text" 
                    id="disp-notes"
                    placeholder="e.g. After meals, twice daily"
                    value={giveForm.notes}
                    onChange={e => setGiveForm({ ...giveForm, notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="dispense-modal-footer">
                <button 
                  type="button" 
                  className="dispense-btn-secondary"
                  onClick={() => setGiveModalOpen(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="dispense-btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Dispensing...' : 'Dispense & Reduce Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}




