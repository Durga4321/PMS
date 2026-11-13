import { useEffect, useRef, useState, useCallback } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  getPharmacistDashboard,
  getPendingPharmacyPrescriptions,
  getPharmacistInventoryAlerts,
  listBills,
  listMedicineReturns,
  dispensePrescription,
  getPharmacyPrescription,
} from '../../config/api'
import { useToast } from '../../components/ToastProvider'
import PharmacistLayout from './PharmacistLayout'
import DashboardGreetingCard from '../../components/DashboardGreetingCard'
import './Dashboard.css'

const unwrap = (value) => value?.data?.dashboard || value?.data || value?.dashboard || value || {}
const field = (object, keys) => keys.map((key) => key.split('.').reduce((value, part) => value?.[part], object)).find((value) => value !== undefined && value !== null)
const rows = (value, keys = []) => {
  if (Array.isArray(value)) return value
  for (const key of [...keys, 'items', 'results', 'records', 'data']) {
    if (Array.isArray(value?.[key])) return value[key]
  }
  return []
}
const text = (value, fallback = '—') => ['string', 'number'].includes(typeof value) ? String(value) : fallback
const count = (value) => Array.isArray(value) ? value.length : typeof value === 'number' || (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) ? Number(value).toLocaleString('en-IN') : '—'
const formatTime = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}
const sources = [
  getPharmacistDashboard,
  getPendingPharmacyPrescriptions,
  getPharmacistInventoryAlerts,
  listBills,
  listMedicineReturns,
]

function Icon({ name }) {
  const paths = {
    prescription: 'M6 3h9l4 4v14H6z M14 3v5h5 M9 12h7 M9 16h7',
    dispense: 'm8 16 8-8 M5 19a5 5 0 0 1 0-7l7-7a5 5 0 0 1 7 7l-7 7a5 5 0 0 1-7 0z',
    bill: 'M5 3h14v18l-3-2-4 2-4-2-3 2z M8 8h8 M8 12h8 M8 16h5',
    returns: 'M4 5v6h6 M4 11a8 8 0 1 1 1 7',
    alert: 'm12 3 10 18H2z M12 9v5 M12 17v1',
    stock: 'm12 2 10 5v10l-10 5-10-5V7z M2 7l10 5 10-5 M12 12v10',
    chart: 'M3 3v18h18 M7 16l5-6 4 3 5-8',
    clock: 'M12 8v5l4 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  }
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.stock} /></svg>
}

function Panel({ title, icon, to, children, className = '' }) {
  return <section className={`pd-panel ${className}`}><div className="pd-panel-heading"><h2><Icon name={icon} />{title}</h2>{to && <Link to={to}>View all →</Link>}</div>{children}</section>
}
function Empty({ error, loading, label = 'No records available.' }) {
  return <p className={`pd-empty${error ? ' pd-error' : ''}`} role={error ? 'alert' : undefined}>{loading ? 'Loading live data…' : error || label}</p>
}

export default function Dashboard() {
  const { showToast } = useToast()
  const [data, setData] = useState([null, null, null, null, null])
  const [errors, setErrors] = useState([])
  const [loading, setLoading] = useState(true)
  const [updated, setUpdated] = useState(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')
  const requestId = useRef(0)
  const location = useLocation()

  // Dispense modal state
  const [dispenseModalOpen, setDispenseModalOpen] = useState(false)
  const [dispenseTargetRx, setDispenseTargetRx] = useState(null)
  const [dispenseItems, setDispenseItems] = useState([])
  const [dispensingLoading, setDispensingLoading] = useState(false)

  const reloadDashboard = useCallback(() => {
    const id = ++requestId.current
    setLoading(true)
    Promise.allSettled(sources.map((load) => load())).then((results) => {
      if (id !== requestId.current) return
      setData(results.map((result) => result.status === 'fulfilled' ? unwrap(result.value) : null))
      setErrors(results.map((result) => result.status === 'rejected' ? result.reason?.message || 'Unable to load this section.' : ''))
      setUpdated(results.some((result) => result.status === 'fulfilled') ? new Date() : null)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    let disposed = false
    const id = ++requestId.current
    Promise.resolve().then(() => { if (!disposed) setLoading(true) })
    Promise.allSettled(sources.map((load) => load())).then((results) => {
      if (disposed || id !== requestId.current) return
      setData(results.map((result) => result.status === 'fulfilled' ? unwrap(result.value) : null))
      setErrors(results.map((result) => result.status === 'rejected' ? result.reason?.message || 'Unable to load this section.' : ''))
      setUpdated(results.some((result) => result.status === 'fulfilled') ? new Date() : null)
      setLoading(false)
    })
    return () => { disposed = true }
  }, [location.key])

  async function handleOpenDispense(row) {
    const rxId = field(row, ['prescriptionId', 'id', 'externalPrescriptionId']) || ''
    setDispenseTargetRx(row)
    setDispenseModalOpen(true)
    setDispensingLoading(false)

    const existingMeds = rows(row, ['medicines', 'items', 'prescriptionItems'])
    if (existingMeds.length > 0) {
      setDispenseItems(existingMeds.map((m, idx) => ({
        prescriptionItemId: Number(m.prescriptionItemId || m.id || idx + 1),
        medicineName: m.medicineName || m.name || `Medicine #${idx + 1}`,
        quantity: Number(m.quantity || m.qty || 1)
      })))
    } else {
      setDispenseItems([{
        prescriptionItemId: 1,
        medicineName: field(row, ['medicineName', 'medicine']) || 'Prescribed Medicine',
        quantity: Number(field(row, ['quantity', 'qty']) || 1)
      }])
    }

    if (rxId) {
      try {
        const full = await getPharmacyPrescription(rxId)
        const detailed = full?.data || full?.prescription || full || {}
        const detailedMeds = rows(detailed, ['medicines', 'items', 'prescriptionItems'])
        if (detailedMeds.length > 0) {
          setDispenseItems(detailedMeds.map((m, idx) => ({
            prescriptionItemId: Number(m.prescriptionItemId || m.id || idx + 1),
            medicineName: m.medicineName || m.name || `Medicine #${idx + 1}`,
            quantity: Number(m.quantity || m.qty || 1)
          })))
        }
      } catch {}
    }
  }

  async function handleConfirmDispense() {
    if (!dispenseTargetRx) return
    const rxId = Number(field(dispenseTargetRx, ['prescriptionId', 'id', 'externalPrescriptionId']) || 0)
    setDispensingLoading(true)
    try {
      const payload = {
        prescriptionId: rxId,
        medicines: dispenseItems.map((m, idx) => ({
          prescriptionItemId: Number(m.prescriptionItemId || idx + 1),
          quantity: Number(m.quantity || 1)
        }))
      }
      const response = await dispensePrescription(payload)
      showToast(response?.message || `Prescription #${rxId} dispensed and stock reduced successfully!`)
      setDispenseModalOpen(false)
      setDispenseTargetRx(null)
      reloadDashboard()
    } catch (err) {
      showToast(err.message || 'Failed to dispense prescription.', 'error')
    } finally {
      setDispensingLoading(false)
    }
  }

  const dashboard = data[0] || {}
  const summary = dashboard.summary || dashboard.stats || dashboard.counts || dashboard
  const queue = rows(data[1], ['prescriptions', 'pendingPrescriptions', 'items', 'data'])
  const alerts = rows(data[2], ['alerts', 'items', 'data'])
  const liveBills = rows(data[3], ['bills', 'items', 'data'])
  const liveReturns = rows(data[4], ['returns', 'items', 'data'])
  const statusOf = (row) => text(field(row, ['status', 'prescriptionStatus']), 'Pending')
  const urgent = (row) => /urgent|high|critical/i.test(text(field(row, ['priority', 'urgency']), ''))
  const visibleQueue = queue.filter((row) => (filter === 'All' || (filter === 'Urgent' ? urgent(row) : /progress|processing/i.test(statusOf(row)))) && [row.prescriptionId, row.id, row.patientName, row.patient?.name].some((value) => String(value || '').toLowerCase().includes(search.toLowerCase())))

  const pendingVal = data[1] !== null ? queue.length : field(summary, ['pendingPrescriptions', 'pendingCount', 'pendingPrescriptionsCount'])
  const dispensedVal = field(summary, ['todayDispensed', 'dispensedToday', 'dispensedCount'])
  const billsVal = field(summary, ['totalBills', 'billsCount', 'paidBillsCount']) ?? (data[3] !== null ? liveBills.length : undefined)
  const returnsVal = field(summary, ['todayReturns', 'returnsToday', 'todayReturnsCount']) ?? (data[4] !== null ? liveReturns.length : undefined)

  const metrics = [
    ['prescription', 'Pending prescriptions', pendingVal],
    ['dispense', 'Dispensed today', dispensedVal],
    ['bill', 'Total bills', billsVal],
    ['returns', 'Returns today', returnsVal],
  ]

  return <PharmacistLayout activeLabel="Dashboard" title="Pharmacist Dashboard">
    <div className="pd-dashboard">
      <DashboardGreetingCard role="Pharmacist" subtitle="Your daily dispensing and pharmacy overview" />
      <header className="pd-heading">
        <span className={`pd-sync${errors.some(Boolean) ? ' is-warning' : ''}`}>{loading ? 'Syncing…' : errors.some(Boolean) ? 'Some data unavailable' : 'Live data'}</span>
        <small className="pd-last-refreshed">{updated ? `Last refreshed ${updated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : 'Waiting for live data'}</small>
      </header>
      {errors[0] && !errors[0].includes('Access denied') && <div className="pd-banner" role="alert">Dashboard summary: {errors[0]}</div>}
      <div className="pd-metrics">{metrics.map(([icon, label, value]) => <article className="pd-metric" key={label}><span className="pd-icon"><Icon name={icon} /></span><div><p>{label}</p><strong>{loading ? '…' : count(value)}</strong><small>{value === undefined ? 'Not provided by the server' : 'Current live records'}</small></div></article>)}</div>

      <nav className="pd-action-cards" aria-label="Quick actions">{[['dispense', 'Dispense & Billing', 'dispensing'], ['stock', 'Check medicine stock', 'medicines'], ['bill', 'Manage bills', 'bills'], ['chart', 'View reports', 'reports']].map(([icon, label, path]) => <Link key={path} to={`/pharmacist/${path}`}><Icon name={icon} />{label}</Link>)}</nav>
      <div className="pd-main-row">
        <Panel title="Prescription Queue" icon="prescription" to="/pharmacist/dispensing">
          <div className="pd-queue-tools">
            <div className="pd-tabs">
              {['All', 'Urgent', 'In progress'].map((tab) => (
                <button key={tab} type="button" aria-pressed={filter === tab} onClick={() => setFilter(tab)}>
                  {tab}{tab === 'All' && data[1] !== null ? ` (${queue.length})` : ''}
                </button>
              ))}
            </div>
            <input aria-label="Search prescription queue" placeholder="Search Rx ID or patient…" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <div className="pd-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Rx ID</th>
                  <th>Patient</th>
                  <th>Priority</th>
                  <th>Received</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleQueue.slice(0, 5).map((row, index) => (
                  <tr key={text(field(row, ['prescriptionId', 'id']), String(index))}>
                    <td>{text(field(row, ['prescriptionId', 'externalPrescriptionId', 'id']))}</td>
                    <td>{text(field(row, ['patientName', 'patient.name', 'patient.fullName']))}</td>
                    <td><span className={urgent(row) ? 'pd-pill pd-urgent' : 'pd-pill'}>{text(field(row, ['priority', 'urgency']))}</span></td>
                    <td>{formatTime(field(row, ['createdAt', 'prescriptionDate', 'date']))}</td>
                    <td><span className="pd-pill">{statusOf(row)}</span></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Link to="/pharmacist/dispensing">Review →</Link>
                        {statusOf(row).toLowerCase() !== 'dispensed' && (
                          <button
                            type="button"
                            className="pd-dispense-action-btn"
                            onClick={() => handleOpenDispense(row)}
                            title="Dispense medicines and reduce stock"
                          >
                            Dispense
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!visibleQueue.length && <Empty loading={loading} error={errors[1]} label={search || filter !== 'All' ? 'No matching prescriptions.' : 'No pending prescriptions.'} />}
          {visibleQueue.length > 5 && <Link className="pd-more" to="/pharmacist/dispensing">View all {visibleQueue.length} matching prescriptions →</Link>}
        </Panel>
        <Panel title="Needs Attention" icon="alert" to="/pharmacist/medicines">
          {alerts.slice(0, 4).map((alert, index) => (
            <Link className="pd-alert-row" key={index} to="/pharmacist/medicines">
              <span className="pd-icon"><Icon name="alert" /></span>
              <div>
                <strong>{text(field(alert, ['title', 'type', 'medicineName']), 'Inventory alert')}</strong>
                <small>{text(field(alert, ['message', 'description', 'details']), 'Review medicine inventory')}</small>
              </div>
              <span>→</span>
            </Link>
          ))}
          {!alerts.length && <Empty loading={loading} error={errors[2]} label="No inventory alerts reported." />}
        </Panel>

      </div>

      {dispenseModalOpen && dispenseTargetRx && (
        <div className="pd-dispense-modal-overlay" onClick={() => setDispenseModalOpen(false)}>
          <div className="pd-dispense-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pd-dispense-modal-header">
              <h3>Dispense Prescription #{field(dispenseTargetRx, ['prescriptionId', 'externalPrescriptionId', 'id'])}</h3>
              <button type="button" className="pd-dispense-modal-close" onClick={() => setDispenseModalOpen(false)}>✕</button>
            </div>
            <div className="pd-dispense-modal-body">
              <div style={{ marginBottom: '14px', fontSize: '13px', color: '#475569', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div><strong>Patient:</strong> {text(field(dispenseTargetRx, ['patientName', 'patient.name', 'patient.fullName']))}</div>
                <div><strong>Status:</strong> <span className="pd-pill">{statusOf(dispenseTargetRx)}</span></div>
              </div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                Medicines to Dispense & Reduce Stock (POST /api/pharmacy/dispense):
              </label>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                      <th style={{ padding: '8px 12px' }}>Item ID</th>
                      <th style={{ padding: '8px 12px' }}>Medicine</th>
                      <th style={{ padding: '8px 12px', width: '90px' }}>Quantity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dispenseItems.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: idx < dispenseItems.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                        <td style={{ padding: '8px 12px' }}>#{item.prescriptionItemId}</td>
                        <td style={{ padding: '8px 12px', fontWeight: 500 }}>{item.medicineName}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => {
                              const val = Math.max(1, parseInt(e.target.value, 10) || 1)
                              setDispenseItems(prev => prev.map((p, i) => i === idx ? { ...p, quantity: val } : p))
                            }}
                            style={{ width: '60px', padding: '4px 6px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px' }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="pd-dispense-modal-footer">
              <button
                type="button"
                onClick={() => setDispenseModalOpen(false)}
                style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '8px 14px', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}
                disabled={dispensingLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDispense}
                style={{ background: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 16px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                disabled={dispensingLoading}
              >
                {dispensingLoading ? 'Dispensing...' : 'Dispense & Reduce Stock'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  </PharmacistLayout>
}
