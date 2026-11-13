import { createManualPharmacyPrescription, getPendingPharmacyPrescriptions, getPharmacyPrescription, getPharmacyPrescriptions, dispensePrescription } from '../../config/api'
import PharmacistApiScreen from './PharmacistApiScreen'

export default function Prescriptions() {
  return <PharmacistApiScreen activeLabel="Prescriptions" title="Prescriptions" subtitle="Pharmacist / Prescriptions" load={getPharmacyPrescriptions} actions={[{ label: 'All Prescriptions', fn: () => getPharmacyPrescriptions() }, { label: 'Pending Prescriptions', fn: () => getPendingPharmacyPrescriptions() }, { label: 'Get Prescription', fn: (id) => getPharmacyPrescription(id) }, { label: 'Dispense', fn: (_, body) => dispensePrescription(body) }, { label: 'Create Manual Prescription', fn: (_, body) => createManualPharmacyPrescription(body) }]} />
}
