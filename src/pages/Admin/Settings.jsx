import AdminLayout from './AdminLayout'
import AdminTable from './AdminTable'
import { adminTables } from './adminData'

function Settings() {
  return <AdminLayout activeLabel="Settings" title="Settings" subtitle="Admin / Settings"><AdminTable {...adminTables.settings} /></AdminLayout>
}

export default Settings
