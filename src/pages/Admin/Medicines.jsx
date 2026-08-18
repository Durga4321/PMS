import AdminLayout from './AdminLayout'
import AdminTable from './AdminTable'
import { adminTables } from './adminData'

function Medicines() {
  return <AdminLayout activeLabel="Medicines" title="Medicines" subtitle="Admin / Medicines"><AdminTable {...adminTables.medicines} /></AdminLayout>
}

export default Medicines
