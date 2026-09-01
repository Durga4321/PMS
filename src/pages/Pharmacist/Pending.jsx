import { createManualPharmacyPrescription, getPendingPharmacyPrescriptions, getPharmacyPrescription, getPharmacyPrescriptions } from '../../config/api'
import PharmacistApiScreen from './PharmacistApiScreen'

export default function Pending() {
  return <PharmacistApiScreen activeLabel="Pending" title="Pending Prescriptions" subtitle="Pharmacist / Pending" load={getPendingPharmacyPrescriptions} actions={[{ label: 'All Prescriptions', fn: () => getPharmacyPrescriptions() }, { label: 'Get Prescription', fn: (id) => getPharmacyPrescription(id) }, { label: 'Create Manual Prescription', fn: (_, body) => createManualPharmacyPrescription(body) }]} />
}

