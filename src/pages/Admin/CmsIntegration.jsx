import { createIntegrationPrescription, getIntegrationMedicines, upsertIntegrationAppointment, upsertIntegrationBranch, upsertIntegrationDoctor, upsertIntegrationHospital, upsertIntegrationPatient } from '../../config/api'
import AdminApiScreen from './AdminApiScreen'

export default function CmsIntegration() {
  return <AdminApiScreen activeLabel="CMS Integration" title="CMS Integration" subtitle="Admin / CMS Integration" load={getIntegrationMedicines} actions={[{ label: 'Upsert Appointment', fn: (id, body) => upsertIntegrationAppointment(id, body) }, { label: 'Upsert Doctor', fn: (id, body) => upsertIntegrationDoctor(id, body) }, { label: 'Upsert Hospital', fn: (id, body) => upsertIntegrationHospital(id, body) }, { label: 'Upsert Branch', fn: (_, body) => upsertIntegrationBranch(body.externalHospitalId, body.externalBranchId, body) }, { label: 'Upsert Patient', fn: (id, body) => upsertIntegrationPatient(id, body) }, { label: 'Create Prescription', fn: (_, body) => createIntegrationPrescription(body) }]} />
}
