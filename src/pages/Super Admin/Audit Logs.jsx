import SuperAdminModulePage from './SuperAdminModulePage'
import './Audit Logs.css'

const headers = ['Date & Time', 'User', 'Role', 'Module', 'Action', 'Description', 'IP Address', 'Status']

function AuditLogs() {
  return <SuperAdminModulePage title="Audit Logs" headers={headers} rows={[]} />
}

export default AuditLogs
