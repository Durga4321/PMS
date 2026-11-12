import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { FiArrowRight, FiCamera, FiCheckCircle, FiCreditCard, FiFileText, FiPlus, FiRefreshCw, FiTrash2, FiUpload, FiUser, FiX } from 'react-icons/fi'
import PharmacistLayout from './PharmacistLayout'
import { pharmacistPrescriptionApi } from '../../config/api'
import { useToast } from '../../components/ToastProvider'
import { confirmAction } from '../../components/confirmAction'
import { useLanguage } from '../../i18n/language'
import { newMedicine, newPrescription, prescriptionPayload, prescriptionTotals, savedRecord, updateMedicine } from './prescriptionModel'
import { archivePrescription, clearPrescriptionDraft, listPrescriptionReferences, prescriptionScope, readPrescriptionDraft, savePrescriptionDraft } from './prescriptionStorage'
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

  useEffect(() => {
    let active = true
    async function restore() {
      try {
        const stored = await readPrescriptionDraft(prescriptionScope())
        if (active && stored?.draft) { latest.current = stored.draft; setDraft(stored.draft) }
      } catch (failure) { if (active) setNotice(failure.message) }
      finally { if (active) setLoading(false) }
    }
    restore()
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
    try { await savePrescriptionDraft(prescriptionScope(), latest.current); setNotice('Draft and prescription photo saved on this device.'); showToast('Draft saved successfully.') }
    catch (failure) { setError(failure.message) }
    finally { inFlight.current = false; setBusy(false) }
  }

  async function proceed(event) {
    event.preventDefault()
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setError('')
    stopCamera()
    try {
      const scope = prescriptionScope()
      let current = latest.current
      const payload = prescriptionPayload(current)
      await savePrescriptionDraft(scope, current)
      if (!current.prescriptionId) {
        const prescription = savedRecord(await pharmacistPrescriptionApi.create(payload), 'prescription')
        current = { ...current, prescriptionId: prescription.id }
        change(current)
        await savePrescriptionDraft(scope, current)
        await archivePrescription(scope, current)
      }
      if (!current.billId) {
        const bill = savedRecord(await pharmacistPrescriptionApi.bill({ ...payload, prescriptionId: current.prescriptionId, totalAmount: prescriptionTotals(current.medicines).amount, clientRequestId: `${current.requestId}:bill` }), 'bill')
        const rawAmount = bill.totalAmount ?? bill.grandTotal ?? bill.amount ?? bill.total
        const validAmount = rawAmount != null && Number.isFinite(Number(rawAmount)) && Number(rawAmount) >= 0
        current = { ...current, billId: bill.id, billAmount: validAmount ? Number(rawAmount) : null }
        change(current)
        await savePrescriptionDraft(scope, current)
        await archivePrescription(scope, current)
      }
      if (current.billAmount == null) throw new Error('The bill was created without a valid payable amount. Check Bills before continuing.')
      navigate('/pharmacist/dispensing?step=payment')
    } catch (failure) { setError(failure.message || 'Unable to prepare this prescription for payment.') }
    finally { inFlight.current = false; setBusy(false) }
  }

  async function nextStep(event) {
    if (medicinesStep) return proceed(event)
    event.preventDefault()
    if (!draft.patient.patientName.trim() || !draft.patient.doctorName.trim()) { setError('Enter the patient name and doctor name.'); return }
    setError('')
    setBusy(true)
    stopCamera()
    try {
      await savePrescriptionDraft(prescriptionScope(), latest.current)
      navigate('/pharmacist/dispensing?step=medicines')
    } catch (failure) { setError(failure.message) }
    finally { setBusy(false) }
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
      await pharmacistPrescriptionApi.pay({ prescriptionId: current.prescriptionId, billId: current.billId, amount: current.billAmount, paymentMethod: current.paymentMethod, paymentMode: current.paymentMethod, transactionReference: current.transactionReference.trim(), clientRequestId: `${current.requestId}:payment` })
      const completed = { ...current, paymentComplete: true }
      change(completed)
      try {
        await savePrescriptionDraft(prescriptionScope(), completed)
        await archivePrescription(prescriptionScope(), completed)
      } catch { setNotice('Payment was recorded, but the saved reference on this device could not be updated.') }
      showToast('Payment recorded successfully!')
    } catch (failure) { setError(failure.message || 'Unable to record payment.') }
    finally { inFlight.current = false; setBusy(false) }
  }

  async function startNew() {
    if (!draft.paymentComplete && (draft.patient.patientName || draft.photo || draft.medicines.some((row) => row.medicineName)) && !await confirmAction('Start a new prescription? Save your draft first to keep unfinished changes.', { title: 'New Prescription', confirmLabel: 'Continue' })) return
    try {
      await clearPrescriptionDraft(prescriptionScope())
      change(newPrescription())
      stopCamera()
      setError(''); setNotice(''); setReferencePreview(null)
      navigate('/pharmacist/dispensing')
    } catch (failure) { setError(failure.message) }
  }

  async function showReferences() {
    try { setReferences(references ? null : await listPrescriptionReferences(prescriptionScope())) }
    catch (failure) { setError(failure.message) }
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
      {references ? <section className="rx-card rx-references"><h2>Saved References</h2><p>Prescription photos saved on this device for your account.</p>{references.length ? references.map((record) => <button key={record.key} type="button" onClick={() => setReferencePreview(record.draft)}><FiFileText /><span translate="no">{record.draft.patient.patientName}</span><span>{record.draft.patient.prescriptionDate}</span></button>) : <p>No saved prescription references yet.</p>}</section> : null}
      {referencePreview ? <section className="rx-card rx-reference-preview"><header><h2>Prescription Reference</h2><button type="button" onClick={() => setReferencePreview(null)} aria-label="Close"><FiX /></button></header><p translate="no">{referencePreview.patient.patientName} · {referencePreview.patient.doctorName}</p>{referencePreview.photo ? <Photo file={referencePreview.photo} /> : <p>No prescription photo attached.</p>}<p><span>Prescription ID</span>: {referencePreview.prescriptionId}</p></section> : null}
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
          <fieldset disabled={busy || locked}><div className="rx-table-scroll"><table><thead><tr>{['Medicine Name', 'Strength', 'Morning', 'Afternoon', 'Evening', 'Duration (days)', 'Quantity', 'Unit Price', 'Amount', 'Actions'].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead><tbody>{draft.medicines.slice(visiblePage * 3, visiblePage * 3 + 3).map((row, localIndex) => { const index = visiblePage * 3 + localIndex; return <tr key={row.key}>{['medicineName', 'strength', 'morning', 'afternoon', 'evening', 'days', 'quantity', 'unitPrice'].map((field) => <td key={field}><input aria-label={`${field} ${index + 1}`} type={field === 'medicineName' || field === 'strength' ? 'text' : 'number'} required={['medicineName', 'days', 'quantity', 'unitPrice'].includes(field)} min={field === 'days' || field === 'quantity' ? 1 : 0} step={field === 'days' || field === 'quantity' ? 1 : .01} maxLength={field === 'medicineName' ? 200 : undefined} placeholder={field === 'medicineName' ? 'Enter medicine name' : field === 'strength' ? 'As prescribed' : '0'} value={row[field]} onChange={(event) => change((current) => ({ ...current, medicines: current.medicines.map((medicine) => medicine.key === row.key ? updateMedicine(medicine, field, event.target.value) : medicine) }))} /></td>)}<td className="rx-line-amount">{currency(totals.lines[index])}</td><td><button type="button" aria-label={`Remove medicine ${index + 1}`} disabled={draft.medicines.length === 1} onClick={() => change((current) => ({ ...current, medicines: current.medicines.filter((medicine) => medicine.key !== row.key) }))}><FiTrash2 /></button></td></tr> })}</tbody></table></div></fieldset>
          {medicinePagination()}<p className="rx-dose-note">Morning, afternoon and evening values are units per dose. Quantity is calculated from doses × days and can be adjusted.</p><div className="rx-totals"><span>Medicines: {draft.medicines.length}</span><span>Total quantity: {totals.quantity}</span><strong>Total payable {currency(totals.amount)}</strong></div>
        </section>}
        <footer className="rx-footer"><p><FiCreditCard />{medicinesStep ? 'Next: payment method and billing' : 'Next: add medicines and dose schedules'}</p><div>{medicinesStep ? <button type="button" disabled={busy} onClick={() => navigate('/pharmacist/dispensing')}>Back</button> : null}<button type="button" disabled={busy || photoLoading} onClick={saveDraft}>Save Draft</button><button className="rx-primary" type="submit" disabled={busy || cameraActive || photoLoading}>{busy ? 'Please wait...' : medicinesStep ? 'Proceed to Payment' : 'Next: Add Medicines'}<FiArrowRight /></button></div></footer>
      </form>}
    </div>
  </PharmacistLayout>
}
