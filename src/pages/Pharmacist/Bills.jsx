import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FiFileText, FiRotateCcw, FiSearch } from 'react-icons/fi'
import { cancelBill, getBill, listBills, refundPayment } from '../../config/api'
import PharmacistLayout from './PharmacistLayout'
import { confirmAction } from '../../components/confirmAction'
import { useToast } from '../../components/ToastProvider'
import './Bills.css'

const idOf = (row) => row.billId ?? row.invoiceId ?? row.id ?? row._id ?? ''
const nameOf = (row) => row.patientName || row.patient?.name || row.patient?.fullName || row.customerName || 'Walk-in customer'
const amountOf = (row) => row.totalAmount ?? row.grandTotal ?? row.netAmount ?? row.amount ?? row.total
const stateOf = (row) => String(row.status || row.billStatus || row.paymentStatus || 'Unknown')
const money = (value) => value != null && value !== '' && Number.isFinite(Number(value)) ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(value)) : '—'
const dateOf = (row) => row.createdAt || row.date || row.billDate || row.createdOn
const dateKey = (value) => {
  if (!value || Number.isNaN(new Date(value).getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value))
  return ['year', 'month', 'day'].map((type) => parts.find((part) => part.type === type).value).join('-')
}
const dateLabel = (value) => value && !Number.isNaN(new Date(value).getTime()) ? new Date(value).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' }) : '—'
function listOf(value) {
  if (Array.isArray(value)) return value
  if (!value || typeof value !== 'object') return []
  for (const key of ['bills', 'items', 'records', 'results', 'data']) {
    if (Array.isArray(value[key])) return value[key]
    if (value[key] && typeof value[key] === 'object') {
      const nested = listOf(value[key])
      if (nested.length) return nested
    }
  }
  return []
}
function bodyOf(response) {
  const body = response?.data ?? response
  if (response?.success === false || body?.success === false || response?.isSuccess === false || body?.isSuccess === false || response?.error || body?.error) throw new Error(response?.message || body?.message || 'Unable to complete this request.')
  return body
}
export default function Bills() {
  const { showToast } = useToast()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [serverPage, setServerPage] = useState(1)
  const [more, setMore] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [sort, setSort] = useState('newest')
  const [page, setPage] = useState(0)
  const [lookup, setLookup] = useState('')
  const [selected, setSelected] = useState(null)
  const [action, setAction] = useState('details')
  const [reason, setReason] = useState('')
  const [paymentId, setPaymentId] = useState('')
  const [refund, setRefund] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const working = useRef(false)
  const panel = useRef(null)
  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true); setError('')
      try {
        const response = await listBills({ page: serverPage, pageSize: 100 })
        const body = bodyOf(response)
        const incoming = listOf(response)
        if (!active) return
        setRows((previous) => serverPage === 1 ? incoming : [...previous, ...incoming.filter((row) => !previous.some((old) => String(idOf(old)) === String(idOf(row))))])
        const total = body?.total ?? body?.totalCount ?? body?.pagination?.total
        setMore(body?.hasMore ?? (total != null ? serverPage * 100 < Number(total) : incoming.length === 100))
      } catch (failure) { if (active) setError(failure.message || 'Unable to load bills.') }
      finally { if (active) setLoading(false) }
    }
    load()
    return () => { active = false }
  }, [revision, serverPage])
  function refresh() { setServerPage(1); setPage(0); setRevision((value) => value + 1) }
  function clearFilters() { setSearch(''); setFilter('all'); setFrom(''); setTo(''); setSort('newest'); setPage(0) }
  async function open(id) {
    if (working.current || id === '') return
    working.current = true; setBusy(true); setActionError(''); setSelected(null)
    try {
      const body = bodyOf(await getBill(id))
      const bill = body?.bill ?? body
      if (!bill || typeof bill !== 'object' || Array.isArray(bill) || idOf(bill) === '') throw new Error('Bill details are unavailable. Please try again.')
      setSelected(bill); setAction('details'); setReason(''); setRefund(''); setPaymentId(String(bill.paymentId ?? bill.payment?.id ?? ''))
    } catch (failure) { setActionError(failure.message) }
    finally { working.current = false; setBusy(false) }
  }
  useEffect(() => { if (selected) { panel.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); panel.current?.focus({ preventScroll: true }) } }, [selected])
  async function submit(event) {
    event.preventDefault()
    if (working.current || !selected) return
    setActionError('')
    if (!reason.trim()) { setActionError('Enter a reason.'); return }
    if (action === 'refund' && (!paymentId.trim() || !Number.isFinite(Number(refund)) || Number(refund) <= 0)) { setActionError('Enter a valid payment ID and refund amount.'); return }
    const payment = selected.payment
    const remaining = payment?.refundableAmount ?? payment?.remainingRefundableAmount
    if (action === 'refund' && String(payment?.id ?? selected.paymentId ?? '') === paymentId.trim() && remaining != null && Number(refund) > Number(remaining)) { setActionError(`The refund cannot exceed the available payment balance of ${money(remaining)}.`); return }
    working.current = true; setBusy(true)
    try {
      if (!await confirmAction(action === 'cancel' ? `Cancel bill ${idOf(selected)}?` : `Refund ${money(refund)} against payment ${paymentId}?`, { title: action === 'cancel' ? 'Cancel Bill' : 'Refund Payment', confirmLabel: 'Confirm' })) return
      bodyOf(await (action === 'cancel' ? cancelBill(idOf(selected), { reason: reason.trim() }) : refundPayment(paymentId.trim(), { amount: Number(refund), reason: reason.trim() })))
      showToast(action === 'cancel' ? 'Bill cancelled successfully.' : 'Payment refunded successfully.', 'success')
      setSelected(null); refresh()
    } catch (failure) { setActionError(failure.message) }
    finally { working.current = false; setBusy(false) }
  }
  const filtered = rows.filter((row) => {
    const day = dateKey(dateOf(row))
    return [idOf(row), row.billNumber, row.number, nameOf(row)].some((value) => String(value ?? '').toLowerCase().includes(search.toLowerCase().trim())) && (filter === 'all' || stateOf(row) === filter) && (!from || day >= from) && (!to || (day && day <= to))
  }).sort((a, b) => {
    if (sort === 'highest' || sort === 'lowest') return ((Number(amountOf(a)) || 0) - (Number(amountOf(b)) || 0)) * (sort === 'highest' ? -1 : 1)
    return ((Date.parse(dateOf(a)) || 0) - (Date.parse(dateOf(b)) || 0)) * (sort === 'newest' ? -1 : 1)
  })
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 8) - 1))
  const lines = selected ? listOf(selected.items ?? selected.billItems ?? selected.medicines ?? []) : []
  return <PharmacistLayout activeLabel="Bills"><div className="pb-bills">
    <header className="pb-heading"><div><h1>Bills, Cancellation & Refunds</h1><p>Review patient bills and manage payments in one place.</p></div><Link className="pb-header-return" to="/pharmacist/returns"><FiRotateCcw />Medicine Returns</Link></header>
    <div className="pb-stats">{[['Bills loaded', rows.length], ['Billed amount', money(rows.reduce((sum, row) => sum + (Number(amountOf(row)) || 0), 0))], ['Paid / Completed', rows.filter((row) => /^(paid|completed|success)$/i.test(stateOf(row))).length], ['Cancelled / Refunded', rows.filter((row) => /cancel|refund/i.test(stateOf(row))).length]].map(([label, value]) => <article key={label}><p>{label}</p><strong>{loading && !rows.length ? '—' : value}</strong><small>Across loaded records</small></article>)}</div>
    <section className="pb-card"><header className="pb-heading"><div><h2>Bill Register <small>{filtered.length} records</small></h2><p>Search by bill number or patient, or look up an exact bill ID.</p></div><form className="pb-inline" onSubmit={(event) => { event.preventDefault(); open(lookup.trim()) }}><input aria-label="Exact bill ID" required placeholder="Enter bill ID" value={lookup} onChange={(event) => setLookup(event.target.value)} /><button className="pb-primary" disabled={busy || !lookup.trim()}>Get Bill</button></form></header>
    <div className="pb-filters"><label><span><FiSearch />Search bills</span><input type="search" placeholder="Bill number or patient name..." value={search} onChange={(event) => { setSearch(event.target.value); setPage(0) }} /></label><label>Status<select value={filter} onChange={(event) => { setFilter(event.target.value); setPage(0) }}><option value="all">All statuses</option>{[...new Set(rows.map(stateOf))].map((state) => <option key={state}>{state}</option>)}</select></label><label>From date<input type="date" value={from} max={to || undefined} onChange={(event) => { setFrom(event.target.value); setPage(0) }} /></label><label>To date<input type="date" value={to} min={from || undefined} onChange={(event) => { setTo(event.target.value); setPage(0) }} /></label><label>Sort by<select value={sort} onChange={(event) => { setSort(event.target.value); setPage(0) }}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="highest">Highest amount</option><option value="lowest">Lowest amount</option></select></label><button onClick={clearFilters}>Clear Filters</button></div>
    {error ? <p className="pb-error" role="alert">{error} <button disabled={loading} onClick={refresh}>Retry</button></p> : null}
    <div className="pb-scroll" aria-busy={loading} aria-label="Bill register"><table><thead><tr>{['Bill number', 'Patient / Customer', 'Amount', 'Payment', 'Status', 'Date', 'Action'].map((title) => <th key={title}>{title}</th>)}</tr></thead><tbody>{filtered.slice(currentPage * 8, currentPage * 8 + 8).map((row, index) => <tr key={idOf(row) || index}><td><strong>{row.billNumber || row.number || idOf(row) || '—'}</strong><small>ID: {idOf(row) || 'Unavailable'}</small></td><td translate="no">{nameOf(row)}</td><td className="pb-money">{money(amountOf(row))}</td><td>{row.paymentMode || row.payment?.mode || row.mode || '—'}<small>{row.paymentStatus || row.payment?.status}</small></td><td><span className={`pb-status ${/cancel|refund|failed/i.test(stateOf(row)) ? 'is-closed' : /^(paid|completed|success)$/i.test(stateOf(row)) ? 'is-paid' : 'is-pending'}`}>{stateOf(row).replaceAll('_', ' ')}</span></td><td>{dateLabel(dateOf(row))}</td><td><button disabled={busy || idOf(row) === ''} onClick={() => open(idOf(row))}>View Bill</button></td></tr>)}</tbody></table>{!filtered.length ? <div className="pb-empty"><FiFileText /><h3>{loading ? 'Loading bills…' : error ? 'Bills unavailable' : rows.length ? 'No matching bills' : 'No bills yet'}</h3><p>{loading ? 'Fetching your billing records.' : error ? 'Retry to load billing records.' : rows.length ? 'Try another search or clear your filters.' : 'Generated bills will appear here.'}</p></div> : null}</div>
    <footer className="pb-pagination"><span>{filtered.length ? `${currentPage * 8 + 1}–${Math.min(currentPage * 8 + 8, filtered.length)} of ${filtered.length} bills` : '0 bills'}</span><div>{more ? <button disabled={loading || busy} onClick={() => { if (error) setRevision((value) => value + 1); else setServerPage((value) => value + 1) }}>{loading ? 'Loading?' : error ? 'Retry loading records' : 'Load more records'}</button> : null}<button disabled={!currentPage} onClick={() => setPage(currentPage - 1)}>Previous</button><span>Page {currentPage + 1} / {Math.max(1, Math.ceil(filtered.length / 8))}</span><button disabled={(currentPage + 1) * 8 >= filtered.length} onClick={() => setPage(currentPage + 1)}>Next</button></div></footer></section>
    {busy && !selected ? <p role="status">Loading bill details…</p> : null}{actionError ? <p className="pb-error" role="alert">{actionError}</p> : null}
    {selected ? <section className="pb-card pb-details" ref={panel} tabIndex={-1} aria-label="Bill details"><header className="pb-heading"><div><p>Bill details</p><h2>Bill {selected.billNumber || idOf(selected)}</h2></div><button disabled={busy} onClick={() => setSelected(null)}>Close</button></header><div className="pb-summary">{[['Patient / Customer', nameOf(selected)], ['Amount', money(amountOf(selected))], ['Status', stateOf(selected)], ['Date', dateLabel(dateOf(selected))]].map(([label, value]) => <div key={label}><small>{label}</small><strong>{value}</strong></div>)}</div>
    {lines.length ? <div className="pb-scroll"><table><thead><tr><th>Medicine</th><th>Quantity</th><th>Unit price</th><th>Total</th></tr></thead><tbody>{lines.map((line, index) => <tr key={line.id ?? index}><td>{line.medicineName || line.medicine?.name || line.name || '—'}</td><td>{line.quantity ?? line.qty ?? '—'}</td><td>{money(line.unitPrice ?? line.price ?? line.rate)}</td><td>{money(line.totalAmount ?? line.total ?? line.amount)}</td></tr>)}</tbody></table></div> : <p>Item details are unavailable for this bill.</p>}
    <nav className="pb-tabs" aria-label="Bill actions">{[['details', 'Overview'], ['cancel', 'Cancel Bill'], ['refund', 'Refund Payment']].map(([value, label]) => <button key={value} disabled={busy || (value === 'cancel' && /cancel|refund/i.test(stateOf(selected))) || (value === 'refund' && /^refunded$/i.test(stateOf(selected)))} aria-pressed={action === value} onClick={() => { setAction(value); setReason(''); setActionError('') }}>{label}</button>)}</nav>
    {action === 'details' ? <p>Bill ID: {idOf(selected)} · Payment ID: {paymentId || 'Not provided'}</p> : <form className="pb-action" onSubmit={submit}><h3>{action === 'cancel' ? 'Cancel this bill' : 'Refund a payment'}</h3><p>{action === 'cancel' ? 'Provide the reason for cancellation.' : 'Verify the payment ID and amount against the original payment.'}</p><fieldset disabled={busy}>{action === 'refund' ? <div className="pb-form-grid"><label>Payment ID *<input required value={paymentId} onChange={(event) => setPaymentId(event.target.value)} placeholder="Original payment ID" /></label><label>Refund amount (₹) *<input required type="number" min="0.01" step="0.01" value={refund} onChange={(event) => setRefund(event.target.value)} placeholder="0.00" /></label></div> : null}<label>Reason *<textarea required rows={3} maxLength={2000} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Enter the reason..." /></label></fieldset><footer className="pb-heading"><p>Review the details before confirming.</p><button className="pb-primary" disabled={busy}>{busy ? 'Processing…' : action === 'cancel' ? 'Confirm Cancellation' : 'Confirm Refund'}</button></footer></form>}</section> : null}
  </div></PharmacistLayout>
}
