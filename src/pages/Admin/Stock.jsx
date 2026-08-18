import AdminLayout from './AdminLayout'
import AdminTable from './AdminTable'
import { adminTables } from './adminData'

function Stock() {
  return <AdminLayout activeLabel="Stock" title="Stock Management" subtitle="Admin / Stock"><AdminTable {...adminTables.stock} /></AdminLayout>
}

export default Stock
