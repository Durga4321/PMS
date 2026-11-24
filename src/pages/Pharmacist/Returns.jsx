import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FiPlus, FiRefreshCw, FiRotateCcw, FiTrash2 } from 'react-icons/fi'
import { getPharmacistAssignedBranch, pharmacistReturnsApi } from '../../config/api'
import PharmacistLayout from './PharmacistLayout'
import { useToast } from '../../components/ToastProvider'
import { confirmAction } from '../../components/confirmAction'
import {
  formatConditionLabel,
  isReturnApproved,
  matchingReturnMedicine,
  medicineIdentity,
  medicineOptions,
  newReturnLine,
  parseReturnOptions,
  patientReturnPayload,
  returnList,
  returnMedicineLabel,
  returnPayload,
  returnedRecord,
} from './returnsModel'
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
  if (status === 400 || /400|bad request|invalid request/i.test(rawMsg)) {
    return { type: '400', status: 400, message: rawMsg || 'Invalid return request. Please check the provided information.' }
  }
  if (status === 401 || /401|unauthorized/i.test(rawMsg)) {
    return { type: '401', status: 401, message: 'Your session has expired. Please log in again to continue.' }
  }
  if (status === 403 || /403|forbidden|access denied/i.test(rawMsg)) {
    return { type: '403', status: 403, message: 'Access denied for this pharmacist account. Verify your permissions and branch assignment.' }
  }
  if (status === 404 || /404|not found/i.test(rawMsg)) {
    return { type: '404', status: 404, message: rawMsg || 'The requested returns service endpoint was not found on the server (404).' }
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
  const [batches, setBatches] = useState({})
  const [batchErrors, setBatchErrors] = useState({})
  const [medicineSearch, setMedicineSearch] = useState({})
  const [returnReasons, setReturnReasons] = useState([])
  const [conditions, setConditions] = useState([])
  const [optionsLoading, setOptionsLoading] = useState(true)
  const [optionsError, setOptionsError] = useState('')

  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const historyLoadedRef = useRef(false)
  const [historyError, setHistoryError] = useState('')
  const [historyPage, setHistoryPage] = useState(1)
  const [historyTotalCount, setHistoryTotalCount] = useState(null)

  const [form, setForm] = useState({ patientName: '', billId: '', reason: '', notes: '', verified: false })
  const [billStatus, setBillStatus] = useState({ checking: false, verified: false, error: '', patientName: '', bill: null })
  const [lines, setLines] = useState(() => [newReturnLine()])
  const latestLines = useRef(lines)
  const lookupAbortRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const working = useRef(false)
  const [error, setError] = useState('')
  const [inventoryError, setInventoryError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [clientPage, setClientPage] = useState(0)
  const [linePage, setLinePage] = useState(0)

  const medicines = medicineOptions(inventory)
  const visibleLinePage = Math.min(linePage, Math.max(0, Math.ceil(lines.length / 3) - 1))
  const filteredHistory = history.filter((row) =>
    [row.patientName, row.medicineName, row.medicine?.name, row.billId, row.returnId, row.id].some((value) =>
      String(value ?? '').toLowerCase().includes(search.toLowerCase())
    )
  )
  const visibleHistoryPage = Math.min(clientPage, Math.max(0, Math.ceil(filteredHistory.length / 5) - 1))
  const completed = lines.every((row) => row.completed)

  function changeLines(next) {
    const value = typeof next === 'function' ? next(latestLines.current) : next
    latestLines.current = value
    setLines(value)
  }
  function updateLine(key, patch) {
    changeLines((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  // Load Return Options on component mount
  useEffect(() => {
    let active = true

    async function fetchOptions(force = false) {
      setOptionsLoading(true)
      setOptionsError('')
      try {
        const data = await pharmacistReturnsApi.options({ force })
        if (!active) return
        const parsed = parseReturnOptions(data)
        setReturnReasons(parsed.reasons)
        setConditions(parsed.conditions)
        if (parsed.conditions.length > 0) {
          changeLines((curr) =>
            curr.map((row) => ({
              ...row,
              condition:
                row.condition && parsed.conditions.some((c) => c.value === row.condition)
                  ? row.condition
                  : parsed.conditions[0].value,
            }))
          )
        }
      } catch (err) {
        if (!active || isAbortError(err)) return
        const classified = classifyError(err, 'Unable to load return options.')
        setOptionsError(classified?.message || 'Unable to load return options.')
      } finally {
        if (active) setOptionsLoading(false)
      }
    }

    fetchOptions()
    return () => {
      active = false
    }
  }, [])

  // Load Return History only when history tab is active and needed
  useEffect(() => {
    if (tab !== 'history') return
    if (historyLoadedRef.current) return

    let active = true

    async function fetchHistory(pageToLoad = 1, force = false) {
      setHistoryLoading(true)
      setHistoryError('')
      try {
        const response = await pharmacistReturnsApi.history(
          { page: pageToLoad, pageSize: 20 },
          { force }
        )
        if (!active) return
        const items = returnList(response)
        setHistory(items)
        const total =
          response?.totalCount ??
          response?.total ??
          response?.count ??
          response?.data?.totalCount ??
          null
        setHistoryTotalCount(total)
        setHistoryLoaded(true)
        historyLoadedRef.current = true
        setHistoryPage(pageToLoad)
        setClientPage(0)
      } catch (err) {
        if (!active || isAbortError(err)) return
        const classified = classifyError(err, 'Unable to load medicine returns.')
        setHistoryError(classified?.message || 'Unable to load return history.')
      } finally {
        if (active) setHistoryLoading(false)
      }
    }

    fetchHistory(historyPage)
    return () => {
      active = false
    }
  }, [tab, historyPage])

  async function loadHistoryDirect(pageToLoad = 1, force = true) {
    setHistoryLoading(true)
    setHistoryError('')
    try {
      const response = await pharmacistReturnsApi.history(
        { page: pageToLoad, pageSize: 20 },
        { force }
      )
      const items = returnList(response)
      setHistory(items)
      const total =
        response?.totalCount ??
        response?.total ??
        response?.count ??
        response?.data?.totalCount ??
        null
      setHistoryTotalCount(total)
      setHistoryLoaded(true)
      historyLoadedRef.current = true
      setHistoryPage(pageToLoad)
      setClientPage(0)
    } catch (err) {
      if (!isAbortError(err)) {
        const classified = classifyError(err, 'Unable to load medicine returns.')
        setHistoryError(classified?.message || 'Unable to load return history.')
      }
    } finally {
      setHistoryLoading(false)
    }
  }

  async function retryOptions() {
    setOptionsLoading(true)
    setOptionsError('')
    try {
      const data = await pharmacistReturnsApi.options({ force: true })
      const parsed = parseReturnOptions(data)
      setReturnReasons(parsed.reasons)
      setConditions(parsed.conditions)
      if (parsed.conditions.length > 0) {
        changeLines((curr) =>
          curr.map((row) => ({
            ...row,
            condition:
              row.condition && parsed.conditions.some((c) => c.value === row.condition)
                ? row.condition
                : parsed.conditions[0].value,
          }))
        )
      }
    } catch (err) {
      if (!isAbortError(err)) {
        const classified = classifyError(err, 'Unable to load return options.')
        setOptionsError(classified?.message || 'Unable to load return options.')
      }
    } finally {
      setOptionsLoading(false)
    }
  }

  async function handleRefresh() {
    if (tab === 'new') {
      await retryOptions()
      if (form.billId.trim()) {
        await handleBillLookup(form.billId)
      }
    } else {
      await loadHistoryDirect(historyPage, true)
    }
  }

  async function retryInventory() {
    if (!form.billId.trim()) return
    await handleBillLookup(form.billId)
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
      const response = await pharmacistReturnsApi.eligibleMedicines(
        {
          billId: billNum,
          ...(branchId ? { branchId } : {}),
        },
        { signal: controller.signal }
      )

      const billData = response?.data || response
      const items = returnList(billData)
      const pName =
        billData?.patientName ||
        billData?.patient?.name ||
        (items.length ? items[0]?.patientName || items[0]?.patient?.name : '') ||
        ''
      if (pName && !form.patientName) {
        setForm((prev) => ({ ...prev, patientName: pName }))
      }

      // Group batches by medicine ID
      const batchMap = {}
      for (const item of items) {
        const mId = String(medicineIdentity(item))
        if (!mId) continue
        if (!batchMap[mId]) batchMap[mId] = []
        const retQty =
          item.returnableQuantity ??
          (item.soldQuantity != null && item.returnedQuantity != null
            ? item.soldQuantity - item.returnedQuantity
            : item.quantity)
        const batchNum = item.originalBatch || item.batchNumber || item.batchNo || ''
        batchMap[mId].push({
          batchId: item.batchId ?? item.id ?? '',
          batchNumber: batchNum,
          originalBatch: batchNum,
          returnableQuantity: retQty != null && Number.isFinite(Number(retQty)) ? Number(retQty) : null,
          expiryDate: item.expiryDate || item.expiry || '',
          ...item,
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
      error: '',
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
      error: '',
    })
  }

  async function submit(event) {
    event.preventDefault()
    if (working.current) return
    setError('')
    setNotice('')

    let payload
    try {
      payload = patientReturnPayload(form, latestLines.current, medicines, {
        reasons: returnReasons,
        conditions,
      })
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

      pharmacistReturnsApi.clearHistoryCache?.()
      setHistoryLoaded(false)
      historyLoadedRef.current = false

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
    if (
      action === 'approve' &&
      !(await confirmAction(
        'Confirm the batch, expiry, and packaging have been inspected. Approve this return and add the returned quantity to stock?',
        { title: 'Approve & Restock', confirmLabel: 'Approve & Restock' }
      ))
    )
      return
    working.current = true
    setBusy(true)
    setError('')
    try {
      if (action === 'approve') {
        await pharmacistReturnsApi.approve(id, { restock: true })
      } else {
        await pharmacistReturnsApi.cancel(id)
      }
      pharmacistReturnsApi.clearHistoryCache?.()
      await loadHistoryDirect(historyPage, true)
      showToast(action === 'approve' ? 'Return approved for restocking.' : 'Return cancelled.')
      window.dispatchEvent(new CustomEvent('pms:medicine-returns-updated'))
      window.dispatchEvent(new CustomEvent('pms:medicines-updated'))
      window.dispatchEvent(new CustomEvent('pms:stock-updated'))
    } catch (failure) {
      setError(failure.message)
    } finally {
      working.current = false
      setBusy(false)
    }
  }

  return (
    <PharmacistLayout activeLabel="Returns">
      <div className="pr-returns">
        <header className="pr-heading">
          <div>
            <h1>Medicine Returns</h1>
            <p>Record tablets returned by a customer or patient and add approved quantities back to medicine stock.</p>
          </div>
          <button type="button" disabled={optionsLoading || historyLoading || busy} onClick={handleRefresh}>
            <FiRefreshCw />Refresh
          </button>
        </header>

        <nav className="pr-tabs" aria-label="Medicine return views">
          <button
            type="button"
            className={tab === 'new' ? 'is-active' : ''}
            aria-pressed={tab === 'new'}
            onClick={() => setTab('new')}
          >
            New Return
          </button>
          <button
            type="button"
            className={tab === 'history' ? 'is-active' : ''}
            aria-pressed={tab === 'history'}
            onClick={() => {
              setTab('history')
              if (!historyLoadedRef.current) {
                loadHistoryDirect(1, false)
              }
            }}
          >
            Return History
          </button>
          <Link to="/pharmacist/medicines">View Medicines</Link>
        </nav>

        {error ? <p className="pr-error" role="alert">{error}</p> : null}
        {notice ? <p className="pr-notice" role="status">{notice}</p> : null}

        {tab === 'new' ? (
          <form className="pr-card" onSubmit={submit}>
            <header className="pr-card-heading">
              <div>
                <h2><FiRotateCcw />Return Medicines</h2>
                <p>Select the medicine name and the number of tablets being returned.</p>
              </div>
              {completed ? (
                <button
                  type="button"
                  onClick={() => {
                    const defaultCond = conditions[0]?.value || 'EligibleForRestocking'
                    changeLines([newReturnLine(defaultCond)])
                    setForm({ patientName: '', billId: '', reason: '', notes: '', verified: false })
                    setBillStatus({ checking: false, verified: false, error: '', patientName: '', bill: null })
                    setInventory([])
                    setBatches({})
                    setNotice('')
                    setError('')
                    setLinePage(0)
                  }}
                >
                  Start New Return
                </button>
              ) : null}
            </header>

            {optionsError ? (
              <div className="pr-error-card" role="alert">
                <span>{optionsError}</span>
                <button type="button" onClick={retryOptions}>
                  <FiRefreshCw />Retry Options
                </button>
              </div>
            ) : null}

            {inventoryError ? (
              <div className="pr-error-card" role="alert">
                <span>{inventoryError}</span>
                <button type="button" onClick={retryInventory}>
                  <FiRefreshCw />Retry Medicines
                </button>
              </div>
            ) : null}

            <fieldset disabled={busy || completed}>
              <div className="pr-details">
                <label>
                  Patient / Customer Name
                  <input
                    value={form.patientName}
                    maxLength={150}
                    onChange={(event) => setForm((current) => ({ ...current, patientName: event.target.value }))}
                    placeholder="Optional"
                  />
                </label>
                <label>
                  Original Bill ID *
                  <input
                    required
                    value={form.billId}
                    disabled={lines.some((row) => row.returnId)}
                    onBlur={(event) => handleBillLookup(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        handleBillLookup(form.billId)
                      }
                    }}
                    onChange={(event) => {
                      const val = event.target.value
                      setForm((current) => ({ ...current, billId: val }))
                      if (!val.trim()) {
                        setBillStatus({ checking: false, verified: false, error: '', patientName: '', bill: null })
                        setInventory([])
                        setBatches({})
                      }
                    }}
                    placeholder="Enter the bill ID from Bills"
                  />
                  {billStatus.checking ? (
                    <small className="pr-hint">Verifying bill with branch records...</small>
                  ) : billStatus.error ? (
                    <small className="pr-error" role="alert">{billStatus.error}</small>
                  ) : billStatus.verified ? (
                    <small className="pr-success">
                      Bill verified for this branch.{billStatus.patientName ? ` Patient: ${billStatus.patientName}` : ''}
                    </small>
                  ) : null}
                </label>
                <label>
                  Reason for Return *
                  <select
                    required
                    value={form.reason}
                    disabled={optionsLoading}
                    onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))}
                  >
                    <option value="">{optionsLoading ? 'Loading reasons...' : 'Select a reason'}</option>
                    {returnReasons.map((reason) => (
                      <option key={reason.value} value={reason.value}>
                        {reason.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="pr-lines-heading">
                <h3>Returned Medicines</h3>
                <button
                  type="button"
                  onClick={() => {
                    const defaultCond = conditions[0]?.value || 'EligibleForRestocking'
                    changeLines((current) => [...current, newReturnLine(defaultCond)])
                    setLinePage(Math.floor(lines.length / 3))
                  }}
                >
                  <FiPlus />Add Medicine
                </button>
              </div>

              {medicines.length === 0 && !inventoryError ? (
                <p className="pr-empty">
                  {form.billId && billStatus.verified
                    ? 'No eligible medicines found for this bill.'
                    : 'Enter a valid Original Bill ID to load medicines eligible for return.'}
                </p>
              ) : null}

              <div className="pr-table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Medicine Name *</th>
                      <th>Original Batch *</th>
                      <th>Returning Quantity *</th>
                      <th>Condition</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.slice(visibleLinePage * 3, visibleLinePage * 3 + 3).map((row, localIndex) => {
                      const index = visibleLinePage * 3 + localIndex
                      const availableBatches = batches[row.medicineId] || []
                      return (
                        <tr key={row.key}>
                          <td>
                            <input
                              type="search"
                              aria-label={`Medicine ${index + 1}`}
                              required
                              autoComplete="off"
                              list={`return-medicines-${row.key}`}
                              placeholder="Search medicine by name..."
                              disabled={Boolean(row.returnId)}
                              value={
                                medicineSearch[row.key] ??
                                returnMedicineLabel(medicines.find((medicine) => medicine.id === row.medicineId) || { name: '' })
                              }
                              onChange={(event) => {
                                const value = event.target.value
                                setMedicineSearch((current) => ({ ...current, [row.key]: value }))
                                const match = matchingReturnMedicine(medicines, value)
                                if ((match?.id || '') !== row.medicineId) selectMedicine(row.key, match?.id || '')
                              }}
                            />
                            <datalist id={`return-medicines-${row.key}`}>
                              {medicines
                                .filter((medicine) =>
                                  returnMedicineLabel(medicine)
                                    .toLocaleLowerCase()
                                    .includes((medicineSearch[row.key] || '').trim().toLocaleLowerCase())
                                )
                                .map((medicine) => (
                                  <option key={medicine.id} value={returnMedicineLabel(medicine)} translate="no" />
                                ))}
                            </datalist>
                            {row.error ? <small className="pr-error">{row.error}</small> : null}
                          </td>
                          <td>
                            {availableBatches.length ? (
                              <select
                                aria-label={`Batch ${index + 1}`}
                                required
                                disabled={Boolean(row.returnId)}
                                value={row.batchNumber}
                                onChange={(event) => selectBatch(row.key, event.target.value, row.medicineId)}
                              >
                                <option value="">Select batch</option>
                                {availableBatches.map((batch, batchIndex) => (
                                  <option
                                    key={batch.batchId ?? batch.id ?? batchIndex}
                                    value={batch.batchNumber ?? batch.batchNo}
                                    translate="no"
                                  >
                                    {batch.batchNumber ?? batch.batchNo}
                                    {batch.returnableQuantity != null ? ` (Available: ${batch.returnableQuantity})` : ''}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                aria-label={`Batch ${index + 1}`}
                                required
                                disabled={Boolean(row.returnId)}
                                value={row.batchNumber}
                                onChange={(event) =>
                                  updateLine(row.key, { batchNumber: event.target.value, originalBatch: event.target.value })
                                }
                                placeholder="Original batch number"
                              />
                            )}
                            {batchErrors[row.medicineId] ? (
                              <small>Batch lookup unavailable. Verify the original batch number.</small>
                            ) : null}
                          </td>
                          <td>
                            <input
                              aria-label={`Returned quantity ${index + 1}`}
                              required
                              type="number"
                              min={1}
                              max={row.returnableQuantity != null && row.returnableQuantity > 0 ? row.returnableQuantity : undefined}
                              step={1}
                              disabled={Boolean(row.returnId)}
                              value={row.quantity}
                              onChange={(event) => {
                                const val = event.target.value
                                const num = Number(val)
                                let lineErr = ''
                                if (row.returnableQuantity != null && num > row.returnableQuantity) {
                                  lineErr = `Max returnable: ${row.returnableQuantity}`
                                }
                                updateLine(row.key, { quantity: val, error: lineErr })
                              }}
                            />
                            {row.returnableQuantity != null ? (
                              <small className="pr-hint">Max: {row.returnableQuantity}</small>
                            ) : null}
                          </td>
                          <td>
                            <select
                              aria-label={`Condition ${index + 1}`}
                              disabled={Boolean(row.returnId)}
                              value={row.condition}
                              onChange={(event) => updateLine(row.key, { condition: event.target.value })}
                            >
                              {conditions.length === 0 ? (
                                <option value={row.condition}>{formatConditionLabel(row.condition)}</option>
                              ) : (
                                conditions.map((cond) => (
                                  <option key={cond.value} value={cond.value}>
                                    {cond.label}
                                  </option>
                                ))
                              )}
                            </select>
                          </td>
                          <td>
                            {row.completed ? (
                              <span className="pr-status">Recorded</span>
                            ) : (
                              <button
                                type="button"
                                aria-label={`Remove return medicine ${index + 1}`}
                                disabled={lines.length === 1 || Boolean(row.returnId)}
                                onClick={() => changeLines((current) => current.filter((item) => item.key !== row.key))}
                              >
                                <FiTrash2 />
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {lines.length > 3 ? (
                <nav className="pr-pagination">
                  <button type="button" disabled={visibleLinePage === 0} onClick={() => setLinePage(visibleLinePage - 1)}>
                    Previous
                  </button>
                  <span>Page {visibleLinePage + 1} / {Math.ceil(lines.length / 3)}</span>
                  <button
                    type="button"
                    disabled={(visibleLinePage + 1) * 3 >= lines.length}
                    onClick={() => setLinePage(visibleLinePage + 1)}
                  >
                    Next
                  </button>
                </nav>
              ) : null}

              <div className="pr-bottom">
                <label>
                  Notes
                  <textarea
                    rows={2}
                    maxLength={2000}
                    value={form.notes}
                    onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                    placeholder="Optional return details"
                  />
                </label>
                <label className="pr-check">
                  <input
                    type="checkbox"
                    checked={form.verified}
                    onChange={(event) => setForm((current) => ({ ...current, verified: event.target.checked }))}
                  />
                  <span>I verified the batch, expiry, packaging, and condition of medicines marked for restocking.</span>
                </label>
              </div>
            </fieldset>

            <footer className="pr-footer">
              <div>
                <strong>{lines.length} medicines</strong>
                <span>Total returned quantity: {lines.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0)}</span>
              </div>
              <button
                className="pr-primary"
                type="submit"
                disabled={busy || optionsLoading || completed || Boolean(inventoryError)}
              >
                {busy
                  ? 'Processing return...'
                  : completed
                  ? 'Return Recorded'
                  : lines.some((row) => row.condition === 'restock' || /EligibleForRestocking/i.test(row.condition))
                  ? 'Return & Add to Stock'
                  : 'Record Return'}
              </button>
            </footer>
            <p className="pr-help">
              Stock is updated only after server approval. Damaged and expired medicines are not added to available stock.
            </p>
          </form>
        ) : (
          <section className="pr-card">
            <header className="pr-card-heading">
              <h2>Return History</h2>
              <input
                className="pr-search"
                aria-label="Search medicine returns"
                placeholder="Search medicine, patient or bill ID..."
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setClientPage(0)
                }}
              />
            </header>

            {historyError ? (
              <div className="pr-error-card" role="alert">
                <span>{historyError}</span>
                <button type="button" onClick={() => loadHistoryDirect(historyPage, true)}>
                  <FiRefreshCw />Retry History
                </button>
              </div>
            ) : null}

            <div className="pr-table-scroll">
              <table>
                <thead>
                  <tr>
                    {['Return ID', 'Patient', 'Bill ID', 'Medicine', 'Quantity', 'Status', 'Actions'].map((label) => (
                      <th key={label}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory
                    .slice(visibleHistoryPage * 5, visibleHistoryPage * 5 + 5)
                    .map((row, index) => {
                      const status = String(row.status ?? row.state ?? 'Pending')
                      const pending = /pending|requested/i.test(status)
                      const held = /damaged|expired/i.test(String(row.condition ?? ''))
                      return (
                        <tr key={row.returnId ?? row.id ?? index}>
                          <td>{row.returnId ?? row.id ?? '—'}</td>
                          <td translate="no">{row.patientName || '—'}</td>
                          <td>{row.billId || '—'}</td>
                          <td translate="no">{row.medicineName ?? row.medicine?.name ?? '—'}</td>
                          <td>{row.quantity ?? row.returnQuantity ?? '—'}</td>
                          <td>
                            <span className={`pr-status ${pending ? 'is-pending' : ''}`}>{status}</span>
                          </td>
                          <td>
                            <div className="pr-row-actions">
                              {pending && !held ? (
                                <button type="button" disabled={busy} onClick={() => historyAction(row, 'approve')}>
                                  Approve & Restock
                                </button>
                              ) : null}
                              {pending ? (
                                <button type="button" disabled={busy} onClick={() => historyAction(row, 'cancel')}>
                                  Cancel
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>

            {historyLoading ? (
              <p role="status">Loading return history...</p>
            ) : !historyError && !filteredHistory.length ? (
              <p className="pr-empty">No return history found.</p>
            ) : null}

            <nav className="pr-pagination">
              <button
                type="button"
                disabled={visibleHistoryPage === 0}
                onClick={() => setClientPage(visibleHistoryPage - 1)}
              >
                Previous
              </button>
              <span>
                Page {visibleHistoryPage + 1} / {Math.max(1, Math.ceil(filteredHistory.length / 5))}
              </span>
              <button
                type="button"
                disabled={(visibleHistoryPage + 1) * 5 >= filteredHistory.length}
                onClick={() => setClientPage(visibleHistoryPage + 1)}
              >
                Next
              </button>
            </nav>
          </section>
        )}
      </div>
    </PharmacistLayout>
  )
}
