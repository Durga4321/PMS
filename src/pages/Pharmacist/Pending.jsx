import { getPendingPharmacyPrescriptions, getPharmacyPrescription } from '../../config/api'
import PharmacistApiScreen from './PharmacistApiScreen'

export default function Pending() {
  return <PharmacistApiScreen activeLabel="Pending" title="Pending Prescriptions" subtitle="Pharmacist / Pending" load={getPendingPharmacyPrescriptions} actions={[{ label: 'Get Prescription', fn: (id) => getPharmacyPrescription(id) }]} />
}
