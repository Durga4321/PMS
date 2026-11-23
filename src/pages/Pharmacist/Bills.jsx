import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
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
  FiX,
  FiPhone,
  FiUser,
  FiCalendar,
  FiPercent,
  FiArrowRight,
  FiCheck,
  FiChevronRight
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
  getBill,
  cancelBill,
  refundPayment,
  simulateQrPayment,
  listDispensingDrafts,
  getPendingPharmacyPrescriptions,
  getPharmacyPrescriptions,
  getPharmacyPrescription
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

function createIdempotencyKey(prefix = 'bill') {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

export default function Bills() {
  const [params, setParams] = useSearchParams()
  const { showToast } = useToast()

  const initialBillId = params.get('billId') || ''
  const initialRxId = params.get('rxId') || ''
  const initialPhone = params.get('phone') || ''

  // Modal State for Generate Bill Dialogue Box
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [pendingPatients, setPendingPatients] = useState([])

  // Phone Lookup & Prescription Details State
  const [searchPhone, setSearchPhone] = useState(initialPhone)
  const [phoneLookupBusy, setPhoneLookupBusy] = useState(false)
  const [phoneLookupError, setPhoneLookupError] = useState('')
  const [foundPrescriptions, setFoundPrescriptions] = useState([])
  const [selectedRx, setSelectedRx] = useState(null)

  // Generate Bill Form State (POST /api/pharmacy/generate-bill)
  const [genRxId, setGenRxId] = useState(initialRxId)
  const [genDiscount, setGenDiscount] = useState('0')
  const [genBusy, setGenBusy] = useState(false)

  // Bill Lookup State
  const [billIdInput, setBillIdInput] = useState(initialBillId)
  const [activeBillId, setActiveBillId] = useState(initialBillId)
  const [matchingBills, setMatchingBills] = useState([])
  const [recentBills, setRecentBills] = useState([])
  const [allBills, setAllBills] = useState([])
  const [loadingBills, setLoadingBills] = useState(false)
  const [billsSearch, setBillsSearch] = useState('')
  const [billsFilter, setBillsFilter] = useState('all')

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
  const [qrData, setQrData] = useState(null)
  const [qrTimerRemaining, setQrTimerRemaining] = useState(0)
  const qrPollRef = useRef(null)
  const qrTimerRef = useRef(null)

  // Bank Transfer Form State (POST /api/payments/bank-transfers)
  const [bankAmount, setBankAmount] = useState('')
  const [bankUtr, setBankUtr] = useState('')
  const [bankName, setBankName] = useState('')
  const [bankNotice, setBankNotice] = useState(null)

  // Modals for Cancel Bill and Refund Payment
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [targetCancelBillId, setTargetCancelBillId] = useState(null)
  const [cancelReason, setCancelReason] = useState('')

  const [showRefundModal, setShowRefundModal] = useState(false)
  const [targetRefundBill, setTargetRefundBill] = useState(null)
  const [refundAmountVal, setRefundAmountVal] = useState('')
  const [refundReasonVal, setRefundReasonVal] = useState('')

  // Branch Ledger State (GET /api/payments/transactions)
  const [branchLedger, setBranchLedger] = useState([])
  const [ledgerTotal, setLedgerTotal] = useState(0)
  const [ledgerPage, setLedgerPage] = useState(1)
  const [ledgerHasMore, setLedgerHasMore] = useState(false)
  const [ledgerLoading, setLedgerLoading] = useState(false)
  const [branchReport, setBranchReport] = useState(null)

  const branchId = billStatus?.branchId ||
    sessionStorage.getItem('workingBranchId') ||
    localStorage.getItem('workingBranchId') ||
    '1'

  // Load Bills Directory
  const loadBillsList = useCallback(async () => {
    setLoadingBills(true)
    try {
      const res = await listBills()
      const items = res?.data?.items || res?.data || res?.items || (Array.isArray(res) ? res : [])
      const safeItems = Array.isArray(items) ? items : []
      setAllBills(safeItems)
      setRecentBills(safeItems.slice(0, 8))
    } catch {
      // ignore
    } finally {
      setLoadingBills(false)
    }
  }, [])

  useEffect(() => {
    loadBillsList()
  }, [loadBillsList])

  // Load Bill Live Status & Payment History
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

  useEffect(() => {
    if (activeBillId) {
      fetchBillData(activeBillId)
      setParams({ billId: activeBillId }, { replace: true })
    }
  }, [activeBillId, fetchBillData, setParams])

  // QR Polling Cleanup
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

  // Load Pending / Dispensed Patients for quick selection in Dialogue Box
  const loadPendingPatients = useCallback(async () => {
    try {
      const [draftsRes, pendingRes, allRxRes] = await Promise.allSettled([
        listDispensingDrafts(),
        getPendingPharmacyPrescriptions(),
        getPharmacyPrescriptions()
      ])
      const list = []
      const seen = new Set()

      const checkAndAdd = (item) => {
        const d = item.draft || item
        const ph = String(d.patientPhone || d.phone || d.patient?.patientPhone || d.patient?.phone || d.phoneNumber || d.patient?.phoneNumber || '').replace(/\D/g, '')
        const name = d.patientName || d.patient?.patientName || d.patient?.name || d.name || 'Patient'
        const rxId = d.prescriptionId || item.id || item.draftId || d.id || ''
        if (ph && ph.length >= 7 && !seen.has(ph)) {
          seen.add(ph)
          list.push({ phone: ph, name, prescriptionId: rxId })
        }
      }

      if (draftsRes.status === 'fulfilled') {
        const raw = draftsRes.value?.data || draftsRes.value?.drafts || draftsRes.value || []
        ;(Array.isArray(raw) ? raw : []).forEach(checkAndAdd)
      }
      if (pendingRes.status === 'fulfilled') {
        const raw = pendingRes.value?.data || pendingRes.value || []
        ;(Array.isArray(raw) ? raw : []).forEach(checkAndAdd)
      }
      if (allRxRes.status === 'fulfilled') {
        const raw = allRxRes.value?.data || allRxRes.value || []
        ;(Array.isArray(raw) ? raw : []).forEach(checkAndAdd)
      }

      setPendingPatients(list.slice(0, 10))
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    loadPendingPatients()
  }, [loadPendingPatients])

  // Fetch Prescriptions by Patient Mobile Number
  const handleFetchByPhone = useCallback(async (phoneToSearch) => {
    const rawDigits = String(phoneToSearch ?? searchPhone ?? '').replace(/\D/g, '')
    if (!rawDigits) {
      setPhoneLookupError('Please enter a 10-digit mobile number.')
      return
    }
    if (rawDigits.length < 10) {
      setPhoneLookupError('Mobile number must be at least 10 digits.')
      return
    }

    setPhoneLookupBusy(true)
    setPhoneLookupError('')
    setFoundPrescriptions([])
    setSelectedRx(null)

    try {
      const [draftsRes, pendingRes, allRxRes] = await Promise.allSettled([
        listDispensingDrafts(),
        getPendingPharmacyPrescriptions(),
        getPharmacyPrescriptions()
      ])

      const candidateList = []

      const extractPhone = (obj) => {
        const ph = obj?.patientPhone || obj?.phone || obj?.patient?.patientPhone || obj?.patient?.phone || obj?.phoneNumber || obj?.patient?.phoneNumber || ''
        return String(ph).replace(/\D/g, '')
      }

      const extractName = (obj) => {
        return obj?.patientName || obj?.patient?.patientName || obj?.patient?.name || obj?.name || 'Walk-in Patient'
      }

      const extractDoctor = (obj) => {
        return obj?.doctorName || obj?.patient?.doctorName || obj?.doctor || 'Hospital Physician'
      }

      const extractMedicines = (obj) => {
        const meds = obj?.medicines || obj?.items || obj?.prescriptionItems || obj?.draft?.medicines || []
        return Array.isArray(meds) ? meds : []
      }

      // Check drafts
      if (draftsRes.status === 'fulfilled') {
        const raw = draftsRes.value?.data || draftsRes.value?.drafts || draftsRes.value || []
        const list = Array.isArray(raw) ? raw : []
        list.forEach((item) => {
          const draftData = item.draft || item
          const ph = extractPhone(draftData)
          if (ph && (ph === rawDigits || ph.endsWith(rawDigits) || rawDigits.endsWith(ph))) {
            const rxId = draftData.prescriptionId || item.id || item.draftId || draftData.id
            if (rxId) {
              candidateList.push({
                source: 'draft',
                id: rxId,
                prescriptionId: rxId,
                draftId: item.id || item.draftId || draftData.draftId,
                patientName: extractName(draftData),
                patientPhone: ph,
                patientAge: draftData.patientAge || draftData.age || draftData.patient?.patientAge || '',
                patientGender: draftData.patientGender || draftData.gender || draftData.patient?.patientGender || '',
                doctorName: extractDoctor(draftData),
                prescriptionDate: draftData.prescriptionDate || draftData.patient?.prescriptionDate || draftData.createdAt || new Date().toISOString().split('T')[0],
                medicines: extractMedicines(draftData),
                notes: draftData.notes || draftData.patient?.notes || ''
              })
            }
          }
        })
      }

      // Check pending prescriptions
      if (pendingRes.status === 'fulfilled') {
        const raw = pendingRes.value?.data || pendingRes.value || []
        const list = Array.isArray(raw) ? raw : []
        list.forEach((item) => {
          const ph = extractPhone(item)
          if (ph && (ph === rawDigits || ph.endsWith(rawDigits) || rawDigits.endsWith(ph))) {
            const rxId = item.prescriptionId || item.id || item._id
            if (rxId && !candidateList.some((c) => String(c.prescriptionId) === String(rxId))) {
              candidateList.push({
                source: 'pending',
                id: rxId,
                prescriptionId: rxId,
                patientName: extractName(item),
                patientPhone: ph,
                patientAge: item.patientAge || item.age || '',
                patientGender: item.patientGender || item.gender || '',
                doctorName: extractDoctor(item),
                prescriptionDate: item.prescriptionDate || item.date || item.createdAt || new Date().toISOString().split('T')[0],
                medicines: extractMedicines(item),
                notes: item.notes || ''
              })
            }
          }
        })
      }

      // Check all prescriptions
      if (allRxRes.status === 'fulfilled') {
        const raw = allRxRes.value?.data || allRxRes.value || []
        const list = Array.isArray(raw) ? raw : []
        list.forEach((item) => {
          const ph = extractPhone(item)
          if (ph && (ph === rawDigits || ph.endsWith(rawDigits) || rawDigits.endsWith(ph))) {
            const rxId = item.prescriptionId || item.id || item._id
            if (rxId && !candidateList.some((c) => String(c.prescriptionId) === String(rxId))) {
              candidateList.push({
                source: 'prescription',
                id: rxId,
                prescriptionId: rxId,
                patientName: extractName(item),
                patientPhone: ph,
                patientAge: item.patientAge || item.age || '',
                patientGender: item.patientGender || item.gender || '',
                doctorName: extractDoctor(item),
                prescriptionDate: item.prescriptionDate || item.date || item.createdAt || new Date().toISOString().split('T')[0],
                medicines: extractMedicines(item),
                notes: item.notes || ''
              })
            }
          }
        })
      }

      if (!candidateList.length) {
        // Also check if rawDigits might directly be a Prescription ID
        try {
          const directRes = await getPharmacyPrescription(rawDigits)
          const data = directRes?.data || directRes
          if (data && (data.prescriptionId || data.id)) {
            const rxId = data.prescriptionId || data.id || rawDigits
            candidateList.push({
              source: 'direct',
              id: rxId,
              prescriptionId: rxId,
              patientName: extractName(data),
              patientPhone: extractPhone(data) || rawDigits,
              patientAge: data.patientAge || data.age || '',
              patientGender: data.patientGender || data.gender || '',
              doctorName: extractDoctor(data),
              prescriptionDate: data.prescriptionDate || data.date || data.createdAt || new Date().toISOString().split('T')[0],
              medicines: extractMedicines(data),
              notes: data.notes || ''
            })
          }
        } catch {
          // not an ID, continue to show error
        }
      }

      if (!candidateList.length) {
        setPhoneLookupError(`No dispensed or pending prescriptions found for "${rawDigits}". Please verify the phone number or select a pending patient.`)
        return
      }

      setFoundPrescriptions(candidateList)
      const target = (initialRxId && candidateList.find((c) => String(c.prescriptionId) === String(initialRxId))) || candidateList[0]
      if (target) {
        if (!target.medicines || target.medicines.length === 0) {
          try {
            const full = await getPharmacyPrescription(target.prescriptionId)
            const d = full?.data || full?.prescription || full || {}
            const meds = d.medicines || d.items || d.prescriptionItems || []
            if (Array.isArray(meds) && meds.length > 0) {
              target.medicines = meds
            }
          } catch {
            // retain existing candidate
          }
        }
        setSelectedRx(target)
        setGenRxId(String(target.prescriptionId || ''))
      }
    } catch (err) {
      setPhoneLookupError(err.message || 'Error looking up patient prescriptions.')
    } finally {
      setPhoneLookupBusy(false)
    }
  }, [searchPhone, initialRxId])

  // Fetch Prescriptions by Direct Rx ID
  const handleFetchByRxId = useCallback(async (idToSearch) => {
    const rawId = String(idToSearch ?? genRxId ?? '').trim()
    if (!rawId) {
      setPhoneLookupError('Please enter a Prescription ID.')
      return
    }
    setPhoneLookupBusy(true)
    setPhoneLookupError('')
    try {
      const res = await getPharmacyPrescription(rawId)
      const data = res?.data || res
      if (!data) throw new Error(`Prescription #${rawId} not found.`)
      const rx = {
        source: 'direct',
        id: rawId,
        prescriptionId: rawId,
        patientName: data.patientName || data.patient?.name || data.name || 'Patient',
        patientPhone: data.patientPhone || data.phone || data.patient?.patientPhone || '',
        patientAge: data.patientAge || data.age || '',
        patientGender: data.patientGender || data.gender || '',
        doctorName: data.doctorName || data.doctor || '',
        prescriptionDate: data.prescriptionDate || data.date || new Date().toISOString().split('T')[0],
        medicines: Array.isArray(data.medicines) ? data.medicines : (Array.isArray(data.items) ? data.items : []),
        notes: data.notes || ''
      }
      setSelectedRx(rx)
      setGenRxId(String(rawId))
      if (rx.patientPhone) setSearchPhone(rx.patientPhone)
    } catch (err) {
      setPhoneLookupError(err.message || `Unable to fetch details for Prescription #${rawId}.`)
    } finally {
      setPhoneLookupBusy(false)
    }
  }, [genRxId])

  useEffect(() => {
    if (initialPhone) {
      setShowGenerateModal(true)
      handleFetchByPhone(initialPhone)
    } else if (initialRxId) {
      setShowGenerateModal(true)
      handleFetchByRxId(initialRxId)
    }
  }, [initialPhone, initialRxId, handleFetchByPhone, handleFetchByRxId])

  const rxMedicines = useMemo(() => {
    if (!selectedRx || !Array.isArray(selectedRx.medicines)) return []
    return selectedRx.medicines
  }, [selectedRx])

  const calculatedSubtotal = useMemo(() => {
    if (!rxMedicines.length) return 0
    return rxMedicines.reduce((sum, row) => {
      const q = Number(row.quantity ?? row.qty ?? 1) || 1
      const p = Number(row.unitPrice ?? row.price ?? row.rate ?? 0) || 0
      const total = row.totalAmount ?? row.total ?? (q * p)
      return sum + Number(total || 0)
    }, 0)
  }, [rxMedicines])

  const discountVal = Math.min(100, Math.max(0, Number(genDiscount) || 0))
  const discountAmount = Math.round((calculatedSubtotal * discountVal / 100) * 100) / 100
  const netPayableAmount = Math.max(0, Math.round((calculatedSubtotal - discountAmount) * 100) / 100)

  // 1. Generate Bill from Prescription (POST /api/pharmacy/generate-bill)
  async function handleGenerateBill(e) {
    if (e) e.preventDefault()
    const targetRxId = selectedRx?.prescriptionId || genRxId.trim()
    if (!targetRxId) {
      showToast('Please fetch prescription details using the patient mobile number first.', 'error')
      return
    }
    setGenBusy(true)
    setStatusError('')
    try {
      const payload = {
        prescriptionId: Number(targetRxId) || targetRxId,
        discount: Number(genDiscount) || 0
      }
      const response = await generateBill(payload)
      const newId = response?.data?.billId || response?.billId || response?.id
      if (!newId) throw new Error(response?.message || 'Bill generation did not return a valid bill ID.')
      showToast(`Bill #${newId} generated successfully! Loading billing details...`, 'success')
      setGenRxId('')
      setGenDiscount('0')
      setSelectedRx(null)
      setFoundPrescriptions([])
      setShowGenerateModal(false)
      stopQrPolling()
      setQrData(null)
      setBankNotice(null)
      setBillIdInput(String(newId))
      setActiveBillId(String(newId))
      loadBillsList()
    } catch (err) {
      showToast(err.message || 'Failed to generate bill. Ensure the prescription is fully dispensed.', 'error')
    } finally {
      setGenBusy(false)
    }
  }

  // Lookup & Search Existing Bill by Bill ID, Patient Name, or Phone
  function handleSelectBill(e) {
    if (e) e.preventDefault()
    const query = String(billIdInput || '').trim()
    if (!query) {
      showToast('Please enter a Bill ID, Patient Name, or Phone Number.', 'error')
      return
    }

    const qLower = query.toLowerCase()
    const qDigits = query.replace(/\D/g, '')

    // Search through allBills
    const matches = allBills.filter((b) => {
      const bId = String(b.id || b.billId || b.billNumber || '').toLowerCase()
      const pName = String(b.patientName || b.patient?.name || b.patient?.fullName || b.customerName || '').toLowerCase()
      const pPhone = String(b.patientPhone || b.phone || b.patient?.patientPhone || b.patient?.phone || '').replace(/\D/g, '')
      const docName = String(b.doctorName || b.doctor || '').toLowerCase()

      const matchId = bId === qLower || bId.includes(qLower)
      const matchName = pName.includes(qLower) || docName.includes(qLower)
      const matchPhone = Boolean(qDigits && pPhone && (pPhone === qDigits || pPhone.includes(qDigits) || qDigits.includes(pPhone)))

      return matchId || matchName || matchPhone
    })

    if (matches.length === 1) {
      const targetId = matches[0].id || matches[0].billId || matches[0].billNumber
      setMatchingBills([])
      stopQrPolling()
      setQrData(null)
      setBankNotice(null)
      setActiveBillId(String(targetId))
      showToast(`Loaded Bill #${targetId} for ${matches[0].patientName || 'Patient'}.`, 'success')
    } else if (matches.length > 1) {
      setMatchingBills(matches)
      showToast(`Found ${matches.length} matching bills. Select one below.`, 'info')
    } else {
      // If not matched in loaded list, attempt direct fetch with the query as Bill ID
      setMatchingBills([])
      stopQrPolling()
      setQrData(null)
      setBankNotice(null)
      setActiveBillId(query)
    }
  }

  // Quick Switch to Pay a specific bill
  function handlePaySpecificBill(bId) {
    if (!bId) return
    stopQrPolling()
    setQrData(null)
    setBankNotice(null)
    setBillIdInput(String(bId))
    setActiveBillId(String(bId))
  }

  // 2. Cash Payment (POST /api/payments/manual)
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
      loadBillsList()
    } catch (err) {
      showToast(err.message || 'Failed to record cash payment.', 'error')
    } finally {
      setBusy(false)
    }
  }

  // 3. Dynamic UPI QR (POST /api/payments/gateway/create-qr)
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
              loadBillsList()
              return
            }
          }
          const latestBill = await getBillPaymentStatus(activeBillId)
          const billData = latestBill?.data || latestBill
          if (String(billData?.status).toLowerCase() === 'paid' || Number(billData?.balanceDue) <= 0) {
            stopQrPolling()
            showToast('UPI Payment verified successfully!')
            setQrData(null)
            fetchBillData(activeBillId)
            loadBillsList()
          }
        } catch {}
      }, 3000)
    } catch (err) {
      showToast(err.message || 'Failed to generate UPI QR code.', 'error')
    } finally {
      setBusy(false)
    }
  }

  // Simulate QR Payment
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
      loadBillsList()
    } catch (err) {
      showToast(err.message || 'Simulation endpoint not available.', 'error')
    } finally {
      setBusy(false)
    }
  }

  // 4. Bank Transfer (POST /api/payments/bank-transfers)
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
      loadBillsList()
    } catch (err) {
      showToast(err.message || 'Failed to submit bank transfer.', 'error')
    } finally {
      setBusy(false)
    }
  }

  // Confirm Bank Transfer (Admin Verification)
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
      loadBillsList()
    } catch (err) {
      showToast(err.message || 'Failed to confirm bank transfer.', 'error')
    } finally {
      setBusy(false)
    }
  }

  // 5. Download Invoice PDF (GET /api/payments/bills/{billId}/invoice-pdf)
  async function handleDownloadInvoice(bIdToDownload) {
    const id = bIdToDownload || activeBillId
    if (!id) return
    setBusy(true)
    try {
      await downloadBillInvoicePdf(id)
      showToast(`Invoice PDF for Bill #${id} downloaded!`)
    } catch (err) {
      showToast(err.message || 'Failed to download invoice PDF.', 'error')
    } finally {
      setBusy(false)
    }
  }

  // Cancel Bill Action
  async function handleConfirmCancelBill(e) {
    e.preventDefault()
    if (!targetCancelBillId) return
    setBusy(true)
    try {
      const res = await cancelBill(targetCancelBillId, { reason: cancelReason.trim() || 'Cancelled by pharmacist' })
      showToast(res?.message || `Bill #${targetCancelBillId} cancelled successfully.`)
      setShowCancelModal(false)
      setTargetCancelBillId(null)
      setCancelReason('')
      if (activeBillId === targetCancelBillId) fetchBillData(activeBillId)
      loadBillsList()
    } catch (err) {
      showToast(err.message || 'Failed to cancel bill.', 'error')
    } finally {
      setBusy(false)
    }
  }

  // Refund Action
  async function handleConfirmRefund(e) {
    e.preventDefault()
    if (!targetRefundBill) return
    const id = targetRefundBill.id || targetRefundBill.billId
    const amountNum = Number(refundAmountVal)
    if (!amountNum || amountNum <= 0) {
      showToast('Enter a valid refund amount.', 'error')
      return
    }

    setBusy(true)
    try {
      const res = await refundPayment(id, {
        amount: amountNum,
        reason: refundReasonVal.trim() || 'Refund issued by pharmacist'
      })
      showToast(res?.message || `Refund of ${formatMoney(amountNum)} issued for Bill #${id}.`)
      setShowRefundModal(false)
      setTargetRefundBill(null)
      setRefundAmountVal('')
      setRefundReasonVal('')
      if (activeBillId === String(id)) fetchBillData(activeBillId)
      loadBillsList()
    } catch (err) {
      showToast(err.message || 'Failed to issue refund.', 'error')
    } finally {
      setBusy(false)
    }
  }

  // Load Branch Ledger
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



  // Export Transactions CSV
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

  // Filtered Bills for Directory Tab
  const filteredBills = allBills.filter((b) => {
    const q = billsSearch.toLowerCase()
    const matchesQuery = !q || [
      b.id,
      b.billId,
      b.billNumber,
      b.patientName,
      b.patient?.name,
      b.doctorName
    ].some((v) => String(v || '').toLowerCase().includes(q))

    const st = String(b.status || b.paymentStatus || '').toLowerCase()
    let matchesStatus = true
    if (billsFilter === 'paid') matchesStatus = st === 'paid'
    else if (billsFilter === 'unpaid') matchesStatus = st === 'unpaid'
    else if (billsFilter === 'partial') matchesStatus = st.includes('part')

    return matchesQuery && matchesStatus
  })

  const grandTotal = Number(billStatus?.grandTotal ?? 0)
  const paidAmount = Number(billStatus?.paidAmount ?? 0)
  const balanceDue = Number(billStatus?.balanceDue ?? Math.max(0, grandTotal - paidAmount))
  const currencyCode = billStatus?.currency || 'INR'
  const billStatusBadge = String(billStatus?.status || (balanceDue <= 0 && grandTotal > 0 ? 'Paid' : 'Unpaid')).toLowerCase()

  return (
    <PharmacistLayout activeLabel="Bills & Payments">
      <div className="pm-payments">
        {/* Header */}
        <header className="pm-heading">
          <div>
            <p className="pm-breadcrumb">Pharmacist / Bills & Payments</p>
            <h1>Bills & Payments</h1>
            <p className="pm-subtitle">
              Collect Cash, Dynamic UPI QR, or Bank Transfer payments for bills, download invoices, and manage billing records.
            </p>
          </div>

          <div className="pm-actions">
            <button
              type="button"
              className="pm-button pm-primary"
              onClick={() => {
                setShowGenerateModal(true)
                loadPendingPatients()
              }}
              style={{ minHeight: '42px', padding: '0 20px', fontWeight: 600 }}
            >
              <FiPlus /> Generate Bill
            </button>
            <button
              type="button"
              className="pm-button"
              onClick={() => {
                if (activeBillId) fetchBillData(activeBillId)
                loadBillsList()
              }}
              disabled={statusLoading || loadingBills}
            >
              <FiRefreshCw className={statusLoading || loadingBills ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        </header>

        {/* Search & Lookup Existing Bills Bar */}
        <section className="pm-card" style={{ marginBottom: '20px' }}>
          <form onSubmit={handleSelectBill} style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <label className="pm-field" style={{ minWidth: '280px', flex: 1, margin: 0 }}>
              <span>Search Bills by Bill ID, Patient Name, or Phone Number</span>
              <div className="pm-input-group">
                <FiSearch />
                <input
                  type="text"
                  className="pm-input"
                  placeholder="Enter Bill ID, Patient Name, or Mobile Number..."
                  value={billIdInput}
                  onChange={(e) => {
                    setBillIdInput(e.target.value)
                    if (!e.target.value.trim()) setMatchingBills([])
                  }}
                />
              </div>
            </label>
            <button
              type="submit"
              className="pm-button pm-primary"
              disabled={statusLoading || !billIdInput.trim()}
              style={{ minHeight: '42px', padding: '0 20px' }}
            >
              <FiSearch /> Search / Load Bill
            </button>
          </form>

          {/* Multiple Matching Bills Results */}
          {matchingBills.length > 0 && (
            <div style={{ marginTop: '14px', background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                  Found {matchingBills.length} matching bills. Click to view:
                </span>
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '12px' }}
                  onClick={() => setMatchingBills([])}
                >
                  Dismiss
                </button>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {matchingBills.map((b) => {
                  const bId = b.id || b.billId || b.billNumber
                  const bName = b.patientName || b.patient?.name || 'Walk-in'
                  const bPhone = b.patientPhone || b.phone || ''
                  const bAmt = b.totalAmount || b.grandTotal || b.amount || 0
                  const isCurrent = String(bId) === String(activeBillId)
                  return (
                    <button
                      key={bId}
                      type="button"
                      className="pm-button"
                      style={{
                        background: isCurrent ? '#0284c7' : '#ffffff',
                        color: isCurrent ? '#ffffff' : '#0f172a',
                        borderColor: isCurrent ? '#0284c7' : '#cbd5e1',
                        padding: '6px 12px',
                        fontSize: '12.5px',
                        borderRadius: '8px',
                        cursor: 'pointer'
                      }}
                      onClick={() => {
                        setActiveBillId(String(bId))
                        setBillIdInput(String(bId))
                        setMatchingBills([])
                      }}
                    >
                      <strong>#{bId}</strong> · {bName} {bPhone ? `(${bPhone})` : ''} · {formatMoney(bAmt)}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {recentBills.length > 0 && (
            <div className="pm-quick-bills" style={{ marginTop: '12px' }}>
              <span>Recent Bills:</span>
              {recentBills.slice(0, 8).map((b, idx) => {
                const bId = b.id || b.billId || b.billNumber || idx + 1
                const bName = b.patientName || b.patient?.name || ''
                const isCurrent = String(bId) === String(activeBillId)
                return (
                  <button
                    type="button"
                    key={bId}
                    className="pm-quick-pill"
                    onClick={() => {
                      setBillIdInput(String(bId))
                      setActiveBillId(String(bId))
                    }}
                    style={{
                      background: isCurrent ? '#0284c7' : undefined,
                      color: isCurrent ? '#ffffff' : undefined,
                      borderColor: isCurrent ? '#0284c7' : undefined
                    }}
                  >
                    #{bId} {bName ? `(${bName})` : ''}
                  </button>
                )
              })}
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
                      Live status synced with backend payment gateway and ledger.
                    </p>
                  </div>
                  <div className="pm-actions">
                    <span className={`pm-badge is-${billStatusBadge}`}>
                      {billStatus?.status || (balanceDue <= 0 ? 'Paid' : 'Unpaid')}
                    </span>
                    <button
                      type="button"
                      className="pm-button pm-primary"
                      onClick={() => handleDownloadInvoice(activeBillId)}
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

                {/* Multi-mode Payment Area (Only when balanceDue > 0) */}
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
                              placeholder="e.g. Received cash, returned change"
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
              <section className="pm-card" style={{ textAlign: 'center', padding: '50px 20px' }}>
                <FiCreditCard style={{ fontSize: '52px', color: '#94a3b8', margin: '0 auto 14px' }} />
                <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 6px', color: '#1e293b' }}>
                  No Bill Selected
                </h3>
                <p className="pm-subtitle" style={{ maxWidth: '440px', margin: '0 auto 20px', color: '#64748b' }}>
                  Click <strong>Generate Bill</strong> to fetch a patient's prescription, apply discount, and create a bill, or enter an existing Bill ID above.
                </p>
                <button
                  type="button"
                  className="pm-button pm-primary"
                  onClick={() => {
                    setShowGenerateModal(true)
                    loadPendingPatients()
                  }}
                  style={{ minHeight: '44px', padding: '0 24px', fontWeight: 600, fontSize: '14px' }}
                >
                  <FiPlus /> Generate Bill from Prescription
                </button>
              </section>
            )}

        {/* Modal: Generate Bill Dialogue Box */}
        {showGenerateModal && (
          <div className="pm-modal-overlay" onClick={() => setShowGenerateModal(false)}>
            <div
              className="pm-modal"
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: '780px',
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}
            >
              <div className="pm-modal-header" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                    <FiPlus style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                    Generate Bill from Prescription
                  </h2>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                    Enter patient mobile number to fetch prescription details, apply discount, and generate the bill.
                  </p>
                </div>
                <button
                  type="button"
                  className="pm-modal-close"
                  onClick={() => setShowGenerateModal(false)}
                  title="Close"
                >
                  <FiX />
                </button>
              </div>

              {/* Patient Phone Input & Fetch */}
              <div>
                <label className="pm-field" style={{ width: '100%' }}>
                  <span>Patient Phone Number *</span>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                    <div className="pm-input-group" style={{ flex: 1 }}>
                      <FiPhone />
                      <input
                        type="tel"
                        className="pm-input"
                        placeholder="Enter 10-digit mobile number..."
                        value={searchPhone}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 10)
                          setSearchPhone(val)
                          if (val.length === 10) {
                            handleFetchByPhone(val)
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleFetchByPhone()
                          }
                        }}
                        maxLength={10}
                        autoFocus
                      />
                    </div>
                    <button
                      type="button"
                      className="pm-button pm-primary"
                      onClick={() => handleFetchByPhone()}
                      disabled={phoneLookupBusy}
                      style={{ minHeight: '42px', padding: '0 20px', whiteSpace: 'nowrap' }}
                    >
                      <FiSearch className={phoneLookupBusy ? 'animate-spin' : ''} />
                      {phoneLookupBusy ? 'Fetching...' : 'Fetch Details'}
                    </button>
                  </div>
                </label>

                {/* Clickable pending patient numbers */}
                {pendingPatients.length > 0 && (
                  <div style={{ marginTop: '10px', background: '#f8fafc', padding: '10px 12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                      Or click a pending patient number:
                    </span>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                      {pendingPatients.map((p) => {
                        const isSelected = searchPhone === p.phone
                        return (
                          <button
                            key={p.phone}
                            type="button"
                            className="pm-button"
                            style={{
                              padding: '5px 12px',
                              fontSize: '12px',
                              borderRadius: '20px',
                              background: isSelected ? '#0284c7' : '#ffffff',
                              color: isSelected ? '#ffffff' : '#0f172a',
                              borderColor: isSelected ? '#0284c7' : '#cbd5e1',
                              cursor: 'pointer'
                            }}
                            onClick={() => {
                              setSearchPhone(p.phone)
                              handleFetchByPhone(p.phone)
                            }}
                          >
                            <FiPhone style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                            <strong>{p.phone}</strong> {p.name ? `· ${p.name}` : ''}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Error Message */}
              {phoneLookupError && (
                <div className="pm-alert is-error">
                  <FiAlertCircle />
                  <span>{phoneLookupError}</span>
                </div>
              )}

              {/* Multiple Prescriptions Selector */}
              {foundPrescriptions.length > 1 && (
                <div style={{ background: '#f1f5f9', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
                  <p style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                    Found {foundPrescriptions.length} prescriptions for this phone number. Select one:
                  </p>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {foundPrescriptions.map((rx) => {
                      const isSelected = selectedRx && String(selectedRx.prescriptionId) === String(rx.prescriptionId)
                      return (
                        <button
                          key={rx.prescriptionId}
                          type="button"
                          className={`pm-button ${isSelected ? 'pm-primary' : ''}`}
                          onClick={async () => {
                            let item = rx
                            if (!item.medicines || item.medicines.length === 0) {
                              try {
                                const full = await getPharmacyPrescription(item.prescriptionId)
                                const d = full?.data || full?.prescription || full || {}
                                const meds = d.medicines || d.items || d.prescriptionItems || []
                                if (Array.isArray(meds) && meds.length > 0) {
                                  item = { ...item, medicines: meds }
                                }
                              } catch {}
                            }
                            setSelectedRx(item)
                            setGenRxId(String(item.prescriptionId || ''))
                          }}
                          style={{ fontSize: '12px' }}
                        >
                          <FiFileText /> Rx #{rx.prescriptionId} · Dr. {rx.doctorName}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Fetched Prescription Details & Live Billing Breakdown */}
              {selectedRx ? (
                <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '16px' }}>
                  {/* Patient & Doctor Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '12px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                        <FiUser style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                        {selectedRx.patientName || 'Walk-in Patient'}
                      </span>
                      {selectedRx.patientAge && (
                        <span style={{ fontSize: '12px', background: '#e2e8f0', padding: '2px 8px', borderRadius: '6px', color: '#475569' }}>
                          {selectedRx.patientAge} yrs {selectedRx.patientGender ? `· ${selectedRx.patientGender}` : ''}
                        </span>
                      )}
                      {selectedRx.patientPhone && (
                        <span style={{ fontSize: '12px', color: '#64748b' }}>
                          <FiPhone style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                          {selectedRx.patientPhone}
                        </span>
                      )}
                      <span style={{ fontSize: '12px', background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: '6px', fontWeight: 600 }}>
                        Rx #{selectedRx.prescriptionId}
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', color: '#64748b' }}>
                      <span>Dr. {selectedRx.doctorName}</span> · <span>{formatDate(selectedRx.prescriptionDate)}</span>
                    </div>
                  </div>

                  {/* Medicines List Table */}
                  <div style={{ overflowX: 'auto', marginBottom: '14px', maxHeight: '220px', overflowY: 'auto' }}>
                    <table className="pm-table" style={{ background: '#ffffff', borderRadius: '8px', fontSize: '13px' }}>
                      <thead>
                        <tr>
                          <th>Medicine</th>
                          <th>Strength</th>
                          <th>Quantity</th>
                          <th>Unit Price</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rxMedicines.length > 0 ? (
                          rxMedicines.map((m, idx) => {
                            const name = m.medicineName || m.name || `Medicine #${idx + 1}`
                            const strength = m.strength || '—'
                            const qty = Number(m.quantity ?? m.qty ?? 1)
                            const price = Number(m.unitPrice ?? m.price ?? m.rate ?? 0)
                            const lineTotal = m.totalAmount ?? m.total ?? (qty * price)

                            return (
                              <tr key={m.id || idx}>
                                <td style={{ fontWeight: 600 }}>{name}</td>
                                <td>{strength}</td>
                                <td>{qty}</td>
                                <td>{formatMoney(price)}</td>
                                <td style={{ fontWeight: 600 }}>{formatMoney(lineTotal)}</td>
                              </tr>
                            )
                          })
                        ) : (
                          <tr>
                            <td colSpan={5} style={{ textAlign: 'center', color: '#64748b', padding: '12px' }}>
                              Prescription item details will be calculated at final billing.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Discount & Net Payable Breakdown */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', background: '#ffffff', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <label className="pm-field" style={{ width: '160px', margin: 0 }}>
                      <span>Discount (%)</span>
                      <div className="pm-input-group">
                        <FiPercent />
                        <input
                          type="number"
                          className="pm-input"
                          min="0"
                          max="100"
                          step="0.5"
                          value={genDiscount}
                          onChange={(e) => setGenDiscount(e.target.value)}
                          placeholder="0"
                        />
                      </div>
                    </label>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', textAlign: 'right' }}>
                      <span style={{ fontSize: '13px', color: '#64748b' }}>
                        Subtotal: <strong>{formatMoney(calculatedSubtotal)}</strong>
                      </span>
                      {discountVal > 0 && (
                        <span style={{ fontSize: '13px', color: '#16a34a', fontWeight: 600 }}>
                          Discount ({discountVal}%): -{formatMoney(discountAmount)}
                        </span>
                      )}
                      <span style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                        Net Payable: {formatMoney(netPayableAmount)}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                !phoneLookupBusy && !phoneLookupError && (
                  <div style={{ textAlign: 'center', padding: '24px 16px', background: '#f8fafc', borderRadius: '10px', border: '1px dashed #cbd5e1' }}>
                    <FiPhone style={{ fontSize: '28px', color: '#94a3b8', marginBottom: '6px' }} />
                    <p style={{ margin: '0 0 4px', fontWeight: 600, color: '#475569', fontSize: '13px' }}>
                      No Prescription Fetched
                    </p>
                    <p style={{ margin: 0, color: '#64748b', fontSize: '12px' }}>
                      Enter a 10-digit mobile number above or click one of the pending patients to fetch prescription details.
                    </p>
                  </div>
                )
              )}

              {/* Modal Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '12px', marginTop: '8px' }}>
                <button
                  type="button"
                  className="pm-button"
                  onClick={() => setShowGenerateModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="pm-button pm-primary"
                  onClick={handleGenerateBill}
                  disabled={genBusy || !selectedRx}
                  style={{ minHeight: '42px', padding: '0 20px', fontWeight: 700 }}
                >
                  <FiCreditCard />
                  {genBusy ? 'Generating Bill...' : 'Generate Bill'}
                </button>
              </div>
            </div>
          </div>
        )}



        {/* Modal: Cancel Bill */}
        {showCancelModal && (
          <div className="pm-modal-overlay" onClick={() => setShowCancelModal(false)}>
            <div className="pm-modal" onClick={(e) => e.stopPropagation()}>
              <div className="pm-modal-header">
                <h2>
                  <FiX /> Cancel Bill #{targetCancelBillId}
                </h2>
                <button
                  type="button"
                  className="pm-modal-close"
                  onClick={() => setShowCancelModal(false)}
                >
                  <FiX />
                </button>
              </div>

              <form onSubmit={handleConfirmCancelBill} className="pm-form-grid">
                <label className="pm-field">
                  <span>Cancellation Reason</span>
                  <input
                    type="text"
                    className="pm-input"
                    placeholder="Enter reason for cancelling this bill..."
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    required
                  />
                </label>

                <div className="pm-actions" style={{ justifyContent: 'flex-end', marginTop: '10px' }}>
                  <button
                    type="button"
                    className="pm-button"
                    onClick={() => setShowCancelModal(false)}
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="pm-button pm-primary"
                    disabled={busy}
                    style={{ background: '#dc2626' }}
                  >
                    {busy ? 'Cancelling...' : 'Confirm Cancellation'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Refund Payment */}
        {showRefundModal && targetRefundBill && (
          <div className="pm-modal-overlay" onClick={() => setShowRefundModal(false)}>
            <div className="pm-modal" onClick={(e) => e.stopPropagation()}>
              <div className="pm-modal-header">
                <h2>
                  <FiDollarSign /> Refund Bill #{targetRefundBill.id || targetRefundBill.billId}
                </h2>
                <button
                  type="button"
                  className="pm-modal-close"
                  onClick={() => setShowRefundModal(false)}
                >
                  <FiX />
                </button>
              </div>

              <form onSubmit={handleConfirmRefund} className="pm-form-grid">
                <label className="pm-field">
                  <span>Refund Amount (₹) *</span>
                  <input
                    type="number"
                    className="pm-input"
                    min="1"
                    step="0.01"
                    value={refundAmountVal}
                    onChange={(e) => setRefundAmountVal(e.target.value)}
                    required
                  />
                </label>

                <label className="pm-field">
                  <span>Refund Reason</span>
                  <input
                    type="text"
                    className="pm-input"
                    placeholder="Enter reason for refund..."
                    value={refundReasonVal}
                    onChange={(e) => setRefundReasonVal(e.target.value)}
                    required
                  />
                </label>

                <div className="pm-actions" style={{ justifyContent: 'flex-end', marginTop: '10px' }}>
                  <button
                    type="button"
                    className="pm-button"
                    onClick={() => setShowRefundModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="pm-button pm-primary"
                    disabled={busy}
                  >
                    {busy ? 'Processing...' : 'Issue Refund'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </PharmacistLayout>
  )
}
