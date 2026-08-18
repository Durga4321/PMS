import { dispensePrescription, generateBill, getDailySalesReport, getInvoice, getPendingPharmacyPrescriptions, recordPayment } from '../../config/api'
import PharmacistApiScreen from './PharmacistApiScreen'

export default function Dispensing() {
  return <PharmacistApiScreen activeLabel="Dispensing" title="Dispensing and Billing" subtitle="Pharmacist / Dispensing" load={getPendingPharmacyPrescriptions} actions={[{ label: 'Dispense', fn: (_, body) => dispensePrescription(body) }, { label: 'Generate Bill', fn: (_, body) => generateBill(body) }, { label: 'Get Invoice', fn: (id) => getInvoice(id) }, { label: 'Record Payment', fn: (_, body) => recordPayment(body) }, { label: 'Daily Sales', fn: () => getDailySalesReport() }]} />
}
