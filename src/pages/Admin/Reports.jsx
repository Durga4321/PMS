import AdminLayout from './AdminLayout'
import AdminTable from './AdminTable'
import { adminTables } from './adminData'

function Reports() {
  return <AdminLayout activeLabel="Reports" title="Reports" subtitle="Admin / Reports"><AdminTable {...adminTables.reports} /></AdminLayout>
}

export default Reports
