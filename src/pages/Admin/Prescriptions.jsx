import AdminLayout from './AdminLayout'
import AdminTable from './AdminTable'
import { adminTables } from './adminData'

function Prescriptions() {
  return <AdminLayout activeLabel="Prescriptions" title="Prescriptions" subtitle="Admin / Prescriptions"><AdminTable {...adminTables.prescriptions} /></AdminLayout>
}

export default Prescriptions
