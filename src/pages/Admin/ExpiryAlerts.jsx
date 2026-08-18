import AdminLayout from './AdminLayout'
import AdminTable from './AdminTable'
import { adminTables } from './adminData'

function ExpiryAlerts() {
  return <AdminLayout activeLabel="Expiry Alerts" title="Expiry Alerts" subtitle="Admin / Expiry Alerts"><AdminTable {...adminTables.expiryAlerts} /></AdminLayout>
}

export default ExpiryAlerts
