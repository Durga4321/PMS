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
  recordManualCashPayment,
  pharmacistPrescriptionApi
} from '../../config/api'
import { useToast } from '../../components/ToastProvider'
import { confirmAction } from '../../components/confirmAction'
import { useLanguage } from '../../i18n/language'
import { newMedicine, newPrescription, prescriptionPayload, prescriptionTotals, savedRecord, updateMedicine } from './prescriptionModel'
import usePrescriptionCamera from './usePrescriptionCamera'
import './PrescriptionWorkspace.css'

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

  useEffect(() => {
    let active = true
    async function initWorkspace() {
      try {
        const [draftsRes, medsRes] = await Promise.allSettled([
          listDispensingDrafts(),
          getDispensingMedicines(),
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
        if (medsRes.status === 'fulfilled') {
          const mList = medsRes.value?.data || medsRes.value?.medicines || (Array.isArray(medsRes.value) ? medsRes.value : [])
          if (Array.isArray(mList) && mList.length > 0) {
            setAvailableMeds(mList)
          }
        }
      } catch (failure) {
        if (active) setNotice(failure.message)
      } finally {
        if (active) setLoading(false)
      }
    }
    initWorkspace()
    return () => { active = false }
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

      if (current.billAmount == null) throw new Error('The bill was created without a valid payable amount. Check Bills before continuing.')
      navigate('/pharmacist/dispensing?step=payment')
    } catch (failure) {
      setError(failure.message || 'Unable to prepare this prescription for payment.')
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  async function nextStep(event) {
    if (medicinesStep) return proceed(event)
    event.preventDefault()
    if (!draft.patient.patientName.trim() || !draft.patient.doctorName.trim()) { setError('Enter the patient name and doctor name.'); return }
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
      <ol className="rx-stepper" aria-label="Prescription progress">{['Patient & Prescription', 'Add Medicines', 'Payment'].map((label, index) => <li key={label} className={(index === activeStep) ? 'is-active' : ''} aria-current={(index === activeStep) ? 'step' : undefined}><b>{index + 1}</b>{label}</li>)}</ol>
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
            {patientField('patientPhone', 'Phone Number', 'tel', { inputMode: 'numeric', maxLength: 10, pattern: '[0-9]{10}' })}
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
          <fieldset disabled={busy || locked}><div className="rx-table-scroll"><table><thead><tr>{['Medicine Name', 'Strength', 'Morning', 'Afternoon', 'Evening', 'Duration (days)', 'Quantity', 'Unit Price', 'Amount', 'Actions'].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead><tbody>{draft.medicines.slice(visiblePage * 3, visiblePage * 3 + 3).map((row, localIndex) => { const index = visiblePage * 3 + localIndex; return <tr key={row.key}>{['medicineName', 'strength', 'morning', 'afternoon', 'evening', 'days', 'quantity', 'unitPrice'].map((field) => <td key={field}><input aria-label={`${field} ${index + 1}`} type={field === 'medicineName' || field === 'strength' ? 'text' : 'number'} required={['medicineName', 'days', 'quantity', 'unitPrice'].includes(field)} min={field === 'days' || field === 'quantity' ? 1 : 0} step={field === 'days' || field === 'quantity' ? 1 : .01} maxLength={field === 'medicineName' ? 200 : undefined} placeholder={field === 'medicineName' ? 'Enter medicine name' : field === 'strength' ? 'As prescribed' : '0'} list={field === 'medicineName' ? `rx-med-options-${row.key}` : undefined} value={row[field]} onChange={(event) => {
            const val = event.target.value
            let matchedPrice = null
            let matchedStrength = null
            if (field === 'medicineName' && Array.isArray(availableMeds) && availableMeds.length > 0) {
              const match = availableMeds.find((m) => String(m.name || m.medicineName || '').trim().toLowerCase() === val.trim().toLowerCase())
              if (match) {
                matchedPrice = match.sellingPrice || match.unitPrice || match.price || match.costPrice
                matchedStrength = match.strength || match.power
              }
            }
            change((current) => ({
              ...current,
              medicines: current.medicines.map((medicine) => {
                if (medicine.key !== row.key) return medicine
                let updated = updateMedicine(medicine, field, val)
                if (matchedPrice != null) updated = updateMedicine(updated, 'unitPrice', String(matchedPrice))
                if (matchedStrength) updated = updateMedicine(updated, 'strength', String(matchedStrength))
                return updated
              })
            }))
          }} />{field === 'medicineName' && Array.isArray(availableMeds) && availableMeds.length > 0 && <datalist id={`rx-med-options-${row.key}`}>{availableMeds.map((m, mIdx) => <option key={m.id || m.medicineId || mIdx} value={m.name || m.medicineName} />)}</datalist>}</td>)}<td className="rx-line-amount">{currency(totals.lines[index])}</td><td><button type="button" aria-label={`Remove medicine ${index + 1}`} disabled={draft.medicines.length === 1} onClick={() => change((current) => ({ ...current, medicines: current.medicines.filter((medicine) => medicine.key !== row.key) }))}><FiTrash2 /></button></td></tr> })}</tbody></table></div></fieldset>
          {medicinePagination()}<p className="rx-dose-note">Morning, afternoon and evening values are units per dose. Quantity is calculated from doses × days and can be adjusted.</p><div className="rx-totals"><span>Medicines: {draft.medicines.length}</span><span>Total quantity: {totals.quantity}</span><strong>Total payable {currency(totals.amount)}</strong></div>
        </section>}
        <footer className="rx-footer"><p><FiCreditCard />{medicinesStep ? 'Next: payment method and billing' : 'Next: add medicines and dose schedules'}</p><div>{medicinesStep ? <button type="button" disabled={busy} onClick={() => navigate('/pharmacist/dispensing')}>Back</button> : null}<button type="button" disabled={busy || photoLoading} onClick={saveDraft}>Save Draft</button><button className="rx-primary" type="submit" disabled={busy || cameraActive || photoLoading}>{busy ? 'Please wait...' : medicinesStep ? 'Proceed to Payment' : 'Next: Add Medicines'}<FiArrowRight /></button></div></footer>
      </form>}
    </div>
  </PharmacistLayout>
}
