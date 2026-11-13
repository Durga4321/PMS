import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FiPlus, FiRefreshCw, FiRotateCcw, FiTrash2 } from 'react-icons/fi'
import { pharmacistReturnsApi } from '../../config/api'
import PharmacistLayout from './PharmacistLayout'
import { useToast } from '../../components/ToastProvider'
import { confirmAction } from '../../components/confirmAction'
import { isReturnApproved, matchingReturnMedicine, medicineIdentity, medicineOptions, newReturnLine, returnList, returnMedicineLabel, returnPayload, returnedRecord } from './returnsModel'
import './Returns.css'

export default function Returns() {
  const { showToast } = useToast()
  const [tab, setTab] = useState('new')
  const [inventory, setInventory] = useState([])
  const [history, setHistory] = useState([])
  const [batches, setBatches] = useState({})
  const [batchErrors, setBatchErrors] = useState({})
  const [medicineSearch, setMedicineSearch] = useState({})
  const [returnReasons, setReturnReasons] = useState(['Unused medicines', 'Incorrect supply', 'Damaged packaging', 'Expired medicine', 'Other'])
  const [form, setForm] = useState({ patientName: '', billId: '', reason: '', notes: '', verified: false })
  const [lines, setLines] = useState(() => [newReturnLine()])
  const latestLines = useRef(lines)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const working = useRef(false)
  const [error, setError] = useState('')
  const [inventoryError, setInventoryError] = useState('')
  const [historyError, setHistoryError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [linePage, setLinePage] = useState(0)
  const [revision, setRevision] = useState(0)
  const medicines = medicineOptions(inventory)
  const visibleLinePage = Math.min(linePage, Math.max(0, Math.ceil(lines.length / 3) - 1))
  const filteredHistory = history.filter((row) => [row.patientName, row.medicineName, row.medicine?.name, row.billId, row.returnId, row.id].some((value) => String(value ?? '').toLowerCase().includes(search.toLowerCase())))
  const visibleHistoryPage = Math.min(page, Math.max(0, Math.ceil(filteredHistory.length / 5) - 1))
  const completed = lines.every((row) => row.completed)

  function changeLines(next) { const value = typeof next === 'function' ? next(latestLines.current) : next; latestLines.current = value; setLines(value) }
  function updateLine(key, patch) { changeLines((current) => current.map((row) => row.key === key ? { ...row, ...patch } : row)) }

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    async function load() {
      setLoading(true)
      const results = await Promise.allSettled([
        pharmacistReturnsApi.inventory({ signal: controller.signal }),
        pharmacistReturnsApi.list({ page: 1, pageSize: 100 }, { signal: controller.signal }),
        pharmacistReturnsApi.options({ signal: controller.signal }),
      ])
      if (!active) return
      if (results[0].status === 'fulfilled') { setInventory(returnList(results[0].value)); setInventoryError('') }
      else setInventoryError(results[0].reason?.message || 'Unable to load medicines.')
      if (results[1].status === 'fulfilled') { setHistory(returnList(results[1].value)); setHistoryError('') }
      else setHistoryError(results[1].reason?.message || 'Unable to load medicine returns.')
      if (results[2].status === 'fulfilled') {
        const optData = results[2].value?.data || results[2].value
        const reasons = optData?.reasons || optData?.returnReasons || (Array.isArray(optData) ? optData : null)
        if (Array.isArray(reasons) && reasons.length > 0) {
          setReturnReasons(reasons.map((r) => typeof r === 'string' ? r : r?.label || r?.name || String(r)))
        }
      }
      setLoading(false)
    }
    load()
    return () => { active = false; controller.abort() }
  }, [revision])

  async function handleBillLookup(billIdVal) {
    const rawBillId = String(billIdVal || '').trim()
    if (!rawBillId) return
    try {
      const response = await pharmacistReturnsApi.billItems(rawBillId)
      const items = returnList(response)
      if (Array.isArray(items) && items.length > 0) {
        const pName = items[0]?.patientName || response?.patientName || response?.patient?.name || ''
        if (pName && !form.patientName) {
          setForm((prev) => ({ ...prev, patientName: pName }))
        }
      }
    } catch {
      // Optional enhancement: if bill lookup fails, user enters details manually
    }
  }
  async function selectMedicine(key, medicineId) {
    updateLine(key, { medicineId, batchId: '', batchNumber: '', expiryDate: '', error: '' })
    if (!medicineId || batches[medicineId]) return
    setBatchErrors((current) => ({ ...current, [medicineId]: '' }))
    try {
      const response = await pharmacistReturnsApi.batches(medicineId)
      const loaded = returnList(response)
      const embedded = inventory.filter((item) => String(medicineIdentity(item)) === medicineId && item.batchNumber)
      setBatches((current) => ({ ...current, [medicineId]: loaded.length ? loaded : embedded }))
    } catch (failure) {
      setBatches((current) => ({ ...current, [medicineId]: inventory.filter((item) => String(medicineIdentity(item)) === medicineId && item.batchNumber) }))
      setBatchErrors((current) => ({ ...current, [medicineId]: failure.message }))
    }
  }

  async function refreshInventory() {
    const response = await pharmacistReturnsApi.inventory()
    const fresh = returnList(response)
    setInventory(fresh)
    window.dispatchEvent(new CustomEvent('pms:medicine-returns-updated'))
    window.dispatchEvent(new CustomEvent('pms:medicines-updated'))
    window.dispatchEvent(new CustomEvent('pms:stock-updated'))
  }

  async function submit(event) {
    event.preventDefault()
    if (working.current) return
    setError(''); setNotice('')
    try {
      latestLines.current.filter((row) => !row.completed).forEach((row) => returnPayload(form, row, medicines))
    } catch (failure) { setError(failure.message); return }
    working.current = true
    setBusy(true)
    let currentKey = ''
    try {
      for (const row of [...latestLines.current]) {
        if (row.completed) continue
        currentKey = row.key
        const payload = returnPayload(form, row, medicines)
        let id = row.returnId
        let approved = false
        if (!id) {
          const created = returnedRecord(await pharmacistReturnsApi.create(payload))
          id = created.id
          approved = isReturnApproved(created)
          updateLine(row.key, { returnId: id, error: '' })
        }
        if (payload.restock && !approved) await pharmacistReturnsApi.approve(id, { ...payload, restock: true, clientRequestId: `${row.key}:approve` })
        updateLine(row.key, { completed: true, error: '' })
      }
      setNotice('Return recorded. Eligible medicines were approved for restocking; damaged or expired medicines remain separate.')
      showToast('Medicine return recorded successfully.')
    } catch (failure) {
      updateLine(currentKey, { error: failure.message })
      setError(failure.message || 'Unable to complete the medicine return.')
    } finally {
      try { await refreshInventory() } catch { setNotice('Return status was saved. Refresh Medicines to check the latest stock.') }
      setRevision((value) => value + 1)
      working.current = false
      setBusy(false)
    }
  }

  async function historyAction(row, action) {
    const id = row.returnId ?? row.id ?? row._id
    if (id == null || working.current) return
    if (action === 'approve' && !await confirmAction('Confirm the batch, expiry, and packaging have been inspected. Approve this return and add the returned quantity to stock?', { title: 'Approve & Restock', confirmLabel: 'Approve & Restock' })) return
    working.current = true; setBusy(true); setError('')
    try {
      if (action === 'approve') { await pharmacistReturnsApi.approve(id, { restock: true }); await refreshInventory() }
      else await pharmacistReturnsApi.cancel(id)
      setRevision((value) => value + 1)
      showToast(action === 'approve' ? 'Return approved for restocking.' : 'Return cancelled.')
    } catch (failure) { setError(failure.message) }
    finally { working.current = false; setBusy(false) }
  }

  return <PharmacistLayout activeLabel="Returns"><div className="pr-returns">
    <header className="pr-heading"><div><p>Pharmacist / Returns</p><h1>Medicine Returns</h1><p>Record tablets returned by a customer or patient and add approved quantities back to medicine stock.</p></div><button type="button" disabled={loading || busy} onClick={() => setRevision((value) => value + 1)}><FiRefreshCw />Refresh</button></header>
    <nav className="pr-tabs" aria-label="Medicine return views"><button type="button" aria-pressed={tab === 'new'} onClick={() => setTab('new')}>New Return</button><button type="button" aria-pressed={tab === 'history'} onClick={() => setTab('history')}>Return History</button><Link to="/pharmacist/medicines">View Medicines</Link></nav>
    {error ? <p className="pr-error" role="alert">{error}</p> : null}{notice ? <p className="pr-notice" role="status">{notice}</p> : null}
    {tab === 'new' ? <form className="pr-card" onSubmit={submit}><header className="pr-card-heading"><div><h2><FiRotateCcw />Return Medicines</h2><p>Select the medicine name and the number of tablets being returned.</p></div>{completed ? <button type="button" onClick={() => { changeLines([newReturnLine()]); setForm({ patientName: '', billId: '', reason: '', notes: '', verified: false }); setNotice(''); setError(''); setLinePage(0) }}>Start New Return</button> : null}</header>
      {inventoryError ? <p className="pr-error" role="alert">{inventoryError}</p> : null}
      <fieldset disabled={busy || completed}><div className="pr-details"><label>Patient / Customer Name<input value={form.patientName} maxLength={150} onChange={(event) => setForm((current) => ({ ...current, patientName: event.target.value }))} placeholder="Optional" /></label><label>Original Bill ID *<input required value={form.billId} disabled={lines.some((row) => row.returnId)} onBlur={(event) => handleBillLookup(event.target.value)} onChange={(event) => setForm((current) => ({ ...current, billId: event.target.value }))} placeholder="Enter the bill ID from Bills" /></label><label>Reason for Return *<select required value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))}><option value="">Select a reason</option>{returnReasons.map((reason) => <option key={reason} value={reason}>{reason}</option>)}</select></label></div>
      <div className="pr-lines-heading"><h3>Returned Medicines</h3><button type="button" onClick={() => { changeLines((current) => [...current, newReturnLine()]); setLinePage(Math.floor(lines.length / 3)) }}><FiPlus />Add Medicine</button></div>
      <div className="pr-table-scroll"><table><thead><tr><th>Medicine Name *</th><th>Original Batch *</th><th>Returning Quantity *</th><th>Condition</th><th>Action</th></tr></thead><tbody>{lines.slice(visibleLinePage * 3, visibleLinePage * 3 + 3).map((row, localIndex) => { const index = visibleLinePage * 3 + localIndex; const availableBatches = batches[row.medicineId] || []; return <tr key={row.key}><td><input type="search" aria-label={`Medicine ${index + 1}`} required autoComplete="off" list={`return-medicines-${row.key}`} placeholder="Search medicine by name..." disabled={Boolean(row.returnId) || loading} value={medicineSearch[row.key] ?? returnMedicineLabel(medicines.find((medicine) => medicine.id === row.medicineId) || { name: '' })} onChange={(event) => { const value = event.target.value; setMedicineSearch((current) => ({ ...current, [row.key]: value })); const match = matchingReturnMedicine(medicines, value); if ((match?.id || '') !== row.medicineId) selectMedicine(row.key, match?.id || '') }} /><datalist id={`return-medicines-${row.key}`}>{medicines.filter((medicine) => returnMedicineLabel(medicine).toLocaleLowerCase().includes((medicineSearch[row.key] || '').trim().toLocaleLowerCase())).map((medicine) => <option key={medicine.id} value={returnMedicineLabel(medicine)} translate="no" />)}</datalist>{row.error ? <small className="pr-error">{row.error}</small> : null}</td><td>{availableBatches.length ? <select aria-label={`Batch ${index + 1}`} required disabled={Boolean(row.returnId)} value={row.batchNumber} onChange={(event) => { const batch = availableBatches.find((item) => String(item.batchNumber ?? item.batchNo) === event.target.value); updateLine(row.key, { batchNumber: event.target.value, batchId: batch?.batchId ?? batch?.id ?? '', expiryDate: batch?.expiryDate ?? batch?.expiry ?? '' }) }}><option value="">Select batch</option>{availableBatches.map((batch, batchIndex) => <option key={batch.batchId ?? batch.id ?? batchIndex} value={batch.batchNumber ?? batch.batchNo} translate="no">{batch.batchNumber ?? batch.batchNo}</option>)}</select> : <input aria-label={`Batch ${index + 1}`} required disabled={Boolean(row.returnId)} value={row.batchNumber} onChange={(event) => updateLine(row.key, { batchNumber: event.target.value })} placeholder="Original batch number" />}{batchErrors[row.medicineId] ? <small>Batch lookup unavailable. Verify the original batch number.</small> : null}</td><td><input aria-label={`Returned quantity ${index + 1}`} required type="number" min={1} step={1} disabled={Boolean(row.returnId)} value={row.quantity} onChange={(event) => updateLine(row.key, { quantity: event.target.value })} /></td><td><select aria-label={`Condition ${index + 1}`} disabled={Boolean(row.returnId)} value={row.condition} onChange={(event) => updateLine(row.key, { condition: event.target.value })}><option value="restock">Eligible for restocking</option><option value="damaged">Damaged — keep separate</option><option value="expired">Expired — keep separate</option></select></td><td>{row.completed ? <span className="pr-status">Recorded</span> : <button type="button" aria-label={`Remove return medicine ${index + 1}`} disabled={lines.length === 1 || Boolean(row.returnId)} onClick={() => changeLines((current) => current.filter((item) => item.key !== row.key))}><FiTrash2 /></button>}</td></tr> })}</tbody></table></div>
      {lines.length > 3 ? <nav className="pr-pagination"><button type="button" disabled={visibleLinePage === 0} onClick={() => setLinePage(visibleLinePage - 1)}>Previous</button><span>Page {visibleLinePage + 1} / {Math.ceil(lines.length / 3)}</span><button type="button" disabled={(visibleLinePage + 1) * 3 >= lines.length} onClick={() => setLinePage(visibleLinePage + 1)}>Next</button></nav> : null}
      <div className="pr-bottom"><label>Notes<textarea rows={2} maxLength={2000} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Optional return details" /></label><label className="pr-check"><input type="checkbox" checked={form.verified} onChange={(event) => setForm((current) => ({ ...current, verified: event.target.checked }))} /><span>I verified the batch, expiry, packaging, and condition of medicines marked for restocking.</span></label></div></fieldset>
      <footer className="pr-footer"><div><strong>{lines.length} medicines</strong><span>Total returned quantity: {lines.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0)}</span></div><button className="pr-primary" type="submit" disabled={busy || loading || completed || Boolean(inventoryError)}>{busy ? 'Processing return...' : completed ? 'Return Recorded' : lines.some((row) => row.condition === 'restock') ? 'Return & Add to Stock' : 'Record Return'}</button></footer><p className="pr-help">Stock is updated only after server approval. Damaged and expired medicines are not added to available stock.</p>
    </form> : <section className="pr-card"><header className="pr-card-heading"><h2>Return History</h2><input className="pr-search" aria-label="Search medicine returns" placeholder="Search medicine, patient or bill ID..." value={search} onChange={(event) => { setSearch(event.target.value); setPage(0) }} /></header>{historyError ? <p className="pr-error" role="alert">{historyError}</p> : null}<div className="pr-table-scroll"><table><thead><tr>{['Return ID', 'Patient', 'Bill ID', 'Medicine', 'Quantity', 'Status', 'Actions'].map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>{filteredHistory.slice(visibleHistoryPage * 5, visibleHistoryPage * 5 + 5).map((row, index) => { const status = String(row.status ?? row.state ?? 'Pending'); const pending = /pending|requested/i.test(status); const held = /damaged|expired/i.test(String(row.condition ?? '')); return <tr key={row.returnId ?? row.id ?? index}><td>{row.returnId ?? row.id ?? '—'}</td><td translate="no">{row.patientName || '—'}</td><td>{row.billId || '—'}</td><td translate="no">{row.medicineName ?? row.medicine?.name ?? '—'}</td><td>{row.quantity ?? row.returnQuantity ?? '—'}</td><td><span className={`pr-status ${pending ? 'is-pending' : ''}`}>{status}</span></td><td><div className="pr-row-actions">{pending && !held ? <button type="button" disabled={busy} onClick={() => historyAction(row, 'approve')}>Approve & Restock</button> : null}{pending ? <button type="button" disabled={busy} onClick={() => historyAction(row, 'cancel')}>Cancel</button> : null}</div></td></tr> })}</tbody></table></div>{loading ? <p role="status">Loading returns...</p> : !historyError && !filteredHistory.length ? <p className="pr-empty">No medicine returns found.</p> : null}<nav className="pr-pagination"><button type="button" disabled={visibleHistoryPage === 0} onClick={() => setPage(visibleHistoryPage - 1)}>Previous</button><span>Page {visibleHistoryPage + 1} / {Math.max(1, Math.ceil(filteredHistory.length / 5))}</span><button type="button" disabled={(visibleHistoryPage + 1) * 5 >= filteredHistory.length} onClick={() => setPage(visibleHistoryPage + 1)}>Next</button></nav></section>}
  </div></PharmacistLayout>
}
