import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { FiArrowRight, FiCamera, FiCheckCircle, FiCreditCard, FiFileText, FiPlus, FiRefreshCw, FiTrash2, FiUpload, FiUser, FiX } from 'react-icons/fi'
import PharmacistLayout from './PharmacistLayout'
import {
  createDispensingDraft,
  updateDispensingDraft,
  listDispensingDrafts,
  submitDispensingDraft,
  uploadDraftPrescriptionPhoto,
  uploadPrescriptionPhoto,
  getDispensingMedicines,
  listMedicines,
  listMedicineStrengths,
  getPharmacistInventory,
  getPharmacistAssignedBranch,
  readMedicineCache,
  recordManualCashPayment,
  pharmacistPrescriptionApi
} from '../../config/api'
import { useToast } from '../../components/ToastProvider'
import { confirmAction } from '../../components/confirmAction'
import { useLanguage } from '../../i18n/language'
import {
  newMedicine,
  newPrescription,
  prescriptionPayload,
  prescriptionTotals,
  savedRecord,
  updateMedicine,
  normalizeMedicineOption,
  filterMedicineMatches,
  filterStrengthMatches,
  extractUniqueStrengths
} from './prescriptionModel'
import usePrescriptionCamera from './usePrescriptionCamera'
import './PrescriptionWorkspace.css'

export async function fetchAvailableMedicines() {
  const currentAssigned = typeof getPharmacistAssignedBranch === 'function' ? getPharmacistAssignedBranch() : null
  const branchId = currentAssigned?.id || currentAssigned?.branchId || ''
  const listParams = { authRole: 'pharmacist' }
  if (branchId) listParams.branchId = branchId

  const [dispensingRes, catalogRes, inventoryRes] = await Promise.allSettled([
    getDispensingMedicines(),
    listMedicines(listParams),
    getPharmacistInventory(branchId ? { branchId } : {})
  ])

  const rawList = []

  if (dispensingRes.status === 'fulfilled') {
    const v = dispensingRes.value
    const items = v?.data?.medicines || v?.medicines || v?.data?.items || v?.items || v?.data || (Array.isArray(v) ? v : [])
    if (Array.isArray(items)) rawList.push(...items)
  }

  if (catalogRes.status === 'fulfilled') {
    const v = catalogRes.value
    const items = v?.data?.medicines || v?.medicines || v?.data?.items || v?.items || v?.data || (Array.isArray(v) ? v : [])
    if (Array.isArray(items)) rawList.push(...items)
  }

  if (inventoryRes.status === 'fulfilled') {
    const v = inventoryRes.value
    const items = v?.data?.items || v?.items || v?.data?.inventory || v?.inventory || v?.data || (Array.isArray(v) ? v : [])
    if (Array.isArray(items)) rawList.push(...items)
  }

  try {
    const cache = typeof readMedicineCache === 'function' ? readMedicineCache() : {}
    if (cache && typeof cache === 'object') {
      rawList.push(...Object.values(cache))
    }
  } catch {}

  const mapByName = new Map()
  for (const raw of rawList) {
    const norm = normalizeMedicineOption(raw)
    if (!norm) continue
    const key = norm.name.trim().toLowerCase()
    if (!mapByName.has(key)) {
      mapByName.set(key, norm)
    } else {
      const existing = mapByName.get(key)
      mapByName.set(key, {
        ...existing,
        ...norm,
        strength: norm.strength || existing.strength,
        unitPrice: norm.unitPrice !== '' ? norm.unitPrice : existing.unitPrice,
        stock: norm.stock != null ? norm.stock : existing.stock,
      })
    }
  }

  return Array.from(mapByName.values()).sort((a, b) => a.name.localeCompare(b.name))
}

function highlightMatch(text, query) {
  if (!query || !text) return text
  const q = String(query).trim()
  if (!q) return text
  const lowerText = text.toLowerCase()
  const lowerQ = q.toLowerCase()
  const index = lowerText.indexOf(lowerQ)
  if (index === -1) return text
  return (
    <>
      {text.slice(0, index)}
      <strong className="rx-autocomplete-match">{text.slice(index, index + q.length)}</strong>
      {text.slice(index + q.length)}
    </>
  )
}

function Photo({ file, alt = 'Prescription image' }) {
  const image = useRef(null)
  useEffect(() => {
    if (!file) return
    const url = URL.createObjectURL(file)
    if (image.current) image.current.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])
  return file ? <img ref={image} alt={alt} /> : null
}

export default function PrescriptionWorkspace() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { showToast } = useToast()
  const language = useLanguage()
  const [draft, setDraft] = useState(newPrescription)
  const latest = useRef(draft)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [photoLoading, setPhotoLoading] = useState(false)
  const [medicinePage, setMedicinePage] = useState(0)
  const inFlight = useRef(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [facing, setFacing] = useState('environment')
  const [references, setReferences] = useState(null)
  const [referencePreview, setReferencePreview] = useState(null)
  const upload = useRef(null)
  const nativeCamera = useRef(null)
  const { attachVideo, active: cameraActive, starting: cameraStarting, error: cameraError, start: openCamera, stop: stopCamera, capture: capturePhoto } = usePrescriptionCamera(attachPhoto)
  const locked = Boolean(draft.prescriptionId)
  const payment = params.get('step') === 'payment' && Boolean(draft.billId) && draft.billAmount != null
  const medicinesStep = params.get('step') === 'medicines'
  const activeStep = payment ? 2 : medicinesStep ? 1 : 0
  const pageCount = Math.max(1, Math.ceil(draft.medicines.length / 3))
  const visiblePage = Math.min(medicinePage, pageCount - 1)
  const totals = prescriptionTotals(draft.medicines)
  const amountDue = draft.billAmount ?? totals.amount
  const currency = (amount) => new Intl.NumberFormat(language === 'te' ? 'te-IN' : 'en-IN', { style: 'currency', currency: 'INR' }).format(amount)

  function change(next) {
    const value = typeof next === 'function' ? next(latest.current) : next
    latest.current = value
    setDraft(value)
  }

  const [availableMeds, setAvailableMeds] = useState([])
  const [availableStrengths, setAvailableStrengths] = useState([])
  const [activeAutocompleteRow, setActiveAutocompleteRow] = useState(null)
  const [focusedOptionIndex, setFocusedOptionIndex] = useState(-1)
  const [activeStrengthRow, setActiveStrengthRow] = useState(null)
  const [focusedStrengthIndex, setFocusedStrengthIndex] = useState(-1)

  useEffect(() => {
    function handleClickOutside(event) {
      if (!event.target.closest('.rx-autocomplete-wrapper')) {
        setActiveAutocompleteRow(null)
        setFocusedOptionIndex(-1)
        setActiveStrengthRow(null)
        setFocusedStrengthIndex(-1)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function getMatchingMedicines(queryStr) {
    return filterMedicineMatches(queryStr, availableMeds)
  }

  function getMatchingStrengths(queryStr, currentMedicineName) {
    return filterStrengthMatches(queryStr, availableStrengths, currentMedicineName, availableMeds)
  }

  function selectMedicineOption(rowKey, medicine) {
    change((current) => ({
      ...current,
      medicines: current.medicines.map((item) => {
        if (item.key !== rowKey) return item
        let updated = updateMedicine(item, 'medicineName', medicine.name)
        if (medicine.strength) {
          updated = updateMedicine(updated, 'strength', medicine.strength)
        }
        if (medicine.unitPrice !== '' && medicine.unitPrice != null) {
          updated = updateMedicine(updated, 'unitPrice', String(medicine.unitPrice))
        }
        return updated
      })
    }))
    setActiveAutocompleteRow(null)
    setFocusedOptionIndex(-1)
  }

  function selectStrengthOption(rowKey, strengthItem) {
    const strengthVal = typeof strengthItem === 'string' ? strengthItem : strengthItem.strength
    change((current) => ({
      ...current,
      medicines: current.medicines.map((item) => {
        if (item.key !== rowKey) return item
        let updated = updateMedicine(item, 'strength', strengthVal)
        if (item.medicineName && Array.isArray(availableMeds)) {
          const match = availableMeds.find((m) =>
            String(m.name || m.medicineName || '').trim().toLowerCase() === item.medicineName.trim().toLowerCase() &&
            String(m.strength || m.power || '').trim().toLowerCase() === strengthVal.trim().toLowerCase()
          )
          if (match) {
            const price = match.sellingPrice || match.unitPrice || match.price || match.costPrice
            if (price != null && price !== '') {
              updated = updateMedicine(updated, 'unitPrice', String(price))
            }
          }
        }
        return updated
      })
    }))
    setActiveStrengthRow(null)
    setFocusedStrengthIndex(-1)
  }

  useEffect(() => {
    let active = true
    async function initWorkspace() {
      try {
        const [draftsRes, medsList, strengthsRes] = await Promise.allSettled([
          listDispensingDrafts(),
          fetchAvailableMedicines(),
          listMedicineStrengths(),
        ])
        if (!active) return
        if (draftsRes.status === 'fulfilled') {
          const list = draftsRes.value?.data || draftsRes.value?.drafts || (Array.isArray(draftsRes.value) ? draftsRes.value : [])
          if (Array.isArray(list) && list.length > 0 && !draft.prescriptionId && !draft.patient.patientName) {
            const latestDraft = list[0]
            if (latestDraft?.id || latestDraft?.draftId) {
              const dId = String(latestDraft.id || latestDraft.draftId)
              const mappedPatient = {
                patientName: latestDraft.patientName || latestDraft.patient?.name || '',
                patientId: latestDraft.patientId || latestDraft.patient?.id || '',
                patientAge: latestDraft.patientAge || latestDraft.age || '',
                patientGender: latestDraft.patientGender || latestDraft.gender || '',
                patientPhone: latestDraft.patientPhone || latestDraft.phone || '',
                doctorName: latestDraft.doctorName || latestDraft.doctor || '',
                prescriptionDate: latestDraft.prescriptionDate || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
                notes: latestDraft.notes || '',
              }
              const mappedMeds = Array.isArray(latestDraft.medicines) && latestDraft.medicines.length > 0
                ? latestDraft.medicines.map((m) => ({
                    ...newMedicine(),
                    medicineName: m.medicineName || m.name || '',
                    strength: m.strength || '',
                    quantity: String(m.quantity || ''),
                    unitPrice: String(m.unitPrice || m.price || ''),
                    days: String(m.days || '1'),
                    morning: String(m.morning || ''),
                    afternoon: String(m.afternoon || ''),
                    evening: String(m.evening || ''),
                  }))
                : [newMedicine()]

              change((current) => ({
                ...current,
                draftId: dId,
                patient: { ...current.patient, ...mappedPatient },
                medicines: mappedMeds,
              }))
            }
          }
        }
        const allMeds = medsList.status === 'fulfilled' && Array.isArray(medsList.value) ? medsList.value : []
        const apiStrengths = strengthsRes.status === 'fulfilled' ? strengthsRes.value : []
        if (allMeds.length > 0) {
          setAvailableMeds(allMeds)
        }
        setAvailableStrengths(extractUniqueStrengths(allMeds, apiStrengths))
      } catch (failure) {
        if (active) setNotice(failure.message)
      } finally {
        if (active) setLoading(false)
      }
    }
    initWorkspace()

    function handleSync() {
      fetchAvailableMedicines().then((meds) => {
        if (active && Array.isArray(meds) && meds.length > 0) {
          setAvailableMeds(meds)
          setAvailableStrengths((prev) => extractUniqueStrengths(meds, prev))
        }
      })
    }
    window.addEventListener('pms:medicines-updated', handleSync)
    window.addEventListener('pms:stock-updated', handleSync)
    window.addEventListener('storage', handleSync)

    return () => {
      active = false
      window.removeEventListener('pms:medicines-updated', handleSync)
      window.removeEventListener('pms:stock-updated', handleSync)
      window.removeEventListener('storage', handleSync)
    }
  }, [])

  async function attachPhoto(file) {
    if (!file) return
    setError('')
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) { setError('Choose a JPG, PNG, or WebP image smaller than 10 MB.'); return }
    setPhotoLoading(true)
    const url = URL.createObjectURL(file)
    try {
      const image = new Image()
      image.src = url
      await image.decode()
      change((current) => ({ ...current, photo: file }))
      stopCamera()

      // If server draft exists, immediately sync photo to server API
      if (latest.current.draftId) {
        try {
          await uploadDraftPrescriptionPhoto(latest.current.draftId, file)
        } catch {}
      }
    } catch { setError('The selected file could not be opened as an image.') }
    finally { URL.revokeObjectURL(url); setPhotoLoading(false) }
  }

  function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) { nativeCamera.current.click(); return }
    openCamera(facing)
  }

  async function saveDraft() {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setError('')
    try {
      const current = latest.current
      const payload = prescriptionPayload(current)
      let draftId = current.draftId
      if (draftId) {
        await updateDispensingDraft(draftId, payload)
      } else {
        const created = await createDispensingDraft(payload)
        const id = created?.draftId || created?.id || created?.data?.draftId || created?.data?.id
        if (id) {
          draftId = String(id)
          change((prev) => ({ ...prev, draftId }))
        }
      }
      if (draftId && current.photo instanceof File) {
        try {
          await uploadDraftPrescriptionPhoto(draftId, current.photo)
        } catch (photoErr) {
          console.warn('Draft photo upload warning:', photoErr.message)
        }
      }
      setNotice('Draft saved to server.')
      showToast('Draft saved successfully.')
    } catch (failure) {
      setError(failure.message || 'Unable to save draft.')
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  async function proceed(event) {
    event.preventDefault()
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setError('')
    stopCamera()
    try {
      let current = latest.current
      const payload = prescriptionPayload(current)

      // 1. Ensure server draft is saved/updated
      let draftId = current.draftId
      if (!draftId) {
        try {
          const created = await createDispensingDraft(payload)
          draftId = String(created?.draftId || created?.id || created?.data?.draftId || created?.data?.id || '')
          if (draftId) {
            current = { ...current, draftId }
            change(current)
          }
        } catch {}
      } else {
        try {
          await updateDispensingDraft(draftId, payload)
        } catch {}
      }

      // 2. Submit draft to server to generate prescription and bill
      if (draftId && !current.prescriptionId) {
        try {
          const submitted = await submitDispensingDraft(draftId, payload)
          const rxId = submitted?.prescriptionId || submitted?.id || submitted?.data?.prescriptionId
          const bId = submitted?.billId || submitted?.bill?.id || submitted?.data?.billId
          const amount = submitted?.billAmount || submitted?.totalAmount || submitted?.bill?.totalAmount || submitted?.data?.totalAmount
          if (rxId) current = { ...current, prescriptionId: String(rxId) }
          if (bId) current = { ...current, billId: String(bId) }
          if (amount != null && !isNaN(Number(amount))) current = { ...current, billAmount: Number(amount) }
          change(current)
        } catch (submitErr) {
          console.warn('Submit draft fallback:', submitErr.message)
        }
      }

      // 3. Fallback to direct create/bill if submit was not applicable
      if (!current.prescriptionId) {
        const prescription = savedRecord(await pharmacistPrescriptionApi.create(payload), 'prescription')
        current = { ...current, prescriptionId: prescription.id }
        change(current)
      }

      if (!current.billId) {
        const bill = savedRecord(await pharmacistPrescriptionApi.bill({ ...payload, prescriptionId: current.prescriptionId, totalAmount: prescriptionTotals(current.medicines).amount, clientRequestId: `${current.requestId}:bill` }), 'bill')
        const rawAmount = bill.totalAmount ?? bill.grandTotal ?? bill.amount ?? bill.total
        const validAmount = rawAmount != null && Number.isFinite(Number(rawAmount)) && Number(rawAmount) >= 0
        current = { ...current, billId: bill.id, billAmount: validAmount ? Number(rawAmount) : null }
        change(current)
      }

      // 4. Attach photo to prescription on server if photo exists
      if (current.photo instanceof File && current.prescriptionId) {
        try {
          await uploadPrescriptionPhoto(current.prescriptionId, current.photo)
        } catch (photoErr) {
          console.warn('Prescription photo upload warning:', photoErr.message)
        }
      }

      const phoneParam = encodeURIComponent(current.patient?.patientPhone || '')
      if (current.billId) {
        showToast('Prescription saved and bill generated! Redirecting to Bills & Payments...')
        navigate(`/pharmacist/bills?billId=${current.billId}${phoneParam ? `&phone=${phoneParam}` : ''}`)
        return
      }
      if (current.prescriptionId) {
        showToast('Prescription saved! Redirecting to Bills & Payments...')
        navigate(`/pharmacist/bills?rxId=${current.prescriptionId}${phoneParam ? `&phone=${phoneParam}` : ''}`)
        return
      }
      navigate(`/pharmacist/bills${phoneParam ? `?phone=${phoneParam}` : ''}`)
    } catch (failure) {
      const msg = failure.message || 'Unable to prepare this prescription for payment.'
      setError(msg)
      showToast(msg, 'error')
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  async function nextStep(event) {
    if (medicinesStep) return proceed(event)
    event.preventDefault()
    if (!draft.patient.patientName.trim() || !draft.patient.doctorName.trim()) { setError('Enter the patient name and doctor name.'); return }
    const phone = String(draft.patient.patientPhone || '').trim()
    if (!phone || !/^\d{10}$/.test(phone)) {
      setError('Patient phone number is required and must be exactly 10 digits.')
      return
    }
    setError('')
    setBusy(true)
    stopCamera()
    try {
      // Save draft to server
      const payload = prescriptionPayload(latest.current)
      if (latest.current.draftId) {
        await updateDispensingDraft(latest.current.draftId, payload)
      } else {
        const created = await createDispensingDraft(payload)
        const id = created?.draftId || created?.id || created?.data?.draftId || created?.data?.id
        if (id) change((prev) => ({ ...prev, draftId: String(id) }))
      }
      navigate('/pharmacist/dispensing?step=medicines')
    } catch (failure) {
      navigate('/pharmacist/dispensing?step=medicines')
    } finally {
      setBusy(false)
    }
  }

  async function pay(event) {
    event.preventDefault()
    if (inFlight.current || latest.current.paymentComplete) return
    inFlight.current = true
    setBusy(true)
    setError('')
    try {
      const current = latest.current
      if (!current.billId || current.billAmount == null || !Number.isFinite(current.billAmount)) throw new Error('A confirmed bill is required before recording payment.')
      if (current.paymentMethod !== 'Cash' && !current.transactionReference.trim()) throw new Error('Enter the confirmed payment transaction reference.')

      if (current.paymentMethod === 'Cash') {
        await recordManualCashPayment({
          billId: current.billId,
          amount: current.billAmount,
          paymentMethod: 'Cash',
          paymentMode: 'Cash',
          notes: `Dispensing cash payment for prescription ${current.prescriptionId || ''}`,
          clientRequestId: `${current.requestId}:payment`,
        })
      } else {
        await pharmacistPrescriptionApi.pay({
          prescriptionId: current.prescriptionId,
          billId: current.billId,
          amount: current.billAmount,
          paymentMethod: current.paymentMethod,
          paymentMode: current.paymentMethod,
          transactionReference: current.transactionReference.trim(),
          clientRequestId: `${current.requestId}:payment`,
        })
      }

      const completed = { ...current, paymentComplete: true }
      change(completed)
      showToast('Payment recorded successfully!')
    } catch (failure) {
      setError(failure.message || 'Unable to record payment.')
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  async function startNew() {
    if (!draft.paymentComplete && (draft.patient.patientName || draft.photo || draft.medicines.some((row) => row.medicineName)) && !await confirmAction('Start a new prescription? Save your draft first to keep unfinished changes.', { title: 'New Prescription', confirmLabel: 'Continue' })) return
    change(newPrescription())
    stopCamera()
    setError('')
    setNotice('')
    setReferencePreview(null)
    navigate('/pharmacist/dispensing')
  }

  async function showReferences() {
    try {
      if (references) {
        setReferences(null)
      } else {
        const response = await listDispensingDrafts()
        const drafts = response?.data || response?.drafts || (Array.isArray(response) ? response : [])
        setReferences(drafts)
      }
    } catch (failure) {
      setError(failure.message)
    }
  }

  function patientField(key, label, type = 'text', extra = {}) {
    return <label className="rx-field" key={key}><span>{label}{extra.required ? ' *' : ''}</span><input name={key} type={type} value={draft.patient[key]} onChange={(event) => change((current) => ({ ...current, patient: { ...current.patient, [key]: event.target.value } }))} {...extra} /></label>
  }

  function medicinePagination() {
    return pageCount > 1 ? <nav className="rx-pagination" aria-label="Medicine pages"><button type="button" disabled={busy || visiblePage === 0} onClick={() => setMedicinePage(visiblePage - 1)}>Previous</button><span>Page {visiblePage + 1} / {pageCount}</span><button type="button" disabled={busy || visiblePage === pageCount - 1} onClick={() => setMedicinePage(visiblePage + 1)}>Next</button></nav> : null
  }

  return <PharmacistLayout activeLabel="Dispensing">
    <div className="rx-workspace">
      <header className="rx-heading"><div><p className="rx-breadcrumb">Pharmacist / Dispensing</p><h1>{payment ? 'Payment & Billing' : 'New Prescription & Medicines'}</h1><p>{payment ? 'Review the bill and record the confirmed payment.' : 'Add patient details, attach the prescription, and enter medicines as prescribed.'}</p></div><div className="rx-heading-actions">{locked ? <button type="button" disabled={busy} onClick={startNew}>New Prescription</button> : null}<button type="button" onClick={showReferences}>Saved References</button></div></header>
      <ol className="rx-stepper" aria-label="Prescription progress">{['Patient & Prescription', 'Add Medicines', 'Payment'].map((label, index) => <li key={label} className={(index === activeStep) ? 'is-active' : ''} aria-current={(index === activeStep) ? 'step' : undefined} onClick={() => {
        if (index === 0) navigate('/pharmacist/dispensing')
        else if (index === 1) navigate('/pharmacist/dispensing?step=medicines')
        else if (index === 2) {
          if (draft.billId) navigate(`/pharmacist/bills?billId=${draft.billId}`)
          else navigate('/pharmacist/bills')
        }
      }} style={{ cursor: 'pointer' }}><b>{index + 1}</b>{label}</li>)}</ol>
      {error ? <p className="rx-message rx-error" role="alert">{error}</p> : null}
      {notice ? <p className="rx-message" role="status">{notice}</p> : null}
      {references ? <section className="rx-card rx-references"><h2>Saved References</h2><p>Prescriptions and drafts saved on the server.</p>{references.length ? references.map((record, idx) => {
        const itemDraft = record.draft || record
        const pName = itemDraft.patient?.patientName || itemDraft.patientName || itemDraft.patient?.name || `Draft #${record.id || idx + 1}`
        const pDate = itemDraft.patient?.prescriptionDate || itemDraft.prescriptionDate || itemDraft.createdAt || ''
        return <button key={record.id || record.draftId || record.key || idx} type="button" onClick={() => setReferencePreview(itemDraft)}><FiFileText /><span translate="no">{pName}</span><span>{pDate}</span></button>
      }) : <p>No saved prescription references yet.</p>}</section> : null}
      {referencePreview ? <section className="rx-card rx-reference-preview"><header><h2>Prescription Reference</h2><button type="button" onClick={() => setReferencePreview(null)} aria-label="Close"><FiX /></button></header><p translate="no">{referencePreview.patient?.patientName || referencePreview.patientName || 'Patient'} · {referencePreview.patient?.doctorName || referencePreview.doctorName || ''}</p>{referencePreview.photo ? <Photo file={referencePreview.photo} /> : <p>No prescription photo attached.</p>}<p><span>Prescription ID</span>: {referencePreview.prescriptionId || referencePreview.id || 'Draft'}</p></section> : null}
      {loading ? <p role="status">Loading prescription draft...</p> : draft.paymentComplete ? <section className="rx-card rx-complete"><FiCheckCircle /><h2>Payment recorded successfully!</h2><p><span>Bill ID</span>: <span translate="no">{draft.billId}</span></p><strong>{currency(amountDue)}</strong><p>{draft.photo ? 'Your prescription photo is saved on this device for reference.' : 'Your prescription has been saved.'}</p><div className="rx-heading-actions"><Link to="/pharmacist/bills">View Bills</Link><button className="rx-primary" type="button" onClick={startNew}>New Prescription</button></div></section> : payment ? <form className="rx-payment-grid" onSubmit={pay}>
        <section className="rx-card"><h2><FiFileText />Bill Summary</h2><p translate="no">{draft.patient.patientName} · {draft.patient.patientPhone}</p><p><span>Bill ID</span>: <span translate="no">{draft.billId}</span></p><div className="rx-summary-lines">{draft.medicines.slice(visiblePage * 3, visiblePage * 3 + 3).map((row, localIndex) => <div key={row.key}><span translate="no">{row.medicineName}</span><span>{row.quantity} × {currency(Number(row.unitPrice))}</span><strong>{currency(totals.lines[visiblePage * 3 + localIndex])}</strong></div>)}</div>{medicinePagination()}<div className="rx-totals"><strong>Total payable</strong><strong>{currency(amountDue)}</strong></div>{amountDue !== totals.amount ? <p>The final amount is calculated by the billing service.</p> : null}</section>
        <section className="rx-card"><h2><FiCreditCard />Payment</h2><fieldset disabled={busy}><label className="rx-field"><span>Payment Method</span><select value={draft.paymentMethod} onChange={(event) => change((current) => ({ ...current, paymentMethod: event.target.value }))}>{['Cash', 'UPI', 'Card'].map((method) => <option key={method} value={method}>{method}</option>)}</select></label>{draft.paymentMethod !== 'Cash' ? <label className="rx-field"><span>Transaction Reference *</span><input required value={draft.transactionReference} onChange={(event) => change((current) => ({ ...current, transactionReference: event.target.value }))} /></label> : null}<p>Record payment only after cash is received or the card / UPI transaction is confirmed.</p><div className="rx-payment-amount">{currency(amountDue)}</div><button className="rx-primary" type="submit">{busy ? 'Recording payment...' : 'Confirm Payment'}</button></fieldset><button disabled={busy} type="button" onClick={() => navigate('/pharmacist/dispensing?step=medicines')}>Back to Prescription</button></section>
      </form> : <form onSubmit={nextStep}>
        {locked ? <p className="rx-message">Prescription saved. Review the details below or continue to payment. Start a new prescription to change medicines.</p> : null}
        {!medicinesStep && <div className="rx-details-grid">
          <section className="rx-card"><h2><FiUser />Patient Details</h2><fieldset disabled={busy || locked}><div className="rx-patient-grid">
            {patientField('patientName', 'Patient Name', 'text', { required: true, maxLength: 150 })}
            {patientField('patientId', 'Patient ID', 'text', { maxLength: 80, placeholder: 'Optional' })}
            {patientField('patientAge', 'Age', 'number', { min: 0, max: 130, step: 1 })}
            <label className="rx-field"><span>Gender</span><select value={draft.patient.patientGender} onChange={(event) => change((current) => ({ ...current, patient: { ...current.patient, patientGender: event.target.value } }))}><option value="">Select</option>{['Female', 'Male', 'Other'].map((gender) => <option key={gender} value={gender}>{gender}</option>)}</select></label>
            {patientField('patientPhone', 'Phone Number', 'tel', { required: true, inputMode: 'numeric', maxLength: 10, pattern: '[0-9]{10}', placeholder: 'Enter 10-digit mobile number' })}
            {patientField('doctorName', 'Doctor Name', 'text', { required: true, maxLength: 150 })}
            {patientField('prescriptionDate', 'Prescription Date', 'date', { required: true })}
            <label className="rx-field"><span>Notes</span><textarea rows={2} maxLength={2000} value={draft.patient.notes} onChange={(event) => change((current) => ({ ...current, patient: { ...current.patient, notes: event.target.value } }))} /></label>
          </div></fieldset></section>
          <section className="rx-card rx-photo-card"><h2><FiCamera />Prescription Photo</h2><div className="rx-camera-frame"><video ref={attachVideo} autoPlay muted playsInline hidden={!cameraActive} />{!cameraActive && (draft.photo ? <Photo file={draft.photo} /> : <div className="rx-camera-empty"><FiCamera /><strong>Capture a prescription photo</strong><p>Use the camera or upload an image for reference.</p></div>)}{cameraActive ? <span className="rx-camera-ready">Camera ready</span> : null}</div>
            <div className="rx-photo-actions">{cameraActive ? <><button className="rx-primary" type="button" onClick={capturePhoto}><FiCamera />Capture Photo</button><button type="button" onClick={() => { const next = facing === 'environment' ? 'user' : 'environment'; setFacing(next); openCamera(next) }}><FiRefreshCw />Switch Camera</button><button type="button" onClick={stopCamera}>Cancel</button></> : <><button type="button" disabled={busy || locked || cameraStarting || photoLoading} onClick={startCamera}><FiCamera />{cameraStarting ? 'Opening camera...' : draft.photo ? 'Retake' : 'Take Photo'}</button><button type="button" disabled={busy || locked || photoLoading} onClick={() => upload.current.click()}><FiUpload />Upload Image</button>{draft.photo ? <button type="button" disabled={busy || locked} aria-label="Remove prescription photo" onClick={() => change((current) => ({ ...current, photo: null }))}><FiTrash2 /></button> : null}</>}</div>
            <input ref={upload} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { attachPhoto(event.target.files?.[0]); event.target.value = '' }} /><input ref={nativeCamera} hidden type="file" accept="image/*" capture="environment" onChange={(event) => { attachPhoto(event.target.files?.[0]); event.target.value = '' }} />
            {cameraError ? <p className="rx-error" role="alert">{cameraError}</p> : null}{draft.photo ? <p className="rx-attached"><FiCheckCircle /><span translate="no">{draft.photo.name}</span></p> : null}<small>Photos are saved on this device with the prescription reference. JPG, PNG or WebP, up to 10 MB.</small>
          </section>
        </div>}
        {medicinesStep && <section className="rx-card rx-medicines"><header><div><h2><FiFileText />Add Medicines Manually</h2><p>Enter medicines and dose schedules exactly as prescribed by the doctor.</p></div><button type="button" disabled={busy || locked} onClick={() => { change((current) => ({ ...current, medicines: [...current.medicines, newMedicine()] })); setMedicinePage(Math.floor(draft.medicines.length / 3)) }}><FiPlus />Add Medicine</button></header>
          <fieldset disabled={busy || locked}><div className="rx-table-scroll"><table><thead><tr>{['Medicine Name', 'Strength', 'Morning', 'Afternoon', 'Evening', 'Duration (days)', 'Quantity', 'Unit Price', 'Amount', 'Actions'].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead><tbody>{draft.medicines.slice(visiblePage * 3, visiblePage * 3 + 3).map((row, localIndex) => {
            const index = visiblePage * 3 + localIndex
            const isThisRowActive = activeAutocompleteRow === row.key
            const rowMatches = isThisRowActive ? getMatchingMedicines(row.medicineName) : []
            const showDropdown = isThisRowActive && rowMatches.length > 0

            return <tr key={row.key}>{['medicineName', 'strength', 'morning', 'afternoon', 'evening', 'days', 'quantity', 'unitPrice'].map((field) => {
              if (field === 'medicineName') {
                return (
                  <td key={field} className="rx-med-name-cell">
                    <div className="rx-autocomplete-wrapper">
                      <input
                        aria-label={`${field} ${index + 1}`}
                        type="text"
                        required
                        maxLength={200}
                        autoComplete="off"
                        placeholder="Enter medicine name"
                        list={`rx-med-options-${row.key}`}
                        value={row.medicineName}
                        onFocus={() => {
                          setActiveAutocompleteRow(row.key)
                          setActiveStrengthRow(null)
                          setFocusedOptionIndex(-1)
                        }}
                        onKeyDown={(event) => {
                          if (!showDropdown || rowMatches.length === 0) {
                            if (event.key === 'ArrowDown' && availableMeds.length > 0) {
                              setActiveAutocompleteRow(row.key)
                            }
                            return
                          }
                          if (event.key === 'ArrowDown') {
                            event.preventDefault()
                            setFocusedOptionIndex((prev) => (prev + 1) % rowMatches.length)
                          } else if (event.key === 'ArrowUp') {
                            event.preventDefault()
                            setFocusedOptionIndex((prev) => (prev - 1 + rowMatches.length) % rowMatches.length)
                          } else if (event.key === 'Enter') {
                            if (focusedOptionIndex >= 0 && focusedOptionIndex < rowMatches.length) {
                              event.preventDefault()
                              selectMedicineOption(row.key, rowMatches[focusedOptionIndex])
                            }
                          } else if (event.key === 'Escape') {
                            event.preventDefault()
                            setActiveAutocompleteRow(null)
                            setFocusedOptionIndex(-1)
                          }
                        }}
                        onChange={(event) => {
                          const val = event.target.value
                          setActiveAutocompleteRow(row.key)
                          setFocusedOptionIndex(-1)
                          let matchedPrice = null
                          let matchedStrength = null
                          if (Array.isArray(availableMeds) && availableMeds.length > 0) {
                            const match = availableMeds.find((m) => String(m.name || m.medicineName || '').trim().toLowerCase() === val.trim().toLowerCase())
                            if (match) {
                              matchedPrice = match.sellingPrice || match.unitPrice || match.price || match.costPrice
                              matchedStrength = match.strength || match.power || match.dosageForm
                            }
                          }
                          change((current) => ({
                            ...current,
                            medicines: current.medicines.map((medicine) => {
                              if (medicine.key !== row.key) return medicine
                              let updated = updateMedicine(medicine, field, val)
                              if (matchedPrice != null && matchedPrice !== '') updated = updateMedicine(updated, 'unitPrice', String(matchedPrice))
                              if (matchedStrength) updated = updateMedicine(updated, 'strength', String(matchedStrength))
                              return updated
                            })
                          }))
                        }}
                      />
                      {showDropdown && (
                        <ul className="rx-autocomplete-dropdown" role="listbox" id={`rx-med-list-${row.key}`}>
                          {rowMatches.map((med, mIdx) => {
                            const isFocused = mIdx === focusedOptionIndex
                            return (
                              <li
                                key={med.id || med.name || mIdx}
                                role="option"
                                aria-selected={isFocused}
                                className={`rx-autocomplete-item ${isFocused ? 'is-focused' : ''}`}
                                onMouseDown={(e) => {
                                  e.preventDefault()
                                  selectMedicineOption(row.key, med)
                                }}
                                onMouseEnter={() => setFocusedOptionIndex(mIdx)}
                              >
                                <div className="rx-autocomplete-main">
                                  <span className="rx-autocomplete-name">
                                    {highlightMatch(med.name, row.medicineName)}
                                  </span>
                                  {med.category ? <span className="rx-autocomplete-category">{med.category}</span> : null}
                                </div>
                                <div className="rx-autocomplete-details">
                                  {med.strength ? <span className="rx-autocomplete-strength">{med.strength}</span> : null}
                                  {med.unitPrice ? <span className="rx-autocomplete-price">₹{med.unitPrice}</span> : null}
                                  {med.stock != null ? (
                                    <span className={`rx-autocomplete-stock ${med.stock <= 5 ? 'is-low' : ''}`}>
                                      {med.stock > 0 ? `${med.stock} in stock` : 'Out of stock'}
                                    </span>
                                  ) : null}
                                </div>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                      {Array.isArray(availableMeds) && availableMeds.length > 0 && (
                        <datalist id={`rx-med-options-${row.key}`}>
                          {availableMeds.map((m, mIdx) => <option key={m.id || m.medicineId || mIdx} value={m.name || m.medicineName} />)}
                        </datalist>
                      )}
                    </div>
                  </td>
                )
              }

              if (field === 'strength') {
                const query = (row.strength || '').trim()
                const isThisRowActive = activeStrengthRow === row.key
                const strengthMatches = isThisRowActive ? getMatchingStrengths(query, row.medicineName) : []
                const showStrengthDropdown = isThisRowActive && strengthMatches.length > 0

                return (
                  <td key={field} className="rx-strength-cell">
                    <div className="rx-autocomplete-wrapper">
                      <input
                        aria-label={`${field} ${index + 1}`}
                        type="text"
                        maxLength={100}
                        autoComplete="off"
                        placeholder="As prescribed"
                        list={`rx-strength-options-${row.key}`}
                        value={row.strength}
                        onFocus={() => {
                          setActiveStrengthRow(row.key)
                          setActiveAutocompleteRow(null)
                          setFocusedStrengthIndex(-1)
                        }}
                        onKeyDown={(event) => {
                          if (!showStrengthDropdown || strengthMatches.length === 0) {
                            if (event.key === 'ArrowDown' && availableStrengths.length > 0) {
                              setActiveStrengthRow(row.key)
                            }
                            return
                          }
                          if (event.key === 'ArrowDown') {
                            event.preventDefault()
                            setFocusedStrengthIndex((prev) => (prev + 1) % strengthMatches.length)
                          } else if (event.key === 'ArrowUp') {
                            event.preventDefault()
                            setFocusedStrengthIndex((prev) => (prev - 1 + strengthMatches.length) % strengthMatches.length)
                          } else if (event.key === 'Enter') {
                            if (focusedStrengthIndex >= 0 && focusedStrengthIndex < strengthMatches.length) {
                              event.preventDefault()
                              selectStrengthOption(row.key, strengthMatches[focusedStrengthIndex])
                            }
                          } else if (event.key === 'Escape') {
                            event.preventDefault()
                            setActiveStrengthRow(null)
                            setFocusedStrengthIndex(-1)
                          }
                        }}
                        onChange={(event) => {
                          const val = event.target.value
                          setActiveStrengthRow(row.key)
                          setFocusedStrengthIndex(-1)
                          change((current) => ({
                            ...current,
                            medicines: current.medicines.map((medicine) => {
                              if (medicine.key !== row.key) return medicine
                              let updated = updateMedicine(medicine, field, val)
                              if (medicine.medicineName && Array.isArray(availableMeds)) {
                                const match = availableMeds.find((m) =>
                                  String(m.name || m.medicineName || '').trim().toLowerCase() === medicine.medicineName.trim().toLowerCase() &&
                                  String(m.strength || m.power || '').trim().toLowerCase() === val.trim().toLowerCase()
                                )
                                if (match) {
                                  const price = match.sellingPrice || match.unitPrice || match.price || match.costPrice
                                  if (price != null && price !== '') {
                                    updated = updateMedicine(updated, 'unitPrice', String(price))
                                  }
                                }
                              }
                              return updated
                            })
                          }))
                        }}
                      />
                      {showStrengthDropdown && (
                        <ul className="rx-autocomplete-dropdown rx-strength-dropdown" role="listbox" id={`rx-strength-list-${row.key}`}>
                          {strengthMatches.map((item, sIdx) => {
                            const isFocused = sIdx === focusedStrengthIndex
                            return (
                              <li
                                key={`${item.strength}-${sIdx}`}
                                role="option"
                                aria-selected={isFocused}
                                className={`rx-autocomplete-item ${isFocused ? 'is-focused' : ''}`}
                                onMouseDown={(e) => {
                                  e.preventDefault()
                                  selectStrengthOption(row.key, item)
                                }}
                                onMouseEnter={() => setFocusedStrengthIndex(sIdx)}
                              >
                                <div className="rx-autocomplete-main">
                                  <span className="rx-autocomplete-name">
                                    {highlightMatch(item.strength, row.strength)}
                                  </span>
                                  {item.isSpecific ? (
                                    <span className="rx-autocomplete-category" style={{ color: '#168250', fontWeight: 600 }}>
                                      {row.medicineName ? `Prescribed for ${row.medicineName}` : 'Uploaded'}
                                    </span>
                                  ) : null}
                                </div>
                                <div className="rx-autocomplete-details">
                                  {item.unitPrice ? <span className="rx-autocomplete-price">₹{item.unitPrice}</span> : null}
                                  <span className="rx-autocomplete-strength">{item.strength}</span>
                                </div>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                      {Array.isArray(availableStrengths) && availableStrengths.length > 0 && (
                        <datalist id={`rx-strength-options-${row.key}`}>
                          {availableStrengths.map((str, sIdx) => <option key={sIdx} value={str} />)}
                        </datalist>
                      )}
                    </div>
                  </td>
                )
              }

              return (
                <td key={field}>
                  <input
                    aria-label={`${field} ${index + 1}`}
                    type="number"
                    required={['days', 'quantity', 'unitPrice'].includes(field)}
                    min={field === 'days' || field === 'quantity' ? 1 : 0}
                    step={field === 'days' || field === 'quantity' ? 1 : .01}
                    placeholder="0"
                    value={row[field]}
                    onChange={(event) => {
                      const val = event.target.value
                      change((current) => ({
                        ...current,
                        medicines: current.medicines.map((medicine) => {
                          if (medicine.key !== row.key) return medicine
                          return updateMedicine(medicine, field, val)
                        })
                      }))
                    }}
                  />
                </td>
              )
            })}<td className="rx-line-amount">{currency(totals.lines[index])}</td><td><button type="button" aria-label={`Remove medicine ${index + 1}`} disabled={draft.medicines.length === 1} onClick={() => change((current) => ({ ...current, medicines: current.medicines.filter((medicine) => medicine.key !== row.key) }))}><FiTrash2 /></button></td></tr> })}</tbody></table></div></fieldset>
          {medicinePagination()}<p className="rx-dose-note">Morning, afternoon and evening values are units per dose. Quantity is calculated from doses × days and can be adjusted.</p><div className="rx-totals"><span>Medicines: {draft.medicines.length}</span><span>Total quantity: {totals.quantity}</span><strong>Total payable {currency(totals.amount)}</strong></div>
        </section>}
        <footer className="rx-footer"><p><FiCreditCard />{medicinesStep ? 'Next: payment method and billing' : 'Next: add medicines and dose schedules'}</p><div>{medicinesStep ? <button type="button" disabled={busy} onClick={() => navigate('/pharmacist/dispensing')}>Back</button> : null}<button type="button" disabled={busy || photoLoading} onClick={saveDraft}>Save Draft</button><button className="rx-primary" type="submit" disabled={busy || cameraActive || photoLoading}>{busy ? 'Please wait...' : medicinesStep ? 'Proceed to Payment' : 'Next: Add Medicines'}<FiArrowRight /></button></div></footer>
      </form>}
    </div>
  </PharmacistLayout>
}
