import { approveMedicineReturn, cancelMedicineReturn, createMedicineReturn, getMedicineReturn, listMedicineReturns } from '../../config/api'
import PharmacistApiScreen from './PharmacistApiScreen'

export default function Returns() {
  return <PharmacistApiScreen activeLabel="Returns" title="Medicine Returns" subtitle="Pharmacist / Returns" load={listMedicineReturns} actions={[{ label: 'Create Return', fn: (_, body) => createMedicineReturn(body) }, { label: 'Get Return', fn: (id) => getMedicineReturn(id) }, { label: 'Approve', fn: (id, body) => approveMedicineReturn(id, body) }, { label: 'Cancel', fn: (id, body) => cancelMedicineReturn(id, body) }]} />
}
