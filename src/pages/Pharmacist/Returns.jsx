import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FiPlus, FiRefreshCw, FiRotateCcw, FiTrash2 } from 'react-icons/fi'
import { getPharmacistAssignedBranch, pharmacistReturnsApi } from '../../config/api'
import PharmacistLayout from './PharmacistLayout'
import { useToast } from '../../components/ToastProvider'
import { confirmAction } from '../../components/confirmAction'
import { isReturnApproved, matchingReturnMedicine, medicineIdentity, medicineOptions, newReturnLine, patientReturnPayload, returnList, returnMedicineLabel, returnPayload, returnedRecord } from './returnsModel'
import './Returns.css'

function isAbortError(err) {
  return (
    err?.name === 'AbortError' ||
    err?.code === 20 ||
    err?.isCanceled === true ||
    /aborted|canceled/i.test(err?.message || '')
  )
}

function classifyError(err, fallback = 'An unexpected error occurred.') {
  if (!err) return null
  if (isAbortError(err)) return { type: 'canceled', isAbort: true, message: '' }
  const status = err.status || err.response?.status
  const rawMsg = String(err.message || '')
  if (status === 401 || /401|unauthorized/i.test(rawMsg)) {
    return { type: '401', status: 401, message: 'Your session has expired. Please log in again to continue.' }
  }
  if (status === 403 || /403|forbidden|access denied/i.test(rawMsg)) {
    return { type: '403', status: 403, message: 'Access denied for this pharmacist account. Verify your permissions and branch assignment.' }
  }
  if (status === 404 || /404|not found/i.test(rawMsg)) {
    return { type: '404', status: 404, message: 'The requested returns service endpoint was not found on the server (404).' }
  }
  if (status === 500 || status === 502 || status === 503 || /500|502|503|internal server error/i.test(rawMsg)) {
    return { type: '500', status: status || 500, message: `Server error (${status || 500}). The backend service encountered an issue. Please retry.` }
  }
  if (/network|failed to fetch|unable to connect/i.test(rawMsg)) {
    return { type: 'network', message: 'Unable to connect to the server. Check your connection and retry.' }
  }
  return { type: 'general', status, message: rawMsg || fallback }
}

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
  const [billStatus, setBillStatus] = useState({ checking: false, verified: false, error: '', patientName: '', bill: null })
  const [lines, setLines] = useState(() => [newReturnLine()])
  const latestLines = useRef(lines)
  const lookupAbortRef = useRef(null)
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
      try {
        const results = await Promise.allSettled([
          pharmacistReturnsApi.history({ page: 1, pageSize: 20 }, { signal: controller.signal }),
          pharmacistReturnsApi.options({ signal: controller.signal }),
        ])
        if (!active || controller.signal.aborted) return

        if (results[0].status === 'fulfilled') {
          setHistory(returnList(results[0].value))
          setHistoryError('')
        } else {
          const err = results[0].reason
          if (!isAbortError(err)) {
            const classified = classifyError(err, 'Unable to load medicine returns.')
            setHistoryError(classified?.message || '')
          }
        }

        if (results[1].status === 'fulfilled') {
          const optData = results[1].value?.data || results[1].value
          const reasons = optData?.reasons || optData?.returnReasons || (Array.isArray(optData) ? optData : null)
          if (Array.isArray(reasons) && reasons.length > 0) {
            setReturnReasons(reasons.map((r) => typeof r === 'string' ? r : r?.label || r?.name || String(r)))
          }
        }
      } catch (failure) {
        if (!active || isAbortError(failure)) return
        const classified = classifyError(failure)
        setError(classified?.message || '')
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => {
      active = false
      controller.abort()
      if (lookupAbortRef.current) {
        lookupAbortRef.current.abort()
      }
    }
  }, [revision])

  async function retryInventory() {
    if (!form.billId.trim()) return
    await handleBillLookup(form.billId)
  }

  async function retryHistory() {
    setLoading(true)
    setHistoryError('')
    try {
      const res = await pharmacistReturnsApi.history({ page: 1, pageSize: 20 })
      setHistory(returnList(res))
      setHistoryError('')
    } catch (failure) {
      if (!isAbortError(failure)) {
        const classified = classifyError(failure, 'Unable to load medicine returns.')
        setHistoryError(classified?.message || '')
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleBillLookup(billIdVal) {
    const rawBillId = String(billIdVal || '').trim()
    if (!rawBillId) {
      setBillStatus({ checking: false, verified: false, error: '', patientName: '', bill: null })
      setInventory([])
      setBatches({})
      setInventoryError('')
      return
    }

    const billNum = Number(rawBillId)
    if (!/^\d+$/.test(rawBillId) || !Number.isInteger(billNum) || billNum <= 0) {
      setBillStatus({ checking: false, verified: false, error: 'Please enter a valid numeric Bill ID.', patientName: '', bill: null })
      setInventory([])
      setBatches({})
      return
    }

    if (lookupAbortRef.current) {
      lookupAbortRef.current.abort()
    }
    const controller = new AbortController()
    lookupAbortRef.current = controller

    setBillStatus((current) => ({ ...current, checking: true, error: '' }))
    setInventoryError('')

    try {
      const assigned = getPharmacistAssignedBranch()
      const branchId = assigned?.branchId || assigned?.id || undefined
      const response = await pharmacistReturnsApi.eligibleMedicines({
        billId: billNum,
        ...(branchId ? { branchId } : {}),
      }, { signal: controller.signal })

      const billData = response?.data || response
      const items = returnList(billData)
      const pName = billData?.patientName || billData?.patient?.name || (items.length ? (items[0]?.patientName || items[0]?.patient?.name) : '') || ''
      if (pName && !form.patientName) {
        setForm((prev) => ({ ...prev, patientName: pName }))
      }

      // Group batches by medicine ID
      const batchMap = {}
      for (const item of items) {
        const mId = String(medicineIdentity(item))
        if (!mId) continue
        if (!batchMap[mId]) batchMap[mId] = []
        const retQty = item.returnableQuantity ?? (item.soldQuantity != null && item.returnedQuantity != null ? item.soldQuantity - item.returnedQuantity : item.quantity)
        const batchNum = item.originalBatch || item.batchNumber || item.batchNo || ''
        batchMap[mId].push({
          batchId: item.batchId ?? item.id ?? '',
          batchNumber: batchNum,
          originalBatch: batchNum,
          returnableQuantity: retQty != null && Number.isFinite(Number(retQty)) ? Number(retQty) : null,
          expiryDate: item.expiryDate || item.expiry || '',
          ...item
        })
      }

      setInventory(items)
      setBatches(batchMap)
      setBillStatus({ checking: false, verified: true, error: '', patientName: pName, bill: billData })
    } catch (failure) {
      if (isAbortError(failure)) return
      setInventory([])
      setBatches({})
      const status = failure?.status || failure?.response?.status
      const msg = String(failure?.message || '')
      let userMsg
      if (status === 404 || /not found|bill not found/i.test(msg)) {
        userMsg = 'Original bill not found in your assigned branch. Please enter a valid Pharmacy Bill ID.'
      } else if (status === 401 || /unauthorized|401/i.test(msg)) {
        userMsg = 'Your session has expired. Please log in again to continue.'
      } else if (status === 403 || /forbidden|403|access denied/i.test(msg)) {
        userMsg = 'Access denied for this pharmacist account. Verify your permissions and branch assignment.'
      } else if (status === 500 || /500|server error/i.test(msg)) {
        userMsg = 'Server error (500) while verifying bill. Please try again.'
      } else if (/network|failed to fetch|unable to connect/i.test(msg)) {
        userMsg = 'Unable to connect to the server to verify the bill.'
      } else {
        userMsg = msg || 'Unable to verify the bill.'
      }
      setBillStatus({ checking: false, verified: false, error: userMsg, patientName: '', bill: null })
    }
  }

  function selectMedicine(key, selectedMedId) {
    const medIdStr = String(selectedMedId || '')
    const available = batches[medIdStr] || []
    const firstBatch = available.length === 1 ? available[0] : null

    updateLine(key, {
      medicineId: medIdStr,
      batchId: firstBatch?.batchId ?? '',
      batchNumber: firstBatch?.batchNumber ?? '',
      originalBatch: firstBatch?.batchNumber ?? '',
      expiryDate: firstBatch?.expiryDate ?? '',
      returnableQuantity: firstBatch?.returnableQuantity ?? null,
      error: ''
    })
  }

  function selectBatch(key, batchNum, medId) {
    const available = batches[String(medId)] || []
    const match = available.find((item) => String(item.batchNumber ?? item.batchNo) === batchNum)
    updateLine(key, {
      batchNumber: batchNum,
      originalBatch: batchNum,
      batchId: match?.batchId ?? match?.id ?? '',
      expiryDate: match?.expiryDate ?? match?.expiry ?? '',
      returnableQuantity: match?.returnableQuantity ?? null,
      error: ''
    })
  }

  async function submit(event) {
    event.preventDefault()
    if (working.current) return
    setError('')
    setNotice('')

    let payload
    try {
      payload = patientReturnPayload(form, latestLines.current, medicines)
    } catch (failure) {
      setError(failure.message)
      return
    }

    working.current = true
    setBusy(true)

    try {
      await pharmacistReturnsApi.createPatientReturn(payload)
      changeLines((curr) => curr.map((row) => ({ ...row, completed: true, error: '' })))
      const anyRestocked = payload.medicines.some((m) => m.condition === 'EligibleForRestocking')
      setNotice(
        anyRestocked
          ? 'Return recorded successfully. Eligible medicines were submitted for restocking; damaged or expired medicines remain separate.'
          : 'Return recorded successfully.'
      )
      showToast('Medicine return recorded successfully.')
      try {
        await retryHistory()
      } catch {}
      window.dispatchEvent(new CustomEvent('pms:medicine-returns-updated'))
      window.dispatchEvent(new CustomEvent('pms:medicines-updated'))
      window.dispatchEvent(new CustomEvent('pms:stock-updated'))
    } catch (failure) {
      if (!isAbortError(failure)) {
        const classified = classifyError(failure, 'Unable to complete the medicine return.')
        setError(classified?.message || failure.message || 'Unable to complete the medicine return.')
      }
    } finally {
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
      if (action === 'approve') { await pharmacistReturnsApi.approve(id, { restock: true }) }
      else await pharmacistReturnsApi.cancel(id)
      await retryHistory()
      showToast(action === 'approve' ? 'Return approved for restocking.' : 'Return cancelled.')
      window.dispatchEvent(new CustomEvent('pms:medicine-returns-updated'))
      window.dispatchEvent(new CustomEvent('pms:medicines-updated'))
      window.dispatchEvent(new CustomEvent('pms:stock-updated'))
    } catch (failure) { setError(failure.message) }
    finally { working.current = false; setBusy(false) }
  }

  return <PharmacistLayout activeLabel="Returns"><div className="pr-returns">
    <header className="pr-heading"><div><h1>Medicine Returns</h1><p>Record tablets returned by a customer or patient and add approved quantities back to medicine stock.</p></div><button type="button" disabled={loading || busy} onClick={() => setRevision((value) => value + 1)}><FiRefreshCw />Refresh</button></header>
    <nav className="pr-tabs" aria-label="Medicine return views"><button type="button" className={tab === 'new' ? 'is-active' : ''} aria-pressed={tab === 'new'} onClick={() => setTab('new')}>New Return</button><button type="button" className={tab === 'history' ? 'is-active' : ''} aria-pressed={tab === 'history'} onClick={() => setTab('history')}>Return History</button><Link to="/pharmacist/medicines">View Medicines</Link></nav>
    {error ? <p className="pr-error" role="alert">{error}</p> : null}{notice ? <p className="pr-notice" role="status">{notice}</p> : null}
    {tab === 'new' ? <form className="pr-card" onSubmit={submit}><header className="pr-card-heading"><div><h2><FiRotateCcw />Return Medicines</h2><p>Select the medicine name and the number of tablets being returned.</p></div>{completed ? <button type="button" onClick={() => { changeLines([newReturnLine()]); setForm({ patientName: '', billId: '', reason: '', notes: '', verified: false }); setBillStatus({ checking: false, verified: false, error: '', patientName: '', bill: null }); setInventory([]); setBatches({}); setNotice(''); setError(''); setLinePage(0) }}>Start New Return</button> : null}</header>
      {inventoryError ? <div className="pr-error-card" role="alert"><span>{inventoryError}</span><button type="button" onClick={retryInventory}><FiRefreshCw />Retry Medicines</button></div> : null}
      <fieldset disabled={busy || completed}><div className="pr-details"><label>Patient / Customer Name<input value={form.patientName} maxLength={150} onChange={(event) => setForm((current) => ({ ...current, patientName: event.target.value }))} placeholder="Optional" /></label><label>Original Bill ID *<input required value={form.billId} disabled={lines.some((row) => row.returnId)} onBlur={(event) => handleBillLookup(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); handleBillLookup(form.billId) } }} onChange={(event) => { const val = event.target.value; setForm((current) => ({ ...current, billId: val })); if (!val.trim()) { setBillStatus({ checking: false, verified: false, error: '', patientName: '', bill: null }); setInventory([]); setBatches({}) } }} placeholder="Enter the bill ID from Bills" />{billStatus.checking ? <small className="pr-hint">Verifying bill with branch records...</small> : billStatus.error ? <small className="pr-error" role="alert">{billStatus.error}</small> : billStatus.verified ? <small className="pr-success">Bill verified for this branch.{billStatus.patientName ? ` Patient: ${billStatus.patientName}` : ''}</small> : null}</label><label>Reason for Return *<select required value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))}><option value="">Select a reason</option>{returnReasons.map((reason) => <option key={reason} value={reason}>{reason}</option>)}</select></label></div>
      <div className="pr-lines-heading"><h3>Returned Medicines</h3><button type="button" onClick={() => { changeLines((current) => [...current, newReturnLine()]); setLinePage(Math.floor(lines.length / 3)) }}><FiPlus />Add Medicine</button></div>
      {medicines.length === 0 && !loading && !inventoryError ? <p className="pr-empty">{form.billId && billStatus.verified ? 'No eligible medicines found for this bill.' : 'Enter a valid Original Bill ID to load medicines eligible for return.'}</p> : null}
      <div className="pr-table-scroll"><table><thead><tr><th>Medicine Name *</th><th>Original Batch *</th><th>Returning Quantity *</th><th>Condition</th><th>Action</th></tr></thead><tbody>{lines.slice(visibleLinePage * 3, visibleLinePage * 3 + 3).map((row, localIndex) => { const index = visibleLinePage * 3 + localIndex; const availableBatches = batches[row.medicineId] || []; return <tr key={row.key}><td><input type="search" aria-label={`Medicine ${index + 1}`} required autoComplete="off" list={`return-medicines-${row.key}`} placeholder="Search medicine by name..." disabled={Boolean(row.returnId) || loading} value={medicineSearch[row.key] ?? returnMedicineLabel(medicines.find((medicine) => medicine.id === row.medicineId) || { name: '' })} onChange={(event) => { const value = event.target.value; setMedicineSearch((current) => ({ ...current, [row.key]: value })); const match = matchingReturnMedicine(medicines, value); if ((match?.id || '') !== row.medicineId) selectMedicine(row.key, match?.id || '') }} /><datalist id={`return-medicines-${row.key}`}>{medicines.filter((medicine) => returnMedicineLabel(medicine).toLocaleLowerCase().includes((medicineSearch[row.key] || '').trim().toLocaleLowerCase())).map((medicine) => <option key={medicine.id} value={returnMedicineLabel(medicine)} translate="no" />)}</datalist>{row.error ? <small className="pr-error">{row.error}</small> : null}</td><td>{availableBatches.length ? <select aria-label={`Batch ${index + 1}`} required disabled={Boolean(row.returnId)} value={row.batchNumber} onChange={(event) => selectBatch(row.key, event.target.value, row.medicineId)}><option value="">Select batch</option>{availableBatches.map((batch, batchIndex) => <option key={batch.batchId ?? batch.id ?? batchIndex} value={batch.batchNumber ?? batch.batchNo} translate="no">{batch.batchNumber ?? batch.batchNo}{batch.returnableQuantity != null ? ` (Available: ${batch.returnableQuantity})` : ''}</option>)}</select> : <input aria-label={`Batch ${index + 1}`} required disabled={Boolean(row.returnId)} value={row.batchNumber} onChange={(event) => updateLine(row.key, { batchNumber: event.target.value, originalBatch: event.target.value })} placeholder="Original batch number" />}{batchErrors[row.medicineId] ? <small>Batch lookup unavailable. Verify the original batch number.</small> : null}</td><td><input aria-label={`Returned quantity ${index + 1}`} required type="number" min={1} max={row.returnableQuantity != null && row.returnableQuantity > 0 ? row.returnableQuantity : undefined} step={1} disabled={Boolean(row.returnId)} value={row.quantity} onChange={(event) => { const val = event.target.value; const num = Number(val); let lineErr = ''; if (row.returnableQuantity != null && num > row.returnableQuantity) { lineErr = `Max returnable: ${row.returnableQuantity}` } updateLine(row.key, { quantity: val, error: lineErr }) }} />{row.returnableQuantity != null ? <small className="pr-hint">Max: {row.returnableQuantity}</small> : null}</td><td><select aria-label={`Condition ${index + 1}`} disabled={Boolean(row.returnId)} value={row.condition} onChange={(event) => updateLine(row.key, { condition: event.target.value })}><option value="restock">Eligible for restocking</option><option value="damaged">Damaged — keep separate</option><option value="expired">Expired — keep separate</option></select></td><td>{row.completed ? <span className="pr-status">Recorded</span> : <button type="button" aria-label={`Remove return medicine ${index + 1}`} disabled={lines.length === 1 || Boolean(row.returnId)} onClick={() => changeLines((current) => current.filter((item) => item.key !== row.key))}><FiTrash2 /></button>}</td></tr> })}</tbody></table></div>
      {lines.length > 3 ? <nav className="pr-pagination"><button type="button" disabled={visibleLinePage === 0} onClick={() => setLinePage(visibleLinePage - 1)}>Previous</button><span>Page {visibleLinePage + 1} / {Math.ceil(lines.length / 3)}</span><button type="button" disabled={(visibleLinePage + 1) * 3 >= lines.length} onClick={() => setLinePage(visibleLinePage + 1)}>Next</button></nav> : null}
      <div className="pr-bottom"><label>Notes<textarea rows={2} maxLength={2000} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Optional return details" /></label><label className="pr-check"><input type="checkbox" checked={form.verified} onChange={(event) => setForm((current) => ({ ...current, verified: event.target.checked }))} /><span>I verified the batch, expiry, packaging, and condition of medicines marked for restocking.</span></label></div></fieldset>
      <footer className="pr-footer"><div><strong>{lines.length} medicines</strong><span>Total returned quantity: {lines.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0)}</span></div><button className="pr-primary" type="submit" disabled={busy || loading || completed || Boolean(inventoryError)}>{busy ? 'Processing return...' : completed ? 'Return Recorded' : lines.some((row) => row.condition === 'restock') ? 'Return & Add to Stock' : 'Record Return'}</button></footer><p className="pr-help">Stock is updated only after server approval. Damaged and expired medicines are not added to available stock.</p>
    </form> : <section className="pr-card"><header className="pr-card-heading"><h2>Return History</h2><input className="pr-search" aria-label="Search medicine returns" placeholder="Search medicine, patient or bill ID..." value={search} onChange={(event) => { setSearch(event.target.value); setPage(0) }} /></header>{historyError ? <div className="pr-error-card" role="alert"><span>{historyError}</span><button type="button" onClick={retryHistory}><FiRefreshCw />Retry History</button></div> : null}<div className="pr-table-scroll"><table><thead><tr>{['Return ID', 'Patient', 'Bill ID', 'Medicine', 'Quantity', 'Status', 'Actions'].map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>{filteredHistory.slice(visibleHistoryPage * 5, visibleHistoryPage * 5 + 5).map((row, index) => { const status = String(row.status ?? row.state ?? 'Pending'); const pending = /pending|requested/i.test(status); const held = /damaged|expired/i.test(String(row.condition ?? '')); return <tr key={row.returnId ?? row.id ?? index}><td>{row.returnId ?? row.id ?? '—'}</td><td translate="no">{row.patientName || '—'}</td><td>{row.billId || '—'}</td><td translate="no">{row.medicineName ?? row.medicine?.name ?? '—'}</td><td>{row.quantity ?? row.returnQuantity ?? '—'}</td><td><span className={`pr-status ${pending ? 'is-pending' : ''}`}>{status}</span></td><td><div className="pr-row-actions">{pending && !held ? <button type="button" disabled={busy} onClick={() => historyAction(row, 'approve')}>Approve & Restock</button> : null}{pending ? <button type="button" disabled={busy} onClick={() => historyAction(row, 'cancel')}>Cancel</button> : null}</div></td></tr> })}</tbody></table></div>{loading ? <p role="status">Loading returns...</p> : !historyError && !filteredHistory.length ? <p className="pr-empty">No medicine returns found.</p> : null}<nav className="pr-pagination"><button type="button" disabled={visibleHistoryPage === 0} onClick={() => setPage(visibleHistoryPage - 1)}>Previous</button><span>Page {visibleHistoryPage + 1} / {Math.max(1, Math.ceil(filteredHistory.length / 5))}</span><button type="button" disabled={(visibleHistoryPage + 1) * 5 >= filteredHistory.length} onClick={() => setPage(visibleHistoryPage + 1)}>Next</button></nav></section>}
  </div></PharmacistLayout>
}
