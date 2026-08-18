import { dispensePrescription, generateBill, getInvoice, getPendingPharmacyPrescriptions, getPharmacyPrescription, recordPayment } from '../../config/api'
import AdminApiScreen from './AdminApiScreen'

export default function Dispensing() {
  return <AdminApiScreen activeLabel="Dispensing" title="Dispensing and Billing" subtitle="Admin / Dispensing" load={getPendingPharmacyPrescriptions} actions={[{ label: 'Get Prescription', fn: (id) => getPharmacyPrescription(id) }, { label: 'Dispense', fn: (_, body) => dispensePrescription(body) }, { label: 'Generate Bill', fn: (_, body) => generateBill(body) }, { label: 'Get Invoice', fn: (id) => getInvoice(id) }, { label: 'Payment', fn: (_, body) => recordPayment(body) }]} />
}
