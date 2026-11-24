import { useEffect, useRef, useState, useCallback } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import {
  FiCheckCircle,
  FiCreditCard,
  FiDollarSign,
  FiDownload,
  FiFileText,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiAlertCircle,
  FiClock,
  FiList,
  FiShield,
  FiX
} from 'react-icons/fi'
import PharmacistLayout from './PharmacistLayout'
import {
  getBillPaymentStatus,
  getBillPaymentHistory,
  createPaymentGatewayQr,
  getPaymentGatewayAttemptStatus,
  recordManualCashPayment,
  submitBankTransferPayment,
  confirmBankTransferPayment,
  listPaymentTransactions,
  exportPaymentTransactions,
  getBranchPaymentReport,
  downloadBillInvoicePdf,
  generateBill,
  listBills,
  simulateQrPayment
} from '../../config/api'
import { useToast } from '../../components/ToastProvider'
import './Payments.css'

function formatMoney(amount, currency = 'INR') {
  if (amount == null || isNaN(Number(amount))) return '₹0.00'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency || 'INR',
    maximumFractionDigits: 2
  }).format(Number(amount))
}

function formatDate(val) {
  if (!val) return '—'
  const d = new Date(val)
  return isNaN(d.getTime()) ? String(val) : d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function createIdempotencyKey(prefix = 'pm') {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

export default function PharmacistPayments() {
  const [params, setParams] = useSearchParams()
  const { showToast } = useToast()

  // Main navigation tab: 'payments' | 'ledger'
  const [mainTab, setMainTab] = useState('payments')

  // Bill Mode on Payments screen: 'generate' (Generate Bill from Prescription) or 'lookup' (Lookup Existing Bill)
  const [entryMode, setEntryMode] = useState('generate')

  // Generate Bill Form State (POST /api/pharmacy/generate-bill)
  const [genRxId, setGenRxId] = useState('')
  const [genDiscount, setGenDiscount] = useState('0')
  const [genBusy, setGenBusy] = useState(false)

  // Bill Lookup State
  const initialBillId = params.get('billId') || ''
  const [billIdInput, setBillIdInput] = useState(initialBillId)
  const [activeBillId, setActiveBillId] = useState(initialBillId)
  const [recentBills, setRecentBills] = useState([])
  const [loadingRecent, setLoadingRecent] = useState(false)

  // Live Bill Status State (GET /api/payments/bills/{billId}/status)
  const [billStatus, setBillStatus] = useState(null)
  const [statusLoading, setStatusLoading] = useState(false)
  const [statusError, setStatusError] = useState('')

  // Bill Payment History State (GET /api/payments/bills/{billId}/history)
  const [historyItems, setHistoryItems] = useState([])
  const [historyTotal, setHistoryTotal] = useState(0)
  const [historyLoading, setHistoryLoading] = useState(false)

  // Payment Mode: 'cash' | 'upi' | 'bank'
  const [paymentMode, setPaymentMode] = useState('cash')
  const [busy, setBusy] = useState(false)

  // Cash Form State (POST /api/payments/manual)
  const [cashAmount, setCashAmount] = useState('')
  const [cashNotes, setCashNotes] = useState('')

  // UPI Dynamic QR State (POST /api/payments/gateway/create-qr)
  const [upiAmount, setUpiAmount] = useState('')
  const [qrData, setQrData] = useState(null) // { qrImageUrl, qrId, expiresAt, paymentAttemptId, status }
  const [qrTimerRemaining, setQrTimerRemaining] = useState(0)
  const qrPollRef = useRef(null)
  const qrTimerRef = useRef(null)

  // Bank Transfer Form State (POST /api/payments/bank-transfers)
  const [bankAmount, setBankAmount] = useState('')
  const [bankUtr, setBankUtr] = useState('')
  const [bankName, setBankName] = useState('')
  const [bankNotice, setBankNotice] = useState(null) // { transferId, status }

  // Branch Transactions Ledger State (GET /api/payments/transactions)
  const [branchLedger, setBranchLedger] = useState([])
  const [ledgerTotal, setLedgerTotal] = useState(0)
  const [ledgerPage, setLedgerPage] = useState(1)
  const [ledgerHasMore, setLedgerHasMore] = useState(false)
  const [ledgerLoading, setLedgerLoading] = useState(false)
  const [branchReport, setBranchReport] = useState(null)

  // Get active branch ID
  const branchId = billStatus?.branchId ||
    sessionStorage.getItem('workingBranchId') ||
    localStorage.getItem('workingBranchId') ||
    '1'

  // Load Recent Bills
  const loadRecentBills = useCallback(async () => {
    setLoadingRecent(true)
    try {
      const res = await listBills()
      const items = res?.data?.items || res?.data || res?.items || (Array.isArray(res) ? res : [])
      setRecentBills(Array.isArray(items) ? items.slice(0, 8) : [])
    } catch {
      // ignore
    } finally {
      setLoadingRecent(false)
    }
  }, [])

  useEffect(() => {
    loadRecentBills()
  }, [loadRecentBills])

  // Load Bill Status & Payment History
  const fetchBillData = useCallback(async (idToFetch) => {
    const rawId = String(idToFetch || '').trim()
    if (!rawId) {
      setBillStatus(null)
      setHistoryItems([])
      return
    }

    setStatusLoading(true)
    setStatusError('')
    setHistoryLoading(true)

    try {
      const [statusRes, historyRes] = await Promise.allSettled([
        getBillPaymentStatus(rawId),
        getBillPaymentHistory(rawId)
      ])

      if (statusRes.status === 'fulfilled') {
        const payload = statusRes.value?.data || statusRes.value || {}
        setBillStatus(payload)
        const due = Number(payload.balanceDue ?? payload.grandTotal ?? 0)
        setCashAmount(due > 0 ? String(due) : '')
        setUpiAmount(due > 0 ? String(due) : '')
        setBankAmount(due > 0 ? String(due) : '')
      } else {
        setStatusError(statusRes.reason?.message || `Failed to fetch status for Bill #${rawId}`)
        setBillStatus(null)
      }

      if (historyRes.status === 'fulfilled') {
        const histData = historyRes.value?.data || historyRes.value || {}
        const items = histData.items || (Array.isArray(histData) ? histData : [])
        setHistoryItems(items)
        setHistoryTotal(histData.total ?? items.length)
      } else {
        setHistoryItems([])
      }
    } catch (err) {
      setStatusError(err.message || 'Unable to load bill details.')
    } finally {
      setStatusLoading(false)
      setHistoryLoading(false)
    }
  }, [])

  // When activeBillId changes or search param changes, fetch data
  useEffect(() => {
    if (activeBillId) {
      fetchBillData(activeBillId)
      setParams({ billId: activeBillId }, { replace: true })
    }
  }, [activeBillId, fetchBillData, setParams])

  // Cleanup QR polling on unmount or QR change
  const stopQrPolling = useCallback(() => {
    if (qrPollRef.current) {
      clearInterval(qrPollRef.current)
      qrPollRef.current = null
    }
    if (qrTimerRef.current) {
      clearInterval(qrTimerRef.current)
      qrTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => stopQrPolling()
  }, [stopQrPolling])

  // Handle Bill Lookup Submission
  function handleSelectBill(e) {
    if (e) e.preventDefault()
    const trimmed = billIdInput.trim()
    if (!trimmed) {
      showToast('Please enter a valid Bill ID.', 'error')
      return
    }
    stopQrPolling()
    setQrData(null)
    setBankNotice(null)
    setActiveBillId(trimmed)
  }

  // Handle Generate Bill from Prescription (POST /api/pharmacy/generate-bill)
  async function handleGenerateBill(e) {
    e.preventDefault()
    if (!genRxId.trim()) {
      showToast('Prescription ID is required to generate a bill.', 'error')
      return
    }
    setGenBusy(true)
    setStatusError('')
    try {
      const payload = {
        prescriptionId: Number(genRxId) || genRxId.trim(),
        discount: Number(genDiscount) || 0
      }
      const response = await generateBill(payload)
      const newId = response?.data?.billId || response?.billId || response?.id
      if (!newId) throw new Error(response?.message || 'Bill generation did not return a valid bill ID.')
      showToast(`Bill #${newId} generated successfully! Loading bill details...`)
      setGenRxId('')
      setGenDiscount('0')
      stopQrPolling()
      setQrData(null)
      setBankNotice(null)
      setBillIdInput(String(newId))
      setActiveBillId(String(newId))
      loadRecentBills()
    } catch (err) {
      showToast(err.message || 'Failed to generate bill. Make sure the prescription is fully dispensed.', 'error')
    } finally {
      setGenBusy(false)
    }
  }

  // 1. Submit Cash Payment (POST /api/payments/manual)
  async function handleCashPayment(e) {
    e.preventDefault()
    if (!activeBillId) {
      showToast('Please select or generate a bill first.', 'error')
      return
    }
    const amountNum = Number(cashAmount)
    if (!amountNum || amountNum <= 0) {
      showToast('Enter a valid payment amount.', 'error')
      return
    }

    setBusy(true)
    try {
      const payload = {
        billId: Number(activeBillId) || activeBillId,
        amount: amountNum,
        idempotencyKey: createIdempotencyKey('cash'),
        notes: cashNotes.trim() || undefined
      }
      const res = await recordManualCashPayment(payload)
      showToast(res?.message || `Cash payment of ${formatMoney(amountNum)} recorded successfully!`)
      setCashNotes('')
      await fetchBillData(activeBillId)
      loadRecentBills()
    } catch (err) {
      showToast(err.message || 'Failed to record cash payment.', 'error')
    } finally {
      setBusy(false)
    }
  }

  // 2. Create Dynamic UPI QR (POST /api/payments/gateway/create-qr)
  async function handleGenerateQr(e) {
    if (e) e.preventDefault()
    if (!activeBillId) {
      showToast('Please select or generate a bill first.', 'error')
      return
    }
    const amountNum = Number(upiAmount)
    if (!amountNum || amountNum <= 0) {
      showToast('Enter a valid amount to generate UPI QR code.', 'error')
      return
    }

    stopQrPolling()
    setBusy(true)
    try {
      const payload = {
        billId: Number(activeBillId) || activeBillId,
        amount: amountNum,
        method: 'upi',
        idempotencyKey: createIdempotencyKey('qr')
      }
      const res = await createPaymentGatewayQr(payload)
      const data = res?.data || res
      if (!data?.qrImageUrl && !data?.qrId) {
        throw new Error('Gateway did not return a valid QR image URL.')
      }

      setQrData(data)
      showToast('UPI QR Code generated. Ask customer to scan and pay.')

      // Calculate countdown timer
      const expiresAtMs = data.expiresAt ? new Date(data.expiresAt).getTime() : Date.now() + 5 * 60 * 1000
      const initialRemaining = Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000))
      setQrTimerRemaining(initialRemaining)

      qrTimerRef.current = setInterval(() => {
        setQrTimerRemaining((prev) => {
          if (prev <= 1) {
            stopQrPolling()
            return 0
          }
          return prev - 1
        })
      }, 1000)

      // Start Polling Attempt Status
      const attemptId = data.paymentAttemptId || data.qrId
      qrPollRef.current = setInterval(async () => {
        try {
          if (attemptId) {
            const attemptStatusRes = await getPaymentGatewayAttemptStatus(attemptId)
            const attemptData = attemptStatusRes?.data || attemptStatusRes
            const st = String(attemptData?.status || '').toLowerCase()
            if (st === 'success' || st === 'paid' || st === 'completed') {
              stopQrPolling()
              showToast('UPI Payment received successfully!')
              setQrData(null)
              fetchBillData(activeBillId)
              loadRecentBills()
              return
            }
          }
          // Also check bill status as secondary verification
          const latestBill = await getBillPaymentStatus(activeBillId)
          const billData = latestBill?.data || latestBill
          if (String(billData?.status).toLowerCase() === 'paid' || Number(billData?.balanceDue) <= 0) {
            stopQrPolling()
            showToast('UPI Payment verified successfully!')
            setQrData(null)
            fetchBillData(activeBillId)
            loadRecentBills()
          }
        } catch {
          // ignore transient poll error
        }
      }, 3000)
    } catch (err) {
      showToast(err.message || 'Failed to generate UPI QR code.', 'error')
    } finally {
      setBusy(false)
    }
  }

  // Simulate QR Payment for testing / offline demo
  async function handleSimulateQrPayment() {
    if (!activeBillId) return
    setBusy(true)
    try {
      await simulateQrPayment(activeBillId, {
        amount: Number(upiAmount) || Number(billStatus?.balanceDue) || 100
      })
      showToast('Payment simulation successful!')
      stopQrPolling()
      setQrData(null)
      fetchBillData(activeBillId)
      loadRecentBills()
    } catch (err) {
      showToast(err.message || 'Simulation endpoint not available on this server.', 'error')
    } finally {
      setBusy(false)
    }
  }

  // 3. Submit Bank Transfer (POST /api/payments/bank-transfers)
  async function handleBankTransferSubmit(e) {
    e.preventDefault()
    if (!activeBillId) {
      showToast('Please select or generate a bill first.', 'error')
      return
    }
    const amountNum = Number(bankAmount)
    if (!amountNum || amountNum <= 0) {
      showToast('Enter a valid bank transfer amount.', 'error')
      return
    }
    if (!bankUtr.trim()) {
      showToast('UTR / Transaction reference number is required.', 'error')
      return
    }

    setBusy(true)
    try {
      const payload = {
        billId: Number(activeBillId) || activeBillId,
        amount: amountNum,
        utr: bankUtr.trim(),
        bankName: bankName.trim() || 'Bank Transfer'
      }
      const res = await submitBankTransferPayment(payload)
      const data = res?.data || res
      setBankNotice({
        transferId: data?.transferId || 'Submitted',
        status: data?.status || 'PendingVerification'
      })
      showToast('Bank transfer logged with status: Pending Verification.')
      setBankUtr('')
      setBankName('')
      await fetchBillData(activeBillId)
      loadRecentBills()
    } catch (err) {
      showToast(err.message || 'Failed to submit bank transfer.', 'error')
    } finally {
      setBusy(false)
    }
  }

  // Confirm Bank Transfer (For Admin verification test)
  async function handleConfirmTransfer(transferId, decision = 'Confirm') {
    if (!transferId) return
    setBusy(true)
    try {
      const res = await confirmBankTransferPayment(transferId, {
        decision,
        notes: `Pharmacist portal verification: ${decision}`
      })
      showToast(res?.message || `Transfer marked as ${decision === 'Confirm' ? 'Verified' : 'Rejected'}.`)
      setBankNotice(null)
      await fetchBillData(activeBillId)
      loadRecentBills()
    } catch (err) {
      showToast(err.message || 'Failed to confirm bank transfer.', 'error')
    } finally {
      setBusy(false)
    }
  }

  // 4. Download Invoice PDF (GET /api/payments/bills/{billId}/invoice-pdf)
  async function handleDownloadInvoice() {
    if (!activeBillId) return
    setBusy(true)
    try {
      await downloadBillInvoicePdf(activeBillId)
      showToast(`Invoice PDF for Bill #${activeBillId} downloaded!`)
    } catch (err) {
      showToast(err.message || 'Failed to download invoice PDF.', 'error')
    } finally {
      setBusy(false)
    }
  }

  // 5. Load Branch Transactions Ledger
  const loadBranchLedger = useCallback(async () => {
    setLedgerLoading(true)
    try {
      const [transRes, reportRes] = await Promise.allSettled([
        listPaymentTransactions({ branchId, page: ledgerPage, pageSize: 50 }),
        getBranchPaymentReport(branchId)
      ])

      if (transRes.status === 'fulfilled') {
        const payload = transRes.value?.data || transRes.value || {}
        setBranchLedger(payload.items || (Array.isArray(payload) ? payload : []))
        setLedgerTotal(payload.total || (payload.items ? payload.items.length : 0))
        setLedgerHasMore(Boolean(payload.hasMore))
      }

      if (reportRes.status === 'fulfilled') {
        setBranchReport(reportRes.value?.data || reportRes.value || null)
      }
    } catch (err) {
      console.warn('Ledger load warning:', err.message)
    } finally {
      setLedgerLoading(false)
    }
  }, [branchId, ledgerPage])

  useEffect(() => {
    if (mainTab === 'ledger') {
      loadBranchLedger()
    }
  }, [mainTab, loadBranchLedger])

  // Export Transactions to CSV
  async function handleExportCsv() {
    setBusy(true)
    try {
      await exportPaymentTransactions({ branchId })
      showToast('Exporting transaction CSV...')
    } catch (err) {
      showToast(err.message || 'Transactions export completed.', 'info')
    } finally {
      setBusy(false)
    }
  }

  const grandTotal = Number(billStatus?.grandTotal ?? 0)
  const paidAmount = Number(billStatus?.paidAmount ?? 0)
  const balanceDue = Number(billStatus?.balanceDue ?? Math.max(0, grandTotal - paidAmount))
  const currencyCode = billStatus?.currency || 'INR'
  const billStatusBadge = String(billStatus?.status || (balanceDue <= 0 && grandTotal > 0 ? 'Paid' : 'Unpaid')).toLowerCase()

  return (
    <PharmacistLayout activeLabel="Payments">
      <div className="pm-payments">
        {/* Header */}
        <header className="pm-heading">
          <div>
            <p className="pm-breadcrumb">Pharmacist / Payments</p>
            <h1>Payments & Billing</h1>
            <p className="pm-subtitle">
              Generate bills from dispensed prescriptions, collect payments via Cash, UPI Dynamic QR, or Bank Transfer, and issue invoice receipts.
            </p>
          </div>

          <div className="pm-actions">
            <button
              type="button"
              className="pm-button"
              onClick={() => {
                if (activeBillId) fetchBillData(activeBillId)
                loadRecentBills()
                if (mainTab === 'ledger') loadBranchLedger()
              }}
              disabled={statusLoading || loadingRecent}
            >
              <FiRefreshCw className={statusLoading || loadingRecent ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        </header>

        {/* Navigation Tabs */}
        <nav className="pm-nav-tabs" aria-label="Payment Views">
          <button
            type="button"
            className={`pm-nav-tab ${mainTab === 'payments' ? 'is-active' : ''}`}
            onClick={() => setMainTab('payments')}
          >
            <FiCreditCard /> Generate Bills & Collect Payment
          </button>
          <button
            type="button"
            className={`pm-nav-tab ${mainTab === 'ledger' ? 'is-active' : ''}`}
            onClick={() => setMainTab('ledger')}
          >
            <FiList /> Branch Payment Ledger & Reports
          </button>
        </nav>

        {mainTab === 'payments' ? (
          <>
            {/* Step 1: Entry Mode Switcher (Generate Bill vs Lookup Bill) */}
            <section className="pm-card">
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={`pm-button ${entryMode === 'generate' ? 'pm-primary' : ''}`}
                  onClick={() => setEntryMode('generate')}
                >
                  <FiPlus /> 1. Generate Bill from Prescription
                </button>
                <button
                  type="button"
                  className={`pm-button ${entryMode === 'lookup' ? 'pm-primary' : ''}`}
                  onClick={() => setEntryMode('lookup')}
                >
                  <FiSearch /> 2. Lookup Existing Bill
                </button>
              </div>

              {entryMode === 'generate' ? (
                /* Generate Bill Form (POST /api/pharmacy/generate-bill) */
                <div>
                  <h3 style={{ margin: '0 0 4px', fontSize: '15px' }}>
                    Generate Bill for Dispensed Prescription
                  </h3>
                  <p className="pm-subtitle" style={{ marginBottom: '14px' }}>
                    Enter the prescription ID and optional discount to create the bill and proceed to payment.
                  </p>

                  <form onSubmit={handleGenerateBill} style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <label className="pm-field" style={{ minWidth: '220px', flex: '1' }}>
                      <span>Prescription ID *</span>
                      <input
                        type="text"
                        className="pm-input"
                        placeholder="e.g. 101, 102"
                        value={genRxId}
                        onChange={(e) => setGenRxId(e.target.value)}
                        required
                      />
                    </label>

                    <label className="pm-field" style={{ width: '150px' }}>
                      <span>Discount (%)</span>
                      <input
                        type="number"
                        className="pm-input"
                        min="0"
                        max="100"
                        step="0.5"
                        value={genDiscount}
                        onChange={(e) => setGenDiscount(e.target.value)}
                      />
                    </label>

                    <button
                      type="submit"
                      className="pm-button pm-primary"
                      disabled={genBusy}
                      style={{ minHeight: '42px' }}
                    >
                      <FiPlus />
                      {genBusy ? 'Generating...' : 'Generate Bill'}
                    </button>
                  </form>
                </div>
              ) : (
                /* Lookup Existing Bill Form */
                <div className="pm-search-section">
                  <h3 style={{ margin: '0 0 4px', fontSize: '15px' }}>
                    Lookup Existing Bill
                  </h3>
                  <p className="pm-subtitle" style={{ marginBottom: '10px' }}>
                    Enter an existing Bill ID or pick from the recent bills list.
                  </p>

                  <form onSubmit={handleSelectBill} className="pm-search-form">
                    <div className="pm-input-group">
                      <FiSearch />
                      <input
                        type="text"
                        className="pm-input"
                        placeholder="Enter Bill ID or invoice number (e.g. 101)..."
                        value={billIdInput}
                        onChange={(e) => setBillIdInput(e.target.value)}
                      />
                    </div>
                    <button type="submit" className="pm-button pm-primary" disabled={statusLoading}>
                      <FiSearch /> Load Bill
                    </button>
                  </form>

                  {recentBills.length > 0 && (
                    <div className="pm-quick-bills" style={{ marginTop: '8px' }}>
                      <span>Recent Bills:</span>
                      {recentBills.map((b, idx) => {
                        const bId = b.id || b.billId || b.billNumber || idx + 1
                        const bName = b.patientName || b.patient?.name || ''
                        return (
                          <button
                            type="button"
                            key={bId}
                            className="pm-quick-pill"
                            onClick={() => {
                              setBillIdInput(String(bId))
                              setActiveBillId(String(bId))
                            }}
                          >
                            #{bId} {bName ? `(${bName})` : ''}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Error Message */}
            {statusError && (
              <div className="pm-alert is-error" role="alert">
                <FiAlertCircle />
                <span>{statusError}</span>
              </div>
            )}

            {/* Live Bill Status Cards */}
            {activeBillId ? (
              <section className="pm-card">
                <div className="pm-card-heading">
                  <div>
                    <h2>
                      <FiFileText /> Bill #{activeBillId} Overview
                    </h2>
                    <p className="pm-subtitle">
                      Real-time status synced with backend payment gateway and ledger.
                    </p>
                  </div>
                  <div className="pm-actions">
                    <span className={`pm-badge is-${billStatusBadge}`}>
                      {billStatus?.status || (balanceDue <= 0 ? 'Paid' : 'Unpaid')}
                    </span>
                    <button
                      type="button"
                      className="pm-button pm-primary"
                      onClick={handleDownloadInvoice}
                      disabled={busy}
                    >
                      <FiDownload /> Download Invoice PDF
                    </button>
                  </div>
                </div>

                {statusLoading ? (
                  <p className="pm-subtitle">Refreshing live bill status...</p>
                ) : (
                  <div className="pm-status-grid">
                    <div className="pm-stat-box">
                      <span className="pm-stat-label">Grand Total</span>
                      <span className="pm-stat-val">{formatMoney(grandTotal, currencyCode)}</span>
                    </div>
                    <div className="pm-stat-box is-paid">
                      <span className="pm-stat-label">Amount Paid</span>
                      <span className="pm-stat-val">{formatMoney(paidAmount, currencyCode)}</span>
                    </div>
                    <div className="pm-stat-box is-due">
                      <span className="pm-stat-label">Balance Due</span>
                      <span className="pm-stat-val">{formatMoney(balanceDue, currencyCode)}</span>
                    </div>
                  </div>
                )}

                {/* Multi-mode Payment Area (Only needed if balanceDue > 0) */}
                {balanceDue > 0 ? (
                  <div className="pm-payment-layout">
                    {/* Mode Selector */}
                    <div className="pm-mode-selector">
                      <button
                        type="button"
                        className={`pm-mode-btn ${paymentMode === 'cash' ? 'is-active' : ''}`}
                        onClick={() => {
                          stopQrPolling()
                          setPaymentMode('cash')
                        }}
                      >
                        <div className="pm-mode-icon">
                          <FiDollarSign />
                        </div>
                        <div>
                          <div className="pm-mode-title">Cash at Counter</div>
                          <div className="pm-mode-desc">Record immediate cash received</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        className={`pm-mode-btn ${paymentMode === 'upi' ? 'is-active' : ''}`}
                        onClick={() => {
                          setPaymentMode('upi')
                        }}
                      >
                        <div className="pm-mode-icon">
                          <FiCreditCard />
                        </div>
                        <div>
                          <div className="pm-mode-title">Dynamic UPI QR</div>
                          <div className="pm-mode-desc">Scan with PhonePe, GPay, Paytm</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        className={`pm-mode-btn ${paymentMode === 'bank' ? 'is-active' : ''}`}
                        onClick={() => {
                          stopQrPolling()
                          setPaymentMode('bank')
                        }}
                      >
                        <div className="pm-mode-icon">
                          <FiShield />
                        </div>
                        <div>
                          <div className="pm-mode-title">Bank Transfer</div>
                          <div className="pm-mode-desc">NEFT, RTGS or IMPS with UTR</div>
                        </div>
                      </button>
                    </div>

                    {/* Mode Form Content */}
                    <div className="pm-mode-content">
                      {/* Cash Form */}
                      {paymentMode === 'cash' && (
                        <form onSubmit={handleCashPayment} className="pm-form-grid">
                          <h3>Record Cash Payment</h3>
                          <label className="pm-field">
                            <span>Amount Received (₹) *</span>
                            <input
                              type="number"
                              className="pm-input"
                              min="1"
                              step="0.01"
                              max={balanceDue}
                              value={cashAmount}
                              onChange={(e) => setCashAmount(e.target.value)}
                              required
                            />
                          </label>

                          <label className="pm-field">
                            <span>Counter Notes (Optional)</span>
                            <input
                              type="text"
                              className="pm-input"
                              placeholder="e.g. Received cash, change returned"
                              value={cashNotes}
                              onChange={(e) => setCashNotes(e.target.value)}
                            />
                          </label>

                          <button
                            type="submit"
                            className="pm-button pm-primary"
                            disabled={busy}
                          >
                            <FiCheckCircle />
                            {busy ? 'Recording...' : `Confirm Cash of ${formatMoney(cashAmount || 0)}`}
                          </button>
                        </form>
                      )}

                      {/* UPI QR Form & Display */}
                      {paymentMode === 'upi' && (
                        <div className="pm-form-grid">
                          <h3>Dynamic UPI QR Payment</h3>
                          {!qrData ? (
                            <form onSubmit={handleGenerateQr} className="pm-form-grid">
                              <label className="pm-field">
                                <span>Amount to Pay (₹) *</span>
                                <input
                                  type="number"
                                  className="pm-input"
                                  min="1"
                                  step="0.01"
                                  max={balanceDue}
                                  value={upiAmount}
                                  onChange={(e) => setUpiAmount(e.target.value)}
                                  required
                                />
                              </label>

                              <button
                                type="submit"
                                className="pm-button pm-primary"
                                disabled={busy}
                              >
                                <FiCreditCard />
                                {busy ? 'Generating QR...' : 'Generate Customer QR Code'}
                              </button>
                            </form>
                          ) : (
                            <div className="pm-qr-container">
                              <div className="pm-qr-frame">
                                {qrData.qrImageUrl ? (
                                  <img
                                    src={qrData.qrImageUrl}
                                    alt="UPI QR Code"
                                    className="pm-qr-image"
                                  />
                                ) : (
                                  <div>
                                    <p>QR Code Ready</p>
                                    <code>{qrData.qrId}</code>
                                  </div>
                                )}
                              </div>

                              <div className="pm-qr-timer">
                                <FiClock /> Expires in {Math.floor(qrTimerRemaining / 60)}:
                                {String(qrTimerRemaining % 60).padStart(2, '0')}
                              </div>

                              <div className="pm-qr-poll-status">
                                <span className="pm-pulse-dot" />
                                <span>Listening for UPI payment confirmation...</span>
                              </div>

                              <div className="pm-actions">
                                <button
                                  type="button"
                                  className="pm-button"
                                  onClick={() => {
                                    stopQrPolling()
                                    setQrData(null)
                                  }}
                                >
                                  <FiX /> Cancel QR
                                </button>
                                <button
                                  type="button"
                                  className="pm-button"
                                  onClick={handleSimulateQrPayment}
                                  title="Instant test approval for demo environments"
                                >
                                  Simulate Customer Payment
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Bank Transfer Form */}
                      {paymentMode === 'bank' && (
                        <form onSubmit={handleBankTransferSubmit} className="pm-form-grid">
                          <h3>Bank Transfer / NEFT / RTGS</h3>
                          <label className="pm-field">
                            <span>Transfer Amount (₹) *</span>
                            <input
                              type="number"
                              className="pm-input"
                              min="1"
                              step="0.01"
                              value={bankAmount}
                              onChange={(e) => setBankAmount(e.target.value)}
                              required
                            />
                          </label>

                          <label className="pm-field">
                            <span>UTR / Transaction Reference Number *</span>
                            <input
                              type="text"
                              className="pm-input"
                              placeholder="e.g. UTR1234567890"
                              value={bankUtr}
                              onChange={(e) => setBankUtr(e.target.value)}
                              required
                            />
                          </label>

                          <label className="pm-field">
                            <span>Sender Bank Name (Optional)</span>
                            <input
                              type="text"
                              className="pm-input"
                              placeholder="e.g. HDFC Bank, SBI"
                              value={bankName}
                              onChange={(e) => setBankName(e.target.value)}
                            />
                          </label>

                          <button
                            type="submit"
                            className="pm-button pm-primary"
                            disabled={busy}
                          >
                            <FiShield />
                            {busy ? 'Submitting...' : 'Submit Transfer for Verification'}
                          </button>

                          {bankNotice && (
                            <div className="pm-alert is-info">
                              <div>
                                <strong>Transfer ID #{bankNotice.transferId} Logged.</strong>
                                <p style={{ margin: '4px 0 8px', fontSize: '12px' }}>
                                  Bill balance remains unchanged until Pharmacy Admin confirms this bank transfer.
                                </p>
                                <button
                                  type="button"
                                  className="pm-button"
                                  onClick={() => handleConfirmTransfer(bankNotice.transferId, 'Confirm')}
                                >
                                  Confirm Transfer (Admin Approval)
                                </button>
                              </div>
                            </div>
                          )}
                        </form>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="pm-alert is-success" style={{ marginTop: '16px' }}>
                    <FiCheckCircle style={{ fontSize: '20px' }} />
                    <div>
                      <strong>This bill is fully settled!</strong>
                      <p style={{ margin: '2px 0 0', fontSize: '12.5px' }}>
                        No balance due. You can download and print the completed invoice PDF for the patient.
                      </p>
                    </div>
                  </div>
                )}

                {/* Payment History Table (GET /api/payments/bills/{billId}/history) */}
                <div style={{ marginTop: '24px' }}>
                  <div className="pm-card-heading">
                    <h3>Payment History ({historyTotal})</h3>
                    <button
                      type="button"
                      className="pm-button"
                      onClick={() => fetchBillData(activeBillId)}
                      disabled={historyLoading}
                    >
                      <FiRefreshCw className={historyLoading ? 'animate-spin' : ''} /> Refresh History
                    </button>
                  </div>

                  <div className="pm-table-scroll">
                    <table className="pm-table">
                      <thead>
                        <tr>
                          <th>Payment ID</th>
                          <th>Payment Mode</th>
                          <th>Paid Amount</th>
                          <th>Refunded</th>
                          <th>Transaction / UTR ID</th>
                          <th>Status</th>
                          <th>Payment Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historyItems.length > 0 ? (
                          historyItems.map((item, idx) => {
                            const pId = item.paymentId || item.id || idx + 1
                            const pStatus = String(item.status || 'Success').toLowerCase()
                            return (
                              <tr key={pId}>
                                <td>#{pId}</td>
                                <td>
                                  <strong>{item.paymentMode || item.mode || 'Cash'}</strong>
                                </td>
                                <td>{formatMoney(item.paidAmount ?? item.amount, currencyCode)}</td>
                                <td>{item.refundedAmount ? formatMoney(item.refundedAmount, currencyCode) : '—'}</td>
                                <td>
                                  <code>{item.transactionId || item.utr || '—'}</code>
                                </td>
                                <td>
                                  <span className={`pm-badge is-${pStatus}`}>
                                    {item.status || 'Success'}
                                  </span>
                                </td>
                                <td>{formatDate(item.paymentDate || item.createdAt)}</td>
                              </tr>
                            )
                          })
                        ) : (
                          <tr>
                            <td colSpan={7} className="pm-empty-table">
                              {historyLoading ? 'Loading payment records...' : 'No payments recorded for this bill yet.'}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            ) : (
              <section className="pm-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
                <FiCreditCard style={{ fontSize: '48px', color: '#94a3b8', margin: '0 auto 12px' }} />
                <h3>No Bill Selected</h3>
                <p className="pm-subtitle" style={{ maxWidth: '440px', margin: '0 auto 20px' }}>
                  Enter a Prescription ID above to generate a bill, or lookup an existing bill by ID to collect payment.
                </p>
              </section>
            )}
          </>
        ) : (
          /* Main Tab 2: Branch Transactions Ledger & Reports */
          <section className="pm-card">
            <div className="pm-card-heading">
              <div>
                <h2>
                  <FiList /> Branch Payment Transactions Ledger
                </h2>
                <p className="pm-subtitle">
                  Public ledger of all payments collected at Branch #{branchId}.
                </p>
              </div>
              <div className="pm-actions">
                <button
                  type="button"
                  className="pm-button"
                  onClick={handleExportCsv}
                  disabled={busy}
                >
                  <FiDownload /> Export CSV
                </button>
                <button
                  type="button"
                  className="pm-button"
                  onClick={loadBranchLedger}
                  disabled={ledgerLoading}
                >
                  <FiRefreshCw className={ledgerLoading ? 'animate-spin' : ''} /> Refresh Ledger
                </button>
              </div>
            </div>

            {/* Branch Collection Summary */}
            {branchReport && (
              <div className="pm-status-grid" style={{ marginBottom: '20px' }}>
                <div className="pm-stat-box is-paid">
                  <span className="pm-stat-label">Total Collections</span>
                  <span className="pm-stat-val">
                    {formatMoney(branchReport.totalCollections ?? branchReport.total ?? branchReport.amount ?? 0)}
                  </span>
                </div>
                <div className="pm-stat-box">
                  <span className="pm-stat-label">Transactions Count</span>
                  <span className="pm-stat-val">
                    {branchReport.transactionCount ?? branchReport.count ?? ledgerTotal}
                  </span>
                </div>
              </div>
            )}

            {/* Ledger Table */}
            <div className="pm-table-scroll">
              <table className="pm-table">
                <thead>
                  <tr>
                    <th>Tx ID</th>
                    <th>Bill ID</th>
                    <th>Amount</th>
                    <th>Payment Mode</th>
                    <th>Reference / UTR</th>
                    <th>Status</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {branchLedger.length > 0 ? (
                    branchLedger.map((tx, idx) => {
                      const txId = tx.id || tx.transactionId || idx + 1
                      const st = String(tx.status || 'Completed').toLowerCase()
                      return (
                        <tr key={txId}>
                          <td>#{txId}</td>
                          <td>
                            <button
                              type="button"
                              className="pm-quick-pill"
                              onClick={() => {
                                const bId = tx.billId || tx.bill?.id
                                if (bId) {
                                  setBillIdInput(String(bId))
                                  setActiveBillId(String(bId))
                                  setMainTab('payments')
                                }
                              }}
                            >
                              #{tx.billId || tx.bill?.id || '—'}
                            </button>
                          </td>
                          <td>
                            <strong>{formatMoney(tx.amount || tx.paidAmount)}</strong>
                          </td>
                          <td>{tx.paymentMode || tx.method || 'Cash'}</td>
                          <td>
                            <code>{tx.transactionId || tx.utr || tx.reference || '—'}</code>
                          </td>
                          <td>
                            <span className={`pm-badge is-${st}`}>{tx.status || 'Completed'}</span>
                          </td>
                          <td>{formatDate(tx.createdAt || tx.date || tx.paymentDate)}</td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="pm-empty-table">
                        {ledgerLoading ? 'Loading branch transactions...' : 'No transactions recorded for this branch yet.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {ledgerTotal > 50 && (
              <div className="pm-footer" style={{ marginTop: '16px' }}>
                <span>Page {ledgerPage}</span>
                <div className="pm-actions">
                  <button
                    type="button"
                    className="pm-button"
                    disabled={ledgerPage <= 1}
                    onClick={() => setLedgerPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    className="pm-button"
                    disabled={!ledgerHasMore}
                    onClick={() => setLedgerPage((p) => p + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </PharmacistLayout>
  )
}
