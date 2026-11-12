import { dispensePrescription, generateBill, getDailySalesReport, getInvoice, getPharmacyDispensingOverview, recordPayment } from '../../config/api'
import PharmacistApiScreen from './PharmacistApiScreen'
import PrescriptionWorkspace from './PrescriptionWorkspace'

export default function Dispensing() {
  return <PrescriptionWorkspace />
}

export function DispensingHistory() {
  return <PharmacistApiScreen activeLabel="Dispensing" title="Dispensing and Billing" subtitle="Pharmacist / Dispensing" load={getPharmacyDispensingOverview} actions={[{ label: 'Dispense', fn: (_, body) => dispensePrescription(body) }, { label: 'Generate Bill', fn: (_, body) => generateBill(body) }, { label: 'Get Invoice', fn: (id) => getInvoice(id) }, { label: 'Record Payment', fn: (_, body) => recordPayment(body) }, { label: 'Daily Sales', fn: () => getDailySalesReport() }]} />
}
