import AdminLayout from './AdminLayout'
import AdminTable from './AdminTable'
import { adminTables } from './adminData'

function Dispensing() {
  return <AdminLayout activeLabel="Dispensing" title="Dispense Medicine" subtitle="Admin / Dispensing"><AdminTable {...adminTables.dispensing} /></AdminLayout>
}

export default Dispensing
