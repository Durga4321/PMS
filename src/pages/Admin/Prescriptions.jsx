import { cancelDoctorPrescription, completeDoctorPrescription, createDoctorPrescription, getDoctorPrescription, updateDoctorPrescription } from '../../config/api'
import AdminApiScreen from './AdminApiScreen'

export default function Prescriptions() {
  return <AdminApiScreen activeLabel="Prescriptions" title="Doctor Prescriptions" subtitle="Admin / Prescriptions" load={() => Promise.resolve([])} actions={[{ label: 'Create', fn: (_, body) => createDoctorPrescription(body) }, { label: 'Get', fn: (id) => getDoctorPrescription(id) }, { label: 'Update', fn: (id, body) => updateDoctorPrescription(id, body) }, { label: 'Cancel', fn: (id, body) => cancelDoctorPrescription(id, body) }, { label: 'Complete', fn: (id, body) => completeDoctorPrescription(id, body) }]} />
}
